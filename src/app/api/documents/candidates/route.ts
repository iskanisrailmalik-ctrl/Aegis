import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeError } from "@/lib/api-security";
import { categorize } from "@/lib/sms/categories";
import { reconcileStatement, type ExtractedStatementRow, type ReconciliationResult } from "@/lib/sms/documents";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commitPayloadSchema = z.object({
  documentId: z.string().min(1),
  decisions: z.array(
    z.object({
      candidateId: z.string().min(1),
      targetComponent: z.enum([
        "transaction-credit",
        "transaction-debit",
        "loan-emi",
        "account-metadata",
        "ignore",
      ]),
    })
  ),
});

export interface CandidateRecord {
  id: string;
  documentId: string;
  fieldType: string;
  suggestedComponent: string;
  extractedValue: string;
  confidence: number;
  sourceLocation: string;
  userDecision?: string | null;
  reassignedTo?: string | null;
  createdAt: Date;
}

/**
 * GET: Fetch staged ExtractedDataCandidate rows for a document.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const candidates = await (db as any).extractedDataCandidate.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ candidates });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/**
 * POST: Atomic Commit & Reconciliation Action!
 * Uses Prisma $transaction to guarantee multi-table write atomicity,
 * applies Zod input validation, enforces idempotencyKeys to prevent duplicate transactions,
 * and executes post-import statement reconciliation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = commitPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { documentId, decisions } = parseResult.data;

    const candidates: CandidateRecord[] = await (db as any).extractedDataCandidate.findMany({
      where: { documentId },
    });
    const candidateMap = new Map<string, CandidateRecord>(candidates.map((c) => [c.id, c]));

    const importedTxRows: ExtractedStatementRow[] = [];
    let committedTxsCount = 0;
    let committedLoansCount = 0;
    let ignoredCount = 0;

    // Execute multi-table writes inside an ATOMIC Prisma $transaction
    await db.$transaction(async (tx: any) => {
      for (const item of decisions) {
        const candidate = candidateMap.get(item.candidateId);
        if (!candidate) continue;

        const target = item.targetComponent;
        const isReassigned = target !== candidate.suggestedComponent;

        if (target === "ignore") {
          await tx.extractedDataCandidate.update({
            where: { id: candidate.id },
            data: {
              userDecision: "ignored",
              reassignedTo: "ignore",
            },
          });
          ignoredCount++;
          continue;
        }

        await tx.extractedDataCandidate.update({
          where: { id: candidate.id },
          data: {
            userDecision: isReassigned ? "reassigned" : "accepted",
            reassignedTo: target,
          },
        });

        let payload: any = {};
        try {
          payload = JSON.parse(candidate.extractedValue);
        } catch {
          payload = { rawText: candidate.extractedValue };
        }

        // Map to live Transaction table with Idempotency Key protection
        if (target === "transaction-credit" || target === "transaction-debit") {
          const type = target === "transaction-credit" ? "credit" : "debit";
          const txDate = payload.date ? new Date(payload.date) : new Date();
          const validDate = isNaN(txDate.getTime()) ? new Date() : txDate;

          const category = categorize({
            merchant: payload.counterparty ?? null,
            type,
          });

          // Idempotency key derived from document + candidate ID to prevent retried duplicates
          const idempotencyKey = `doc_${documentId}_candidate_${candidate.id}`;

          // Upsert to handle retries gracefully without crashing or duplicating
          await tx.transaction.upsert({
            where: { idempotencyKey },
            update: {},
            create: {
              idempotencyKey,
              type,
              amount: payload.amount ?? 0,
              merchant: payload.counterparty ?? null,
              txDate: validDate,
              bank: payload.bank ?? null,
              sender: "bankStatement",
              senderType: "bank",
              category,
              classification: "verified",
              rawMessage: payload.rawText ?? `Imported from statement: ${payload.counterparty ?? "Unknown"}`,
              receivedAt: new Date(),
            },
          });

          committedTxsCount++;
          importedTxRows.push({
            date: validDate.toISOString(),
            description: payload.counterparty ?? payload.rawText,
            amount: payload.amount ?? 0,
            type,
            balance: payload.balance,
            refNo: payload.refNo,
          });
        }

        // Map to live LoanAccount table
        if (target === "loan-emi") {
          await tx.loanAccount.create({
            data: {
              lender: payload.lender ?? "Lender",
              loanType: "personal",
              principal: payload.principal ?? null,
              emiAmount: payload.emiAmount ?? payload.amount ?? null,
              tenure: payload.tenure ?? null,
              dueDay: payload.dueDay ?? null,
              interestRate: payload.interestRate ?? null,
              loanRef: payload.loanRef ?? payload.refNo ?? null,
              startDate: payload.dueDate ? new Date(payload.dueDate) : null,
              status: "active",
            },
          });
          committedLoansCount++;
        }
      }

      await tx.documentRecord.update({
        where: { id: documentId },
        data: { extractionStatus: "parsed" },
      });
    });

    // Run Reconciliation Pass after atomic commit
    let reconciliationResult: ReconciliationResult | null = null;
    if (importedTxRows.length > 0) {
      const dates = importedTxRows
        .map((r) => (r.date ? new Date(r.date) : null))
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
      const startDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : undefined;
      const endDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;

      reconciliationResult = await reconcileStatement(importedTxRows, startDate, endDate);

      await db.documentRecord.update({
        where: { id: documentId },
        data: { reconciliationSummary: JSON.stringify(reconciliationResult) },
      });
    }

    return NextResponse.json({
      success: true,
      committedTxsCount,
      committedLoansCount,
      ignoredCount,
      reconciliation: reconciliationResult,
    });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

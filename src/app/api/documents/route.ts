import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import {
  extractLoanFields,
  parseStatementCSV,
  reconcileStatement,
  detectDocumentType,
} from "@/lib/sms/documents";
import { isEncrypted } from "@/lib/sms/device-capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List all documents. */
export async function GET() {
  try {
    const docs = await db.documentRecord.findMany({
      orderBy: { uploadedAt: "desc" },
    });
    return NextResponse.json({ documents: docs });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

/** Upload a document (text/CSV content) and extract fields. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, content, sourceInstitution } = body as {
      documentType?: string;
      fileName: string;
      content: string;
      sourceInstitution?: string;
    };

    if (!fileName || !content) {
      return NextResponse.json(
        { error: "Missing fileName or content" },
        { status: 400 }
      );
    }

    // Intelligent auto-detection of document type (requirement 8)
    const userDocType = body.documentType as string | undefined;
    let documentType: "loanAgreement" | "emiSchedule" | "bankStatement";
    let detectionInfo: { confidence: string; reasons: string[] } | undefined;

    if (!userDocType || userDocType === "auto") {
      const detection = detectDocumentType(content);
      documentType = detection.type;
      detectionInfo = { confidence: detection.confidence, reasons: detection.reasons };
    } else {
      documentType = userDocType as "loanAgreement" | "emiSchedule" | "bankStatement";
    }

    let extractedFields: Record<string, unknown> | null = null;
    let reconciliationSummary: Record<string, unknown> | null = null;
    let linkedLoanId: string | null = null;
    let status = "parsed";

    if (documentType === "loanAgreement" || documentType === "emiSchedule") {
      // Extract loan fields
      const fields = extractLoanFields(content);
      extractedFields = fields as Record<string, unknown>;

      // Try to find or create a matching loan
      if (fields.lender) {
        // SQLite doesn't support mode: "insensitive" — use case-insensitive contains workaround
        const allLoans = await db.loanAccount.findMany();
        const existing = allLoans.find((l) =>
          l.lender.toLowerCase().includes(fields.lender!.toLowerCase())
        );
        if (existing) {
          linkedLoanId = existing.id;
          // Enrich the loan with extracted fields
          const updateData: Record<string, unknown> = {};
          if (fields.emiAmount && !existing.emiAmount) updateData.emiAmount = fields.emiAmount;
          if (fields.principal && !existing.principal) updateData.principal = fields.principal;
          if (fields.tenure && !existing.tenure) updateData.tenure = fields.tenure;
          if (fields.dueDay && !existing.dueDay) updateData.dueDay = fields.dueDay;
          if (fields.loanRef && !existing.loanRef) updateData.loanRef = fields.loanRef;
          if (Object.keys(updateData).length > 0) {
            await db.loanAccount.update({ where: { id: existing.id }, data: updateData });
          }
        } else if (fields.emiAmount) {
          // Create a new loan from the extracted fields
          const loan = await db.loanAccount.create({
            data: {
              lender: fields.lender,
              loanType: "personal",
              loanRef: fields.loanRef ?? null,
              principal: fields.principal ?? null,
              emiAmount: fields.emiAmount,
              dueDay: fields.dueDay ?? null,
              tenure: fields.tenure ?? null,
              startDate: fields.startDate ? new Date(fields.startDate) : null,
              status: "active",
            },
          });
          linkedLoanId = loan.id;
        }
      }

      if (!fields.lender && !fields.emiAmount) {
        status = "needsReview";
      }
    } else if (documentType === "bankStatement") {
      // Parse CSV and reconcile
      const rows = parseStatementCSV(content);
      if (rows.length === 0) {
        status = "needsReview";
        extractedFields = { rowCount: 0, note: "No transactions detected in CSV" };
      } else {
        // Determine date range from rows
        const dates = rows
          .map((r) => (r.date ? new Date(r.date) : null))
          .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
        const startDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : undefined;
        const endDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;

        const reconciliation = await reconcileStatement(rows, startDate, endDate);
        reconciliationSummary = reconciliation as unknown as Record<string, unknown>;
        extractedFields = {
          rowCount: rows.length,
          dateRange: dates.length > 0 ? { start: startDate?.toISOString(), end: endDate?.toISOString() } : null,
        };
      }
    }

    const doc = await db.documentRecord.create({
      data: {
        documentType,
        fileName,
        sourceInstitution: sourceInstitution ?? null,
        extractionStatus: status,
        extractedFields: extractedFields ? JSON.stringify({
          ...extractedFields,
          ...(detectionInfo ? { _detection: detectionInfo } : {}),
        }) : null,
        linkedLoanId,
        reconciliationSummary: reconciliationSummary ? JSON.stringify(reconciliationSummary) : null,
      },
    });

    return NextResponse.json({
      ...doc,
      detectedType: documentType,
      detectionInfo,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { categorize } from "@/lib/sms/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reconciliation feedback loop (Spec Section 8.4).
 * Lets users act on reconciliation outcomes:
 * - "add": create a transaction from a missed statement row (fills coverage gap)
 * - "flag": mark an extra (unmatched SMS-derived) transaction for review
 * - "ignore": dismiss a missed/extra item
 *
 * This closes the feedback loop — missed transactions get added back,
 * improving the Rule Registry's effective coverage over time.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, documentId, statementRow, transactionId } = body as {
      action: "add" | "flag" | "ignore";
      documentId: string;
      statementRow?: {
        date?: string;
        description?: string;
        amount?: number;
        type?: string;
      };
      transactionId?: string;
    };

    if (!action || !documentId) {
      return NextResponse.json(
        { error: "Missing action or documentId" },
        { status: 400 }
      );
    }

    if (action === "add" && statementRow) {
      // Create a transaction from a missed statement row
      const amount = statementRow.amount;
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      const type = statementRow.type === "credit" ? "credit" : "debit";
      const txDate = statementRow.date ? new Date(statementRow.date) : new Date();
      if (isNaN(txDate.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }

      const category = categorize({
        merchant: statementRow.description ?? null,
        type,
      });

      const tx = await db.transaction.create({
        data: {
          type,
          amount,
          merchant: statementRow.description ?? null,
          txDate,
          bank: null,
          sender: null,
          senderType: "unknown",
          category,
          classification: "verified",
          rawMessage: `Imported from bank statement (reconciliation)`,
          receivedAt: new Date(),
        },
      });

      // Also create an SmsMessage record for the inbox
      await db.smsMessage.create({
        data: {
          rawText: `Bank statement: ${statementRow.description ?? "Unknown"} — ${amount} ${type}`,
          sender: "bankStatement",
          senderType: "bank",
          receivedAt: txDate,
          classification: "verified",
          linkedRecordType: "transaction",
          linkedRecordId: tx.id,
        },
      });

      return NextResponse.json({
        ok: true,
        action: "add",
        transactionId: tx.id,
        message: `Added transaction: ${type} ₹${amount} (${category})`,
      });
    }

    if (action === "flag" && transactionId) {
      // Mark an extra transaction as unverified for review
      const tx = await db.transaction.update({
        where: { id: transactionId },
        data: {
          classification: "unverified",
        },
      });
      return NextResponse.json({
        ok: true,
        action: "flag",
        transactionId: tx.id,
        message: "Transaction flagged for review",
      });
    }

    if (action === "ignore") {
      // Just acknowledge — no data change needed (the item is already in the reconciliation summary)
      return NextResponse.json({
        ok: true,
        action: "ignore",
        message: "Item dismissed",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { parseSms } from "@/lib/sms/parser";
import { detectScam } from "@/lib/sms/scam-detector";
import { categorizeWithOverrides } from "@/lib/sms/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compose / Reply — creates a new SmsMessage (user-composed or forwarded).
 * Also runs the full parse+detect pipeline so composed messages get classified
 * and linked to transactions just like ingested SMS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sender, text, replyToId } = body as {
      sender?: string;
      text: string;
      replyToId?: string;
    };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    // Run the full pipeline
    const parse = parseSms({ sender, text });
    const detection = detectScam({ sender, text, parse });
    const receivedAt = new Date();

    // Create the SmsMessage record
    const smsMessage = await db.smsMessage.create({
      data: {
        rawText: text.trim(),
        sender: sender ?? null,
        senderType: parse.senderType,
        receivedAt,
        classification: detection.classification,
        linkedRecordType: null,
        linkedRecordId: null,
      },
    });

    // Link to reply target if provided
    if (replyToId) {
      // Mark the original as "replied" (store in extra field via update)
      // For now just note it in the new message
    }

    // Process the message through the full ingest pipeline
    let transactionId: string | undefined;
    let flaggedId: string | undefined;

    if (detection.classification === "flagged") {
      const flagged = await db.flaggedMessage.create({
        data: {
          sender: sender ?? null,
          content: text.trim(),
          classification: "flagged",
          reason: detection.reason,
          signals: JSON.stringify(detection.signals.map((s) => ({ key: s.key, label: s.label, severity: s.severity }))),
          receivedAt,
        },
      });
      await db.smsMessage.update({
        where: { id: smsMessage.id },
        data: { linkedRecordType: "flaggedMessage", linkedRecordId: flagged.id },
      });
      flaggedId = flagged.id;
    } else if (parse.ok && parse.fields.amount && parse.fields.type) {
      const category = await categorizeWithOverrides({
        merchant: parse.fields.merchant,
        bank: parse.bankName,
        sender,
        type: parse.fields.type,
        isEmi: parse.isEmi,
      });

      const tx = await db.transaction.create({
        data: {
          type: parse.fields.type,
          amount: parse.fields.amount,
          merchant: parse.fields.merchant ?? null,
          accountMasked: parse.fields.accountMasked ?? parse.fields.card ?? null,
          balance: parse.fields.balance ?? null,
          txDate: parse.fields.date ? new Date(parse.fields.date) : receivedAt,
          bank: parse.bankName ?? null,
          sender: sender ?? null,
          senderType: parse.senderType,
          category,
          classification: detection.classification,
          rawMessage: text.trim(),
          receivedAt,
        },
      });
      await db.smsMessage.update({
        where: { id: smsMessage.id },
        data: { linkedRecordType: "transaction", linkedRecordId: tx.id },
      });
      transactionId = tx.id;
    }

    return NextResponse.json({
      ok: true,
      messageId: smsMessage.id,
      classification: detection.classification,
      transactionId,
      flaggedId,
      parsed: parse.ok,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

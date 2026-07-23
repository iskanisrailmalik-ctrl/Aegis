/**
 * Phase C: Bulk SMS Import API
 *
 * POST /api/inbox/import
 *
 * Receives a batch of SMS messages (from the native Android importer)
 * and processes them through the existing parse pipeline.
 *
 * This endpoint is called by the web layer when the user taps
 * "Import Existing SMS History" in the Default SMS App settings.
 *
 * The native plugin (AegisSmsPlugin.importExistingSms) reads all SMS
 * from content://sms and returns them. The web layer then sends them
 * here in batches for processing.
 *
 * Flow:
 * 1. Native: Read all SMS from content://sms
 * 2. Web: Send batches to POST /api/inbox/import
 * 3. Backend: For each SMS, run parseSms → detectScam → categorize
 * 4. Backend: Create SmsMessage + Transaction/FlaggedMessage records
 * 5. Return summary: { total, imported, skipped, transactions, flagged }
 */

import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { parseSms } from "@/lib/sms/parser";
import { detectScam } from "@/lib/sms/scam-detector";
import { categorizeWithOverrides } from "@/lib/sms/categories";
import { detectOtp } from "@/lib/sms/otp-detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportSmsItem {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  date: string;
  direction?: "incoming" | "outgoing";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ImportSmsItem[] = body.messages ?? [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    let total = 0;
    let imported = 0;
    let skipped = 0;
    let transactionsCreated = 0;
    let flaggedCreated = 0;
    let otpDetected = 0;

    for (const msg of messages) {
      total++;
      try {
        // Skip outgoing messages — we only care about incoming bank SMS
        if (msg.direction === "outgoing") {
          skipped++;
          continue;
        }

        // Check for duplicate — skip if we already have this message
        const existing = await db.smsMessage.findFirst({
          where: {
            sender: msg.sender,
            rawText: msg.body,
            receivedAt: new Date(msg.timestamp),
          },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Run the full parse pipeline
        const parse = parseSms({ sender: msg.sender, text: msg.body });
        const detection = detectScam({ sender: msg.sender, text: msg.body, parse });
        const otpResult = detectOtp(msg.body);

        if (otpResult.isOtp) {
          otpDetected++;
        }

        const receivedAt = new Date(msg.timestamp);

        // Create the SmsMessage record
        const smsMessage = await db.smsMessage.create({
          data: {
            rawText: msg.body,
            sender: msg.sender,
            senderType: parse.senderType,
            receivedAt,
            classification: detection.classification,
            linkedRecordType: null,
            linkedRecordId: null,
          },
        });

        // Process based on classification
        if (detection.classification === "flagged") {
          const flagged = await db.flaggedMessage.create({
            data: {
              sender: msg.sender,
              content: msg.body,
              classification: "flagged",
              reason: detection.reason,
              signals: JSON.stringify(
                detection.signals.map((s) => ({
                  key: s.key,
                  label: s.label,
                  severity: s.severity,
                }))
              ),
              receivedAt,
            },
          });
          await db.smsMessage.update({
            where: { id: smsMessage.id },
            data: {
              linkedRecordType: "flaggedMessage",
              linkedRecordId: flagged.id,
            },
          });
          flaggedCreated++;
        } else if (parse.ok && parse.fields.amount && parse.fields.type) {
          // Skip OTP-only messages for transaction creation
          if (!otpResult.isOtp || msg.body.length > 200) {
            const category = await categorizeWithOverrides({
              merchant: parse.fields.merchant,
              bank: parse.bankName,
              sender: msg.sender,
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
                sender: msg.sender,
                senderType: parse.senderType,
                category,
                classification: detection.classification,
                rawMessage: msg.body,
                receivedAt,
              },
            });
            await db.smsMessage.update({
              where: { id: smsMessage.id },
              data: {
                linkedRecordType: "transaction",
                linkedRecordId: tx.id,
              },
            });
            transactionsCreated++;
          }
        }

        imported++;
      } catch {
        // Skip individual failures — continue processing the batch
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      total,
      imported,
      skipped,
      transactionsCreated,
      flaggedCreated,
      otpDetected,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

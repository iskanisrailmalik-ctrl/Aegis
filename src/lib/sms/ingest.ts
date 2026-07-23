/**
 * Shared ingestion pipeline: parse → detect → persist.
 * Used by /api/sms/parse and /api/seed.
 */

import { db } from "@/lib/db";
import { parseSms } from "./parser";
import { detectScam } from "./scam-detector";
import { matchOrCreateLoan } from "./loan-tracker";
import { categorizeWithOverrides } from "./categories";

export interface IngestInput {
  sender?: string;
  text: string;
  receivedAt?: string;
}

export interface IngestResult {
  classification: "verified" | "unverified" | "flagged";
  parsed: boolean;
  reason: string;
  signals: { key: string; label: string; severity: "high" | "medium" | "low" }[];
  transactionId?: string;
  flaggedId?: string;
  loanCreated?: boolean;
  loanId?: string;
  fields?: {
    amount?: number;
    type?: string;
    merchant?: string;
    bank?: string;
    balance?: number;
    accountMasked?: string;
    card?: string;
    date?: string;
    isEmi?: boolean;
    emiAmount?: number;
    lender?: string;
  };
}

export async function ingestSms(input: IngestInput): Promise<IngestResult> {
  const parse = parseSms(input);
  const detection = detectScam({
    sender: input.sender,
    text: input.text,
    parse,
  });

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

  // Always create an SmsMessage record (single source of truth for Inbox/RAG)
  const smsMessage = await db.smsMessage.create({
    data: {
      rawText: input.text,
      sender: input.sender ?? null,
      senderType: parse.senderType,
      receivedAt,
      language: undefined,
      classification: detection.classification,
      linkedRecordType: null,
      linkedRecordId: null,
    },
  });

  // Helper to link the SmsMessage to a created record
  const linkSms = (recordType: string, recordId: string) =>
    db.smsMessage.update({
      where: { id: smsMessage.id },
      data: { linkedRecordType: recordType, linkedRecordId: recordId },
    });

  // If flagged, store in FlaggedMessage and don't create a transaction
  if (detection.classification === "flagged") {
    const flagged = await db.flaggedMessage.create({
      data: {
        sender: input.sender ?? null,
        content: input.text,
        classification: "flagged",
        reason: detection.reason,
        signals: JSON.stringify(detection.signals.map((s) => ({ key: s.key, label: s.label, severity: s.severity }))),
        receivedAt,
      },
    });
    await linkSms("flaggedMessage", flagged.id);
    return {
      classification: "flagged",
      parsed: parse.ok,
      reason: detection.reason,
      signals: detection.signals,
      flaggedId: flagged.id,
    };
  }

  // If unverified (legit sender but not a transaction OR parsed ok but unknown sender)
  if (detection.classification === "unverified" && !parse.ok) {
    const flagged = await db.flaggedMessage.create({
      data: {
        sender: input.sender ?? null,
        content: input.text,
        classification: "unverified",
        reason: detection.reason,
        signals: JSON.stringify(detection.signals.map((s) => ({ key: s.key, label: s.label, severity: s.severity }))),
        receivedAt,
      },
    });
    await linkSms("flaggedMessage", flagged.id);
    return {
      classification: "unverified",
      parsed: false,
      reason: detection.reason,
      signals: detection.signals,
      flaggedId: flagged.id,
    };
  }

  // Verified or unverified-but-parsed: store as transaction
  if (!parse.ok || !parse.fields.amount || !parse.fields.type) {
    // couldn't parse — keep as unverified flagged entry
    const flagged = await db.flaggedMessage.create({
      data: {
        sender: input.sender ?? null,
        content: input.text,
        classification: "unverified",
        reason: detection.reason || "Could not parse transaction fields.",
        signals: JSON.stringify(detection.signals.map((s) => ({ key: s.key, label: s.label, severity: s.severity }))),
        receivedAt,
      },
    });
    await linkSms("flaggedMessage", flagged.id);
    return {
      classification: "unverified",
      parsed: false,
      reason: "Could not parse transaction fields.",
      signals: detection.signals,
      flaggedId: flagged.id,
    };
  }

  // Loan/EMI linking
  let loanId: string | undefined;
  let loanCreated = false;
  let lender: string | undefined;
  if (parse.isEmi) {
    const loan = await matchOrCreateLoan(parse, input.sender);
    if (loan) {
      loanId = loan.loanId;
      loanCreated = loan.created;
      lender = loan.lender;
    }
  }

  const tx = await db.transaction.create({
    data: {
      type: parse.fields.type,
      amount: parse.fields.amount,
      merchant: parse.fields.merchant ?? null,
      accountMasked: parse.fields.accountMasked ?? parse.fields.card ?? null,
      balance: parse.fields.balance ?? null,
      txDate: parse.fields.date ? new Date(parse.fields.date) : receivedAt,
      bank: parse.bankName ?? null,
      sender: input.sender ?? null,
      senderType: parse.senderType,
      category: await categorizeWithOverrides({
        merchant: parse.fields.merchant,
        bank: parse.bankName,
        sender: input.sender,
        type: parse.fields.type,
        isEmi: parse.isEmi,
      }),
      classification: detection.classification,
      rawMessage: input.text,
      loanId: loanId ?? null,
      extra: JSON.stringify({
        card: parse.fields.card,
        emiAmount: parse.fields.emiAmount,
        dueDate: parse.fields.dueDate,
        loanId: parse.fields.loanId,
        lender,
        rawType: parse.fields.rawType,
        ruleIds: parse.matchedRuleIds,
        verifiedSender: detection.verifiedSenderName,
      }),
      receivedAt,
    },
  });
  await linkSms("transaction", tx.id);

  return {
    classification: detection.classification,
    parsed: true,
    reason: detection.reason,
    signals: detection.signals,
    transactionId: tx.id,
    loanCreated,
    loanId,
    fields: {
      amount: parse.fields.amount,
      type: parse.fields.type,
      merchant: parse.fields.merchant,
      bank: parse.bankName,
      balance: parse.fields.balance,
      accountMasked: parse.fields.accountMasked ?? parse.fields.card,
      card: parse.fields.card,
      date: parse.fields.date,
      isEmi: parse.isEmi,
      emiAmount: parse.fields.emiAmount,
      lender,
    },
  };
}

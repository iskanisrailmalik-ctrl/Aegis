/**
 * Crowdsourcing flow for unrecognized SMS formats (Main plan Section 4, Tier 2/3).
 *
 * When the parser encounters an SMS it can't parse (unparsed classification),
 * the user can optionally submit the anonymized format to help improve the
 * Rule Registry. Submissions are stored locally and can be exported.
 *
 * Privacy: only the format pattern (sender ID + field positions) is stored,
 * never the actual transaction amounts or account numbers.
 */

import { db } from "@/lib/db";

export interface FormatSubmission {
  id: string;
  senderId: string;
  // Anonymized pattern: "Rs {amount} debited from A/c XX{last4} to {merchant}"
  patternTemplate: string;
  senderType: string;
  suggestedRule?: string;
  status: "pending" | "submitted" | "rejected";
  createdAt: string;
}

/**
 * Anonymize an SMS message — replace actual amounts, account numbers,
 * and personal data with placeholders, keeping only the structural pattern.
 */
export function anonymizeSms(rawText: string): string {
  let pattern = rawText;

  // Replace amounts (Rs/INR + numbers)
  pattern = pattern.replace(/(?:Rs\.?\s*|INR\s*)([\d,]+\.?\d*)/gi, "Rs {amount}");

  // Replace account numbers (A/c XX1234, XX-1234, etc.)
  pattern = pattern.replace(/A\/c\s*[Xx*]*\s*\d{3,5}/gi, "A/c XX{account}");
  pattern = pattern.replace(/XX\d{3,5}/gi, "XX{account}");

  // Replace card numbers (Card ending 1234, Card no 1234)
  pattern = pattern.replace(/(?:Card\s*(?:ending|no\.?)?\s*)(?:with\s*)?\d{4}/gi, "Card ending {card}");

  // Replace transaction IDs
  pattern = pattern.replace(/(?:Txn\s*ID|Ref|UPI\s*Ref)[:\s]*[A-Z0-9]{6,}/gi, "Txn ID: {txnId}");

  // Replace phone numbers
  pattern = pattern.replace(/\+91\d{10}/g, "{phone}");
  pattern = pattern.replace(/\b[6-9]\d{9}\b/g, "{phone}");

  // Replace dates (keep format but anonymize day)
  pattern = pattern.replace(/\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}/g, "{date}");
  pattern = pattern.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, "{date}");

  // Replace balance amounts
  pattern = pattern.replace(/(?:Avl\s*Bal|Available\s*Balance)\s*(?:Rs\.?\s*|INR\s*)?[\d,]+\.?\d*/gi, "Avl Bal Rs {balance}");

  return pattern;
}

/**
 * Create a format submission from an unparsed SMS message.
 */
export async function createSubmission(
  smsMessageId: string
): Promise<FormatSubmission | null> {
  const msg = await db.smsMessage.findUnique({ where: { id: smsMessageId } });
  if (!msg) return null;

  const pattern = anonymizeSms(msg.rawText);

  // Store as a setting (key/value) since we don't have a dedicated model
  const submissionKey = `submission:${smsMessageId}`;
  const submission: FormatSubmission = {
    id: smsMessageId,
    senderId: msg.sender ?? "Unknown",
    patternTemplate: pattern,
    senderType: msg.senderType,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await db.setting.upsert({
    where: { key: submissionKey },
    update: { value: JSON.stringify(submission) },
    create: { key: submissionKey, value: JSON.stringify(submission) },
  });

  return submission;
}

/**
 * List all pending format submissions.
 */
export async function getPendingSubmissions(): Promise<FormatSubmission[]> {
  const settings = await db.setting.findMany({
    where: { key: { startsWith: "submission:" } },
  });

  const submissions: FormatSubmission[] = [];
  for (const s of settings) {
    try {
      const sub = JSON.parse(s.value) as FormatSubmission;
      if (sub.status === "pending") submissions.push(sub);
    } catch {
      // ignore parse errors
    }
  }

  return submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Update submission status.
 */
export async function updateSubmissionStatus(
  id: string,
  status: "pending" | "submitted" | "rejected"
): Promise<void> {
  const key = `submission:${id}`;
  const existing = await db.setting.findUnique({ where: { key } });
  if (!existing) return;

  const sub = JSON.parse(existing.value) as FormatSubmission;
  sub.status = status;
  await db.setting.update({
    where: { key },
    data: { value: JSON.stringify(sub) },
  });
}

/**
 * Export all submissions as JSON (for sharing with the rule registry maintainer).
 */
export async function exportSubmissions(): Promise<string> {
  const settings = await db.setting.findMany({
    where: { key: { startsWith: "submission:" } },
  });

  const submissions: FormatSubmission[] = [];
  for (const s of settings) {
    try {
      submissions.push(JSON.parse(s.value));
    } catch {
      // ignore
    }
  }

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    count: submissions.length,
    submissions,
  }, null, 2);
}

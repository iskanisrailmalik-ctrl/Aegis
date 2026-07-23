/**
 * Smart Reply Engine — on-device suggestion generator.
 *
 * Generates quick reply chips based on the incoming message content.
 * Uses keyword matching against common Indian SMS patterns:
 * - Transaction confirmations
 * - EMI due reminders
 * - OTP messages
 * - Bill payment confirmations
 * - General acknowledgments
 *
 * No ML model needed — this is a lightweight heuristic engine that
 * produces contextually appropriate short replies.
 */

export interface SmartReply {
  text: string;
  category: "acknowledge" | "confirm" | "question" | "thanks";
}

/**
 * Generate 1-3 smart reply suggestions based on message text.
 */
export function generateSmartReplies(messageText: string): SmartReply[] {
  const text = messageText.toLowerCase();
  const replies: SmartReply[] = [];

  // OTP / verification code
  if (/\b(otp|verification|code|pin)\b/i.test(text)) {
    replies.push({ text: "Got it", category: "acknowledge" });
    return replies.slice(0, 3);
  }

  // EMI due reminder
  if (/\b(emi|installment|due)\b/i.test(text)) {
    replies.push({ text: "Will pay today", category: "confirm" });
    replies.push({ text: "Paid already", category: "confirm" });
    return replies.slice(0, 3);
  }

  // Credit/debit confirmation
  if (/\b(credited|received|deposited)\b/i.test(text)) {
    replies.push({ text: "Thank you", category: "thanks" });
    replies.push({ text: "Got it", category: "acknowledge" });
    return replies.slice(0, 3);
  }

  if (/\b(debited|spent|paid|withdrawn)\b/i.test(text)) {
    replies.push({ text: "Noted", category: "acknowledge" });
    replies.push({ text: "That's correct", category: "confirm" });
    return replies.slice(0, 3);
  }

  // Bill payment
  if (/\b(bill|electricity|water|gas|broadband|recharge)\b/i.test(text)) {
    replies.push({ text: "Payment done", category: "confirm" });
    return replies.slice(0, 3);
  }

  // Low balance warning
  if (/\b(low\s*balance|insufficient|minimum\s*balance)\b/i.test(text)) {
    replies.push({ text: "Will check", category: "acknowledge" });
    return replies.slice(0, 3);
  }

  // Scam/suspicious
  if (/\b(won|lottery|prize|kyc|blocked|urgent)\b/i.test(text)) {
    replies.push({ text: "Reported as spam", category: "acknowledge" });
    return replies.slice(0, 1);
  }

  // Default fallback replies
  replies.push({ text: "Got it", category: "acknowledge" });
  replies.push({ text: "Thank you", category: "thanks" });
  replies.push({ text: "Noted", category: "acknowledge" });

  return replies.slice(0, 3);
}

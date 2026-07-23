/**
 * Scam & Fraud Detection Layer (Section 6 of plan).
 * Runs BEFORE transaction extraction as a gate.
 *
 * 3-way classification:
 *  - verified: matched sender registry + matched parser rule
 *  - unverified: legitimate-looking sender but not a transaction (e.g. bank promo)
 *  - flagged: sender mismatch or scam heuristics triggered
 *
 * All checks run offline.
 */

import { VERIFIED_SENDERS, SenderType } from "./bank-rules";
import { ParseResult } from "./parser";

export type Classification = "verified" | "unverified" | "flagged";

export interface ScamSignal {
  key: string;
  label: string;
  severity: "high" | "medium" | "low";
}

export interface DetectionResult {
  classification: Classification;
  reason: string;
  signals: ScamSignal[];
  senderType: SenderType;
  verifiedSenderName?: string;
}

const PERSONAL_NUMBER_RE = /^\+?91?[6-9]\d{9}$/;

const SUSPICIOUS_URL_RE =
  /(bit\.ly|tinyurl\.com|t\.me|wa\.me|cutt\.ly|tinycc\.com|shorte\.st|bc\.vc|is\.gd|soo\.gd|buff\.ly|rb\.gy)/i;

const URL_RE = /https?:\/\/[^\s]+/i;

const rx = (p: string) => new RegExp(p, "i");

const HEURISTICS: { key: string; label: string; severity: "high" | "medium" | "low"; re: RegExp }[] = [
  {
    key: "urgency_block",
    label: "Urgency / account-block threat language",
    severity: "high",
    re: rx("(account.{0,10}(will be|get|getting)\\s*blocked|block.{0,10}account|will be suspended|suspend.{0,10}account|closed?.{0,10}within|immediate(?:ly)?\\s+(?:action|else|otherwise))"),
  },
  {
    key: "kyc_expire",
    label: "KYC expiry threat",
    severity: "high",
    re: rx("(kyc.{0,15}(expire|pending|update|verify|incomplete|due)|update.{0,10}kyc|kyc.{0,10}(fail|failed))"),
  },
  {
    key: "otp_pin_cvv_request",
    label: "Asks for OTP / PIN / CVV / password",
    severity: "high",
    re: rx("(share.{0,20}(otp|pin|cvv|password|mpin|upi pin)|enter.{0,20}(otp|pin|cvv|password|mpin)|provide.{0,20}(otp|pin|cvv|password|mpin))"),
  },
  {
    key: "prize_lottery",
    label: "Prize / lottery / cashback offer",
    severity: "high",
    re: rx("(you(?:'ve| have)?\\s*(?:won|been selected|been chosen|been awarded)|congratulations.{0,20}(win|won|prize|selected|cashback|reward)|claim.{0,15}(prize|reward|cashback|gift|amount)|lottery|lucky draw|you are.{0,10}winner)"),
  },
  {
    key: "click_link",
    label: "Asks to click a link",
    severity: "medium",
    re: rx("(click\\s+(here|the\\s+link|below)|visit\\s+(?:the\\s+)?link|tap\\s+(here|below)|open\\s+(?:this\\s+)?link)"),
  },
  {
    key: "call_number",
    label: "Asks to call a number",
    severity: "medium",
    re: rx("(call\\s+(?:us|now|immediately|on|at)\\s*\\+?\\d{10,13}|contact\\s+\\+?\\d{10,13}|helpline\\s+\\+?\\d{10,13})"),
  },
  {
    key: "suspicious_url",
    label: "Contains a shortened / suspicious URL",
    severity: "medium",
    re: SUSPICIOUS_URL_RE,
  },
  {
    key: "any_url",
    label: "Contains a URL",
    severity: "low",
    re: URL_RE,
  },
  {
    key: "sender_id_spoof",
    label: "Claims to be from a bank but sent from a personal number",
    severity: "high",
    re: rx("\\b(SBI|HDFC|ICICI|Axis|Kotak|PNB|Baroda|Canara|Yes\\s*Bank|IDFC|IndusInd|Federal|Airtel|Paytm|PhonePe|Google\\s*Pay|Bajaj|HDB|Home\\s*Credit|Tata\\s*Capital)\\b"),
  },
];

function isPersonalNumber(sender?: string): boolean {
  if (!sender) return false;
  const digits = sender.replace(/\D/g, "");
  const core = digits.length > 10 ? digits.slice(-10) : digits;
  return PERSONAL_NUMBER_RE.test(digits) || /^[6-9]\d{9}$/.test(core);
}

function findVerifiedSender(sender?: string): { name: string; type: SenderType } | undefined {
  if (!sender) return undefined;
  const up = sender.toUpperCase();
  for (const v of VERIFIED_SENDERS) {
    if (up.includes(v.pattern.toUpperCase())) return { name: v.name, type: v.type };
  }
  return undefined;
}

export interface DetectInput {
  sender?: string;
  text: string;
  parse: ParseResult;
}

export function detectScam(input: DetectInput): DetectionResult {
  const { sender, text, parse } = input;
  const signals: ScamSignal[] = [];

  const verified = findVerifiedSender(sender);
  const personal = isPersonalNumber(sender);

  if (personal) {
    const claimsBank = HEURISTICS.find((h) => h.key === "sender_id_spoof")!.re.test(text);
    if (claimsBank) {
      signals.push({
        key: "personal_number_bank_claim",
        label: "Claims to be from a bank but sent from a personal 10-digit mobile number",
        severity: "high",
      });
    } else {
      signals.push({
        key: "personal_number_sender",
        label: "Sent from a personal mobile number, not a registered sender ID",
        severity: "medium",
      });
    }
  } else if (!verified && sender) {
    signals.push({
      key: "unknown_sender",
      label: "Sender ID not in the verified bank/lender registry",
      severity: "low",
    });
  }

  for (const h of HEURISTICS) {
    if (h.key === "sender_id_spoof") continue;
    if (h.re.test(text)) {
      signals.push({ key: h.key, label: h.label, severity: h.severity });
    }
  }

  const hasHighSignal = signals.some((s) => s.severity === "high");
  const hasMediumSignal = signals.some((s) => s.severity === "medium");

  let classification: Classification;
  let reason: string;

  if (signals.length === 0 && parse.ok && verified) {
    classification = "verified";
    reason = "Matched a verified sender and a parser rule.";
  } else if (hasHighSignal || (personal && !verified)) {
    classification = "flagged";
    const main = signals.find((s) => s.severity === "high") ?? signals[0];
    reason = main ? main.label : "Suspicious sender or content detected.";
  } else if (!parse.ok && (hasMediumSignal || signals.length > 0)) {
    classification = "flagged";
    reason = "Does not match any known transaction template and triggered suspicion heuristics.";
  } else if (parse.ok && verified) {
    classification = "verified";
    reason = "Matched a verified sender and a parser rule.";
  } else if (verified && !parse.ok) {
    classification = "unverified";
    reason = "From a verified sender but does not look like a transaction alert.";
  } else if (parse.ok && !verified) {
    classification = "unverified";
    reason = "Looks like a transaction but sender is not in the verified registry.";
  } else {
    classification = "flagged";
    reason = "Could not classify as a legitimate transaction.";
  }

  return {
    classification,
    reason,
    signals,
    senderType: verified?.type ?? parse.senderType,
    verifiedSenderName: verified?.name,
  };
}

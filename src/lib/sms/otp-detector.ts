/**
 * OTP Detection Utility.
 *
 * Detects One-Time Passwords (OTP), PINs, and verification codes in SMS text.
 * Used to:
 * - Blur OTP messages in the inbox list (privacy)
 * - Gate OTP reveal behind biometric/PIN authentication
 * - Prevent OTP from being spoken aloud
 * - Flag OTP messages as sensitive
 *
 * Works with Indian bank/UPI OTP formats:
 * - "OTP is 123456"
 * - "Your OTP: 1234"
 * - "123456 is your verification code"
 * - "Use 1234 as your PIN"
 * - "DONT SHARE: 654321"
 */

export interface OtpDetectionResult {
  isOtp: boolean;
  code?: string;
  purpose?: string;
  startIndex?: number;
  endIndex?: number;
}

// Patterns for detecting OTPs — ordered by specificity (most specific first)
const OTP_PATTERNS: Array<{ regex: RegExp; purpose: string }> = [
  // Explicit OTP/verification code patterns
  { regex: /\b(?:your\s+)?(?:otp|one[\s-]?time[\s-]?(?:password|code)|verification\s+code|security\s+code|access\s+code|auth(?:entication)?\s+code)\s*(?:is|:|for|to)\s*(?:is\s*)?(\d{4,8})\b/i, purpose: "OTP" },
  { regex: /\b(\d{4,8})\s+is\s+(?:your|the)\s+(?:otp|one[\s-]?time[\s-]?(?:password|code)|verification\s+code|security\s+code|access\s+code)\b/i, purpose: "OTP" },

  // "Use XXXX as your OTP/PIN/code"
  { regex: /\buse\s+(\d{4,8})\s+as\s+(?:your\s+)?(?:otp|pin|password|code|verification\s+code|mpin|upi\s+pin)\b/i, purpose: "OTP" },

  // "OTP/PIN: XXXX"
  { regex: /\b(?:otp|pin|mpin|upi\s+pin|cvv|password)\s*[:\-]\s*(\d{4,8})\b/i, purpose: "OTP" },

  // "DONT SHARE XXXX" / "DO NOT SHARE: XXXX"
  { regex: /\b(?:don'?t\s+share|do\s+not\s+share|never\s+share)\D{0,20}(\d{4,8})\b/i, purpose: "OTP" },

  // "XXXX is your OTP/PIN"
  { regex: /\b(\d{4,8})\s+is\s+your\s+(?:otp|pin|mpin|password|code|verification\s+code)\b/i, purpose: "OTP" },

  // "XXXX OTP for <purpose>"
  { regex: /\b(\d{4,8})\s+(?:otp|verification\s+code)\s+for\b/i, purpose: "OTP" },

  // Generic: standalone 4-8 digit number near OTP keywords
  { regex: /\b(?:otp|verification|secure|authenticate)\D{0,30}(\d{4,8})\b/i, purpose: "OTP" },

  // UPI PIN patterns
  { regex: /\b(?:upi\s+pin|mpin)\s*(?:is|:|for)\s*(\d{4,6})\b/i, purpose: "UPI PIN" },

  // CVV/Card verification
  { regex: /\bcvv\s*(?:is|:|for)\s*(\d{3,4})\b/i, purpose: "CVV" },
];

/**
 * Detect if an SMS message contains an OTP/code.
 * Returns the code, purpose, and position if found.
 */
export function detectOtp(text: string): OtpDetectionResult {
  if (!text || text.trim().length === 0) {
    return { isOtp: false };
  }

  for (const { regex, purpose } of OTP_PATTERNS) {
    const match = text.match(regex);
    if (match && match[1]) {
      const code = match[1];
      const fullMatch = match[0];
      const startIndex = text.indexOf(fullMatch);
      return {
        isOtp: true,
        code,
        purpose,
        startIndex: startIndex >= 0 ? startIndex : 0,
        endIndex: startIndex >= 0 ? startIndex + fullMatch.length : text.length,
      };
    }
  }

  return { isOtp: false };
}

/**
 * Blur the OTP code in a message — replaces digits with ●●●●.
 * Used for display in inbox lists and notifications.
 */
export function blurOtp(text: string): string {
  const detection = detectOtp(text);
  if (!detection.isOtp || !detection.code) {
    return text;
  }

  // Replace the OTP code with blurred dots
  const blurredCode = "●".repeat(detection.code.length);
  return text.replace(detection.code, blurredCode);
}

/**
 * Check if a message should be treated as OTP-only (no transaction parsing).
 * OTP messages typically don't contain transaction information.
 */
export function isOtpOnlyMessage(text: string): boolean {
  const detection = detectOtp(text);
  if (!detection.isOtp) return false;

  // If the message is short (< 200 chars) and contains OTP, treat as OTP-only
  // Longer messages might contain both OTP and transaction info
  return text.length < 200;
}

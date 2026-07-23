/**
 * Bank Rule Registry — versioned, patchable config bundle.
 * Tier 1: ~25 major banks, payments banks, NBFCs, wallets, credit cards.
 *
 * Each rule:
 *  - senderIdPatterns: short-code / header prefixes (DLT format e.g. "SBIINB" or sender labels)
 *  - senderType: bank | paymentsBank | nbfc | wallet | creditCard
 *  - bankName: human readable
 *  - patterns: regex rules with field capture groups
 *    groups named via capture indices documented in fieldMap
 *
 * Field map keys: amount, type, merchant, account, balance, date, dueDate, emiAmount, loanId, card
 */

export type SenderType =
  | "bank"
  | "paymentsBank"
  | "nbfc"
  | "wallet"
  | "creditCard"
  | "unknown";

export type TxType = "credit" | "debit";

export interface ParsedFields {
  amount?: number;
  type?: TxType;
  merchant?: string;
  accountMasked?: string;
  balance?: number;
  date?: string; // ISO
  dueDate?: string; // ISO
  emiAmount?: number;
  loanId?: string;
  card?: string;
  rawType?: string;
}

export interface BankRulePattern {
  regex: string;
  fieldMap: Record<string, keyof ParsedFields>;
  typeOverride?: TxType;
  isEmi?: boolean;
}

export interface BankRule {
  id: string;
  senderIdPatterns: string[];
  senderType: SenderType;
  bankName: string;
  language?: string;
  patterns: BankRulePattern[];
}

export const BANK_RULES: BankRule[] = [
  // ---------------- SBI ----------------
  {
    id: "sbi",
    senderIdPatterns: ["SBI", "SBIBNK", "SBIINB", "SBISMS"],
    senderType: "bank",
    bankName: "State Bank of India",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?:debited|withdrawn|spent|paid).*?(?:from|to|at|on)\\s*(?<merchant>[^.\\n]+?)(?:\\s+on|\\s+via|\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant" },
        typeOverride: "debit",
      },
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?:credited|received|deposited).*?(?:from|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+on|\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant" },
        typeOverride: "credit",
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
      {
        regex: "A/c\\s*[Xx*]*\\s*(?<account>\\d{3,5})",
        fieldMap: { account: "accountMasked" },
      },
      {
        regex: "EMI\\s*(?:of|for)?\\s*(?:Rs\\.?|INR)?\\s*(?<emiAmount>[\\d,]+\\.?\\d*)\\s*(?:due|debited|paid).*?(?:on|by)\\s*(?<dueDate>\\d{1,2}[\\/-][A-Za-z0-9]+[\\/-]\\d{2,4})?",
        fieldMap: { emiAmount: "emiAmount", dueDate: "dueDate" },
        typeOverride: "debit",
        isEmi: true,
      },
    ],
  },
  // ---------------- HDFC ----------------
  {
    id: "hdfc",
    senderIdPatterns: ["HDFC", "HDFCBK", "VM-HDFCBK"],
    senderType: "bank",
    bankName: "HDFC Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|spent|received).*?(?:from|to|at|by|info:)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\s+on\\s|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
      {
        regex: "(?:A/c|Acct|Ac)\\s*[Xx*]*\\s*(?<account>\\d{3,5})",
        fieldMap: { account: "accountMasked" },
      },
    ],
  },
  // ---------------- ICICI ----------------
  {
    id: "icici",
    senderIdPatterns: ["ICICI", "ICICIB", "VM-ICICIB"],
    senderType: "bank",
    bankName: "ICICI Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|spent|received).*?(?:from|to|at|by|Info:|VPA)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
      {
        regex: "(?:A/c|Acct)\\s*[Xx*]*\\s*(?<account>\\d{3,5})",
        fieldMap: { account: "accountMasked" },
      },
    ],
  },
  // ---------------- Axis ----------------
  {
    id: "axis",
    senderIdPatterns: ["AXIS", "AXISBK", "VM-AXISB"],
    senderType: "bank",
    bankName: "Axis Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|spent|received).*?(?:from|to|at|by|Info:)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
    ],
  },
  // ---------------- Kotak ----------------
  {
    id: "kotak",
    senderIdPatterns: ["KOTAK", "KOTAKB", "VM-KOTAKB"],
    senderType: "bank",
    bankName: "Kotak Mahindra Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|spent|received).*?(?:from|to|at|by|Info:)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
    ],
  },
  // ---------------- PNB ----------------
  {
    id: "pnb",
    senderIdPatterns: ["PNB", "PNBBNK"],
    senderType: "bank",
    bankName: "Punjab National Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
    ],
  },
  // ---------------- BoB ----------------
  {
    id: "bob",
    senderIdPatterns: ["BARODA", "BOB", "BOBBNK"],
    senderType: "bank",
    bankName: "Bank of Baroda",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
    ],
  },
  // ---------------- Canara ----------------
  {
    id: "canara",
    senderIdPatterns: ["CANARA", "CANBNK"],
    senderType: "bank",
    bankName: "Canara Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Yes Bank ----------------
  {
    id: "yes",
    senderIdPatterns: ["YESBNK", "YES"],
    senderType: "bank",
    bankName: "Yes Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- IDFC First ----------------
  {
    id: "idfc",
    senderIdPatterns: ["IDFC", "IDFCFB"],
    senderType: "bank",
    bankName: "IDFC FIRST Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by|Info)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- IndusInd ----------------
  {
    id: "indusind",
    senderIdPatterns: ["INDUS", "INDUSIND"],
    senderType: "bank",
    bankName: "IndusInd Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Federal Bank ----------------
  {
    id: "federal",
    senderIdPatterns: ["FEDERAL", "FEDBNK"],
    senderType: "bank",
    bankName: "Federal Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Airtel Payments Bank ----------------
  {
    id: "airtel-pb",
    senderIdPatterns: ["AIRTEL", "AIRTBK", "AD-AIRTELBANK"],
    senderType: "paymentsBank",
    bankName: "Airtel Payments Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|added|spent).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Avl Bal\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)",
        fieldMap: { balance: "balance" },
      },
    ],
  },
  // ---------------- India Post Payments Bank ----------------
  {
    id: "ippb",
    senderIdPatterns: ["IPPB", "POST", "INDPOST"],
    senderType: "paymentsBank",
    bankName: "India Post Payments Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Fino Payments Bank ----------------
  {
    id: "fino",
    senderIdPatterns: ["FINO", "FINOPB"],
    senderType: "paymentsBank",
    bankName: "Fino Payments Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Jio Payments Bank ----------------
  {
    id: "jio-pb",
    senderIdPatterns: ["JIOPB", "JIO", "JIOMNY"],
    senderType: "paymentsBank",
    bankName: "Jio Payments Bank",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|spent|added).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl Bal|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Paytm ----------------
  {
    id: "paytm",
    senderIdPatterns: ["PAYTMB", "PAYTM", "VM-PAYTMB"],
    senderType: "wallet",
    bankName: "Paytm",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>paid|received|debited|credited|sent).*?(?:to|from|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+on|\\s+Txn|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "(?<type>paid|received)\\s+(?:Rs\\.?|INR)?\\s*(?<amount>[\\d,]+\\.?\\d*)",
        fieldMap: { amount: "amount", type: "type" },
      },
    ],
  },
  // ---------------- PhonePe ----------------
  {
    id: "phonepe",
    senderIdPatterns: ["PHONPE", "PHONEPE", "PPBL"],
    senderType: "wallet",
    bankName: "PhonePe",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>paid|received|debited|credited|sent).*?(?:to|from|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+on|\\s+Txn|\\s+Ref|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Google Pay ----------------
  {
    id: "gpay",
    senderIdPatterns: ["GPAY", "GOOGLEPAY", "GOOGL"],
    senderType: "wallet",
    bankName: "Google Pay",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>paid|received|sent).*?(?:to|from|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+on|\\s+UPI|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Amazon Pay ----------------
  {
    id: "amazonpay",
    senderIdPatterns: ["AMAZON", "AMAZNPAY"],
    senderType: "wallet",
    bankName: "Amazon Pay",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>paid|received|debited|credited).*?(?:to|from|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\s+on|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- Bajaj Finserv (NBFC) ----------------
  {
    id: "bajaj",
    senderIdPatterns: ["BAJAJ", "BAJAJFINSERV", "BFSL"],
    senderType: "nbfc",
    bankName: "Bajaj Finserv",
    patterns: [
      {
        regex: "EMI\\s*(?:of|for|amount)?\\s*(?:Rs\\.?|INR)?\\s*(?<emiAmount>[\\d,]+\\.?\\d*)\\s*(?:due|debited|paid|collected).*?(?:on|by)\\s*(?<dueDate>\\d{1,2}[\\/-][A-Za-z0-9]+[\\/-]\\d{2,4})?",
        fieldMap: { emiAmount: "emiAmount", dueDate: "dueDate" },
        typeOverride: "debit",
        isEmi: true,
      },
      {
        regex: "Loan\\s*(?:A/c|Account|No\\.?)?\\s*(?<loanId>[A-Z0-9]{4,})",
        fieldMap: { loanId: "loanId" },
      },
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|disbursed|paid).*?(?:from|to|at|by)\\s*(?<merchant>[^.\\n]+?)(?:\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
  // ---------------- HDB Financial (NBFC) ----------------
  {
    id: "hdb",
    senderIdPatterns: ["HDB", "HDBFS"],
    senderType: "nbfc",
    bankName: "HDB Financial Services",
    patterns: [
      {
        regex: "EMI\\s*(?:of|for)?\\s*(?:Rs\\.?|INR)?\\s*(?<emiAmount>[\\d,]+\\.?\\d*)\\s*(?:due|debited|paid).*?(?:on|by)\\s*(?<dueDate>\\d{1,2}[\\/-][A-Za-z0-9]+[\\/-]\\d{2,4})?",
        fieldMap: { emiAmount: "emiAmount", dueDate: "dueDate" },
        typeOverride: "debit",
        isEmi: true,
      },
      {
        regex: "Loan\\s*(?:A/c|No\\.?)?\\s*(?<loanId>[A-Z0-9]{4,})",
        fieldMap: { loanId: "loanId" },
      },
    ],
  },
  // ---------------- Home Credit (NBFC) ----------------
  {
    id: "homecredit",
    senderIdPatterns: ["HCIN", "HOMECREDIT", "HCRD"],
    senderType: "nbfc",
    bankName: "Home Credit India",
    patterns: [
      {
        regex: "EMI\\s*(?:of|for)?\\s*(?:Rs\\.?|INR)?\\s*(?<emiAmount>[\\d,]+\\.?\\d*)\\s*(?:due|debited|paid).*?(?:on|by)\\s*(?<dueDate>\\d{1,2}[\\/-][A-Za-z0-9]+[\\/-]\\d{2,4})?",
        fieldMap: { emiAmount: "emiAmount", dueDate: "dueDate" },
        typeOverride: "debit",
        isEmi: true,
      },
    ],
  },
  // ---------------- Tata Capital (NBFC) ----------------
  {
    id: "tatacap",
    senderIdPatterns: ["TATA", "TATACAP", "TCL"],
    senderType: "nbfc",
    bankName: "Tata Capital",
    patterns: [
      {
        regex: "EMI\\s*(?:of|for)?\\s*(?:Rs\\.?|INR)?\\s*(?<emiAmount>[\\d,]+\\.?\\d*)\\s*(?:due|debited|paid).*?(?:on|by)\\s*(?<dueDate>\\d{1,2}[\\/-][A-Za-z0-9]+[\\/-]\\d{2,4})?",
        fieldMap: { emiAmount: "emiAmount", dueDate: "dueDate" },
        typeOverride: "debit",
        isEmi: true,
      },
    ],
  },
  // ---------------- HDFC Credit Card ----------------
  {
    id: "hdfc-card",
    senderIdPatterns: ["HDFCCRD", "HDFCBK"],
    senderType: "creditCard",
    bankName: "HDFC Credit Card",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>spent|debited|credited|used).*?(?:at|on|in)\\s*(?<merchant>[^.\\n]+?)(?:\\s+Avl|\\s+on\\s|\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
      {
        regex: "Card\\s*(?:ending|no\\.?)?\\s*(?:with)?\\s*(?<card>\\d{4})",
        fieldMap: { card: "card" },
      },
      {
        regex: "EMI\\s*(?:of|for)?\\s*(?:Rs\\.?|INR)?\\s*(?<emiAmount>[\\d,]+\\.?\\d*).*?(?:on|due)?\\s*(?<dueDate>\\d{1,2}[\\/-][A-Za-z0-9]+[\\/-]\\d{2,4})?",
        fieldMap: { emiAmount: "emiAmount", dueDate: "dueDate" },
        typeOverride: "debit",
        isEmi: true,
      },
    ],
  },
  // ---------------- CRED ----------------
  {
    id: "cred",
    senderIdPatterns: ["CRED", "CRDAPP"],
    senderType: "wallet",
    bankName: "CRED",
    patterns: [
      {
        regex: "(?:Rs\\.?|INR)\\s*(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>paid|received).*?(?:to|from|for)\\s*(?<merchant>[^.\\n]+?)(?:\\.|$)",
        fieldMap: { amount: "amount", merchant: "merchant", type: "type" },
      },
    ],
  },
];

export interface VerifiedSender {
  pattern: string;
  name: string;
  type: SenderType;
}

export const VERIFIED_SENDERS: VerifiedSender[] = [
  { pattern: "SBI", name: "State Bank of India", type: "bank" },
  { pattern: "HDFC", name: "HDFC Bank", type: "bank" },
  { pattern: "ICICI", name: "ICICI Bank", type: "bank" },
  { pattern: "AXIS", name: "Axis Bank", type: "bank" },
  { pattern: "KOTAK", name: "Kotak Mahindra Bank", type: "bank" },
  { pattern: "PNB", name: "Punjab National Bank", type: "bank" },
  { pattern: "BARODA", name: "Bank of Baroda", type: "bank" },
  { pattern: "CANARA", name: "Canara Bank", type: "bank" },
  { pattern: "YESBNK", name: "Yes Bank", type: "bank" },
  { pattern: "IDFC", name: "IDFC FIRST Bank", type: "bank" },
  { pattern: "INDUS", name: "IndusInd Bank", type: "bank" },
  { pattern: "FEDERAL", name: "Federal Bank", type: "bank" },
  { pattern: "AIRTEL", name: "Airtel Payments Bank", type: "paymentsBank" },
  { pattern: "IPPB", name: "India Post Payments Bank", type: "paymentsBank" },
  { pattern: "FINO", name: "Fino Payments Bank", type: "paymentsBank" },
  { pattern: "JIOPB", name: "Jio Payments Bank", type: "paymentsBank" },
  { pattern: "PAYTM", name: "Paytm", type: "wallet" },
  { pattern: "PHONPE", name: "PhonePe", type: "wallet" },
  { pattern: "GPAY", name: "Google Pay", type: "wallet" },
  { pattern: "AMAZON", name: "Amazon Pay", type: "wallet" },
  { pattern: "BAJAJ", name: "Bajaj Finserv", type: "nbfc" },
  { pattern: "HDB", name: "HDB Financial", type: "nbfc" },
  { pattern: "HCIN", name: "Home Credit", type: "nbfc" },
  { pattern: "TATA", name: "Tata Capital", type: "nbfc" },
];

export const REGISTRY_VERSION = "1.0.0";

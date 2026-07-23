/**
 * Document extraction & reconciliation (Section 8 of the spec).
 *
 * Supports:
 * - Loan agreements / EMI schedules: extract lender, principal, EMI amount, tenure, due day
 * - Bank statements (CSV): extract transactions and reconcile against SMS-derived records
 *
 * Extraction is pattern-based (Tier 3 generic fallback from the spec) with
 * reason-code/confidence treatment. No model training.
 */

/**
 * Intelligently detect document type from content (requirement 8).
 * Analyzes content patterns to determine if it's a loan agreement, EMI schedule,
 * or bank statement — without requiring the user to manually select.
 */
export function detectDocumentType(content: string): {
  type: "loanAgreement" | "emiSchedule" | "bankStatement";
  confidence: "high" | "medium" | "low";
  reasons: string[];
} {
  const lower = content.toLowerCase();
  const reasons: string[] = [];

  // CSV or JSON detection
  const lines = content.trim().split("\n");
  const hasCsvHeader = lines.length > 1 && lines[0].includes(",") &&
    /date|amount|description|balance|type|debit|credit|particulars|narration/i.test(lines[0]);
  const hasCsvRows = lines.slice(1).filter((l) => l.includes(",") && /\d/.test(l)).length >= 2;

  if (hasCsvHeader && hasCsvRows) {
    reasons.push("CSV tabular format detected with transaction headers");
    return { type: "bankStatement", confidence: "high", reasons };
  }

  // JSON structured format check
  if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.transactions || Array.isArray(parsed)) {
        reasons.push("JSON structured financial data format detected");
        return { type: "bankStatement", confidence: "high", reasons };
      }
    } catch {
      // Not valid JSON, continue to pattern checks
    }
  }

  // Loan agreement & Sanction Letter keywords
  const loanKeywords = [
    "loan agreement", "lender", "borrower", "principal", "sanctioned", "disbursement",
    "interest rate", "tenure", "emi", "installment", "equated monthly", "sanction letter",
    "facility amount", "foreclosure", "prepayment", "processing fee", "repayment schedule"
  ];
  const loanMatches = loanKeywords.filter((kw) => lower.includes(kw));

  // EMI schedule keywords
  const emiKeywords = [
    "emi schedule", "repayment schedule", "installment no", "due date", "amortization",
    "monthly installment", "emi amount", "emi no", "due day", "installment date"
  ];
  const emiMatches = emiKeywords.filter((kw) => lower.includes(kw));

  // Bank statement keywords (non-CSV, PDF text, plain text)
  const stmtKeywords = [
    "account statement", "transaction history", "opening balance", "closing balance",
    "statement period", "account number", "passbook", "credit", "debit", "withdrawal", "deposit"
  ];
  const stmtMatches = stmtKeywords.filter((kw) => lower.includes(kw));

  if (emiMatches.length >= 2) {
    reasons.push(`EMI schedule patterns found: ${emiMatches.join(", ")}`);
    return { type: "emiSchedule", confidence: emiMatches.length >= 4 ? "high" : "medium", reasons };
  }

  if (loanMatches.length >= 2) {
    reasons.push(`Loan agreement / sanction patterns found: ${loanMatches.join(", ")}`);
    return { type: "loanAgreement", confidence: loanMatches.length >= 4 ? "high" : "medium", reasons };
  }

  if (stmtMatches.length >= 2) {
    reasons.push(`Bank statement patterns found: ${stmtMatches.join(", ")}`);
    return { type: "bankStatement", confidence: stmtMatches.length >= 4 ? "high" : "medium", reasons };
  }

  // Fallback heuristics
  if (hasCsvRows || /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(content)) {
    reasons.push("Tabular transaction or date patterns detected");
    return { type: "bankStatement", confidence: "medium", reasons };
  }

  reasons.push("General financial text content parsed");
  return { type: "loanAgreement", confidence: "medium", reasons };
}

import { db } from "@/lib/db";

export interface ExtractedLoanFields {
  lender?: string;
  principal?: number;
  emiAmount?: number;
  tenure?: number;
  dueDay?: number;
  interestRate?: number;
  loanRef?: string;
  startDate?: string;
}

export interface ExtractedStatementRow {
  date?: string;
  description?: string;
  amount?: number;
  type?: "credit" | "debit";
  balance?: number;
  refNo?: string;
  senderOrReceiver?: string;
}

export interface ReconciliationResult {
  total: number;
  matched: number;
  missed: number; // in statement but no matching SMS
  extra: number; // SMS-derived but no statement match
  matchRate: number;
  details: Array<{
    statementRow: ExtractedStatementRow;
    matchedTransactionId?: string;
    status: "matched" | "missed" | "extra";
  }>;
}

/** Parse a number from a string, handling Indian comma format (1,23,456.78). */
function parseAmount(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/[₹,\s]/g, "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

/**
 * Extract loan/EMI fields from text (from loan agreement, sanction letter, or EMI schedule).
 * Uses robust Indian Bank / NBFC multi-pattern matchers.
 */
export function extractLoanFields(text: string): ExtractedLoanFields {
  const fields: ExtractedLoanFields = {};

  // Lender — look for common Indian banks, NBFCs, and fintech lenders
  const lenderPatterns = [
    /(?:lender|bank|nbfc|institution|financier|company)[:\s]+([A-Za-z][A-Za-z\s&.]{2,40}?)(?:\n|$|,|\.)/i,
    /\b(SBI|HDFC(?:\s*Bank)?|ICICI(?:\s*Bank)?|Axis(?:\s*Bank)?|Kotak(?:\s*Mahindra)?|Bajaj\s*Finserv|HDB\s*Financial|Home\s*Credit|Tata\s*Capital|MoneyView|TVS\s*Credit|Muthoot(?:\s*Finance)?|L&T\s*Finance|ZestMoney|Navi|KreditBee|Cholamandalam|IndusInd\s*Bank|IDFC\s*FIRST\s*Bank|Federal\s*Bank|Standard\s*Chartered|Yes\s*Bank|Canara\s*Bank|PNB|Punjab\s*National\s*Bank)\b/i,
  ];
  for (const p of lenderPatterns) {
    const m = text.match(p);
    if (m?.[1]) {
      fields.lender = m[1].trim();
      break;
    } else if (m?.[0]) {
      fields.lender = m[0].trim();
      break;
    }
  }

  // Principal / loan amount / sanctioned amount
  const principalMatch = text.match(/(?:principal|loan\s+amount|sanctioned\s+amount|facility\s+amount|disbursement\s+amount|borrowed\s+amount)[:\s]*(?:rs\.?\s*|inr\s*|₹\s*)?([\d,]+\.?\d*)/i);
  if (principalMatch) fields.principal = parseAmount(principalMatch[1]);

  // EMI amount / monthly installment
  const emiMatch = text.match(/(?:emi|installment|monthly\s+payment|repayment\s+installment|monthly\s+emi|equated\s+monthly)[:\s]*(?:amount[:\s]*)?(?:rs\.?\s*|inr\s*|₹\s*)?([\d,]+\.?\d*)/i);
  if (emiMatch) fields.emiAmount = parseAmount(emiMatch[1]);

  // Tenure (months)
  const tenureMatch = text.match(/(?:tenure|term|duration|number\s+of\s+emis|no\.\s+of\s+installments)[:\s]*(\d+)\s*(?:months|mos|emis|installments)?/i);
  if (tenureMatch) fields.tenure = parseInt(tenureMatch[1], 10);

  // Due day / due date
  const dueDayMatch = text.match(/(?:due\s+(?:date|day)|payment\s+date|emi\s+date|repayment\s+day)[:\s]*(?:every\s+)?(\d{1,2})(?:st|nd|rd|th)?/i);
  if (dueDayMatch) {
    const day = parseInt(dueDayMatch[1], 10);
    if (day >= 1 && day <= 31) fields.dueDay = day;
  }

  // Interest rate (% p.a.)
  const rateMatch = text.match(/(?:interest\s+rate|rate\s+of\s+interest|roi|annual\s+percentage\s+rate)[:\s]*(\d+\.?\d*)\s*%/i);
  if (rateMatch) fields.interestRate = parseFloat(rateMatch[1]);

  // Loan reference / account number
  const refMatch = text.match(/(?:loan\s+(?:id|no|number|a\/c|ref)|account\s+no|agreement\s+no|reference\s+no)[:\s]*([A-Za-z0-9\-\/]{4,})/i);
  if (refMatch) fields.loanRef = refMatch[1];

  // Start date
  const dateMatch = text.match(/(?:start\s+date|disbursement\s+date|date\s+of\s+sanction|agreement\s+date)[:\s]*(\d{1,2}[\/\-][A-Za-z0-9]+[\/\-]\d{2,4})/i);
  if (dateMatch) fields.startDate = dateMatch[1];

  return fields;
}

/**
 * Bank-agnostic structural header, footer, and metadata line detector.
 * Detects structural key-value lines, customer address blocks, multi-page repeated table headers,
 * and statement summary section boundaries across any bank statement format.
 */
export function isStructuralHeaderOrMetadata(line: string): { isMetadata: boolean; isSummaryBoundary: boolean } {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "." || /^[\-\*_=]{3,}$/.test(trimmed)) {
    return { isMetadata: true, isSummaryBoundary: false };
  }

  // 1. Summary section boundary detection (end of transaction ledger)
  if (/^(?:STATEMENT\s+SUMMARY|SUMMARY\s+OF\s+ACCOUNT|ACCOUNT\s+SUMMARY|OPENING\s+BALANCE|CLOSING\s+BALANCE|TOTAL\s+(?:DEBITS|CREDITS)|Dr\s+Count|Cr\s+Count)/i.test(trimmed)) {
    return { isMetadata: true, isSummaryBoundary: true };
  }

  // 2. Structural Key-Value metadata lines (e.g. "City : LUCKNOW", "Account No : 502000...", "State : UP", "IFSC : HDFC...")
  if (/^[A-Za-z0-9\s/&.\-\(\)]+[:\=]\s*.+/i.test(trimmed)) {
    return { isMetadata: true, isSummaryBoundary: false };
  }

  // 3. Customer name & address block lines (e.g. "MR FAIZAN ALI", "JOINT HOLDERS", "Address Line 1")
  if (/^(?:MR|MS|MRS|DR|M\/S)\s+[A-Z\s.]+$|^JOINT\s+HOLDERS|^NOMINATION\s+REGISTERED/i.test(trimmed)) {
    return { isMetadata: true, isSummaryBoundary: false };
  }

  // 4. Repeated Table Header rows (lines containing 3+ transaction column keywords)
  const headerKeywords = ["date", "narration", "particulars", "description", "chq", "ref", "value dt", "withdrawal", "deposit", "credit", "debit", "balance"];
  const lower = trimmed.toLowerCase();
  const matchCount = headerKeywords.filter((kw) => lower.includes(kw)).length;
  if (matchCount >= 3) {
    return { isMetadata: true, isSummaryBoundary: false };
  }

  // 5. Common page footer markers
  if (/^Page\s+No\s*\.\:\s*\d+/i.test(trimmed) || /^\*This is a computer generated/i.test(trimmed)) {
    return { isMetadata: true, isSummaryBoundary: false };
  }

  return { isMetadata: false, isSummaryBoundary: false };
}

/**
 * Parse CSV, TSV, space-separated, PDF text streams, or OCR output into structured transactions.
 * Extracts Date, Narration/Description, Ref/UTR Number, Credit/Debit Amount, Sender/Receiver, and Balance.
 */
export function parseStatementCSV(text: string): ExtractedStatementRow[] {
  if (!text || !text.trim()) return [];

  // 1. First attempt comma-separated CSV parsing
  const lines = text.trim().split("\n");
  if (lines.length >= 2 && lines[0].includes(",")) {
    const header = lines[0].toLowerCase();
    const cols = header.split(",").map((c) => c.trim().toLowerCase());

    const dateIdx = cols.findIndex((c) => c.includes("date") || c.includes("txn"));
    const descIdx = cols.findIndex((c) => c.includes("desc") || c.includes("narration") || c.includes("details") || c.includes("particular"));
    const amountIdx = cols.findIndex((c) => c.includes("amount") || c.includes("amt") || c.includes("value"));
    const typeIdx = cols.findIndex((c) => c.includes("type") || c.includes("dr/cr") || c.includes("credit/debit"));
    const balIdx = cols.findIndex((c) => c.includes("bal"));
    const creditIdx = cols.findIndex((c) => c === "credit" || c === "cr");
    const debitIdx = cols.findIndex((c) => c === "debit" || c === "dr");
    const refIdx = cols.findIndex((c) => c.includes("ref") || c.includes("chq") || c.includes("utr"));

    const csvRows: ExtractedStatementRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 2) continue;

      const amount = amountIdx >= 0 ? parseAmount(parts[amountIdx]) : undefined;
      let type: "credit" | "debit" | undefined;
      if (typeIdx >= 0) {
        const t = (parts[typeIdx] || "").toLowerCase();
        if (t.includes("cr") || t.includes("credit")) type = "credit";
        else if (t.includes("dr") || t.includes("debit")) type = "debit";
      } else if (creditIdx >= 0 && debitIdx >= 0) {
        const cr = parseAmount(parts[creditIdx]);
        const dr = parseAmount(parts[debitIdx]);
        if (cr && cr > 0) { type = "credit"; }
        else if (dr && dr > 0) { type = "debit"; }
      }

      const desc = descIdx >= 0 ? parts[descIdx] : undefined;
      const refNo = refIdx >= 0 ? parts[refIdx] : undefined;

      csvRows.push({
        date: dateIdx >= 0 ? parts[dateIdx] : undefined,
        description: desc,
        amount,
        type,
        balance: balIdx >= 0 ? parseAmount(parts[balIdx]) : undefined,
        refNo,
      });
    }

    const validCsv = csvRows.filter((r) => r.amount !== undefined);
    if (validCsv.length > 0) return validCsv;
  }

  // 2. Universal Text / PDF OCR Statement Parsing Engine (for non-CSV statements)
  const rows: ExtractedStatementRow[] = [];
  const dateRegex = /^\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4})\b/;

  // Group lines into transaction blocks starting with a Date
  const blocks: string[] = [];
  let currentBlock = "";

  // Structural Header/Footer & Metadata Detector
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const { isMetadata, isSummaryBoundary } = isStructuralHeaderOrMetadata(trimmed);

    if (isSummaryBoundary) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = "";
      }
      continue;
    }

    if (isMetadata) {
      continue;
    }

    if (dateRegex.test(trimmed)) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = trimmed;
    } else if (currentBlock) {
      currentBlock += " " + trimmed;
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  let prevBalance: number | undefined;

  for (const block of blocks) {
    const dateMatch = block.match(dateRegex);
    if (!dateMatch) continue;
    const dateStr = dateMatch[1];

    // Find reference / UTR / Chq / Txn ID (10 to 22 alphanumerics)
    const refMatch = block.match(/\b(AXNGG\d+|EPR\d+|\d{12,18}|[A-Z0-9]{12,22})\b/);
    const refNo = refMatch ? refMatch[1] : undefined;

    // Find all monetary amounts (e.g. 15,546.00, 39,239.81, 1,000.00)
    const amountMatches = block.match(/\b\d{1,3}(?:,\d{2,3})*\.\d{2}\b/g);
    if (!amountMatches || amountMatches.length === 0) continue;

    let amount: number | undefined;
    let balance: number | undefined;

    if (amountMatches.length >= 2) {
      balance = parseAmount(amountMatches[amountMatches.length - 1]);
      amount = parseAmount(amountMatches[amountMatches.length - 2]);
    } else {
      amount = parseAmount(amountMatches[0]);
    }

    if (!amount || amount === 0) continue;

    let type: "credit" | "debit";
    let calculatedAmount = amount;

    if (prevBalance !== undefined && balance !== undefined) {
      const delta = Math.round((balance - prevBalance) * 100) / 100;
      type = delta >= 0 ? "credit" : "debit";
      if (Math.abs(delta) > 0) {
        calculatedAmount = Math.abs(delta);
      }
    } else {
      // First row fallback where previous balance is not yet established
      const lower = block.toLowerCase();
      const isKeywordCredit = /neft cr|imps cr|upi cr|deposit|credit|by clg|cr\b/i.test(lower);
      type = isKeywordCredit ? "credit" : "debit";
    }

    if (balance !== undefined) prevBalance = balance;

    // Extract Sender / Receiver / Merchant name from narration
    let senderOrReceiver: string | undefined;

    // Pattern 1: UPI-NAME-PHONE@handle or UPI-NAME@handle
    const upiMatch = block.match(/UPI(?:-PZ)?-([A-Za-z0-9\s&.\-]+?)(?:-\d{10}|@|\b)/i);
    if (upiMatch && upiMatch[1]) {
      senderOrReceiver = upiMatch[1].replace(/SO\s+WALIUR|SO\s+[A-Z]+/i, "").trim();
    }

    // Pattern 2: NEFT CR-...-COMPANY NAME
    if (!senderOrReceiver) {
      const neftMatch = block.match(/NEFT\s+(?:CR|DR)-[A-Z0-9]+-([A-Za-z0-9\s&.\-]+?)(?:K-AXNGG|AXNGG|\b)/i);
      if (neftMatch && neftMatch[1]) {
        senderOrReceiver = neftMatch[1].trim();
      }
    }

    // Pattern 3: POS Merchant (e.g. FLIPKART PAYMENTS, AMAZON PAY)
    if (!senderOrReceiver) {
      const posMatch = block.match(/(?:FLIPKART\s+PAYMENTS|AMAZON\s+PAY|SWIGGY|ZOMATO|UBER|OLA|RECHARGE|PZ\s+HDFC\s+CC\s+BILLPAY)/i);
      if (posMatch) {
        senderOrReceiver = posMatch[0].trim();
      }
    }

    // Clean narration description
    let description = block
      .replace(dateRegex, "")
      .replace(/\b\d{1,3}(?:,\d{2,3})*\.\d{2}\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    rows.push({
      date: dateStr,
      description: senderOrReceiver ? `${senderOrReceiver} — ${description.slice(0, 60)}` : description.slice(0, 100),
      amount: calculatedAmount,
      type,
      balance,
      refNo,
      senderOrReceiver,
    });
  }

  return rows;
}

/**
 * Reconcile statement rows against SMS-derived transactions.
 * Matches by amount (±₹1 tolerance) and date proximity (±3 days).
 */
export async function reconcileStatement(
  rows: ExtractedStatementRow[],
  startDate?: Date,
  endDate?: Date
): Promise<ReconciliationResult> {
  // Fetch SMS-derived verified transactions for the period
  const where: Record<string, unknown> = { classification: "verified" };
  if (startDate || endDate) {
    where.txDate = {};
    if (startDate) (where.txDate as Record<string, Date>).gte = startDate;
    if (endDate) (where.txDate as Record<string, Date>).lte = endDate;
  }
  const txs = await db.transaction.findMany({ where, orderBy: { txDate: "desc" } });

  const details: ReconciliationResult["details"] = [];
  const matchedTxIds = new Set<string>();

  for (const row of rows) {
    if (!row.amount) continue;
    // Find a matching transaction
    let bestMatch: string | undefined;
    for (const tx of txs) {
      if (matchedTxIds.has(tx.id)) continue;
      const amountDiff = Math.abs(tx.amount - row.amount);
      if (amountDiff <= 1) {
        // Check date proximity if both have dates
        if (row.date && tx.txDate) {
          const rowDate = new Date(row.date);
          if (!isNaN(rowDate.getTime())) {
            const dayDiff = Math.abs(rowDate.getTime() - tx.txDate.getTime()) / (24 * 60 * 60 * 1000);
            if (dayDiff > 3) continue;
          }
        }
        bestMatch = tx.id;
        matchedTxIds.add(tx.id);
        break;
      }
    }
    details.push({
      statementRow: row,
      matchedTransactionId: bestMatch,
      status: bestMatch ? "matched" : "missed",
    });
  }

  // Extra = SMS-derived transactions not matched to any statement row
  for (const tx of txs) {
    if (!matchedTxIds.has(tx.id)) {
      details.push({
        statementRow: {},
        matchedTransactionId: tx.id,
        status: "extra",
      });
    }
  }

  const matched = details.filter((d) => d.status === "matched").length;
  const missed = details.filter((d) => d.status === "missed").length;
  const extra = details.filter((d) => d.status === "extra").length;
  const total = matched + missed;
  const matchRate = total > 0 ? Math.round((matched / total) * 100) : 0;

  return { total, matched, missed, extra, matchRate, details };
}

export interface ScheduledEmi {
  installmentNumber: number;
  dueDate: string; // ISO
  amount: number;
  status: "upcoming" | "paid" | "overdue";
  linkedTransactionId?: string;
}

/**
 * Generate a full EMI schedule from extracted loan fields (Section 8.5).
 * Pre-populates all future due dates/amounts so the app knows the complete
 * schedule upfront, instead of inferring it EMI-by-EMI over months.
 */
export function generateEmiSchedule(
  fields: ExtractedLoanFields,
  linkedTransactions: Array<{ txDate: Date; amount: number; id: string }> = []
): ScheduledEmi[] {
  if (!fields.emiAmount || !fields.tenure) return [];

  const schedule: ScheduledEmi[] = [];
  const dueDay = fields.dueDay ?? 1;
  const startDate = fields.startDate ? new Date(fields.startDate) : new Date();

  for (let i = 0; i < fields.tenure; i++) {
    // Calculate due date: month i after start, on dueDay
    const due = new Date(startDate.getFullYear(), startDate.getMonth() + i, dueDay);
    if (isNaN(due.getTime())) continue;

    // Check if this EMI was already paid (matching transaction within ±5 days)
    const matchingTx = linkedTransactions.find((t) => {
      const diff = Math.abs(t.txDate.getTime() - due.getTime()) / (24 * 60 * 60 * 1000);
      return diff <= 5 && Math.abs(t.amount - (fields.emiAmount as number)) <= 1;
    });

    const now = new Date();
    let status: ScheduledEmi["status"] = "upcoming";
    if (matchingTx) {
      status = "paid";
    } else if (due < now) {
      status = "overdue";
    }

    schedule.push({
      installmentNumber: i + 1,
      dueDate: due.toISOString(),
      amount: fields.emiAmount,
      status,
      linkedTransactionId: matchingTx?.id,
    });
  }

  return schedule;
}


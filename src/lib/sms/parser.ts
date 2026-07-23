/**
 * SMS Parser Engine.
 * - Matches sender against BankRule registry.
 * - Runs the rule's regex patterns to extract fields.
 * - Falls back to a generic parser when no rule matches.
 *
 * All parsing runs offline; no network calls.
 */

import {
  BANK_RULES,
  BankRule,
  ParsedFields,
  SenderType,
  TxType,
} from "./bank-rules";

export interface ParseResult {
  ok: boolean;
  rule?: BankRule;
  senderType: SenderType;
  bankName?: string;
  fields: ParsedFields;
  isEmi: boolean;
  matchedRuleIds: string[];
  rawDate?: string;
}

function toNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

function normalizeType(t: string | undefined): TxType | undefined {
  if (!t) return undefined;
  const low = t.toLowerCase();
  if (
    low.includes("debit") ||
    low.includes("spent") ||
    low.includes("paid") ||
    low.includes("withdrawn") ||
    low.includes("sent")
  )
    return "debit";
  if (
    low.includes("credit") ||
    low.includes("received") ||
    low.includes("deposited") ||
    low.includes("added") ||
    low.includes("disbursed")
  )
    return "credit";
  return undefined;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parse a date like "12/Nov/24" or "12-11-2024" into ISO string */
function parseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw.replace(/-/g, "/"));
  if (!isNaN(d.getTime())) return d.toISOString();
  const mt = raw.match(/(\d{1,2})[/\-]([A-Za-z]{3})[/\-](\d{2,4})/);
  if (mt) {
    const day = parseInt(mt[1], 10);
    const mon = MONTHS[mt[2].toLowerCase().slice(0, 3)];
    let year = parseInt(mt[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined) {
      const dd = new Date(year, mon, day);
      if (!isNaN(dd.getTime())) return dd.toISOString();
    }
  }
  const mt2 = raw.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
  if (mt2) {
    const day = parseInt(mt2[1], 10);
    const mon = parseInt(mt2[2], 10) - 1;
    let year = parseInt(mt2[3], 10);
    if (year < 100) year += 2000;
    const dd = new Date(year, mon, day);
    if (!isNaN(dd.getTime())) return dd.toISOString();
  }
  return undefined;
}

function findRuleBySender(sender: string | undefined): BankRule | undefined {
  if (!sender) return undefined;
  const up = sender.toUpperCase();
  for (const r of BANK_RULES) {
    if (r.senderIdPatterns.some((p) => up.includes(p.toUpperCase()))) return r;
  }
  return undefined;
}

/** Detect if a captured "merchant" is actually an account/card reference. */
function isAccountLike(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return /^(a\/c|acct|ac|card|xx|\*+|\d{4,})\b/i.test(t) || /^\d+$/.test(t.replace(/\s/g, ""));
}

/** Strip "via <WalletName>" suffixes from merchant names.
 * e.g. "BESCOM ELECTRICITY via PhonePe" → "BESCOM ELECTRICITY"
 * Also strips trailing "UPI" suffixes and "via UPI". */
function stripViaSuffix(s: string): string {
  let t = s.trim();
  // "via PhonePe", "via Paytm UPI", "via Google Pay", "via UPI", etc.
  t = t.replace(/\s+via\s+[A-Za-z][A-Za-z\s]{1,25}?$/i, "");
  // trailing " UPI" alone
  t = t.replace(/\s+UPI$/i, "");
  return t.trim();
}

/** Try to find a better merchant name from the text, preferring "to" for debits and "from" for credits. */
function findBetterMerchant(text: string, type?: TxType): string | undefined {
  const rx = (p: string) => new RegExp(p, "i");
  // For debits: "to <merchant>" is the recipient
  // For credits: "from <merchant>" is the source
  const preferredPrep = type === "credit" ? "from" : "to";
  const re = rx(`\\b${preferredPrep}\\s+(?<m>[A-Za-z0-9][A-Za-z0-9 &'.-]{2,40}?)(?:\\s+(?:on|via|avl|txn|ref|UPI|using|through|for|at)|[.,\\n]|$)`);
  const m = text.match(re);
  if (m?.groups?.m) {
    const cand = m.groups.m.trim().replace(/\s+/g, " ");
    if (cand && !isAccountLike(cand)) return cand;
  }
  // fallback: try the other preposition
  const otherPrep = type === "credit" ? "to" : "from";
  const re2 = rx(`\\b${otherPrep}\\s+(?<m>[A-Za-z0-9][A-Za-z0-9 &'.-]{2,40}?)(?:\\s+(?:on|via|avl|txn|ref|UPI|using|through|for|at)|[.,\\n]|$)`);
  const m2 = text.match(re2);
  if (m2?.groups?.m) {
    const cand = m2.groups.m.trim().replace(/\s+/g, " ");
    if (cand && !isAccountLike(cand)) return cand;
  }
  // last resort: try "at"
  const re3 = rx(`\\bat\\s+(?<m>[A-Za-z0-9][A-Za-z0-9 &'.-]{2,40}?)(?:\\s+(?:on|via|avl|txn|ref|UPI|using|through)|[.,\\n]|$)`);
  const m3 = text.match(re3);
  if (m3?.groups?.m) {
    const cand = m3.groups.m.trim().replace(/\s+/g, " ");
    if (cand && !isAccountLike(cand)) return cand;
  }
  return undefined;
}

function applyRule(rule: BankRule, text: string): {
  fields: ParsedFields;
  isEmi: boolean;
  rawDate?: string;
} {
  const fields: ParsedFields = {};
  let isEmi = false;
  let rawDate: string | undefined;

  for (const pat of rule.patterns) {
    try {
      const re = new RegExp(pat.regex, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const groups = (m.groups || {}) as Record<string, string>;
        for (const [groupName, fieldKey] of Object.entries(pat.fieldMap)) {
          const v = groups[groupName];
          if (!v) continue;
          switch (fieldKey) {
            case "amount":
              if (!fields.amount) fields.amount = toNumber(v);
              break;
            case "balance":
              if (!fields.balance) fields.balance = toNumber(v);
              break;
            case "emiAmount":
              if (!fields.emiAmount) fields.emiAmount = toNumber(v);
              break;
            case "type":
              if (!fields.type) {
                const t = normalizeType(v);
                if (t) fields.type = t;
                fields.rawType = v;
              }
              break;
            case "merchant":
              if (!fields.merchant) fields.merchant = v.trim().replace(/\s+/g, " ");
              break;
            case "accountMasked":
              if (!fields.accountMasked) fields.accountMasked = v;
              break;
            case "card":
              if (!fields.card) fields.card = v;
              break;
            case "loanId":
              if (!fields.loanId) fields.loanId = v;
              break;
            case "date":
              if (!fields.date) {
                const iso = parseDate(v);
                if (iso) fields.date = iso;
                rawDate = v;
              }
              break;
            case "dueDate":
              if (!fields.dueDate) {
                const iso = parseDate(v);
                if (iso) fields.dueDate = iso;
                rawDate = v;
              }
              break;
          }
        }
        if (pat.isEmi) isEmi = true;
        if (pat.typeOverride && !fields.type) fields.type = pat.typeOverride;
      }
    } catch {
      // ignore bad regex
    }
  }

  if (!fields.date) {
    const dm = text.match(
      /(\d{1,2}[/\-][A-Za-z]{3}[/\-]\d{2,4}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/
    );
    if (dm) {
      const iso = parseDate(dm[1]);
      if (iso) {
        fields.date = iso;
        rawDate = dm[1];
      }
    }
  }

  return { fields, isEmi, rawDate };
}

/** Generic fallback parser for unmatched formats (Tier 3). */
function genericParse(text: string): {
  fields: ParsedFields;
  isEmi: boolean;
  rawDate?: string;
} {
  const fields: ParsedFields = {};
  let isEmi = false;
  let rawDate: string | undefined;

  const rx = (p: string) => new RegExp(p, "i");

  // amount + type
  const amtMt = text.match(
    rx("(?:Rs\\.?\\s?|INR\\s?)(?<amount>[\\d,]+\\.?\\d*)\\s*(?<type>debited|credited|spent|received|paid|withdrawn|sent|added|deposited|disbursed)")
  );
  if (amtMt) {
    fields.amount = toNumber(amtMt.groups?.amount);
    fields.type = normalizeType(amtMt.groups?.type);
    fields.rawType = amtMt.groups?.type;
  } else {
    const amtMt2 = text.match(
      rx("(?<type>debited|credited|spent|received|paid|withdrawn|sent|added|deposited|disbursed)\\s*(?:Rs\\.?\\s?|INR\\s?)(?<amount>[\\d,]+\\.?\\d*)")
    );
    if (amtMt2) {
      fields.amount = toNumber(amtMt2.groups?.amount);
      fields.type = normalizeType(amtMt2.groups?.type);
      fields.rawType = amtMt2.groups?.type;
    }
  }

  // balance
  const balMt = text.match(rx("Avl(?:ailable)?\\s*Bal(?:ance)?\\s*(?:Rs\\.?|INR)?\\s*(?<balance>[\\d,]+\\.?\\d*)"));
  if (balMt) fields.balance = toNumber(balMt.groups?.balance);

  // EMI
  const emiMt = text.match(rx("EMI\\s*(?:of|for|amount)?\\s*(?:Rs\\.?|INR)?\\s*(?<emiAmount>[\\d,]+\\.?\\d*)"));
  if (emiMt) {
    fields.emiAmount = toNumber(emiMt.groups?.emiAmount);
    isEmi = true;
    if (!fields.type) fields.type = "debit";
  }

  // merchant
  const merMt = text.match(
    rx("(?:at|to|from|by|info:|vpa:)\\s*(?<merchant>[A-Za-z0-9][^.\\n]{2,40}?)(?:\\s+(?:on|via|avl|txn|ref|UPI)|[.,\\n]|$)")
  );
  if (merMt) fields.merchant = merMt.groups?.merchant?.trim().replace(/\s+/g, " ");

  // account
  const acMt = text.match(rx("A/c\\s*[Xx*]*\\s*(?<account>\\d{3,5})"));
  if (acMt) fields.accountMasked = acMt.groups?.account;

  // card
  const cardMt = text.match(rx("Card\\s*(?:ending|no\\.?)?\\s*(?:with)?\\s*(?<card>\\d{4})"));
  if (cardMt) fields.card = cardMt.groups?.card;

  // date
  const dm = text.match(
    /(\d{1,2}[/\-][A-Za-z]{3}[/\-]\d{2,4}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/
  );
  if (dm) {
    const iso = parseDate(dm[1]);
    if (iso) {
      fields.date = iso;
      rawDate = dm[1];
    }
  }

  // due date
  const dueMt = text.match(
    rx("due\\s*(?:date)?\\s*[:\\-]?\\s*(?<dueDate>\\d{1,2}[/\\-][A-Za-z]{3}[/\\-]\\d{2,4}|\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})")
  );
  if (dueMt) {
    const iso = parseDate(dueMt.groups?.dueDate);
    if (iso) fields.dueDate = iso;
  }

  return { fields, isEmi, rawDate };
}

export interface ParseInput {
  sender?: string;
  text: string;
  receivedAt?: string;
}

export function parseSms(input: ParseInput): ParseResult {
  const { sender, text } = input;
  const matchedRuleIds: string[] = [];
  const rule = findRuleBySender(sender);

  let fields: ParsedFields = {};
  let isEmi = false;
  let rawDate: string | undefined;
  let bankName: string | undefined;
  let senderType: SenderType = "unknown";

  if (rule) {
    matchedRuleIds.push(rule.id);
    bankName = rule.bankName;
    senderType = rule.senderType;
    const r = applyRule(rule, text);
    fields = r.fields;
    isEmi = r.isEmi;
    rawDate = r.rawDate;
  }

  const g = genericParse(text);
  if (!fields.amount && g.fields.amount) fields.amount = g.fields.amount;
  if (!fields.type && g.fields.type) fields.type = g.fields.type;
  if (!fields.balance && g.fields.balance) fields.balance = g.fields.balance;
  if (!fields.emiAmount && g.fields.emiAmount) {
    fields.emiAmount = g.fields.emiAmount;
    isEmi = isEmi || g.isEmi;
  }
  if (!fields.merchant && g.fields.merchant) fields.merchant = g.fields.merchant;
  if (!fields.accountMasked && g.fields.accountMasked) fields.accountMasked = g.fields.accountMasked;
  if (!fields.card && g.fields.card) fields.card = g.fields.card;
  if (!fields.date && g.fields.date) fields.date = g.fields.date;
  if (!fields.dueDate && g.fields.dueDate) fields.dueDate = g.fields.dueDate;
  if (!rawDate && g.rawDate) rawDate = g.rawDate;

  // Merchant cleanup: reject account-like captures and try to find a better one.
  // e.g. "debited from A/c XX1234 ... to AMAZON PAY" should yield "AMAZON PAY"
  if (fields.merchant && isAccountLike(fields.merchant)) {
    const better = findBetterMerchant(text, fields.type);
    if (better) fields.merchant = better;
    else fields.merchant = undefined;
  }

  // Strip "via <WalletName>" suffixes from merchant names.
  // e.g. "BESCOM ELECTRICITY via PhonePe" → "BESCOM ELECTRICITY"
  if (fields.merchant) {
    fields.merchant = stripViaSuffix(fields.merchant);
  }

  if (!fields.date && input.receivedAt) {
    fields.date = new Date(input.receivedAt).toISOString();
  }
  if (!fields.date) {
    fields.date = new Date().toISOString();
  }

  // EMI fallback: if this is an EMI message, treat emiAmount as the transaction amount
  if (isEmi && fields.emiAmount && !fields.amount) {
    fields.amount = fields.emiAmount;
  }
  if (isEmi && !fields.type) {
    fields.type = "debit";
  }

  const ok = !!fields.amount && !!fields.type;

  return {
    ok,
    rule,
    senderType,
    bankName,
    fields,
    isEmi,
    matchedRuleIds,
    rawDate,
  };
}

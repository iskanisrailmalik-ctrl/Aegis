/**
 * Intelligence Engine — Tier 2 Natural-Language Q&A.
 *
 * Implements a hybrid retrieval approach (Section 5.5 of the spec):
 * 1. Parse the natural-language question to extract intent + structured filters
 *    (category, date range, amount range, sender type)
 * 2. Route obviously-structured questions to Tier 1 aggregation logic (pre-aggregation routing)
 * 3. For open-ended questions, do keyword retrieval over SmsMessage + Transaction records
 * 4. Generate a grounded answer from retrieved records (template-based summarization)
 * 5. Return answer with source records attached for explainability
 *
 * Fully offline — no LLM call. Uses smart pattern matching + aggregation.
 */

import { db } from "@/lib/db";
import { CATEGORIES, type CategoryKey } from "./categories";
import { buildTfidfIndex, semanticSearch } from "./embeddings";

export interface QueryResult {
  question: string;
  answer: string;
  confidence: "high" | "medium" | "low";
  sourceIds: string[]; // SmsMessage / Transaction IDs
  sources: Array<{
    id: string;
    type: "transaction" | "smsMessage";
    preview: string;
    amount?: number;
    date?: string;
    merchant?: string;
  }>;
  chart?: {
    type: "bar" | "pie" | "line";
    data: Array<{ label: string; value: number }>;
  };
  routedToTier1: boolean;
}

interface ParsedQuery {
  intent: "spending" | "income" | "emi" | "top" | "summary" | "search" | "unknown";
  category?: CategoryKey;
  categoryName?: string;
  period?: "day" | "week" | "month" | "year" | "all";
  merchant?: string;
  limit?: number;
}

const PERIOD_KEYWORDS: Record<string, ParsedQuery["period"]> = {
  today: "day",
  "this week": "week",
  weekly: "week",
  "this month": "month",
  monthly: "month",
  "last month": "month",
  "this year": "year",
  yearly: "year",
  "last year": "year",
  ever: "all",
  "all time": "all",
};

function parseQuery(question: string): ParsedQuery {
  const q = question.toLowerCase();

  // Detect category
  let category: CategoryKey | undefined;
  let categoryName: string | undefined;
  for (const [key, def] of Object.entries(CATEGORIES)) {
    const label = def.label.toLowerCase();
    if (q.includes(label) || q.includes(key)) {
      category = key as CategoryKey;
      categoryName = def.label;
      break;
    }
    // Also check keywords
    const catKeywords: Record<string, string[]> = {
      food: ["food", "dining", "restaurant", "swiggy", "zomato", "grocery", "groceries"],
      shopping: ["shopping", "amazon", "flipkart", "shop"],
      bills: ["bill", "bills", "electricity", "utility", "utilities", "recharge"],
      entertainment: ["entertainment", "netflix", "spotify", "movie", "subscription"],
      transport: ["transport", "uber", "ola", "fuel", "petrol", "cab"],
      health: ["health", "medical", "pharmacy", "doctor", "hospital"],
      travel: ["travel", "flight", "hotel", "trip"],
      emi: ["emi", "loan", "installment"],
      investment: ["investment", "mutual fund", "sip", "stocks"],
    };
    const kws = catKeywords[key];
    if (kws && kws.some((kw) => q.includes(kw))) {
      category = key as CategoryKey;
      categoryName = def.label;
      break;
    }
  }

  // Detect period
  let period: ParsedQuery["period"] | undefined;
  for (const [kw, p] of Object.entries(PERIOD_KEYWORDS)) {
    if (q.includes(kw)) {
      period = p;
      break;
    }
  }

  // Detect intent
  let intent: ParsedQuery["intent"] = "unknown";
  if (q.includes("spend") || q.includes("spent") || q.includes("how much") && (q.includes("spend") || q.includes("on"))) {
    intent = "spending";
  } else if (q.includes("income") || q.includes("earn") || q.includes("salary") || q.includes("credited")) {
    intent = "income";
  } else if (q.includes("emi") || q.includes("loan") || q.includes("installment")) {
    intent = "emi";
  } else if (q.includes("top") || q.includes("biggest") || q.includes("largest") || q.includes("most expensive")) {
    intent = "top";
  } else if (q.includes("summar") || q.includes("overview") || q.includes("summary") || q.includes("report")) {
    intent = "summary";
  } else if (q.includes("show") || q.includes("find") || q.includes("search") || q.includes("list")) {
    intent = "search";
  }

  // Detect "top N"
  const topMatch = q.match(/top (\d+)/);
  const limit = topMatch ? parseInt(topMatch[1], 10) : undefined;

  // Detect merchant (text after "from" or "at" or "on" that's not a category keyword)
  let merchant: string | undefined;
  const merchantMatch = q.match(/(?:from|at|on|to)\s+([a-z][a-z\s]{2,20}?)(?:\s+(?:last|this|in|how|$))/);
  if (merchantMatch && merchantMatch[1]) {
    const candidate = merchantMatch[1].trim();
    // Exclude if it's a period keyword
    if (!["month", "week", "year", "today", "all", "time"].includes(candidate)) {
      merchant = candidate;
    }
  }

  return { intent, category, categoryName, period, merchant, limit };
}

function periodStartDate(period: ParsedQuery["period"]): Date | null {
  if (!period || period === "all") return null;
  const now = new Date();
  if (period === "day") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }
  return null;
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function answerQuery(question: string): Promise<QueryResult> {
  const parsed = parseQuery(question);
  const start = periodStartDate(parsed.period);

  // Fetch relevant transactions
  const txWhere: Record<string, unknown> = { classification: "verified" };
  if (start) txWhere.txDate = { gte: start };
  if (parsed.category) txWhere.category = parsed.category;

  const txs = await db.transaction.findMany({
    where: txWhere,
    orderBy: { txDate: "desc" },
    take: 200,
    include: { splits: true },
  });

  // Fetch relevant SMS messages (keyword retrieval for open-ended questions)
  const searchWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["much", "spend", "spent", "how", "this", "last", "show", "find", "what", "when", "which", "have"].includes(w));

  let smsMessages: Array<{ id: string; rawText: string; sender: string | null; receivedAt: Date }> = [];
  if (searchWords.length > 0) {
    const orConditions = searchWords.slice(0, 5).map((w) => ({ rawText: { contains: w } }));
    smsMessages = await db.smsMessage.findMany({
      where: { OR: orConditions },
      orderBy: { receivedAt: "desc" },
      take: 20,
    });
  }

  // --- Route to Tier 1 aggregation for structured questions ---
  const debits = txs.filter((t) => t.type === "debit");
  const credits = txs.filter((t) => t.type === "credit");

  // SPENDING intent
  if (parsed.intent === "spending") {
    const totalSpent = debits.reduce((s, t) => s + t.amount, 0);
    if (totalSpent === 0) {
      return {
        question,
        answer: `I couldn't find any spending${parsed.categoryName ? ` on ${parsed.categoryName}` : ""}${parsed.period ? ` ${parsed.period}` : ""}. Try a different time range or category.`,
        confidence: "low",
        sourceIds: [],
        sources: [],
        routedToTier1: true,
      };
    }
    const periodLabel = parsed.period ? ` ${parsed.period}` : "";
    let answer: string;
    if (parsed.categoryName) {
      answer = `You spent ${formatINR(totalSpent)} on ${parsed.categoryName.toLowerCase()}${periodLabel}, across ${debits.length} transaction${debits.length > 1 ? "s" : ""}.`;
    } else {
      answer = `You spent a total of ${formatINR(totalSpent)}${periodLabel}, across ${debits.length} debit transaction${debits.length > 1 ? "s" : ""}.`;
    }
    return {
      question,
      answer,
      confidence: "high",
      sourceIds: debits.slice(0, 10).map((t) => t.id),
      sources: debits.slice(0, 10).map((t) => ({
        id: t.id,
        type: "transaction" as const,
        preview: t.rawMessage.slice(0, 80),
        amount: t.amount,
        date: t.txDate.toISOString(),
        merchant: t.merchant ?? undefined,
      })),
      routedToTier1: true,
    };
  }

  // INCOME intent
  if (parsed.intent === "income") {
    const totalIncome = credits.reduce((s, t) => s + t.amount, 0);
    if (totalIncome === 0) {
      return {
        question,
        answer: `I couldn't find any income${parsed.period ? ` ${parsed.period}` : ""}.`,
        confidence: "low",
        sourceIds: [],
        sources: [],
        routedToTier1: true,
      };
    }
    const periodLabel = parsed.period ? ` ${parsed.period}` : "";
    return {
      question,
      answer: `You received ${formatINR(totalIncome)} in income${periodLabel}, across ${credits.length} credit transaction${credits.length > 1 ? "s" : ""}.`,
      confidence: "high",
      sourceIds: credits.slice(0, 10).map((t) => t.id),
      sources: credits.slice(0, 10).map((t) => ({
        id: t.id,
        type: "transaction" as const,
        preview: t.rawMessage.slice(0, 80),
        amount: t.amount,
        date: t.txDate.toISOString(),
        merchant: t.merchant ?? undefined,
      })),
      routedToTier1: true,
    };
  }

  // EMI intent
  if (parsed.intent === "emi") {
    const emis = debits.filter((t) => {
      let extra: Record<string, unknown> = {};
      try { extra = t.extra ? JSON.parse(t.extra) : {}; } catch { /* ignore */ }
      return Boolean(extra.isEmi) || t.category === "emi";
    });
    const totalEmi = emis.reduce((s, t) => s + t.amount, 0);
    if (emis.length === 0) {
      return {
        question,
        answer: `I couldn't find any EMI payments in your records.`,
        confidence: "low",
        sourceIds: [],
        sources: [],
        routedToTier1: true,
      };
    }
    const loans = await db.loanAccount.findMany();
    const answer = `You have ${emis.length} EMI payment${emis.length > 1 ? "s" : ""} totaling ${formatINR(totalEmi)}${parsed.period ? ` ${parsed.period}` : ""}. ${loans.length} active loan${loans.length > 1 ? "s" : ""} tracked.`;
    return {
      question,
      answer,
      confidence: "high",
      sourceIds: emis.slice(0, 10).map((t) => t.id),
      sources: emis.slice(0, 10).map((t) => ({
        id: t.id,
        type: "transaction" as const,
        preview: t.rawMessage.slice(0, 80),
        amount: t.amount,
        date: t.txDate.toISOString(),
        merchant: t.merchant ?? undefined,
      })),
      routedToTier1: true,
    };
  }

  // TOP intent (top merchants by spend)
  if (parsed.intent === "top") {
    const limit = parsed.limit ?? 5;
    const merMap = new Map<string, { amount: number; count: number }>();
    for (const t of debits) {
      const name = (t.merchant || t.bank || "Unknown").trim();
      if (!name || name === "Unknown") continue;
      const cur = merMap.get(name) ?? { amount: 0, count: 0 };
      cur.amount += t.amount;
      cur.count += 1;
      merMap.set(name, cur);
    }
    const top = Array.from(merMap.entries())
      .map(([name, v]) => ({ name, amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
    if (top.length === 0) {
      return {
        question,
        answer: `I couldn't find any spending to rank.`,
        confidence: "low",
        sourceIds: [],
        sources: [],
        routedToTier1: true,
      };
    }
    const periodLabel = parsed.period ? ` ${parsed.period}` : "";
    const answer = `Your top ${top.length} merchants by spend${periodLabel}:\n${top.map((m, i) => `${i + 1}. ${m.name} — ${formatINR(m.amount)} (${m.count} txns)`).join("\n")}`;
    return {
      question,
      answer,
      confidence: "high",
      sourceIds: [],
      sources: [],
      chart: {
        type: "bar",
        data: top.map((m) => ({ label: m.name, value: m.amount })),
      },
      routedToTier1: true,
    };
  }

  // SUMMARY intent
  if (parsed.intent === "summary") {
    const totalSpent = debits.reduce((s, t) => s + t.amount, 0);
    const totalIncome = credits.reduce((s, t) => s + t.amount, 0);
    const net = totalIncome - totalSpent;
    const periodLabel = parsed.period ? ` ${parsed.period}` : " this period";

    // category breakdown
    const catMap = new Map<string, number>();
    for (const t of debits) {
      const key = t.category || "other";
      catMap.set(key, (catMap.get(key) ?? 0) + t.amount);
    }
    const topCat = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])[0];

    const answer = `Summary${periodLabel}:\n• Income: ${formatINR(totalIncome)} (${credits.length} credits)\n• Spending: ${formatINR(totalSpent)} (${debits.length} debits)\n• Net: ${net >= 0 ? "+" : ""}${formatINR(net)}\n• Top category: ${topCat ? CATEGORIES[topCat[0] as CategoryKey]?.label ?? topCat[0] : "—"}`;

    return {
      question,
      answer,
      confidence: "high",
      sourceIds: txs.slice(0, 5).map((t) => t.id),
      sources: txs.slice(0, 5).map((t) => ({
        id: t.id,
        type: "transaction" as const,
        preview: t.rawMessage.slice(0, 80),
        amount: t.amount,
        date: t.txDate.toISOString(),
        merchant: t.merchant ?? undefined,
      })),
      chart: {
        type: "bar",
        data: Array.from(catMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => ({ label: CATEGORIES[k as CategoryKey]?.label ?? k, value: v })),
      },
      routedToTier1: true,
    };
  }

  // SEARCH / unknown intent — hybrid retrieval (keyword + semantic TF-IDF + Document RAG)
  // 1. Fetch document records for RAG retrieval
  const documents = await db.documentRecord.findMany({
    select: { id: true, fileName: true, documentType: true, sourceInstitution: true, extractedFields: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const docMatches = documents.filter((d) => {
    const text = `${d.fileName} ${d.documentType} ${d.sourceInstitution ?? ""} ${d.extractedFields ?? ""}`.toLowerCase();
    const q = question.toLowerCase();
    return q.split(" ").some((term) => term.length > 2 && text.includes(term));
  });

  if (docMatches.length > 0 && (question.toLowerCase().includes("document") || question.toLowerCase().includes("loan") || question.toLowerCase().includes("agreement") || question.toLowerCase().includes("term") || question.toLowerCase().includes("rate") || question.toLowerCase().includes("interest") || question.toLowerCase().includes("hdfc") || question.toLowerCase().includes("sbi") || question.toLowerCase().includes("statement") || question.toLowerCase().includes("policy"))) {
    const topDoc = docMatches[0];
    const fields = topDoc.extractedFields ? JSON.parse(topDoc.extractedFields) : {};
    const loan = fields.loanFields;
    const terms = fields.termsAndConditions as string[] | undefined;

    let docSummary = `I retrieved relevant document context from **${topDoc.fileName}** (${topDoc.sourceInstitution || topDoc.documentType}):\n`;
    if (loan) {
      if (loan.lender) docSummary += `\n• Lender: ${loan.lender}`;
      if (loan.principal) docSummary += `\n• Principal: ₹${loan.principal.toLocaleString("en-IN")}`;
      if (loan.emiAmount) docSummary += `\n• Monthly EMI: ₹${loan.emiAmount.toLocaleString("en-IN")}`;
      if (loan.tenure) docSummary += `\n• Tenure: ${loan.tenure} months`;
      if (loan.interestRate) docSummary += `\n• Interest Rate: ${loan.interestRate}% p.a.`;
      if (loan.loanRef) docSummary += `\n• Reference No: ${loan.loanRef}`;
    }
    if (terms && terms.length > 0) {
      docSummary += `\n\n**Terms & Conditions Highlights:**\n${terms.slice(0, 3).map((t) => `• ${t}`).join("\n")}`;
    }

    return {
      question,
      answer: docSummary,
      confidence: "high",
      sourceIds: [topDoc.id],
      sources: [
        {
          id: topDoc.id,
          type: "smsMessage" as const,
          preview: `[Document: ${topDoc.fileName}] ${docSummary.slice(0, 80)}`,
          date: topDoc.createdAt.toISOString(),
          merchant: topDoc.sourceInstitution ?? undefined,
        },
      ],
      routedToTier1: false,
    };
  }

  // Build TF-IDF index from ALL SMS messages for semantic search (Section 5.5 hybrid retrieval)
  const allSmsForIndex = await db.smsMessage.findMany({
    select: { id: true, rawText: true, sender: true, receivedAt: true },
    take: 500,
  });

  // Combine keyword results with semantic search results
  const tfidfIndex = buildTfidfIndex(
    allSmsForIndex.map((m) => ({ id: m.id, text: `${m.sender ?? ""} ${m.rawText}` }))
  );
  const semanticResults = semanticSearch(question, tfidfIndex.index, tfidfIndex.docFreq, tfidfIndex.totalDocs, 10);

  // Fetch the semantically-retrieved messages
  const semanticMessageIds = new Set(semanticResults.map((r) => r.id));
  const semanticMessages = semanticMessageIds.size > 0
    ? await db.smsMessage.findMany({ where: { id: { in: Array.from(semanticMessageIds) } } })
    : [];

  // Merge keyword + semantic results (dedupe by ID, prefer higher semantic score)
  const mergedMap = new Map<string, { message: typeof smsMessages[number]; score: number; source: "keyword" | "semantic" | "both" }>();

  // Add keyword results (score = 0.5 default)
  for (const m of smsMessages) {
    mergedMap.set(m.id, { message: m, score: 0.5, source: "keyword" });
  }

  // Add/update with semantic results
  for (const sr of semanticResults) {
    const msg = semanticMessages.find((m) => m.id === sr.id);
    if (!msg) continue;
    const existing = mergedMap.get(sr.id);
    if (existing) {
      mergedMap.set(sr.id, { message: msg, score: Math.max(existing.score, sr.score), source: "both" });
    } else {
      mergedMap.set(sr.id, { message: msg, score: sr.score, source: "semantic" });
    }
  }

  // Sort by score descending
  const mergedResults = Array.from(mergedMap.values()).sort((a, b) => b.score - a.score);

  if (mergedResults.length > 0) {
    const topResults = mergedResults.slice(0, 5);
    const usedSemantic = topResults.some((r) => r.source === "semantic" || r.source === "both");
    const answer = `I found ${mergedResults.length} SMS message${mergedResults.length > 1 ? "s" : ""} matching your query${usedSemantic ? " (using semantic + keyword search)" : ""}. Here are the most relevant:\n\n${topResults.map((r, i) => `${i + 1}. [${r.message.sender ?? "Unknown"}] ${r.message.rawText.slice(0, 100)}${r.message.rawText.length > 100 ? "…" : ""}`).join("\n\n")}`;
    return {
      question,
      answer,
      confidence: mergedResults.length >= 3 ? "high" : "medium",
      sourceIds: mergedResults.slice(0, 10).map((r) => r.message.id),
      sources: mergedResults.slice(0, 10).map((r) => ({
        id: r.message.id,
        type: "smsMessage" as const,
        preview: r.message.rawText.slice(0, 80),
        date: r.message.receivedAt.toISOString(),
      })),
      routedToTier1: false,
    };
  }

  // Fallback — no results
  return {
    question,
    answer: `I couldn't find enough information to answer that. Try asking about spending, income, EMIs, top merchants, or search for a specific merchant or keyword.`,
    confidence: "low",
    sourceIds: [],
    sources: [],
    routedToTier1: false,
  };
}

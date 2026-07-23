/**
 * Recurring payment detection.
 * Finds debit transactions that repeat with similar amount + merchant
 * across multiple occurrences (e.g. monthly subscriptions, weekly groceries).
 *
 * All logic runs on-device against the local transaction store.
 */

import { db } from "@/lib/db";

export interface RecurringGroup {
  key: string;
  merchant: string;
  category: string | null;
  // typical amount (most common / median)
  amount: number;
  // occurrence count
  count: number;
  // estimated frequency label
  frequency: "weekly" | "monthly" | "irregular";
  // average days between occurrences
  avgDaysBetween: number | null;
  // last occurrence ISO
  lastDate: string;
  // next predicted due date ISO
  nextPredicted: string | null;
  // the transaction ids in this group
  txIds: string[];
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function avgDaysBetween(dates: Date[]): number | null {
  if (dates.length < 2) return null;
  const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].getTime() - sorted[i - 1].getTime()) / (24 * 60 * 60 * 1000);
    gaps.push(gap);
  }
  return Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
}

function classifyFrequency(avgDays: number | null, count: number): RecurringGroup["frequency"] {
  if (!avgDays) return "irregular";
  if (avgDays >= 6 && avgDays <= 8) return "weekly";
  if (avgDays >= 26 && avgDays <= 33) return "monthly";
  if (count >= 2) return "irregular";
  return "irregular";
}

/**
 * Detect recurring debit transactions.
 * @param minCount minimum occurrences to be considered recurring (default 2)
 */
export async function detectRecurring(minCount = 2): Promise<RecurringGroup[]> {
  const txs = await db.transaction.findMany({
    where: { type: "debit", classification: "verified" },
    orderBy: { txDate: "desc" },
    take: 500,
  });

  // Group by normalized merchant + rounded amount (±5%)
  const groups = new Map<string, {
    merchant: string;
    category: string | null;
    amounts: number[];
    dates: Date[];
    txIds: string[];
  }>();

  for (const t of txs) {
    const merchant = (t.merchant || t.bank || "Unknown").trim().toUpperCase();
    if (!merchant || merchant === "UNKNOWN") continue;
    // round amount to nearest 10 to absorb small variations
    const rounded = Math.round(t.amount / 10) * 10;
    const key = `${merchant}::${rounded}`;
    const cur = groups.get(key) ?? {
      merchant: t.merchant || t.bank || "Unknown",
      category: t.category,
      amounts: [],
      dates: [],
      txIds: [],
    };
    cur.amounts.push(t.amount);
    cur.dates.push(t.txDate);
    cur.txIds.push(t.id);
    groups.set(key, cur);
  }

  const out: RecurringGroup[] = [];
  for (const [key, g] of groups.entries()) {
    if (g.txIds.length < minCount) continue;
    const medAmount = median(g.amounts);
    const avgDays = avgDaysBetween(g.dates);
    const frequency = classifyFrequency(avgDays, g.txIds.length);
    const sortedDesc = [...g.dates].sort((a, b) => b.getTime() - a.getTime());
    const lastDate = sortedDesc[0];
    // predict next: last + avgDays (if we have a pattern)
    let nextPredicted: string | null = null;
    if (avgDays && avgDays >= 1 && avgDays <= 45) {
      const next = new Date(lastDate.getTime() + avgDays * 24 * 60 * 60 * 1000);
      // only show if in the future
      if (next.getTime() > Date.now()) {
        nextPredicted = next.toISOString();
      }
    }
    out.push({
      key,
      merchant: g.merchant,
      category: g.category,
      amount: medAmount,
      count: g.txIds.length,
      frequency,
      avgDaysBetween: avgDays,
      lastDate: lastDate.toISOString(),
      nextPredicted,
      txIds: g.txIds,
    });
  }

  // Sort: recurring with next prediction first, then by count desc, then amount desc
  return out.sort((a, b) => {
    if (a.nextPredicted && !b.nextPredicted) return -1;
    if (!a.nextPredicted && b.nextPredicted) return 1;
    if (b.count !== a.count) return b.count - a.count;
    return b.amount - a.amount;
  });
}

/**
 * Compute the total monthly recurring spend (sum of monthly-frequency amounts).
 */
export function monthlyRecurringTotal(groups: RecurringGroup[]): number {
  return groups
    .filter((g) => g.frequency === "monthly")
    .reduce((s, g) => s + g.amount, 0);
}

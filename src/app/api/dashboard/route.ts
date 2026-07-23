import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { getUpcomingEmis } from "@/lib/sms/loan-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function periodStart(period: "day" | "week" | "month" | "all" | "custom"): Date | null {
  if (period === "all") return null;
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
  // month
  const d = new Date(now);
  d.setMonth(d.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const periodParam = (req.nextUrl.searchParams.get("period") as "day" | "week" | "month" | "all" | "custom" | null) ?? "month";

    // Support custom date range via from/to query params
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");
    const customFrom = fromParam ? new Date(fromParam) : null;
    const customTo = toParam ? new Date(toParam) : null;
    if (customTo) {
      // include the full "to" day
      customTo.setHours(23, 59, 59, 999);
    }
    const start = periodStart(periodParam);

    // Build date filter: custom range takes precedence over preset periods
    let dateFilter: Record<string, Date> | undefined;
    if (periodParam === "custom" && (customFrom || customTo)) {
      dateFilter = {};
      if (customFrom) dateFilter.gte = customFrom;
      if (customTo) dateFilter.lte = customTo;
    } else if (start) {
      dateFilter = { gte: start };
    }

    const where = {
      classification: "verified" as const,
      ...(dateFilter ? { txDate: dateFilter } : {}),
    };

    const txs = await db.transaction.findMany({
      where,
      orderBy: { txDate: "desc" },
      take: 100,
      include: { splits: true },
    });

    const credited = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const debited = txs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const creditCount = txs.filter((t) => t.type === "credit").length;
    const debitCount = txs.filter((t) => t.type === "debit").length;

    const recent = txs.slice(0, 12);

    const upcoming = await getUpcomingEmis();

    // counts for badges
    const flaggedCount = await db.flaggedMessage.count({ where: { classification: "flagged" } });
    const unverifiedCount = await db.flaggedMessage.count({ where: { classification: "unverified" } });

    // Split-aware category breakdown (debits only — spending analysis).
    // If a transaction has splits, use the split categories+amounts instead of the parent category.
    const catMap = new Map<string, { amount: number; count: number }>();
    for (const t of txs) {
      if (t.type !== "debit") continue;
      if (t.splits && t.splits.length > 0) {
        // Use splits
        for (const sp of t.splits) {
          const key = sp.category || "other";
          const cur = catMap.get(key) ?? { amount: 0, count: 0 };
          cur.amount += sp.amount;
          cur.count += 1;
          catMap.set(key, cur);
        }
      } else {
        // No splits — use parent transaction category + full amount
        const key = t.category || "other";
        const cur = catMap.get(key) ?? { amount: 0, count: 0 };
        cur.amount += t.amount;
        cur.count += 1;
        catMap.set(key, cur);
      }
    }
    const categoryBreakdown = Array.from(catMap.entries())
      .map(([key, v]) => ({ key, amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount);

    // top merchants by spend
    const merMap = new Map<string, { amount: number; count: number; category: string }>();
    for (const t of txs) {
      if (t.type !== "debit") continue;
      const name = (t.merchant || t.bank || "Unknown").trim();
      if (!name || name === "Unknown") continue;
      const cur = merMap.get(name) ?? { amount: 0, count: 0, category: t.category || "other" };
      cur.amount += t.amount;
      cur.count += 1;
      merMap.set(name, cur);
    }
    const topMerchants = Array.from(merMap.entries())
      .map(([name, v]) => ({ name, amount: v.amount, count: v.count, category: v.category }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    // daily trend (last 14 days of debits)
    const trendMap = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trendMap.set(key, 0);
    }
    for (const t of txs) {
      if (t.type !== "debit") continue;
      const key = t.txDate.toISOString().slice(0, 10);
      if (trendMap.has(key)) {
        trendMap.set(key, (trendMap.get(key) ?? 0) + t.amount);
      }
    }
    const dailyTrend = Array.from(trendMap.entries()).map(([date, amount]) => ({ date, amount }));

    return NextResponse.json({
      period: periodParam,
      credited,
      debited,
      net: credited - debited,
      creditCount,
      debitCount,
      recent,
      upcoming,
      flaggedCount,
      unverifiedCount,
      categoryBreakdown,
      topMerchants,
      dailyTrend,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

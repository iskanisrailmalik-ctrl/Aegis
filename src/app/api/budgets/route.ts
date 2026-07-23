import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List all budgets with current-month spend per category. */
export async function GET() {
  try {
    const budgets = await db.budget.findMany({ orderBy: { category: "asc" } });

    // current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // get all verified debits this month with splits (split-aware spend tracking)
    const txs = await db.transaction.findMany({
      where: {
        type: "debit",
        classification: "verified",
        txDate: { gte: monthStart },
      },
      include: { splits: true },
    });

    // Split-aware spend map: if a transaction has splits, use split categories+amounts;
    // otherwise use the parent transaction's category + full amount.
    const spendMap = new Map<string, number>();
    for (const t of txs) {
      if (t.splits && t.splits.length > 0) {
        for (const sp of t.splits) {
          const key = sp.category || "other";
          spendMap.set(key, (spendMap.get(key) ?? 0) + sp.amount);
        }
      } else {
        const key = t.category || "other";
        spendMap.set(key, (spendMap.get(key) ?? 0) + t.amount);
      }
    }

    const result = budgets.map((b) => {
      const spent = spendMap.get(b.category) ?? 0;
      const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      return {
        id: b.id,
        category: b.category,
        amount: b.amount,
        spent,
        remaining: b.amount - spent,
        pct: Math.round(pct),
        over: spent > b.amount,
      };
    });

    return NextResponse.json({ budgets: result });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { category, amount } = body as { category: string; amount: number };
    if (!category || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Missing category or invalid amount" },
        { status: 400 }
      );
    }
    const budget = await db.budget.upsert({
      where: { category },
      update: { amount },
      create: { category, amount },
    });
    return NextResponse.json(budget);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

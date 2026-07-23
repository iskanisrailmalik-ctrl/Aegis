import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  try {
    const period = (req.nextUrl.searchParams.get("period") as "day" | "week" | "month" | "all" | null) ?? "month";

    const start = (() => {
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
      const d = new Date(now);
      d.setMonth(d.getMonth(), 1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const where = {
      classification: "verified" as const,
      ...(start ? { txDate: { gte: start } } : {}),
    };

    const txs = await db.transaction.findMany({
      where,
      orderBy: { txDate: "desc" },
      take: 500,
    });

    const credited = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const debited = txs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);

    // category breakdown
    const catMap = new Map<string, { amount: number; count: number }>();
    for (const t of txs) {
      if (t.type !== "debit") continue;
      const key = t.category || "other";
      const cur = catMap.get(key) ?? { amount: 0, count: 0 };
      cur.amount += t.amount;
      cur.count += 1;
      catMap.set(key, cur);
    }
    const breakdown = Array.from(catMap.entries())
      .map(([key, v]) => ({ key, amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount);

    const periodLabel = { day: "Today", week: "This Week", month: "This Month", all: "All Time" }[period];
    const now = new Date();

    const rows = txs
      .map((t) => {
        const catDef = CATEGORIES[(t.category as CategoryKey) ?? "other"];
        const catColor = catDef?.hex ?? "#94a3b8";
        const isCredit = t.type === "credit";
        return `<tr>
          <td>${fmtDate(t.txDate.toISOString())}</td>
          <td>${esc(t.merchant || t.bank || "—")}</td>
          <td>${esc(t.bank || "—")}</td>
          <td><span class="cat" style="--c:${catColor}">${esc(catDef?.label ?? t.category ?? "—")}</span></td>
          <td class="${isCredit ? "credit" : "debit"}">${isCredit ? "+" : "−"} ${fmt(t.amount)}</td>
          <td>${t.balance !== null ? fmt(t.balance) : "—"}</td>
        </tr>`;
      })
      .join("\n");

    const catRows = breakdown
      .map((c) => {
        const def = CATEGORIES[c.key as CategoryKey];
        const pct = debited ? (c.amount / debited) * 100 : 0;
        return `<tr>
          <td><span class="cat" style="--c:${def?.hex ?? "#94a3b8"}">${esc(def?.label ?? c.key)}</span></td>
          <td class="num">${fmt(c.amount)}</td>
          <td class="num">${c.count}</td>
          <td class="num">${pct.toFixed(1)}%</td>
        </tr>`;
      })
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Aegis Statement — ${periodLabel}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0; padding: 32px; color: #0f172a; background: #fff;
    font-size: 13px; line-height: 1.5;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 16px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #064e3b; }
  .header .sub { color: #64748b; font-size: 12px; }
  .header .meta { text-align: right; font-size: 11px; color: #64748b; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .summary .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
  .summary .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
  .summary .value { font-size: 18px; font-weight: 700; }
  .summary .credit .value { color: #059669; }
  .summary .debit .value { color: #dc2626; }
  .summary .net .value { color: ${credited - debited >= 0 ? "#059669" : "#dc2626"}; }
  h2 { font-size: 14px; font-weight: 600; margin: 24px 0 8px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 8px 6px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 6px 6px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.credit { color: #059669; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  td.debit { color: #dc2626; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  .cat { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 10px; font-weight: 500; background: color-mix(in srgb, var(--c) 15%, white); color: var(--c); }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  .actions { margin-bottom: 16px; }
  .btn { display: inline-block; padding: 6px 14px; background: #10b981; color: #fff; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; }
  .btn:hover { background: #059669; }
  @media print {
    body { padding: 0; }
    .actions { display: none; }
    .header { page-break-after: avoid; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div>
      <h1>Aegis Statement</h1>
      <div class="sub">Period: ${periodLabel} · Generated ${fmtDate(now.toISOString())}</div>
    </div>
    <div class="meta">
      <div>Offline Aegis</div>
      <div>Private · On-device</div>
    </div>
  </div>

  <div class="summary">
    <div class="card credit">
      <div class="label">Total Credited</div>
      <div class="value">${fmt(credited)}</div>
    </div>
    <div class="card debit">
      <div class="label">Total Debited</div>
      <div class="value">${fmt(debited)}</div>
    </div>
    <div class="card net">
      <div class="label">Net</div>
      <div class="value">${fmt(credited - debited)}</div>
    </div>
  </div>

  <h2>Spending by Category</h2>
  <table>
    <thead>
      <tr><th>Category</th><th class="num">Amount</th><th class="num">Count</th><th class="num">% of Spend</th></tr>
    </thead>
    <tbody>
      ${catRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No spending data</td></tr>'}
    </tbody>
  </table>

  <h2>Transactions (${txs.length})</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Merchant</th><th>Bank</th><th>Category</th><th>Amount</th><th>Balance</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No transactions in this period</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Generated by Aegis · Your SMS never leaves your device · ${txs.length} transactions · ${breakdown.length} categories
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return new NextResponse(
      `<html><body><h1>Error</h1><pre>${esc(e instanceof Error ? e.message : String(e))}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}

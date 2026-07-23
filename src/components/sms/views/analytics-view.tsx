"use client";

import { useDashboard, useTransactions } from "../use-sms-data";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  IndianRupee,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatINR, formatINRShort } from "../format";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { useState } from "react";
import { ScreenGuideCard } from "../screen-guide-card";

export function AnalyticsView() {
  const [period, setPeriod] = useState<"month" | "all">("month");
  const dashboardQ = useDashboard(period);
  const txsQ = useTransactions("verified");

  const data = dashboardQ.data;
  const txs = txsQ.data ?? [];

  // Compute category breakdown
  const categoryData = data?.categoryBreakdown ?? [];
  const topMerchants = data?.topMerchants ?? [];
  const dailyTrend = data?.dailyTrend ?? [];
  const totalCatAmount = categoryData.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-5">
      <ScreenGuideCard viewKey="analytics" />
      {/* Page header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Analytics</h2>
            <p className="text-xs text-muted-foreground">
              Spending insights, category breakdown, and trends.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
          {(["month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "month" ? "This Month" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<ArrowDownLeft className="h-4 w-4" />}
          label="Credited"
          value={dashboardQ.isLoading ? "—" : formatINRShort(data?.credited ?? 0)}
          sub={`${data?.creditCount ?? 0} transactions`}
          tone="emerald"
        />
        <KpiCard
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Debited"
          value={dashboardQ.isLoading ? "—" : formatINRShort(data?.debited ?? 0)}
          sub={`${data?.debitCount ?? 0} transactions`}
          tone="rose"
        />
        <KpiCard
          icon={<Scale className="h-4 w-4" />}
          label="Net"
          value={dashboardQ.isLoading ? "—" : formatINRShort(data?.net ?? 0)}
          sub={(data?.net ?? 0) >= 0 ? "Surplus" : "Deficit"}
          tone={(data?.net ?? 0) >= 0 ? "emerald" : "rose"}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg Txn"
          value={dashboardQ.isLoading ? "—" : formatINRShort(
            (data?.creditCount ?? 0) + (data?.debitCount ?? 0) > 0
              ? ((data?.credited ?? 0) + (data?.debited ?? 0)) / ((data?.creditCount ?? 0) + (data?.debitCount ?? 0))
              : 0
          )}
          sub="Per transaction"
          tone="primary"
        />
      </div>

      {/* Category breakdown */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Spending by Category</h3>
        </div>
        {dashboardQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg shimmer" />
            ))}
          </div>
        ) : categoryData.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No spending data for this period.
          </p>
        ) : (
          <div className="space-y-3">
            {categoryData.slice(0, 8).map((cat) => {
              const catDef = CATEGORIES[(cat.key as CategoryKey) ?? "other"];
              const pct = totalCatAmount > 0 ? Math.round((cat.amount / totalCatAmount) * 100) : 0;
              return (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: catDef?.hex ?? "#94a3b8" }}
                      />
                      {catDef?.label ?? cat.key}
                      <span className="text-muted-foreground">({cat.count})</span>
                    </span>
                    <span className="tabular-nums font-medium">{formatINR(cat.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: catDef?.hex ?? "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Two-column: Top merchants + Daily trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top merchants */}
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Top Merchants</h3>
          </div>
          {dashboardQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg shimmer" />
              ))}
            </div>
          ) : topMerchants.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No merchant data.</p>
          ) : (
            <ul className="space-y-2">
              {topMerchants.slice(0, 6).map((m, i) => {
                const catDef = CATEGORIES[(m.category as CategoryKey) ?? "other"];
                const maxAmount = topMerchants[0]?.amount || 1;
                const pct = Math.round((m.amount / maxAmount) * 100);
                return (
                  <li key={m.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                          {i + 1}
                        </span>
                        <span className="truncate font-medium">{m.name}</span>
                        <Badge variant="outline" className={cn("shrink-0 text-[9px]", catDef?.badge)}>
                          {catDef?.label}
                        </Badge>
                      </span>
                      <span className="shrink-0 tabular-nums font-medium">{formatINR(m.amount)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground">{m.count} transactions</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Daily trend */}
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Daily Spending Trend</h3>
          </div>
          {dashboardQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg shimmer" />
              ))}
            </div>
          ) : dailyTrend.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No trend data.</p>
          ) : (
            <DailyTrendChart data={dailyTrend} />
          )}
        </Card>
      </div>

      {/* Credit vs Debit summary */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Income vs Expenses</h3>
        </div>
        {!data ? (
          <div className="h-32 rounded-lg shimmer" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Income</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatINR(data.credited)}
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${data.credited + data.debited > 0 ? (data.credited / (data.credited + data.debited)) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Expenses</p>
                  <p className="text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {formatINR(data.debited)}
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-700"
                  style={{ width: `${data.credited + data.debited > 0 ? (data.debited / (data.credited + data.debited)) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// =====================================================
//  KPI Card
// =====================================================
function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "emerald" | "amber" | "rose" | "muted";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-3 sm:p-4 card-hover">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={cn("grid h-7 w-7 place-items-center rounded-lg", tones[tone])}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</p>}
    </Card>
  );
}

// =====================================================
//  Daily Trend Mini Bar Chart (pure SVG)
// =====================================================
function DailyTrendChart({ data }: { data: { date: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  const chartHeight = 120;
  const barWidth = Math.max(4, Math.floor(200 / data.length) - 2);

  return (
    <div>
      <svg viewBox={`0 0 220 ${chartHeight + 20}`} className="w-full" preserveAspectRatio="none" style={{ maxHeight: 140 }}>
        {/* Bars */}
        {data.map((d, i) => {
          const h = (d.amount / max) * chartHeight;
          const x = i * (220 / data.length) + (220 / data.length - barWidth) / 2;
          const y = chartHeight - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={1.5}
                className="fill-primary"
                opacity={0.3 + 0.7 * (d.amount / max)}
              />
            </g>
          );
        })}
        {/* Baseline */}
        <line x1="0" y1={chartHeight} x2="220" y2={chartHeight} className="stroke-border" strokeWidth="0.5" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>{data.length > 0 ? new Date(data[0].date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</span>
        <span>{data.length > 0 ? new Date(data[data.length - 1].date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Peak: {formatINRShort(max)} · {data.length} days
      </p>
    </div>
  );
}

"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Receipt,
  FileText,
  TrendingUp,
  Brain,
  Inbox,
  Landmark,
  Target,
  Repeat2,
  ShieldAlert,
  ChevronRight,
  Upload,
  Activity,
  Volume2,
  Wallet,
  CalendarClock,
  IndianRupee,
  PiggyBank,
  Flame,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Zap,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Lock,
} from "lucide-react";
import type { TxRow } from "../use-sms-data";
import { useDashboard, useLoans, useBudgets, useGoals, useRecurring } from "../use-sms-data";
import { useInbox } from "../use-intelligence";
import { detectOtp, blurOtp } from "@/lib/sms/otp-detector";
import { formatINR, formatINRShort, formatDateShort, parseExtra } from "../format";
import { DocumentsSection } from "../documents-section";
import { ScreenGuideCard } from "../screen-guide-card";
import { cn } from "@/lib/utils";
import type { ViewKey } from "../sidebar";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";

const TX_PREVIEW_COUNT = 3;

export function DashboardView({
  onNavigate,
  onNavigateToThread,
  onSelectTx,
  onSpeak,
  onExport,
  muted,
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
}: {
  onNavigate: (v: ViewKey) => void;
  onNavigateToThread?: (sender: string) => void;
  onSelectTx: (tx: TxRow) => void;
  onSpeak: (tx: TxRow) => void;
  onExport: () => void;
  muted: boolean;
  period: "day" | "week" | "month" | "all" | "custom";
  setPeriod: (p: "day" | "week" | "month" | "all" | "custom") => void;
  customFrom: string;
  setCustomFrom: (s: string) => void;
  customTo: string;
  setCustomTo: (s: string) => void;
}) {
  const dashboardQ = useDashboard(period, customFrom || undefined, customTo || undefined);
  const loansQ = useLoans();
  const budgetsQ = useBudgets();
  const goalsQ = useGoals();
  const recurringQ = useRecurring();

  const data = dashboardQ.data;
  const loading = dashboardQ.isLoading;
  const [txExpanded, setTxExpanded] = useState(false);

  // Activity tracking metrics
  const activeLoans = loansQ.data?.loans.filter(l => l.status === "active" || l.status === "overdue").length ?? 0;
  const totalMonthlyEmi = loansQ.data?.loans
    .filter(l => l.status === "active" || l.status === "overdue")
    .reduce((s, l) => s + (l.emiAmount ?? 0), 0) ?? 0;
  const upcomingEmis = loansQ.data?.upcoming ?? [];
  const nextEmi = upcomingEmis[0];
  const overBudgetCount = budgetsQ.data?.budgets.filter(b => b.over).length ?? 0;
  const activeGoals = goalsQ.data?.goals.filter(g => g.status === "active").length ?? 0;
  const recurringCount = recurringQ.data?.count ?? 0;
  const recurringMonthly = recurringQ.data?.monthlyTotal ?? 0;

  const PERIODS = [
    { id: "day" as const, label: "Today" },
    { id: "week" as const, label: "Week" },
    { id: "month" as const, label: "Month" },
    { id: "all" as const, label: "All" },
    { id: "custom" as const, label: "Custom" },
  ];

  return (
    <div className="space-y-5">
      {/* Header + period */}
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div className="flex items-center gap-2">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-sparkle" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
            <p className="text-[11px] text-muted-foreground">
              {data ? `${data.creditCount + data.debitCount} transactions · ${data.flaggedCount + data.unverifiedCount} alerts` : "Loading…"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-sm">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  period === p.id
                    ? "bg-primary text-primary-foreground shadow-sm scale-105"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 shadow-sm">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-transparent text-xs outline-none" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-transparent text-xs outline-none" />
            </div>
          )}
        </div>
      </div>

      <ScreenGuideCard viewKey="dashboard" />

      {/* Core financial summary — 3 animated cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Credited"
          value={data ? formatINR(data.credited) : "—"}
          count={data?.creditCount}
          tone="credit"
          icon={<ArrowDownLeft className="h-4 w-4" />}
          loading={loading}
          onClick={() => onNavigate("transactions")}
          index={0}
        />
        <SummaryCard
          label="Debited"
          value={data ? formatINR(data.debited) : "—"}
          count={data?.debitCount}
          tone="debit"
          icon={<ArrowUpRight className="h-4 w-4" />}
          loading={loading}
          onClick={() => onNavigate("transactions")}
          index={1}
        />
        <SummaryCard
          label="Net Surplus"
          value={data ? formatINR(data.net) : "—"}
          sub={data && data.net >= 0 ? "Surplus" : "Deficit"}
          tone={data && data.net >= 0 ? "credit" : "debit"}
          icon={<Scale className="h-4 w-4" />}
          loading={loading}
          onClick={() => onNavigate("analytics")}
          index={2}
        />
      </div>

      {/* Activity Tracking Grid — quick stats */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Activity Tracking
          </h3>
          <span className="text-[10px] text-muted-foreground">Click any card to view details</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ActivityCard
            icon={<Landmark className="h-3.5 w-3.5" />}
            label="Active Loans"
            value={loading ? "—" : String(activeLoans)}
            sub={totalMonthlyEmi > 0 ? `${formatINRShort(totalMonthlyEmi)}/mo` : "—"}
            tone="amber"
            onClick={() => onNavigate("loans")}
            index={0}
          />
          <ActivityCard
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Next EMI"
            value={nextEmi ? formatNextDue(nextEmi.nextDue) : "None"}
            sub={nextEmi ? formatINRShort(nextEmi.emiAmount ?? 0) : "—"}
            tone={nextEmi?.overdue ? "rose" : "amber"}
            onClick={() => onNavigate("loans")}
            index={1}
          />
          <ActivityCard
            icon={<Flame className="h-3.5 w-3.5" />}
            label="Over Budget"
            value={loading ? "—" : String(overBudgetCount)}
            sub={overBudgetCount > 0 ? "Action needed" : "On track"}
            tone={overBudgetCount > 0 ? "rose" : "emerald"}
            onClick={() => onNavigate("budgets")}
            index={2}
          />
          <ActivityCard
            icon={<PiggyBank className="h-3.5 w-3.5" />}
            label="Active Goals"
            value={loading ? "—" : String(activeGoals)}
            sub="Saving"
            tone="emerald"
            onClick={() => onNavigate("budgets")}
            index={3}
          />
          <ActivityCard
            icon={<Repeat2 className="h-3.5 w-3.5" />}
            label="Recurring"
            value={loading ? "—" : String(recurringCount)}
            sub={recurringMonthly > 0 ? `${formatINRShort(recurringMonthly)}/mo` : "—"}
            tone="primary"
            onClick={() => onNavigate("recurring")}
            index={4}
          />
          <ActivityCard
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            label="Security"
            value={data ? String(data.flaggedCount + data.unverifiedCount) : "—"}
            sub={data && (data.flaggedCount + data.unverifiedCount) > 0 ? "Alerts" : "Safe"}
            tone={data && (data.flaggedCount + data.unverifiedCount) > 0 ? "rose" : "emerald"}
            onClick={() => onNavigate("security")}
            index={5}
          />
        </div>
      </div>

      {/* Recent transactions + Document upload */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent transactions (2/3 width) */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden card-hover">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Recent Transactions</h3>
                {data && (
                  <Badge variant="secondary" className="text-[10px]">
                    {data.creditCount + data.debitCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {data && data.recent.length > TX_PREVIEW_COUNT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTxExpanded(!txExpanded)}
                    className="gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    {txExpanded ? "Show Less" : `+${data.recent.length - TX_PREVIEW_COUNT} more`}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", txExpanded && "rotate-180")} />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onNavigate("transactions")} className="gap-1 text-xs text-muted-foreground hover:text-primary">
                  View All
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg shimmer" />
                ))}
              </div>
            ) : !data?.recent?.length ? (
              <div className="px-6 py-10 text-center text-xs text-muted-foreground">
                No transactions yet. Paste an SMS to get started.
              </div>
            ) : (
              <div className={cn("overflow-y-auto scrollbar-thin", txExpanded ? "max-h-[28rem]" : "max-h-80")}>
                <ul className="divide-y">
                  {(txExpanded ? data.recent : data.recent.slice(0, TX_PREVIEW_COUNT)).map((tx, i) => (
                    <TxMiniRow key={tx.id} tx={tx} index={i} onClick={() => onSelectTx(tx)} onSpeak={() => onSpeak(tx)} muted={muted} />
                  ))}
                </ul>
                {!txExpanded && data.recent.length > TX_PREVIEW_COUNT && (
                  <button
                    onClick={() => setTxExpanded(true)}
                    className="flex w-full items-center justify-center gap-1.5 border-t bg-muted/20 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-primary"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    Show all {data.recent.length} transactions
                  </button>
                )}
                {txExpanded && data.recent.length > TX_PREVIEW_COUNT && (
                  <button
                    onClick={() => setTxExpanded(false)}
                    className="flex w-full items-center justify-center gap-1.5 border-t bg-muted/20 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-primary"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Show less
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Document upload (1/3 width) */}
        <div>
          <DocumentsSection />
        </div>
      </div>

      {/* Collapsible Messages Feed Container */}
      <RecentMessagesFeed onNavigate={onNavigate} onNavigateToThread={onNavigateToThread} />

      {/* Quick Navigation — large clickable tiles */}
      <div>
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Quick Access
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <NavTile
            icon={<BarChart3 className="h-5 w-5" />}
            label="Analytics"
            description="Charts & insights"
            tone="primary"
            onClick={() => onNavigate("analytics")}
            index={0}
          />
          <NavTile
            icon={<Brain className="h-5 w-5" />}
            label="Ask AI"
            description="Query your data"
            tone="violet"
            onClick={() => onNavigate("intelligence")}
            index={1}
          />
          <NavTile
            icon={<Inbox className="h-5 w-5" />}
            label="SMS Inbox"
            description={`${data ? data.creditCount + data.debitCount + data.flaggedCount : 0} messages`}
            tone="primary"
            onClick={() => onNavigate("inbox")}
            index={2}
          />
          <NavTile
            icon={<FileText className="h-5 w-5" />}
            label="Documents"
            description="Upload & extract"
            tone="emerald"
            onClick={() => onNavigate("documents")}
            index={3}
          />
        </div>
      </div>

      {/* Upcoming EMIs preview — if any */}
      {upcomingEmis.length > 0 && (
        <Card className="overflow-hidden animate-fade-up">
          <div className="flex items-center justify-between gap-2 border-b bg-amber-500/5 px-5 py-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold">Upcoming EMIs</h3>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                {upcomingEmis.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("loans")} className="gap-1 text-xs text-muted-foreground hover:text-primary">
              View All
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <ul className="divide-y">
            {upcomingEmis.slice(0, 3).map((emi, i) => (
              <li
                key={emi.id}
                className="flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/30 animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => onNavigate("loans")}
              >
                <div className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  emi.overdue ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}>
                  <Landmark className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{emi.lender}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Due day {emi.dueDay} · {emi.overdue ? "Overdue" : "Upcoming"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatINRShort(emi.emiAmount ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatNextDue(emi.nextDue)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// --- Sub-components ---

function SummaryCard({
  label,
  value,
  count,
  sub,
  tone,
  icon,
  loading,
  onClick,
  index,
}: {
  label: string;
  value: string;
  count?: number;
  sub?: string;
  tone: "credit" | "debit";
  icon: React.ReactNode;
  loading: boolean;
  onClick: () => void;
  index: number;
}) {
  const toneCls = tone === "credit"
    ? "from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
    : "from-rose-500/10 to-rose-500/5 text-rose-700 dark:text-rose-300 border-rose-500/20";
  const iconCls = tone === "credit"
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
    : "bg-rose-500/15 text-rose-600 dark:text-rose-300";

  return (
    <Card
      className={cn(
        "relative overflow-hidden border bg-gradient-to-br p-5 transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer animate-fade-up group",
        toneCls
      )}
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</p>
          {loading ? (
            <div className="h-8 w-32 rounded-md shimmer" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums sm:text-3xl animate-count-up">{value}</p>
          )}
          <div className="flex items-center gap-2 pt-1 text-xs opacity-75">
            {count !== undefined && <span>{count} transactions</span>}
            {sub && <span>{sub}</span>}
          </div>
        </div>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110", iconCls)}>
          {icon}
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-current opacity-[0.04] blur-2xl" />
      <ChevronRight className="absolute right-3 top-3 h-4 w-4 opacity-30 transition-opacity group-hover:opacity-70 group-hover:translate-x-0.5" />
    </Card>
  );
}

function ActivityCard({
  icon,
  label,
  value,
  sub,
  tone,
  onClick,
  index,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "amber" | "emerald" | "rose" | "violet";
  onClick: () => void;
  index: number;
}) {
  const toneCls = {
    primary: "bg-primary/8 text-primary hover:bg-primary/12 hover:border-primary/30",
    amber: "bg-amber-500/8 text-amber-700 dark:text-amber-300 hover:bg-amber-500/12 hover:border-amber-500/30",
    emerald: "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/12 hover:border-emerald-500/30",
    violet: "bg-violet-500/8 text-violet-700 dark:text-violet-300 hover:bg-violet-500/12 hover:border-violet-500/30",
    rose: "bg-rose-500/8 text-rose-700 dark:text-rose-300 hover:bg-rose-500/12 hover:border-rose-500/30",
  }[tone];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up",
        toneCls
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-base font-bold tabular-nums">{value}</span>
      <span className="text-[9px] text-muted-foreground truncate">{sub}</span>
    </button>
  );
}

function NavTile({
  icon,
  label,
  description,
  tone,
  onClick,
  index,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  tone: "primary" | "amber" | "emerald" | "violet" | "rose";
  onClick: () => void;
  index: number;
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[tone];

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:shadow-lg hover:-translate-y-1 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110", toneCls)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-30 transition-all group-hover:opacity-70 group-hover:translate-x-1" />
    </button>
  );
}

function TxMiniRow({
  tx,
  index,
  onClick,
  onSpeak,
  muted,
}: {
  tx: TxRow;
  index: number;
  onClick: () => void;
  onSpeak: () => void;
  muted: boolean;
}) {
  const isCredit = tx.type === "credit";
  const extra = parseExtra(tx.extra);

  return (
    <li
      className="group flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
      onClick={onClick}
    >
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 transition-transform group-hover:scale-110",
          isCredit
            ? "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300"
            : "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-300"
        )}
      >
        {isCredit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.merchant || (extra.lender as string) || tx.bank || "Transaction"}</p>
        <p className="text-[10px] text-muted-foreground">{tx.bank || tx.senderType} · {formatDateShort(tx.txDate)}</p>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {isCredit ? "+" : "−"} {formatINR(tx.amount)}
      </span>
      {!muted && (
        <button
          onClick={(e) => { e.stopPropagation(); onSpeak(); }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
          title="Speak"
        >
          <Volume2 className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}

function formatNextDue(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 1) return "Tomorrow";
  if (days < 7) return `in ${days}d`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function RecentMessagesFeed({
  onNavigate,
  onNavigateToThread,
}: {
  onNavigate: (v: ViewKey) => void;
  onNavigateToThread?: (sender: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const inboxQ = useInbox({});
  const messages = inboxQ.data?.messages ?? [];
  const total = inboxQ.data?.total ?? 0;

  const handleItemClick = (sender: string) => {
    if (onNavigateToThread) {
      onNavigateToThread(sender);
    } else {
      onNavigate("inbox");
    }
  };

  return (
    <Card className="overflow-hidden card-hover animate-fade-up">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Messages Feed</h3>
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {total}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            {collapsed ? "Expand" : "Collapse"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("inbox")}
            className="gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            Open Inbox
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div>
          {inboxQ.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg shimmer" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="px-6 py-8 text-center text-xs text-muted-foreground">
              No messages found. Paste or compose an SMS to populate your inbox feed.
            </div>
          ) : (
            <ul className="divide-y max-h-72 overflow-y-auto scrollbar-thin">
              {messages.slice(0, 5).map((msg) => {
                const otpRes = detectOtp(msg.rawText);
                const senderName = msg.sender ?? "Unknown";
                const isOtp = otpRes.isOtp;
                const displayText = isOtp ? blurOtp(msg.rawText) : msg.rawText;
                const dateStr = new Date(msg.receivedAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <li
                    key={msg.id}
                    onClick={() => handleItemClick(senderName)}
                    className="group flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary group-hover:scale-105 transition-transform">
                      {senderName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">{senderName}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{dateStr}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground mt-0.5">{displayText}</p>
                    </div>
                    {isOtp && (
                      <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> OTP
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-30 group-hover:opacity-80 transition-opacity" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}


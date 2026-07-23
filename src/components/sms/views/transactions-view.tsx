"use client";

import { useMemo, useState } from "react";
import { useTransactions, useRecurring, type TxRow, useDashboard } from "../use-sms-data";
import { RecentTransactions } from "../recent-transactions";
import { RecurringPayments } from "../recurring-payments";
import {
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Repeat2,
  Search,
  LayoutGrid,
  List as ListIcon,
  Download,
  TrendingUp,
  CalendarClock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowDownLeft as ArrowIn,
  ArrowUpRight as ArrowOut,
  Volume2,
  StickyNote,
  Tag,
} from "lucide-react";
import { formatINR, formatINRShort, formatDateShort, parseExtra } from "../format";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { parseTags, allTags } from "@/lib/sms/tags";
import { cn } from "@/lib/utils";
import { ScreenGuideCard } from "../screen-guide-card";

type Filter = "all" | "credit" | "debit";
type ViewMode = "list" | "card";

export function TransactionsView({
  onSelectTx,
  onSpeak,
  onExport,
  muted,
}: {
  onSelectTx: (tx: TxRow) => void;
  onSpeak: (tx: TxRow) => void;
  onExport: () => void;
  muted: boolean;
}) {
  const txsQ = useTransactions("verified");
  const recurringQ = useRecurring();
  const dashboardQ = useDashboard("month");

  const txs = txsQ.data ?? [];
  const recurring = recurringQ.data;

  // ---- KPIs ----
  const credited = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const debited = txs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const creditCount = txs.filter((t) => t.type === "credit").length;
  const debitCount = txs.filter((t) => t.type === "debit").length;
  const recurringMonthly = recurring?.monthlyTotal ?? 0;
  const recurringCount = recurring?.count ?? 0;

  return (
    <div className="space-y-5">
      <ScreenGuideCard viewKey="transactions" />
      {/* Page header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Transactions</h2>
            <p className="text-xs text-muted-foreground">
              All verified transactions with search, filter, and recurring detection.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<ArrowDownLeft className="h-4 w-4" />}
          label="Credited"
          value={txsQ.isLoading ? "—" : formatINRShort(credited)}
          sub={txsQ.isLoading ? "" : `${creditCount} transactions`}
          tone="emerald"
        />
        <KpiCard
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Debited"
          value={txsQ.isLoading ? "—" : formatINRShort(debited)}
          sub={txsQ.isLoading ? "" : `${debitCount} transactions`}
          tone="rose"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Net"
          value={txsQ.isLoading ? "—" : formatINRShort(credited - debited)}
          sub={credited - debited >= 0 ? "Surplus" : "Deficit"}
          tone={credited - debited >= 0 ? "emerald" : "rose"}
        />
        <KpiCard
          icon={<Repeat2 className="h-4 w-4" />}
          label="Recurring"
          value={recurringQ.isLoading ? "—" : formatINRShort(recurringMonthly)}
          sub={recurringQ.isLoading ? "" : `${recurringCount} subscriptions`}
          tone="amber"
        />
      </div>

      {/* Transactions list */}
      <RecentTransactions
        data={txsQ.data}
        loading={txsQ.isLoading}
        onSelect={onSelectTx}
        onSpeak={onSpeak}
        muted={muted}
        onExport={onExport}
      />

      {/* Recurring payments */}
      <RecurringPayments data={recurringQ.data} loading={recurringQ.isLoading} />
    </div>
  );
}

// =====================================================
//  KPI Card (shared)
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

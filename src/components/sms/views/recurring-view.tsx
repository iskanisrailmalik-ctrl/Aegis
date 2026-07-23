"use client";

import { useRecurring, useSaveBudget } from "../use-sms-data";
import { RecurringPayments } from "../recurring-payments";
import {
  Repeat2,
  CalendarClock,
  TrendingDown,
  Wallet,
  Sparkles,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatINRShort } from "../format";
import { ScreenGuideCard } from "../screen-guide-card";

export function RecurringView() {
  const recurringQ = useRecurring();
  const data = recurringQ.data;
  const groups = data?.groups ?? [];
  const monthlyTotal = data?.monthlyTotal ?? 0;
  const count = data?.count ?? 0;

  // Compute additional stats
  const weeklyCount = groups.filter((g) => g.frequency === "weekly").length;
  const monthlyCount = groups.filter((g) => g.frequency === "monthly").length;
  const nextPredicted = groups
    .map((g) => g.nextPredicted)
    .filter(Boolean)
    .sort((a, b) => new Date(a!).getTime() - new Date(b!).getTime())[0];

  return (
    <div className="space-y-5">
      <ScreenGuideCard viewKey="recurring" />
      {/* Page header */}
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Repeat2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Recurring Payments</h2>
          <p className="text-xs text-muted-foreground">
            Subscriptions and repeating transactions detected from your history.
          </p>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Repeat2 className="h-4 w-4" />}
          label="Recurring"
          value={recurringQ.isLoading ? "—" : String(count)}
          sub={`${monthlyCount} monthly · ${weeklyCount} weekly`}
          tone="primary"
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Monthly Total"
          value={recurringQ.isLoading ? "—" : formatINRShort(monthlyTotal)}
          sub="Estimated burden"
          tone="rose"
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Next Due"
          value={recurringQ.isLoading ? "—" : nextPredicted ? formatNextDate(nextPredicted) : "None"}
          sub={nextPredicted ? "Upcoming payment" : "All caught up"}
          tone="amber"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Avg / Month"
          value={recurringQ.isLoading ? "—" : count > 0 ? formatINRShort(monthlyTotal / Math.max(count, 1)) : "—"}
          sub="Per subscription"
          tone="emerald"
        />
      </div>

      {/* Recurring payments list */}
      <RecurringPayments data={data} loading={recurringQ.isLoading} />
    </div>
  );
}

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

function formatNextDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `in ${days}d`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

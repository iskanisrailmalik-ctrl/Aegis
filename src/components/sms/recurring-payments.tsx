"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Repeat2,
  CalendarClock,
  TrendingDown,
  Sparkles,
  Target,
} from "lucide-react";
import type { RecurringGroup } from "./use-sms-data";
import { formatINR, formatINRShort, formatDay } from "./format";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { useSaveBudget } from "./use-sms-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FREQ_LABEL: Record<RecurringGroup["frequency"], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  irregular: "Irregular",
};

const FREQ_STYLE: Record<RecurringGroup["frequency"], string> = {
  weekly: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  monthly: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  irregular: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function RecurringPayments({
  data,
  loading,
}: {
  data?: { groups: RecurringGroup[]; monthlyTotal: number; count: number };
  loading: boolean;
}) {
  const groups = data?.groups ?? [];
  const monthlyTotal = data?.monthlyTotal ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Repeat2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">
            Recurring Payments
          </h2>
        </div>
        {groups.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {groups.length}
            </Badge>
            {monthlyTotal > 0 && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300"
              >
                ~{formatINRShort(monthlyTotal)}/mo
              </Badge>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg shimmer" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground max-w-[18rem]">
            No recurring payments detected yet. Subscriptions and repeating
            debits will appear here once detected from your transaction history.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-80">
          <ul className="divide-y">
            {groups.map((g, i) => (
              <RecurringRow key={g.key} group={g} index={i} />
            ))}
          </ul>
        </ScrollArea>
      )}
    </Card>
  );
}

function RecurringRow({ group, index }: { group: RecurringGroup; index: number }) {
  const catDef = CATEGORIES[(group.category as CategoryKey) ?? "other"];
  const hasPrediction = Boolean(group.nextPredicted);
  const saveBudgetMut = useSaveBudget();

  const suggestBudget = group.frequency === "monthly" && group.category;

  const onCreateBudget = async () => {
    if (!group.category) return;
    // Suggest a budget slightly above the recurring amount (round up to nearest 100)
    const suggested = Math.ceil((group.amount * 1.1) / 100) * 100;
    try {
      await saveBudgetMut.mutateAsync({ category: group.category, amount: suggested });
      toast.success(`Budget created for ${catDef?.label ?? group.category}`, {
        description: `${formatINR(suggested)}/month (10% above ${formatINR(group.amount)} recurring).`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <li
      className="group flex items-center gap-3 px-5 py-3 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1",
          hasPrediction
            ? "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-300"
            : "bg-muted text-muted-foreground ring-muted"
        )}
      >
        <Repeat2 className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{group.merchant}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            {group.count}× {formatINR(group.amount)}
          </span>
          {group.avgDaysBetween && (
            <span className="opacity-70">· ~{group.avgDaysBetween}d gap</span>
          )}
          <span className="opacity-70">· last {formatDay(group.lastDate)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge
          variant="outline"
          className={cn("rounded-full px-2 py-0 text-[10px]", FREQ_STYLE[group.frequency])}
        >
          {FREQ_LABEL[group.frequency]}
        </Badge>
        <div className="flex items-center gap-1.5">
          {group.nextPredicted && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarClock className="h-2.5 w-2.5" />
              next {formatDay(group.nextPredicted)}
            </span>
          )}
          {suggestBudget && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCreateBudget}
              disabled={saveBudgetMut.isPending}
              className="h-5 gap-1 px-1.5 text-[9px] text-violet-600 opacity-0 transition-opacity hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-300 group-hover:opacity-100"
              title={`Create a ${formatINR(Math.ceil((group.amount * 1.1) / 100) * 100)}/month budget for ${catDef?.label}`}
            >
              <Target className="h-2.5 w-2.5" />
              Budget
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

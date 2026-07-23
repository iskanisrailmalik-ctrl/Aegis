"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Target, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BudgetRow } from "./use-sms-data";
import { useSaveBudget, useDeleteBudget } from "./use-sms-data";
import { formatINR, formatINRShort } from "./format";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function BudgetsSection({
  data,
  loading,
}: {
  data?: { budgets: BudgetRow[] };
  loading: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const delMut = useDeleteBudget();

  const budgets = data?.budgets ?? [];
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overCount = budgets.filter((b) => b.over).length;

  const onDelete = async (id: string) => {
    try {
      await delMut.mutateAsync(id);
      toast.success("Budget removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">
            Monthly Budgets
          </h2>
          {budgets.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {budgets.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="h-7 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Budget
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg shimmer" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No budgets set</p>
          <p className="max-w-[18rem] text-xs text-muted-foreground">
            Set monthly spending limits per category to track your spending
            against goals and get alerts when you exceed them.
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {/* summary */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Budget
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {formatINR(totalSpent)}{" "}
                <span className="text-muted-foreground">/ {formatINR(totalBudget)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Over budget
              </p>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  overCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {overCount} / {budgets.length}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {budgets.map((b, i) => (
              <BudgetRowItem
                key={b.id}
                budget={b}
                index={i}
                onDelete={() => onDelete(b.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <AddBudgetDialog open={showAdd} onOpenChange={setShowAdd} />
    </Card>
  );
}

function BudgetRowItem({
  budget,
  index,
  onDelete,
}: {
  budget: BudgetRow;
  index: number;
  onDelete: () => void;
}) {
  const catDef = CATEGORIES[(budget.category as CategoryKey) ?? "other"];
  const pct = budget.pct;
  const barColor = budget.over
    ? "bg-rose-500"
    : pct >= 80
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <li
      className="group rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0 text-[9px] font-medium",
            catDef?.badge
          )}
        >
          {catDef?.label ?? budget.category}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {budget.over ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3 w-3" />
              Over by {formatINRShort(Math.abs(budget.remaining))}
            </span>
          ) : budget.remaining < budget.amount * 0.2 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {formatINRShort(budget.remaining)} left
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {formatINRShort(budget.remaining)} left
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">
          {formatINR(budget.spent)} spent
        </span>
        <span className="tabular-nums font-medium">
          {pct}%
        </span>
        <span className="tabular-nums text-muted-foreground">
          of {formatINR(budget.amount)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </li>
  );
}

function AddBudgetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const saveMut = useSaveBudget();
  const [category, setCategory] = useState<CategoryKey>("food");
  const [amount, setAmount] = useState("");

  const reset = () => {
    setCategory("food");
    setAmount("");
  };

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await saveMut.mutateAsync({ category, amount: amt });
      toast.success(`Budget set for ${CATEGORIES[category].label}`);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent aria-describedby={undefined} className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Set Monthly Budget
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CATEGORIES)
                  .filter((c) => c.key !== "salary" && c.key !== "transfer" && c.key !== "other")
                  .map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Monthly limit (₹)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              You'll see progress and alerts as you spend against this limit each month.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



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
import {
  Target,
  Plus,
  Trash2,
  Trophy,
  CalendarClock,
  TrendingUp,
  Banknote,
  CreditCard,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import type { GoalRow } from "./use-sms-data";
import { useSaveGoal, useDeleteGoal, useAddMilestone } from "./use-sms-data";
import { formatINR, formatINRShort } from "./format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<GoalRow["goalType"], string> = {
  savings: "Savings",
  income: "Income",
  debt: "Debt Payoff",
};

const TYPE_ICON: Record<GoalRow["goalType"], React.ReactNode> = {
  savings: <TrendingUp className="h-3.5 w-3.5" />,
  income: <Banknote className="h-3.5 w-3.5" />,
  debt: <CreditCard className="h-3.5 w-3.5" />,
};

const TYPE_STYLE: Record<GoalRow["goalType"], string> = {
  savings: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  income: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  debt: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const BAR_COLOR: Record<GoalRow["goalType"], string> = {
  savings: "bg-emerald-500",
  income: "bg-sky-500",
  debt: "bg-rose-500",
};

export function GoalsSection({
  data,
  loading,
}: {
  data?: { goals: GoalRow[] };
  loading: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const delMut = useDeleteGoal();

  const goals = data?.goals ?? [];
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.completed);

  const onDelete = async (id: string) => {
    try {
      await delMut.mutateAsync(id);
      toast.success("Goal deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Savings Goals</h2>
          {goals.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {goals.length}
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
          Add Goal
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg shimmer" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No goals set</p>
          <p className="max-w-[20rem] text-xs text-muted-foreground">
            Set a savings, income, or debt-payoff target to track your progress
            over time. Goals auto-compute from your transaction history.
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {/* completed count strip */}
          {completedGoals.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              <Trophy className="h-3.5 w-3.5" />
              <span className="font-medium">
                {completedGoals.length} goal{completedGoals.length > 1 ? "s" : ""} completed! 🎉
              </span>
            </div>
          )}

          <ul className="space-y-2.5">
            {activeGoals.map((g, i) => (
              <GoalRowItem
                key={g.id}
                goal={g}
                index={i}
                onDelete={() => onDelete(g.id)}
              />
            ))}
            {completedGoals
              .filter((g) => g.status === "active")
              .map((g, i) => (
                <GoalRowItem
                  key={g.id}
                  goal={g}
                  index={i + activeGoals.length}
                  onDelete={() => onDelete(g.id)}
                />
              ))}
          </ul>
        </div>
      )}

      <AddGoalDialog open={showAdd} onOpenChange={setShowAdd} />
    </Card>
  );
}

function GoalRowItem({
  goal,
  index,
  onDelete,
}: {
  goal: GoalRow;
  index: number;
  onDelete: () => void;
}) {
  const completed = goal.completed;
  const barColor = BAR_COLOR[goal.goalType];
  const isOverdue = goal.daysLeft !== null && goal.daysLeft < 0 && !completed;

  return (
    <li
      className="group rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0 text-[9px] font-medium",
            TYPE_STYLE[goal.goalType]
          )}
        >
          {TYPE_ICON[goal.goalType]}
          {TYPE_LABEL[goal.goalType]}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{goal.name}</p>
        {completed ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Done
          </span>
        ) : isOverdue ? (
          <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
            {Math.abs(goal.daysLeft!)}d overdue
          </span>
        ) : goal.daysLeft !== null ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            {goal.daysLeft}d left
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete" className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">
          {formatINR(goal.progress)}
          <span className="opacity-60"> / {formatINR(goal.target)}</span>
        </span>
        <span
          className={cn(
            "tabular-nums font-medium",
            completed ? "text-emerald-600 dark:text-emerald-400" : ""
          )}
        >
          {goal.pct}%
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            completed ? "bg-gradient-to-r from-emerald-500 to-teal-400" : barColor
          )}
          style={{ width: `${Math.min(goal.pct, 100)}%` }}
        />
      </div>
      {!completed && goal.remaining > 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatINRShort(goal.remaining)} to go
        </p>
      )}

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t pt-2">
          {goal.milestones.map((m) => (
            <span
              key={m.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[9px] font-medium",
                m.completed
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-muted-foreground/20 bg-muted text-muted-foreground"
              )}
              title={`${m.name}: ${formatINR(m.target)} (${m.pct}%)`}
            >
              {m.completed ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : (
                <MilestoneIcon />
              )}
              {m.name}
              <span className="opacity-60">· {formatINRShort(m.target)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Add milestone quick input */}
      <MilestoneAdder goalId={goal.id} goalTarget={goal.target} />
    </li>
  );
}

function MilestoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-2.5 w-2.5"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function MilestoneAdder({
  goalId,
  goalTarget,
}: {
  goalId: string;
  goalTarget: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const addMut = useAddMilestone();

  const add = async () => {
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) {
      toast.error("Enter milestone name and target");
      return;
    }
    if (t > goalTarget) {
      toast.error("Milestone target can't exceed goal target");
      return;
    }
    try {
      await addMut.mutateAsync({ goalId, name: name.trim(), target: t });
      toast.success("Milestone added");
      setName("");
      setTarget("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-primary"
      >
        <Plus className="h-2.5 w-2.5" />
        Add milestone
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-1.5">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Milestone name"
        className="h-7 flex-1 text-[11px]"
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <Input
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="₹"
        className="h-7 w-20 text-[11px]"
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <Button
        size="sm"
        onClick={add}
        disabled={addMut.isPending}
        className="h-7 px-2 text-[11px]"
      >
        {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
        className="h-7 px-2 text-[11px]"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function AddGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const saveMut = useSaveGoal();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [goalType, setGoalType] = useState<GoalRow["goalType"]>("savings");
  const [deadline, setDeadline] = useState("");

  const reset = () => {
    setName("");
    setTarget("");
    setGoalType("savings");
    setDeadline("");
  };

  const save = async () => {
    const t = parseFloat(target);
    if (!name.trim()) {
      toast.error("Enter a goal name");
      return;
    }
    if (!t || t <= 0) {
      toast.error("Enter a valid target amount");
      return;
    }
    try {
      await saveMut.mutateAsync({
        name: name.trim(),
        target: t,
        goalType,
        deadline: deadline || undefined,
      });
      toast.success(`Goal "${name.trim()}" created`);
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
            New Goal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Goal Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Emergency Fund, Vacation, Debt Free"
              className="h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target Amount (₹) *</Label>
              <Input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="50000"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Goal Type</Label>
              <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalRow["goalType"])}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="income">Income Target</SelectItem>
                  <SelectItem value="debt">Debt Payoff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Deadline (optional)</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {goalType === "savings" && "Progress = net savings (credited − debited) since goal creation."}
              {goalType === "income" && "Progress = total income credited since goal creation."}
              {goalType === "debt" && "Progress = total EMI + bills paid since goal creation."}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



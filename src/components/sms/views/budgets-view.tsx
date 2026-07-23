"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Trophy,
  CalendarClock,
  Banknote,
  CreditCard,
  Loader2,
  X,
  Search,
  PiggyBank,
  IndianRupee,
  Flame,
} from "lucide-react";
import {
  useBudgets,
  useGoals,
  useSaveBudget,
  useDeleteBudget,
  useSaveGoal,
  useDeleteGoal,
  useAddMilestone,
  type BudgetRow,
  type GoalRow,
} from "../use-sms-data";
import { formatINR, formatINRShort } from "../format";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// =====================================================
//  Main Budgets & Goals View
// =====================================================
export function BudgetsView() {
  const budgetsQ = useBudgets();
  const goalsQ = useGoals();
  const [tab, setTab] = useState<"budgets" | "goals">("budgets");

  const budgets = budgetsQ.data?.budgets ?? [];
  const goals = goalsQ.data?.goals ?? [];

  // ---- KPI computations ----
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overCount = budgets.filter((b) => b.over).length;
  const activeGoals = goals.filter((g) => g.status === "active");
  const goalsTarget = activeGoals.reduce((s, g) => s + g.target, 0);
  const goalsProgress = activeGoals.reduce((s, g) => s + g.progress, 0);
  const completedCount = goals.filter((g) => g.completed).length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Budgets & Goals</h2>
          <p className="text-xs text-muted-foreground">
            Set spending limits and savings targets — track progress automatically.
          </p>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Total Budget"
          value={budgetsQ.isLoading ? "—" : formatINRShort(totalBudget)}
          sub={budgets.length > 0 ? `${budgets.length} categories` : "No budgets set"}
          tone="primary"
        />
        <KpiCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="Spent"
          value={budgetsQ.isLoading ? "—" : formatINRShort(totalSpent)}
          sub={totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% of budget` : "—"}
          tone={totalBudget > 0 && totalSpent / totalBudget > 0.8 ? "amber" : "emerald"}
        />
        <KpiCard
          icon={<Flame className="h-4 w-4" />}
          label="Over Budget"
          value={budgetsQ.isLoading ? "—" : String(overCount)}
          sub={overCount > 0 ? "Needs attention" : "All on track"}
          tone={overCount > 0 ? "rose" : "muted"}
        />
        <KpiCard
          icon={<PiggyBank className="h-4 w-4" />}
          label="Active Goals"
          value={goalsQ.isLoading ? "—" : String(activeGoals.length)}
          sub={activeGoals.length > 0 ? `${formatINRShort(goalsProgress)} / ${formatINRShort(goalsTarget)}` : "No goals set"}
          tone="emerald"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "budgets" | "goals")}>
        <div className="flex items-center justify-between gap-2">
          <TabsList className="grid h-9 w-full max-w-xs grid-cols-2">
            <TabsTrigger value="budgets" className="text-xs gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Budgets
              {budgets.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[9px]">{budgets.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="goals" className="text-xs gap-1.5">
              <Target className="h-3.5 w-3.5" />
              Goals
              {goals.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[9px]">{goals.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="budgets" className="mt-4">
          <BudgetsTab data={budgetsQ.data} loading={budgetsQ.isLoading} />
        </TabsContent>
        <TabsContent value="goals" className="mt-4">
          <GoalsTab data={goalsQ.data} loading={goalsQ.isLoading} />
        </TabsContent>
      </Tabs>
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
//  Budgets Tab
// =====================================================
type BudgetFilter = "all" | "ontrack" | "warning" | "over";

function BudgetsTab({
  data,
  loading,
}: {
  data?: { budgets: BudgetRow[] };
  loading: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BudgetFilter>("all");
  const delMut = useDeleteBudget();

  const budgets = data?.budgets ?? [];

  const filtered = useMemo(() => {
    let list = budgets;
    if (filter === "over") list = list.filter((b) => b.over);
    else if (filter === "warning") list = list.filter((b) => !b.over && b.pct >= 80);
    else if (filter === "ontrack") list = list.filter((b) => !b.over && b.pct < 80);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => CATEGORIES[(b.category as CategoryKey) ?? "other"]?.label.toLowerCase().includes(q));
    }
    return list;
  }, [budgets, filter, search]);

  const onDelete = async (id: string) => {
    try {
      await delMut.mutateAsync(id);
      toast.success("Budget removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            {(["all", "ontrack", "warning", "over"] as BudgetFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All" : f === "ontrack" ? "On Track" : f === "warning" ? "Warning" : "Over"}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="h-9 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Budget
          </Button>
        </div>
      </Card>

      {/* Budget cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold">
              {budgets.length > 0 ? "No budgets match your filter" : "No budgets set yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {budgets.length > 0
                ? "Try clearing the search or switching the filter."
                : "Set monthly spending limits per category to track your spending and get alerts when you exceed them."}
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Budget
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b, i) => (
            <BudgetCard key={b.id} budget={b} index={i} onDelete={() => onDelete(b.id)} />
          ))}
        </div>
      )}

      <AddBudgetDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}

// =====================================================
//  Budget Card
// =====================================================
function BudgetCard({
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
  const tone = budget.over ? "rose" : pct >= 80 ? "amber" : "emerald";
  const toneClasses = {
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <Card
      className="relative flex flex-col overflow-hidden p-4 card-hover animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      {/* Accent stripe */}
      <div className={cn("absolute left-0 top-0 h-full w-1", barColor)} />

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneClasses[tone])}>
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{catDef?.label ?? budget.category}</p>
          <p className="text-[11px] text-muted-foreground">Monthly limit</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Amount */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Spent</p>
          <p className="text-lg font-semibold tabular-nums">{formatINR(budget.spent)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Limit</p>
          <p className="text-sm font-medium tabular-nums text-muted-foreground">{formatINR(budget.amount)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{pct}% used</span>
          <span>
            {budget.over
              ? `Over by ${formatINRShort(Math.abs(budget.remaining))}`
              : `${formatINRShort(budget.remaining)} left`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-700", barColor)}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        {budget.over ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3 w-3" />
            Over budget
          </span>
        ) : pct >= 80 ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Almost there
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            On track
          </span>
        )}
        <Badge variant="outline" className="text-[9px]">{pct}%</Badge>
      </div>
    </Card>
  );
}

// =====================================================
//  Add Budget Dialog
// =====================================================
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent aria-describedby={undefined} className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            Set Monthly Budget
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose a category and set a monthly spending limit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(CATEGORIES)
                  .filter((c) => c.key !== "salary" && c.key !== "transfer" && c.key !== "other")
                  .map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saveMut.isPending} className="gap-1.5">
            {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saveMut.isPending ? "Saving…" : "Save Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
//  Goals Tab
// =====================================================
type GoalFilter = "all" | "active" | "completed";

function GoalsTab({
  data,
  loading,
}: {
  data?: { goals: GoalRow[] };
  loading: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<GoalFilter>("all");
  const delMut = useDeleteGoal();

  const goals = data?.goals ?? [];
  const filtered = useMemo(() => {
    if (filter === "active") return goals.filter((g) => g.status === "active" && !g.completed);
    if (filter === "completed") return goals.filter((g) => g.completed);
    return goals;
  }, [goals, filter]);

  const onDelete = async (id: string) => {
    try {
      await delMut.mutateAsync(id);
      toast.success("Goal deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            {(["all", "active", "completed"] as GoalFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="h-9 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Goal
          </Button>
        </div>
      </Card>

      {/* Goal cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold">
              {goals.length > 0 ? "No goals match your filter" : "No goals set yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {goals.length > 0
                ? "Try switching the filter to see more goals."
                : "Set a savings, income, or debt-payoff target to track your progress over time. Goals auto-compute from your transaction history."}
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Goal
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g, i) => (
            <GoalCard key={g.id} goal={g} index={i} onDelete={() => onDelete(g.id)} />
          ))}
        </div>
      )}

      <AddGoalDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}

// =====================================================
//  Goal Card
// =====================================================
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
  savings: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  income: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  debt: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const BAR_COLOR: Record<GoalRow["goalType"], string> = {
  savings: "bg-emerald-500",
  income: "bg-sky-500",
  debt: "bg-rose-500",
};

function GoalCard({
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
    <Card
      className="relative flex flex-col overflow-hidden p-4 card-hover animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      {/* Accent stripe */}
      <div className={cn("absolute left-0 top-0 h-full w-1", completed ? "bg-emerald-500" : barColor)} />

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TYPE_STYLE[goal.goalType])}>
          {TYPE_ICON[goal.goalType]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{goal.name}</p>
          <p className="text-[11px] text-muted-foreground">{TYPE_LABEL[goal.goalType]}</p>
        </div>
        {completed ? (
          <Badge variant="outline" className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
            <Trophy className="mr-0.5 h-2.5 w-2.5" />
            Done
          </Badge>
        ) : isOverdue ? (
          <Badge variant="outline" className="shrink-0 border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-300">
            {Math.abs(goal.daysLeft!)}d overdue
          </Badge>
        ) : goal.daysLeft !== null ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            <CalendarClock className="mr-0.5 h-2.5 w-2.5" />
            {goal.daysLeft}d left
          </Badge>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Amount */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Progress</p>
          <p className="text-lg font-semibold tabular-nums">{formatINR(goal.progress)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</p>
          <p className="text-sm font-medium tabular-nums text-muted-foreground">{formatINR(goal.target)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{goal.pct}% complete</span>
          {!completed && goal.remaining > 0 && <span>{formatINRShort(goal.remaining)} to go</span>}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              completed ? "bg-gradient-to-r from-emerald-500 to-teal-400" : barColor
            )}
            style={{ width: `${Math.min(goal.pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
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
              {m.completed ? <CheckCircle2 className="h-2.5 w-2.5" /> : <CalendarClock className="h-2.5 w-2.5" />}
              {m.name}
              <span className="opacity-60">· {formatINRShort(m.target)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Add milestone */}
      <MilestoneAdder goalId={goal.id} goalTarget={goal.target} />
    </Card>
  );
}

// =====================================================
//  Milestone Adder
// =====================================================
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
        className="mt-3 inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-primary"
      >
        <Plus className="h-2.5 w-2.5" />
        Add milestone
      </button>
    );
  }

  return (
    <div className="mt-3 flex gap-1.5 border-t pt-3">
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
      <Button size="sm" onClick={add} disabled={addMut.isPending} className="h-7 px-2 text-[11px]">
        {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-7 px-2 text-[11px]">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// =====================================================
//  Add Goal Dialog
// =====================================================
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent aria-describedby={undefined} className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            New Goal
          </DialogTitle>
          <DialogDescription className="text-xs">
            Set a savings, income, or debt-payoff target.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Goal Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Emergency Fund, Vacation, Debt Free"
              className="h-9 text-sm"
              autoFocus
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
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saveMut.isPending} className="gap-1.5">
            {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
            {saveMut.isPending ? "Creating…" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

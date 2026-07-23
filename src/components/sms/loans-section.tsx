"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Landmark,
  Trash2,
  Plus,
  CalendarClock,
  FileText,
  Shield,
  Loader2,
  Search,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingDown,
  Wallet,
  CalendarDays,
  IndianRupee,
  Upload,
  Sparkles,
} from "lucide-react";
import type { LoanRow, UpcomingEmi } from "./use-sms-data";
import { useDeleteLoan, useLoanSchedule, useUpdateLoan } from "./use-sms-data";
import { formatINR, formatINRShort, formatDate } from "./format";
import { VaultUnlock } from "./vault-unlock";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 as CheckCircle, Clock as ClockIcon, AlertTriangle as AlertIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// =====================================================
//  Main Loans Section
// =====================================================
export function LoansSection({
  loans,
  upcoming,
  loading,
  onUploadDocument,
}: {
  loans?: LoanRow[];
  upcoming?: UpcomingEmi[];
  loading: boolean;
  onUploadDocument?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "overdue" | "closed">("all");
  const [view, setView] = useState<"card" | "list">("card");
  const [showAdd, setShowAdd] = useState(false);
  const [detailLoan, setDetailLoan] = useState<LoanRow | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "schedule" | "documents" | "edit">("overview");

  const delMut = useDeleteLoan();

  // ---- Derived KPIs ----
  const stats = useMemo(() => {
    if (!loans) return { active: 0, monthlyEmi: 0, nextDue: null as UpcomingEmi | null, overdueCount: 0, overdueAmount: 0, totalPrincipal: 0 };
    const active = loans.filter((l) => l.status === "active" || l.status === "overdue");
    const monthlyEmi = active.reduce((s, l) => s + (l.emiAmount ?? 0), 0);
    const totalPrincipal = active.reduce((s, l) => s + (l.principal ?? 0), 0);
    const overdueLoans = active.filter((l) => l.status === "overdue");
    const nextDue = upcoming && upcoming.length > 0 ? upcoming[0] : null;
    return {
      active: active.length,
      monthlyEmi,
      nextDue,
      overdueCount: overdueLoans.length,
      overdueAmount: overdueLoans.reduce((s, l) => s + (l.emiAmount ?? 0), 0),
      totalPrincipal,
    };
  }, [loans, upcoming]);

  // ---- Filtered loans ----
  const filtered = useMemo(() => {
    if (!loans) return [];
    let out = loans;
    if (statusFilter !== "all") {
      out = out.filter((l) =>
        statusFilter === "active" ? l.status === "active" :
        statusFilter === "overdue" ? l.status === "overdue" :
        l.status === "closed"
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((l) =>
        l.lender.toLowerCase().includes(q) ||
        (l.loanRef ?? "").toLowerCase().includes(q) ||
        prettyLoanType(l.loanType).toLowerCase().includes(q)
      );
    }
    return out;
  }, [loans, statusFilter, search]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this loan? Linked transactions will be unlinked but kept.")) return;
    try {
      await delMut.mutateAsync(id);
      toast.success("Loan deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openDetail = (loan: LoanRow, tab: "overview" | "schedule" | "documents" | "edit" = "overview") => {
    setDetailLoan(loan);
    setDetailTab(tab);
  };

  return (
    <div className="space-y-5">
      {/* ---------- KPI Header Cards ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Landmark className="h-4 w-4" />}
          label="Active Loans"
          value={loading ? "—" : String(stats.active)}
          sub={loading ? "" : `${loans?.length ?? 0} total`}
          tone="primary"
        />
        <KpiCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="Monthly EMI"
          value={loading ? "—" : formatINRShort(stats.monthlyEmi)}
          sub={loading ? "" : "Total burden"}
          tone="emerald"
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Next Due"
          value={loading ? "—" : stats.nextDue ? formatNextDue(stats.nextDue.nextDue) : "None"}
          sub={loading ? "" : stats.nextDue ? `${formatINRShort(stats.nextDue.emiAmount ?? 0)} · ${stats.nextDue.lender}` : "All clear"}
          tone={stats.nextDue?.overdue ? "rose" : "amber"}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Overdue"
          value={loading ? "—" : String(stats.overdueCount)}
          sub={loading ? "" : stats.overdueCount > 0 ? formatINRShort(stats.overdueAmount) : "No overdue"}
          tone={stats.overdueCount > 0 ? "rose" : "muted"}
        />
      </div>

      {/* ---------- Toolbar ---------- */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lender, ref, type…"
              className="h-9 pl-8 text-sm"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            {(["all", "active", "overdue", "closed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  statusFilter === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* View toggle + Add */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
              <button
                onClick={() => setView("card")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-md transition-colors",
                  view === "card" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title="Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-md transition-colors",
                  view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title="List view"
              >
                <ListIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAdd(true)}
              className="h-9 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Loan
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------- Loans list ---------- */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasAny={!!loans && loans.length > 0}
          onAdd={() => setShowAdd(true)}
          onUpload={onUploadDocument}
        />
      ) : view === "card" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l, i) => (
            <LoanCard
              key={l.id}
              loan={l}
              upcoming={upcoming?.find((u) => u.id === l.id)}
              index={i}
              onOpen={(tab) => openDetail(l, tab)}
              onDelete={() => onDelete(l.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y">
            {filtered.map((l) => (
              <LoanListRow
                key={l.id}
                loan={l}
                upcoming={upcoming?.find((u) => u.id === l.id)}
                onOpen={(tab) => openDetail(l, tab)}
                onDelete={() => onDelete(l.id)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* ---------- Dialogs ---------- */}
      <AddLoanDialog open={showAdd} onOpenChange={setShowAdd} />

      <LoanDetailSheet
        loan={detailLoan}
        open={!!detailLoan}
        onOpenChange={(v) => { if (!v) setDetailLoan(null); }}
        initialTab={detailTab}
        onTabChange={setDetailTab}
        onDelete={(id) => { onDelete(id); setDetailLoan(null); }}
      />
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
//  Loan Card (Card view)
// =====================================================
function LoanCard({
  loan,
  upcoming,
  index,
  onOpen,
  onDelete,
}: {
  loan: LoanRow;
  upcoming?: UpcomingEmi;
  index: number;
  onOpen: (tab?: "overview" | "schedule" | "documents" | "edit") => void;
  onDelete: () => void;
}) {
  const statusTone = getStatusTone(loan.status);
  const isOverdue = loan.status === "overdue";
  const nextDueIn = upcoming ? daysUntil(upcoming.nextDue) : null;

  // For progress: estimate from linked transactions count vs tenure
  const paidCount = loan.transactions.filter(
    (t) => t.type === "debit"
  ).length;
  const totalCount = loan.tenure ?? 0;
  const pct = totalCount > 0 ? Math.min(100, Math.round((paidCount / totalCount) * 100)) : 0;

  return (
    <Card
      className="relative flex flex-col overflow-hidden p-4 card-hover animate-fade-up cursor-pointer"
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
      onClick={() => onOpen("overview")}
    >
      {/* Accent stripe by status */}
      <div className={cn("absolute left-0 top-0 h-full w-1", statusTone.stripe)} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", statusTone.iconBg)}>
              <Landmark className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{loan.lender}</p>
              <p className="text-[11px] text-muted-foreground">{prettyLoanType(loan.loanType)}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px]", statusTone.badge)}>
          {loan.status}
        </Badge>
      </div>

      {/* EMI amount + next due */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">EMI / month</p>
          <p className="text-lg font-semibold tabular-nums">
            {loan.emiAmount ? formatINR(loan.emiAmount) : "—"}
          </p>
        </div>
        {upcoming && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Next due</p>
            <p className={cn(
              "text-xs font-medium tabular-nums",
              isOverdue ? "text-rose-600 dark:text-rose-400" : nextDueIn !== null && nextDueIn <= 3 ? "text-amber-600 dark:text-amber-400" : ""
            )}>
              {nextDueIn === null ? "—" : nextDueIn === 0 ? "Today" : nextDueIn < 0 ? `${Math.abs(nextDueIn)}d overdue` : `in ${nextDueIn}d`}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Paid {paidCount} / {totalCount}</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      )}

      {/* Quick stats row */}
      <div className="mt-3 grid grid-cols-3 gap-1 text-[10px]">
        <Stat label="Principal" value={loan.principal ? formatINRShort(loan.principal) : "—"} />
        <Stat label="Tenure" value={loan.tenure ? `${loan.tenure}mo` : "—"} />
        <Stat label="Due Day" value={loan.dueDay ? String(loan.dueDay) : "—"} />
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center gap-1 border-t pt-3" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 flex-1 gap-1 text-xs"
          onClick={() => onOpen("schedule")}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Schedule
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 flex-1 gap-1 text-xs"
          onClick={() => onOpen("documents")}
        >
          <FileText className="h-3.5 w-3.5" />
          Docs
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => onOpen("edit")}
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

// =====================================================
//  Loan List Row (List view)
// =====================================================
function LoanListRow({
  loan,
  upcoming,
  onOpen,
  onDelete,
}: {
  loan: LoanRow;
  upcoming?: UpcomingEmi;
  onOpen: (tab?: "overview" | "schedule" | "documents" | "edit") => void;
  onDelete: () => void;
}) {
  const statusTone = getStatusTone(loan.status);
  const nextDueIn = upcoming ? daysUntil(upcoming.nextDue) : null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => onOpen("overview")}
    >
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", statusTone.iconBg)}>
        <Landmark className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{loan.lender}</p>
          <Badge variant="outline" className={cn("shrink-0 text-[10px]", statusTone.badge)}>
            {loan.status}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {prettyLoanType(loan.loanType)}{loan.loanRef ? ` · ${loan.loanRef}` : ""}
        </p>
      </div>
      <div className="hidden sm:block text-right">
        <p className="text-xs font-medium tabular-nums">{loan.emiAmount ? formatINR(loan.emiAmount) : "—"}</p>
        <p className="text-[10px] text-muted-foreground">EMI / month</p>
      </div>
      <div className="hidden md:block text-right w-20">
        {upcoming ? (
          <>
            <p className={cn(
              "text-xs font-medium tabular-nums",
              nextDueIn !== null && nextDueIn < 0 ? "text-rose-600 dark:text-rose-400" : nextDueIn !== null && nextDueIn <= 3 ? "text-amber-600 dark:text-amber-400" : ""
            )}>
              {nextDueIn === 0 ? "Today" : nextDueIn !== null && nextDueIn < 0 ? `${Math.abs(nextDueIn)}d overdue` : nextDueIn !== null ? `in ${nextDueIn}d` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Next due</p>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpen("schedule")} title="Schedule">
          <CalendarClock className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpen("documents")} title="Documents">
          <FileText className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpen("edit")} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// =====================================================
//  Empty State
// =====================================================
function EmptyState({
  hasAny,
  onAdd,
  onUpload,
}: {
  hasAny: boolean;
  onAdd: () => void;
  onUpload?: () => void;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary animate-pulse-ring">
        <Landmark className="h-7 w-7" />
      </div>
      <div>
        <p className="text-base font-semibold">
          {hasAny ? "No loans match your filter" : "No loans tracked yet"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {hasAny
            ? "Try clearing the search or switching the status filter to see more loans."
            : "EMI SMS from Bajaj, HDB, Home Credit, Tata Capital and other NBFCs will auto-create loan accounts here. You can also add a loan manually or upload a loan agreement."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Loan Manually
        </Button>
        {onUpload && (
          <Button variant="outline" onClick={onUpload} className="gap-1.5">
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        )}
      </div>
    </Card>
  );
}

// =====================================================
//  Add Loan Dialog (with all fields + live preview)
// =====================================================
function AddLoanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [lender, setLender] = useState("");
  const [loanType, setLoanType] = useState("personal");
  const [loanRef, setLoanRef] = useState("");
  const [principal, setPrincipal] = useState("");
  const [emiAmount, setEmiAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [tenure, setTenure] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setLender("");
    setLoanType("personal");
    setLoanRef("");
    setPrincipal("");
    setEmiAmount("");
    setDueDay("");
    setTenure("");
    setInterestRate("");
    setStartDate("");
  };

  const save = async () => {
    if (!lender.trim()) {
      toast.error("Lender name is required");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lender: lender.trim(),
          loanType,
          loanRef: loanRef || null,
          principal: principal ? parseFloat(principal) : null,
          emiAmount: emiAmount ? parseFloat(emiAmount) : null,
          dueDay: dueDay ? parseInt(dueDay, 10) : null,
          tenure: tenure ? parseInt(tenure, 10) : null,
          interestRate: interestRate ? parseFloat(interestRate) : null,
          startDate: startDate || null,
          status: "active",
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Loan added");
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add loan");
    } finally {
      setSaving(false);
    }
  };

  // Live preview total payable
  const previewTotal = (parseFloat(emiAmount || "0") || 0) * (parseInt(tenure || "0", 10) || 0);
  const previewInterest = principal && previewTotal
    ? Math.max(0, previewTotal - (parseFloat(principal) || 0))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl gap-0 p-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b px-6 py-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-primary" />
            Add Loan / EMI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fill in the details below. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 overflow-y-auto scrollbar-thin md:grid-cols-5 flex-1">
          {/* Form side */}
          <div className="space-y-4 px-6 py-5 md:col-span-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lender *</Label>
              <Input
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                placeholder="e.g. Bajaj Finserv, HDFC, Tata Capital"
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Loan Type</Label>
                <Select value={loanType} onValueChange={setLoanType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="homeLoan">Home Loan</SelectItem>
                    <SelectItem value="creditCardEMI">Card EMI</SelectItem>
                    <SelectItem value="consumerDurable">Consumer Durable</SelectItem>
                    <SelectItem value="autoLoan">Auto Loan</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Loan Ref / ID</Label>
                <Input
                  value={loanRef}
                  onChange={(e) => setLoanRef(e.target.value)}
                  placeholder="e.g. LNSB9981"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">EMI Amount (₹)</Label>
                <Input
                  type="number"
                  value={emiAmount}
                  onChange={(e) => setEmiAmount(e.target.value)}
                  placeholder="8500"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tenure (months)</Label>
                <Input
                  type="number"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  placeholder="24"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Principal (₹)</Label>
                <Input
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  placeholder="180000"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Interest Rate (% p.a.)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="14.0"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Due Day (1–31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="5"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Live preview side */}
          <div className="border-t bg-muted/20 px-6 py-5 md:col-span-2 md:border-l md:border-t-0">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Live Preview
            </p>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Landmark className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{lender || "Lender name"}</p>
                  <p className="text-[11px] text-muted-foreground">{prettyLoanType(loanType)}{loanRef ? ` · ${loanRef}` : ""}</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">EMI / month</p>
                <p className="text-lg font-semibold tabular-nums">
                  {emiAmount ? formatINR(parseFloat(emiAmount)) : "—"}
                </p>
              </div>
              <div className="mt-3 space-y-1.5 border-t pt-3 text-[11px]">
                <Row label="Principal" value={principal ? formatINR(parseFloat(principal)) : "—"} />
                <Row label="Tenure" value={tenure ? `${tenure} months` : "—"} />
                <Row label="Interest" value={interestRate ? `${interestRate}% p.a.` : "—"} />
                <Row label="Due Day" value={dueDay ? `${dueDay} of month` : "—"} />
                <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total Payable</span>
                  <span className="tabular-nums">{previewTotal > 0 ? formatINR(previewTotal) : "—"}</span>
                </div>
                {previewInterest > 0 && (
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                    <span>Total Interest</span>
                    <span className="tabular-nums">{formatINR(previewInterest)}</span>
                  </div>
                )}
              </div>
            </Card>
            <p className="mt-3 text-[10px] text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Tip: Upload a loan agreement later to auto-extract all fields and generate the full EMI schedule.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-3 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save Loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// =====================================================
//  Loan Detail Sheet (with tabs)
// =====================================================
function LoanDetailSheet({
  loan,
  open,
  onOpenChange,
  initialTab,
  onTabChange,
  onDelete,
}: {
  loan: LoanRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab: "overview" | "schedule" | "documents" | "edit";
  onTabChange: (t: "overview" | "schedule" | "documents" | "edit") => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full sm:max-w-xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="border-b px-5 py-4 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-primary" />
            {loan?.lender ?? "Loan Details"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {loan ? `${prettyLoanType(loan.loanType)}${loan.loanRef ? ` · Ref: ${loan.loanRef}` : ""}` : ""}
          </SheetDescription>
        </SheetHeader>

        {loan && (
          <Tabs
            value={initialTab}
            onValueChange={(v) => onTabChange(v as typeof initialTab)}
            className="flex flex-1 flex-col gap-0 overflow-hidden"
          >
            <div className="border-b px-3 py-2 shrink-0">
              <TabsList className="grid h-9 w-full grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="flex-1 overflow-y-auto scrollbar-thin">
              <OverviewTab loan={loan} />
            </TabsContent>
            <TabsContent value="schedule" className="flex-1 overflow-y-auto scrollbar-thin">
              <ScheduleTab loanId={loan.id} />
            </TabsContent>
            <TabsContent value="documents" className="flex-1 overflow-y-auto scrollbar-thin">
              <DocumentsTab loanId={loan.id} />
            </TabsContent>
            <TabsContent value="edit" className="flex-1 overflow-y-auto scrollbar-thin">
              <EditTab loan={loan} onDelete={() => onDelete(loan.id)} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

// =====================================================
//  Overview Tab
// =====================================================
function OverviewTab({ loan }: { loan: LoanRow }) {
  const statusTone = getStatusTone(loan.status);
  const paidDebits = loan.transactions.filter((t) => t.type === "debit");
  const totalPaid = paidDebits.reduce((s, t) => s + t.amount, 0);
  const pct = loan.tenure ? Math.min(100, Math.round((paidDebits.length / loan.tenure) * 100)) : 0;

  return (
    <div className="space-y-4 p-5">
      {/* Status hero */}
      <Card className={cn("p-4", statusTone.heroBg)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
            <p className={cn("text-lg font-semibold capitalize", statusTone.heroText)}>{loan.status}</p>
          </div>
          <div className={cn("grid h-12 w-12 place-items-center rounded-full", statusTone.iconBg)}>
            {loan.status === "overdue" ? <AlertTriangle className="h-5 w-5" /> :
             loan.status === "closed" ? <CheckCircle className="h-5 w-5" /> :
             <Clock className="h-5 w-5" />}
          </div>
        </div>
      </Card>

      {/* EMI hero */}
      <Card className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">EMI Amount</p>
        <p className="text-3xl font-bold tabular-nums">{loan.emiAmount ? formatINR(loan.emiAmount) : "Not set"}</p>
        {loan.dueDay && (
          <p className="mt-1 text-xs text-muted-foreground">
            Due on day <span className="font-semibold text-foreground">{loan.dueDay}</span> of every month
          </p>
        )}
      </Card>

      {/* Progress */}
      {loan.tenure ? (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium">Repayment Progress</p>
            <p className="text-xs text-muted-foreground tabular-nums">{paidDebits.length} / {loan.tenure} EMIs</p>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div>
              <p className="font-semibold tabular-nums">{pct}%</p>
              <p className="text-muted-foreground">Complete</p>
            </div>
            <div>
              <p className="font-semibold tabular-nums">{formatINRShort(totalPaid)}</p>
              <p className="text-muted-foreground">Paid</p>
            </div>
            <div>
              <p className="font-semibold tabular-nums">{loan.tenure - paidDebits.length}</p>
              <p className="text-muted-foreground">Remaining</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Loan details grid */}
      <Card className="p-4">
        <p className="mb-3 text-xs font-medium">Loan Details</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Loan Type" value={prettyLoanType(loan.loanType)} />
          <DetailItem label="Loan Reference" value={loan.loanRef ?? "—"} />
          <DetailItem label="Principal" value={loan.principal ? formatINR(loan.principal) : "—"} />
          <DetailItem label="Interest Rate" value={loan.interestRate ? `${loan.interestRate}% p.a.` : "—"} />
          <DetailItem label="Tenure" value={loan.tenure ? `${loan.tenure} months` : "—"} />
          <DetailItem label="Start Date" value={loan.startDate ? formatDate(loan.startDate).split(",")[0] : "—"} />
        </div>
      </Card>

      {/* Recent transactions */}
      <Card className="p-4">
        <p className="mb-3 text-xs font-medium">Linked EMI Transactions ({loan.transactions.length})</p>
        {loan.transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No EMI payments detected yet. They will appear here when EMI debit SMS are received.</p>
        ) : (
          <ul className="space-y-1.5">
            {loan.transactions.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.merchant ?? t.bank ?? "EMI Payment"}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(t.txDate)}</p>
                </div>
                <span className="font-semibold tabular-nums">{formatINR(t.amount)}</span>
              </li>
            ))}
            {loan.transactions.length > 5 && (
              <p className="pt-1 text-center text-[10px] text-muted-foreground">
                + {loan.transactions.length - 5} more
              </p>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums truncate">{value}</p>
    </div>
  );
}

// =====================================================
//  Schedule Tab
// =====================================================
function ScheduleTab({ loanId }: { loanId: string }) {
  const scheduleQ = useLoanSchedule(loanId);

  if (scheduleQ.isLoading) {
    return (
      <div className="space-y-2 p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg shimmer" />
        ))}
      </div>
    );
  }

  if (!scheduleQ.data || scheduleQ.data.schedule.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
          <CalendarClock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No schedule available</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Upload a loan agreement or EMI schedule document, or set the EMI amount, tenure, and due day to auto-generate the schedule.
          </p>
        </div>
      </div>
    );
  }

  const d = scheduleQ.data;

  return (
    <div className="space-y-4 p-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="Paid" value={d.paid} icon={<CheckCircle className="h-3.5 w-3.5" />} tone="emerald" />
        <SummaryTile label="Upcoming" value={d.upcoming} icon={<Clock className="h-3.5 w-3.5" />} tone="sky" />
        <SummaryTile label="Overdue" value={d.overdue} icon={<AlertTriangle className="h-3.5 w-3.5" />} tone="rose" />
      </div>

      {/* Total payable */}
      {d.totalPayable ? (
        <Card className="p-3">
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Payable</p>
              <p className="text-base font-semibold tabular-nums">{formatINR(d.totalPayable)}</p>
            </div>
            {d.totalInterest ? (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Interest</p>
                <p className="text-base font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{formatINR(d.totalInterest)}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Schedule list */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">All Installments</p>
        {d.schedule.map((emi) => (
          <ScheduleRow key={emi.installmentNumber} emi={emi} />
        ))}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "emerald" | "sky" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    sky: "bg-sky-500/5 text-sky-600 dark:text-sky-400",
    rose: "bg-rose-500/5 text-rose-600 dark:text-rose-400",
  };
  return (
    <Card className={cn("p-3 text-center", tones[tone])}>
      <div className="mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full bg-background/60">{icon}</div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </Card>
  );
}

function ScheduleRow({
  emi,
}: {
  emi: {
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: "upcoming" | "paid" | "overdue";
    linkedTransactionId?: string;
  };
}) {
  const tone =
    emi.status === "paid"
      ? { icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />, badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" }
      : emi.status === "overdue"
      ? { icon: <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />, badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" }
      : { icon: <Clock className="h-3.5 w-3.5 text-sky-500" />, badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" };

  const d = new Date(emi.dueDate);
  const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted/30 transition-colors">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">
        {emi.installmentNumber}
      </span>
      {tone.icon}
      <span className="min-w-0 flex-1 text-muted-foreground">{dateStr}</span>
      <span className="shrink-0 font-medium tabular-nums">{formatINR(emi.amount)}</span>
      <Badge variant="outline" className={cn("shrink-0 text-[9px] capitalize", tone.badge)}>{emi.status}</Badge>
    </div>
  );
}

// =====================================================
//  Documents Tab (Vault access)
// =====================================================
function DocumentsTab({ loanId }: { loanId: string }) {
  const [docs, setDocs] = useState<Array<{
    id: string;
    fileName: string;
    documentType: string;
    extractionStatus: string;
    uploadedAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; content: string; fileName: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/documents`)
      .then((r) => r.json())
      .then((data) => {
        const loanDocs = (data.documents || []).filter((d: { linkedLoanId: string | null }) => d.linkedLoanId === loanId);
        setDocs(loanDocs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [loanId]);

  const viewDocument = async (docId: string, fileName: string) => {
    try {
      const r = await fetch(`/api/documents/${docId}/vault`);
      if (!r.ok) throw new Error("Access denied");
      const data = await r.json();
      setSelectedDoc({ id: docId, content: data.vault?.content || "Content not available", fileName });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to access vault");
    }
  };

  if (!unlocked) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary animate-pulse-ring">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium">Documents are secured</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Authenticate with PIN or biometric to view original loan agreements and EMI schedules from the encrypted vault.
            </p>
          </div>
          <Button onClick={() => setShowUnlock(true)} className="gap-1.5">
            <Shield className="h-4 w-4" />
            Unlock & View
          </Button>
        </div>
        <VaultUnlock
          open={showUnlock}
          onOpenChange={setShowUnlock}
          onUnlock={() => setUnlocked(true)}
          title="Unlock Loan Documents"
          description="Authenticate to view secured loan agreements and EMI schedules"
        />
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedDoc) {
    return (
      <div className="space-y-3 p-5">
        <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)} className="gap-1.5">
          ← Back to list
        </Button>
        <p className="text-xs font-semibold">{selectedDoc.fileName}</p>
        <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/20 p-3 text-[10px] leading-relaxed whitespace-pre-wrap scrollbar-thin">
          {selectedDoc.content}
        </pre>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No documents linked</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Upload a loan agreement or EMI schedule from the Documents view to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-5">
      <p className="text-xs font-medium text-muted-foreground">{docs.length} document(s) linked to this loan</p>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.id}>
            <button
              onClick={() => viewDocument(d.id, d.fileName)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/30"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{d.fileName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {d.documentType.replace(/([A-Z])/g, " $1").trim()} · {new Date(d.uploadedAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[9px]">{d.extractionStatus}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =====================================================
//  Edit Tab
// =====================================================
function EditTab({
  loan,
  onDelete,
}: {
  loan: LoanRow;
  onDelete: () => void;
}) {
  const updateMut = useUpdateLoan();
  const [lender, setLender] = useState(loan.lender);
  const [loanType, setLoanType] = useState(loan.loanType);
  const [loanRef, setLoanRef] = useState(loan.loanRef ?? "");
  const [principal, setPrincipal] = useState(loan.principal ? String(loan.principal) : "");
  const [emiAmount, setEmiAmount] = useState(loan.emiAmount ? String(loan.emiAmount) : "");
  const [dueDay, setDueDay] = useState(loan.dueDay ? String(loan.dueDay) : "");
  const [tenure, setTenure] = useState(loan.tenure ? String(loan.tenure) : "");
  const [interestRate, setInterestRate] = useState(loan.interestRate ? String(loan.interestRate) : "");
  const [startDate, setStartDate] = useState(loan.startDate ? loan.startDate.split("T")[0] : "");
  const [status, setStatus] = useState(loan.status);

  const save = async () => {
    if (!lender.trim()) {
      toast.error("Lender name is required");
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: loan.id,
        patch: {
          lender: lender.trim(),
          loanType,
          loanRef: loanRef || null,
          principal: principal ? parseFloat(principal) : null,
          emiAmount: emiAmount ? parseFloat(emiAmount) : null,
          dueDay: dueDay ? parseInt(dueDay, 10) : null,
          tenure: tenure ? parseInt(tenure, 10) : null,
          interestRate: interestRate ? parseFloat(interestRate) : null,
          startDate: startDate || null,
          status,
        },
      });
      toast.success("Loan updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div className="space-y-4 p-5">
      <div className="space-y-1.5">
        <Label className="text-xs">Lender *</Label>
        <Input value={lender} onChange={(e) => setLender(e.target.value)} className="h-9 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Loan Type</Label>
          <Select value={loanType} onValueChange={setLoanType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="homeLoan">Home Loan</SelectItem>
              <SelectItem value="creditCardEMI">Card EMI</SelectItem>
              <SelectItem value="consumerDurable">Consumer Durable</SelectItem>
              <SelectItem value="autoLoan">Auto Loan</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Loan Ref</Label>
          <Input value={loanRef} onChange={(e) => setLoanRef(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">EMI Amount</Label>
          <Input type="number" value={emiAmount} onChange={(e) => setEmiAmount(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Principal</Label>
          <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Interest Rate (%)</Label>
          <Input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tenure (months)</Label>
          <Input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Due Day (1–31)</Label>
          <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Start Date</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <Button variant="outline" onClick={onDelete} className="gap-1.5 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
          Delete Loan
        </Button>
        <Button onClick={save} disabled={updateMut.isPending} className="gap-1.5">
          {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// =====================================================
//  Helpers
// =====================================================
function prettyLoanType(t: string): string {
  const map: Record<string, string> = {
    personal: "Personal Loan",
    homeLoan: "Home Loan",
    creditCardEMI: "Card EMI",
    consumerDurable: "Consumer Durable",
    autoLoan: "Auto Loan",
    other: "Other",
  };
  return map[t] ?? t;
}

function getStatusTone(status: string) {
  switch (status) {
    case "overdue":
      return {
        stripe: "bg-rose-500",
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        badge: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        heroBg: "bg-rose-500/5",
        heroText: "text-rose-600 dark:text-rose-400",
      };
    case "closed":
      return {
        stripe: "bg-muted-foreground/40",
        iconBg: "bg-muted text-muted-foreground",
        badge: "border-muted-foreground/30 bg-muted text-muted-foreground",
        heroBg: "bg-muted/30",
        heroText: "text-muted-foreground",
      };
    default:
      return {
        stripe: "bg-emerald-500",
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        heroBg: "bg-emerald-500/5",
        heroText: "text-emerald-600 dark:text-emerald-400",
      };
  }
}

function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatNextDue(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const days = daysUntil(d);
  if (days === 0) return "Today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 1) return "Tomorrow";
  if (days < 7) return `in ${days}d`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

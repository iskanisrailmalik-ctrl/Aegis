"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Lang } from "@/lib/i18n";

// ---------- Types ----------
export interface TxRow {
  id: string;
  type: "credit" | "debit";
  amount: number;
  merchant: string | null;
  accountMasked: string | null;
  balance: number | null;
  txDate: string;
  bank: string | null;
  sender: string | null;
  senderType: string;
  category: string | null;
  classification: "verified" | "unverified" | "flagged";
  rawMessage: string;
  note: string | null;
  loanId: string | null;
  extra: string | null;
  receivedAt: string;
}

export interface LoanRow {
  id: string;
  lender: string;
  loanType: string;
  loanRef: string | null;
  principal: number | null;
  emiAmount: number | null;
  dueDay: number | null;
  tenure: number | null;
  interestRate: number | null;
  startDate: string | null;
  status: string;
  transactions: TxRow[];
}

export interface UpcomingEmi {
  id: string;
  lender: string;
  loanType: string;
  emiAmount: number | null;
  dueDay: number | null;
  nextDue: string;
  overdue: boolean;
  status: string;
}

export interface DashboardData {
  period: "day" | "week" | "month" | "all";
  credited: number;
  debited: number;
  net: number;
  creditCount: number;
  debitCount: number;
  recent: TxRow[];
  upcoming: UpcomingEmi[];
  flaggedCount: number;
  unverifiedCount: number;
  categoryBreakdown: { key: string; amount: number; count: number }[];
  topMerchants: { name: string; amount: number; count: number; category: string }[];
  dailyTrend: { date: string; amount: number }[];
}

export interface FlaggedRow {
  id: string;
  sender: string | null;
  content: string;
  classification: "flagged" | "unverified";
  reason: string;
  signals: string | null;
  receivedAt: string;
}

export interface AppSettingsState {
  uiLanguage: Lang;
  voiceLanguage: Lang;
  muted: boolean;
  theme: "light" | "dark" | "system";
  period: "day" | "week" | "month" | "all";
}

// ---------- Fetchers ----------
async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || `${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<T>;
}

// ---------- Hooks ----------
export function useSettings() {
  return useQuery<AppSettingsState>({
    queryKey: ["settings"],
    queryFn: () => jfetch<AppSettingsState>("/api/settings"),
  });
}

export type Period = "day" | "week" | "month" | "all" | "custom";

export function useDashboard(period: Period, customFrom?: string, customTo?: string) {
  const qs = customFrom || customTo
    ? `period=custom${customFrom ? `&from=${customFrom}` : ""}${customTo ? `&to=${customTo}` : ""}`
    : `period=${period}`;
  return useQuery<DashboardData>({
    queryKey: ["dashboard", period, customFrom, customTo],
    queryFn: () => jfetch<DashboardData>(`/api/dashboard?${qs}`),
  });
}

export function useTransactions(classification?: string) {
  return useQuery<TxRow[]>({
    queryKey: ["transactions", classification ?? "all"],
    queryFn: () =>
      jfetch<TxRow[]>(
        `/api/transactions${classification ? `?classification=${classification}` : ""}`
      ),
  });
}

export function useFlagged(classification?: string) {
  return useQuery<FlaggedRow[]>({
    queryKey: ["flagged", classification ?? "all"],
    queryFn: () =>
      jfetch<FlaggedRow[]>(
        `/api/flagged${classification ? `?classification=${classification}` : ""}`
      ),
  });
}

export function useLoans() {
  return useQuery<{ loans: LoanRow[]; upcoming: UpcomingEmi[] }>({
    queryKey: ["loans"],
    queryFn: () => jfetch<{ loans: LoanRow[]; upcoming: UpcomingEmi[] }>("/api/loans"),
  });
}

// ---------- Mutations ----------
export function useParseSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sender?: string; text: string; receivedAt?: string }) =>
      jfetch<{
        classification: string;
        parsed: boolean;
        reason: string;
        signals: { key: string; label: string; severity: string }[];
        transactionId?: string;
        flaggedId?: string;
        loanCreated?: boolean;
        loanId?: string;
        fields?: Record<string, unknown>;
      }>("/api/sms/parse", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["flagged"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function usePreviewSms() {
  return useMutation({
    mutationFn: (vars: { sender?: string; text: string }) =>
      jfetch<Record<string, unknown>>("/api/sms/parse", {
        method: "PUT",
        body: JSON.stringify(vars),
      }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      jfetch(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      jfetch(`/api/transactions/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useDeleteFlagged() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; action?: "delete" | "markLegit" }) =>
      jfetch(`/api/flagged/${vars.id}`, {
        method: vars.action === "markLegit" ? "PATCH" : "DELETE",
        body: JSON.stringify({ action: vars.action ?? "delete" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["flagged"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jfetch(`/api/loans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useUpdateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      jfetch(`/api/loans/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---------- Loan EMI Schedule ----------
export interface ScheduledEmi {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: "upcoming" | "paid" | "overdue";
  linkedTransactionId?: string;
}

export interface LoanSchedule {
  loan: {
    id: string;
    lender: string;
    emiAmount: number | null;
    tenure: number | null;
    dueDay: number | null;
    startDate: string | null;
    principal?: number | null;
    interestRate?: number | null;
    loanType?: string;
    loanRef?: string | null;
  };
  schedule: ScheduledEmi[];
  totalInstallments: number;
  paid: number;
  upcoming: number;
  overdue: number;
  totalPayable?: number;
  totalInterest?: number;
  nextDue?: ScheduledEmi | null;
}

export function useLoanSchedule(loanId: string | null) {
  return useQuery<LoanSchedule>({
    queryKey: ["loan-schedule", loanId],
    queryFn: () => jfetch<LoanSchedule>(`/api/loans/${loanId}/schedule`),
    enabled: !!loanId,
  });
}

export function useSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clear: boolean) =>
      jfetch<{
        ok: boolean;
        results: Array<{ sender: string; classification: string; parsed: boolean }>;
        counts: { transactions: number; flagged: number; unverified: number; loans: number };
      }>("/api/seed", {
        method: "POST",
        body: JSON.stringify({ clear }),
      }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useClearAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jfetch("/api/seed", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettingsState>) =>
      jfetch<AppSettingsState>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
    },
  });
}

export function useBackfillCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      jfetch<{ ok: boolean; total: number; updated: number }>("/api/categorize", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ---------- Recurring ----------
export interface RecurringGroup {
  key: string;
  merchant: string;
  category: string | null;
  amount: number;
  count: number;
  frequency: "weekly" | "monthly" | "irregular";
  avgDaysBetween: number | null;
  lastDate: string;
  nextPredicted: string | null;
  txIds: string[];
}

export function useRecurring() {
  return useQuery<{ groups: RecurringGroup[]; monthlyTotal: number; count: number }>({
    queryKey: ["recurring"],
    queryFn: () =>
      jfetch<{ groups: RecurringGroup[]; monthlyTotal: number; count: number }>("/api/recurring"),
  });
}

// ---------- Budgets ----------
export interface BudgetRow {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  pct: number;
  over: boolean;
}

export function useBudgets() {
  return useQuery<{ budgets: BudgetRow[] }>({
    queryKey: ["budgets"],
    queryFn: () => jfetch<{ budgets: BudgetRow[] }>("/api/budgets"),
  });
}

export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { category: string; amount: number }) =>
      jfetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jfetch(`/api/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

// ---------- Backup / Restore ----------
export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { data: unknown; clear: boolean }) =>
      jfetch("/api/backup", {
        method: "POST",
        body: JSON.stringify({ ...vars, __clear: vars.clear }),
      }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

// ---------- Merchant Overrides ----------
export interface OverrideRow {
  id: string;
  merchant: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export function useOverrides() {
  return useQuery<{ overrides: OverrideRow[] }>({
    queryKey: ["overrides"],
    queryFn: () => jfetch<{ overrides: OverrideRow[] }>("/api/overrides"),
  });
}

export function useSaveOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { merchant: string; category: string }) =>
      jfetch("/api/overrides", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overrides"] });
    },
  });
}

export function useDeleteOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jfetch(`/api/overrides/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overrides"] });
    },
  });
}

// ---------- Goals ----------
export interface MilestoneRow {
  id: string;
  name: string;
  target: number;
  completed: boolean;
  pct: number;
}

export interface GoalRow {
  id: string;
  name: string;
  target: number;
  goalType: "savings" | "income" | "debt";
  deadline: string | null;
  status: string;
  progress: number;
  pct: number;
  completed: boolean;
  remaining: number;
  daysLeft: number | null;
  createdAt: string;
  milestones: MilestoneRow[];
}

export function useGoals() {
  return useQuery<{ goals: GoalRow[] }>({
    queryKey: ["goals"],
    queryFn: () => jfetch<{ goals: GoalRow[] }>("/api/goals"),
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      target: number;
      goalType?: string;
      deadline?: string;
    }) =>
      jfetch("/api/goals", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      jfetch(`/api/goals/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jfetch(`/api/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

// ---------- Milestones ----------
export function useAddMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { goalId: string; name: string; target: number }) =>
      jfetch("/api/milestones", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jfetch(`/api/milestones/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

// ---------- Splits ----------
export interface SplitRow {
  id: string;
  transactionId: string;
  category: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export function useSplits(txId: string | null) {
  return useQuery<{ splits: SplitRow[] }>({
    queryKey: ["splits", txId],
    queryFn: () => jfetch<{ splits: SplitRow[] }>(`/api/transactions/${txId}/splits`),
    enabled: !!txId,
  });
}

export function useSaveSplits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      txId: string;
      splits: { category: string; amount: number; note?: string }[];
    }) =>
      jfetch(`/api/transactions/${vars.txId}/splits`, {
        method: "PUT",
        body: JSON.stringify(vars.splits),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["splits", vars.txId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useDeleteSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { txId: string; splitId: string }) =>
      jfetch(`/api/transactions/${vars.txId}/splits/${vars.splitId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["splits", vars.txId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---------- Conversations (pin, archive, mute, star, delete) ----------
export interface ConversationMeta {
  id: string;
  sender: string;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  isStarred: boolean;
  displayName: string | null;
}

export function useConversations() {
  return useQuery<{ conversations: ConversationMeta[] }>({
    queryKey: ["conversations"],
    queryFn: () => jfetch<{ conversations: ConversationMeta[] }>("/api/conversations"),
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      sender: string;
      isPinned?: boolean;
      isArchived?: boolean;
      isMuted?: boolean;
      isStarred?: boolean;
      displayName?: string;
    }) =>
      jfetch("/api/conversations", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sender: string) =>
      jfetch(`/api/conversations/${encodeURIComponent(sender)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---------- Blocked Senders ----------
export interface BlockedSenderRow {
  id: string;
  sender: string;
  reason: string;
  blockedAt: string;
}

export function useBlockedSenders() {
  return useQuery<{ blocked: BlockedSenderRow[] }>({
    queryKey: ["blocked"],
    queryFn: () => jfetch<{ blocked: BlockedSenderRow[] }>("/api/blocked"),
  });
}

export function useBlockSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sender: string; reason?: string }) =>
      jfetch("/api/blocked", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useUnblockSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sender: string) =>
      jfetch(`/api/blocked/${encodeURIComponent(sender)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

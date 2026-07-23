"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

// ---------- SMS Inbox ----------
export interface SmsMessageRow {
  id: string;
  rawText: string;
  sender: string | null;
  senderType: string;
  receivedAt: string;
  language: string | null;
  classification: string;
  linkedRecordType: string | null;
  linkedRecordId: string | null;
}

export function useInbox(params: { search?: string; classification?: string; sender?: string; linkedType?: string }) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.classification) qs.set("classification", params.classification);
  if (params.sender) qs.set("sender", params.sender);
  if (params.linkedType) qs.set("linkedType", params.linkedType);
  return useQuery<{ messages: SmsMessageRow[]; grouped: Array<{ date: string; messages: SmsMessageRow[] }>; total: number }>({
    queryKey: ["inbox", params.search, params.classification, params.sender, params.linkedType],
    queryFn: () => jfetch(`/api/inbox?${qs.toString()}`),
  });
}

// ---------- Compose / Reply ----------
export function useComposeMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sender?: string; text: string; replyToId?: string }) =>
      jfetch<{
        ok: boolean;
        messageId: string;
        classification: string;
        transactionId?: string;
        flaggedId?: string;
        parsed: boolean;
      }>("/api/inbox/compose", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ---------- Threads ----------
export interface Thread {
  sender: string;
  lastMessage: string;
  lastDate: string;
  messageCount: number;
  unreadCount: number;
  classification: string;
}

export function useThreads() {
  return useQuery<{ threads: Thread[]; total: number }>({
    queryKey: ["threads"],
    queryFn: () => jfetch("/api/inbox/threads"),
  });
}

// ---------- Intelligence Engine (Q&A) ----------
export interface QueryResult {
  question: string;
  answer: string;
  confidence: "high" | "medium" | "low";
  sourceIds: string[];
  sources: Array<{
    id: string;
    type: "transaction" | "smsMessage";
    preview: string;
    amount?: number;
    date?: string;
    merchant?: string;
  }>;
  chart?: {
    type: "bar" | "pie" | "line";
    data: Array<{ label: string; value: number }>;
  };
  routedToTier1: boolean;
  historyId?: string;
}

export function useAskQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (question: string) =>
      jfetch<QueryResult>("/api/query", {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["query-history"] });
    },
  });
}

export interface QueryHistoryRow {
  id: string;
  question: string;
  answer: string;
  sourceIds: string;
  confidence: string;
  createdAt: string;
}

export function useQueryHistory() {
  return useQuery<{ history: QueryHistoryRow[] }>({
    queryKey: ["query-history"],
    queryFn: () => jfetch<{ history: QueryHistoryRow[] }>("/api/query/history"),
  });
}

export function useClearQueryHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jfetch("/api/query/history", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["query-history"] });
    },
  });
}

// ---------- Documents ----------
export interface DocumentRow {
  id: string;
  documentType: string;
  fileName: string;
  sourceInstitution: string | null;
  extractionStatus: string;
  extractedFields: string | null;
  linkedLoanId: string | null;
  reconciliationSummary: string | null;
  uploadedAt: string;
}

export function useDocuments() {
  return useQuery<{ documents: DocumentRow[] }>({
    queryKey: ["documents"],
    queryFn: () => jfetch<{ documents: DocumentRow[] }>("/api/documents"),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      documentType: "auto" | "loanAgreement" | "emiSchedule" | "bankStatement";
      fileName: string;
      content: string;
      sourceInstitution?: string;
    }) =>
      jfetch<DocumentRow>("/api/documents", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jfetch(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ---------- Reconciliation Feedback ----------
export function useReconcileAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      action: "add" | "flag" | "ignore";
      documentId: string;
      statementRow?: { date?: string; description?: string; amount?: number; type?: string };
      transactionId?: string;
    }) =>
      jfetch("/api/reconcile", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

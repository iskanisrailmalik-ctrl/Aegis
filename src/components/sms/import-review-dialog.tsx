"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/sms/categories";
import {
  FileCheck,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export interface StagedCandidateItem {
  id: string;
  documentId: string;
  fieldType: string;
  suggestedComponent: "transaction-credit" | "transaction-debit" | "loan-emi" | "account-metadata" | "unclassified";
  extractedValue: string;
  confidence: number;
  sourceLocation: string;
  userDecision?: string | null;
  reassignedTo?: string | null;
}

export interface ReconciliationSummaryData {
  matched: number;
  missed: number;
  extra: number;
  matchRate: number;
}

interface ImportReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName?: string;
  onImportComplete?: () => void;
}

export function ImportReviewDialog({
  open,
  onOpenChange,
  documentId,
  documentName = "Document",
  onImportComplete,
}: ImportReviewDialogProps) {
  const [candidates, setCandidates] = useState<StagedCandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "transaction-credit" | "transaction-debit" | "loan-emi" | "account-metadata" | "ignore">>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [reconciliation, setReconciliation] = useState<ReconciliationSummaryData | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Fetch candidates from API
  useEffect(() => {
    if (open && documentId) {
      setLoading(true);
      setImportSuccess(false);
      setReconciliation(null);
      fetch(`/api/documents/candidates?documentId=${documentId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.candidates) {
            setCandidates(data.candidates);
            // Default initial decisions to suggestedComponent
            const initialDecisions: Record<string, any> = {};
            const initialSelected = new Set<string>();

            data.candidates.forEach((c: StagedCandidateItem) => {
              const target = c.suggestedComponent === "unclassified" ? "ignore" : c.suggestedComponent;
              initialDecisions[c.id] = target;
              if (c.confidence >= 0.6) {
                initialSelected.add(c.id);
              }
            });

            setDecisions(initialDecisions);
            setSelectedIds(initialSelected);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, documentId]);

  const handleTargetChange = (id: string, value: any) => {
    setDecisions((prev) => ({ ...prev, [id]: value }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const selectHighConfidence = () => {
    const high = new Set<string>();
    candidates.forEach((c) => {
      if (c.confidence >= 0.8) high.add(c.id);
    });
    setSelectedIds(high);
  };

  const applyBulkTarget = (target: "transaction-credit" | "transaction-debit" | "loan-emi" | "ignore") => {
    setDecisions((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        next[id] = target;
      });
      return next;
    });
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCommitImport = async () => {
    setImporting(true);
    try {
      const decisionList = candidates.map((c) => ({
        candidateId: c.id,
        targetComponent: selectedIds.has(c.id) ? (decisions[c.id] || "ignore") : "ignore",
      }));

      const res = await fetch("/api/documents/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          decisions: decisionList,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setImportSuccess(true);
        if (data.reconciliation) {
          setReconciliation(data.reconciliation);
        }
        if (onImportComplete) onImportComplete();
      }
    } catch (e) {
      console.error("Import commit failed", e);
    } finally {
      setImporting(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
          <Sparkles className="h-2.5 w-2.5" /> High ({Math.round(confidence * 100)}%)
        </Badge>
      );
    }
    if (confidence >= 0.5) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] gap-1">
          <AlertCircle className="h-2.5 w-2.5" /> Med ({Math.round(confidence * 100)}%)
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] gap-1">
        <HelpCircle className="h-2.5 w-2.5" /> Low ({Math.round(confidence * 100)}%)
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border bg-background shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary shrink-0" />
                Staged Import Review: {documentName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Review extracted candidates, verify confidence scores, and pick target components before committing.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {candidates.length} Candidate Rows
            </Badge>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {importSuccess ? (
            /* Requirement 5: Reconciliation Summary Screen after Import */
            <div className="py-8 px-4 text-center space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Import Completed Successfully!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Selected candidates have been committed to live tables.
                </p>
              </div>

              {reconciliation && (
                <div className="max-w-md mx-auto rounded-xl border bg-card p-4 space-y-3 text-left shadow-sm">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-primary" /> Reconciliation Summary vs SMS
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      {reconciliation.matchRate}% Match Rate
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border bg-emerald-500/5 p-3">
                      <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {reconciliation.matched}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">Matched SMS</p>
                    </div>
                    <div className="rounded-lg border bg-amber-500/5 p-3">
                      <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                        {reconciliation.missed}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">Missed (Added)</p>
                    </div>
                    <div className="rounded-lg border bg-rose-500/5 p-3">
                      <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                        {reconciliation.extra}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">SMS Extra</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading extracted candidates from staging...
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">No candidates staged for this document.</p>
            </div>
          ) : (
            <>
              {/* Bulk Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 p-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={selectedIds.size === candidates.length}
                      onCheckedChange={toggleSelectAll}
                      id="select-all"
                    />
                    <label htmlFor="select-all" className="font-semibold cursor-pointer select-none">
                      Select All ({selectedIds.size}/{candidates.length})
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectHighConfidence}
                    className="h-7 text-[11px] px-2"
                  >
                    Select High Confidence (&ge;80%)
                  </Button>
                </div>

                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">Apply to selected:</span>
                    <Select onValueChange={(val: any) => applyBulkTarget(val)}>
                      <SelectTrigger className="h-7 w-[160px] text-[11px]">
                        <SelectValue placeholder="Set Target..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transaction-credit">Transaction (Credit)</SelectItem>
                        <SelectItem value="transaction-debit">Transaction (Debit)</SelectItem>
                        <SelectItem value="loan-emi">Loan / EMI Account</SelectItem>
                        <SelectItem value="ignore">Ignore Selected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Candidates Table */}
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-[10px] font-semibold text-muted-foreground border-b">
                    <tr>
                      <th className="px-3 py-2 text-left w-8">#</th>
                      <th className="px-3 py-2 text-left">Location</th>
                      <th className="px-3 py-2 text-left">Extracted Fields / Details</th>
                      <th className="px-3 py-2 text-left">Confidence</th>
                      <th className="px-3 py-2 text-left">Target Component</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[11px]">
                    {candidates.map((c, i) => {
                      let payload: any = {};
                      try {
                        payload = JSON.parse(c.extractedValue);
                      } catch {
                        payload = { rawText: c.extractedValue };
                      }

                      const isExpanded = expandedRowIds.has(c.id);
                      const isSelected = selectedIds.has(c.id);

                      return (
                        <React.Fragment key={c.id}>
                          <tr className={cn("hover:bg-muted/20 transition-colors", isSelected && "bg-primary/5")}>
                            <td className="px-3 py-2 shrink-0">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(val) => {
                                  setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (val) next.add(c.id);
                                    else next.delete(c.id);
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                              {c.sourceLocation}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpand(c.id)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>

                                <div>
                                  {payload.counterparty && (
                                    <span className="font-semibold text-foreground mr-1.5">
                                      {payload.counterparty}
                                    </span>
                                  )}
                                  {payload.date && (
                                    <span className="text-muted-foreground text-[10px] mr-1.5 font-mono">
                                      [{payload.date}]
                                    </span>
                                  )}
                                  {payload.amount && (
                                    <span className={cn("font-bold tabular-nums",
                                      payload.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                    )}>
                                      {payload.type === "credit" ? "+" : "-"}{formatINR(payload.amount)}
                                    </span>
                                  )}
                                  {payload.accountNumber && (
                                    <span className="font-mono text-muted-foreground">Acc: {payload.accountNumber}</span>
                                  )}
                                  {payload.emiAmount && (
                                    <span className="font-semibold text-primary">EMI: {formatINR(payload.emiAmount)}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {getConfidenceBadge(c.confidence)}
                            </td>
                            <td className="px-3 py-2">
                              <Select
                                value={decisions[c.id] || "ignore"}
                                onValueChange={(val) => handleTargetChange(c.id, val)}
                              >
                                <SelectTrigger className="h-7 text-[11px] w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="transaction-credit">Transaction (Credit)</SelectItem>
                                  <SelectItem value="transaction-debit">Transaction (Debit)</SelectItem>
                                  <SelectItem value="loan-emi">Loan / EMI Account</SelectItem>
                                  <SelectItem value="account-metadata">Account Metadata Only</SelectItem>
                                  <SelectItem value="ignore">Ignore Row</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>

                          {/* Expandable Raw Text View (Requirement 4) */}
                          {isExpanded && (
                            <tr className="bg-muted/30">
                              <td colSpan={5} className="px-4 py-2.5">
                                <div className="rounded-md border bg-card p-2 font-mono text-[10px] text-muted-foreground space-y-1">
                                  <p className="font-semibold text-foreground text-[11px]">Source Line Token Content:</p>
                                  <p className="whitespace-pre-wrap select-all">{payload.rawText || c.extractedValue}</p>
                                  {payload.refNo && <p><span className="text-primary">Ref/UTR No:</span> {payload.refNo}</p>}
                                  {payload.balance && <p><span className="text-primary">Closing Balance:</span> {formatINR(payload.balance)}</p>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {importSuccess ? "Close" : "Cancel"}
          </Button>

          {!importSuccess && candidates.length > 0 && (
            <Button
              size="sm"
              onClick={handleCommitImport}
              disabled={importing || selectedIds.size === 0}
              className="gap-1.5"
            >
              {importing ? "Committing Import..." : `Import Selected (${selectedIds.size})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

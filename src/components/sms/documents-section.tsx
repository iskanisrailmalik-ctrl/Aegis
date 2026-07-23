"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  FileText,
  Upload,
  Trash2,
  FileCheck,
  FileWarning,
  Loader2,
  TrendingUp,
  Shield,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Lock,
  Eye,
  Layers,
  Sparkles,
} from "lucide-react";
import { ImportReviewDialog } from "@/components/sms/import-review-dialog";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useReconcileAction,
  type DocumentRow,
} from "./use-intelligence";
import { VaultUnlock } from "./vault-unlock";
import { ScreenGuideCard } from "./screen-guide-card";
import { formatINR, relativeTime } from "./format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, { icon: React.ReactNode; cls: string }> = {
  parsed: { icon: <FileCheck className="h-2.5 w-2.5" />, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  needsReview: { icon: <FileWarning className="h-2.5 w-2.5" />, cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  failed: { icon: <FileWarning className="h-2.5 w-2.5" />, cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  pending: { icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />, cls: "border-muted-foreground/30 bg-muted text-muted-foreground" },
};

export function DocumentsSection() {
  const docsQ = useDocuments();
  const delMut = useDeleteDocument();
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<{ id: string; name: string } | null>(null);

  const docs = docsQ.data?.documents ?? [];
  const PREVIEW_COUNT = 3;
  const visibleDocs = expanded ? docs : docs.slice(0, PREVIEW_COUNT);
  const hiddenCount = docs.length - PREVIEW_COUNT;

  const onDelete = async (id: string) => {
    try {
      await delMut.mutateAsync(id);
      toast.success("Document deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-3">
        <ScreenGuideCard viewKey="documents" />
      </div>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Documents</h2>
          {docs.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {docs.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {docs.length > PREVIEW_COUNT && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              {expanded ? "Show Less" : `+${hiddenCount} more`}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUpload(true)}
            className="h-7 gap-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        </div>
      </div>

      {docsQ.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg shimmer" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No documents uploaded</p>
          <p className="max-w-[20rem] text-xs text-muted-foreground">
            Upload loan agreements, EMI schedules, or bank statements (CSV) to
            enrich and reconcile your SMS-derived data.
          </p>
        </div>
      ) : (
        <div className={cn("overflow-y-auto scrollbar-thin", expanded ? "max-h-96" : "max-h-80")}>
          <ul className="divide-y">
            {visibleDocs.map((doc) => {
              const status = STATUS_STYLE[doc.extractionStatus] ?? STATUS_STYLE.pending;
              return (
                <li
                  key={doc.id}
                  className="group flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                  onClick={() => setSelected(doc)}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{doc.fileName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="capitalize">{doc.documentType.replace(/([A-Z])/g, " $1")}</span>
                      {doc.sourceInstitution && (
                        <span className="opacity-70">· {doc.sourceInstitution}</span>
                      )}
                      <span className="opacity-70">· {relativeTime(doc.uploadedAt)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewDoc({ id: doc.id, name: doc.fileName });
                    }}
                  >
                    <FileCheck className="h-3 w-3 text-primary" /> Review
                  </Button>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-medium capitalize",
                      status.cls
                    )}
                  >
                    {status.icon}
                    {doc.extractionStatus}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(doc.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
          {!expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="flex w-full items-center justify-center gap-1.5 border-t bg-muted/20 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-primary"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Show all {docs.length} documents
            </button>
          )}
          {expanded && docs.length > PREVIEW_COUNT && (
            <button
              onClick={() => setExpanded(false)}
              className="flex w-full items-center justify-center gap-1.5 border-t bg-muted/20 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-primary"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </button>
          )}
        </div>
      )}

      <UploadDocumentDialog open={showUpload} onOpenChange={setShowUpload} onUploadSuccess={(id, name) => setReviewDoc({ id, name })} />
      <DocumentDetailDialog doc={selected} onClose={() => setSelected(null)} />
      
      {reviewDoc && (
        <ImportReviewDialog
          open={!!reviewDoc}
          onOpenChange={(v) => { if (!v) setReviewDoc(null); }}
          documentId={reviewDoc.id}
          documentName={reviewDoc.name}
        />
      )}
    </Card>
  );
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  onUploadSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploadSuccess?: (id: string, name: string) => void;
}) {
  const uploadMut = useUploadDocument();
  const [docType, setDocType] = useState<"auto" | "loanAgreement" | "emiSchedule" | "bankStatement">("auto");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [institution, setInstitution] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDocType("auto");
    setFileName("");
    setContent("");
    setInstitution("");
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result || ""));
    };
    reader.readAsText(file);
  };

  const upload = async () => {
    if (!fileName || !content) {
      toast.error("Provide a file name and content");
      return;
    }
    try {
      // Use enhanced ingestion endpoint
      const response = await fetch("/api/documents/enhanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: docType,
          fileName,
          content,
          sourceInstitution: institution || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      const r = await response.json();

      // Show detection result
      if (docType === "auto") {
        const typeLabel = r.documentType.replace(/([A-Z])/g, " $1").trim();
        toast.info(`Detected: ${typeLabel}`, {
          description: r.detectionReasons?.[0] ?? `Confidence: ${r.detectionConfidence}`,
        });
      }

      // Show summary of actions
      if (r.actions && r.actions.length > 0) {
        toast.success(`Processed: ${r.actions.length} actions`, {
          description: r.actions.slice(0, 2).join(" · "),
        });
      }

      // Show reconciliation results
      if (r.reconciliation) {
        toast.success(`Statement reconciled: ${r.reconciliation.matchRate}% match`, {
          description: `${r.reconciliation.matched} matched, ${r.reconciliation.missed} added, ${r.reconciliation.extra} extra`,
        });
      }

      // Show loan extraction results
      if (r.loanFields?.emiAmount) {
        toast.success(`Loan extracted: EMI ${formatINR(r.loanFields.emiAmount)}`, {
          description: r.loanFields.lender ? `Lender: ${r.loanFields.lender}` : undefined,
        });
      }

      if (r.metrics?.needsReview) {
        toast.warning("Document needs review", {
          description: "Some fields could not be extracted automatically.",
        });
      }

      reset();
      onOpenChange(false);
      if (r.documentId && onUploadSuccess) {
        onUploadSuccess(r.documentId, fileName);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-1.5rem)] max-w-lg gap-0 p-0 rounded-xl overflow-hidden">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4 text-primary" />
            Upload Document
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Document Type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as typeof docType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🤖 Auto-detect (recommended)</SelectItem>
                <SelectItem value="bankStatement">Bank Statement (CSV)</SelectItem>
                <SelectItem value="loanAgreement">Loan Agreement</SelectItem>
                <SelectItem value="emiSchedule">EMI Schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">File</Label>
            <div className="flex gap-2">
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="filename.csv"
                className="h-9 text-xs"
              />
              <label
                htmlFor="mobile-doc-file-input"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                Browse
                <input
                  id="mobile-doc-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept="text/csv,text/plain,application/json,.csv,.txt,.json,.pdf,.html,.md,application/pdf,text/*,*/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    if (e.target) e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Source Institution (optional)</Label>
            <Input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g., HDFC Bank, Bajaj Finserv"
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content (or paste CSV text)</Label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={docType === "bankStatement" ? "date,description,amount,type,balance\n..." : "Loan agreement text…"}
              className="min-h-[100px] w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/20 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={uploadMut.isPending} className="gap-1.5">
            {uploadMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload & Extract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDetailDialog({
  doc,
  onClose,
}: {
  doc: DocumentRow | null;
  onClose: () => void;
}) {
  const [showVault, setShowVault] = useState(false);
  const [vaultContent, setVaultContent] = useState<string | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"after" | "before" | "compare">("after");

  if (!doc) return null;
  const fields = doc.extractedFields ? JSON.parse(doc.extractedFields) : {};
  const recon = doc.reconciliationSummary ? JSON.parse(doc.reconciliationSummary) : null;

  const fetchVaultContent = async () => {
    setVaultLoading(true);
    try {
      const r = await fetch(`/api/documents/${doc.id}/vault`);
      if (!r.ok) throw new Error("Access denied");
      const data = await r.json();
      setVaultContent(data.vault?.content || "Content not available");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to access vault");
    } finally {
      setVaultLoading(false);
    }
  };

  return (
    <>
      <Dialog open={!!doc} onOpenChange={(v) => !v && onClose()}>
        <DialogContent aria-describedby={undefined} className="w-[calc(100%-1.5rem)] max-w-5xl h-[90vh] gap-0 p-0 rounded-2xl overflow-hidden flex flex-col shadow-2xl border">
          {/* Top Header Bar */}
          <DialogHeader className="border-b px-5 py-3 shrink-0 pr-12 bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-sm font-bold flex items-center gap-2">
                  {doc.fileName}
                  <Badge variant="outline" className={cn("text-[9px] capitalize", (STATUS_STYLE[doc.extractionStatus] ?? STATUS_STYLE.pending).cls)}>
                    {(STATUS_STYLE[doc.extractionStatus] ?? STATUS_STYLE.pending).icon}
                    {doc.extractionStatus}
                  </Badge>
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground truncate">
                  {doc.sourceInstitution ? `${doc.sourceInstitution} • ` : ""}{doc.documentType.replace(/([A-Z])/g, " $1")}
                </p>
              </div>
            </div>

            {/* Segmented Control Switcher */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <div className="flex items-center rounded-lg border bg-background p-0.5 text-xs">
                <button
                  onClick={() => setViewMode("before")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors text-[11px]",
                    viewMode === "before" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Before (Original)
                </button>
                <button
                  onClick={() => setViewMode("after")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors text-[11px]",
                    viewMode === "after" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  After (AI Parsed)
                </button>
                <button
                  onClick={() => setViewMode("compare")}
                  className={cn(
                    "hidden md:flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors text-[11px]",
                    viewMode === "compare" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="h-3 w-3" />
                  Side-by-Side
                </button>
              </div>

              {!vaultContent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowVault(true)}
                  className="h-8 gap-1 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Unlock Original
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Main Full-Screen Content Area */}
          <div className="flex-1 overflow-hidden p-4 sm:p-5 bg-background/50">
            {/* 1. Compare Side-by-Side Layout */}
            {viewMode === "compare" && (
              <div className="grid grid-cols-2 gap-4 h-full overflow-hidden">
                {/* Left Pane: Original */}
                <div className="flex flex-col rounded-xl border bg-muted/10 overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-xs font-semibold">
                    <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-primary" /> Before — Raw Uploaded Source</span>
                    {vaultContent && (
                      <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(vaultContent)} className="h-6 text-[10px]">
                        Copy Text
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                    {vaultContent ? (
                      <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{vaultContent}</pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                        <Shield className="h-10 w-10 text-primary/40 animate-pulse" />
                        <div>
                          <p className="text-xs font-semibold">Encrypted Vault Protected</p>
                          <p className="text-[11px] text-muted-foreground">Authenticate with Passkey / PIN to view original source file text.</p>
                        </div>
                        <Button size="sm" onClick={() => setShowVault(true)} className="gap-1.5 text-xs">
                          <Lock className="h-3.5 w-3.5" /> Unlock Vault Source
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Pane: Parsed */}
                <div className="flex flex-col rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-xs font-semibold">
                    <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> After — AI Structured Extraction</span>
                    <Badge variant="secondary" className="text-[9px]">RAG Knowledge Indexed</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                    <ParsedDetailsView fields={fields} recon={recon} doc={doc} />
                  </div>
                </div>
              </div>
            )}

            {/* 2. Before (Original Source) Layout */}
            {viewMode === "before" && (
              <div className="h-full flex flex-col rounded-xl border bg-muted/10 overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold">
                  <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Original Source Document</span>
                  {vaultContent && (
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(vaultContent)} className="h-7 text-xs gap-1">
                      <Copy className="h-3 w-3" /> Copy Raw Text
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                  {vaultContent ? (
                    <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap bg-background p-4 rounded-lg border">{vaultContent}</pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 max-w-sm mx-auto">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <Lock className="h-7 w-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">Document Vault Locked</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Original file content is stored with AES-GCM local encryption. Unlock with Passkey biometrics or PIN.
                        </p>
                      </div>
                      <Button onClick={() => setShowVault(true)} className="gap-2 text-xs w-full">
                        <Shield className="h-4 w-4" />
                        Unlock Original Document
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. After (AI Parsed & Structured) Layout */}
            {viewMode === "after" && (
              <div className="h-full flex flex-col rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold">
                  <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Final Structured Extraction & RAG Summary</span>
                  <Badge variant="secondary" className="text-[10px]">High Confidence</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin">
                  <ParsedDetailsView fields={fields} recon={recon} doc={doc} />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Vault unlock dialog */}
      <VaultUnlock
        open={showVault}
        onOpenChange={setShowVault}
        onUnlock={() => {
          fetchVaultContent();
          setViewMode("before");
        }}
        title="Unlock Document"
        description={`Authenticate to view the original content of ${doc.fileName}`}
      />
    </>
  );
}

function ReconciliationActions({
  docId,
  details,
}: {
  docId: string;
  details: Array<{
    statementRow?: { date?: string; description?: string; amount?: number; type?: string };
    matchedTransactionId?: string;
    status: "matched" | "missed" | "extra";
  }>;
}) {
  const reconcileMut = useReconcileAction();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const actionable = details
    .map((d, i) => ({ ...d, idx: i }))
    .filter((d) => d.status !== "matched" && !dismissed.has(d.idx));

  if (actionable.length === 0) return null;

  const handleAction = async (
    item: typeof actionable[number],
    action: "add" | "flag" | "ignore"
  ) => {
    try {
      await reconcileMut.mutateAsync({
        action,
        documentId: docId,
        statementRow: item.statementRow,
        transactionId: item.matchedTransactionId,
      });
      setDismissed((prev) => new Set(prev).add(item.idx));
      if (action === "add") {
        toast.success("Transaction added from statement", {
          description: `${item.statementRow?.description} — ₹${item.statementRow?.amount}`,
        });
      } else if (action === "flag") {
        toast.success("Transaction flagged for review");
      } else {
        toast.info("Item dismissed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Review Items ({actionable.length})
      </p>
      <div className="max-h-40 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1">
          {actionable.map((item) => (
            <li
              key={item.idx}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
            >
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0 text-[8px] font-medium",
                  item.status === "missed"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                )}
              >
                {item.status === "missed" ? "Missed" : "Extra"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px]">
                {item.statementRow?.description ?? `SMS transaction ${item.matchedTransactionId?.slice(-6)}`}
                {item.statementRow?.amount && (
                  <span className="ml-1 font-medium tabular-nums">
                    ₹{item.statementRow.amount}
                  </span>
                )}
              </span>
              <div className="flex shrink-0 gap-0.5">
                {item.status === "missed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(item, "add")}
                    disabled={reconcileMut.isPending}
                    className="h-5 px-1.5 text-[9px] text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                    title="Add as transaction"
                  >
                    Add
                  </Button>
                )}
                {item.status === "extra" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(item, "flag")}
                    disabled={reconcileMut.isPending}
                    className="h-5 px-1.5 text-[9px] text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300"
                    title="Flag for review"
                  >
                    Flag
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction(item, "ignore")}
                  disabled={reconcileMut.isPending}
                  className="h-5 px-1.5 text-[9px] text-muted-foreground hover:bg-muted"
                  title="Dismiss"
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ParsedDetailsView({
  fields,
  recon,
  doc,
}: {
  fields: Record<string, any>;
  recon: any;
  doc: DocumentRow;
}) {
  return (
    <div className="space-y-4 text-xs">
      {/* Key Extracted Metrics Card */}
      {fields.loanFields && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {fields.loanFields.lender && (
            <div className="rounded-xl border bg-primary/5 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">Lender</p>
              <p className="text-sm font-bold text-primary truncate mt-0.5">{fields.loanFields.lender}</p>
            </div>
          )}
          {fields.loanFields.principal && (
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">Principal</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{formatINR(fields.loanFields.principal)}</p>
            </div>
          )}
          {fields.loanFields.emiAmount && (
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">Monthly EMI</p>
              <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">{formatINR(fields.loanFields.emiAmount)}</p>
            </div>
          )}
          {fields.loanFields.interestRate && (
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">Interest Rate</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{fields.loanFields.interestRate}% p.a.</p>
            </div>
          )}
        </div>
      )}

      {/* Summary Box */}
      {fields.loanFields && (
        <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" /> Generated Overview & Terms
          </p>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90">
            {fields.loanFields.lender ? `${fields.loanFields.lender} loan` : "Loan"}
            {fields.loanFields.principal ? ` of ₹${fields.loanFields.principal.toLocaleString("en-IN")}` : ""}
            {fields.loanFields.emiAmount ? ` with EMI ₹${fields.loanFields.emiAmount.toLocaleString("en-IN")}` : ""}
            {fields.loanFields.tenure ? ` for ${fields.loanFields.tenure} months` : ""}
            {fields.loanFields.interestRate ? ` at ${fields.loanFields.interestRate}% p.a.` : ""}
            {"\n"}
            {fields.loanFields.emiAmount && fields.loanFields.tenure
              ? `Total contract payable: ₹${(fields.loanFields.emiAmount * fields.loanFields.tenure).toLocaleString("en-IN")}`
              : ""}
          </pre>
        </div>
      )}

      {/* Terms & Conditions */}
      {fields.termsAndConditions && fields.termsAndConditions.length > 0 && (
        <div className="rounded-xl border p-3.5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Extracted Terms & Conditions ({fields.termsAndConditions.length})
          </p>
          <ul className="space-y-1.5">
            {fields.termsAndConditions.map((tc: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                <span className="text-muted-foreground leading-relaxed">{tc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* EMI Schedule Table */}
      {fields.emiSchedule && fields.emiSchedule.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="border-b bg-muted/30 px-3.5 py-2 font-semibold text-xs flex items-center justify-between">
            <span>EMI Schedule ({fields.emiSchedule.length} installments)</span>
            <span className="text-[10px] text-muted-foreground">Auto-generated</span>
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/50 text-[11px]">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">#</th>
                  <th className="px-3 py-1.5 text-left font-medium">Due Date</th>
                  <th className="px-3 py-1.5 text-right font-medium">EMI Amount</th>
                  <th className="px-3 py-1.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {fields.emiSchedule.slice(0, 20).map((emi: any, i: number) => (
                  <tr key={i} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-1 font-medium">{emi.installmentNumber}</td>
                    <td className="px-3 py-1">{new Date(emi.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-3 py-1 text-right tabular-nums font-semibold">{formatINR(emi.amount)}</td>
                    <td className="px-3 py-1 text-right">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                        emi.status === "paid" ? "bg-emerald-500/10 text-emerald-600" :
                        emi.status === "overdue" ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                      )}>{emi.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statement Extracted Transactions Table */}
      {fields.statementRows && fields.statementRows.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="border-b bg-muted/30 px-3.5 py-2 font-semibold text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> Parsed Statement Transactions ({fields.statementRows.length} items)</span>
            <Badge variant="secondary" className="text-[9px]">Extracted Date, Ref, Amount, Bal</Badge>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs text-[10px] border-b">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Date</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Narration / Counterparty</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Ref / UTR No</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Amount</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {fields.statementRows.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-medium shrink-0 whitespace-nowrap">{r.date || "—"}</td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate" title={r.description}>
                      {r.description || "—"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{r.refNo || "—"}</td>
                    <td className={cn("px-3 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap",
                      r.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {r.type === "credit" ? "+" : "-"}{r.amount ? formatINR(r.amount) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                      {r.balance ? formatINR(r.balance) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statement Reconciliation */}
      {recon && (
        <div className="rounded-xl border p-3.5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Statement Reconciliation Summary
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-emerald-500/5 p-2.5">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{recon.matched}</p>
              <p className="text-[10px] text-muted-foreground">Matched SMS</p>
            </div>
            <div className="rounded-lg border bg-amber-500/5 p-2.5">
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{recon.missed}</p>
              <p className="text-[10px] text-muted-foreground">Missed (Added)</p>
            </div>
            <div className="rounded-lg border bg-rose-500/5 p-2.5">
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{recon.extra}</p>
              <p className="text-[10px] text-muted-foreground">SMS Extra</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

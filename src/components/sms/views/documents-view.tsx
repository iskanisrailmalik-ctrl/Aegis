"use client";

import { DocumentsSection } from "../documents-section";
import { useDocuments } from "../use-intelligence";
import {
  FileText,
  FileCheck,
  FileWarning,
  Shield,
  Upload,
  ClipboardPaste,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PasteSmsDialog } from "../paste-sms-dialog";
import { useState } from "react";

export function DocumentsView() {
  const docsQ = useDocuments();
  const docs = docsQ.data?.documents ?? [];
  const [pasteOpen, setPasteOpen] = useState(false);

  // ---- KPIs ----
  const parsed = docs.filter((d) => d.extractionStatus === "parsed").length;
  const needsReview = docs.filter((d) => d.extractionStatus === "needsReview").length;
  const secured = docs.length; // all docs go through the vault
  const loanDocs = docs.filter((d) => d.documentType === "loanAgreement" || d.documentType === "emiSchedule").length;

  return (
    <div className="space-y-5">
      {/* Page header with Paste SMS button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
            <p className="text-xs text-muted-foreground">
              Upload loan agreements, EMI schedules, and bank statements — auto-extracted and encrypted.
            </p>
          </div>
        </div>
        <Button onClick={() => setPasteOpen(true)} size="sm" className="gap-1.5 shadow-sm">
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste SMS
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<FileText className="h-4 w-4" />}
          label="Total Documents"
          value={docsQ.isLoading ? "—" : String(docs.length)}
          sub={loanDocs > 0 ? `${loanDocs} loan docs` : "No documents"}
          tone="primary"
        />
        <KpiCard
          icon={<FileCheck className="h-4 w-4" />}
          label="Parsed"
          value={docsQ.isLoading ? "—" : String(parsed)}
          sub={docs.length > 0 ? `${Math.round((parsed / docs.length) * 100)}% success rate` : "—"}
          tone="emerald"
        />
        <KpiCard
          icon={<FileWarning className="h-4 w-4" />}
          label="Needs Review"
          value={docsQ.isLoading ? "—" : String(needsReview)}
          sub={needsReview > 0 ? "Action required" : "All clear"}
          tone={needsReview > 0 ? "amber" : "muted"}
        />
        <KpiCard
          icon={<Shield className="h-4 w-4" />}
          label="Secured"
          value={docsQ.isLoading ? "—" : String(secured)}
          sub="AES-GCM encrypted"
          tone="emerald"
        />
      </div>

      {/* Documents section */}
      <DocumentsSection />

      {/* Paste SMS Dialog */}
      <PasteSmsDialog open={pasteOpen} onOpenChange={setPasteOpen} />
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

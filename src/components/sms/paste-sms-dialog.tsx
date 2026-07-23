"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardPaste,
  Loader2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Wand2,
} from "lucide-react";
import { useParseSms, usePreviewSms } from "./use-sms-data";
import { toast } from "sonner";
import { formatINR } from "./format";

interface Preview {
  parsed: boolean;
  classification: string;
  reason: string;
  signals: { key: string; label: string; severity: string }[];
  fields: Record<string, unknown>;
  bank?: string;
  senderType?: string;
  isEmi?: boolean;
}

export function PasteSmsDialog({
  open,
  onOpenChange,
  onNewTransaction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNewTransaction?: (tx: {
    amount: number;
    type: "credit" | "debit";
    merchant?: string | null;
    bank?: string | null;
    isEmi?: boolean;
    emiAmount?: number;
    lender?: string;
    extra?: string | null;
  }) => void;
}) {
  const [sender, setSender] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  const previewMut = usePreviewSms();
  const parseMut = useParseSms();

  const reset = useCallback(() => {
    setSender("");
    setText("");
    setPreview(null);
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset]
  );

  const doPreview = async () => {
    if (!text.trim()) {
      toast.error("Please paste an SMS message first.");
      return;
    }
    try {
      const r = (await previewMut.mutateAsync({
        sender: sender || undefined,
        text,
      })) as unknown as Preview;
      setPreview(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const doSave = async () => {
    if (!text.trim()) {
      toast.error("Please paste an SMS message first.");
      return;
    }
    try {
      const r = await parseMut.mutateAsync({
        sender: sender || undefined,
        text,
      });
      if (r.classification === "verified") {
        toast.success("Verified transaction saved.", {
          description: r.fields
            ? `${r.fields.type === "credit" ? "Credited" : "Debited"} ${formatINR(Number(r.fields.amount))}${r.fields.merchant ? ` · ${r.fields.merchant}` : ""}`
            : undefined,
        });
        // Voice engine: pronounce the new transaction
        if (onNewTransaction && r.fields) {
          const f = r.fields as Record<string, unknown>;
          onNewTransaction({
            amount: Number(f.amount),
            type: (f.type as "credit" | "debit") ?? "debit",
            merchant: (f.merchant as string) ?? null,
            bank: (f.bank as string) ?? null,
            isEmi: Boolean(f.isEmi),
            emiAmount: f.emiAmount ? Number(f.emiAmount) : undefined,
            lender: (f.lender as string) ?? undefined,
            extra: f.extra ? JSON.stringify(f.extra) : null,
          });
        }
      } else if (r.classification === "flagged") {
        toast.warning("Flagged as suspicious — moved to Security Alerts.", {
          description: r.reason,
        });
      } else {
        toast.info("Saved as unverified / promotional.", {
          description: r.reason,
        });
      }
      if (r.loanCreated) {
        toast.message("New loan account created from EMI SMS.", {
          description: "Review it in the Loans section.",
        });
      }
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-1.5rem)] max-w-2xl gap-0 p-0 rounded-xl overflow-hidden">
        <DialogHeader className="space-y-2 border-b bg-gradient-to-br from-primary/5 to-transparent px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardPaste className="h-4 w-4 text-primary" />
            Paste an SMS
          </DialogTitle>
          <DialogDescription className="text-xs">
            Share or paste a bank / UPI / NBFC SMS. It is parsed locally on your
            device and never uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="sms-sender" className="text-xs">
              Sender (optional)
            </Label>
            <Input
              id="sms-sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="e.g. SBIINB, HDFCBK, PHONPE, or +91…"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sms-text" className="text-xs">
              SMS Message
            </Label>
            <Textarea
              id="sms-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full SMS text here…"
              className="min-h-[120px] resize-y font-mono text-xs leading-relaxed"
            />
          </div>

          {preview && (
            <PreviewPanel preview={preview} />
          )}

          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Try one of these:
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSender(ex.sender);
                    setText(ex.text);
                    setPreview(null);
                  }}
                  className="rounded-md border bg-background px-2 py-1 text-[10px] transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-3">
          <Button
            variant="outline"
            onClick={doPreview}
            disabled={previewMut.isPending || !text.trim()}
            className="gap-1.5"
          >
            {previewMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Preview
          </Button>
          <Button
            onClick={doSave}
            disabled={parseMut.isPending || !text.trim()}
            className="gap-1.5"
          >
            {parseMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Parse & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPanel({ preview }: { preview: Preview }) {
  const tone =
    preview.classification === "verified"
      ? "emerald"
      : preview.classification === "flagged"
        ? "rose"
        : "amber";
  const Icon =
    preview.classification === "verified"
      ? ShieldCheck
      : preview.classification === "flagged"
        ? ShieldAlert
        : Shield;
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
      : tone === "rose"
        ? "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300"
        : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";

  return (
    <div className={`rounded-lg border p-3 ${toneCls} animate-fade-in`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {preview.classification}
        </span>
        {preview.bank && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            {preview.bank}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs opacity-90">{preview.reason}</p>
      {preview.parsed && preview.fields?.amount !== undefined && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold tabular-nums">
            {preview.fields.type === "credit" ? "+" : "−"}{" "}
            {formatINR(Number(preview.fields.amount))}
          </span>
          {preview.fields.merchant !== undefined && preview.fields.merchant !== null && preview.fields.merchant !== "" && (
            <span className="opacity-80">· {String(preview.fields.merchant)}</span>
          )}
          {preview.fields.balance !== undefined && (
            <span className="opacity-70">
              · Bal {formatINR(Number(preview.fields.balance))}
            </span>
          )}
          {preview.isEmi && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-[10px]"
            >
              EMI
            </Badge>
          )}
        </div>
      )}
      {preview.signals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {preview.signals.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center rounded-full bg-background/60 px-1.5 py-0.5 text-[9px]"
            >
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const EXAMPLES = [
  {
    label: "SBI debit",
    sender: "SBIINB",
    text: "Rs 1,250.00 debited from A/c XX1234 on 12-Nov-24 via UPI to AMAZON PAY. Avl Bal Rs 24,530.50-SBI",
  },
  {
    label: "HDFC credit",
    sender: "HDFCBK",
    text: "Rs 45,000.00 credited to A/c XX5678 from NEFT-SALARIES on 12-Nov-24. Avl Bal Rs 1,12,450.00-HDFC",
  },
  {
    label: "Bajaj EMI",
    sender: "BAJAJFINSERV",
    text: "EMI of Rs 8,500.00 due on 15-Nov-24 for Loan A/c LNSB9981234. Please keep sufficient balance-Bajaj Finserv",
  },
  {
    label: "Scam SMS",
    sender: "+919876543210",
    text: "Dear Customer, your SBI account will be blocked today. Update your KYC immediately. Click here: http://bit.ly/sbi-kyc-update",
  },
  {
    label: "KBC lottery scam",
    sender: "+917012345678",
    text: "Congratulations! You have won Rs 5,00,000 in KBC Lottery 2024. To claim your prize call now on +917012345678 and share your OTP.",
  },
];

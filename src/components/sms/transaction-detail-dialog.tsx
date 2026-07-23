"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  Volume2,
  Pencil,
  Save,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  StickyNote,
  Share2,
  Copy,
} from "lucide-react";
import type { TxRow } from "./use-sms-data";
import { parseTags } from "@/lib/sms/tags";
import { SplitEditor } from "./split-editor";
import { useDeleteTransaction, useUpdateTransaction } from "./use-sms-data";
import { formatINR, formatDate, parseExtra } from "./format";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";

export function TransactionDetailDialog({
  tx,
  open,
  onOpenChange,
  onSpeak,
  muted,
}: {
  tx: TxRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSpeak: (tx: TxRow) => void;
  muted: boolean;
}) {
  const delMut = useDeleteTransaction();
  const updMut = useUpdateTransaction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ merchant: string; amount: number; category: string; note: string }>({
    merchant: "",
    amount: 0,
    category: "",
    note: "",
  });

  if (!tx) return null;
  const extra = parseExtra(tx.extra);
  const isCredit = tx.type === "credit";

  const startEdit = () => {
    setDraft({
      merchant: tx.merchant ?? "",
      amount: tx.amount,
      category: tx.category ?? "",
      note: tx.note ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    const categoryChanged = draft.category !== (tx.category ?? "");
    try {
      await updMut.mutateAsync({
        id: tx.id,
        patch: {
          merchant: draft.merchant || null,
          amount: draft.amount,
          category: draft.category || null,
          note: draft.note || null,
        },
      });
      if (categoryChanged && draft.merchant) {
        toast.success("Transaction updated", {
          description: `Future ${draft.merchant} transactions will be auto-categorized as ${CATEGORIES[draft.category as CategoryKey]?.label ?? draft.category}.`,
        });
      } else {
        toast.success("Transaction updated");
      }
      setEditing(false);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const del = async () => {
    try {
      await delMut.mutateAsync(tx.id);
      toast.success("Transaction deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg gap-0 p-0">
        <DialogHeader className="gap-0 border-b px-6 py-4 pr-12">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full ring-1",
                isCredit
                  ? "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300"
                  : "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-300"
              )}
            >
              {isCredit ? (
                <ArrowDownLeft className="h-5 w-5" />
              ) : (
                <ArrowUpRight className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base">
                {tx.merchant || (extra.lender as string) || tx.bank || "Transaction"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {tx.bank || tx.senderType} · {formatDate(tx.txDate)}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  isCredit
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {isCredit ? "+" : "−"} {formatINR(tx.amount)}
              </p>
              {tx.balance !== null && (
                <p className="text-[10px] text-muted-foreground">
                  Bal {formatINR(tx.balance)}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4 text-sm">
          <Field label="Type" value={isCredit ? "Credited" : "Debited"} />
          <Field label="Bank / Sender" value={`${tx.bank ?? "—"} · ${tx.sender ?? "—"}`} />
          <Field
            label="Account / Card"
            value={tx.accountMasked ? `••${tx.accountMasked.slice(-4)}` : "—"}
          />
          {extra.card != null && <Field label="Card" value={`••${String(extra.card).slice(-4)}`} />}
          {extra.isEmi != null && extra.isEmi !== false && (
            <Field
              label="EMI"
              value={
                extra.emiAmount
                  ? `${formatINR(Number(extra.emiAmount))}${extra.lender ? ` · ${extra.lender}` : ""}`
                  : "Yes"
              }
            />
          )}
          <Field
            label="Classification"
            value={
              <Badge
                variant="outline"
                className={cn(
                  tx.classification === "verified"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : tx.classification === "flagged"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                )}
              >
                {tx.classification}
              </Badge>
            }
          />
          <Field
            label="Category"
            value={
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  CATEGORIES[(tx.category as CategoryKey) ?? "other"]?.badge
                )}
              >
                {CATEGORIES[(tx.category as CategoryKey) ?? "other"]?.label ?? tx.category}
              </Badge>
            }
          />

          {editing && (
            <>
              <Separator />
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Merchant</Label>
                  <Input
                    value={draft.merchant}
                    onChange={(e) => setDraft({ ...draft, merchant: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      value={draft.amount}
                      onChange={(e) =>
                        setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={draft.category || "other"}
                      onValueChange={(v) => setDraft({ ...draft, category: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(CATEGORIES).map((c) => (
                          <SelectItem key={c.key} value={c.key}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tags (comma-separated)</Label>
                  <Input
                    value={draft.note}
                    onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                    placeholder="e.g., Reimbursable, Shared, Q3"
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Separate multiple tags with commas. Each becomes a chip.
                  </p>
                </div>
              </div>
            </>
          )}

          {!editing && parseTags(tx.note).length > 0 && (
            <Field
              label="Tags"
              value={
                <span className="flex flex-wrap justify-end gap-1">
                  {parseTags(tx.note).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      <StickyNote className="h-2.5 w-2.5" />
                      {tag}
                    </span>
                  ))}
                </span>
              }
            />
          )}

          {/* Split editor (only for debits — splitting credits is uncommon) */}
          {!editing && tx.type === "debit" && (
            <SplitEditor txId={tx.id} txAmount={tx.amount} />
          )}

          <Separator />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Raw SMS</p>
            <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap scrollbar-thin">
              {tx.rawMessage}
            </pre>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSpeak(tx)}
            disabled={muted}
            className="mr-auto gap-1.5"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Speak
          </Button>
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={updMut.isPending} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const text = `${tx.type === "credit" ? "+" : "−"} ${formatINR(tx.amount)} — ${tx.merchant || tx.bank || "Transaction"} (${new Date(tx.txDate).toLocaleDateString("en-IN")})`;
                  if (navigator.share) {
                    try { await navigator.share({ title: "Transaction", text }); } catch { /* cancelled */ }
                  } else {
                    await navigator.clipboard.writeText(text);
                    toast.success("Copied to clipboard");
                  }
                }}
                className="gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={del}
                disabled={delMut.isPending}
                className="text-destructive hover:text-destructive gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitSquareHorizontal, Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import type { SplitRow } from "./use-sms-data";
import { useSplits, useSaveSplits } from "./use-sms-data";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { formatINR } from "./format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DraftSplit {
  category: CategoryKey;
  amount: string;
  note: string;
}

export function SplitEditor({
  txId,
  txAmount,
}: {
  txId: string;
  txAmount: number;
}) {
  const splitsQ = useSplits(txId);
  const saveMut = useSaveSplits();

  const splits = splitsQ.data?.splits ?? [];
  const [drafts, setDrafts] = useState<DraftSplit[]>([]);
  const [editing, setEditing] = useState(false);

  // Enter edit mode: initialize drafts from existing splits or a single full-amount draft
  const enterEdit = () => {
    if (splits.length > 0) {
      setDrafts(
        splits.map((s) => ({
          category: (s.category as CategoryKey) ?? "other",
          amount: String(s.amount),
          note: s.note ?? "",
        }))
      );
    } else {
      setDrafts([{ category: "other", amount: String(txAmount), note: "" }]);
    }
    setEditing(true);
  };

  const draftsSum = drafts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const remaining = txAmount - draftsSum;
  const isValid = Math.abs(remaining) < 0.01 && drafts.length > 0 && drafts.every((d) => parseFloat(d.amount) > 0);

  const addDraft = () => {
    setDrafts([...drafts, { category: "other", amount: "", note: "" }]);
  };

  const updateDraft = (i: number, patch: Partial<DraftSplit>) => {
    setDrafts(drafts.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const removeDraft = (i: number) => {
    setDrafts(drafts.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!isValid) {
      toast.error(
        remaining > 0
          ? `₹${remaining.toFixed(2)} unallocated`
          : `₹${Math.abs(remaining).toFixed(2)} over allocated`
      );
      return;
    }
    try {
      await saveMut.mutateAsync({
        txId,
        splits: drafts.map((d) => ({
          category: d.category,
          amount: parseFloat(d.amount),
          note: d.note || undefined,
        })),
      });
      toast.success(`Saved ${drafts.length} split${drafts.length > 1 ? "s" : ""}`);
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (splitsQ.isLoading) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="h-6 w-32 shimmer rounded" />
      </div>
    );
  }

  // View mode (not editing)
  if (!editing) {
    if (splits.length === 0) {
      return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <SplitSquareHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              No splits — full amount in one category
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={enterEdit}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            <SplitSquareHorizontal className="h-3 w-3" />
            Split
          </Button>
        </div>
      );
    }
    return (
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <SplitSquareHorizontal className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Split into {splits.length}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={enterEdit}
            className="h-6 px-2 text-[11px]"
          >
            Edit
          </Button>
        </div>
        <ul className="space-y-1">
          {splits.map((s) => {
            const def = CATEGORIES[(s.category as CategoryKey) ?? "other"];
            return (
              <li key={s.id} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0 text-[9px] font-medium",
                    def?.badge
                  )}
                >
                  {def?.label ?? s.category}
                </span>
                {s.note && (
                  <span className="truncate text-muted-foreground">· {s.note}</span>
                )}
                <span className="ml-auto tabular-nums font-medium">
                  {formatINR(s.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <SplitSquareHorizontal className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">Split Transaction</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {formatINR(txAmount)} total
        </span>
      </div>

      {drafts.map((d, i) => {
        const def = CATEGORIES[d.category];
        return (
          <div key={i} className="flex items-center gap-1.5">
            <Select
              value={d.category}
              onValueChange={(v) => updateDraft(i, { category: v as CategoryKey })}
            >
              <SelectTrigger className="h-8 w-32 text-[11px]">
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
            <Input
              type="number"
              value={d.amount}
              onChange={(e) => updateDraft(i, { amount: e.target.value })}
              placeholder="₹"
              className="h-8 w-20 text-[11px] tabular-nums"
            />
            <Input
              value={d.note}
              onChange={(e) => updateDraft(i, { note: e.target.value })}
              placeholder="note (opt)"
              className="h-8 flex-1 text-[11px]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeDraft(i)}
              disabled={drafts.length <= 1}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={addDraft}
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={draftsSum >= txAmount}
        >
          <Plus className="h-3 w-3" />
          Add split
        </Button>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={cn(
              "tabular-nums font-medium",
              Math.abs(remaining) < 0.01
                ? "text-emerald-600 dark:text-emerald-400"
                : remaining > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400"
            )}
          >
            {Math.abs(remaining) < 0.01 ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Balanced
              </span>
            ) : remaining > 0 ? (
              `${formatINR(remaining)} left`
            ) : (
              `${formatINR(Math.abs(remaining))} over`
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          className="h-7 text-[11px]"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={saveMut.isPending || !isValid}
          className="h-7 gap-1 text-[11px]"
        >
          {saveMut.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <SplitSquareHorizontal className="h-3 w-3" />
          )}
          Save Splits
        </Button>
      </div>
    </div>
  );
}

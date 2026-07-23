"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Volume2,
  Wallet,
  CreditCard,
  Building2,
  Landmark,
  Store,
  Sparkles,
  Search,
  X,
  Download,
  UtensilsCrossed,
  ShoppingBag,
  Receipt,
  Clapperboard,
  Car,
  HeartPulse,
  Plane,
  Banknote,
  ArrowLeftRight,
  TrendingUp,
  CircleDashed,
  StickyNote,
  Tag,
} from "lucide-react";
import type { TxRow } from "./use-sms-data";
import { formatINR, formatDateShort, parseExtra } from "./format";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { parseTags, allTags } from "@/lib/sms/tags";
import { cn } from "@/lib/utils";

const senderTypeIcon: Record<string, React.ReactNode> = {
  bank: <Building2 className="h-3.5 w-3.5" />,
  paymentsBank: <Landmark className="h-3.5 w-3.5" />,
  nbfc: <Sparkles className="h-3.5 w-3.5" />,
  wallet: <Wallet className="h-3.5 w-3.5" />,
  creditCard: <CreditCard className="h-3.5 w-3.5" />,
  unknown: <Store className="h-3.5 w-3.5" />,
};

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  UtensilsCrossed,
  ShoppingBag,
  ReceiptText: Receipt,
  Clapperboard,
  Car,
  HeartPulse,
  Plane,
  Banknote,
  ArrowLeftRight,
  Landmark,
  TrendingUp,
  CircleDashed,
};

type Filter = "all" | "credit" | "debit";

export function RecentTransactions({
  data,
  loading,
  onSelect,
  onSpeak,
  muted,
  onExport,
}: {
  data?: TxRow[];
  loading: boolean;
  onSelect: (tx: TxRow) => void;
  onSpeak: (tx: TxRow) => void;
  muted: boolean;
  onExport: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Compute all distinct tags from data
  const allTagsList = useMemo(() => {
    if (!data) return [];
    return allTags(data.map((t) => t.note));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (filter !== "all") list = list.filter((t) => t.type === filter);
    if (activeTag) {
      list = list.filter((t) => parseTags(t.note).includes(activeTag));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.merchant?.toLowerCase().includes(q) ||
          t.bank?.toLowerCase().includes(q) ||
          t.sender?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q) ||
          t.amount.toString().includes(q)
      );
    }
    return list;
  }, [data, filter, query, activeTag]);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">
            Recent Transactions
          </h2>
          <Badge variant="secondary" className="rounded-full text-[10px] font-medium">
            Verified only
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {data && data.length > 0 && (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {filtered.length}/{data.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                className="h-7 gap-1.5 px-2 text-xs"
                title="Export to CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* search + filter bar */}
      {data && data.length > 0 && (
        <div className="flex flex-col gap-2 border-b bg-background/50 px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search merchant, bank, amount…"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="inline-flex shrink-0 rounded-md border bg-card p-0.5">
            {(["all", "credit", "debit"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  filter === f
                    ? f === "credit"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : f === "debit"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        : "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All" : f === "credit" ? "In" : "Out"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tag filter chips */}
      {allTagsList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-background/30 px-4 pb-2 pt-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Tag className="h-3 w-3" />
            Tags:
          </span>
          {allTagsList.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full border px-2 py-0 text-[9px] font-medium transition-colors",
                activeTag === tag
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              )}
            >
              {tag}
            </button>
          ))}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-0.5 rounded-full border border-muted-foreground/30 px-2 py-0 text-[9px] font-medium text-muted-foreground hover:bg-muted"
            >
              <X className="h-2.5 w-2.5" />
              Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg shimmer" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            No transactions match “{query}”.
          </p>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto scrollbar-thin">
          <ul className="divide-y">
            {filtered.map((tx, i) => (
              <TxRowItem
                key={tx.id}
                tx={tx}
                index={i}
                onSelect={() => onSelect(tx)}
                onSpeak={() => onSpeak(tx)}
                muted={muted}
              />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function TxRowItem({
  tx,
  index,
  onSelect,
  onSpeak,
  muted,
}: {
  tx: TxRow;
  index: number;
  onSelect: () => void;
  onSpeak: () => void;
  muted: boolean;
}) {
  const isCredit = tx.type === "credit";
  const extra = parseExtra(tx.extra);
  const isEmi = extra.isEmi === true;
  const lender = (extra.lender as string) || undefined;
  const catKey = (tx.category as CategoryKey) || "other";
  const catDef = CATEGORIES[catKey];
  const CatIcon = CAT_ICON[catDef?.icon] ?? CircleDashed;
  const tags = parseTags(tx.note);

  return (
    <li
      className="group relative flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}
      onClick={onSelect}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1",
          isCredit
            ? "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300"
            : "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-300"
        )}
      >
        {isCredit ? (
          <ArrowDownLeft className="h-4 w-4" />
        ) : (
          <ArrowUpRight className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {tx.merchant || lender || tx.bank || "Transaction"}
          </p>
          {isEmi && (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
            >
              EMI
            </Badge>
          )}
          {/* category chip */}
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 rounded-full border px-1.5 py-0 text-[9px] font-medium sm:inline-flex",
              catDef?.badge
            )}
            title={catDef?.label}
          >
            <CatIcon className="h-2.5 w-2.5" />
            {catDef?.label}
          </span>
          {/* tag chips (multi-tag support) */}
          {tags.length > 0 && (
            <span className="hidden items-center gap-1 sm:inline-flex">
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0 text-[9px] font-medium text-primary"
                  title={tag}
                >
                  <StickyNote className="h-2.5 w-2.5" />
                  {tag.length > 10 ? tag.slice(0, 10) + "…" : tag}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="shrink-0 text-[9px] text-muted-foreground">
                  +{tags.length - 2}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {senderTypeIcon[tx.senderType] ?? senderTypeIcon.unknown}
            {tx.bank || tx.senderType}
          </span>
          {tx.accountMasked && (
            <span className="opacity-70">· ••{tx.accountMasked.slice(-4)}</span>
          )}
          <span className="opacity-70">· {formatDateShort(tx.txDate)}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}
        >
          {isCredit ? "+" : "−"} {formatINR(tx.amount)}
        </span>
        {tx.balance !== null && (
          <span className="text-[10px] text-muted-foreground">
            Bal {formatINR(tx.balance)}
          </span>
        )}
      </div>

      {!muted && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onSpeak();
          }}
          aria-label="Speak transaction"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Wallet className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No transactions yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Paste a bank/UPI SMS using the button above, or load the sample SMS to
          see how parsing works.
        </p>
      </div>
    </div>
  );
}

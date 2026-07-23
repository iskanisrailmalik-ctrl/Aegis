"use client";

import { useFlagged, useDeleteFlagged, type FlaggedRow } from "../use-sms-data";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  ShieldX,
  Inbox,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatINRShort, relativeTime } from "../format";
import { toast } from "sonner";
import { useState } from "react";
import { ScreenGuideCard } from "../screen-guide-card";

export function SecurityView() {
  const flaggedQ = useFlagged("flagged");
  const unverifiedQ = useFlagged("unverified");
  const delMut = useDeleteFlagged();

  const flagged = flaggedQ.data ?? [];
  const unverified = unverifiedQ.data ?? [];
  const totalAlerts = flagged.length + unverified.length;

  const onAction = async (id: string, action: "delete" | "markLegit") => {
    try {
      await delMut.mutateAsync({ id, action });
      toast.success(action === "delete" ? "Message deleted" : "Marked as legitimate");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Security Center</h2>
          <p className="text-xs text-muted-foreground">
            Scam detection, flagged messages, and unverified senders.
          </p>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Total Alerts"
          value={flaggedQ.isLoading ? "—" : String(totalAlerts)}
          sub={totalAlerts > 0 ? "Needs review" : "All clear"}
          tone={totalAlerts > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          icon={<ShieldX className="h-4 w-4" />}
          label="Flagged"
          value={flaggedQ.isLoading ? "—" : String(flagged.length)}
          sub="Likely scams"
          tone="rose"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Unverified"
          value={unverifiedQ.isLoading ? "—" : String(unverified.length)}
          sub="Unknown senders"
          tone="amber"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Safe"
          value="—"
          sub="Verified transactions"
          tone="emerald"
        />
      </div>

      {/* Flagged messages */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b bg-rose-500/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <ShieldX className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-semibold">Flagged Messages</h3>
            {flagged.length > 0 && (
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-300">
                {flagged.length}
              </Badge>
            )}
          </div>
        </div>
        {flaggedQ.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg shimmer" />
            ))}
          </div>
        ) : flagged.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">No flagged messages</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Messages from suspicious senders or with scam patterns will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {flagged.map((msg, i) => (
              <FlaggedItem
                key={msg.id}
                msg={msg}
                index={i}
                onDelete={() => onAction(msg.id, "delete")}
                onMarkLegit={() => onAction(msg.id, "markLegit")}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* Unverified messages */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b bg-amber-500/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold">Unverified Messages</h3>
            {unverified.length > 0 && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                {unverified.length}
              </Badge>
            )}
          </div>
        </div>
        {unverifiedQ.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg shimmer" />
            ))}
          </div>
        ) : unverified.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No unverified messages</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Messages from senders not in the verified registry will appear here for review.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {unverified.map((msg, i) => (
              <FlaggedItem
                key={msg.id}
                msg={msg}
                index={i}
                onDelete={() => onAction(msg.id, "delete")}
                onMarkLegit={() => onAction(msg.id, "markLegit")}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// =====================================================
//  Flagged Item
// =====================================================
function FlaggedItem({
  msg,
  index,
  onDelete,
  onMarkLegit,
}: {
  msg: FlaggedRow;
  index: number;
  onDelete: () => void;
  onMarkLegit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFlagged = msg.classification === "flagged";
  const signals = msg.signals ? JSON.parse(msg.signals) : [];

  return (
    <li
      className="group cursor-pointer px-5 py-3 transition-colors hover:bg-muted/30 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 30, 240)}ms` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            isFlagged
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          {isFlagged ? <ShieldX className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{msg.sender ?? "Unknown sender"}</p>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[9px]",
                isFlagged
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              )}
            >
              {msg.classification}
            </Badge>
          </div>
          <p className={cn("text-xs text-muted-foreground", !expanded && "truncate")}>
            {msg.content}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {msg.reason} · {relativeTime(msg.receivedAt)}
          </p>

          {expanded && signals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {signals.map((s: { key: string; label: string; severity: string }, i: number) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={cn(
                    "text-[9px]",
                    s.severity === "high"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : s.severity === "medium"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  )}
                >
                  {s.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
            onClick={onMarkLegit}
            title="Mark as legitimate"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
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

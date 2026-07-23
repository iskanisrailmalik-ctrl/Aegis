"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardPaste,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  ShieldCheck,
  Sun,
  Moon,
  Loader2,
  MessageSquareText,
  RefreshCw,
  FileText,
  Download,
  Command,
} from "lucide-react";
import { Sidebar, type ViewKey } from "./sidebar";
import { DashboardView } from "./views/dashboard-view";
import { TransactionsView } from "./views/transactions-view";
import { InboxView } from "./views/inbox-view";
import { LoansView } from "./views/loans-view";
import { BudgetsView } from "./views/budgets-view";
import { RecurringView } from "./views/recurring-view";
import { AnalyticsView } from "./views/analytics-view";
import { IntelligenceView } from "./views/intelligence-view";
import { DocumentsView } from "./views/documents-view";
import { SecurityView } from "./views/security-view";
import { SettingsView } from "./views/settings-view";
import { PasteSmsDialog } from "./paste-sms-dialog";
import { TransactionDetailDialog } from "./transaction-detail-dialog";
import { CommandPalette, useGlobalShortcut, type CommandAction } from "./command-palette";
import { OnboardingDialog } from "./onboarding-dialog";
import { isNativeTrack } from "@/lib/feature-flags";
import {
  useDashboard,
  useFlagged,
  useLoans,
  useRecurring,
  useBudgets,
  useGoals,
  useSettings,
  useSaveSettings,
  useClearAll,
  useDeleteFlagged,
  useBackfillCategories,
  type TxRow,
} from "./use-sms-data";
import { useInbox, useDocuments } from "./use-intelligence";
import { speak, stopSpeaking, isTtsSupported } from "@/lib/tts";
import { buildVoiceSentence, type Lang } from "@/lib/i18n";
import { formatINRShort } from "./format";
import { useAutoLock, shouldLock, isAuthEnabled, updateLastActive } from "@/lib/auth";
import { LockScreen } from "./lock-screen";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Period = "day" | "week" | "month" | "all" | "custom";

export function AppShell() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [selectedThreadSender, setSelectedThreadSender] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const handleNavigateToThread = (sender: string) => {
    setSelectedThreadSender(sender);
    setActiveView("inbox");
  };
  const online = useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => (typeof navigator !== "undefined" ? navigator.onLine : true),
    () => true
  );

  const settingsQ = useSettings();
  const dashboardQ = useDashboard(period, customFrom || undefined, customTo || undefined);
  const flaggedQ = useFlagged("flagged");
  const unverifiedQ = useFlagged("unverified");
  const loansQ = useLoans();
  const recurringQ = useRecurring();
  const budgetsQ = useBudgets();
  const goalsQ = useGoals();
  const inboxQ = useInbox({});
  const docsQ = useDocuments();
  const clearMut = useClearAll();
  const delFlagMut = useDeleteFlagged();
  const saveSettings = useSaveSettings();
  const backfillMut = useBackfillCategories();

  const settings = settingsQ.data;
  const muted = settings?.muted ?? false;
  const voiceLang: Lang = settings?.voiceLanguage ?? "en";

  // Check if app should be locked on mount (using useState initializer to avoid effect)
  const [isLocked, setIsLockedState] = useState(() => {
    if (typeof window === "undefined") return false;
    return isAuthEnabled() && shouldLock();
  });

  // Auto-lock on inactivity
  useAutoLock(() => setIsLockedState(true));

  // Apply theme
  useEffect(() => {
    const theme = settings?.theme ?? "system";
    const root = document.documentElement;
    const apply = (dark: boolean) => {
      root.classList.toggle("dark", dark);
    };
    if (theme === "dark") apply(true);
    else if (theme === "light") apply(false);
    else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const h = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    }
  }, [settings?.theme]);

  // Budget alerts
  const alertedBudgetsRef = useRef<Record<string, "80" | "100" | undefined>>({});
  useEffect(() => {
    if (!budgetsQ.data?.budgets) return;
    for (const b of budgetsQ.data.budgets) {
      const prev = alertedBudgetsRef.current[b.id];
      if (b.over && prev !== "100") {
        alertedBudgetsRef.current[b.id] = "100";
        toast.error(`Budget exceeded: ${b.category}`, {
          description: `You've spent ${b.pct}% of your ${b.category} budget (₹${Math.abs(b.remaining).toFixed(0)} over).`,
        });
      } else if (!b.over && b.pct >= 80 && prev !== "80" && prev !== "100") {
        alertedBudgetsRef.current[b.id] = "80";
        toast.warning(`Budget alert: ${b.category}`, {
          description: `You've used ${b.pct}% of your ${b.category} budget (₹${b.remaining.toFixed(0)} left).`,
        });
      } else if (b.pct < 80) {
        alertedBudgetsRef.current[b.id] = undefined;
      }
    }
  }, [budgetsQ.data]);

  // EMI reminders
  const alertedEmisRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!dashboardQ.data?.upcoming) return;
    for (const emi of dashboardQ.data.upcoming) {
      if (alertedEmisRef.current.has(emi.id)) continue;
      if (emi.overdue) {
        alertedEmisRef.current.add(emi.id);
        toast.error(`EMI overdue: ${emi.lender}`, {
          description: `${emi.emiAmount ? formatINRShort(emi.emiAmount) : "—"} was due on day ${emi.dueDay}.`,
        });
      } else {
        const daysUntil = Math.ceil((new Date(emi.nextDue).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysUntil <= 3 && daysUntil >= 0) {
          alertedEmisRef.current.add(emi.id);
          toast.warning(`EMI due soon: ${emi.lender}`, {
            description: `${emi.emiAmount ? formatINRShort(emi.emiAmount) : "—"} due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}.`,
          });
        }
      }
    }
  }, [dashboardQ.data?.upcoming]);

  // Overdue EMI detection (expected SMS didn't arrive) — checks on load
  const overdueCheckedRef = useRef(false);
  useEffect(() => {
    if (overdueCheckedRef.current) return;
    overdueCheckedRef.current = true;
    fetch("/api/overdue").then(r => r.json()).then(data => {
      if (data.overdue && data.overdue.length > 0) {
        for (const o of data.overdue) {
          const sev = o.severity === "critical" ? "error" : o.severity === "overdue" ? "warning" : "info";
          if (sev === "error") {
            toast.error(`EMI overdue: ${o.lender}`, {
              description: `₹${o.emiAmount} expected ${o.daysOverdue} days ago — SMS may not have arrived.`,
            });
          } else if (sev === "warning") {
            toast.warning(`EMI may be overdue: ${o.lender}`, {
              description: `₹${o.emiAmount} expected ${o.daysOverdue} days ago.`,
            });
          }
        }
      }
    }).catch(() => {});
  }, []);

  // Phase E: Show onboarding on first launch (native track only)
  useEffect(() => {
    if (isNativeTrack()) {
      const hasOnboarded = localStorage.getItem("aegis_onboarded");
      if (!hasOnboarded) {
        setOnboardingOpen(true);
      }
    }
  }, []);

  // Voice engine: ONLY pronounces when a new transaction SMS is parsed (not on app visit).
  // The PasteSmsDialog calls onNewTransaction() after a successful parse.
  const onNewTransaction = (tx: {
    amount: number;
    type: "credit" | "debit";
    merchant?: string | null;
    bank?: string | null;
    isEmi?: boolean;
    emiAmount?: number;
    lender?: string;
    extra?: string | null;
  }) => {
    if (muted) return;
    const ttsOk = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!ttsOk) return;

    let extra: Record<string, unknown> = {};
    try { extra = tx.extra ? JSON.parse(tx.extra) : {}; } catch { /* ignore */ }
    const sentence = buildVoiceSentence(voiceLang, {
      amount: tx.amount,
      type: tx.type,
      merchant: tx.merchant ?? undefined,
      bank: tx.bank ?? undefined,
      isEmi: Boolean(tx.isEmi ?? extra.isEmi),
      emiAmount: tx.emiAmount ?? (extra.emiAmount ? Number(extra.emiAmount) : undefined),
      lender: tx.lender ?? (extra.lender ? String(extra.lender) : undefined),
    });
    speak(sentence, { lang: voiceLang, rate: 0.9, pitch: 1.0 });
    toast.message("🔊 " + sentence, { duration: 3000 });
  };

  // Native SMS listener — when running as Android default SMS app,
  // incoming SMS are automatically fed into the parse pipeline.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    import("@/lib/native-bridge").then(({ onSmsReceived, isNativeBridgeAvailable }) => {
      if (!isNativeBridgeAvailable()) return;
      unsubscribe = onSmsReceived((event) => {
        // Feed the incoming SMS into the parse pipeline via the compose API
        fetch("/api/inbox/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: event.sender, text: event.body }),
        })
          .then((r) => r.json())
          .then((result) => {
            if (result.classification === "verified" && result.parsed) {
              // Trigger voice pronunciation for verified transactions
              fetch(`/api/transactions/${result.transactionId}`)
                .then((r) => r.json())
                .then((tx) => {
                  if (tx && tx.amount) {
                    onNewTransaction({
                      amount: tx.amount,
                      type: tx.type,
                      merchant: tx.merchant,
                      bank: tx.bank,
                      isEmi: tx.extra ? JSON.parse(tx.extra).isEmi : false,
                      emiAmount: tx.extra ? JSON.parse(tx.extra).emiAmount : undefined,
                      lender: tx.extra ? JSON.parse(tx.extra).lender : undefined,
                      extra: tx.extra,
                    });
                  }
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Global keyboard shortcuts
  useGlobalShortcut("mod+k", () => setPaletteOpen((v) => !v), []);
  useGlobalShortcut("mod+p", () => setPasteOpen(true), []);

  const ttsSupported = useSyncExternalStore(
    () => () => {},
    () => isTtsSupported(),
    () => false
  );

  const onSpeak = (tx: TxRow) => {
    if (muted || !ttsSupported) return;
    let extra: Record<string, unknown> = {};
    try { extra = tx.extra ? JSON.parse(tx.extra) : {}; } catch { /* ignore */ }
    const sentence = buildVoiceSentence(voiceLang, {
      amount: tx.amount,
      type: tx.type,
      merchant: tx.merchant ?? undefined,
      bank: tx.bank ?? undefined,
      isEmi: Boolean(extra.isEmi),
      emiAmount: extra.emiAmount ? Number(extra.emiAmount) : undefined,
      lender: extra.lender ? String(extra.lender) : undefined,
    });
    setSpeakingId(tx.id);
    speak(sentence, { lang: voiceLang, onEnd: () => setSpeakingId(null) });
    toast.message("🔊 " + sentence, { duration: 2500 });
  };

  const onSelectTx = (tx: TxRow) => {
    setSelectedTx(tx);
    setTxOpen(true);
  };

  const onClearAll = async () => {
    if (!confirm("Clear ALL transactions, loans, and alerts? This cannot be undone.")) return;
    try {
      await clearMut.mutateAsync();
      toast.success("All data cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onExport = () => {
    window.open("/api/export?classification=verified", "_blank");
    toast.success("Exporting transactions as CSV…");
  };

  const onStatement = () => {
    window.open(`/statement?period=${period}`, "_blank");
    toast.success("Opening printable statement…");
  };

  const onBackup = () => {
    window.open("/api/backup", "_blank");
    toast.success("Downloading backup as JSON…");
  };

  const onBackfill = async () => {
    try {
      const r = await backfillMut.mutateAsync();
      if (r.updated > 0) {
        toast.success(`Re-categorized ${r.updated} of ${r.total} transactions`);
      } else {
        toast.info(`All ${r.total} transactions already categorized`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  // Command palette actions
  const commandActions: CommandAction[] = [
    { id: "paste", label: "Paste SMS", description: "Parse a new SMS", icon: <ClipboardPaste className="h-3.5 w-3.5" />, shortcut: "⌘P", keywords: ["add", "new", "sms", "parse"], run: () => setPasteOpen(true) },
    { id: "dashboard", label: "Go to Dashboard", icon: <MessageSquareText className="h-3.5 w-3.5" />, keywords: ["home", "overview"], run: () => setActiveView("dashboard") },
    { id: "transactions", label: "Go to Transactions", icon: <ClipboardPaste className="h-3.5 w-3.5" />, keywords: ["tx", "history"], run: () => setActiveView("transactions") },
    { id: "inbox", label: "Go to SMS Inbox", icon: <MessageSquareText className="h-3.5 w-3.5" />, keywords: ["messages", "sms"], run: () => setActiveView("inbox") },
    { id: "intelligence", label: "Go to Ask AI", icon: <Sparkles className="h-3.5 w-3.5" />, keywords: ["question", "rag"], run: () => setActiveView("intelligence") },
    { id: "recurring", label: "Go to Recurring Payments", icon: <Sparkles className="h-3.5 w-3.5" />, keywords: ["subscriptions", "repeating"], run: () => setActiveView("recurring") },
    { id: "analytics", label: "Go to Analytics", icon: <Sparkles className="h-3.5 w-3.5" />, keywords: ["charts", "insights", "trends"], run: () => setActiveView("analytics") },
    { id: "security", label: "Go to Security Center", icon: <Sparkles className="h-3.5 w-3.5" />, keywords: ["scam", "flagged", "alerts"], run: () => setActiveView("security") },
    { id: "settings", label: "Go to Settings", icon: <SettingsIcon className="h-3.5 w-3.5" />, keywords: ["preferences", "theme"], run: () => setActiveView("settings") },
    { id: "statement", label: "Open Statement (PDF)", icon: <FileText className="h-3.5 w-3.5" />, keywords: ["pdf", "print"], run: onStatement },
    { id: "csv", label: "Export CSV", icon: <Download className="h-3.5 w-3.5" />, keywords: ["csv", "export"], run: onExport },
    { id: "backup", label: "Download Backup", icon: <Download className="h-3.5 w-3.5" />, keywords: ["backup", "json"], run: onBackup },
    { id: "theme", label: "Toggle Theme", icon: settings?.theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />, keywords: ["dark", "light"], run: () => {
      const cur = settings?.theme ?? "system";
      const next = cur === "dark" ? "light" : cur === "light" ? "system" : "dark";
      saveSettings.mutate({ theme: next });
    }},
    { id: "tour", label: "Replay Guided Tour", icon: <Sparkles className="h-3.5 w-3.5" />, keywords: ["help", "guide", "onboarding", "tour"], run: () => setOnboardingOpen(true) },
    { id: "clear", label: "Clear All Data", icon: <Trash2 className="h-3.5 w-3.5" />, keywords: ["delete", "reset"], run: onClearAll },
  ];

  // Sidebar badges
  const badges: Partial<Record<ViewKey, number>> = {
    transactions: dashboardQ.data ? dashboardQ.data.creditCount + dashboardQ.data.debitCount : 0,
    inbox: inboxQ.data?.total ?? 0,
    loans: loansQ.data?.loans.length ?? 0,
    recurring: recurringQ.data?.count ?? 0,
    documents: docsQ.data?.documents.length ?? 0,
    security: (flaggedQ.data?.length ?? 0) + (unverifiedQ.data?.length ?? 0),
  };

  const loading = dashboardQ.isLoading;

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {isLocked && <LockScreen onUnlock={() => setIsLockedState(false)} />}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        badges={badges}
        online={online}
        actionButtons={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStatement} title="Statement">
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPaletteOpen(true)} title="Command (⌘K)">
              <Command className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top action bar (desktop) — minimal, no Paste SMS */}
        <header className="sticky top-0 z-30 hidden items-center gap-2 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 lg:flex safe-top">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-2">
            <Button variant="ghost" size="sm" onClick={onBackfill} disabled={backfillMut.isPending} className="gap-1.5 text-muted-foreground">
              {backfillMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Re-categorize
            </Button>
            <Button variant="ghost" size="sm" onClick={onStatement} className="gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Statement
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              {speakingId && (
                <Button variant="outline" size="sm" onClick={() => { stopSpeaking(); setSpeakingId(null); }} className="gap-1.5 text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Stop voice
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)} className="gap-2 text-xs text-muted-foreground">
                <Command className="h-3.5 w-3.5" />
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium">⌘K</kbd>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                const cur = settings?.theme ?? "system";
                const next = cur === "dark" ? "light" : cur === "light" ? "system" : "dark";
                saveSettings.mutate({ theme: next });
              }}>
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </div>
        </header>

        {/* View content — pb-28 ensures bottom cards/buttons clear Android navigation bar */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 sm:px-6 sm:pb-16 safe-bottom">
          <div className="mx-auto w-full max-w-5xl">
            {activeView === "dashboard" && (
              <DashboardView
                onNavigate={setActiveView}
                onNavigateToThread={handleNavigateToThread}
                onSelectTx={onSelectTx}
                onSpeak={onSpeak}
                onExport={onExport}
                muted={muted || !ttsSupported}
                period={period}
                setPeriod={setPeriod}
                customFrom={customFrom}
                setCustomFrom={setCustomFrom}
                customTo={customTo}
                setCustomTo={setCustomTo}
              />
            )}
            {activeView === "transactions" && (
              <TransactionsView
                onSelectTx={onSelectTx}
                onSpeak={onSpeak}
                onExport={onExport}
                muted={muted || !ttsSupported}
              />
            )}
            {activeView === "inbox" && (
              <InboxView
                initialSender={selectedThreadSender}
                onClearInitialSender={() => setSelectedThreadSender(null)}
              />
            )}
            {activeView === "loans" && <LoansView />}
            {activeView === "budgets" && <BudgetsView />}
            {activeView === "recurring" && <RecurringView />}
            {activeView === "analytics" && <AnalyticsView />}
            {activeView === "intelligence" && (
              <IntelligenceView voiceLang={voiceLang} muted={muted || !ttsSupported} />
            )}
            {activeView === "documents" && <DocumentsView />}
            {activeView === "security" && <SecurityView />}
            {activeView === "settings" && <SettingsView settings={settings} onReplayTour={() => setOnboardingOpen(true)} />}
          </div>
        </main>
      </div>

      {/* Dialogs */}
      <PasteSmsDialog open={pasteOpen} onOpenChange={setPasteOpen} onNewTransaction={onNewTransaction} />
      <TransactionDetailDialog
        tx={selectedTx}
        open={txOpen}
        onOpenChange={(v) => {
          setTxOpen(v);
          if (!v) setSelectedTx(null);
        }}
        onSpeak={onSpeak}
        muted={muted}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={commandActions}
      />
      <OnboardingDialog
        open={onboardingOpen}
        onComplete={() => {
          localStorage.setItem("aegis_onboarded", "true");
          setOnboardingOpen(false);
        }}
      />
    </div>
  );
}

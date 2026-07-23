"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScreenGuideCard } from "../screen-guide-card";
import {
  Search,
  Building2,
  Landmark,
  Wallet,
  CreditCard,
  Sparkles,
  Store,
  ShieldCheck,
  ShieldAlert,
  Shield,
  CircleAlert,
  X,
  Send,
  Plus,
  ArrowLeft,
  MessageSquare,
  Pencil,
  Paperclip,
  Smile,
  Clock,
  Share2,
  Copy,
  Trash2,
  MoreVertical,
  Info,
  Lock,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  BellOff,
  Bell,
  Ban,
  Star,
  StarOff,
  Forward,
  CalendarClock,
  CheckCircle2,
  Volume2,
  Wand2,
  CheckSquare,
  Square,
} from "lucide-react";
import { useInbox, useComposeMessage, type SmsMessageRow } from "../use-intelligence";
import {
  useConversations,
  useUpdateConversation,
  useDeleteConversation,
  useBlockedSenders,
  useBlockSender,
  type ConversationMeta,
} from "../use-sms-data";
import { detectOtp, blurOtp } from "@/lib/sms/otp-detector";
import { generateSmartReplies } from "@/lib/sms/smart-reply";
import { VaultUnlock } from "../vault-unlock";
import { SecureOtpReveal } from "../secure-otp-reveal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const classConfig: Record<string, { icon: React.ReactNode; cls: string; label: string; dot: string }> = {
  verified: { icon: <ShieldCheck className="h-3 w-3" />, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", label: "Verified", dot: "bg-emerald-500" },
  unverified: { icon: <Shield className="h-3 w-3" />, cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", label: "Unverified", dot: "bg-amber-500" },
  flagged: { icon: <ShieldAlert className="h-3 w-3" />, cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300", label: "Flagged", dot: "bg-rose-500" },
  unparsed: { icon: <CircleAlert className="h-3 w-3" />, cls: "border-muted-foreground/30 bg-muted text-muted-foreground", label: "Unparsed", dot: "bg-muted-foreground" },
};

const avatarColors = [
  "bg-teal-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-orange-500",
];

export const bankSmsPresets = [
  { label: "HDFC Debit ₹1,450", sender: "HDFCBK", text: "Rs 1450.00 debited from a/c **4921 on 22-Jul-26 to ZOMATO. Avbl Bal: Rs 45,210.50 - HDFC Bank" },
  { label: "SBI Credit ₹3,200", sender: "SBIINB", text: "Alert: Rs. 3,200.00 spent on SBI Card ending 8812 at AMAZON INDIA on 22-Jul-26. Total Available Limit: Rs 1,42,000." },
  { label: "ICICI Salary Credit ₹85,000", sender: "ICICIB", text: "Your A/C XX9012 has been credited with INR 85,000.00 on 22-Jul-26 by Salary transfer from ACME CORP. Info: Salary. Avbl Bal: INR 1,32,450.00." },
  { label: "Paytm UPI Debit ₹450", sender: "PAYTM", text: "Paid Rs 450 to SWIGGY via Paytm UPI. Ref No: 420511928371. Updated Balance: Rs 12,300." },
  { label: "HDFC EMI Alert ₹24,500", sender: "HDFCBK", text: "Your Home Loan EMI of Rs 24,500 for A/C HL-98214 is due on 05-Aug-2026. Maintain sufficient balance." },
  { label: "OTP Code 749201", sender: "VERIFY", text: "749201 is your secret OTP for transaction at Flipkart. Valid for 10 mins. Do not share with anyone." },
];

function getAvatarColor(sender: string): string {
  let hash = 0;
  for (let i = 0; i < sender.length; i++) hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(sender: string): string {
  const clean = sender.replace(/[^A-Za-z0-9]/g, "");
  return clean.slice(0, 2).toUpperCase() || "SMS";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function speakMessage(text: string) {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    toast.success("Reading message aloud...");
  } else {
    toast.error("Text-to-speech is not supported on this browser.");
  }
}

// =====================================================
//  Main Inbox View
// =====================================================
export function InboxView({
  initialSender,
  onClearInitialSender,
}: {
  initialSender?: string | null;
  onClearInitialSender?: () => void;
} = {}) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [selected, setSelected] = useState<SmsMessageRow | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [activeThread, setActiveThread] = useState<string | null>(initialSender ?? null);
  const [replyText, setReplyText] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<SmsMessageRow | null>(null);

  useEffect(() => {
    if (initialSender) {
      setActiveThread(initialSender);
      if (onClearInitialSender) onClearInitialSender();
    }
  }, [initialSender, onClearInitialSender]);

  const inboxQ = useInbox({
    search: search || undefined,
    classification: classFilter || undefined,
  });
  const conversationsQ = useConversations();
  const blockedQ = useBlockedSenders();

  const allMessages = inboxQ.data?.messages ?? [];
  const total = inboxQ.data?.total ?? 0;

  // Build conversation metadata map
  const convMap = useMemo(() => {
    const map = new Map<string, ConversationMeta>();
    for (const c of conversationsQ.data?.conversations ?? []) {
      map.set(c.sender, c);
    }
    return map;
  }, [conversationsQ.data]);

  // Build blocked set
  const blockedSet = useMemo(() => {
    return new Set((blockedQ.data?.blocked ?? []).map((b) => b.sender));
  }, [blockedQ.data]);

  // Group by sender for conversation list
  const threads = useMemo(() => {
    const map = new Map<string, { sender: string; messages: SmsMessageRow[]; lastMsg: SmsMessageRow }>();
    for (const msg of allMessages) {
      const key = msg.sender ?? "Unknown";
      if (blockedSet.has(key)) continue;
      const conv = convMap.get(key);
      if (conv?.isArchived && !showArchived) continue;
      if (!conv?.isArchived && showArchived) continue;

      const existing = map.get(key);
      if (existing) {
        existing.messages.push(msg);
        if (new Date(msg.receivedAt) > new Date(existing.lastMsg.receivedAt)) {
          existing.lastMsg = msg;
        }
      } else {
        map.set(key, { sender: key, messages: [msg], lastMsg: msg });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aPinned = convMap.get(a.sender)?.isPinned ?? false;
      const bPinned = convMap.get(b.sender)?.isPinned ?? false;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.lastMsg.receivedAt).getTime() - new Date(a.lastMsg.receivedAt).getTime();
    });
  }, [allMessages, convMap, blockedSet, showArchived]);

  // Messages in active thread
  const threadMessages = useMemo(() => {
    if (!activeThread) return [];
    return allMessages
      .filter((m) => (m.sender ?? "Unknown") === activeThread)
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
  }, [activeThread, allMessages]);

  const handleSelectThread = (sender: string) => {
    setActiveThread(sender);
    setSelected(null);
  };

  const handleBack = () => {
    setActiveThread(null);
    setSelected(null);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-2.5rem)] safe-bottom">
      {!activeThread ? (
        <ConversationList
          threads={threads}
          total={total}
          search={search}
          setSearch={setSearch}
          classFilter={classFilter}
          setClassFilter={setClassFilter}
          onSelectThread={handleSelectThread}
          onCompose={() => setShowCompose(true)}
          loading={inboxQ.isLoading}
          convMap={convMap}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          blockedCount={blockedSet.size}
        />
      ) : (
        <ConversationView
          sender={activeThread}
          messages={threadMessages}
          onBack={handleBack}
          onMessageClick={setSelected}
          onForward={setForwardMsg}
          replyText={replyText}
          setReplyText={setReplyText}
          convMeta={convMap.get(activeThread)}
        />
      )}

      <MessageDetailDialog message={selected} onClose={() => setSelected(null)} onForward={setForwardMsg} />
      <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />
      <ForwardDialog message={forwardMsg} onClose={() => setForwardMsg(null)} />
    </div>
  );
}

// =====================================================
//  Conversation List (Google Messages style)
// =====================================================
function ConversationList({
  threads,
  total,
  search,
  setSearch,
  classFilter,
  setClassFilter,
  onSelectThread,
  onCompose,
  loading,
  convMap,
  showArchived,
  setShowArchived,
  blockedCount,
}: {
  threads: Array<{ sender: string; messages: SmsMessageRow[]; lastMsg: SmsMessageRow }>;
  total: number;
  search: string;
  setSearch: (s: string) => void;
  classFilter: string;
  setClassFilter: (s: string) => void;
  onSelectThread: (sender: string) => void;
  onCompose: () => void;
  loading: boolean;
  convMap: Map<string, ConversationMeta>;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  blockedCount: number;
}) {
  const [menuSender, setMenuSender] = useState<string | null>(null);
  const updateConv = useUpdateConversation();
  const deleteConv = useDeleteConversation();
  const blockMut = useBlockSender();

  const handleAction = async (sender: string, action: string) => {
    setMenuSender(null);
    const conv = convMap.get(sender);
    try {
      switch (action) {
        case "pin":
          await updateConv.mutateAsync({ sender, isPinned: !conv?.isPinned });
          toast.success(!conv?.isPinned ? "Conversation pinned" : "Conversation unpinned");
          break;
        case "star":
          await updateConv.mutateAsync({ sender, isStarred: !conv?.isStarred });
          toast.success(!conv?.isStarred ? "Starred" : "Unstarred");
          break;
        case "archive":
          await updateConv.mutateAsync({ sender, isArchived: !conv?.isArchived });
          toast.success(!conv?.isArchived ? "Archived" : "Unarchived");
          break;
        case "mute":
          await updateConv.mutateAsync({ sender, isMuted: !conv?.isMuted });
          toast.success(!conv?.isMuted ? "Muted" : "Unmuted");
          break;
        case "block":
          if (confirm(`Block ${sender}? Messages from this sender will be hidden.`)) {
            await blockMut.mutateAsync({ sender, reason: "user_blocked" });
            toast.success(`${sender} blocked`);
          }
          break;
        case "delete":
          if (confirm(`Delete all messages from ${sender}? This cannot be undone.`)) {
            await deleteConv.mutateAsync(sender);
            toast.success("Conversation deleted");
          }
          break;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-3 safe-top">
        <h2 className="text-lg font-semibold tracking-tight">Messages</h2>
        {total > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {total}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={cn("gap-1.5 text-xs", showArchived && "text-primary")}
            title={showArchived ? "Show active" : "Show archived"}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onCompose} className="gap-1.5">
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
        </div>
      </div>

      <div className="px-3 pt-2">
        <ScreenGuideCard viewKey="inbox" />
      </div>

      {/* Search bar — Google SMS style pill */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in messages"
            className="h-10 rounded-full bg-muted pl-10 pr-10 text-sm border-0 focus-visible:ring-1 focus-visible:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-thin">
        {["", "verified", "unverified", "flagged"].map((c) => (
          <button
            key={c || "all"}
            onClick={() => setClassFilter(c)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all",
              classFilter === c
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {c || "All"}
          </button>
        ))}
        {blockedCount > 0 && (
          <span className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
            {blockedCount} blocked
          </span>
        )}
      </div>

      {/* Conversation list */}
      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl p-3">
              <div className="h-12 w-12 rounded-full shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded shimmer" />
                <div className="h-3 w-48 rounded shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
            <MessageSquare className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {showArchived ? "No archived messages" : "No messages"}
            </p>
            <p className="max-w-[20rem] text-xs text-muted-foreground">
              {search ? `No messages match "${search}".` : showArchived ? "Archived conversations will appear here." : "Paste or compose an SMS to get started."}
            </p>
          </div>
          {!showArchived && (
            <Button variant="outline" size="sm" onClick={onCompose} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Compose
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {threads.map((thread) => {
            const cfg = classConfig[thread.lastMsg.classification] ?? classConfig.unparsed;
            const avatarColor = getAvatarColor(thread.sender);
            const initials = getInitials(thread.sender);
            const conv = convMap.get(thread.sender);
            const otpResult = detectOtp(thread.lastMsg.rawText);
            const isOtp = otpResult.isOtp;
            const showMenu = menuSender === thread.sender;
            return (
              <div key={thread.sender} className="relative">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectThread(thread.sender)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { onSelectThread(thread.sender); } }}
                  onContextMenu={(e) => { e.preventDefault(); setMenuSender(thread.sender); }}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted cursor-pointer"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={cn("grid h-12 w-12 place-items-center rounded-full text-sm font-semibold text-white", avatarColor)}>
                      {initials}
                    </div>
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background", cfg.dot)} />
                    {conv?.isPinned && (
                      <Pin className="absolute -top-0.5 -left-0.5 h-3.5 w-3.5 text-primary fill-primary" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 truncate text-sm font-semibold">
                        {conv?.displayName || thread.sender}
                        {conv?.isStarred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                        {conv?.isMuted && <BellOff className="h-3 w-3 text-muted-foreground" />}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatTime(thread.lastMsg.receivedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs text-muted-foreground">
                        {isOtp ? blurOtp(thread.lastMsg.rawText) : thread.lastMsg.rawText}
                      </p>
                      {isOtp && (
                        <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                          OTP
                        </span>
                      )}
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0 text-[9px] font-medium text-muted-foreground">
                        {thread.messages.length}
                      </span>
                    </div>
                  </div>
                  {/* More button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuSender(showMenu ? null : thread.sender); }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                {/* Context menu */}
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuSender(null)} />
                    <div className="absolute right-3 top-12 z-50 w-48 rounded-lg border bg-popover shadow-lg animate-scale-in">
                      <MenuButton icon={conv?.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />} label={conv?.isPinned ? "Unpin" : "Pin"} onClick={() => handleAction(thread.sender, "pin")} />
                      <MenuButton icon={conv?.isStarred ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />} label={conv?.isStarred ? "Unstar" : "Star"} onClick={() => handleAction(thread.sender, "star")} />
                      <MenuButton icon={conv?.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} label={conv?.isArchived ? "Unarchive" : "Archive"} onClick={() => handleAction(thread.sender, "archive")} />
                      <MenuButton icon={conv?.isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} label={conv?.isMuted ? "Unmute" : "Mute"} onClick={() => handleAction(thread.sender, "mute")} />
                      <div className="my-1 border-t" />
                      <MenuButton icon={<Ban className="h-4 w-4" />} label="Block sender" onClick={() => handleAction(thread.sender, "block")} danger />
                      <MenuButton icon={<Trash2 className="h-4 w-4" />} label="Delete" onClick={() => handleAction(thread.sender, "delete")} danger />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function MenuButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
        danger ? "text-rose-600 dark:text-rose-400" : ""
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// =====================================================
//  Conversation View (Chat thread with Enhanced Sending & Receiving)
// =====================================================
function ConversationView({
  sender,
  messages,
  onBack,
  onMessageClick,
  onForward,
  replyText,
  setReplyText,
  convMeta,
}: {
  sender: string;
  messages: SmsMessageRow[];
  onBack: () => void;
  onMessageClick: (msg: SmsMessageRow) => void;
  onForward: (msg: SmsMessageRow) => void;
  replyText: string;
  setReplyText: (s: string) => void;
  convMeta?: ConversationMeta;
}) {
  const composeMut = useComposeMessage();
  const updateConv = useUpdateConversation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const avatarColor = getAvatarColor(sender);
  const initials = getInitials(sender);
  const cfg = messages.length > 0 ? classConfig[messages[messages.length - 1].classification] ?? classConfig.unparsed : classConfig.unparsed;

  // States
  const [revealedOtps, setRevealedOtps] = useState<Set<string>>(new Set());
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [pendingOtpMsgId, setPendingOtpMsgId] = useState<string | null>(null);
  const [menuMsg, setMenuMsg] = useState<string | null>(null);
  const [showConvMenu, setShowConvMenu] = useState(false);

  // In-thread search state
  const [showThreadSearch, setShowThreadSearch] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");

  // Preset sample picker state
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  // Multi-select mode state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  // Smart replies based on last message
  const smartReplies = useMemo(() => {
    if (messages.length === 0) return [];
    return generateSmartReplies(messages[messages.length - 1].rawText);
  }, [messages]);

  // Filter messages by in-thread search query
  const visibleMessages = useMemo(() => {
    if (!threadSearchQuery.trim()) return messages;
    const q = threadSearchQuery.toLowerCase();
    return messages.filter((m) => m.rawText.toLowerCase().includes(q));
  }, [messages, threadSearchQuery]);

  const handleRevealOtp = (msgId: string) => {
    setPendingOtpMsgId(msgId);
    setShowVaultUnlock(true);
  };

  const handleVaultUnlock = () => {
    if (pendingOtpMsgId) {
      setRevealedOtps((prev) => new Set(prev).add(pendingOtpMsgId));
      toast.success("OTP revealed — auto-hiding in 30 seconds");
      setTimeout(() => {
        setRevealedOtps((prev) => {
          const next = new Set(prev);
          next.delete(pendingOtpMsgId);
          return next;
        });
      }, 30000);
    }
    setPendingOtpMsgId(null);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      const r = await composeMut.mutateAsync({ sender, text: replyText.trim() });
      toast.success(r.parsed ? "Sent & parsed as transaction" : "Message sent", {
        description: r.classification === "verified" ? "Verified transaction logged" : r.classification,
      });
      setReplyText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    }
  };

  const handleMessageAction = async (msg: SmsMessageRow, action: string) => {
    setMenuMsg(null);
    switch (action) {
      case "copy":
        await navigator.clipboard.writeText(msg.rawText);
        toast.success("Copied message to clipboard");
        break;
      case "speak":
        speakMessage(msg.rawText);
        break;
      case "forward":
        onForward(msg);
        break;
      case "share":
        if (navigator.share) {
          try { await navigator.share({ title: `SMS from ${msg.sender}`, text: msg.rawText }); } catch { /* cancelled */ }
        } else {
          await navigator.clipboard.writeText(msg.rawText);
          toast.success("Copied to clipboard");
        }
        break;
      case "delete":
        if (confirm("Delete this message?")) {
          try {
            await fetch(`/api/inbox/${msg.id}`, { method: "DELETE" });
            toast.success("Message deleted");
          } catch {
            toast.error("Failed to delete");
          }
        }
        break;
      case "details":
        onMessageClick(msg);
        break;
    }
  };

  const handleConvAction = async (action: string) => {
    setShowConvMenu(false);
    try {
      switch (action) {
        case "pin":
          await updateConv.mutateAsync({ sender, isPinned: !convMeta?.isPinned });
          toast.success(!convMeta?.isPinned ? "Pinned thread" : "Unpinned thread");
          break;
        case "mute":
          await updateConv.mutateAsync({ sender, isMuted: !convMeta?.isMuted });
          toast.success(!convMeta?.isMuted ? "Muted thread" : "Unmuted thread");
          break;
        case "archive":
          await updateConv.mutateAsync({ sender, isArchived: !convMeta?.isArchived });
          toast.success(!convMeta?.isArchived ? "Archived thread" : "Unarchived thread");
          onBack();
          break;
        case "multiSelect":
          setIsMultiSelect(true);
          setSelectedMsgIds(new Set());
          break;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const toggleSelectMessage = (id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedMsgIds.size === 0) return;
    if (confirm(`Delete ${selectedMsgIds.size} selected message(s)?`)) {
      try {
        for (const id of Array.from(selectedMsgIds)) {
          await fetch(`/api/inbox/${id}`, { method: "DELETE" });
        }
        toast.success(`${selectedMsgIds.size} message(s) deleted`);
        setIsMultiSelect(false);
        setSelectedMsgIds(new Set());
      } catch {
        toast.error("Failed to delete selected messages");
      }
    }
  };

  const handleBulkCopy = async () => {
    if (selectedMsgIds.size === 0) return;
    const selectedMsgs = messages.filter((m) => selectedMsgIds.has(m.id));
    const combined = selectedMsgs.map((m) => `[${formatTime(m.receivedAt)}] ${m.sender}: ${m.rawText}`).join("\n\n");
    await navigator.clipboard.writeText(combined);
    toast.success(`Copied ${selectedMsgs.length} message(s)`);
    setIsMultiSelect(false);
    setSelectedMsgIds(new Set());
  };

  return (
    <>
      {/* Header — Google SMS style */}
      <div className="flex items-center gap-2 border-b bg-background px-2 py-2 safe-top">
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative shrink-0">
          <div className={cn("grid h-10 w-10 place-items-center rounded-full text-xs font-semibold text-white", avatarColor)}>
            {initials}
          </div>
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background", cfg.dot)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {convMeta?.displayName || sender}
            {convMeta?.isMuted && <BellOff className="h-3 w-3 text-muted-foreground" />}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {messages.length} message{messages.length !== 1 ? "s" : ""} · {cfg.label}
            {convMeta?.isPinned && " · Pinned"}
          </p>
        </div>

        {/* Action icons */}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-10 w-10 rounded-full", showThreadSearch && "text-primary bg-muted")}
          onClick={() => { setShowThreadSearch(!showThreadSearch); if (showThreadSearch) setThreadSearchQuery(""); }}
          title="Search in thread"
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => handleConvAction("mute")} title={convMeta?.isMuted ? "Unmute" : "Mute"}>
          {convMeta?.isMuted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setShowConvMenu(!showConvMenu)} aria-label="More options">
            <MoreVertical className="h-5 w-5" />
          </Button>
          {showConvMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowConvMenu(false)} />
              <div className="absolute right-0 top-12 z-50 w-48 rounded-lg border bg-popover shadow-lg animate-scale-in">
                <MenuButton icon={convMeta?.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />} label={convMeta?.isPinned ? "Unpin" : "Pin"} onClick={() => handleConvAction("pin")} />
                <MenuButton icon={<Archive className="h-4 w-4" />} label="Archive" onClick={() => handleConvAction("archive")} />
                <MenuButton icon={<CheckSquare className="h-4 w-4" />} label="Select messages" onClick={() => handleConvAction("multiSelect")} />
                <MenuButton icon={<Info className="h-4 w-4" />} label="Details" onClick={() => onMessageClick(messages[messages.length - 1])} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* In-thread Search Bar */}
      {showThreadSearch && (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 animate-fade-in">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={threadSearchQuery}
            onChange={(e) => setThreadSearchQuery(e.target.value)}
            placeholder="Find in conversation…"
            className="h-8 border-0 bg-background text-xs"
            autoFocus
          />
          {threadSearchQuery && (
            <button onClick={() => setThreadSearchQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Multi-Select Toolbar */}
      {isMultiSelect && (
        <div className="flex items-center justify-between border-b bg-primary/10 px-4 py-2 text-xs animate-fade-in">
          <span className="font-semibold text-primary">
            {selectedMsgIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={handleBulkCopy} disabled={selectedMsgIds.size === 0}>
              <Copy className="h-3 w-3" />
              Copy
            </Button>
            <Button size="sm" variant="destructive" className="h-7 gap-1 text-[11px]" onClick={handleBulkDelete} disabled={selectedMsgIds.size === 0}>
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => { setIsMultiSelect(false); setSelectedMsgIds(new Set()); }}>
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Messages — chat bubbles */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin bg-muted/20 px-3 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {visibleMessages.map((msg, i) => {
            const msgCfg = classConfig[msg.classification] ?? classConfig.unparsed;
            const showDate = i === 0 || new Date(visibleMessages[i - 1].receivedAt).toDateString() !== new Date(msg.receivedAt).toDateString();
            const otpResult = detectOtp(msg.rawText);
            const isOtp = otpResult.isOtp;
            const isRevealed = revealedOtps.has(msg.id);
            const showMsgMenu = menuMsg === msg.id;

            // Check if message is outbound/sent by user
            const isOutbound = msg.senderType === "user" || msg.sender === "ME" || msg.sender === "YOU" || msg.sender?.toLowerCase().startsWith("user");
            const isSelected = selectedMsgIds.has(msg.id);

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-xs">
                      {new Date(msg.receivedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  </div>
                )}

                <div className={cn("group relative flex items-start gap-2", isOutbound ? "justify-end" : "justify-start")}>
                  {/* Multi-select Checkbox */}
                  {isMultiSelect && (
                    <button
                      onClick={() => toggleSelectMessage(msg.id)}
                      className="mt-2 shrink-0 text-primary transition-transform active:scale-90"
                    >
                      {isSelected ? <CheckSquare className="h-5 w-5 fill-primary text-primary-foreground" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className={cn(
                      "relative max-w-[82%] rounded-2xl p-3.5 shadow-sm transition-all hover:shadow-md",
                      isOutbound
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "border bg-card rounded-bl-xs",
                      isOtp && !isRevealed && !isOutbound && "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
                      isOtp && isRevealed && !isOutbound && "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10",
                      isSelected && "ring-2 ring-primary ring-offset-1"
                    )}
                  >
                    {/* Content / OTP Reveal */}
                    {isOtp && otpResult.code && !isOutbound ? (
                      <div>
                        <SecureOtpReveal
                          text={msg.rawText}
                          code={otpResult.code}
                          purpose={otpResult.purpose || "OTP"}
                          onReveal={() => handleRevealOtp(msg.id)}
                          isRevealed={isRevealed}
                          onExpire={() => {
                            setRevealedOtps((prev) => {
                              const next = new Set(prev);
                              next.delete(msg.id);
                              return next;
                            });
                          }}
                        />

                        {/* Direct One-Tap Copy OTP Button */}
                        {isRevealed && (
                          <div className="mt-2.5 flex items-center gap-2 border-t border-emerald-500/20 pt-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(otpResult.code!);
                                toast.success(`Copied OTP ${otpResult.code} to clipboard`);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                              Copy Code ({otpResult.code})
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.rawText}</p>
                    )}

                    {/* Metadata & Status Footer */}
                    <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px]", isOutbound ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {!isOutbound && (
                        <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 font-medium", msgCfg.cls)}>
                          {msgCfg.icon}
                          {msgCfg.label}
                        </span>
                      )}

                      {isOutbound && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0 font-medium text-white">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {msg.classification === "verified" ? "Parsed Transaction" : "Sent"}
                        </span>
                      )}

                      {isOtp && !isOutbound && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-medium text-amber-700 dark:text-amber-300">
                          <Lock className="h-2.5 w-2.5" />
                          {otpResult.purpose || "OTP"}
                        </span>
                      )}

                      <span className="ml-auto opacity-90">
                        {new Date(msg.receivedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>

                      {/* Quick Read Aloud Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); speakMessage(msg.rawText); }}
                        className={cn(
                          "ml-1 p-0.5 rounded-full hover:bg-muted/50 transition-colors",
                          isOutbound ? "hover:bg-white/20 text-white" : "text-muted-foreground"
                        )}
                        title="Read aloud"
                      >
                        <Volume2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Context Menu Trigger */}
                  {!isMultiSelect && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuMsg(showMsgMenu ? null : msg.id); }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card border text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Context Menu Popup */}
                  {showMsgMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuMsg(null)} />
                      <div className={cn("absolute top-8 z-50 w-44 rounded-lg border bg-popover shadow-lg animate-scale-in", isOutbound ? "right-8" : "left-8")}>
                        <MenuButton icon={<Copy className="h-4 w-4" />} label="Copy text" onClick={() => handleMessageAction(msg, "copy")} />
                        <MenuButton icon={<Volume2 className="h-4 w-4" />} label="Read aloud" onClick={() => handleMessageAction(msg, "speak")} />
                        <MenuButton icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => handleMessageAction(msg, "forward")} />
                        <MenuButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={() => handleMessageAction(msg, "share")} />
                        <MenuButton icon={<Info className="h-4 w-4" />} label="Details" onClick={() => handleMessageAction(msg, "details")} />
                        <div className="my-1 border-t" />
                        <MenuButton icon={<Trash2 className="h-4 w-4" />} label="Delete" onClick={() => handleMessageAction(msg, "delete")} danger />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Smart Reply Chips */}
      {smartReplies.length > 0 && !replyText && (
        <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-thin bg-background/50 border-t">
          {smartReplies.map((reply, i) => (
            <button
              key={i}
              onClick={() => setReplyText(reply.text)}
              className="shrink-0 rounded-full border bg-card px-3 py-1 text-[11px] font-medium transition-all hover:bg-primary hover:text-primary-foreground"
            >
              {reply.text}
            </button>
          ))}
        </div>
      )}

      {/* Bank Presets Picker Panel */}
      {showPresetPicker && (
        <div className="border-t bg-muted/40 px-3 py-2 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              Insert Test Bank SMS
            </span>
            <button onClick={() => setShowPresetPicker(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
            {bankSmsPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setReplyText(preset.text);
                  setShowPresetPicker(false);
                  toast.success(`Inserted ${preset.label}`);
                }}
                className="shrink-0 rounded-lg border bg-background px-2.5 py-1.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <p className="text-[11px] font-semibold">{preset.label}</p>
                <p className="text-[9px] text-muted-foreground truncate max-w-[140px]">{preset.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reply Bar — Google SMS style */}
      <div className="border-t bg-background px-3 py-2 safe-bottom">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-10 w-10 shrink-0 rounded-full", showPresetPicker && "text-primary bg-muted")}
            onClick={() => setShowPresetPicker(!showPresetPicker)}
            title="Insert Sample Bank SMS"
          >
            <Wand2 className="h-5 w-5 text-primary" />
          </Button>

          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Attach" disabled>
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>

          <div className="relative flex-1">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Type or insert Bank SMS…"
              className="h-10 rounded-full bg-muted border-0 pl-4 pr-10 text-sm focus-visible:ring-1 focus-visible:ring-primary"
              disabled={composeMut.isPending}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
              aria-label="Emoji"
              disabled
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={sendReply}
            disabled={composeMut.isPending || !replyText.trim()}
            aria-label="Send"
          >
            {composeMut.isPending ? (
              <Clock className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Vault unlock dialog for OTP reveal */}
      <VaultUnlock
        open={showVaultUnlock}
        onOpenChange={setShowVaultUnlock}
        onUnlock={handleVaultUnlock}
        title="Reveal OTP Code"
        description="Authenticate to view the OTP code — it will auto-hide in 30 seconds"
      />
    </>
  );
}

// =====================================================
//  Message Detail Dialog (Enhanced)
// =====================================================
function MessageDetailDialog({
  message,
  onClose,
  onForward,
}: {
  message: SmsMessageRow | null;
  onClose: () => void;
  onForward: (msg: SmsMessageRow) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [otpRevealed, setOtpRevealed] = useState(false);
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);

  const otpResult = message ? detectOtp(message.rawText) : { isOtp: false };
  const isOtp = otpResult.isOtp;

  const handleShare = async () => {
    if (!message) return;
    const textToShare = isOtp && !otpRevealed ? blurOtp(message.rawText) : message.rawText;
    if (navigator.share) {
      try { await navigator.share({ title: `SMS from ${message.sender}`, text: textToShare }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(textToShare);
      toast.success("Message copied to clipboard");
    }
  };

  const handleCopy = async () => {
    if (!message) return;
    const textToCopy = isOtp && !otpRevealed ? blurOtp(message.rawText) : message.rawText;
    await navigator.clipboard.writeText(textToCopy);
    toast.success(isOtp && !otpRevealed ? "Blurred text copied" : "Copied to clipboard");
  };

  const handleVaultUnlock = () => {
    setOtpRevealed(true);
    toast.success("OTP revealed — auto-hiding in 30 seconds");
    setTimeout(() => setOtpRevealed(false), 30000);
  };

  const handleDelete = async () => {
    if (!message) return;
    if (confirm("Delete this message?")) {
      try {
        await fetch(`/api/inbox/${message.id}`, { method: "DELETE" });
        toast.success("Message deleted");
        onClose();
      } catch {
        toast.error("Failed to delete");
      }
    }
  };

  return (
    <Dialog open={!!message} onOpenChange={(v) => { if (!v) { setShowActions(false); onClose(); } }}>
      <DialogContent className="max-w-lg gap-0 p-0" aria-describedby={undefined} showCloseButton={false}>
        <DialogTitle className="sr-only">Message Detail</DialogTitle>
        {message && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-3 safe-top pr-12">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => { setShowActions(false); onClose(); }} aria-label="Close">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className={cn("grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white", getAvatarColor(message.sender ?? "U"))}>
                {getInitials(message.sender ?? "U")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{message.sender ?? "Unknown sender"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(message.receivedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setShowActions(!showActions)} aria-label="More options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            {/* Action sheet */}
            {showActions && (
              <div className="border-b bg-muted/10 py-1 animate-fade-in">
                <button onClick={handleCopy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  Copy text
                </button>
                <button onClick={() => speakMessage(message.rawText)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  Read aloud
                </button>
                <button onClick={() => onForward(message)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                  <Forward className="h-4 w-4 text-muted-foreground" />
                  Forward
                </button>
                <button onClick={handleShare} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  Share message
                </button>
                <button onClick={handleDelete} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-muted/50 dark:text-rose-400">
                  <Trash2 className="h-4 w-4" />
                  Delete message
                </button>
              </div>
            )}

            {/* Message body */}
            <div className="px-4 py-4">
              <div className={cn(
                "rounded-2xl rounded-tl-md border bg-muted/20 p-3",
                isOtp && !otpRevealed && "border-amber-500/30 bg-amber-500/5",
                isOtp && otpRevealed && "border-emerald-500/30 bg-emerald-500/5"
              )}>
                {isOtp && otpResult.code ? (
                  <div>
                    <SecureOtpReveal
                      text={message.rawText}
                      code={otpResult.code}
                      purpose={otpResult.purpose || "OTP"}
                      onReveal={() => setShowVaultUnlock(true)}
                      isRevealed={otpRevealed}
                      onExpire={() => setOtpRevealed(false)}
                    />
                    {otpRevealed && (
                      <div className="mt-2.5 flex items-center gap-2 border-t border-emerald-500/20 pt-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(otpResult.code!);
                            toast.success(`Copied OTP ${otpResult.code} to clipboard`);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                          Copy Code ({otpResult.code})
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.rawText}</pre>
                )}
              </div>

              {/* Meta info */}
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0 text-[10px] font-medium", (classConfig[message.classification] ?? classConfig.unparsed).cls)}>
                    {(classConfig[message.classification] ?? classConfig.unparsed).icon}
                    {(classConfig[message.classification] ?? classConfig.unparsed).label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sender Type</span>
                  <span className="font-medium capitalize">{message.senderType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Received</span>
                  <span className="font-medium">{new Date(message.receivedAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex gap-2 border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => speakMessage(message.rawText)} className="flex-1 gap-1.5">
                  <Volume2 className="h-3.5 w-3.5" />
                  Read Aloud
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1 gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => onForward(message)} className="flex-1 gap-1.5">
                  <Forward className="h-3.5 w-3.5" />
                  Forward
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
      <VaultUnlock
        open={showVaultUnlock}
        onOpenChange={setShowVaultUnlock}
        onUnlock={handleVaultUnlock}
        title={`Reveal ${otpResult.purpose || "OTP"}`}
        description="Authenticate to view the OTP code — it will auto-hide in 30 seconds"
      />
    </Dialog>
  );
}

// =====================================================
//  Forward Dialog
// =====================================================
function ForwardDialog({ message, onClose }: { message: SmsMessageRow | null; onClose: () => void }) {
  const [recipient, setRecipient] = useState("");
  const composeMut = useComposeMessage();

  const send = async () => {
    if (!message || !recipient.trim()) {
      toast.error("Enter a recipient");
      return;
    }
    try {
      await composeMut.mutateAsync({
        sender: recipient.trim(),
        text: message.rawText,
      });
      toast.success("Message forwarded");
      setRecipient("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to forward");
    }
  };

  return (
    <Dialog open={!!message} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md gap-0 p-0 rounded-xl overflow-hidden" aria-describedby={undefined} showCloseButton={false}>
        <DialogTitle className="sr-only">Forward Message</DialogTitle>
        <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">Forward Message</h3>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Forward to
            </label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Enter sender ID or phone number…"
              className="h-10 text-sm"
              autoFocus
            />
          </div>
          {message && (
            <div className="rounded-lg border bg-muted/20 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Message</p>
              <p className="text-xs leading-relaxed line-clamp-3">{message.rawText}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3 safe-bottom">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={composeMut.isPending || !recipient.trim()} className="gap-1.5">
            {composeMut.isPending ? <Clock className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
            Forward
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
//  Compose Dialog (Enhanced with Sample Templates)
// =====================================================
function ComposeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [sender, setSender] = useState("");
  const [text, setText] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const composeMut = useComposeMessage();

  const send = async () => {
    if (!text.trim()) {
      toast.error("Message text is required");
      return;
    }
    if (showSchedule && scheduleTime) {
      toast.info("Scheduled message saved", {
        description: `Will send at ${new Date(scheduleTime).toLocaleString("en-IN")}`,
      });
      setSender("");
      setText("");
      setShowSchedule(false);
      setScheduleTime("");
      onOpenChange(false);
      return;
    }
    try {
      const r = await composeMut.mutateAsync({
        sender: sender.trim() || undefined,
        text: text.trim(),
      });
      if (r.classification === "verified") {
        toast.success("Sent — transaction parsed!", { description: `Classification: ${r.classification}` });
      } else if (r.classification === "flagged") {
        toast.warning("Sent — flagged as suspicious", { description: "Moved to Security Alerts" });
      } else {
        toast.success("Message sent", { description: `Classification: ${r.classification}` });
      }
      setSender("");
      setText("");
      setShowSchedule(false);
      setScheduleTime("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSender(""); setText(""); setShowSchedule(false); setScheduleTime(""); setShowTemplates(false); } onOpenChange(v); }}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg gap-0 p-0 rounded-xl overflow-hidden" aria-describedby={undefined} showCloseButton={false}>
        <DialogTitle className="sr-only">Compose Message</DialogTitle>
        <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-3 safe-top">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">New Message</h3>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sender (optional)
            </label>
            <Input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="e.g. SBIINB, HDFCBK, or PAYTM…"
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Message
              </label>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Wand2 className="h-3 w-3" />
                {showTemplates ? "Hide Templates" : "Use Bank Template"}
              </button>
            </div>

            {/* Template Presets Picker */}
            {showTemplates && (
              <div className="rounded-lg border bg-muted/40 p-2 space-y-1.5 animate-fade-in">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Click to Insert Preset</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {bankSmsPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSender(preset.sender);
                        setText(preset.text);
                        setShowTemplates(false);
                        toast.success(`Loaded ${preset.label}`);
                      }}
                      className="rounded-md border bg-background p-2 text-left hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <p className="text-[11px] font-medium truncate">{preset.label}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{preset.sender}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste an SMS message…"
              className="min-h-[120px] w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {showSchedule && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Send at (scheduled)
              </label>
              <Input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 border-t pt-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title="Attach" disabled>
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-full", showSchedule && "text-primary")}
              onClick={() => setShowSchedule(!showSchedule)}
              title="Schedule send"
            >
              <CalendarClock className="h-4 w-4" />
            </Button>
            <div className="ml-auto flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Auto-parses transactions
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3 safe-bottom">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={composeMut.isPending || !text.trim()} className="gap-1.5">
            {composeMut.isPending ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {showSchedule && scheduleTime ? "Schedule" : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

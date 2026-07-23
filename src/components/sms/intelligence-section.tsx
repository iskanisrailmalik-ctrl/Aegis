"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  History,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  CircleAlert,
  Volume2,
  Square,
  Share2,
  Copy,
  User,
  ChevronDown,
} from "lucide-react";
import {
  useAskQuestion,
  useQueryHistory,
  useClearQueryHistory,
  type QueryResult,
} from "./use-intelligence";
import { formatINR, relativeTime } from "./format";
import { speak, stopSpeaking } from "@/lib/tts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SUGGESTED_QUESTIONS = [
  "How much did I spend on food this month?",
  "What's my income this month?",
  "Show my top 5 merchants by spend",
  "Summarize my spending this month",
  "How much did I pay in EMIs?",
  "Show me anything from Netflix",
];

const CONFIDENCE_STYLE = {
  high: { icon: <CheckCircle2 className="h-3 w-3" />, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", label: "High confidence" },
  medium: { icon: <AlertTriangle className="h-3 w-3" />, cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", label: "Limited data" },
  low: { icon: <CircleAlert className="h-3 w-3" />, cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300", label: "Low confidence" },
};

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  question?: string;
  result?: QueryResult;
  timestamp: string;
}

export function IntelligenceSection({
  voiceLang = "en",
  muted = false,
}: {
  voiceLang?: import("@/lib/i18n").Lang;
  muted?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const askMut = useAskQuestion();
  const historyQ = useQueryHistory();
  const clearHistMut = useClearQueryHistory();
  const scrollRef = useRef<HTMLDivElement>(null);

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, askMut.isPending]);

  const speakAnswer = (text: string, msgId: string) => {
    if (!ttsSupported || muted) return;
    if (speaking === msgId) {
      stopSpeaking();
      setSpeaking(null);
      return;
    }
    setSpeaking(msgId);
    speak(text, { lang: voiceLang, onEnd: () => setSpeaking(null) });
  };

  const ask = async (q?: string) => {
    const query = (q ?? question).trim();
    if (!query) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      question: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    try {
      const r = await askMut.mutateAsync(query);
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "ai",
        result: r,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Auto-speak credit-related answers
      if (!muted && ttsSupported && r.confidence === "high") {
        setTimeout(() => speakAnswer(r.answer, aiMsg.id), 500);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Query failed");
    }
  };

  const handleShare = async (result: QueryResult) => {
    const text = `Q: ${result.question}\nA: ${result.answer}`;
    if (navigator.share) {
      try { await navigator.share({ title: "AI Answer", text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  };

  const clearHistory = async () => {
    try {
      await clearHistMut.mutateAsync();
      setMessages([]);
      toast.success("Chat cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card className="flex h-[calc(100vh-10rem)] sm:h-[calc(100vh-8rem)] flex-col overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
          <Brain className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Ask AI</h2>
          <p className="text-[10px] text-muted-foreground">On-device RAG · Fully offline</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="ml-auto gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin bg-muted/10 p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && !askMut.isPending ? (
            <WelcomeScreen onSuggest={ask} />
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className="animate-fade-up">
                  {msg.role === "user" ? (
                    <UserBubble question={msg.question!} />
                  ) : (
                    <AIBubble
                      result={msg.result!}
                      speaking={speaking === msg.id}
                      onSpeak={() => speakAnswer(msg.result!.answer, msg.id)}
                      onShare={() => handleShare(msg.result!)}
                      muted={muted || !ttsSupported}
                    />
                  )}
                </div>
              ))}
              {askMut.isPending && <TypingIndicator />}
            </>
          )}
        </div>
      </div>

      {/* Input bar — chat style */}
      <div className="border-t bg-background px-4 pt-3 pb-5 safe-bottom">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && ask()}
            placeholder="Ask anything about your finances…"
            className="h-10 rounded-full bg-muted border-0 px-4 text-sm focus-visible:ring-1 focus-visible:ring-primary"
            disabled={askMut.isPending}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={() => ask()}
            disabled={askMut.isPending || !question.trim()}
            aria-label="Send"
          >
            {askMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function WelcomeScreen({ onSuggest }: { onSuggest: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary animate-pulse-ring">
        <Brain className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Ask me anything</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          I can answer questions about your spending, income, EMIs, and SMS messages — all on-device.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSuggest(q)}
            className="rounded-full border bg-card px-3 py-1.5 text-[11px] text-muted-foreground transition-all hover:border-primary hover:text-primary hover:shadow-sm"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ question }: { question: string }) {
  return (
    <div className="flex justify-end">
      <div className="flex items-start gap-2 max-w-[80%]">
        <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="text-[13px] leading-relaxed">{question}</p>
        </div>
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function AIBubble({
  result,
  speaking,
  onSpeak,
  onShare,
  muted,
}: {
  result: QueryResult;
  speaking: boolean;
  onSpeak: () => void;
  onShare: () => void;
  muted: boolean;
}) {
  const conf = CONFIDENCE_STYLE[result.confidence];
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Brain className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-sm">
          {/* Confidence badge */}
          <div className="mb-2 flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0 text-[9px] font-medium", conf.cls)}>
              {conf.icon}
              {conf.label}
            </span>
            {result.routedToTier1 && (
              <Badge variant="outline" className="text-[9px]">
                <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                Structured
              </Badge>
            )}
          </div>

          {/* Answer text */}
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed">{result.answer}</pre>

          {/* Mini chart */}
          {result.chart && result.chart.data.length > 0 && (
            <div className="mt-3 space-y-1 border-t pt-2">
              {result.chart.data.map((d, i) => {
                const max = Math.max(...result.chart!.data.map((x) => x.value), 1);
                const pct = (d.value / max) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground">{d.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[10px] tabular-nums">{formatINR(d.value)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sources toggle */}
          {result.sources.length > 0 && (
            <div className="mt-2 border-t pt-2">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", showSources && "rotate-180")} />
                Based on {result.sources.length} source{result.sources.length > 1 ? "s" : ""}
              </button>
              {showSources && (
                <div className="mt-2 space-y-1 animate-fade-in">
                  {result.sources.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1 text-[10px]">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-muted text-[8px] font-semibold">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {s.merchant && <span className="font-medium text-foreground">{s.merchant} · </span>}
                        {s.preview}
                      </span>
                      {s.amount && <span className="shrink-0 tabular-nums font-medium">{formatINR(s.amount)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {!muted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSpeak}
              className={cn("h-7 gap-1 px-2 text-[10px]", speaking ? "text-primary" : "text-muted-foreground")}
            >
              {speaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3 w-3" />}
              {speaking ? "Stop" : "Speak"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
          >
            <Share2 className="h-3 w-3" />
            Share
          </Button>
          {speaking && (
            <span className="inline-flex items-center gap-1 text-[9px] text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Speaking…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Brain className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

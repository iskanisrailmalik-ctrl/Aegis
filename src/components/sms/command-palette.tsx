"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardPaste,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Sparkles,
  Trash2,
  RefreshCw,
  FileText,
  Download,
  Search,
  Command,
  TrendingUp,
  Target,
  Repeat2,
  ShieldAlert,
  Plus,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actions: CommandAction[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const filtered = useCallback(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [query, actions]);

  const list = filtered();

  // Clamp selected index so it's always valid for the current list.
  // This replaces the previous effect-based reset.
  const safeSelected = list.length === 0 ? 0 : Math.min(selected, list.length - 1);
  const setSelectedSafe = (i: number) => setSelected(i);

  // keyboard navigation within palette
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, list.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const action = list[safeSelected];
        if (action) {
          action.run();
          onOpenChange(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, list, safeSelected, onOpenChange]);

  // Handle close: clear query via the onOpenChange wrapper
  const handleOpenChange = (v: boolean) => {
    if (!v) setQuery("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined} className="top-[20%] max-w-xl gap-0 overflow-hidden p-0 translate-y-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        {/* search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* results */}
        <div className="max-h-80 overflow-y-auto scrollbar-thin p-2">
          {list.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No commands match “{query}”.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {list.map((action, i) => (
                <li key={action.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedSafe(i)}
                    onClick={() => {
                      action.run();
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                      i === safeSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <span className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                      i === safeSelected ? "bg-primary/15" : "bg-muted"
                    )}>
                      {action.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{action.label}</p>
                      {action.description && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {action.description}
                        </p>
                      )}
                    </div>
                    {action.shortcut && (
                      <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="h-3 w-3" />
              <kbd className="rounded border bg-background px-1 py-0.5">↑↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border bg-background px-1 py-0.5">↵</kbd>
              select
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <Command className="h-3 w-3" />
            Command Palette
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Hook to register a global keyboard shortcut (e.g., Cmd+K / Ctrl+K). */
export function useGlobalShortcut(
  combo: string,
  handler: () => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const parts = combo.toLowerCase().split("+");
      const key = parts[parts.length - 1];
      const needCtrl = parts.includes("ctrl") || parts.includes("cmd") || parts.includes("mod");
      const needShift = parts.includes("shift");
      const needAlt = parts.includes("alt");

      const matchKey = e.key.toLowerCase() === key;
      const matchCtrl = needCtrl ? (e.ctrlKey || e.metaKey) : true;
      const matchShift = needShift ? e.shiftKey : true;
      const matchAlt = needAlt ? e.altKey : true;

      if (matchKey && matchCtrl && matchShift && matchAlt) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, deps);
}

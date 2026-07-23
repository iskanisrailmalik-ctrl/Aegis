"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Eye, EyeOff, Copy, Check, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { secureCopyToClipboard } from "@/lib/secure-clipboard";
import { setSecureScreen } from "@/lib/native-bridge";
import { toast } from "sonner";

/**
 * SecureOtpReveal — Phase D component for OTP display with security features.
 *
 * Features:
 * - Blurred by default (shows ●●●●●●)
 * - "Reveal" button triggers VaultUnlock (biometric/PIN)
 * - After reveal: 30-second countdown timer with visual progress
 * - Auto-hide when timer reaches 0
 * - "Copy" button uses secure clipboard with auto-clear
 * - FLAG_SECURE equivalent: prevents screenshot via CSS (user-select: none)
 *
 * Used in:
 * - Inbox chat bubbles (OTP messages)
 * - Message detail dialog (OTP messages)
 * - Notifications (native Kotlin handles this separately)
 */

interface SecureOtpRevealProps {
  /** The full message text containing the OTP */
  text: string;
  /** The detected OTP code */
  code: string;
  /** The OTP purpose (e.g., "OTP", "UPI PIN", "CVV") */
  purpose?: string;
  /** Callback to trigger unlock (opens VaultUnlock dialog) */
  onReveal: () => void;
  /** Whether the OTP is currently revealed */
  isRevealed: boolean;
  /** Callback when the reveal expires */
  onExpire: () => void;
}

const REVEAL_DURATION = 30; // seconds

export function SecureOtpReveal({
  text,
  code,
  purpose = "OTP",
  onReveal,
  isRevealed,
  onExpire,
}: SecureOtpRevealProps) {
  const [remaining, setRemaining] = useState(REVEAL_DURATION);
  const [copied, setCopied] = useState(false);

  // Countdown timer + FLAG_SECURE management
  useEffect(() => {
    if (!isRevealed) {
      // Disable FLAG_SECURE when OTP is hidden
      setSecureScreen(false);
      return;
    }

    // Enable FLAG_SECURE when OTP is revealed (blocks screenshots on native)
    setSecureScreen(true);

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      // Disable FLAG_SECURE when component unmounts or reveal expires
      setSecureScreen(false);
    };
  }, [isRevealed, onExpire]);

  const handleCopy = useCallback(async () => {
    const ok = await secureCopyToClipboard(code, 30000, () => {
      toast.info("Clipboard auto-cleared", {
        description: "OTP code removed from clipboard for security",
      });
      setCopied(false);
    });

    if (ok) {
      setCopied(true);
      toast.success("OTP copied — auto-clears in 30s", {
        description: "Clipboard will be cleared automatically",
      });
    } else {
      toast.error("Failed to copy OTP");
    }
  }, [code]);

  // Blurred display
  if (!isRevealed) {
    const blurredText = text.replace(code, "●".repeat(code.length));
    return (
      <div className="space-y-2">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap select-none">
          {blurredText}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReveal();
          }}
          className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
        >
          <Eye className="h-3 w-3" />
          Reveal {purpose}
        </button>
      </div>
    );
  }

  // Revealed display with countdown
  const progressPct = (remaining / REVEAL_DURATION) * 100;
  const isUrgent = remaining <= 5;

  return (
    <div className="space-y-2">
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap select-none">
        {text}
      </p>

      {/* Countdown bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[9px]">
          <span className={cn(
            "inline-flex items-center gap-1 font-medium",
            isUrgent ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            <Timer className="h-2.5 w-2.5" />
            Auto-hides in {remaining}s
          </span>
          {copied && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5" />
              Copied
            </span>
          )}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-linear",
              isUrgent ? "bg-rose-500" : "bg-emerald-500"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="h-7 gap-1 text-[10px]"
        >
          {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
          {copied ? "Copied" : "Copy code"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onExpire();
          }}
          className="h-7 gap-1 text-[10px] text-muted-foreground"
        >
          <EyeOff className="h-2.5 w-2.5" />
          Hide now
        </Button>
      </div>

      {/* Security note */}
      <p className="text-[8px] text-muted-foreground flex items-center gap-0.5">
        <Lock className="h-2 w-2" />
        Screenshot protected · Clipboard auto-clears
      </p>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Shield,
  Lock,
  Fingerprint,
  Loader2,
  Delete,
  KeyRound,
  Unlock,
} from "lucide-react";
import {
  isAuthEnabled,
  hasPin,
  verifyPin,
  isWebAuthnAvailable,
  authenticateWithBiometric,
  isPlatformAuthenticatorAvailable,
} from "@/lib/auth";
import { hasRegisteredPasskey, authenticatePasskey } from "@/lib/passkey";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface VaultUnlockProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUnlock: () => void;
  title?: string;
  description?: string;
}

/**
 * Reusable vault unlock dialog.
 * Secures document/document-vault access with:
 * - PIN (if app lock enabled)
 * - Biometric (if available)
 * - If app lock not enabled, allows setting up a quick PIN
 */
export function VaultUnlock({
  open,
  onOpenChange,
  onUnlock,
  title = "Unlock Vault",
  description = "Authenticate to access secured documents",
}: VaultUnlockProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  // Derive auth state directly — no setState in effect needed
  const authEnabled = typeof window !== "undefined" ? isAuthEnabled() : false;
  const hasPinSet = typeof window !== "undefined" ? hasPin() : false;

  // Check biometric availability once on mount via callback
  const checkBiometric = useCallback(async () => {
    if (isWebAuthnAvailable()) {
      const available = await isPlatformAuthenticatorAvailable();
      setBiometricAvailable(available);
    }
  }, []);

  // Use onOpenChange callback pattern instead of effect
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setPin("");
      setError(false);
      checkBiometric();
    }
    onOpenChange(v);
  };

  const tryBiometric = async () => {
    setLoading(true);
    setError(false);
    let success = false;
    if (hasRegisteredPasskey()) {
      success = await authenticatePasskey();
    } else {
      success = await authenticateWithBiometric();
    }
    setLoading(false);
    if (success) {
      toast.success(hasRegisteredPasskey() ? "Unlocked via Hardware Passkey" : "Authenticated via Biometrics");
      onUnlock();
      onOpenChange(false);
    } else {
      toast.error("Passkey / Biometric authentication failed");
    }
  };

  const handlePinSubmit = useCallback(async (pinValue?: string) => {
    const p = pinValue ?? pin;
    if (p.length < 4) return;
    setLoading(true);
    setError(false);
    const valid = await verifyPin(p);
    setLoading(false);
    if (valid) {
      setPin("");
      onUnlock();
      onOpenChange(false);
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 500);
      toast.error("Incorrect PIN");
    }
  }, [pin, onUnlock, onOpenChange]);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length >= 4) {
        setTimeout(() => handlePinSubmit(newPin), 150);
      }
    }
  };

  // If auth not enabled, prompt to enable it
  if (!authEnabled || !hasPinSet) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent aria-describedby={undefined} className="max-w-sm gap-0 p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">App lock not enabled</p>
              <p className="text-xs text-muted-foreground">
                Enable app lock in Settings to secure document access with a PIN, password, or biometric authentication.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  toast.info("Enable app lock in Settings → App Lock to secure documents");
                }}
                className="gap-1.5"
              >
                Go to Settings
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Allow viewing without lock (optional security)
                  onUnlock();
                  onOpenChange(false);
                }}
                className="gap-1.5 text-xs"
              >
                <Unlock className="h-3.5 w-3.5" />
                View without lock (not recommended)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-1.5rem)] max-w-sm gap-0 p-0 rounded-xl overflow-hidden">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 p-5">
          {/* Lock icon */}
          <div className={cn(
            "grid h-14 w-14 place-items-center rounded-full transition-all",
            error ? "bg-rose-500/10 text-rose-500 animate-pulse" : "bg-primary/10 text-primary"
          )}>
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Lock className="h-6 w-6" />}
          </div>

          {/* PIN dots */}
          <div className="flex gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  error
                    ? "bg-rose-500"
                    : i < pin.length
                      ? "bg-primary scale-110"
                      : "bg-muted-foreground/20"
                )}
              />
            ))}
          </div>

          {/* Biometric button */}
          {biometricAvailable && (
            <Button
              variant="outline"
              size="sm"
              onClick={tryBiometric}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <Fingerprint className="h-3.5 w-3.5" />
              Use Biometric
            </Button>
          )}

          {/* Number pad */}
          <div className="grid w-56 grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                disabled={loading}
                className="grid h-12 w-12 place-items-center rounded-full border bg-card text-base font-semibold transition-all hover:bg-muted active:scale-95 disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <div className="h-12 w-12" />
            <button
              onClick={() => handleDigit("0")}
              disabled={loading}
              className="grid h-12 w-12 place-items-center rounded-full border bg-card text-base font-semibold transition-all hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={() => setPin(pin.slice(0, -1))}
              disabled={loading}
              className="grid h-12 w-12 place-items-center rounded-full text-muted-foreground transition-all hover:bg-muted active:scale-95"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

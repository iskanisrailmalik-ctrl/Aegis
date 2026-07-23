"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Lock,
  Unlock,
  Fingerprint,
  Shield,
  Loader2,
  Delete,
  Check,
  KeyRound,
} from "lucide-react";
import {
  isAuthEnabled,
  hasPin,
  verifyPin,
  setPin,
  removePin,
  isWebAuthnAvailable,
  authenticateWithBiometric,
  updateLastActive,
} from "@/lib/auth";
import {
  registerPasskey,
  authenticatePasskey,
  hasRegisteredPasskey,
  getRegisteredPasskeys,
  removePasskey,
} from "@/lib/passkey";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPinState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    // Check biometric availability on mount
    if (isWebAuthnAvailable()) {
      import("@/lib/auth").then(async (mod) => {
        const available = await mod.isPlatformAuthenticatorAvailable();
        setBiometricAvailable(available);
        // Auto-try biometric on mount
        if (available) {
          tryBiometric();
        }
      });
    }
  }, []);

  const tryBiometric = async () => {
    setLoading(true);
    let success = false;
    if (hasRegisteredPasskey()) {
      success = await authenticatePasskey();
    } else {
      success = await authenticateWithBiometric();
    }
    setLoading(false);
    if (success) {
      toast.success(hasRegisteredPasskey() ? "Unlocked via Hardware Passkey" : "Unlocked via Biometric");
      updateLastActive();
      onUnlock();
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError(false);
    const valid = await verifyPin(pin);
    setLoading(false);
    if (valid) {
      updateLastActive();
      setPinState("");
      onUnlock();
    } else {
      setError(true);
      setPinState("");
      setTimeout(() => setError(false), 500);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPinState(newPin);
      if (newPin.length >= 4) {
        // Auto-submit at 4 digits (or let user press enter for 5-6)
        setTimeout(() => {
          if (newPin === pin + digit) {
            handlePinSubmitWithPin(newPin);
          }
        }, 200);
      }
    }
  };

  const handlePinSubmitWithPin = async (pinValue: string) => {
    setLoading(true);
    setError(false);
    const valid = await verifyPin(pinValue);
    setLoading(false);
    if (valid) {
      updateLastActive();
      setPinState("");
      onUnlock();
    } else {
      setError(true);
      setPinState("");
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md safe-area">
      {/* Lock icon */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className={cn(
          "grid h-20 w-20 place-items-center rounded-3xl bg-card border shadow-lg p-3 transition-all",
          error && "border-rose-500/50 bg-rose-500/10 animate-pulse"
        )}>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <img src="/logo.png" alt="Aegis Logo" className="h-full w-full object-contain" />
          )}
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">App Locked</h2>
          <p className="text-xs text-muted-foreground">Enter your PIN or use biometric</p>
        </div>
      </div>

      {/* PIN dots */}
      <div className="mb-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-3 w-3 rounded-full transition-all",
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
          className="mb-4 gap-2"
        >
          <Fingerprint className="h-4 w-4" />
          Use Biometric
        </Button>
      )}

      {/* Number pad */}
      <div className="grid w-64 grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => handlePinDigit(d)}
            className="grid h-14 w-14 place-items-center rounded-full border bg-card text-lg font-semibold transition-all hover:bg-muted active:scale-95"
          >
            {d}
          </button>
        ))}
        <div className="h-14 w-14" />
        <button
          onClick={() => handlePinDigit("0")}
          className="grid h-14 w-14 place-items-center rounded-full border bg-card text-lg font-semibold transition-all hover:bg-muted active:scale-95"
        >
          0
        </button>
        <button
          onClick={() => setPinState(pin.slice(0, -1))}
          className="grid h-14 w-14 place-items-center rounded-full text-muted-foreground transition-all hover:bg-muted active:scale-95"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * PIN setup dialog — used when enabling app lock for the first time.
 */
export function PinSetupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState<"setup" | "confirm" | "done">("setup");
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("setup");
      setPin1("");
      setPin2("");
      if (isWebAuthnAvailable()) {
        import("@/lib/auth").then(async (mod) => {
          setBiometricAvailable(await mod.isPlatformAuthenticatorAvailable());
        });
      }
    }
  }, [open]);

  const handleSetPin = async () => {
    if (pin1.length < 4) {
      toast.error("PIN must be at least 4 digits");
      return;
    }
    if (step === "setup") {
      setStep("confirm");
      return;
    }
    if (pin1 !== pin2) {
      toast.error("PINs don't match");
      setPin2("");
      return;
    }
    setLoading(true);
    await setPin(pin1);
    setLoading(false);
    setStep("done");
    toast.success("App lock enabled");
    setTimeout(() => {
      onOpenChange(false);
    }, 1500);
  };

  return (
    <div className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md safe-area", !open && "hidden")}>
      <div className="w-full max-w-sm px-6">
        {step === "done" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Check className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">App lock enabled successfully!</p>
            {biometricAvailable && (
              <p className="text-xs text-muted-foreground">Biometric authentication is also available.</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Shield className="h-7 w-7" />
              </div>
              <div className="text-center">
                <h2 className="text-base font-semibold">
                  {step === "setup" ? "Set App PIN" : "Confirm PIN"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {step === "setup"
                    ? "Choose a 4-6 digit PIN to lock your app"
                    : "Re-enter your PIN to confirm"}
                </p>
              </div>
            </div>

            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={step === "setup" ? pin1 : pin2}
              onChange={(e) => step === "setup" ? setPin1(e.target.value.replace(/\D/g, "")) : setPin2(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
              placeholder="••••"
              className="mb-4 h-12 text-center text-2xl tracking-[0.5em]"
              autoFocus
            />

            <Button
              onClick={handleSetPin}
              disabled={loading || (step === "setup" ? pin1.length < 4 : pin2.length < 4)}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : step === "setup" ? "Continue" : "Enable Lock"}
            </Button>

            {step === "setup" && (
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="mt-2 w-full text-xs text-muted-foreground"
              >
                Cancel
              </Button>
            )}

            {biometricAvailable && step === "setup" && (
              <p className="mt-4 text-center text-[10px] text-muted-foreground">
                💡 Biometric (fingerprint/Face ID) will also be available on unlock
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * App Lock settings card — for the Settings view.
 */
export function AppLockSettings() {
  const [enabled, setEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [passkeys, setPasskeys] = useState(() => getRegisteredPasskeys());
  const [loadingPasskey, setLoadingPasskey] = useState(false);

  useEffect(() => {
    setEnabled(isAuthEnabled() && hasPin());
    if (isWebAuthnAvailable()) {
      import("@/lib/auth").then(async (mod) => {
        setBiometricAvailable(await mod.isPlatformAuthenticatorAvailable());
      });
    }
  }, []);

  const handleToggle = () => {
    if (enabled) {
      removePin();
      setEnabled(false);
      toast.success("App lock disabled");
    } else {
      setShowSetup(true);
    }
  };

  const handleCreatePasskey = async () => {
    setLoadingPasskey(true);
    try {
      const created = await registerPasskey("Aegis Device Passkey");
      if (created) {
        toast.success("Hardware Passkey registered successfully!");
        setPasskeys(getRegisteredPasskeys());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to register Passkey");
    } finally {
      setLoadingPasskey(false);
    }
  };

  const handleRemovePasskey = (id: string) => {
    removePasskey(id);
    setPasskeys(getRegisteredPasskeys());
    toast.success("Passkey removed");
  };

  return (
    <>
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">App Security & Lock</p>
            <p className="text-[11px] text-muted-foreground">
              {enabled
                ? passkeys.length > 0
                  ? "PIN + WebAuthn Hardware Passkey active"
                  : biometricAvailable
                    ? "PIN + Biometric authentication active"
                    : "PIN authentication active"
                : "Protect your financial data, documents, and OTPs with a Passkey or PIN"}
            </p>
          </div>
          <Button
            variant={enabled ? "destructive" : "default"}
            size="sm"
            onClick={handleToggle}
            className="gap-1.5"
          >
            {enabled ? (
              <>
                <Unlock className="h-3.5 w-3.5" />
                Disable Lock
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                Enable Lock
              </>
            )}
          </Button>
        </div>

        {/* Passkey Section */}
        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Hardware Passkeys (WebAuthn / FIDO2)
              </p>
              <p className="text-[10px] text-muted-foreground">
                Authenticate with Touch ID, Face ID, Windows Hello, or Security Keys.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreatePasskey}
              disabled={loadingPasskey}
              className="gap-1.5 text-xs shrink-0"
            >
              {loadingPasskey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              {passkeys.length > 0 ? "Add Passkey" : "Create Passkey"}
            </Button>
          </div>

          {passkeys.length > 0 && (
            <div className="space-y-1.5">
              {passkeys.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="font-semibold">{p.displayName}</p>
                      <p className="text-[9px] text-muted-foreground">Registered {new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={() => handleRemovePasskey(p.id)} className="text-muted-foreground hover:text-rose-500">
                    <Delete className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <PinSetupDialog open={showSetup} onOpenChange={(v) => {
        setShowSetup(v);
        if (!v) {
          setEnabled(isAuthEnabled() && hasPin());
        }
      }} />
    </>
  );
}

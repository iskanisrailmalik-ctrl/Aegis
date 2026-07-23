"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Shield,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Lock,
  Bell,
  Volume2,
  Eye,
} from "lucide-react";
import {
  getDefaultSmsAppStatus,
  requestDefaultSmsRole,
  type DefaultSmsAppStatus,
} from "@/lib/native-bridge";
import { isNativeTrack } from "@/lib/feature-flags";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * OnboardingDialog — Phase E first-time setup flow.
 *
 * Shown when the user first installs the native Android app and opens it.
 * Walks them through:
 * 1. Welcome to Aegis
 * 2. What Aegis does (parse, detect scams, track loans, voice)
 * 3. Default SMS app setup (become default to auto-read SMS)
 * 4. Privacy reassurance (on-device only)
 * 5. Ready to go
 *
 * In web mode, this dialog is NOT shown (no default SMS app to set up).
 * The web app just shows the manual paste flow.
 */

type OnboardingStep = "welcome" | "features" | "default-sms" | "privacy" | "done";

const STEPS: { id: OnboardingStep; title: string }[] = [
  { id: "welcome", title: "Welcome" },
  { id: "features", title: "Features" },
  { id: "default-sms", title: "SMS Setup" },
  { id: "privacy", title: "Privacy" },
  { id: "done", title: "Ready" },
];

export function OnboardingDialog({ open, onComplete }: { open: boolean; onComplete: () => void }) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [status, setStatus] = useState<DefaultSmsAppStatus | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (open && isNativeTrack()) {
      getDefaultSmsAppStatus().then(setStatus);
    }
  }, [open]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].id);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].id);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleRequestRole = async () => {
    setRequesting(true);
    try {
      const granted = await requestDefaultSmsRole();
      if (granted) {
        toast.success("Aegis is now your default SMS app!");
        setStatus(await getDefaultSmsAppStatus());
        setTimeout(handleNext, 1000);
      } else {
        toast.info("You can set this later in Settings → Default SMS App");
        handleNext();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to request role");
      handleNext();
    } finally {
      setRequesting(false);
    }
  };

  const isLastStep = step === "done";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleSkip()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-1.5rem)] max-w-md gap-0 p-0 max-h-[90vh] overflow-hidden flex flex-col rounded-xl">
        {/* Progress bar */}
        <div className="flex shrink-0 border-b bg-muted/30 px-5 py-3">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= stepIndex ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          {step === "welcome" && (
            <div className="flex flex-col items-center gap-4 text-center animate-fade-up">
              <img src="/logo.png" alt="Aegis Logo" className="h-16 w-16 object-contain drop-shadow-md animate-pulse-glow" />
              <div>
                <h2 className="text-xl font-bold">Welcome to Aegis</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your offline SMS finance tracker for India.
                </p>
              </div>
              <div className="space-y-2 text-left w-full">
                <FeatureRow icon={<Sparkles className="h-4 w-4" />} text="Parse bank, UPI, and NBFC SMS automatically" />
                <FeatureRow icon={<Shield className="h-4 w-4" />} text="Detect scams and protect your money" />
                <FeatureRow icon={<Volume2 className="h-4 w-4" />} text="Speak transactions in 10 Indian languages" />
              </div>
            </div>
          )}

          {step === "features" && (
            <div className="space-y-4 animate-fade-up">
              <div className="text-center">
                <h2 className="text-lg font-bold">What Aegis Does</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Everything runs on your device — no data leaves your phone.
                </p>
              </div>
              <div className="space-y-3">
                <FeatureCard
                  icon={<MessageSquare className="h-5 w-5" />}
                  title="SMS Parsing"
                  description="Auto-extract amount, merchant, bank, and date from bank SMS. Supports 25+ Indian banks."
                  tone="primary"
                />
                <FeatureCard
                  icon={<Shield className="h-5 w-5" />}
                  title="Scam Detection"
                  description="3-way classification: verified, unverified, flagged. 9+ scam heuristics with OTP blur."
                  tone="emerald"
                />
                <FeatureCard
                  icon={<Volume2 className="h-5 w-5" />}
                  title="Voice Announcements"
                  description="Speaks new transactions in Hindi, Tamil, Telugu, Bengali, and 6 more languages."
                  tone="amber"
                />
                <FeatureCard
                  icon={<Lock className="h-5 w-5" />}
                  title="Secure Vault"
                  description="AES-GCM encrypted document storage. OTP codes blurred and gated behind biometric reveal."
                  tone="rose"
                />
              </div>
            </div>
          )}

          {step === "default-sms" && (
            <div className="space-y-4 animate-fade-up">
              <div className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-lg font-bold">Set as Default SMS App</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  To automatically read and parse incoming SMS, Aegis needs to be your default SMS handler.
                </p>
              </div>

              {status?.isDefaultSmsApp ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Aegis is your default SMS app!
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    SMS will be automatically parsed as they arrive.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    <p className="font-medium text-amber-700 dark:text-amber-300">What this means:</p>
                    <ul className="mt-1.5 space-y-1">
                      <li>• Aegis replaces Google Messages as your texting app</li>
                      <li>• All SMS are automatically parsed and categorized</li>
                      <li>• OTP codes are blurred and secured</li>
                      <li>• You can change back anytime in Android Settings</li>
                    </ul>
                  </div>
                  <Button
                    onClick={handleRequestRole}
                    disabled={requesting}
                    className="w-full gap-1.5"
                  >
                    {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    {requesting ? "Requesting..." : "Set as Default SMS App"}
                  </Button>
                  <button
                    onClick={handleNext}
                    className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Skip for now — use manual paste
                  </button>
                </>
              )}
            </div>
          )}

          {step === "privacy" && (
            <div className="space-y-4 animate-fade-up">
              <div className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Lock className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-lg font-bold">Your Privacy is Protected</h2>
              </div>
              <div className="space-y-2">
                <FeatureRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="SMS never leaves your device" />
                <FeatureRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="All parsing is on-device" />
                <FeatureRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="No cloud, no tracking, no ads" />
                <FeatureRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Documents are AES-GCM encrypted" />
                <FeatureRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="OTP codes are blurred and secured" />
                <FeatureRow icon={<Eye className="h-4 w-4 text-emerald-500" />} text="Screenshots blocked on OTP screens (native)" />
                <FeatureRow icon={<Bell className="h-4 w-4 text-emerald-500" />} text="Notifications hidden on lock screen" />
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 text-center animate-fade-up">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 animate-sparkle">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">You're All Set!</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aegis is ready to track your finances.
                </p>
              </div>
              {!status?.isDefaultSmsApp && (
                <div className="rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  Tip: Set Aegis as your default SMS app in Settings to auto-read SMS.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="shrink-0 flex items-center justify-between gap-2 border-t bg-muted/20 px-6 py-3">
          {stepIndex > 0 && !isLastStep ? (
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            {!isLastStep && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-xs text-muted-foreground">
                Skip
              </Button>
            )}
            {step !== "default-sms" && (
              <Button onClick={handleNext} size="sm" className="gap-1.5">
                {isLastStep ? "Get Started" : "Next"}
                {!isLastStep && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <span className="text-xs">{text}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "primary" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tones[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

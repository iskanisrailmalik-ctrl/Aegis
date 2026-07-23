"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Volume2,
  VolumeX,
  Languages,
  ShieldCheck,
  Info,
  Download,
  Upload,
  Database,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { AppSettingsState } from "../use-sms-data";
import { useSaveSettings } from "../use-sms-data";
import { MerchantOverrides } from "../merchant-overrides";
import { AppLockSettings } from "../lock-screen";
import { DefaultSmsAppSettings } from "../default-sms-settings";
import { INDIAN_LANGUAGES, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SettingsView({
  settings,
  onReplayTour,
}: {
  settings?: AppSettingsState;
  onReplayTour?: () => void;
}) {
  const save = useSaveSettings();

  const update = async (patch: Partial<AppSettingsState>) => {
    try {
      await save.mutateAsync(patch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8 safe-bottom">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          <p className="text-xs text-muted-foreground">
            Language, voice, theme, data management, and app security.
          </p>
        </div>
      </div>

      {/* Language settings */}
      <Card className="p-4 sm:p-5">
        <div className="space-y-4">
          <SettingRow
            icon={<Languages className="h-4 w-4" />}
            title="UI Language"
            description="Interface text language"
          >
            <Select
              value={settings?.uiLanguage ?? "en"}
              onValueChange={(v) => update({ uiLanguage: v as Lang })}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.flag} {l.nativeLabel} ({l.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<Volume2 className="h-4 w-4" />}
            title="Voice Language"
            description="Spoken announcement language (Indian languages)"
          >
            <Select
              value={settings?.voiceLanguage ?? "en"}
              onValueChange={(v) => update({ voiceLanguage: v as Lang })}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.flag} {l.nativeLabel} ({l.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <Separator />

          <SettingRow
            icon={settings?.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            title="Voice Announcements"
            description="Speak transactions aloud automatically"
          >
            <Switch
              checked={!settings?.muted}
              onCheckedChange={(c) => update({ muted: !c })}
            />
          </SettingRow>

          {!settings?.muted && (
            <VoiceSettingsCard voiceLang={settings?.voiceLanguage ?? "en"} />
          )}
        </div>
      </Card>

      {/* Theme */}
      <Card className="p-4 sm:p-5">
        <SettingRow
          icon={
            settings?.theme === "dark" ? <Moon className="h-4 w-4" /> :
            settings?.theme === "light" ? <Sun className="h-4 w-4" /> :
            <Monitor className="h-4 w-4" />
          }
          title="Theme"
          description="Light / Dark / System"
        >
          <Select
            value={settings?.theme ?? "system"}
            onValueChange={(v) => update({ theme: v as "light" | "dark" | "system" })}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </Card>

      {/* Data management */}
      <Card className="p-4 sm:p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">Data Management</Label>
              <p className="text-[11px] text-muted-foreground">Backup or restore your data</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => window.open("/api/backup", "_blank")}
            >
              <Download className="h-4 w-4" />
              Download Backup
            </Button>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              <Upload className="h-4 w-4" />
              Restore
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    if (!confirm("Restore from backup? This will MERGE with existing data. Continue?")) return;
                    const r = await fetch("/api/backup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ data: data.data ?? data, __clear: false }),
                    });
                    const result = await r.json();
                    if (r.ok) {
                      toast.success("Backup restored", {
                        description: `Imported ${result.imported.transactions} transactions, ${result.imported.loans} loans.`,
                      });
                    } else {
                      toast.error(result.error || "Restore failed");
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Invalid backup file");
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Merchant overrides */}
      <Card className="p-4 sm:p-5">
        <MerchantOverrides />
      </Card>

      {/* Default SMS App (Android native bridge) */}
      <DefaultSmsAppSettings />

      {/* App Lock / Authentication */}
      <AppLockSettings />

      {/* Privacy + About */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-xs font-medium">Privacy</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Your SMS never leaves your device. Parsing, scam detection, storage, and voice all run locally in your browser.
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-medium">About</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Aegis — Offline SMS Finance Tracker for India. Parses bank, payments bank, UPI/wallet, and NBFC SMS; speaks transactions in your language; tracks loans & EMIs; flags scam messages — all on-device.
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            <p className="text-xs font-medium">App Onboarding & Tour</p>
            <p className="text-[11px] text-muted-foreground">Replay guided interactive feature walkthrough.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.removeItem("aegis_onboarded");
              // Clear screen guide dismissed states
              Object.keys(localStorage)
                .filter((k) => k.startsWith("aegis_guide_dismissed_"))
                .forEach((k) => localStorage.removeItem(k));
              window.dispatchEvent(new Event("aegis_guide_update"));
              if (onReplayTour) onReplayTour();
              toast.success("App tour & exploration guides reset!");
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Replay Guided Tour
          </Button>
        </div>
      </Card>

      {/* Advanced Features (device capability detection) */}
      <AdvancedFeaturesCard />
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="sm:ml-auto sm:w-auto">{children}</div>
    </div>
  );
}

function AdvancedFeaturesCard() {
  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <Label className="text-sm font-medium">Advanced Features</Label>
          <p className="text-[11px] text-muted-foreground">Auto-detected based on device capabilities</p>
        </div>
      </div>
      <div className="space-y-2">
        <FeatureRow
          label="Document Encryption"
          description="AES-GCM encryption for uploaded documents (Web Crypto API)"
          available={typeof window !== "undefined" && !!window.crypto?.subtle}
        />
        <FeatureRow
          label="Neural TTS Voices"
          description="High-quality neural text-to-speech (browser-dependent)"
          available={typeof window !== "undefined" && "speechSynthesis" in window}
        />
        <FeatureRow
          label="OCR (Document Scanning)"
          description="Extract text from scanned documents (loaded on-demand)"
          available={true}
        />
        <FeatureRow
          label="Background Sync"
          description="Queue SMS parsing when offline, sync when online"
          available={typeof window !== "undefined" && "SyncManager" in window}
        />
        <FeatureRow
          label="Push Notifications"
          description="EMI reminders and scam alerts via push"
          available={typeof window !== "undefined" && "PushManager" in window}
        />
        <FeatureRow
          label="PWA Install"
          description="Install as a standalone app on mobile/desktop"
          available={typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches}
          installedLabel="Installed"
        />
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Database className="h-3 w-3" />
          Rule Registry & Crowdsourcing
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => window.open("/api/registry?action=export", "_blank")}
          >
            <Download className="h-3.5 w-3.5" />
            Export Rules
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => window.open("/api/submissions?action=export", "_blank")}
          >
            <Download className="h-3.5 w-3.5" />
            Export Submissions
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Export your custom bank rules and anonymized SMS format submissions to share with the Rule Registry maintainer.
        </p>
      </div>
    </Card>
  );
}

function FeatureRow({
  label,
  description,
  available,
  installedLabel,
}: {
  label: string;
  description: string;
  available: boolean;
  installedLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <span className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium",
        available
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-muted-foreground/30 bg-muted text-muted-foreground"
      )}>
        {available ? (
          <>
            <CheckCircle2 className="h-2.5 w-2.5" />
            {installedLabel || "Available"}
          </>
        ) : (
          "Not available"
        )}
      </span>
    </div>
  );
}

function VoiceSettingsCard({ voiceLang }: { voiceLang: Lang }) {
  const [rate, setRate] = useState(0.9);
  const [pitch, setPitch] = useState(1.0);
  const [voices, setVoices] = useState<Array<{ name: string; lang: string; quality: string; humanized: boolean; isIndian: boolean; isFemale: boolean }>>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [useCustomVoice, setUseCustomVoice] = useState(false);

  useEffect(() => {
    import("@/lib/tts").then((tts) => {
      const available = tts.getVoicesForLanguage(voiceLang);
      setVoices(available);
      if (available.length > 0 && !selectedVoice) {
        const neural = available.find((v) => v.quality === "neural");
        setSelectedVoice(neural?.name || available[0].name);
      }
    });
  }, [voiceLang]);

  const langInfo = INDIAN_LANGUAGES.find((l) => l.code === voiceLang);

  const testVoice = () => {
    import("@/lib/tts").then((tts) => {
      const testTexts: Record<Lang, string> = {
        en: "Hello, this is a test announcement. Five hundred rupees credited from Amazon.",
        hi: "नमस्ते, यह एक परीक्षण घोषणा है। पाँच सौ रुपये अमेज़न से जमा हो गए।",
        ta: "வணக்கம், இது ஒரு சோதனை அறிவிப்பு. ஐநூறு ரூபாய் அமேசான் இலிருந்து வரவு வைக்கப்பட்டது.",
        te: "నమస్తే, ఇది ఒక పరీక్ష ప్రకటన. ఐదు వందల రూపాయలు అమెజాన్ నుండి జమ అయింది.",
        bn: "নমস্কার, এটি একটি পরীক্ষামূলক ঘোষণা। পাঁচশো টাকা অ্যামাজন থেকে জমা হয়েছে।",
        mr: "नमस्कार, ही एक चाचणी घोषणा आहे. पाचशे रुपये ॲमॅझॉन कडून जमा झाले.",
        gu: "નમસ્તે, આ એક પરીક્ષણ જાહેરાત છે. પાંચસો રૂપિયા એમેઝોન માંથી જમા થયા.",
        kn: "ನಮಸ್ಕಾರ, ಇದು ಪರೀಕ್ಷಾ ಘೋಷಣೆ. ಐದು ನೂರು ರೂಪಾಯಿ ಅಮೆಜಾನ್ ನಿಂದ ಜಮೆಯಾಗಿದೆ.",
        ml: "നമസ്കാരം, ഇതൊരു പരീക്ഷണ പ്രഖ്യാപനമാണ്. അഞ്ഞൂറ് രൂപ ആമസോണിൽ നിന്ന് വരവ് വെച്ചു.",
        pa: "ਨਮਸਕਾਰ, ਇਹ ਇੱਕ ਟੈਸਟ ਘੋਸ਼ਣਾ ਹੈ. ਪੰਜ ਸੌ ਰੁਪਏ ਐਮਾਜ਼ਾਨ ਤੋਂ ਜਮਾ ਹੋਏ.",
      };
      tts.speak(
        testTexts[voiceLang] ?? testTexts.en,
        { lang: voiceLang, rate, pitch, voiceName: useCustomVoice ? selectedVoice : undefined }
      );
    });
  };

  const humanizedCount = voices.filter((v) => v.humanized).length;

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Voice Options
        </p>
        {langInfo && (
          <span className="text-[9px] text-muted-foreground">
            {langInfo.flag} {langInfo.nativeLabel}
          </span>
        )}
      </div>

      {/* Voice availability info */}
      {voices.length === 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[10px] text-amber-700 dark:text-amber-300">
          No {langInfo?.label} voices found on this device. Install Indian language voices from your OS settings for the best experience. Will use English fallback.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {voices.length} voice{voices.length > 1 ? "s" : ""}
          </span>
          {humanizedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0 text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              {humanizedCount} humanized
            </span>
          )}
        </div>
      )}

      {/* Custom voice toggle (optional) */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] text-muted-foreground">Use custom voice</label>
        <Switch checked={useCustomVoice} onCheckedChange={setUseCustomVoice} />
      </div>

      {/* Voice selector — only shown when custom voice enabled */}
      {useCustomVoice && voices.length > 0 && (
        <div className="space-y-1.5 animate-fade-in">
          <label className="text-[11px] text-muted-foreground">Select Voice</label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map((v) => (
                <SelectItem key={v.name} value={v.name} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    {v.quality === "neural" && <span title="Neural (best)">✨</span>}
                    {v.quality === "enhanced" && <span title="Enhanced">⭐</span>}
                    {v.isIndian && <span title="Indian">🇮🇳</span>}
                    {v.isFemale ? "♀" : "♂"} {v.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[9px] text-muted-foreground">
            ✨ = Neural (best quality) · ⭐ = Enhanced · 🇮🇳 = Indian voice · ♀/♂ = Gender
          </p>
        </div>
      )}

      {/* Rate slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Speed</span>
          <span className="tabular-nums font-medium">{rate.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={rate}
          onChange={(e) => setRate(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Pitch slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Pitch</span>
          <span className="tabular-nums font-medium">{pitch.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.1}
          value={pitch}
          onChange={(e) => setPitch(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Test button */}
      <Button variant="outline" size="sm" onClick={testVoice} className="w-full gap-1.5 text-xs">
        <Volume2 className="h-3.5 w-3.5" />
        Test Voice
      </Button>

      <p className="text-[9px] text-muted-foreground">
        Voice fires only when a new transaction SMS is parsed — not when visiting the app.
      </p>
    </div>
  );
}

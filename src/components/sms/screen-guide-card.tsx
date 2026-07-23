"use client";

import { useState, useEffect } from "react";
import { HelpCircle, X, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ScreenGuideInfo {
  viewKey: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
}

export const SCREEN_GUIDES: Record<string, ScreenGuideInfo> = {
  dashboard: {
    viewKey: "dashboard",
    title: "Financial Dashboard",
    subtitle: "What does this screen do?",
    description: "Provides an instant real-time overview of your income, expenses, net balance, recent SMS messages, and active loan commitments.",
    features: [
      "View monthly spending & income breakdown",
      "Click any recent message in the feed to open its thread",
      "Track upcoming loan EMI obligations at a glance"
    ]
  },
  inbox: {
    viewKey: "inbox",
    title: "SMS Inbox & Messaging",
    subtitle: "What does this screen do?",
    description: "Organizes bank, UPI, and NBFC SMS into clean conversation threads with automatic transaction extraction and OTP security.",
    features: [
      "1-tap 'Copy Code' for 6-digit OTPs with Passkey protection",
      "Search message history by sender or keywords",
      "Send custom replies or use Bank SMS preset templates"
    ]
  },
  transactions: {
    viewKey: "transactions",
    title: "Transaction Ledger",
    subtitle: "What does this screen do?",
    description: "A complete searchable history of all debits and credits extracted from your bank messages.",
    features: [
      "Filter by period, credit/debit type, or bank category",
      "Click any transaction to hear voice announcements in your language",
      "Export your data anytime as CSV or PDF statements"
    ]
  },
  analytics: {
    viewKey: "analytics",
    title: "Spending Analytics",
    subtitle: "What does this screen do?",
    description: "Visualizes your financial habits with category distribution, monthly trends, and cashflow charts.",
    features: [
      "Spot top spending merchants and bank categories",
      "Monitor income vs expense ratios over time",
      "Identify subscription costs and recurring outflows"
    ]
  },
  loans: {
    viewKey: "loans",
    title: "Loans & EMI Tracker",
    subtitle: "What does this screen do?",
    description: "Tracks active loans, credit card EMIs, and recurring debt payments automatically from SMS alerts.",
    features: [
      "Auto-detects due dates, lender names, and EMI amounts",
      "Calculates total remaining balance and payoff dates",
      "Mark EMIs paid or log manual repayments"
    ]
  },
  recurring: {
    viewKey: "recurring",
    title: "Recurring Payments & Subscriptions",
    subtitle: "What does this screen do?",
    description: "Identifies repeating monthly bills (SIPs, utilities, OTT, broadband) so you never miss a payment.",
    features: [
      "Auto-detects recurring payment patterns from SMS",
      "Tracks expected payment dates and bill amounts",
      "Alerts you to unexpected price increases"
    ]
  },
  security: {
    viewKey: "security",
    title: "Security & Scam Protection",
    subtitle: "What does this screen do?",
    description: "Monitors incoming messages for fraudulent links, phishing attempts, and unauthorized transaction alerts.",
    features: [
      "Classifies messages into Verified, Unverified, and Flagged",
      "Redacts sensitive OTP codes behind biometric/Passkey lock",
      "Displays risk indicators and suspicious URL warnings"
    ]
  },
  documents: {
    viewKey: "documents",
    title: "Encrypted Document Vault",
    subtitle: "What does this screen do?",
    description: "Stores confidential bank statements, loan sanction letters, and financial agreements securely on your device.",
    features: [
      "100% local AES-GCM encrypted document storage",
      "Auto-reconciles bank statements against SMS transactions",
      "Requires Passkey or biometric authorization to reveal"
    ]
  },
  intelligence: {
    viewKey: "intelligence",
    title: "AI Financial Assistant",
    subtitle: "What does this screen do?",
    description: "Ask questions about your finances in plain English or Indian languages using local on-device RAG intelligence.",
    features: [
      "Query spending history e.g., 'How much did I spend on food this month?'",
      "Voice response synthesis with multi-language support",
      "Zero internet connection required — 100% private"
    ]
  }
};

export function ScreenGuideCard({ viewKey }: { viewKey: string }) {
  const guide = SCREEN_GUIDES[viewKey];
  const storageKey = `aegis_guide_dismissed_${viewKey}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const checkState = () => {
      const isDismissed = localStorage.getItem(storageKey) === "true";
      setDismissed(isDismissed);
    };
    checkState();
    window.addEventListener("storage", checkState);
    window.addEventListener("aegis_guide_update", checkState);
    return () => {
      window.removeEventListener("storage", checkState);
      window.removeEventListener("aegis_guide_update", checkState);
    };
  }, [storageKey]);

  if (!guide || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 shadow-sm animate-fade-up">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Dismiss guide"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {guide.subtitle}
            </span>
          </div>
          <h3 className="text-base font-bold text-foreground">{guide.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{guide.description}</p>

          <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
            {guide.features.map((f, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[11px] font-medium text-foreground/90">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-primary/10 pt-2.5">
            <span className="text-[10px] text-muted-foreground">
              💡 First-time exploration guide • Dismisses automatically when clicked.
            </span>
            <Button size="sm" variant="default" onClick={handleDismiss} className="h-7 px-3 text-xs gap-1">
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScreenHelpButton({ viewKey }: { viewKey: string }) {
  const guide = SCREEN_GUIDES[viewKey];
  if (!guide) return null;

  const handleToggle = () => {
    const storageKey = `aegis_guide_dismissed_${viewKey}`;
    const currentlyDismissed = localStorage.getItem(storageKey) === "true";
    if (currentlyDismissed) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, "true");
    }
    window.dispatchEvent(new Event("aegis_guide_update"));
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      title={`What does ${guide.title} do?`}
    >
      <HelpCircle className="h-4 w-4 text-primary" />
      <span className="hidden sm:inline">Guide</span>
    </Button>
  );
}

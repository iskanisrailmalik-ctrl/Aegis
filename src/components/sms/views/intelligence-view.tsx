"use client";

import { IntelligenceSection } from "../intelligence-section";
import type { Lang } from "@/lib/i18n";
import { Brain } from "lucide-react";
import { ScreenGuideCard } from "../screen-guide-card";

export function IntelligenceView({
  voiceLang,
  muted,
}: {
  voiceLang: Lang;
  muted: boolean;
}) {
  return (
    <div className="space-y-4">
      <ScreenGuideCard viewKey="intelligence" />
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Brain className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Ask AI</h2>
          <p className="text-xs text-muted-foreground">
            Query your transactions and messages in natural language.
          </p>
        </div>
      </div>
      <IntelligenceSection voiceLang={voiceLang} muted={muted} />
    </div>
  );
}

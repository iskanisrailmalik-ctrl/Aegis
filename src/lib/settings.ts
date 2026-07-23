/**
 * Settings helper — backed by the Setting table (key/value rows).
 * Defaults are applied when no row exists.
 */

import { db } from "@/lib/db";
import type { Lang } from "@/lib/i18n";

export interface AppSettings {
  uiLanguage: Lang;
  voiceLanguage: Lang;
  muted: boolean;
  theme: "light" | "dark" | "system";
  period: "day" | "week" | "month" | "all";
}

export const DEFAULT_SETTINGS: AppSettings = {
  uiLanguage: "en",
  voiceLanguage: "en",
  muted: false,
  theme: "system",
  period: "month",
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    uiLanguage: (map.uiLanguage as Lang) || DEFAULT_SETTINGS.uiLanguage,
    voiceLanguage: (map.voiceLanguage as Lang) || DEFAULT_SETTINGS.voiceLanguage,
    muted: map.muted === "true",
    theme: (map.theme as AppSettings["theme"]) || DEFAULT_SETTINGS.theme,
    period: (map.period as AppSettings["period"]) || DEFAULT_SETTINGS.period,
  };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await getSettings();
  const merged: AppSettings = { ...cur, ...patch };
  const entries: [string, string][] = [
    ["uiLanguage", merged.uiLanguage],
    ["voiceLanguage", merged.voiceLanguage],
    ["muted", String(merged.muted)],
    ["theme", merged.theme],
    ["period", merged.period],
  ];
  for (const [k, v] of entries) {
    await db.setting.upsert({
      where: { key: k },
      update: { value: v },
      create: { key: k, value: v },
    });
  }
  return merged;
}

/**
 * Safe local storage getter with error protection against quota/privacy errors.
 */
export function safeLocalStorageGet(key: string, fallback: string | null = null): string | null {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (e) {
    console.warn(`[Aegis Storage] Failed to read key "${key}":`, e);
    return fallback;
  }
}

/**
 * Safe local storage setter with error protection against QuotaExceededError.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error(`[Aegis Storage] Failed to write key "${key}":`, e);
    return false;
  }
}

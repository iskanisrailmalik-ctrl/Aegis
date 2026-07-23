/**
 * Aegis Feature Flags — Phase E Dual-Track Release Strategy
 *
 * Detects which "track" the app is running on:
 * - WEB_TRACK: PWA/web mode (manual paste/forward, no native SMS reading)
 * - NATIVE_TRACK: Android native app (auto SMS reading, default SMS app)
 *
 * The track is determined by the presence of the Capacitor native bridge.
 * In web mode, all native features gracefully degrade to manual alternatives.
 *
 * This allows a single codebase to serve both:
 * 1. Play Store web app (compliant, manual paste)
 * 2. Sideloaded APK (full native SMS reading)
 *
 * Usage:
 *   import { isNativeTrack, getTrackName, FEATURES } from "@/lib/feature-flags";
 *   if (FEATURES.autoSmsReading) { ... }
 */

export type AegisTrack = "web" | "native";

/**
 * Detect the current app track.
 * - "native" if Capacitor bridge is available (Android app)
 * - "web" if running in a browser/PWA
 */
export function getTrack(): AegisTrack {
  if (typeof window === "undefined") return "web";
  const capacitor = (window as any).Capacitor;
  // Capacitor.isNative is the official way to detect native platform
  if (capacitor?.isNativePlatform?.()) return "native";
  // Fallback: check for the AegisNative plugin
  if (capacitor?.Plugins?.AegisNative) return "native";
  if ((window as any).AegisNative) return "native";
  return "web";
}

/**
 * Check if running on native track (Android app).
 */
export function isNativeTrack(): boolean {
  return getTrack() === "native";
}

/**
 * Check if running on web track (browser/PWA).
 */
export function isWebTrack(): boolean {
  return getTrack() === "web";
}

/**
 * Get human-readable track name for display.
 */
export function getTrackName(): string {
  return isNativeTrack() ? "Aegis Android App" : "Aegis Web App";
}

/**
 * Feature flags — derived from the current track.
 * Each flag indicates whether a feature is available.
 */
export const FEATURES = {
  /** Auto-read incoming SMS (requires default SMS app role) */
  autoSmsReading: isNativeTrack(),

  /** Bulk import SMS history from device */
  bulkSmsImport: isNativeTrack(),

  /** Compose/reply via external intents (ACTION_SENDTO) */
  composeIntents: isNativeTrack(),

  /** FLAG_SECURE screenshot protection */
  screenshotProtection: isNativeTrack(),

  /** System notifications for incoming SMS */
  systemNotifications: isNativeTrack(),

  /** Quick-reply from notifications */
  quickReply: isNativeTrack(),

  /** Biometric authentication (Web Auth API works on both, but native is more reliable) */
  biometricAuth: typeof window !== "undefined" && "PublicKeyCredential" in window,

  /** Voice announcements (Web Speech API — works on both tracks) */
  voiceAnnouncements: typeof window !== "undefined" && "speechSynthesis" in window,

  /** Offline mode (PWA service worker or native WebView cache) */
  offlineMode: true,

  /** Manual paste/forward SMS (always available — fallback for web track) */
  manualPaste: true,

  /** Document vault with encryption (Web Crypto API — works on both) */
  documentVault: typeof window !== "undefined" && !!window.crypto?.subtle,

  /** OTP detection and blur (works on both — pure JS) */
  otpDetection: true,

  /** Set as default SMS app (native only — requires RoleManager) */
  defaultSmsApp: isNativeTrack(),
} as const;

export type FeatureFlags = typeof FEATURES;

/**
 * Get a description of what's available on the current track.
 * Used in Settings → About to show the user what features they have.
 */
export function getTrackCapabilities(): Array<{ feature: string; available: boolean; description: string }> {
  return [
    {
      feature: "Auto SMS Reading",
      available: FEATURES.autoSmsReading,
      description: FEATURES.autoSmsReading
        ? "SMS are automatically parsed as they arrive"
        : "Manual paste/forward required",
    },
    {
      feature: "Bulk SMS Import",
      available: FEATURES.bulkSmsImport,
      description: FEATURES.bulkSmsImport
        ? "Import all existing SMS from device"
        : "Not available in web mode",
    },
    {
      feature: "Screenshot Protection",
      available: FEATURES.screenshotProtection,
      description: FEATURES.screenshotProtection
        ? "FLAG_SECURE blocks screenshots on OTP screens"
        : "Not available in web mode",
    },
    {
      feature: "System Notifications",
      available: FEATURES.systemNotifications,
      description: FEATURES.systemNotifications
        ? "Native notifications with OTP blur"
        : "In-app toasts only",
    },
    {
      feature: "Biometric Auth",
      available: FEATURES.biometricAuth,
      description: FEATURES.biometricAuth
        ? "Fingerprint/Face ID available"
        : "PIN-only authentication",
    },
    {
      feature: "Voice Announcements",
      available: FEATURES.voiceAnnouncements,
      description: FEATURES.voiceAnnouncements
        ? "10 Indian languages supported"
        : "Not available",
    },
    {
      feature: "Offline Mode",
      available: FEATURES.offlineMode,
      description: "Fully functional without internet",
    },
    {
      feature: "Document Vault",
      available: FEATURES.documentVault,
      description: "AES-GCM encrypted document storage",
    },
    {
      feature: "OTP Detection",
      available: FEATURES.otpDetection,
      description: "Auto-blur OTPs with biometric reveal",
    },
  ];
}

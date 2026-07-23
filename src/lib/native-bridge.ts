/**
 * Aegis Native Bridge Interface.
 *
 * This module provides the JavaScript API that connects to the native Android
 * (Capacitor) layer when Aegis is running as the default SMS app.
 *
 * When the native bridge is NOT available (web/PWA mode), all methods return
 * null/false and the app falls back to manual paste/forward.
 *
 * The native Capacitor plugin (AegisSmsPlugin.kt) is registered with the name
 * "AegisNative" and is accessed via:
 *   - Capacitor.Plugins.AegisNative (Capacitor 5+)
 *   - window.AegisNative (fallback / direct injection)
 *
 * This interface is used by:
 * - Settings → "Default SMS App" card (check status, request role)
 * - Inbox auto-import (bulk SMS history import)
 * - Real-time SMS listener (new SMS arrives → parser pipeline)
 */

export interface SmsReceivedEvent {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  date: string; // ISO string
}

export interface ImportedSms {
  total: number;
  imported: number;
  skipped: number;
}

export interface DefaultSmsAppStatus {
  isDefaultSmsApp: boolean;
  isCapacitorAvailable: boolean;
  canRequestRole: boolean;
}

/**
 * Get the Capacitor plugin instance.
 * Returns null if Capacitor is not available (web mode).
 */
function getNativePlugin(): any | null {
  if (typeof window === "undefined") return null;

  // Capacitor 5+ — plugins are on window.Capacitor.Plugins
  const capacitor = (window as any).Capacitor;
  if (capacitor?.Plugins?.AegisNative) {
    return capacitor.Plugins.AegisNative;
  }

  // Fallback: direct injection (for testing or non-Capacitor shells)
  if ((window as any).AegisNative) {
    return (window as any).AegisNative;
  }

  return null;
}

/**
 * Check if the native Capacitor bridge is available.
 * Returns false in web/PWA mode.
 */
export function isNativeBridgeAvailable(): boolean {
  return getNativePlugin() !== null;
}

/**
 * Check if Aegis is set as the default SMS app.
 * Returns false in web/PWA mode.
 */
export async function isDefaultSmsApp(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.isDefaultSmsApp();
    return result?.value === true;
  } catch {
    return false;
  }
}

/**
 * Get the full default SMS app status.
 */
export async function getDefaultSmsAppStatus(): Promise<DefaultSmsAppStatus> {
  const capacitorAvailable = isNativeBridgeAvailable();
  if (!capacitorAvailable) {
    return {
      isDefaultSmsApp: false,
      isCapacitorAvailable: false,
      canRequestRole: false,
    };
  }
  try {
    const isDefault = await isDefaultSmsApp();
    return {
      isDefaultSmsApp: isDefault,
      isCapacitorAvailable: true,
      canRequestRole: !isDefault,
    };
  } catch {
    return {
      isDefaultSmsApp: false,
      isCapacitorAvailable: true,
      canRequestRole: true,
    };
  }
}

/**
 * Request the user to set Aegis as the default SMS app.
 * Triggers the Android RoleManager.ROLE_SMS system prompt.
 * Returns true if the user granted the role.
 */
export async function requestDefaultSmsRole(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) {
    throw new Error("Native bridge not available — this feature requires the Android app");
  }
  try {
    const result = await plugin.requestDefaultSmsRole();
    return result?.value === true;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Failed to request default SMS role");
  }
}

/**
 * Import all existing SMS from the device's SMS content provider.
 * This is a bulk operation — should only be called once during onboarding
 * or when the user explicitly requests it.
 *
 * Returns the count of imported/skipped messages.
 */
export async function importExistingSms(): Promise<ImportedSms> {
  const plugin = getNativePlugin();
  if (!plugin) {
    throw new Error("Native bridge not available — this feature requires the Android app");
  }
  try {
    const result = await plugin.importExistingSms();
    return {
      total: result?.total ?? 0,
      imported: result?.imported ?? 0,
      skipped: result?.skipped ?? 0,
    };
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Failed to import SMS");
  }
}

/**
 * Register a callback for real-time SMS received events.
 * The native layer calls this callback whenever a new SMS arrives
 * (via SMS_DELIVER BroadcastReceiver when Aegis is the default SMS app).
 *
 * The callback receives the raw SMS data which should be fed into
 * the existing parseSms → detectScam → categorize pipeline.
 *
 * Returns an unsubscribe function.
 */
export function onSmsReceived(callback: (event: SmsReceivedEvent) => void): () => void {
  const plugin = getNativePlugin();
  if (!plugin) {
    // In web mode, no real SMS will arrive — return no-op unsubscribe
    return () => {};
  }

  // Capacitor plugin event listener
  const listener = plugin.addListener?.("smsReceived", (event: SmsReceivedEvent) => {
    callback(event);
  });

  // Return unsubscribe function
  return () => {
    listener?.remove?.();
  };
}

/**
 * Register a callback for compose intent events.
 * Triggered when an external app sends an ACTION_SENDTO intent
 * (e.g., user taps "Share via SMS" in Contacts).
 */
export function onComposeIntent(
  callback: (event: { recipient: string | null; body: string | null }) => void
): () => void {
  const plugin = getNativePlugin();
  if (!plugin) {
    return () => {};
  }

  const listener = plugin.addListener?.("composeIntent", (event: { recipient: string | null; body: string | null }) => {
    callback(event);
  });

  return () => {
    listener?.remove?.();
  };
}

/**
 * Enable or disable FLAG_SECURE on the native Activity window.
 *
 * When enabled (Android native app only):
 * - Screenshots are blocked (content shows as black)
 * - Screen recording is blocked
 * - App switcher preview is hidden
 *
 * In web mode, this is a no-op (web cannot prevent screenshots).
 *
 * Phase D security feature — called when showing OTP reveal screens or vault content.
 *
 * @param secure true to enable screenshot protection, false to disable
 */
export async function setSecureScreen(secure: boolean): Promise<void> {
  const plugin = getNativePlugin();
  if (!plugin) return;
  try {
    await plugin.setSecureScreen({ secure });
  } catch {
    // Silently fail in web mode
  }
}

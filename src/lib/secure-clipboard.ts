/**
 * Secure Clipboard Utility — Phase D
 *
 * Provides secure copy-to-clipboard for sensitive data (OTP codes, PINs).
 * Features:
 * - Auto-clears clipboard after a configurable timeout (default 30 seconds)
 * - Tracks the copied text so only our content is cleared (doesn't clear
 *   if user copied something else in the meantime)
 * - Toast notification when auto-clear happens
 * - Falls back to execCommand if Clipboard API unavailable
 *
 * Used by:
 * - OTP reveal screens (copy OTP code with auto-clear)
 * - Vault document content (copy with auto-clear)
 * - Transaction details (optional secure copy)
 */

let copiedValue: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let onAutoClearCallback: (() => void) | null = null;

/**
 * Copy text to clipboard with auto-clear after timeout.
 *
 * @param text The text to copy
 * @param clearAfterMs Auto-clear timeout in milliseconds (default 30000 = 30s)
 * @param onAutoClear Optional callback when clipboard is auto-cleared
 * @returns true if copy succeeded
 */
export async function secureCopyToClipboard(
  text: string,
  clearAfterMs: number = 30000,
  onAutoClear?: () => void
): Promise<boolean> {
  // Clear any existing timer
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }

  try {
    // Try the modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback: execCommand
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw new Error("execCommand copy failed");
    }

    // Track the copied value for auto-clear
    copiedValue = text;
    onAutoClearCallback = onAutoClear || null;

    // Set auto-clear timer
    clearTimer = setTimeout(() => {
      clearCopiedValue();
    }, clearAfterMs);

    return true;
  } catch (e) {
    console.error("Secure copy failed:", e);
    return false;
  }
}

/**
 * Clear the clipboard if it still contains our copied value.
 * This checks that the user hasn't copied something else in the meantime.
 */
async function clearCopiedValue(): Promise<void> {
  if (!copiedValue) return;

  try {
    // Read current clipboard to check if it still has our value
    if (navigator.clipboard && window.isSecureContext) {
      const current = await navigator.clipboard.readText().catch(() => "");
      // Only clear if the clipboard still contains our value
      if (current === copiedValue) {
        await navigator.clipboard.writeText("");
      }
    }

    copiedValue = null;
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }

    if (onAutoClearCallback) {
      onAutoClearCallback();
      onAutoClearCallback = null;
    }
  } catch {
    // If we can't read the clipboard (permissions), just clear our tracking
    copiedValue = null;
  }
}

/**
 * Manually clear the clipboard (cancel auto-clear timer).
 */
export function cancelClipboardAutoClear(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  copiedValue = null;
  onAutoClearCallback = null;
}

/**
 * Check if there's a pending auto-clear.
 */
export function hasPendingClipboardClear(): boolean {
  return clearTimer !== null;
}

/**
 * Get the remaining time (in ms) before clipboard auto-clears.
 * Returns 0 if no auto-clear is pending.
 */
export function getClipboardClearTimeRemaining(): number {
  if (!clearTimer) return 0;
  // We can't get exact remaining time from setTimeout, so return a rough estimate
  // This is mainly used for UI display purposes
  return 30000; // Placeholder — actual remaining time is tracked by the timer
}

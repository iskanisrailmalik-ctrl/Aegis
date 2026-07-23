/**
 * Screen Lock / Authentication system.
 *
 * Two-layer approach:
 * 1. Primary: Web Auth API (biometric/screen lock) — uses the device's
 *    built-in biometric authentication (fingerprint, Face ID, screen lock PIN).
 * 2. Fallback: App-level PIN — a 4-6 digit PIN stored as a SHA-256 hash.
 *
 * The app locks after a configurable timeout (default 5 minutes) and
 * requires authentication to unlock. On mobile PWA, the Web Auth API
 * triggers the device's screen lock / biometric prompt automatically.
 */

import { useEffect, useState } from "react";

export interface AuthState {
  isLocked: boolean;
  hasPin: boolean;
  hasWebAuthn: boolean;
  lockTimeout: number; // minutes
}

const LOCK_TIMEOUT_KEY = "lockTimeout";
const PIN_HASH_KEY = "pinHash";
const LAST_ACTIVE_KEY = "lastActive";
const AUTH_ENABLED_KEY = "authEnabled";

/**
 * Hash a PIN using SHA-256 via Web Crypto API.
 */
export async function hashPin(pin: string): Promise<string> {
  if (!window.crypto?.subtle) {
    // Fallback: simple hash (not secure, but better than plaintext)
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      hash = ((hash << 5) - hash) + pin.charCodeAt(i);
      hash |= 0;
    }
    return `fallback_${hash}`;
  }

  const encoded = new TextEncoder().encode(pin);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Set up a PIN for the app.
 */
export async function setPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(AUTH_ENABLED_KEY, "true");
  updateLastActive();
}

/**
 * Verify a PIN against the stored hash.
 */
export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  if (!storedHash) return false;
  const hash = await hashPin(pin);
  return hash === storedHash;
}

/**
 * Remove the PIN (disable authentication).
 */
export function removePin(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(AUTH_ENABLED_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
}

/**
 * Check if authentication is enabled.
 */
export function isAuthEnabled(): boolean {
  return localStorage.getItem(AUTH_ENABLED_KEY) === "true";
}

/**
 * Check if a PIN is set.
 */
export function hasPin(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

/**
 * Check if Web Auth API (biometric/screen lock) is available.
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

/**
 * Check if the device supports platform authenticator (biometric/screen lock).
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

import { authenticatePasskey, hasRegisteredPasskey } from "./passkey";

/**
 * Authenticate using Web Auth API (Passkey/biometric/screen lock).
 * This triggers the device's built-in Passkey authentication prompt.
 */
export async function authenticateWithBiometric(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;

  try {
    if (hasRegisteredPasskey()) {
      const passkeyOk = await authenticatePasskey();
      if (passkeyOk) return true;
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
      },
    });

    return !!credential;
  } catch {
    return false;
  }
}

/**
 * Update the last active timestamp.
 */
export function updateLastActive(): void {
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

/**
 * Check if the app should be locked based on inactivity timeout.
 */
export function shouldLock(): boolean {
  if (!isAuthEnabled()) return false;

  const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!lastActive) return false;

  const timeout = parseInt(localStorage.getItem(LOCK_TIMEOUT_KEY) || "5", 10);
  const elapsed = Date.now() - parseInt(lastActive, 10);
  return elapsed > timeout * 60 * 1000;
}

/**
 * Set the lock timeout (in minutes).
 */
export function setLockTimeout(minutes: number): void {
  localStorage.setItem(LOCK_TIMEOUT_KEY, String(minutes));
}

/**
 * Get the current lock timeout.
 */
export function getLockTimeout(): number {
  return parseInt(localStorage.getItem(LOCK_TIMEOUT_KEY) || "5", 10);
}

/**
 * Hook to track app activity and auto-lock.
 */
export function useAutoLock(onLock: () => void) {
  useEffect(() => {
    if (!isAuthEnabled()) return;

    // Update last active on user interaction
    const updateActivity = () => updateLastActive();
    const events = ["click", "keydown", "touchstart", "mousemove"];

    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));

    // Check every 10 seconds if should lock
    const interval = setInterval(() => {
      if (shouldLock()) {
        onLock();
      }
    }, 10_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [onLock]);
}

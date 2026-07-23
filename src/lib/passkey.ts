/**
 * WebAuthn Passkey (FIDO2) Security System.
 * Supports hardware-backed Passkey registration and authentication
 * via Touch ID, Face ID, Windows Hello, Android Biometrics, or Security Keys.
 */

export interface PasskeyMeta {
  id: string;
  rawId: string;
  displayName: string;
  createdAt: string;
}

const PASSKEYS_STORAGE_KEY = "aegis_passkeys";

/**
 * Check if WebAuthn Passkey API is supported by the browser/environment.
 */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

/**
 * Check if a platform authenticator (fingerprint, Face ID, Windows Hello) is available.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Get all registered Passkeys stored locally.
 */
export function getRegisteredPasskeys(): PasskeyMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PASSKEYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Check if at least one Passkey is registered.
 */
export function hasRegisteredPasskey(): boolean {
  return getRegisteredPasskeys().length > 0;
}

/**
 * Register a new Passkey using navigator.credentials.create().
 */
export async function registerPasskey(displayName = "Aegis Secure Passkey"): Promise<PasskeyMeta | null> {
  if (!isPasskeySupported()) {
    throw new Error("WebAuthn Passkeys are not supported on this browser.");
  }

  // Generate random 32-byte challenge & user ID
  const challenge = new Uint8Array(32);
  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(challenge);
  window.crypto.getRandomValues(userId);

  const creationOptions: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: "Aegis Personal Finance",
        id: typeof window !== "undefined" ? window.location.hostname : "aegis.app",
      },
      user: {
        id: userId,
        name: "user@aegis.local",
        displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },  // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  };

  try {
    const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential | null;
    if (!credential) return null;

    const passkeyMeta: PasskeyMeta = {
      id: credential.id,
      rawId: Array.from(new Uint8Array(credential.rawId))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      displayName,
      createdAt: new Date().toISOString(),
    };

    const existing = getRegisteredPasskeys();
    const updated = [...existing.filter((p) => p.id !== passkeyMeta.id), passkeyMeta];
    localStorage.setItem(PASSKEYS_STORAGE_KEY, JSON.stringify(updated));

    return passkeyMeta;
  } catch (err) {
    if (err instanceof Error && err.name === "NotAllowedError") {
      throw new Error("Passkey registration was cancelled or timed out.");
    }
    throw err;
  }
}

/**
 * Authenticate using a registered Passkey via navigator.credentials.get().
 */
export async function authenticatePasskey(): Promise<boolean> {
  if (!isPasskeySupported()) return false;

  const passkeys = getRegisteredPasskeys();
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const allowCredentials = passkeys.map((p) => ({
    id: Uint8Array.from(p.rawId.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []),
    type: "public-key" as const,
  }));

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: "required",
      ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
    },
  };

  try {
    const credential = await navigator.credentials.get(getOptions);
    return !!credential;
  } catch {
    return false;
  }
}

/**
 * Remove a registered Passkey by ID.
 */
export function removePasskey(id: string): void {
  const existing = getRegisteredPasskeys();
  const updated = existing.filter((p) => p.id !== id);
  localStorage.setItem(PASSKEYS_STORAGE_KEY, JSON.stringify(updated));
}

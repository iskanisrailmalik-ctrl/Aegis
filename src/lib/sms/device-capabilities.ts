/**
 * Mobile device capability detection (Spec Section 5.4, 6, 8.3, 8.6).
 *
 * Detects what the device supports and enables advanced features when available.
 * On web: uses Web APIs (Web Crypto, MediaDevices, Service Worker).
 * On mobile (PWA installed): same Web APIs + potential native bridge.
 *
 * Features gated by capabilities:
 * - Document encryption: Web Crypto API (SubtleCrypto)
 * - OCR: Tesseract.js (loaded on-demand, ~2MB)
 * - Neural TTS: Browser SpeechSynthesis voices (enhanced/neural detection)
 * - Background sync: Service Worker sync registration
 * - Push notifications: Notification API + PushManager
 */

export interface DeviceCapabilities {
  crypto: boolean; // Web Crypto API for encryption
  ocr: boolean; // Tesseract.js can be loaded
  tts: boolean; // SpeechSynthesis available
  ttsVoices: TtsVoiceInfo[]; // Available voices with quality tier
  neuralTts: boolean; // At least one neural/enhanced voice
  backgroundSync: boolean; // Service Worker background sync
  pushNotifications: boolean; // Push API
  installPrompt: boolean; // PWA installable
  isStandalone: boolean; // Running as installed PWA
  isMobile: boolean; // Mobile device detection
  platform: "android" | "ios" | "desktop" | "unknown";
}

export interface TtsVoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  quality: "neural" | "enhanced" | "standard";
}

// Neural/enhanced voice name patterns (by browser/platform)
const NEURAL_VOICE_PATTERNS = [
  /google/i,
  /neural/i,
  /enhanced/i,
  /premium/i,
  /natural/i,
  /wavenet/i,
];

const ENHANCED_VOICE_PATTERNS = [
  /samantha/i, // iOS enhanced
  /alex/i, // macOS enhanced
  /daniel/i, // UK enhanced
];

function detectVoiceQuality(voice: SpeechSynthesisVoice): TtsVoiceInfo["quality"] {
  const name = voice.name;
  if (NEURAL_VOICE_PATTERNS.some((p) => p.test(name))) return "neural";
  if (ENHANCED_VOICE_PATTERNS.some((p) => p.test(name))) return "enhanced";
  return "standard";
}

function detectPlatform(): DeviceCapabilities["platform"] {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/mobile/.test(ua)) return "android"; // generic mobile
  return "desktop";
}

function detectIsMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function detectIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // PWA standalone mode detection
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari standalone
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Detect all device capabilities. Called once on app init.
 * Voice list is async (loads after voiceschanged event).
 */
export function detectCapabilities(): DeviceCapabilities {
  const crypto = typeof window !== "undefined" && !!window.crypto?.subtle;
  const tts = typeof window !== "undefined" && "speechSynthesis" in window;

  // Get voice list (may be empty on first call, fills after voiceschanged)
  let ttsVoices: TtsVoiceInfo[] = [];
  let neuralTts = false;
  if (tts) {
    const voices = window.speechSynthesis.getVoices();
    ttsVoices = voices.map((v) => ({
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      quality: detectVoiceQuality(v),
    }));
    neuralTts = ttsVoices.some((v) => v.quality === "neural");
  }

  // Background sync requires service worker
  const backgroundSync =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window;

  // Push notifications
  const pushNotifications =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "PushManager" in window;

  // PWA install prompt (beforeinstallprompt fires before we can detect)
  const installPrompt = typeof window !== "undefined" && "BeforeInstallPromptEvent" in window;

  return {
    crypto,
    ocr: true, // Tesseract.js can always be loaded on-demand
    tts,
    ttsVoices,
    neuralTts,
    backgroundSync,
    pushNotifications,
    installPrompt,
    isStandalone: detectIsStandalone(),
    isMobile: detectIsMobile(),
    platform: detectPlatform(),
  };
}

/**
 * Encryption helpers using Web Crypto API (Section 8.6).
 * Encrypts document content at rest with AES-GCM.
 */

const ENCRYPTION_KEY_NAME = "sms-finance-doc-key";

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  if (!window.crypto?.subtle) throw new Error("Web Crypto not available");

  // Try to get existing key from IndexedDB
  const db = await openKeyDB();
  let key = await getKey(db, ENCRYPTION_KEY_NAME);

  if (!key) {
    // Generate new AES-GCM key
    key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
 true,
 ["encrypt", "decrypt"]
    );
    await saveKey(db, ENCRYPTION_KEY_NAME, key);
  }

  return key;
}

async function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sms-finance-crypto", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("keys");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getKey(db: IDBDatabase, name: string): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", "readonly");
    const store = tx.objectStore("keys");
    const req = store.get(name);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveKey(db: IDBDatabase, name: string, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", "readwrite");
    const store = tx.objectStore("keys");
    store.put(key, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Encrypt text using AES-GCM.
 * Returns base64-encoded ciphertext + IV.
 */
export async function encryptText(plaintext: string): Promise<string> {
  if (!window.crypto?.subtle) return plaintext; // Fallback: no encryption

  const key = await getOrCreateEncryptionKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Combine IV + ciphertext and base64-encode
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt text encrypted with encryptText().
 */
export async function decryptText(encrypted: string): Promise<string> {
  if (!window.crypto?.subtle) return encrypted; // Fallback: return as-is

  const key = await getOrCreateEncryptionKey();
  const combined = new Uint8Array(
    atob(encrypted).split("").map((c) => c.charCodeAt(0))
  );
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if a string looks like encrypted content (base64 + long enough).
 */
export function isEncrypted(s: string): boolean {
  return s.length > 50 && /^[A-Za-z0-9+/=]+$/.test(s);
}

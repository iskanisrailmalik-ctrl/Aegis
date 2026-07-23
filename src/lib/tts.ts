/**
 * TTS utility — Web Speech API wrapper.
 * Client-side only. Picks an available voice for the chosen language.
 *
 * Enhanced with:
 * - Multiple Indian language support (hi, ta, te, bn, mr, gu, kn, ml, pa, en-IN)
 * - Humanized voice detection (neural/enhanced/natural voices)
 * - Voice quality scoring and selection
 * - Indian voice preference (prefers Indian-accented voices)
 */

import { voiceLanguageCode, type Lang } from "@/lib/i18n";

let cachedVoices: SpeechSynthesisVoice[] | null = null;

function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Voice quality detection — identifies humanized/neural voices.
 */
export type VoiceQuality = "neural" | "enhanced" | "standard";

export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  quality: VoiceQuality;
  isIndian: boolean;
  isFemale: boolean;
  humanized: boolean; // neural or enhanced = humanized
}

const NEURAL_PATTERNS = [
  /google/i,
  /neural/i,
  /enhanced/i,
  /premium/i,
  /natural/i,
  /wavenet/i,
  /studio/i,
  /multilingual/i,
];

const FEMALE_PATTERNS = [
  /female/i,
  /woman/i,
  /girl/i,
  /samantha/i,
  /victoria/i,
  /karen/i,
  /moira/i,
  /tessa/i,
  /fiona/i,
  /veena/i,
  /raveena/i,
  /sara/i,
  /zira/i,
  /heera/i,
  /kalpana/i,
  /priya/i,
  /asha/i,
];

/**
 * Classify a voice's quality.
 */
function classifyVoice(name: string): VoiceQuality {
  if (NEURAL_PATTERNS.some((p) => p.test(name))) {
    if (/neural|wavenet|studio/i.test(name)) return "neural";
    return "enhanced";
  }
  return "standard";
}

/**
 * Check if a voice is Indian-accented.
 */
function isIndianVoice(lang: string): boolean {
  const lower = lang.toLowerCase();
  return lower.includes("-in") || lower === "hi" || lower === "ta" || lower === "te" ||
    lower === "bn" || lower === "mr" || lower === "gu" || lower === "kn" || lower === "ml" || lower === "pa";
}

/**
 * Check if a voice name suggests a female voice.
 */
function isFemaleVoice(name: string): boolean {
  return FEMALE_PATTERNS.some((p) => p.test(name));
}

/**
 * Get all available voices with quality and metadata.
 */
export function getAvailableVoices(): VoiceInfo[] {
  const voices = getVoices();
  return voices.map((v) => {
    const quality = classifyVoice(v.name);
    return {
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      quality,
      isIndian: isIndianVoice(v.lang),
      isFemale: isFemaleVoice(v.name),
      humanized: quality === "neural" || quality === "enhanced",
    };
  });
}

/**
 * Get voices for a specific language, sorted by quality (neural first).
 */
export function getVoicesForLanguage(lang: Lang): VoiceInfo[] {
  const code = voiceLanguageCode(lang);
  const voices = getAvailableVoices();
  return voices
    .filter((v) => {
      // Match by language prefix (e.g., "hi" matches "hi-IN")
      const langPrefix = code.slice(0, 2).toLowerCase();
      const voicePrefix = v.lang.toLowerCase().slice(0, 2);
      // Also match exact code
      return v.lang.toLowerCase().startsWith(langPrefix) || v.lang.toLowerCase() === code.toLowerCase();
    })
    .sort((a, b) => {
      // Sort: neural > enhanced > standard
      const qualityOrder = { neural: 0, enhanced: 1, standard: 2 };
      return qualityOrder[a.quality] - qualityOrder[b.quality];
    });
}

/**
 * Get all humanized (neural/enhanced) voices across all languages.
 */
export function getHumanizedVoices(): VoiceInfo[] {
  return getAvailableVoices().filter((v) => v.humanized);
}

/**
 * Get all Indian voices (any Indian language).
 */
export function getIndianVoices(): VoiceInfo[] {
  return getAvailableVoices().filter((v) => v.isIndian);
}

/**
 * Pick the best voice for a language.
 * Preference order:
 * 1. Indian neural voice matching the language
 * 2. Any neural voice matching the language
 * 3. Indian voice matching the language
 * 4. Any voice matching the language
 * 5. English (India) voice
 * 6. Any English voice
 */
function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = getVoices();
  if (voices.length === 0) return undefined;
  const code = voiceLanguageCode(lang);
  const langPrefix = code.slice(0, 2).toLowerCase();

  // 1. Indian neural voice matching the language
  let v = voices.find((x) =>
    x.lang.toLowerCase().startsWith(langPrefix) &&
    isIndianVoice(x.lang) &&
    NEURAL_PATTERNS.some((p) => p.test(x.name))
  );
  if (v) return v;

  // 2. Any neural voice matching the language
  v = voices.find((x) =>
    x.lang.toLowerCase().startsWith(langPrefix) &&
    NEURAL_PATTERNS.some((p) => p.test(x.name))
  );
  if (v) return v;

  // 3. Indian voice matching the language
  v = voices.find((x) =>
    x.lang.toLowerCase().startsWith(langPrefix) &&
    isIndianVoice(x.lang)
  );
  if (v) return v;

  // 4. Any voice matching the language
  v = voices.find((x) => x.lang.toLowerCase().startsWith(langPrefix));
  if (v) return v;

  // 5. English (India) voice
  v = voices.find((x) => x.lang.toLowerCase() === "en-in");
  if (v) return v;

  // 6. Any English voice
  return voices.find((x) => x.lang.toLowerCase().startsWith("en"));
}

export interface SpeakOptions {
  lang?: Lang;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  voiceName?: string; // specific voice name
}

/**
 * Speech pre-processor — converts acronyms, masked accounts, and financial symbols
 * into natural fluently-spoken sentences rather than character-by-character spelling.
 */
export function normalizeTextForSpeech(text: string, lang: Lang = "en"): string {
  if (!text) return "";

  let s = text;

  // 1. Expand common financial bank acronyms into spaced pronounceable letters/words
  s = s.replace(/\bHDFC\b/gi, "H D F C Bank");
  s = s.replace(/\bICICI\b/gi, "I C I C I Bank");
  s = s.replace(/\bSBI\b/gi, "S B I");
  s = s.replace(/\bPNB\b/gi, "P N B");
  s = s.replace(/\bBOB\b/gi, "Bank of Baroda");
  s = s.replace(/\bAXIS\b/gi, "Axis Bank");
  s = s.replace(/\bIDFC\b/gi, "I D F C");
  s = s.replace(/\bUPI\b/gi, "U P I");
  s = s.replace(/\bEMI\b/gi, "E M I");
  s = s.replace(/\bOTP\b/gi, "O T P");
  s = s.replace(/\bNEFT\b/gi, "N E F T");
  s = s.replace(/\bIMPS\b/gi, "I M P S");
  s = s.replace(/\bRTGS\b/gi, "R T G S");
  s = s.replace(/\bVPA\b/gi, "virtual payment address");
  s = s.replace(/\bATM\b/gi, "A T M");

  // 2. Expand account masked notations e.g., XX1234, X1234, A/C XX1234
  s = s.replace(/\b(?:A\/C|Acct|Account)?\s*[Xx]{2,}(\d{3,4})\b/gi, (_, digits) => {
    const spacedDigits = digits.split("").join(" ");
    return `account ending in ${spacedDigits}`;
  });

  // 3. Expand currency symbols & prefixes into full words
  s = s.replace(/₹\s*([0-9,.]+)/g, "$1 rupees");
  s = s.replace(/\bRs\.?\s*([0-9,.]+)/gi, "$1 rupees");
  s = s.replace(/\bINR\s*([0-9,.]+)/gi, "$1 rupees");

  // 4. Expand shorthand words
  s = s.replace(/\bA\/C\b/gi, "account");
  s = s.replace(/\bAcct\b/gi, "account");
  s = s.replace(/\bTxn\b/gi, "transaction");
  s = s.replace(/\bRef\b/gi, "reference");
  s = s.replace(/\bAvl Bal\b/gi, "available balance");
  s = s.replace(/\bBal\b/gi, "balance");

  // 5. Clean up awkward punctuation symbols that trigger letter spelling
  s = s.replace(/[/_\\#@|]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!isTtsSupported()) return false;
  const lang = opts.lang ?? "en";
  const code = voiceLanguageCode(lang);
  const normalizedText = normalizeTextForSpeech(text, lang);
  const utter = new SpeechSynthesisUtterance(normalizedText);
  utter.lang = code;
  // Humanized speech: slightly slower, natural pitch
  utter.rate = opts.rate ?? 0.92;
  utter.pitch = opts.pitch ?? 1.0;
  utter.volume = opts.volume ?? 1;

  // Pick voice: specific name > best match for language
  const voices = getVoices();
  let voice: SpeechSynthesisVoice | undefined;

  if (opts.voiceName) {
    voice = voices.find((v) => v.name === opts.voiceName);
  }

  if (!voice) {
    voice = pickVoice(lang);
  }

  if (voice) {
    utter.voice = voice;
    // Use the voice's language if it's more specific
    if (voice.lang) utter.lang = voice.lang;
  }

  if (opts.onEnd) utter.onend = opts.onEnd;
  // cancel any ongoing speech
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}

/**
 * i18n — UI text + voice sentence builder.
 * Supports multiple Indian languages:
 *   - English (en) — en-IN
 *   - Hindi (hi) — hi-IN
 *   - Tamil (ta) — ta-IN
 *   - Telugu (te) — te-IN
 *   - Bengali (bn) — bn-IN
 *   - Marathi (mr) — mr-IN
 *   - Gujarati (gu) — gu-IN
 *   - Kannada (kn) — kn-IN
 *   - Malayalam (ml) — ml-IN
 *   - Punjabi (pa) — pa-IN
 *
 * Voice language can be chosen independently of UI language.
 */

export type Lang = "en" | "hi" | "ta" | "te" | "bn" | "mr" | "gu" | "kn" | "ml" | "pa";

type Dict = Record<string, string>;

const en: Dict = {
  "app.title": "Aegis",
  "app.tagline": "Offline-first. Parses SMS, speaks transactions, flags scams.",
  "app.privacy": "Your SMS never leaves your device.",
  "nav.dashboard": "Dashboard",
  "nav.loans": "Loans & EMIs",
  "nav.security": "Security Alerts",
  "nav.settings": "Settings",
  "action.pasteSms": "Paste SMS",
  "action.addManually": "Add Manually",
  "action.loadSamples": "Load Sample SMS",
  "action.clearAll": "Clear All Data",
  "summary.credited": "Credited",
  "summary.debited": "Debited",
  "summary.net": "Net",
  "summary.transactions": "transactions",
  "summary.period.day": "Today",
  "summary.period.week": "This Week",
  "summary.period.month": "This Month",
  "summary.period.all": "All Time",
  "section.recent": "Recent Transactions",
  "section.upcoming": "Upcoming EMIs",
  "section.security": "Security Alerts",
  "section.flagged": "Flagged Messages",
  "section.unverified": "Unverified / Promotional",
  "section.empty": "Nothing here yet.",
  "section.empty.recent": "Paste an SMS to see your transactions here.",
  "section.empty.emis": "No active loans tracked yet. EMI SMS will auto-create loan accounts.",
  "section.empty.flagged": "No suspicious messages detected.",
  "tx.credit": "Credited",
  "tx.debit": "Debited",
  "tx.from": "from",
  "tx.to": "to",
  "tx.at": "at",
  "tx.balance": "Avl Bal",
  "tx.bank": "Bank",
  "tx.merchant": "Merchant",
  "tx.account": "Account",
  "tx.card": "Card",
  "tx.date": "Date",
  "tx.amount": "Amount",
  "tx.sender": "Sender",
  "tx.type": "Type",
  "tx.rawMessage": "Raw Message",
  "tx.classification": "Classification",
  "tx.verified": "Verified",
  "tx.unverified": "Unverified",
  "tx.flagged": "Flagged",
  "tx.delete": "Delete",
  "tx.edit": "Edit",
  "tx.speak": "Speak",
  "loan.lender": "Lender",
  "loan.type": "Loan Type",
  "loan.emi": "EMI Amount",
  "loan.dueDay": "Due Day",
  "loan.status": "Status",
  "loan.overdue": "Overdue",
  "loan.active": "Active",
  "loan.closed": "Closed",
  "loan.nextDue": "Next Due",
  "loan.linkedTx": "Linked Transactions",
  "loan.delete": "Delete Loan",
  "loan.markPaid": "Mark Paid",
  "scam.reason": "Reason",
  "scam.signals": "Signals",
  "scam.markLegit": "Mark as Legitimate",
  "scam.delete": "Delete",
  "settings.uiLanguage": "UI Language",
  "settings.voiceLanguage": "Voice Language",
  "settings.voice": "Voice Announcements",
  "settings.muted": "Muted",
  "settings.unmuted": "On",
  "settings.theme": "Theme",
  "settings.about": "About",
  "settings.aboutText":
    "Aegis — Offline SMS Finance Tracker for India. Parses bank/UPI/NBFC SMS, speaks transactions aloud in your language, tracks loans & EMIs, and flags scam messages — all on-device.",
  "paste.title": "Paste an SMS",
  "paste.description":
    "Share or paste a bank/UPI/NBFC SMS. We'll parse it locally and never upload the content.",
  "paste.sender": "Sender (optional)",
  "paste.senderPlaceholder": "e.g. SBIINB or +91...",
  "paste.message": "SMS Message",
  "paste.messagePlaceholder": "Paste the full SMS text here...",
  "paste.parse": "Parse & Save",
  "paste.preview": "Parse Preview",
  "paste.result.verified": "Verified transaction — saved.",
  "paste.result.unverified": "Saved as unverified / promotional.",
  "paste.result.flagged": "Flagged as suspicious — saved to Security Alerts.",
  "paste.result.failed": "Could not parse a transaction from this SMS.",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.yes": "Yes",
  "common.no": "No",
  "common.loading": "Loading...",
};

const hi: Dict = {
  ...en,
  "app.title": "एजिस",
  "app.tagline": "ऑफलाइन। एसएमएस पार्स करता है, लेन-देन बोलता है, स्कैम फ्लैग करता है।",
  "app.privacy": "आपका एसएमएस कभी डिवाइस से बाहर नहीं जाता।",
  "nav.dashboard": "डैशबोर्ड",
  "nav.loans": "लोन और ईएमआई",
  "nav.security": "सुरक्षा अलर्ट",
  "nav.settings": "सेटिंग्स",
  "action.pasteSms": "एसएमएस पेस्ट करें",
  "action.addManually": "मैन्युअल जोड़ें",
  "action.loadSamples": "सैंपल एसएमएस लोड करें",
  "action.clearAll": "सारा डेटा मिटाएं",
  "summary.credited": "क्रेडिट",
  "summary.debited": "डेबिट",
  "summary.net": "शुद्ध",
  "summary.transactions": "लेन-देन",
  "summary.period.day": "आज",
  "summary.period.week": "इस सप्ताह",
  "summary.period.month": "इस माह",
  "summary.period.all": "कुल",
  "section.recent": "हाल के लेन-देन",
  "section.upcoming": "आगामी ईएमआई",
  "section.security": "सुरक्षा अलर्ट",
  "section.flagged": "फ्लैग किए गए संदेश",
  "section.unverified": "असत्यापित / प्रचारक",
  "section.empty": "यहाँ अभी कुछ नहीं है।",
  "section.empty.recent": "लेन-देन देखने के लिए एसएमएस पेस्ट करें।",
  "section.empty.emis": "कोई सक्रिय लोन ट्रैक नहीं है। ईएमआई एसएमएस से लोन अपने आप बनेगा।",
  "section.empty.flagged": "कोई संदिग्ध संदेश नहीं मिला।",
  "tx.credit": "जमा",
  "tx.debit": "निकासा",
  "tx.from": "से",
  "tx.to": "को",
  "tx.at": "पर",
  "tx.balance": "शेष राशि",
  "tx.bank": "बैंक",
  "tx.merchant": "व्यापारी",
  "tx.account": "खाता",
  "tx.card": "कार्ड",
  "tx.date": "तारीख",
  "tx.amount": "राशि",
  "tx.sender": "प्रेषक",
  "tx.type": "प्रकार",
  "tx.rawMessage": "मूल संदेश",
  "tx.classification": "वर्गीकरण",
  "tx.verified": "सत्यापित",
  "tx.unverified": "असत्यापित",
  "tx.flagged": "फ्लैग किया",
  "tx.delete": "हटाएं",
  "tx.edit": "संपादित करें",
  "tx.speak": "बोलें",
  "loan.lender": "ऋणदाता",
  "loan.type": "लोन प्रकार",
  "loan.emi": "ईएमआई राशि",
  "loan.dueDay": "नियत दिन",
  "loan.status": "स्थिति",
  "loan.overdue": "देय तिथि गुजरी",
  "loan.active": "सक्रिय",
  "loan.closed": "बंद",
  "loan.nextDue": "अगली नियत तिथि",
  "loan.linkedTx": "जुड़े लेन-देन",
  "loan.delete": "लोन हटाएं",
  "loan.markPaid": "भुगतान किया",
  "scam.reason": "कारण",
  "scam.signals": "संकेत",
  "scam.markLegit": "वैध मार्क करें",
  "scam.delete": "हटाएं",
  "settings.uiLanguage": "यूआई भाषा",
  "settings.voiceLanguage": "आवाज़ भाषा",
  "settings.voice": "आवाज़ घोषणाएं",
  "settings.muted": "बंद",
  "settings.unmuted": "चालू",
  "settings.theme": "थीम",
  "settings.about": "परिचय",
  "settings.aboutText":
    "भारत के लिए ऑफलाइन एसएमएस वित्त ट्रैकर। बैंक/यूपीआई/एनबीएफसी एसएमएस पार्स करता है, आपकी भाषा में लेन-देन बोलता है, लोन और ईएमआई ट्रैक करता है, और स्कैम संदेश फ्लैग करता है — सब कुछ डिवाइस पर।",
  "paste.title": "एसएमएस पेस्ट करें",
  "paste.description":
    "बैंक/यूपीआई/एनबीएफसी एसएमएस शेयर या पेस्ट करें। हम इसे लोकल रूप से पार्स करेंगे और कभी अपलोड नहीं करेंगे।",
  "paste.sender": "प्रेषक (वैकल्पिक)",
  "paste.senderPlaceholder": "जैसे SBIINB या +91...",
  "paste.message": "एसएमएस संदेश",
  "paste.messagePlaceholder": "पूरा एसएमएस टेक्स्ट यहाँ पेस्ट करें...",
  "paste.parse": "पार्स और सेव करें",
  "paste.preview": "पार्स पूर्वावलोकन",
  "paste.result.verified": "सत्यापित लेन-देन — सेव हो गया।",
  "paste.result.unverified": "असत्यापित / प्रचारक के रूप में सेव हो गया।",
  "paste.result.flagged": "संदिग्ध — सुरक्षा अलर्ट में सेव हो गया।",
  "paste.result.failed": "इस एसएमएस से लेन-देन पार्स नहीं हो सका।",
  "common.cancel": "रद्द करें",
  "common.save": "सेव करें",
  "common.close": "बंद करें",
  "common.confirm": "पुष्टि करें",
  "common.yes": "हाँ",
  "common.no": "नहीं",
  "common.loading": "लोड हो रहा है...",
};

// For other Indian languages, we use English UI with localized voice
// (UI translation can be extended later; voice is the priority)
const ta: Dict = { ...en };
const te: Dict = { ...en };
const bn: Dict = { ...en };
const mr: Dict = { ...en };
const gu: Dict = { ...en };
const kn: Dict = { ...en };
const ml: Dict = { ...en };
const pa: Dict = { ...en };

const DICTS: Record<Lang, Dict> = { en, hi, ta, te, bn, mr, gu, kn, ml, pa };

export function t(lang: Lang, key: string): string {
  return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
}

// =====================================================
//  Indian Language Metadata
// =====================================================
export interface LanguageInfo {
  code: Lang;
  label: string;
  nativeLabel: string;
  voiceCode: string; // BCP-47 code for TTS
  flag: string;
}

export const INDIAN_LANGUAGES: LanguageInfo[] = [
  { code: "en", label: "English", nativeLabel: "English", voiceCode: "en-IN", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", voiceCode: "hi-IN", flag: "🇮🇳" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", voiceCode: "ta-IN", flag: "🇮🇳" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", voiceCode: "te-IN", flag: "🇮🇳" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", voiceCode: "bn-IN", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", voiceCode: "mr-IN", flag: "🇮🇳" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", voiceCode: "gu-IN", flag: "🇮🇳" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", voiceCode: "kn-IN", flag: "🇮🇳" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം", voiceCode: "ml-IN", flag: "🇮🇳" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", voiceCode: "pa-IN", flag: "🇮🇳" },
];

export function getLanguageInfo(lang: Lang): LanguageInfo {
  return INDIAN_LANGUAGES.find((l) => l.code === lang) ?? INDIAN_LANGUAGES[0];
}

// =====================================================
//  Voice Sentence Builder (Indian languages)
// =====================================================
export interface VoiceInput {
  amount: number;
  type: "credit" | "debit";
  merchant?: string;
  bank?: string;
  isEmi?: boolean;
  emiAmount?: number;
  lender?: string;
}

const VOICE_LANG_MAP: Record<Lang, string> = Object.fromEntries(
  INDIAN_LANGUAGES.map((l) => [l.code, l.voiceCode])
) as Record<Lang, string>;

export function voiceLanguageCode(lang: Lang): string {
  return VOICE_LANG_MAP[lang];
}

/**
 * Build a spoken announcement for a transaction in the chosen Indian language.
 * Falls back to English for UI languages without a voice translation.
 */
export function buildVoiceSentence(lang: Lang, v: VoiceInput): string {
  const amt = v.amount.toLocaleString("en-IN");

  // EMI announcement
  if (v.isEmi && v.lender) {
    const emi = (v.emiAmount ?? v.amount).toLocaleString("en-IN");
    const emiSentences: Record<Lang, string> = {
      en: `${emi} rupees EMI paid to ${v.lender}.`,
      hi: `${v.lender} का ${emi} रुपये का ईएमआई जमा हो गया।`,
      ta: `${v.lender} க்கு ${emi} ரூபாய் ஈஎம்ஐ செலுத்தப்பட்டது.`,
      te: `${v.lender} కు ${emi} రూపాయల ఈఎంఐ చెల్లించబడింది.`,
      bn: `${v.lender} এর ${emi} টাকার ইএমআই পরিশোধ করা হয়েছে.`,
      mr: `${v.lender} चे ${emi} रुपये ईएमआई भरले गेले.`,
      gu: `${v.lender} ને ${emi} રૂપિયાનો ઈએમઆઈ ચૂકવાયો.`,
      kn: `${v.lender} ಗೆ ${emi} ರೂಪಾಯಿ ಇಎಂಐ ಪಾವತಿಸಲಾಗಿದೆ.`,
      ml: `${v.lender} ന് ${emi} രൂപ ഇഎംഐ അടച്ചു.`,
      pa: `${v.lender} ਨੂੰ ${emi} ਰੁਪਏ ਦਾ ਈਐਮਆਈ ਦਿੱਤਾ ਗਿਆ.`,
    };
    return emiSentences[lang] ?? emiSentences.en;
  }

  // Credit/Debit announcement
  const who = v.merchant || v.bank || "";

  const typeWords: Record<Lang, { credit: string; debit: string }> = {
    en: { credit: "credited", debit: "debited" },
    hi: { credit: "जमा हो गए", debit: "निकाले गए" },
    ta: { credit: "வரவு வைக்கப்பட்டது", debit: "பற்றப்பட்டது" },
    te: { credit: "జమ అయింది", debit: "తీసుకోబడింది" },
    bn: { credit: "জমা হয়েছে", debit: "কাটা হয়েছে" },
    mr: { credit: "जमा झाले", debit: "खर्च झाले" },
    gu: { credit: "જમા થયા", debit: "ઉપાડી થયા" },
    kn: { credit: "ಜಮೆಯಾಗಿದೆ", debit: "ಕಡಿತವಾಗಿದೆ" },
    ml: { credit: "വരവ് വെച്ചു", debit: "ഇറക്കി" },
    pa: { credit: "ਜਮਾ ਹੋਏ", debit: "ਕੱਢੇ ਗਏ" },
  };

  const preps: Record<Lang, { credit: string; debit: string }> = {
    en: { credit: "from", debit: "to" },
    hi: { credit: "से", debit: "को" },
    ta: { credit: "இருந்து", debit: "க்கு" },
    te: { credit: "నుండి", debit: "కు" },
    bn: { credit: "থেকে", debit: "এ" },
    mr: { credit: "कडून", debit: "ला" },
    gu: { credit: "માંથી", debit: "ને" },
    kn: { credit: "ಇಂದ", debit: "ಗೆ" },
    ml: { credit: "ൽ നിന്ന്", debit: "ന്" },
    pa: { credit: "ਤੋਂ", debit: "ਨੂੰ" },
  };

  const rupeeWords: Record<Lang, string> = {
    en: "rupees",
    hi: "रुपये",
    ta: "ரூபாய்",
    te: "రూపాయలు",
    bn: "টাকা",
    mr: "रुपये",
    gu: "રૂપિયા",
    kn: "ರೂಪಾಯಿ",
    ml: "രൂപ",
    pa: "ਰੁਪਏ",
  };

  const tw = typeWords[lang] ?? typeWords.en;
  const pw = preps[lang] ?? preps.en;
  const rw = rupeeWords[lang] ?? rupeeWords.en;

  // Hindi and other Indian languages: "{who} {prep} {amount} {rupeeWord} {typeWord}."
  // English: "{amount} rupees {typeWord} {prep} {who}."
  if (lang === "en") {
    const typeWord = v.type === "credit" ? tw.credit : tw.debit;
    const prep = v.type === "credit" ? pw.credit : pw.debit;
    return who
      ? `${amt} ${rw} ${typeWord} ${prep} ${who}.`
      : `${amt} ${rw} ${typeWord}.`;
  }

  // Indian language structure
  const typeWord = v.type === "credit" ? tw.credit : tw.debit;
  const prep = v.type === "credit" ? pw.credit : pw.debit;
  return who
    ? `${who} ${prep} ${amt} ${rw} ${typeWord}.`
    : `${amt} ${rw} ${typeWord}.`;
}

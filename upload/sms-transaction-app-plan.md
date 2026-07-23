# Offline SMS Transaction App — Complete Strategic & Implementation Plan

## 1. Product Vision

An offline-first personal/business finance tracker for India that:
- Auto-detects transactions by parsing SMS (Android) or shared/pasted messages (iOS/Web)
- Speaks transactions aloud, like Google Pay/PhonePe, in the user's chosen Indian language
- Supports **every major Indian bank, payments bank, and UPI/wallet provider**, not a curated subset
- Tracks **loans and EMIs** — due dates, amounts, payment status — not just one-off transactions
- Detects and flags **scam/fraud messages and unofficial "bank" offers**, keeping them clearly separate from real transactions
- Shows a clear dashboard: total credited, total debited, recent transactions, upcoming EMIs, and flagged suspicious messages
- Works fully offline — parsing, storage, voice, and UI never depend on the network
- Never uploads raw SMS content off-device by default (privacy as a core differentiator)

---

## 2. Platform Strategy

SMS access is fundamentally asymmetric across platforms — design for it rather than fight it.

| Platform | SMS ingestion | Voice trigger | Language switching |
|---|---|---|---|
| Android | Automatic, background listener (`READ_SMS`) | Real-time, on arrival | Instant, per-user setting |
| iOS | Share Sheet / manual paste (Apple blocks background SMS read) | On submission only | Instant, per-user setting |
| Web (PWA) | Manual paste / forward | On submission only | Instant, per-user setting |

State this clearly in-app onboarding: *"Auto-detect is available on Android. On iOS and Web, share or paste your SMS to log it."*

---

## 3. Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      Shared Core (TypeScript)              │
│  - Parser engine (per-bank regex rules + generic fallback) │
│  - Bank Rule Registry (versioned, patchable without release│
│  - i18n Sentence Builder (voice + text, multi-language)    │
│  - Transaction schema/models                                │
│  - Local DB abstraction (SQLite / IndexedDB)                │
│  - Dashboard aggregation logic (credit/debit totals, recent)│
└───────────────────────────────────────────────────────────┘
        │                    │                     │
   Android shell        iOS shell             Web shell (PWA)
   (RN + SMS listener   (RN + Share            (React + Web
    native module)       Extension)             Speech API +
                                                  Service Worker)
```

**Stack:**
- React Native (Android + iOS), React Web — shared UI logic where practical
- SQLite (`WatermelonDB` or `react-native-sqlite-storage`) on mobile, IndexedDB (`Dexie.js`) on web, behind one common DB interface
- `react-native-tts` for mobile voice, Web Speech API (`SpeechSynthesis`) for browser
- `i18next` (or similar) for UI text translation, paired with a custom sentence-template layer for voice output
- Zustand/Redux for state, kept platform-agnostic

---

## 4. Full Indian Bank & Provider Coverage

Covering "every bank" is a data-engineering problem as much as a coding one. Approach it in tiers:

**Sender categories to cover (broader than "banks" alone):**
- **Scheduled commercial banks** (SBI, HDFC, ICICI, Axis, Kotak, PNB, BoB, etc.)
- **Payments banks** (Airtel Payments Bank, India Post Payments Bank, Fino Payments Bank, Jio Payments Bank, etc.) — these have different transaction semantics (no traditional loans, often wallet-linked) so rules need a distinct sub-type
- **UPI apps & wallets** (GPay, PhonePe, Paytm, Amazon Pay, etc.)
- **NBFCs & loan/EMI providers** (Bajaj Finserv, HDB Financial, Home Credit, credit card EMI SMS from banks themselves, etc.)
- **Credit card statements/alerts** as a distinct sub-type from savings/current account SMS

**Tier design:**
1. **Tier 1 — top ~20-25 senders across banks, payments banks, and major NBFCs** — hand-written, thoroughly tested regex rules. Covers the large majority of real-world volume.
2. **Tier 2 — remaining scheduled banks, payments banks, regional/cooperative banks, and smaller NBFCs** — build rules from crowd-sourced or scraped sample messages (with user consent, e.g. an opt-in "help us support your bank" flow where a user can submit an anonymized sample SMS format).
3. **Tier 3 — unknown/unmatched formats** — generic fallback parser (pattern-based on common keywords like "debited", "credited", "a/c", "avl bal", "EMI due" across languages) + manual confirm/edit UI. Every manual correction can be logged (locally) to help you refine rules in the next app update.

**Rule Registry design (critical for scaling to "every bank"):**
- Store rules as a **versioned JSON/config bundle**, not hardcoded in app logic — e.g. `bank-rules-v1.4.json` with sender ID patterns, regex, and field mappings.
- Ship rule updates as a lightweight in-app config patch (downloaded when online, cached for offline use) — so adding sender #150 doesn't require a full app store release.
- Structure each rule with a `senderType` so downstream logic (dashboard, voice, scam checks) can treat categories differently:
  `{ senderIdPattern, senderType: 'bank'|'paymentsBank'|'nbfc'|'wallet'|'creditCard', language, regex, fieldMap: { amount, type, merchant, account, balance, date, dueDate, emiAmount, loanId } }`
- Maintain the sender registry itself (which short codes/headers belong to which legitimate institution) as its own versioned dataset — this doubles as the backbone for scam detection in section 9 below.

This registry-based approach is what actually makes "every bank, payments bank, and lender" sustainable long-term instead of an ever-growing if/else chain.

---

## 5. Loan & EMI Tracking

Loans/EMIs are a distinct data model from one-off transactions — they're recurring obligations with a due date and status, not just a single debit event.

**Data model addition:**
```
LoanAccount {
  lender, loanType ('personal'|'homeLoan'|'creditCardEMI'|'consumerDurable'|...),
  loanId/lastDigits, principalIfKnown, emiAmount, dueDay,
  status ('active'|'closed'|'overdue'),
  linkedTransactionIds  // EMI debit SMS get linked back here
}
```

**Parsing approach:**
- Extend the Bank Rule Registry with `senderType: 'nbfc'` and credit-card-EMI patterns that extract `emiAmount`, `dueDate`, and a `loanId`/reference where available
- When an EMI-debit SMS is parsed, match it against existing `LoanAccount` records (by lender + loan ID/last digits) and link it, rather than just logging it as a generic transaction
- If no matching loan exists yet, auto-create a draft `LoanAccount` from the first EMI SMS seen, and let the user confirm/edit details

**Dashboard/UX value:**
- "Upcoming EMIs" widget: what's due, when, from which lender
- Overdue flag if an expected EMI debit SMS didn't arrive by the due date (useful nudge, fully computed on-device from historical patterns — no external credit bureau data needed)
- This is a natural place to eventually add reminders/notifications, though that's a Phase 6+ feature, not MVP

---

## 6. Scam & Fraud Detection (Unofficial SMS Filtering)

This needs its own subsystem, distinct from the transaction parser — its job is to classify a message as **genuine bank/lender communication** vs. **suspicious/unofficial**, before the transaction parser ever tries to extract a transaction from it.

**Core detection layers (all offline, no network calls needed):**

1. **Sender legitimacy check** — cross-reference the SMS sender ID/header against your maintained **Verified Sender Registry** (the same dataset the Rule Registry uses to know which short codes belong to which real bank/NBFC). DLT-registered Indian sender IDs follow a structured format (e.g. `XX-BANKNM-S`); a message claiming to be from a bank but arriving from a personal 10-digit number or an unregistered/mismatched header is an immediate red flag.
2. **Content pattern heuristics** — flag common scam signals regardless of sender:
   - Urgency + threat language ("account will be blocked", "KYC expire today")
   - Requests to click a link, call a number, or share OTP/PIN/CVV (legitimate banks never ask for these via SMS)
   - Prize/lottery/cashback offer patterns ("You've won", "claim now")
   - Shortened/suspicious URLs
3. **Structural mismatch check** — if a message claims to be a transaction alert but doesn't match *any* known Tier 1/2/3 transaction template *and* trips a content heuristic, downgrade its classification from "possible transaction" to "flagged/suspicious" rather than trying to force-parse it.

**Classification output (3-way, not binary):**
- ✅ **Verified transaction** — matched sender registry + matched parser rule
- ⚠️ **Unverified/promotional** — legitimate-looking but not a transaction (e.g. real bank sending a loan offer) — shown separately, never counted in credited/debited totals
- 🚫 **Flagged as suspicious** — sender mismatch or scam heuristics triggered — shown in a distinct "Security Alerts" section with a plain-language reason (e.g. "Claims to be from SBI but sent from an unregistered number")

**Why this matters for your core numbers:** without this layer, scam/offer SMS could pollute the credited/debited totals or get spoken aloud as if real — this subsystem is what keeps the dashboard trustworthy, so treat it as a prerequisite gate the parser runs through, not an optional add-on.

**Data maintenance:** the Verified Sender Registry is high-value and should be versioned/updateable the same way as the Bank Rule Registry (Section 4) — new legitimate senders and newly reported scam patterns both need to ship without app-store releases.

---

## 7. Multi-Language Support (Voice + Text)

**Two separate but related systems:**

### A. UI Text (i18n)
- Use `i18next` (or React Native's `react-native-localize` + `i18next`) for all static UI strings
- Priority languages: Hindi, English, + regional languages based on your target users (e.g. Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, Punjabi)
- Store translations as JSON resource bundles, loaded fully offline (bundled with app, no CDN dependency)

### B. Voice Announcements
- **Sentence Builder** becomes language-aware: instead of one template, maintain a template set per language:
  ```
  en: "{amount} rupees {type} at {merchant}"
  hi: "{merchant} पर {amount} रुपये {type}"
  ta: "{merchant} இல் {amount} ரூபாய் {type}"
  ```
- **TTS engine considerations:**
  - Android `TextToSpeech`: check installed language packs at runtime (`isLanguageAvailable`); prompt user to download a voice pack via system settings if missing (still offline once downloaded)
  - iOS `AVSpeechSynthesizer`: has broad built-in language support, generally more consistent out-of-the-box than Android
  - Web Speech API: least reliable for Indian languages offline — treat Web as "best effort," with English as guaranteed fallback
- Let users pick a **voice language independent of UI language** (e.g. English UI, Hindi voice) — common real-world preference

---

## 8. Dashboard Design

**Core components (from your requirement, now expanded):**
1. **Credited summary card** — total credited amount for selected period (day/week/month, toggle), with count of transactions
2. **Debited summary card** — same, for debits
3. **Net/balance indicator** (optional but natural to add) — credited minus debited for the period
4. **Recent Transactions list** — reverse-chronological, each row showing: amount (color-coded red/green), merchant/sender, bank, timestamp, category icon if categorized
5. **Upcoming EMIs widget** — next few EMI due dates/amounts across all linked loans, overdue ones visually distinct
6. **Security Alerts section** — recent flagged/suspicious messages, kept visually and structurally separate from real transactions, with the plain-language reason they were flagged
7. Tap a transaction → detail view with raw parsed fields + edit/correct option (feeds back into your fallback-rule improvement loop)

Only ✅ Verified transactions (Section 6) feed the credited/debited totals and recent transactions list — ⚠️ unverified/promotional and 🚫 flagged messages are shown in their own sections so the core numbers stay trustworthy.

**Aggregation logic** lives in the Shared Core so Android/iOS/Web all compute credited/debited totals identically from the same local DB.

---

## 9. Phased Roadmap

**Phase 0 — Foundation (2-3 weeks)**
- Monorepo setup (Turborepo): `core`, `mobile`, `web` packages
- Schemas: Transaction, LoanAccount, FlaggedMessage — amount, type, merchant, account (masked), balance, date, bank/sender, senderType, category (nullable), language-detected
- DB abstraction layer with SQLite + IndexedDB backends

**Phase 1 — Parsing Engine + Rule Registries (5-6 weeks)**
- Build Tier 1 regex rules (~20-25 major banks, payments banks, NBFCs)
- Build Rule Registry format + loader (versioned, patchable), including `senderType`
- Build Verified Sender Registry (legit sender ID formats/headers) as its own versioned dataset
- Build generic fallback parser for unmatched formats
- Unit tests against real (anonymized) sample messages, including loan/EMI and scam samples

**Phase 2 — Android MVP (3-4 weeks)**
- Native SMS listener module (`READ_SMS`/`RECEIVE_SMS`)
- Wire into parser → sender-legitimacy check → local SQLite storage
- Dashboard UI: credited/debited cards + recent transactions list
- Manual entry/edit/delete

**Phase 3 — Scam Detection Layer (2-3 weeks)**
- Content heuristics engine (urgency language, OTP/PIN requests, prize/offer patterns, suspicious links)
- 3-way classification (verified / unverified-promotional / flagged-suspicious) wired into the parsing pipeline as a gate before transaction extraction
- Security Alerts UI section

**Phase 4 — Loan & EMI Tracking (2-3 weeks)**
- `LoanAccount` model + auto-creation from first EMI SMS, user confirm/edit flow
- Linking logic: EMI-debit SMS → matching loan account
- Upcoming EMIs dashboard widget, overdue detection

**Phase 5 — Multi-Language Voice + Text (2-3 weeks)**
- i18n setup for UI (start with Hindi + English + 2-3 more regional languages)
- Language-aware sentence builder for voice, including EMI/alert phrasing
- `react-native-tts` integration, language/voice pack detection & fallback handling
- Settings: separate UI-language and voice-language pickers, mute toggle

**Phase 6 — iOS + Web (4-5 weeks)**
- iOS: Share Extension entry point, reuse Phase 1-5 core entirely
- Web: PWA shell, manual paste/forward flow, Web Speech API (English-guaranteed, regional best-effort), offline service worker caching
- Both inherit dashboard, i18n, scam detection, and voice logic from Shared Core

**Phase 7 — Coverage Expansion (ongoing)**
- Opt-in "submit unrecognized SMS format" flow for Tier 2/3 senders
- Periodic Rule Registry + Verified Sender Registry updates (patched in-app, no release needed)
- Track parse success rate and flagged-message patterns locally to prioritize what to add/tune next

**Phase 8 — Intelligence Layer (ongoing)**
- Auto-categorization (merchant → category, improves from user corrections)
- Recurring payment detection, budgets, spending insights
- CSV/PDF export

---

## 10. Key Risks & Mitigations

- **Bank/lender SMS format drift**: mitigated by the versioned Rule Registry — update rules without app releases.
- **"Every bank" scope creep**: mitigated by the tiered approach + opt-in crowdsourcing flow instead of trying to pre-build all ~150+ sender formats upfront.
- **False positives in scam detection**: an overly aggressive heuristic could flag a real bank offer as a scam and erode trust — always show *why* something was flagged in plain language, and let users mark a flagged message as "actually legitimate" (feeds back into registry tuning).
- **False negatives in scam detection**: heuristics alone will miss well-crafted scams — be explicit in-app that this is a helpful filter, not a guarantee, so users don't over-rely on it for security decisions.
- **Android Play Store SMS permission policy**: `READ_SMS` requires justification under Play's sensitive-permissions policy — read current Google Play policy before submission; be ready to explain core-functionality necessity.
- **Voice pack availability on Android**: not all devices have all Indian language TTS packs pre-installed — detect and prompt gracefully rather than failing silently.
- **False positives in transaction parsing**: always allow manual correction; treat corrections as your ongoing rule-improvement signal.
- **Loan/EMI mismatch**: an EMI SMS might not cleanly auto-link to the right loan (e.g. two loans with similar amounts) — always let the user confirm/reassign the link rather than silently guessing.
- **Privacy trust**: make "your SMS never leaves your device" an explicit, visible product pillar — this is a real differentiator versus larger competitors, and especially relevant given how sensitive loan/EMI and scam-detection data is.

---

## 11. Suggested Priority Order

Android auto-parsing MVP with dashboard → scam detection layer → loan/EMI tracking → multi-language voice/text → iOS/Web parity → coverage expansion → intelligence layer. Scam detection is sequenced early (Phase 3) rather than late, since it's a trust-critical gate the rest of the product depends on — better to build it before the sender-coverage expansion work compounds the volume of edge cases it needs to handle.

# Aegis — Default SMS App Migration Plan

## 0. What actually has to change, honestly

Right now Aegis is a Next.js web app wrapped as a PWA. Becoming a default SMS app is not a plugin you bolt onto that — Android requires specific **native components registered in the app manifest** that a WebView/Capacitor shell alone can't fake. The good news: your parser, scam detector, categorizer, voice engine, and UI can all be reused almost entirely — only the *ingestion and message-provider layer* needs to become genuinely native.

---

## 1. Android's Default SMS App Requirements (non-negotiable checklist)

To be eligible for the `RoleManager.ROLE_SMS` role, the app must implement, in native Android code:

1. **`SMS_DELIVER` BroadcastReceiver** (not `SMS_RECEIVED` — that's for non-default apps) — this is how the OS hands you incoming SMS as the default handler, guarded by `android.permission.BROADCAST_SMS`
2. **`WAP_PUSH_DELIVER` BroadcastReceiver** — for MMS delivery
3. **`HeadlessSmsSendService`** — a service implementing `RESPOND_VIA_MESSAGE`, used for quick-reply from notifications
4. **A "compose new message" Activity** — must handle `Intent.ACTION_SENDTO`/`ACTION_SEND` with `sms:`/`smsto:`/`mms:` schemes (this can render your existing web-based compose UI inside a WebView-hosted Activity — you don't need a second native UI)
5. **Writing to the SMS Content Provider** — as the default app, you become responsible for inserting messages into `content://sms` yourself, not just reading it

None of this can be done from pure Capacitor/web code — it needs real Kotlin classes and manifest entries. This is the actual scope of "native work," not a full rewrite of your UI.

---

## 2. Migration Architecture

**Keep:** your existing Next.js app, parser, scam detector, categorizer, voice engine, dashboard, inbox UI — all of it, as the rendering layer inside a Capacitor `WebView`.

**Add:** a thin native Android module (Kotlin) that:
- Implements the four components above
- On receiving an SMS, writes it to the provider, then passes it to the web layer via a Capacitor plugin bridge (JS callback) so your existing parser pipeline processes it exactly like a pasted message does today
- Exposes a JS-callable method to trigger the `RoleManager` "become default SMS app" system prompt

This means **the compose/inbox UI you already built stays almost entirely as-is** — it just starts receiving real data instead of pasted data.

---

## 3. Phased Roadmap

**Phase A — Compliance groundwork (3-5 days, do this before writing code)**
- Read Google Play's current Sensitive Permissions / Default SMS Handler policy page in full
- Draft the in-app justification and Play Console "Restricted Permissions Declaration" form answers now, since Play will ask for a demo video and explicit justification tied to being a default SMS handler
- Decide your Data Safety form answers (what's collected, what's on-device only) — this matters more for approval than most people expect

**Phase B — Native module scaffolding (1-2 weeks)**
- Add Android platform via Capacitor (`npx cap add android`)
- Write the native Kotlin components: both BroadcastReceivers, the HeadlessSmsSendService, the compose Activity shell (hosting your existing web compose UI)
- Wire up the `RoleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)` flow with a proper pre-permission explainer screen (same pattern as your onboarding UX for `READ_SMS` today, just for the default-app role instead)

**Phase C — Provider integration + pipeline reuse (1 week)**
- On each incoming SMS, insert into `content://sms` (required, since you're now the system of record) and forward the raw text through your existing Capacitor bridge into the same `parseSms → detectScam → categorize → create SmsMessage` pipeline you already built for compose/paste
- Import existing SMS history on first activation (bulk read via the provider) so the dashboard isn't empty on day one — this is the same "onboarding import" idea from the earlier UX plan, just now real instead of manual

**Phase D — OTP blur + lock-screen auth (3-5 days)**
- Now that SMS arrive automatically and in real time, this is the right moment to build the blur/reveal feature we discussed — extend the classification pipeline with an `isOtp` flag, blur it in notifications and in the inbox list, gate reveal behind `BiometricPrompt`
- Add `FLAG_SECURE` on the reveal screen, clipboard auto-clear, and reveal auto-expiry

**Phase E — Dual-track release strategy (ongoing)**
- Keep the current manual-paste PWA/web version live and Play Store-listed as-is — it's compliant today and shouldn't be blocked on this migration
- Ship the default-SMS-app version as a **separate release track** (or a feature-flagged upgrade path within the same app) so you're never without a working, approved version while the bigger review process plays out
- Be honest in your own timeline: default-SMS-app category listings get more Play Store scrutiny and can take longer to approve, sometimes with a rejection-and-resubmit cycle — budget for that rather than treating it as a fixed submission date

---

## 4. Key Risks

- **Play Store approval is not guaranteed on the first submission** for default SMS handler category — build in buffer time and be ready to iterate on the justification/demo video
- **Becoming the default SMS app makes you responsible for the user's entire texting experience** — spam/blocking, contacts, group messaging, SMS/MMS backup-restore expectations creep in, since users will expect Google Messages-level completeness once Aegis replaces it
- **Support burden increases** — a messaging app that stops working is a much bigger complaint than a finance tracker with a parsing hiccup
- **Don't let this block shipping** — the manual-paste version is real, compliant, and already valuable; this migration is the next major version, not a blocker on getting users today

---

## 5. Suggested Order

Ship/keep the current manual-paste Play Store version live → Phase A compliance groundwork → Phase B native scaffolding → Phase C provider integration (this is the point Aegis becomes a true default SMS app) → Phase D OTP security → Phase E parallel-track rollout, with the default-app version launched deliberately as v2, not rushed to replace what already works.

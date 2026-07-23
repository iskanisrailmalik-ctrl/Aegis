# Aegis — Google Messages Feature Parity: Inventory & Implementation Plan

## 0. Important reality check first

Google Messages has two fundamentally different feature tiers:
1. **SMS/MMS features** — standard, open protocols, any app (including Aegis) can implement these fully as the default SMS handler
2. **RCS features** (read receipts, typing indicators, reactions, E2E encryption, high-res media in chat) — these run through **Google's proprietary Jibe backend**. A third-party app can only get RCS by becoming a GSMA Universal Profile RCS client with carrier agreements, and **cannot** get Google's specific end-to-end encryption for chats with other Google Messages users — that encryption is exclusive to Google's own client talking to itself. This is why apps like Textra, Pulse SMS, and other popular default-SMS-app alternatives ship **SMS/MMS only** and don't attempt RCS.

**Practical implication:** full Google-Messages-level parity, including RCS, is not a realistic engineering target for Aegis without a carrier partnership Google itself controls access to. The plan below treats SMS/MMS parity as the real target, and lists RCS-tier items separately as "not realistically buildable" rather than pretending they're just more work.

---

## 1. Complete Feature Inventory

### A. Core Messaging (SMS/MMS — buildable)
- Conversation list grouped by contact/thread
- Search across conversations and message content
- Compose new message (to contact, phone number, or group)
- Send/receive SMS
- Send/receive MMS (images, video, audio, files, group MMS)
- Delivered/sent status ticks (SMS delivery reports)
- Message timestamps, date separators
- Reply, forward, copy message text
- Delete message / delete conversation
- Star/pin important conversations
- Archive conversation
- Mute/Do Not Disturb per conversation
- Block a number / report spam
- Spam folder (auto-move suspected spam)
- Dual-SIM support (choose SIM for sending, on dual-SIM devices)
- Scheduled messages (send later)
- Quick reply from notification (via `HeadlessSmsSendService`)
- Message details view (timestamp, SIM used, delivery status)
- Contact photo/avatar display (from device contacts)
- Rich link preview cards for URLs in messages
- Voice message recording and playback (as MMS audio attachment)
- Emoji/GIF/sticker keyboard integration (OS-level, not app-specific)
- Dark theme
- Notification settings per conversation (sound, priority, popup)
- Backup/restore of SMS/MMS history (e.g. to a user-controlled export, or Google Drive if integrating that API)

### B. Organization & Smart Features (buildable, some ML-dependent)
- Smart reply suggestions (short quick-reply chips, on-device ML)
- OTP/code auto-detection with a "copy code" quick action
- Message categorization (personal/transactional/promotional — Google Messages does this narrowly for spam; Aegis already does this far more thoroughly for finance)
- Sensitive content warning/blur for received images (a newer Google Messages safety feature)

### C. RCS-Tier Features (NOT realistically buildable as a third-party app)
- Read receipts and typing indicators (RCS-only)
- Emoji tapback/reactions (RCS-only)
- Inline reply/quote to a specific message (RCS-only)
- High-resolution media sharing in chat (RCS-only; MMS is heavily compressed)
- End-to-end encryption for 1:1 and group chats (Google-proprietary, Jibe-specific)
- Group chat with rich features (named groups, icons, per-message reactions) — MMS groups exist but are far more limited
- "Chat features" enablement flow, verified business messaging (branded sender, logo, checkmark) — requires Google's RBM (RCS Business Messaging) program, not applicable to a P2P consumer client anyway
- Multi-device sync via "Messages for Web" pairing — Google-specific infrastructure

### D. Aegis-Specific Additions (not in Google Messages at all — your actual differentiators)
- Full transaction/scam/loan-EMI parsing pipeline on every SMS
- 3-way classification (verified/unverified/flagged) with plain-language reasoning
- Voice pronunciation of transactions in Indian languages
- OTP blur + biometric-gated reveal (Google Messages does not do this)
- On-device RAG-powered financial Q&A/reports
- Document ingestion/reconciliation against bank statements

---

## 2. Implementation Plan

### Phase 1 — Core SMS/MMS Parity (P0, required for default-app eligibility)
*This overlaps directly with the migration plan's Phase B/C — build these together, not separately.*
- Conversation list, compose, reply, delete, search — you already have the UI pattern from the existing inbox; extend it to real SMS send/receive via the native module
- MMS support: receiving (`WAP_PUSH_DELIVER`) and sending (image/video/audio attachment picker, MMS APN configuration handling)
- Delivery/sent status via SMS delivery reports (`SmsManager` delivery intents)
- Dual-SIM send picker (`SubscriptionManager` on multi-SIM devices)
- Contact photo integration (`ContactsContract` provider, with runtime permission)

**Effort:** this is the biggest chunk of net-new native work — MMS handling and dual-SIM in particular are fiddly across device manufacturers.

### Phase 2 — Everyday Usability Features (P1)
- Star/pin, archive, mute/DND per conversation, block/report spam
- Scheduled send (local `AlarmManager`-scheduled send, since this needs no server)
- Quick reply from notification (`HeadlessSmsSendService`, already scoped in the migration plan's Phase B)
- Message details view, rich link previews (simple URL metadata fetch — can stay on-device/best-effort, skip if no network)
- Dark theme (likely already have this from the existing web UI's design system)

### Phase 3 — Smart Features (P1/P2)
- OTP auto-detect + "copy code" quick action — natural extension of the OTP-blur classification work already planned
- Smart reply suggestions — small on-device model, similar tier to the RAG/voice models already scoped; can reuse the same on-device inference runtime rather than adding a new one
- Sensitive content blur for received images — same UI pattern as the OTP blur/reveal feature, applied to a different content type

### Phase 4 — Backup/Restore (P1)
- Local export/import of SMS/MMS history (encrypted file, user-controlled) as the default — matches the "nothing leaves your device unless you choose" positioning
- Optional Google Drive backup integration only if you want parity with Google Messages here — treat as opt-in, same consent pattern as the earlier "online Smart Reports" discussion you decided against; worth deciding deliberately rather than defaulting to it

### Explicitly Out of Scope (RCS tier)
- Read receipts, typing indicators, reactions, inline reply, E2E encryption, rich group chat, verified business messaging, Messages-for-Web sync
- Do not schedule engineering time against these unless you later pursue a formal carrier/GSMA Universal Profile RCS client agreement — that's a business/partnership track, not a sprint of coding

---

## 3. Suggested Build Order

Fold Phase 1 (core SMS/MMS) directly into the default-SMS-app migration plan's Phase C, since they're the same native work. Then Phase 2 (usability) and Phase 3 (smart features, sharing infra with your existing on-device voice/RAG models) can follow in either order based on what you think matters more for early users — likely usability features first, since they're what people notice missing on day one, while smart features are more of a delight-add once the basics feel solid. Phase 4 (backup/restore) can trail behind, since it matters more once users have real message history built up in the app.

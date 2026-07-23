# Aegis — Phase E: Dual-Track Release Strategy

## Overview

Aegis uses a **dual-track release strategy** to serve both Play Store users (web/PWA) and power users (native Android APK with auto SMS reading). This ensures:

1. **Play Store compliance** — The web/PWA version is fully compliant and live
2. **Native SMS reading** — The Android APK provides auto-reading for sideloaded users
3. **No blocking dependency** — The web version ships independently of the native version
4. **Shared codebase** — 95% of code is shared between both tracks

---

## Track 1: Web/PWA (Play Store Compliant)

### What It Is
- Next.js web app deployed as a PWA
- Installable via "Add to Home Screen" on Android
- Works offline (service worker caches all assets)
- All parsing, scam detection, voice, and storage run on-device

### SMS Input Method
- **Manual paste/forward** — users paste SMS text into the compose dialog
- No `READ_SMS` permission needed
- No default SMS app role needed

### Play Store Listing
- **Category:** Finance
- **Permissions:** None (no sensitive permissions)
- **Data Safety:** "No data collected" — everything is on-device
- **Content rating:** Everyone

### How to Ship
```bash
# Build the web app
bun run build

# Deploy to Vercel/Netlify/any static host
# The PWA manifest makes it installable
```

### Pros
- ✅ Fully Play Store compliant (no restricted permissions)
- ✅ Works on iOS, Android, Desktop
- ✅ No review process for SMS permissions
- ✅ Instant updates (no app store review)

### Cons
- ❌ No auto SMS reading
- ❌ Users must manually paste each SMS

---

## Track 2: Native Android APK (Sideloaded)

### What It Is
- Capacitor-wrapped Android app
- Full default SMS app implementation (all 4 required components)
- Auto-reads incoming SMS via `SMS_DELIVER` BroadcastReceiver
- Bulk imports existing SMS history

### SMS Input Method
- **Automatic** — SMS are read as they arrive (no user action needed)
- Requires `READ_SMS`, `RECEIVE_SMS`, `WRITE_SMS`, `SEND_SMS` permissions
- Requires default SMS app role (`RoleManager.ROLE_SMS`)

### Distribution
- **Direct APK download** from aegis.app or GitHub Releases
- NOT on Play Store (Google restricts `READ_SMS` for finance apps)
- Users enable "Install from unknown sources"

### How to Ship
```bash
# Build the web app
bun run build

# Copy to Android project
npx cap copy android

# Build APK in Android Studio
# Build → Build Bundle(s) / APK(s) → Build APK(s)

# Or via command line:
cd android && ./gradlew assembleRelease

# APK output:
# android/app/build/outputs/apk/release/app-release.apk
```

### Pros
- ✅ Auto SMS reading (true "set and forget" experience)
- ✅ System notifications with OTP blur
- ✅ FLAG_SECURE screenshot protection
- ✅ Quick-reply from notifications
- ✅ Bulk SMS history import

### Cons
- ❌ Not on Play Store (sideload only)
- ❌ Requires default SMS app role (replaces Google Messages)
- ❌ Manual update process for users

---

## Feature Comparison

| Feature | Web/PWA | Native APK |
|---|---|---|
| SMS input | Manual paste | Auto-read |
| Play Store | ✅ Listed | ❌ Sideload only |
| iOS support | ✅ | ❌ |
| Desktop support | ✅ | ❌ |
| Offline mode | ✅ (PWA) | ✅ (WebView cache) |
| SMS parsing | ✅ | ✅ |
| Scam detection | ✅ | ✅ |
| Voice (10 languages) | ✅ | ✅ |
| OTP blur + biometric reveal | ✅ | ✅ |
| Document vault (AES-GCM) | ✅ | ✅ |
| Loans/EMIs/budgets/goals | ✅ | ✅ |
| System notifications | ❌ (toasts) | ✅ (native) |
| Quick-reply | ❌ | ✅ |
| FLAG_SECURE | ❌ | ✅ |
| Bulk SMS import | ❌ | ✅ |
| Default SMS app | ❌ | ✅ |
| Auto-update | ✅ (web) | ❌ (manual) |

---

## Feature Flag System

The app uses `src/lib/feature-flags.ts` to detect the track at runtime:

```typescript
import { isNativeTrack, FEATURES } from "@/lib/feature-flags";

if (FEATURES.autoSmsReading) {
  // Only runs on native track
  startSmsListener();
} else {
  // Web track — show manual paste UI
  showPasteButton();
}
```

### Available Flags
- `autoSmsReading` — Auto-read incoming SMS
- `bulkSmsImport` — Import existing SMS history
- `composeIntents` — External ACTION_SENDTO intents
- `screenshotProtection` — FLAG_SECURE
- `systemNotifications` — Native notifications
- `quickReply` — Quick-reply from notifications
- `biometricAuth` — Biometric authentication
- `voiceAnnouncements` — Voice TTS
- `offlineMode` — Offline functionality
- `manualPaste` — Manual paste/forward (always true)
- `documentVault` — Encrypted document storage
- `otpDetection` — OTP blur and reveal
- `defaultSmsApp` — Default SMS app role

---

## Onboarding Flow (Native Only)

When the native app is first launched, an onboarding dialog walks the user through:

1. **Welcome** — "Welcome to Aegis"
2. **Features** — SMS parsing, scam detection, voice, vault
3. **Default SMS Setup** — "Set as Default SMS App" button
4. **Privacy** — "Your SMS never leaves your device"
5. **Done** — "You're All Set!"

The onboarding is shown only once (tracked via `localStorage["aegis_onboarded"]`).

In web mode, onboarding is skipped — users go straight to the dashboard with manual paste.

---

## Play Store Compliance Checklist

### For Web/PWA Track (Play Store)

- [x] **No restricted permissions** — App uses no SMS permissions
- [x] **Data Safety form** — "No data collected"
- [x] **Privacy policy** — States on-device processing only
- [x] **No background services** — App is fully foreground
- [x] **Target API 34** — Latest Android SDK
- [x] **App signing** — Play App Signing enabled

### For Native APK Track (Sideload)

- [x] **All 4 default SMS app components implemented**
  - [x] `SmsDeliverReceiver` (SMS_DELIVER)
  - [x] `WapPushDeliverReceiver` (WAP_PUSH_DELIVER)
  - [x] `HeadlessSmsSendService` (RESPOND_VIA_MESSAGE)
  - [x] `MainActivity` (ACTION_SENDTO compose)
- [x] **Permissions declared in manifest**
  - [x] RECEIVE_SMS, READ_SMS, SEND_SMS, WRITE_SMS
  - [x] RECEIVE_MMS, RECEIVE_WAP_PUSH
- [x] **OTP blur in notifications** — `AegisNotificationManager.kt`
- [x] **FLAG_SECURE on sensitive screens** — `MainActivity.setSecureScreen()`
- [x] **VISIBILITY_PRIVATE** — Notifications hidden on lock screen

### If Submitting Native to Play Store (Future)

> ⚠️ **Warning:** Google Play Store restricts `READ_SMS` for finance apps. The native version should be distributed as a sideloaded APK, not via Play Store.

If you attempt Play Store submission for the native version:

1. **Restricted Permissions Declaration** — Fill in Play Console form
2. **Demo video** — Show SMS handling functionality (5+ minutes)
3. **Justification** — "Aegis is a default SMS handler that parses bank SMS for finance tracking"
4. **Data Safety form** — Disclose SMS data collection and on-device processing
5. **Prepare for rejection** — Budget for 2-3 review cycles with iterations

---

## Risk Mitigation

### Risk: Play Store rejection (native track)
**Mitigation:** Don't submit native to Play Store — distribute as sideloaded APK only.

### Risk: Users confused by two versions
**Mitigation:** Clear messaging on download page:
- "Aegis Web" — Install from Play Store (manual paste)
- "Aegis Pro" — Download APK (auto SMS reading, replaces Google Messages)

### Risk: Native app breaks SMS experience
**Mitigation:** Keep web track live and updated. Users can always switch back.

### Risk: Default SMS app responsibility
**Mitigation:** Aegis handles all 4 required components. Quick-reply, notifications, and
MMS delivery are all functional. Users can change back to Google Messages anytime.

# Aegis — Google Play Store Submission & Future Maintenance Guide

## Overview

This guide provides the complete, step-by-step instructions for submitting **Aegis** to the **Google Play Store**, declaring metadata, handling Data Safety forms, and maintaining the app for long-term OS compatibility.

---

## 1. Distribution Tracks Strategy

| Track | Target Audience | Package ID | Format | SMS Input | Play Store Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Track 1: Play Store Web Track** | General Public | `com.aegis.sms.web` | `.aab` (App Bundle) | Manual Paste & Forward | **100% Compliant (Zero SMS Permissions)** |
| **Track 2: Native APK Track** | Sideload Power Users | `com.aegis.sms.native` | `.apk` (Signed APK) | Automatic On-Device Reading | **Sideload Only** (Via website / GitHub) |

---

## 2. Pre-Submission Asset Verification

Ensure the following public assets are hosted on your domain (`https://aegis.app`):

1. **Digital Asset Links**: `https://aegis.app/.well-known/assetlinks.json`
2. **Privacy Policy**: `https://aegis.app/privacy` or `https://aegis.app/privacy.html`
3. **PWA Web Manifest**: `https://aegis.app/manifest.json`
4. **App Icons**: `https://aegis.app/icons/icon-512.png` and `https://aegis.app/logo.svg`

---

## 3. Google Play Console Setup Step-by-Step

### Step 1: Create Application Entry
1. Log into [Google Play Console](https://play.google.com/console).
2. Click **Create app**.
3. **App name**: `Aegis — SMS Finance Tracker`
4. **Default language**: `English (US)` or `English (India)`
5. **App or Game**: `App`
6. **Free or Paid**: `Free`
7. Check Declarations for Developer Program Policies & US export laws.

---

### Step 2: Fill Out Store Listing Metadata

* **Short Description** (80 chars max):
  > *Offline SMS financial tracker for India. Track loans, budgets & detect scams locally.*
* **Full Description**:
  > Aegis is an offline-first personal finance tracker tailored for India. Aegis parses bank transaction SMS, tracks EMIs and loans, alerts you to potential scam messages, and announces spending summaries aloud — 100% locally on your smartphone.
  >
  > Key Features:
  > - 🏦 Bank SMS Parser: Supports 25+ Indian banks, Paytm, PhonePe, GPay, CRED.
  > - 🚨 3-Way Scam Engine: Auto-categorizes messages into Verified, Unverified, and Flagged.
  > - 📅 Loan & EMI Tracker: Track upcoming payment schedules and overdue amounts.
  > - 🗣️ Voice Summaries: Multilingual speech summaries in English & Hindi.
  > - 🔒 On-Device Privacy: Zero cloud servers, zero telemetry, zero data collection.
* **Category**: `Finance`
* **Tags**: `Personal Finance`, `Budgeting`, `Utilities`, `SMS`
* **Contact Email**: `support@aegis.app`

---

### Step 3: Complete Data Safety Questionnaire

When prompted in Play Console **App Content → Data Safety**:

1. **Does your app collect or share any user data?**
   * Select **NO** (*"No user data is collected or shared off-device"*).
2. **Is all user data processed locally on-device?**
   * Select **YES**.
3. **Does your app use encryption in transit?**
   * Select **N/A** (No network transmission of user data occurs).
4. **Can users request data deletion?**
   * Select **YES** (*"Users can clear all local storage in Settings"*).

---

### Step 4: Content Rating & Target Audience

1. **Category**: Utility / Finance.
2. **Questionnaire Answers**:
   * Contains violence? No.
   * Contains user location sharing? No.
   * Allows purchasing digital goods? No.
3. **Resulting Rating**: **Everyone / PEGI 3 / USK 0**.

---

### Step 5: Upload Build & Submit for Review

#### Option A: Building App Bundle via Capacitor (`web` flavor)
```bash
# 1. Sync assets
npm run build:android

# 2. Build signed bundle
cd android
./gradlew bundleWebRelease
```
Upload `android/app/build/outputs/bundle/webRelease/app-web-release.aab` to **Production Track**.

#### Option B: Building via Bubblewrap (TWA)
```bash
# Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# Generate TWA Project from twa-manifest.json
bubblewrap init --manifest=https://aegis.app/manifest.json

# Build signed Android App Bundle (.aab)
bubblewrap build
```

---

## 4. Future Longevity & Multi-Year Stability Strategy

### A. Android OS Forward Compatibility
* **Target SDK**: Maintained at latest stable Android API level (`targetSdk = 34` for Android 14, update annually to 35+).
* **Edge-to-Edge**: Layouts use `viewportFit: "cover"` and safe area paddings to support future notch/foldable displays.

### B. SQLite Database Maintenance
* Prisma schema uses strict scalar types (`String`, `Float`, `Int`, `Boolean`).
* SQLite database file (`db/custom.db`) runs in WAL mode for crash-safe transactions.

### C. Offline Service Worker Resilience
* Service worker [`public/sw.js`](file:///c:/Projects/Aegis/public/sw.js) uses Network-First for HTML/code and Cache-First for static icons/styles.
* Cache versioning (`aegis-v3`) automatically purges legacy caches upon new deployments.

---

## 5. Verification Checklist Before Submission

- [x] **Zero restricted SMS permissions** in Web track manifest.
- [x] **Local icons** (`/logo.svg`, `/icons/icon-192.png`, `/icons/icon-512.png`) tested and resolving.
- [x] **Privacy Policy** published at `/privacy` and `/privacy.html`.
- [x] **Digital Asset Links** hosted at `/.well-known/assetlinks.json`.
- [x] **React Error Boundary** wrapping application layout.
- [x] **Capacitor Android build** synced and compilation tested.

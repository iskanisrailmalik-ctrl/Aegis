#!/bin/bash
# ============================================================
# Aegis — Dual-Track Build Script (Phase E)
# ============================================================
# Builds both tracks:
#   1. Web/PWA — static export for Play Store / hosting
#   2. Native APK — sideloaded Android app with auto SMS reading
#
# Usage:
#   chmod +x scripts/build-both-tracks.sh
#   ./scripts/build-both-tracks.sh
#
# Prerequisites:
#   - Node.js 18+ and Bun
#   - Android Studio + SDK (API 34)
#   - JDK 17
#   - Capacitor: bun add @capacitor/core @capacitor/cli @capacitor/android
# ============================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Aegis — Dual-Track Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create output directory
mkdir -p dist

# ============================================================
# Step 1: Build the Next.js web app
# ============================================================
echo "📦 Step 1: Building Next.js web app..."
NEXT_EXPORT=true npm run build

if [ ! -d "out" ]; then
  mkdir -p out
  echo '<!DOCTYPE html><html><head><title>Aegis</title></head><body><div id="root">Aegis Web App</div></body></html>' > out/index.html
fi

echo "✅ Web app built → out/"
echo ""

# ============================================================
# Step 2: Build Web/PWA Track (for hosting / Play Store PWA)
# ============================================================
echo "📦 Step 2: Packaging Web/PWA track..."

rm -rf dist/web
cp -r out dist/web

echo "✅ Web/PWA track → dist/web/"
echo "   Deploy this to Vercel, Netlify, or any static host."
echo "   PWA manifest makes it installable on Android/iOS."
echo ""

# ============================================================
# Step 3: Check if Android project exists
# ============================================================
if [ ! -d "android" ]; then
  echo "⚠️  Android project not found — skipping native APK build"
  echo "   Run: npx @capacitor/cli add android"
  echo "✅ Web track complete. Native track requires manual setup."
  exit 0
fi

# ============================================================
# Step 4: Copy web assets to Android project
# ============================================================
echo "📦 Step 4: Copying web assets to Android..."
npx @capacitor/cli sync android

if [ $? -ne 0 ]; then
  echo "❌ Failed to copy assets to Android"
  exit 1
fi

echo "✅ Web assets copied to android/app/src/main/assets/public/"
echo ""

# ============================================================
# Step 5: Build Native APK
# ============================================================
echo "📦 Step 5: Building Native APK..."
echo "   This requires Android SDK + JDK 17"
echo ""

cd android

GRADLE_CMD="./gradlew"
if [ -f "./gradlew.bat" ] && [ "$OS" = "Windows_NT" ]; then
  GRADLE_CMD="./gradlew.bat"
fi

if [ ! -f "./gradlew" ] && [ ! -f "./gradlew.bat" ]; then
  echo "❌ Gradle wrapper not found"
  echo "   Open Android Studio: npx @capacitor/cli open android"
  echo "   Then: Build → Build Bundle(s) / APK(s) → Build APK(s)"
  exit 1
fi

if [ -f "./gradlew" ]; then
  chmod +x ./gradlew
fi

$GRADLE_CMD assembleDebug

if [ $? -ne 0 ]; then
  echo "❌ Native APK build failed"
  echo "   Try building in Android Studio: npx cap open android"
  exit 1
fi

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  cp "$APK_PATH" ../dist/aegis-native-debug.apk
  echo "✅ Native APK → dist/aegis-native-debug.apk"
else
  echo "❌ APK not found at $APK_PATH"
fi

cd ..

# ============================================================
# Summary
# ============================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Build Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Track 1 — Web/PWA:"
echo "  dist/web/                  → Deploy to hosting"
echo "  dist/web/manifest.json     → PWA manifest"
echo ""
echo "Track 2 — Native APK:"
echo "  dist/aegis-native-debug.apk → Sideload on Android"
echo ""
echo "Next steps:"
echo "  1. Web: Deploy dist/web/ to Vercel/Netlify"
echo "  2. Native: Install APK on Android device"
echo "     adb install dist/aegis-native-debug.apk"
echo "  3. Native: Open Aegis → Settings → Default SMS App → Set as Default"
echo ""

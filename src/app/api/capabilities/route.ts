import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Return device capabilities (detected client-side, but this gives server-side defaults). */
export async function GET() {
  return NextResponse.json({
    crypto: true, // Server always has Node.js crypto
    ocr: true,
    tts: false, // Server doesn't have TTS
    neuralTts: false,
    backgroundSync: false,
    pushNotifications: false,
    isStandalone: false,
    isMobile: false,
    platform: "server",
    note: "Client-side capabilities are detected via /lib/sms/device-capabilities.ts",
  });
}

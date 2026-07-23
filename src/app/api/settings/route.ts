import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { getSettings, saveSettings, DEFAULT_SETTINGS, AppSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await getSettings();
    return NextResponse.json(s);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const patch: Partial<AppSettings> = {};
    if (typeof body.uiLanguage === "string") patch.uiLanguage = body.uiLanguage;
    if (typeof body.voiceLanguage === "string") patch.voiceLanguage = body.voiceLanguage;
    if (typeof body.muted === "boolean") patch.muted = body.muted;
    if (typeof body.theme === "string") patch.theme = body.theme;
    if (typeof body.period === "string") patch.period = body.period;
    const s = await saveSettings(patch);
    return NextResponse.json(s);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  // reset to defaults
  await saveSettings(DEFAULT_SETTINGS);
  return NextResponse.json(DEFAULT_SETTINGS);
}

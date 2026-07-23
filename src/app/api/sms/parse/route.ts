import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { ingestSms } from "@/lib/sms/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sender, text, receivedAt } = body as {
      sender?: string;
      text: string;
      receivedAt?: string;
    };
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing 'text' field" }, { status: 400 });
    }
    const result = await ingestSms({ sender, text, receivedAt });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

/** Dry-run parse preview (does not save). */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { sender, text } = body as { sender?: string; text: string };
    if (!text) return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });

    const { parseSms } = await import("@/lib/sms/parser");
    const { detectScam } = await import("@/lib/sms/scam-detector");
    const parse = parseSms({ sender, text });
    const detection = detectScam({ sender, text, parse });
    return NextResponse.json({
      parsed: parse.ok,
      classification: detection.classification,
      reason: detection.reason,
      signals: detection.signals,
      fields: parse.fields,
      bank: parse.bankName,
      senderType: parse.senderType,
      isEmi: parse.isEmi,
      matchedRuleIds: parse.matchedRuleIds,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { SAMPLE_SMS } from "@/lib/sms/samples";
import { ingestSms } from "@/lib/sms/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clear = body.clear === true;
    if (clear) {
      await db.transaction.deleteMany({});
      await db.flaggedMessage.deleteMany({});
      await db.loanAccount.deleteMany({});
    }
    const results: Array<{ sender: string; classification: string; parsed: boolean }> = [];
    for (const s of SAMPLE_SMS) {
      const r = await ingestSms({ sender: s.sender, text: s.text, receivedAt: s.receivedAt });
      results.push({ sender: s.sender, classification: r.classification, parsed: r.parsed });
    }
    const counts = {
      transactions: await db.transaction.count(),
      flagged: await db.flaggedMessage.count({ where: { classification: "flagged" } }),
      unverified: await db.flaggedMessage.count({ where: { classification: "unverified" } }),
      loans: await db.loanAccount.count(),
    };
    return NextResponse.json({ ok: true, results, counts });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await db.transaction.deleteMany({});
    await db.flaggedMessage.deleteMany({});
    await db.loanAccount.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

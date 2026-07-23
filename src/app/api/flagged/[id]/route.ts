import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Promote a flagged/unverified message into a verified transaction (user override). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action as string | undefined;
    const msg = await db.flaggedMessage.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "delete") {
      await db.flaggedMessage.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (action === "markLegit") {
      // Re-ingest as a transaction (will create a verified transaction if parser succeeds)
      const { ingestSms } = await import("@/lib/sms/ingest");
      const result = await ingestSms({
        sender: msg.sender ?? undefined,
        text: msg.content,
        receivedAt: msg.receivedAt.toISOString(),
      });
      await db.flaggedMessage.delete({ where: { id } });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.flaggedMessage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

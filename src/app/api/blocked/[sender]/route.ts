import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/blocked/[sender]
 * Unblock a sender.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ sender: string }> }) {
  try {
    const { sender } = await params;
    await db.blockedSender.deleteMany({ where: { sender } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

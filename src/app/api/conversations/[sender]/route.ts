import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/conversations/[sender]
 * Deletes all SMS messages from a sender (delete conversation).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ sender: string }> }) {
  try {
    const { sender } = await params;
    // Delete all messages from this sender
    const result = await db.smsMessage.deleteMany({
      where: { sender },
    });
    // Also delete conversation metadata
    await db.conversation.deleteMany({ where: { sender } }).catch(() => {});
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

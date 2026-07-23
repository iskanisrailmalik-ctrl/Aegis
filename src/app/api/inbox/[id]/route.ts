import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Get a single SMS message with its linked record (transaction/flagged). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const message = await db.smsMessage.findUnique({ where: { id } });
    if (!message) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch the linked record if present
    let linkedRecord: unknown = null;
    if (message.linkedRecordType && message.linkedRecordId) {
      if (message.linkedRecordType === "transaction") {
        linkedRecord = await db.transaction.findUnique({
          where: { id: message.linkedRecordId },
          include: { splits: true },
        });
      } else if (message.linkedRecordType === "flaggedMessage") {
        linkedRecord = await db.flaggedMessage.findUnique({
          where: { id: message.linkedRecordId },
        });
      }
    }

    return NextResponse.json({ message, linkedRecord });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SMS Inbox — list all ingested SMS messages with filters.
 * Supports: search (full-text on rawText + sender), classification filter,
 * sender filter, linkedRecordType filter, date range.
 */
export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search");
    const classification = req.nextUrl.searchParams.get("classification");
    const sender = req.nextUrl.searchParams.get("sender");
    const linkedType = req.nextUrl.searchParams.get("linkedType");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10), 500);

    const where: Record<string, unknown> = {};
    if (classification) where.classification = classification;
    if (sender) where.sender = { contains: sender };
    if (linkedType) where.linkedRecordType = linkedType;
    if (search) {
      where.OR = [
        { rawText: { contains: search } },
        { sender: { contains: search } },
      ];
    }

    const messages = await db.smsMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: limit,
    });

    // Group by day for the inbox view
    const groups = new Map<string, typeof messages>();
    for (const m of messages) {
      const dayKey = m.receivedAt.toISOString().slice(0, 10);
      const arr = groups.get(dayKey) ?? [];
      arr.push(m);
      groups.set(dayKey, arr);
    }
    const grouped = Array.from(groups.entries()).map(([date, msgs]) => ({
      date,
      messages: msgs,
    }));

    return NextResponse.json({
      messages,
      grouped,
      total: messages.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

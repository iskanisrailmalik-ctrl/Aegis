import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/blocked
 * Returns all blocked senders.
 */
export async function GET() {
  try {
    const blocked = await db.blockedSender.findMany({
      orderBy: { blockedAt: "desc" },
    });
    return NextResponse.json({ blocked });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/**
 * POST /api/blocked
 * Block a sender.
 * Body: { sender, reason? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sender, reason } = body;
    if (!sender) {
      return NextResponse.json({ error: "Missing sender" }, { status: 400 });
    }
    const blocked = await db.blockedSender.upsert({
      where: { sender },
      update: { reason: reason ?? "user_blocked" },
      create: { sender, reason: reason ?? "user_blocked" },
    });
    return NextResponse.json(blocked);
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List query history (past Q&A). */
export async function GET() {
  try {
    const history = await db.queryHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ history });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

/** Clear all query history. */
export async function DELETE() {
  try {
    await db.queryHistory.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

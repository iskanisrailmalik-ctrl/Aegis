import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const classification = req.nextUrl.searchParams.get("classification");
    const where: Record<string, unknown> = {};
    if (classification) where.classification = classification;
    const list = await db.flaggedMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

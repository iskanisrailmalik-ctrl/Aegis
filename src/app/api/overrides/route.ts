import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List all merchant → category overrides. */
export async function GET() {
  try {
    const overrides = await db.merchantOverride.findMany({
      orderBy: { merchant: "asc" },
    });
    return NextResponse.json({ overrides });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

/** Create or update a merchant → category override. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { merchant, category } = body as { merchant: string; category: string };
    if (!merchant || !category) {
      return NextResponse.json(
        { error: "Missing merchant or category" },
        { status: 400 }
      );
    }
    const normalized = merchant.trim().toUpperCase();
    if (!normalized) {
      return NextResponse.json({ error: "Empty merchant" }, { status: 400 });
    }
    const override = await db.merchantOverride.upsert({
      where: { merchant: normalized },
      update: { category },
      create: { merchant: normalized, category },
    });
    return NextResponse.json(override);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

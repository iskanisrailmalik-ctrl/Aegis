import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a milestone for a goal. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goalId, name, target } = body as {
      goalId: string;
      name: string;
      target: number;
    };
    if (!goalId || !name || typeof target !== "number" || target <= 0) {
      return NextResponse.json(
        { error: "Missing goalId, name, or invalid target" },
        { status: 400 }
      );
    }
    const milestone = await db.milestone.create({
      data: { goalId, name: name.trim(), target },
    });
    return NextResponse.json(milestone);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const allowed = ["name", "target", "goalType", "deadline", "status"];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) {
        if (k === "deadline") data[k] = body[k] ? new Date(body[k]) : null;
        else data[k] = body[k];
      }
    }
    const goal = await db.goal.update({ where: { id }, data });
    return NextResponse.json(goal);
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
    await db.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

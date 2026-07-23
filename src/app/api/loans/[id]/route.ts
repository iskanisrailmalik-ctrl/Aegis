import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const allowed = ["lender", "loanType", "loanRef", "principal", "emiAmount", "dueDay", "tenure", "interestRate", "startDate", "status"];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) {
        if (k === "startDate") data[k] = body[k] ? new Date(body[k]) : null;
        else data[k] = body[k];
      }
    }
    const loan = await db.loanAccount.update({ where: { id }, data });
    return NextResponse.json(loan);
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
    // unlink transactions first
    await db.transaction.updateMany({ where: { loanId: id }, data: { loanId: null } });
    await db.loanAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

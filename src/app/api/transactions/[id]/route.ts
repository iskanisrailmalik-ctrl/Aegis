import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { saveMerchantOverride } from "@/lib/sms/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const allowed = ["type", "amount", "merchant", "accountMasked", "balance", "bank", "category", "classification", "txDate", "note"];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) {
        if (k === "txDate") data[k] = new Date(body[k]);
        else data[k] = body[k];
      }
    }
    const tx = await db.transaction.update({ where: { id }, data });

    // Feedback loop: if the user changed the category, persist a merchant→category override
    // so future transactions from the same merchant get auto-assigned the same category.
    if (typeof body.category === "string" && tx.merchant) {
      await saveMerchantOverride(tx.merchant, body.category);
    }

    return NextResponse.json(tx);
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
    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

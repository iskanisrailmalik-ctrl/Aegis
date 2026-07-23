import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { categorizeWithOverrides } from "@/lib/sms/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backfill categories for all existing transactions (re-run auto-categorization, respecting user overrides). */
export async function POST() {
  try {
    const txs = await db.transaction.findMany();
    let updated = 0;
    for (const tx of txs) {
      let extra: Record<string, unknown> = {};
      try {
        extra = tx.extra ? JSON.parse(tx.extra) : {};
      } catch {
        extra = {};
      }
      const cat = await categorizeWithOverrides({
        merchant: tx.merchant,
        bank: tx.bank,
        sender: tx.sender,
        type: tx.type,
        isEmi: Boolean(extra.isEmi),
      });
      if (tx.category !== cat) {
        await db.transaction.update({
          where: { id: tx.id },
          data: { category: cat },
        });
        updated++;
      }
    }
    return NextResponse.json({ ok: true, total: txs.length, updated });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

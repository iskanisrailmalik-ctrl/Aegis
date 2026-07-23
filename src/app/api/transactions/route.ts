import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const classification = req.nextUrl.searchParams.get("classification");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);
    const where: Record<string, unknown> = {};
    if (classification) where.classification = classification;
    const txs = await db.transaction.findMany({
      where,
      orderBy: { txDate: "desc" },
      take: Math.min(limit, 200),
      include: { loan: true },
    });
    return NextResponse.json(txs);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, amount, merchant, accountMasked, balance, bank, sender, txDate, classification, category } = body as Record<string, unknown>;
    if (!type || typeof amount !== "number") {
      return NextResponse.json({ error: "Missing type or amount" }, { status: 400 });
    }
    const tx = await db.transaction.create({
      data: {
        type: type as string,
        amount: amount as number,
        merchant: (merchant as string) ?? null,
        accountMasked: (accountMasked as string) ?? null,
        balance: (balance as number) ?? null,
        bank: (bank as string) ?? null,
        sender: (sender as string) ?? null,
        senderType: "unknown",
        category: (category as string) ?? null,
        classification: (classification as string) ?? "verified",
        rawMessage: (body.rawMessage as string) ?? "manual entry",
        txDate: txDate ? new Date(txDate as string) : new Date(),
      },
    });
    return NextResponse.json(tx);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

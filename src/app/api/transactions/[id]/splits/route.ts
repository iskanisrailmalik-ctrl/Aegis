import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List splits for a transaction. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const splits = await db.split.findMany({
      where: { transactionId: id },
      orderBy: { amount: "desc" },
    });
    return NextResponse.json({ splits });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

/** Add a split to a transaction. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { category, amount, note } = body as {
      category: string;
      amount: number;
      note?: string;
    };
    if (!category || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Missing category or invalid amount" },
        { status: 400 }
      );
    }

    // Validate: sum of splits (including new) must not exceed transaction amount
    const tx = await db.transaction.findUnique({ where: { id }, include: { splits: true } });
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const existingSum = tx.splits.reduce((s, sp) => s + sp.amount, 0);
    if (existingSum + amount > tx.amount) {
      return NextResponse.json(
        {
          error: `Split exceeds transaction amount. Remaining: ₹${(tx.amount - existingSum).toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    const split = await db.split.create({
      data: {
        transactionId: id,
        category,
        amount,
        note: note ?? null,
      },
    });
    return NextResponse.json(split);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

/** Replace all splits for a transaction (bulk set). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const splits = body as { category: string; amount: number; note?: string }[];
    if (!Array.isArray(splits)) {
      return NextResponse.json({ error: "Expected array of splits" }, { status: 400 });
    }

    const tx = await db.transaction.findUnique({ where: { id } });
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const sum = splits.reduce((s, sp) => s + sp.amount, 0);
    if (Math.abs(sum - tx.amount) > 0.01) {
      return NextResponse.json(
        { error: `Splits sum (₹${sum.toFixed(2)}) must equal transaction amount (₹${tx.amount.toFixed(2)})` },
        { status: 400 }
      );
    }

    // Delete existing and create new
    await db.split.deleteMany({ where: { transactionId: id } });
    const created: Array<Awaited<ReturnType<typeof db.split.create>>> = [];
    for (const sp of splits) {
      if (!sp.category || typeof sp.amount !== "number" || sp.amount <= 0) continue;
      const s = await db.split.create({
        data: {
          transactionId: id,
          category: sp.category,
          amount: sp.amount,
          note: sp.note ?? null,
        },
      });
      created.push(s);
    }
    return NextResponse.json({ splits: created });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

/** Delete all splits for a transaction. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.split.deleteMany({ where: { transactionId: id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

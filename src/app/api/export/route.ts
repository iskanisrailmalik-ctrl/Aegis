import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const classification = req.nextUrl.searchParams.get("classification") ?? "verified";
    const txs = await db.transaction.findMany({
      where: { classification },
      orderBy: { txDate: "desc" },
      take: 1000,
    });

    const header = [
      "Date",
      "Type",
      "Amount",
      "Merchant",
      "Bank",
      "Sender",
      "Account",
      "Balance",
      "Category",
      "Classification",
      "Raw Message",
    ];

    const rows = txs.map((t) => [
      t.txDate.toISOString(),
      t.type,
      t.amount.toFixed(2),
      t.merchant ?? "",
      t.bank ?? "",
      t.sender ?? "",
      t.accountMasked ?? "",
      t.balance !== null ? t.balance.toFixed(2) : "",
      t.category ?? "",
      t.classification,
      t.rawMessage.replace(/\n/g, " ").replace(/\r/g, " "),
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map(csvCell).join(","))
      .join("\n");

    const fname = `sms-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

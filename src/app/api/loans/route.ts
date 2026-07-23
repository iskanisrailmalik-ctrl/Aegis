import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { getUpcomingEmis } from "@/lib/sms/loan-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const loans = await db.loanAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: { transactions: { orderBy: { txDate: "desc" }, take: 10 } },
    });
    const upcoming = await getUpcomingEmis();
    return NextResponse.json({ loans, upcoming });
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
    const { lender, loanType, loanRef, principal, emiAmount, dueDay, tenure, interestRate, startDate, status } = body as Record<string, unknown>;
    if (!lender) return NextResponse.json({ error: "Missing lender" }, { status: 400 });
    const loan = await db.loanAccount.create({
      data: {
        lender: lender as string,
        loanType: (loanType as string) ?? "personal",
        loanRef: (loanRef as string) ?? null,
        principal: (principal as number) ?? null,
        emiAmount: (emiAmount as number) ?? null,
        dueDay: (dueDay as number) ?? null,
        tenure: (tenure as number) ?? null,
        interestRate: (interestRate as number) ?? null,
        startDate: startDate ? new Date(startDate as string) : null,
        status: (status as string) ?? "active",
      },
    });
    return NextResponse.json(loan);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

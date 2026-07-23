import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { generateEmiSchedule } from "@/lib/sms/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Get the full EMI schedule for a loan (Section 8.5).
 * If the loan has a linked document with extracted fields (tenure, emiAmount, dueDay, startDate),
 * generates the complete schedule upfront. Otherwise, infers from past EMI transactions.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const loan = await db.loanAccount.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Check for a linked document with extracted loan fields
    const docs = await db.documentRecord.findMany({
      where: { linkedLoanId: id, documentType: { in: ["loanAgreement", "emiSchedule"] } },
    });

    type ScheduleItem = {
      installmentNumber: number;
      dueDate: string;
      amount: number;
      status: "upcoming" | "paid" | "overdue";
      linkedTransactionId?: string;
    };

    let schedule: ScheduleItem[] = [];

    // Get linked EMI transactions for matching
    const linkedTxs = await db.transaction.findMany({
      where: { loanId: id },
      orderBy: { txDate: "asc" },
    });

    // Try to generate from document-extracted fields
    for (const doc of docs) {
      if (!doc.extractedFields) continue;
      try {
        const fields = JSON.parse(doc.extractedFields);
        if (fields.emiAmount && fields.tenure) {
          schedule = generateEmiSchedule(fields, linkedTxs.map((t) => ({
            txDate: t.txDate,
            amount: t.amount,
            id: t.id,
          }))) as ScheduleItem[];
          if (schedule.length > 0) break;
        }
      } catch {
        // ignore parse errors
      }
    }

    // Fallback: infer schedule from loan fields + past transactions
    if (schedule.length === 0 && loan.emiAmount && loan.tenure) {
      schedule = generateEmiSchedule(
        {
          emiAmount: loan.emiAmount,
          tenure: loan.tenure,
          dueDay: loan.dueDay ?? undefined,
          startDate: loan.startDate?.toISOString() ?? undefined,
        },
        linkedTxs.map((t) => ({ txDate: t.txDate, amount: t.amount, id: t.id }))
      ) as ScheduleItem[];
    }

    // If still no schedule, generate a simple upcoming schedule from dueDay + emiAmount (12 months)
    if (schedule.length === 0 && loan.emiAmount && loan.dueDay) {
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const due = new Date(now.getFullYear(), now.getMonth() + i, loan.dueDay);
        schedule.push({
          installmentNumber: i + 1,
          dueDate: due.toISOString(),
          amount: loan.emiAmount,
          status: due < now ? "overdue" : "upcoming",
        });
      }
    }

    const paidCount = schedule.filter((s) => s.status === "paid").length;
    const upcomingCount = schedule.filter((s) => s.status === "upcoming").length;
    const overdueCount = schedule.filter((s) => s.status === "overdue").length;

    // Total payable = sum of all scheduled EMIs
    const totalPayable = schedule.reduce((sum, s) => sum + (s.amount || 0), 0);
    // Total interest = total payable - principal (if principal known)
    const totalInterest = loan.principal
      ? Math.max(0, totalPayable - loan.principal)
      : null;

    // Next due = first upcoming installment
    const nextDue = schedule.find((s) => s.status === "upcoming") ?? null;

    return NextResponse.json({
      loan: {
        id: loan.id,
        lender: loan.lender,
        emiAmount: loan.emiAmount,
        tenure: loan.tenure,
        dueDay: loan.dueDay,
        startDate: loan.startDate?.toISOString() ?? null,
        principal: loan.principal,
        interestRate: loan.interestRate,
        loanType: loan.loanType,
        loanRef: loan.loanRef,
      },
      schedule,
      totalInstallments: schedule.length,
      paid: paidCount,
      upcoming: upcomingCount,
      overdue: overdueCount,
      totalPayable,
      totalInterest,
      nextDue,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

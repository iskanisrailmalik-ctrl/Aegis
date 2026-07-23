/**
 * Loan / EMI tracking logic.
 * - Given a parsed EMI SMS, find a matching LoanAccount or auto-create a draft.
 * - Provides upcoming EMIs and overdue detection.
 */

import { db } from "@/lib/db";
import { ParsedFields } from "./bank-rules";
import { ParseResult } from "./parser";

export interface LoanMatchResult {
  loanId?: string;
  created: boolean;
  lender: string;
}

/** Find or create a loan account from a parsed EMI SMS. */
export async function matchOrCreateLoan(
  parse: ParseResult,
  sender?: string
): Promise<LoanMatchResult | null> {
  if (!parse.isEmi) return null;

  const lender =
    parse.bankName ||
    parse.fields.merchant ||
    (sender ? sender.replace(/[^A-Za-z]/g, "") : undefined) ||
    "Unknown Lender";

  const loanRef = parse.fields.loanId || parse.fields.card || undefined;
  const emiAmount = parse.fields.emiAmount;
  const dueDate = parse.fields.dueDate ? new Date(parse.fields.dueDate) : undefined;

  // Try to match by lender + loanRef
  let loan: Awaited<ReturnType<typeof db.loanAccount.findFirst>> = null;
  if (loanRef) {
    loan = await db.loanAccount.findFirst({
      where: { lender, loanRef },
    });
  }
  if (!loan) {
    loan = await db.loanAccount.findFirst({
      where: { lender, emiAmount: emiAmount ?? undefined },
    });
  }

  if (loan) {
    // update emiAmount / dueDay if newly known
    const data: Record<string, unknown> = {};
    if (emiAmount && !loan.emiAmount) data.emiAmount = emiAmount;
    if (loanRef && !loan.loanRef) data.loanRef = loanRef;
    if (dueDate && !loan.dueDay) data.dueDay = dueDate.getDate();
    if (Object.keys(data).length > 0) {
      await db.loanAccount.update({ where: { id: loan.id }, data });
    }
    return { loanId: loan.id, created: false, lender };
  }

  // Create draft loan
  const created = await db.loanAccount.create({
    data: {
      lender,
      loanType: "personal",
      loanRef,
      emiAmount,
      dueDay: dueDate ? dueDate.getDate() : null,
      status: "active",
    },
  });
  return { loanId: created.id, created: true, lender };
}

export interface UpcomingEmi {
  id: string;
  lender: string;
  loanType: string;
  emiAmount: number | null;
  dueDay: number | null;
  // computed next due date
  nextDue: Date;
  overdue: boolean;
  status: string;
}

/** Compute upcoming EMIs across active loans. */
export async function getUpcomingEmis(): Promise<UpcomingEmi[]> {
  const loans = await db.loanAccount.findMany({
    where: { status: { in: ["active", "overdue"] } },
  });
  const now = new Date();
  const out: UpcomingEmi[] = [];

  // Batch query: get all recent transactions for all active loans in ONE query
  // instead of N+1 individual queries per loan
  const loanIds = loans.filter(l => l.dueDay).map(l => l.id);
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

  const recentTxMap = new Map<string, boolean>();
  if (loanIds.length > 0) {
    const recentTxs = await db.transaction.findMany({
      where: {
        loanId: { in: loanIds },
        txDate: { gte: thirtyFiveDaysAgo },
      },
      select: { loanId: true },
    });
    for (const tx of recentTxs) {
      if (tx.loanId) recentTxMap.set(tx.loanId, true);
    }
  }

  for (const l of loans) {
    if (!l.dueDay) continue;
    let next = new Date(now.getFullYear(), now.getMonth(), l.dueDay);
    if (next < now) {
      // next month
      next = new Date(now.getFullYear(), now.getMonth() + 1, l.dueDay);
    }
    // overdue if the previous due date passed and no transaction linked in last 35 days
    const prevDue = new Date(now.getFullYear(), now.getMonth() - 1, l.dueDay);
    const hasRecentLinked = recentTxMap.get(l.id) ?? false;
    const overdue = !hasRecentLinked && now.getTime() - prevDue.getTime() > 7 * 24 * 60 * 60 * 1000;
    out.push({
      id: l.id,
      lender: l.lender,
      loanType: l.loanType,
      emiAmount: l.emiAmount,
      dueDay: l.dueDay,
      nextDue: next,
      overdue,
      status: overdue ? "overdue" : l.status,
    });
  }
  return out.sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime());
}

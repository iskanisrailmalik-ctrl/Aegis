/**
 * Overdue EMI detection (Main plan Section 5).
 *
 * Detects when an expected EMI debit SMS didn't arrive by the due date.
 * Uses the loan's due day + EMI amount to predict expected payments,
 * then checks if a matching transaction was recorded.
 *
 * Fully on-device — no external credit bureau data needed.
 */

import { db } from "@/lib/db";

export interface OverdueEmi {
  loanId: string;
  lender: string;
  emiAmount: number;
  expectedDate: Date;
  daysOverdue: number;
  severity: "recent" | "overdue" | "critical";
}

/**
 * Detect overdue EMIs by checking if expected payments were received.
 * Looks back up to 60 days for missed EMI payments.
 *
 * Optimized: Uses batch queries instead of N+1 per-loan queries.
 */
export async function detectOverdueEmis(): Promise<OverdueEmi[]> {
  const loans = await db.loanAccount.findMany({
    where: { status: { in: ["active", "overdue"] } },
  });

  const now = new Date();
  const overdueList: OverdueEmi[] = [];

  // Build all expected due dates for all loans
  type ExpectedPayment = { loanId: string; lender: string; emiAmount: number; dueDate: Date; loan: typeof loans[0] };
  const expectedPayments: ExpectedPayment[] = [];

  for (const loan of loans) {
    if (!loan.emiAmount || !loan.dueDay) continue;
    for (let monthOffset = 0; monthOffset >= -1; monthOffset--) {
      const dueDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, loan.dueDay);
      if (dueDate > now) continue;
      expectedPayments.push({ loanId: loan.id, lender: loan.lender, emiAmount: loan.emiAmount, dueDate, loan });
    }
  }

  if (expectedPayments.length === 0) return [];

  // Batch query: find ALL transactions that match ANY expected EMI in one query
  // Build OR conditions for each expected payment
  const orConditions = expectedPayments.map(ep => ({
    loanId: ep.loanId,
    txDate: {
      gte: new Date(ep.dueDate.getTime() - 5 * 24 * 60 * 60 * 1000),
      lte: new Date(ep.dueDate.getTime() + 5 * 24 * 60 * 60 * 1000),
    },
    amount: {
      gte: ep.emiAmount - 1,
      lte: ep.emiAmount + 1,
    },
  }));

  const matchingTxs = await db.transaction.findMany({
    where: { OR: orConditions },
    select: { loanId: true, txDate: true, amount: true },
  });

  // Build a set of "loanId + month" that have matching transactions
  const matchedSet = new Set<string>();
  for (const tx of matchingTxs) {
    const monthKey = `${tx.loanId}_${tx.txDate.getFullYear()}_${tx.txDate.getMonth()}`;
    matchedSet.add(monthKey);
  }

  for (const ep of expectedPayments) {
    const monthKey = `${ep.loanId}_${ep.dueDate.getFullYear()}_${ep.dueDate.getMonth()}`;
    if (matchedSet.has(monthKey)) continue; // Found a matching transaction

    const daysOverdue = Math.floor(
      (now.getTime() - ep.dueDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysOverdue >= 3) {
      let severity: OverdueEmi["severity"] = "recent";
      if (daysOverdue >= 15) severity = "critical";
      else if (daysOverdue >= 7) severity = "overdue";

      const exists = overdueList.some(
        (o) =>
          o.loanId === ep.loanId &&
          o.expectedDate.getMonth() === ep.dueDate.getMonth() &&
          o.expectedDate.getFullYear() === ep.dueDate.getFullYear()
      );

      if (!exists) {
        overdueList.push({
          loanId: ep.loanId,
          lender: ep.lender,
          emiAmount: ep.emiAmount,
          expectedDate: ep.dueDate,
          daysOverdue,
          severity,
        });
      }
    }
  }

  // Sort by severity (critical first), then by days overdue
  const severityOrder = { critical: 0, overdue: 1, recent: 2 };
  return overdueList.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.daysOverdue - a.daysOverdue;
  });
}

/**
 * Update loan statuses based on overdue detection.
 * Marks loans as "overdue" if they have critical missed payments.
 */
export async function updateLoanStatuses(): Promise<number> {
  const overdue = await detectOverdueEmis();
  let updated = 0;

  const criticalLoanIds = new Set(
    overdue.filter((o) => o.severity === "critical").map((o) => o.loanId)
  );

  for (const loanId of criticalLoanIds) {
    const loan = await db.loanAccount.findUnique({ where: { id: loanId } });
    if (loan && loan.status !== "overdue") {
      await db.loanAccount.update({
        where: { id: loanId },
        data: { status: "overdue" },
      });
      updated++;
    }
  }

  return updated;
}

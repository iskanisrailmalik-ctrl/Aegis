import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List all goals with computed progress.
 * Progress for "savings" goals = net (credited - debited) since goal creation.
 * Progress for "income" goals = total credited since goal creation.
 * Progress for "debt" goals = total EMI/debt-category debits since goal creation.
 */
export async function GET() {
  try {
    const goals = await db.goal.findMany({
      orderBy: { createdAt: "desc" },
      include: { milestones: true },
    });

    // Get all verified transactions
    const txs = await db.transaction.findMany({
      where: { classification: "verified" },
      select: { type: true, amount: true, category: true, txDate: true },
    });

    const result = goals.map((g) => {
      // Progress computed from ALL verified transactions (cumulative since app start).
      // This makes goals meaningful immediately rather than requiring new transactions
      // after goal creation.
      let progress = 0;
      if (g.goalType === "savings") {
        const credited = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
        const debited = txs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
        progress = credited - debited;
      } else if (g.goalType === "income") {
        progress = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
      } else if (g.goalType === "debt") {
        progress = txs
          .filter((t) => t.type === "debit" && (t.category === "emi" || t.category === "bills"))
          .reduce((s, t) => s + t.amount, 0);
      }

      const pct = g.target > 0 ? Math.min(100, Math.round((progress / g.target) * 100)) : 0;
      const completed = progress >= g.target;

      // days remaining (if deadline set)
      let daysLeft: number | null = null;
      if (g.deadline) {
        const ms = g.deadline.getTime() - Date.now();
        daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
      }

      // milestones with completion status
      const milestones = (g.milestones ?? [])
        .map((m) => ({
          id: m.id,
          name: m.name,
          target: m.target,
          completed: progress >= m.target,
          pct: m.target > 0 ? Math.min(100, Math.round((progress / m.target) * 100)) : 0,
        }))
        .sort((a, b) => a.target - b.target);

      return {
        id: g.id,
        name: g.name,
        target: g.target,
        goalType: g.goalType,
        deadline: g.deadline?.toISOString() ?? null,
        status: g.status,
        progress,
        pct,
        completed,
        remaining: Math.max(0, g.target - progress),
        daysLeft,
        createdAt: g.createdAt.toISOString(),
        milestones,
      };
    });

    return NextResponse.json({ goals: result });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, target, goalType, deadline, status } = body as {
      name: string;
      target: number;
      goalType?: string;
      deadline?: string;
      status?: string;
    };
    if (!name || typeof target !== "number" || target <= 0) {
      return NextResponse.json(
        { error: "Missing name or invalid target" },
        { status: 400 }
      );
    }
    const goal = await db.goal.create({
      data: {
        name: name.trim(),
        target,
        goalType: goalType ?? "savings",
        deadline: deadline ? new Date(deadline) : null,
        status: status ?? "active",
      },
    });
    return NextResponse.json(goal);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

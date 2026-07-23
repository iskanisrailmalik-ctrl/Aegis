import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export full database as JSON (backup). */
export async function GET() {
  try {
    const [transactions, loans, flagged, settings, budgets, overrides] = await Promise.all([
      db.transaction.findMany(),
      db.loanAccount.findMany(),
      db.flaggedMessage.findMany(),
      db.setting.findMany(),
      db.budget.findMany(),
      db.merchantOverride.findMany(),
    ]);

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "Aegis",
      data: {
        transactions,
        loans,
        flagged,
        settings,
        budgets,
        merchantOverrides: overrides,
      },
      counts: {
        transactions: transactions.length,
        loans: loans.length,
        flagged: flagged.length,
        settings: settings.length,
        budgets: budgets.length,
        merchantOverrides: overrides.length,
      },
    };

    const fname = `sms-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
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

/** Import JSON backup (restore). Clears existing data first if clear=true. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clear = body.__clear === true;
    const backup = body.data ?? body;

    if (!backup || typeof backup !== "object") {
      return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
    }

    const data = backup.data ?? backup;

    if (clear) {
      await db.transaction.deleteMany({});
      await db.flaggedMessage.deleteMany({});
      await db.loanAccount.deleteMany({});
      await db.budget.deleteMany({});
      await db.merchantOverride.deleteMany({});
      await db.setting.deleteMany({});
    }

    const counts = {
      transactions: 0,
      loans: 0,
      flagged: 0,
      settings: 0,
      budgets: 0,
      overrides: 0,
    };

    // Settings (upsert to avoid conflicts)
    if (Array.isArray(data.settings)) {
      for (const s of data.settings) {
        if (!s.key || s.value === undefined) continue;
        await db.setting.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value },
        });
        counts.settings++;
      }
    }

    // Budgets (upsert by category)
    if (Array.isArray(data.budgets)) {
      for (const b of data.budgets) {
        if (!b.category || typeof b.amount !== "number") continue;
        await db.budget.upsert({
          where: { category: b.category },
          update: { amount: b.amount },
          create: { category: b.category, amount: b.amount },
        });
        counts.budgets++;
      }
    }

    // Merchant overrides (upsert by merchant)
    if (Array.isArray(data.merchantOverrides)) {
      for (const o of data.merchantOverrides) {
        if (!o.merchant || !o.category) continue;
        await db.merchantOverride.upsert({
          where: { merchant: o.merchant },
          update: { category: o.category },
          create: { merchant: o.merchant, category: o.category },
        });
        counts.overrides++;
      }
    }

    // Loans (create with original IDs if not already present)
    if (Array.isArray(data.loans)) {
      for (const l of data.loans) {
        if (!l.lender) continue;
        const existing = await db.loanAccount.findUnique({ where: { id: l.id } });
        if (existing) continue;
        await db.loanAccount.create({
          data: {
            id: l.id,
            lender: l.lender,
            loanType: l.loanType ?? "personal",
            loanRef: l.loanRef ?? null,
            principal: l.principal ?? null,
            emiAmount: l.emiAmount ?? null,
            dueDay: l.dueDay ?? null,
            tenure: l.tenure ?? null,
            startDate: l.startDate ? new Date(l.startDate) : null,
            status: l.status ?? "active",
          },
        });
        counts.loans++;
      }
    }

    // Transactions (create with original IDs)
    if (Array.isArray(data.transactions)) {
      for (const t of data.transactions) {
        if (!t.type || typeof t.amount !== "number") continue;
        const existing = await db.transaction.findUnique({ where: { id: t.id } });
        if (existing) continue;
        await db.transaction.create({
          data: {
            id: t.id,
            type: t.type,
            amount: t.amount,
            merchant: t.merchant ?? null,
            accountMasked: t.accountMasked ?? null,
            balance: t.balance ?? null,
            txDate: t.txDate ? new Date(t.txDate) : new Date(),
            bank: t.bank ?? null,
            sender: t.sender ?? null,
            senderType: t.senderType ?? "unknown",
            category: t.category ?? null,
            classification: t.classification ?? "verified",
            rawMessage: t.rawMessage ?? "",
            loanId: t.loanId ?? null,
            extra: t.extra ?? null,
            receivedAt: t.receivedAt ? new Date(t.receivedAt) : new Date(),
          },
        });
        counts.transactions++;
      }
    }

    // Flagged messages
    if (Array.isArray(data.flagged)) {
      for (const f of data.flagged) {
        if (!f.content) continue;
        const existing = await db.flaggedMessage.findUnique({ where: { id: f.id } });
        if (existing) continue;
        await db.flaggedMessage.create({
          data: {
            id: f.id,
            sender: f.sender ?? null,
            content: f.content,
            classification: f.classification ?? "flagged",
            reason: f.reason ?? "",
            signals: f.signals ?? null,
            receivedAt: f.receivedAt ? new Date(f.receivedAt) : new Date(),
          },
        });
        counts.flagged++;
      }
    }

    return NextResponse.json({ ok: true, imported: counts, cleared: clear });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { detectRecurring, monthlyRecurringTotal } from "@/lib/sms/recurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const groups = await detectRecurring(2);
    const monthlyTotal = monthlyRecurringTotal(groups);
    return NextResponse.json({ groups, monthlyTotal, count: groups.length });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

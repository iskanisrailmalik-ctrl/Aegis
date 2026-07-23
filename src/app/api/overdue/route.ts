import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { detectOverdueEmis, updateLoanStatuses } from "@/lib/sms/overdue-detection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Detect overdue EMIs (expected payments that didn't arrive). */
export async function GET() {
  try {
    const overdue = await detectOverdueEmis();
    return NextResponse.json({ overdue, count: overdue.length });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/** Update loan statuses based on overdue detection. */
export async function POST() {
  try {
    const updated = await updateLoanStatuses();
    const overdue = await detectOverdueEmis();
    return NextResponse.json({ updated, overdue, count: overdue.length });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { createSubmission, getPendingSubmissions, updateSubmissionStatus, exportSubmissions } from "@/lib/sms/crowdsourcing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List pending format submissions. */
export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get("action");
    if (action === "export") {
      const json = await exportSubmissions();
      return new NextResponse(json, {
        headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=sms-format-submissions.json" },
      });
    }
    const submissions = await getPendingSubmissions();
    return NextResponse.json({ submissions, count: submissions.length });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/** Create a format submission from an unparsed SMS. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { smsMessageId } = body as { smsMessageId: string };
    if (!smsMessageId) return NextResponse.json({ error: "Missing smsMessageId" }, { status: 400 });
    const submission = await createSubmission(smsMessageId);
    return NextResponse.json(submission);
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/** Update submission status (submit/reject). */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body as { id: string; status: "pending" | "submitted" | "rejected" };
    await updateSubmissionStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

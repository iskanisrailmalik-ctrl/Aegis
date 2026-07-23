import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";
import { answerQuery } from "@/lib/sms/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ask a natural-language question (Tier 2 intelligence engine). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question } = body as { question: string };
    if (!question || !question.trim()) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const result = await answerQuery(question.trim());

    // Save to query history
    const history = await db.queryHistory.create({
      data: {
        question: question.trim(),
        answer: result.answer,
        sourceIds: JSON.stringify(result.sourceIds),
        confidence: result.confidence,
      },
    });

    return NextResponse.json({ ...result, historyId: history.id });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

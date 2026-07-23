import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestDocument } from "@/lib/sms/enhanced-ingestion";
import { sanitizeError } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enhanced document ingestion endpoint.
 * Uses the RAG-enhanced pipeline to extract ALL information from uploaded documents
 * and feed it to all relevant components (loans, transactions, messages, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, content, documentType, sourceInstitution } = body as {
      fileName: string;
      content: string;
      documentType?: string;
      sourceInstitution?: string;
    };

    if (!fileName || !content) {
      return NextResponse.json(
        { error: "Missing fileName or content" },
        { status: 400 }
      );
    }

    const result = await ingestDocument({
      fileName,
      content,
      documentType,
      sourceInstitution,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

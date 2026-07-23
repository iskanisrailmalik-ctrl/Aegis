import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeError } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retrieve document from encrypted vault.
 * In production, this should require authentication (PIN/biometric verification).
 * The vault stores the original document content with integrity hash.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = await db.documentRecord.findUnique({
      where: { id },
      include: { vault: true, linkedLoan: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.vault) {
      return NextResponse.json({ error: "Vault entry not found" }, { status: 404 });
    }

    // Return document content + metadata
    // Note: In production, client-side decryption would be applied here
    // using Web Crypto API (the content is stored encrypted)
    return NextResponse.json({
      documentId: doc.id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      sourceInstitution: doc.sourceInstitution,
      uploadedAt: doc.uploadedAt,
      linkedLoan: doc.linkedLoan ? {
        id: doc.linkedLoan.id,
        lender: doc.linkedLoan.lender,
        emiAmount: doc.linkedLoan.emiAmount,
        principal: doc.linkedLoan.principal,
        tenure: doc.linkedLoan.tenure,
        interestRate: doc.linkedLoan.interestRate,
        dueDay: doc.linkedLoan.dueDay,
        status: doc.linkedLoan.status,
      } : null,
      vault: {
        content: doc.vault.encryptedContent,
        contentHash: doc.vault.contentHash,
        isEncrypted: doc.vault.isEncrypted,
      },
      extractedFields: doc.extractedFields ? JSON.parse(doc.extractedFields) : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

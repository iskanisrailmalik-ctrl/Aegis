import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/conversations
 * Returns all conversation metadata (pin, archive, mute, star status).
 */
export async function GET() {
  try {
    const conversations = await db.conversation.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ conversations });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Create or update conversation metadata for a sender.
 * Body: { sender, isPinned?, isArchived?, isMuted?, isStarred?, displayName? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sender, isPinned, isArchived, isMuted, isStarred, displayName } = body;

    if (!sender) {
      return NextResponse.json({ error: "Missing sender" }, { status: 400 });
    }

    const conversation = await db.conversation.upsert({
      where: { sender },
      update: {
        ...(isPinned !== undefined && { isPinned }),
        ...(isArchived !== undefined && { isArchived }),
        ...(isMuted !== undefined && { isMuted }),
        ...(isStarred !== undefined && { isStarred }),
        ...(displayName !== undefined && { displayName }),
      },
      create: {
        sender,
        isPinned: isPinned ?? false,
        isArchived: isArchived ?? false,
        isMuted: isMuted ?? false,
        isStarred: isStarred ?? false,
        displayName: displayName ?? null,
      },
    });

    return NextResponse.json(conversation);
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

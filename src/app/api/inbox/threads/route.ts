import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Get SMS threads grouped by sender — like a messaging app's conversation list.
 */
export async function GET() {
  try {
    const messages = await db.smsMessage.findMany({
      orderBy: { receivedAt: "desc" },
      take: 500,
    });

    // Group by sender
    const threadMap = new Map<string, {
      sender: string;
      lastMessage: string;
      lastDate: Date;
      messageCount: number;
      unreadCount: number;
      classification: string;
      messages: typeof messages;
    }>();

    for (const msg of messages) {
      const key = msg.sender ?? "Unknown";
      const existing = threadMap.get(key);
      if (existing) {
        existing.messages.push(msg);
        existing.messageCount++;
        if (msg.receivedAt > existing.lastDate) {
          existing.lastDate = msg.receivedAt;
          existing.lastMessage = msg.rawText;
          existing.classification = msg.classification;
        }
      } else {
        threadMap.set(key, {
          sender: key,
          lastMessage: msg.rawText,
          lastDate: msg.receivedAt,
          messageCount: 1,
          unreadCount: 0,
          classification: msg.classification,
          messages: [msg],
        });
      }
    }

    const threads = Array.from(threadMap.values())
      .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());

    return NextResponse.json({ threads, total: threads.length });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeError(e) },
      { status: 500 }
    );
  }
}

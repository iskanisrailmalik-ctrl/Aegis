import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}
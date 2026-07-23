import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-security";
import { getRegistryVersion, exportRegistry, importRegistry, addCustomRule, getCustomRules } from "@/lib/sms/registry-versioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Get registry version + custom rules count. */
export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get("action");
    if (action === "export") {
      const json = await exportRegistry();
      return new NextResponse(json, {
        headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=bank-rule-registry.json" },
      });
    }
    const version = await getRegistryVersion();
    const customRules = await getCustomRules();
    return NextResponse.json({ version, customRulesCount: customRules.length });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

/** Import a registry bundle or add a custom rule. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.bundle) {
      const result = await importRegistry(body.bundle);
      return NextResponse.json(result);
    }
    if (body.rule) {
      await addCustomRule(body.rule);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Missing bundle or rule" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

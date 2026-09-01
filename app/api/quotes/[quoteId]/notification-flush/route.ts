import { NextResponse } from "next/server";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { runQuoteResponseNotificationFlush } from "@/lib/quotes/notification-flush";
import { isQuoteResponseNotificationFlushContext } from "@/lib/quotes/notification-flush-core";

export const runtime = "nodejs";

function adminJwtRole(): string | null {
  const token = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    ) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : "unknown";
  } catch {
    return "invalid_jwt";
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ quoteId: string }> }
) {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { quoteId } = await context.params;
  if (
    !isQuoteResponseNotificationFlushContext({
      quoteId,
      orgId: auth.orgId,
    })
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data: quote } = await auth.supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  try {
    const result = await runQuoteResponseNotificationFlush({
      quoteId,
      orgId: auth.orgId,
    });
    return NextResponse.json({
      ok: true,
      result,
      admin_role: adminJwtRole(),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

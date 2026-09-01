import { NextResponse } from "next/server";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { runQuoteResponseNotificationFlush } from "@/lib/quotes/notification-flush";
import { isQuoteResponseNotificationFlushContext } from "@/lib/quotes/notification-flush-core";

export const runtime = "nodejs";

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
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

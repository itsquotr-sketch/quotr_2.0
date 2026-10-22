import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  MARKETING_LOOPS_RETRY_LIMIT,
  marketingLoopsAllowsEmail,
  marketingLoopsRetriesExistingPending,
  marketingLoopsScope,
  PREVIEW_LOOPS_TEST_EMAIL,
} from "@/lib/communications/loops-automation";
import { readLoopsApiKey } from "@/lib/communications/loops-client";
import { syncPendingMarketingContacts } from "@/lib/communications/pending-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Daily Hobby cron. One run, at most two pending contacts.
 * Existing pending rows are skipped unless MARKETING_LOOPS_RETRY_EXISTING=true.
 * Preview can sync only hello+test@erccontracting.co.nz.
 * Production refuses the Preview database.
 * Vercel calls this on Production only. An unset CRON_SECRET refuses.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const scope = marketingLoopsScope(process.env);
  if (scope === "off") {
    return NextResponse.json({ ok: true, ran: false });
  }

  const apiKey = readLoopsApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: true, ran: false });
  }

  const includeExisting = marketingLoopsRetriesExistingPending(process.env);
  const email = scope === "preview" ? PREVIEW_LOOPS_TEST_EMAIL : undefined;
  if (email && !marketingLoopsAllowsEmail(scope, email)) {
    return NextResponse.json({ ok: true, ran: false });
  }

  try {
    const result = await syncPendingMarketingContacts({
      admin: createAdminClient(),
      apiKey,
      email,
      limit: MARKETING_LOOPS_RETRY_LIMIT,
      autoRetryOnly: !includeExisting,
    });
    return NextResponse.json({
      ok: true,
      ran: true,
      examined: result.examined,
      cleared: result.cleared,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

function cronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (expected.length < 16 || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

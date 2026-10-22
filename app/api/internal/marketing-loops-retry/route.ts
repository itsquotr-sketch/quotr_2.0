import { NextResponse } from "next/server";
import {
  cronAuthorizationMatches,
  MARKETING_LOOPS_RETRY_BATCH,
  MARKETING_LOOPS_RETRY_CONCURRENCY,
  marketingLoopsAllowsEmail,
  marketingLoopsRetriesExistingPending,
  marketingLoopsScope,
  PREVIEW_LOOPS_TEST_EMAIL,
} from "@/lib/communications/loops-automation";
import { readLoopsApiKey } from "@/lib/communications/loops-client";
import { syncPendingMarketingContacts } from "@/lib/communications/pending-sync";
import { releaseDueEngagementReminders } from "@/lib/communications/reminder-schedule";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Invoked by Supabase pg_cron every five minutes.
 * Existing pending rows are skipped unless MARKETING_LOOPS_RETRY_EXISTING=true.
 * Preview can sync only hello+test@erccontracting.co.nz.
 * Production refuses the Preview database.
 * An unset or wrong CRON_SECRET refuses. The secret is not logged.
 */
export async function GET(request: Request) {
  if (!cronAuthorizationMatches(process.env.CRON_SECRET, request.headers.get("authorization"))) {
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
      limit: MARKETING_LOOPS_RETRY_BATCH,
      autoRetryOnly: !includeExisting,
      scheduled: true,
      concurrency: MARKETING_LOOPS_RETRY_CONCURRENCY,
    });
    let reminders = { released: 0, postponed: 0, suppressed: 0 };
    try {
      reminders = await releaseDueEngagementReminders({
        admin: createAdminClient(),
        apiKey,
        limit: 4,
      });
    } catch {
      reminders = { released: 0, postponed: 0, suppressed: 0 };
    }
    return NextResponse.json({
      ok: true,
      ran: true,
      examined: result.examined,
      cleared: result.cleared,
      failed: result.failed,
      skipped: result.skipped,
      deferred: result.deferred,
      reminders,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

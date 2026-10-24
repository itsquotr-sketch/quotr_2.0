import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendPreviewPlanConfirmationTest } from "@/lib/billing/plan-confirmation-delivery";
import {
  isWebsiteBillingUrl,
  PLAN_CONFIRMATION_PREVIEW_TEST_FACTS,
} from "@/lib/billing/plan-confirmation";
import { billingPortalReturnUrl } from "@/lib/billing/urls";
import { PREVIEW_SUPABASE_PROJECT_REF } from "@/lib/deployment/environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_HEADER = "x-quotr-plan-confirmation-test";

function hidden() {
  return NextResponse.json({ ok: false }, { status: 404 });
}

function tokenMatches(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length < 24 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function previewDatabase(): boolean {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  try {
    return new URL(raw).hostname.startsWith(`${PREVIEW_SUPABASE_PROJECT_REF}.`);
  } catch {
    return false;
  }
}

/**
 * One Preview plan-confirmation check. Not a public sender.
 * Missing preview, the preview database, or the test token is a 404.
 * The recipient and synthetic details are fixed. The body is ignored.
 */
export async function GET() {
  return hidden();
}

export async function POST(request: Request) {
  await request.text();
  if (process.env.VERCEL_ENV !== "preview") return hidden();
  if (!previewDatabase()) return hidden();
  if (process.env.QUOTE_DELIVERY_PROVIDER === "mock") return hidden();

  const expected = process.env.PLAN_CONFIRMATION_PREVIEW_TEST_TOKEN?.trim() ?? "";
  const provided = request.headers.get(TOKEN_HEADER)?.trim() ?? "";
  if (!tokenMatches(expected, provided)) return hidden();

  let billingUrl = "";
  try {
    billingUrl = billingPortalReturnUrl();
  } catch {
    return NextResponse.json({ ok: false, outcome: "failed", errorCode: "billing_url" }, { status: 500 });
  }
  if (!isWebsiteBillingUrl(billingUrl)) {
    return NextResponse.json({ ok: false, outcome: "failed", errorCode: "billing_url" }, { status: 500 });
  }

  try {
    const result = await sendPreviewPlanConfirmationTest({
      ...PLAN_CONFIRMATION_PREVIEW_TEST_FACTS,
      billingUrl,
    });
    if (!result.recipientMatched || result.outcome === "refused") {
      return NextResponse.json({ ok: false, outcome: "refused" }, { status: 409 });
    }
    return NextResponse.json({
      ok: result.outcome === "accepted" || result.outcome === "skipped_accepted",
      outcome: result.outcome,
      providerMessageId: result.providerMessageId,
      idempotencyKey: result.idempotencyKey,
      errorCode: result.errorCode ?? null,
    });
  } catch {
    return NextResponse.json({ ok: false, outcome: "failed", errorCode: "failed" }, { status: 500 });
  }
}

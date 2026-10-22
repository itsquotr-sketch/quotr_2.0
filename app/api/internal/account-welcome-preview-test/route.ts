import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendPreviewAccountWelcomeTest } from "@/lib/auth/account-welcome-delivery";
import { PREVIEW_SUPABASE_PROJECT_REF } from "@/lib/deployment/environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_HEADER = "x-quotr-welcome-test";

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
 * One Preview welcome-email check. Not a public sender.
 * Missing preview, the preview database, or the test token is a 404.
 * The recipient is fixed in the database function. This route ignores
 * any address in the query or body and does not change confirmation.
 */
export async function GET() {
  return hidden();
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return hidden();
  if (!previewDatabase()) return hidden();
  if (process.env.QUOTE_DELIVERY_PROVIDER === "mock") return hidden();

  const expected = process.env.ACCOUNT_WELCOME_PREVIEW_TEST_TOKEN?.trim() ?? "";
  const provided = request.headers.get(TOKEN_HEADER)?.trim() ?? "";
  if (!tokenMatches(expected, provided)) return hidden();

  try {
    const result = await sendPreviewAccountWelcomeTest();
    if (result.outcome === "failed") {
      return NextResponse.json({
        ok: false,
        outcome: "failed",
        errorCode: result.errorCode ?? "send",
        from: result.from,
        idempotencyKey: result.idempotencyKey,
        providerMessageId: result.providerMessageId,
        identified: "preview_test",
        providerAccepted: false,
        deliveryConfirmed: false,
      });
    }
    if (!result.recipientMatched || result.outcome === "refused") {
      return NextResponse.json({ ok: false, outcome: "refused" }, { status: 409 });
    }
    return NextResponse.json({
      ok: result.outcome === "accepted" || result.outcome === "skipped_accepted",
      outcome: result.outcome,
      providerMessageId: result.providerMessageId,
      idempotencyKey: result.idempotencyKey,
      from: result.from,
      identified: "preview_test",
      providerAccepted:
        result.outcome === "accepted" ||
        result.outcome === "accepted_unacked" ||
        result.outcome === "skipped_accepted",
      deliveryConfirmed: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorCode = message.startsWith("WELCOME_") ? message : "failed";
    return NextResponse.json(
      { ok: false, outcome: "failed", errorCode },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { parseOptionalEmailSend, verifyLoopsWebhookSignature } from "@/lib/communications/loops-webhook";
import { logLoopsFailure } from "@/lib/communications/loops-client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records an actual Loops workflow send for the 48-hour limit.
 * Unsigned calls are refused. The address is not stored or logged.
 * The live workflow is not changed here.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.LOOPS_WEBHOOK_SECRET?.trim() ?? "";
  const webhookId = request.headers.get("webhook-id") ?? "";
  const accepted = verifyLoopsWebhookSignature({
    secret,
    webhookId,
    webhookTimestamp: request.headers.get("webhook-timestamp") ?? "",
    signatureHeader: request.headers.get("webhook-signature") ?? "",
    rawBody,
  });
  if (!accepted) return NextResponse.json({ ok: false }, { status: 401 });

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (
    event &&
    typeof event === "object" &&
    (event as { eventName?: unknown }).eventName === "testing.testEvent"
  ) {
    return NextResponse.json({ ok: true });
  }

  const send = parseOptionalEmailSend(event);
  if (!send || !webhookId.trim()) return NextResponse.json({ ok: true });

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("marketing_optional_email_sends").insert({
      webhook_id: webhookId.trim(),
      user_id: send.userId,
      workflow_id: send.workflowId,
      sent_at: new Date(send.sentAtMs).toISOString(),
    });
    if (error && error.code !== "23505" && error.code !== "23503") {
      logLoopsFailure("optional_send_record_failed");
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } catch {
    logLoopsFailure("optional_send_record_failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  digestWebhookPayload,
  mapResendEventToDeliveryStatus,
  mapResendEventToNotificationDeliveryStatus,
  nextDeliveryStatusFromWebhook,
  nextNotificationDeliveryStatusFromWebhook,
  verifyResendWebhookSignature,
} from "@/lib/quotes/delivery-webhooks";
import { isMissingNotificationTableError } from "@/lib/quotes/notifications";

export async function POST(request: Request) {
  const payload = await request.text();
  const valid = verifyResendWebhookSignature({
    payload,
    svixId: request.headers.get("svix-id"),
    svixTimestamp: request.headers.get("svix-timestamp"),
    svixSignature: request.headers.get("svix-signature"),
    secret: process.env.RESEND_WEBHOOK_SECRET ?? null,
  });
  if (!valid) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const type = typeof event.type === "string" ? event.type : "";
  const data =
    event.data && typeof event.data === "object"
      ? (event.data as Record<string, unknown>)
      : {};
  const providerMessageId =
    typeof data.email_id === "string" ? data.email_id : null;
  const providerEventId = request.headers.get("svix-id") ?? "";
  if (!providerEventId || !type) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const incoming = mapResendEventToDeliveryStatus(type);
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data: delivery } = providerMessageId
    ? await admin
        .from("quote_deliveries")
        .select("id, status")
        .eq("provider", "resend")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle()
    : { data: null };

  const { data: existing } = await admin
    .from("quote_delivery_webhook_receipts")
    .select("id")
    .eq("provider", "resend")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (!existing) {
    const { error: receiptError } = await admin
      .from("quote_delivery_webhook_receipts")
      .insert({
        provider: "resend",
        provider_event_id: providerEventId,
        provider_message_id: providerMessageId,
        delivery_id: delivery?.id ?? null,
        event_type: type,
        payload_digest: digestWebhookPayload(payload),
      });
    if (receiptError && receiptError.code !== "23505") {
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (delivery && incoming) {
    const next = nextDeliveryStatusFromWebhook(
      delivery.status as never,
      incoming
    );
    const patch: Record<string, unknown> = { status: next };
    if (next === "delivered") patch.delivered_at = new Date().toISOString();
    if (next === "failed" || next === "bounced" || next === "complained") {
      patch.failed_at = new Date().toISOString();
      patch.failure_code = type;
    }
    await admin.from("quote_deliveries").update(patch).eq("id", delivery.id);
  }

  if (providerMessageId) {
    const incomingNotification =
      mapResendEventToNotificationDeliveryStatus(type);
    const { data: notificationDelivery, error: notificationError } = await admin
      .from("notification_deliveries")
      .select("id, status")
      .eq("provider", "resend")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();
    if (
      notificationError &&
      !isMissingNotificationTableError(notificationError)
    ) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    if (notificationDelivery && incomingNotification) {
      const next = nextNotificationDeliveryStatusFromWebhook(
        notificationDelivery.status as never,
        incomingNotification
      );
      const notificationPatch: Record<string, unknown> = { status: next };
      if (next === "delivered") {
        notificationPatch.delivered_at = new Date().toISOString();
      }
      if (next === "failed") {
        notificationPatch.failed_at = new Date().toISOString();
        notificationPatch.last_error_safe = "Email could not be delivered.";
      }
      await admin
        .from("notification_deliveries")
        .update(notificationPatch)
        .eq("id", notificationDelivery.id);
    }
  }

  return NextResponse.json({ ok: true, duplicate: Boolean(existing) });
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  quoteDeliveryFromAddress,
  quoteDeliverySiteOrigin,
} from "@/lib/quotes/delivery-email";
import {
  hashQuoteAccessToken,
  quotePublicPath,
} from "@/lib/quotes/delivery-token";
import { getCompanyDisplayName } from "@/lib/quotes/display";
import {
  parseQuoteIssuerSnapshot,
  resolveQuoteIssuerSettings,
} from "@/lib/quotes/issuer-snapshot";
import {
  isMissingNotificationTableError,
  type QuoteNotificationEmailKind,
} from "@/lib/quotes/notifications";
import {
  buildQuoteResponseNotificationEmail,
  quoteResponseNotificationFromHeader,
} from "@/lib/quotes/notification-email";

function payloadString(
  payload: Record<string, unknown>,
  key: string
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function payloadNumber(
  payload: Record<string, unknown>,
  key: string
): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function sendPendingDeliveriesForQuote(input: {
  quoteId: string;
  orgId: string;
  publicPath?: string | null;
}): Promise<void> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const { data: notifications, error: notificationError } = await admin
    .from("notifications")
    .select("id, payload")
    .eq("org_id", input.orgId)
    .eq("resource_id", input.quoteId);
  if (notificationError) {
    if (!isMissingNotificationTableError(notificationError)) {
      return;
    }
    return;
  }
  if (!notifications?.length) return;

  const notificationIds = notifications.map((row) => row.id as string);
  const { data: rows, error } = await admin
    .from("notification_deliveries")
    .select(
      "id, org_id, notification_id, email_kind, recipient_email, status, idempotency_key, action_url, attempt_count"
    )
    .in("notification_id", notificationIds)
    .in("status", ["pending", "failed"])
    .eq("channel", "email")
    .order("created_at", { ascending: true });
  if (error || !rows?.length) return;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromRaw = quoteDeliveryFromAddress();
  if (!apiKey || !fromRaw) return;

  const origin = quoteDeliverySiteOrigin();
  const { data: quoteRow } = await admin
    .from("quotes")
    .select("issuer_snapshot")
    .eq("id", input.quoteId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  const issuer = resolveQuoteIssuerSettings(
    { issuer_snapshot: parseQuoteIssuerSnapshot(quoteRow?.issuer_snapshot) },
    null
  );
  const company = getCompanyDisplayName(issuer) || null;
  const payloadByNotification = new Map(
    notifications.map((row) => [
      row.id as string,
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {},
    ])
  );

  for (const row of rows) {
    const kind = row.email_kind as QuoteNotificationEmailKind;
    let actionUrl = typeof row.action_url === "string" ? row.action_url : null;
    if (kind === "quote_accepted_client" && input.publicPath && origin) {
      actionUrl = `${origin}${input.publicPath}`;
      if (!row.action_url) {
        await admin
          .from("notification_deliveries")
          .update({ action_url: actionUrl })
          .eq("id", row.id)
          .eq("org_id", input.orgId)
          .is("action_url", null);
      }
    } else if (actionUrl?.startsWith("/") && origin) {
      actionUrl = `${origin}${actionUrl}`;
    }

    const payload = payloadByNotification.get(row.notification_id as string) ?? {};
    const from = quoteResponseNotificationFromHeader(company) ?? fromRaw;
    const email = buildQuoteResponseNotificationEmail({
      kind,
      companyName: company,
      issuerLogoUrl: issuer?.logoUrl ?? null,
      projectTitle: payloadString(payload, "projectTitle"),
      quoteNumber: payloadString(payload, "quoteNumber") ?? "Quote",
      revisionNumber: payloadNumber(payload, "revisionNumber") ?? 1,
      signerName: payloadString(payload, "signerName"),
      totalInclGst: payloadNumber(payload, "totalInclGst"),
      occurredAt:
        payloadString(payload, "acceptedAt") ??
        payloadString(payload, "declinedAt"),
      declineNote: payloadString(payload, "messagePreview"),
      actionUrl,
    });

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": String(row.idempotency_key),
        },
        body: JSON.stringify({
          from,
          to: [row.recipient_email],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      const bodyText = await response.text();
      if (!response.ok) {
        await admin
          .from("notification_deliveries")
          .update({
            status: "failed",
            attempt_count: Number(row.attempt_count ?? 0) + 1,
            last_error_safe: "Email could not be sent.",
            failed_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("org_id", input.orgId);
        continue;
      }
      let providerMessageId: string | null = null;
      try {
        const parsed = JSON.parse(bodyText) as { id?: string };
        providerMessageId = parsed.id ?? null;
      } catch {
        providerMessageId = null;
      }
      await admin
        .from("notification_deliveries")
        .update({
          status: "submitted",
          attempt_count: Number(row.attempt_count ?? 0) + 1,
          provider_message_id: providerMessageId,
          submitted_at: new Date().toISOString(),
          last_error_safe: null,
        })
        .eq("id", row.id)
        .eq("org_id", input.orgId);
    } catch {
      await admin
        .from("notification_deliveries")
        .update({
          status: "failed",
          attempt_count: Number(row.attempt_count ?? 0) + 1,
          last_error_safe: "Email could not be sent.",
          failed_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("org_id", input.orgId);
    }
  }
}

export async function flushQuoteResponseNotificationsForPublicToken(
  rawToken: string
): Promise<void> {
  try {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return;
    }
    const { data: tokenRow, error } = await admin
      .from("quote_access_tokens")
      .select("quote_id, org_id")
      .eq("token_hash", hashQuoteAccessToken(rawToken))
      .maybeSingle();
    if (error || !tokenRow?.quote_id || !tokenRow.org_id) return;
    await sendPendingDeliveriesForQuote({
      quoteId: tokenRow.quote_id as string,
      orgId: tokenRow.org_id as string,
      publicPath: quotePublicPath(rawToken),
    });
  } catch {
    // Accept/decline remains canonical even if notification email fails.
  }
}

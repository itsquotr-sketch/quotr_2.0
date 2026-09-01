import "server-only";

import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  quoteDeliveryFromAddress,
  quoteDeliverySiteOrigin,
} from "@/lib/quotes/delivery-email";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import {
  isMissingNotificationFlushTableError,
  sendPendingQuoteResponseNotificationDeliveries,
  type NotificationFlushDeliveryRow,
  type NotificationFlushStore,
  type QuoteResponseNotificationFlushInput,
  type QuoteResponseNotificationFlushResult,
} from "@/lib/quotes/notification-flush-core";
import type { QuoteNotificationEmailKind } from "@/lib/quotes/notifications";

function createSupabaseNotificationFlushStore(
  admin: ReturnType<typeof createAdminClient>
): NotificationFlushStore {
  return {
    async listNotificationsForQuote(input) {
      const { data, error } = await admin
        .from("notifications")
        .select("id, payload")
        .eq("org_id", input.orgId)
        .eq("resource_id", input.quoteId);
      if (error) {
        return {
          ok: false,
          missingTable: isMissingNotificationFlushTableError(error),
        };
      }
      return {
        ok: true,
        rows: (data ?? []).map((row) => ({
          id: String(row.id),
          payload: row.payload,
        })),
      };
    },
    async listPendingEmailDeliveries(input) {
      if (input.notificationIds.length === 0) return [];
      const { data, error } = await admin
        .from("notification_deliveries")
        .select(
          "id, org_id, notification_id, email_kind, recipient_email, status, idempotency_key, action_url, attempt_count"
        )
        .in("notification_id", input.notificationIds)
        .eq("org_id", input.orgId)
        .in("status", ["pending", "failed"])
        .eq("channel", "email")
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      return data.map((row) => ({
        id: String(row.id),
        org_id: String(row.org_id),
        notification_id: String(row.notification_id),
        email_kind: row.email_kind as QuoteNotificationEmailKind,
        recipient_email: String(row.recipient_email),
        status: String(row.status),
        idempotency_key: String(row.idempotency_key),
        action_url:
          typeof row.action_url === "string" ? row.action_url : null,
        attempt_count: Number(row.attempt_count ?? 0),
      })) satisfies NotificationFlushDeliveryRow[];
    },
    async getIssuerSnapshot(input) {
      const { data } = await admin
        .from("quotes")
        .select("issuer_snapshot")
        .eq("id", input.quoteId)
        .eq("org_id", input.orgId)
        .maybeSingle();
      return data?.issuer_snapshot ?? null;
    },
    async updateDelivery(input) {
      await admin
        .from("notification_deliveries")
        .update(input.patch)
        .eq("id", input.id)
        .eq("org_id", input.orgId);
    },
  };
}

export async function runQuoteResponseNotificationFlush(
  input: QuoteResponseNotificationFlushInput
): Promise<QuoteResponseNotificationFlushResult> {
  const admin = createAdminClient();
  return sendPendingQuoteResponseNotificationDeliveries(input, {
    store: createSupabaseNotificationFlushStore(admin),
    provider: getQuoteDeliveryProvider(),
    origin: quoteDeliverySiteOrigin(),
    fromAddress: quoteDeliveryFromAddress(),
  });
}

export async function flushPendingQuoteResponseNotifications(
  input: QuoteResponseNotificationFlushInput
): Promise<void> {
  try {
    try {
      await connection();
    } catch {
      // Already request-scoped, or running outside the Next request helper.
    }
    await runQuoteResponseNotificationFlush(input);
  } catch {
    // Accept/decline remains canonical even if notification email fails.
  }
}

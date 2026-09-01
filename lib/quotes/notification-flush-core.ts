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
import type { QuoteDeliveryProvider } from "@/lib/quotes/delivery-types";

export type QuoteResponseNotificationFlushInput = {
  quoteId: string;
  orgId: string;
  publicPath?: string | null;
};

export type QuoteResponseNotificationFlushResult = {
  submitted: number;
  failed: number;
  skipped:
    | "none"
    | "invalid_context"
    | "no_rows"
    | "provider_unconfigured"
    | "missing_table"
    | "error";
};

export type NotificationFlushDeliveryRow = {
  id: string;
  org_id: string;
  notification_id: string;
  email_kind: QuoteNotificationEmailKind;
  recipient_email: string;
  status: string;
  idempotency_key: string;
  action_url: string | null;
  attempt_count: number;
};

export type NotificationFlushStore = {
  listNotificationsForQuote(input: {
    orgId: string;
    quoteId: string;
  }): Promise<
    | { ok: true; rows: Array<{ id: string; payload: unknown }> }
    | { ok: false; missingTable?: boolean }
  >;
  listPendingEmailDeliveries(input: {
    orgId: string;
    notificationIds: string[];
  }): Promise<NotificationFlushDeliveryRow[]>;
  getIssuerSnapshot(input: {
    orgId: string;
    quoteId: string;
  }): Promise<unknown>;
  updateDelivery(input: {
    id: string;
    orgId: string;
    patch: Record<string, unknown>;
  }): Promise<void>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isQuoteResponseNotificationFlushContext(
  input: Pick<QuoteResponseNotificationFlushInput, "quoteId" | "orgId">
): boolean {
  return UUID_RE.test(input.quoteId) && UUID_RE.test(input.orgId);
}

export function resolveQuoteResponseNotificationActionUrl(input: {
  kind: QuoteNotificationEmailKind;
  storedActionUrl: string | null;
  publicPath?: string | null;
  origin: string | null;
}): string | null {
  const origin = input.origin?.replace(/\/+$/, "") || null;
  if (input.kind === "quote_accepted_client") {
    const path = input.publicPath?.trim() || "";
    if (origin && path.startsWith("/q/")) {
      return `${origin}${path}`;
    }
    return null;
  }
  const stored = input.storedActionUrl?.trim() || "";
  if (!stored) return null;
  if (stored.startsWith("/") && origin) {
    return `${origin}${stored}`;
  }
  return stored;
}

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

export async function sendPendingQuoteResponseNotificationDeliveries(
  input: QuoteResponseNotificationFlushInput,
  deps: {
    store: NotificationFlushStore;
    provider: QuoteDeliveryProvider;
    origin: string | null;
    fromAddress: string | null;
  }
): Promise<QuoteResponseNotificationFlushResult> {
  if (!isQuoteResponseNotificationFlushContext(input)) {
    return { submitted: 0, failed: 0, skipped: "invalid_context" };
  }
  if (!deps.provider.isConfigured() || !deps.fromAddress) {
    return { submitted: 0, failed: 0, skipped: "provider_unconfigured" };
  }

  const notifications = await deps.store.listNotificationsForQuote({
    orgId: input.orgId,
    quoteId: input.quoteId,
  });
  if (!notifications.ok) {
    return {
      submitted: 0,
      failed: 0,
      skipped: notifications.missingTable ? "missing_table" : "error",
    };
  }
  if (!notifications.rows.length) {
    return { submitted: 0, failed: 0, skipped: "no_rows" };
  }

  const rows = await deps.store.listPendingEmailDeliveries({
    orgId: input.orgId,
    notificationIds: notifications.rows.map((row) => row.id),
  });
  if (!rows.length) {
    return { submitted: 0, failed: 0, skipped: "no_rows" };
  }

  const issuerSnapshot = await deps.store.getIssuerSnapshot({
    orgId: input.orgId,
    quoteId: input.quoteId,
  });
  const issuer = resolveQuoteIssuerSettings(
    { issuer_snapshot: parseQuoteIssuerSnapshot(issuerSnapshot) },
    null
  );
  const company = getCompanyDisplayName(issuer) || null;
  const payloadByNotification = new Map(
    notifications.rows.map((row) => [
      row.id,
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {},
    ])
  );

  let submitted = 0;
  let failed = 0;

  for (const row of rows) {
    const kind = row.email_kind;
    const actionUrl = resolveQuoteResponseNotificationActionUrl({
      kind,
      storedActionUrl: row.action_url,
      publicPath: input.publicPath,
      origin: deps.origin,
    });
    const payload = payloadByNotification.get(row.notification_id) ?? {};
    const from =
      quoteResponseNotificationFromHeader(company) ?? deps.fromAddress;
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
      const result = await deps.provider.send({
        to: row.recipient_email,
        from,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: row.idempotency_key,
      });
      if (!result.ok) {
        failed += 1;
        await deps.store.updateDelivery({
          id: row.id,
          orgId: input.orgId,
          patch: {
            status: "failed",
            attempt_count: Number(row.attempt_count ?? 0) + 1,
            last_error_safe: result.messageSafe || "Email could not be sent.",
            failed_at: new Date().toISOString(),
          },
        });
        continue;
      }
      submitted += 1;
      await deps.store.updateDelivery({
        id: row.id,
        orgId: input.orgId,
        patch: {
          status: "submitted",
          attempt_count: Number(row.attempt_count ?? 0) + 1,
          provider_message_id: result.providerMessageId,
          submitted_at: new Date().toISOString(),
          last_error_safe: null,
        },
      });
    } catch {
      failed += 1;
      await deps.store.updateDelivery({
        id: row.id,
        orgId: input.orgId,
        patch: {
          status: "failed",
          attempt_count: Number(row.attempt_count ?? 0) + 1,
          last_error_safe: "Email could not be sent.",
          failed_at: new Date().toISOString(),
        },
      });
    }
  }

  return { submitted, failed, skipped: "none" };
}

export function isMissingNotificationFlushTableError(error: {
  message?: string;
  code?: string;
} | null): boolean {
  return isMissingNotificationTableError(error);
}

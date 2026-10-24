import {
  buildPlanConfirmationEmail,
  isWebsiteBillingUrl,
  PLAN_CONFIRMATION_REPLY_TO,
  type PlanConfirmationEnvironment,
  type PlanConfirmationOpeningKind,
  type PlanConfirmationSource,
  type PlanConfirmationStatus,
} from "@/lib/billing/plan-confirmation";
import { isSafeMailboxAddress } from "@/lib/email/application-email";
import type {
  QuoteDeliveryProvider,
  QuoteDeliveryProviderResult,
} from "@/lib/quotes/delivery-types";

export type PlanConfirmationClaimedRow = {
  id: string;
  status: PlanConfirmationStatus;
  source: PlanConfirmationSource;
  environment: PlanConfirmationEnvironment | null;
  idempotencyKey: string;
  idempotencyStartedAt: string | null;
  recipientEmail: string;
  companyName: string;
  planCode: "builder" | "business";
  includedUsers: number;
  paidUsers: number;
  currency: string;
  recurringExclusiveCents: number;
  recurringTaxCents: number;
  taxDisplayName: string | null;
  taxInclusive: boolean;
  openingExclusiveCents: number | null;
  openingTaxCents: number | null;
  openingTotalCents: number | null;
  openingKind: PlanConfirmationOpeningKind | null;
  nextBillingAt: string | null;
  billingUrl: string;
  providerMessageId: string | null;
  leaseUntil: string | null;
};

export type PlanConfirmationDeliveryStore = {
  claim(id: string): Promise<
    | {
        claimed: false;
        reason: "accepted" | "in_flight" | "reconcile" | "incomplete" | "missing";
        providerMessageId: string | null;
        idempotencyKey: string | null;
      }
    | { claimed: true; row: PlanConfirmationClaimedRow }
  >;
  acknowledge(id: string, providerMessageId: string): Promise<boolean>;
  fail(id: string, errorSafe: string): Promise<void>;
};

type Rpc = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integer(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  return null;
}

function openingKind(value: unknown): PlanConfirmationOpeningKind | null {
  if (value === "prorated" || value === "discounted" || value === "prorated_discounted") {
    return value;
  }
  return null;
}

export function createPlanConfirmationStore(db: Rpc): PlanConfirmationDeliveryStore {
  return {
    async claim(id) {
      const { data, error } = await db.rpc("claim_paid_plan_confirmation_v1", { p_id: id });
      if (error) {
        return { claimed: false, reason: "missing", providerMessageId: null, idempotencyKey: null };
      }
      const row = asRecord(data);
      if (!row || row.ok !== true) {
        return { claimed: false, reason: "missing", providerMessageId: null, idempotencyKey: null };
      }
      if (row.claimed !== true) {
        const reason =
          row.reason === "accepted" ||
          row.reason === "in_flight" ||
          row.reason === "reconcile" ||
          row.reason === "incomplete"
            ? row.reason
            : "missing";
        return {
          claimed: false,
          reason,
          providerMessageId: text(row.provider_message_id),
          idempotencyKey: text(row.idempotency_key),
        };
      }
      const planCode = row.plan_code === "builder" || row.plan_code === "business" ? row.plan_code : null;
      const source = row.source === "activation" || row.source === "preview_test" ? row.source : null;
      const status =
        row.status === "pending" ||
        row.status === "sending" ||
        row.status === "accepted" ||
        row.status === "failed"
          ? row.status
          : null;
      const environment =
        row.environment === "preview" ||
        row.environment === "production" ||
        row.environment === "development"
          ? row.environment
          : null;
      const claimedId = text(row.id);
      const idempotencyKey = text(row.idempotency_key);
      const recipientEmail = text(row.recipient_email);
      const companyName = text(row.company_name);
      const currency = text(row.currency);
      const billingUrl = text(row.billing_url);
      const includedUsers = integer(row.included_users);
      const paidUsers = integer(row.paid_users);
      const recurringExclusiveCents = integer(row.recurring_exclusive_cents);
      const recurringTaxCents = integer(row.recurring_tax_cents);
      if (
        !planCode ||
        !source ||
        !status ||
        !claimedId ||
        !idempotencyKey ||
        !recipientEmail ||
        !companyName ||
        !currency ||
        !billingUrl ||
        includedUsers == null ||
        paidUsers == null ||
        recurringExclusiveCents == null ||
        recurringTaxCents == null
      ) {
        return { claimed: false, reason: "incomplete", providerMessageId: null, idempotencyKey };
      }
      return {
        claimed: true,
        row: {
          id: claimedId,
          status,
          source,
          environment,
          idempotencyKey,
          idempotencyStartedAt: text(row.idempotency_started_at),
          recipientEmail,
          companyName,
          planCode,
          includedUsers,
          paidUsers,
          currency,
          recurringExclusiveCents,
          recurringTaxCents,
          taxDisplayName: text(row.tax_display_name),
          taxInclusive: row.tax_inclusive === true,
          openingExclusiveCents: integer(row.opening_exclusive_cents),
          openingTaxCents: integer(row.opening_tax_cents),
          openingTotalCents: integer(row.opening_total_cents),
          openingKind: openingKind(row.opening_kind),
          nextBillingAt: text(row.next_billing_at),
          billingUrl,
          providerMessageId: text(row.provider_message_id),
          leaseUntil: text(row.lease_until),
        },
      };
    },
    async acknowledge(id, providerMessageId) {
      const { data, error } = await db.rpc("acknowledge_paid_plan_confirmation_v1", {
        p_id: id,
        p_provider_message_id: providerMessageId,
      });
      if (error) return false;
      return asRecord(data)?.ok === true;
    },
    async fail(id, errorSafe) {
      await db.rpc("fail_paid_plan_confirmation_v1", {
        p_id: id,
        p_error_safe: errorSafe,
      });
    },
  };
}

export type PlanConfirmationDeliveryResult = {
  outcome:
    | "skipped_accepted"
    | "skipped_in_flight"
    | "missing"
    | "incomplete"
    | "accepted"
    | "accepted_unacked"
    | "failed"
    | "refused"
    | "reconcile";
  providerMessageId: string | null;
  idempotencyKey: string | null;
  recipientEmail: string | null;
};

function safeFailure(result: Extract<QuoteDeliveryProviderResult, { ok: false }>): string {
  return (result.messageSafe.trim() || "The email could not be sent.").slice(0, 180);
}

export async function deliverPaidPlanConfirmation(input: {
  deliveryId: string;
  store: PlanConfirmationDeliveryStore;
  provider: QuoteDeliveryProvider;
  from: string | null;
  allowRecipient?: (email: string) => boolean;
}): Promise<PlanConfirmationDeliveryResult> {
  const claimed = await input.store.claim(input.deliveryId);
  if (!claimed.claimed) {
    const outcome =
      claimed.reason === "accepted"
        ? "skipped_accepted"
        : claimed.reason === "in_flight"
          ? "skipped_in_flight"
          : claimed.reason === "reconcile"
            ? "reconcile"
            : claimed.reason === "incomplete"
              ? "incomplete"
              : "missing";
    return {
      outcome,
      providerMessageId: claimed.providerMessageId,
      idempotencyKey: claimed.idempotencyKey,
      recipientEmail: null,
    };
  }

  const row = claimed.row;
  if (
    !input.from ||
    !input.provider.isConfigured() ||
    !isSafeMailboxAddress(row.recipientEmail) ||
    !isSafeMailboxAddress(PLAN_CONFIRMATION_REPLY_TO) ||
    !isWebsiteBillingUrl(row.billingUrl)
  ) {
    await input.store.fail(row.id, "Email delivery is not configured.");
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      recipientEmail: row.recipientEmail,
    };
  }

  if (input.allowRecipient && !input.allowRecipient(row.recipientEmail)) {
    await input.store.fail(row.id, "The plan confirmation recipient was refused.");
    return {
      outcome: "refused",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      recipientEmail: row.recipientEmail,
    };
  }

  const email = buildPlanConfirmationEmail({
    companyName: row.companyName,
    billingUrl: row.billingUrl,
    previewTest: row.source === "preview_test",
    facts: {
      planCode: row.planCode,
      currency: row.currency,
      includedUsers: row.includedUsers,
      paidUsers: row.paidUsers,
      recurringExclusiveCents: row.recurringExclusiveCents,
      recurringTaxCents: row.recurringTaxCents,
      taxDisplayName: row.taxDisplayName,
      taxPercent: null,
      taxInclusive: row.taxInclusive,
      openingExclusiveCents: row.openingExclusiveCents,
      openingTaxCents: row.openingTaxCents,
      openingTotalCents: row.openingTotalCents,
      openingKind: row.openingKind,
      nextBillingAt: row.nextBillingAt,
    },
  });

  let sent: QuoteDeliveryProviderResult;
  try {
    sent = await input.provider.send({
      to: row.recipientEmail,
      from: input.from,
      replyTo: PLAN_CONFIRMATION_REPLY_TO,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: row.idempotencyKey,
    });
  } catch {
    await input.store.fail(row.id, "Could not reach the email service. Try again shortly.");
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      recipientEmail: row.recipientEmail,
    };
  }

  if (!sent.ok) {
    await input.store.fail(row.id, safeFailure(sent));
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      recipientEmail: row.recipientEmail,
    };
  }

  let acknowledged = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      acknowledged = await input.store.acknowledge(row.id, sent.providerMessageId);
    } catch {
      acknowledged = false;
    }
    if (acknowledged) break;
  }

  return {
    outcome: acknowledged ? "accepted" : "accepted_unacked",
    providerMessageId: sent.providerMessageId,
    idempotencyKey: row.idempotencyKey,
    recipientEmail: row.recipientEmail,
  };
}

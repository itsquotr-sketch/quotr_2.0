import { unixSecondsToIso } from "@/lib/billing/events";
import { resolvePlanFromStripePriceItems } from "@/lib/billing/prices";
import { mapStripeSubscriptionStatus } from "@/lib/billing/status";
import type {
  BillingEnvironment,
  OrgSubscription,
  PlanPriceResolution,
  StripePriceConfig,
  StripeSubscriptionLike,
} from "@/lib/billing/types";

export function extractStripeId(
  value: unknown
): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }
  }
  return null;
}

export function parseStripeSubscriptionLike(
  object: Record<string, unknown>
): StripeSubscriptionLike | null {
  const id = extractStripeId(object.id ?? object);
  const customerId = extractStripeId(object.customer);
  if (!id || !customerId) {
    return null;
  }

  const itemsContainer = object.items;
  const rawItems =
    itemsContainer &&
    typeof itemsContainer === "object" &&
    "data" in itemsContainer &&
    Array.isArray((itemsContainer as { data: unknown }).data)
      ? ((itemsContainer as { data: unknown[] }).data)
      : [];

  const items = rawItems.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const priceId = extractStripeId(
      record.price && typeof record.price === "object"
        ? (record.price as Record<string, unknown>).id
        : record.price
    );
    if (!priceId) {
      return [];
    }
    const quantity =
      typeof record.quantity === "number" && Number.isFinite(record.quantity)
        ? record.quantity
        : 1;
    const currentPeriodStart =
      typeof record.current_period_start === "number"
        ? record.current_period_start
        : typeof object.current_period_start === "number"
          ? object.current_period_start
          : null;
    const currentPeriodEnd =
      typeof record.current_period_end === "number"
        ? record.current_period_end
        : typeof object.current_period_end === "number"
          ? object.current_period_end
          : null;
    return [
      {
        priceId,
        quantity,
        currentPeriodStart,
        currentPeriodEnd,
      },
    ];
  });

  const metadataRaw =
    object.metadata && typeof object.metadata === "object"
      ? (object.metadata as Record<string, unknown>)
      : {};
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadataRaw)) {
    if (typeof value === "string") {
      metadata[key] = value;
    }
  }

  return {
    id,
    customerId,
    status: typeof object.status === "string" ? object.status : "incomplete",
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
    canceledAt:
      typeof object.canceled_at === "number" ? object.canceled_at : null,
    trialEnd: typeof object.trial_end === "number" ? object.trial_end : null,
    pauseCollection: Boolean(object.pause_collection),
    metadata,
    items,
  };
}

export function periodFromSubscriptionItems(
  subscription: StripeSubscriptionLike
): { start: string | null; end: string | null } {
  const withPeriod = subscription.items.find(
    (item) => item.currentPeriodStart != null || item.currentPeriodEnd != null
  );
  return {
    start: unixSecondsToIso(withPeriod?.currentPeriodStart ?? null),
    end: unixSecondsToIso(withPeriod?.currentPeriodEnd ?? null),
  };
}

export function mapStripeSubscriptionToMirror(input: {
  orgId: string;
  billingEnvironment: BillingEnvironment;
  subscription: StripeSubscriptionLike;
  prices: StripePriceConfig;
  existing: OrgSubscription | null;
  eventId: string;
  eventCreatedUnix: number;
  deleted?: boolean;
}):
  | { ok: true; row: OrgSubscription; plan: Extract<PlanPriceResolution, { ok: true }> }
  | { ok: false; errorCode: string; errorSafe: string } {
  const plan = resolvePlanFromStripePriceItems(
    input.subscription.items,
    input.prices
  );
  if (!plan.ok) {
    return plan;
  }

  const period = periodFromSubscriptionItems(input.subscription);
  const status = input.deleted
    ? "cancelled"
    : mapStripeSubscriptionStatus({
        stripeStatus: input.subscription.status,
        cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd,
        pauseCollection: input.subscription.pauseCollection,
      });

  const nowIso = new Date(input.eventCreatedUnix * 1000).toISOString();
  const existing = input.existing;

  return {
    ok: true,
    plan,
    row: {
      id: existing?.id ?? `sub_${input.orgId}_${input.billingEnvironment}`,
      orgId: input.orgId,
      billingEnvironment: input.billingEnvironment,
      planCode: plan.planCode,
      status,
      source: "stripe",
      stripeSubscriptionId: input.subscription.id,
      stripeCustomerId: input.subscription.customerId,
      stripeBasePriceId: plan.stripeBasePriceId,
      stripeSeatPriceId: plan.stripeSeatPriceId,
      paidSeatQuantity: plan.paidSeatQuantity,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      trialEndsAt: unixSecondsToIso(input.subscription.trialEnd),
      cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd,
      cancelledAt:
        status === "cancelled"
          ? unixSecondsToIso(input.subscription.canceledAt) ?? nowIso
          : null,
      lastStripeEventCreatedAt: nowIso,
      lastStripeEventId: input.eventId,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    },
  };
}

export function extractInvoiceSubscriptionId(
  object: Record<string, unknown>
): string | null {
  const direct = extractStripeId(object.subscription);
  if (direct) {
    return direct;
  }
  const parent = object.parent;
  if (parent && typeof parent === "object") {
    const details = (parent as Record<string, unknown>).subscription_details;
    if (details && typeof details === "object") {
      const nested = extractStripeId(
        (details as Record<string, unknown>).subscription
      );
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function extractInvoiceCustomerId(
  object: Record<string, unknown>
): string | null {
  return extractStripeId(object.customer);
}

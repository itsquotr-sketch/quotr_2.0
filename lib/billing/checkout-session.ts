import { validateTrustedBillingMetadata } from "@/lib/billing/customers";
import { extractStripeId } from "@/lib/billing/mirror";
import { resolvePlanFromStripePriceItems } from "@/lib/billing/prices";
import { parseCheckoutPlanCode } from "@/lib/billing/checkout-plan";
import type {
  BillingEnvironment,
  StripePriceConfig,
} from "@/lib/billing/types";

export type CheckoutSessionLike = {
  id: string;
  mode: string | null;
  customerId: string | null;
  clientReferenceId: string | null;
  paymentStatus: string | null;
  status: string | null;
  subscriptionId: string | null;
  metadata: Record<string, string>;
  priceIds: string[];
};

function metadataRecord(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

function priceIdsFromSession(object: Record<string, unknown>): string[] {
  const lineItems = object.line_items;
  if (
    lineItems &&
    typeof lineItems === "object" &&
    "data" in lineItems &&
    Array.isArray((lineItems as { data: unknown }).data)
  ) {
    return (lineItems as { data: unknown[] }).data.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const price = extractStripeId((item as Record<string, unknown>).price);
      return price ? [price] : [];
    });
  }
  return [];
}

export function parseCheckoutSessionLike(
  object: Record<string, unknown>
): CheckoutSessionLike | null {
  const id = extractStripeId(object.id ?? object);
  if (!id) return null;
  return {
    id,
    mode: typeof object.mode === "string" ? object.mode : null,
    customerId: extractStripeId(object.customer),
    clientReferenceId:
      typeof object.client_reference_id === "string" &&
      object.client_reference_id.trim()
        ? object.client_reference_id.trim()
        : null,
    paymentStatus:
      typeof object.payment_status === "string" ? object.payment_status : null,
    status: typeof object.status === "string" ? object.status : null,
    subscriptionId: extractStripeId(object.subscription),
    metadata: metadataRecord(object.metadata),
    priceIds: priceIdsFromSession(object),
  };
}

export type CheckoutCorroboration =
  | {
      result: "processed" | "ignored" | "failed";
      errorCode: string;
      errorSafe: string;
      orgId?: string | null;
    };

/**
 * Audit/association only. Never writes org_subscriptions plan/status.
 */
export function corroborateCheckoutSession(input: {
  session: CheckoutSessionLike;
  billingEnvironment: BillingEnvironment;
  mappedOrgId: string | null;
  prices: StripePriceConfig | null;
}): CheckoutCorroboration {
  const { session, billingEnvironment, mappedOrgId, prices } = input;

  if (session.mode && session.mode !== "subscription") {
    return {
      result: "ignored",
      errorCode: "checkout_not_subscription",
      errorSafe: "Checkout session was not subscription mode.",
    };
  }

  if (!session.customerId) {
    return {
      result: "ignored",
      errorCode: "checkout_without_customer",
      errorSafe: "Checkout session had no Stripe customer.",
    };
  }

  if (!mappedOrgId) {
    return {
      result: "ignored",
      errorCode: "checkout_unmapped_customer",
      errorSafe:
        "Checkout customer is not mapped to an organisation. Mapping is created before Checkout, not guessed here.",
    };
  }

  if (session.clientReferenceId && session.clientReferenceId !== mappedOrgId) {
    return {
      result: "failed",
      errorCode: "checkout_org_mismatch",
      errorSafe: "Checkout client_reference_id does not match the customer mapping.",
      orgId: mappedOrgId,
    };
  }

  const metadataCheck = validateTrustedBillingMetadata({
    billingEnvironment,
    mappedOrgId,
    metadata: session.metadata,
  });
  if (!metadataCheck.ok) {
    return {
      result: "failed",
      errorCode: metadataCheck.errorCode,
      errorSafe: metadataCheck.errorSafe,
      orgId: mappedOrgId,
    };
  }

  const selectedPlan = parseCheckoutPlanCode(session.metadata.selected_plan);
  if (session.metadata.selected_plan && !selectedPlan) {
    return {
      result: "failed",
      errorCode: "checkout_invalid_selected_plan",
      errorSafe: "Checkout metadata selected_plan is not a self-service plan.",
      orgId: mappedOrgId,
    };
  }

  if (session.priceIds.length > 0 && prices) {
    const resolved = resolvePlanFromStripePriceItems(
      session.priceIds.map((priceId) => ({ priceId, quantity: 1 })),
      prices
    );
    if (!resolved.ok) {
      return {
        result: "failed",
        errorCode: resolved.errorCode,
        errorSafe: resolved.errorSafe,
        orgId: mappedOrgId,
      };
    }
    if (selectedPlan && resolved.planCode !== selectedPlan) {
      return {
        result: "failed",
        errorCode: "checkout_plan_price_mismatch",
        errorSafe: "Checkout selected_plan does not match configured Price IDs.",
        orgId: mappedOrgId,
      };
    }
  }

  return {
    result: "processed",
    errorCode: "checkout_corroborated",
    errorSafe:
      "Checkout session corroborated against customer mapping. Subscription webhooks remain state authority.",
    orgId: mappedOrgId,
  };
}

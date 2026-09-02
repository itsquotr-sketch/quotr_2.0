"use server";

import { redirect } from "next/navigation";
import { buildBillingPageView, type BillingPageView } from "@/lib/billing/billing-page-view";
import {
  canCreateSubscriptionCheckout,
  parseCheckoutPlanCode,
  pickReusableOpenCheckoutSession,
  resolveCheckoutPriceId,
} from "@/lib/billing/checkout-plan";
import { ensureOrgStripeCustomer } from "@/lib/billing/ensure-customer";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import { stripeDefaultTaxRates, stripeLineItemTaxRates } from "@/lib/billing/gst";
import { logBillingEvent } from "@/lib/billing/logging";
import { canUpgradeBuilderToBusiness } from "@/lib/billing/plan-change";
import { requireStripePriceConfig } from "@/lib/billing/prices";
import { getOrgBillingState } from "@/lib/billing/server";
import {
  stripeCheckoutIdempotencyKey,
  stripeUpgradeToBusinessIdempotencyKey,
} from "@/lib/billing/stripe-idempotency";
import { getStripeClient } from "@/lib/billing/stripe";
import { createSupabaseBillingStore } from "@/lib/billing/supabase-store";
import {
  buildBuilderToBusinessUpgradeParams,
  resolveBuilderToBusinessMutation,
  resolveUpgradeConfirmKind,
  upgradeConfirmPath,
  type StripePendingUpdateLike,
} from "@/lib/billing/upgrade-policy";
import {
  billingCheckoutCancelUrl,
  billingCheckoutSuccessUrl,
  billingPortalReturnUrl,
  readNzGstTaxRateId,
  readPortalConfigurationId,
} from "@/lib/billing/urls";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { getCompanySettingsWithContext } from "@/lib/settings/company-settings-loader";

export type BillingActionResult = { error: string };

async function requireOrgContext() {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      ok: false as const,
      error: "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }
  return { ok: true as const, context };
}

export async function getBillingPageState(): Promise<BillingPageView | { error: string }> {
  const auth = await requireOrgContext();
  if (!auth.ok) return { error: auth.error };
  const state = await getOrgBillingState(auth.context.orgId);
  return buildBillingPageView(state);
}

export async function startCheckout(
  planInput: string
): Promise<BillingActionResult | void> {
  const plan = parseCheckoutPlanCode(planInput);
  if (!plan) {
    return { error: "Choose Quotr Builder or Business." };
  }

  const auth = await requireOrgContext();
  if (!auth.ok) return { error: auth.error };
  const { context } = auth;
  const billingEnvironment = resolveBillingEnvironment();
  const state = await getOrgBillingState(context.orgId);
  const guard = canCreateSubscriptionCheckout(state);
  if (!guard.ok) {
    return { error: guard.errorSafe };
  }

  const prices = requireStripePriceConfig();
  const priceId = resolveCheckoutPriceId(plan, prices);
  const store = createSupabaseBillingStore();
  const settings = await getCompanySettingsWithContext(context);
  const identity = {
    companyName:
      settings?.tradingName?.trim() ||
      settings?.organisationName?.trim() ||
      "Quotr customer",
    billingEmail:
      settings?.contactEmail?.trim() || context.user.email?.trim() || null,
  };

  const customer = await ensureOrgStripeCustomer({
    orgId: context.orgId,
    billingEnvironment,
    identity,
    store,
  });
  if (!customer.ok) {
    return { error: customer.errorSafe };
  }

  const stripe = getStripeClient();
  const open = await stripe.checkout.sessions.list({
    customer: customer.customer.stripeCustomerId,
    status: "open",
    limit: 10,
  });
  const matching = pickReusableOpenCheckoutSession(open.data, plan);
  if (matching?.url) {
    redirect(matching.url);
  }
  for (const session of open.data) {
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(session.id);
    }
  }

  const taxRateId = readNzGstTaxRateId();
  const metadata = {
    org_id: context.orgId,
    billing_environment: billingEnvironment,
    selected_plan: plan,
  };

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customer.customer.stripeCustomerId,
      client_reference_id: context.orgId,
      success_url: billingCheckoutSuccessUrl(),
      cancel_url: billingCheckoutCancelUrl(),
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
          ...stripeLineItemTaxRates(taxRateId),
        },
      ],
      metadata,
      subscription_data: {
        metadata,
        ...stripeDefaultTaxRates(taxRateId),
      },
    },
    {
      idempotencyKey: stripeCheckoutIdempotencyKey(
        context.orgId,
        billingEnvironment,
        plan
      ),
    }
  );

  if (!session.url) {
    logBillingEvent({
      orgId: context.orgId,
      result: "checkout_missing_url",
      errorCode: "checkout_missing_url",
    });
    return { error: "Checkout could not be started. Try again." };
  }

  redirect(session.url);
}

export async function startCustomerPortal(): Promise<BillingActionResult | void> {
  const auth = await requireOrgContext();
  if (!auth.ok) return { error: auth.error };
  const billingEnvironment = resolveBillingEnvironment();
  const state = await getOrgBillingState(auth.context.orgId);
  const stripeCustomerId = state.customer?.stripeCustomerId;
  if (!stripeCustomerId) {
    return { error: "No billing account yet. Choose a plan first." };
  }
  if (state.customer && state.customer.orgId !== auth.context.orgId) {
    return { error: "Billing account does not match this organisation." };
  }
  if (state.customer && state.customer.billingEnvironment !== billingEnvironment) {
    return { error: "Billing account does not match this environment." };
  }

  const stripe = getStripeClient();
  const configuration = readPortalConfigurationId();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: billingPortalReturnUrl(),
    ...(configuration ? { configuration } : {}),
  });
  if (!session.url) {
    return { error: "Billing portal could not be opened. Try again." };
  }
  redirect(session.url);
}

export async function upgradeToBusiness(): Promise<BillingActionResult | void> {
  const auth = await requireOrgContext();
  if (!auth.ok) return { error: auth.error };
  const state = await getOrgBillingState(auth.context.orgId);
  const guard = canUpgradeBuilderToBusiness(state);
  if (!guard.ok) {
    return { error: guard.errorSafe };
  }

  const prices = requireStripePriceConfig();
  const stripe = getStripeClient();
  const billingEnvironment = resolveBillingEnvironment();
  const subscription = await stripe.subscriptions.retrieve(guard.stripeSubscriptionId);
  const currentPriceIds = subscription.items.data.map((item) => item.price.id);
  const pendingUpdate = stripePendingUpdateLike(subscription.pending_update);
  const mutation = resolveBuilderToBusinessMutation({
    currentPriceIds,
    pendingUpdate,
    prices,
  });
  if (mutation !== "mutate") {
    redirect(
      upgradeConfirmPath(
        resolveUpgradeConfirmKind({
          currentPriceIds,
          pendingUpdate,
          prices,
        })
      )
    );
  }

  const builderItem = subscription.items.data.find(
    (item) => item.price.id === prices.builderMonthly
  );
  if (!builderItem) {
    return {
      error: "This subscription cannot be upgraded automatically. Use Manage billing.",
    };
  }

  const params = buildBuilderToBusinessUpgradeParams({
    builderItemId: builderItem.id,
    businessPriceId: prices.businessBaseMonthly,
    orgId: auth.context.orgId,
    billingEnvironment,
    existingMetadata: Object.fromEntries(
      Object.entries(subscription.metadata ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
  });

  const updated = await stripe.subscriptions.update(
    guard.stripeSubscriptionId,
    params,
    {
      idempotencyKey: stripeUpgradeToBusinessIdempotencyKey(
        billingEnvironment,
        auth.context.orgId,
        guard.stripeSubscriptionId
      ),
    }
  );

  redirect(
    upgradeConfirmPath(
      resolveUpgradeConfirmKind({
        currentPriceIds: updated.items.data.map((item) => item.price.id),
        pendingUpdate: stripePendingUpdateLike(updated.pending_update),
        prices,
      })
    )
  );
}

function stripePendingUpdateLike(pending: unknown): StripePendingUpdateLike {
  if (!pending || typeof pending !== "object") {
    return null;
  }
  const items = (pending as { subscription_items?: unknown }).subscription_items;
  if (!Array.isArray(items)) {
    return {
      subscription_items: [],
    };
  }
  return {
    subscription_items: items.map((item) => {
      if (!item || typeof item !== "object") {
        return { price: null };
      }
      return { price: (item as { price?: string | { id?: string | null } | null }).price ?? null };
    }),
  };
}

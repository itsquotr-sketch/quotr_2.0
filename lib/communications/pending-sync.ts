/**
 * Operator retry for profiles whose product-update choice is still pending.
 * Does not import server-only. Does not select users who are not pending.
 * Does not send campaigns or events.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import { selectActiveBillingOverride } from "@/lib/billing/overrides";
import type { OrgBillingOverride, OrgSubscription } from "@/lib/billing/types";
import { loadSharedContactFields } from "@/lib/communications/contact-loader";
import {
  buildLoopsContactProperties,
  loopsBillingFields,
  loopsPreferenceAckDecision,
  type LoopsContactDraft,
} from "@/lib/communications/contact-mapping";
import { logLoopsFailure, upsertLoopsContact } from "@/lib/communications/loops-client";

const DEFAULT_LIMIT = 50;

export type PendingSyncResult = {
  examined: number;
  cleared: number;
  rearmed: number;
  failed: number;
  skipped: number;
};

type ProfileRow = {
  id: string;
  org_id: string | null;
  full_name: string | null;
  marketing_consent: boolean | null;
  marketing_loops_sync_pending: boolean | null;
  marketing_consent_revision: number | string | null;
};

export async function syncPendingMarketingContacts(input: {
  admin: SupabaseClient;
  apiKey: string;
  email?: string;
  limit?: number;
}): Promise<PendingSyncResult> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const result: PendingSyncResult = {
    examined: 0,
    cleared: 0,
    rearmed: 0,
    failed: 0,
    skipped: 0,
  };

  const { data, error } = await input.admin
    .from("profiles")
    .select(
      "id, org_id, full_name, marketing_consent, marketing_loops_sync_pending, marketing_consent_revision"
    )
    .eq("marketing_loops_sync_pending", true)
    .limit(limit);

  if (error || !data) {
    logLoopsFailure("pending_unavailable");
    return result;
  }

  const wanted = input.email?.trim().toLowerCase() ?? "";
  for (const row of data as ProfileRow[]) {
    const authUser = await input.admin.auth.admin.getUserById(row.id);
    const email = authUser.data.user?.email?.trim() ?? "";
    if (!email) {
      result.skipped += 1;
      continue;
    }
    if (wanted && email.toLowerCase() !== wanted) {
      result.skipped += 1;
      continue;
    }

    result.examined += 1;
    const outcome = await syncOnePending(input.admin, input.apiKey, row, email);
    result[outcome] += 1;
  }

  return result;
}

async function syncOnePending(
  admin: SupabaseClient,
  apiKey: string,
  row: ProfileRow,
  email: string
): Promise<"cleared" | "rearmed" | "failed" | "skipped"> {
  const sentConsent = row.marketing_consent === true;
  const sentRevision = revisionOf(row.marketing_consent_revision);
  const orgId = typeof row.org_id === "string" ? row.org_id : null;
  const shared = orgId
    ? await loadSharedContactFields(admin, orgId, await loadBilling(admin, orgId))
    : {};
  const draft: LoopsContactDraft = {
    ...shared,
    userId: row.id,
    email,
    fullName: row.full_name,
    marketingConsent: sentConsent,
    preferencePending: true,
    consentRevision: sentRevision,
  };

  const before = await readStamp(admin, row.id);
  if (
    !before ||
    before.marketingConsent !== sentConsent ||
    before.consentRevision !== sentRevision
  ) {
    return "skipped";
  }

  const upsert = await upsertLoopsContact({
    properties: buildLoopsContactProperties(draft),
    mode: "routine",
    marketingConsent: sentConsent,
    preferencePending: true,
    apiKey,
  });
  if (!upsert.ok) {
    logLoopsFailure(upsert.code);
    return "failed";
  }

  const stored = await readStamp(admin, row.id);
  if (!stored) return "failed";
  const sentSubscribed = "sentSubscribed" in upsert ? upsert.sentSubscribed : undefined;
  const decision = loopsPreferenceAckDecision({
    preferencePending: true,
    sentSubscribed,
    loopsAccepted: upsert.skipped !== "unconfigured",
    skippedUnconfigured: upsert.skipped === "unconfigured",
    sentConsent,
    sentRevision,
    storedConsent: stored.marketingConsent,
    storedRevision: stored.consentRevision,
  });

  if (decision === "clear") {
    const { error } = await admin
      .from("profiles")
      .update({ marketing_loops_sync_pending: false })
      .eq("id", row.id)
      .eq("marketing_consent", sentConsent)
      .eq("marketing_consent_revision", sentRevision)
      .eq("marketing_loops_sync_pending", true);
    if (error) {
      logLoopsFailure("preference_ack_failed");
      return "failed";
    }
    return "cleared";
  }

  if (decision === "rearm") {
    const { error } = await admin
      .from("profiles")
      .update({ marketing_loops_sync_pending: true })
      .eq("id", row.id)
      .neq("marketing_consent_revision", sentRevision);
    if (error) {
      logLoopsFailure("preference_rearm_failed");
      return "failed";
    }
    return "rearmed";
  }

  return "skipped";
}

function revisionOf(value: unknown): number {
  const revision = typeof value === "number" ? value : Number(value);
  return Number.isFinite(revision) ? revision : 0;
}

async function readStamp(
  admin: SupabaseClient,
  userId: string
): Promise<{ marketingConsent: boolean; consentRevision: number } | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("marketing_consent, marketing_consent_revision")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    marketingConsent: data.marketing_consent === true,
    consentRevision: revisionOf(data.marketing_consent_revision),
  };
}

async function loadBilling(
  admin: SupabaseClient,
  orgId: string
): Promise<{ plan?: string; subscriptionStatus?: string; trialEndsAt?: string }> {
  try {
    const billingEnvironment = resolveBillingEnvironment();
    const [{ data: subscription }, { data: overrides }] = await Promise.all([
      admin
        .from("org_subscriptions")
        .select("*")
        .eq("org_id", orgId)
        .eq("billing_environment", billingEnvironment)
        .maybeSingle(),
      admin
        .from("org_billing_overrides")
        .select("*")
        .eq("org_id", orgId)
        .eq("billing_environment", billingEnvironment),
    ]);
    return loopsBillingFields({
      subscription: subscription ? mapSubscription(subscription) : null,
      activeOverride: selectActiveBillingOverride(
        ((overrides ?? []) as Record<string, unknown>[]).map(mapOverride)
      ),
    });
  } catch {
    return {};
  }
}

function mapSubscription(row: Record<string, unknown>): OrgSubscription {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    billingEnvironment: row.billing_environment as OrgSubscription["billingEnvironment"],
    planCode: row.plan_code as OrgSubscription["planCode"],
    status: row.status as OrgSubscription["status"],
    source: row.source as OrgSubscription["source"],
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeBasePriceId: (row.stripe_base_price_id as string | null) ?? null,
    stripeSeatPriceId: (row.stripe_seat_price_id as string | null) ?? null,
    paidSeatQuantity: Number(row.paid_seat_quantity ?? 0),
    currentPeriodStart: (row.current_period_start as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    trialEndsAt: (row.trial_ends_at as string | null) ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    lastStripeEventCreatedAt: (row.last_stripe_event_created_at as string | null) ?? null,
    lastStripeEventId: (row.last_stripe_event_id as string | null) ?? null,
    pastDueSince: (row.past_due_since as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapOverride(row: Record<string, unknown>): OrgBillingOverride {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    billingEnvironment: row.billing_environment as OrgBillingOverride["billingEnvironment"],
    planCode: row.plan_code as OrgBillingOverride["planCode"],
    overrideType: row.override_type as OrgBillingOverride["overrideType"],
    status: String(row.status ?? ""),
    paidSeatQuantity: Number(row.paid_seat_quantity ?? 0),
    startsAt: String(row.starts_at ?? ""),
    expiresAt: (row.expires_at as string | null) ?? null,
    reason: String(row.reason ?? ""),
    createdBy: (row.created_by as string | null) ?? null,
    operatorRef: (row.operator_ref as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

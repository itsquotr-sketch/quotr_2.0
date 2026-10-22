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
import {
  compareLoopsRetryPriority,
  loopsRetryBackoffMs,
  loopsRetryDisposition,
  MARKETING_LOOPS_RETRY_ATTEMPT_CAP,
  planLoopsRetryWave,
} from "@/lib/communications/loops-automation";
import {
  attachEngagementMarker,
  recordEngagementMarker,
} from "@/lib/communications/engagement";
import { logLoopsFailure, upsertLoopsContact } from "@/lib/communications/loops-client";
import { withConsentLease } from "@/lib/communications/sync-lease";

const DEFAULT_LIMIT = 50;

export type PendingSyncResult = {
  examined: number;
  cleared: number;
  rearmed: number;
  failed: number;
  skipped: number;
  deferred: number;
};

type ProfileRow = {
  id: string;
  org_id: string | null;
  full_name: string | null;
  marketing_consent: boolean | null;
  marketing_loops_sync_pending: boolean | null;
  marketing_consent_revision: number | string | null;
  marketing_loops_retry_attempts: number | string | null;
};

export async function syncPendingMarketingContacts(input: {
  admin: SupabaseClient;
  apiKey: string;
  email?: string;
  userId?: string;
  limit?: number;
  /** Scheduled retry. Existing pending rows stay out unless the caller opts in. */
  autoRetryOnly?: boolean;
  /** Respect backoff and stopped rows. An explicit user or email bypasses this. */
  scheduled?: boolean;
  concurrency?: number;
}): Promise<PendingSyncResult> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const result: PendingSyncResult = {
    examined: 0,
    cleared: 0,
    rearmed: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
  };

  let query = input.admin
    .from("profiles")
    .select(
      "id, org_id, full_name, marketing_consent, marketing_loops_sync_pending, marketing_consent_revision, marketing_loops_retry_attempts"
    )
    .eq("marketing_loops_sync_pending", true);
  if (input.userId) query = query.eq("id", input.userId);
  if (input.autoRetryOnly) query = query.eq("marketing_loops_auto_retry", true);
  if (input.scheduled) {
    const now = new Date().toISOString();
    query = query
      .eq("marketing_loops_retry_stopped", false)
      .or(`marketing_loops_retry_after.is.null,marketing_loops_retry_after.lte.${now}`);
  }
  const { data, error } = await query.limit(limit);

  if (error || !data) {
    logLoopsFailure("pending_unavailable");
    return result;
  }

  const wanted = input.email?.trim().toLowerCase() ?? "";
  const ordered = (data as ProfileRow[])
    .slice()
    .sort((left, right) =>
      compareLoopsRetryPriority(
        {
          marketingConsent: left.marketing_consent === true,
          attempts: attemptsOf(left.marketing_loops_retry_attempts),
        },
        {
          marketingConsent: right.marketing_consent === true,
          attempts: attemptsOf(right.marketing_loops_retry_attempts),
        }
      )
    );
  const queue = [...ordered];
  const started = Date.now();
  while (queue.length > 0) {
    const waveSize = input.scheduled
      ? planLoopsRetryWave({
          elapsedMs: Date.now() - started,
          remaining: queue.length,
          concurrency: input.concurrency,
        })
      : Math.min(input.concurrency ?? 1, queue.length);
    if (waveSize === 0) {
      result.deferred += queue.length;
      break;
    }
    const wave = queue.splice(0, waveSize);
    await Promise.all(
      wave.map(async (row) => {
        const authUser = await input.admin.auth.admin.getUserById(row.id);
        const email = authUser.data.user?.email?.trim() ?? "";
        if (!email || (wanted && email.toLowerCase() !== wanted)) {
          result.skipped += 1;
          return;
        }
        result.examined += 1;
        const outcome = await syncOnePending(
          input.admin,
          input.apiKey,
          row,
          email,
          attemptsOf(row.marketing_loops_retry_attempts)
        );
        result[outcome] += 1;
      })
    );
  }

  return result;
}

async function syncOnePending(
  admin: SupabaseClient,
  apiKey: string,
  row: ProfileRow,
  email: string,
  attempts: number
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
  await attachEngagementMarker(admin, draft);

  const before = await readStamp(admin, row.id);
  if (
    !before ||
    before.marketingConsent !== sentConsent ||
    before.consentRevision !== sentRevision
  ) {
    return "skipped";
  }

  const leased = await withConsentLease({
    claim: async () => {
      const { data, error } = await admin.rpc("claim_marketing_loops_sync", {
        p_user_id: row.id,
        p_revision: sentRevision,
      });
      if (error) {
        logLoopsFailure("lease_unavailable");
        return false;
      }
      return data === true;
    },
    release: async () => {
      await admin.rpc("release_marketing_loops_sync", {
        p_user_id: row.id,
        p_revision: sentRevision,
      });
    },
    run: () => sendPendingContact(admin, apiKey, row.id, draft, sentConsent, sentRevision, attempts),
  });
  if (!leased.claimed) return "skipped";
  return leased.result;
}

async function sendPendingContact(
  admin: SupabaseClient,
  apiKey: string,
  userId: string,
  draft: LoopsContactDraft,
  sentConsent: boolean,
  sentRevision: number,
  attempts: number
): Promise<"cleared" | "rearmed" | "failed" | "skipped"> {
  const upsert = await upsertLoopsContact({
    properties: buildLoopsContactProperties(draft),
    mode: "routine",
    marketingConsent: sentConsent,
    preferencePending: true,
    apiKey,
  });
  if (!upsert.ok) {
    logLoopsFailure(upsert.code);
    await noteLoopsRetryFailure(admin, userId, attempts, upsert.code);
    return "failed";
  }
  if (draft.engagementEligible === true && upsert.skipped !== "unconfigured") {
    await recordEngagementMarker(admin, userId);
  }

  const stored = await readStamp(admin, userId);
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
      .update({
        marketing_loops_sync_pending: false,
        marketing_loops_retry_attempts: 0,
        marketing_loops_retry_after: null,
        marketing_loops_retry_stopped: false,
        marketing_loops_last_error: null,
      })
      .eq("id", userId)
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
      .eq("id", userId)
      .neq("marketing_consent_revision", sentRevision);
    if (error) {
      logLoopsFailure("preference_rearm_failed");
      return "failed";
    }
    return "rearmed";
  }

  return "skipped";
}

function attemptsOf(value: unknown): number {
  const attempts = typeof value === "number" ? value : Number(value);
  return Number.isInteger(attempts) && attempts > 0 ? attempts : 0;
}

async function noteLoopsRetryFailure(
  admin: SupabaseClient,
  userId: string,
  attempts: number,
  code: string
): Promise<void> {
  const safeCode = code.replace(/[^a-z0-9_]/gi, "").slice(0, 64) || "unknown";
  const nextAttempts = attempts + 1;
  const disposition = loopsRetryDisposition(safeCode);
  const stopped = disposition === "permanent" || nextAttempts >= MARKETING_LOOPS_RETRY_ATTEMPT_CAP;
  const { error } = await admin
    .from("profiles")
    .update({
      marketing_loops_retry_attempts: nextAttempts,
      marketing_loops_retry_stopped: stopped,
      marketing_loops_retry_after: stopped
        ? null
        : new Date(Date.now() + loopsRetryBackoffMs(nextAttempts)).toISOString(),
      marketing_loops_last_error: safeCode,
    })
    .eq("id", userId)
    .eq("marketing_loops_sync_pending", true);
  if (error) logLoopsFailure("retry_note_failed");
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

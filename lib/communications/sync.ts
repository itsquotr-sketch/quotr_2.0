import "server-only";

import { getOrgBillingState } from "@/lib/billing/server";
import { loadSharedContactFields } from "@/lib/communications/contact-loader";
import {
  buildLoopsContactProperties,
  loopsBillingFields,
  loopsPreferenceAckDecision,
  type LoopsContactDraft,
  type LoopsSyncMode,
} from "@/lib/communications/contact-mapping";
import {
  logLoopsFailure,
  readLoopsApiKey,
  runIsolatedLoopsTask,
  upsertLoopsContact,
} from "@/lib/communications/loops-client";
import {
  attachEngagementMarker,
  recordEngagementMarker,
} from "@/lib/communications/engagement";
import { withConsentLease } from "@/lib/communications/sync-lease";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;

type ConsentStamp = {
  marketingConsent: boolean;
  consentRevision: number;
};

/**
 * Contact sync for one signed-in user, or for members of one organisation.
 *
 * Email confirmation schedules one background sync after the response.
 * It does not await Loops, and this module does not send the welcome email.
 * The Stripe webhook does not call this module.
 *
 * Pending is cleared only after Loops accepts `subscribed` for the revision
 * still stored. A newer consent change is not cleared by an older attempt.
 * syncOrganisationContacts is not a bulk import and is not scheduled.
 */

export async function recordSignupConsentAndSync(
  supabase: ServerClient
): Promise<void> {
  await runIsolatedLoopsTask(async () => {
    const mode = await applySignupConsent(supabase);
    await syncSessionUserWithinTask(supabase, mode);
  });
}

export async function syncSessionUser(
  supabase: ServerClient,
  mode: LoopsSyncMode
): Promise<void> {
  await runIsolatedLoopsTask(() => syncSessionUserWithinTask(supabase, mode));
}

export async function syncOrganisationContacts(orgId: string): Promise<void> {
  await runIsolatedLoopsTask(() => syncOrganisationContactsWithinTask(orgId));
}

async function applySignupConsent(supabase: ServerClient): Promise<LoopsSyncMode> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "routine";

  const raw = user.user_metadata?.marketing_consent;
  if (typeof raw !== "boolean") return "routine";

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("marketing_consent_source")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return "routine";
  if (profile.marketing_consent_source != null) return "routine";

  const { data: updated, error: writeError } = await supabase.rpc(
    "set_own_marketing_consent",
    { p_consent: raw, p_source: "signup" }
  );
  if (writeError || updated !== true) return "routine";
  return raw ? "explicit_opt_in" : "routine";
}

async function syncSessionUserWithinTask(
  supabase: ServerClient,
  mode: LoopsSyncMode
): Promise<void> {
  const apiKey = readLoopsApiKey();
  if (!apiKey) return;

  const draft = await loadSessionDraft(supabase);
  if (!draft) return;
  const admin = openEngagementAdmin();
  if (admin) await attachEngagementMarker(admin, draft);
  const sent = stampOf(draft);
  const before = await readSessionStamp(supabase, draft.userId);
  if (!sameStamp(before, sent)) return;
  if (draft.preferencePending) {
    await supabase.rpc("mark_own_marketing_loops_auto_retry");
  }

  const leased = await withConsentLease({
    claim: async () => {
      const { data, error } = await supabase.rpc("claim_own_marketing_loops_sync", {
        p_revision: sent.consentRevision,
      });
      if (error) {
        logLoopsFailure("lease_unavailable");
        return false;
      }
      return data === true;
    },
    release: async () => {
      await supabase.rpc("release_own_marketing_loops_sync", {
        p_revision: sent.consentRevision,
      });
    },
    run: async () => {
      const result = await upsertLoopsContact({
        properties: buildLoopsContactProperties(draft),
        mode,
        marketingConsent: draft.marketingConsent,
        preferencePending: draft.preferencePending === true,
        apiKey,
      });
      if (!result.ok) {
        logLoopsFailure(result.code);
        return;
      }
      if (admin && draft.engagementEligible === true && result.skipped !== "unconfigured") {
        await recordEngagementMarker(admin, draft.userId);
      }
      const after = await readSessionStamp(supabase, draft.userId);
      if (!after) return;
      await applySessionAck(supabase, draft, result, after);
    },
  });
  if (!leased.claimed) return;
}

async function syncOrganisationContactsWithinTask(orgId: string): Promise<void> {
  const apiKey = readLoopsApiKey();
  if (!apiKey) return;

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch {
    logLoopsFailure("admin_unconfigured");
    return;
  }

  const shared = await loadSharedContactFields(admin, orgId, await loadBilling(orgId));
  const { data: members, error } = await admin
    .from("organisation_memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .in("status", ["active", "pending_billing"]);

  if (error || !members) {
    logLoopsFailure("members_unavailable");
    return;
  }

  for (const member of members) {
    const userId = typeof member.user_id === "string" ? member.user_id : "";
    if (!userId) continue;

    const authUser = await admin.auth.admin.getUserById(userId);
    const email = authUser.data.user?.email?.trim() ?? "";
    if (!email) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select(
        "full_name, marketing_consent, marketing_loops_sync_pending, marketing_consent_revision"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profile?.marketing_loops_sync_pending !== true) continue;

    const draft: LoopsContactDraft = {
      ...shared,
      userId,
      email,
      fullName: (profile?.full_name as string | null) ?? null,
      marketingConsent: profile?.marketing_consent === true,
      preferencePending: true,
      consentRevision: revisionOf(profile?.marketing_consent_revision),
    };
    await attachEngagementMarker(admin, draft);
    const sent = stampOf(draft);
    const before = await readAdminStamp(admin, userId);
    if (!sameStamp(before, sent)) continue;

    await withConsentLease({
      claim: async () => {
        const { data, error } = await admin.rpc("claim_marketing_loops_sync", {
          p_user_id: userId,
          p_revision: sent.consentRevision,
        });
        if (error) {
          logLoopsFailure("lease_unavailable");
          return false;
        }
        return data === true;
      },
      release: async () => {
        await admin.rpc("release_marketing_loops_sync", {
          p_user_id: userId,
          p_revision: sent.consentRevision,
        });
      },
      run: async () => {
        const result = await upsertLoopsContact({
          properties: buildLoopsContactProperties(draft),
          mode: "routine",
          marketingConsent: draft.marketingConsent,
          preferencePending: draft.preferencePending === true,
          apiKey,
        });
        if (!result.ok) {
          logLoopsFailure(result.code);
          return;
        }
        if (draft.engagementEligible === true && result.skipped !== "unconfigured") {
          await recordEngagementMarker(admin, userId);
        }
        const afterStamp = await readAdminStamp(admin, userId);
        if (!afterStamp) return;
        await applyAdminAck(admin, draft, result, afterStamp);
      },
    });
  }
}

async function loadSessionDraft(supabase: ServerClient): Promise<LoopsContactDraft | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim() ?? "";
  if (!user || !email) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "full_name, org_id, marketing_consent, marketing_loops_sync_pending, marketing_consent_revision"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;

  const orgId = typeof profile.org_id === "string" ? profile.org_id : null;
  const shared = orgId
    ? await loadSharedContactFields(supabase, orgId, await loadBilling(orgId))
    : {};

  return {
    ...shared,
    userId: user.id,
    email,
    fullName: (profile.full_name as string | null) ?? null,
    marketingConsent: profile.marketing_consent === true,
    preferencePending: profile.marketing_loops_sync_pending === true,
    consentRevision: revisionOf(profile.marketing_consent_revision),
  };
}

function openEngagementAdmin(): AdminClient | null {
  try {
    return createAdminClient();
  } catch {
    logLoopsFailure("engagement_marker_unavailable");
    return null;
  }
}

function revisionOf(value: unknown): number {
  const revision = typeof value === "number" ? value : Number(value);
  return Number.isFinite(revision) ? revision : 0;
}

function stampOf(draft: LoopsContactDraft): ConsentStamp {
  return {
    marketingConsent: draft.marketingConsent,
    consentRevision: draft.consentRevision ?? 0,
  };
}

function sameStamp(left: ConsentStamp | null, right: ConsentStamp): boolean {
  return (
    left != null &&
    left.marketingConsent === right.marketingConsent &&
    left.consentRevision === right.consentRevision
  );
}

async function readSessionStamp(
  supabase: ServerClient,
  userId: string
): Promise<ConsentStamp | null> {
  const { data, error } = await supabase
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

async function readAdminStamp(
  admin: AdminClient,
  userId: string
): Promise<ConsentStamp | null> {
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

async function applySessionAck(
  supabase: ServerClient,
  draft: LoopsContactDraft,
  result: { ok: true; skipped?: "unconfigured"; sentSubscribed?: boolean },
  stored: ConsentStamp
): Promise<void> {
  const sent = stampOf(draft);
  const decision = loopsPreferenceAckDecision({
    preferencePending: draft.preferencePending === true,
    sentSubscribed: result.sentSubscribed,
    loopsAccepted: result.skipped !== "unconfigured",
    skippedUnconfigured: result.skipped === "unconfigured",
    sentConsent: sent.marketingConsent,
    sentRevision: sent.consentRevision,
    storedConsent: stored.marketingConsent,
    storedRevision: stored.consentRevision,
  });
  if (decision === "clear") {
    const { error } = await supabase.rpc("acknowledge_own_marketing_loops_sync", {
      p_consent: sent.marketingConsent,
      p_revision: sent.consentRevision,
    });
    if (error) logLoopsFailure("preference_ack_failed");
    return;
  }
  if (decision === "rearm") {
    const { error } = await supabase.rpc("rearm_own_marketing_loops_sync", {
      p_revision: sent.consentRevision,
    });
    if (error) logLoopsFailure("preference_rearm_failed");
  }
}

async function applyAdminAck(
  admin: AdminClient,
  draft: LoopsContactDraft,
  result: { ok: true; skipped?: "unconfigured"; sentSubscribed?: boolean },
  stored: ConsentStamp
): Promise<void> {
  const sent = stampOf(draft);
  const decision = loopsPreferenceAckDecision({
    preferencePending: draft.preferencePending === true,
    sentSubscribed: result.sentSubscribed,
    loopsAccepted: result.skipped !== "unconfigured",
    skippedUnconfigured: result.skipped === "unconfigured",
    sentConsent: sent.marketingConsent,
    sentRevision: sent.consentRevision,
    storedConsent: stored.marketingConsent,
    storedRevision: stored.consentRevision,
  });
  if (decision === "clear") {
    const { error } = await admin
      .from("profiles")
      .update({ marketing_loops_sync_pending: false })
      .eq("id", draft.userId)
      .eq("marketing_consent", sent.marketingConsent)
      .eq("marketing_consent_revision", sent.consentRevision)
      .eq("marketing_loops_sync_pending", true);
    if (error) logLoopsFailure("preference_ack_failed");
    return;
  }
  if (decision === "rearm") {
    const { error } = await admin
      .from("profiles")
      .update({ marketing_loops_sync_pending: true })
      .eq("id", draft.userId)
      .neq("marketing_consent_revision", sent.consentRevision);
    if (error) logLoopsFailure("preference_rearm_failed");
  }
}

async function loadBilling(orgId: string): Promise<{
  plan?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
}> {
  try {
    const state = await getOrgBillingState(orgId);
    return loopsBillingFields({
      subscription: state.subscription,
      activeOverride: state.activeOverride,
    });
  } catch {
    return {};
  }
}

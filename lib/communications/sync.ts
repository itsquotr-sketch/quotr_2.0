import "server-only";

import { getOrgBillingState } from "@/lib/billing/server";
import {
  buildLoopsContactProperties,
  loopsBillingFields,
  loopsOnboardingComplete,
  preferencePendingAfterLoopsAttempt,
  type LoopsContactDraft,
  type LoopsSyncMode,
} from "@/lib/communications/contact-mapping";
import {
  logLoopsFailure,
  readLoopsApiKey,
  runIsolatedLoopsTask,
  upsertLoopsContact,
} from "@/lib/communications/loops-client";
import { resolveFirstRunStage } from "@/lib/setup/first-run-stage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type QueryError = { message?: string } | null;

type CountResult = { count: number | null; error: QueryError };

/**
 * Stage 1 contact sync.
 *
 * Counts (projects, estimates, quotes, rates) are refreshed when a contact
 * is synced. Sync points are provisioning, company basics, pricing basics,
 * company settings that change the mapped fields, profile name changes, and
 * explicit consent changes. Billing fields are read from the billing mirror
 * at those same points. The Stripe webhook does not call Loops.
 * They are not updated on every project or quote action. Lifecycle events
 * are Stage 2.
 *
 * marketing_loops_sync_pending is set by set_own_marketing_consent. A
 * successful Loops update that sent subscribed clears it only when the
 * stored consent still matches. Routine sync sends subscribed only while
 * that flag is true, or when creating a contact that does not exist yet.
 *
 * Every export swallows Loops and loader failures.
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
  await acknowledgeSessionPreference(supabase, draft, result);
}

async function syncOrganisationContactsWithinTask(orgId: string): Promise<void> {
  const apiKey = readLoopsApiKey();
  if (!apiKey) return;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    logLoopsFailure("admin_unconfigured");
    return;
  }

  const shared = await loadOrganisationDraft(admin, orgId);
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
      .select("full_name, marketing_consent, marketing_loops_sync_pending")
      .eq("id", userId)
      .maybeSingle();

    const draft: LoopsContactDraft = {
      ...shared,
      userId,
      email,
      fullName: (profile?.full_name as string | null) ?? null,
      marketingConsent: profile?.marketing_consent === true,
      preferencePending: profile?.marketing_loops_sync_pending === true,
    };

    const result = await upsertLoopsContact({
      properties: buildLoopsContactProperties(draft),
      mode: "routine",
      marketingConsent: draft.marketingConsent,
      preferencePending: draft.preferencePending === true,
      apiKey,
    });
    if (!result.ok) {
      logLoopsFailure(result.code);
      continue;
    }
    await acknowledgeMemberPreference(admin, draft, result);
  }
}

async function loadSessionDraft(
  supabase: ServerClient
): Promise<LoopsContactDraft | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim() ?? "";
  if (!user || !email) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, org_id, marketing_consent, marketing_loops_sync_pending")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;

  const orgId = typeof profile.org_id === "string" ? profile.org_id : null;
  const shared = orgId ? await loadOrganisationDraft(supabase, orgId) : {};

  return {
    ...shared,
    userId: user.id,
    email,
    fullName: (profile.full_name as string | null) ?? null,
    marketingConsent: profile.marketing_consent === true,
    preferencePending: profile.marketing_loops_sync_pending === true,
  };
}

function preferenceWasConfirmed(
  draft: LoopsContactDraft,
  result: { ok: true; skipped?: "unconfigured"; sentSubscribed?: boolean }
): boolean {
  if (result.skipped === "unconfigured") return false;
  return (
    preferencePendingAfterLoopsAttempt({
      preferencePending: draft.preferencePending === true,
      sentSubscribed: result.sentSubscribed,
      loopsAccepted: true,
      storedConsent: draft.marketingConsent,
      sentConsent: draft.marketingConsent,
    }) === false && draft.preferencePending === true
  );
}

async function acknowledgeSessionPreference(
  supabase: ServerClient,
  draft: LoopsContactDraft,
  result: { ok: true; skipped?: "unconfigured"; sentSubscribed?: boolean }
): Promise<void> {
  if (!preferenceWasConfirmed(draft, result)) return;
  const { error } = await supabase.rpc("acknowledge_own_marketing_loops_sync", {
    p_consent: draft.marketingConsent,
  });
  if (error) logLoopsFailure("preference_ack_failed");
}

async function acknowledgeMemberPreference(
  admin: ReturnType<typeof createAdminClient>,
  draft: LoopsContactDraft,
  result: { ok: true; skipped?: "unconfigured"; sentSubscribed?: boolean }
): Promise<void> {
  if (!preferenceWasConfirmed(draft, result)) return;
  const { error } = await admin
    .from("profiles")
    .update({ marketing_loops_sync_pending: false })
    .eq("id", draft.userId)
    .eq("marketing_consent", draft.marketingConsent)
    .eq("marketing_loops_sync_pending", true);
  if (error) logLoopsFailure("preference_ack_failed");
}

async function loadOrganisationDraft(
  supabase: ServerClient | ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<Omit<LoopsContactDraft, "userId" | "email" | "fullName" | "marketingConsent">> {
  const [{ data: organisation }, { data: settings }, hasWork, counts, ratesConfigured, billing] =
    await Promise.all([
      supabase.from("organisations").select("name").eq("id", orgId).maybeSingle(),
      supabase
        .from("organisation_settings")
        .select("trading_name, country, region, onboarding_status, onboarding_step")
        .eq("org_id", orgId)
        .maybeSingle(),
      hasEnabledWorkArea(supabase, orgId),
      loadCounts(supabase, orgId),
      loadRatesConfigured(supabase, orgId),
      loadBilling(orgId),
    ]);

  const onboardingStatus = (settings?.onboarding_status as string | null) ?? null;
  const onboardingStep = (settings?.onboarding_step as string | null) ?? null;
  // `basics` still includes the schema-default country, which is not a user choice.
  const stage = settings
    ? resolveFirstRunStage({
        onboardingStatus,
        onboardingStep,
        hasPrimaryWorkAreas: hasWork,
      })
    : "basics";

  return {
    organisationName: (organisation?.name as string | null) ?? null,
    tradingName: (settings?.trading_name as string | null) ?? null,
    country: (settings?.country as string | null) ?? null,
    countryExplicit: stage !== "basics",
    region: (settings?.region as string | null) ?? null,
    onboardingComplete: settings
      ? loopsOnboardingComplete({
          onboardingStatus,
          onboardingStep,
          hasPrimaryWorkAreas: hasWork,
        })
      : false,
    plan: billing.plan ?? null,
    subscriptionStatus: billing.subscriptionStatus ?? null,
    trialEndsAt: billing.trialEndsAt ?? null,
    projectsCreated: counts.projectsCreated,
    estimatesGenerated: counts.estimatesGenerated,
    quotesSent: counts.quotesSent,
    quotesAccepted: counts.quotesAccepted,
    ratesConfigured,
  };
}

async function hasEnabledWorkArea(
  supabase: ServerClient | ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organisation_work_areas")
    .select("id")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

async function loadCounts(
  supabase: ServerClient | ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<{
  projectsCreated: number | null;
  estimatesGenerated: number | null;
  quotesSent: number | null;
  quotesAccepted: number | null;
}> {
  const [projectsCreated, estimatesGenerated, quotesSent, quotesAccepted] = await Promise.all([
    exactCount(
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("deleted_at", null)
    ),
    exactCount(
      supabase
        .from("estimate_requirement_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
    ),
    exactCount(
      supabase
        .from("quote_events")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("event_type", "quote_sent")
    ),
    exactCount(
      supabase
        .from("quote_acceptances")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
    ),
  ]);

  return { projectsCreated, estimatesGenerated, quotesSent, quotesAccepted };
}

async function exactCount(query: PromiseLike<CountResult>): Promise<number | null> {
  const { count, error } = await query;
  if (error || count == null) return null;
  return count;
}

async function loadRatesConfigured(
  supabase: ServerClient | ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("rates")
    .select("id")
    .eq("org_id", orgId)
    .not("cost_rate", "is", null)
    .limit(1);
  if (error) return null;
  return (data?.length ?? 0) > 0;
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

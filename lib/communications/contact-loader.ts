/**
 * Organisation fields for one Loops contact.
 * Counts and company settings only. No project, client, or quote contents.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { loopsOnboardingComplete } from "@/lib/communications/contact-mapping";
import type { LoopsContactDraft } from "@/lib/communications/contact-mapping";
import { resolveFirstRunStage } from "@/lib/setup/first-run-stage";

type QueryError = { message?: string } | null;
type CountResult = { count: number | null; error: QueryError };

export type SharedContactFields = Omit<
  LoopsContactDraft,
  "userId" | "email" | "fullName" | "marketingConsent" | "preferencePending" | "consentRevision"
>;

export async function loadSharedContactFields(
  supabase: SupabaseClient,
  orgId: string,
  billing: {
    plan?: string;
    subscriptionStatus?: string;
    trialEndsAt?: string;
  }
): Promise<SharedContactFields> {
  const [{ data: organisation }, { data: settings }, hasWork, counts, ratesConfigured] =
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
    ]);

  const onboardingStatus = (settings?.onboarding_status as string | null) ?? null;
  const onboardingStep = (settings?.onboarding_step as string | null) ?? null;
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

async function hasEnabledWorkArea(supabase: SupabaseClient, orgId: string): Promise<boolean> {
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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

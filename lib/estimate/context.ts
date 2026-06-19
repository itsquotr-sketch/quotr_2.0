import type { QualityLevel } from "@/components/assistant/types";
import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import type { EstimateContext } from "@/lib/estimate/types";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "@/lib/scopes/derived-facts";

const DEFAULT_ORGANISATION_SETTINGS: OrganisationSettings = {
  id: "",
  org_id: "",
  default_margin_percent: 33.33,
  default_contingency_percent: 10,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

export async function getEstimateContext(
  projectId: string
): Promise<EstimateContext | { error: string }> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;

  const [
    { data: project, error: projectError },
    { data: workAreas },
    { data: projectFacts },
    { data: constraints },
    { data: organisationSettings },
    { data: rates },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, quality_level")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("work_areas")
      .select("id, type, name, summary, status, sort_order")
      .eq("project_id", projectId)
      .eq("status", "confirmed")
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_facts")
      .select("key, work_area_id, value, source")
      .eq("project_id", projectId),
    supabase
      .from("constraints")
      .select("key, label, value")
      .eq("project_id", projectId),
    supabase
      .from("organisation_settings")
      .select(
        "id, org_id, default_margin_percent, default_contingency_percent, budget_rate_factor, premium_rate_factor, currency, country, region, onboarding_status, onboarding_step, onboarding_completed_at, prefer_user_rates, allow_benchmark_rates, show_profit_in_estimates"
      )
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("rates")
      .select(
        "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
      )
      .eq("org_id", orgId)
      .eq("active", true),
  ]);

  if (projectError || !project) {
    return { error: "Project not found." };
  }

  const confirmedWorkAreas = (workAreas ?? []).map((workArea) => ({
    id: workArea.id,
    type: workArea.type,
    name: workArea.name,
    summary: workArea.summary,
    sort_order: workArea.sort_order ?? 0,
  }));

  const derivedFacts = deriveFactsForProject({
    workAreas: confirmedWorkAreas.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts: projectFacts ?? [],
  });

  const mergedFacts = mergeDerivedFactsIntoRecords(
    projectFacts ?? [],
    derivedFacts
  );

  return {
    project: {
      id: project.id,
      qualityLevel: (project.quality_level as QualityLevel) ?? null,
    },
    confirmedWorkAreas,
    facts: mergedFacts,
    constraints: (constraints ?? []).map((constraint) => ({
      key: constraint.key,
      label: constraint.label,
      value: constraint.value,
    })),
    organisationSettings:
      organisationSettings ?? DEFAULT_ORGANISATION_SETTINGS,
    rates: (rates ?? []) as OrganisationRate[],
  };
}

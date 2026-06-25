import type { QualityLevel } from "@/components/assistant/types";
import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import type { EstimateContext } from "@/lib/estimate/types";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";
import {
  hasLifecycleColumns,
  isMissingLifecycleColumnsError,
  markLifecycleColumnsUnavailable,
} from "@/lib/projects/query-utils";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "@/lib/scopes/derived-facts";

const DEFAULT_ORGANISATION_SETTINGS: OrganisationSettings = {
  id: "",
  org_id: "",
  default_margin_percent: DEFAULT_MARGIN_PERCENT,
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

function mapMaterialWastageSettings(
  row: Record<string, unknown> | null | undefined
): MaterialWastageSettings | null {
  if (!row) {
    return null;
  }

  return {
    defaultMaterialWastagePercent:
      row.default_material_wastage_percent != null
        ? Number(row.default_material_wastage_percent)
        : null,
    deckingWastagePercent:
      row.decking_wastage_percent != null
        ? Number(row.decking_wastage_percent)
        : null,
    sheetMaterialWastagePercent:
      row.sheet_material_wastage_percent != null
        ? Number(row.sheet_material_wastage_percent)
        : null,
    flooringWastagePercent:
      row.flooring_wastage_percent != null
        ? Number(row.flooring_wastage_percent)
        : null,
    paintWastagePercent:
      row.paint_wastage_percent != null
        ? Number(row.paint_wastage_percent)
        : null,
    timberFramingWastagePercent:
      row.timber_framing_wastage_percent != null
        ? Number(row.timber_framing_wastage_percent)
        : null,
  };
}

export async function getEstimateContext(
  projectId: string,
  retried = false
): Promise<EstimateContext | { error: string }> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const lifecycleAvailable = await hasLifecycleColumns(supabase);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, quality_level")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    if (projectError && isMissingLifecycleColumnsError(projectError) && !retried) {
      markLifecycleColumnsUnavailable();
      return getEstimateContext(projectId, true);
    }
    return { error: "Project not found." };
  }

  if (lifecycleAvailable) {
    const { data: lifecycleRow, error: lifecycleError } = await supabase
      .from("projects")
      .select("deleted_at")
      .eq("id", projectId)
      .maybeSingle();

    if (lifecycleError) {
      if (isMissingLifecycleColumnsError(lifecycleError) && !retried) {
        markLifecycleColumnsUnavailable();
        return getEstimateContext(projectId, true);
      }
      return { error: "Project not found." };
    }

    if (lifecycleRow?.deleted_at) {
      return { error: "Project not found." };
    }
  }

  const [
    { data: workAreas },
    { data: projectFacts },
    { data: constraints },
    { data: organisationSettings },
    { data: rates },
  ] = await Promise.all([
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
        "id, org_id, default_margin_percent, default_contingency_percent, budget_rate_factor, premium_rate_factor, currency, country, region, onboarding_status, onboarding_step, onboarding_completed_at, prefer_user_rates, allow_benchmark_rates, show_profit_in_estimates, default_material_wastage_percent, decking_wastage_percent, sheet_material_wastage_percent, flooring_wastage_percent, paint_wastage_percent, timber_framing_wastage_percent"
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
    materialWastageSettings: mapMaterialWastageSettings(organisationSettings),
    rates: (rates ?? []) as OrganisationRate[],
  };
}

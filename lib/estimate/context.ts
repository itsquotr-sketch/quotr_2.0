import type { QualityLevel } from "@/components/assistant/types";
import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import type { EstimateContext } from "@/lib/estimate/types";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProjectForRead } from "@/lib/security/org-ownership-read";
import { DEFAULT_ORGANISATION_SETTINGS } from "@/lib/settings/default-organisation-settings";
import { loadOrganisationSettingsRow } from "@/lib/settings/organisation-settings-reader";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "@/lib/scopes/derived-facts";
import { applyScopeCrossoverResolution } from "@/lib/scopes/scope-crossover";

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

export async function getEstimateContextWithContext(
  context: AuthOrgContext,
  projectId: string
): Promise<EstimateContext | { error: string }> {
  const owned = await assertOrgOwnsActiveProjectForRead(context, projectId);
  if ("error" in owned) {
    return { error: "Project not found." };
  }

  const { supabase, orgId } = context;

  // Ownership already enforced active+org. One quality_level read — no
  // extra lifecycle probe or deleted_at re-query in this request.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, quality_level")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (projectError || !project) {
    return { error: "Project not found." };
  }

  const [
    { data: workAreas },
    { data: projectFacts },
    { data: constraints },
    organisationSettings,
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
    loadOrganisationSettingsRow(orgId),
    supabase
      .from("rates")
      .select(
        "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active, source, source_calibration_id"
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

  const mergedFacts = applyScopeCrossoverResolution({
    workAreas: confirmedWorkAreas.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts: mergeDerivedFactsIntoRecords(
      projectFacts ?? [],
      derivedFacts
    ),
  });

  // Stage 3.1D: Estimate context reads project_facts (+ derived merge) only.
  // Question answers are never estimate inputs.
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
      (organisationSettings as OrganisationSettings | null) ??
      DEFAULT_ORGANISATION_SETTINGS,
    materialWastageSettings: mapMaterialWastageSettings(organisationSettings),
    rates: (rates ?? []) as OrganisationRate[],
  };
}

export async function getEstimateContext(
  projectId: string
): Promise<EstimateContext | { error: string }> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }
  return getEstimateContextWithContext(context, projectId);
}

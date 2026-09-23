/**
 * Lazy promotion of an eligible unresolved estimate requirement into a
 * project-owned Pricing item.
 *
 * `pricing_items` has no `cost_known` column. Known-ness stays derived at
 * read time from notes (`rateSourceType`) and money. Manual provenance uses
 * the existing `pricingSource: "user_override"` shape. No migration.
 *
 * Eager create-from-estimate still copies estimate lines that exist at
 * Pricing creation. Lines that are not rows yet stay display-only until
 * Add price. This module does not insert unanswered Details rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QualityLevel } from "@/components/assistant/types";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { deriveSellFromCost } from "@/lib/commercial-engine/core/sell-from-margin";
import { calculateEstimate } from "@/lib/estimate/calculate-estimate";
import { flooringLineIsManualPricingEligible } from "@/lib/estimate/flooring-commercial";
import { buildLineItemNotes } from "@/lib/estimate/line-items";
import {
  buildPersistedLineItemNotes,
  parseLineItemNotes,
} from "@/lib/estimate/line-item-metadata";
import type { EstimateLineItemInput, EstimateResult } from "@/lib/estimate/types";
import { DEFAULT_ORGANISATION_SETTINGS } from "@/lib/settings/default-organisation-settings";
import {
  resolveCostKnownAfterPricingEdit,
  validateComputedItemForPersistence,
} from "@/lib/pricing/action-guards";
import {
  calculateAuthoritativeDocumentTotals,
  inferPersistedLineCostKnown,
} from "@/lib/pricing/authoritative-document-totals";
import { calculateDocumentTotals, cleanClientLabel } from "@/lib/pricing/calculations";
import {
  calculateAuthoritativePricingItem,
  type PersistedPricingItemMoneyFields,
} from "@/lib/pricing/commercial-engine-adapter";
import { isAuthoritativePricingItemCalculation } from "@/lib/pricing/adoption-authority";
import { mapPricingItem } from "@/lib/pricing/mappers";
import {
  valuesFromEstimateLineItem,
  type EstimateLineItemRow,
} from "@/lib/pricing/recalibration-helpers";
import type { PricingItem, PricingItemType } from "@/lib/pricing/types";

export const PENDING_PRICING_ID_PREFIX = "pending-pricing:";

/** Columns that exist on pricing_items. Never include cost_known. */
export const PRICING_ITEM_UPDATE_SELECT =
  "id, pricing_document_id, project_id, total_cost, total_sell, client_label, notes_internal, manually_edited";

export const MANUAL_PRICE_NOT_ELIGIBLE =
  "This item is not eligible for a manual price.";
export const MANUAL_PRICE_STALE =
  "That pricing requirement is no longer on this estimate.";
export const MANUAL_PRICE_INCOMPLETE =
  "This item still needs details before a price can be saved.";

export type ManualPricingIdentity = {
  projectId: string;
  workAreaId: string;
  nestedItemId: string;
  componentKey: string;
};

export function isPendingPricingItemId(id: string): boolean {
  return id.startsWith(PENDING_PRICING_ID_PREFIX);
}

export function pendingPricingItemId(scopeKey: string): string {
  return `${PENDING_PRICING_ID_PREFIX}${scopeKey}`;
}

export function scopeKeyFromNotes(notes: string | null | undefined): string | null {
  const scope = parseLineItemNotes(notes).metadata.scopeKey?.trim();
  return scope || null;
}

export function inferStoredPricingCostKnown(row: {
  notes_internal?: string | null;
  total_cost?: number | null;
  total_sell?: number | null;
}): boolean {
  const totalCost = Number(row.total_cost ?? 0);
  const totalSell = Number(row.total_sell ?? 0);
  if (
    parseLineItemNotes(row.notes_internal).metadata.rateSourceType === "missing" &&
    totalCost <= 0
  ) {
    return false;
  }
  return inferPersistedLineCostKnown({
    total_cost: totalCost,
    total_sell: totalSell,
  });
}

export function notesWithManualPricingProvenance(
  notes: string | null | undefined,
  costKnown: boolean
): string | null {
  const parsed = parseLineItemNotes(notes);
  const metadata = { ...parsed.metadata };
  if (costKnown) {
    metadata.pricingSource = "user_override";
  } else {
    metadata.rateSourceType = "missing";
    if (metadata.pricingSource === "user_override") {
      metadata.pricingSource = "calculator";
    }
  }
  return buildPersistedLineItemNotes({
    notes: parsed.displayNotes,
    metadata,
  });
}

export function mergeClientNotesPreservingIdentity(
  existingNotes: string | null | undefined,
  clientNotes: string | null | undefined,
  costKnown: boolean
): string | null {
  const existing = parseLineItemNotes(existingNotes);
  const client = parseLineItemNotes(clientNotes ?? existingNotes);
  const metadata = {
    ...client.metadata,
    scopeKey: existing.metadata.scopeKey ?? client.metadata.scopeKey,
    nestedItemId: existing.metadata.nestedItemId ?? client.metadata.nestedItemId,
    pricingOwner: existing.metadata.pricingOwner ?? client.metadata.pricingOwner,
    overlapGroup: existing.metadata.overlapGroup ?? client.metadata.overlapGroup,
    includedInTotal:
      existing.metadata.includedInTotal ?? client.metadata.includedInTotal,
    componentId: existing.metadata.componentId ?? client.metadata.componentId,
  };
  return notesWithManualPricingProvenance(
    buildPersistedLineItemNotes({
      notes: client.displayNotes ?? existing.displayNotes,
      metadata,
    }),
    costKnown
  );
}

export function identityFromPricingItem(
  item: Pick<PricingItem, "work_area_id" | "component_key" | "notes_internal">
): Omit<ManualPricingIdentity, "projectId"> | null {
  const nestedItemId = parseLineItemNotes(item.notes_internal).metadata.nestedItemId?.trim();
  const componentKey = item.component_key?.trim();
  const workAreaId = item.work_area_id?.trim();
  if (!workAreaId || !nestedItemId || !componentKey) return null;
  return { workAreaId, nestedItemId, componentKey };
}

function lineMatchesIdentity(
  line: EstimateLineItemInput,
  identity: Omit<ManualPricingIdentity, "projectId">
): boolean {
  return (
    line.workAreaId === identity.workAreaId &&
    (line.nestedItemId?.trim() ?? "") === identity.nestedItemId &&
    (line.componentKey?.trim() ?? "") === identity.componentKey
  );
}

export function findEstimateLineForIdentity(
  lines: readonly EstimateLineItemInput[],
  identity: Omit<ManualPricingIdentity, "projectId">
): EstimateLineItemInput | null {
  return lines.find((line) => lineMatchesIdentity(line, identity)) ?? null;
}

export function evaluateManualPricingEligibility(
  line: EstimateLineItemInput | null
): { ok: true } | { ok: false; error: string } {
  if (!line) return { ok: false, error: MANUAL_PRICE_STALE };
  const description = line.label?.trim() ?? "";
  if (!description) return { ok: false, error: MANUAL_PRICE_INCOMPLETE };
  if (!line.componentKey?.trim() || !line.nestedItemId?.trim() || !line.workAreaId) {
    return { ok: false, error: MANUAL_PRICE_INCOMPLETE };
  }
  if (
    line.quantity == null ||
    !Number.isFinite(line.quantity) ||
    line.quantity <= 0 ||
    !line.unit?.trim()
  ) {
    return { ok: false, error: MANUAL_PRICE_INCOMPLETE };
  }
  if (line.rateSourceType !== "missing") {
    return { ok: false, error: MANUAL_PRICE_NOT_ELIGIBLE };
  }
  if (line.recommendedCost != null && line.recommendedCost > 0) {
    return { ok: false, error: MANUAL_PRICE_NOT_ELIGIBLE };
  }
  if (!flooringLineIsManualPricingEligible(line)) {
    return { ok: false, error: MANUAL_PRICE_NOT_ELIGIBLE };
  }
  return { ok: true };
}

export function eligibilityLineFromStoredEstimate(
  row: EstimateLineItemRow
): EstimateLineItemInput {
  const parsed = parseLineItemNotes(row.notes);
  const metadata = parsed.metadata;
  return {
    workAreaId: row.work_area_id ?? "",
    workAreaName: "",
    label: row.label,
    category: row.category as EstimateLineItemInput["category"],
    costLow: 0,
    costHigh: 0,
    sellLow: 0,
    sellHigh: 0,
    recommendedCost: Number(row.recommended_cost ?? 0),
    recommendedSell: Number(row.recommended_sell ?? 0),
    grossProfit: 0,
    marginPercent: 0,
    markupPercent: 0,
    quantity: metadata.quantity,
    unit: metadata.unit,
    rateSource: "",
    rateSourceType: metadata.rateSourceType,
    componentKey: row.component_key ?? undefined,
    nestedItemId: metadata.nestedItemId,
    scopeKey: metadata.scopeKey,
    pricingOwner: metadata.pricingOwner,
    includedInTotal: metadata.includedInTotal,
    overlapGroup: metadata.overlapGroup,
    sortOrder: row.sort_order,
    notes: parsed.displayNotes,
    identitySummary: metadata.identitySummary,
  };
}

export function estimateLineRowFromCalculated(
  line: EstimateLineItemInput,
  id = "calculated-line"
): EstimateLineItemRow {
  return {
    id,
    work_area_id: line.workAreaId,
    label: line.label,
    category: line.category,
    recommended_cost: line.recommendedCost,
    recommended_sell: line.recommendedSell,
    notes: buildLineItemNotes(line),
    sort_order: line.sortOrder,
    component_key: line.componentKey ?? null,
  };
}

export function computeManualPromotionMoney(params: {
  totalCost: number;
  totalSell?: number | null;
  quantity: number;
  unit: string;
  itemType: PricingItemType;
  marginPercent: number;
}): { ok: true; fields: PersistedPricingItemMoneyFields; costKnown: boolean } | { ok: false; error: string } {
  const cost = params.totalCost;
  const sellInput = params.totalSell;
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, error: "Pricing amounts cannot be negative." };
  }
  if (sellInput != null && (!Number.isFinite(sellInput) || sellInput < 0)) {
    return { ok: false, error: "Pricing amounts cannot be negative." };
  }

  const sellExplicit = sellInput != null && sellInput > 0;
  let derivedSell = 0;
  try {
    derivedSell = sellExplicit
      ? sellInput
      : cost > 0
        ? deriveSellFromCost(cost, params.marginPercent)
        : 0;
  } catch {
    return { ok: false, error: "Target margin is not valid for this price." };
  }
  const computed = calculateAuthoritativePricingItem(
    {
      calculationMode: "lump_sum",
      quantity: params.quantity,
      unit: params.unit,
      totalCost: cost,
      totalSell: derivedSell,
      itemType: params.itemType,
      manualSellOverride: sellExplicit,
      requestId: "pricing-manual-promotion",
      sourceReferences: ["pricing:manual_requirement"],
    },
    { default_gross_margin_percent: params.marginPercent }
  );

  if (!computed.ok) return { ok: false, error: computed.error };

  const costKnown = resolveCostKnownAfterPricingEdit({
    existingCostKnown: false,
    computedCostKnown: computed.fields.costKnown,
    totalCost: computed.fields.totalCost,
    totalSell: computed.fields.totalSell,
    originatedAsPricingRequired: true,
  });
  if (
    !Number.isFinite(computed.fields.totalCost) ||
    !Number.isFinite(computed.fields.totalSell) ||
    computed.fields.totalCost < 0 ||
    computed.fields.totalSell < 0
  ) {
    return { ok: false, error: "Pricing amounts cannot be negative." };
  }
  const commercial = validateComputedItemForPersistence({
    totalCost: computed.fields.totalCost,
    totalSell: computed.fields.totalSell,
    marginPercent: computed.fields.marginPercent,
    markupPercent: computed.fields.markupPercent,
    costKnown,
  });
  if (!commercial.ok) return commercial;
  return { ok: true, fields: computed.fields, costKnown };
}

export function projectEligibleUnresolvedPricingItems(params: {
  items: readonly PricingItem[];
  estimateLines: readonly EstimateLineItemInput[];
  orgId: string;
  projectId: string;
  pricingDocumentId: string;
}): PricingItem[] {
  const takenScopes = new Set(
    params.items
      .map((item) => scopeKeyFromNotes(item.notes_internal))
      .filter((scope): scope is string => Boolean(scope))
  );
  const projected: PricingItem[] = [];
  for (const line of params.estimateLines) {
    if (!evaluateManualPricingEligibility(line).ok) continue;
    const row = estimateLineRowFromCalculated(line);
    const scope = scopeKeyFromNotes(row.notes);
    if (!scope || takenScopes.has(scope)) continue;
    takenScopes.add(scope);
    const values = valuesFromEstimateLineItem(row);
    const now = new Date(0).toISOString();
    projected.push({
      id: pendingPricingItemId(scope),
      org_id: params.orgId,
      pricing_document_id: params.pricingDocumentId,
      project_id: params.projectId,
      work_area_id: line.workAreaId,
      source_estimate_line_item_id: null,
      component_key: line.componentKey ?? null,
      item_type: values.itemType,
      delivery_method: values.deliveryMethod,
      internal_label: line.label,
      client_label: cleanClientLabel(line.label),
      internal_description: values.internalDescription,
      client_description: null,
      quantity: values.quantity,
      unit: values.unit,
      unit_cost: values.unitCost,
      unit_sell: values.unitSell,
      total_cost: values.totalCost,
      total_sell: values.totalSell,
      gross_profit: values.grossProfit,
      margin_percent: values.marginPercent,
      markup_percent: values.markupPercent,
      visible_on_quote: true,
      optional: false,
      sort_order: line.sortOrder,
      notes_internal: values.notesInternal,
      notes_client: null,
      created_at: now,
      updated_at: now,
      manually_edited: false,
      orphaned: false,
      recalibration_note: null,
      calculation_mode: values.calculationMode,
      productivity_rate: values.productivityRate,
      productivity_unit: values.productivityUnit,
      calculated_quantity: values.calculatedQuantity,
      cost_known: false,
    });
  }
  return projected;
}

type LoadedEstimate = {
  result: EstimateResult;
  marginPercent: number;
  gstRate: number;
};

export async function loadAuthoritativeEstimateForProject(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string
): Promise<LoadedEstimate | { error: string }> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, quality_level, brief_text, deleted_at")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (projectError || !project || project.deleted_at) {
    return { error: "Project not found." };
  }

  const [
    workAreasResult,
    factsResult,
    constraintsResult,
    settingsResult,
    ratesResult,
  ] = await Promise.all([
    supabase
      .from("work_areas")
      .select("id, type, name, summary, status, sort_order")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .eq("status", "confirmed")
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_facts")
      .select("key, work_area_id, value, source")
      .eq("project_id", projectId)
      .eq("org_id", orgId),
    supabase
      .from("constraints")
      .select("key, label, value")
      .eq("project_id", projectId)
      .eq("org_id", orgId),
    supabase
      .from("organisation_settings")
      .select("default_margin_percent, default_gst_rate, allow_benchmark_rates")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("rates")
      .select(
        "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active, source, source_calibration_id"
      )
      .eq("org_id", orgId)
      .eq("active", true),
  ]);

  const settingsRow = settingsResult.data;
  const organisationSettings: OrganisationSettings = {
    ...DEFAULT_ORGANISATION_SETTINGS,
    org_id: orgId,
    default_margin_percent:
      settingsRow?.default_margin_percent != null
        ? Number(settingsRow.default_margin_percent)
        : DEFAULT_ORGANISATION_SETTINGS.default_margin_percent,
    default_gst_rate:
      settingsRow?.default_gst_rate != null
        ? Number(settingsRow.default_gst_rate)
        : DEFAULT_ORGANISATION_SETTINGS.default_gst_rate,
    allow_benchmark_rates:
      settingsRow?.allow_benchmark_rates == null
        ? DEFAULT_ORGANISATION_SETTINGS.allow_benchmark_rates
        : Boolean(settingsRow.allow_benchmark_rates),
  };

  const result = calculateEstimate({
    project: {
      id: project.id as string,
      qualityLevel: (project.quality_level as QualityLevel | null) ?? null,
    },
    confirmedWorkAreas: (workAreasResult.data ?? []).map((workArea) => ({
      id: workArea.id as string,
      type: workArea.type as string,
      name: workArea.name as string,
      summary: (workArea.summary as string | null) ?? null,
      sort_order: Number(workArea.sort_order ?? 0),
    })),
    facts: (factsResult.data ?? []).map((fact) => ({
      key: fact.key as string,
      work_area_id: fact.work_area_id as string,
      value: fact.value,
      source: (fact.source as string | null) ?? undefined,
    })),
    constraints: (constraintsResult.data ?? []).map((constraint) => ({
      key: constraint.key as string,
      label: (constraint.label as string | null) ?? constraint.key,
      value: constraint.value,
    })),
    organisationSettings,
    materialWastageSettings: null,
    rates: (ratesResult.data ?? []) as OrganisationRate[],
    briefText: typeof project.brief_text === "string" ? project.brief_text : null,
  });

  return {
    result,
    marginPercent: organisationSettings.default_margin_percent,
    gstRate: organisationSettings.default_gst_rate ?? 15,
  };
}

function pricingRowMatchesScope(
  row: { notes_internal?: string | null; component_key?: string | null; work_area_id?: string | null },
  scopeKey: string,
  identity: Omit<ManualPricingIdentity, "projectId">
): boolean {
  if (scopeKeyFromNotes(row.notes_internal) === scopeKey) return true;
  const nested = parseLineItemNotes(row.notes_internal).metadata.nestedItemId?.trim();
  return (
    row.work_area_id === identity.workAreaId &&
    row.component_key === identity.componentKey &&
    nested === identity.nestedItemId
  );
}

export async function saveManualPriceForUnresolvedRequirement(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    identity: ManualPricingIdentity;
    pricingDocumentId: string;
    totalCost: number;
    totalSell?: number | null;
  }
): Promise<
  | { error: string }
  | {
      success: true;
      item: PricingItem | null;
      documentId: string;
      created: boolean;
    }
> {
  const { data: workArea, error: workAreaError } = await supabase
    .from("work_areas")
    .select("id, project_id")
    .eq("id", params.identity.workAreaId)
    .eq("org_id", params.orgId)
    .maybeSingle();
  if (workAreaError || !workArea || workArea.project_id !== params.identity.projectId) {
    return { error: "Work area not found." };
  }

  const { data: document, error: documentError } = await supabase
    .from("pricing_documents")
    .select("*")
    .eq("id", params.pricingDocumentId)
    .eq("project_id", params.identity.projectId)
    .eq("org_id", params.orgId)
    .maybeSingle();
  if (documentError || !document) {
    return { error: "Pricing document not found." };
  }

  const loaded = await loadAuthoritativeEstimateForProject(
    supabase,
    params.orgId,
    params.identity.projectId
  );
  if ("error" in loaded) return loaded;

  const line = findEstimateLineForIdentity(loaded.result.lineItems, params.identity);
  const eligible = evaluateManualPricingEligibility(line);
  if (!eligible.ok) return { error: eligible.error };
  if (!line) return { error: MANUAL_PRICE_STALE };

  const estimateRow = estimateLineRowFromCalculated(line);
  const scopeKey = scopeKeyFromNotes(estimateRow.notes);
  if (!scopeKey) return { error: MANUAL_PRICE_INCOMPLETE };

  const values = valuesFromEstimateLineItem(estimateRow);
  const money = computeManualPromotionMoney({
    totalCost: params.totalCost,
    totalSell: params.totalSell,
    quantity: line.quantity ?? values.quantity ?? 0,
    unit: line.unit ?? values.unit ?? "",
    itemType: values.itemType,
    marginPercent: loaded.marginPercent,
  });
  if (!money.ok) return money;

  const { data: existingRows, error: existingError } = await supabase
    .from("pricing_items")
    .select("*")
    .eq("pricing_document_id", params.pricingDocumentId)
    .eq("org_id", params.orgId)
    .eq("project_id", params.identity.projectId);
  if (existingError) return { error: "Could not save pricing changes. Please try again." };

  const matches = (existingRows ?? []).filter((row) =>
    pricingRowMatchesScope(row, scopeKey, params.identity)
  );
  matches.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  const notes = notesWithManualPricingProvenance(values.notesInternal, money.costKnown);
  const manuallyEdited = money.costKnown && money.fields.totalCost > 0;
  const patch = {
    internal_label: line.label,
    client_label: cleanClientLabel(line.label),
    internal_description: values.internalDescription,
    quantity: line.quantity,
    unit: line.unit,
    unit_cost: money.fields.unitCost,
    unit_sell: money.fields.unitSell,
    total_cost: money.fields.totalCost,
    total_sell: money.fields.totalSell,
    gross_profit: money.fields.grossProfit,
    margin_percent: money.fields.marginPercent,
    markup_percent: money.fields.markupPercent,
    calculation_mode: money.fields.calculationMode,
    productivity_rate: money.fields.productivityRate,
    productivity_unit: money.fields.productivityUnit,
    calculated_quantity: money.fields.calculatedQuantity,
    item_type: values.itemType,
    delivery_method: values.deliveryMethod,
    work_area_id: params.identity.workAreaId,
    component_key: params.identity.componentKey,
    notes_internal: notes,
    manually_edited: manuallyEdited,
    orphaned: false,
  };

  if (!manuallyEdited && matches.length === 0) {
    return {
      success: true,
      item: null,
      documentId: params.pricingDocumentId,
      created: false,
    };
  }

  let keptId: string;
  let created = false;
  if (matches.length === 0) {
    const sortOrder =
      (existingRows ?? []).reduce(
        (max, row) => Math.max(max, Number(row.sort_order ?? 0)),
        -1
      ) + 1;
    const inserted = await supabase
      .from("pricing_items")
      .insert({
        org_id: params.orgId,
        pricing_document_id: params.pricingDocumentId,
        project_id: params.identity.projectId,
        visible_on_quote: true,
        optional: false,
        sort_order: sortOrder,
        ...patch,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      return { error: "Could not save pricing changes. Please try again." };
    }
    keptId = inserted.data.id as string;
    created = true;
  } else {
    keptId = matches[0].id as string;
    const updated = await supabase
      .from("pricing_items")
      .update(patch)
      .eq("id", keptId)
      .eq("org_id", params.orgId)
      .eq("project_id", params.identity.projectId);
    if (updated.error) {
      return { error: "Could not save pricing changes. Please try again." };
    }
  }

  if (matches.length > 1) {
    const extraIds = matches.slice(1).map((row) => row.id as string);
    await supabase
      .from("pricing_items")
      .delete()
      .eq("org_id", params.orgId)
      .eq("project_id", params.identity.projectId)
      .in("id", extraIds);
  }

  const reread = await supabase
    .from("pricing_items")
    .select("*")
    .eq("pricing_document_id", params.pricingDocumentId)
    .eq("org_id", params.orgId)
    .eq("project_id", params.identity.projectId);
  const still = (reread.data ?? []).filter((row) =>
    pricingRowMatchesScope(row, scopeKey, params.identity)
  );
  if (still.length > 1) {
    still.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const survivor = still[0].id as string;
    if (survivor !== keptId) {
      await supabase
        .from("pricing_items")
        .update(patch)
        .eq("id", survivor)
        .eq("org_id", params.orgId);
      keptId = survivor;
    }
    const extras = still.slice(1).map((row) => row.id as string);
    await supabase
      .from("pricing_items")
      .delete()
      .eq("org_id", params.orgId)
      .in("id", extras.filter((id) => id !== keptId));
  }

  await refreshPricingDocumentTotals(
    supabase,
    params.orgId,
    params.pricingDocumentId,
    Number(document.gst_rate ?? loaded.gstRate)
  );

  const { data: saved, error: savedError } = await supabase
    .from("pricing_items")
    .select(PRICING_ITEM_UPDATE_SELECT)
    .eq("id", keptId)
    .eq("org_id", params.orgId)
    .maybeSingle();
  if (savedError || !saved) return { error: "Pricing item not found." };

  const { data: full } = await supabase
    .from("pricing_items")
    .select("*")
    .eq("id", keptId)
    .eq("org_id", params.orgId)
    .maybeSingle();
  if (!full) return { error: "Pricing item not found." };

  return {
    success: true,
    item: mapPricingItem(full),
    documentId: params.pricingDocumentId,
    created,
  };
}

export async function refreshPricingDocumentTotals(
  supabase: SupabaseClient,
  orgId: string,
  pricingDocumentId: string,
  gstRate?: number
): Promise<void> {
  const { data: document } = await supabase
    .from("pricing_documents")
    .select("gst_rate")
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId)
    .maybeSingle();
  const rate = gstRate ?? Number(document?.gst_rate ?? 15);
  const { data: items, error } = await supabase
    .from("pricing_items")
    .select("total_cost, total_sell, visible_on_quote")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", orgId);
  if (error) return;
  const mapped = (items ?? []).map((item) => ({
    total_cost: Number(item.total_cost ?? 0),
    total_sell: Number(item.total_sell ?? 0),
    visible: item.visible_on_quote !== false,
  }));
  const totals = isAuthoritativePricingItemCalculation()
    ? calculateAuthoritativeDocumentTotals(mapped, rate, `pricing-doc-${pricingDocumentId}`)
    : {
        ok: true as const,
        totals: calculateDocumentTotals(mapped, rate),
      };
  if (!totals.ok) return;
  await supabase
    .from("pricing_documents")
    .update({
      subtotal_cost: totals.totals.subtotalCost,
      subtotal_sell: totals.totals.subtotalSell,
      gross_profit: totals.totals.grossProfit,
      margin_percent: totals.totals.marginPercent,
      markup_percent: totals.totals.markupPercent,
      gst_amount: totals.totals.gstAmount,
      total_incl_gst: totals.totals.totalInclGst,
      status: "draft",
      reviewed_at: null,
    })
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId);
}

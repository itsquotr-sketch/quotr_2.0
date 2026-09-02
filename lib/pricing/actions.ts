"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { buildPricingNotesFromEstimateLineItem } from "@/lib/estimate/line-item-metadata";
import { isEstimateReadyForPricing } from "@/lib/estimate/persist-estimate-generation";
import { logPricingAuditEvent } from "@/lib/audit/pricing-audit-log";
import { toUserError } from "@/lib/errors/user-message";
import { entitlementDeniedError } from "@/lib/billing/entitlement-server";
import {
  parsePricingInput,
  validateComputedItemForPersistence,
} from "@/lib/pricing/action-guards";
import {
  addPricingItemInputSchema,
  createPricingFromEstimateInputSchema,
  deleteManualPricingItemsInputSchema,
  deletePricingItemInputSchema,
  duplicatePricingItemInputSchema,
  markPricingReviewedInputSchema,
  setPricingItemsQuoteVisibilityInputSchema,
  updatePricingDocumentInputSchema,
  updatePricingItemInputSchema,
} from "@/lib/pricing/schemas";
import {
  isAuthOrgSuccess,
  requireAuthOrgContext,
} from "@/lib/security/auth-org-context";
import {
  assertOrgOwnsEstimate,
  assertOrgOwnsPricingDocument,
  assertOrgOwnsPricingItem,
  assertOrgOwnsActiveProject,
  assertOrgOwnsWorkArea,
} from "@/lib/security/org-ownership";
import {
  addDaysIsoDate,
  calculateDocumentTotals,
  calculatePricingItemTotals,
  cleanClientLabel,
  defaultDeliveryMethod,
  parseStringArray,
  todayIsoDate,
} from "@/lib/pricing/calculations";
import { isAuthoritativePricingItemCalculation } from "@/lib/pricing/adoption-authority";
import {
  calculateAuthoritativePricingItem,
  calculateBlankPricingItem,
  type PersistedPricingItemMoneyFields,
} from "@/lib/pricing/commercial-engine-adapter";
import { calculateAuthoritativeDocumentTotals } from "@/lib/pricing/authoritative-document-totals";
import { valuesFromEstimateLineItem } from "@/lib/pricing/recalibration-helpers";
import { buildManualScopePricingNotes } from "@/lib/work-areas/scope-items/pricing-bridge";
import {
  buildScopeSummaryFromWorkAreas,
  mapPricingDocument,
  mapPricingItem,
} from "@/lib/pricing/mappers";
import {
  coercePersistedGstRate,
  resolveCreatePricingFromEstimateGstRates,
  resolvePricingGstForUpdate,
  resolveStoredPricingDocumentGstRate,
} from "@/lib/pricing/gst-source";
import { getOrgQuoteDefaultsForOrg } from "@/lib/settings/company-actions";
import {
  formatEstimateNarrativeForInternalNotes,
  resolveClientQuoteAssumptions,
  resolveClientQuoteExclusions,
} from "@/lib/quotes/client-fields";
import {
  resolveTermsForSnapshot,
} from "@/lib/settings/snapshot";
import {
  getLatestPricingSummaryWithContext,
  getPricingWorkspaceDataWithContext,
  getProjectWorkspaceTabContextWithContext,
} from "@/lib/pricing/pricing-loaders";
import type {
  PricingActionState,
  PricingDocumentInput,
  PricingItemInput,
  PricingSummary,
  PricingWorkspaceData,
} from "@/lib/pricing/types";
import { ACTIVE_PIPELINE_STATUSES } from "@/lib/projects/status";

const PRICING_SAVE_FAILED =
  "Could not save pricing changes. Please try again.";

async function loadOwnedPricingDocument(pricingDocumentId: string) {
  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const owned = await assertOrgOwnsPricingDocument(auth, pricingDocumentId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const { data: document, error } = await auth.supabase
    .from("pricing_documents")
    .select("*")
    .eq("id", pricingDocumentId)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (error || !document) {
    return { error: "Pricing document not found." as const };
  }

  return { ...auth, document: mapPricingDocument(document) };
}

async function recalculateAndPersistDocumentTotals(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  pricingDocumentId: string,
  gstRate: number,
  resetReview = true
) {
  const { data: items, error } = await supabase
    .from("pricing_items")
    .select("total_cost, total_sell, visible_on_quote")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[pricing-recalc-load]", error.message);
    }
    throw new Error(PRICING_SAVE_FAILED);
  }

  const mappedItems = (items ?? []).map((item) => ({
    total_cost: Number(item.total_cost ?? 0),
    total_sell: Number(item.total_sell ?? 0),
    visible: item.visible_on_quote !== false,
  }));

  let totals: {
    subtotalCost: number;
    subtotalSell: number;
    grossProfit: number;
    marginPercent: number;
    markupPercent: number;
    gstAmount: number;
    totalInclGst: number;
  };

  if (isAuthoritativePricingItemCalculation()) {
    const authoritative = calculateAuthoritativeDocumentTotals(
      mappedItems,
      gstRate,
      `pricing-doc-${pricingDocumentId}`
    );
    if (!authoritative.ok) {
      if (process.env.NODE_ENV === "development") {
        console.error("[pricing-recalc-engine]", authoritative.error);
      }
      throw new Error(PRICING_SAVE_FAILED);
    }
    totals = authoritative.totals;
  } else {
    totals = calculateDocumentTotals(mappedItems, gstRate);
  }

  const update: Record<string, string | number | null> = {
    subtotal_cost: totals.subtotalCost,
    subtotal_sell: totals.subtotalSell,
    gross_profit: totals.grossProfit,
    margin_percent: totals.marginPercent,
    markup_percent: totals.markupPercent,
    gst_amount: totals.gstAmount,
    total_incl_gst: totals.totalInclGst,
  };

  if (resetReview) {
    update.status = "draft";
    update.reviewed_at = null;
  }

  const { error: updateError } = await supabase
    .from("pricing_documents")
    .update(update)
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId);

  if (updateError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[pricing-recalc-update]", updateError.message);
    }
    throw new Error(PRICING_SAVE_FAILED);
  }
}

function computePricingItemMoneyFields(input: {
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  unitSell?: number | null;
  totalCost?: number | null;
  totalSell?: number | null;
  itemType?: import("@/lib/pricing/types").PricingItemType;
  calculationMode?: import("@/lib/pricing/types").CalculationMode | null;
  productivityRate?: number | null;
  productivityUnit?: string | null;
  calculatedQuantity?: number | null;
  manualSellOverride?: boolean;
  requestId?: string;
  sourceReferences?: readonly string[];
}):
  | { ok: true; fields: PersistedPricingItemMoneyFields }
  | { ok: false; error: string } {
  if (isAuthoritativePricingItemCalculation()) {
    const result = calculateAuthoritativePricingItem({
      quantity: input.quantity,
      unit: input.unit,
      unitCost: input.unitCost,
      unitSell: input.unitSell,
      totalCost: input.totalCost,
      totalSell: input.totalSell,
      itemType: input.itemType,
      calculationMode: input.calculationMode,
      productivityRate: input.productivityRate,
      productivityUnit: input.productivityUnit,
      calculatedQuantity: input.calculatedQuantity,
      manualSellOverride: input.manualSellOverride,
      requestId: input.requestId,
      sourceReferences: input.sourceReferences,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, fields: result.fields };
  }

  const legacy = calculatePricingItemTotals({
    quantity: input.quantity,
    unit: input.unit,
    unitCost: input.unitCost,
    unitSell: input.unitSell,
    totalCost: input.totalCost,
    totalSell: input.totalSell,
    itemType: input.itemType,
    calculationMode: input.calculationMode,
    productivityRate: input.productivityRate,
    productivityUnit: input.productivityUnit,
    calculatedQuantity: input.calculatedQuantity,
  });
  return {
    ok: true,
    fields: {
      quantity: legacy.quantity,
      unit: input.unit ?? null,
      unitCost: legacy.unitCost,
      unitSell: legacy.unitSell,
      totalCost: legacy.totalCost,
      totalSell: legacy.totalSell,
      grossProfit: legacy.grossProfit,
      marginPercent: legacy.marginPercent,
      markupPercent: legacy.markupPercent,
      calculationMode:
        legacy.calculationMode ?? input.calculationMode ?? "quantity_rate",
      productivityRate: legacy.productivityRate ?? null,
      productivityUnit: legacy.productivityUnit ?? null,
      calculatedQuantity: legacy.calculatedQuantity ?? null,
      costKnown: !(legacy.totalCost === 0 && legacy.totalSell > 0),
    },
  };
}

function revalidatePricingProjectPath(
  projectId: string,
  pricingDocumentId?: string
) {
  revalidatePath(`/app/projects/${projectId}`);
  if (pricingDocumentId) {
    revalidatePath(`/app/projects/${projectId}/pricing/${pricingDocumentId}`);
  }
}

function revalidatePricingDashboard(
  projectId: string,
  pricingDocumentId?: string
) {
  revalidatePath("/app/dashboard");
  revalidatePricingProjectPath(projectId, pricingDocumentId);
}

async function loadPricingDocumentById(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  pricingDocumentId: string
) {
  const { data, error } = await supabase
    .from("pricing_documents")
    .select("*")
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPricingDocument(data);
}

export async function getLatestPricingSummary(
  projectId: string
): Promise<PricingSummary | null> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return null;
  }
  return getLatestPricingSummaryWithContext(auth, projectId);
}

export async function getPricingSummariesForProjects(
  projectIds: string[]
): Promise<Map<string, PricingSummary>> {
  const auth = await requireAuthOrgContext();
  const result = new Map<string, PricingSummary>();
  if (!auth.ok || projectIds.length === 0) {
    return result;
  }

  const { data, error } = await auth.supabase
    .from("pricing_documents")
    .select("id, status, project_id, created_at, needs_recalibration")
    .eq("org_id", auth.orgId)
    .in("project_id", projectIds)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return result;
  }

  for (const row of data) {
    if (!result.has(row.project_id)) {
      result.set(row.project_id, {
        id: row.id,
        status: row.status as PricingSummary["status"],
        needsRecalibration: Boolean(row.needs_recalibration),
      });
    }
  }

  return result;
}

export async function getProjectWorkspaceTabContext(projectId: string) {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return {
      hasEstimate: false,
      estimateIsStale: false,
      pricingSummary: null,
    };
  }

  return getProjectWorkspaceTabContextWithContext(auth, projectId);
}

export async function getPricingWorkspaceData(
  projectId: string,
  pricingDocumentId: string
): Promise<PricingWorkspaceData> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    notFound();
  }

  return getPricingWorkspaceDataWithContext(auth, projectId, pricingDocumentId);
}

export async function createPricingFromEstimate(input: {
  projectId: string;
  estimateId?: string;
}): Promise<PricingActionState> {
  const parsed = parsePricingInput(createPricingFromEstimateInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, user, orgId } = auth;
  const denied = await entitlementDeniedError(orgId, "pricing.access");
  if (denied) return denied;
  const { projectId, estimateId } = parsed.data;

  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  if (estimateId) {
    const ownedEstimate = await assertOrgOwnsEstimate(
      auth,
      estimateId,
      projectId
    );
    if ("error" in ownedEstimate) {
      return { error: ownedEstimate.error };
    }
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, client_name, site_address, brief_text, business_status, deleted_at")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (projectError || !project || project.deleted_at) {
    return { error: "Project not found." };
  }

  let estimateQuery = supabase
    .from("estimates")
    .select("*")
    .eq("project_id", projectId)
    .eq("org_id", orgId);

  if (estimateId) {
    estimateQuery = estimateQuery.eq("id", estimateId);
  }

  const { data: estimate, error: estimateError } =
    await estimateQuery.maybeSingle();

  if (estimateError || !estimate) {
    return {
      error: "Generate a quick estimate before preparing final pricing.",
    };
  }

  if (estimate.is_stale) {
    return {
      error: "Regenerate the estimate before preparing final pricing.",
    };
  }

  const pricingGeneration = isEstimateReadyForPricing(
    {
      estimateId: estimate.id as string,
      requirementGenerationId:
        (estimate.requirement_generation_id as string | null) ?? null,
      latestRequirementSnapshotId:
        (estimate.latest_requirement_snapshot_id as string | null) ?? null,
      status: (estimate.status as string | null) ?? null,
      isStale: Boolean(estimate.is_stale),
    }
  );
  if (!pricingGeneration.ok) {
    return {
      error: "Regenerate the estimate before preparing final pricing.",
    };
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimate.id)
    .eq("org_id", orgId)
    .order("sort_order");

  if (lineItemsError) {
    return {
      error: toUserError(lineItemsError, "pricing-create-line-items", PRICING_SAVE_FAILED),
    };
  }

  const { data: workAreas } = await supabase
    .from("work_areas")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .eq("status", "confirmed");

  const workAreaNames = (workAreas ?? []).map((workArea) => workArea.name);
  const orgDefaults = await getOrgQuoteDefaultsForOrg(supabase, orgId);
  const assumptions = resolveClientQuoteAssumptions({
    pricingClientAssumptions: [],
    orgDefaults,
  });
  const exclusions = resolveClientQuoteExclusions({
    pricingClientExclusions: [],
    orgDefaults,
  });
  const terms = resolveTermsForSnapshot(null, orgDefaults);
  const internalNotes = formatEstimateNarrativeForInternalNotes({
    assumptions: parseStringArray(estimate.assumptions),
    exclusions: parseStringArray(estimate.exclusions),
  });
  // C-28 / CD-09: organisation GST seeds the document; the same rate must
  // drive insert totals and the post-item recalculation (never hardcoded 15).
  const createGst = resolveCreatePricingFromEstimateGstRates(
    orgDefaults.defaultGstRate
  );
  const gstRate = createGst.documentGstRate;
  const validUntil = addDaysIsoDate(orgDefaults.defaultQuoteValidityDays);

  // Map all estimate lines through the authoritative engine BEFORE any insert.
  // Fail closed without creating a partial document.
  type MappedPricingItemRow = Record<string, unknown>;
  const pricingItemRows: MappedPricingItemRow[] = [];
  const aggregateLines: Array<{
    total_cost: number;
    total_sell: number;
    cost_known: boolean;
  }> = [];

  if (lineItems && lineItems.length > 0) {
    for (let index = 0; index < lineItems.length; index += 1) {
      const lineItem = lineItems[index];
      let values: ReturnType<typeof valuesFromEstimateLineItem>;
      try {
        values = valuesFromEstimateLineItem(lineItem);
      } catch (err) {
        return {
          error:
            err instanceof Error
              ? err.message
              : "Failed to calculate pricing from estimate line.",
        };
      }
      const displayNotes = lineItem.notes?.split("\n__quotr_meta__:")[0]?.trim();

      aggregateLines.push({
        total_cost: values.totalCost,
        total_sell: values.totalSell,
        cost_known: values.costKnown,
      });

      pricingItemRows.push({
        org_id: orgId,
        pricing_document_id: null, // filled after document insert
        project_id: projectId,
        work_area_id: lineItem.work_area_id,
        source_estimate_line_item_id: lineItem.id,
        component_key: (lineItem.component_key as string | null) ?? null,
        item_type: values.itemType,
        delivery_method: values.deliveryMethod,
        internal_label: lineItem.label,
        client_label: cleanClientLabel(lineItem.label),
        internal_description: displayNotes || null,
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
        calculation_mode: values.calculationMode,
        productivity_rate: values.productivityRate,
        productivity_unit: values.productivityUnit,
        calculated_quantity: values.calculatedQuantity,
        visible_on_quote: true,
        optional: false,
        sort_order: lineItem.sort_order ?? index,
        notes_internal: buildPricingNotesFromEstimateLineItem(lineItem.notes),
      });
    }
  }

  // User-authored scope without calculator support → editable stubs, not $0
  // calculated money. Presentation shows "Pricing required" until the builder
  // enters a rate/lump sum. Does not change Stage 2B commercial formulas.
  {
    const { data: manualItems, error: manualError } = await supabase
      .from("work_area_scope_items")
      .select("id, work_area_id, title, description")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .eq("origin", "user");

    // Soft-skip when migration 030 is not yet applied on this environment.
    if (!manualError && manualItems && manualItems.length > 0) {
      const ids = manualItems.map((row) => String(row.id));
      const { data: decisions } = await supabase
        .from("work_area_scope_item_decisions")
        .select("scope_item_id, decision_type, decided_at")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .in("scope_item_id", ids);

      const latestByItem = new Map<string, string>();
      for (const d of [...(decisions ?? [])].sort((a, b) =>
        String(a.decided_at).localeCompare(String(b.decided_at))
      )) {
        latestByItem.set(String(d.scope_item_id), String(d.decision_type));
      }

      let sortBase = pricingItemRows.length;
      for (const row of manualItems) {
        const decision = latestByItem.get(String(row.id)) ?? "INCLUDE";
        if (decision === "EXCLUDE") continue;

        const title = String(row.title).trim();
        if (!title) continue;

        // Stub: 0/0 with explicit cost_known=false so document honesty
        // reflects unpriced coverage — not a fabricated free line.
        aggregateLines.push({
          total_cost: 0,
          total_sell: 0,
          cost_known: false,
        });

        pricingItemRows.push({
          org_id: orgId,
          pricing_document_id: null,
          project_id: projectId,
          work_area_id: row.work_area_id,
          source_estimate_line_item_id: null,
          item_type: "allowance",
          delivery_method: "allowance",
          internal_label: title,
          client_label: cleanClientLabel(title),
          internal_description:
            row.description != null ? String(row.description) : null,
          client_description: null,
          quantity: 1,
          unit: "item",
          unit_cost: null,
          unit_sell: null,
          total_cost: 0,
          total_sell: 0,
          gross_profit: 0,
          margin_percent: 0,
          markup_percent: 0,
          calculation_mode: "lump_sum",
          productivity_rate: null,
          productivity_unit: null,
          calculated_quantity: null,
          visible_on_quote: true,
          optional: false,
          sort_order: sortBase++,
          notes_internal: buildManualScopePricingNotes({
            title,
            description:
              row.description != null ? String(row.description) : null,
          }),
        });
      }
    }
  }

  const documentTotalsResult = isAuthoritativePricingItemCalculation()
    ? calculateAuthoritativeDocumentTotals(
        aggregateLines,
        gstRate,
        `create-from-estimate-${estimate.id}`
      )
    : (() => {
        const legacy = calculateDocumentTotals(aggregateLines, gstRate);
        return {
          ok: true as const,
          totals: {
            ...legacy,
            costKnown: true,
            record: null,
          },
        };
      })();
  if (!documentTotalsResult.ok) {
    return { error: documentTotalsResult.error };
  }
  const documentTotals = documentTotalsResult.totals;

  const requirementSnapshotId =
    (estimate.latest_requirement_snapshot_id as string | null) ?? null;

  const pricingDocumentInsert: Record<string, unknown> = {
      org_id: orgId,
      project_id: projectId,
      estimate_id: estimate.id,
      requirement_snapshot_id: requirementSnapshotId,
      needs_recalibration: false,
      recalibration_status: "current",
      title: `Final pricing — ${project.title}`,
      status: "draft",
      client_name: project.client_name,
      site_address: project.site_address,
      pricing_date: todayIsoDate(),
      valid_until: validUntil,
      // Authoritative aggregate from mapped items — not estimate snapshot GP triad.
      subtotal_cost: documentTotals.subtotalCost,
      subtotal_sell: documentTotals.subtotalSell,
      gross_profit: documentTotals.grossProfit,
      margin_percent: documentTotals.marginPercent,
      markup_percent: documentTotals.markupPercent,
      gst_rate: gstRate,
      gst_amount: documentTotals.gstAmount,
      total_incl_gst: documentTotals.totalInclGst,
      scope_summary: buildScopeSummaryFromWorkAreas(
        workAreaNames,
        project.brief_text
      ),
      assumptions,
      exclusions,
      terms,
      internal_notes: internalNotes,
      created_by: user.id,
  };

  let insertDocError: { message: string } | null = null;
  let pricingDocument: { id: string } | null = null;

  {
    const attempt = await supabase
      .from("pricing_documents")
      .insert(pricingDocumentInsert)
      .select("id")
      .single();
    insertDocError = attempt.error;
    pricingDocument = attempt.data;
    if (
      insertDocError?.message?.includes("requirement_snapshot_id") &&
      pricingDocumentInsert.requirement_snapshot_id != null
    ) {
      const retryPayload = { ...pricingDocumentInsert };
      delete retryPayload.requirement_snapshot_id;
      const retry = await supabase
        .from("pricing_documents")
        .insert(retryPayload)
        .select("id")
        .single();
      insertDocError = retry.error;
      pricingDocument = retry.data;
    }
  }

  if (insertDocError || !pricingDocument) {
    return {
      error: toUserError(
        insertDocError,
        "pricing-create-document",
        "Failed to create pricing."
      ),
    };
  }

  const pricingDocumentId = pricingDocument.id;

  if (pricingItemRows.length > 0) {
    for (const row of pricingItemRows) {
      row.pricing_document_id = pricingDocumentId;
    }

    const { error: itemsInsertError } = await supabase
      .from("pricing_items")
      .insert(pricingItemRows);

    let resolvedItemsError = itemsInsertError;
    if (
      itemsInsertError?.message?.includes("component_key") &&
      pricingItemRows.some((row) => row.component_key != null)
    ) {
      const retryRows = pricingItemRows.map((row) => {
        const copy = { ...row };
        delete copy.component_key;
        return copy;
      });
      const retry = await supabase.from("pricing_items").insert(retryRows);
      resolvedItemsError = retry.error;
    }

    if (resolvedItemsError) {
      await supabase
        .from("pricing_documents")
        .delete()
        .eq("id", pricingDocumentId)
        .eq("org_id", orgId);
      return {
        error: toUserError(
          resolvedItemsError,
          "pricing-create-items",
          PRICING_SAVE_FAILED
        ),
      };
    }
  }

  await recalculateAndPersistDocumentTotals(
    supabase,
    orgId,
    pricingDocumentId,
    createGst.recalculationGstRate,
    false
  );

  const currentStatus = project.business_status as string;
  if (
    ACTIVE_PIPELINE_STATUSES.includes(
      currentStatus as (typeof ACTIVE_PIPELINE_STATUSES)[number]
    ) &&
    ["lead", "scoping", "estimating"].includes(currentStatus)
  ) {
    await supabase
      .from("projects")
      .update({
        business_status: "estimate_ready",
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("org_id", orgId);
  }

  revalidatePricingDashboard(projectId, pricingDocumentId);
  redirect(`/app/projects/${projectId}/pricing/${pricingDocumentId}`);
}

export async function updatePricingDocument(
  pricingDocumentId: string,
  input: PricingDocumentInput
): Promise<PricingActionState> {
  const parsed = parsePricingInput(updatePricingDocumentInputSchema, {
    pricingDocumentId,
    document: input,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedPricingDocument(parsed.data.pricingDocumentId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, document } = loaded;
  const documentInput = parsed.data.document;
  const gstRate = resolvePricingGstForUpdate({
    mutationGstRate: documentInput.gst_rate,
    storedDocumentGstRate: document.gst_rate,
  }).rate;

  const update: Record<string, unknown> = {
    status: "draft",
    reviewed_at: null,
  };

  if (documentInput.title !== undefined) update.title = documentInput.title;
  if (documentInput.client_name !== undefined) {
    update.client_name = documentInput.client_name;
  }
  if (documentInput.site_address !== undefined) {
    update.site_address = documentInput.site_address;
  }
  if (documentInput.valid_until !== undefined) {
    update.valid_until = documentInput.valid_until;
  }
  if (documentInput.scope_summary !== undefined) {
    update.scope_summary = documentInput.scope_summary;
  }
  if (documentInput.assumptions !== undefined) {
    update.assumptions = documentInput.assumptions;
  }
  if (documentInput.exclusions !== undefined) {
    update.exclusions = documentInput.exclusions;
  }
  if (documentInput.terms !== undefined) update.terms = documentInput.terms;
  if (documentInput.internal_notes !== undefined) {
    update.internal_notes = documentInput.internal_notes;
  }
  if (documentInput.gst_rate !== undefined) {
    update.gst_rate = documentInput.gst_rate;
  }

  const { error } = await supabase
    .from("pricing_documents")
    .update(update)
    .eq("id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "pricing-update-document", PRICING_SAVE_FAILED),
    };
  }

  // Keep project client details as the authoritative pre-quote source of truth.
  if (
    documentInput.client_name !== undefined ||
    documentInput.site_address !== undefined
  ) {
    const projectUpdate: Record<string, unknown> = {};
    if (documentInput.client_name !== undefined) {
      projectUpdate.client_name = documentInput.client_name;
    }
    if (documentInput.site_address !== undefined) {
      projectUpdate.site_address = documentInput.site_address;
    }
    const { error: projectError } = await supabase
      .from("projects")
      .update(projectUpdate)
      .eq("id", document.project_id)
      .eq("org_id", orgId);

    if (projectError) {
      return {
        error: toUserError(
          projectError,
          "pricing-update-project-client",
          PRICING_SAVE_FAILED
        ),
      };
    }
  }

  // Product intent: updatePricingDocument accepts metadata + optional GST only.
  // There is no document-level margin field; GST-only changes do not recalculate
  // GST-exclusive line cost/sell — only document GST amount / inclusive total.
  if (documentInput.gst_rate !== undefined) {
    await recalculateAndPersistDocumentTotals(
      supabase,
      orgId,
      parsed.data.pricingDocumentId,
      gstRate,
      false
    );
  }

  revalidatePricingProjectPath(
    document.project_id,
    parsed.data.pricingDocumentId
  );
  return { success: true };
}

export async function updatePricingItem(
  pricingItemId: string,
  input: PricingItemInput
): Promise<PricingActionState> {
  const parsed = parsePricingInput(updatePricingItemInputSchema, {
    pricingItemId,
    item: input,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;
  const item = parsed.data.item;

  const ownedItem = await assertOrgOwnsPricingItem(
    auth,
    parsed.data.pricingItemId
  );
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  if (item.work_area_id) {
    const ownedWorkArea = await assertOrgOwnsWorkArea(
      auth,
      item.work_area_id,
      ownedItem.projectId
    );
    if ("error" in ownedWorkArea) {
      return { error: ownedWorkArea.error };
    }
  }

  const { data: existing, error: loadError } = await supabase
    .from("pricing_items")
    .select("id, pricing_document_id, project_id, total_sell, client_label")
    .eq("id", parsed.data.pricingItemId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (loadError || !existing) {
    return { error: "Pricing item not found." };
  }

  // Omitted optional fields arrive as undefined from Zod; explicit null and 0
  // are preserved. Client total_cost/total_sell are ignored for qty/productivity
  // modes inside the adapter (not trusted as derived authority).
  const computed = computePricingItemMoneyFields({
    quantity: item.quantity,
    unit: item.unit,
    unitCost: item.unit_cost,
    unitSell: item.unit_sell,
    totalCost: item.total_cost,
    totalSell: item.total_sell,
    itemType: item.item_type,
    calculationMode: item.calculation_mode,
    productivityRate: item.productivity_rate,
    productivityUnit: item.productivity_unit,
    calculatedQuantity: item.calculated_quantity,
    manualSellOverride: true,
    requestId: `pricing-update-${parsed.data.pricingItemId}`,
    sourceReferences: ["pricing:update_item"],
  });
  if (!computed.ok) {
    return { error: computed.error };
  }
  const totals = computed.fields;

  const commercial = validateComputedItemForPersistence({
    totalCost: totals.totalCost,
    totalSell: totals.totalSell,
    marginPercent: totals.marginPercent,
    markupPercent: totals.markupPercent,
    costKnown: totals.costKnown,
  });
  if (!commercial.ok) {
    return { error: commercial.error };
  }

  const { error } = await supabase
    .from("pricing_items")
    .update({
      internal_label: item.internal_label,
      client_label: item.client_label,
      internal_description: item.internal_description ?? null,
      client_description: item.client_description ?? null,
      quantity: totals.quantity,
      unit: item.unit ?? totals.unit ?? null,
      unit_cost: totals.unitCost,
      unit_sell: totals.unitSell,
      total_cost: totals.totalCost,
      total_sell: totals.totalSell,
      gross_profit: totals.grossProfit,
      margin_percent: totals.marginPercent,
      markup_percent: totals.markupPercent,
      calculation_mode: totals.calculationMode,
      productivity_rate: totals.productivityRate,
      productivity_unit:
        totals.productivityUnit ?? item.productivity_unit ?? null,
      calculated_quantity: totals.calculatedQuantity,
      item_type: item.item_type,
      delivery_method: item.delivery_method,
      visible_on_quote: item.visible_on_quote ?? true,
      optional: item.optional ?? false,
      notes_internal: item.notes_internal ?? null,
      notes_client: item.notes_client ?? null,
      work_area_id: item.work_area_id ?? null,
      manually_edited: true,
    })
    .eq("id", parsed.data.pricingItemId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "pricing-update-item", PRICING_SAVE_FAILED),
    };
  }

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId: existing.project_id,
    pricingDocumentId: existing.pricing_document_id,
    itemId: parsed.data.pricingItemId,
    userId: auth.user.id,
    action: "pricing_item_update",
    oldValues: {
      total_sell: existing.total_sell,
      client_label: existing.client_label,
    },
    newValues: {
      total_sell: totals.totalSell,
      client_label: item.client_label,
      manually_edited: true,
    },
  });

  const { data: document } = await supabase
    .from("pricing_documents")
    .select("gst_rate")
    .eq("id", existing.pricing_document_id)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistDocumentTotals(
    supabase,
    orgId,
    existing.pricing_document_id,
    resolveStoredPricingDocumentGstRate(
      coercePersistedGstRate(document?.gst_rate)
    ).rate,
    true
  );

  const [updatedItem, updatedDocument] = await Promise.all([
    supabase
      .from("pricing_items")
      .select("*")
      .eq("id", parsed.data.pricingItemId)
      .eq("org_id", orgId)
      .maybeSingle(),
    loadPricingDocumentById(supabase, orgId, existing.pricing_document_id),
  ]);

  if (!updatedItem.data || !updatedDocument) {
    return { error: "Failed to load updated pricing item." };
  }

  return {
    success: true,
    item: mapPricingItem(updatedItem.data),
    document: updatedDocument,
  };
}

export async function addPricingItem(input: {
  pricingDocumentId: string;
  projectId: string;
  workAreaId?: string | null;
  itemType?: PricingItemInput["item_type"];
  deliveryMethod?: PricingItemInput["delivery_method"];
}): Promise<PricingActionState> {
  const parsed = parsePricingInput(addPricingItemInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;
  const {
    pricingDocumentId,
    projectId,
    workAreaId,
    itemType: rawItemType,
    deliveryMethod: rawDeliveryMethod,
  } = parsed.data;
  const itemType = rawItemType ?? "other";
  const deliveryMethod =
    rawDeliveryMethod ?? defaultDeliveryMethod(itemType);

  const ownedDocument = await assertOrgOwnsPricingDocument(
    auth,
    pricingDocumentId,
    projectId
  );
  if ("error" in ownedDocument) {
    return { error: ownedDocument.error };
  }

  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  if (workAreaId) {
    const ownedWorkArea = await assertOrgOwnsWorkArea(
      auth,
      workAreaId,
      projectId
    );
    if ("error" in ownedWorkArea) {
      return { error: ownedWorkArea.error };
    }
  }

  const { data: maxSort } = await supabase
    .from("pricing_items")
    .select("sort_order")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", orgId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxSort?.sort_order ?? -1) + 1;

  let totals: PersistedPricingItemMoneyFields;
  if (isAuthoritativePricingItemCalculation()) {
    const blank = calculateBlankPricingItem({
      requestId: `pricing-add-${pricingDocumentId}`,
      itemType,
    });
    if (!blank.ok) {
      return { error: blank.error };
    }
    totals = blank.fields;
  } else {
    const legacy = calculatePricingItemTotals({
      quantity: 1,
      totalCost: 0,
      totalSell: 0,
      itemType,
    });
    totals = {
      quantity: legacy.quantity,
      unit: null,
      unitCost: legacy.unitCost,
      unitSell: legacy.unitSell,
      totalCost: legacy.totalCost,
      totalSell: legacy.totalSell,
      grossProfit: legacy.grossProfit,
      marginPercent: legacy.marginPercent,
      markupPercent: legacy.markupPercent,
      calculationMode: legacy.calculationMode ?? "lump_sum",
      productivityRate: null,
      productivityUnit: null,
      calculatedQuantity: null,
      costKnown: true,
    };
  }

  const commercial = validateComputedItemForPersistence({
    totalCost: totals.totalCost,
    totalSell: totals.totalSell,
    marginPercent: totals.marginPercent,
    markupPercent: totals.markupPercent,
    costKnown: totals.costKnown,
  });
  if (!commercial.ok) {
    return { error: commercial.error };
  }

  const { data: createdItem, error } = await supabase
    .from("pricing_items")
    .insert({
      org_id: orgId,
      pricing_document_id: pricingDocumentId,
      project_id: projectId,
      work_area_id: workAreaId ?? null,
      item_type: itemType,
      delivery_method: deliveryMethod,
      internal_label: "New item",
      client_label: "New item",
      quantity: totals.quantity ?? 1,
      unit_cost: totals.unitCost,
      unit_sell: totals.unitSell,
      total_cost: totals.totalCost,
      total_sell: totals.totalSell,
      gross_profit: totals.grossProfit,
      margin_percent: totals.marginPercent,
      markup_percent: totals.markupPercent,
      calculation_mode: totals.calculationMode,
      visible_on_quote: true,
      optional: false,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error || !createdItem) {
    return {
      error: toUserError(
        error,
        "pricing-add-item",
        "Failed to add pricing item."
      ),
    };
  }

  const { data: document } = await supabase
    .from("pricing_documents")
    .select("gst_rate")
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistDocumentTotals(
    supabase,
    orgId,
    pricingDocumentId,
    resolveStoredPricingDocumentGstRate(
      coercePersistedGstRate(document?.gst_rate)
    ).rate,
    true
  );

  const updatedDocument = await loadPricingDocumentById(
    supabase,
    orgId,
    pricingDocumentId
  );

  if (!updatedDocument) {
    return { error: "Failed to load updated pricing document." };
  }

  return {
    success: true,
    item: mapPricingItem(createdItem),
    document: updatedDocument,
  };
}

export async function duplicatePricingItem(
  pricingItemId: string
): Promise<PricingActionState> {
  const parsed = parsePricingInput(duplicatePricingItemInputSchema, {
    pricingItemId,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;

  const ownedItem = await assertOrgOwnsPricingItem(
    auth,
    parsed.data.pricingItemId
  );
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  const ownedDocument = await assertOrgOwnsPricingDocument(
    auth,
    ownedItem.pricingDocumentId,
    ownedItem.projectId
  );
  if ("error" in ownedDocument) {
    return { error: ownedDocument.error };
  }

  const { data: source, error: loadError } = await supabase
    .from("pricing_items")
    .select("*")
    .eq("id", parsed.data.pricingItemId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (loadError || !source) {
    return { error: "Pricing item not found." };
  }

  // Recalculate from source commercial inputs — do not blindly trust stored totals.
  // manually_edited is intentionally not copied (DB default false), matching prior
  // duplicate behaviour: copied rates/mode are inputs; override flag resets.
  const computed = computePricingItemMoneyFields({
    quantity: source.quantity == null ? null : Number(source.quantity),
    unit: (source.unit as string | null) ?? null,
    unitCost: source.unit_cost == null ? null : Number(source.unit_cost),
    unitSell: source.unit_sell == null ? null : Number(source.unit_sell),
    totalCost: source.total_cost == null ? null : Number(source.total_cost),
    totalSell: source.total_sell == null ? null : Number(source.total_sell),
    itemType: source.item_type as import("@/lib/pricing/types").PricingItemType,
    calculationMode:
      (source.calculation_mode as
        | import("@/lib/pricing/types").CalculationMode
        | null) ?? null,
    productivityRate:
      source.productivity_rate == null
        ? null
        : Number(source.productivity_rate),
    productivityUnit: (source.productivity_unit as string | null) ?? null,
    calculatedQuantity:
      source.calculated_quantity == null
        ? null
        : Number(source.calculated_quantity),
    manualSellOverride: Boolean(source.manually_edited),
    requestId: `pricing-duplicate-${parsed.data.pricingItemId}`,
    sourceReferences: ["pricing:duplicate_item", parsed.data.pricingItemId],
  });
  if (!computed.ok) {
    return { error: computed.error };
  }
  const totals = computed.fields;

  const commercial = validateComputedItemForPersistence({
    totalCost: totals.totalCost,
    totalSell: totals.totalSell,
    marginPercent: totals.marginPercent,
    markupPercent: totals.markupPercent,
    costKnown: totals.costKnown,
  });
  if (!commercial.ok) {
    return { error: commercial.error };
  }

  const { data: createdItem, error } = await supabase
    .from("pricing_items")
    .insert({
      org_id: orgId,
      pricing_document_id: source.pricing_document_id,
      project_id: source.project_id,
      work_area_id: source.work_area_id,
      source_estimate_line_item_id: source.source_estimate_line_item_id,
      item_type: source.item_type,
      delivery_method: source.delivery_method,
      internal_label: `${source.internal_label} Copy`,
      client_label: `${source.client_label} Copy`,
      internal_description: source.internal_description,
      client_description: source.client_description,
      quantity: totals.quantity,
      unit: totals.unit ?? source.unit,
      unit_cost: totals.unitCost,
      unit_sell: totals.unitSell,
      total_cost: totals.totalCost,
      total_sell: totals.totalSell,
      gross_profit: totals.grossProfit,
      margin_percent: totals.marginPercent,
      markup_percent: totals.markupPercent,
      calculation_mode: totals.calculationMode,
      productivity_rate: totals.productivityRate,
      productivity_unit: totals.productivityUnit ?? source.productivity_unit,
      calculated_quantity: totals.calculatedQuantity,
      visible_on_quote: source.visible_on_quote,
      optional: source.optional,
      sort_order: source.sort_order + 1,
      notes_internal: source.notes_internal,
      notes_client: source.notes_client,
    })
    .select("*")
    .single();

  if (error || !createdItem) {
    return {
      error: toUserError(
        error,
        "pricing-duplicate-item",
        "Failed to duplicate pricing item."
      ),
    };
  }

  const { data: document } = await supabase
    .from("pricing_documents")
    .select("gst_rate")
    .eq("id", source.pricing_document_id)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistDocumentTotals(
    supabase,
    orgId,
    source.pricing_document_id,
    resolveStoredPricingDocumentGstRate(
      coercePersistedGstRate(document?.gst_rate)
    ).rate,
    true
  );

  const updatedDocument = await loadPricingDocumentById(
    supabase,
    orgId,
    source.pricing_document_id
  );

  if (!updatedDocument) {
    return { error: "Failed to load updated pricing document." };
  }

  return {
    success: true,
    item: mapPricingItem(createdItem),
    document: updatedDocument,
  };
}

export async function deletePricingItem(
  pricingItemId: string
): Promise<PricingActionState> {
  const parsed = parsePricingInput(deletePricingItemInputSchema, {
    pricingItemId,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;

  const ownedItem = await assertOrgOwnsPricingItem(
    auth,
    parsed.data.pricingItemId
  );
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  const { data: existing, error: loadError } = await supabase
    .from("pricing_items")
    .select("id, pricing_document_id, project_id, client_label")
    .eq("id", parsed.data.pricingItemId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (loadError || !existing) {
    return { error: "Pricing item not found." };
  }

  const { error } = await supabase
    .from("pricing_items")
    .delete()
    .eq("id", parsed.data.pricingItemId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "pricing-delete-item", PRICING_SAVE_FAILED),
    };
  }

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId: existing.project_id,
    pricingDocumentId: existing.pricing_document_id,
    itemId: parsed.data.pricingItemId,
    userId: auth.user.id,
    action: "pricing_item_delete",
    oldValues: { client_label: existing.client_label },
  });

  const { data: document } = await supabase
    .from("pricing_documents")
    .select("gst_rate")
    .eq("id", existing.pricing_document_id)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistDocumentTotals(
    supabase,
    orgId,
    existing.pricing_document_id,
    resolveStoredPricingDocumentGstRate(
      coercePersistedGstRate(document?.gst_rate)
    ).rate,
    true
  );

  const updatedDocument = await loadPricingDocumentById(
    supabase,
    orgId,
    existing.pricing_document_id
  );

  if (!updatedDocument) {
    return { error: "Failed to load updated pricing document." };
  }

  return {
    success: true,
    deletedItemId: parsed.data.pricingItemId,
    document: updatedDocument,
  };
}

export async function markPricingReviewed(
  pricingDocumentId: string
): Promise<PricingActionState> {
  const parsed = parsePricingInput(markPricingReviewedInputSchema, {
    pricingDocumentId,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedPricingDocument(parsed.data.pricingDocumentId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, document } = loaded;

  const { error } = await supabase
    .from("pricing_documents")
    .update({
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "pricing-mark-reviewed", PRICING_SAVE_FAILED),
    };
  }

  revalidatePricingDashboard(
    document.project_id,
    parsed.data.pricingDocumentId
  );
  return { success: true };
}

export async function setPricingItemsQuoteVisibility(input: {
  pricingDocumentId: string;
  itemIds: string[];
  visibleOnQuote: boolean;
}): Promise<PricingActionState> {
  const parsed = parsePricingInput(setPricingItemsQuoteVisibilityInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedPricingDocument(parsed.data.pricingDocumentId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, document } = loaded;
  const uniqueIds = Array.from(new Set(parsed.data.itemIds));

  const { data: ownedRows, error: loadError } = await supabase
    .from("pricing_items")
    .select("id")
    .eq("pricing_document_id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId)
    .in("id", uniqueIds);

  if (loadError) {
    return {
      error: toUserError(loadError, "pricing-bulk-visibility", PRICING_SAVE_FAILED),
    };
  }

  const ownedIds = (ownedRows ?? []).map((row) => row.id as string);
  if (ownedIds.length === 0) {
    return { error: "No matching pricing items found." };
  }

  const { error } = await supabase
    .from("pricing_items")
    .update({ visible_on_quote: parsed.data.visibleOnQuote })
    .eq("pricing_document_id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId)
    .in("id", ownedIds);

  if (error) {
    return {
      error: toUserError(error, "pricing-bulk-visibility", PRICING_SAVE_FAILED),
    };
  }

  await supabase
    .from("pricing_documents")
    .update({
      status: "draft",
      reviewed_at: null,
    })
    .eq("id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId);

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId: document.project_id,
    pricingDocumentId: parsed.data.pricingDocumentId,
    userId: loaded.user.id,
    action: "pricing_item_visibility_bulk",
    newValues: {
      visible_on_quote: parsed.data.visibleOnQuote,
      item_ids: ownedIds,
    },
  });

  const updatedDocument = await loadPricingDocumentById(
    supabase,
    orgId,
    parsed.data.pricingDocumentId
  );
  if (!updatedDocument) {
    return { error: "Failed to load updated pricing document." };
  }

  revalidatePricingProjectPath(
    document.project_id,
    parsed.data.pricingDocumentId
  );

  return {
    success: true,
    document: updatedDocument,
    updatedItemIds: ownedIds,
    skippedCount: uniqueIds.length - ownedIds.length,
  };
}

export async function deleteManualPricingItems(input: {
  pricingDocumentId: string;
  itemIds: string[];
}): Promise<PricingActionState> {
  const parsed = parsePricingInput(deleteManualPricingItemsInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedPricingDocument(parsed.data.pricingDocumentId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, document } = loaded;
  const uniqueIds = Array.from(new Set(parsed.data.itemIds));

  const { data: ownedRows, error: loadError } = await supabase
    .from("pricing_items")
    .select("id, source_estimate_line_item_id")
    .eq("pricing_document_id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId)
    .in("id", uniqueIds);

  if (loadError) {
    return {
      error: toUserError(loadError, "pricing-bulk-delete", PRICING_SAVE_FAILED),
    };
  }

  const manualIds = (ownedRows ?? [])
    .filter((row) => row.source_estimate_line_item_id == null)
    .map((row) => row.id as string);

  if (manualIds.length === 0) {
    return {
      error:
        "Only manually added lines can be bulk-deleted. Estimate-sourced items were left unchanged.",
    };
  }

  const { error } = await supabase
    .from("pricing_items")
    .delete()
    .eq("pricing_document_id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId)
    .is("source_estimate_line_item_id", null)
    .in("id", manualIds);

  if (error) {
    return {
      error: toUserError(error, "pricing-bulk-delete", PRICING_SAVE_FAILED),
    };
  }

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId: document.project_id,
    pricingDocumentId: parsed.data.pricingDocumentId,
    userId: loaded.user.id,
    action: "pricing_item_delete_bulk",
    oldValues: { item_ids: manualIds },
  });

  const { data: gstRow } = await supabase
    .from("pricing_documents")
    .select("gst_rate")
    .eq("id", parsed.data.pricingDocumentId)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistDocumentTotals(
    supabase,
    orgId,
    parsed.data.pricingDocumentId,
    resolveStoredPricingDocumentGstRate(
      coercePersistedGstRate(gstRow?.gst_rate)
    ).rate,
    true
  );

  const updatedDocument = await loadPricingDocumentById(
    supabase,
    orgId,
    parsed.data.pricingDocumentId
  );
  if (!updatedDocument) {
    return { error: "Failed to load updated pricing document." };
  }

  revalidatePricingProjectPath(
    document.project_id,
    parsed.data.pricingDocumentId
  );

  return {
    success: true,
    document: updatedDocument,
    deletedItemIds: manualIds,
    skippedCount: uniqueIds.length - manualIds.length,
  };
}

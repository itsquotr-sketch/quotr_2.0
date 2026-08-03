"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { buildPricingNotesFromEstimateLineItem } from "@/lib/estimate/line-item-metadata";
import { logPricingAuditEvent } from "@/lib/audit/pricing-audit-log";
import { toUserError } from "@/lib/errors/user-message";
import {
  parsePricingInput,
  validateComputedItemForPersistence,
} from "@/lib/pricing/action-guards";
import {
  addPricingItemInputSchema,
  createPricingFromEstimateInputSchema,
  deletePricingItemInputSchema,
  duplicatePricingItemInputSchema,
  markPricingReviewedInputSchema,
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
  assertOrgOwnsProject,
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
import {
  buildPricingItemFieldsFromEstimateLineItem,
} from "@/lib/pricing/pricing-item-calculation";
import { valuesFromEstimateLineItem } from "@/lib/pricing/recalibration-helpers";
import {
  buildScopeSummaryFromWorkAreas,
  mapPricingDocument,
  mapPricingItem,
  mapPricingWorkArea,
} from "@/lib/pricing/mappers";
import { DEFAULT_GST_RATE } from "@/lib/pricing/status";
import { getOrgQuoteDefaultsForOrg } from "@/lib/settings/company-actions";
import {
  resolveAssumptionsForSnapshot,
  resolveExclusionsForSnapshot,
  resolveTermsForSnapshot,
} from "@/lib/settings/snapshot";
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
    .select("total_cost, total_sell")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[pricing-recalc-load]", error.message);
    }
    throw new Error(PRICING_SAVE_FAILED);
  }

  const totals = calculateDocumentTotals(items ?? [], gstRate);
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

  const ownedProject = await assertOrgOwnsProject(auth, projectId);
  if ("error" in ownedProject) {
    return null;
  }

  const { data, error } = await auth.supabase
    .from("pricing_documents")
    .select("id, status, needs_recalibration")
    .eq("project_id", projectId)
    .eq("org_id", auth.orgId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status as PricingSummary["status"],
    needsRecalibration: Boolean(data.needs_recalibration),
  };
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

  const ownedProject = await assertOrgOwnsProject(auth, projectId);
  if ("error" in ownedProject) {
    return {
      hasEstimate: false,
      estimateIsStale: false,
      pricingSummary: null,
    };
  }

  const [pricingSummary, estimateResult] = await Promise.all([
    getLatestPricingSummary(projectId),
    auth.supabase
      .from("estimates")
      .select("is_stale")
      .eq("project_id", projectId)
      .eq("org_id", auth.orgId)
      .maybeSingle(),
  ]);

  return {
    hasEstimate: Boolean(estimateResult.data),
    estimateIsStale: estimateResult.data?.is_stale ?? false,
    pricingSummary,
  };
}

export async function getPricingWorkspaceData(
  projectId: string,
  pricingDocumentId: string
): Promise<PricingWorkspaceData> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    notFound();
  }

  const ownedProject = await assertOrgOwnsProject(auth, projectId);
  if ("error" in ownedProject) {
    notFound();
  }

  const ownedDocument = await assertOrgOwnsPricingDocument(
    auth,
    pricingDocumentId,
    projectId
  );
  if ("error" in ownedDocument) {
    notFound();
  }

  const { supabase, orgId } = auth;

  const [{ data: project }, { data: document }, { data: items }, { data: workAreas }, { data: estimate }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, deleted_at")
        .eq("id", projectId)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("pricing_documents")
        .select("*")
        .eq("id", pricingDocumentId)
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("pricing_items")
        .select("*")
        .eq("pricing_document_id", pricingDocumentId)
        .eq("org_id", orgId)
        .order("sort_order"),
      supabase
        .from("work_areas")
        .select("id, name, type, sort_order, quote_description")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .eq("status", "confirmed")
        .order("sort_order"),
      supabase
        .from("estimates")
        .select("recommended_sell, is_stale")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .maybeSingle(),
    ]);

  if (!project || project.deleted_at || !document) {
    notFound();
  }

  return {
    projectTitle: project.title,
    document: mapPricingDocument(document),
    items: (items ?? []).map((row) => mapPricingItem(row)),
    workAreas: (workAreas ?? []).map((row) => mapPricingWorkArea(row)),
    latestEstimateRecommendedSell:
      estimate?.recommended_sell != null
        ? Number(estimate.recommended_sell)
        : null,
    latestEstimateIsStale: estimate?.is_stale ?? false,
  };
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
  const { projectId, estimateId } = parsed.data;

  const ownedProject = await assertOrgOwnsProject(auth, projectId);
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
  const estimateAssumptions = parseStringArray(estimate.assumptions);
  const estimateExclusions = parseStringArray(estimate.exclusions);

  const orgDefaults = await getOrgQuoteDefaultsForOrg(supabase, orgId);
  const assumptions = resolveAssumptionsForSnapshot(
    estimateAssumptions,
    orgDefaults
  );
  const exclusions = resolveExclusionsForSnapshot(
    estimateExclusions,
    orgDefaults
  );
  const terms = resolveTermsForSnapshot(null, orgDefaults);
  const gstRate = orgDefaults.defaultGstRate ?? DEFAULT_GST_RATE;
  const validUntil = addDaysIsoDate(orgDefaults.defaultQuoteValidityDays);

  const documentTotals = calculateDocumentTotals(
    [
      {
        total_cost: Number(estimate.recommended_cost ?? 0),
        total_sell: Number(estimate.recommended_sell ?? 0),
      },
    ],
    gstRate
  );

  const { data: pricingDocument, error: insertDocError } = await supabase
    .from("pricing_documents")
    .insert({
      org_id: orgId,
      project_id: projectId,
      estimate_id: estimate.id,
      needs_recalibration: false,
      recalibration_status: "current",
      title: `Final pricing — ${project.title}`,
      status: "draft",
      client_name: project.client_name,
      site_address: project.site_address,
      pricing_date: todayIsoDate(),
      valid_until: validUntil,
      // Document totals copy estimate recommended cost/sell — not recalculated from default margin.
      subtotal_cost: Number(estimate.recommended_cost ?? 0),
      subtotal_sell: Number(estimate.recommended_sell ?? 0),
      gross_profit: Number(estimate.gross_profit ?? 0),
      margin_percent: Number(estimate.margin_percent ?? 0),
      markup_percent: Number(estimate.markup_percent ?? 0),
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
      created_by: user.id,
    })
    .select("id")
    .single();

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

  if (lineItems && lineItems.length > 0) {
    const pricingItemRows = lineItems.map((lineItem, index) => {
      const fields = buildPricingItemFieldsFromEstimateLineItem(lineItem);
      const values = valuesFromEstimateLineItem(lineItem);
      const displayNotes = lineItem.notes?.split("\n__quotr_meta__:")[0]?.trim();

      return {
        org_id: orgId,
        pricing_document_id: pricingDocumentId,
        project_id: projectId,
        work_area_id: lineItem.work_area_id,
        source_estimate_line_item_id: lineItem.id,
        item_type: values.itemType,
        delivery_method: values.deliveryMethod,
        internal_label: lineItem.label,
        client_label: cleanClientLabel(lineItem.label),
        internal_description: displayNotes || null,
        client_description: displayNotes || null,
        quantity: fields.quantity,
        unit: fields.unit,
        unit_cost: fields.unitCost,
        unit_sell: fields.unitSell,
        total_cost: fields.totalCost,
        total_sell: fields.totalSell,
        gross_profit: fields.grossProfit,
        margin_percent: fields.marginPercent,
        markup_percent: fields.markupPercent,
        calculation_mode: fields.calculationMode,
        productivity_rate: fields.productivityRate,
        productivity_unit: fields.productivityUnit,
        calculated_quantity: fields.calculatedQuantity,
        visible_on_quote: true,
        optional: false,
        sort_order: lineItem.sort_order ?? index,
        notes_internal: buildPricingNotesFromEstimateLineItem(lineItem.notes),
      };
    });

    const { error: itemsInsertError } = await supabase
      .from("pricing_items")
      .insert(pricingItemRows);

    if (itemsInsertError) {
      await supabase
        .from("pricing_documents")
        .delete()
        .eq("id", pricingDocumentId)
        .eq("org_id", orgId);
      return {
        error: toUserError(
          itemsInsertError,
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
    DEFAULT_GST_RATE,
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
  const gstRate = documentInput.gst_rate ?? document.gst_rate;

  const update: Record<string, unknown> = {
    status: "draft",
    reviewed_at: null,
  };

  if (documentInput.title !== undefined) update.title = documentInput.title;
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

  const totals = calculatePricingItemTotals({
    quantity: item.quantity,
    unitCost: item.unit_cost,
    unitSell: item.unit_sell,
    totalCost: item.total_cost,
    totalSell: item.total_sell,
    itemType: item.item_type,
    calculationMode: item.calculation_mode,
    productivityRate: item.productivity_rate,
    productivityUnit: item.productivity_unit,
    calculatedQuantity: item.calculated_quantity,
  });

  const commercial = validateComputedItemForPersistence({
    totalCost: totals.totalCost,
    totalSell: totals.totalSell,
    marginPercent: totals.marginPercent,
    markupPercent: totals.markupPercent,
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
      unit: item.unit ?? null,
      unit_cost: totals.unitCost,
      unit_sell: totals.unitSell,
      total_cost: totals.totalCost,
      total_sell: totals.totalSell,
      gross_profit: totals.grossProfit,
      margin_percent: totals.marginPercent,
      markup_percent: totals.markupPercent,
      calculation_mode: totals.calculationMode ?? item.calculation_mode ?? null,
      productivity_rate: totals.productivityRate ?? item.productivity_rate ?? null,
      productivity_unit: totals.productivityUnit ?? item.productivity_unit ?? null,
      calculated_quantity:
        totals.calculatedQuantity ?? item.calculated_quantity ?? null,
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
    Number(document?.gst_rate ?? DEFAULT_GST_RATE),
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

  const ownedProject = await assertOrgOwnsProject(auth, projectId);
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
  const totals = calculatePricingItemTotals({
    quantity: 1,
    totalCost: 0,
    totalSell: 0,
    itemType,
  });

  const commercial = validateComputedItemForPersistence({
    totalCost: totals.totalCost,
    totalSell: totals.totalSell,
    marginPercent: totals.marginPercent,
    markupPercent: totals.markupPercent,
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
      quantity: totals.quantity,
      total_cost: totals.totalCost,
      total_sell: totals.totalSell,
      gross_profit: totals.grossProfit,
      margin_percent: totals.marginPercent,
      markup_percent: totals.markupPercent,
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
    Number(document?.gst_rate ?? DEFAULT_GST_RATE),
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
      quantity: source.quantity,
      unit: source.unit,
      unit_cost: source.unit_cost,
      unit_sell: source.unit_sell,
      total_cost: source.total_cost,
      total_sell: source.total_sell,
      gross_profit: source.gross_profit,
      margin_percent: source.margin_percent,
      markup_percent: source.markup_percent,
      calculation_mode: source.calculation_mode,
      productivity_rate: source.productivity_rate,
      productivity_unit: source.productivity_unit,
      calculated_quantity: source.calculated_quantity,
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
    Number(document?.gst_rate ?? DEFAULT_GST_RATE),
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
    Number(document?.gst_rate ?? DEFAULT_GST_RATE),
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

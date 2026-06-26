"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { buildPricingNotesFromEstimateLineItem } from "@/lib/estimate/line-item-metadata";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { logPricingAuditEvent } from "@/lib/audit/pricing-audit-log";
import {
  assertOrgOwnsPricingDocument,
  assertOrgOwnsPricingItem,
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

async function loadOwnedPricingDocument(pricingDocumentId: string) {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." as const };
  }

  const { data: document, error } = await context.supabase
    .from("pricing_documents")
    .select("*")
    .eq("id", pricingDocumentId)
    .eq("org_id", context.orgId)
    .maybeSingle();

  if (error || !document) {
    return { error: "Pricing document not found." as const };
  }

  return { ...context, document: mapPricingDocument(document) };
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
    throw new Error(error.message);
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
    throw new Error(updateError.message);
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
  const context = await getAuthOrgContext();
  if (!context) {
    return null;
  }

  const { data, error } = await context.supabase
    .from("pricing_documents")
    .select("id, status, needs_recalibration")
    .eq("project_id", projectId)
    .eq("org_id", context.orgId)
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
  const context = await getAuthOrgContext();
  const result = new Map<string, PricingSummary>();
  if (!context || projectIds.length === 0) {
    return result;
  }

  const { data, error } = await context.supabase
    .from("pricing_documents")
    .select("id, status, project_id, created_at, needs_recalibration")
    .eq("org_id", context.orgId)
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
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      hasEstimate: false,
      estimateIsStale: false,
      pricingSummary: null,
    };
  }

  const [pricingSummary, estimateResult] = await Promise.all([
    getLatestPricingSummary(projectId),
    context.supabase
      .from("estimates")
      .select("is_stale")
      .eq("project_id", projectId)
      .eq("org_id", context.orgId)
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
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }

  const { supabase, orgId } = context;

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
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      error:
        "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }

  const { supabase, user, orgId } = context;
  const { projectId, estimateId } = input;

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
    return { error: lineItemsError.message };
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
    return { error: insertDocError?.message ?? "Failed to create pricing." };
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
        .eq("id", pricingDocumentId);
      return { error: itemsInsertError.message };
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
  const loaded = await loadOwnedPricingDocument(pricingDocumentId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, document } = loaded;
  const gstRate = input.gst_rate ?? document.gst_rate;

  const update: Record<string, unknown> = {
    status: "draft",
    reviewed_at: null,
  };

  if (input.title !== undefined) update.title = input.title;
  if (input.valid_until !== undefined) update.valid_until = input.valid_until;
  if (input.scope_summary !== undefined) update.scope_summary = input.scope_summary;
  if (input.assumptions !== undefined) update.assumptions = input.assumptions;
  if (input.exclusions !== undefined) update.exclusions = input.exclusions;
  if (input.terms !== undefined) update.terms = input.terms;
  if (input.internal_notes !== undefined) update.internal_notes = input.internal_notes;
  if (input.gst_rate !== undefined) update.gst_rate = input.gst_rate;

  const { error } = await supabase
    .from("pricing_documents")
    .update(update)
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    return { error: error.message };
  }

  if (input.gst_rate !== undefined) {
    await recalculateAndPersistDocumentTotals(
      supabase,
      orgId,
      pricingDocumentId,
      gstRate,
      false
    );
  }

  revalidatePricingProjectPath(document.project_id, pricingDocumentId);
  return { success: true };
}

export async function updatePricingItem(
  pricingItemId: string,
  input: PricingItemInput
): Promise<PricingActionState> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;

  const ownedItem = await assertOrgOwnsPricingItem(context, pricingItemId);
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  const { data: existing, error: loadError } = await supabase
    .from("pricing_items")
    .select("id, pricing_document_id, project_id, total_sell, client_label")
    .eq("id", pricingItemId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (loadError || !existing) {
    return { error: "Pricing item not found." };
  }

  const totals = calculatePricingItemTotals({
    quantity: input.quantity,
    unitCost: input.unit_cost,
    unitSell: input.unit_sell,
    totalCost: input.total_cost,
    totalSell: input.total_sell,
    itemType: input.item_type,
    calculationMode: input.calculation_mode,
    productivityRate: input.productivity_rate,
    productivityUnit: input.productivity_unit,
    calculatedQuantity: input.calculated_quantity,
  });

  const { error } = await supabase
    .from("pricing_items")
    .update({
      internal_label: input.internal_label,
      client_label: input.client_label,
      internal_description: input.internal_description ?? null,
      client_description: input.client_description ?? null,
      quantity: totals.quantity,
      unit: input.unit ?? null,
      unit_cost: totals.unitCost,
      unit_sell: totals.unitSell,
      total_cost: totals.totalCost,
      total_sell: totals.totalSell,
      gross_profit: totals.grossProfit,
      margin_percent: totals.marginPercent,
      markup_percent: totals.markupPercent,
      calculation_mode: totals.calculationMode ?? input.calculation_mode ?? null,
      productivity_rate: totals.productivityRate ?? input.productivity_rate ?? null,
      productivity_unit: totals.productivityUnit ?? input.productivity_unit ?? null,
      calculated_quantity:
        totals.calculatedQuantity ?? input.calculated_quantity ?? null,
      item_type: input.item_type,
      delivery_method: input.delivery_method,
      visible_on_quote: input.visible_on_quote ?? true,
      optional: input.optional ?? false,
      notes_internal: input.notes_internal ?? null,
      notes_client: input.notes_client ?? null,
      work_area_id: input.work_area_id ?? null,
      manually_edited: true,
    })
    .eq("id", pricingItemId)
    .eq("org_id", orgId);

  if (error) {
    return { error: error.message };
  }

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId: existing.project_id,
    pricingDocumentId: existing.pricing_document_id,
    itemId: pricingItemId,
    userId: context.user.id,
    action: "pricing_item_update",
    oldValues: {
      total_sell: existing.total_sell,
      client_label: existing.client_label,
    },
    newValues: {
      total_sell: totals.totalSell,
      client_label: input.client_label,
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
      .eq("id", pricingItemId)
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
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const itemType = input.itemType ?? "other";
  const deliveryMethod =
    input.deliveryMethod ?? defaultDeliveryMethod(itemType);

  const ownedDocument = await assertOrgOwnsPricingDocument(
    context,
    input.pricingDocumentId,
    input.projectId
  );
  if ("error" in ownedDocument) {
    return { error: ownedDocument.error };
  }

  const { data: maxSort } = await supabase
    .from("pricing_items")
    .select("sort_order")
    .eq("pricing_document_id", input.pricingDocumentId)
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

  const { data: createdItem, error } = await supabase
    .from("pricing_items")
    .insert({
      org_id: orgId,
      pricing_document_id: input.pricingDocumentId,
      project_id: input.projectId,
      work_area_id: input.workAreaId ?? null,
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
    return { error: error?.message ?? "Failed to add pricing item." };
  }

  const { data: document } = await supabase
    .from("pricing_documents")
    .select("gst_rate")
    .eq("id", input.pricingDocumentId)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistDocumentTotals(
    supabase,
    orgId,
    input.pricingDocumentId,
    Number(document?.gst_rate ?? DEFAULT_GST_RATE),
    true
  );

  const updatedDocument = await loadPricingDocumentById(
    supabase,
    orgId,
    input.pricingDocumentId
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
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;

  const { data: source, error: loadError } = await supabase
    .from("pricing_items")
    .select("*")
    .eq("id", pricingItemId)
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
    return { error: error?.message ?? "Failed to duplicate pricing item." };
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
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;

  const ownedItem = await assertOrgOwnsPricingItem(context, pricingItemId);
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  const { data: existing, error: loadError } = await supabase
    .from("pricing_items")
    .select("id, pricing_document_id, project_id, client_label")
    .eq("id", pricingItemId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (loadError || !existing) {
    return { error: "Pricing item not found." };
  }

  const { error } = await supabase
    .from("pricing_items")
    .delete()
    .eq("id", pricingItemId)
    .eq("org_id", orgId);

  if (error) {
    return { error: error.message };
  }

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId: existing.project_id,
    pricingDocumentId: existing.pricing_document_id,
    itemId: pricingItemId,
    userId: context.user.id,
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
    deletedItemId: pricingItemId,
    document: updatedDocument,
  };
}

export async function markPricingReviewed(
  pricingDocumentId: string
): Promise<PricingActionState> {
  const loaded = await loadOwnedPricingDocument(pricingDocumentId);
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
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    return { error: error.message };
  }

  revalidatePricingDashboard(document.project_id, pricingDocumentId);
  return { success: true };
}

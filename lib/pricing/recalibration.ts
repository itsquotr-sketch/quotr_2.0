"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { USER_ERRORS, toUserError } from "@/lib/errors/user-message";
import { logPricingAuditEvent } from "@/lib/audit/pricing-audit-log";
import { assertOrgOwnsPricingDocument } from "@/lib/security/org-ownership";
import { permissionDeniedError } from "@/lib/team/permission-server";
import { mapPricingDocument, mapPricingItem } from "@/lib/pricing/mappers";
import {
  resolveStoredPricingDocumentGstRate,
} from "@/lib/pricing/gst-source";
import {
  buildPricingItemRowFromEstimate,
  buildPricingItemUpdateFromEstimate,
  buildRecalibrationPreviewData,
  MANUAL_PRESERVED_NOTE,
  matchPricingToEstimateLines,
  ORPHANED_SOURCE_NOTE,
  type EstimateLineItemRow,
  type RecalibrationPreview,
} from "@/lib/pricing/recalibration-helpers";
import { RATE_RECONCILIATION_REQUIRED } from "@/lib/subcontractors/rate-use";
import type {
  PricingActionState,
  PricingItem,
} from "@/lib/pricing/types";

type RecalibrationInput = {
  projectId: string;
  pricingDocumentId: string;
};

export type RecalibrationActionState = PricingActionState & {
  preview?: RecalibrationPreview;
};

function revalidatePricingProjectPath(
  projectId: string,
  pricingDocumentId: string
) {
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/pricing/${pricingDocumentId}`);
}

/**
 * Same application gate as the other Pricing mutations.
 * `pricing.access` stays on create-from-estimate only.
 */
async function requirePricingEditPermission(auth: {
  orgId: string;
  user: { id: string };
}): Promise<{ error: string } | null> {
  const denied = await permissionDeniedError({
    orgId: auth.orgId,
    userId: auth.user.id,
    permission: "pricing.edit",
  });
  if (!denied) return null;
  return { error: denied.error };
}

async function loadRecalibrationContext(input: RecalibrationInput) {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." as const };
  }

  const { supabase, orgId } = context;
  const { projectId, pricingDocumentId } = input;

  const ownedDocument = await assertOrgOwnsPricingDocument(
    context,
    pricingDocumentId,
    projectId
  );
  if ("error" in ownedDocument) {
    return { error: ownedDocument.error };
  }

  const [{ data: documentRow }, { data: estimate }] = await Promise.all([
    supabase
      .from("pricing_documents")
      .select("*")
      .eq("id", pricingDocumentId)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("estimates")
      .select("*")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (!documentRow) {
    return { error: "Pricing document not found." as const };
  }

  if (!estimate) {
    return {
      error: "Generate a quick estimate before updating final pricing.",
    } as const;
  }

  if (estimate.is_stale) {
    return {
      error: "Regenerate the estimate before updating final pricing.",
    } as const;
  }

  const [{ data: lineItems }, { data: pricingItems }] = await Promise.all([
    supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimate.id)
      .eq("org_id", orgId)
      .order("sort_order"),
    supabase
      .from("pricing_items")
      .select("*")
      .eq("pricing_document_id", pricingDocumentId)
      .eq("org_id", orgId)
      .order("sort_order"),
  ]);

  return {
    supabase,
    orgId,
    projectId,
    pricingDocumentId,
    document: mapPricingDocument(documentRow),
    estimate,
    estimateLineItems: (lineItems ?? []) as EstimateLineItemRow[],
    pricingItems: (pricingItems ?? []).map((row) => mapPricingItem(row)),
  };
}

export async function markPricingDocumentsNeedingRecalibration(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from("pricing_documents")
    .update({
      needs_recalibration: true,
      recalibration_status: "estimate_changed",
    })
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .neq("status", "archived");

  if (error) {
    console.error(
      "Failed to mark pricing documents needing recalibration:",
      error.message
    );
  }

  const { error: rateError } = await supabase
    .from("subcontractor_rate_applications")
    .update({ reconciliation_status: "pending" })
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .is("superseded_at", null);

  if (rateError) {
    console.error(
      "Failed to flag supplier rates for reconciliation:",
      rateError.message
    );
  }
}

async function supplierRateHold(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  orgId: string,
  pricingDocumentId: string
): Promise<{ pending: boolean; keptWorkAreas: Set<string>; keptAllowanceIds: Set<string> }> {
  const { data } = await supabase
    .from("subcontractor_rate_applications")
    .select("work_area_id, allowance_item_id, reconciliation_status")
    .eq("org_id", orgId)
    .eq("pricing_document_id", pricingDocumentId)
    .is("superseded_at", null);
  const rows = data ?? [];
  return {
    pending: rows.some((row) => row.reconciliation_status === "pending"),
    keptWorkAreas: new Set(
      rows.filter((row) => row.reconciliation_status === "kept" && row.work_area_id).map((row) => row.work_area_id as string)
    ),
    keptAllowanceIds: new Set(
      rows.filter((row) => row.reconciliation_status === "kept").map((row) => row.allowance_item_id as string)
    ),
  };
}

export async function previewRecalibration(
  input: RecalibrationInput
): Promise<RecalibrationActionState> {
  const loaded = await loadRecalibrationContext(input);
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const hold = await supplierRateHold(loaded.supabase, loaded.orgId, input.pricingDocumentId);
  if (hold.pending) return { error: RATE_RECONCILIATION_REQUIRED };

  const preview = buildRecalibrationPreviewData(
    loaded.estimateLineItems,
    loaded.pricingItems,
    loaded.document.subtotal_sell,
    Number(loaded.estimate.recommended_sell ?? 0)
  );

  return { success: true, preview };
}

async function recalculateDocumentTotals(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  pricingDocumentId: string,
  gstRate: number,
  resetReview: boolean
) {
  const { isAuthoritativePricingItemCalculation } = await import(
    "@/lib/pricing/adoption-authority"
  );
  const { calculateAuthoritativeDocumentTotals } = await import(
    "@/lib/pricing/authoritative-document-totals"
  );
  const { calculateDocumentTotals } = await import("@/lib/pricing/calculations");

  const { data: items, error } = await supabase
    .from("pricing_items")
    .select("total_cost, total_sell, visible_on_quote")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message);
  }

  const mapped = (items ?? []).map((item) => ({
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
      mapped,
      gstRate,
      `recalibration-doc-${pricingDocumentId}`
    );
    if (!authoritative.ok) {
      throw new Error(authoritative.error);
    }
    totals = authoritative.totals;
  } else {
    totals = calculateDocumentTotals(mapped, gstRate);
  }

  const update: Record<string, string | number | null | boolean> = {
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

export async function applyRecalibration(
  input: RecalibrationInput
): Promise<
  RecalibrationActionState & {
    items?: PricingItem[];
  }
> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }
  const denied = await requirePricingEditPermission(context);
  if (denied) return denied;

  const loaded = await loadRecalibrationContext(input);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const {
    supabase,
    orgId,
    projectId,
    pricingDocumentId,
    document,
    estimate,
    estimateLineItems,
    pricingItems,
  } = loaded;

  const hold = await supplierRateHold(supabase, orgId, pricingDocumentId);
  if (hold.pending) return { error: RATE_RECONCILIATION_REQUIRED };

  const matches = matchPricingToEstimateLines(estimateLineItems, pricingItems);
  const matchedPricingIds = new Set(
    [...matches.values()].map((item) => item.id)
  );
  const estimateIds = new Set(estimateLineItems.map((item) => item.id));

  const maxSort =
    pricingItems.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1;

  const inserts: Record<string, unknown>[] = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let itemsChanged = false;
  let nextSort = maxSort;

  try {
    for (const lineItem of estimateLineItems) {
      const existing = matches.get(lineItem.id);
      if (lineItem.work_area_id && hold.keptWorkAreas.has(lineItem.work_area_id) && !existing) {
        continue;
      }
      if (existing) {
        if (hold.keptAllowanceIds.has(existing.id)) {
          updates.push({
            id: existing.id,
            patch: {
              recalibration_note: "Supplier rate kept after the estimate was regenerated.",
            },
          });
          itemsChanged = true;
          continue;
        }
        if (existing.manually_edited) {
          updates.push({
            id: existing.id,
            patch: {
              source_estimate_line_item_id: lineItem.id,
              recalibration_note: MANUAL_PRESERVED_NOTE,
            },
          });
          itemsChanged = true;
          continue;
        }

        updates.push({
          id: existing.id,
          patch: buildPricingItemUpdateFromEstimate(lineItem, existing),
        });
        itemsChanged = true;
        continue;
      }

      inserts.push(
        buildPricingItemRowFromEstimate(
          lineItem,
          orgId,
          pricingDocumentId,
          projectId,
          nextSort++
        )
      );
      itemsChanged = true;
    }
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : USER_ERRORS.recalibrationFailed,
    };
  }

  for (const item of pricingItems) {
    const hasSource = item.source_estimate_line_item_id != null;
    const sourceMissing =
      hasSource && !estimateIds.has(item.source_estimate_line_item_id!);
    const unmatched = !matchedPricingIds.has(item.id);

    if (hold.keptAllowanceIds.has(item.id)) continue;
    if (hasSource && (sourceMissing || unmatched)) {
      if (!item.orphaned) {
        itemsChanged = true;
      }
      updates.push({
        id: item.id,
        patch: {
          orphaned: true,
          recalibration_note: ORPHANED_SOURCE_NOTE,
        },
      });
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from("pricing_items")
      .insert(inserts);

    if (insertError) {
      return {
        error: toUserError(
          insertError,
          "recalibration-insert",
          USER_ERRORS.recalibrationFailed
        ),
      };
    }
  }

  if (updates.length > 0) {
    const results = await Promise.all(
      updates.map(({ id, patch }) =>
        supabase
          .from("pricing_items")
          .update(patch)
          .eq("id", id)
          .eq("org_id", orgId)
      )
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      return {
        error: toUserError(
          failed.error,
          "recalibration-update",
          USER_ERRORS.recalibrationFailed
        ),
      };
    }
  }

  const resetReview = document.status === "reviewed" && itemsChanged;
  await recalculateDocumentTotals(
    supabase,
    orgId,
    pricingDocumentId,
    resolveStoredPricingDocumentGstRate(document.gst_rate).rate,
    resetReview
  );

  const now = new Date().toISOString();
  const { error: docError } = await supabase
    .from("pricing_documents")
    .update({
      estimate_id: estimate.id,
      needs_recalibration: false,
      recalibration_status: "recalibrated",
      recalibrated_at: now,
      recalibration_dismissed_at: null,
    })
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId);

  if (docError) {
    return {
      error: toUserError(
        docError,
        "recalibration-document",
        USER_ERRORS.recalibrationFailed
      ),
    };
  }

  const [{ data: updatedItems }, { data: updatedDocument }] = await Promise.all([
    supabase
      .from("pricing_items")
      .select("*")
      .eq("pricing_document_id", pricingDocumentId)
      .eq("org_id", orgId)
      .order("sort_order"),
    supabase
      .from("pricing_documents")
      .select("*")
      .eq("id", pricingDocumentId)
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (!updatedDocument) {
    return { error: "Failed to load updated pricing document." };
  }

  revalidatePricingProjectPath(projectId, pricingDocumentId);

  const authContext = await getAuthOrgContext();
  if (authContext) {
    await logPricingAuditEvent({
      supabase,
      organisationId: orgId,
      projectId,
      pricingDocumentId,
      userId: authContext.user.id,
      action: "pricing_recalibration",
      newValues: {
        itemsChanged,
        insertCount: inserts.length,
        updateCount: updates.length,
      },
    });
  }

  return {
    success: true,
    document: mapPricingDocument(updatedDocument),
    items: (updatedItems ?? []).map((row) => mapPricingItem(row)),
  };
}

export async function keepCurrentPricing(
  input: RecalibrationInput
): Promise<RecalibrationActionState> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }
  const denied = await requirePricingEditPermission(context);
  if (denied) return denied;

  const { supabase, orgId } = context;
  const { projectId, pricingDocumentId } = input;

  const ownedDocument = await assertOrgOwnsPricingDocument(
    context,
    pricingDocumentId,
    projectId
  );
  if ("error" in ownedDocument) {
    return { error: ownedDocument.error };
  }

  const { data: document, error: loadError } = await supabase
    .from("pricing_documents")
    .select("id")
    .eq("id", pricingDocumentId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (loadError || !document) {
    return { error: "Pricing document not found." };
  }

  const { error } = await supabase
    .from("pricing_documents")
    .update({
      needs_recalibration: false,
      recalibration_status: "manually_kept",
      recalibration_dismissed_at: new Date().toISOString(),
    })
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId);

  if (error) {
    return { error: error.message };
  }

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId,
    pricingDocumentId,
    userId: context.user.id,
    action: "pricing_recalibration_dismissed",
  });

  revalidatePricingProjectPath(projectId, pricingDocumentId);

  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  coercePersistedGstRate,
  resolveStoredPricingDocumentGstRate,
} from "@/lib/pricing/gst-source";
import { persistPricingDocumentTotals } from "@/lib/pricing/actions";
import {
  buildRfqSellChoices,
  rfqAllowanceLabel,
  type RfqPricingMoneyView,
  type RfqSellChoice,
  type RfqSellTreatment,
} from "@/lib/rfqs/pricing-preview";
import { validateMarginPercent } from "@/lib/security/margin-validation";
import { permissionDeniedError } from "@/lib/team/permission-server";

/**
 * Applying a response uses pricing.edit and the existing pricing.access entitlement.
 * Builder, Business, and an active trial allow it for owner, admin, and estimator.
 * Viewer never has pricing.edit. An expired trial denies pricing.access.
 * The public RFQ token cannot call this. No award email is sent.
 */

const FAILED = "Could not apply that response to pricing. Nothing was changed.";

type Fail = { ok: false; error: string };

export type RfqPricingPreviewResult = {
  ok: true;
  label: string;
  affected: Array<{ id: string; label: string; cost: number | null; sell: number | null }>;
  selectedBefore: RfqPricingMoneyView;
  before: RfqPricingMoneyView;
  choices: RfqSellChoice[];
  targetMarginPercent: number | null;
  targetMarginSource: "job" | "pricing" | null;
  quoteExists: boolean;
};

async function writer() {
  const context = await getAuthOrgContext();
  if (!context) return { ok: false as const, error: "You need to be signed in." };
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "pricing.edit",
    entitlement: "pricing.access",
  });
  if (denied) return { ok: false as const, error: denied.error };
  return { ok: true as const, context };
}

function moneyError(code: string | undefined): string {
  switch (code) {
    case "EXPIRED":
      return "That response has passed its valid-until date.";
    case "REVOKED":
      return "That response link has been revoked.";
    case "NOT_APPLICABLE":
      return "Only a submitted response can be used for pricing. A decline is not a price.";
    case "WORK_AREA":
      return "Choose the work area this request was sent for.";
    case "LINES":
      return "Those pricing lines cannot be replaced. Choose active lines in this work area.";
    case "INVALID_INPUT":
      return "Check the selected pricing lines and try again.";
    case "PRICING_CLOSED":
      return "That pricing document can no longer be changed.";
    case "FORBIDDEN":
      return "You do not have permission to change pricing.";
    case "LOSS_ACK":
      return "Confirm that this cost is higher than the sell before using it.";
    case "SELL_UNKNOWN":
      return "The current sell is unknown. Choose another sell treatment.";
    case "SELL_TREATMENT":
      return "Choose how the sell should be set before using this response.";
    case "SCHEDULE_NOT_APPLIED":
      return "Review item prices here; applying individual items to Pricing is coming next.";
    default:
      return FAILED;
  }
}

async function scheduleApplyBlock(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  responseId: string
): Promise<string | null> {
  const response = await supabase.from("rfq_responses").select("recipient_id").eq("id", responseId).maybeSingle();
  if (!response.data?.recipient_id) return null;
  const recipient = await supabase.from("rfq_recipients").select("rfq_id").eq("id", response.data.recipient_id).maybeSingle();
  if (!recipient.data?.rfq_id) return null;
  const rfq = await supabase.from("rfqs").select("pricing_request").eq("id", recipient.data.rfq_id).maybeSingle();
  if (rfq.data?.pricing_request === "schedule") {
    return "Review item prices here; applying individual items to Pricing is coming next.";
  }
  return null;
}

export async function loadTargetMargin(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  orgId: string,
  projectId: string
): Promise<{ percent: number; source: "job" | "pricing" } | null> {
  const estimate = await supabase
    .from("estimates")
    .select("target_margin_percent")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .not("target_margin_percent", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const jobMargin = estimate.data?.target_margin_percent == null ? null : Number(estimate.data.target_margin_percent);
  if (jobMargin != null && validateMarginPercent(jobMargin).ok) {
    return { percent: jobMargin, source: "job" };
  }
  const settings = await supabase
    .from("organisation_settings")
    .select("default_margin_percent")
    .eq("org_id", orgId)
    .maybeSingle();
  const pricingMargin = settings.data?.default_margin_percent == null ? null : Number(settings.data.default_margin_percent);
  if (pricingMargin != null && validateMarginPercent(pricingMargin).ok) {
    return { percent: pricingMargin, source: "pricing" };
  }
  return null;
}

async function loadApplyContext(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  orgId: string,
  input: {
    responseId: string;
    pricingDocumentId: string;
    workAreaId: string;
    replacedItemIds: string[];
    manualSell: number | null;
  }
) {
  const response = await supabase
    .from("rfq_responses")
    .select("id, recipient_id, price_ex_gst, pricing_structure, status, valid_until")
    .eq("id", input.responseId)
    .maybeSingle();
  if (response.error || !response.data || response.data.status !== "submitted" || response.data.price_ex_gst == null) {
    return { ok: false as const, error: FAILED };
  }
  const recipient = await supabase
    .from("rfq_recipients")
    .select("id, rfq_id")
    .eq("id", response.data.recipient_id)
    .maybeSingle();
  const rfq = recipient.data
    ? await supabase
        .from("rfqs")
        .select("id, project_id, scope_kind, work_area_name, written_scope_label")
        .eq("id", recipient.data.rfq_id)
        .maybeSingle()
    : { data: null, error: null };
  const document = await supabase
    .from("pricing_documents")
    .select("id, project_id, gst_rate, status")
    .eq("id", input.pricingDocumentId)
    .maybeSingle();
  if (!rfq.data || !document.data || document.data.project_id !== rfq.data.project_id) {
    return { ok: false as const, error: FAILED };
  }
  const items = await supabase
    .from("pricing_items")
    .select("id, client_label, total_cost, total_sell, work_area_id")
    .eq("pricing_document_id", document.data.id);
  const active = await supabase
    .from("rfq_pricing_applications")
    .select("id, response_id, allowance_item_id, before_lines")
    .eq("pricing_document_id", document.data.id)
    .eq("work_area_id", input.workAreaId)
    .is("superseded_at", null)
    .maybeSingle();
  const quotes = await supabase
    .from("quotes")
    .select("id")
    .eq("project_id", rfq.data.project_id)
    .limit(1);
  const scope =
    rfq.data.scope_kind === "work_area"
      ? rfq.data.work_area_name || "Requested work"
      : rfq.data.written_scope_label || "Requested work";
  const beforeLines = Array.isArray(active.data?.before_lines) ? active.data.before_lines : [];
  const sellLines = beforeLines
    .map((line) => {
      const row = line as { id?: string; total_cost?: number; total_sell?: number };
      if (!row.id) return null;
      return { id: row.id, totalCost: Number(row.total_cost ?? 0), totalSell: Number(row.total_sell ?? 0) };
    })
    .filter((line): line is { id: string; totalCost: number; totalSell: number } => line != null);
  const target = await loadTargetMargin(supabase, orgId, rfq.data.project_id);
  const labels = new Map((items.data ?? []).map((item) => [item.id, item.client_label as string]));
  const preview = buildRfqSellChoices({
    responseId: input.responseId,
    priceExGst: Number(response.data.price_ex_gst),
    gstRate: resolveStoredPricingDocumentGstRate(coercePersistedGstRate(document.data.gst_rate)).rate,
    items: (items.data ?? []).map((item) => ({
      id: item.id,
      totalCost: Number(item.total_cost ?? 0),
      totalSell: Number(item.total_sell ?? 0),
    })),
    replacedIds: input.replacedItemIds,
    existingAllowanceId: active.data?.allowance_item_id ?? null,
    sellLines: sellLines.length > 0 ? sellLines : undefined,
    targetMarginPercent: target?.percent ?? null,
    manualSell: input.manualSell,
  });
  if (!preview.ok) return preview;
  return {
    ok: true as const,
    preview: preview.preview,
    labels,
    target,
    scope,
    structure: response.data.pricing_structure,
    projectId: rfq.data.project_id,
    rfqId: rfq.data.id,
    gstRate: resolveStoredPricingDocumentGstRate(coercePersistedGstRate(document.data.gst_rate)).rate,
    quoteExists: (quotes.data ?? []).length > 0,
    documentId: document.data.id,
  };
}

export async function previewRfqPricingApplication(input: {
  responseId: string;
  pricingDocumentId: string;
  workAreaId: string;
  replacedItemIds: string[];
  manualSell?: number | null;
}): Promise<RfqPricingPreviewResult | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const blocked = await scheduleApplyBlock(loaded.context.supabase, input.responseId);
  if (blocked) return { ok: false, error: blocked };
  const context = await loadApplyContext(loaded.context.supabase, loaded.context.orgId, {
    ...input,
    manualSell: input.manualSell ?? null,
  });
  if (!context.ok) return context;
  return {
    ok: true,
    label: rfqAllowanceLabel(context.structure, context.scope),
    affected: context.preview.affected.map((line) => ({
      ...line,
      label: context.labels.get(line.id) || "Pricing line",
    })),
    selectedBefore: context.preview.selectedBefore,
    before: context.preview.before,
    choices: context.preview.choices,
    targetMarginPercent: context.target?.percent ?? null,
    targetMarginSource: context.target?.source ?? null,
    quoteExists: context.quoteExists,
  };
}

export async function applyRfqPricingApplication(input: {
  responseId: string;
  pricingDocumentId: string;
  workAreaId: string;
  replacedItemIds: string[];
  sellTreatment: RfqSellTreatment;
  manualSell?: number | null;
  acknowledgeLoss?: boolean;
}): Promise<{ ok: true; alreadyApplied: boolean } | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const blocked = await scheduleApplyBlock(loaded.context.supabase, input.responseId);
  if (blocked) return { ok: false, error: blocked };
  const context = await loadApplyContext(loaded.context.supabase, loaded.context.orgId, {
    ...input,
    manualSell: input.manualSell ?? null,
  });
  if (!context.ok) return context;
  const choice = context.preview.choices.find((item) => item.treatment === input.sellTreatment);
  if (!choice?.available || !choice.allowance || choice.sell == null) {
    return { ok: false, error: choice?.unavailableReason ?? "Choose how the sell should be set before using this response." };
  }
  if (choice.loss && input.acknowledgeLoss !== true) {
    return { ok: false, error: "Confirm that this cost is higher than the sell before using it." };
  }
  const applied = await loaded.context.supabase.rpc("apply_rfq_response_to_pricing_v1", {
    p_payload: {
      response_id: input.responseId,
      pricing_document_id: input.pricingDocumentId,
      work_area_id: input.workAreaId,
      replaced_item_ids: input.replacedItemIds,
      sell_treatment: input.sellTreatment,
      acknowledge_loss: choice.loss ? "true" : "false",
      target_margin_percent: input.sellTreatment === "target_margin" ? context.target?.percent ?? null : null,
      total_cost: choice.allowance.totalCost,
      total_sell: choice.allowance.totalSell,
      gross_profit: choice.allowance.grossProfit,
      margin_percent: choice.allowance.marginPercent,
      markup_percent: choice.allowance.markupPercent,
    },
  });
  const body = (applied.data ?? {}) as { ok?: boolean; error?: string; alreadyApplied?: boolean };
  if (applied.error) {
    const message = applied.error.message ?? "";
    if (message.includes("RFQ_APPLY_FORCED") || message.includes("RFQ_COST_MISMATCH") || message.includes("RFQ_SELL_MISMATCH")) {
      return { ok: false, error: "The pricing update was rolled back." };
    }
    return { ok: false, error: FAILED };
  }
  if (body.ok !== true) return { ok: false, error: moneyError(body.error) };
  if (body.alreadyApplied) return { ok: true, alreadyApplied: true };
  try {
    await persistPricingDocumentTotals(
      loaded.context.supabase,
      loaded.context.orgId,
      context.documentId,
      context.gstRate,
      true
    );
  } catch {
    return { ok: false, error: "The subcontract cost was saved, but the pricing totals need another save." };
  }
  revalidatePath(`/app/projects/${context.projectId}/requests/${context.rfqId}`);
  revalidatePath(`/app/projects/${context.projectId}`);
  return { ok: true, alreadyApplied: false };
}

"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { calculateAuthoritativeDocumentTotals } from "@/lib/pricing/authoritative-document-totals";
import { persistPricingDocumentTotals } from "@/lib/pricing/actions";
import {
  coercePersistedGstRate,
  resolveStoredPricingDocumentGstRate,
} from "@/lib/pricing/gst-source";
import { loadTargetMargin } from "@/lib/rfqs/pricing-apply";
import {
  buildRfqSellChoices,
  type RfqPricingMoneyView,
  type RfqSellChoice,
  type RfqSellTreatment,
} from "@/lib/rfqs/pricing-preview";
import { permissionDeniedError } from "@/lib/team/permission-server";

const FAILED = "Could not apply those items to pricing. Nothing was changed.";

function coverageReady(coverage: ScheduleCoverageInput, allowedItemIds: string[], kind: "qualification" | "exclusion"): boolean {
  if (coverage.decision === "covered_by_item") {
    return Boolean(coverage.itemId && allowedItemIds.includes(coverage.itemId) && coverage.note.trim().length >= 3);
  }
  if (coverage.decision === "client_exclusion") return coverage.wording.trim().length >= 3;
  if (kind === "qualification" && coverage.decision === "client_condition") return coverage.wording.trim().length >= 3;
  if (kind === "qualification" && coverage.decision === "internal_plan") return coverage.note.trim().length >= 3;
  return false;
}

function coveragePayload(coverage: ScheduleCoverageInput | null) {
  if (!coverage) return null;
  return {
    decision: coverage.decision,
    item_id: coverage.itemId,
    wording: coverage.wording,
    note: coverage.note,
  };
}

export type ScheduleCoverageDecision = "covered_by_item" | "client_exclusion" | "client_condition" | "internal_plan";

export type ScheduleCoverageInput = {
  decision: ScheduleCoverageDecision;
  itemId: string | null;
  wording: string;
  note: string;
};

export type SchedulePricingRowInput = {
  scheduleItemId: string;
  mode: "replace" | "add";
  replacedItemIds: string[];
  clientLabel: string;
  scopeConfirmed: boolean;
  sellTreatment: RfqSellTreatment;
  manualSell: number | null;
  acknowledgeLoss: boolean;
  qualificationAcknowledged: boolean;
  acknowledgeAlternative: boolean;
  acknowledgeSource: boolean;
  coverage: ScheduleCoverageInput | null;
};

export type SchedulePricingPreview = {
  ok: true;
  incomplete: boolean;
  unpriced: string[];
  pricedSubtotalLabel: string | null;
  versionNumber: number;
  validUntil: string | null;
  exclusions: string;
  assumptions: string;
  gstTreatment: string | null;
  newer: boolean;
  rows: Array<{
    scheduleItemId: string;
    scope: string;
    role: string;
    quantity: number | null;
    unit: string;
    unitPrice: number | null;
    cost: number;
    qualification: string;
    sourceConflict: boolean;
    choices: RfqSellChoice[];
    currentCost: number | null;
    currentSell: number | null;
  }>;
  before: RfqPricingMoneyView;
  after: RfqPricingMoneyView | null;
  untouched: Array<{ id: string; label: string }>;
  targetMarginPercent: number | null;
  targetMarginSource: "job" | "pricing" | null;
};

type Fail = { ok: false; error: string };

function moneyError(code: string | undefined): string {
  switch (code) {
    case "EXPIRED":
      return "That response has passed its valid-until date.";
    case "REVOKED":
      return "That response link has been revoked.";
    case "NOT_APPLICABLE":
      return "Only a submitted response can be used for pricing. A decline is not a price.";
    case "WORK_AREA":
      return "That pricing item is in a different work area. Choose an item in this request's work area, or add the price as new scope.";
    case "AMBIGUOUS":
      return "Choose the exact pricing item to replace, or add this price as new scope.";
    case "UNIT":
      return "That pricing item uses a different unit. Add this price as new scope, or replace an item with the same unit.";
    case "QUOTE_ISSUED":
      return "An issued quote stays as it was. Create a new draft revision from that quote after pricing can be edited. This price was not applied.";
    case "PRICING_CLOSED":
      return "That pricing document can no longer be changed.";
    case "NOT_PRICED":
      return "A line marked Not priced cannot be used, and it is not a zero price.";
    case "CONFIRM_SCOPE":
      return "Confirm the supplier scope matches this job.";
    case "QUALIFICATION":
      return "Acknowledge the qualification on each qualified line before using it.";
    case "COVERAGE":
      return "Choose how this supplier condition is handled. A private note does not decide the client scope.";
    case "ALTERNATIVE":
      return "An alternative cannot be added beside its base item until you review that conflict.";
    case "SOURCE":
      return "A supplier rate or an earlier RFQ allowance already covers this scope. Choose one source.";
    case "LOSS_ACK":
      return "Confirm that this cost is higher than the sell before using it.";
    case "SELL_UNKNOWN":
      return "The current sell is unknown. Choose another sell treatment.";
    case "SELL_TREATMENT":
      return "Choose how the sell should be set before using this item.";
    case "STALE":
      return "This review is for an older schedule. Open the current response and review it again.";
    case "FORBIDDEN":
      return "You do not have permission to change pricing.";
    case "DUPLICATE_ROW":
      return "Each schedule item can be used once in this review.";
    default:
      return FAILED;
  }
}

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

function viewFromTotals(totals: {
  subtotalCost: number;
  subtotalSell: number;
  grossProfit: number;
  marginPercent: number;
  gstAmount: number;
  totalInclGst: number;
  costKnown: boolean;
}): RfqPricingMoneyView {
  if (!totals.costKnown) {
    return { cost: null, sell: null, grossProfit: null, marginPercent: null, gstAmount: null, totalInclGst: null };
  }
  return {
    cost: totals.subtotalCost,
    sell: totals.subtotalSell,
    grossProfit: totals.grossProfit,
    marginPercent: totals.marginPercent,
    gstAmount: totals.gstAmount,
    totalInclGst: totals.totalInclGst,
  };
}

export async function previewSchedulePricing(input: {
  responseId: string;
  pricingDocumentId: string;
  workAreaId: string;
  rows: SchedulePricingRowInput[];
  responseCoverage: ScheduleCoverageInput | null;
}): Promise<SchedulePricingPreview | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const built = await buildSchedulePreview(loaded.context.supabase, loaded.context.orgId, input);
  if (!built.ok) return built;
  return built.preview;
}

export async function applySchedulePricing(input: {
  responseId: string;
  pricingDocumentId: string;
  workAreaId: string;
  rows: SchedulePricingRowInput[];
  responseCoverage: ScheduleCoverageInput | null;
}): Promise<{ ok: true; alreadyApplied: boolean } | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const built = await buildSchedulePreview(loaded.context.supabase, loaded.context.orgId, input);
  if (!built.ok) return built;
  if (built.quoteIssued) {
    return { ok: false, error: moneyError("QUOTE_ISSUED") };
  }
  const payloadRows = [];
  for (const row of input.rows) {
    const previewRow = built.preview.rows.find((item) => item.scheduleItemId === row.scheduleItemId);
    const choice = previewRow?.choices.find((item) => item.treatment === row.sellTreatment);
    if (!previewRow || !choice?.available || !choice.allowance || choice.sell == null) {
      return { ok: false, error: choice?.unavailableReason ?? "Choose how the sell should be set before using this item." };
    }
    if (choice.loss && row.acknowledgeLoss !== true) {
      return { ok: false, error: moneyError("LOSS_ACK") };
    }
    if (previewRow.qualification && row.qualificationAcknowledged !== true) {
      return { ok: false, error: moneyError("QUALIFICATION") };
    }
    if (previewRow.sourceConflict && row.acknowledgeSource !== true) {
      return { ok: false, error: moneyError("SOURCE") };
    }
    payloadRows.push({
      schedule_item_id: row.scheduleItemId,
      mode: row.mode,
      replaced_item_ids: row.mode === "replace" ? row.replacedItemIds : [],
      client_label: row.clientLabel,
      scope_confirmed: row.scopeConfirmed ? "true" : "false",
      sell_treatment: row.sellTreatment,
      manual_sell: row.manualSell,
      acknowledge_loss: choice.loss ? "true" : "false",
      qualification_acknowledged: row.qualificationAcknowledged ? "true" : "false",
      acknowledge_alternative: row.acknowledgeAlternative ? "true" : "false",
      acknowledge_source: row.acknowledgeSource ? "true" : "false",
      coverage: coveragePayload(row.coverage),
      target_margin_percent: row.sellTreatment === "target_margin" ? built.preview.targetMarginPercent : null,
      total_cost: choice.allowance.totalCost,
      total_sell: choice.allowance.totalSell,
      gross_profit: choice.allowance.grossProfit,
      margin_percent: choice.allowance.marginPercent,
      markup_percent: choice.allowance.markupPercent,
    });
  }
  const applied = await loaded.context.supabase.rpc("apply_rfq_schedule_lines_v1", {
    p_payload: {
      response_id: input.responseId,
      pricing_document_id: input.pricingDocumentId,
      work_area_id: input.workAreaId,
      request_sent_at: built.requestSentAt,
      rows: payloadRows,
      response_coverage: coveragePayload(input.responseCoverage),
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
      input.pricingDocumentId,
      built.gstRate,
      true
    );
  } catch {
    return { ok: false, error: "The supplier prices were saved, but the pricing totals need another save." };
  }
  revalidatePath(`/app/projects/${built.projectId}/requests/${built.rfqId}`);
  revalidatePath(`/app/projects/${built.projectId}/pricing/${input.pricingDocumentId}`);
  return { ok: true, alreadyApplied: false };
}

export async function resolveScheduleGap(input: {
  pricingDocumentId: string;
  responseId: string;
  scheduleItemId: string;
  coverage: ScheduleCoverageInput;
}): Promise<{ ok: true } | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const resolved = await loaded.context.supabase.rpc("resolve_rfq_schedule_gap_v1", {
    p_payload: {
      pricing_document_id: input.pricingDocumentId,
      response_id: input.responseId,
      schedule_item_id: input.scheduleItemId,
      decision: input.coverage.decision,
      item_id: input.coverage.itemId,
      wording: input.coverage.wording,
      note: input.coverage.note,
    },
  });
  const body = (resolved.data ?? {}) as { ok?: boolean; error?: string };
  if (resolved.error || body.ok !== true) {
    return {
      ok: false,
      error: body.error === "NOT_APPLICABLE"
        ? "That required item is already covered here, or it is not an open gap on this response."
        : moneyError(body.error),
    };
  }
  const document = await loaded.context.supabase.from("pricing_documents").select("project_id").eq("id", input.pricingDocumentId).maybeSingle();
  if (document.data?.project_id) {
    revalidatePath(`/app/projects/${document.data.project_id}/pricing/${input.pricingDocumentId}`);
  }
  return { ok: true };
}

async function buildSchedulePreview(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  orgId: string,
  input: {
    responseId: string;
    pricingDocumentId: string;
    workAreaId: string;
    rows: SchedulePricingRowInput[];
    responseCoverage: ScheduleCoverageInput | null;
  }
): Promise<{ ok: true; preview: SchedulePricingPreview; requestSentAt: string; gstRate: number; projectId: string; rfqId: string; quoteIssued: boolean } | Fail> {
  if (input.rows.length === 0) return { ok: false, error: "Choose at least one priced item." };
  const response = await supabase
    .from("rfq_responses")
    .select("id, recipient_id, version_number, status, valid_until, gst_treatment, excluded_scope, assumptions, completeness, qualified, request_sent_at, price_ex_gst")
    .eq("id", input.responseId)
    .maybeSingle();
  if (response.error || !response.data || response.data.status !== "submitted") return { ok: false, error: FAILED };
  const recipient = await supabase
    .from("rfq_recipients")
    .select("id, rfq_id, response_state")
    .eq("id", response.data.recipient_id)
    .maybeSingle();
  const rfq = recipient.data
    ? await supabase.from("rfqs").select("id, project_id, pricing_request, sent_at, scope_kind, work_area_id").eq("id", recipient.data.rfq_id).maybeSingle()
    : { data: null, error: null };
  if (!rfq.data || rfq.data.pricing_request !== "schedule" || !rfq.data.sent_at) return { ok: false, error: FAILED };
  if (rfq.data.scope_kind === "work_area" && rfq.data.work_area_id !== input.workAreaId) {
    return { ok: false, error: moneyError("WORK_AREA") };
  }
  const document = await supabase
    .from("pricing_documents")
    .select("id, project_id, gst_rate, status")
    .eq("id", input.pricingDocumentId)
    .maybeSingle();
  if (!document.data || document.data.project_id !== rfq.data.project_id) return { ok: false, error: FAILED };
  const quotes = await supabase
    .from("quotes")
    .select("id, status")
    .eq("pricing_document_id", document.data.id);
  const quoteIssued = document.data.status === "converted_to_quote"
    || (quotes.data ?? []).some((quote) => quote.status !== "draft" && quote.status !== "archived");
  const [items, schedule, lines, applications, rates, lump] = await Promise.all([
    supabase.from("pricing_items").select("id, client_label, total_cost, total_sell, work_area_id, unit, visible_on_quote").eq("pricing_document_id", document.data.id),
    supabase.from("rfq_schedule_items").select("id, scope, specification, quantity, unit, line_role").eq("rfq_id", rfq.data.id),
    supabase.from("rfq_response_lines").select("schedule_item_id, decision, unit_price_ex_gst, amount_ex_gst, qualification, reason").eq("response_id", response.data.id),
    supabase.from("rfq_schedule_pricing_applications").select("schedule_item_id, allowance_item_id, response_id").eq("pricing_document_id", document.data.id).is("superseded_at", null),
    supabase.from("subcontractor_rate_applications").select("id, allowance_item_id, work_area_id").eq("pricing_document_id", document.data.id).is("superseded_at", null),
    supabase.from("rfq_pricing_applications").select("id, allowance_item_id, work_area_id, replaced_item_ids").eq("pricing_document_id", document.data.id).is("superseded_at", null),
  ]);
  const latest = await supabase
    .from("rfq_responses")
    .select("id, version_number")
    .eq("recipient_id", response.data.recipient_id)
    .eq("status", "submitted")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const gstRate = resolveStoredPricingDocumentGstRate(coercePersistedGstRate(document.data.gst_rate)).rate;
  const target = await loadTargetMargin(supabase, orgId, rfq.data.project_id);
  const scheduleById = new Map((schedule.data ?? []).map((row) => [row.id, row]));
  const lineByItem = new Map((lines.data ?? []).map((row) => [row.schedule_item_id, row]));
  const allowanceByItem = new Map((applications.data ?? []).map((row) => [row.schedule_item_id, row.allowance_item_id as string]));
  const sourceItems = (items.data ?? []).map((item) => ({
    id: item.id as string,
    totalCost: Number(item.total_cost ?? 0),
    totalSell: Number(item.total_sell ?? 0),
    label: (item.client_label as string) || "Pricing item",
    workAreaId: item.work_area_id as string | null,
    unit: item.unit as string | null,
    visible: item.visible_on_quote !== false,
  }));
  const unpriced = (schedule.data ?? [])
    .filter((item) => {
      const line = lineByItem.get(item.id);
      return item.line_role === "required" && (!line || line.decision !== "priced" || line.amount_ex_gst == null);
    })
    .map((item) => item.scope as string);
  const exclusion = String(response.data.excluded_scope ?? "").trim();
  if (exclusion && !input.responseCoverage) return { ok: false, error: moneyError("COVERAGE") };
  if (!exclusion && input.responseCoverage) return { ok: false, error: moneyError("COVERAGE") };
  if (input.responseCoverage && !coverageReady(input.responseCoverage, sourceItems.filter((item) => item.visible).map((item) => item.id), "exclusion")) {
    return { ok: false, error: moneyError("COVERAGE") };
  }
  const selectedIds = new Set<string>();
  const replacedIds = new Set<string>();
  const rows: SchedulePricingPreview["rows"] = [];
  for (const row of input.rows) {
    if (selectedIds.has(row.scheduleItemId)) return { ok: false, error: moneyError("DUPLICATE_ROW") };
    selectedIds.add(row.scheduleItemId);
    const item = scheduleById.get(row.scheduleItemId);
    const line = lineByItem.get(row.scheduleItemId);
    if (!item || !line || line.decision !== "priced" || line.amount_ex_gst == null) {
      return { ok: false, error: moneyError("NOT_PRICED") };
    }
    if (!row.scopeConfirmed) return { ok: false, error: moneyError("CONFIRM_SCOPE") };
    const qualified = String(line.qualification ?? "").trim();
    if (qualified && !row.qualificationAcknowledged) {
      return { ok: false, error: moneyError("QUALIFICATION") };
    }
    const targets = row.mode === "replace" ? row.replacedItemIds : [];
    if (row.mode !== "replace" && row.mode !== "add") return { ok: false, error: moneyError("AMBIGUOUS") };
    if (row.mode === "replace" && targets.length === 0) return { ok: false, error: moneyError("AMBIGUOUS") };
    for (const targetId of targets) {
      if (replacedIds.has(targetId)) return { ok: false, error: moneyError("AMBIGUOUS") };
      replacedIds.add(targetId);
      const pricingItem = sourceItems.find((candidate) => candidate.id === targetId);
      if (!pricingItem || pricingItem.workAreaId !== input.workAreaId) return { ok: false, error: moneyError("WORK_AREA") };
      if (pricingItem.unit && pricingItem.unit !== "allowance" && pricingItem.unit !== item.unit) {
        return { ok: false, error: moneyError("UNIT") };
      }
    }
    const coverIds = sourceItems.filter((candidate) => candidate.visible && !targets.includes(candidate.id)).map((candidate) => candidate.id);
    if (qualified && (!row.coverage || !coverageReady(row.coverage, coverIds, "qualification"))) {
      return { ok: false, error: moneyError("COVERAGE") };
    }
    if (!qualified && row.coverage) return { ok: false, error: moneyError("COVERAGE") };
    const sourceConflict = targets.some((targetId) =>
      (rates.data ?? []).some((rate) => rate.allowance_item_id === targetId)
      || (lump.data ?? []).some((application) => application.allowance_item_id === targetId || (application.replaced_item_ids ?? []).includes(targetId))
    ) || (row.mode === "add" && (
      (rates.data ?? []).some((rate) => rate.work_area_id === input.workAreaId)
      || (lump.data ?? []).some((application) => application.work_area_id === input.workAreaId)
    ));
    if (sourceConflict && !row.acknowledgeSource) return { ok: false, error: moneyError("SOURCE") };
    const requiredSelected = input.rows.some((candidate) => scheduleById.get(candidate.scheduleItemId)?.line_role === "required");
    const requiredApplied = (applications.data ?? []).some((application) => scheduleById.get(application.schedule_item_id)?.line_role === "required");
    if (item.line_role === "alternative" && (requiredSelected || requiredApplied) && !row.acknowledgeAlternative) {
      return { ok: false, error: moneyError("ALTERNATIVE") };
    }
    const choices = buildRfqSellChoices({
      responseId: `${response.data.id}:${item.id}`,
      priceExGst: Number(line.amount_ex_gst),
      gstRate,
      items: sourceItems,
      replacedIds: targets,
      existingAllowanceId: allowanceByItem.get(item.id) ?? null,
      targetMarginPercent: target?.percent ?? null,
      manualSell: row.manualSell,
    });
    if (!choices.ok) return choices;
    const current = sourceItems.filter((candidate) => targets.includes(candidate.id));
    const currentKnown = current.length > 0 && current.every((candidate) => candidate.totalCost > 0 || candidate.totalSell > 0);
    rows.push({
      scheduleItemId: item.id as string,
      scope: item.scope as string,
      role: item.line_role as string,
      quantity: item.quantity == null ? null : Number(item.quantity),
      unit: item.unit as string,
      unitPrice: line.unit_price_ex_gst == null ? null : Number(line.unit_price_ex_gst),
      cost: Number(line.amount_ex_gst),
      qualification: String(line.qualification ?? ""),
      sourceConflict,
      choices: choices.preview.choices,
      currentCost: currentKnown ? Math.round(current.reduce((sum, candidate) => sum + candidate.totalCost, 0) * 100) / 100 : null,
      currentSell: currentKnown ? Math.round(current.reduce((sum, candidate) => sum + candidate.totalSell, 0) * 100) / 100 : null,
    });
  }
  const beforeTotals = calculateAuthoritativeDocumentTotals(
    sourceItems.map((item) => ({ total_cost: item.totalCost, total_sell: item.totalSell, visible: true })),
    gstRate,
    `schedule-before-${response.data.id}`
  );
  if (!beforeTotals.ok) return { ok: false, error: "Pricing totals could not be previewed." };
  const removed = new Set<string>(replacedIds);
  for (const row of input.rows) removed.add(allowanceByItem.get(row.scheduleItemId) ?? "");
  removed.delete("");
  const chosen = input.rows.map((row) => {
    const previewRow = rows.find((item) => item.scheduleItemId === row.scheduleItemId);
    return previewRow?.choices.find((choice) => choice.treatment === row.sellTreatment && choice.available && choice.allowance);
  });
  const after = chosen.every((choice) => choice?.allowance)
    ? calculateAuthoritativeDocumentTotals(
      [
        ...sourceItems
          .filter((item) => !removed.has(item.id))
          .map((item) => ({
            total_cost: replacedIds.has(item.id) ? 0 : item.totalCost,
            total_sell: replacedIds.has(item.id) ? 0 : item.totalSell,
            visible: true,
          })),
        ...chosen.map((choice) => ({
          total_cost: choice!.allowance!.totalCost,
          total_sell: choice!.allowance!.totalSell,
          visible: true,
        })),
      ],
      gstRate,
      `schedule-after-${response.data.id}`
    )
    : null;
  if (after && !after.ok) return { ok: false, error: "Pricing totals could not be previewed." };
  const untouched = sourceItems
    .filter((item) => item.workAreaId === input.workAreaId && !replacedIds.has(item.id) && !removed.has(item.id))
    .map((item) => ({ id: item.id, label: item.label }));
  return {
    ok: true,
    requestSentAt: rfq.data.sent_at,
    gstRate,
    projectId: rfq.data.project_id,
    rfqId: rfq.data.id,
    quoteIssued,
    preview: {
      ok: true,
      incomplete: response.data.completeness === "partial",
      unpriced,
      pricedSubtotalLabel: response.data.completeness === "partial" ? "Priced subtotal — incomplete response" : null,
      versionNumber: response.data.version_number,
      validUntil: response.data.valid_until,
      exclusions: response.data.excluded_scope ?? "",
      assumptions: response.data.assumptions ?? "",
      gstTreatment: response.data.gst_treatment,
      newer: Boolean(latest.data && latest.data.id !== response.data.id),
      rows,
      before: viewFromTotals(beforeTotals.totals),
      after: after && after.ok ? viewFromTotals(after.totals) : null,
      untouched,
      targetMarginPercent: target?.percent ?? null,
      targetMarginSource: target?.source ?? null,
    },
  };
}

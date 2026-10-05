/**
 * Work Quotr can include but cannot calculate in detail.
 * Authority is the calculator registry, not a second "finished" list.
 */

import { workAreaTypeHasDetailedCalculator } from "@/lib/estimate/calculator-availability";
import { cleanClientLabel } from "@/lib/pricing/calculations";
import {
  buildManualScopePricingNotes,
  isManualScopePricingRequiredNote,
} from "@/lib/work-areas/scope-items/pricing-bridge";

export const MANUAL_PRICING_WORK_AREA_TYPE = "custom";

export const MANUAL_PRICING_NOTICE_TITLE = "You'll price this work yourself";

export const MANUAL_PRICING_NOTICE_BODY =
  "Quotr can include this work in your Quote, but cannot build a detailed estimate for it yet. Add the scope and your price in Pricing.";

export const MANUAL_PRICING_QUOTE_BLOCK =
  "Enter your price for work Quotr cannot calculate before creating a Quote.";

export const MANUAL_ESTIMATE_SKIPPED_MESSAGE =
  "Quotr cannot build a detailed estimate for this work. Continue with manual pricing and enter your price.";

export const WORK_AREA_INTRODUCTION =
  "Review the work Quotr found. Add anything missing; work Quotr cannot calculate can be priced in Pricing.";

export const MANUAL_AREA_PRICE_LABEL = "Price in Pricing";

export const MANUAL_ADD_WORK_LABEL = "Add this work";

export const MANUAL_CONTINUE_ROLE =
  "Saves this description so you can price it in Pricing. This does not analyse the job again.";

export const ANALYSE_JOB_ROLE =
  "Analyse job looks again for work Quotr can calculate. It runs only when you choose it.";

/** Marks the one Pricing line for a manual work area. Scope-item stubs do not use it. */
export const MANUAL_WORK_AREA_LINE_MARKER = "__quotr_manual_work_area_line__:true";

export const MANUAL_PRICING_FOLD_NOTICE =
  "Calculated work was added to this Pricing document. The price you entered is unchanged. Review the combined Pricing before creating a Quote.";

export const MANUAL_PRICING_AFTER_QUOTE_NOTICE =
  "This is a new Pricing document because a Quote was already created. That Quote was not changed. The price you entered was copied here.";

export function isManualPricingWorkAreaType(type: string): boolean {
  return !workAreaTypeHasDetailedCalculator(type);
}

export function partitionWorkAreasByCalculator<T extends { type: string }>(
  workAreas: readonly T[]
): { calculable: T[]; manual: T[] } {
  const calculable: T[] = [];
  const manual: T[] = [];
  for (const area of workAreas) {
    if (workAreaTypeHasDetailedCalculator(area.type)) calculable.push(area);
    else manual.push(area);
  }
  return { calculable, manual };
}

export function manualWorkAreaPersistence(input: {
  name: string;
  scopeDescription: string;
}):
  | {
      ok: true;
      type: typeof MANUAL_PRICING_WORK_AREA_TYPE;
      name: string;
      summary: string;
      quoteDescription: string;
      status: "confirmed";
    }
  | { ok: false; error: string } {
  const name = input.name.trim().replace(/\s+/g, " ");
  const scope = input.scopeDescription.trim();
  if (!name) return { ok: false, error: "Enter a name for this work." };
  if (name.length > 120) {
    return { ok: false, error: "Use a shorter name for this work." };
  }
  if (!scope) {
    return { ok: false, error: "Describe the scope before pricing this work." };
  }
  if (scope.length > 2000) {
    return { ok: false, error: "Use a shorter scope description." };
  }
  return {
    ok: true,
    type: MANUAL_PRICING_WORK_AREA_TYPE,
    name,
    summary: scope,
    quoteDescription: scope,
    status: "confirmed",
  };
}

export function manualWorkAreaScopeText(area: {
  summary?: string | null;
  quote_description?: string | null;
  quoteDescription?: string | null;
}): string {
  return (
    area.quote_description?.trim() ||
    area.quoteDescription?.trim() ||
    area.summary?.trim() ||
    ""
  );
}

export function buildManualWorkAreaPricingItemRow(params: {
  orgId: string;
  projectId: string;
  workAreaId: string;
  name: string;
  scope: string | null;
  sortOrder: number;
}): Record<string, unknown> {
  const name = params.name.trim() || "Work";
  const scope = params.scope?.trim() || null;
  const clientLabel = cleanClientLabel(name) || name;
  return {
    org_id: params.orgId,
    pricing_document_id: null,
    project_id: params.projectId,
    work_area_id: params.workAreaId,
    source_estimate_line_item_id: null,
    item_type: "allowance",
    delivery_method: "allowance",
    internal_label: name,
    client_label: clientLabel,
    internal_description: scope,
    client_description: scope,
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
    sort_order: params.sortOrder,
    notes_internal: buildManualScopePricingNotes({
      title: name,
      description: scope,
      lineMarker: MANUAL_WORK_AREA_LINE_MARKER,
    }),
  };
}

export type ManualPricingHandoffDocument = {
  id: string;
  status: string;
  estimate_id: string | null;
  created_at?: string | null;
};

/**
 * After a manual price exists, a later supported area must not open a second
 * active Pricing document or zero the entered price. A document already
 * converted to a Quote stays untouched.
 */
export function decideManualPricingHandoff(
  documents: readonly ManualPricingHandoffDocument[]
):
  | { action: "create_new" }
  | { action: "fold_into_open"; documentId: string; resetReview: boolean }
  | { action: "new_after_quote"; sourceDocumentId: string } {
  const manual = documents
    .filter((document) => document.estimate_id == null)
    .slice()
    .sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
    );
  const open = manual.find(
    (document) => document.status === "draft" || document.status === "reviewed"
  );
  if (open) {
    return {
      action: "fold_into_open",
      documentId: open.id,
      resetReview: open.status === "reviewed",
    };
  }
  const issued = manual.find(
    (document) => document.status === "converted_to_quote"
  );
  if (issued) {
    return { action: "new_after_quote", sourceDocumentId: issued.id };
  }
  return { action: "create_new" };
}

export function pricingRowsForOpenManualHandoff(input: {
  existingItems: readonly {
    work_area_id?: string | null;
    notes_internal?: string | null;
  }[];
  incomingRows: readonly Record<string, unknown>[];
}): Record<string, unknown>[] {
  const covered = new Set(
    input.existingItems
      .filter((item) => isManualScopePricingRequiredNote(item.notes_internal))
      .map((item) => String(item.work_area_id ?? ""))
  );
  return input.incomingRows.filter((row) => {
    if (row.source_estimate_line_item_id) return true;
    return !covered.has(String(row.work_area_id ?? ""));
  });
}

type PricedManualLine = {
  work_area_id?: string | null;
  notes_internal?: string | null;
  total_sell?: number | null;
  unit_sell?: number | null;
  total_cost?: number | null;
  unit_cost?: number | null;
  quantity?: number | null;
  unit?: string | null;
  client_description?: string | null;
  gross_profit?: number | null;
  margin_percent?: number | null;
  markup_percent?: number | null;
};

/** Copy an entered manual sell onto a new draft. Does not invent a cost. */
export function copyEnteredManualPrices(input: {
  incomingRows: readonly Record<string, unknown>[];
  pricedItems: readonly PricedManualLine[];
}): Record<string, unknown>[] {
  const byArea = new Map<string, PricedManualLine>();
  for (const item of input.pricedItems) {
    if (!isManualScopePricingRequiredNote(item.notes_internal)) continue;
    const sell = Number(item.total_sell ?? 0);
    if (!Number.isFinite(sell) || sell <= 0 || !item.work_area_id) continue;
    byArea.set(String(item.work_area_id), item);
  }
  return input.incomingRows.map((row) => {
    if (row.source_estimate_line_item_id) return { ...row };
    const priced = byArea.get(String(row.work_area_id ?? ""));
    if (!priced) return { ...row };
    return {
      ...row,
      quantity: priced.quantity ?? row.quantity,
      unit: priced.unit ?? row.unit,
      unit_cost: priced.unit_cost ?? null,
      unit_sell: priced.unit_sell ?? null,
      total_cost: priced.total_cost ?? 0,
      total_sell: priced.total_sell ?? 0,
      gross_profit: priced.gross_profit ?? 0,
      margin_percent: priced.margin_percent ?? 0,
      markup_percent: priced.markup_percent ?? 0,
      client_description: priced.client_description ?? row.client_description,
    };
  });
}

export function unresolvedManualPricingQuoteBlock(
  items: readonly {
    notes_internal?: string | null;
    total_sell?: number | null;
    visible_on_quote?: boolean | null;
  }[]
): string | null {
  const blocked = items.some((item) => {
    if (item.visible_on_quote === false) return false;
    const sell = Number(item.total_sell ?? 0);
    return (
      isManualScopePricingRequiredNote(item.notes_internal) &&
      (!Number.isFinite(sell) || sell <= 0)
    );
  });
  return blocked ? MANUAL_PRICING_QUOTE_BLOCK : null;
}

/**
 * A blank cost on work Quotr did not calculate is not a known $0 cost.
 * The commercial engine treats an omitted cost as unknown and an explicit 0
 * as known, which would invent a margin from the user's sell price.
 */
export function manualScopeSellOmitsBlankCost(input: {
  originatedAsPricingRequired: boolean;
  totalCost: number | null | undefined;
  totalSell: number | null | undefined;
}): boolean {
  const sell = Number(input.totalSell ?? 0);
  const cost = input.totalCost;
  return (
    input.originatedAsPricingRequired &&
    Number.isFinite(sell) &&
    sell > 0 &&
    (cost == null || cost === 0)
  );
}

export function presentClientSellForUnresolvedDocument(params: {
  pricingRequiredCount: number;
  subtotalSell: number;
  costKnown: boolean;
  formattedSell: string;
}): string {
  // Hide a complete $0 only. A mixed job still shows the calculated sell
  // while the unpriced manual line stays Pricing Required on its own row.
  if (params.pricingRequiredCount > 0 && params.subtotalSell <= 0) {
    return "Pricing required";
  }
  return params.formattedSell;
}

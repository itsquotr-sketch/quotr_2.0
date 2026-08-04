/**
 * Pure adapters: legacy input shapes → commercial-engine requests.
 * No Supabase, no mutations, no server actions.
 */

import {
  buildAggregateRequest,
  buildLineRequest,
} from "../contract/normalize";
import type { CommercialCalculationRequest } from "../contract/types";
import type { CalculationMode } from "../core/types";

export function adaptPricingItemToEngineRequest(params: {
  requestId: string;
  mode: CalculationMode;
  quantity?: number | null;
  unitCost?: number | null;
  unitSell?: number | null;
  totalCost?: number | null;
  totalSell?: number | null;
  productivityRate?: number | null;
  calculatedQuantity?: number | null;
  targetMarginPercent?: number | null;
  wastePercent?: number | null;
  sourceRefs?: readonly string[];
}): CommercialCalculationRequest {
  if (params.mode === "lump_sum") {
    return buildLineRequest({
      requestId: params.requestId,
      input: {
        mode: "lump_sum",
        quantity: params.quantity,
        total_cost: params.totalCost,
        total_sell: params.totalSell ?? 0,
        source_references: params.sourceRefs,
      },
      source: {
        source_references: [...(params.sourceRefs ?? ["legacy:pricing_item"])],
        origin: "fixture",
      },
    });
  }

  if (params.mode === "productivity_labour") {
    return buildLineRequest({
      requestId: params.requestId,
      input: {
        mode: "productivity_labour",
        quantity: params.quantity,
        unit_cost: params.unitCost,
        unit_sell: params.unitSell,
        productivity_rate: params.productivityRate,
        calculated_quantity: params.calculatedQuantity,
        target_gross_margin_percent: params.targetMarginPercent,
        source_references: params.sourceRefs,
      },
      source: {
        source_references: [...(params.sourceRefs ?? ["legacy:pricing_item"])],
        origin: "fixture",
      },
    });
  }

  return buildLineRequest({
    requestId: params.requestId,
    input: {
      mode: "quantity_rate",
      quantity: params.quantity,
      unit_cost: params.unitCost,
      unit_sell: params.unitSell,
      target_gross_margin_percent: params.targetMarginPercent,
      waste_percent: params.wastePercent,
      source_references: params.sourceRefs,
    },
    source: {
      source_references: [...(params.sourceRefs ?? ["legacy:pricing_item"])],
      origin: "fixture",
    },
  });
}

export function adaptPricingDocumentToEngineRequest(params: {
  requestId: string;
  items: Array<{
    total_cost: number;
    total_sell: number;
    visible?: boolean;
    cost_known?: boolean;
  }>;
  gstRate: number;
  inclusionRule?: "all" | "visible_only";
}): CommercialCalculationRequest {
  return buildAggregateRequest({
    requestId: params.requestId,
    lines: params.items.map((i) => ({
      total_cost: i.total_cost,
      total_sell: i.total_sell,
      visible: i.visible,
      cost_known: i.cost_known,
    })),
    inclusionRule: params.inclusionRule ?? "all",
    gstRatePercent: params.gstRate,
    source: {
      source_references: ["legacy:pricing_document"],
      origin: "fixture",
    },
  });
}

export function adaptEstimateSellFromMarginToEngineRequest(params: {
  requestId: string;
  cost: number;
  marginPercent: number;
}): CommercialCalculationRequest {
  return buildLineRequest({
    requestId: params.requestId,
    input: {
      mode: "quantity_rate",
      quantity: 1,
      unit_cost: params.cost,
      target_gross_margin_percent: params.marginPercent,
    },
    source: {
      source_references: ["legacy:estimate_margin"],
      origin: "fixture",
    },
  });
}

export function adaptQuoteDocumentToEngineRequest(params: {
  requestId: string;
  items: Array<{ total: number; visible: boolean; total_cost?: number }>;
  gstRate: number;
}): CommercialCalculationRequest {
  return buildAggregateRequest({
    requestId: params.requestId,
    lines: params.items.map((i) => ({
      total_cost: i.total_cost ?? 0,
      total_sell: i.total,
      visible: i.visible,
      cost_known: i.total_cost != null,
    })),
    inclusionRule: "visible_only",
    gstRatePercent: params.gstRate,
    source: {
      source_references: ["legacy:quote_document"],
      origin: "fixture",
    },
  });
}

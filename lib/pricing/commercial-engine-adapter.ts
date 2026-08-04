/**
 * Production adapter: pricing-domain inputs ↔ commercial engine.
 * Batch 2B.6A — used by add/update/duplicate pricing item paths.
 *
 * Does not import parity helpers. Does not touch Supabase.
 */

import {
  buildLineRequest,
  calculateLineItem,
  executeCommercialCalculation,
  type CalculationLineInput,
  type CalculationOutputs,
  type CommercialCalculationRecord,
  type CommercialCalculationRequest,
  type CommercialSettingsSnapshot,
  type ManualOverrideCapture,
} from "@/lib/commercial-engine";
import { DEFAULT_GROSS_MARGIN_PERCENT } from "@/lib/commercial-engine/versioning";
import { inferCalculationMode } from "@/lib/pricing/pricing-item-calculation";
import type { CalculationMode, PricingItemType } from "@/lib/pricing/types";

export type PricingItemCommercialInput = {
  readonly quantity?: number | null;
  readonly unit?: string | null;
  readonly unitCost?: number | null;
  readonly unitSell?: number | null;
  readonly totalCost?: number | null;
  readonly totalSell?: number | null;
  readonly itemType?: PricingItemType;
  readonly calculationMode?: CalculationMode | null;
  readonly productivityRate?: number | null;
  readonly productivityUnit?: string | null;
  readonly calculatedQuantity?: number | null;
  /** When true, treat provided sell as a manual override of derived sell. */
  readonly manualSellOverride?: boolean;
  readonly sourceReferences?: readonly string[];
  readonly requestId?: string;
};

export type PersistedPricingItemMoneyFields = {
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly unitCost: number | null;
  readonly unitSell: number | null;
  readonly totalCost: number;
  readonly totalSell: number;
  readonly grossProfit: number;
  readonly marginPercent: number;
  readonly markupPercent: number;
  readonly calculationMode: CalculationMode;
  readonly productivityRate: number | null;
  readonly productivityUnit: string | null;
  readonly calculatedQuantity: number | null;
  readonly costKnown: boolean;
};

export type PricingEngineAdapterError = {
  readonly ok: false;
  readonly error: string;
  readonly codes: readonly string[];
};

export type PricingEngineAdapterSuccess = {
  readonly ok: true;
  readonly request: CommercialCalculationRequest;
  readonly record: CommercialCalculationRecord;
  readonly fields: PersistedPricingItemMoneyFields;
};

export type PricingEngineAdapterResult =
  | PricingEngineAdapterSuccess
  | PricingEngineAdapterError;

/**
 * DB columns are NOT NULL for profit triad. Engine null (unknown cost) maps to
 * 0 as the approved persistence sentinel — never fabricate 100% margin.
 */
export function persistCommercialMetric(
  value: number | null | undefined,
  costKnown: boolean
): number {
  if (!costKnown) {
    return 0;
  }
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

export function resolveLineCalculationMode(
  input: PricingItemCommercialInput
): CalculationMode {
  return inferCalculationMode({
    calculationMode: input.calculationMode,
    quantity: input.quantity,
    unitCost: input.unitCost,
    unitSell: input.unitSell,
    totalCost: input.totalCost,
    totalSell: input.totalSell,
    productivityRate: input.productivityRate,
    calculatedQuantity: input.calculatedQuantity,
    itemType: input.itemType,
  });
}

function defaultSettings(
  partial?: Partial<CommercialSettingsSnapshot>
): CommercialSettingsSnapshot {
  return {
    default_gross_margin_percent:
      partial?.default_gross_margin_percent === undefined
        ? DEFAULT_GROSS_MARGIN_PERCENT
        : partial.default_gross_margin_percent,
    gst_rate_percent:
      partial?.gst_rate_percent === undefined ? null : partial.gst_rate_percent,
    currency: partial?.currency ?? "NZD",
  };
}

/**
 * Map validated pricing-item domain inputs to a CommercialCalculationRequest.
 *
 * Rules:
 * - quantity_rate / productivity_labour: do not trust client total_cost/total_sell
 *   (derived); engine recomputes from rates × qty/hours.
 * - lump_sum: total_cost / total_sell are commercial inputs (explicit 0 ≠ omitted).
 * - omitted optional fields → null on the request; explicit 0 is preserved.
 * - undefined totalCost on lump_sum means unknown cost (omit); null/0 are explicit.
 */
export function buildPricingItemCalculationRequest(
  input: PricingItemCommercialInput,
  commercialSettings?: Partial<CommercialSettingsSnapshot>
): CommercialCalculationRequest {
  const mode = resolveLineCalculationMode(input);
  const settings = defaultSettings(commercialSettings);
  const sourceRefs = [...(input.sourceReferences ?? ["pricing:item"])];
  const overrides: ManualOverrideCapture[] = [];

  if (input.manualSellOverride && input.unitSell != null) {
    overrides.push({
      field: "unit_sell",
      original_value: null,
      override_value: input.unitSell,
      reason_category: "manual_sell",
      source: "manual",
      affected_arithmetic: true,
    });
  }

  const marginFallback =
    settings.default_gross_margin_percent ?? DEFAULT_GROSS_MARGIN_PERCENT;

  if (mode === "lump_sum") {
    return buildLineRequest({
      requestId: input.requestId ?? "pricing-item",
      input: {
        mode: "lump_sum",
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        total_cost: input.totalCost === undefined ? null : input.totalCost,
        total_sell: input.totalSell ?? 0,
        manual_override:
          overrides.length > 0
            ? {
                overridden_fields: overrides.map((o) => o.field),
                source: "manual",
              }
            : null,
        source_references: sourceRefs,
      },
      commercialSettings: settings,
      manualOverrides: overrides,
      source: {
        source_references: sourceRefs,
        origin: "manual",
      },
    });
  }

  if (mode === "productivity_labour") {
    const hasSell = input.unitSell != null && Number.isFinite(input.unitSell);
    const hasCost = input.unitCost != null && Number.isFinite(input.unitCost);
    return buildLineRequest({
      requestId: input.requestId ?? "pricing-item",
      input: {
        mode: "productivity_labour",
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        unit_cost: input.unitCost ?? null,
        unit_sell: input.unitSell ?? null,
        productivity_rate: input.productivityRate ?? null,
        productivity_unit: input.productivityUnit ?? input.unit ?? null,
        calculated_quantity: input.calculatedQuantity ?? null,
        target_gross_margin_percent:
          hasCost && !hasSell ? marginFallback : null,
        manual_override:
          overrides.length > 0
            ? {
                overridden_fields: overrides.map((o) => o.field),
                source: "manual",
              }
            : null,
        source_references: sourceRefs,
      },
      commercialSettings: settings,
      manualOverrides: overrides,
      source: {
        source_references: sourceRefs,
        origin: "manual",
      },
    });
  }

  const hasSell = input.unitSell != null && Number.isFinite(input.unitSell);
  const hasCost = input.unitCost != null && Number.isFinite(input.unitCost);
  return buildLineRequest({
    requestId: input.requestId ?? "pricing-item",
    input: {
      mode: "quantity_rate",
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      unit_cost: input.unitCost ?? null,
      unit_sell: input.unitSell ?? null,
      target_gross_margin_percent:
        hasCost && !hasSell ? marginFallback : null,
      source_references: sourceRefs,
      manual_override:
        overrides.length > 0
          ? {
              overridden_fields: overrides.map((o) => o.field),
              source: "manual",
            }
          : null,
    },
    commercialSettings: settings,
    manualOverrides: overrides,
    source: {
      source_references: sourceRefs,
      origin: "manual",
    },
  });
}

export function mapLineOutputsToPersistedFields(
  outputs: CalculationOutputs
): PersistedPricingItemMoneyFields {
  const costKnown = outputs.cost_known;
  return {
    quantity: outputs.quantity,
    unit: outputs.unit,
    unitCost: outputs.unit_cost,
    unitSell: outputs.unit_sell,
    totalCost: outputs.total_cost,
    totalSell: outputs.total_sell,
    grossProfit: persistCommercialMetric(outputs.gross_profit, costKnown),
    marginPercent: persistCommercialMetric(
      outputs.gross_margin_percent,
      costKnown
    ),
    markupPercent: persistCommercialMetric(outputs.markup_percent, costKnown),
    calculationMode: outputs.mode,
    productivityRate: outputs.productivity_rate,
    productivityUnit: outputs.productivity_unit,
    calculatedQuantity: outputs.calculated_quantity,
    costKnown,
  };
}

/**
 * Execute the authoritative commercial engine for a pricing item and map to
 * existing persisted columns.
 */
export function calculateAuthoritativePricingItem(
  input: PricingItemCommercialInput,
  commercialSettings?: Partial<CommercialSettingsSnapshot>
): PricingEngineAdapterResult {
  const request = buildPricingItemCalculationRequest(
    input,
    commercialSettings
  );
  const record = executeCommercialCalculation(request);

  if (!record.ok) {
    const codes = record.blockingErrors.map((e) => e.code);
    const message =
      record.blockingErrors[0]?.message ??
      "Pricing calculation failed validation.";
    return { ok: false, error: message, codes };
  }

  const lineResult = calculateLineItem(
    request.input as CalculationLineInput
  );
  if (!lineResult.ok || !lineResult.outputs) {
    const message =
      lineResult.validation_errors[0]?.message ??
      "Pricing calculation failed.";
    return {
      ok: false,
      error: message,
      codes: lineResult.validation_errors.map((e) => e.code),
    };
  }

  return {
    ok: true,
    request,
    record,
    fields: mapLineOutputsToPersistedFields(lineResult.outputs),
  };
}

/** Blank new item: known-zero lump sum (quantity 1 informational). */
export function calculateBlankPricingItem(params?: {
  requestId?: string;
  itemType?: PricingItemType;
}): PricingEngineAdapterResult {
  return calculateAuthoritativePricingItem({
    requestId: params?.requestId ?? "pricing-item-blank",
    itemType: params?.itemType ?? "other",
    calculationMode: "lump_sum",
    quantity: 1,
    totalCost: 0,
    totalSell: 0,
    sourceReferences: ["pricing:add_blank"],
  });
}

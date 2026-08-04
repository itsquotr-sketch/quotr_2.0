/**
 * Request normalization — Batch 2B.3C.
 * Equivalent valid requests normalize identically.
 */

import type {
  AggregateInclusionRule,
  AggregateLineInput,
  CalculationLineInput,
  CalculationMode,
} from "../core/types";
import {
  DEFAULT_GROSS_MARGIN_PERCENT,
  DEFAULT_GST_RATE_PERCENT,
  ENGINE_VERSION,
  FORMULA_VERSION,
} from "../versioning";
import { deepFreeze } from "./deep-freeze";
import { serializeCanonical } from "./serialize";
import type {
  AggregateRequestBody,
  CommercialCalculationKind,
  CommercialCalculationRequest,
  CommercialSettingsSnapshot,
  ExplicitModifier,
  ManualOverrideCapture,
  SourceProvenance,
} from "./types";

function nullIfUndefined<T>(value: T | null | undefined): T | null {
  return value === undefined ? null : value;
}

export function normalizeLineInput(
  input: CalculationLineInput
): CalculationLineInput {
  return deepFreeze({
    calculation_id: input.calculation_id,
    mode: input.mode,
    quantity: nullIfUndefined(input.quantity),
    unit: nullIfUndefined(input.unit),
    unit_cost: nullIfUndefined(input.unit_cost),
    unit_sell: nullIfUndefined(input.unit_sell),
    total_cost: nullIfUndefined(input.total_cost),
    total_sell: nullIfUndefined(input.total_sell),
    productivity_rate: nullIfUndefined(input.productivity_rate),
    productivity_unit: nullIfUndefined(input.productivity_unit),
    calculated_quantity: nullIfUndefined(input.calculated_quantity),
    target_gross_margin_percent: nullIfUndefined(
      input.target_gross_margin_percent
    ),
    waste_percent: nullIfUndefined(input.waste_percent),
    quantity_waste_adjusted:
      input.quantity_waste_adjusted === undefined
        ? undefined
        : input.quantity_waste_adjusted,
    visible: input.visible,
    included_in_total: input.included_in_total,
    source_references: input.source_references
      ? Object.freeze([...input.source_references])
      : undefined,
    manual_override: input.manual_override
      ? deepFreeze({
          ...input.manual_override,
          overridden_fields: Object.freeze([
            ...input.manual_override.overridden_fields,
          ]),
          previous_values: input.manual_override.previous_values
            ? deepFreeze({ ...input.manual_override.previous_values })
            : undefined,
        })
      : null,
    assumptions: input.assumptions
      ? Object.freeze([...input.assumptions])
      : undefined,
  });
}

export function normalizeAggregateBody(
  input: AggregateRequestBody
): AggregateRequestBody {
  return deepFreeze({
    calculation_id: input.calculation_id,
    inclusion_rule: input.inclusion_rule,
    gst_rate_percent:
      input.gst_rate_percent === undefined ? undefined : input.gst_rate_percent,
    lines: Object.freeze(
      input.lines.map((line) =>
        deepFreeze({
          total_cost: line.total_cost,
          total_sell: line.total_sell,
          visible: line.visible,
          included_in_total: line.included_in_total,
          cost_known: line.cost_known,
        })
      )
    ),
  });
}

export function defaultCommercialSettings(
  partial?: Partial<CommercialSettingsSnapshot>
): CommercialSettingsSnapshot {
  return deepFreeze({
    default_gross_margin_percent:
      partial?.default_gross_margin_percent === undefined
        ? DEFAULT_GROSS_MARGIN_PERCENT
        : partial.default_gross_margin_percent,
    gst_rate_percent:
      partial?.gst_rate_percent === undefined
        ? DEFAULT_GST_RATE_PERCENT
        : partial.gst_rate_percent,
    currency: partial?.currency ?? "NZD",
  });
}

export function buildLineRequest(params: {
  requestId: string;
  input: CalculationLineInput;
  commercialSettings?: Partial<CommercialSettingsSnapshot>;
  source?: Partial<SourceProvenance>;
  manualOverrides?: readonly ManualOverrideCapture[];
  explicitModifiers?: readonly ExplicitModifier[];
  calculationTimestamp?: string | null;
  engineVersionRequested?: string | null;
  formulaVersionRequested?: string | null;
}): CommercialCalculationRequest {
  const input = normalizeLineInput(params.input);
  const overrides =
    params.manualOverrides ??
    (input.manual_override
      ? Object.freeze(
          input.manual_override.overridden_fields.map((field) =>
            deepFreeze({
              field,
              original_value:
                input.manual_override?.previous_values?.[field] ?? null,
              override_value: null,
              reason_category: input.manual_override?.reason ?? null,
              source: input.manual_override?.source ?? null,
              user_reference: input.manual_override?.actor_ref ?? null,
              timestamp: input.manual_override?.at ?? null,
              affected_arithmetic: true,
            } satisfies ManualOverrideCapture)
          )
        )
      : Object.freeze([] as ManualOverrideCapture[]));

  const modifiers: ExplicitModifier[] = [...(params.explicitModifiers ?? [])];
  if (input.waste_percent != null) {
    modifiers.push({
      code: "waste_percent",
      field: "waste_percent",
      value: input.waste_percent,
    });
  }

  return deepFreeze({
    requestId: params.requestId,
    calculationKind: "line_item" as CommercialCalculationKind,
    calculationMode: input.mode,
    engineVersionRequested:
      params.engineVersionRequested === undefined
        ? ENGINE_VERSION
        : params.engineVersionRequested,
    formulaVersionRequested:
      params.formulaVersionRequested === undefined
        ? FORMULA_VERSION
        : params.formulaVersionRequested,
    currency: "NZD" as const,
    input,
    commercialSettings: defaultCommercialSettings(params.commercialSettings),
    source: deepFreeze({
      source_references: Object.freeze([
        ...(params.source?.source_references ??
          input.source_references ??
          []),
      ]),
      actor_ref: params.source?.actor_ref ?? null,
      origin: params.source?.origin ?? null,
    }),
    manualOverrides: Object.freeze([...overrides]),
    explicitModifiers: Object.freeze(modifiers),
    calculationTimestamp: params.calculationTimestamp ?? null,
  });
}

export function buildAggregateRequest(params: {
  requestId: string;
  lines: readonly AggregateLineInput[];
  inclusionRule: AggregateInclusionRule;
  gstRatePercent?: number | null;
  commercialSettings?: Partial<CommercialSettingsSnapshot>;
  source?: Partial<SourceProvenance>;
  calculationTimestamp?: string | null;
  calculationId?: string;
}): CommercialCalculationRequest {
  const body = normalizeAggregateBody({
    calculation_id: params.calculationId,
    lines: params.lines,
    inclusion_rule: params.inclusionRule,
    gst_rate_percent: params.gstRatePercent,
  });

  return deepFreeze({
    requestId: params.requestId,
    calculationKind: "document_aggregate" as const,
    calculationMode: "document_aggregate" as const,
    engineVersionRequested: ENGINE_VERSION,
    formulaVersionRequested: FORMULA_VERSION,
    currency: "NZD" as const,
    input: body,
    commercialSettings: defaultCommercialSettings({
      ...params.commercialSettings,
      gst_rate_percent:
        params.gstRatePercent === undefined
          ? params.commercialSettings?.gst_rate_percent ?? null
          : params.gstRatePercent,
    }),
    source: deepFreeze({
      source_references: Object.freeze([
        ...(params.source?.source_references ?? []),
      ]),
      actor_ref: params.source?.actor_ref ?? null,
      origin: params.source?.origin ?? null,
    }),
    manualOverrides: Object.freeze([] as ManualOverrideCapture[]),
    explicitModifiers: Object.freeze([] as ExplicitModifier[]),
    calculationTimestamp: params.calculationTimestamp ?? null,
  });
}

/** Stable fingerprint of a request for determinism checks. */
export function normalizeRequestFingerprint(
  request: CommercialCalculationRequest
): string {
  const payload = {
    calculationKind: request.calculationKind,
    calculationMode: request.calculationMode,
    currency: request.currency,
    engineVersionRequested: request.engineVersionRequested,
    formulaVersionRequested: request.formulaVersionRequested,
    commercialSettings: request.commercialSettings,
    input: request.input,
    explicitModifiers: request.explicitModifiers,
    manualOverrides: request.manualOverrides,
    source: request.source,
    // requestId and calculationTimestamp excluded from arithmetic fingerprint
  };
  return serializeCanonical(payload);
}

export function isLineMode(
  mode: CalculationMode | "document_aggregate"
): mode is CalculationMode {
  return (
    mode === "quantity_rate" ||
    mode === "productivity_labour" ||
    mode === "lump_sum"
  );
}

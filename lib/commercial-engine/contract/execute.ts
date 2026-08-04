/**
 * Canonical execution entry — Batch 2B.3C.
 * Pure: uses only values on the request. Does not read company settings or time.
 */

import { calculateDocumentAggregate } from "../calculations/aggregate";
import { calculateLineItem } from "../calculations/calculate-line";
import type { CalculationLineInput } from "../core/types";
import {
  buildRecordFromAggregateResult,
  buildRecordFromLineResult,
} from "./build-record";
import { BLOCKING_ERROR_CODES } from "./codes";
import { deepFreeze } from "./deep-freeze";
import type {
  AggregateRequestBody,
  CommercialCalculationRecord,
  CommercialCalculationRequest,
} from "./types";

export function executeCommercialCalculation(
  request: CommercialCalculationRequest
): CommercialCalculationRecord {
  if (request.calculationKind === "line_item") {
    const input = request.input as CalculationLineInput;
    // commercialSettings.default_gross_margin_percent is advisory for callers;
    // arithmetic uses explicit target_gross_margin_percent / unit_sell on input.
    const result = calculateLineItem(input);
    return buildRecordFromLineResult(request, result);
  }

  if (request.calculationKind === "document_aggregate") {
    const body = request.input as AggregateRequestBody;
    const result = calculateDocumentAggregate({
      calculation_id: body.calculation_id,
      lines: body.lines,
      inclusion_rule: body.inclusion_rule,
      gst_rate_percent: body.gst_rate_percent,
    });
    return buildRecordFromAggregateResult(request, result);
  }

  return deepFreeze({
    requestId: request.requestId,
    calculationId: null,
    engineVersion: request.engineVersionRequested ?? "unknown",
    formulaVersion: request.formulaVersionRequested ?? "unknown",
    calculationKind: request.calculationKind,
    calculationMode: request.calculationMode,
    currency: request.currency,
    ok: false,
    inputSnapshot: deepFreeze({
      kind: "line_item" as const,
      mode: "lump_sum" as const,
      quantity: null,
      unit: null,
      unit_cost: null,
      unit_sell: null,
      total_cost: null,
      total_sell: null,
      productivity_rate: null,
      productivity_unit: null,
      calculated_quantity: null,
      target_gross_margin_percent: null,
      waste_percent: null,
      quantity_waste_adjusted: null,
      visible: null,
      included_in_total: null,
      assumptions: Object.freeze([] as string[]),
    }),
    commercialSettings: request.commercialSettings,
    explicitModifiers: request.explicitModifiers,
    manualOverrides: request.manualOverrides,
    provenance: request.source,
    outputs: null,
    steps: Object.freeze([]),
    blockingErrors: Object.freeze([
      {
        code: BLOCKING_ERROR_CODES.INVALID_REQUEST,
        severity: "blocking_error" as const,
        message: "Unknown calculationKind.",
        category: "validation" as const,
      },
    ]),
    warnings: Object.freeze([]),
    assumptions: Object.freeze([] as string[]),
    explanationKeys: Object.freeze([] as string[]),
    futureLearningHooks: Object.freeze([]),
    calculationTimestamp: request.calculationTimestamp ?? null,
    normalizedRequestJson: "",
  });
}

/**
 * Build CommercialCalculationRecord from kernel results — Batch 2B.3C.
 */

import type {
  AggregateResult,
  CalculationLineInput,
  CalculationResult,
} from "../core/types";
import { deepFreeze } from "./deep-freeze";
import { mapLegacyStepsToStructured } from "./map-steps";
import { normalizeRequestFingerprint } from "./normalize";
import { WARNING_CODES, type ContractIssue } from "./codes";
import { EXPLANATION_KEYS } from "./step-codes";
import type {
  AggregateRequestBody,
  CommercialCalculationRecord,
  CommercialCalculationRequest,
  CommercialFinancialOutputs,
  CommercialInputSnapshot,
  FutureLearningHook,
  ManualOverrideCapture,
} from "./types";

function toContractIssues(
  items: readonly { code: string; message: string; field?: string }[],
  severity: ContractIssue["severity"],
  category: ContractIssue["category"]
): ContractIssue[] {
  return items.map((i) =>
    deepFreeze({
      code: i.code,
      severity,
      message: i.message,
      field: i.field,
      category,
    })
  );
}

function lineInputSnapshot(
  input: CalculationLineInput
): CommercialInputSnapshot {
  return deepFreeze({
    kind: "line_item" as const,
    mode: input.mode,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    unit_cost: input.unit_cost ?? null,
    unit_sell: input.unit_sell ?? null,
    total_cost: input.total_cost ?? null,
    total_sell: input.total_sell ?? null,
    productivity_rate: input.productivity_rate ?? null,
    productivity_unit: input.productivity_unit ?? null,
    calculated_quantity: input.calculated_quantity ?? null,
    target_gross_margin_percent: input.target_gross_margin_percent ?? null,
    waste_percent: input.waste_percent ?? null,
    quantity_waste_adjusted:
      input.quantity_waste_adjusted === undefined
        ? null
        : input.quantity_waste_adjusted,
    visible: input.visible ?? null,
    included_in_total: input.included_in_total ?? null,
    assumptions: Object.freeze([...(input.assumptions ?? [])]),
  });
}

function aggregateInputSnapshot(
  body: AggregateRequestBody
): CommercialInputSnapshot {
  return deepFreeze({
    kind: "document_aggregate" as const,
    inclusion_rule: body.inclusion_rule,
    gst_rate_percent:
      body.gst_rate_percent === undefined ? null : body.gst_rate_percent,
    gst_rate_provided: body.gst_rate_percent !== undefined,
    lines: Object.freeze(
      body.lines.map((l) =>
        deepFreeze({
          total_cost: l.total_cost,
          total_sell: l.total_sell,
          visible: l.visible ?? null,
          included_in_total: l.included_in_total ?? null,
          cost_known: l.cost_known ?? null,
        })
      )
    ),
  });
}

function enrichWarnings(
  base: ContractIssue[],
  result: CalculationResult | AggregateResult,
  overrides: readonly ManualOverrideCapture[]
): ContractIssue[] {
  const warnings = [...base];
  const codes = new Set(warnings.map((w) => w.code));

  const costKnown =
    "outputs" in result
      ? (result.outputs?.cost_known ?? true)
      : result.cost_known;

  if (!costKnown) {
    if (!codes.has(WARNING_CODES.COST_UNKNOWN)) {
      warnings.push(
        deepFreeze({
          code: WARNING_CODES.COST_UNKNOWN,
          severity: "warning" as const,
          message: "Cost is unknown; profit and margin are not fabricated.",
          category: "commercial" as const,
        })
      );
    }
    if (!codes.has(WARNING_CODES.PROFITABILITY_UNKNOWN)) {
      warnings.push(
        deepFreeze({
          code: WARNING_CODES.PROFITABILITY_UNKNOWN,
          severity: "warning" as const,
          message: "Profitability unknown because cost is unknown.",
          category: "commercial" as const,
        })
      );
    }
    if (
      "inputs" in result &&
      result.inputs.mode === "lump_sum" &&
      !codes.has(WARNING_CODES.SELL_ONLY_LUMP)
    ) {
      warnings.push(
        deepFreeze({
          code: WARNING_CODES.SELL_ONLY_LUMP,
          severity: "warning" as const,
          message: "Sell-only lump sum: cost not supplied.",
          category: "commercial" as const,
        })
      );
    }
  }

  if (overrides.length > 0 && !codes.has(WARNING_CODES.MANUAL_OVERRIDE_APPLIED)) {
    warnings.push(
      deepFreeze({
        code: WARNING_CODES.MANUAL_OVERRIDE_APPLIED,
        severity: "warning" as const,
        message: "Manual override metadata present on this calculation.",
        category: "override" as const,
      })
    );
  }

  return warnings;
}

function learningHooksFrom(
  result: CalculationResult | AggregateResult,
  overrides: readonly ManualOverrideCapture[]
): readonly FutureLearningHook[] {
  const hooks: FutureLearningHook[] = [];
  const signals =
    "future_learning" in result ? result.future_learning.signals : [];

  for (const signal of signals) {
    hooks.push(
      deepFreeze({
        candidateType: signal,
        targetField: null,
        sourceEvidence: signal,
        constraintReference: null,
        overrideReference: null,
        eligibleForFutureReview:
          signal.includes("override") ||
          signal.includes("manual") ||
          signal === "cost_unknown",
      })
    );
  }

  for (const o of overrides) {
    hooks.push(
      deepFreeze({
        candidateType: "manual_override_evidence",
        targetField: o.field,
        sourceEvidence: o.reason_category ?? null,
        constraintReference: null,
        overrideReference: o.field,
        eligibleForFutureReview: true,
      })
    );
  }

  return Object.freeze(hooks);
}

export function buildRecordFromLineResult(
  request: CommercialCalculationRequest,
  result: CalculationResult
): CommercialCalculationRecord {
  const input = request.input as CalculationLineInput;
  const costKnown = result.outputs?.cost_known ?? false;

  let outputs: CommercialFinancialOutputs | null = null;
  if (result.ok && result.outputs) {
    outputs = deepFreeze({
      costKnown: result.outputs.cost_known,
      totalCost: result.outputs.total_cost,
      totalSell: result.outputs.total_sell,
      grossProfit: result.outputs.gross_profit,
      grossMarginPercent: result.outputs.gross_margin_percent,
      markupPercent: result.outputs.markup_percent,
      gstExclusiveTotal: result.outputs.total_sell,
      gstAmount: null,
      gstInclusiveTotal: null,
      gstRatePercent: null,
    });
  }

  const steps = Object.freeze(
    mapLegacyStepsToStructured(result.steps, { costKnown })
  );

  const blockingErrors = Object.freeze(
    toContractIssues(result.validation_errors, "blocking_error", "validation")
  );
  const baseWarnings = toContractIssues(
    result.warnings,
    "warning",
    "commercial"
  );
  const warnings = Object.freeze(
    enrichWarnings(baseWarnings, result, request.manualOverrides)
  );

  const explanationKeys = Object.freeze([
    ...new Set([
      ...steps.map((s) => s.explanationKey),
      ...(costKnown === false ? [EXPLANATION_KEYS.COST_UNKNOWN] : []),
      ...(request.manualOverrides.length > 0
        ? [EXPLANATION_KEYS.MANUAL_OVERRIDE]
        : []),
    ]),
  ]);

  return deepFreeze({
    requestId: request.requestId,
    calculationId: result.calculation_id,
    engineVersion: result.engine_version,
    formulaVersion: result.formula_version,
    calculationKind: "line_item",
    calculationMode: input.mode,
    currency: request.currency,
    ok: result.ok,
    inputSnapshot: lineInputSnapshot(input),
    commercialSettings: request.commercialSettings,
    explicitModifiers: request.explicitModifiers,
    manualOverrides: request.manualOverrides,
    provenance: request.source,
    outputs,
    steps,
    blockingErrors,
    warnings,
    assumptions: Object.freeze([...(input.assumptions ?? [])]),
    explanationKeys,
    futureLearningHooks: learningHooksFrom(result, request.manualOverrides),
    calculationTimestamp: request.calculationTimestamp ?? null,
    normalizedRequestJson: normalizeRequestFingerprint(request),
  });
}

export function buildRecordFromAggregateResult(
  request: CommercialCalculationRequest,
  result: AggregateResult
): CommercialCalculationRecord {
  const body = request.input as AggregateRequestBody;
  const costKnown = result.cost_known;

  let outputs: CommercialFinancialOutputs | null = null;
  if (result.ok) {
    outputs = deepFreeze({
      costKnown: result.cost_known,
      totalCost: result.subtotal_cost,
      totalSell: result.subtotal_sell,
      grossProfit: result.gross_profit,
      grossMarginPercent: result.gross_margin_percent,
      markupPercent: result.markup_percent,
      gstExclusiveTotal: result.subtotal_sell,
      gstAmount: result.gst_amount,
      gstInclusiveTotal: result.total_incl_gst,
      gstRatePercent: result.gst_rate_percent,
    });
  }

  const steps = Object.freeze(
    mapLegacyStepsToStructured(result.steps, {
      costKnown,
      includeGstTotal: true,
      gstInclusive: result.total_incl_gst,
    })
  );

  const blockingErrors = Object.freeze(
    toContractIssues(result.validation_errors, "blocking_error", "validation")
  );
  const warnings = Object.freeze(
    enrichWarnings(
      toContractIssues(result.warnings, "warning", "commercial"),
      result,
      request.manualOverrides
    )
  );

  return deepFreeze({
    requestId: request.requestId,
    calculationId: result.calculation_id,
    engineVersion: result.engine_version,
    formulaVersion: result.formula_version,
    calculationKind: "document_aggregate",
    calculationMode: "document_aggregate",
    currency: request.currency,
    ok: result.ok,
    inputSnapshot: aggregateInputSnapshot(body),
    commercialSettings: request.commercialSettings,
    explicitModifiers: request.explicitModifiers,
    manualOverrides: request.manualOverrides,
    provenance: request.source,
    outputs,
    steps,
    blockingErrors,
    warnings,
    assumptions: Object.freeze([] as string[]),
    explanationKeys: Object.freeze([
      ...new Set(steps.map((s) => s.explanationKey)),
    ]),
    futureLearningHooks: learningHooksFrom(result, request.manualOverrides),
    calculationTimestamp: request.calculationTimestamp ?? null,
    normalizedRequestJson: normalizeRequestFingerprint(request),
  });
}

/**
 * Quotr Authoritative Commercial Calculation Engine — public API.
 *
 * Batch 2B.3A: standalone kernel only. No React, Supabase, persistence,
 * or server-action imports. Nothing in the application should call this yet.
 */

export {
  ENGINE_VERSION,
  FORMULA_VERSION,
  DEFAULT_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
  MAX_GROSS_MARGIN_PERCENT,
  DEFAULT_GST_RATE_PERCENT,
} from "./versioning";

export type {
  CalculationMode,
  CalculationLineInput,
  CalculationResult,
  CalculationOutputs,
  CalculationStep,
  ValidationIssue,
  ManualOverrideMetadata,
  ExplanationMetadata,
  FutureLearningMetadata,
  AggregateInclusionRule,
  AggregateLineInput,
  AggregateInput,
  AggregateResult,
} from "./core/types";

export { roundMoney, roundPercent, isFiniteNumber } from "./core/money";
export { deriveSellFromCost } from "./core/sell-from-margin";
export { deriveProfitMetrics } from "./core/profit";

export { calculateLineItem } from "./calculations/calculate-line";
export { calculateDocumentAggregate } from "./calculations/aggregate";

export { validateLineInput } from "./validation/validate-line-input";

export type {
  GoldenLineExpectation,
  GoldenCompareReport,
} from "./fixtures/types";
export { compareLineResultToGolden } from "./fixtures/compare";

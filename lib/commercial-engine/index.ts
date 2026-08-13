/**
 * Quotr Authoritative Commercial Calculation Engine — public API.
 *
 * Batch 2B.3C: standalone kernel + canonical contract/replay.
 * Batch 2B.6A: first live callers are pricing item CRUD + document aggregate
 * via `lib/pricing/commercial-engine-adapter.ts` (not parity).
 * No React or Supabase imports inside this package.
 */

export {
  ENGINE_VERSION,
  FORMULA_VERSION,
  DEFAULT_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
  MAX_GROSS_MARGIN_PERCENT,
  DEFAULT_GST_RATE_PERCENT,
  SUPPORTED_ENGINE_VERSIONS,
  SUPPORTED_FORMULA_VERSIONS,
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
export {
  classifyResolvedSell,
  deriveSellFromGrossMargin,
  applyProjectGrossMarginToCost,
  commercialSnapshotKindForPricingDocument,
  commercialSnapshotKindForQuote,
} from "./core/cost-first-authority";
export type {
  SellAuthority,
  EstimateSellAuthority,
  CommercialSnapshotKind,
  ResolvedSellSemantics,
} from "./core/cost-first-authority";

export { calculateLineItem } from "./calculations/calculate-line";
export { calculateDocumentAggregate } from "./calculations/aggregate";

export { validateLineInput } from "./validation/validate-line-input";

export type {
  GoldenLineExpectation,
  GoldenCompareReport,
  GoldenLineScenario,
  GoldenAggregateScenario,
  GoldenValidationScenario,
  ScenarioMapEntry,
} from "./fixtures";
export {
  compareLineResultToGolden,
  compareLineScenario,
  compareAggregateScenario,
  compareValidationScenario,
  CANONICAL_LINE_FIXTURES,
  CANONICAL_AGGREGATE_FIXTURES,
  SCENARIO_EXECUTION_MAP,
} from "./fixtures";

/** Canonical contract / replay (Batch 2B.3C) */
export {
  executeCommercialCalculation,
  verifyCalculationReplay,
  replayCalculation,
  buildLineRequest,
  buildAggregateRequest,
  normalizeRequestFingerprint,
  serializeCanonical,
  parseCanonicalJson,
  roundTripCanonical,
  deepFreeze,
  BLOCKING_ERROR_CODES,
  WARNING_CODES,
  STEP_CODES,
  EXPLANATION_KEYS,
} from "./contract";

export type {
  CommercialCalculationRequest,
  CommercialCalculationRecord,
  CommercialFinancialOutputs,
  CommercialSettingsSnapshot,
  ManualOverrideCapture,
  FutureLearningHook,
  StructuredCalculationStep,
  ReplayVerificationResult,
  ContractIssue,
} from "./contract";

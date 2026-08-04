/**
 * Commercial engine contract layer — Batch 2B.3C public surface.
 */

export {
  BLOCKING_ERROR_CODES,
  WARNING_CODES,
  type BlockingErrorCode,
  type WarningCode,
  type IssueSeverity,
  type ContractIssue,
} from "./codes";

export {
  STEP_CODES,
  EXPLANATION_KEYS,
  LEGACY_STEP_ID_TO_CODE,
  type StepCode,
  type StepOperationType,
  type PrecisionTreatment,
} from "./step-codes";

export type {
  CommercialCurrency,
  CommercialCalculationKind,
  CommercialSettingsSnapshot,
  ExplicitModifier,
  SourceProvenance,
  ManualOverrideCapture,
  FutureLearningHook,
  StructuredCalculationStep,
  CommercialLineInputSnapshot,
  CommercialAggregateInputSnapshot,
  CommercialInputSnapshot,
  CommercialCalculationRequest,
  AggregateRequestBody,
  CommercialFinancialOutputs,
  CommercialCalculationRecord,
  ReplayParityField,
  ReplayVerificationResult,
} from "./types";

export { deepFreeze, assertFrozenMutationBlocked } from "./deep-freeze";
export {
  serializeCanonical,
  parseCanonicalJson,
  roundTripCanonical,
  canonicalizeValue,
  CanonicalSerializationError,
} from "./serialize";
export {
  normalizeLineInput,
  normalizeAggregateBody,
  defaultCommercialSettings,
  buildLineRequest,
  buildAggregateRequest,
  normalizeRequestFingerprint,
  isLineMode,
} from "./normalize";
export { mapLegacyStepsToStructured } from "./map-steps";
export {
  buildRecordFromLineResult,
  buildRecordFromAggregateResult,
} from "./build-record";
export { executeCommercialCalculation } from "./execute";
export {
  verifyCalculationReplay,
  replayCalculation,
  fingerprintRecordOutputs,
} from "./replay";

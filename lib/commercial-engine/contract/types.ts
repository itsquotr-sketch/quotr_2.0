/**
 * Canonical commercial engine request and calculation record contracts.
 * Technology-independent. Batch 2B.3C.
 */

import type {
  AggregateInclusionRule,
  AggregateLineInput,
  CalculationLineInput,
  CalculationMode,
  ManualOverrideMetadata,
} from "../core/types";
import type { ContractIssue } from "./codes";
import type {
  PrecisionTreatment,
  StepCode,
  StepOperationType,
} from "./step-codes";

export type CommercialCurrency = "NZD";

export type CommercialCalculationKind = "line_item" | "document_aggregate";

export type CommercialSettingsSnapshot = {
  readonly default_gross_margin_percent: number | null;
  readonly gst_rate_percent: number | null;
  readonly currency: CommercialCurrency;
};

export type ExplicitModifier = {
  readonly code: string;
  readonly field?: string;
  readonly value: number | string | boolean | null;
};

export type SourceProvenance = {
  readonly source_references: readonly string[];
  readonly actor_ref?: string | null;
  readonly origin?: "manual" | "ai" | "recalc" | "system" | "fixture" | null;
};

export type ManualOverrideCapture = {
  readonly field: string;
  readonly original_value: number | string | boolean | null;
  readonly override_value: number | string | boolean | null;
  readonly reason_category?: string | null;
  readonly source?: ManualOverrideMetadata["source"] | null;
  readonly user_reference?: string | null;
  readonly timestamp?: string | null;
  readonly affected_arithmetic: boolean;
};

export type FutureLearningHook = {
  readonly candidateType: string;
  readonly targetField?: string | null;
  readonly sourceEvidence?: string | null;
  readonly constraintReference?: string | null;
  readonly overrideReference?: string | null;
  readonly eligibleForFutureReview: boolean;
};

export type StructuredCalculationStep = {
  readonly code: StepCode;
  readonly operationType: StepOperationType;
  readonly inputReferences: Readonly<
    Record<string, number | string | boolean | null>
  >;
  readonly values: Readonly<Record<string, number | string | boolean | null>>;
  readonly result: number | string | boolean | null;
  readonly precisionTreatment: PrecisionTreatment;
  readonly explanationKey: string;
  readonly formulaId: string | null;
  /** Legacy kernel step id when mapped from calculateLineItem / aggregate. */
  readonly legacyStepId?: string | null;
};

export type CommercialLineInputSnapshot = {
  readonly kind: "line_item";
  readonly mode: CalculationMode;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly unit_cost: number | null;
  readonly unit_sell: number | null;
  readonly total_cost: number | null;
  readonly total_sell: number | null;
  readonly productivity_rate: number | null;
  readonly productivity_unit: string | null;
  readonly calculated_quantity: number | null;
  readonly target_gross_margin_percent: number | null;
  readonly waste_percent: number | null;
  readonly quantity_waste_adjusted: boolean | null;
  readonly visible: boolean | null;
  readonly included_in_total: boolean | null;
  readonly assumptions: readonly string[];
};

export type CommercialAggregateInputSnapshot = {
  readonly kind: "document_aggregate";
  readonly inclusion_rule: AggregateInclusionRule;
  readonly gst_rate_percent: number | null;
  readonly gst_rate_provided: boolean;
  readonly lines: readonly {
    readonly total_cost: number;
    readonly total_sell: number;
    readonly visible: boolean | null;
    readonly included_in_total: boolean | null;
    readonly cost_known: boolean | null;
  }[];
};

export type CommercialInputSnapshot =
  | CommercialLineInputSnapshot
  | CommercialAggregateInputSnapshot;

/**
 * Canonical request — every arithmetic input must be explicit.
 * Arithmetic must not depend on wall-clock time or random IDs.
 */
export type CommercialCalculationRequest = {
  readonly requestId: string;
  readonly calculationKind: CommercialCalculationKind;
  readonly calculationMode: CalculationMode | "document_aggregate";
  readonly engineVersionRequested: string | null;
  readonly formulaVersionRequested: string | null;
  readonly currency: CommercialCurrency;
  readonly input: CalculationLineInput | AggregateRequestBody;
  readonly commercialSettings: CommercialSettingsSnapshot;
  readonly source: SourceProvenance;
  readonly manualOverrides: readonly ManualOverrideCapture[];
  readonly explicitModifiers: readonly ExplicitModifier[];
  /** Snapshot metadata only — must not affect arithmetic. */
  readonly calculationTimestamp?: string | null;
};

export type AggregateRequestBody = {
  readonly calculation_id?: string;
  readonly lines: readonly AggregateLineInput[];
  readonly inclusion_rule: AggregateInclusionRule;
  readonly gst_rate_percent?: number | null;
};

export type CommercialFinancialOutputs = {
  readonly costKnown: boolean;
  readonly totalCost: number | null;
  readonly totalSell: number | null;
  readonly grossProfit: number | null;
  readonly grossMarginPercent: number | null;
  readonly markupPercent: number | null;
  readonly gstExclusiveTotal: number | null;
  readonly gstAmount: number | null;
  readonly gstInclusiveTotal: number | null;
  readonly gstRatePercent: number | null;
};

/**
 * Canonical calculation record — immutable, serializable, replayable.
 */
export type CommercialCalculationRecord = {
  readonly requestId: string;
  readonly calculationId: string | null;
  readonly engineVersion: string;
  readonly formulaVersion: string;
  readonly calculationKind: CommercialCalculationKind;
  readonly calculationMode: CalculationMode | "document_aggregate";
  readonly currency: CommercialCurrency;
  readonly ok: boolean;
  readonly inputSnapshot: CommercialInputSnapshot;
  readonly commercialSettings: CommercialSettingsSnapshot;
  readonly explicitModifiers: readonly ExplicitModifier[];
  readonly manualOverrides: readonly ManualOverrideCapture[];
  readonly provenance: SourceProvenance;
  readonly outputs: CommercialFinancialOutputs | null;
  readonly steps: readonly StructuredCalculationStep[];
  readonly blockingErrors: readonly ContractIssue[];
  readonly warnings: readonly ContractIssue[];
  readonly assumptions: readonly string[];
  readonly explanationKeys: readonly string[];
  readonly futureLearningHooks: readonly FutureLearningHook[];
  /** Metadata only — not used in arithmetic. */
  readonly calculationTimestamp: string | null;
  readonly normalizedRequestJson: string;
};

export type ReplayParityField = {
  readonly field: string;
  readonly expected: string | number | boolean | null;
  readonly actual: string | number | boolean | null;
};

export type ReplayVerificationResult = {
  readonly ok: boolean;
  readonly status:
    | "exact_match"
    | "mismatch"
    | "unsupported_engine_version"
    | "unsupported_formula_version"
    | "invalid_record";
  readonly differences: readonly ReplayParityField[];
  readonly warnings: readonly ContractIssue[];
  /** True when source record was not mutated by replay. */
  readonly sourceUnchanged: boolean;
};

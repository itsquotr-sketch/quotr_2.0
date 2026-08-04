/**
 * Immutable golden fixture types for Batch 2B.3B.
 * Expected numeric results must come from approved golden documentation —
 * never from the engine under test.
 */

import type {
  AggregateInclusionRule,
  CalculationLineInput,
  CalculationMode,
  ManualOverrideMetadata,
} from "../core/types";

export type ExecutionClassification =
  | "Executable now — line item"
  | "Executable now — aggregate/document"
  | "Documentation-only — future workflow"
  | "Deferred — requires live persistence"
  | "Deferred — requires UI"
  | "Deferred — requires Company DNA"
  | "Deferred — requires pricing-action integration";

export type ScenarioMapEntry = {
  readonly scenarioId: string;
  readonly category: string;
  readonly classification: ExecutionClassification;
  readonly engineCapability: string;
  readonly fixtureFile: string | null;
  readonly expectedResultSource: string;
  readonly deferredDependency: string | null;
  readonly deferralReason: string | null;
  readonly futureBatch: string | null;
};

/** @deprecated Prefer GoldenLineScenario — retained for 2B.3A callers. */
export type GoldenLineExpectation = {
  readonly scenario_id: string;
  readonly mode: CalculationMode;
  readonly expected_cost: number;
  readonly expected_sell: number;
  readonly expected_gross_profit: number | null;
  readonly expected_gross_margin_percent: number | null;
  readonly expected_markup_percent?: number | null;
  readonly tolerance?: number;
};

export type GoldenLineExpected = {
  readonly total_cost: number;
  readonly total_sell: number;
  readonly gross_profit: number | null;
  readonly gross_margin_percent: number | null;
  readonly markup_percent?: number | null;
  readonly cost_known: boolean;
  readonly quantity?: number | null;
  readonly calculated_quantity?: number | null;
  readonly unit_cost?: number | null;
  readonly unit_sell?: number | null;
};

export type GoldenLineScenario = {
  readonly scenarioId: string;
  readonly description: string;
  readonly mode: CalculationMode;
  readonly input: CalculationLineInput;
  readonly expected: GoldenLineExpected;
  readonly expectedWarnings: readonly string[];
  readonly expectedErrors: readonly string[];
  readonly expectedSteps: readonly string[];
  readonly expectedManualOverrideState: ManualOverrideMetadata | null;
  readonly learningHookExpectations: readonly string[];
  readonly precisionTolerance: number;
  readonly expectOk: boolean;
  readonly expectedEngineVersion?: string;
  readonly expectedFormulaVersion?: string;
};

export type GoldenAggregateLine = {
  readonly total_cost: number;
  readonly total_sell: number;
  readonly visible?: boolean;
  readonly included_in_total?: boolean;
  readonly cost_known?: boolean;
  readonly work_area?: string;
};

export type GoldenAggregateScenario = {
  readonly scenarioId: string;
  readonly description: string;
  readonly lines: readonly GoldenAggregateLine[];
  readonly inclusionRule: AggregateInclusionRule;
  readonly gstRate: number | null | undefined;
  readonly expectedSubtotalCost: number;
  readonly expectedSubtotalSell: number;
  readonly expectedGrossProfit: number | null;
  readonly expectedGrossMargin: number | null;
  readonly expectedGST: number | null;
  readonly expectedTotalIncludingGST: number | null;
  readonly expectedWarnings: readonly string[];
  readonly expectedErrors: readonly string[];
  readonly expectedSteps: readonly string[];
  readonly precisionTolerance: number;
  readonly expectOk: boolean;
  readonly expectedCostKnown?: boolean;
};

export type GoldenValidationScenario = {
  readonly scenarioId: string;
  readonly description: string;
  readonly kind: "line" | "aggregate";
  readonly invalidInput: CalculationLineInput | {
    readonly lines: readonly GoldenAggregateLine[];
    readonly inclusion_rule: AggregateInclusionRule;
    readonly gst_rate_percent?: number | null;
  };
  readonly expectedErrorCodes: readonly string[];
  readonly expectedNoResult: true;
  readonly precisionTolerance: number;
};

export type FieldMismatch = {
  readonly field: string;
  readonly expected: string | number | boolean | null;
  readonly actual: string | number | boolean | null;
  readonly delta?: number | null;
};

export type GoldenCompareReport = {
  readonly scenario_id: string;
  readonly pass: boolean;
  readonly differences: readonly FieldMismatch[];
};

/**
 * Core domain types for the commercial calculation engine.
 * Technology-neutral; no framework dependencies.
 */

export type CalculationMode =
  | "quantity_rate"
  | "productivity_labour"
  | "lump_sum";

export type AggregateInclusionRule = "all" | "visible_only";

export type ValidationIssue = {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
};

export type CalculationStep = {
  readonly id: string;
  readonly formula_id: string;
  readonly description: string;
  readonly inputs: Readonly<Record<string, number | string | null | undefined>>;
  readonly output: number | string | null;
};

export type ManualOverrideMetadata = {
  readonly overridden_fields: readonly string[];
  readonly reason?: string;
  readonly actor_ref?: string;
  readonly at?: string;
  readonly previous_values?: Readonly<Record<string, number | null>>;
  readonly source?: "manual" | "ai" | "recalc" | "system";
};

export type ExplanationMetadata = {
  readonly mode: CalculationMode | "document_aggregate";
  readonly formula_ids: readonly string[];
  readonly inputs_used: Readonly<Record<string, number | string | boolean | null>>;
  readonly rates_used: Readonly<Record<string, number | null>>;
  readonly margin_applied: number | null;
  readonly modifiers: readonly Readonly<Record<string, number | string | boolean>>[];
  readonly override: ManualOverrideMetadata | null;
  readonly source_references: readonly string[];
};

/** Structured hooks only — no fabricated AI narrative. */
export type FutureLearningMetadata = {
  readonly signals: readonly string[];
  readonly evidence_hooks: readonly string[];
  readonly auto_update_company_rules: false;
};

export type CalculationLineInput = {
  readonly calculation_id?: string;
  readonly mode: CalculationMode;
  readonly quantity?: number | null;
  readonly unit?: string | null;
  readonly unit_cost?: number | null;
  readonly unit_sell?: number | null;
  readonly total_cost?: number | null;
  readonly total_sell?: number | null;
  readonly productivity_rate?: number | null;
  readonly productivity_unit?: string | null;
  /** Labour hours (productivity mode); if omitted, derived from quantity × productivity_rate. */
  readonly calculated_quantity?: number | null;
  /** When unit_sell / total_sell missing, derive sell from cost using this gross margin %. */
  readonly target_gross_margin_percent?: number | null;
  readonly waste_percent?: number | null;
  /** Quantity is already waste-adjusted when true (preferred). */
  readonly quantity_waste_adjusted?: boolean;
  readonly visible?: boolean;
  readonly included_in_total?: boolean;
  readonly source_references?: readonly string[];
  readonly manual_override?: ManualOverrideMetadata | null;
  readonly assumptions?: readonly string[];
};

export type CalculationOutputs = {
  readonly mode: CalculationMode;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly unit_cost: number | null;
  readonly unit_sell: number | null;
  readonly productivity_rate: number | null;
  readonly productivity_unit: string | null;
  readonly calculated_quantity: number | null;
  readonly total_cost: number;
  readonly total_sell: number;
  readonly gross_profit: number | null;
  readonly gross_margin_percent: number | null;
  readonly markup_percent: number | null;
  /** False when cost unknown (sell-only lump); margin must not be fabricated. */
  readonly cost_known: boolean;
};

export type CalculationResult = {
  readonly ok: boolean;
  readonly engine_version: string;
  readonly formula_version: string;
  readonly calculation_id: string | null;
  readonly inputs: CalculationLineInput;
  readonly outputs: CalculationOutputs | null;
  readonly steps: readonly CalculationStep[];
  readonly warnings: readonly ValidationIssue[];
  readonly validation_errors: readonly ValidationIssue[];
  readonly manual_override: ManualOverrideMetadata | null;
  readonly explanation: ExplanationMetadata;
  readonly future_learning: FutureLearningMetadata;
};

export type AggregateLineInput = {
  readonly total_cost: number;
  readonly total_sell: number;
  readonly visible?: boolean;
  readonly included_in_total?: boolean;
  /** Defaults true. Set false for sell-only lines so aggregate does not fabricate margin. */
  readonly cost_known?: boolean;
};

export type AggregateInput = {
  readonly calculation_id?: string;
  readonly lines: readonly AggregateLineInput[];
  readonly inclusion_rule: AggregateInclusionRule;
  readonly gst_rate_percent?: number | null;
};

export type AggregateResult = {
  readonly ok: boolean;
  readonly engine_version: string;
  readonly formula_version: string;
  readonly calculation_id: string | null;
  readonly inclusion_rule: AggregateInclusionRule;
  readonly subtotal_cost: number;
  readonly subtotal_sell: number;
  readonly gross_profit: number | null;
  readonly gross_margin_percent: number | null;
  readonly markup_percent: number | null;
  readonly cost_known: boolean;
  readonly gst_rate_percent: number | null;
  readonly gst_amount: number | null;
  readonly total_incl_gst: number | null;
  readonly steps: readonly CalculationStep[];
  readonly warnings: readonly ValidationIssue[];
  readonly validation_errors: readonly ValidationIssue[];
  readonly explanation: ExplanationMetadata;
  readonly future_learning: FutureLearningMetadata;
};

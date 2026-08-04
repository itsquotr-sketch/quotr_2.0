import type {
  CalculationMode,
  CalculationLineInput,
  ExplanationMetadata,
  ManualOverrideMetadata,
} from "../core/types";

export function buildLineExplanation(params: {
  mode: CalculationMode;
  formulaIds: readonly string[];
  input: CalculationLineInput;
  marginApplied: number | null;
  ratesUsed: Readonly<Record<string, number | null>>;
  inputsUsed: Readonly<Record<string, number | string | boolean | null>>;
  modifiers?: readonly Readonly<Record<string, number | string | boolean>>[];
}): ExplanationMetadata {
  const override: ManualOverrideMetadata | null = params.input.manual_override ?? null;

  return {
    mode: params.mode,
    formula_ids: [...params.formulaIds],
    inputs_used: params.inputsUsed,
    rates_used: params.ratesUsed,
    margin_applied: params.marginApplied,
    modifiers: params.modifiers ? [...params.modifiers] : [],
    override,
    source_references: params.input.source_references
      ? [...params.input.source_references]
      : [],
  };
}

export function buildLearningMetadata(signals: readonly string[]) {
  return {
    signals: [...signals],
    evidence_hooks: overrideEvidenceHooks(signals),
    auto_update_company_rules: false as const,
  };
}

function overrideEvidenceHooks(signals: readonly string[]): string[] {
  if (signals.some((s) => s.includes("override") || s.includes("manual"))) {
    return ["manual_correction_candidate"];
  }
  return [];
}

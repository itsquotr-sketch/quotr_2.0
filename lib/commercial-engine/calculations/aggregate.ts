import { deriveProfitMetrics } from "../core/profit";
import { isFiniteNumber, roundMoney } from "../core/money";
import type {
  AggregateInput,
  AggregateResult,
  CalculationStep,
  ValidationIssue,
} from "../core/types";
import { ENGINE_VERSION, FORMULA_VERSION } from "../versioning";
import { buildLearningMetadata } from "../explanation/build-explanation";

/**
 * Document / quote aggregation with explicit inclusion rule and optional GST.
 * Pure; not wired to app callers in 2B.3B.
 *
 * Pass `gst_rate_percent` to compute GST from the **document** rate
 * (authoritative — never invent a hardcoded competing rate inside callers).
 * Omit `gst_rate_percent` for cost/sell-only aggregates (e.g. estimate bands).
 */
export function calculateDocumentAggregate(
  input: AggregateInput
): AggregateResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const steps: CalculationStep[] = [];

  if (input.inclusion_rule !== "all" && input.inclusion_rule !== "visible_only") {
    errors.push({
      code: "invalid_inclusion_rule",
      message: "inclusion_rule must be all or visible_only.",
      field: "inclusion_rule",
    });
  }

  const gstProvided = input.gst_rate_percent !== undefined;
  if (
    gstProvided &&
    (input.gst_rate_percent == null ||
      !isFiniteNumber(input.gst_rate_percent) ||
      input.gst_rate_percent < 0 ||
      input.gst_rate_percent > 100)
  ) {
    errors.push({
      code: "invalid_gst_rate",
      message: "gst_rate_percent must be finite and between 0 and 100.",
      field: "gst_rate_percent",
    });
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      engine_version: ENGINE_VERSION,
      formula_version: FORMULA_VERSION,
      calculation_id: input.calculation_id ?? null,
      inclusion_rule: input.inclusion_rule,
      subtotal_cost: 0,
      subtotal_sell: 0,
      gross_profit: null,
      gross_margin_percent: null,
      markup_percent: null,
      cost_known: false,
      gst_rate_percent: null,
      gst_amount: null,
      total_incl_gst: null,
      steps: Object.freeze([]),
      warnings: Object.freeze([]),
      validation_errors: Object.freeze([...errors]),
      explanation: Object.freeze({
        mode: "document_aggregate" as const,
        formula_ids: Object.freeze([] as string[]),
        inputs_used: Object.freeze({ inclusion_rule: input.inclusion_rule }),
        rates_used: Object.freeze({}),
        margin_applied: null,
        modifiers: Object.freeze(
          [] as Readonly<Record<string, number | string | boolean>>[]
        ),
        override: null,
        source_references: Object.freeze([] as string[]),
      }),
      future_learning: buildLearningMetadata(["validation_failed"]),
    });
  }

  const included = input.lines.filter((line) => {
    if (line.included_in_total === false) return false;
    if (input.inclusion_rule === "visible_only") {
      return line.visible !== false;
    }
    return true;
  });

  const subtotal_cost = roundMoney(
    included.reduce((sum, line) => sum + (line.total_cost ?? 0), 0)
  );
  const subtotal_sell = roundMoney(
    included.reduce((sum, line) => sum + (line.total_sell ?? 0), 0)
  );

  const costKnown = included.every((line) => line.cost_known !== false);

  steps.push({
    id: "sum_lines",
    formula_id: "F-AGG",
    description: `Sum line totals with inclusion_rule=${input.inclusion_rule}`,
    inputs: {
      line_count: included.length,
      subtotal_cost,
      subtotal_sell,
    },
    output: subtotal_sell,
  });

  const profit = deriveProfitMetrics(subtotal_cost, subtotal_sell, {
    costKnown,
  });

  let gst_amount: number | null = null;
  let total_incl_gst: number | null = null;
  let gst_rate_percent: number | null = null;

  if (gstProvided) {
    const rate = input.gst_rate_percent as number;
    gst_rate_percent = rate;
    gst_amount = roundMoney(subtotal_sell * (rate / 100));
    total_incl_gst = roundMoney(subtotal_sell + gst_amount);
    steps.push({
      id: "apply_gst",
      formula_id: "F-GST",
      description: "GST on sell subtotal using document GST rate",
      inputs: { subtotal_sell, gst_rate_percent: rate },
      output: gst_amount,
    });
  }

  if (
    input.inclusion_rule === "visible_only" &&
    included.length < input.lines.length
  ) {
    warnings.push({
      code: "visibility_filter_applied",
      message:
        "Aggregate used visible_only; some lines were excluded from totals.",
    });
  }

  return Object.freeze({
    ok: true,
    engine_version: ENGINE_VERSION,
    formula_version: FORMULA_VERSION,
    calculation_id: input.calculation_id ?? null,
    inclusion_rule: input.inclusion_rule,
    subtotal_cost,
    subtotal_sell,
    gross_profit: profit.gross_profit,
    gross_margin_percent: profit.gross_margin_percent,
    markup_percent: profit.markup_percent,
    cost_known: profit.cost_known,
    gst_rate_percent,
    gst_amount,
    total_incl_gst,
    steps: Object.freeze([...steps]),
    warnings: Object.freeze([...warnings]),
    validation_errors: Object.freeze([]),
    explanation: Object.freeze({
      mode: "document_aggregate" as const,
      formula_ids: Object.freeze(
        gstProvided ? ["F-AGG", "F-GP", "F-GST"] : ["F-AGG", "F-GP"]
      ),
      inputs_used: Object.freeze({
        inclusion_rule: input.inclusion_rule,
        line_count: included.length,
      }),
      rates_used: Object.freeze({
        gst_rate_percent,
      }),
      margin_applied: null,
      modifiers: Object.freeze(
        [] as Readonly<Record<string, number | string | boolean>>[]
      ),
      override: null,
      source_references: Object.freeze([] as string[]),
    }),
    future_learning: buildLearningMetadata(["document_aggregate"]),
  });
}

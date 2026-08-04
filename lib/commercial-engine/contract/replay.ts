/**
 * Replay / verify calculation records — Batch 2B.3C.
 *
 * Exact replay when engine + formula versions match the current pack.
 * Unsupported historic versions return a controlled result — never silently
 * rewrite historical commercial values.
 */

import { ENGINE_VERSION, FORMULA_VERSION } from "../versioning";
import { WARNING_CODES, type ContractIssue } from "./codes";
import { executeCommercialCalculation } from "./execute";
import {
  buildAggregateRequest,
  buildLineRequest,
  normalizeRequestFingerprint,
} from "./normalize";
import { serializeCanonical } from "./serialize";
import type {
  AggregateRequestBody,
  CommercialCalculationRecord,
  CommercialCalculationRequest,
  ReplayParityField,
  ReplayVerificationResult,
} from "./types";
import type { CalculationLineInput } from "../core/types";

function near(
  a: number | null | undefined,
  b: number | null | undefined,
  tol = 0.01
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}

function pushDiff(
  diffs: ReplayParityField[],
  field: string,
  expected: string | number | boolean | null,
  actual: string | number | boolean | null
): void {
  if (expected !== actual) {
    diffs.push({ field, expected, actual });
  }
}

function reconstructRequest(
  record: CommercialCalculationRecord
): CommercialCalculationRequest | null {
  if (record.calculationKind === "line_item") {
    const snap = record.inputSnapshot;
    if (snap.kind !== "line_item") return null;
    const input: CalculationLineInput = {
      calculation_id: record.calculationId ?? undefined,
      mode: snap.mode,
      quantity: snap.quantity,
      unit: snap.unit,
      unit_cost: snap.unit_cost,
      unit_sell: snap.unit_sell,
      total_cost: snap.total_cost,
      total_sell: snap.total_sell,
      productivity_rate: snap.productivity_rate,
      productivity_unit: snap.productivity_unit,
      calculated_quantity: snap.calculated_quantity,
      target_gross_margin_percent: snap.target_gross_margin_percent,
      waste_percent: snap.waste_percent,
      quantity_waste_adjusted:
        snap.quantity_waste_adjusted === null
          ? undefined
          : snap.quantity_waste_adjusted,
      visible: snap.visible ?? undefined,
      included_in_total: snap.included_in_total ?? undefined,
      source_references: record.provenance.source_references,
      assumptions: snap.assumptions,
      manual_override:
        record.manualOverrides.length > 0
          ? {
              overridden_fields: record.manualOverrides.map((o) => o.field),
              reason: record.manualOverrides[0]?.reason_category ?? undefined,
              actor_ref: record.manualOverrides[0]?.user_reference ?? undefined,
              at: record.manualOverrides[0]?.timestamp ?? undefined,
              source: record.manualOverrides[0]?.source ?? undefined,
              previous_values: Object.fromEntries(
                record.manualOverrides.map((o) => [
                  o.field,
                  typeof o.original_value === "number" ? o.original_value : null,
                ])
              ),
            }
          : null,
    };
    return buildLineRequest({
      requestId: record.requestId,
      input,
      commercialSettings: record.commercialSettings,
      source: record.provenance,
      manualOverrides: record.manualOverrides,
      explicitModifiers: record.explicitModifiers,
      calculationTimestamp: record.calculationTimestamp,
      engineVersionRequested: record.engineVersion,
      formulaVersionRequested: record.formulaVersion,
    });
  }

  if (record.calculationKind === "document_aggregate") {
    const snap = record.inputSnapshot;
    if (snap.kind !== "document_aggregate") return null;
    const body: AggregateRequestBody = {
      calculation_id: record.calculationId ?? undefined,
      inclusion_rule: snap.inclusion_rule,
      gst_rate_percent: snap.gst_rate_provided
        ? snap.gst_rate_percent
        : undefined,
      lines: snap.lines.map((l) => ({
        total_cost: l.total_cost,
        total_sell: l.total_sell,
        visible: l.visible ?? undefined,
        included_in_total: l.included_in_total ?? undefined,
        cost_known: l.cost_known ?? undefined,
      })),
    };
    return buildAggregateRequest({
      requestId: record.requestId,
      lines: body.lines,
      inclusionRule: body.inclusion_rule,
      gstRatePercent: body.gst_rate_percent,
      commercialSettings: record.commercialSettings,
      source: record.provenance,
      calculationTimestamp: record.calculationTimestamp,
      calculationId: record.calculationId ?? undefined,
    });
  }

  return null;
}

/**
 * Verify that a stored record replays to the same commercial outputs/steps
 * under the current formula version when versions match.
 */
export function verifyCalculationReplay(
  record: CommercialCalculationRecord
): ReplayVerificationResult {
  const sourceFingerprint = serializeCanonical(record);
  const warnings: ContractIssue[] = [];
  const differences: ReplayParityField[] = [];

  if (record.engineVersion !== ENGINE_VERSION) {
    warnings.push({
      code: WARNING_CODES.ENGINE_VERSION_UNSUPPORTED,
      severity: "warning",
      message: `Record engineVersion ${record.engineVersion} ≠ current ${ENGINE_VERSION}. Historic records must not be silently rewritten.`,
      category: "version",
    });
    return {
      ok: false,
      status: "unsupported_engine_version",
      differences: Object.freeze([]),
      warnings: Object.freeze(warnings),
      sourceUnchanged: serializeCanonical(record) === sourceFingerprint,
    };
  }

  if (record.formulaVersion !== FORMULA_VERSION) {
    warnings.push({
      code: WARNING_CODES.FORMULA_VERSION_UNSUPPORTED,
      severity: "warning",
      message: `Record formulaVersion ${record.formulaVersion} ≠ current ${FORMULA_VERSION}.`,
      category: "version",
    });
    warnings.push({
      code: WARNING_CODES.VERSION_MISMATCH_REPLAY,
      severity: "warning",
      message: "Formula version mismatch — exact replay not available.",
      category: "replay",
    });
    return {
      ok: false,
      status: "unsupported_formula_version",
      differences: Object.freeze([]),
      warnings: Object.freeze(warnings),
      sourceUnchanged: serializeCanonical(record) === sourceFingerprint,
    };
  }

  const request = reconstructRequest(record);
  if (!request) {
    return {
      ok: false,
      status: "invalid_record",
      differences: Object.freeze([
        {
          field: "request",
          expected: "reconstructable",
          actual: null,
        },
      ]),
      warnings: Object.freeze(warnings),
      sourceUnchanged: serializeCanonical(record) === sourceFingerprint,
    };
  }

  const replayed = executeCommercialCalculation(request);

  pushDiff(differences, "ok", record.ok, replayed.ok);

  if (record.ok && record.outputs && replayed.outputs) {
    const fields: Array<keyof typeof record.outputs> = [
      "costKnown",
      "totalCost",
      "totalSell",
      "grossProfit",
      "grossMarginPercent",
      "markupPercent",
      "gstExclusiveTotal",
      "gstAmount",
      "gstInclusiveTotal",
      "gstRatePercent",
    ];
    for (const f of fields) {
      const exp = record.outputs[f];
      const act = replayed.outputs[f];
      if (typeof exp === "number" || typeof act === "number") {
        if (!near(exp as number | null, act as number | null)) {
          differences.push({
            field: `outputs.${f}`,
            expected: exp as number | null,
            actual: act as number | null,
          });
        }
      } else if (exp !== act) {
        differences.push({
          field: `outputs.${f}`,
          expected: exp as boolean | null,
          actual: act as boolean | null,
        });
      }
    }
  } else if (record.outputs == null && replayed.outputs != null) {
    differences.push({
      field: "outputs",
      expected: null,
      actual: "present",
    });
  }

  const expectedCodes = record.steps.map((s) => s.code).join(",");
  const actualCodes = replayed.steps.map((s) => s.code).join(",");
  if (expectedCodes !== actualCodes) {
    differences.push({
      field: "step_codes",
      expected: expectedCodes,
      actual: actualCodes,
    });
  }

  // Step numeric results (where both numbers)
  const len = Math.min(record.steps.length, replayed.steps.length);
  for (let i = 0; i < len; i++) {
    const e = record.steps[i];
    const a = replayed.steps[i];
    if (e.code !== a.code) continue;
    if (typeof e.result === "number" || typeof a.result === "number") {
      if (!near(e.result as number | null, a.result as number | null)) {
        differences.push({
          field: `steps[${i}].result`,
          expected: e.result as number | null,
          actual: a.result as number | null,
        });
      }
    }
  }

  const sourceUnchanged = serializeCanonical(record) === sourceFingerprint;

  return {
    ok: differences.length === 0,
    status: differences.length === 0 ? "exact_match" : "mismatch",
    differences: Object.freeze(differences),
    warnings: Object.freeze(warnings),
    sourceUnchanged,
  };
}

/** Alias preferred in some call sites. */
export const replayCalculation = verifyCalculationReplay;

export function fingerprintRecordOutputs(
  record: CommercialCalculationRecord
): string {
  return serializeCanonical({
    ok: record.ok,
    outputs: record.outputs,
    steps: record.steps.map((s) => ({
      code: s.code,
      result: s.result,
    })),
    normalizedRequestJson: record.normalizedRequestJson,
  });
}

export { normalizeRequestFingerprint };

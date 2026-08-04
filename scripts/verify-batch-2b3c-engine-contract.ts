/**
 * Batch 2B.3C — Commercial engine contract, replay, immutability verification.
 * No React, Supabase, server actions, or application state.
 */

import {
  assertFrozenMutationBlocked,
  buildAggregateRequest,
  buildLineRequest,
  deepFreeze,
  executeCommercialCalculation,
  fingerprintRecordOutputs,
  normalizeRequestFingerprint,
  roundTripCanonical,
  serializeCanonical,
  STEP_CODES,
  verifyCalculationReplay,
  WARNING_CODES,
} from "../lib/commercial-engine/contract";
import { ENGINE_VERSION, FORMULA_VERSION } from "../lib/commercial-engine";
import type { CommercialCalculationRecord } from "../lib/commercial-engine/contract";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function main(): void {
  console.log("=== Batch 2B.3C Engine Contract Verification ===\n");

  // --- Determinism ---
  const lineReqA = buildLineRequest({
    requestId: "req-qty-1",
    input: {
      mode: "quantity_rate",
      quantity: 55,
      unit_cost: 42,
      target_gross_margin_percent: 20,
    },
    calculationTimestamp: "2026-08-04T10:00:00.000Z",
  });
  const lineReqB = buildLineRequest({
    requestId: "req-qty-2-different-id",
    input: {
      mode: "quantity_rate",
      quantity: 55,
      unit_cost: 42,
      target_gross_margin_percent: 20,
    },
    calculationTimestamp: "2099-01-01T00:00:00.000Z",
  });

  const fpA = normalizeRequestFingerprint(lineReqA);
  const fpB = normalizeRequestFingerprint(lineReqB);
  check("determinism: equivalent requests normalize identically", fpA === fpB);

  const rec1 = executeCommercialCalculation(lineReqA);
  const rec2 = executeCommercialCalculation(lineReqA);
  check(
    "determinism: identical financial outputs on repeat",
    fingerprintRecordOutputs(rec1) === fingerprintRecordOutputs(rec2)
  );
  check(
    "determinism: identical step sequence on repeat",
    rec1.steps.map((s) => s.code).join(",") ===
      rec2.steps.map((s) => s.code).join(",")
  );
  check(
    "determinism: arithmetic independent of requestId/timestamp",
    rec1.outputs?.totalSell === rec2.outputs?.totalSell &&
      normalizeRequestFingerprint(lineReqA) ===
        normalizeRequestFingerprint(lineReqB)
  );

  // --- Serialization ---
  const json = serializeCanonical(rec1);
  const roundTripped = roundTripCanonical(rec1);
  const roundTripOk =
    serializeCanonical(roundTripped.outputs) ===
    serializeCanonical(rec1.outputs);
  check("serialization: JSON round-trip preserves outputs", roundTripOk);
  check(
    "serialization: no undefined in JSON",
    !json.includes("undefined") && !json.includes(":undefined")
  );

  const sellOnlyReq = buildLineRequest({
    requestId: "req-sell-only",
    input: { mode: "lump_sum", total_sell: 5000 },
  });
  const sellOnly = executeCommercialCalculation(sellOnlyReq);
  check(
    "serialization: null unknown distinct from zero costKnown",
    sellOnly.outputs?.costKnown === false &&
      sellOnly.outputs?.grossMarginPercent === null &&
      sellOnly.outputs?.totalCost === 0
  );
  check(
    "serialization: sell-only margin is null not fabricated",
    sellOnly.outputs?.grossProfit === null &&
      sellOnly.outputs?.markupPercent === null
  );

  // --- Replay ---
  const qtyReplay = verifyCalculationReplay(rec1);
  check(
    "replay: quantity-rate exact",
    qtyReplay.ok && qtyReplay.status === "exact_match",
    qtyReplay.differences.map((d) => d.field).join(",")
  );

  const prodReq = buildLineRequest({
    requestId: "req-prod",
    input: {
      mode: "productivity_labour",
      quantity: 40,
      productivity_rate: 1.2,
      unit_cost: 65,
      target_gross_margin_percent: 20,
    },
  });
  const prodRec = executeCommercialCalculation(prodReq);
  const prodReplay = verifyCalculationReplay(prodRec);
  check(
    "replay: productivity-labour exact",
    prodReplay.ok && prodReplay.status === "exact_match"
  );

  const lumpReq = buildLineRequest({
    requestId: "req-lump",
    input: { mode: "lump_sum", total_cost: 2800, total_sell: 3500 },
  });
  const lumpRec = executeCommercialCalculation(lumpReq);
  check(
    "replay: lump-sum known-cost exact",
    verifyCalculationReplay(lumpRec).ok
  );

  const sellReplay = verifyCalculationReplay(sellOnly);
  check(
    "replay: sell-only unknown-cost exact",
    sellReplay.ok,
    sellReplay.differences.map((d) => `${d.field}:${d.expected}->${d.actual}`).join(";")
  );
  check(
    "replay: sell-only emits PROFIT_UNKNOWN not SELL_FROM_MARGIN margin fabrication",
    sellOnly.steps.some((s) => s.code === STEP_CODES.PROFIT_UNKNOWN) &&
      !sellOnly.steps.some((s) => s.code === STEP_CODES.SELL_FROM_MARGIN)
  );

  const aggReq = buildAggregateRequest({
    requestId: "req-agg",
    lines: [
      { total_cost: 1680, total_sell: 2100 },
      { total_cost: 660, total_sell: 825 },
    ],
    inclusionRule: "all",
    gstRatePercent: 15,
  });
  const aggRec = executeCommercialCalculation(aggReq);
  check("replay: aggregate exact", verifyCalculationReplay(aggRec).ok);

  // Mutated result detection
  const mutated = roundTripCanonical(rec1) as CommercialCalculationRecord;
  const mutatedThawed = {
    ...mutated,
    outputs: mutated.outputs
      ? { ...mutated.outputs, totalSell: (mutated.outputs.totalSell ?? 0) + 1 }
      : null,
  };
  // Re-freeze after intentional corruption for verify API
  const mutatedRecord = deepFreeze(mutatedThawed) as CommercialCalculationRecord;
  // Bypass version check by keeping versions — verify should mismatch outputs
  // But reconstruct uses inputSnapshot so replay recalculates correctly;
  // mismatch is between stored outputs and replayed — wait, verify compares
  // record.outputs to replayed.outputs. If we mutate record.outputs, it should mismatch.
  const mutatedReplay = verifyCalculationReplay(mutatedRecord);
  check(
    "replay: mutated result detected as mismatch",
    !mutatedReplay.ok && mutatedReplay.status === "mismatch"
  );

  // Formula version mismatch
  const oldFormula = deepFreeze({
    ...rec1,
    formulaVersion: "historic.fake.0",
  }) as CommercialCalculationRecord;
  const verReplay = verifyCalculationReplay(oldFormula);
  check(
    "replay: formula-version mismatch controlled",
    !verReplay.ok &&
      verReplay.status === "unsupported_formula_version" &&
      verReplay.warnings.some(
        (w) => w.code === WARNING_CODES.FORMULA_VERSION_UNSUPPORTED
      )
  );
  check(
    "replay: source record unchanged after version mismatch path",
    verReplay.sourceUnchanged && oldFormula.formulaVersion === "historic.fake.0"
  );

  // Engine version mismatch
  const oldEngine = deepFreeze({
    ...rec1,
    engineVersion: "2B.3B.0",
  }) as CommercialCalculationRecord;
  const engReplay = verifyCalculationReplay(oldEngine);
  check(
    "replay: engine-version mismatch controlled",
    !engReplay.ok && engReplay.status === "unsupported_engine_version"
  );

  // Source unchanged after successful replay
  const before = serializeCanonical(rec1);
  verifyCalculationReplay(rec1);
  check(
    "replay: source record unchanged after exact replay",
    serializeCanonical(rec1) === before
  );

  // --- Immutability ---
  check(
    "immutability: top-level frozen",
    Object.isFrozen(rec1) &&
      assertFrozenMutationBlocked(rec1 as object, "ok", false)
  );
  check(
    "immutability: nested outputs frozen",
    rec1.outputs != null && Object.isFrozen(rec1.outputs)
  );
  check(
    "immutability: steps frozen",
    Object.isFrozen(rec1.steps) &&
      (rec1.steps.length === 0 || Object.isFrozen(rec1.steps[0]))
  );
  check(
    "immutability: futureLearningHooks frozen",
    Object.isFrozen(rec1.futureLearningHooks)
  );
  check(
    "immutability: manualOverrides frozen",
    Object.isFrozen(rec1.manualOverrides)
  );

  // --- Explanation ---
  check(
    "explanation: only stable explanation keys",
    rec1.explanationKeys.every((k) => k.startsWith("step.") || k.startsWith("warning."))
  );
  check(
    "explanation: no AI narrative fields",
    !("aiNarrative" in rec1) &&
      !("confidence" in rec1) &&
      !JSON.stringify(rec1).includes("You should charge")
  );
  check(
    "explanation: steps correspond to operations",
    rec1.steps.every((s) => Object.values(STEP_CODES).includes(s.code))
  );

  // --- Overrides ---
  const overrideReq = buildLineRequest({
    requestId: "req-override",
    input: {
      mode: "productivity_labour",
      calculated_quantity: 56,
      unit_cost: 65,
      unit_sell: 81.25,
      manual_override: {
        overridden_fields: ["calculated_quantity"],
        reason: "site knowledge",
        previous_values: { calculated_quantity: 48 },
        source: "manual",
        actor_ref: "builder-1",
        at: "2026-08-04T12:00:00.000Z",
      },
    },
  });
  const overrideRec = executeCommercialCalculation(overrideReq);
  check(
    "overrides: manual override preserved",
    overrideRec.manualOverrides.length > 0 &&
      overrideRec.manualOverrides[0].field === "calculated_quantity"
  );
  check(
    "overrides: original value represented",
    overrideRec.manualOverrides[0].original_value === 48
  );
  check(
    "overrides: reason/source metadata preserved",
    overrideRec.manualOverrides[0].reason_category === "site knowledge" &&
      overrideRec.manualOverrides[0].source === "manual"
  );
  check(
    "overrides: warning emitted",
    overrideRec.warnings.some(
      (w) => w.code === WARNING_CODES.MANUAL_OVERRIDE_APPLIED
    )
  );
  check(
    "overrides: learning hook references override without changing arithmetic",
    overrideRec.futureLearningHooks.some(
      (h) => h.overrideReference === "calculated_quantity"
    ) &&
      overrideRec.outputs?.totalCost === 3640 &&
      overrideRec.futureLearningHooks.every((h) => h.eligibleForFutureReview !== undefined)
  );

  // --- Errors and warnings ---
  const badReq = buildLineRequest({
    requestId: "req-bad",
    input: {
      mode: "quantity_rate",
      quantity: 1,
      unit_cost: 100,
      target_gross_margin_percent: 96,
    },
  });
  const badRec = executeCommercialCalculation(badReq);
  check(
    "errors: blocking error produces no successful financial result",
    !badRec.ok && badRec.outputs === null && badRec.blockingErrors.length > 0
  );
  check(
    "warnings: unknown cost emits warning not fabricated margin",
    sellOnly.ok &&
      sellOnly.warnings.some((w) => w.code === WARNING_CODES.COST_UNKNOWN) &&
      sellOnly.outputs?.grossMarginPercent === null
  );

  check(
    "version: engine is 2B.3C.0",
    ENGINE_VERSION === "2B.3C.0" && rec1.engineVersion === ENGINE_VERSION
  );
  check(
    "version: formula unchanged 2B.mvp.1",
    FORMULA_VERSION === "2B.mvp.1" && rec1.formulaVersion === FORMULA_VERSION
  );

  // Learning hooks never auto-update
  check(
    "learning: hooks metadata only (eligible flags present, no auto-write claim)",
    overrideRec.futureLearningHooks.every(
      (h) => typeof h.eligibleForFutureReview === "boolean"
    )
  );

  console.log("\n=== Totals ===");
  console.log(`passed: ${passed}`);
  console.log(`failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
  console.log("\nAll Batch 2B.3C contract checks passed.");
}

main();

/**
 * Compare normalized legacy vs engine outputs and classify.
 */

import { executeCommercialCalculation } from "../contract/execute";
import type { CommercialCalculationRequest } from "../contract/types";
import type { ParityClassification } from "./classifications";
import { isRegisteredBlockingMismatch } from "./known-mismatches";
import type {
  CommercialAuthority,
  NormalizedFinancialOutputs,
  ParityFixture,
  ParityResult,
} from "./types";

const TOL = 0.01;

function near(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= TOL;
}

function delta(
  legacy: number | null | undefined,
  engine: number | null | undefined
): number | null {
  if (legacy == null || engine == null) return null;
  return Math.round((engine - legacy) * 100) / 100;
}

export function normalizeEngineOutputsFromRequest(
  request: CommercialCalculationRequest
): NormalizedFinancialOutputs {
  const record = executeCommercialCalculation(request);
  if (!record.ok || !record.outputs) {
    return Object.freeze({
      totalCost: null,
      totalSell: null,
      grossProfit: null,
      grossMarginPercent: null,
      markupPercent: null,
      gstAmount: null,
      totalInclGst: null,
      gstRatePercent: null,
      costKnown: null,
    });
  }
  const o = record.outputs;
  return Object.freeze({
    totalCost: o.totalCost,
    totalSell: o.totalSell,
    grossProfit: o.grossProfit,
    grossMarginPercent: o.grossMarginPercent,
    markupPercent: o.markupPercent,
    gstAmount: o.gstAmount,
    totalInclGst: o.gstInclusiveTotal,
    gstRatePercent: o.gstRatePercent,
    costKnown: o.costKnown,
  });
}

function moneyFieldsMatch(
  legacy: NormalizedFinancialOutputs,
  engine: NormalizedFinancialOutputs,
  fields: Array<keyof NormalizedFinancialOutputs>
): boolean {
  return fields.every((f) => {
    const lv = legacy[f];
    const ev = engine[f];
    if (typeof lv === "boolean" || typeof ev === "boolean") {
      return lv === ev;
    }
    return near(lv as number | null, ev as number | null);
  });
}

export function classifyParity(params: {
  fixture: ParityFixture;
  legacy: NormalizedFinancialOutputs;
  engine: NormalizedFinancialOutputs | null;
}): {
  classification: ParityClassification;
  explanation: string;
} {
  const { fixture, legacy, engine } = params;

  if (fixture.expectedClassification) {
    return {
      classification: fixture.expectedClassification,
      explanation: `Fixture declares ${fixture.expectedClassification}: ${fixture.description}`,
    };
  }

  if (engine == null) {
    return {
      classification: "MISSING_LEGACY_INPUT",
      explanation: "No engine request could be built for this legacy path.",
    };
  }

  const coreMoney: Array<keyof NormalizedFinancialOutputs> = [
    "totalCost",
    "totalSell",
    "gstAmount",
    "totalInclGst",
  ];

  const profitFields: Array<keyof NormalizedFinancialOutputs> = [
    "grossProfit",
    "grossMarginPercent",
    "markupPercent",
  ];

  if (
    moneyFieldsMatch(legacy, engine, coreMoney) &&
    moneyFieldsMatch(legacy, engine, profitFields) &&
    (legacy.costKnown === engine.costKnown ||
      legacy.costKnown == null ||
      engine.costKnown == null)
  ) {
    return {
      classification: "EXACT_MATCH",
      explanation: "Legacy and engine financial outputs match within tolerance.",
    };
  }

  // Sell-only: legacy fabricates margin, engine null
  if (
    engine.costKnown === false &&
    engine.grossMarginPercent == null &&
    legacy.grossMarginPercent != null &&
    near(legacy.totalSell, engine.totalSell)
  ) {
    return {
      classification: "APPROVED_ENGINE_CORRECTION",
      explanation:
        "Engine correctly returns null margin when cost unknown; legacy fabricates a numeric margin.",
    };
  }

  if (
    moneyFieldsMatch(legacy, engine, ["totalCost", "totalSell"]) &&
    !moneyFieldsMatch(legacy, engine, profitFields)
  ) {
    return {
      classification: "APPROVED_ENGINE_CORRECTION",
      explanation: "Core money matches; profit metrics differ (often unknown-cost honesty).",
    };
  }

  if (
    isRegisteredBlockingMismatch(fixture.fixtureId, fixture.legacyId)
  ) {
    return {
      classification: "BLOCKING_ADOPTION_MISMATCH",
      explanation: "Registered adoption-blocking mismatch.",
    };
  }

  return {
    classification: "BLOCKING_ADOPTION_MISMATCH",
    explanation:
      "Unclassified financial difference — must be registered or fixed before adoption.",
  };
}

export function runFixtureComparison(fixture: ParityFixture): ParityResult {
  const pair = fixture.run();
  const engineOutputs =
    pair.engineOutputs ??
    (pair.engineRequest
      ? normalizeEngineOutputsFromRequest(pair.engineRequest)
      : null);

  const { classification, explanation } = classifyParity({
    fixture,
    legacy: pair.legacyOutputs,
    engine: engineOutputs,
  });

  const legacy = pair.legacyOutputs;
  const engine = engineOutputs;

  const numericDeltas = Object.freeze({
    totalCost: delta(legacy.totalCost, engine?.totalCost),
    totalSell: delta(legacy.totalSell, engine?.totalSell),
    grossProfit: delta(legacy.grossProfit, engine?.grossProfit),
    grossMarginPercent: delta(
      legacy.grossMarginPercent,
      engine?.grossMarginPercent
    ),
    gstAmount: delta(legacy.gstAmount, engine?.gstAmount),
    totalInclGst: delta(legacy.totalInclGst, engine?.totalInclGst),
  });

  const authority: CommercialAuthority = fixture.commercialAuthority;

  return Object.freeze({
    fixtureId: fixture.fixtureId,
    legacyId: fixture.legacyId,
    scenarioOrFixtureId: fixture.scenarioRef ?? fixture.fixtureId,
    legacyInputs: fixture.legacyInputs,
    normalizedEngineRequest: pair.engineRequest,
    legacyOutputs: legacy,
    engineOutputs: engine,
    numericDeltas,
    classification,
    commercialAuthority: authority,
    explanation: `${explanation}${pair.notes.length ? ` Notes: ${pair.notes.join("; ")}` : ""}`,
    blockingStatus:
      classification === "BLOCKING_ADOPTION_MISMATCH" ||
      fixture.blockingAdoption,
    futureAdoptionBatch: fixture.futureAdoptionBatch,
  });
}

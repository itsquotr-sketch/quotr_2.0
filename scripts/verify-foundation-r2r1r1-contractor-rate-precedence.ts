/**
 * FOUNDATION-R2-R1-R1 — Contractor material rate precedence + unit reconciliation.
 *
 * Run: npx tsx scripts/verify-foundation-r2r1r1-contractor-rate-precedence.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateDeckingBoardLm } from "../lib/estimate/material-buildups";
import {
  convertM2CostToLmCost,
  formatM2ToLmConversionNote,
} from "../lib/estimate/deck-material-pricing";
import {
  getDeckBoardLmMaterialKey,
  getDeckBoardM2MaterialKey,
  MATERIAL_RATE_KEYS,
} from "../lib/estimate/material-rate-keys";
import { DECK_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { materialRateUnitsMatch } from "../lib/estimate/resolve-material-rate";
import { MATERIAL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import { DECKING_SPECIFIC_MATERIAL_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
};

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: orgSettings,
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as unknown as EstimateContext;

const ownerArea = 16.12;
const ownerWidthMm = 140;
const ownerWaste = 10;
const physical = calculateDeckingBoardLm({
  areaM2: ownerArea,
  boardWidthMm: ownerWidthMm,
  wastagePercent: ownerWaste,
});

function hardwoodFacts(workAreaId: string, includeWidth = true): EstimateFact[] {
  const rows: EstimateFact[] = [
    fact("deck.area_m2", workAreaId, ownerArea),
    fact("deck.board_material", workAreaId, "Hardwood"),
    fact("deck.height_m", workAreaId, 0.4),
  ];
  if (includeWidth) {
    rows.push(fact("deck.board_width_mm", workAreaId, ownerWidthMm));
  }
  return rows;
}

function deckingLine(result: ReturnType<typeof calculateDeck>) {
  return result.lineItems.find((item) =>
    item.label.startsWith("Decking materials")
  );
}

check(
  "physical takeoff remains 126.65 lm (estimate-level, not fabrication)",
  physical != null &&
    physical.baseLm === 115.14 &&
    physical.wastageLm === 11.51 &&
    physical.totalLm === 126.65
);

check(
  "conversion formula $160/m² × 0.14 m = $22.40/lm",
  convertM2CostToLmCost(160, 140) === 22.4
);
check(
  "do not silently reinterpret $23/m² as $23/lm",
  convertM2CostToLmCost(23, 140) === 3.22
);

const wasteOnceCost = Math.round(126.65 * 22.4 * 100) / 100;
const naiveAreaNoWaste = Math.round(ownerArea * 160 * 100) / 100;
const naiveAreaAndWaste = Math.round(ownerArea * 1.1 * 160 * 100) / 100;
check(
  "waste once: purchase lm × converted $/lm ≠ net area × $/m²",
  wasteOnceCost === 2836.96 && naiveAreaNoWaste === 2579.2
);
check(
  "waste once: conversion does not apply a second waste multiplier on area",
  Math.abs(wasteOnceCost - naiveAreaAndWaste) < 0.2
);

// CASE A — company exact lm wins over company m² and Quotr lm
const caseA = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
        rate_type: "material",
        unit: "lm",
        cost_rate: 18.5,
        sell_rate: null,
        active: true,
      },
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodM2,
        rate_type: "material",
        unit: "m2",
        cost_rate: 160,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const lineA = deckingLine(caseA);
check(
  "CASE A: company exact $/lm wins",
  lineA?.costRate === 18.5 &&
    lineA.quantity === 126.65 &&
    lineA.unit === "lm" &&
    lineA.itemKey === MATERIAL_RATE_KEYS.deckingHardwoodLm
);
check(
  "CASE A/F: both lm and m² exist → one priced path only",
  caseA.lineItems.filter((item) =>
    item.label.toLowerCase().includes("decking")
  ).length === 1 && lineA?.materialRateResolution?.conversionNote == null
);
check(
  "CASE A: cost-first company lm sell derived from 20% GM",
  lineA?.sellDerivedFromMargin === true &&
    lineA.sellRate === 23.13 &&
    Math.abs((lineA.recommendedCost ?? 0) - 2343.03) < 0.02
);

// CASE B — no company lm; matching company m² converts
const caseB = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodM2,
        rate_type: "material",
        unit: "m2",
        cost_rate: 160,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const lineB = deckingLine(caseB);
check(
  "CASE B: company matching m² converts and outranks Quotr $/lm",
  lineB?.costRate === 22.4 &&
    lineB.quantity === 126.65 &&
    lineB.unit === "lm" &&
    lineB.itemKey === MATERIAL_RATE_KEYS.deckingHardwoodM2
);
check(
  "CASE B: conversion provenance is contractor-facing",
  lineB?.materialRateResolution?.display === "Your company rate" &&
    lineB.materialRateResolution.conversionNote ===
      formatM2ToLmConversionNote(160, 140)
);
check(
  "CASE B: waste applied once via purchase lm",
  lineB != null && Math.abs((lineB.recommendedCost ?? 0) - 2836.96) < 0.02
);
check(
  "CASE B: cost-first sell from converted cost, not stacked margin",
  lineB?.sellDerivedFromMargin === true &&
    lineB.sellRate === 28 &&
    Math.abs((lineB.recommendedSell ?? 0) - 3546.2) < 0.02
);

// Unrelated generic/other-material company m² must not override specific Quotr lm
const pineOnHardwood = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingTreatedPineM2,
        rate_type: "material",
        unit: "m2",
        cost_rate: 23,
        sell_rate: 25,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const pineLine = deckingLine(pineOnHardwood);
check(
  "unrelated treated-pine m² does not convert onto hardwood",
  pineLine?.itemKey === MATERIAL_RATE_KEYS.deckingHardwoodLm &&
    pineLine.costRate === DECK_BENCHMARKS.hardwoodLm.cost
);

// Kwila uses hardwood m² alias — conversion allowed for that documented identity
const kwilaM2 = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "k1", ownerArea),
      fact("deck.board_material", "k1", "Kwila"),
      fact("deck.board_width_mm", "k1", ownerWidthMm),
      fact("deck.height_m", "k1", 0.4),
    ],
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodM2,
        rate_type: "material",
        unit: "m2",
        cost_rate: 160,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("k1", "deck", "Deck")
);
const kwilaLine = deckingLine(kwilaM2);
check(
  "kwila matching m² alias converts (deck.material.hardwood.m2)",
  getDeckBoardM2MaterialKey("Kwila") === MATERIAL_RATE_KEYS.deckingHardwoodM2 &&
    kwilaLine?.costRate === 22.4 &&
    kwilaLine.itemKey === MATERIAL_RATE_KEYS.deckingHardwoodM2
);
check(
  "kwila still has its own $/lm key",
  getDeckBoardLmMaterialKey("Kwila") === MATERIAL_RATE_KEYS.deckingKwilaLm
);

// CASE C — no company rate → Quotr lm
const caseC = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
  } as EstimateContext,
  wa("d1", "deck", "Deck")
);
const lineC = deckingLine(caseC);
check(
  "CASE C: Quotr exact $/lm when no company rate",
  lineC?.costRate === DECK_BENCHMARKS.hardwoodLm.cost &&
    lineC.quantity === 126.65 &&
    lineC.unit === "lm" &&
    lineC.itemKey === MATERIAL_RATE_KEYS.deckingHardwoodLm
);
check(
  "CASE C: provenance is Quotr benchmark, not internal keys",
  lineC?.materialRateResolution?.display === "Quotr benchmark"
);
check(
  "CASE C: commercial math 126.65 × $22 = $2,786.30",
  lineC != null &&
    Math.abs((lineC.recommendedCost ?? 0) - 2786.3) < 0.02 &&
    Math.abs((lineC.recommendedSell ?? 0) - 4306.1) < 0.02
);
check(
  "CASE C: legacy paired benchmark sell is not stacked with project GM",
  lineC?.sellDerivedFromMargin === false &&
    lineC.sellRate === DECK_BENCHMARKS.hardwoodLm.sell
);

// CASE D — board width unknown → no fake lm
const caseD = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d2", false),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodM2,
        rate_type: "material",
        unit: "m2",
        cost_rate: 160,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d2", "deck", "Deck")
);
const lineD = deckingLine(caseD);
check(
  "CASE D: unknown width uses honest m² package, no fake lm",
  lineD?.label === "Decking materials package" &&
    lineD.unit === "m²" &&
    lineD.quantity === ownerArea &&
    lineD.costRate === 160 &&
    lineD.materialBuildUp == null &&
    lineD.materialRateResolution?.conversionNote == null
);

const caseDEmpty = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d2", false),
  } as EstimateContext,
  wa("d2", "deck", "Deck")
);
const lineDEmpty = deckingLine(caseDEmpty);
check(
  "CASE D: unknown width + no company rate → Quotr m² package",
  lineDEmpty?.unit === "m²" &&
    lineDEmpty.quantity === ownerArea &&
    lineDEmpty.costRate === DECK_BENCHMARKS.hardwoodDecking.cost
);

// CASE E — benchmarks disabled, no company rate
const caseE = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    organisationSettings: {
      allow_benchmark_rates: false,
      default_margin_percent: 20,
    },
  } as never,
  wa("d1", "deck", "Deck")
);
const lineE = deckingLine(caseE);
check(
  "CASE E: benchmarks off and no company rate → pricing required package",
  lineE?.label === "Decking materials package" &&
    lineE.unit === "m²" &&
    lineE.costRate === 0 &&
    lineE.materialRateResolution?.display === "Pricing required"
);

// CASE F already covered with A; also no double-count vs package
check(
  "units match on converted path",
  lineB != null && materialRateUnitsMatch(lineB.unit ?? "", "lm")
);

const m2Labels = MATERIAL_RATE_CATALOGUE.filter((entry) =>
  [
    MATERIAL_RATE_KEYS.deckingHardwoodM2,
    MATERIAL_RATE_KEYS.deckingTreatedPineM2,
    MATERIAL_RATE_KEYS.deckingCompositeM2,
  ].includes(entry.item_key as typeof MATERIAL_RATE_KEYS.deckingHardwoodM2)
);
check(
  "Rates UI m² labels are deck-area fallbacks, not $/lm",
  m2Labels.length === 3 &&
    m2Labels.every(
      (entry) =>
        entry.label.includes("per m² of deck area") &&
        (entry.description ?? "").toLowerCase().includes("not") &&
        (entry.description ?? "").toLowerCase().includes("$/lm")
    )
);
check(
  "Rates UI lm labels are cost per linear metre",
  DECKING_SPECIFIC_MATERIAL_CATALOGUE.every((entry) =>
    (entry.description ?? "").toLowerCase().includes("linear metre")
  )
);

const deckSource = readFileSync("lib/estimate/calculators/deck.ts", "utf8");
const pricingSource = readFileSync(
  "lib/estimate/deck-material-pricing.ts",
  "utf8"
);
check(
  "requirement emission is Deck surface + labour shadow",
  deckSource.includes("maybeBuildDeckSurfaceRequirement") &&
    deckSource.includes("buildDeckLabourRequirement") &&
    !pricingSource.includes("MaterialRequirement")
);
check(
  "no Project Conditions regression",
  deckSource.includes("resolveLegacyWorkAreaAccess")
);

const migrations = existsSync("supabase/migrations")
  ? readdirSync("supabase/migrations")
  : [];
check(
  "no new migration",
  !migrations.some(
    (name) =>
      name.includes("r2r1r1") ||
      name.includes("material_requirement") ||
      name.includes("contractor_rate")
  )
);

const outdoorDeck = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "d1", 70),
      fact("deck.board_material", "d1", "Hardwood"),
      fact("deck.board_width_mm", "d1", 140),
      fact("deck.height_m", "d1", 0.8),
      fact("deck.existing_deck_removal", "d1", true),
      fact("deck.access_type", "d1", "Stair set"),
      fact("deck.balustrade_required", "d1", true),
    ],
  } as EstimateContext,
  wa("d1", "deck", "Deck 1")
);
const outdoorDecking = deckingLine(outdoorDeck);
check(
  "outdoor Deck 1 still prices 550 lm × Quotr $/lm when no company rate",
  outdoorDecking?.quantity === 550 &&
    outdoorDecking.costRate === DECK_BENCHMARKS.hardwoodLm.cost
);

const fullEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck")],
  facts: hardwoodFacts("d1"),
} as EstimateContext);
check(
  "estimate engine still produces a positive total",
  fullEstimate.recommendedSell > 0
);

console.log("");
console.log(`FOUNDATION-R2-R1-R1: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

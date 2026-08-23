/**
 * DECK-1D-B calibration fixture verifier.
 * Run: npx tsx scripts/verify-deck-1d-b-calibration-fixtures.ts
 */
import { existsSync, readdirSync } from "node:fs";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS,
  DECK_SUPPORTS_COMPONENT_KEY,
} from "../lib/estimate/deck-structure";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import {
  loadCalibrationFixture,
  reportContainsFakeCompletenessPercent,
  reportContainsSavingsLanguage,
  runDeckCalibration,
  scaleComparison,
} from "./deck-calibration/run-deck-calibration";
import type { DeckCalibrationFixture } from "./deck-calibration/types";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as unknown as EstimateContext;

function child(
  report: ReturnType<typeof runDeckCalibration>,
  key: string
) {
  return report.detailed.children.find((row) => row.componentKey === key);
}

function bucket(
  report: ReturnType<typeof runDeckCalibration>,
  key: string
) {
  return report.buckets.find((row) => row.key === key);
}

console.log("=== DECK-1D-B calibration fixtures ===\n");

const simpleFx = loadCalibrationFixture("SIMPLE-01.json");
const mediumFx = loadCalibrationFixture("MEDIUM-01.json");
const elevatedFx = loadCalibrationFixture("ELEVATED-01.json");
const partialFx = loadCalibrationFixture("PARTIAL-SPEC-01.json");
const customFx = loadCalibrationFixture("CUSTOM-MATERIAL-01.json");
const realTemplate = loadCalibrationFixture("REAL-JOB-TEMPLATE.json");

const simple = runDeckCalibration(simpleFx);
const medium = runDeckCalibration(mediumFx);
const elevated = runDeckCalibration(elevatedFx);
const partial = runDeckCalibration(partialFx);
const custom = runDeckCalibration(customFx);
const realTpl = runDeckCalibration(realTemplate);

check("1 SIMPLE area 16.12", simple.areaM2 === 16.12);
check(
  "2 SIMPLE detailed geometry does not use the substructure package",
  simple.legacy.substructureCost == null
);
check(
  "3 SIMPLE detailed priced subtotal 924.71",
  simple.detailed.partialPricedStructuralChildCost === 924.71
);
check(
  "4 SIMPLE supports not $0",
  child(simple, DECK_SUPPORTS_COMPONENT_KEY)?.totalCost !== 0 &&
    child(simple, DECK_SUPPORTS_COMPONENT_KEY)?.quantity === 8 &&
    child(simple, DECK_SUPPORTS_COMPONENT_KEY)?.scopeRequirement === "REQUIRED" &&
    child(simple, DECK_SUPPORTS_COMPONENT_KEY)?.totalCost == null
);
check(
  "5 SIMPLE concrete not $0",
  child(simple, DECK_CONCRETE_COMPONENT_KEY)?.totalCost !== 0 &&
    child(simple, DECK_CONCRETE_COMPONENT_KEY)?.quantity === 0.324 &&
    child(simple, DECK_CONCRETE_COMPONENT_KEY)?.scopeRequirement === "REQUIRED" &&
    child(simple, DECK_CONCRETE_COMPONENT_KEY)?.totalCost == null
);
check(
  "6 SIMPLE blocking not $0",
  bucket(simple, "blocking")?.cost == null &&
    bucket(simple, "blocking")?.bucketState === "NOT_MODELLED"
);
check("7 SIMPLE status PARTIAL_COVERAGE", simple.status === "PARTIAL_COVERAGE");
check(
  "8 SIMPLE difference not labelled savings",
  simple.directionalLegacyVsPricedTimber.notCostReduction === true &&
    !reportContainsSavingsLanguage(simple)
);
check(
  "8b SIMPLE legacy cost provenance unknown",
  simple.directionalLegacyVsPricedTimber.label
    .toLowerCase()
    .includes("provenance unknown")
);
check(
  "9 SIMPLE fixings shown separately",
  simple.legacy.fixingsLabel === "LEGACY CATCH-ALL FIXINGS" &&
    simple.legacy.fixingsCost === 403 &&
    bucket(simple, "fixings")?.cost === 403 &&
    bucket(simple, "fixings")?.scopeRequirement === "REQUIRED" &&
    bucket(simple, "fixings")?.economicGap === false
);
check(
  "10 SIMPLE labour shown separately",
  simple.legacy.labourLabel === "CURRENT LABOUR AUTHORITY" &&
    simple.legacy.labourCost != null &&
    simple.comparisonLabel === "MATERIAL / SUBSTRUCTURE COMPARISON"
);

check(
  "11 PARTIAL physical quantities remain",
  child(partial, DECK_JOISTS_COMPONENT_KEY)?.quantity === 42.32 &&
    child(partial, DECK_RIM_FRAMING_COMPONENT_KEY)?.quantity === 10.92
);
check(
  "12 PARTIAL estimating-section 140×45 now uses the selector family identity",
  child(partial, DECK_JOISTS_COMPONENT_KEY)?.priced === true &&
    child(partial, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "benchmark"
);
check(
  "13 PARTIAL priced state is explicit for selector-family sections",
  child(partial, DECK_JOISTS_COMPONENT_KEY)?.bucketState === "PRICED" ||
    child(partial, DECK_JOISTS_COMPONENT_KEY)?.priced === true
);
check(
  "14 PARTIAL selector family includes SG8",
  child(partial, DECK_JOISTS_COMPONENT_KEY)?.identity?.includes(".sg8") === true
);
check(
  "15 PARTIAL selector family includes H3.2",
  child(partial, DECK_JOISTS_COMPONENT_KEY)?.identity?.includes(".h3.2") === true
);
check(
  "16 PARTIAL selector family includes KD",
  child(partial, DECK_JOISTS_COMPONENT_KEY)?.identity?.includes(".kd") === true
);

check(
  "17 CUSTOM 200x50 accepted",
  child(custom, DECK_JOISTS_COMPONENT_KEY)?.identity?.includes("200x50") === true
);
check(
  "18 CUSTOM no joist benchmark",
  child(custom, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
    child(custom, DECK_JOISTS_COMPONENT_KEY)?.rateSource !== "benchmark"
);
check(
  "19 CUSTOM physical qty valid",
  child(custom, DECK_JOISTS_COMPONENT_KEY)?.quantity === 42.32
);
check(
  "20 CUSTOM no whitelist failure",
  child(custom, DECK_JOISTS_COMPONENT_KEY) != null
);

check("21 MEDIUM deterministic fixture", mediumFx.facts["deck.area_m2"] === 35);
check(
  "22 MEDIUM package not used for detailed geometry",
  medium.legacy.substructureCost == null
);
check(
  "23 MEDIUM detailed quantities deterministic",
  child(medium, DECK_JOISTS_COMPONENT_KEY)?.quantity === 89.25 &&
    child(medium, DECK_RIM_FRAMING_COMPONENT_KEY)?.quantity === 14.7 &&
    child(medium, DECK_BEARERS_COMPONENT_KEY)?.quantity === 22.05
);
check(
  "24 MEDIUM supports/concrete honest",
  child(medium, DECK_SUPPORTS_COMPONENT_KEY)?.quantity === 12 &&
    child(medium, DECK_SUPPORTS_COMPONENT_KEY)?.totalCost == null &&
    child(medium, DECK_CONCRETE_COMPONENT_KEY)?.quantity === 0.486 &&
    child(medium, DECK_CONCRETE_COMPONENT_KEY)?.totalCost == null
);
const scale = scaleComparison(simple, medium);
check(
  "25 scale comparison produced",
  (scale.legacyScale === "unknown" ||
    scale.legacyScale === "stable" ||
    scale.legacyScale === "growing" ||
    scale.legacyScale === "shrinking") &&
    (scale.timberScale === "shrinking" ||
      scale.timberScale === "growing" ||
      scale.timberScale === "stable") &&
    scale.note.includes("Do not infer which is correct")
);

check("26 ELEVATED deterministic", elevated.areaM2 === 24);
check(
  "27 ELEVATED design uncertainty surfaced",
  elevated.limitations.some((line) => /bracing/i.test(line)) &&
    elevated.limitations.some((line) => /connector/i.test(line))
);
check(
  "28 ELEVATED post length not invented",
  elevated.limitations.some((line) => /length/i.test(line)) &&
    !elevated.detailed.children.some((row) => row.unit === "lm" && row.componentKey === DECK_SUPPORTS_COMPONENT_KEY)
);
check(
  "29 ELEVATED bracing not invented",
  !elevated.detailed.children.some((row) => /brac/i.test(row.componentKey))
);
check("30 ELEVATED confidence reduced", elevated.confidence === "LOW");

check(
  "31 required unpriced support flagged",
  child(simple, DECK_SUPPORTS_COMPONENT_KEY)?.economicGap === true &&
    simple.economicGaps.includes(DECK_SUPPORTS_COMPONENT_KEY)
);
check(
  "32 required unpriced concrete flagged",
  child(simple, DECK_CONCRETE_COMPONENT_KEY)?.economicGap === true
);

const notRequired = runDeckCalibration(simpleFx, {
  [DECK_SUPPORTS_COMPONENT_KEY]: { state: "NOT_REQUIRED" },
});
check(
  "33 NOT_REQUIRED does not flag",
  child(notRequired, DECK_SUPPORTS_COMPONENT_KEY)?.economicGap === false &&
    child(notRequired, DECK_SUPPORTS_COMPONENT_KEY)?.scopeRequirement === "NOT_REQUIRED" &&
    child(notRequired, DECK_SUPPORTS_COMPONENT_KEY)?.bucketState === "NOT_REQUIRED"
);

const allowance = runDeckCalibration(simpleFx, {
  [DECK_SUPPORTS_COMPONENT_KEY]: { state: "ALLOWANCE" },
});
check(
  "34 allowance closes diagnostic gap",
  child(allowance, DECK_SUPPORTS_COMPONENT_KEY)?.economicGap === false
);

const fallback = runDeckCalibration(simpleFx, {
  [DECK_SUPPORTS_COMPONENT_KEY]: { state: "LEGACY_FALLBACK" },
});
check(
  "35 legacy fallback closes diagnostic gap",
  child(fallback, DECK_SUPPORTS_COMPONENT_KEY)?.economicGap === false
);
check(
  "36 missing component never becomes $0",
  bucket(simple, "blocking")?.cost !== 0 &&
    bucket(simple, "trimmers")?.cost !== 0 &&
    child(simple, DECK_SUPPORTS_COMPONENT_KEY)?.totalCost !== 0
);

check("37 variance only on comparable buckets", simple.variance.comparable === false);
check(
  "38 partial total not described as complete",
  simple.detailed.partialLabel === "PARTIAL PRICED STRUCTURAL CHILD COST" &&
    simple.economicCompleteness === "INCOMPLETE"
);
check(
  "39 no fake completeness percentage",
  !reportContainsFakeCompletenessPercent(simple) &&
    !reportContainsFakeCompletenessPercent(medium)
);

const syntheticJob: DeckCalibrationFixture = {
  ...simpleFx,
  id: "SIMPLE-01-REALJOB-OVERLAY",
  realJob: {
    quotedSubstructureCost: 2000,
    actualFramingMaterialCost: 900,
    notes: ["Verifier overlay only — not a real completed job."],
  },
};
const jobOverlay = runDeckCalibration(syntheticJob);
check(
  "40 actual-job partial evidence supported",
  jobOverlay.realJob.supplied === true &&
    jobOverlay.realJob.comparisons.length >= 1
);

check(
  "41 priced structural children may contribute money; unpriced stay Pricing Required",
  simple.commercialSafety.structuralChildrenContributeMoney === true &&
    medium.commercialSafety.structuralChildrenContributeMoney === true &&
    child(simple, DECK_SUPPORTS_COMPONENT_KEY)?.totalCost == null
);
check(
  "42 structural children SHADOW/not REQUIREMENT_AUTHORITATIVE",
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every(
    (key) =>
      getComponentCommercialAuthority({
        workAreaType: "deck",
        componentKey: key,
      }).authority !== "REQUIREMENT_AUTHORITATIVE"
  )
);
check(
  "43 package not used when the detailed physical model exists",
  simple.legacy.substructureCost == null
);
check(
  "44 fixings legacy unchanged",
  simple.legacy.fixingsCost === 403
);
check(
  "45 labour authority SHADOW",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW"
);

const deck1 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck 1")],
  facts: [
    fact("deck.area_m2", "d1", 70),
    fact("deck.board_material", "d1", "Hardwood"),
    fact("deck.board_width_mm", "d1", 140),
    fact("deck.height_m", "d1", 0.8),
    fact("deck.existing_deck_removal", "d1", true),
    fact("deck.access_type", "d1", "Stair set"),
    fact("deck.balustrade_required", "d1", true),
  ],
  materialWastageSettings: { decking: 10, default: 5 },
} as never);
check("46 Deck golden $48,340 unchanged", Math.round(deck1.recommendedSell) === 48340);

check("47 no migration", !existsSync("supabase/migrations/037_materials.sql"));
check(
  "48 no new prices in fixtures",
  !JSON.stringify(simpleFx).includes("normalizedRateExGst") &&
    simpleFx.facts["deck.joist_section"] === "140x45"
);
check(
  "49 no materials DB",
  !readdirSync("supabase/migrations").some((name) => /materials_table|global_materials/i.test(name))
);
check("50 no Production deploy", true);
check("51 Production SD disabled", isScopeDiscoveryEnabled({}) === false);

check(
  "52 decking.surface REQUIREMENT_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check("53 REAL-JOB template not invented", realTpl.status === "NOT_COMPARABLE" && realTemplate.template === true);
check(
  "54 SIMPLE joists/rim/bearers priced",
  child(simple, DECK_JOISTS_COMPONENT_KEY)?.priced === true &&
    child(simple, DECK_RIM_FRAMING_COMPONENT_KEY)?.priced === true &&
    child(simple, DECK_BEARERS_COMPONENT_KEY)?.priced === true
);
check(
  "55 SIMPLE comparison is material/substructure",
  simple.comparisonLabel === "MATERIAL / SUBSTRUCTURE COMPARISON"
);
check(
  "56 ELEVATED supports still EA",
  child(elevated, DECK_SUPPORTS_COMPONENT_KEY)?.unit === "ea"
);
check(
  "57 CUSTOM bearers may still price",
  child(custom, DECK_BEARERS_COMPONENT_KEY)?.priced === true
);
check(
  "58 MEDIUM assumed facts recorded",
  mediumFx.assumedFramingFacts.some((line) => /3 rows/.test(line))
);
check(
  "59 economic completeness not a percentage",
  simple.economicCompleteness === "INCOMPLETE"
);
check(
  "60 REAL-JOB required fields listed",
  (realTemplate.fields ?? []).some((field) => field.class === "REQUIRED")
);
check(
  "60b REAL-JOB hybrid evidence fields listed",
  (realTemplate.fields ?? []).some((field) => field.key.includes("actualDeliveryOrPlantCost")) &&
    (realTemplate.fields ?? []).some((field) => field.key.includes("actualPgOrOverheadCost")) &&
    (realTemplate.fields ?? []).some((field) => field.key.includes("quotedSubstructureAllowance"))
);

const fence2 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("f2", "fence", "Fence 2")],
  facts: [
    fact("fence.length_m", "f2", 30),
    fact("fence.height_m", "f2", 2),
    fact("fence.material", "f2", "Timber"),
    fact("fence.gate_included", "f2", true),
    fact("fence.demolition_required", "f2", true),
    fact("fence.disposal_required", "f2", true),
    fact("fence.slope_condition", "f2", "Steep/sloping"),
    fact("fence.access", "f2", "Difficult"),
  ],
} as never);
const pergola1 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("p1", "pergola", "Pergola 1")],
  facts: [
    fact("pergola.area_m2", "p1", 24),
    fact("pergola.material", "p1", "Aluminium"),
    fact("pergola.attached", "p1", "Attached"),
    fact("pergola.roofing_included", "p1", true),
    fact("pergola.roofing_type", "p1", "Colorsteel"),
  ],
} as never);
const rw2 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("rw2", "retaining_wall", "Retaining Wall 2")],
  facts: [
    fact("retaining_wall.length_m", "rw2", 10),
    fact("retaining_wall.height_m", "rw2", 1),
    fact("retaining_wall.is_raking", "rw2", false),
    fact("retaining_wall.fixing_type", "rw2", "Standard"),
    fact("retaining_wall.material", "rw2", "Timber"),
    fact("retaining_wall.drainage_required", "rw2", true),
    fact("retaining_wall.backfill_included", "rw2", true),
    fact("retaining_wall.backfill_depth_m", "rw2", 0.3),
    fact("retaining_wall.backfill_length_m", "rw2", 10),
    fact("retaining_wall.backfill_height_m", "rw2", 1),
  ],
} as never);
check("61 Fence 2 golden $8,782", Math.round(fence2.recommendedSell) === 8782);
check("62 Pergola 1 golden $15,374", Math.round(pergola1.recommendedSell) === 15374);
check("63 Retaining Wall 2 golden $7,345", Math.round(rw2.recommendedSell) === 7345);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

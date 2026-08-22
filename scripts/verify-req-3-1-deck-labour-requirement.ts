/**
 * REQ-3.1 — Deck labour LabourRequirement shadow emission.
 *
 * Hours + cost reuse only. Must not change estimate money, persistence, or UI.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import { calculateExternalStairs } from "../lib/estimate/calculators/external-stairs";
import { calculateFence } from "../lib/estimate/calculators/fence";
import {
  calculateCeilings,
  calculateDoors,
  calculateFlooring,
  calculateInternalWalls,
  calculatePainting,
  calculatePlastering,
} from "../lib/estimate/calculators/fitout";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  DECK_LABOUR_COMPONENT_KEY,
  DECK_LABOUR_TRADE,
} from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { shapeLabourHours } from "../lib/estimate/labour-hours";
import { mapLabourRateSourceToRequirement } from "../lib/estimate/labour-requirement";
import { summarizeLabourRequirements } from "../lib/estimate/requirement-aggregate";
import { buildRequirementId } from "../lib/estimate/requirement-id";
import { collectRequirements } from "../lib/estimate/requirement-normalize";
import {
  PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY,
  type LabourRequirement,
  type MaterialRequirement,
} from "../lib/estimate/requirements";
import { resolveLabourRate } from "../lib/estimate/rates";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";
import type {
  EstimateContext,
  EstimateConstraint,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTs(full));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function constraint(
  key: string,
  value: string,
  label = key
): EstimateConstraint {
  return { key, label, value };
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
  materialWastageSettings: {
    deckingWastagePercent: 10,
    defaultMaterialWastagePercent: 10,
  },
  rates: [],
} as unknown as EstimateContext;

const ownerArea = 16.12;
const ownerWidthMm = 140;

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

function deckLabourLine(result: ReturnType<typeof calculateDeck>) {
  return result.lineItems.find((item) => item.label === "Deck labour");
}

function labourRequirement(
  result: ReturnType<typeof calculateDeck>
): LabourRequirement | undefined {
  return result.requirements?.find(
    (item): item is LabourRequirement => item.kind === "labour"
  );
}

function surfaceRequirement(
  result: ReturnType<typeof calculateDeck>
): MaterialRequirement | undefined {
  return result.requirements?.find(
    (item): item is MaterialRequirement => item.kind === "material"
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

console.log("=== REQ-3.1 Deck labour LabourRequirement ===\n");

const supportedDeck = calculateDeck(
  { ...baseContext, facts: hardwoodFacts("d1") } as never,
  wa("d1", "deck", "Deck")
);
const supportedLabour = labourRequirement(supportedDeck);
const supportedSurface = surfaceRequirement(supportedDeck);
const supportedLine = deckLabourLine(supportedDeck);

check(
  "EMISSION 1 supported Deck emits one LabourRequirement",
  (supportedDeck.requirements ?? []).filter((item) => item.kind === "labour")
    .length === 1 && supportedLabour?.componentKey === DECK_LABOUR_COMPONENT_KEY
);
check(
  "EMISSION 2 MaterialRequirement still emitted separately",
  supportedSurface?.kind === "material" &&
    supportedSurface.componentKey === DECK_SURFACE_COMPONENT_KEY &&
    supportedSurface.requirementId !== supportedLabour?.requirementId
);
check(
  "EMISSION 3 componentKey = deck.labour",
  supportedLabour?.componentKey === "deck.labour"
);
check(
  "EMISSION 4 trade identity = carpenter",
  supportedLabour?.trade === DECK_LABOUR_TRADE &&
    supportedLabour.trade === "carpenter"
);
const expectedLabourId = buildRequirementId({
  workAreaId: "d1",
  kind: "labour",
  componentKey: DECK_LABOUR_COMPONENT_KEY,
});
const rerunLabour = labourRequirement(
  calculateDeck(
    { ...baseContext, facts: hardwoodFacts("d1") } as never,
    wa("d1", "deck", "Deck")
  )
);
check(
  "EMISSION 5 deterministic requirement ID",
  supportedLabour?.requirementId === expectedLabourId &&
    supportedLabour.requirementId === rerunLabour?.requirementId &&
    expectedLabourId === "d1:labour:deck.labour"
);

const expectedHours = shapeLabourHours({
  quantity: ownerArea,
  productivityHoursPerUnit: 1.45,
  adjustmentFactor: 1,
  qualityFactor: 1,
});
check(
  "HOURS 6 requirement hours come from existing authoritative calculation",
  supportedLabour?.adjustedHours === supportedLine?.labourHours &&
    supportedLabour?.adjustedHours === expectedHours.adjustedHours
);
const deckSrc = read("lib/estimate/calculators/deck.ts");
const hoursSrc = read("lib/estimate/labour-hours.ts");
check(
  "HOURS 7 no second labour formula",
  deckSrc.includes("shapeLabourHours") &&
    hoursSrc.includes("adjustedHours") &&
    (deckSrc.match(/resolveLabourRate\(/g) ?? []).length === 1
);
check(
  "HOURS 8 adjustedHours match existing line hours",
  supportedLabour?.adjustedHours === supportedLine?.labourHours &&
    supportedLine?.labourHours === expectedHours.adjustedHours
);
check(
  "HOURS 9 baseHours mapping is honest (pre-PC, quality included)",
  supportedLabour?.baseHours === expectedHours.baseHours &&
    supportedLabour.baseHours === supportedLabour.adjustedHours &&
    supportedLabour.adjustmentRef.factors.length === 0
);
check(
  "HOURS 10 labour hours are not elapsed duration",
  supportedLabour != null &&
    !("duration" in supportedLabour) &&
    !("elapsedHours" in supportedLabour) &&
    !("crewDuration" in supportedLabour)
);

const companyDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: "labour.carpenter.hour",
        rate_type: "labour",
        unit: "hour",
        cost_rate: 80,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const companyLabour = labourRequirement(companyDeck);
const companyLine = deckLabourLine(companyDeck);
const companyResolved = resolveLabourRate({
  rates: [
    {
      item_key: "labour.carpenter.hour",
      rate_type: "labour",
      unit: "hour",
      cost_rate: 80,
      sell_rate: null,
      active: true,
    },
  ] as never,
  organisationSettings: orgSettings as never,
});
check(
  "RATE 11 same labour rate source used by line and requirement",
  companyLine?.rateSourceType === "user_rate" &&
    companyLabour?.rateProvenance === "company" &&
    mapLabourRateSourceToRequirement("user_rate") === "company" &&
    companyResolved.sourceType === "user_rate"
);
check(
  "RATE 12 company cost rate parity",
  companyLabour?.hourlyCost === 80 &&
    companyLine?.costRate === 80 &&
    companyLabour.rateKey === "labour.carpenter.hour"
);
const benchmarkDeck = calculateDeck(
  { ...baseContext, facts: hardwoodFacts("d1") } as never,
  wa("d1", "deck", "Deck")
);
const benchmarkLabour = labourRequirement(benchmarkDeck);
const benchmarkLine = deckLabourLine(benchmarkDeck);
check(
  "RATE 13 benchmark/legacy rate provenance parity",
  benchmarkLabour?.rateProvenance === "hardcoded_legacy" &&
    benchmarkLine?.rateSourceType === "default" &&
    mapLabourRateSourceToRequirement("default") === "hardcoded_legacy" &&
    mapLabourRateSourceToRequirement("missing") === "hardcoded_legacy" &&
    benchmarkLabour.hourlyCost === 60
);
check(
  "RATE 14 no independent resolver divergence",
  companyLabour?.hourlyCost === companyResolved.costRate &&
    companyLabour.hourlyCost === companyLine?.costRate
);

check(
  "COST 15 totalCost exact parity with Deck labour component",
  companyLabour?.totalCost === companyLine?.recommendedCost &&
    benchmarkLabour?.totalCost === benchmarkLine?.recommendedCost
);
check(
  "COST 16 current rounding preserved",
  companyLabour?.totalCost ===
    round2((companyLabour?.adjustedHours ?? 0) * 80) &&
    companyLine?.recommendedCost === companyLabour?.totalCost
);
check(
  "COST 17 priced=true only when cost resolved",
  companyLabour?.priced === true &&
    benchmarkLabour?.priced === true &&
    companyLabour.hourlyCost != null &&
    companyLabour.totalCost != null
);

const missingDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    organisationSettings: {
      ...orgSettings,
      allow_benchmark_rates: false,
    },
  } as never,
  wa("d1", "deck", "Deck")
);
const missingLabour = labourRequirement(missingDeck);
const missingLine = deckLabourLine(missingDeck);
check(
  "COST 18 benchmarks-off still uses hardcoded 60/90 pricing truth",
  missingLabour?.priced === true &&
    missingLabour.rateProvenance === "hardcoded_legacy" &&
    missingLabour.hourlyCost === 60 &&
    missingLine?.costRate === 60 &&
    missingLine.rateSourceType === "missing"
);
check(
  "COST 19 benchmarks-off exact cost parity with Deck labour line",
  missingLabour?.adjustedHours === missingLine?.labourHours &&
    missingLabour?.adjustedHours === expectedHours.adjustedHours &&
    missingLabour.totalCost === missingLine?.recommendedCost &&
    missingLabour.totalCost === round2(expectedHours.adjustedHours * 60)
);

const normalDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d-pc"),
    constraints: [constraint("site_access", "Easy", "Site access")],
  } as never,
  wa("d-pc", "deck", "Deck PC")
);
const restrictedDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d-pc"),
    constraints: [constraint("site_access", "Difficult", "Site access")],
  } as never,
  wa("d-pc", "deck", "Deck PC")
);
const normalLabour = labourRequirement(normalDeck);
const restrictedLabour = labourRequirement(restrictedDeck);
const normalLine = deckLabourLine(normalDeck);
const restrictedLine = deckLabourLine(restrictedDeck);
const restrictedExpected = shapeLabourHours({
  quantity: ownerArea,
  productivityHoursPerUnit: 1.45,
  adjustmentFactor: 1.1,
  qualityFactor: 1,
});
check(
  "PC 20 normal condition fixture",
  normalLabour?.adjustedHours === normalLine?.labourHours &&
    normalLabour?.adjustmentRef.factors.length === 0 &&
    normalLabour.baseHours === normalLabour.adjustedHours
);
check(
  "PC 21 difficult/restricted fixture",
  restrictedLabour?.adjustedHours === restrictedExpected.adjustedHours &&
    restrictedLabour.adjustmentRef.factors.length === 1 &&
    restrictedLabour.adjustmentRef.factors[0]?.key ===
      PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY &&
    restrictedLabour.adjustmentRef.factors[0]?.value === 1.1
);
check(
  "PC 22 adjusted hours match existing line",
  restrictedLabour?.adjustedHours === restrictedLine?.labourHours &&
    normalLabour?.adjustedHours === normalLine?.labourHours
);
const restrictedAgg = summarizeLabourRequirements(
  restrictedLabour ? [restrictedLabour] : []
);
check(
  "PC 23 no PC reapplication",
  restrictedAgg.totalHours.adjustedHours === restrictedLabour?.adjustedHours &&
    restrictedAgg.byTask[0]?.adjustedHours === restrictedLabour?.adjustedHours &&
    restrictedLabour.adjustedHours !==
      round2((restrictedLabour.adjustedHours ?? 0) * 1.1)
);
check(
  "PC 24 adjustmentRef provenance retained",
  restrictedAgg.byTask[0]?.adjustmentFactors[0]?.factors[0]?.key ===
    PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY &&
    restrictedLabour?.provenance.constraintKeys.includes("site_access") === true
);
const carryRestricted = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d-pc"),
    constraints: [
      constraint("site_access", "Difficult", "Site access"),
      constraint("material_carry_distance", "40m", "Carry"),
    ],
  } as never,
  wa("d-pc", "deck", "Deck PC")
);
const carryLabour = labourRequirement(carryRestricted);
check(
  "PC 25 multiple-factor shape supported; combined factor not decomposed",
  carryLabour?.adjustmentRef.factors.length === 1 &&
    carryLabour.adjustmentRef.factors[0]?.key ===
      PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY &&
    round2(carryLabour.adjustmentRef.factors[0]?.value ?? 0) === 1.2 &&
    !carryLabour.adjustmentRef.factors.some((item) =>
      item.key.includes("site_access")
    )
);
const adjustmentsSrc = read("lib/estimate/adjustments.ts");
check(
  "PC 26 OD-PC-01 composition remains unchanged",
  adjustmentsSrc.includes("Cap compound site adjustment") &&
    !read("lib/estimate/deck-labour-requirement.ts").includes("Math.min") &&
    carryLabour?.adjustedHours === deckLabourLine(carryRestricted)?.labourHours
);

check(
  "SCOPE 27 requirement scope is lumped Deck labour",
  supportedLabour?.description === "Deck labour" &&
    supportedDeck.lineItems.some((item) => item.label === "Deck labour")
);
const demoDeck = calculateDeck(
  {
    ...baseContext,
    facts: [
      ...hardwoodFacts("d-demo"),
      fact("deck.existing_deck_removal", "d-demo", true),
    ],
  } as never,
  wa("d-demo", "deck", "Deck demo")
);
check(
  "SCOPE 28 demolition not accidentally included twice",
  demoDeck.lineItems.some((item) => item.label === "Existing deck removal") &&
    (demoDeck.requirements ?? []).filter((item) => item.kind === "labour")
      .length === 1 &&
    labourRequirement(demoDeck)?.componentKey === DECK_LABOUR_COMPONENT_KEY &&
    labourRequirement(demoDeck)?.adjustedHours ===
      deckLabourLine(demoDeck)?.labourHours
);
const faceDeck = calculateDeck(
  {
    ...baseContext,
    facts: [
      ...hardwoodFacts("d-face"),
      fact("deck.vertical_face_boards_required", "d-face", true),
      fact("deck.vertical_face_board_length_lm", "d-face", 12),
    ],
  } as never,
  wa("d-face", "deck", "Deck face")
);
const faceKeys = (faceDeck.requirements ?? []).map((item) => item.componentKey);
check(
  "SCOPE 29 face/fascia labour uses hours not the old $35 allowance",
  faceDeck.lineItems.some((item) => item.label === "Fascia installation") &&
    !faceDeck.lineItems.some((item) => item.label === "Face board labour allowance") &&
    !faceKeys.some(
      (key) =>
        key.includes("fascia") ||
        key.includes("face_board") ||
        key.includes(".face") ||
        key.startsWith("face.")
    ) &&
    faceKeys.includes(DECK_LABOUR_COMPONENT_KEY)
);
check(
  "SCOPE 30 no invented DECK-3 task split",
  !faceKeys.some((key) =>
    /setout|joist|bearer|pile|post|decking\.install|cleanup|balustrade|stairs/i.test(
      key
    )
  ) && (faceDeck.requirements ?? []).filter((item) => item.kind === "labour").length === 1
);

const twoWaEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [
    wa("wa-a", "deck", "Deck A"),
    wa("wa-b", "deck", "Deck B"),
  ],
  facts: [...hardwoodFacts("wa-a"), ...hardwoodFacts("wa-b")],
} as never);
const twoLabour = (twoWaEstimate.requirements ?? []).filter(
  (item): item is LabourRequirement => item.kind === "labour"
);
const labourSummary = summarizeLabourRequirements(twoLabour);
check(
  "AGGREGATION 31 two Deck WAs retain two contributors",
  twoLabour.length === 2 &&
    labourSummary.byTask[0]?.contributors.length === 2 &&
    twoLabour.some((item) => item.workAreaId === "wa-a") &&
    twoLabour.some((item) => item.workAreaId === "wa-b")
);
check(
  "AGGREGATION 32 trade total correct",
  labourSummary.byTrade.length === 1 &&
    labourSummary.byTrade[0]?.trade === "carpenter" &&
    labourSummary.byTrade[0]?.adjustedHours ===
      round2(twoLabour[0]!.adjustedHours + twoLabour[1]!.adjustedHours)
);
check(
  "AGGREGATION 33 Work Area totals correct",
  labourSummary.byWorkArea.length === 2 &&
    labourSummary.byWorkArea.every((row) => row.adjustedHours === expectedHours.adjustedHours)
);
check(
  "AGGREGATION 34 total labour hours correct",
  labourSummary.totalHours.adjustedHours ===
    round2(expectedHours.adjustedHours * 2) &&
    labourSummary.totalHours.baseHours === round2(expectedHours.baseHours * 2)
);
check(
  "AGGREGATION 35 no elapsed-duration conversion",
  labourSummary.totalHours.hoursAreElapsedDuration === false &&
    labourSummary.byTask[0]?.hoursAreElapsedDuration === false &&
    labourSummary.byTrade[0]?.hoursAreElapsedDuration === false
);

const supportedEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck")],
  facts: hardwoodFacts("d1"),
} as never);
const lineCostSum = round2(
  supportedDeck.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0)
);
const lineSellSum = round2(
  supportedDeck.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)
);
check(
  "COMMERCIAL 36 estimate cost unchanged",
  round2(supportedEstimate.recommendedCost) === lineCostSum
);
check(
  "COMMERCIAL 37 estimate sell unchanged",
  round2(supportedEstimate.recommendedSell) === lineSellSum
);
check(
  "COMMERCIAL 38 requirement cost not added",
  supportedLabour?.totalCost != null &&
    round2(supportedEstimate.recommendedCost) !==
      round2(lineCostSum + supportedLabour.totalCost)
);
check(
  "COMMERCIAL 39 existing labour line remains money authority",
  supportedEstimate.lineItems.some(
    (item) =>
      item.label === "Deck labour" &&
      item.recommendedCost === supportedLine?.recommendedCost
  )
);
const quoteSrc = read("lib/work-areas/quote-description.ts");
const pricingSrc = read("lib/pricing/commercial-engine-adapter.ts");
check(
  "COMMERCIAL 40 Pricing unchanged",
  !pricingSrc.includes("LabourRequirement") &&
    !pricingSrc.includes("deck.labour") &&
    !pricingSrc.includes("requirements")
);
check(
  "COMMERCIAL 41 Quote unchanged",
  !quoteSrc.includes("LabourRequirement") &&
    !quoteSrc.includes("deck.labour")
);
check(
  "COMMERCIAL 42 no component promotion",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: "deck.labour",
  }).authority === "SHADOW" &&
    !read("lib/estimate/calculate-estimate.ts").includes("REQUIREMENT_AUTHORITATIVE") &&
    !read("lib/estimate/deck-labour-requirement.ts").includes("commercialAuthority")
);

check(
  "CROSS-REQ 43 Deck MaterialRequirement unchanged",
  supportedSurface?.baseQuantity === 115.14 &&
    supportedSurface.wasteFactor === 0.1 &&
    supportedSurface.purchaseQuantity === 126.65 &&
    supportedSurface.componentKey === DECK_SURFACE_COMPONENT_KEY
);
check(
  "CROSS-REQ 44 material/labour requirement IDs distinct",
  supportedSurface?.requirementId ===
    buildRequirementId({
      workAreaId: "d1",
      kind: "material",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      variantKey: "hardwood",
    }) &&
    supportedLabour?.requirementId === "d1:labour:deck.labour" &&
    supportedSurface.requirementId !== supportedLabour.requirementId
);
const collected = collectRequirements([supportedDeck]);
check(
  "CROSS-REQ 45 normalized project collection deterministic",
  collected.length === 2 &&
    collected[0]?.kind === "material" &&
    collected[1]?.kind === "labour" &&
    collected[0].componentKey === DECK_SURFACE_COMPONENT_KEY &&
    collected[1].componentKey === DECK_LABOUR_COMPONENT_KEY &&
    supportedEstimate.requirements?.[0]?.kind === "material" &&
    supportedEstimate.requirements[1]?.kind === "labour"
);

const bathroom = calculateBathroom(
  {
    ...baseContext,
    facts: [
      fact("bathroom.area_m2", "b1", 6),
      fact("bathroom.layout", "b1", "Full renovation"),
    ],
  } as never,
  wa("b1", "bathroom", "Bathroom")
);
const fence = calculateFence(
  {
    ...baseContext,
    facts: [
      fact("fence.length_m", "f1", 20),
      fact("fence.height_m", "f1", 1.8),
      fact("fence.material", "f1", "Timber"),
    ],
  } as never,
  wa("f1", "fence", "Fence")
);
const pergola = calculatePergola(
  {
    ...baseContext,
    facts: [
      fact("pergola.area_m2", "p1", 12),
      fact("pergola.material", "p1", "Timber"),
    ],
  } as never,
  wa("p1", "pergola", "Pergola")
);
const retaining = calculateRetainingWall(
  {
    ...baseContext,
    facts: [
      fact("retaining_wall.length_m", "r1", 8),
      fact("retaining_wall.height_m", "r1", 1),
    ],
  } as never,
  wa("r1", "retaining_wall", "RW")
);
const demolition = calculateDemolition(
  {
    ...baseContext,
    facts: [fact("demolition.area_m2", "dm1", 20)],
  } as never,
  wa("dm1", "demolition", "Demo")
);
const stairs = calculateExternalStairs(
  {
    ...baseContext,
    facts: [fact("external_stairs.treads", "s1", 8)],
  } as never,
  wa("s1", "external_stairs", "Stairs")
);
const kitchen = calculateKitchen(
  {
    ...baseContext,
    facts: [fact("kitchen.layout", "k1", "Full renovation")],
  } as never,
  wa("k1", "kitchen", "Kitchen")
);
const fitoutWa = wa("ft1", "internal_walls", "Walls");
const fitoutCtx = {
  ...baseContext,
  facts: [fact("internal_walls.area_m2", "ft1", 40)],
} as never;
check("OTHER 46 Bathroom emits no LabourRequirement", bathroom.requirements == null);
check("OTHER 47 Fence emits none", fence.requirements == null);
check("OTHER 48 Pergola emits none", pergola.requirements == null);
check("OTHER 49 Retaining emits none", retaining.requirements == null);
check(
  "OTHER 50 commercial components emit none",
  demolition.requirements == null &&
    stairs.requirements == null &&
    kitchen.requirements == null &&
    calculateInternalWalls(fitoutCtx, fitoutWa).requirements == null &&
    calculateCeilings(fitoutCtx, fitoutWa).requirements == null &&
    calculateDoors(fitoutCtx, fitoutWa).requirements == null &&
    calculateFlooring(fitoutCtx, fitoutWa).requirements == null &&
    calculatePainting(fitoutCtx, fitoutWa).requirements == null &&
    calculatePlastering(fitoutCtx, fitoutWa).requirements == null
);

const persistSrc = read("lib/estimate/persist-estimate.ts");
const migrations = existsSync(join("supabase", "migrations"))
  ? readdirSync(join("supabase", "migrations"))
  : [];
check(
  "PLATFORM 51 no requirement-row commercial persistence",
  persistSrc.includes("Do not persist requirement rows onto estimates") &&
    !persistSrc.includes("LabourRequirement")
);
check(
  "PLATFORM 52 snapshot migration is REQ-4A only",
  migrations.some((name) => name.includes("035_estimate_requirement_snapshots")) &&
    !migrations.some((name) => /req.?3/i.test(name) && !name.includes("requirement_snapshots"))
);
const uiFiles = walkTs(join("app")).concat(walkTs(join("components")));
check(
  "PLATFORM 53 no UI",
  !uiFiles.some((path) => {
    const text = readFileSync(path, "utf8");
    return (
      text.includes("deck.labour") ||
      text.includes("LabourRequirement") ||
      text.includes("Labour tab")
    );
  })
);
check(
  "PLATFORM 54 no AI",
  !deckSrc.includes("anthropic") &&
    !read("lib/estimate/deck-labour-requirement.ts").includes("generateText") &&
    !read("lib/estimate/labour-requirement.ts").includes("anthropic")
);
check(
  "PLATFORM 55 Production SD disabled",
  isScopeDiscoveryEnabled({}) === false
);

const rateChangeDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: "labour.carpenter.hour",
        rate_type: "labour",
        unit: "hour",
        cost_rate: 95,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
check(
  "IDENTITY rate change does not create a new requirement ID",
  labourRequirement(rateChangeDeck)?.requirementId ===
    supportedLabour?.requirementId &&
    labourRequirement(rateChangeDeck)?.hourlyCost === 95
);

check(
  "VALIDATE confidence is medium",
  supportedLabour?.confidence === "medium"
);
check(
  "VALIDATE no sell field on LabourRequirement",
  supportedLabour != null &&
    !("hourlySell" in supportedLabour) &&
    !("totalSell" in supportedLabour) &&
    !("recommendedSell" in supportedLabour)
);

check(
  "GOLDEN Deck 1 sell unchanged",
  Math.round(
    calculateDeck(
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
        materialWastageSettings: { decking: 10, default: 5 },
      } as never,
      wa("d1", "deck", "Deck 1")
    ).lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)
  ) === 48340
);

const calcFiles = walkTs(join("lib", "estimate", "calculators"));
const emitting = calcFiles.filter((p) => {
  const text = readFileSync(p, "utf8");
  return text.includes("requirements:");
});
check(
  "EMITTERS only Deck calculator emits requirements",
  emitting.length === 1 &&
    emitting[0]?.replace(/\\/g, "/").endsWith("calculators/deck.ts")
);

console.log(`\n=== REQ-3.1 Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);

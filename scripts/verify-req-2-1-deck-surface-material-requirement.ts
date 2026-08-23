/**
 * REQ-2.1 — Deck surface MaterialRequirement shadow emission.
 *
 * Physical + pricing reuse only. Must not change estimate money, persistence, or UI.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { DECK_SURFACE_COMPONENT_KEY, getDeckSurfaceVariantKey } from "../lib/estimate/deck-surface-requirement";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { calculateDeckingBoardLm } from "../lib/estimate/material-buildups";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import { buildRequirementId } from "../lib/estimate/requirement-id";
import { groupMaterialRequirements } from "../lib/estimate/requirement-aggregate";
import { normalizeRequirement } from "../lib/estimate/requirement-normalize";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type {
  EstimateContext,
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
    item.label.startsWith("Decking")
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

console.log("=== REQ-2.1 Deck surface MaterialRequirement ===\n");

check(
  "PHYSICAL 1 Deck surface emits exactly one MaterialRequirement in supported case",
  calculateDeck(
    { ...baseContext, facts: hardwoodFacts("d1") } as never,
    wa("d1", "deck", "Deck")
  ).requirements?.filter((item) => item.kind === "material").length === 1
);

const quotrDeck = calculateDeck(
  { ...baseContext, facts: hardwoodFacts("d1") } as never,
  wa("d1", "deck", "Deck")
);
const quotrReq = surfaceRequirement(quotrDeck);
const quotrLine = deckingLine(quotrDeck);

check(
  "PHYSICAL 2 componentKey = decking.surface",
  quotrReq?.componentKey === DECK_SURFACE_COMPONENT_KEY
);
check("PHYSICAL 3 material kind correct", quotrReq?.kind === "material");
check(
  "PHYSICAL 4 base 115.14 lm for reference",
  physical?.baseLm === 115.14 && quotrReq?.baseQuantity === 115.14
);
check(
  "PHYSICAL 5 waste 10%",
  quotrReq?.wasteFactor === 0.1 && physical?.wastageLm === 11.51
);
check(
  "PHYSICAL 6 purchase 126.65 lm",
  physical?.totalLm === 126.65 && quotrReq?.purchaseQuantity === 126.65
);
check(
  "PHYSICAL 7 requirementId deterministic",
  quotrReq?.requirementId ===
    buildRequirementId({
      workAreaId: "d1",
      kind: "material",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      variantKey: "hardwood",
    }) &&
    quotrReq.requirementId ===
      surfaceRequirement(
        calculateDeck(
          { ...baseContext, facts: hardwoodFacts("d1") } as never,
          wa("d1", "deck", "Deck")
        )
      )?.requirementId
);
const pineReq = surfaceRequirement(
  calculateDeck(
    {
      ...baseContext,
      facts: [
        fact("deck.area_m2", "d1", ownerArea),
        fact("deck.board_material", "d1", "Treated pine"),
        fact("deck.board_width_mm", "d1", ownerWidthMm),
        fact("deck.height_m", "d1", 0.4),
      ],
    } as never,
    wa("d1", "deck", "Deck")
  )
);
check(
  "PHYSICAL 8 material variants distinguish IDs",
  quotrReq?.requirementId !== pineReq?.requirementId &&
    getDeckSurfaceVariantKey("Hardwood") === "hardwood" &&
    getDeckSurfaceVariantKey("Treated pine") === "treated_pine" &&
    getDeckSurfaceVariantKey("Kwila") === "kwila" &&
    getDeckSurfaceVariantKey("Composite") === "composite"
);

const companyLmDeck = calculateDeck(
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
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const companyLmReq = surfaceRequirement(companyLmDeck);
const companyLmLine = deckingLine(companyLmDeck);
check(
  "COMPANY LM 9 company lm source = company",
  companyLmReq?.rateSource === "company"
);
check("COMPANY LM 10 unit cost correct", companyLmReq?.unitCost === 18.5);
check(
  "COMPANY LM 11 total cost $2,343.03 for $18.50/lm",
  companyLmReq?.totalCost === 2343.03 &&
    round2(126.65 * 18.5) === 2343.03
);
check(
  "COMPANY LM 12 exact parity with existing Deck surface cost",
  companyLmReq?.totalCost === companyLmLine?.recommendedCost &&
    companyLmLine?.label === "Decking" &&
    companyLmLine.quantity === 126.65
);

const companyM2Deck = calculateDeck(
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
const companyM2Req = surfaceRequirement(companyM2Deck);
const companyM2Line = deckingLine(companyM2Deck);
check(
  "COMPANY M2 13 company m² conversion source remains company",
  companyM2Req?.rateSource === "company"
);
check(
  "COMPANY M2 14 unit cost $22.40/lm from $160/m² + 140mm",
  companyM2Req?.unitCost === 22.4
);
check(
  "COMPANY M2 15 purchase quantity 126.65 lm",
  companyM2Req?.purchaseQuantity === 126.65
);
check(
  "COMPANY M2 16 total cost $2,836.96",
  companyM2Req?.totalCost === 2836.96
);
check(
  "COMPANY M2 17 waste not doubled",
  companyM2Req?.totalCost === 2836.96 &&
    round2(ownerArea * 160) === 2579.2 &&
    companyM2Req.totalCost !== round2(ownerArea * 1.1 * 160)
);
check(
  "COMPANY M2 18 conversion provenance retained",
  companyM2Req?.conversion?.from === "m2" &&
    companyM2Req.conversion.to === "lm" &&
    companyM2Req.conversion.factor === 0.14 &&
    companyM2Req.conversion.sourceUnitCost === 160 &&
    companyM2Req.conversion.basis === "140mm board coverage"
);
check(
  "COMPANY M2 19 company converted rate beats Quotr benchmark",
  companyM2Req?.unitCost === 22.4 &&
    companyM2Req.totalCost !== 2786.3 &&
    companyM2Line?.materialRateResolution?.conversionNote != null
);

check("QUOTR 20 Quotr source = benchmark", quotrReq?.rateSource === "benchmark");
check("QUOTR 21 unit cost $22/lm", quotrReq?.unitCost === 22);
check("QUOTR 22 total cost $2,786.30", quotrReq?.totalCost === 2786.3);
check(
  "QUOTR 23 parity with current Deck surface cost",
  quotrReq?.totalCost === quotrLine?.recommendedCost &&
    quotrLine?.label === "Decking"
);

const missingDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    organisationSettings: {
      ...orgSettings,
      allow_benchmark_rates: false,
    },
    rates: [],
  } as never,
  wa("d1", "deck", "Deck")
);
const missingReq = surfaceRequirement(missingDeck);
const missingLine = deckingLine(missingDeck);
const missingEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck")],
  facts: hardwoodFacts("d1"),
  organisationSettings: {
    ...orgSettings,
    allow_benchmark_rates: false,
  },
  rates: [],
} as never);
check(
  "MISSING 24 physical requirement preserved when pricing cannot resolve",
  missingReq != null &&
    missingReq.baseQuantity === 115.14 &&
    missingReq.purchaseQuantity === 126.65
);
check("MISSING 25 priced=false", missingReq?.priced === false);
check("MISSING 26 totalCost=null", missingReq?.totalCost === null);
check("MISSING 27 rateSource=missing", missingReq?.rateSource === "missing");
check(
  "MISSING 28 estimate existing missing-pricing behaviour unchanged",
    missingLine?.label === "Decking package" &&
    missingLine.unit === "m²" &&
    missingEstimate.lineItems.some((item) => item.label === "Decking package")
);

const noWidthDeck = calculateDeck(
  { ...baseContext, facts: hardwoodFacts("d1", false) } as never,
  wa("d1", "deck", "Deck")
);
const noWidthLine = deckingLine(noWidthDeck);
check(
  "WIDTH UNKNOWN 29 no fake lm",
  surfaceRequirement(noWidthDeck) == null && noWidthLine?.unit === "m²"
);
check(
  "WIDTH UNKNOWN 30 honest fallback/no-requirement behavior",
  noWidthLine?.label === "Decking package" &&
    (noWidthDeck.requirements ?? []).filter((item) => item.kind === "material")
      .length === 0
);
check(
  "WIDTH UNKNOWN 31 no detailed-takeoff claim",
  (noWidthLine?.notes ?? "").toLowerCase().includes("board width not confirmed")
);

const quotrEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck")],
  facts: hardwoodFacts("d1"),
} as never);
const lineCostSum = round2(
  quotrDeck.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0)
);
check(
  "COMMERCIAL 32 estimate total unchanged",
  round2(quotrEstimate.recommendedCost) === lineCostSum &&
    (quotrEstimate.requirements ?? []).filter((item) => item.kind === "material")
      .length === 1
);
check(
  "COMMERCIAL 33 existing line remains sole active money (requirement replaces legacy)",
  quotrLine != null &&
    quotrEstimate.lineItems.some(
      (item) =>
        item.label === "Decking" &&
        item.recommendedCost === quotrLine.recommendedCost
    ) &&
    quotrEstimate.commercialSelections?.some(
      (item) =>
        item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
        item.activeSource === "REQUIREMENT"
    )
);
check(
  "COMMERCIAL 34 requirement cost equals active line (not stacked)",
  quotrReq?.totalCost === 2786.3 &&
    quotrLine?.recommendedCost === 2786.3 &&
    round2(quotrEstimate.recommendedCost) === lineCostSum
);
const quoteSrc = read("lib/work-areas/quote-description.ts");
const pricingSrc = read("lib/pricing/commercial-engine-adapter.ts");
check(
  "COMMERCIAL 35 Pricing unchanged",
  !pricingSrc.includes("requirements") &&
    !pricingSrc.includes("MaterialRequirement")
);
check(
  "COMMERCIAL 36 Quote unchanged",
  !quoteSrc.includes("MaterialRequirement") &&
    !quoteSrc.includes("decking.surface")
);
check(
  "COMMERCIAL 37 Deck surface promoted; calculate-estimate stays free of authority literals",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE" &&
    !read("lib/estimate/calculate-estimate.ts").includes("REQUIREMENT_AUTHORITATIVE")
);

const deckA = calculateDeck(
  { ...baseContext, facts: hardwoodFacts("wa-a") } as never,
  wa("wa-a", "deck", "Deck A")
);
const twoWaEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [
    wa("wa-a", "deck", "Deck A"),
    wa("wa-b", "deck", "Deck B"),
  ],
  facts: [...hardwoodFacts("wa-a"), ...hardwoodFacts("wa-b")],
} as never);
const hardwoodGroups = groupMaterialRequirements(
  (twoWaEstimate.requirements ?? []).filter(
    (item): item is MaterialRequirement => item.kind === "material"
  )
);
check(
  "AGGREGATION 38 two identical hardwood Deck WAs aggregate physically",
  (twoWaEstimate.requirements ?? []).filter((item) => item.kind === "material")
    .length === 2 &&
    hardwoodGroups.length === 1 &&
    hardwoodGroups[0]?.purchaseQuantity === 253.3
);
check(
  "AGGREGATION 39 contributors retained",
  hardwoodGroups[0]?.contributors.length === 2 &&
    hardwoodGroups[0].contributors.some((item) => item.workAreaId === "wa-a") &&
    hardwoodGroups[0].contributors.some((item) => item.workAreaId === "wa-b")
);
const compositeDeck = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "wa-c", ownerArea),
      fact("deck.board_material", "wa-c", "Composite"),
      fact("deck.board_width_mm", "wa-c", ownerWidthMm),
      fact("deck.height_m", "wa-c", 0.4),
    ],
  } as never,
  wa("wa-c", "deck", "Deck C")
);
const mixedGroups = groupMaterialRequirements(
  [surfaceRequirement(deckA), surfaceRequirement(compositeDeck)].filter(
    (item): item is MaterialRequirement => item != null
  )
);
check(
  "AGGREGATION 40 different materials do not merge",
  mixedGroups.length === 2
);
const unitMismatch = groupMaterialRequirements([
  surfaceRequirement(deckA) as MaterialRequirement,
  normalizeRequirement({
    ...(surfaceRequirement(deckA) as MaterialRequirement),
    requirementId: "wa-x:material:decking.surface:hardwood",
    workAreaId: "wa-x",
    purchaseUnit: "m2",
  }) as MaterialRequirement,
]);
check(
  "AGGREGATION 41 incompatible units do not merge",
  unitMismatch.length === 2
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
const faceLabels = faceDeck.lineItems.map((item) => item.label.toLowerCase());
check(
  "EXCLUSIONS 42 no fascia requirement",
  faceKeys.every(
    (key) => key === DECK_SURFACE_COMPONENT_KEY || key === "deck.labour"
  ) &&
    faceLabels.some((label) => label.includes("face") || label.includes("fascia"))
);
check(
  "EXCLUSIONS 43 no joist requirement",
  !faceKeys.some((key) => key.includes("joist"))
);
check(
  "EXCLUSIONS 44 no bearer requirement",
  !faceKeys.some((key) => key.includes("bearer"))
);
check(
  "EXCLUSIONS 45 no post requirement",
  !faceKeys.some((key) => key.includes("post") || key.includes("pile"))
);
check(
  "EXCLUSIONS 46 no concrete requirement",
  !faceKeys.some((key) => key.includes("concrete"))
);
check(
  "EXCLUSIONS 47 no fixing requirement",
  !faceKeys.some((key) => key.includes("fixing")) &&
    faceDeck.lineItems.some(
      (item) =>
        item.itemKey === "deck.fixings.m2" ||
        /Fixings/i.test(item.label)
    )
);

const calcFiles = walkTs(join("lib", "estimate", "calculators"));
const emitting = calcFiles.filter((p) => {
  const text = readFileSync(p, "utf8");
  return text.includes("requirements:");
});
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
check(
  "EXCLUSIONS 48 no other calculator emits requirements",
  emitting.length === 1 &&
    emitting[0]?.replace(/\\/g, "/").endsWith("calculators/deck.ts") &&
    fence.requirements == null &&
    bathroom.requirements == null &&
    pergola.requirements == null &&
    retaining.requirements == null
);

const migrations = existsSync(join("supabase", "migrations"))
  ? readdirSync(join("supabase", "migrations"))
  : [];
check(
  "PLATFORM 49 no requirement-row commercial migration",
  migrations.some((name) => name.includes("035_estimate_requirement_snapshots")) &&
    !migrations.some((name) => name.includes("035_estimate_requirements.sql"))
);
const uiFiles = walkTs(join("app")).concat(walkTs(join("components")));
check(
  "PLATFORM 50 no UI",
  !uiFiles.some((path) => {
    const text = readFileSync(path, "utf8");
    return (
      text.includes("decking.surface") ||
      text.includes("MaterialRequirement") ||
      text.includes("Materials takeoff")
    );
  })
);
check(
  "PLATFORM 51 no AI call",
  !read("lib/estimate/calculators/deck.ts").includes("anthropic") &&
    !read("lib/estimate/deck-surface-requirement.ts").includes("generateText")
);
check(
  "PLATFORM 52 no Production SD",
  isScopeDiscoveryEnabled({}) === false
);

check(
  "VALIDATE priced true + resolved values",
  quotrReq != null &&
    quotrReq.priced === true &&
    quotrReq.unitCost != null &&
    quotrReq.totalCost != null
);
check(
  "VALIDATE priced false + missing values",
  missingReq?.priced === false &&
    missingReq.unitCost === null &&
    missingReq.totalCost === null
);
check(
  "VALIDATE no negative quantities",
  (quotrReq?.baseQuantity ?? -1) >= 0 && (quotrReq?.purchaseQuantity ?? -1) >= 0
);
check("VALIDATE confidence is medium", quotrReq?.confidence === "medium");
check(
  "VALIDATE assumptions present",
  quotrReq?.assumptions.some((item) => item.key === "decking.coverage_width") ===
    true &&
    quotrReq.assumptions.some((item) => item.key === "decking.waste_factor") ===
      true
);
check(
  "VALIDATE single Deck collects one MaterialRequirement",
  (quotrEstimate.requirements ?? []).filter((item) => item.kind === "material")
    .length === 1
);
check(
  "VALIDATE Deck 1 golden sell unchanged",
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

console.log(`\n=== REQ-2.1 Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);

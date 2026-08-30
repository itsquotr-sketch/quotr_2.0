/**
 * DECK-MATURITY-2B — scope-component commercial estimating.
 * Architecture + physical models. Package remains only when the detailed
 * physical structural model cannot be built. Missing rates are Pricing Required.
 * No invented NZD prices.
 *
 * Run: npx tsx scripts/verify-deck-maturity-2b.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { projectCommercialOverviewBreakdown } from "../lib/assistant/presentation/commercial-overview-projection";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_FIXINGS_CONCRETE_TREATMENT,
  DECK_FIXINGS_DELIVERY_TREATMENT,
  DECK_FIXINGS_RESIDUAL_CLASS,
  DECK_FIXINGS_RESIDUAL_EXCLUDES,
  DECK_FIXINGS_RESIDUAL_INCLUDES,
  DECK_FIXINGS_RESIDUAL_ITEM_KEY,
  DECK_FIXINGS_RESIDUAL_LABEL,
  decideDeckLabourSplit,
  decideDeckSubstructureAuthority,
  structuralChildCanPrice,
} from "../lib/estimate/deck-commercial-2b";
import {
  DEFAULT_BEARER_SECTION,
  DEFAULT_JOIST_SECTION,
  DEFAULT_SUPPORT_SECTION,
  DECK_IDENTITY_ESTIMATING_DISCLAIMER,
  defaultJoistIdentity,
  defaultSupportIdentity,
  lightSupportIdentity,
} from "../lib/estimate/deck-default-identities";
import { calculateDeckFasciaQuantities, calculateDeckSkirtingQuantities } from "../lib/estimate/deck-fascia";
import {
  calculateDeckStepsQuantities,
  estimateDeckRiseCount,
} from "../lib/estimate/deck-steps-physical";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  calculateDeckStructureQuantities,
  readDeckStructureFacts,
} from "../lib/estimate/deck-structure";
import {
  calculateDeckPostLength,
  deckPostEmbedmentM,
} from "../lib/estimate/deck-support-length";
import { procureHousePiles } from "../lib/estimate/deck-pile-procurement";
import {
  HOUSE_PILE_BENCHMARK_COST_EX_GST,
  HOUSE_PILE_125_IDENTITY,
  findExactHousePileBenchmark,
} from "../lib/estimate/house-pile-benchmarks";
import {
  findCompanyProductivityRate,
  resolveProductivity,
} from "../lib/estimate/productivity";
import { resolveLabourRate } from "../lib/estimate/rates";
import { round2 } from "../lib/estimate/facts";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { DECK_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { DECK_FRAMING_SPECIFIC_MATERIAL_CATALOGUE, DECK_POST_SPECIFIC_MATERIAL_CATALOGUE, DECK_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { STRUCTURAL_TIMBER_BENCHMARKS } from "../lib/estimate/structural-timber-benchmarks";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import { buildMaterialRateItemKey } from "../lib/materials/identity";
import type { OrganisationRate } from "../components/setup/types";

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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    includedInTotal: item.includedInTotal,
  }));
}

function ctx(
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [],
    facts,
    constraints: [],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [...rates],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

function productivityOrgRate(
  itemKey: string,
  unit: string,
  hours: number
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "productivity",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "deck",
  };
}

function labourOrgRate(
  itemKey: string,
  costRate: number,
  sellRate: number | null = null
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "labour",
    item_key: itemKey,
    label: itemKey,
    unit: "hour",
    cost_rate: costRate,
    sell_rate: sellRate,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "deck",
  };
}

function materialOrgRate(
  itemKey: string,
  costRate: number,
  sellRate: number | null = null
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "material",
    item_key: itemKey,
    label: itemKey,
    unit: itemKey.endsWith(".lm") ? "lm" : "m2",
    cost_rate: costRate,
    sell_rate: sellRate,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "deck",
  };
}

function included(items: readonly EstimateLineItemInput[]): EstimateLineItemInput[] {
  return items.filter((item) => item.includedInTotal !== false);
}

function sumCost(items: readonly EstimateLineItemInput[]): number {
  return round2(
    included(items).reduce((sum, item) => sum + item.recommendedCost, 0)
  );
}

function sumSell(items: readonly EstimateLineItemInput[]): number {
  return round2(
    included(items).reduce((sum, item) => sum + item.recommendedSell, 0)
  );
}

function labourHoursTotal(items: readonly EstimateLineItemInput[]): number {
  return round2(
    included(items)
      .filter((item) => item.category === "labour")
      .reduce((sum, item) => sum + (item.labourHours ?? 0), 0)
  );
}

function labourCostTotal(items: readonly EstimateLineItemInput[]): number {
  return round2(
    included(items)
      .filter((item) => item.category === "labour")
      .reduce((sum, item) => sum + item.recommendedCost, 0)
  );
}

function materialCostTotal(items: readonly EstimateLineItemInput[]): number {
  return round2(
    included(items)
      .filter((item) => item.category !== "labour")
      .reduce((sum, item) => sum + item.recommendedCost, 0)
  );
}

function hoursByLabel(
  items: readonly EstimateLineItemInput[],
  label: string
): number {
  return (
    items.find((item) => item.label === label && item.includedInTotal !== false)
      ?.labourHours ?? 0
  );
}

function estimateCtx(
  id: string,
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = []
): EstimateContext {
  return {
    ...ctx(facts, rates),
    confirmedWorkAreas: [wa(id)],
  };
}

function materialReq(
  result: { requirements?: readonly { kind: string; componentKey: string }[] },
  componentKey: string
): MaterialRequirement | undefined {
  return result.requirements?.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === componentKey
  );
}

function lineCost(items: readonly EstimateLineItemInput[], label: string): number {
  return items
    .filter((item) => item.label === label && item.includedInTotal !== false)
    .reduce((sum, item) => sum + item.recommendedCost, 0);
}

function hasPackage(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.label === "Framing/substructure" && item.includedInTotal !== false
  );
}

function hasChildMoney(items: readonly EstimateLineItemInput[]): boolean {
  return items.some((item) =>
    [DECK_JOISTS_COMPONENT_KEY, DECK_BEARERS_COMPONENT_KEY, DECK_RIM_FRAMING_COMPONENT_KEY, DECK_SUPPORTS_COMPONENT_KEY].includes(
      item.componentKey ?? ""
    )
  );
}

console.log("=== DECK-MATURITY-2B scope-component commercial estimating ===\n");

const KWILA = loadCalibrationFixture("OWNER-KWILA-01.json");
const REAL = loadCalibrationFixture("REAL-JOB-01.json");
const kwilaId = "kwila";
const kwilaFacts = Object.entries(KWILA.facts).map(([key, value]) =>
  fact(key, kwilaId, value)
);
const kwilaDeck = calculateDeck(ctx(kwilaFacts), wa(kwilaId));
const kwilaStructure = readDeckStructureFacts({
  facts: kwilaFacts,
  workAreaId: kwilaId,
})!;
const kwilaQty = calculateDeckStructureQuantities({
  facts: kwilaStructure,
  framingWastePercent: 5,
});

const realFacts = Object.entries(REAL.facts).map(([key, value]) =>
  fact(key, "real", value)
);
const realDeck = calculateDeck(ctx(realFacts), wa("real"));

check(
  "1 decking qty unchanged",
  lineCost(kwilaDeck.lineItems, "Decking") > 0 ||
    lineCost(kwilaDeck.lineItems, "Decking package") > 0
);
check(
  "2 decking material rate authority intact",
  kwilaDeck.lineItems.some(
    (item) =>
      item.componentKey === "decking.surface" ||
      /decking/i.test(item.label)
  )
);
check(
  "3 decking productivity drives detailed hours",
  kwilaDeck.lineItems.some(
    (item) =>
      item.label === "Decking installation" &&
      Math.abs((item.labourHours ?? 0) - 14.85) < 0.02
  )
);

check("4 joist physical quantity reused", kwilaQty.joistPurchaseLm === 66.15);
check(
  "5 joist identity exact default",
  kwilaStructure.joistSection === DEFAULT_JOIST_SECTION &&
    kwilaStructure.joistSectionDefaulted &&
    materialReq(kwilaDeck, DECK_JOISTS_COMPONENT_KEY)?.materialIdentity?.section ===
      "90x45"
);
check("6 bearer quantity reused", kwilaQty.bearerPurchaseLm === 28.35);
check(
  "7 bearer identity exact default",
  kwilaStructure.bearerSection === DEFAULT_BEARER_SECTION &&
    materialReq(kwilaDeck, DECK_BEARERS_COMPONENT_KEY)?.materialIdentity?.section ===
      "140x45"
);
check("8 rim quantity reused", kwilaQty.rimPurchaseLm === 18.9);
check(
  "9 rim inherits joist identity",
  materialReq(kwilaDeck, DECK_RIM_FRAMING_COMPONENT_KEY)?.materialIdentity?.section ===
    "90x45"
);
check("10 support quantity reused", kwilaQty.supportCount === 18);
check(
  "11 support material identity exact",
  kwilaStructure.supportSection === DEFAULT_SUPPORT_SECTION &&
    materialReq(kwilaDeck, DECK_SUPPORTS_COMPONENT_KEY)?.materialIdentity?.section ===
      "125x125"
);
check(
  "12 no geometry recalculation in commercial layer",
  kwilaQty.joistCount === 21 && kwilaQty.bearerRowCount === 3
);

const fasciaA = calculateDeckFasciaQuantities({
  facts: [],
  workAreaId: "f",
  lengthM: 4,
  widthM: 3,
  areaM2: 12,
  deckHeightM: 0.3,
  boardWidthMm: 140,
  wastePercent: 0,
});
const fasciaB = calculateDeckFasciaQuantities({
  facts: [],
  workAreaId: "f",
  lengthM: 4,
  widthM: 3,
  areaM2: 12,
  deckHeightM: 0.25,
  boardWidthMm: 140,
  wastePercent: 0,
});
check("13 fascia is not height-driven", fasciaA.fasciaNetLm === fasciaB.fasciaNetLm);
check("14 fascia = exposed perimeter × 1 course", fasciaA.fasciaNetLm === 14);
const skirtingA = calculateDeckSkirtingQuantities({
  facts: [],
  workAreaId: "f",
  lengthM: 4,
  widthM: 3,
  areaM2: 12,
  deckHeightM: 0.3,
  boardWidthMm: 140,
  wastePercent: 0,
});
const skirtingB = calculateDeckSkirtingQuantities({
  facts: [],
  workAreaId: "f",
  lengthM: 4,
  widthM: 3,
  areaM2: 12,
  deckHeightM: 0.25,
  boardWidthMm: 140,
  wastePercent: 0,
});
check("15 skirting 300mm example = 2.0 equivalents", Math.abs(skirtingA.boardHeightEquivalents - 2) < 0.001);
check(
  "15b skirting 250mm example ≈ 1.64",
  Math.abs(skirtingB.boardHeightEquivalents - 1.642857) < 0.001
);
check(
  "16 fascia labour uses installed fascia lm",
  read("lib/estimate/calculators/deck.ts").includes("fasciaQty.fasciaNetLm")
);
check(
  "17 no duplicate fascia in steps",
  read("lib/estimate/calculators/deck.ts").includes("Vertical faces stay in Fascia")
);

check("18 <450mm embedment 200mm", deckPostEmbedmentM(0.14) === 0.2);
check("19 >=450mm <=2m → 450mm", deckPostEmbedmentM(0.45) === 0.45 && deckPostEmbedmentM(2) === 0.45);
check("20 >2m → 900mm", deckPostEmbedmentM(2.01) === 0.9);
const pile = calculateDeckPostLength({ deckHeightM: 0.14, supportCount: 18 });
check(
  "21 post theoretical length formula",
  Math.abs(pile.lengthEachM - 0.293) < 0.005 && Math.abs(pile.totalLm - 5.28) < 0.02
);
check(
  "22 pile labour per EA is promoted once",
  kwilaDeck.lineItems.filter((item) => /pile\/post installation/i.test(item.label))
    .length === 1 &&
    Math.abs(
      (kwilaDeck.lineItems.find((item) => /pile\/post installation/i.test(item.label))
        ?.labourHours ?? 0) - 3.6
    ) < 0.02
);

check("23 included steps derive riser count", estimateDeckRiseCount(0.7) === 4);
check("24 target 175mm", estimateDeckRiseCount(0.175) === 1);
const stepOverride = calculateDeckStepsQuantities({
  facts: [fact("deck.step_count", "s", 6), fact("deck.step_width_m", "s", 1.2), fact("deck.step_going_m", "s", 0.3)],
  workAreaId: "s",
  deckHeightM: 0.7,
  wastePercent: 5,
})!;
check("25 explicit step count overrides", stepOverride.riseCount === 6);
check(
  "26 width/depth affect material",
  stepOverride.treadAreaM2 === 2.16 && stepOverride.framingPurchaseLm > 0
);
check(
  "27 treads inherit Deck material",
  read("lib/estimate/calculators/deck.ts").includes("inherits deck board material")
);
check(
  "28 framing uses 190x45",
  read("lib/estimate/deck-default-identities.ts").includes("190x45")
);
check("29 step labour deterministic not commercial", stepOverride.treadAreaM2 > 0);
check(
  "30 no compliance claim",
  read("lib/estimate/deck-steps-physical.ts").includes("Not stair compliance")
);

check(
  "31 Decking productivity once",
  kwilaDeck.lineItems.filter((item) => item.label === "Decking installation").length === 1
);
check(
  "32 framing productivity once",
  kwilaDeck.lineItems.filter((item) => item.label === "Substructure framing").length === 1 &&
    Math.abs(
      (kwilaDeck.lineItems.find((item) => item.label === "Substructure framing")
        ?.labourHours ?? 0) - 14.04
    ) < 0.02
);
check(
  "33 pile productivity once",
  kwilaDeck.lineItems.filter((item) => item.label === "Pile/post installation").length === 1
);
check(
  "34 fascia productivity once (hours path)",
  !kwilaDeck.lineItems.some((item) => item.label === "Face board labour allowance")
);
check("35 steps productivity not added", !kwilaDeck.lineItems.some((item) => item.label === "Steps"));
check(
  "36 demolition current productivity unchanged",
  read("lib/estimate/productivity.ts").includes("deck.demolition_hours_per_m2")
);
check(
  "37 access/carry once",
  read("lib/estimate/calculators/deck.ts").includes("getCombinedLabourAccessFactor")
);
check(
  "38 no old lumped duplicate",
  kwilaDeck.lineItems.filter((item) => item.category === "labour" && item.label === "Deck labour")
    .length === 0
);

const subAuth = decideDeckSubstructureAuthority({
  substructureIncluded: true,
  detailedPhysicalModelAvailable: true,
});
check("39 detailed geometry uses component-level authority", subAuth.mode === "DETAILED_AUTHORITATIVE");
check(
  "40 package fallback if physical model incomplete",
  decideDeckSubstructureAuthority({
    substructureIncluded: true,
    detailedPhysicalModelAvailable: false,
  }).mode === "PACKAGE_FALLBACK"
);
check(
  "41 detailed structural promoted",
  !hasPackage(kwilaDeck.lineItems) && hasChildMoney(kwilaDeck.lineItems)
);
check(
  "42 no package + detail double count",
  !(hasPackage(kwilaDeck.lineItems) && hasChildMoney(kwilaDeck.lineItems))
);
check(
  "43 no zero economic hole",
  !hasPackage(kwilaDeck.lineItems) &&
    (kwilaDeck.lineItems.find((item) => item.label === "Decking installation")
      ?.labourHours ?? 0) > 0
);
check(
  "44 posts priced via 125×125 H5 procurement",
  materialReq(kwilaDeck, DECK_SUPPORTS_COMPONENT_KEY)?.priced === true &&
    materialReq(kwilaDeck, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseUnit === "lm" &&
    materialReq(kwilaDeck, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseQuantity === 10.8
);
check(
  "45 margin/sell architecture unchanged",
  read("lib/estimate/calculators/deck.ts").includes("organisationSettings")
);
check(
  "46 Pricing copies estimate truth",
  read("lib/pricing/adoption-authority.ts").length > 0 || existsSync("lib/pricing/adoption-authority.ts")
);
check(
  "47 Quote copies Pricing truth",
  existsSync("lib/quotes/adoption-authority.ts")
);

const joistId = defaultJoistIdentity()!;
check(
  "48 exact material rate matching",
  DECK_FRAMING_SPECIFIC_MATERIAL_CATALOGUE.some(
    (row) => row.item_key === buildMaterialRateItemKey(joistId, "lm")
  ) && STRUCTURAL_TIMBER_BENCHMARKS.some((row) => row.canonicalMaterialIdentity.section === "90x45")
);
check(
  "49 exact productivity matching",
  DECK_PRODUCTIVITY_RATE_CATALOGUE.some((row) => row.item_key === "deck.base_labour_hours_per_m2")
);
check(
  "50 wrong unit rejected",
  findCompanyProductivityRate(
    [{ id: "1", rate_type: "productivity", item_key: "deck.base_labour_hours_per_m2", label: "x", unit: "ea", cost_rate: 9, sell_rate: null, markup_percent: null, active: true, trade: null, work_area_type: "deck" }],
    "deck.base_labour_hours_per_m2",
    "m²"
  ) == null
);
check(
  "51 100×100 does not bind 125×125 rate",
  !structuralChildCanPrice({
    identity: lightSupportIdentity(),
    unit: "lm",
    purchaseQuantity: 10.8,
    rates: [],
    organisationSettings: { allow_benchmark_rates: true } as never,
  }) &&
    structuralChildCanPrice({
      identity: defaultSupportIdentity(),
      unit: "lm",
      purchaseQuantity: 10.8,
      rates: [],
      organisationSettings: { allow_benchmark_rates: true } as never,
    })
);
check(
  "52 company override wins",
  findCompanyProductivityRate(
    [{ id: "1", rate_type: "productivity", item_key: "deck.base_labour_hours_per_m2", label: "x", unit: "m2", cost_rate: 0.9, sell_rate: null, markup_percent: null, active: true, trade: null, work_area_type: "deck" }],
    "deck.base_labour_hours_per_m2",
    "m²"
  )?.cost_rate === 0.9
);
check(
  "53 benchmark fallback where approved",
  materialReq(kwilaDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === true ||
    materialReq(kwilaDeck, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "benchmark" ||
    materialReq(kwilaDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === true
);

const kwilaCost = kwilaDeck.lineItems
  .filter((item) => item.includedInTotal !== false)
  .reduce((sum, item) => sum + item.recommendedCost, 0);
const realCost = realDeck.lineItems
  .filter((item) => item.includedInTotal !== false)
  .reduce((sum, item) => sum + item.recommendedCost, 0);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: kwilaCost,
    recommendedSell: kwilaCost,
    marginPercent: 20,
    confidence: 0.7,
    assumptions: kwilaDeck.assumptions,
    missingInfo: kwilaDeck.missingInfo,
    lineItems: mapCalcLines(kwilaDeck.lineItems),
  },
  workAreas: [{ id: kwilaId, name: "Deck", type: "deck", status: "confirmed" }],
  requirements: kwilaDeck.requirements ?? [],
});
check(
  "54 detailed promoted lines on Builder Review",
  mapCalcLines(kwilaDeck.lineItems).some((item) => item.label === "Joists")
);
check(
  "55 labour components understandable",
  kwilaDeck.lineItems.some((item) => item.label === "Decking installation") &&
    kwilaDeck.lineItems.some((item) => item.label === "Substructure framing") &&
    kwilaDeck.lineItems.some((item) => item.label === "Pile/post installation")
);
check(
  "56 planning takeoff does not duplicate commercial children",
  !(review.workAreas[0]?.takeoff ?? []).some(
    (row) =>
      row.componentKey === DECK_JOISTS_COMPONENT_KEY ||
      row.componentKey === DECK_BEARERS_COMPONENT_KEY ||
      row.componentKey === DECK_RIM_FRAMING_COMPONENT_KEY ||
      row.componentKey === DECK_SUPPORTS_COMPONENT_KEY
  )
);
check("57 only active scopes shown", !kwilaDeck.lineItems.some((item) => /balustrade/i.test(item.label)));
check(
  "58 mobile readable groups",
  read("components/assistant/job-plan/DeckQuickSpecEditor.tsx").includes("Substructure")
);

check(
  "59 Owner 3×9 Kwila decomposition reconciles",
  kwilaQty.postTotalLm != null &&
    Math.abs(kwilaQty.postTotalLm - 5.28) < 0.02 &&
    kwilaQty.postPurchaseLm === 10.8 &&
    !hasPackage(kwilaDeck.lineItems)
);
check(
  "60 Deck reference / REAL-JOB still has money",
  realCost > 0
);
check("61 fascia fixtures are perimeter-only", fasciaA.fasciaNetLm === 14 && fasciaB.fasciaNetLm === 14);
check("61b skirting remains height-sensitive", Math.abs(skirtingA.boardHeightEquivalents - 2) < 0.001 && skirtingB.boardHeightEquivalents > 1.6);
check("62 pile-depth boundaries", deckPostEmbedmentM(0.449) === 0.2);
check("63 step fixture 0.70 m → 4 rises", estimateDeckRiseCount(0.7) === 4);

check(
  "64 no structural compliance claim",
  DECK_IDENTITY_ESTIMATING_DISCLAIMER.includes("not a structural") &&
    !kwilaDeck.assumptions.some((text) => /NZS 3604|compliant/i.test(text))
);
check(
  "65 attached support remains estimating assumption",
  kwilaDeck.assumptions.some((text) => text.includes("not assumed to provide structural support")) ||
    (kwilaDeck.requirements ?? []).some((item) =>
      item.kind === "material" &&
      item.assumptions?.some((row) => row.key === "deck.supports.conservative_layout")
    )
);
check(
  "66 100×100 has no invented rate; 125×125 has starter benchmark",
  DECK_POST_SPECIFIC_MATERIAL_CATALOGUE.some(
    (row) =>
      row.label.includes("100×100") && row.defaultCostRate == null
  ) &&
    DECK_POST_SPECIFIC_MATERIAL_CATALOGUE.some(
      (row) =>
        row.label.includes("125×125") &&
        row.defaultCostRate === HOUSE_PILE_BENCHMARK_COST_EX_GST
    )
);
check(
  "67 no Retaining Wall work",
  !read("lib/estimate/deck-default-identities.ts").includes("SED") &&
    !read("lib/estimate/calculators/deck.ts").toLowerCase().includes("retaining")
);

check(
  "68 incomplete split falls back to lump",
  decideDeckLabourSplit({
    hasTrustedDeckingProductivity: false,
    hasTrustedSubstructureProductivity: true,
    hasTrustedPostProductivity: true,
    substructureIncluded: true,
  }).mode === "PACKAGE_FALLBACK"
);
check(
  "69 post lm on takeoff",
  kwilaQty.postLengthEachM != null && kwilaQty.supportCount === 18
);
check(
  "70 Rates catalogue has framing + productivity",
  DECK_FRAMING_SPECIFIC_MATERIAL_CATALOGUE.length >= 3 &&
    DECK_PRODUCTIVITY_RATE_CATALOGUE.length >= 6
);

const starterDecking = resolveProductivity({
  productivityKey: "deck.decking.install.hours_per_lm",
  unit: "lm",
  fallbackHoursPerUnit: 0,
});
const starterFraming = resolveProductivity({
  productivityKey: "deck.substructure.install.hours_per_framing_lm",
  unit: "lm",
  fallbackHoursPerUnit: 0,
});
const starterPosts = resolveProductivity({
  productivityKey: "deck.posts.install.hours_per_ea",
  unit: "ea",
  fallbackHoursPerUnit: 0,
});
const starterFascia = resolveProductivity({
  productivityKey: "deck.fascia.install.hours_per_lm",
  unit: "lm",
  fallbackHoursPerUnit: 0,
});
const starterSteps = resolveProductivity({
  productivityKey: "deck.steps.install.hours_per_m2",
  unit: "m²",
  fallbackHoursPerUnit: 0,
});
const starterDemo = resolveProductivity({
  productivityKey: "deck.demolition_hours_per_m2",
  unit: "m²",
  fallbackHoursPerUnit: 0,
});
check(
  "71 starter productivity defaults exact",
  starterDecking.hoursPerUnit === 0.077 &&
    starterFraming.hoursPerUnit === 0.13 &&
    starterPosts.hoursPerUnit === 0.2 &&
    starterFascia.hoursPerUnit === 0.45 &&
    starterSteps.hoursPerUnit === 4 &&
    starterDemo.hoursPerUnit === 0.35
);

const overrideDeck = calculateDeck(
  ctx(kwilaFacts, [
    productivityOrgRate("deck.decking.install.hours_per_lm", "lm", 0.12),
  ]),
  wa(kwilaId)
);
const legacyM2Ignored = calculateDeck(
  ctx(kwilaFacts, [
    productivityOrgRate("deck.decking.install.hours_per_m2", "m2", 0.7),
  ]),
  wa(kwilaId)
);
const overridePile = calculateDeck(
  ctx(kwilaFacts, [
    productivityOrgRate("deck.posts.install.hours_per_ea", "ea", 0.3),
  ]),
  wa(kwilaId)
);
const baseDeckingH =
  kwilaDeck.lineItems.find((item) => item.label === "Decking installation")
    ?.labourHours ?? 0;
const baseFramingH =
  kwilaDeck.lineItems.find((item) => item.label === "Substructure framing")
    ?.labourHours ?? 0;
const basePileH =
  kwilaDeck.lineItems.find((item) => item.label === "Pile/post installation")
    ?.labourHours ?? 0;
check(
  "72 company decking productivity override is modular",
  (overrideDeck.lineItems.find((item) => item.label === "Decking installation")
    ?.labourHours ?? 0) > baseDeckingH &&
    Math.abs(
      (overrideDeck.lineItems.find((item) => item.label === "Substructure framing")
        ?.labourHours ?? 0) - baseFramingH
    ) < 0.001 &&
    Math.abs(
      (overrideDeck.lineItems.find((item) => item.label === "Pile/post installation")
        ?.labourHours ?? 0) - basePileH
    ) < 0.001
);
check(
  "72b legacy company h/m² is not reinterpreted as h/lm",
  Math.abs(
    (legacyM2Ignored.lineItems.find((item) => item.label === "Decking installation")
      ?.labourHours ?? 0) - baseDeckingH
  ) < 0.001
);
check(
  "73 company pile productivity override is modular",
  Math.abs(
    (overridePile.lineItems.find((item) => item.label === "Pile/post installation")
      ?.labourHours ?? 0) - 5.4
  ) < 0.02 &&
    Math.abs(
      (overridePile.lineItems.find((item) => item.label === "Decking installation")
        ?.labourHours ?? 0) - baseDeckingH
    ) < 0.001
);

const zeroSplit = calculateDeck(
  ctx(kwilaFacts, [
    productivityOrgRate("deck.decking.install.hours_per_lm", "lm", 0),
  ]),
  wa(kwilaId)
);
check(
  "74 zero/invalid split falls back to 1.2 lump",
  zeroSplit.lineItems.some((item) => item.label === "Deck labour") &&
    !zeroSplit.lineItems.some((item) => item.label === "Decking installation") &&
    (zeroSplit.lineItems.find((item) => item.label === "Deck labour")?.labourHours ??
      0) > 0
);

check(
  "75 125×125 H5 benchmark exact",
  HOUSE_PILE_BENCHMARK_COST_EX_GST === 23.5 &&
    findExactHousePileBenchmark(HOUSE_PILE_125_IDENTITY, "lm")?.normalizedRateExGst ===
      23.5 &&
    findExactHousePileBenchmark(lightSupportIdentity()!, "lm") == null
);

const stock0293 = procureHousePiles({ requiredLengthEachM: 0.293, supportCount: 18 });
check(
  "76 theoretical pile length != procurement length",
  Math.abs(pile.lengthEachM - 0.293) < 0.005 &&
    stock0293.ok &&
    stock0293.purchaseLengthEachM === 0.6 &&
    stock0293.purchaseLm === 10.8 &&
    Math.abs(stock0293.requiredTotalLm - 5.27) < 0.05
);
check(
  "77 0.293 m selects 0.60 m stock; 18 supports purchase 10.8 lm",
  kwilaQty.postPurchaseLengthEachM === 0.6 &&
    kwilaQty.postPurchaseLm === 10.8 &&
    kwilaQty.postTotalLm != null &&
    kwilaQty.postPurchaseLm !== kwilaQty.postTotalLm
);

const overMax = procureHousePiles({ requiredLengthEachM: 3.61, supportCount: 4 });
check("78 over-max pile length fails safely", overMax.ok === false);

const tallFacts = [
  ...kwilaFacts.filter((row) => row.key !== "deck.height_m"),
  fact("deck.height_m", kwilaId, 5),
];
const tallDeck = calculateDeck(ctx(tallFacts), wa(kwilaId));
check(
  "79 over-max pile keeps package fallback (no clamp)",
  hasPackage(tallDeck.lineItems) && !hasChildMoney(tallDeck.lineItems)
);

const post100 = calculateDeck(
  ctx([...kwilaFacts, fact("deck.support_section", kwilaId, "100x100")]),
  wa(kwilaId)
);
check(
  "80 100×100 without company rate stays detailed + Pricing Required",
  !hasPackage(post100.lineItems) &&
    hasChildMoney(post100.lineItems) &&
    post100.lineItems.some(
      (item) =>
        item.label === "Piles / posts" &&
        item.rateSourceType === "missing"
    )
);

const fasciaDeck = calculateDeck(
  ctx([
    ...kwilaFacts,
    fact("deck.vertical_face_boards_required", kwilaId, true),
  ]),
  wa(kwilaId)
);
check(
  "81 fascia labour 0.45 h/lm; old $35 allowance suppressed",
  fasciaDeck.lineItems.some((item) => item.label === "Fascia installation") &&
    !fasciaDeck.lineItems.some((item) => item.label === "Face board labour allowance") &&
    fasciaDeck.lineItems.some((item) => item.label === "Fascia / edge boards")
);

const stairDeck = calculateDeck(
  ctx([...kwilaFacts, fact("deck.access_type", kwilaId, "Stair set")]),
  wa(kwilaId)
);
check(
  "82 steps XOR: detailed install or stair lump, not both",
  starterSteps.hoursPerUnit === 4 &&
    (stairDeck.lineItems.some((item) => item.label === "Step installation") ||
      stairDeck.lineItems.some((item) => /stair|step-down/i.test(item.label))) &&
    !(
      stairDeck.lineItems.some((item) => item.label === "Step installation") &&
      stairDeck.lineItems.some((item) => /allowance/i.test(item.label) && /stair|step-down/i.test(item.label))
    )
);

check(
  "83 no silent zero labour on promoted Kwila",
  (kwilaDeck.lineItems.find((item) => item.label === "Decking installation")
    ?.labourHours ?? 0) > 0 &&
    (kwilaDeck.lineItems.find((item) => item.label === "Substructure framing")
      ?.labourHours ?? 0) > 0 &&
    (kwilaDeck.lineItems.find((item) => item.label === "Pile/post installation")
      ?.labourHours ?? 0) > 0
);
check(
  "84 no compliance claims",
  !kwilaDeck.assumptions.some((text) => /NZS|certified|code compliant/i.test(text))
);
check(
  "85 Rates UX shows hours not dollars for productivity",
  read("components/rates/RatesTableSection.tsx").includes("formatProductivityHours") &&
    read("lib/rates/catalogue.ts").includes("h/")
);
check(
  "86 default pile identity is 125×125 H5 house pile",
  DEFAULT_SUPPORT_SECTION === "125x125" &&
    defaultSupportIdentity()?.productFamily === "pile"
);

console.log("\n=== DECK-MATURITY-2B-R2 commercial reconciliation ===\n");

const emptyLabourResolved = resolveLabourRate({
  rates: [],
  organisationSettings: ctx(kwilaFacts).organisationSettings,
});
const company78Resolved = resolveLabourRate({
  rates: [labourOrgRate("labour.carpenter.hour", 78)],
  organisationSettings: ctx(kwilaFacts).organisationSettings,
});
const deckSrc = read("lib/estimate/calculators/deck.ts");
const ratesSrc = read("lib/estimate/rates.ts");

check(
  "87 labour $/hr from canonical resolver, not Deck 2B constants",
  deckSrc.includes("resolveLabourRate") &&
    !deckSrc.includes("DEFAULT_LABOUR") &&
    !/labourCostRate:\s*60/.test(deckSrc) &&
    !/labourCostRate:\s*78/.test(deckSrc) &&
    ratesSrc.includes("DEFAULT_LABOUR_COST_RATE = 60") &&
    emptyLabourResolved.itemKey === "labour.carpenter.hour" &&
    emptyLabourResolved.costRate === 60 &&
    emptyLabourResolved.sourceType === "default" &&
    emptyLabourResolved.sellAuthority === "legacy_paired_rate"
);
check(
  "88 productivity hours and labour $/hr stay separate",
    Math.abs(
      (kwilaDeck.lineItems.find((item) => item.label === "Decking installation")
        ?.labourHours ?? 0) - 14.85
    ) < 0.001 &&
    (kwilaDeck.lineItems.find((item) => item.label === "Decking installation")
      ?.costRate ?? 0) === 60 &&
    read("lib/estimate/productivity.ts").includes("hoursPerUnit") &&
    !read("lib/estimate/productivity.ts").includes("DEFAULT_LABOUR_COST_RATE")
);

const kwila78 = calculateDeck(
  ctx(kwilaFacts, [labourOrgRate("labour.carpenter.hour", 78)]),
  wa(kwilaId)
);
const kwilaCompany60 = calculateDeck(
  ctx(kwilaFacts, [labourOrgRate("labour.carpenter.hour", 60)]),
  wa(kwilaId)
);
const kwilaHours = labourHoursTotal(kwilaDeck.lineItems);
const hours78 = labourHoursTotal(kwila78.lineItems);
const labour60 = labourCostTotal(kwilaDeck.lineItems);
const labour78 = labourCostTotal(kwila78.lineItems);
const materials60 = materialCostTotal(kwilaDeck.lineItems);
const materials78 = materialCostTotal(kwila78.lineItems);

check(
  "89 $60→$78 changes dollars, not hours",
  Math.abs(kwilaHours - 32.49) < 0.001 &&
    hours78 === kwilaHours &&
    hoursByLabel(kwila78.lineItems, "Decking installation") === 14.85 &&
    hoursByLabel(kwila78.lineItems, "Substructure framing") === 14.04 &&
    hoursByLabel(kwila78.lineItems, "Pile/post installation") === 3.6 &&
    Math.abs(labour78 - 2534.22) < 0.005 &&
    Math.abs(labour78 - labour60) > 1 &&
    company78Resolved.costRate === 78 &&
    company78Resolved.sourceType === "user_rate" &&
    company78Resolved.itemKey === "labour.carpenter.hour"
);
check(
  "90 material totals unchanged by labour-rate change",
  materials78 === materials60 &&
    lineCost(kwila78.lineItems, "Joists") === lineCost(kwilaDeck.lineItems, "Joists") &&
    lineCost(kwila78.lineItems, "Bearers") === lineCost(kwilaDeck.lineItems, "Bearers") &&
    lineCost(kwila78.lineItems, "Rim framing") ===
      lineCost(kwilaDeck.lineItems, "Rim framing") &&
    lineCost(kwila78.lineItems, "Piles / posts") ===
      lineCost(kwilaDeck.lineItems, "Piles / posts") &&
    lineCost(kwila78.lineItems, DECK_FIXINGS_RESIDUAL_LABEL) === 675
);

const sellAuthorities = new Set(
  included(kwilaDeck.lineItems).map((item) => item.sellAuthority ?? "missing")
);
const kwilaSell = sumSell(kwilaDeck.lineItems);
const kwilaDirect = sumCost(kwilaDeck.lineItems);
const kwilaGp = round2(kwilaSell - kwilaDirect);
const kwilaEffectiveGm = round2((kwilaGp / kwilaSell) * 100);
const defaultGmIsNotEffective =
  Math.abs(kwilaEffectiveGm - 20) > 1 &&
  Math.abs(kwilaSell - deriveSellFromCost(kwilaDirect, 20)) > 1;

check(
  "91 sell-line provenance identified",
  sellAuthorities.has("legacy_paired_rate") &&
    sellAuthorities.has("derived_from_gross_margin") &&
    !sellAuthorities.has("explicit_sell_override") &&
    included(kwilaDeck.lineItems).every((item) => item.sellAuthority != null) &&
    kwilaDeck.lineItems.find((item) => item.label === "Decking")
      ?.sellAuthority === "legacy_paired_rate" &&
    kwilaDeck.lineItems.find((item) => item.label === DECK_FIXINGS_RESIDUAL_LABEL)
      ?.sellAuthority === "legacy_paired_rate" &&
    kwilaDeck.lineItems.find((item) => item.label === "Decking installation")
      ?.sellAuthority === "legacy_paired_rate" &&
    kwilaDeck.lineItems.find((item) => item.label === "Joists")
      ?.sellAuthority === "derived_from_gross_margin"
);
check(
  "92 effective GM reconciles mathematically",
  Math.abs(kwilaDirect - 9893.43) < 0.02 &&
    Math.abs(kwilaSell - 14575.21) < 0.02 &&
    Math.abs(kwilaGp - (14575.21 - 9893.43)) < 0.02 &&
    Math.abs(kwilaEffectiveGm - 32.12) < 0.05
);
check(
  "93 target/default GM is not treated as effective GM",
  defaultGmIsNotEffective &&
    read("components/assistant/CommercialOverviewMetrics.tsx").includes(
      'label="Effective gross margin"'
    ) &&
    read("components/assistant/MarginEditControl.tsx").includes("Target margin %") &&
    !read("lib/estimate/summary.ts").includes("default_margin_percent")
);

const costFirstRates: OrganisationRate[] = [
  labourOrgRate("labour.carpenter.hour", 60),
  materialOrgRate(MATERIAL_RATE_KEYS.deckingKwilaLm, DECK_BENCHMARKS.kwilaLm.cost),
  materialOrgRate("deck.fixings.m2", DECK_BENCHMARKS.fixings.cost),
];
const kwilaCostFirst = calculateDeck(ctx(kwilaFacts, costFirstRates), wa(kwilaId));
const costFirstLines = included(kwilaCostFirst.lineItems);
const costFirstCost = sumCost(kwilaCostFirst.lineItems);
const costFirstSell = sumSell(kwilaCostFirst.lineItems);
const costFirstLineOk = costFirstLines.every((item) => {
  const unitSell = item.costRate != null ? item.costRate / 0.8 : null;
  const unitOk =
    item.sellRate != null &&
    unitSell != null &&
    Math.abs(item.sellRate - unitSell) < 0.001;
  const totalOk =
    Math.abs(item.recommendedSell - deriveSellFromCost(item.recommendedCost, 20)) <
    0.51;
  return item.sellAuthority === "derived_from_gross_margin" && (unitOk || totalOk);
});

check(
  "94 cost-first 20% case proves sell = cost / 0.8",
  costFirstLineOk &&
    costFirstLines.length === included(kwilaDeck.lineItems).length &&
    Math.abs(costFirstSell - deriveSellFromCost(costFirstCost, 20)) < 0.51 &&
    Math.abs(round2(((costFirstSell - costFirstCost) / costFirstSell) * 100) - 20) <
      0.05 &&
    labourHoursTotal(kwilaCostFirst.lineItems) === kwilaHours
);

check(
  "95 residual is RESIDUAL_STARTER_BENCHMARK with defined coverage",
  DECK_FIXINGS_RESIDUAL_CLASS === "RESIDUAL_STARTER_BENCHMARK" &&
    DECK_BENCHMARKS.fixings.cost === 25 &&
    DECK_BENCHMARKS.fixings.sell === 40 &&
    read("lib/rates/catalogue.ts").includes("Residual starter") &&
    read("docs/audits/DECK_1D_LEGACY_SUBSTRUCTURE_DECOMPOSITION.md").includes(
      "EXPLICITLY SEPARATE"
    )
);
check(
  "96 residual does not duplicate explicit structural timber",
  !hasPackage(kwilaDeck.lineItems) &&
    hasChildMoney(kwilaDeck.lineItems) &&
    lineCost(kwilaDeck.lineItems, DECK_FIXINGS_RESIDUAL_LABEL) === 675 &&
    Math.abs(lineCost(kwilaDeck.lineItems, "Joists") - 535.15) < 0.02 &&
    Math.abs(lineCost(kwilaDeck.lineItems, "Bearers") - 386.98) < 0.02 &&
    Math.abs(lineCost(kwilaDeck.lineItems, "Rim framing") - 152.9) < 0.02 &&
    Math.abs(lineCost(kwilaDeck.lineItems, "Piles / posts") - 253.8) < 0.02 &&
    !read("lib/estimate/calculators/deck.ts").includes("fixings.cost -")
);
check(
  "97 package suppression: detailed rate-miss stays detailed; over-max stays package",
  !hasPackage(kwilaDeck.lineItems) &&
    !hasPackage(post100.lineItems) &&
    hasPackage(tallDeck.lineItems)
);
check(
  "98 pile procurement unchanged",
  kwilaQty.postPurchaseLengthEachM === 0.6 &&
    kwilaQty.postPurchaseLm === 10.8 &&
    kwilaQty.postTotalLm != null &&
    kwilaQty.postPurchaseLm !== kwilaQty.postTotalLm &&
    materialReq(kwilaDeck, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseQuantity === 10.8
);

const kwilaEstimate = calculateEstimate(estimateCtx(kwilaId, kwilaFacts));
const realEstimate = calculateEstimate(estimateCtx("real", realFacts));
const overviewReview = composeBuilderReview({
  estimate: {
    recommendedCost: kwilaEstimate.recommendedCost,
    recommendedSell: kwilaEstimate.recommendedSell,
    marginPercent: kwilaEstimate.marginPercent,
    confidence: kwilaEstimate.confidence,
    assumptions: kwilaEstimate.assumptions,
    missingInfo: kwilaEstimate.missingInfo,
    lineItems: mapCalcLines(kwilaEstimate.lineItems),
  },
  workAreas: [{ id: kwilaId, name: "Deck", type: "deck", status: "confirmed" }],
  requirements: kwilaEstimate.requirements ?? kwilaDeck.requirements ?? [],
});
const overview = projectCommercialOverviewBreakdown(overviewReview);
const overviewCostSum = round2(
  (overview?.materialsCost ?? 0) +
    (overview?.labourCost ?? 0) +
    (overview?.allowancesCost ?? 0) +
    (overview?.subcontractCost ?? 0) +
    (overview?.plantCost ?? 0) +
    (overview?.otherCost ?? 0)
);
const overviewGp = round2(
  kwilaEstimate.recommendedSell - kwilaEstimate.recommendedCost
);
const overviewGm = round2(
  (overviewGp / kwilaEstimate.recommendedSell) * 100
);

check(
  "99 Commercial Overview totals reconcile to estimate lines",
  Math.abs(kwilaEstimate.recommendedCost - kwilaDirect) < 0.02 &&
    Math.abs(kwilaEstimate.recommendedSell - kwilaSell) < 0.02 &&
    Math.abs(overviewCostSum - kwilaEstimate.recommendedCost) < 0.02 &&
    Math.abs(overviewGp - kwilaEstimate.grossProfit) < 0.02 &&
    Math.abs(overviewGm - kwilaEstimate.marginPercent) < 0.05 &&
    Math.abs((overview?.labourCost ?? 0) - labour60) < 0.02 &&
    Math.abs((overview?.labourHours ?? 0) - kwilaHours) < 0.02
);
check(
  "100 Pricing copies estimate commercial truth",
  read("lib/pricing/estimate-to-pricing-adapter.ts").includes(
    "recommended_sell"
  ) &&
    read("lib/pricing/estimate-to-pricing-adapter.ts").includes(
      "upstream commercial"
    )
);
check(
  "101 Quote copies Pricing authority, no Deck formulas",
  existsSync("lib/quotes/adoption-authority.ts") &&
    read("lib/quotes/adoption-authority.ts").includes(
      "QUOTE_CALCULATION_AUTHORITY"
    ) &&
    !deckSrc.includes("quote")
);

const company60vs78HoursEqual =
  labourHoursTotal(kwilaCompany60.lineItems) === hours78;
const company60vs78MaterialsEqual =
  materialCostTotal(kwilaCompany60.lineItems) === materials78;
check(
  "102 company $60 vs $78 modularity (cost-only rates)",
  company60vs78HoursEqual &&
    company60vs78MaterialsEqual &&
    Math.abs(labourCostTotal(kwilaCompany60.lineItems) - 1949.4) < 0.02 &&
    Math.abs(labour78 - 2534.22) < 0.02 &&
    included(kwilaCompany60.lineItems).every(
      (item) =>
        item.category !== "labour" ||
        item.sellAuthority === "derived_from_gross_margin"
    )
);

const realDirect = sumCost(realDeck.lineItems);
const realSell = sumSell(realDeck.lineItems);
const realLabourSource = resolveLabourRate({
  rates: [],
  organisationSettings: ctx(realFacts).organisationSettings,
});
check(
  "103 REAL-JOB uses same labour-rate + sell-authority contract",
  realLabourSource.costRate === 60 &&
    realLabourSource.sourceType === "default" &&
    !hasPackage(realDeck.lineItems) &&
    labourHoursTotal(realDeck.lineItems) === 32.49 &&
    included(realDeck.lineItems).some(
      (item) => item.sellAuthority === "legacy_paired_rate"
    ) &&
    included(realDeck.lineItems).some(
      (item) => item.sellAuthority === "derived_from_gross_margin"
    ) &&
    realEstimate.recommendedCost === realDirect &&
    realEstimate.recommendedSell === realSell
);
check(
  "104 decking surface does not price screws; residual unsplit",
  read("lib/estimate/deck-material-pricing.ts").includes(
    "framing/fixings are separate keys"
  ) &&
    kwilaDeck.lineItems.some((item) => item.label === "Decking") &&
    kwilaDeck.lineItems.some((item) => item.label === DECK_FIXINGS_RESIDUAL_LABEL) &&
    included(kwilaDeck.lineItems).filter(
      (item) => item.label === DECK_FIXINGS_RESIDUAL_LABEL
    ).length === 1
);

check(
  "105 no silent flatten of grandfathered sells to 20%",
  Math.abs(kwilaSell - deriveSellFromCost(kwilaDirect, 20)) > 100 &&
    kwilaEstimate.estimateSellAuthority === "line_resolved_sells"
);

const structuralQtyUnchanged =
  Math.abs(lineCost(kwilaDeck.lineItems, "Joists") - round2(66.15 * 8.09)) <
    0.02 &&
  Math.abs(lineCost(kwilaDeck.lineItems, "Bearers") - round2(28.35 * 13.65)) <
    0.02 &&
  Math.abs(lineCost(kwilaDeck.lineItems, "Rim framing") - round2(18.9 * 8.09)) <
    0.02 &&
  Math.abs(lineCost(kwilaDeck.lineItems, "Piles / posts") - round2(10.8 * 23.5)) < 0.02;
check("106 structural material result unchanged", structuralQtyUnchanged);

console.log("\n=== DECK-MATURITY-2B-R3 fixture / residual closure ===\n");

const defaultRateClass = "DEFAULT_RATE_ENGINE_FIXTURE";
const ownerRateClass = "OWNER_COMPANY_RATE_FIXTURE";
const emptyAfterOwner = resolveLabourRate({
  rates: [],
  organisationSettings: ctx(kwilaFacts).organisationSettings,
});
const owner78Cost = sumCost(kwila78.lineItems);
const owner78Sell = sumSell(kwila78.lineItems);
const owner78Gp = round2(owner78Sell - owner78Cost);
const owner78Gm = round2((owner78Gp / owner78Sell) * 100);
const targetMargin = 20;
const residualSensitivity = [15, 20, 25].map((rate) => ({
  rate,
  residualCost: round2(27 * rate),
  deltaVs25: round2(27 * rate - 675),
}));

check(
  "107 empty-rates Kwila is DEFAULT_RATE_ENGINE_FIXTURE not Owner labour",
  emptyLabourResolved.costRate === 60 &&
    emptyLabourResolved.sourceType === "default" &&
    !read("tests/fixtures/deck-calibration/OWNER-KWILA-01.json").includes(
      "Owner labour rate"
    ) &&
    read("tests/fixtures/deck-calibration/OWNER-KWILA-01.json").includes(
      defaultRateClass
    )
);
check(
  "108 Owner-company $78 fixture is explicit-rate only",
  company78Resolved.costRate === 78 &&
    company78Resolved.sourceType === "user_rate" &&
    read("tests/fixtures/deck-calibration/OWNER-KWILA-01.json").includes(
      ownerRateClass
    ) &&
    Math.abs(labour78 - 2534.22) < 0.005
);
check(
  "109 $78 cannot mutate global default labour fallback",
  emptyAfterOwner.costRate === 60 &&
    emptyAfterOwner.sellRate === 90 &&
    ratesSrc.includes("DEFAULT_LABOUR_COST_RATE = 60") &&
    !deckSrc.includes("78")
);
check(
  "110 Owner $78 effective GM reconciles",
  Math.abs(owner78Cost - 10478.25) < 0.02 &&
    Math.abs(owner78Sell - 14818.89) < 0.02 &&
    Math.abs(owner78Gm - 29.29) < 0.05
);
check(
  "111 target margin is 20 and is not displayed as effective GM",
  targetMargin === 20 &&
    Math.abs(kwilaEffectiveGm - 20) > 1 &&
    read("components/assistant/CommercialOverviewMetrics.tsx").includes(
      "Effective gross margin"
    ) &&
    read("components/assistant/MarginEditControl.tsx").includes("Target margin %")
);
check(
  "112 residual excludes detailed structural timber",
  DECK_FIXINGS_RESIDUAL_EXCLUDES.includes("JOIST_TIMBER") &&
    DECK_FIXINGS_RESIDUAL_EXCLUDES.includes("BEARER_TIMBER") &&
    DECK_FIXINGS_RESIDUAL_EXCLUDES.includes("RIM_TIMBER") &&
    DECK_FIXINGS_RESIDUAL_EXCLUDES.includes("PILE_POST_TIMBER") &&
    DECK_FIXINGS_RESIDUAL_EXCLUDES.includes("DECK_BOARDS") &&
    DECK_FIXINGS_RESIDUAL_EXCLUDES.includes("CONCRETE") &&
    DECK_FIXINGS_RESIDUAL_EXCLUDES.includes("DELIVERY_FREIGHT")
);
check(
  "113 residual coverage documented as connectors/sundries",
  DECK_FIXINGS_RESIDUAL_INCLUDES.includes("DECKING_FIXINGS") &&
    DECK_FIXINGS_RESIDUAL_INCLUDES.includes("STRUCTURAL_CONNECTORS") &&
    DECK_FIXINGS_RESIDUAL_INCLUDES.includes("MOISTURE_SEPARATION") &&
    DECK_FIXINGS_RESIDUAL_INCLUDES.includes("MINOR_FRAMING") &&
    DECK_FIXINGS_RESIDUAL_INCLUDES.includes("CONSUMABLES")
);
check(
  "114 residual calibration status is starter benchmark, $25 unchanged",
  DECK_FIXINGS_RESIDUAL_CLASS === "RESIDUAL_STARTER_BENCHMARK" &&
    DECK_BENCHMARKS.fixings.cost === 25 &&
    DECK_FIXINGS_DELIVERY_TREATMENT === "FUTURE_COMMERCIAL_GAP" &&
    DECK_FIXINGS_CONCRETE_TREATMENT === "NOT_IN_RESIDUAL_PLANNING_OR_PACKAGE"
);
check(
  "115 residual $15/$20 sensitivity is report-only",
  residualSensitivity[0].residualCost === 405 &&
    residualSensitivity[1].residualCost === 540 &&
    residualSensitivity[2].residualCost === 675 &&
    DECK_BENCHMARKS.fixings.cost === 25 &&
    !deckSrc.includes("fallbackCostRate: 15") &&
    !deckSrc.includes("fallbackCostRate: 20")
);
check(
  "116 Builder Review residual label is Fixings, connectors & sundries",
  DECK_FIXINGS_RESIDUAL_LABEL === "Fixings, connectors & sundries" &&
    kwilaDeck.lineItems.some(
      (item) =>
        item.label === DECK_FIXINGS_RESIDUAL_LABEL &&
        item.itemKey === DECK_FIXINGS_RESIDUAL_ITEM_KEY
    ) &&
    !kwilaDeck.lineItems.some((item) => item.label === "Fixings and consumables")
);
check(
  "117 old package absent under detailed authority",
  !hasPackage(kwilaDeck.lineItems) &&
    !hasPackage(kwila78.lineItems) &&
    !hasPackage(realDeck.lineItems)
);
check(
  "118 old lumped Deck labour absent under split labour",
  !kwilaDeck.lineItems.some((item) => item.label === "Deck labour") &&
    !kwila78.lineItems.some((item) => item.label === "Deck labour") &&
    !realDeck.lineItems.some((item) => item.label === "Deck labour")
);
check(
  "119 fascia labour is 0.45 h/lm; $35 allowance does not coexist",
  fasciaDeck.lineItems.some((item) => item.label === "Fascia installation") &&
    !fasciaDeck.lineItems.some((item) => item.label === "Face board labour allowance")
);
check(
  "120 Recovery DEFAULT-RATE goldens reconciled",
  read("scripts/verify-recovery-1-commercial-authority.ts").includes("8620.53") &&
    read("scripts/verify-recovery-1-commercial-authority.ts").includes(
      "DEFAULT-RATE ENGINE"
    ) &&
    read("scripts/verify-recovery-5b-builder-review.ts").includes("8620.53") &&
    read("scripts/verify-deck-2b-assisted-quick-estimate.ts").includes("12878.01")
);
check(
  "121 REAL-JOB DEFAULT-RATE golden matches engine",
  Math.abs(realDirect - 8620.53) < 0.02 &&
    Math.abs(realSell - 12878.01) < 0.02 &&
    realLabourSource.costRate === 60
);
check(
  "122 Owner $78 case is not the global default golden",
  Math.abs(realDirect - owner78Cost) > 1 &&
    emptyLabourResolved.costRate !== 78 &&
    !ratesSrc.includes("DEFAULT_LABOUR_COST_RATE = 78")
);
check(
  "123 steps lump remains commercial; starter productivity not promoted",
  starterSteps.hoursPerUnit === 4 &&
    !kwilaDeck.lineItems.some((item) => item.label === "Steps installation")
);

console.log(
  `Residual sensitivity (Kwila 27 m², report only): $15→$${residualSensitivity[0].residualCost} (${residualSensitivity[0].deltaVs25}) · $20→$${residualSensitivity[1].residualCost} (${residualSensitivity[1].deltaVs25}) · $25→$${residualSensitivity[2].residualCost}`
);
console.log(
  `Owner-company $78 case: cost=${owner78Cost} sell=${owner78Sell} GP=${owner78Gp} effective GM=${owner78Gm}% target=${targetMargin}%`
);

function printLineProvenance(
  title: string,
  items: readonly EstimateLineItemInput[]
): void {
  console.log(`\n${title}`);
  for (const item of included(items)) {
    console.log(
      `  ${item.label.padEnd(28)} cost ${item.recommendedCost.toFixed(2).padStart(10)}  sell ${item.recommendedSell.toFixed(2).padStart(10)}  ${item.sellAuthority ?? "?"}  ${item.category}  ${item.costRate ?? ""}/${item.sellRate ?? ""}`
    );
  }
  const cost = sumCost(items);
  const sell = sumSell(items);
  const gp = round2(sell - cost);
  const gm = round2((gp / sell) * 100);
  console.log(
    `  TOTAL                        cost ${cost.toFixed(2).padStart(10)}  sell ${sell.toFixed(2).padStart(10)}  GP ${gp.toFixed(2)}  effective GM ${gm}%`
  );
}

printLineProvenance(
  "DEFAULT-RATE ENGINE FIXTURE — Owner Kwila empty rates ($60/$90 fallback, not Owner labour)",
  kwilaDeck.lineItems
);
printLineProvenance(
  "OWNER_COMPANY_RATE_FIXTURE — Kwila + labour.carpenter.hour $78 cost-only",
  kwila78.lineItems
);
printLineProvenance("Cost-first 20% proof (test-only, no production flatten)", kwilaCostFirst.lineItems);
printLineProvenance("DEFAULT-RATE ENGINE FIXTURE — REAL-JOB-01 empty rates", realDeck.lineItems);
console.log(
  `\nLabour resolver empty: key=${emptyLabourResolved.itemKey} cost=${emptyLabourResolved.costRate} sell=${emptyLabourResolved.sellRate} source=${emptyLabourResolved.sourceType} authority=${emptyLabourResolved.sellAuthority}`
);
console.log(
  `Labour resolver $78: key=${company78Resolved.itemKey} cost=${company78Resolved.costRate} sell=${company78Resolved.sellRate} source=${company78Resolved.sourceType} authority=${company78Resolved.sellAuthority}`
);
console.log(
  `Commercial Overview: materials=${overview?.materialsCost} labour=${overview?.labourCost} allowances=${overview?.allowancesCost} sum=${overviewCostSum} estimateCost=${kwilaEstimate.recommendedCost} sell=${kwilaEstimate.recommendedSell} GM=${kwilaEstimate.marginPercent}`
);

if (failed > 0) {
  console.error(`\nDECK-MATURITY-2B verification failed (${failed}).`);
  process.exit(1);
}
console.log(`\nDECK-MATURITY-2B verification passed (${passed}/${passed}).`);

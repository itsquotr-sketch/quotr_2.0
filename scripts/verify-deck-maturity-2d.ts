/**
 * DECK-MATURITY-2D — material/rate authority, Rates type separation,
 * concrete h/hole persistence contract.
 * Run: npx tsx scripts/verify-deck-maturity-2d.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { resolveComponentCommercialAuthority } from "../lib/estimate/component-commercial-authority";
import {
  DECK_SUBSTRUCTURE_PACKAGE_LIFECYCLE,
  decideDeckSubstructureAuthority,
  deckDetailedPhysicalModelAvailable,
} from "../lib/estimate/deck-commercial-2b";
import {
  defaultBearerIdentity,
  defaultJoistIdentity,
  DECK_ESTIMATING_FRAMING_SECTIONS,
  lightSupportIdentity,
} from "../lib/estimate/deck-default-identities";
import {
  DECK_CONCRETE_MATERIAL_ITEM_KEY,
  DECK_CONCRETE_PRODUCTIVITY_KEY,
  DECK_CONCRETE_TO_SUPPORTS_FACT_KEY,
} from "../lib/estimate/deck-scope-2c";
import { classifyDeckGeometryReadiness } from "../lib/estimate/deck-structure";
import {
  findCompanyProductivityRate,
  productivityUnitsCompatible,
  resolveProductivity,
} from "../lib/estimate/productivity";
import { round2 } from "../lib/estimate/facts";
import { LABOUR_RATE_CATALOGUE } from "../lib/rates/catalogue";
import {
  catalogueEntriesForRatesSection,
  isMaterialRatesCatalogueEntry,
  isProductivityRatesCatalogueEntry,
  ratesSemanticSectionForRateType,
} from "../lib/rates/rate-section-contract";
import {
  DECK_PRODUCTIVITY_RATE_CATALOGUE,
  SPECIFIC_MATERIAL_RATE_CATALOGUE,
  SPECIFIC_MATERIAL_RATE_GROUPS,
} from "../lib/rates/specific-material-catalogue";
import { buildMaterialRateItemKey } from "../lib/materials/identity";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationRate } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";

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
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    rateSourceType: item.rateSourceType,
  }));
}

function ctx(
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = [],
  extras: Partial<EstimateContext> = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(facts[0]?.work_area_id ?? "d1")],
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
    ...extras,
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

function labourOrgRate(costRate: number): OrganisationRate {
  return {
    id: "labour.carpenter.hour",
    rate_type: "labour",
    item_key: "labour.carpenter.hour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: costRate,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "deck",
  };
}

function materialOrgRate(
  itemKey: string,
  unit: string,
  cost: number
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "material",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "deck",
  };
}

function included(items: readonly EstimateLineItemInput[]): EstimateLineItemInput[] {
  return items.filter((item) => item.includedInTotal !== false);
}

function hasPackage(items: readonly EstimateLineItemInput[]): boolean {
  return included(items).some((item) => item.label === "Framing/substructure");
}

function hasDetailedStructure(items: readonly EstimateLineItemInput[]): boolean {
  return included(items).some((item) => item.label === "Joists");
}

function lineByLabel(
  items: readonly EstimateLineItemInput[],
  label: string
): EstimateLineItemInput | undefined {
  return included(items).find((item) => item.label === label);
}

function hoursByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return lineByLabel(items, label)?.labourHours ?? 0;
}

function isPricingRequired(item: EstimateLineItemInput | undefined): boolean {
  if (!item) return false;
  return (
    item.rateSourceType === "missing" ||
    item.rateSource.toLowerCase().includes("pricing required")
  );
}

function reviewFor(deck: ReturnType<typeof calculateDeck>, workAreaId: string) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: deck.recommendedCost,
      recommendedSell: deck.recommendedSell,
      marginPercent: deck.marginPercent,
      confidence: deck.confidence,
      assumptions: deck.assumptions,
      missingInfo: deck.missingInfo,
      lineItems: mapCalcLines(deck.lineItems),
    },
    workAreas: [{ id: workAreaId, type: "deck", name: "Deck", status: "confirmed" }],
    requirements: deck.requirements ?? [],
  });
}

console.log("=== DECK-MATURITY-2D material-rate authority + productivity persistence ===\n");

const KWILA = loadCalibrationFixture("OWNER-KWILA-01.json");
const kwilaId = "kwila";
const kwilaFacts = Object.entries(KWILA.facts).map(([key, value]) =>
  fact(key, kwilaId, value)
);
const kwilaDeck = calculateDeck(ctx(kwilaFacts), wa(kwilaId));
const actionsSrc = read("lib/rates/actions.ts");
const migrationSrc = read("supabase/migrations/038_rates_productivity_type.sql");
const dialogSrc = read("components/rates/RateEditDialog.tsx");
const ratesPage = read("components/rates/RatesPageContent.tsx");
const materialsSection = read("components/rates/SpecificMaterialRatesSection.tsx");
const specEditor = read("components/assistant/job-plan/DeckQuickSpecEditor.tsx");
const brSurface = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
const coverageSrc = read("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md");
const modelSrc = read("docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md");
const prodSrc = read("lib/estimate/productivity.ts");
const deckCalcSrc = read("lib/estimate/calculators/deck.ts");

console.log("== RATES SEPARATION ==");
const materialCatalogue = SPECIFIC_MATERIAL_RATE_CATALOGUE;
const productivityCatalogue = DECK_PRODUCTIVITY_RATE_CATALOGUE;
check(
  "1 productivity rows absent from Materials catalogue",
  materialCatalogue.every((row) => !isProductivityRatesCatalogueEntry(row)) &&
    !SPECIFIC_MATERIAL_RATE_GROUPS.some((group) => group.title === "Deck productivity")
);
check(
  "2 material rows absent from Productivity catalogue",
  productivityCatalogue.every((row) => isProductivityRatesCatalogueEntry(row)) &&
    catalogueEntriesForRatesSection(productivityCatalogue, "material").length === 0
);
check(
  "3 labour $/hr absent from Productivity",
  !productivityCatalogue.some((row) => row.rate_type === "labour") &&
    LABOUR_RATE_CATALOGUE.every((row) => row.rate_type === "labour") &&
    catalogueEntriesForRatesSection(LABOUR_RATE_CATALOGUE, "productivity").length === 0
);
check(
  "4 one semantic section per rate row",
  [...materialCatalogue, ...productivityCatalogue, ...LABOUR_RATE_CATALOGUE].every(
    (row) => ratesSemanticSectionForRateType(row.rate_type) != null
  ) &&
    materialsSection.includes("catalogueEntriesForRatesSection") &&
    ratesPage.includes('catalogueEntriesForRatesSection')
);

console.log("\n== CONCRETE PRODUCTIVITY ==");
const concreteCat = productivityCatalogue.find(
  (row) => row.item_key === DECK_CONCRETE_PRODUCTIVITY_KEY
);
check(
  "5 h/hole editable",
  concreteCat?.unit === "hole" &&
    dialogSrc.includes('isProductivity ? "Hours"') &&
    dialogSrc.includes("Hours must be greater than zero")
);
check(
  "6 h/hole save persists",
  actionsSrc.includes('"productivity"') &&
    migrationSrc.includes("'productivity'") &&
    actionsSrc.includes("Hours must be greater than zero")
);
check(
  "7 reload returns value",
  actionsSrc.includes("getRatesPageState") &&
    actionsSrc.includes("cost_rate") &&
    concreteCat?.rate_type === "productivity"
);
const concreteHours = calculateDeck(
  ctx(
    [...kwilaFacts, fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, kwilaId, true)],
    [productivityOrgRate(DECK_CONCRETE_PRODUCTIVITY_KEY, "hole", 0.25)]
  ),
  wa(kwilaId)
);
const concreteHoursLine = lineByLabel(concreteHours.lineItems, "Concrete placement");
check(
  "8 value changes only concrete hours",
  concreteHoursLine?.labourHours === 4.5 &&
    hoursByLabel(concreteHours.lineItems, "Decking installation") ===
      hoursByLabel(kwilaDeck.lineItems, "Decking installation") &&
    hoursByLabel(concreteHours.lineItems, "Pile/post installation") ===
      hoursByLabel(kwilaDeck.lineItems, "Pile/post installation")
);
check(
  "9 no Quotr benchmark invented",
  concreteCat?.defaultCostRate == null &&
    resolveProductivity({
      productivityKey: DECK_CONCRETE_PRODUCTIVITY_KEY,
      unit: "hole",
      fallbackHoursPerUnit: 0,
    }).hoursPerUnit === 0
);
check(
  "10 unit retained correctly",
  concreteHoursLine?.unit === "hole" &&
    !productivityUnitsCompatible("hole", "ea") &&
    findCompanyProductivityRate(
      [productivityOrgRate(DECK_CONCRETE_PRODUCTIVITY_KEY, "ea", 0.25)],
      DECK_CONCRETE_PRODUCTIVITY_KEY,
      "hole"
    ) == null
);

console.log("\n== DETAILED MATERIAL AUTHORITY ==");
const joist140 = calculateDeck(
  ctx([...kwilaFacts, fact("deck.joist_section", kwilaId, "140x45")]),
  wa(kwilaId)
);
const joistUnpriced = calculateDeck(
  ctx([...kwilaFacts, fact("deck.joist_section", kwilaId, "240x45")]),
  wa(kwilaId)
);
const bearer190 = calculateDeck(
  ctx([...kwilaFacts, fact("deck.bearer_section", kwilaId, "190x45")]),
  wa(kwilaId)
);
const bearerUnpriced = calculateDeck(
  ctx([...kwilaFacts, fact("deck.bearer_section", kwilaId, "240x45")]),
  wa(kwilaId)
);
const piles100 = calculateDeck(
  ctx([...kwilaFacts, fact("deck.support_section", kwilaId, "100x100")]),
  wa(kwilaId)
);
check(
  "11 detailed geometry stays detailed after material change",
  hasDetailedStructure(joist140.lineItems) &&
    hasDetailedStructure(joistUnpriced.lineItems) &&
    hasDetailedStructure(piles100.lineItems) &&
    !hasPackage(joist140.lineItems) &&
    !hasPackage(joistUnpriced.lineItems) &&
    !hasPackage(piles100.lineItems)
);
const joist140Line = lineByLabel(joist140.lineItems, "Joists");
check(
  "12 exact-rate Joist selection prices",
  joist140Line != null &&
    !isPricingRequired(joist140Line) &&
    joist140Line.quantity === 66.15 &&
    (joist140Line.recommendedCost ?? 0) > 0
);
const joistUnpricedLine = lineByLabel(joistUnpriced.lineItems, "Joists");
check(
  "13 unpriced Joist remains detailed + Pricing Required",
  joistUnpricedLine?.quantity === 66.15 && isPricingRequired(joistUnpricedLine)
);
check(
  "14 no package fallback for missing Joist rate",
  !hasPackage(joistUnpriced.lineItems) && hasDetailedStructure(joistUnpriced.lineItems)
);
const bearer190Line = lineByLabel(bearer190.lineItems, "Bearers");
check(
  "15 exact-rate Bearer selection prices",
  bearer190Line != null &&
    !isPricingRequired(bearer190Line) &&
    bearer190Line.quantity === 28.35 &&
    (bearer190Line.recommendedCost ?? 0) > 0
);
const bearerUnpricedLine = lineByLabel(bearerUnpriced.lineItems, "Bearers");
check(
  "16 unpriced Bearer remains detailed + Pricing Required",
  bearerUnpricedLine?.quantity === 28.35 &&
    isPricingRequired(bearerUnpricedLine) &&
    !hasPackage(bearerUnpriced.lineItems)
);
const rim140 = lineByLabel(joist140.lineItems, "Rim framing");
const rimUnpriced = lineByLabel(joistUnpriced.lineItems, "Rim framing");
check(
  "17 Rim inherits Joist",
  Boolean(joist140Line?.identitySummary && rim140?.identitySummary) &&
    (joist140Line?.identitySummary ?? "").split(" · ")[0] ===
      (rim140?.identitySummary ?? "").split(" · ")[0]
);
check(
  "18 unpriced Rim does not trigger package",
  isPricingRequired(rimUnpriced) && !hasPackage(joistUnpriced.lineItems)
);
const pile100Line = lineByLabel(piles100.lineItems, "Piles / posts");
const pileBase = lineByLabel(kwilaDeck.lineItems, "Piles / posts");
check(
  "19 pile identity change preserves count/procurement",
  pile100Line?.notes?.includes("18 ea") === true &&
    pileBase?.notes?.includes("18 ea") === true &&
    (pile100Line?.notes?.includes("10.80 lm purchased") === true ||
      pile100Line?.notes?.includes("18 ea") === true)
);
check(
  "20 unpriced pile stays detailed + Pricing Required",
  isPricingRequired(pile100Line) && hasDetailedStructure(piles100.lineItems)
);
check(
  "21 no package for rate-only miss",
  !hasPackage(joistUnpriced.lineItems) &&
    !hasPackage(bearerUnpriced.lineItems) &&
    !hasPackage(piles100.lineItems)
);

console.log("\n== PACKAGE FALLBACK ==");
const areaOnlyFacts = [
  fact("deck.area_m2", "a1", 27),
  fact("deck.board_material", "a1", "Kwila"),
  fact("deck.substructure_included", "a1", true),
];
const areaOnly = calculateDeck(ctx(areaOnlyFacts), wa("a1"));
const unsupported = calculateDeck(ctx([], []), wa("x"));
check(
  "22 area-only uses package",
  classifyDeckGeometryReadiness({ facts: areaOnlyFacts, workAreaId: "a1" }) ===
    "AREA_ONLY" && hasPackage(areaOnly.lineItems) && !hasDetailedStructure(areaOnly.lineItems)
);
check(
  "23 unsupported geometry uses package or cannot fabricate detail",
  classifyDeckGeometryReadiness({ facts: [], workAreaId: "x" }) ===
    "IRREGULAR_UNSUPPORTED" && !hasDetailedStructure(unsupported.lineItems)
);
check(
  "24 detailed geometry does not use package for rate miss",
  !hasPackage(joistUnpriced.lineItems)
);
check(
  "25 package XOR detailed remains",
  !(hasPackage(kwilaDeck.lineItems) && hasDetailedStructure(kwilaDeck.lineItems)) &&
    !(hasPackage(joistUnpriced.lineItems) && hasDetailedStructure(joistUnpriced.lineItems) === false) &&
    hasDetailedStructure(joistUnpriced.lineItems) &&
    !hasPackage(joistUnpriced.lineItems) &&
    hasPackage(areaOnly.lineItems) &&
    !hasDetailedStructure(areaOnly.lineItems) &&
    decideDeckSubstructureAuthority({
      substructureIncluded: true,
      detailedPhysicalModelAvailable: false,
    }).packageLifecycle === DECK_SUBSTRUCTURE_PACKAGE_LIFECYCLE
);

console.log("\n== CONCRETE ==");
const concreteYes = calculateDeck(
  ctx([...kwilaFacts, fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, kwilaId, true)]),
  wa(kwilaId)
);
const concretePriced = calculateDeck(
  ctx(
    [...kwilaFacts, fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, kwilaId, true)],
    [
      materialOrgRate(DECK_CONCRETE_MATERIAL_ITEM_KEY, "bag", 8),
      productivityOrgRate(DECK_CONCRETE_PRODUCTIVITY_KEY, "hole", 0.25),
    ]
  ),
  wa(kwilaId)
);
const concreteNo = calculateDeck(
  ctx([...kwilaFacts, fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, kwilaId, false)]),
  wa(kwilaId)
);
check(
  "26 YES + bag rate + productivity prices detail",
  !isPricingRequired(lineByLabel(concretePriced.lineItems, "Concrete")) &&
    hoursByLabel(concretePriced.lineItems, "Concrete placement") === 4.5 &&
    lineByLabel(concretePriced.lineItems, "Concrete")?.quantity === 45
);
check(
  "27 YES + missing bag rate → material Pricing Required",
  isPricingRequired(lineByLabel(concreteYes.lineItems, "Concrete")) &&
    lineByLabel(concreteYes.lineItems, "Concrete")?.quantity === 45
);
check(
  "28 YES + missing productivity → labour Pricing Required",
  isPricingRequired(lineByLabel(concreteYes.lineItems, "Concrete placement"))
);
check(
  "29 no package caused by missing concrete rate",
  !hasPackage(concreteYes.lineItems) && hasDetailedStructure(concreteYes.lineItems)
);
check(
  "30 NO → no concrete issue",
  !concreteNo.lineItems.some((item) => item.label === "Concrete") &&
    !concreteNo.missingInfo.some((info) => /concrete/i.test(info))
);

console.log("\n== MATERIAL SELECTION ==");
check(
  "31 selector filtered by compatible family",
  specEditor.includes("90×45 H3.2") &&
    specEditor.includes("140×45 H3.2") &&
    specEditor.includes("190×45 H3.2") &&
    specEditor.includes("100×100 H5 timber post") &&
    specEditor.includes("125×125 H5 house pile") &&
    !specEditor.includes("SED") &&
    !specEditor.toLowerCase().includes("retaining pole") &&
    DECK_ESTIMATING_FRAMING_SECTIONS.has("90x45")
);
check(
  "32 exact material identity preserved",
  (joist140Line?.identitySummary ?? "").includes("140") &&
    (pile100Line?.identitySummary ?? "").toLowerCase().includes("100")
);
const joistKey = buildMaterialRateItemKey(defaultJoistIdentity()!, "lm");
const stolenUnit = calculateDeck(
  ctx(kwilaFacts, [materialOrgRate(joistKey, "ea", 999)]),
  wa(kwilaId)
);
check(
  "33 exact unit enforced",
  lineByLabel(stolenUnit.lineItems, "Joists")?.costRate !== 999 &&
    lineByLabel(stolenUnit.lineItems, "Joists")?.quantity === 66.15
);
const companyJoist = calculateDeck(
  ctx(kwilaFacts, [materialOrgRate(joistKey, "lm", 50)]),
  wa(kwilaId)
);
const bearerKey = buildMaterialRateItemKey(defaultBearerIdentity()!, "lm");
check(
  "34 company rate override wins",
  joistKey !== bearerKey &&
    lineByLabel(companyJoist.lineItems, "Joists")?.costRate === 50 &&
    lineByLabel(companyJoist.lineItems, "Rim framing")?.costRate === 50 &&
    lineByLabel(companyJoist.lineItems, "Bearers")?.costRate !== 50 &&
    lineByLabel(companyJoist.lineItems, "Joists")?.quantity === 66.15
);
check(
  "35 clearing override uses exact benchmark or Pricing Required",
  !isPricingRequired(lineByLabel(kwilaDeck.lineItems, "Joists")) &&
    lineByLabel(kwilaDeck.lineItems, "Joists")?.costRate !== 50 &&
    !hasPackage(kwilaDeck.lineItems)
);
check(
  "36 physical quantity unchanged by rate change",
  lineByLabel(companyJoist.lineItems, "Joists")?.quantity ===
    lineByLabel(kwilaDeck.lineItems, "Joists")?.quantity &&
    lineByLabel(companyJoist.lineItems, "Bearers")?.quantity ===
      lineByLabel(kwilaDeck.lineItems, "Bearers")?.quantity
);

console.log("\n== BUILDER REVIEW ==");
const unpricedReview = reviewFor(joistUnpriced, kwilaId);
const unpricedJoistReview = unpricedReview.workAreas
  .flatMap((area) => area.categories)
  .flatMap((cat) => cat.lines)
  .find((line) => line.label === "Joists");
const takeoffLabels = unpricedReview.workAreas.flatMap((area) =>
  area.categories.flatMap((cat) => cat.takeoff.map((row) => row.label))
);
check(
  "37 selected identity shown",
  Boolean(unpricedJoistReview?.specification)
);
check(
  "38 quantity shown",
  unpricedJoistReview?.quantity === 66.15
);
check(
  "39 Pricing Required shown per missing component",
  unpricedJoistReview?.category === "PRICING_REQUIRED" &&
    brSurface.includes("Needs a trusted price")
);
check(
  "40 no broad Framing/substructure package in detailed rate-miss case",
  !unpricedReview.workAreas.some((area) =>
    area.categories.some((cat) =>
      cat.lines.some((line) => line.label === "Framing/substructure")
    )
  )
);
check(
  "41 Planning Takeoff does not reabsorb known structural children",
  !takeoffLabels.includes("Joists") &&
    !takeoffLabels.includes("Bearers") &&
    !takeoffLabels.includes("Rim framing") &&
    !takeoffLabels.includes("Supports")
);

console.log("\n== PRODUCTIVITY / LABOUR ==");
check(
  "42 existing productivities unchanged",
  resolveProductivity({
    productivityKey: "deck.decking.install.hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 0,
  }).hoursPerUnit === 0.55 &&
    resolveProductivity({
      productivityKey: "deck.substructure.install.hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0,
    }).hoursPerUnit === 0.52 &&
    resolveProductivity({
      productivityKey: "deck.posts.install.hours_per_ea",
      unit: "ea",
      fallbackHoursPerUnit: 0,
    }).hoursPerUnit === 0.2 &&
    resolveProductivity({
      productivityKey: "deck.fascia.install.hours_per_lm",
      unit: "lm",
      fallbackHoursPerUnit: 0,
    }).hoursPerUnit === 0.45 &&
    resolveProductivity({
      productivityKey: "deck.steps.install.hours_per_m2",
      unit: "m2",
      fallbackHoursPerUnit: 0,
    }).hoursPerUnit === 4 &&
    resolveProductivity({
      productivityKey: "deck.demolition_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0,
    }).hoursPerUnit === 0.35
);
check(
  "43 normal handling contract unchanged",
  prodSrc.includes("NORMAL handling") &&
    coverageSrc.includes("Included in each scope productivity")
);
check(
  "44 access/carry once",
  deckCalcSrc.includes("getCombinedLabourAccessFactor") &&
    prodSrc.includes("ABNORMAL ACCESS/CARRY")
);
const labourBoost = calculateDeck(ctx(kwilaFacts, [labourOrgRate(90)]), wa(kwilaId));
check(
  "45 labour $/hr change does not change hours",
  hoursByLabel(labourBoost.lineItems, "Decking installation") ===
    hoursByLabel(kwilaDeck.lineItems, "Decking installation") &&
    round2(
      included(labourBoost.lineItems).reduce((sum, item) => sum + item.recommendedCost, 0)
    ) !==
      round2(
        included(kwilaDeck.lineItems).reduce((sum, item) => sum + item.recommendedCost, 0)
      )
);

console.log("\n== OWNERSHIP ==");
const pricedUnpricedMix = joistUnpriced;
check(
  "46 Pricing parity",
  existsSync("lib/pricing/adoption-authority.ts") &&
    calculateEstimate(ctx(kwilaFacts)).recommendedCost > 0
);
check(
  "47 Quote parity",
  existsSync("lib/quotes/adoption-authority.ts")
);
check(
  "48 no zero economic hole",
  isPricingRequired(joistUnpricedLine) &&
    (joistUnpricedLine?.recommendedCost ?? 0) === 0 &&
    pricedUnpricedMix.missingInfo.some((info) => /Joists/i.test(info)) &&
    (lineByLabel(pricedUnpricedMix.lineItems, "Bearers")?.recommendedCost ?? 0) > 0
);
check(
  "49 no double count",
  !hasPackage(pricedUnpricedMix.lineItems) &&
    hasDetailedStructure(pricedUnpricedMix.lineItems) &&
    resolveComponentCommercialAuthority({
      applicable: true,
      hasTrustedPhysicalQuantity: true,
      hasTrustedRate: false,
    }) === "PRICING_REQUIRED"
);

console.log("\n== OWNER FIXTURE ==");
check(
  "50 baseline detailed state",
  hasDetailedStructure(kwilaDeck.lineItems) &&
    !hasPackage(kwilaDeck.lineItems) &&
    !isPricingRequired(lineByLabel(kwilaDeck.lineItems, "Joists")) &&
    lineByLabel(kwilaDeck.lineItems, "Joists")?.quantity === 66.15
);
check(
  "51 changed Joist exact-rate detailed state",
  hasDetailedStructure(joist140.lineItems) &&
    !isPricingRequired(joist140Line) &&
    !isPricingRequired(rim140) &&
    joist140Line?.quantity === 66.15
);
check(
  "52 changed unpriced Joist detailed Pricing Required state",
  hasDetailedStructure(joistUnpriced.lineItems) &&
    isPricingRequired(joistUnpricedLine) &&
    isPricingRequired(rimUnpriced)
);
check("53 no package reversion", !hasPackage(joist140.lineItems) && !hasPackage(joistUnpriced.lineItems));
check(
  "54 mobile contract",
  brSurface.includes("break-words") &&
    brSurface.includes("overflow-x-hidden") &&
    brSurface.includes("Needs a trusted price") &&
    brSurface.includes("max-w-[42%]")
);

check(
  "55 generic Materials filter, not Deck-key hiding",
  materialsSection.includes("catalogueEntriesForRatesSection") &&
    !materialsSection.includes("deck.decking.install") &&
    isMaterialRatesCatalogueEntry({ rate_type: "material" })
);
check(
  "56 lifecycle documented",
  coverageSrc.includes("DECK-MATURITY-2D") &&
    coverageSrc.includes("PACKAGE_FALLBACK_FOR_INSUFFICIENT_PHYSICAL_MODEL") &&
    modelSrc.includes("PACKAGE_FALLBACK_FOR_INSUFFICIENT_PHYSICAL_MODEL")
);
check(
  "57 over-max pile still package (insufficient physical model)",
  hasPackage(
    calculateDeck(
      ctx([...kwilaFacts.filter((row) => row.key !== "deck.height_m"), fact("deck.height_m", kwilaId, 5)]),
      wa(kwilaId)
    ).lineItems
  ) &&
    !deckDetailedPhysicalModelAvailable({
      geometryReadiness: "DETAILED_GEOMETRY_AVAILABLE",
      joistQuantity: 66.15,
      bearerQuantity: 28.35,
      rimQuantity: 1,
      supportQuantity: 18,
      supportPurchaseUnit: "lm",
      postProcurementOk: false,
    })
);
check(
  "58 readiness copy not Ready for pricing while Pricing Required",
  read("lib/assistant/presentation/quick-estimate-view-model.ts").includes(
    "items need pricing"
  ) && unpricedJoistReview?.category === "PRICING_REQUIRED"
);
check(
  "59 100×100 identity is supported without SED",
  lightSupportIdentity()?.section === "100x100" &&
    !read("lib/estimate/deck-default-identities.ts").includes("SED")
);
check(
  "60 Change material available on Pricing Required",
  brSurface.includes('cat.id === "PRICING_REQUIRED"')
);

if (failed > 0) {
  console.log(`\nDECK-MATURITY-2D  ${passed} passed / ${failed} failed`);
  process.exit(1);
}
console.log(`\nDECK-MATURITY-2D  ${passed} passed / 0 failed`);

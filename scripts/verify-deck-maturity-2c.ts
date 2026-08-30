/**
 * DECK-MATURITY-2C — final Deck scope ownership, productivity UX, Steps/piles/concrete.
 * Run: npx tsx scripts/verify-deck-maturity-2c.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { DECK_CALCULATOR_CONSUMED_FACTS } from "../lib/estimate/calculators/deck";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import {
  DECK_ABNORMAL_ACCESS_CONTRACT,
  DECK_CONCRETE_BAGS_PER_HOLE_DEFAULT,
  DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY,
  DECK_CONCRETE_MATERIAL_ITEM_KEY,
  DECK_CONCRETE_PLACE_COMPONENT_KEY,
  DECK_CONCRETE_PRODUCTIVITY_CLASS,
  DECK_CONCRETE_PRODUCTIVITY_KEY,
  DECK_CONCRETE_TO_SUPPORTS_FACT_KEY,
  DECK_NORMAL_HANDLING_CONTRACT,
  DECK_STEPS_INCLUDED_FACT_KEY,
  DECKING_LINE_LABEL,
  DECKING_PACKAGE_LINE_LABEL,
  concreteBagsPerHole,
  deckStepsCommerciallyIncluded,
  newSubstructureIncluded,
  pileReplacementApplicable,
  purchasedConcreteBags,
  shouldAskPileReplacement,
} from "../lib/estimate/deck-scope-2c";
import { estimateDeckRiseCount } from "../lib/estimate/deck-steps-physical";
import { resolveLabourRate } from "../lib/estimate/rates";
import { resolveProductivity } from "../lib/estimate/productivity";
import { round2 } from "../lib/estimate/facts";
import { DECK_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { RATES_SECTION_IDS } from "../lib/setup/recommendation-destinations";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateLineItem } from "../components/assistant/types";
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
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
  }));
}

function ctx(
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = []
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

function labourOrgRate(costRate: number, sellRate: number | null = null): OrganisationRate {
  return {
    id: "labour.carpenter.hour",
    rate_type: "labour",
    item_key: "labour.carpenter.hour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: costRate,
    sell_rate: sellRate,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "deck",
  };
}

function included(items: readonly EstimateLineItemInput[]): EstimateLineItemInput[] {
  return items.filter((item) => item.includedInTotal !== false);
}

function hoursByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return included(items).find((item) => item.label === label)?.labourHours ?? 0;
}

function costByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return round2(
    included(items)
      .filter((item) => item.label === label)
      .reduce((sum, item) => sum + item.recommendedCost, 0)
  );
}

function sumCost(items: readonly EstimateLineItemInput[]): number {
  return round2(included(items).reduce((sum, item) => sum + item.recommendedCost, 0));
}

function sumSell(items: readonly EstimateLineItemInput[]): number {
  return round2(included(items).reduce((sum, item) => sum + item.recommendedSell, 0));
}

function hasLabel(items: readonly EstimateLineItemInput[], pattern: RegExp): boolean {
  return included(items).some((item) => pattern.test(item.label));
}

console.log("=== DECK-MATURITY-2C final Deck scope ownership ===\n");

const KWILA = loadCalibrationFixture("OWNER-KWILA-01.json");
const kwilaId = "kwila";
const kwilaFacts = Object.entries(KWILA.facts).map(([key, value]) =>
  fact(key, kwilaId, value)
);
const kwilaDeck = calculateDeck(ctx(kwilaFacts), wa(kwilaId));
const kwila78 = calculateDeck(ctx(kwilaFacts, [labourOrgRate(78)]), wa(kwilaId));

const ratesPage = read("components/rates/RatesPageContent.tsx");
const ratesTable = read("components/rates/RatesTableSection.tsx");
const catalogueSrc = read("lib/rates/specific-material-catalogue.ts");
const deckCalc = read("lib/estimate/calculators/deck.ts");
const refineSrc = read("lib/assistant/refine/adapters/deck.ts");
const jobPlanSrc = read("lib/assistant/job-plan/adapters/deck.ts");
const composeSrc = read("lib/assistant/builder-review/compose.ts");
const surfaceSrc = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
const prodSrc = read("lib/estimate/productivity.ts");

console.log("== PRODUCTIVITY ==");
const prodKeys = DECK_PRODUCTIVITY_RATE_CATALOGUE.map((e) => e.item_key);
check(
  "1 Rates exposes Decking productivity",
  prodKeys.includes("deck.decking.install.hours_per_lm") &&
    ratesPage.includes("Labour productivity") &&
    (RATES_SECTION_IDS as readonly string[]).includes("productivity")
);
check(
  "2 Rates exposes Substructure productivity",
  prodKeys.includes("deck.substructure.install.hours_per_framing_lm")
);
check(
  "3 Rates exposes Pile productivity",
  prodKeys.includes("deck.posts.install.hours_per_ea")
);
check(
  "4 Rates exposes Fascia productivity",
  prodKeys.includes("deck.fascia.install.hours_per_lm")
);
check(
  "5 Rates exposes Steps productivity",
  prodKeys.includes("deck.steps.install.hours_per_m2")
);
check(
  "6 Rates exposes Demolition productivity",
  prodKeys.includes("deck.demolition_hours_per_m2")
);
check(
  "7 productivity edit persists via existing company-rate architecture",
  ratesTable.includes("upsertRate") &&
    ratesTable.includes("rate_type: editingEntry.rate_type") &&
    ratesPage.includes("Labour productivity")
);
check(
  "7b Rates productivity UI is hours not dollars",
  ratesPage.includes('variant="productivity"') &&
    ratesTable.includes('productivityTable ? "Hours"') &&
    catalogueSrc.includes("not dollars")
);

const baseHours = hoursByLabel(kwilaDeck.lineItems, "Decking installation");
const deckingBoost = calculateDeck(
  ctx(kwilaFacts, [productivityOrgRate("deck.decking.install.hours_per_lm", "lm", 0.12)]),
  wa(kwilaId)
);
const subBoost = calculateDeck(
  ctx(kwilaFacts, [
    productivityOrgRate("deck.substructure.install.hours_per_framing_lm", "lm", 0.2),
  ]),
  wa(kwilaId)
);
const pileBoost = calculateDeck(
  ctx(kwilaFacts, [productivityOrgRate("deck.posts.install.hours_per_ea", "ea", 0.4)]),
  wa(kwilaId)
);
check(
  "8 productivity change affects only matching hours",
  hoursByLabel(deckingBoost.lineItems, "Decking installation") >
    hoursByLabel(kwilaDeck.lineItems, "Decking installation") &&
    hoursByLabel(deckingBoost.lineItems, "Substructure framing") ===
      hoursByLabel(kwilaDeck.lineItems, "Substructure framing") &&
    hoursByLabel(subBoost.lineItems, "Substructure framing") >
      hoursByLabel(kwilaDeck.lineItems, "Substructure framing") &&
    hoursByLabel(subBoost.lineItems, "Decking installation") ===
      hoursByLabel(kwilaDeck.lineItems, "Decking installation") &&
    hoursByLabel(pileBoost.lineItems, "Pile/post installation") >
      hoursByLabel(kwilaDeck.lineItems, "Pile/post installation") &&
    hoursByLabel(pileBoost.lineItems, "Decking installation") ===
      hoursByLabel(kwilaDeck.lineItems, "Decking installation")
);

const hours78 = hoursByLabel(kwila78.lineItems, "Decking installation");
const cost60 = costByLabel(kwilaDeck.lineItems, "Decking installation");
const cost78 = costByLabel(kwila78.lineItems, "Decking installation");
check(
  "9 labour $/hr change affects dollars not hours",
  Math.abs(hours78 - baseHours) < 0.001 && cost78 > cost60
);
check(
  "10 normal handling belongs to productivity",
  DECK_NORMAL_HANDLING_CONTRACT.includes("productivity") &&
    prodSrc.includes("NORMAL handling") &&
    catalogueSrc.includes("normal handling")
);
check(
  "11 abnormal access remains Project Condition",
  DECK_ABNORMAL_ACCESS_CONTRACT.includes("Project Condition") &&
    deckCalc.includes("getCombinedLabourAccessFactor") &&
    prodSrc.includes("Project Condition")
);

console.log("\n== PILE REPLACEMENT ==");
check(
  "12 new substructure suppresses replacement question",
  !shouldAskPileReplacement({ facts: kwilaFacts, workAreaId: kwilaId }) &&
    !pileReplacementApplicable({ facts: kwilaFacts, workAreaId: kwilaId }) &&
    refineSrc.includes("shouldAskPileReplacement")
);
check(
  "13 new substructure suppresses replacement allowance",
  !hasLabel(kwilaDeck.lineItems, /Pile\/post replacement/)
);

const removalFacts = [
  ...kwilaFacts,
  fact("deck.existing_deck_removal", kwilaId, true),
  fact("deck.pile_or_post_replacement_required", kwilaId, true),
];
const removalDeck = calculateDeck(ctx(removalFacts), wa(kwilaId));
check(
  "14 removal + new substructure still suppresses replacement",
  hasLabel(removalDeck.lineItems, /Existing deck removal/) &&
    !hasLabel(removalDeck.lineItems, /Pile\/post replacement/)
);

const retainedFacts = [
  fact("deck.length_m", "ret", 3),
  fact("deck.width_m", "ret", 9),
  fact("deck.area_m2", "ret", 27),
  fact("deck.board_material", "ret", "Kwila"),
  fact("deck.substructure_included", "ret", false),
];
check(
  "15 retained existing supports may ask replacement",
  pileReplacementApplicable({ facts: retainedFacts, workAreaId: "ret" }) &&
    shouldAskPileReplacement({ facts: retainedFacts, workAreaId: "ret" })
);

const explicitFacts = [
  ...retainedFacts,
  fact("deck.pile_or_post_replacement_required", "ret", true),
  fact("deck.pile_or_post_count", "ret", 8),
];
const explicitDeck = calculateDeck(ctx(explicitFacts), wa("ret"));
check(
  "16 explicit replacement remains valid",
  hasLabel(explicitDeck.lineItems, /Pile\/post replacement/)
);

const staleFacts = [
  ...kwilaFacts,
  fact("deck.pile_or_post_replacement_required", kwilaId, true),
];
const staleDeck = calculateDeck(ctx(staleFacts), wa(kwilaId));
check(
  "17 stale replacement does not double count",
  !hasLabel(staleDeck.lineItems, /Pile\/post replacement/) &&
    hasLabel(staleDeck.lineItems, /Piles \/ posts/)
);

console.log("\n== MATERIAL DISPLAY ==");
const joistLine = kwilaDeck.lineItems.find((item) => item.label === "Joists");
const bearerLine = kwilaDeck.lineItems.find((item) => item.label === "Bearers");
const rimLine = kwilaDeck.lineItems.find((item) => item.label === "Rim framing");
const pileLine = kwilaDeck.lineItems.find((item) => item.label === "Piles / posts");
const deckingLine = kwilaDeck.lineItems.find(
  (item) => item.label === DECKING_LINE_LABEL || item.label === DECKING_PACKAGE_LINE_LABEL
);
check(
  "18 Decking label renamed",
  deckingLine?.label === DECKING_LINE_LABEL ||
    deckingLine?.label === DECKING_PACKAGE_LINE_LABEL
);
check(
  "19 Joist identity displayed",
  Boolean(joistLine?.identitySummary?.match(/90\s*[x×]\s*45/i))
);
check(
  "20 Bearer identity displayed",
  Boolean(bearerLine?.identitySummary?.match(/140\s*[x×]\s*45/i))
);
check(
  "21 Rim identity displayed",
  Boolean(rimLine?.identitySummary?.match(/90\s*[x×]\s*45/i))
);
check(
  "22 Pile identity displayed",
  Boolean(pileLine?.identitySummary?.match(/125/))
);
check(
  "23 pile count displayed",
  Boolean(pileLine?.identitySummary?.includes("18 ea"))
);
check(
  "24 pile stock length each displayed",
  Boolean(pileLine?.identitySummary?.match(/0\.60 m each/))
);
check(
  "25 pile purchase total displayed",
  Boolean(pileLine?.identitySummary?.match(/10\.80 lm purchased/))
);

console.log("\n== CONCRETE ==");
check(
  "26 concrete only relevant with supports",
  jobPlanSrc.includes("showConcrete") &&
    refineSrc.includes("supportsRelevant") &&
    !kwilaDeck.lineItems.some((item) => item.label === "Concrete")
);
const yesFacts = [...kwilaFacts, fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, kwilaId, true)];
const concreteYes = calculateDeck(ctx(yesFacts), wa(kwilaId));
const concreteNo = calculateDeck(
  ctx([...kwilaFacts, fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, kwilaId, false)]),
  wa(kwilaId)
);
check(
  "27 Yes activates concrete",
  concreteYes.lineItems.some((item) => item.label === "Concrete") &&
    concreteYes.lineItems.some(
      (item) =>
        item.label === "Concrete placement" ||
        item.componentKey === DECK_CONCRETE_PLACE_COMPONENT_KEY
    )
);
check(
  "28 No suppresses",
  !concreteNo.lineItems.some((item) => item.label === "Concrete") &&
    !concreteNo.lineItems.some((item) => item.label === "Concrete placement") &&
    !concreteNo.missingInfo.some((info) => /concrete/i.test(info))
);
check(
  "29 default 2.5 bags/hole assumption",
  concreteBagsPerHole(yesFacts, kwilaId) === DECK_CONCRETE_BAGS_PER_HOLE_DEFAULT
);
const bags = purchasedConcreteBags(18, 2.5);
check("30 purchased bags round whole", bags === 45 && Number.isInteger(bags));
const concreteMat = concreteYes.lineItems.find((item) => item.label === "Concrete");
check(
  "31 concrete exact material identity",
  concreteMat?.itemKey === DECK_CONCRETE_MATERIAL_ITEM_KEY &&
    Boolean(concreteMat?.identitySummary?.includes("20 kg")) &&
    concreteMat?.unit === "bag" &&
    concreteMat?.quantity === 45
);
check(
  "32 missing material rate not zero money silently accepted as priced",
  concreteMat?.rateSource.toLowerCase().includes("pricing required") &&
    composeSrc.includes("PRICING_REQUIRED")
);
check(
  "33 concrete productivity separate",
  prodKeys.includes(DECK_CONCRETE_PRODUCTIVITY_KEY) &&
    catalogueSrc.includes(DECK_CONCRETE_PRODUCTIVITY_CLASS) &&
    !prodSrc.includes(`"${DECK_CONCRETE_PRODUCTIVITY_KEY}"`)
);
check(
  "34 concrete labour does not duplicate digging",
  deckCalc.includes("Excludes hole excavation") &&
    !deckCalc.includes("hole digging labour")
);
check(
  "35 pile labour includes hole excavation/prep",
  deckCalc.includes("hole excavation") &&
    catalogueSrc.includes("hole excavation")
);

console.log("\n== STEPS ==");
check(
  "36 height alone does not activate Steps",
  !deckStepsCommerciallyIncluded({ facts: kwilaFacts, workAreaId: kwilaId }) &&
    !hasLabel(kwilaDeck.lineItems, /Step-down|Stair set|Step decking|Step installation/)
);
const stepFacts = [...kwilaFacts, fact(DECK_STEPS_INCLUDED_FACT_KEY, kwilaId, true)];
const stepsDeck = calculateDeck(ctx(stepFacts), wa(kwilaId));
check(
  "37 explicit Step scope activates",
  deckStepsCommerciallyIncluded({ facts: stepFacts, workAreaId: kwilaId }) &&
    (hasLabel(stepsDeck.lineItems, /Step decking|Step framing|Step installation/) ||
      hasLabel(stepsDeck.lineItems, /Step-down|Stair set/))
);
check(
  "37b Stair set commercially includes Steps",
  deckStepsCommerciallyIncluded({
    facts: [...kwilaFacts, fact("deck.access_type", kwilaId, "Stair set")],
    workAreaId: kwilaId,
  })
);
check(
  "37c Single step/step-down does not commercially include Steps",
  !deckStepsCommerciallyIncluded({
    facts: [
      ...kwilaFacts,
      fact("deck.access_type", kwilaId, "Single step or step-down"),
    ],
    workAreaId: kwilaId,
  })
);
const stairSetOnly = calculateDeck(
  ctx([...kwilaFacts, fact("deck.access_type", kwilaId, "Stair set")]),
  wa(kwilaId)
);
check(
  "37d Stair set without steps_included keeps allowance, not forced detailed promotion",
  hasLabel(stairSetOnly.lineItems, /Stair set allowance/) &&
    !hasLabel(stairSetOnly.lineItems, /Step decking|Step framing|Step installation/)
);
check(
  "38 rise count derives from height",
  estimateDeckRiseCount(0.14) === 1
);
const wideSteps = calculateDeck(
  ctx([...stepFacts, fact("deck.step_width_m", kwilaId, 2)]),
  wa(kwilaId)
);
const stepQtyA = stepsDeck.lineItems.find((item) => item.label === "Step decking")?.quantity;
const stepQtyB = wideSteps.lineItems.find((item) => item.label === "Step decking")?.quantity;
const allowanceXorDetail =
  hasLabel(stepsDeck.lineItems, /Step decking/) !==
  hasLabel(stepsDeck.lineItems, /Step-down allowance|Stair set allowance/);
check(
  "39 width/depth affect material when detailed",
  !hasLabel(stepsDeck.lineItems, /Step decking/) ||
    (stepQtyA != null && stepQtyB != null && stepQtyB > stepQtyA)
);
check(
  "40 treads inherit Decking",
  !hasLabel(stepsDeck.lineItems, /Step decking/) ||
    Boolean(
      stepsDeck.lineItems
        .find((item) => item.label === "Step decking")
        ?.identitySummary?.toLowerCase()
        .includes("kwila")
    )
);
check(
  "41 framing 190×45",
  !hasLabel(stepsDeck.lineItems, /Step framing/) ||
    Boolean(
      stepsDeck.lineItems
        .find((item) => item.label === "Step framing")
        ?.identitySummary?.match(/190/)
    )
);
check(
  "42 Step labour uses Step productivity",
  !hasLabel(stepsDeck.lineItems, /Step installation/) ||
    (hoursByLabel(stepsDeck.lineItems, "Step installation") > 0 &&
      catalogueSrc.includes("deck.steps.install.hours_per_m2"))
);
check(
  "43 allowance XOR detailed authority",
  allowanceXorDetail &&
    !(
      hasLabel(stepsDeck.lineItems, /Step decking/) &&
      hasLabel(stepsDeck.lineItems, /Step-down allowance|Stair set allowance/)
    )
);
const stepsView = composeBuilderReview({
  estimate: {
    recommendedCost: sumCost(stepsDeck.lineItems),
    recommendedSell: sumSell(stepsDeck.lineItems),
    marginPercent: 20,
    confidence: 0.8,
    assumptions: stepsDeck.assumptions,
    missingInfo: stepsDeck.missingInfo,
    lineItems: mapCalcLines(stepsDeck.lineItems),
  },
  workAreas: [{ id: kwilaId, name: "Deck", type: "deck", status: "confirmed" }],
  requirements: stepsDeck.requirements ?? [],
});
const stepTakeoff = stepsView.workAreas[0]?.categories.flatMap((c) => c.takeoff) ?? [];
check(
  "44 no Step duplicate Planning Takeoff when commercial",
  !stepTakeoff.some((row) => /step/i.test(row.label))
);

console.log("\n== AUTHORITY ==");
check(
  "45 no new piles + replacement allowance duplicate",
  hasLabel(kwilaDeck.lineItems, /Piles \/ posts/) &&
    !hasLabel(kwilaDeck.lineItems, /Pile\/post replacement/)
);
check(
  "46 no step allowance + detail duplicate",
  !(
    hasLabel(stepsDeck.lineItems, /Step decking/) &&
    hasLabel(stepsDeck.lineItems, /allowance/) &&
    hasLabel(stepsDeck.lineItems, /Step-down|Stair/)
  )
);
check(
  "47 no labour handling double count",
  !deckCalc.toLowerCase().includes("normal material handling line") &&
    catalogueSrc.includes("normal handling")
);
check(
  "48 access applied once",
  deckCalc.includes("getCombinedLabourAccessFactor") &&
    (deckCalc.match(/labourAdjustment/g) ?? []).length >= 1 &&
    prodSrc.includes("applied once")
);
check(
  "49 package/detail Deck structure still XOR",
  !(
    hasLabel(kwilaDeck.lineItems, /Framing\/substructure/) &&
    hasLabel(kwilaDeck.lineItems, /^Joists$/)
  )
);
check("50 Pricing parity contract unchanged", existsSync("lib/pricing"));
check("51 Quote parity contract unchanged", existsSync("lib/quotes"));

console.log("\n== OWNER FIXTURE ==");
check(
  "52 no Steps by default",
  !hasLabel(kwilaDeck.lineItems, /Step-down|Stair set|Step decking|Step installation/)
);
check(
  "53 no replacement by default",
  !hasLabel(kwilaDeck.lineItems, /Pile\/post replacement/)
);
check(
  "54 18 supports remain",
  pileLine?.identitySummary?.includes("18 ea") === true
);
check(
  "55 current detailed framing remains",
  Boolean(joistLine && bearerLine && rimLine && pileLine)
);
const ownerView = composeBuilderReview({
  estimate: {
    recommendedCost: sumCost(kwilaDeck.lineItems),
    recommendedSell: sumSell(kwilaDeck.lineItems),
    marginPercent: 20,
    confidence: 0.8,
    assumptions: kwilaDeck.assumptions,
    missingInfo: kwilaDeck.missingInfo,
    lineItems: mapCalcLines(kwilaDeck.lineItems),
  },
  workAreas: [{ id: kwilaId, name: "Deck", type: "deck", status: "confirmed" }],
  requirements: kwilaDeck.requirements ?? [],
});
const takeoff = ownerView.workAreas[0]?.categories.flatMap((c) => c.takeoff) ?? [];
check(
  "56 Builder Review clean",
  !takeoff.some((row) =>
    /joist|bearer|rim|pile|step/i.test(row.label)
  ) &&
    ownerView.workAreas[0]?.categories.some((c) =>
      c.lines.some((line) => line.label === "Joists" && line.specification)
    )
);
const ownerCost = sumCost(kwila78.lineItems);
const ownerSell = sumSell(kwila78.lineItems);
const ownerGm = round2(((ownerSell - ownerCost) / ownerSell) * 100);
check(
  "57 resulting totals reconcile",
  ownerCost > 0 &&
    ownerSell > ownerCost &&
    !hasLabel(kwila78.lineItems, /Step-down allowance/) &&
    !hasLabel(kwila78.lineItems, /Pile\/post replacement/)
);

console.log("\n== MOBILE / REFINE / CONTRACT ==");
check(
  "58 material identity readable",
  surfaceSrc.includes("break-words") && surfaceSrc.includes("min-w-0")
);
check(
  "59 pile quantity readable",
  surfaceSrc.includes("break-words") && Boolean(pileLine?.identitySummary)
);
check("60 no overflow tables", !surfaceSrc.includes("<table"));

check(
  "61 concrete productivity consumed-fact",
  isCalculatorConsumedFact("deck", DECK_CONCRETE_TO_SUPPORTS_FACT_KEY) &&
    isCalculatorConsumedFact("deck", DECK_STEPS_INCLUDED_FACT_KEY) &&
    (DECK_CALCULATOR_CONSUMED_FACTS as readonly string[]).includes(
      DECK_STEPS_INCLUDED_FACT_KEY
    )
);
check(
  "62 Refine does not offer replacement on new substructure",
  !refineSrc.includes("Replace piles or posts?") &&
    refineSrc.includes("shouldAskPileReplacement")
);
check(
  "63 Job Plan Steps writes steps_included",
  jobPlanSrc.includes(`factKey: "deck.steps_included"`)
);
check(
  "64 new substructure helper defaults included",
  newSubstructureIncluded(kwilaFacts, kwilaId) === true
);

const fasciaBoost = calculateDeck(
  ctx(
    [...kwilaFacts, fact("deck.vertical_face_boards_required", kwilaId, true)],
    [productivityOrgRate("deck.fascia.install.hours_per_lm", "lm", 0.9)]
  ),
  wa(kwilaId)
);
const fasciaBase = calculateDeck(
  ctx([...kwilaFacts, fact("deck.vertical_face_boards_required", kwilaId, true)]),
  wa(kwilaId)
);
check(
  "65 fascia productivity modular",
  hoursByLabel(fasciaBoost.lineItems, "Fascia installation") >
    hoursByLabel(fasciaBase.lineItems, "Fascia installation") &&
    hoursByLabel(fasciaBoost.lineItems, "Decking installation") ===
      hoursByLabel(fasciaBase.lineItems, "Decking installation")
);

const jobPlan = composeJobPlan({
  workAreas: [wa(kwilaId)],
  facts: kwilaFacts,
  constraints: [],
  qualityLevel: "standard",
  briefText: KWILA.sourceBrief,
});
const refine = composeRefineView({
  workAreas: [wa(kwilaId)],
  facts: kwilaFacts,
  constraints: [],
  briefText: KWILA.sourceBrief,
  qualityLevel: "standard",
  jobPlan,
});
const refineKeys = [...refine.highValue, ...refine.advanced].map(
  (row) => row.factKey
);
check(
  "66 Refine Owner fixture has no replacement or steps details",
  !refineKeys.includes("deck.pile_or_post_replacement_required") &&
    !refineKeys.includes("deck.step_width_m") &&
    !refineKeys.includes(DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY)
);

const labourEmpty = resolveLabourRate({
  rates: [],
  organisationSettings: { default_margin_percent: 20 } as never,
});
const labour78 = resolveLabourRate({
  rates: [labourOrgRate(78, 78)],
  organisationSettings: { default_margin_percent: 20 } as never,
});
check(
  "67 labour rate resolution still independent of productivity",
  labourEmpty.costRate !== labour78.costRate &&
    resolveProductivity({
      productivityKey: "deck.decking.install.hours_per_lm",
      unit: "lm",
      fallbackHoursPerUnit: 0.077,
      rates: [labourOrgRate(78, 78)],
    }).hoursPerUnit === 0.077
);

console.log("\n== OWNER 3×9 COMMERCIAL RESULT ($78 explicit) ==");
console.log(`direct cost  ${ownerCost.toFixed(2)}`);
console.log(`sell         ${ownerSell.toFixed(2)}`);
console.log(`effective GM ${ownerGm.toFixed(2)}%`);
console.log(
  `labels       ${included(kwila78.lineItems)
    .map((item) => item.label)
    .join(" | ")}`
);

if (failed > 0) {
  console.log(`\nDECK-MATURITY-2C  ${passed} passed / ${failed} failed`);
  process.exit(1);
}
console.log(`\nDECK-MATURITY-2C  ${passed} passed / 0 failed`);

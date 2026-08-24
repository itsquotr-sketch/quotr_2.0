/**
 * ESTIMATOR-SAFETY-0 — Retaining Wall readiness, backfill integrity,
 * Kitchen rate authority, consumed-fact contract.
 *
 * Run: npx tsx scripts/verify-estimator-safety-0.ts
 */
import { readFileSync } from "node:fs";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { listRefineAdapters } from "../lib/assistant/refine/adapters/registry";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateKitchen, KITCHEN_RESOLVED_ALLOWANCE_KEYS } from "../lib/estimate/calculators/kitchen";
import {
  BACKFILL_REFERENCE_ONLY_ASSUMPTION,
  calculateRetainingWall,
  classifyRetainingWallMaterial,
  RETAINING_WALL_CALCULATOR_CONSUMED_FACTS,
  RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE,
  retainingWallMaterialReadiness,
} from "../lib/estimate/calculators/retaining-wall";
import {
  KITCHEN_BENCHMARKS,
  RETAINING_WALL_BENCHMARKS,
} from "../lib/estimate/benchmark-rates";
import {
  isCalculatorConsumedFact,
  refineFactsAreContractBacked,
} from "../lib/estimate/consumed-facts";
import { isEligibleWorkAreaFallbackRate } from "../lib/estimate/rates";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
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

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function rate(
  partial: Partial<OrganisationRate> & { item_key?: string }
): OrganisationRate {
  return {
    id: partial.id ?? "r1",
    rate_type: partial.rate_type ?? "allowance",
    trade: partial.trade ?? null,
    work_area_type: partial.work_area_type ?? "kitchen",
    item_key: partial.item_key ?? "",
    label: partial.label ?? partial.item_key ?? "rate",
    unit: partial.unit ?? "allowance",
    cost_rate: partial.cost_rate ?? 100,
    sell_rate: partial.sell_rate ?? 150,
    markup_percent: null,
    active: partial.active ?? true,
  };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
};

function baseContext(
  workArea: EstimateWorkArea,
  facts: EstimateFact[],
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext;
}

function composeRw(
  facts: EstimateFact[],
  workAreaId = "rw1"
) {
  const workAreas = [wa(workAreaId, "retaining_wall", "Retaining wall")];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
  const readiness = composeEstimateReadiness({
    clarify,
    jobPlan: plan,
    qualityLevel: "standard",
    constraints: [],
  });
  return { plan, clarify, readiness };
}

const RW = "rw1";
const rwCalcSrc = read("lib/estimate/calculators/retaining-wall.ts");
const kitchenSrc = read("lib/estimate/calculators/kitchen.ts");
const coverageDoc = read("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md");
const consumedSrc = read("lib/estimate/consumed-facts.ts");

console.log("=== ESTIMATOR-SAFETY-0 ===\n");

console.log("--- Retaining Wall readiness ---\n");

const zero = composeRw([]);
check(
  "1 missing length blocks estimate",
  zero.clarify.candidates.some(
    (c) => c.factKey === "retaining_wall.length_m" && c.blocksEstimate
  ) && zero.readiness.blocksEstimate
);
check(
  "2 missing height blocks estimate",
  zero.clarify.candidates.some(
    (c) => c.factKey === "retaining_wall.height_m" && c.blocksEstimate
  ) && zero.readiness.blocksEstimate
);
check(
  "3 missing material blocks estimate",
  zero.clarify.candidates.some(
    (c) => c.factKey === "retaining_wall.material" && c.blocksEstimate
  ) && zero.readiness.blocksEstimate
);
check(
  "4 no silent complete-price path from zero inputs",
  zero.readiness.blocksEstimate &&
    !zero.readiness.enoughToEstimate &&
    !zero.readiness.canEstimateNow &&
    zero.readiness.confidenceLabel == null
);

const coreFacts = [
  fact("retaining_wall.length_m", RW, 12),
  fact("retaining_wall.height_m", RW, 1.2),
  fact("retaining_wall.material", RW, "Timber"),
];
const core = composeRw(coreFacts);
const coreCalc = calculateRetainingWall(
  baseContext(wa(RW, "retaining_wall", "Retaining wall"), coreFacts),
  wa(RW, "retaining_wall", "Retaining wall")
);
check(
  "5 known length/height/material permits current estimate",
  !core.readiness.blocksEstimate &&
    core.readiness.canEstimateNow &&
    coreCalc.lineItems.some((i) => i.label === "Retaining wall materials") &&
    coreCalc.lineItems.some((i) => i.label === "Retaining wall labour")
);
check(
  "6 secondary unknowns may remain assumptions",
  coreCalc.missingInfo.length > 0 && !core.readiness.blocksEstimate
);
check(
  "7 Job Plan/Clarify does not ask post_spacing",
  !core.clarify.candidates.some((c) => c.factKey === "retaining_wall.post_spacing_m") &&
    !zero.clarify.candidates.some((c) => c.factKey === "retaining_wall.post_spacing_m") &&
    !core.plan.cards.some((card) =>
      [...card.included, ...card.notIncluded, ...card.notConfirmed].some(
        (item) => item.sourceFactKey === "retaining_wall.post_spacing_m"
      )
    )
);

const noMaterial = composeRw([
  fact("retaining_wall.length_m", RW, 12),
  fact("retaining_wall.height_m", RW, 1.2),
]);
check(
  "8 no fake default material",
  noMaterial.clarify.candidates.some((c) => c.factKey === "retaining_wall.material") &&
    !noMaterial.plan.cards[0]?.specChips.some((c) => /timber/i.test(c.value)) &&
    classifyRetainingWallMaterial(null) === "missing"
);

check(
  "9 missing core facts are not presented as resolved confidence",
  zero.readiness.confidenceLabel == null &&
    zero.readiness.heading === "Need a bit more" &&
    (zero.readiness.blockerCopy ?? "").toLowerCase().includes("retaining wall")
);

const lengthOnly = composeRw([fact("retaining_wall.length_m", RW, 8)]);
check(
  "9b missing height still blocks when length known",
  lengthOnly.readiness.blocksEstimate &&
    lengthOnly.clarify.candidates.some((c) => c.factKey === "retaining_wall.height_m")
);

const highLow = composeRw([
  fact("retaining_wall.length_m", RW, 8),
  fact("retaining_wall.height_high_m", RW, 1.8),
  fact("retaining_wall.height_low_m", RW, 0.6),
  fact("retaining_wall.material", RW, "Block"),
]);
check(
  "9c high/low height satisfies height hard minimum",
  !highLow.clarify.candidates.some((c) => c.factKey === "retaining_wall.height_m") &&
    !highLow.readiness.blocksEstimate
);

const notSureMaterial = composeRw([
  fact("retaining_wall.length_m", RW, 8),
  fact("retaining_wall.height_m", RW, 1),
  fact("retaining_wall.material", RW, "Not sure"),
]);
check(
  "9d Not sure material still blocks",
  notSureMaterial.readiness.blocksEstimate &&
    notSureMaterial.clarify.candidates.some((c) => c.factKey === "retaining_wall.material") &&
    retainingWallMaterialReadiness(
      [
        fact("retaining_wall.length_m", RW, 8),
        fact("retaining_wall.height_m", RW, 1),
        fact("retaining_wall.material", RW, "Not sure"),
      ],
      RW
    ) === "NOT_SURE"
);

console.log("\n--- RW unsupported material ---\n");

check(
  "R1 aliases map only where canonical tokens support them",
  classifyRetainingWallMaterial("timber") === "timber" &&
    classifyRetainingWallMaterial("treated timber") === "timber" &&
    classifyRetainingWallMaterial("concrete") === "concrete" &&
    classifyRetainingWallMaterial("block") === "concrete" &&
    classifyRetainingWallMaterial("concrete block") === "concrete" &&
    classifyRetainingWallMaterial("Gabion") === "unsupported" &&
    classifyRetainingWallMaterial("wood") === "unsupported" &&
    classifyRetainingWallMaterial("Hardwood") === "unsupported"
);

const gabionFacts = [
  fact("retaining_wall.length_m", RW, 10),
  fact("retaining_wall.height_m", RW, 1.5),
  fact("retaining_wall.material", RW, "Gabion"),
];
const gabionUi = composeRw(gabionFacts);
const gabion = calculateRetainingWall(
  baseContext(wa(RW, "retaining_wall", "Retaining wall"), gabionFacts),
  wa(RW, "retaining_wall", "Retaining wall")
);
const gabionMaterialQ = gabionUi.clarify.candidates.find(
  (c) => c.factKey === "retaining_wall.material"
);
check(
  "R1 missing material still MISSING",
  retainingWallMaterialReadiness(
    [fact("retaining_wall.length_m", RW, 12), fact("retaining_wall.height_m", RW, 1.2)],
    RW
  ) === "MISSING"
);
check(
  "R1 explicit unsupported blocks Estimate Ready",
  gabionUi.readiness.blocksEstimate &&
    !gabionUi.readiness.canEstimateNow &&
    !gabionUi.readiness.enoughToEstimate &&
    retainingWallMaterialReadiness(gabionFacts, RW) === "UNSUPPORTED_EXPLICIT"
);
check(
  "R1 unsupported message and change-material options; no Estimate now",
  gabionMaterialQ?.blocksEstimate === true &&
    gabionMaterialQ.question === RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE &&
    gabionUi.readiness.blockerCopy === RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE &&
    (gabionMaterialQ.options ?? []).some((o) => /timber/i.test(String(o))) &&
    (gabionMaterialQ.options ?? []).some((o) => /concrete/i.test(String(o))) &&
    (gabionMaterialQ.options ?? []).some((o) => /block/i.test(String(o)))
);
check(
  "R1 unsupported cannot emit labour-only complete-looking estimate",
  gabion.lineItems.length === 0 &&
    !gabion.lineItems.some((i) => /labour/i.test(i.label)) &&
    !gabion.lineItems.some((i) => i.label === "Retaining wall materials")
);
check(
  "R1 no silent timber fallback and no $0 material",
  classifyRetainingWallMaterial("Gabion") === "unsupported" &&
    !gabion.lineItems.some((i) => i.itemKey === "retaining_wall.material.timber.face_m2") &&
    !gabion.lineItems.some(
      (i) =>
        i.label === "Retaining wall materials" &&
        (i.recommendedCost === 0 || i.recommendedSell === 0)
    ) &&
    !rwCalcSrc.includes('includes("wood")')
);

const gabionEstimate = calculateEstimate(
  baseContext(wa(RW, "retaining_wall", "Retaining wall"), gabionFacts)
);
const gabionReview = composeBuilderReview({
  estimate: {
    recommendedCost: gabionEstimate.recommendedCost,
    recommendedSell: gabionEstimate.recommendedSell,
    marginPercent: gabionEstimate.marginPercent,
    confidence: gabionEstimate.confidence,
    assumptions: gabionEstimate.assumptions,
    missingInfo: gabionEstimate.missingInfo,
    lineItems: gabionEstimate.lineItems.map((item, index) => ({
      id: `li-${index}`,
      workAreaName: item.workAreaName,
      label: item.label,
      category: item.category,
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
      includedInTotal: item.includedInTotal !== false,
    })),
  },
  workAreas: [{ id: RW, type: "retaining_wall", name: "Retaining wall", status: "confirmed" }],
  requirements: [],
});
check(
  "R1 Builder Review cannot present labour without required material",
  !JSON.stringify(gabionReview).includes("Retaining wall labour") &&
    !JSON.stringify(gabionReview).includes("Retaining wall materials") &&
    gabionEstimate.lineItems.length === 0
);

function supportedRw(material: string) {
  const facts = [
    fact("retaining_wall.length_m", RW, 10),
    fact("retaining_wall.height_m", RW, 1.5),
    fact("retaining_wall.material", RW, material),
  ];
  return {
    ui: composeRw(facts),
    calc: calculateRetainingWall(
      baseContext(wa(RW, "retaining_wall", "Retaining wall"), facts),
      wa(RW, "retaining_wall", "Retaining wall")
    ),
  };
}
const timberCase = supportedRw("Timber");
const treatedTimberCase = supportedRw("treated timber");
const concreteCase = supportedRw("Concrete");
const blockCase = supportedRw("Block");
const concreteBlockCase = supportedRw("concrete block");
function materialLine(result: {
  lineItems: { label: string; recommendedCost: number; itemKey?: string }[];
}) {
  return result.lineItems.find((i) => i.label === "Retaining wall materials");
}
const timberFace = 10 * 1.5 * RETAINING_WALL_BENCHMARKS.timberFace.cost;
const concreteFace = 10 * 1.5 * RETAINING_WALL_BENCHMARKS.concreteFace.cost;
check(
  "R1 supported timber passes",
  !timberCase.ui.readiness.blocksEstimate &&
    timberCase.ui.readiness.canEstimateNow &&
    timberCase.calc.lineItems.some((i) => i.label === "Retaining wall labour") &&
    materialLine(timberCase.calc)?.recommendedCost === timberFace &&
    materialLine(treatedTimberCase.calc)?.recommendedCost === timberFace
);
check(
  "R1 supported concrete passes",
  !concreteCase.ui.readiness.blocksEstimate &&
    concreteCase.calc.lineItems.some((i) => i.label === "Retaining wall labour") &&
    materialLine(concreteCase.calc)?.recommendedCost === concreteFace
);
check(
  "R1 supported block passes",
  !blockCase.ui.readiness.blocksEstimate &&
    materialLine(blockCase.calc)?.recommendedCost === concreteFace &&
    materialLine(concreteBlockCase.calc)?.recommendedCost === concreteFace
);

const rw2GoldenFacts = [
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
];
const rw2Golden = calculateEstimate({
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [wa("rw2", "retaining_wall", "RW 2")],
  facts: rw2GoldenFacts,
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as never);
check(
  "R1 known-input RW golden money unchanged",
  Math.round(rw2Golden.recommendedSell) === 7345
);

check(
  "R1 future pricing-required path documented not built",
  coverageDoc.includes("RW-UNSUPPORTED-MATERIAL-PRICING-01") &&
    coverageDoc.includes("PRICING_REQUIRED") &&
    !rwCalcSrc.includes("PRICING_REQUIRED")
);

console.log("\n--- Backfill integrity ---\n");

check(
  "10 backfill volume narrative does not claim pricing impact",
  !rwCalcSrc.includes("Backfill volume calculated") &&
    rwCalcSrc.includes("BACKFILL_REFERENCE_ONLY_ASSUMPTION") &&
    rwCalcSrc.includes("not volume priced")
);

const backfillFacts = [
  fact("retaining_wall.length_m", RW, 10),
  fact("retaining_wall.height_m", RW, 1),
  fact("retaining_wall.material", RW, "Timber"),
  fact("retaining_wall.backfill_included", RW, true),
  fact("retaining_wall.backfill_depth_m", RW, 0.3),
  fact("retaining_wall.backfill_length_m", RW, 10),
  fact("retaining_wall.backfill_height_m", RW, 1),
];
const backfillResult = calculateRetainingWall(
  baseContext(wa(RW, "retaining_wall", "Retaining wall"), backfillFacts),
  wa(RW, "retaining_wall", "Retaining wall")
);
const backfillLine = backfillResult.lineItems.find((i) => i.label === "Backfill allowance");
check(
  "11 no backfill formula/rate behaviour changed",
  backfillLine?.quantity === 10 &&
    backfillLine.unit === "face m²" &&
    backfillLine.itemKey === "retaining_wall.backfill.face_m2" ||
    (backfillLine?.unit === "face m²" && backfillLine.quantity === 10)
);
check(
  "12 current allowance remains reconciled",
  backfillLine != null &&
    backfillLine.materialBuildUp?.buildUpType === "backfill_volume" &&
    backfillResult.assumptions.includes(BACKFILL_REFERENCE_ONLY_ASSUMPTION) &&
    !backfillResult.assumptions.some((a) => /volume calculated/i.test(a))
);

console.log("\n--- Kitchen rate authority ---\n");

check(
  "13 appliance line uses resolver",
  kitchenSrc.includes("KITCHEN_RESOLVED_ALLOWANCE_KEYS.appliances") &&
    kitchenSrc.includes("kitchenAllowanceRates")
);
check(
  "14 appliance-install line uses resolver",
  kitchenSrc.includes("KITCHEN_RESOLVED_ALLOWANCE_KEYS.applianceInstall")
);
check(
  "15 splashback line uses resolver",
  kitchenSrc.includes("KITCHEN_RESOLVED_ALLOWANCE_KEYS.splashback")
);
check(
  "16 rangehood line uses resolver",
  kitchenSrc.includes("KITCHEN_RESOLVED_ALLOWANCE_KEYS.rangehood")
);

const kitchenWa = wa("k1", "kitchen", "Kitchen");
const kitchenFacts = [
  fact("kitchen.area_m2", "k1", 12),
  fact("kitchen.cabinetry_included", "k1", true),
  fact("kitchen.benchtop_included", "k1", true),
  fact("kitchen.appliances_included", "k1", true),
  fact("kitchen.splashback_included", "k1", true),
  fact("kitchen.rangehood_included", "k1", true),
  fact("kitchen.plumbing_changes", "k1", "None"),
  fact("kitchen.electrical_changes", "k1", "None"),
];
const kitchenBenchmark = calculateKitchen(
  baseContext(kitchenWa, kitchenFacts),
  kitchenWa
);
function line(result: { lineItems: { label: string; recommendedCost: number; recommendedSell: number; itemKey?: string; rateSource?: string }[] }, label: string) {
  return result.lineItems.find((i) => i.label === label);
}
const appliances = line(kitchenBenchmark, "Appliances allowance");
const splashback = line(kitchenBenchmark, "Splashback allowance");
const rangehood = line(kitchenBenchmark, "Rangehood/venting allowance");
check(
  "17 benchmark fallback unchanged",
  appliances?.recommendedCost === KITCHEN_BENCHMARKS.appliances.cost &&
    appliances.recommendedSell === KITCHEN_BENCHMARKS.appliances.sell &&
    splashback?.recommendedCost === KITCHEN_BENCHMARKS.splashback.cost &&
    rangehood?.recommendedCost === KITCHEN_BENCHMARKS.rangehood.cost
);

const companyRates = [
  rate({
    id: "a1",
    item_key: KITCHEN_RESOLVED_ALLOWANCE_KEYS.appliances,
    cost_rate: 4100,
    sell_rate: 6200,
  }),
  rate({
    id: "i1",
    item_key: KITCHEN_RESOLVED_ALLOWANCE_KEYS.applianceInstall,
    cost_rate: 1111,
    sell_rate: 2222,
  }),
  rate({
    id: "s1",
    item_key: KITCHEN_RESOLVED_ALLOWANCE_KEYS.splashback,
    cost_rate: 950,
    sell_rate: 1400,
  }),
  rate({
    id: "h1",
    item_key: KITCHEN_RESOLVED_ALLOWANCE_KEYS.rangehood,
    cost_rate: 700,
    sell_rate: 1050,
  }),
];
const kitchenCompany = calculateKitchen(
  baseContext(kitchenWa, kitchenFacts, companyRates),
  kitchenWa
);
check(
  "18 exact company rate overrides",
  line(kitchenCompany, "Appliances allowance")?.recommendedCost === 4100 &&
    line(kitchenCompany, "Splashback allowance")?.recommendedCost === 950 &&
    line(kitchenCompany, "Rangehood/venting allowance")?.recommendedCost === 700
);

const installFacts = [
  fact("kitchen.area_m2", "k1", 12),
  fact("kitchen.appliances_client_supplied", "k1", true),
  fact("kitchen.cabinetry_included", "k1", true),
  fact("kitchen.benchtop_included", "k1", true),
  fact("kitchen.plumbing_changes", "k1", "None"),
  fact("kitchen.electrical_changes", "k1", "None"),
];
const installCompany = calculateKitchen(
  baseContext(kitchenWa, installFacts, companyRates),
  kitchenWa
);
check(
  "18b appliance-install company rate overrides",
  line(installCompany, "Appliance installation allowance")?.recommendedCost === 1111
);

const unrelated = calculateKitchen(
  baseContext(kitchenWa, kitchenFacts, [
    rate({
      id: "cab",
      item_key: KITCHEN_RESOLVED_ALLOWANCE_KEYS.cabinetry,
      cost_rate: 99999,
      sell_rate: 99999,
    }),
  ]),
  kitchenWa
);
check(
  "19 unrelated company rate does not steal",
  line(unrelated, "Appliances allowance")?.recommendedCost ===
    KITCHEN_BENCHMARKS.appliances.cost &&
    line(unrelated, "Splashback allowance")?.recommendedCost ===
      KITCHEN_BENCHMARKS.splashback.cost
);

const wrongUnit = calculateKitchen(
  baseContext(kitchenWa, kitchenFacts, [
    rate({
      id: "wu",
      item_key: KITCHEN_RESOLVED_ALLOWANCE_KEYS.appliances,
      unit: "m2",
      cost_rate: 8888,
      sell_rate: 9999,
    }),
  ]),
  kitchenWa
);
check(
  "20 wrong unit does not bind",
  line(wrongUnit, "Appliances allowance")?.recommendedCost ===
    KITCHEN_BENCHMARKS.appliances.cost
);

const estimateParity = calculateEstimate(baseContext(kitchenWa, kitchenFacts));
const kitchenDirect = calculateKitchen(baseContext(kitchenWa, kitchenFacts), kitchenWa);
const estimateKitchenCost = estimateParity.lineItems
  .filter((i) => i.workAreaId === "k1")
  .reduce((sum, i) => sum + i.recommendedCost, 0);
const directCost = kitchenDirect.lineItems.reduce((sum, i) => sum + i.recommendedCost, 0);
check("21 Pricing parity", Math.abs(estimateKitchenCost - directCost) < 0.01);

check(
  "22 Quote safety — labels and lump semantics unchanged",
  appliances?.label === "Appliances allowance" &&
    splashback?.label === "Splashback allowance" &&
    rangehood?.label === "Rangehood/venting allowance" &&
    line(kitchenBenchmark, "Cabinetry allowance") != null &&
    line(kitchenBenchmark, "Benchtop supply/install allowance") != null
);

const blankKey = calculateKitchen(
  baseContext(kitchenWa, kitchenFacts, [
    rate({
      id: "blank",
      item_key: "",
      work_area_type: "kitchen",
      unit: "allowance",
      cost_rate: 7777,
      sell_rate: 8888,
    }),
  ]),
  kitchenWa
);
check(
  "22b blank-key generic rate does not bind named kitchen lines",
  line(blankKey, "Appliances allowance")?.recommendedCost ===
    KITCHEN_BENCHMARKS.appliances.cost &&
    isEligibleWorkAreaFallbackRate({
      rate: rate({
        item_key: "",
        work_area_type: "kitchen",
        unit: "allowance",
        cost_rate: 7777,
      }),
      rateType: "allowance",
      itemKey: KITCHEN_RESOLVED_ALLOWANCE_KEYS.appliances,
      workAreaType: "kitchen",
      unit: "allowance",
    }) === false
);

check(
  "R1 remaining Kitchen lines classified; no new resolver binding",
  !Object.values(KITCHEN_RESOLVED_ALLOWANCE_KEYS).some((key) =>
    /flooring|plumbing|electrical|materials_package/.test(key)
  ) &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.flooring") &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.plumbing") &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.electrical") &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.materialsPerM2") &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.minimumPackage") &&
    !kitchenSrc.includes("kitchen.flooring.allowance") &&
    !kitchenSrc.includes("kitchen.plumbing.allowance") &&
    !kitchenSrc.includes("kitchen.electrical.allowance") &&
    coverageDoc.includes("C NEEDS_RATE_IDENTITY_BEFORE_RESOLVER") &&
    coverageDoc.includes("B PACKAGE_BENCHMARK_ONLY_BY_CURRENT_CONTRACT")
);

console.log("\n--- Consumed facts ---\n");

check(
  "23 calculator-owned contract exists",
  consumedSrc.includes("CALCULATOR KNOWS WHAT IT CONSUMES") &&
    consumedSrc.includes("ASSISTANT KNOWS WHEN TO ASK IT") &&
    consumedSrc.includes("hasCalculatorConsumedFactContract")
);

const deckAdapter = listRefineAdapters().find((a) => a.workAreaType === "deck");
const bathroomAdapter = listRefineAdapters().find((a) => a.workAreaType === "bathroom");
const paintingAdapter = listRefineAdapters().find((a) => a.workAreaType === "painting");

function adapterKeys(
  adapter: NonNullable<typeof deckAdapter>,
  notConfirmed: {
    id: string;
    label: string;
    sourceFactKey: string | null;
    write: {
      factKey: string;
      valueType: "boolean";
      includeValue: true;
      excludeValue: false;
      label: string;
    } | null;
    workAreaId: string;
  }[] = []
): string[] {
  return adapter
    .candidates({
      workAreaId: "wa",
      workAreaName: "Test",
      facts: [],
      briefText: null,
      notConfirmed,
    })
    .map((c) => c.factKey)
    .filter((k): k is string => Boolean(k));
}

const deckKeys = adapterKeys(deckAdapter!, [
  {
    id: "removal",
    label: "Existing deck removal",
    sourceFactKey: "deck.existing_deck_removal",
    write: {
      factKey: "deck.existing_deck_removal",
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: "Existing deck removal",
    },
    workAreaId: "wa",
  },
  {
    id: "fascia",
    label: "Fascia",
    sourceFactKey: "deck.vertical_face_boards_required",
    write: {
      factKey: "deck.vertical_face_boards_required",
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: "Fascia",
    },
    workAreaId: "wa",
  },
  {
    id: "steps",
    label: "Steps",
    sourceFactKey: "deck.steps_included",
    write: {
      factKey: "deck.steps_included",
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: "Steps",
    },
    workAreaId: "wa",
  },
  {
    id: "balustrade",
    label: "Balustrade",
    sourceFactKey: "deck.balustrade_required",
    write: {
      factKey: "deck.balustrade_required",
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: "Balustrade",
    },
    workAreaId: "wa",
  },
]);
check(
  "24 Deck refine keys verified",
  Boolean(deckAdapter) && refineFactsAreContractBacked("deck", deckKeys) && deckKeys.length > 0
);

const bathroomKeys = adapterKeys(bathroomAdapter!, [
  {
    id: "demo",
    label: "Demolition",
    sourceFactKey: "bathroom.demolition_required",
    write: {
      factKey: "bathroom.demolition_required",
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: "Demolition",
    },
    workAreaId: "wa",
  },
]);
check(
  "25 Bathroom refine keys verified",
  Boolean(bathroomAdapter) &&
    refineFactsAreContractBacked("bathroom", bathroomKeys) &&
    bathroomKeys.includes("bathroom.demolition_required") &&
    bathroomKeys.includes("bathroom.plumbing_changes")
);

const paintingKeys = adapterKeys(paintingAdapter!);
check(
  "26 Painting refine keys verified",
  Boolean(paintingAdapter) &&
    refineFactsAreContractBacked("painting", paintingKeys) &&
    paintingKeys.includes("painting.coats_required")
);

check(
  "27 false consumed key fails verifier",
  isCalculatorConsumedFact("deck", "retaining_wall.gabion_mesh") === false &&
    isCalculatorConsumedFact("retaining_wall", "retaining_wall.gabion_mesh") ===
      false &&
    refineFactsAreContractBacked("deck", ["retaining_wall.gabion_mesh"]) === false &&
    !RETAINING_WALL_CALCULATOR_CONSUMED_FACTS.includes(
      "retaining_wall.gabion_mesh" as never
    )
);

check(
  "28 new adapter contract requirement documented/enforced",
  listRefineAdapters().every((adapter) =>
    refineFactsAreContractBacked(adapter.workAreaType, adapterKeys(adapter, []))
  ) &&
    coverageDoc.includes("FOUNDATION COMPLETE") &&
    consumedSrc.includes("not mature unless")
);

const refineDropped = composeRefineView({
  briefText: null,
  qualityLevel: "standard",
  workAreas: [wa("d1", "deck", "Deck")],
  facts: [],
  constraints: [],
  jobPlan: {
    cards: [
      {
        workAreaId: "d1",
        workAreaType: "deck",
        name: "Deck",
        notConfirmed: [
          {
            id: "fake",
            label: "Post spacing",
            sourceFactKey: "retaining_wall.post_spacing_m",
            write: null,
            workAreaId: "d1",
          },
        ],
      },
    ],
  },
});
check(
  "28b compose drops facts outside calculator contract",
  !refineDropped.highValue.some((c) => c.factKey === "retaining_wall.post_spacing_m") &&
    !refineDropped.advanced.some((c) => c.factKey === "retaining_wall.post_spacing_m")
);

console.log("\n--- Commercial / authority ---\n");

const deckFacts = [
  fact("deck.area_m2", "d1", 36),
  fact("deck.board_material", "d1", "Hardwood"),
  fact("deck.board_width_mm", "d1", 140),
  fact("deck.height_m", "d1", 0.8),
];
const deckResult = calculateDeck(
  baseContext(wa("d1", "deck", "Deck"), deckFacts),
  wa("d1", "deck", "Deck")
);
check(
  "29 no Deck money change (priced lines still present)",
  deckResult.lineItems.some((i) => i.label === "Decking") &&
    deckResult.lineItems.some((i) => /labour/i.test(i.label))
);

check(
  "30 no unrelated WA money change in this batch",
  kitchenSrc.includes("KITCHEN_BENCHMARKS.cabinetry") &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.plumbing") &&
    rwCalcSrc.includes("assumedValue: 10") &&
    rwCalcSrc.includes("assumedValue: 1.5")
);

check(
  "31 rate hierarchy unchanged except Kitchen bypass correction",
  kitchenSrc.includes("kitchenAllowanceRates") &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.flooring") &&
    kitchenSrc.includes("KITCHEN_BENCHMARKS.plumbing") &&
    kitchenSrc.includes("resolveLabourRate") &&
    kitchenSrc.includes("resolveRate")
);

check(
  "32 structural authority unchanged",
  !rwCalcSrc.includes("DECK_JOISTS_COMPONENT_KEY") &&
    read("lib/estimate/component-authority.ts").includes("getComponentCommercialAuthority")
);

check(
  "33 sell authority unchanged",
  read("lib/estimate/rates.ts").includes("classifyResolvedSell") &&
    kitchenSrc.includes("rateFieldsFromResolved")
);

check(
  "33b unsupported material does not invent timber pricing",
  classifyRetainingWallMaterial("Gabion") === "unsupported" &&
    gabion.lineItems.length === 0 &&
    !gabion.lineItems.some((i) => i.label === "Retaining wall materials")
);

const rwEstimate = calculateEstimate(
  baseContext(wa(RW, "retaining_wall", "Retaining wall"), coreFacts)
);
const builderReview = composeBuilderReview({
  estimate: {
    recommendedCost: rwEstimate.recommendedCost,
    recommendedSell: rwEstimate.recommendedSell,
    marginPercent: rwEstimate.marginPercent,
    confidence: rwEstimate.confidence,
    assumptions: rwEstimate.assumptions,
    missingInfo: rwEstimate.missingInfo,
    lineItems: rwEstimate.lineItems.map((item, index) => ({
      id: `li-${index}`,
      workAreaName: item.workAreaName,
      label: item.label,
      category: item.category,
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
      includedInTotal: item.includedInTotal !== false,
    })),
  },
  workAreas: [{ id: RW, type: "retaining_wall", name: "Retaining wall", status: "confirmed" }],
  requirements: [],
});
check(
  "20b Builder Review shows Retaining Wall active lines only",
  builderReview.workAreas.some((g) => g.workAreaType === "retaining_wall") &&
    !JSON.stringify(builderReview).includes("post_spacing")
);

check(
  "34 Job Plan shows Retaining Wall card",
  core.plan.cards.some((c) => c.workAreaType === "retaining_wall") &&
    (core.plan.cards[0]?.specChips.some((c) => c.value.includes("12")) ?? false)
);

check(
  "35 coverage records SAFETY HARDENED / RATE AUTHORITY FIXED / FOUNDATION COMPLETE",
  coverageDoc.includes("SAFETY HARDENED") &&
    coverageDoc.includes("RATE AUTHORITY FIXED") &&
    coverageDoc.includes("FOUNDATION COMPLETE") &&
    coverageDoc.includes("still MINIMAL") &&
    coverageDoc.includes("UNSUPPORTED_EXPLICIT") &&
    coverageDoc.includes("RW-UNSUPPORTED-MATERIAL-PRICING-01")
);

console.log("\n--- ESTIMATOR-SAFETY-0 SUMMARY ---");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}

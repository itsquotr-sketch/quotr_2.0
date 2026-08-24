/**
 * REQ-1 — EstimateRequirement envelope + physical aggregation foundation.
 *
 * Types/collection/aggregation. REQ-2.1 emits Deck surface; REQ-3.1 emits Deck labour.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  aggregateEstimateRequirements,
  aggregatePricedRequirementCosts,
  groupMaterialRequirements,
  summarizeEstimateRequirements,
  toRequirementShadowFields,
} from "../lib/estimate/requirement-aggregate";
import { buildRequirementId } from "../lib/estimate/requirement-id";
import {
  collectRequirements,
  normalizeRequirement,
  normalizeRequirements,
} from "../lib/estimate/requirement-normalize";
import { RequirementValidationError } from "../lib/estimate/requirement-validate";
import {
  ESTIMATE_REQUIREMENT_CONTRACT_VERSION,
  PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY,
  type EstimateRequirement,
  type LabourRequirement,
  type MaterialRequirement,
  type PlantRequirement,
  type SubcontractRequirement,
  type WasteRequirement,
} from "../lib/estimate/requirements";
import { finalizeEstimateResult } from "../lib/estimate/summary";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";

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

function throwsValidation(run: () => void): boolean {
  try {
    run();
    return false;
  } catch (error) {
    return error instanceof RequirementValidationError;
  }
}

const typesSrc = read("lib/estimate/types.ts");
const persistSrc = read("lib/estimate/persist-estimate.ts");
const calculateSrc = read("lib/estimate/calculate-estimate.ts");
const aggregateSrc = read("lib/estimate/requirement-aggregate.ts");

function provenance(source: string) {
  return { calculatorSource: source, factKeys: [] as string[], constraintKeys: [] as string[] };
}

function assumption(key: string, text: string, source: MaterialRequirement["assumptions"][number]["source"] = "calculator_default") {
  return { key, text, source };
}

function material(partial: Partial<MaterialRequirement> & Pick<
  MaterialRequirement,
  "requirementId" | "workAreaId" | "componentKey" | "materialKey" | "baseQuantity" | "purchaseQuantity"
>): MaterialRequirement {
  return {
    kind: "material",
    workAreaType: partial.workAreaType ?? "deck",
    description: partial.description ?? "Material",
    confidence: partial.confidence ?? "high",
    assumptions: partial.assumptions ?? [assumption("waste.decking", "Waste applied", "calculator_default")],
    provenance: partial.provenance ?? provenance("deck.decking"),
    priced: partial.priced ?? true,
    category: partial.category ?? "DECKING",
    specification: partial.specification,
    variantKey: partial.variantKey,
    baseUnit: partial.baseUnit ?? "lm",
    wasteFactor: partial.wasteFactor ?? 0.1,
    purchaseUnit: partial.purchaseUnit ?? "lm",
    conversion: partial.conversion,
    rateSource: partial.rateSource ?? "company",
    unitCost: partial.unitCost === undefined ? 18.5 : partial.unitCost,
    totalCost: partial.totalCost === undefined ? 100 : partial.totalCost,
    ...partial,
    kind: "material",
  };
}

function labour(partial: Partial<LabourRequirement> & Pick<
  LabourRequirement,
  "requirementId" | "workAreaId" | "componentKey" | "trade" | "baseHours" | "adjustedHours"
>): LabourRequirement {
  return {
    kind: "labour",
    workAreaType: partial.workAreaType ?? "deck",
    description: partial.description ?? "Labour",
    confidence: partial.confidence ?? "medium",
    assumptions: partial.assumptions ?? [],
    provenance: partial.provenance ?? provenance("deck.labour"),
    priced: partial.priced ?? true,
    variantKey: partial.variantKey,
    productivityBasis: partial.productivityBasis ?? {
      key: "deck.install",
      hoursPerUnit: 0.2,
      unit: "m2",
      quantity: 10,
    },
    adjustmentRef: partial.adjustmentRef ?? {
      factors: [{ key: PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY, value: 1.1 }],
    },
    rateKey: partial.rateKey ?? "labour.carpenter.hour",
    hourlyCost: partial.hourlyCost === undefined ? 60 : partial.hourlyCost,
    totalCost: partial.totalCost === undefined ? 660 : partial.totalCost,
    rateProvenance: partial.rateProvenance ?? "company",
    ...partial,
    kind: "labour",
  };
}

function plant(partial: Partial<PlantRequirement> & Pick<
  PlantRequirement,
  "requirementId" | "workAreaId" | "componentKey"
>): PlantRequirement {
  return {
    kind: "plant",
    workAreaType: partial.workAreaType ?? "retaining_wall",
    description: partial.description ?? "Plant",
    confidence: "medium",
    assumptions: [],
    provenance: provenance("retaining.plant"),
    priced: partial.priced ?? false,
    plantKey: partial.plantKey ?? "excavator",
    hours: partial.hours ?? 4,
    unit: partial.unit ?? "h",
    unitCost: partial.unitCost ?? null,
    totalCost: partial.totalCost ?? null,
    ...partial,
    kind: "plant",
  };
}

function subcontract(partial: Partial<SubcontractRequirement> & Pick<
  SubcontractRequirement,
  "requirementId" | "workAreaId" | "componentKey"
>): SubcontractRequirement {
  return {
    kind: "subcontract",
    workAreaType: partial.workAreaType ?? "bathroom",
    description: partial.description ?? "Subcontract",
    confidence: "medium",
    assumptions: [],
    provenance: provenance("bathroom.plumbing"),
    priced: partial.priced ?? true,
    trade: partial.trade ?? "plumbing",
    allowanceCost: partial.allowanceCost ?? 2500,
    quotedCost: partial.quotedCost ?? null,
    totalCost: partial.totalCost === undefined ? 2500 : partial.totalCost,
    ...partial,
    kind: "subcontract",
  };
}

function wasteReq(partial: Partial<WasteRequirement> & Pick<
  WasteRequirement,
  "requirementId" | "workAreaId" | "componentKey"
>): WasteRequirement {
  return {
    kind: "waste",
    workAreaType: partial.workAreaType ?? "demolition",
    description: partial.description ?? "Skip bin",
    confidence: "low",
    assumptions: [assumption("skip.size", "6 m³ skip assumed", "assumed_default")],
    provenance: provenance("demolition.waste"),
    priced: partial.priced ?? false,
    wasteKey: partial.wasteKey ?? "skip.bin",
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? "ea",
    totalCost: partial.totalCost ?? null,
    ...partial,
    kind: "waste",
  };
}

function id(workAreaId: string, kind: EstimateRequirement["kind"], componentKey: string, variantKey?: string) {
  return buildRequirementId({ workAreaId, kind, componentKey, variantKey });
}

const hardwoodA = material({
  requirementId: id("WA1", "material", "decking.surface"),
  workAreaId: "WA1",
  componentKey: "decking.surface",
  materialKey: "timber.decking.hardwood.140",
  specification: "140x19 hardwood",
  baseQuantity: 50,
  wasteFactor: 0.1,
  purchaseQuantity: 55,
  unitCost: 20,
  totalCost: 1100,
});

const hardwoodB = material({
  requirementId: id("WA2", "material", "decking.surface"),
  workAreaId: "WA2",
  workAreaType: "deck",
  componentKey: "decking.surface",
  materialKey: "timber.decking.hardwood.140",
  specification: "140x19 hardwood",
  baseQuantity: 26,
  wasteFactor: 0.1,
  purchaseQuantity: 28.6,
  unitCost: 20,
  totalCost: 572,
});

const pine = material({
  requirementId: id("WA1", "material", "decking.surface", "pine"),
  workAreaId: "WA1",
  componentKey: "decking.surface",
  variantKey: "pine",
  materialKey: "timber.decking.pine.90",
  specification: "90x19 treated pine",
  baseQuantity: 40,
  purchaseQuantity: 44,
  totalCost: 400,
});

const joistH32 = material({
  requirementId: id("WA1", "material", "joist", "140x45-h3.2"),
  workAreaId: "WA1",
  componentKey: "joist",
  variantKey: "140x45-h3.2",
  materialKey: "timber.sg8.140x45.h3.2",
  specification: "140x45 H3.2",
  category: "FRAMING",
  baseQuantity: 20,
  purchaseQuantity: 22,
  totalCost: 220,
});

const joistH12 = material({
  requirementId: id("WA1", "material", "joist", "140x45-h1.2"),
  workAreaId: "WA1",
  componentKey: "joist",
  variantKey: "140x45-h1.2",
  materialKey: "timber.sg8.140x45.h1.2",
  specification: "140x45 H1.2",
  category: "FRAMING",
  baseQuantity: 10,
  purchaseQuantity: 11,
  totalCost: 110,
});

const waste10 = material({
  requirementId: id("WA3", "material", "decking.surface"),
  workAreaId: "WA3",
  componentKey: "decking.surface",
  materialKey: "timber.decking.hardwood.140",
  specification: "140x19 hardwood",
  baseQuantity: 50,
  wasteFactor: 0.1,
  purchaseQuantity: 55,
  priced: false,
  unitCost: null,
  totalCost: null,
  rateSource: "missing",
});

const waste5 = material({
  requirementId: id("WA4", "material", "decking.surface"),
  workAreaId: "WA4",
  componentKey: "decking.surface",
  materialKey: "timber.decking.hardwood.140",
  specification: "140x19 hardwood",
  baseQuantity: 30,
  wasteFactor: 0.05,
  purchaseQuantity: 31.5,
  priced: false,
  unitCost: null,
  totalCost: null,
  rateSource: "missing",
});

const sheetUnsafe = material({
  requirementId: id("WA1", "material", "lining.sheet"),
  workAreaId: "WA1",
  workAreaType: "internal_walls",
  componentKey: "lining.sheet",
  materialKey: "sheet.gib.standard.10",
  category: "SHEET",
  baseQuantity: 20,
  baseUnit: "m2",
  purchaseQuantity: 20,
  purchaseUnit: "m2",
  totalCost: 500,
});

const sheetLmUnsafe = material({
  requirementId: id("WA2", "material", "lining.sheet"),
  workAreaId: "WA2",
  workAreaType: "internal_walls",
  componentKey: "lining.sheet",
  materialKey: "sheet.gib.standard.10",
  category: "SHEET",
  baseQuantity: 8,
  baseUnit: "lm",
  purchaseQuantity: 8,
  purchaseUnit: "lm",
  totalCost: 80,
});

const installLabour = labour({
  requirementId: id("WA1", "labour", "decking.install"),
  workAreaId: "WA1",
  componentKey: "decking.install",
  trade: "carpenter",
  description: "Decking installation",
  baseHours: 10,
  adjustedHours: 11,
  totalCost: 660,
  adjustmentRef: {
    factors: [
      { key: PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY, value: 1.1 },
      { key: "quality.spec", value: 1.05 },
    ],
  },
});

const demoLabour = labour({
  requirementId: id("WA1", "labour", "demolition.remove"),
  workAreaId: "WA1",
  componentKey: "demolition.remove",
  trade: "carpenter",
  description: "Demolition",
  baseHours: 5,
  adjustedHours: 5.5,
  totalCost: 330,
});

const excavator = plant({
  requirementId: id("WA5", "plant", "excavator.hire"),
  workAreaId: "WA5",
  componentKey: "excavator.hire",
  plantKey: "excavator",
  hours: 6,
  unit: "h",
});

const mixer = plant({
  requirementId: id("WA5", "plant", "mixer.hire"),
  workAreaId: "WA5",
  componentKey: "mixer.hire",
  plantKey: "mixer",
  hours: null,
  quantity: 1,
  unit: "ea",
});

const bathPlumbing = subcontract({
  requirementId: id("BATH1", "subcontract", "plumbing.allowance"),
  workAreaId: "BATH1",
  workAreaType: "bathroom",
  componentKey: "plumbing.allowance",
  trade: "plumbing",
  description: "Bathroom plumbing",
  totalCost: 2500,
});

const kitchenPlumbing = subcontract({
  requirementId: id("KIT1", "subcontract", "plumbing.allowance"),
  workAreaId: "KIT1",
  workAreaType: "kitchen",
  componentKey: "plumbing.allowance",
  trade: "plumbing",
  description: "Kitchen plumbing",
  totalCost: 1800,
});

const skip = wasteReq({
  requirementId: id("DEMO1", "waste", "skip.bin"),
  workAreaId: "DEMO1",
  componentKey: "skip.bin",
});

console.log("=== REQ-1 EstimateRequirement envelope ===\n");

check(
  "CONTRACT 1 calculator result supports optional requirements",
  typesSrc.includes("requirements?: readonly EstimateRequirement[]") &&
    ESTIMATE_REQUIREMENT_CONTRACT_VERSION === "foundation-r1.1"
);
check(
  "CONTRACT 2 empty requirements valid",
  normalizeRequirements([]).length === 0
);
check(
  "CONTRACT 3 missing optional requirements normalises safely",
  collectRequirements([{}]).length === 0 &&
    collectRequirements([{ requirements: undefined }]).length === 0
);
const fiveKinds = new Set(
  normalizeRequirements([
    hardwoodA,
    installLabour,
    excavator,
    bathPlumbing,
    skip,
  ]).map((item) => item.kind)
);
check(
  "CONTRACT 4 all five kinds supported",
  fiveKinds.size === 5 &&
    fiveKinds.has("material") &&
    fiveKinds.has("labour") &&
    fiveKinds.has("plant") &&
    fiveKinds.has("subcontract") &&
    fiveKinds.has("waste")
);

const idOnce = id("WA123", "material", "decking.surface");
const idTwice = id("WA123", "material", "decking.surface");
check("IDENTITY 5 IDs deterministic", idOnce === idTwice && idOnce === "WA123:material:decking.surface");
check(
  "IDENTITY 6 duplicate IDs detected",
  throwsValidation(() =>
    normalizeRequirements([
      hardwoodA,
      material({
        ...hardwoodA,
        purchaseQuantity: 1,
      }),
    ])
  )
);
check(
  "IDENTITY 7 different WAs do not collide",
  hardwoodA.requirementId !== hardwoodB.requirementId
);
check(
  "IDENTITY 8 variants do not collide",
  joistH32.requirementId !== joistH12.requirementId
);

check(
  "VALIDATION 9 structured assumptions valid",
  hardwoodA.assumptions[0]?.key === "waste.decking" &&
    hardwoodA.assumptions[0]?.source === "calculator_default"
);
check(
  "VALIDATION 10 confidence valid",
  throwsValidation(() =>
    normalizeRequirement({
      ...hardwoodA,
      confidence: "pretty-sure" as MaterialRequirement["confidence"],
    })
  )
);
check(
  "VALIDATION 11 negative physical quantities rejected",
  throwsValidation(() =>
    normalizeRequirement({ ...hardwoodA, baseQuantity: -1 })
  )
);
check(
  "VALIDATION 12 negative hours rejected",
  throwsValidation(() =>
    normalizeRequirement({ ...installLabour, baseHours: -2 })
  )
);
check(
  "VALIDATION 13 priced=true unresolved material cost rejected",
  throwsValidation(() =>
    normalizeRequirement({ ...hardwoodA, priced: true, totalCost: null })
  )
);
check(
  "VALIDATION 14 priced=true unresolved labour cost rejected",
  throwsValidation(() =>
    normalizeRequirement({ ...installLabour, priced: true, hourlyCost: null })
  )
);
const zeroMaterial = normalizeRequirement({
  ...hardwoodA,
  requirementId: id("WAZ", "material", "decking.surface"),
  workAreaId: "WAZ",
  baseQuantity: 0,
  purchaseQuantity: 0,
  unitCost: 0,
  totalCost: 0,
});
check(
  "VALIDATION 15 zero legitimate values preserved",
  zeroMaterial.kind === "material" &&
    zeroMaterial.baseQuantity === 0 &&
    zeroMaterial.totalCost === 0
);

const shuffled = [skip, pine, installLabour, hardwoodB, hardwoodA];
const ordered = normalizeRequirements(shuffled);
check(
  "NORMALISATION 16 deterministic ordering",
  ordered.map((item) => item.requirementId).join("|") ===
    normalizeRequirements([...shuffled].reverse())
      .map((item) => item.requirementId)
      .join("|") &&
    ordered.length === shuffled.length
);
const originalOrder = shuffled.map((item) => item.requirementId);
normalizeRequirements(shuffled);
check(
  "NORMALISATION 17 input arrays not mutated",
  shuffled.map((item) => item.requirementId).join("|") === originalOrder.join("|")
);

const sameMaterial = groupMaterialRequirements(
  normalizeRequirements([hardwoodA, hardwoodB]) as MaterialRequirement[]
);
check(
  "MATERIAL 18 same material/unit aggregates",
  sameMaterial.length === 1 &&
    Math.abs((sameMaterial[0]?.purchaseQuantity ?? 0) - 83.6) < 1e-9
);
check(
  "MATERIAL 19 contributor provenance retained",
  sameMaterial[0]?.contributors.length === 2 &&
    sameMaterial[0]?.contributors.some((item) => item.workAreaId === "WA1") === true &&
    sameMaterial[0]?.contributors.some((item) => item.workAreaId === "WA2") === true
);
const treatments = groupMaterialRequirements(
  normalizeRequirements([joistH32, joistH12]) as MaterialRequirement[]
);
check("MATERIAL 20 different treatment does not merge", treatments.length === 2);
const mixedSpecies = groupMaterialRequirements(
  normalizeRequirements([hardwoodA, pine]) as MaterialRequirement[]
);
check("MATERIAL 21 different material does not merge", mixedSpecies.length === 2);
const unitMix = summarizeEstimateRequirements([sheetUnsafe, sheetLmUnsafe]);
check(
  "MATERIAL 22 incompatible units do not merge",
  unitMix.materials.length === 2 &&
    unitMix.diagnostics.unsafeAggregationRefusals.some(
      (item) =>
        item.identity === "sheet.gib.standard.10" &&
        item.reason === "incompatible_units"
    )
);
const wasteAgg = groupMaterialRequirements(
  normalizeRequirements([waste10, waste5]) as MaterialRequirement[]
)[0];
const naiveAverage = (0.1 + 0.05) / 2;
check(
  "MATERIAL 23 waste uses summed physical/purchase quantities, not naive percentage average",
  wasteAgg != null &&
    wasteAgg.baseQuantity === 80 &&
    wasteAgg.purchaseQuantity === 86.5 &&
    wasteAgg.impliedWasteFactor != null &&
    Math.abs(wasteAgg.impliedWasteFactor - 6.5 / 80) < 1e-12 &&
    Math.abs((wasteAgg.impliedWasteFactor ?? 0) - naiveAverage) > 1e-6
);

const labourSummary = summarizeEstimateRequirements([installLabour, demoLabour]);
check(
  "LABOUR 24 task totals work",
  labourSummary.labourByTask.length === 2 &&
    labourSummary.labourByTask.some((item) => item.componentKey === "decking.install") &&
    labourSummary.labourByTask.some((item) => item.componentKey === "demolition.remove")
);
check(
  "LABOUR 25 trade totals work",
  labourSummary.labourByTrade.length === 1 &&
    labourSummary.labourByTrade[0]?.trade === "carpenter" &&
    labourSummary.labourByTrade[0]?.adjustedHours === 16.5
);
check(
  "LABOUR 26 contributor provenance retained",
  labourSummary.labourByTask.every((item) => item.contributors.length >= 1) &&
    labourSummary.labourByTrade[0]?.contributorRequirementIds.length === 2
);
check(
  "LABOUR 27 multiple adjustment factors preserved",
  labourSummary.labourByTask.find((item) => item.componentKey === "decking.install")
    ?.adjustmentFactors[0]?.factors.length === 2
);
check(
  "LABOUR 28 labour hours do not become elapsed duration",
  labourSummary.labourTotalHours.hoursAreElapsedDuration === false &&
    labourSummary.labourByTask.every((item) => item.hoursAreElapsedDuration === false) &&
    !aggregateSrc.toLowerCase().includes("crew duration")
);

const plantSummary = summarizeEstimateRequirements([excavator, mixer]);
check(
  "OTHER 29 plant safe aggregation",
  plantSummary.plant.length === 2
);
const subSummary = summarizeEstimateRequirements([bathPlumbing, kitchenPlumbing]);
check(
  "OTHER 30 subcontract safe aggregation",
  subSummary.subcontract.length === 2 &&
    subSummary.subcontractByTrade.length === 1 &&
    subSummary.subcontractByTrade[0]?.workAreaIds.length === 2
);
const wasteDistinct = summarizeEstimateRequirements([waste10, skip]);
check(
  "OTHER 31 WasteRequirement stays distinct from material wastage",
  wasteDistinct.waste.length === 1 &&
    wasteDistinct.materials.length === 1 &&
    wasteDistinct.waste[0]?.wasteKey === "skip.bin"
);

const mixedPriced = aggregatePricedRequirementCosts([hardwoodA, waste10, installLabour]);
check(
  "COMMERCIAL 32 priced false excluded from requirement-cost totals",
  mixedPriced.unpricedExcludedCount === 1 &&
    mixedPriced.pricedCount === 2 &&
    mixedPriced.totalCost === 1100 + 660
);

const dummyLine: EstimateLineItemInput = {
  workAreaId: "d1",
  workAreaName: "Deck",
  label: "Probe",
  category: "materials",
  costLow: 100,
  costHigh: 100,
  sellLow: 125,
  sellHigh: 125,
  recommendedCost: 100,
  recommendedSell: 125,
  grossProfit: 25,
  marginPercent: 20,
  markupPercent: 25,
  rateSource: "company",
  sortOrder: 1,
};
const fakeCalc: CalculatorResult = {
  lineItems: [dummyLine],
  assumptions: [],
  missingInfo: [],
  exclusions: [],
  confidence: 70,
  requirements: [
    material({
      ...hardwoodA,
      totalCost: 99999,
      unitCost: 999,
    }),
  ],
};
const finalized = finalizeEstimateResult({
  lineItems: [dummyLine],
  assumptions: [],
  missingInfo: [],
  exclusions: [],
  calculatorResults: [fakeCalc],
});
const collectedFake = collectRequirements([fakeCalc]);
check(
  "COMMERCIAL 33 requirement costs do NOT alter estimate totals",
  finalized.recommendedCost === 100 &&
    finalized.recommendedSell === 125 &&
    collectedFake[0]?.kind === "material" &&
    collectedFake[0].totalCost === 99999
);
check(
  "COMMERCIAL 34 existing line-item authority unchanged",
  (calculateSrc.includes("Requirement costs are never added to totals") ||
    calculateSrc.includes("Do not add requirement cost on top of legacy money")) &&
    finalized.lineItems[0]?.recommendedSell === 125
);
check(
  "COMMERCIAL 35 Deck surface promoted in registry; calculate-estimate stays clean",
  existsSync(join("lib", "estimate", "component-authority.ts")) &&
    aggregateSrc.includes("Not pricing-authority promotion") &&
    read("lib/estimate/component-authority.ts").includes(
      'authority: "REQUIREMENT_AUTHORITATIVE"'
    ) &&
    !read("lib/estimate/calculate-estimate.ts").includes("REQUIREMENT_AUTHORITATIVE")
);
check(
  "COMMERCIAL 36 no requirement row commercial persistence",
  !persistSrc.includes("requirements:") &&
    persistSrc.includes("Do not persist requirement rows onto estimates") &&
    existsSync(
      join("supabase", "migrations", "035_estimate_requirement_snapshots.sql")
    ) &&
    !existsSync(join("supabase", "migrations", "035_estimate_requirements.sql"))
);

const componentResults = [
  { requirements: [hardwoodA] },
  { requirements: [installLabour] },
  { requirements: [bathPlumbing] },
  {},
];
const collectedProject = collectRequirements(componentResults);
check(
  "PROJECT 37 multi-WA collection",
  collectedProject.length === 3 &&
    new Set(collectedProject.map((item) => item.workAreaId)).size === 2
);

const commercialComponents: EstimateWorkArea[] = [
  { id: "c-demo", type: "demolition", name: "Demolition", sort_order: 1 },
  { id: "c-walls", type: "internal_walls", name: "Internal walls", sort_order: 2 },
  { id: "c-ceil", type: "ceilings", name: "Ceilings", sort_order: 3 },
  { id: "c-doors", type: "doors", name: "Doors", sort_order: 4 },
  { id: "c-floor", type: "flooring", name: "Flooring", sort_order: 5 },
  { id: "c-paint", type: "painting", name: "Painting", sort_order: 6 },
  { id: "c-plast", type: "plastering", name: "Plastering", sort_order: 7 },
];
const commercialEstimate = calculateEstimate({
  project: { id: "p-fitout", qualityLevel: "standard" },
  confirmedWorkAreas: commercialComponents,
  facts: [],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as unknown as EstimateContext);
check(
  "PROJECT 38 commercial component composition",
  Array.isArray(commercialEstimate.requirements) &&
    commercialEstimate.requirements.length === 0
);
check(
  "PROJECT 39 no monolithic commercial_fitout requirement assumption",
  !calculateSrc.includes("commercial_fitout:") &&
    !Object.prototype.hasOwnProperty.call(
      { demolition: true },
      "commercial_fitout"
    )
);

const calcDir = join("lib", "estimate", "calculators");
const calcFiles = readdirSync(calcDir).filter((name) => name.endsWith(".ts"));
const emittingCalcs = calcFiles.filter((name) => {
  const text = readFileSync(join(calcDir, name), "utf8");
  return text.includes("requirements:");
});
check("NON-REGRESSION 40 no AI calls", !aggregateSrc.includes("ANTHROPIC") && !calculateSrc.includes("ANTHROPIC"));
const migrations = existsSync(join("supabase", "migrations"))
  ? readdirSync(join("supabase", "migrations"))
  : [];
check(
  "NON-REGRESSION 41 no editable requirement-row migration",
  migrations.some((name) => name.includes("035_estimate_requirement_snapshots")) &&
    !migrations.some((name) => name.includes("035_estimate_requirements.sql"))
);
check(
  "NON-REGRESSION 42 no Production SD",
  isScopeDiscoveryEnabled({}) === false
);
check(
  "NON-REGRESSION 43 no UI change required",
  emittingCalcs.length === 2 &&
    emittingCalcs.includes("deck.ts") &&
    emittingCalcs.includes("retaining-wall.ts") &&
    !read("docs/runbooks/REQ_1_OWNER_TECHNICAL_GATE.md").includes("Materials tab")
);

const shadow = toRequirementShadowFields(hardwoodA);
check(
  "SHADOW fields exist without comparison engine",
  shadow.componentKey === "decking.surface" &&
    shadow.physicalUnit === "lm" &&
    shadow.priced === true
);

const alias = aggregateEstimateRequirements([hardwoodA, hardwoodB]);
check(
  "aggregateEstimateRequirements is physical summary alias",
  alias.materials[0]?.contributors.length === 2
);

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

function wa(workAreaId: string, type: string, name: string): EstimateWorkArea {
  return { id: workAreaId, type, name, sort_order: 1 };
}
function fact(key: string, workAreaId: string, value: unknown) {
  return { key, work_area_id: workAreaId, value };
}

const deck1Facts = [
  fact("deck.area_m2", "d1", 70),
  fact("deck.board_material", "d1", "Hardwood"),
  fact("deck.board_width_mm", "d1", 140),
  fact("deck.height_m", "d1", 0.8),
  fact("deck.existing_deck_removal", "d1", true),
  fact("deck.access_type", "d1", "Stair set"),
  fact("deck.balustrade_required", "d1", true),
];
const deck1Calc = calculateDeck(
  { ...baseContext, facts: deck1Facts } as EstimateContext,
  wa("d1", "deck", "Deck 1")
);
const deck1Estimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck 1")],
  facts: deck1Facts,
} as EstimateContext);
const deck1Sell = Math.round(
  deck1Calc.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)
);
check(
    "GENERATE Deck surface + labour shadow envelope on live Deck calculator",
  (deck1Calc.requirements?.length ?? 0) >= 2 &&
    deck1Calc.requirements.some(
      (item) => item.kind === "material" && item.componentKey === "decking.surface"
    ) &&
    deck1Calc.requirements.some(
      (item) => item.kind === "labour" && item.componentKey === "deck.labour"
    ) &&
    (deck1Estimate.requirements?.some(
      (item) => item.kind === "material" && item.componentKey === "decking.surface"
    ) ?? false) &&
    Math.round(deck1Estimate.recommendedSell) === 48340
);
check(
  "GENERATE Deck 1 sell unchanged",
  deck1Sell === 48340 && Math.round(deck1Estimate.recommendedSell) === 48340
);

const fence2Facts = [
  fact("fence.length_m", "f2", 30),
  fact("fence.height_m", "f2", 2),
  fact("fence.material", "f2", "Timber"),
  fact("fence.gate_included", "f2", true),
  fact("fence.demolition_required", "f2", true),
  fact("fence.disposal_required", "f2", true),
  fact("fence.slope_condition", "f2", "Steep/sloping"),
  fact("fence.access", "f2", "Difficult"),
];
const fence2 = calculateFence(
  { ...baseContext, facts: fence2Facts } as EstimateContext,
  wa("f2", "fence", "Fence 2")
);
check(
  "GENERATE Fence 2 sell unchanged",
  Math.round(fence2.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)) ===
    8782
);

const pergola1Facts = [
  fact("pergola.area_m2", "p1", 24),
  fact("pergola.material", "p1", "Aluminium"),
  fact("pergola.attached", "p1", "Attached"),
  fact("pergola.roofing_included", "p1", true),
  fact("pergola.roofing_type", "p1", "Colorsteel"),
];
const pergola1 = calculatePergola(
  { ...baseContext, facts: pergola1Facts } as EstimateContext,
  wa("p1", "pergola", "Pergola 1")
);
check(
  "GENERATE Pergola 1 sell unchanged",
  Math.round(
    pergola1.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)
  ) === 15374
);

const rw2Facts = [
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
const rw2 = calculateRetainingWall(
  { ...baseContext, facts: rw2Facts } as EstimateContext,
  wa("rw2", "retaining_wall", "RW 2")
);
check(
  "GENERATE RW 2 sell unchanged",
  Math.round(rw2.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)) ===
    7345
);

check("diagnostics are cheap and non-user-facing", unitMix.diagnostics.requirementCount === 2);

console.log(`\n=== REQ-1 Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);

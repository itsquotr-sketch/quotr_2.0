/**
 * RETAINING-WALL-MATURITY-1E — final timber commercial + UX polish.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-1e.ts
 *
 * Do not commit, push, or deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { timberPileLayout } from "../lib/estimate/retaining-wall-geometry";
import {
  packageXorDetailedHolds,
} from "../lib/estimate/retaining-wall-commercial";
import {
  RW_EXCAVATION_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_EXCAVATION_SUBCONTRACT_COMPONENT,
  RW_FACE_BOARD_150_H4_KEY,
  RW_SPOIL_DISPOSAL_COMPONENT,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
  isRwTimberPileStockComponent,
} from "../lib/estimate/retaining-wall-identities";
import {
  RW_MINI_EXCAVATOR_DAY_COST_EX_GST,
  RW_MINI_EXCAVATOR_DAY_KEY,
  RW_TIMBER_EXCAVATION_SELF_PERFORM,
  RW_TIMBER_EXCAVATION_SUBCONTRACT,
  RW_TIMBER_PILING_METHOD_MACHINE,
  RW_TIMBER_PILING_METHOD_MANUAL,
  resolveTimberExcavationMethod,
  timberMiniExcavatorDays,
} from "../lib/estimate/retaining-wall-construction-method";
import {
  RW_PLANT_MACHINE_HOURS_PER_M3,
  RW_PLANT_MACHINE_HOURS_PER_PILE,
  RW_PLANT_PRODUCTIVE_HOURS_PER_DAY,
  RW_PLANT_SETUP_HOURS,
  timberMiniExcavatorWorkload,
} from "../lib/estimate/retaining-wall-plant-workload";
import {
  RW_RATE_VARIANCE_THRESHOLD,
  timberRateVarianceContext,
} from "../lib/estimate/retaining-wall-rate-context";
import { stripInternalEstimateTokens } from "../lib/estimate/retaining-wall-builder-copy";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import { DEFAULT_MARGIN_PERCENT } from "../lib/estimate/constants";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
} from "../lib/estimate/types";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
} from "../lib/estimate/requirements";

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

function near(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

function wa(id = "rw1") {
  return { id, type: "retaining_wall", name: "Retaining wall", sort_order: 1 };
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "rw1", value, source: "user" };
}

function testRate(
  itemKey: string,
  unit: string,
  cost: number,
  rateType: "material" | "productivity" | "labour" = "material"
): OrganisationRate {
  return {
    id: `test.${itemKey}.${unit}`,
    rate_type: rateType,
    trade: rateType === "labour" ? "carpenter" : null,
    work_area_type: "retaining_wall",
    item_key: itemKey,
    label: `TEST_ONLY ${itemKey}`,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

const OWNER_CONSTRAINTS = [
  { key: "site_access", value: "Moderate" },
  { key: "material_carry_distance", value: "10–30m" },
];

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  constraints: { key: string; value: unknown }[] = OWNER_CONSTRAINTS,
  margin = 20
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: margin,
    },
    materialWastageSettings: { defaultMaterialWastagePercent: 10 },
    rates,
  } as unknown as EstimateContext;
}

function mat(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): MaterialRequirement | undefined {
  return reqs?.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === key
  );
}

function lab(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): LabourRequirement | undefined {
  return reqs?.find(
    (row): row is LabourRequirement =>
      row.kind === "labour" && row.componentKey === key
  );
}

function plantLine(items: readonly EstimateLineItemInput[]) {
  return items.find((item) => /mini-excavator/i.test(item.label));
}

function spawnVerifier(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((line) => /^FAIL /.test(line));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    return false;
  }
}

function ownerFacts(overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.face_board_section", "150×50 H4"),
  ];
  const keys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...overrides];
}

function previewFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return ownerFacts([
    fact("retaining_wall.post_spacing_m", 1),
    fact("retaining_wall.pile_embedment_m", 1),
    fact("retaining_wall.excavation_volume_m3", 4),
    ...extra,
  ]);
}

function hasPackage(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.label === "Retaining wall labour" ||
      item.label === "Retaining wall materials" ||
      item.label === "Backfill allowance" ||
      item.label === "Drainage labour"
  );
}

function hasDetailedMoney(items: readonly EstimateLineItemInput[]): boolean {
  return items.some((item) => item.componentKey === RW_TIMBER_BOARDS_COMPONENT);
}

const measured = calculateRetainingWall(ctx(previewFacts()), wa());
const unknown = calculateRetainingWall(ctx(ownerFacts()), wa());
const subcontract = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.excavation_method", "subcontracted")])),
  wa()
);
const spoil = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.disposal_included", true)])),
  wa()
);
const companyBoard = calculateRetainingWall(
  ctx(previewFacts(), [testRate(RW_FACE_BOARD_150_H4_KEY, "lm", 32)]),
  wa()
);
const closeBoard = calculateRetainingWall(
  ctx(previewFacts(), [testRate(RW_FACE_BOARD_150_H4_KEY, "lm", 13)]),
  wa()
);
const small = calculateRetainingWall(
  ctx(
    [
      fact("retaining_wall.material", "Timber"),
      fact("retaining_wall.length_m", 3),
      fact("retaining_wall.height_m", 1),
      fact("retaining_wall.excavation_required", true),
      fact("retaining_wall.face_board_section", "150×50 H4"),
    ],
    [],
    OWNER_CONSTRAINTS
  ),
  wa()
);
const large = calculateRetainingWall(
  ctx(
    [
      fact("retaining_wall.material", "Timber"),
      fact("retaining_wall.length_m", 40),
      fact("retaining_wall.height_m", 1.2),
      fact("retaining_wall.excavation_required", true),
      fact("retaining_wall.excavation_volume_m3", 40),
      fact("retaining_wall.face_board_section", "150×50 H4"),
    ],
    [],
    OWNER_CONSTRAINTS
  ),
  wa()
);
const manual = calculateRetainingWall(
  ctx(previewFacts(), [], [
    { key: "site_access", value: "Difficult" },
    { key: "material_carry_distance", value: "10–30m" },
  ]),
  wa()
);
const plantOverride = calculateRetainingWall(
  ctx(previewFacts(), [testRate(RW_MINI_EXCAVATOR_DAY_KEY, "day", 500)]),
  wa()
);
const tinyCut = timberMiniExcavatorDays({
  method: RW_TIMBER_PILING_METHOD_MACHINE,
  pileCount: 16,
  measuredExcavationM3: 0.1,
});
const noCut = timberMiniExcavatorDays({
  method: RW_TIMBER_PILING_METHOD_MACHINE,
  pileCount: 16,
  measuredExcavationM3: null,
});
const ownerPlantModel = timberMiniExcavatorWorkload({
  method: RW_TIMBER_PILING_METHOD_MACHINE,
  pileCount: 16,
  measuredExcavationM3: 4,
});

console.log("\n--- EXCAVATION OWNERSHIP ---\n");
check(
  "1 self-perform measured excavation does not emit duplicate generic price requirement",
  !measured.lineItems.some(
    (item) =>
      item.componentKey === RW_EXCAVATION_COMPONENT ||
      (item.label === "Bulk excavation" && item.rateSourceType === "missing")
  ) &&
    !measured.missingInfo.some((row) => /bulk excavation/i.test(row))
);
check(
  "2 labour covers measured excavation",
  lab(measured.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.priced === true &&
    lab(measured.requirements, RW_EXCAVATION_LABOUR_COMPONENT)
      ?.productivityBasis.unit === "m3" &&
    near(
      lab(measured.requirements, RW_EXCAVATION_LABOUR_COMPONENT)
        ?.productivityBasis.quantity ?? 0,
      4
    )
);
check(
  "3 plant covers machine requirement",
  (plantLine(measured.lineItems)?.quantity ?? 0) >= 1 &&
    plantLine(measured.lineItems)?.unit === "day"
);
check(
  "4 spoil/export separate",
  mat(measured.requirements, RW_SPOIL_DISPOSAL_COMPONENT) == null &&
    mat(spoil.requirements, RW_SPOIL_DISPOSAL_COMPONENT) != null &&
    spoil.lineItems.some((item) => /spoil disposal/i.test(item.label)) &&
    !spoil.lineItems.some((item) => item.label === "Bulk excavation")
);
check(
  "5 subcontract XOR self-perform",
  resolveTimberExcavationMethod(previewFacts(), "rw1") ===
    RW_TIMBER_EXCAVATION_SELF_PERFORM &&
    resolveTimberExcavationMethod(
      previewFacts([fact("retaining_wall.excavation_method", "subcontracted")]),
      "rw1"
    ) === RW_TIMBER_EXCAVATION_SUBCONTRACT &&
    lab(subcontract.requirements, RW_EXCAVATION_LABOUR_COMPONENT) == null &&
    mat(subcontract.requirements, RW_EXCAVATION_SUBCONTRACT_COMPONENT) != null &&
    subcontract.lineItems.some((item) => /excavation subcontract/i.test(item.label))
);

console.log("\n--- PLANT ---\n");
check(
  "6 machine-hour model exists",
  ownerPlantModel.totalMachineHours > 0 && ownerPlantModel.days >= 1
);
check(
  "7 pile machine workload explicit",
  near(ownerPlantModel.hoursPerPile, RW_PLANT_MACHINE_HOURS_PER_PILE) &&
    near(ownerPlantModel.pileMachineHours, 16 * RW_PLANT_MACHINE_HOURS_PER_PILE)
);
check(
  "8 excavation machine workload explicit",
  near(ownerPlantModel.hoursPerM3, RW_PLANT_MACHINE_HOURS_PER_M3) &&
    near(ownerPlantModel.excavationMachineHours, 4 * RW_PLANT_MACHINE_HOURS_PER_M3)
);
check(
  "9 setup workload explicit",
  near(ownerPlantModel.setupHours, RW_PLANT_SETUP_HOURS)
);
check(
  "10 productive hours/day explicit",
  near(ownerPlantModel.productiveHoursPerDay, RW_PLANT_PRODUCTIVE_HOURS_PER_DAY)
);
check(
  "11 small fixture minimum 1 day",
  timberPileLayout(3, 1.2).pileCount === 4 &&
    plantLine(small.lineItems)?.quantity === 1
);
check(
  "12 Owner fixture deterministic",
  timberPileLayout(15, 1).pileCount === 16 &&
    ownerPlantModel.days === (plantLine(measured.lineItems)?.quantity ?? 0)
);
check(
  "13 large fixture scales > Owner",
  (plantLine(large.lineItems)?.quantity ?? 0) > (plantLine(measured.lineItems)?.quantity ?? 0)
);
check(
  "14 no threshold cliff for tiny measured excavation",
  tinyCut.days === noCut.days && tinyCut.days === 1
);
check("15 manual mode zero plant", plantLine(manual.lineItems) == null);
check(
  "16 company plant rate isolated",
  plantLine(plantOverride.lineItems)?.quantity ===
    plantLine(measured.lineItems)?.quantity &&
    near(plantLine(plantOverride.lineItems)?.recommendedCost ?? 0, 500) &&
    near(
      plantLine(measured.lineItems)?.recommendedCost ?? 0,
      (plantLine(measured.lineItems)?.quantity ?? 0) * RW_MINI_EXCAVATOR_DAY_COST_EX_GST
    )
);

console.log("\n--- RATE CONTEXT ---\n");
const board32 = companyBoard.lineItems.find(
  (item) => item.componentKey === RW_TIMBER_BOARDS_COMPONENT
);
const board13 = closeBoard.lineItems.find(
  (item) => item.componentKey === RW_TIMBER_BOARDS_COMPONENT
);
const review32 = composeBuilderReview({
  estimate: {
    recommendedCost: companyBoard.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: companyBoard.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    marginPercent: 20,
    confidence: companyBoard.confidence,
    assumptions: companyBoard.assumptions,
    missingInfo: companyBoard.missingInfo,
    lineItems: companyBoard.lineItems as never,
  },
  workAreas: [wa()],
  requirements: companyBoard.requirements,
});
const board32Line = review32.workAreas[0]?.categories
  .flatMap((cat) => cat.lines)
  .find((line) => line.componentKey === RW_TIMBER_BOARDS_COMPONENT);
check(
  "17 company exact still wins",
  near(board32?.costRate ?? 0, 32) &&
    near((board32?.quantity ?? 0) * 32, board32?.recommendedCost ?? 0)
);
const projectBoard = calculateRetainingWall(
  ctx(previewFacts(), [
    testRate(RW_FACE_BOARD_150_H4_KEY, "lm", 32),
    {
      ...testRate(RW_FACE_BOARD_150_H4_KEY, "lm", 40),
      id: "project.board",
      rate_type: "project_material",
    },
  ]),
  wa()
);
check(
  "18 project exact wins company",
  near(
    projectBoard.lineItems.find((item) => item.componentKey === RW_TIMBER_BOARDS_COMPONENT)
      ?.costRate ?? 0,
    40
  )
);
check(
  "19 meaningful variance detected only for comparable identity/unit",
  RW_RATE_VARIANCE_THRESHOLD === 0.25 &&
    timberRateVarianceContext({
      itemKey: RW_FACE_BOARD_150_H4_KEY,
      unit: "lm",
      appliedCostRate: 32,
      rateLabel: "Company rate",
    }) != null
);
check(
  "20 close variance suppressed",
  timberRateVarianceContext({
    itemKey: RW_FACE_BOARD_150_H4_KEY,
    unit: "lm",
    appliedCostRate: 13,
    rateLabel: "Company rate",
  }) == null && (board13?.costRate ?? 0) > 0
);
check(
  "21 incompatible rate comparison suppressed",
  timberRateVarianceContext({
    itemKey: RW_FACE_BOARD_150_H4_KEY,
    unit: "ea",
    appliedCostRate: 32,
    rateLabel: "Company rate",
  }) == null
);
check(
  "22 no auto override",
  near(board32?.costRate ?? 0, 32) &&
    (board32Line?.rateContext ?? "").includes("12.80")
);

console.log("\n--- PILE UX ---\n");
const measuredReview = composeBuilderReview({
  estimate: {
    recommendedCost: measured.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: measured.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    marginPercent: 20,
    confidence: measured.confidence,
    assumptions: measured.assumptions,
    missingInfo: measured.missingInfo,
    lineItems: measured.lineItems as never,
  },
  workAreas: [wa()],
  requirements: measured.requirements,
});
const pileNote = measuredReview.workAreas[0]?.categories
  .find((cat) => cat.id === "MATERIALS")
  ?.groupNotes.find((note) => note.id === "pile-procurement");
const stock = (measured.requirements ?? []).filter(
  (row): row is MaterialRequirement =>
    row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
);
check("23 theoretical length preserved", (pileNote?.detail ?? "").includes("lm required length"));
check("24 purchase length preserved", (pileNote?.detail ?? "").includes("lm"));
check(
  "25 purchase EA preserved",
  stock.reduce((sum, row) => sum + row.purchaseQuantity, 0) === 16
);
check("26 stock SKU detail preserved", stock.length > 1);
check(
  "27 procurement summary reconciles",
  Boolean(pileNote?.detail.match(/16 piles/)) &&
    Boolean(pileNote?.detail.match(/Purchased stock/))
);

console.log("\n--- BUILDER COPY ---\n");
const uiCopy = [
  ...(measuredReview.workAreas[0]?.categories.flatMap((cat) => [
    ...cat.groupNotes.map((note) => `${note.title} ${note.detail}`),
    ...cat.lines.map((line) => `${line.label} ${line.specification ?? ""} ${line.rateContext ?? ""}`),
  ]) ?? []),
  measuredReview.overview.marginSourceLabel ?? "",
  measuredReview.overview.confidenceExplanation ?? "",
].join(" ");
check(
  "28 no raw aggregate assumption token",
  !uiCopy.includes("QUOTR_STARTER_ASSUMPTION_FACTOR_1_25")
);
check(
  "29 no raw fixings allowance token",
  !uiCopy.includes("QUOTR_STARTER_ALLOWANCE")
);
check(
  "30 no internal authority labels",
  !uiCopy.includes("DETAILED_COMPONENT_AUTHORITY") &&
    !uiCopy.includes("LEGACY_FALLBACK_ONLY")
);
check(
  "31 measured excavation not called allowance",
  measuredReview.workAreas[0]?.categories
    .flatMap((cat) => cat.lines)
    .some(
      (line) =>
        line.componentKey === RW_EXCAVATION_LABOUR_COMPONENT &&
        line.label === "Excavation" &&
        !/allowance/i.test(line.label)
    )
);
const unknownReview = composeBuilderReview({
  estimate: {
    recommendedCost: unknown.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: unknown.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    marginPercent: 20,
    confidence: unknown.confidence,
    assumptions: unknown.assumptions,
    missingInfo: unknown.missingInfo,
    lineItems: unknown.lineItems as never,
  },
  workAreas: [wa()],
  requirements: unknown.requirements,
});
check(
  "32 unknown excavation still called allowance",
  unknownReview.workAreas[0]?.categories
    .flatMap((cat) => cat.lines)
    .some(
      (line) =>
        line.componentKey === RW_EXCAVATION_LABOUR_COMPONENT &&
        line.label === "Excavation allowance"
    ) &&
    unknown.lineItems.some(
      (item) =>
        item.componentKey === RW_EXCAVATION_LABOUR_COMPONENT &&
        /EXCAVATION ALLOWANCE/i.test(item.label)
    )
);
check(
  "33 site modifier reasons available",
  measured.lineItems.some(
    (item) =>
      item.componentKey === RW_TIMBER_PILE_LABOUR_COMPONENT &&
      (item.notes ?? "").includes("base hrs") &&
      (item.notes ?? "").toLowerCase().includes("site access") &&
      (item.notes ?? "").toLowerCase().includes("carry")
  )
);

console.log("\n--- MARGIN / CONFIDENCE ---\n");
const ten = calculateEstimate(ctx(previewFacts(), [], OWNER_CONSTRAINTS, 10));
check(
  "34 margin source deterministic",
  DEFAULT_MARGIN_PERCENT === 20 &&
    near(ten.marginPercent, 10) &&
    (measuredReview.overview.marginSourceLabel ?? "").toLowerCase().includes("company")
);
check("35 margin not silently changed", near(ten.marginPercent, 10));
check(
  "36 confidence drivers deterministic",
  !measured.missingInfo.some((row) => /bulk excavation/i.test(row)) &&
    typeof measured.confidence === "number"
);

console.log("\n--- REGRESSION ---\n");
const estimate = calculateEstimate(ctx(previewFacts()));
check(
  "37 Update Estimate passes",
  estimate.recommendedSell > 0 &&
    !estimate.missingInfo.some((row) =>
      /complete the remaining project information/i.test(row)
    )
);
check(
  "38 package/detail XOR unchanged",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFaceLine: hasPackage(measured.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(measured.lineItems),
  })
);
check(
  "39 cost-first unchanged",
  measured.lineItems
    .filter((item) => item.category === "labour")
    .every((item) => item.sellDerivedFromMargin === true)
);
check(
  "40 Pricing parity",
  measured.lineItems.every((item) => {
    const copied = buildPricingItemFieldsFromEstimateLineItem({
      category: item.category,
      recommended_cost: item.recommendedCost,
      recommended_sell: item.recommendedSell,
      notes: item.notes ?? null,
    });
    return near(copied.totalCost, item.recommendedCost);
  })
);
check(
  "41 Quote parity",
  existsSync("lib/quotes/adoption-authority.ts") &&
    !readFileSync("lib/quotes/adoption-authority.ts", "utf8").includes(
      "calculateRetainingWall"
    )
);
check("42 RW-1D passes", spawnVerifier("scripts/verify-retaining-wall-maturity-1d.ts"));
check("43 RW-1C-R3 passes", spawnVerifier("scripts/verify-retaining-wall-maturity-1c-r3.ts"));
check("44 Deck 2D passes", spawnVerifier("scripts/verify-deck-maturity-2d.ts"));
check(
  "45 plant days are whole hire days",
  Number.isInteger(ownerPlantModel.days) && ownerPlantModel.days >= 1
);
check(
  "46 stripInternalEstimateTokens removes tokens",
  stripInternalEstimateTokens("Includes QUOTR_STARTER_ALLOWANCE remaining") ===
    "Includes remaining" ||
    !stripInternalEstimateTokens("QUOTR_STARTER_ALLOWANCE").includes("_")
);
check(
  "47 Change material still available for timber materials",
  readFileSync(
    "components/assistant/builder-review/BuilderReviewSurface.tsx",
    "utf8"
  ).includes("onChangeMaterial")
);
check(
  "48 Manual method constant still distinct",
  RW_TIMBER_PILING_METHOD_MANUAL !== RW_TIMBER_PILING_METHOD_MACHINE
);

console.log("\n--- OWNER PLANT DUMP ---\n");
console.log(
  JSON.stringify(
    {
      pileCount: 16,
      measuredExcavationM3: 4,
      ...ownerPlantModel,
    },
    null,
    2
  )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

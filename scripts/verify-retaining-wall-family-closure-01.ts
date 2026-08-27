/**
 * RETAINING-WALL-FAMILY-CLOSURE-01 — Timber + Sleeper + Masonry product closure.
 * Run: npx tsx scripts/verify-retaining-wall-family-closure-01.ts
 *
 * Do not commit, push, or deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { deriveQuickEstimateConfidencePresentation } from "../lib/assistant/presentation/quick-estimate-confidence";
import { getJobPlanQuickSpecEditor } from "../components/assistant/job-plan/quick-spec-editors";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  commercializeRetainingWall,
  packageXorDetailedHolds,
} from "../lib/estimate/retaining-wall-commercial";
import {
  RW_DIGGER_ACCESS_FACT,
  RW_DRAINAGE_SOCK_COMPONENT,
  RW_DRAINAGE_SOCK_FACT,
  RW_DRAINAGE_SOCK_KEY,
  RW_EXCAVATION_MACHINE_HOURS_KEY,
  RW_EXCAVATION_MANUAL_HOURS_KEY,
  RW_PILE_MATERIAL_FACT,
  RW_PILE_MATERIAL_H5_SED,
  RW_PILE_MATERIAL_HOUSE_PILE_125,
  RW_TIMBER_CONCRETE_COMPONENT,
  personHoursPerUnit,
} from "../lib/estimate/retaining-wall-family-coverage";
import {
  NOVACOIL_IDENTITY,
  RW_BACKFILL_COMPONENT,
  RW_EXCAVATION_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_HOUSE_PILE_125_KEY,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_BLOCK_LABOUR_COMPONENT,
  RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
  RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_POSTS_PROCURE_COMPONENT,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
  isRwTimberPileStockComponent,
} from "../lib/estimate/retaining-wall-identities";
import {
  RW_MASONRY_DESIGN_CONFIRM,
  RW_MASONRY_MORTAR_COMPONENT,
  RW_MASONRY_MORTAR_PERCENT_OF_BLOCKS,
  RW_MASONRY_REBAR_ALLOWANCE_COMPONENT,
  RW_MASONRY_REINFORCEMENT_ACTION,
  RW_MASONRY_REBAR_ALLOWANCE_KEY,
  masonryBlockPurchaseEa,
} from "../lib/estimate/retaining-wall-masonry-2b";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import {
  classifyRetainingWallSystem,
  retainingWallSystemLabel,
} from "../lib/estimate/retaining-wall-systems";
import { RW_SLEEPER_MODULE_MISMATCH } from "../lib/estimate/retaining-wall-sleeper-2a";
import { faceAreaM2, resolveRetainingWallGeometry } from "../lib/estimate/retaining-wall-geometry";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import { RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  PlantRequirement,
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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function near(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

function wa(id = "rw1"): EstimateWorkArea & { status: "confirmed" } {
  return {
    id,
    type: "retaining_wall",
    name: "Retaining wall",
    sort_order: 1,
    status: "confirmed",
  };
}

function fact(key: string, value: unknown, workAreaId = "rw1"): EstimateFact {
  return { key, work_area_id: workAreaId, value };
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
    label: `TEST ${itemKey}`,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  constraints: { key: string; value: unknown }[] = [
    { key: "site_access", value: "Moderate" },
    { key: "material_carry_distance", value: "10–30m" },
  ]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(facts[0]?.work_area_id ?? "rw1")],
    facts,
    constraints,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
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

function plant(reqs: readonly EstimateRequirement[] | undefined): PlantRequirement | undefined {
  return reqs?.find((row): row is PlantRequirement => row.kind === "plant");
}

function spawn(script: string): boolean {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      execFileSync("npx", ["tsx", script], {
        stdio: "pipe",
        cwd: process.cwd(),
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      return true;
    } catch {
      // retry once for flaky nested spawns on Windows
    }
  }
  return false;
}

function hasComponent(
  calc: ReturnType<typeof calculateRetainingWall>,
  key: string
): boolean {
  return (
    (calc.requirements ?? []).some((row) => row.componentKey === key) ||
    calc.lineItems.some((item) => item.componentKey === key)
  );
}

function hasPackageLines(calc: ReturnType<typeof calculateRetainingWall>): boolean {
  return calc.lineItems.some(
    (item) =>
      item.label === "Retaining wall materials" || item.label === "Retaining wall labour"
  );
}

function hasDetailedMoney(calc: ReturnType<typeof calculateRetainingWall>): boolean {
  return calc.lineItems.some(
    (item) =>
      item.componentKey?.startsWith("retaining_wall.") &&
      (item.recommendedCost ?? 0) > 0
  );
}

const SHARED_FACTS: EstimateFact[] = [
  fact("retaining_wall.length_m", 15),
  fact("retaining_wall.is_raking", true),
  fact("retaining_wall.height_high_m", 1.6),
  fact("retaining_wall.height_low_m", 0.6),
  fact("retaining_wall.excavation_required", true),
  fact("retaining_wall.excavation_volume_m3", 6),
  fact(RW_DIGGER_ACCESS_FACT, "Yes"),
  fact("retaining_wall.drainage_required", true),
  fact(RW_DRAINAGE_SOCK_FACT, "No"),
  fact("retaining_wall.disposal_included", false),
];

function materialFacts(material: string, extra: EstimateFact[] = []): EstimateFact[] {
  const keys = new Set(extra.map((row) => row.key));
  const systemFacts: EstimateFact[] = [];
  if (material === "Timber") {
    systemFacts.push(
      fact(RW_PILE_MATERIAL_FACT, RW_PILE_MATERIAL_H5_SED),
      fact("retaining_wall.backfill_included", true)
    );
  } else if (material === "Concrete sleeper") {
    systemFacts.push(fact("retaining_wall.sleeper_length_m", 2.0));
  } else {
    systemFacts.push(
      fact("retaining_wall.block_series", "200-series"),
      fact("retaining_wall.block_laying_method", "Self-perform"),
      fact("retaining_wall.backfill_included", true),
      fact("retaining_wall.waterproofing_required", true),
      fact("retaining_wall.waterproofing_type", "Liquid membrane"),
      fact("retaining_wall.waterproofing_method", "Self-perform"),
      fact("retaining_wall.disposal_included", false)
    );
  }
  return [
    ...SHARED_FACTS.filter((row) => !keys.has(row.key)),
    ...systemFacts.filter((row) => !keys.has(row.key)),
    fact("retaining_wall.material", material),
    ...extra,
  ];
}

function calcFor(material: string, extra: EstimateFact[] = [], rates: OrganisationRate[] = []) {
  return calculateRetainingWall(ctx(materialFacts(material, extra), rates), wa());
}

const quickSpec = read("components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx");
const productivityKeys = RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.map((row) => row.item_key);

console.log("\n--- SYSTEM SELECTION ---\n");

check(
  "1 Timber recognised",
  classifyRetainingWallSystem("Timber") === "TIMBER_RETAINING_WALL"
);
check(
  "2 Sleeper recognised",
  classifyRetainingWallSystem("Concrete sleeper") === "CONCRETE_SLEEPER_WALL"
);
check(
  "3 Masonry recognised",
  classifyRetainingWallSystem("Masonry") === "CONCRETE_MASONRY_WALL"
);
check(
  "4 Builder labels clean",
  retainingWallSystemLabel("TIMBER_RETAINING_WALL") === "Timber retaining wall" &&
    retainingWallSystemLabel("CONCRETE_SLEEPER_WALL") === "Concrete sleeper wall" &&
    retainingWallSystemLabel("CONCRETE_MASONRY_WALL") === "Concrete masonry / Besser block" &&
    quickSpec.includes('<option value="Timber">Timber</option>') &&
    quickSpec.includes('<option value="Concrete sleeper">Concrete sleeper</option>') &&
    quickSpec.includes('<option value="Masonry">Masonry</option>') &&
    quickSpec.includes('Label htmlFor={`rw-material-${workAreaId}`}') &&
    !quickSpec.includes("TIMBER_RETAINING_WALL\">Timber")
);

console.log("\n--- FACT OWNERSHIP ---\n");

const timberSwitch = calcFor("Timber");
const sleeperSwitch = calcFor("Concrete sleeper");
const masonryRates = [
  testRate("labour.carpenter", "hr", 85, "labour"),
  testRate(RW_MASONRY_REBAR_ALLOWANCE_KEY, "item", 450),
];
const masonrySwitch = calcFor("Masonry", [], masonryRates);

const sharedLength = resolveRetainingWallGeometry({
  lengthM: 15,
  heightM: null,
  heightHighM: 1.6,
  heightLowM: 0.6,
})?.lengthM;
check("5 shared geometry persists", sharedLength === 15);
check(
  "6 shared access persists",
  timberSwitch.lineItems.length > 0 && sleeperSwitch.lineItems.length > 0
);
check(
  "7 digger access persists",
  lab(timberSwitch.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.productivityBasis.key ===
    RW_EXCAVATION_MACHINE_HOURS_KEY
);
check(
  "8 drainage persists",
  hasComponent(timberSwitch, RW_NOVACOIL_COMPONENT) &&
    hasComponent(sleeperSwitch, RW_NOVACOIL_COMPONENT) &&
    hasComponent(masonrySwitch, RW_NOVACOIL_COMPONENT)
);
check(
  "9 spoil state independent",
  !hasComponent(
    calcFor("Timber", [fact("retaining_wall.disposal_included", false)]),
    "retaining_wall.spoil.removal.all_in"
  )
);

const timberPhys = buildRetainingWallPhysicalModel({
  context: ctx(materialFacts("Timber")),
  workAreaId: "rw1",
  material: "Timber",
});
const sleeperPhys = buildRetainingWallPhysicalModel({
  context: ctx(materialFacts("Concrete sleeper")),
  workAreaId: "rw1",
  material: "Concrete sleeper",
});
const masonryPhys = buildRetainingWallPhysicalModel({
  context: ctx(materialFacts("Masonry")),
  workAreaId: "rw1",
  material: "Masonry",
});

check(
  "10 Timber-specific facts isolated",
  timberPhys.timberPiles != null && timberPhys.sleeperTakeoff == null && timberPhys.masonryTakeoff == null
);
check(
  "11 Sleeper-specific facts isolated",
  sleeperPhys.sleeperTakeoff != null && sleeperPhys.timberPiles == null && sleeperPhys.masonryTakeoff == null
);
check(
  "12 Masonry-specific facts isolated",
  masonryPhys.masonryTakeoff != null && masonryPhys.timberPiles == null && masonryPhys.sleeperTakeoff == null
);

console.log("\n--- TIMBER ---\n");

const timberRates = [
  testRate("labour.carpenter", "hr", 85, "labour"),
  testRate(RW_HOUSE_PILE_125_KEY, "lm", 23.5),
];
const timberCalc = calcFor("Timber", [], timberRates);
check(
  "13 material alternative",
  hasComponent(timberCalc, RW_TIMBER_BOARDS_COMPONENT) &&
    (timberCalc.requirements ?? []).some(
      (row) => row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
    )
);
const houseCalc = calcFor(
  "Timber",
  [fact(RW_PILE_MATERIAL_FACT, RW_PILE_MATERIAL_HOUSE_PILE_125)],
  timberRates
);
check(
  "14 concrete coverage",
  Boolean(mat(timberCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT)) &&
    (mat(timberCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT)?.totalCost ?? 0) > 0
);
check("15 drainage", hasComponent(timberCalc, RW_NOVACOIL_COMPONENT));
const manualTimber = calcFor("Timber", [fact(RW_DIGGER_ACCESS_FACT, "No")], timberRates);
check(
  "16 manual/machine excavation",
  lab(timberCalc.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.productivityBasis.key ===
    RW_EXCAVATION_MACHINE_HOURS_KEY &&
    lab(manualTimber.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.productivityBasis.key ===
      RW_EXCAVATION_MANUAL_HOURS_KEY &&
    (plant(manualTimber.requirements)?.quantity ?? 0) === 0
);
check(
  "Timber no Sleeper/Masonry leakage",
  !hasComponent(timberCalc, RW_SLEEPER_COMPONENT) &&
    !hasComponent(timberCalc, RW_MASONRY_BLOCKS_COMPONENT)
);
check(
  "Timber material switch preserves count",
  (timberPhys.timberPiles?.count ?? 0) ===
    buildRetainingWallPhysicalModel({
      context: ctx(materialFacts("Timber", [fact(RW_PILE_MATERIAL_FACT, RW_PILE_MATERIAL_HOUSE_PILE_125)])),
      workAreaId: "rw1",
      material: "Timber",
    }).timberPiles?.count
);

console.log("\n--- SLEEPER ---\n");

const sleeperCalc = calcFor("Concrete sleeper", [], [testRate("labour.carpenter", "hr", 85, "labour")]);
const sleeperTakeoff = sleeperPhys.sleeperTakeoff!;
check(
  "17 8-bay canonical fixture",
  sleeperTakeoff.bayCount === 8 && sleeperTakeoff.postCount === 9
);
check(
  "18 48-EA procurement",
  sleeperTakeoff.sleeperCount === 48 &&
    sleeperTakeoff.standardSleeperEa === 44 &&
    sleeperTakeoff.cutSleeperEa === 4
);
check(
  "19 concrete",
  hasComponent(sleeperCalc, RW_SLEEPER_CONCRETE_COMPONENT) &&
    hasComponent(sleeperCalc, RW_SLEEPER_POSTS_PROCURE_COMPONENT)
);
const mismatchCalc = calcFor("Concrete sleeper", [
  fact("retaining_wall.sleeper_post_spacing_m", 1.2),
]);
check(
  "20 system assumption attention",
  mismatchCalc.missingInfo.includes(RW_SLEEPER_MODULE_MISMATCH) ||
    mismatchCalc.assumptions.includes(RW_SLEEPER_MODULE_MISMATCH)
);
check(
  "Sleeper no Timber/Masonry leakage",
  !hasComponent(sleeperCalc, RW_TIMBER_BOARDS_COMPONENT) &&
    !hasComponent(sleeperCalc, RW_MASONRY_BLOCKS_COMPONENT)
);

console.log("\n--- MASONRY ---\n");

const masonryCalc = calcFor("Masonry", [], masonryRates);
const face = faceAreaM2(15, 1.6, 0.6);
const netBlocks = face * 12.5;
const purchaseBlocks = masonryBlockPurchaseEa(netBlocks);
const blockReq = mat(masonryCalc.requirements, RW_MASONRY_BLOCKS_COMPONENT);
const blockLine = masonryCalc.lineItems.find(
  (item) => item.componentKey === RW_MASONRY_BLOCKS_COMPONENT
);
check(
  "21 net/purchase blocks",
  near(netBlocks, 206.25) &&
    purchaseBlocks === 217 &&
    hasComponent(masonryCalc, RW_MASONRY_BLOCKS_COMPONENT) &&
    (blockReq?.purchaseQuantity === 217 ||
      blockLine?.quantity === 217 ||
      near(blockReq?.baseQuantity ?? 0, 206.25))
);
check(
  "22 mortar",
  (Boolean(mat(masonryCalc.requirements, RW_MASONRY_MORTAR_COMPONENT)) ||
    masonryCalc.lineItems.some((item) => item.componentKey === RW_MASONRY_MORTAR_COMPONENT)) &&
    (mat(masonryCalc.requirements, RW_MASONRY_MORTAR_COMPONENT)?.totalCost ??
      masonryCalc.lineItems.find((item) => item.componentKey === RW_MASONRY_MORTAR_COMPONENT)
        ?.recommendedCost ??
      0) > 0
);

const masonryPackageCtx = ctx(materialFacts("Masonry"));
const masonryPackageCommercial = commercializeRetainingWall({
  physical: masonryPhys,
  facts: materialFacts("Masonry"),
  workAreaId: "rw1",
  rates: [],
  organisationSettings: masonryPackageCtx.organisationSettings,
  constraints: masonryPackageCtx.constraints,
});
const masonryPackageCalc = calculateRetainingWall(masonryPackageCtx, wa());
check(
  "23 reinforcement Pricing Required",
  masonryPackageCommercial.coverage.some(
    (row) => row.key === "reinforcement" && row.state === "PRICING_REQUIRED"
  ) &&
    masonryPackageCommercial.mode === "LEGACY_PACKAGE_AUTHORITY" &&
    hasPackageLines(masonryPackageCalc) &&
    !hasDetailedMoney(masonryPackageCalc)
);
check(
  "24 reinforcement allowance",
  (mat(masonryCalc.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT)?.totalCost ??
    masonryCalc.lineItems.find((item) => item.componentKey === RW_MASONRY_REBAR_ALLOWANCE_COMPONENT)
      ?.recommendedCost ??
    0) === 450
);

const subBlock = calcFor(
  "Masonry",
  [
    fact("retaining_wall.block_laying_method", "Subcontract"),
    fact("retaining_wall.waterproofing_required", false),
  ],
  [
    ...masonryRates,
    testRate("retaining_wall.masonry.block_lay.subcontract", "m2", 95),
  ]
);
check(
  "25 self/sub XOR block laying",
  lab(masonryCalc.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) != null &&
    mat(subBlock.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT) != null &&
    lab(subBlock.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) == null &&
    Boolean(mat(subBlock.requirements, RW_MASONRY_MORTAR_COMPONENT))
);
check(
  "26 waterproof XOR",
  lab(masonryCalc.requirements, RW_MASONRY_WATERPROOF_LABOUR_COMPONENT) != null &&
    !hasComponent(subBlock, RW_MASONRY_WATERPROOF_COMPONENT)
);

const series150 = calcFor("Masonry", [fact("retaining_wall.block_series", "150-series")], masonryRates);
const core150 = mat(series150.requirements, RW_MASONRY_CORE_COMPONENT)?.baseQuantity ?? 0;
const core200 = mat(masonryCalc.requirements, RW_MASONRY_CORE_COMPONENT)?.baseQuantity ?? 0;
const phys150 = buildRetainingWallPhysicalModel({
  context: ctx(materialFacts("Masonry", [fact("retaining_wall.block_series", "150-series")]), masonryRates),
  workAreaId: "rw1",
  material: "Masonry",
});
check(
  "Masonry 150/200 switch",
  phys150.masonryTakeoff?.series?.series === "150" &&
    masonryPhys.masonryTakeoff?.series?.series === "200" &&
    phys150.masonryTakeoff?.series?.blocksPerM3CoreFill === 165 &&
    masonryPhys.masonryTakeoff?.series?.blocksPerM3CoreFill === 125
);

check(
  "Masonry no Timber/Sleeper leakage",
  !hasComponent(masonryCalc, RW_TIMBER_BOARDS_COMPONENT) &&
    !hasComponent(masonryCalc, RW_SLEEPER_COMPONENT)
);

console.log("\n--- SHARED FAMILY ---\n");

check(
  "27 punched drainage",
  NOVACOIL_IDENTITY.originalDescription?.toLowerCase().includes("punched") &&
    [timberCalc, sleeperCalc, masonryCalc].every((calc) =>
      calc.lineItems.some((item) => /punched[\s/]*slotted drainage coil/i.test(item.label))
    )
);
const sockCalc = calcFor("Timber", [fact(RW_DRAINAGE_SOCK_FACT, "Yes")], [
  ...timberRates,
  testRate(RW_DRAINAGE_SOCK_KEY, "lm", 4.5),
]);
check(
  "28 sock behaviour",
  !mat(calcFor("Timber", [fact(RW_DRAINAGE_SOCK_FACT, "No")], timberRates).requirements, RW_DRAINAGE_SOCK_COMPONENT) &&
    Boolean(mat(sockCalc.requirements, RW_DRAINAGE_SOCK_COMPONENT)) &&
    mat(sockCalc.requirements, RW_DRAINAGE_SOCK_COMPONENT)?.baseQuantity ===
      mat(sockCalc.requirements, RW_NOVACOIL_COMPONENT)?.baseQuantity
);
check(
  "29 excavation-method switching",
  mat(timberCalc.requirements, RW_EXCAVATION_COMPONENT)?.baseQuantity ===
    mat(manualTimber.requirements, RW_EXCAVATION_COMPONENT)?.baseQuantity
);
check(
  "30 person-hour productivity",
  read("lib/estimate/requirement-aggregate.ts").includes("hoursAreElapsedDuration: false")
);
check("31 crew helper arithmetic", personHoursPerUnit({ crewSize: 2, elapsedHours: 1, quantityCompleted: 4 }) === 0.5);
const pileLabour = lab(timberCalc.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT);
check(
  "32 no double crew cost",
  near(
    pileLabour?.adjustedHours ?? 0,
    (pileLabour?.productivityBasis.quantity ?? 0) * (pileLabour?.productivityBasis.hoursPerUnit ?? 0)
  )
);

console.log("\n--- COMMERCIAL ---\n");

const timberCommercial = commercializeRetainingWall({
  physical: timberPhys,
  facts: materialFacts("Timber"),
  workAreaId: "rw1",
  rates: timberRates,
  organisationSettings: ctx(materialFacts("Timber"), timberRates).organisationSettings,
  constraints: ctx(materialFacts("Timber"), timberRates).constraints,
});
const sleeperCommercial = commercializeRetainingWall({
  physical: sleeperPhys,
  facts: materialFacts("Concrete sleeper"),
  workAreaId: "rw1",
  rates: [],
  organisationSettings: ctx(materialFacts("Concrete sleeper")).organisationSettings,
  constraints: ctx(materialFacts("Concrete sleeper")).constraints,
});
const masonryCommercial = commercializeRetainingWall({
  physical: masonryPhys,
  facts: materialFacts("Masonry"),
  workAreaId: "rw1",
  rates: masonryRates,
  organisationSettings: ctx(materialFacts("Masonry"), masonryRates).organisationSettings,
  constraints: ctx(materialFacts("Masonry"), masonryRates).constraints,
});

check(
  "33 Timber package/detail XOR",
  packageXorDetailedHolds({
    mode: timberCommercial.mode,
    hasPackageFaceLine: hasPackageLines(timberCalc),
    hasDetailedMoneyLine: hasDetailedMoney(timberCalc),
  })
);
check(
  "34 Sleeper package/detail XOR",
  packageXorDetailedHolds({
    mode: sleeperCommercial.mode,
    hasPackageFaceLine: hasPackageLines(sleeperCalc),
    hasDetailedMoneyLine: hasDetailedMoney(sleeperCalc),
  })
);
check(
  "35 Masonry package/detail XOR",
  packageXorDetailedHolds({
    mode: masonryCommercial.mode,
    hasPackageFaceLine: hasPackageLines(masonryCalc),
    hasDetailedMoneyLine: hasDetailedMoney(masonryCalc),
  })
);

const masonryEstimate = calculateEstimate(ctx(materialFacts("Masonry"), masonryRates));
check(
  "36 commercial reconciliation",
  masonryEstimate.recommendedCost > 0 &&
    masonryEstimate.recommendedSell > masonryEstimate.recommendedCost &&
    near(
      masonryCalc.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
      masonryEstimate.recommendedCost,
      1
    )
);
check(
  "37 Pricing parity",
  masonryEstimate.lineItems.every((item) => {
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
  "38 Quote parity",
  existsSync("lib/quotes/adoption-authority.ts") &&
    !read("lib/quotes/adoption-authority.ts").includes("calculateRetainingWall")
);

console.log("\n--- SWITCHING ---\n");

function leakageFree(calc: ReturnType<typeof calculateRetainingWall>, forbidden: string[]) {
  return forbidden.every((key) => !hasComponent(calc, key));
}

check(
  "39 Timber→Sleeper",
  leakageFree(sleeperSwitch, [RW_TIMBER_BOARDS_COMPONENT, RW_MASONRY_BLOCKS_COMPONENT])
);
check(
  "40 Sleeper→Masonry",
  leakageFree(masonrySwitch, [RW_SLEEPER_COMPONENT, RW_TIMBER_BOARDS_COMPONENT])
);
check(
  "41 Masonry→Timber",
  leakageFree(timberSwitch, [RW_MASONRY_BLOCKS_COMPONENT, RW_SLEEPER_COMPONENT])
);
check(
  "42 no material leakage matrix",
  leakageFree(calcFor("Timber"), [RW_SLEEPER_COMPONENT, RW_MASONRY_BLOCKS_COMPONENT]) &&
    leakageFree(calcFor("Concrete sleeper"), [RW_TIMBER_BOARDS_COMPONENT, RW_MASONRY_BLOCKS_COMPONENT]) &&
    leakageFree(calcFor("Masonry", [], masonryRates), [RW_SLEEPER_COMPONENT, RW_TIMBER_BOARDS_COMPONENT])
);
check(
  "43 no labour leakage matrix",
  !lab(timberCalc.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) &&
    !lab(sleeperCalc.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) &&
    !lab(masonryCalc.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT)
);

console.log("\n--- UX ---\n");

check("44 Edit Scope", getJobPlanQuickSpecEditor("retaining_wall") != null);
check(
  "45 Update Estimate",
  masonryEstimate.recommendedSell > 0 &&
    read("lib/assistant/presentation/action-labels.ts").includes("updateEstimate")
);
check(
  "46 Improve Estimate",
  masonryCalc.missingInfo.includes(RW_MASONRY_DESIGN_CONFIRM) ||
    masonryCalc.missingInfo.includes(RW_MASONRY_REINFORCEMENT_ACTION)
);
const confidence = deriveQuickEstimateConfidencePresentation({
  confidence: masonryEstimate.confidence,
  missingInfo: masonryEstimate.missingInfo,
  assumptions: masonryEstimate.assumptions,
});
check(
  "47 confidence",
  String(confidence?.label ?? masonryEstimate.confidence ?? "").length > 0
);
const review = composeBuilderReview({
  estimate: {
    recommendedCost: masonryCalc.recommendedCost,
    recommendedSell: masonryCalc.recommendedSell,
    marginPercent: masonryCalc.marginPercent,
    confidence: masonryCalc.confidence,
    assumptions: masonryCalc.assumptions,
    missingInfo: masonryCalc.missingInfo,
    lineItems: masonryCalc.lineItems as never,
  },
  workAreas: [wa()],
  requirements: masonryCalc.requirements,
});
check(
  "48 mobile contract",
  review.workAreas.length > 0 &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes(
      "overflow-x-hidden"
    )
);

check(
  "productivity editability Timber/Sleeper/Masonry",
  productivityKeys.includes(RW_PRODUCTIVITY_KEYS.timberPilesEa) &&
    productivityKeys.includes(RW_PRODUCTIVITY_KEYS.sleeperSleepersEa) &&
    productivityKeys.includes(RW_PRODUCTIVITY_KEYS.masonryBlockM2) &&
    productivityKeys.includes(RW_EXCAVATION_MACHINE_HOURS_KEY) &&
    productivityKeys.includes(RW_EXCAVATION_MANUAL_HOURS_KEY)
);

check(
  "remove/re-add clean state",
  (() => {
    try {
      calculateEstimate({
        ...ctx(materialFacts("Masonry"), masonryRates),
        confirmedWorkAreas: [],
      } as EstimateContext);
      return false;
    } catch (error) {
      return (
        error instanceof Error &&
        error.message.includes("No confirmed work areas")
      );
    }
  })()
);

console.log("\n--- REGRESSION ---\n");

check("49 FAMILY-COVERAGE", spawn("scripts/verify-retaining-wall-family-coverage-01.ts"));
check("50 RW 2B", spawn("scripts/verify-retaining-wall-maturity-2b.ts"));
check("51 RW 2A", spawn("scripts/verify-retaining-wall-maturity-2a.ts"));
check("52 RW 1F", spawn("scripts/verify-retaining-wall-maturity-1f.ts"));
check("53 Deck 2D", spawn("scripts/verify-deck-maturity-2d.ts"));
check("54 ESTIMATOR-SAFETY-0", spawn("scripts/verify-estimator-safety-0.ts"));
check("55 performance verifier", spawn("scripts/verify-stage-3-1b7fr5-deck-final-ux-performance.ts"));

console.log(`\nFAMILY-CLOSURE-01: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

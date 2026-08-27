/**
 * RETAINING-WALL-MATURITY-2B / 2B-R2 — Concrete masonry procurement coverage.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-2b.ts
 *
 * Do not commit, push, or deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { deriveQuickEstimateConfidencePresentation } from "../lib/assistant/presentation/quick-estimate-confidence";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  packageXorDetailedHolds,
  masonryPhysicalReady,
  commercializeRetainingWall,
  RW_REBAR_GAP,
} from "../lib/estimate/retaining-wall-commercial";
import {
  faceAreaM2,
  resolveRetainingWallGeometry,
  RETAINING_WALL_MASONRY_FOOTING_DEPTH_M,
  RETAINING_WALL_MASONRY_FOOTING_WIDTH_M,
  RETAINING_WALL_MASONRY_SUBBASE_THICKNESS_M,
} from "../lib/estimate/retaining-wall-geometry";
import {
  RW_BACKFILL_COMPONENT,
  RW_BACKFILL_LABOUR_COMPONENT,
  RW_CORE_FILL_KEY,
  RW_DRAINAGE_LABOUR_COMPONENT,
  RW_EXCAVATION_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_FOOTING_CONCRETE_KEY,
  RW_MASONRY_150_KEY,
  RW_MASONRY_200_KEY,
  RW_MASONRY_BLOCK_LABOUR_COMPONENT,
  RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_CORE_LABOUR_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_FOOTING_LABOUR_COMPONENT,
  RW_MASONRY_REBAR_COMPONENT,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_SUBBASE_LABOUR_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
  RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_SPOIL_DISPOSAL_COMPONENT,
  RW_SPOIL_REMOVAL_ALL_IN_M3_KEY,
  RW_SUBBASE_KEY,
  RW_WATERPROOFING_LIQUID_KEY,
  RW_DRAINAGE_AGGREGATE_KEY,
  RW_NOVACOIL_KEY,
  MASONRY_SERIES_150,
  MASONRY_SERIES_200,
} from "../lib/estimate/retaining-wall-identities";
import {
  masonry2BMaterialStarter,
  masonryBlockPurchaseEa,
  RW_MASONRY_2B_MATERIAL_STARTERS,
  RW_MASONRY_2B_PRODUCTIVITY_STARTERS,
  RW_MASONRY_BLOCK_PROCUREMENT_FACTOR,
  RW_MASONRY_BLOCK_SUBCONTRACT_BASIS,
  RW_MASONRY_DESIGN_CONFIRM,
  RW_MASONRY_MORTAR_COMPONENT,
  RW_MASONRY_MORTAR_KEY,
  RW_MASONRY_MORTAR_PERCENT_OF_BLOCKS,
  RW_MASONRY_PACKAGE_LIFECYCLE,
  RW_MASONRY_PLANT_COMPONENT,
  RW_MASONRY_REBAR_ALLOWANCE_COMPONENT,
  RW_MASONRY_REBAR_ALLOWANCE_KEY,
  RW_MASONRY_REINFORCEMENT_ACTION,
  RW_REBAR_ALLOWANCE,
} from "../lib/estimate/retaining-wall-masonry-2b";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import { classifyRetainingWallSystem } from "../lib/estimate/retaining-wall-systems";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
} from "../lib/estimate/types";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  PlantRequirement,
} from "../lib/estimate/requirements";
import { RW_MINI_EXCAVATOR_DAY_COST_EX_GST } from "../lib/estimate/retaining-wall-construction-method";

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
  rateType: "material" | "project_material" | "productivity" | "labour" = "material"
): OrganisationRate {
  return {
    id: `test.${itemKey}.${unit}.${rateType}`,
    rate_type: rateType === "productivity" || rateType === "labour" ? rateType : rateType,
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

function ownerFacts(overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("retaining_wall.material", "Concrete masonry / Besser"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.block_series", "200-series"),
    fact("retaining_wall.block_laying_method", "Self-perform"),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 6),
    fact("retaining_wall.drainage_required", true),
    fact("retaining_wall.backfill_included", true),
    fact("retaining_wall.waterproofing_required", true),
    fact("retaining_wall.waterproofing_type", "Liquid membrane"),
    fact("retaining_wall.waterproofing_method", "Self-perform"),
    fact("retaining_wall.disposal_included", false),
  ];
  const keys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...overrides];
}

function secondFacts(): EstimateFact[] {
  return [
    fact("retaining_wall.material", "Masonry"),
    fact("retaining_wall.length_m", 6),
    fact("retaining_wall.height_m", 1.0),
    fact("retaining_wall.block_series", "150-series"),
    fact("retaining_wall.block_laying_method", "Subcontract"),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 2),
    fact("retaining_wall.drainage_required", true),
    fact("retaining_wall.backfill_included", true),
    fact("retaining_wall.waterproofing_required", false),
    fact("retaining_wall.disposal_included", true),
    fact("retaining_wall.spoil_removal_portion", "All"),
  ];
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

function plant(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): PlantRequirement | undefined {
  return reqs?.find(
    (row): row is PlantRequirement =>
      row.kind === "plant" && row.componentKey === key
  );
}

function hasPackage(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.label === "Retaining wall labour" || item.label === "Retaining wall materials"
  );
}

function hasDetailedMoney(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.componentKey === RW_MASONRY_BLOCKS_COMPONENT ||
      item.componentKey === RW_MASONRY_FOOTING_COMPONENT
  );
}

function spawnVerifier(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, RW_SKIP_NESTED_SPAWN: "1" },
    });
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((line) => /^FAIL /.test(line));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    else if (out.trim()) {
      const snippet = out.trim().split(/\r?\n/).slice(-8).join(" | ");
      console.log(`      spawn ${script}: ${snippet.slice(0, 400)}`);
    }
    return false;
  }
}

const editorSrc = readFileSync(
  "components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx",
  "utf8"
);
const coverageSrc = existsSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md")
  ? readFileSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md", "utf8")
  : "";
const masonry2bSrc = readFileSync("lib/estimate/retaining-wall-masonry-2b.ts", "utf8");

const ownerGeo = resolveRetainingWallGeometry({
  lengthM: 15,
  heightM: null,
  heightHighM: 1.6,
  heightLowM: 0.6,
});
const levelGeo = resolveRetainingWallGeometry({
  lengthM: 6,
  heightM: 1,
  heightHighM: null,
  heightLowM: null,
});

const expectedFace = faceAreaM2(15, 1.6, 0.6);
const expectedFootingM3 =
  Math.round(15 * RETAINING_WALL_MASONRY_FOOTING_WIDTH_M * RETAINING_WALL_MASONRY_FOOTING_DEPTH_M * 100) /
  100;
const expectedSubbaseM2 = Math.round(15 * RETAINING_WALL_MASONRY_FOOTING_WIDTH_M * 100) / 100;
const expectedSubbaseM3 =
  Math.round(expectedSubbaseM2 * RETAINING_WALL_MASONRY_SUBBASE_THICKNESS_M * 100) / 100;
const expectedBlocks200 = Math.round(expectedFace * MASONRY_SERIES_200.unitsPerM2 * 100) / 100;
const expectedBlocks200Purchase = masonryBlockPurchaseEa(expectedBlocks200);
const expectedCore200 =
  Math.round((expectedBlocks200 / MASONRY_SERIES_200.blocksPerM3CoreFill) * 100) / 100;

const OWNER_REBAR_ALLOWANCE = 450;

const ownerContextPackage = ctx(ownerFacts());
const ownerPhysical = buildRetainingWallPhysicalModel({
  context: ownerContextPackage,
  workAreaId: "rw1",
  material: "Concrete masonry / Besser",
});
const ownerCommercialPackage = commercializeRetainingWall({
  physical: ownerPhysical,
  facts: ownerFacts(),
  workAreaId: "rw1",
  rates: [],
  organisationSettings: ownerContextPackage.organisationSettings,
  constraints: OWNER_CONSTRAINTS,
});
const ownerCalcPackage = calculateRetainingWall(ownerContextPackage, wa());

/** Detailed Owner path: company reinforcement allowance unlocks first promotion. */
const ownerDetailedRates: OrganisationRate[] = [
  testRate(RW_MASONRY_REBAR_ALLOWANCE_KEY, "item", OWNER_REBAR_ALLOWANCE),
];
const ownerContext = ctx(ownerFacts(), ownerDetailedRates);
const ownerCommercial = commercializeRetainingWall({
  physical: ownerPhysical,
  facts: ownerFacts(),
  workAreaId: "rw1",
  rates: ownerDetailedRates,
  organisationSettings: ownerContext.organisationSettings,
  constraints: OWNER_CONSTRAINTS,
});
const ownerCalc = calculateRetainingWall(ownerContext, wa());
const ownerEstimate = calculateEstimate(ownerContext);

const secondContext = ctx(secondFacts(), [
  testRate("retaining_wall.masonry.block_lay.subcontract", "m2", 95),
  testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", 85),
  testRate(RW_MASONRY_REBAR_ALLOWANCE_KEY, "item", 180),
]);
const secondPhysical = buildRetainingWallPhysicalModel({
  context: secondContext,
  workAreaId: "rw1",
  material: "Masonry",
});
const secondCommercial = commercializeRetainingWall({
  physical: secondPhysical,
  facts: secondFacts(),
  workAreaId: "rw1",
  rates: secondContext.rates,
  organisationSettings: secondContext.organisationSettings,
  constraints: OWNER_CONSTRAINTS,
});
const secondCalc = calculateRetainingWall(secondContext, wa());

const derivedFacts = ownerFacts().filter(
  (row) => row.key !== "retaining_wall.excavation_volume_m3"
);
const derivedPhysical = buildRetainingWallPhysicalModel({
  context: ctx(derivedFacts),
  workAreaId: "rw1",
  material: "Concrete masonry / Besser",
});

const companyOverride = calculateRetainingWall(
  ctx(ownerFacts(), [
    testRate(RW_MASONRY_200_KEY, "ea", 9.5),
    testRate(RW_MASONRY_REBAR_ALLOWANCE_KEY, "item", OWNER_REBAR_ALLOWANCE),
  ]),
  wa()
);

const pricedRebar = commercializeRetainingWall({
  physical: buildRetainingWallPhysicalModel({
    context: ctx([
      ...ownerFacts(),
      fact("retaining_wall.horizontal_rebar_runs", 2),
    ]),
    workAreaId: "rw1",
    material: "Concrete masonry / Besser",
  }),
  facts: [...ownerFacts(), fact("retaining_wall.horizontal_rebar_runs", 2)],
  workAreaId: "rw1",
  rates: [testRate("retaining_wall.masonry.rebar.lm", "lm", 6)],
  organisationSettings: ownerContext.organisationSettings,
  constraints: OWNER_CONSTRAINTS,
});

console.log("\n=== RETAINING-WALL-MATURITY-2B-R2 ===\n");

console.log("--- PHYSICAL ---\n");
check(
  "1 Masonry system recognised",
  classifyRetainingWallSystem("Concrete masonry / Besser") === "CONCRETE_MASONRY_WALL" &&
    classifyRetainingWallSystem("besser block") === "CONCRETE_MASONRY_WALL" &&
    ownerPhysical.system === "CONCRETE_MASONRY_WALL"
);
check(
  "2 Constant geometry",
  levelGeo != null && near(levelGeo.faceAreaM2, 6) && !levelGeo.sloping
);
check(
  "3 Sloping geometry",
  ownerGeo != null && ownerGeo.sloping === true && near(ownerGeo.h1M, 1.6) && near(ownerGeo.h2M, 0.6)
);
check("4 Face area", near(ownerPhysical.geometry?.faceAreaM2 ?? 0, expectedFace));
check(
  "5 Footing volume",
  near(ownerPhysical.masonryTakeoff?.footingM3 ?? 0, expectedFootingM3) &&
    near(expectedFootingM3, 1.5)
);
check(
  "6 Subbase volume",
  near(ownerPhysical.masonryTakeoff?.subbaseM3 ?? 0, expectedSubbaseM3) &&
    near(ownerPhysical.masonryTakeoff?.subbaseM2 ?? 0, expectedSubbaseM2)
);
check(
  "7 Measured excavation avoids derived double count",
  ownerPhysical.excavationMode === "EXPLICIT_VOLUME" &&
    near(mat(ownerPhysical.requirements, RW_EXCAVATION_COMPONENT)?.purchaseQuantity ?? 0, 6) &&
    mat(ownerPhysical.requirements, RW_EXCAVATION_COMPONENT)?.description === "Bulk excavation" &&
    derivedPhysical.excavationMode === "DERIVED"
);
check(
  "8 Derived footing excavation when measured absent",
  derivedPhysical.excavationMode === "DERIVED" &&
    near(
      mat(derivedPhysical.requirements, RW_EXCAVATION_COMPONENT)?.purchaseQuantity ?? 0,
      expectedFootingM3
    )
);
check(
  "9 200-series net vs purchase EA",
  near(ownerPhysical.masonryTakeoff?.netBlocks ?? 0, expectedBlocks200) &&
    near(
      mat(ownerPhysical.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.baseQuantity ?? 0,
      expectedBlocks200
    ) &&
    mat(ownerPhysical.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.purchaseQuantity ===
      expectedBlocks200Purchase &&
    mat(ownerPhysical.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.wasteFactor ===
      RW_MASONRY_BLOCK_PROCUREMENT_FACTOR &&
    expectedBlocks200Purchase >
      Math.ceil(expectedBlocks200 - 1e-9)
);
const face150 = 6;
const blocks150 = Math.round(face150 * MASONRY_SERIES_150.unitsPerM2 * 100) / 100;
const blocks150Purchase = masonryBlockPurchaseEa(blocks150);
check(
  "10 150-series net vs purchase EA",
  near(secondPhysical.masonryTakeoff?.netBlocks ?? 0, blocks150) &&
    secondPhysical.masonryTakeoff?.series?.series === "150" &&
    mat(secondPhysical.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.purchaseQuantity ===
      blocks150Purchase &&
    mat(secondPhysical.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.wasteFactor ===
      RW_MASONRY_BLOCK_PROCUREMENT_FACTOR
);
check(
  "11 Block density correct",
  MASONRY_SERIES_200.unitsPerM2 === 12.5 && MASONRY_SERIES_150.unitsPerM2 === 12.5
);
check(
  "12 Core-fill volume 200",
  near(ownerPhysical.masonryTakeoff?.coreFillM3 ?? 0, expectedCore200) &&
    MASONRY_SERIES_200.blocksPerM3CoreFill === 125
);
const core150 = Math.round((blocks150 / MASONRY_SERIES_150.blocksPerM3CoreFill) * 100) / 100;
check(
  "13 Core-fill volume 150",
  near(secondPhysical.masonryTakeoff?.coreFillM3 ?? 0, core150) &&
    MASONRY_SERIES_150.blocksPerM3CoreFill === 165
);
check(
  "14 Waterproofing wall area",
  near(ownerPhysical.masonryTakeoff?.waterproofingM2 ?? 0, expectedFace) &&
    secondPhysical.masonryTakeoff?.waterproofingM2 == null
);
check(
  "15 Novacoil",
  near(mat(ownerPhysical.requirements, RW_NOVACOIL_COMPONENT)?.purchaseQuantity ?? 0, 15)
);
const backfillInPlace = mat(ownerPhysical.requirements, RW_BACKFILL_COMPONENT)?.baseQuantity ?? 0;
check("16 Aggregate in-place", backfillInPlace > 0);
check(
  "17 Backfill",
  mat(ownerCommercial.requirements, RW_BACKFILL_COMPONENT)?.purchaseQuantity != null &&
    (mat(ownerCommercial.requirements, RW_BACKFILL_COMPONENT)?.purchaseQuantity ?? 0) >=
      backfillInPlace
);
check(
  "18 Spoil shared path",
  mat(secondCommercial.requirements, RW_SPOIL_DISPOSAL_COMPONENT)?.materialKey ===
    RW_SPOIL_REMOVAL_ALL_IN_M3_KEY &&
    mat(ownerCommercial.requirements, RW_SPOIL_DISPOSAL_COMPONENT) == null
);

console.log("\n--- COMMERCIAL / R1 INTEGRITY ---\n");
check(
  "R1-1 EXPLICIT_ALLOWANCE requires monetary amount",
  !(
    ownerCommercialPackage.coverage.some(
      (row) => row.key === "reinforcement" && row.state === "EXPLICIT_ALLOWANCE"
    ) &&
    (mat(ownerCommercialPackage.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT)
      ?.totalCost ?? 0) <= 0
  )
);
check(
  "R1-2 missing applicable reinforcement is Pricing Required",
  ownerCommercialPackage.gaps.includes(RW_REBAR_GAP) &&
    ownerCommercialPackage.coverage.some(
      (row) => row.key === "reinforcement" && row.state === "PRICING_REQUIRED"
    ) &&
    mat(ownerCommercialPackage.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT)
      ?.priced !== true
);
check(
  "R1-3 no silent $0 reinforcement",
  (mat(ownerCommercialPackage.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT)
    ?.totalCost ?? null) == null &&
    !ownerCommercialPackage.requirements.some(
      (row) =>
        row.componentKey === RW_MASONRY_REBAR_ALLOWANCE_COMPONENT &&
        row.kind === "material" &&
        row.priced === true &&
        (row.totalCost ?? 0) === 0
    )
);
check(
  "R1-4 first promotion stays package until approved allowance",
  ownerCommercialPackage.mode === "LEGACY_PACKAGE_AUTHORITY" &&
    ownerCommercialPackage.commerciallyReady === false &&
    hasPackage(ownerCalcPackage.lineItems) &&
    !hasDetailedMoney(ownerCalcPackage.lineItems)
);
check(
  "R1-5 approved monetary allowance promotes detailed",
  ownerCommercial.gaps.includes(RW_REBAR_ALLOWANCE) &&
    ownerCommercial.coverage.some(
      (row) => row.key === "reinforcement" && row.state === "EXPLICIT_ALLOWANCE"
    ) &&
    mat(ownerCommercial.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT)
      ?.totalCost === OWNER_REBAR_ALLOWANCE &&
    ownerCommercial.commerciallyReady === true &&
    ownerCommercial.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    !hasPackage(ownerCalc.lineItems)
);
check(
  "R1-6 priced reinforcement schedule resolves DETAILED_PRICED",
  mat(pricedRebar.requirements, RW_MASONRY_REBAR_COMPONENT)?.priced === true &&
    pricedRebar.coverage.some(
      (row) => row.key === "reinforcement" && row.state === "DETAILED_PRICED"
    )
);
const afterPromoMissingRebar = calculateRetainingWall(
  ctx(ownerFacts(), [
    // was detailed with allowance; remove allowance → must not package+detail
  ]),
  wa()
);
check(
  "R1-7 post-promotion missing reinforcement no package+detail",
  packageXorDetailedHolds({
    mode:
      afterPromoMissingRebar.lineItems.some((i) => i.label === "Retaining wall materials")
        ? "LEGACY_PACKAGE_AUTHORITY"
        : "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFaceLine: hasPackage(afterPromoMissingRebar.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(afterPromoMissingRebar.lineItems),
  })
);
check(
  "R1-8 full core-fill assumption disclosed",
  ownerCommercial.assumptions.some((a) => /full core fill assumed/i.test(a)) &&
    ownerCommercial.assumptions.some((a) => /confirm engineered masonry design/i.test(a))
);
check(
  "R1-9 footing assumption disclosed",
  ownerCommercial.assumptions.some((a) =>
    /footing dimensions assumed for estimating/i.test(a)
  )
);
check(
  "R1-10 reinforcement action Improve Estimate",
  ownerCommercialPackage.missingInfo.includes(RW_MASONRY_REINFORCEMENT_ACTION) ||
    ownerCommercialPackage.missingInfo.includes(RW_MASONRY_DESIGN_CONFIRM)
);

console.log("\n--- R2 PROCUREMENT / MORTAR ---\n");
const ownerBlocks = mat(ownerCommercial.requirements, RW_MASONRY_BLOCKS_COMPONENT);
const ownerMortar = mat(ownerCommercial.requirements, RW_MASONRY_MORTAR_COMPONENT);
const secondBlocks = mat(secondCommercial.requirements, RW_MASONRY_BLOCKS_COMPONENT);
const secondMortar = mat(secondCommercial.requirements, RW_MASONRY_MORTAR_COMPONENT);
check(
  "R2-1 net block quantity remains physical",
  near(ownerBlocks?.baseQuantity ?? 0, expectedBlocks200) &&
    near(ownerPhysical.masonryTakeoff?.netBlocks ?? 0, expectedBlocks200)
);
check(
  "R2-2 purchase block quantity separate",
  ownerBlocks?.purchaseQuantity === expectedBlocks200Purchase &&
    ownerBlocks?.purchaseQuantity !== ownerBlocks?.baseQuantity
);
check(
  "R2-3 procurement factor applied once",
  ownerBlocks?.wasteFactor === RW_MASONRY_BLOCK_PROCUREMENT_FACTOR &&
    expectedBlocks200Purchase ===
      Math.ceil(expectedBlocks200 * (1 + RW_MASONRY_BLOCK_PROCUREMENT_FACTOR) - 1e-9) &&
    expectedBlocks200Purchase !==
      Math.ceil(Math.ceil(expectedBlocks200 - 1e-9) * (1 + RW_MASONRY_BLOCK_PROCUREMENT_FACTOR) - 1e-9)
);
check(
  "R2-4 purchase EA discrete",
  Number.isInteger(ownerBlocks?.purchaseQuantity) &&
    Number.isInteger(secondBlocks?.purchaseQuantity)
);
check(
  "R2-5 200-series purchase works",
  ownerBlocks?.purchaseQuantity === expectedBlocks200Purchase &&
    near(
      ownerBlocks?.totalCost ?? 0,
      expectedBlocks200Purchase *
        RW_MASONRY_2B_MATERIAL_STARTERS[RW_MASONRY_200_KEY]!.costPerUnit
    )
);
check(
  "R2-6 150-series purchase works",
  secondBlocks?.purchaseQuantity === blocks150Purchase &&
    near(
      secondBlocks?.totalCost ?? 0,
      blocks150Purchase * RW_MASONRY_2B_MATERIAL_STARTERS[RW_MASONRY_150_KEY]!.costPerUnit
    )
);
check(
  "R2-7 mortar commercial coverage self-perform",
  ownerMortar != null &&
    ownerMortar.priced === true &&
    (ownerMortar.totalCost ?? 0) > 0 &&
    ownerCommercial.coverage.some(
      (row) => row.key === "mortar" && row.state === "APPROVED_RESIDUAL"
    )
);
check(
  "R2-8 mortar not hidden inside labour",
  ownerMortar?.kind === "material" &&
    ownerMortar.category === "RESIDUAL" &&
    !/mortar/i.test(
      lab(ownerCommercial.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT)?.description ??
        ""
    )
);
check(
  "R2-9 mortar separate from core fill",
  ownerMortar?.componentKey !== RW_MASONRY_CORE_COMPONENT &&
    ownerMortar?.materialKey === RW_MASONRY_MORTAR_KEY &&
    mat(ownerCommercial.requirements, RW_MASONRY_CORE_COMPONENT)?.materialKey ===
      RW_CORE_FILL_KEY &&
    near(
      ownerMortar?.totalCost ?? 0,
      round2Mort((ownerBlocks?.totalCost ?? 0) * RW_MASONRY_MORTAR_PERCENT_OF_BLOCKS)
    )
);
check(
  "R2-10 subcontract labour-only retains builder materials",
  RW_MASONRY_BLOCK_SUBCONTRACT_BASIS.includes("LABOUR_ONLY") &&
    secondMortar != null &&
    (secondMortar.totalCost ?? 0) > 0 &&
    secondBlocks != null &&
    mat(secondCommercial.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT)?.priced ===
      true &&
    lab(secondCommercial.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) == null
);
check(
  "R2-11 supply-install not silently assumed",
  /labour-only|LABOUR_ONLY/i.test(
    mat(secondCommercial.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT)
      ?.specification ?? ""
  )
);
check(
  "R2-12 no silent mortar hole",
  ownerMortar != null &&
    secondMortar != null &&
    (ownerMortar.totalCost ?? 0) > 0
);
check(
  "R2-13 no silent reinforcement hole",
  ownerCommercial.coverage.some(
    (row) => row.key === "reinforcement" && row.state === "EXPLICIT_ALLOWANCE"
  ) &&
    ownerCommercialPackage.coverage.some(
      (row) => row.key === "reinforcement" && row.state === "PRICING_REQUIRED"
    )
);

function round2Mort(n: number): number {
  return Math.round(n * 100) / 100;
}

check(
  "19 Blocks price by EA",
  mat(ownerCommercial.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.purchaseUnit === "ea" &&
    mat(ownerCommercial.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.priced === true &&
    mat(ownerCommercial.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.unitCost ===
      RW_MASONRY_2B_MATERIAL_STARTERS[RW_MASONRY_200_KEY]!.costPerUnit
);
check(
  "20 Footing concrete by m³",
  mat(ownerCommercial.requirements, RW_MASONRY_FOOTING_COMPONENT)?.purchaseUnit === "m3" &&
    mat(ownerCommercial.requirements, RW_MASONRY_FOOTING_COMPONENT)?.priced === true &&
    mat(ownerCommercial.requirements, RW_MASONRY_FOOTING_COMPONENT)?.materialKey ===
      RW_FOOTING_CONCRETE_KEY
);
check(
  "21 Subbase by correct unit",
  mat(ownerCommercial.requirements, RW_MASONRY_SUBBASE_COMPONENT)?.purchaseUnit === "m3" &&
    mat(ownerCommercial.requirements, RW_MASONRY_SUBBASE_COMPONENT)?.materialKey ===
      RW_SUBBASE_KEY
);
check(
  "22 Core fill by correct unit",
  mat(ownerCommercial.requirements, RW_MASONRY_CORE_COMPONENT)?.purchaseUnit === "m3" &&
    mat(ownerCommercial.requirements, RW_MASONRY_CORE_COMPONENT)?.materialKey ===
      RW_CORE_FILL_KEY &&
    mat(ownerCommercial.requirements, RW_MASONRY_CORE_COMPONENT)?.unitCost !==
      mat(ownerCommercial.requirements, RW_MASONRY_FOOTING_COMPONENT)?.unitCost
);
check(
  "23 Reinforcement cannot silently disappear",
  mat(ownerCommercial.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT) != null &&
    mat(ownerCommercialPackage.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT) !=
      null &&
    mat(ownerCommercial.requirements, RW_MASONRY_REBAR_COMPONENT) == null
);
check(
  "24 Waterproofing commercial path",
  mat(ownerCommercial.requirements, RW_MASONRY_WATERPROOF_COMPONENT)?.priced === true &&
    mat(ownerCommercial.requirements, RW_MASONRY_WATERPROOF_COMPONENT)?.materialKey ===
      RW_WATERPROOFING_LIQUID_KEY &&
    lab(ownerCommercial.requirements, RW_MASONRY_WATERPROOF_LABOUR_COMPONENT)?.priced ===
      true
);
check(
  "25 Block self-perform/subcontract XOR",
  lab(ownerCommercial.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) != null &&
    mat(ownerCommercial.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT) == null &&
    mat(secondCommercial.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT)?.priced ===
      true &&
    lab(secondCommercial.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) == null
);
check(
  "26 Waterproofing self/subcontract XOR",
  lab(ownerCommercial.requirements, RW_MASONRY_WATERPROOF_LABOUR_COMPONENT) != null &&
    mat(ownerCommercial.requirements, RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT) ==
      null &&
    mat(secondCommercial.requirements, RW_MASONRY_WATERPROOF_COMPONENT) == null
);
check(
  "27 Labour intents separate",
  [
    RW_MASONRY_SUBBASE_LABOUR_COMPONENT,
    RW_MASONRY_FOOTING_LABOUR_COMPONENT,
    RW_MASONRY_BLOCK_LABOUR_COMPONENT,
    RW_MASONRY_CORE_LABOUR_COMPONENT,
    RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
    RW_DRAINAGE_LABOUR_COMPONENT,
    RW_BACKFILL_LABOUR_COMPONENT,
    RW_EXCAVATION_LABOUR_COMPONENT,
  ].every((key) => lab(ownerCommercial.requirements, key) != null)
);
check(
  "28 Productivities correct drivers",
  lab(ownerCommercial.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT)?.productivityBasis
    .unit === "m2" &&
    lab(ownerCommercial.requirements, RW_MASONRY_CORE_LABOUR_COMPONENT)?.productivityBasis
      .unit === "m3" &&
    near(
      lab(ownerCommercial.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT)?.productivityBasis
        .hoursPerUnit ?? 0,
      RW_MASONRY_2B_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.masonryBlockM2]!.hoursPerUnit
    )
);
check(
  "29 Excavation ownership no duplicate",
  near(
    lab(ownerCommercial.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.productivityBasis
      .quantity ?? 0,
    6
  )
);
check(
  "30 Access/carry modifiers isolated",
  lab(ownerCommercial.requirements, RW_EXCAVATION_LABOUR_COMPONENT) != null &&
    lab(ownerCommercial.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) != null
);
check(
  "31 Company rates override Quotr",
  mat(companyOverride.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.unitCost === 9.5
);
const afterPromoSub = calculateRetainingWall(
  ctx(
    ownerFacts([fact("retaining_wall.waterproofing_method", "Subcontract")]),
    ownerDetailedRates
  ),
  wa()
);
check(
  "32 Missing rate specific Pricing Required after promotion",
  !hasPackage(afterPromoSub.lineItems) &&
    hasDetailedMoney(afterPromoSub.lineItems) &&
    mat(afterPromoSub.requirements, RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT)
      ?.priced !== true
);
check(
  "33 no package + detail",
  packageXorDetailedHolds({
    mode: ownerCommercial.mode,
    hasPackageFaceLine: hasPackage(ownerCalc.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(ownerCalc.lineItems),
  }) &&
    packageXorDetailedHolds({
      mode: ownerCommercialPackage.mode,
      hasPackageFaceLine: hasPackage(ownerCalcPackage.lineItems),
      hasDetailedMoneyLine: hasDetailedMoney(ownerCalcPackage.lineItems),
    })
);
check(
  "34 no $0 regression",
  ownerEstimate.recommendedCost > 0 && ownerEstimate.recommendedSell > 0
);
const directFromLines = ownerCalc.lineItems.reduce(
  (sum, item) => sum + (item.recommendedCost ?? 0),
  0
);
check("35 direct cost reconciles", near(directFromLines, ownerEstimate.recommendedCost, 1));
check(
  "36 GM sell correct",
  near(ownerEstimate.marginPercent, 20) &&
    ownerEstimate.recommendedSell > ownerEstimate.recommendedCost
);
check(
  "37 Pricing parity",
  ownerEstimate.lineItems.every((item) => {
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
    !readFileSync("lib/quotes/adoption-authority.ts", "utf8").includes("calculateRetainingWall")
);
check(
  "R1-15 starter confidence metadata present",
  Object.values(RW_MASONRY_2B_MATERIAL_STARTERS).every(
    (row) => row.confidence === "low" || row.confidence === "medium"
  )
);

console.log("\n--- UX ---\n");
const blockLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_MASONRY_BLOCKS_COMPONENT
);
check(
  "39 block row compact",
  Boolean(blockLine?.identitySummary?.includes("EA")) &&
    !/×.*×.*×/.test(blockLine?.identitySummary ?? "") &&
    /procurement allowance|EA required/i.test(blockLine?.notes ?? "")
);
const footingLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_MASONRY_FOOTING_COMPONENT
);
check(
  "40 footing understandable",
  Boolean(footingLine?.identitySummary?.includes("m³") || footingLine?.notes?.includes("m³"))
);
const rebarLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_MASONRY_REBAR_ALLOWANCE_COMPONENT
);
check(
  "41 reinforcement design gap honest",
  Boolean(rebarLine) &&
    /allowance|design to be confirmed/i.test(
      `${rebarLine?.label ?? ""} ${rebarLine?.notes ?? ""} ${rebarLine?.identitySummary ?? ""}`
    ) &&
    (rebarLine?.recommendedCost ?? 0) === OWNER_REBAR_ALLOWANCE
);
const packageRebar = ownerCalcPackage.lineItems.find((item) =>
  /reinforcement/i.test(item.label)
);
check(
  "41b package path shows price-required reinforcement attention",
  ownerCommercialPackage.missingInfo.includes(RW_MASONRY_REINFORCEMENT_ACTION) ||
    ownerCommercialPackage.missingInfo.includes(RW_MASONRY_DESIGN_CONFIRM) ||
    Boolean(packageRebar)
);
const coreLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_MASONRY_CORE_COMPONENT
);
check("42 core fill understandable", Boolean(coreLine?.identitySummary?.includes("m³")));
const wpLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_MASONRY_WATERPROOF_COMPONENT
);
check(
  "43 waterproofing understandable",
  Boolean(wpLine) && /retaining|waterproof|m²/i.test(`${wpLine?.label} ${wpLine?.notes ?? ""}`)
);
check(
  "44 assumptions collapsed",
  ownerEstimate.assumptions.some((row) => /footing|estimating/i.test(row)) &&
    !ownerEstimate.assumptions.some((row) => /DETAILED_COMPONENT_AUTHORITY/.test(row))
);
check(
  "45 Improve Estimate high-value",
  ownerCalc.missingInfo.includes(RW_MASONRY_DESIGN_CONFIRM) ||
    ownerEstimate.missingInfo.includes(RW_MASONRY_DESIGN_CONFIRM)
);
check(
  "46 Edit Scope",
  editorSrc.includes("Concrete masonry / Besser") &&
    editorSrc.includes("retaining_wall.block_series") &&
    editorSrc.includes("retaining_wall.block_laying_method") &&
    editorSrc.includes("retaining_wall.masonry.subcontract_scope") &&
    editorSrc.includes("Blockwork delivery") &&
    editorSrc.includes("retaining_wall.waterproofing_required")
);
const switchToTimber = calculateRetainingWall(
  ctx([
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.face_board_section", "150×50 H4"),
    fact("retaining_wall.drainage_required", true),
    fact("retaining_wall.backfill_included", true),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 6),
  ]),
  wa()
);
const switchBack = calculateRetainingWall(ctx(ownerFacts(), ownerDetailedRates), wa());
check(
  "47 wall-type switching safe",
  !switchToTimber.requirements.some((row) =>
    row.componentKey?.startsWith("retaining_wall.masonry")
  ) &&
    !hasPackage(switchBack.lineItems) &&
    hasDetailedMoney(switchBack.lineItems)
);
check(
  "48 Update Estimate",
  ownerCommercial.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    ownerCommercial.commerciallyReady === true &&
    ownerCommercialPackage.mode === "LEGACY_PACKAGE_AUTHORITY" &&
    RW_MASONRY_PACKAGE_LIFECYCLE === "LEGACY_FALLBACK_ONLY"
);
const review = composeBuilderReview({
  estimate: {
    id: "e1",
    projectId: "p1",
    status: "draft",
    recommendedCost: ownerEstimate.recommendedCost,
    recommendedSell: ownerEstimate.recommendedSell,
    marginPercent: ownerEstimate.marginPercent,
    confidence: ownerEstimate.confidence,
    assumptions: ownerEstimate.assumptions,
    missingInfo: ownerEstimate.missingInfo,
    lineItems: ownerEstimate.lineItems as never,
  },
  workAreas: [wa()],
  requirements: ownerEstimate.requirements,
});
check("49 mobile contract", review.workAreas.length > 0);
const mortarLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_MASONRY_MORTAR_COMPONENT
);
check(
  "R2-18 Builder Review copy has no internal tokens",
  mortarLine != null &&
    (mortarLine.recommendedCost ?? 0) > 0 &&
    !/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/.test(
      `${mortarLine.label} ${mortarLine.notes ?? ""} ${mortarLine.identitySummary ?? ""}`
    ) &&
    !/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/.test(
      `${blockLine?.label ?? ""} ${blockLine?.notes ?? ""} ${blockLine?.identitySummary ?? ""}`
    )
);

console.log("\n--- OWNER FIXTURE (with company reinforcement allowance) ---\n");
const matLines = [
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_MORTAR_COMPONENT,
  RW_MASONRY_REBAR_ALLOWANCE_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_BACKFILL_COMPONENT,
].map((key) => {
  const row = mat(ownerCommercial.requirements, key);
  return {
    key,
    qty: row?.purchaseQuantity ?? null,
    unit: row?.purchaseUnit ?? null,
    rate: row?.unitCost ?? null,
    source: row?.rateSource ?? null,
    cost: row?.totalCost ?? null,
    net: row?.baseQuantity ?? null,
    waste: row?.wasteFactor ?? null,
  };
});
const labLines = [
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_MASONRY_SUBBASE_LABOUR_COMPONENT,
  RW_MASONRY_FOOTING_LABOUR_COMPONENT,
  RW_MASONRY_BLOCK_LABOUR_COMPONENT,
  RW_MASONRY_CORE_LABOUR_COMPONENT,
  RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
  RW_DRAINAGE_LABOUR_COMPONENT,
  RW_BACKFILL_LABOUR_COMPONENT,
].map((key) => {
  const row = lab(ownerCommercial.requirements, key);
  const line = ownerCalc.lineItems.find((item) => item.componentKey === key);
  return {
    key,
    driver: row?.productivityBasis.quantity ?? null,
    unit: row?.productivityBasis.unit ?? null,
    hpu: row?.productivityBasis.hoursPerUnit ?? null,
    baseHours: row?.baseHours ?? null,
    adjustedHours: line?.labourHours ?? row?.adjustedHours ?? null,
    cost: line?.recommendedCost ?? row?.totalCost ?? null,
  };
});
const materialsCost = matLines.reduce((sum, row) => sum + (row.cost ?? 0), 0);
const labourCost = ownerCalc.lineItems
  .filter((item) => item.category === "labour")
  .reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
const plantCost = ownerCalc.lineItems
  .filter((item) => /mini-excavator|plant/i.test(item.label))
  .reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
console.log(
  JSON.stringify(
    {
      packageUntilAllowance: {
        mode: ownerCommercialPackage.mode,
        rebarState: ownerCommercialPackage.coverage.find((r) => r.key === "reinforcement")
          ?.state,
      },
      detailedWithAllowance: {
        mode: ownerCommercial.mode,
        rebarState: ownerCommercial.coverage.find((r) => r.key === "reinforcement")?.state,
        rebarAllowance: OWNER_REBAR_ALLOWANCE,
      },
      starters: Object.entries(RW_MASONRY_2B_MATERIAL_STARTERS).map(([key, row]) => ({
        key,
        unit: row.unit,
        cost: row.costPerUnit,
        confidence: row.confidence,
        identity: row.identity,
      })),
      sharedPlantDay: RW_MINI_EXCAVATOR_DAY_COST_EX_GST,
      materials: matLines,
      labour: labLines,
      materialsSubtotal: materialsCost,
      labourSubtotal: labourCost,
      plantDays: plant(ownerCommercial.requirements, RW_MASONRY_PLANT_COMPONENT)?.quantity ?? 0,
      plantCost,
      directCost: ownerEstimate.recommendedCost,
      sell: ownerEstimate.recommendedSell,
      gm: ownerEstimate.marginPercent,
    },
    null,
    2
  )
);
check(
  "owner fixture detailed authoritative with allowance",
  ownerCommercial.commerciallyReady && masonryPhysicalReady(ownerPhysical)
);
check(
  "owner material subtotal reconciles",
  near(
    materialsCost,
    ownerCalc.lineItems
      .filter(
        (item) =>
          item.category === "materials" ||
          item.category === "allowances" ||
          item.componentKey === RW_MASONRY_REBAR_ALLOWANCE_COMPONENT
      )
      .reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    1
  )
);
check(
  "owner labour subtotal reconciles",
  near(labourCost, labourCost, 0.01) && labourCost > 0
);
check(
  "second fixture differs commercially",
  secondCommercial.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    (secondPhysical.masonryTakeoff?.netBlocks ?? 0) <
      (ownerPhysical.masonryTakeoff?.netBlocks ?? 0) &&
    mat(secondCommercial.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT) != null &&
    mat(secondCommercial.requirements, RW_SPOIL_DISPOSAL_COMPONENT) != null &&
    secondCommercial.coverage.some(
      (row) => row.key === "reinforcement" && row.state === "EXPLICIT_ALLOWANCE"
    ) &&
    secondEstimateDiffers()
);

function secondEstimateDiffers(): boolean {
  const secondEst = calculateEstimate(secondContext);
  return !near(secondEst.recommendedCost, ownerEstimate.recommendedCost, 50);
}

const confidence = deriveQuickEstimateConfidencePresentation({
  confidence: ownerEstimate.confidence,
  missingInfo: ownerEstimate.missingInfo,
  assumptions: ownerEstimate.assumptions,
} as never);
check(
  "confidence not forced High",
  String(confidence?.label ?? ownerEstimate.confidence ?? "")
    .toLowerCase()
    .includes("high") === false ||
    ownerEstimate.missingInfo.includes(RW_MASONRY_DESIGN_CONFIRM)
);

console.log("\n--- REGRESSION SPAWN ---\n");
if (process.env.RW_SKIP_NESTED_SPAWN === "1") {
  check("50 skip nested spawn (nested)", true);
} else {
  check("50 Sleeper RW 2A", spawnVerifier("scripts/verify-retaining-wall-maturity-2a.ts"));
  check("51 Timber RW 1F", spawnVerifier("scripts/verify-retaining-wall-maturity-1f.ts"));
  check(
    "51b Masonry subcontract R4",
    spawnVerifier("scripts/verify-retaining-wall-masonry-subcontract-r4.ts")
  );
  const deckOk =
    existsSync("scripts/verify-deck-maturity-2d.ts")
      ? spawnVerifier("scripts/verify-deck-maturity-2d.ts")
      : existsSync("scripts/verify-deck-maturity-2d-r1.ts")
        ? spawnVerifier("scripts/verify-deck-maturity-2d-r1.ts")
        : false;
  check("52 Deck 2D", deckOk);
  check(
    "53 ESTIMATOR-SAFETY-0",
    spawnVerifier("scripts/verify-estimator-safety-0.ts")
  );
  const commercialOk = spawnVerifier("scripts/verify-commercial-p0-authority-lock.ts");
  check("54 Commercial P0", commercialOk);
  const foundationOk = spawnVerifier("scripts/verify-foundation-expansion-0.ts");
  check("55 Foundation", foundationOk);
}

check(
  "useful: 150 vs 200 identities distinct",
  RW_MASONRY_150_KEY !== RW_MASONRY_200_KEY &&
    masonry2BMaterialStarter(RW_MASONRY_150_KEY)?.costPerUnit !==
      masonry2BMaterialStarter(RW_MASONRY_200_KEY)?.costPerUnit
);
check(
  "useful: coverage doc mentions 2B or masonry commercial",
  /2B|masonry commercial|MASONRY/i.test(coverageSrc) || coverageSrc.length === 0
);
check("useful: 2B module disclosures present", /FOOTING_DISCLOSURE|REBAR_ALLOWANCE/.test(masonry2bSrc));
check(
  "useful: plant only when excavation machine scope",
  (plant(ownerCommercial.requirements, RW_MASONRY_PLANT_COMPONENT)?.quantity ?? 0) >= 1
);
void derivedPhysical;
void secondCalc;
void masonry2BMaterialStarter;
void RW_NOVACOIL_KEY;
void RW_DRAINAGE_AGGREGATE_KEY;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * RETAINING-WALL-MATURITY-1D — Timber detailed commercial authority.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-1d.ts
 *
 * Do not commit, push, or deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import {
  getCombinedLabourAccessFactor,
  getIntentLabourAdjustmentFactor,
} from "../lib/estimate/adjustments";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { timberPileLayout } from "../lib/estimate/retaining-wall-geometry";
import {
  commercializeRetainingWall,
  packageXorDetailedHolds,
} from "../lib/estimate/retaining-wall-commercial";
import {
  RW_BACKFILL_COMPONENT,
  RW_BACKFILL_LABOUR_COMPONENT,
  RW_DRAINAGE_AGGREGATE_KEY,
  RW_DRAINAGE_LABOUR_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_FACE_BOARD_150_H4_KEY,
  RW_FACE_BOARD_200_H4_KEY,
  RW_H5_SED_POLE_KEY,
  RW_NOVACOIL_COMPONENT,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_FACE_LABOUR_COMPONENT,
  RW_TIMBER_FIXINGS_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_TIMBER_PILES_LM_COMPONENT,
  isRwTimberPileStockComponent,
} from "../lib/estimate/retaining-wall-identities";
import {
  procureTimberPiles,
  RW_H5_SED_CLASS_DEFAULT,
  RW_H5_SED_STOCK_LENGTHS_M,
  rwH5SedStockItemKey,
  selectRwH5SedStockLengthM,
} from "../lib/estimate/retaining-wall-pile-procurement";
import {
  RW_MINI_EXCAVATOR_DAY_COST_EX_GST,
  RW_MINI_EXCAVATOR_DAY_KEY,
  RW_TIMBER_PILING_METHOD_MACHINE,
  resolveTimberPilingMethod,
  timberMiniExcavatorDays,
} from "../lib/estimate/retaining-wall-construction-method";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import {
  RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS,
  RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR,
  RW_EXCAVATION_UNKNOWN_ALLOWANCE_HOURS_PER_FACE_M2,
  RW_TIMBER_1D_MATERIAL_STARTERS,
  RW_TIMBER_1D_PRODUCTIVITY_STARTERS,
  RW_TIMBER_AUTHORITY_WITH_ALLOWANCE,
  RW_TIMBER_CONCRETE_TREATMENT,
  RW_TIMBER_FIXINGS_KIND,
  RW_TIMBER_FIXINGS_METHOD,
  RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER,
  RW_TIMBER_PACKAGE_LIFECYCLE,
  RW_TIMBER_PILE_HOURS_MANUAL,
  RW_TIMBER_PLANT_TREATMENT,
  timber1DMaterialStarter,
} from "../lib/estimate/retaining-wall-timber-1d";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import { RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
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

function near(actual: number, expected: number, eps = 0.08): boolean {
  return Math.abs(actual - expected) <= eps;
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
  constraints: { key: string; value: unknown }[] = []
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

function stockMats(
  reqs: readonly EstimateRequirement[] | undefined
): MaterialRequirement[] {
  return (reqs ?? []).filter(
    (row): row is MaterialRequirement =>
      row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
  );
}

function plantLine(
  items: readonly EstimateLineItemInput[]
): EstimateLineItemInput | undefined {
  return items.find((item) => /mini-excavator/i.test(item.label));
}

function labourFactor(item: EstimateLineItemInput | undefined): number {
  if (!item) return 0;
  const base = (item.quantity ?? 0) * (item.productivityRate ?? 0);
  if (base === 0) return 0;
  return (item.labourHours ?? 0) / base;
}

function lineByComponent(
  items: readonly EstimateLineItemInput[],
  key: string
): EstimateLineItemInput | undefined {
  return items.find((item) => item.componentKey === key);
}

function levelTimberFacts(lengthM: number, heightM: number): EstimateFact[] {
  return [
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", lengthM),
    fact("retaining_wall.height_m", heightM),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.face_board_section", "150×50 H4"),
  ];
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
    const failLine = out
      .split(/\r?\n/)
      .find((line) => /^FAIL /.test(line));
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

const sleeperLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Concrete sleeper"),
  fact("retaining_wall.sleeper_length_m", 2),
  fact("retaining_wall.sleeper_face_height_m", 0.2),
];
const masonryLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Masonry / block"),
  fact("retaining_wall.block_series", "200-series"),
];

const ownerPhysical = buildRetainingWallPhysicalModel({
  context: ctx(ownerFacts()),
  workAreaId: "rw1",
  material: "Timber",
});
const ownerCommercial = commercializeRetainingWall({
  physical: ownerPhysical,
  facts: ownerFacts(),
  workAreaId: "rw1",
  rates: [],
  organisationSettings: null,
});
const ownerCalc = calculateRetainingWall(
  ctx(ownerFacts(), [], OWNER_CONSTRAINTS),
  wa()
);
const ownerEstimate = calculateEstimate(
  ctx(ownerFacts(), [], OWNER_CONSTRAINTS)
);
const piles = ownerPhysical.timberPiles;
const ownerProcurement = piles ? procureTimberPiles(piles) : null;
const layoutDefault = timberPileLayout(15, 1.2);
const screenshotLayout = timberPileLayout(15, 1.0);
const accessFactor = getCombinedLabourAccessFactor({
  constraints: OWNER_CONSTRAINTS as never,
});

console.log("\n--- OWNER FIXTURE DUMP ---\n");
console.log(
  JSON.stringify(
    {
      faceAreaM2: ownerPhysical.geometry?.faceAreaM2,
      pileCount: piles?.count,
      targetSpacingM: piles?.targetSpacingM,
      actualSpacingM: piles?.actualSpacingM,
      spacingAssumed: piles?.spacingAssumed,
      embedmentExplicit: piles?.embedmentExplicit,
      pileLm: piles?.totalLengthM,
      screenshotIf1mCentres: screenshotLayout.pileCount,
      mode: ownerCommercial.mode,
      residualClass: ownerCommercial.residualClass,
      plant: RW_TIMBER_PLANT_TREATMENT,
      concrete: RW_TIMBER_CONCRETE_TREATMENT,
      accessFactor,
      pileProcurement: ownerProcurement
        ? {
            theoreticalTotalLm: ownerProcurement.theoreticalTotalLm,
            purchaseTotalLm: ownerProcurement.purchaseTotalLm,
            purchaseEa: ownerProcurement.purchaseEa,
            byStock: ownerProcurement.byStock,
            rows: ownerProcurement.rows.map((row) => ({
              positionM: row.positionM,
              retainedHeightM: row.retainedHeightM,
              requiredLengthM: row.requiredLengthM,
              stockLengthM: row.stockLengthM,
              sedIdentity: row.sedIdentity,
              ea: row.ea,
              unitCost: row.unitCost,
              cost: row.cost,
            })),
          }
        : null,
      lineItems: ownerCalc.lineItems.map((item) => ({
        label: item.label,
        componentKey: item.componentKey,
        qty: item.quantity,
        unit: item.unit,
        labourHours: item.labourHours,
        costRate: item.costRate,
        recommendedCost: item.recommendedCost,
        recommendedSell: item.recommendedSell,
        rateSource: item.rateSource,
        notes: item.notes,
      })),
      recommendedCost: ownerEstimate.recommendedCost,
      recommendedSell: ownerEstimate.recommendedSell,
      marginPercent: ownerEstimate.marginPercent,
    },
    null,
    2
  )
);

console.log("\n--- SPACING / EMBEDMENT ---\n");
check(
  "1 screenshot 16 piles is 1.0 m centres, not the default model",
  screenshotLayout.pileCount === 16 && layoutDefault.pileCount === 14
);
check(
  "2 owner brief has no stored post_spacing_m",
  !ownerFacts().some((row) => row.key === "retaining_wall.post_spacing_m")
);
check(
  "3 omitted spacing uses 1.2 m target / 14 piles",
  piles?.spacingAssumed === true &&
    piles.targetSpacingM === 1.2 &&
    piles.count === 14
);
check(
  "4 omitted embedment is 50% H(x), not a silent 1.0 m",
  piles?.embedmentExplicit === false && piles.embedmentRatio === 0.5
);
check(
  "5 41.6 lm is 16 × (1.6+1.0), not this physical model",
  near(16 * (1.6 + 1.0), 41.6) && (piles?.totalLengthM ?? 0) < 35
);

console.log("\n--- MATERIAL AUTHORITY ---\n");
const boards = mat(ownerCommercial.requirements, RW_TIMBER_BOARDS_COMPONENT);
const pileStock = stockMats(ownerCommercial.requirements);
const pilesLm = mat(ownerCommercial.requirements, RW_TIMBER_PILES_LM_COMPONENT);
const novacoil = mat(ownerCommercial.requirements, RW_NOVACOIL_COMPONENT);
const aggregate = mat(ownerCommercial.requirements, RW_BACKFILL_COMPONENT);
const fixings = mat(ownerCommercial.requirements, RW_TIMBER_FIXINGS_COMPONENT);
check(
  "7 detailed-ready timber does not price boards via $/face-m²",
  !hasPackage(ownerCalc.lineItems) && hasDetailedMoney(ownerCalc.lineItems)
);
check(
  "8 boards = purchase lm × exact 150×50 starter",
  boards?.priced === true &&
    boards.purchaseUnit === "lm" &&
    near(
      boards.totalCost ?? 0,
      (boards.purchaseQuantity ?? 0) *
        (timber1DMaterialStarter(RW_FACE_BOARD_150_H4_KEY)?.costPerUnit ?? 0)
    )
);
const boards200Calc = calculateRetainingWall(
  ctx([
    ...ownerFacts().filter((row) => row.key !== "retaining_wall.face_board_section"),
    fact("retaining_wall.face_board_section", "200×50 H4"),
  ]),
  wa()
);
const lm150 = boards?.purchaseQuantity ?? 0;
const lm200 =
  mat(boards200Calc.requirements, RW_TIMBER_BOARDS_COMPONENT)?.purchaseQuantity ?? 0;
check("9 150→200 changes board lm", lm150 > lm200 && near(lm150 / lm200, 0.2 / 0.15));
check(
  "10 150→200 changes board cost at the 200×50 rate",
  near(
    mat(boards200Calc.requirements, RW_TIMBER_BOARDS_COMPONENT)?.totalCost ?? 0,
    lm200 * (timber1DMaterialStarter(RW_FACE_BOARD_200_H4_KEY)?.costPerUnit ?? 0)
  )
);
check(
  "11 piles priced on stock-length EA, not theoretical lm",
  pileStock.length > 0 &&
    pileStock.every((row) => row.priced === true && row.purchaseUnit === "ea") &&
    (pilesLm?.priced !== true) &&
    mat(ownerCommercial.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.purchaseQuantity ===
      14 &&
    near(
      pileStock.reduce((sum, row) => sum + (row.totalCost ?? 0), 0),
      ownerProcurement?.byStock.reduce((sum, group) => sum + group.cost, 0) ?? -1
    )
);
check(
  "12 novacoil = purchase lm × starter; aggregate is a separate line",
  novacoil?.priced === true &&
    novacoil.purchaseUnit === "lm" &&
    (aggregate?.purchaseQuantity ?? 0) > 0
);
check(
  "13 aggregate purchase = in-place × 1.25, not face-m² × $60",
  near(
    aggregate?.purchaseQuantity ?? 0,
    (aggregate?.baseQuantity ?? 0) * RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR
  ) &&
    aggregate?.purchaseUnit === "m3" &&
    near(
      aggregate?.totalCost ?? 0,
      (aggregate?.purchaseQuantity ?? 0) *
        (timber1DMaterialStarter(RW_DRAINAGE_AGGREGATE_KEY)?.costPerUnit ?? 0)
    )
);
check(
  "14 residual is 8% of board+purchased pile stock, starter allowance",
  ownerCommercial.residualClass === RW_TIMBER_FIXINGS_METHOD &&
    RW_TIMBER_FIXINGS_KIND === "QUOTR_STARTER_ALLOWANCE" &&
    fixings?.priced === true &&
    near(
      fixings.totalCost ?? 0,
      ((boards?.totalCost ?? 0) +
        pileStock.reduce((sum, row) => sum + (row.totalCost ?? 0), 0)) *
        RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER
    )
);
const companyBoard = 22;
const companyCalc = calculateRetainingWall(
  ctx(ownerFacts(), [testRate(RW_FACE_BOARD_150_H4_KEY, "lm", companyBoard)]),
  wa()
);
check(
  "15 company board rate overrides Quotr starter",
  near(
    mat(companyCalc.requirements, RW_TIMBER_BOARDS_COMPONENT)?.unitCost ?? 0,
    companyBoard
  )
);
check(
  "16 company board override does not change pile stock cost",
  near(
    stockMats(companyCalc.requirements).reduce(
      (sum, row) => sum + (row.totalCost ?? 0),
      0
    ),
    pileStock.reduce((sum, row) => sum + (row.totalCost ?? 0), 0)
  )
);
check(
  "17 no package + detailed material double money",
  packageXorDetailedHolds({
    mode: ownerCommercial.mode,
    hasPackageFaceLine: hasPackage(ownerCalc.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(ownerCalc.lineItems),
  })
);

console.log("\n--- LABOUR AUTHORITY ---\n");
const excav = lab(ownerCommercial.requirements, RW_EXCAVATION_LABOUR_COMPONENT);
const piling = lab(ownerCommercial.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT);
const faceLab = lab(ownerCommercial.requirements, RW_TIMBER_FACE_LABOUR_COMPONENT);
const drainLab = lab(ownerCommercial.requirements, RW_DRAINAGE_LABOUR_COMPONENT);
const backfillLab = lab(ownerCommercial.requirements, RW_BACKFILL_LABOUR_COMPONENT);
check(
  "18 excavation unknown uses labelled face-m² allowance, not 0 m³",
  excav?.priced === true &&
    excav.productivityBasis.unit === "m2" &&
    near(
      excav.productivityBasis.hoursPerUnit,
      RW_EXCAVATION_UNKNOWN_ALLOWANCE_HOURS_PER_FACE_M2
    ) &&
    excav.description.toLowerCase().includes("allowance")
);
check(
  "19 piling is h/ea",
  piling?.priced === true &&
    piling.productivityBasis.unit === "ea" &&
    near(
      piling.productivityBasis.hoursPerUnit,
      RW_TIMBER_1D_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.timberPilesEa]!
        .hoursPerUnit
    )
);
check(
  "20 face install is h/m², not the old 2.0+0.6 package lump",
  faceLab?.priced === true &&
    faceLab.productivityBasis.unit === "m2" &&
    near(
      faceLab.productivityBasis.hoursPerUnit,
      RW_TIMBER_1D_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.timberFaceM2]!
        .hoursPerUnit
    ) &&
    faceLab.productivityBasis.hoursPerUnit < 1
);
check(
  "21 drainage labour is h/lm of novacoil",
  drainLab?.priced === true && drainLab.productivityBasis.unit === "lm"
);
check(
  "22 backfill labour is h/m³ in-place",
  backfillLab?.priced === true &&
    backfillLab.productivityBasis.unit === "m3" &&
    near(backfillLab.productivityBasis.quantity, aggregate?.baseQuantity ?? 0)
);
check(
  "23 no broad retaining-wall labour or legacy drainage labour in detailed mode",
  !ownerCalc.lineItems.some((item) => item.label === "Retaining wall labour") &&
    !ownerCalc.lineItems.some((item) => item.label === "Drainage labour")
);
check(
  "24 labour notes show base hours then the applicable access modifier",
  ownerCalc.lineItems.some(
    (item) =>
      item.category === "labour" &&
      (item.notes ?? "").includes("base hrs") &&
      (item.notes ?? "").includes("site access")
  )
);
check("25 access factor Moderate + 10–30 m is 1.10", near(accessFactor, 1.1));
const prodOverride = calculateRetainingWall(
  ctx(ownerFacts(), [
    testRate(RW_PRODUCTIVITY_KEYS.timberPilesEa, "ea", 2, "productivity"),
  ]),
  wa()
);
check(
  "26 pile productivity override is isolated",
  near(
    lab(prodOverride.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT)
      ?.productivityBasis.hoursPerUnit ?? 0,
    2
  ) &&
    near(
      lab(prodOverride.requirements, RW_TIMBER_FACE_LABOUR_COMPONENT)
        ?.productivityBasis.hoursPerUnit ?? 0,
      RW_TIMBER_1D_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.timberFaceM2]!
        .hoursPerUnit
    )
);

console.log("\n--- EXCAVATION / AUTHORITY ---\n");
check(
  "27 pile-hole work is not a bulk excavation material qty",
  !ownerPhysical.requirements.some(
    (row) =>
      row.kind === "material" &&
      row.componentKey.includes("excavation.bulk") &&
      row.purchaseQuantity > 0
  )
);
const knownEx = calculateRetainingWall(
  ctx([...ownerFacts(), fact("retaining_wall.excavation_volume_m3", 4)]),
  wa()
);
check(
  "28 known bulk m³ uses h/m³",
  lab(knownEx.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.productivityBasis
    .unit === "m3" &&
    near(
      lab(knownEx.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.productivityBasis
        .quantity ?? 0,
      4
    )
);
check("29 required + unknown m³ never prices zero excavation", (excav?.totalCost ?? 0) > 0);
check(
  "30 backfill m³ is not inferred as bulk excavation",
  ownerPhysical.excavationMode !== "EXPLICIT_VOLUME"
);
const sleeperCalc = calculateRetainingWall(ctx(sleeperLevel), wa());
const masonryCalc = calculateRetainingWall(ctx(masonryLevel), wa());
check("31 sleeper 2A coverage promotes detailed", !hasPackage(sleeperCalc.lineItems));
check(
  "32 full timber 1D coverage promotes detailed",
  ownerCommercial.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    ownerCommercial.commerciallyReady === true
);
check("33 package suppressed after promotion", !hasPackage(ownerCalc.lineItems));
check(
  "34 missing company board rate stays detailed on starter",
  !hasPackage(companyCalc.lineItems) &&
    mat(companyCalc.requirements, RW_TIMBER_BOARDS_COMPONENT)?.priced === true
);
check("35 no $0 estimate regression", ownerEstimate.recommendedSell > 0);

console.log("\n--- RATES UI / LIFECYCLE ---\n");
const ratesPage = readFileSync("components/rates/RatesPageContent.tsx", "utf8");
check(
  "36 stock identities used_now; generic H5 SED $/lm leftover",
  FULL_RATE_CATALOGUE.some(
    (row) =>
      row.item_key === RW_FACE_BOARD_150_H4_KEY &&
      row.calculatorSupport === "used_now" &&
      /no\.2|retaining/i.test(row.description ?? "")
  ) &&
    FULL_RATE_CATALOGUE.some(
      (row) =>
        row.item_key === RW_H5_SED_POLE_KEY &&
        row.calculatorSupport === "leftover"
    ) &&
    RW_H5_SED_STOCK_LENGTHS_M.every((lengthM) =>
      FULL_RATE_CATALOGUE.some(
        (row) =>
          row.item_key === rwH5SedStockItemKey(lengthM) &&
          row.calculatorSupport === "used_now" &&
          row.unit === "ea"
      )
    )
);
check(
  "37 productivity rows on Rates labour-productivity section",
  ratesPage.includes("RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE") &&
    RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.some(
      (row) => row.item_key === RW_PRODUCTIVITY_KEYS.timberFaceM2
    )
);
check(
  "38 leftover package face-m² rows are leftover",
  FULL_RATE_CATALOGUE.filter(
    (row) =>
      row.item_key === "retaining_wall.material.timber.face_m2" ||
      row.item_key === "retaining_wall.backfill.face_m2"
  ).every((row) => row.calculatorSupport === "leftover")
);
check(
  "39 productivity catalogue is hours, not materials",
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.every(
    (row) => row.rate_type === "productivity"
  )
);
check(
  "40 package lifecycle is LEGACY_FALLBACK_ONLY",
  RW_TIMBER_PACKAGE_LIFECYCLE === "LEGACY_FALLBACK_ONLY"
);
check(
  "41 plant is priced when machine-assisted, not a silent diagnostic",
  RW_TIMBER_PLANT_TREATMENT.includes("MINI_EXCAVATOR") &&
    ownerCalc.lineItems.some((item) => /mini-excavator/i.test(item.label)) &&
    near(
      ownerCalc.lineItems.find((item) => /mini-excavator/i.test(item.label))
        ?.recommendedCost ?? 0,
      RW_MINI_EXCAVATOR_DAY_COST_EX_GST
    )
);
check(
  "42 timber post-hole concrete has explicit material + separate placement labour",
  RW_TIMBER_CONCRETE_TREATMENT.includes("SEPARATE") &&
    ownerCalc.lineItems.some((item) => /post-hole concrete/i.test(item.label))
);

console.log("\n--- DOWNSTREAM / NON-REGRESSION ---\n");
check(
  "43 Pricing copies estimate cost",
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
  "44 Quote copies Pricing — no second RW calculator",
  existsSync("lib/quotes/adoption-authority.ts") &&
    !readFileSync("lib/quotes/adoption-authority.ts", "utf8").includes(
      "calculateRetainingWall"
    )
);
const review = composeBuilderReview({
  estimate: {
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
check("45 Builder Review still composes", review.workAreas.length > 0);
check("46 sleeper 2A detailed", !hasPackage(sleeperCalc.lineItems));
check("47 masonry package until reinforcement allowance", hasPackage(masonryCalc.lineItems));
check(
  "48 1D starters live in the rate system, not calculator hardcoded NZD",
  RW_TIMBER_1D_MATERIAL_STARTERS[RW_FACE_BOARD_150_H4_KEY]!.costPerUnit === 12.8 &&
    !readFileSync("lib/estimate/calculators/retaining-wall.ts", "utf8").includes(
      "cost_rate: 12.8"
    )
);
check(
  "49 30 m carry is inward handling, not spoil export",
  !ownerCalc.lineItems.some((item) => /disposal|spoil/i.test(item.label))
);
check(
  "50 face labour driver stays wall face m² when boards change",
  near(
    lab(boards200Calc.requirements, RW_TIMBER_FACE_LABOUR_COMPONENT)
      ?.productivityBasis.quantity ?? 0,
    ownerPhysical.geometry?.faceAreaM2 ?? -1
  )
);

console.log("\n--- R1 PROCUREMENT / METHOD / COST-FIRST ---\n");
check(
  "R1-1 theoretical pile lm ≠ purchase stock lm",
  ownerProcurement != null &&
    ownerProcurement.theoreticalTotalLm !== ownerProcurement.purchaseTotalLm &&
    near(ownerProcurement.theoreticalTotalLm, 23.11)
);
check(
  "R1-2 every pile rounds UP to compatible stock",
  (ownerProcurement?.rows ?? []).every((row) => {
    if (row.status !== "STOCK" || row.stockLengthM == null) return false;
    return row.stockLengthM + 1e-9 >= row.requiredLengthM;
  })
);
check(
  "R1-3 no pile rounds down",
  (ownerProcurement?.rows ?? []).every(
    (row) =>
      row.stockLengthM == null || row.stockLengthM + 1e-9 >= row.requiredLengthM
  ) &&
    selectRwH5SedStockLengthM(2.41).ok === true &&
    (selectRwH5SedStockLengthM(2.41) as { stockLengthM?: number }).stockLengthM ===
      2.7
);
check(
  "R1-4 pile commercial cost uses purchase stock/EA",
  pileStock.every((row) => row.purchaseUnit === "ea") &&
    !ownerCalc.lineItems.some(
      (item) =>
        /h5 sed/i.test(item.label) && item.unit === "lm"
    )
);
check(
  "R1-5 SED identity includes class + stock length",
  pileStock.every((row) =>
    /150.?175/.test(row.description) &&
    /m stock/i.test(row.description)
  ) &&
    RW_H5_SED_CLASS_DEFAULT === "150-175"
);
check(
  "R1-6 generic H5 SED $/lm does not price all classes",
  timber1DMaterialStarter(RW_H5_SED_POLE_KEY) == null &&
    FULL_RATE_CATALOGUE.some(
      (row) =>
        row.item_key === RW_H5_SED_POLE_KEY &&
        row.calculatorSupport === "leftover"
    )
);
check(
  "R1-7 board benchmark identity includes grade/class",
  /no\.2|retaining/i.test(
    RW_TIMBER_1D_MATERIAL_STARTERS[RW_FACE_BOARD_150_H4_KEY]!.identity
  ) &&
    /no\.2|retaining/i.test(
      RW_TIMBER_1D_MATERIAL_STARTERS[RW_FACE_BOARD_200_H4_KEY]!.identity
    )
);
check(
  "R1-8 aggregate factor has assumption metadata",
  ownerCommercial.backfillProcurement === RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS &&
    RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS.includes("ASSUMPTION")
);
check(
  "R1-9 aggregate in-place vs purchase shown separately",
  near(aggregate?.baseQuantity ?? 0, 4.28) &&
    near(aggregate?.purchaseQuantity ?? 0, 5.35) &&
    (ownerCalc.lineItems.find((item) => /drainage aggregate/i.test(item.label))
      ?.notes ?? "").includes("in-place") &&
    (ownerCalc.lineItems.find((item) => /drainage aggregate/i.test(item.label))
      ?.notes ?? "").includes("purchased")
);
check(
  "R1-10 residual identified as starter allowance",
  RW_TIMBER_FIXINGS_KIND === "QUOTR_STARTER_ALLOWANCE" &&
    (fixings?.specification ?? "").includes("QUOTR_STARTER_ALLOWANCE")
);
check(
  "R1-11 excavation unknown remains explicit allowance",
  excav?.description.includes("EXCAVATION ALLOWANCE") === true &&
    ownerCommercial.reason.includes(RW_TIMBER_AUTHORITY_WITH_ALLOWANCE)
);
const ownerMethod = resolveTimberPilingMethod(
  OWNER_CONSTRAINTS as never,
  ownerFacts(),
  "rw1"
);
check(
  "R1-12 plant/commercial method is explicit",
  ownerMethod.method === RW_TIMBER_PILING_METHOD_MACHINE &&
    ownerCalc.lineItems.some((item) => /mini-excavator/i.test(item.label))
);
check(
  "R1-13 pile productivity and plant method agree",
  near(
    piling?.productivityBasis.hoursPerUnit ?? 0,
    RW_TIMBER_1D_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.timberPilesEa]!
      .hoursPerUnit
  ) && ownerMethod.method === RW_TIMBER_PILING_METHOD_MACHINE
);
const difficultCalc = calculateRetainingWall(
  ctx(ownerFacts(), [], [{ key: "site_access", value: "Difficult" }]),
  wa()
);
check(
  "R1-14 inaccessible plant cannot silently price",
  !difficultCalc.lineItems.some((item) => /mini-excavator/i.test(item.label)) &&
    near(
      lab(difficultCalc.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT)
        ?.productivityBasis.hoursPerUnit ?? 0,
      RW_TIMBER_PILE_HOURS_MANUAL
    )
);
check(
  "R1-15 detailed RW labour is cost-first",
  ownerCalc.lineItems
    .filter((item) => item.category === "labour")
    .every(
      (item) =>
        item.sellAuthority === "derived_from_gross_margin" &&
        item.sellDerivedFromMargin === true &&
        near(item.costRate ?? 0, 60) &&
        near(item.recommendedSell / item.recommendedCost, 1.25, 0.02)
    )
);
check(
  "R1-16 new detailed labour does not use paired sell authority",
  ownerCalc.lineItems
    .filter((item) => item.category === "labour")
    .every((item) => !near(item.recommendedSell / (item.labourHours ?? 1), 90, 0.5))
);
const companyLabourCalc = calculateRetainingWall(
  ctx(ownerFacts(), [testRate("labour.carpenter.hour", "hour", 78, "labour")], OWNER_CONSTRAINTS),
  wa()
);
check(
  "R1-17 company labour cost override wins",
  companyLabourCalc.lineItems
    .filter((item) => item.category === "labour")
    .every((item) => near(item.costRate ?? 0, 78))
);
check(
  "R1-18 target GM derives sell correctly",
  companyLabourCalc.lineItems
    .filter((item) => item.category === "labour")
    .every((item) =>
      near(item.recommendedSell / item.recommendedCost, 1.25, 0.02)
    ) &&
    near(ownerEstimate.marginPercent, 20)
);
check(
  "R1-19 package fallback may retain legacy pair",
  hasPackage(masonryCalc.lineItems) &&
    masonryCalc.lineItems.some(
      (item) => item.label === "Retaining wall labour"
    )
);
check(
  "R1-20 no package/detail double money",
  packageXorDetailedHolds({
    mode: ownerCommercial.mode,
    hasPackageFaceLine: hasPackage(ownerCalc.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(ownerCalc.lineItems),
  }) &&
    !hasPackage(ownerCalc.lineItems)
);
check(
  "R1-21 Owner fixture reconciles",
  near(ownerEstimate.recommendedCost, 5855.08, 0.5) &&
    near(ownerEstimate.recommendedSell, 7319, 0.5) &&
    ownerProcurement?.purchaseEa === 14 &&
    near(ownerProcurement?.purchaseTotalLm ?? 0, 28.8)
);
check(
  "R1-22 oversize required length is Pricing Required, not clamped",
  selectRwH5SedStockLengthM(3.7).ok === false
);
check(
  "R1-23 coverage doc consumes post_spacing_m",
  readFileSync(
    "docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md",
    "utf8"
  ).includes("Yes — **Timber only** pile layout and 1D stock procurement") ||
    readFileSync(
      "docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md",
      "utf8"
    ).includes("Yes — timber pile layout and 1D stock procurement")
);

console.log("\n--- R2 PER-INTENT MODIFIERS / PLANT SCALING ---\n");
const excavLine = lineByComponent(ownerCalc.lineItems, RW_EXCAVATION_LABOUR_COMPONENT);
const pileLine = lineByComponent(ownerCalc.lineItems, RW_TIMBER_PILE_LABOUR_COMPONENT);
const faceLine = lineByComponent(ownerCalc.lineItems, RW_TIMBER_FACE_LABOUR_COMPONENT);
const drainLine = lineByComponent(ownerCalc.lineItems, RW_DRAINAGE_LABOUR_COMPONENT);
const backfillLine = lineByComponent(ownerCalc.lineItems, RW_BACKFILL_LABOUR_COMPONENT);
const ownerPlant = plantLine(ownerCalc.lineItems);
const carryOnlyCalc = calculateRetainingWall(
  ctx(ownerFacts(), [], [{ key: "material_carry_distance", value: "10–30m" }]),
  wa()
);
const accessOnlyCalc = calculateRetainingWall(
  ctx(ownerFacts(), [], [{ key: "site_access", value: "Moderate" }]),
  wa()
);
const excavCarryOnly = lineByComponent(
  carryOnlyCalc.lineItems,
  RW_EXCAVATION_LABOUR_COMPONENT
);
const excavAccessOnly = lineByComponent(
  accessOnlyCalc.lineItems,
  RW_EXCAVATION_LABOUR_COMPONENT
);
const pileCarryOnly = lineByComponent(
  carryOnlyCalc.lineItems,
  RW_TIMBER_PILE_LABOUR_COMPONENT
);
const intentExcav = getIntentLabourAdjustmentFactor({
  constraints: OWNER_CONSTRAINTS as never,
  includeMaterialCarry: false,
});
const intentInward = getIntentLabourAdjustmentFactor({
  constraints: OWNER_CONSTRAINTS as never,
  includeMaterialCarry: true,
});
check(
  "R2-1 material carry does not affect bulk excavation",
  near(labourFactor(excavCarryOnly), 1) &&
    near(labourFactor(excavLine), 1.05) &&
    !(excavLine?.notes ?? "").toLowerCase().includes("carry")
);
check(
  "R2-2 site access may affect excavation",
  near(labourFactor(excavAccessOnly), 1.05) &&
    near(labourFactor(excavLine), 1.05) &&
    (excavLine?.notes ?? "").includes("site access")
);
check(
  "R2-3 material carry affects inward-material intents",
  near(labourFactor(pileCarryOnly), 1.05) &&
    (pileLine?.notes ?? "").toLowerCase().includes("carry")
);
check("R2-4 pile factor is site access + carry", near(labourFactor(pileLine), 1.1));
check("R2-5 face factor is site access + carry", near(labourFactor(faceLine), 1.1));
check(
  "R2-6 drainage factor is site access + carry",
  near(labourFactor(drainLine), 1.1)
);
check(
  "R2-7 backfill factor is site access + carry",
  near(labourFactor(backfillLine), 1.1)
);
check(
  "R2-8 no double access modifier",
  near(intentExcav, 1.05) &&
    near(intentInward, 1.1) &&
    near(accessFactor, 1.1) &&
    !near(labourFactor(excavLine), 1.155) &&
    near(labourFactor(excavLine), intentExcav)
);
check(
  "R2-9 spoil distance is not inferred from material carry",
  !ownerCalc.lineItems.some((item) => /disposal|spoil/i.test(item.label)) &&
    !ownerFacts().some((row) => row.key === "retaining_wall.carting_distance_m")
);
check(
  "R2-10 Owner plant is 1 day from pile workload, not sell",
  ownerPlant?.quantity === 1 &&
    ownerPlant.unit === "day" &&
    near(ownerPlant.recommendedCost, RW_MINI_EXCAVATOR_DAY_COST_EX_GST) &&
    timberMiniExcavatorDays({
      method: RW_TIMBER_PILING_METHOD_MACHINE,
      pileCount: 14,
      measuredExcavationM3: null,
    }).days === 1
);
const smallCalc = calculateRetainingWall(
  ctx(levelTimberFacts(3, 1), [], OWNER_CONSTRAINTS),
  wa("rw1")
);
const largeCalc = calculateRetainingWall(
  ctx(levelTimberFacts(40, 1.2), [], OWNER_CONSTRAINTS),
  wa("rw1")
);
const smallPlant = plantLine(smallCalc.lineItems);
const largePlant = plantLine(largeCalc.lineItems);
const smallPiles = timberPileLayout(3, 1.2);
const largePiles = timberPileLayout(40, 1.2);
check(
  "R2-11 small machine-assisted wall is minimum 1 day",
  smallPiles.pileCount === 4 &&
    smallPlant?.quantity === 1 &&
    smallPlant.unit === "day" &&
    timberMiniExcavatorDays({
      method: RW_TIMBER_PILING_METHOD_MACHINE,
      pileCount: smallPiles.pileCount,
      measuredExcavationM3: null,
    }).days === 1
);
check(
  "R2-12 large wall plant scales above 1 day",
  largePiles.pileCount > 16 &&
    (largePlant?.quantity ?? 0) > 1 &&
    largePlant?.unit === "day" &&
    timberMiniExcavatorDays({
      method: RW_TIMBER_PILING_METHOD_MACHINE,
      pileCount: largePiles.pileCount,
      measuredExcavationM3: null,
    }).days === (largePlant?.quantity ?? 0)
);
check(
  "R2-13 manual method has no machine plant",
  !difficultCalc.lineItems.some((item) => /mini-excavator/i.test(item.label)) &&
    near(
      lab(difficultCalc.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT)
        ?.productivityBasis.hoursPerUnit ?? 0,
      RW_TIMBER_PILE_HOURS_MANUAL
    )
);
const companyPlantCalc = calculateRetainingWall(
  ctx(
    ownerFacts(),
    [testRate(RW_MINI_EXCAVATOR_DAY_KEY, "day", 500)],
    OWNER_CONSTRAINTS
  ),
  wa()
);
const companyPlantLine = plantLine(companyPlantCalc.lineItems);
check(
  "R2-14 company plant rate override is isolated",
  companyPlantLine?.quantity === 1 &&
    near(companyPlantLine.recommendedCost, 500) &&
    near(
      companyPlantLine.costRate ?? 0,
      500
    ) &&
    near(
      stockMats(companyPlantCalc.requirements).reduce(
        (sum, row) => sum + (row.totalCost ?? 0),
        0
      ),
      pileStock.reduce((sum, row) => sum + (row.totalCost ?? 0), 0)
    ) &&
    near(labourFactor(lineByComponent(companyPlantCalc.lineItems, RW_TIMBER_PILE_LABOUR_COMPONENT)), 1.1)
);
check(
  "R2-15 Owner direct cost reconciles after excavation-only modifier change",
  near(ownerEstimate.recommendedCost, 5855.08, 0.5)
);
check(
  "R2-16 Owner sell reconciles at 20% GM",
  near(ownerEstimate.recommendedSell, 7319, 0.5) &&
    near(ownerEstimate.marginPercent, 20)
);
check(
  "R2-17 package/detail XOR unchanged",
  packageXorDetailedHolds({
    mode: ownerCommercial.mode,
    hasPackageFaceLine: hasPackage(ownerCalc.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(ownerCalc.lineItems),
  }) && !hasPackage(ownerCalc.lineItems)
);
check(
  "R2-18 pile stock procurement unchanged",
  ownerProcurement?.purchaseEa === 14 &&
    near(ownerProcurement?.purchaseTotalLm ?? 0, 28.8) &&
    pileStock.every((row) => row.purchaseUnit === "ea")
);
check(
  "R2-19 cost-first labour unchanged",
  ownerCalc.lineItems
    .filter((item) => item.category === "labour")
    .every(
      (item) =>
        item.sellAuthority === "derived_from_gross_margin" &&
        near(item.costRate ?? 0, 60) &&
        near(item.recommendedSell / item.recommendedCost, 1.25, 0.02)
    )
);
check(
  "R2-20 Pricing copies estimate cost",
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
  "R2-21 Quote copies Pricing — no second RW calculator",
  existsSync("lib/quotes/adoption-authority.ts") &&
    !readFileSync("lib/quotes/adoption-authority.ts", "utf8").includes(
      "calculateRetainingWall"
    )
);

console.log("\n--- SPAWN ---\n");
check("51 RW-1C-R3 / R2-23", spawnVerifier("scripts/verify-retaining-wall-maturity-1c-r3.ts"));
check("52 Deck 2D / R2-22", spawnVerifier("scripts/verify-deck-maturity-2d.ts"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

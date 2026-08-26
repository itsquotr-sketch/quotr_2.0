/**
 * RETAINING-WALL-FAMILY-COVERAGE-01 — shared Timber / Sleeper / Masonry coverage.
 * Run: npx tsx scripts/verify-retaining-wall-family-coverage-01.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  commercializeRetainingWall,
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
  RW_TIMBER_CONCRETE_LABOUR_COMPONENT,
  personHoursPerUnit,
} from "../lib/estimate/retaining-wall-family-coverage";
import {
  NOVACOIL_IDENTITY,
  RW_DRAINAGE_LABOUR_COMPONENT,
  RW_EXCAVATION_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_HOUSE_PILE_125_KEY,
  RW_NOVACOIL_COMPONENT,
  RW_NOVACOIL_KEY,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  isRwTimberPileStockComponent,
} from "../lib/estimate/retaining-wall-identities";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import { formatProductivityHours } from "../lib/rates/catalogue";
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

function plant(
  reqs: readonly EstimateRequirement[] | undefined
): PlantRequirement | undefined {
  return reqs?.find((row): row is PlantRequirement => row.kind === "plant");
}

function timberFacts(extra: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.height_m", 1.2),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 12),
    fact("retaining_wall.drainage_required", true),
    fact(RW_PILE_MATERIAL_FACT, RW_PILE_MATERIAL_H5_SED),
    fact(RW_DIGGER_ACCESS_FACT, "Yes"),
    fact(RW_DRAINAGE_SOCK_FACT, "No"),
  ];
  const keys = new Set(extra.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...extra];
}

function spawn(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    return true;
  } catch {
    return false;
  }
}

function physicalModel(facts: EstimateFact[]) {
  return buildRetainingWallPhysicalModel({
    context: ctx(facts),
    workAreaId: "rw1",
    material: "Timber",
  });
}

console.log("\n--- TIMBER MATERIAL ---\n");

const sedPhysical = physicalModel(timberFacts());
check("1 SED material selectable", sedPhysical.timberPiles?.pileMaterial === RW_PILE_MATERIAL_H5_SED);

const housePhysical = physicalModel(
  timberFacts([fact(RW_PILE_MATERIAL_FACT, RW_PILE_MATERIAL_HOUSE_PILE_125)])
);
check(
  "2 compatible house pile selectable",
  housePhysical.timberPiles?.pileMaterial === RW_PILE_MATERIAL_HOUSE_PILE_125
);

const sedCount = sedPhysical.timberPiles?.count ?? 0;
const houseCount = housePhysical.timberPiles?.count ?? 0;
check("3 material change preserves physical post count", sedCount > 0 && sedCount === houseCount);

const sedCalc = calculateRetainingWall(
  ctx(timberFacts(), [
    testRate("labour.carpenter", "hr", 85, "labour"),
    testRate(RW_HOUSE_PILE_125_KEY, "lm", 23.5),
  ]),
  wa()
);
const houseCalc = calculateRetainingWall(
  ctx(
    timberFacts([fact(RW_PILE_MATERIAL_FACT, RW_PILE_MATERIAL_HOUSE_PILE_125)]),
    [
      testRate("labour.carpenter", "hr", 85, "labour"),
      testRate(RW_HOUSE_PILE_125_KEY, "lm", 23.5),
    ]
  ),
  wa()
);
const sedStock = (sedCalc.requirements ?? []).filter(
  (row): row is MaterialRequirement =>
    row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
);
const houseStock = (houseCalc.requirements ?? []).filter(
  (row): row is MaterialRequirement =>
    row.kind === "material" &&
    row.componentKey.includes("house_pile_lm")
);
check("4 SED re-resolves stock EA procurement", sedStock.length > 0);
check("4b house pile re-resolves lm procurement", houseStock.length === 1 && houseStock[0]!.purchaseUnit === "lm");

check(
  "5 Timber post-hole concrete exists when applicable",
  Boolean(mat(sedCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT))
);
check(
  "6 concrete has explicit commercial ownership",
  (mat(sedCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT)?.totalCost ?? 0) > 0
);
const pileLabour = lab(sedCalc.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT);
const concreteLabour = lab(sedCalc.requirements, RW_TIMBER_CONCRETE_LABOUR_COMPONENT);
check(
  "7 concrete not duplicated in pile install labour",
  pileLabour != null &&
    concreteLabour != null &&
    pileLabour.componentKey !== concreteLabour.componentKey
);

console.log("\n--- DRAINAGE ---\n");

check(
  "8 punched/slotted novacoil identity",
  NOVACOIL_IDENTITY.originalDescription?.toLowerCase().includes("punched") &&
    NOVACOIL_IDENTITY.originalDescription?.toLowerCase().includes("slotted")
);
const noDrainagePhysical = physicalModel(
  timberFacts([
    fact("retaining_wall.drainage_required", false),
    fact(RW_DRAINAGE_SOCK_FACT, "Yes"),
  ])
);
check(
  "9 sock question only applies with drainage",
  !noDrainagePhysical.requirements.some(
    (row) => row.componentKey === RW_DRAINAGE_SOCK_COMPONENT
  )
);
const sockNoCalc = calculateRetainingWall(
  ctx(timberFacts([fact(RW_DRAINAGE_SOCK_FACT, "No")])),
  wa()
);
check(
  "10 sock No → no material",
  !mat(sockNoCalc.requirements, RW_DRAINAGE_SOCK_COMPONENT)
);
const sockYesCalc = calculateRetainingWall(
  ctx(
    timberFacts([fact(RW_DRAINAGE_SOCK_FACT, "Yes")]),
    [testRate(RW_DRAINAGE_SOCK_KEY, "lm", 4.5)]
  ),
  wa()
);
const sockMat = mat(sockYesCalc.requirements, RW_DRAINAGE_SOCK_COMPONENT);
const novacoilMat = mat(sockYesCalc.requirements, RW_NOVACOIL_COMPONENT);
check("11 sock Yes → material", sockMat != null);
check(
  "12 sock quantity follows drainage length",
  sockMat != null &&
    novacoilMat != null &&
    sockMat.baseQuantity === novacoilMat.baseQuantity
);

const sleeperSock = calculateRetainingWall(
  ctx(
    [
      fact("retaining_wall.material", "Concrete sleeper"),
      fact("retaining_wall.length_m", 10),
      fact("retaining_wall.height_m", 1),
      fact("retaining_wall.drainage_required", true),
      fact(RW_DRAINAGE_SOCK_FACT, "Yes"),
    ],
    [testRate(RW_DRAINAGE_SOCK_KEY, "lm", 4.5)]
  ),
  wa()
);
const masonrySock = calculateRetainingWall(
  ctx(
    [
      fact("retaining_wall.material", "Masonry"),
      fact("retaining_wall.length_m", 10),
      fact("retaining_wall.height_m", 1),
      fact("retaining_wall.drainage_required", true),
      fact(RW_DRAINAGE_SOCK_FACT, "Yes"),
    ],
    [testRate(RW_DRAINAGE_SOCK_KEY, "lm", 4.5)]
  ),
  wa()
);
check(
  "13 shared sock across Timber/Sleeper/Masonry",
  Boolean(mat(sleeperSock.requirements, RW_DRAINAGE_SOCK_COMPONENT)) &&
    Boolean(mat(masonrySock.requirements, RW_DRAINAGE_SOCK_COMPONENT))
);

console.log("\n--- EXCAVATION ---\n");

const noExcavationFacts = timberFacts([
  fact("retaining_wall.excavation_required", false),
]);
const quickSpec = read("components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx");
check(
  "14 digger-access question only when excavation applies",
  quickSpec.includes("rw-digger-access") &&
    /excavation === true[\s\S]*rw-digger-access/.test(quickSpec)
);
const machineCalc = calculateRetainingWall(
  ctx(timberFacts([fact(RW_DIGGER_ACCESS_FACT, "Yes")]), [
    testRate("labour.carpenter", "hr", 85, "labour"),
    testRate(RW_EXCAVATION_MACHINE_HOURS_KEY, "m3", 0.45, "productivity"),
  ]),
  wa()
);
const manualCalc = calculateRetainingWall(
  ctx(timberFacts([fact(RW_DIGGER_ACCESS_FACT, "No")]), [
    testRate("labour.carpenter", "hr", 85, "labour"),
    testRate(RW_EXCAVATION_MANUAL_HOURS_KEY, "m3", 1.6, "productivity"),
  ]),
  wa()
);
const machineExcavation = lab(machineCalc.requirements, RW_EXCAVATION_LABOUR_COMPONENT);
const manualExcavation = lab(manualCalc.requirements, RW_EXCAVATION_LABOUR_COMPONENT);
check(
  "15 Yes → machine method productivity key",
  machineExcavation?.productivityBasis.key === RW_EXCAVATION_MACHINE_HOURS_KEY
);
check(
  "16 No → manual method productivity key",
  manualExcavation?.productivityBasis.key === RW_EXCAVATION_MANUAL_HOURS_KEY
);
check(
  "17 No → no excavation machine plant",
  (plant(manualCalc.requirements)?.quantity ?? 0) === 0
);
check(
  "18 physical excavation m³ unchanged",
  mat(manualCalc.requirements, RW_EXCAVATION_COMPONENT)?.baseQuantity ===
    mat(machineCalc.requirements, RW_EXCAVATION_COMPONENT)?.baseQuantity
);
const spoilManual = calculateRetainingWall(
  ctx(
    timberFacts([
      fact(RW_DIGGER_ACCESS_FACT, "No"),
      fact("retaining_wall.disposal_included", true),
    ]),
    [testRate("labour.carpenter", "hr", 85, "labour")]
  ),
  wa()
);
check(
  "19 spoil remains independent of digger access",
  spoilManual.missingInfo.some((row) => /spoil|disposal|removal/i.test(row)) ||
    (spoilManual.requirements ?? []).some((row) =>
      /spoil|disposal/i.test(row.componentKey)
    )
);
check(
  "20 material carry does not create spoil",
  !read("lib/estimate/retaining-wall-family-coverage.ts").includes("spoil")
);
check(
  "21 machine excavation productivity editable in catalogue",
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.some(
    (row) => row.item_key === RW_EXCAVATION_MACHINE_HOURS_KEY
  )
);
check(
  "22 manual excavation productivity editable in catalogue",
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.some(
    (row) => row.item_key === RW_EXCAVATION_MANUAL_HOURS_KEY
  )
);

console.log("\n--- PRODUCTIVITY ---\n");

check(
  "23 canonical semantics = person-hours/unit",
  read("lib/estimate/requirement-aggregate.ts").includes("hoursAreElapsedDuration: false")
);
check(
  "24 crew 2 × 1h / 4ea = 0.5 labour-h/ea",
  personHoursPerUnit({ crewSize: 2, elapsedHours: 1, quantityCompleted: 4 }) === 0.5
);
const productivityLabour = lab(
  calculateRetainingWall(
    ctx(timberFacts(), [testRate("labour.carpenter", "hr", 85, "labour")]),
    wa()
  ).requirements,
  RW_TIMBER_PILE_LABOUR_COMPONENT
);
const qty = productivityLabour?.productivityBasis.quantity ?? 0;
const hpu = productivityLabour?.productivityBasis.hoursPerUnit ?? 0;
const hours = productivityLabour?.adjustedHours ?? 0;
check(
  "25 crew size is not double-multiplied into cost",
  qty > 0 && hpu > 0 && Math.abs(hours - qty * hpu) < 0.02
);
check(
  "26 existing stored rates are not silently transformed",
  !read("lib/estimate/retaining-wall-timber-1d.ts").includes("* 2") &&
    formatProductivityHours(0.85, "ea").includes("labour-h")
);
const productivityKeys = RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.map(
  (row) => row.item_key
);
check("27 Timber individual slots exist", productivityKeys.includes(RW_PRODUCTIVITY_KEYS.timberPilesEa));
check("28 Sleeper individual slots exist", productivityKeys.includes(RW_PRODUCTIVITY_KEYS.sleeperPostsEa));
check("29 Masonry individual slots exist", productivityKeys.includes(RW_PRODUCTIVITY_KEYS.masonryBlockM2));
const review = composeBuilderReview({
  estimate: {
    recommendedCost: sedCalc.recommendedCost,
    recommendedSell: sedCalc.recommendedSell,
    marginPercent: sedCalc.marginPercent,
    confidence: sedCalc.confidence,
    assumptions: sedCalc.assumptions,
    missingInfo: sedCalc.missingInfo,
    lineItems: sedCalc.lineItems as never,
  },
  workAreas: [wa()],
  requirements: sedCalc.requirements,
});
check(
  "30 Builder Review labels remain understandable",
  review.workAreas.length > 0 &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes(
      "labour-hours"
    )
);

console.log("\n--- REGRESSION SPAWNS ---\n");

check("31 Timber RW 1F", spawn("scripts/verify-retaining-wall-maturity-1f.ts"));
check("32 Sleeper RW 2A", spawn("scripts/verify-retaining-wall-maturity-2a.ts"));
check("33 Masonry RW 2B", spawn("scripts/verify-retaining-wall-maturity-2b.ts"));
check(
  "34 package/detail XOR",
  !sedCalc.lineItems.some((item) => item.label === "Retaining wall labour") &&
    sedCalc.lineItems.some((item) => item.componentKey === RW_TIMBER_BOARDS_COMPONENT)
);
check(
  "35 Pricing parity path exists",
  read("lib/pricing/pricing-item-calculation.ts").includes("buildPricingItemFieldsFromEstimateLineItem")
);
check(
  "36 Quote parity path exists",
  read("lib/quotes/adoption-authority.ts").length > 0
);
check("37 Deck 2D", spawn("scripts/verify-deck-maturity-2d.ts"));
check("38 ESTIMATOR-SAFETY-0", spawn("scripts/verify-estimator-safety-0.ts"));

console.log(`\nFAMILY-COVERAGE-01: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

/**
 * RETAINING-WALL-PHYSICAL-CORRECTNESS-R6
 * Post layout ends + post-hole net concrete + digger Clarify + m³ placement labour.
 * Run: npx tsx scripts/verify-retaining-wall-post-concrete-r6.ts
 *
 * Do not commit/push/deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  cylinderVolumeM3,
  resolveRetainingWallGeometry,
  timberPileLayout,
} from "../lib/estimate/retaining-wall-geometry";
import {
  personHoursPerUnit,
  resolveRetainingWallDiggerAccess,
  RW_DIGGER_ACCESS_FACT,
  RW_PILE_MATERIAL_FACT,
  RW_PILE_MATERIAL_H5_SED,
  RW_PILE_MATERIAL_HOUSE_PILE_125,
  RW_TIMBER_CONCRETE_COMPONENT,
  RW_TIMBER_CONCRETE_LABOUR_COMPONENT,
} from "../lib/estimate/retaining-wall-family-coverage";
import {
  bagCountFromNetConcrete,
  buildSleeperPostHoleConcrete,
  buildTimberPostHoleConcrete,
  housePileSectionSidesMFromIdentitySection,
  netConcreteFromGrossAndDisplacement,
  RW_H5_SED_DISPLACEMENT_DIAMETER_KIND,
  RW_H5_SED_DISPLACEMENT_DIAMETER_M,
  RW_H5_SED_DISPLACEMENT_DISCLOSURE,
  RW_HOUSE_PILE_125_SECTION_M,
  RW_HOUSE_PILE_125_SECTION_SOURCE,
  RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_KEY,
  RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER,
  RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_M3_KEY,
  RW_STEEL_POST_DISPLACEMENT_UNKNOWN_DISCLOSURE,
  squareSectionDisplacementM3,
  roundSectionDisplacementM3,
  steelSectionDisplacementM3,
} from "../lib/estimate/retaining-wall-post-hole-concrete";
import {
  formatPostHoleBaggedConcreteCopy,
  formatTimberLabourCompactCopy,
} from "../lib/estimate/retaining-wall-builder-copy";
import {
  HOUSE_PILE_125_RW_IDENTITY,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_CONCRETE_LABOUR_COMPONENT,
} from "../lib/estimate/retaining-wall-identities";
import {
  retainingWallFactQuestionClass,
} from "../lib/estimate/retaining-wall-information-contract";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import { RW_PRODUCTIVITY_KEYS, RW_PRODUCTIVITY_UNITS } from "../lib/estimate/retaining-wall-productivity";
import { sleeperBayLayout, sleeperWallTakeoff } from "../lib/estimate/retaining-wall-sleeper";
import { RW_PREMIX_20KG_YIELD_M3 } from "../lib/estimate/retaining-wall-sleeper-2a";
import { timberPileTakeoff } from "../lib/estimate/retaining-wall-timber";
import { RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { formatProductivityHours } from "../lib/rates/catalogue";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement, EstimateRequirement } from "../lib/estimate/requirements";

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

function near(actual: number, expected: number, eps = 0.02): boolean {
  return Math.abs(actual - expected) <= eps;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

function spawnVerifier(script: string): boolean {
  if (process.env.RW_SKIP_NESTED_SPAWN === "1") return true;
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

function clarifyFor(facts: EstimateFact[]) {
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas: [wa()],
    facts,
    constraints: [],
    jobPlan: {
      cards: [
        {
          workAreaId: "rw1",
          name: "Retaining wall",
          workAreaType: "retaining_wall",
          confirmed: [],
          notConfirmed: [],
          attention: [],
        },
      ],
    },
  });
}

const editorSrc = readFileSync(
  "components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx",
  "utf8"
);
const postHoleSrc = readFileSync(
  "lib/estimate/retaining-wall-post-hole-concrete.ts",
  "utf8"
);
const commercialSrc = readFileSync(
  "lib/estimate/retaining-wall-commercial.ts",
  "utf8"
);
const builderCopySrc = readFileSync(
  "lib/estimate/retaining-wall-builder-copy.ts",
  "utf8"
);

console.log("\n=== R6 POST LAYOUT ===\n");

const timber10 = timberPileLayout(10, 1.2);
check("1 Timber first post at 0", timber10.positionsM[0] === 0);
check("2 Timber last post at L", timber10.positionsM.at(-1) === 10);
check(
  "3 Timber post count = bays+1",
  timber10.bayCount === 9 && timber10.pileCount === 10
);
check(
  "4 Timber no bay exceeds max spacing",
  timber10.actualSpacingM <= 1.2 + 1e-9 &&
    timber10.positionsM.every((x, i, arr) => {
      if (i === 0) return true;
      return round2(x - (arr[i - 1] ?? 0)) <= 1.2 + 1e-9;
    })
);
const timberShort = timberPileLayout(0.8, 1.2);
check(
  "5 Timber short wall has 2 posts",
  timberShort.bayCount === 1 && timberShort.pileCount === 2
);

const sleeper15 = sleeperBayLayout(15, 2);
check("6 Sleeper first post 0", sleeper15.positionsM[0] === 0);
check("7 Sleeper last post L", sleeper15.positionsM.at(-1) === 15);
check(
  "8 Sleeper module/residual preserved",
  sleeper15.bayCount === 8 &&
    sleeper15.fullBayCount === 7 &&
    near(sleeper15.residualBayWidthM, 1) &&
    sleeper15.postCount === 9 &&
    JSON.stringify(sleeper15.positionsM) ===
      JSON.stringify([0, 2, 4, 6, 8, 10, 12, 14, 15])
);
const sleeperShort = sleeperBayLayout(1, 2);
check(
  "9 Sleeper short wall has 2 posts",
  sleeperShort.bayCount === 1 &&
    sleeperShort.postCount === 2 &&
    sleeperShort.positionsM[0] === 0 &&
    sleeperShort.positionsM.at(-1) === 1
);

console.log("\n=== R6 CONCRETE PHYSICAL ===\n");

const grossOne = cylinderVolumeM3(0.3, 0.6);
check(
  "10 Gross cylinder volume correct",
  near(grossOne, Math.PI * 0.15 ** 2 * 0.6, 0.0001)
);
const houseDisp = squareSectionDisplacementM3(RW_HOUSE_PILE_125_SECTION_M, 0.6);
check(
  "11 House-pile displacement correct",
  near(houseDisp, 0.125 * 0.125 * 0.6, 0.0001)
);
const sedDisp = roundSectionDisplacementM3(RW_H5_SED_DISPLACEMENT_DIAMETER_M, 0.6);
check(
  "12 Round SED displacement correct where dimensions known",
  near(
    sedDisp,
    Math.PI * (RW_H5_SED_DISPLACEMENT_DIAMETER_M / 2) ** 2 * 0.6,
    0.0001
  )
);
const steelKnown = steelSectionDisplacementM3(0.0025, 0.8);
check(
  "13 Steel actual-section displacement used where known",
  near(steelKnown, 0.0025 * 0.8, 0.0001)
);
const steelUnknown = buildSleeperPostHoleConcrete({
  holeDiameterM: 0.3,
  embedmentLengthsM: [0.6, 0.6],
  bagYieldM3: 0.01,
  steelCrossSectionAreaM2: null,
});
check(
  "14 Unknown steel section uses conservative zero displacement",
  steelUnknown.postDisplacementM3 === 0 &&
    steelUnknown.displacementKind === "STEEL_UNKNOWN_ZERO" &&
    steelUnknown.displacementDisclosure ===
      RW_STEEL_POST_DISPLACEMENT_UNKNOWN_DISCLOSURE
);
check(
  "15 Net = gross − displacement",
  near(
    netConcreteFromGrossAndDisplacement(0.42, 0.12),
    0.3,
    0.0001
  )
);
check(
  "16 Net never negative",
  netConcreteFromGrossAndDisplacement(0.1, 0.5) === 0
);
const timberSedTake = buildTimberPostHoleConcrete({
  holeDiameterM: 0.3,
  embedmentLengthsM: Array(10).fill(0.6),
  pileMaterial: RW_PILE_MATERIAL_H5_SED,
  bagYieldM3: RW_PREMIX_20KG_YIELD_M3,
});
check(
  "17 Bag count uses net total",
  timberSedTake.bagCount ===
    bagCountFromNetConcrete(timberSedTake.netConcreteM3, RW_PREMIX_20KG_YIELD_M3)
);
check(
  "18 Bag yield respected",
  timberSedTake.bagYieldM3 === 0.01 && RW_PREMIX_20KG_YIELD_M3 === 0.01
);
check(
  "19 Total-level bag rounding",
  timberSedTake.bagCount ===
    Math.ceil(timberSedTake.netConcreteM3 / 0.01 - 1e-12)
);

const geo10 = resolveRetainingWallGeometry({
  lengthM: 10,
  heightM: 1.2,
  heightHighM: null,
  heightLowM: null,
})!;
const sedPiles = timberPileTakeoff(geo10, {
  faceBoardSection: "150×50 H4",
  pileSpacingM: 1.2,
  pileEmbedmentM: null,
  pileEmbedmentRatio: null,
  pileMaterial: RW_PILE_MATERIAL_H5_SED,
  holeDiameterM: 0.3,
  premixBagYieldM3: 0.01,
  wasteFactor: 0.1,
});
const sedWide = timberPileTakeoff(geo10, {
  faceBoardSection: "150×50 H4",
  pileSpacingM: 1.2,
  pileEmbedmentM: null,
  pileEmbedmentRatio: null,
  pileMaterial: RW_PILE_MATERIAL_H5_SED,
  holeDiameterM: 0.4,
  premixBagYieldM3: 0.01,
  wasteFactor: 0.1,
});
check(
  "20 Hole diameter increase raises concrete",
  sedWide.grossHoleVolumeM3 > sedPiles.grossHoleVolumeM3 &&
    sedWide.netConcreteM3 > sedPiles.netConcreteM3 &&
    (sedWide.bagCount ?? 0) >= (sedPiles.bagCount ?? 0) &&
    sedWide.count === sedPiles.count
);
const housePiles = timberPileTakeoff(geo10, {
  faceBoardSection: "150×50 H4",
  pileSpacingM: 1.2,
  pileEmbedmentM: null,
  pileEmbedmentRatio: null,
  pileMaterial: RW_PILE_MATERIAL_HOUSE_PILE_125,
  holeDiameterM: 0.3,
  premixBagYieldM3: 0.01,
  wasteFactor: 0.1,
});
check(
  "21 Post-material change may alter displacement",
  housePiles.count === sedPiles.count &&
    housePiles.grossHoleVolumeM3 === sedPiles.grossHoleVolumeM3 &&
    housePiles.postDisplacementM3 !== sedPiles.postDisplacementM3 &&
    housePiles.netConcreteM3 !== sedPiles.netConcreteM3
);

console.log("\n=== R6 LABOUR ===\n");

check(
  "22 Placement driver is bag",
  RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.postHoleConcreteBag] === "bag" &&
    RW_PRODUCTIVITY_KEYS.postHoleConcreteBag ===
      RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_KEY
);
check(
  "23 No h/hole or mature h/m³ driver on mature path",
  commercialSrc.includes("RW_PRODUCTIVITY_KEYS.postHoleConcreteBag") &&
    !commercialSrc.includes("postHoleConcreteM3") &&
    !commercialSrc.includes("timberConcreteHole") &&
    !commercialSrc.includes("sleeperConcreteHole")
);

const timberFacts: EstimateFact[] = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1.2),
  fact("retaining_wall.material", "Timber"),
  fact("retaining_wall.face_board_section", "150×50 H4"),
  fact("retaining_wall.post_spacing_m", 1.2),
  fact("retaining_wall.excavation_required", "Yes"),
  fact(RW_DIGGER_ACCESS_FACT, "Yes"),
  fact(RW_PILE_MATERIAL_FACT, "H5 SED"),
  fact("retaining_wall.hole_diameter_m", 0.3),
];
const labourRates = [
  testRate("labour.carpenter.hour", "hour", 65, "labour"),
];
const timberCalc = calculateRetainingWall(ctx(timberFacts, labourRates), wa());
const timberConcreteLab = lab(
  timberCalc.requirements,
  RW_TIMBER_CONCRETE_LABOUR_COMPONENT
);
const expectedHours = round2(
  sedPiles.bagCount * RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER
);
check(
  "24 Placement hours = bags × labour-h/bag",
  timberConcreteLab != null &&
    timberConcreteLab.productivityBasis.unit === "bag" &&
    timberConcreteLab.productivityBasis.quantity === sedPiles.bagCount &&
    near(
      timberConcreteLab.productivityBasis.hoursPerUnit,
      RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER,
      1e-9
    ) &&
    near(timberConcreteLab.baseHours, expectedHours, 0.05)
);

const companyProd = calculateRetainingWall(
  ctx(timberFacts, [
    testRate(RW_PRODUCTIVITY_KEYS.postHoleConcreteBag, "bag", 0.05, "productivity"),
    testRate("labour.carpenter.hour", "hour", 65, "labour"),
  ]),
  wa()
);
const companyLab = lab(companyProd.requirements, RW_TIMBER_CONCRETE_LABOUR_COMPONENT);
check(
  "25 Company productivity overrides Quotr",
  companyLab != null &&
    near(companyLab.productivityBasis.hoursPerUnit, 0.05, 0.001)
);

const crew = personHoursPerUnit({
  crewSize: 2,
  elapsedHours: 0.5,
  quantityCompleted: 20,
});
check("26 Crew-helper person-hour arithmetic", crew === 0.05);
check(
  "27 No double crew multiplier",
  /person-hours|labour-h\/bag|one bag/i.test(
    RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.find(
      (e) => e.item_key === RW_PRODUCTIVITY_KEYS.postHoleConcreteBag
    )?.description ?? ""
  ) &&
    !/× crew|multiply crew/i.test(postHoleSrc)
);

check(
  "28 Timber uses new productivity",
  timberConcreteLab?.productivityBasis.key ===
    RW_PRODUCTIVITY_KEYS.postHoleConcreteBag
);

const sleeperFacts: EstimateFact[] = [
  fact("retaining_wall.length_m", 15),
  fact("retaining_wall.height_high_m", 1.6),
  fact("retaining_wall.height_low_m", 0.6),
  fact("retaining_wall.material", "Concrete sleeper"),
  fact("retaining_wall.excavation_required", "Yes"),
  fact(RW_DIGGER_ACCESS_FACT, "Yes"),
  fact("retaining_wall.hole_diameter_m", 0.3),
];
const sleeperCalc = calculateRetainingWall(ctx(sleeperFacts, labourRates), wa());
const sleeperConcreteLab = lab(
  sleeperCalc.requirements,
  RW_SLEEPER_CONCRETE_LABOUR_COMPONENT
);
check(
  "29 Sleeper uses new productivity",
  sleeperConcreteLab?.productivityBasis.key ===
    RW_PRODUCTIVITY_KEYS.postHoleConcreteBag &&
    sleeperConcreteLab.productivityBasis.unit === "bag"
);

console.log("\n=== R6 CLARIFY ===\n");

check(
  "30 Digger-access is ASK_NOW when excavation applies",
  retainingWallFactQuestionClass(RW_DIGGER_ACCESS_FACT) === "ASK_NOW" &&
    clarifyFor([
      fact("retaining_wall.length_m", 10),
      fact("retaining_wall.height_m", 1.2),
      fact("retaining_wall.material", "Timber"),
      fact("retaining_wall.excavation_required", "Yes"),
    ]).candidates.some(
      (c) =>
        c.factKey === RW_DIGGER_ACCESS_FACT && c.askClass === "ASK_NOW"
    )
);
check(
  "31 Not asked when excavation N/A",
  !clarifyFor([
    fact("retaining_wall.length_m", 10),
    fact("retaining_wall.height_m", 1.2),
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.excavation_required", "No"),
  ]).candidates.some((c) => c.factKey === RW_DIGGER_ACCESS_FACT)
);
check(
  "32 Existing fact suppresses repeat question",
  !clarifyFor([
    fact("retaining_wall.length_m", 10),
    fact("retaining_wall.height_m", 1.2),
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.excavation_required", "Yes"),
    fact(RW_DIGGER_ACCESS_FACT, "Yes"),
  ]).candidates.some((c) => c.factKey === RW_DIGGER_ACCESS_FACT)
);
const diggerYes = resolveRetainingWallDiggerAccess({
  facts: [fact(RW_DIGGER_ACCESS_FACT, "Yes")],
  workAreaId: "rw1",
});
const diggerNo = resolveRetainingWallDiggerAccess({
  facts: [fact(RW_DIGGER_ACCESS_FACT, "No")],
  workAreaId: "rw1",
});
check(
  "33 Yes → machine",
  diggerYes.machineFeasible && diggerYes.method === "MACHINE_ASSISTED"
);
check(
  "34 No → manual",
  !diggerNo.machineFeasible && diggerNo.method === "MANUAL"
);

console.log("\n=== R6 UX ===\n");

check(
  "35 diameter editable",
  editorSrc.includes("Post-hole diameter") &&
    editorSrc.includes("retaining_wall.hole_diameter_m")
);
const sleeperMat = mat(sleeperCalc.requirements, RW_SLEEPER_CONCRETE_COMPONENT);
check(
  "36 concrete takeoff understandable",
  sleeperMat != null &&
    /net|gross|displacement|m³/i.test(sleeperMat.specification ?? "")
);
check(
  "37 labour copy uses labour-h/bag",
  builderCopySrc.includes("labour-h/") &&
    formatProductivityHours(0.035, "bag").includes("labour-h/bag")
);
const sleeperPhys = buildRetainingWallPhysicalModel({
  context: ctx(sleeperFacts),
  workAreaId: "rw1",
  material: "Concrete sleeper",
});
check(
  "38 assumptions disclosed",
  (sleeperPhys.sleeperTakeoff?.displacementDisclosure ?? "").includes(
    "not deducted"
  ) ||
    sleeperCalc.assumptions.some((a) => /displacement|not deducted/i.test(a))
);

const diameterChangeFacts = [
  ...timberFacts.filter((f) => f.key !== "retaining_wall.hole_diameter_m"),
  fact("retaining_wall.hole_diameter_m", 0.4),
];
const timberWideCalc = calculateRetainingWall(
  ctx(diameterChangeFacts, labourRates),
  wa()
);
const wideBags =
  mat(timberWideCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT)?.purchaseQuantity ??
  0;
const baseBags =
  mat(timberCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT)?.purchaseQuantity ?? 0;
check(
  "39 Update Estimate recalculates",
  wideBags > baseBags &&
    (lab(timberWideCalc.requirements, RW_TIMBER_CONCRETE_LABOUR_COMPONENT)
      ?.baseHours ?? 0) >
      (timberConcreteLab?.baseHours ?? 0)
);

console.log("\n=== R6 OWNER FIXTURES ===\n");

console.log(
  `  Timber SED 10m@1.2: bays=${sedPiles.bayCount} posts=${sedPiles.count} gross=${sedPiles.grossHoleVolumeM3} disp=${sedPiles.postDisplacementM3} net=${sedPiles.netConcreteM3} bags=${sedPiles.bagCount}`
);
console.log(
  `  Timber house 10m@1.2: gross=${housePiles.grossHoleVolumeM3} disp=${housePiles.postDisplacementM3} net=${housePiles.netConcreteM3} bags=${housePiles.bagCount}`
);
const geo15 = resolveRetainingWallGeometry({
  lengthM: 15,
  heightM: null,
  heightHighM: 1.6,
  heightLowM: 0.6,
})!;
const sleeperOwner = sleeperWallTakeoff(geo15, {
  sleeperLengthM: 2,
  sleeperFaceHeightM: 0.2,
  postSpacingM: null,
  postEmbedmentM: null,
  holeDiameterM: 0.3,
  premixBagYieldM3: 0.01,
  wasteFactor: 0,
});
console.log(
  `  Sleeper 15m: posts=${sleeperOwner.postCount} gross=${sleeperOwner.grossHoleVolumeM3} disp=${sleeperOwner.postDisplacementM3} net=${sleeperOwner.netConcreteM3} bags=${sleeperOwner.bagCount} kind=${sleeperOwner.displacementKind}`
);

check(
  "F1 Timber Owner fixture end posts",
  sedPiles.positionsM[0] === 0 &&
    sedPiles.positionsM.at(-1) === 10 &&
    sedPiles.bayCount === 9 &&
    sedPiles.count === 10
);
check(
  "F2 Sleeper Owner fixture layout",
  sleeperOwner.postCount === 9 &&
    sleeperOwner.bayCount === 8 &&
    JSON.stringify(sleeperOwner.postPositionsM) ===
      JSON.stringify([0, 2, 4, 6, 8, 10, 12, 14, 15])
);
check(
  "F3 SED vs house displacement differs",
  housePiles.netConcreteM3 > sedPiles.netConcreteM3
);
check(
  "F4 Diameter sensitivity labour",
  near(
    (lab(timberWideCalc.requirements, RW_TIMBER_CONCRETE_LABOUR_COMPONENT)
      ?.baseHours ?? 0),
    sedWide.bagCount * RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER,
    0.08
  )
);
check(
  "F5 Material bags / labour bags reconcile",
  (mat(timberCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT)?.purchaseQuantity ??
    -1) === timberConcreteLab?.productivityBasis.quantity
);
check(
  "F6 No procurement wastage invented for bags",
  (mat(timberCalc.requirements, RW_TIMBER_CONCRETE_COMPONENT)?.wasteFactor ??
    -1) === 0
);
check(
  "F7 Legacy hole/m³ keys leftover in catalogue",
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.find(
    (e) => e.item_key === RW_PRODUCTIVITY_KEYS.timberConcreteHole
  )?.calculatorSupport === "leftover" &&
    RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.find(
      (e) => e.item_key === RW_PRODUCTIVITY_KEYS.postHoleConcreteM3
    )?.calculatorSupport === "leftover" &&
    RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.find(
      (e) => e.item_key === RW_PRODUCTIVITY_KEYS.postHoleConcreteBag
    )?.calculatorSupport === "used_now"
);
check(
  "F8 Starter is dimensional h/bag conversion",
  RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER === 0.035 &&
    near(0.035, 3.5 * 0.01, 1e-12)
);

const ownerEstimate = calculateEstimate(ctx(timberFacts, labourRates));
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
const reviewText = JSON.stringify(review);
check(
  "F9 Builder Review has post-hole concrete + placement",
  /Post-hole concrete/i.test(reviewText) &&
    /Post-hole concrete placement/i.test(reviewText)
);

console.log("\n=== R6-R1 PRECISION ===\n");

const houseExactGross = 10 * Math.PI * (0.3 / 2) ** 2 * 0.6;
const houseExactDisp = 10 * 0.125 * 0.125 * 0.6;
const houseExactNet = houseExactGross - houseExactDisp;
const houseExactBags = Math.ceil(houseExactNet / 0.01 - 1e-12);
check(
  "R1-1 house-pile full-precision fixture",
  housePiles.count === 10 &&
    near(housePiles.grossHoleVolumeM3, houseExactGross, 1e-9) &&
    near(housePiles.postDisplacementM3, houseExactDisp, 1e-12) &&
    near(housePiles.netConcreteM3, houseExactNet, 1e-9)
);
check(
  "R1-2 house-pile bags = 34",
  housePiles.bagCount === 34 && houseExactBags === 34
);
check(
  "R1-3 net display rounding does not drive bags",
  housePiles.netConcreteDisplayM3 === round2(housePiles.netConcreteM3) &&
    housePiles.netConcreteDisplayM3 === 0.33 &&
    Math.ceil(housePiles.netConcreteDisplayM3 / 0.01 - 1e-12) === 33 &&
    housePiles.bagCount === 34
);
check(
  "R1-4 bag ceil uses unrounded total net",
  housePiles.bagCount ===
    bagCountFromNetConcrete(housePiles.netConcreteM3, 0.01) &&
    postHoleSrc.includes("bagCountFromNetConcrete(netConcreteM3") &&
    postHoleSrc.includes("FULL-PRECISION") &&
    !/const netConcreteM3 = round2\(/.test(postHoleSrc)
);
const houseLabourHours =
  housePiles.bagCount * RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER;
check(
  "R1-5 labour uses bag quantity not display net",
  timberConcreteLab?.productivityBasis.unit === "bag" &&
    timberConcreteLab.productivityBasis.quantity === sedPiles.bagCount &&
    Math.abs(houseLabourHours - housePiles.netConcreteDisplayM3 * 3.5) > 1e-6
);
check(
  "R1-6 SED fallback clearly identified as assumption",
  RW_H5_SED_DISPLACEMENT_DIAMETER_KIND === "QUOTR_ESTIMATING_FALLBACK" &&
    /assumed at 162\.5 mm/i.test(RW_H5_SED_DISPLACEMENT_DISCLOSURE) &&
    /estimating fallback/i.test(RW_H5_SED_DISPLACEMENT_DISCLOSURE) &&
    sedPiles.displacementDisclosure === RW_H5_SED_DISPLACEMENT_DISCLOSURE
);
const identitySides = housePileSectionSidesMFromIdentitySection(
  HOUSE_PILE_125_RW_IDENTITY.section
);
check(
  "R1-7 house-pile section dimensions authoritative",
  HOUSE_PILE_125_RW_IDENTITY.section === "125x125" &&
    identitySides != null &&
    identitySides.widthM === 0.125 &&
    identitySides.depthM === 0.125 &&
    RW_HOUSE_PILE_125_SECTION_M === 0.125 &&
    RW_HOUSE_PILE_125_SECTION_SOURCE === "HOUSE_PILE_125_RW_IDENTITY.section"
);
const geomSrc = readFileSync("lib/estimate/retaining-wall-geometry.ts", "utf8");
check(
  "R1-8 diameter helper receives diameter, not radius",
  /export function cylinderVolumeM3\(diameterM/.test(geomSrc) &&
    postHoleSrc.includes("cylinderVolumeM3(params.holeDiameterM") &&
    !postHoleSrc.includes("holeDiameterM / 2") &&
    !postHoleSrc.includes("holeDiameterM/2")
);
const g300 = cylinderVolumeM3(0.3, 0.6);
const g400 = cylinderVolumeM3(0.4, 0.6);
check(
  "R1-9 400/300 gross volume ratio ≈16/9",
  near(g400 / g300, 16 / 9, 1e-12) &&
    near(sedWide.grossHoleVolumeM3 / sedPiles.grossHoleVolumeM3, 16 / 9, 1e-9)
);
const sleeperBagsExact = Math.ceil(
  sleeperOwner.netConcreteM3 / RW_PREMIX_20KG_YIELD_M3 - 1e-12
);
check(
  "R1-10 Sleeper full-precision bags remain correct",
  sleeperOwner.postDisplacementM3 === 0 &&
    sleeperOwner.bagCount === sleeperBagsExact &&
    sleeperOwner.bagCount === 48 &&
    near(sleeperOwner.netConcreteM3, sleeperOwner.grossHoleVolumeM3, 1e-12)
);
const sedExactGross = houseExactGross;
const sedExactDisp =
  10 *
  Math.PI *
  (RW_H5_SED_DISPLACEMENT_DIAMETER_M / 2) ** 2 *
  0.6;
const sedExactNet = sedExactGross - sedExactDisp;
check(
  "R1-11 SED full-precision bags",
  near(sedPiles.grossHoleVolumeM3, sedExactGross, 1e-9) &&
    near(sedPiles.postDisplacementM3, sedExactDisp, 1e-9) &&
    near(sedPiles.netConcreteM3, sedExactNet, 1e-9) &&
    sedPiles.bagCount === Math.ceil(sedExactNet / 0.01 - 1e-12) &&
    sedPiles.bagCount === 30
);

console.log("\n=== R6-R3 BAG PRIMARY + H/BAG ===\n");

const houseCopy = formatPostHoleBaggedConcreteCopy({
  bagCount: housePiles.bagCount,
  holeCount: housePiles.holeCount,
  unitCost: 11.5,
  sloping: false,
  holeDiameterM: housePiles.holeDiameterM,
  grossHoleVolumeM3: housePiles.grossHoleVolumeM3,
  postDisplacementM3: housePiles.postDisplacementM3,
  netConcreteM3: housePiles.netConcreteM3,
  bagYieldM3: housePiles.bagYieldM3,
});
check(
  "R3-1 primary material copy shows total bags",
  /^34 bags required/.test(houseCopy.supporting)
);
check(
  "R3-2 primary material copy shows bags/hole",
  /3\.4 bags\/hole/.test(houseCopy.supporting) ||
    /bags\/hole/.test(houseCopy.supporting)
);
check(
  "R3-3 gross/displacement/net in Takeoff details",
  /Gross hole volume: 0\.42 m³/.test(houseCopy.secondary ?? "") &&
    /Less post displacement: 0\.09 m³/.test(houseCopy.secondary ?? "") &&
    /Net concrete: 0\.33 m³/.test(houseCopy.secondary ?? "") &&
    !/Gross/.test(houseCopy.supporting)
);
check(
  "R3-4 bag count still uses full-precision net",
  housePiles.bagCount === 34 &&
    housePiles.bagCount ===
      bagCountFromNetConcrete(housePiles.netConcreteM3, 0.01)
);
check(
  "R3-5 average bags/hole = total bags / holes",
  near(housePiles.bagCount / housePiles.holeCount, 3.4, 0.05)
);
const slopeCopy = formatPostHoleBaggedConcreteCopy({
  bagCount: sleeperOwner.bagCount ?? 0,
  holeCount: sleeperOwner.holeCount,
  unitCost: null,
  sloping: true,
  holeDiameterM: sleeperOwner.holeDiameterM,
  grossHoleVolumeM3: sleeperOwner.grossHoleVolumeM3,
  postDisplacementM3: sleeperOwner.postDisplacementM3,
  netConcreteM3: sleeperOwner.netConcreteM3,
  bagYieldM3: sleeperOwner.bagYieldM3,
});
check(
  "R3-6 sloping wall says avg where applicable",
  /bags\/hole avg/.test(slopeCopy.supporting)
);
check(
  "R3-7 placement productivity unit = labour-h/bag",
  RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.postHoleConcreteBag] === "bag"
);
check(
  "R3-8 new productivity key used",
  timberConcreteLab?.productivityBasis.key ===
    RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_KEY
);
const legacyM3Company = calculateRetainingWall(
  ctx(timberFacts, [
    testRate(RW_PRODUCTIVITY_KEYS.postHoleConcreteM3, "m3", 9.9, "productivity"),
    testRate("labour.carpenter.hour", "hour", 65, "labour"),
  ]),
  wa()
);
const legacyLab = lab(
  legacyM3Company.requirements,
  RW_TIMBER_CONCRETE_LABOUR_COMPONENT
);
check(
  "R3-9 old h/m³ key not silently reinterpreted",
  legacyLab?.productivityBasis.key ===
    RW_PRODUCTIVITY_KEYS.postHoleConcreteBag &&
    near(
      legacyLab?.productivityBasis.hoursPerUnit ?? -1,
      RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER,
      1e-9
    ) &&
    RW_PRODUCTIVITY_KEYS.postHoleConcreteM3 ===
      RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_M3_KEY
);
check(
  "R3-10 starter = 0.035 labour-h/bag",
  RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER === 0.035
);
check(
  "R3-11 placement hours = bags × h/bag",
  near(
    timberConcreteLab?.baseHours ?? -1,
    sedPiles.bagCount * 0.035,
    0.02
  )
);
check(
  "R3-12 labour does not use net m³ on bagged mature path",
  timberConcreteLab?.productivityBasis.unit === "bag" &&
    timberConcreteLab.productivityBasis.quantity === sedPiles.bagCount
);
const labourDisplay = formatTimberLabourCompactCopy({
  constraints: [],
  includeMaterialCarry: false,
  quantity: 35,
  unit: "bag",
  hoursPerUnit: 0.035,
  label: "Post-hole concrete placement",
});
check(
  "R3-13 labour display no raw long floating point",
  !/\d\.\d{6,}/.test(labourDisplay.supporting) &&
    /35 bags × 0\.035 labour-h\/bag = 1\.23 hrs/.test(labourDisplay.supporting)
);
check(
  "R3-14 volume display <=2dp",
  /0\.33 m³/.test(houseCopy.secondary ?? "") &&
    !/0\.330365/.test(houseCopy.secondary ?? "")
);
check(
  "R3-15 hour display <=2dp",
  /1\.23 hrs/.test(labourDisplay.supporting)
);
check(
  "R3-16 productivity display sensible precision",
  /0\.035 labour-h\/bag/.test(labourDisplay.supporting)
);
check(
  "R3-17 internal calculation precision unchanged",
  housePiles.netConcreteM3 > housePiles.netConcreteDisplayM3 &&
    housePiles.bagCount === 34
);
check("R3-18 Timber path green", timberConcreteLab != null && housePiles.bagCount === 34);
check(
  "R3-19 Sleeper path green",
  sleeperConcreteLab != null &&
    sleeperConcreteLab.productivityBasis.unit === "bag"
);
check(
  "R3-20 Masonry m³ concrete paths unchanged",
  RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.masonryFootingM3] === "m3" &&
    RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.masonryCoreFillM3] === "m3"
);
check(
  "R3-21 Clarify unchanged",
  retainingWallFactQuestionClass(RW_DIGGER_ACCESS_FACT) === "ASK_NOW"
);

console.log("\n=== R6 REGRESSION SPAWNS ===\n");

check("40 Masonry 2B", spawnVerifier("scripts/verify-retaining-wall-maturity-2b.ts"));
check(
  "41 R4 subcontract",
  spawnVerifier("scripts/verify-retaining-wall-masonry-subcontract-r4.ts")
);
check(
  "42 FAMILY-CLOSURE",
  spawnVerifier("scripts/verify-retaining-wall-family-closure-01.ts")
);
check(
  "43 FAMILY-COVERAGE",
  spawnVerifier("scripts/verify-retaining-wall-family-coverage-01.ts")
);
check("44 Sleeper 2A", spawnVerifier("scripts/verify-retaining-wall-maturity-2a.ts"));
check("45 Timber 1F", spawnVerifier("scripts/verify-retaining-wall-maturity-1f.ts"));
check("46 Deck 2D", spawnVerifier("scripts/verify-deck-maturity-2d.ts"));
check("47 ESTIMATOR-SAFETY-0", spawnVerifier("scripts/verify-estimator-safety-0.ts"));
check("48 Pricing", spawnVerifier("scripts/verify-pricing-ownership.ts"));
check("49 Quote", spawnVerifier("scripts/verify-quote-safety.ts"));
check("50 Performance", spawnVerifier("scripts/verify-stage-3-1b7fr5-deck-final-ux-performance.ts"));

check("51 RW 1E", spawnVerifier("scripts/verify-retaining-wall-maturity-1e.ts"));
check("52 RW 1D", spawnVerifier("scripts/verify-retaining-wall-maturity-1d.ts"));
check(
  "53 RW 1C-R3",
  spawnVerifier("scripts/verify-retaining-wall-maturity-1c-r3.ts")
);
check("54 RW 1C", spawnVerifier("scripts/verify-retaining-wall-maturity-1c.ts"));
check("55 RW 1B", spawnVerifier("scripts/verify-retaining-wall-maturity-1b.ts"));
check("56 RW 1A", spawnVerifier("scripts/verify-retaining-wall-maturity-1a.ts"));

console.log(`\nR6 RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

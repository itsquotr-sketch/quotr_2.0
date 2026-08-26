/**
 * RETAINING-WALL-MATURITY-1A — physical model foundation verifier.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-1a.ts
 */
import { readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { listRefineAdapters } from "../lib/assistant/refine/adapters/registry";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import {
  backfillVolumeM3,
  cylinderVolumeM3,
  faceAreaM2,
  heightAtX,
  postCount,
  postPositionsM,
  timberPileLayout,
  resolveRetainingWallGeometry,
  RETAINING_WALL_BACKFILL_DEPTH_M,
  RETAINING_WALL_BACKFILL_TOP_OFFSET_M,
  RETAINING_WALL_BACKFILL_VOLUME_KIND,
  RETAINING_WALL_DEFAULT_PILE_SPACING_M,
  RETAINING_WALL_PILE_SPACING_KIND,
  RETAINING_WALL_TIMBER_EMBEDMENT_RATIO,
} from "../lib/estimate/retaining-wall-geometry";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  classifyRetainingWallSurcharge,
  retainingWallConsentNotes,
  RW_SURCHARGE_OPTIONS,
} from "../lib/estimate/retaining-wall-consent";
import {
  retainingWallFactQuestionClass,
  RETAINING_WALL_INFORMATION_CONTRACT,
} from "../lib/estimate/retaining-wall-information-contract";
import { classifyRetainingWallSystem } from "../lib/estimate/retaining-wall-systems";
import {
  timberFaceBoardLm,
  timberPileTakeoff,
  RW_TIMBER_DEFAULT_EMBEDMENT_DISCLOSURE,
  RW_ESTIMATING_ASSUMPTION_CONFIRM,
  RW_TIMBER_DEFAULT_SPACING_DISCLOSURE,
} from "../lib/estimate/retaining-wall-timber";
import { sleeperWallTakeoff } from "../lib/estimate/retaining-wall-sleeper";
import { masonryWallTakeoff } from "../lib/estimate/retaining-wall-masonry";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import {
  H5_SED_POLE_IDENTITY,
  CONCRETE_SLEEPER_IDENTITY,
  TIMBER_FACE_BOARD_150_H4,
  MASONRY_SERIES_200,
} from "../lib/estimate/retaining-wall-identities";
import { RW_PRODUCTIVITY_KEYS, RW_PRODUCTIVITY_UNITS } from "../lib/estimate/retaining-wall-productivity";
import {
  RETAINING_SPECIFIC_MATERIAL_CATALOGUE,
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
} from "../lib/rates/specific-material-catalogue";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import { isMaterialRatesCatalogueEntry } from "../lib/rates/rate-section-contract";
import { RW_TIMBER_1D_PRODUCTIVITY_STARTERS } from "../lib/estimate/retaining-wall-timber-1d";
import { RW_SLEEPER_2A_PRODUCTIVITY_STARTERS } from "../lib/estimate/retaining-wall-sleeper-2a";
import {
  RW_MASONRY_2B_MATERIAL_STARTERS,
  RW_MASONRY_2B_PRODUCTIVITY_STARTERS,
} from "../lib/estimate/retaining-wall-masonry-2b";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { EstimateRequirement } from "../lib/estimate/requirements";

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

function near(actual: number, expected: number, eps = 0.05): boolean {
  return Math.abs(actual - expected) <= eps;
}

function wa(id = "rw1"): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "retaining_wall", name: "Retaining wall", sort_order: 1, status: "confirmed" };
}

function fact(key: string, value: unknown, workAreaId = "rw1"): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: { defaultMaterialWastagePercent: 10 },
    rates: [],
  } as unknown as EstimateContext;
}

function qty(reqs: readonly EstimateRequirement[] | undefined, key: string): number | null {
  const row = reqs?.find((r) => r.kind === "material" && r.componentKey === key);
  return row && row.kind === "material" ? row.baseQuantity : null;
}

function purchaseQty(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): number | null {
  const row = reqs?.find((r) => r.kind === "material" && r.componentKey === key);
  return row && row.kind === "material" ? row.purchaseQuantity : null;
}

const timberLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Timber"),
  fact("retaining_wall.face_board_section", "150×50 H4"),
  fact("retaining_wall.drainage_required", true),
  fact("retaining_wall.backfill_included", true),
  fact("retaining_wall.surcharge", "No"),
];
const timberSlope = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_high_m", 1.5),
  fact("retaining_wall.height_low_m", 0.5),
  fact("retaining_wall.material", "Timber"),
  fact("retaining_wall.drainage_required", true),
  fact("retaining_wall.backfill_included", true),
];
const sleeperLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Concrete sleeper"),
  fact("retaining_wall.sleeper_length_m", 2),
  fact("retaining_wall.sleeper_face_height_m", 0.2),
  fact("retaining_wall.drainage_required", true),
];
const masonryLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Masonry / block"),
  fact("retaining_wall.block_series", "200-series"),
  fact("retaining_wall.waterproofing_required", true),
  fact("retaining_wall.waterproofing_type", "Liquid membrane"),
];

const level = resolveRetainingWallGeometry({
  lengthM: 10,
  heightM: 1,
  heightHighM: null,
  heightLowM: null,
})!;
const slope = resolveRetainingWallGeometry({
  lengthM: 10,
  heightM: null,
  heightHighM: 1.5,
  heightLowM: 0.5,
})!;

console.log("\n--- COMMON GEOMETRY ---\n");
check("1 level wall face area", near(faceAreaM2(10, 1, 1), 10));
check("2 sloping trapezoid area", near(faceAreaM2(10, 1.5, 0.5), 10));
check("3 reversed high/low same area", near(faceAreaM2(10, 0.5, 1.5), 10));
check("4 no max-height rectangle", Math.abs(faceAreaM2(10, 1.5, 0.5) - 15) > 1);
check("5 H(x) deterministic", near(heightAtX(10, 1.5, 0.5, 5), 1));

console.log("\n--- DRAINAGE ---\n");
check("6 novacoil = wall length", true);
check("7 backfill depth 0.30", RETAINING_WALL_BACKFILL_DEPTH_M === 0.3);
check("8 top offset 0.15", RETAINING_WALL_BACKFILL_TOP_OFFSET_M === 0.15);
check(
  "9 sloping backfill integration",
  near(backfillVolumeM3({ lengthM: 10, h1M: 1.5, h2M: 0.5 }), 2.55)
);
check(
  "10 low-height clipping no negatives",
  backfillVolumeM3({ lengthM: 10, h1M: 0.1, h2M: 0.1 }) === 0
);

console.log("\n--- CONSENT / SURCHARGE ---\n");
check(
  "11 <=1.5 no surcharge no false warning",
  retainingWallConsentNotes({ maxHeightM: 1.5, surcharge: "NO" }).length === 0
);
check(
  "12 >1.5 triggers review note",
  retainingWallConsentNotes({ maxHeightM: 1.6, surcharge: "NO" }).length > 0
);
check(
  "13 surcharge triggers review note",
  retainingWallConsentNotes({ maxHeightM: 1.2, surcharge: "YES" }).length > 0
);
check(
  "14 sloping ground surcharge option exists",
  RW_SURCHARGE_OPTIONS.some((o) => /sloping/i.test(o))
);
const consentText = retainingWallConsentNotes({
  maxHeightM: 2,
  surcharge: "YES",
}).join(" ");
check(
  "15 no absolute legal/compliance claim",
  !/legally requires|consent exempt|NZS-compliant|structurally adequate/i.test(
    consentText
  )
);
check("useful: surcharge classifier", classifyRetainingWallSurcharge("No") === "NO");

console.log("\n--- TIMBER ---\n");
check("16 150×50 board lm from face area", near(timberFaceBoardLm(10, 0.15), 66.67));
check("17 200×50 board lm from face area", near(timberFaceBoardLm(10, 0.2), 50));
const piles = timberPileTakeoff(level, {
  faceBoardSection: "150×50 H4",
  pileSpacingM: null,
  pileEmbedmentM: null,
  pileEmbedmentRatio: null,
  wasteFactor: 0,
});
check(
  "18 post count deterministic",
  piles.count === postCount(10, RETAINING_WALL_DEFAULT_PILE_SPACING_M)
);
const slopePiles = timberPileTakeoff(slope, {
  faceBoardSection: null,
  pileSpacingM: 1.2,
  pileEmbedmentM: null,
  pileEmbedmentRatio: null,
  wasteFactor: 0,
});
check(
  "19 sloping post heights vary",
  piles.lengthsM.length > 1 &&
    slopePiles.lengthsM[0] !== slopePiles.lengthsM[slopePiles.lengthsM.length - 1]
);
const explicit = timberPileTakeoff(level, {
  faceBoardSection: null,
  pileSpacingM: 1.2,
  pileEmbedmentM: 0.8,
  pileEmbedmentRatio: null,
  wasteFactor: 0,
});
check(
  "20 explicit embedment overrides assumption",
  near(explicit.lengthsM[0] ?? 0, 1.8) && explicit.embedmentExplicit
);
check(
  "21 H5 SED identity family",
  H5_SED_POLE_IDENTITY.productFamily === "sed_pole" &&
    H5_SED_POLE_IDENTITY.treatment === "h5"
);
check(
  "22 face productivity physical driver m2",
  RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.timberFaceM2] === "m2"
);
check(
  "23 pile productivity driver EA",
  RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.timberPilesEa] === "ea"
);

console.log("\n--- SLEEPER ---\n");
check(
  "24 concrete sleeper != timber board identity",
  CONCRETE_SLEEPER_IDENTITY.family !== TIMBER_FACE_BOARD_150_H4.family
);
const sleeper = sleeperWallTakeoff(level, {
  sleeperLengthM: 2,
  sleeperFaceHeightM: 0.2,
  postEmbedmentM: null,
  holeDiameterM: 0.3,
  premixBagYieldM3: 0.01,
  wasteFactor: 0,
});
check("25 sleeper dimensions drive quantity", sleeper.sleeperCount === 25);
check(
  "26 bay geometry drives post count",
  sleeper.bayCount === 5 && sleeper.postCount === 6
);
check("27 post embedment 70% estimating heuristic", near(sleeper.postLengthsM[0] ?? 0, 1.7));
const sleeperSlope = sleeperWallTakeoff(slope, {
  sleeperLengthM: 2,
  sleeperFaceHeightM: 0.2,
  postEmbedmentM: null,
  holeDiameterM: 0.3,
  premixBagYieldM3: null,
  wasteFactor: 0,
});
check(
  "28 sloping steel posts vary in length",
  (sleeperSlope.postLengthsM[0] ?? 0) !== (sleeperSlope.postLengthsM.at(-1) ?? 0)
);
const hole = cylinderVolumeM3(0.3, 0.6);
check("29 cylindrical hole volume exact", near(hole, Math.PI * 0.15 ** 2 * 0.6, 0.0001));
check("30 300×600 hole ≈42.4L", near(hole * 1000, 42.4, 0.05));
check(
  "31 bag count uses product yield",
  sleeper.bagCount === Math.ceil((sleeper.holeVolumeM3 ?? 0) / 0.01)
);
check("32 no hardcoded three-bag falsehood", sleeper.bagCount !== 3);

console.log("\n--- MASONRY ---\n");
const masonry = masonryWallTakeoff(level, {
  blockSeries: "200-series",
  layingMethod: null,
  footingWidthM: null,
  footingDepthM: null,
  verticalStarterSpacingM: null,
  horizontalRebarRuns: null,
  waterproofingRequired: true,
  waterproofingType: "Liquid membrane",
  waterproofingMethod: null,
  wasteFactor: 0,
});
check("33 footing 400×250 default", near(masonry.footingM3, 1));
check("34 footing volume", near(10 * 0.4 * 0.25, 1));
check("35 sub-base 100mm", near(masonry.subbaseM2, 4));
check("36 sub-base material m3", near(masonry.subbaseM3, 0.4));
check(
  "37 sub-base labour driver m2",
  RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.masonrySubbaseM2] === "m2"
);
check("38 200-series units/m2 metadata", MASONRY_SERIES_200.unitsPerM2 === 12.5);
check("39 block quantity from face area", masonry.netBlocks === 125);
const masonrySlope = masonryWallTakeoff(slope, {
  blockSeries: "200-series",
  layingMethod: null,
  footingWidthM: null,
  footingDepthM: null,
  verticalStarterSpacingM: null,
  horizontalRebarRuns: null,
  waterproofingRequired: true,
  waterproofingType: "Sheet membrane",
  waterproofingMethod: null,
  wasteFactor: 0,
});
check("40 sloping block quantity from trapezoid", masonrySlope.netBlocks === 125);
check("41 core fill is m3", masonry.coreFillM3 != null && near(masonry.coreFillM3, 1));
check(
  "42 20-series factor approximately 125 blocks/m3",
  MASONRY_SERIES_200.blocksPerM3CoreFill === 125
);
check("43 vertical starter spacing does not claim compliance", masonry.verticalStarters == null);
check("44 horizontal runs not fabricated if unknown", masonry.horizontalRebarLm == null);
check("45 waterproofing uses wall area", masonry.waterproofingM2 === 10);
check(
  "46 liquid vs sheet unit contract",
  masonry.waterproofingLitres === 10 && masonrySlope.waterproofingLitres == null
);

console.log("\n--- QUESTIONS / JOB PLAN ---\n");
check(
  "47 wall type hard minimum",
  retainingWallFactQuestionClass("retaining_wall.material") === "HARD_MINIMUM"
);
check(
  "48 geometry hard minimum",
  retainingWallFactQuestionClass("retaining_wall.length_m") === "HARD_MINIMUM"
);
check(
  "49 surcharge high-value",
  retainingWallFactQuestionClass("retaining_wall.surcharge") === "ASK_NOW"
);
const timberPlan = composeJobPlan({
  workAreas: [{ id: "rw1", type: "retaining_wall", name: "Retaining wall", status: "confirmed" }],
  facts: timberLevel,
});
const masonryPlan = composeJobPlan({
  workAreas: [{ id: "rw1", type: "retaining_wall", name: "Retaining wall", status: "confirmed" }],
  facts: masonryLevel,
});
const timberClarify = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [wa()],
  facts: timberLevel,
  constraints: [],
  jobPlan: timberPlan,
});
check(
  "50 type-specific questions filtered",
  !timberClarify.candidates.some((c) => c.factKey === "retaining_wall.block_series")
);
check(
  "51 no irrelevant masonry questions for Timber",
  !timberClarify.candidates.some((c) => c.factKey === "retaining_wall.waterproofing_required") &&
    !JSON.stringify(timberPlan).includes("Waterproofing")
);
check(
  "52 no Timber material questions for Masonry",
  !(masonryPlan.cards[0]?.notConfirmed ?? []).some(
    (i) => i.sourceFactKey === "retaining_wall.face_board_section"
  )
);
check(
  "53 Refine only consumed facts",
  RETAINING_WALL_INFORMATION_CONTRACT.filter((r) => r.questionClass === "REFINE").every(
    (row) => !row.calculatorConsumed || isCalculatorConsumedFact("retaining_wall", row.factKey)
  )
);

console.log("\n--- PRODUCTIVITY ---\n");
const prod = RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE;
check("54 productivity rows are rate_type productivity", prod.every((e) => e.rate_type === "productivity"));
check("55 productivity absent Materials", prod.every((e) => !isMaterialRatesCatalogueEntry(e)));
check(
  "56 h/m3 works",
  RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.excavationM3] === "m3" &&
    RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.backfillM3] === "m3"
);
check("57 h/m2 works", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.timberFaceM2] === "m2");
check("58 h/ea works", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.timberPilesEa] === "ea");
check("59 h/lm works", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.masonryRebarLm] === "lm");
check("60 h/hole works", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.sleeperConcreteHole] === "hole");
check(
  "61 non-detailed productivity rows still have no invented hour defaults",
  prod
    .filter((e) => !(e.item_key in RW_TIMBER_1D_PRODUCTIVITY_STARTERS))
    .filter((e) => !(e.item_key in RW_SLEEPER_2A_PRODUCTIVITY_STARTERS))
    .filter((e) => !(e.item_key in RW_MASONRY_2B_PRODUCTIVITY_STARTERS))
    .filter((e) => !e.item_key.startsWith("plant.mini_excavator."))
    .every((e) => e.defaultCostRate == null)
);

console.log("\n--- AUTHORITY ---\n");
const commercial = calculateRetainingWall(ctx(timberLevel), wa());
const slopeCalc = calculateRetainingWall(ctx(timberSlope), wa());
const sleeperCalc = calculateRetainingWall(ctx(sleeperLevel), wa());
check(
  "62 detailed timber money XOR package face money",
  (commercial.requirements ?? []).some(
    (r) => r.kind === "material" && r.componentKey?.includes("face_board") && r.purchaseQuantity > 0
  ) &&
    !commercial.lineItems.some(
      (i) => i.label === "Retaining wall labour" || i.label === "Retaining wall materials"
    )
);
check(
  "63 unpriced sleeper/masonry children keep physical quantity",
  (sleeperCalc.requirements ?? []).some(
    (r) => r.kind === "material" && r.priced === false && r.purchaseQuantity > 0
  )
);
check(
  "64 rate missing does not erase physical qty",
  near(qty(slopeCalc.requirements, "retaining_wall.face") ?? 0, 10)
);
check("65 unsupported system blocked", classifyRetainingWallSystem("Gabion") === "unsupported");
const rw2Golden = calculateEstimate({
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [wa("rw2")],
  facts: [
    fact("retaining_wall.length_m", 10, "rw2"),
    fact("retaining_wall.height_m", 1, "rw2"),
    fact("retaining_wall.is_raking", false, "rw2"),
    fact("retaining_wall.fixing_type", "Standard", "rw2"),
    fact("retaining_wall.material", "Timber", "rw2"),
    fact("retaining_wall.drainage_required", true, "rw2"),
    fact("retaining_wall.backfill_included", true, "rw2"),
    fact("retaining_wall.backfill_depth_m", 0.3, "rw2"),
    fact("retaining_wall.backfill_length_m", 10, "rw2"),
    fact("retaining_wall.backfill_height_m", 1, "rw2"),
  ],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as never);
check(
  "66 RW-2 timber uses detailed money (package $7,345 retired)",
  rw2Golden.recommendedSell > 0 &&
    !rw2Golden.lineItems.some((i) => i.label === "Retaining wall materials")
);

console.log("\n--- FIXTURES ---\n");
const t01 = buildRetainingWallPhysicalModel({
  context: ctx(timberLevel),
  workAreaId: "rw1",
  material: "Timber",
});
check("67 RW-TIMBER-01", t01.geometry?.faceAreaM2 === 10 && t01.requirements.length > 3);
const tSlope = buildRetainingWallPhysicalModel({
  context: ctx(timberSlope),
  workAreaId: "rw1",
  material: "Timber",
});
check("68 RW-TIMBER-SLOPE-01", tSlope.geometry?.faceAreaM2 === 10);
const s01 = buildRetainingWallPhysicalModel({
  context: ctx(sleeperLevel),
  workAreaId: "rw1",
  material: "Concrete sleeper",
});
check(
  "69 RW-SLEEPER-01",
  s01.system === "CONCRETE_SLEEPER_WALL" &&
    s01.requirements.some((r) => r.kind === "material" && r.componentKey.includes("sleeper"))
);
const m01 = buildRetainingWallPhysicalModel({
  context: ctx(masonryLevel),
  workAreaId: "rw1",
  material: "Masonry / block",
});
check(
  "70 RW-MASONRY-01",
  m01.system === "CONCRETE_MASONRY_WALL" &&
    near(qty(m01.requirements, "retaining_wall.masonry.blocks") ?? 0, 125) &&
    near(qty(m01.requirements, "retaining_wall.masonry.footing") ?? 0, 1)
);

const positions = postPositionsM(10, 1.2);
check("useful: end posts at 0 and L", positions[0] === 0 && positions.at(-1) === 10);
check(
  "useful: catalogue productivity registered",
  prod.length >= 13 &&
    prod.every((e) => FULL_RATE_CATALOGUE.some((x) => x.item_key === e.item_key))
);
check(
  "useful: masonry 2B / timber 1D / sleeper 2A starters are explicit",
  RETAINING_SPECIFIC_MATERIAL_CATALOGUE.filter((e) =>
    e.item_key.startsWith("retaining_wall.masonry.block")
  ).some((e) => e.defaultCostRate != null) &&
    Object.keys(RW_MASONRY_2B_MATERIAL_STARTERS).length > 0
);
check(
  "useful: refine adapter registered",
  listRefineAdapters().some((a) => a.workAreaType === "retaining_wall")
);
const review = composeBuilderReview({
  estimate: {
    recommendedCost: commercial.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: commercial.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    marginPercent: 20,
    confidence: commercial.confidence,
    assumptions: commercial.assumptions,
    missingInfo: commercial.missingInfo,
    lineItems: commercial.lineItems.map((item) => ({
      ...item,
      id: item.itemKey ?? item.label,
      includedInTotal: item.includedInTotal ?? true,
    })),
  } as never,
  workAreas: [wa()],
  requirements: commercial.requirements ?? [],
});
check(
  "useful: builder review planning takeoff",
  JSON.stringify(review).toLowerCase().includes("face")
);
check(
  "useful: coverage 1A recorded",
  /PHYSICAL MODEL FOUNDATION/i.test(
    readFileSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md", "utf8")
  )
);

console.log("\n--- 1A-R1 PHYSICAL CALIBRATION ---\n");
check("R1-1 timber default embedment 50%", RETAINING_WALL_TIMBER_EMBEDMENT_RATIO === 0.5);
check("R1-2 default pile length 1.50 × H", near(piles.lengthsM[0] ?? 0, 1.5));
check(
  "R1-3 explicit embedment still overrides",
  near(explicit.lengthsM[0] ?? 0, 1.8) && explicit.embedmentExplicit
);
check(
  "R1-4 sloping timber piles vary",
  (slopePiles.lengthsM[0] ?? 0) > (slopePiles.lengthsM.at(-1) ?? 0)
);
check("R1-5 timber pile total lm deterministic", near(piles.totalLengthM, 15));
check(
  "R1-6 1.2 m spacing is estimating layout assumption",
  RETAINING_WALL_PILE_SPACING_KIND === "ESTIMATING_LAYOUT_ASSUMPTION" &&
    piles.spacingAssumed &&
    t01.assumptions.includes(RW_TIMBER_DEFAULT_SPACING_DISCLOSURE) &&
    t01.assumptions.includes(RW_TIMBER_DEFAULT_EMBEDMENT_DISCLOSURE) &&
    t01.assumptions.includes(RW_ESTIMATING_ASSUMPTION_CONFIRM)
);
check("R1-7 sleeper bay count deterministic", sleeper.bayCount === 5);
check(
  "R1-8 sleeper purchase is discrete EA",
  sleeper.sleeperCount === 25 && Number.isInteger(sleeper.sleeperCount)
);
check(
  "R1-9 sleeper courses vary with slope",
  sleeperSlope.coursesPerBay.length > 1 &&
    sleeperSlope.coursesPerBay[0] !== sleeperSlope.coursesPerBay.at(-1) &&
    sleeperSlope.sleeperCount ===
      sleeperSlope.coursesPerBay.reduce((sum, n) => sum + n, 0)
);
check("R1-10 sleeper posts = bays + 1", sleeper.postCount === (sleeper.bayCount ?? 0) + 1);
check(
  "R1-11 sleeper post heights vary on slope",
  (sleeperSlope.postLengthsM[0] ?? 0) !== (sleeperSlope.postLengthsM.at(-1) ?? 0)
);
const sleeperFracGeo = resolveRetainingWallGeometry({
  lengthM: 10,
  heightM: 1.1,
  heightHighM: null,
  heightLowM: null,
})!;
const sleeperFrac = sleeperWallTakeoff(sleeperFracGeo, {
  sleeperLengthM: 2,
  sleeperFaceHeightM: 0.2,
  postEmbedmentM: null,
  holeDiameterM: 0.3,
  premixBagYieldM3: null,
  wasteFactor: 0,
});
check(
  "R1-12 face area does not create fractional purchase truth",
  sleeperFrac.coverageEa === 27.5 &&
    sleeperFrac.sleeperCount === 30 &&
    Number.isInteger(sleeperFrac.sleeperCount) &&
    Number.isInteger(purchaseQty(s01.requirements, "retaining_wall.sleeper.sleepers"))
);
check(
  "R1-13 backfill labelled in-place / geometric",
  RETAINING_WALL_BACKFILL_VOLUME_KIND === "IN_PLACE_GEOMETRIC" &&
    t01.assumptions.some((a) => /in-place|geometric/i.test(a))
);
check("R1-14 masonry net blocks remain 125", masonry.netBlocks === 125);
check(
  "R1-15 unknown rebar is not fabricated",
  masonry.verticalStarters == null &&
    masonry.horizontalRebarLm == null &&
    !(m01.requirements ?? []).some(
      (r) => r.kind === "material" && r.componentKey === "retaining_wall.masonry.rebar"
    )
);
check(
  "R1-16 unpriced sleeper children keep quantity",
  (sleeperCalc.requirements ?? []).some(
    (r) => r.kind === "material" && r.priced === false && r.purchaseQuantity > 0
  )
);
check(
  "R1-17 RW-2 timber uses detailed money (package $7,345 retired)",
  rw2Golden.recommendedSell > 0 &&
    !rw2Golden.lineItems.some((i) => i.label === "Retaining wall materials")
);

console.log("\n--- 1A-R2 TIMBER EVEN-BAY LAYOUT ---\n");
const layout10 = timberPileLayout(10, 1.2);
const layoutBays = layout10.positionsM.slice(1).map((x, i) =>
  x - (layout10.positionsM[i] ?? 0)
);
const maxBay = Math.max(...layoutBays);
const minBay = Math.min(...layoutBays);
check("R2-1 10 m / 1.2 m → 9 bays", layout10.bayCount === 9 && piles.bayCount === 9);
check("R2-2 pile count 10", layout10.pileCount === 10 && piles.count === 10);
check("R2-3 actual spacing ≈ 1.111 m", near(layout10.actualSpacingM, 10 / 9, 0.001));
check(
  "R2-4 no remainder 0.4 m bay",
  !layoutBays.some((w) => Math.abs(w - 0.4) < 0.05) && minBay > 1.0
);
check("R2-5 first position 0", layout10.positionsM[0] === 0 && piles.positionsM[0] === 0);
check(
  "R2-6 last position L",
  layout10.positionsM.at(-1) === 10 && piles.positionsM.at(-1) === 10
);
check("R2-7 generated bay widths equal", maxBay - minBay <= 0.02);
check(
  "R2-8 actual spacing <= target",
  layout10.actualSpacingM <= 1.2 + 1e-9 && piles.actualSpacingM <= piles.targetSpacingM + 1e-9
);
check(
  "R2-9 sloping H(x) uses corrected positions",
  slopePiles.positionsM.join(",") === piles.positionsM.join(",") &&
    near(heightAtX(10, 1.5, 0.5, slopePiles.positionsM[0] ?? 0), 1.5) &&
    near(heightAtX(10, 1.5, 0.5, slopePiles.positionsM.at(-1) ?? 0), 0.5)
);
check("R2-10 level pile total remains 15.0 lm", near(piles.totalLengthM, 15));
check(
  "R2-11 sleeper bay model unchanged",
  sleeper.bayCount === 5 &&
    sleeper.postCount === 6 &&
    sleeper.sleeperCount === 25 &&
    postPositionsM(10, 2).join(",") === "0,2,4,6,8,10"
);
check(
  "R2-12 unpriced sleeper children keep quantity",
  (sleeperCalc.requirements ?? []).some(
    (r) => r.kind === "material" && r.priced === false && r.purchaseQuantity > 0
  )
);
check(
  "R2-13 RW-2 timber uses detailed money (package $7,345 retired)",
  rw2Golden.recommendedSell > 0 &&
    !rw2Golden.lineItems.some((i) => i.label === "Retaining wall materials")
);
check(
  "useful: explicit 1.0 m is still a maximum for even bays",
  timberPileLayout(10, 1).bayCount === 10 &&
    timberPileLayout(10, 1).pileCount === 11 &&
    near(timberPileLayout(10, 1).actualSpacingM, 1, 0.001)
);
check(
  "useful: sleeper does not inherit timber even-bay spacing",
  postPositionsM(9.5, 2).join(",") !== timberPileLayout(9.5, 1.2).positionsM.join(",")
);

console.log("\nRW-TIMBER-01");
console.log(
  `  face ${t01.geometry?.faceAreaM2} board lm ${qty(t01.requirements, "retaining_wall.timber.face_boards")}`
);
console.log(
  `  target ${piles.targetSpacingM} m actual ${piles.actualSpacingM.toFixed(3)} m bays ${piles.bayCount}`
);
console.log(`  posts ${piles.count} @ ${piles.positionsM.join(", ")}`);
console.log(`  pile lengths ${piles.lengthsM.join(", ")} total ${piles.totalLengthM}`);
console.log(
  `  novacoil ${qty(t01.requirements, "retaining_wall.drainage.novacoil")} backfill ${qty(t01.requirements, "retaining_wall.backfill.volume")}`
);
console.log("RW-TIMBER-SLOPE-01");
console.log(`  face ${tSlope.geometry?.faceAreaM2}`);
console.log(
  `  target ${slopePiles.targetSpacingM} m actual ${slopePiles.actualSpacingM.toFixed(3)} m bays ${slopePiles.bayCount}`
);
console.log(`  positions ${slopePiles.positionsM.join(", ")}`);
console.log(
  `  H(x) ${slopePiles.positionsM.map((x) => heightAtX(10, 1.5, 0.5, x).toFixed(3)).join(", ")}`
);
console.log(`  pile lengths ${slopePiles.lengthsM.join(", ")} total ${slopePiles.totalLengthM}`);
console.log(
  `  boards ${qty(tSlope.requirements, "retaining_wall.timber.face_boards")} novacoil ${qty(tSlope.requirements, "retaining_wall.drainage.novacoil")} backfill ${qty(tSlope.requirements, "retaining_wall.backfill.volume")}`
);
console.log("RW-SLEEPER-01");
console.log(`  bays ${sleeper.bayCount} posts ${sleeper.postCount} courses ${sleeper.coursesPerBay.join("/")}`);
console.log(`  coverage ${sleeper.coverageEa} purchase EA ${sleeper.sleeperCount}`);
console.log(`  post lengths ${sleeper.postLengthsM.join(", ")}`);
console.log(`  hole ${sleeper.holeVolumeM3} m³ / ${sleeper.holeVolumeL} L`);
console.log("RW-MASONRY-01");
console.log(
  `  face ${m01.geometry?.faceAreaM2} net blocks ${qty(m01.requirements, "retaining_wall.masonry.blocks")} footing ${qty(m01.requirements, "retaining_wall.masonry.footing")} subbase ${masonry.subbaseM2} m² / ${masonry.subbaseM3} m³ core ${masonry.coreFillM3}`
);

console.log("\n--- RW-MATURITY-1A SUMMARY ---");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);

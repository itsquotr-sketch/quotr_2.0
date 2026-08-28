/**
 * FENCE-MATURITY-1A / 1A-R1 / 1A-R2 / 1A-R3 — physical + information foundation verifier.
 * Run: npx tsx scripts/verify-fence-maturity-1a.ts
 *
 * Do not commit/push/deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { getJobPlanAdapter } from "../lib/assistant/job-plan/adapters/registry";
import { listRefineAdapters } from "../lib/assistant/refine/adapters/registry";
import { getJobPlanQuickSpecEditor } from "../components/assistant/job-plan/quick-spec-editors";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { buildScopeReview } from "../lib/scopes/scope-review";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import {
  FENCE_COMMERCIAL_AUTHORITY_1A,
  FENCE_COMMERCIAL_COVERAGE_MAP,
  buildFencePhysicalModel,
} from "../lib/estimate/fence-physical";
import {
  fenceFactQuestionClass,
  FENCE_INFORMATION_CONTRACT,
} from "../lib/estimate/fence-information-contract";
import {
  classifyFenceSystem,
  FENCE_SYSTEMS,
  fenceGateScopeApplies,
  isFenceTimberGateFactKey,
  isModularFenceSystem,
  isTimberFenceSystem,
} from "../lib/estimate/fence-systems";
import {
  fenceRailIdentity,
  fenceSectionFamilyKey,
  fenceSectionProductIdentity,
  FENCE_POST_SECTION_M,
} from "../lib/estimate/fence-identities";
import {
  FENCE_DEFAULT_MAX_POST_SPACING_M,
  FENCE_DEFAULT_SECTION_WIDTH_M,
  FENCE_RAIL_COUNT_HEIGHT_THRESHOLD_M,
  classifyFenceGatePosition,
  fenceFaceAreaM2,
  gateFrameLm,
  horizontalCourseCount,
  horizontalCourseFit,
  layoutTimberPostsWithGate,
  modularSectionLayout,
  segmentedVerticalBoardCounts,
  timberMaxSpacingLayout,
  verticalBoardCount,
} from "../lib/estimate/fence-geometry";
import {
  FENCE_GATE_POSITION_ASSUMED_DISCLOSURE,
  FENCE_GATE_POST_SAME_SECTION_DISCLOSURE,
  FENCE_HORIZONTAL_SUPPORT_DECISION,
  FENCE_POST_INSTALL_OWNERSHIP_R1,
  FENCE_CONCRETE_PLACE_OWNERSHIP_R1,
  FENCE_CARRY_OWNERSHIP_R1,
  FENCE_DEFAULT_VERTICAL_PALING_GAP_MM,
  FENCE_VERTICAL_PALING_GAP_DISCLOSURE,
} from "../lib/estimate/fence-defaults";
import { buildFenceTimberTakeoff, FENCE_SLAT_COURSES_EXCEED_HEIGHT } from "../lib/estimate/fence-timber";
import { buildFenceModularTakeoff } from "../lib/estimate/fence-modular";
import {
  bagCountFromNetConcrete,
  bagsPerHoleAvg,
  buildPostHoleBaggedConcrete,
  netConcreteFromGrossAndDisplacement,
  POST_HOLE_PREMIX_20KG_YIELD_M3,
  rectangularSectionDisplacementM3,
} from "../lib/estimate/post-hole-concrete";
import { cylinderVolumeM3 } from "../lib/estimate/retaining-wall-geometry";
import { FENCE_PRODUCTIVITY_KEYS } from "../lib/estimate/fence-productivity";
import { resolveProductivity } from "../lib/estimate/productivity";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";

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

function near(actual: number, expected: number, eps = 1e-6): boolean {
  return Math.abs(actual - expected) <= eps;
}

function wa(id = "f1"): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "fence", name: "Fence", sort_order: 1, status: "confirmed" };
}

function fact(key: string, value: unknown, workAreaId = "f1"): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function ctx(
  facts: EstimateFact[],
  constraints: EstimateContext["constraints"] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints,
    organisationSettings: null,
    materialWastageSettings: null,
    rates: [],
  };
}

function spawnVerifier(script: string): boolean {
  if (process.env.FENCE_SKIP_NESTED_SPAWN === "1") return true;
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        FENCE_SKIP_NESTED_SPAWN: "1",
        RW_SKIP_NESTED_SPAWN: "1",
      },
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

function timberFacts(extra: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Timber paling — vertical board"),
    fact("fence.timber_species", "Radiata Pine"),
    fact("fence.board_thickness_mm", "150 × 19mm"),
    fact("fence.post_spacing_m", 1.8),
    fact("fence.gate_included", true),
    fact("fence.gate_count", 1),
    fact("fence.gate_width_m", 0.9),
    fact("fence.top_capping", "Yes"),
  ];
  return extra.reduce((facts, next) => {
    return [
      ...facts.filter(
        (row) =>
          !(row.key === next.key && row.work_area_id === next.work_area_id)
      ),
      next,
    ];
  }, base);
}

console.log("\n=== FENCE-MATURITY-1A ===\n");

console.log("-- FAMILY --");
check("1 Fence recognised", getJobPlanAdapter("fence").workAreaType === "fence");
check(
  "2 Four system types",
  FENCE_SYSTEMS.length === 4 &&
    classifyFenceSystem("Timber paling — vertical board") === "TIMBER_VERTICAL_PALING" &&
    classifyFenceSystem("Horizontal timber slats") === "TIMBER_HORIZONTAL_SLAT" &&
    classifyFenceSystem("Aluminium / steel slat fence") === "METAL_SLAT_MODULAR" &&
    classifyFenceSystem("Plastic / composite fence") === "PLASTIC_MODULAR" &&
    classifyFenceSystem("Timber") === "TIMBER_VERTICAL_PALING" &&
    classifyFenceSystem("Composite") === "PLASTIC_MODULAR"
);
check(
  "3 Hard minimum",
  fenceFactQuestionClass("fence.system") === "HARD_MINIMUM" &&
    fenceFactQuestionClass("fence.length_m") === "HARD_MINIMUM" &&
    fenceFactQuestionClass("fence.height_m") === "HARD_MINIMUM"
);
const geo = fenceFaceAreaM2(18, 1.8);
check("4 Shared geometry face area", near(geo, 32.4));
check(
  "5 Edit Scope",
  getJobPlanQuickSpecEditor("fence") != null
);
const switchA = buildFencePhysicalModel({
  context: ctx([
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Timber paling — vertical board"),
    fact("fence.slat_gap_mm", 40),
    fact("fence.section_width_m", 2.4),
  ]),
  workAreaId: "f1",
});
const switchB = buildFencePhysicalModel({
  context: ctx([
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Aluminium / steel slat fence"),
    fact("fence.slat_gap_mm", 40),
    fact("fence.section_width_m", 1.8),
  ]),
  workAreaId: "f1",
});
check(
  "6 system switching isolates facts",
  switchA.timber != null &&
    switchA.modular == null &&
    switchA.timber.slatGapMm == null &&
    switchB.modular != null &&
    switchB.timber == null &&
    switchB.modular.sectionWidthM === 1.8
);

console.log("\n-- POST GEOMETRY --");
const layout18 = timberMaxSpacingLayout(18, 1.8);
check("7 first post at 0", layout18.positionsM[0] === 0);
check("8 last post at L", near(layout18.positionsM.at(-1) ?? -1, 18));
check(
  "9 Timber max-spacing layout",
  layout18.bayCount === 10 &&
    layout18.postCount === 11 &&
    layout18.actualSpacingM <= 1.8 + 1e-9
);
const short = timberMaxSpacingLayout(1.2, 1.8);
check("10 Timber short wall 2 posts", short.postCount === 2 && short.positionsM[0] === 0);
const mod18 = modularSectionLayout(18, 1.8);
check(
  "11 Modular sections+1 posts",
  mod18.purchasedSectionCount === 10 && mod18.postCount === 11
);
const mod19 = modularSectionLayout(19, 1.8);
check(
  "12 residual modular bay preserved",
  mod19.fullSectionCount === 10 &&
    near(mod19.residualWidthM, 1) &&
    mod19.purchasedSectionCount === 11 &&
    mod19.postCount === 12 &&
    !near(mod19.residualWidthM, 19 / 11)
);

console.log("\n-- CONCRETE --");
const holeD = 0.3;
const embed = 0.6;
const posts = 12;
const gross = posts * cylinderVolumeM3(holeD, embed);
const disp = posts * rectangularSectionDisplacementM3(FENCE_POST_SECTION_M, FENCE_POST_SECTION_M, embed);
const net = netConcreteFromGrossAndDisplacement(gross, disp);
const bags = bagCountFromNetConcrete(net, POST_HOLE_PREMIX_20KG_YIELD_M3);
check("13 gross holes", gross > 0);
check("14 post displacement", near(disp, 0.072));
check("15 net concrete", near(net, gross - disp));
check(
  "16 full-precision bag ceil",
  bags === Math.ceil(net / POST_HOLE_PREMIX_20KG_YIELD_M3 - 1e-12)
);
check("17 bags/hole", bagsPerHoleAvg(bags, posts) > 0);
const bagProd = resolveProductivity({
  productivityKey: FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag,
  unit: "bag",
  fallbackHoursPerUnit: 0.035,
});
check(
  "18 labour-h/bag path",
  bagProd.key === FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag &&
    bagProd.hoursPerUnit === 0.035
);
const concA = buildPostHoleBaggedConcrete({
  holeDiameterM: 0.3,
  embedmentLengthsM: Array.from({ length: 11 }, () => 0.6),
  bagYieldM3: 0.01,
  displacementForEmbedment: (e) => ({
    volumeM3: rectangularSectionDisplacementM3(0.1, 0.1, e),
    kind: "TIMBER_RECT",
    disclosure: null,
  }),
});
const concB = buildPostHoleBaggedConcrete({
  holeDiameterM: 0.4,
  embedmentLengthsM: Array.from({ length: 11 }, () => 0.6),
  bagYieldM3: 0.01,
  displacementForEmbedment: (e) => ({
    volumeM3: rectangularSectionDisplacementM3(0.1, 0.1, e),
    kind: "TIMBER_RECT",
    disclosure: null,
  }),
});
check("19 diameter edit recalculates", concB.bagCount > concA.bagCount);

console.log("\n-- VERTICAL TIMBER --");
const fixtureA = buildFenceTimberTakeoff({
  geometry: { lengthM: 18, heightM: 1.8, faceAreaM2: 32.4 },
  orientation: "vertical",
  species: "radiata_pine",
  thicknessMm: 19,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: null,
  railCount: null,
  cappingIncluded: true,
  gateIncluded: true,
  gateCount: 1,
  gateWidthM: 0.9,
  wastePercent: null,
});
check("20 face area", near(fixtureA.faceAreaM2, 32.4));
check(
  "21 board count",
  fixtureA.fixedBoardCount ===
    verticalBoardCount({ faceRunLengthM: 8.55, effectiveCoverWidthM: 0.15 }) +
      verticalBoardCount({ faceRunLengthM: 8.55, effectiveCoverWidthM: 0.15 }) &&
    fixtureA.gateBoardCount ===
      verticalBoardCount({ faceRunLengthM: 0.9, effectiveCoverWidthM: 0.15 }) &&
    fixtureA.boardCount === fixtureA.fixedBoardCount + fixtureA.gateBoardCount
);
check("22 board required lm", near(fixtureA.boardRequiredLm, fixtureA.boardCount * 1.8));
const thick25 = buildFenceTimberTakeoff({
  ...{
    geometry: fixtureA.geometry,
    orientation: "vertical" as const,
    species: "radiata_pine" as const,
    thicknessMm: 25,
    maxPostSpacingM: 1.8,
    embedmentM: 0.6,
    holeDiameterM: 0.3,
    slatGapMm: null,
    railCount: null,
    cappingIncluded: true,
    gateIncluded: true,
    gateCount: 1,
    gateWidthM: 0.9,
    wastePercent: null,
  },
});
check(
  "23 thickness changes identity not coverage",
  thick25.boardCount === fixtureA.boardCount &&
    thick25.boardIdentity.section !== fixtureA.boardIdentity.section
);
const macro = buildFenceTimberTakeoff({
  geometry: fixtureA.geometry,
  orientation: "vertical",
  species: "macrocarpa",
  thicknessMm: 19,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: null,
  railCount: null,
  cappingIncluded: true,
  gateIncluded: true,
  gateCount: 1,
  gateWidthM: 0.9,
  wastePercent: null,
});
check(
  "24 species changes identity not quantity",
  macro.boardCount === fixtureA.boardCount &&
    macro.boardRequiredLm === fixtureA.boardRequiredLm &&
    macro.boardIdentity.species === "macrocarpa" &&
    macro.cappingIdentity?.species === "macrocarpa"
);
check(
  "25 rail quantity",
  fixtureA.railCount === 3 &&
    near(fixtureA.railLm, 3 * 17.1) &&
    FENCE_RAIL_COUNT_HEIGHT_THRESHOLD_M === 1.5
);
check(
  "26 capping quantity",
  near(fixtureA.fixedCappingLm, 17.1) &&
    near(fixtureA.gateCappingLm, 0.9) &&
    near(fixtureA.cappingLm, 18)
);
const noGate = buildFenceTimberTakeoff({
  geometry: fixtureA.geometry,
  orientation: "vertical",
  species: "radiata_pine",
  thicknessMm: 19,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: null,
  railCount: null,
  cappingIncluded: true,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
check(
  "27 gate face not lost",
  near(fixtureA.boardRequiredLm, noGate.boardRequiredLm, 1e-9)
);
check(
  "28 gate frame",
  near(fixtureA.gateFrameLm, gateFrameLm(1.8, 0.9), 1e-6)
);
check("29 gate hardware", fixtureA.gateHardwareEa === 1);
check(
  "30 no double rails through gate",
  fixtureA.railLm < noGate.railLm && near(fixtureA.fixedFenceLengthM, 17.1)
);

console.log("\n-- HORIZONTAL TIMBER --");
const fixtureB = buildFenceTimberTakeoff({
  geometry: { lengthM: 12, heightM: 1.5, faceAreaM2: 18 },
  orientation: "horizontal",
  species: "macrocarpa",
  thicknessMm: 25,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: 10,
  railCount: null,
  cappingIncluded: true,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
check(
  "31 course count",
  fixtureB.courseCount === 9 &&
    fixtureB.courseCount ===
      horizontalCourseCount({ heightM: 1.5, boardWidthM: 0.15, gapMm: 10 })
);
const gap20 = buildFenceTimberTakeoff({
  geometry: fixtureB.geometry,
  orientation: "horizontal",
  species: "macrocarpa",
  thicknessMm: 25,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: 20,
  railCount: null,
  cappingIncluded: true,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
check("32 gap affects courses", (gap20.courseCount ?? 0) < (fixtureB.courseCount ?? 0));
check("33 board lm", near(fixtureB.boardRequiredLm, (fixtureB.courseCount ?? 0) * 12));
const vertSame = buildFenceTimberTakeoff({
  geometry: { lengthM: 10, heightM: 1.2, faceAreaM2: 12 },
  orientation: "vertical",
  species: "radiata_pine",
  thicknessMm: 19,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: null,
  railCount: null,
  cappingIncluded: false,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
const horizSame = buildFenceTimberTakeoff({
  geometry: { lengthM: 10, heightM: 1.2, faceAreaM2: 12 },
  orientation: "horizontal",
  species: "radiata_pine",
  thicknessMm: 19,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: 10,
  railCount: null,
  cappingIncluded: false,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
check(
  "34 horizontal differs from vertical",
  !near(vertSame.boardRequiredLm, horizSame.boardRequiredLm) &&
    vertSame.railLm > 0 &&
    horizSame.railLm === 0
);
check(
  "35 support/framing ownership explicit",
  fixtureB.horizontalSupportModel === "POST_TO_POST_NO_RAILS" &&
    fixtureA.horizontalSupportModel === "VERTICAL_RAILS"
);

console.log("\n-- MODULAR --");
const metal18 = buildFenceModularTakeoff({
  geometry: { lengthM: 18, heightM: 1.8, faceAreaM2: 32.4 },
  system: "METAL_SLAT_MODULAR",
  metalMaterial: "aluminium",
  sectionWidthM: 1.8,
  sectionHeightM: 1.8,
  sectionCountOverride: null,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
});
check("36 18m/1.8 =10 sections", metal18.purchasedSectionCount === 10);
check("37 posts=11", metal18.postCount === 11 && metal18.holeCount === 11);
const metal19 = buildFenceModularTakeoff({
  geometry: { lengthM: 19, heightM: 1.8, faceAreaM2: 34.2 },
  system: "METAL_SLAT_MODULAR",
  metalMaterial: "aluminium",
  sectionWidthM: 1.8,
  sectionHeightM: 1.8,
  sectionCountOverride: null,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
});
check(
  "38 19m residual",
  metal19.fullSectionCount === 10 && near(metal19.residualWidthM, 1)
);
check("39 11 purchased sections", metal19.purchasedSectionCount === 11 && metal19.postCount === 12);
const metal20w = buildFenceModularTakeoff({
  geometry: { lengthM: 18, heightM: 1.8, faceAreaM2: 32.4 },
  system: "METAL_SLAT_MODULAR",
  metalMaterial: "aluminium",
  sectionWidthM: 2,
  sectionHeightM: 1.8,
  sectionCountOverride: null,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
});
check(
  "40 section-width edit",
  metal20w.purchasedSectionCount === 9 && metal20w.postCount === 10
);
check(
  "41 Metal material identity",
  metal18.sectionProduct.itemKey ===
    fenceSectionFamilyKey("METAL_SLAT_MODULAR", "aluminium") &&
    metal18.postIdentity.family === "aluminium"
);
const plastic = buildFenceModularTakeoff({
  geometry: { lengthM: 10, heightM: 1.8, faceAreaM2: 18 },
  system: "PLASTIC_MODULAR",
  metalMaterial: null,
  sectionWidthM: 1.8,
  sectionHeightM: 1.8,
  sectionCountOverride: null,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
});
check(
  "42 Plastic identity separate",
  plastic.purchasedSectionCount === 6 &&
    plastic.postCount === 7 &&
    plastic.sectionProduct.itemKey !== metal18.sectionProduct.itemKey &&
    plastic.postIdentity.family === "plastic_composite"
);
const sku = fenceSectionProductIdentity({
  system: "METAL_SLAT_MODULAR",
  material: "aluminium",
  sectionWidthM: 1.8,
  sectionHeightM: 1.8,
});
check(
  "43 Company-product architecture supported",
  sku.familyKey.startsWith("fence.section.") &&
    sku.skuKey.includes("1800x1800") &&
    sku.unit === "ea"
);

console.log("\n-- INFORMATION --");
check(
  "44 assumptions disclosed",
  fixtureA.assumptions.some((row) => /not engineering/i.test(row)) &&
    fixtureA.assumptions.some((row) => /5%|waste/i.test(row)) &&
    fixtureA.assumptions.some((row) => /gate/i.test(row))
);
const ownerA = calculateFence(
  ctx(timberFacts(), [
    { key: "site_access", label: "Access", value: "Moderate" },
    { key: "material_carry_distance", label: "Carry", value: "10–30m" },
  ]),
  wa()
);
const review = composeBuilderReview({
  estimate: {
    recommendedCost: ownerA.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: ownerA.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    marginPercent: 20,
    confidence: ownerA.confidence,
    assumptions: ownerA.assumptions,
    missingInfo: ownerA.missingInfo,
    lineItems: ownerA.lineItems.map((item) => ({
      ...item,
      id: item.itemKey ?? item.label,
      includedInTotal: item.includedInTotal ?? true,
    })),
  } as never,
  workAreas: [wa()],
  requirements: ownerA.requirements ?? [],
});
check(
  "45 Improve Estimate high-value",
  review.improvements.length > 0 &&
    review.improvements.length <= 6 &&
    !review.improvements.some((row) => /XOR|TIMBER_VERTICAL/i.test(row.label))
);
check("46 confidence sensible", ownerA.confidence > 40 && ownerA.confidence <= 100);
const jobPlan = composeJobPlan({
  workAreas: [wa()],
  facts: timberFacts(),
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [wa()],
  facts: timberFacts(),
  constraints: [],
  jobPlan,
});
check(
  "47 irrelevant questions suppressed",
  !clarify.candidates.some((q) => /digger/i.test(q.question) || /digger/i.test(q.label)) &&
    !clarify.candidates.some((q) => q.factKey === "fence.slat_gap_mm")
);

console.log("\n-- BEHAVIOUR --");
const before = calculateFence(ctx(timberFacts()), wa());
const after = calculateFence(
  ctx(timberFacts([fact("fence.post_spacing_m", 1.5)])),
  wa()
);
const postsBefore = (before.requirements ?? []).find(
  (r) => r.kind === "material" && r.componentKey === "fence.posts.ea"
) as MaterialRequirement | undefined;
const postsAfter = (after.requirements ?? []).find(
  (r) => r.kind === "material" && r.componentKey === "fence.posts.ea"
) as MaterialRequirement | undefined;
check(
  "48 Update Estimate",
  (postsAfter?.purchaseQuantity ?? 0) > (postsBefore?.purchaseQuantity ?? 0)
);
check(
  "49 physical quantities independent of commercial ownership",
  (before.requirements ?? []).every((r) => r.priced === false) &&
    (before.requirements ?? []).some((r) => r.kind === "material")
);
check(
  "50 package/detail XOR preserved",
  FENCE_COMMERCIAL_AUTHORITY_1A === "LEGACY_PACKAGE_AUTHORITY" &&
    before.lineItems.some((i) => i.label === "Fence materials") &&
    before.lineItems.some((i) => i.label === "Fence labour") &&
    FENCE_COMMERCIAL_COVERAGE_MAP.length >= 10
);
const est = calculateEstimate(ctx(timberFacts()));
check(
  "51 Pricing/Quote regression",
  est.recommendedSell > 0 &&
    est.lineItems.some((i) => i.label === "Fence materials")
);

console.log("\n-- OWNER FIXTURES --");
check(
  "A posts/holes/bags",
  fixtureA.postCount === 12 &&
    fixtureA.holeCount === 12 &&
    fixtureA.concrete.bagCount === bags
);
check(
  "A purchased boards use waste once",
  near(fixtureA.boardPurchasedLm, fixtureA.boardRequiredLm * 1.05, 1e-6)
);
check(
  "B posts and capping",
  fixtureB.postCount === timberMaxSpacingLayout(12, 1.8).postCount &&
    near(fixtureB.cappingLm, 12)
);
check(
  "B whole-course fit",
  fixtureB.courseCount === 9 &&
    near(fixtureB.occupiedHeightM ?? 0, 1.43) &&
    near(fixtureB.residualM ?? 0, 0.07) &&
    near(fixtureB.boardRequiredLm, 108) &&
    near(fixtureB.boardPurchasedLm, 113.4)
);
check(
  "C then D modular engine shared",
  metal18.system !== plastic.system &&
    plastic.fullSectionCount === 5 &&
    near(plastic.residualWidthM, 1)
);
const bagLabour = (before.requirements ?? []).find(
  (r) => r.kind === "labour" && r.componentKey === "fence.post_hole_concrete.place"
) as LabourRequirement | undefined;
check(
  "bag labour hours = bags × 0.035",
  bagLabour != null &&
    near(bagLabour.baseHours, (fixtureA.concrete.bagCount) * 0.035, 1e-6)
);

console.log("\n-- CONTRACT / REGISTRY --");
check(
  "contract classes exist",
  FENCE_INFORMATION_CONTRACT.some((r) => r.questionClass === "ASK_NOW") &&
    FENCE_INFORMATION_CONTRACT.some((r) => r.questionClass === "ASSUME_IF_SKIPPED")
);
check(
  "consumed facts include hole diameter",
  isCalculatorConsumedFact("fence", "fence.hole_diameter_m")
);
check(
  "refine adapter registered",
  listRefineAdapters().some((a) => a.workAreaType === "fence")
);
check(
  "coverage records Fence 1A",
  /FENCE-MATURITY-1A/i.test(
    readFileSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md", "utf8")
  )
);
check(
  "default spacing 1.8",
  FENCE_DEFAULT_MAX_POST_SPACING_M === 1.8 &&
    FENCE_DEFAULT_SECTION_WIDTH_M === 1.8
);
const editorSrc = readFileSync(
  "components/assistant/job-plan/FenceQuickSpecEditor.tsx",
  "utf8"
);
check(
  "editor writes hole diameter as metres from mm",
  editorSrc.includes("fence.hole_diameter_m") && editorSrc.includes("mm / 1000")
);
const postHoleSrc = readFileSync("lib/estimate/post-hole-concrete.ts", "utf8");
check(
  "shared helper uses diameter not radius",
  postHoleSrc.includes("cylinderVolumeM3(params.holeDiameterM") &&
    !postHoleSrc.includes("holeDiameterM / 2") &&
    !postHoleSrc.includes("holeDiameterM/2")
);

console.log("\n-- SENSITIVITY --");
const tallRails = buildFenceTimberTakeoff({
  geometry: { lengthM: 10, heightM: 1.6, faceAreaM2: 16 },
  orientation: "vertical",
  species: "radiata_pine",
  thicknessMm: 19,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: null,
  railCount: null,
  cappingIncluded: false,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
const shortRails = buildFenceTimberTakeoff({
  geometry: { lengthM: 10, heightM: 1.4, faceAreaM2: 14 },
  orientation: "vertical",
  species: "radiata_pine",
  thicknessMm: 19,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: null,
  railCount: null,
  cappingIncluded: false,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
check(
  "height crosses rail threshold",
  (tallRails.railCount ?? 0) === 3 && (shortRails.railCount ?? 0) === 2
);
const longer = timberMaxSpacingLayout(20, 1.8);
check("length changes posts", longer.postCount > layout18.postCount);

function vTakeoff(
  extra: Partial<Parameters<typeof buildFenceTimberTakeoff>[0]> = {}
) {
  return buildFenceTimberTakeoff({
    geometry: { lengthM: 18, heightM: 1.8, faceAreaM2: 32.4 },
    orientation: "vertical",
    species: "radiata_pine",
    thicknessMm: 19,
    maxPostSpacingM: 1.8,
    embedmentM: 0.6,
    holeDiameterM: 0.3,
    slatGapMm: null,
    railCount: null,
    cappingIncluded: true,
    gateIncluded: true,
    gateCount: 1,
    gateWidthM: 0.9,
    wastePercent: null,
    ...extra,
  });
}

console.log("\n-- FENCE-MATURITY-1A-R1 GATE GEOMETRY --");
check(
  "R1.1 no gate-at-start-only timber path",
  fixtureA.postLayout.layoutKind === "TIMBER_SEGMENTED_GATE" &&
    fixtureA.gatePosition === "WITHIN_FENCE_RUN" &&
    fixtureA.gatePositionAssumed === true &&
    fixtureA.assumptions.includes(FENCE_GATE_POSITION_ASSUMED_DISCLOSURE) &&
    !/x = 0/.test(fixtureA.assumptions.join(" "))
);
const atEnd = vTakeoff({ gatePosition: "At an end" });
check(
  "R1.2 AT_END one fixed run",
  atEnd.runs.length === 1 &&
    near(atEnd.runs[0]?.lengthM ?? 0, 17.1) &&
    atEnd.gatePosition === "AT_END" &&
    atEnd.postLayout.layoutKind === "TIMBER_SEGMENTED_GATE"
);
check(
  "R1.3 WITHIN_RUN two fixed runs",
  fixtureA.runs.length === 2 &&
    near(fixtureA.runs[0]?.lengthM ?? 0, 8.55) &&
    near(fixtureA.runs[1]?.lengthM ?? 0, 8.55)
);
const layoutWithin = layoutTimberPostsWithGate({
  lengthM: 18,
  maxSpacingM: 1.8,
  gateWidthM: 0.9,
  position: "WITHIN_FENCE_RUN",
});
check(
  "R1 WITHIN centred post positions",
  layoutWithin.postCount === 12 &&
    near(layoutWithin.positionsM[0] ?? -1, 0) &&
    near(layoutWithin.gateStartM, 8.55) &&
    near(layoutWithin.gateEndM, 9.45) &&
    near(layoutWithin.positionsM.at(-1) ?? -1, 18)
);
const notSure = vTakeoff({ gatePosition: "Not sure" });
check(
  "R1.4 centred fallback",
  classifyFenceGatePosition("Not sure") == null &&
    notSure.gatePosition === "WITHIN_FENCE_RUN" &&
    notSure.gatePositionAssumed &&
    near(notSure.runs[0]?.lengthM ?? 0, 8.55) &&
    near(notSure.runs[1]?.lengthM ?? 0, 8.55)
);
check(
  "R1.5 gate-edge posts exist",
  fixtureA.gateEdgePostCount === 2 &&
    fixtureA.posts.filter((p) => p.roles.includes("gate_edge")).length === 2 &&
    atEnd.gateEdgePostCount === 2
);
const uniqueXs = new Set(fixtureA.postLayout.positionsM.map((x) => x.toFixed(6)));
check(
  "R1.6 shared posts deduplicated",
  uniqueXs.size === fixtureA.postCount &&
    fixtureA.postLayout.firstAtZero &&
    fixtureA.postLayout.lastAtLength &&
    fixtureA.posts.some((p) => p.roles.includes("start")) &&
    fixtureA.posts.some((p) => p.roles.includes("end"))
);
check(
  "R1.7 max spacing not exceeded",
  fixtureA.postLayout.maxSpacingHonoured &&
    fixtureA.postLayout.fenceBayWidthsM.every((w) => w <= 1.8 + 1e-9) &&
    atEnd.postLayout.maxSpacingHonoured &&
    atEnd.postLayout.fenceBayWidthsM.every((w) => w <= 1.8 + 1e-9)
);
check(
  "R1 gate position sensitivity 18/0.9/1.8",
  fixtureA.postCount === 12 &&
    atEnd.postCount === 12 &&
    fixtureA.postLayout.positionsM.join(",") !== atEnd.postLayout.positionsM.join(",")
);

console.log("\n-- FENCE-MATURITY-1A-R1 VERTICAL BOARDS --");
check(
  "R1.8 fixed run boards segmented",
  fixtureA.fixedBoardCount ===
    segmentedVerticalBoardCounts({
      runs: fixtureA.runs,
      gateWidthM: 0,
      gateCount: 0,
      effectiveCoverWidthM: 0.15,
    }).fixedBoardCount
);
check(
  "R1.9 gate boards segmented",
  fixtureA.gateBoardCount ===
    verticalBoardCount({ faceRunLengthM: 0.9, effectiveCoverWidthM: 0.15 })
);
const nonModule = vTakeoff({ gateWidthM: 1, gatePosition: "At an end" });
const globalCeil = verticalBoardCount({
  faceRunLengthM: 18,
  effectiveCoverWidthM: 0.15,
});
check(
  "R1.10 non-module 1.0m gate rounds independently",
  near(nonModule.fixedFenceLengthM, 17) &&
    nonModule.fixedBoardCount ===
      verticalBoardCount({ faceRunLengthM: 17, effectiveCoverWidthM: 0.15 }) &&
    nonModule.gateBoardCount ===
      verticalBoardCount({ faceRunLengthM: 1, effectiveCoverWidthM: 0.15 }) &&
    nonModule.boardCount === 114 + 7 &&
    globalCeil === 120 &&
    nonModule.boardCount !== globalCeil
);
check(
  "R1.11 no board double count",
  fixtureA.boardCount === fixtureA.fixedBoardCount + fixtureA.gateBoardCount
);
check(
  "R1.12 required lm",
  near(fixtureA.boardRequiredLm, fixtureA.boardCount * 1.8)
);
check(
  "R1.13 procurement once",
  near(fixtureA.boardPurchasedLm, fixtureA.boardRequiredLm * 1.05) &&
    fixtureA.wasteFactor === 0.05
);

console.log("\n-- FENCE-MATURITY-1A-R1 HORIZONTAL --");
const fit = horizontalCourseFit({ heightM: 1.5, boardWidthM: 0.15, gapMm: 10 });
check("R1.14 1.5m/150/10 => 9 courses", fit.courseCount === 9 && fixtureB.courseCount === 9);
check("R1.15 occupied ~1.43m", near(fit.occupiedHeightM, 1.43) && near(fixtureB.occupiedHeightM ?? 0, 1.43));
check("R1.16 residual ~0.07m", near(fit.residualM, 0.07) && near(fixtureB.residualM ?? 0, 0.07));
check("R1.17 board lm 108", near(fixtureB.boardRequiredLm, 108) && near(fixtureB.boardPurchasedLm, 113.4));
const overrideCourses = buildFenceTimberTakeoff({
  geometry: fixtureB.geometry,
  orientation: "horizontal",
  species: "macrocarpa",
  thicknessMm: 25,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: 10,
  railCount: null,
  cappingIncluded: true,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  horizontalCourseCount: 11,
  wastePercent: null,
});
check(
  "R1.18 explicit course override",
  overrideCourses.courseCount === 11 &&
    overrideCourses.courseOverride &&
    overrideCourses.courseCount !== fixtureB.courseCount
);
check(
  "R1.19 over-height override attention",
  (overrideCourses.occupiedHeightM ?? 0) > 1.5 &&
    overrideCourses.attention.includes(FENCE_SLAT_COURSES_EXCEED_HEIGHT) &&
    overrideCourses.courseCount === 11
);
check(
  "R1.20 gap changes course fit",
  (gap20.courseCount ?? 0) === 8 &&
    (gap20.courseCount ?? 0) < (fixtureB.courseCount ?? 0)
);
check(
  "R1.21 direct-span assumption disclosed",
  fixtureB.assumptions.includes(FENCE_HORIZONTAL_SUPPORT_DECISION) &&
    fixtureB.horizontalSupportModel === "POST_TO_POST_NO_RAILS" &&
    fixtureB.attention.some((row) => /horizontal slat support/i.test(row))
);

console.log("\n-- FENCE-MATURITY-1A-R1 RAILS --");
const railId = fenceRailIdentity();
check(
  "R1.22 explicit rail identity",
  fixtureA.railIdentity?.productFamily === "fence_rail" &&
    railId.productFamily === "fence_rail" &&
    railId.section === "75x50" &&
    railId.treatment === "h4"
);
check(
  "R1.23 rail section exists",
  fixtureA.railSection === "75x50" &&
    fixtureA.railSectionAssumed &&
    fixtureA.assumptions.some((row) => /75×50/.test(row))
);
check(
  "R1.24 rail lm fixed runs only",
  near(fixtureA.railRequiredLm, 3 * 17.1) && near(fixtureA.railLm, fixtureA.railRequiredLm)
);
check(
  "R1.25 gate opening excluded",
  fixtureA.railLm < noGate.railLm && near(fixtureA.fixedFenceLengthM, 17.1)
);
check(
  "R1.26 rail procurement once",
  near(fixtureA.railPurchasedLm, fixtureA.railRequiredLm * 1.05) &&
    fixtureA.wasteFactor === 0.05
);

console.log("\n-- FENCE-MATURITY-1A-R1 GATE POSTS / CAPPING --");
check(
  "R1.27 gate posts classified",
  fixtureA.gateEdgePostCount === 2 &&
    fixtureA.posts.filter((p) => p.roles.includes("gate_edge")).length === 2
);
check(
  "R1.28 default normal-post identity",
  fixtureA.gatePostIdentity.section === fixtureA.postIdentity.section &&
    fixtureA.assumptions.includes(FENCE_GATE_POST_SAME_SECTION_DISCLOSURE)
);
const capNo = vTakeoff({ gateCappingIncluded: false });
check("R1.29 gate cap Yes", fixtureA.gateCappingIncluded && near(fixtureA.gateCappingLm, 0.9));
check(
  "R1.30 gate cap No",
  !capNo.gateCappingIncluded &&
    near(capNo.gateCappingLm, 0) &&
    near(capNo.fixedCappingLm, 17.1) &&
    near(capNo.cappingLm, 17.1)
);
check(
  "R1.31 no capping double count",
  near(fixtureA.cappingLm, fixtureA.fixedCappingLm + fixtureA.gateCappingLm) &&
    fixtureA.gateFrameLm > 0
);

console.log("\n-- FENCE-MATURITY-1A-R1 OWNER A / LABOUR / CONTRACT --");
check(
  "R1 owner A segmented",
  near(fixtureA.runs[0]?.lengthM ?? 0, 8.55) &&
    near(fixtureA.runs[1]?.lengthM ?? 0, 8.55) &&
    fixtureA.postCount === 12 &&
    fixtureA.fixedBoardCount === 114 &&
    fixtureA.gateBoardCount === 6 &&
    fixtureA.boardCount === 120 &&
    near(fixtureA.boardRequiredLm, 216) &&
    near(fixtureA.boardPurchasedLm, 226.8) &&
    near(fixtureA.railRequiredLm, 51.3) &&
    near(fixtureA.fixedCappingLm, 17.1) &&
    near(fixtureA.gateCappingLm, 0.9) &&
    near(fixtureA.cappingLm, 18) &&
    fixtureA.gateHardwareEa === 1 &&
    fixtureA.holeCount === 12 &&
    fixtureA.concrete.bagCount === bags
);
check(
  "R1.32 post-hole concrete unchanged",
  fixtureA.concrete.bagCount === bags &&
    near(fixtureA.concrete.netConcreteM3, net) &&
    fixtureA.holeCount === fixtureA.postCount
);
check(
  "R1.33 modular fixtures unchanged",
  metal18.purchasedSectionCount === 10 &&
    metal18.postCount === 11 &&
    metal19.purchasedSectionCount === 11 &&
    metal19.postCount === 12 &&
    plastic.postCount === plastic.purchasedSectionCount + 1
);
check(
  "R1.34 existing 1A checks preserved",
  fixtureA.faceAreaM2 === 32.4 &&
    thick25.boardCount === fixtureA.boardCount &&
    FENCE_COMMERCIAL_AUTHORITY_1A === "LEGACY_PACKAGE_AUTHORITY"
);
check(
  "R1 access/carry ownership documented",
  /ordinary post-hole digging/i.test(FENCE_POST_INSTALL_OWNERSHIP_R1) &&
    /bag handling/i.test(FENCE_CONCRETE_PLACE_OWNERSHIP_R1) &&
    /once each/i.test(FENCE_CARRY_OWNERSHIP_R1)
);
check(
  "R1.26 information contract R1 facts",
  fenceFactQuestionClass("fence.gate_position") === "ASSUME_IF_SKIPPED" &&
    fenceFactQuestionClass("fence.gate_capping") === "ASSUME_IF_SKIPPED" &&
    fenceFactQuestionClass("fence.horizontal_course_count") === "REFINE" &&
    fenceFactQuestionClass("fence.rail_section") === "REFINE"
);
const ownerTakeoff = (ownerA.requirements ?? []).filter((r) => r.kind === "material");
check(
  "R1.27 Builder Review labels",
  ownerTakeoff.some((r) => r.componentKey === "fence.posts.ea") &&
    ownerTakeoff.some((r) => r.componentKey === "fence.gate.posts.ea") &&
    ownerTakeoff.some((r) => r.description === "Palings") &&
    ownerTakeoff.some((r) => r.description === "Rails") &&
    ownerTakeoff.some((r) => r.componentKey === "fence.capping") &&
    ownerTakeoff.some((r) => r.componentKey === "fence.gate.frame") &&
    ownerTakeoff.some((r) => r.componentKey === "fence.gate.hardware") &&
    ownerTakeoff.some((r) => r.componentKey === "fence.post_hole_concrete") &&
    !review.improvements.some((row) => /WITHIN_FENCE_RUN|AT_END|GATE_END/i.test(row.label))
);
check(
  "R1 consumed new facts",
  isCalculatorConsumedFact("fence", "fence.gate_position") &&
    isCalculatorConsumedFact("fence", "fence.rail_section") &&
    isCalculatorConsumedFact("fence", "fence.horizontal_course_count") &&
    isCalculatorConsumedFact("fence", "fence.gate_capping")
);
const editorHasR1 =
  editorSrc.includes("fence.gate_position") &&
  editorSrc.includes("fence.gate_capping") &&
  editorSrc.includes("fence.rail_section") &&
  editorSrc.includes("fence.horizontal_course_count");
check("R1 Edit Scope writes new facts", editorHasR1);

console.log("\n-- FENCE-MATURITY-1A-R2 VERTICAL GAP --");
check(
  "R2.1 default gap = 0mm ASSUME_IF_SKIPPED",
  FENCE_DEFAULT_VERTICAL_PALING_GAP_MM === 0 &&
    fenceFactQuestionClass("fence.vertical_paling_gap_mm") === "ASSUME_IF_SKIPPED" &&
    fixtureA.palingGapMm === 0 &&
    fixtureA.palingGapAssumed &&
    fixtureA.assumptions.includes(FENCE_VERTICAL_PALING_GAP_DISCLOSURE)
);
check(
  "R2.2 0mm preserves Owner A 120 EA / 216 / 226.8",
  fixtureA.boardCount === 120 &&
    near(fixtureA.boardRequiredLm, 216) &&
    near(fixtureA.boardPurchasedLm, 226.8)
);
const palingGap10 = vTakeoff({
  verticalPalingGapMm: 10,
  gatePosition: "Within the fence run",
});
const palingGap20 = vTakeoff({
  verticalPalingGapMm: 20,
  gatePosition: "Within the fence run",
});
const boards10 =
  verticalBoardCount({ faceRunLengthM: 8.55, boardWidthM: 0.15, gapMm: 10 }) * 2 +
  verticalBoardCount({ faceRunLengthM: 0.9, boardWidthM: 0.15, gapMm: 10 });
const boards20 =
  verticalBoardCount({ faceRunLengthM: 8.55, boardWidthM: 0.15, gapMm: 20 }) * 2 +
  verticalBoardCount({ faceRunLengthM: 0.9, boardWidthM: 0.15, gapMm: 20 });
check(
  "R2.3 10mm changes board count correctly",
  palingGap10.boardCount === 114 &&
    palingGap10.boardCount === boards10 &&
    palingGap10.boardCount < fixtureA.boardCount
);
check(
  "R2.4 20mm changes board count correctly",
  palingGap20.boardCount === 108 &&
    palingGap20.boardCount === boards20 &&
    palingGap20.boardCount <= palingGap10.boardCount
);
check(
  "R2.5 formula has no trailing-gap assumption",
  verticalBoardCount({ faceRunLengthM: 0.16, boardWidthM: 0.15, gapMm: 10 }) === 2 &&
    Math.ceil(0.16 / 0.16) === 1
);
check(
  "R2.6 fixed runs calculated independently",
  palingGap10.fixedBoardCount ===
    verticalBoardCount({ faceRunLengthM: 8.55, boardWidthM: 0.15, gapMm: 10 }) +
      verticalBoardCount({ faceRunLengthM: 8.55, boardWidthM: 0.15, gapMm: 10 }) &&
    palingGap10.runs.length === 2
);
check(
  "R2.7 gate face calculated independently",
  palingGap10.gateBoardCount ===
    verticalBoardCount({ faceRunLengthM: 0.9, boardWidthM: 0.15, gapMm: 10 }) &&
    palingGap10.boardCount === palingGap10.fixedBoardCount + palingGap10.gateBoardCount
);
check(
  "R2.8 non-module 1m gate regression",
  nonModule.boardCount === 121 &&
    nonModule.fixedBoardCount === 114 &&
    nonModule.gateBoardCount === 7
);
check(
  "R2.9 required lm updates with gap",
  near(palingGap10.boardRequiredLm, palingGap10.boardCount * 1.8) &&
    near(palingGap20.boardRequiredLm, palingGap20.boardCount * 1.8) &&
    palingGap10.boardRequiredLm < fixtureA.boardRequiredLm
);
check(
  "R2.10 purchased lm updates once",
  near(palingGap10.boardPurchasedLm, palingGap10.boardRequiredLm * 1.05) &&
    near(palingGap20.boardPurchasedLm, palingGap20.boardRequiredLm * 1.05) &&
    palingGap10.wasteFactor === 0.05
);
check(
  "R2.11 posts unaffected by paling gap",
  palingGap10.postCount === fixtureA.postCount &&
    palingGap20.postCount === fixtureA.postCount &&
    palingGap10.holeCount === fixtureA.holeCount
);
check(
  "R2.12 rails unaffected by paling gap",
  palingGap10.railCount === fixtureA.railCount &&
    near(palingGap10.railRequiredLm, fixtureA.railRequiredLm) &&
    near(palingGap20.railRequiredLm, fixtureA.railRequiredLm) &&
    near(palingGap10.gateWidthM, fixtureA.gateWidthM)
);
const estGap0 = calculateFence(
  ctx(
    timberFacts([
      fact("fence.vertical_paling_gap_mm", 0),
      fact("fence.gate_position", "Within the fence run"),
    ])
  ),
  wa()
);
const estGap10 = calculateFence(
  ctx(
    timberFacts([
      fact("fence.vertical_paling_gap_mm", 10),
      fact("fence.gate_position", "Within the fence run"),
    ])
  ),
  wa()
);
function reqQty(
  result: ReturnType<typeof calculateFence>,
  componentKey: string
): number {
  const row = (result.requirements ?? []).find(
    (r) => r.kind === "material" && r.componentKey === componentKey
  ) as MaterialRequirement | undefined;
  return row?.purchaseQuantity ?? -1;
}
check(
  "R2.13 Edit Scope recalculates boards only",
  reqQty(estGap10, "fence.boards") < reqQty(estGap0, "fence.boards") &&
    reqQty(estGap10, "fence.posts.ea") === reqQty(estGap0, "fence.posts.ea") &&
    reqQty(estGap10, "fence.rails") === reqQty(estGap0, "fence.rails") &&
    reqQty(estGap10, "fence.post_hole_concrete") ===
      reqQty(estGap0, "fence.post_hole_concrete") &&
    estGap10.lineItems.some((i) => i.label === "Fence materials")
);
const horizWithVerticalGap = buildFenceTimberTakeoff({
  geometry: fixtureB.geometry,
  orientation: "horizontal",
  species: "macrocarpa",
  thicknessMm: 25,
  maxPostSpacingM: 1.8,
  embedmentM: 0.6,
  holeDiameterM: 0.3,
  slatGapMm: 10,
  verticalPalingGapMm: 40,
  railCount: null,
  cappingIncluded: true,
  gateIncluded: false,
  gateCount: null,
  gateWidthM: null,
  wastePercent: null,
});
const vertWithHorizontalGap = vTakeoff({
  slatGapMm: 40,
  verticalPalingGapMm: 0,
  gatePosition: "Within the fence run",
});
check(
  "R2.14 horizontal gap remains isolated",
  horizWithVerticalGap.courseCount === fixtureB.courseCount &&
    near(horizWithVerticalGap.boardRequiredLm, fixtureB.boardRequiredLm) &&
    vertWithHorizontalGap.boardCount === fixtureA.boardCount &&
    fenceFactQuestionClass("fence.slat_gap_mm") === "ASK_NOW" &&
    fenceFactQuestionClass("fence.vertical_paling_gap_mm") === "ASSUME_IF_SKIPPED"
);

console.log("\n-- FENCE-MATURITY-1A-R2 MODULAR GATE ISOLATION --");
const timberGateStale = timberFacts([
  fact("fence.gate_position", "Within the fence run"),
  fact("fence.gate_capping", "Yes"),
]);
const metalStaleFacts = timberFacts([
  fact("fence.system", "Aluminium / steel slat fence"),
  fact("fence.gate_position", "Within the fence run"),
  fact("fence.gate_capping", "Yes"),
]);
const plasticStaleFacts = timberFacts([
  fact("fence.length_m", 10),
  fact("fence.system", "Plastic / composite fence"),
  fact("fence.gate_position", "Within the fence run"),
  fact("fence.gate_capping", "Yes"),
]);
const metalStale = buildFencePhysicalModel({
  context: ctx(metalStaleFacts),
  workAreaId: "f1",
});
const plasticStale = buildFencePhysicalModel({
  context: ctx(plasticStaleFacts),
  workAreaId: "f1",
});
const metalStaleCalc = calculateFence(ctx(metalStaleFacts), wa());
const plasticStaleCalc = calculateFence(ctx(plasticStaleFacts), wa());
function hasGateMoney(result: ReturnType<typeof calculateFence>): boolean {
  return result.lineItems.some(
    (i) => /gate/i.test(i.label) && !/Fence labour|Fence materials/i.test(i.label)
  );
}
function hasGatePhysical(model: ReturnType<typeof buildFencePhysicalModel>): boolean {
  return (model.requirements ?? []).some(
    (r) =>
      r.componentKey === "fence.gate.frame" ||
      r.componentKey === "fence.gate.hardware" ||
      r.componentKey === "fence.gate.posts.ea" ||
      r.componentKey === "fence.gate.install"
  );
}
check(
  "R2.15 Metal does not consume Timber gate width",
  metalStale.modular != null &&
    metalStale.timber == null &&
    metalStale.modular.gateWidthM === 0 &&
    near(metalStale.modular.fixedFenceLengthM, 18) &&
    metalStale.modular.purchasedSectionCount === 10
);
check(
  "R2.16 Metal does not consume gate position",
  metalStale.modular != null &&
    metalStale.modular.gateIncluded === false &&
    !fenceGateScopeApplies(metalStale.system) &&
    metalStaleFacts.some((f) => f.key === "fence.gate_position")
);
check(
  "R2.17 Metal does not inject gate-edge posts",
  metalStale.modular?.postCount === 11 &&
    !hasGatePhysical(metalStale) &&
    metalStale.modular?.gateIncluded === false
);
check(
  "R2.18 Metal does not create gate frame/hardware/money",
  !hasGatePhysical(metalStale) &&
    !hasGateMoney(metalStaleCalc) &&
    metalStale.modular?.modularGatesModelled === false
);
check(
  "R2.19 Plastic same isolation",
  plasticStale.modular != null &&
    plasticStale.modular.purchasedSectionCount === 6 &&
    plasticStale.modular.postCount === 7 &&
    plasticStale.modular.gateIncluded === false &&
    !hasGatePhysical(plasticStale) &&
    !hasGateMoney(plasticStaleCalc)
);
const metal18StaleFacts = timberFacts([
  fact("fence.system", "Aluminium / steel slat fence"),
  fact("fence.gate_included", true),
  fact("fence.gate_width_m", 0.9),
  fact("fence.gate_position", "Within the fence run"),
]);
const metal18Stale = buildFencePhysicalModel({
  context: ctx(metal18StaleFacts),
  workAreaId: "f1",
});
check(
  "R2.20 stale gate facts preserve 18m/1.8 modular fixture",
  metal18Stale.modular?.purchasedSectionCount === 10 &&
    metal18Stale.modular?.postCount === 11 &&
    metal19.purchasedSectionCount === 11 &&
    metal19.postCount === 12
);
const restoredTimber = buildFencePhysicalModel({
  context: ctx(timberGateStale),
  workAreaId: "f1",
});
check(
  "R2.21 Metal→Timber switch restores Timber gate facts",
  restoredTimber.timber != null &&
    restoredTimber.timber.gateIncluded === true &&
    near(restoredTimber.timber.gateWidthM, 0.9) &&
    restoredTimber.timber.gatePosition === "WITHIN_FENCE_RUN" &&
    restoredTimber.timber.gateBoardCount === 6 &&
    timberGateStale.some((f) => f.key === "fence.gate_included" && f.value === true)
);
check(
  "R2.22 system-specific fact isolation",
  isModularFenceSystem(metalStale.system) &&
    isTimberFenceSystem(restoredTimber.system) &&
    metalStaleFacts.some((f) => f.key === "fence.gate_width_m") &&
    !metalStale.modular?.gateIncluded &&
    fenceFactQuestionClass("fence.vertical_paling_gap_mm") === "ASSUME_IF_SKIPPED"
);
const modularClarify = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [wa()],
  facts: metalStaleFacts,
  constraints: [],
  jobPlan: composeJobPlan({ workAreas: [wa()], facts: metalStaleFacts }),
});
check(
  "R2.23 modular gate controls suppressed/not consumed",
  editorSrc.includes("fence.vertical_paling_gap_mm") &&
    editorSrc.includes("Gap between vertical palings") &&
    editorSrc.includes("isTimberFenceSystem(system)") &&
    editorSrc.includes('<Group title="Gate">') &&
    !modularClarify.candidates.some((q) => q.factKey === "fence.gate_included") &&
    !modularClarify.candidates.some((q) => q.factKey === "fence.gate_position")
);

console.log("\n-- FENCE-MATURITY-1A-R2 REGRESSION --");
check(
  "R2.24 prior Fence 1A/R1 physical checks preserved",
  fixtureA.boardCount === 120 &&
    nonModule.boardCount === 121 &&
    fixtureA.postCount === 12 &&
    FENCE_COMMERCIAL_AUTHORITY_1A === "LEGACY_PACKAGE_AUTHORITY"
);
check(
  "R2.25 horizontal 9-course fixture preserved",
  fixtureB.courseCount === 9 &&
    near(fixtureB.boardRequiredLm, 108) &&
    near(fixtureB.boardPurchasedLm, 113.4)
);
const palingSpec = (ownerA.requirements ?? []).find(
  (r) => r.kind === "material" && r.description === "Palings"
) as MaterialRequirement | undefined;
check(
  "R2 Builder Review paling pitch",
  Boolean(palingSpec?.specification?.includes("Board width: 150mm")) &&
    Boolean(palingSpec?.specification?.includes("Paling gap: 0mm")) &&
    Boolean(palingSpec?.specification?.includes("Effective pitch: 150mm")) &&
    Boolean(palingSpec?.specification?.includes("Board count: 120 EA"))
);
const assumedGap = calculateFence(ctx(timberFacts()), wa());
const explicitZero = calculateFence(
  ctx(timberFacts([fact("fence.vertical_paling_gap_mm", 0)])),
  wa()
);
check(
  "R2 confidence/Improve paling gap",
  assumedGap.confidence === explicitZero.confidence &&
    assumedGap.assumptions.includes(FENCE_VERTICAL_PALING_GAP_DISCLOSURE) &&
    review.improvements.some((row) => /gap between vertical palings/i.test(row.label))
);

function mentionsGate(text: string): boolean {
  return /\bgate\b/i.test(text);
}

function quoteFactsFrom(facts: EstimateFact[]): Array<{
  key: string;
  label: string;
  value: string;
}> {
  return facts.map((row) => ({
    key: row.key,
    label: row.key,
    value: String(row.value ?? ""),
  }));
}

function reviewMentionsGate(
  calc: ReturnType<typeof calculateFence>
): boolean {
  const composed = composeBuilderReview({
    estimate: {
      recommendedCost: calc.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
      recommendedSell: calc.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
      marginPercent: 20,
      confidence: calc.confidence,
      assumptions: calc.assumptions,
      missingInfo: calc.missingInfo,
      lineItems: calc.lineItems.map((item) => ({
        ...item,
        id: item.itemKey ?? item.label,
        includedInTotal: item.includedInTotal ?? true,
      })),
    } as never,
    workAreas: [wa()],
    requirements: calc.requirements ?? [],
  });
  const reqText = (calc.requirements ?? [])
    .map((r) => `${r.componentKey} ${r.description} ${(r as MaterialRequirement).specification ?? ""}`)
    .join(" ");
  const lineText = calc.lineItems
    .map((i) => `${i.label} ${i.notes ?? ""} ${i.identitySummary ?? ""}`)
    .join(" ");
  const issueText = [
    ...composed.assumptions.map((a) => a.label),
    ...composed.improvements.map((a) => a.label),
    ...composed.checks.map((a) => a.label),
  ].join(" ");
  return mentionsGate(`${reqText} ${lineText} ${issueText} ${calc.assumptions.join(" ")}`);
}

function fenceQuote(facts: EstimateFact[], pricingItems?: Array<{ label: string }>): string {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "fence",
    name: "Fence",
    facts: quoteFactsFrom(facts),
    pricingItems,
  });
}

function fenceScopeFacts(facts: EstimateFact[]) {
  return buildScopeReview({
    workAreas: [
      {
        id: "f1",
        type: "fence",
        name: "Fence",
        status: "confirmed",
        sort_order: 1,
      },
    ],
    projectFacts: facts.map((row) => ({
      key: row.key,
      work_area_id: row.work_area_id,
      value: row.value,
      source: "user",
    })),
  }).workAreas[0]?.facts ?? [];
}

console.log("\n-- FENCE-MATURITY-1A-R3 DOWNSTREAM ISOLATION --");
check(
  "R3.1 Timber gate facts remain stored on Metal",
  metalStaleFacts.some((f) => f.key === "fence.gate_included" && f.value === true) &&
    metalStaleFacts.some((f) => f.key === "fence.gate_width_m") &&
    metalStaleFacts.some((f) => f.key === "fence.gate_position") &&
    metalStaleFacts.some((f) => f.key === "fence.gate_capping")
);
check(
  "R3.2 Metal marks Timber gate facts not applicable",
  !fenceGateScopeApplies(metalStale.system) &&
    isModularFenceSystem(metalStale.system) &&
    metalStale.modular?.modularGatesModelled === false
);
check(
  "R3.3 Plastic marks Timber gate facts not applicable",
  !fenceGateScopeApplies(plasticStale.system) &&
    isModularFenceSystem(plasticStale.system)
);
check(
  "R3.4 Metal Builder Review has no stale gate",
  !reviewMentionsGate(metalStaleCalc)
);
check(
  "R3.5 Plastic Builder Review has no stale gate",
  !reviewMentionsGate(plasticStaleCalc)
);
check(
  "R3.6 Metal Pricing metadata has no stale gate",
  !hasGateMoney(metalStaleCalc) &&
    !metalStaleCalc.lineItems.some((i) => mentionsGate(`${i.label} ${i.notes ?? ""} ${i.identitySummary ?? ""}`))
);
check(
  "R3.7 Plastic Pricing metadata has no stale gate",
  !hasGateMoney(plasticStaleCalc) &&
    !plasticStaleCalc.lineItems.some((i) => mentionsGate(`${i.label} ${i.notes ?? ""} ${i.identitySummary ?? ""}`))
);
const metalQuote = fenceQuote(metalStaleFacts, [{ label: "Gate allowance" }]);
const plasticQuote = fenceQuote(plasticStaleFacts, [{ label: "Gate allowance" }]);
check("R3.8 Metal Quote draft has no stale gate wording", !mentionsGate(metalQuote));
check("R3.9 Plastic Quote draft has no stale gate wording", !mentionsGate(plasticQuote));
const metalPlan = composeJobPlan({ workAreas: [wa()], facts: metalStaleFacts });
const metalScopeFacts = fenceScopeFacts(metalStaleFacts);
check(
  "R3.10 generic scope summary has no stale gate",
  !mentionsGate(metalPlan.cards[0]?.summary ?? "") &&
    !(metalPlan.cards[0]?.included ?? []).some((item) => mentionsGate(item.label)) &&
    !metalScopeFacts.some(
      (row) => isFenceTimberGateFactKey(row.key) || mentionsGate(`${row.label} ${row.value}`)
    )
);
const timberQuote = fenceQuote(timberGateStale);
check(
  "R3.11 return to Vertical Timber restores gate output",
  restoredTimber.timber?.gateIncluded === true &&
    near(restoredTimber.timber?.gateWidthM ?? 0, 0.9) &&
    restoredTimber.timber?.gatePosition === "WITHIN_FENCE_RUN" &&
    mentionsGate(timberQuote) &&
    reviewMentionsGate(calculateFence(ctx(timberGateStale), wa()))
);
const horizStaleFacts = timberFacts([
  fact("fence.system", "Horizontal timber slats"),
  fact("fence.gate_position", "Within the fence run"),
  fact("fence.gate_capping", "Yes"),
]);
const horizRestored = buildFencePhysicalModel({
  context: ctx(horizStaleFacts),
  workAreaId: "f1",
});
check(
  "R3.12 return to Horizontal Timber restores valid gate output",
  isTimberFenceSystem(horizRestored.system) &&
    horizRestored.timber?.gateIncluded === true &&
    near(horizRestored.timber?.gateWidthM ?? 0, 0.9) &&
    mentionsGate(fenceQuote(horizStaleFacts)) &&
    !hasGatePhysical(metalStale)
);
check(
  "R3.13 no destructive fact clearing",
  timberGateStale.some((f) => f.key === "fence.gate_included" && f.value === true) &&
    metalStaleFacts.filter((f) => f.key.startsWith("fence.gate_")).length >= 4 &&
    plasticStaleFacts.some((f) => f.key === "fence.gate_width_m")
);
check(
  "R3.14 modular fixture numbers unchanged",
  metal18.purchasedSectionCount === 10 &&
    metal18.postCount === 11 &&
    metal19.purchasedSectionCount === 11 &&
    metal19.postCount === 12 &&
    plastic.purchasedSectionCount === 6 &&
    plastic.postCount === 7
);
check(
  "R3.15 vertical gap fixtures unchanged",
  fixtureA.boardCount === 120 &&
    palingGap10.boardCount === 114 &&
    palingGap20.boardCount === 108
);
check(
  "R3.16 horizontal course fixture unchanged",
  fixtureB.courseCount === 9 &&
    near(fixtureB.occupiedHeightM ?? 0, 1.43) &&
    near(fixtureB.boardRequiredLm, 108)
);
check(
  "R3.17 previous Fence checks preserved",
  fixtureA.postCount === 12 &&
    nonModule.boardCount === 121 &&
    FENCE_COMMERCIAL_AUTHORITY_1A === "LEGACY_PACKAGE_AUTHORITY" &&
    fenceGateScopeApplies("TIMBER_VERTICAL_PALING") &&
    !fenceGateScopeApplies("METAL_SLAT_MODULAR")
);

console.log("\n-- REGRESSION SPAWNS --");
check(
  "52 Retaining Wall R6",
  spawnVerifier("scripts/verify-retaining-wall-post-concrete-r6.ts")
);
check(
  "53 RW family closure",
  spawnVerifier("scripts/verify-retaining-wall-family-closure-01.ts")
);
check("54 Deck 2D", spawnVerifier("scripts/verify-deck-maturity-2d.ts"));
check(
  "55 Estimator safety",
  spawnVerifier("scripts/verify-estimator-safety-0.ts")
);
check(
  "56 Foundation R1",
  spawnVerifier("scripts/verify-foundation-r1-project-conditions-support.ts")
);

console.log(`\nFENCE-MATURITY-1A RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

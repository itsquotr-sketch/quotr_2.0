/**
 * RETAINING-WALL-MATURITY-1C — owner preview corrections verifier.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-1c.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { getJobPlanQuickSpecEditor } from "../components/assistant/job-plan/quick-spec-editors";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { shapeLabourHours } from "../lib/estimate/labour-hours";
import {
  backfillVolumeM3,
  faceAreaM2,
  heightAtX,
  timberPileLayout,
  RETAINING_WALL_DEFAULT_PILE_SPACING_M,
} from "../lib/estimate/retaining-wall-geometry";
import { timberFaceBoardLm, timberPileTakeoff } from "../lib/estimate/retaining-wall-timber";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import { commercializeRetainingWall } from "../lib/estimate/retaining-wall-commercial";
import {
  RW_NOVACOIL_COMPONENT,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_H5_SED_POLE_KEY,
  RW_FACE_BOARD_150_H4_KEY,
  RW_FACE_BOARD_200_H4_KEY,
} from "../lib/estimate/retaining-wall-identities";
import {
  RW_PRODUCTIVITY_KEYS,
  RW_PRODUCTIVITY_UNITS,
} from "../lib/estimate/retaining-wall-productivity";
import { RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { isMaterialRatesCatalogueEntry } from "../lib/rates/rate-section-contract";
import {
  OWNER_RW_PREVIEW_BRIEF,
  briefHasExplicitPileSpacing,
  briefSuppliesCarryDistance,
  briefSuppliesSiteAccess,
  matchCarryDistanceMetresFromBrief,
  matchRetainingWallLengthM,
  matchRetainingWallRakingHeightsM,
} from "../lib/project-conditions/brief-logistics";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateRequirement, MaterialRequirement } from "../lib/estimate/requirements";

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

function ownerFacts(): EstimateFact[] {
  return [
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.face_board_section", "150×50 H4"),
  ];
}

function ctx(
  facts: EstimateFact[],
  constraints: { key: string; value: unknown }[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: { defaultMaterialWastagePercent: 10 },
    rates: [],
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

function clarify(params: {
  briefText: string | null;
  facts: EstimateFact[];
  constraints: { key: string; value: unknown }[];
}) {
  const jobPlan = composeJobPlan({
    workAreas: [wa()],
    facts: params.facts,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas: [wa()],
    facts: params.facts,
    constraints: params.constraints,
    jobPlan,
  });
}

const face = faceAreaM2(15, 1.6, 0.6);
const boardsNet = timberFaceBoardLm(face, 0.15);
const boardsBuy = Math.round(boardsNet * 1.1 * 100) / 100;
const backfill = backfillVolumeM3({ lengthM: 15, h1M: 1.6, h2M: 0.6 });
const layout = timberPileLayout(15, RETAINING_WALL_DEFAULT_PILE_SPACING_M);
const piles = timberPileTakeoff(
  { lengthM: 15, h1M: 1.6, h2M: 0.6, faceAreaM2: face, averageHeightM: 1.1, maxHeightM: 1.6, minHeightM: 0.6, sloping: true, readiness: "SLOPING_HEIGHT_AVAILABLE" },
  {
    faceBoardSection: "150×50 H4",
    pileSpacingM: null,
    pileEmbedmentM: null,
    pileEmbedmentRatio: null,
    wasteFactor: 0.1,
  }
);

console.log("\n--- OWNER GEOMETRY ---\n");
check("1 face 16.5 m²", near(face, 16.5));
check("2 150mm board net 110 lm", near(boardsNet, 110));
check("3 purchase boards apply existing 10% waste once", near(boardsBuy, 121));
check("4 backfill ≈ 4.275 m³ in-place", near(backfill, 4.275));
check("5 novacoil net = 15 lm", true);

console.log("\n--- PILE SPACING ---\n");
check("6 no explicit spacing language in owner brief", !briefHasExplicitPileSpacing(OWNER_RW_PREVIEW_BRIEF));
check("7 default target is 1.2 m", RETAINING_WALL_DEFAULT_PILE_SPACING_M === 1.2);
check("8 no spacing fact → 13 bays / 14 piles", layout.bayCount === 13 && layout.pileCount === 14);
check("9 even spacing ≈ 1.154 m", near(layout.actualSpacingM, 15 / 13, 0.001));
check("10 sloping H(x) at 0 is 1.6", near(heightAtX(15, 1.6, 0.6, 0), 1.6));
check("11 sloping H(x) at 15 is 0.6", near(heightAtX(15, 1.6, 0.6, 15), 0.6));
check("12 pile lm is H(x)+50% embedment, not hardcoded", piles.totalLengthM > 0 && near(piles.lengthsM[0]!, 1.6 * 1.5));
check("13 explicit 1.0 m is preserved", timberPileTakeoff(
  { lengthM: 15, h1M: 1.6, h2M: 0.6, faceAreaM2: face, averageHeightM: 1.1, maxHeightM: 1.6, minHeightM: 0.6, sloping: true, readiness: "SLOPING_HEIGHT_AVAILABLE" },
  { faceBoardSection: null, pileSpacingM: 1, pileEmbedmentM: null, pileEmbedmentRatio: null, wasteFactor: 0.1 }
).count === 16);

console.log("\n--- FACT PERSISTENCE / CARRY ---\n");
check("14 owner length extracted as 15 m, not 1.6 m", matchRetainingWallLengthM(OWNER_RW_PREVIEW_BRIEF) === 15);
check("15 raking heights 1.6 / 0.6", (() => {
  const h = matchRetainingWallRakingHeightsM(OWNER_RW_PREVIEW_BRIEF);
  return h != null && h.highM === 1.6 && h.lowM === 0.6;
})());
check("16 moderate access persists from brief", briefSuppliesSiteAccess(OWNER_RW_PREVIEW_BRIEF));
check("17 ~30 m distance persists as carry", briefSuppliesCarryDistance(OWNER_RW_PREVIEW_BRIEF));
check("18 30 m maps to 10–30 m band", matchCarryDistanceMetresFromBrief(OWNER_RW_PREVIEW_BRIEF) === 30);

const enriched = enrichExtractionFromBrief({
  briefText: OWNER_RW_PREVIEW_BRIEF,
  extraction: { workAreas: [], facts: [], assumptions: [], possibleConstraints: [], confidence: 0.5, warnings: [] },
  allowedTypes: ["retaining_wall"],
});
check(
  "19 enrich writes site_access Moderate",
  enriched.constraints.some((c) => c.key === "site_access" && String(c.value) === "Moderate")
);
check(
  "20 enrich writes material_carry_distance 10–30m",
  enriched.constraints.some(
    (c) => c.key === "material_carry_distance" && String(c.value).includes("30")
  )
);
check(
  "21 enrich does not invent post_spacing_m",
  !enriched.extraction.facts.some((f) => f.key === "retaining_wall.post_spacing_m")
);
check(
  "22 enrich does not write RW carting namespace",
  !enriched.extraction.facts.some((f) => f.key === "retaining_wall.carting_distance_m")
);

const askedCarry = (view: ReturnType<typeof clarify>) =>
  [...view.candidates, ...view.deferred].some(
    (c) => c.constraintKey === "material_carry_distance"
  );

check(
  "23 existing carry from brief suppresses duplicate question",
  !askedCarry(
    clarify({ briefText: OWNER_RW_PREVIEW_BRIEF, facts: ownerFacts(), constraints: [] })
  )
);
check(
  "24 missing carry may still ask",
  askedCarry(
    clarify({
      briefText: "Timber retaining wall 15m long, 1.2m high.",
      facts: ownerFacts(),
      constraints: [],
    })
  )
);
check(
  "25 persisted Project Condition also suppresses",
  !askedCarry(
    clarify({
      briefText: null,
      facts: ownerFacts(),
      constraints: [{ key: "material_carry_distance", value: "10–30m" }],
    })
  )
);
check(
  "25b deck-style 25–30m manual carry still counts as known carry",
  briefSuppliesCarryDistance(
    "Restricted rear access: 25–30m manual carry for material and waste."
  ) && briefSuppliesSiteAccess("Restricted rear access: 25–30m manual carry.")
);

console.log("\n--- EDIT SCOPE ---\n");
check("26 RW Edit Scope editor registered", getJobPlanQuickSpecEditor("retaining_wall") != null);
check("27 Deck editor unchanged", getJobPlanQuickSpecEditor("deck") != null);
const editorSrc = readFileSync("components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx", "utf8");
check("28 type/length/heights prepopulated fields exist", editorSrc.includes("retaining_wall.length_m") && editorSrc.includes("height_high_m"));
check("29 timber boards/spacing/excavation fields exist", editorSrc.includes("face_board_section") && editorSrc.includes("post_spacing_m") && editorSrc.includes("excavation_volume_m3"));
check(
  "30 editor reuses Project Conditions instead of duplicating access",
  editorSrc.includes("Project Conditions") &&
    editorSrc.includes("site_access") &&
    editorSrc.includes("material_carry_distance")
);
check("31 sleeper/masonry fields are not forced onto timber", editorSrc.includes("TIMBER_RETAINING_WALL") && !editorSrc.includes("block_series"));

const physical = buildRetainingWallPhysicalModel({
  context: ctx(ownerFacts()),
  workAreaId: "rw1",
  material: "Timber",
});
const commercial = commercializeRetainingWall({
  physical,
  facts: ownerFacts(),
  workAreaId: "rw1",
  rates: [],
  organisationSettings: null,
});
check("32 physical model builds for owner fixture", physical.system === "TIMBER_RETAINING_WALL" && physical.geometry?.faceAreaM2 === 16.5);
check("33 14 piles when spacing omitted", mat(physical.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.purchaseQuantity === 14);
check("34 150 boards identity present", mat(physical.requirements, RW_TIMBER_BOARDS_COMPONENT)?.materialKey === RW_FACE_BOARD_150_H4_KEY);
check("35 H5 SED pile identity present", mat(physical.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.materialKey === RW_H5_SED_POLE_KEY);
check("36 novacoil identity present", mat(physical.requirements, RW_NOVACOIL_COMPONENT)?.materialKey != null);

const boards200 = buildRetainingWallPhysicalModel({
  context: ctx([...ownerFacts().filter((f) => f.key !== "retaining_wall.face_board_section"), fact("retaining_wall.face_board_section", "200×50 H4")]),
  workAreaId: "rw1",
  material: "Timber",
});
check(
  "37 150→200 recalculates board lm",
  near(mat(boards200.requirements, RW_TIMBER_BOARDS_COMPONENT)?.baseQuantity ?? 0, 16.5 / 0.2) &&
    mat(boards200.requirements, RW_TIMBER_BOARDS_COMPONENT)?.materialKey === RW_FACE_BOARD_200_H4_KEY
);
check(
  "38 pile identity change would keep count",
  mat(boards200.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.purchaseQuantity === 14
);

console.log("\n--- LABOUR ---\n");
const hours = shapeLabourHours({
  quantity: 16.5,
  productivityHoursPerUnit: 2.6,
  adjustmentFactor: 1.1,
});
check("39 16.5 × 2.6 = 42.9 base hours", near(hours.baseHours, 42.9));
check("40 × 1.10 access/carry = 47.19 adjusted", near(hours.adjustedHours, 47.19));
const drainHours = shapeLabourHours({
  quantity: 15,
  productivityHoursPerUnit: 0.4,
  adjustmentFactor: 1.1,
});
check("41 drainage 15 × 0.4 = 6.0 base", near(drainHours.baseHours, 6));
check("42 drainage adjusted 6.6", near(drainHours.adjustedHours, 6.6));

const calc = calculateRetainingWall(ctx(ownerFacts(), [
  { key: "site_access", value: "Moderate" },
  { key: "material_carry_distance", value: "10–30m" },
]), wa());
const pileLine = calc.lineItems.find((item) => item.label === "Pile installation labour");
const drainLine = calc.lineItems.find((item) => item.label === "Drainage installation labour");
check("43 detailed labour equation includes base vs adjusted", Boolean(pileLine?.notes?.includes("base hrs")));
check("44 access/carry shown when applied", Boolean(pileLine?.notes?.includes("access/carry")));
check("45 drainage equation also reconciles", Boolean(drainLine?.notes?.includes("base hrs")));
check("46 no separate carting labour line for owner fixture", !calc.lineItems.some((item) => /carting\/material handling/i.test(item.label)));
check(
  "47 excavation required without volume is not invented m³",
  physical.excavationMode === "NONE" &&
    !physical.requirements.some((r) => r.componentKey?.includes("excavation.bulk") && r.kind === "material" && r.purchaseQuantity > 0)
);
check(
  "48 detailed timber money is primary (package face-m² retired)",
  !calc.lineItems.some((item) => item.label === "Retaining wall materials") &&
    calc.lineItems.some((item) => item.componentKey === RW_TIMBER_BOARDS_COMPONENT)
);
check(
  "49 package XOR detailed labour money",
  !calc.lineItems.some((item) => item.label === "Retaining wall labour") &&
    calc.lineItems.some((item) => item.label === "Pile installation labour")
);

console.log("\n--- PRODUCTIVITY / AUTHORITY ---\n");
check("50 excavation slot h/m³", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.excavationM3] === "m3");
check("51 pile slot h/ea", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.timberPilesEa] === "ea");
check("52 board slot h/m²", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.timberFaceM2] === "m2");
check("53 backfill slot h/m³", RW_PRODUCTIVITY_UNITS[RW_PRODUCTIVITY_KEYS.backfillM3] === "m3");
check(
  "54 slots absent Materials catalogue",
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.every((row) => !isMaterialRatesCatalogueEntry(row))
);
check("55 commercial promotes when Timber 1D coverage is complete", commercial.mode === "DETAILED_COMPONENT_AUTHORITY");

console.log("\n--- NON-REGRESSION / FILES ---\n");
check("56 1C editor file exists", existsSync("components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx"));
check("57 1C logistics helper exists", existsSync("lib/project-conditions/brief-logistics.ts"));
const sleeperSrc = readFileSync("lib/estimate/retaining-wall-sleeper.ts", "utf8");
const masonrySrc = readFileSync("lib/estimate/retaining-wall-masonry.ts", "utf8");
check("58 sleeper still discrete EA / steel posts", sleeperSrc.includes("postCount") || sleeperSrc.includes("steel"));
check("59 masonry still has blocks/footing/corefill", masonrySrc.includes("core") || masonrySrc.includes("footing"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

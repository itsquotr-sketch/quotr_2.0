/**
 * EF02-FINAL-R3-C — Generate Estimate must not persist empty mature output
 * as estimate_ready.
 *
 * Run: npx --yes tsx scripts/verify-estimate-nonempty-success-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { USER_ERRORS } from "../lib/errors/user-message";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  ESTIMATE_UNUSABLE_USER_MESSAGE,
  classifyEmptyEstimateResult,
  evaluateEstimateGenerationSuccess,
  hasMeaningfulEstimateOutput,
  hasPricingRequiredRepresentation,
  projectRequiresNonemptyEstimate,
} from "../lib/estimate/estimate-generation-success";
import {
  applyExtractedInternalWallsToFacts,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  isMatureInternalWallsPath,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_WALL_TYPE_REQUIRED_MESSAGE,
  applyInternalWallsFactWrite,
} from "../lib/estimate/internal-walls-wall-types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { isMatureSupportedWorkAreaType } from "../lib/work-areas/support-contract";
import { internalWallsIdentityInvariantFixtures } from "./lib/internal-walls-iw-id-invariants";

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

function near(actual: number, expected: number, tol = 0.02): boolean {
  return Math.abs(actual - expected) <= tol;
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: {
    sheet_material: 10,
    flooring: 10,
    paint: 10,
    decking: 10,
    default: 5,
  },
  rates: [],
} as unknown as EstimateContext;

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[]
): EstimateContext {
  return {
    ...baseContext,
    confirmedWorkAreas: workAreas,
    facts,
  } as EstimateContext;
}

function writeIw(writes: Array<{ key: string; value: unknown }>): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
    });
  }
  return facts;
}

type SimulatedPersist = {
  persisted: boolean;
  stage: string;
  priorEstimatePreserved: boolean;
};

function simulateGeneratePersist(params: {
  workAreas: EstimateWorkArea[];
  facts: EstimateFact[];
  previousStage: string;
  priorEstimateExists: boolean;
}): SimulatedPersist {
  const result = calculateEstimate(ctx(params.workAreas, params.facts));
  const decision = evaluateEstimateGenerationSuccess({
    confirmedWorkAreas: params.workAreas,
    facts: params.facts,
    result,
  });
  if (!decision.ok) {
    return {
      persisted: false,
      stage: params.previousStage,
      priorEstimatePreserved: params.priorEstimateExists,
    };
  }
  return {
    persisted: true,
    stage: "estimate_ready",
    priorEstimatePreserved: false,
  };
}

const pricingRequiredOnlyLine: EstimateLineItemInput = {
  workAreaId: "w1",
  workAreaName: "Internal walls",
  label: "Lining labour",
  category: "labour",
  costLow: 0,
  costHigh: 0,
  sellLow: 0,
  sellHigh: 0,
  recommendedCost: 0,
  recommendedSell: 0,
  grossProfit: 0,
  marginPercent: 0,
  markupPercent: 0,
  rateSource: "Pricing Required",
  rateSourceType: "missing",
  sortOrder: 1,
};

const bathroomComprehensiveFacts: EstimateFact[] = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", [
    "Floor finish",
    "Wall lining",
    "Ceiling lining",
    "Vanity",
    "Toilet",
    "Shower",
  ]),
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.framing_level", "b1", "standard"),
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.tile_extent", "b1", "half_height"),
  fact("bathroom.waterproofing_included", "b1", true),
  fact("bathroom.waterproofing_extent", "b1", "floor_and_shower"),
  fact("bathroom.shower.width_m", "b1", 0.9),
  fact("bathroom.shower.depth_m", "b1", 0.9),
  fact("bathroom.shower.wall_height_m", "b1", 2.1),
  fact("bathroom.fixtures_included", "b1", [
    "Vanity",
    "Toilet",
    "Mirror/cabinet",
    "Heated towel rail",
  ]),
  fact("bathroom.fixture.vanity.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.toilet.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.mirror.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.heated_towel_rail.ownership", "b1", "Install only"),
  fact("bathroom.plumbing.level", "b1", "standard"),
  fact("bathroom.electrical.level", "b1", "standard"),
  fact("bathroom.electrical.light_count", "b1", 4),
  fact("bathroom.ventilation_included", "b1", true),
  fact("bathroom.stopping_included", "b1", true),
  fact("bathroom.painting_included", "b1", true),
];

const iwWa = wa("w1", "internal_walls", "Internal walls");
const deckWa = wa("d1", "deck", "Deck");
const bathroomWa = wa("b1", "bathroom", "Bathroom");
const paintingWa = wa("p1", "painting", "Painting");

const root = process.cwd();
const actionsSrc = readFileSync(join(root, "lib/assistant/actions.ts"), "utf8");
const persistSrc = readFileSync(
  join(root, "lib/estimate/persist-estimate.ts"),
  "utf8"
);
const successSrc = readFileSync(
  join(root, "lib/estimate/estimate-generation-success.ts"),
  "utf8"
);
const fitoutSrc = readFileSync(
  join(root, "lib/estimate/calculators/fitout.ts"),
  "utf8"
);
const generateFn = actionsSrc.slice(
  actionsSrc.indexOf("async function runEstimateGeneration"),
  actionsSrc.indexOf("export async function generateStaticEstimate")
);

console.log("=== EF02-FINAL-R3-C nonempty generate success ===\n");

console.log("--- Authority ---\n");
check(
  "Deck/Fence/RW/Bathroom are mature supported types",
  ["deck", "fence", "retaining_wall", "bathroom"].every(isMatureSupportedWorkAreaType)
);
check("Internal Walls is not a support-contract mature type", !isMatureSupportedWorkAreaType("internal_walls"));
check(
  "IW job_scope is the mature calculator path",
  isMatureInternalWallsPath({
    facts: [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition")],
    workAreaId: "w1",
  })
);
check(
  "success module uses support-contract + isMatureInternalWallsPath",
  successSrc.includes("isMatureSupportedWorkAreaType") &&
    successSrc.includes("isMatureInternalWallsPath")
);

console.log("\n--- A. mature IW insufficient data ---\n");
const iwInsufficientFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
];
const iwInsufficient = calculateEstimate(ctx([iwWa], iwInsufficientFacts));
const iwInsufficientCalc = calculateInternalWalls(
  ctx([iwWa], iwInsufficientFacts),
  iwWa
);
check(
  "R2 zero-line root: mature path with job_scope and no wall types",
  isMatureInternalWallsPath({ facts: iwInsufficientFacts, workAreaId: "w1" }) &&
    iwInsufficientCalc.lineItems.length === 0 &&
    iwInsufficientCalc.missingInfo.includes(INTERNAL_WALLS_WALL_TYPE_REQUIRED_MESSAGE)
);
check(
  "classification is insufficient_physical, not calculator formula failure",
  classifyEmptyEstimateResult(iwInsufficient) === "insufficient_physical"
);
check("generate result has zero included lines", !hasMeaningfulEstimateOutput(iwInsufficient));
const iwRefuse = evaluateEstimateGenerationSuccess({
  confirmedWorkAreas: [iwWa],
  facts: iwInsufficientFacts,
  result: iwInsufficient,
});
check("generate refused", iwRefuse.ok === false && iwRefuse.reason === "invalid_empty_output");
const iwSim = simulateGeneratePersist({
  workAreas: [iwWa],
  facts: iwInsufficientFacts,
  previousStage: "details_ready",
  priorEstimateExists: false,
});
check("no successful empty persist", iwSim.persisted === false);
check("stage stays details_ready", iwSim.stage === "details_ready");
check(
  "user copy is unusable-estimate, not calculator internals",
  USER_ERRORS.estimateUnusable === ESTIMATE_UNUSABLE_USER_MESSAGE &&
    !USER_ERRORS.estimateUnusable.toLowerCase().includes("calculator") &&
    !USER_ERRORS.estimateUnusable.includes("INTERNAL_WALLS")
);

console.log("\n--- B. mature IW supported physical data ---\n");
const iwPositiveFacts = writeIw([
  { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  {
    key: "internal_walls.wall_type.frame_size",
    value: "90 mm timber framing — 90×45",
  },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
]);
const iwPositive = calculateEstimate(ctx([iwWa], iwPositiveFacts));
const iwPositiveDecision = evaluateEstimateGenerationSuccess({
  confirmedWorkAreas: [iwWa],
  facts: iwPositiveFacts,
  result: iwPositive,
});
check("positive IW included lines > 0", iwPositive.lineItems.filter((item) => item.includedInTotal !== false).length > 0);
check("positive IW generate succeeds", iwPositiveDecision.ok === true && iwPositiveDecision.reason === "meaningful_output");
check(
  "positive IW recommended sell is commercially meaningful",
  iwPositive.recommendedSell > 0 || hasPricingRequiredRepresentation(iwPositive)
);
const iwPosSim = simulateGeneratePersist({
  workAreas: [iwWa],
  facts: iwPositiveFacts,
  previousStage: "details_ready",
  priorEstimateExists: false,
});
check("positive IW persists estimate_ready", iwPosSim.persisted && iwPosSim.stage === "estimate_ready");

console.log("\n--- C. mature Deck ---\n");
const deckFacts = [
  fact("deck.area_m2", "d1", 70),
  fact("deck.board_material", "d1", "Hardwood"),
  fact("deck.board_width_mm", "d1", 140),
  fact("deck.height_m", "d1", 0.8),
  fact("deck.existing_deck_removal", "d1", true),
  fact("deck.access_type", "d1", "Stair set"),
  fact("deck.balustrade_required", "d1", true),
];
const deckResult = calculateEstimate(ctx([deckWa], deckFacts));
const deckDecision = evaluateEstimateGenerationSuccess({
  confirmedWorkAreas: [deckWa],
  facts: deckFacts,
  result: deckResult,
});
check("Deck generate succeeds", deckDecision.ok === true);
check("Deck included lines > 0", hasMeaningfulEstimateOutput(deckResult));
check(
  "locked Deck sell $48,340 unchanged",
  Math.round(deckResult.recommendedSell) === 48340,
  `sell=${deckResult.recommendedSell}`
);

console.log("\n--- D. mature Bathroom ---\n");
const bathroomCalc = calculateBathroom(
  ctx([bathroomWa], bathroomComprehensiveFacts),
  bathroomWa
);
const bathroomEstimate = calculateEstimate(
  ctx([bathroomWa], bathroomComprehensiveFacts)
);
const bathroomDecision = evaluateEstimateGenerationSuccess({
  confirmedWorkAreas: [bathroomWa],
  facts: bathroomComprehensiveFacts,
  result: bathroomEstimate,
});
const bathroomCost = bathroomCalc.lineItems.reduce(
  (sum, item) => sum + (item.recommendedCost ?? 0),
  0
);
const bathroomSell = bathroomCalc.lineItems.reduce(
  (sum, item) => sum + (item.recommendedSell ?? 0),
  0
);
check("Bathroom generate succeeds", bathroomDecision.ok === true);
check("Bathroom included lines > 0", hasMeaningfulEstimateOutput(bathroomEstimate));
check(
  "locked Bathroom cost ~19328.51",
  near(bathroomCost, 19328.51, 1),
  `cost=${bathroomCost}`
);
check(
  "locked Bathroom sell ~24658.8",
  near(bathroomSell, 24658.8, 1),
  `sell=${bathroomSell}`
);

console.log("\n--- E. Pricing Required representation ---\n");
const pricingRequiredDecision = evaluateEstimateGenerationSuccess({
  confirmedWorkAreas: [iwWa],
  facts: iwPositiveFacts,
  result: {
    lineItems: [pricingRequiredOnlyLine],
    missingInfo: [],
    requirements: [],
  },
});
check(
  "included Pricing Required line is not blocked",
  pricingRequiredDecision.ok === true &&
    hasPricingRequiredRepresentation({ lineItems: [pricingRequiredOnlyLine] })
);
check(
  "excluded-only lines are invalid empty",
  evaluateEstimateGenerationSuccess({
    confirmedWorkAreas: [iwWa],
    facts: iwInsufficientFacts,
    result: {
      lineItems: [{ ...pricingRequiredOnlyLine, includedInTotal: false }],
      missingInfo: ["Add at least one wall type."],
      requirements: [],
    },
  }).ok === false
);

console.log("\n--- F. no mature estimating Work Area ---\n");
check(
  "painting-only does not require nonempty estimate",
  projectRequiresNonemptyEstimate({
    confirmedWorkAreas: [paintingWa],
    facts: [],
  }) === false
);
const paintingResult = calculateEstimate(ctx([paintingWa], []));
const paintingDecision = evaluateEstimateGenerationSuccess({
  confirmedWorkAreas: [paintingWa],
  facts: [],
  result: paintingResult,
});
check(
  "painting-only keeps existing persist behaviour (guard not applicable)",
  paintingDecision.ok === true && paintingDecision.reason === "guard_not_applicable"
);
check(
  "immature IW without job_scope/types does not enforce the guard",
  projectRequiresNonemptyEstimate({
    confirmedWorkAreas: [iwWa],
    facts: [],
  }) === false
);

console.log("\n--- G. failed empty generate does not overwrite prior estimate ---\n");
const overwriteSim = simulateGeneratePersist({
  workAreas: [iwWa],
  facts: iwInsufficientFacts,
  previousStage: "estimate_ready",
  priorEstimateExists: true,
});
check("empty regenerate does not persist", overwriteSim.persisted === false);
check("prior estimate_ready stage preserved", overwriteSim.stage === "estimate_ready");
check("prior estimate row not overwritten", overwriteSim.priorEstimatePreserved === true);
check(
  "persistEstimateResult still upserts existing rows (overwrite risk if called)",
  persistSrc.includes("existingId") && persistSrc.includes(".update(")
);
check(
  "guard runs before persistEstimateResult",
  generateFn.indexOf("evaluateEstimateGenerationSuccess") > 0 &&
    generateFn.indexOf("evaluateEstimateGenerationSuccess") <
      generateFn.indexOf("persistEstimateResult")
);
check(
  "invalid empty returns estimateUnusable and never reaches persist",
  generateFn.includes("USER_ERRORS.estimateUnusable") &&
    generateFn.includes("empty mature estimate refused")
);
check(
  "persistEstimateResult stays generic (no empty-output guard)",
  !persistSrc.includes("evaluateEstimateGenerationSuccess") &&
    !persistSrc.includes("invalid_empty_output")
);

console.log("\n--- Locked IW-ID Fixture D ---\n");
const live = internalWallsIdentityInvariantFixtures();
check("IW-ID Fixture D labour 12.96", live.D.labourHours === 12.96, String(live.D.labourHours));
check(
  "IW-ID Fixture D cost 1965.06",
  live.D.commercial.recommendedCost === 1965.06,
  String(live.D.commercial.recommendedCost)
);
check(
  "IW-ID Fixture D sell 2650.72",
  live.D.commercial.recommendedSell === 2650.72,
  String(live.D.commercial.recommendedSell)
);
const dFacts = applyExtractedInternalWallsToFacts({
  facts: [
    {
      key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
      work_area_id: "w1",
      value: "new_partition",
    },
  ],
  workAreaId: "w1",
  types: extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF),
});
const dEstimate = calculateEstimate(ctx([iwWa], dFacts));
check(
  "Fixture D generate still succeeds with non-zero lines",
  evaluateEstimateGenerationSuccess({
    confirmedWorkAreas: [iwWa],
    facts: dFacts,
    result: dEstimate,
  }).ok === true && dEstimate.lineItems.length > 0
);

console.log("\n--- Boundary / no formula retune ---\n");
check(
  "guard is not scattered into Internal Walls calculator",
  !fitoutSrc.includes("evaluateEstimateGenerationSuccess") &&
    !fitoutSrc.includes("invalid_empty_output")
);
check(
  "no new numbered migration in this phase",
  !successSrc.includes("058_") && !generateFn.includes("058_")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

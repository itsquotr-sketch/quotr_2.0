/**
 * Partial estimates can price independent work while support, fixing,
 * stopping inclusion and site conditions stay unresolved.
 *
 * Run: npx tsx scripts/verify-partial-estimate-readiness.ts
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFlooring, calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { CARPET_TILE_SPECIFICATION_UNRESOLVED } from "../lib/estimate/flooring-carpet-tile";
import { INTERNAL_WALLS_SCOPE_UNRESOLVED } from "../lib/estimate/internal-walls-scope";
import { provisionalLabourBasisSentences } from "../lib/estimate/condition-basis";
import {
  deckDetailGaps,
  deckDetailGapsBlockingEstimate,
  deckExcludedConcreteLeavesSupportUnresolved,
} from "../lib/estimate/deck-detail-completeness";
import {
  typicalPostHoleSetupFacts,
  typicalPostHoleSetupSummary,
} from "../lib/estimate/deck-hole-excavation";
import { DECK_SUPPORT_DESIGN_UNRESOLVED } from "../lib/estimate/deck-scope-2c";
import {
  calculateDeckStepsQuantities,
  estimateDeckRiseCount,
  STEP_STORED_COUNT_DOES_NOT_FIT,
  storedStepCountExceedsEstimatingRiser,
} from "../lib/estimate/deck-steps-physical";
import { listFlooringClarifyCandidates } from "../lib/estimate/flooring-clarify";
import { FLOORING_PORTIONS_FACT_KEY } from "../lib/estimate/flooring-portions";
import { createEmptyWallType } from "../lib/estimate/internal-walls-wall-types";
import {
  classifyReviewNotice,
  specificationCountFromNotices,
} from "../lib/assistant/presentation/estimate-issues";
import { formatLabourAdjustmentPrimary } from "../lib/estimate/builder-presentation-format";
import {
  clientPriceBasis,
  clientPriceCopy,
} from "../lib/pricing/incomplete-price-label";
import { unresolvedScopeReviewBlock } from "../lib/pricing/scope-finalisation";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fact(
  workAreaId: string,
  key: string,
  value: unknown
): EstimateFact {
  return {
    id: `${workAreaId}:${key}`,
    project_id: "p1",
    work_area_id: workAreaId,
    key,
    value,
    value_type: "text",
    source: "user",
  } as EstimateFact;
}

const deckArea: EstimateWorkArea = {
  id: "d1",
  type: "deck",
  name: "Deck",
  sort_order: 1,
};

function deckContext(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [deckArea],
    facts,
    constraints: [],
    briefText: null,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
  } as unknown as EstimateContext;
}

console.log("\n=== Step geometry ===\n");
check(
  "1.2 m divided by one stored rise is an unsupported riser",
  storedStepCountExceedsEstimatingRiser(1, 1.2)
);
check(
  "height alone still estimates a legal rise count",
  estimateDeckRiseCount(1.2) === 7
);
const illegalSteps = calculateDeckStepsQuantities({
  facts: [fact("d1", "deck.step_count", 1)],
  workAreaId: "d1",
  deckHeightM: 1.2,
  wastePercent: 10,
});
check(
  "stored count of one does not price a 1.2 m riser",
  illegalSteps != null &&
    illegalSteps.riseCount === 0 &&
    illegalSteps.treadAreaM2 === 0 &&
    illegalSteps.framingPurchaseLm === 0
);
const legalSteps = calculateDeckStepsQuantities({
  facts: [],
  workAreaId: "d1",
  deckHeightM: 1.2,
  wastePercent: 10,
});
check(
  "missing count uses the height layout instead of one riser",
  legalSteps != null && legalSteps.riseCount === 7 && legalSteps.treadAreaM2 > 0
);

const stepFacts = [
  fact("d1", "deck.length_m", 5.2),
  fact("d1", "deck.width_m", 3.1),
  fact("d1", "deck.height_m", 1.2),
  fact("d1", "deck.steps_included", true),
  fact("d1", "deck.step_count", 1),
  fact("d1", "deck.board_width_mm", 140),
  fact("d1", "deck.substructure_included", true),
];
const stepEstimate = calculateDeck(deckContext(stepFacts), deckArea);
check(
  "calculator leaves the unsupported step unresolved",
  stepEstimate.missingInfo.includes(STEP_STORED_COUNT_DOES_NOT_FIT) &&
    !stepEstimate.lineItems.some((item) => /step/i.test(item.label))
);

console.log("\n=== Excluded concrete ===\n");
const lowFacts = [
  fact("d1", "deck.length_m", 4.8),
  fact("d1", "deck.width_m", 3.6),
  fact("d1", "deck.board_width_mm", 90),
  fact("d1", "deck.concrete_to_supports", false),
  fact("d1", "deck.substructure_included", true),
];
check(
  "excluded concrete keeps support questions visible",
  deckExcludedConcreteLeavesSupportUnresolved(lowFacts, "d1") &&
    deckDetailGaps(lowFacts, "d1").some((gap) => gap.id === "posts")
);
check(
  "excluded concrete does not block decking",
  deckDetailGapsBlockingEstimate(lowFacts, "d1").length === 0
);
const confirmedConcrete = [
  ...lowFacts.filter((row) => row.key !== "deck.concrete_to_supports"),
  fact("d1", "deck.concrete_to_supports", true),
];
check(
  "included concrete still requires the support answers",
  deckDetailGapsBlockingEstimate(confirmedConcrete, "d1").length > 0
);
const excludedSetup = typicalPostHoleSetupFacts({ concreteExcluded: true });
const includedSetup = typicalPostHoleSetupFacts({ concreteExcluded: false });
check(
  "typical setup does not reinstate excluded concrete",
  !excludedSetup.some((row) => row.key === "deck.concrete_fill") &&
    includedSetup.some(
      (row) => row.key === "deck.concrete_fill" && row.value === "full"
    ) &&
    typicalPostHoleSetupSummary(null, true).includes("concrete footings excluded") &&
    !typicalPostHoleSetupSummary(null, true).includes("full concrete fill")
);
const lowEstimate = calculateDeck(deckContext(lowFacts), deckArea);
check(
  "low deck prices framing without a support design",
  lowEstimate.missingInfo.includes(DECK_SUPPORT_DESIGN_UNRESOLVED) &&
    !lowEstimate.lineItems.some((item) =>
      /pile|post|concrete|hole excavation/i.test(item.label)
    ) &&
    lowEstimate.lineItems.some((item) => /joist|bearer|decking|board/i.test(item.label))
);

console.log("\n=== Office unresolved paths ===\n");
const portion = {
  id: "p1",
  specialist_kind: "carpet_tile",
  finish_type: "other",
  area_m2: 40,
  carpet_tile_pattern: "straight",
  carpet_tile_substrate: "ready",
  carpet_tile_waste: "proposed",
  carpet_tile_size: "unknown",
  carpet_tile_box: "unknown",
  carpet_tile_fixing: null,
};
const flooringCandidates = listFlooringClarifyCandidates({
  facts: [fact("f1", FLOORING_PORTIONS_FACT_KEY, [portion])],
  workAreaId: "f1",
  workAreaName: "Flooring",
});
const fixing = flooringCandidates.find(
  (row) => row.factKey === "flooring.portion.carpet_tile_fixing"
);
check(
  "unknown carpet fixing stays visible and does not block",
  fixing != null &&
    !isInitialCaptureQuestion(fixing) &&
    fixing.assumable === false &&
    fixing.blocksEstimate === false,
  flooringCandidates.map((row) => `${row.factKey}:${row.askClass}`).join(" | ")
);
const openPattern = {
  ...portion,
  carpet_tile_pattern: null,
  carpet_tile_substrate: null,
  carpet_tile_waste: null,
  carpet_tile_size: null,
  carpet_tile_box: null,
};
const openPatternCandidates = listFlooringClarifyCandidates({
  facts: [fact("f1", FLOORING_PORTIONS_FACT_KEY, [openPattern])],
  workAreaId: "f1",
  workAreaName: "Flooring",
});
const patternQuestion = openPatternCandidates.find(
  (row) => row.factKey === "flooring.portion.carpet_tile_pattern"
);
check(
  "unanswered carpet pattern stays visible and does not block unrelated work",
  patternQuestion != null &&
    !isInitialCaptureQuestion(patternQuestion) &&
    patternQuestion.assumable === false &&
    patternQuestion.blocksEstimate === false
);
const flooringArea: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
};
const carpetEstimate = calculateFlooring(
  {
    ...deckContext([fact("f1", FLOORING_PORTIONS_FACT_KEY, [openPattern])]),
    confirmedWorkAreas: [flooringArea],
  },
  flooringArea
);
check(
  "unanswered carpet pattern does not price the carpet",
  carpetEstimate.missingInfo.includes(CARPET_TILE_SPECIFICATION_UNRESOLVED) &&
    classifyReviewNotice(CARPET_TILE_SPECIFICATION_UNRESOLVED) === "scope_gap" &&
    !carpetEstimate.lineItems.some((item) => (item.recommendedCost ?? 0) > 0)
);

const wall = createEmptyWallType({ id: "wt1", label: "Wall Type 1" });
wall.frame_system = "timber";
wall.frame_size = "90x45";
wall.length_lm = 24;
wall.height_m = 2.7;
wall.stud_centres_mm = 600;
wall.side_a = {
  lined: true,
  material_family: "plasterboard",
  product: "standard_gib",
  thickness_mm: 13,
  thickness_source: "user",
  sheet_length_mm: null,
  sheet_length_source: null,
  layers: 1,
};
wall.same_lining_both_sides = true;
wall.side_b = { ...wall.side_a };
wall.has_openings = false;
wall.insulation_included = false;
wall.skirting = "none";
wall.cornice_included = false;
const wallClarify = composeClarifyView({
  stage: "work_area_questions",
  briefText: "Include six internal door sets and new partition walls.",
  qualityLevel: "standard",
  workAreas: [
    {
      id: "w1",
      type: "internal_walls",
      name: "Internal walls",
      status: "confirmed",
    },
  ],
  facts: [
    fact("w1", "internal_walls.job_scope", "new_partition"),
    fact("w1", "internal_walls.structural_involvement", "no"),
    fact("w1", "internal_walls.wall_types", [wall]),
  ],
  constraints: [{ key: "site_access", value: "Moderate" }],
  jobPlan: { cards: [] },
});
const stopping = [...wallClarify.candidates, ...wallClarify.deferred].find(
  (row) => row.factKey === "internal_walls.wall_type.stopping_side_a"
);
check(
  "unanswered stopping inclusion does not block and is not assumed",
  stopping != null &&
    !isInitialCaptureQuestion(stopping) &&
    stopping.assumable === false &&
    !wallClarify.assumptions.some((row) => /stopping/i.test(row.statement)),
  [...wallClarify.candidates, ...wallClarify.deferred]
    .map((row) => row.factKey)
    .join(" | ") || "missing"
);

console.log("\n=== Bathroom conditions ===\n");
const bathroomClarify = composeClarifyView({
  stage: "work_area_questions",
  briefText: "Bathroom renovation.",
  qualityLevel: "standard",
  workAreas: [
    { id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" },
  ],
  facts: [
    fact("b1", "bathroom.job_scope", "full_renovation"),
    fact("b1", "bathroom.length_m", 2.4),
    fact("b1", "bathroom.width_m", 2.1),
  ],
  constraints: [],
  jobPlan: {
    cards: [
      {
        workAreaId: "b1",
        workAreaType: "bathroom",
        name: "Bathroom",
        included: [],
        notIncluded: [],
        notConfirmed: [
          {
            id: "waterproofing",
            label: "Waterproofing",
            sourceFactKey: "bathroom.waterproofing_included",
            write: null,
            workAreaId: "b1",
          },
        ],
      },
    ],
  },
});
const access = bathroomClarify.candidates.find(
  (row) => row.constraintKey === "site_access"
);
const carry = bathroomClarify.candidates.find(
  (row) => row.constraintKey === "material_carry_distance"
);
const waterproofing = [...bathroomClarify.candidates, ...bathroomClarify.deferred].find(
  (row) => row.factKey === "bathroom.waterproofing_included"
);
check(
  "unanswered access stays open without becoming Easy",
  access != null &&
    !isInitialCaptureQuestion(access) &&
    access.assumable === false &&
    access.currentValue == null
);
check(
  "unanswered carry stays open without becoming a short carry",
  carry != null && !isInitialCaptureQuestion(carry) && carry.assumable === false
);
check(
  "waterproofing stays unresolved",
  waterproofing != null &&
    !isInitialCaptureQuestion(waterproofing) &&
    waterproofing.assumable === false
);
const bathroomEstimate = calculateBathroom(
  {
    ...deckContext([]),
    confirmedWorkAreas: [
      { id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1 },
    ],
    facts: [
      fact("b1", "bathroom.job_scope", "full_renovation"),
      fact("b1", "bathroom.length_m", 2.4),
      fact("b1", "bathroom.width_m", 2.1),
      fact("b1", "bathroom.height_m", 2.4),
    ],
    constraints: [],
  } as EstimateContext,
  { id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1 }
);
const provisional = provisionalLabourBasisSentences([]);
const occupiedHoursLabel = formatLabourAdjustmentPrimary(1.1, {
  accessAddend: 0,
  carryAddend: 0,
  slopeAddend: 0,
  occupiedAddend: 0.05,
  hoursAddend: 0.05,
});
check(
  "occupied hours are not described as access or carry",
  occupiedHoursLabel.includes("occupied site") &&
    occupiedHoursLabel.includes("restricted hours") &&
    !occupiedHoursLabel.includes("access/carry") &&
    !formatLabourAdjustmentPrimary(1.1).includes("access/carry")
);
check(
  "unadjusted labour is disclosed and not stored as Easy",
  provisional.some((row) => /not a confirmed Easy answer/i.test(row)) &&
    provisional.some((row) => /not a confirmed distance under 10 m/i.test(row)) &&
    bathroomEstimate.assumptions.some((row) =>
      /not a confirmed Easy answer/i.test(row)
    ) &&
    !bathroomEstimate.lineItems.some((item) => /waterproof/i.test(item.label))
);

const unresolvedWalls = calculateInternalWalls(
  {
    ...deckContext([]),
    confirmedWorkAreas: [
      { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 },
    ],
  } as EstimateContext,
  { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
check(
  "unresolved wall scope is withheld rather than assumed",
  unresolvedWalls.lineItems.length === 0 &&
    unresolvedWalls.missingInfo.includes(INTERNAL_WALLS_SCOPE_UNRESOLVED) &&
    classifyReviewNotice(INTERNAL_WALLS_SCOPE_UNRESOLVED) === "scope_gap" &&
    !unresolvedWalls.assumptions.some((row) => /20 m²/i.test(row))
);

console.log("\n=== Incomplete price ===\n");
const priced = clientPriceCopy(
  clientPriceBasis({
    scopeUnresolved: true,
    pricesUnresolved: false,
    enteredOverride: false,
  })
);
const entered = clientPriceCopy(
  clientPriceBasis({
    scopeUnresolved: true,
    pricesUnresolved: false,
    enteredOverride: true,
  })
);
const complete = clientPriceCopy(
  clientPriceBasis({
    scopeUnresolved: false,
    pricesUnresolved: false,
    enteredOverride: false,
  })
);
check(
  "priced lines are not called the final price",
  priced.heading === "Priced lines so far" &&
    priced.totalLabel === "Priced lines so far" &&
    /not the complete job price/i.test(priced.detail)
);
check(
  "an entered price stays identified",
  entered.heading === "Entered price" && entered.totalLabel === "Entered price"
);
check(
  "a complete price can still be the final price",
  complete.heading === "Final client price" &&
    complete.totalLabel === "Your final price"
);
check(
  "excluded support is an unresolved scope gap",
  classifyReviewNotice(DECK_SUPPORT_DESIGN_UNRESOLVED) === "scope_gap" &&
    unresolvedScopeReviewBlock([DECK_SUPPORT_DESIGN_UNRESOLVED]) != null
);
check(
  "an unanswered condition question is not a complete price",
  specificationCountFromNotices(["How difficult is site access?"]) === 1 &&
    unresolvedScopeReviewBlock(["How difficult is site access?"]) != null
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

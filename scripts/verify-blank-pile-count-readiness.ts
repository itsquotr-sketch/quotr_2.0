/**
 * A blank pile replacement count must not block a partial deck estimate.
 * The count stays unknown, dependent pile work stays out of the known
 * total, and a stated count still has to finish its hole answers.
 *
 * Run: npx tsx scripts/verify-blank-pile-count-readiness.ts
 */
import { classifyReviewNotice } from "../lib/assistant/presentation/estimate-issues";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  blankPileReplacementLeavesSupportsUnpriced,
  deckDetailGaps,
  deckDetailGapsBlockingEstimate,
  deckDetailQueuePrompt,
} from "../lib/estimate/deck-detail-completeness";
import {
  PILE_ALLOWANCE_COVERAGE_GAP,
  PILE_REPLACEMENT_ITEM_KEY,
  pileReplacementAllowanceSavesInPlace,
} from "../lib/estimate/deck-scope-2c";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { projectWorkflowRoutes } from "../lib/projects/workflow-orientation";
import { unresolvedScopeReviewBlock, UNRESOLVED_SCOPE_REVIEW_BLOCK } from "../lib/pricing/scope-finalisation";

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

function fact(key: string, value: unknown): EstimateFact {
  return {
    id: `d1:${key}`,
    project_id: "p1",
    work_area_id: "d1",
    key,
    value,
    value_type: "text",
    source: "user",
  } as EstimateFact;
}

const area: EstimateWorkArea = {
  id: "d1",
  type: "deck",
  name: "Deck",
  sort_order: 1,
};

const blankFacts = [
  fact("deck.length_m", 6),
  fact("deck.width_m", 3),
  fact("deck.board_width_mm", 140),
  fact("deck.substructure_included", true),
  fact("deck.pile_or_post_replacement_required", true),
  fact("deck.hole_diameter_mm", 350),
  fact("deck.hole_depth_mm", 600),
  fact("deck.hole_ground", "ordinary"),
  fact("deck.hole_method", "hand"),
  fact("deck.spoil_destination", "not_sure"),
];

function context(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [area],
    facts,
    constraints: [],
    briefText:
      "Replace the existing deck, 3.0 m wide by 6.0 m long. Replace the piles. The pile count is unknown. Include the new decking and framing.",
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

const visible = deckDetailGaps(blankFacts, "d1");
const blocking = deckDetailGapsBlockingEstimate(blankFacts, "d1");
check(
  "blank count stays visible as one post answer",
  blankPileReplacementLeavesSupportsUnpriced(blankFacts, "d1") &&
    visible.some((gap) => gap.id === "posts") &&
    deckDetailQueuePrompt(visible) === "Finish 1 post answer"
);
check(
  "blank count does not block the partial estimate",
  blocking.length === 0
);

const estimate = calculateDeck(context(blankFacts), area);
const included = estimate.lineItems.filter((item) => item.includedInTotal !== false);
const dependent = included.filter((item) =>
  /pile|post|hole excavation|concrete/i.test(item.label)
);
const allowance = estimate.lineItems.find(
  (item) => item.itemKey === PILE_REPLACEMENT_ITEM_KEY
);
const knownSell = included.reduce(
  (sum, item) => sum + (item.recommendedSell ?? 0),
  0
);
check(
  "decking and framing are in the known total",
  knownSell > 0 &&
    included.some((item) => /joist|bearer|decking|board/i.test(item.label))
);
check(
  "dependent pile work stays out of the priced subtotal",
  dependent.length === 0 &&
    allowance?.includedInTotal === false &&
    allowance.quantity === 0 &&
    /Quantity unknown/.test(allowance.notes ?? "") &&
    estimate.missingInfo.includes(PILE_ALLOWANCE_COVERAGE_GAP) &&
    classifyReviewNotice(PILE_ALLOWANCE_COVERAGE_GAP) === "scope_gap"
);
check(
  "review stays blocked and pricing opens once the partial estimate exists",
  unresolvedScopeReviewBlock(estimate.missingInfo) === UNRESOLVED_SCOPE_REVIEW_BLOCK &&
    projectWorkflowRoutes({
      projectId: "48a03529-cee9-47bb-87c9-f836eac8408e",
      hasEstimate: true,
      estimateIsStale: false,
      pricingSummary: null,
      quoteSummary: null,
    }).pricingBlocked === false &&
    projectWorkflowRoutes({
      projectId: "48a03529-cee9-47bb-87c9-f836eac8408e",
      hasEstimate: false,
      estimateIsStale: false,
      pricingSummary: null,
      quoteSummary: null,
    }).pricingBlocked === true
);

const counted = [
  fact("deck.length_m", 6),
  fact("deck.width_m", 3),
  fact("deck.board_width_mm", 140),
  fact("deck.substructure_included", true),
  fact("deck.pile_or_post_replacement_required", true),
  fact("deck.pile_or_post_count", 4),
];
const countedBlocking = deckDetailGapsBlockingEstimate(counted, "d1");
check(
  "a stated count still requires the hole answers it prices",
  !blankPileReplacementLeavesSupportsUnpriced(counted, "d1") &&
    countedBlocking.length > 0 &&
    !countedBlocking.some((gap) => gap.id === "posts") &&
    countedBlocking.some((gap) => gap.id === "ground" || gap.id === "method")
);

const laidOut = [
  fact("deck.length_m", 6),
  fact("deck.width_m", 3),
  fact("deck.board_width_mm", 140),
  fact("deck.substructure_included", true),
  fact("deck.pile_or_post_replacement_required", true),
  fact("deck.bearer_row_count", 2),
  fact("deck.supports_per_bearer", 4),
];
check(
  "the replacement allowance can be saved without a requirement identity",
  pileReplacementAllowanceSavesInPlace({
    itemKey: PILE_REPLACEMENT_ITEM_KEY,
    label: allowance?.label,
  }) &&
    !pileReplacementAllowanceSavesInPlace({
      itemKey: "deck.decking",
      label: "Hardwood decking",
    })
);
check(
  "a confirmed layout still requires its measured support answers",
  !blankPileReplacementLeavesSupportsUnpriced(laidOut, "d1") &&
    deckDetailGapsBlockingEstimate(laidOut, "d1").length > 0
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

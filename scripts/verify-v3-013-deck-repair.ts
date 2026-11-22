/**
 * V3-013 bounded repair.
 *
 * QT-006 Create estimate was enabled because clarify answers were complete.
 * The click entered handleGenerateEstimate and returned before
 * generateStaticEstimate. evaluateGenerateEstimatePermission was not ready:
 * deckDetailGapsBlockingForAreas still required post, excavation and concrete
 * answers for an unconfirmed support method. No estimate request was sent and
 * nothing was saved.
 *
 * Run: npx tsx scripts/verify-v3-013-deck-repair.ts
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import {
  classifyReviewNotice,
  missingRateReviewBlockFromLines,
} from "../lib/assistant/presentation/estimate-issues";
import { deckJobPlanAdapter } from "../lib/assistant/job-plan/adapters/deck";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  deckDetailGaps,
  deckDetailGapsBlockingEstimate,
} from "../lib/estimate/deck-detail-completeness";
import {
  typicalPostHoleSetupFacts,
  typicalPostHoleSetupSummary,
} from "../lib/estimate/deck-hole-excavation";
import {
  DECK_CONFIRMED_LAYOUT_GROUNDWORKS_EXCLUDED,
  DECK_CONFIRMED_LAYOUT_GROUNDWORKS_UNRESOLVED,
  DECK_SUPPORT_DESIGN_UNRESOLVED,
  DECK_SUPPORT_METHOD_UNCONFIRMED,
} from "../lib/estimate/deck-scope-2c";
import { unresolvedScopeReviewBlock } from "../lib/pricing/scope-finalisation";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function fact(key: string, value: unknown, workAreaId = "d1"): EstimateFact {
  return {
    id: `${workAreaId}:${key}`,
    project_id: "p1",
    work_area_id: workAreaId,
    key,
    value,
    value_type: "text",
    source: "ai_extracted",
  } as EstimateFact;
}

const area: EstimateWorkArea = {
  id: "d1",
  type: "deck",
  name: "Deck",
  sort_order: 1,
};

function context(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [area],
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

function money(label: string, items: { label: string; recommendedCost?: number }[]) {
  return items.find((item) => item.label === label)?.recommendedCost ?? null;
}

const qt006 = [
  fact("deck.length_m", 4.8),
  fact("deck.width_m", 3.6),
  fact("deck.height_m", 0.45),
  fact("deck.board_material", "Timber"),
  fact("deck.board_width_mm", 90),
  fact("deck.substructure_included", true),
  fact("deck.access_type", "None"),
  fact("deck.balustrade_required", false),
  fact("deck.vertical_face_boards_required", false),
  fact("deck.existing_deck_removal", false),
  fact("deck.steps_included", false),
  fact("deck.painting_included", false),
  fact("deck.board_waste_percent", 10),
];
const qt006Estimate = calculateDeck(context(qt006), area);
check(
  "QT-006 open supports do not block a partial estimate",
  deckDetailGaps(qt006, "d1").some((gap) => gap.id === "posts") &&
    deckDetailGapsBlockingEstimate(qt006, "d1").length === 0
);
check(
  "QT-006 prices decking and framing and withholds unconfirmed support charges",
  qt006Estimate.lineItems.some((item) => /decking/i.test(item.label)) &&
    qt006Estimate.lineItems.some((item) => /joist|bearer|framing/i.test(item.label)) &&
    !qt006Estimate.lineItems.some((item) =>
      /pile|post|concrete|hole excavation/i.test(item.label)
    ) &&
    qt006Estimate.missingInfo.includes(DECK_SUPPORT_METHOD_UNCONFIRMED)
);
const qt006AcceptedHole = calculateDeck(
  context([
    ...qt006,
    fact("deck.hole_shape", "circular"),
    fact("deck.hole_diameter_mm", 350),
    fact("deck.hole_depth_mm", 600),
    fact("deck.support_section", "125x125"),
  ]),
  area
);
const qt006LaidOut = calculateDeck(
  context([
    ...qt006,
    fact("deck.bearer_row_count", 2),
    fact("deck.supports_per_bearer", 3),
  ]),
  area
);
const laidOutRateBlock = missingRateReviewBlockFromLines(
  qt006LaidOut.lineItems.map((item) => ({
    rate_source: item.rateSource,
    notes: item.notes,
  }))
);
check(
  "QT-006 a confirmed post layout prices posts and leaves groundworks unresolved",
  qt006LaidOut.lineItems.some((item) => item.label === "Piles / posts") &&
    !qt006LaidOut.lineItems.some((item) =>
      /concrete|hole excavation|spoil/i.test(item.label)
    ) &&
    !qt006LaidOut.missingInfo.includes(DECK_SUPPORT_DESIGN_UNRESOLVED) &&
    qt006LaidOut.missingInfo.includes(DECK_CONFIRMED_LAYOUT_GROUNDWORKS_UNRESOLVED) &&
    unresolvedScopeReviewBlock(qt006LaidOut.missingInfo) != null &&
    laidOutRateBlock == null &&
    !qt006LaidOut.exclusions.includes(DECK_CONFIRMED_LAYOUT_GROUNDWORKS_EXCLUDED)
);
const qt006LaidOutExcluded = calculateDeck(
  context([...qt006, fact("deck.bearer_row_count", 2), fact("deck.supports_per_bearer", 3), fact("deck.concrete_to_supports", false)]),
  area
);
check(
  "QT-006 excluded footings stay explicit and do not request excavation",
  qt006LaidOutExcluded.lineItems.some((item) => item.label === "Piles / posts") &&
    !qt006LaidOutExcluded.lineItems.some((item) =>
      /concrete|hole excavation|spoil/i.test(item.label)
    ) &&
    qt006LaidOutExcluded.exclusions.includes(DECK_CONFIRMED_LAYOUT_GROUNDWORKS_EXCLUDED) &&
    unresolvedScopeReviewBlock(qt006LaidOutExcluded.missingInfo) == null
);
const qt006LaidOutIncluded = calculateDeck(
  context([...qt006, fact("deck.bearer_row_count", 2), fact("deck.supports_per_bearer", 3), fact("deck.concrete_to_supports", true)]),
  area
);
const includedRateBlock = missingRateReviewBlockFromLines(
  qt006LaidOutIncluded.lineItems.map((item) => ({
    rate_source: item.rateSource,
    notes: item.notes,
  }))
);
check(
  "QT-006 included footings request excavation and block review while it is unpriced",
  qt006LaidOutIncluded.lineItems.some((item) => item.label === "Hole excavation" && item.includedInTotal === false) &&
    qt006LaidOutIncluded.lineItems.some((item) => /spoil/i.test(item.label) && item.includedInTotal === false) &&
    qt006LaidOutIncluded.lineItems.some((item) => /concrete/i.test(item.label)) &&
    includedRateBlock != null &&
    !qt006LaidOutIncluded.missingInfo.includes(DECK_CONFIRMED_LAYOUT_GROUNDWORKS_UNRESOLVED)
);
check(
  "QT-006 accepting the proposed hole does not confirm footings",
  qt006AcceptedHole.missingInfo.includes(DECK_SUPPORT_METHOD_UNCONFIRMED) &&
    unresolvedScopeReviewBlock(qt006AcceptedHole.missingInfo) != null &&
    !qt006AcceptedHole.lineItems.some((item) =>
      /pile|post|concrete|hole excavation/i.test(item.label)
    )
);
check(
  "QT-006 does not convert the open support into excluded footings",
  !qt006Estimate.missingInfo.includes(DECK_SUPPORT_DESIGN_UNRESOLVED)
);
check(
  "QT-006 proposal keeps the hole assumption and does not save concrete fill",
  typicalPostHoleSetupSummary(null, "unconfirmed").includes("350 × 600") &&
    !typicalPostHoleSetupSummary(null, "unconfirmed").includes("full concrete fill") &&
    !typicalPostHoleSetupFacts({ footingScope: "unconfirmed" }).some(
      (row) => row.key === "deck.concrete_fill"
    )
);
check(
  "QT-006 partial price blocks complete review",
  unresolvedScopeReviewBlock(qt006Estimate.missingInfo) != null &&
    classifyReviewNotice(DECK_SUPPORT_METHOD_UNCONFIRMED) === "scope_gap"
);

const qt007 = [
  fact("deck.length_m", 5.2),
  fact("deck.width_m", 3.1),
  fact("deck.height_m", 1.2),
  fact("deck.level", "Elevated"),
  fact("deck.board_material", "Hardwood"),
  fact("deck.existing_deck_removal", true),
  fact("deck.substructure_included", true),
  fact("deck.vertical_face_boards_required", true),
  fact("deck.access_type", "Stair set"),
  fact("deck.balustrade_required", false),
  fact("deck.board_waste_percent", 10),
  fact(
    "deck.substructure_condition",
    "Existing piles may be retained if sound after inspection"
  ),
];
const qt007Estimate = calculateDeck(context(qt007), area);
const qt007Labels = qt007Estimate.lineItems.map((item) => item.label);
check(
  "QT-007 prices removal and framing while stairs and fascia stay open",
  qt007Labels.some((label) => /removal/i.test(label)) &&
    qt007Labels.some((label) => /joist|bearer|framing/i.test(label)) &&
    !qt007Labels.some((label) => /stair set allowance|step decking|step framing/i.test(label)) &&
    !qt007Labels.some((label) => /fascia/i.test(label)) &&
    !qt007Labels.some((label) => /replacement allowance/i.test(label))
);
check(
  "QT-007 names the stair and pile gaps without a charged allowance",
  qt007Estimate.missingInfo.some((row) => /step width required/i.test(row)) &&
    qt007Estimate.missingInfo.some((row) => /tread depth required/i.test(row)) &&
    qt007Estimate.missingInfo.some((row) =>
      /does not assume they are replaced or kept/i.test(row)
    ) &&
    qt007Estimate.missingInfo.some((row) => /fascia materials and labour are not priced/i.test(row))
);
check(
  "QT-007 partial price blocks complete review",
  unresolvedScopeReviewBlock(qt007Estimate.missingInfo) != null
);

const qt008 = [
  fact("deck.length_m", 6),
  fact("deck.width_m", 4),
  fact("deck.height_m", 0.6),
  fact("deck.substructure_included", true),
  fact("deck.vertical_face_boards_required", true),
  fact("deck.vertical_face_board_length_lm", 6),
  fact("deck.access_type", "None"),
  fact("deck.balustrade_required", false),
  fact("deck.existing_deck_removal", false),
  fact("deck.steps_included", false),
  fact("deck.boards_client_supplied", true),
];
const qt008Estimate = calculateDeck(context(qt008), area);
const suppliedBoards = qt008Estimate.lineItems.find((item) => item.label === "Decking");
const fascia = qt008Estimate.lineItems.find((item) => /fascia/i.test(item.label) && !/install/i.test(item.label));
const framing = qt008Estimate.lineItems.find((item) => /joist|bearer/i.test(item.label));
const install = qt008Estimate.lineItems.find((item) => item.label === "Decking installation");
check(
  "QT-008 customer boards have zero purchase cost and a retained installed quantity",
  suppliedBoards != null &&
    suppliedBoards.recommendedCost === 0 &&
    suppliedBoards.rateSourceType === "customer_supplied" &&
    (suppliedBoards.quantity ?? 0) > 0
);
check(
  "QT-008 keeps installation, framing and the 6 m fascia",
  (install == null || (install.quantity ?? 0) > 0) &&
    framing != null &&
    (framing.recommendedCost ?? 0) > 0 &&
    fascia != null &&
    (fascia.quantity ?? 0) >= 6 &&
    (fascia.quantity ?? 0) < 10
);
check(
  "QT-008 does not charge unconfirmed supports or concrete",
  !qt008Estimate.lineItems.some((item) =>
    /pile|post|concrete|hole excavation/i.test(item.label)
  ) &&
    qt008Estimate.missingInfo.includes(DECK_SUPPORT_METHOD_UNCONFIRMED)
);

const contractor = calculateDeck(
  context(qt008.filter((row) => row.key !== "deck.boards_client_supplied")),
  area
);
const purchased = contractor.lineItems.find((item) => item.label === "Decking");
check(
  "a contractor-supplied deck still purchases the boards",
  purchased != null &&
    purchased.rateSourceType !== "customer_supplied" &&
    (purchased.recommendedCost ?? 0) > 0
);
check(
  "customer-supplied boards do not make framing customer-supplied",
  framing?.rateSourceType !== "customer_supplied" &&
    fascia?.rateSourceType !== "customer_supplied"
);

const plan = deckJobPlanAdapter.project(
  { id: "d1", type: "deck", name: "Deck", status: "confirmed", sortOrder: 1 },
  { facts: qt008, briefText: null, qualityLevel: "standard", constraints: [] }
);
const labels = plan.included.map((item) => item.label);
check(
  "the plan names customer-supplied boards without excluding framing or fascia",
  labels.some((label) => label === "Decking — customer supplied") &&
    labels.some((label) => /framing|substructure/i.test(label)) &&
    labels.some((label) => /fascia/i.test(label)) &&
    labels.some((label) => label === "Customer-supplied decking boards")
);

function empty(): AIExtractionOutput {
  return {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  };
}

const extracted = enrichExtractionFromBrief({
  briefText:
    "New rectangular deck 6 m × 4 m, 600 mm high. The customer supplies the decking boards only. We supply framing, supports, fixings and labour. Fascia is required on the front 6 m edge only. The other three edges have no fascia. Do not use the full perimeter. No stairs, demolition, balustrade or coating. Board size and support details still need confirming.",
  extraction: empty(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;
const extractedValue = (key: string) =>
  extracted.facts.find((row) => row.key === key)?.value ?? null;
check("extraction records customer-supplied boards", extractedValue("deck.boards_client_supplied") === true);
check("extraction keeps the 6 m fascia", extractedValue("deck.vertical_face_board_length_lm") === 6);
check(
  "extraction does not invent customer-supplied framing",
  extractedValue("deck.substructure_client_supplied") == null
);
const contractorBrief = enrichExtractionFromBrief({
  briefText: "Supply and install a rectangular timber deck, 4.8 m × 3.6 m. Include new substructure and fixings.",
  extraction: empty(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;
check(
  "a contractor brief does not mark the boards customer-supplied",
  !contractorBrief.facts.some((row) => row.key === "deck.boards_client_supplied")
);

if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nV3-013 repair checks passed");

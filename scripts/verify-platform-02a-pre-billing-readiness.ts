/**
 * PLATFORM-02A — pre-billing readiness for Deck dimensions.
 *
 * Unanswered assumable dimensions stay in Details and block when they are
 * required for the economic model. "Not sure" persists the approved value
 * as source assumption. Irrelevant facts are not asked and do not block.
 *
 * Run: npx --yes tsx scripts/verify-platform-02a-pre-billing-readiness.ts
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { resolveCommittedFactWrite } from "../lib/assistant/scope-persistence";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { DEFAULT_FASCIA_GROUND_GAP_M } from "../lib/estimate/deck-fascia";
import {
  DEFAULT_STEP_GOING_M,
  DEFAULT_STEP_WIDTH_M,
  STEP_WIDTH_ASSUMPTION_STATEMENT,
} from "../lib/estimate/deck-steps-physical";
import { round2 } from "../lib/estimate/facts";
import {
  sumIncludedLineItems,
  totalLabourHours,
} from "../lib/estimate/pricing-ownership";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import { mergeDerivedFactsIntoRecords } from "../lib/scopes/derived-facts";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

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

const ID = "d1";
const BRIEF = "3m x 9m Kwila deck with steps";
const CONDITIONS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
];

function fact(
  key: string,
  value: unknown,
  source?: string,
  workAreaId = ID
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function wa(
  id: string,
  type: EstimateWorkArea["type"] = "deck",
  name = "Deck"
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function baseFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return [
    fact("deck.length_m", 3),
    fact("deck.width_m", 9),
    fact("deck.area_m2", 27),
    fact("deck.height_m", 0.4),
    fact("deck.board_material", "Kwila"),
    fact("deck.board_width_mm", 140),
    fact("deck.existing_deck_removal", false, "user"),
    fact("deck.vertical_face_boards_required", false, "user"),
    fact("deck.substructure_included", true, "user"),
    ...extra,
  ];
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(ID)],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function surfaces(facts: EstimateFact[], workAreas = [wa(ID)]) {
  const jobPlan = composeJobPlan({
    workAreas,
    facts,
    constraints: CONDITIONS,
    briefText: BRIEF,
    qualityLevel: "standard",
  });
  const clarify = composeClarifyView({
    stage: "work_area_questions",
    workAreas,
    facts,
    constraints: CONDITIONS,
    briefText: BRIEF,
    qualityLevel: "standard",
    jobPlan,
  });
  const refine = composeRefineView({
    workAreas,
    facts,
    constraints: CONDITIONS,
    briefText: BRIEF,
    qualityLevel: "standard",
    jobPlan,
  });
  const readiness = composeEstimateReadiness({
    clarify,
    jobPlan,
    qualityLevel: "standard",
    constraints: CONDITIONS,
  });
  const keys = [...clarify.candidates, ...clarify.deferred].flatMap((row) =>
    row.factKey ? [row.factKey] : []
  );
  return { jobPlan, clarify, refine, readiness, keys };
}

function commitNotSure(key: string) {
  return resolveCommittedFactWrite({
    key,
    value: "Not sure",
    valueType: "number",
  });
}

console.log("\n--- A steps excluded ---\n");

const off = surfaces(baseFacts([fact("deck.steps_included", false, "user")]));
const offMoney = calculateDeck(
  ctx(baseFacts([fact("deck.steps_included", false, "user")])),
  wa(ID)
);
check(
  "A1 width and going stay hidden when steps are excluded",
  !off.keys.includes("deck.step_width_m") &&
    !off.keys.includes("deck.step_going_m") &&
    !off.refine.highValue.some((row) => row.factKey === "deck.step_width_m") &&
    !off.refine.highValue.some((row) => row.factKey === "deck.step_going_m")
);
check(
  "A2 excluded steps do not block readiness and add no step money",
  off.readiness.enoughToEstimate === true &&
    !offMoney.lineItems.some((row) => row.label.startsWith("Step "))
);

console.log("\n--- B explicit dimensions ---\n");

const explicit = surfaces(
  baseFacts([
    fact("deck.steps_included", true, "user"),
    fact("deck.step_width_m", 1.5, "user"),
    fact("deck.step_going_m", 0.32, "user"),
  ])
);
check(
  "B1 user width and going are not asked twice",
  !explicit.keys.includes("deck.step_width_m") &&
    !explicit.keys.includes("deck.step_going_m") &&
    !explicit.refine.highValue.some((row) => row.factKey === "deck.step_width_m") &&
    !explicit.refine.highValue.some((row) => row.factKey === "deck.step_going_m")
);
check(
  "B2 explicit dimensions leave the estimate ready",
  explicit.readiness.enoughToEstimate === true &&
    explicit.clarify.enoughToEstimate === true
);

console.log("\n--- C width Not sure ---\n");

const widthCommit = commitNotSure("deck.step_width_m");
const widthOnly = surfaces(
  baseFacts([
    fact("deck.steps_included", true, "user"),
    fact("deck.step_width_m", widthCommit.value, widthCommit.source),
  ])
);
const widthRow = widthOnly.refine.highValue.find(
  (row) => row.factKey === "deck.step_width_m"
);
const widthMoney = calculateDeck(
  ctx(
    baseFacts([
      fact("deck.steps_included", true, "user"),
      fact("deck.step_width_m", widthCommit.value, widthCommit.source),
    ])
  ),
  wa(ID)
);
check(
  "C1 width Not sure persists 1.0 m as an assumption",
  widthCommit.source === "assumption" &&
    widthCommit.value === DEFAULT_STEP_WIDTH_M &&
    !widthOnly.keys.includes("deck.step_width_m") &&
    widthRow?.assumed === true &&
    widthRow.currentValue === DEFAULT_STEP_WIDTH_M &&
    widthRow.question === "How wide are the steps?"
);
check(
  "C2 width assumption is disclosed and going still blocks",
  widthMoney.assumptions.includes(STEP_WIDTH_ASSUMPTION_STATEMENT) &&
    widthOnly.keys.includes("deck.step_going_m") &&
    widthOnly.readiness.enoughToEstimate === false
);

console.log("\n--- D going Not sure ---\n");

const goingCommit = commitNotSure("deck.step_going_m");
const goingOnly = surfaces(
  baseFacts([
    fact("deck.steps_included", true, "user"),
    fact("deck.step_going_m", goingCommit.value, goingCommit.source),
  ])
);
const goingRow = goingOnly.refine.highValue.find(
  (row) => row.factKey === "deck.step_going_m"
);
const goingMoney = calculateDeck(
  ctx(
    baseFacts([
      fact("deck.steps_included", true, "user"),
      fact("deck.step_going_m", goingCommit.value, goingCommit.source),
    ])
  ),
  wa(ID)
);
check(
  "D1 going Not sure persists 0.28 m as an assumption",
  goingCommit.source === "assumption" &&
    goingCommit.value === DEFAULT_STEP_GOING_M &&
    !goingOnly.keys.includes("deck.step_going_m") &&
    goingRow?.assumed === true &&
    goingRow.currentValue === DEFAULT_STEP_GOING_M &&
    goingRow.question === "How deep are the stair treads?"
);
check(
  "D2 going assumption is disclosed and width still blocks",
  goingMoney.assumptions.some((row) => /assuming stair tread depth 280 mm/i.test(row)) &&
    goingOnly.keys.includes("deck.step_width_m") &&
    goingOnly.readiness.enoughToEstimate === false
);

console.log("\n--- E both assumptions ---\n");

const both = surfaces(
  baseFacts([
    fact("deck.steps_included", true, "user"),
    fact("deck.step_width_m", widthCommit.value, widthCommit.source),
    fact("deck.step_going_m", goingCommit.value, goingCommit.source),
  ])
);
check(
  "E1 both persisted assumptions clear readiness",
  !both.keys.includes("deck.step_width_m") &&
    !both.keys.includes("deck.step_going_m") &&
    both.readiness.enoughToEstimate === true &&
    both.refine.highValue.some((row) => row.factKey === "deck.step_width_m" && row.assumed === true) &&
    both.refine.highValue.some((row) => row.factKey === "deck.step_going_m" && row.assumed === true)
);

console.log("\n--- F ground clearance ---\n");

const gapOff = surfaces(baseFacts([fact("deck.steps_included", false, "user")]));
const gapCommit = commitNotSure("deck.ground_clearance_m");
const gapOn = surfaces(
  baseFacts([
    fact("deck.steps_included", false, "user"),
    fact("deck.skirting_included", true, "user"),
  ])
);
const gapAssumed = surfaces(
  baseFacts([
    fact("deck.steps_included", false, "user"),
    fact("deck.skirting_included", true, "user"),
    fact("deck.ground_clearance_m", gapCommit.value, gapCommit.source),
  ])
);
const gapUser = surfaces(
  baseFacts([
    fact("deck.steps_included", false, "user"),
    fact("deck.skirting_included", true, "user"),
    fact("deck.ground_clearance_m", 0.05, "user"),
  ])
);
check(
  "F1 ground clearance is irrelevant without skirting and does not block",
  !gapOff.keys.includes("deck.ground_clearance_m") &&
    gapOff.readiness.enoughToEstimate === true
);
check(
  "F2 skirting asks ground clearance until Not sure persists 20 mm",
  gapOn.keys.includes("deck.ground_clearance_m") &&
    gapCommit.source === "assumption" &&
    gapCommit.value === DEFAULT_FASCIA_GROUND_GAP_M &&
    !gapAssumed.keys.includes("deck.ground_clearance_m") &&
    gapAssumed.refine.highValue.some(
      (row) =>
        row.factKey === "deck.ground_clearance_m" &&
        row.assumed === true &&
        row.currentValue === DEFAULT_FASCIA_GROUND_GAP_M
    )
);
const gapUserRow = [...gapUser.refine.highValue, ...gapUser.refine.advanced].find(
  (row) => row.factKey === "deck.ground_clearance_m"
);
check(
  "F3 an explicit ground gap is user-owned and not re-asked",
  !gapUser.keys.includes("deck.ground_clearance_m") &&
    gapUserRow?.currentValue === 0.05 &&
    gapUserRow.assumed !== true
);

console.log("\n--- G re-analysis ---\n");

const keptUser = mergeDerivedFactsIntoRecords(
  [{ key: "deck.step_width_m", work_area_id: ID, value: 1.5, source: "user" }],
  [{ key: "deck.step_width_m", work_area_id: ID, value: 9, source: "derived" }]
);
const replacedAssumption = mergeDerivedFactsIntoRecords(
  [
    {
      key: "deck.step_going_m",
      work_area_id: ID,
      value: DEFAULT_STEP_GOING_M,
      source: "assumption",
    },
  ],
  [{ key: "deck.step_going_m", work_area_id: ID, value: 0.3, source: "derived" }]
);
check(
  "G1 user dimensions survive and assumed dimensions follow the merge rule",
  keptUser[0]?.value === 1.5 &&
    keptUser[0]?.source === "user" &&
    replacedAssumption[0]?.value === 0.3 &&
    replacedAssumption[0]?.source === "derived"
);
const afterMerge = surfaces(
  baseFacts([
    fact("deck.steps_included", true, "user"),
    fact("deck.step_width_m", 1.5, "user"),
    fact("deck.step_going_m", goingCommit.value, goingCommit.source),
  ])
);
check(
  "G2 re-analysis does not duplicate the remaining questions",
  afterMerge.keys.filter((key) => key === "deck.step_width_m").length === 0 &&
    afterMerge.keys.filter((key) => key === "deck.step_going_m").length === 0 &&
    afterMerge.refine.highValue.filter((row) => row.factKey === "deck.step_going_m").length === 1
);

console.log("\n--- H other Work Areas ---\n");

const otherTypes = ["doors", "flooring", "internal_walls", "ceilings", "cladding"] as const;
const otherAreas = otherTypes.map((type, index) =>
  wa(`w${index}`, type, type)
);
const otherFacts = otherAreas.map((area) =>
  fact("note.placeholder", "present", "user", area.id)
);
const beforeOthers = surfaces(otherFacts, otherAreas);
const afterOthers = surfaces(
  [
    ...otherFacts,
    fact("deck.step_width_m", widthCommit.value, widthCommit.source),
    fact("deck.steps_included", true, "user"),
  ],
  [...otherAreas, wa(ID)]
);
const keysFor = (
  view: ReturnType<typeof surfaces>,
  workAreaId: string
) =>
  [...view.clarify.candidates, ...view.clarify.deferred]
    .filter((row) => row.workAreaId === workAreaId)
    .map((row) => row.factKey ?? row.constraintKey)
    .join("|");
check(
  "H1 a Deck assumption does not change other Work Area questions",
  otherAreas.every(
    (area) => keysFor(beforeOthers, area.id) === keysFor(afterOthers, area.id)
  ) &&
    DOORS_V1_HUMAN_QA_FROZEN === true &&
    FLOORING_V1_HUMAN_QA_FROZEN === true &&
    CLADDING_V1_HUMAN_QA_FROZEN === true
);

console.log("\n--- I golden commercial equality ---\n");

const SAFETY_COST = 14574.7;
const SAFETY_SELL = 18218.38;
const goldenFacts = [
  fact("deck.area_m2", 36),
  fact("deck.board_material", "Hardwood"),
  fact("deck.board_width_mm", 140),
  fact("deck.height_m", 0.8),
];
const goldenRates: never[] = [];
const factsBefore = JSON.stringify(goldenFacts);
const ratesBefore = JSON.stringify(goldenRates);
const golden = calculateDeck(
  { ...ctx(goldenFacts), rates: goldenRates } as EstimateContext,
  wa(ID)
);
const totals = sumIncludedLineItems(golden.lineItems);
const gst = round2(totals.recommendedSell * (DEFAULT_GST_RATE / 100));
const decking = golden.lineItems.find((row) => row.label === "Decking");
const labour = golden.lineItems.find((row) => row.label === "Deck labour");
check(
  "I1 golden decking, hours, cost, GST and sell stay unchanged",
  decking?.quantity === 282.85 &&
    labour?.quantity === 36 &&
    labour.labourHours === 52.2 &&
    totalLabourHours(golden.lineItems) === 52.2 &&
    round2(totals.recommendedCost) === SAFETY_COST &&
    round2(totals.recommendedSell) === SAFETY_SELL &&
    gst === 2732.76 &&
    round2(totals.recommendedSell + gst) === 20951.14 &&
    !golden.lineItems.some((row) => row.label === "Existing deck removal") &&
    JSON.stringify(goldenFacts) === factsBefore &&
    JSON.stringify(goldenRates) === ratesBefore
);
const narrow = calculateDeck(
  ctx(
    baseFacts([
      fact("deck.steps_included", true, "user"),
      fact("deck.step_width_m", 1, "user"),
      fact("deck.step_going_m", 0.28, "user"),
    ])
  ),
  wa(ID)
);
const wide = calculateDeck(
  ctx(
    baseFacts([
      fact("deck.steps_included", true, "user"),
      fact("deck.step_width_m", 1.8, "user"),
      fact("deck.step_going_m", 0.35, "user"),
    ])
  ),
  wa(ID)
);
const fingerprint = (result: ReturnType<typeof calculateDeck>) =>
  result.lineItems
    .filter((row) => !row.label.startsWith("Step"))
    .map((row) => `${row.label}:${row.quantity}`)
    .join("|");
check(
  "I2 width and going change step lines only",
  (wide.lineItems.find((row) => row.label === "Step decking")?.quantity ?? 0) >
    (narrow.lineItems.find((row) => row.label === "Step decking")?.quantity ?? 0) &&
    fingerprint(narrow) === fingerprint(wide)
);
const pricing = buildPricingItemFieldsFromEstimateLineItem({
  category: decking?.category ?? "materials",
  recommended_cost: decking?.recommendedCost ?? 0,
  recommended_sell: decking?.recommendedSell ?? 0,
  notes: decking?.notes ?? null,
});
const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "deck",
  name: "Deck",
  facts: [
    { key: "deck.area_m2", label: "Area", value: "36" },
    { key: "deck.board_material", label: "Material", value: "Hardwood" },
  ],
  pricingItems: [],
});
check(
  "I3 Pricing keeps decking COST and Quote keeps the hardwood area",
  pricing.totalCost === decking?.recommendedCost &&
    /hardwood/i.test(quote) &&
    /36/.test(quote)
);

console.log(`\nPLATFORM-02A  ${passed} passed / ${failed} failed\n`);
if (failed > 0) process.exit(1);

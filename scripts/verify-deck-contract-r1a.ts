/**
 * DECK-CONTRACT-R1A — step-dimension ownership.
 *
 * Unresolved step width and going stay in Details.
 * A captured assumption, Not sure, or a non-user deck-edge width is a
 * Refine Improve row. A user edit is user-owned, leaves Improve, and
 * survives re-analysis. Width and going move step quantities only.
 *
 * Run: npx --yes tsx scripts/verify-deck-contract-r1a.ts
 */
import { readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { resolveCommittedFactWrite } from "../lib/assistant/scope-persistence";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  getConsumedFactConsumption,
  isCommercialConsumedFact,
} from "../lib/estimate/consumed-facts";
import {
  DECK_INFORMATION_CONTRACT,
  deckFactQuestionClass,
} from "../lib/estimate/deck-information-contract";
import {
  classifyDeckStepDimensionForRefine,
  DEFAULT_STEP_GOING_M,
  DEFAULT_STEP_WIDTH_M,
} from "../lib/estimate/deck-steps-physical";
import { round2 } from "../lib/estimate/facts";
import {
  sumIncludedLineItems,
  totalLabourHours,
} from "../lib/estimate/pricing-ownership";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { mergeDerivedFactsIntoRecords } from "../lib/scopes/derived-facts";
import { getQuestionTemplateByKey } from "../lib/scopes/registry";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItem,
  EstimateLineItemInput,
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

const SAFETY_COST = 14574.7;
const SAFETY_SELL = 18218.38;
const SAFETY_HOURS = 52.2;
const SAFETY_DECKING_LM = 282.85;
const ID = "d1";

function fact(
  key: string,
  value: unknown,
  source?: string,
  workAreaId = ID
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function wa(id = ID): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
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
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function safetyFacts(): EstimateFact[] {
  return [
    fact("deck.area_m2", 36),
    fact("deck.board_material", "Hardwood"),
    fact("deck.board_width_mm", 140),
    fact("deck.height_m", 0.8),
  ];
}

function stepFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return [
    fact("deck.length_m", 3),
    fact("deck.width_m", 9),
    fact("deck.area_m2", 27),
    fact("deck.height_m", 0.14),
    fact("deck.board_material", "Kwila"),
    fact("deck.board_width_mm", 140),
    fact("deck.steps_included", true, "user"),
    fact("deck.step_count", 3, "user"),
    ...extra,
  ];
}

function views(facts: EstimateFact[], briefText: string) {
  const workAreas = [wa()];
  const jobPlan = composeJobPlan({
    workAreas,
    facts,
    constraints: [],
    briefText,
    qualityLevel: "standard",
  });
  const clarify = composeClarifyView({
    stage: "work_area_questions",
    workAreas,
    facts,
    constraints: [],
    briefText,
    qualityLevel: "standard",
    jobPlan,
  });
  const refine = composeRefineView({
    workAreas,
    facts,
    constraints: [],
    briefText,
    qualityLevel: "standard",
    jobPlan,
  });
  const clarifyKeys = [...clarify.candidates, ...clarify.deferred].flatMap((row) =>
    row.factKey ? [row.factKey] : []
  );
  return { jobPlan, clarify, refine, clarifyKeys };
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
  }));
}

console.log("\n--- A step-scope boolean ---\n");

const stepsTemplate = getQuestionTemplateByKey("deck.steps_included");
const unresolvedSteps = views(
  [
    fact("deck.area_m2", 36),
    fact("deck.board_material", "Hardwood"),
    fact("deck.height_m", 1.4),
  ],
  "Build a new deck with steps"
);
check(
  "A1 steps_included is an ASK_NOW boolean scope toggle",
  deckFactQuestionClass("deck.steps_included") === "ASK_NOW" &&
    stepsTemplate?.inputType === "boolean"
);
check(
  "A2 unresolved steps_included stays in Details",
  unresolvedSteps.clarifyKeys.includes("deck.steps_included") &&
    !unresolvedSteps.refine.highValue.some((row) => row.factKey === "deck.steps_included") &&
    !unresolvedSteps.refine.advanced.some((row) => row.factKey === "deck.steps_included")
);
const stepsOn = views(stepFacts(), "Kwila deck with steps");
const stepsWrite = stepsOn.jobPlan.cards[0]?.included.find(
  (row) => row.sourceFactKey === "deck.steps_included"
);
const stepsRefine = [...stepsOn.refine.highValue, ...stepsOn.refine.advanced].find(
  (row) => row.factKey === "deck.steps_included"
);
check(
  "A3 a resolved steps toggle stays on the Job Plan and is Refine-editable",
  stepsWrite?.write?.valueType === "boolean" &&
    stepsOn.jobPlan.cards[0]?.included.some(
      (row) => row.sourceFactKey === "deck.steps_included"
    ) === true &&
    stepsRefine?.currentValue === true &&
    stepsRefine.assumed !== true
);
check(
  "A4 steps_included is consumed commercially",
  getConsumedFactConsumption("deck", "deck.steps_included")?.commercial === true &&
    isCommercialConsumedFact("deck", "deck.steps_included")
);

console.log("\n--- B count, width, going ownership ---\n");

check(
  "B1 step_count is a Refine physical override and not commercial money",
  deckFactQuestionClass("deck.step_count") === "REFINE" &&
    getConsumedFactConsumption("deck", "deck.step_count")?.physical === true &&
    getConsumedFactConsumption("deck", "deck.step_count")?.commercial === false
);
const contractRow = (key: string) =>
  DECK_INFORMATION_CONTRACT.find((row) => row.factKey === key);
check(
  "B2 width and going are Details assumptions with physical and commercial effect",
  deckFactQuestionClass("deck.step_width_m") === "ASSUME_IF_SKIPPED" &&
    deckFactQuestionClass("deck.step_going_m") === "ASSUME_IF_SKIPPED" &&
    contractRow("deck.step_width_m")?.physical === true &&
    contractRow("deck.step_width_m")?.commercial === true &&
    contractRow("deck.step_going_m")?.physical === true &&
    contractRow("deck.step_going_m")?.commercial === true &&
    getConsumedFactConsumption("deck", "deck.step_width_m")?.physical === true &&
    getConsumedFactConsumption("deck", "deck.step_going_m")?.physical === true
);
const widthTemplate = getQuestionTemplateByKey("deck.step_width_m");
const goingTemplate = getQuestionTemplateByKey("deck.step_going_m");
check(
  "B3 width and going use the canonical number questions",
  widthTemplate?.label === "Step width" &&
    widthTemplate.questionText === "How wide are the steps?" &&
    widthTemplate.estimatePriorityClass === "P2" &&
    goingTemplate?.label === "Tread depth" &&
    goingTemplate.questionText === "How deep are the stair treads?"
);
check(
  "B4 unresolved width and going are Details-owned",
  classifyDeckStepDimensionForRefine({
    facts: stepFacts(),
    workAreaId: ID,
    factKey: "deck.step_width_m",
  }).surface === "details" &&
    classifyDeckStepDimensionForRefine({
      facts: stepFacts(),
      workAreaId: ID,
      factKey: "deck.step_going_m",
    }).surface === "details"
);

console.log("\n--- C Details versus Refine ---\n");

const unresolvedDimensions = views(stepFacts(), "Kwila deck with steps");
check(
  "C1 unresolved width and going are asked in Details only",
  unresolvedDimensions.clarifyKeys.includes("deck.step_width_m") &&
    unresolvedDimensions.clarifyKeys.includes("deck.step_going_m") &&
    !unresolvedDimensions.refine.highValue.some((row) => row.factKey === "deck.step_width_m") &&
    !unresolvedDimensions.refine.highValue.some((row) => row.factKey === "deck.step_going_m") &&
    !unresolvedDimensions.refine.advanced.some((row) => row.factKey === "deck.step_width_m") &&
    !unresolvedDimensions.refine.advanced.some((row) => row.factKey === "deck.step_going_m")
);
const assumedFacts = stepFacts([
  fact("deck.step_width_m", DEFAULT_STEP_WIDTH_M, "assumption"),
  fact("deck.step_going_m", DEFAULT_STEP_GOING_M, "assumption"),
]);
const assumed = views(assumedFacts, "Kwila deck with steps");
const assumedWidth = assumed.refine.highValue.find((row) => row.factKey === "deck.step_width_m");
const assumedGoing = assumed.refine.highValue.find((row) => row.factKey === "deck.step_going_m");
check(
  "C2 captured assumptions move to Refine Improve and leave Details",
  assumedWidth?.assumed === true &&
    assumedWidth.currentValue === DEFAULT_STEP_WIDTH_M &&
    assumedWidth.label === "Step width" &&
    assumedWidth.question === "How wide are the steps?" &&
    assumedGoing?.assumed === true &&
    assumedGoing.currentValue === DEFAULT_STEP_GOING_M &&
    assumedGoing.question === "How deep are the stair treads?" &&
    !assumed.clarifyKeys.includes("deck.step_width_m") &&
    !assumed.clarifyKeys.includes("deck.step_going_m")
);
const notSureFacts = stepFacts([fact("deck.step_width_m", "Not sure")]);
const notSure = views(notSureFacts, "Kwila deck with steps");
const notSureRow = notSure.refine.highValue.find((row) => row.factKey === "deck.step_width_m");
check(
  "C3 Not sure discloses the 1.0 m assumption in Refine only",
  notSureRow?.assumed === true &&
    notSureRow.currentValue === DEFAULT_STEP_WIDTH_M &&
    !notSure.clarifyKeys.includes("deck.step_width_m") &&
    notSure.clarifyKeys.includes("deck.step_going_m")
);
const edgeFacts = stepFacts([fact("deck.step_width_m", 9)]);
const edge = views(edgeFacts, "Kwila deck with steps");
const edgeRow = edge.refine.highValue.find((row) => row.factKey === "deck.step_width_m");
check(
  "C4 a non-user deck-edge width is the disclosed 1.0 m Improve row",
  edgeRow?.assumed === true &&
    edgeRow.currentValue === DEFAULT_STEP_WIDTH_M &&
    edgeRow.question === "How wide are the steps?" &&
    !edge.clarifyKeys.includes("deck.step_width_m")
);
const stepsOff = views(
  [...safetyFacts(), fact("deck.steps_included", false, "user")],
  "Hardwood deck"
);
check(
  "C5 steps off hides width and going from Details and Refine",
  !stepsOff.clarifyKeys.includes("deck.step_width_m") &&
    !stepsOff.clarifyKeys.includes("deck.step_going_m") &&
    !stepsOff.refine.highValue.some((row) => row.factKey === "deck.step_width_m") &&
    !stepsOff.refine.highValue.some((row) => row.factKey === "deck.step_going_m")
);

console.log("\n--- D authority and re-analysis ---\n");

const userWrite = resolveCommittedFactWrite({
  key: "deck.step_width_m",
  value: 1.5,
  valueType: "number",
});
const skippedWrite = resolveCommittedFactWrite({
  key: "deck.step_going_m",
  value: "Not sure",
});
check(
  "D1 a dimension edit becomes user-owned and Not sure stays an assumption",
  userWrite.source === "user" &&
    userWrite.value === 1.5 &&
    skippedWrite.source === "assumption" &&
    skippedWrite.value === DEFAULT_STEP_GOING_M
);
const userFacts = stepFacts([
  fact("deck.step_width_m", userWrite.value, userWrite.source),
  fact("deck.step_going_m", skippedWrite.value, skippedWrite.source),
]);
const userView = views(userFacts, "Kwila deck with steps");
check(
  "D2 a user width leaves Improve and the assumed going stays there",
  !userView.refine.highValue.some((row) => row.factKey === "deck.step_width_m") &&
    userView.refine.advanced.some(
      (row) => row.factKey === "deck.step_width_m" && row.currentValue === 1.5 && row.assumed !== true
    ) &&
    userView.refine.highValue.some(
      (row) => row.factKey === "deck.step_going_m" && row.assumed === true
    ) &&
    !userView.clarifyKeys.includes("deck.step_width_m") &&
    !userView.clarifyKeys.includes("deck.step_going_m")
);
const kept = mergeDerivedFactsIntoRecords(
  [{ key: "deck.step_width_m", work_area_id: ID, value: 1.5, source: "user" }],
  [{ key: "deck.step_width_m", work_area_id: ID, value: 9, source: "derived" }]
);
const extracted = mergeDerivedFactsIntoRecords(
  [{ key: "deck.step_width_m", work_area_id: ID, value: 1.2, source: "ai_extracted" }],
  [{ key: "deck.step_width_m", work_area_id: ID, value: 1.4, source: "derived" }]
);
const otherArea = mergeDerivedFactsIntoRecords(
  [{ key: "flooring.area_m2", work_area_id: "f1", value: 20, source: "user" }],
  [{ key: "flooring.area_m2", work_area_id: "f1", value: 12, source: "derived" }]
);
check(
  "D3 user-owned dimensions survive re-analysis and extracted dimensions update",
  kept[0]?.value === 1.5 &&
    kept[0]?.source === "user" &&
    extracted[0]?.value === 1.4 &&
    extracted[0]?.source === "derived"
);
check(
  "D4 the same public merge leaves a user-owned Flooring fact untouched",
  otherArea[0]?.value === 20 && otherArea[0]?.source === "user"
);
const actions = readFileSync("lib/assistant/actions.ts", "utf8");
const factsSource = readFileSync("lib/estimate/facts.ts", "utf8");
check(
  "D5 re-analysis still uses the public user-source guard",
  actions.includes('if (existing?.source === "user")') &&
    actions.includes('.eq("project_id", projectId)') &&
    !actions.includes("userOwnedFactBlocksReanalysisOverwrite") &&
    !factsSource.includes("userOwnedFactBlocksReanalysisOverwrite")
);
check(
  "D6 frozen Work Areas and the wall-count boundary stay unchanged",
  DOORS_V1_HUMAN_QA_FROZEN === true &&
    FLOORING_V1_HUMAN_QA_FROZEN === true &&
    CLADDING_V1_HUMAN_QA_FROZEN === true &&
    getConsumedFactConsumption("internal_walls", "internal_walls.wall_type.wall_count")
      ?.commercial === false
);

console.log("\n--- E quantity and commercial isolation ---\n");

const safety = calculateDeck(ctx(safetyFacts()), wa());
const safetyTotals = sumIncludedLineItems(safety.lineItems);
const safetyGst = round2(safetyTotals.recommendedSell * (DEFAULT_GST_RATE / 100));
const decking = safety.lineItems.find((row) => row.label === "Decking");
const labour = safety.lineItems.find((row) => row.label === "Deck labour");
check(
  "E1 golden decking, labour, cost and sell stay unchanged",
  decking?.quantity === SAFETY_DECKING_LM &&
    labour?.quantity === 36 &&
    labour?.unit === "m²" &&
    labour.labourHours === SAFETY_HOURS &&
    totalLabourHours(safety.lineItems) === SAFETY_HOURS &&
    round2(safetyTotals.recommendedCost) === SAFETY_COST &&
    round2(safetyTotals.recommendedSell) === SAFETY_SELL &&
    safetyGst === 2732.76 &&
    round2(safetyTotals.recommendedSell + safetyGst) === 20951.14
);
check(
  "E2 golden removal stays absent",
  !safety.lineItems.some((row) => row.label === "Existing deck removal")
);
const narrow = calculateDeck(
  ctx(stepFacts([fact("deck.step_width_m", 1, "user"), fact("deck.step_going_m", 0.28, "user")])),
  wa()
);
const wide = calculateDeck(
  ctx(stepFacts([fact("deck.step_width_m", 1.8, "user"), fact("deck.step_going_m", 0.28, "user")])),
  wa()
);
const deeper = calculateDeck(
  ctx(stepFacts([fact("deck.step_width_m", 1.8, "user"), fact("deck.step_going_m", 0.35, "user")])),
  wa()
);
const stepQty = (result: ReturnType<typeof calculateDeck>, label: string) =>
  result.lineItems.find((row) => row.label === label)?.quantity ?? 0;
const deckingLm = (result: ReturnType<typeof calculateDeck>) =>
  result.lineItems.find((row) => row.label === "Decking")?.quantity;
const nonStepFingerprint = (result: ReturnType<typeof calculateDeck>) =>
  result.lineItems
    .filter((row) => !row.label.startsWith("Step"))
    .map((row) => `${row.label}:${row.quantity}:${row.labourHours ?? ""}`)
    .join("|");
check(
  "E3 width and going change step quantities only",
  stepQty(wide, "Step decking") > stepQty(narrow, "Step decking") &&
    stepQty(deeper, "Step decking") > stepQty(wide, "Step decking") &&
    deckingLm(narrow) === deckingLm(wide) &&
    deckingLm(wide) === deckingLm(deeper) &&
    nonStepFingerprint(narrow) === nonStepFingerprint(wide) &&
    nonStepFingerprint(wide) === nonStepFingerprint(deeper)
);
const stepsOffMoney = calculateDeck(
  ctx([...safetyFacts(), fact("deck.steps_included", false, "user")]),
  wa()
);
check(
  "E4 steps off does not add step lines or move the golden deck",
  !stepsOffMoney.lineItems.some((row) => row.label.startsWith("Step ")) &&
    stepsOffMoney.lineItems.find((row) => row.label === "Decking")?.quantity === SAFETY_DECKING_LM &&
    round2(sumIncludedLineItems(stepsOffMoney.lineItems).recommendedCost) === SAFETY_COST
);
const unresolvedMoney = calculateDeck(ctx(stepFacts()), wa());
check(
  "E5 unresolved dimensions disclose assumptions without moving decking lm",
  unresolvedMoney.assumptions.some((row) => /assuming 1\.0 m step width/i.test(row)) &&
    unresolvedMoney.assumptions.some((row) => /assuming stair tread depth 280 mm/i.test(row)) &&
    unresolvedMoney.lineItems.some((row) => row.label === "Step decking") &&
    deckingLm(unresolvedMoney) != null
);
const userMoney = calculateDeck(
  ctx(stepFacts([fact("deck.step_width_m", 1.5, "user")])),
  wa()
);
check(
  "E6 a user width replaces the width assumption and keeps decking lm",
  !userMoney.assumptions.some((row) => /assuming 1\.0 m step width/i.test(row)) &&
    userMoney.assumptions.some((row) => /assuming stair tread depth 280 mm/i.test(row)) &&
    deckingLm(userMoney) === deckingLm(unresolvedMoney) &&
    stepQty(userMoney, "Step decking") !== stepQty(unresolvedMoney, "Step decking")
);

console.log("\n--- F Builder Review, Pricing, Quote ---\n");

const review = composeBuilderReview({
  estimate: {
    recommendedCost: safetyTotals.recommendedCost,
    recommendedSell: safetyTotals.recommendedSell,
    marginPercent: 20,
    confidence: safety.confidence,
    assumptions: safety.assumptions,
    missingInfo: safety.missingInfo,
    lineItems: mapCalcLines(safety.lineItems),
  },
  workAreas: [{ id: ID, name: "Deck", type: "deck", status: "confirmed" }],
  requirements: safety.requirements ?? [],
});
check(
  "F1 Builder Review cost still matches the golden direct COST",
  review.workAreas.length === 1 &&
    round2(review.workAreas[0]?.cost ?? 0) === SAFETY_COST &&
    review.costReconciles === true
);
const pricing = buildPricingItemFieldsFromEstimateLineItem({
  category: decking?.category ?? "materials",
  recommended_cost: decking?.recommendedCost ?? 0,
  recommended_sell: decking?.recommendedSell ?? 0,
  notes: decking?.notes ?? null,
});
check(
  "F2 Pricing still keeps the golden decking cost",
  pricing.totalCost === decking?.recommendedCost
);
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
  "F3 Quote still names the hardwood deck",
  /hardwood/i.test(quote) && /36/.test(quote)
);

console.log("\n--- G previous R8 assertions ---\n");

check(
  "G1 R8 going assumption is Details until captured, then Refine Improve",
  unresolvedDimensions.clarifyKeys.includes("deck.step_going_m") &&
    !unresolvedDimensions.refine.highValue.some((row) => row.factKey === "deck.step_going_m") &&
    assumedGoing?.factKey === "deck.step_going_m"
);
check(
  "G2 R8-R1 assumed width is the Refine Improve row and a user width is not",
  assumedWidth?.question === "How wide are the steps?" &&
    !userView.refine.highValue.some((row) => row.factKey === "deck.step_width_m")
);

console.log(`\nDECK-CONTRACT-R1A  ${passed} passed / ${failed} failed\n`);
if (failed > 0) process.exit(1);

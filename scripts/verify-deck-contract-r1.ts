/**
 * DECK-CONTRACT-R1 — Deck refine keys and scalar adapter contract.
 *
 * Calls production Deck, Refine, Job Plan, Builder Review, and Quote paths.
 * Run: npx --yes tsx scripts/verify-deck-contract-r1.ts
 */
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  DECK_JOB_PLAN_ADAPTER_CONTRACT,
  deckJobPlanAdapter,
} from "../lib/assistant/job-plan/adapters/deck";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  DECK_REFINE_EXCLUDED_KEYS,
  deckRefineAdapter,
} from "../lib/assistant/refine/adapters/deck";
import { listRefineAdapters } from "../lib/assistant/refine/adapters/registry";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import {
  DECK_CALCULATOR_CONSUMED_FACTS,
  calculateDeck,
} from "../lib/estimate/calculators/deck";
import { INTERNAL_WALLS_CALCULATOR_CONSUMED_FACTS } from "../lib/estimate/calculators/fitout";
import {
  getConsumedFactConsumption,
  isCalculatorConsumedFact,
  isCommercialConsumedFact,
  refineFactsAreContractBacked,
  SHARED_CONSUMED_CONSTRAINT_KEYS,
} from "../lib/estimate/consumed-facts";
import { DECK_INFORMATION_CONTRACT } from "../lib/estimate/deck-information-contract";
import { round2 } from "../lib/estimate/facts";
import {
  sumIncludedLineItems,
  totalLabourHours,
} from "../lib/estimate/pricing-ownership";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { resolveCommittedFactWrite } from "../lib/assistant/scope-persistence";
import { mergeDerivedFactsIntoRecords } from "../lib/scopes/derived-facts";
import { getQuestionTemplateByKey } from "../lib/scopes/registry";
import { filterIntegralDeckExternalStairsWorkAreas, shouldSuggestExternalStairs } from "../lib/scopes/deck-stairs-boundary";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";
import { filterTopLevelWorkAreas } from "../lib/work-areas/ownership";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
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

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}

function ctx(id: string, facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(id)],
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
    fact("deck.area_m2", "d1", 36),
    fact("deck.board_material", "d1", "Hardwood"),
    fact("deck.board_width_mm", "d1", 140),
    fact("deck.height_m", "d1", 0.8),
  ];
}

function booleanWrite(factKey: string, label: string) {
  return {
    id: factKey,
    label,
    sourceFactKey: factKey,
    workAreaId: "d1",
    write: {
      factKey,
      valueType: "boolean" as const,
      includeValue: true,
      excludeValue: false,
      label,
    },
  };
}

function adapterKeys(
  notConfirmed: ReturnType<typeof booleanWrite>[] = [],
  facts: EstimateFact[] = []
): string[] {
  return deckRefineAdapter
    .candidates({
      workAreaId: "d1",
      workAreaName: "Deck",
      facts,
      briefText: null,
      notConfirmed,
    })
    .map((row) => row.factKey)
    .filter((key): key is string => Boolean(key));
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
    rateSourceType: item.rateSourceType,
  }));
}

const safety = calculateDeck(ctx("d1", safetyFacts()), wa("d1"));
const safetyTotals = sumIncludedLineItems(safety.lineItems);
const safetyGst = round2(safetyTotals.recommendedSell * (DEFAULT_GST_RATE / 100));
const decking = safety.lineItems.find((row) => row.label === "Decking");
const labour = safety.lineItems.find((row) => row.label === "Deck labour");

const safetyNotConfirmed = [
  booleanWrite("deck.existing_deck_removal", "Existing deck removal"),
  booleanWrite("deck.vertical_face_boards_required", "Fascia"),
  booleanWrite("deck.steps_included", "Steps"),
  booleanWrite("deck.balustrade_required", "Balustrade"),
];
const safetyRefineKeys = adapterKeys(safetyNotConfirmed);
const safetyRefineRows = deckRefineAdapter.candidates({
  workAreaId: "d1",
  workAreaName: "Deck",
  facts: [],
  briefText: null,
  notConfirmed: safetyNotConfirmed,
});

console.log("=== DECK-CONTRACT-R1 ===\n");
console.log("--- A canonical fact inventory ---\n");

const contractKeys = new Set(DECK_INFORMATION_CONTRACT.map((row) => row.factKey));
check(
  "A1 every information-contract Deck fact uses a deck. or shared Project Conditions key",
  DECK_INFORMATION_CONTRACT.every(
    (row) =>
      row.factKey.startsWith("deck.") ||
      row.factKey === "site_access" ||
      row.factKey === "material_carry_distance"
  )
);
check(
  "A2 consumed geometry, height, removal, fascia, steps and balustrade keys are canonical",
  [
    "deck.area_m2",
    "deck.length_m",
    "deck.width_m",
    "deck.height_m",
    "deck.existing_deck_removal",
    "deck.vertical_face_boards_required",
    "deck.steps_included",
    "deck.balustrade_required",
  ].every((key) => contractKeys.has(key) && isCalculatorConsumedFact("deck", key))
);
check(
  "A3 substructure, piles, bearers, joists and footings stay on canonical Deck keys",
  [
    "deck.substructure_included",
    "deck.pile_or_post_count",
    "deck.bearer_row_count",
    "deck.joist_section",
    "deck.supports_per_bearer",
    "deck.footing_depth_mm",
  ].every((key) => contractKeys.has(key))
);
check(
  "A4 decking material, fascia, steps geometry and concrete use canonical keys",
  [
    "deck.board_material",
    "deck.board_width_mm",
    "deck.fascia_material",
    "deck.skirting_included",
    "deck.step_width_m",
    "deck.step_going_m",
    "deck.concrete_to_supports",
    "deck.concrete_bags_per_hole",
  ].every((key) => isCalculatorConsumedFact("deck", key))
);
check(
  "A5 pergola is not consumed",
  isCalculatorConsumedFact("deck", "deck.pergola_included") === false &&
    DECK_INFORMATION_CONTRACT.find((row) => row.factKey === "deck.pergola_included")
      ?.questionClass === "NOT_CONSUMED"
);
check(
  "A6 disposal is not a Deck fact",
  isCalculatorConsumedFact("deck", "deck.disposal_required") === false &&
    isCalculatorConsumedFact("deck", "deck.disposal_included") === false
);
check(
  "A7 Project Conditions stay shared keys",
  contractKeys.has("site_access") &&
    contractKeys.has("material_carry_distance") &&
    !contractKeys.has("deck.site_access") &&
    (SHARED_CONSUMED_CONSTRAINT_KEYS as readonly string[]).includes("site_access")
);
check(
  "A8 legacy aliases remain readable and are not the canonical contract rows",
  ["deck.material", "deck.demolition_required", "deck.has_stairs", "deck.has_balustrade"].every(
    (key) => isCalculatorConsumedFact("deck", key) && !contractKeys.has(key)
  )
);

console.log("\n--- B refine-key registration ---\n");

check(
  "B1 safety refine keys are the four consumed Job Plan writes",
  safetyRefineKeys.includes("deck.existing_deck_removal") &&
    safetyRefineKeys.includes("deck.vertical_face_boards_required") &&
    safetyRefineKeys.includes("deck.steps_included") &&
    safetyRefineKeys.includes("deck.balustrade_required") &&
    safetyRefineKeys.length === 4
);
check(
  "B2 those refine keys are contract-backed",
  refineFactsAreContractBacked("deck", safetyRefineKeys)
);
check(
  "B3 empty Job Plan emits no Deck refine keys",
  adapterKeys([]).length === 0 && refineFactsAreContractBacked("deck", adapterKeys([]))
);
check(
  "B4 skirting and concrete remain registered when the Job Plan asks them",
  adapterKeys([
    booleanWrite("deck.skirting_included", "Skirting"),
    booleanWrite("deck.concrete_to_supports", "Concrete"),
  ]).every((key) =>
    ["deck.skirting_included", "deck.concrete_to_supports"].includes(key)
  ) &&
    adapterKeys([
      booleanWrite("deck.skirting_included", "Skirting"),
      booleanWrite("deck.concrete_to_supports", "Concrete"),
    ]).length === 2
);
check(
  "B5 pergola and a false consumed key are not offered",
  adapterKeys([
    booleanWrite("deck.pergola_included", "Pergola"),
    booleanWrite("retaining_wall.gabion_mesh", "Gabion"),
  ]).length === 0
);
check(
  "B6 legacy aliases are not presented as refine keys",
  DECK_REFINE_EXCLUDED_KEYS.every((key) => !adapterKeys([booleanWrite(key, key)]).includes(key))
);
check(
  "B7 joist section and centres stay out of Refine",
  !adapterKeys([
    booleanWrite("deck.joist_section", "Joists"),
    booleanWrite("deck.joist_centres_mm", "Centres"),
  ]).some((key) => key === "deck.joist_section" || key === "deck.joist_centres_mm")
);
check(
  "B8 concrete bags are offered only after concrete is included",
  adapterKeys([], [fact("deck.concrete_to_supports", "d1", true)]).includes(
    "deck.concrete_bags_per_hole"
  ) &&
    !adapterKeys([], [fact("deck.concrete_to_supports", "d1", false)]).includes(
      "deck.concrete_bags_per_hole"
    )
);

console.log("\n--- C value types and units ---\n");

check(
  "C1 removal, fascia, steps and balustrade stay boolean",
  safetyRefineRows.every((row) => row.inputType === "boolean" && row.write?.valueType === "boolean")
);
check(
  "C2 boolean refine rows do not carry select options",
  safetyRefineRows.every((row) => row.options == null)
);
check(
  "C3 concrete bags are numeric",
  deckRefineAdapter
    .candidates({
      workAreaId: "d1",
      workAreaName: "Deck",
      facts: [fact("deck.concrete_to_supports", "d1", true)],
      briefText: null,
      notConfirmed: [],
    })
    .every((row) => row.factKey !== "deck.concrete_bags_per_hole" || row.inputType === "number")
);
const conditionTemplate = getQuestionTemplateByKey("deck.substructure_condition");
const conditionRow = deckRefineAdapter.candidates({
  workAreaId: "d1",
  workAreaName: "Deck",
  facts: [fact("deck.substructure_included", "d1", false)],
  briefText: null,
  notConfirmed: [
    {
      id: "condition",
      label: "Substructure condition",
      sourceFactKey: "deck.substructure_condition",
      workAreaId: "d1",
      write: {
        factKey: "deck.substructure_condition",
        valueType: "select",
        includeValue: "good_existing",
        excludeValue: "none",
        label: "Substructure condition",
      },
    },
  ],
})[0];
check(
  "C4 substructure condition options match the persisted template",
  conditionRow?.inputType === "select" &&
    JSON.stringify(conditionRow.options) === JSON.stringify(conditionTemplate?.options)
);
const widthTemplate = getQuestionTemplateByKey("deck.board_width_mm");
const widthRow = deckRefineAdapter.candidates({
  workAreaId: "d1",
  workAreaName: "Deck",
  facts: [],
  briefText: null,
  notConfirmed: [
    {
      id: "width",
      label: "Board width",
      sourceFactKey: "deck.board_width_mm",
      workAreaId: "d1",
      write: {
        factKey: "deck.board_width_mm",
        valueType: "select",
        includeValue: "140",
        excludeValue: "90",
        label: "Board width",
      },
    },
  ],
})[0];
check(
  "C5 board width keeps the millimetre unit",
  widthRow?.unit === widthTemplate?.unit && widthTemplate?.unit === "mm"
);
check(
  "C6 write fact key matches the canonical source key",
  safetyRefineRows.every((row) => row.write?.factKey === row.factKey)
);

console.log("\n--- D ownership ---\n");

check(
  "D1 refine rows are Deck-owned",
  safetyRefineRows.every((row) => row.workAreaType === "deck" && row.factKey?.startsWith("deck."))
);
check(
  "D2 Project Conditions are not copied into Deck fact keys",
  safetyRefineRows.every((row) => row.constraintKey == null) &&
    !safetyRefineKeys.some((key) => key === "site_access" || key === "deck.site_access")
);
check(
  "D3 a mismatched write target is dropped",
  adapterKeys([
    {
      id: "bad",
      label: "Removal",
      sourceFactKey: "deck.existing_deck_removal",
      workAreaId: "d1",
      write: {
        factKey: "flooring.removal_required",
        valueType: "boolean",
        includeValue: true,
        excludeValue: false,
        label: "Removal",
      },
    },
  ]).length === 0
);
check(
  "D4 deck steps do not become generic external stairs",
  shouldSuggestExternalStairs({
    briefText: "Build a kwila deck with two steps to ground and a balustrade.",
    hasDeck: true,
  }) === false
);
check(
  "D5 exterior deck language does not discover Cladding or Roofing",
  discoverWorkAreaInstances("Build a kwila deck on the north elevation with steps.").every(
    (row) => row.type === "deck"
  )
);
check(
  "D6 balustrade stays a Deck fact",
  safetyRefineKeys.includes("deck.balustrade_required") &&
    !safetyRefineKeys.includes("cladding.balustrade")
);

console.log("\n--- E persistence and reload ---\n");

const committed = resolveCommittedFactWrite({
  key: "deck.existing_deck_removal",
  value: true,
  valueType: "boolean",
});
check(
  "E1 a Deck boolean commits as a user fact",
  committed.value === true && committed.source === "user"
);
const before = safetyFacts();
const afterRemoval = [
  ...before.filter((row) => row.key !== "deck.existing_deck_removal"),
  fact("deck.existing_deck_removal", "d1", true, "user"),
];
check(
  "E2 refining removal does not promote unrelated facts",
  afterRemoval.filter((row) => row.key !== "deck.existing_deck_removal").every((row) => {
    const prior = before.find((item) => item.key === row.key);
    return prior?.value === row.value;
  }) && afterRemoval.length === before.length + 1
);
const planBefore = deckJobPlanAdapter.project(
  { id: "d1", type: "deck", name: "Deck", status: "confirmed" },
  { facts: before, constraints: [], qualityLevel: "standard", briefText: null }
);
const planAfter = deckJobPlanAdapter.project(
  { id: "d1", type: "deck", name: "Deck", status: "confirmed" },
  { facts: afterRemoval, constraints: [], qualityLevel: "standard", briefText: null }
);
check(
  "E3 removal reloads as included after the user write",
  planBefore.notConfirmed.some((row) => row.sourceFactKey === "deck.existing_deck_removal") &&
    planAfter.included.some((row) => row.sourceFactKey === "deck.existing_deck_removal") &&
    !planAfter.notConfirmed.some((row) => row.sourceFactKey === "deck.existing_deck_removal")
);
const userWidthKept = mergeDerivedFactsIntoRecords(
  [{ key: "deck.step_width_m", work_area_id: "d1", value: 1.2, source: "user" }],
  [{ key: "deck.step_width_m", work_area_id: "d1", value: 9, source: "derived" }]
);
const extractedWidthUpdated = mergeDerivedFactsIntoRecords(
  [
    {
      key: "deck.step_width_m",
      work_area_id: "d1",
      value: 1.2,
      source: "ai_extracted",
    },
  ],
  [{ key: "deck.step_width_m", work_area_id: "d1", value: 1.4, source: "derived" }]
);
check(
  "E4 user-owned Deck facts block re-analysis overwrite",
  userWidthKept[0]?.value === 1.2 &&
    userWidthKept[0]?.source === "user" &&
    extractedWidthUpdated[0]?.value === 1.4 &&
    extractedWidthUpdated[0]?.source === "derived"
);
const merged = mergeDerivedFactsIntoRecords(
  [{ key: "deck.area_m2", work_area_id: "d1", value: 36, source: "user" }],
  [{ key: "deck.area_m2", work_area_id: "d1", value: 20, source: "derived" }]
);
check(
  "E5 derived area does not replace a user area",
  merged.length === 1 && merged[0]?.value === 36 && merged[0]?.source === "user"
);
check(
  "E6 one field write does not add a second Deck scope row",
  planAfter.included.filter((row) => row.sourceFactKey === "deck.existing_deck_removal").length ===
    1
);

console.log("\n--- F adapter contract ---\n");

check(
  "F1 Deck Job Plan contract is scalar",
  DECK_JOB_PLAN_ADAPTER_CONTRACT.shape === "scalar" &&
    DECK_JOB_PLAN_ADAPTER_CONTRACT.nestedCollectionFactKey === null &&
    DECK_JOB_PLAN_ADAPTER_CONTRACT.stableNestedIdentity === false &&
    DECK_JOB_PLAN_ADAPTER_CONTRACT.compareAndSwap === false
);
check(
  "F2 Deck refine rows have no nested identity",
  safetyRefineRows.every((row) => row.nestedItemId == null && row.wallTypeId == null && row.componentId == null)
);
const card = planBefore;
check(
  "F3 Job Plan scope rows are scalar fact writes",
  [...card.included, ...card.notIncluded, ...card.notConfirmed].every(
    (row) => row.sourceFactKey == null || row.sourceFactKey.startsWith("deck.")
  )
);
check(
  "F4 core decking is included without a toggle write",
  card.included.some((row) => row.id === "decking" && row.write == null && row.togglable === false)
);
check(
  "F5 unresolved consumed scope remains not confirmed",
  card.notConfirmed.some((row) => row.sourceFactKey === "deck.steps_included") &&
    card.notConfirmed.some((row) => row.sourceFactKey === "deck.vertical_face_boards_required")
);
check(
  "F6 low deck balustrade stays off the default confirm list",
  !card.notConfirmed.some((row) => row.sourceFactKey === "deck.balustrade_required")
);

console.log("\n--- G consumed-fact alignment ---\n");

check(
  "G1 every emitted Deck refine key is calculator-consumed",
  refineFactsAreContractBacked("deck", safetyRefineKeys) &&
    safetyRefineKeys.every((key) => (DECK_CALCULATOR_CONSUMED_FACTS as readonly string[]).includes(key))
);
check(
  "G2 joist centres are physical takeoff and not commercial money",
  getConsumedFactConsumption("deck", "deck.joist_centres_mm")?.physical === true &&
    isCommercialConsumedFact("deck", "deck.joist_centres_mm") === false
);
check(
  "G3 removal, fascia, steps and balustrade are commercially consumed",
  ["deck.existing_deck_removal", "deck.vertical_face_boards_required", "deck.steps_included", "deck.balustrade_required"].every(
    (key) => isCommercialConsumedFact("deck", key)
  )
);
check(
  "G4 pergola has no consumption record",
  getConsumedFactConsumption("deck", "deck.pergola_included") == null
);
check(
  "G5 wall count is consumed for the Internal Walls summary and is not commercial length",
  (INTERNAL_WALLS_CALCULATOR_CONSUMED_FACTS as readonly string[]).includes(
    "internal_walls.wall_type.wall_count"
  ) &&
    isCommercialConsumedFact("internal_walls", "internal_walls.wall_type.wall_count") === false &&
    getConsumedFactConsumption("internal_walls", "internal_walls.wall_type.wall_count")?.physical ===
      true
);
check(
  "G6 handrail remains a consumed Deck allowance key",
  isCalculatorConsumedFact("deck", "deck.handrail_required")
);

console.log("\n--- H readiness and questions ---\n");

const workAreas = [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" as const }];
const jobPlan = composeJobPlan({
  workAreas,
  facts: safetyFacts(),
  constraints: [],
  briefText: "Build a hardwood deck.",
  qualityLevel: "standard",
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: "Build a hardwood deck.",
  qualityLevel: "standard",
  workAreas,
  facts: safetyFacts(),
  constraints: [],
  jobPlan,
});
const refine = composeRefineView({
  briefText: "Build a hardwood deck.",
  qualityLevel: "standard",
  workAreas,
  facts: safetyFacts(),
  constraints: [],
  jobPlan: {
    cards: jobPlan.cards.map((row) => ({
      workAreaId: row.workAreaId,
      workAreaType: row.workAreaType,
      name: row.name,
      notConfirmed: row.notConfirmed,
    })),
  },
});
const refineKeys = [...refine.highValue, ...refine.advanced].map((row) => row.factKey);
const clarifyKeys = clarify.candidates.map((row) => row.factKey);
check(
  "H1 unresolved Details keys are not duplicated in Refine",
  !refineKeys.includes("deck.existing_deck_removal") &&
    !refineKeys.includes("deck.vertical_face_boards_required")
);
check(
  "H2 resolved Hardwood material remains editable in Refine",
  refineKeys.includes("deck.board_material")
);
check(
  "H3 Clarify candidates for this Deck are Deck-owned or shared conditions",
  clarify.candidates.every(
    (row) =>
      row.factKey == null ||
      row.factKey.startsWith("deck.") ||
      row.constraintKey != null
  )
);
const readiness = composeEstimateReadiness({
  clarify,
  jobPlan,
  qualityLevel: "standard",
  constraints: [],
});
check(
  "H4 known area, material and height stay on one Deck card",
  jobPlan.cards.filter((row) => row.workAreaType === "deck").length === 1 &&
    Array.isArray(readiness.known)
);
check(
  "H5 pergola is not a Refine question",
  !refineKeys.includes("deck.pergola_included")
);
check(
  "H6 skirting stays available from the Job Plan without being inferred",
  jobPlan.cards[0]?.notConfirmed.some((row) => row.sourceFactKey === "deck.skirting_included") ===
    true && !safetyFacts().some((row) => row.key === "deck.skirting_included")
);

console.log("\n--- I physical non-regression ---\n");

check("I1 decking quantity stays 282.85 lm", decking?.quantity === SAFETY_DECKING_LM && decking.unit === "lm");
check("I2 deck labour quantity stays 36 m2", labour?.quantity === 36 && labour.unit === "m²");
check("I3 deck labour hours stay 52.2", labour?.labourHours === SAFETY_HOURS && totalLabourHours(safety.lineItems) === SAFETY_HOURS);
check(
  "I4 framing and fixings stay on 36 m2",
  safety.lineItems.find((row) => row.label === "Framing/substructure")?.quantity === 36 &&
    safety.lineItems.find((row) => row.label === "Fixings, connectors & sundries")?.quantity === 36
);
check(
  "I5 material identity stays hardwood lineal",
  decking?.itemKey === "deck.material.hardwood.lm"
);
check(
  "I6 no removal quantity is invented on the golden fixture",
  !safety.lineItems.some((row) => row.label === "Existing deck removal")
);

console.log("\n--- J commercial non-regression ---\n");

check("J1 direct COST stays 14574.70", round2(safetyTotals.recommendedCost) === SAFETY_COST);
check("J2 sell ex GST stays 18218.38", round2(safetyTotals.recommendedSell) === SAFETY_SELL);
check("J3 GST stays 2732.76", safetyGst === 2732.76);
check("J4 sell incl GST stays 20951.14", round2(safetyTotals.recommendedSell + safetyGst) === 20951.14);
const withRemoval = calculateDeck(ctx("d1", afterRemoval), wa("d1"));
const removalLine = withRemoval.lineItems.find((row) => row.label === "Existing deck removal");
check(
  "J5 removal adds its own labour line and leaves decking lm unchanged",
  removalLine != null &&
    withRemoval.lineItems.find((row) => row.label === "Decking")?.quantity === SAFETY_DECKING_LM &&
    sumIncludedLineItems(withRemoval.lineItems).recommendedCost > SAFETY_COST
);
check(
  "J6 hourly labour identity stays the carpenter hour",
  labour?.itemKey === "labour.carpenter.hour"
);

console.log("\n--- K Builder Review / Pricing / Quote ---\n");

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
  workAreas,
  requirements: safety.requirements ?? [],
});
check(
  "K1 Builder Review has one Deck group",
  review.workAreas.length === 1 &&
    review.workAreas[0]?.workAreaName === "Deck" &&
    review.workAreas[0]?.workAreaType === "deck"
);
check(
  "K2 Builder Review cost matches direct COST",
  round2(review.workAreas[0]?.cost ?? 0) === SAFETY_COST && review.costReconciles === true
);
check(
  "K3 Deck review has no nested portion groups",
  (review.workAreas[0]?.portionGroups ?? []).length === 0
);
const pricing = buildPricingItemFieldsFromEstimateLineItem({
  category: decking?.category ?? "materials",
  recommended_cost: decking?.recommendedCost ?? 0,
  recommended_sell: decking?.recommendedSell ?? 0,
  notes: decking?.notes ?? null,
});
check(
  "K4 Pricing keeps the decking cost",
  pricing.totalCost === decking?.recommendedCost
);
const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "deck",
  name: "Deck",
  facts: [
    { key: "deck.area_m2", label: "Area", value: "36" },
    { key: "deck.board_material", label: "Material", value: "Hardwood" },
    { key: "deck.existing_deck_removal", label: "Removal", value: "true" },
  ],
  pricingItems: [],
});
check(
  "K5 Quote scope names the deck and existing removal",
  /hardwood/i.test(quote) && /36/.test(quote) && /existing deck/i.test(quote)
);
check(
  "K6 Quote scope does not create Cladding or Roofing wording",
  !/cladding/i.test(quote) && !/roofing/i.test(quote)
);

console.log("\n--- L existing-project compatibility ---\n");

const legacy = calculateDeck(
  ctx("d1", [
    fact("deck.area_m2", "d1", 36),
    fact("deck.material", "d1", "Hardwood"),
    fact("deck.board_width_mm", "d1", 140),
    fact("deck.height_m", "d1", 0.8),
    fact("deck.demolition_required", "d1", true),
    fact("deck.has_balustrade", "d1", true),
  ]),
  wa("d1")
);
check(
  "L1 legacy material and demolition aliases still price",
  legacy.lineItems.some((row) => row.label === "Decking" && row.quantity === SAFETY_DECKING_LM) &&
    legacy.lineItems.some((row) => row.label === "Existing deck removal") &&
    legacy.lineItems.some((row) => row.label === "Balustrade allowance")
);
check(
  "L2 legacy aliases do not add a second decking line",
  legacy.lineItems.filter((row) => row.label === "Decking").length === 1
);
check(
  "L3 a project without new metadata still calculates",
  calculateDeck(ctx("old", [fact("deck.area_m2", "old", 12), fact("deck.board_material", "old", "Treated Pine")]), {
    id: "old",
    type: "deck",
    name: "Old deck",
    sort_order: 1,
  }).lineItems.length > 0
);
check(
  "L4 explicit area is not replaced by the 20 m2 assumption",
  !safety.assumptions.some((row) => row.includes("20 m²"))
);
check(
  "L5 Doors, Flooring and Cladding stay frozen",
  DOORS_V1_HUMAN_QA_FROZEN === true &&
    FLOORING_V1_HUMAN_QA_FROZEN === true &&
    CLADDING_V1_HUMAN_QA_FROZEN === true
);

console.log("\n--- M cross-Work-Area isolation ---\n");

check(
  "M1 Deck lines stay on the Deck work area",
  safety.lineItems.every((row) => row.workAreaId === "d1")
);
const discovered = discoverWorkAreaInstances(
  "Build a kwila deck with steps and a balustrade on the north elevation."
);
const isolated = filterTopLevelWorkAreas({
  briefText: "Build a kwila deck with steps and a balustrade on the north elevation.",
  workAreas: discovered.map((row) => ({ type: row.type })),
});
check(
  "M2 deck discovery does not create Cladding, Roofing, Flooring, Doors or Bathroom",
  discovered.some((row) => row.type === "deck") &&
    isolated.workAreas.every(
      (row) => !["cladding", "roofing", "flooring", "doors", "bathroom"].includes(row.type)
    )
);
check(
  "M3 integral deck steps suppress a separate external stairs area",
  filterIntegralDeckExternalStairsWorkAreas(
    [{ type: "deck" }, { type: "external_stairs" }],
    "Build a deck with two steps to ground."
  ).every((row) => row.type !== "external_stairs")
);
check(
  "M4 removal labour stays labelled on the Deck, not a Demolition package",
  removalLine?.workAreaId === "d1" && removalLine.label === "Existing deck removal"
);
check(
  "M5 weatherboard language does not discover a Deck",
  discoverWorkAreaInstances("Reclad the north wall in weatherboard.").every(
    (row) => row.type !== "deck"
  )
);
check(
  "M6 Clarify did not ask Internal Walls, Flooring or Cladding keys",
  !clarifyKeys.some(
    (key) =>
      key?.startsWith("internal_walls.") ||
      key?.startsWith("flooring.") ||
      key?.startsWith("cladding.")
  )
);

console.log("\n--- N shared estimator-safety integration ---\n");

check(
  "N1 check 24 predicate passes for the Deck refine keys",
  Boolean(listRefineAdapters().find((row) => row.workAreaType === "deck")) &&
    refineFactsAreContractBacked("deck", safetyRefineKeys) &&
    safetyRefineKeys.length > 0
);
check(
  "N2 check 28 predicate passes for every refine adapter",
  listRefineAdapters().every((adapter) =>
    refineFactsAreContractBacked(
      adapter.workAreaType,
      adapter
        .candidates({
          workAreaId: "wa",
          workAreaName: "Test",
          facts: [],
          briefText: null,
          notConfirmed: [],
        })
        .map((row) => row.factKey)
        .filter((key): key is string => Boolean(key))
    )
  )
);
check(
  "N3 a false consumed key still fails the Deck contract",
  refineFactsAreContractBacked("deck", ["retaining_wall.gabion_mesh"]) === false
);
check(
  "N4 Deck money lines are still present for estimator safety",
  safety.lineItems.some((row) => row.label === "Decking") &&
    safety.lineItems.some((row) => /labour/i.test(row.label))
);

console.log("\n--- DECK-CONTRACT-R1 SUMMARY ---");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);

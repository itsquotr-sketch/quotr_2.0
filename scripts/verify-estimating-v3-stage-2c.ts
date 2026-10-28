/**
 * Stage 2C — scope intent and specification provenance.
 * Deterministic path through enrichment, persistence rules, and estimate assembly.
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { stripImplicitScopeExclusions } from "../lib/scopes/strip-implicit-scope-exclusions";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { deckJobPlanAdapter } from "../lib/assistant/job-plan/adapters/deck";
import { CONFIRMED_ANSWER_CONFLICT, reanalysisFactWrite } from "../lib/ai/mappers";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { commercializeDoors } from "../lib/estimate/doors-commercial";
import { calculateDoorsPhysical } from "../lib/estimate/doors-physical";
import {
  confirmedDoorLeafConflicts,
  mergePersistedDoorsPortionsOnReanalyse,
} from "../lib/estimate/doors-portions";
import { resolveCommittedFactWrite } from "../lib/assistant/scope-persistence";
import {
  deckDetailGaps,
  deckPostsInScope,
} from "../lib/estimate/deck-detail-completeness";
import {
  PILE_ALLOWANCE_COVERAGE_GAP,
  PILE_CONFIRMED_NEW_WHILE_RETAINED,
  PILE_INSPECTION_CONDITION_LABEL,
  PILE_LEFT_UNTIL_INSPECTION_LABEL,
  PILE_SUPPORTS_UNRESOLVED_PENDING,
  pileTreatmentChoiceValue,
  shouldAskPileCount,
  shouldAskPileReplacement,
} from "../lib/estimate/deck-scope-2c";
import { scopeTopicPolarity } from "../lib/estimate/scope-intent";
import {
  explicitJobExclusionLines,
  jobExclusionLine,
  seedPricingClientExclusions,
} from "../lib/quotes/job-exclusions";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import {
  STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF,
  STAGE_2A_INTERNAL_PARTITION_BRIEF,
  STAGE_2A_LOW_DECK_BRIEF,
} from "./fixtures/stage-2a-original-briefs";

const allowed = getAnalysisCapableWorkAreaTypes();
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL ${name}`);
}

function emptyExtraction(workAreas: AIExtractionOutput["workAreas"] = [], facts: AIExtractionOutput["facts"] = []): AIExtractionOutput {
  return {
    workAreas,
    facts,
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.8,
    warnings: [],
  };
}

function run(brief: string, seed: AIExtractionOutput = emptyExtraction()) {
  const enriched = enrichExtractionFromBrief({
    briefText: brief,
    extraction: seed,
    allowedTypes: allowed,
  }).extraction;
  return stripImplicitScopeExclusions(enriched, brief);
}

function deckFacts(extraction: AIExtractionOutput): Map<string, unknown> {
  return new Map(
    extraction.facts
      .filter((fact) => fact.work_area_type === "deck")
      .map((fact) => [fact.key, fact.value])
  );
}

function doorPortions(extraction: AIExtractionOutput): Array<Record<string, unknown>> {
  const fact = extraction.facts.find((row) => row.key === "doors.portions");
  return Array.isArray(fact?.value) ? (fact.value as Array<Record<string, unknown>>) : [];
}

function asFacts(extraction: AIExtractionOutput, workAreaId: string, type: string): EstimateFact[] {
  return extraction.facts
    .filter((fact) => fact.work_area_type === type)
    .map((fact) => ({
      key: fact.key,
      work_area_id: workAreaId,
      value: fact.value,
      source: "ai_extracted",
    }));
}

function deckContext(facts: EstimateFact[], brief: string): EstimateContext {
  const area: EstimateWorkArea = {
    id: "deck-1",
    type: "deck",
    name: "Deck",
    sort_order: 0,
  };
  return {
    project: { qualityLevel: "standard" } as EstimateContext["project"],
    confirmedWorkAreas: [area],
    facts,
    constraints: [],
    organisationSettings: null,
    materialWastageSettings: null,
    rates: [],
    briefText: brief,
  };
}

const lowSeed = emptyExtraction(
  [
    { type: "deck", confidence: 0.9, rationale: "model" },
    { type: "painting", confidence: 0.7, rationale: "model saw the word" },
  ],
  [
    {
      work_area_type: "deck",
      key: "deck.existing_deck_removal",
      label: "Removal",
      value: true,
      confidence: 0.6,
    },
    {
      work_area_type: "deck",
      key: "deck.steps_included",
      label: "Steps",
      value: true,
      confidence: 0.6,
    },
    {
      work_area_type: "deck",
      key: "deck.balustrade_required",
      label: "Balustrade",
      value: true,
      confidence: 0.6,
    },
    {
      work_area_type: "painting",
      key: "painting.location",
      label: "Location",
      value: "Internal",
      confidence: 0.6,
    },
  ]
);

const low = run(STAGE_2A_LOW_DECK_BRIEF, lowSeed);
const lowMap = deckFacts(low);
check("low deck stores stairs excluded", lowMap.get("deck.steps_included") === false);
check("low deck stores balustrade excluded", lowMap.get("deck.balustrade_required") === false);
check("low deck stores demolition excluded", lowMap.get("deck.existing_deck_removal") === false);
check("low deck stores painting excluded", lowMap.get("deck.painting_included") === false);
check("low deck keeps substructure included", lowMap.get("deck.substructure_included") === true);
check(
  "low deck does not turn demolition into a preparation exclusion",
  ![...lowMap.keys()].some((key) => /prep/i.test(key))
);
check(
  "low deck does not keep a painting work area",
  !low.workAreas.some((row) => row.type === "painting")
);

const lowFacts = asFacts(low, "deck-1", "deck");
const lowPlan = deckJobPlanAdapter.project(
  { id: "deck-1", type: "deck", name: "Deck", status: "confirmed" },
  { facts: lowFacts, briefText: STAGE_2A_LOW_DECK_BRIEF, constraints: [], qualityLevel: null }
);
const lowExcluded = lowPlan.notIncluded.map((item) => item.label);
check("low deck card shows stairs excluded", lowExcluded.includes("Steps"));
check("low deck card shows balustrade excluded", lowExcluded.includes("Balustrade"));
check("low deck card shows demolition excluded", lowExcluded.includes("Existing deck removal"));
check("low deck card shows painting excluded", lowExcluded.includes("Painting"));
check(
  "excluded items are not asked again",
  !lowPlan.notConfirmed.some((item) =>
    ["Steps", "Balustrade", "Existing deck removal", "Painting"].includes(item.label)
  )
);

const lowEstimate = calculateDeck(deckContext(lowFacts, STAGE_2A_LOW_DECK_BRIEF), {
  id: "deck-1",
  type: "deck",
  name: "Deck",
  sort_order: 0,
});
const lowLabels = lowEstimate.lineItems.map((item) => item.label).join(" | ");
check("generated deck has no stair task", !/stair|step-down|step down/i.test(lowLabels));
check("generated deck has no demolition task", !lowLabels.includes("Existing deck removal"));
check("generated deck has no balustrade task", !/balustrade/i.test(lowLabels));
check("generated exclusions stay reviewable", ["Stairs", "Demolition", "Balustrade", "Painting"].every((item) => lowEstimate.exclusions.includes(item)));
const lowClientLines = explicitJobExclusionLines(lowFacts);
check(
  "client draft names the four explicit exclusions",
  ["Stairs", "Demolition", "Balustrade", "Painting"].every((label) =>
    lowClientLines.includes(jobExclusionLine(label))
  )
);
check(
  "a saved draft is not rewritten with job exclusions",
  seedPricingClientExclusions({
    templateLines: [],
    jobLines: lowClientLines,
    existingDraftLines: ["Kept by the builder."],
  }).lines.join("|") === "Kept by the builder."
);

const exclusionVariant = run(
  "Build a 4m x 2m deck, 300mm above the ground. Stairs, balustrades, demolition and painting are not included. Include the framing."
);
const variantMap = deckFacts(exclusionVariant);
check("reworded exclusion stores stairs false", variantMap.get("deck.steps_included") === false);
check("reworded exclusion stores painting false", variantMap.get("deck.painting_included") === false);
check("reworded exclusion does not invent preparation", ![...variantMap.keys()].some((key) => /prep/i.test(key)));

const silent = run("Build a 4m x 2m deck, 300mm above the ground. Include the substructure.");
const silentMap = deckFacts(silent);
check("a missing stair mention is not an exclusion", !silentMap.has("deck.steps_included"));
check("a missing painting mention is not an exclusion", !silentMap.has("deck.painting_included"));
check("a missing demolition mention is not an exclusion", silentMap.get("deck.existing_deck_removal") !== false);
check(
  "a missing mention does not seed a client exclusion",
  explicitJobExclusionLines(asFacts(silent, "deck-silent", "deck")).length === 0
);
check(
  "fascia declined in details is not a client exclusion",
  !explicitJobExclusionLines([
    { key: "deck.vertical_face_boards_required", value: false },
  ]).some((line) => /fascia|face board/i.test(line))
);

const prep = run(
  "Build a 4m x 2m deck, 300mm above the ground. No demolition. Prepare the ground before the new frame goes down."
);
check("no demolition stays demolition only", deckFacts(prep).get("deck.existing_deck_removal") === false);
check(
  "preparation is not stored as excluded",
  scopeTopicPolarity(
    "Build a 4m x 2m deck. No demolition. Prepare the ground before the new frame goes down.",
    "preparation"
  ) === "included"
);

const mixed = run(
  "Demolish the old deck and fit new kwila decking on the same 5m x 3m footprint. Painting is by others. Steps are not part of this job."
);
const mixedMap = deckFacts(mixed);
check("mixed job keeps demolition included", mixedMap.get("deck.existing_deck_removal") === true);
check("mixed job excludes painting", mixedMap.get("deck.painting_included") === false);
check("mixed job excludes stairs", mixedMap.get("deck.steps_included") === false);

const elevatedSeed = emptyExtraction(
  [{ type: "deck", confidence: 0.9, rationale: "model" }],
  [
    {
      work_area_type: "deck",
      key: "deck.pile_or_post_replacement_required",
      label: "Piles",
      value: true,
      confidence: 0.7,
    },
    {
      work_area_type: "deck",
      key: "deck.pile_or_post_count",
      label: "Count",
      value: 12,
      confidence: 0.7,
    },
  ]
);
const elevated = run(STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF, elevatedSeed);
const elevatedMap = deckFacts(elevated);
check("conditional piles are not stored as replacement", !elevatedMap.has("deck.pile_or_post_replacement_required"));
check("conditional piles do not invent a count", !elevatedMap.has("deck.pile_or_post_count"));
check(
  "the inspection condition is kept",
  String(elevatedMap.get("deck.substructure_condition")).includes("if sound")
);
check("elevated deck still removes the old deck", elevatedMap.get("deck.existing_deck_removal") === true);
check("one step stays included", elevatedMap.get("deck.steps_included") === true);
const elevatedFacts = asFacts(elevated, "deck-1", "deck");
check(
  "conditional piles ask for a pricing treatment",
  shouldAskPileReplacement({ facts: elevatedFacts, workAreaId: "deck-1" })
);
const elevatedPlan = deckJobPlanAdapter.project(
  { id: "deck-1", type: "deck", name: "Deck", status: "confirmed" },
  {
    facts: elevatedFacts,
    briefText: STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF,
    constraints: [],
    qualityLevel: null,
  }
);
const unresolvedPiles = elevatedPlan.notConfirmed.find(
  (item) => item.sourceFactKey === "deck.pile_or_post_replacement_required"
);
check(
  "conditional piles stay visible as unresolved",
  unresolvedPiles?.label === PILE_INSPECTION_CONDITION_LABEL &&
    unresolvedPiles.togglable === false &&
    unresolvedPiles.presentation === "NOT_CONFIRMED"
);
check(
  "conditional piles do not drop framing",
  elevatedPlan.included.some((item) => /framing|substructure/i.test(item.label))
);
const elevatedEstimate = calculateDeck(
  deckContext(elevatedFacts, STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF),
  { id: "deck-1", type: "deck", name: "Deck", sort_order: 0 }
);
check(
  "unresolved piles block a complete price",
  elevatedEstimate.missingInfo.some((row) => row.includes("does not assume they are replaced or kept"))
);
check(
  "unresolved piles do not add a replacement allowance",
  !elevatedEstimate.lineItems.some((item) => /pile\/post replacement/i.test(item.label))
);
check(
  "conditional piles do not drop decking",
  elevatedEstimate.lineItems.some((item) => /decking/i.test(item.label))
);
check(
  "leave until inspection is not replacement or retention",
  pileTreatmentChoiceValue("Leave until inspection") === "Not sure" &&
    resolveCommittedFactWrite({
      key: "deck.pile_or_post_replacement_required",
      value: "Leave until inspection",
      valueType: "select",
    }).value === "Not sure"
);
check(
  "assume replaced stores replacement",
  resolveCommittedFactWrite({
    key: "deck.pile_or_post_replacement_required",
    value: "Assume replaced",
    valueType: "select",
  }).value === true
);
check(
  "assume retained stores retention",
  resolveCommittedFactWrite({
    key: "deck.pile_or_post_replacement_required",
    value: "Assume retained",
    valueType: "select",
  }).value === false
);
const leftFacts: EstimateFact[] = [
  ...elevatedFacts,
  {
    key: "deck.pile_or_post_replacement_required",
    work_area_id: "deck-1",
    value: "Not sure",
    source: "user",
  },
];
const leftPlan = deckJobPlanAdapter.project(
  { id: "deck-1", type: "deck", name: "Deck", status: "confirmed" },
  {
    facts: leftFacts,
    briefText: STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF,
    constraints: [],
    qualityLevel: null,
  }
);
check(
  "a saved inspection choice stays unresolved",
  leftPlan.notConfirmed.some((item) => item.label === PILE_LEFT_UNTIL_INSPECTION_LABEL) &&
    !leftPlan.included.some((item) => item.sourceFactKey === "deck.pile_or_post_replacement_required") &&
    !leftPlan.notIncluded.some((item) => item.sourceFactKey === "deck.pile_or_post_replacement_required")
);
const assumedFacts: EstimateFact[] = [
  ...elevatedFacts,
  {
    key: "deck.pile_or_post_replacement_required",
    work_area_id: "deck-1",
    value: true,
    source: "user",
  },
];
check(
  "replacement without a count asks for one",
  shouldAskPileCount({ facts: assumedFacts, workAreaId: "deck-1" })
);
const assumedEstimate = calculateDeck(
  deckContext(assumedFacts, STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF),
  { id: "deck-1", type: "deck", name: "Deck", sort_order: 0 }
);
const openAllowance = assumedEstimate.lineItems.find((item) =>
  /pile\/post replacement/i.test(item.label)
);
check(
  "replacement without a count stays an incomplete allowance",
  openAllowance?.notes === "Count subject to confirmation" &&
    openAllowance.recommendedCost === 1200 &&
    openAllowance.includedInTotal !== false &&
    assumedEstimate.missingInfo.some((row) => row.includes("not a complete pile price"))
);
const countedFacts: EstimateFact[] = [
  ...assumedFacts,
  {
    key: "deck.pile_or_post_count",
    work_area_id: "deck-1",
    value: 4,
    source: "user",
  },
];
check(
  "a stated count closes the pile question",
  !shouldAskPileCount({ facts: countedFacts, workAreaId: "deck-1" })
);
const countedEstimate = calculateDeck(
  deckContext(countedFacts, STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF),
  { id: "deck-1", type: "deck", name: "Deck", sort_order: 0 }
);
const countedAllowance = countedEstimate.lineItems.find((item) =>
  /pile\/post replacement/i.test(item.label)
);
check(
  "an explicit count uses the existing each rate",
  countedAllowance?.notes === "4 piles/posts" &&
    countedAllowance.recommendedCost === 720 &&
    !countedEstimate.missingInfo.some((row) => row.includes("not a complete pile price"))
);
check(
  "an explicit replacement prices the stated supports and keeps the allowance unresolved",
  countedEstimate.lineItems.some((item) => item.label === "Piles / posts") &&
    countedEstimate.lineItems.some((item) => item.label === "Pile/post installation") &&
    countedEstimate.lineItems.some((item) => item.label === "Hole excavation") &&
    countedEstimate.missingInfo.includes(PILE_ALLOWANCE_COVERAGE_GAP)
);
const supportPriced = (estimate: { lineItems: { label: string }[] }) =>
  estimate.lineItems.some((item) =>
    item.label === "Piles / posts" ||
    item.label === "Pile/post installation" ||
    item.label === "Hole excavation"
  );
check(
  "pending inspection does not price new piles while framing stays",
  !supportPriced(elevatedEstimate) &&
    elevatedEstimate.lineItems.some((item) => /joist|bearer|framing/i.test(item.label)) &&
    elevatedEstimate.missingInfo.includes(PILE_SUPPORTS_UNRESOLVED_PENDING)
);
const leftEstimate = calculateDeck(
  deckContext(leftFacts, STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF),
  { id: "deck-1", type: "deck", name: "Deck", sort_order: 0 }
);
check(
  "leave until inspection does not price new piles, installation or holes",
  !supportPriced(leftEstimate) &&
    !leftEstimate.lineItems.some((item) => /pile\/post replacement/i.test(item.label)) &&
    leftEstimate.missingInfo.some((row) =>
      row.includes("does not assume they are replaced or kept")
    ) &&
    leftEstimate.missingInfo.includes(PILE_SUPPORTS_UNRESOLVED_PENDING) &&
    leftEstimate.lineItems.some((item) => /joist|bearer|framing/i.test(item.label))
);
check(
  "pending inspection does not require a replacement count or hole specification",
  deckPostsInScope(leftFacts, "deck-1") === false &&
    deckDetailGaps(leftFacts, "deck-1").length === 0 &&
    !leftFacts.some((fact) => fact.key === "deck.pile_or_post_count")
);
const pendingNewSupports: EstimateFact[] = [
  ...leftFacts,
  {
    key: "deck.bearer_row_count",
    work_area_id: "deck-1",
    value: 3,
    source: "user",
  },
  {
    key: "deck.supports_per_bearer",
    work_area_id: "deck-1",
    value: 2,
    source: "user",
  },
];
check(
  "confirmed new supports still ask for hole specifications during inspection",
  deckPostsInScope(pendingNewSupports, "deck-1") === true &&
    deckDetailGaps(pendingNewSupports, "deck-1").length > 0 &&
    !deckDetailGaps(pendingNewSupports, "deck-1").some((gap) => gap.id === "posts")
);
check(
  "explicit replacement still requires a quantity",
  deckPostsInScope(assumedFacts, "deck-1") === true &&
    deckDetailGaps(assumedFacts, "deck-1").some((gap) => gap.id === "posts")
);
const retainedFacts: EstimateFact[] = [
  ...elevatedFacts,
  {
    key: "deck.pile_or_post_replacement_required",
    work_area_id: "deck-1",
    value: false,
    source: "user",
  },
];
const retainedEstimate = calculateDeck(
  deckContext(retainedFacts, STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF),
  { id: "deck-1", type: "deck", name: "Deck", sort_order: 0 }
);
check(
  "explicit retention does not price replacement supports",
  !supportPriced(retainedEstimate) &&
    !retainedEstimate.lineItems.some((item) => /pile\/post replacement/i.test(item.label)) &&
    retainedEstimate.assumptions.some((row) => row.includes("Existing piles are retained")) &&
    retainedEstimate.lineItems.some((item) => /joist|bearer|framing/i.test(item.label))
);
const mixedSupportFacts: EstimateFact[] = [
  ...retainedFacts,
  {
    key: "deck.bearer_row_count",
    work_area_id: "deck-1",
    value: 3,
    source: "user",
  },
  {
    key: "deck.supports_per_bearer",
    work_area_id: "deck-1",
    value: 2,
    source: "user",
  },
];
const mixedSupportEstimate = calculateDeck(
  deckContext(mixedSupportFacts, STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF),
  { id: "deck-1", type: "deck", name: "Deck", sort_order: 0 }
);
check(
  "retained existing piles still price a confirmed new support layout",
  mixedSupportEstimate.lineItems.some((item) => item.label === "Piles / posts") &&
    mixedSupportEstimate.lineItems.some((item) => item.label === "Pile/post installation") &&
    !mixedSupportEstimate.lineItems.some((item) => /pile\/post replacement/i.test(item.label)) &&
    mixedSupportEstimate.assumptions.includes(PILE_CONFIRMED_NEW_WHILE_RETAINED)
);

const retainVariant = run(
  "Replace the 6m x 3m elevated deck. The posts can stay if the inspection passes. Remove the old boards and framing."
);
check(
  "reworded inspection does not become replacement",
  !deckFacts(retainVariant).has("deck.pile_or_post_replacement_required")
);

const replaceBrief = "Replace the existing piles on the 4m x 2m deck. There are 6 piles. The old decking is to be removed.";
const replaced = run(replaceBrief);
check("explicit replacement stays replacement", deckFacts(replaced).get("deck.pile_or_post_replacement_required") === true);
check("a stated pile count is kept", deckFacts(replaced).get("deck.pile_or_post_count") === 6);
const replacedFacts = asFacts(replaced, "deck-1", "deck");
const replacedEstimate = calculateDeck(deckContext(replacedFacts, replaceBrief), {
  id: "deck-1",
  type: "deck",
  name: "Deck",
  sort_order: 0,
});
check(
  "explicit replacement still prices piles",
  replacedEstimate.lineItems.some((item) => /pile\/post replacement/i.test(item.label))
);
check(
  "explicit replacement is not left as an inspection gap",
  !replacedEstimate.missingInfo.some((row) => row.includes("if sound"))
);

const savedExclusion = reanalysisFactWrite({
  existingSource: "user",
  existingValue: false,
  extractedValue: true,
});
check(
  "a saved exclusion is not overwritten",
  savedExclusion.action === "keep" &&
    savedExclusion.action === "keep" &&
    savedExclusion.conflictWarning === CONFIRMED_ANSWER_CONFLICT
);

const doorSeed = emptyExtraction(
  [
    { type: "doors", confidence: 0.9, rationale: "model" },
    { type: "internal_walls", confidence: 0.9, rationale: "model" },
  ],
  [
    {
      work_area_type: "doors",
      key: "doors.portions",
      label: "Door sets",
      value: [
        {
          id: "door-1",
          label: "Door",
          installation_type: "prehung_internal",
          leaf_construction: "hollow_core",
          quantity: 1,
          height_mm: 1980,
          hardware_included: true,
        },
      ],
      confidence: 0.8,
    },
  ]
);
const partition = run(STAGE_2A_INTERNAL_PARTITION_BRIEF, doorSeed);
const partitionLeaves = doorPortions(partition);
check("partition still has a door", partitionLeaves.length >= 1);
check(
  "an unstated leaf is not stored as hollow core",
  partitionLeaves.every((row) => row.leaf_construction == null)
);
check(
  "the disclosed door height remains",
  partitionLeaves.some((row) => row.height_mm === 1980)
);
const partitionFacts = asFacts(partition, "doors-1", "doors");
const partitionPhysical = calculateDoorsPhysical({
  facts: partitionFacts,
  workArea: { id: "doors-1", type: "doors", name: "Doors" },
});
check(
  "an unstated leaf stays unresolved through assembly",
  partitionPhysical.completeness === "INFORMATION_REQUIRED" &&
    partitionPhysical.portions.some((row) =>
      row.missingFields.includes("doors.portion.leaf_construction")
    )
);
check(
  "assembly does not price a hollow-core leaf that was not specified",
  !JSON.stringify(partitionPhysical.requirements).includes("hollow_core")
);
const partitionCommercial = commercializeDoors({
  physical: partitionPhysical,
  workArea: { id: "doors-1", type: "doors", name: "Doors" },
  rates: [],
  organisationSettings: null,
});
check(
  "the commercial draft has no hollow-core line",
  !JSON.stringify(partitionCommercial).toLowerCase().includes("hollow-core") &&
    !JSON.stringify(partitionCommercial).includes("hollow_core")
);

const hollowBrief =
  "Supply and install one 810 mm wide hollow-core prehung internal door with hardware.";
const hollow = run(hollowBrief, doorSeed);
const hollowLeaves = doorPortions(hollow);
check(
  "an explicit hollow-core door stays hollow core",
  hollowLeaves.some((row) => row.leaf_construction === "hollow_core" && row.leaf_authority === "extracted")
);
const hollowPhysical = calculateDoorsPhysical({
  facts: asFacts(hollow, "doors-1", "doors"),
  workArea: { id: "doors-1", type: "doors", name: "Doors" },
});
check(
  "explicit hollow core is priced as hollow core",
  JSON.stringify(hollowPhysical.requirements).includes("hollow_core")
);

const twoDoorBrief =
  "Fit one hollow-core prehung door in the bedroom, 810 mm wide, with hardware. Fit one prehung door in the cupboard, 610 mm wide, with hardware. The cupboard leaf is not specified.";
const twoDoors = run(
  twoDoorBrief,
  emptyExtraction(
    [{ type: "doors", confidence: 0.9, rationale: "model" }],
    [
      {
        work_area_type: "doors",
        key: "doors.portions",
        label: "Door sets",
        value: [
          { id: "a", label: "Bedroom", installation_type: "prehung_internal", leaf_construction: "hollow_core", quantity: 1 },
          { id: "b", label: "Cupboard", installation_type: "prehung_internal", leaf_construction: "hollow_core", quantity: 1 },
        ],
        confidence: 0.8,
      },
    ]
  )
);
const twoLeaves = doorPortions(twoDoors);
const bedroom = twoLeaves.find((row) => String(row.label).toLowerCase().includes("bedroom"));
const cupboard = twoLeaves.find((row) => String(row.label).toLowerCase().includes("cupboard"));
check("the named door keeps hollow core", bedroom?.leaf_construction === "hollow_core");
check("the unnamed door leaf stays unresolved", cupboard?.leaf_construction == null);

const savedLeaf = {
  id: "door-1",
  label: "Bedroom",
  installation_type: "prehung_internal",
  leaf_construction: "hollow_core",
  leaf_authority: "user",
  quantity: 1,
  height_mm: 1980,
  height_authority: "assumed_disclosed",
};
const laterModel = {
  ...savedLeaf,
  leaf_construction: "solid_core",
  leaf_authority: "extracted",
};
const mergedLeaf = mergePersistedDoorsPortionsOnReanalyse({
  persisted: [savedLeaf],
  extracted: [laterModel],
});
check(
  "a later analysis does not replace the saved leaf",
  mergedLeaf[0]?.leaf_construction === "hollow_core" && mergedLeaf[0]?.leaf_authority === "user"
);
check(
  "the disagreement is flagged for review",
  confirmedDoorLeafConflicts({ persisted: [savedLeaf], extracted: [laterModel] })
);

console.log(failed === 0 ? "passed" : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

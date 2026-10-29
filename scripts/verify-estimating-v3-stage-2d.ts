/**
 * Stage 2D — fascia length is explicit, and pile lines keep their own scope.
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { stripImplicitScopeExclusions } from "../lib/scopes/strip-implicit-scope-exclusions";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_FASCIA_BUILDER_LABEL,
  DECK_FASCIA_RECTANGULAR_PERIMETER_LABEL,
  fasciaLengthDetailCandidates,
  resolveDeckFasciaEdgeLength,
} from "../lib/estimate/deck-fascia";
import { DECK_SUPPORTS_COMPONENT_KEY } from "../lib/estimate/deck-structure";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF } from "./fixtures/stage-2a-original-briefs";

let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL ${name}`);
}

function fact(key: string, value: string | number | boolean): EstimateFact {
  return { key, work_area_id: "deck-1", value, source: "user" };
}

function context(facts: EstimateFact[]): EstimateContext {
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
    briefText: "",
  };
}

const area = { id: "deck-1", type: "deck" as const, name: "Deck", sort_order: 0 };
const plan = [
  fact("deck.length_m", 4.8),
  fact("deck.width_m", 3.6),
  fact("deck.height_m", 0.45),
  fact("deck.vertical_face_boards_required", true),
];

const included = calculateDeck(context(plan), area);
const fasciaLabels = included.lineItems
  .filter((item) => /fascia/i.test(item.label))
  .map((item) => item.label);
check(
  "included fascia without a length prices no fascia material or labour",
  fasciaLabels.length === 0 &&
    included.missingInfo.some((row) => row.includes("not priced"))
);

const questions = fasciaLengthDetailCandidates({
  facts: plan,
  workAreaId: "deck-1",
  lengthM: 4.8,
  widthM: 3.6,
});
check(
  "a rectangular deck asks for a length and offers the perimeter as a choice",
  questions.some((row) => row.factKey === "deck.vertical_face_board_length_lm" && row.blocksEstimate) &&
    questions.some((row) =>
      row.options?.includes(DECK_FASCIA_RECTANGULAR_PERIMETER_LABEL)
    )
);
check(
  "an area-only deck cannot choose a rectangular perimeter",
  fasciaLengthDetailCandidates({
    facts: [fact("deck.vertical_face_boards_required", true)],
    workAreaId: "deck-1",
    lengthM: null,
    widthM: null,
  }).every((row) => row.inputType === "number")
);

const statedFacts = [...plan, fact("deck.vertical_face_board_length_lm", 6)];
const stated = calculateDeck(context(statedFacts), area);
const statedMaterial = stated.lineItems.find((item) => item.label === DECK_FASCIA_BUILDER_LABEL);
const statedLabour = stated.lineItems.find((item) => item.label === "Fascia installation");
check(
  "a stated length is priced and a partial edge is not expanded to the perimeter",
  statedMaterial != null &&
    statedLabour != null &&
    stated.assumptions.some((row) => row.includes("stated 6")) &&
    !stated.assumptions.some((row) => row.includes("16.8"))
);
check(
  "a stated length wins over a rectangular choice",
  resolveDeckFasciaEdgeLength({
    facts: [
      ...statedFacts,
      fact("deck.fascia_length_basis", DECK_FASCIA_RECTANGULAR_PERIMETER_LABEL),
    ],
    workAreaId: "deck-1",
    lengthM: 4.8,
    widthM: 3.6,
  }).status === "stated"
);

const chosen = calculateDeck(
  context([
    ...plan,
    fact("deck.fascia_length_basis", DECK_FASCIA_RECTANGULAR_PERIMETER_LABEL),
  ]),
  area
);
const chosenMaterial = chosen.lineItems.find((item) => item.label === DECK_FASCIA_BUILDER_LABEL);
check(
  "the explicit rectangular perimeter is priced as 2 × (length + width)",
  chosenMaterial != null &&
    chosen.assumptions.some((row) => row.includes("explicit rectangular perimeter 16.8"))
);
check(
  "a resolved length is not asked again",
  fasciaLengthDetailCandidates({
    facts: statedFacts,
    workAreaId: "deck-1",
    lengthM: 4.8,
    widthM: 3.6,
  }).length === 0
);

const excluded = calculateDeck(
  context(
    plan.map((row) =>
      row.key === "deck.vertical_face_boards_required" ? fact(row.key, false) : row
    )
  ),
  area
);
check(
  "excluded fascia generates no fascia material or labour",
  !excluded.lineItems.some((item) => /fascia/i.test(item.label))
);

const allowed = getAnalysisCapableWorkAreaTypes();
const enriched = stripImplicitScopeExclusions(
  enrichExtractionFromBrief({
    briefText: STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF,
    extraction: {
      workAreas: [{ type: "deck", confidence: 0.9, rationale: "model" }],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.8,
      warnings: [],
    } as AIExtractionOutput,
    allowedTypes: allowed,
  }).extraction,
  STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF
);
const elevatedFacts: EstimateFact[] = enriched.facts
  .filter((row) => row.work_area_type === "deck")
  .map((row) => ({
    key: row.key,
    work_area_id: "deck-1",
    value: row.value,
    source: "ai_extracted" as const,
  }));
const owned = calculateDeck(
  context([
    ...elevatedFacts,
    fact("deck.pile_or_post_replacement_required", true),
    fact("deck.pile_or_post_count", 4),
  ]),
  area
);
const labels = owned.lineItems.map((item) => `${item.label} [${item.category}]`);
const allowance = owned.lineItems.find((item) => item.label === "Pile/post replacement allowance");
const support = owned.lineItems.find((item) => item.componentKey === DECK_SUPPORTS_COMPONENT_KEY);
const install = owned.lineItems.find((item) => item.label === "Pile/post installation");
const excavation = owned.lineItems.find((item) => item.label === "Hole excavation");
const removal = owned.lineItems.find((item) => item.label === "Existing deck removal");
console.log("pile lines:");
for (const label of labels) console.log(`  ${label}`);
check(
  "the replacement allowance is not an automatic charge beside itemised supports",
  allowance?.includedInTotal === false &&
    allowance.recommendedCost === 0 &&
    allowance.category === "allowance" &&
    allowance.componentKey !== DECK_SUPPORTS_COMPONENT_KEY &&
    /Enter an amount in Pricing/.test(allowance.notes ?? "")
);
check(
  "new pile material, installation, excavation, and deck removal stay their own lines",
  support != null &&
    install != null &&
    excavation != null &&
    removal != null &&
    support.label !== allowance?.label
);

if (failed > 0) {
  console.log(`failed ${failed}`);
  process.exit(1);
}
console.log("passed");

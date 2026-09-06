/**
 * PRE-BILLING-CORE-CLOSE-01
 * Deck vs External Stairs, stale estimate semantics, step UX,
 * Clarify required completion, acceptance email timezone/HTML.
 *
 * No paid AI. No live email. No golden restamp.
 *
 * Run: npx tsx scripts/verify-pre-billing-core-close-01.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { coerceExtractionPayload } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { estimateNeedsUpdating } from "../lib/estimate/stale-semantics";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  calculateDeckStepsQuantities,
  estimateDeckRiseCount,
  STEP_ARRANGEMENT_FROM_HEIGHT_STATEMENT,
  STEP_WIDTH_ASSUMPTION_STATEMENT,
} from "../lib/estimate/deck-steps-physical";
import { DECK_STEPS_INCLUDED_FACT_KEY } from "../lib/estimate/deck-scope-2c";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  formatQuoteDateTime,
  QUOTE_DISPLAY_TIMEZONE,
} from "../lib/quotes/display";
import { buildQuoteResponseNotificationEmail } from "../lib/quotes/notification-email";
import {
  briefHasIndependentExternalStairs,
  shouldSuggestExternalStairs,
} from "../lib/scopes/deck-stairs-boundary";

function assert(label: string, ok: boolean, detail = "") {
  console.log(ok ? "PASS" : "FAIL", label + (ok || !detail ? "" : ` — ${detail}`));
  if (!ok) process.exitCode = 1;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const ALLOWED = ["deck", "external_stairs", "demolition", "plastering"];

function enrich(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: coerceExtractionPayload({ workAreas: [], facts: [] }),
    allowedTypes: ALLOWED,
  }).extraction;
}

function typesOf(brief: string): string[] {
  return enrich(brief).workAreas.map((wa) => wa.type).sort();
}

assert(
  "deck with a step down → deck only",
  typesOf("deck with a step down").join(",") === "deck" &&
    !shouldSuggestExternalStairs({
      briefText: "deck with a step down",
      hasDeck: true,
    })
);

assert(
  "deck with two steps to ground → deck only",
  typesOf("deck with two steps to ground").join(",") === "deck"
);

assert(
  "deck with new external staircase to lower garden → deck + external_stairs",
  (() => {
    const types = typesOf(
      "deck with new external staircase to lower garden"
    );
    return types.includes("deck") && types.includes("external_stairs");
  })()
);

assert(
  "replace external stairs → external_stairs",
  typesOf("replace external stairs").includes("external_stairs")
);

const OWNER_BRIEF =
  "3m x 9m kwila decking, 140mm decking boards. 0.4m high off the ground. New substructure required including piles. Step down included.";

const ownerExtraction = enrich(OWNER_BRIEF);
assert(
  "owner brief does not suggest external_stairs",
  !ownerExtraction.workAreas.some((wa) => wa.type === "external_stairs") &&
    ownerExtraction.workAreas.some((wa) => wa.type === "deck") &&
    ownerExtraction.facts.some(
      (f) => f.key === "deck.steps_included" && f.value === true
    )
);

assert(
  "independent stairs helper matches owner-positive cases",
  briefHasIndependentExternalStairs("new external staircase") &&
    briefHasIndependentExternalStairs("stairs between levels") &&
    !briefHasIndependentExternalStairs("step down included")
);

assert(
  "fresh project is not stale",
  !estimateNeedsUpdating({ hasEstimate: false, isStale: false }) &&
    !estimateNeedsUpdating({ hasEstimate: false, isStale: true })
);

assert(
  "existing estimate + input change is stale",
  estimateNeedsUpdating({ hasEstimate: true, isStale: true }) &&
    !estimateNeedsUpdating({ hasEstimate: true, isStale: false })
);

assert(
  "overlay cannot mark stale without an estimate",
  read("components/projects/estimate-generation-projection.tsx").includes(
    "estimateIsStale: hasEstimate"
  ) &&
    read("components/assistant/AssistantShell.tsx").includes(
      "Boolean(estimate) &&"
    ) &&
    read("lib/projects/next-action.ts").includes(
      "project.has_estimate && project.estimate_is_stale"
    )
);

const DECK_ID = "deck-1";
function wa(): EstimateWorkArea {
  return { id: DECK_ID, type: "deck", name: "Deck", sort_order: 1 };
}
function fact(key: string, value: unknown, source?: string): EstimateFact {
  return { key, work_area_id: DECK_ID, value, source };
}

const zeroStepFacts: EstimateFact[] = [
  fact("deck.length_m", 3),
  fact("deck.width_m", 9),
  fact(DECK_STEPS_INCLUDED_FACT_KEY, true),
  fact("deck.step_count", 0),
];
const zeroQty = calculateDeckStepsQuantities({
  facts: zeroStepFacts,
  workAreaId: DECK_ID,
  deckHeightM: null,
  wastePercent: 10,
});
assert(
  "steps included + count 0 + no height is information-required, not priced geometry",
  zeroQty != null &&
    zeroQty.riseCount === 0 &&
    zeroQty.treadAreaM2 === 0 &&
    zeroQty.framingNetLm === 0
);

const fromHeight = calculateDeckStepsQuantities({
  facts: [
    fact("deck.length_m", 3),
    fact("deck.width_m", 9),
    fact(DECK_STEPS_INCLUDED_FACT_KEY, true),
    fact("deck.height_m", 0.4),
  ],
  workAreaId: DECK_ID,
  deckHeightM: 0.4,
  wastePercent: 10,
});
assert(
  "auto steps from height when count unknown",
  fromHeight != null &&
    fromHeight.riseCount === estimateDeckRiseCount(0.4) &&
    fromHeight.riseCount > 0 &&
    fromHeight.riseCountResolution === "DERIVED"
);

const ctx = (facts: EstimateFact[]): EstimateContext =>
  ({
    project: { id: "p", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  }) as unknown as EstimateContext;

const autoDeck = calculateDeck(
  ctx([
    fact("deck.length_m", 3),
    fact("deck.width_m", 9),
    fact("deck.height_m", 0.4),
    fact("deck.board_material", "Kwila"),
    fact("deck.board_width_mm", 140),
    fact(DECK_STEPS_INCLUDED_FACT_KEY, true),
  ]),
  wa()
);
assert(
  "auto step arrangement is disclosed",
  autoDeck.assumptions.includes(STEP_ARRANGEMENT_FROM_HEIGHT_STATEMENT) &&
    autoDeck.assumptions.includes(STEP_WIDTH_ASSUMPTION_STATEMENT)
);

const silentNine = calculateDeckStepsQuantities({
  facts: [
    fact("deck.length_m", 3),
    fact("deck.width_m", 9),
    fact(DECK_STEPS_INCLUDED_FACT_KEY, true),
    fact("deck.height_m", 0.4),
    fact("deck.step_width_m", 9),
  ],
  workAreaId: DECK_ID,
  deckHeightM: 0.4,
  wastePercent: 10,
});
const userNine = calculateDeckStepsQuantities({
  facts: [
    fact("deck.length_m", 3),
    fact("deck.width_m", 9),
    fact(DECK_STEPS_INCLUDED_FACT_KEY, true),
    fact("deck.height_m", 0.4),
    fact("deck.step_width_m", 9, "user"),
  ],
  workAreaId: DECK_ID,
  deckHeightM: 0.4,
  wastePercent: 10,
});
assert(
  "step width is not blindly the full 9m deck edge",
  silentNine?.widthM === 1 &&
    silentNine.widthResolution === "ASSUMED" &&
    userNine?.widthM === 9 &&
    userNine.widthResolution === "KNOWN"
);

const clarifyFacts: EstimateFact[] = [
  fact("deck.length_m", 3),
  fact("deck.width_m", 9),
  fact("deck.area_m2", 27),
  fact("deck.height_m", 0.4),
  fact("deck.board_material", "Kwila"),
  fact("deck.board_width_mm", 140),
  fact("deck.existing_deck_removal", false, "user"),
  fact("deck.vertical_face_boards_required", false, "user"),
  fact(DECK_STEPS_INCLUDED_FACT_KEY, true),
];

const jobPlan = composeJobPlan({
  workAreas: [{ id: DECK_ID, type: "deck", name: "Deck", status: "confirmed" }],
  facts: clarifyFacts,
  briefText: OWNER_BRIEF,
});
const clarify = composeClarifyView({
  stage: "work_area_questions",
  briefText: OWNER_BRIEF,
  qualityLevel: "standard",
  workAreas: [{ id: DECK_ID, type: "deck", name: "Deck", status: "confirmed" }],
  facts: clarifyFacts,
  constraints: [{ key: "site_access", value: "Easy" }],
  jobPlan,
});
assert(
  "Clarify asks step width when steps included and width unknown",
  clarify.candidates.some((c) => c.factKey === "deck.step_width_m") &&
    clarify.remainingRequiredCount >= 1 &&
    !clarify.enoughToEstimate
);

const assumedWidthClarify = composeClarifyView({
  stage: "work_area_questions",
  briefText: OWNER_BRIEF,
  qualityLevel: "standard",
  workAreas: [{ id: DECK_ID, type: "deck", name: "Deck", status: "confirmed" }],
  facts: [...clarifyFacts, fact("deck.step_width_m", "Not sure")],
  constraints: [{ key: "site_access", value: "Easy" }],
  jobPlan,
});
assert(
  "Not sure / Quotr assumption resolves required step width",
  !assumedWidthClarify.candidates.some((c) => c.factKey === "deck.step_width_m") &&
    assumedWidthClarify.enoughToEstimate,
  `keys=${assumedWidthClarify.candidates.map((c) => c.factKey ?? c.constraintKey).join(",")} remaining=${assumedWidthClarify.remainingRequiredCount} enough=${assumedWidthClarify.enoughToEstimate}`
);

const panel = read("components/assistant/clarify/ClarifyPanel.tsx");
const readinessCard = read("components/assistant/clarify/ClarifyReadiness.tsx");
const valueField = read("components/assistant/clarify/ClarifyValueField.tsx");
const builderReview = read(
  "components/assistant/builder-review/BuilderReviewSurface.tsx"
);
const editJob = read("components/assistant/mode/EditJobSurface.tsx");
const specEditor = read("components/assistant/job-plan/DeckQuickSpecEditor.tsx");

assert(
  "Clarify has no Refine estimate branch",
  !panel.includes("data-clarify-refine-cta") &&
    panel.includes("details remaining") &&
    readinessCard.includes("All required details resolved") &&
    valueField.includes("data-clarify-use-assumption")
);

assert(
  "Builder Review retained",
  builderReview.includes("Improve this estimate") &&
    builderReview.includes("Recommended sell") &&
    read("components/assistant/mode/EstimateReadySurface.tsx").includes(
      "continueToPricing"
    )
);

assert(
  "Edit Job retained",
  editJob.includes("data-assistant-surface=\"edit_job\"") &&
    specEditor.includes("Substructure assumptions") &&
    specEditor.includes("Number of steps") &&
    specEditor.includes("Step width") &&
    !specEditor.includes("Rise count")
);

const token = "https://example.test/q/qt_secret_token_value";
const occurredAt = "2026-09-01T04:50:00.000Z";
const local = formatQuoteDateTime(occurredAt) ?? "";
assert(
  "acceptance timestamps use Pacific/Auckland",
  QUOTE_DISPLAY_TIMEZONE === "Pacific/Auckland" &&
    read("lib/quotes/display.ts").includes("QUOTE_DISPLAY_TIMEZONE") &&
    /4:50\s*pm/i.test(local)
);

const clientEmail = buildQuoteResponseNotificationEmail({
  kind: "quote_accepted_client",
  companyName: "Quotr Limited",
  projectTitle: "New Deck Test",
  quoteNumber: "Q-0006",
  revisionNumber: 1,
  signerName: "Jean-Luc Ellis",
  totalInclGst: 12060.02,
  occurredAt,
  declineNote: null,
  actionUrl: token,
});
const builderEmail = buildQuoteResponseNotificationEmail({
  kind: "quote_accepted_builder",
  companyName: "Quotr Limited",
  projectTitle: "New Deck Test",
  quoteNumber: "Q-0006",
  revisionNumber: 1,
  signerName: "Jean-Luc Ellis",
  totalInclGst: 12060.02,
  occurredAt,
  declineNote: null,
  actionUrl: "https://example.test/app/projects/p/quotes/q",
});
const htmlWithoutHrefs = clientEmail.html.replace(/href="[^"]+"/g, "");
assert(
  "client confirmation subject, GST, hidden HTML token, plain-text token",
  clientEmail.subject === "Your acceptance of Quote Q-0006 is confirmed" &&
    clientEmail.text.includes("Accepted total:") &&
    clientEmail.text.includes("incl GST") &&
    clientEmail.text.includes(token) &&
    clientEmail.html.includes("View accepted quote") &&
    clientEmail.html.includes("Sent securely via Quotr") &&
    !htmlWithoutHrefs.includes("qt_secret_token_value") &&
    builderEmail.subject === "New Deck Test — Quote Q-0006 accepted"
);

assert(
  "client-safe email copy",
  !`${clientEmail.html}\n${clientEmail.text}`.toLowerCase().includes("unit_cost") &&
    !clientEmail.text.toLowerCase().includes("productivity")
);

assert(
  "no new migration for this polish",
  readdirSync("supabase/migrations").filter((name) =>
    name.includes("pre-billing")
  ).length === 0 && !existsSync("supabase/migrations/046_pre_billing_core_close.sql")
);

assert(
  "prompt documents integral deck steps vs external stairs",
  read("lib/ai/brief-extraction-prompt.ts").includes(
    "Do NOT suggest a separate external_stairs work area"
  )
);

console.log(
  process.exitCode ? "\nPRE-BILLING-CORE-CLOSE-01 FAILED" : "\nPRE-BILLING-CORE-CLOSE-01 passed"
);

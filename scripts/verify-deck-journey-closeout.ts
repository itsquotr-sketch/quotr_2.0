/**
 * Deck Details → Estimate → Review productivity closeout.
 * Run: npx --yes tsx scripts/verify-deck-journey-closeout.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMinimalExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import {
  createPendingWriteTracker,
  settleSaveRequest,
  settledFactsForGenerate,
} from "../lib/assistant/clarify/generate-sync";
import type { AssistantMutationResult } from "../lib/assistant/types";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { settleDetailsJourney } from "../lib/assistant/readiness/details-journey";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  explicitConcreteIncluded,
  explicitDeckStepWidthM,
  KWILA_DECK_JOURNEY_BRIEF,
} from "../lib/estimate/deck-brief-facts";
import { compactDeckReadySummary } from "../lib/estimate/deck-ready-summary";
import { planDeckProductivityApply } from "../lib/estimate/deck-productivity-apply";
import { classifyDeckStepDimensionForRefine } from "../lib/estimate/deck-steps-physical";
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function fact(
  key: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: "deck", value, source };
}

const extraction = buildMinimalExtractionFromBrief(KWILA_DECK_JOURNEY_BRIEF, [
  "deck",
]);
const extracted = new Map(
  extraction.facts
    .filter((row) => row.work_area_type === "deck")
    .map((row) => [row.key, row.value])
);

check("brief extracts 6 m length", extracted.get("deck.length_m") === 6);
check("brief extracts 3.5 m width", extracted.get("deck.width_m") === 3.5);
check("brief extracts 0.7 m height", extracted.get("deck.height_m") === 0.7);
check("brief extracts Kwila", extracted.get("deck.board_material") === "Kwila");
check("brief extracts 140 mm boards", extracted.get("deck.board_width_mm") === 140);
check("brief extracts fascia", extracted.get("deck.vertical_face_boards_required") === true);
check("brief extracts fascia length 6", extracted.get("deck.vertical_face_board_length_lm") === 6);
check("brief extracts steps", extracted.get("deck.steps_included") === true);
check("brief extracts step width 3.5", extracted.get("deck.step_width_m") === 3.5);
check("brief extracts 16 posts", extracted.get("deck.pile_or_post_count") === 16);
check("brief extracts new substructure", extracted.get("deck.substructure_included") === true);
check("brief extracts concrete included", extracted.get("deck.concrete_to_supports") === true);
check("brief does not invent tread depth", !extracted.has("deck.step_going_m"));
check(
  "concrete not included is not confirmed",
  explicitConcreteIncluded("Install a deck, concrete not included.") === false &&
    explicitDeckStepWidthM("Steps down that are 3.5m wide.") === 3.5
);

const copied = buildMinimalExtractionFromBrief(
  "Install 6m x 3.5m kwila deck, 0.7m high. Steps down. 140mm Kwila decking boards.",
  ["deck"]
);
check(
  "an unstated deck-edge step width is dropped",
  !copied.facts.some((row) => row.key === "deck.step_width_m")
);

const confirmedWidth = [
  fact("deck.length_m", 6, "ai_extracted"),
  fact("deck.width_m", 3.5, "ai_extracted"),
  fact("deck.height_m", 0.7, "ai_extracted"),
  fact("deck.steps_included", true, "ai_extracted"),
  fact("deck.step_width_m", 3.5, "ai_extracted"),
];
check(
  "a confirmed 3.5 m step width stays confirmed beside a 3.5 m deck",
  classifyDeckStepDimensionForRefine({
    factKey: "deck.step_width_m",
    facts: confirmedWidth,
    workAreaId: "deck",
  }).surface !== "refine_assumed"
);
check(
  "an unsourced deck-edge width is not confirmed",
  classifyDeckStepDimensionForRefine({
    factKey: "deck.step_width_m",
    facts: [
      fact("deck.length_m", 6),
      fact("deck.width_m", 3.5),
      fact("deck.height_m", 0.7),
      fact("deck.steps_included", true, "user"),
      fact("deck.step_width_m", 3.5),
    ],
    workAreaId: "deck",
  }).surface === "refine_assumed"
);

const journeyFacts: EstimateFact[] = extraction.facts
  .filter((row) => row.work_area_type === "deck")
  .map((row) => fact(row.key, row.value, "ai_extracted"));
const workAreas = [
  { id: "deck", type: "deck", name: "Deck", status: "confirmed" as const },
];
const jobPlan = composeJobPlan({
  workAreas,
  facts: journeyFacts,
  constraints: [],
  briefText: KWILA_DECK_JOURNEY_BRIEF,
  qualityLevel: "standard",
});
const clarify = composeClarifyView({
  stage: "work_area_questions",
  workAreas,
  facts: journeyFacts,
  constraints: [],
  briefText: KWILA_DECK_JOURNEY_BRIEF,
  qualityLevel: "standard",
  jobPlan,
});
const clarifyKeys = [...clarify.candidates, ...clarify.deferred].flatMap((row) =>
  row.factKey ? [row.factKey] : []
);
check("confirmed step width is not asked again", !clarifyKeys.includes("deck.step_width_m"));
check("confirmed fascia length is not asked again", !clarifyKeys.includes("deck.vertical_face_board_length_lm"));
check("confirmed post count is not asked again", !clarifyKeys.includes("deck.pile_or_post_count"));
check(
  "unconfirmed tread depth stays available",
  clarifyKeys.includes("deck.step_going_m")
);

const summary = compactDeckReadySummary({
  facts: journeyFacts,
  workAreaId: "deck",
});
check(
  "ready summary names the confirmed job",
  Boolean(
    summary?.includes("6 × 3.5 m Kwila deck") &&
      summary.includes("0.7 m high") &&
      summary.includes("140 mm boards") &&
      summary.includes("fascia along 6 m") &&
      summary.includes("steps 3.5 m wide") &&
      summary.includes("16 posts, concrete included") &&
      summary.toLowerCase().includes("tread depth")
  ),
  summary ?? ""
);

const mixed = settleDetailsJourney({
  workConfirmed: true,
  pendingWrites: 0,
  requiredClarifyCount: 4,
  postHoleCount: 1,
  optionalRefineCount: 3,
});
check(
  "required clarify and post holes are one count",
  mixed.requiredRemaining === 5 &&
    mixed.optionalRemaining === 3 &&
    mixed.statusLabel === "5 to clarify" &&
    mixed.remainingCopy === "5 important details remaining" &&
    mixed.actionLabel === "Finish 5 details" &&
    mixed.showCreateEstimate === false
);
const saving = settleDetailsJourney({
  workConfirmed: true,
  pendingWrites: 1,
  requiredClarifyCount: 0,
  postHoleCount: 0,
  optionalRefineCount: 2,
});
const ready = settleDetailsJourney({
  workConfirmed: true,
  pendingWrites: 0,
  requiredClarifyCount: 0,
  postHoleCount: 0,
  optionalRefineCount: 2,
});
check("a complete pending save is Saving", saving.phase === "saving" && saving.statusLabel === "Saving" && saving.showCreateEstimate);
check("a settled complete screen is Ready", ready.phase === "ready" && ready.statusLabel === "Ready" && ready.showCreateEstimate);
const finishing = settleDetailsJourney({
  workConfirmed: true,
  pendingWrites: 1,
  requiredClarifyCount: 1,
  postHoleCount: 0,
  optionalRefineCount: 0,
});
check(
  "the last in-flight answer keeps Create estimate and does not say Ready",
  finishing.phase === "saving" &&
    finishing.statusLabel === "Saving" &&
    finishing.showCreateEstimate === true
);
const stillOpen = settleDetailsJourney({
  workConfirmed: true,
  pendingWrites: 1,
  requiredClarifyCount: 2,
  postHoleCount: 0,
  optionalRefineCount: 0,
});
check(
  "two open questions stay unready during one save",
  stillOpen.phase === "needs_details" &&
    stillOpen.statusLabel === "2 to clarify" &&
    stillOpen.showCreateEstimate === false
);

const heldLine = {
  id: "line",
  factKey: "deck.posts_install_scope_confirmation",
  jobFactKey: "deck.posts_install_hours_per_ea",
  expectedToken: "confirmed:2",
  itemKey: "deck.posts.install.hours_per_ea",
  choice: { kind: "benchmark" as const },
  lineHeld: true,
  currentHours: 2,
};
const concreteLine = {
  ...heldLine,
  id: "concrete",
  factKey: "deck.concrete_place_scope_confirmation",
  jobFactKey: "deck.concrete_place_hours_per_bag",
  expectedToken: "confirmed:0.7",
  itemKey: "deck.post_hole_concrete.place.hours_per_bag",
  currentHours: 0.7,
};
check(
  "one missing choice writes nothing",
  planDeckProductivityApply({
    estimateStale: false,
    decisions: [heldLine, { ...concreteLine, choice: null }],
  }).ok === false
);
const both = planDeckProductivityApply({
  estimateStale: false,
  decisions: [heldLine, concreteLine],
});
check(
  "both choices write job facts only",
  both.ok === true &&
    both.ok &&
    both.writes.length === 2 &&
    both.writes.every((row) => row.value === "quotr-benchmark" || row.value.startsWith("confirmed:"))
);
check(
  "a stale estimate conflicts and writes nothing",
  planDeckProductivityApply({
    estimateStale: true,
    decisions: [heldLine, concreteLine],
  }).ok === false
);
check(
  "a changed calibration conflicts",
  planDeckProductivityApply({
    estimateStale: false,
    decisions: [{ ...heldLine, currentHours: 1 }, concreteLine],
  }).ok === false
);

check(
  "settled facts replace the pre-save snapshot",
  settledFactsForGenerate(
    [fact("deck.step_width_m", 1)],
    [fact("deck.step_width_m", 3.5)]
  )[0]?.value === 3.5
);

async function checkSaveSettlement(): Promise<void> {
  const started = Date.now();
  const rejected = await settleSaveRequest(Promise.reject(new Error("Failed to fetch")), 5_000).then(
    () => false,
    () => true
  );
  check(
    "a rejected save settles from the request, not a delay",
    rejected && Date.now() - started < 1_000
  );
  const timedOut = await settleSaveRequest(new Promise(() => {}), 30).then(
    () => false,
    () => true
  );
  check("an unsettled save fails instead of staying pending", timedOut);

  const rejectedTracker = createPendingWriteTracker();
  rejectedTracker.trackAction(Promise.reject(new Error("abort")), {
    requestSeq: 1,
    keys: ["spoil"],
  });
  const failedSave = await rejectedTracker.waitAll();
  check(
    "a rejected details save blocks estimate creation",
    failedSave.failed?.ok === false && failedSave.pendingRemaining === 0
  );

  const superseded = createPendingWriteTracker();
  const mutation = { projectId: "job" } as AssistantMutationResult;
  superseded.trackAction(Promise.resolve({ error: "Could not save." }), {
    requestSeq: 1,
    keys: ["spoil"],
  });
  superseded.trackAction(
    Promise.resolve({ success: true, assistantMutation: mutation }),
    { requestSeq: 2, keys: ["spoil"] }
  );
  const newer = await superseded.waitAll();
  check(
    "a later successful answer supersedes an older failed save",
    newer.failed == null && newer.lastMutation === mutation && newer.authoritativeSeq === 2
  );

  const held = createPendingWriteTracker();
  let releaseOlder: (value: { success: true }) => void = () => {};
  const older = new Promise<{ success: true }>((resolve) => {
    releaseOlder = resolve;
  });
  held.trackAction(older, { requestSeq: 1, keys: ["spoil"] });
  held.trackAction(Promise.resolve({ error: "Could not save." }), {
    requestSeq: 2,
    keys: ["spoil"],
  });
  const blocked = await held.waitAll();
  releaseOlder({ success: true });
  check(
    "an older save still in flight does not outrank a newer failure",
    blocked.failed?.ok === false && blocked.pendingRemaining > 0
  );
}

function wa(): EstimateWorkArea {
  return { id: "deck", type: "deck", name: "Deck", sort_order: 1 };
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "draft", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [{ key: "site_access", value: "good" }],
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
  } as unknown as EstimateContext;
}

const priced = calculateDeck(
  ctx([
    ...journeyFacts,
    fact("deck.area_m2", 21, "ai_extracted"),
    fact("deck.hole_shape", "circular", "user"),
    fact("deck.hole_diameter_mm", 350, "user"),
    fact("deck.hole_depth_mm", 600, "user"),
    fact("deck.hole_ground", "ordinary", "user"),
    fact("deck.hole_method", "hand", "user"),
    fact("deck.concrete_fill", "full", "user"),
    fact("deck.support_section", "125x125", "user"),
    fact("deck.post_embedment_mm", 600, "user"),
  ]),
  wa()
);
const once = (label: string) =>
  priced.lineItems.filter((item) => item.label === label).length;
const hole = priced.lineItems.find((item) => item.label === "Hole excavation");
const install = priced.lineItems.find((item) => item.label === "Pile/post installation");
const place = priced.lineItems.find((item) => item.label === "Concrete placement");
const bags = priced.lineItems.find(
  (item) => item.unit === "bag" && item.category === "materials"
);
const fascia = priced.lineItems.find((item) => item.label === "Fascia installation");
const steps = priced.lineItems.find((item) => item.label === "Step decking");
check("holes, posts, and concrete stay one line each", once("Hole excavation") === 1 && once("Pile/post installation") === 1 && once("Concrete placement") === 1 && once("Fascia installation") === 1 && once("Step decking") === 1);
check(
  "hole geometry money is unchanged by the brief facts",
  hole?.quantity === 16 &&
    hole.labourHours === 8 &&
    hole.recommendedCost === 480 &&
    hole.recommendedSell === 600 &&
    install?.quantity === 16 &&
    install.productivityRate === 0.5 &&
    install.labourHours === 8 &&
    install.recommendedCost === 480 &&
    install.recommendedSell === 600 &&
    place?.labourHours === 5.2 &&
    place.recommendedCost === 312 &&
    place.recommendedSell === 390 &&
    bags?.quantity === 78
);
check(
  "fascia uses the stated 6 m once and steps use 3.5 m",
  fascia?.quantity === 6 && (steps?.notes ?? "").includes("Width: 3.5m")
);

const shell = read("components/assistant/AssistantShell.tsx");
const panel = read("components/assistant/clarify/ClarifyPanel.tsx");
const dialog = read("components/assistant/DeckProductivityReviewDialog.tsx");
const action = read("lib/assistant/deck-productivity-actions.ts");
check(
  "create waits for the latest save and stops when that save fails",
  shell.includes("settledFactsForGenerate") &&
    shell.includes("while (pendingWriteTrackerRef.current.size > 0 && !settled.failed)") &&
    shell.includes("settleSaveRequest")
);
check(
  "one readiness result feeds the details surfaces",
  shell.includes("settleDetailsJourney") &&
    shell.includes("detailsStatusLabel") &&
    shell.includes("settledRemaining={detailsJourney.requiredRemaining}") &&
    shell.includes("allowCreateEstimate={detailsJourney.showCreateEstimate}") &&
    shell.includes("detailsOwnsCreate") &&
    panel.includes("allowCreateEstimate &&") &&
    panel.includes('data-details-post-holes="open"')
);
check(
  "a failed save keeps the answer and can retry",
  panel.includes("lastFailedAnswerRef") &&
    panel.includes("rollbackFailedClarifyPersist") &&
    panel.includes("detailsSaveFailed") &&
    shell.includes("settleSaveRequest") &&
    shell.includes("failedSpecSavesRef") &&
    dialog.includes("The productivity choice was not saved. Try again.")
);
check(
  "productivity choices stay in the dialog until one apply",
  dialog.includes("Apply both decisions and update estimate") &&
    dialog.includes("data-productivity-apply") &&
    !dialog.includes("onDecide") &&
    action.includes("regenerateStaticEstimate") &&
    action.includes('select("notes")') &&
    !action.includes('select("notes, item_key")') &&
    !action.includes('.from("rates").update') &&
    !action.includes(".from('rates').update")
);

void checkSaveSettlement().then(() => {
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\nDeck journey closeout checks passed (${passed})`);
});

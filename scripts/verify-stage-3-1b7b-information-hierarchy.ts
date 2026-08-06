/**
 * Stage 3.1B.7B — Information hierarchy & summary refinement.
 * Run: npx tsx scripts/verify-stage-3-1b7b-information-hierarchy.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SUMMARY_VISIBLE_ITEM_LIMIT,
  buildEstimateReviewSummaryModel,
  buildQuestionGroupSummaries,
  buildQuickEstimatePresentationModel,
  buildScopeItemSummaryLists,
  buildStepperStepSummaries,
  buildWorkAreaFactHighlights,
  countAnsweredQuestions,
} from "../lib/assistant/stage-completion-summaries";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

console.log(
  "\n=== Stage 3.1B.7B — Information Hierarchy Verification ===\n"
);

const highlights = buildWorkAreaFactHighlights({
  workAreas: [
    {
      id: "wa1",
      type: "deck",
      name: "Deck",
      status: "confirmed",
      aiConfidence: 0.9,
    },
  ],
  scopeReview: {
    workAreas: [
      {
        workAreaId: "wa1",
        workAreaType: "deck",
        workAreaName: "Deck",
        facts: [
          {
            key: "deck.area_m2",
            label: "Area",
            value: "15",
            rawValue: 15,
            unit: "m²",
            sourceLabel: "calculated",
            sourcePriority: 1,
          },
          {
            key: "deck.existing_deck_removal",
            label: "Existing deck removal",
            value: "Yes",
            rawValue: true,
            sourceLabel: "answered",
            sourcePriority: 1,
          },
          {
            key: "deck.board_material",
            label: "Decking material",
            value: "timber",
            rawValue: "timber",
            sourceLabel: "answered",
            sourcePriority: 1,
          },
        ],
        missingItems: [],
        activeQuestions: [],
        assumptions: [],
      },
    ],
    excludedWorkAreas: [],
    generalAssumptions: [],
    generalExclusions: [],
  },
  qualityLevel: "premium",
});
check(
  "work area highlights use existing facts + quality",
  highlights.length === 1 &&
    highlights[0]!.bullets.some((b) => /Premium/i.test(b)) &&
    highlights[0]!.bullets.some((b) => /15/.test(b)) &&
    highlights[0]!.bullets.length <= 4
);
check(
  "work area highlights never invent unknown keys",
  !JSON.stringify(highlights).includes("fabricated") &&
    !highlights[0]!.bullets.some((b) => /NaN|undefined/i.test(b))
);

const scopeLists = buildScopeItemSummaryLists({
  suggestions: [
    {
      proposedTitle: "Decking",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Fascia",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Framing",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Demolition",
      decisionState: "REJECTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Engineering",
      decisionState: "REJECTED",
      proposalClass: "CLARIFICATION",
      latestReasonCode: "included_pending_detail",
    },
  ],
});
check(
  "scope summary lists included / not required / needs detail",
  scopeLists.included.includes("Decking") &&
    scopeLists.notRequired.includes("Demolition") &&
    scopeLists.needsDetail.includes("Engineering")
);
check("visible item limit is 4–5", SUMMARY_VISIBLE_ITEM_LIMIT === 5);

const qGroups = buildQuestionGroupSummaries({
  questions: [
    {
      id: "q1",
      key: "deck.length_m",
      label: "Length",
      questionText: "Length?",
      inputType: "number",
      required: true,
      value: 5,
    },
    {
      id: "q2",
      key: "deck.board_material",
      label: "Material",
      questionText: "Material?",
      inputType: "select",
      required: false,
      value: "timber",
    },
    {
      id: "q3",
      key: "deck.balustrade_required",
      label: "Balustrade",
      questionText: "Balustrade?",
      inputType: "select",
      required: false,
      value: "not sure",
    },
  ],
  answers: {},
});
check(
  "questions summary includes finishes / unknowns groups",
  qGroups.some((g) => g.label === "Finishes") &&
    qGroups.some((g) => g.label === "Unknowns" && g.detail === "1 listed")
);
check(
  "answered question count is presentation-only tally",
  countAnsweredQuestions({
    questions: [
      {
        id: "q1",
        key: "deck.length_m",
        label: "Length",
        questionText: "Length?",
        inputType: "number",
        required: true,
        value: 5,
      },
      {
        id: "q2",
        key: "deck.width_m",
        label: "Width",
        questionText: "Width?",
        inputType: "number",
        required: true,
        value: null,
      },
    ],
    answers: {},
  }) === 1
);

const er = buildEstimateReviewSummaryModel({
  scopeReview: {
    workAreas: [
      {
        workAreaId: "wa1",
        workAreaType: "deck",
        workAreaName: "Deck",
        quoteDescription: "Timber deck",
        facts: [
          {
            key: "deck.area_m2",
            label: "Area",
            value: "15",
            sourceLabel: "calculated",
            sourcePriority: 1,
          },
        ],
        missingItems: [],
        activeQuestions: [],
        assumptions: ["Joist centres"],
      },
    ],
    excludedWorkAreas: [],
    generalAssumptions: [],
    generalExclusions: [],
  },
  estimateReady: true,
  constraintCount: 3,
  includedScopeItemCount: 6,
});
check(
  "estimate review summary fields exclude pricing",
  er.scopeItemsLabel.includes("6") &&
    er.siteConstraintsLabel.includes("3") &&
    !JSON.stringify(er).toLowerCase().includes("sell") &&
    !JSON.stringify(er).toLowerCase().includes("margin") &&
    !JSON.stringify(er).includes("priceDrivers")
);

const qe = buildQuickEstimatePresentationModel({
  workAreaNames: ["Deck", "Fence"],
  includedScopeItemCount: 6,
  outstandingClarificationCount: 1,
  assumptionCount: 2,
  missingCount: 0,
  constraintCount: 3,
});
check(
  "quick estimate presentation has hierarchy fields",
  qe.estimatedWorkAreas.includes("Deck") &&
    qe.includedScopeItems.includes("6") &&
    qe.outstandingClarifications.includes("1") &&
    qe.confidenceDrivers.length > 0 &&
    typeof qe.unansweredRequiredDetails === "string" &&
    Array.isArray(qe.confidenceComplete)
);

const stepper = buildStepperStepSummaries({
  answeredQuestionCount: 15,
  estimateReady: true,
  constraintCount: 3,
  includedScopeItemCount: 6,
  needsDetailCount: 1,
  includedWorkAreaCount: 2,
  qualityTitle: "Premium",
  briefSubmitted: true,
});
check(
  "stepper summaries collapse counts",
  stepper.work_area_questions?.primary === "15 answered" &&
    stepper.estimate_ready?.primary === "Ready" &&
    stepper.constraints?.primary === "3 applied" &&
    Boolean(stepper.estimate_ready?.secondary?.includes("6 included"))
);

const summariesUi = read("components/assistant/StageCollapsedSummaries.tsx");
check(
  "collapsed UI uses semantic icons",
  summariesUi.includes("Ruler") &&
    summariesUi.includes("AlertTriangle") &&
    summariesUi.includes("Check")
);
check(
  "scope overflow uses +N more at limit 5",
  summariesUi.includes("SUMMARY_VISIBLE_ITEM_LIMIT") &&
    summariesUi.includes("+{overflow} more")
);
check(
  "constraint empty state improved",
  summariesUi.includes(
    "No additional site constraints identified from the project."
  )
);

const stepperUi = read("components/assistant/StepperNav.tsx");
check(
  "stepper renders secondary summary lines",
  stepperUi.includes("stepSummaries") &&
    stepperUi.includes("summary.primary")
);
check(
  "stepper uses Specification label",
  stepperUi.includes('label: "Specification"')
);

const card = read("components/assistant/CollapsibleStageCard.tsx");
check(
  "denser card spacing retained with transitions",
  card.includes("py-1.5") &&
    card.includes("duration-200") &&
    card.includes("preferredExpanded")
);

const shell = read("components/assistant/AssistantShell.tsx");
check(
  "shell wires work area fact highlights",
  shell.includes("buildWorkAreaFactHighlights") &&
    shell.includes("highlights={workAreaHighlights}")
);
check(
  "shell wires stepper summaries and outcome status labels",
  shell.includes("stepSummaries={stepperSummaries}") &&
    shell.includes("answers collected")
);
check(
  "shell passes quick estimate presentation",
  shell.includes("quickEstimatePresentation")
);
check(
  "manual reopen still available (View / preferredExpanded)",
  shell.includes('actionLabel={briefSubmitted ? "View"') &&
    shell.includes("preferredExpanded")
);

const scopeSummary = read("components/assistant/ScopeSummaryBlock.tsx");
check(
  "quote description uses collapsed preview",
  scopeSummary.includes("CollapsedQuotePreview") &&
    scopeSummary.includes("aria-expanded")
);

const estimatePanel = read("components/assistant/EstimatePanel.tsx");
check(
  "quick estimate hierarchy is presentation only",
  estimatePanel.includes("QuickEstimateHierarchy") &&
    estimatePanel.includes("Confidence drivers") &&
    !estimatePanel.includes("calculateSell")
);

const helpers = read("lib/assistant/stage-completion-summaries.ts");
check(
  "no commercial / AI / persistence imports in hierarchy helpers",
  !helpers.includes("commercial-engine") &&
    !helpers.includes("anthropic") &&
    !helpers.includes("runScopeDiscovery") &&
    !helpers.includes("from(\"project_facts\")")
);
check(
  "no migration references in 7B helpers",
  !helpers.includes("030") && !helpers.includes("migration")
);

check(
  "completion doc exists",
  read(
    "docs/implementation/STAGE_3_1B7B_INFORMATION_HIERARCHY_COMPLETION.md"
  ).includes("Complete — Local")
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

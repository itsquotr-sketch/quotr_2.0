/**
 * Stage 3.1B.7A — Progressive disclosure & Assistant simplification.
 * Run: npx tsx scripts/verify-stage-3-1b7a-progressive-disclosure.ts
 *
 * Pure UX verification — does not exercise AI, commercial, or DB.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveActiveDisclosureStage,
  stagePrefersExpanded,
} from "../lib/assistant/progressive-disclosure";
import {
  buildConstraintChipLabels,
  buildEstimateReviewSummaryModel,
  buildProjectCaptureSummaryModel,
  buildQualitySummaryModel,
  buildQuestionGroupSummaries,
  buildScopeItemSummaryLists,
  buildWorkAreaSummaryLists,
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
  "\n=== Stage 3.1B.7A — Progressive Disclosure Verification ===\n"
);

// —— Active stage exclusivity ——
const early = resolveActiveDisclosureStage({
  briefSubmitted: false,
  workAreasConfirmed: false,
  scopeDiscoveryEnabled: true,
  scopeReviewComplete: false,
  qualityUnlocked: false,
  qualitySubmitted: false,
  questionsSubmitted: false,
  constraintsSubmitted: false,
  estimateReady: false,
});
check("capture is sole active stage initially", early === "capture");
check(
  "only capture prefers expanded initially",
  stagePrefersExpanded("capture", early) &&
    !stagePrefersExpanded("workAreas", early) &&
    !stagePrefersExpanded("constraints", early)
);

const mid = resolveActiveDisclosureStage({
  briefSubmitted: true,
  workAreasConfirmed: true,
  scopeDiscoveryEnabled: true,
  scopeReviewComplete: true,
  qualityUnlocked: true,
  qualitySubmitted: false,
  questionsSubmitted: false,
  constraintsSubmitted: false,
  estimateReady: false,
});
check("quality is active after scope complete", mid === "quality");
check(
  "prior stages do not prefer expanded when quality active",
  !stagePrefersExpanded("capture", mid) &&
    !stagePrefersExpanded("workAreas", mid) &&
    !stagePrefersExpanded("scopeReview", mid) &&
    stagePrefersExpanded("quality", mid)
);

const afterQuestions = resolveActiveDisclosureStage({
  briefSubmitted: true,
  workAreasConfirmed: true,
  scopeDiscoveryEnabled: true,
  scopeReviewComplete: true,
  qualityUnlocked: true,
  qualitySubmitted: true,
  questionsSubmitted: true,
  constraintsSubmitted: false,
  estimateReady: false,
});
check(
  "constraints active after questions (single expandable incomplete)",
  afterQuestions === "constraints"
);
check(
  "estimate review collapsed preference while constraints current",
  !stagePrefersExpanded("estimateReview", afterQuestions) &&
    stagePrefersExpanded("constraints", afterQuestions)
);

const readyToGenerate = resolveActiveDisclosureStage({
  briefSubmitted: true,
  workAreasConfirmed: true,
  scopeDiscoveryEnabled: true,
  scopeReviewComplete: true,
  qualityUnlocked: true,
  qualitySubmitted: true,
  questionsSubmitted: true,
  constraintsSubmitted: true,
  estimateReady: false,
});
check(
  "no stage forced open when ready to generate",
  readyToGenerate === null
);

const stale = resolveActiveDisclosureStage({
  briefSubmitted: true,
  workAreasConfirmed: true,
  scopeDiscoveryEnabled: true,
  scopeReviewComplete: true,
  qualityUnlocked: true,
  qualitySubmitted: true,
  questionsSubmitted: true,
  constraintsSubmitted: true,
  estimateReady: true,
  estimateStale: true,
});
check("stale estimate surfaces Estimate Review", stale === "estimateReview");

// —— Summaries ——
const captureModel = buildProjectCaptureSummaryModel({
  briefText: "Build a timber deck 5 by 3",
  noteCount: 2,
  lastUpdatedAt: new Date().toISOString(),
});
check(
  "capture summary has brief preview and note count",
  captureModel.briefPreview.includes("timber") &&
    captureModel.noteCount === 2 &&
    Boolean(captureModel.lastUpdatedLabel)
);

const waLists = buildWorkAreaSummaryLists([
  {
    id: "1",
    type: "deck",
    name: "Deck",
    status: "confirmed",
    aiConfidence: 0.9,
  },
  {
    id: "2",
    type: "garage",
    name: "Garage",
    status: "excluded",
    aiConfidence: 0.4,
  },
]);
check(
  "work area summary lists included and not included",
  waLists.included.includes("Deck") && waLists.notIncluded.includes("Garage")
);

const premium = buildQualitySummaryModel("premium");
check(
  "specification summary shows premium finish lines",
  premium.title === "Premium" &&
    premium.lines.some((l) => /finish/i.test(l)) &&
    premium.lines.some((l) => /labour/i.test(l))
);

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
      key: "deck.existing_condition",
      label: "Existing condition",
      questionText: "Condition?",
      inputType: "select",
      required: false,
      value: "good_existing",
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
  "question groups present without removing questions",
  qGroups.some((g) => g.label === "Measurements" && g.status === "complete") &&
    qGroups.some((g) => g.label === "Compliance" && /assumption/i.test(g.detail))
);

const scopeLists = buildScopeItemSummaryLists({
  suggestions: [
    {
      proposedTitle: "Deck surface",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Existing demolition",
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
  "scope review summary lists included / not required / needs detail",
  scopeLists.included.includes("Deck surface") &&
    scopeLists.notRequired.includes("Existing demolition") &&
    scopeLists.needsDetail.includes("Engineering")
);

const er = buildEstimateReviewSummaryModel({
  scopeReview: {
    workAreas: [
      {
        workAreaId: "wa1",
        workAreaType: "deck",
        workAreaName: "Deck",
        summary: "Timber deck",
        facts: [
          {
            key: "deck.length_m",
            label: "Length",
            value: "5",
            sourceLabel: "answered",
            sourcePriority: 1,
          },
        ],
        missingItems: [],
        activeQuestions: [],
        assumptions: ["Assumed joist centres"],
      },
    ],
    excludedWorkAreas: [],
    generalAssumptions: [],
    generalExclusions: [],
  },
  estimateReady: true,
  constraintCount: 2,
  includedScopeItemCount: 3,
});
check(
  "estimate review summary has compact dashboard fields",
  er.descriptionLabel.includes("ready") &&
    er.measurementsLabel === "Complete" &&
    er.scopeItemsLabel.includes("3") &&
    er.siteConstraintsLabel.includes("2") &&
    er.assumptionsLabel.includes("1") &&
    er.ready
);

const chips = buildConstraintChipLabels({
  questions: [],
  answers: {},
  submittedRows: [
    { label: "Site access", value: "difficult" },
    { label: "Carry distance", value: "20–30m" },
    { label: "Occupied site", value: true },
  ],
});
check("constraint chips are human-readable", chips.length >= 2);

// —— Card / shell wiring ——
const card = read("components/assistant/CollapsibleStageCard.tsx");
check(
  "card supports preferredExpanded progressive disclosure",
  card.includes("preferredExpanded") && card.includes("userExpanded")
);
check(
  "card supports isActive elevation",
  card.includes("isActive") && card.includes("data-stage-active")
);
check(
  "card has subtle expand/collapse transitions",
  card.includes("transition-[grid-template-rows]") &&
    card.includes("duration-200")
);
check(
  "manual toggle does not call AI or completion APIs",
  !card.includes("runScopeDiscovery") &&
    !card.includes("generateStaticEstimate") &&
    !card.includes("saveBrief")
);

const shell = read("components/assistant/AssistantShell.tsx");
check(
  "shell uses resolveActiveDisclosureStage",
  shell.includes("resolveActiveDisclosureStage") &&
    shell.includes("stagePrefersExpanded")
);
check(
  "shell mounts collapsed summary components",
  shell.includes("ProjectCaptureCollapsedSummary") &&
    shell.includes("WorkAreasCollapsedSummary") &&
    shell.includes("QualityCollapsedSummary") &&
    shell.includes("QuestionsCollapsedSummary") &&
    shell.includes("EstimateReviewCollapsedSummary") &&
    shell.includes("ConstraintsCollapsedSummary")
);
check(
  "specification title used for quality stage (UX rename only)",
  shell.includes('title="Specification"')
);
check(
  "analyse job still explicit (no auto rerun from disclosure)",
  shell.includes("onAnalyse={briefSubmitted ? undefined : handleAnalyseJob}")
);

const review = read("components/assistant/ScopeDiscoveryReviewBlock.tsx");
check(
  "scope review respects preferredExpanded / isActiveStage",
  review.includes("preferredExpanded") &&
    review.includes("isActiveStage") &&
    review.includes("ScopeReviewCollapsedSummary")
);

const estimatePanel = read("components/assistant/EstimatePanel.tsx");
check(
  "quick estimate aligns with active stage visually",
  estimatePanel.includes("isActiveStage") &&
    estimatePanel.includes("data-estimate-panel-active")
);
check(
  "quick estimate not redesigned (title retained)",
  estimatePanel.includes("Quick Estimate")
);

// —— No engine / persistence / commercial changes ——
const disclosure = read("lib/assistant/progressive-disclosure.ts");
const summaries = read("lib/assistant/stage-completion-summaries.ts");
check(
  "disclosure helpers have no commercial imports",
  !disclosure.includes("commercial-engine") &&
    !summaries.includes("commercial-engine")
);
check(
  "disclosure helpers do not import scope-discovery application",
  !disclosure.includes("scope-discovery/application") &&
    !summaries.includes("scope-discovery/application")
);
check(
  "no migration references in 7A helpers",
  !disclosure.includes("migration") && !summaries.includes("030")
);

check(
  "completion doc exists",
  read(
    "docs/implementation/STAGE_3_1B7A_PROGRESSIVE_DISCLOSURE_COMPLETION.md"
  ).includes("Complete — Local")
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

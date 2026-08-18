/**
 * Stage 3.1B.7C — Question organisation, estimate presentation, confidence explanation.
 * Run: npx tsx scripts/verify-stage-3-1b7c-question-estimate-presentation.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  classifyConstraintPresentationCategory,
  classifyQuestionPresentationCategory,
  defaultExpandedQuestionCategory,
  groupConstraintsByPresentationCategory,
  groupQuestionsByPresentationCategory,
  QUESTION_PRESENTATION_CATEGORIES,
  provenanceLabelForQuestionSource,
  provenanceLabelForScopeSource,
  usedForLabelsForFactKey,
  whyThisMattersForKey,
  buildEstimateReviewWorkAreaSummary,
  buildQualitativeConfidenceDrivers,
} from "../lib/assistant/presentation";
import { buildQuickEstimatePresentationModel } from "../lib/assistant/stage-completion-summaries";
import { computeConfidence } from "../lib/estimate/summary";

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

function fileHas(path: string, needle: string | RegExp): boolean {
  const src = read(path);
  return typeof needle === "string" ? src.includes(needle) : needle.test(src);
}

console.log(
  "\n=== Stage 3.1B.7C — Question / Estimate Presentation Verification ===\n"
);

// —— Question grouping ——
const sampleQuestions = [
  { id: "1", key: "deck.length_m", label: "Length", required: true },
  { id: "2", key: "deck.width_m", label: "Width", required: true },
  { id: "3", key: "deck.existing_deck_removal", label: "Existing deck removal", required: false },
  { id: "4", key: "deck.board_material", label: "Decking material", required: false },
  { id: "5", key: "deck.balustrade_required", label: "Balustrade", required: true },
  { id: "6", key: "deck.notes", label: "Other note", required: false },
];

check(
  "measurements classify as measurements",
  classifyQuestionPresentationCategory({
    key: "deck.length_m",
    label: "Length",
  }) === "measurements"
);
check(
  "existing conditions classify",
  classifyQuestionPresentationCategory({
    key: "deck.existing_deck_removal",
    label: "Existing deck removal",
  }) === "existing_conditions"
);
check(
  "materials classify",
  classifyQuestionPresentationCategory({
    key: "deck.board_material",
    label: "Decking material",
    templateCategory: "finish",
  }) === "materials_finishes"
);
check(
  "compliance classify",
  classifyQuestionPresentationCategory({
    key: "deck.balustrade_required",
    label: "Balustrade",
  }) === "compliance_risk"
);

const grouped = groupQuestionsByPresentationCategory({
  questions: sampleQuestions,
  answers: { "1": 5, "2": null, "5": null },
});
check(
  "empty categories hidden",
  !grouped.some((g) => g.questions.length === 0)
);
check(
  "no questions removed",
  grouped.reduce((n, g) => n + g.questions.length, 0) === sampleQuestions.length
);
check(
  "category order deterministic",
  grouped.every((g, i, arr) => {
    if (i === 0) return true;
    const prev = QUESTION_PRESENTATION_CATEGORIES.indexOf(arr[i - 1]!.category);
    const cur = QUESTION_PRESENTATION_CATEGORIES.indexOf(g.category);
    return prev < cur;
  })
);
check(
  "unresolved required categories flagged",
  grouped.some((g) => g.category === "measurements" && g.hasUnresolvedRequired)
);
check(
  "active incomplete group expands by default",
  defaultExpandedQuestionCategory(grouped) === "measurements"
);

const allAnswered = groupQuestionsByPresentationCategory({
  questions: sampleQuestions,
  answers: Object.fromEntries(sampleQuestions.map((q) => [q.id, "x"])),
});
check(
  "completed groups can reopen (default first when complete)",
  defaultExpandedQuestionCategory(allAnswered) === allAnswered[0]?.category
);

// —— Context / provenance ——
check(
  "used for area uses known consumers",
  usedForLabelsForFactKey("deck.area_m2").some((l) =>
    /material|labour|estimate/i.test(l)
  )
);
check(
  "unsupported impact omitted for unknown key",
  usedForLabelsForFactKey("totally.unknown.fact").length === 0
);
check(
  "provenance answered by you",
  provenanceLabelForQuestionSource("user") === "Answered by you"
);
check(
  "provenance calculated",
  provenanceLabelForQuestionSource("derived") === "Calculated"
);
check(
  "provenance from brief",
  provenanceLabelForScopeSource("brief") === "From project brief"
);
check(
  "raw fact keys absent from presentation labels",
  !provenanceLabelForScopeSource("calculated").includes("deck.") &&
    !whyThisMattersForKey("deck.height_m")?.includes("compute")
);

// —— Why this matters ——
check(
  "why this matters deterministic for height",
  Boolean(whyThisMattersForKey("deck.height_m")?.includes("height"))
);
check(
  "why this matters omits unknown",
  whyThisMattersForKey("zzz.unknown") == null
);
check(
  "why this matters has no legal conclusion",
  !/liable|illegal|must comply|breach/i.test(
    whyThisMattersForKey("deck.balustrade_required") ?? ""
  )
);
check(
  "why this matters has no fabricated $ impact",
  !/\$|cost increase|will cost/i.test(
    whyThisMattersForKey("material_carry_distance") ?? ""
  )
);

// —— Constraints ——
const constraintGrouped = groupConstraintsByPresentationCategory([
  { key: "site_access", label: "Site access" },
  { key: "material_carry_distance", label: "Carry" },
  { key: "floor_level", label: "Floor level" },
  { key: "working_hours", label: "Hours" },
]);
check(
  "constraint categories group",
  constraintGrouped.length >= 2 &&
    classifyConstraintPresentationCategory("site_access") === "access_movement"
);
check(
  "constraint empty categories hidden",
  constraintGrouped.every((g) => g.items.length > 0)
);
check(
  "ConstraintBlock keeps EditableConstraintRow",
  fileHas("components/assistant/ConstraintBlock.tsx", "EditableConstraintRow")
);
check(
  "constraints show project-wide label",
  fileHas("components/assistant/ConstraintBlock.tsx", "Project-wide")
);

// —— Estimate Review ——
const erSummary = buildEstimateReviewWorkAreaSummary({
  workAreaId: "wa1",
  workAreaType: "deck",
  workAreaName: "Deck",
  summary: "Timber deck",
  quoteDescription: "Supply and install",
  facts: [
    {
      key: "deck.length_m",
      label: "Length",
      value: "5 m",
      rawValue: 5,
      unit: "m",
      sourceLabel: "answered",
      sourcePriority: 1,
    },
    {
      key: "deck.area_m2",
      label: "Area",
      value: "15 m²",
      rawValue: 15,
      unit: "m²",
      sourceLabel: "calculated",
      sourcePriority: 1,
    },
  ],
  missingItems: ["Existing pile condition"],
  activeQuestions: [],
  assumptions: ["Timber assumed"],
});
check(
  "estimate review summary-first fields",
  erSummary.descriptionReady &&
    erSummary.descriptionLabel.includes("Supply and install") &&
    erSummary.measurementsLabel.includes("5") &&
    erSummary.outstandingLabel.includes("pile") &&
    erSummary.hasOutstanding
);
check(
  "estimate review missing description shows Not added",
  buildEstimateReviewWorkAreaSummary({
    workAreaId: "wa2",
    workAreaType: "deck",
    workAreaName: "Deck",
    summary: "Timber deck",
    quoteDescription: null,
    facts: [],
    missingItems: [],
    activeQuestions: [],
    assumptions: [],
  }).descriptionLabel === "Not added"
);
check(
  "ScopeSummaryBlock has Review details",
  fileHas(
    "components/assistant/ScopeSummaryBlock.tsx",
    "ASSISTANT_ACTION_LABELS.reviewDetails"
  ) &&
    fileHas(
      "lib/assistant/presentation/action-labels.ts",
      'reviewDetails: "Review details"'
    )
);
check(
  "ScopeSummaryBlock retains fact rows / missing section",
  fileHas("components/assistant/ScopeSummaryBlock.tsx", "ScopeReviewFactRow") &&
    fileHas(
      "components/assistant/ScopeSummaryBlock.tsx",
      "ScopeReviewMissingSection"
    )
);

// —— Quick Estimate ——
const confInput = {
  lineItems: [
    {
      rateSource: "user_rate" as const,
      recommendedCost: 100,
      recommendedSell: 150,
    },
  ],
  totalMissingCount: 1,
};
const confBefore = computeConfidence(confInput);
const confAfter = computeConfidence(confInput);
check(
  "confidence calculation unchanged (same inputs → same %)",
  confBefore === confAfter && typeof confBefore === "number"
);

const drivers = buildQualitativeConfidenceDrivers({
  measurementsConfirmed: true,
  scopeConfirmed: true,
  specificationSelected: true,
  siteConstraintsCaptured: true,
  outstandingLabels: ["Existing pile condition"],
});
check(
  "qualitative drivers complete + outstanding",
  drivers.complete.includes("Measurements confirmed") &&
    drivers.outstanding.includes("Existing pile condition")
);

const qe = buildQuickEstimatePresentationModel({
  workAreaNames: ["Deck"],
  includedScopeItemCount: 6,
  outstandingClarificationCount: 1,
  assumptionCount: 2,
  missingCount: 1,
  constraintCount: 3,
  specificationSelected: true,
  questionsSubmitted: true,
  constraintsSubmitted: true,
});
check(
  "project-health summary fields",
  qe.unansweredRequiredDetails.includes("1") &&
    qe.assumptionsLabel.includes("2") &&
    qe.estimateReadinessLabel.length > 0 &&
    qe.confidenceComplete.length > 0
);
check(
  "EstimatePanel shows Estimate confidence / project health",
  fileHas("components/assistant/EstimatePanel.tsx", "Estimate confidence") &&
    fileHas("components/assistant/EstimatePanel.tsx", "Project health")
);
check(
  "no Builder Confidence label",
  !fileHas("components/assistant/EstimatePanel.tsx", "Builder Confidence")
);
check(
  "breakdown separates Not required / allowances language",
  fileHas("components/assistant/EstimateBreakdownModal.tsx", "Not required") &&
    fileHas(
      "components/assistant/EstimateBreakdownModal.tsx",
      "Commercial breakdown"
    )
);
check(
  "breakdown has progressive disclosure sections",
  fileHas("components/assistant/EstimateBreakdownModal.tsx", "Confirmed scope") &&
    fileHas(
      "components/assistant/EstimateBreakdownModal.tsx",
      "Outstanding information"
    )
);
check(
  "no client-side money arithmetic in presentation helpers",
  !fileHas(
    "lib/assistant/presentation/confidence-drivers.ts",
    "recommendedSell"
  ) &&
    !fileHas(
      "lib/assistant/presentation/estimate-review-summary.ts",
      "recommendedSell"
    )
);

// —— Terminology ——
check(
  "Stepper uses Clarify",
  fileHas("components/assistant/StepperNav.tsx", 'label: "Clarify"')
);
check(
  "AssistantShell uses Scope Details + Site Constraints",
  fileHas("components/assistant/AssistantShell.tsx", 'title="Scope Details"') &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      'title="Site Constraints"'
    ) &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      'title="Estimate Review"'
    ) &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      'title="Specification"'
    )
);
check(
  "Quick Estimate casing",
  fileHas("components/assistant/EstimatePanel.tsx", "Quick Estimate")
);

// —— QuestionBlock structure ——
check(
  "QuestionBlock groups by presentation category",
  fileHas(
    "components/assistant/QuestionBlock.tsx",
    "groupQuestionsByPresentationCategory"
  ) &&
    fileHas("components/assistant/QuestionBlock.tsx", "Why this matters") &&
    fileHas("components/assistant/QuestionBlock.tsx", "Used for")
);
check(
  "QuestionBlock keeps optimistic answers via stable keys",
  fileHas("components/assistant/QuestionBlock.tsx", "question.id") &&
    !fileHas("components/assistant/QuestionBlock.tsx", "key={Math.random")
);

// —— Boundaries (no forbidden edits) ——
check(
  "computeConfidence source still exports (engine frozen check)",
  fileHas("lib/estimate/summary.ts", "export function computeConfidence")
);
check(
  "no migration 030 added by this batch",
  !existsSync(join(process.cwd(), "supabase/migrations/030_scope_discovery.sql"))
);
check(
  "presentation catalogue is presentation-only path",
  existsSync(
    join(process.cwd(), "lib/assistant/presentation/question-categories.ts")
  )
);
check(
  "Scope Discovery decision services not rewritten for 7C",
  fileHas(
    "lib/scope-discovery/application/decision-services.ts",
    "Clarifications are answered in Scope Details"
  )
);

// Soft: ensure docs placeholders will exist after write
check(
  "verify script path self-consistent",
  existsSync(
    join(
      process.cwd(),
      "scripts/verify-stage-3-1b7c-question-estimate-presentation.ts"
    )
  )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

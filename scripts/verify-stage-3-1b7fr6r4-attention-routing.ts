/**
 * Stage 3.1B.7F-R6-R4 / R4.1 — Actionable attention routing.
 *
 * Run: npx tsx scripts/verify-stage-3-1b7fr6r4-attention-routing.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  SCOPE_DETAILS_REVIEW_COPY,
  SCOPE_REVIEW_COPY,
  attentionHasValidScopeDetailsReviewTarget,
  attentionHasValidScopeReviewTarget,
  attentionPromisesScopeDetailsReview,
  attentionShowsReviewButton,
  buildQuickEstimateAttentionItems,
} from "../lib/assistant/presentation/quick-estimate-view-model";
import { composeCurrentWorkAreaScopeState } from "../lib/assistant/current-work-area-scope-state";
import { getQuestionTemplateByKey } from "../lib/scopes/registry";
import { routeClarificationToScopeDetails } from "../lib/scope-discovery/ui/clarification-routing";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`PASS  ${label}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${label}`);
    failed += 1;
  }
}

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

console.log("\n=== Stage 3.1B.7F-R6-R4.1 — Attention routing ===\n");

console.log("CONTRACT");
const withQuestion = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Ceilings",
      workAreaId: "wa-ceil",
      label: "Ceiling area",
      factKey: "ceilings.area_m2",
      questionId: "q-area",
      actionable: true,
      reviewTarget: "estimateReview",
    },
  ],
});
check(
  "QUESTION → Review in Scope Details + Review button",
  withQuestion[0]?.detail === SCOPE_DETAILS_REVIEW_COPY &&
    attentionShowsReviewButton(withQuestion[0]!) &&
    attentionHasValidScopeDetailsReviewTarget(withQuestion[0]!)
);

const scopeLevel = buildQuickEstimateAttentionItems({
  scopeReviewAttention: [
    {
      label: "Seismic interfaces",
      workAreaName: "Ceilings",
      workAreaId: "wa-ceil",
      suggestionId: "s-seismic",
    },
  ],
});
check(
  "SCOPE → Review scope + Review button",
  scopeLevel[0]?.detail === SCOPE_REVIEW_COPY &&
    scopeLevel[0]?.attentionKind === "SCOPE" &&
    scopeLevel[0]?.reviewTarget === "scopeReview" &&
    attentionShowsReviewButton(scopeLevel[0]!) &&
    attentionHasValidScopeReviewTarget(scopeLevel[0]!)
);

const withoutQuestion = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Ceilings",
      workAreaId: "wa-ceil",
      label: "Seismic interfaces",
      factKey: "fitout.ceiling_seismic",
      actionable: true, // ignored without questionId for QUESTION path
    },
  ],
});
check(
  "no question + no SCOPE kind → copy does not promise Scope Details Review",
  withoutQuestion[0]?.detail !== SCOPE_DETAILS_REVIEW_COPY &&
    !attentionPromisesScopeDetailsReview(withoutQuestion[0]!) &&
    !attentionShowsReviewButton(withoutQuestion[0]!)
);

const labelOnly = buildQuickEstimateAttentionItems({
  missingLabels: ["Seismic interfaces"],
});
check(
  "legacy missingLabels alone are non-actionable",
  labelOnly.every((i) => i.detail !== SCOPE_DETAILS_REVIEW_COPY) &&
    labelOnly.every((i) => !attentionShowsReviewButton(i))
);

const mixed = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Ceilings",
      workAreaId: "wa-ceil",
      label: "Ceiling area",
      questionId: "q1",
    },
    {
      workAreaName: "Ceilings",
      label: "Orphan allowance",
      attentionKind: "ASSUMPTION",
      detailOverride: "Allowance / confirmation required",
    },
  ],
  scopeReviewAttention: [
    {
      label: "Seismic interfaces",
      workAreaId: "wa-ceil",
      suggestionId: "s-seismic",
    },
  ],
});
check(
  "every Review in Scope Details item has valid question target",
  mixed
    .filter((i) => attentionPromisesScopeDetailsReview(i))
    .every((i) => attentionHasValidScopeDetailsReviewTarget(i))
);
check(
  "SCOPE and QUESTION coexist without contradiction",
  mixed.some((i) => i.label === "Ceiling area" && attentionShowsReviewButton(i)) &&
    mixed.some(
      (i) =>
        i.label === "Seismic interfaces" &&
        i.detail === SCOPE_REVIEW_COPY &&
        attentionShowsReviewButton(i)
    ) &&
    mixed.some(
      (i) =>
        i.label === "Orphan allowance" && !attentionShowsReviewButton(i)
    )
);
check(
  "EstimatePanel uses attentionShowsReviewButton guard",
  read("components/assistant/EstimatePanel.tsx").includes(
    "attentionShowsReviewButton"
  )
);

console.log("\nSEISMIC");
const seismicRoute = routeClarificationToScopeDetails({
  rationaleCode: "fitout.ceilings.seismic",
  suggestionKind: "CLARIFICATION_REQUIRED",
  title: "Seismic interfaces",
});
check(
  "seismic is SCOPE_EXISTENCE (not Scope Details questionnaire)",
  seismicRoute.kind === "SCOPE_EXISTENCE" &&
    seismicRoute.factKey === "fitout.ceiling_seismic"
);
check(
  "seismic Fact has no Scope Details question template",
  getQuestionTemplateByKey("fitout.ceiling_seismic") == null &&
    getQuestionTemplateByKey("fitout.seismic_required") == null
);

const seismicProposed = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "s-seismic",
      proposedTitle: "Seismic interfaces",
      decisionState: "PROPOSED",
      suggestionKind: "CLARIFICATION_REQUIRED",
      proposalClass: "CLARIFICATION",
      rationaleCode: "fitout.ceilings.seismic",
      latestReasonCode: null,
      relatedWorkAreaId: "wa-ceil",
    },
  ],
  manualItems: [],
  scopeReview: {
    workAreas: [
      {
        workAreaId: "wa-ceil",
        workAreaName: "Ceilings",
        workAreaType: "ceilings",
        facts: [],
        activeQuestions: [],
        answeredQuestions: [],
        missingItems: [],
        assumptions: [],
        includedScopeItems: [],
        excludedScopeItems: [],
      },
    ],
    generalAssumptions: [],
  } as never,
});
check(
  "PROPOSED seismic → Scope Review attention with suggestion id",
  seismicProposed.scopeReviewAttention.length === 1 &&
    seismicProposed.scopeReviewAttention[0]?.suggestionId === "s-seismic" &&
    seismicProposed.needsDetailCount === 0
);

const seismicIncluded = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "s-seismic",
      proposedTitle: "Seismic interfaces",
      decisionState: "ACCEPTED",
      suggestionKind: "CLARIFICATION_REQUIRED",
      proposalClass: "CLARIFICATION",
      rationaleCode: "fitout.ceilings.seismic",
      latestReasonCode: "included_pending_detail",
      relatedWorkAreaId: "wa-ceil",
    },
  ],
  manualItems: [],
  scopeReview: {
    workAreas: [
      {
        workAreaId: "wa-ceil",
        workAreaName: "Ceilings",
        workAreaType: "ceilings",
        facts: [],
        activeQuestions: [],
        answeredQuestions: [],
        missingItems: [],
        assumptions: [],
        includedScopeItems: [],
        excludedScopeItems: [],
      },
    ],
    generalAssumptions: [],
  } as never,
});
check(
  "explicit INCLUDE seismic without question → not NEEDS_DETAIL / not endless attention",
  seismicIncluded.needsDetailCount === 0 &&
    seismicIncluded.scopeReviewAttention.length === 0 &&
    !seismicIncluded.summaryLists.pendingScopeDetails.some(
      (p) => p.title === "Seismic interfaces"
    )
);

const seismicExcluded = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "s-seismic",
      proposedTitle: "Seismic interfaces",
      decisionState: "REJECTED",
      suggestionKind: "CLARIFICATION_REQUIRED",
      proposalClass: "CLARIFICATION",
      rationaleCode: "fitout.ceilings.seismic",
      latestReasonCode: "scope_item_not_required",
      relatedWorkAreaId: "wa-ceil",
    },
  ],
  manualItems: [],
});
check(
  "explicit EXCLUDE seismic → no Scope Review attention",
  seismicExcluded.scopeReviewAttention.length === 0 &&
    seismicExcluded.needsDetailCount === 0
);

check(
  "batch confirm skips pending-detail for no-question clarifications",
  read(
    "lib/scope-discovery/application/batch-confirm-scope.ts"
  ).includes("clarificationNeedsPendingDetail")
);

console.log("\nPANEL / ROUTING");
check(
  "EstimatePanel accepts scopeReviewAttention",
  read("components/assistant/EstimatePanel.tsx").includes(
    "scopeReviewAttention"
  )
);
check(
  "AssistantShell focuses suggestion for Scope Review Review",
  read("components/assistant/AssistantShell.tsx").includes(
    "reviewFocusSuggestionId"
  ) &&
    read("components/assistant/AssistantShell.tsx").includes(
      "scope-item-"
    )
);
  check(
  "ScopeDiscoveryReviewBlock opens Edit scope on focus token",
  read("components/assistant/ScopeDiscoveryReviewBlock.tsx").includes(
    "requestEditToken"
  ) &&
    read("components/assistant/ScopeDiscoveryReviewBlock.tsx").includes(
      "forceEditFromReview"
    )
);
check(
  "R6-R3 sticky disclosure helpers still present",
  existsSync(
    resolve(process.cwd(), "lib/assistant/presentation/question-disclosure.ts")
  ) &&
    read("components/assistant/QuestionBlock.tsx").includes("stickyOpen")
);

console.log("\nBOUNDARIES");
check(
  "no migration 034",
  !readdirSync(resolve(process.cwd(), "supabase/migrations")).some((f) =>
    f.startsWith("034")
  )
);
check(
  "Production Scope Discovery config intact",
  existsSync(
    resolve(process.cwd(), "lib/scope-discovery/configuration/index.ts")
  )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

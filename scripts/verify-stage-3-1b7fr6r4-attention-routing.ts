/**
 * Stage 3.1B.7F-R6-R4 — Actionable attention routing final fix.
 *
 * Run: npx tsx scripts/verify-stage-3-1b7fr6r4-attention-routing.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  SCOPE_DETAILS_REVIEW_COPY,
  attentionHasValidScopeDetailsReviewTarget,
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

console.log("\n=== Stage 3.1B.7F-R6-R4 — Attention routing ===\n");

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
  "valid target → Review in Scope Details + Review button",
  withQuestion[0]?.detail === SCOPE_DETAILS_REVIEW_COPY &&
    attentionShowsReviewButton(withQuestion[0]!) &&
    attentionHasValidScopeDetailsReviewTarget(withQuestion[0]!)
);

const withoutQuestion = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Ceilings",
      workAreaId: "wa-ceil",
      label: "Seismic interfaces",
      factKey: "fitout.ceiling_seismic",
      actionable: true, // ignored without questionId
    },
  ],
});
check(
  "no target → copy does not promise Scope Details Review",
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
      label: "Seismic interfaces",
      attentionKind: "ASSUMPTION",
      detailOverride: "Allowance / confirmation required",
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
  "seismic maps to fitout.ceiling_seismic Fact route",
  seismicRoute.mapped && seismicRoute.factKey === "fitout.ceiling_seismic"
);
check(
  "seismic Fact has no Scope Details question template",
  getQuestionTemplateByKey("fitout.ceiling_seismic") == null &&
    getQuestionTemplateByKey("fitout.seismic_required") == null
);

const seismicState = composeCurrentWorkAreaScopeState({
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
  "seismic without answerable question is not NEEDS_DETAIL",
  seismicState.needsDetailCount === 0 &&
    !seismicState.summaryLists.pendingScopeDetails.some(
      (p) => p.title === "Seismic interfaces"
    )
);
check(
  "seismic reclassified attention uses non-actionable copy",
  withoutQuestion[0]?.attentionKind === "NON_ACTIONABLE_INFORMATION" &&
    withoutQuestion[0]?.detail === "More information required" &&
    withoutQuestion[0]?.reviewTarget == null
);
check(
  "ASSUMPTION override uses allowance copy (no Review)",
  mixed[1]?.attentionKind === "ASSUMPTION" &&
    mixed[1]?.detail === "Allowance / confirmation required" &&
    !attentionShowsReviewButton(mixed[1]!)
);

const resolved = buildQuickEstimateAttentionItems({
  missingByWorkArea: [],
  clarificationLabels: [],
  pendingProposalCount: 0,
});
check(
  "resolved / empty inputs → zero attention items",
  resolved.length === 0
);

console.log("\nPANEL / DISCLOSURE");
check(
  "panel no longer treats hasEditors as actionable",
  !read("components/assistant/EstimatePanel.tsx").includes(
    "hasEditors"
  ) &&
    read("components/assistant/EstimatePanel.tsx").includes(
      "Boolean(matched?.id)"
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
check(
  "R6-R4 docs present",
  existsSync(
    resolve(
      process.cwd(),
      "docs/runbooks/STAGE_3_1B7FR6R4_FINAL_FITOUT_RETEST.md"
    )
  ) &&
    existsSync(
      resolve(
        process.cwd(),
        "docs/performance/ASSISTANT_RESPONSIVENESS_LATENCY_OPTIMISATION_PASS.md"
      )
    )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

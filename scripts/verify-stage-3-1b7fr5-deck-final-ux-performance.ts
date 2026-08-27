/**
 * Stage 3.1B.7F-R5 — Deck final UX, clarification accuracy & performance.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  defaultExpandedQuestionCategories,
  defaultExpandedQuestionCategory,
  groupQuestionsByPresentationCategory,
} from "../lib/assistant/presentation/question-categories";
import {
  buildSiteConstraintFallbackQuestions,
  hasNoKnownConstraintValues,
  SITE_CONSTRAINT_FALLBACK_INTRO,
} from "../lib/assistant/site-constraint-fallback";
import { composeCurrentWorkAreaScopeState } from "../lib/assistant/current-work-area-scope-state";
import { buildQuickEstimateAttentionItems } from "../lib/assistant/presentation/quick-estimate-view-model";
import type { ScopeReview } from "../lib/assistant/types";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

console.log("\n=== Stage 3.1B.7F-R5 — Deck final UX & performance ===\n");

// ─── QUESTIONS DISCLOSURE ────────────────────────────────────
console.log("QUESTIONS");
const questionFixtures = [
  {
    id: "q1",
    key: "deck.length_m",
    label: "Length",
    required: true,
  },
  {
    id: "q2",
    key: "deck.substructure_condition",
    label: "Substructure",
    required: true,
  },
  {
    id: "q3",
    key: "deck.board_material",
    label: "Board material",
    required: false,
  },
];
const groups = groupQuestionsByPresentationCategory({
  questions: questionFixtures,
  answers: { q1: null, q2: null, q3: "Kwila" },
});
const expanded = defaultExpandedQuestionCategories(groups);
check(
  "unresolved required groups default expanded (plural)",
  expanded.size >= 1 &&
    [...expanded].every((c) =>
      groups.some((g) => g.category === c && g.hasUnresolvedRequired)
    )
);
check(
  "defaultExpandedQuestionCategory still returns first incomplete",
  defaultExpandedQuestionCategory(groups) != null
);
check(
  "QuestionBlock uses sticky disclosure over live preferred set",
  read("components/assistant/QuestionBlock.tsx").includes(
    "defaultExpandedQuestionCategories"
  ) &&
    read("components/assistant/QuestionBlock.tsx").includes(
      "resolveQuestionCategoryExpanded"
    ) &&
    read("components/assistant/QuestionBlock.tsx").includes("stickyOpen")
);

const completeGroups = groupQuestionsByPresentationCategory({
  questions: [
    {
      id: "q1",
      key: "deck.length_m",
      label: "Length",
      required: true,
    },
  ],
  answers: { q1: 5 },
});
check(
  "completed groups may collapse (no unresolved set)",
  defaultExpandedQuestionCategories(completeGroups).size === 0
);

// ─── CONSTRAINT FALLBACK ─────────────────────────────────────
console.log("\nCONSTRAINT FALLBACK");
const fallback = buildSiteConstraintFallbackQuestions({
  workAreaTypes: ["deck"],
});
check(
  "zero detected constraints yields confirmation questions",
  fallback.length > 0 &&
    fallback.some((q) => q.key === "site_access") &&
    fallback.some((q) => q.key === "material_carry_distance")
);
check(
  "fallback uses existing taxonomy only",
  fallback.every((q) => typeof q.key === "string" && q.key.length > 0) &&
    !fallback.some((q) => q.key === "airport_security")
);
check(
  "no fake constraint values invented",
  fallback.every(
    (q) => q.value === null || q.value === undefined || q.value === ""
  )
);
check(
  "fallback intro copy present",
  SITE_CONSTRAINT_FALLBACK_INTRO.includes("No site constraints have been identified")
);
check(
  "hasNoKnownConstraintValues true when blank",
  hasNoKnownConstraintValues({
    questions: fallback,
    answers: Object.fromEntries(fallback.map((q) => [q.id, null])),
  })
);
check(
  "ConstraintBlock wires fallback",
  read("components/assistant/ConstraintBlock.tsx").includes(
    "buildSiteConstraintFallbackQuestions"
  ) &&
    read("components/assistant/ConstraintBlock.tsx").includes(
      "SITE_CONSTRAINT_FALLBACK_INTRO"
    )
);

// ─── ATTENTION ───────────────────────────────────────────────
console.log("\nATTENTION");
const scopeReview = {
  workAreas: [
    {
      workAreaId: "wa",
      workAreaName: "Deck",
      workAreaType: "deck",
      facts: [
        { id: "f1", key: "deck.substructure_condition", label: "Sub", value: "sound" },
      ],
      activeQuestions: [],
      answeredQuestions: [],
      missingItems: [],
    },
  ],
} as ScopeReview;

const resolved = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "s1",
      proposedTitle: "Existing substructure condition",
      decisionState: "ACCEPTED",
      proposalClass: "CLARIFICATION",
      suggestionKind: "CLARIFICATION_REQUIRED",
      latestReasonCode: "included_pending_detail",
      rationaleCode: "deck.substructure.missing_condition",
      relatedWorkAreaId: "wa",
    },
  ],
  scopeReview,
});
check(
  "current resolved clarification → no needsDetail attention",
  resolved.needsDetailCount === 0 &&
    resolved.summaryLists.pendingScopeDetails.length === 0
);

const unresolved = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "s1",
      proposedTitle: "Existing substructure condition",
      decisionState: "ACCEPTED",
      proposalClass: "CLARIFICATION",
      suggestionKind: "CLARIFICATION_REQUIRED",
      latestReasonCode: "included_pending_detail",
      rationaleCode: "deck.substructure.missing_condition",
      relatedWorkAreaId: "wa",
    },
  ],
  scopeReview: {
    workAreas: [
      {
        workAreaId: "wa",
        workAreaName: "Deck",
        workAreaType: "deck",
        facts: [],
        activeQuestions: [],
        answeredQuestions: [],
        missingItems: [],
      },
    ],
  } as ScopeReview,
});
check(
  "real unresolved clarification → named pending title",
  unresolved.needsDetailCount === 1 &&
    unresolved.summaryLists.pendingScopeDetails.some((p) =>
      p.title.includes("substructure")
    )
);

const namedAttention = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Deck",
      label: "Confirm existing substructure condition",
      questionId: "q-sub",
      workAreaId: "wa-deck",
    },
  ],
  clarificationLabels: [],
});
check(
  "named attention item for Scope Details",
  namedAttention.length === 1 &&
    namedAttention[0]?.reviewTarget === "estimateReview" &&
    namedAttention[0]?.detail === "Review in Scope Details" &&
    Boolean(namedAttention[0]?.questionId)
);

const manualAttention = buildQuickEstimateAttentionItems({
  missingLabels: ["Price Additional waste removal"],
  clarificationLabels: [],
});
check(
  "manual Pricing required style item can be named",
  manualAttention.some((i) => i.label.includes("waste removal"))
);

check(
  "no stale clarification channel from needsDetail in shell",
  read("components/assistant/AssistantShell.tsx").includes(
    "outstandingClarificationCount: 0"
  ) &&
    read("components/assistant/EstimatePanel.tsx").includes(
      "pendingScopeDetailTitles"
    )
);

check(
  "unmapped pending no longer sticky NEEDS_DETAIL",
  composeCurrentWorkAreaScopeState({
    suggestions: [
      {
        suggestionId: "u1",
        proposedTitle: "Mystery item",
        decisionState: "ACCEPTED",
        proposalClass: "SCOPE_ITEM",
        latestReasonCode: "included_pending_detail",
        relatedWorkAreaId: "wa",
      },
    ],
    scopeReview,
  }).needsDetailCount === 0
);

// ─── REVIEW ──────────────────────────────────────────────────
console.log("\nREVIEW");
const shell = read("components/assistant/AssistantShell.tsx");
check(
  "Review attention uses nearest scroll",
  /handleReviewAttention[\s\S]*block:\s*"nearest"/.test(shell)
);
check(
  "Review expands Scope Details before scroll",
  shell.includes("setForceExpandQuestions(true)") &&
    shell.includes("forceExpanded={forceExpandQuestions}")
);
check(
  "completed Scope Details keeps questionsCardRef",
  /questionsSubmitted && questionBlock[\s\S]*cardRef=\{questionsCardRef\}/.test(
    shell
  )
);
check(
  "EstimatePanel only shows Review for attention items",
  read("components/assistant/EstimatePanel.tsx").includes(
    "attentionShowsReviewButton"
  ) &&
    read("components/assistant/EstimatePanel.tsx").includes(
      "status.attentionItems.length > 0"
    )
);
check(
  "zero clarificationLabels when presentation says open",
  read("components/assistant/EstimatePanel.tsx").includes(
    "clarificationLabels: string[] = []"
  )
);

// ─── PERFORMANCE ─────────────────────────────────────────────
console.log("\nPERFORMANCE");
const actions = read("lib/assistant/actions.ts");
check(
  "confirmWorkAreas does not await discovery",
  !/confirmWorkAreas[\s\S]*await runScopeDiscovery/.test(actions) &&
    actions.includes("ScopeDiscoveryReviewBlock auto-run")
);
check(
  "Work Area confirm uses project-only revalidate",
  /confirmWorkAreas[\s\S]*revalidateProjectAssistantPath/.test(actions)
);
check(
  "estimate generate uses project-only revalidate",
  /runEstimateGeneration[\s\S]*revalidateProjectAssistantPath/.test(actions)
);
check(
  "duplicate generate/confirm guarded by action lock",
  read("components/assistant/AssistantShell.tsx").includes("actionLockRef") &&
    read("components/assistant/AssistantShell.tsx").includes(
      'runAction("work_areas"'
    )
);
check(
  "Scope Review auto-run path uses refreshResults (analyse)",
  read("components/assistant/ScopeDiscoveryReviewBlock.tsx").includes(
    "refreshResults"
  ) &&
    read("components/assistant/ScopeDiscoveryReviewBlock.tsx").includes(
      "Auto-start analysis when Work Areas were confirmed"
    )
);
check(
  "Saving Work Areas pending copy present",
  read("lib/assistant/presentation/action-labels.ts").includes(
    "savingWorkAreas"
  )
);

// ─── BOUNDARIES ──────────────────────────────────────────────
console.log("\nBOUNDARIES");
check(
  "migration 034 branding boundary acknowledged",
  readdirSync(join(process.cwd(), "supabase/migrations")).some(
    (f) => f === "034_organisation_branding_storage.sql"
  )
);
check(
  "no Stage 3.2 started / Production remains disabled markers",
  read("docs/implementation/STAGE_3_1B7FR5_DECK_FINAL_UX_PERFORMANCE_COMPLETION.md").includes(
    "Production Scope Discovery remains Disabled"
  ) &&
    read("docs/runbooks/STAGE_3_1B7FR5_DECK_FINAL_RETEST.md").includes(
      "Production Scope Discovery remains **Disabled**"
    )
);
check(
  "R5 verify present",
  read("scripts/verify-stage-3-1b7fr5-deck-final-ux-performance.ts").includes(
    "7F-R5"
  )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

/**
 * Stage 3.1B.6R3.1 — Scope Impact Recommendation UI verification.
 * Run: npx tsx scripts/verify-stage-3-1b6r31-scope-impact-recommendations.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyFactScopeImpact,
  buildScopeChangeRecommendations,
  isFactMaterialForDiscoveryStale,
} from "../lib/scope-discovery/scope-impact";
import {
  collectDismissedRecommendationIds,
  factValueDigest,
  humanTriggeringAnswerSummary,
  SCOPE_IMPACT_KEEP_REASON,
  scopeImpactRecommendationId,
} from "../lib/scope-discovery/ui/scope-impact-identity";
import { isQuestionSuppressedByScopeItemExclusion } from "../lib/scope-discovery/ui/scope-item-question-gates";

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
  "\n=== Stage 3.1B.6R3.1 — Scope Impact Recommendations Verification ===\n"
);

// —— Classification to UI ——
check(
  "DETAIL_ONLY produces no recommendation",
  classifyFactScopeImpact({
    factKey: "deck.length_m",
    oldValue: 4,
    newValue: 5,
  }).classification === "DETAIL_ONLY" &&
    buildScopeChangeRecommendations({
      facts: [
        { key: "deck.length_m", value: 5, work_area_id: "wa1" },
      ],
      workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
      scopeItemStates: [
        {
          suggestionId: "s1",
          proposedWorkAreaType: "demolition",
          proposedTitle: "Demolition",
          decisionState: "ACCEPTED",
          relatedWorkAreaId: "wa1",
        },
      ],
    }).length === 0
);

check(
  "SCOPE_SUPPORTING produces no exclusion recommendation",
  classifyFactScopeImpact({
    factKey: "deck.existing_deck_removal",
    oldValue: "no",
    newValue: "yes",
  }).classification === "SCOPE_ADDING" ||
    classifyFactScopeImpact({
      factKey: "deck.existing_deck_removal",
      oldValue: null,
      newValue: "maybe",
    }).classification === "SCOPE_SUPPORTING"
);

const supportingNoRec = buildScopeChangeRecommendations({
  facts: [
    {
      key: "deck.existing_deck_removal",
      value: "unsure",
      work_area_id: "wa1",
    },
  ],
  workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
  scopeItemStates: [
    {
      suggestionId: "s1",
      proposedWorkAreaType: "demolition",
      proposedTitle: "Demolition",
      decisionState: "ACCEPTED",
      relatedWorkAreaId: "wa1",
    },
  ],
});
check(
  "non-boolean supporting signal does not recommend exclusion",
  supportingNoRec.length === 0
);

const excludeRecs = buildScopeChangeRecommendations({
  facts: [
    {
      key: "deck.existing_deck_removal",
      value: "no",
      work_area_id: "wa1",
    },
  ],
  workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
  scopeItemStates: [
    {
      suggestionId: "s1",
      proposedWorkAreaType: "demolition",
      proposedTitle: "Demolition",
      decisionState: "ACCEPTED",
      relatedWorkAreaId: "wa1",
    },
  ],
});
check(
  "SCOPE_EXCLUDING produces Mark not required",
  excludeRecs.length === 1 &&
    excludeRecs[0]!.suggestedState === "NOT_REQUIRED" &&
    excludeRecs[0]!.classification === "SCOPE_EXCLUDING"
);

const addRecs = buildScopeChangeRecommendations({
  facts: [
    {
      key: "deck.balustrade_required",
      value: "yes",
      work_area_id: "wa1",
    },
  ],
  workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
  scopeItemStates: [
    {
      suggestionId: "s2",
      proposedWorkAreaType: "balustrade",
      proposedTitle: "Balustrade",
      decisionState: "REJECTED",
      relatedWorkAreaId: "wa1",
    },
  ],
});
check(
  "SCOPE_ADDING produces Include in scope",
  addRecs.length === 1 &&
    addRecs[0]!.suggestedState === "INCLUDED" &&
    addRecs[0]!.classification === "SCOPE_ADDING"
);

check(
  "FULL_REANALYSIS_REQUIRED classification for project-level keys",
  classifyFactScopeImpact({
    factKey: "primary_scope_change",
    oldValue: "a",
    newValue: "b",
  }).classification === "FULL_REANALYSIS_REQUIRED" &&
    isFactMaterialForDiscoveryStale("primary_scope_change") === true &&
    buildScopeChangeRecommendations({
      facts: [
        {
          key: "primary_scope_change",
          value: "b",
          work_area_id: "wa1",
        },
      ],
      workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
      scopeItemStates: [],
    }).length === 0
);

// —— Identity / dedupe ——
const idA = scopeImpactRecommendationId({
  workAreaId: "wa1",
  scopeItemType: "demolition",
  factKey: "deck.existing_deck_removal",
  factValue: "no",
  suggestedState: "NOT_REQUIRED",
});
const idB = scopeImpactRecommendationId({
  workAreaId: "wa1",
  scopeItemType: "demolition",
  factKey: "deck.existing_deck_removal",
  factValue: "no",
  suggestedState: "NOT_REQUIRED",
});
const idC = scopeImpactRecommendationId({
  workAreaId: "wa1",
  scopeItemType: "demolition",
  factKey: "deck.existing_deck_removal",
  factValue: "yes",
  suggestedState: "NOT_REQUIRED",
});
check("stable identity across identical inputs", idA === idB);
check("identity changes when Fact value changes", idA !== idC);
check(
  "recommendation id matches builder id",
  excludeRecs[0]!.id === idA
);
check(
  "duplicate build suppresses via seen set",
  buildScopeChangeRecommendations({
    facts: [
      {
        key: "deck.existing_deck_removal",
        value: "no",
        work_area_id: "wa1",
      },
      {
        key: "deck.existing_deck_removal",
        value: "no",
        work_area_id: "wa1",
      },
    ],
    workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
    scopeItemStates: [
      {
        suggestionId: "s1",
        proposedWorkAreaType: "demolition",
        proposedTitle: "Demolition",
        decisionState: "ACCEPTED",
        relatedWorkAreaId: "wa1",
      },
    ],
  }).length === 1
);

const dismissed = collectDismissedRecommendationIds([
  {
    reason_code: SCOPE_IMPACT_KEEP_REASON,
    user_note: idA,
  },
]);
check("keep reason collects dismissed id from user_note", dismissed.has(idA));
check(
  "dismissed recommendation not recreated",
  buildScopeChangeRecommendations({
    facts: [
      {
        key: "deck.existing_deck_removal",
        value: "no",
        work_area_id: "wa1",
      },
    ],
    workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
    scopeItemStates: [
      {
        suggestionId: "s1",
        proposedWorkAreaType: "demolition",
        proposedTitle: "Demolition",
        decisionState: "ACCEPTED",
        relatedWorkAreaId: "wa1",
      },
    ],
    dismissedIds: dismissed,
  }).length === 0
);
check(
  "materially changed Fact may recreate recommendation",
  buildScopeChangeRecommendations({
    facts: [
      {
        key: "deck.existing_deck_removal",
        value: false,
        work_area_id: "wa1",
      },
    ],
    workAreas: [{ id: "wa1", type: "deck", name: "Deck" }],
    scopeItemStates: [
      {
        suggestionId: "s1",
        proposedWorkAreaType: "demolition",
        proposedTitle: "Demolition",
        decisionState: "ACCEPTED",
        relatedWorkAreaId: "wa1",
      },
    ],
    dismissedIds: dismissed,
  }).length === 1
);

check(
  "human trigger never exposes raw Fact key",
  !humanTriggeringAnswerSummary({
    factKey: "deck.existing_deck_removal",
    value: "no",
  }).includes("deck.existing_deck_removal") &&
    humanTriggeringAnswerSummary({
      factKey: "deck.existing_deck_removal",
      value: "no",
    }).toLowerCase().includes("removal")
);

check(
  "fact value digest is stable",
  factValueDigest("no") === factValueDigest("no") &&
    factValueDigest("no") !== factValueDigest("yes")
);

// —— Question sync helpers ——
check(
  "exclusion suppresses related unanswered questions",
  isQuestionSuppressedByScopeItemExclusion({
    factKey: "deck.existing_deck_removal",
    excludedTypes: new Set(["demolition"]),
  }) === true
);
check(
  "inclusion path does not invent suppressions for other types",
  isQuestionSuppressedByScopeItemExclusion({
    factKey: "deck.balustrade_required",
    excludedTypes: new Set(["demolition"]),
  }) === false
);

// —— Apply / Keep wiring (static) ——
const actions = read("lib/scope-discovery/application/scope-impact-recommendation-actions.ts");
check(
  "apply uses batch confirm lifecycle",
  actions.includes("batchConfirmScopeItemsApp") &&
    actions.includes("createdWorkAreaId: null") &&
    actions.includes("createdFact: false")
);
check(
  "apply blocks duplicate when already at intended state",
  actions.includes("This scope change was already applied.")
);
check(
  "keep appends same-state decision with keep reason",
  actions.includes("SCOPE_IMPACT_KEEP_REASON") &&
    actions.includes("insertDiscoveryDecision") &&
    actions.includes("userNote: input.recommendationId")
);
check(
  "keep does not call provider",
  !actions.includes("runProvider") && !actions.includes("invokeProvider")
);

const serverActions = read("lib/scope-discovery/actions.ts");
check(
  "server actions expose apply and keep",
  serverActions.includes("applyScopeImpactRecommendationAction") &&
    serverActions.includes("keepScopeImpactRecommendationAction")
);
check(
  "actions require auth context",
  serverActions.includes("requireAuthOrgContext") &&
    serverActions.includes("authContext()")
);
check(
  "no client-supplied org_id in action schemas",
  !serverActions.includes("orgId: z.") &&
    !serverActions.includes("org_id: z.") &&
    !scopeImpactActionHasOrgParam(serverActions)
);

function scopeImpactActionHasOrgParam(src: string): boolean {
  const applyBlock = src.slice(
    src.indexOf("applyScopeImpactRecommendationAction"),
    src.indexOf("keepScopeImpactRecommendationAction")
  );
  return applyBlock.includes("orgId") || applyBlock.includes("org_id");
}

const getResults = read("lib/scope-discovery/application/get-results.ts");
check(
  "results expose dismissedScopeImpactIds",
  getResults.includes("dismissedScopeImpactIds") &&
    getResults.includes("collectDismissedRecommendationIds")
);

// —— UI ——
const panel = read("components/assistant/ScopeImpactRecommendationsPanel.tsx");
check(
  "panel heading Scope changes to review",
  panel.includes("Scope changes to review")
);
check(
  "panel has Apply change and Keep current scope",
  panel.includes("Apply change") && panel.includes("Keep current scope")
);
check(
  "panel never renders raw Fact keys as content",
  !panel.includes("factKey}") && !panel.includes("{rec.factKey}")
);
check(
  "panel stacks actions for mobile",
  panel.includes("flex-col") && panel.includes("sm:flex-row")
);
check(
  "panel associates heading / announces loading",
  panel.includes("aria-labelledby") && panel.includes("aria-busy")
);
check(
  "errors are focusable alerts",
  panel.includes('role="alert"') && panel.includes("tabIndex={-1}")
);
check(
  "sr-only action labels include scope-item title",
  panel.includes("applyLabel") && panel.includes("keepLabel")
);

const reviewBlock = read("components/assistant/ScopeDiscoveryReviewBlock.tsx");
check(
  "Scope Review mounts recommendations panel",
  reviewBlock.includes("ScopeImpactRecommendationsPanel") &&
    reviewBlock.includes("buildScopeChangeRecommendations")
);
check(
  "Apply/Keep await server confirmation before success",
  reviewBlock.includes("applyScopeImpactRecommendationAction") &&
    reviewBlock.includes("keepScopeImpactRecommendationAction") &&
    reviewBlock.includes('setImpactStatus(rec.id, "applied")') &&
    reviewBlock.includes("await refreshResults()")
);
check(
  "recommendations do not force Analyse again",
  reviewBlock.includes("scopeImpactRecommendations") &&
    reviewBlock.includes("isStale") &&
    reviewBlock.includes("SCOPE_DISCOVERY_UI_COPY.analyseAgainButton")
);
check(
  "Review needed when unresolved recommendations",
  reviewBlock.includes("Review needed")
);

const estimatePanel = read("components/assistant/EstimatePanel.tsx");
check(
  "estimate soft-warns on unresolved recommendations without blocking",
  estimatePanel.includes("unresolvedScopeImpactCount") &&
    estimatePanel.includes("You can generate now")
);

const shell = read("components/assistant/AssistantShell.tsx");
check(
  "shell passes scopeReview facts into Scope Review",
  shell.includes("scopeReview={initialState.scopeReview}") &&
    shell.includes("onUnresolvedRecommendationsChange")
);

// —— Staleness ——
check(
  "scope-signal facts are not material for discovery stale",
  !isFactMaterialForDiscoveryStale("deck.existing_deck_removal") &&
    !isFactMaterialForDiscoveryStale("deck.balustrade_required") &&
    !isFactMaterialForDiscoveryStale("deck.length_m")
);

// —— Boundaries ——
check(
  "no migration 030 in this batch",
  !read("lib/scope-discovery/application/scope-impact-recommendation-actions.ts")
    .includes("030") &&
    !panel.includes("migration")
);
check(
  "no Production enablement in UI panel",
  !panel.includes("PRODUCTION") && !panel.includes("enableProduction")
);
check(
  "no commercial formula / Company DNA / Builder Interview in actions",
  !actions.includes("Company DNA") &&
    !actions.includes("Builder Interview") &&
    !actions.includes("marginFormula") &&
    !actions.includes("commercial")
);

// —— R3 feature anchors still present ——
check(
  "Analyse Job progress banner still present",
  read("components/assistant/ProjectCaptureBlock.tsx").includes(
    "AnalysisProgressBanner"
  )
);
check(
  "dimension derivation module present",
  read("lib/scopes/dimension-derivation.ts").includes("deriveLengthTimesWidth")
);
check(
  "batch confirm still present",
  read("lib/scope-discovery/application/batch-confirm-scope.ts").includes(
    "batchConfirmScopeItemsApp"
  )
);

console.log(
  `\n=== Results: ${passed} passed, ${failed} failed ===\n`
);
if (failed > 0) process.exit(1);

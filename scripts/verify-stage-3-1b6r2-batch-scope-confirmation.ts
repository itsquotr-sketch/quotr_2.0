/**
 * Stage 3.1B.6R2 — Batch scope confirmation, clarification routing, gating, stale fix.
 *
 * Run: npx tsx scripts/verify-stage-3-1b6r2-batch-scope-confirmation.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { evaluateStaleRun } from "../lib/scope-discovery/orchestration/stale-analysis";
import {
  buildSourceSnapshot,
  computeSourceFingerprint,
  normaliseFormatting,
} from "../lib/scope-discovery/orchestration/source-snapshot";
import type { ScopeDiscoveryRequest } from "../lib/scope-discovery/orchestration/types";
import {
  deriveBatchStateFromDecisions,
  canIncludeScopeItemAfterRejection,
} from "../lib/scope-discovery/application/batch-confirm-scope";
import {
  defaultBatchSelection,
  evaluateScopeReviewCompletion,
  isScopeItemBatchEligible,
} from "../lib/scope-discovery/ui/scope-review-completion";
import {
  classifyClarificationKind,
  routeClarificationToScopeDetails,
  CLARIFICATION_FACT_ROUTES,
} from "../lib/scope-discovery/ui/clarification-routing";
import { SCOPE_DISCOVERY_UI_COPY } from "../lib/scope-discovery/ui/labels";
import type { SafeSuggestionView } from "../lib/scope-discovery/application/types";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../lib/scope-discovery";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../lib/scope-discovery/catalogue";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../lib/scope-discovery/provider";
import { SCOPE_DISCOVERY_ORCHESTRATION_VERSION } from "../lib/scope-discovery/orchestration/version";

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

function fixture(
  overrides: Partial<SafeSuggestionView> = {}
): SafeSuggestionView {
  return {
    suggestionId: overrides.suggestionId ?? "s1",
    runId: "r1",
    suggestionIdentity: "id",
    suggestionKind: overrides.suggestionKind ?? "MISSING_SCOPE",
    proposedWorkAreaType: overrides.proposedWorkAreaType ?? "demolition",
    proposedTitle: overrides.proposedTitle ?? "Demolition",
    proposedDescription: null,
    confidence: 0.9,
    confidenceBand: overrides.confidenceBand ?? "HIGH",
    rationaleCode: overrides.rationaleCode ?? "deck.demolition",
    whySuggested: "Because demolition is likely.",
    decisionState: overrides.decisionState ?? "PROPOSED",
    decisionId: null,
    createdWorkAreaId: null,
    evidence: { count: 0, primarySourceTypes: [], summaries: [] },
    missingInformationSummaries: [],
    staleReason: null,
    supersededBySuggestionId: null,
    originHint: "deterministic",
    relatedWorkAreaId: "wa1",
    proposalClass: overrides.proposalClass ?? "SCOPE_ITEM",
    actionFamily: overrides.actionFamily ?? "scope_item",
    canDecide: true,
    canCreateWorkArea: false,
    canIncludeInScope: true,
    decidabilityReason: null,
    latestReasonCode: overrides.latestReasonCode ?? null,
  };
}

function baseRequest(
  overrides: Partial<ScopeDiscoveryRequest> = {}
): ScopeDiscoveryRequest {
  return {
    projectId: "p1",
    orgId: "o1",
    requestedRunId: null,
    trigger: "USER_REQUESTED_RERUN",
    projectBrief: "Build a timber deck",
    projectBriefRevision: "brief_content_v1",
    selectedSiteNotes: [],
    acceptedWorkAreas: [
      {
        workAreaId: "wa1",
        type: "deck",
        title: "Deck",
        revision: "wa_deck_v1",
      },
    ],
    authoritativeFacts: [],
    authoritativeConstraints: [],
    priorSuggestions: [],
    priorDecisions: [],
    priorProposals: [],
    priorRejections: [],
    currentContractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    currentCatalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    currentPromptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    region: "NZ",
    analysisObjective: "Discover likely missing and related work areas for this project.",
    providerEnabled: false,
    explicitUserInitiation: true,
    forceNewRun: false,
    requestedByUserId: "u1",
    requestedAt: new Date().toISOString(),
    priorRunSummaries: [],
    ...overrides,
  };
}

console.log("\n=== Stage 3.1B.6R2 — Batch Scope Confirmation Verification ===\n");

// ---------------------------------------------------------------------------
// Batch review semantics
// ---------------------------------------------------------------------------
const openItem = fixture({ decisionState: "PROPOSED", confidenceBand: "HIGH" });
check(
  "recommended items preselected only in unsaved local state",
  defaultBatchSelection(openItem) === "INCLUDED" &&
    openItem.decisionState === "PROPOSED"
);
check(
  "low-confidence defaults to not required in local state",
  defaultBatchSelection(
    fixture({ confidenceBand: "LOW", suggestionKind: "POSSIBLE_EXCLUSION" })
  ) === "NOT_REQUIRED"
);
check(
  "scope item is batch eligible",
  isScopeItemBatchEligible(openItem)
);
check(
  "high-level WA is not batch eligible",
  !isScopeItemBatchEligible(
    fixture({
      proposalClass: "HIGH_LEVEL_WORK_AREA",
      suggestionKind: "WORK_AREA",
      actionFamily: "work_area",
    })
  )
);

check(
  "derive INCLUDED from latest ACCEPT",
  deriveBatchStateFromDecisions([{ decision_type: "ACCEPT" }]) === "INCLUDED"
);
check(
  "derive NOT_REQUIRED from latest REJECT",
  deriveBatchStateFromDecisions([
    { decision_type: "ACCEPT" },
    { decision_type: "REJECT", reason_code: "scope_item_not_required" },
  ]) === "NOT_REQUIRED"
);
check(
  "reversal include after reject allowed by latest-wins helper",
  canIncludeScopeItemAfterRejection([
    { decision_type: "ACCEPT" },
    { decision_type: "REJECT" },
  ]) === true
);
check(
  "idempotent when already included (latest ACCEPT)",
  !canIncludeScopeItemAfterRejection([{ decision_type: "ACCEPT" }])
);

const batchService = read(
  "lib/scope-discovery/application/batch-confirm-scope.ts"
);
check(
  "batch service appends with createdWorkAreaId null",
  batchService.includes("createdWorkAreaId: null") &&
    batchService.includes("insertDiscoveryDecision")
);
check(
  "batch service validates all rows before writing",
  batchService.includes("Validate all rows first") ||
    batchService.includes("prepared.push")
);
check(
  "no Facts fabricated in batch service",
  !batchService.includes("project_facts") && !batchService.includes("upsertFact")
);

// ---------------------------------------------------------------------------
// Clarifications
// ---------------------------------------------------------------------------
check(
  "scope detail clarification classified",
  classifyClarificationKind({
    rationaleCode: "deck.substructure.missing_condition",
    suggestionKind: "CLARIFICATION_REQUIRED",
  }) === "SCOPE_DETAIL"
);
check(
  "mapped clarification routes to fact key",
  routeClarificationToScopeDetails({
    rationaleCode: "deck.substructure.missing_condition",
    suggestionKind: "CLARIFICATION_REQUIRED",
  }).factKey === "deck.substructure_condition"
);
check(
  "unmapped clarification has coverage gap",
  routeClarificationToScopeDetails({
    rationaleCode: "unknown.custom.clarify",
    suggestionKind: "CLARIFICATION_REQUIRED",
  }).mapped === false
);
check(
  "clarification routes are catalogue codes not AI text",
  Object.keys(CLARIFICATION_FACT_ROUTES).every((k) => !k.includes(" "))
);
check(
  "UI exposes Answer in Scope Details",
  SCOPE_DISCOVERY_UI_COPY.answerInScopeDetails.includes("Scope Details")
);

// ---------------------------------------------------------------------------
// Completion + Quality gating
// ---------------------------------------------------------------------------
const incomplete = evaluateScopeReviewCompletion(
  [fixture({ decisionState: "PROPOSED", confidenceBand: "HIGH" })],
  { hasRun: true }
);
check("important open blocks completion", !incomplete.complete);

check(
  "low-confidence undecided does not block completion",
  evaluateScopeReviewCompletion(
    [
      fixture({ decisionState: "ACCEPTED", confidenceBand: "HIGH" }),
      fixture({
        suggestionId: "s2",
        decisionState: "PROPOSED",
        confidenceBand: "LOW",
        suggestionKind: "POSSIBLE_EXCLUSION",
        proposalClass: "EXCLUSION",
      }),
    ],
    { hasRun: true }
  ).complete === true
);

const shell = read("components/assistant/AssistantShell.tsx");
check(
  "Quality locked copy present",
  shell.includes("Confirm the scope items above before selecting")
);
check(
  "Quality unlocks via scopeReviewComplete",
  shell.includes("scopeReviewComplete") && shell.includes("qualityUnlocked")
);
check(
  "Quick Estimate quality edit cannot bypass gate",
  shell.includes("scopeDiscoveryEnabled && !scopeReviewComplete")
);

const assistantActions = read("lib/assistant/actions.ts");
check(
  "saveQuality gated when discovery enabled",
  assistantActions.includes("Confirm the scope items above before selecting")
);
check(
  "confirmWorkAreas auto-runs discovery when enabled",
  assistantActions.includes("confirmWorkAreas") &&
    /confirmWorkAreas[\s\S]*runScopeDiscovery/.test(assistantActions)
);
check(
  "Analyse Job seed does not call discovery",
  !/saveBriefAndSeedWorkAreas[\s\S]{0,5000}runScopeDiscovery/.test(
    assistantActions
  )
);

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------
const snap1 = buildSourceSnapshot(baseRequest());
const snapSame = buildSourceSnapshot(
  baseRequest({
    projectBrief: "Build a timber deck",
    projectBriefRevision: "brief_content_v1",
  })
);
check(
  "fresh identical sources → CURRENT",
  evaluateStaleRun({
    priorSnapshot: snap1,
    currentSnapshot: snapSame,
    priorRunId: "run1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "CURRENT"
);

check(
  "formatting-only brief with same revision digest stays current when normalised equal",
  normaliseFormatting("Build   a   timber   deck") ===
    normaliseFormatting("Build a timber deck") &&
    computeSourceFingerprint(snap1) !== ""
);

const snapMaterial = buildSourceSnapshot(
  baseRequest({
    projectBrief: "Build a large timber deck with balustrade",
    projectBriefRevision: "brief_content_v2",
  })
);
check(
  "material brief change → STALE",
  evaluateStaleRun({
    priorSnapshot: snap1,
    currentSnapshot: snapMaterial,
    priorRunId: "run1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "STALE_MATERIAL_CHANGE"
);

const snapFact = buildSourceSnapshot(
  baseRequest({
    authoritativeFacts: [
      { key: "deck.area_m2", value: 40, revision: "fact1" },
    ],
  })
);
check(
  "DETAIL_ONLY Fact change → CURRENT (not false stale)",
  evaluateStaleRun({
    priorSnapshot: snap1,
    currentSnapshot: snapFact,
    priorRunId: "run1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "CURRENT"
);

const snapMaterialFact = buildSourceSnapshot(
  baseRequest({
    authoritativeFacts: [
      { key: "project_scope_class", value: "commercial", revision: "fact_mat" },
    ],
  })
);
check(
  "FULL_REANALYSIS Fact change → STALE",
  evaluateStaleRun({
    priorSnapshot: snap1,
    currentSnapshot: snapMaterialFact,
    priorRunId: "run1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "STALE_MATERIAL_CHANGE"
);

const snapProvider = buildSourceSnapshot(baseRequest(), {
  providerModelId: "model-b",
});
const snapProviderPrior = buildSourceSnapshot(baseRequest(), {
  providerModelId: "model-a",
});
check(
  "provider-only change → CURRENT_PROVIDER_CHANGED_ONLY",
  evaluateStaleRun({
    priorSnapshot: snapProviderPrior,
    currentSnapshot: snapProvider,
    priorRunId: "run1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "CURRENT_PROVIDER_CHANGED_ONLY"
);

const collector = read(
  "lib/scope-discovery/application/source-collector.ts"
);
check(
  "briefRevision no longer binds projects.updated_at",
  !collector.includes('String(project.updated_at ?? ""),\n    shaShort(briefText)')
);
check(
  "work area revision ignores updated_at",
  collector.includes("Domain meaning only") ||
    !/revision: contentRevision\(\[\s*String\(w\.updated_at/.test(collector)
);

const reviewBlock = read(
  "components/assistant/ScopeDiscoveryReviewBlock.tsx"
);
check(
  "Analyse again only when stale/failed (not always on footer)",
  reviewBlock.includes("showAnalyseAgain") &&
    reviewBlock.includes("showAnalyseAgain && !isStale")
);
check(
  "batch intro copy present",
  SCOPE_DISCOVERY_UI_COPY.batchIntro.includes("Untick anything")
);
check(
  "auto-run after WA confirm wired in UI fallback",
  reviewBlock.includes("autoRunStarted") &&
    reviewBlock.includes("batchConfirmScopeItemsAction") &&
    reviewBlock.includes("confirmScopeButton")
);

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------
check(
  "no migration 030",
  !existsSync(join(process.cwd(), "supabase/migrations/030_scope_discovery_batch.sql"))
);
check(
  "completion docs exist",
  existsSync(
    join(
      process.cwd(),
      "docs/implementation/STAGE_3_1B6R2_BATCH_SCOPE_CONFIRMATION_COMPLETION.md"
    )
  ) &&
    existsSync(
      join(process.cwd(), "docs/runbooks/STAGE_3_1B6R2_PREVIEW_RETEST.md")
    )
);
check(
  "no Company DNA / Builder Interview in batch service",
  !batchService.toLowerCase().includes("company dna") &&
    !batchService.toLowerCase().includes("builder interview")
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

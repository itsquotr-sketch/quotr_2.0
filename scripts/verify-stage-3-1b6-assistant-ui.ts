/**
 * Stage 3.1B.6 — Assistant UI verification (local / static + pure helpers).
 *
 * Full browser Preview smoke is documented in:
 *   docs/runbooks/STAGE_3_1B6_SCOPE_DISCOVERY_PREVIEW_SMOKE_TEST.md
 *
 * Run: npx tsx scripts/verify-stage-3-1b6-assistant-ui.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  analysisProgressLabel,
  allSuggestionsDecided,
  assignUiGroup,
  confidenceBandLabel,
  detectProviderPartialFailure,
  DISMISS_REASON_OPTIONS,
  formatEvidenceSummaries,
  formatEvidenceSummary,
  groupSuggestionsForUi,
  SCOPE_DISCOVERY_UI_COPY,
  suggestionKindLabel,
  summariseGroupCounts,
  whySuggestedText,
} from "../lib/scope-discovery/ui";
import type { SafeSuggestionView } from "../lib/scope-discovery/application/types";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration";
import { summariseEvidence } from "../lib/scope-discovery/application/result-mappers";

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

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walkFiles(full, out);
    } else if (/\.(ts|tsx|md|sql)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function fixtureSuggestion(
  overrides: Partial<SafeSuggestionView>
): SafeSuggestionView {
  return {
    suggestionId: overrides.suggestionId ?? "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-0000000000aa",
    suggestionIdentity: "deck|missing|substructure",
    suggestionKind: overrides.suggestionKind ?? "MISSING_SCOPE",
    proposedWorkAreaType: overrides.proposedWorkAreaType ?? "demolition",
    proposedTitle: overrides.proposedTitle ?? "Demolition",
    proposedDescription: overrides.proposedDescription ?? "Strip existing deck",
    confidence: overrides.confidence ?? 0.82,
    confidenceBand: overrides.confidenceBand ?? "HIGH",
    rationaleCode: overrides.rationaleCode ?? "deck.demolition",
    whySuggested:
      overrides.whySuggested ??
      whySuggestedText({
        rationaleCode: overrides.rationaleCode ?? "deck.demolition",
        suggestionKind: overrides.suggestionKind ?? "MISSING_SCOPE",
      }),
    decisionState: overrides.decisionState ?? "PROPOSED",
    decisionId: overrides.decisionId ?? null,
    createdWorkAreaId: overrides.createdWorkAreaId ?? null,
    evidence: overrides.evidence ?? {
      count: 1,
      primarySourceTypes: ["EXISTING_WORK_AREA"],
      summaries: ["A Deck work area is already confirmed."],
    },
    missingInformationSummaries: overrides.missingInformationSummaries ?? [],
    staleReason: overrides.staleReason ?? null,
    supersededBySuggestionId: overrides.supersededBySuggestionId ?? null,
    originHint: overrides.originHint ?? "deterministic",
    relatedWorkAreaId: overrides.relatedWorkAreaId ?? "wa-deck",
    proposalClass: overrides.proposalClass ?? "SCOPE_ITEM",
    actionFamily: overrides.actionFamily ?? "scope_item",
    canDecide: overrides.canDecide ?? true,
    canCreateWorkArea: overrides.canCreateWorkArea ?? false,
    canIncludeInScope: overrides.canIncludeInScope ?? true,
    decidabilityReason: overrides.decidabilityReason ?? null,
    latestReasonCode: overrides.latestReasonCode ?? null,
  };
}

console.log("\n=== Stage 3.1B.6 — Assistant UI verification ===\n");

// ---------------------------------------------------------------------------
// Feature disabled behaviour / wiring
// ---------------------------------------------------------------------------
check(
  "feature flag defaults disabled without exact true",
  isScopeDiscoveryEnabled({}) === false
);
check(
  "feature flag enables only on exact true",
  isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "true" }) === true
);
check(
  "feature flag rejects TRUE / 1",
  isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "TRUE" }) === false &&
    isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "1" }) === false
);

const shell = read("components/assistant/AssistantShell.tsx");
const projectPage = read("app/(protected)/app/projects/[projectId]/page.tsx");
const capture = read("components/assistant/ProjectCaptureBlock.tsx");

check(
  "AssistantShell accepts scopeDiscoveryEnabled prop",
  shell.includes("scopeDiscoveryEnabled")
);
check(
  "Scope Review mounts only when flag + workAreasConfirmed",
  shell.includes("scopeDiscoveryEnabled && workAreasConfirmed") &&
    shell.includes("ScopeDiscoveryReviewBlock")
);
check(
  "project page passes server-authoritative flag",
  projectPage.includes("isScopeDiscoveryEnabled") &&
    projectPage.includes("scopeDiscoveryEnabled={scopeDiscoveryEnabled}")
);
check(
  "no NEXT_PUBLIC_SCOPE_DISCOVERY_ENABLED",
  !projectPage.includes("NEXT_PUBLIC_SCOPE_DISCOVERY") &&
    !shell.includes("NEXT_PUBLIC_SCOPE_DISCOVERY")
);
check(
  "Analyse Job / Project Capture still present",
  capture.includes("Analyse job") || capture.toLowerCase().includes("analyse job")
);
check(
  "AssistantShell still calls saveBriefAndSeedWorkAreas path",
  shell.includes("saveBriefAndSeedWorkAreas")
);

// ---------------------------------------------------------------------------
// Empty / copy / progress
// ---------------------------------------------------------------------------
check(
  "empty purpose / batch intro explain confirm flow",
  SCOPE_DISCOVERY_UI_COPY.batchIntro.toLowerCase().includes("untick") &&
    SCOPE_DISCOVERY_UI_COPY.emptyPurpose.toLowerCase().includes("work areas")
);
check(
  "analyse button label is Analyse scope",
  SCOPE_DISCOVERY_UI_COPY.analyseButton === "Analyse scope"
);
check(
  "progress steps rotate without percentages",
  analysisProgressLabel(0) === "Preparing project information" &&
    analysisProgressLabel(3000) === "Reviewing related scope" &&
    analysisProgressLabel(7000) === "Checking for missing items" &&
    analysisProgressLabel(15000) === "Finalising suggestions" &&
    !analysisProgressLabel(15000).includes("%")
);

// ---------------------------------------------------------------------------
// Evidence / confidence / grouping
// ---------------------------------------------------------------------------
check(
  "confidence bands are human labels",
  confidenceBandLabel("HIGH") === "High confidence" &&
    confidenceBandLabel("MEDIUM") === "Medium confidence" &&
    confidenceBandLabel("LOW") === "Low confidence"
);
check(
  "suggestion kinds avoid raw underscores in labels",
  !suggestionKindLabel("MISSING_SCOPE").includes("_") &&
    !suggestionKindLabel("CLARIFICATION_REQUIRED").includes("_")
);

const briefEvidence = formatEvidenceSummary({
  sourceType: "PROJECT_BRIEF_TEXT",
  sourceId: "project",
  excerptOrValue: "existing deck will be replaced",
});
check(
  "brief evidence is human-readable",
  Boolean(briefEvidence?.includes("brief")) &&
    Boolean(briefEvidence?.includes("existing deck will be replaced"))
);

const waEvidence = formatEvidenceSummary({
  sourceType: "EXISTING_WORK_AREA",
  sourceId: "wa-1",
  excerptOrValue: "deck",
});
check(
  "work-area evidence summarises confirmation",
  Boolean(waEvidence?.toLowerCase().includes("deck")) &&
    Boolean(waEvidence?.toLowerCase().includes("confirmed"))
);

const summaries = formatEvidenceSummaries([
  {
    sourceType: "CONSTRAINT",
    sourceId: "site.access",
    excerptOrValue: "restricted",
  },
  { sourceType: "UNKNOWN_TYPE", sourceId: "x", excerptOrValue: "y" },
]);
check(
  "unknown evidence types are not fabricated",
  summaries.length === 1 && summaries[0].toLowerCase().includes("access")
);

const safeEvidence = summariseEvidence([
  {
    sourceType: "PROJECT_BRIEF_TEXT",
    sourceId: "project",
    excerptOrValue: "replace deck",
  },
]);
check(
  "safe evidence summaries attached to DTO mapper",
  safeEvidence.summaries.length === 1 && safeEvidence.count === 1
);

const high = fixtureSuggestion({
  suggestionId: "a",
  confidenceBand: "HIGH",
  suggestionKind: "MISSING_SCOPE",
});
const medium = fixtureSuggestion({
  suggestionId: "b",
  confidenceBand: "MEDIUM",
  suggestionKind: "WORK_AREA",
  originHint: "ai",
});
const low = fixtureSuggestion({
  suggestionId: "c",
  confidenceBand: "LOW",
  suggestionKind: "WORK_AREA",
  originHint: "ai",
});
const conflict = fixtureSuggestion({
  suggestionId: "d",
  suggestionKind: "CONFLICT_WARNING",
  confidenceBand: "HIGH",
});
const dismissed = fixtureSuggestion({
  suggestionId: "e",
  decisionState: "REJECTED",
});
const added = fixtureSuggestion({
  suggestionId: "f",
  decisionState: "ACCEPTED",
  createdWorkAreaId: "wa-added",
});

check("HIGH missing scope → important", assignUiGroup(high) === "important");
check("MEDIUM → worth checking", assignUiGroup(medium) === "worthChecking");
check("LOW → other possibilities", assignUiGroup(low) === "other");
check("conflict kind → conflicts", assignUiGroup(conflict) === "conflicts");

const clarification = fixtureSuggestion({
  suggestionId: "clar",
  suggestionKind: "CLARIFICATION_REQUIRED",
  confidenceBand: "HIGH",
  proposalClass: "CLARIFICATION",
  actionFamily: "clarification",
});
check(
  "clarification → clarifications group",
  assignUiGroup(clarification) === "clarifications"
);

const grouped = groupSuggestionsForUi([
  high,
  medium,
  low,
  conflict,
  dismissed,
  added,
]);
const counts = summariseGroupCounts(grouped);
check(
  "grouping separates open / dismissed / added",
  counts.important === 1 &&
    counts.worthChecking === 1 &&
    counts.other === 1 &&
    counts.conflicts === 1 &&
    counts.dismissed === 1 &&
    counts.added === 1
);
check(
  "suppressed not shown as open recommendations (none in fixture)",
  counts.openTotal === 4
);
check(
  "all decided detection",
  allSuggestionsDecided([dismissed, added]) === true &&
    allSuggestionsDecided([high, dismissed]) === false
);

check(
  "whySuggested avoids raw underscore codes as primary copy",
  !whySuggestedText({
    rationaleCode: "deck.demolition",
    suggestionKind: "MISSING_SCOPE",
  }).includes("deck.demolition")
);

check(
  "provider partial failure detection",
  detectProviderPartialFailure(
    ["Contextual scope discovery failed."],
    "COMPLETED_WITH_WARNINGS"
  ) === true &&
    detectProviderPartialFailure([], "COMPLETED") === false
);

check(
  "dismiss reasons cover product list",
  DISMISS_REASON_OPTIONS.some((r) => r.label === "Already covered") &&
    DISMISS_REASON_OPTIONS.some((r) => r.label === "Not part of this job") &&
    DISMISS_REASON_OPTIONS.some((r) => r.label === "Other")
);

// ---------------------------------------------------------------------------
// Component contracts
// ---------------------------------------------------------------------------
const reviewBlock = read("components/assistant/ScopeDiscoveryReviewBlock.tsx");
const suggestionCard = read(
  "components/assistant/ScopeDiscoverySuggestionCard.tsx"
);
const editDialog = read("components/assistant/ScopeDiscoveryEditDialog.tsx");
const dismissDialog = read(
  "components/assistant/ScopeDiscoveryDismissDialog.tsx"
);

check(
  "review block uses runScopeDiscoveryAction explicitly",
  reviewBlock.includes("runScopeDiscoveryAction")
);
check(
  "review block auto-runs once when no run exists after WA confirm",
  reviewBlock.includes("autoRunStarted") &&
    reviewBlock.includes("void handleAnalyse(false)")
);
check(
  "review block uses batch confirm for scope items",
  reviewBlock.includes("batchConfirmScopeItemsAction") &&
    reviewBlock.includes("confirmScopeButton")
);
check(
  "review block refreshes via getScopeDiscoveryResultsAction after actions",
  reviewBlock.includes("getScopeDiscoveryResultsAction")
);
check(
  "review block accepts server initialResults",
  reviewBlock.includes("initialResults")
);
check(
  "duplicate analyse prevented via analysingLock",
  reviewBlock.includes("analysingLock")
);
check(
  "accessible progress announced",
  reviewBlock.includes('aria-live="polite"') &&
    reviewBlock.includes('role="status"')
);
check(
  "stale notice + Analyse again present",
  reviewBlock.includes("staleNotice") &&
    reviewBlock.includes("analyseAgainButton")
);
check(
  "provider partial failure copy present",
  reviewBlock.includes("providerPartialFailure")
);
check(
  "suggestion card maps Accept/Modify/Reject to user labels",
  suggestionCard.includes("Add work area") ||
    suggestionCard.includes("SCOPE_DISCOVERY_UI_COPY.addWorkArea")
);
check(
  "edit dialog only title/type/description",
  editDialog.includes("modifiedTitle") &&
    editDialog.includes("modifiedWorkAreaType") &&
    editDialog.includes("modifiedDescription") &&
    !editDialog.toLowerCase().includes("margin") &&
    !editDialog.toLowerCase().includes("quantity") &&
    !editDialog.toLowerCase().includes("rate")
);
check(
  "edit dialog uses SCOPE_CATALOGUE only",
  editDialog.includes("SCOPE_CATALOGUE")
);
check(
  "dismiss dialog has reason options",
  dismissDialog.includes("DISMISS_REASON_OPTIONS")
);
check(
  "collapsible groups in review block",
  reviewBlock.includes("SuggestionGroup") &&
    reviewBlock.includes("aria-expanded")
);
check(
  "no raw Anthropic / API key exposure in UI components",
  !reviewBlock.includes("Anthropic") &&
    !suggestionCard.includes("Anthropic") &&
    !reviewBlock.includes("ANTHROPIC") &&
    !suggestionCard.includes("token")
);
check(
  "decision actions use accept/reject/modify server actions",
  reviewBlock.includes("acceptScopeSuggestionAction") &&
    reviewBlock.includes("rejectScopeSuggestionAction") &&
    reviewBlock.includes("modifyScopeSuggestionAction")
);
check(
  "latest-write guard prevents stale overwrite",
  reviewBlock.includes("createLatestWriteGuard")
);

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------
const migrationFiles = walkFiles(join(process.cwd(), "supabase/migrations"));
const newMigrations = migrationFiles.filter((f) =>
  /03[0-9]_/.test(f.replace(/\\/g, "/"))
);
check(
  "no new migration added in 3.1B.6 batch (030+)",
  newMigrations.length === 0,
  newMigrations.join(", ")
);

const commercialTouched =
  shell.includes("COMMERCIAL_ENGINE") ||
  reviewBlock.includes("calculateEstimate") ||
  reviewBlock.includes("marginPercent");
check("no commercial formula wiring in discovery UI", !commercialTouched);

check(
  "no Company DNA / Builder Interview in discovery UI",
  !reviewBlock.toLowerCase().includes("company dna") &&
    !reviewBlock.toLowerCase().includes("builder interview")
);

const assistantActionsSrc = read("lib/assistant/actions.ts");
const analyseJobUnchanged =
  assistantActionsSrc.includes("saveBriefAndSeedWorkAreas") &&
  !/saveBriefAndSeedWorkAreas[\s\S]{0,5000}runScopeDiscovery/.test(
    assistantActionsSrc
  );
check(
  "Analyse Job action module not replaced by discovery",
  analyseJobUnchanged
);

check(
  "completion / runbook docs exist",
  (() => {
    try {
      read("docs/implementation/STAGE_3_1B6_ASSISTANT_UI_COMPLETION.md");
      read("docs/runbooks/STAGE_3_1B6_SCOPE_DISCOVERY_PREVIEW_SMOKE_TEST.md");
      return true;
    } catch {
      return false;
    }
  })()
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

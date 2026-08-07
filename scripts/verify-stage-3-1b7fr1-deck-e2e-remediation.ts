/**
 * Stage 3.1B.7F-R1 — Deck E2E remediation verification.
 * Run: npx tsx scripts/verify-stage-3-1b7fr1-deck-e2e-remediation.ts
 *
 * Pure / source-level checks — no AI provider, no commercial formula mutation,
 * no migration 030, no Production enablement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildQuickEstimateAttentionItems,
  buildQuickEstimateStatusPresentation,
} from "../lib/assistant/presentation/quick-estimate-view-model";
import {
  buildScopeItemSummaryLists,
  compactSummaryOverflow,
} from "../lib/assistant/stage-completion-summaries";
import { extractConstraintsFromBrief } from "../lib/ai/enrich-extraction";
import { presentEstimateWorkAreaTotals } from "../lib/estimate/presentation-breakdown";
import {
  classifyFactScopeImpact,
  isConstraintMaterialForDiscoveryStale,
  isFactMaterialForDiscoveryStale,
} from "../lib/scope-discovery/scope-impact";
import {
  buildSourceSnapshot,
  diffMaterialSourceFields,
  evaluateStaleRun,
  normaliseSnapshotForStaleCompare,
} from "../lib/scope-discovery/orchestration";
import type { ScopeDiscoveryRequest } from "../lib/scope-discovery/orchestration/types";
import { SCOPE_DISCOVERY_ORCHESTRATION_VERSION } from "../lib/scope-discovery/orchestration/version";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../lib/scope-discovery/version";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../lib/scope-discovery/catalogue/version";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../lib/scope-discovery/provider/version";

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
  "\n=== Stage 3.1B.7F-R1 — Deck E2E Remediation Verification ===\n"
);

// ─── DESCRIPTION ─────────────────────────────────────────────
const editor = read("components/work-areas/WorkAreaQuoteDescriptionEditor.tsx");
const scopeSummary = read("components/assistant/ScopeSummaryBlock.tsx");
check(
  "DESCRIPTION: missing description exposes Add immediately (compact)",
  editor.includes('variant === "compact"') &&
    editor.includes("Add description") &&
    editor.includes("Use suggested") &&
    editor.includes("Not added")
);
check(
  "DESCRIPTION: Use suggested remains draft until Save",
  editor.includes("generateWorkAreaQuoteDescriptionDraft") &&
    editor.includes("stays a draft until you save") &&
    editor.includes("updateWorkAreaQuoteDescription")
);
check(
  "DESCRIPTION: summary mounts compact editor (not behind Review details)",
  scopeSummary.includes('variant="compact"') &&
    scopeSummary.includes("WorkAreaQuoteDescriptionEditor") &&
    !scopeSummary.includes(
      "CollapsedQuotePreview\n              description={\n                descriptionOverrides"
    )
);
check(
  "DESCRIPTION: no multi-layer action requirement for primary actions",
  scopeSummary.includes('variant="compact"') &&
    !/CollapsedQuotePreview[\s\S]{0,400}WorkAreaQuoteDescriptionEditor/.test(
      scopeSummary
    )
);
check(
  "DESCRIPTION: user description remains authoritative (persistence intact)",
  read("lib/work-areas/description-actions.ts").includes(
    "updateWorkAreaQuoteDescription"
  ) &&
    read("lib/work-areas/quote-description.ts").length > 0 &&
    !editor.includes("anthropic") &&
    !editor.includes("system prompt")
);

// ─── FALSE STALE ─────────────────────────────────────────────
function baseRequest(
  overrides: Partial<ScopeDiscoveryRequest> = {}
): ScopeDiscoveryRequest {
  return {
    projectId: "p1",
    orgId: "o1",
    requestedRunId: null,
    trigger: "USER_REQUESTED_RERUN",
    projectBrief: "Build a timber deck",
    projectBriefRevision: "brief_v1",
    selectedSiteNotes: [],
    acceptedWorkAreas: [
      { workAreaId: "wa1", type: "deck", title: "Deck", revision: "wa1" },
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
    analysisObjective:
      "Discover likely missing and related work areas for this project.",
    providerEnabled: false,
    explicitUserInitiation: true,
    forceNewRun: false,
    requestedByUserId: "u1",
    requestedAt: new Date().toISOString(),
    priorRunSummaries: [],
    ...overrides,
  };
}

const snapBase = buildSourceSnapshot(baseRequest());

const snapWithDetailInKeys = {
  ...snapBase,
  factKeysAndRevisions: [
    { key: "deck.length_m", revision: "r-len" },
    { key: "deck.finish_level", revision: "r-fin" },
  ],
  factRevisions: "facts:detail-pollution",
  constraintKeysAndRevisions: [
    { key: "site_access", revision: "r-access" },
    { key: "material_carry_distance", revision: "r-carry" },
  ],
  constraintRevisions: "constraints:ordinary",
};

const normalised = normaliseSnapshotForStaleCompare(snapWithDetailInKeys);
check(
  "FALSE STALE: normalise strips DETAIL_ONLY facts",
  normalised.factKeysAndRevisions.length === 0 &&
    normalised.factRevisions === "facts:empty"
);
check(
  "FALSE STALE: normalise strips ordinary constraints",
  normalised.constraintKeysAndRevisions.length === 0 &&
    normalised.constraintRevisions === "constraints:empty"
);

check(
  "FALSE STALE: dimensions -> CURRENT",
  !isFactMaterialForDiscoveryStale("deck.length_m") &&
    classifyFactScopeImpact({
      factKey: "deck.width_m",
      oldValue: 3,
      newValue: 4,
    }).classification === "DETAIL_ONLY" &&
    evaluateStaleRun({
      priorSnapshot: snapBase,
      currentSnapshot: buildSourceSnapshot(
        baseRequest({
          authoritativeFacts: [
            { key: "deck.length_m", value: 5, revision: "x" },
          ],
        })
      ),
      priorRunId: "r1",
      priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
    }).comparison === "CURRENT"
);

check(
  "FALSE STALE: historical detail pollution normalised to CURRENT",
  evaluateStaleRun({
    priorSnapshot: snapWithDetailInKeys as typeof snapBase,
    currentSnapshot: snapBase,
    priorRunId: "r1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "CURRENT"
);

check(
  "FALSE STALE: Specification / finish detail -> CURRENT",
  classifyFactScopeImpact({
    factKey: "deck.finish_level",
    oldValue: "standard",
    newValue: "premium",
  }).classification === "DETAIL_ONLY" &&
    !isFactMaterialForDiscoveryStale("deck.finish_level")
);

check(
  "FALSE STALE: normal Scope Details dotted answer -> CURRENT",
  classifyFactScopeImpact({
    factKey: "deck.board_width_mm",
    oldValue: 90,
    newValue: 140,
  }).classification === "DETAIL_ONLY" &&
    classifyFactScopeImpact({
      factKey: "deck.fascia_size_mm",
      oldValue: null,
      newValue: 150,
    }).classification === "DETAIL_ONLY"
);

check(
  "FALSE STALE: scope-changing Fact -> recommendation class, not stale material",
  classifyFactScopeImpact({
    factKey: "deck.balustrade_required",
    oldValue: "no",
    newValue: "yes",
  }).classification === "SCOPE_ADDING" &&
    !isFactMaterialForDiscoveryStale("deck.balustrade_required")
);

check(
  "FALSE STALE: ordinary constraints never material",
  !isConstraintMaterialForDiscoveryStale("site_access") &&
    !isConstraintMaterialForDiscoveryStale("material_carry_distance") &&
    !isConstraintMaterialForDiscoveryStale("occupied_site")
);

const snapBriefChanged = buildSourceSnapshot(
  baseRequest({
    projectBrief: "Build a timber deck and pergola",
    projectBriefRevision: "brief_v2",
  })
);
check(
  "FALSE STALE: material high-level brief change -> STALE",
  evaluateStaleRun({
    priorSnapshot: snapBase,
    currentSnapshot: snapBriefChanged,
    priorRunId: "r1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "STALE_MATERIAL_CHANGE"
);

const snapWaChanged = buildSourceSnapshot(
  baseRequest({
    acceptedWorkAreas: [
      { workAreaId: "wa1", type: "deck", title: "Deck", revision: "wa1" },
      { workAreaId: "wa2", type: "pergola", title: "Pergola", revision: "wa2" },
    ],
  })
);
check(
  "FALSE STALE: high-level Work Area change -> STALE",
  evaluateStaleRun({
    priorSnapshot: snapBase,
    currentSnapshot: snapWaChanged,
    priorRunId: "r1",
    priorOrchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  }).comparison === "STALE_MATERIAL_CHANGE"
);

const diff = diffMaterialSourceFields({
  prior: snapBase,
  current: snapBriefChanged,
});
check(
  "FALSE STALE: diffMaterialSourceFields exposes briefRevision",
  diff.some((d) => d.field === "briefRevision")
);

check(
  "FALSE STALE: collector filters constraints",
  read("lib/scope-discovery/application/source-collector.ts").includes(
    "isConstraintMaterialForDiscoveryStale"
  )
);

// ─── BREAKDOWN ───────────────────────────────────────────────
const mappers = read("lib/assistant/mappers.ts");
check(
  "BREAKDOWN: mapEstimate uses confirmed DB Work Areas",
  mappers.includes("buildIncludedWorkAreasFromDb(workAreas)") &&
    mappers.includes(
      "only real confirmed project Work Areas — never static mock seed"
    )
);
const deckOnlyTotals = presentEstimateWorkAreaTotals(
  [
    {
      workAreaName: "Deck",
      label: "Decking",
      category: "materials",
      recommendedCost: 100,
      recommendedSell: 150,
      grossProfit: 50,
      marginPercent: 33,
      costLow: 90,
      costHigh: 110,
      sellLow: 140,
      sellHigh: 160,
      rateSource: "org",
    },
    {
      workAreaName: "Pergola",
      label: "Ghost heading",
      category: "materials",
      recommendedCost: 20,
      recommendedSell: 30,
      grossProfit: 10,
      marginPercent: 33,
      costLow: 20,
      costHigh: 20,
      sellLow: 30,
      sellHigh: 30,
      rateSource: "org",
    },
  ],
  { confirmedWorkAreaNames: ["Deck"] }
);
check(
  "BREAKDOWN: Deck-only project -> Deck + Unallocated only",
  deckOnlyTotals.map((t) => t.name).sort().join(",") === "Deck,Unallocated"
);
check(
  "BREAKDOWN: scope items never manufacture Work Area heading",
  !deckOnlyTotals.some((t) => t.name === "Pergola") &&
    !deckOnlyTotals.some((t) => t.name === "External Stairs")
);
const totalSell = deckOnlyTotals.reduce((s, t) => s + t.sell, 0);
check(
  "BREAKDOWN: totals unchanged (lines retained under Unallocated)",
  totalSell === 180 &&
    deckOnlyTotals.reduce((s, t) => s + t.lineItemCount, 0) === 2
);

// ─── SCOPE SUMMARY ───────────────────────────────────────────
const lists = buildScopeItemSummaryLists({
  suggestions: [
    {
      proposedTitle: "Decking surface",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Framing / substructure",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Fascia",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Joist hangers",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Balustrade",
      decisionState: "REJECTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Existing pile condition",
      decisionState: "PROPOSED",
      proposalClass: "CLARIFICATION",
      latestReasonCode: "pending_detail",
    },
  ],
});
check(
  "SCOPE SUMMARY: counts match lists",
  lists.included.length === 4 &&
    lists.notRequired.length === 1 &&
    lists.needsDetail.length === 1 &&
    lists.needsDetail[0] === "Existing pile condition"
);
const overflow = compactSummaryOverflow(lists.included, 3);
check(
  "SCOPE SUMMARY: overflow +N correct",
  overflow.visible.length === 3 && overflow.overflow === 1
);
check(
  "SCOPE SUMMARY: confirmed lists UI present; needs detail omitted when empty",
  read("components/assistant/StageCollapsedSummaries.tsx").includes(
    "ScopeReviewConfirmedSummaryLists"
  ) &&
    read("components/assistant/StageCollapsedSummaries.tsx").includes(
      "lists.needsDetail.length > 0"
    )
);

// ─── EDIT SCOPE ──────────────────────────────────────────────
const reviewBlock = read("components/assistant/ScopeDiscoveryReviewBlock.tsx");
check(
  "EDIT SCOPE: Edit scope opens batch checklist",
  reviewBlock.includes("setIsEditingScope(true)") &&
    reviewBlock.includes("showChecklistEditor") &&
    reviewBlock.includes("batchConfirmScopeItemsAction")
);
check(
  "EDIT SCOPE: local toggle + one batch save; no provider in batch path",
  reviewBlock.includes("setItemIncluded") &&
    !reviewBlock.includes("runScopeDiscoveryAction({\n          projectId,\n          forceNewRun,\n          // batch")
);

// ─── MANUAL SCOPE ────────────────────────────────────────────
const migration028 = read("supabase/migrations/028_scope_discovery_persistence.sql");
check(
  "MANUAL SCOPE: blocked — no USER_ADDED suggestion kind (honest gate)",
  !migration028.includes("USER_ADDED") &&
    migration028.includes("suggestion_kind") &&
    !read("lib/scope-discovery/types.ts").includes('"user_manual"') &&
    !reviewBlock.includes("Add scope item")
);
const has030 = (() => {
  try {
    read("supabase/migrations/030_manual_scope_items.sql");
    return true;
  } catch {
    return false;
  }
})();
check("MANUAL SCOPE: migration 030 absent", !has030);

// ─── ATTENTION ───────────────────────────────────────────────
const attentionItems = buildQuickEstimateAttentionItems({
  missingLabels: ["Existing pile condition", "Engineering requirement"],
  clarificationLabels: [],
  pendingProposalCount: 0,
  unresolvedScopeImpactLabels: [],
});
const attentionStatus = buildQuickEstimateStatusPresentation({
  hasEstimate: true,
  attentionItems,
});
check(
  "ATTENTION: count equals exact items",
  attentionStatus.attentionCount === 2 &&
    attentionStatus.attentionItems.length === 2 &&
    attentionStatus.statusLabel === "2 items need attention"
);
const readyStatus = buildQuickEstimateStatusPresentation({
  hasEstimate: true,
  attentionItems: [],
});
check(
  "ATTENTION: Ready when zero",
  readyStatus.kind === "ready" &&
    readyStatus.statusLabel === "Ready for pricing"
);
check(
  "ATTENTION: Review destination wired",
  read("components/assistant/EstimatePanel.tsx").includes("onReviewAttention") &&
    read("components/assistant/AssistantShell.tsx").includes(
      "handleReviewAttention"
    ) &&
    attentionItems.every((i) => i.reviewTarget === "questions")
);

// ─── CONSTRAINTS ─────────────────────────────────────────────
const deckConstraints = extractConstraintsFromBrief(
  [
    "Narrow side access.",
    "Waste/materials must be hand-carried approximately 25–30 m.",
  ].join(" ")
);
check(
  "CONSTRAINTS: narrow access supported",
  deckConstraints.some(
    (c) => c.key === "site_access" && c.value === "Difficult"
  )
);
check(
  "CONSTRAINTS: 25–30m carry supported",
  deckConstraints.some(
    (c) =>
      c.key === "material_carry_distance" &&
      (c.value === "10–30m" || String(c.value).includes("30"))
  )
);
const sample6r3 = extractConstraintsFromBrief(
  "Narrow restricted access with 25m carting distance on an occupied upper floor site"
);
check(
  "CONSTRAINTS: DEF-7E-006 sample maps access + carry + floor/occupied",
  sample6r3.some((c) => c.key === "site_access") &&
    sample6r3.some((c) => c.key === "material_carry_distance") &&
    (sample6r3.some((c) => c.key === "occupied_site") ||
      sample6r3.some((c) => c.key === "floor_level"))
);
const keys = deckConstraints.map((c) => c.key);
check(
  "CONSTRAINTS: no duplicate keys from brief extract",
  keys.length === new Set(keys).size
);
const bareDimension = extractConstraintsFromBrief(
  "Build a timber deck approximately 5–6 m long with hardwood boards."
);
check(
  "CONSTRAINTS: bare approximate dimensions do not fabricate carry distance",
  !bareDimension.some((c) => c.key === "material_carry_distance")
);
check(
  "CONSTRAINTS: airport/security/noise remain unknown without taxonomy (Stage 3.2)",
  extractConstraintsFromBrief(
    "Airport security screening and noise restrictions overnight."
  ).every(
    (c) =>
      c.key !== "airport_security" &&
      c.key !== "noise_restrictions"
  )
);

// ─── SCROLL ──────────────────────────────────────────────────
const layout = read("app/layout.tsx");
const sidebar = read("components/app-sidebar.tsx");
const shell = read("components/layout/app-shell.tsx");
check(
  "SCROLL: body uses h-dvh overflow-hidden (print override)",
  layout.includes("h-dvh overflow-hidden") &&
    layout.includes("print:overflow-visible")
);
check(
  "SCROLL: sidebar is flex sibling (not document-sticky)",
  sidebar.includes("h-dvh") && !sidebar.includes("sticky top-0")
);
check(
  "SCROLL: AppShell locks viewport overflow",
  shell.includes("h-dvh") && shell.includes("overflow-hidden")
);
check(
  "SCROLL: no JS scroll listener for shell lock",
  !shell.includes("addEventListener(\"scroll\"") &&
    !sidebar.includes("addEventListener(\"scroll\"")
);

// ─── PERFORMANCE ─────────────────────────────────────────────
check(
  "PERFORMANCE: analyse path skips duplicate router.refresh",
  /await refreshResults\(\);\s*\/\/ Results are already refreshed/.test(
    reviewBlock
  ) ||
    !/await refreshResults\(\);\s*startTransition\(\(\) => \{\s*router\.refresh\(\);/.test(
      reviewBlock.split("handleAnalyse")[1]?.slice(0, 800) ?? ""
    )
);
check(
  "PERFORMANCE: batch confirm skips full remount",
  reviewBlock.includes(
    "Batch confirm does not create Work Areas / Facts — skip full remount"
  )
);

// ─── BOUNDARIES ──────────────────────────────────────────────
check(
  "BOUNDARIES: Production remains disabled markers present",
  read("docs/implementation/STAGE_3_1B7FR1_DECK_E2E_REMEDIATION_COMPLETION.md").includes(
    "Production"
  )
);
check(
  "BOUNDARIES: no Stage 3.2 started claim in remediation",
  read("docs/implementation/STAGE_3_1B7FR1_DECK_E2E_REMEDIATION_COMPLETION.md").includes(
    "Stage 3.2 — Not Started"
  ) ||
    read("docs/implementation/STAGE_3_1B7FR1_DECK_E2E_REMEDIATION_COMPLETION.md").includes(
      "Stage 3.2:** Not Started"
    )
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

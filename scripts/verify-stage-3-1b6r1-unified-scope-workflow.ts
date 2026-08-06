/**
 * Stage 3.1B.6R1 — Unified scope workflow + decision remediation verification.
 *
 * Run: npx tsx scripts/verify-stage-3-1b6r1-unified-scope-workflow.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canCreateWorkAreaFromProposal,
  classifyScopeProposal,
  evaluateDecidability,
  HIGH_LEVEL_WORK_AREA_TYPES,
  isAbstractScopeItemType,
  isHighLevelWorkAreaType,
} from "../lib/scope-discovery/classification";
import {
  buildScopeItemDecisionSets,
  isQuestionSuppressedByScopeItemExclusion,
  filterConstraintsForAcceptedScope,
  SCOPE_DISCOVERY_UI_COPY,
} from "../lib/scope-discovery/ui";
import { isSupportedWorkAreaType } from "../lib/scope-discovery/decisions/schemas";
import { shouldSkipTemplateQuestion } from "../lib/scopes/questions";
import { buildFactLookup } from "../lib/scopes/fact-values";

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

console.log("\n=== Stage 3.1B.6R1 — Unified Scope Workflow Verification ===\n");

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------
check("Deck is a high-level Work Area type", isHighLevelWorkAreaType("deck"));
check(
  "Bathroom is a high-level Work Area type",
  isHighLevelWorkAreaType("bathroom")
);
check(
  "Commercial fitout is a high-level Work Area type",
  isHighLevelWorkAreaType("commercial_fitout")
);
check("Decking is an abstract scope item", isAbstractScopeItemType("decking"));
check(
  "Demolition as MISSING_SCOPE → SCOPE_ITEM",
  classifyScopeProposal({
    suggestionKind: "MISSING_SCOPE",
    proposedWorkAreaType: "demolition",
  }) === "SCOPE_ITEM"
);
check(
  "Substructure DEPENDENCY → SCOPE_ITEM",
  classifyScopeProposal({
    suggestionKind: "DEPENDENCY",
    proposedWorkAreaType: "substructure",
  }) === "SCOPE_ITEM"
);
check(
  "Waste removal MISSING_SCOPE → SCOPE_ITEM",
  classifyScopeProposal({
    suggestionKind: "MISSING_SCOPE",
    proposedWorkAreaType: "waste_removal",
  }) === "SCOPE_ITEM"
);
check(
  "Waterproofing MISSING_SCOPE → SCOPE_ITEM",
  classifyScopeProposal({
    suggestionKind: "MISSING_SCOPE",
    proposedWorkAreaType: "waterproofing",
  }) === "SCOPE_ITEM"
);
check(
  "Fire stopping is not a high-level WA",
  !isHighLevelWorkAreaType("fire_stopping") &&
    classifyScopeProposal({
      suggestionKind: "MISSING_SCOPE",
      proposedWorkAreaType: "fire_stopping",
    }) === "SCOPE_ITEM"
);
check(
  "WORK_AREA deck can create Work Area",
  canCreateWorkAreaFromProposal({
    suggestionKind: "WORK_AREA",
    proposedWorkAreaType: "deck",
  })
);
check(
  "MISSING_SCOPE demolition cannot create Work Area",
  !canCreateWorkAreaFromProposal({
    suggestionKind: "MISSING_SCOPE",
    proposedWorkAreaType: "demolition",
  })
);
check(
  "waste_removal is not a supported Work Area type (Preview failure root)",
  !isSupportedWorkAreaType("waste_removal")
);
check(
  "Preview failure: abstract MISSING_SCOPE cannot create WA",
  evaluateDecidability({
    suggestionKind: "MISSING_SCOPE",
    proposedWorkAreaType: "waste_removal",
    decisionState: "PROPOSED",
    proposedTitle: "Waste removal",
  }).canCreateWorkArea === false &&
    evaluateDecidability({
      suggestionKind: "MISSING_SCOPE",
      proposedWorkAreaType: "waste_removal",
      decisionState: "PROPOSED",
      proposedTitle: "Waste removal",
    }).canIncludeInScope === true
);
check(
  "DEPENDENCY was ineligible for WA accept RPC kinds — now scope item",
  classifyScopeProposal({
    suggestionKind: "DEPENDENCY",
    proposedWorkAreaType: "substructure",
  }) === "SCOPE_ITEM"
);

check(
  "HIGH_LEVEL set includes Analyse Job packages",
  HIGH_LEVEL_WORK_AREA_TYPES.has("deck") &&
    HIGH_LEVEL_WORK_AREA_TYPES.has("fence") &&
    HIGH_LEVEL_WORK_AREA_TYPES.has("kitchen")
);

// ---------------------------------------------------------------------------
// Actions / routing
// ---------------------------------------------------------------------------
const decisionServices = read(
  "lib/scope-discovery/application/decision-services.ts"
);
check(
  "accept routes SCOPE_ITEM to includeScopeItemApp",
  decisionServices.includes("includeScopeItemApp") &&
    decisionServices.includes('proposalClass === "SCOPE_ITEM"')
);
check(
  "modify routes SCOPE_ITEM to modifyIncludeScopeItemApp",
  decisionServices.includes("modifyIncludeScopeItemApp")
);
check(
  "scope-item decisions insert with createdWorkAreaId null",
  read("lib/scope-discovery/application/scope-item-decisions.ts").includes(
    "createdWorkAreaId: null"
  )
);
check(
  "scope-item include message states no work area",
  read("lib/scope-discovery/application/scope-item-decisions.ts").includes(
    "No work area was created"
  )
);

const card = read("components/assistant/ScopeDiscoverySuggestionCard.tsx");
check(
  "UI uses Include in scope for scope items",
  card.includes("includeInScope") || card.includes("Include in scope")
);
check(
  "UI does not show Add work area for non-WA families",
  card.includes("showWorkAreaActions") && card.includes("showScopeItemActions")
);
check(
  "non-decidable reason is shown when present",
  card.includes("decidabilityReason")
);

// ---------------------------------------------------------------------------
// Workflow naming / order
// ---------------------------------------------------------------------------
const shell = read("components/assistant/AssistantShell.tsx");
const reviewBlock = read("components/assistant/ScopeDiscoveryReviewBlock.tsx");
check(
  "Estimate Review rename present",
  shell.includes('title="Estimate Review"')
);
check(
  "Scope Discovery card still Scope Review",
  shell.includes("ScopeDiscoveryReviewBlock") &&
    SCOPE_DISCOVERY_UI_COPY.cardTitle === "Scope Review"
);
check(
  "Scope Review mounts after work areas confirmed",
  shell.includes("scopeDiscoveryEnabled && workAreasConfirmed")
);
check(
  "Scope Review receives work area labels for hierarchy",
  shell.includes("workAreaLabels=")
);
check(
  "Review block nests by work area sections",
  reviewBlock.includes("groupSuggestionsByWorkAreaSections") &&
    reviewBlock.includes("workAreaLabel")
);
check(
  "Stepper constraints label is Site Constraints (not Scope Review)",
  read("components/assistant/StepperNav.tsx").includes(
    'label: "Site Constraints"'
  ) &&
    !read("components/assistant/StepperNav.tsx").includes(
      'label: "Scope Review"'
    )
);
check(
  "Quality still after work areas (and discovery when enabled)",
  shell.includes("{/* 3. Specification") ||
    shell.includes('title="Specification"') ||
    shell.includes('title="Quality"')
);
check(
  "Analyse Job still present",
  read("components/assistant/ProjectCaptureBlock.tsx").includes("Analyse job")
);

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
const excluded = new Set(["demolition", "balustrade", "stairs"]);
check(
  "excluded demolition suppresses existing_deck_removal question",
  isQuestionSuppressedByScopeItemExclusion({
    factKey: "deck.existing_deck_removal",
    excludedTypes: excluded,
  })
);
check(
  "excluded balustrade suppresses balustrade question",
  isQuestionSuppressedByScopeItemExclusion({
    factKey: "deck.balustrade_required",
    excludedTypes: excluded,
  })
);
check(
  "unrelated fact not suppressed",
  !isQuestionSuppressedByScopeItemExclusion({
    factKey: "deck.area_m2",
    excludedTypes: excluded,
  })
);

const skip = shouldSkipTemplateQuestion(
  {
    key: "deck.existing_deck_removal",
    label: "Existing removal",
    questionText: "Remove existing?",
    inputType: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: true,
    factKey: "deck.existing_deck_removal",
    workAreaType: "deck",
    priority: 1,
  },
  { id: "wa1", type: "deck", name: "Deck", sort_order: 1, status: "confirmed" },
  buildFactLookup([]),
  new Set(["deck"]),
  { quality_level: "standard" },
  excluded
);
check("shouldSkipTemplateQuestion honours exclusions", skip === true);

const sets = buildScopeItemDecisionSets([
  {
    proposalClass: "SCOPE_ITEM",
    proposedWorkAreaType: "demolition",
    decisionState: "REJECTED",
  },
  {
    proposalClass: "SCOPE_ITEM",
    proposedWorkAreaType: "coatings",
    decisionState: "ACCEPTED",
  },
]);
check(
  "decision sets capture include/exclude",
  sets.excludedTypes.has("demolition") && sets.includedTypes.has("coatings")
);

check(
  "question builder accepts excludedScopeItemTypes",
  read("lib/scopes/questions.ts").includes("excludedScopeItemTypes")
);
check(
  "saveQuality path loads exclusions when feature enabled",
  read("lib/assistant/actions.ts").includes("loadExcludedScopeItemTypes")
);

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------
const filtered = filterConstraintsForAcceptedScope({
  constraintKeys: [
    "site_access",
    "material_carry_distance",
    "working_hours",
    "waste_bin_access",
  ],
  includedScopeTypes: new Set(["waste_removal"]),
  confirmedWorkAreaTypes: new Set(["deck"]),
});
check(
  "project-wide constraints retained",
  filtered.includes("site_access") && filtered.includes("working_hours")
);
check(
  "waste-linked constraints kept when waste included",
  filtered.includes("material_carry_distance")
);

// ---------------------------------------------------------------------------
// Persistence / migration
// ---------------------------------------------------------------------------
check(
  "no migration 030 added",
  (() => {
    try {
      read("supabase/migrations/030_scope_item_decisions.sql");
      return false;
    } catch {
      return true;
    }
  })()
);
check(
  "uses insertDiscoveryDecision for scope items",
  read("lib/scope-discovery/application/scope-item-decisions.ts").includes(
    "insertDiscoveryDecision"
  )
);

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------
check(
  "no Company DNA / Builder Interview in classification",
  !read("lib/scope-discovery/classification.ts")
    .toLowerCase()
    .includes("company dna") &&
    !read("lib/scope-discovery/classification.ts")
      .toLowerCase()
      .includes("builder interview")
);
check(
  "Analyse Job action not replaced",
  read("lib/assistant/actions.ts").includes("saveBriefAndSeedWorkAreas") &&
    !read("lib/assistant/actions.ts").includes("runScopeDiscoveryAction")
);
check(
  "completion docs exist",
  (() => {
    try {
      read(
        "docs/implementation/STAGE_3_1B6R1_UNIFIED_SCOPE_WORKFLOW_COMPLETION.md"
      );
      read("docs/runbooks/STAGE_3_1B6R1_PREVIEW_RETEST.md");
      return true;
    } catch {
      return false;
    }
  })()
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

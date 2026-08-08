/**
 * Stage 3.1B.7F-R3 — Unified Scope State Reconciliation gate.
 * Static verification only. No Production enablement. No Stage 3.2. No migration 032.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  composeCurrentWorkAreaScopeState,
  includedSummaryRows,
  resolvePendingDetailFactKeys,
} from "../lib/assistant/current-work-area-scope-state";
import { buildScopeItemSummaryLists } from "../lib/assistant/stage-completion-summaries";
import type { ScopeReview } from "../lib/assistant/types";
import type { ManualScopeItemView } from "../lib/work-areas/scope-items/types";

const ROOT = process.cwd();
let passed = 0;
let failed = 0;

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(label: string, ok: boolean) {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${label}`);
  }
}

function fileHas(rel: string, needle: string | RegExp): boolean {
  const src = read(rel);
  return typeof needle === "string" ? src.includes(needle) : needle.test(src);
}

const WA = "wa-deck-1";

function emptyScopeReview(): ScopeReview {
  return {
    workAreas: [
      {
        workAreaId: WA,
        workAreaType: "deck",
        workAreaName: "Deck",
        facts: [],
        missingItems: [],
        activeQuestions: [],
        assumptions: [],
      },
    ],
    excludedWorkAreas: [],
    generalAssumptions: [],
    generalExclusions: [],
  };
}

function withFacts(
  facts: { key: string; value: string }[],
  questions: {
    key: string;
    required: boolean;
    value?: string | null;
  }[] = []
): ScopeReview {
  const base = emptyScopeReview();
  return {
    ...base,
    workAreas: [
      {
        ...base.workAreas[0],
        facts: facts.map((f) => ({
          key: f.key,
          label: f.key,
          value: f.value,
          sourceLabel: "answered" as const,
          sourcePriority: 1,
        })),
        activeQuestions: questions.map((q, i) => ({
          id: `q-${i}`,
          key: q.key,
          label: q.key,
          questionText: q.key,
          inputType: "select" as const,
          required: q.required,
          value: q.value ?? null,
          questionBlockId: "block-1",
          missingItemLabel: q.key,
        })),
      },
    ],
  };
}

const deckSuggestions = [
  {
    suggestionId: "s-decking",
    proposedTitle: "Decking surface",
    decisionState: "ACCEPTED",
    proposalClass: "SCOPE_ITEM",
    relatedWorkAreaId: WA,
  },
  {
    suggestionId: "s-coatings",
    proposedTitle: "Coatings / oiling",
    decisionState: "ACCEPTED",
    proposalClass: "SCOPE_ITEM",
    relatedWorkAreaId: WA,
  },
  {
    suggestionId: "s-balustrade",
    proposedTitle: "Balustrade",
    decisionState: "REJECTED",
    proposalClass: "SCOPE_ITEM",
    relatedWorkAreaId: WA,
  },
  {
    suggestionId: "s-substructure",
    proposedTitle: "Existing substructure condition",
    decisionState: "ACCEPTED",
    proposalClass: "CLARIFICATION",
    latestReasonCode: "included_pending_detail",
    rationaleCode: "deck.substructure.missing_condition",
    relatedWorkAreaId: WA,
  },
  {
    suggestionId: "s-fascia",
    proposedTitle: "Fascia / face boards",
    decisionState: "MODIFIED",
    proposalClass: "SCOPE_ITEM",
    latestReasonCode: "routed_to_details",
    rationaleCode: "deck.finish.fascia",
    relatedWorkAreaId: WA,
  },
] as const;

const manualIncluded: ManualScopeItemView = {
  id: "m-waste",
  workAreaId: WA,
  workAreaName: "Deck",
  identity: "user:additional-waste-removal",
  title: "Additional Waste Removal",
  description: null,
  scopeItemType: null,
  origin: "user",
  state: "INCLUDED",
  pricingRequired: true,
  addedByYou: true,
};

const manualNotRequired: ManualScopeItemView = {
  ...manualIncluded,
  id: "m-waste-off",
  title: "Temporary Handrail",
  state: "NOT_REQUIRED",
};

console.log("\n=== Stage 3.1B.7F-R3 unified scope state ===\n");

// ─── DETAIL RECONCILIATION ───────────────────────────────────
const unanswered = composeCurrentWorkAreaScopeState({
  suggestions: deckSuggestions,
  scopeReview: emptyScopeReview(),
});
check(
  "DETAIL: unanswered required mapped Fact => NEEDS_DETAIL",
  unanswered.needsDetailCount === 2 &&
    unanswered.summaryLists.pendingScopeDetails.some((p) =>
      p.title.includes("substructure")
    ) &&
    unanswered.summaryLists.pendingScopeDetails.some((p) =>
      p.title.toLowerCase().includes("fascia")
    ) &&
    !unanswered.summaryLists.included.includes("Existing substructure condition")
);

const answered = composeCurrentWorkAreaScopeState({
  suggestions: deckSuggestions,
  scopeReview: withFacts([
    { key: "deck.substructure_condition", value: "sound" },
    { key: "deck.vertical_face_boards_required", value: "yes" },
  ]),
});
check(
  "DETAIL: answer required Facts => COMPLETE / moves to Included",
  answered.needsDetailCount === 0 &&
    answered.summaryLists.pendingScopeDetails.length === 0 &&
    answered.summaryLists.included.includes("Existing substructure condition") &&
    answered.summaryLists.included.includes("Fascia / face boards")
);

check(
  "DETAIL: includedCount unchanged by detail completion (still included)",
  unanswered.includedCount === answered.includedCount &&
    unanswered.includedCount === 4
);

check(
  "DETAIL: resolvePendingDetailFactKeys maps known rationales",
  resolvePendingDetailFactKeys({
    latestReasonCode: "included_pending_detail",
    rationaleCode: "deck.substructure.missing_condition",
    suggestionKind: "CLARIFICATION_REQUIRED",
    title: "Existing substructure condition",
  }).includes("deck.substructure_condition") &&
    resolvePendingDetailFactKeys({
      latestReasonCode: "routed_to_details",
      title: "Fascia / face boards",
      suggestionKind: "SCOPE_ITEM",
    }).includes("deck.vertical_face_boards_required")
);

const optionalOk = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "s-opt",
      proposedTitle: "Optional fascia note",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
      latestReasonCode: "included_pending_detail",
      rationaleCode: "deck.finish.fascia",
      relatedWorkAreaId: WA,
    },
  ],
  scopeReview: withFacts([], [
    {
      key: "deck.vertical_face_boards_required",
      required: false,
      value: null,
    },
  ]),
});
check(
  "DETAIL: optional question does not block COMPLETE",
  optionalOk.needsDetailCount === 0 &&
    optionalOk.summaryLists.included.includes("Optional fascia note")
);

const multiPartial = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "s-multi",
      proposedTitle: "Multi-detail item",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
      latestReasonCode: "included_pending_detail",
      rationaleCode: "deck.finish.fascia",
      relatedWorkAreaId: WA,
      requiredDetailFactKeys: [
        "deck.vertical_face_boards_required",
        "deck.substructure_condition",
      ],
    },
  ],
  scopeReview: withFacts([
    { key: "deck.vertical_face_boards_required", value: "yes" },
  ]),
});
const multiComplete = composeCurrentWorkAreaScopeState({
  suggestions: multiPartial.items.length
    ? [
        {
          suggestionId: "s-multi",
          proposedTitle: "Multi-detail item",
          decisionState: "ACCEPTED",
          proposalClass: "SCOPE_ITEM",
          latestReasonCode: "included_pending_detail",
          rationaleCode: "deck.finish.fascia",
          relatedWorkAreaId: WA,
          requiredDetailFactKeys: [
            "deck.vertical_face_boards_required",
            "deck.substructure_condition",
          ],
        },
      ]
    : [],
  scopeReview: withFacts([
    { key: "deck.vertical_face_boards_required", value: "yes" },
    { key: "deck.substructure_condition", value: "sound" },
  ]),
});
check(
  "DETAIL: multiple required facts stay NEEDS_DETAIL until all resolved",
  multiPartial.needsDetailCount === 1 && multiComplete.needsDetailCount === 0
);

check(
  "DETAIL: no discovery rerun / no Analyse-again requirement in composer",
  !fileHas(
    "lib/assistant/current-work-area-scope-state.ts",
    "runScopeDiscovery"
  ) &&
    fileHas(
      "lib/assistant/current-work-area-scope-state.ts",
      "composeCurrentWorkAreaScopeState"
    )
);

check(
  "DETAIL: Scope Review remains Complete semantics documented in UI",
  fileHas(
    "components/assistant/ScopeDiscoveryReviewBlock.tsx",
    "evaluateScopeReviewCompletion"
  ) &&
    fileHas(
      "components/assistant/ScopeDiscoveryReviewBlock.tsx",
      "scopeReview"
    )
);

// ─── UNIFIED STATE ───────────────────────────────────────────
const unified = composeCurrentWorkAreaScopeState({
  suggestions: deckSuggestions,
  manualItems: [manualIncluded, manualNotRequired],
  scopeReview: withFacts([
    { key: "deck.substructure_condition", value: "sound" },
    { key: "deck.vertical_face_boards_required", value: "yes" },
  ]),
});
check(
  "UNIFIED: system + manual items present with provenance",
  unified.items.some((i) => i.origin === "system" && i.title === "Decking surface") &&
    unified.items.some(
      (i) => i.origin === "user" && i.title === "Additional Waste Removal"
    ) &&
    unified.items.find((i) => i.title === "Additional Waste Removal")
      ?.addedByYou === true
);
check(
  "UNIFIED: includedCount = system included + manual included",
  unified.includedCount === 5 &&
    unified.notRequiredCount === 2 &&
    unified.summaryLists.included.includes("Additional Waste Removal")
);
check(
  "UNIFIED: provenance rows show Added by you · Pricing required",
  includedSummaryRows(unified).some(
    (r) =>
      r.title === "Additional Waste Removal" &&
      r.secondary === "Added by you · Pricing required"
  )
);
check(
  "UNIFIED: buildScopeItemSummaryLists delegates to composer",
  fileHas(
    "lib/assistant/stage-completion-summaries.ts",
    "composeCurrentWorkAreaScopeState"
  ) &&
    buildScopeItemSummaryLists({
      suggestions: deckSuggestions,
      manualItems: [manualIncluded],
      scopeReview: emptyScopeReview(),
    }).pendingScopeDetails.length === 2
);

// ─── QUICK ESTIMATE ──────────────────────────────────────────
const afterExclude = composeCurrentWorkAreaScopeState({
  suggestions: deckSuggestions,
  manualItems: [{ ...manualIncluded, state: "NOT_REQUIRED" }],
  scopeReview: withFacts([
    { key: "deck.substructure_condition", value: "sound" },
    { key: "deck.vertical_face_boards_required", value: "yes" },
  ]),
});
check(
  "QE: Not required excluded from included count",
  afterExclude.includedCount === 4 &&
    !afterExclude.summaryLists.included.includes("Additional Waste Removal")
);
check(
  "QE: included + NEEDS_DETAIL still counted as included",
  unanswered.includedCount === 4 && unanswered.needsDetailCount === 2
);
check(
  "QE: attention (needsDetail) separate from includedScope count",
  unanswered.includedCount !== unanswered.needsDetailCount &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      "composeCurrentWorkAreaScopeState"
    ) &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      "needsDetailScopeCount"
    ) &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      "includedScopeItemCount"
    )
);
check(
  "QE: shell wires live scope counts from Scope Review",
  fileHas(
    "components/assistant/AssistantShell.tsx",
    "onScopeStateChange"
  ) &&
    fileHas(
      "components/assistant/ScopeDiscoveryReviewBlock.tsx",
      "onScopeStateChange"
    )
);

// ─── EDIT SCOPE UX ───────────────────────────────────────────
check(
  "EDIT: confirmed summary directs editing to Edit scope (no live manual checkboxes there)",
  fileHas(
    "components/assistant/ScopeDiscoveryReviewBlock.tsx",
    "Use Edit scope to include, exclude, or add scope items"
  ) &&
    fileHas(
      "components/assistant/ScopeDiscoveryReviewBlock.tsx",
      "includedRows={includedProvenanceRows}"
    )
);
check(
  "EDIT: Edit scope uses local toggles for manuals + discovery batch",
  fileHas(
    "components/assistant/ScopeDiscoveryReviewBlock.tsx",
    "localManualBatch"
  ) &&
    fileHas(
      "components/assistant/ScopeDiscoveryReviewBlock.tsx",
      "onLocalToggle"
    ) &&
    fileHas(
      "components/assistant/ScopeDiscoveryReviewBlock.tsx",
      "decideManualScopeItemAction"
    ) &&
    fileHas(
      "components/assistant/ScopeDiscoveryReviewBlock.tsx",
      "batchConfirmScopeItemsAction"
    )
);
check(
  "EDIT: partial failure reported honestly",
  fileHas(
    "components/assistant/ScopeDiscoveryReviewBlock.tsx",
    "manual scope decision"
  ) &&
    fileHas(
      "components/assistant/ScopeDiscoveryReviewBlock.tsx",
      "System scope decisions could not be saved"
    )
);
check(
  "EDIT: Add scope item lives in Edit checklist",
  fileHas(
    "components/assistant/ScopeDiscoveryReviewBlock.tsx",
    "AddManualScopeItemForm"
  ) &&
    fileHas(
      "components/assistant/AddManualScopeItemForm.tsx",
      "localIncluded"
    )
);

// ─── ESTIMATE REVIEW ─────────────────────────────────────────
check(
  "ESTIMATE REVIEW: manuals still surfaced with Pricing required",
  fileHas("components/assistant/ScopeSummaryBlock.tsx", "manualScopeItems") &&
    fileHas("lib/work-areas/scope-items/pricing-bridge.ts", "Pricing required") &&
    fileHas("components/assistant/EstimateBreakdownModal.tsx", "manualScopeByWa")
);

// ─── BOUNDARIES ──────────────────────────────────────────────
check(
  "BOUNDARIES: no migration 032",
  !existsSync(join(ROOT, "supabase/migrations/032_work_area_scope_items.sql")) &&
    !existsSync(join(ROOT, "supabase/migrations/032_unified_scope_state.sql"))
);
check(
  "BOUNDARIES: composer is read-model only (no Fact writes)",
  !fileHas("lib/assistant/current-work-area-scope-state.ts", "updateProjectFact") &&
    !fileHas("lib/assistant/current-work-area-scope-state.ts", "from(\"facts\")")
);
check(
  "BOUNDARIES: no Production enablement / Stage 3.2 start",
  !fileHas(
    "docs/implementation/STAGE_3_1B7FR3_UNIFIED_SCOPE_STATE_COMPLETION.md",
    "Production — Enabled"
  ) &&
    fileHas(
      "docs/implementation/STAGE_3_1B7FR3_UNIFIED_SCOPE_STATE_COMPLETION.md",
      "Stage 3.2 — Not Started"
    )
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

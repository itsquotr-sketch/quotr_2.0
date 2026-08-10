/**
 * Stage 3.1B.7F-R2 — Scope Review completion & final Preview polish gate.
 * Static verification only. No Production enablement. No Stage 3.2.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildScopeItemSummaryLists,
} from "../lib/assistant/stage-completion-summaries";
import {
  buildQuickEstimateAttentionItems,
} from "../lib/assistant/presentation/quick-estimate-view-model";
import {
  buildManualScopePricingNotes,
  isManualScopePricingRequiredNote,
} from "../lib/work-areas/scope-items/pricing-bridge";
import { manualScopeItemIdentity } from "../lib/work-areas/scope-items/types";
import {
  clearPreviewPerfSamples,
  getPreviewPerfSamples,
  recordPreviewPerf,
  startPreviewPerf,
} from "../lib/assistant/preview-performance";

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

console.log("\n=== Stage 3.1B.7F-R2 final Preview polish ===\n");

// ─── SCOPE DETAIL SEMANTICS ──────────────────────────────────
const lists = buildScopeItemSummaryLists({
  suggestions: [
    {
      proposedTitle: "Decking surface",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Balustrade",
      decisionState: "REJECTED",
      proposalClass: "SCOPE_ITEM",
    },
    {
      proposedTitle: "Existing substructure condition",
      decisionState: "ACCEPTED",
      proposalClass: "CLARIFICATION",
      latestReasonCode: "included_pending_detail",
    },
    {
      proposedTitle: "Fascia / face boards",
      decisionState: "MODIFIED",
      proposalClass: "SCOPE_ITEM",
      latestReasonCode: "routed_to_details",
    },
  ],
});
check(
  "SCOPE DETAILS: pending bucket separate from Included",
  lists.included.length === 1 &&
    lists.included[0] === "Decking surface" &&
    lists.notRequired.length === 1 &&
    lists.pendingScopeDetails.length === 2 &&
    !lists.included.includes("Existing substructure condition")
);
check(
  "SCOPE DETAILS: terminology points to Scope Details",
  lists.pendingScopeDetails.every((p) =>
    p.reason.toLowerCase().includes("included")
  ) &&
    fileHas(
      "lib/scope-discovery/ui/labels.ts",
      "To confirm in Scope Details"
    ) &&
    fileHas(
      "components/assistant/StageCollapsedSummaries.tsx",
      "Review Scope Details"
    )
);
check(
  "SCOPE DETAILS: zero pending hides section",
  buildScopeItemSummaryLists({
    suggestions: [
      {
        proposedTitle: "Decking",
        decisionState: "ACCEPTED",
        proposalClass: "SCOPE_ITEM",
      },
    ],
  }).pendingScopeDetails.length === 0 &&
    fileHas(
      "components/assistant/StageCollapsedSummaries.tsx",
      "pending.length > 0"
    )
);
check(
  "SCOPE DETAILS: Review destination wired to Scope Details card",
  fileHas(
    "components/assistant/AssistantShell.tsx",
    "onReviewScopeDetails"
  ) &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      "questionsCardRef.current?.scrollIntoView"
    )
);
check(
  "SCOPE DETAILS: Scope Review Complete can coexist with pending details",
  fileHas(
    "lib/scope-discovery/ui/labels.ts",
    "pendingScopeDetailsHint"
  ) && !fileHas("lib/scope-discovery/ui/labels.ts", 'needsDetail: "Needs detail"')
);

// ─── MANUAL SCOPE ITEM ───────────────────────────────────────
check(
  "MANUAL: dedicated tables (Option B) — migration 030",
  existsSync(join(ROOT, "supabase/migrations/030_work_area_scope_items.sql")) &&
    fileHas(
      "supabase/migrations/030_work_area_scope_items.sql",
      "work_area_scope_items"
    ) &&
    fileHas(
      "supabase/migrations/030_work_area_scope_items.sql",
      "origin text not null default 'user'"
    )
);
check(
  "MANUAL: decision doc chooses Option B over suggestions origin=user",
  fileHas(
    "docs/architecture/STAGE_3_1B7FR2_MANUAL_SCOPE_ITEM_PERSISTENCE.md",
    "Option B"
  ) &&
    fileHas(
      "docs/architecture/STAGE_3_1B7FR2_MANUAL_SCOPE_ITEM_PERSISTENCE.md",
      "Not chosen"
    )
);
check(
  "MANUAL: identity helper is WA-scoped",
  manualScopeItemIdentity({
    workAreaId: "11111111-1111-1111-1111-111111111111",
    title: "Temporary protection",
  }).startsWith("user:")
);
check(
  "MANUAL: Add UI under Scope Review",
  fileHas(
    "components/assistant/ScopeDiscoveryReviewBlock.tsx",
    "AddManualScopeItemForm"
  ) &&
    fileHas(
      "components/assistant/AddManualScopeItemForm.tsx",
      "addManualScopeItemAction"
    ) &&
    fileHas("lib/scope-discovery/ui/labels.ts", "addScopeItem")
);
check(
  "MANUAL: actions require confirmed WA; no Fact fabrication",
  fileHas(
    "lib/work-areas/scope-items/actions.ts",
    'wa.status !== "confirmed"'
  ) &&
    !fileHas("lib/work-areas/scope-items/actions.ts", "updateProjectFact") &&
    !fileHas("lib/work-areas/scope-items/actions.ts", "Company DNA")
);
check(
  "MANUAL: Estimate Review + breakdown surface Pricing required",
  fileHas(
    "components/assistant/ScopeSummaryBlock.tsx",
    "listManualScopeItemsForProject"
  ) &&
    fileHas(
      "components/assistant/EstimateBreakdownModal.tsx",
      "pricingRequired"
    ) &&
    fileHas(
      "lib/work-areas/scope-items/pricing-bridge.ts",
      "Pricing required"
    )
);
check(
  "MANUAL: Final Pricing stubs are not fake calculated $0 display",
  fileHas(
    "lib/pricing/actions.ts",
    "buildManualScopePricingNotes"
  ) &&
    fileHas(
      "lib/pricing/financial-view-model.ts",
      '"Pricing required"'
    ) &&
    fileHas(
      "lib/pricing/financial-view-model.ts",
      "isManualScopePricingRequiredNote"
    ) &&
    isManualScopePricingRequiredNote(
      buildManualScopePricingNotes({ title: "Disposal charge" })
    )
);
check(
  "MANUAL: RLS — authenticated only, no anon grants in 030",
  fileHas(
    "supabase/migrations/030_work_area_scope_items.sql",
    "enable row level security"
  ) &&
    !/grant\s+[^;]*\s+to\s+anon/i.test(
      read("supabase/migrations/030_work_area_scope_items.sql")
    ) &&
    fileHas(
      "supabase/migrations/030_work_area_scope_items.sql",
      "to authenticated"
    )
);

// ─── QUICK ESTIMATE ATTENTION ────────────────────────────────
const attention = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Deck",
      label: "Existing substructure condition",
      questionId: "q-sub",
      workAreaId: "wa-deck",
    },
    {
      workAreaName: "Deck",
      label: "Fascia finish",
      questionId: "q-fascia",
      workAreaId: "wa-deck",
    },
  ],
});
check(
  "QE ATTENTION: names items + WA + Scope Details path",
  attention.length === 2 &&
    attention.every((i) => i.workAreaName === "Deck") &&
    attention.every((i) => i.detail === "Review in Scope Details") &&
    attention.every((i) => i.reviewTarget === "estimateReview") &&
    attention.every((i) => Boolean(i.questionId))
);
check(
  "QE ATTENTION: EstimatePanel prefers missingByWorkArea",
  fileHas(
    "components/assistant/EstimatePanel.tsx",
    "missingByWorkArea"
  ) &&
    fileHas(
      "components/assistant/EstimatePanel.tsx",
      "item.workAreaName"
    )
);

// ─── GENERATE / ANSWER LATENCY ───────────────────────────────
clearPreviewPerfSamples();
recordPreviewPerf("estimate_generate_ack", 0);
const endGen = startPreviewPerf("estimate_generate_complete");
endGen();
recordPreviewPerf("question_save_ack", 0);
const endSave = startPreviewPerf("question_save_complete");
endSave();
const samples = getPreviewPerfSamples();
check(
  "PERF: ack/complete marks exist for generate + answer save",
  samples.some((s) => s.mark === "estimate_generate_ack") &&
    samples.some((s) => s.mark === "estimate_generate_complete") &&
    samples.some((s) => s.mark === "question_save_ack") &&
    samples.some((s) => s.mark === "question_save_complete")
);
check(
  "PERF: Generate sets pending immediately + disables double-click",
  fileHas(
    "components/assistant/AssistantShell.tsx",
    'setIsGenerating(true)'
  ) &&
    fileHas(
      "components/assistant/AssistantShell.tsx",
      "estimate_generate_ack"
    ) &&
    fileHas(
      "components/assistant/EstimatePanel.tsx",
      "disabled={isGenerating || !onGenerate}"
    )
);
check(
  "PERF: answer save marks Saved before background refresh",
  fileHas(
    "components/assistant/AssistantShell.tsx",
    'input.workAreaId]: "saved"'
  ) &&
    /setWorkAreaSaveStatus[\s\S]*"saved"[\s\S]*startTransition[\s\S]*router\.refresh/m.test(
      read("components/assistant/AssistantShell.tsx")
    )
);

// ─── LAYOUT / BANNER / MOBILE ────────────────────────────────
check(
  "LAYOUT: BetaNotice removed from AppShell",
  !fileHas("components/layout/app-shell.tsx", "BetaNotice") &&
    existsSync(join(ROOT, "components/layout/beta-notice.tsx"))
);
check(
  "LAYOUT: body/shell dvh intentional (no trapped body mystery)",
  fileHas("app/layout.tsx", "min-h-dvh") &&
    (fileHas("components/layout/app-shell.tsx", "min-h-dvh") ||
      fileHas("components/layout/app-shell.tsx", "h-dvh"))
);
check(
  "MOBILE HEADER: compact ProjectHeader hides desktop metadata below sm",
  fileHas(
    "components/projects/ProjectHeader.tsx",
    "hidden flex-wrap items-center gap-2 text-sm text-muted-foreground sm:flex"
  ) ||
    fileHas(
      "components/projects/ProjectHeader.tsx",
      "hidden.*sm:flex"
    )
);
check(
  "MOBILE HEADER: responsive doc updated",
  fileHas(
    "docs/architecture/QUOTR_ASSISTANT_RESPONSIVE_AND_MOBILE_PRESENTATION.md",
    "mobile project header"
  ) ||
    fileHas(
      "docs/architecture/QUOTR_ASSISTANT_RESPONSIVE_AND_MOBILE_PRESENTATION.md",
      "Mobile project header"
    )
);

// ─── BOUNDARIES ──────────────────────────────────────────────
check(
  "BOUNDARIES: completion doc status Local / Preview retest pending",
  existsSync(
    join(
      ROOT,
      "docs/implementation/STAGE_3_1B7FR2_FINAL_PREVIEW_POLISH_COMPLETION.md"
    )
  ) &&
    fileHas(
      "docs/implementation/STAGE_3_1B7FR2_FINAL_PREVIEW_POLISH_COMPLETION.md",
      "Preview Retest Pending"
    ) &&
    fileHas(
      "docs/implementation/STAGE_3_1B7FR2_FINAL_PREVIEW_POLISH_COMPLETION.md",
      "Production — Disabled"
    ) &&
    fileHas(
      "docs/implementation/STAGE_3_1B7FR2_FINAL_PREVIEW_POLISH_COMPLETION.md",
      "Stage 3.2 — Not Started"
    )
);
check(
  "BOUNDARIES: no Stage 3.1B complete claim",
  !fileHas(
    "docs/implementation/STAGE_3_1B7FR2_FINAL_PREVIEW_POLISH_COMPLETION.md",
    "Stage 3.1B — Complete"
  )
);
check(
  "BOUNDARIES: remote migration not auto-applied in docs",
  fileHas(
    "docs/architecture/STAGE_3_1B7FR2_MANUAL_SCOPE_ITEM_PERSISTENCE.md",
    "not"
  ) &&
    fileHas(
      "docs/architecture/STAGE_3_1B7FR2_MANUAL_SCOPE_ITEM_PERSISTENCE.md",
      "Remote"
    )
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

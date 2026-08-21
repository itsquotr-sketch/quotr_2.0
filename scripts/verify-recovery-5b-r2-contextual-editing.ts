/**
 * RECOVERY-5B-R2 — Targeted estimate editing + Refine workspace.
 *
 * Run:
 *   npx tsx scripts/verify-recovery-5b-r2-contextual-editing.ts
 */
import { existsSync, readFileSync } from "node:fs";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const shell = read("components/assistant/AssistantShell.tsx");
const editJobSurface = read("components/assistant/mode/EditJobSurface.tsx");
const jobPlanPanel = read("components/assistant/job-plan/JobPlanPanel.tsx");
const workAreaCard = read("components/assistant/job-plan/JobPlanWorkAreaCard.tsx");
const builderSurface = read(
  "components/assistant/builder-review/BuilderReviewSurface.tsx"
);
const scopeSummary = read("components/assistant/ScopeSummaryBlock.tsx");
const refinePanel = read("components/assistant/clarify/ClarifyReadiness.tsx");
const estimateEditTarget = read("lib/assistant/mode/estimate-edit-target.ts");

console.log("=== RECOVERY-5B-R2 Contextual Editing Verifier ===\n");

// ------------------------------------------------------------
// TARGET CONTRACT / ROUTER
// ------------------------------------------------------------
check(
  "1 EstimateEditTarget contract exists",
  existsSync("lib/assistant/mode/estimate-edit-target.ts")
);
check(
  "2 JobPlan focus mapping helper present",
  estimateEditTarget.includes("jobPlanEditFocusFromTarget")
);
check(
  "3 AssistantShell imports helper",
  shell.includes("jobPlanEditFocusFromTarget")
);
check(
  "4 openEditJob maps target -> jobPlanEditFocus",
  shell.includes("setJobPlanEditFocus(jobPlanEditFocusFromTarget")
);
check(
  "5 openEditJob accepts EstimateEditTarget",
  shell.includes("target?: EstimateEditTarget")
);

// ------------------------------------------------------------
// CHANGE MATERIAL -> TARGETED MATERIAL SPEC EDITOR
// ------------------------------------------------------------
check(
  "6 Change material uses MATERIAL_SPEC target",
  shell.includes('kind: "MATERIAL_SPEC"') &&
    shell.includes('specFactKey: "deck.board_material"') &&
    shell.includes("openEditJob(\"job_plan\"")
);
check(
  "7 Job plan focus uses specFocusKey downstream",
  shell.includes("specFocusKey={jobPlanEditFocus?.specFocusKey")
);
check(
  "8 Targeted JobPlanPanel renders only focused Work Area card",
  jobPlanPanel.includes("const cardsToRender = focusWorkAreaId") &&
    jobPlanPanel.includes("autoEditOpen={Boolean(") &&
    jobPlanPanel.includes("focusWorkAreaId && card.workAreaId === focusWorkAreaId")
);
check(
  "9 Work area card focuses deck material control",
  workAreaCard.includes("deck-material-${card.workAreaId}") ||
    workAreaCard.includes("deck-material-${card.workAreaId}")
);

// ------------------------------------------------------------
// EDIT JOB DEFAULT LAYOUT (compact & collapsed)
// ------------------------------------------------------------
check(
  "9 EditJobSurface sectionOpen defaults to collapsed (general)",
  editJobSurface.includes("return false;") &&
    editJobSurface.includes("General Edit Job starts compact")
);

// ------------------------------------------------------------
// WORK AREA ADD / REMOVE UX
// ------------------------------------------------------------
check(
  "10 Add WA handler returns success/error object",
  shell.includes("return { success: false as const") &&
    shell.includes("return { success: true as const }")
);
check(
  "11 Add WA modal closes on success (JobPlanPanel wrapper)",
  jobPlanPanel.includes("onAdd={async (workAreaType) => {") &&
    jobPlanPanel.includes("if (out.success) setAddOpen(false)")
);
check(
  "12 Remove WA uses inline optimistic exclusion ids",
  shell.includes("setExcludedWorkAreaIds") &&
    shell.includes("excludeWorkAreaFromProject")
);
check(
  "13 Remove WA prevents removing last work area",
  shell.includes("LAST_ACTIVE_WORK_AREA_MESSAGE") &&
    shell.includes("canRemoveCanonicalWorkArea") &&
    read("lib/assistant/work-area-active.ts").includes(
      "At least one work area must remain in the estimate."
    )
);
check(
  "14 Remove WA shows user-facing inline error",
  scopeSummary.includes("removeError") &&
    scopeSummary.includes("setRemoveError")
);
check(
  "15 Add WA/Remove WA state uses optimistic overlay/reload contract",
  shell.includes("router.refresh()")
);

// ------------------------------------------------------------
// SCOPE ITEM INCLUDE/TOGGLE (supported catalogue UX)
// ------------------------------------------------------------
check(
  "16 Supported scope catalogue: notIncluded gated behind Edit, notConfirmed visible in normal view (R3)",
  workAreaCard.includes("data-job-plan-item={item.id}") &&
    workAreaCard.includes("data-job-plan-excluded") &&
    workAreaCard.includes("editOpen && card.notIncluded.length > 0") &&
    // R3: notConfirmed CHECK items are visible in normal view (not behind editOpen)
    workAreaCard.includes("{card.notConfirmed.length > 0 ?") &&
    !workAreaCard.includes("editOpen && card.notConfirmed.length > 0")
);
check(
  "17 Canonical write path exists for scope toggles",
  shell.includes("applyJobPlanScopeWrite")
);

// ------------------------------------------------------------
// REFINE AFTER ESTIMATE: routing + focus key + hierarchy
// ------------------------------------------------------------
check(
  "18 AssistantShell conditionally renders RefineEstimatePanel after estimate",
  shell.includes("refineAfterEstimateOpen") &&
    shell.includes("RefineEstimatePanel")
);
check(
  "19 Refine-after-estimate uses targeted focus via data-refine-field",
  shell.includes("data-refine-field") &&
    shell.includes("preventScroll: true")
);
check(
  "20 Refine shows all actionable candidates immediately (FE-0)",
  refinePanel.includes('data-refine-all-visible="true"') &&
    refinePanel.includes("[...view.highValue, ...view.advanced]")
);
check(
  "21 Refine has no nested More detail gate (FE-0)",
  !refinePanel.includes("More detail") &&
    !refinePanel.includes("data-refine-advanced-toggle")
);
check(
  "22 Refine tier classification remains in compose",
  read("lib/assistant/refine/compose.ts").includes('row.tier === "advanced"')
);

// ------------------------------------------------------------
// BUILDER REVIEW INFORMATION HIERARCHY + SECONDARY BREAKDOWN ACCESS
// ------------------------------------------------------------
check(
  "23 BuilderReviewSurface uses progressive disclosure openAreas state",
  builderSurface.includes("openAreas") && builderSurface.includes("slice(0, 3)")
);
check(
  "24 BuilderReviewSurface shows compact category summary when collapsed",
  builderSurface.includes("multi && !open") &&
    builderSurface.includes("slice(0, 3)") &&
    builderSurface.includes('join(" · ")')
);
check(
  "25 BuilderReview 'Improve' items are actionable buttons",
  builderSurface.includes("data-builder-review-improve-item") &&
    builderSurface.includes("onClick={() => onImprove(item)}")
);
check(
  "26 BuilderReview 'Change material' is deck-targeted only",
  builderSurface.includes("wa.workAreaType === \"deck\"") &&
    builderSurface.includes("data-builder-review-change-material")
);
check(
  "27 Builder Review legacy breakdown is secondary (not parallel)",
  shell.includes("EstimateBreakdownModal") &&
    shell.includes("setBuilderReviewOpen(false)") &&
    shell.includes("setBreakdownOpen(true)")
);

// ------------------------------------------------------------
// FINAL
// ------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);


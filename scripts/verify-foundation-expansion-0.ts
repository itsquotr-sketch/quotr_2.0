/**
 * FOUNDATION-EXPANSION-0 — Assistant / Edit-Job functional hardening verifier.
 *
 * Remove WA, Refine friction, stale projection, attention semantics,
 * Edit Job IA, mobile readability, and coverage audit doc presence.
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const PASS = "✅";
const FAIL = "❌";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(id: number, label: string, result: boolean) {
  if (result) {
    console.log(`${PASS} ${id} ${label}`);
    passed++;
  } else {
    console.log(`${FAIL} ${id} ${label}`);
    failed++;
    failures.push(`${id} ${label}`);
  }
}

const shell = read("components/assistant/AssistantShell.tsx");
const workAreaCard = read("components/assistant/job-plan/JobPlanWorkAreaCard.tsx");
const jobPlanPanel = read("components/assistant/job-plan/JobPlanPanel.tsx");
const refinePanel = read("components/assistant/clarify/ClarifyReadiness.tsx");
const editJobSurface = read("components/assistant/mode/EditJobSurface.tsx");
const quickEstimateVm = read("lib/assistant/presentation/quick-estimate-view-model.ts");
const attentionNav = read("lib/assistant/mode/attention.ts");
const previewPerf = read("lib/assistant/preview-performance.ts");
const coverageDoc = exists("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md")
  ? read("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md")
  : "";

const editJobBlock = shell.slice(
  shell.indexOf('assistantMode === "edit_job"'),
  shell.indexOf('assistantMode === "planning"')
);

// REMOVE WA
check(1, "Remove callback executes excludeWorkAreaFromProject", shell.includes("excludeWorkAreaFromProject"));
check(
  2,
  "Remove uses optimistic exclusion ids",
  shell.includes("setExcludedWorkAreaIds") && shell.includes("optimistic")
);
check(
  3,
  "Remove failure rolls back optimistic exclusion",
  shell.includes("prev.filter((id) => id !== workAreaId)")
);
check(
  4,
  "Last work area blocked with clear message",
  shell.includes("At least one work area must remain")
);
check(
  5,
  "Successful remove projects stale estimate",
  shell.includes("bridgeEstimateStaleAfterCanonicalWrite") &&
    shell.includes("work_area_remove_complete")
);
check(6, "Remove reloads canonical via router.refresh", shell.includes("router.refresh()"));
check(
  7,
  "Job Plan remove shows confirmation dialog",
  workAreaCard.includes("data-job-plan-remove-confirm") &&
    workAreaCard.includes("Remove from estimate?")
);
check(
  8,
  "Job Plan remove shows inline error",
  workAreaCard.includes("data-job-plan-remove-error") && workAreaCard.includes("removeError")
);

// REFINE
check(
  9,
  "No nested More Details gate",
  !refinePanel.includes("More detail") && !refinePanel.includes("data-refine-advanced-toggle")
);
check(
  10,
  "All actionable candidates visible (high + advanced merged)",
  refinePanel.includes("[...view.highValue, ...view.advanced]") &&
    refinePanel.includes('data-refine-all-visible="true"')
);
check(
  11,
  "Refine grouped by work area and scope category",
  refinePanel.includes("data-refine-work-area") && refinePanel.includes("data-refine-group")
);
check(
  12,
  "Targeted refine focus retained",
  shell.includes("data-refine-field") && shell.includes("refineAfterEstimateFocusKey")
);
check(
  13,
  "Zero candidates hides Refine entry",
  shell.includes("refineView.hasCandidates")
);

// STALE
check(
  14,
  "Canonical write success projects stale immediately",
  shell.includes("bridgeEstimateStaleAfterCanonicalWrite") &&
    shell.includes("canonical_write_stale_projection")
);
check(
  15,
  "displayEstimateStale merges local + server",
  shell.includes("estimate?.isStale) || localEstimateStale")
);
check(
  16,
  "Scope toggle uses stale bridge",
  shell.includes("setJobPlanScopeSaveStatus(\"saved\")") &&
    shell.includes("bridgeEstimateStaleAfterCanonicalWrite")
);

// ATTENTION
check(
  17,
  "Attention semantic classification exported",
  quickEstimateVm.includes("classifyAttentionSemanticBucket") &&
    quickEstimateVm.includes("ACTIONABLE_REFINEMENT")
);
check(
  18,
  "Actionable refine label distinct from generic attention",
  quickEstimateVm.includes("details could improve this estimate") &&
    !quickEstimateVm.includes("items need attention")
);
check(
  19,
  "Checks use checks remaining label",
  quickEstimateVm.includes("checks remaining")
);
check(
  20,
  "Pricing required label distinct",
  quickEstimateVm.includes("items need pricing")
);
check(
  21,
  "Informational items excluded from display attention",
  quickEstimateVm.includes('classifyAttentionSemanticBucket(item) !== "INFORMATIONAL"')
);

// EDIT JOB
check(
  22,
  "Edit Job Work Areas section title",
  editJobSurface.includes('title="Work Areas"')
);
check(
  23,
  "Edit Job Site & Project Conditions section",
  editJobSurface.includes('title="Site & Project Conditions"')
);
check(
  24,
  "Edit Job Additional Details section",
  editJobSurface.includes('title="Additional Details"')
);
check(
  25,
  "ScopeSummaryBlock removed from Edit Job advanced",
  !editJobBlock.includes("ScopeSummaryBlock")
);
check(
  26,
  "Advanced section optional (hidden when empty)",
  editJobSurface.includes("advanced = null") && editJobSurface.includes("{advanced ?")
);
check(
  27,
  "Targeted material deep link preserved",
  shell.includes("specFocusKey") && shell.includes("jobPlanEditFocus")
);
check(
  28,
  "Legacy questions route to job_plan not advanced",
  attentionNav.includes('section: "job_plan"') && attentionNav.includes('target === "questions"')
);

// MOBILE
check(
  29,
  "Edit Job compact default (collapsed sections)",
  editJobSurface.includes("General Edit Job starts compact")
);
check(
  30,
  "Refine overflow hidden",
  refinePanel.includes("overflow-x-hidden")
);
check(
  31,
  "Job Plan panel overflow hidden",
  jobPlanPanel.includes("overflow-x-hidden")
);

// PERF + COVERAGE DOC
check(
  32,
  "Preview perf marks for remove + stale projection",
  previewPerf.includes("work_area_remove_complete") &&
    previewPerf.includes("canonical_write_stale_projection")
);
check(
  33,
  "Coverage audit document exists with all 14 WA types",
  coverageDoc.length > 0 &&
    [
      "deck",
      "retaining_wall",
      "bathroom",
      "kitchen",
      "fence",
      "pergola",
      "external_stairs",
      "demolition",
      "internal_walls",
      "ceilings",
      "doors",
      "flooring",
      "painting",
      "plastering",
    ].every((wa) => coverageDoc.includes(wa))
);
check(
  34,
  "Retaining Wall gap analysis section present",
  coverageDoc.includes("Retaining Wall") && coverageDoc.includes("HARD_MINIMUM")
);
check(
  35,
  "Deck reference assessment present",
  coverageDoc.includes("Deck") &&
    (coverageDoc.includes("MATURE / CONDITIONAL") ||
      coverageDoc.includes("## Deck"))
);
check(
  36,
  "Coverage distinguishes CURRENT IMPLEMENTATION vs KNOWN DEFECT",
  coverageDoc.includes("CURRENT IMPLEMENTATION") &&
    coverageDoc.includes("KNOWN DEFECT / RISK") &&
    coverageDoc.includes("TARGET ARCHITECTURE") &&
    coverageDoc.includes("FUTURE CAPABILITY")
);
check(
  37,
  "Retaining Wall classified MINIMAL / ACTIVE RISK",
  coverageDoc.includes("MINIMAL / ACTIVE RISK") &&
    coverageDoc.includes("ACTIVE ESTIMATING RISK") &&
    coverageDoc.includes("assumedValue: 10") === false &&
    coverageDoc.includes("10 m") &&
    coverageDoc.includes("1.5 m")
);
check(
  38,
  "Backfill integrity defect recorded",
  coverageDoc.includes("DISCLOSURE / CALCULATION INTEGRITY DEFECT") &&
    coverageDoc.includes("does not drive the priced quantity")
);
check(
  39,
  "post_spacing_m is NOT_CURRENTLY_CONSUMED not ADVANCED",
  coverageDoc.includes("post_spacing_m") &&
    coverageDoc.includes("NOT_CURRENTLY_CONSUMED") &&
    !coverageDoc.includes("post_spacing_m` is ADVANCED")
);
check(
  40,
  "Kitchen resolver defect and consumed-fact contract recorded",
  coverageDoc.includes("KITCHEN-RATE-AUTHORITY-01") &&
    coverageDoc.includes("CONSUMED-FACT-CONTRACT-01") &&
    coverageDoc.includes("ATTENTION-SEMANTICS-01")
);
check(
  41,
  "Display band separated from estimator maturity",
  coverageDoc.includes("PRODUCT / DISPLAY BAND") &&
    coverageDoc.includes("estimator maturity")
);
check(
  42,
  "Expansion order is RW then bathroom then external stairs",
  coverageDoc.includes("retaining_wall") &&
    coverageDoc.indexOf("**retaining_wall**") <
      coverageDoc.indexOf("**bathroom**") &&
    coverageDoc.indexOf("**bathroom**") <
      coverageDoc.indexOf("**external_stairs**")
);

console.log("\n--- FOUNDATION-EXPANSION-0 SUMMARY ---");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

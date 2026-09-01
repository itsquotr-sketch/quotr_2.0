/**
 * UX-PREMIUM-01 — structural UX contracts.
 *
 * Does not prove aesthetics. Protects layout/behaviour contracts that
 * premium UI must not regress.
 *
 * Run: npx tsx scripts/verify-ux-premium-01.ts
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

const jobPlanPanel = read("components/assistant/job-plan/JobPlanPanel.tsx");
const jobPlanCard = read("components/assistant/job-plan/JobPlanWorkAreaCard.tsx");
const clarifyPanel = read("components/assistant/clarify/ClarifyPanel.tsx");
const refinePanel = read("components/assistant/clarify/ClarifyReadiness.tsx");
const shell = read("components/assistant/AssistantShell.tsx");
const estimatePanel = read("components/assistant/EstimatePanel.tsx");
const estimateReady = read("components/assistant/EstimateReadyCard.tsx");
const builderReview = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
const editJob = read("components/assistant/mode/EditJobSurface.tsx");
const quickEstimateVm = read("lib/assistant/presentation/quick-estimate-view-model.ts");
const actionFooter = read("components/ui/action-footer.tsx");
const button = read("components/ui/button.tsx");
const premium = read("lib/ui/premium.ts");
const globals = read("app/globals.css");
const clarifyCompose = read("lib/assistant/clarify/compose.ts");
const retainingCalc = read("lib/estimate/calculators/retaining-wall.ts");
const rates = read("lib/estimate/rates.ts");

const surfaces = [
  jobPlanPanel,
  jobPlanCard,
  clarifyPanel,
  refinePanel,
  estimatePanel,
  estimateReady,
  builderReview,
  editJob,
  read("components/assistant/ProjectCaptureBlock.tsx"),
  read("components/pricing/PricingHeader.tsx"),
  read("components/quotes/QuoteHeader.tsx"),
].join("\n");

console.log("\n== UX-PREMIUM-01 STRUCTURAL CONTRACTS ==\n");

check(
  1,
  "Refine has no nested More Detail gate",
  !refinePanel.includes("More detail") &&
    !refinePanel.includes("data-refine-advanced-toggle") &&
    refinePanel.includes("[...view.highValue, ...view.advanced]") &&
    refinePanel.includes('data-refine-all-visible="true"')
);

check(
  2,
  "No generic items need attention copy",
  !quickEstimateVm.includes("items need attention") &&
    !surfaces.includes("items need attention")
);

check(
  3,
  "Estimate Basis desktop expanded / mobile collapsed",
  shell.includes("matchMedia") &&
    shell.includes("(min-width: 1024px)") &&
    shell.includes("return false;")
);

check(
  4,
  "Centre Estimate Ready owns sell hero; compact Commercial omits sell duplicate",
  estimateReady.includes("recommendedSell") &&
    estimatePanel.includes("compactCommercialSidebar") &&
    estimatePanel.includes("!compactCommercialSidebar") &&
    estimatePanel.includes('data-compact-commercial-summary="true"')
);

check(
  5,
  "Mobile hides Commercial Overview sidebar",
  shell.includes("hidden lg:block") &&
    shell.includes('assistantMode === "estimate_ready"')
);

check(
  6,
  "Edit Job primary sections remain simplified",
  editJob.includes('title="Work Areas"') &&
    editJob.includes('title="Site & Project Conditions"') &&
    editJob.includes('title="Additional Details"') &&
    editJob.includes("advanced = null") &&
    editJob.includes("{advanced ?") &&
    editJob.includes("General Edit Job starts compact")
);

check(
  7,
  "Targeted edit routing preserved",
  shell.includes("openEditJob") &&
    shell.includes("MATERIAL_SPEC") &&
    shell.includes("specFactKey") &&
    shell.includes("refineAfterEstimateFocusKey") &&
    refinePanel.includes("data-refine-field") &&
    refinePanel.includes("focusKey")
);

check(
  8,
  "Non-commercial takeoff still has no money",
  builderReview.includes('data-commercial="false"') &&
    builderReview.includes('data-takeoff-affects-money="false"')
);

check(
  9,
  "Improve section hidden when empty",
  builderReview.includes("view.improvements.length > 0")
);

check(
  10,
  "Unsupported Retaining Wall readiness unchanged",
  clarifyCompose.includes("unsupported retaining wall material") &&
    retainingCalc.includes('return "unsupported"') &&
    !retainingCalc.includes("from \"@/lib/ui/premium\"") &&
    !rates.includes("from \"@/lib/ui/premium\"")
);

check(
  11,
  "No internal architecture terms leaked in key surfaces",
  [
    "requirement envelope",
    "consumedByCalculator",
    "fact key",
    "component key",
    "rate eligibility",
    "shadow requirement",
  ].every((term) => !surfaces.toLowerCase().includes(term.toLowerCase()))
);

check(
  12,
  "Primary/secondary actions use canonical components/styles",
  button.includes("bg-[var(--brand-orange)]") &&
    button.includes('touch:') &&
    actionFooter.includes('data-action-footer="true"') &&
    actionFooter.includes("flex flex-wrap items-center gap-2") &&
    jobPlanPanel.includes("flex flex-wrap items-center gap-2") &&
    jobPlanPanel.includes("min-h-11 flex-1") &&
    clarifyPanel.includes("data-clarify-estimate-assumptions") &&
    clarifyPanel.includes("min-h-11 w-full") &&
    (clarifyPanel.includes("ActionFooter") ||
      refinePanel.includes("ActionFooter"))
);

check(
  13,
  "Shared design tokens exist",
  exists("lib/ui/premium.ts") &&
    globals.includes("--quotr-page-pad") &&
    globals.includes("--quotr-action-gap") &&
    premium.includes("actionGap") &&
    premium.includes("eyebrow") &&
    globals.includes("prefers-reduced-motion")
);

check(
  14,
  "Job Plan Included/Check/Not included uses icon + label (not colour only)",
  jobPlanCard.includes("CircleHelp") &&
    jobPlanCard.includes("Not included") &&
    jobPlanCard.includes("Check") &&
    jobPlanCard.includes("sr-only")
);

check(
  15,
  "Ready copy and Refine grouping contracts",
  refinePanel.includes("All required details resolved") &&
    refinePanel.includes("data-refine-work-area") &&
    refinePanel.includes("data-refine-group") &&
    refinePanel.includes("data-refine-focus-context")
);

check(
  16,
  "Labour effort remains hours, not duration",
  estimatePanel.includes("Labour effort") &&
    estimatePanel.includes("hrs") &&
    !estimatePanel.includes("Duration") &&
    !estimatePanel.includes("Project hours") &&
    builderReview.includes("labour-hours")
);

check(
  17,
  "Pricing Required is not shown as $0 / free",
  builderReview.includes("Needs a trusted price") &&
    builderReview.includes("PRICING_REQUIRED")
);

check(
  18,
  "Shared primitives present",
  exists("components/ui/action-footer.tsx") &&
    exists("components/ui/metric-row.tsx") &&
    exists("components/ui/section-eyebrow.tsx") &&
    exists("components/ui/status-pill.tsx") &&
    exists("components/ui/disclosure-header.tsx") &&
    exists("components/ui/estimate-category-header.tsx")
);

check(
  19,
  "Quote customer preview is visually distinct",
  read("components/quotes/QuoteWorkspace.tsx").includes(
    'data-quote-customer-preview="true"'
  )
);

check(
  20,
  "Commercial Overview CTA remains Continue to Pricing",
  estimatePanel.includes("continueToPricing") &&
    estimatePanel.includes("Commercial Overview")
);

console.log(`\n${"=".repeat(60)}`);
console.log(`UX-PREMIUM-01 Verifier: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ${FAIL} ${f}`);
  }
  process.exit(1);
}
console.log("All checks passed. ✅");
process.exit(0);

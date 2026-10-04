/**
 * UX-01C.1 — Capture stays ahead of commercial summaries.
 *
 * Run: npx tsx scripts/verify-ux-01c1-capture-priority.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectEstimateOverview } from "../lib/assistant/presentation/estimate-overview";

const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8").replace(/\r/g, "");
}

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

const shell = read("components/assistant/AssistantShell.tsx");
const overview = read("components/assistant/mode/EstimateOverview.tsx");
const capture = read("components/assistant/ProjectCaptureBlock.tsx");
const strip = read("components/projects/ProjectWorkflowStrip.tsx");
const stepper = read("components/assistant/StepperNav.tsx");
const actions = read("lib/assistant/actions.ts");
const page = read("app/(protected)/app/projects/[projectId]/page.tsx");

const overviewMount = shell.indexOf("<EstimateOverview");
const estimateReadyMount = shell.lastIndexOf(
  'assistantMode === "estimate_ready" && estimate',
  overviewMount
);

check(
  "1 no Estimate overview before an estimate exists",
  overviewMount > 0 &&
    estimateReadyMount > 0 &&
    estimateReadyMount < overviewMount &&
    !/assistantMode === "planning" && !estimate[\s\S]{0,240}<EstimateOverview/.test(shell) &&
    overview.includes('sell.presentation !== "hidden"') &&
    !overview.includes("No estimate yet")
);

check(
  "2 no empty Required-before-Pricing card",
  overview.includes("const showRequiredList = model.required.length > 0") &&
    overview.includes(") : showRequiredList ? (") &&
    overview.includes("Required before Pricing") &&
    overview.indexOf("showRequiredList ? (") < overview.indexOf("Required before Pricing")
);

check(
  "3 no duplicate Continue-entering-information action",
  !overview.includes("continue_information") &&
    !overview.includes("Continue entering information") &&
    !overview.includes("onContinueInformation") &&
    !shell.includes("onContinueInformation") &&
    !shell.includes("Continue entering information")
);

check(
  "4 Job details remains the active first task",
  shell.includes('? "job-details"') &&
    shell.includes('title="Job details"') &&
    shell.includes('className="order-2 min-w-0 space-y-3 lg:order-none lg:space-y-2.5 overflow-x-hidden"') &&
    shell.indexOf('title="Job details"') > shell.indexOf("data-active-task=") &&
    !shell.includes("order-1 min-w-0")
);

const captureSurface = read("components/assistant/mode/PlanningSurface.tsx");
check(
  "4 planning surface still opens on Job details",
  captureSurface.includes('data-assistant-surface="planning"') &&
    shell.includes("<PlanningSurface>") &&
    shell.indexOf("<PlanningSurface>") < shell.indexOf('title="Job details"')
);

const analyseHandler = shell.slice(
  shell.indexOf("const handleAnalyseJob"),
  shell.indexOf("const handleWorkAreasConfirm")
);
check(
  "5 Analyse job still invokes the existing action",
  capture.includes("Analyse job") &&
    capture.includes("onClick={onAnalyse}") &&
    capture.includes("<AnalysisProgressBanner") &&
    shell.includes("onAnalyse={briefSubmitted ? undefined : handleAnalyseJob}") &&
    analyseHandler.includes("saveBriefAndSeedWorkAreas(project.id, briefText)") &&
    !analyseHandler.includes("router.push") &&
    !analyseHandler.includes("redirect(") &&
    actions.includes("export async function saveBriefAndSeedWorkAreas")
);

check(
  "6 completed Estimate overview remains present",
  shell.includes("<EstimateOverview") &&
    shell.includes("onReviewEstimate={() => {") &&
    shell.includes("setBuilderReviewOpen(true)") &&
    overview.includes("Estimate ready") &&
    overview.includes("data-estimate-missing-prices") &&
    overview.includes('data-estimate-overview-disclosure') &&
    overview.includes('marker="assumptions"') &&
    overview.includes('marker="benchmark"') &&
    overview.includes('data-estimate-overview-primary="continue_pricing"') &&
    overview.includes("Pricing Required") &&
    overview.includes("data-estimate-missing-prices")
);

check(
  "7 guidance follows the active task and capture does not lead with it",
  shell.includes('assistantMode === "planning" && briefSubmitted ? (') &&
    shell.includes('className="order-3 min-w-0 lg:order-none lg:self-start"') &&
    shell.includes('data-estimate-guidance="after-active-task"') &&
    shell.includes('!briefSubmitted &&') &&
    shell.includes('xl:grid-cols-[200px_minmax(0,1fr)]')
);

check(
  "8 workflow strip stays orientation for the current step",
  strip.includes("stage.href && !stage.viewing") &&
    strip.includes('aria-current={stage.viewing ? "page" : undefined}') &&
    strip.includes('data-workflow-current-action={stage.viewing ? "false" : undefined}') &&
    strip.includes("Unavailable.") &&
    strip.includes("Define the job") &&
    strip.includes("min-h-11") &&
    strip.includes("overflow-x-hidden") &&
    !strip.includes("Analyse job") &&
    !strip.includes("Continue entering information") &&
    stepper.includes('{ key: "brief", label: "Job details" }') &&
    stepper.includes('{ key: "confirm_work_areas", label: "Work" }') &&
    stepper.includes('{ key: "quality", label: "Details" }') &&
    stepper.includes('{ key: "estimate_ready", label: "Estimate" }')
);

const none = projectEstimateOverview({
  hasEstimate: false,
  isStale: false,
  detailsOutstanding: false,
  estimate: null,
  gstRate: null,
  breakdown: null,
  review: null,
  readinessBlockers: [],
  rateSourceSummary: null,
  pricingDocumentExists: false,
  specialistPricingNotice: null,
  workAreaNames: [],
});
check(
  "9 capture and analysis rules stay in the existing model",
  none.primary === "continue_information" &&
    none.sell.presentation === "hidden" &&
    none.requiredCount === 0 &&
    none.pricingCreationBlocked &&
    page.includes('measureServerLoad("project"') &&
    page.includes("getAssistantStateWithContext") &&
    !/supabase|\.from\(|fetch\(/.test(overview + strip)
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nUX-01C.1 capture priority checks passed");

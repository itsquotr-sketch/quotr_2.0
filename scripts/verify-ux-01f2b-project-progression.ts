/**
 * UX-01F.2b — project progression header and workspace spacing.
 *
 * Run: npx tsx scripts/verify-ux-01f2b-project-progression.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}`);
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

const header = read("components/projects/ProjectSectionHeader.tsx");
const workspacePage = read("components/layout/workspace-page.tsx");
const information = read("components/projects/information/ProjectInformationWorkspace.tsx");
const captured = read("components/projects/information/CapturedDetails.tsx");
const shell = read("components/assistant/AssistantShell.tsx");
const orientation = read("lib/projects/workflow-orientation.ts");
const railStart = header.indexOf('data-project-progression="rail"');
const railEnd = header.indexOf('data-project-variations-row');
const rail = header.slice(railStart, railEnd);
const mobile = header.slice(header.indexOf("lg:hidden"));

const stageOrder = ["Project information", "Estimate", "Pricing", "Quote"].map((title) =>
  rail.indexOf(`title="${title}"`)
);
check(
  "1 exactly four primary desktop stages in order",
  stageOrder.every((index) => index >= 0) &&
    stageOrder.every((index, position) => position === 0 || index > stageOrder[position - 1]) &&
    rail.includes('step="1"') &&
    rail.includes('step="2"') &&
    rail.includes('step="3"') &&
    rail.includes('step="4"') &&
    rail.includes("lg:grid-cols-4") &&
    !rail.includes('title="Variations"') &&
    (rail.match(/<Stage/g) ?? []).length === 4
);
check(
  "2 stages share one equal-height structure",
  header.includes("function Stage(") &&
    header.includes("flex h-full min-w-0 flex-col") &&
    rail.includes('data-project-section-columns="four"')
);
check(
  "3 active state is neutral and visible without colour alone",
  header.includes("border-foreground/70 bg-muted/60") &&
    header.includes(">Current</span>") &&
    header.includes('aria-current={current ? "page" : undefined}') &&
    !header.includes("color-mix(in_oklch,var(--brand-orange)") &&
    !header.includes("bg-[color-mix") &&
    !header.includes("shadow-[inset_3px_0_0_0_var(--brand-orange)]") &&
    !header.includes("border-[var(--brand-orange)] bg-[")
);
check(
  "4 locked stages are not links",
  header.includes('data-project-column-locked={href == null && !current ? "true" : undefined}') &&
    header.includes("<p") &&
    !header.includes("overflow-x-auto")
);
check(
  "5 Variations stays outside the Quote stage",
  railEnd > railStart &&
    header.includes('data-project-variations-row') &&
    header.includes("Separate from Quote") &&
    header.includes('data-variations-nav={column === "variations" ? "true" : undefined}') &&
    header.includes("compact")
);
check(
  "6 mobile uses the selector",
  header.includes("hidden lg:block") &&
    mobile.includes("lg:hidden") &&
    mobile.includes('aria-label="Project section"') &&
    mobile.includes("data-project-section-select") &&
    mobile.includes("data-project-stage-current") &&
    mobile.includes("data-quote-variations-control") &&
    mobile.includes("min-h-11") &&
    mobile.includes("text-base") &&
    !mobile.includes("lg:grid-cols-4")
);
check(
  "7 Captured details uses the shared information card",
  information.includes("Captured details and Work Areas") &&
    information.includes("data-project-information-card") &&
    information.includes('const informationCardClass = "min-w-0 rounded-xl border border-border bg-card px-4 py-3"') &&
    !information.includes('tone="quiet"') &&
    !information.includes("bg-muted/30 px-4 py-3") &&
    captured.includes('data-captured-disclosure="neutral"') &&
    captured.includes("divide-y divide-border/60") &&
    !captured.includes("bg-[var(--brand-orange)]")
);
check(
  "8 Project Information and Estimate share one header gap",
  workspacePage.includes("pt-4 pb-6 lg:pt-6") &&
    workspacePage.includes('data-workspace-content-gap="progression"') &&
    !workspacePage.includes("lg:pt-8") &&
    !workspacePage.includes("-mt-") &&
    information.includes('className="mt-4 grid gap-3"') &&
    shell.includes('data-estimate-content-gap="12-16"') &&
    shell.includes('className="min-w-0 space-y-3 overflow-x-hidden"') &&
    shell.includes('"grid min-w-0 gap-5 lg:items-start"') &&
    !shell.includes('"mt-1 grid min-w-0 gap-5 lg:mt-4')
);
check(
  "9 every Estimate view uses that same content gap",
  shell.includes('data-estimate-view={estimateView}') &&
    shell.includes('estimateView === "work_areas"') &&
    shell.includes('estimateView === "materials"') &&
    shell.includes('estimateView === "labour"') &&
    shell.includes('estimateView === "checks"') &&
    shell.includes("<EstimateOverview") &&
    shell.includes("<EstimateViewControl")
);
check(
  "10 routes and lifecycle authority are unchanged",
  header.includes("deriveProjectWorkflow") &&
    header.includes("estimateStatusText") &&
    header.includes("pricingLockReason") &&
    header.includes("variationsLockReason") &&
    orientation.includes("function deriveProjectWorkflow") &&
    !header.includes("createPricingFromEstimate")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

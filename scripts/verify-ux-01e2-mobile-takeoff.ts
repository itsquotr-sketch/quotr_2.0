/**
 * UX-01E.2 — Mobile estimate navigation and compact takeoff rows.
 *
 * Run: npx tsx scripts/verify-ux-01e2-mobile-takeoff.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8").replace(/\r/g, "");
}

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

const control = read("components/assistant/mode/WorkAreaBreakdown.tsx");
const takeoff = read("components/assistant/mode/EstimateTakeoffViews.tsx");
const shell = read("components/assistant/AssistantShell.tsx");
const projector = read("lib/assistant/presentation/estimate-takeoffs.ts");

const selectBlock = control.slice(
  control.indexOf("data-estimate-view-select"),
  control.indexOf("data-estimate-view-scroll")
);
const tabBlock = control.slice(
  control.indexOf("data-estimate-view-scroll"),
  control.indexOf("data-estimate-view-tab")
);

check(
  "1 mobile dropdown replaces the tabs",
  selectBlock.includes("md:hidden") &&
    selectBlock.includes("Estimate view") &&
    selectBlock.includes("data-estimate-view-dropdown") &&
    selectBlock.includes('id: "overview"') === false &&
    control.includes('id: "overview", label: "Overview"') &&
    control.includes('id: "materials", label: "Materials takeoff"') &&
    control.includes('id: "labour", label: "Labour takeoff"') &&
    control.includes('id: "checks", label: "Assumptions & checks"')
);

check(
  "2 desktop tabs remain",
  tabBlock.includes("hidden") &&
    tabBlock.includes("md:flex") &&
    control.includes("data-estimate-view-tab={item.id}") &&
    control.includes('role="tablist"')
);

check(
  "3 mobile selector changes the existing local view",
  selectBlock.includes("onChange(event.target.value as EstimatePresentationView)") &&
    shell.includes("onChange={setEstimateView}") &&
    !selectBlock.includes("router.refresh") &&
    !selectBlock.includes("fetch(")
);

check(
  "4 no mobile horizontal tab scroller remains",
  tabBlock.includes("hidden") &&
    tabBlock.includes("md:flex") &&
    selectBlock.includes("md:hidden") &&
    !selectBlock.includes("overflow-x-auto")
);

check(
  "5 material and labour rows start collapsed",
  takeoff.includes("useState<ReadonlySet<string>>(() => new Set())") &&
    takeoff.includes('data-takeoff-open={open ? "true" : "false"}') &&
    takeoff.includes("data-takeoff-compact={row.id}") &&
    takeoff.includes('className="lg:hidden"')
);

check(
  "6 collapsed rows keep identity, quantity or hours, and cost",
  takeoff.includes("row.product ?? row.description") &&
    takeoff.includes("row.activity ?? row.description") &&
    takeoff.includes("Worker type not specified") &&
    takeoff.includes("row.pricedUsing") &&
    takeoff.includes("quantity") &&
    takeoff.includes("labourSummary") &&
    takeoff.includes("Pricing Required")
);

check(
  "7 expanded rows keep the stored detail",
  takeoff.includes('label="Work Area"') &&
    takeoff.includes('label="Specification"') &&
    takeoff.includes('label="Unit cost"') &&
    takeoff.includes('label="Productivity basis"') &&
    takeoff.includes('label="Productivity source"') &&
    takeoff.includes('label="Hourly cost"') &&
    takeoff.includes('label="Hourly-rate source"') &&
    takeoff.includes('label="Pricing basis"')
);

check(
  "8 disclosure controls expose aria-expanded",
  takeoff.includes("aria-expanded={open}") &&
    takeoff.includes("aria-controls={panelId}") &&
    takeoff.includes('View details"} for') &&
    takeoff.includes("Hide details") &&
    control.includes("aria-expanded={open}") &&
    control.includes("View breakdown")
);

check(
  "9 no value is recalculated and Pricing Required is not $0",
  !projector.includes("quantity * ") &&
    !projector.includes("costRate *") &&
    !takeoff.includes('"$0"') &&
    takeoff.includes("moneyCell(row, row.total)") &&
    projector.includes('return "Pricing Required"')
);

check(
  "10 minimum control and font-size rules",
  selectBlock.includes("min-h-11") &&
    selectBlock.includes("text-base") &&
    takeoff.includes("text-base") &&
    takeoff.includes("min-h-11") &&
    takeoff.includes("text-xs leading-4") &&
    takeoff.includes("text-sm leading-5") &&
    !takeoff.includes("text-[10px]") &&
    !takeoff.includes("text-[11px]")
);

check(
  "11 desktop tables remain",
  takeoff.includes("lg:grid") &&
    takeoff.includes("lg:contents") &&
    takeoff.includes("data-takeoff-desktop") &&
    !takeoff.includes("<table") &&
    control.includes("hidden") &&
    control.includes("lg:flex")
);

check(
  "12 no new query, route or server action",
  !/fetch\(|router\.refresh|revalidatePath|supabase|\.from\(/.test(takeoff + control) &&
    shell.includes('className="min-w-0 space-y-3 overflow-x-hidden"')
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nUX-01E.2 mobile takeoff passed");

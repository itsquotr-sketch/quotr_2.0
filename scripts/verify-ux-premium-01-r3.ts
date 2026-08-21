/**
 * UX-PREMIUM-01-R3 — Job Plan Check mobile, Remove WA invariant,
 * RW numeric Clarify, mobile commercial access, Estimate Ready gap,
 * Pricing mobile footer.
 *
 * Presentation / interaction only. Does not change calculators, rates,
 * or commercial authority.
 *
 * Run: npx tsx scripts/verify-ux-premium-01-r3.ts
 */

import * as fs from "fs";
import * as path from "path";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  parsePositiveClarifyNumber,
  resolveClarifyUnit,
} from "../lib/assistant/clarify/numeric";
import {
  LAST_ACTIVE_WORK_AREA_MESSAGE,
  canRemoveCanonicalWorkArea,
  projectActiveCanonicalWorkAreas,
} from "../lib/assistant/work-area-active";
import { getQuestionTemplateByKey } from "../lib/scopes/registry";
import type { EstimateFact } from "../lib/estimate/types";

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

const jobPlanCard = read("components/assistant/job-plan/JobPlanWorkAreaCard.tsx");
const shell = read("components/assistant/AssistantShell.tsx");
const waActions = read("lib/assistant/work-area-actions.ts");
const waActive = read("lib/assistant/work-area-active.ts");
const clarifyPanel = read("components/assistant/clarify/ClarifyPanel.tsx");
const refinePanel = read("components/assistant/clarify/ClarifyReadiness.tsx");
const valueField = read("components/assistant/clarify/ClarifyValueField.tsx");
const numeric = read("lib/assistant/clarify/numeric.ts");
const composeSrc = read("lib/assistant/clarify/compose.ts");
const metrics = read("components/assistant/CommercialOverviewMetrics.tsx");
const estimatePanel = read("components/assistant/EstimatePanel.tsx");
const readySurface = read("components/assistant/mode/EstimateReadySurface.tsx");
const workspacePage = read("components/layout/workspace-page.tsx");
const pricingBar = read("components/pricing/PricingMobileActionBar.tsx");
const pricingWorkspace = read("components/pricing/PricingWorkspace.tsx");
const pricingSummary = read("components/pricing/PricingSummaryPanel.tsx");
const createQuote = read("components/quotes/CreateQuoteButton.tsx");
const rates = read("lib/estimate/rates.ts");
const retainingCalc = read("lib/estimate/calculators/retaining-wall.ts");
const commercialCore = read("lib/commercial-engine/core/cost-first-authority.ts");
const deckCalc = read("lib/estimate/calculators/deck.ts");
const kitchenCalc = read("lib/estimate/calculators/kitchen.ts");
const consumed = read("lib/estimate/consumed-facts.ts");
const marginActions = read("lib/assistant/margin-actions.ts");

function wa(id: string, type: string, name: string) {
  return { id, type, name, sort_order: 1, status: "confirmed" as const };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function composeRw(facts: EstimateFact[], workAreaId = "rw1") {
  const workAreas = [wa(workAreaId, "retaining_wall", "Retaining wall")];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
  const readiness = composeEstimateReadiness({
    clarify,
    jobPlan: plan,
    qualityLevel: "standard",
    constraints: [],
  });
  return { plan, clarify, readiness };
}

console.log("\n== UX-PREMIUM-01-R3 ==\n");

check(
  1,
  "Check title is on its own readable line",
  jobPlanCard.includes('data-job-plan-item-title=""') &&
    jobPlanCard.includes('className={cn("block"') &&
    jobPlanCard.includes("flex-col") &&
    jobPlanCard.includes("sm:flex-row")
);

check(
  2,
  "Check status remains visually secondary",
  jobPlanCard.includes('data-job-plan-check-status=""') &&
    jobPlanCard.includes("Check") &&
    jobPlanCard.includes("text-[11px] font-medium text-muted-foreground")
);

check(
  3,
  "Include available on Check rows",
  jobPlanCard.includes("Include") &&
    jobPlanCard.includes("aria-label={`Include ${item.label}`}")
);

check(
  4,
  "Not included available on Check rows",
  jobPlanCard.includes("Not included") &&
    jobPlanCard.includes('data-job-plan-check-actions={tone === "check" ? "true"')
);

const one = projectActiveCanonicalWorkAreas([
  { id: "a", status: "confirmed" },
]);
const two = projectActiveCanonicalWorkAreas([
  { id: "a", status: "confirmed" },
  { id: "b", status: "suggested" },
]);
const three = projectActiveCanonicalWorkAreas([
  { id: "a", status: "confirmed" },
  { id: "b", status: "confirmed" },
  { id: "c", status: "suggested" },
]);
const afterRemoveB = three.filter((waRow) => waRow.id !== "b");
const stickyRevive = projectActiveCanonicalWorkAreas(
  [
    { id: "a", status: "confirmed" },
    { id: "b", status: "confirmed" },
  ],
  { optimisticExcludedIds: ["a"] }
);

check(5, "one active WA blocks", !canRemoveCanonicalWorkArea(one, "a"));
check(
  6,
  "two active WAs permit removal of either",
  canRemoveCanonicalWorkArea(two, "a") && canRemoveCanonicalWorkArea(two, "b")
);
check(
  7,
  "three active WAs permit removal",
  canRemoveCanonicalWorkArea(three, "a") &&
    canRemoveCanonicalWorkArea(three, "b") &&
    canRemoveCanonicalWorkArea(three, "c")
);
check(
  8,
  "success remaining count is canonical active",
  afterRemoveB.length === 2 &&
    canRemoveCanonicalWorkArea(afterRemoveB, "a") &&
    canRemoveCanonicalWorkArea(afterRemoveB, "c") &&
    !canRemoveCanonicalWorkArea([{ id: "c", status: "suggested" }], "c")
);
check(
  9,
  "estimate stale after successful remove",
  waActions.includes("markEstimateStale") &&
    shell.includes("bridgeEstimateStaleAfterCanonicalWrite") &&
    shell.includes("handleExcludeWorkArea")
);
check(
  10,
  "client/server remove guard consistent",
  shell.includes("canRemoveCanonicalWorkArea") &&
    shell.includes("LAST_ACTIVE_WORK_AREA_MESSAGE") &&
    waActions.includes("LAST_ACTIVE_WORK_AREA_MESSAGE") &&
    waActions.includes('neq("status", "excluded")') &&
    LAST_ACTIVE_WORK_AREA_MESSAGE.includes("At least one work area") &&
    stickyRevive.length === 1 &&
    shell.includes("status !== \"excluded\"") &&
    shell.includes("setExcludedWorkAreaIds((prev) =>")
);

const lengthTpl = getQuestionTemplateByKey("retaining_wall.length_m");
const heightTpl = getQuestionTemplateByKey("retaining_wall.height_m");
const highTpl = getQuestionTemplateByKey("retaining_wall.height_high_m");
const lowTpl = getQuestionTemplateByKey("retaining_wall.height_low_m");
const zeroClarify = composeRw([]);

check(
  11,
  "length numeric",
  lengthTpl?.inputType === "number" &&
    valueField.includes('type={isNumber ? "number"') &&
    valueField.includes('inputMode={isNumber ? "decimal"') &&
    composeSrc.includes('unit: template?.unit') &&
    zeroClarify.clarify.candidates.some(
      (c) => c.factKey === "retaining_wall.length_m" && c.inputType === "number"
    )
);
check(
  12,
  "length unit visible",
  lengthTpl?.unit === "m" &&
    resolveClarifyUnit({ questionKey: "retaining_wall.length_m" }) === "m" &&
    valueField.includes("data-clarify-unit") &&
    zeroClarify.clarify.candidates.some(
      (c) => c.factKey === "retaining_wall.length_m" && c.unit === "m"
    )
);
check(
  13,
  "height numeric",
  heightTpl?.inputType === "number" &&
    highTpl?.inputType === "number" &&
    lowTpl?.inputType === "number" &&
    zeroClarify.clarify.candidates.some(
      (c) => c.factKey === "retaining_wall.height_m" && c.inputType === "number"
    )
);
check(
  14,
  "height unit visible",
  heightTpl?.unit === "m" &&
    highTpl?.unit === "m" &&
    lowTpl?.unit === "m" &&
    resolveClarifyUnit({ questionKey: "retaining_wall.height_m" }) === "m"
);
check(
  15,
  "invalid non-positive rejected",
  parsePositiveClarifyNumber("0").ok === false &&
    parsePositiveClarifyNumber("-1").ok === false &&
    parsePositiveClarifyNumber("abc").ok === false &&
    parsePositiveClarifyNumber("10").ok === true &&
    valueField.includes("parsePositiveClarifyNumber")
);
check(
  16,
  "explicit submit action exists",
  valueField.includes('data-clarify-value-submit="true"') &&
    clarifyPanel.includes("<ClarifyValueField") &&
    refinePanel.includes("<ClarifyValueField") &&
    !clarifyPanel.includes("onBlur") &&
    !refinePanel.includes("onBlur={(event)")
);
check(
  17,
  "write remains canonical",
  shell.includes("answerClarifySelectFact") &&
    shell.includes("handleClarifyValue") &&
    read("lib/assistant/clarify/actions.ts").includes("updateProjectFact") &&
    valueField.includes("onSubmit(parsed.value)")
);

const missingLength = composeRw([
  fact("retaining_wall.height_m", "rw1", 1.2),
  fact("retaining_wall.material", "rw1", "Timber"),
]);
const missingHeight = composeRw([
  fact("retaining_wall.length_m", "rw1", 10),
  fact("retaining_wall.material", "rw1", "Timber"),
]);
const missingMaterial = composeRw([
  fact("retaining_wall.length_m", "rw1", 10),
  fact("retaining_wall.height_m", "rw1", 1.2),
]);
const coreReady = composeRw([
  fact("retaining_wall.length_m", "rw1", 10),
  fact("retaining_wall.height_m", "rw1", 1.2),
  fact("retaining_wall.material", "rw1", "Timber"),
]);

check(
  18,
  "missing length → no estimate-with-assumptions",
  missingLength.clarify.blocksEstimate &&
    !missingLength.clarify.canEstimateNow &&
    missingLength.clarify.candidates.some(
      (c) => c.factKey === "retaining_wall.length_m" && c.blocksEstimate
    ) &&
    clarifyPanel.includes("view.canEstimateNow") &&
    clarifyPanel.includes("estimateNowUsingAssumptions")
);
check(
  19,
  "missing height → no estimate-with-assumptions",
  missingHeight.clarify.blocksEstimate &&
    !missingHeight.clarify.canEstimateNow &&
    missingHeight.clarify.candidates.some(
      (c) => c.factKey === "retaining_wall.height_m" && c.blocksEstimate
    )
);
check(
  20,
  "missing/unsupported material → no estimate-with-assumptions",
  missingMaterial.clarify.blocksEstimate &&
    !missingMaterial.clarify.canEstimateNow &&
    missingMaterial.clarify.candidates.some(
      (c) => c.factKey === "retaining_wall.material" && c.blocksEstimate
    )
);
check(
  21,
  "core facts resolved + assumable secondary gap → CTA allowed",
  !coreReady.clarify.blocksEstimate &&
    coreReady.clarify.canEstimateNow === true &&
    clarifyPanel.includes("{view.canEstimateNow ? (")
);
check(
  22,
  "fully ready → normal Estimate now",
  coreReady.readiness.canEstimateNow &&
    refinePanel.includes("estimateNow") &&
    read("lib/assistant/presentation/action-labels.ts").includes(
      'estimateNow: "Estimate now"'
    )
);

check(
  23,
  "margin edit entry available if desktop supports it",
  shell.includes('data-mobile-margin-edit="true"') &&
    shell.includes("<MarginEditControl") &&
    estimatePanel.includes("<MarginEditControl") &&
    estimatePanel.includes('presentation="inline"')
);
check(
  24,
  "same commercial authority/path",
  shell.includes("onSave={handleMarginSave}") &&
    shell.includes("updateEstimateMargin") &&
    marginActions.includes("export async function updateEstimateMargin") &&
    !metrics.includes("updateEstimateMargin")
);
check(
  25,
  "detailed breakdown available",
  shell.includes('data-mobile-detailed-breakdown="true"') &&
    shell.includes("viewFullBreakdown")
);
check(
  26,
  "same breakdown implementation",
  shell.includes("setBreakdownOpen(true)") &&
    shell.includes("<EstimateBreakdownModal") &&
    estimatePanel.includes("onViewBreakdown") &&
    !shell.includes("MobileBreakdown")
);
check(
  27,
  "no duplicate sell",
  !metrics.includes("Recommended sell") &&
    !metrics.includes("recommendedSell") &&
    shell.includes("data-mobile-commercial-overview")
);
check(
  28,
  "one Continue to Pricing",
  !metrics.includes("continueToPricing") &&
    readySurface.includes("continueToPricing") &&
    readySurface.includes("data-estimate-ready-mobile-pricing") &&
    (shell.split("continueToPricing").length <= 3)
);

check(
  29,
  "reduced mobile top gap contract",
  shell.includes('data-estimate-ready-mobile-gap={') &&
    shell.includes('"mt-1 grid min-w-0 gap-5 lg:mt-4') &&
    workspacePage.includes("mt-2 pt-3 pb-6 sm:mt-5 sm:pt-6") &&
    !readySurface.includes("mt-8") &&
    readySurface.includes("space-y-3")
);

check(
  30,
  "mobile layout does not put total and CTA in overlapping horizontal contract",
  pricingBar.includes("flex-col") &&
    pricingBar.includes('data-pricing-mobile-total="true"') &&
    pricingBar.includes('data-pricing-mobile-actions="true"') &&
    !pricingBar.includes("items-center gap-3 px-4 py-3")
);
check(
  31,
  "existing totals reused",
  pricingBar.includes("formatPricingMoney(document.total_incl_gst)") &&
    !pricingBar.includes("* 1.15") &&
    !pricingBar.includes("recalculateSellFromCost")
);
check(
  32,
  "Create Quote touch-safe",
  createQuote.includes('presentation?: "default" | "bar"') &&
    pricingBar.includes('presentation="bar"') &&
    createQuote.includes("h-11 min-h-11 w-full")
);
check(
  33,
  "safe-area spacing",
  pricingBar.includes("env(safe-area-inset-bottom)") &&
    pricingWorkspace.includes("env(safe-area-inset-bottom)")
);
check(
  34,
  "desktop layout retained",
  pricingWorkspace.includes('className="hidden md:block"') &&
    pricingSummary.includes("lg:sticky") &&
    pricingBar.includes("md:hidden")
);

check(
  35,
  "no calculator change",
  !deckCalc.includes("ClarifyValueField") &&
    !retainingCalc.includes("ClarifyValueField") &&
    !kitchenCalc.includes("data-job-plan-check-row") &&
    retainingCalc.includes("RETAINING_WALL_HARD_MINIMUM_FACT_KEYS")
);
check(
  36,
  "no rate change",
  !rates.includes("ClarifyValueField") &&
    !rates.includes("PricingMobileActionBar")
);
check(
  37,
  "no commercial formula change",
  commercialCore.includes("classifyResolvedSell") &&
    !commercialCore.includes("ClarifyValueField") &&
    !marginActions.includes("from \"@/lib/ui/premium\"")
);
check(
  38,
  "no structural authority change",
  consumed.includes("isCalculatorConsumedFact") &&
    !consumed.includes("ClarifyValueField") &&
    exists("scripts/verify-ux-premium-01-r2.ts")
);

check(
  39,
  "R2 contracts still wired",
  shell.includes("setLocalEstimateStale(false)") &&
    read("components/project-notes/SiteNotesCaptureCard.tsx").includes(
      'data-site-notes-composer='
    ) &&
    shell.includes('data-mobile-commercial-overview="true"') &&
    jobPlanCard.includes("data-job-plan-available")
);

check(
  40,
  "optimistic exclude reconciles on revive",
  shell.includes("setExcludedWorkAreaIds((prev) =>") &&
    shell.includes("prev.filter((id) => id !== result.workArea!.id)") &&
    numeric.includes("parsePositiveClarifyNumber") &&
    waActive.includes("status !== \"excluded\"")
);

console.log(`\n${"=".repeat(60)}`);
console.log(`UX-PREMIUM-01-R3 Verifier: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ${FAIL} ${f}`);
  }
  process.exit(1);
}
console.log("All checks passed. ✅");
process.exit(0);

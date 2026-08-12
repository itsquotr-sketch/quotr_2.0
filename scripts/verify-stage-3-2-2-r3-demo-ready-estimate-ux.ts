/**
 * Stage 3.2.2-R3 — Demo-ready final Estimate UX verification.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  getCombinedLabourAccessFactor,
  getLabourAdjustmentFactor,
  getWorkAreaAccessFactor,
} from "../lib/estimate/adjustments";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";

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
  return readFileSync(path, "utf8");
}

function main(): void {
  console.log("=== Stage 3.2.2-R3 Demo-Ready Final Estimate UX ===\n");

  const shell = read(join("components", "assistant", "AssistantShell.tsx"));
  const strip = read(
    join("components", "assistant", "EstimateReviewSummaryStrip.tsx")
  );
  const setup = read(
    join("components", "assistant", "CompletedSetupDisclosure.tsx")
  );
  const panel = read(join("components", "assistant", "EstimatePanel.tsx"));
  const banner = read(join("components", "setup", "SetupGuidanceBanner.tsx"));
  const page = read(
    join("app", "(protected)", "app", "projects", "[projectId]", "page.tsx")
  );
  const marginOptimistic = read(
    join("lib", "assistant", "margin-optimistic.ts")
  );
  const marginActions = read(join("lib", "assistant", "margin-actions.ts"));
  const pc = read(
    join("components", "assistant", "ProjectConditionsBlock.tsx")
  );

  check(
    "1 Estimate Review summary appears above Project Setup when estimate exists",
    shell.includes("EstimateReviewSummaryStrip") &&
      shell.includes("CompletedSetupDisclosure") &&
      shell.indexOf("EstimateReviewSummaryStrip") <
        shell.indexOf("<CompletedSetupDisclosure")
  );

  check(
    "2 Empty Estimate Review is compact Clear state",
    strip.includes('data-estimate-review-summary="clear"') &&
      strip.includes("Estimate review") &&
      strip.includes("Clear") &&
      (strip.includes("No outstanding items") ||
        strip.includes("data-estimate-review-overview") ||
        strip.includes("View estimate review"))
  );

  check(
    "3 Actionable review remains visible with Review CTA contract",
    strip.includes('data-estimate-review-summary="attention"') &&
      strip.includes("attentionShowsReviewButton") &&
      strip.includes("Review")
  );

  check(
    "4 Project Setup collapses completed workflow",
    setup.includes("View setup") &&
      shell.includes("compressCompletedSetup") &&
      shell.includes("showCompletedDetailCards")
  );

  check(
    "5 Completed steps remain accessible via setup expand",
    shell.includes("setupReviewOpen") &&
      shell.includes('title="Project Capture"') &&
      shell.includes('title="Work Areas"') &&
      shell.includes('title="Specification"') &&
      shell.includes('title="Scope Details"') &&
      shell.includes('title="Project Conditions"')
  );

  check(
    "6 No duplicated clear Estimate Review inside Project Setup",
    shell.includes("showEstimateReviewFullCard") &&
      !shell.includes('estimateReviewSummaryModel.ready ? "Estimate review clear"')
  );

  check(
    "7 Desktop Quick Estimate remains commercially dominant",
    panel.includes("QUICK_ESTIMATE_STICKY_CLASS") &&
      panel.includes("Recommended sell") &&
      panel.includes("PrepareFinalPricingButton")
  );

  check(
    "8 Mobile Quick Estimate exposes sell/range/cost/margin/confidence",
    panel.includes('data-mobile-qe-body={estimate ? "always"') &&
      panel.includes("Estimate range") &&
      panel.includes('label="Cost"') &&
      panel.includes('label="Margin"') &&
      panel.includes("Estimate confidence")
  );

  check(
    "9 Mobile Prepare final pricing CTA exists",
    panel.includes("PrepareFinalPricingButton") &&
      read(
        join("components", "pricing", "PrepareFinalPricingButton.tsx")
      ).includes('label = "Prepare final pricing"')
  );

  check(
    "10 Mobile Estimate Review visible in completed centre column",
    shell.includes("EstimateReviewSummaryStrip") &&
      shell.includes('order-2')
  );

  check(
    "11 Mobile Project Setup collapsible",
    setup.includes("data-completed-setup-toggle") &&
      setup.includes("View setup")
  );

  check(
    "12 Labour-rate recommendation de-emphasised after estimate",
    banner.includes("Improve future estimates") &&
      banner.includes('data-setup-guidance="compact"') &&
      page.includes("data-post-estimate-guidance") &&
      page.includes("hasEstimate")
  );

  check(
    "13 No duplicate Site Constraints UI when BI active",
    shell.includes("!preferProjectConditionsAsk") &&
      shell.includes('title="Project Conditions"')
  );

  check(
    "14 Project Conditions remains accessible",
    pc.includes("data-project-conditions") &&
      shell.includes("ProjectConditionsBlock")
  );

  check(
    "15 One primary CTA discipline (Prepare final pricing)",
    panel.includes(
      'className="w-full bg-[var(--brand-orange)] text-white hover:bg-[var(--brand-orange)]/90"'
    ) &&
      panel.includes('variant="outline"') &&
      panel.includes("View quote")
  );

  check(
    "16 No commercial formula changes in R3 presentation files",
    !strip.includes("deriveSellFromCost") &&
      !setup.includes("recommendedSell") &&
      !banner.includes("recommendedSell")
  );

  check(
    "17 Margin responsiveness R2 contract preserved",
    marginOptimistic.includes("recalculateSellFromCost") &&
      marginActions.includes("marginTotals") &&
      shell.includes("buildPendingMarginTotals") &&
      shell.includes("marginSaveLockRef")
  );

  const combined = getCombinedLabourAccessFactor({
    constraints: [{ key: "site_access", label: "Access", value: "Difficult" }],
    workAreaAccess: "Restricted / Difficult",
  });
  const constraintOnly = getLabourAdjustmentFactor([
    { key: "site_access", label: "Access", value: "Difficult" },
  ]);
  check(
    "18 Access single-consume preserved",
    combined === constraintOnly &&
      combined <
        constraintOnly *
          getWorkAreaAccessFactor("Restricted / Difficult")
  );

  check(
    "19 No migration",
    !existsSync(join("supabase", "migrations")) ||
      !readdirSync(join("supabase", "migrations")).some((f) =>
        /3[.]?2[.]?2.?r3|interview_answer/i.test(f)
      )
  );

  check(
    "20 No 3.2.3 Work Area interview UI",
    !shell.toLowerCase().includes("work area interview") &&
      !pc.toLowerCase().includes("work area interview")
  );

  check(
    "21 Production Scope Discovery disabled",
    isScopeDiscoveryEnabled({}) === false
  );

  check(
    "22 Company DNA not started",
    !existsSync(join("lib", "company-dna"))
  );

  check(
    "23 Attention routing helpers reused (no second review authority)",
    strip.includes("buildQuickEstimateAttentionItems") === false &&
      strip.includes("attentionShowsReviewButton") &&
      shell.includes("buildQuickEstimateAttentionItems")
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();

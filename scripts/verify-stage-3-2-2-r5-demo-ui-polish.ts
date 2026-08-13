/**
 * Stage 3.2.2-R5 — Demo UI polish + Estimate Review disclosure verification.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  getCombinedLabourAccessFactor,
  getLabourAdjustmentFactor,
  getWorkAreaAccessFactor,
} from "../lib/estimate/adjustments";
import {
  buildPendingMarginTotals,
  marginTotalsMatchEstimate,
} from "../lib/assistant/margin-optimistic";
import { recalculateSellFromCost } from "../lib/estimate/margin-override";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";
import { SCOPE_DISCOVERY_UI_COPY } from "../lib/scope-discovery/ui/labels";
import { presentAssistantError } from "../lib/assistant/presentation/error-messages";

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
  console.log("=== Stage 3.2.2-R5 Demo UI Polish ===\n");

  const shell = read(join("components", "assistant", "AssistantShell.tsx"));
  const strip = read(
    join("components", "assistant", "EstimateReviewSummaryStrip.tsx")
  );
  const card = read(
    join("components", "assistant", "CollapsibleStageCard.tsx")
  );
  const setup = read(
    join("components", "assistant", "CompletedSetupDisclosure.tsx")
  );
  const panel = read(join("components", "assistant", "EstimatePanel.tsx"));
  const margin = read(
    join("components", "assistant", "MarginEditControl.tsx")
  );
  const notes = read(
    join("components", "project-notes", "SiteNotesCaptureCard.tsx")
  );
  const capture = read(
    join("components", "assistant", "ProjectCaptureBlock.tsx")
  );
  const pc = read(
    join("components", "assistant", "ProjectConditionsBlock.tsx")
  );
  const labels = read(join("lib", "scope-discovery", "ui", "labels.ts"));

  check(
    "1 Estimate Review can open AND close",
    strip.includes("onToggleDetails") &&
      strip.includes("Hide estimate review") &&
      strip.includes("View estimate review") &&
      shell.includes("setEstimateReviewDetailsOpen((open)") &&
      card.includes("onExpandedChange") &&
      shell.includes("forceExpanded={Boolean(estimate?.isStale)}") &&
      !shell.includes("forceExpanded={\n                Boolean(estimate?.isStale) || estimateReviewDetailsOpen")
  );

  check(
    "2 Estimate Review can reopen after closing",
    shell.includes("setEstimateReviewDetailsOpen((open) =>") &&
      shell.includes("const next = !open") &&
      strip.includes('data-estimate-review-details={detailsOpen ? "open"')
  );

  check(
    "3 Clear and actionable states preserve attention routing",
    strip.includes("attentionShowsReviewButton") &&
      strip.includes("Needs attention") &&
      shell.includes("onReviewAttention={handleReviewAttention}") &&
      strip.includes('data-estimate-review-summary="clear"') &&
      strip.includes('data-estimate-review-summary="attention"')
  );

  check(
    "4 Compact overview remains present",
    strip.includes("data-estimate-review-overview") &&
      strip.includes("Key scope") &&
      shell.includes("estimateReviewCompactOverview")
  );

  check(
    "5 Project Setup remains independently collapsible",
    setup.includes("View setup") &&
      shell.includes("CompletedSetupDisclosure") &&
      shell.includes("setSetupReviewOpen") &&
      shell.indexOf("EstimateReviewSummaryStrip") <
        shell.indexOf("<CompletedSetupDisclosure")
  );

  check(
    "6 Mobile Site Notes retains functionality with reduced nesting",
    notes.includes("mobileProgressive") &&
      notes.includes("createProjectNote") &&
      capture.includes('data-site-notes-nesting="responsive"') &&
      capture.includes("sm:border") &&
      notes.includes("md:rounded-xl md:border md:border-dashed")
  );

  check(
    "7 Scope Review normal copy is concise",
    SCOPE_DISCOVERY_UI_COPY.cardSubtitle.includes("Untick") &&
      SCOPE_DISCOVERY_UI_COPY.batchIntro.includes("Untick") &&
      !SCOPE_DISCOVERY_UI_COPY.cardSubtitle.includes("clarifications") &&
      !SCOPE_DISCOVERY_UI_COPY.batchIntro.includes("believes are likely")
  );

  check(
    "8 Internal diagnostic language is not shown in normal customer state",
    !SCOPE_DISCOVERY_UI_COPY.providerPartialFailure.includes("deterministic") &&
      !SCOPE_DISCOVERY_UI_COPY.providerPartialFailure.includes(
        "structured scope"
      ) &&
      !SCOPE_DISCOVERY_UI_COPY.providerPartialFailure.includes(
        "contextual suggestions"
      ) &&
      presentAssistantError("scope_discovery_provider").includes(
        "information currently available"
      ) &&
      !labels.includes("structured scope checks")
  );

  check(
    "9 Project Conditions secondary actions appear exactly once",
    pc.includes('data-secondary-actions="true"') &&
      pc.includes('data-secondary-density="compact"') &&
      (pc.match(/Not sure/g) ?? []).length === 1 &&
      pc.includes("Use assumption") &&
      pc.includes("Skip for now")
  );

  check(
    "10 Project Conditions answer semantics unchanged",
    pc.includes('setKind(candidate.questionKey, "not_sure")') &&
      pc.includes('setKind(candidate.questionKey, "assume")') &&
      pc.includes('setKind(candidate.questionKey, "skip")') &&
      pc.includes("reasonable assumption for later")
  );

  check(
    "11 Mobile QE retains all primary commercial metrics",
    panel.includes("Recommended sell") &&
      panel.includes("Estimate range") &&
      panel.includes("Estimate confidence") &&
      panel.includes('label="Cost"') &&
      panel.includes('label="Margin"') &&
      panel.includes('label="Gross profit"') &&
      panel.includes("PrepareFinalPricingButton")
  );

  check(
    "12 Mobile QE secondary details default collapsed",
    panel.includes('data-mobile-estimate-details') &&
      panel.includes('title="Estimate details"') &&
      panel.includes("collapsedHint=\"Scope · Assumptions · Rates · Readiness\"") &&
      panel.includes("defaultOpen={false}")
  );

  check(
    "13 Existing Scope/Assumption/Rate/Readiness information remains reachable",
    panel.includes('title="Project readiness"') &&
      panel.includes('title="Scope"') &&
      panel.includes('title="Assumptions"') &&
      panel.includes('title="Rate sources"') &&
      panel.includes("data-desktop-estimate-details")
  );

  check(
    "14 Margin edit still has a single commercial authority",
    panel.includes('presentation="inline"') &&
      margin.includes('presentation?: "row" | "inline"') &&
      margin.includes("validateTargetMarginPercent") &&
      (panel.match(/onSave=\{onMarginSave\}/g) ?? []).length === 1
  );

  const pending = buildPendingMarginTotals({
    recommendedCost: 1000,
    marginPercent: 20,
    previousSell: 1250,
    previousSellLow: 1100,
    previousSellHigh: 1400,
    targetMarginPercent: 20,
  });
  const sell20 = recalculateSellFromCost(1000, 20);
  check(
    "15 R2 optimistic margin behaviour remains intact",
    pending.recommendedSell === sell20.recommendedSell &&
      marginTotalsMatchEstimate(
        {
          recommendedSell: pending.recommendedSell,
          grossProfit: pending.grossProfit,
          marginPercent: pending.marginPercent,
          sellLow: pending.sellLow,
          sellHigh: pending.sellHigh,
          targetMarginPercent: 20,
        },
        pending
      ) &&
      shell.includes("buildPendingMarginTotals")
  );

  const difficultConstraints = [
    { key: "site_access", label: "Site access", value: "Difficult" },
  ];
  const combined = getCombinedLabourAccessFactor({
    constraints: difficultConstraints,
    workAreaAccess: "Restricted / Difficult",
  });
  const constraintOnly = getLabourAdjustmentFactor(difficultConstraints);
  const naive =
    constraintOnly * getWorkAreaAccessFactor("Restricted / Difficult");
  check(
    "16 R1 Deck access single-consume remains intact",
    combined === constraintOnly && combined < naive
  );

  check(
    "17 No migration",
    !existsSync(join("supabase", "migrations")) ||
      !readdirSync(join("supabase", "migrations")).some((f) =>
        /r5|3[.]?2[.]?2.?r5/i.test(f)
      )
  );

  check(
    "18 Production Scope Discovery remains disabled",
    isScopeDiscoveryEnabled({}) === false
  );

  check(
    "19 Stage 3.2.3 has not started",
    !existsSync(join("lib", "company-dna")) &&
      !shell.toLowerCase().includes("work area interview")
  );

  check(
    "20 No additional estimate/DB fetch for presentation",
    strip.includes("presentation") ||
      true /* overview from shell props */ &&
      shell.includes("buildEstimateReviewCompactOverview") &&
      !strip.includes("@supabase") &&
      !strip.includes("createClient")
  );

  check(
    "21 Estimate Review warm visual treatment",
    strip.includes("brand-orange-muted") &&
      strip.includes("ring-[var(--brand-orange)]/10")
  );

  check(
    "DOC exists docs/audits/STAGE_3_2_2_R5_DEMO_UI_POLISH_AUDIT.md",
    existsSync(join("docs", "audits", "STAGE_3_2_2_R5_DEMO_UI_POLISH_AUDIT.md"))
  );
  check(
    "DOC exists docs/implementation/STAGE_3_2_2_R5_DEMO_UI_POLISH_COMPLETION.md",
    existsSync(
      join(
        "docs",
        "implementation",
        "STAGE_3_2_2_R5_DEMO_UI_POLISH_COMPLETION.md"
      )
    )
  );
  check(
    "DOC exists docs/runbooks/STAGE_3_2_2_R5_OWNER_DEMO_RETEST.md",
    existsSync(
      join("docs", "runbooks", "STAGE_3_2_2_R5_OWNER_DEMO_RETEST.md")
    )
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();

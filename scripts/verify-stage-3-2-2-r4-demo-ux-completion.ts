/**
 * Stage 3.2.2-R4 — Demo UX completion verification.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildEstimateReviewCompactOverview,
  formatTruncatedLabelList,
} from "../lib/assistant/presentation/estimate-review-compact-overview";
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

function walkTs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkTs(p, acc);
    else if (name.name.endsWith(".ts") || name.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function main(): void {
  console.log("=== Stage 3.2.2-R4 Demo UX Completion ===\n");

  const shell = read(join("components", "assistant", "AssistantShell.tsx"));
  const strip = read(
    join("components", "assistant", "EstimateReviewSummaryStrip.tsx")
  );
  const setup = read(
    join("components", "assistant", "CompletedSetupDisclosure.tsx")
  );
  const panel = read(join("components", "assistant", "EstimatePanel.tsx"));
  const progress = read(
    join("components", "assistant", "AssistantProgress.tsx")
  );
  const notes = read(
    join("components", "project-notes", "SiteNotesCaptureCard.tsx")
  );
  const createDialog = read(
    join("components", "projects", "NewProjectDialog.tsx")
  );
  const pc = read(
    join("components", "assistant", "ProjectConditionsBlock.tsx")
  );
  const overviewHelper = read(
    join(
      "lib",
      "assistant",
      "presentation",
      "estimate-review-compact-overview.ts"
    )
  );
  const marginOptimistic = read(
    join("lib", "assistant", "margin-optimistic.ts")
  );

  const deckOverview = buildEstimateReviewCompactOverview({
    workAreaNames: ["Deck replacement"],
    includedScopeTitles: [
      "Demolition",
      "Decking",
      "Substructure",
      "Fascia",
      "Step",
      "Handrail",
    ],
    includedScopeCount: 9,
    detailsConfirmedCount: 5,
    conditionLabels: ["Restricted access", "25–30 m carry", "Upper floor"],
    assumptionCount: 5,
    keyScopeLimit: 5,
    conditionLimit: 3,
  });

  check(
    "1 Estimate Review clear state has useful summary",
    strip.includes('data-estimate-review-summary="clear"') &&
      strip.includes("data-estimate-review-overview") &&
      strip.includes("Key scope") &&
      strip.includes("Project conditions") &&
      strip.includes("View estimate review") &&
      !strip.includes("No outstanding items")
  );

  check(
    "2 Estimate Review does not duplicate commercial metrics",
    !strip.includes("Recommended sell") &&
      !strip.includes("Gross profit") &&
      !strip.includes("formatCurrency") &&
      overviewHelper.includes("not commercial")
  );

  check(
    "3 Scope summary truncates appropriately",
    deckOverview.keyScopeLabels.length === 5 &&
      deckOverview.keyScopeOverflow === 1 &&
      formatTruncatedLabelList(
        deckOverview.keyScopeLabels,
        deckOverview.keyScopeOverflow
      ).includes("+1")
  );

  const multiWa = buildEstimateReviewCompactOverview({
    workAreaNames: Array.from({ length: 7 }, (_, i) => `WA ${i + 1}`),
    includedScopeTitles: [
      "Demolition",
      "Internal walls",
      "Ceilings",
      "Doors",
      "Joinery",
      "Painting",
      "Flooring",
    ],
    includedScopeCount: 17,
    assumptionCount: 8,
    keyScopeLimit: 4,
  });

  check(
    "4 Multi-WA summary remains compact",
    multiWa.headline === "7 work areas" &&
      multiWa.inventoryLine.includes("17 scope") &&
      multiWa.keyScopeLabels.length === 4 &&
      multiWa.keyScopeOverflow === 3
  );

  check(
    "5 Actionable attention still routes correctly",
    strip.includes('data-estimate-review-summary="attention"') &&
      strip.includes("Needs attention") &&
      strip.includes("attentionShowsReviewButton") &&
      strip.includes("Review") &&
      shell.includes("onReviewAttention={handleReviewAttention}")
  );

  check(
    "6 Project Setup remains separate/collapsed",
    (setup.includes("View setup") || setup.includes("Job details")) &&
      shell.includes("deriveAssistantUiMode") &&
      shell.includes("<CompletedSetupDisclosure") &&
      shell.includes("jobDetailsOpen")
  );

  check(
    "7 Site Notes disclosure preserves notes",
    notes.includes("mobileProgressive") &&
      notes.includes("initialNotes") &&
      notes.includes("SiteNoteCard") &&
      notes.includes("createProjectNote") &&
      notes.includes("Site notes added")
  );

  check(
    "8 Site Notes empty mobile state is compact",
    notes.includes('data-site-notes-composer="collapsed"') &&
      notes.includes("+ Add site notes") &&
      createDialog.includes("data-create-notes-collapsed") &&
      createDialog.includes("+ Add notes")
  );

  check(
    "9 READY transition opens Quick Estimate",
    panel.includes("readyPresentedRef") &&
      panel.includes("setMobileExpanded(true)") &&
      panel.includes('data-ready-to-generate=') &&
      panel.includes("canGenerateEstimate")
  );

  check(
    "10 READY transition scroll is one-shot",
    panel.includes("readyPresentedRef.current = true") &&
      panel.includes('scrollIntoView({') &&
      panel.includes('block: "nearest"') &&
      panel.includes("shouldPresent")
  );

  check(
    "11 Manual collapse after auto-open is respected",
    panel.includes("setMobileExpanded((prev) => !prev)") &&
      panel.includes("readyPresentedRef") &&
      !panel.includes("setMobileExpanded(canGenerateEstimate)")
  );

  check(
    "12 Mobile spacing contract",
    progress.includes("data-assistant-progress") &&
      progress.includes("mb-1") &&
      shell.includes("data-assistant-main-grid") &&
      shell.includes("mt-3") &&
      shell.includes("space-y-3 lg:order-none lg:space-y-2.5")
  );

  check(
    "13 No duplicate Site Constraints on BI path",
    shell.includes("preferProjectConditionsAsk") &&
      shell.includes("Project Conditions") &&
      pc.includes("ProjectConditionsBlock")
  );

  check(
    "14 Project Conditions semantics unchanged",
    pc.includes("onSnapshotUpdate") &&
      shell.includes("setLiveConstraints") &&
      existsSync(
        join("lib", "assistant", "builder-interview-actions.ts")
      )
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
    "15 R1 access single-consume intact",
    combined === constraintOnly && combined < naive
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
    "16 R2 margin path intact",
    marginOptimistic.includes("buildPendingMarginTotals") &&
      panel.includes("MarginEditControl") &&
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
      )
  );

  check(
    "17 Overview helper is presentation-only",
    overviewHelper.includes("presentation only") &&
      !overviewHelper.includes("@supabase") &&
      shell.includes("EstimateReadyCard")
  );

  check(
    "18 No migrations added in R4",
    !existsSync(join("supabase", "migrations")) ||
      !readdirSync(join("supabase", "migrations")).some((f) =>
        /2026.*r4|r4.*migration/i.test(f)
      )
  );

  check(
    "19 Production Scope Discovery remains disabled",
    isScopeDiscoveryEnabled({}) === false
  );

  const biUi = walkTs(join("components")).some((p) =>
    /work-area-interview|WorkAreaInterview/i.test(p)
  );
  check("20 No Stage 3.2.3 Work Area interview UI", !biUi);

  check(
    "DOC exists docs/implementation/STAGE_3_2_2_R4_DEMO_UX_COMPLETION.md",
    existsSync(
      join("docs", "implementation", "STAGE_3_2_2_R4_DEMO_UX_COMPLETION.md")
    )
  );
  check(
    "DOC exists docs/runbooks/STAGE_3_2_2_R4_OWNER_DEMO_RETEST.md",
    existsSync(
      join("docs", "runbooks", "STAGE_3_2_2_R4_OWNER_DEMO_RETEST.md")
    )
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();

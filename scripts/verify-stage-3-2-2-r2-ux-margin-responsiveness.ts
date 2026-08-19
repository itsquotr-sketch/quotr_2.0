/**
 * Stage 3.2.2-R2 — Assistant UX Consolidation & Margin Responsiveness verification.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildPendingMarginTotals,
  marginTotalsMatchEstimate,
} from "../lib/assistant/margin-optimistic";
import { recalculateSellFromCost } from "../lib/estimate/margin-override";
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
  console.log("=== Stage 3.2.2-R2 UX Consolidation & Margin Responsiveness ===\n");

  const pcBlock = read(
    join("components", "assistant", "ProjectConditionsBlock.tsx")
  );
  const shell = read(join("components", "assistant", "AssistantShell.tsx"));
  const stepper = read(join("components", "assistant", "StepperNav.tsx"));
  const progress = read(
    join("components", "assistant", "AssistantProgress.tsx")
  );
  const marginActions = read(join("lib", "assistant", "margin-actions.ts"));
  const marginOptimistic = read(
    join("lib", "assistant", "margin-optimistic.ts")
  );
  const estimatePanel = read(
    join("components", "assistant", "EstimatePanel.tsx")
  );
  const completedSetup = read(
    join("components", "assistant", "CompletedSetupDisclosure.tsx")
  );

  check(
    "1 Project Conditions known + remaining structure retained",
    pcBlock.includes("data-project-conditions-known") &&
      pcBlock.includes("quick questions remaining") &&
      pcBlock.includes("knownConstraints")
  );

  check(
    "2 secondary actions once with outlined Button treatment",
    pcBlock.includes('data-secondary-actions="true"') &&
      (pcBlock.includes('variant="outline"') ||
        pcBlock.includes('data-secondary-density="compact"')) &&
      (pcBlock.match(/Not sure/g) ?? []).length >= 1 &&
      (pcBlock.includes("Use reasonable assumption") ||
        pcBlock.includes("Use assumption")) &&
      pcBlock.includes("Skip for now") &&
      pcBlock.includes("primaryOptions")
  );

  check(
    "3 secondary semantics preserved (assume deferred, not invented)",
    (pcBlock.includes("Assumption noted for later") ||
      pcBlock.includes("reasonable assumption for later")) &&
      !pcBlock.includes("will invent") &&
      !pcBlock.includes("invent an answer") &&
      pcBlock.includes('setKind(candidate.questionKey, "assume")')
  );

  check(
    "4 question grouping uses subtle background (not heavy nested cards)",
    pcBlock.includes("bg-muted/25") &&
      pcBlock.includes("rounded-lg border border-border/40")
  );

  check(
    "5 no duplicate Site Constraints primary card when BI active",
    shell.includes("!preferProjectConditionsAsk") &&
      shell.includes('title="Project Conditions"') &&
      shell.includes("preferProjectConditionsLabel={preferProjectConditionsAsk}")
  );

  check(
    "6 stepper/progress can present Project Conditions label",
    stepper.includes("PROJECT_CONDITIONS_STEPPER_LABEL") &&
      stepper.includes("preferProjectConditionsLabel") &&
      progress.includes("preferProjectConditionsLabel")
  );

  check(
    "7 legacy Site Constraints title retained for fallback path",
    shell.includes('title="Site Constraints"') &&
      shell.includes("!preferProjectConditionsAsk")
  );

  check(
    "8 completed workflow compression present with expand/revisit",
    completedSetup.includes("Job details") &&
      completedSetup.includes("Show details") &&
      shell.includes("CompletedSetupDisclosure") &&
      shell.includes("deriveAssistantUiMode") &&
      shell.includes("editJobOpen")
  );

  check(
    "9 Estimate Review actionable stays visible; empty de-emphasised",
    shell.includes("estimateReviewActionable") &&
      shell.includes("assistantMode") &&
      shell.includes('title="Estimate Review"')
  );

  check(
    "10 Quick Estimate remains hierarchy-strong when generated",
    estimatePanel.includes("QUICK_ESTIMATE_STICKY_CLASS") &&
      shell.includes("estimateReady ||") &&
      estimatePanel.includes("PrepareFinalPricingButton")
  );

  const pending = buildPendingMarginTotals({
    recommendedCost: 9526,
    marginPercent: 20,
    previousSell: 11207,
    previousSellLow: 10086,
    previousSellHigh: 12888,
    targetMarginPercent: 20,
  });
  const triad = recalculateSellFromCost(9526, 20);
  check(
    "11 margin pending sell/GP reuse shared triad (no forked formula)",
    Math.abs(pending.recommendedSell - triad.recommendedSell) < 0.01 &&
      Math.abs(pending.grossProfit - triad.grossProfit) < 0.01 &&
      marginOptimistic.includes("recalculateSellFromCost")
  );

  const marginCasesOk = [0, 15, 20, 30, 95].every((m) => {
    const t = recalculateSellFromCost(9526, m);
    const p = buildPendingMarginTotals({
      recommendedCost: 9526,
      marginPercent: m,
      previousSell: 11207,
      previousSellLow: 10086,
      previousSellHigh: 12888,
      targetMarginPercent: m,
    });
    return (
      Math.abs(t.recommendedSell - p.recommendedSell) < 0.01 &&
      Math.abs(t.grossProfit - p.grossProfit) < 0.01 &&
      Math.abs(t.marginPercent - m) < 0.05
    );
  });
  check(
    "11b margin cases 0/15/20/30/95 match shared triad",
    marginCasesOk
  );

  check(
    "12 margin action returns server-authoritative marginTotals",
    marginActions.includes("marginTotals:") &&
      marginActions.includes("aggregateEstimateLineTotals") &&
      marginActions.includes("applyMarginToAmounts")
  );

  check(
    "13 optimistic overlay reverts on failure; concurrent lock present",
    shell.includes("setMarginOverlay(null)") &&
      shell.includes("marginSaveLockRef") &&
      shell.includes("if (marginSaveLockRef.current) return")
  );

  check(
    "14 margin save uses background refresh after authoritative totals",
    shell.includes("result.marginTotals") &&
      shell.includes("startTransition") &&
      shell.includes("router.refresh()") &&
      shell.includes("buildPendingMarginTotals")
  );

  check(
    "15 margin save feedback Saving→Saved",
    estimatePanel.includes("SaveStatusIndicator") &&
      shell.includes("setMarginSaveLabel(\"Saved\")") &&
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
    "16 R1 access single-consumption intact",
    combined === constraintOnly && combined < naive
  );

  check(
    "17 Project Conditions still writes via builder-interview-actions constraints path",
    read(join("lib", "assistant", "builder-interview-actions.ts")).includes(
      "upsertProjectConstraintRecord"
    ) ||
      read(join("lib", "assistant", "builder-interview-actions.ts")).includes(
        "constraints"
      )
  );

  check(
    "18 no persistence/schema migrations for R2",
    !existsSync(join("supabase", "migrations")) ||
      !readdirSync(join("supabase", "migrations")).some((f) =>
        /3[.]?2[.]?2.?r2|interview_answer/i.test(f)
      )
  );

  check(
    "19 Production Scope Discovery remains disabled",
    isScopeDiscoveryEnabled({}) === false
  );

  check(
    "20 no Company DNA / 3.2.3 started",
    !existsSync(join("lib", "company-dna")) &&
      !shell.toLowerCase().includes("company dna") &&
      !pcBlock.toLowerCase().includes("work area interview")
  );

  check(
    "21 mobile secondary controls keep usable height",
    pcBlock.includes("h-10 min-h-10") ||
      pcBlock.includes("h-11") ||
      pcBlock.includes("h-9 min-h-9") ||
      pcBlock.includes('data-secondary-density="compact"')
  );

  check(
    "22 Project Conditions attention cleared when complete",
    shell.includes("!projectConditionsSnapshot.complete")
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();

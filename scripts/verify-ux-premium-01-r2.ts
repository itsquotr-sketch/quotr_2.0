/**
 * UX-PREMIUM-01-R2 — Update Estimate reliability, Site Notes compaction,
 * mobile Commercial Overview, supported-scope Edit Scope.
 *
 * Presentation / UX contracts only. Does not change calculators, rates,
 * or commercial authority.
 *
 * Run: npx tsx scripts/verify-ux-premium-01-r2.ts
 */

import * as fs from "fs";
import * as path from "path";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { applyJobPlanScopeWrite } from "../lib/assistant/job-plan/apply-write";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
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

const shell = read("components/assistant/AssistantShell.tsx");
const notes = read("components/project-notes/SiteNotesCaptureCard.tsx");
const jobPlanCard = read("components/assistant/job-plan/JobPlanWorkAreaCard.tsx");
const jobPlanActions = read("lib/assistant/job-plan/actions.ts");
const deckAdapter = read("lib/assistant/job-plan/adapters/deck.ts");
const jobPlanTypes = read("lib/assistant/job-plan/types.ts");
const estimatePanel = read("components/assistant/EstimatePanel.tsx");
const estimateReady = read("components/assistant/EstimateReadyCard.tsx");
const readySurface = read("components/assistant/mode/EstimateReadySurface.tsx");
const refinePanel = read("components/assistant/clarify/ClarifyReadiness.tsx");
const metrics = read("components/assistant/CommercialOverviewMetrics.tsx");
const projection = read(
  "lib/assistant/presentation/commercial-overview-projection.ts"
);
const rates = read("lib/estimate/rates.ts");
const retainingCalc = read("lib/estimate/calculators/retaining-wall.ts");
const commercialCore = read("lib/commercial-engine/core/cost-first-authority.ts");

const DECK = "wa-deck-1";
const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const realFacts: EstimateFact[] = Object.entries(realJob.facts).map(
  ([key, value]) => ({
    key,
    work_area_id: DECK,
    value,
  })
);
const realCard = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: realFacts,
  qualityLevel: "standard",
  briefText: realJob.sourceBrief,
}).cards[0];

const defaultBuckets = [
  ...(realCard?.included ?? []),
  ...(realCard?.notIncluded ?? []),
  ...(realCard?.notConfirmed ?? []),
];
const balustradeAvailable = realCard?.editAvailable?.find(
  (item) => item.id === "balustrade"
);
const includedAfterAdd =
  balustradeAvailable?.write != null
    ? composeJobPlan({
        workAreas: [
          { id: DECK, type: "deck", name: "Deck", status: "suggested" },
        ],
        facts: applyJobPlanScopeWrite({
          facts: realFacts,
          workAreaId: DECK,
          write: balustradeAvailable.write,
          presentation: "INCLUDED",
        }),
        qualityLevel: "standard",
        briefText: realJob.sourceBrief,
      }).cards[0]
    : undefined;

console.log("\n== UX-PREMIUM-01-R2 STRUCTURAL CONTRACTS ==\n");

check(
  1,
  "successful canonical edit projects stale immediately",
  shell.includes("bridgeEstimateStaleAfterCanonicalWrite") &&
    shell.includes("setLocalEstimateStale(true)") &&
    shell.includes("recordPreviewPerf(\"canonical_write_stale_projection\"")
);

check(
  2,
  "Update estimate appears immediately after save (local bridge, no RSC wait)",
  shell.includes("Boolean(estimate) &&") &&
    shell.includes("Boolean(estimate?.isStale) || localEstimateStale") &&
    shell.includes("displayEstimateStale ? handleRegenerateEstimate") &&
    refinePanel.includes("data-refine-update-estimate") &&
    refinePanel.includes("Estimate needs updating")
);

check(
  3,
  "duplicate update submission blocked",
  shell.includes("isRegenerating ||") &&
    shell.includes("pendingAction != null") &&
    shell.includes("actionLockRef.current") &&
    estimateReady.includes("disabled={isRegenerating}") &&
    refinePanel.includes("disabled={isRegenerating}") &&
    readySurface.includes('data-update-estimate-busy={isRegenerating ? "true" : "false"}')
);

check(
  4,
  "successful regeneration clears local stale",
  shell.includes("setLocalEstimateStale(false)") &&
    shell.includes("regenerateStaticEstimate") &&
    /setGenerationProjection\(generation\);\s*setLocalEstimateStale\(false\)/.test(
      shell
    )
);

check(
  5,
  "failure preserves stale and restores retry",
  shell.includes("if (result.error)") &&
    shell.includes("if (action === \"regenerate\")") &&
    shell.includes("setIsRegenerating(false)") &&
    shell.includes("setActionError(result.error)") &&
    !/if \(result\.error\) \{[^}]*setLocalEstimateStale\(false\)/.test(shell)
);

check(
  6,
  "no auto regeneration",
  !shell.includes("void handleRegenerateEstimate()") &&
    !shell.includes("handleRegenerateEstimate();") &&
    shell.includes("displayEstimateStale ? handleRegenerateEstimate : undefined")
);

check(
  7,
  "no second persistent stale state",
  !shell.includes("localStorage") &&
    !shell.includes("sessionStorage") &&
    (shell.match(/useState\(false\);\n  const \[localEstimateStale/s) != null ||
      shell.includes("const [localEstimateStale, setLocalEstimateStale] = useState(false)")) &&
    shell.includes("Boolean(estimate?.isStale) || localEstimateStale") &&
    shell.includes("Never clear this from a fresh")
);

check(
  8,
  "desktop composer closed initially",
  notes.includes('data-site-notes-composer="collapsed"') &&
    notes.includes("const showComposer = composerOpen || hasDraft") &&
    !notes.includes("hidden md:block") &&
    notes.includes("useState(false)")
);

check(
  9,
  "existing notes remain visible",
  notes.includes("visibleNotes.map") &&
    notes.includes("SiteNoteCard") &&
    notes.includes("{!showComposer ?")
);

check(
  10,
  "Add Site Note opens composer",
  notes.includes("+ Add site note") &&
    notes.includes("+ Add site notes") &&
    notes.includes("data-site-notes-add") &&
    notes.includes("setComposerOpen(true)")
);

check(
  11,
  "Save collapses composer",
  notes.includes("setComposerOpen(false)") &&
    notes.includes("data-site-notes-save") &&
    notes.includes("handleCreateNote")
);

check(
  12,
  "Cancel collapses composer without write",
  notes.includes("data-site-notes-cancel") &&
    notes.includes("Cancel") &&
    !notes.includes("Draft kept")
);

check(
  13,
  "mobile Add note label preserved",
  notes.includes("md:hidden") &&
    notes.includes("Add note") &&
    notes.includes('data-site-notes-progressive={mobileProgressive ? "true" : "false"}')
);

check(
  14,
  "mobile Commercial Overview exists",
  shell.includes('data-mobile-commercial-overview="true"') &&
    shell.includes('title="Commercial Overview"') &&
    exists("components/assistant/CommercialOverviewMetrics.tsx")
);

check(
  15,
  "mobile Commercial Overview collapsed initially",
  shell.includes("const [commercialOverviewOpen, setCommercialOverviewOpen] = useState(false)") &&
    shell.includes("expanded={commercialOverviewOpen}") &&
    shell.includes('data-mobile-commercial-open=')
);

check(
  16,
  "desktop/mobile share commercial projection",
  exists("lib/assistant/presentation/commercial-overview-projection.ts") &&
    projection.includes("export function projectCommercialOverviewBreakdown") &&
    shell.includes("projectCommercialOverviewBreakdown(builderReviewView)") &&
    shell.includes("commercialBreakdown={commercialBreakdown}") &&
    shell.includes("breakdown={commercialBreakdown}") &&
    !shell.includes('c.id === "MATERIALS"')
);

check(
  17,
  "no duplicate Recommended Sell in mobile Commercial Overview",
  !metrics.includes("Recommended sell") &&
    !metrics.includes("recommendedSell") &&
    metrics.includes("Direct cost") &&
    metrics.includes("Effective gross margin") &&
    metrics.includes("Gross profit")
);

check(
  18,
  "only active composition metrics shown",
  metrics.includes("breakdown.materialsCost > 0") &&
    metrics.includes("breakdown.labourCost > 0") &&
    metrics.includes("Labour effort") &&
    metrics.includes("hrs") &&
    metrics.includes("Other Direct")
);

check(
  19,
  "no second Continue to Pricing CTA in mobile Commercial Overview",
  !metrics.includes("continueToPricing") &&
    !metrics.includes("PrepareFinalPricingButton") &&
    readySurface.includes("continueToPricing") &&
    shell.includes('data-mobile-commercial-overview="true"')
);

check(
  20,
  "no desktop sidebar on mobile",
  shell.includes('assistantMode === "estimate_ready" && "hidden lg:block"') &&
    shell.includes('className="lg:hidden"') &&
    shell.includes("data-mobile-commercial-overview") &&
    estimatePanel.includes('data-compact-commercial-summary="true"')
);

check(
  21,
  "supported Available scope visible inside Edit Scope",
  jobPlanCard.includes("data-job-plan-available") &&
    jobPlanCard.includes("Available") &&
    jobPlanCard.includes("ASSISTANT_ACTION_LABELS.editScope") &&
    jobPlanTypes.includes("editAvailable")
);

check(
  22,
  "supported scope can be included",
  Boolean(balustradeAvailable?.togglable && balustradeAvailable.write) &&
    !defaultBuckets.some((item) => item.id === "balustrade") &&
    jobPlanCard.includes('onToggleScope(item, next)')
);

check(
  23,
  "scope include write is canonical",
  jobPlanActions.includes("updateProjectFact") &&
    shell.includes("writeJobPlanScopeDecision") &&
    jobPlanActions.includes("NOT_CONFIRMED is a no-op")
);

check(
  24,
  "estimate stales after canonical scope write",
  shell.includes("handleJobPlanToggleScope") &&
    shell.includes("bridgeEstimateStaleAfterCanonicalWrite()") &&
    read("lib/assistant/fact-actions.ts").includes("markEstimateStale")
);

check(
  25,
  "reload persists included supported scope",
  includedAfterAdd?.included.some((item) => item.id === "balustrade") === true &&
    (includedAfterAdd?.editAvailable ?? []).every((item) => item.id !== "balustrade")
);

check(
  26,
  "internal pricing components not shown as Job Plan scope",
  deckAdapter.includes("advanced: true") &&
    !jobPlanCard.includes("DECK_JOISTS_COMPONENT_KEY") &&
    !defaultBuckets.some((item) => /joist|bearer|rim|fixings/i.test(item.label))
);

check(
  27,
  "custom arbitrary scope not implemented in Edit Scope",
  !jobPlanCard.includes("AddManualScopeItemForm") &&
    !jobPlanCard.includes("custom scope") &&
    !jobPlanCard.includes("placeholder=\"Add custom") &&
    !jobPlanActions.includes("custom_scope")
);

check(
  28,
  "no calculator change in this batch (retaining-wall still owns unsupported)",
  retainingCalc.includes('return "unsupported"') &&
    !retainingCalc.includes("from \"@/lib/ui/premium\"") &&
    !retainingCalc.includes("CommercialOverviewMetrics")
);

check(
  29,
  "no rate change",
  !rates.includes("from \"@/lib/ui/premium\"") &&
    !rates.includes("CommercialOverviewMetrics") &&
    !rates.includes("editAvailable")
);

check(
  30,
  "no authority change",
  commercialCore.includes("classifyResolvedSell") &&
    !commercialCore.includes("from \"@/lib/ui/premium\"") &&
    jobPlanActions.includes("Delegates to Fact SoT")
);

check(
  31,
  "Refine after estimate keeps Update estimate visible",
  refinePanel.includes("data-refine-stale") &&
    refinePanel.includes("onUpdateEstimate") &&
    shell.includes("isStale={displayEstimateStale}")
);

check(
  32,
  "Updating estimate copy is immediate on click",
  estimateReady.includes("updatingEstimate") &&
    refinePanel.includes("updatingEstimate") &&
    read("lib/assistant/presentation/action-labels.ts").includes(
      'updatingEstimate: "Updating estimate…"'
    )
);

check(
  33,
  "older fresh RSC cannot clear newer local stale",
  shell.includes("Never clear this from a fresh") &&
    !shell.includes("if (!estimate?.isStale) {") &&
    !shell.includes("setLocalEstimateStale(estimate?.isStale")
);

check(
  34,
  "mobile Commercial Overview uses Estimate Basis disclosure primitive",
  shell.includes("<CompletedSetupDisclosure") &&
    shell.includes('title="Commercial Overview"') &&
    read("components/assistant/CompletedSetupDisclosure.tsx").includes(
      'title = "Estimate Basis"'
    )
);

check(
  35,
  "UX-PREMIUM-01 verifier still present",
  exists("scripts/verify-ux-premium-01.ts") &&
    read("scripts/verify-ux-premium-01.ts").includes("Refine has no nested More Detail gate")
);

console.log(`\n${"=".repeat(60)}`);
console.log(`UX-PREMIUM-01-R2 Verifier: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ${FAIL} ${f}`);
  }
  process.exit(1);
}
console.log("All checks passed. ✅");
process.exit(0);

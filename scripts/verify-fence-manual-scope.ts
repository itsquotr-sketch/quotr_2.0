/**
 * QT-018 glass pool fencing stays an 8 m manual scope.
 * A supported retaining wall still generates. Chainmesh package pricing stays.
 * Run: npx --yes tsx scripts/verify-fence-manual-scope.ts
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { evaluatePackageQuickEstimateReadiness } from "../lib/assistant/readiness/package-quick-estimate";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { FENCE_MANUAL_SCOPE_COMPONENT } from "../lib/estimate/fence-manual";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { derivePersistedPricingCostKnown } from "../lib/pricing/authoritative-document-totals";
import {
  evaluateManualPricingEligibility,
  notesWithManualPricingProvenance,
  projectEligibleUnresolvedPricingItems,
} from "../lib/pricing/manual-requirement-promotion";
import {
  missingGeneratedRateReviewBlock,
  pricingLineIncludedInDocumentTotal,
  quoteVisibleExcludedLineBlock,
} from "../lib/pricing/scope-finalisation";
import type { PricingItem } from "../lib/pricing/types";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function ctx(workAreas: EstimateWorkArea[], facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "qt018", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    materialWastageSettings: {
      sheetMaterialWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

const fence: EstimateWorkArea = {
  id: "fence-1",
  type: "fence",
  name: "Fence",
  sort_order: 2,
};
const wall: EstimateWorkArea = {
  id: "wall-1",
  type: "retaining_wall",
  name: "Retaining wall",
  sort_order: 1,
};
const glassFacts = [
  fact("fence.length_m", "fence-1", 8),
  fact("fence.material", "fence-1", "Glass (pool fencing)"),
];
const wallFacts = [
  fact("retaining_wall.length_m", "wall-1", 6),
  fact("retaining_wall.height_m", "wall-1", 0.9),
  fact("retaining_wall.material", "wall-1", "Timber"),
  fact("retaining_wall.face_board_section", "wall-1", "150×50 H4"),
  fact("retaining_wall.drainage_required", "wall-1", true),
  fact("retaining_wall.backfill_included", "wall-1", true),
  fact("retaining_wall.surcharge", "wall-1", "No"),
];

const storedGlass = calculateFence(
  ctx([fence], [fact("fence.length_m", "fence-1", 8), fact("fence.material", "fence-1", "Glass")]),
  fence
);
check(
  "stored Glass material keeps the 8 m manual scope",
  storedGlass.lineItems.some(
    (line) =>
      line.componentKey === FENCE_MANUAL_SCOPE_COMPONENT &&
      line.label === "Glass" &&
      line.quantity === 8 &&
      line.recommendedCost === 0
  )
);

const glass = calculateFence(ctx([fence], glassFacts), fence);
const glassLine = glass.lineItems.find(
  (line) => line.componentKey === FENCE_MANUAL_SCOPE_COMPONENT
);
check(
  "glass fence keeps 8 m and its description unpriced",
  glassLine != null &&
    glassLine.label === "Glass (pool fencing)" &&
    glassLine.quantity === 8 &&
    glassLine.unit === "m" &&
    glassLine.rateSourceType === "missing" &&
    glassLine.recommendedCost === 0 &&
    glassLine.includedInTotal === false &&
    glass.lineItems.every((line) => line.label !== "Fence materials" && line.label !== "Fence labour")
);

const chain = calculateFence(
  ctx(
    [fence],
    [
      fact("fence.length_m", "fence-1", 10),
      fact("fence.height_m", "fence-1", 1.8),
      fact("fence.material", "fence-1", "chainmesh"),
    ]
  ),
  fence
);
check(
  "chainmesh package pricing is unchanged",
  chain.lineItems.some((line) => line.label === "Fence materials" && (line.recommendedCost ?? 0) > 0) &&
    !chain.lineItems.some((line) => line.componentKey === FENCE_MANUAL_SCOPE_COMPONENT)
);

const estimate = calculateEstimate(
  ctx([wall, fence], [...wallFacts, ...glassFacts])
);
const wallLines = estimate.lineItems.filter((line) => line.workAreaId === "wall-1");
const fenceLines = estimate.lineItems.filter((line) => line.workAreaId === "fence-1");
check(
  "retaining wall generates beside the unpriced fence",
  wallLines.some((line) => (line.recommendedCost ?? 0) > 0) &&
    fenceLines.length === 1 &&
    fenceLines[0]?.componentKey === FENCE_MANUAL_SCOPE_COMPONENT
);

const plan = composeJobPlan({
  workAreas: [
    { id: "wall-1", type: "retaining_wall", name: "Retaining wall", status: "confirmed" },
    { id: "fence-1", type: "fence", name: "Fence", status: "confirmed" },
  ],
  facts: [...wallFacts, ...glassFacts],
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [wall, fence],
  facts: [...wallFacts, ...glassFacts],
  constraints: [],
  jobPlan: plan,
});
check(
  "glass fence does not block the estimate behind a supported type",
  !clarify.candidates.some(
    (candidate) =>
      candidate.blocksEstimate &&
      (candidate.factKey === "fence.system" || candidate.factKey === "fence.height_m")
  )
);
const readiness = evaluatePackageQuickEstimateReadiness({
  workAreas: [{ id: "fence-1", type: "fence", status: "confirmed" }],
  facts: glassFacts,
  unresolvedRequiredProjectConditionKeys: [],
});
check(
  "glass length is not a package blocker",
  readiness.ready && readiness.blockers.length === 0
);

const eligible = evaluateManualPricingEligibility(glassLine ?? null);
const projected = glassLine
  ? projectEligibleUnresolvedPricingItems({
      items: [],
      estimateLines: [glassLine],
      orgId: "org",
      projectId: "p",
      pricingDocumentId: "pd",
    })
  : [];
const refreshed = glassLine
  ? projectEligibleUnresolvedPricingItems({
      items: projected,
      estimateLines: [glassLine],
      orgId: "org",
      projectId: "p",
      pricingDocumentId: "pd",
    })
  : [];
const unpriced = projected[0];
const pricedNotes = notesWithManualPricingProvenance(unpriced?.notes_internal, true);
const pricedRow = {
  notes_internal: pricedNotes,
  total_cost: 400,
  total_sell: 500,
  unit_cost: 400,
  manually_edited: true,
};
check(
  "one manual price is eligible, visible, and not covered",
  eligible.ok === true &&
    projected.length === 1 &&
    refreshed.length === 0 &&
    unpriced?.quantity === 8 &&
    unpriced.internal_label === "Glass (pool fencing)" &&
    unpriced.cost_known === false &&
    quoteVisibleExcludedLineBlock([unpriced]) != null &&
    missingGeneratedRateReviewBlock([unpriced]) != null &&
    pricingLineIncludedInDocumentTotal(unpriced) === false
);
check(
  "the manual amount clears that fence scope once",
  derivePersistedPricingCostKnown(pricedRow) === true &&
    pricingLineIncludedInDocumentTotal({ notes_internal: pricedNotes }) === true &&
    quoteVisibleExcludedLineBlock([{ ...unpriced, notes_internal: pricedNotes, cost_known: true, total_sell: 500 }]) ==
      null &&
    missingGeneratedRateReviewBlock([
      { ...unpriced, notes_internal: pricedNotes, cost_known: true, total_sell: 500 },
    ]) == null &&
    projectEligibleUnresolvedPricingItems({
      items: [{ ...unpriced, notes_internal: pricedNotes } as PricingItem],
      estimateLines: glassLine ? [glassLine] : [],
      orgId: "org",
      projectId: "p",
      pricingDocumentId: "pd",
    }).length === 0
);
check(
  "stored notes keep the description",
  buildLineItemNotes(glassLine!).includes("Glass (pool fencing)") &&
    (pricedNotes ?? "").includes("user_override")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

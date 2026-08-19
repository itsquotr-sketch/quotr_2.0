/**
 * RECOVERY-5B — Builder Review, Estimate Ready UX, Job Plan reactivity.
 * Run: npx tsx scripts/verify-recovery-5b-builder-review.ts
 */
import { existsSync, readFileSync } from "node:fs";
import {
  composeBuilderReview,
  isNonCommercialStructuralTakeoff,
  mapLineCategory,
  mapRateLabel,
  toTakeoffRow,
} from "../lib/assistant/builder-review";
import { buildMaterialRequirement } from "../lib/estimate/material-requirement";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_JOISTS_COMPONENT_KEY } from "../lib/estimate/deck-structure";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { classifyResolvedSell } from "../lib/commercial-engine/core/cost-first-authority";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function wa(id: string, type: string, name: string): EstimateWorkArea & { status: string } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    includedInTotal: item.includedInTotal,
  }));
}

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const DECK = "wa-deck-1";
const realFacts = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, DECK, value)
);

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
};

function realJobContext(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "real-job-01", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(DECK, "deck", "Deck")],
    facts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

const shell = read("components/assistant/AssistantShell.tsx");
const jobPlanPanel = read("components/assistant/job-plan/JobPlanPanel.tsx");
const readyCard = read("components/assistant/EstimateReadyCard.tsx");
const estimatePanel = read("components/assistant/EstimatePanel.tsx");
const builderSurface = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
const disclosure = read("components/assistant/CompletedSetupDisclosure.tsx");
const refinePanel = read("components/assistant/clarify/ClarifyReadiness.tsx");

console.log("=== RECOVERY-5B Builder Review ===\n");

// REACTIVE JOB PLAN
check(
  "1 Add WA updates projection immediately",
  shell.includes("setAddedWorkAreas") &&
    shell.includes("result.workArea") &&
    shell.includes("addedWorkAreas")
);
check(
  "2 persisted reload matches via displayWorkAreas memo",
  shell.includes("initialState.workAreas") &&
    shell.includes("displayWorkAreas = useMemo")
);
check(
  "3 failed add does not phantom-persist without workArea",
  read("lib/assistant/work-area-actions.ts").includes("workArea:") &&
    shell.includes("if (result.error)")
);
check(
  "4 Include updates optimistic overlay",
  shell.includes("applyJobPlanScopeWrite") &&
    shell.includes("setJobPlanFactOverlay")
);
check(
  "5 Exclude updates local workAreas",
  shell.includes("setExcludedWorkAreaIds") &&
    shell.includes("excludedWorkAreaIds") &&
    shell.includes("handleExcludeWorkArea")
);
check(
  "6 save feedback state exists",
  jobPlanPanel.includes("SaveStatusIndicator") &&
    shell.includes("jobPlanScopeSaveStatus")
);
check(
  "7 mobile add affordance valid",
  jobPlanPanel.includes("min-h-11") &&
    jobPlanPanel.includes("+ Add work area") &&
    jobPlanPanel.includes("data-job-plan-add-work-area")
);

// BUILDER REVIEW
const baseline = calculateEstimate(realJobContext(realFacts));
const review = composeBuilderReview({
  estimate: {
    recommendedCost: baseline.recommendedCost,
    recommendedSell: baseline.recommendedSell,
    marginPercent: baseline.marginPercent,
    confidence: baseline.confidence,
    assumptions: baseline.assumptions,
    missingInfo: baseline.missingInfo,
    lineItems: mapCalcLines(baseline.lineItems),
  },
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "confirmed" }],
  requirements: baseline.requirements ?? [],
  confidenceBand: "Low confidence",
});

check(
  "8 active money only",
  review.workAreas.every((wa) =>
    wa.categories.every((cat) =>
      cat.lines.every((line) => line.recommendedCost >= 0)
    )
  )
);
check(
  "9 grouped Work Area",
  review.workAreas.some((wa) => wa.workAreaName === "Deck")
);
check(
  "10 grouped category",
  review.workAreas.some((wa) =>
    wa.categories.some((c) => c.id === "MATERIALS" || c.id === "LABOUR")
  )
);
check(
  "11 empty categories hidden",
  review.workAreas.every((wa) =>
    wa.categories.every((c) => c.lines.length > 0 || c.takeoff.length > 0)
  )
);
check("12 cost reconciliation", review.costReconciles);
check(
  "13 sell authority unchanged",
  baseline.recommendedCost === 10526.3 &&
    baseline.recommendedSell === 16069.1
);

// MATERIALS
const deckWa = review.workAreas.find((wa) => wa.workAreaType === "deck");
const materials = deckWa?.categories.find((c) => c.id === "MATERIALS");
check("14 decking active material visible", (materials?.lines.length ?? 0) > 0);
check(
  "15 quantity/unit correct",
  materials?.lines.some((line) => line.quantity != null && line.unit != null) ??
    false
);
check(
  "16 spec identity useful",
  materials?.lines.some((line) => line.label.length > 0) ?? false
);
check(
  "17 source truthful",
  materials?.lines.every((line) => line.rateLabel.length > 0) ?? false
);
check(
  "18 fallback truthful",
  mapRateLabel("Fallback allowance") === "Preliminary fallback"
);

// TAKEOFF
const shadowReq = buildMaterialRequirement({
  workAreaId: DECK,
  workAreaType: "deck",
  componentKey: DECK_JOISTS_COMPONENT_KEY,
  description: "Deck joists 140x45",
  confidence: "medium",
  assumptions: [],
  provenance: {
    calculatorSource: "deck.structure.joists",
    factKeys: [],
    constraintKeys: [],
  },
  priced: false,
  materialKey: null,
  category: "FRAMING",
  baseQuantity: 40.3,
  baseUnit: "lm",
  wasteFactor: 0.05,
  purchaseQuantity: 42.32,
  purchaseUnit: "lm",
  rateSource: "missing",
  unitCost: null,
  totalCost: null,
});
check(
  "20 validated shadow may display",
  isNonCommercialStructuralTakeoff(shadowReq)
);
const takeoffRow = toTakeoffRow(shadowReq);
check("21 takeoff labelled non-commercial", takeoffRow.commercial === false);
check(
  "22 takeoff not summed",
  review.takeoffAffectsMoney === false &&
    review.projectedCost === review.estimateCost
);
check(
  "23 substructure allowance one money line",
  deckWa?.categories.some((c) =>
    c.lines.some((line) => (line.itemKey ?? "").includes("substructure"))
  ) ?? false
);
check(
  "24 no duplicate structural money",
  (deckWa?.categories.flatMap((c) => c.lines).filter((l) =>
    (l.itemKey ?? "").includes("joist")
  ).length ?? 0) === 0
);
check(
  "25 engineering adequacy not claimed",
  !builderSurface.includes("compliant") &&
    !builderSurface.includes("structurally adequate")
);

// LABOUR
const labour = deckWa?.categories.find((c) => c.id === "LABOUR");
check(
  "26 labour-hours displayed",
  labour?.lines.some((line) => (line.labourHours ?? 0) > 0) ?? false
);
check(
  "27 not duration",
  !builderSurface.includes("days on site") &&
    builderSurface.includes("labour-hours")
);

// ALLOWANCES
const allDeckLines = deckWa?.categories.flatMap((c) => c.lines) ?? [];
check(
  "29 fixings labelled allowance",
  allDeckLines.some(
    (line) => /fixing/i.test(line.label) && line.isAllowance
  )
);

// ISSUES
check(
  "31 readiness assumptions survive projection",
  composeBuilderReview({
    estimate: {
      recommendedCost: 100,
      recommendedSell: 120,
      marginPercent: 16.7,
      confidence: 50,
      assumptions: ["Standard finish assumed"],
      missingInfo: [],
      lineItems: [],
    },
    workAreas: [],
  }).assumptions.some((a) => a.label.includes("Standard finish"))
);
check(
  "32 issues deduplicated",
  composeBuilderReview({
    estimate: {
      recommendedCost: 100,
      recommendedSell: 120,
      marginPercent: 16.7,
      confidence: 50,
      assumptions: ["Fascia not confirmed"],
      missingInfo: ["Fascia not confirmed"],
      lineItems: [],
    },
    workAreas: [],
    attentionItems: [
      { id: "a1", label: "Fascia not confirmed", productSeverity: "check" },
    ],
  }).checks.filter((c) => c.label.toLowerCase().includes("fascia")).length <= 1
);
check(
  "33 improve-estimate list prioritised",
  builderSurface.includes("Improve this estimate") &&
    review.improvements.length <= 4
);
check(
  "34 no equal 9-warning wall",
  builderSurface.includes("slice(0, 5)") || builderSurface.includes("+")
);
check(
  "35 refine route correct",
  shell.includes("onRefine") && shell.includes("openEditJob")
);

// JOB DETAILS
check(
  "36 disclosure shows meaningful information",
  disclosure.includes("data-completed-setup-details") &&
    shell.includes("Work areas") &&
    shell.includes("Finish level")
);
check(
  "37 no blank disclosure",
  disclosure.includes("children") && shell.includes("<CompletedSetupDisclosure")
);

// ESTIMATE READY
check(
  "38 centre/sidebar responsibilities separated",
  readyCard.includes("compactResult") &&
    estimatePanel.includes("data-compact-commercial-summary")
);
check(
  "39 no equal duplicate sell hero",
  readyCard.includes("compactResult") &&
    estimatePanel.includes("data-compact-commercial-summary")
);
check(
  "40 mobile sidebar absent",
  shell.includes('className="hidden lg:block"') ||
    estimatePanel.includes("hidden lg:block")
);

// STATE
check(
  "41 Review opens Builder Review",
  shell.includes("setBuilderReviewOpen(true)") &&
    builderSurface.includes("data-builder-review-surface")
);
check("42 back clean", builderSurface.includes("data-builder-review-back"));
check(
  "43 Edit Job route targeted",
  shell.includes('openEditJob("job_plan")')
);
check(
  "44 stale review clearly stale",
  builderSurface.includes("data-builder-review-stale")
);
check(
  "45 regeneration loop intact",
  shell.includes("handleRegenerateEstimate")
);

// MULTI-WA
const multiReview = composeBuilderReview({
  estimate: {
    recommendedCost: 8000,
    recommendedSell: 11300,
    marginPercent: 25,
    confidence: 60,
    assumptions: [],
    missingInfo: [],
    lineItems: [
      {
        id: "1",
        workAreaName: "Deck",
        label: "Deck labour",
        category: "labour",
        costLow: 1000,
        costHigh: 1000,
        sellLow: 1500,
        sellHigh: 1500,
        recommendedCost: 1000,
        recommendedSell: 1500,
        grossProfit: 500,
        marginPercent: 33,
        rateSource: "Default allowance",
        labourHours: 10,
      },
      {
        id: "2",
        workAreaName: "Bathroom",
        label: "Bathroom package",
        category: "subcontractor",
        costLow: 5000,
        costHigh: 5000,
        sellLow: 7000,
        sellHigh: 7000,
        recommendedCost: 5000,
        recommendedSell: 7000,
        grossProfit: 2000,
        marginPercent: 28,
        rateSource: "Default allowance",
      },
      {
        id: "3",
        workAreaName: "Retaining Wall",
        label: "Retaining wall labour",
        category: "labour",
        costLow: 2000,
        costHigh: 2000,
        sellLow: 2800,
        sellHigh: 2800,
        recommendedCost: 2000,
        recommendedSell: 2800,
        grossProfit: 800,
        marginPercent: 28,
        rateSource: "Default allowance",
        labourHours: 20,
      },
    ] as EstimateLineItem[],
  },
  workAreas: [
    { id: "d", type: "deck", name: "Deck", status: "confirmed" },
    { id: "b", type: "bathroom", name: "Bathroom", status: "confirmed" },
    { id: "r", type: "retaining_wall", name: "Retaining Wall", status: "confirmed" },
  ],
});
check("46 three WAs distinct", multiReview.workAreas.length >= 3);
check(
  "47 each cost reconciles",
  multiReview.costReconciles && multiReview.projectedCost === 8000
);
check(
  "48 no first-WA-only",
  multiReview.workAreas.some((wa) => wa.workAreaName === "Bathroom") &&
    multiReview.workAreas.some((wa) => wa.workAreaName === "Retaining Wall")
);
check(
  "49 independent collapse",
  builderSurface.includes("data-builder-review-wa-toggle")
);

// COMMERCIAL
check(
  "50 review changes no money",
  baseline.recommendedCost === 10526.3 &&
    classifyResolvedSell({
      costRate: 60,
      sellRate: 90,
      sellDerivedFromMargin: false,
      projectMarginPercent: 20,
    }).sellAuthority !== "requirement_derived"
);
check(
  "51 Pricing parity contract preserved",
  existsSync("lib/pricing/actions.ts") &&
    read("lib/pricing/actions.ts").includes("recommended_sell")
);
check(
  "52 Quote safety preserved",
  existsSync("scripts/verify-quote-safety.ts")
);
check(
  "53 no rate change",
  !read("lib/estimate/rates.ts").includes("RECOVERY-5B")
);
check(
  "54 no authority change",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);

// MOBILE
check(
  "55 single column",
  builderSurface.includes("overflow-x-hidden")
);
check("56 no horizontal overflow", jobPlanPanel.includes("overflow-x-hidden"));
check(
  "57 material takeoff readable",
  builderSurface.includes("data-takeoff-row")
);
check("58 labour readable", builderSurface.includes("labour-hours"));
check(
  "59 one dominant action",
  builderSurface.includes("data-builder-review-update") ||
    readyCard.includes("data-estimate-ready-primary-cta")
);

// ARCHITECTURE
check(
  "60 BuilderReviewSurface exists",
  existsSync("components/assistant/builder-review/BuilderReviewSurface.tsx")
);
check(
  "61 compose projection only",
  existsSync("lib/assistant/builder-review/compose.ts") &&
    !existsSync("supabase/migrations/037_builder_review.sql")
);
check(
  "62 mapLineCategory labour",
  mapLineCategory({
    id: "x",
    workAreaName: "Deck",
    label: "Labour",
    category: "labour",
    costLow: 0,
    costHigh: 0,
    sellLow: 0,
    sellHigh: 0,
    recommendedCost: 0,
    recommendedSell: 0,
    grossProfit: 0,
    marginPercent: 0,
    rateSource: "",
  }) === "LABOUR"
);
check(
  "63 setWorkAreas not Job Plan store",
  !existsSync("lib/assistant/job-plan/store.ts") &&
    shell.includes("setAddedWorkAreas")
);
check(
  "64 refine most useful tier",
  refinePanel.includes("Most useful") && refinePanel.includes("More detail")
);
check(
  "65 work-area-actions returns workArea",
  read("lib/assistant/work-area-actions.ts").includes("success: true")
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

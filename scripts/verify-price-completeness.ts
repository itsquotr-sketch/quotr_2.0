/**
 * Price completeness — three displayed states, and the same states in the
 * review guards. GST and Pricing review stay out of the readiness label.
 *
 * Run: npx tsx scripts/verify-price-completeness.ts
 */
import type { BuilderReviewView } from "../lib/assistant/builder-review";
import {
  ADD_MISSING_RATE,
  CONFIRM_OPEN_SPECIFICATION,
  formatWorkAreaPriceSummary,
} from "../lib/assistant/presentation/estimate-issues";
import { projectWorkAreaBreakdown } from "../lib/assistant/presentation/work-area-breakdown";
import { PRICING_TAX_BASIS_MISMATCH_BLOCK } from "../lib/pricing/gst-source";
import {
  MISSING_GENERATED_RATE_REVIEW_BLOCK,
  missingGeneratedRateReviewBlock,
  UNRESOLVED_SCOPE_REVIEW_BLOCK,
  UNRESOLVED_SPECIFICATION_REVIEW_BLOCK,
  unresolvedScopeReviewBlock,
} from "../lib/pricing/scope-finalisation";

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

function line(id: string, rateLabel: string) {
  return {
    id,
    label: id,
    category: "MATERIALS" as const,
    recommendedCost: 100,
    recommendedSell: 120,
    quantity: 1,
    unit: "ea",
    labourHours: null,
    costRate: 100,
    rateLabel,
    labourRateLabel: null,
    productivityLabel: null,
    itemKey: null,
    componentKey: null,
    isAllowance: false,
    specification: null,
    supporting: null,
    detail: null,
    pricingHelper: null,
    rateContext: null,
    quantityFallback: null,
    sourceLine: {} as never,
  };
}

function area(name: string, rateLabel: string) {
  return {
    workAreaId: name.toLowerCase(),
    workAreaName: name,
    workAreaType: "deck",
    cost: 800,
    sell: 1000,
    categories: [
      {
        id: "MATERIALS" as const,
        label: "Materials",
        cost: 800,
        lines: [line(`${name}-line`, rateLabel)],
        takeoff: [],
        takeoffDisclaimer: null,
        takeoffUnavailableHint: null,
        takeoffCollapsedByDefault: false,
        takeoffTitle: "Planning takeoff",
        groupNotes: [],
        lineGroups: [],
      },
    ],
  };
}

function view(
  areas: ReturnType<typeof area>[],
  checks: string[]
): BuilderReviewView {
  return {
    overview: {
      recommendedSell: 1000,
      recommendedCost: 800,
      marginPercent: 20,
      confidenceBand: null,
      confidenceExplanation: null,
      marginSourceLabel: null,
      workAreaCount: areas.length,
      workAreaNames: areas.map((item) => item.workAreaName),
      categorySummary: [],
      isStale: false,
      partialEstimateLabel: null,
      recommendedSellIsPartial: false,
    },
    workAreas: areas,
    assumptions: [],
    checks: checks.map((label, index) => ({
      id: `c${index}`,
      kind: "check" as const,
      label,
      detail: null,
      editSection: "job_plan" as const,
    })),
    improvements: [],
    costReconciles: true,
    projectedCost: 800,
    estimateCost: 800,
    takeoffAffectsMoney: false,
    requirements: [],
  };
}

function displayed(text: string | null): boolean {
  return !/gst|pricing review/i.test(text ?? "");
}

const complete = projectWorkAreaBreakdown(view([area("Deck", "Company rate")], []));
check(
  "complete scope can say all priced lines",
  complete.cards[0]?.readiness === "All priced" &&
    complete.cards[0]?.nextAction == null &&
    complete.nextAction == null &&
    complete.sell === "$1,000" &&
    formatWorkAreaPriceSummary({
      workAreaCount: 1,
      missingPriceLineCount: 0,
      workAreasWithMissingPrices: 0,
    }) === "1 Work Area · All priced lines" &&
    unresolvedScopeReviewBlock([]) == null &&
    missingGeneratedRateReviewBlock([
      { cost_known: true, total_sell: 1000, visible_on_quote: true },
    ]) == null &&
    displayed(complete.cards[0]?.readiness)
);

const openScope = projectWorkAreaBreakdown(
  view(
    [area("Deck", "Company rate"), area("Fence", "Company rate")],
    ["Coverage is unresolved."]
  )
);
check(
  "priced lines with an open scope do not price the job",
  openScope.cards.every((card) => card.readiness === "Generated lines priced") &&
    openScope.cards.every((card) => card.nextAction === "1 requested task has no line") &&
    openScope.sell == null &&
    openScope.nextAction === "1 requested task has no line" &&
    formatWorkAreaPriceSummary({
      workAreaCount: 2,
      missingPriceLineCount: 0,
      workAreasWithMissingPrices: 0,
      scopeCoverageGapCount: 1,
    }) === "2 Work Areas · Generated lines priced" &&
    unresolvedScopeReviewBlock(["Coverage is unresolved."]) ===
      UNRESOLVED_SCOPE_REVIEW_BLOCK &&
    displayed(openScope.nextAction)
);

const openSpec = projectWorkAreaBreakdown(
  view([area("Deck", "Company rate")], ["What post size?"])
);
check(
  "an open specification asks for that specification",
  openSpec.cards[0]?.readiness === "Generated lines priced" &&
    openSpec.cards[0]?.nextAction === CONFIRM_OPEN_SPECIFICATION &&
    openSpec.sell == null &&
    unresolvedScopeReviewBlock(["What post size?"]) ===
      UNRESOLVED_SPECIFICATION_REVIEW_BLOCK &&
    displayed(CONFIRM_OPEN_SPECIFICATION)
);

const missing = projectWorkAreaBreakdown(
  view([area("Deck", "Pricing Required")], [])
);
check(
  "a generated line without a price asks for the rate",
  missing.cards[0]?.readiness !== "All priced" &&
    missing.cards[0]?.readiness !== "Generated lines priced" &&
    missing.cards[0]?.nextAction === ADD_MISSING_RATE &&
    missing.sell == null &&
    formatWorkAreaPriceSummary({
      workAreaCount: 1,
      missingPriceLineCount: 1,
      workAreasWithMissingPrices: 1,
    }) === "1 Work Area · 1 line needs a price" &&
    missingGeneratedRateReviewBlock([
      { cost_known: false, total_sell: 0, visible_on_quote: true },
    ]) === MISSING_GENERATED_RATE_REVIEW_BLOCK &&
    MISSING_GENERATED_RATE_REVIEW_BLOCK !== PRICING_TAX_BASIS_MISMATCH_BLOCK &&
    displayed(ADD_MISSING_RATE)
);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("price completeness passed");

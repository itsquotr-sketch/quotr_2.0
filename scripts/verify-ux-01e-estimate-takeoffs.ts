/**
 * UX-01E — Estimate takeoff and review views.
 *
 * Run: npx tsx scripts/verify-ux-01e-estimate-takeoffs.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BuilderReviewCategoryGroup,
  BuilderReviewLineGroup,
  BuilderReviewPricedLine,
  BuilderReviewView,
} from "../lib/assistant/builder-review";
import { STALE_ESTIMATE_EXPLANATION } from "../lib/assistant/mode/derive";
import {
  projectAssumptionsReview,
  projectLabourTakeoff,
  projectMaterialsTakeoff,
} from "../lib/assistant/presentation/estimate-takeoffs";

const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8").replace(/\r/g, "");
}

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

function line(partial: {
  id: string;
  label: string;
  category: BuilderReviewPricedLine["category"];
  recommendedCost?: number;
  recommendedSell?: number;
  quantity?: number | null;
  unit?: string | null;
  labourHours?: number | null;
  costRate?: number | null;
  rateLabel?: string;
  productivityLabel?: string | null;
  sourceCategory?: string;
}): BuilderReviewPricedLine {
  return {
    id: partial.id,
    label: partial.label,
    category: partial.category,
    recommendedCost: partial.recommendedCost ?? 0,
    recommendedSell: partial.recommendedSell ?? 0,
    quantity: partial.quantity ?? null,
    unit: partial.unit ?? null,
    labourHours: partial.labourHours ?? null,
    costRate: partial.costRate ?? null,
    rateLabel: partial.rateLabel ?? "Company rate",
    labourRateLabel: null,
    productivityLabel: partial.productivityLabel ?? null,
    itemKey: null,
    componentKey: null,
    isAllowance: false,
    specification: null,
    supporting: null,
    detail: null,
    pricingHelper: null,
    rateContext: null,
    quantityFallback: null,
    sourceLine: { category: partial.sourceCategory ?? "materials" } as never,
  };
}

function group(
  id: string,
  label: string,
  children: BuilderReviewPricedLine[],
  pricingRequired = false
): BuilderReviewLineGroup {
  return {
    id,
    label,
    recommendedCost: 0,
    supporting: null,
    secondary: null,
    itemKey: null,
    showChangeMaterial: false,
    rateContext: null,
    pricingRequired,
    children,
  };
}

function category(
  id: BuilderReviewCategoryGroup["id"],
  label: string,
  lines: BuilderReviewPricedLine[] = []
): BuilderReviewCategoryGroup {
  return {
    id,
    label,
    cost: 0,
    lines,
    takeoff: [],
    takeoffDisclaimer: null,
    takeoffUnavailableHint: null,
    takeoffCollapsedByDefault: true,
    takeoffTitle: "Planning takeoff",
    groupNotes: [],
    lineGroups: [],
  };
}

function view(partial: {
  isStale?: boolean;
  areas: BuilderReviewView["workAreas"];
  assumptions?: BuilderReviewView["assumptions"];
  checks?: BuilderReviewView["checks"];
}): BuilderReviewView {
  return {
    overview: {
      recommendedSell: 1000,
      recommendedCost: 800,
      marginPercent: 20,
      confidenceBand: null,
      confidenceExplanation: null,
      marginSourceLabel: null,
      workAreaCount: partial.areas.length,
      workAreaNames: partial.areas.map((area) => area.workAreaName),
      categorySummary: [],
      isStale: partial.isStale ?? false,
    },
    workAreas: partial.areas,
    assumptions: partial.assumptions ?? [],
    checks: partial.checks ?? [],
    improvements: [],
    costReconciles: true,
    projectedCost: 800,
    estimateCost: 800,
    takeoffAffectsMoney: false,
    requirements: [],
  };
}

const shell = read("components/assistant/AssistantShell.tsx");
const control = read("components/assistant/mode/WorkAreaBreakdown.tsx");
const takeoff = read("components/assistant/mode/EstimateTakeoffViews.tsx");
const projector = read("lib/assistant/presentation/estimate-takeoffs.ts");
const overview = read("components/assistant/mode/EstimateOverview.tsx");

check(
  "1 all five views, Overview default",
  shell.includes("initialEstimateSection = \"overview\"") &&
    shell.includes("data-estimate-view={estimateView}") &&
    control.includes('id: "overview", label: "Overview"') &&
    control.includes('id: "work_areas", label: "By work area"') &&
    control.includes('id: "materials", label: "Materials takeoff"') &&
    control.includes('id: "labour", label: "Labour takeoff"') &&
    control.includes('id: "checks", label: "Assumptions & checks"') &&
    shell.includes('estimateView === "materials"') &&
    shell.includes('estimateView === "labour"') &&
    shell.includes('estimateView === "checks"')
);

check(
  "2 switching is local and does not query or save",
  shell.includes("onChange={setEstimateView}") &&
    !shell.includes("projectMaterialsTakeoff") &&
    !shell.includes("projectLabourTakeoff") &&
    !shell.includes("projectAssumptionsReview") &&
    !/fetch\(|router\.refresh|revalidatePath|supabase|\.from\(|saveBriefAndSeedWorkAreas|useEffect/.test(
      takeoff + projector
    )
);

const sharedLine = line({
  id: "bolts",
  label: "Galvanised bolts",
  category: "MATERIALS",
  recommendedCost: 80,
  quantity: 20,
  unit: "ea",
  costRate: 4,
  rateLabel: "Company rate",
});
const shared = view({
  areas: [
    {
      workAreaId: "deck",
      workAreaName: "Deck",
      workAreaType: "deck",
      cost: 80,
      sell: 100,
      categories: [category("MATERIALS", "Materials")],
      sharedLineGroups: [group("shared-bolts", "Shared fixings", [sharedLine])],
      portionGroups: [
        {
          id: "ceiling",
          label: "Bedroom ceiling",
          summary: null,
          areaLabel: null,
          assumptions: [],
          lineGroups: [group("again", "Bedroom ceiling", [sharedLine])],
        },
      ],
    },
  ],
});
const sharedRows = projectMaterialsTakeoff(shared).groups.flatMap((group) => group.rows);
check(
  "3 shared material lines are not duplicated",
  sharedRows.filter((row) => row.id === "bolts").length === 1 &&
    sharedRows[0]?.shared === true &&
    sharedRows[0]?.portion === "Shared fixings"
);

const nested = view({
  areas: [
    {
      workAreaId: "house",
      workAreaName: "House",
      workAreaType: "house",
      cost: 400,
      sell: 500,
      categories: [category("MATERIALS", "Materials")],
      portionGroups: [
        {
          id: "ceiling",
          label: "Bedroom ceiling",
          summary: null,
          areaLabel: "12 m2",
          assumptions: ["Assumed sheet size"],
          lineGroups: [
            group("sheets", "Sheets", [
              line({
                id: "sheets",
                label: "Plasterboard 10mm",
                category: "MATERIALS",
                recommendedCost: 200,
                quantity: 12,
                unit: "m2",
                costRate: 16,
              }),
            ]),
          ],
        },
        {
          id: "walls",
          label: "Internal walls",
          summary: null,
          areaLabel: null,
          assumptions: [],
          lineGroups: [
            group("wall-sheets", "Sheets", [
              line({
                id: "wall-sheets",
                label: "Plasterboard 13mm",
                category: "MATERIALS",
                recommendedCost: 200,
                quantity: 10,
                unit: "m2",
                costRate: 20,
                rateLabel: "Derived Quotr benchmark",
              }),
            ]),
          ],
        },
      ],
    },
  ],
});
const nestedRows = projectMaterialsTakeoff(nested).groups.flatMap((group) => group.rows);
check(
  "4 nested portions remain identifiable",
  nestedRows.length === 2 &&
    nestedRows.some((row) => row.portion === "Bedroom ceiling" && row.description === "Plasterboard 10mm") &&
    nestedRows.some((row) => row.portion === "Internal walls" && row.description === "Plasterboard 13mm") &&
    nestedRows.some((row) => row.source === "Derived Quotr benchmark")
);

const required = view({
  areas: [
    {
      workAreaId: "fence",
      workAreaName: "Fence",
      workAreaType: "fence",
      cost: 0,
      sell: 0,
      categories: [
        category("PRICING_REQUIRED", "Pricing Required", [
          line({
            id: "posts",
            label: "H4 posts",
            category: "PRICING_REQUIRED",
            recommendedCost: 0,
            recommendedSell: 0,
            quantity: 12,
            unit: "ea",
            costRate: 0,
            rateLabel: "Rate required",
            sourceCategory: "materials",
          }),
        ]),
      ],
    },
  ],
});
const requiredModel = projectMaterialsTakeoff(required);
const requiredRow = requiredModel.groups[0]?.rows[0];
check(
  "5 Pricing Required never displays as $0",
  requiredModel.pricingRequiredCount === 1 &&
    requiredModel.knownCost == null &&
    requiredRow?.pricingRequired === true &&
    requiredRow.total == null &&
    requiredRow.unitCost == null &&
    requiredRow.source === "Pricing Required" &&
    !JSON.stringify(requiredModel).includes("$0") &&
    takeoff.includes("Pricing Required") &&
    projector.includes("This price is completed in Pricing.") &&
    takeoff.includes("TAKEOFF_PRICING_EXPLANATION")
);

const labour = view({
  areas: [
    {
      workAreaId: "deck",
      workAreaName: "Deck",
      workAreaType: "deck",
      cost: 400,
      sell: 500,
      categories: [
        category("LABOUR", "Labour", [
          line({
            id: "fix",
            label: "Fix decking",
            category: "LABOUR",
            recommendedCost: 400,
            recommendedSell: 500,
            quantity: 10,
            unit: "hrs",
            labourHours: 6,
            costRate: 50,
            rateLabel: "Quotr benchmark",
            productivityLabel: "Quotr benchmark",
            sourceCategory: "labour",
          }),
        ]),
      ],
    },
  ],
});
const labourModel = projectLabourTakeoff(labour);
const labourRow = labourModel.groups[0]?.rows[0];
check(
  "6 labour hours and costs are not recalculated",
  labourRow?.hours === "6.00 hrs" &&
    labourRow.total === "$400" &&
    labourRow.hourlyCost === "$50" &&
    labourRow.productivity === "Quotr benchmark" &&
    labourModel.knownHours === "6.00 hrs" &&
    labourModel.knownCost === "$400" &&
    labourRow.total !== "$500" &&
    !JSON.stringify(labourModel).includes("carpenter") &&
    !projector.includes("quantity * ") &&
    !projector.includes("costRate *")
);

const stale = view({
  isStale: true,
  areas: [
    {
      workAreaId: "deck",
      workAreaName: "Deck",
      workAreaType: "deck",
      cost: 400,
      sell: 500,
      categories: [
        category("MATERIALS", "Materials", [
          line({
            id: "boards",
            label: "Kwila decking",
            category: "MATERIALS",
            recommendedCost: 400,
            recommendedSell: 500,
            quantity: 10,
            unit: "m2",
            costRate: 50,
          }),
        ]),
      ],
    },
  ],
});
const staleModel = projectMaterialsTakeoff(stale);
check(
  "7 stale figures are labelled Previous estimate",
  staleModel.knownCostLabel === "Previous material cost" &&
    staleModel.knownCost === "$400" &&
    staleModel.staleWarning === STALE_ESTIMATE_EXPLANATION &&
    takeoff.includes("Previous estimate.") &&
    takeoff.includes("data-takeoff-regenerate") &&
    shell.includes("displayEstimateStale ? handleRegenerateEstimate : undefined") &&
    !takeoff.includes("onRegenerate()")
);

const reviewed = view({
  areas: [
    {
      workAreaId: "deck",
      workAreaName: "Deck",
      workAreaType: "deck",
      cost: 200,
      sell: 250,
      categories: [
        category("MATERIALS", "Materials", [
          line({
            id: "boards",
            label: "Kwila decking",
            category: "MATERIALS",
            recommendedCost: 200,
            rateLabel: "Quotr benchmark",
          }),
        ]),
      ],
      portionGroups: [
        {
          id: "floor",
          label: "Flooring",
          summary: null,
          areaLabel: null,
          assumptions: ["Assumed sheet size"],
          lineGroups: [],
        },
      ],
    },
  ],
  assumptions: [
    {
      id: "span",
      kind: "assumption",
      label: "Deck joist spacing follows the selected span",
      detail: "450 mm centres",
      editSection: "details",
    },
  ],
  checks: [
    {
      id: "confirm-span",
      kind: "check",
      label: "Confirm deck span",
      detail: null,
      editSection: "details",
    },
  ],
});
const review = projectAssumptionsReview(reviewed);
const deck = review.groups.find((group) => group.name === "Deck");
check(
  "8 assumptions retain their existing meaning",
  review.attentionCount === 1 &&
    review.assumptionCount === 2 &&
    deck?.attention[0]?.label === "Confirm deck span" &&
    deck.assumptions.some((item) => item.label === "Deck joist spacing follows the selected span") &&
    deck.assumptions.some((item) => item.label === "Assumed sheet size" && item.detail === "Flooring") &&
    deck.benchmarks.some((item) => item.label === "Kwila decking" && item.detail === "Quotr benchmark") &&
    !deck.assumptions.some((item) => item.label === "Confirm deck span") &&
    !("severity" in review) &&
    !takeoff.includes("approve") &&
    takeoff.includes('data-review-section={marker}') &&
    !takeoff.includes("<details open") &&
    overview.includes('marker="assumptions"') &&
    overview.includes('marker="benchmark"') &&
    !overview.includes("projectAssumptionsReview")
);

check(
  "9 mobile presentation does not require a wide page table",
  !takeoff.includes("<table") &&
    !control.includes("<table") &&
    takeoff.includes("overflow-x-hidden") &&
    takeoff.includes("lg:grid") &&
    takeoff.includes("lg:sr-only") &&
    takeoff.includes("min-h-11") &&
    takeoff.includes("[overflow-wrap:anywhere]") &&
    takeoff.includes("data-takeoff-search") &&
    control.includes("data-estimate-view-scroll") &&
    control.includes("md:flex") &&
    control.includes("flex-wrap") &&
    control.includes("overflow-x-hidden") &&
    shell.includes('className="min-w-0 space-y-3 overflow-x-hidden"')
);

check(
  "10 empty states stay explicit",
  takeoff.includes("No material lines in this estimate.") &&
    takeoff.includes("No labour lines in this estimate.") &&
    takeoff.includes("No assumptions or checks on this estimate.") &&
    projectMaterialsTakeoff(view({ areas: [] })).empty &&
    projectLabourTakeoff(view({ areas: [] })).empty &&
    projectAssumptionsReview(view({ areas: [] })).empty
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nUX-01E estimate takeoffs passed");

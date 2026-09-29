/**
 * UX-01D — By work area presentation.
 *
 * Run: npx tsx scripts/verify-ux-01d-work-area-breakdown.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BuilderReviewView } from "../lib/assistant/builder-review";
import { projectWorkAreaBreakdown } from "../lib/assistant/presentation/work-area-breakdown";

const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8").replace(/\r/g, "");
}

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

function view(partial: {
  isStale?: boolean;
  sell?: number;
  cost?: number;
  partialLabel?: string | null;
  areas: BuilderReviewView["workAreas"];
  assumptions?: BuilderReviewView["assumptions"];
  checks?: BuilderReviewView["checks"];
}): BuilderReviewView {
  return {
    overview: {
      recommendedSell: partial.sell ?? 1000,
      recommendedCost: partial.cost ?? 800,
      marginPercent: 20,
      confidenceBand: null,
      confidenceExplanation: null,
      marginSourceLabel: null,
      workAreaCount: partial.areas.length,
      workAreaNames: partial.areas.map((area) => area.workAreaName),
      categorySummary: [],
      isStale: partial.isStale ?? false,
      partialEstimateLabel: partial.partialLabel ?? null,
      recommendedSellIsPartial: Boolean(partial.partialLabel),
    },
    workAreas: partial.areas,
    assumptions: partial.assumptions ?? [],
    checks: partial.checks ?? [],
    improvements: [],
    costReconciles: true,
    projectedCost: partial.cost ?? 800,
    estimateCost: partial.cost ?? 800,
    takeoffAffectsMoney: false,
    requirements: [],
  };
}

const shell = read("components/assistant/AssistantShell.tsx");
const breakdown = read("components/assistant/mode/WorkAreaBreakdown.tsx");
const projector = read("lib/assistant/presentation/work-area-breakdown.ts");
const overview = read("components/assistant/mode/EstimateOverview.tsx");

const reviewHandler = shell.slice(
  shell.indexOf("onReviewEstimate={() => {"),
  shell.indexOf("onReviewEstimate={() => {") + 180
);

check(
  "1 Overview remains the default",
  shell.includes('useState<EstimatePresentationView>("overview")') &&
    shell.includes("data-estimate-view={estimateView}") &&
    breakdown.includes("data-estimate-view-tab={item.id}") &&
    breakdown.includes('id: "overview", label: "Overview"')
);

check(
  "2 View work area breakdown changes presentation only",
  overview.includes("View work area breakdown") &&
    reviewHandler.includes('setEstimateView("work_areas")') &&
    !reviewHandler.includes("router.refresh") &&
    !reviewHandler.includes("fetch(") &&
    !reviewHandler.includes("saveBrief") &&
    shell.includes("onChange={setEstimateView}") &&
    breakdown.includes('id: "overview", label: "Overview"') &&
    !breakdown.includes("Back to overview") &&
    !breakdown.includes("data-back-to-overview")
);

const priced = view({
  areas: [
    {
      workAreaId: "deck",
      workAreaName: "Deck",
      workAreaType: "deck",
      cost: 800,
      sell: 1000,
      categories: [
        {
          id: "MATERIALS",
          label: "Materials",
          cost: 500,
          lines: [
            {
              id: "boards",
              label: "Kwila decking",
              category: "MATERIALS",
              recommendedCost: 500,
              recommendedSell: 600,
              quantity: 18,
              unit: "m2",
              labourHours: null,
              costRate: 28,
              rateLabel: "Company rate",
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
            },
          ],
          takeoff: [
            {
              requirementId: "area",
              componentKey: "deck.area",
              label: "Deck area",
              quantity: 18,
              unit: "m2",
              specification: null,
              detail: null,
              confidenceLabel: null,
              commercial: false,
              parentAllowanceHint: null,
            },
          ],
          takeoffDisclaimer: null,
          takeoffUnavailableHint: null,
          takeoffCollapsedByDefault: false,
          takeoffTitle: "Planning takeoff",
          groupNotes: [],
          lineGroups: [],
        },
        {
          id: "LABOUR",
          label: "Labour",
          cost: 300,
          lines: [
            {
              id: "fix",
              label: "Fix decking",
              category: "LABOUR",
              recommendedCost: 300,
              recommendedSell: 400,
              quantity: 6,
              unit: "hrs",
              labourHours: 6,
              costRate: 50,
              rateLabel: "Quotr benchmark",
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
            },
          ],
          takeoff: [],
          takeoffDisclaimer: null,
          takeoffUnavailableHint: null,
          takeoffCollapsedByDefault: false,
          takeoffTitle: "Planning takeoff",
          groupNotes: [],
          lineGroups: [],
        },
      ],
    },
  ],
  assumptions: [
    {
      id: "a1",
      kind: "assumption",
      label: "Assuming standard access",
      detail: null,
      editSection: "details",
    },
  ],
  checks: [
    {
      id: "c1",
      kind: "check",
      label: "Confirm the finish level",
      detail: null,
      editSection: "job_plan",
    },
  ],
});

const pricedModel = projectWorkAreaBreakdown(priced, [
  {
    workAreaId: "deck",
    name: "Deck",
    included: ["Decking boards"],
    excluded: ["Painting"],
  },
]);
const deck = pricedModel.cards[0];
check(
  "3 Work Area cards use existing presentation data",
  pricedModel.title === "Estimate by Work Area" &&
    pricedModel.workAreaCount === 1 &&
    pricedModel.directCost === "$800" &&
    pricedModel.sell === "$1,000" &&
    deck?.name === "Deck" &&
    deck.readiness === "All priced" &&
    deck.directCost === "$800" &&
    deck.indicativeSell === "$1,000" &&
    deck.labourHours === "6.00 hrs" &&
    deck.composition === "Materials · Labour" &&
    deck.included[0] === "Decking boards" &&
    deck.excluded[0] === "Painting" &&
    deck.quantities[0]?.quantity === "18 m2" &&
    deck.costGroups.some((group) => group.lines.some((line) => line.source === "Company rate")) &&
    deck.costGroups.some((group) => group.lines.some((line) => line.source === "Quotr benchmark")) &&
    deck.assumptions[0] === "Assuming standard access" &&
    deck.checks[0] === "Confirm the finish level"
);

const required = view({
  sell: 0,
  cost: 0,
  partialLabel: "Some Fence items still require pricing.",
  areas: [
    {
      workAreaId: "fence",
      workAreaName: "Fence",
      workAreaType: "fence",
      cost: 0,
      sell: 0,
      partialEstimateLabel: "Some Fence items still require pricing.",
      categories: [
        {
          id: "MATERIALS",
          label: "Materials",
          cost: 0,
          lines: [
            {
              id: "posts",
              label: "Fence posts",
              category: "MATERIALS",
              recommendedCost: 0,
              recommendedSell: 0,
              quantity: 12,
              unit: "each",
              labourHours: null,
              costRate: 0,
              rateLabel: "Rate required",
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
            },
          ],
          takeoff: [],
          takeoffDisclaimer: null,
          takeoffUnavailableHint: null,
          takeoffCollapsedByDefault: false,
          takeoffTitle: "Planning takeoff",
          groupNotes: [],
          lineGroups: [],
        },
      ],
    },
  ],
});
const requiredModel = projectWorkAreaBreakdown(required);
const requiredJson = JSON.stringify(requiredModel);
check(
  "4 Pricing Required does not display $0",
  requiredModel.cards[0]?.readiness === "Pricing Required" &&
    requiredModel.cards[0]?.directCost == null &&
    requiredModel.cards[0]?.indicativeSell == null &&
    requiredModel.sell == null &&
    requiredModel.directCost == null &&
    requiredModel.cards[0]?.attention[0]?.detail === "This price is completed in Pricing." &&
    requiredModel.cards[0]?.costGroups[0]?.lines[0]?.total == null &&
    requiredModel.cards[0]?.costGroups[0]?.lines[0]?.source === "Pricing Required" &&
    !requiredJson.includes("$0")
);

const stale = view({
  isStale: true,
  areas: priced.workAreas,
});
const staleModel = projectWorkAreaBreakdown(stale);
check(
  "5 stale figures are not represented as current",
  staleModel.staleWarning != null &&
    staleModel.sell == null &&
    staleModel.directCost == null &&
    staleModel.previousDirectCost === "$800" &&
    staleModel.cards[0]?.readiness === "Previous estimate" &&
    staleModel.cards[0]?.directCost == null &&
    staleModel.cards[0]?.indicativeSell == null &&
    staleModel.cards[0]?.previousDirectCost === "$800"
);

const nested = view({
  areas: [
    {
      workAreaId: "ceilings",
      workAreaName: "Ceilings",
      workAreaType: "ceilings",
      cost: 400,
      sell: 500,
      portionGroups: [
        {
          id: "portion-a",
          label: "Bedroom ceiling",
          summary: "Plasterboard",
          areaLabel: "12 m2",
          lineGroups: [
            {
              id: "a-materials",
              label: "Sheets",
              recommendedCost: 200,
              supporting: null,
              secondary: null,
              itemKey: null,
              showChangeMaterial: false,
              rateContext: null,
              children: [
                {
                  id: "sheets-a",
                  label: "Bedroom sheets",
                  category: "MATERIALS",
                  recommendedCost: 200,
                  recommendedSell: 250,
                  quantity: 4,
                  unit: "sheet",
                  labourHours: null,
                  costRate: 50,
                  rateLabel: "Company rate",
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
                },
              ],
            },
          ],
          assumptions: ["Assumed sheet size"],
        },
        {
          id: "portion-b",
          label: "Hall ceiling",
          summary: "Plasterboard",
          areaLabel: "8 m2",
          lineGroups: [
            {
              id: "b-materials",
              label: "Sheets",
              recommendedCost: 200,
              supporting: null,
              secondary: null,
              itemKey: null,
              showChangeMaterial: false,
              rateContext: null,
              children: [
                {
                  id: "sheets-b",
                  label: "Hall sheets",
                  category: "MATERIALS",
                  recommendedCost: 200,
                  recommendedSell: 250,
                  quantity: 3,
                  unit: "sheet",
                  labourHours: null,
                  costRate: 50,
                  rateLabel: "Derived Quotr benchmark",
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
                },
              ],
            },
          ],
          assumptions: [],
        },
      ],
      categories: [],
    },
  ],
});
const nestedCard = projectWorkAreaBreakdown(nested).cards[0];
check(
  "6 nested Work Area data is preserved",
  nestedCard?.portions.length === 2 &&
    nestedCard.portions[0]?.label === "Bedroom ceiling" &&
    nestedCard.portions[1]?.label === "Hall ceiling" &&
    nestedCard.portions[0]?.areaLabel === "12 m2" &&
    nestedCard.portions[1]?.groups[0]?.lines[0]?.description === "Hall sheets" &&
    nestedCard.portions[0]?.assumptions[0] === "Assumed sheet size" &&
    nestedCard.costGroups.length === 0
);

check(
  "7 no new query or server action is introduced",
  !/supabase|\.from\(|fetch\(|router\.refresh|useEffect|revalidatePath|saveBriefAndSeedWorkAreas/.test(
    projector + breakdown
  ) &&
    shell.includes("composeBuilderReview({") &&
    !shell.includes("projectWorkAreaBreakdown")
);

check(
  "8 mobile layout has no required wide table",
  !breakdown.includes("<table") &&
    breakdown.includes("overflow-x-hidden") &&
    breakdown.includes("lg:grid") &&
    breakdown.includes("min-h-11") &&
    breakdown.includes("[overflow-wrap:anywhere]")
);

check(
  "9 accessible disclosure controls are present",
  breakdown.includes("aria-expanded={open}") &&
    breakdown.includes('role="tablist"') &&
    breakdown.includes("aria-selected={selected}") &&
    breakdown.includes("<details") &&
    !breakdown.includes("<details open") &&
    breakdown.includes("focus-visible:outline")
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nUX-01D work area breakdown checks passed");

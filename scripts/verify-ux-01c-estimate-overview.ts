/**
 * UX-01C — Estimate overview presentation.
 *
 * Run: npx tsx scripts/verify-ux-01c-estimate-overview.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectCommercialOverviewBreakdown } from "../lib/assistant/presentation/commercial-overview-projection";
import {
  ESTIMATE_OVERVIEW_BOUNDARY_COPY,
  projectEstimateOverview,
  type EstimateOverviewReview,
  type ProjectEstimateOverviewInput,
} from "../lib/assistant/presentation/estimate-overview";
import { isEstimateReadyForPricing } from "../lib/estimate/persist-estimate-generation";

const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8").replace(/\r/g, "");
}

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

function money(sell: number, cost: number) {
  return {
    recommendedSell: sell,
    recommendedCost: cost,
    grossProfit: sell - cost,
    marginPercent: sell > 0 ? ((sell - cost) / sell) * 100 : 0,
    markupPercent: cost > 0 ? ((sell - cost) / cost) * 100 : 0,
  };
}

function review(partial?: Partial<EstimateOverviewReview>): EstimateOverviewReview {
  return {
    overview: {
      workAreaNames: ["Deck", "Fence"],
      partialEstimateLabel: null,
      recommendedSellIsPartial: false,
      ...partial?.overview,
    },
    workAreas: partial?.workAreas ?? [
      {
        workAreaName: "Deck",
        partialEstimateLabel: null,
        categories: [],
      },
      {
        workAreaName: "Fence",
        partialEstimateLabel: null,
        categories: [],
      },
    ],
    assumptions: partial?.assumptions ?? [],
    checks: partial?.checks ?? [],
    improvements: partial?.improvements ?? [],
  };
}

function input(
  overrides: Partial<ProjectEstimateOverviewInput>
): ProjectEstimateOverviewInput {
  return {
    hasEstimate: true,
    isStale: false,
    detailsOutstanding: false,
    estimate: money(1000, 800),
    gstRate: 15,
    breakdown: {
      materialsCost: 400,
      labourCost: 300,
      labourHours: 12,
      allowancesCost: null,
      subcontractCost: null,
      plantCost: null,
      otherCost: null,
    },
    review: review(),
    readinessBlockers: [],
    rateSourceSummary: null,
    pricingDocumentExists: false,
    specialistPricingNotice: null,
    workAreaNames: ["Deck", "Fence"],
    ...overrides,
  };
}

const none = projectEstimateOverview(
  input({
    hasEstimate: false,
    estimate: null,
    review: null,
    breakdown: null,
    workAreaNames: [],
    detailsOutstanding: false,
  })
);
check("1 no estimate is incomplete and has no money", none.status === "incomplete" && none.sell.presentation === "hidden" && none.composition.length === 0 && none.sell.exGst == null);
check("1 no estimate continues information entry", none.primary === "continue_information" && none.primaryLabel === "Continue entering information");
check("1 no estimate blocks Pricing creation", none.pricingCreationBlocked && none.pricingEntry === "blocked");

const incomplete = projectEstimateOverview(
  input({
    hasEstimate: false,
    estimate: null,
    review: null,
    breakdown: null,
    detailsOutstanding: true,
    readinessBlockers: ["I need the deck dimensions or area before I can estimate this."],
  })
);
check("2 incomplete estimate asks for required Details", incomplete.status === "incomplete" && incomplete.primary === "complete_details");
check("2 readiness blocker is required and blocks Pricing", incomplete.required.length === 1 && incomplete.required[0]?.blocksPricing === true && incomplete.pricingCreationBlocked);

const current = projectEstimateOverview(input({}));
check("3 current estimate can continue to Pricing", current.status === "current" && current.primary === "continue_pricing" && current.pricingEntry === "create" && !current.pricingCreationBlocked);
check("3 current sell shows ex GST, GST, and incl GST", current.sell.presentation === "current" && current.sell.exGst === "$1,000" && current.sell.gst === "$150" && current.sell.inclGst === "$1,150");
check("3 boundary copy stays an estimate, not a quote", current.sell.boundaryCopy === ESTIMATE_OVERVIEW_BOUNDARY_COPY && current.sell.boundaryCopy.includes("not a client quote"));

const stale = projectEstimateOverview(input({ isStale: true }));
check("4 stale says inputs changed and is not current money", stale.status === "stale" && /latest job details/i.test(stale.statusDetail) && stale.sell.presentation === "previous" && stale.composition.length === 0);
check("4 stale keeps regenerate and blocks Pricing creation", stale.primary === "regenerate" && stale.primaryLabel === "Regenerate estimate" && stale.pricingCreationBlocked && stale.pricingEntry === "blocked");

const pricingRequired = projectEstimateOverview(
  input({
    estimate: money(0, 0),
    breakdown: {
      materialsCost: null,
      labourCost: null,
      labourHours: null,
      allowancesCost: null,
      subcontractCost: null,
      plantCost: null,
      otherCost: null,
    },
    review: review({
      overview: {
        workAreaNames: ["Fence"],
        partialEstimateLabel: "Some Fence items still require pricing.",
        recommendedSellIsPartial: true,
      },
      workAreas: [
        {
          workAreaName: "Fence",
          partialEstimateLabel: "Some Fence items still require pricing.",
          categories: [
            {
              id: "PRICING_REQUIRED",
              lineGroups: [
                {
                  id: "gate",
                  label: "Manufactured gate",
                  pricingRequired: true,
                  children: [{ id: "gate-line" }],
                },
              ],
              lines: [{ id: "gate-line", label: "Manufactured gate" }],
            },
          ],
        },
      ],
    }),
  })
);
check("5 Pricing Required stays unresolved with no invented money", pricingRequired.status === "pricing_required" && pricingRequired.sell.presentation === "unresolved" && pricingRequired.sell.exGst == null && pricingRequired.composition.length === 0);
check("5 Pricing Required counts as a required action", pricingRequired.requiredCount === 1 && pricingRequired.required[0]?.title === "Manufactured gate" && pricingRequired.required[0]?.money == null);
check("5 Pricing Required does not add a new Pricing-creation block", !pricingRequired.pricingCreationBlocked && pricingRequired.pricingEntry === "create");

const known = projectEstimateOverview(input({}));
check("6 known material cost is shown", known.composition.some((row) => row.id === "materials" && row.value === "$400"));
check("6 known labour hours and labour cost are shown", known.composition.some((row) => row.id === "labour-hours" && row.value === "12.0 hrs") && known.composition.some((row) => row.id === "labour" && row.value === "$300"));
check("6 direct cost, profit, and margin come from the existing estimate", known.composition.some((row) => row.id === "direct" && row.value === "$800") && known.composition.some((row) => row.id === "profit") && known.composition.some((row) => row.id === "margin"));

const unresolvedCategory = projectEstimateOverview(
  input({
    breakdown: {
      materialsCost: 400,
      labourCost: null,
      labourHours: null,
      allowancesCost: 0,
      subcontractCost: null,
      plantCost: null,
      otherCost: 0,
    },
  })
);
check("7 unknown or zero categories are omitted", !unresolvedCategory.composition.some((row) => row.id === "plant" || row.id === "allowances" || row.id === "other" || row.id === "labour" || row.value === "$0"));

const mixed = projectEstimateOverview(
  input({
    rateSourceSummary: "Quotr benchmark rates",
    review: review({
      assumptions: [{ id: "a1", label: "Assuming standard access" }],
      checks: [{ id: "c1", label: "Confirm the finish level" }],
      improvements: [{ id: "r1", label: "Replace the benchmark timber rate", reason: "Company rate is missing" }],
    }),
  })
);
check("8 assumptions and benchmark notes are optional", mixed.accuracy.length === 2 && mixed.rates.length >= 1 && mixed.accuracy.every((item) => !item.blocksPricing) && mixed.rates.every((item) => !item.blocksPricing));
check("8 optional notices do not block Pricing", !mixed.pricingCreationBlocked && mixed.primary === "continue_pricing");
check("8 required count does not include optional notices", mixed.requiredCount === 0);

check("9 stale Pricing stays blocked by the existing readiness rule", isEstimateReadyForPricing({ estimateId: "est", requirementGenerationId: "gen", latestRequirementSnapshotId: "snap", status: "ready", isStale: true }).ok === false && stale.pricingCreationBlocked);
check("9 missing estimate stays blocked", none.pricingCreationBlocked);
check("10 current estimate can continue under the existing rule", isEstimateReadyForPricing({ estimateId: "est", requirementGenerationId: "gen", latestRequirementSnapshotId: "snap", status: "ready", isStale: false }).ok === true && current.pricingEntry === "create");
check("10 an existing Pricing document opens instead of creating another", projectEstimateOverview(input({ pricingDocumentExists: true })).pricingEntry === "open" && projectEstimateOverview(input({ pricingDocumentExists: true })).primary === "continue_pricing");

const overviewSource = read("lib/assistant/presentation/estimate-overview.ts");
const componentSource = read("components/assistant/mode/EstimateOverview.tsx");
const shellSource = read("components/assistant/AssistantShell.tsx");
const pageSource = read("app/(protected)/app/projects/[projectId]/page.tsx");
check("11 overview adds no database query or client fetch", !/supabase|\.from\(|fetch\(|useEffect/.test(overviewSource) && !/supabase|\.from\(|fetch\(/.test(componentSource));
check("11 project page loader is unchanged by a new query", pageSource.includes("measureServerLoad(\"project\"") && pageSource.includes("getAssistantStateWithContext") && !pageSource.includes("estimate-overview"));
check("11 commercial breakdown is still the Builder Review projection", overviewSource.includes("CommercialOverviewBreakdown") && shellSource.includes("projectCommercialOverviewBreakdown") && typeof projectCommercialOverviewBreakdown === "function");
check("12 mobile layout stacks and does not use a desktop table", componentSource.includes("grid-cols-1") && componentSource.includes("sm:grid-cols-2") && componentSource.includes("xl:grid-cols-4") && componentSource.includes("overflow-x-hidden") && componentSource.includes("order-2") && componentSource.includes("xl:order-3") && !componentSource.includes("<table"));
check("12 one primary action slot", (componentSource.match(/data-estimate-overview-primary=/g) ?? []).length >= 4 && componentSource.includes("PrepareFinalPricingButton") && !componentSource.includes("createPricingFromEstimate"));
check("13 no client-document impact", !/client_description|PublicQuote|quote-document|notes_to_client/.test(overviewSource + componentSource) && !shellSource.includes("sanitizeClientQuoteDescription"));

const workAreas = projectEstimateOverview(input({}));
check("work areas list names and do not invent a confidence score", workAreas.workAreas.count === 2 && workAreas.workAreas.names.join(",") === "Deck,Fence" && workAreas.workAreas.missingPricingCount === 0 && !/confidence/i.test(JSON.stringify(workAreas.workAreas)));
check("Pricing Required work area is counted without a dollar amount", pricingRequired.workAreas.missingPricingCount === 1 && pricingRequired.workAreas.rows[0]?.note === "Pricing Required");

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nUX-01C estimate overview checks passed");

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
  ESTIMATE_OVERVIEW_ROUNDED_NOTE,
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
      allowancesCost: 100,
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
check("4 stale blocker is the existing explanation", stale.requiredCount === 1 && stale.required[0]?.blocksPricing === true && /latest job details/i.test(stale.required[0]?.title ?? ""));

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
check("5 Pricing Required needs attention and does not block Pricing", pricingRequired.requiredCount === 0 && pricingRequired.pricingAttentionCount === 1 && pricingRequired.pricingAttention[0]?.title === "Manufactured gate" && pricingRequired.pricingAttention[0]?.blocksPricing === false && pricingRequired.pricingAttention[0]?.money == null && pricingRequired.pricingAttention[0]?.group === "pricing_attention");
check("5 Pricing Required does not add a new Pricing-creation block", !pricingRequired.pricingCreationBlocked && pricingRequired.pricingEntry === "create");

const known = projectEstimateOverview(input({}));
check("6 known material cost is shown", known.composition.some((row) => row.id === "materials" && row.value === "$400"));
check("6 known labour hours and labour cost are shown", known.composition.some((row) => row.id === "labour-hours" && row.value === "12.0 hrs") && known.composition.some((row) => row.id === "labour" && row.value === "$300"));
check("6 direct cost, profit, and margin come from the existing estimate", known.composition.some((row) => row.id === "direct" && row.value === "$800") && known.composition.some((row) => row.id === "profit") && known.composition.some((row) => row.id === "margin"));
check("6 displayed categories reconcile to direct cost", known.reconciliation.state === "exact" && known.reconciliation.note == null && known.composition.filter((row) => ["materials", "labour", "allowances"].includes(row.id)).length === 3);

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
check("7 a gap is not filled with an invented Other amount", unresolvedCategory.reconciliation.state === "unreconciled" && unresolvedCategory.reconciliation.note == null && !unresolvedCategory.composition.some((row) => row.id === "other"));

const rounded = projectEstimateOverview(
  input({
    estimate: money(400, 300.8),
    breakdown: {
      materialsCost: 100.4,
      labourCost: 200.4,
      labourHours: null,
      allowancesCost: null,
      subcontractCost: null,
      plantCost: null,
      otherCost: null,
    },
  })
);
check(
  "7 rounding gap is labelled and not forced with Other",
  rounded.reconciliation.state === "rounded" &&
    rounded.reconciliation.note === ESTIMATE_OVERVIEW_ROUNDED_NOTE &&
    !rounded.composition.some((row) => row.id === "other") &&
    rounded.composition.some((row) => row.id === "materials" && row.value === "$100") &&
    rounded.composition.some((row) => row.id === "direct" && row.value === "$301")
);

const withWaste = projectEstimateOverview(
  input({
    estimate: money(500, 400),
    breakdown: {
      materialsCost: null,
      labourCost: null,
      labourHours: 4,
      allowancesCost: null,
      subcontractCost: null,
      plantCost: null,
      otherCost: null,
    },
    review: review({
      overview: {
        workAreaNames: ["Deck"],
        categorySummary: [
          { id: "MATERIALS", label: "Materials", cost: 350 },
          { id: "WASTE", label: "Waste", cost: 50 },
        ],
      },
    }),
  })
);
check(
  "7 omitted Waste is shown and reconciles",
  withWaste.composition.some((row) => row.id === "waste" && row.value === "$50") &&
    withWaste.composition.some((row) => row.id === "materials" && row.value === "$350") &&
    withWaste.reconciliation.state === "exact" &&
    !withWaste.composition.some((row) => row.id === "other")
);

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
check("8 required count does not include optional notices", mixed.requiredCount === 0 && mixed.pricingAttentionCount === 0);
check("8 assumptions stay listed with a collapsed summary", mixed.assumptionSummary === "1 assumption and 1 check to review" && mixed.accuracy.some((item) => item.title === "Assuming standard access") && mixed.accuracy.some((item) => item.title === "Confirm the finish level"));
check("8 benchmark notice stays listed", mixed.benchmarkSummary === "2 benchmark notices" && mixed.rates.some((item) => item.title === "Some rates use Quotr benchmarks") && mixed.rates.some((item) => item.title === "Replace the benchmark timber rate"));

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
check("12 mobile layout stacks and does not use a desktop table", componentSource.includes("grid-cols-1") && componentSource.includes("sm:grid-cols-2") && componentSource.includes("xl:grid-cols-4") && componentSource.includes("overflow-x-hidden") && componentSource.indexOf('className="order-1') < componentSource.indexOf('className="order-2') && !componentSource.includes("<table") && !componentSource.includes("xl:order-"));
check("12 one primary action slot", (componentSource.match(/data-estimate-overview-primary=/g) ?? []).length >= 4 && componentSource.includes("PrepareFinalPricingButton") && !componentSource.includes("createPricingFromEstimate"));
check("13 no client-document impact", !/client_description|PublicQuote|quote-document|notes_to_client/.test(overviewSource + componentSource) && !shellSource.includes("sanitizeClientQuoteDescription"));

const workAreas = projectEstimateOverview(input({}));
check("work areas list names and do not invent a confidence score", workAreas.workAreas.count === 2 && workAreas.workAreas.names.join(",") === "Deck,Fence" && workAreas.workAreas.missingPricingCount === 0 && workAreas.workAreas.summaryLine === "2 Work Areas · All priced" && !/confidence/i.test(JSON.stringify(workAreas.workAreas)));
check("Pricing Required work area is counted without a dollar amount", pricingRequired.workAreas.missingPricingCount === 1 && pricingRequired.workAreas.summaryLine === "1 Work Area · 1 needs a price" && pricingRequired.workAreas.rows[0]?.note === "Pricing Required");

const linkSource = read("components/pricing/PrepareFinalPricingButton.tsx");
check("R1 no duplicate commercial summary on the Estimate page", !componentSource.includes("Commercial Overview") && shellSource.includes('assistantMode === "estimate_ready" && "grid-cols-1"') && !/estimate_ready"\s*&&\s*\n\s*"lg:grid-cols-\[minmax\(0,1fr\)_380px\]"/.test(shellSource) && shellSource.includes('assistantMode === "planning" ? (') && shellSource.includes("compactCommercialSidebar={false}"));
check("R1 zero blockers say Ready for Pricing", componentSource.includes("Ready for Pricing") && componentSource.includes("No required issues remain.") && !componentSource.includes("Required items are listed below"));
check("R1 Pricing Required wording does not say it blocks Pricing", componentSource.includes("Needs attention in Pricing") && componentSource.includes('data-estimate-overview-pricing-attention="true"'));
check("R1 optional assumptions and benchmarks are collapsed disclosures", componentSource.includes("<details") && !componentSource.includes("<details open") && componentSource.includes("data-estimate-overview-disclosure") && componentSource.includes('marker="assumptions"') && componentSource.includes('marker="benchmark"') && componentSource.includes("assumptionSummary"));
check("R1 action labels keep existing destinations", componentSource.includes("View work area breakdown") && componentSource.includes("editJobDetails") && componentSource.includes("label={model.primaryLabel}") && linkSource.includes("pricing/${pricingDocumentId}") && linkSource.includes('label = "Open Pricing"') && shellSource.includes("setBuilderReviewOpen(true)") && shellSource.includes("openEditJob(null)"));
check("R1 only Continue to Pricing uses the orange primary", componentSource.includes("pricingPrimaryClassName") && componentSource.includes("var(--brand-orange)") && componentSource.includes('data-estimate-overview-primary="continue_pricing"'));
check("R1 Estimate Basis is collapsed and keeps its sections", shellSource.includes("const [jobDetailsOpen, setJobDetailsOpen] = useState(false)") && shellSource.includes("Project brief") && shellSource.includes("Finish level") && shellSource.includes("Project conditions") && !shellSource.includes(".slice(0, 8)") && !shellSource.includes(".slice(0, 4)"));
check("R1 no new query or fetch contract", !/supabase|\.from\(|fetch\(/.test(overviewSource + componentSource) && pageSource.includes('measureServerLoad("project"') && pageSource.includes("getAssistantStateWithContext"));

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nUX-01C estimate overview checks passed");

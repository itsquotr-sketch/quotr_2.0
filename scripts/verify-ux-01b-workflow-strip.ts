/**
 * UX-01B — project workflow orientation.
 *
 * Run: npx tsx scripts/verify-ux-01b-workflow-strip.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveProjectWorkflow,
  projectWorkflowRoutes,
  type ProjectWorkflowInput,
  type WorkflowStageModel,
} from "../lib/projects/workflow-orientation";
import { variationEligibility } from "../lib/variations/presentation";

const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8").replace(/\r/g, "");
}

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

function input(
  overrides: Partial<ProjectWorkflowInput> & Pick<ProjectWorkflowInput, "activeTab">
): ProjectWorkflowInput {
  return {
    projectId: "project-1",
    hasEstimate: false,
    estimateIsStale: false,
    pricingSummary: null,
    pricingUnresolvedRequired: null,
    quoteSummary: null,
    variations: null,
    ...overrides,
  };
}

function stage(model: { stages: readonly WorkflowStageModel[] }, id: WorkflowStageModel["id"]) {
  const found = model.stages.find((item) => item.id === id);
  if (!found) throw new Error(`missing stage ${id}`);
  return found;
}

const beforeEstimate = deriveProjectWorkflow(input({ activeTab: "assistant" }));
check(
  "1 before an estimate, Estimate is not started",
  stage(beforeEstimate, "estimate").status === "Not started" &&
    stage(beforeEstimate, "estimate").href === "/app/projects/project-1"
);
check(
  "1 Pricing stays locked with no route",
  stage(beforeEstimate, "pricing").status === "Locked" &&
    stage(beforeEstimate, "pricing").href === null
);

const currentEstimate = deriveProjectWorkflow(
  input({ activeTab: "assistant", hasEstimate: true })
);
check(
  "2 current estimate is Ready and still not described as finished pricing",
  stage(currentEstimate, "estimate").status === "Ready" &&
    stage(currentEstimate, "estimate").displayStatus.includes("Current") &&
    stage(currentEstimate, "pricing").status === "Ready" &&
    stage(currentEstimate, "pricing").href === null
);

const stale = deriveProjectWorkflow(
  input({ activeTab: "assistant", hasEstimate: true, estimateIsStale: true })
);
check(
  "3 stale estimate needs attention and does not open Pricing",
  stage(stale, "estimate").status === "Needs attention" &&
    stage(stale, "pricing").status === "Locked" &&
    stage(stale, "pricing").href === null &&
    stage(stale, "estimate").displayStatus.includes("Needs attention")
);

const pricingUnavailable = projectWorkflowRoutes({
  projectId: "project-1",
  hasEstimate: false,
  estimateIsStale: false,
  pricingSummary: null,
  quoteSummary: null,
});
check(
  "4 Pricing unavailable matches the tab lock",
  pricingUnavailable.pricingBlocked === true && pricingUnavailable.pricingHref === null
);

const pricingOpen = deriveProjectWorkflow(
  input({
    activeTab: "pricing",
    hasEstimate: true,
    pricingSummary: { id: "price-1", status: "draft" },
  })
);
const pricingReviewedUnresolved = deriveProjectWorkflow(
  input({
    activeTab: "pricing",
    hasEstimate: true,
    pricingSummary: { id: "price-1", status: "reviewed" },
    pricingUnresolvedRequired: true,
  })
);
const pricingReviewed = deriveProjectWorkflow(
  input({
    activeTab: "estimate",
    hasEstimate: true,
    pricingSummary: { id: "price-1", status: "reviewed" },
    pricingUnresolvedRequired: false,
  })
);
check(
  "5 Pricing available uses the existing document route",
  stage(pricingOpen, "pricing").href === "/app/projects/project-1/pricing/price-1" &&
    stage(pricingOpen, "pricing").status === "Needs attention"
);
check(
  "5 reviewed Pricing with a missing required price is not treated as finished",
  stage(pricingReviewedUnresolved, "pricing").status === "Needs attention" &&
    stage(pricingReviewedUnresolved, "pricing").detail.includes("missing")
);
check(
  "5 reviewed Pricing can move on without claiming every figure",
  stage(pricingReviewed, "pricing").status === "Ready" &&
    stage(pricingReviewed, "pricing").detail === "Pricing is marked reviewed."
);

const noQuote = deriveProjectWorkflow(
  input({
    activeTab: "pricing",
    hasEstimate: true,
    pricingSummary: { id: "price-1", status: "reviewed" },
  })
);
check(
  "6 no Quote stays closed",
  stage(noQuote, "quote").status === "Not started" && stage(noQuote, "quote").href === null
);

const draftQuote = deriveProjectWorkflow(
  input({
    activeTab: "quote",
    hasEstimate: true,
    pricingSummary: { id: "price-1", status: "reviewed" },
    quoteSummary: { id: "quote-1", status: "draft" },
  })
);
check(
  "7 draft Quote is Ready to send on its own route",
  stage(draftQuote, "quote").status === "Ready" &&
    stage(draftQuote, "quote").href === "/app/projects/project-1/quotes/quote-1" &&
    stage(draftQuote, "quote").displayStatus.includes("Current")
);

const sentQuote = deriveProjectWorkflow(
  input({
    activeTab: "quote",
    hasEstimate: true,
    pricingSummary: { id: "price-1", status: "converted_to_quote" },
    quoteSummary: { id: "quote-1", status: "sent" },
  })
);
check("8 sent Quote uses Sent", stage(sentQuote, "quote").status === "Sent");

const acceptedQuote = deriveProjectWorkflow(
  input({
    activeTab: "quote",
    hasEstimate: true,
    pricingSummary: { id: "price-1", status: "converted_to_quote" },
    quoteSummary: { id: "quote-1", status: "accepted" },
  })
);
check(
  "9 accepted Quote uses Accepted and does not lock the Variations tab route",
  stage(acceptedQuote, "quote").status === "Accepted" &&
    stage(acceptedQuote, "variations").href === "/app/projects/project-1/variations"
);

const variationsUnavailable = deriveProjectWorkflow(
  input({
    activeTab: "variations",
    hasEstimate: true,
    quoteSummary: { id: "quote-1", status: "sent" },
    variations: {
      eligible: false,
      reason: variationEligibility({
        hasAcceptedSnapshot: false,
        archived: false,
        deleted: false,
        stage: null,
      }).reason,
      statuses: [],
    },
  })
);
check(
  "10 Variations unavailable stays locked and unlinkable",
  stage(variationsUnavailable, "variations").status === "Locked" &&
    stage(variationsUnavailable, "variations").href === null &&
    stage(variationsUnavailable, "variations").detail.includes("accepts the quote")
);

const variationsAvailable = deriveProjectWorkflow(
  input({
    activeTab: "variations",
    hasEstimate: true,
    quoteSummary: { id: "quote-1", status: "accepted" },
    variations: { eligible: true, reason: null, statuses: [] },
  })
);
check(
  "11 Variations available opens the existing list and does not invent a change",
  stage(variationsAvailable, "variations").status === "Not started" &&
    stage(variationsAvailable, "variations").href === "/app/projects/project-1/variations"
);

const staleWithPricing = projectWorkflowRoutes({
  projectId: "project-1",
  hasEstimate: true,
  estimateIsStale: true,
  pricingSummary: { id: "price-1" },
  quoteSummary: null,
});
const staleModel = deriveProjectWorkflow(
  input({
    activeTab: "estimate",
    hasEstimate: true,
    estimateIsStale: true,
    pricingSummary: { id: "price-1", status: "reviewed" },
  })
);
check(
  "12 existing Pricing route stays available while a stale estimate still needs attention",
  staleWithPricing.pricingHref === "/app/projects/project-1/pricing/price-1" &&
    staleWithPricing.pricingBlocked === true &&
    stage(staleModel, "pricing").href === staleWithPricing.pricingHref &&
    stage(staleModel, "pricing").status === "Needs attention" &&
    projectWorkflowRoutes({
      projectId: "project-1",
      hasEstimate: true,
      estimateIsStale: false,
      pricingSummary: { id: "price-1" },
      quoteSummary: null,
    }).quoteHref === null
);

const strip = read("components/projects/ProjectWorkflowStrip.tsx");
const header = read("components/projects/ProjectSectionHeader.tsx");
const orientation = read("lib/projects/workflow-orientation.ts");
const tabs = read("components/projects/ProjectWorkspaceTabs.tsx");
const nav = read("components/projects/ProjectWorkspaceNav.tsx");
const quotePage = read("app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx");
const variationPage = read("app/(protected)/app/projects/[projectId]/variations/page.tsx");
const confidential = `${strip}\n${header}\n${orientation}`;

check(
  "13 strip does not render cost, margin, or sell figures",
  !/formatMoney|formatPricingMoney|marginPercent|total_sell|gross_profit|subtotal|gst_amount/.test(
    confidential
  )
);
check(
  "13 quote and variation money stay on their existing screens",
  quotePage.includes("quoteSummary={quoteSummary}") &&
    quotePage.includes("quoteItems={data.items}") &&
    !quotePage.includes("pricingUnresolvedRequired") &&
    variationPage.includes("summary={workspace.summary}") &&
    variationPage.includes("statuses: workspace.rows.map((row) => row.status)")
);

check(
  "14 four-column header replaces the strip and tab row",
  nav.includes("<ProjectSectionHeader") &&
    !nav.includes("<ProjectWorkflowStrip") &&
    !nav.includes("<ProjectWorkspaceTabs") &&
    header.includes("lg:grid-cols-4") &&
    header.includes("Project information") &&
    header.includes("aria-label=\"Project section\"") &&
    header.includes("min-h-11") &&
    header.includes("text-base") &&
    header.includes('aria-current={current ? "page" : undefined}') &&
    header.includes("focus-visible:outline") &&
    !header.includes("overflow-x-auto") &&
    !header.includes("Define the job") &&
    !header.includes("font-display") &&
    header.includes("CreateFinalPricingDialog") &&
    tabs.includes("Variations")
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nUX-01B workflow strip checks passed");

/**
 * Project workflow orientation.
 *
 * Presentation only. Route locks match ProjectWorkspaceTabs:
 * Pricing opens only when a pricing document already exists.
 * A stale or missing estimate blocks creating Pricing.
 * Quote opens only when a quote already exists.
 * Variations list route matches the tab; a locked Variations stage
 * is not given a link from the strip.
 *
 * This module does not create Pricing, Quotes, or Variations.
 */

import type { PricingDocumentStatus, PricingSummary } from "@/lib/pricing/types";
import type { QuoteStatus, QuoteSummary } from "@/lib/quotes/types";
import type { VariationStatus } from "@/lib/variations/domain";
import { VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE } from "@/lib/variations/presentation";

export type WorkflowStageId = "estimate" | "pricing" | "quote" | "variations";

export type WorkflowGroupId = "define" | "price" | "send";

export type WorkflowStatusLabel =
  | "Current"
  | "Ready"
  | "Needs attention"
  | "Not started"
  | "Locked"
  | "Sent"
  | "Accepted"
  | "Declined"
  | "Withdrawn";

export type ProjectWorkflowInput = {
  projectId: string;
  activeTab: "information" | "assistant" | "pricing" | "quote" | "variations" | "requests";
  hasEstimate: boolean;
  estimateIsStale: boolean;
  pricingSummary: Pick<PricingSummary, "id" | "status" | "needsRecalibration"> | null;
  /**
   * True when the page already loaded pricing lines and at least one
   * still needs a price. Null when this page did not load lines.
   */
  pricingUnresolvedRequired?: boolean | null;
  quoteSummary: Pick<QuoteSummary, "id" | "status"> | null;
  /**
   * Eligibility already returned by the variations workspace.
   * Null on pages that did not load it.
   */
  variations?: {
    eligible: boolean;
    reason: string | null;
    statuses: readonly VariationStatus[];
  } | null;
};

export type WorkflowStageModel = {
  id: WorkflowStageId;
  label: string;
  groupId: WorkflowGroupId;
  groupLabel: string;
  /** Lifecycle status. Never replaced by the viewing marker. */
  status: WorkflowStatusLabel;
  /** Lifecycle status, with Current appended while this page is open. */
  displayStatus: string;
  detail: string;
  viewing: boolean;
  locked: boolean;
  href: string | null;
};

export type ProjectWorkflowModel = {
  stages: readonly WorkflowStageModel[];
  current: WorkflowStageModel;
  previous: WorkflowStageModel | null;
  next: WorkflowStageModel | null;
};

const ESTIMATE_STALE_DETAIL =
  "Regenerate the estimate before preparing final pricing.";
const ESTIMATE_MISSING_DETAIL = "Generate an estimate first.";
const PRICING_READY_DETAIL = "Continue to Pricing from the Pricing tab.";
const PRICING_REVIEW_DETAIL = "Mark pricing as reviewed before creating a quote.";
const PRICING_UNRESOLVED_DETAIL = "Some required prices are still missing.";
const PRICING_RECALIBRATE_DETAIL =
  "Pricing needs to be brought up to date with the estimate.";
const QUOTE_LOCKED_DETAIL = "Create a quote from reviewed pricing.";

export function projectWorkflowRoutes(input: {
  projectId: string;
  hasEstimate: boolean;
  estimateIsStale: boolean;
  pricingSummary: { id: string } | null;
  quoteSummary: { id: string } | null;
}): {
  estimateHref: string;
  pricingHref: string | null;
  pricingBlocked: boolean;
  quoteHref: string | null;
  variationsHref: string;
} {
  return {
    estimateHref: `/app/projects/${input.projectId}`,
    pricingHref: input.pricingSummary
      ? `/app/projects/${input.projectId}/pricing/${input.pricingSummary.id}`
      : null,
    pricingBlocked: input.estimateIsStale || !input.hasEstimate,
    quoteHref: input.quoteSummary
      ? `/app/projects/${input.projectId}/quotes/${input.quoteSummary.id}`
      : null,
    variationsHref: `/app/projects/${input.projectId}/variations`,
  };
}

export function deriveProjectWorkflow(
  input: ProjectWorkflowInput
): ProjectWorkflowModel {
  const routes = projectWorkflowRoutes(input);
  const stages: WorkflowStageModel[] = [
    estimateStage(input, routes.estimateHref),
    pricingStage(input, routes),
    quoteStage(input, routes.quoteHref),
    variationsStage(input, routes.variationsHref),
  ];
  const currentIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.viewing)
  );
  return {
    stages,
    current: stages[currentIndex]!,
    previous: currentIndex > 0 ? stages[currentIndex - 1]! : null,
    next: currentIndex < stages.length - 1 ? stages[currentIndex + 1]! : null,
  };
}

function estimateStage(
  input: ProjectWorkflowInput,
  href: string
): WorkflowStageModel {
  const viewing = input.activeTab === "assistant";
  if (!input.hasEstimate) {
    return stage({
      id: "estimate",
      viewing,
      status: "Not started",
      detail: ESTIMATE_MISSING_DETAIL,
      locked: false,
      href,
    });
  }
  if (input.estimateIsStale) {
    return stage({
      id: "estimate",
      viewing,
      status: "Needs attention",
      detail: ESTIMATE_STALE_DETAIL,
      locked: false,
      href,
    });
  }
  return stage({
    id: "estimate",
    viewing,
    status: "Ready",
    detail: "The estimate is current.",
    locked: false,
    href,
  });
}

function pricingStage(
  input: ProjectWorkflowInput,
  routes: ReturnType<typeof projectWorkflowRoutes>
): WorkflowStageModel {
  const viewing = input.activeTab === "pricing";
  if (!input.pricingSummary) {
    if (routes.pricingBlocked) {
      return stage({
        id: "pricing",
        viewing,
        status: "Locked",
        detail: input.estimateIsStale
          ? ESTIMATE_STALE_DETAIL
          : ESTIMATE_MISSING_DETAIL,
        locked: true,
        href: null,
      });
    }
    return stage({
      id: "pricing",
      viewing,
      status: "Ready",
      detail: PRICING_READY_DETAIL,
      locked: false,
      href: null,
    });
  }

  const attention = pricingAttention(input);
  if (attention) {
    return stage({
      id: "pricing",
      viewing,
      status: "Needs attention",
      detail: attention,
      locked: false,
      href: routes.pricingHref,
    });
  }

  return stage({
    id: "pricing",
    viewing,
    status: "Ready",
    detail:
      input.pricingSummary.status === "converted_to_quote"
        ? "This pricing already has a quote."
        : "Pricing is marked reviewed.",
    locked: false,
    href: routes.pricingHref,
  });
}

function pricingAttention(input: ProjectWorkflowInput): string | null {
  if (input.estimateIsStale) return ESTIMATE_STALE_DETAIL;
  if (input.pricingSummary?.needsRecalibration) return PRICING_RECALIBRATE_DETAIL;
  if (input.pricingUnresolvedRequired === true) return PRICING_UNRESOLVED_DETAIL;
  if (pricingNeedsReview(input.pricingSummary?.status)) return PRICING_REVIEW_DETAIL;
  return null;
}

function pricingNeedsReview(status: PricingDocumentStatus | undefined): boolean {
  return status === "draft" || status === "archived";
}

function quoteStage(
  input: ProjectWorkflowInput,
  href: string | null
): WorkflowStageModel {
  const viewing = input.activeTab === "quote";
  if (!input.quoteSummary) {
    const reviewed = pricingCanStartQuote(input.pricingSummary?.status);
    return stage({
      id: "quote",
      viewing,
      status: reviewed ? "Not started" : "Locked",
      detail: QUOTE_LOCKED_DETAIL,
      locked: !reviewed,
      href: null,
    });
  }

  const mapped = quoteStatus(input.quoteSummary.status);
  return stage({
    id: "quote",
    viewing,
    status: mapped.status,
    detail: mapped.detail,
    locked: mapped.locked,
    href: mapped.locked ? null : href,
  });
}

function pricingCanStartQuote(status: PricingDocumentStatus | undefined): boolean {
  return status === "reviewed" || status === "converted_to_quote";
}

function quoteStatus(status: QuoteStatus): {
  status: WorkflowStatusLabel;
  detail: string;
  locked: boolean;
} {
  switch (status) {
    case "draft":
      return { status: "Ready", detail: "Ready to send.", locked: false };
    case "sent":
      return { status: "Sent", detail: "Sent to the client.", locked: false };
    case "viewed":
      return {
        status: "Sent",
        detail: "The client has opened this quote.",
        locked: false,
      };
    case "accepted":
      return { status: "Accepted", detail: "The client accepted this quote.", locked: false };
    case "declined":
      return { status: "Declined", detail: "The client declined this quote.", locked: false };
    case "expired":
      return { status: "Needs attention", detail: "This quote has expired.", locked: false };
    case "superseded":
      return {
        status: "Needs attention",
        detail: "A later revision replaces this quote.",
        locked: false,
      };
    case "archived":
      return { status: "Locked", detail: "This quote is archived.", locked: true };
    default:
      return { status: "Needs attention", detail: "Open the quote to review it.", locked: false };
  }
}

function variationsStage(
  input: ProjectWorkflowInput,
  href: string
): WorkflowStageModel {
  const viewing = input.activeTab === "variations";
  if (input.variations) {
    if (!input.variations.eligible) {
      return stage({
        id: "variations",
        viewing,
        status: "Locked",
        detail:
          input.variations.reason ?? VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE,
        locked: true,
        href: null,
      });
    }
    const headline = variationHeadline(input.variations.statuses);
    if (!headline) {
      return stage({
        id: "variations",
        viewing,
        status: "Not started",
        detail: "No Variations yet.",
        locked: false,
        href,
      });
    }
    return stage({
      id: "variations",
      viewing,
      status: headline.status,
      detail: headline.detail,
      locked: false,
      href,
    });
  }

  if (input.quoteSummary?.status !== "accepted") {
    return stage({
      id: "variations",
      viewing,
      status: "Locked",
      detail: VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE,
      locked: true,
      href: null,
    });
  }

  return stage({
    id: "variations",
    viewing,
    status: "Not started",
    detail: "The quote is accepted. Open Variations to raise a change.",
    locked: false,
    href,
  });
}

function variationHeadline(statuses: readonly VariationStatus[]): {
  status: WorkflowStatusLabel;
  detail: string;
} | null {
  if (statuses.length === 0) return null;
  if (statuses.includes("draft")) {
    return { status: "Needs attention", detail: "A draft Variation is in progress." };
  }
  if (statuses.includes("issued")) {
    return { status: "Sent", detail: "A Variation has been issued to the client." };
  }
  return variationStatusCopy(statuses[statuses.length - 1]!);
}

function variationStatusCopy(status: VariationStatus): {
  status: WorkflowStatusLabel;
  detail: string;
} {
  switch (status) {
    case "draft":
      return { status: "Needs attention", detail: "A draft Variation is in progress." };
    case "issued":
      return { status: "Sent", detail: "A Variation has been issued to the client." };
    case "accepted":
      return { status: "Accepted", detail: "A Variation has been accepted." };
    case "rejected":
      return { status: "Declined", detail: "A Variation was declined." };
    case "withdrawn":
      return { status: "Withdrawn", detail: "A Variation was withdrawn." };
    case "superseded":
      return {
        status: "Needs attention",
        detail: "A Variation has been replaced by a later revision.",
      };
    default:
      return { status: "Needs attention", detail: "Open Variations to review the change." };
  }
}

function stage(input: {
  id: WorkflowStageId;
  viewing: boolean;
  status: WorkflowStatusLabel;
  detail: string;
  locked: boolean;
  href: string | null;
}): WorkflowStageModel {
  const meta = STAGE_META[input.id];
  return {
    id: input.id,
    label: meta.label,
    groupId: meta.groupId,
    groupLabel: meta.groupLabel,
    status: input.status,
    displayStatus: input.viewing ? `${input.status} · Current` : input.status,
    detail: input.detail,
    viewing: input.viewing,
    locked: input.locked,
    href: input.locked ? null : input.href,
  };
}

const STAGE_META: Record<
  WorkflowStageId,
  { label: string; groupId: WorkflowGroupId; groupLabel: string }
> = {
  estimate: {
    label: "Estimate",
    groupId: "define",
    groupLabel: "Define the job",
  },
  pricing: {
    label: "Pricing",
    groupId: "price",
    groupLabel: "Build the price",
  },
  quote: {
    label: "Quote",
    groupId: "send",
    groupLabel: "Send and manage",
  },
  variations: {
    label: "Variations",
    groupId: "send",
    groupLabel: "Send and manage",
  },
};

/**
 * UX-01C — Estimate landing overview.
 *
 * Presentation only. Money, GST, profitability, readiness, and Pricing
 * Required lines come from values the caller already holds. This module
 * does not calculate an estimate, query the database, or decide a new
 * Pricing gate.
 */

import { formatCurrency } from "@/components/assistant/format";
import { STALE_ESTIMATE_EXPLANATION } from "@/lib/assistant/mode/derive";
import type { CommercialOverviewBreakdown } from "@/lib/assistant/presentation/commercial-overview-projection";
import {
  presentEstimateGst,
  usesQuotrBenchmarkRates,
} from "@/lib/assistant/presentation/gst-display";
import {
  formatProfitabilityDisplay,
  inferDisplayCostKnown,
} from "@/lib/financial-presentation/format";

/** Visible estimate boundary already used by the estimator. */
export const ESTIMATE_OVERVIEW_BOUNDARY_COPY =
  "This is an internal working estimate, not a client quote.";

export type EstimateOverviewStatus =
  | "incomplete"
  | "stale"
  | "pricing_required"
  | "current";

export type EstimateOverviewPrimary =
  | "continue_information"
  | "complete_details"
  | "regenerate"
  | "continue_pricing";

export type EstimateOverviewActionGroup = "required" | "accuracy" | "rates";

export type EstimateOverviewAction = {
  readonly id: string;
  readonly title: string;
  readonly detail: string | null;
  readonly workAreaName: string | null;
  readonly group: EstimateOverviewActionGroup;
  /** True only for readiness blockers that already stop Pricing. */
  readonly blocksPricing: boolean;
  /** Action rows never invent an amount. */
  readonly money: null;
};

export type EstimateOverviewSell = {
  readonly presentation: "hidden" | "current" | "previous" | "unresolved";
  readonly label: string;
  readonly exGst: string | null;
  readonly gst: string | null;
  readonly inclGst: string | null;
  readonly boundaryCopy: string;
};

export type EstimateOverviewCompositionRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export type EstimateOverviewModel = {
  readonly status: EstimateOverviewStatus;
  readonly statusLabel: string;
  readonly statusDetail: string;
  readonly sell: EstimateOverviewSell;
  readonly composition: readonly EstimateOverviewCompositionRow[];
  readonly workAreas: {
    readonly count: number;
    readonly names: readonly string[];
    readonly missingPricingCount: number;
    readonly rows: readonly { readonly name: string; readonly note: string | null }[];
  };
  readonly required: readonly EstimateOverviewAction[];
  readonly accuracy: readonly EstimateOverviewAction[];
  readonly rates: readonly EstimateOverviewAction[];
  readonly requiredCount: number;
  readonly primary: EstimateOverviewPrimary;
  readonly primaryLabel: string;
  readonly pricingCreationBlocked: boolean;
  readonly pricingEntry: "blocked" | "create" | "open";
};

type OverviewLineGroup = {
  readonly id: string;
  readonly label: string;
  readonly pricingRequired?: boolean;
  readonly children: readonly { readonly id: string }[];
};

type OverviewWorkArea = {
  readonly workAreaName: string;
  readonly partialEstimateLabel?: string | null;
  readonly categories: readonly {
    readonly id: string;
    readonly lineGroups: readonly OverviewLineGroup[];
    readonly lines: readonly { readonly id: string; readonly label: string }[];
  }[];
  readonly sharedLineGroups?: readonly OverviewLineGroup[];
  readonly portionGroups?: readonly {
    readonly lineGroups: readonly OverviewLineGroup[];
  }[];
};

export type EstimateOverviewReview = {
  readonly overview: {
    readonly workAreaNames: readonly string[];
    readonly partialEstimateLabel?: string | null;
    readonly recommendedSellIsPartial?: boolean;
  };
  readonly workAreas: readonly OverviewWorkArea[];
  readonly assumptions: readonly { readonly id: string; readonly label: string }[];
  readonly checks: readonly { readonly id: string; readonly label: string }[];
  readonly improvements: readonly {
    readonly id: string;
    readonly label: string;
    readonly reason: string | null;
  }[];
} | null;

export type EstimateOverviewMoney = {
  readonly recommendedSell: number;
  readonly recommendedCost: number;
  readonly grossProfit: number;
  readonly marginPercent: number;
  readonly markupPercent?: number | null;
};

export type ProjectEstimateOverviewInput = {
  readonly hasEstimate: boolean;
  readonly isStale: boolean;
  /** Existing Details / hard-minimum readiness still outstanding. */
  readonly detailsOutstanding: boolean;
  readonly estimate: EstimateOverviewMoney | null;
  readonly gstRate: number | null;
  readonly breakdown: CommercialOverviewBreakdown | null;
  readonly review: EstimateOverviewReview;
  readonly readinessBlockers: readonly string[];
  readonly rateSourceSummary: string | null;
  readonly pricingDocumentExists: boolean;
  readonly specialistPricingNotice: string | null;
  readonly workAreaNames: readonly string[];
};

const PRIMARY_LABELS: Record<EstimateOverviewPrimary, string> = {
  continue_information: "Continue entering information",
  complete_details: "Complete required Details",
  regenerate: "Regenerate estimate",
  continue_pricing: "Continue to Pricing",
};

function knownAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isInternalBoundary(title: string): boolean {
  return /internal working estimate|not a client quote|not a quote/i.test(title);
}

function action(
  group: EstimateOverviewActionGroup,
  id: string,
  title: string,
  detail: string | null,
  workAreaName: string | null,
  blocksPricing: boolean
): EstimateOverviewAction {
  return {
    id,
    title,
    detail,
    workAreaName,
    group,
    blocksPricing,
    money: null,
  };
}

function collectPricingRequired(
  review: EstimateOverviewReview
): EstimateOverviewAction[] {
  if (!review) return [];
  const items: EstimateOverviewAction[] = [];
  const seen = new Set<string>();
  const push = (
    id: string,
    title: string,
    workAreaName: string | null,
    detail: string | null
  ) => {
    const key = normalizeKey(`${workAreaName ?? ""}:${title}`);
    if (!title.trim() || seen.has(key)) return;
    seen.add(key);
    items.push(
      action("required", id, title.trim(), detail, workAreaName, false)
    );
  };

  for (const area of review.workAreas) {
    const groups = [
      ...area.categories.flatMap((category) => category.lineGroups),
      ...(area.sharedLineGroups ?? []),
      ...(area.portionGroups ?? []).flatMap((portion) => portion.lineGroups),
    ];
    const countedChildren = new Set<string>();
    for (const group of groups) {
      if (!group.pricingRequired) continue;
      push(
        `pricing:${group.id}`,
        group.label,
        area.workAreaName,
        "Pricing Required"
      );
      for (const child of group.children) countedChildren.add(child.id);
    }
    for (const category of area.categories) {
      if (category.id !== "PRICING_REQUIRED") continue;
      for (const line of category.lines) {
        if (countedChildren.has(line.id)) continue;
        push(
          `pricing:${line.id}`,
          line.label,
          area.workAreaName,
          "Pricing Required"
        );
      }
    }
    if (
      area.partialEstimateLabel &&
      /pricing required/i.test(area.partialEstimateLabel) &&
      !items.some((item) => item.workAreaName === area.workAreaName)
    ) {
      push(
        `pricing:area:${normalizeKey(area.workAreaName)}`,
        area.partialEstimateLabel,
        area.workAreaName,
        "Pricing Required"
      );
    }
  }
  return items;
}

function compositionRows(input: {
  readonly show: boolean;
  readonly estimate: EstimateOverviewMoney | null;
  readonly breakdown: CommercialOverviewBreakdown | null;
  readonly costKnown: boolean;
}): EstimateOverviewCompositionRow[] {
  if (!input.show || !input.estimate) return [];
  const rows: EstimateOverviewCompositionRow[] = [];
  const push = (id: string, label: string, value: string | null) => {
    if (!value) return;
    rows.push({ id, label, value });
  };
  const money = (value: number | null | undefined) => {
    const known = knownAmount(value);
    return known == null ? null : formatCurrency(known);
  };

  if (input.costKnown) {
    push("direct", "Direct cost", money(input.estimate.recommendedCost));
  }
  const breakdown = input.breakdown;
  push("materials", "Material cost", money(breakdown?.materialsCost));
  const hours = knownAmount(breakdown?.labourHours);
  push("labour-hours", "Labour hours", hours == null ? null : `${hours.toFixed(1)} hrs`);
  push("labour", "Labour cost", money(breakdown?.labourCost));
  push("subcontract", "Subcontract cost", money(breakdown?.subcontractCost));
  push("plant", "Plant and equipment", money(breakdown?.plantCost));
  push("allowances", "Allowances", money(breakdown?.allowancesCost));
  push("other", "Other direct costs", money(breakdown?.otherCost));

  if (input.costKnown) {
    const profitability = formatProfitabilityDisplay({
      costKnown: true,
      grossProfit: input.estimate.grossProfit,
      marginPercent: input.estimate.marginPercent,
      markupPercent: input.estimate.markupPercent,
    });
    push("profit", "Gross profit", profitability.profitLabel);
    push("margin", "Effective gross margin", profitability.marginLabel);
  }
  return rows;
}

function sellPresentation(input: {
  readonly hasEstimate: boolean;
  readonly isStale: boolean;
  readonly unresolved: boolean;
  readonly estimate: EstimateOverviewMoney | null;
  readonly gstRate: number | null;
}): EstimateOverviewSell {
  const boundaryCopy = ESTIMATE_OVERVIEW_BOUNDARY_COPY;
  if (!input.hasEstimate || !input.estimate) {
    return {
      presentation: "hidden",
      label: "Recommended client sell",
      exGst: null,
      gst: null,
      inclGst: null,
      boundaryCopy,
    };
  }
  const amount = input.estimate.recommendedSell;
  if (input.unresolved || !Number.isFinite(amount) || amount <= 0) {
    return {
      presentation: "unresolved",
      label: "Pricing Required",
      exGst: null,
      gst: null,
      inclGst: null,
      boundaryCopy,
    };
  }
  const gst = presentEstimateGst(amount, input.gstRate);
  if (input.isStale) {
    return {
      presentation: "previous",
      label: "Previous estimate",
      exGst: formatCurrency(gst.exGst),
      gst: gst.showGst ? formatCurrency(gst.gstAmount) : null,
      inclGst: gst.showGst ? formatCurrency(gst.inclGst) : null,
      boundaryCopy,
    };
  }
  return {
    presentation: "current",
    label: "Recommended client sell",
    exGst: formatCurrency(gst.exGst),
    gst: gst.showGst ? formatCurrency(gst.gstAmount) : null,
    inclGst: gst.showGst ? formatCurrency(gst.inclGst) : null,
    boundaryCopy,
  };
}

export function projectEstimateOverview(
  input: ProjectEstimateOverviewInput
): EstimateOverviewModel {
  const pricingRequired = collectPricingRequired(input.review);
  if (
    input.specialistPricingNotice &&
    input.hasEstimate &&
    pricingRequired.length === 0
  ) {
    pricingRequired.push(
      action(
        "required",
        "pricing:specialist",
        "Pricing Required",
        input.specialistPricingNotice,
        null,
        false
      )
    );
  }

  const requiredKeys = new Set(
    pricingRequired.map((item) => normalizeKey(item.title))
  );
  const readiness = input.hasEstimate
    ? []
    : input.readinessBlockers
        .map((title) => title.trim())
        .filter((title) => title.length > 0 && !isInternalBoundary(title))
        .filter((title, index, all) => all.indexOf(title) === index)
        .map((title, index) =>
          action("required", `readiness:${index}`, title, null, null, true)
        );
  for (const item of readiness) requiredKeys.add(normalizeKey(item.title));

  const required = [...readiness, ...pricingRequired];

  const accuracy: EstimateOverviewAction[] = [];
  const rates: EstimateOverviewAction[] = [];
  const seenOptional = new Set<string>();
  const pushOptional = (
    group: "accuracy" | "rates",
    id: string,
    title: string,
    detail: string | null,
    workAreaName: string | null
  ) => {
    const cleaned = title.trim();
    if (!cleaned || isInternalBoundary(cleaned)) return;
    const key = normalizeKey(cleaned);
    if (requiredKeys.has(key) || seenOptional.has(key)) return;
    seenOptional.add(key);
    const bucket = group === "accuracy" ? accuracy : rates;
    bucket.push(action(group, id, cleaned, detail, workAreaName, false));
  };

  for (const item of input.review?.assumptions ?? []) {
    pushOptional("accuracy", item.id, item.label, null, null);
  }
  for (const item of input.review?.checks ?? []) {
    pushOptional("accuracy", item.id, item.label, null, null);
  }
  if (usesQuotrBenchmarkRates(input.rateSourceSummary)) {
    pushOptional(
      "rates",
      "rates:benchmark",
      "Some rates use Quotr benchmarks",
      "Add your own rates anytime.",
      null
    );
  }
  for (const item of input.review?.improvements ?? []) {
    const blob = `${item.label} ${item.reason ?? ""}`;
    if (!/rate|benchmark/i.test(blob)) continue;
    pushOptional("rates", item.id, item.label, item.reason, null);
  }

  const names =
    input.review && input.review.overview.workAreaNames.length > 0
      ? [...input.review.overview.workAreaNames]
      : input.workAreaNames.map((name) => name.trim()).filter(Boolean);
  const missingNames = new Set(
    pricingRequired
      .map((item) => item.workAreaName)
      .filter((name): name is string => Boolean(name))
  );
  for (const area of input.review?.workAreas ?? []) {
    if (
      area.partialEstimateLabel &&
      /pricing required/i.test(area.partialEstimateLabel)
    ) {
      missingNames.add(area.workAreaName);
    }
  }

  const hasPricingRequired = pricingRequired.length > 0;
  const estimate = input.estimate;
  const unresolvedSell =
    input.hasEstimate &&
    hasPricingRequired &&
    (estimate == null ||
      !Number.isFinite(estimate.recommendedSell) ||
      estimate.recommendedSell <= 0);
  const costKnown =
    input.hasEstimate &&
    estimate != null &&
    inferDisplayCostKnown(estimate.recommendedCost, estimate.recommendedSell) &&
    !unresolvedSell;

  let status: EstimateOverviewStatus = "current";
  if (!input.hasEstimate) status = "incomplete";
  else if (input.isStale) status = "stale";
  else if (hasPricingRequired || input.review?.overview.recommendedSellIsPartial) {
    status = "pricing_required";
  }

  const statusLabel =
    status === "incomplete"
      ? "Incomplete"
      : status === "stale"
        ? "Stale"
        : status === "pricing_required"
          ? "Pricing Required"
          : "Current";
  const statusDetail =
    status === "incomplete"
      ? input.detailsOutstanding
        ? "Required Details are still open."
        : "Job information is still being entered."
      : status === "stale"
        ? STALE_ESTIMATE_EXPLANATION
        : status === "pricing_required"
          ? input.review?.overview.partialEstimateLabel?.trim() ||
            "Some items still require pricing."
          : "This estimate is current.";

  const primary: EstimateOverviewPrimary = !input.hasEstimate
    ? input.detailsOutstanding
      ? "complete_details"
      : "continue_information"
    : input.isStale
      ? "regenerate"
      : "continue_pricing";

  const pricingCreationBlocked = !input.hasEstimate || input.isStale;
  const pricingEntry = pricingCreationBlocked
    ? "blocked"
    : input.pricingDocumentExists
      ? "open"
      : "create";

  const showCurrentComposition =
    input.hasEstimate && !input.isStale && !unresolvedSell;

  return {
    status,
    statusLabel,
    statusDetail,
    sell: sellPresentation({
      hasEstimate: input.hasEstimate,
      isStale: input.isStale,
      unresolved: unresolvedSell,
      estimate,
      gstRate: input.gstRate,
    }),
    composition: compositionRows({
      show: showCurrentComposition,
      estimate,
      breakdown: input.breakdown,
      costKnown,
    }),
    workAreas: {
      count: names.length,
      names,
      missingPricingCount: missingNames.size,
      rows: names.map((name) => ({
        name,
        note: missingNames.has(name) ? "Pricing Required" : null,
      })),
    },
    required,
    accuracy,
    rates,
    requiredCount: required.length,
    primary,
    primaryLabel: PRIMARY_LABELS[primary],
    pricingCreationBlocked,
    pricingEntry,
  };
}

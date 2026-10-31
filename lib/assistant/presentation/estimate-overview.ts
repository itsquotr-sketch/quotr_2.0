/**
 * UX-01C — Estimate landing overview.
 *
 * Presentation only. Money, GST, profitability, readiness, and Pricing
 * Required lines come from values the caller already holds. This module
 * does not calculate an estimate, query the database, or decide a new
 * Pricing gate.
 */

import { formatCurrency, formatCurrencyCents } from "@/components/assistant/format";
import { STALE_ESTIMATE_EXPLANATION } from "@/lib/assistant/mode/derive";
import { quantityConflictStageStatus } from "@/lib/estimate/deck-detail-completeness";
import type { CommercialOverviewBreakdown } from "@/lib/assistant/presentation/commercial-overview-projection";
import {
  presentEstimateGst,
  usesQuotrBenchmarkRates,
} from "@/lib/assistant/presentation/gst-display";
import {
  formatProfitabilityDisplay,
  inferDisplayCostKnown,
} from "@/lib/financial-presentation/format";
import { flooringScopeDecisionOpen } from "@/lib/estimate/flooring-pricing-recovery";
import {
  classifyReviewNotice,
  formatMissingPriceNotice,
  formatScopeCoverageGaps,
  formatUnresolvedSpecifications,
  formatWorkAreaPriceSummary,
  type EstimateIssueModel,
} from "@/lib/assistant/presentation/estimate-issues";

/** Visible estimate boundary. This is not a client document. */
export const ESTIMATE_OVERVIEW_BOUNDARY_COPY =
  "Internal working estimate · not shown to the client";

export function estimateMissingPriceNotice(count: number): string {
  return formatMissingPriceNotice(count);
}

/** Shown when category dollars are rounded independently of the direct-cost dollar. */
export const ESTIMATE_OVERVIEW_ROUNDED_NOTE =
  "Category figures are rounded to the nearest dollar.";

export type EstimateOverviewStatus =
  | "incomplete"
  | "stale"
  | "pricing_required"
  | "current";

export type EstimateOverviewPrimary =
  | "continue_information"
  | "complete_details"
  | "regenerate"
  | "review_productivity"
  | "continue_pricing";

export type EstimateOverviewActionGroup =
  | "required"
  | "pricing_attention"
  | "accuracy"
  | "rates";

export type EstimateOverviewActionKind =
  | "blocker"
  | "pricing_attention"
  | "assumption"
  | "check"
  | "benchmark";

export type EstimateOverviewAction = {
  readonly id: string;
  readonly title: string;
  readonly detail: string | null;
  readonly workAreaName: string | null;
  /** Stable work-area id when the review already has one. */
  readonly workAreaId: string | null;
  readonly group: EstimateOverviewActionGroup;
  readonly kind: EstimateOverviewActionKind;
  /** True only for readiness blockers that already stop Pricing. */
  readonly blocksPricing: boolean;
  /** Action rows never invent an amount. */
  readonly money: null;
};

export type EstimateOverviewReconciliation = {
  readonly state: "hidden" | "exact" | "rounded" | "unreconciled";
  readonly note: string | null;
};

export type EstimateOverviewSell = {
  readonly presentation: "hidden" | "current" | "previous" | "unresolved" | "partial";
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
    readonly summaryLine: string;
    readonly rows: readonly { readonly name: string; readonly note: string | null }[];
  };
  /** Readiness reasons that already block Pricing. */
  readonly required: readonly EstimateOverviewAction[];
  /** Pricing Required lines. They do not block opening Pricing. */
  readonly pricingAttention: readonly EstimateOverviewAction[];
  readonly accuracy: readonly EstimateOverviewAction[];
  readonly rates: readonly EstimateOverviewAction[];
  readonly requiredCount: number;
  readonly pricingAttentionCount: number;
  readonly assumptionSummary: string | null;
  readonly benchmarkSummary: string | null;
  readonly reconciliation: EstimateOverviewReconciliation;
  readonly primary: EstimateOverviewPrimary;
  readonly primaryLabel: string;
  readonly pricingCreationBlocked: boolean;
  readonly pricingEntry: "blocked" | "create" | "open";
  readonly issues: EstimateIssueModel;
  readonly scopeGapSummary: string | null;
  readonly specificationSummary: string | null;
};

type OverviewLine = {
  readonly id: string;
  readonly label?: string;
  readonly rateLabel?: string;
  readonly category?: string;
};

type OverviewLineGroup = {
  readonly id: string;
  readonly label: string;
  readonly pricingRequired?: boolean;
  readonly children: readonly OverviewLine[];
};

type OverviewWorkArea = {
  readonly workAreaId?: string | null;
  readonly workAreaName: string;
  readonly partialEstimateLabel?: string | null;
  readonly categories: readonly {
    readonly id: string;
    readonly lineGroups: readonly OverviewLineGroup[];
    readonly lines: readonly OverviewLine[];
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
    readonly categorySummary?: readonly {
      readonly id: string;
      readonly label: string;
      readonly cost: number;
    }[];
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
  /** Saved quantities disagree with the current deck count. Does not rewrite the draft. */
  readonly statedCountConflictDetail?: string | null;
  /** Saved deck productivity still needs an explicit scope confirmation. */
  readonly productivityReviewDetail?: string | null;
  /** Price-affecting conditions that are still unanswered or uncertain. */
  readonly openCommercialConditions?: readonly string[];
};

const PRIMARY_LABELS: Record<EstimateOverviewPrimary, string> = {
  continue_information: "Continue entering information",
  complete_details: "Complete required Details",
  regenerate: "Regenerate estimate",
  review_productivity: "Review Deck productivity",
  continue_pricing: "Continue to Pricing",
};

function formatOverviewHours(hours: number): string {
  const cents = Math.round(hours * 100);
  const tenths = Math.round(cents / 10);
  return `${(tenths / 10).toFixed(1)} hrs`;
}

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
  blocksPricing: boolean,
  kind: EstimateOverviewActionKind,
  workAreaId: string | null = null
): EstimateOverviewAction {
  return {
    id,
    title,
    detail,
    workAreaName,
    workAreaId,
    group,
    kind,
    blocksPricing,
    money: null,
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function workAreaSummaryLine(
  count: number,
  missingPriceLineCount: number,
  workAreasWithMissingPrices: number,
  scopeCoverageGapCount: number,
  unresolvedSpecificationCount: number
): string {
  if (count === 0) return "No Work Areas yet";
  return formatWorkAreaPriceSummary({
    workAreaCount: count,
    missingPriceLineCount,
    workAreasWithMissingPrices,
    scopeCoverageGapCount,
    unresolvedSpecificationCount,
  });
}

function assumptionSummaryLine(items: readonly EstimateOverviewAction[]): string | null {
  if (items.length === 0) return null;
  const assumptions = items.filter((item) => item.kind === "assumption").length;
  const checks = items.filter((item) => item.kind === "check").length;
  if (assumptions > 0 && checks === 0) {
    return assumptions === 1 ? "1 assumption to review" : `${assumptions} assumptions to review`;
  }
  if (checks > 0 && assumptions === 0) {
    return checks === 1 ? "1 check to review" : `${checks} checks to review`;
  }
  if (assumptions > 0 && checks > 0) {
    const assumptionLabel = assumptions === 1 ? "1 assumption" : `${assumptions} assumptions`;
    const checkLabel = checks === 1 ? "1 check" : `${checks} checks`;
    return `${assumptionLabel} and ${checkLabel} to review`;
  }
  return items.length === 1 ? "1 item to review" : `${items.length} items to review`;
}

function benchmarkSummaryLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 benchmark notice" : `${count} benchmark notices`;
}

function overviewLineNeedsPrice(line: OverviewLine): boolean {
  if (line.category === "PRICING_REQUIRED") return true;
  return /pricing required|rate required/i.test(line.rateLabel ?? "");
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
    detail: string | null,
    workAreaId: string | null = null
  ) => {
    const key = normalizeKey(id);
    if (!title.trim() || seen.has(key)) return;
    seen.add(key);
    items.push(
      action(
        "pricing_attention",
        id,
        title.trim(),
        detail,
        workAreaName,
        false,
        "pricing_attention",
        workAreaId
      )
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
      const children = group.children.filter(
        (child) =>
          !countedChildren.has(child.id) &&
          (group.pricingRequired || overviewLineNeedsPrice(child))
      );
      if (children.length > 0) {
        for (const child of children) {
          countedChildren.add(child.id);
          push(
            `pricing:${child.id}`,
            child.label?.trim() || group.label,
            area.workAreaName,
            "Pricing Required",
            area.workAreaId ?? null
          );
        }
        continue;
      }
      if (!group.pricingRequired) continue;
      push(
        `pricing:${group.id}`,
        group.label,
        area.workAreaName,
        "Pricing Required",
        area.workAreaId ?? null
      );
    }
    for (const category of area.categories) {
      if (category.id !== "PRICING_REQUIRED") continue;
      for (const line of category.lines) {
        if (countedChildren.has(line.id)) continue;
        push(
          `pricing:${line.id}`,
          line.label ?? "",
          area.workAreaName,
          "Pricing Required",
          area.workAreaId ?? null
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
        "Pricing Required",
        area.workAreaId ?? null
      );
    }
  }
  return items;
}

type CategoryAmount = {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
};

function categoryAmounts(input: {
  readonly categorySummary:
    | readonly { readonly id: string; readonly label: string; readonly cost: number }[]
    | undefined;
  readonly breakdown: CommercialOverviewBreakdown | null;
}): CategoryAmount[] {
  const summary = input.categorySummary?.filter(
    (row) => row.id !== "PRICING_REQUIRED" && Number.isFinite(row.cost) && row.cost > 0
  );
  if (summary && summary.length > 0) {
    return summary.map((row) => ({
      id: row.id.toLowerCase(),
      label: row.label.trim() || row.id,
      cost: row.cost,
    }));
  }
  const breakdown = input.breakdown;
  if (!breakdown) return [];
  const pairs: readonly [string, string, number | null][] = [
    ["materials", "Material cost", breakdown.materialsCost],
    ["labour", "Labour cost", breakdown.labourCost],
    ["subcontract", "Subcontract cost", breakdown.subcontractCost],
    ["plant", "Plant and equipment", breakdown.plantCost],
    ["allowances", "Allowances", breakdown.allowancesCost],
    ["other", "Other direct costs", breakdown.otherCost],
  ];
  return pairs.flatMap(([id, label, cost]) => {
    const known = knownAmount(cost);
    return known == null ? [] : [{ id, label, cost: known }];
  });
}

function reconcileCategories(
  directCost: number | null,
  categories: readonly CategoryAmount[]
): EstimateOverviewReconciliation {
  if (directCost == null || categories.length === 0) {
    return { state: "hidden", note: null };
  }
  const rawSum = round2(categories.reduce((sum, row) => sum + row.cost, 0));
  const rawDirect = round2(directCost);
  const displaySum = categories.reduce((sum, row) => sum + Math.round(row.cost), 0);
  const displayDirect = Math.round(directCost);
  if (Math.abs(rawSum - rawDirect) < 0.05) {
    if (displaySum === displayDirect) return { state: "exact", note: null };
    return { state: "rounded", note: ESTIMATE_OVERVIEW_ROUNDED_NOTE };
  }
  return { state: "unreconciled", note: null };
}

function compositionRows(input: {
  readonly show: boolean;
  readonly estimate: EstimateOverviewMoney | null;
  readonly breakdown: CommercialOverviewBreakdown | null;
  readonly categorySummary:
    | readonly { readonly id: string; readonly label: string; readonly cost: number }[]
    | undefined;
  readonly costKnown: boolean;
  readonly knownCostOnly: boolean;
}): { rows: EstimateOverviewCompositionRow[]; reconciliation: EstimateOverviewReconciliation } {
  if (!input.show || !input.estimate) {
    return { rows: [], reconciliation: { state: "hidden", note: null } };
  }
  const rows: EstimateOverviewCompositionRow[] = [];
  const push = (id: string, label: string, value: string | null) => {
    if (!value) return;
    rows.push({ id, label, value });
  };
  const categories = categoryAmounts({
    categorySummary: input.categorySummary,
    breakdown: input.breakdown,
  });
  const directAmount = knownAmount(input.estimate.recommendedCost);
  const directCost = input.costKnown ? directAmount : null;

  if (directCost != null) {
    push("direct", "Direct cost", formatCurrency(directCost));
  } else if (input.knownCostOnly && directAmount != null && directAmount > 0) {
    push("direct", "Known cost", formatCurrency(directAmount));
  }
  for (const category of categories) {
    push(category.id, category.label, formatCurrency(category.cost));
  }
  const hours = knownAmount(input.breakdown?.labourHours);
  push("labour-hours", "Labour hours", hours == null ? null : formatOverviewHours(hours));
  const heldHours = knownAmount(input.breakdown?.heldLabourHours);
  push(
    "labour-hours-review",
    "Hours awaiting review",
    heldHours == null ? null : formatOverviewHours(heldHours)
  );

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
  return {
    rows,
    reconciliation: reconcileCategories(directCost, categories),
  };
}

function sellPresentation(input: {
  readonly hasEstimate: boolean;
  readonly isStale: boolean;
  readonly countConflict: boolean;
  readonly unresolved: boolean;
  readonly partial: boolean;
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
  if (
    (input.countConflict || input.isStale) &&
    Number.isFinite(amount) &&
    amount > 0
  ) {
    const gst = presentEstimateGst(amount, input.gstRate);
    return {
      presentation: "previous",
      label:
        input.countConflict && !input.isStale
          ? "Old working estimate"
          : "Previous estimate",
      exGst: formatCurrency(gst.exGst),
      gst: gst.showGst ? formatCurrencyCents(gst.gstAmount) : null,
      inclGst: gst.showGst ? formatCurrencyCents(gst.inclGst) : null,
      boundaryCopy,
    };
  }
  if (input.partial && Number.isFinite(amount) && amount > 0) {
    const gst = presentEstimateGst(amount, input.gstRate);
    return {
      presentation: "partial",
      label: "Known sell, not the complete price",
      exGst: formatCurrency(gst.exGst),
      gst: gst.showGst ? formatCurrencyCents(gst.gstAmount) : null,
      inclGst: gst.showGst ? formatCurrencyCents(gst.inclGst) : null,
      boundaryCopy,
    };
  }
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
  return {
    presentation: "current",
    label: "Recommended client sell",
    exGst: formatCurrency(gst.exGst),
    gst: gst.showGst ? formatCurrencyCents(gst.gstAmount) : null,
    inclGst: gst.showGst ? formatCurrencyCents(gst.inclGst) : null,
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
        "pricing_attention",
        "pricing:specialist",
        "Pricing Required",
        input.specialistPricingNotice,
        null,
        false,
        "pricing_attention"
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
          action("required", `readiness:${index}`, title, null, null, true, "blocker")
        );
  for (const item of readiness) requiredKeys.add(normalizeKey(item.title));

  const required = [...readiness];
  if (input.isStale) {
    required.push(
      action(
        "required",
        "stale",
        STALE_ESTIMATE_EXPLANATION,
        null,
        null,
        true,
        "blocker"
      )
    );
  }
  const statedCountConflict = input.statedCountConflictDetail?.trim() || null;
  const productivityReview = input.productivityReviewDetail?.trim() || null;
  const conflictStatus = quantityConflictStageStatus(statedCountConflict);
  if (statedCountConflict && conflictStatus) {
    required.push(
      action(
        "required",
        "deck-stated-count",
        conflictStatus === "Needs details" ? "Complete Deck details" : "Update estimate",
        statedCountConflict,
        null,
        true,
        "blocker"
      )
    );
  }

  const accuracy: EstimateOverviewAction[] = [];
  const rates: EstimateOverviewAction[] = [];
  const seenOptional = new Set<string>();
  const pushOptional = (
    group: "accuracy" | "rates",
    id: string,
    title: string,
    detail: string | null,
    workAreaName: string | null,
    kind: "assumption" | "check" | "benchmark"
  ) => {
    const cleaned = title.trim();
    if (!cleaned || isInternalBoundary(cleaned)) return;
    const key = normalizeKey(cleaned);
    if (requiredKeys.has(key) || seenOptional.has(key)) return;
    seenOptional.add(key);
    const bucket = group === "accuracy" ? accuracy : rates;
    bucket.push(action(group, id, cleaned, detail, workAreaName, false, kind));
  };

  for (const item of input.review?.assumptions ?? []) {
    pushOptional("accuracy", item.id, item.label, null, null, "assumption");
  }
  for (const item of input.review?.checks ?? []) {
    pushOptional("accuracy", item.id, item.label, null, null, "check");
  }
  if (usesQuotrBenchmarkRates(input.rateSourceSummary)) {
    pushOptional(
      "rates",
      "rates:benchmark",
      "Some rates use Quotr benchmarks",
      "Add your own rates anytime.",
      null,
      "benchmark"
    );
  }
  for (const item of input.review?.improvements ?? []) {
    const blob = `${item.label} ${item.reason ?? ""}`;
    if (!/rate|benchmark/i.test(blob)) continue;
    pushOptional("rates", item.id, item.label, item.reason, null, "benchmark");
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
  if (productivityReview) {
    for (const name of names) missingNames.add(name);
  }
  const scopeDecisionOpen = (input.review?.checks ?? []).some((check) =>
    flooringScopeDecisionOpen(check.label)
  );
  if (scopeDecisionOpen) {
    for (const check of input.review?.checks ?? []) {
      if (!flooringScopeDecisionOpen(check.label)) continue;
      const named = names.find((name) =>
        check.label.toLowerCase().includes(name.toLowerCase())
      );
      if (named) missingNames.add(named);
      else if (names.length === 1 && names[0]) missingNames.add(names[0]);
    }
  }

  let scopeCoverageGapCount = 0;
  let unresolvedSpecificationCount = 0;
  for (const check of input.review?.checks ?? []) {
    if (flooringScopeDecisionOpen(check.label)) continue;
    const kind = classifyReviewNotice(check.label);
    if (kind === "scope_gap") scopeCoverageGapCount += 1;
    else if (kind === "specification") unresolvedSpecificationCount += 1;
  }
  for (const assumption of input.review?.assumptions ?? []) {
    if (classifyReviewNotice(assumption.label) === "scope_gap") {
      scopeCoverageGapCount += 1;
    }
  }
  const issues: EstimateIssueModel = {
    missingPriceLineCount: conflictStatus ? 0 : pricingRequired.length,
    workAreasWithMissingPrices: conflictStatus
      ? 0
      : new Set(
          pricingRequired
            .map((item) => item.workAreaName)
            .filter((name): name is string => Boolean(name))
        ).size,
    unresolvedSpecificationCount,
    scopeCoverageGapCount,
  };

  const scopeOrSpecificationOpen =
    scopeCoverageGapCount > 0 || unresolvedSpecificationCount > 0;
  const hasPricingRequired = issues.missingPriceLineCount > 0;
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
    !hasPricingRequired &&
    !scopeOrSpecificationOpen &&
    inferDisplayCostKnown(estimate.recommendedCost, estimate.recommendedSell) &&
    !unresolvedSell;
  const openCommercialConditions = (input.openCommercialConditions ?? [])
    .map((row) => row.trim())
    .filter(Boolean);
  const knownSellPartial =
    (hasPricingRequired ||
      scopeOrSpecificationOpen ||
      openCommercialConditions.length > 0) &&
    estimate != null &&
    Number.isFinite(estimate.recommendedSell) &&
    estimate.recommendedSell > 0;

  let status: EstimateOverviewStatus = "current";
  if (!input.hasEstimate) status = "incomplete";
  else if (conflictStatus === "Needs details") status = "incomplete";
  else if (input.isStale || conflictStatus === "Needs updating") status = "stale";
  else if (
    hasPricingRequired ||
    scopeOrSpecificationOpen ||
    openCommercialConditions.length > 0 ||
    scopeDecisionOpen ||
    input.review?.overview.recommendedSellIsPartial ||
    productivityReview
  ) {
    status = "pricing_required";
  }

  const statusLabel =
    status === "incomplete" || status === "pricing_required"
      ? "Incomplete"
      : status === "stale"
        ? "Stale"
        : "Estimate ready";
  const statusDetail =
    status === "incomplete"
      ? conflictStatus === "Needs details"
        ? "Deck details are still open."
        : input.detailsOutstanding
          ? "Required Details are still open."
          : "Job information is still being entered."
      : status === "stale"
        ? conflictStatus === "Needs updating"
          ? "This estimate needs updating."
          : STALE_ESTIMATE_EXPLANATION
        : status === "pricing_required"
          ? openCommercialConditions.length > 0 && pricingRequired.length === 0
            ? openCommercialConditions.join(" ")
            : scopeDecisionOpen && pricingRequired.length === 0
            ? "A flooring scope or waste choice is still open. A typed amount does not answer it."
              : issues.missingPriceLineCount > 0
              ? productivityReview ??
                estimateMissingPriceNotice(issues.missingPriceLineCount)
              : scopeOrSpecificationOpen
                ? `Generated lines are priced. ${
                    scopeCoverageGapCount > 0
                      ? formatScopeCoverageGaps(scopeCoverageGapCount) ??
                        "Requested scope still has no line."
                      : formatUnresolvedSpecifications(unresolvedSpecificationCount) ??
                        "A specification is still open."
                  }`
              : productivityReview ??
                "Some lines still need prices. Complete these in Pricing."
          : "Estimate ready";
  const pricedLinesNote =
    knownSellPartial && issues.missingPriceLineCount === 0
      ? " The amount shown is the priced-lines subtotal, not the complete job price."
      : "";

  const primary: EstimateOverviewPrimary = !input.hasEstimate
    ? input.detailsOutstanding
      ? "complete_details"
      : "continue_information"
    : conflictStatus === "Needs details"
      ? "complete_details"
      : productivityReview && !statedCountConflict
        ? "review_productivity"
        : input.isStale || conflictStatus === "Needs updating"
          ? "regenerate"
          : "continue_pricing";

  const pricingCreationBlocked =
    !input.hasEstimate || input.isStale || Boolean(statedCountConflict) || Boolean(productivityReview);
  const pricingEntry = pricingCreationBlocked
    ? "blocked"
    : input.pricingDocumentExists
      ? "open"
      : "create";

  const showCurrentComposition =
    input.hasEstimate && !input.isStale && !unresolvedSell;
  const composition = compositionRows({
    show: showCurrentComposition,
    estimate,
    breakdown: input.breakdown,
    categorySummary: input.review?.overview.categorySummary,
    costKnown,
    knownCostOnly: knownSellPartial && (estimate?.recommendedCost ?? 0) > 0,
  });

  return {
    status,
    statusLabel,
    statusDetail: `${statusDetail}${pricedLinesNote}`,
    sell: sellPresentation({
      hasEstimate: input.hasEstimate,
      isStale: input.isStale,
      countConflict: Boolean(statedCountConflict),
      unresolved: unresolvedSell,
      partial: knownSellPartial,
      estimate,
      gstRate: input.gstRate,
    }),
    composition: composition.rows,
    workAreas: {
      count: names.length,
      names,
      missingPricingCount: issues.workAreasWithMissingPrices,
      summaryLine: workAreaSummaryLine(
        names.length,
        issues.missingPriceLineCount,
        issues.workAreasWithMissingPrices,
        issues.scopeCoverageGapCount,
        issues.unresolvedSpecificationCount
      ),
      rows: names.map((name) => ({
        name,
        note:
          !conflictStatus &&
          pricingRequired.some((item) => item.workAreaName === name)
            ? "Pricing Required"
            : null,
      })),
    },
    required,
    pricingAttention: conflictStatus ? [] : pricingRequired,
    accuracy,
    rates,
    requiredCount: required.length,
    pricingAttentionCount: conflictStatus ? 0 : pricingRequired.length,
    assumptionSummary: assumptionSummaryLine(accuracy),
    benchmarkSummary: benchmarkSummaryLine(rates.length),
    reconciliation: composition.reconciliation,
    primary,
    primaryLabel:
      conflictStatus === "Needs details"
        ? "Complete Deck details"
        : conflictStatus === "Needs updating"
          ? "Update estimate"
          : PRIMARY_LABELS[primary],
    pricingCreationBlocked,
    pricingEntry,
    issues,
    scopeGapSummary: formatScopeCoverageGaps(scopeCoverageGapCount),
    specificationSummary: formatUnresolvedSpecifications(unresolvedSpecificationCount),
  };
}

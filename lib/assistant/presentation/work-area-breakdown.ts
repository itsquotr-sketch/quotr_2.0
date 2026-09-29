/**
 * UX-01D — By work area presentation.
 * Reads Builder Review fields already on the page. Does not recalculate money.
 */

import { formatCurrency } from "@/components/assistant/format";
import type {
  BuilderReviewCategoryId,
  BuilderReviewLineGroup,
  BuilderReviewPricedLine,
  BuilderReviewView,
  BuilderReviewWorkAreaGroup,
} from "@/lib/assistant/builder-review";
import { STALE_ESTIMATE_EXPLANATION } from "@/lib/assistant/mode/derive";
import {
  formatLabourHours,
  formatQuantity,
} from "@/lib/estimate/builder-presentation-format";
import { inferDisplayCostKnown } from "@/lib/financial-presentation/format";

export const WORK_AREA_PRICING_EXPLANATION =
  "This price is completed in Pricing.";

const COMPOSITION_ORDER: readonly BuilderReviewCategoryId[] = [
  "MATERIALS",
  "LABOUR",
  "SUBCONTRACT",
  "PLANT",
  "ALLOWANCES",
  "WASTE",
  "OTHER_DIRECT_COSTS",
];

const COMPOSITION_LABEL: Record<BuilderReviewCategoryId, string> = {
  MATERIALS: "Materials",
  LABOUR: "Labour",
  SUBCONTRACT: "Subcontract",
  PLANT: "Plant",
  ALLOWANCES: "Allowances",
  WASTE: "Waste",
  OTHER_DIRECT_COSTS: "Other",
  PRICING_REQUIRED: "Pricing Required",
};

export type WorkAreaBreakdownReadiness =
  | "All priced"
  | "Pricing Required"
  | "Partial"
  | "Previous estimate";

export type WorkAreaBreakdownScope = {
  readonly workAreaId: string;
  readonly name: string;
  readonly included: readonly string[];
  readonly excluded: readonly string[];
};

export type WorkAreaBreakdownLine = {
  readonly id: string;
  readonly description: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly rate: string | null;
  readonly total: string | null;
  readonly source: string | null;
  readonly pricingRequired: boolean;
};

export type WorkAreaBreakdownGroup = {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly WorkAreaBreakdownLine[];
};

export type WorkAreaBreakdownQuantity = {
  readonly id: string;
  readonly label: string;
  readonly quantity: string;
  readonly detail: string | null;
};

export type WorkAreaBreakdownPortion = {
  readonly id: string;
  readonly label: string;
  readonly summary: string | null;
  readonly areaLabel: string | null;
  readonly groups: readonly WorkAreaBreakdownGroup[];
  readonly assumptions: readonly string[];
};

export type WorkAreaBreakdownAttention = {
  readonly id: string;
  readonly description: string;
  readonly detail: string;
};

export type WorkAreaBreakdownCard = {
  readonly id: string;
  readonly name: string;
  readonly readiness: WorkAreaBreakdownReadiness;
  readonly directCost: string | null;
  readonly previousDirectCost: string | null;
  readonly indicativeSell: string | null;
  readonly labourHours: string | null;
  readonly composition: string | null;
  readonly reviewCount: number;
  readonly included: readonly string[];
  readonly excluded: readonly string[];
  readonly quantities: readonly WorkAreaBreakdownQuantity[];
  readonly portions: readonly WorkAreaBreakdownPortion[];
  readonly sharedGroups: readonly WorkAreaBreakdownGroup[];
  readonly costGroups: readonly WorkAreaBreakdownGroup[];
  readonly assumptions: readonly string[];
  readonly checks: readonly string[];
  readonly attention: readonly WorkAreaBreakdownAttention[];
};

export type WorkAreaBreakdownModel = {
  readonly title: "Estimate by Work Area";
  readonly workAreaCount: number;
  readonly pricingRequiredCount: number;
  readonly directCost: string | null;
  readonly previousDirectCost: string | null;
  readonly sell: string | null;
  readonly staleWarning: string | null;
  readonly cards: readonly WorkAreaBreakdownCard[];
  readonly otherAssumptions: readonly string[];
  readonly otherChecks: readonly string[];
};

type LineRef = {
  readonly line: BuilderReviewPricedLine;
  readonly group: BuilderReviewLineGroup | null;
  readonly category: BuilderReviewCategoryId | null;
};

function knownMoney(cost: number, sell: number): string | null {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  if (!inferDisplayCostKnown(cost, sell)) return null;
  return formatCurrency(cost);
}

function lineIsPricingRequired(
  line: BuilderReviewPricedLine,
  group: BuilderReviewLineGroup | null
): boolean {
  if (group?.pricingRequired) return true;
  if (line.category === "PRICING_REQUIRED") return true;
  return /pricing required|rate required/i.test(line.rateLabel);
}

function sourceLabel(
  line: BuilderReviewPricedLine,
  pricingRequired: boolean
): string | null {
  if (pricingRequired) return "Pricing Required";
  const label = line.rateLabel.trim();
  if (!label || /rate required|pricing required/i.test(label)) return "Pricing Required";
  return label;
}

function presentLine(
  line: BuilderReviewPricedLine,
  group: BuilderReviewLineGroup | null
): WorkAreaBreakdownLine {
  const pricingRequired = lineIsPricingRequired(line, group);
  const hideCost = pricingRequired || Boolean(group?.costHidden) || line.recommendedCost <= 0;
  const rate =
    !pricingRequired && line.costRate != null && line.costRate > 0
      ? line.unit
        ? `${formatCurrency(line.costRate)} / ${line.unit}`
        : formatCurrency(line.costRate)
      : null;
  return {
    id: line.id,
    description: line.label,
    quantity: line.quantity == null ? null : formatQuantity(line.quantity),
    unit: line.unit,
    rate,
    total: hideCost ? null : formatCurrency(line.recommendedCost),
    source: sourceLabel(line, pricingRequired),
    pricingRequired,
  };
}

function collectLines(area: BuilderReviewWorkAreaGroup): LineRef[] {
  const refs: LineRef[] = [];
  const seen = new Set<string>();
  const push = (
    line: BuilderReviewPricedLine,
    group: BuilderReviewLineGroup | null,
    category: BuilderReviewCategoryId | null
  ) => {
    if (seen.has(line.id)) return;
    seen.add(line.id);
    refs.push({ line, group, category });
  };
  for (const category of area.categories) {
    for (const line of category.lines) push(line, null, category.id);
    for (const group of category.lineGroups) {
      for (const line of group.children) push(line, group, category.id);
    }
  }
  for (const portion of area.portionGroups ?? []) {
    for (const group of portion.lineGroups) {
      for (const line of group.children) push(line, group, line.category);
    }
  }
  for (const group of area.sharedLineGroups ?? []) {
    for (const line of group.children) push(line, group, line.category);
  }
  return refs;
}

function groupsFrom(
  idPrefix: string,
  lines: readonly LineRef[]
): WorkAreaBreakdownGroup[] {
  const groups: WorkAreaBreakdownGroup[] = [];
  for (const categoryId of COMPOSITION_ORDER) {
    const matched = lines.filter((row) => (row.category ?? row.line.category) === categoryId);
    if (matched.length === 0) continue;
    groups.push({
      id: `${idPrefix}-${categoryId}`,
      title: COMPOSITION_LABEL[categoryId],
      lines: matched.map((row) => presentLine(row.line, row.group)),
    });
  }
  return groups;
}

function labourHoursLabel(lines: readonly LineRef[]): string | null {
  const hours = lines.reduce((sum, row) => sum + (row.line.labourHours ?? 0), 0);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return `${formatLabourHours(hours)} hrs`;
}

function compositionLabel(lines: readonly LineRef[]): string | null {
  const present = new Set<BuilderReviewCategoryId>();
  for (const row of lines) {
    if (lineIsPricingRequired(row.line, row.group)) continue;
    if (row.line.recommendedCost <= 0) continue;
    const category = row.category ?? row.line.category;
    if (category === "PRICING_REQUIRED") continue;
    present.add(category);
  }
  const labels = COMPOSITION_ORDER.filter((id) => present.has(id)).map(
    (id) => COMPOSITION_LABEL[id]
  );
  return labels.length > 0 ? labels.join(" · ") : null;
}

function mentions(text: string, name: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle.length < 3) return false;
  return text.toLowerCase().includes(needle);
}

function scopeFor(
  area: BuilderReviewWorkAreaGroup,
  scope: readonly WorkAreaBreakdownScope[]
): WorkAreaBreakdownScope | null {
  const byId = area.workAreaId
    ? scope.find((row) => row.workAreaId === area.workAreaId)
    : undefined;
  if (byId) return byId;
  const named = scope.filter(
    (row) => row.name.trim().toLowerCase() === area.workAreaName.trim().toLowerCase()
  );
  return named.length === 1 ? named[0]! : null;
}

function quantitiesFor(area: BuilderReviewWorkAreaGroup): WorkAreaBreakdownQuantity[] {
  const rows: WorkAreaBreakdownQuantity[] = [];
  for (const category of area.categories) {
    for (const row of category.takeoff) {
      rows.push({
        id: row.requirementId,
        label: row.label,
        quantity: `${formatQuantity(row.quantity)} ${row.unit}`.trim(),
        detail: row.specification ?? row.detail,
      });
    }
  }
  return rows;
}

function presentCard(
  area: BuilderReviewWorkAreaGroup,
  view: BuilderReviewView,
  scope: WorkAreaBreakdownScope | null,
  assumptions: readonly string[],
  checks: readonly string[]
): WorkAreaBreakdownCard {
  const lines = collectLines(area);
  const needsPrice = lines.some((row) => lineIsPricingRequired(row.line, row.group));
  const costLabel = knownMoney(area.cost, area.sell);
  const stale = view.overview.isStale;
  const partial =
    Boolean(area.partialEstimateLabel) ||
    Boolean(view.overview.recommendedSellIsPartial && needsPrice && costLabel);
  let readiness: WorkAreaBreakdownReadiness = "All priced";
  if (stale) readiness = "Previous estimate";
  else if (!costLabel && (needsPrice || partial || lines.length === 0)) {
    readiness = "Pricing Required";
  } else if (needsPrice || partial) readiness = "Partial";
  else if (!costLabel) readiness = "Pricing Required";

  const portionAssumptions = (area.portionGroups ?? []).flatMap((portion) => [
    ...portion.assumptions,
  ]);
  const reviewCount = assumptions.length + checks.length + portionAssumptions.length;
  const sell =
    readiness === "All priced" &&
    !stale &&
    !view.overview.recommendedSellIsPartial &&
    area.sell > 0
      ? formatCurrency(area.sell)
      : null;

  const portions: WorkAreaBreakdownPortion[] = (area.portionGroups ?? []).map((portion) => ({
    id: portion.id,
    label: portion.label,
    summary: portion.summary,
    areaLabel: portion.areaLabel,
    groups: groupsFrom(
      portion.id,
      portion.lineGroups.flatMap((group) =>
        group.children.map((line) => ({
          line,
          group,
          category: line.category,
        }))
      )
    ),
    assumptions: portion.assumptions,
  }));

  const attention: WorkAreaBreakdownAttention[] = lines
    .filter((row) => lineIsPricingRequired(row.line, row.group))
    .map((row) => ({
      id: row.line.id,
      description: row.line.label,
      detail: WORK_AREA_PRICING_EXPLANATION,
    }));

  return {
    id: area.workAreaId ?? area.workAreaName,
    name: area.workAreaName,
    readiness,
    directCost: !stale && readiness !== "Pricing Required" ? costLabel : null,
    previousDirectCost: stale ? costLabel : null,
    indicativeSell: sell,
    labourHours: labourHoursLabel(lines),
    composition: compositionLabel(lines),
    reviewCount,
    included: scope?.included ?? [],
    excluded: scope?.excluded ?? [],
    quantities: quantitiesFor(area),
    portions,
    sharedGroups: groupsFrom(
      `${area.workAreaName}-shared`,
      (area.sharedLineGroups ?? []).flatMap((group) =>
        group.children.map((line) => ({ line, group, category: line.category }))
      )
    ),
    costGroups: groupsFrom(
      area.workAreaName,
      lines.filter((row) => {
        const inPortion = (area.portionGroups ?? []).some((portion) =>
          portion.lineGroups.some((group) => group.children.some((line) => line.id === row.line.id))
        );
        const shared = (area.sharedLineGroups ?? []).some((group) =>
          group.children.some((line) => line.id === row.line.id)
        );
        return !inPortion && !shared;
      })
    ),
    assumptions,
    checks,
    attention,
  };
}

export function projectWorkAreaBreakdown(
  view: BuilderReviewView,
  scope: readonly WorkAreaBreakdownScope[] = []
): WorkAreaBreakdownModel {
  const stale = view.overview.isStale;
  const directKnown = knownMoney(view.overview.recommendedCost, view.overview.recommendedSell);
  const areas = view.workAreas;
  const single = areas.length === 1;

  const assignedAssumptions = new Set<string>();
  const assignedChecks = new Set<string>();
  const cards = areas.map((area) => {
    const assumptions = view.assumptions
      .filter((item) => single || mentions(item.label, area.workAreaName))
      .map((item) => item.label);
    const checks = view.checks
      .filter((item) => single || mentions(item.label, area.workAreaName))
      .map((item) => item.label);
    for (const label of assumptions) assignedAssumptions.add(label);
    for (const label of checks) assignedChecks.add(label);
    return presentCard(area, view, scopeFor(area, scope), assumptions, checks);
  });

  return {
    title: "Estimate by Work Area",
    workAreaCount: view.overview.workAreaCount,
    pricingRequiredCount: cards.filter(
      (card) => card.readiness === "Pricing Required" || card.readiness === "Partial"
    ).length,
    directCost: stale ? null : directKnown,
    previousDirectCost: stale ? directKnown : null,
    sell:
      !stale &&
      !view.overview.recommendedSellIsPartial &&
      view.overview.recommendedSell > 0
        ? formatCurrency(view.overview.recommendedSell)
        : null,
    staleWarning: stale ? STALE_ESTIMATE_EXPLANATION : null,
    cards,
    otherAssumptions: single
      ? []
      : view.assumptions
          .map((item) => item.label)
          .filter((label) => !assignedAssumptions.has(label)),
    otherChecks: single
      ? []
      : view.checks
          .map((item) => item.label)
          .filter((label) => !assignedChecks.has(label)),
  };
}

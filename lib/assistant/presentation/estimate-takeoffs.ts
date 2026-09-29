/**
 * UX-01E — Materials, labour, and review presentations.
 * Copies Builder Review line fields. Does not apply rates or recompute hours.
 */

import { formatCurrency } from "@/components/assistant/format";
import type {
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

export const TAKEOFF_PRICING_EXPLANATION =
  "This price is completed in Pricing.";

type PlacedLine = {
  readonly line: BuilderReviewPricedLine;
  readonly group: BuilderReviewLineGroup | null;
  readonly workArea: string;
  readonly portion: string | null;
  readonly shared: boolean;
};

export type TakeoffRow = {
  readonly id: string;
  readonly description: string;
  readonly workArea: string;
  readonly portion: string | null;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly unitCost: string | null;
  readonly total: string | null;
  readonly hours: string | null;
  readonly hourlyCost: string | null;
  readonly productivity: string | null;
  readonly source: string | null;
  readonly pricingRequired: boolean;
  readonly shared: boolean;
  /** Existing line total, copied for display summaries. Not a new rate calculation. */
  readonly knownCost: number | null;
  /** Existing labour hours, copied. Not derived from quantity or productivity. */
  readonly knownHours: number | null;
};

export type TakeoffGroup = {
  readonly workArea: string;
  readonly rows: readonly TakeoffRow[];
};

export type MaterialsTakeoffModel = {
  readonly title: "Materials takeoff";
  readonly lineCount: number;
  readonly knownCost: string | null;
  readonly knownCostLabel: "Known material cost" | "Previous material cost";
  readonly pricingRequiredCount: number;
  readonly staleWarning: string | null;
  readonly groups: readonly TakeoffGroup[];
  readonly empty: boolean;
};

export type LabourTakeoffModel = {
  readonly title: "Labour takeoff";
  readonly lineCount: number;
  readonly knownHours: string | null;
  readonly knownHoursLabel: "Known labour hours" | "Previous labour hours";
  readonly knownCost: string | null;
  readonly knownCostLabel: "Known labour cost" | "Previous labour cost";
  readonly pricingRequiredCount: number;
  readonly staleWarning: string | null;
  readonly groups: readonly TakeoffGroup[];
  readonly empty: boolean;
};

export type ReviewEntry = {
  readonly id: string;
  readonly label: string;
  readonly detail: string | null;
};

export type ReviewGroup = {
  readonly id: string;
  readonly name: string;
  readonly attention: readonly ReviewEntry[];
  readonly assumptions: readonly ReviewEntry[];
  readonly benchmarks: readonly ReviewEntry[];
};

export type AssumptionsReviewModel = {
  readonly title: "Assumptions and checks";
  readonly attentionCount: number;
  readonly assumptionCount: number;
  readonly benchmarkCount: number;
  readonly staleWarning: string | null;
  readonly groups: readonly ReviewGroup[];
  readonly empty: boolean;
};

function pricingRequired(
  line: BuilderReviewPricedLine,
  group: BuilderReviewLineGroup | null
): boolean {
  if (group?.pricingRequired) return true;
  if (line.category === "PRICING_REQUIRED") return true;
  return /pricing required|rate required/i.test(line.rateLabel);
}

function sourceLabel(line: BuilderReviewPricedLine, required: boolean): string | null {
  if (required) return "Pricing Required";
  const label = line.rateLabel.trim();
  if (!label || /rate required|pricing required/i.test(label)) return "Pricing Required";
  return label;
}

function knownAmount(line: BuilderReviewPricedLine, required: boolean): number | null {
  if (required || line.recommendedCost <= 0) return null;
  if (!inferDisplayCostKnown(line.recommendedCost, line.recommendedSell)) return null;
  return line.recommendedCost;
}

function money(amount: number | null): string | null {
  if (amount == null || amount <= 0) return null;
  return formatCurrency(amount);
}

function hourlyUnit(unit: string | null): boolean {
  return Boolean(unit && /^(hr|hrs|hour|hours)$/i.test(unit.trim()));
}

function presentRow(placed: PlacedLine): TakeoffRow {
  const { line, group } = placed;
  const required = pricingRequired(line, group);
  const cost = group?.costHidden ? null : knownAmount(line, required);
  const hours =
    line.labourHours != null && line.labourHours > 0 ? line.labourHours : null;
  const unitCost =
    cost != null && line.costRate != null && line.costRate > 0
      ? formatCurrency(line.costRate)
      : null;
  const labour = isLabourLine(line);
  return {
    id: line.id,
    description: line.label,
    workArea: placed.workArea,
    portion: placed.portion,
    quantity: line.quantity == null ? null : formatQuantity(line.quantity),
    unit: line.unit,
    unitCost: labour ? null : unitCost,
    total: money(cost),
    hours: hours == null ? null : `${formatLabourHours(hours)} hrs`,
    hourlyCost: labour && hourlyUnit(line.unit) ? unitCost : null,
    productivity: line.productivityLabel,
    source: sourceLabel(line, required),
    pricingRequired: required,
    shared: placed.shared,
    knownCost: cost,
    knownHours: hours,
  };
}

function isMaterialLine(line: BuilderReviewPricedLine): boolean {
  if (line.category === "MATERIALS") return true;
  return line.category === "PRICING_REQUIRED" && line.sourceLine.category === "materials";
}

function isLabourLine(line: BuilderReviewPricedLine): boolean {
  if (line.category === "LABOUR") return true;
  return line.category === "PRICING_REQUIRED" && line.sourceLine.category === "labour";
}

function placeLines(view: BuilderReviewView): PlacedLine[] {
  const sharedIds = new Set<string>();
  const seen = new Set<string>();
  const placed: PlacedLine[] = [];

  const push = (entry: PlacedLine) => {
    if (seen.has(entry.line.id)) return;
    seen.add(entry.line.id);
    placed.push(entry);
  };

  for (const area of view.workAreas) {
    for (const group of area.sharedLineGroups ?? []) {
      for (const line of group.children) {
        sharedIds.add(line.id);
        push({
          line,
          group,
          workArea: area.workAreaName,
          portion: group.label || "Shared",
          shared: true,
        });
      }
    }
  }

  for (const area of view.workAreas) {
    for (const portion of area.portionGroups ?? []) {
      for (const group of portion.lineGroups) {
        for (const line of group.children) {
          if (sharedIds.has(line.id)) continue;
          push({
            line,
            group,
            workArea: area.workAreaName,
            portion: portion.label,
            shared: false,
          });
        }
      }
    }
    pushCategoryLines(area, sharedIds, push);
  }

  return placed;
}

function pushCategoryLines(
  area: BuilderReviewWorkAreaGroup,
  sharedIds: ReadonlySet<string>,
  push: (entry: PlacedLine) => void
) {
  for (const category of area.categories) {
    for (const line of category.lines) {
      if (sharedIds.has(line.id)) continue;
      push({
        line,
        group: null,
        workArea: area.workAreaName,
        portion: null,
        shared: false,
      });
    }
    for (const group of category.lineGroups) {
      for (const line of group.children) {
        if (sharedIds.has(line.id)) continue;
        push({
          line,
          group,
          workArea: area.workAreaName,
          portion: group.label,
          shared: false,
        });
      }
    }
  }
}

function groupRows(rows: readonly TakeoffRow[]): TakeoffGroup[] {
  const groups: TakeoffGroup[] = [];
  for (const row of rows) {
    const existing = groups.find((group) => group.workArea === row.workArea);
    if (existing) {
      groups[groups.indexOf(existing)] = {
        workArea: existing.workArea,
        rows: [...existing.rows, row],
      };
    } else {
      groups.push({ workArea: row.workArea, rows: [row] });
    }
  }
  return groups;
}

function sumKnown(rows: readonly TakeoffRow[], key: "knownCost" | "knownHours"): number | null {
  let total = 0;
  let any = false;
  for (const row of rows) {
    const value = row[key];
    if (value == null) continue;
    total += value;
    any = true;
  }
  return any ? total : null;
}

export function projectMaterialsTakeoff(view: BuilderReviewView): MaterialsTakeoffModel {
  const rows = placeLines(view)
    .filter((row) => isMaterialLine(row.line))
    .map(presentRow);
  const stale = view.overview.isStale;
  const known = sumKnown(rows, "knownCost");
  return {
    title: "Materials takeoff",
    lineCount: rows.length,
    knownCost: money(known),
    knownCostLabel: stale ? "Previous material cost" : "Known material cost",
    pricingRequiredCount: rows.filter((row) => row.pricingRequired).length,
    staleWarning: stale ? STALE_ESTIMATE_EXPLANATION : null,
    groups: groupRows(rows),
    empty: rows.length === 0,
  };
}

export function projectLabourTakeoff(view: BuilderReviewView): LabourTakeoffModel {
  const rows = placeLines(view)
    .filter((row) => isLabourLine(row.line))
    .map(presentRow);
  const stale = view.overview.isStale;
  const knownCost = sumKnown(rows, "knownCost");
  const knownHours = sumKnown(rows, "knownHours");
  return {
    title: "Labour takeoff",
    lineCount: rows.length,
    knownHours: knownHours == null ? null : `${formatLabourHours(knownHours)} hrs`,
    knownHoursLabel: stale ? "Previous labour hours" : "Known labour hours",
    knownCost: money(knownCost),
    knownCostLabel: stale ? "Previous labour cost" : "Known labour cost",
    pricingRequiredCount: rows.filter((row) => row.pricingRequired).length,
    staleWarning: stale ? STALE_ESTIMATE_EXPLANATION : null,
    groups: groupRows(rows),
    empty: rows.length === 0,
  };
}

function mentions(text: string, name: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle.length < 3) return false;
  return text.toLowerCase().includes(needle);
}

type MutableReviewGroup = {
  id: string;
  name: string;
  attention: ReviewEntry[];
  assumptions: ReviewEntry[];
  benchmarks: ReviewEntry[];
};

export function projectAssumptionsReview(view: BuilderReviewView): AssumptionsReviewModel {
  const areas = view.workAreas;
  const single = areas.length === 1;
  const groups: MutableReviewGroup[] = areas.map((area) => ({
    id: area.workAreaId ?? area.workAreaName,
    name: area.workAreaName,
    attention: [],
    assumptions: [],
    benchmarks: [],
  }));
  const other: MutableReviewGroup = {
    id: "other",
    name: "Other",
    attention: [],
    assumptions: [],
    benchmarks: [],
  };

  const bucket = (label: string): MutableReviewGroup => {
    if (single && groups[0]) return groups[0];
    const match = groups.find((group) => mentions(label, group.name));
    return match ?? other;
  };

  for (const item of view.checks) {
    bucket(item.label).attention.push({ id: item.id, label: item.label, detail: item.detail });
  }
  for (const item of view.assumptions) {
    bucket(item.label).assumptions.push({
      id: item.id,
      label: item.label,
      detail: item.detail,
    });
  }
  for (const area of areas) {
    const group = groups.find((row) => row.name === area.workAreaName) ?? other;
    for (const portion of area.portionGroups ?? []) {
      portion.assumptions.forEach((label, index) => {
        if (group.assumptions.some((row) => row.label === label)) return;
        group.assumptions.push({
          id: `${portion.id}-assumption-${index}`,
          label,
          detail: portion.label,
        });
      });
    }
    for (const placed of placeLines({ ...view, workAreas: [area] })) {
      if (!/benchmark/i.test(placed.line.rateLabel)) continue;
      if (group.benchmarks.some((row) => row.id === placed.line.id)) continue;
      group.benchmarks.push({
        id: placed.line.id,
        label: placed.line.label,
        detail: placed.line.rateLabel,
      });
    }
  }

  const visible = [...groups, other].filter(
    (group) =>
      group.attention.length > 0 ||
      group.assumptions.length > 0 ||
      group.benchmarks.length > 0
  );
  const attentionCount = visible.reduce((sum, group) => sum + group.attention.length, 0);
  const assumptionCount = visible.reduce((sum, group) => sum + group.assumptions.length, 0);
  const benchmarkCount = visible.reduce((sum, group) => sum + group.benchmarks.length, 0);

  return {
    title: "Assumptions and checks",
    attentionCount,
    assumptionCount,
    benchmarkCount,
    staleWarning: view.overview.isStale ? STALE_ESTIMATE_EXPLANATION : null,
    groups: visible,
    empty: attentionCount + assumptionCount + benchmarkCount === 0,
  };
}

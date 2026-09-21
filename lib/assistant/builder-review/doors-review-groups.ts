/**
 * DOORS-05 — Builder Review Door Set grouping.
 *
 * Presentation only. Does not mutate commercial money.
 */
import { round2 } from "@/lib/estimate/facts";
import {
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_INSTALL_LABOUR,
  DOORS_HARDWARE_STANDARD_COMPONENT,
  DOORS_PREHUNG_INSTALL_LABOUR,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR,
  DOORS_SPECIALIST_COMPONENT,
} from "@/lib/estimate/doors-identities";
import { formatDoorsReviewTitle } from "@/lib/estimate/doors-commercial";
import { calculateDoorsPhysical } from "@/lib/estimate/doors-physical";
import { hasDoorsPortionsFact } from "@/lib/estimate/doors-portions";
import type { EstimateFact } from "@/lib/estimate/types";
import type {
  BuilderReviewCategoryGroup,
  BuilderReviewLineGroup,
  BuilderReviewPortionGroup,
  BuilderReviewPricedLine,
} from "@/lib/assistant/builder-review/types";

function lineIsPricingRequired(line: BuilderReviewPricedLine): boolean {
  return (
    line.category === "PRICING_REQUIRED" ||
    line.rateLabel === "Pricing Required" ||
    line.rateLabel === "Rate required"
  );
}

function isHardwareLine(line: BuilderReviewPricedLine): boolean {
  return (line.componentKey ?? "") === DOORS_HARDWARE_STANDARD_COMPONENT;
}

function isLabourLine(line: BuilderReviewPricedLine): boolean {
  const key = line.componentKey ?? "";
  return (
    key === DOORS_PREHUNG_INSTALL_LABOUR ||
    key === DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR ||
    key === DOORS_HARDWARE_INSTALL_LABOUR ||
    line.category === "LABOUR"
  );
}

function isSupplyLine(line: BuilderReviewPricedLine): boolean {
  if (isHardwareLine(line) || isLabourLine(line)) return false;
  return (
    line.category === "MATERIALS" ||
    line.componentKey === DOORS_CUSTOM_LEAF_COMPONENT
  );
}

function groupCost(children: readonly BuilderReviewPricedLine[]): number {
  return round2(
    children.reduce((sum, line) => sum + (lineIsPricingRequired(line) ? 0 : line.recommendedCost), 0)
  );
}

function makeGroup(
  id: string,
  label: string,
  children: readonly BuilderReviewPricedLine[]
): BuilderReviewLineGroup | null {
  if (children.length === 0) return null;
  const pricingRequired = children.some(lineIsPricingRequired);
  return {
    id,
    label,
    recommendedCost: groupCost(children),
    supporting: children
      .map((row) => row.supporting)
      .filter(Boolean)
      .join(" · ") || null,
    secondary: label,
    itemKey: children[0]?.itemKey ?? null,
    showChangeMaterial: false,
    rateContext: pricingRequired ? "Pricing Required" : null,
    pricingRequired,
    costHidden: pricingRequired,
    children,
  };
}

export function applyDoorsReviewGroups(params: {
  categories: BuilderReviewCategoryGroup[];
  facts: readonly EstimateFact[];
  workAreaId: string | null;
}): {
  categories: BuilderReviewCategoryGroup[];
  portionGroups: BuilderReviewPortionGroup[];
} {
  const workAreaId = params.workAreaId ?? "";
  const physical = hasDoorsPortionsFact(params.facts, workAreaId)
    ? calculateDoorsPhysical({
        facts: params.facts,
        workArea: { id: workAreaId, type: "doors", name: "Doors" },
      })
    : null;

  const bySet = new Map<string, BuilderReviewPricedLine[]>();
  const remainingByCat = new Map<string, BuilderReviewPricedLine[]>();

  for (const cat of params.categories) {
    remainingByCat.set(cat.id, []);
  }

  for (const cat of params.categories) {
    for (const line of cat.lines) {
      const nestedId = line.sourceLine.nestedItemId;
      if (!nestedId) {
        remainingByCat.get(cat.id)?.push(line);
        continue;
      }
      const list = bySet.get(nestedId) ?? [];
      list.push(line);
      bySet.set(nestedId, list);
    }
  }

  const portionGroups: BuilderReviewPortionGroup[] = [];
  for (const portion of physical?.portions ?? []) {
    const children = bySet.get(portion.nestedItemId) ?? [];
    bySet.delete(portion.nestedItemId);
    const supply = children.filter(
      (row) =>
        isSupplyLine(row) &&
        row.componentKey !== DOORS_SPECIALIST_COMPONENT &&
        !lineIsPricingRequired(row)
    );
    const hardware = children.filter(
      (row) => isHardwareLine(row) && !lineIsPricingRequired(row)
    );
    const labour = children.filter(
      (row) => isLabourLine(row) && !lineIsPricingRequired(row)
    );
    const pricing = children.filter(
      (row) =>
        lineIsPricingRequired(row) ||
        row.componentKey === DOORS_SPECIALIST_COMPONENT ||
        row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT
    );
    const lineGroups = [
      makeGroup(`doors-supply-${portion.nestedItemId}`, "Door supply", supply),
      makeGroup(`doors-hardware-${portion.nestedItemId}`, "Hardware", hardware),
      makeGroup(`doors-labour-${portion.nestedItemId}`, "Labour", labour),
      makeGroup(
        `doors-pr-${portion.nestedItemId}`,
        "Pricing Required",
        pricing
      ),
    ].filter((row): row is BuilderReviewLineGroup => row != null);

    portionGroups.push({
      id: `doors-set-${portion.nestedItemId}`,
      label: formatDoorsReviewTitle(portion),
      summary: portion.summary,
      areaLabel: null,
      lineGroups,
      assumptions: portion.disclosures,
    });
  }

  for (const [nestedId, children] of bySet) {
    portionGroups.push({
      id: `doors-set-${nestedId}`,
      label: "Door Set",
      summary: null,
      areaLabel: null,
      lineGroups: [
        makeGroup(`doors-other-${nestedId}`, "Doors", children),
      ].filter((row): row is BuilderReviewLineGroup => row != null),
      assumptions: [],
    });
  }

  const categories = params.categories.map((cat) => ({
    ...cat,
    lines: remainingByCat.get(cat.id) ?? [],
  }));

  return { categories, portionGroups };
}

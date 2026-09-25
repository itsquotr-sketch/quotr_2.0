/**
 * CLADDING-05 — Builder Review grouping for nested Cladding sections.
 *
 * Presentation only. Does not change commercial money.
 */
import {
  claddingReviewDisclosures,
  formatCladdingReviewTitle,
} from "@/lib/estimate/cladding-commercial";
import {
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
} from "@/lib/estimate/cladding-identities";
import { calculateCladdingPhysical } from "@/lib/estimate/cladding-physical";
import { CLADDING_PORTIONS_FACT_KEY } from "@/lib/estimate/cladding-portions";
import { formatQuantity } from "@/lib/estimate/builder-presentation-format";
import { round2 } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";
import type {
  BuilderReviewCategoryGroup,
  BuilderReviewLineGroup,
  BuilderReviewPortionGroup,
  BuilderReviewPricedLine,
} from "@/lib/assistant/builder-review/types";

const ACCESSORY_KEYS = new Set<string>([
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
  CLADDING_TRIMS_UNRESOLVED,
]);

function lineIsPricingRequired(line: BuilderReviewPricedLine): boolean {
  return (
    line.category === "PRICING_REQUIRED" ||
    line.rateLabel === "Pricing Required" ||
    line.rateLabel === "Rate required" ||
    line.rateLabel === "Pricing required"
  );
}

function groupCost(children: readonly BuilderReviewPricedLine[]): number {
  return round2(
    children.reduce(
      (sum, line) => sum + (lineIsPricingRequired(line) ? 0 : line.recommendedCost),
      0
    )
  );
}

function makeGroup(
  id: string,
  label: string,
  children: readonly BuilderReviewPricedLine[]
): BuilderReviewLineGroup | null {
  if (children.length === 0) return null;
  const pricingRequired = children.every(lineIsPricingRequired);
  return {
    id,
    label,
    recommendedCost: groupCost(children),
    supporting:
      children
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

export function applyCladdingReviewGroups(params: {
  categories: BuilderReviewCategoryGroup[];
  facts: readonly EstimateFact[];
  workAreaId: string | null;
}): {
  categories: BuilderReviewCategoryGroup[];
  portionGroups: BuilderReviewPortionGroup[];
} {
  const workAreaId = params.workAreaId ?? "";
  const hasPortions = params.facts.some(
    (fact) =>
      fact.key === CLADDING_PORTIONS_FACT_KEY &&
      (fact.work_area_id == null || fact.work_area_id === workAreaId)
  );
  const physical = hasPortions
    ? calculateCladdingPhysical({
        facts: params.facts,
        workArea: { id: workAreaId, type: "cladding" },
      })
    : null;

  const bySection = new Map<string, BuilderReviewPricedLine[]>();
  const remainingByCat = new Map<string, BuilderReviewPricedLine[]>();
  for (const cat of params.categories) remainingByCat.set(cat.id, []);

  for (const cat of params.categories) {
    for (const line of cat.lines) {
      const nestedId = line.sourceLine.nestedItemId;
      if (!nestedId) {
        remainingByCat.get(cat.id)?.push(line);
        continue;
      }
      const list = bySection.get(nestedId) ?? [];
      list.push(line);
      bySection.set(nestedId, list);
    }
  }

  const portionGroups: BuilderReviewPortionGroup[] = [];
  for (const portion of physical?.portions ?? []) {
    const children = bySection.get(portion.nestedItemId) ?? [];
    bySection.delete(portion.nestedItemId);
    const material = children.filter(
      (row) =>
        row.category === "MATERIALS" &&
        !lineIsPricingRequired(row) &&
        !ACCESSORY_KEYS.has(row.componentKey ?? "")
    );
    const installation = children.filter(
      (row) =>
        !lineIsPricingRequired(row) &&
        (row.componentKey ?? "").includes(".install.")
    );
    const removal = children.filter(
      (row) =>
        !lineIsPricingRequired(row) &&
        (row.componentKey ?? "").includes(".remove.")
    );
    const accessories = children.filter((row) =>
      ACCESSORY_KEYS.has(row.componentKey ?? "")
    );
    const pricing = children.filter(
      (row) =>
        lineIsPricingRequired(row) && !ACCESSORY_KEYS.has(row.componentKey ?? "")
    );
    const lineGroups = [
      makeGroup(`cladding-material-${portion.nestedItemId}`, "Cladding material", material),
      makeGroup(`cladding-install-${portion.nestedItemId}`, "Installation labour", installation),
      makeGroup(`cladding-removal-${portion.nestedItemId}`, "Removal", removal),
      makeGroup(`cladding-accessories-${portion.nestedItemId}`, "Accessories", accessories),
      makeGroup(`cladding-pr-${portion.nestedItemId}`, "Pricing Required", pricing),
    ].filter((row): row is BuilderReviewLineGroup => row != null);

    portionGroups.push({
      id: `cladding-section-${portion.nestedItemId}`,
      label: formatCladdingReviewTitle(portion),
      summary: portion.summary,
      areaLabel:
        portion.netAreaM2 != null ? `${formatQuantity(portion.netAreaM2)} m² net` : null,
      lineGroups,
      assumptions: [...claddingReviewDisclosures(portion)],
    });
  }

  const categories = params.categories.map((cat) => ({
    ...cat,
    lines: remainingByCat.get(cat.id) ?? [],
  }));

  return { categories, portionGroups };
}

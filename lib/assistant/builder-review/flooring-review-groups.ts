/**
 * FLOORING-05 — Builder Review Flooring Area grouping.
 *
 * Presentation only. Does not mutate commercial money.
 */
import { round2 } from "@/lib/estimate/facts";
import {
  FLOORING_ADDON_COMPONENT_KEYS,
  formatFlooringReviewTitle,
  isFlooringFinishPackageComponent,
} from "@/lib/estimate/flooring-commercial";
import {
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_CUSTOM_REMOVAL_COMPONENT,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
} from "@/lib/estimate/flooring-identities";
import { isFlooringFramingAllowanceKey } from "@/lib/estimate/flooring-framing-authority";
import { calculateFlooringPhysical } from "@/lib/estimate/flooring-physical";
import { hasFlooringPortionsFact } from "@/lib/estimate/flooring-portions";
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

function isFinishLine(line: BuilderReviewPricedLine): boolean {
  return isFlooringFinishPackageComponent(line.componentKey ?? "");
}

function isAddonLine(line: BuilderReviewPricedLine): boolean {
  return (FLOORING_ADDON_COMPONENT_KEYS as readonly string[]).includes(
    line.componentKey ?? ""
  );
}

function isSubstrateLine(line: BuilderReviewPricedLine): boolean {
  const key = line.componentKey ?? "";
  return (
    key === FLOORING_SUBSTRATE_MATERIAL_COMPONENT ||
    key === FLOORING_SUBSTRATE_INSTALL_LABOUR
  );
}

function isFramingLine(line: BuilderReviewPricedLine): boolean {
  return isFlooringFramingAllowanceKey(line.componentKey);
}

function isRemovalLine(line: BuilderReviewPricedLine): boolean {
  const key = line.componentKey ?? "";
  return (
    /\.remove$/.test(key) ||
    key === FLOORING_CUSTOM_REMOVAL_COMPONENT ||
    /removal/i.test(line.label)
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
  children: readonly BuilderReviewPricedLine[],
  supporting?: string | null
): BuilderReviewLineGroup | null {
  if (children.length === 0) return null;
  const pricingRequired = children.some(lineIsPricingRequired);
  return {
    id,
    label,
    recommendedCost: groupCost(children),
    supporting:
      supporting ||
      children
        .map((row) => row.supporting)
        .filter(Boolean)
        .join(" · ") ||
      null,
    secondary: label,
    itemKey: children[0]?.itemKey ?? null,
    showChangeMaterial: false,
    rateContext: pricingRequired ? "Pricing Required" : null,
    pricingRequired,
    costHidden: pricingRequired,
    children,
  };
}

export function applyFlooringReviewGroups(params: {
  categories: BuilderReviewCategoryGroup[];
  facts: readonly EstimateFact[];
  workAreaId: string | null;
}): {
  categories: BuilderReviewCategoryGroup[];
  portionGroups: BuilderReviewPortionGroup[];
} {
  const workAreaId = params.workAreaId ?? "";
  const physical = hasFlooringPortionsFact(params.facts, workAreaId)
    ? calculateFlooringPhysical({
        facts: params.facts,
        workArea: { id: workAreaId, type: "flooring", name: "Flooring" },
      })
    : null;

  const byArea = new Map<string, BuilderReviewPricedLine[]>();
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
      const list = byArea.get(nestedId) ?? [];
      list.push(line);
      byArea.set(nestedId, list);
    }
  }

  const portionGroups: BuilderReviewPortionGroup[] = [];
  for (const portion of physical?.portions ?? []) {
    const children = byArea.get(portion.nestedItemId) ?? [];
    byArea.delete(portion.nestedItemId);
    const finish = children.filter(
      (row) => isFinishLine(row) && !lineIsPricingRequired(row)
    );
    const addons = children.filter(
      (row) => isAddonLine(row) && !lineIsPricingRequired(row)
    );
    const substrate = children.filter(
      (row) => isSubstrateLine(row) && !lineIsPricingRequired(row)
    );
    const framing = children.filter(
      (row) => isFramingLine(row) && !lineIsPricingRequired(row)
    );
    const removal = children.filter(
      (row) => isRemovalLine(row) && !lineIsPricingRequired(row)
    );
    const pricing = children.filter(
      (row) =>
        lineIsPricingRequired(row) ||
        row.componentKey === FLOORING_SPECIALIST_COMPONENT ||
        row.componentKey === FLOORING_CUSTOM_FINISH_COMPONENT
    );
    const finishSupporting = portion.tile
      ? `m² package basis. Informational ${portion.tile.wholeTileCount} whole tiles (${portion.tile.tileWidthMm} × ${portion.tile.tileLengthMm} mm). Tile count is takeoff information and does not multiply the subcontract COST.`
      : portion.hardwood
        ? `m² package basis. Informational ${round2(portion.hardwood.linealM)} lm at ${portion.hardwood.boardWidthMm} mm boards. The lineal-metre takeoff does not multiply the subcontract COST.`
        : null;
    const lineGroups = [
      makeGroup(
        `flooring-finish-${portion.nestedItemId}`,
        "Finish",
        finish,
        finishSupporting
      ),
      makeGroup(`flooring-addons-${portion.nestedItemId}`, "Add-ons", addons),
      makeGroup(
        `flooring-substrate-${portion.nestedItemId}`,
        "Substrate",
        substrate,
        portion.substrate
          ? `${portion.substrate.sheetCount} purchased sheets · ${portion.substrate.sheetCoverageM2} m² coverage`
          : null
      ),
      makeGroup(
        `flooring-framing-${portion.nestedItemId}`,
        "Framing allowance",
        framing,
        "Combined allowance. No fabricated timber or labour split."
      ),
      makeGroup(
        `flooring-removal-${portion.nestedItemId}`,
        "Removal",
        removal,
        "No disposal or cartage."
      ),
      makeGroup(
        `flooring-pr-${portion.nestedItemId}`,
        pricing.some((row) => /information required/i.test(row.label))
          ? "Information Required"
          : "Pricing Required",
        pricing,
        pricing.some((row) => /information required/i.test(row.label))
          ? "Complete the remaining Details before this component can be priced."
          : "Continue to Pricing and add a price."
      ),
    ].filter((row): row is BuilderReviewLineGroup => row != null);

    portionGroups.push({
      id: `flooring-area-${portion.nestedItemId}`,
      label: formatFlooringReviewTitle(portion),
      summary: portion.summary,
      areaLabel:
        portion.physicalNetAreaM2 != null
          ? `${portion.physicalNetAreaM2} m²`
          : null,
      lineGroups,
      assumptions: [],
    });
  }

  for (const [nestedId, children] of byArea) {
    portionGroups.push({
      id: `flooring-area-${nestedId}`,
      label: "Flooring Area",
      summary: null,
      areaLabel: null,
      lineGroups: [
        makeGroup(`flooring-other-${nestedId}`, "Flooring", children),
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

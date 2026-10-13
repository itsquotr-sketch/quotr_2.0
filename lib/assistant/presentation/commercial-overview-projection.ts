/**
 * Shared Commercial Overview projection.
 * Presentation of Builder Review category totals — not a second commercial engine.
 */

import type { BuilderReviewView } from "@/lib/assistant/builder-review/types";
import { parseScopeReview } from "@/lib/estimate/deck-productivity-scope";

export type CommercialOverviewBreakdown = {
  materialsCost: number | null;
  labourCost: number | null;
  labourHours: number | null;
  /** Stored hours held out of the priced total until this job confirms them. */
  heldLabourHours?: number | null;
  allowancesCost: number | null;
  subcontractCost: number | null;
  plantCost: number | null;
  otherCost: number | null;
};

export function projectCommercialOverviewBreakdown(
  view: BuilderReviewView | null
): CommercialOverviewBreakdown | null {
  if (!view) return null;

  const matCat = view.overview.categorySummary.find((c) => c.id === "MATERIALS");
  const labCat = view.overview.categorySummary.find((c) => c.id === "LABOUR");
  const allowCat = view.overview.categorySummary.find((c) => c.id === "ALLOWANCES");
  const subCat = view.overview.categorySummary.find((c) => c.id === "SUBCONTRACT");
  const plantCat = view.overview.categorySummary.find((c) => c.id === "PLANT");
  const otherCat = view.overview.categorySummary.find(
    (c) => c.id === "OTHER_DIRECT_COSTS"
  );
  let labHrs = 0;
  let heldHrs = 0;
  for (const area of view.workAreas) {
    for (const category of area.categories) {
      for (const line of category.lines) {
        const hours = line.labourHours ?? 0;
        if (!(hours > 0)) continue;
        if (parseScopeReview(line.sourceLine.notes)) heldHrs += hours;
        else labHrs += hours;
      }
    }
  }

  return {
    materialsCost: matCat?.cost ?? null,
    labourCost: labCat?.cost ?? null,
    labourHours: labHrs > 0 ? labHrs : null,
    heldLabourHours: heldHrs > 0 ? heldHrs : null,
    allowancesCost: allowCat?.cost ?? null,
    subcontractCost: subCat?.cost ?? null,
    plantCost: plantCat?.cost ?? null,
    otherCost: otherCat?.cost ?? null,
  };
}

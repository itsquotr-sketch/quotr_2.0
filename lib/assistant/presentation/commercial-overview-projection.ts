/**
 * Shared Commercial Overview projection.
 * Presentation of Builder Review category totals — not a second commercial engine.
 */

import type { BuilderReviewView } from "@/lib/assistant/builder-review/types";

export type CommercialOverviewBreakdown = {
  materialsCost: number | null;
  labourCost: number | null;
  labourHours: number | null;
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
  const labHrs = view.workAreas
    .flatMap((wa) =>
      wa.categories.flatMap((cat) => cat.lines.map((l) => l.labourHours ?? 0))
    )
    .reduce((a, b) => a + b, 0);

  return {
    materialsCost: matCat?.cost ?? null,
    labourCost: labCat?.cost ?? null,
    labourHours: labHrs > 0 ? labHrs : null,
    allowancesCost: allowCat?.cost ?? null,
    subcontractCost: subCat?.cost ?? null,
    plantCost: plantCat?.cost ?? null,
    otherCost: otherCat?.cost ?? null,
  };
}

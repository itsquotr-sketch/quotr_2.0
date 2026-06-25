import type { EstimateLineItemInput } from "@/lib/estimate/types";
import { withMaterialBuildUp } from "@/lib/estimate/material-buildup-meta";

const DUPLICATE_MATERIAL_PAIRS: {
  duplicateLabel: string;
  parentLabel: string;
}[] = [
  {
    duplicateLabel: "Decking boards",
    parentLabel: "Decking materials package",
  },
  {
    duplicateLabel: "Backfill materials",
    parentLabel: "Backfill allowance",
  },
];

/**
 * Prevents duplicate priced material rows when a build-up line was added
 * alongside an existing package/allowance line (e.g. deck boards + package).
 */
export function mergeDuplicateMaterialBuildUpLineItems(
  items: EstimateLineItemInput[]
): EstimateLineItemInput[] {
  const result = [...items];

  for (const pair of DUPLICATE_MATERIAL_PAIRS) {
    for (const workAreaId of new Set(result.map((item) => item.workAreaId))) {
      const duplicateIndex = result.findIndex(
        (item) =>
          item.workAreaId === workAreaId && item.label === pair.duplicateLabel
      );
      if (duplicateIndex === -1) {
        continue;
      }

      const parentIndex = result.findIndex(
        (item) =>
          item.workAreaId === workAreaId && item.label === pair.parentLabel
      );
      if (parentIndex === -1) {
        continue;
      }

      const duplicate = result[duplicateIndex];
      const parent = result[parentIndex];

      result[parentIndex] = withMaterialBuildUp(
        parent,
        duplicate.materialBuildUp ?? parent.materialBuildUp
      );

      result.splice(duplicateIndex, 1);
    }
  }

  return result;
}

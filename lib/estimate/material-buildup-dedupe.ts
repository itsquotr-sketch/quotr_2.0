import type { EstimateLineItemInput } from "@/lib/estimate/types";
import { withMaterialBuildUp } from "@/lib/estimate/material-buildup-meta";

const DUPLICATE_MATERIAL_PAIRS: {
  duplicateLabel: string;
  parentLabels: string[];
}[] = [
  {
    duplicateLabel: "Decking boards",
    parentLabels: ["Decking materials", "Decking materials package"],
  },
  {
    duplicateLabel: "Backfill materials",
    parentLabels: ["Backfill allowance"],
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
          item.workAreaId === workAreaId &&
          pair.parentLabels.includes(item.label)
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

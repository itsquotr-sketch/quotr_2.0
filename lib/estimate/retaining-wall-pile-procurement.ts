/**
 * RETAINING-WALL-MATURITY-1D-R1 — H5 SED pile stock procurement.
 *
 * Required theoretical length is not the purchase quantity.
 * Each pile rounds UP to the smallest catalogue stock length that covers it.
 * Never round down. Lengths above the catalogue maximum are Pricing Required.
 *
 * SED/diameter is not inferred from wall height. 150–175 mm is an explicit
 * estimating default, disclosed, not a structural selection.
 */
import { round2 } from "@/lib/estimate/facts";
import type { TimberPileTakeoff } from "@/lib/estimate/retaining-wall-timber";

export const RW_H5_SED_CLASS_DEFAULT = "150-175" as const;
export const RW_H5_SED_CLASS_KIND = "EXPLICIT_ESTIMATING_DEFAULT" as const;
export const RW_H5_SED_CLASS_DISCLOSURE =
  "H5 SED class 150–175 mm is a Quotr estimating default for typical low timber retaining walls. It is not selected from wall height and is not a structural design. Confirm diameter with the builder/supplier.";

/** NZ roundwood H5 lengths commonly offered for retaining poles. Catalogue data, not calculator invention. */
export const RW_H5_SED_STOCK_LENGTHS_M = [1.8, 2.4, 2.7, 3.0, 3.6] as const;

export type RwH5SedStockLengthM = (typeof RW_H5_SED_STOCK_LENGTHS_M)[number];

export function rwH5SedStockItemKey(stockLengthM: RwH5SedStockLengthM): string {
  return `retaining_wall.timber.pile.h5_sed.150_175.${stockLengthM.toFixed(1).replace(".", "_")}m`;
}

/** Quotr starter EA cost EX GST, 2025/26 merchant band, medium-low confidence. Not a supplier quote. */
export const RW_H5_SED_150_175_STOCK_STARTERS: Record<
  RwH5SedStockLengthM,
  { costEachExGst: number; rationale: string }
> = {
  1.8: {
    costEachExGst: 38,
    rationale: "150–175 mm H5 roundwood 1.8 m builder-buy band, ex GST.",
  },
  2.4: {
    costEachExGst: 52,
    rationale: "150–175 mm H5 roundwood 2.4 m builder-buy band, ex GST.",
  },
  2.7: {
    costEachExGst: 60,
    rationale: "150–175 mm H5 roundwood 2.7 m builder-buy band, ex GST.",
  },
  3.0: {
    costEachExGst: 68,
    rationale: "150–175 mm H5 roundwood 3.0 m builder-buy band, ex GST.",
  },
  3.6: {
    costEachExGst: 88,
    rationale: "150–175 mm H5 roundwood 3.6 m builder-buy band, ex GST.",
  },
};

export type RwPileStockSelection =
  | {
      ok: true;
      requiredLengthM: number;
      stockLengthM: RwH5SedStockLengthM;
      itemKey: string;
    }
  | {
      ok: false;
      requiredLengthM: number;
      reason: "exceeds_max_stock" | "invalid_required_length";
    };

export function selectRwH5SedStockLengthM(
  requiredLengthM: number
): RwPileStockSelection {
  if (!(requiredLengthM > 0)) {
    return {
      ok: false,
      requiredLengthM,
      reason: "invalid_required_length",
    };
  }
  const max = RW_H5_SED_STOCK_LENGTHS_M[RW_H5_SED_STOCK_LENGTHS_M.length - 1]!;
  if (requiredLengthM > max + 1e-9) {
    return {
      ok: false,
      requiredLengthM: round2(requiredLengthM),
      reason: "exceeds_max_stock",
    };
  }
  const stockLengthM = RW_H5_SED_STOCK_LENGTHS_M.find(
    (len) => len + 1e-9 >= requiredLengthM
  );
  if (stockLengthM == null) {
    return {
      ok: false,
      requiredLengthM: round2(requiredLengthM),
      reason: "exceeds_max_stock",
    };
  }
  return {
    ok: true,
    requiredLengthM: round2(requiredLengthM),
    stockLengthM,
    itemKey: rwH5SedStockItemKey(stockLengthM),
  };
}

export type RwPilePurchaseRow = {
  index: number;
  positionM: number;
  retainedHeightM: number;
  requiredLengthM: number;
  stockLengthM: RwH5SedStockLengthM | null;
  sedIdentity: string;
  ea: 1;
  itemKey: string | null;
  unitCost: number | null;
  cost: number | null;
  status: "STOCK" | "PRICING_REQUIRED";
};

export type RwPileProcurement = {
  sedClass: typeof RW_H5_SED_CLASS_DEFAULT;
  sedClassKind: typeof RW_H5_SED_CLASS_KIND;
  theoreticalTotalLm: number;
  purchaseTotalLm: number;
  purchaseEa: number;
  oversizeCount: number;
  rows: RwPilePurchaseRow[];
  byStock: {
    stockLengthM: RwH5SedStockLengthM;
    itemKey: string;
    ea: number;
    unitCost: number;
    cost: number;
  }[];
};

export function procureTimberPiles(
  piles: TimberPileTakeoff
): RwPileProcurement {
  const rows: RwPilePurchaseRow[] = piles.lengthsM.map((requiredLengthM, index) => {
    const selected = selectRwH5SedStockLengthM(requiredLengthM);
    const retainedHeightM = piles.retainedHeightsM[index] ?? 0;
    const positionM = piles.positionsM[index] ?? 0;
    if (!selected.ok) {
      return {
        index,
        positionM: round2(positionM),
        retainedHeightM: round2(retainedHeightM),
        requiredLengthM: round2(requiredLengthM),
        stockLengthM: null,
        sedIdentity: `H5 SED ${RW_H5_SED_CLASS_DEFAULT} mm — stock length Pricing Required`,
        ea: 1,
        itemKey: null,
        unitCost: null,
        cost: null,
        status: "PRICING_REQUIRED",
      };
    }
    const unitCost =
      RW_H5_SED_150_175_STOCK_STARTERS[selected.stockLengthM].costEachExGst;
    return {
      index,
      positionM: round2(positionM),
      retainedHeightM: round2(retainedHeightM),
      requiredLengthM: selected.requiredLengthM,
      stockLengthM: selected.stockLengthM,
      sedIdentity: `H5 SED ${RW_H5_SED_CLASS_DEFAULT} mm × ${selected.stockLengthM} m stock`,
      ea: 1,
      itemKey: selected.itemKey,
      unitCost,
      cost: unitCost,
      status: "STOCK",
    };
  });

  const groups = new Map<
    RwH5SedStockLengthM,
    { itemKey: string; ea: number; unitCost: number }
  >();
  for (const row of rows) {
    if (row.status !== "STOCK" || row.stockLengthM == null || row.itemKey == null) {
      continue;
    }
    const existing = groups.get(row.stockLengthM);
    if (existing) {
      existing.ea += 1;
    } else {
      groups.set(row.stockLengthM, {
        itemKey: row.itemKey,
        ea: 1,
        unitCost: row.unitCost ?? 0,
      });
    }
  }

  const byStock = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([stockLengthM, group]) => ({
      stockLengthM,
      itemKey: group.itemKey,
      ea: group.ea,
      unitCost: group.unitCost,
      cost: round2(group.ea * group.unitCost),
    }));

  const purchaseTotalLm = round2(
    byStock.reduce((sum, group) => sum + group.ea * group.stockLengthM, 0)
  );

  return {
    sedClass: RW_H5_SED_CLASS_DEFAULT,
    sedClassKind: RW_H5_SED_CLASS_KIND,
    theoreticalTotalLm: piles.totalLengthM,
    purchaseTotalLm,
    purchaseEa: rows.filter((row) => row.status === "STOCK").length,
    oversizeCount: rows.filter((row) => row.status === "PRICING_REQUIRED").length,
    rows,
    byStock,
  };
}

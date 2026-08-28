/**
 * FENCE-MATURITY-1B-R1 — H4 100×100 fence-post stock-length procurement.
 *
 * Physical required length (height + embedment) is not the purchase quantity.
 * Purchase is the smallest available stock length that covers each post.
 * Not a supplier catalogue, not embedment design, not an availability check.
 */

import { round2 } from "@/lib/estimate/facts";
import type { OrganisationRate } from "@/components/setup/types";
import { fencePostMaterialKey } from "@/lib/estimate/fence-identities";

/**
 * LOW-CONFIDENCE Quotr NZ merchant ladder for treated H4 100×100 fence posts.
 *
 * Provenance: no Fence-specific stock metadata existed on the H4 100×100
 * identity (priced $/lm only). Not reused from Deck house-pile (includes
 * 0.6–1.5 m lengths that are not fence-post stock) and not reused from
 * RW H5 SED (1.8 / 2.4 / 2.7 / 3.0 / 3.6, missing 2.1 m, different product).
 */
export const FENCE_POST_STOCK_LENGTHS_M = [
  1.8, 2.1, 2.4, 2.7, 3.0, 3.6,
] as const;

export const FENCE_POST_STOCK_LADDER_PROVENANCE =
  "LOW-CONFIDENCE Quotr estimating ladder for H4 100×100 fence posts: 1.8 / 2.1 / 2.4 / 2.7 / 3.0 / 3.6 m. Company stock-length SKUs override the ladder. Not H5 SED or house-pile stock.";

export const FENCE_POST_PROCUREMENT_DECISION_R1 =
  "PRICE_SMALLEST_STOCK_LENGTH_COVERING_REQUIRED_LENGTH";

export const FENCE_POST_STOCK_SKU_KEY_PATTERN =
  /^fence\.timber\.post\.100x100\.h4\.(\d+)_(\d+)m$/;

export type FencePostProcurement =
  | {
      ok: true;
      requiredLengthEachM: number;
      requiredTotalLm: number;
      purchaseLengthEachM: number;
      purchaseLm: number;
      postCount: number;
      source: "quotr_ladder" | "company_ladder" | "selected";
    }
  | {
      ok: false;
      requiredLengthEachM: number;
      requiredTotalLm: number;
      postCount: number;
      reason: "exceeds_max_stock" | "invalid_required_length" | "selected_too_short";
    };

export function parseFencePostStockSkuLengthM(itemKey: string): number | null {
  const match = itemKey.match(FENCE_POST_STOCK_SKU_KEY_PATTERN);
  if (!match) return null;
  const length = Number(`${match[1]}.${match[2]}`);
  return Number.isFinite(length) && length > 0 ? length : null;
}

export function fencePostStockSkuKey(stockLengthM: number): string {
  return `${fencePostMaterialKey()}.${stockLengthM.toFixed(1).replace(".", "_")}m`;
}

export function companyFencePostStockLengthsM(
  rates: readonly OrganisationRate[] | undefined
): number[] {
  if (!rates?.length) return [];
  const lengths = new Set<number>();
  for (const rate of rates) {
    if (!rate.active) continue;
    const length = parseFencePostStockSkuLengthM(rate.item_key);
    if (length != null) lengths.add(length);
  }
  return [...lengths].sort((a, b) => a - b);
}

export function selectFencePostStockLengthM(params: {
  requiredLengthEachM: number;
  selectedStockLengthM?: number | null;
  availableStockLengthsM?: readonly number[];
}): {
  lengthM: number | null;
  source: "quotr_ladder" | "company_ladder" | "selected";
  reason?: "exceeds_max_stock" | "invalid_required_length" | "selected_too_short";
} {
  const required = params.requiredLengthEachM;
  if (!(required > 0)) {
    return { lengthM: null, source: "quotr_ladder", reason: "invalid_required_length" };
  }

  const selected = params.selectedStockLengthM;
  if (selected != null && selected > 0) {
    if (selected + 1e-9 >= required) {
      return { lengthM: selected, source: "selected" };
    }
    return { lengthM: null, source: "selected", reason: "selected_too_short" };
  }

  const ladder =
    params.availableStockLengthsM && params.availableStockLengthsM.length > 0
      ? params.availableStockLengthsM
      : FENCE_POST_STOCK_LENGTHS_M;
  const source =
    params.availableStockLengthsM && params.availableStockLengthsM.length > 0
      ? "company_ladder"
      : "quotr_ladder";
  const max = ladder[ladder.length - 1];
  if (max == null || required > max + 1e-9) {
    return { lengthM: null, source, reason: "exceeds_max_stock" };
  }
  const lengthM = ladder.find((len) => len + 1e-9 >= required) ?? null;
  return { lengthM, source };
}

export function procureFencePosts(params: {
  requiredLengthEachM: number;
  postCount: number;
  selectedStockLengthM?: number | null;
  availableStockLengthsM?: readonly number[];
}): FencePostProcurement {
  const requiredTotalLm = round2(params.postCount * params.requiredLengthEachM);
  if (!(params.requiredLengthEachM > 0) || params.postCount <= 0) {
    return {
      ok: false,
      requiredLengthEachM: params.requiredLengthEachM,
      requiredTotalLm,
      postCount: params.postCount,
      reason: "invalid_required_length",
    };
  }
  const selected = selectFencePostStockLengthM({
    requiredLengthEachM: params.requiredLengthEachM,
    selectedStockLengthM: params.selectedStockLengthM,
    availableStockLengthsM: params.availableStockLengthsM,
  });
  if (selected.lengthM == null) {
    return {
      ok: false,
      requiredLengthEachM: round2(params.requiredLengthEachM),
      requiredTotalLm,
      postCount: params.postCount,
      reason: selected.reason ?? "exceeds_max_stock",
    };
  }
  return {
    ok: true,
    requiredLengthEachM: round2(params.requiredLengthEachM),
    requiredTotalLm,
    purchaseLengthEachM: selected.lengthM,
    purchaseLm: round2(params.postCount * selected.lengthM),
    postCount: params.postCount,
    source: selected.source,
  };
}

export function fencePostOversizeAttention(requiredLengthEachM: number): string {
  const max = FENCE_POST_STOCK_LENGTHS_M[FENCE_POST_STOCK_LENGTHS_M.length - 1];
  return `Required post length ${round2(requiredLengthEachM)} m exceeds the largest Quotr H4 100×100 stock length (${max} m). Pricing Required — length was not clamped.`;
}

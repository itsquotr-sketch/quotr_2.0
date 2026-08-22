/**
 * DECK-MATURITY-2B-R1 — H5 house-pile stock-length procurement.
 * Physical required length is not the purchase quantity.
 * Estimating only — not embedment design or a stock-availability check.
 */
import { round2 } from "@/lib/estimate/facts";

export const DECK_HOUSE_PILE_STOCK_LENGTHS_M = [
  0.6, 0.75, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.6,
] as const;

export type DeckPileProcurement =
  | {
      ok: true;
      requiredLengthEachM: number;
      requiredTotalLm: number;
      purchaseLengthEachM: number;
      purchaseLm: number;
      supportCount: number;
    }
  | {
      ok: false;
      requiredLengthEachM: number;
      requiredTotalLm: number;
      supportCount: number;
      reason: "exceeds_max_stock" | "invalid_required_length";
    };

export function selectHousePileStockLengthM(
  requiredLengthEachM: number
): number | null {
  if (!(requiredLengthEachM > 0)) return null;
  const max = DECK_HOUSE_PILE_STOCK_LENGTHS_M[DECK_HOUSE_PILE_STOCK_LENGTHS_M.length - 1]!;
  if (requiredLengthEachM > max) return null;
  return (
    DECK_HOUSE_PILE_STOCK_LENGTHS_M.find((len) => len + 1e-9 >= requiredLengthEachM) ??
    null
  );
}

export function procureHousePiles(params: {
  requiredLengthEachM: number;
  supportCount: number;
}): DeckPileProcurement {
  const requiredTotalLm = round2(
    params.supportCount * params.requiredLengthEachM
  );
  if (!(params.requiredLengthEachM > 0) || params.supportCount <= 0) {
    return {
      ok: false,
      requiredLengthEachM: params.requiredLengthEachM,
      requiredTotalLm,
      supportCount: params.supportCount,
      reason: "invalid_required_length",
    };
  }
  const purchaseLengthEachM = selectHousePileStockLengthM(
    params.requiredLengthEachM
  );
  if (purchaseLengthEachM == null) {
    return {
      ok: false,
      requiredLengthEachM: params.requiredLengthEachM,
      requiredTotalLm,
      supportCount: params.supportCount,
      reason: "exceeds_max_stock",
    };
  }
  return {
    ok: true,
    requiredLengthEachM: round2(params.requiredLengthEachM),
    requiredTotalLm,
    purchaseLengthEachM,
    purchaseLm: round2(params.supportCount * purchaseLengthEachM),
    supportCount: params.supportCount,
  };
}

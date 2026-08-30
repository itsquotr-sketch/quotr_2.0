/**
 * DECK-R7 — quantity-driven Deck labour productivities.
 *
 * PHYSICAL QUANTITY × PRODUCTIVITY = BASE HOURS
 * BASE HOURS × PROJECT CONDITION ADJUSTMENT ONCE = FINAL HOURS
 *
 * Legacy company hours/m² must not be reinterpreted as hours/lm.
 */

import { round2, round3 } from "@/lib/estimate/facts";
import {
  isTrustedProductivityHours,
  resolveProductivity,
} from "@/lib/estimate/productivity";
import type { OrganisationRate } from "@/components/setup/types";
import type { ProductivityRate } from "@/lib/estimate/types";

export const DECK_DECKING_INSTALL_HOURS_PER_LM_KEY =
  "deck.decking.install.hours_per_lm";
export const DECK_DECKING_INSTALL_HOURS_PER_M2_LEGACY_KEY =
  "deck.decking.install.hours_per_m2";

/** Historical area productivity used to derive the lm starter. */
export const DECK_DECKING_LEGACY_HOURS_PER_M2 = 0.55;
/** Screenshot / 140mm board coverage used for the dimensional conversion. */
export const DECK_DECKING_REFERENCE_BOARD_WIDTH_M = 0.14;
/**
 * 0.55 h/m² × 0.14 m² per board-lm = 0.077 h/installed decking lm.
 * Waste is procurement, not labour.
 */
export const DECK_DECKING_INSTALL_HOURS_PER_LM = round3(
  DECK_DECKING_LEGACY_HOURS_PER_M2 * DECK_DECKING_REFERENCE_BOARD_WIDTH_M
);

export const DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY =
  "deck.substructure.install.hours_per_framing_lm";
export const DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_M2_LEGACY_KEY =
  "deck.substructure.install.hours_per_m2";

export const DECK_SUBSTRUCTURE_LEGACY_HOURS_PER_M2 = 0.52;
/** OWNER-KWILA-01 / REAL-JOB 3×9 golden used for the dimensional conversion. */
export const DECK_SUBSTRUCTURE_REFERENCE_AREA_M2 = 27;
/**
 * Required installed joist + bearer + rim lm on OWNER-KWILA-01
 * (3 m × 9 m, 450 mm centres): 63 + 27 + 18 = 108 lm.
 */
export const DECK_SUBSTRUCTURE_REFERENCE_FRAMING_LM = 108;
/**
 * 0.52 h/m² × 27 m² / 108 framing-lm = 0.13 h/required framing lm.
 * LOW-CONFIDENCE starter converted from the area benchmark — not tuned to sell.
 */
export const DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM = round3(
  (DECK_SUBSTRUCTURE_LEGACY_HOURS_PER_M2 *
    DECK_SUBSTRUCTURE_REFERENCE_AREA_M2) /
    DECK_SUBSTRUCTURE_REFERENCE_FRAMING_LM
);
export const DECK_SUBSTRUCTURE_STARTER_CONFIDENCE = "LOW_CONFIDENCE" as const;

export const DECK_SKIRTING_INSTALL_HOURS_PER_LM_KEY =
  "deck.skirting.install.hours_per_lm";
export const DECK_SKIRTING_INSTALL_HOURS_PER_LM = 0.45;

export const DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY =
  "deck.fascia.install.hours_per_lm";

/**
 * Future split: joist / bearer / rim hours_per_lm can be introduced without
 * changing physical quantities. Combined framing-lm is the MVP driver.
 */
export const DECK_SUBSTRUCTURE_FUTURE_SPLIT_KEYS = [
  "deck.joists.install.hours_per_lm",
  "deck.bearers.install.hours_per_lm",
  "deck.rim.install.hours_per_lm",
] as const;

export function requiredInstalledFramingLm(params: {
  joistRequiredLm: number;
  bearerRequiredLm: number;
  rimRequiredLm: number;
}): number {
  return round2(
    params.joistRequiredLm + params.bearerRequiredLm + params.rimRequiredLm
  );
}

export function resolveDeckDeckingInstallProductivity(
  rates: readonly OrganisationRate[] | undefined
): ProductivityRate {
  return resolveProductivity({
    productivityKey: DECK_DECKING_INSTALL_HOURS_PER_LM_KEY,
    unit: "lm",
    fallbackHoursPerUnit: DECK_DECKING_INSTALL_HOURS_PER_LM,
    rates,
  });
}

export function resolveDeckSubstructureInstallProductivity(
  rates: readonly OrganisationRate[] | undefined
): ProductivityRate {
  return resolveProductivity({
    productivityKey: DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
    unit: "lm",
    fallbackHoursPerUnit: DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM,
    rates,
  });
}

export function resolveDeckSkirtingInstallProductivity(
  rates: readonly OrganisationRate[] | undefined
): ProductivityRate {
  return resolveProductivity({
    productivityKey: DECK_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
    unit: "lm",
    fallbackHoursPerUnit: DECK_SKIRTING_INSTALL_HOURS_PER_LM,
    rates,
  });
}

export function hasIncompatibleLegacyDeckingM2Rate(
  rates: readonly OrganisationRate[] | undefined
): boolean {
  if (!rates?.length) return false;
  return rates.some(
    (rate) =>
      rate.active &&
      rate.rate_type === "productivity" &&
      rate.item_key === DECK_DECKING_INSTALL_HOURS_PER_M2_LEGACY_KEY &&
      rate.cost_rate != null
  );
}

export function hasIncompatibleLegacySubstructureM2Rate(
  rates: readonly OrganisationRate[] | undefined
): boolean {
  if (!rates?.length) return false;
  return rates.some(
    (rate) =>
      rate.active &&
      rate.rate_type === "productivity" &&
      rate.item_key === DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_M2_LEGACY_KEY &&
      rate.cost_rate != null
  );
}

export function deckQuantityLabourReady(params: {
  decking: ProductivityRate;
  substructure: ProductivityRate;
  posts: ProductivityRate;
  substructureIncluded: boolean;
  supportCount: number;
}): boolean {
  const framingReady =
    !params.substructureIncluded ||
    (isTrustedProductivityHours(params.substructure.hoursPerUnit) &&
      isTrustedProductivityHours(params.posts.hoursPerUnit) &&
      (!params.substructureIncluded || params.supportCount > 0));
  return (
    isTrustedProductivityHours(params.decking.hoursPerUnit) && framingReady
  );
}

/**
 * FENCE-MATURITY-1C — modular (metal slat / plastic composite) commercial constants.
 * Physical geometry stays in fence-modular.ts / fence-geometry.ts.
 * This file owns product identity, starters, dimension ownership, and fixings.
 *
 * Do not reopen Timber Fence or Deck.
 */

import type { OrganisationRate } from "@/components/setup/types";
import { getBooleanFact, getNumberFact, getStringFact } from "@/lib/estimate/facts";
import {
  FENCE_FIXINGS_MODULAR_KEY,
  FENCE_POST_ALUMINIUM_KEY,
  FENCE_POST_PLASTIC_KEY,
  FENCE_POST_STEEL_KEY,
  FENCE_PREMIX_20KG_KEY,
  FENCE_SECTION_ALUMINIUM_FAMILY_KEY,
  FENCE_SECTION_PLASTIC_FAMILY_KEY,
  FENCE_SECTION_STEEL_FAMILY_KEY,
  fenceSectionFamilyKey,
  fenceSectionSkuKey,
  parseFenceSectionProductKey,
} from "@/lib/estimate/fence-identities";
import { FENCE_PRODUCTIVITY_KEYS } from "@/lib/estimate/fence-productivity";
import type { FenceMetalMaterial, FenceSystem } from "@/lib/estimate/fence-systems";
import type { EstimateFact } from "@/lib/estimate/types";

export const FENCE_MODULAR_1C_AUTHORITY = "DETAILED_COMPONENT_AUTHORITY" as const;
export const FENCE_MODULAR_1C_PACKAGE = "LEGACY_PACKAGE_AUTHORITY" as const;

export const FENCE_SECTION_PRODUCT_KEY_FACT = "fence.section_product_key";
export const FENCE_MODULAR_FIXINGS_INCLUDED_FACT = "fence.modular_fixings_included";
export const FENCE_MODULAR_GATE_REQUESTED_FACT = "fence.modular_gate_requested";

export const FENCE_MODULAR_GATES_MODELLED = false;

/** Timber leftover `fence.gate_included` is NOT this state. */
export type ModularGateApplicability =
  | "SUPPORTED"
  | "UNSUPPORTED_REQUESTED"
  | "NOT_REQUESTED";

export const FENCE_MODULAR_GATE_PRICING_REQUIRED =
  "Modular fence gate — pricing required";
export const FENCE_MODULAR_GATE_PRICING_DETAIL =
  "Modular fence gate — pricing required. Select/price a compatible manufactured gate.";

export const FENCE_MODULAR_POST_PROCUREMENT_UNIT = "ea" as const;
export const FENCE_MODULAR_POST_PROCUREMENT_DECISION =
  "PRICE_EA_MANUFACTURED_POST — not timber H4 stock-lm and not retaining-wall H-post.";

export const FENCE_MODULAR_SECTION_LABOUR_OWNERSHIP =
  "Section installation labour-h/section owns positioning, alignment, normal brackets/fixings handling, and the ordinary one-residual cut. Installed bay count is the driver (full + residual bay). Residual cut is not a second labour line.";

export const FENCE_MODULAR_POST_LABOUR_REUSE =
  "Modular post installation reuses fence.post.install.hours_per_post (0.70). Same physical ownership as Timber: set-out, ordinary hole, set/plumb/brace, normal handling. Not a second Timber-specific key.";

export const FENCE_MODULAR_FIXINGS_DEFAULT_OWNERSHIP =
  "SEPARATE_FIXINGS_REQUIREMENT" as const;

export const FENCE_MODULAR_GENERIC_DISCLOSURE =
  "Quotr generic modular section and post rates are LOW-CONFIDENCE generic benchmarks, not supplier SKUs. Company exact product outranks.";

export const FENCE_MODULAR_HEIGHT_INCOMPATIBLE =
  "Selected panel height does not match the fence height. Manufactured sections are not stretched or cropped. Product confirmation / Pricing Required.";

export type FenceModular1CStarter = {
  costPerUnit: number;
  unit: string;
  identity: string;
  confidence: "low";
  basis: string;
  label: string;
};

/** LOW-CONFIDENCE Quotr generic benchmarks. Not supplier SKUs. Not fixture-tuned. */
export const FENCE_MODULAR_1C_MATERIAL_STARTERS: Record<string, FenceModular1CStarter> = {
  [FENCE_SECTION_ALUMINIUM_FAMILY_KEY]: {
    costPerUnit: 220,
    unit: "ea",
    identity: "Aluminium slat fence section",
    confidence: "low",
    label: "Aluminium slat fence section",
    basis:
      "LOW-CONFIDENCE Quotr generic benchmark $/EA manufactured aluminium slat section (nominal 1.8 m module). Not a supplier SKU. Company exact product/SKU outranks.",
  },
  [FENCE_SECTION_STEEL_FAMILY_KEY]: {
    costPerUnit: 190,
    unit: "ea",
    identity: "Steel slat fence section",
    confidence: "low",
    label: "Steel slat fence section",
    basis:
      "LOW-CONFIDENCE Quotr generic benchmark $/EA manufactured steel slat section (nominal 1.8 m module). Not a supplier SKU. Distinct from aluminium.",
  },
  [FENCE_SECTION_PLASTIC_FAMILY_KEY]: {
    costPerUnit: 160,
    unit: "ea",
    identity: "Plastic / composite fence section",
    confidence: "low",
    label: "Plastic / composite fence section",
    basis:
      "LOW-CONFIDENCE Quotr generic benchmark $/EA manufactured plastic/composite section (nominal 1.8 m module). Not a supplier SKU. Distinct from metal slat.",
  },
  [FENCE_POST_ALUMINIUM_KEY]: {
    costPerUnit: 45,
    unit: "ea",
    identity: "Aluminium modular fence post",
    confidence: "low",
    label: "Aluminium modular fence post",
    basis:
      "LOW-CONFIDENCE Quotr generic benchmark $/EA manufactured aluminium modular post. Not Timber H4 100×100 and not retaining-wall H-post.",
  },
  [FENCE_POST_STEEL_KEY]: {
    costPerUnit: 38,
    unit: "ea",
    identity: "Steel modular fence post",
    confidence: "low",
    label: "Steel modular fence post",
    basis:
      "LOW-CONFIDENCE Quotr generic benchmark $/EA manufactured steel modular post. Distinct from aluminium modular post.",
  },
  [FENCE_POST_PLASTIC_KEY]: {
    costPerUnit: 32,
    unit: "ea",
    identity: "Plastic / composite modular fence post",
    confidence: "low",
    label: "Plastic / composite modular fence post",
    basis:
      "LOW-CONFIDENCE Quotr generic benchmark $/EA matched plastic/composite post. Not a metal post.",
  },
  [FENCE_FIXINGS_MODULAR_KEY]: {
    costPerUnit: 18,
    unit: "section",
    identity: "Modular fence brackets and fixings",
    confidence: "low",
    label: "Modular fence brackets & fixings",
    basis:
      "LOW-CONFIDENCE Quotr generic $/installed-section brackets/fixings allowance. Used when the section product does not include fixings. Not Timber 8% of board/rail/capping cost.",
  },
};

export const FENCE_MODULAR_1C_PRODUCTIVITY_STARTERS: Record<
  string,
  { hoursPerUnit: number; unit: string; label: string; basis: string }
> = {
  [FENCE_PRODUCTIVITY_KEYS.sectionInstall]: {
    hoursPerUnit: 0.35,
    unit: "section",
    label: "Modular fence section installation",
    basis:
      "LOW-CONFIDENCE. 0.35 labour-h per installed section/bay including ordinary one-residual cut. Shared Metal and Plastic/composite — installation effort is not materially split for MVP. Not purchased waste quantity.",
  },
};

export function modular1CMaterialStarter(
  itemKey: string | null | undefined
): { costPerUnit: number; unit: string } | null {
  if (!itemKey) return null;
  const exact = FENCE_MODULAR_1C_MATERIAL_STARTERS[itemKey];
  if (exact && exact.costPerUnit > 0) {
    return { costPerUnit: exact.costPerUnit, unit: exact.unit };
  }
  const parsed = parseFenceSectionProductKey(itemKey);
  if (parsed && parsed.familyKey !== itemKey) {
    const family = FENCE_MODULAR_1C_MATERIAL_STARTERS[parsed.familyKey];
    if (family && family.costPerUnit > 0) {
      return { costPerUnit: family.costPerUnit, unit: family.unit };
    }
  }
  return null;
}

export function modular1CProductivityStarter(
  productivityKey: string
): { hoursPerUnit: number; unit: string } | null {
  const row = FENCE_MODULAR_1C_PRODUCTIVITY_STARTERS[productivityKey];
  return row ? { hoursPerUnit: row.hoursPerUnit, unit: row.unit } : null;
}

export function modularSectionMaterialKeys(params: {
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">;
  material: string;
  sectionWidthM: number;
  sectionHeightM: number | null;
}): { familyKey: string; skuKey: string } {
  const familyKey = fenceSectionFamilyKey(params.system, params.material);
  return {
    familyKey,
    skuKey: fenceSectionSkuKey(
      params.system,
      params.material,
      params.sectionWidthM,
      params.sectionHeightM
    ),
  };
}

export function modularInstalledSectionCount(params: {
  fullSectionCount: number;
  residualWidthM: number;
}): number {
  return params.fullSectionCount + (params.residualWidthM > 0 ? 1 : 0);
}

export type ModularSectionSelection = {
  sectionWidthM: number | null;
  sectionHeightM: number | null;
  familyKey: string;
  skuKey: string | null;
  productDriven: boolean;
  selectedItemKey: string | null;
  assumptions: string[];
  attention: string[];
};

export function resolveModularSectionSelection(params: {
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">;
  metalMaterial: FenceMetalMaterial | null;
  fenceHeightM: number;
  facts: EstimateFact[];
  workAreaId: string;
  /** Rate catalogues must not drive section width/height. Kept for call-site compatibility. */
  rates: readonly OrganisationRate[];
}): ModularSectionSelection {
  void params.rates;
  const assumptions: string[] = [];
  const attention: string[] = [];
  const material =
    params.system === "PLASTIC_MODULAR"
      ? "plastic_composite"
      : params.metalMaterial ?? "aluminium";
  const familyKey = fenceSectionFamilyKey(params.system, material);
  const widthFact = getNumberFact(
    params.facts,
    params.workAreaId,
    "fence.section_width_m"
  );
  const heightFact = getNumberFact(
    params.facts,
    params.workAreaId,
    "fence.section_height_m"
  );
  const selectedKey = getStringFact(
    params.facts,
    params.workAreaId,
    FENCE_SECTION_PRODUCT_KEY_FACT
  );

  let parsed =
    selectedKey != null ? parseFenceSectionProductKey(selectedKey) : null;
  if (parsed && parsed.familyKey !== familyKey) {
    attention.push(
      "Selected section product does not match the active modular fence system."
    );
    parsed = null;
  }
  const explicitlySelected =
    selectedKey != null && parsed?.widthM != null && parsed.widthM > 0;

  if (explicitlySelected && parsed?.widthM != null && parsed.widthM > 0) {
    const productWidth = parsed.widthM;
    const productHeight = parsed.heightM;
    if (
      widthFact != null &&
      Math.abs(widthFact - productWidth) > 0.01
    ) {
      attention.push(
        `Section width recalculated to match the selected section product (${productWidth} m). Physical geometry and commercial product must stay aligned.`
      );
    }
    return {
      sectionWidthM: productWidth,
      sectionHeightM: productHeight,
      familyKey,
      skuKey: parsed.skuKey,
      productDriven: true,
      selectedItemKey: parsed.skuKey,
      assumptions,
      attention,
    };
  }

  const fallbackHeight = heightFact != null && heightFact > 0 ? heightFact : null;
  const widthForSku =
    widthFact != null && widthFact > 0 ? widthFact : 1.8;
  const heightForSku = fallbackHeight ?? params.fenceHeightM;
  return {
    sectionWidthM: widthFact != null && widthFact > 0 ? widthFact : null,
    sectionHeightM: fallbackHeight,
    familyKey,
    skuKey: fenceSectionSkuKey(
      params.system,
      material,
      widthForSku,
      heightForSku
    ),
    productDriven: false,
    selectedItemKey: null,
    assumptions,
    attention,
  };
}

export function modularFixingsIncluded(
  facts: EstimateFact[],
  workAreaId: string
): boolean {
  return getBooleanFact(facts, workAreaId, FENCE_MODULAR_FIXINGS_INCLUDED_FACT) === true;
}

export function modularGateApplicability(
  system: string,
  facts: EstimateFact[],
  workAreaId: string
): ModularGateApplicability {
  if (system !== "METAL_SLAT_MODULAR" && system !== "PLASTIC_MODULAR") {
    return "NOT_REQUESTED";
  }
  if (FENCE_MODULAR_GATES_MODELLED) return "SUPPORTED";
  if (getBooleanFact(facts, workAreaId, FENCE_MODULAR_GATE_REQUESTED_FACT) === true) {
    return "UNSUPPORTED_REQUESTED";
  }
  return "NOT_REQUESTED";
}

export function modularGateRequestedCount(
  facts: EstimateFact[],
  workAreaId: string
): number {
  const count = getNumberFact(facts, workAreaId, "fence.gate_count");
  return count != null && count > 0 ? count : 1;
}

export const FENCE_MODULAR_1C_PACKAGE_NOTE =
  "Physical model is detailed. Package remains money until modular commercial coverage is complete.";

export const FENCE_MODULAR_CONCRETE_MATERIAL_KEY = FENCE_PREMIX_20KG_KEY;

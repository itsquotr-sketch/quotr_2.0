/**
 * DECK-MATURITY-2B — scope-component commercial authority.
 *
 * One commercial source per work intent. Structural children only replace
 * deck.substructure.m2 when every required child can price from a trusted rate,
 * including pile procurement quantity. Labour lump remains until starter or
 * company productivities exist for decking, framing, and posts.
 */
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { resolveStructuralMaterialRequirementRate } from "@/lib/estimate/resolve-structural-material-rate";
import type { MaterialIdentity } from "@/lib/materials/identity";

export const DECK_FIXINGS_RESIDUAL_CLASS = "RESIDUAL_STARTER_BENCHMARK" as const;

/** Builder-facing residual line. Not an internal calibration term. */
export const DECK_FIXINGS_RESIDUAL_LABEL = "Fixings, connectors & sundries";

export const DECK_FIXINGS_RESIDUAL_ITEM_KEY = "deck.fixings.m2";

/**
 * Residual starter $/m² covers supporting items that are not already explicit
 * timber/board lines. Historical v1 pair $25/$40 is retained as the starter
 * benchmark — not a surveyed kit takeoff.
 */
export const DECK_FIXINGS_RESIDUAL_INCLUDES = [
  "DECKING_FIXINGS",
  "STRUCTURAL_CONNECTORS",
  "MOISTURE_SEPARATION",
  "MINOR_FRAMING",
  "CONSUMABLES",
  "SMALL_SUNDRIES",
] as const;

export const DECK_FIXINGS_RESIDUAL_EXCLUDES = [
  "DECK_BOARDS",
  "JOIST_TIMBER",
  "BEARER_TIMBER",
  "RIM_TIMBER",
  "PILE_POST_TIMBER",
  "FASCIA_BOARDS",
  "STEP_BOARDS",
  "STEP_FRAMING",
  "CONCRETE",
  "DELIVERY_FREIGHT",
] as const;

export const DECK_FIXINGS_DELIVERY_TREATMENT =
  "FUTURE_COMMERCIAL_GAP" as const;

export const DECK_FIXINGS_CONCRETE_TREATMENT =
  "NOT_IN_RESIDUAL_PLANNING_OR_PACKAGE" as const;

export type DeckCommercialMode =
  | "DETAILED_AUTHORITATIVE"
  | "PACKAGE_FALLBACK"
  | "PRICING_REQUIRED"
  | "NON_COMMERCIAL_PLANNING";

export type DeckComponentReadiness =
  | "PROMOTED"
  | "READY_BUT_RATE_MISSING"
  | "NOT_READY"
  | "NEEDS_OWNER_BENCHMARK";

export type DeckScopeAuthorityRow = {
  intent: string;
  oldAuthority: string;
  newAuthority: DeckCommercialMode;
  readiness: DeckComponentReadiness;
  reason: string;
};

export function structuralChildCanPrice(params: {
  identity: MaterialIdentity | null;
  unit: "lm" | "ea" | "m3";
  purchaseQuantity: number;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): boolean {
  if (!params.identity || !(params.purchaseQuantity > 0)) return false;
  return resolveStructuralMaterialRequirementRate({
    identity: params.identity,
    unit: params.unit,
    purchaseQuantity: params.purchaseQuantity,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  }).priced;
}

export function decideDeckSubstructureAuthority(params: {
  substructureIncluded: boolean;
  joistsPriced: boolean;
  bearersPriced: boolean;
  rimPriced: boolean;
  postsPriced: boolean;
}): {
  mode: DeckCommercialMode;
  readiness: DeckComponentReadiness;
  reason: string;
} {
  if (!params.substructureIncluded) {
    return {
      mode: "NON_COMMERCIAL_PLANNING",
      readiness: "NOT_READY",
      reason: "New substructure excluded.",
    };
  }
  if (
    params.joistsPriced &&
    params.bearersPriced &&
    params.rimPriced &&
    params.postsPriced
  ) {
    return {
      mode: "DETAILED_AUTHORITATIVE",
      readiness: "PROMOTED",
      reason:
        "Joists, bearers, rim and posts all have trusted rates. Package not summed.",
    };
  }
  const missing: string[] = [];
  if (!params.joistsPriced) missing.push("joists");
  if (!params.bearersPriced) missing.push("bearers");
  if (!params.rimPriced) missing.push("rim");
  if (!params.postsPriced) missing.push("posts");
  return {
    mode: "PACKAGE_FALLBACK",
    readiness: "READY_BUT_RATE_MISSING",
    reason: `Substructure package remains money authority until trusted rates exist for: ${missing.join(", ")}.`,
  };
}

export function decideDeckLabourSplit(params: {
  hasTrustedDeckingProductivity: boolean;
  hasTrustedSubstructureProductivity: boolean;
  hasTrustedPostProductivity: boolean;
  substructureIncluded: boolean;
}): {
  mode: DeckCommercialMode;
  readiness: DeckComponentReadiness;
  reason: string;
} {
  const framingReady =
    !params.substructureIncluded ||
    (params.hasTrustedSubstructureProductivity &&
      params.hasTrustedPostProductivity);
  if (params.hasTrustedDeckingProductivity && framingReady) {
    return {
      mode: "DETAILED_AUTHORITATIVE",
      readiness: "PROMOTED",
      reason:
        "Decking, substructure, and pile/post productivities replace lumped Deck labour.",
    };
  }
  return {
    mode: "PACKAGE_FALLBACK",
    readiness: "NEEDS_OWNER_BENCHMARK",
    reason:
      "Lumped Deck labour remains commercial authority until trusted productivities exist for decking, framing, and posts. Missing or zero hours do not create a labour hole.",
  };
}

export function deckScopeAuthorityMatrix(params: {
  substructureMode: DeckCommercialMode;
  labourMode: DeckCommercialMode;
  fasciaDetailed: boolean;
  stepsDetailed: boolean;
}): readonly DeckScopeAuthorityRow[] {
  return [
    {
      intent: "Decking install labour",
      oldAuthority: "deck.labour lumped 1.2 h/m²",
      newAuthority: params.labourMode,
      readiness:
        params.labourMode === "DETAILED_AUTHORITATIVE"
          ? "PROMOTED"
          : "NEEDS_OWNER_BENCHMARK",
      reason: "Uses starter or company hours/m² when the split is complete.",
    },
    {
      intent: "Substructure framing labour",
      oldAuthority: "deck.labour lumped 1.2 h/m²",
      newAuthority: params.labourMode,
      readiness:
        params.labourMode === "DETAILED_AUTHORITATIVE"
          ? "PROMOTED"
          : "NEEDS_OWNER_BENCHMARK",
      reason: "Not added on top of the lump.",
    },
    {
      intent: "Pile/post labour",
      oldAuthority: "inside lumped Deck labour (unseparated)",
      newAuthority: params.labourMode,
      readiness:
        params.labourMode === "DETAILED_AUTHORITATIVE"
          ? "PROMOTED"
          : "NEEDS_OWNER_BENCHMARK",
      reason: "Per-post hours from starter or company productivity when the split is complete.",
    },
    {
      intent: "Structural materials",
      oldAuthority: "deck.substructure.m2 package",
      newAuthority: params.substructureMode,
      readiness:
        params.substructureMode === "DETAILED_AUTHORITATIVE"
          ? "PROMOTED"
          : "READY_BUT_RATE_MISSING",
      reason: "No package + detail double count. No mysterious residual subtract.",
    },
    {
      intent: "Fascia labour",
      oldAuthority: "Face board labour allowance $/lm",
      newAuthority: params.fasciaDetailed
        ? "DETAILED_AUTHORITATIVE"
        : "PACKAGE_FALLBACK",
      readiness: params.fasciaDetailed ? "PROMOTED" : "NEEDS_OWNER_BENCHMARK",
      reason: "Hours/lm from starter fascia productivity when hours are trusted.",
    },
    {
      intent: "Steps",
      oldAuthority: "Stair/step lump allowance",
      newAuthority: params.stepsDetailed
        ? "DETAILED_AUTHORITATIVE"
        : "PACKAGE_FALLBACK",
      readiness: params.stepsDetailed ? "PROMOTED" : "NEEDS_OWNER_BENCHMARK",
      reason: "Starter hours exist as low-confidence productivity. Stair lump stays until step material and labour are both commercially complete.",
    },
    {
      intent: "Demolition labour",
      oldAuthority: "deck.demolition_hours_per_m2",
      newAuthority: "DETAILED_AUTHORITATIVE",
      readiness: "PROMOTED",
      reason: "Already a separate line. Unchanged.",
    },
    {
      intent: "Balustrade",
      oldAuthority: "Lump allowance",
      newAuthority: "PACKAGE_FALLBACK",
      readiness: "NOT_READY",
      reason: "Not matured in 2B.",
    },
    {
      intent: "Fixings / sundries",
      oldAuthority: "deck.fixings.m2",
      newAuthority: "PACKAGE_FALLBACK",
      readiness: "PROMOTED",
      reason:
        "Residual starter $/m² for connectors, DPC, blocking, consumables and sundries. Not structural timber. Historical $25/$40 retained as RESIDUAL_STARTER_BENCHMARK. Delivery/freight is a future gap, not hidden here. Concrete stays planning-only or package.",
    },
    {
      intent: "Access / carry",
      oldAuthority: "getCombinedLabourAccessFactor once",
      newAuthority: "DETAILED_AUTHORITATIVE",
      readiness: "PROMOTED",
      reason: "Applied once to hours, not per component then again.",
    },
    {
      intent: "Elevated extra",
      oldAuthority: "deck.elevated_extra_hours_per_m2 added to lump",
      newAuthority: params.labourMode,
      readiness: "PROMOTED",
      reason:
        "Separate additional labour intent. Applied once. Not inside the base split.",
    },
  ];
}

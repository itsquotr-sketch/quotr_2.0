/**
 * Stage 3A — point an unresolved existing flooring line at one existing editor.
 * Company rates stay in organisation_rates. No second rate store and no new recipe.
 */
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import {
  FLOORING_CARPET_ACCESSORIES_M2,
  FLOORING_CARPET_PURCHASING_UNRESOLVED,
  FLOORING_FINISH_ANCILLARY_COMPONENT,
  FLOORING_FINISH_INSTALL_COMPONENT,
  FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  FLOORING_FINISH_SUPPLY_COMPONENT,
  FLOORING_FINISH_WASTE_COMPONENT,
  FLOORING_HARDWOOD_ADHESIVE_FIXINGS_M2,
  FLOORING_HARDWOOD_SUPPLY_LM,
  FLOORING_TILE_ADHESIVE_GROUT_M2,
  FLOORING_TILE_SUPPLY_EACH,
  FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2,
  FLOORING_VINYL_SUPPLY_M2,
} from "@/lib/estimate/flooring-purchasing";

export const FLOORING_WASTE_TREATMENT_FACT = "flooring.portion.waste_treatment";
export const FLOORING_FINISH_PRICING_FACT = "flooring.portion.finish_pricing";
export const FLOORING_CARPENTER_HOUR_KEY = "labour.carpenter.hour";

export const FLOORING_WASTE_DECISIONS = [
  {
    label: "Package rate covers the requested waste",
    value: "package_covers_requested_waste",
  },
  {
    label: "Charge only the extra waste quantity",
    value: "incremental_material",
  },
] as const;

export const FLOORING_OWNERSHIP_DECISIONS = [
  {
    label: "Combined supply and installation package",
    value: "combined_package",
  },
  {
    label: "Separate finish supply and installation",
    value: "separate_supply",
  },
] as const;

const COMPANY_SCOPE =
  "This saves a company rate for future estimates. A matching project material override still takes precedence. A manual amount on this pricing draft prices this job only and is kept when the estimate is updated.";

const DECISION_SCOPE =
  "This answer is saved on the job. The current estimate is not rewritten until you update it. A typed amount does not answer this choice.";

const QUANTITY_SCOPE =
  "The purchase quantity or coverage is still unresolved. A typed amount does not answer it, and no rate is invented.";

export type FlooringRecoveryDecision = {
  readonly label: string;
  readonly value: string;
};

export type FlooringPricingRecovery = {
  readonly kind:
    | "company_material"
    | "company_productivity"
    | "company_labour"
    | "decision"
    | "unresolved_quantity";
  readonly roomName: string;
  readonly itemLabel: string;
  readonly missing: string;
  readonly unitExplanation: string;
  readonly scopeExplanation: string;
  readonly itemKey: string | null;
  readonly ratesSection: "materials" | "productivity" | "labour" | null;
  readonly blocksManualAmount: boolean;
  readonly factKey: string | null;
  readonly decisions: readonly FlooringRecoveryDecision[];
};

const CANONICAL_UNITS: Record<string, string> = {
  [FLOORING_VINYL_SUPPLY_M2]: "m2",
  [FLOORING_TILE_SUPPLY_EACH]: "each",
  [FLOORING_HARDWOOD_SUPPLY_LM]: "lm",
  [FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2]: "m2",
  [FLOORING_TILE_ADHESIVE_GROUT_M2]: "m2",
  [FLOORING_HARDWOOD_ADHESIVE_FIXINGS_M2]: "m2",
  [FLOORING_CARPET_ACCESSORIES_M2]: "m2",
};

export function canonicalFinishMaterialUnit(itemKey: string): string | null {
  return CANONICAL_UNITS[itemKey] ?? null;
}

export function normalizeFlooringPurchasingUnit(unit: string): string | null {
  const compact = unit
    .trim()
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/\s+/g, "");
  if (compact === "m2" || compact === "sqm") return "m2";
  if (
    compact === "lm" ||
    compact === "linealm" ||
    compact === "linealmetre" ||
    compact === "linealmeter"
  ) {
    return "lm";
  }
  if (compact === "each" || compact === "ea") return "each";
  if (compact === "l" || compact === "litre" || compact === "liter" || compact === "litres" || compact === "liters") {
    return "l";
  }
  if (compact === "pack" || compact === "packs") return "pack";
  return null;
}

export function flooringPurchasingUnitsMatch(
  saved: string | null | undefined,
  expected: string
): { ok: true } | { ok: false; reason: string } {
  const wanted = normalizeFlooringPurchasingUnit(expected) ?? expected;
  if (saved == null || saved.trim() === "") {
    return {
      ok: false,
      reason: `The saved rate has no unit. This item is purchased per ${wanted}. A blank unit is not treated as ${wanted}.`,
    };
  }
  const have = normalizeFlooringPurchasingUnit(saved);
  if (!have || have !== wanted) {
    return {
      ok: false,
      reason: `The saved rate is per ${saved.trim()}. This item is purchased per ${wanted}. Those units are not converted.`,
    };
  }
  return { ok: true };
}

export function safeFlooringReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/app/projects/")) return null;
  if (decoded.startsWith("//") || decoded.includes("://") || decoded.includes("\\")) {
    return null;
  }
  return decoded;
}

export function flooringRateEditorHref(params: {
  section: "materials" | "productivity" | "labour";
  itemKey: string;
  projectId?: string | null;
  workAreaId?: string | null;
}): string {
  const search = new URLSearchParams({
    section: params.section,
    item: params.itemKey,
  });
  if (params.projectId) {
    const workArea = params.workAreaId ? `&workArea=${encodeURIComponent(params.workAreaId)}` : "";
    search.set(
      "returnTo",
      `/app/projects/${params.projectId}?recovery=saved${workArea}`
    );
  }
  return `/app/rates?${search.toString()}`;
}

export function flooringScopeDecisionOpen(text: string): boolean {
  return (
    /not added on top/i.test(text) ||
    /does not include it/i.test(text) ||
    /no extra purchase quantity/i.test(text) ||
    /carpet roll purchasing is unresolved/i.test(text)
  );
}

export function flooringOwnershipDecisionOpen(text: string): boolean {
  return /not added on top/i.test(text);
}

export function flooringOwnershipRecovery(roomName: string): FlooringPricingRecovery {
  return {
    kind: "decision",
    roomName,
    itemLabel: "Finish package ownership",
    missing:
      "A finish material rate and a combined package both exist. The package cannot be split, so the material rate is not added on top until the job chooses one owner.",
    unitExplanation: "This is a scope choice, not a rate or a unit conversion.",
    scopeExplanation: DECISION_SCOPE,
    itemKey: null,
    ratesSection: null,
    blocksManualAmount: true,
    factKey: FLOORING_FINISH_PRICING_FACT,
    decisions: FLOORING_OWNERSHIP_DECISIONS,
  };
}

function materialRecovery(params: {
  roomName: string;
  itemLabel: string;
  itemKey: string;
  missing: string;
}): FlooringPricingRecovery {
  const unit = canonicalFinishMaterialUnit(params.itemKey) ?? "the purchasing unit";
  return {
    kind: "company_material",
    roomName: params.roomName,
    itemLabel: params.itemLabel,
    missing: params.missing,
    unitExplanation: `The company cost must be per ${unit}. A pack, litre, lineal metre or each is not converted into ${unit}.`,
    scopeExplanation: COMPANY_SCOPE,
    itemKey: params.itemKey,
    ratesSection: "materials",
    blocksManualAmount: false,
    factKey: null,
    decisions: [],
  };
}

export function flooringPricingRecovery(input: {
  componentKey: string | null;
  itemKey: string | null;
  notes: string | null;
  label: string;
  roomName: string;
  unit: string | null;
}): FlooringPricingRecovery | null {
  const key = input.componentKey ?? "";
  const notes = input.notes ?? "";
  const itemKey = input.itemKey;
  const roomName = input.roomName.trim() || "This flooring area";
  const itemLabel = input.label.trim() || "Flooring item";

  if (
    itemKey === FLOORING_CARPET_PURCHASING_UNRESOLVED ||
    /carpet roll purchasing is unresolved/i.test(notes)
  ) {
    return {
      kind: "unresolved_quantity",
      roomName,
      itemLabel,
      missing:
        "Carpet does not have a priced roll or cut-length quantity. No carpet square-metre rate is invented for it.",
      unitExplanation: "Square metres of room area are not converted into a carpet purchase unit.",
      scopeExplanation: QUANTITY_SCOPE,
      itemKey: null,
      ratesSection: null,
      blocksManualAmount: true,
      factKey: null,
      decisions: [],
    };
  }

  if (key === FLOORING_FINISH_WASTE_COMPONENT) {
    if (/no extra purchase quantity/i.test(notes) || (input.unit === "item" && !itemKey)) {
      return {
        kind: "unresolved_quantity",
        roomName,
        itemLabel,
        missing:
          "The requested waste has no extra purchase quantity, so nothing is priced and the package is not increased by the waste percentage.",
        unitExplanation: "There is no purchasing unit to convert.",
        scopeExplanation: QUANTITY_SCOPE,
        itemKey: null,
        ratesSection: null,
        blocksManualAmount: true,
        factKey: null,
        decisions: [],
      };
    }
    if (itemKey && canonicalFinishMaterialUnit(itemKey)) {
      return materialRecovery({
        roomName,
        itemLabel,
        itemKey,
        missing: /not converted|has no unit/i.test(notes)
          ? notes
          : `${roomName} is set to charge only the extra waste. The finish material rate for ${itemKey} is missing or its unit does not match ${canonicalFinishMaterialUnit(itemKey)}.`,
      });
    }
    return {
      kind: "decision",
      roomName,
      itemLabel,
      missing: `${roomName} still needs a waste treatment. The combined package excludes the requested waste until that choice is saved.`,
      unitExplanation: "The extra quantity stays unpriced until the treatment is chosen. It is not a percentage of the package.",
      scopeExplanation: DECISION_SCOPE,
      itemKey: null,
      ratesSection: null,
      blocksManualAmount: true,
      factKey: FLOORING_WASTE_TREATMENT_FACT,
      decisions: FLOORING_WASTE_DECISIONS,
    };
  }

  if (key === FLOORING_FINISH_SUPPLY_COMPONENT && itemKey && canonicalFinishMaterialUnit(itemKey)) {
    return materialRecovery({
      roomName,
      itemLabel,
      itemKey,
      missing: /not converted|has no unit/i.test(notes)
        ? notes
        : `${roomName} is missing the finish material rate ${itemKey}.`,
    });
  }

  if (key === FLOORING_FINISH_ANCILLARY_COMPONENT && itemKey && canonicalFinishMaterialUnit(itemKey)) {
    return materialRecovery({
      roomName,
      itemLabel,
      itemKey,
      missing: /not converted|has no unit/i.test(notes)
        ? notes
        : `${roomName} is missing the adhesive or ancillary rate ${itemKey}. It is charged once on the net area, and only when that exact rate exists.`,
    });
  }

  if (key === FLOORING_FINISH_INSTALL_COMPONENT) {
    if (/carpenter hourly cost/i.test(notes)) {
      return {
        kind: "company_labour",
        roomName,
        itemLabel,
        missing: `${roomName} has installation productivity saved. The carpenter hourly cost is missing, so the labour cost is not calculated.`,
        unitExplanation: "The labour cost is dollars per hour. It is not converted from a material unit.",
        scopeExplanation: COMPANY_SCOPE,
        itemKey: FLOORING_CARPENTER_HOUR_KEY,
        ratesSection: "labour",
        blocksManualAmount: false,
        factKey: null,
        decisions: [],
      };
    }
    return {
      kind: "company_productivity",
      roomName,
      itemLabel,
      missing: /not converted|has no unit/i.test(notes)
        ? notes
        : `${roomName} is missing installation productivity ${FLOORING_FINISH_INSTALL_HOURS_PER_M2}. No Quotr hours default is applied.`,
      unitExplanation: "Productivity is hours per net square metre. Hours per sheet, each or lineal metre are not converted.",
      scopeExplanation: COMPANY_SCOPE,
      itemKey: FLOORING_FINISH_INSTALL_HOURS_PER_M2,
      ratesSection: "productivity",
      blocksManualAmount: false,
      factKey: null,
      decisions: [],
    };
  }

  return null;
}

export function flooringManualAmountBlocked(input: {
  componentKey: string | null;
  notes: string | null;
  itemKey?: string | null;
}): boolean {
  const parsed = input.notes ? parseLineItemNotes(input.notes) : null;
  const itemKey = input.itemKey ?? parsed?.metadata.itemKey ?? null;
  const notes = `${input.notes ?? ""} ${parsed?.displayNotes ?? ""} ${parsed?.metadata.identitySummary ?? ""}`;
  if (flooringOwnershipDecisionOpen(notes)) return true;
  if (/no extra purchase quantity/i.test(notes)) return true;
  if (/carpet roll purchasing is unresolved/i.test(notes)) return true;
  if (itemKey === FLOORING_CARPET_PURCHASING_UNRESOLVED) return true;
  if ((input.componentKey ?? "") === FLOORING_FINISH_WASTE_COMPONENT) {
    if (itemKey && canonicalFinishMaterialUnit(itemKey)) return false;
    return true;
  }
  return false;
}

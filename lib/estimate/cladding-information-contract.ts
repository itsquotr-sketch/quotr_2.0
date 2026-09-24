/**
 * CLADDING-02 — Details and readiness contract.
 *
 * Questions are progressive. Location never blocks readiness.
 * No physical quantity, cost, or quote authority is claimed here.
 */

import type { ClarifyAskClass } from "@/lib/assistant/clarify/types";
import {
  claddingVisibleApprovedProfile,
  findCladdingPortion,
  resolveCladdingPortions,
  type CladdingPortion,
  type CladdingSystem,
} from "@/lib/estimate/cladding-portions";
import type { EstimateFact } from "@/lib/estimate/types";

export type CladdingInformationContractRow = {
  readonly factKey: string;
  readonly askClass: ClarifyAskClass;
  readonly calculatorConsumed: boolean;
  readonly reason: string;
};

export type CladdingInformationContext = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly nestedItemId?: string | null;
  readonly portion?: CladdingPortion | null;
};

export const CLADDING_INFORMATION_CONTRACT: readonly CladdingInformationContractRow[] =
  [
    {
      factKey: "cladding.portion.scope_intent",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Scope intent chooses install, replace, or removal only.",
    },
    {
      factKey: "cladding.portion.label",
      askClass: "ASSUME_IF_SKIPPED",
      calculatorConsumed: false,
      reason: "Location is optional and must not block readiness.",
    },
    {
      factKey: "cladding.portion.cladding_family",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Family selects the timber, fibre-cement, or specialist path.",
    },
    {
      factKey: "cladding.portion.orientation",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Timber orientation filters the supported system.",
    },
    {
      factKey: "cladding.portion.cladding_system",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "System selects the approved profile list.",
    },
    {
      factKey: "cladding.portion.approved_profile",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "An approved profile keeps ordinary dimensions consistent.",
    },
    {
      factKey: "cladding.portion.other_description",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Specialist and custom sections need a description.",
    },
    {
      factKey: "cladding.portion.area_method",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Area method chooses direct m² or length × height.",
    },
    {
      factKey: "cladding.portion.direct_area_m2",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Direct area is required when that method is used.",
    },
    {
      factKey: "cladding.portion.length_m",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Length is required for length × height.",
    },
    {
      factKey: "cladding.portion.height_m",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Height is required for length × height.",
    },
    {
      factKey: "cladding.portion.openings_already_deducted",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Openings must be explicit before a future net area can be trusted.",
    },
    {
      factKey: "cladding.portion.opening_area_m2",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "A deduction is required when openings are not already excluded.",
    },
    {
      factKey: "cladding.portion.cavity_included",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Cavity inclusion is scope disclosure only.",
    },
    {
      factKey: "cladding.portion.wall_underlay_or_rab_included",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Underlay or rigid air barrier inclusion is scope disclosure only.",
    },
    {
      factKey: "cladding.portion.trims_flashings_corners_included",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Trims, corners and flashings inclusion is scope disclosure only.",
    },
    {
      factKey: "cladding.portion.existing_cladding_removal_required",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Existing cladding removal is asked only when it is still open.",
    },
    {
      factKey: "cladding.portion.painting_or_coating_included",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: false,
      reason: "Painting disclosure stays in Cladding and does not price Painting.",
    },
  ];

export const CLADDING_CONTRACT_FACT_ORDER = new Map(
  CLADDING_INFORMATION_CONTRACT.map((row, index) => [row.factKey, index])
);

const HORIZONTAL_SYSTEMS = new Set<CladdingSystem>([
  "timber_bevelback",
  "timber_rusticated",
]);
const VERTICAL_SYSTEMS = new Set<CladdingSystem>([
  "timber_vertical_shiplap",
  "timber_sheet_board_and_batten",
]);

export function lookupCladdingInformationContract(
  factKey: string
): CladdingInformationContractRow | null {
  return CLADDING_INFORMATION_CONTRACT.find((row) => row.factKey === factKey) ?? null;
}

export function claddingFactQuestionClass(
  factKey: string
): ClarifyAskClass | null {
  return lookupCladdingInformationContract(factKey)?.askClass ?? null;
}

export function claddingPortionIsSpecialist(portion: CladdingPortion): boolean {
  return (
    portion.cladding_family === "brick_veneer" ||
    portion.cladding_family === "masonry" ||
    portion.cladding_family === "other" ||
    portion.cladding_system === "specialist_unresolved"
  );
}

export function claddingGrossAreaM2(portion: CladdingPortion): number | null {
  if (portion.area_method === "direct_m2" && portion.direct_area_m2 != null) {
    return portion.direct_area_m2 > 0 ? portion.direct_area_m2 : null;
  }
  if (
    portion.area_method === "length_height" &&
    portion.length_m != null &&
    portion.height_m != null &&
    portion.length_m > 0 &&
    portion.height_m > 0
  ) {
    return portion.length_m * portion.height_m;
  }
  return null;
}

export function claddingFutureNetAreaPositive(portion: CladdingPortion): boolean {
  const gross = claddingGrossAreaM2(portion);
  if (gross == null || gross <= 0) return false;
  if (portion.openings_already_deducted == null) return false;
  if (portion.openings_already_deducted) return true;
  if (portion.opening_area_m2 == null || portion.opening_area_m2 < 0) return false;
  return portion.opening_area_m2 < gross;
}

function geometryReady(portion: CladdingPortion): boolean {
  return claddingFutureNetAreaPositive(portion);
}

function profileReady(portion: CladdingPortion): boolean {
  return claddingVisibleApprovedProfile(portion) != null;
}

function systemMatchesParents(portion: CladdingPortion): boolean {
  const system = portion.cladding_system;
  if (!system || system === "specialist_unresolved") return false;
  if (portion.cladding_family === "fibre_cement") {
    return system === "fibre_cement_horizontal_weatherboard";
  }
  if (portion.cladding_family !== "timber") return false;
  if (portion.orientation === "horizontal") return HORIZONTAL_SYSTEMS.has(system);
  if (portion.orientation === "vertical") return VERTICAL_SYSTEMS.has(system);
  return false;
}

export function claddingFactIsRelevant(
  factKey: string,
  ctx: CladdingInformationContext
): boolean {
  const portion =
    ctx.portion ??
    findCladdingPortion(
      resolveCladdingPortions({
        facts: ctx.facts,
        workAreaId: ctx.workAreaId,
      }).portions,
      ctx.nestedItemId
    );
  if (!portion) return factKey === "cladding.portion.scope_intent";
  const specialist = claddingPortionIsSpecialist(portion);
  const removalOnly = portion.scope_intent === "removal_only";
  if (factKey === "cladding.portion.scope_intent" || factKey === "cladding.portion.label") {
    return true;
  }
  if (!portion.scope_intent || portion.scope_intent === "suppressed") return false;
  if (factKey === "cladding.portion.cladding_family") return true;
  if (!portion.cladding_family) return false;

  if (removalOnly) {
    if (factKey === "cladding.portion.other_description") {
      return portion.cladding_family === "other";
    }
    if (factKey === "cladding.portion.area_method") return true;
    if (!portion.area_method) return false;
    if (factKey === "cladding.portion.direct_area_m2") {
      return portion.area_method === "direct_m2";
    }
    if (factKey === "cladding.portion.length_m" || factKey === "cladding.portion.height_m") {
      return portion.area_method === "length_height";
    }
    if (!claddingGrossAreaM2(portion)) return false;
    if (factKey === "cladding.portion.openings_already_deducted") return true;
    if (factKey === "cladding.portion.opening_area_m2") {
      return portion.openings_already_deducted === false;
    }
    return false;
  }

  if (specialist) {
    if (
      factKey === "cladding.portion.orientation" ||
      factKey === "cladding.portion.cladding_system" ||
      factKey === "cladding.portion.approved_profile"
    ) {
      return false;
    }
    if (factKey === "cladding.portion.other_description") return true;
    if (!portion.other_description?.trim()) return false;
  } else if (portion.cladding_family === "timber") {
    if (factKey === "cladding.portion.orientation") return true;
    if (!portion.orientation) return false;
    if (factKey === "cladding.portion.cladding_system") return true;
    if (!systemMatchesParents(portion)) return false;
    if (factKey === "cladding.portion.approved_profile") return true;
    if (!profileReady(portion)) return false;
  } else if (portion.cladding_family === "fibre_cement") {
    if (factKey === "cladding.portion.orientation") return false;
    if (factKey === "cladding.portion.cladding_system") return true;
    if (!systemMatchesParents(portion)) return false;
    if (factKey === "cladding.portion.approved_profile") return true;
    if (!profileReady(portion)) return false;
  } else {
    return false;
  }

  if (factKey === "cladding.portion.other_description") return specialist;
  if (factKey === "cladding.portion.orientation") return portion.cladding_family === "timber";
  if (factKey === "cladding.portion.cladding_system") {
    return portion.cladding_family === "timber" || portion.cladding_family === "fibre_cement";
  }
  if (factKey === "cladding.portion.approved_profile") return !specialist;

  if (factKey === "cladding.portion.area_method") return true;
  if (!portion.area_method) return false;
  if (factKey === "cladding.portion.direct_area_m2") return portion.area_method === "direct_m2";
  if (factKey === "cladding.portion.length_m" || factKey === "cladding.portion.height_m") {
    return portion.area_method === "length_height";
  }
  if (!claddingGrossAreaM2(portion)) return false;
  if (factKey === "cladding.portion.openings_already_deducted") return true;
  if (!geometryReady(portion) && portion.openings_already_deducted == null) return false;
  if (factKey === "cladding.portion.opening_area_m2") {
    return portion.openings_already_deducted === false;
  }
  if (portion.openings_already_deducted === false && portion.opening_area_m2 == null) {
    return false;
  }
  if (!geometryReady(portion)) return false;
  if (specialist) {
    return factKey === "cladding.portion.existing_cladding_removal_required";
  }
  return (
    factKey === "cladding.portion.cavity_included" ||
    factKey === "cladding.portion.wall_underlay_or_rab_included" ||
    factKey === "cladding.portion.trims_flashings_corners_included" ||
    factKey === "cladding.portion.existing_cladding_removal_required" ||
    factKey === "cladding.portion.painting_or_coating_included"
  );
}

export function claddingPortionIsInformationComplete(portion: CladdingPortion): boolean {
  if (!portion.scope_intent || portion.scope_intent === "suppressed") return false;
  if (!claddingFutureNetAreaPositive(portion)) return false;
  if (portion.scope_intent === "removal_only") {
    const identified =
      portion.cladding_family != null || Boolean(portion.other_description?.trim());
    return identified;
  }
  if (claddingPortionIsSpecialist(portion)) {
    if (!portion.other_description?.trim()) return false;
    if (
      portion.scope_intent === "replace" &&
      portion.existing_cladding_removal_required == null
    ) {
      return false;
    }
    if (
      portion.scope_intent === "install" &&
      portion.existing_cladding_removal_required == null
    ) {
      return false;
    }
    return true;
  }
  if (!portion.cladding_family) return false;
  if (portion.cladding_family === "timber" && !portion.orientation) return false;
  if (!systemMatchesParents(portion)) return false;
  if (!profileReady(portion)) return false;
  if (portion.cavity_included == null) return false;
  if (portion.wall_underlay_or_rab_included == null) return false;
  if (portion.trims_flashings_corners_included == null) return false;
  if (portion.existing_cladding_removal_required == null) return false;
  if (portion.painting_or_coating_included == null) return false;
  return true;
}

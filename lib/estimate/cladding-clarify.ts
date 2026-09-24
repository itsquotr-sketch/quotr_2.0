/**
 * CLADDING-02 — Work summaries and Details candidates.
 * Summaries stay human. They do not show keys, money, or calculator status.
 */

import type {
  ClarifyAskClass,
  ClarifyCandidate,
  NestedItemPanel,
} from "@/lib/assistant/clarify/types";
import {
  claddingPortionQuestionIdentity,
  questionPresentationId,
} from "@/lib/assistant/question-identity";
import { safeFactPresentationLabel } from "@/lib/assistant/presentation/fact-key-labels";
import {
  CLADDING_ADD_PORTION_KEY,
  CLADDING_DELETE_PORTION_KEY,
  CLADDING_DUPLICATE_PORTION_KEY,
  claddingVisibleApprovedProfile,
  findCladdingPortion,
  isCladdingPortionWriteKey,
  resolveCladdingPortions,
  type CladdingPortion,
} from "@/lib/estimate/cladding-portions";
import {
  CLADDING_INFORMATION_CONTRACT,
  claddingFactIsRelevant,
  claddingGrossAreaM2,
  claddingPortionIsInformationComplete,
  claddingPortionIsSpecialist,
  type CladdingInformationContext,
} from "@/lib/estimate/cladding-information-contract";
import {
  CLADDING_BATTEN_DIRECT_AREA_DISCLOSURE,
  claddingQuestionCopy,
  claddingQuestionInputType,
  claddingQuestionLabel,
  claddingQuestionOptions,
  claddingQuestionUnit,
} from "@/lib/estimate/cladding-question-copy";
import type { EstimateFact } from "@/lib/estimate/types";

export type CladdingClarifyInput = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaName: string;
  readonly briefText?: string | null;
};

function isResolved(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value === "boolean") return true;
  return false;
}

function yesNo(value: boolean | null): string | null {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return null;
}

export function claddingPortionFieldCurrentValue(
  portion: CladdingPortion | null,
  factKey: string
): string | number | boolean | null {
  if (!portion) return null;
  if (factKey === "cladding.portion.scope_intent") {
    if (portion.scope_intent === "install") return "New cladding";
    if (portion.scope_intent === "replace") return "Replace / reclad";
    if (portion.scope_intent === "removal_only") return "Removal only";
    return null;
  }
  if (factKey === "cladding.portion.label") return portion.label;
  if (factKey === "cladding.portion.cladding_family") {
    if (portion.cladding_family === "timber") return "Timber";
    if (portion.cladding_family === "fibre_cement") return "Fibre cement";
    if (portion.cladding_family === "brick_veneer") return "Brick veneer";
    if (portion.cladding_family === "masonry") return "Masonry";
    if (portion.cladding_family === "other") return "Other / custom";
    return null;
  }
  if (factKey === "cladding.portion.orientation") {
    if (portion.orientation === "horizontal") return "Horizontal";
    if (portion.orientation === "vertical") return "Vertical";
    return null;
  }
  if (factKey === "cladding.portion.cladding_system") {
    if (portion.cladding_system === "timber_bevelback") return "Bevelback";
    if (portion.cladding_system === "timber_rusticated") return "Rusticated";
    if (portion.cladding_system === "timber_vertical_shiplap") return "Vertical shiplap";
    if (portion.cladding_system === "timber_sheet_board_and_batten") {
      return "Sheet board-and-batten";
    }
    if (portion.cladding_system === "fibre_cement_horizontal_weatherboard") {
      return "Horizontal weatherboard";
    }
    if (portion.cladding_system === "specialist_unresolved") return "Other / custom";
    return null;
  }
  if (factKey === "cladding.portion.approved_profile") {
    const profile = claddingVisibleApprovedProfile(portion);
    if (!profile) return null;
    if (profile.system === "timber_sheet_board_and_batten") {
      return "2400 × 1200 mm sheet, 8 mm gap";
    }
    if (profile.system === "fibre_cement_horizontal_weatherboard") {
      return `${profile.nominal_width_mm} mm (cover ${profile.effective_cover_mm} mm)`;
    }
    return `${profile.nominal_width_mm} × ${profile.nominal_thickness_mm} mm (cover ${profile.effective_cover_mm} mm)`;
  }
  if (factKey === "cladding.portion.other_description") return portion.other_description;
  if (factKey === "cladding.portion.area_method") {
    if (portion.area_method === "direct_m2") return "Direct area";
    if (portion.area_method === "length_height") return "Length × height";
    return null;
  }
  if (factKey === "cladding.portion.direct_area_m2") return portion.direct_area_m2;
  if (factKey === "cladding.portion.length_m") return portion.length_m;
  if (factKey === "cladding.portion.height_m") return portion.height_m;
  if (factKey === "cladding.portion.openings_already_deducted") {
    return yesNo(portion.openings_already_deducted);
  }
  if (factKey === "cladding.portion.opening_area_m2") return portion.opening_area_m2;
  if (factKey === "cladding.portion.cavity_included") return yesNo(portion.cavity_included);
  if (factKey === "cladding.portion.wall_underlay_or_rab_included") {
    return yesNo(portion.wall_underlay_or_rab_included);
  }
  if (factKey === "cladding.portion.wall_preparation") return portion.wall_preparation;
  if (factKey === "cladding.portion.batten_width_mm") return portion.batten_width_mm;
  if (factKey === "cladding.portion.batten_thickness_mm") return portion.batten_thickness_mm;
  if (factKey === "cladding.portion.trims_flashings_corners_included") {
    return yesNo(portion.trims_flashings_corners_included);
  }
  if (factKey === "cladding.portion.existing_cladding_removal_required") {
    return yesNo(portion.existing_cladding_removal_required);
  }
  if (factKey === "cladding.portion.painting_or_coating_included") {
    return yesNo(portion.painting_or_coating_included);
  }
  return null;
}

function portionDisplayName(portion: CladdingPortion, index: number): string {
  return portion.label?.trim() || `Cladding section ${index + 1}`;
}

export function summariseCladdingPortion(
  portion: CladdingPortion,
  index: number
): {
  id: string;
  displayName: string;
  summary: string;
  complete: boolean;
  specialistRequired: boolean;
} {
  const displayName = portionDisplayName(portion, index);
  const specialist = claddingPortionIsSpecialist(portion);
  const area = claddingGrossAreaM2(portion);
  const areaText = area != null ? `${area} m²` : null;
  let summary = displayName;
  if (portion.scope_intent === "removal_only") {
    const existing =
      portion.cladding_family === "timber"
        ? "Existing timber weatherboards"
        : portion.cladding_family === "fibre_cement"
          ? "Existing fibre-cement weatherboards"
          : portion.other_description?.trim() || "Existing cladding";
    summary = [existing, areaText, "removal only"].filter(Boolean).join(" · ");
  } else if (portion.cladding_family === "brick_veneer" || portion.cladding_family === "masonry") {
    summary = [
      portion.cladding_family === "brick_veneer" ? "Brick veneer" : "Masonry veneer",
      areaText,
      "specialist specification required",
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (portion.cladding_system === "timber_sheet_board_and_batten") {
    summary = [
      displayName,
      "timber sheet board-and-batten",
      areaText ?? "area still needed",
      portion.area_method === "direct_m2" ? CLADDING_BATTEN_DIRECT_AREA_DISCLOSURE : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } else {
    const profile = claddingVisibleApprovedProfile(portion);
    const orientation = portion.orientation === "vertical" ? "vertical" : portion.orientation === "horizontal" ? "horizontal" : null;
    let product: string | null = null;
    if (profile?.system === "timber_bevelback") {
      product = `${profile.nominal_width_mm} × ${profile.nominal_thickness_mm} mm ${orientation ?? ""} bevelback timber weatherboards`.replace(/\s+/g, " ");
    } else if (profile?.system === "timber_rusticated") {
      product = `${profile.nominal_width_mm} × ${profile.nominal_thickness_mm} mm ${orientation ?? ""} rusticated timber weatherboards`.replace(/\s+/g, " ");
    } else if (profile?.system === "timber_vertical_shiplap") {
      product = `${profile.nominal_width_mm} × ${profile.nominal_thickness_mm} mm vertical shiplap timber weatherboards`;
    } else if (profile?.system === "fibre_cement_horizontal_weatherboard") {
      product = `${profile.nominal_width_mm} mm horizontal fibre-cement weatherboards`;
    } else if (specialist) {
      product = portion.other_description?.trim() || "specialist specification required";
    }
    summary = [displayName, areaText, product].filter(Boolean).join(" · ");
  }
  return {
    id: portion.id,
    displayName,
    summary,
    complete: claddingPortionIsInformationComplete(portion),
    specialistRequired: specialist,
  };
}

function buildCandidate(params: {
  input: CladdingClarifyInput;
  portion: CladdingPortion | null;
  portionIndex: number;
  factKey: string;
  askClass: ClarifyAskClass;
}): ClarifyCandidate {
  const displayName = params.portion
    ? portionDisplayName(params.portion, params.portionIndex)
    : params.input.workAreaName;
  const rankBase = params.askClass === "HARD_MINIMUM" ? 1000 : 40;
  const contractIndex = CLADDING_INFORMATION_CONTRACT.findIndex(
    (row) => row.factKey === params.factKey
  );
  return {
    id:
      questionPresentationId(
        params.askClass === "HARD_MINIMUM" ? "hard" : "fact",
        claddingPortionQuestionIdentity({
          workAreaId: params.input.workAreaId,
          factKey: params.factKey,
          nestedItemId: params.portion?.id,
        })
      ) ??
      `${params.askClass}:${params.input.workAreaId}:${params.factKey}`,
    source: "scope_fact",
    workAreaId: params.input.workAreaId,
    workAreaName: params.input.workAreaName,
    workAreaType: "cladding",
    factKey: params.factKey,
    constraintKey: null,
    questionKey: params.factKey,
    label: params.portion
      ? `${displayName} · ${claddingQuestionLabel(params.factKey) || safeFactPresentationLabel(params.factKey)}`
      : claddingQuestionLabel(params.factKey),
    question: claddingQuestionCopy(params.factKey, params.portion),
    askClass: params.askClass,
    inputType: claddingQuestionInputType(params.factKey),
    unit: claddingQuestionUnit(params.factKey),
    options: claddingQuestionOptions(params.factKey, params.portion),
    currentValue: claddingPortionFieldCurrentValue(params.portion, params.factKey),
    writeTarget: "FACT",
    write: null,
    blocksEstimate: params.askClass === "HARD_MINIMUM",
    assumable: params.askClass === "ASSUME_IF_SKIPPED",
    rankScore: rankBase - contractIndex,
    rankReason: `${params.askClass} · cladding contract`,
    assumptionStatement: null,
    nestedItemId: params.portion?.id ?? null,
  };
}

export function claddingNestedFactCurrentValue(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly factKey: string;
  readonly nestedItemId?: string | null;
}): string | number | boolean | null {
  if (!params.factKey.startsWith("cladding.portion.")) return null;
  const resolved = resolveCladdingPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  const portion =
    findCladdingPortion(resolved.portions, params.nestedItemId) ??
    resolved.portions[0] ??
    null;
  return claddingPortionFieldCurrentValue(portion, params.factKey);
}

export function listCladdingClarifyCandidates(
  input: CladdingClarifyInput
): ClarifyCandidate[] {
  const resolved = resolveCladdingPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  if (resolved.portions.length === 0) return [];
  const out: ClarifyCandidate[] = [];
  resolved.portions.forEach((portion, index) => {
    const ctx: CladdingInformationContext = {
      facts: input.facts,
      workAreaId: input.workAreaId,
      portion,
      nestedItemId: portion.id,
    };
    for (const row of CLADDING_INFORMATION_CONTRACT) {
      if (!claddingFactIsRelevant(row.factKey, ctx)) continue;
      const current = claddingPortionFieldCurrentValue(portion, row.factKey);
      if (row.factKey === "cladding.portion.opening_area_m2") {
        if (portion.opening_area_m2 != null) continue;
      } else if (isResolved(current)) {
        continue;
      }
      out.push(
        buildCandidate({
          input,
          portion,
          portionIndex: index,
          factKey: row.factKey,
          askClass: row.askClass,
        })
      );
    }
  });
  return out;
}

export function claddingWorkAreaIsReady(input: CladdingClarifyInput): boolean {
  const resolved = resolveCladdingPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  if (resolved.portions.length === 0) return false;
  return resolved.portions.every(claddingPortionIsInformationComplete);
}

export function claddingNestedItemPanel(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaName: string;
}): NestedItemPanel | null {
  const resolved = resolveCladdingPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  const summaries = resolved.portions.map((portion, index) =>
    summariseCladdingPortion(portion, index)
  );
  return {
    workAreaId: params.workAreaId,
    workAreaType: "cladding",
    workAreaName: params.workAreaName,
    itemKindLabel: "Cladding section",
    items: summaries.map((row) => ({
      id: row.id,
      label: row.displayName,
      complete: row.complete,
      summary: row.summary,
      specialistRequired: row.specialistRequired,
    })),
    addKey: CLADDING_ADD_PORTION_KEY,
    duplicateKey: CLADDING_DUPLICATE_PORTION_KEY,
    deleteKey: CLADDING_DELETE_PORTION_KEY,
  };
}

export function isCladdingNestedFactKey(factKey: string): boolean {
  return factKey.startsWith("cladding.portion.") || isCladdingPortionWriteKey(factKey);
}

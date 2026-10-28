/**
 * FLOORING-02 — contract-driven Details / Ready candidates for Flooring Areas.
 */

import type {
  ClarifyAskClass,
  ClarifyCandidate,
  NestedItemPanel,
} from "@/lib/assistant/clarify/types";
import {
  flooringPortionQuestionIdentity,
  questionPresentationId,
} from "@/lib/assistant/question-identity";
import { safeFactPresentationLabel } from "@/lib/assistant/presentation/fact-key-labels";
import {
  findFlooringPortion,
  flooringAreaConflictCopy,
  flooringAreaMeasuresDisagree,
  flooringMeasuredAreaM2,
  formatFlooringM2,
  FLOORING_ADD_PORTION_KEY,
  FLOORING_DELETE_PORTION_KEY,
  FLOORING_DUPLICATE_PORTION_KEY,
  hasFlooringPortionsFact,
  isFlooringNestedFactKey,
  resolveFlooringPortions,
  type FlooringPortion,
} from "@/lib/estimate/flooring-portions";
import {
  FLOORING_INFORMATION_CONTRACT,
  flooringFactIsRelevant,
  flooringPortionIsSpecialist,
  type FlooringInformationContext,
} from "@/lib/estimate/flooring-information-contract";
import { planCarpetTileAssembly } from "@/lib/estimate/flooring-carpet-tile";
import {
  FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY,
  flooringQuestionCopy,
  flooringQuestionInputType,
  flooringQuestionLabel,
  flooringQuestionOptions,
  flooringQuestionUnit,
} from "@/lib/estimate/flooring-question-copy";
import type { EstimateFact } from "@/lib/estimate/types";

export type FlooringClarifyInput = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaName: string;
  readonly briefText?: string | null;
};

function isResolved(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return true;
  return false;
}

function finishDisplay(finish: FlooringPortion["finish_type"]): string | null {
  if (finish === "carpet") return "carpet";
  if (finish === "vinyl_plank") return "vinyl plank/LVT";
  if (finish === "tile") return "tile";
  if (finish === "hardwood") return "hardwood/timber";
  if (finish === "other") return "other/custom";
  return null;
}

function yesNo(value: boolean | null): string | null {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return null;
}

export function flooringPortionFieldCurrentValue(
  portion: FlooringPortion | null,
  factKey: string
): string | number | boolean | null {
  if (!portion) return null;
  const field = factKey.slice("flooring.portion.".length);
  if (field === "finish_type") {
    if (portion.finish_type === "carpet") return "Carpet";
    if (portion.finish_type === "vinyl_plank") return "Vinyl plank / LVT";
    if (portion.finish_type === "tile") return "Tile";
    if (portion.finish_type === "hardwood") return "Hardwood / timber flooring";
    if (portion.finish_type === "other") return "Other / custom";
    return null;
  }
  if (field === "label") return portion.label;
  if (field === "area_input_method") {
    if (portion.area_input_method === "direct_m2") return "Direct area";
    if (portion.area_input_method === "length_width") return "Length and width";
    return null;
  }
  if (field === "area_m2") return portion.area_m2;
  if (field === "length_m") return portion.length_m;
  if (field === "width_m") return portion.width_m;
  if (field === "underlay_required") return yesNo(portion.underlay_required);
  if (field === "floor_preparation_required") {
    return yesNo(portion.floor_preparation_required);
  }
  if (field === "finish_pricing") {
    if (portion.finish_pricing === "combined_package") {
      return "Combined supply and installation package";
    }
    if (portion.finish_pricing === "separate_supply") {
      return "Separate finish supply and installation";
    }
    return null;
  }
  if (field === "laminate_method") {
    if (portion.laminate_method === "floating_click_lock") return "Floating click-lock";
    if (portion.laminate_method === "glued") return "Glued down";
    if (portion.laminate_method === "fastened") return "Nailed or stapled";
    return null;
  }
  if (field === "laminate_substrate") {
    if (portion.laminate_substrate === "concrete") return "Concrete";
    if (portion.laminate_substrate === "timber") return "Timber";
    if (portion.laminate_substrate === "other") return "Other substrate";
    return null;
  }
  if (field === "laminate_moisture") {
    if (portion.laminate_moisture === "integrated") {
      return "Underlay includes moisture control";
    }
    if (portion.laminate_moisture === "separate") return "Separate moisture barrier";
    if (portion.laminate_moisture === "excluded") return "Moisture control excluded";
    return null;
  }
  if (field === "laminate_package_covers_underlay") {
    if (portion.laminate_package_covers_underlay === "included") {
      return "Package rate covers the underlay";
    }
    if (portion.laminate_package_covers_underlay === "separate") {
      return "Charge the underlay separately";
    }
    return null;
  }
  if (field === "laminate_package_covers_moisture") {
    if (portion.laminate_package_covers_moisture === "included") {
      return "Package rate covers the moisture barrier";
    }
    if (portion.laminate_package_covers_moisture === "separate") {
      return "Charge the moisture barrier separately";
    }
    return null;
  }
  if (field === "carpet_tile_pattern") {
    if (portion.carpet_tile_pattern === "straight") return "Straight lay";
    if (portion.carpet_tile_pattern === "other") return "Another pattern";
    return null;
  }
  if (field === "carpet_tile_substrate") {
    if (portion.carpet_tile_substrate === "ready") return "Ready substrate";
    if (portion.carpet_tile_substrate === "preparation") return "Needs preparation";
    if (portion.carpet_tile_substrate === "other") return "Other substrate";
    return null;
  }
  if (field === "carpet_tile_waste") {
    if (portion.carpet_tile_waste === "proposed") return "Use proposed 5% supply allowance";
    if (portion.carpet_tile_waste === "zero") return "No waste";
    if (portion.carpet_tile_waste === "custom") return "Enter a percentage";
    if (portion.carpet_tile_waste === "stated") return "Waste percentage is already stated";
    return null;
  }
  if (field === "carpet_tile_waste_percent") return portion.waste_percent ?? null;
  if (field === "carpet_tile_size") {
    if (portion.carpet_tile_size === "unknown") return "Size unknown";
    if (portion.carpet_tile_size === "known") return "Size is known";
    return null;
  }
  if (field === "carpet_tile_box") {
    if (portion.carpet_tile_box === "unknown") return "Box coverage unknown";
    if (portion.carpet_tile_box === "known") return "Box coverage is known";
    return null;
  }
  if (field === "carpet_tile_box_coverage_m2") return portion.carpet_tile_box_coverage_m2 ?? null;
  if (field === "carpet_tile_fixing") {
    if (portion.carpet_tile_fixing === "adhesive") return "Pressure-sensitive adhesive";
    if (portion.carpet_tile_fixing === "tackifier") return "Tackifier";
    if (portion.carpet_tile_fixing === "none") return "No fixing material";
    if (portion.carpet_tile_fixing === "other") return "Another fixing system";
    return null;
  }
  if (field === "carpet_tile_supply") {
    if (portion.finish_supplied_by === "customer") return "Customer supplies the tiles";
    if (portion.finish_supplied_by === "contractor") return "Company supplies the tiles";
    return null;
  }
  if (field === "carpet_tile_package_covers_fixing") {
    if (portion.carpet_tile_package_covers_fixing === "included") {
      return "Package rate covers the fixing";
    }
    if (portion.carpet_tile_package_covers_fixing === "separate") {
      return "Charge the fixing separately";
    }
    return null;
  }
  if (field === "waste_treatment") {
    if (portion.waste_treatment === "package_covers_requested_waste") {
      return "Package rate covers the requested waste";
    }
    if (portion.waste_treatment === "incremental_material") {
      return "Charge only the extra waste quantity";
    }
    return null;
  }
  if (field === "tile_width_mm") {
    return portion.tile_width_mm != null ? `${portion.tile_width_mm} mm` : null;
  }
  if (field === "tile_length_mm") {
    return portion.tile_length_mm != null ? `${portion.tile_length_mm} mm` : null;
  }
  if (field === "hardwood_board_width_mm") {
    return portion.hardwood_board_width_mm != null
      ? `${portion.hardwood_board_width_mm} mm`
      : null;
  }
  if (field === "other_description") return portion.other_description;
  if (field === "substrate_required") return yesNo(portion.substrate_required);
  if (field === "substrate_family") {
    if (portion.substrate_family === "particleboard") return "Particleboard";
    if (portion.substrate_family === "structural_plywood") return "Plywood";
    if (portion.substrate_family === "fibre_cement") return "Fibre cement";
    if (portion.substrate_family === "secura") return "Secura";
    if (portion.substrate_family === "other") return "Other / custom";
    return null;
  }
  if (field === "substrate_item_key") {
    if (!portion.substrate_item_key) return null;
    return (
      FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[portion.substrate_item_key] ??
      portion.substrate_item_key
    );
  }
  if (field === "framing_required") return yesNo(portion.framing_required);
  if (field === "framing_allowance_level") {
    if (portion.framing_allowance_level === "minor") return "Minor";
    if (portion.framing_allowance_level === "standard") return "Standard";
    if (portion.framing_allowance_level === "major") return "Major";
    return null;
  }
  if (field === "finish_removal_required") {
    return yesNo(portion.finish_removal_required);
  }
  if (field === "existing_finish_type") {
    if (portion.existing_finish_type === "carpet") return "Carpet";
    if (portion.existing_finish_type === "vinyl") return "Vinyl";
    if (portion.existing_finish_type === "tile") return "Tile";
    if (portion.existing_finish_type === "hardwood") return "Hardwood";
    if (portion.existing_finish_type === "other") return "Other";
    return null;
  }
  if (field === "substrate_removal_required") {
    return yesNo(portion.substrate_removal_required);
  }
  return null;
}

function portionDisplayName(portion: FlooringPortion, index: number): string {
  if (portion.label?.trim()) return portion.label.trim();
  return `Flooring area ${index + 1}`;
}

function knownArea(portion: FlooringPortion): boolean {
  if (portion.area_m2 != null && portion.area_m2 > 0) return true;
  return (
    portion.length_m != null &&
    portion.length_m > 0 &&
    portion.width_m != null &&
    portion.width_m > 0
  );
}

export function flooringPortionIsInformationComplete(
  portion: FlooringPortion
): boolean {
  if (!knownArea(portion)) return false;
  if (portion.specialist_kind === "laminate") {
    if (!portion.other_description?.trim()) return false;
    if (portion.laminate_method == null) return false;
    if (portion.laminate_method !== "floating_click_lock") return true;
    if (portion.laminate_substrate == null) return false;
    if (
      portion.laminate_substrate === "concrete" &&
      portion.laminate_moisture == null
    ) {
      return false;
    }
    if (portion.finish_pricing == null) return false;
    if (
      portion.finish_pricing === "combined_package" &&
      portion.finish_supplied_by !== "customer" &&
      portion.waste_percent != null &&
      portion.waste_percent > 0 &&
      portion.waste_treatment == null
    ) {
      return false;
    }
    if (
      portion.finish_pricing === "combined_package" &&
      portion.finish_supplied_by !== "customer" &&
      portion.underlay_required === true &&
      portion.laminate_package_covers_underlay == null
    ) {
      return false;
    }
    if (
      portion.finish_pricing === "combined_package" &&
      portion.finish_supplied_by !== "customer" &&
      portion.laminate_substrate === "concrete" &&
      portion.laminate_moisture === "separate" &&
      portion.laminate_package_covers_moisture == null
    ) {
      return false;
    }
    return true;
  }
  if (portion.specialist_kind === "carpet_tile") {
    if (!portion.other_description?.trim()) return false;
    const area = portion.area_m2 && portion.area_m2 > 0 ? portion.area_m2 : 1;
    return planCarpetTileAssembly({ portion, netM2: area, owner: portion.label ?? "Floor" }).status !== "needs_answers";
  }
  if (flooringPortionIsSpecialist(portion)) {
    return Boolean(portion.other_description?.trim());
  }
  if (portion.finish_type == null) return false;
  if (portion.finish_type === "carpet" && portion.underlay_required == null) {
    return false;
  }
  if (
    (portion.finish_type === "vinyl_plank" || portion.finish_type === "tile") &&
    portion.floor_preparation_required == null
  ) {
    return false;
  }
  if (portion.finish_type === "tile") {
    if (portion.tile_width_mm == null || portion.tile_length_mm == null) {
      return false;
    }
  }
  if (
    portion.finish_type === "hardwood" &&
    portion.hardwood_board_width_mm == null
  ) {
    return false;
  }
  if (portion.finish_type === "other" && !portion.other_description?.trim()) {
    return false;
  }
  if (portion.substrate_required == null) return false;
  if (portion.substrate_required === true) {
    if (portion.substrate_family == null) return false;
    if (!portion.substrate_item_key) return false;
  }
  if (portion.framing_required == null) return false;
  if (
    portion.framing_required === true &&
    portion.framing_allowance_level == null
  ) {
    return false;
  }
  if (portion.finish_removal_required == null) return false;
  if (portion.finish_removal_required === true) {
    if (portion.existing_finish_type == null) return false;
    if (portion.substrate_removal_required == null) return false;
  }
  return true;
}

function missingDetailLanguage(portion: FlooringPortion): string[] {
  const missing: string[] = [];
  if (portion.finish_type == null && !flooringPortionIsSpecialist(portion)) {
    missing.push("Flooring type needed");
  }
  if (!knownArea(portion)) missing.push("Area needed");
  if (portion.finish_type === "carpet" && portion.underlay_required == null) {
    missing.push("Underlay unanswered");
  }
  if (
    (portion.finish_type === "vinyl_plank" || portion.finish_type === "tile") &&
    portion.floor_preparation_required == null
  ) {
    missing.push("Floor preparation unanswered");
  }
  if (
    portion.finish_type === "tile" &&
    (portion.tile_width_mm == null || portion.tile_length_mm == null)
  ) {
    missing.push("Tile size needed");
  }
  if (
    portion.finish_type === "hardwood" &&
    portion.hardwood_board_width_mm == null
  ) {
    missing.push("Board width needed");
  }
  if (
    (portion.finish_type === "other" || flooringPortionIsSpecialist(portion)) &&
    !portion.other_description?.trim()
  ) {
    missing.push("Description needed");
  }
  if (
    !flooringPortionIsSpecialist(portion) &&
    portion.substrate_required == null
  ) {
    missing.push("Substrate unanswered");
  }
  if (
    !flooringPortionIsSpecialist(portion) &&
    portion.framing_required == null
  ) {
    missing.push("Framing unanswered");
  }
  if (
    !flooringPortionIsSpecialist(portion) &&
    portion.finish_removal_required == null
  ) {
    missing.push("Removal unanswered");
  }
  return missing;
}

function chosenAreaCopy(portion: FlooringPortion): string | null {
  const measured = flooringMeasuredAreaM2(portion);
  const stated = portion.area_m2;
  const differs =
    measured != null &&
    stated != null &&
    stated > 0 &&
    Math.abs(measured - stated) > Math.max(0.05, measured * 0.005);
  if (portion.area_input_method === "length_width" && measured != null) {
    const chosen = `${portion.length_m} × ${portion.width_m} m measures ${formatFlooringM2(measured)}`;
    return differs ? `${chosen}; stated ${formatFlooringM2(stated!)} kept` : chosen;
  }
  if (portion.area_input_method === "direct_m2" && stated != null) {
    const chosen = formatFlooringM2(stated);
    return differs && portion.length_m != null && portion.width_m != null
      ? `${chosen} stated; ${portion.length_m} × ${portion.width_m} m measures ${formatFlooringM2(measured!)} kept`
      : chosen;
  }
  return null;
}

export function summariseFlooringPortion(
  portion: FlooringPortion,
  index: number
): {
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly complete: boolean;
  readonly specialistRequired: boolean;
} {
  const displayName = portionDisplayName(portion, index);
  const specialist = flooringPortionIsSpecialist(portion);
  const complete = flooringPortionIsInformationComplete(portion);
  if (specialist) {
    const desc = portion.other_description?.trim() || "Specialist flooring";
    const conflict = flooringAreaMeasuresDisagree(portion)
      ? flooringAreaConflictCopy(portion)
      : null;
    const area =
      conflict ??
      chosenAreaCopy(portion) ??
      (portion.area_m2 != null ? `${portion.area_m2} m²` : "area unanswered");
    return {
      id: portion.id,
      displayName,
      summary: [displayName, area, desc].join(" · "),
      complete,
      specialistRequired: true,
    };
  }
  const finish = finishDisplay(portion.finish_type) ?? "finish unanswered";
  const conflict = flooringAreaMeasuresDisagree(portion)
    ? flooringAreaConflictCopy(portion)
    : null;
  const area =
    conflict ??
    chosenAreaCopy(portion) ??
    (portion.area_m2 != null
      ? `${portion.area_m2} m²`
      : portion.length_m != null && portion.width_m != null
        ? `${portion.length_m} × ${portion.width_m} m`
        : null);
  const extras: string[] = [];
  if (portion.finish_type === "carpet" && portion.underlay_required === true) {
    extras.push("Underlay included");
  }
  if (portion.finish_type === "carpet" && portion.underlay_required === false) {
    extras.push("No underlay");
  }
  if (portion.finish_removal_required === true) {
    extras.push(
      portion.existing_finish_type
        ? `Remove existing ${portion.existing_finish_type.replace(/_/g, " ")}`
        : "Remove existing flooring"
    );
  }
  if (portion.waste_percent != null && portion.waste_percent > 0) {
    extras.push(`${portion.waste_percent}% waste on finish supply`);
  }
  if (portion.transitions_required === true) {
    extras.push("Transition strips requested, unpriced");
  }
  if (portion.skirting_replacement_excluded === true) {
    extras.push("Skirting replacement excluded");
  }
  if (portion.framing_required === false) {
    extras.push("Major subfloor repairs excluded");
  }
  if (
    (portion.finish_type === "vinyl_plank" || portion.finish_type === "tile") &&
    portion.floor_preparation_required === true
  ) {
    extras.push("Floor preparation included");
  }
  if (
    portion.finish_type === "tile" &&
    portion.tile_width_mm != null &&
    portion.tile_length_mm != null
  ) {
    extras.push(`${portion.tile_width_mm} × ${portion.tile_length_mm} mm`);
  }
  if (
    portion.finish_type === "hardwood" &&
    portion.hardwood_board_width_mm != null
  ) {
    extras.push(`${portion.hardwood_board_width_mm} mm boards`);
  }
  const core = [displayName, area, finish].filter(Boolean).join(" · ");
  const missing = complete ? [] : missingDetailLanguage(portion);
  return {
    id: portion.id,
    displayName,
    summary: [...(core ? [core] : []), ...extras, ...missing]
      .filter(Boolean)
      .join(" · "),
    complete,
    specialistRequired: portion.finish_type === "other",
  };
}

function buildCandidate(params: {
  input: FlooringClarifyInput;
  portion: FlooringPortion | null;
  portionIndex: number;
  factKey: string;
  askClass: ClarifyAskClass;
}): ClarifyCandidate {
  const displayName = params.portion
    ? portionDisplayName(params.portion, params.portionIndex)
    : params.input.workAreaName;
  const currentValue = flooringPortionFieldCurrentValue(
    params.portion,
    params.factKey
  );
  const rankBase =
    params.askClass === "HARD_MINIMUM"
      ? 1000
      : params.askClass === "ASK_NOW"
        ? 80
        : 40;
  const contractIndex = FLOORING_INFORMATION_CONTRACT.findIndex(
    (row) => row.factKey === params.factKey
  );
  return {
    id:
      questionPresentationId(
        params.askClass === "HARD_MINIMUM" ? "hard" : "fact",
        flooringPortionQuestionIdentity({
          workAreaId: params.input.workAreaId,
          factKey: params.factKey,
          nestedItemId: params.portion?.id,
        })
      ) ??
      `${params.askClass === "HARD_MINIMUM" ? "hard" : "fact"}:${params.input.workAreaId}:${params.factKey}`,
    source: "scope_fact",
    workAreaId: params.input.workAreaId,
    workAreaName: params.input.workAreaName,
    workAreaType: "flooring",
    factKey: params.factKey,
    constraintKey: null,
    questionKey: params.factKey,
    label: params.portion
      ? `${displayName} · ${flooringQuestionLabel(params.factKey) ?? safeFactPresentationLabel(params.factKey)}`
      : flooringQuestionLabel(params.factKey) ??
        safeFactPresentationLabel(params.factKey),
    question: flooringQuestionCopy(params.factKey, params.portion),
    askClass: params.askClass,
    inputType: flooringQuestionInputType(params.factKey, params.portion),
    unit: flooringQuestionUnit(params.factKey),
    options: flooringQuestionOptions(params.factKey, params.portion),
    currentValue,
    writeTarget: "FACT",
    write: null,
    blocksEstimate: params.askClass === "HARD_MINIMUM",
    assumable: params.askClass === "ASSUME_IF_SKIPPED",
    rankScore: rankBase - contractIndex,
    rankReason: `${params.askClass} · flooring contract`,
    assumptionStatement: null,
    nestedItemId: params.portion?.id ?? null,
  };
}

export function flooringNestedFactCurrentValue(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly factKey: string;
  readonly nestedItemId?: string | null;
}): string | number | boolean | null {
  if (!isFlooringNestedFactKey(params.factKey)) return null;
  const resolved = resolveFlooringPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  const portion =
    findFlooringPortion(resolved.portions, params.nestedItemId) ??
    resolved.portions[0] ??
    null;
  return flooringPortionFieldCurrentValue(portion, params.factKey);
}

export function listFlooringClarifyCandidates(
  input: FlooringClarifyInput
): ClarifyCandidate[] {
  const resolved = resolveFlooringPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  const ctx: Omit<FlooringInformationContext, "portion" | "nestedItemId"> = {
    facts: input.facts,
    workAreaId: input.workAreaId,
  };
  const portions = resolved.portions.length > 0 ? resolved.portions : [null];
  const out: ClarifyCandidate[] = [];
  portions.forEach((portion, index) => {
    for (const row of FLOORING_INFORMATION_CONTRACT) {
      if (row.askClass === "DERIVED_NEVER_ASK") continue;
      if (row.askClass === "REFINEMENT" || row.askClass === "ADVANCED") {
        continue;
      }
      if (
        !flooringFactIsRelevant(row.factKey, {
          ...ctx,
          portion,
          nestedItemId: portion?.id ?? null,
        })
      ) {
        continue;
      }
      if (isResolved(flooringPortionFieldCurrentValue(portion, row.factKey))) {
        continue;
      }
      const laminateChoice =
        (portion?.specialist_kind === "laminate" ||
          portion?.specialist_kind === "carpet_tile") &&
        (row.factKey === "flooring.portion.finish_pricing" ||
          row.factKey === "flooring.portion.waste_treatment" ||
          row.factKey === "flooring.portion.laminate_package_covers_underlay" ||
          row.factKey === "flooring.portion.laminate_package_covers_moisture" ||
          row.factKey.startsWith("flooring.portion.carpet_tile_"));
      out.push(
        buildCandidate({
          input,
          portion,
          portionIndex: index,
          factKey: row.factKey,
          askClass: laminateChoice ? "HARD_MINIMUM" : row.askClass,
        })
      );
    }
  });
  return out;
}

export function flooringWorkAreaIsReady(input: FlooringClarifyInput): boolean {
  const resolved = resolveFlooringPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  if (resolved.portions.length === 0) return false;
  return resolved.portions.every(flooringPortionIsInformationComplete);
}

export function flooringNestedItemPanel(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaName: string;
}): NestedItemPanel | null {
  if (!hasFlooringPortionsFact(params.facts, params.workAreaId)) return null;
  const resolved = resolveFlooringPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  return {
    workAreaId: params.workAreaId,
    workAreaType: "flooring",
    workAreaName: params.workAreaName,
    itemKindLabel: "Flooring area",
    items: resolved.portions.map((portion, index) => {
      const summary = summariseFlooringPortion(portion, index);
      return {
        id: portion.id,
        label: summary.displayName,
        complete: summary.complete,
        summary: summary.summary,
        specialistRequired: summary.specialistRequired,
      };
    }),
    addKey: FLOORING_ADD_PORTION_KEY,
    duplicateKey: FLOORING_DUPLICATE_PORTION_KEY,
    deleteKey: FLOORING_DELETE_PORTION_KEY,
  };
}

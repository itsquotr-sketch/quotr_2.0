/**
 * FLOORING-03 — nested Flooring Area physical requirement kernel.
 *
 * Consumes canonical `flooring.portions`. Emits per-Area packages, add-ons,
 * substrate sheets, framing allowances, and labour-operation bases.
 * No COST rates or sell. Finish waste is a supply quantity only.
 * Nested collections never call the legacy Flooring lump calculator.
 */

import { formatMissing, round2 } from "@/lib/estimate/facts";
import {
  FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
  FLOORING_LAMINATE_PACKAGE_M2,
  planLaminateAssembly,
} from "@/lib/estimate/flooring-laminate";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_CUSTOM_REMOVAL_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_LABOURER_LABOUR_RATE_KEY,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
  FLOORING_SUBSTRATE_REMOVE_LABOUR,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  flooringFinishPackageKey,
  flooringFinishRemovalHoursKey,
  flooringFinishRemovalLabourComponent,
  flooringFramingAllowanceKey,
  flooringSubstrateSheetCoverageM2,
} from "@/lib/estimate/flooring-identities";
import {
  flooringPortionIsSpecialist,
} from "@/lib/estimate/flooring-information-contract";
import {
  FLOORING_PORTIONS_FACT_KEY,
  flooringAreaMeasuresDisagree,
  hasFlooringPortionsFact,
  resolveFlooringPortions,
  type FlooringExistingFinishType,
  type FlooringFinishType,
  type FlooringFramingAllowanceLevel,
  type FlooringPortion,
  type FlooringSpecialistKind,
} from "@/lib/estimate/flooring-portions";
import {
  FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY,
  flooringQuestionLabel,
} from "@/lib/estimate/flooring-question-copy";
import {
  flooringAncillaryLabel,
  flooringAncillaryMaterialKey,
  flooringAncillarySpecification,
} from "@/lib/estimate/flooring-cost-ownership";
import {
  FLOORING_CARPET_PURCHASING_UNRESOLVED,
  FLOORING_FINISH_ANCILLARY_COMPONENT,
  FLOORING_FINISH_INSTALL_COMPONENT,
  FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  FLOORING_FINISH_SUPPLY_COMPONENT,
  FLOORING_FINISH_WASTE_COMPONENT,
  FLOORING_HARDWOOD_SUPPLY_LM,
  FLOORING_TILE_SUPPLY_EACH,
  FLOORING_VINYL_SUPPLY_M2,
  FLOORING_WASTE_INCREMENT_CATEGORY,
  FLOORING_WASTE_UNRESOLVED_CATEGORY,
  flooringCustomerSupplied,
  flooringSeparateSupplyMeasure,
  flooringWasteExtra,
  resolveFlooringSupply,
  type FlooringSupplyMeasure,
} from "@/lib/estimate/flooring-purchasing";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { buildSubcontractRequirement } from "@/lib/estimate/subcontract-requirement";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  RequirementAssumption,
  RequirementProvenance,
  SubcontractRequirement,
} from "@/lib/estimate/requirements";
import type { EstimateFact, EstimateWorkArea } from "@/lib/estimate/types";

export const FLOORING_PHYSICAL_COMPLETENESS = {
  COMPLETE_PHYSICAL: "COMPLETE_PHYSICAL",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type FlooringPhysicalCompleteness =
  (typeof FLOORING_PHYSICAL_COMPLETENESS)[keyof typeof FLOORING_PHYSICAL_COMPLETENESS];

export type FlooringPhysicalSource = "canonical" | "empty" | "legacy_skipped";

export const FLOORING_NESTED_NOT_YET_PRICED_STATEMENT =
  "Nested Flooring physical quantities are not yet commercially priced." as const;

export const FLOORING_PRODUCTIVITY_UNRESOLVED_STATEMENT =
  "Productivity hours are unresolved. hoursPerUnit 0 is a shared-type placeholder, not a valid zero-hour labour quantity. FLOORING-04 must supply productivity authority." as const;

const CALCULATOR_SOURCE = "flooring-physical" as const;
const SHEET_COUNT_EPSILON = 1e-12;

const SPECIALIST_KIND_LABELS: Record<FlooringSpecialistKind, string> = {
  laminate: "laminate",
  engineered_timber: "engineered timber",
  sheet_vinyl: "sheet vinyl",
  client_supplied: "client-supplied flooring",
  stairs_landings: "stairs/landings",
  waterproofing: "waterproofing",
  structural: "structural flooring",
  other_unsupported: "specialist flooring",
};

export type FlooringTileTakeoff = {
  readonly tileWidthMm: number;
  readonly tileLengthMm: number;
  readonly tileAreaM2: number;
  readonly rawTileCount: number;
  readonly wholeTileCount: number;
};

export type FlooringHardwoodTakeoff = {
  readonly boardWidthMm: number;
  readonly linealM: number;
};

export type FlooringSubstrateTakeoff = {
  readonly itemKey: string;
  readonly sheetCoverageM2: number;
  readonly sheetCount: number;
};

export type FlooringPortionPhysical = {
  readonly workAreaId: string;
  readonly nestedItemId: string;
  readonly label: string | null;
  readonly finish_type: FlooringFinishType | null;
  readonly area_input_method: FlooringPortion["area_input_method"];
  readonly physicalNetAreaM2: number | null;
  readonly tile: FlooringTileTakeoff | null;
  readonly hardwood: FlooringHardwoodTakeoff | null;
  readonly substrate: FlooringSubstrateTakeoff | null;
  readonly underlay_required: boolean | null;
  readonly floor_preparation_required: boolean | null;
  readonly substrate_required: boolean | null;
  readonly framing_allowance_level: FlooringFramingAllowanceLevel | null;
  readonly finish_removal_required: boolean | null;
  readonly existing_finish_type: FlooringExistingFinishType | null;
  readonly substrate_removal_required: boolean | null;
  readonly other_description: string | null;
  readonly specialist_kind: FlooringSpecialistKind | null;
  readonly finish_pricing: FlooringPortion["finish_pricing"];
  readonly finish_supplied_by: FlooringPortion["finish_supplied_by"];
  readonly waste_treatment: FlooringPortion["waste_treatment"];
  readonly purchasing: FlooringSupplyMeasure | null;
  readonly completeness: FlooringPhysicalCompleteness;
  readonly missingFields: readonly string[];
  readonly summary: string;
};

export type FlooringPhysicalResult = {
  readonly workAreaId: string;
  readonly source: FlooringPhysicalSource;
  readonly completeness: FlooringPhysicalCompleteness | "empty";
  readonly portions: readonly FlooringPortionPhysical[];
  readonly requirements: readonly EstimateRequirement[];
  readonly missingInfo: readonly string[];
  readonly assumptions: readonly string[];
};

function provenance(): RequirementProvenance {
  return {
    calculatorSource: CALCULATOR_SOURCE,
    factKeys: [FLOORING_PORTIONS_FACT_KEY],
    constraintKeys: [],
  };
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * One canonical physical net area for every requirement on a Flooring Area.
 * Direct area uses entered m². Length/width uses L × W. No waste, openings,
 * defaults, product dimensions, or stale inactive-method values.
 */
export function physicalNetAreaM2(portion: FlooringPortion): number | null {
  if (flooringAreaMeasuresDisagree(portion)) return null;
  if (portion.area_input_method === "length_width") {
    if (isPositiveFinite(portion.length_m) && isPositiveFinite(portion.width_m)) {
      return portion.length_m * portion.width_m;
    }
    return null;
  }
  if (portion.area_input_method === "direct_m2") {
    return isPositiveFinite(portion.area_m2) ? portion.area_m2 : null;
  }
  return null;
}

export function flooringTileTakeoff(
  areaM2: number,
  tileWidthMm: number,
  tileLengthMm: number
): FlooringTileTakeoff | null {
  if (
    !isPositiveFinite(areaM2) ||
    !isPositiveFinite(tileWidthMm) ||
    !isPositiveFinite(tileLengthMm)
  ) {
    return null;
  }
  const tileAreaM2 = (tileWidthMm * tileLengthMm) / 1_000_000;
  if (!isPositiveFinite(tileAreaM2)) return null;
  const rawTileCount = areaM2 / tileAreaM2;
  const wholeTileCount = Math.ceil(rawTileCount - SHEET_COUNT_EPSILON);
  return {
    tileWidthMm,
    tileLengthMm,
    tileAreaM2,
    rawTileCount,
    wholeTileCount,
  };
}

export function flooringHardwoodTakeoff(
  areaM2: number,
  boardWidthMm: number
): FlooringHardwoodTakeoff | null {
  if (!isPositiveFinite(areaM2) || !isPositiveFinite(boardWidthMm)) return null;
  const boardWidthM = boardWidthMm / 1000;
  return {
    boardWidthMm,
    linealM: areaM2 / boardWidthM,
  };
}

export function flooringSubstrateSheetCount(
  areaM2: number,
  sheetCoverageM2: number
): number {
  return Math.ceil(areaM2 / sheetCoverageM2 - SHEET_COUNT_EPSILON);
}

export function presentFlooringAreaM2(value: number): string {
  const rounded = round2(value);
  return Number.isInteger(rounded)
    ? `${rounded.toFixed(1)} m²`
    : `${rounded} m²`;
}

function portionDisplayName(portion: FlooringPortion): string {
  const label = portion.label?.trim();
  return label ? label : "Flooring Area";
}

function specialistPhrase(portion: FlooringPortion): string {
  const fromKind = portion.specialist_kind
    ? SPECIALIST_KIND_LABELS[portion.specialist_kind]
    : null;
  const fromDesc = portion.other_description?.trim() || null;
  if (fromDesc && fromKind && !fromDesc.toLowerCase().includes(fromKind)) {
    return `${fromKind} ${fromDesc}`;
  }
  return fromDesc || fromKind || "specialist flooring";
}

function finishPhrase(finish: FlooringFinishType | null): string {
  if (finish === "carpet") return "carpet";
  if (finish === "vinyl_plank") return "vinyl plank/LVT";
  if (finish === "tile") return "tile";
  if (finish === "hardwood") return "hardwood/timber";
  if (finish === "other") return "custom flooring";
  return "flooring";
}

function statedFlooringExtras(portion: FlooringPortion): string {
  const notes: string[] = [];
  if (portion.waste_percent != null && portion.waste_percent > 0) {
    notes.push(`${portion.waste_percent}% waste on finish supply`);
  }
  if (portion.transitions_required === true) {
    notes.push("transition strips requested, unpriced");
  }
  return notes.length > 0 ? ` · ${notes.join(" · ")}` : "";
}

export function summariseFlooringPhysicalPortion(
  portion: FlooringPortion
): string {
  const label = portion.label?.trim() || null;
  const area = physicalNetAreaM2(portion);
  const areaText = area != null ? presentFlooringAreaM2(area) : "area unanswered";
  if (flooringPortionIsSpecialist(portion)) {
    const core = `${areaText} ${specialistPhrase(portion)} · specialist pricing required${statedFlooringExtras(portion)}`;
    return label ? `${label} · ${core}` : core;
  }
  if (portion.finish_type === "other") {
    const desc = portion.other_description?.trim() || "custom flooring";
    const core = `${areaText} ${desc}${statedFlooringExtras(portion)}`;
    return label ? `${label} · ${core}` : core;
  }
  const extras: string[] = [];
  if (portion.finish_type === "carpet" && portion.underlay_required === true) {
    extras.push("underlay");
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
  const core = [areaText, finishPhrase(portion.finish_type), ...extras]
    .filter(Boolean)
    .join(" ");
  const withExtras = `${core}${statedFlooringExtras(portion)}`;
  return label ? `${label} · ${withExtras}` : withExtras;
}

function missingInfoLine(portion: FlooringPortion, fieldKey: string): string {
  const label = flooringQuestionLabel(fieldKey) ?? fieldKey;
  return `${portionDisplayName(portion)}: ${formatMissing(label)}`;
}

function ordinaryMissingFields(portion: FlooringPortion): string[] {
  const missing: string[] = [];
  if (portion.finish_type == null) {
    missing.push("flooring.portion.finish_type");
  }
  if (portion.area_input_method == null) {
    missing.push("flooring.portion.area_input_method");
  } else if (physicalNetAreaM2(portion) == null) {
    if (portion.area_input_method === "length_width") {
      if (!isPositiveFinite(portion.length_m)) {
        missing.push("flooring.portion.length_m");
      }
      if (!isPositiveFinite(portion.width_m)) {
        missing.push("flooring.portion.width_m");
      }
    } else {
      missing.push("flooring.portion.area_m2");
    }
  }
  if (portion.finish_type === "carpet" && portion.underlay_required == null) {
    missing.push("flooring.portion.underlay_required");
  }
  if (
    (portion.finish_type === "vinyl_plank" || portion.finish_type === "tile") &&
    portion.floor_preparation_required == null
  ) {
    missing.push("flooring.portion.floor_preparation_required");
  }
  if (portion.finish_type === "tile") {
    if (!isPositiveFinite(portion.tile_width_mm)) {
      missing.push("flooring.portion.tile_width_mm");
    }
    if (!isPositiveFinite(portion.tile_length_mm)) {
      missing.push("flooring.portion.tile_length_mm");
    }
  }
  if (
    portion.finish_type === "hardwood" &&
    !isPositiveFinite(portion.hardwood_board_width_mm)
  ) {
    missing.push("flooring.portion.hardwood_board_width_mm");
  }
  if (portion.substrate_required == null) {
    missing.push("flooring.portion.substrate_required");
  }
  if (portion.substrate_required === true) {
    if (portion.substrate_family == null) {
      missing.push("flooring.portion.substrate_family");
    }
    if (
      !portion.substrate_item_key ||
      flooringSubstrateSheetCoverageM2(portion.substrate_item_key) == null
    ) {
      missing.push("flooring.portion.substrate_item_key");
    }
  }
  if (portion.framing_required == null) {
    missing.push("flooring.portion.framing_required");
  }
  if (
    portion.framing_required === true &&
    portion.framing_allowance_level == null
  ) {
    missing.push("flooring.portion.framing_allowance_level");
  }
  if (portion.finish_removal_required == null) {
    missing.push("flooring.portion.finish_removal_required");
  }
  if (portion.finish_removal_required === true) {
    if (portion.existing_finish_type == null) {
      missing.push("flooring.portion.existing_finish_type");
    }
    if (portion.substrate_removal_required == null) {
      missing.push("flooring.portion.substrate_removal_required");
    }
  }
  return missing;
}

function customOrdinaryMissingFields(portion: FlooringPortion): string[] {
  const missing: string[] = [];
  if (!portion.other_description?.trim()) {
    missing.push("flooring.portion.other_description");
  }
  if (portion.area_input_method == null) {
    missing.push("flooring.portion.area_input_method");
  } else if (physicalNetAreaM2(portion) == null) {
    if (portion.area_input_method === "length_width") {
      if (!isPositiveFinite(portion.length_m)) {
        missing.push("flooring.portion.length_m");
      }
      if (!isPositiveFinite(portion.width_m)) {
        missing.push("flooring.portion.width_m");
      }
    } else {
      missing.push("flooring.portion.area_m2");
    }
  }
  if (portion.substrate_required == null) {
    missing.push("flooring.portion.substrate_required");
  }
  if (portion.substrate_required === true) {
    if (portion.substrate_family == null) {
      missing.push("flooring.portion.substrate_family");
    }
    if (
      !portion.substrate_item_key ||
      flooringSubstrateSheetCoverageM2(portion.substrate_item_key) == null
    ) {
      missing.push("flooring.portion.substrate_item_key");
    }
  }
  if (portion.framing_required == null) {
    missing.push("flooring.portion.framing_required");
  }
  if (
    portion.framing_required === true &&
    portion.framing_allowance_level == null
  ) {
    missing.push("flooring.portion.framing_allowance_level");
  }
  if (portion.finish_removal_required == null) {
    missing.push("flooring.portion.finish_removal_required");
  }
  if (portion.finish_removal_required === true) {
    if (portion.existing_finish_type == null) {
      missing.push("flooring.portion.existing_finish_type");
    }
    if (portion.substrate_removal_required == null) {
      missing.push("flooring.portion.substrate_removal_required");
    }
  }
  return missing;
}

function specialistMissingFields(portion: FlooringPortion): string[] {
  const missing: string[] = [];
  if (physicalNetAreaM2(portion) == null) {
    if (portion.area_input_method === "length_width") {
      if (!isPositiveFinite(portion.length_m)) {
        missing.push("flooring.portion.length_m");
      }
      if (!isPositiveFinite(portion.width_m)) {
        missing.push("flooring.portion.width_m");
      }
    } else if (portion.area_input_method === "direct_m2") {
      missing.push("flooring.portion.area_m2");
    } else {
      missing.push("flooring.portion.area_input_method");
    }
  }
  if (!portion.other_description?.trim()) {
    missing.push("flooring.portion.other_description");
  }
  return missing;
}

function areaAssumptions(
  portion: FlooringPortion,
  areaM2: number
): RequirementAssumption[] {
  const rows: RequirementAssumption[] = [
    {
      key: "physical_net_area_m2",
      text: `Physical net area ${presentFlooringAreaM2(areaM2)}. No waste, openings, or defaults applied.`,
      source: "user_confirmed",
    },
  ];
  if (portion.label?.trim()) {
    rows.push({
      key: "flooring_area_label",
      text: portion.label.trim(),
      source: "user_confirmed",
    });
  }
  if (portion.area_input_method === "length_width") {
    rows.push({
      key: "area_input_method",
      text: `Length ${portion.length_m} m × width ${portion.width_m} m.`,
      source: "user_confirmed",
    });
  } else if (portion.area_input_method === "direct_m2") {
    rows.push({
      key: "area_input_method",
      text: "Direct entered floor area.",
      source: "user_confirmed",
    });
  }
  return rows;
}

function packageRow(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  componentKey: string;
  description: string;
  specification: string;
  areaM2: number;
  extraAssumptions?: readonly RequirementAssumption[];
  confidence?: MaterialRequirement["confidence"];
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "flooring",
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: params.confidence ?? "high",
    assumptions: [
      ...areaAssumptions(params.portion, params.areaM2),
      ...(params.extraAssumptions ?? []),
    ],
    provenance: provenance(),
    priced: false,
    materialKey: params.componentKey,
    category: "FLOORING_PACKAGE",
    specification: params.specification,
    baseQuantity: params.areaM2,
    baseUnit: "m2",
    wasteFactor: 0,
    purchaseQuantity: params.areaM2,
    purchaseUnit: "m2",
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

function subcontractRow(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  componentKey: string;
  description: string;
  areaM2: number;
  extraAssumptions?: readonly RequirementAssumption[];
}): SubcontractRequirement {
  return buildSubcontractRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "flooring",
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: "high",
    assumptions: [
      ...areaAssumptions(params.portion, params.areaM2),
      ...(params.extraAssumptions ?? []),
    ],
    provenance: provenance(),
    priced: false,
    trade: "flooring",
    allowanceCost: null,
    quotedCost: null,
    totalCost: null,
  });
}

function materialCountRow(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  componentKey: string;
  materialKey: string | null;
  category: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  areaM2: number;
  extraAssumptions?: readonly RequirementAssumption[];
  confidence?: MaterialRequirement["confidence"];
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "flooring",
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: params.confidence ?? "high",
    assumptions: [
      ...areaAssumptions(params.portion, params.areaM2),
      ...(params.extraAssumptions ?? []),
    ],
    provenance: provenance(),
    priced: false,
    materialKey: params.materialKey,
    category: params.category,
    specification: params.specification,
    baseQuantity: params.quantity,
    baseUnit: params.unit,
    wasteFactor: 0,
    purchaseQuantity: params.quantity,
    purchaseUnit: params.unit,
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

function labourRow(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  componentKey: string;
  hoursKey: string;
  unit: string;
  description: string;
  quantity: number;
  areaM2: number;
  trade: "carpenter" | "labourer";
  extraAssumptions?: readonly RequirementAssumption[];
}): LabourRequirement {
  return buildLabourRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "flooring",
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: "medium",
    assumptions: [
      ...areaAssumptions(params.portion, params.areaM2),
      {
        key: "productivity_unresolved",
        text: FLOORING_PRODUCTIVITY_UNRESOLVED_STATEMENT,
        source: "calculator_default",
      },
      ...(params.extraAssumptions ?? []),
    ],
    provenance: provenance(),
    priced: false,
    trade: params.trade,
    baseHours: 0,
    productivityBasis: {
      key: params.hoursKey,
      hoursPerUnit: 0,
      unit: params.unit,
      quantity: params.quantity,
    },
    adjustmentRef: { factors: [] },
    adjustedHours: 0,
    rateKey:
      params.trade === "labourer"
        ? FLOORING_LABOURER_LABOUR_RATE_KEY
        : FLOORING_CARPENTER_LABOUR_RATE_KEY,
    hourlyCost: null,
    totalCost: null,
    rateProvenance: "missing",
  });
}

function preparationRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
  owner: string;
}): EstimateRequirement[] {
  const { workArea, portion, areaM2, owner } = params;
  return [
    subcontractRow({
      workArea,
      portion,
      componentKey: FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
      description: `${owner} · floor preparation allowance ${presentFlooringAreaM2(areaM2)}`,
      areaM2,
    }),
    packageRow({
      workArea,
      portion,
      componentKey: FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
      description: `${owner} · floor preparation ${presentFlooringAreaM2(areaM2)}`,
      specification:
        "Floor preparation allowance. No cartons, adhesive, or waste.",
      areaM2,
    }),
  ];
}

function finishOmitsCombinedPackage(portion: FlooringPortion): boolean {
  return (
    flooringCustomerSupplied(portion) || portion.finish_pricing === "separate_supply"
  );
}

function appendCustomerInstall(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
  owner: string;
  requirements: EstimateRequirement[];
}): boolean {
  if (!finishOmitsCombinedPackage(params.portion)) return false;
  params.requirements.push(
    labourRow({
      workArea: params.workArea,
      portion: params.portion,
      componentKey: FLOORING_FINISH_INSTALL_COMPONENT,
      hoursKey: FLOORING_FINISH_INSTALL_HOURS_PER_M2,
      unit: "m2",
      description: `${params.owner} · finish installation`,
      quantity: params.areaM2,
      areaM2: params.areaM2,
      trade: "carpenter",
    })
  );
  const ancillaryKey = flooringAncillaryMaterialKey(params.portion.finish_type);
  const ancillaryLabel = flooringAncillaryLabel(params.portion.finish_type);
  if (ancillaryKey && ancillaryLabel) {
    params.requirements.push(
      materialCountRow({
        workArea: params.workArea,
        portion: params.portion,
        componentKey: FLOORING_FINISH_ANCILLARY_COMPONENT,
        materialKey: ancillaryKey,
        category: "FLOORING_ANCILLARY",
        description: `${params.owner} · ${ancillaryLabel}`,
        specification: flooringAncillarySpecification(),
        quantity: params.areaM2,
        unit: "m2",
        areaM2: params.areaM2,
      })
    );
  }
  return true;
}

function appendWasteGap(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  owner: string;
  purchasing: FlooringSupplyMeasure;
  areaM2: number;
  requirements: EstimateRequirement[];
}): void {
  if (finishOmitsCombinedPackage(params.portion)) return;
  const waste = params.portion.waste_percent;
  if (waste == null || waste <= 0) return;
  if (params.portion.waste_treatment === "package_covers_requested_waste") return;
  const extra = flooringWasteExtra(params.purchasing);
  const incremental =
    params.portion.waste_treatment === "incremental_material" && extra != null;
  const quantity = extra?.quantity ?? 1;
  const unit = extra?.unit ?? "item";
  params.requirements.push(
    materialCountRow({
      workArea: params.workArea,
      portion: params.portion,
      componentKey: FLOORING_FINISH_WASTE_COMPONENT,
      materialKey: incremental
        ? params.portion.finish_type === "vinyl_plank"
          ? FLOORING_VINYL_SUPPLY_M2
          : params.portion.finish_type === "tile"
            ? FLOORING_TILE_SUPPLY_EACH
            : params.portion.finish_type === "hardwood"
              ? FLOORING_HARDWOOD_SUPPLY_LM
              : null
        : null,
      category: incremental
        ? FLOORING_WASTE_INCREMENT_CATEGORY
        : FLOORING_WASTE_UNRESOLVED_CATEGORY,
      description: `${params.owner} · requested finish waste`,
      specification: extra
        ? `Extra finish quantity ${quantity} ${unit} only. The combined package excludes this waste and is not increased by ${waste}%.`
        : `Requested ${waste}% waste has no extra purchase quantity. The combined package is not increased by ${waste}%.`,
      quantity,
      unit,
      areaM2: params.areaM2,
    })
  );
}

function appendFinishSupply(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
  owner: string;
  purchasing: FlooringSupplyMeasure;
  tile: { tileAreaM2: number; wholeTileCount: number } | null;
  hardwood: { linealM: number; boardWidthMm: number } | null;
  requirements: EstimateRequirement[];
}): void {
  if (!finishOmitsCombinedPackage(params.portion)) {
    appendWasteGap({
      workArea: params.workArea,
      portion: params.portion,
      owner: params.owner,
      purchasing: params.purchasing,
      areaM2: params.areaM2,
      requirements: params.requirements,
    });
    return;
  }
  const purchasing =
    params.portion.finish_pricing === "separate_supply"
      ? flooringSeparateSupplyMeasure({
          purchasing: params.purchasing,
          netM2: params.areaM2,
          tile: params.tile,
          hardwood: params.hardwood,
        })
      : params.purchasing;
  if (purchasing.kind === "none") return;
  const customer = flooringCustomerSupplied(params.portion);
  const category = customer ? "CLIENT_SUPPLIED" : "FLOORING_SUPPLY";
  if (purchasing.kind === "carpet_unresolved") {
    params.requirements.push(
      materialCountRow({
        workArea: params.workArea,
        portion: params.portion,
        componentKey: FLOORING_FINISH_SUPPLY_COMPONENT,
        materialKey: FLOORING_CARPET_PURCHASING_UNRESOLVED,
        category: "FLOORING_SUPPLY",
        description: `${params.owner} · carpet roll purchasing`,
        specification: purchasing.limitation,
        quantity: purchasing.netM2,
        unit: "m2",
        areaM2: params.areaM2,
      })
    );
    return;
  }
  if (purchasing.kind === "area") {
    params.requirements.push(
      materialCountRow({
        workArea: params.workArea,
        portion: params.portion,
        componentKey: FLOORING_FINISH_SUPPLY_COMPONENT,
        materialKey: FLOORING_VINYL_SUPPLY_M2,
        category,
        description: `${params.owner} · vinyl plank supply ${purchasing.supplyM2} m²`,
        specification: purchasing.formula,
        quantity: purchasing.supplyM2,
        unit: "m2",
        areaM2: params.areaM2,
      })
    );
    return;
  }
  if (purchasing.kind === "tiles") {
    params.requirements.push(
      materialCountRow({
        workArea: params.workArea,
        portion: params.portion,
        componentKey: FLOORING_FINISH_SUPPLY_COMPONENT,
        materialKey: FLOORING_TILE_SUPPLY_EACH,
        category,
        description: `${params.owner} · floor tile supply ${purchasing.supplyTiles} tiles`,
        specification: purchasing.formula,
        quantity: purchasing.supplyTiles,
        unit: "each",
        areaM2: params.areaM2,
      })
    );
    return;
  }
  params.requirements.push(
    materialCountRow({
      workArea: params.workArea,
      portion: params.portion,
      componentKey: FLOORING_FINISH_SUPPLY_COMPONENT,
      materialKey: FLOORING_HARDWOOD_SUPPLY_LM,
      category,
      description: `${params.owner} · hardwood supply ${purchasing.supplyLinealM} lm`,
      specification: purchasing.formula,
      quantity: purchasing.supplyLinealM,
      unit: "lm",
      areaM2: params.areaM2,
    })
  );
}

function finishPackageRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
  owner: string;
}): {
  requirements: EstimateRequirement[];
  tile: FlooringTileTakeoff | null;
  hardwood: FlooringHardwoodTakeoff | null;
  purchasing: FlooringSupplyMeasure;
} {
  const { workArea, portion, areaM2, owner } = params;
  const finish = portion.finish_type;
  const requirements: EstimateRequirement[] = [];
  let tile: FlooringTileTakeoff | null = null;
  let hardwood: FlooringHardwoodTakeoff | null = null;

  if (finish === "carpet") {
    const purchasing = resolveFlooringSupply({
      portion,
      netM2: areaM2,
      tile: null,
      hardwood: null,
    });
    const packageKey = FLOORING_CARPET_SUPPLY_INSTALL_M2;
    if (
      !appendCustomerInstall({
        workArea,
        portion,
        areaM2,
        owner,
        requirements,
      })
    ) {
      requirements.push(
        subcontractRow({
          workArea,
          portion,
          componentKey: packageKey,
          description: `${owner} · carpet supply and install ${presentFlooringAreaM2(areaM2)}`,
          areaM2,
        }),
        packageRow({
          workArea,
          portion,
          componentKey: packageKey,
          description: `${owner} · carpet physical finish ${presentFlooringAreaM2(areaM2)}`,
          specification:
            "Combined carpet supply and installation on the net area. A waste percentage does not set the roll purchase.",
          areaM2,
        })
      );
    }
    if (portion.underlay_required === true) {
      requirements.push(
        subcontractRow({
          workArea,
          portion,
          componentKey: FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
          description: `${owner} · carpet underlay supply and install ${presentFlooringAreaM2(areaM2)}`,
          areaM2,
        }),
        packageRow({
          workArea,
          portion,
          componentKey: FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
          description: `${owner} · carpet underlay ${presentFlooringAreaM2(areaM2)}`,
          specification:
            "Carpet underlay on the net area. Finish waste is not applied.",
          areaM2,
        })
      );
    }
    appendFinishSupply({
      workArea,
      portion,
      areaM2,
      owner,
      purchasing,
      tile: null,
      hardwood: null,
      requirements,
    });
    return { requirements, tile, hardwood, purchasing };
  }

  if (finish === "vinyl_plank") {
    const purchasing = resolveFlooringSupply({
      portion,
      netM2: areaM2,
      tile: null,
      hardwood: null,
    });
    const packageKey = FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2;
    if (
      !appendCustomerInstall({
        workArea,
        portion,
        areaM2,
        owner,
        requirements,
      })
    ) {
      requirements.push(
        subcontractRow({
          workArea,
          portion,
          componentKey: packageKey,
          description: `${owner} · vinyl plank/LVT supply and install ${presentFlooringAreaM2(areaM2)}`,
          areaM2,
        }),
        packageRow({
          workArea,
          portion,
          componentKey: packageKey,
          description: `${owner} · vinyl plank/LVT physical finish ${presentFlooringAreaM2(areaM2)}`,
          specification:
            "Combined vinyl plank supply, installation and ordinary adhesive on the net area. Stated waste is not in this quantity. No carton size is known.",
          areaM2,
        })
      );
    }
    if (portion.floor_preparation_required === true) {
      requirements.push(
        ...preparationRequirements({ workArea, portion, areaM2, owner })
      );
    }
    appendFinishSupply({
      workArea,
      portion,
      areaM2,
      owner,
      purchasing,
      tile: null,
      hardwood: null,
      requirements,
    });
    return { requirements, tile, hardwood, purchasing };
  }

  if (finish === "tile") {
    tile = flooringTileTakeoff(
      areaM2,
      portion.tile_width_mm as number,
      portion.tile_length_mm as number
    );
    const packageKey = FLOORING_TILE_SUPPLY_INSTALL_M2;
    const purchasing = resolveFlooringSupply({
      portion,
      netM2: areaM2,
      tile,
      hardwood: null,
    });
    const tileNote = tile
      ? `${tile.tileWidthMm} × ${tile.tileLengthMm} mm. Net ${tile.wholeTileCount} whole tiles. Waste is not in this count.`
      : "Tile supply-and-install package.";
    if (
      !appendCustomerInstall({
        workArea,
        portion,
        areaM2,
        owner,
        requirements,
      })
    ) {
      requirements.push(
      subcontractRow({
        workArea,
        portion,
        componentKey: packageKey,
        description: `${owner} · tile supply and install ${presentFlooringAreaM2(areaM2)}`,
        areaM2,
        extraAssumptions: tile
          ? [
              {
                key: "tile_whole_count",
                text: tileNote,
                source: "calculator_default",
              },
            ]
          : [],
      }),
      packageRow({
        workArea,
        portion,
        componentKey: packageKey,
        description: `${owner} · tile physical finish ${presentFlooringAreaM2(areaM2)}`,
        specification: tileNote,
        areaM2,
        extraAssumptions: tile
          ? [
              {
                key: "tile_whole_count",
                text: `${tile.wholeTileCount} whole tiles`,
                source: "calculator_default",
              },
            ]
          : [],
      })
    );
    }
    if (portion.floor_preparation_required === true) {
      requirements.push(
        ...preparationRequirements({ workArea, portion, areaM2, owner })
      );
    }
    appendFinishSupply({
      workArea,
      portion,
      areaM2,
      owner,
      purchasing,
      tile,
      hardwood: null,
      requirements,
    });
    return { requirements, tile, hardwood, purchasing };
  }

  if (finish === "hardwood") {
    hardwood = flooringHardwoodTakeoff(
      areaM2,
      portion.hardwood_board_width_mm as number
    );
    const packageKey = FLOORING_HARDWOOD_SUPPLY_INSTALL_M2;
    const purchasing = resolveFlooringSupply({
      portion,
      netM2: areaM2,
      tile: null,
      hardwood,
    });
    const timberNote = hardwood
      ? `${hardwood.boardWidthMm} mm boards. Net ${round2(hardwood.linealM)} lineal m. Waste is not in this length.`
      : "Hardwood supply-and-install package.";
    if (
      !appendCustomerInstall({
        workArea,
        portion,
        areaM2,
        owner,
        requirements,
      })
    ) {
      requirements.push(
      subcontractRow({
        workArea,
        portion,
        componentKey: packageKey,
        description: `${owner} · hardwood supply and install ${presentFlooringAreaM2(areaM2)}`,
        areaM2,
        extraAssumptions: hardwood
          ? [
              {
                key: "hardwood_lineal_m",
                text: timberNote,
                source: "calculator_default",
              },
            ]
          : [],
      }),
      packageRow({
        workArea,
        portion,
        componentKey: packageKey,
        description: `${owner} · hardwood physical finish ${presentFlooringAreaM2(areaM2)}`,
        specification: timberNote,
        areaM2,
      })
    );
    }
    appendFinishSupply({
      workArea,
      portion,
      areaM2,
      owner,
      purchasing,
      tile: null,
      hardwood,
      requirements,
    });
    return { requirements, tile, hardwood, purchasing };
  }

  return {
    requirements,
    tile,
    hardwood,
    purchasing: { kind: "none", netM2: areaM2 },
  };
}

function substrateRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
  owner: string;
}): {
  requirements: EstimateRequirement[];
  takeoff: FlooringSubstrateTakeoff | null;
} {
  const { workArea, portion, areaM2, owner } = params;
  if (portion.substrate_required !== true || !portion.substrate_item_key) {
    return { requirements: [], takeoff: null };
  }
  const coverage = flooringSubstrateSheetCoverageM2(portion.substrate_item_key);
  if (coverage == null) return { requirements: [], takeoff: null };
  const sheetCount = flooringSubstrateSheetCount(areaM2, coverage);
  const label =
    FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[portion.substrate_item_key] ??
    portion.substrate_item_key;
  const takeoff: FlooringSubstrateTakeoff = {
    itemKey: portion.substrate_item_key,
    sheetCoverageM2: coverage,
    sheetCount,
  };
  return {
    takeoff,
    requirements: [
      materialCountRow({
        workArea,
        portion,
        componentKey: FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
        materialKey: portion.substrate_item_key,
        category: "SHEET",
        description: `${owner} · ${sheetCount} × ${label}`,
        specification: `${label}. Sheet count ceil(area / coverage) with no waste.`,
        quantity: sheetCount,
        unit: "each",
        areaM2,
        extraAssumptions: [
          {
            key: "substrate_sheet_coverage_m2",
            text: `${coverage} m² coverage per sheet. ${sheetCount} sheets.`,
            source: "calculator_default",
          },
        ],
      }),
      labourRow({
        workArea,
        portion,
        componentKey: FLOORING_SUBSTRATE_INSTALL_LABOUR,
        hoursKey: FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
        unit: "sheet",
        description: `${owner} · substrate installation`,
        quantity: sheetCount,
        areaM2,
        trade: "carpenter",
      }),
    ],
  };
}

function framingRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
  owner: string;
}): EstimateRequirement[] {
  const { workArea, portion, areaM2, owner } = params;
  if (portion.framing_required !== true || !portion.framing_allowance_level) {
    return [];
  }
  const key = flooringFramingAllowanceKey(portion.framing_allowance_level);
  const level = portion.framing_allowance_level;
  return [
    packageRow({
      workArea,
      portion,
      componentKey: key,
      description: `${owner} · ${level} subfloor framing allowance ${presentFlooringAreaM2(areaM2)}`,
      specification: `${level} subfloor framing allowance. Floor area basis only — no timber, joist, blocking, labour quantities, or structural-design claim.`,
      areaM2,
    }),
  ];
}

function removalRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
  owner: string;
}): EstimateRequirement[] {
  const { workArea, portion, areaM2, owner } = params;
  if (portion.finish_removal_required !== true) return [];
  const rows: EstimateRequirement[] = [];
  const existing = portion.existing_finish_type;
  if (
    existing === "carpet" ||
    existing === "vinyl" ||
    existing === "tile" ||
    existing === "hardwood"
  ) {
    rows.push(
      labourRow({
        workArea,
        portion,
        componentKey: flooringFinishRemovalLabourComponent(existing),
        hoursKey: flooringFinishRemovalHoursKey(existing),
        unit: "m2",
        description: `${owner} · existing ${existing === "vinyl" ? "vinyl" : existing} finish removal`,
        quantity: areaM2,
        areaM2,
        trade: "labourer",
      })
    );
  } else if (existing === "other") {
    rows.push(
      materialCountRow({
        workArea,
        portion,
        componentKey: FLOORING_CUSTOM_REMOVAL_COMPONENT,
        materialKey: null,
        category: "SPECIALIST",
        description: `${owner} · custom existing-finish removal`,
        specification:
          "Custom existing floor finish removal. Ordinary removal operations do not apply.",
        quantity: areaM2,
        unit: "m2",
        areaM2,
        confidence: "low",
      })
    );
  }
  if (portion.substrate_removal_required === true) {
    rows.push(
      labourRow({
        workArea,
        portion,
        componentKey: FLOORING_SUBSTRATE_REMOVE_LABOUR,
        hoursKey: FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
        unit: "m2",
        description: `${owner} · existing substrate removal`,
        quantity: areaM2,
        areaM2,
        trade: "labourer",
      })
    );
  }
  return rows;
}

function specialistRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: FlooringPortion;
  areaM2: number;
}): EstimateRequirement[] {
  const { workArea, portion, areaM2 } = params;
  const phrase = specialistPhrase(portion);
  const specialist = portion.specialist_kind != null;
  const componentKey = specialist
    ? FLOORING_SPECIALIST_COMPONENT
    : FLOORING_CUSTOM_FINISH_COMPONENT;
  const assumption = {
    key: specialist ? "unsupported_specialist" : "custom_ordinary_finish",
    text: specialist
      ? `${phrase} has no supported recipe. Supply and installation stay separate and unpriced. Ordinary finish packages do not apply. This is not a missing material price.`
      : "Custom ordinary flooring. No ordinary carpet, vinyl, tile, or hardwood package key. Independently confirmed substrate, framing, or removal may remain visible.",
    source: "calculator_default" as const,
  };
  const material = materialCountRow({
    workArea,
    portion,
    componentKey,
    materialKey: null,
    category: "SPECIALIST",
    description: specialist ? `${phrase} supply` : summariseFlooringPhysicalPortion(portion),
    specification: phrase,
    quantity: areaM2,
    unit: "m2",
    areaM2,
    extraAssumptions: [assumption],
    confidence: "low",
  });
  if (!specialist) return [material];
  return [
    material,
    labourRow({
      workArea,
      portion,
      componentKey,
      hoursKey: "flooring.specialist.unsupported",
      unit: "m2",
      description: `${phrase} installation`,
      quantity: areaM2,
      areaM2,
      trade: "labourer",
      extraAssumptions: [assumption],
    }),
  ];
}

function emptyPortionPhysical(
  workAreaId: string,
  portion: FlooringPortion,
  completeness: FlooringPhysicalCompleteness,
  missingFields: readonly string[]
): FlooringPortionPhysical {
  return {
    workAreaId,
    nestedItemId: portion.id,
    label: portion.label,
    finish_type: portion.finish_type,
    area_input_method: portion.area_input_method,
    physicalNetAreaM2: physicalNetAreaM2(portion),
    tile: null,
    hardwood: null,
    substrate: null,
    underlay_required: portion.underlay_required,
    floor_preparation_required: portion.floor_preparation_required,
    substrate_required: portion.substrate_required,
    framing_allowance_level: portion.framing_allowance_level,
    finish_removal_required: portion.finish_removal_required,
    existing_finish_type: portion.existing_finish_type,
    substrate_removal_required: portion.substrate_removal_required,
    other_description: portion.other_description,
    specialist_kind: portion.specialist_kind,
    finish_pricing: portion.finish_pricing ?? null,
    finish_supplied_by: portion.finish_supplied_by ?? null,
    waste_treatment: portion.waste_treatment ?? null,
    purchasing: null,
    completeness,
    missingFields,
    summary: summariseFlooringPhysicalPortion(portion),
  };
}

function laminateBlockingFields(portion: FlooringPortion): string[] {
  const missing = specialistMissingFields(portion).filter(
    (field) => field !== "flooring.portion.other_description"
  );
  if (portion.laminate_method == null) {
    missing.push("flooring.portion.laminate_method");
    return missing;
  }
  if (portion.laminate_method !== "floating_click_lock") return missing;
  if (portion.laminate_substrate == null) {
    missing.push("flooring.portion.laminate_substrate");
    return missing;
  }
  if (
    portion.laminate_substrate === "concrete" &&
    portion.laminate_moisture == null
  ) {
    missing.push("flooring.portion.laminate_moisture");
    return missing;
  }
  if (portion.finish_pricing == null) {
    missing.push("flooring.portion.finish_pricing");
  }
  if (
    portion.finish_pricing === "combined_package" &&
    portion.finish_supplied_by !== "customer" &&
    portion.waste_percent != null &&
    portion.waste_percent > 0 &&
    portion.waste_treatment == null
  ) {
    missing.push("flooring.portion.waste_treatment");
  }
  return missing;
}

function laminatePortionPhysical(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: FlooringPortion;
}): {
  readonly portion: FlooringPortionPhysical;
  readonly requirements: readonly EstimateRequirement[];
} {
  const { workArea, portion } = params;
  const missingFields = laminateBlockingFields(portion);
  const area = physicalNetAreaM2(portion);
  if (missingFields.length > 0 || area == null) {
    return {
      portion: emptyPortionPhysical(
        workArea.id,
        portion,
        FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
        missingFields
      ),
      requirements: [],
    };
  }
  const owner = portionDisplayName(portion);
  const plan = planLaminateAssembly({ portion, netM2: area, owner });
  if (plan.status === "unsupported") {
    const requirements = plan.lines.map((line) =>
      materialCountRow({
        workArea,
        portion,
        componentKey: line.componentKey,
        materialKey: line.materialKey,
        category: "SPECIALIST",
        description: line.description,
        specification: line.specification,
        quantity: line.quantity,
        unit: line.unit,
        areaM2: area,
        confidence: "low",
      })
    );
    return {
      portion: emptyPortionPhysical(
        workArea.id,
        portion,
        FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST,
        []
      ),
      requirements,
    };
  }
  if (plan.status !== "ready") {
    return {
      portion: emptyPortionPhysical(
        workArea.id,
        portion,
        FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
        missingFields
      ),
      requirements: [],
    };
  }
  const requirements: EstimateRequirement[] = [];
  for (const line of plan.lines) {
    if (line.role === "package") {
      requirements.push(
        subcontractRow({
          workArea,
          portion,
          componentKey: FLOORING_LAMINATE_PACKAGE_M2,
          description: line.description,
          areaM2: area,
        })
      );
      continue;
    }
    if (line.role === "install") {
      requirements.push(
        labourRow({
          workArea,
          portion,
          componentKey: line.componentKey,
          hoursKey: FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
          unit: "m2",
          description: line.description,
          quantity: line.quantity,
          areaM2: area,
          trade: "carpenter",
        })
      );
      continue;
    }
    requirements.push(
      materialCountRow({
        workArea,
        portion,
        componentKey: line.componentKey,
        materialKey: line.materialKey,
        category: line.customerSupplied
          ? "CLIENT_SUPPLIED"
          : line.wasteUnresolved
            ? FLOORING_WASTE_UNRESOLVED_CATEGORY
            : line.role === "waste"
              ? FLOORING_WASTE_INCREMENT_CATEGORY
              : "LAMINATE",
        description: line.description,
        specification: line.specification,
        quantity: line.quantity,
        unit: line.unit,
        areaM2: area,
      })
    );
  }
  if (portion.finish_removal_required === true) {
    requirements.push(
      ...removalRequirements({ workArea, portion, areaM2: area, owner })
    );
  }
  if (portion.floor_preparation_required === true) {
    requirements.push(
      ...preparationRequirements({ workArea, portion, areaM2: area, owner })
    );
  }
  return {
    portion: {
      ...emptyPortionPhysical(
        workArea.id,
        portion,
        FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
        []
      ),
      physicalNetAreaM2: area,
      purchasing: null,
    },
    requirements,
  };
}

export function calculateFlooringPortionPhysical(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: FlooringPortion;
}): {
  readonly portion: FlooringPortionPhysical;
  readonly requirements: readonly EstimateRequirement[];
} {
  const { workArea, portion } = params;

  if (portion.specialist_kind === "laminate") {
    return laminatePortionPhysical({ workArea, portion });
  }

  if (flooringPortionIsSpecialist(portion)) {
    const missingFields = specialistMissingFields(portion);
    const area = physicalNetAreaM2(portion);
    const requirements: EstimateRequirement[] =
      area != null
        ? specialistRequirements({ workArea, portion, areaM2: area })
        : [];
    return {
      portion: emptyPortionPhysical(
        workArea.id,
        portion,
        FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST,
        missingFields
      ),
      requirements,
    };
  }

  if (portion.finish_type === "other") {
    const missingFields = customOrdinaryMissingFields(portion);
    if (missingFields.length > 0) {
      return {
        portion: emptyPortionPhysical(
          workArea.id,
          portion,
          FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
          missingFields
        ),
        requirements: [],
      };
    }
    const areaM2 = physicalNetAreaM2(portion) as number;
    const owner = portionDisplayName(portion);
    const substrate = substrateRequirements({
      workArea,
      portion,
      areaM2,
      owner,
    });
    const requirements: EstimateRequirement[] = [
      ...specialistRequirements({ workArea, portion, areaM2 }),
      ...substrate.requirements,
      ...framingRequirements({ workArea, portion, areaM2, owner }),
      ...removalRequirements({ workArea, portion, areaM2, owner }),
    ];
    return {
      portion: {
        workAreaId: workArea.id,
        nestedItemId: portion.id,
        label: portion.label,
        finish_type: portion.finish_type,
        area_input_method: portion.area_input_method,
        physicalNetAreaM2: areaM2,
        tile: null,
        hardwood: null,
        substrate: substrate.takeoff,
        underlay_required: portion.underlay_required,
        floor_preparation_required: portion.floor_preparation_required,
        substrate_required: portion.substrate_required,
        framing_allowance_level: portion.framing_allowance_level,
        finish_removal_required: portion.finish_removal_required,
        existing_finish_type: portion.existing_finish_type,
        substrate_removal_required: portion.substrate_removal_required,
        other_description: portion.other_description,
        specialist_kind: portion.specialist_kind,
        finish_pricing: portion.finish_pricing ?? null,
        finish_supplied_by: portion.finish_supplied_by ?? null,
        waste_treatment: portion.waste_treatment ?? null,
        purchasing: null,
        completeness: FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
        missingFields: [],
        summary: summariseFlooringPhysicalPortion(portion),
      },
      requirements,
    };
  }

  const missingFields = ordinaryMissingFields(portion);
  if (missingFields.length > 0) {
    return {
      portion: emptyPortionPhysical(
        workArea.id,
        portion,
        FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
        missingFields
      ),
      requirements: [],
    };
  }

  const areaM2 = physicalNetAreaM2(portion) as number;
  const owner = portionDisplayName(portion);
  const finish = finishPackageRequirements({
    workArea,
    portion,
    areaM2,
    owner,
  });
  const substrate = substrateRequirements({
    workArea,
    portion,
    areaM2,
    owner,
  });
  const requirements: EstimateRequirement[] = [
    ...finish.requirements,
    ...substrate.requirements,
    ...framingRequirements({ workArea, portion, areaM2, owner }),
    ...removalRequirements({ workArea, portion, areaM2, owner }),
  ];

  return {
    portion: {
      workAreaId: workArea.id,
      nestedItemId: portion.id,
      label: portion.label,
      finish_type: portion.finish_type,
      area_input_method: portion.area_input_method,
      physicalNetAreaM2: areaM2,
      tile: finish.tile,
      hardwood: finish.hardwood,
      substrate: substrate.takeoff,
      underlay_required: portion.underlay_required,
      floor_preparation_required: portion.floor_preparation_required,
      substrate_required: portion.substrate_required,
      framing_allowance_level: portion.framing_allowance_level,
      finish_removal_required: portion.finish_removal_required,
      existing_finish_type: portion.existing_finish_type,
      substrate_removal_required: portion.substrate_removal_required,
      other_description: portion.other_description,
      specialist_kind: portion.specialist_kind,
      finish_pricing: portion.finish_pricing ?? null,
      finish_supplied_by: portion.finish_supplied_by ?? null,
      waste_treatment: portion.waste_treatment ?? null,
      purchasing: finish.purchasing,
      completeness: FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
      missingFields: [],
      summary: summariseFlooringPhysicalPortion(portion),
    },
    requirements,
  };
}

export function rollupFlooringPhysicalCompleteness(
  portions: readonly FlooringPortionPhysical[]
): FlooringPhysicalCompleteness | "empty" {
  if (portions.length === 0) return "empty";
  if (
    portions.some(
      (row) =>
        row.completeness ===
        FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
    )
  ) {
    return FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (
    portions.some(
      (row) =>
        row.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
    )
  ) {
    return FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  return FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

export function calculateFlooringPhysical(params: {
  readonly facts: readonly EstimateFact[];
  readonly workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
}): FlooringPhysicalResult {
  const workAreaId = params.workArea.id;
  if (!hasFlooringPortionsFact(params.facts, workAreaId)) {
    return {
      workAreaId,
      source: "legacy_skipped",
      completeness: "empty",
      portions: [],
      requirements: [],
      missingInfo: [],
      assumptions: [],
    };
  }

  const resolved = resolveFlooringPortions({
    facts: params.facts,
    workAreaId,
  });
  if (resolved.portions.length === 0) {
    return {
      workAreaId,
      source: "empty",
      completeness: "empty",
      portions: [],
      requirements: [],
      missingInfo: [],
      assumptions: [FLOORING_NESTED_NOT_YET_PRICED_STATEMENT],
    };
  }

  const portions: FlooringPortionPhysical[] = [];
  const requirements: EstimateRequirement[] = [];
  const missingInfo: string[] = [];
  const assumptions = new Set<string>([FLOORING_NESTED_NOT_YET_PRICED_STATEMENT]);

  for (const portion of resolved.portions) {
    const calculated = calculateFlooringPortionPhysical({
      workArea: params.workArea,
      portion,
    });
    portions.push(calculated.portion);
    requirements.push(...calculated.requirements);
    for (const field of calculated.portion.missingFields) {
      missingInfo.push(missingInfoLine(portion, field));
    }
    if (portion.transitions_required === true) {
      missingInfo.push("Transition strips are requested and have no priced rate.");
    }
    const purchasing = calculated.portion.purchasing;
    if (purchasing?.kind === "carpet_unresolved") {
      missingInfo.push(purchasing.limitation);
    } else if (
      portion.waste_percent != null &&
      portion.waste_percent > 0 &&
      purchasing?.kind !== "area" &&
      purchasing?.kind !== "tiles" &&
      purchasing?.kind !== "lineal"
    ) {
      missingInfo.push(
        `${portion.waste_percent}% waste is stated for the new floor covering and applies to finish supply once this area can be priced.`
      );
    }
  }

  return {
    workAreaId,
    source: "canonical",
    completeness: rollupFlooringPhysicalCompleteness(portions),
    portions,
    requirements,
    missingInfo: [...new Set(missingInfo)],
    assumptions: [...assumptions],
  };
}

export function requirementsForNestedItem(
  requirements: readonly EstimateRequirement[],
  nestedItemId: string
): EstimateRequirement[] {
  return requirements.filter((row) => row.variantKey === nestedItemId);
}

export function flooringFinishPackageIdentity(
  finish: FlooringFinishType
): string | null {
  if (
    finish === "carpet" ||
    finish === "vinyl_plank" ||
    finish === "tile" ||
    finish === "hardwood"
  ) {
    return flooringFinishPackageKey(finish);
  }
  return null;
}

export function isFlooringLabourHoursPlaceholder(
  requirement: EstimateRequirement
): boolean {
  if (requirement.kind !== "labour") return false;
  return (
    requirement.priced === false &&
    requirement.baseHours === 0 &&
    requirement.adjustedHours === 0 &&
    requirement.productivityBasis.hoursPerUnit === 0 &&
    requirement.hourlyCost == null &&
    requirement.totalCost == null &&
    requirement.rateProvenance === "missing" &&
    requirement.assumptions.some(
      (row) => row.key === "productivity_unresolved"
    )
  );
}

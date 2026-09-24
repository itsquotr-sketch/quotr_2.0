/**
 * CLADDING-03 — nested Cladding section physical takeoff.
 *
 * Reads cladding.portions. Emits quantities and unresolved identities.
 * No COST, productivity hours, waste, sell, or Quote scope.
 * Net area is calculated here and is not written back onto the section.
 */

import {
  CLADDING_BATTEN_EXCLUSIONS,
  CLADDING_BATTEN_QUANTITY_UNRESOLVED,
  CLADDING_BOARD_AND_BATTEN_BATTEN_INSTALL_HOURS_PER_LM,
  CLADDING_BOARD_AND_BATTEN_SHEET_M2,
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
  CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM,
  CLADDING_LABOUR_RATE_KEY_UNRESOLVED,
  CLADDING_PRODUCTIVITY_UNRESOLVED_REASON,
  CLADDING_SHEET_EQUIVALENT_INFORMATIONAL,
  CLADDING_SHEET_EQUIVALENT_LABEL,
  CLADDING_SHEET_FACE_AREA_M2,
  CLADDING_SHEET_GAP_MM,
  CLADDING_SHEET_WIDTH_MM,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_SPECIALIST_CUSTOM,
  CLADDING_SPECIALIST_MASONRY,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
  claddingBattenMaterialKey,
  claddingInstallHoursKey,
  claddingLinearMaterialKey,
  claddingOverlapGroup,
  claddingRemoveHoursKey,
  claddingScopeKey,
} from "@/lib/estimate/cladding-identities";
import { claddingPortionIsSpecialist } from "@/lib/estimate/cladding-information-contract";
import {
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_STAGED_NOT_CALCULATED_MESSAGE,
  claddingVisibleApprovedProfile,
  resolveCladdingPortions,
  type CladdingPortion,
  type CladdingSystem,
} from "@/lib/estimate/cladding-portions";
import { CLADDING_PAINTING_DISCLOSURE } from "@/lib/estimate/cladding-question-copy";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  RequirementAssumption,
  RequirementProvenance,
} from "@/lib/estimate/requirements";
import type { EstimateFact, EstimateWorkArea } from "@/lib/estimate/types";

export const CLADDING_PHYSICAL_COMPLETENESS = {
  COMPLETE_PHYSICAL: "COMPLETE_PHYSICAL",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type CladdingPhysicalCompleteness =
  (typeof CLADDING_PHYSICAL_COMPLETENESS)[keyof typeof CLADDING_PHYSICAL_COMPLETENESS];

export type CladdingPhysicalSource = "canonical" | "empty";

export const CLADDING_PHYSICAL_UNPRICED_MESSAGE =
  "Cladding physical takeoff is available. Commercial pricing is not yet connected." as const;

export const CLADDING_SPECIALIST_REQUIRED_MESSAGE =
  "Specialist cladding pricing and specification are required." as const;

export const CLADDING_TRIMS_SPECIFICATION_MESSAGE =
  "Trims/corners/flashings require specification." as const;

const CALCULATOR_SOURCE = "cladding-physical" as const;
const COUNT_EPSILON = 1e-12;
const SHEET_WIDTH_M = CLADDING_SHEET_WIDTH_MM / 1000;
const GAP_M = CLADDING_SHEET_GAP_MM / 1000;

export type CladdingComponentRole =
  | "material"
  | "labour"
  | "informational"
  | "unresolved_scope"
  | "specialist";

export type CladdingAreaKernel = {
  readonly grossAreaM2: number | null;
  readonly netAreaM2: number | null;
  readonly resolved: boolean;
  readonly reason: string | null;
};

export type CladdingBoardAndBattenJoints = {
  readonly columns: number;
  readonly internalVerticalJoints: number;
  readonly battenLm: number;
};

export type CladdingPhysicalComponent = {
  readonly role: CladdingComponentRole;
  readonly workAreaId: string;
  readonly nestedItemId: string;
  readonly variantKey: string;
  readonly label: string | null;
  readonly componentKey: string;
  readonly scopeKey: string;
  readonly overlapGroup: string;
  readonly materialKey: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly completeness: CladdingPhysicalCompleteness;
  readonly unresolvedReason: string | null;
  readonly priced: false;
};

export type CladdingPortionPhysical = {
  readonly workAreaId: string;
  readonly nestedItemId: string;
  readonly variantKey: string;
  readonly label: string | null;
  readonly scopeIntent: CladdingPortion["scope_intent"];
  readonly grossAreaM2: number | null;
  readonly netAreaM2: number | null;
  readonly completeness: CladdingPhysicalCompleteness;
  readonly unresolvedReason: string | null;
  readonly summary: string;
  readonly components: readonly CladdingPhysicalComponent[];
};

export type CladdingPhysicalResult = {
  readonly workAreaId: string;
  readonly source: CladdingPhysicalSource;
  readonly completeness: CladdingPhysicalCompleteness | "empty";
  readonly portions: readonly CladdingPortionPhysical[];
  readonly requirements: readonly EstimateRequirement[];
  readonly missingInfo: readonly string[];
};

function provenance(): RequirementProvenance {
  return {
    calculatorSource: CALCULATOR_SOURCE,
    factKeys: [CLADDING_PORTIONS_FACT_KEY],
    constraintKeys: [],
  };
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return isFiniteNumber(value) && value > 0;
}

export function presentCladdingMeasure(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0$/, "");
}

export function claddingSectionGeometry(portion: CladdingPortion): CladdingAreaKernel {
  let gross: number | null = null;
  if (portion.area_method === "direct_m2") {
    gross = isPositiveFinite(portion.direct_area_m2) ? portion.direct_area_m2 : null;
  } else if (portion.area_method === "length_height") {
    gross =
      isPositiveFinite(portion.length_m) && isPositiveFinite(portion.height_m)
        ? portion.length_m * portion.height_m
        : null;
  }
  if (gross == null) {
    return {
      grossAreaM2: null,
      netAreaM2: null,
      resolved: false,
      reason: "A positive cladding area is required.",
    };
  }
  if (portion.openings_already_deducted == null) {
    return {
      grossAreaM2: gross,
      netAreaM2: null,
      resolved: false,
      reason: "Confirm whether the entered area already excludes openings.",
    };
  }
  if (portion.openings_already_deducted === true) {
    return {
      grossAreaM2: gross,
      netAreaM2: gross,
      resolved: true,
      reason: null,
    };
  }
  const deduction = portion.opening_area_m2;
  if (!isFiniteNumber(deduction) || deduction < 0 || deduction >= gross) {
    return {
      grossAreaM2: gross,
      netAreaM2: null,
      resolved: false,
      reason: "The opening deduction must be zero or greater and less than the cladding area.",
    };
  }
  return {
    grossAreaM2: gross,
    netAreaM2: gross - deduction,
    resolved: true,
    reason: null,
  };
}

export function claddingLinealMetres(
  netAreaM2: number,
  effectiveCoverMm: number
): number | null {
  if (!isPositiveFinite(netAreaM2) || !isPositiveFinite(effectiveCoverMm)) return null;
  return netAreaM2 / (effectiveCoverMm / 1000);
}

export function claddingSheetEquivalent(netAreaM2: number): number | null {
  if (!isPositiveFinite(netAreaM2)) return null;
  return Math.ceil(netAreaM2 / CLADDING_SHEET_FACE_AREA_M2 - COUNT_EPSILON);
}

export function claddingBoardAndBattenJoints(
  lengthM: number,
  heightM: number
): CladdingBoardAndBattenJoints | null {
  if (!isPositiveFinite(lengthM) || !isPositiveFinite(heightM)) return null;
  const columns = Math.ceil((lengthM + GAP_M) / (SHEET_WIDTH_M + GAP_M) - COUNT_EPSILON);
  const internalVerticalJoints = Math.max(columns - 1, 0);
  return {
    columns,
    internalVerticalJoints,
    battenLm: internalVerticalJoints * heightM,
  };
}

export function claddingLabourPlaceholderIsCommerciallyTrusted(
  requirement: LabourRequirement
): boolean {
  return (
    requirement.priced === true &&
    requirement.hourlyCost != null &&
    requirement.totalCost != null &&
    requirement.rateProvenance !== "missing" &&
    requirement.productivityBasis.hoursPerUnit > 0 &&
    requirement.baseHours > 0
  );
}

function sectionName(portion: CladdingPortion): string {
  return portion.label?.trim() || "Cladding section";
}

function ownershipAssumptions(
  workAreaId: string,
  portion: CladdingPortion,
  componentKey: string
): RequirementAssumption[] {
  return [
    {
      key: "scope_key",
      text: claddingScopeKey({
        workAreaId,
        nestedItemId: portion.id,
        componentKey,
      }),
      source: "calculator_default",
    },
    {
      key: "overlap_group",
      text: claddingOverlapGroup(portion.id),
      source: "calculator_default",
    },
  ];
}

function materialRow(params: {
  workAreaId: string;
  workAreaType: string;
  portion: CladdingPortion;
  componentKey: string;
  materialKey: string | null;
  category: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  extra?: readonly RequirementAssumption[];
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workAreaId,
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: params.materialKey ? "high" : "low",
    assumptions: [
      ...ownershipAssumptions(params.workAreaId, params.portion, params.componentKey),
      ...(params.extra ?? []),
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
  workAreaId: string;
  workAreaType: string;
  portion: CladdingPortion;
  componentKey: string;
  description: string;
  quantity: number;
  unit: string;
}): LabourRequirement {
  return buildLabourRequirement({
    workAreaId: params.workAreaId,
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: "low",
    assumptions: [
      ...ownershipAssumptions(params.workAreaId, params.portion, params.componentKey),
      {
        key: "productivity_unresolved",
        text: CLADDING_PRODUCTIVITY_UNRESOLVED_REASON,
        source: "calculator_default",
      },
    ],
    provenance: provenance(),
    priced: false,
    trade: params.componentKey.includes(".remove.") ? "labourer" : "carpenter",
    baseHours: 0,
    productivityBasis: {
      key: params.componentKey,
      hoursPerUnit: 0,
      unit: params.unit,
      quantity: params.quantity,
    },
    adjustmentRef: { factors: [] },
    adjustedHours: 0,
    rateKey: CLADDING_LABOUR_RATE_KEY_UNRESOLVED,
    hourlyCost: null,
    totalCost: null,
    rateProvenance: "missing",
  });
}

function componentOf(params: {
  role: CladdingComponentRole;
  workAreaId: string;
  portion: CladdingPortion;
  componentKey: string;
  materialKey: string | null;
  quantity: number | null;
  unit: string | null;
  completeness: CladdingPhysicalCompleteness;
  unresolvedReason: string | null;
}): CladdingPhysicalComponent {
  return {
    role: params.role,
    workAreaId: params.workAreaId,
    nestedItemId: params.portion.id,
    variantKey: params.portion.id,
    label: params.portion.label,
    componentKey: params.componentKey,
    scopeKey: claddingScopeKey({
      workAreaId: params.workAreaId,
      nestedItemId: params.portion.id,
      componentKey: params.componentKey,
    }),
    overlapGroup: claddingOverlapGroup(params.portion.id),
    materialKey: params.materialKey,
    quantity: params.quantity,
    unit: params.unit,
    completeness: params.completeness,
    unresolvedReason: params.unresolvedReason,
    priced: false,
  };
}

function weatherboardPhrase(portion: CladdingPortion): string {
  const profile = claddingVisibleApprovedProfile(portion);
  if (!profile) return "weatherboard";
  if (profile.system === "fibre_cement_horizontal_weatherboard") {
    return `${profile.nominal_width_mm} mm fibre-cement weatherboard`;
  }
  const system =
    profile.system === "timber_bevelback"
      ? "bevelback weatherboard"
      : profile.system === "timber_rusticated"
        ? "rusticated weatherboard"
        : "vertical shiplap";
  return `${profile.nominal_width_mm} × ${profile.nominal_thickness_mm} mm ${system}`;
}

function wantsNewCladding(portion: CladdingPortion): boolean {
  return portion.scope_intent === "install" || portion.scope_intent === "replace";
}

function removalSystem(portion: CladdingPortion): CladdingSystem | null {
  if (
    portion.cladding_family !== "timber" &&
    portion.cladding_family !== "fibre_cement"
  ) {
    return null;
  }
  if (claddingPortionIsSpecialist(portion)) return null;
  return portion.cladding_system;
}

type BuiltSection = {
  physical: CladdingPortionPhysical;
  requirements: EstimateRequirement[];
  missingInfo: string[];
};

function buildSection(params: {
  workAreaId: string;
  workAreaType: string;
  portion: CladdingPortion;
}): BuiltSection {
  const { workAreaId, workAreaType, portion } = params;
  const name = sectionName(portion);
  const geometry = claddingSectionGeometry(portion);
  const specialist = claddingPortionIsSpecialist(portion);
  const components: CladdingPhysicalComponent[] = [];
  const requirements: EstimateRequirement[] = [];
  const sentences: string[] = [];
  const missing: string[] = [];

  const pushMaterial = (row: {
    role: CladdingComponentRole;
    componentKey: string;
    materialKey: string | null;
    category: string;
    description: string;
    specification: string;
    quantity: number | null;
    unit: string;
    completeness: CladdingPhysicalCompleteness;
    unresolvedReason: string | null;
    extra?: RequirementAssumption[];
  }) => {
    components.push(
      componentOf({
        role: row.role,
        workAreaId,
        portion,
        componentKey: row.componentKey,
        materialKey: row.materialKey,
        quantity: row.quantity,
        unit: row.unit,
        completeness: row.completeness,
        unresolvedReason: row.unresolvedReason,
      })
    );
    requirements.push(
      materialRow({
        workAreaId,
        workAreaType,
        portion,
        componentKey: row.componentKey,
        materialKey: row.materialKey,
        category: row.category,
        description: row.description,
        specification: row.specification,
        quantity: row.quantity ?? 0,
        unit: row.unit,
        extra: [
          ...(row.unresolvedReason
            ? [
                {
                  key: "quantity_unresolved",
                  text: row.unresolvedReason,
                  source: "calculator_default" as const,
                },
              ]
            : []),
          ...(row.extra ?? []),
        ],
      })
    );
  };

  const pushLabour = (row: {
    componentKey: string;
    description: string;
    quantity: number;
    unit: string;
    completeness: CladdingPhysicalCompleteness;
  }) => {
    components.push(
      componentOf({
        role: "labour",
        workAreaId,
        portion,
        componentKey: row.componentKey,
        materialKey: null,
        quantity: row.quantity,
        unit: row.unit,
        completeness: row.completeness,
        unresolvedReason: CLADDING_PRODUCTIVITY_UNRESOLVED_REASON,
      })
    );
    requirements.push(
      labourRow({
        workAreaId,
        workAreaType,
        portion,
        componentKey: row.componentKey,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
      })
    );
  };

  if (geometry.reason) missing.push(`${name}: ${geometry.reason}`);
  const net = geometry.netAreaM2;
  const gross = geometry.grossAreaM2;
  if (net != null) sentences.push(`${presentCladdingMeasure(net)} m² net cladding area`);

  const emitRemoval =
    net != null &&
    (portion.scope_intent === "removal_only" ||
      portion.existing_cladding_removal_required === true);
  const emitNewWork = wantsNewCladding(portion) && !specialist;
  let battenUnresolved = false;

  if (specialist) {
    if (!portion.other_description?.trim()) {
      missing.push(`${name}: Describe this cladding section.`);
    }
    if (portion.scope_intent !== "removal_only" && portion.existing_cladding_removal_required == null) {
      missing.push(`${name}: Remove existing cladding?`);
    }
    missing.push(`${name}: ${CLADDING_SPECIALIST_REQUIRED_MESSAGE}`);
    if (net != null) {
      const componentKey =
        portion.cladding_family === "brick_veneer"
          ? CLADDING_SPECIALIST_BRICK_VENEER
          : portion.cladding_family === "masonry"
            ? CLADDING_SPECIALIST_MASONRY
            : CLADDING_SPECIALIST_CUSTOM;
      const description = portion.other_description?.trim() || name;
      pushMaterial({
        role: "specialist",
        componentKey,
        materialKey: null,
        category: "SPECIALIST",
        description: `${name}: ${description}`,
        specification: description,
        quantity: net,
        unit: "m2",
        completeness: CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST,
        unresolvedReason: CLADDING_SPECIALIST_REQUIRED_MESSAGE,
      });
      const cover = portion.effective_cover_mm;
      const customCover =
        portion.approved_profile_id == null &&
        isPositiveFinite(cover) &&
        portion.specialist_kind === "custom_profile";
      if (customCover && wantsNewCladding(portion)) {
        const lineal = claddingLinealMetres(net, cover);
        if (lineal != null) {
          sentences.push(
            `${presentCladdingMeasure(lineal)} lm informational custom weatherboard`
          );
          pushMaterial({
            role: "informational",
            componentKey: CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM,
            materialKey: null,
            category: "INFORMATIONAL",
            description: `${name}: ${presentCladdingMeasure(lineal)} lm informational custom weatherboard`,
            specification:
              "Informational lineal metres from the stated effective cover. Ordinary profile identities do not apply.",
            quantity: lineal,
            unit: "lm",
            completeness: CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST,
            unresolvedReason: CLADDING_SPECIALIST_REQUIRED_MESSAGE,
          });
          pushLabour({
            componentKey: CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
            description: `${name}: custom weatherboard installation`,
            quantity: lineal,
            unit: "lm",
            completeness: CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST,
          });
        }
      }
    }
  } else if (emitNewWork && net != null) {
    const profile = claddingVisibleApprovedProfile(portion);
    if (profile?.system === "timber_sheet_board_and_batten") {
      sentences.push(`${presentCladdingMeasure(net)} m² sheet-board coverage`);
      pushMaterial({
        role: "material",
        componentKey: CLADDING_BOARD_AND_BATTEN_SHEET_M2,
        materialKey: CLADDING_BOARD_AND_BATTEN_SHEET_M2,
        category: "SHEET",
        description: `${name}: ${presentCladdingMeasure(net)} m² sheet-board coverage`,
        specification: "Board material basis is the net cladding section area.",
        quantity: net,
        unit: "m2",
        completeness: CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
        unresolvedReason: null,
      });
      const sheets = claddingSheetEquivalent(net);
      if (sheets != null) {
        sentences.push(`Minimum equivalent: ${sheets} sheets by face area`);
        pushMaterial({
          role: "informational",
          componentKey: CLADDING_SHEET_EQUIVALENT_INFORMATIONAL,
          materialKey: null,
          category: "INFORMATIONAL",
          description: `${name}: Minimum equivalent: ${sheets} sheets by face area`,
          specification: CLADDING_SHEET_EQUIVALENT_LABEL,
          quantity: sheets,
          unit: "sheet",
          completeness: CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
          unresolvedReason: null,
          extra: [
            {
              key: "informational_sheet_equivalent",
              text: CLADDING_SHEET_EQUIVALENT_LABEL,
              source: "calculator_default",
            },
          ],
        });
      }
      const installKey = claddingInstallHoursKey(profile.system);
      if (installKey) {
        pushLabour({
          componentKey: installKey,
          description: `${name}: sheet board installation`,
          quantity: net,
          unit: "m2",
          completeness: CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
        });
      }
      const battenKey = claddingBattenMaterialKey(
        portion.batten_width_mm,
        portion.batten_thickness_mm
      );
      const joints =
        portion.area_method === "length_height"
          ? claddingBoardAndBattenJoints(portion.length_m ?? 0, portion.height_m ?? 0)
          : null;
      if (portion.area_method !== "length_height" || joints == null || battenKey == null) {
        battenUnresolved = true;
        const reason =
          battenKey == null
            ? "Batten width and thickness are required. No default batten is selected."
            : "Batten lineal metres need length and height. Direct area does not set out vertical joints.";
        missing.push(`${name}: ${reason}`);
        sentences.push(CLADDING_BATTEN_EXCLUSIONS);
        pushMaterial({
          role: "unresolved_scope",
          componentKey: battenKey ?? CLADDING_BATTEN_QUANTITY_UNRESOLVED,
          materialKey: battenKey,
          category: "UNRESOLVED",
          description: `${name}: internal vertical-joint battens require a quantity`,
          specification: `${reason} ${CLADDING_BATTEN_EXCLUSIONS}`,
          quantity: null,
          unit: "lm",
          completeness: CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
          unresolvedReason: reason,
        });
      } else {
        sentences.push(
          `${presentCladdingMeasure(joints.battenLm)} lm internal vertical-joint battens`
        );
        sentences.push(CLADDING_BATTEN_EXCLUSIONS);
        pushMaterial({
          role: "material",
          componentKey: battenKey,
          materialKey: battenKey,
          category: "BATTEN",
          description: `${name}: ${presentCladdingMeasure(joints.battenLm)} lm internal vertical-joint battens`,
          specification: CLADDING_BATTEN_EXCLUSIONS,
          quantity: joints.battenLm,
          unit: "lm",
          completeness: CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
          unresolvedReason: null,
          extra: [
            {
              key: "batten_exclusions",
              text: CLADDING_BATTEN_EXCLUSIONS,
              source: "calculator_default",
            },
          ],
        });
        pushLabour({
          componentKey: CLADDING_BOARD_AND_BATTEN_BATTEN_INSTALL_HOURS_PER_LM,
          description: `${name}: batten installation`,
          quantity: joints.battenLm,
          unit: "lm",
          completeness: CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
        });
      }
    } else {
      const materialKey = claddingLinearMaterialKey(profile?.id ?? null);
      const cover = profile?.effective_cover_mm ?? null;
      const lineal = cover != null && materialKey ? claddingLinealMetres(net, cover) : null;
      if (lineal == null || materialKey == null) {
        missing.push(`${name}: Which approved profile is required?`);
      } else {
        sentences.push(
          `${presentCladdingMeasure(lineal)} lm of ${weatherboardPhrase(portion)}`
        );
        pushMaterial({
          role: "material",
          componentKey: materialKey,
          materialKey,
          category: "WEATHERBOARD",
          description: `${name}: ${presentCladdingMeasure(lineal)} lm of ${weatherboardPhrase(portion)}`,
          specification: `Lineal metres are net area divided by the canonical effective cover of ${cover} mm. No waste is included.`,
          quantity: lineal,
          unit: "lm",
          completeness: CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
          unresolvedReason: null,
        });
        const installKey = claddingInstallHoursKey(profile?.system ?? null);
        if (installKey) {
          pushLabour({
            componentKey: installKey,
            description: `${name}: weatherboard installation`,
            quantity: lineal,
            unit: "lm",
            completeness: CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
          });
        }
      }
    }
  }

  if (
    portion.scope_intent === "removal_only" &&
    portion.cladding_family == null &&
    !portion.other_description?.trim()
  ) {
    missing.push(`${name}: Describe the existing cladding.`);
  }

  if (emitRemoval && net != null && portion.scope_intent !== "suppressed") {
    const ordinaryRemoval = claddingRemoveHoursKey(removalSystem(portion));
    const removalKey = ordinaryRemoval ?? CLADDING_CUSTOM_REMOVE_HOURS_PER_M2;
    pushLabour({
      componentKey: removalKey,
      description: `${name}: existing cladding removal`,
      quantity: net,
      unit: "m2",
      completeness: ordinaryRemoval
        ? CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL
        : CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST,
    });
  } else if (
    wantsNewCladding(portion) &&
    !specialist &&
    portion.existing_cladding_removal_required == null
  ) {
    missing.push(`${name}: Remove existing cladding?`);
  }

  if (emitNewWork && !specialist && net != null) {
    if (portion.cavity_included === true && gross != null) {
      pushMaterial({
        role: "unresolved_scope",
        componentKey: CLADDING_CAVITY_UNRESOLVED_M2,
        materialKey: null,
        category: "UNRESOLVED",
        description: `${name}: drained cavity`,
        specification:
          "Cladding-owned drained cavity. Spacing, product quantity and material identity are unresolved.",
        quantity: net,
        unit: "m2",
        completeness: CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
        unresolvedReason: "Cavity product quantity is unresolved.",
      });
    } else if (portion.cavity_included == null) {
      missing.push(`${name}: Include a drained cavity or cavity battens?`);
    }
    if (portion.wall_underlay_or_rab_included === true && gross != null) {
      pushMaterial({
        role: "unresolved_scope",
        componentKey: CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
        materialKey: null,
        category: "UNRESOLVED",
        description: `${name}: wall underlay or rigid air barrier`,
        specification: "wall underlay or rigid air barrier",
        quantity: gross,
        unit: "m2",
        completeness: CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
        unresolvedReason: "Underlay or rigid air barrier product is unresolved.",
      });
    } else if (portion.wall_underlay_or_rab_included == null) {
      missing.push(`${name}: Include wall underlay or a rigid air barrier?`);
    }
    if (portion.trims_flashings_corners_included === true) {
      sentences.push(CLADDING_TRIMS_SPECIFICATION_MESSAGE);
      pushMaterial({
        role: "unresolved_scope",
        componentKey: CLADDING_TRIMS_UNRESOLVED,
        materialKey: null,
        category: "UNRESOLVED",
        description: `${name}: ${CLADDING_TRIMS_SPECIFICATION_MESSAGE}`,
        specification: CLADDING_TRIMS_SPECIFICATION_MESSAGE,
        quantity: null,
        unit: "scope",
        completeness: CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
        unresolvedReason: CLADDING_TRIMS_SPECIFICATION_MESSAGE,
      });
    } else if (portion.trims_flashings_corners_included == null) {
      missing.push(`${name}: Include trims, corners and flashings?`);
    }
    if (portion.painting_or_coating_included == null) {
      missing.push(`${name}: Include painting or coating?`);
    } else if (portion.painting_or_coating_included === true) {
      sentences.push(CLADDING_PAINTING_DISCLOSURE);
    }
  }

  const ordinaryRemovalReady =
    portion.scope_intent === "removal_only" &&
    net != null &&
    (portion.cladding_family != null || Boolean(portion.other_description?.trim()));
  if (portion.scope_intent == null || portion.scope_intent === "suppressed") {
    missing.push(`${name}: What work is required?`);
  }

  let completeness: CladdingPhysicalCompleteness;
  if (specialist || (portion.scope_intent === "removal_only" && claddingRemoveHoursKey(removalSystem(portion)) == null && ordinaryRemovalReady)) {
    completeness = CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  } else if (
    missing.length > 0 ||
    battenUnresolved ||
    net == null ||
    portion.scope_intent == null ||
    portion.scope_intent === "suppressed"
  ) {
    completeness = CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED;
  } else {
    completeness = CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
    missing.push(`${name}: ${CLADDING_PHYSICAL_UNPRICED_MESSAGE}`);
  }

  const summaryCore = sentences.join(". ");
  const summary = portion.label?.trim()
    ? [portion.label.trim(), summaryCore].filter(Boolean).join(". ")
    : summaryCore;

  return {
    physical: {
      workAreaId,
      nestedItemId: portion.id,
      variantKey: portion.id,
      label: portion.label,
      scopeIntent: portion.scope_intent,
      grossAreaM2: gross,
      netAreaM2: net,
      completeness,
      unresolvedReason: missing.find((row) => !row.includes(CLADDING_PHYSICAL_UNPRICED_MESSAGE)) ?? null,
      summary,
      components,
    },
    requirements,
    missingInfo: missing,
  };
}

function rollup(
  portions: readonly CladdingPortionPhysical[]
): CladdingPhysicalCompleteness | "empty" {
  if (portions.length === 0) return "empty";
  if (portions.some((row) => row.completeness === CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED)) {
    return CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  if (portions.some((row) => row.completeness === CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST)) {
    return CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  return CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

export function claddingUnpricedCalculatorFields(
  physical: CladdingPhysicalResult
): { requirements?: readonly EstimateRequirement[] } {
  if (physical.requirements.length === 0) return {};
  return { requirements: physical.requirements };
}

export function calculateCladdingPhysical(params: {
  facts: readonly EstimateFact[];
  workArea: Pick<EstimateWorkArea, "id" | "type">;
}): CladdingPhysicalResult {
  const portions = resolveCladdingPortions({
    facts: params.facts,
    workAreaId: params.workArea.id,
  }).portions;
  if (portions.length === 0) {
    return {
      workAreaId: params.workArea.id,
      source: "empty",
      completeness: "empty",
      portions: [],
      requirements: [],
      missingInfo: [CLADDING_STAGED_NOT_CALCULATED_MESSAGE],
    };
  }
  const built = portions.map((portion) =>
    buildSection({
      workAreaId: params.workArea.id,
      workAreaType: params.workArea.type || "cladding",
      portion,
    })
  );
  return {
    workAreaId: params.workArea.id,
    source: "canonical",
    completeness: rollup(built.map((row) => row.physical)),
    portions: built.map((row) => row.physical),
    requirements: built.flatMap((row) => row.requirements),
    missingInfo: built.flatMap((row) => row.missingInfo),
  };
}

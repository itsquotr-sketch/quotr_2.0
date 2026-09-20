/**
 * DOORS-03 — nested Door Set physical requirement kernel.
 *
 * Consumes canonical `doors.portions`. Emits per-Door-Set materials and
 * labour-operation bases. No COST rates, productivity hours, or sell.
 * Nested collections never call the legacy Doors lump calculator.
 *
 * Ceilings and Internal Walls formulas are not used here. Doors does not
 * deduct or modify Internal Walls openings.
 */

import {
  DOORS_CARPENTER_LABOUR_RATE_KEY,
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
  DOORS_HARDWARE_INSTALL_LABOUR,
  DOORS_HARDWARE_STANDARD_COMPONENT,
  DOORS_HARDWARE_STANDARD_KEY,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_PREHUNG_INSTALL_LABOUR,
  DOORS_PREHUNG_SET_COMPONENT,
  DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  DOORS_REPLACEMENT_LEAF_COMPONENT,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR,
  DOORS_SPECIALIST_COMPONENT,
} from "@/lib/estimate/doors-identities";
import {
  doorPortionIsUnsupported,
  DOORS_PORTIONS_FACT_KEY,
  hasDoorsPortionsFact,
  resolveDoorsPortions,
  type DoorLeafConstruction,
  type DoorPortion,
  type DoorSpecialistKind,
} from "@/lib/estimate/doors-portions";
import { formatMissing } from "@/lib/estimate/facts";
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
import {
  DOORS_REPLACEMENT_FRAME_DISCLOSURE,
  doorQuestionLabel,
} from "@/lib/estimate/doors-question-copy";

export const DOOR_PHYSICAL_COMPLETENESS = {
  COMPLETE_PHYSICAL: "COMPLETE_PHYSICAL",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type DoorPhysicalCompleteness =
  (typeof DOOR_PHYSICAL_COMPLETENESS)[keyof typeof DOOR_PHYSICAL_COMPLETENESS];

export type DoorPhysicalSource = "canonical" | "empty" | "legacy_skipped";

export const DOORS_PREHUNG_INCLUDED_PARTS_DISCLOSURE =
  "Prehung door set includes leaf, standard timber jamb/frame, door stops, and standard hinges." as const;

export const DOORS_EXISTING_HARDWARE_REUSED_DISCLOSURE =
  "Existing hardware reused." as const;

export const DOORS_NESTED_NOT_YET_PRICED_STATEMENT =
  "Nested Door Set physical quantities are not yet commercially priced." as const;

const CALCULATOR_SOURCE = "doors-physical" as const;

const SPECIALIST_KIND_LABELS: Record<DoorSpecialistKind, string> = {
  fire_rated: "fire-rated",
  acoustic: "acoustic",
  exterior: "exterior",
  aluminium: "aluminium",
  automatic: "automatic",
  security_access_control: "access-control",
  cavity_slider: "cavity slider",
  barn: "barn",
  bifold: "bifold",
  glazed_specialist: "specialist glazed",
  oversized: "oversized",
  heritage_custom: "heritage/custom joinery",
  specialist_hardware: "specialist hardware",
  other_unsupported: "specialist",
};

export type DoorPortionPhysical = {
  readonly workAreaId: string;
  readonly nestedItemId: string;
  readonly label: string | null;
  readonly installation_type: DoorPortion["installation_type"];
  readonly leaf_construction: DoorPortion["leaf_construction"];
  readonly height_mm: DoorPortion["height_mm"];
  readonly width_mm: DoorPortion["width_mm"];
  readonly quantity: number | null;
  readonly hardware_included: boolean | null;
  readonly other_description: string | null;
  readonly specialist_kind: DoorSpecialistKind | null;
  readonly completeness: DoorPhysicalCompleteness;
  readonly missingFields: readonly string[];
  readonly summary: string;
  readonly disclosures: readonly string[];
};

export type DoorPhysicalResult = {
  readonly workAreaId: string;
  readonly source: DoorPhysicalSource;
  readonly completeness: DoorPhysicalCompleteness | "empty";
  readonly portions: readonly DoorPortionPhysical[];
  readonly requirements: readonly EstimateRequirement[];
  readonly missingInfo: readonly string[];
  readonly assumptions: readonly string[];
};

function provenance(): RequirementProvenance {
  return {
    calculatorSource: CALCULATOR_SOURCE,
    factKeys: [DOORS_PORTIONS_FACT_KEY],
    constraintKeys: [],
  };
}

function portionDisplayName(portion: DoorPortion): string {
  const label = portion.label?.trim();
  return label ? label : "Door Set";
}

function leafPhrase(construction: DoorLeafConstruction | null): string {
  if (construction === "hollow_core") return "hollow-core";
  if (construction === "solid_core") return "solid-core";
  if (construction === "other") return "custom";
  return "";
}

function sizePhrase(portion: DoorPortion): string | null {
  if (portion.height_mm == null || portion.width_mm == null) return null;
  return `${portion.height_mm} × ${portion.width_mm} mm`;
}

function specialistPhrase(portion: DoorPortion): string {
  const fromKind = portion.specialist_kind
    ? SPECIALIST_KIND_LABELS[portion.specialist_kind]
    : null;
  const fromDesc = portion.other_description?.trim() || null;
  if (fromDesc && fromKind && !fromDesc.toLowerCase().includes(fromKind)) {
    return `${fromKind} ${fromDesc}`;
  }
  return fromDesc || fromKind || "specialist door";
}

export function summariseDoorPhysicalPortion(portion: DoorPortion): string {
  const qty =
    portion.quantity != null && portion.quantity >= 1 ? portion.quantity : null;
  const qtyText = qty != null ? String(qty) : "?";
  const label = portion.label?.trim() || null;
  if (doorPortionIsUnsupported(portion)) {
    const core = `${qtyText} × ${specialistPhrase(portion)} · specialist pricing required`;
    return label ? `${label} · ${core}` : core;
  }
  const size = sizePhrase(portion);
  const leaf = leafPhrase(portion.leaf_construction);
  if (portion.installation_type === "prehung_internal") {
    const noun =
      qty === 1 ? "prehung internal door set" : "prehung internal door sets";
    const withQtySize = size
      ? `${qtyText} × ${size} ${[leaf, noun].filter(Boolean).join(" ")}`
      : [qtyText, leaf, noun].filter(Boolean).join(" ");
    return label ? `${label} · ${withQtySize}` : withQtySize;
  }
  if (portion.installation_type === "replacement_leaf") {
    const noun = qty === 1 ? "replacement door leaf" : "replacement door leaves";
    const withQtySize = size
      ? `${qtyText} × ${size} ${[leaf, noun].filter(Boolean).join(" ")}`
      : [qtyText, leaf, noun].filter(Boolean).join(" ");
    return label ? `${label} · ${withQtySize}` : withQtySize;
  }
  const fallback = `${qtyText} × door set`;
  return label ? `${label} · ${fallback}` : fallback;
}

function ordinaryMissingFields(portion: DoorPortion): string[] {
  const missing: string[] = [];
  if (
    portion.installation_type !== "prehung_internal" &&
    portion.installation_type !== "replacement_leaf"
  ) {
    missing.push("doors.portion.installation_type");
  }
  if (portion.leaf_construction == null) {
    missing.push("doors.portion.leaf_construction");
  }
  if (portion.height_mm == null) {
    missing.push("doors.portion.height_mm");
  }
  if (portion.width_mm == null) {
    missing.push("doors.portion.width_mm");
  }
  if (portion.quantity == null || portion.quantity < 1) {
    missing.push("doors.portion.quantity");
  }
  if (portion.hardware_included == null) {
    missing.push("doors.portion.hardware_included");
  }
  if (
    portion.leaf_construction === "other" &&
    !portion.other_description?.trim()
  ) {
    missing.push("doors.portion.other_description");
  }
  return missing;
}

function missingInfoLine(portion: DoorPortion, fieldKey: string): string {
  const label = doorQuestionLabel(fieldKey) ?? fieldKey;
  const named = formatMissing(label);
  const owner = portionDisplayName(portion);
  return `${owner}: ${named}`;
}

function dimensionAssumptions(portion: DoorPortion): RequirementAssumption[] {
  const rows: RequirementAssumption[] = [];
  if (portion.height_mm != null) {
    rows.push({
      key: "door_height_mm",
      text: `Height ${portion.height_mm} mm (specification only; does not change quantity).`,
      source: "user_confirmed",
    });
  }
  if (portion.width_mm != null) {
    rows.push({
      key: "door_width_mm",
      text: `Width ${portion.width_mm} mm (specification only; does not change quantity).`,
      source: "user_confirmed",
    });
  }
  if (portion.label?.trim()) {
    rows.push({
      key: "door_set_label",
      text: portion.label.trim(),
      source: "user_confirmed",
    });
  }
  return rows;
}

function specText(portion: DoorPortion, product: string): string {
  const size = sizePhrase(portion);
  const leaf = leafPhrase(portion.leaf_construction);
  return [size, leaf, product].filter(Boolean).join(" ");
}

function materialRow(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: DoorPortion;
  componentKey: string;
  materialKey: string | null;
  category: string;
  description: string;
  specification: string;
  quantity: number;
  extraAssumptions?: readonly RequirementAssumption[];
  confidence: MaterialRequirement["confidence"];
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "doors",
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: params.confidence,
    assumptions: [
      ...dimensionAssumptions(params.portion),
      ...(params.extraAssumptions ?? []),
    ],
    provenance: provenance(),
    priced: false,
    materialKey: params.materialKey,
    category: params.category,
    specification: params.specification,
    baseQuantity: params.quantity,
    baseUnit: "each",
    wasteFactor: 0,
    purchaseQuantity: params.quantity,
    purchaseUnit: "each",
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

function labourRow(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: DoorPortion;
  componentKey: string;
  hoursKey: string;
  unit: string;
  description: string;
  quantity: number;
  extraAssumptions?: readonly RequirementAssumption[];
}): LabourRequirement {
  return buildLabourRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "doors",
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: params.description,
    confidence: "medium",
    assumptions: [
      ...dimensionAssumptions(params.portion),
      ...(params.extraAssumptions ?? []),
    ],
    provenance: provenance(),
    priced: false,
    trade: "carpenter",
    baseHours: 0,
    productivityBasis: {
      key: params.hoursKey,
      hoursPerUnit: 0,
      unit: params.unit,
      quantity: params.quantity,
    },
    adjustmentRef: { factors: [] },
    adjustedHours: 0,
    rateKey: DOORS_CARPENTER_LABOUR_RATE_KEY,
    hourlyCost: null,
    totalCost: null,
    rateProvenance: "missing",
  });
}

function hardwareRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: DoorPortion;
  quantity: number;
  owner: string;
}): EstimateRequirement[] {
  const { workArea, portion, quantity, owner } = params;
  return [
    materialRow({
      workArea,
      portion,
      componentKey: DOORS_HARDWARE_STANDARD_COMPONENT,
      materialKey: DOORS_HARDWARE_STANDARD_KEY,
      category: "HARDWARE",
      description: `${owner} · ${quantity} standard internal door hardware set${
        quantity === 1 ? "" : "s"
      }`,
      specification: specText(portion, "standard internal door hardware set"),
      quantity,
      confidence: "high",
    }),
    labourRow({
      workArea,
      portion,
      componentKey: DOORS_HARDWARE_INSTALL_LABOUR,
      hoursKey: DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
      unit: "set",
      description: `${owner} · standard door-hardware installation`,
      quantity,
    }),
  ];
}

function ordinaryPrehungRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: DoorPortion;
  quantity: number;
}): EstimateRequirement[] {
  const { workArea, portion, quantity } = params;
  const owner = portionDisplayName(portion);
  const construction = portion.leaf_construction;
  const rows: EstimateRequirement[] = [];
  const included: RequirementAssumption[] = [
    {
      key: "prehung_included_parts",
      text: DOORS_PREHUNG_INCLUDED_PARTS_DISCLOSURE,
      source: "calculator_default",
    },
  ];

  if (construction === "hollow_core" || construction === "solid_core") {
    const materialKey =
      construction === "hollow_core"
        ? DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
        : DOORS_PREHUNG_SOLID_CORE_SET_KEY;
    rows.push(
      materialRow({
        workArea,
        portion,
        componentKey: DOORS_PREHUNG_SET_COMPONENT,
        materialKey,
        category: "DOOR_SET",
        description: summariseDoorPhysicalPortion(portion),
        specification: specText(portion, "prehung internal door set"),
        quantity,
        extraAssumptions: included,
        confidence: "high",
      })
    );
  } else if (construction === "other") {
    rows.push(
      materialRow({
        workArea,
        portion,
        componentKey: DOORS_CUSTOM_LEAF_COMPONENT,
        materialKey: null,
        category: "CUSTOM",
        description: summariseDoorPhysicalPortion(portion),
        specification:
          portion.other_description?.trim() ||
          specText(portion, "custom prehung internal door set"),
        quantity,
        extraAssumptions: included,
        confidence: "medium",
      })
    );
  }

  rows.push(
    labourRow({
      workArea,
      portion,
      componentKey: DOORS_PREHUNG_INSTALL_LABOUR,
      hoursKey: DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
      unit: "door",
      description: `${owner} · prehung door-set installation`,
      quantity,
      extraAssumptions: included,
    })
  );

  if (portion.hardware_included === true) {
    rows.push(...hardwareRequirements({ workArea, portion, quantity, owner }));
  }

  return rows;
}

function ordinaryReplacementRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: DoorPortion;
  quantity: number;
}): EstimateRequirement[] {
  const { workArea, portion, quantity } = params;
  const owner = portionDisplayName(portion);
  const construction = portion.leaf_construction;
  const rows: EstimateRequirement[] = [];
  const retained: RequirementAssumption[] = [
    {
      key: "existing_frame_retained",
      text: DOORS_REPLACEMENT_FRAME_DISCLOSURE,
      source: "calculator_default",
    },
  ];
  if (portion.hardware_included === false) {
    retained.push({
      key: "existing_hardware_reused",
      text: DOORS_EXISTING_HARDWARE_REUSED_DISCLOSURE,
      source: "calculator_default",
    });
  }

  if (construction === "hollow_core" || construction === "solid_core") {
    const materialKey =
      construction === "hollow_core"
        ? DOORS_LEAF_HOLLOW_CORE_KEY
        : DOORS_LEAF_SOLID_CORE_KEY;
    rows.push(
      materialRow({
        workArea,
        portion,
        componentKey: DOORS_REPLACEMENT_LEAF_COMPONENT,
        materialKey,
        category: "DOOR_LEAF",
        description: summariseDoorPhysicalPortion(portion),
        specification: specText(portion, "replacement door leaf"),
        quantity,
        extraAssumptions: retained,
        confidence: "high",
      })
    );
  } else if (construction === "other") {
    rows.push(
      materialRow({
        workArea,
        portion,
        componentKey: DOORS_CUSTOM_LEAF_COMPONENT,
        materialKey: null,
        category: "CUSTOM",
        description: summariseDoorPhysicalPortion(portion),
        specification:
          portion.other_description?.trim() ||
          specText(portion, "custom replacement door leaf"),
        quantity,
        extraAssumptions: retained,
        confidence: "medium",
      })
    );
  }

  rows.push(
    labourRow({
      workArea,
      portion,
      componentKey: DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR,
      hoursKey: DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
      unit: "door",
      description: `${owner} · replacement door-leaf installation`,
      quantity,
      extraAssumptions: retained,
    })
  );

  if (portion.hardware_included === true) {
    rows.push(...hardwareRequirements({ workArea, portion, quantity, owner }));
  }

  return rows;
}

function specialistRequirement(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type">;
  portion: DoorPortion;
  quantity: number;
}): MaterialRequirement {
  const { workArea, portion, quantity } = params;
  return materialRow({
    workArea,
    portion,
    componentKey: DOORS_SPECIALIST_COMPONENT,
    materialKey: null,
    category: "SPECIALIST",
    description: summariseDoorPhysicalPortion(portion),
    specification: specialistPhrase(portion),
    quantity,
    extraAssumptions: [
      {
        key: "unsupported_specialist",
        text: "Unsupported specialist door system. Ordinary prehung, replacement-leaf, and standard hardware takeoff do not apply.",
        source: "calculator_default",
      },
    ],
    confidence: "low",
  });
}

export function calculateDoorPortionPhysical(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: DoorPortion;
}): {
  readonly portion: DoorPortionPhysical;
  readonly requirements: readonly EstimateRequirement[];
} {
  const { workArea, portion } = params;
  const summary = summariseDoorPhysicalPortion(portion);

  if (doorPortionIsUnsupported(portion)) {
    const missingFields: string[] = [];
    if (portion.quantity == null || portion.quantity < 1) {
      missingFields.push("doors.portion.quantity");
    }
    const quantity =
      portion.quantity != null && portion.quantity >= 1 ? portion.quantity : null;
    const requirements: EstimateRequirement[] =
      quantity != null
        ? [specialistRequirement({ workArea, portion, quantity })]
        : [];
    return {
      portion: {
        workAreaId: workArea.id,
        nestedItemId: portion.id,
        label: portion.label,
        installation_type: portion.installation_type,
        leaf_construction: portion.leaf_construction,
        height_mm: portion.height_mm,
        width_mm: portion.width_mm,
        quantity: portion.quantity,
        hardware_included: portion.hardware_included,
        other_description: portion.other_description,
        specialist_kind: portion.specialist_kind,
        completeness: DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST,
        missingFields,
        summary,
        disclosures: [],
      },
      requirements,
    };
  }

  const missingFields = ordinaryMissingFields(portion);
  if (missingFields.length > 0) {
    return {
      portion: {
        workAreaId: workArea.id,
        nestedItemId: portion.id,
        label: portion.label,
        installation_type: portion.installation_type,
        leaf_construction: portion.leaf_construction,
        height_mm: portion.height_mm,
        width_mm: portion.width_mm,
        quantity: portion.quantity,
        hardware_included: portion.hardware_included,
        other_description: portion.other_description,
        specialist_kind: portion.specialist_kind,
        completeness: DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED,
        missingFields,
        summary,
        disclosures: [],
      },
      requirements: [],
    };
  }

  const quantity = portion.quantity as number;
  const disclosures: string[] = [];
  let requirements: EstimateRequirement[] = [];

  if (portion.installation_type === "prehung_internal") {
    disclosures.push(DOORS_PREHUNG_INCLUDED_PARTS_DISCLOSURE);
    requirements = ordinaryPrehungRequirements({
      workArea,
      portion,
      quantity,
    });
  } else {
    disclosures.push(DOORS_REPLACEMENT_FRAME_DISCLOSURE);
    if (portion.hardware_included === false) {
      disclosures.push(DOORS_EXISTING_HARDWARE_REUSED_DISCLOSURE);
    }
    requirements = ordinaryReplacementRequirements({
      workArea,
      portion,
      quantity,
    });
  }

  return {
    portion: {
      workAreaId: workArea.id,
      nestedItemId: portion.id,
      label: portion.label,
      installation_type: portion.installation_type,
      leaf_construction: portion.leaf_construction,
      height_mm: portion.height_mm,
      width_mm: portion.width_mm,
      quantity,
      hardware_included: portion.hardware_included,
      other_description: portion.other_description,
      specialist_kind: portion.specialist_kind,
      completeness: DOOR_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL,
      missingFields: [],
      summary,
      disclosures,
    },
    requirements,
  };
}

export function rollupDoorsPhysicalCompleteness(
  portions: readonly DoorPortionPhysical[]
): DoorPhysicalCompleteness | "empty" {
  if (portions.length === 0) return "empty";
  if (
    portions.some(
      (row) =>
        row.completeness === DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
    )
  ) {
    return DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (
    portions.some(
      (row) =>
        row.completeness === DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
    )
  ) {
    return DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  return DOOR_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

export function calculateDoorsPhysical(params: {
  readonly facts: readonly EstimateFact[];
  readonly workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
}): DoorPhysicalResult {
  const workAreaId = params.workArea.id;
  if (!hasDoorsPortionsFact(params.facts, workAreaId)) {
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

  const resolved = resolveDoorsPortions({
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
      assumptions: [DOORS_NESTED_NOT_YET_PRICED_STATEMENT],
    };
  }

  const portions: DoorPortionPhysical[] = [];
  const requirements: EstimateRequirement[] = [];
  const missingInfo: string[] = [];
  const assumptions = new Set<string>([DOORS_NESTED_NOT_YET_PRICED_STATEMENT]);

  for (const portion of resolved.portions) {
    const calculated = calculateDoorPortionPhysical({
      workArea: params.workArea,
      portion,
    });
    portions.push(calculated.portion);
    requirements.push(...calculated.requirements);
    for (const field of calculated.portion.missingFields) {
      missingInfo.push(missingInfoLine(portion, field));
    }
    for (const disclosure of calculated.portion.disclosures) {
      assumptions.add(`${portionDisplayName(portion)}: ${disclosure}`);
    }
  }

  return {
    workAreaId,
    source: "canonical",
    completeness: rollupDoorsPhysicalCompleteness(portions),
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

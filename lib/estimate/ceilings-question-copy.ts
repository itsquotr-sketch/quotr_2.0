/**
 * CEILINGS WA-08-R1 — builder-facing Details copy for nested Ceiling facts.
 *
 * Single source for active V1 Ceiling question wording. Adjacent to the
 * information contract. Do not scatter Ceiling Details copy across UI files.
 * Do not fall through to generic estimating-detail wording.
 */

import {
  CEILINGS_INFORMATION_CONTRACT,
} from "@/lib/estimate/ceilings-information-contract";
import type { CeilingLiningFamily, CeilingStructureFamily } from "@/lib/estimate/ceilings-portions";

export const CEILING_GENERIC_QUESTION =
  "Can you confirm this estimating detail?";

export type CeilingQuestionCopyRow = {
  readonly label: string;
  readonly question: string;
  readonly unit?: string;
};

const COPY: Record<string, CeilingQuestionCopyRow> = {
  "ceilings.portion.geometry_mode": {
    label: "Ceiling geometry",
    question: "Ceiling geometry?",
  },
  "ceilings.portion.length_m": {
    label: "Ceiling length",
    question: "Ceiling length?",
    unit: "m",
  },
  "ceilings.portion.width_m": {
    label: "Ceiling width",
    question: "Ceiling width?",
    unit: "m",
  },
  "ceilings.portion.area_m2": {
    label: "Ceiling area",
    question: "Ceiling area?",
    unit: "m²",
  },
  "ceilings.portion.job_scope": {
    label: "Ceiling work",
    question: "Ceiling work?",
  },
  "ceilings.portion.structure_family": {
    label: "Ceiling framing",
    question: "Ceiling framing?",
  },
  "ceilings.portion.structure_requirements": {
    label: "New framing",
    question: "Build new framing?",
  },
  "ceilings.portion.timber_size": {
    label: "Timber size",
    question: "Timber size?",
  },
  "ceilings.portion.spacing_mm": {
    label: "Framing centres",
    question: "Framing centres?",
    unit: "mm",
  },
  "ceilings.portion.primary_spacing_mm": {
    label: "Primary spacing",
    question: "Primary spacing?",
    unit: "mm",
  },
  "ceilings.portion.furring_spacing_mm": {
    label: "Furring spacing",
    question: "Furring spacing?",
    unit: "mm",
  },
  "ceilings.portion.direction": {
    label: "Framing direction",
    question: "Framing direction?",
  },
  "ceilings.portion.lining_family": {
    label: "Ceiling lining",
    question: "Ceiling lining?",
  },
  "ceilings.portion.plasterboard_product": {
    label: "Plasterboard type",
    question: "Plasterboard type?",
  },
  "ceilings.portion.thickness_mm": {
    label: "Plasterboard thickness",
    question: "Plasterboard thickness?",
  },
  "ceilings.portion.plywood_spec": {
    label: "Plywood specification",
    question: "Plywood specification?",
  },
  "ceilings.portion.board_width_mm": {
    label: "Board width",
    question: "Board width?",
    unit: "mm",
  },
  "ceilings.portion.gap_mm": {
    label: "Board gap",
    question: "Gap between boards?",
    unit: "mm",
  },
  "ceilings.portion.tile_size": {
    label: "Tile size",
    question: "Tile size?",
  },
  "ceilings.portion.sheet_length_mm": {
    label: "Sheet length",
    question: "Sheet length?",
    unit: "mm",
  },
  "ceilings.portion.sheet_width_mm": {
    label: "Sheet width",
    question: "Sheet width?",
    unit: "mm",
  },
  "ceilings.portion.layers": {
    label: "Lining layers",
    question: "How many layers?",
  },
  "ceilings.portion.height_m": {
    label: "Ceiling height",
    question: "Ceiling height?",
    unit: "m",
  },
  "ceilings.portion.insulation_included": {
    label: "Ceiling insulation",
    question: "Include insulation?",
  },
  "ceilings.portion.insulation_type": {
    label: "Insulation type",
    question: "Insulation type?",
  },
  "ceilings.portion.bulkheads_present": {
    label: "Bulkheads",
    question: "Any bulkheads?",
  },
  "ceilings.portion.demolition_included": {
    label: "Ceiling demolition",
    question: "Include demolition?",
  },
  "ceilings.portion.stopping_included": {
    label: "Ceiling stopping",
    question: "Include stopping?",
  },
  "ceilings.portion.painting_included": {
    label: "Ceiling painting",
    question: "Include painting?",
  },
  "ceilings.portion.significant_penetrations": {
    label: "Significant penetrations",
    question: "Any major penetrations?",
  },
  "ceilings.portion.penetrations": {
    label: "Penetrations",
    question: "Penetration details?",
  },
  "ceilings.portion.fire_acoustic_requirement": {
    label: "Fire or acoustic system",
    question: "Fire or acoustic system?",
  },
  "ceilings.portion.fire_acoustic_system": {
    label: "Fire or acoustic system",
    question: "Named fire or acoustic system?",
  },
  "ceilings.portion.drop_height_m": {
    label: "Drop height",
    question: "Drop height?",
    unit: "m",
  },
  "ceilings.portion.suspension_spacing_m": {
    label: "Suspension spacing",
    question: "Support spacing?",
    unit: "m",
  },
  "ceilings.portion.edge_offset_m": {
    label: "Edge offset",
    question: "Edge offset?",
    unit: "m",
  },
  "ceilings.bulkhead.length_m": {
    label: "Bulkhead length",
    question: "Bulkhead length?",
    unit: "m",
  },
  "ceilings.bulkhead.depth_m": {
    label: "Bulkhead depth",
    question: "Bulkhead depth?",
    unit: "m",
  },
  "ceilings.bulkhead.height_m": {
    label: "Bulkhead height",
    question: "Bulkhead height?",
    unit: "m",
  },
  "ceilings.bulkhead.framing_type": {
    label: "Bulkhead framing",
    question: "Bulkhead framing?",
  },
  "ceilings.bulkhead.lining_type": {
    label: "Bulkhead lining",
    question: "Bulkhead lining?",
  },
  "ceilings.bulkhead.thickness_mm": {
    label: "Bulkhead lining thickness",
    question: "Bulkhead lining thickness?",
  },
  "ceilings.bulkhead.form": {
    label: "Bulkhead form",
    question: "Bulkhead form?",
  },
  "ceilings.bulkhead.topology": {
    label: "Bulkhead topology",
    question: "Bulkhead topology?",
  },
  "ceilings.portion.label": {
    label: "Portion name",
    question: "Ceiling portion name?",
  },
  "ceilings.bulkhead.label": {
    label: "Bulkhead name",
    question: "Bulkhead name?",
  },
};

export function ceilingQuestionCopyRow(
  factKey: string
): CeilingQuestionCopyRow | null {
  return COPY[factKey] ?? null;
}

export function ceilingQuestionLabel(factKey: string): string | null {
  return COPY[factKey]?.label ?? null;
}

export function ceilingQuestionCopy(
  factKey: string,
  ctx?: {
    readonly liningFamily?: CeilingLiningFamily | null;
    readonly structureFamily?: CeilingStructureFamily | null;
  }
): string | null {
  if (
    factKey === "ceilings.portion.direction" &&
    ctx?.liningFamily === "timber_lined" &&
    ctx?.structureFamily !== "timber_direct_fix" &&
    ctx?.structureFamily !== "steel_direct_fix" &&
    ctx?.structureFamily !== "suspended_steel"
  ) {
    return "Board direction?";
  }
  return COPY[factKey]?.question ?? null;
}

export function ceilingQuestionUnit(factKey: string): string | undefined {
  return COPY[factKey]?.unit;
}

export function ceilingQuestionCopyKeys(): readonly string[] {
  return Object.keys(COPY);
}

/** Contract keys that must never hit generic Details copy. */
export function missingCeilingQuestionCopyKeys(): readonly string[] {
  return CEILINGS_INFORMATION_CONTRACT.filter((row) => !COPY[row.factKey]).map(
    (row) => row.factKey
  );
}

export function isGenericCeilingQuestion(text: string): boolean {
  return text.includes(CEILING_GENERIC_QUESTION);
}

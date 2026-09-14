/**
 * CEILINGS WA-06 — Refine adapter.
 *
 * Structured editor of resolved Ceiling Portion facts. Not a second Details
 * interview. Unresolved required facts stay Details-owned.
 */

import {
  questionPresentationId,
  questionSemanticKey,
  ceilingPortionQuestionIdentity,
} from "@/lib/assistant/question-identity";
import type {
  CeilingsRefinePanel,
  RefineCandidate,
  RefineWorkAreaAdapter,
} from "@/lib/assistant/refine/types";
import { ceilingPortionFieldCurrentValue } from "@/lib/estimate/ceilings-clarify";
import {
  ceilingsDetailsSectionId,
  ceilingsFactIsRelevant,
} from "@/lib/estimate/ceilings-information-contract";
import {
  ceilingQuestionCopy,
  ceilingQuestionLabel,
} from "@/lib/estimate/ceilings-question-copy";
import {
  CEILINGS_BULKHEAD_FRAMING_VALUES,
  CEILINGS_BULKHEAD_LINING_VALUES,
  CEILINGS_DIRECTION_VALUES,
  CEILINGS_JOB_SCOPE_VALUES,
  CEILINGS_LINING_FAMILY_VALUES,
  CEILINGS_PLASTERBOARD_PRODUCT_VALUES,
  CEILINGS_PLASTERBOARD_THICKNESS_OPTIONS,
  CEILINGS_STRUCTURE_FAMILY_VALUES,
  CEILINGS_TILE_SIZE_VALUES,
  CEILINGS_TIMBER_SIZE_VALUES,
  hasCanonicalCeilingsPortions,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "@/lib/estimate/ceilings-portions";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

function isResolved(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  return hasFactValue(value) && !isNotSureValue(value);
}

function groupForKey(factKey: string): RefineCandidate["group"] {
  const section = ceilingsDetailsSectionId(factKey);
  if (section === "structure") return "structure";
  if (section === "scope") return "scope";
  if (section === "dimensions") return "structure";
  return "specification";
}

function candidate(params: {
  workAreaId: string;
  workAreaName: string;
  factKey: string;
  label: string;
  question: string;
  inputType: RefineCandidate["inputType"];
  options?: readonly string[];
  unit?: string;
  currentValue?: RefineCandidate["currentValue"];
  nestedItemId?: string | null;
  componentId?: string | null;
}): RefineCandidate {
  const identity = ceilingPortionQuestionIdentity({
    workAreaId: params.workAreaId,
    factKey: params.factKey,
    nestedItemId: params.nestedItemId,
    componentId: params.componentId,
  });
  return {
    id:
      questionPresentationId("refine", identity) ??
      `refine:${params.workAreaId}:${params.factKey}`,
    semanticKey: questionSemanticKey(identity),
    group: groupForKey(params.factKey),
    tier: "high_value",
    workAreaId: params.workAreaId,
    workAreaName: params.workAreaName,
    workAreaType: "ceilings",
    factKey: params.factKey,
    constraintKey: null,
    questionKey: params.factKey,
    label: params.label,
    question: params.question,
    inputType: params.inputType,
    options: params.options ? [...params.options] : undefined,
    unit: params.unit,
    currentValue: params.currentValue,
    writeTarget: "FACT",
    write: null,
    wallTypeId: params.nestedItemId ?? null,
    openingId: params.componentId ?? null,
    nestedItemId: params.nestedItemId ?? null,
    componentId: params.componentId ?? null,
    consumedByCalculator: true,
  };
}

function pushIfResolved(
  out: RefineCandidate[],
  row: Parameters<typeof candidate>[0]
) {
  if (!isResolved(row.currentValue)) return;
  out.push(candidate(row));
}

function portionFields(
  workAreaId: string,
  workAreaName: string,
  portion: CeilingPortion,
  facts: readonly EstimateFact[]
): RefineCandidate[] {
  const out: RefineCandidate[] = [];
  const nestedItemId = portion.id;
  const relevant = (factKey: string, componentId?: string | null) =>
    ceilingsFactIsRelevant(factKey, {
      facts,
      workAreaId,
      nestedItemId,
      componentId,
      portion,
    });

  const field = (
    factKey: string,
    label: string,
    question: string,
    inputType: RefineCandidate["inputType"],
    options?: readonly string[],
    unit?: string,
    componentId?: string | null
  ) => {
    if (
      factKey !== "ceilings.portion.label" &&
      factKey !== "ceilings.bulkhead.label" &&
      !relevant(factKey, componentId)
    ) {
      return;
    }
    const copy = ceilingQuestionCopy(factKey, {
      liningFamily: portion.lining.family,
      structureFamily: portion.structure.family,
    });
    const copyLabel = ceilingQuestionLabel(factKey);
    pushIfResolved(out, {
      workAreaId,
      workAreaName,
      factKey,
      label: copyLabel ?? label,
      question: copy ?? question,
      inputType,
      options,
      unit,
      nestedItemId,
      componentId,
      currentValue: ceilingPortionFieldCurrentValue(
        portion,
        factKey,
        componentId
          ? portion.bulkheads.find((row) => row.id === componentId) ?? null
          : null
      ),
    });
  };

  field("ceilings.portion.label", "Portion name", "Ceiling portion name?", "text");
  field("ceilings.portion.length_m", "Length", "Ceiling length?", "number", undefined, "m");
  field("ceilings.portion.width_m", "Width", "Ceiling width?", "number", undefined, "m");
  field("ceilings.portion.area_m2", "Area", "Ceiling area?", "number", undefined, "m²");
  field(
    "ceilings.portion.job_scope",
    "Job scope",
    "What ceiling work is this portion?",
    "select",
    CEILINGS_JOB_SCOPE_VALUES
  );
  field(
    "ceilings.portion.structure_family",
    "Structure",
    "How is this ceiling framed?",
    "select",
    CEILINGS_STRUCTURE_FAMILY_VALUES
  );
  field(
    "ceilings.portion.timber_size",
    "Timber size",
    "Timber framing size?",
    "select",
    CEILINGS_TIMBER_SIZE_VALUES
  );
  field("ceilings.portion.spacing_mm", "Framing centres", "Framing centres?", "number", undefined, "mm");
  field(
    "ceilings.portion.direction",
    "Direction",
    "Run direction?",
    "select",
    CEILINGS_DIRECTION_VALUES
  );
  field(
    "ceilings.portion.primary_spacing_mm",
    "Primary spacing",
    "Primary channel centres?",
    "number",
    undefined,
    "mm"
  );
  field(
    "ceilings.portion.furring_spacing_mm",
    "Furring spacing",
    "Furring channel centres?",
    "number",
    undefined,
    "mm"
  );
  field("ceilings.portion.drop_height_m", "Drop height", "Suspension drop height?", "number", undefined, "m");
  field(
    "ceilings.portion.suspension_spacing_m",
    "Suspension spacing",
    "Maximum support spacing?",
    "number",
    undefined,
    "m"
  );
  field("ceilings.portion.edge_offset_m", "Edge offset", "Edge offset?", "number", undefined, "m");
  field(
    "ceilings.portion.lining_family",
    "Lining",
    "Ceiling lining?",
    "select",
    CEILINGS_LINING_FAMILY_VALUES
  );
  field(
    "ceilings.portion.plasterboard_product",
    "Plasterboard",
    "Plasterboard product?",
    "select",
    CEILINGS_PLASTERBOARD_PRODUCT_VALUES
  );
  field(
    "ceilings.portion.thickness_mm",
    "Thickness",
    "Lining thickness?",
    "select",
    CEILINGS_PLASTERBOARD_THICKNESS_OPTIONS
  );
  field("ceilings.portion.sheet_length_mm", "Sheet length", "Sheet length?", "number", undefined, "mm");
  field("ceilings.portion.sheet_width_mm", "Sheet width", "Sheet width?", "number", undefined, "mm");
  field("ceilings.portion.layers", "Layers", "How many lining layers?", "number");
  field("ceilings.portion.plywood_spec", "Plywood spec", "Plywood specification?", "text");
  field("ceilings.portion.board_width_mm", "Board width", "Timber lining cover width?", "number", undefined, "mm");
  field("ceilings.portion.gap_mm", "Board gap", "Gap between boards?", "number", undefined, "mm");
  field(
    "ceilings.portion.tile_size",
    "Tile size",
    "Tile size?",
    "select",
    CEILINGS_TILE_SIZE_VALUES
  );
  field(
    "ceilings.portion.insulation_included",
    "Insulation",
    "Include ceiling insulation?",
    "boolean"
  );
  if (portion.finish.insulation_included === true) {
    field("ceilings.portion.insulation_type", "Insulation spec", "Insulation specification?", "text");
  }
  field(
    "ceilings.portion.bulkheads_present",
    "Bulkheads",
    "Are there bulkheads on this ceiling?",
    "boolean"
  );

  for (const bulkhead of portion.bulkheads) {
    const componentId = bulkhead.id;
    field("ceilings.bulkhead.label", "Bulkhead name", "Bulkhead name?", "text", undefined, undefined, componentId);
    field("ceilings.bulkhead.length_m", "Bulkhead length", "Bulkhead length?", "number", undefined, "m", componentId);
    field("ceilings.bulkhead.depth_m", "Bulkhead depth", "Bulkhead depth?", "number", undefined, "m", componentId);
    field("ceilings.bulkhead.height_m", "Bulkhead height", "Bulkhead height?", "number", undefined, "m", componentId);
    field(
      "ceilings.bulkhead.framing_type",
      "Bulkhead framing",
      "Bulkhead framing?",
      "select",
      CEILINGS_BULKHEAD_FRAMING_VALUES,
      undefined,
      componentId
    );
    field(
      "ceilings.bulkhead.lining_type",
      "Bulkhead lining",
      "Bulkhead lining?",
      "select",
      CEILINGS_BULKHEAD_LINING_VALUES,
      undefined,
      componentId
    );
    field(
      "ceilings.bulkhead.thickness_mm",
      "Bulkhead thickness",
      "Bulkhead lining thickness?",
      "select",
      CEILINGS_PLASTERBOARD_THICKNESS_OPTIONS,
      undefined,
      componentId
    );
  }

  return out;
}

export function ceilingsRefinePanel(params: {
  workAreaId: string;
  workAreaName: string;
  facts: readonly EstimateFact[];
}): CeilingsRefinePanel {
  const resolved = resolveCeilingsPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  return {
    workAreaId: params.workAreaId,
    workAreaName: params.workAreaName,
    portions: resolved.portions.map((portion, index) => ({
      id: portion.id,
      displayName: portion.label?.trim() || `Ceiling ${index + 1}`,
      summary: [
        portion.geometry.area_m2 != null ? `${portion.geometry.area_m2} m²` : null,
        portion.structure.family?.replace(/_/g, " "),
        portion.lining.family?.replace(/_/g, " "),
      ]
        .filter(Boolean)
        .join(" · "),
      bulkheads: portion.bulkheads.map((bh, bhIndex) => ({
        id: bh.id,
        displayName: bh.label?.trim() || `Bulkhead ${bhIndex + 1}`,
        summary: [
          bh.length_m != null ? `${bh.length_m}m` : null,
          bh.depth_m != null ? `${bh.depth_m}m` : null,
          bh.height_m != null ? `${bh.height_m}m` : null,
        ]
          .filter(Boolean)
          .join(" × "),
      })),
    })),
    activeId: resolved.activeId,
  };
}

export const ceilingsRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "ceilings",
  candidates({ workAreaId, workAreaName, facts }) {
    const asFacts = facts as EstimateFact[];
    if (!hasCanonicalCeilingsPortions(asFacts, workAreaId)) return [];
    const resolved = resolveCeilingsPortions({
      facts: asFacts,
      workAreaId,
    });
    return resolved.portions.flatMap((portion) =>
      portionFields(workAreaId, workAreaName, portion, asFacts)
    );
  },
};

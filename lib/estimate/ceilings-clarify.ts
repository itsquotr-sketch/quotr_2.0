/**
 * CEILINGS WA-03B — contract-driven Details / Ready candidates.
 *
 * Loops every Portion (and nested Bulkhead). No partial-Ready.
 * Do not invent a separate CEILINGS_HARD_MINIMUM_KEYS list.
 */

import type { ClarifyAskClass, ClarifyCandidate } from "@/lib/assistant/clarify/types";
import type { NestedItemPanel } from "@/lib/assistant/clarify/types";
import {
  questionPresentationId,
  ceilingPortionQuestionIdentity,
} from "@/lib/assistant/question-identity";
import {
  safeFactPresentationLabel,
} from "@/lib/assistant/presentation/fact-key-labels";
import {
  ceilingQuestionCopy,
  ceilingQuestionLabel,
  ceilingQuestionUnit,
} from "@/lib/estimate/ceilings-question-copy";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import {
  CEILINGS_INFORMATION_CONTRACT,
  ceilingsAssumptionStatement,
  ceilingsFactIsRelevant,
  type CeilingsInformationContext,
} from "@/lib/estimate/ceilings-information-contract";
import {
  CEILINGS_ADD_PORTION_KEY,
  CEILINGS_DELETE_PORTION_KEY,
  CEILINGS_DUPLICATE_PORTION_KEY,
  CEILINGS_JOB_SCOPE_VALUES,
  CEILINGS_LINING_FAMILY_VALUES,
  CEILINGS_INSULATION_TYPE_VALUES,
  CEILINGS_PLASTERBOARD_PRODUCT_VALUES,
  CEILINGS_PLASTERBOARD_THICKNESS_OPTIONS,
  CEILINGS_STRUCTURE_FAMILY_VALUES,
  CEILINGS_TILE_SIZE_VALUES,
  CEILINGS_TIMBER_SIZE_VALUES,
  CEILINGS_DIRECTION_VALUES,
  CEILINGS_BULKHEAD_FRAMING_VALUES,
  CEILINGS_BULKHEAD_LINING_VALUES,
  CEILINGS_BULKHEAD_FORM_REFINE_OPTIONS,
  CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED,
  ceilingInsulationTypeSelectValue,
  isCeilingInsulationType,
  ceilingPlasterboardThicknessLabel,
  findCeilingBulkhead,
  findCeilingPortion,
  isCeilingsNestedFactKey,
  recommendedCeilingGeometryMode,
  resolveCeilingsPortions,
  type CeilingBulkhead,
  type CeilingPortion,
} from "@/lib/estimate/ceilings-portions";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  CEILINGS_SPECIALIST_FIRE_ACOUSTIC_NOTICE,
  ceilingPortionHasUnknownProprietaryFireAcoustic,
} from "@/lib/estimate/ceilings-specialist";
import { ceilingDisclosedLiningAssumptionCurrentValue } from "@/lib/estimate/ceilings-disclosed-lining";

export type CeilingsClarifyInput = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaName: string;
  readonly briefText?: string | null;
  readonly omitStopping?: boolean;
  readonly omitPainting?: boolean;
};

function clarifyInputType(factKey: string): ClarifyCandidate["inputType"] {
  if (factKey === "ceilings.portion.thickness_mm" || factKey === "ceilings.bulkhead.thickness_mm") {
    return "select";
  }
  if (factKey === "ceilings.portion.insulation_type") {
    return "select";
  }
  const template = getQuestionTemplateByKey(factKey);
  if (template?.inputType === "boolean") return "boolean";
  if (template?.inputType === "number") return "number";
  if (template?.inputType === "text") return "text";
  if (template?.inputType === "multi_select") return "multi_select";
  if (
    factKey.endsWith("_m") ||
    factKey.endsWith("_m2") ||
    factKey.endsWith("_mm") ||
    factKey.endsWith(".layers")
  ) {
    return "number";
  }
  if (
    factKey.endsWith("_included") ||
    factKey.endsWith("_present") ||
    factKey === "ceilings.portion.significant_penetrations"
  ) {
    return "boolean";
  }
  if (
    factKey === "ceilings.portion.plywood_spec" ||
    factKey === "ceilings.portion.insulation_spec" ||
    factKey === "ceilings.portion.fire_acoustic_system" ||
    factKey === "ceilings.portion.penetrations"
  ) {
    return "text";
  }
  return "select";
}

function optionsForKey(factKey: string): readonly string[] | undefined {
  const template = getQuestionTemplateByKey(factKey);
  if (template?.options?.length) return template.options;
  switch (factKey) {
    case "ceilings.portion.job_scope":
      return [...CEILINGS_JOB_SCOPE_VALUES];
    case "ceilings.portion.structure_family":
      return [...CEILINGS_STRUCTURE_FAMILY_VALUES];
    case "ceilings.portion.lining_family":
      return [...CEILINGS_LINING_FAMILY_VALUES];
    case "ceilings.portion.plasterboard_product":
      return [...CEILINGS_PLASTERBOARD_PRODUCT_VALUES];
    case "ceilings.portion.thickness_mm":
    case "ceilings.bulkhead.thickness_mm":
      return [...CEILINGS_PLASTERBOARD_THICKNESS_OPTIONS];
    case "ceilings.portion.timber_size":
      return [...CEILINGS_TIMBER_SIZE_VALUES];
    case "ceilings.portion.direction":
      return [...CEILINGS_DIRECTION_VALUES];
    case "ceilings.portion.tile_size":
      return [...CEILINGS_TILE_SIZE_VALUES];
    case "ceilings.portion.fire_acoustic_requirement":
      return ["none", "specified", "unknown_proprietary"];
    case "ceilings.portion.insulation_type":
      return [...CEILINGS_INSULATION_TYPE_VALUES];
    case "ceilings.bulkhead.framing_type":
      return [...CEILINGS_BULKHEAD_FRAMING_VALUES];
    case "ceilings.bulkhead.lining_type":
      return [...CEILINGS_BULKHEAD_LINING_VALUES];
    case "ceilings.bulkhead.form":
      return [...CEILINGS_BULKHEAD_FORM_REFINE_OPTIONS];
    default:
      return undefined;
  }
}

export function ceilingPortionFieldCurrentValue(
  portion: CeilingPortion | null,
  factKey: string,
  bulkhead?: CeilingBulkhead | null
): string | number | boolean | null {
  if (!portion) return null;
  const field = factKey.startsWith("ceilings.portion.")
    ? factKey.slice("ceilings.portion.".length)
    : factKey.startsWith("ceilings.bulkhead.")
      ? factKey.slice("ceilings.bulkhead.".length)
      : factKey;
  if (factKey.startsWith("ceilings.bulkhead.")) {
    const target =
      bulkhead ??
      findCeilingBulkhead(portion, portion.active_bulkhead_id) ??
      portion.bulkheads[0] ??
      null;
    if (!target) return null;
    if (field === "length_m") return target.length_m;
    if (field === "depth_m") return target.depth_m;
    if (field === "height_m") return target.height_m;
    if (field === "framing_type") return target.framing_type;
    if (field === "lining_type") return target.lining_type;
    if (field === "thickness_mm") {
      return target.thickness_mm != null
        ? ceilingPlasterboardThicknessLabel(target.thickness_mm)
        : null;
    }
    if (field === "form") return target.form;
    if (field === "topology") return target.topology;
    if (field === "label") return target.label;
    return null;
  }
  if (field === "label") return portion.label;
  if (field === "geometry_mode") return portion.geometry.mode;
  if (field === "length_m") return portion.geometry.length_m;
  if (field === "width_m") return portion.geometry.width_m;
  if (field === "area_m2") {
    if (portion.geometry.area_m2 != null) return portion.geometry.area_m2;
    if (
      portion.geometry.length_m != null &&
      portion.geometry.width_m != null &&
      portion.geometry.length_m > 0 &&
      portion.geometry.width_m > 0
    ) {
      return Number(
        (portion.geometry.length_m * portion.geometry.width_m).toFixed(2)
      );
    }
    return null;
  }
  if (field === "structure_requirements") {
    return portion.structure.family;
  }
  if (field === "height_m") return portion.height_m;
  if (field === "job_scope") return portion.structure.job_scope;
  if (field === "structure_family") return portion.structure.family;
  if (field === "lining_family") return portion.lining.family;
  if (field === "plasterboard_product") {
    return portion.lining.plasterboard_product ?? null;
  }
  if (field === "thickness_mm") {
    return portion.lining.thickness_mm != null
      ? ceilingPlasterboardThicknessLabel(portion.lining.thickness_mm)
      : null;
  }
  if (field === "plywood_spec") return portion.lining.plywood_spec ?? null;
  if (field === "tile_size") return portion.lining.tile?.size ?? null;
  if (field === "board_width_mm") {
    const width = portion.lining.timber_lined?.board_width_mm ?? 0;
    return width > 0 ? width : null;
  }
  if (field === "gap_mm") {
    if (!portion.lining.timber_lined) return null;
    return portion.lining.timber_lined.gap_mm;
  }
  if (field === "sheet_length_mm") return portion.lining.sheet_length_mm ?? null;
  if (field === "sheet_width_mm") return portion.lining.sheet_width_mm ?? null;
  if (field === "layers") return portion.lining.layers ?? null;
  if (field === "timber_size") return portion.structure.timber?.size ?? null;
  if (field === "spacing_mm") {
    const spacing = portion.structure.timber?.spacing_mm ?? 0;
    return spacing > 0 ? spacing : null;
  }
  if (field === "primary_spacing_mm") {
    const spacing = portion.structure.steel?.primary_spacing_mm ?? 0;
    return spacing > 0 ? spacing : null;
  }
  if (field === "furring_spacing_mm") {
    const spacing = portion.structure.steel?.furring_spacing_mm ?? 0;
    return spacing > 0 ? spacing : null;
  }
  if (field === "direction") {
    return (
      portion.structure.timber?.direction ??
      portion.structure.steel?.direction ??
      portion.lining.timber_lined?.direction ??
      null
    );
  }
  if (field === "drop_height_m") {
    const drop = portion.structure.suspended?.drop_height_m ?? 0;
    return drop > 0 ? drop : null;
  }
  if (field === "suspension_spacing_m") {
    const spacing = portion.structure.suspended?.max_spacing_m ?? 0;
    return spacing > 0 ? spacing : null;
  }
  if (field === "edge_offset_m") {
    const offset = portion.structure.suspended?.edge_offset_m ?? 0;
    return offset > 0 ? offset : null;
  }
  if (field === "insulation_included") return portion.finish.insulation_included;
  if (field === "insulation_type") {
    return ceilingInsulationTypeSelectValue(portion.finish.insulation_type);
  }
  if (field === "insulation_spec") {
    if (portion.finish.insulation_spec?.trim()) {
      return portion.finish.insulation_spec;
    }
    if (
      portion.finish.insulation_type &&
      !isCeilingInsulationType(portion.finish.insulation_type)
    ) {
      return portion.finish.insulation_type;
    }
    return null;
  }
  if (field === "stopping_included") return portion.finish.stopping_included;
  if (field === "painting_included") return portion.finish.painting_included;
  if (field === "demolition_included") return portion.finish.demolition_included;
  if (field === "bulkheads_present") return portion.has_bulkheads;
  if (field === "significant_penetrations") return portion.significant_penetrations;
  if (field === "penetrations") return portion.penetrations;
  if (field === "fire_acoustic_requirement") return portion.fire_acoustic_requirement;
  if (field === "fire_acoustic_system") return portion.fire_acoustic_system;
  return null;
}

function isResolved(value: unknown, factKey?: string): boolean {
  if (typeof value === "boolean") return true;
  if (value == null || value === "") return false;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return false;
    if (factKey?.endsWith("gap_mm")) return value >= 0;
    return value > 0;
  }
  return true;
}

function portionDisplayName(
  portion: CeilingPortion,
  index: number
): string {
  if (portion.label?.trim()) return portion.label.trim();
  return `Ceiling portion ${index + 1}`;
}

function portionIsComplete(
  portion: CeilingPortion,
  ctx: Omit<CeilingsInformationContext, "portion" | "nestedItemId">
): boolean {
  for (const row of CEILINGS_INFORMATION_CONTRACT) {
    if (row.askClass !== "HARD_MINIMUM" && row.askClass !== "ASK_NOW") continue;
    if (row.scope === "bulkhead") {
      if (portion.has_bulkheads !== true && portion.bulkheads.length === 0) {
        continue;
      }
      const bulkheads =
        portion.bulkheads.length > 0
          ? portion.bulkheads
          : [null];
      for (const bulkhead of bulkheads) {
        if (
          !ceilingsFactIsRelevant(row.factKey, {
            ...ctx,
            portion,
            nestedItemId: portion.id,
            componentId: bulkhead?.id ?? null,
            bulkhead,
          })
        ) {
          continue;
        }
        if (
          !isResolved(
            ceilingPortionFieldCurrentValue(portion, row.factKey, bulkhead),
            row.factKey
          )
        ) {
          return false;
        }
      }
      continue;
    }
    if (
      !ceilingsFactIsRelevant(row.factKey, {
        ...ctx,
        portion,
        nestedItemId: portion.id,
      })
    ) {
      continue;
    }
    if (!isResolved(ceilingPortionFieldCurrentValue(portion, row.factKey), row.factKey)) {
      return false;
    }
  }
  return true;
}

function questionCopy(
  factKey: string,
  portion: CeilingPortion | null
): string {
  return (
    ceilingQuestionCopy(factKey, {
      liningFamily: portion?.lining.family ?? null,
      structureFamily: portion?.structure.family ?? null,
    }) ??
    ceilingQuestionLabel(factKey) ??
    safeFactPresentationLabel(factKey)
  );
}

function buildCandidate(params: {
  input: CeilingsClarifyInput;
  portion: CeilingPortion | null;
  portionIndex: number;
  bulkhead?: CeilingBulkhead | null;
  factKey: string;
  askClass: ClarifyAskClass;
}): ClarifyCandidate {
  const template = getQuestionTemplateByKey(params.factKey);
  const displayName = params.portion
    ? portionDisplayName(portionForLabel(params.portion, params.portionIndex), params.portionIndex)
    : params.input.workAreaName;
  const currentValue = ceilingPortionFieldCurrentValue(
    params.portion,
    params.factKey,
    params.bulkhead
  );
  const askClass = params.askClass;
  const inputType = clarifyInputType(params.factKey);
  return {
    id:
      questionPresentationId(
        askClass === "HARD_MINIMUM" ? "hard" : "fact",
        ceilingPortionQuestionIdentity({
          workAreaId: params.input.workAreaId,
          factKey: params.factKey,
          nestedItemId: params.portion?.id,
          componentId: params.bulkhead?.id,
        })
      ) ??
      `${askClass === "HARD_MINIMUM" ? "hard" : "fact"}:${params.input.workAreaId}:${params.factKey}`,
    source: "scope_fact",
    workAreaId: params.input.workAreaId,
    workAreaName: params.input.workAreaName,
    workAreaType: "ceilings",
    factKey: params.factKey,
    constraintKey: null,
    questionKey: params.factKey,
    label: params.portion
      ? `${displayName} · ${ceilingQuestionLabel(params.factKey) ?? safeFactPresentationLabel(params.factKey)}`
      : ceilingQuestionLabel(params.factKey) ??
        safeFactPresentationLabel(params.factKey),
    question: questionCopy(params.factKey, params.portion),
    askClass,
    inputType,
    unit: template?.unit ?? ceilingQuestionUnit(params.factKey),
    options: optionsForKey(params.factKey),
    currentValue,
    writeTarget: "FACT",
    write: null,
    blocksEstimate:
      askClass === "HARD_MINIMUM" ||
      params.factKey === "ceilings.portion.thickness_mm" ||
      params.factKey === "ceilings.bulkhead.thickness_mm",
    assumable: askClass === "ASSUME_IF_SKIPPED",
    rankScore:
      askClass === "HARD_MINIMUM" ? 1000 : askClass === "ASK_NOW" ? 80 : 40,
    rankReason: `${askClass} · ceilings contract`,
    assumptionStatement: ceilingsAssumptionStatement(params.factKey),
    nestedItemId: params.portion?.id ?? null,
    componentId: params.bulkhead?.id ?? null,
  };
}

function portionForLabel(portion: CeilingPortion, index: number): CeilingPortion {
  void index;
  return portion;
}

export function ceilingNestedFactCurrentValue(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly factKey: string;
  readonly nestedItemId?: string | null;
  readonly componentId?: string | null;
}): string | number | boolean | null {
  if (!isCeilingsNestedFactKey(params.factKey)) return null;
  const resolved = resolveCeilingsPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  const portion =
    findCeilingPortion(resolved.portions, params.nestedItemId) ??
    resolved.portions[0] ??
    null;
  const bulkhead = findCeilingBulkhead(portion, params.componentId);
  return ceilingPortionFieldCurrentValue(portion, params.factKey, bulkhead);
}

export function listCeilingsClarifyCandidates(
  input: CeilingsClarifyInput
): ClarifyCandidate[] {
  const resolved = resolveCeilingsPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  if (resolved.source === "legacy_dual_read") {
    return [];
  }
  const ctx: Omit<CeilingsInformationContext, "portion" | "nestedItemId"> = {
    facts: input.facts,
    workAreaId: input.workAreaId,
    briefText: input.briefText,
    omitStopping: input.omitStopping,
    omitPainting: input.omitPainting,
  };
  const portions =
    resolved.portions.length > 0 ? resolved.portions : [null];
  const out: ClarifyCandidate[] = [];
  portions.forEach((portion, index) => {
    for (const row of CEILINGS_INFORMATION_CONTRACT) {
      if (row.askClass === "DERIVED_NEVER_ASK") continue;
      if (row.askClass === "REFINEMENT" || row.askClass === "ADVANCED") {
        continue;
      }
      if (row.scope === "bulkhead") {
        if (!portion) continue;
        if (portion.has_bulkheads !== true && portion.bulkheads.length === 0) {
          continue;
        }
        const bulkheads =
          portion.bulkheads.length > 0 ? portion.bulkheads : [null];
        for (const bulkhead of bulkheads) {
          if (
            !ceilingsFactIsRelevant(row.factKey, {
              ...ctx,
              portion,
              nestedItemId: portion.id,
              componentId: bulkhead?.id ?? null,
              bulkhead,
            })
          ) {
            continue;
          }
          if (
            isResolved(
              ceilingPortionFieldCurrentValue(portion, row.factKey, bulkhead),
              row.factKey
            )
          ) {
            continue;
          }
          out.push(
            buildCandidate({
              input,
              portion,
              portionIndex: index,
              bulkhead,
              factKey: row.factKey,
              askClass: row.askClass,
            })
          );
        }
        continue;
      }
      if (
        !ceilingsFactIsRelevant(row.factKey, {
          ...ctx,
          portion,
          nestedItemId: portion?.id ?? null,
        })
      ) {
        continue;
      }
      if (isResolved(ceilingPortionFieldCurrentValue(portion, row.factKey), row.factKey)) {
        continue;
      }
      if (
        portion &&
        ceilingDisclosedLiningAssumptionCurrentValue(portion, row.factKey)
      ) {
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

export function ceilingsWorkAreaIsReady(input: CeilingsClarifyInput): boolean {
  const resolved = resolveCeilingsPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  if (resolved.source === "legacy_dual_read") return true;
  const portions = resolved.portions;
  if (portions.length === 0) return false;
  const ctx = {
    facts: input.facts,
    workAreaId: input.workAreaId,
    briefText: input.briefText,
    omitStopping: input.omitStopping,
    omitPainting: input.omitPainting,
  };
  return portions.every(
    (portion) =>
      portionIsComplete(portion, ctx) &&
      !ceilingPortionHasUnknownProprietaryFireAcoustic(portion)
  );
}

export function summariseCeilingPortion(
  portion: CeilingPortion,
  index: number
): {
  readonly id: string;
  readonly displayName: string;
  readonly geometryLine: string | null;
  readonly structureLine: string | null;
  readonly liningLine: string | null;
} {
  const geometry =
    portion.geometry.length_m != null && portion.geometry.width_m != null
      ? `${portion.geometry.length_m}m × ${portion.geometry.width_m}m`
      : portion.geometry.area_m2 != null
        ? `${portion.geometry.area_m2} m²`
        : null;
  const structure =
    portion.structure.family === "existing_framing"
      ? "Existing framing"
      : portion.structure.family === "timber_direct_fix"
        ? "New timber framing"
        : portion.structure.family === "steel_direct_fix"
          ? "Steel direct-fix"
          : portion.structure.family === "suspended_steel"
            ? "Suspended steel"
            : portion.structure.family === "tile_and_grid"
              ? "Tile & grid"
              : null;
  const product = portion.lining.plasterboard_product
    ? portion.lining.plasterboard_product === "standard"
      ? "Standard plasterboard"
      : portion.lining.plasterboard_product === "fyreline"
        ? "Fyreline"
        : portion.lining.plasterboard_product === "aqualine"
          ? "Aqualine"
          : "Plasterboard"
    : portion.lining.family === "plasterboard"
      ? "Plasterboard"
      : portion.lining.family === "plywood"
        ? "Plywood"
        : portion.lining.family === "timber_lined"
          ? "Timber lined"
          : portion.lining.family === "tile_and_grid"
            ? "Tile & grid"
            : null;
  return {
    id: portion.id,
    displayName: portionDisplayName(portion, index),
    geometryLine: geometry,
    structureLine: structure,
    liningLine: product,
  };
}

export function ceilingsNestedItemPanel(
  input: CeilingsClarifyInput
): NestedItemPanel | null {
  const resolved = resolveCeilingsPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  if (resolved.source === "legacy_dual_read") {
    const legacy = resolved.portions[0];
    if (!legacy) return null;
    return {
      workAreaId: input.workAreaId,
      workAreaType: "ceilings",
      workAreaName: input.workAreaName,
      itemKindLabel: "Portion",
      items: [
        {
          id: legacy.id,
          label: `Ceiling portion 1${legacy.label?.trim() ? ` — ${legacy.label.trim()}` : ""}`,
          complete: false,
          summary: "Existing ceiling details",
        },
      ],
      addKey: CEILINGS_ADD_PORTION_KEY,
      duplicateKey: CEILINGS_DUPLICATE_PORTION_KEY,
      deleteKey: CEILINGS_DELETE_PORTION_KEY,
    };
  }
  const ctx = {
    facts: input.facts,
    workAreaId: input.workAreaId,
    briefText: input.briefText,
    omitStopping: input.omitStopping,
    omitPainting: input.omitPainting,
  };
  return {
    workAreaId: input.workAreaId,
    workAreaType: "ceilings",
    workAreaName: input.workAreaName,
    itemKindLabel: "Portion",
    items: resolved.portions.map((portion, index) => {
      const summary = summariseCeilingPortion(portion, index);
      const heading = `Ceiling portion ${index + 1}${
        portion.label?.trim() ? ` — ${portion.label.trim()}` : ""
      }`;
      const specialist =
        ceilingPortionHasUnknownProprietaryFireAcoustic(portion);
      const questionsComplete = portionIsComplete(portion, ctx);
      return {
        id: portion.id,
        label: heading,
        complete: questionsComplete && !specialist,
        specialistRequired: specialist,
        summary: [
          specialist ? CEILINGS_SPECIALIST_FIRE_ACOUSTIC_NOTICE : null,
          summary.geometryLine,
          summary.structureLine,
          summary.liningLine,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }),
    addKey: CEILINGS_ADD_PORTION_KEY,
    duplicateKey: CEILINGS_DUPLICATE_PORTION_KEY,
    deleteKey: CEILINGS_DELETE_PORTION_KEY,
  };
}

export function recommendedGeometryModeForPortion(
  portion: CeilingPortion
): ReturnType<typeof recommendedCeilingGeometryMode> {
  return recommendedCeilingGeometryMode(portion);
}

export function ceilingPortionHasUnsupportedBulkhead(
  portion: CeilingPortion
): boolean {
  return portion.bulkheads.some(
    (row) => row.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED
  );
}

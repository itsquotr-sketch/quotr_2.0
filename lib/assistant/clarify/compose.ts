import { previewProjectConditionAskCandidates } from "@/lib/builder-interview/project-filter";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import { getLevel1BlockingClass } from "@/lib/scopes/level1-blocking";
import { assumptionsFromPersistedFacts, assumptionsFromSkipped } from "@/lib/assistant/clarify/assumptions";
import { allocateClarifyBudget, clarifyQuestionBudget, sortClarifyCandidates } from "@/lib/assistant/clarify/rank";
import {
  isClarifyExtraFactKey,
  isInitialCaptureQuestion,
  clarifyStoredInputType,
} from "@/lib/assistant/clarify/question-contract";
import { SHARED_CONSUMED_CONSTRAINT_KEYS } from "@/lib/estimate/consumed-facts";
import { isImplicitScopeExclusion } from "@/lib/assistant/job-plan/exclusion-provenance";
import {
  blockingClassForKey,
  constraintIsKnown,
  isAdvancedStructuralKey,
  isKnownValue,
  shouldAskBalustrade,
  shouldSuppressKnownSpec,
  briefImpliesConstraint,
  stepsAreRelevant,
} from "@/lib/assistant/clarify/suppress";
import {
  safeFactPresentationLabel,
  safeFactQuestion,
} from "@/lib/assistant/presentation/fact-key-labels";
import { deckFactQuestionClass } from "@/lib/estimate/deck-information-contract";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import type {
  ClarifyAskClass,
  ClarifyCandidate,
  ClarifyEconomicClass,
  ClarifyView,
  ComposeClarifyInput,
} from "@/lib/assistant/clarify/types";
import {
  RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE,
  retainingWallHasCoreHeight,
  retainingWallHasCoreLength,
  retainingWallMaterialReadiness,
} from "@/lib/estimate/calculators/retaining-wall";
import {
  fenceHasCoreHeight,
  fenceHasCoreLength,
  fenceSystemReadiness,
  FENCE_UNSUPPORTED_SYSTEM_MESSAGE,
} from "@/lib/estimate/calculators/fence";
import { classifyFenceSystem, fenceGateScopeApplies, isModularFenceSystem, isTimberFenceSystem } from "@/lib/estimate/fence-systems";
import { classifyRetainingWallSystem } from "@/lib/estimate/retaining-wall-systems";
import { deckStepsCommerciallyIncluded } from "@/lib/estimate/deck-scope-2c";
import {
  DECK_BOARD_WIDTH_ASSUMPTION_STATEMENT,
  DECK_BOARD_WIDTH_FACT_KEY,
} from "@/lib/estimate/deck-board-width";
import { STEP_WIDTH_ASSUMPTION_STATEMENT } from "@/lib/estimate/deck-steps-physical";
import {
  bathroomGeometryNeed,
  bathroomQuestionGroupVisible,
  isMatureBathroomPath,
  parseBathroomFloorSubstrate,
  parseBathroomWallTileExtent,
  parseBathroomWaterproofingExtent,
  resolveBathroomJobScope,
} from "@/lib/estimate/bathroom-scope";
import { BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT } from "@/lib/estimate/bathroom-geometry";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
  parseInternalWallsJobScope,
  parseInternalWallsStructuralInvolvement,
  structuralGateApplies,
  wallTypesRequiredForScope,
} from "@/lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT,
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
  wallTypeFieldCurrentValue,
} from "@/lib/estimate/internal-walls-wall-types";
import {
  getArrayFact,
  getBooleanFact,
  getFact,
  getNumberFact,
  getStringFact,
  hasFactValue,
  isNotSureValue,
} from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

const PC_SCORES: Record<string, number> = {
  site_access: 85,
  material_carry_distance: 48,
  floor_level: 46,
  waste_bin_access: 44,
  occupied_site: 42,
  working_hours: 40,
};

const BATHROOM_P0_CONDITION_KEYS = [
  "site_access",
  "material_carry_distance",
  "occupied_site",
  "working_hours",
] as const;

const BATHROOM_P1_CONDITION_KEYS = [
  "floor_level",
  "waste_bin_access",
] as const;

const CHECK_SCORES: Record<string, number> = {
  "deck.existing_deck_removal": 90,
  "deck.board_width_mm": 88,
  "bathroom.demolition_required": 88,
  "bathroom.demolition.components": 87,
  "fence.demolition_required": 88,
  "fence.gate_included": 86,
  "fence.top_capping": 70,
  "deck.vertical_face_boards_required": 55,
  "deck.skirting_included": 52,
  "deck.access_type": 35,
  "deck.balustrade_required": 20,
  "bathroom.plumbing_changes": 62,
  "bathroom.plumbing.level": 62,
  "bathroom.electrical.level": 62,
  "bathroom.job_scope": 96,
  "internal_walls.job_scope": 96,
  "internal_walls.structural_involvement": 95,
  "internal_walls.wall_type.frame_system": 94,
  "internal_walls.wall_type.frame_size": 93,
  "internal_walls.wall_type.length_lm": 92,
  "internal_walls.wall_type.height_m": 70,
  "internal_walls.wall_type.stud_centres_mm": 68,
  "internal_walls.wall_type.side_a_product": 86,
  "internal_walls.wall_type.side_a_thickness_mm": 85.5,
  "internal_walls.wall_type.side_a_sheet_length_mm": 85,
  "internal_walls.wall_type.side_a_layers": 84.5,
  "internal_walls.wall_type.same_lining_both_sides": 84,
  "bathroom.length_m": 95,
  "bathroom.width_m": 94,
  "bathroom.wall_height_m": 70,
  "bathroom.floor_finish_system": 86,
  "bathroom.floor_substrate_system": 85,
  "bathroom.floor_substrate_sheet_size": 84,
  "bathroom.framing_level": 81,
  "bathroom.tile_extent": 84,
  "bathroom.waterproofing_included": 83,
  "bathroom.waterproofing_extent": 82,
  "bathroom.tile_format": 80,
  "bathroom.shower.width_m": 79,
  "bathroom.shower.depth_m": 78,
  "bathroom.shower.wall_height_m": 77,
  "bathroom.wall_tiling_area_m2": 76,
  "bathroom.waterproofing_area_m2": 75,
  "bathroom.bath_surround_area_m2": 74,
};

function clarifyInputTypeFromTemplate(
  template: { inputType?: string; options?: readonly string[] } | null | undefined
): ClarifyCandidate["inputType"] {
  if (template?.inputType === "boolean") return "boolean";
  if (template?.inputType === "number") return "number";
  if (template?.inputType === "multi_select") return "multi_select";
  if (template?.inputType === "text") return "text";
  return "select";
}

function currentFactOrConstraintValue(
  input: ComposeClarifyInput,
  key: string,
  workAreaId: string | null
): unknown {
  const fact = input.facts.find(
    (row) =>
      row.key === key && (workAreaId == null || row.work_area_id === workAreaId)
  );
  if (fact != null) return fact.value;
  const constraint = input.constraints.find((row) => row.key === key);
  return constraint?.value ?? null;
}

function bathroomWorkAreaPresent(input: ComposeClarifyInput): boolean {
  return input.workAreas.some(
    (wa) => wa.type === "bathroom" && wa.status !== "excluded"
  );
}

function factHas(
  input: ComposeClarifyInput,
  key: string,
  workAreaId: string | null
): boolean {
  const row = input.facts.find(
    (f) =>
      f.key === key &&
      (workAreaId == null || f.work_area_id === workAreaId)
  );
  if (!row || !hasFactValue(row.value)) return false;
  if (isNotSureValue(row.value)) return true;
  if (!isKnownValue(row.value)) return false;
  if (
    isImplicitScopeExclusion({
      factKey: key,
      value: row.value,
      source: row.source,
      briefText: input.briefText,
    })
  ) {
    return false;
  }
  return true;
}

function askClassForScopeKey(key: string): ClarifyAskClass {
  if (isAdvancedStructuralKey(key)) return "ADVANCED";
  const blocking = blockingClassForKey(key);
  if (blocking === "HARD_MINIMUM") return "HARD_MINIMUM";
  if (blocking === "ASSUMABLE") return "ASK_NOW";
  return "ASSUME_IF_SKIPPED";
}

function suppressMatureUnansweredBathroomTiling(
  input: ComposeClarifyInput,
  workAreaId: string | null
): boolean {
  if (!workAreaId) return false;
  return isMatureBathroomPath(
    getStringFact(input.facts as EstimateFact[], workAreaId, "bathroom.job_scope")
  );
}

function candidateFromJobPlanCheck(
  input: ComposeClarifyInput,
  card: ComposeClarifyInput["jobPlan"]["cards"][number],
  item: ComposeClarifyInput["jobPlan"]["cards"][number]["notConfirmed"][number]
): ClarifyCandidate | null {
  const key = item.sourceFactKey;
  if (!key) return null;
  if (key === "deck.access_type" && !stepsAreRelevant(input, card.workAreaId)) {
    return null;
  }
  if (key === "deck.steps_included" && !stepsAreRelevant(input, card.workAreaId)) {
    return null;
  }
  const questionClass =
    deckFactQuestionClass(key) ??
    retainingWallFactQuestionClass(key) ??
    fenceFactQuestionClass(key);
  if (
    questionClass === "REFINE" ||
    questionClass === "DERIVED" ||
    questionClass === "NOT_CONSUMED"
  ) {
    return null;
  }
  if (key === "deck.balustrade_required" && !shouldAskBalustrade(input, card.workAreaId)) {
    return null;
  }
  if (
    key === "bathroom.tiling_included" &&
    suppressMatureUnansweredBathroomTiling(input, card.workAreaId)
  ) {
    return null;
  }
  if (shouldSuppressKnownSpec(key, card.workAreaId, input)) return null;
  if (factHas(input, key, card.workAreaId)) return null;
  if (isAdvancedStructuralKey(key)) return null;

  const template = getQuestionTemplateByKey(key);
  const askClass = askClassForScopeKey(key);
  if (askClass === "ADVANCED" || askClass === "DERIVED_NEVER_ASK") return null;
  const blocking = getLevel1BlockingClass(
    template ?? {
      factKey: key,
      estimatePriorityClass: "P0",
    }
  );

  return {
    id: `check:${card.workAreaId}:${item.id}`,
    source: "job_plan_check",
    workAreaId: card.workAreaId,
    workAreaName: card.name,
    workAreaType: card.workAreaType,
    factKey: key,
    constraintKey: null,
    questionKey: key,
    label: item.label,
    question:
      template?.questionText ??
      `Should ${item.label.toLowerCase()} be included?`,
    askClass: blocking === "HARD_MINIMUM" ? "HARD_MINIMUM" : "ASK_NOW",
    inputType: item.write?.valueType === "select" ? "select" : "boolean",
    options: template?.options,
    writeTarget: "FACT",
    write: item.write,
    blocksEstimate: blocking === "HARD_MINIMUM",
    assumable: blocking !== "HARD_MINIMUM",
    rankScore: CHECK_SCORES[key] ?? 50,
    rankReason: `Job Plan Check · commercial ${CHECK_SCORES[key] ?? 50}`,
    assumptionStatement:
      key === "deck.existing_deck_removal"
        ? "No demolition included"
        : key === "deck.vertical_face_boards_required"
          ? "No fascia included"
          : key === "deck.access_type"
            ? "No steps included"
            : null,
    economicClass:
      key === "deck.steps_included"
        ? "REQUIRED_FOR_ECONOMIC_MODEL"
        : undefined,
  };
}

function missingHardMinimum(
  input: ComposeClarifyInput
): ClarifyCandidate[] {
  const out: ClarifyCandidate[] = [];
  for (const card of input.jobPlan.cards) {
    if (card.workAreaType === "deck") {
      for (const key of ["deck.length_m", "deck.width_m", "deck.area_m2"] as const) {
        if (shouldSuppressKnownSpec(key, card.workAreaId, input)) continue;
        if (factHas(input, key, card.workAreaId)) continue;
        const template = getQuestionTemplateByKey(key);
        out.push({
          id: `hard:${card.workAreaId}:${key}`,
          source: "scope_fact",
          workAreaId: card.workAreaId,
          workAreaName: card.name,
          workAreaType: card.workAreaType,
          factKey: key,
          constraintKey: null,
          questionKey: key,
          label: safeFactPresentationLabel(key),
          question: safeFactQuestion(key, template?.questionText),
          askClass: "HARD_MINIMUM",
          inputType: "number",
          unit: template?.unit,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: true,
          assumable: false,
          rankScore: 1000,
          rankReason: "HARD_MINIMUM geometry",
          assumptionStatement: null,
        });
      }
    }

    if (card.workAreaType === "retaining_wall") {
      const facts = input.facts as EstimateFact[];
      const missing: {
        key: string;
        inputType: ClarifyCandidate["inputType"];
        rankScore: number;
      }[] = [];
      if (!retainingWallHasCoreLength(facts, card.workAreaId)) {
        missing.push({
          key: "retaining_wall.length_m",
          inputType: "number",
          rankScore: 1000,
        });
      }
      if (!retainingWallHasCoreHeight(facts, card.workAreaId)) {
        missing.push({
          key: "retaining_wall.height_m",
          inputType: "number",
          rankScore: 999,
        });
      }
      const materialState = retainingWallMaterialReadiness(facts, card.workAreaId);
      if (materialState !== "SUPPORTED") {
        missing.push({
          key: "retaining_wall.material",
          inputType: "select",
          rankScore: 998,
        });
      }
      for (const row of missing) {
        const template = getQuestionTemplateByKey(row.key);
        const unsupportedMaterial =
          row.key === "retaining_wall.material" &&
          materialState === "UNSUPPORTED_EXPLICIT";
        out.push({
          id: `hard:${card.workAreaId}:${row.key}`,
          source: "scope_fact",
          workAreaId: card.workAreaId,
          workAreaName: card.name,
          workAreaType: card.workAreaType,
          factKey: row.key,
          constraintKey: null,
          questionKey: row.key,
          label: safeFactPresentationLabel(row.key),
          question: unsupportedMaterial
            ? RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE
            : safeFactQuestion(row.key, template?.questionText),
          askClass: "HARD_MINIMUM",
          inputType: row.inputType,
          unit: template?.unit,
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: true,
          assumable: false,
          rankScore: row.rankScore,
          rankReason: unsupportedMaterial
            ? "HARD_MINIMUM unsupported retaining wall material"
            : "HARD_MINIMUM retaining wall core",
          assumptionStatement: null,
        });
      }
    }

    if (card.workAreaType === "fence") {
      const facts = input.facts as EstimateFact[];
      const missing: {
        key: string;
        inputType: ClarifyCandidate["inputType"];
        rankScore: number;
      }[] = [];
      if (!fenceHasCoreLength(facts, card.workAreaId)) {
        missing.push({
          key: "fence.length_m",
          inputType: "number",
          rankScore: 1000,
        });
      }
      if (!fenceHasCoreHeight(facts, card.workAreaId)) {
        missing.push({
          key: "fence.height_m",
          inputType: "number",
          rankScore: 999,
        });
      }
      const systemState = fenceSystemReadiness(facts, card.workAreaId);
      if (systemState !== "SUPPORTED") {
        missing.push({
          key: "fence.system",
          inputType: "select",
          rankScore: 998,
        });
      }
      for (const row of missing) {
        const template = getQuestionTemplateByKey(row.key);
        const unsupported =
          row.key === "fence.system" && systemState === "UNSUPPORTED_EXPLICIT";
        out.push({
          id: `hard:${card.workAreaId}:${row.key}`,
          source: "scope_fact",
          workAreaId: card.workAreaId,
          workAreaName: card.name,
          workAreaType: card.workAreaType,
          factKey: row.key,
          constraintKey: null,
          questionKey: row.key,
          label: safeFactPresentationLabel(row.key),
          question: unsupported
            ? FENCE_UNSUPPORTED_SYSTEM_MESSAGE
            : safeFactQuestion(row.key, template?.questionText),
          askClass: "HARD_MINIMUM",
          inputType: row.inputType,
          unit: template?.unit,
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: true,
          assumable: false,
          rankScore: row.rankScore,
          rankReason: unsupported
            ? "HARD_MINIMUM unsupported fence type"
            : "HARD_MINIMUM fence core",
          assumptionStatement: null,
        });
      }
    }

    if (card.workAreaType === "bathroom") {
      const facts = input.facts as EstimateFact[];
      const jobScope = resolveBathroomJobScope({
        jobScope: getStringFact(facts, card.workAreaId, "bathroom.job_scope"),
        renovationType: getStringFact(
          facts,
          card.workAreaId,
          "bathroom.renovation_type"
        ),
      });
      const geometryNeed = bathroomGeometryNeed(jobScope, {
        tilingIncluded: getBooleanFact(
          facts,
          card.workAreaId,
          "bathroom.tiling_included"
        ),
        wallLiningIncluded: getBooleanFact(
          facts,
          card.workAreaId,
          "bathroom.wall_lining_included"
        ),
        ceilingLiningIncluded: getBooleanFact(
          facts,
          card.workAreaId,
          "bathroom.ceiling_lining_included"
        ),
        floorPrepIncluded: getBooleanFact(
          facts,
          card.workAreaId,
          "bathroom.floor_prep_included"
        ),
        floorSubstrate: getStringFact(
          facts,
          card.workAreaId,
          "bathroom.floor_substrate_system"
        ),
        waterproofingIncluded: getBooleanFact(
          facts,
          card.workAreaId,
          "bathroom.waterproofing_included"
        ),
        floorFinish: getStringFact(
          facts,
          card.workAreaId,
          "bathroom.floor_finish_system"
        ),
        wallTileExtent:
          getStringFact(facts, card.workAreaId, "bathroom.tile_extent") ??
          getStringFact(facts, card.workAreaId, "bathroom.wall_tile_height"),
        waterproofingExtent: getStringFact(
          facts,
          card.workAreaId,
          "bathroom.waterproofing_extent"
        ),
        demolitionComponents: getArrayFact(
          facts,
          card.workAreaId,
          "bathroom.demolition.components"
        ),
        paintingIncluded: getBooleanFact(
          facts,
          card.workAreaId,
          "bathroom.painting_included"
        ),
        stoppingIncluded: getBooleanFact(
          facts,
          card.workAreaId,
          "bathroom.stopping_included"
        ),
      });
      const lengthKnown = getNumberFact(
        facts,
        card.workAreaId,
        "bathroom.length_m"
      );
      const widthKnown = getNumberFact(
        facts,
        card.workAreaId,
        "bathroom.width_m"
      );
      const floorKnown =
        (lengthKnown != null && widthKnown != null) ||
        getNumberFact(facts, card.workAreaId, "bathroom.floor_area_m2") !=
          null ||
        getNumberFact(facts, card.workAreaId, "bathroom.area_m2") != null ||
        (jobScope === "retile_floor" &&
          getNumberFact(
            facts,
            card.workAreaId,
            "bathroom.floor_tiling_area_m2"
          ) != null);
      const missing: {
        key: string;
        inputType: ClarifyCandidate["inputType"];
        rankScore: number;
      }[] = [];
      if (!jobScope) {
        missing.push({
          key: "bathroom.job_scope",
          inputType: "select",
          rankScore: 1000,
        });
      }
      if (geometryNeed !== "none" && !floorKnown) {
        if (lengthKnown == null) {
          missing.push({
            key: "bathroom.length_m",
            inputType: "number",
            rankScore: 999,
          });
        }
        if (widthKnown == null) {
          missing.push({
            key: "bathroom.width_m",
            inputType: "number",
            rankScore: 998,
          });
        }
      }
      for (const row of missing) {
        const template = getQuestionTemplateByKey(row.key);
        out.push({
          id: `hard:${card.workAreaId}:${row.key}`,
          source: "scope_fact",
          workAreaId: card.workAreaId,
          workAreaName: card.name,
          workAreaType: card.workAreaType,
          factKey: row.key,
          constraintKey: null,
          questionKey: row.key,
          label: safeFactPresentationLabel(row.key),
          question: safeFactQuestion(row.key, template?.questionText),
          askClass: "HARD_MINIMUM",
          inputType: row.inputType,
          unit: template?.unit,
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: true,
          assumable: false,
          rankScore: row.rankScore,
          rankReason: "HARD_MINIMUM bathroom core",
          assumptionStatement: null,
        });
      }
    }

    if (card.workAreaType === "internal_walls") {
      const facts = input.facts as EstimateFact[];
      const jobScope = parseInternalWallsJobScope(
        getStringFact(facts, card.workAreaId, INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)
      );
      const structural = parseInternalWallsStructuralInvolvement(
        getFact(facts, card.workAreaId, INTERNAL_WALLS_STRUCTURAL_FACT_KEY)?.value
      );
      const resolved = resolveInternalWallsWallTypes({
        facts,
        workAreaId: card.workAreaId,
      });
      const active =
        resolved.types.find((row) => row.id === resolved.activeId) ??
        resolved.types[0] ??
        null;
      const missing: {
        key: string;
        inputType: ClarifyCandidate["inputType"];
        rankScore: number;
        assumable?: boolean;
        statement?: string | null;
      }[] = [];
      if (!jobScope) {
        missing.push({
          key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
          inputType: "select",
          rankScore: 1000,
        });
      }
      if (structuralGateApplies(jobScope) && !structural) {
        missing.push({
          key: INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
          inputType: "select",
          rankScore: 999,
        });
      }
      const nextField = nextInternalWallsWallTypeField({
        type: active,
        jobScope,
      });
      if (
        wallTypesRequiredForScope(jobScope) &&
        (nextField === "internal_walls.wall_type.frame_system" ||
          nextField === "internal_walls.wall_type.frame_size" ||
          nextField === "internal_walls.wall_type.length_lm")
      ) {
        missing.push({
          key: nextField,
          inputType:
            nextField === "internal_walls.wall_type.length_lm"
              ? "number"
              : "select",
          rankScore: 998,
        });
      }
      for (const row of missing) {
        const template = getQuestionTemplateByKey(row.key);
        out.push({
          id: `hard:${card.workAreaId}:${row.key}`,
          source: "scope_fact",
          workAreaId: card.workAreaId,
          workAreaName: card.name,
          workAreaType: card.workAreaType,
          factKey: row.key,
          constraintKey: null,
          questionKey: row.key,
          label: safeFactPresentationLabel(row.key),
          question: safeFactQuestion(row.key, template?.questionText),
          askClass: "HARD_MINIMUM",
          inputType: row.inputType,
          unit: template?.unit,
          options: template?.options,
          currentValue: row.key.startsWith("internal_walls.wall_type.")
            ? wallTypeFieldCurrentValue(active, row.key)
            : undefined,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: true,
          assumable: false,
          rankScore: row.rankScore,
          rankReason: "HARD_MINIMUM internal walls core",
          assumptionStatement: null,
          wallTypeId: active?.id ?? null,
        });
      }
    }
  }
  return out;
}

function pushBathroomClarifyFact(
  out: ClarifyCandidate[],
  input: ComposeClarifyInput,
  wa: { id: string; name: string; type: string },
  key: string,
  reason: string,
  economicClass?: ClarifyEconomicClass
): void {
  if (!isClarifyExtraFactKey(key)) return;
  if (factHas(input, key, wa.id)) return;
  const template = getQuestionTemplateByKey(key);
  out.push({
    id: `fact:${wa.id}:${key}`,
    source: "scope_fact",
    workAreaId: wa.id,
    workAreaName: wa.name,
    workAreaType: wa.type,
    factKey: key,
    constraintKey: null,
    questionKey: key,
    label: safeFactPresentationLabel(key),
    question: safeFactQuestion(key, template?.questionText),
    askClass: "ASK_NOW",
    inputType: clarifyInputTypeFromTemplate(template),
    unit: template?.unit,
    options: template?.options,
    writeTarget: "FACT",
    write: null,
    blocksEstimate: false,
    assumable: economicClass !== "REQUIRED_FOR_ECONOMIC_MODEL",
    rankScore: CHECK_SCORES[key] ?? 60,
    rankReason: reason,
    assumptionStatement: null,
    economicClass,
  });
}

function extraCommercialFacts(input: ComposeClarifyInput): ClarifyCandidate[] {
  const out: ClarifyCandidate[] = [];
  for (const wa of input.workAreas.filter((w) => w.status !== "excluded")) {
    if (wa.type === "bathroom") {
      const facts = input.facts as EstimateFact[];
      const jobScope = resolveBathroomJobScope({
        jobScope: getStringFact(facts, wa.id, "bathroom.job_scope"),
        renovationType: getStringFact(facts, wa.id, "bathroom.renovation_type"),
      });
      const geometryNeed = bathroomGeometryNeed(jobScope, {
        tilingIncluded: getBooleanFact(facts, wa.id, "bathroom.tiling_included"),
        waterproofingIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.waterproofing_included"
        ),
        wallLiningIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.wall_lining_included"
        ),
        ceilingLiningIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.ceiling_lining_included"
        ),
        floorPrepIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.floor_prep_included"
        ),
        floorSubstrate: getStringFact(
          facts,
          wa.id,
          "bathroom.floor_substrate_system"
        ),
        floorFinish: getStringFact(facts, wa.id, "bathroom.floor_finish_system"),
        wallTileExtent:
          getStringFact(facts, wa.id, "bathroom.tile_extent") ??
          getStringFact(facts, wa.id, "bathroom.wall_tile_height"),
        waterproofingExtent: getStringFact(
          facts,
          wa.id,
          "bathroom.waterproofing_extent"
        ),
        demolitionComponents: getArrayFact(
          facts,
          wa.id,
          "bathroom.demolition.components"
        ),
        paintingIncluded: getBooleanFact(facts, wa.id, "bathroom.painting_included"),
        stoppingIncluded: getBooleanFact(facts, wa.id, "bathroom.stopping_included"),
      });
      if (
        geometryNeed === "full" &&
        getNumberFact(facts, wa.id, "bathroom.wall_height_m") == null
      ) {
        const heightKey = "bathroom.wall_height_m";
        const heightTemplate = getQuestionTemplateByKey(heightKey);
        out.push({
          id: `fact:${wa.id}:${heightKey}`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: heightKey,
          constraintKey: null,
          questionKey: heightKey,
          label: heightTemplate?.label ?? "Wall height",
          question:
            heightTemplate?.questionText ?? "What is the bathroom wall height?",
          askClass: "ASK_NOW",
          inputType: "number",
          unit: heightTemplate?.unit,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: true,
          rankScore: CHECK_SCORES[heightKey] ?? 70,
          rankReason: "Bathroom wall height",
          assumptionStatement: BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT,
        });
      }
      const key = "bathroom.plumbing.level";
      const legacyKey = "bathroom.plumbing_changes";
      if (
        bathroomQuestionGroupVisible("plumbing", jobScope) &&
        !factHas(input, key, wa.id) &&
        !factHas(input, legacyKey, wa.id)
      ) {
        const template = getQuestionTemplateByKey(key);
        out.push({
          id: `fact:${wa.id}:${key}`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: key,
          constraintKey: null,
          questionKey: key,
          label: template?.label ?? "Plumbing changes",
          question:
            template?.questionText ??
            "What level of plumbing changes are included?",
          askClass: "ASK_NOW",
          inputType: "select",
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: true,
          rankScore: CHECK_SCORES[key] ?? 60,
          rankReason: "Bathroom commercial plumbing",
          assumptionStatement: "Standard plumbing allowance",
        });
      }
      if (
        bathroomQuestionGroupVisible("demolition", jobScope) &&
        (jobScope === "strip_out_only" ||
          getBooleanFact(facts, wa.id, "bathroom.demolition_required") === true) &&
        !factHas(input, "bathroom.demolition.components", wa.id)
      ) {
        const template = getQuestionTemplateByKey("bathroom.demolition.components");
        out.push({
          id: `fact:${wa.id}:bathroom.demolition.components`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: "bathroom.demolition.components",
          constraintKey: null,
          questionKey: "bathroom.demolition.components",
          label: template?.label ?? "What is being stripped out",
          question:
            template?.questionText ?? "What existing bathroom items are being removed?",
          askClass: "ASK_NOW",
          inputType: "multi_select",
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: true,
          assumable: false,
          rankScore: CHECK_SCORES["bathroom.demolition.components"] ?? 87,
          rankReason: "Bathroom demolition scope",
          assumptionStatement: null,
        });
      }
      if (
        bathroomQuestionGroupVisible("fixtures", jobScope) &&
        jobScope !== "vanity_only" &&
        jobScope !== "shower_only" &&
        !factHas(input, "bathroom.fixtures_included", wa.id)
      ) {
        const template = getQuestionTemplateByKey("bathroom.fixtures_included");
        out.push({
          id: `fact:${wa.id}:bathroom.fixtures_included`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: "bathroom.fixtures_included",
          constraintKey: null,
          questionKey: "bathroom.fixtures_included",
          label: template?.label ?? "Fixtures included",
          question:
            template?.questionText ?? "Which bathroom fixtures are in this job?",
          askClass: "ASK_NOW",
          inputType: clarifyInputTypeFromTemplate(template),
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: true,
          rankScore: CHECK_SCORES["bathroom.fixtures_included"] ?? 58,
          rankReason: "Bathroom fixtures",
          assumptionStatement: null,
        });
      }
      const electricalKey = "bathroom.electrical.level";
      const electricalLegacy = "bathroom.electrical_changes";
      if (
        bathroomQuestionGroupVisible("electrical", jobScope) &&
        !factHas(input, electricalKey, wa.id) &&
        !factHas(input, electricalLegacy, wa.id)
      ) {
        const template = getQuestionTemplateByKey(electricalKey);
        out.push({
          id: `fact:${wa.id}:${electricalKey}`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: electricalKey,
          constraintKey: null,
          questionKey: electricalKey,
          label: template?.label ?? "Electrical changes",
          question:
            template?.questionText ??
            "What level of electrical work is included?",
          askClass: "ASK_NOW",
          inputType: "select",
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: true,
          rankScore: CHECK_SCORES[electricalKey] ?? 60,
          rankReason: "Bathroom commercial electrical",
          assumptionStatement: null,
        });
      }
      const finishFlags = {
        tilingIncluded: getBooleanFact(facts, wa.id, "bathroom.tiling_included"),
        waterproofingIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.waterproofing_included"
        ),
        wallLiningIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.wall_lining_included"
        ),
        ceilingLiningIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.ceiling_lining_included"
        ),
        floorPrepIncluded: getBooleanFact(
          facts,
          wa.id,
          "bathroom.floor_prep_included"
        ),
        floorSubstrate: getStringFact(
          facts,
          wa.id,
          "bathroom.floor_substrate_system"
        ),
        floorFinish: getStringFact(facts, wa.id, "bathroom.floor_finish_system"),
        wallTileExtent:
          getStringFact(facts, wa.id, "bathroom.tile_extent") ??
          getStringFact(facts, wa.id, "bathroom.wall_tile_height"),
        waterproofingExtent: getStringFact(
          facts,
          wa.id,
          "bathroom.waterproofing_extent"
        ),
        demolitionComponents: getArrayFact(
          facts,
          wa.id,
          "bathroom.demolition.components"
        ),
        paintingIncluded: getBooleanFact(facts, wa.id, "bathroom.painting_included"),
        stoppingIncluded: getBooleanFact(facts, wa.id, "bathroom.stopping_included"),
      };
      if (bathroomQuestionGroupVisible("floor_finish", jobScope, finishFlags)) {
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.floor_finish_system",
          "Bathroom floor finish XOR",
          "REQUIRED_FOR_ECONOMIC_MODEL"
        );
      }
      if (bathroomQuestionGroupVisible("tile_format", jobScope, finishFlags)) {
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.tile_format",
          "Tile format metadata"
        );
      }
      if (bathroomQuestionGroupVisible("wall_tiling", jobScope, finishFlags)) {
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.tile_extent",
          "Wall tiling extent"
        );
        if (parseBathroomWallTileExtent(finishFlags.wallTileExtent) === "custom") {
          pushBathroomClarifyFact(
            out,
            input,
            wa,
            "bathroom.wall_tiling_area_m2",
            "Custom wall tile area"
          );
        }
      }
      if (bathroomQuestionGroupVisible("shower_geometry", jobScope, finishFlags)) {
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.shower.width_m",
          "Shower width"
        );
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.shower.depth_m",
          "Shower depth"
        );
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.shower.wall_height_m",
          "Shower wall height"
        );
      }
      if (bathroomQuestionGroupVisible("waterproofing", jobScope, finishFlags) &&
        finishFlags.waterproofingIncluded === true
      ) {
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.waterproofing_extent",
          "Waterproofing extent"
        );
        const wpExtent = parseBathroomWaterproofingExtent(
          finishFlags.waterproofingExtent
        );
        if (wpExtent === "custom") {
          pushBathroomClarifyFact(
            out,
            input,
            wa,
            "bathroom.waterproofing_area_m2",
            "Custom waterproofing area"
          );
        }
        if (wpExtent === "bath_surround") {
          pushBathroomClarifyFact(
            out,
            input,
            wa,
            "bathroom.bath_surround_area_m2",
            "Bath surround area"
          );
        }
      }
      if (bathroomQuestionGroupVisible("floor_substrate", jobScope, finishFlags)) {
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.floor_substrate_system",
          "Bathroom floor build-up"
        );
        if (
          parseBathroomFloorSubstrate(
            getStringFact(facts, wa.id, "bathroom.floor_substrate_system")
          ) === "fibre_cement_flooring_19mm"
        ) {
          pushBathroomClarifyFact(
            out,
            input,
            wa,
            "bathroom.floor_substrate_sheet_size",
            "19 mm fibre-cement flooring size"
          );
        }
      }
      if (bathroomQuestionGroupVisible("framing", jobScope, finishFlags)) {
        pushBathroomClarifyFact(
          out,
          input,
          wa,
          "bathroom.framing_level",
          "Bathroom framing / nogging",
          "REQUIRED_FOR_ECONOMIC_MODEL"
        );
      }
      continue;
    }

    if (wa.type === "internal_walls") {
      const facts = input.facts as EstimateFact[];
      const jobScope = parseInternalWallsJobScope(
        getStringFact(facts, wa.id, INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)
      );
      const resolved = resolveInternalWallsWallTypes({
        facts,
        workAreaId: wa.id,
      });
      const active =
        resolved.types.find((row) => row.id === resolved.activeId) ??
        resolved.types[0] ??
        null;
      const nextField = nextInternalWallsWallTypeField({
        type: active,
        jobScope,
      });
      if (
        nextField &&
        nextField !== "internal_walls.wall_type.frame_system" &&
        nextField !== "internal_walls.wall_type.frame_size" &&
        nextField !== "internal_walls.wall_type.length_lm"
      ) {
        const template = getQuestionTemplateByKey(nextField);
        out.push({
          id: `fact:${wa.id}:${nextField}`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: nextField,
          constraintKey: null,
          questionKey: nextField,
          label: safeFactPresentationLabel(nextField),
          question: safeFactQuestion(nextField, template?.questionText),
          askClass:
            nextField === "internal_walls.wall_type.height_m"
              ? "ASSUME_IF_SKIPPED"
              : "ASK_NOW",
          inputType: clarifyInputTypeFromTemplate(template),
          unit: template?.unit,
          options: template?.options,
          currentValue: wallTypeFieldCurrentValue(active, nextField),
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: nextField === "internal_walls.wall_type.height_m",
          rankScore: CHECK_SCORES[nextField] ?? 70,
          rankReason: "Progressive wall type configuration",
          assumptionStatement:
            nextField === "internal_walls.wall_type.height_m"
              ? INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT
              : null,
          wallTypeId: active?.id ?? null,
        });
      }
      continue;
    }

    if (wa.type === "deck") {
      const facts = input.facts as EstimateFact[];
      if (!factHas(input, DECK_BOARD_WIDTH_FACT_KEY, wa.id)) {
        const template = getQuestionTemplateByKey(DECK_BOARD_WIDTH_FACT_KEY);
        out.push({
          id: `fact:${wa.id}:${DECK_BOARD_WIDTH_FACT_KEY}`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: DECK_BOARD_WIDTH_FACT_KEY,
          constraintKey: null,
          questionKey: DECK_BOARD_WIDTH_FACT_KEY,
          label: template?.label ?? "Decking board width",
          question:
            template?.questionText ?? "How wide are the decking boards?",
          askClass: "ASK_NOW",
          inputType: "number",
          unit: template?.unit ?? "mm",
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: true,
          rankScore: CHECK_SCORES[DECK_BOARD_WIDTH_FACT_KEY] ?? 88,
          rankReason: "REQUIRED_FOR_ECONOMIC_MODEL board width",
          assumptionStatement: DECK_BOARD_WIDTH_ASSUMPTION_STATEMENT,
          economicClass: "REQUIRED_FOR_ECONOMIC_MODEL",
        });
      }
      const stepsActive = deckStepsCommerciallyIncluded({
        facts,
        workAreaId: wa.id,
      });
      if (stepsActive && !factHas(input, "deck.step_width_m", wa.id)) {
        const template = getQuestionTemplateByKey("deck.step_width_m");
        out.push({
          id: `fact:${wa.id}:deck.step_width_m`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: "deck.step_width_m",
          constraintKey: null,
          questionKey: "deck.step_width_m",
          label: template?.label ?? "Step width",
          question: template?.questionText ?? "How wide are the steps?",
          askClass: "ASK_NOW",
          inputType: "number",
          unit: template?.unit ?? "m",
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: true,
          rankScore: 82,
          rankReason: "REQUIRED_FOR_ECONOMIC_MODEL step width",
          assumptionStatement: STEP_WIDTH_ASSUMPTION_STATEMENT,
          economicClass: "REQUIRED_FOR_ECONOMIC_MODEL",
        });
      }
      continue;
    }

    if (wa.type === "fence") {
      const facts = input.facts as EstimateFact[];
      if (
        !fenceHasCoreLength(facts, wa.id) ||
        !fenceHasCoreHeight(facts, wa.id) ||
        fenceSystemReadiness(facts, wa.id) !== "SUPPORTED"
      ) {
        continue;
      }
      const system = classifyFenceSystem(
        getStringFact(facts, wa.id, "fence.system") ??
          getStringFact(facts, wa.id, "fence.material"),
        getStringFact(facts, wa.id, "fence.paling_or_panel_type")
      );
      const extras: { key: string; reason: string; score: number }[] = [];
      if (isTimberFenceSystem(system)) {
        extras.push(
          {
            key: "fence.board_thickness_mm",
            reason: "Timber board thickness",
            score: 78,
          },
          {
            key: "fence.top_capping",
            reason: "Timber top capping",
            score: 74,
          }
        );
        if (fenceGateScopeApplies(system)) {
          extras.push({
            key: "fence.gate_included",
            reason: "Fence gate",
            score: 76,
          });
        }
        if (system === "TIMBER_HORIZONTAL_SLAT") {
          extras.push({
            key: "fence.slat_gap_mm",
            reason: "Horizontal slat gap",
            score: 80,
          });
        } else {
          extras.push({
            key: "fence.post_spacing_m",
            reason: "Timber post spacing if non-standard",
            score: 60,
          });
        }
        extras.push({
          key: "fence.timber_species",
          reason: "Visible timber species",
          score: 62,
        });
      } else if (isModularFenceSystem(system)) {
        extras.push({
          key: "fence.section_width_m",
          reason: "Modular section width / product",
          score: 80,
        });
      }
      extras.push({
        key: "fence.demolition_required",
        reason: "Existing fence removal",
        score: 68,
      });
      for (const extra of extras) {
        if (factHas(input, extra.key, wa.id)) continue;
        const cls = fenceFactQuestionClass(extra.key);
        if (cls === "REFINE" || cls === "DERIVED" || cls === "NOT_CONSUMED") {
          continue;
        }
        if (!isClarifyExtraFactKey(extra.key)) continue;
        const template = getQuestionTemplateByKey(extra.key);
        out.push({
          id: `fact:${wa.id}:${extra.key}`,
          source: "scope_fact",
          workAreaId: wa.id,
          workAreaName: wa.name,
          workAreaType: wa.type,
          factKey: extra.key,
          constraintKey: null,
          questionKey: extra.key,
          label: safeFactPresentationLabel(extra.key),
          question: safeFactQuestion(extra.key, template?.questionText),
          askClass: "ASK_NOW",
          inputType: clarifyInputTypeFromTemplate(template),
          options: template?.options,
          writeTarget: "FACT",
          write: null,
          blocksEstimate: false,
          assumable: true,
          rankScore: extra.score,
          rankReason: extra.reason,
          assumptionStatement: null,
        });
      }
      continue;
    }

    if (wa.type !== "retaining_wall") continue;
    const facts = input.facts as EstimateFact[];
    if (
      !retainingWallHasCoreLength(facts, wa.id) ||
      !retainingWallHasCoreHeight(facts, wa.id) ||
      retainingWallMaterialReadiness(facts, wa.id) !== "SUPPORTED"
    ) {
      continue;
    }
    const system = classifyRetainingWallSystem(
      getStringFact(facts, wa.id, "retaining_wall.material")
    );
    const extras: { key: string; reason: string; score: number }[] = [
      {
        key: "retaining_wall.surcharge",
        reason: "Retaining wall surcharge / load",
        score: 82,
      },
      {
        key: "retaining_wall.excavation_required",
        reason: "Retaining wall excavation scope",
        score: 70,
      },
      {
        key: "retaining_wall.drainage_required",
        reason: "Retaining wall drainage / novacoil",
        score: 68,
      },
      {
        key: "retaining_wall.backfill_included",
        reason: "Retaining wall backfill scope",
        score: 66,
      },
    ];
    const excavationYes =
      getBooleanFact(facts, wa.id, "retaining_wall.excavation_required") === true;
    if (excavationYes && !factHas(input, "retaining_wall.digger_access", wa.id)) {
      extras.push({
        key: "retaining_wall.digger_access",
        reason: "Mini excavator / digger access for excavation method",
        score: 72,
      });
    }
    if (system === "CONCRETE_MASONRY_WALL") {
      extras.push({
        key: "retaining_wall.waterproofing_required",
        reason: "Masonry waterproofing",
        score: 64,
      });
    }
    if (system === "TIMBER_RETAINING_WALL") {
      extras.push({
        key: "retaining_wall.face_board_section",
        reason: "Timber face-board identity",
        score: 58,
      });
    }
    for (const extra of extras) {
      if (factHas(input, extra.key, wa.id)) continue;
      if (retainingWallFactQuestionClass(extra.key) === "REFINE") continue;
      if (!isClarifyExtraFactKey(extra.key)) continue;
      const template = getQuestionTemplateByKey(extra.key);
      out.push({
        id: `fact:${wa.id}:${extra.key}`,
        source: "scope_fact",
        workAreaId: wa.id,
        workAreaName: wa.name,
        workAreaType: wa.type,
        factKey: extra.key,
        constraintKey: null,
        questionKey: extra.key,
        label: safeFactPresentationLabel(extra.key),
        question: safeFactQuestion(extra.key, template?.questionText),
        askClass: "ASK_NOW",
        inputType: clarifyInputTypeFromTemplate(template),
        options: template?.options,
        writeTarget: "FACT",
        write: null,
        blocksEstimate: false,
        assumable: true,
        rankScore: extra.score,
        rankReason: extra.reason,
        assumptionStatement: null,
      });
    }
  }
  return out;
}

function canonicalCarryDistanceIsKnown(input: ComposeClarifyInput): boolean {
  if (constraintIsKnown(input.constraints, "material_carry_distance")) {
    return true;
  }
  return input.facts.some(
    (fact) =>
      fact.key === "retaining_wall.carting_distance_m" && isKnownValue(fact.value)
  );
}

function fallbackProjectCondition(
  input: ComposeClarifyInput,
  params: {
    targetKey: string;
    questionKey: string;
    question: string;
    options: readonly string[];
    score: number;
    assumption: string;
    inputType?: ClarifyCandidate["inputType"];
    economicClass?: ClarifyCandidate["economicClass"];
  }
): ClarifyCandidate | null {
  if (constraintIsKnown(input.constraints, params.targetKey)) return null;
  if (
    params.targetKey === "material_carry_distance" &&
    canonicalCarryDistanceIsKnown(input)
  ) {
    return null;
  }
  if (briefImpliesConstraint(input.briefText, params.targetKey)) return null;
  return {
    id: `pc:${params.targetKey}`,
    source: "project_condition",
    workAreaId: null,
    workAreaName: null,
    workAreaType: null,
    factKey: null,
    constraintKey: params.targetKey,
    questionKey: params.questionKey,
    label: safeFactPresentationLabel(params.targetKey),
    question: params.question,
    askClass: "ASK_NOW",
    inputType: params.inputType ?? "select",
    options: params.options,
    writeTarget: "CONSTRAINT",
    write: null,
    blocksEstimate: false,
    assumable: true,
    rankScore: params.score,
    rankReason: `Project Condition · ${params.targetKey}`,
    assumptionStatement: params.assumption,
    economicClass: params.economicClass,
  };
}

function projectConditionCandidates(
  input: ComposeClarifyInput
): ClarifyCandidate[] {
  const pc =
    input.pcCandidates ??
    previewProjectConditionAskCandidates({
      workAreas: input.workAreas.map((wa, index) => ({
        id: wa.id,
        type: wa.type,
        name: wa.name,
        status:
          wa.status === "confirmed" ||
          wa.status === "excluded" ||
          wa.status === "suggested"
            ? wa.status
            : "suggested",
        sortOrder: index,
      })),
      facts: input.facts.map((f) => ({
        key: f.key,
        workAreaId: f.work_area_id,
        value: f.value,
      })),
      constraints: input.constraints.map((c) => ({
        key: c.key,
        value: c.value,
      })),
    });

  const fromPreview: ClarifyCandidate[] = pc.flatMap((c) => {
    if (constraintIsKnown(input.constraints, c.targetKey)) return [];
    if (
      c.targetKey === "material_carry_distance" &&
      canonicalCarryDistanceIsKnown(input)
    ) {
      return [];
    }
    if (briefImpliesConstraint(input.briefText, c.targetKey)) return [];
    if (c.inputType === "multi_select") return [];
    const bathroom = bathroomWorkAreaPresent(input);
    const p0 = (BATHROOM_P0_CONDITION_KEYS as readonly string[]).includes(
      c.targetKey
    );
    const p1 = (BATHROOM_P1_CONDITION_KEYS as readonly string[]).includes(
      c.targetKey
    );
    const consumed = (SHARED_CONSUMED_CONSTRAINT_KEYS as readonly string[]).includes(
      c.targetKey
    );
    if (bathroom) {
      if (!p0 && !p1) return [];
    } else if (!consumed) {
      return [];
    }
    const score = PC_SCORES[c.targetKey] ?? 25;
    if (!bathroom && score < 30) return [];
    return [
      {
        id: `pc:${c.targetKey}`,
        source: "project_condition" as const,
        workAreaId: null,
        workAreaName: null,
        workAreaType: null,
        factKey: null,
        constraintKey: c.targetKey,
        questionKey: c.questionKey,
        label: safeFactPresentationLabel(c.targetKey),
        question: c.question,
        askClass: "ASK_NOW" as const,
        inputType: clarifyStoredInputType({
          inputType: c.inputType,
          options: c.options,
        }),
        options: c.options,
        writeTarget: "CONSTRAINT" as const,
        write: null,
        blocksEstimate: false,
        assumable: true,
        rankScore: score,
        rankReason: `Project Condition · ${c.targetKey}`,
        assumptionStatement:
          c.targetKey === "site_access"
            ? "Standard access"
            : c.targetKey === "material_carry_distance"
              ? "Standard carry"
              : c.targetKey === "occupied_site"
                ? "Unoccupied site"
                : c.targetKey === "working_hours"
                  ? "Normal working hours"
                  : c.targetKey === "floor_level"
                    ? "Ground floor"
                    : c.targetKey === "waste_bin_access"
                      ? "Standard waste handling"
                      : null,
        economicClass:
          bathroom && p0 ? ("REQUIRED_FOR_ECONOMIC_MODEL" as const) : undefined,
      },
    ];
  });

  const extras = [
    fallbackProjectCondition(input, {
      targetKey: "site_access",
      questionKey: "interview.site.site_access",
      question: "How difficult is site access?",
      options: ["Easy", "Moderate", "Difficult", "Very poor"],
      score: PC_SCORES.site_access,
      assumption: "Standard access",
      economicClass: bathroomWorkAreaPresent(input)
        ? "REQUIRED_FOR_ECONOMIC_MODEL"
        : undefined,
    }),
    fallbackProjectCondition(input, {
      targetKey: "material_carry_distance",
      questionKey: "interview.site.material_carry_distance",
      question: "Distance from material drop-off or waste carting?",
      options: ["< 10m", "10–30m", "> 30m", "Not sure"],
      score: PC_SCORES.material_carry_distance,
      assumption: "Standard carry",
      economicClass: bathroomWorkAreaPresent(input)
        ? "REQUIRED_FOR_ECONOMIC_MODEL"
        : undefined,
    }),
    fallbackProjectCondition(input, {
      targetKey: "occupied_site",
      questionKey: "interview.site.occupied_site",
      question: "Is the site occupied during works?",
      options: ["Yes", "No", "Not sure"],
      score: PC_SCORES.occupied_site,
      assumption: "Unoccupied site",
      inputType: "select",
      economicClass: bathroomWorkAreaPresent(input)
        ? "REQUIRED_FOR_ECONOMIC_MODEL"
        : undefined,
    }),
    fallbackProjectCondition(input, {
      targetKey: "working_hours",
      questionKey: "interview.site.working_hours",
      question: "Are there working-hour restrictions?",
      options: ["No", "Yes", "Not sure"],
      score: PC_SCORES.working_hours,
      assumption: "Normal working hours",
      inputType: "select",
      economicClass: bathroomWorkAreaPresent(input)
        ? "REQUIRED_FOR_ECONOMIC_MODEL"
        : undefined,
    }),
  ].filter((row): row is ClarifyCandidate => row != null);

  const seen = new Set(fromPreview.map((c) => c.constraintKey ?? c.id));
  for (const extra of extras) {
    const seenKey = extra.constraintKey ?? extra.id;
    if (!seen.has(seenKey)) fromPreview.push(extra);
  }
  return fromPreview;
}

export function composeClarifyView(input: ComposeClarifyInput): ClarifyView {
  const raw: ClarifyCandidate[] = [];

  for (const card of input.jobPlan.cards) {
    for (const item of card.notConfirmed) {
      const candidate = candidateFromJobPlanCheck(input, card, item);
      if (candidate) raw.push(candidate);
    }
  }

  raw.push(...missingHardMinimum(input));
  raw.push(...extraCommercialFacts(input));
  raw.push(...projectConditionCandidates(input));

  const filtered = raw.filter((c) => c.askClass !== "ADVANCED");
  const ranked = sortClarifyCandidates(filtered);
  const confirmedCount = input.workAreas.filter(
    (w) => w.status !== "excluded"
  ).length;
  let { visible, deferred } = allocateClarifyBudget(ranked, confirmedCount);
  if (
    visible.length === 0 &&
    ranked.some(isInitialCaptureQuestion)
  ) {
    const leftover = ranked.filter(isInitialCaptureQuestion);
    const batch = leftover.slice(0, clarifyQuestionBudget(confirmedCount));
    const batchIds = new Set(batch.map((c) => c.id));
    visible = batch;
    deferred = ranked.filter((c) => !batchIds.has(c.id));
  }
  const skippedForAssumptions = [...visible, ...deferred].filter(
    (c) => !isInitialCaptureQuestion(c) && c.assumable && !c.blocksEstimate
  );
  const estimateNowAssumptions = assumptionsFromSkipped(skippedForAssumptions).filter(
    (row) =>
      row.factKey !== "bathroom.tiling_included" ||
      !suppressMatureUnansweredBathroomTiling(input, row.workAreaId)
  );
  const assumptions = assumptionsFromSkipped(
    deferred.filter((c) => !isInitialCaptureQuestion(c))
  ).filter(
    (row) =>
      row.factKey !== "bathroom.tiling_included" ||
      !suppressMatureUnansweredBathroomTiling(input, row.workAreaId)
  );
  for (const persisted of assumptionsFromPersistedFacts(input.facts)) {
    const already = estimateNowAssumptions.some(
      (row) =>
        row.factKey === persisted.factKey &&
        row.workAreaId === persisted.workAreaId
    );
    if (!already) estimateNowAssumptions.push(persisted);
  }
  if (
    !input.qualityLevel ||
    input.qualityLevel === "unknown"
  ) {
    const finish: ReturnType<typeof assumptionsFromSkipped>[number] = {
      id: "assumption:quality_level",
      label: "Finish level",
      statement: "Standard finish",
      factKey: null,
      constraintKey: "quality_level",
      workAreaId: null,
      source: "assumption",
      persistedExclusion: false,
    };
    if (!estimateNowAssumptions.some((a) => a.statement === "Standard finish")) {
      estimateNowAssumptions.push(finish);
    }
  }
  const blocksEstimate = ranked.some((c) => c.blocksEstimate);
  const remainingRequiredCount = ranked.filter(isInitialCaptureQuestion).length;
  const enoughToEstimate = remainingRequiredCount === 0 && !blocksEstimate;

  const withCurrent = (rows: readonly ClarifyCandidate[]): ClarifyCandidate[] =>
    rows.map((candidate) => {
      const key = candidate.constraintKey ?? candidate.factKey;
      if (!key) return candidate;
      const rawValue = currentFactOrConstraintValue(
        input,
        key,
        candidate.workAreaId
      );
      if (rawValue == null) return candidate;
      return { ...candidate, currentValue: rawValue as ClarifyCandidate["currentValue"] };
    });

  return {
    candidates: withCurrent(visible),
    deferred: withCurrent(deferred),
    assumptions,
    estimateNowAssumptions,
    visibleCount: visible.length,
    remainingRequiredCount,
    blocksEstimate,
    canEstimateNow: !blocksEstimate && remainingRequiredCount === 0,
    enoughToEstimate,
  };
}

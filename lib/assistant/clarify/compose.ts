import { previewProjectConditionAskCandidates } from "@/lib/builder-interview/project-filter";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import { getLevel1BlockingClass } from "@/lib/scopes/level1-blocking";
import { assumptionsFromPersistedFacts, assumptionsFromSkipped } from "@/lib/assistant/clarify/assumptions";
import { allocateClarifyBudget, sortClarifyCandidates } from "@/lib/assistant/clarify/rank";
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
  getBooleanFact,
  getStringFact,
  hasFactValue,
  isNotSureValue,
} from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

const PC_SCORES: Record<string, number> = {
  site_access: 85,
  material_carry_distance: 48,
  waste_bin_access: 40,
  occupied_site: 35,
  working_hours: 30,
};

const CHECK_SCORES: Record<string, number> = {
  "deck.existing_deck_removal": 90,
  "deck.board_width_mm": 88,
  "bathroom.demolition_required": 88,
  "fence.demolition_required": 88,
  "fence.gate_included": 86,
  "fence.top_capping": 70,
  "deck.vertical_face_boards_required": 55,
  "deck.skirting_included": 52,
  "deck.access_type": 35,
  "deck.balustrade_required": 20,
  "bathroom.plumbing_changes": 62,
};

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
  }
  return out;
}

function extraCommercialFacts(input: ComposeClarifyInput): ClarifyCandidate[] {
  const out: ClarifyCandidate[] = [];
  for (const wa of input.workAreas.filter((w) => w.status !== "excluded")) {
    if (wa.type === "bathroom") {
      const key = "bathroom.plumbing_changes";
      if (factHas(input, key, wa.id)) continue;
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
          template?.questionText ?? "What level of plumbing changes are included?",
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
          inputType:
            template?.inputType === "boolean"
              ? "boolean"
              : template?.inputType === "number"
                ? "number"
                : "select",
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
        inputType:
          template?.inputType === "boolean"
            ? "boolean"
            : template?.inputType === "number"
              ? "number"
              : "select",
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
    inputType: "select",
    options: params.options,
    writeTarget: "CONSTRAINT",
    write: null,
    blocksEstimate: false,
    assumable: true,
    rankScore: params.score,
    rankReason: `Project Condition · ${params.targetKey}`,
    assumptionStatement: params.assumption,
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
    // Initial Clarify only ranks commercially material PC questions.
    if (
      c.targetKey !== "site_access" &&
      c.targetKey !== "material_carry_distance"
    ) {
      return [];
    }
    const score = PC_SCORES[c.targetKey] ?? 25;
    if (score < 30) return [];
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
        inputType:
          c.inputType === "boolean"
            ? ("boolean" as const)
            : c.inputType === "number"
              ? ("number" as const)
              : ("select" as const),
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
              : null,
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
    }),
    fallbackProjectCondition(input, {
      targetKey: "material_carry_distance",
      questionKey: "interview.site.material_carry_distance",
      question: "Distance from material drop-off or waste carting?",
      options: ["< 10m", "10–30m", "> 30m", "Not sure"],
      score: PC_SCORES.material_carry_distance,
      assumption: "Standard carry",
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
  const { visible, deferred } = allocateClarifyBudget(ranked, confirmedCount);
  const assumptions = assumptionsFromSkipped(deferred);
  const estimateNowAssumptions = assumptionsFromSkipped([
    ...visible.filter((c) => c.assumable && !c.blocksEstimate),
    ...deferred,
  ]);
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
  const blocksEstimate = visible.some((c) => c.blocksEstimate);
  const remainingRequiredCount = visible.filter(
    (c) =>
      c.askClass === "HARD_MINIMUM" ||
      c.blocksEstimate ||
      c.economicClass === "REQUIRED_FOR_ECONOMIC_MODEL"
  ).length;
  const enoughToEstimate = remainingRequiredCount === 0 && !blocksEstimate;

  return {
    candidates: visible,
    deferred,
    assumptions,
    estimateNowAssumptions,
    visibleCount: visible.length,
    remainingRequiredCount,
    blocksEstimate,
    canEstimateNow: !blocksEstimate && remainingRequiredCount === 0,
    enoughToEstimate,
  };
}

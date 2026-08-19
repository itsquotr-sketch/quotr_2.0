import { previewProjectConditionAskCandidates } from "@/lib/builder-interview/project-filter";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import { getLevel1BlockingClass } from "@/lib/scopes/level1-blocking";
import { assumptionsFromSkipped } from "@/lib/assistant/clarify/assumptions";
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
import type {
  ClarifyAskClass,
  ClarifyCandidate,
  ClarifyView,
  ComposeClarifyInput,
} from "@/lib/assistant/clarify/types";

const PC_SCORES: Record<string, number> = {
  site_access: 85,
  material_carry_distance: 48,
  waste_bin_access: 40,
  occupied_site: 35,
  working_hours: 30,
};

const CHECK_SCORES: Record<string, number> = {
  "deck.existing_deck_removal": 90,
  "bathroom.demolition_required": 88,
  "deck.vertical_face_boards_required": 55,
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
  if (!row || !isKnownValue(row.value)) return false;
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
  };
}

function missingHardMinimum(
  input: ComposeClarifyInput
): ClarifyCandidate[] {
  const out: ClarifyCandidate[] = [];
  for (const card of input.jobPlan.cards) {
    for (const key of ["deck.length_m", "deck.width_m", "deck.area_m2"] as const) {
      if (card.workAreaType !== "deck") continue;
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
        label: template?.label ?? key,
        question: template?.questionText ?? `What is ${key}?`,
        askClass: "HARD_MINIMUM",
        inputType: "number",
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
  return out;
}

function extraCommercialFacts(input: ComposeClarifyInput): ClarifyCandidate[] {
  const out: ClarifyCandidate[] = [];
  for (const wa of input.workAreas.filter((w) => w.status !== "excluded")) {
    if (wa.type !== "bathroom") continue;
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
  }
  return out;
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
    label: params.targetKey.replace(/_/g, " "),
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
        label: c.targetKey.replace(/_/g, " "),
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
  const enoughToEstimate = visible.length === 0 && !blocksEstimate;

  return {
    candidates: visible,
    deferred,
    assumptions,
    estimateNowAssumptions,
    visibleCount: visible.length,
    blocksEstimate,
    canEstimateNow: !blocksEstimate,
    enoughToEstimate,
  };
}

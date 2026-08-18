/**
 * DECK-2B-R1 — Global Level 1 question budget (Scope + Project Conditions).
 */

import type { InterviewCandidate } from "@/lib/builder-interview/types";
import { MAX_QUICK_ESTIMATE_P0_QUESTIONS } from "@/lib/scopes/estimate-priority";
import type { BuiltQuestion } from "@/lib/scopes/questions";

export type Level1QuestionSource = "scope" | "project_conditions";

export type Level1RankedQuestion = {
  readonly source: Level1QuestionSource;
  readonly key: string;
  readonly label: string;
  readonly score: number;
  readonly scopeQuestion?: BuiltQuestion;
  readonly pcCandidate?: InterviewCandidate;
};

const SCOPE_SCORES: Record<string, number> = {
  "deck.existing_deck_removal": 100,
  "deck.length_m": 98,
  "deck.width_m": 97,
  "deck.area_m2": 96,
  "deck.board_material": 75,
  "deck.height_m": 55,
};

const PC_SCORES: Record<string, number> = {
  site_access: 95,
  material_carry_distance: 94,
  waste_bin_access: 92,
  services_isolated: 70,
  hazardous_materials_risk: 68,
  floor_level: 60,
  site_slope: 45,
  occupied_site: 40,
  working_hours: 38,
  consent_engineering: 35,
};

function scoreScopeQuestion(question: BuiltQuestion): number {
  return SCOPE_SCORES[question.key] ?? (question.required ? 50 : 30);
}

function scorePcCandidate(candidate: InterviewCandidate): number {
  const base = PC_SCORES[candidate.targetKey] ?? 30;
  const priorityBoost =
    candidate.priority === "P0" ? 10 : candidate.priority === "P1" ? 5 : 0;
  return base + priorityBoost;
}

export function rankLevel1Questions(params: {
  readonly scopeQuestions: readonly BuiltQuestion[];
  readonly pcCandidates: readonly InterviewCandidate[];
}): Level1RankedQuestion[] {
  const ranked: Level1RankedQuestion[] = [];

  for (const question of params.scopeQuestions) {
    ranked.push({
      source: "scope",
      key: question.key,
      label: question.label,
      score: scoreScopeQuestion(question),
      scopeQuestion: question,
    });
  }

  for (const candidate of params.pcCandidates) {
    ranked.push({
      source: "project_conditions",
      key: candidate.questionKey,
      label: candidate.question,
      score: scorePcCandidate(candidate),
      pcCandidate: candidate,
    });
  }

  return ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.source !== b.source) {
      return a.source === "scope" ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
}

export function allocateLevel1QuestionBudget(
  ranked: readonly Level1RankedQuestion[],
  max = MAX_QUICK_ESTIMATE_P0_QUESTIONS
): {
  readonly selected: readonly Level1RankedQuestion[];
  readonly deferred: readonly Level1RankedQuestion[];
} {
  const selected = ranked.slice(0, max);
  const deferred = ranked.slice(max);
  return { selected, deferred };
}

export function planLevel1Questions(params: {
  readonly scopeQuestions: readonly BuiltQuestion[];
  readonly pcCandidates: readonly InterviewCandidate[];
  readonly max?: number;
}): {
  readonly scopeQuestions: BuiltQuestion[];
  readonly pcCandidates: InterviewCandidate[];
  readonly totalSelected: number;
  readonly deferred: readonly Level1RankedQuestion[];
} {
  const ranked = rankLevel1Questions(params);
  const { selected, deferred } = allocateLevel1QuestionBudget(
    ranked,
    params.max ?? MAX_QUICK_ESTIMATE_P0_QUESTIONS
  );

  const scopeQuestions = selected
    .filter((item) => item.source === "scope" && item.scopeQuestion)
    .map((item, index) => ({
      ...item.scopeQuestion!,
      sortOrder: index + 1,
    }));

  const pcCandidates = selected
    .filter((item) => item.source === "project_conditions" && item.pcCandidate)
    .map((item) => item.pcCandidate!);

  return {
    scopeQuestions,
    pcCandidates,
    totalSelected: selected.length,
    deferred,
  };
}

export function remainingLevel1QuestionBudget(scopeQuestionCount: number): number {
  return Math.max(0, MAX_QUICK_ESTIMATE_P0_QUESTIONS - scopeQuestionCount);
}

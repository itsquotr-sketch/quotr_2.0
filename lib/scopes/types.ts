import type { AppQuestionInputType } from "@/lib/scopes/question-input-types";
import type { EstimatePriorityClass } from "@/lib/scopes/estimate-priority";
import type { Level1BlockingClass } from "@/lib/scopes/level1-blocking";

/** App/presentation input types. DB persists a subset — see question-input-types. */
export type ScopeQuestionInputType = AppQuestionInputType;

export type ScopeQuestionCategory =
  | "measurement"
  | "scope"
  | "finish"
  | "allowance"
  | "risk"
  | "framing"
  | "supports"
  | "footings";

export type ScopeQuestionTemplate = {
  key: string;
  label: string;
  questionText: string;
  inputType: ScopeQuestionInputType;
  options?: string[];
  unit?: string;
  required: boolean;
  priority: number;
  /** DECK-2B — Quick Estimate ask priority (P3 never asked at Level 1). */
  estimatePriorityClass?: EstimatePriorityClass;
  /** DECK-2B-R1 — whether missing fact blocks Estimate now at Level 1. */
  level1BlockingClass?: Level1BlockingClass;
  factKey: string;
  workAreaType: string;
  category?: ScopeQuestionCategory;
};

export type ScopeDefinition = {
  type: string;
  label: string;
  questions: ScopeQuestionTemplate[];
};

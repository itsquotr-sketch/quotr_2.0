/**
 * PERFORMANCE-01C-4 — which loadAssistantMutationResult reads stay fresh.
 *
 * Classification for the scalar Details mutation tail:
 *
 * A. MUST BE FRESH AFTER MUTATION
 *    - ownership (uncached assertOrgOwnsActiveProject)
 *    - project_facts (user + derived writes)
 *    - estimates / is_stale (markEstimateStaleWithContext)
 *    - questions + question_blocks (ensureMissingDetails / answer mirror)
 *
 * B. SAFE TO THREAD / SAME-REQUEST REUSE
 *    - organisation_settings via 01B request-scoped reader
 *      (scalar Details does not mutate it; no create-if-missing)
 *    - work_areas, scalar path only, after the post-commit same-request
 *      load. updateProjectFact does not mutate work_areas; derived persist,
 *      ensureMissingDetails, and mark-stale do not either.
 *
 * C. CONDITIONAL / LEAVE FRESH
 *    - projects (stage / brief / quality): prefer correctness; 01C-2
 *      pre-write row lacks brief_text and must not cross the mutation
 *      boundary as ownership.
 *    - constraints: Project Conditions are a separate path.
 *    - work_areas on Internal Walls / work-area / Analyse / interview
 *      callers: leave the result reload fresh.
 */

import { isInternalWallsWallTypeWriteKey } from "@/lib/estimate/internal-walls-wall-types";

export type AssistantMutationWorkAreaRow = {
  id: string;
  type: string;
  name: string;
  status: string;
  ai_confidence: number | null;
  summary: string | null;
  quote_description: string | null;
  sort_order: number;
  created_at?: string;
};

export type AssistantMutationResultReuse = {
  workAreas?: readonly AssistantMutationWorkAreaRow[] | null;
};

export type MutationResultReloadKind =
  | "fresh"
  | "reuse"
  | "request_scoped_reader";

export type AssistantMutationResultReloadPlan = {
  ownership: "fresh";
  project: "fresh";
  workAreas: "fresh" | "reuse";
  questionBlocks: "fresh";
  questions: "fresh";
  constraints: "fresh";
  estimates: "fresh";
  projectFacts: "fresh";
  organisationSettings: "request_scoped_reader";
};

export function planAssistantMutationResultReloads(
  reuse?: AssistantMutationResultReuse | null
): AssistantMutationResultReloadPlan {
  return {
    ownership: "fresh",
    project: "fresh",
    workAreas: Array.isArray(reuse?.workAreas) ? "reuse" : "fresh",
    questionBlocks: "fresh",
    questions: "fresh",
    constraints: "fresh",
    estimates: "fresh",
    projectFacts: "fresh",
    organisationSettings: "request_scoped_reader",
  };
}

export function scalarFactWorkAreaReuse(input: {
  key: string;
  workAreas: readonly AssistantMutationWorkAreaRow[] | null | undefined;
  error?: { message?: string } | null;
}): AssistantMutationResultReuse | undefined {
  if (isInternalWallsWallTypeWriteKey(input.key)) {
    return undefined;
  }
  if (input.error || !Array.isArray(input.workAreas)) {
    return undefined;
  }
  return { workAreas: input.workAreas };
}

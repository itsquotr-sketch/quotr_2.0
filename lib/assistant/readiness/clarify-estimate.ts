/**
 * Single estimate-permission authority for mature Work Areas.
 * Details Ready and generateEstimate must share this function.
 */

import { composeClarifyView } from "@/lib/assistant/clarify/compose";
import type { ClarifyCandidate, ComposeClarifyInput } from "@/lib/assistant/clarify/types";
import { isInitialCaptureQuestion } from "@/lib/assistant/clarify/question-contract";
import { composeJobPlan } from "@/lib/assistant/job-plan/compose";
import type { ComposeJobPlanInput } from "@/lib/assistant/job-plan/types";
import { evaluatePackageQuickEstimateReadiness } from "@/lib/assistant/readiness/package-quick-estimate";
import { filterEstimateBlockingProjectConditionKeys } from "@/lib/scopes/level1-blocking";

export type ClarifyEstimateReadinessDiagnostics = {
  readonly remainingRequiredCount: number;
  readonly blockingInfoRequired: readonly string[];
  readonly pricingRequired: readonly string[];
  readonly pendingWrites: number;
  readonly unresolved: readonly {
    readonly id: string;
    readonly factKey: string | null;
    readonly wallTypeId: string | null;
    readonly question: string;
  }[];
};

export type ClarifyEstimateReadiness = {
  readonly ready: boolean;
  readonly builderCopy: string | null;
  readonly diagnostics: ClarifyEstimateReadinessDiagnostics;
};

export function unresolvedEstimateCopy(candidate: ClarifyCandidate): string {
  if (candidate.question.trim()) return candidate.question;
  if (candidate.label.trim()) return `Finish ${candidate.label}.`;
  return "Finish answering the remaining required details.";
}

export function evaluateClarifyEstimateReadiness(
  input: ComposeClarifyInput & { readonly pendingWrites?: number }
): ClarifyEstimateReadiness {
  const clarify = composeClarifyView(input);
  const unresolved = [...clarify.candidates, ...clarify.deferred].filter(
    isInitialCaptureQuestion
  );
  const pendingWrites = input.pendingWrites ?? 0;
  const ready =
    clarify.enoughToEstimate &&
    clarify.canEstimateNow &&
    pendingWrites === 0;
  const first = unresolved[0] ?? null;
  return {
    ready,
    builderCopy: ready
      ? null
      : first
        ? unresolvedEstimateCopy(first)
        : pendingWrites > 0
          ? "Saving the last answer, then the estimate can be built."
          : "Finish answering the remaining required details.",
    diagnostics: {
      remainingRequiredCount: clarify.remainingRequiredCount,
      blockingInfoRequired: unresolved
        .filter((row) => row.blocksEstimate)
        .map((row) => row.factKey ?? row.questionKey),
      pricingRequired: [],
      pendingWrites,
      unresolved: unresolved.map((row) => ({
        id: row.id,
        factKey: row.factKey,
        wallTypeId: row.wallTypeId ?? null,
        question: row.question,
      })),
    },
  };
}

export function evaluateGenerateEstimatePermission(params: {
  readonly compose: ComposeClarifyInput;
  readonly workAreas: readonly { id: string; type: string; status?: string | null }[];
  readonly facts: readonly { key: string; work_area_id: string | null; value: unknown }[];
  readonly unresolvedRequiredProjectConditionKeys: readonly string[];
  readonly pendingWrites?: number;
}): ClarifyEstimateReadiness {
  const clarify = evaluateClarifyEstimateReadiness({
    ...params.compose,
    pendingWrites: params.pendingWrites,
  });
  if (!clarify.ready) return clarify;
  const packageReadiness = evaluatePackageQuickEstimateReadiness({
    workAreas: params.workAreas,
    facts: params.facts as never,
    unresolvedRequiredProjectConditionKeys:
      filterEstimateBlockingProjectConditionKeys(
        params.unresolvedRequiredProjectConditionKeys
      ),
  });
  if (!packageReadiness.ready) {
    return {
      ready: false,
      builderCopy: packageReadiness.builderCopy,
      diagnostics: clarify.diagnostics,
    };
  }
  return clarify;
}

export function composeClarifyInputFromEstimateContext(params: {
  readonly stage: ComposeClarifyInput["stage"];
  readonly briefText: string | null;
  readonly qualityLevel: string | null;
  readonly workAreas: ComposeClarifyInput["workAreas"];
  readonly facts: ComposeClarifyInput["facts"];
  readonly constraints: ComposeClarifyInput["constraints"];
}): ComposeClarifyInput {
  const jobPlan = composeJobPlan({
    workAreas: params.workAreas as ComposeJobPlanInput["workAreas"],
    facts: params.facts as ComposeJobPlanInput["facts"],
    constraints: params.constraints,
    qualityLevel: params.qualityLevel,
    briefText: params.briefText,
  });
  return {
    ...params,
    jobPlan,
  };
}

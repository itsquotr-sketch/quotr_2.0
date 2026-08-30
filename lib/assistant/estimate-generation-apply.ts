/**
 * Client-safe Generate/Update response apply rules.
 * No calculator, persist, or mapper imports.
 */

export type AppliedEstimateGeneration = {
  projectId: string;
  generationId: string;
  requestSeq: number;
};

export function shouldApplyEstimateGeneration(input: {
  currentProjectId: string;
  applied: AppliedEstimateGeneration | null;
  incoming: AppliedEstimateGeneration;
}): boolean {
  if (input.incoming.projectId !== input.currentProjectId) {
    return false;
  }
  if (!input.applied) {
    return true;
  }
  if (input.incoming.requestSeq < input.applied.requestSeq) {
    return false;
  }
  if (input.incoming.generationId === input.applied.generationId) {
    return false;
  }
  return true;
}

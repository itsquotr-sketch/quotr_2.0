/**
 * Compact labels for the shared project header.
 * Status and lock authority stay in deriveProjectWorkflow.
 */

import type { WorkflowStageModel } from "@/lib/projects/workflow-orientation";
import { VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE } from "@/lib/variations/presentation";

export function estimateStatusText(
  stage: WorkflowStageModel,
  estimateIsStale: boolean
): string {
  const label =
    stage.status === "Needs attention" && estimateIsStale
      ? "Previous estimate"
      : stage.status === "Not started"
        ? "Not started"
        : stage.status === "Ready"
          ? "Ready"
          : stage.status === "Needs attention"
            ? "Needs attention"
            : stage.status;
  return stage.viewing ? `${label} · Current` : label;
}

export function stageStatusText(stage: WorkflowStageModel): string {
  return stage.viewing ? `${stage.status} · Current` : stage.status;
}

export function pricingLockReason(stage: WorkflowStageModel): string | null {
  if (!stage.locked) return null;
  return "Complete the Estimate first";
}

export function variationsLockReason(stage: WorkflowStageModel): string | null {
  if (!stage.locked) return null;
  if (stage.detail === VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE) {
    return "Available after Quote acceptance";
  }
  return "Unavailable";
}

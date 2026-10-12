/**
 * Compact labels for the shared project header.
 * Status and lock authority stay in deriveProjectWorkflow.
 */

import { quantityConflictStageStatus } from "@/lib/estimate/deck-detail-completeness";
import type { WorkflowStageModel } from "@/lib/projects/workflow-orientation";
import { VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE } from "@/lib/variations/presentation";

export { quantityConflictStageStatus };

export function estimateStatusText(
  stage: WorkflowStageModel,
  estimateIsStale: boolean,
  quantityConflict = false
): string {
  const label = quantityConflict
    ? "Needs updating"
    : stage.status === "Needs attention" && estimateIsStale
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
  if (stage.detail === "Needs details" || stage.detail === "Needs updating") return stage.detail;
  if (stage.detail.startsWith("Recalculate this draft")) return "Needs updating";
  return "Complete the Estimate first";
}

export function variationsLockReason(stage: WorkflowStageModel): string | null {
  if (!stage.locked) return null;
  if (stage.detail === VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE) {
    return "Available after Quote acceptance";
  }
  return "Unavailable";
}

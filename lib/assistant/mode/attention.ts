/**
 * RECOVERY-5A — Mode-aware attention navigation.
 * Opens one Edit Job section (or the Builder Review hook). Does not fan-open panels.
 */

import type { EditJobSection } from "@/lib/assistant/mode/types";

export type AttentionReviewTarget =
  | "questions"
  | "quality"
  | "estimateReview"
  | "scopeReview"
  | "projectConditions"
  | "constraints"
  | string;

export type AttentionNavigationItem = {
  readonly reviewTarget?: AttentionReviewTarget;
  readonly workAreaId?: string;
  readonly factKey?: string;
  readonly questionId?: string;
  readonly suggestionId?: string;
  readonly scopeItemId?: string;
};

export type AttentionNavigation =
  | { readonly kind: "builder_review" }
  | {
      readonly kind: "edit_job";
      readonly section: EditJobSection;
    };

export function resolveAttentionNavigation(
  item: AttentionNavigationItem
): AttentionNavigation {
  const target = item.reviewTarget;

  if (
    target === "estimateReview" &&
    !item.factKey &&
    !item.questionId &&
    !item.workAreaId
  ) {
    return { kind: "builder_review" };
  }

  if (target === "quality") {
    return { kind: "edit_job", section: "details" };
  }

  if (target === "projectConditions" || target === "constraints") {
    return { kind: "edit_job", section: "project_conditions" };
  }

  if (target === "questions") {
    return { kind: "edit_job", section: "job_plan" };
  }

  if (
    target === "scopeReview" ||
    item.factKey === "deck.vertical_face_boards_required"
  ) {
    return { kind: "edit_job", section: "job_plan" };
  }

  if (item.factKey || item.workAreaId) {
    return { kind: "edit_job", section: "job_plan" };
  }

  return { kind: "edit_job", section: "job_plan" };
}

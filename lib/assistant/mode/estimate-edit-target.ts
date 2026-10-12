import type { EditJobSection } from "@/lib/assistant/mode/types";

export type EstimateEditTarget =
  | {
      readonly kind: "MATERIAL_SPEC";
      readonly section: "job_plan";
      readonly workAreaId: string;
      readonly specFactKey: string;
    }
  | {
      readonly kind: "SCOPE";
      readonly section: "job_plan";
      readonly workAreaId: string;
      readonly scopeItemId: string;
    }
  | {
      readonly kind: "POST_HOLES";
      readonly section: "job_plan";
      readonly workAreaId: string;
      readonly gapId: string;
    }
  | {
      readonly kind: "SECTION";
      readonly section: EditJobSection;
    }
  | {
      readonly kind: "NONE";
      readonly section: EditJobSection | null;
    };

export type JobPlanEditFocus = {
  readonly workAreaId?: string;
  readonly specFocusKey?: string;
  readonly scopeFocusItemId?: string;
  readonly postHoleFocusId?: string;
};

export function jobPlanEditFocusFromTarget(
  target: EstimateEditTarget | null
): JobPlanEditFocus | null {
  if (!target) return null;

  if (target.kind === "MATERIAL_SPEC") {
    return {
      workAreaId: target.workAreaId,
      specFocusKey: target.specFactKey,
    };
  }

  if (target.kind === "SCOPE") {
    return {
      workAreaId: target.workAreaId,
      scopeFocusItemId: target.scopeItemId,
    };
  }

  if (target.kind === "POST_HOLES") {
    return {
      workAreaId: target.workAreaId,
      specFocusKey: "deck.post_holes",
      postHoleFocusId: target.gapId,
    };
  }

  return null;
}


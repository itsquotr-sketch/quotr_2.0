import { jobPlanNumber, jobPlanString } from "@/lib/assistant/job-plan/facts";
import { round2 } from "@/lib/estimate/facts";
import { retainingWallHasCoreHeight } from "@/lib/estimate/calculators/retaining-wall";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";

function compactSummary(
  context: JobPlanAdapterContext,
  workAreaId: string
): { summary: string; chips: JobPlanSpecChip[] } {
  const chips: JobPlanSpecChip[] = [];
  const length = jobPlanNumber(context.facts, workAreaId, "retaining_wall.length_m");
  if (length != null) {
    chips.push({
      key: "length",
      label: "Length",
      value: `${length}m`,
      advanced: false,
    });
  }

  const height = jobPlanNumber(context.facts, workAreaId, "retaining_wall.height_m");
  const high = jobPlanNumber(context.facts, workAreaId, "retaining_wall.height_high_m");
  const low = jobPlanNumber(context.facts, workAreaId, "retaining_wall.height_low_m");
  if (height != null) {
    chips.push({
      key: "height",
      label: "Height",
      value: `${height}m`,
      advanced: false,
    });
  } else if (
    retainingWallHasCoreHeight(context.facts, workAreaId) &&
    high != null &&
    low != null
  ) {
    chips.push({
      key: "height",
      label: "Height",
      value: `${round2((high + low) / 2)}m avg`,
      advanced: false,
    });
  }

  const material = jobPlanString(context.facts, workAreaId, "retaining_wall.material");
  if (material) {
    chips.push({
      key: "material",
      label: "Material",
      value: material,
      advanced: false,
    });
  }

  return {
    summary: chips.map((c) => c.value).join(" · "),
    chips,
  };
}

/**
 * Minimum Job Plan adapter to surface Retaining Wall and core known facts.
 * Does not mature drainage/backfill/posts interview.
 */
export const retainingWallJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "retaining_wall",
  project(workArea: JobPlanWorkAreaInput, context: JobPlanAdapterContext): JobPlanWorkAreaCard {
    const { summary, chips } = compactSummary(context, workArea.id);
    const core: JobPlanScopeItem = {
      id: "retaining-wall-core",
      workAreaId: workArea.id,
      label: workArea.name,
      presentation: "INCLUDED",
      kind: "user_scope",
      togglable: false,
      write: null,
      sourceFactKey: null,
      surfaceReason: "Deterministic: Retaining Wall Work Area exists",
    };

    return {
      workAreaId: workArea.id,
      workAreaType: "retaining_wall",
      name: workArea.name,
      status: workArea.status,
      summary: summary || workArea.name,
      specChips: chips,
      included: [core],
      notIncluded: [],
      notConfirmed: [],
      confirmCount: 0,
    };
  },
};

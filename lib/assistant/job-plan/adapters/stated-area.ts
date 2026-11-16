import { jobPlanNumber } from "@/lib/assistant/job-plan/facts";
import type {
  JobPlanScopeItem,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
  JobPlanAdapterContext,
} from "@/lib/assistant/job-plan/types";

function statedAreaAdapter(
  workAreaType: string,
  factKey: string
): JobPlanWorkAreaAdapter {
  return {
    workAreaType,
    project(
      workArea: JobPlanWorkAreaInput,
      context: JobPlanAdapterContext
    ): JobPlanWorkAreaCard {
      const area = jobPlanNumber(context.facts, workArea.id, factKey);
      const core: JobPlanScopeItem = {
        id: `${workAreaType}-core`,
        workAreaId: workArea.id,
        label: workArea.name,
        presentation: "INCLUDED",
        kind: "user_scope",
        togglable: false,
        write: null,
        sourceFactKey: factKey,
        surfaceReason: "Stated area kept for a manual price",
      };
      return {
        workAreaId: workArea.id,
        workAreaType,
        name: workArea.name,
        status: workArea.status,
        summary: area != null ? `${area}m²` : workArea.name,
        specChips:
          area != null
            ? [{ key: "area", label: "Area", value: `${area}m²`, advanced: false }]
            : [],
        included: [core],
        notIncluded: [],
        notConfirmed: [],
        confirmCount: 0,
      };
    },
  };
}

export const demolitionJobPlanAdapter = statedAreaAdapter(
  "demolition",
  "demolition.area_m2"
);
export const pavingJobPlanAdapter = statedAreaAdapter("paving", "paving.area_m2");

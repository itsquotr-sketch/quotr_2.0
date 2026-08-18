import type {
  JobPlanScopeItem,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";

/** Fallback adapter: one parent card, core work included, no estimate-component dump. */
export function genericJobPlanAdapter(workAreaType: string): JobPlanWorkAreaAdapter {
  return {
    workAreaType,
    project(workArea: JobPlanWorkAreaInput): JobPlanWorkAreaCard {
      const core: JobPlanScopeItem = {
        id: `${workAreaType}-core`,
        workAreaId: workArea.id,
        label: workArea.name,
        presentation: "INCLUDED",
        kind: "user_scope",
        togglable: false,
        write: null,
        sourceFactKey: null,
        surfaceReason: `Deterministic: ${workAreaType} Work Area exists`,
      };
      return {
        workAreaId: workArea.id,
        workAreaType,
        name: workArea.name,
        status: workArea.status,
        summary: workArea.name,
        specChips: [],
        included: [core],
        notIncluded: [],
        notConfirmed: [],
        confirmCount: 0,
      };
    },
  };
}

import { workAreaTypeHasDetailedCalculator } from "@/lib/estimate/calculator-availability";
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
      const manual = !workAreaTypeHasDetailedCalculator(workArea.type);
      const scope = workArea.scopeDescription?.trim() || "";
      const core: JobPlanScopeItem = {
        id: `${workAreaType}-core`,
        workAreaId: workArea.id,
        label: manual && scope ? scope : workArea.name,
        presentation: "INCLUDED",
        kind: "user_scope",
        togglable: false,
        write: null,
        sourceFactKey: null,
        surfaceReason: manual
          ? "Manual pricing: user described this scope"
          : `Deterministic: ${workAreaType} Work Area exists`,
      };
      return {
        workAreaId: workArea.id,
        workAreaType,
        name: workArea.name,
        status: workArea.status,
        summary: manual ? "" : workArea.name,
        specChips: [],
        included: [core],
        notIncluded: [],
        notConfirmed: [],
        confirmCount: 0,
      };
    },
  };
}

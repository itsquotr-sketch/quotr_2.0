import { summariseCladdingPortion } from "@/lib/estimate/cladding-clarify";
import {
  hasCladdingPortionsFact,
  resolveCladdingPortions,
} from "@/lib/estimate/cladding-portions";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";
import type { EstimateFact } from "@/lib/estimate/types";

export const claddingJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "cladding",
  project(
    workArea: JobPlanWorkAreaInput,
    context: JobPlanAdapterContext
  ): JobPlanWorkAreaCard {
    const id = workArea.id;
    const nested = hasCladdingPortionsFact(context.facts as EstimateFact[], id);
    const resolved = nested
      ? resolveCladdingPortions({
          facts: context.facts as EstimateFact[],
          workAreaId: id,
        })
      : { portions: [] };
    const summaries = resolved.portions.map((portion, index) =>
      summariseCladdingPortion(portion, index)
    );
    const chips: JobPlanSpecChip[] = summaries.map((row) => ({
      key: `portion-${row.id}`,
      label: row.displayName,
      value: row.summary,
      advanced: false,
    }));
    const included: JobPlanScopeItem[] = summaries.map((row) => ({
      id: `${id}-${row.id}`,
      workAreaId: id,
      label: row.summary,
      presentation: "INCLUDED",
      kind: "specification",
      togglable: false,
      write: null,
      sourceFactKey: "cladding.portions",
      surfaceReason: "Known cladding section",
    }));
    if (included.length === 0) {
      included.push({
        id: `${id}-core`,
        workAreaId: id,
        label: workArea.name,
        presentation: "INCLUDED",
        kind: "user_scope",
        togglable: false,
        write: null,
        sourceFactKey: null,
        surfaceReason: "Cladding Work Area",
      });
    }
    const count = summaries.length;
    return {
      workAreaId: id,
      workAreaType: workArea.type,
      name: workArea.name,
      status: workArea.status,
      summary:
        count > 0
          ? `${count} Cladding section${count === 1 ? "" : "s"}`
          : workArea.name,
      specChips: chips,
      included,
      notIncluded: [],
      notConfirmed: [],
      confirmCount: 0,
    };
  },
};

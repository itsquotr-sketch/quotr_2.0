import { summariseFlooringPortion } from "@/lib/estimate/flooring-clarify";
import {
  FLOORING_ADD_PORTION_KEY,
  FLOORING_DELETE_PORTION_KEY,
  FLOORING_DUPLICATE_PORTION_KEY,
  hasFlooringPortionsFact,
  resolveFlooringPortions,
} from "@/lib/estimate/flooring-portions";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";
import type { EstimateFact } from "@/lib/estimate/types";

export const flooringJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "flooring",
  project(
    workArea: JobPlanWorkAreaInput,
    context: JobPlanAdapterContext
  ): JobPlanWorkAreaCard {
    const id = workArea.id;
    const nested = hasFlooringPortionsFact(context.facts as EstimateFact[], id);
    const resolved = nested
      ? resolveFlooringPortions({
          facts: context.facts as EstimateFact[],
          workAreaId: id,
        })
      : { portions: [] };
    const summaries = resolved.portions.map((portion, index) =>
      summariseFlooringPortion(portion, index)
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
      sourceFactKey: "flooring.portions",
      surfaceReason: "Known flooring area",
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
        surfaceReason: "Flooring Work Area",
      });
    }

    return {
      workAreaId: id,
      workAreaType: workArea.type,
      name: workArea.name,
      status: workArea.status,
      summary:
        summaries.length > 0
          ? `${workArea.name} · ${summaries.length} flooring area${summaries.length === 1 ? "" : "s"}`
          : workArea.name,
      specChips: chips,
      included,
      notIncluded: [],
      notConfirmed: [],
      confirmCount: 0,
    };
  },
};

export const FLOORING_JOB_PLAN_NESTED_ACTIONS = {
  addKey: FLOORING_ADD_PORTION_KEY,
  duplicateKey: FLOORING_DUPLICATE_PORTION_KEY,
  deleteKey: FLOORING_DELETE_PORTION_KEY,
} as const;

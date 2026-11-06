import { jobPlanBoolean } from "@/lib/assistant/job-plan/facts";
import { doorsSpecificationCountLabel } from "@/lib/assistant/presentation/mixed-project-summaries";
import {
  summariseDoorPortion,
} from "@/lib/estimate/doors-clarify";
import {
  DOORS_ADD_PORTION_KEY,
  DOORS_DELETE_PORTION_KEY,
  DOORS_DUPLICATE_PORTION_KEY,
  hasDoorsPortionsFact,
  resolveDoorsPortions,
} from "@/lib/estimate/doors-portions";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";
import type { EstimateFact } from "@/lib/estimate/types";

export const doorsJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "doors",
  project(workArea: JobPlanWorkAreaInput, context: JobPlanAdapterContext): JobPlanWorkAreaCard {
    const id = workArea.id;
    const nested = hasDoorsPortionsFact(context.facts as EstimateFact[], id);
    const resolved = nested
      ? resolveDoorsPortions({
          facts: context.facts as EstimateFact[],
          workAreaId: id,
        })
      : { portions: [] };
    const summaries = resolved.portions.map((portion, index) =>
      summariseDoorPortion(portion, index)
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
      label: [row.displayName, row.summary].filter(Boolean).join(" · "),
      presentation: "INCLUDED",
      kind: "specification",
      togglable: false,
      write: null,
      sourceFactKey: "doors.portions",
      surfaceReason: "Known door set",
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
        surfaceReason: "Doors Work Area",
      });
    }

    const doorPaintingExcluded =
      jobPlanBoolean(context.facts, id, "doors.painting_included") === false;
    return {
      workAreaId: id,
      workAreaType: workArea.type,
      name: workArea.name,
      status: workArea.status,
      summary:
        summaries.length > 0
          ? `${workArea.name} · ${doorsSpecificationCountLabel(summaries.length)}`
          : workArea.name,
      specChips: chips,
      included,
      notIncluded: doorPaintingExcluded
        ? [
            {
              id: `${id}-painting-excluded`,
              workAreaId: id,
              label: "Door painting excluded",
              presentation: "NOT_INCLUDED" as const,
              kind: "specification" as const,
              togglable: false,
              write: null,
              sourceFactKey: "doors.painting_included",
              surfaceReason: "The brief excludes this work",
            },
          ]
        : [],
      notConfirmed: [],
      confirmCount: 0,
    };
  },
};

export const DOORS_JOB_PLAN_NESTED_ACTIONS = {
  addKey: DOORS_ADD_PORTION_KEY,
  duplicateKey: DOORS_DUPLICATE_PORTION_KEY,
  deleteKey: DOORS_DELETE_PORTION_KEY,
} as const;

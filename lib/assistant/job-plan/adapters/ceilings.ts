import { formatCeilingKnownSummary } from "@/lib/assistant/presentation/mixed-project-summaries";
import {
  summariseCeilingPortion,
} from "@/lib/estimate/ceilings-clarify";
import {
  CEILINGS_ADD_PORTION_KEY,
  CEILINGS_DELETE_PORTION_KEY,
  CEILINGS_DUPLICATE_PORTION_KEY,
  resolveCeilingsPortions,
} from "@/lib/estimate/ceilings-portions";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";
import type { EstimateFact } from "@/lib/estimate/types";

export const ceilingsJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "ceilings",
  project(workArea: JobPlanWorkAreaInput, context: JobPlanAdapterContext): JobPlanWorkAreaCard {
    const id = workArea.id;
    const resolved = resolveCeilingsPortions({
      facts: context.facts as EstimateFact[],
      workAreaId: id,
    });
    const summaries = resolved.portions.map((portion, index) => {
      const row = summariseCeilingPortion(portion, index);
      const known = formatCeilingKnownSummary({
        label: portion.label,
        lengthM: portion.geometry.length_m,
        widthM: portion.geometry.width_m,
        areaM2: portion.geometry.area_m2,
        structureFamily: portion.structure.family,
        liningLabel: row.liningLine,
      });
      return { ...row, known };
    });
    const chips: JobPlanSpecChip[] = summaries
      .filter((row) => row.known)
      .map((row) => ({
        key: `portion-${row.id}`,
        label: "Ceiling",
        value: row.known ?? "",
        advanced: false,
      }));

    const included: JobPlanScopeItem[] = summaries.map((row) => ({
      id: `${id}-${row.id}`,
      workAreaId: id,
      label: row.known ?? [row.displayName, row.geometryLine, row.structureLine, row.liningLine]
        .filter(Boolean)
        .join(" · "),
      presentation: "INCLUDED",
      kind: "specification",
      togglable: false,
      write: null,
      sourceFactKey: "ceilings.portions",
      surfaceReason: "Known ceiling portion",
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
        surfaceReason: "Ceilings Work Area",
      });
    }

    return {
      workAreaId: id,
      workAreaType: workArea.type,
      name: workArea.name,
      status: workArea.status,
      summary:
        summaries.length > 0
          ? `${workArea.name} · ${summaries.length} portion${summaries.length === 1 ? "" : "s"}`
          : workArea.name,
      specChips: chips,
      included,
      notIncluded: [],
      notConfirmed: [],
      confirmCount: 0,
    };
  },
};

export const CEILINGS_JOB_PLAN_NESTED_ACTIONS = {
  addKey: CEILINGS_ADD_PORTION_KEY,
  duplicateKey: CEILINGS_DUPLICATE_PORTION_KEY,
  deleteKey: CEILINGS_DELETE_PORTION_KEY,
} as const;

import { jobPlanString } from "@/lib/assistant/job-plan/facts";
import {
  jobScopeDisplay,
  parseInternalWallsJobScope,
} from "@/lib/estimate/internal-walls-scope";
import {
  resolveInternalWallsWallTypes,
  summariseWallType,
} from "@/lib/estimate/internal-walls-wall-types";
import type {
  JobPlanAdapterContext,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";
import type { EstimateFact } from "@/lib/estimate/types";

export const internalWallsJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "internal_walls",
  project(workArea: JobPlanWorkAreaInput, context: JobPlanAdapterContext): JobPlanWorkAreaCard {
    const id = workArea.id;
    const jobScope = parseInternalWallsJobScope(
      jobPlanString(context.facts, id, "internal_walls.job_scope")
    );
    const resolved = resolveInternalWallsWallTypes({
      facts: context.facts as EstimateFact[],
      workAreaId: id,
    });
    const summaries = resolved.types.map((type, index) =>
      summariseWallType(type, index, resolved.source)
    );
    const chips: JobPlanSpecChip[] = [
      jobScope
        ? {
            key: "scope",
            label: "Work",
            value: jobScopeDisplay(jobScope) ?? jobScope,
            advanced: false,
          }
        : null,
      summaries.length > 0
        ? {
            key: "wall-types",
            label: "Wall types",
            value: String(summaries.length),
            advanced: false,
          }
        : null,
      ...summaries.slice(0, 3).map((row, index) => ({
        key: `wt-${row.id}`,
        label: row.displayName,
        value: [row.frameLine, row.geometryLine, row.openingsLine].filter(Boolean).join(" · ") || "In progress",
        advanced: index > 0,
      })),
    ].filter((row): row is JobPlanSpecChip => row != null);

    const summaryParts = [
      jobScopeDisplay(jobScope),
      summaries.length === 1
        ? summaries[0]!.displayName
        : summaries.length > 1
          ? `${summaries.length} wall types`
          : null,
    ].filter(Boolean);

    return {
      workAreaId: id,
      workAreaType: workArea.type,
      name: workArea.name,
      status: workArea.status,
      summary: summaryParts.join(" · ") || workArea.name,
      specChips: chips,
      included: [
        {
          id: "internal-walls-core",
          workAreaId: id,
          label: "Internal walls",
          presentation: "INCLUDED",
          kind: "user_scope",
          togglable: false,
          write: null,
          sourceFactKey: null,
          surfaceReason: "Internal Walls Work Area",
        },
      ],
      notIncluded: [],
      notConfirmed: [],
      confirmCount: 0,
    };
  },
};

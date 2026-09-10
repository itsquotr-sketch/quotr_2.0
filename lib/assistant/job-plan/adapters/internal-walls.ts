import { jobPlanString } from "@/lib/assistant/job-plan/facts";
import {
  jobScopeDisplay,
  parseInternalWallsJobScope,
} from "@/lib/estimate/internal-walls-scope";
import {
  resolveInternalWallsWallTypes,
  summariseInternalWallsWorkArea,
  summariseWallType,
  timberSizeDisplay,
} from "@/lib/estimate/internal-walls-wall-types";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";
import type { EstimateFact } from "@/lib/estimate/types";

const WALL_TYPE_PREVIEW_LIMIT = 2;

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
    const rollup = summariseInternalWallsWorkArea(resolved.types);
    const timber = resolved.types.find((row) => row.frame_system === "timber");
    const timberLabel = timber
      ? timberSizeDisplay(timber.frame_size ?? null) ?? "Timber framing"
      : null;
    const framingLabel =
      timberLabel == null
        ? null
        : timberLabel.toLowerCase().includes("fram")
          ? timberLabel
          : `${timberLabel} framing`;
    const lined = resolved.types.some(
      (row) => row.side_a.lined || row.side_b.lined || row.side_a.product || row.side_b.product
    );
    const steel = resolved.types.some((row) => row.frame_system === "steel");

    const chips: JobPlanSpecChip[] = [
      rollup
        ? {
            key: "wall-types",
            label: "Wall types",
            value: rollup,
            advanced: false,
          }
        : jobScope
          ? {
              key: "scope",
              label: "Work",
              value: jobScopeDisplay(jobScope) ?? jobScope,
              advanced: false,
            }
          : null,
    ].filter((row): row is JobPlanSpecChip => row != null);

    const included: JobPlanScopeItem[] = [];
    if (framingLabel) {
      included.push({
        id: `${id}-framing`,
        workAreaId: id,
        label: framingLabel,
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.wall_types",
        surfaceReason: "Known wall framing",
      });
    } else if (steel) {
      included.push({
        id: `${id}-steel`,
        workAreaId: id,
        label: "Steel framing",
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.wall_types",
        surfaceReason: "Known wall framing",
      });
    }
    if (lined) {
      included.push({
        id: `${id}-lining`,
        workAreaId: id,
        label: "Plasterboard lining",
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.wall_types",
        surfaceReason: "Known wall lining",
      });
    }

    const preview = summaries.slice(0, WALL_TYPE_PREVIEW_LIMIT);
    for (const row of preview) {
      included.push({
        id: `${id}-${row.id}`,
        workAreaId: id,
        label: [row.displayName, row.geometryLine, row.liningLine]
          .filter(Boolean)
          .join(" · "),
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.wall_types",
        surfaceReason: "Wall Type construction",
      });
    }
    if (summaries.length > WALL_TYPE_PREVIEW_LIMIT) {
      included.push({
        id: `${id}-more-types`,
        workAreaId: id,
        label: `+${summaries.length - WALL_TYPE_PREVIEW_LIMIT} more Wall Types`,
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.wall_types",
        surfaceReason: "Additional Wall Types collapsed",
      });
    }

    if (included.length === 0) {
      included.push({
        id: "internal-walls-core",
        workAreaId: id,
        label: "Internal walls",
        presentation: "INCLUDED",
        kind: "user_scope",
        togglable: false,
        write: null,
        sourceFactKey: null,
        surfaceReason: "Internal Walls Work Area",
      });
    }

    const summaryParts = [
      rollup,
      framingLabel,
      lined ? "Plasterboard lining" : null,
    ].filter(Boolean);

    return {
      workAreaId: id,
      workAreaType: workArea.type,
      name: workArea.name,
      status: workArea.status,
      summary: summaryParts.join(" · ") || workArea.name,
      specChips: chips,
      included,
      notIncluded: [],
      notConfirmed: [],
      confirmCount: 0,
    };
  },
};

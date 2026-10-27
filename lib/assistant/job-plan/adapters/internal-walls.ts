import { jobPlanBoolean, jobPlanNumber, jobPlanString } from "@/lib/assistant/job-plan/facts";
import {
  internalWallsEstimateScopeLine,
  internalWallsKnownSentence,
} from "@/lib/assistant/presentation/mixed-project-summaries";
import { parseInternalWallsJobScope } from "@/lib/estimate/internal-walls-scope";
import { resolveInternalWallsWallTypes } from "@/lib/estimate/internal-walls-wall-types";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
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
    const knownSentences = resolved.types.map((type) =>
      internalWallsKnownSentence(type, jobScope)
    );
    const scopeLines = resolved.types.map((type) =>
      internalWallsEstimateScopeLine(type, jobScope)
    );

    const chips: JobPlanSpecChip[] = resolved.types.map((type, index) => ({
      key: `partition-${type.id}`,
      label: resolved.types.length === 1 ? "Internal Walls" : `Partition ${index + 1}`,
      value: knownSentences[index] ?? "",
      advanced: false,
    }));

    const included: JobPlanScopeItem[] = scopeLines.map((label, index) => ({
      id: `${id}-${resolved.types[index]?.id ?? index}`,
      workAreaId: id,
      label,
      presentation: "INCLUDED",
      kind: "specification",
      togglable: false,
      write: null,
      sourceFactKey: "internal_walls.wall_types",
      surfaceReason: "Partition scope",
    }));

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

    const paintingKnown = resolved.types.some(
      (type) => type.painting != null && type.painting !== "none"
    );
    const skirtingKnown = resolved.types.some(
      (type) => type.skirting != null && type.skirting !== "none"
    );
    if (jobPlanBoolean(context.facts, id, "internal_walls.painting_included") === true && !paintingKnown) {
      included.push({
        id: `${id}-painting-included`,
        workAreaId: id,
        label: "Painting included; coverage not specified",
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.painting_included",
        surfaceReason: "Painting was requested without a side or specification",
      });
    }
    const skirtingLength = jobPlanNumber(
      context.facts,
      id,
      "internal_walls.skirting_length_lm"
    );
    if (
      skirtingLength != null &&
      skirtingLength > 0 &&
      !skirtingKnown &&
      jobPlanBoolean(context.facts, id, "internal_walls.skirtings_included") !== false
    ) {
      included.push({
        id: `${id}-skirting-length`,
        workAreaId: id,
        label: `${skirtingLength} lm skirting; edges not allocated`,
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.skirting_length_lm",
        surfaceReason: "Skirting length was stated without an edge",
      });
    }

    const coverageNote = jobPlanString(context.facts, id, "internal_walls.coverage_note");
    const notConfirmed: JobPlanScopeItem[] = coverageNote
      ? [
          {
            id: `${id}-coverage-note`,
            workAreaId: id,
            label: coverageNote,
            presentation: "NOT_CONFIRMED",
            kind: "specification",
            togglable: false,
            write: null,
            sourceFactKey: "internal_walls.coverage_note",
            surfaceReason: "Requested work has no priced recipe",
          },
        ]
      : [];

    return {
      workAreaId: id,
      workAreaType: workArea.type,
      name: workArea.name,
      status: workArea.status,
      summary: knownSentences.join(" ") || workArea.name,
      specChips: chips,
      included,
      notIncluded: [],
      notConfirmed,
      confirmCount: notConfirmed.length,
    };
  },
};

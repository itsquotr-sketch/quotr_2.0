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

const EXCLUDED_TRADE_LABELS: Record<string, string> = {
  electrical: "Electrical excluded",
  structural: "Structural work excluded",
  plumbing: "Plumbing excluded",
  fire: "Fire-system work excluded",
};

function excludedScopeItem(
  workAreaId: string,
  id: string,
  label: string,
  sourceFactKey: string
): JobPlanScopeItem {
  return {
    id,
    workAreaId,
    label,
    presentation: "NOT_INCLUDED",
    kind: "specification",
    togglable: false,
    write: null,
    sourceFactKey,
    surfaceReason: "The brief excludes this work",
  };
}

function splitCoverageNote(note: string): { unresolved: string | null; trades: string[] } {
  const trades =
    note
      .match(/Excluded trades:\s*([^.]+)/i)?.[1]
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const unresolved = note
    .replace(/\s*Excluded trades:\s*[^.]+(\.)?/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, "");
  return { unresolved: unresolved.length > 0 ? unresolved : null, trades };
}

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
      jobPlanBoolean(context.facts, id, "internal_walls.skirtings_included") !== false
    ) {
      included.push({
        id: `${id}-skirting-length`,
        workAreaId: id,
        label: skirtingKnown
          ? `${skirtingLength} lm skirting`
          : `${skirtingLength} lm skirting; edges not allocated`,
        presentation: "INCLUDED",
        kind: "specification",
        togglable: false,
        write: null,
        sourceFactKey: "internal_walls.skirting_length_lm",
        surfaceReason: "Skirting length was stated without an edge",
      });
    }

    const coverage = splitCoverageNote(
      jobPlanString(context.facts, id, "internal_walls.coverage_note") ?? ""
    );
    const notIncluded: JobPlanScopeItem[] = [];
    const paintingExcluded =
      !paintingKnown &&
      (jobPlanBoolean(context.facts, id, "internal_walls.painting_included") === false ||
        (resolved.types.length > 0 &&
          resolved.types.every((type) => type.painting === "none")));
    if (paintingExcluded) {
      notIncluded.push(
        excludedScopeItem(id, `${id}-painting-excluded`, "Painting excluded", "internal_walls.painting_included")
      );
    }
    const skirtingExcluded =
      !skirtingKnown &&
      (jobPlanBoolean(context.facts, id, "internal_walls.skirtings_included") === false ||
        (resolved.types.length > 0 &&
          resolved.types.every((type) => type.skirting === "none")));
    if (skirtingExcluded) {
      notIncluded.push(
        excludedScopeItem(id, `${id}-skirting-excluded`, "Skirting excluded", "internal_walls.skirtings_included")
      );
    }
    const electricalKnown = resolved.types.some(
      (type) => type.electrical != null && type.electrical !== "none"
    );
    const electricalExcluded =
      !electricalKnown &&
      ((resolved.types.length > 0 &&
        resolved.types.every((type) => type.electrical === "none")) ||
        coverage.trades.includes("electrical"));
    if (electricalExcluded) {
      notIncluded.push(
        excludedScopeItem(id, `${id}-electrical-excluded`, "Electrical excluded", "internal_walls.coverage_note")
      );
    }
    for (const trade of coverage.trades) {
      if (trade === "electrical" && electricalExcluded) continue;
      if (trade === "painting" && paintingExcluded) continue;
      if (trade === "skirting" && skirtingExcluded) continue;
      const label = EXCLUDED_TRADE_LABELS[trade] ?? `${trade} excluded`;
      if (notIncluded.some((item) => item.label === label)) continue;
      notIncluded.push(
        excludedScopeItem(id, `${id}-trade-${trade}`, label, "internal_walls.coverage_note")
      );
    }
    const notConfirmed: JobPlanScopeItem[] = coverage.unresolved
      ? [
          {
            id: `${id}-coverage-note`,
            workAreaId: id,
            label: coverage.unresolved,
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
      notIncluded,
      notConfirmed,
      confirmCount: notConfirmed.length,
    };
  },
};

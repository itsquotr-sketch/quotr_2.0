/**
 * Shared coverage for a requested task that does not yet have a recipe line.
 * Callers supply the task and the recovery. No work-area name is special-cased.
 */

export type RequestedTaskCoverageKind =
  | "missing_price"
  | "unresolved_specification"
  | "unsupported";

export function requestedTaskCoverageText(params: {
  task: string;
  kind: RequestedTaskCoverageKind;
  recovery: string;
}): string {
  const state =
    params.kind === "missing_price"
      ? "This component can be priced once a rate is supplied."
      : params.kind === "unresolved_specification"
        ? "A specification or quantity is still required."
        : "No supported recipe applies.";
  return `${params.task} ${state} ${params.recovery}`;
}

export function liningUnspecifiedComponent(side: "side_a" | "side_b"): string {
  return `internal_walls.lining.unspecified.${side}`;
}

export function liningSpecificationComponent(side: "side_a" | "side_b"): string {
  return `internal_walls.lining.specification.${side}`;
}

export const WALL_PAINTING_COVERAGE_COMPONENT =
  "internal_walls.painting.coverage_unresolved" as const;

export const SKIRTING_PAINTING_COVERAGE_COMPONENT =
  "internal_walls.skirting.painting.coverage_unresolved" as const;

export const INTERNAL_WALLS_OPENINGS_QUESTION =
  "Does this wall have any openings? Door sets in the brief are not openings in this wall unless the brief says they are.";

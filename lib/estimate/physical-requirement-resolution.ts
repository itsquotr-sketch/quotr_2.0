/**
 * Shared estimating information-quality contract.
 *
 * For every economically material detailed requirement, the physical driver
 * must be one of:
 *   KNOWN | DERIVED | ASSUMED (disclosed) | INFORMATION_REQUIRED
 *
 * Never: UNKNOWN + detailed money + no explanation.
 *
 * Does not rewrite Work Area economics. Callers decide whether a missing
 * fact may be assumed (ASSUME_IF_SKIPPED) or must be asked (ASK_NOW).
 */

export const PHYSICAL_REQUIREMENT_RESOLUTION = {
  KNOWN: "KNOWN",
  DERIVED: "DERIVED",
  ASSUMED: "ASSUMED",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
} as const;

export type PhysicalRequirementResolution =
  (typeof PHYSICAL_REQUIREMENT_RESOLUTION)[keyof typeof PHYSICAL_REQUIREMENT_RESOLUTION];

export type ResolvedPhysicalRequirement<T> = {
  readonly resolution: PhysicalRequirementResolution;
  readonly value: T | null;
};

export function resolvePhysicalRequirement<T>(params: {
  knownValue: T | null | undefined;
  isKnown?: (value: T) => boolean;
  derivedValue?: T | null;
  assumptionValue?: T;
  assumptionAllowed: boolean;
}): ResolvedPhysicalRequirement<T> {
  const known =
    params.knownValue != null &&
    (params.isKnown ? params.isKnown(params.knownValue) : true);
  if (known) {
    return {
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN,
      value: params.knownValue as T,
    };
  }
  if (params.derivedValue != null) {
    return {
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
      value: params.derivedValue,
    };
  }
  if (params.assumptionAllowed && params.assumptionValue != null) {
    return {
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED,
      value: params.assumptionValue,
    };
  }
  return {
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
    value: null,
  };
}

/** Detailed commercial money is allowed only when the physical driver is explained. */
export function detailedMoneyAllowed(
  resolution: PhysicalRequirementResolution
): boolean {
  return resolution !== PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED;
}

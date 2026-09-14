/**
 * CEILINGS WA-04A — timber direct-fix framing takeoff.
 *
 * Parallel joists/battens at spacing. No nogs. No steel. No suspended.
 * No lining. Does not invent a hidden 450 mm default.
 *
 * Uses shared runCountFromSpacing. Spacing is converted mm → m before use.
 */

import { round2 } from "@/lib/estimate/facts";
import { runCountFromSpacing } from "@/lib/estimate/run-count";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import {
  INTERNAL_WALLS_TIMBER_140_KEY,
  INTERNAL_WALLS_TIMBER_140_LABEL,
} from "@/lib/estimate/internal-walls-identities";
import {
  buildStructuralTimberIdentity,
  STRUCTURAL_FRAMING_PRODUCT_FAMILY,
  STRUCTURAL_TIMBER_FAMILY,
  type MaterialIdentity,
} from "@/lib/materials/identity";
import type {
  CeilingDirection,
  CeilingPortion,
  CeilingTimberSize,
} from "@/lib/estimate/ceilings-portions";
import {
  deriveCeilingGeometry,
  type CeilingGeometryTakeoff,
} from "@/lib/estimate/ceilings-geometry";

export const CEILINGS_TIMBER_FRAMING_COMPONENT =
  "ceilings.framing.timber.material" as const;

export type CeilingTimberFramingStatus =
  | "ok"
  | "not_applicable"
  | "information_required"
  | "deferred";

export type CeilingTimberProductResolution =
  | {
      readonly kind: "canonical";
      readonly size: "140x45_h1.2";
      readonly materialKey: typeof INTERNAL_WALLS_TIMBER_140_KEY;
      readonly materialIdentity: MaterialIdentity;
      readonly specification: string;
    }
  | {
      readonly kind: "custom";
      readonly size: "other";
      readonly materialKey: null;
      readonly materialIdentity: MaterialIdentity;
      readonly specification: string;
    }
  | {
      readonly kind: "unresolved";
      readonly size: null;
      readonly materialKey: null;
      readonly materialIdentity: null;
      readonly specification: string;
    };

export type CeilingTimberFramingTakeoff = {
  readonly status: CeilingTimberFramingStatus;
  readonly resolution: PhysicalRequirementResolution;
  readonly reason: string | null;
  readonly nestedItemId: string;
  readonly direction: CeilingDirection | null;
  readonly spacing_mm: number | null;
  readonly spacing_m: number | null;
  readonly runDimension_m: number | null;
  readonly crossDimension_m: number | null;
  readonly numberOfRuns: number | null;
  readonly installedFramingLM: number | null;
  readonly product: CeilingTimberProductResolution;
};

function inspectSpacingMm(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

export function resolveCeilingTimberProduct(
  size: CeilingTimberSize | null | undefined
): CeilingTimberProductResolution {
  if (size === "other") {
    return {
      kind: "custom",
      size: "other",
      materialKey: null,
      materialIdentity: {
        family: STRUCTURAL_TIMBER_FAMILY,
        productFamily: STRUCTURAL_FRAMING_PRODUCT_FAMILY,
        section: null,
        grade: null,
        treatment: null,
        treatmentKind: "unknown",
        treatmentCustom: null,
        processing: null,
        processingKind: "unknown",
        species: null,
        originalDescription: "Other timber",
      },
      specification: "Other timber — identity unresolved",
    };
  }
  if (size === "140x45_h1.2") {
    const identity = buildStructuralTimberIdentity({
      sectionRaw: "140x45",
      treatmentRaw: "h1.2",
      originalDescription: INTERNAL_WALLS_TIMBER_140_LABEL,
    });
    return {
      kind: "canonical",
      size: "140x45_h1.2",
      materialKey: INTERNAL_WALLS_TIMBER_140_KEY,
      materialIdentity:
        identity ??
        ({
          family: STRUCTURAL_TIMBER_FAMILY,
          productFamily: STRUCTURAL_FRAMING_PRODUCT_FAMILY,
          section: "140x45",
          grade: null,
          treatment: "h1.2",
          treatmentKind: "known",
          treatmentCustom: null,
          processing: null,
          processingKind: "unknown",
          species: null,
          originalDescription: INTERNAL_WALLS_TIMBER_140_LABEL,
        } satisfies MaterialIdentity),
      specification: INTERNAL_WALLS_TIMBER_140_LABEL,
    };
  }
  return {
    kind: "unresolved",
    size: null,
    materialKey: null,
    materialIdentity: null,
    specification: "Timber size is not resolved",
  };
}

function emptyTakeoff(
  nestedItemId: string,
  status: CeilingTimberFramingStatus,
  resolution: PhysicalRequirementResolution,
  reason: string | null,
  product: CeilingTimberProductResolution = resolveCeilingTimberProduct(null)
): CeilingTimberFramingTakeoff {
  return {
    status,
    resolution,
    reason,
    nestedItemId,
    direction: null,
    spacing_mm: null,
    spacing_m: null,
    runDimension_m: null,
    crossDimension_m: null,
    numberOfRuns: null,
    installedFramingLM: null,
    product,
  };
}

export function calculateCeilingTimberFraming(
  portion: CeilingPortion,
  geometry?: CeilingGeometryTakeoff
): CeilingTimberFramingTakeoff {
  const nestedItemId = portion.id;
  const family = portion.structure.family;
  if (family !== "timber_direct_fix") {
    if (family === "steel_direct_fix" || family === "suspended_steel") {
      return emptyTakeoff(
        nestedItemId,
        "deferred",
        PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
        "Steel / suspended ceiling framing is not calculated in WA-04A."
      );
    }
    return emptyTakeoff(
      nestedItemId,
      "not_applicable",
      PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN,
      family
        ? "This ceiling structure does not add new timber framing."
        : "Ceiling structure is not timber direct-fix."
    );
  }

  const geo = geometry ?? deriveCeilingGeometry(portion);
  const product = resolveCeilingTimberProduct(portion.structure.timber?.size);
  if (geo.status === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
      geo.reason,
      product
    );
  }
  if (
    geo.status !== "ok" ||
    geo.length_m == null ||
    geo.width_m == null ||
    !(geo.length_m > 0) ||
    !(geo.width_m > 0)
  ) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
      geo.reason ??
        "Timber direct-fix needs length and width. Area alone is not enough.",
      product
    );
  }

  const spacing_mm = inspectSpacingMm(portion.structure.timber?.spacing_mm);
  const direction = portion.structure.timber?.direction ?? null;
  if (spacing_mm == null || direction == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
      spacing_mm == null
        ? "Timber framing spacing is required."
        : "Timber framing direction is required.",
      product
    );
  }

  const spacing_m = spacing_mm / 1000;
  const runDimension_m =
    direction === "along_length" ? geo.length_m : geo.width_m;
  const crossDimension_m =
    direction === "along_length" ? geo.width_m : geo.length_m;
  const numberOfRuns = runCountFromSpacing(crossDimension_m, spacing_m);
  if (numberOfRuns <= 0) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
      "Timber run count could not be derived from the given spacing.",
      product
    );
  }

  return {
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    reason: null,
    nestedItemId,
    direction,
    spacing_mm,
    spacing_m,
    runDimension_m,
    crossDimension_m,
    numberOfRuns,
    installedFramingLM: round2(numberOfRuns * runDimension_m),
    product,
  };
}

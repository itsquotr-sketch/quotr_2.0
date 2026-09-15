/**
 * CEILINGS WA-04B — steel direct-fix and suspended steel physical takeoff.
 *
 * Shared base frame (perimeter / primary / furring / clips) is calculated
 * once. Suspended adds droppers and wire. No lining, tiles, bulkheads,
 * labour, or waste percent.
 *
 * Does not invent default centres. Missing inputs are INFORMATION_REQUIRED.
 */

import { round2 } from "@/lib/estimate/facts";
import { runCountFromSpacing } from "@/lib/estimate/run-count";
import { supportPointsBetweenEdgeOffsets } from "@/lib/estimate/support-points";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import type { MaterialIdentity } from "@/lib/materials/identity";
import type {
  CeilingDirection,
  CeilingPortion,
} from "@/lib/estimate/ceilings-portions";
import {
  deriveCeilingGeometry,
  type CeilingGeometryTakeoff,
} from "@/lib/estimate/ceilings-geometry";

export const STEEL_CEILING_PERIMETER_TRACK_KEY =
  "steel.ceiling.perimeter_track.lm" as const;
export const STEEL_CEILING_PRIMARY_CHANNEL_KEY =
  "steel.ceiling.primary_channel.lm" as const;
export const STEEL_CEILING_FURRING_CHANNEL_KEY =
  "steel.ceiling.furring_channel.lm" as const;
export const STEEL_CEILING_CROSSOVER_CLIP_KEY =
  "steel.ceiling.crossover_clip.each" as const;
export const STEEL_CEILING_DROPPER_KEY = "steel.ceiling.dropper.each" as const;
export const STEEL_CEILING_SUSPENSION_WIRE_KEY =
  "steel.ceiling.suspension_wire.lm" as const;

export const CEILINGS_STEEL_PERIMETER_COMPONENT =
  "ceilings.framing.steel.perimeter" as const;
export const CEILINGS_STEEL_PRIMARY_COMPONENT =
  "ceilings.framing.steel.primary" as const;
export const CEILINGS_STEEL_FURRING_COMPONENT =
  "ceilings.framing.steel.furring" as const;
export const CEILINGS_STEEL_CLIP_COMPONENT =
  "ceilings.framing.steel.clip" as const;
export const CEILINGS_SUSPENSION_DROPPER_COMPONENT =
  "ceilings.suspension.dropper" as const;
export const CEILINGS_SUSPENSION_WIRE_COMPONENT =
  "ceilings.suspension.wire" as const;

/** EST-BENCHMARK-01B — owner-approved ordinary V1 COST. Not sell. */
export const CEILING_STEEL_QUOTR_COST = {
  perimeterLm: 5.5,
  primaryLm: 7.25,
  furringLm: 4.2,
  clipEach: 2,
  dropperEach: 2,
  wireLm: 0.42,
} as const;

function steelIdentity(
  productFamily: string,
  description: string
): MaterialIdentity {
  return {
    family: "steel",
    productFamily,
    section: null,
    grade: null,
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription: description,
  };
}

export const STEEL_CEILING_PERIMETER_IDENTITY = steelIdentity(
  "ceiling_perimeter_track",
  "Ceiling perimeter track / angle"
);
export const STEEL_CEILING_PRIMARY_IDENTITY = steelIdentity(
  "ceiling_primary_channel",
  "Ceiling primary channel"
);
export const STEEL_CEILING_FURRING_IDENTITY = steelIdentity(
  "ceiling_furring_channel",
  "Ceiling furring channel"
);
export const STEEL_CEILING_CLIP_IDENTITY = steelIdentity(
  "ceiling_crossover_clip",
  "Ceiling crossover / suspension clip"
);
export const STEEL_CEILING_DROPPER_IDENTITY = steelIdentity(
  "ceiling_suspension_dropper",
  "Ceiling suspension dropper"
);
export const STEEL_CEILING_WIRE_IDENTITY = steelIdentity(
  "ceiling_suspension_wire",
  "Ceiling suspension wire"
);

export type CeilingSteelFrameStatus =
  | "ok"
  | "not_applicable"
  | "information_required"
  | "invalid";

export type CeilingSteelFrameTakeoff = {
  readonly status: CeilingSteelFrameStatus;
  readonly resolution: PhysicalRequirementResolution;
  readonly reason: string | null;
  readonly nestedItemId: string;
  readonly primaryDirection: CeilingDirection | null;
  readonly primarySpacingMm: number | null;
  readonly furringSpacingMm: number | null;
  readonly perimeterLm: number | null;
  readonly primaryRuns: number | null;
  readonly primaryLm: number | null;
  readonly furringRuns: number | null;
  readonly furringLm: number | null;
  readonly clipCount: number | null;
};

export type CeilingSuspendedTakeoff = {
  readonly status: CeilingSteelFrameStatus;
  readonly resolution: PhysicalRequirementResolution;
  readonly reason: string | null;
  readonly nestedItemId: string;
  readonly frame: CeilingSteelFrameTakeoff;
  readonly dropHeightM: number | null;
  readonly maxSpacingM: number | null;
  readonly edgeOffsetM: number | null;
  readonly lengthSupport: {
    readonly supportSpan: number;
    readonly intervalCount: number;
    readonly pointCount: number;
    readonly actualSpacing: number | null;
    readonly mode: "grid" | "single_central";
  } | null;
  readonly widthSupport: {
    readonly supportSpan: number;
    readonly intervalCount: number;
    readonly pointCount: number;
    readonly actualSpacing: number | null;
    readonly mode: "grid" | "single_central";
  } | null;
  readonly dropperCount: number | null;
  readonly wireLm: number | null;
};

function classifyPositive(value: unknown): "missing" | "invalid" | "ok" {
  if (value == null) return "missing";
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
  if (value < 0) return "invalid";
  if (value === 0) return "missing";
  return "ok";
}

function classifyNonNegative(value: unknown): "missing" | "invalid" | "ok" {
  if (value == null) return "missing";
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
  if (value < 0) return "invalid";
  return "ok";
}

function inspectPositive(value: unknown): number | null {
  return classifyPositive(value) === "ok" ? (value as number) : null;
}

function inspectNonNegative(value: unknown): number | null {
  return classifyNonNegative(value) === "ok" ? (value as number) : null;
}

function emptyFrame(
  nestedItemId: string,
  status: CeilingSteelFrameStatus,
  reason: string | null
): CeilingSteelFrameTakeoff {
  return {
    status,
    resolution:
      status === "ok"
        ? PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED
        : status === "not_applicable"
          ? PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN
          : PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
    reason,
    nestedItemId,
    primaryDirection: null,
    primarySpacingMm: null,
    furringSpacingMm: null,
    perimeterLm: null,
    primaryRuns: null,
    primaryLm: null,
    furringRuns: null,
    furringLm: null,
    clipCount: null,
  };
}

export function calculateSteelCeilingFrame(params: {
  readonly nestedItemId: string;
  readonly lengthM: number;
  readonly widthM: number;
  readonly perimeterLm: number;
  readonly primarySpacingMm: number;
  readonly furringSpacingMm: number;
  readonly primaryDirection: CeilingDirection;
}): CeilingSteelFrameTakeoff {
  const primarySpacingM = params.primarySpacingMm / 1000;
  const furringSpacingM = params.furringSpacingMm / 1000;
  const primaryRunDimension =
    params.primaryDirection === "along_length" ? params.lengthM : params.widthM;
  const primaryCrossDimension =
    params.primaryDirection === "along_length" ? params.widthM : params.lengthM;
  const furringRunDimension = primaryCrossDimension;
  const furringCrossDimension = primaryRunDimension;
  const primaryRuns = runCountFromSpacing(
    primaryCrossDimension,
    primarySpacingM
  );
  const furringRuns = runCountFromSpacing(
    furringCrossDimension,
    furringSpacingM
  );
  if (primaryRuns <= 0 || furringRuns <= 0) {
    return emptyFrame(
      params.nestedItemId,
      "information_required",
      "Steel channel run count could not be derived from the given spacing."
    );
  }
  return {
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    reason: null,
    nestedItemId: params.nestedItemId,
    primaryDirection: params.primaryDirection,
    primarySpacingMm: params.primarySpacingMm,
    furringSpacingMm: params.furringSpacingMm,
    perimeterLm: params.perimeterLm,
    primaryRuns,
    primaryLm: round2(primaryRuns * primaryRunDimension),
    furringRuns,
    furringLm: round2(furringRuns * furringRunDimension),
    clipCount: primaryRuns * furringRuns,
  };
}

export function calculateSteelCeilingFrameFromGeometry(params: {
  readonly nestedItemId: string;
  readonly geometry: CeilingGeometryTakeoff;
  readonly primarySpacingMm: unknown;
  readonly furringSpacingMm: unknown;
  readonly primaryDirection: CeilingDirection | null | undefined;
}): CeilingSteelFrameTakeoff {
  const { geometry } = params;
  if (
    geometry.status !== "ok" ||
    geometry.length_m == null ||
    geometry.width_m == null ||
    geometry.perimeter_lm == null
  ) {
    return emptyFrame(
      params.nestedItemId,
      geometry.status === "invalid" ? "invalid" : "information_required",
      geometry.reason ??
        "Steel ceiling framing needs length and width. Area alone is not enough."
    );
  }
  const primarySpacingState = classifyPositive(params.primarySpacingMm);
  const furringSpacingState = classifyPositive(params.furringSpacingMm);
  const primaryDirection = params.primaryDirection ?? null;
  if (primarySpacingState === "invalid" || furringSpacingState === "invalid") {
    return emptyFrame(
      params.nestedItemId,
      "invalid",
      "Steel channel spacing must be a positive finite length."
    );
  }
  if (
    primarySpacingState === "missing" ||
    furringSpacingState === "missing" ||
    primaryDirection == null
  ) {
    return emptyFrame(
      params.nestedItemId,
      "information_required",
      primaryDirection == null
        ? "Steel ceiling framing needs a primary direction."
        : "Steel ceiling framing needs primary and furring spacing."
    );
  }
  const primarySpacingMm = params.primarySpacingMm as number;
  const furringSpacingMm = params.furringSpacingMm as number;
  return calculateSteelCeilingFrame({
    nestedItemId: params.nestedItemId,
    lengthM: geometry.length_m,
    widthM: geometry.width_m,
    perimeterLm: geometry.perimeter_lm,
    primarySpacingMm,
    furringSpacingMm,
    primaryDirection,
  });
}

export function calculateCeilingSteelFraming(
  portion: CeilingPortion,
  geometry?: CeilingGeometryTakeoff
): CeilingSteelFrameTakeoff {
  if (portion.structure.family !== "steel_direct_fix") {
    return emptyFrame(
      portion.id,
      "not_applicable",
      "This ceiling structure is not steel direct-fix."
    );
  }
  return calculateSteelCeilingFrameFromGeometry({
    nestedItemId: portion.id,
    geometry: geometry ?? deriveCeilingGeometry(portion),
    primarySpacingMm: portion.structure.steel?.primary_spacing_mm,
    furringSpacingMm: portion.structure.steel?.furring_spacing_mm,
    primaryDirection: portion.structure.steel?.direction,
  });
}

function emptySuspended(
  nestedItemId: string,
  frame: CeilingSteelFrameTakeoff,
  status: CeilingSteelFrameStatus,
  reason: string | null
): CeilingSuspendedTakeoff {
  return {
    status,
    resolution:
      status === "ok"
        ? PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED
        : status === "not_applicable"
          ? PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN
          : PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
    reason,
    nestedItemId,
    frame,
    dropHeightM: null,
    maxSpacingM: null,
    edgeOffsetM: null,
    lengthSupport: null,
    widthSupport: null,
    dropperCount: null,
    wireLm: null,
  };
}

export function calculateCeilingSuspendedFraming(
  portion: CeilingPortion,
  geometry?: CeilingGeometryTakeoff
): CeilingSuspendedTakeoff {
  const nestedItemId = portion.id;
  if (portion.structure.family !== "suspended_steel") {
    return emptySuspended(
      nestedItemId,
      emptyFrame(nestedItemId, "not_applicable", "Not a suspended ceiling."),
      "not_applicable",
      "This ceiling structure is not suspended steel."
    );
  }
  const geo = geometry ?? deriveCeilingGeometry(portion);
  const frame = calculateSteelCeilingFrameFromGeometry({
    nestedItemId,
    geometry: geo,
    primarySpacingMm: portion.structure.steel?.primary_spacing_mm,
    furringSpacingMm: portion.structure.steel?.furring_spacing_mm,
    primaryDirection: portion.structure.steel?.direction,
  });
  if (frame.status !== "ok") {
    return emptySuspended(
      nestedItemId,
      frame,
      frame.status,
      frame.reason
    );
  }
  if (geo.length_m == null || geo.width_m == null) {
    return emptySuspended(
      nestedItemId,
      frame,
      "information_required",
      "Suspended ceilings need length and width. Area alone is not enough."
    );
  }

  const dropRaw = portion.structure.suspended?.drop_height_m;
  const maxRaw = portion.structure.suspended?.max_spacing_m;
  const edgeRaw = portion.structure.suspended?.edge_offset_m;
  const dropState = classifyPositive(dropRaw);
  const maxState = classifyPositive(maxRaw);
  const edgeState = classifyNonNegative(edgeRaw);

  if (dropState === "invalid" || maxState === "invalid" || edgeState === "invalid") {
    return emptySuspended(
      nestedItemId,
      frame,
      "invalid",
      dropState === "invalid"
        ? "Drop height must be a positive finite length."
        : maxState === "invalid"
          ? "Maximum dropper spacing must be a positive finite length."
          : "Edge offset must be a finite value of zero or more."
    );
  }

  const dropHeightM = inspectPositive(dropRaw);
  const maxSpacingM = inspectPositive(maxRaw);
  const edgeOffsetM = inspectNonNegative(edgeRaw);
  if (dropHeightM == null || maxSpacingM == null || edgeOffsetM == null) {
    return emptySuspended(
      nestedItemId,
      frame,
      "information_required",
      dropHeightM == null
        ? "Suspended ceilings need a drop height."
        : maxSpacingM == null
          ? "Suspended ceilings need a maximum dropper spacing."
          : "Suspended ceilings need an edge offset."
    );
  }

  const lengthSupport = supportPointsBetweenEdgeOffsets(
    geo.length_m,
    edgeOffsetM,
    maxSpacingM
  );
  const widthSupport = supportPointsBetweenEdgeOffsets(
    geo.width_m,
    edgeOffsetM,
    maxSpacingM
  );
  if (!lengthSupport.ok) {
    return emptySuspended(
      nestedItemId,
      frame,
      lengthSupport.reason === "invalid" ? "invalid" : "information_required",
      lengthSupport.message
    );
  }
  if (!widthSupport.ok) {
    return emptySuspended(
      nestedItemId,
      frame,
      widthSupport.reason === "invalid" ? "invalid" : "information_required",
      widthSupport.message
    );
  }

  const dropperCount = lengthSupport.pointCount * widthSupport.pointCount;
  return {
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    reason: null,
    nestedItemId,
    frame,
    dropHeightM,
    maxSpacingM,
    edgeOffsetM,
    lengthSupport: {
      supportSpan: lengthSupport.supportSpan,
      intervalCount: lengthSupport.intervalCount,
      pointCount: lengthSupport.pointCount,
      actualSpacing: lengthSupport.actualSpacing,
      mode: lengthSupport.mode,
    },
    widthSupport: {
      supportSpan: widthSupport.supportSpan,
      intervalCount: widthSupport.intervalCount,
      pointCount: widthSupport.pointCount,
      actualSpacing: widthSupport.actualSpacing,
      mode: widthSupport.mode,
    },
    dropperCount,
    wireLm: round2(dropperCount * dropHeightM),
  };
}

import type { RateSourceType } from "@/lib/estimate/rate-source-labels";
import type { MaterialBuildUpEntry } from "@/lib/estimate/material-buildup-meta";
import type { MaterialRateResolution } from "@/lib/estimate/material-rate-pricing";
import type {
  PricingOwner,
  PricingSource,
} from "@/lib/estimate/pricing-ownership";
import { classifyRateSource, getRateSourceLabel } from "@/lib/estimate/rate-source-labels";

const META_MARKER = "\n__quotr_meta__:";

export type QuantityBasisConfidence = "confirmed" | "derived" | "assumed";

export type QuantityBasis = {
  sourceFact: string;
  sourceLabel: string;
  quantity: number;
  unit: string;
  formula?: string;
  confidence?: QuantityBasisConfidence;
};

export type LabourMinimumMeta = {
  calculatedHours: number;
  finalHours: number;
  minimumApplied: boolean;
  minCrewSize?: number;
  minDurationHours?: number;
  minTotalHours?: number;
  accessFactor?: number;
  accessLabel?: string;
  smallJobFactor?: number;
};

export type AllowanceMinimumMeta = {
  minimumApplied: boolean;
  reason: string;
  scopeKey?: string;
  calculatedCost?: number;
  calculatedSell?: number;
  minimumCost?: number;
  minimumSell?: number;
};

export type LineItemMetadata = {
  quantity?: number;
  unit?: string;
  labourHours?: number;
  productivityRate?: number;
  productivityUnit?: string;
  itemKey?: string;
  costRate?: number;
  sellRate?: number;
  rateSourceType?: RateSourceType;
  sellDerivedFromMargin?: boolean;
  materialBuildUp?: MaterialBuildUpEntry;
  materialBuildUps?: MaterialBuildUpEntry[];
  materialRateResolution?: MaterialRateResolution;
  pricingOwner?: PricingOwner;
  scopeKey?: string;
  overlapGroup?: string;
  includedInTotal?: boolean;
  clientVisible?: boolean;
  pricingSource?: PricingSource;
  quantityBasis?: QuantityBasis;
  labourMinimum?: LabourMinimumMeta;
  allowanceMinimum?: AllowanceMinimumMeta;
};

export function serializeLineItemMetadata(meta: LineItemMetadata): string {
  const payload = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value != null && value !== "")
  );
  if (Object.keys(payload).length === 0) return "";
  return `${META_MARKER}${JSON.stringify(payload)}`;
}

export function parseLineItemNotes(notes: string | null | undefined): {
  displayNotes?: string;
  metadata: LineItemMetadata;
} {
  if (!notes) {
    return { metadata: {} };
  }

  const markerIndex = notes.indexOf(META_MARKER);
  if (markerIndex === -1) {
    return { displayNotes: notes, metadata: {} };
  }

  const displayNotes = notes.slice(0, markerIndex).trim();
  const rawMeta = notes.slice(markerIndex + META_MARKER.length);

  try {
    const metadata = JSON.parse(rawMeta) as LineItemMetadata;
    return {
      displayNotes: displayNotes || undefined,
      metadata,
    };
  } catch {
    return { displayNotes: notes, metadata: {} };
  }
}

export function buildPersistedLineItemNotes(params: {
  notes?: string;
  metadata: LineItemMetadata;
}): string | null {
  const metaSuffix = serializeLineItemMetadata(params.metadata);
  const parts = [params.notes?.trim(), metaSuffix].filter(Boolean);
  const joined = parts.join("");
  return joined || null;
}

export function getMaterialBuildUps(
  notes: string | null | undefined
): MaterialBuildUpEntry[] {
  const { metadata } = parseLineItemNotes(notes);
  if (metadata.materialBuildUps?.length) {
    return metadata.materialBuildUps;
  }
  if (metadata.materialBuildUp) {
    return [metadata.materialBuildUp];
  }
  return [];
}

export function getMaterialBuildUpDetailLines(
  notes: string | null | undefined
): string[] {
  const lines: string[] = [];
  for (const buildUp of getMaterialBuildUps(notes)) {
    lines.push(buildUp.display);
    if (buildUp.basis) {
      lines.push(buildUp.basis);
    }
    const boardWidthMm = buildUp.inputs?.boardWidthMm;
    if (typeof boardWidthMm === "number") {
      lines.push(`Board width: ${boardWidthMm}mm`);
    }
    const areaM2 = buildUp.inputs?.areaM2;
    if (
      typeof areaM2 === "number" &&
      buildUp.buildUpType === "decking_boards_lm"
    ) {
      lines.push(`Deck area: ${areaM2}m²`);
    }
    if (
      buildUp.wastagePercent != null &&
      !buildUp.display.toLowerCase().includes("wastage")
    ) {
      lines.push(`Wastage: ${buildUp.wastagePercent}%`);
    }
  }
  return lines;
}

export function getMaterialBuildUpDisplay(
  notes: string | null | undefined
): string | null {
  const buildUps = getMaterialBuildUps(notes);
  if (buildUps.length === 0) {
    return null;
  }
  return buildUps.map((buildUp) => buildUp.display).join(" · ");
}

export function getMaterialRateSourceDisplay(
  notes: string | null | undefined
): string | null {
  return parseLineItemNotes(notes).metadata.materialRateResolution?.display ?? null;
}

export function buildPricingNotesFromEstimateLineItem(
  notes: string | null | undefined
): string | null {
  const { displayNotes, metadata } = parseLineItemNotes(notes);
  const metaToStore: LineItemMetadata = {};
  if (metadata.materialBuildUp) {
    metaToStore.materialBuildUp = metadata.materialBuildUp;
  }
  if (metadata.materialBuildUps?.length) {
    metaToStore.materialBuildUps = metadata.materialBuildUps;
  } else if (metadata.materialBuildUp) {
    metaToStore.materialBuildUps = [metadata.materialBuildUp];
  }
  if (metadata.materialRateResolution) {
    metaToStore.materialRateResolution = metadata.materialRateResolution;
  }
  if (metadata.pricingOwner) {
    metaToStore.pricingOwner = metadata.pricingOwner;
  }
  if (metadata.scopeKey) {
    metaToStore.scopeKey = metadata.scopeKey;
  }
  if (metadata.overlapGroup) {
    metaToStore.overlapGroup = metadata.overlapGroup;
  }
  if (metadata.includedInTotal != null) {
    metaToStore.includedInTotal = metadata.includedInTotal;
  }
  if (metadata.clientVisible != null) {
    metaToStore.clientVisible = metadata.clientVisible;
  }
  if (metadata.pricingSource) {
    metaToStore.pricingSource = metadata.pricingSource;
  }
  if (metadata.quantityBasis) {
    metaToStore.quantityBasis = metadata.quantityBasis;
  }
  if (metadata.labourMinimum) {
    metaToStore.labourMinimum = metadata.labourMinimum;
  }
  if (metadata.allowanceMinimum) {
    metaToStore.allowanceMinimum = metadata.allowanceMinimum;
  }
  if (Object.keys(metaToStore).length === 0) {
    return displayNotes || null;
  }

  return buildPersistedLineItemNotes({
    notes: displayNotes,
    metadata: metaToStore,
  });
}

export function resolveLineItemRateSource(params: {
  rateSource: string;
  rateSourceType?: RateSourceType;
}): { type: RateSourceType; label: string } {
  const type = params.rateSourceType ?? classifyRateSource(params.rateSource);
  return {
    type,
    label: getRateSourceLabel(type),
  };
}

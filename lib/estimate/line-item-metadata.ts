import type { RateSourceType } from "@/lib/estimate/rate-source-labels";
import { classifyRateSource, getRateSourceLabel } from "@/lib/estimate/rate-source-labels";

const META_MARKER = "\n__quotr_meta__:";

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

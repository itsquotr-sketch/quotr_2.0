/**
 * Quotr sourced public-list benchmark records — fallback estimating rates only.
 * Not company cost. Not trade/supplier/account cost. Not a market average.
 * SKU is provenance mapping, never canonical MaterialIdentity.
 * Debug identity keys are not persistent catalogue row IDs.
 */
import { round2 } from "@/lib/estimate/facts";
import {
  buildStructuralTimberIdentity,
  compareMaterialIdentities,
  serializeMaterialIdentityKey,
  STRUCTURAL_FRAMING_PRODUCT_FAMILY,
  type MaterialIdentity,
} from "@/lib/materials/identity";

export const NZ_GST_INCLUSIVE_DIVISOR = 1.15;
export const STRUCTURAL_BENCHMARK_STALE_DAYS = 90;
export const STRUCTURAL_BENCHMARK_REVIEW_CADENCE = "quarterly";

export const STRUCTURAL_TIMBER_BENCHMARK_RESEARCHED_AT = "2026-08-18";
export const STRUCTURAL_TIMBER_BENCHMARK_VERIFIED_AT = "2026-08-18";

export type StructuralBenchmarkGstBasis = "inclusive" | "exclusive" | "unknown";
export type StructuralBenchmarkChannel = "retail_public" | "account" | "unknown";
export type StructuralBenchmarkQuality = "STRONG" | "WEAK" | "NONE";

export type StructuralTimberBenchmarkEvidence = {
  canonicalMaterialIdentity: MaterialIdentity;
  identityKey: string;
  rateUnit: "lm";
  normalizedRateExGst: number;
  sourceName: string;
  sourceType: "merchant_public";
  sourceURL: string;
  sourceProductCode: string;
  sourceProductDescription: string;
  sourceRegion: string;
  sourceBranch: string | null;
  sourcePriceInclGst: number;
  sourceUnit: string;
  gstBasis: StructuralBenchmarkGstBasis;
  channel: StructuralBenchmarkChannel;
  stockLengthM: number;
  conversionFormula: string;
  researchedAt: string;
  verifiedAt: string;
  quality: StructuralBenchmarkQuality;
  notes: string;
  evidenceId: string;
};

const CONVERSION_FORMULA =
  "(sourcePriceInclGst / stockLengthM) / 1.15";

function exGstFromInclusivePiece(params: {
  sourcePriceInclGst: number;
  stockLengthM: number;
}): number {
  return round2(
    params.sourcePriceInclGst / params.stockLengthM / NZ_GST_INCLUSIVE_DIVISOR
  );
}

function framingKdIdentity(
  section: string,
  description: string
): MaterialIdentity {
  const identity = buildStructuralTimberIdentity({
    sectionRaw: section,
    gradeRaw: "SG8",
    treatmentRaw: "H3.2",
    processingRaw: "KD",
    productFamily: STRUCTURAL_FRAMING_PRODUCT_FAMILY,
    originalDescription: description,
  });
  if (!identity) {
    throw new Error(`DECK-1C-B2: failed to build identity for ${section}`);
  }
  return identity;
}

function sourcedLmBenchmark(params: {
  evidenceId: string;
  section: string;
  description: string;
  sourceURL: string;
  sourceProductCode: string;
  sourcePriceInclGst: number;
  stockLengthM: number;
  notes: string;
}): StructuralTimberBenchmarkEvidence {
  const identity = framingKdIdentity(params.section, params.description);
  return {
    canonicalMaterialIdentity: identity,
    identityKey: serializeMaterialIdentityKey(identity),
    rateUnit: "lm",
    normalizedRateExGst: exGstFromInclusivePiece({
      sourcePriceInclGst: params.sourcePriceInclGst,
      stockLengthM: params.stockLengthM,
    }),
    sourceName: "Bunnings NZ",
    sourceType: "merchant_public",
    sourceURL: params.sourceURL,
    sourceProductCode: params.sourceProductCode,
    sourceProductDescription: params.description,
    sourceRegion: "NZ website list",
    sourceBranch: null,
    sourcePriceInclGst: params.sourcePriceInclGst,
    sourceUnit: "piece",
    gstBasis: "inclusive",
    channel: "retail_public",
    stockLengthM: params.stockLengthM,
    conversionFormula: CONVERSION_FORMULA,
    researchedAt: STRUCTURAL_TIMBER_BENCHMARK_RESEARCHED_AT,
    verifiedAt: STRUCTURAL_TIMBER_BENCHMARK_VERIFIED_AT,
    quality: "STRONG",
    notes: params.notes,
    evidenceId: params.evidenceId,
  };
}

/**
 * Owner D1/D4/D10: three exact Bunnings KD Quotr benchmark fallbacks only.
 * Values recalculated from B1 raw piece prices (T10, T01, T14).
 */
export const STRUCTURAL_TIMBER_BENCHMARKS: readonly StructuralTimberBenchmarkEvidence[] =
  [
    sourcedLmBenchmark({
      evidenceId: "T10",
      section: "90x45",
      description: "90 x 45mm SG8 H3.2 KD Treated Radiata Timber Framing",
      sourceURL:
        "https://www.bunnings.co.nz/90-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-4-8m_p0616579",
      sourceProductCode: "0616579",
      sourcePriceInclGst: 44.66,
      stockLengthM: 4.8,
      notes:
        "B1 T10. Quotr sourced public-list benchmark from Bunnings NZ retail evidence. Not a company, trade, or supplier rate.",
    }),
    sourcedLmBenchmark({
      evidenceId: "T01",
      section: "140x45",
      description: "140 x 45mm SG8 H3.2 KD Treated Radiata Timber Framing",
      sourceURL:
        "https://www.bunnings.co.nz/140-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-4-8m_p0616335",
      sourceProductCode: "0616335",
      sourcePriceInclGst: 75.35,
      stockLengthM: 4.8,
      notes:
        "B1 T01. Quotr sourced public-list benchmark from Bunnings NZ retail evidence. Not averaged with ITM.",
    }),
    sourcedLmBenchmark({
      evidenceId: "T14",
      section: "190x45",
      description: "190 x 45mm SG8 H3.2 KD Treated Radiata Timber Framing",
      sourceURL:
        "https://www.bunnings.co.nz/190-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-6m_p0616565",
      sourceProductCode: "0616565",
      sourcePriceInclGst: 125.09,
      stockLengthM: 6.0,
      notes:
        "B1 T14. Quotr sourced public-list benchmark from Bunnings NZ retail evidence. Not averaged with ITM.",
    }),
  ];

export function findExactStructuralTimberBenchmark(
  identity: MaterialIdentity,
  unit: string
): StructuralTimberBenchmarkEvidence | null {
  if (unit.toLowerCase() !== "lm") return null;
  if (identity.productFamily !== STRUCTURAL_FRAMING_PRODUCT_FAMILY) return null;
  return (
    STRUCTURAL_TIMBER_BENCHMARKS.find(
      (row) =>
        compareMaterialIdentities(identity, row.canonicalMaterialIdentity) ===
        "exact"
    ) ?? null
  );
}

export function structuralBenchmarkIsStale(
  verifiedAt: string,
  now: Date = new Date()
): boolean {
  const verified = Date.parse(`${verifiedAt}T00:00:00.000Z`);
  if (!Number.isFinite(verified)) return true;
  const ageMs = now.getTime() - verified;
  return ageMs > STRUCTURAL_BENCHMARK_STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function cloneStructuralBenchmarkEvidence(
  evidence: StructuralTimberBenchmarkEvidence
): StructuralTimberBenchmarkEvidence {
  return {
    ...evidence,
    canonicalMaterialIdentity: { ...evidence.canonicalMaterialIdentity },
  };
}

/**
 * DECK-MATURITY-2B-R1 — Quotr starter benchmark for 125×125 H5 sawn house pile.
 * Owner-approved $23.50 / lm EX GST. Not company cost. Not laminated post. Not H4.
 */
import {
  buildSupportMaterialIdentity,
  compareMaterialIdentities,
  serializeMaterialIdentityKey,
  type MaterialIdentity,
} from "@/lib/materials/identity";

export const HOUSE_PILE_BENCHMARK_COST_EX_GST = 23.5;
export const HOUSE_PILE_BENCHMARK_UNIT = "lm" as const;

export const HOUSE_PILE_125_IDENTITY: MaterialIdentity = (() => {
  const identity = buildSupportMaterialIdentity({
    supportType: "House pile",
    sectionRaw: "125x125",
    treatmentRaw: "H5",
    originalDescription: "125×125 H5 sawn house pile",
  });
  if (!identity) {
    throw new Error("DECK-2B-R1: failed to build 125×125 H5 house pile identity");
  }
  return identity;
})();

export const HOUSE_PILE_125_IDENTITY_KEY = serializeMaterialIdentityKey(
  HOUSE_PILE_125_IDENTITY
);

export const HOUSE_PILE_BENCHMARK_EVIDENCE = {
  identityKey: HOUSE_PILE_125_IDENTITY_KEY,
  rateUnit: HOUSE_PILE_BENCHMARK_UNIT,
  normalizedRateExGst: HOUSE_PILE_BENCHMARK_COST_EX_GST,
  sourceName: "Quotr starter benchmark",
  sourceType: "quotr_starter" as const,
  gstBasis: "exclusive" as const,
  notes:
    "Owner-approved 125×125 H5 sawn house pile $23.50/lm ex GST. Not a company, trade, laminated, or H4 fence-post rate.",
  evidenceId: "DECK-2B-R1-H5-125",
};

export function findExactHousePileBenchmark(
  identity: MaterialIdentity,
  unit: string
): typeof HOUSE_PILE_BENCHMARK_EVIDENCE | null {
  if (unit.toLowerCase() !== "lm") return null;
  if (
    compareMaterialIdentities(identity, HOUSE_PILE_125_IDENTITY) !== "exact"
  ) {
    return null;
  }
  return HOUSE_PILE_BENCHMARK_EVIDENCE;
}

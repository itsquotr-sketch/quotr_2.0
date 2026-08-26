/**
 * RETAINING-WALL-MATURITY-1B-R1 — standard scope defaults.
 * Novacoil / drainage aggregate are normally applicable on timber, sleeper,
 * and masonry walls. Explicit false removes them. Bulk excavation is never assumed.
 */

import { getBooleanFact } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";
import type { RetainingWallSystemClass } from "@/lib/estimate/retaining-wall-systems";

export const RW_DRAINAGE_STANDARD_ASSUMPTION =
  "Drainage / novacoil included as standard estimating assumption.";

export const RW_BACKFILL_STANDARD_ASSUMPTION =
  "Drainage aggregate / backfill included as standard estimating assumption.";

function assumesStandardDrainage(system: RetainingWallSystemClass): boolean {
  return (
    system === "TIMBER_RETAINING_WALL" ||
    system === "CONCRETE_SLEEPER_WALL" ||
    system === "CONCRETE_MASONRY_WALL"
  );
}

export function resolveRetainingWallDrainageIncluded(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  system: RetainingWallSystemClass;
}): { included: boolean; assumed: boolean } {
  const explicit = getBooleanFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "retaining_wall.drainage_required"
  );
  if (explicit === false) return { included: false, assumed: false };
  if (explicit === true) return { included: true, assumed: false };
  const assumed = assumesStandardDrainage(params.system);
  return { included: assumed, assumed };
}

export function resolveRetainingWallBackfillIncluded(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  system: RetainingWallSystemClass;
}): { included: boolean; assumed: boolean } {
  const explicit = getBooleanFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "retaining_wall.backfill_included"
  );
  if (explicit === false) return { included: false, assumed: false };
  if (explicit === true) return { included: true, assumed: false };
  const assumed = assumesStandardDrainage(params.system);
  return { included: assumed, assumed };
}

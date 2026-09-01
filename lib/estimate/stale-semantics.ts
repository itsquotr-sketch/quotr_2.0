/**
 * Estimate stale-state semantics.
 *
 * NO ESTIMATE YET is not ESTIMATE NEEDS UPDATING.
 * "Needs updating" requires an existing estimate that was previously current.
 */

export function estimateNeedsUpdating(params: {
  hasEstimate: boolean;
  isStale: boolean;
}): boolean {
  return params.hasEstimate && params.isStale;
}

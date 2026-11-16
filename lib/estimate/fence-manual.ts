/**
 * An explicit glass pool fence has no trusted model. The requested length
 * stays one manual Pricing scope. It does not become a timber or metal package.
 */
export const FENCE_MANUAL_SCOPE_COMPONENT = "fence.manual.scope";
export const FENCE_MANUAL_SCOPE_NESTED_ID = "glass-pool-fence";

export function fenceManualScopeKey(workAreaId: string): string {
  return `fence.manual:${workAreaId}:${FENCE_MANUAL_SCOPE_COMPONENT}`;
}

export function isGlassPoolFenceRequest(value: string | null | undefined): boolean {
  const text = (value ?? "").trim().toLowerCase();
  if (!text.includes("glass")) return false;
  if (text === "glass") return true;
  return text.includes("pool") || text.includes("fenc");
}

export function glassPoolFenceManualScope(params: {
  material?: string | null;
  system?: string | null;
  lengthM?: number | null;
}): { description: string; quantity: number } | null {
  const material = params.material?.trim() ?? "";
  const system = params.system?.trim() ?? "";
  const description = isGlassPoolFenceRequest(material)
    ? material
    : isGlassPoolFenceRequest(system)
      ? system
      : "";
  if (!description) return null;
  if (params.lengthM == null || !Number.isFinite(params.lengthM) || params.lengthM <= 0) {
    return null;
  }
  return { description, quantity: params.lengthM };
}

export function fenceLineIsManualPricingEligible(item: {
  componentKey?: string | null;
  rateSourceType?: string | null;
  quantity?: number | null;
  recommendedCost?: number | null;
}): boolean {
  if (item.componentKey !== FENCE_MANUAL_SCOPE_COMPONENT) return false;
  if (item.rateSourceType !== "missing") return false;
  if (item.quantity == null || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    return false;
  }
  if (item.recommendedCost != null && item.recommendedCost > 0) return false;
  return true;
}

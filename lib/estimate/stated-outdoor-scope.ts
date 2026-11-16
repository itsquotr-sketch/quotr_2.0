/**
 * Stated outdoor quantities from the original brief.
 * Thickness, disposal volume, paving specification, and drainage outlet
 * stay unresolved when the brief does not give them.
 */

export const CONCRETE_PATH_MANUAL_COMPONENT = "demolition.manual.scope";
export const CONCRETE_PATH_NESTED_ID = "concrete-path";
export const PAVING_MANUAL_COMPONENT = "paving.manual.scope";
export const PAVING_NESTED_ID = "paved-patio";
export const STATED_DRAINAGE_LENGTH_FACT = "retaining_wall.drainage_length_m";

const MANUAL_COMPONENTS = new Set([
  CONCRETE_PATH_MANUAL_COMPONENT,
  PAVING_MANUAL_COMPONENT,
]);

function areaM2(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function concretePathRemovalM2(brief: string): number | null {
  return areaM2(
    brief,
    /remove\s+(\d+(?:\.\d+)?)\s*(?:m²|m2)\s+(?:of\s+)?(?:old\s+)?concrete\s+path\b/i
  );
}

export function pavedPatioAreaM2(brief: string): number | null {
  return areaM2(
    brief,
    /(\d+(?:\.\d+)?)\s*(?:m²|m2)\s+paved\s+patio\b/i
  );
}

export function statedDrainageLengthM(brief: string): number | null {
  const match = brief.match(
    /(\d+(?:\.\d+)?)\s*m(?:etres?)?\s+of\s+drainage\b/i
  );
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isConcretePathScope(items: readonly string[]): boolean {
  return items.some((item) => /concrete path/i.test(item));
}

export function statedOutdoorLineIsManualPricingEligible(item: {
  componentKey?: string | null;
  rateSourceType?: string | null;
  quantity?: number | null;
  recommendedCost?: number | null;
}): boolean {
  if (!item.componentKey || !MANUAL_COMPONENTS.has(item.componentKey)) return false;
  if (item.rateSourceType !== "missing") return false;
  if (item.quantity == null || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    return false;
  }
  if (item.recommendedCost != null && item.recommendedCost > 0) return false;
  return true;
}

export function isStatedOutdoorManualComponent(componentId: string | null | undefined): boolean {
  return Boolean(componentId && MANUAL_COMPONENTS.has(componentId));
}

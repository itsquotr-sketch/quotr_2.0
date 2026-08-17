import type { RequirementKind } from "@/lib/estimate/requirements";

export type RequirementIdentityInput = {
  workAreaId: string;
  kind: RequirementKind;
  componentKey: string;
  /** Semantic discriminator when the same kind+component can repeat. */
  variantKey?: string | null;
  /**
   * Lower-stability fallback only when the domain lacks a better stable
   * identifier. Do not use output-array position as normal identity.
   */
  indexFallback?: number;
};

function sanitizeSegment(value: string): string {
  return value.trim().replace(/:/g, ".");
}

/**
 * Deterministic requirement identity for regeneration comparison, shadow/parity,
 * snapshot linkage, and provenance diffs.
 *
 * WA123:material:decking.surface
 * WA123:labour:decking.install
 * WA123:material:joist:140x45-h3.2
 */
export function buildRequirementId(input: RequirementIdentityInput): string {
  const workAreaId = sanitizeSegment(input.workAreaId);
  const kind = sanitizeSegment(input.kind);
  const componentKey = sanitizeSegment(input.componentKey);
  if (!workAreaId || !kind || !componentKey) {
    throw new Error("requirement identity requires workAreaId, kind, and componentKey");
  }

  const parts = [workAreaId, kind, componentKey];
  const variant = input.variantKey ? sanitizeSegment(input.variantKey) : "";
  if (variant) {
    parts.push(variant);
  } else if (typeof input.indexFallback === "number") {
    parts.push(`#${input.indexFallback}`);
  }
  return parts.join(":");
}

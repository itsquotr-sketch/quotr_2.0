/**
 * FENCE-FAMILY-CLOSURE — quote readiness for unresolved requested Fence scope.
 *
 * Unresolved manufactured modular gates must not present as commercially ready.
 * Dedicated per-line "Excluded from quote" is not a new product system: Job Plan
 * Gate requested Yes/No is the explicit include / exclude action.
 */

import {
  classifyFenceMetalMaterial,
  classifyFenceSystem,
  isModularFenceSystem,
  type FenceSystemClass,
} from "@/lib/estimate/fence-systems";
import {
  FENCE_MODULAR_GATE_PRICING_DETAIL,
  FENCE_MODULAR_GATE_PRICING_REQUIRED,
} from "@/lib/estimate/fence-modular-1c";

export type FenceQuoteReadinessStatus = "READY" | "ATTENTION_REQUIRED";

export type FenceQuoteReadiness = {
  readonly status: FenceQuoteReadinessStatus;
  readonly unresolvedModularGate: boolean;
  readonly reasons: readonly string[];
};

export const FENCE_MODULAR_GATE_QUOTE_ATTENTION =
  "Requested manufactured gate is not priced. Quote is not commercially ready until a compatible gate is priced or Gate requested is set to No.";

export const FENCE_MODULAR_GATE_EXCLUSION_CLIENT =
  "Manufactured gate excluded unless otherwise noted.";

export function isUnresolvedModularGateMissingInfo(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("modular fence gate") &&
    (lower.includes("pricing required") || lower.includes("pricing required."))
  );
}

export function isFenceQuoteBlockingMissingInfo(text: string): boolean {
  if (isUnresolvedModularGateMissingInfo(text)) return true;
  return /panel height does not match/i.test(text);
}

export function fenceQuoteBlockingLabels(
  missingInfo: readonly string[]
): string[] {
  return missingInfo.filter((row) => isFenceQuoteBlockingMissingInfo(row));
}

export function fenceQuoteReadiness(params: {
  readonly missingInfo: readonly string[];
  readonly system?: FenceSystemClass;
  readonly modularGateRequested?: boolean | null;
}): FenceQuoteReadiness {
  const reasons: string[] = [];
  const unresolvedModularGate =
    (params.system == null || isModularFenceSystem(params.system)) &&
    (params.modularGateRequested === true ||
      params.missingInfo.some(isUnresolvedModularGateMissingInfo));

  if (unresolvedModularGate) {
    reasons.push(FENCE_MODULAR_GATE_QUOTE_ATTENTION);
  }
  if (params.missingInfo.some((row) => /panel height does not match/i.test(row))) {
    reasons.push(
      "Selected manufactured section height does not match the fence height. Quote is not commercially ready until a compatible product is selected."
    );
  }

  return {
    status: reasons.length > 0 ? "ATTENTION_REQUIRED" : "READY",
    unresolvedModularGate,
    reasons,
  };
}

export function fenceQuoteSystemPhrase(params: {
  readonly system: FenceSystemClass;
  readonly systemOrMaterial?: string | null;
  readonly metalMaterial?: string | null;
}): string {
  const { system } = params;
  if (system === "TIMBER_VERTICAL_PALING") return "vertical timber paling fence";
  if (system === "TIMBER_HORIZONTAL_SLAT") return "horizontal timber slat fence";
  if (system === "PLASTIC_MODULAR") return "plastic/composite fence";
  if (system === "METAL_SLAT_MODULAR") {
    const metal =
      classifyFenceMetalMaterial(params.metalMaterial) ??
      classifyFenceMetalMaterial(params.systemOrMaterial);
    return metal === "steel" ? "steel slat fence" : "aluminium slat fence";
  }
  const classified = classifyFenceSystem(
    params.systemOrMaterial,
    params.metalMaterial
  );
  if (classified !== "missing" && classified !== "unsupported") {
    return fenceQuoteSystemPhrase({
      system: classified,
      systemOrMaterial: params.systemOrMaterial,
      metalMaterial: params.metalMaterial,
    });
  }
  return "fence";
}

export {
  FENCE_MODULAR_GATE_PRICING_DETAIL,
  FENCE_MODULAR_GATE_PRICING_REQUIRED,
};

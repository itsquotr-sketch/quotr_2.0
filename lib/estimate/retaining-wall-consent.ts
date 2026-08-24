/**
 * RETAINING-WALL-MATURITY-1A — surcharge / consent note.
 * Estimating guidance only. Quotr does not determine legal compliance.
 */

import { RETAINING_WALL_CONSENT_HEIGHT_M } from "@/lib/estimate/retaining-wall-geometry";

export const RW_SURCHARGE_OPTIONS = [
  "No",
  "Driveway / vehicle loading",
  "Parking",
  "Building / structure",
  "Another retaining wall",
  "Sloping ground above",
  "Other",
  "Not sure",
] as const;

export type RwSurchargeState = "NO" | "YES" | "NOT_SURE" | "UNKNOWN";

export function classifyRetainingWallSurcharge(
  raw: string | boolean | null | undefined
): RwSurchargeState {
  if (raw == null || raw === "") return "UNKNOWN";
  if (raw === false) return "NO";
  if (raw === true) return "YES";
  const t = String(raw).trim().toLowerCase();
  if (!t) return "UNKNOWN";
  if (
    t === "no" ||
    t === "none" ||
    t === "not required" ||
    t === "false"
  ) {
    return "NO";
  }
  if (t.includes("not sure") || t.includes("unsure") || t === "unknown") {
    return "NOT_SURE";
  }
  return "YES";
}

export const RW_CONSENT_REVIEW_NOTE =
  "Consent or engineering review may be required. The standard 1.5 m no-surcharge retaining-wall exemption may not apply.";

export const RW_CONSENT_CHECK_NOTE =
  "Check the applicable Building Act exemption / local consent requirements.";

export const RW_NOT_LEGAL_DETERMINATION =
  "Quotr estimates quantities and commercial effort. It does not determine legal compliance, consent exemption, or structural adequacy.";

export function retainingWallConsentNotes(params: {
  maxHeightM: number;
  surcharge: RwSurchargeState;
}): string[] {
  const overHeight = params.maxHeightM > RETAINING_WALL_CONSENT_HEIGHT_M;
  const surchargeRisk =
    params.surcharge === "YES" || params.surcharge === "NOT_SURE";
  if (!overHeight && params.surcharge === "NO") {
    return [];
  }
  if (!overHeight && params.surcharge === "UNKNOWN") {
    return [];
  }
  if (overHeight || surchargeRisk) {
    return [RW_CONSENT_REVIEW_NOTE, RW_CONSENT_CHECK_NOTE];
  }
  return [];
}

export function surchargeOptionExists(label: string): boolean {
  return RW_SURCHARGE_OPTIONS.some(
    (option) => option.toLowerCase() === label.toLowerCase()
  );
}

/**
 * CEILINGS WA-04D — unsupported-specialist recognition.
 *
 * Ordinary rectangular plasterboard / timber / steel / tile-and-grid
 * calculators must not silently absorb these systems.
 */

import type {
  CeilingPortion,
  CeilingSpecialistKind,
} from "@/lib/estimate/ceilings-portions";
import { isUnsupportedCeilingBulkhead } from "@/lib/estimate/ceilings-portions";

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function canonicalCeilingSpecialistKindFromText(
  text: string
): CeilingSpecialistKind | null {
  const raw = normalise(text);
  if (includesAny(raw, ["coffered", "coffer ceiling", "coffered ceiling"])) {
    return "coffered";
  }
  if (includesAny(raw, ["curved ceiling", "vaulted", "barrel vault"])) {
    return "curved";
  }
  if (
    includesAny(raw, [
      "complex raking",
      "raking ceiling",
      "raked ceiling",
      "cathedral ceiling",
    ])
  ) {
    return "complex_raking";
  }
  if (includesAny(raw, ["feature baffle", "baffle ceiling", "acoustic baffle"])) {
    return "feature_baffles";
  }
  if (
    includesAny(raw, [
      "engineered structural ceiling",
      "structural ceiling system",
      "engineered ceiling system",
    ])
  ) {
    return "engineered_structural";
  }
  if (
    includesAny(raw, [
      "proprietary acoustic",
      "unknown acoustic",
      "acoustic ceiling system",
    ])
  ) {
    return "proprietary_acoustic";
  }
  if (
    includesAny(raw, [
      "proprietary fire",
      "unknown fire system",
      "unknown proprietary fire",
    ])
  ) {
    return "unknown_proprietary_fire";
  }
  return null;
}

export function ceilingPortionSpecialistKind(
  portion: CeilingPortion
): CeilingSpecialistKind | null {
  if (portion.specialist_kind) return portion.specialist_kind;
  if (portion.fire_acoustic_requirement === "unknown_proprietary") {
    const system = portion.fire_acoustic_system?.toLowerCase() ?? "";
    if (system.includes("acoustic")) return "proprietary_acoustic";
    return "unknown_proprietary_fire";
  }
  return null;
}

export function ceilingPortionHasUnsupportedBulkhead(
  portion: CeilingPortion
): boolean {
  return portion.bulkheads.some((row) => isUnsupportedCeilingBulkhead(row));
}

export const CEILINGS_SPECIALIST_FIRE_ACOUSTIC_NOTICE =
  "Specialist fire/acoustic system — specification/pricing required";

export function ceilingPortionHasUnknownProprietaryFireAcoustic(
  portion: CeilingPortion
): boolean {
  return (
    portion.fire_acoustic_requirement === "unknown_proprietary" ||
    portion.specialist_kind === "unknown_proprietary_fire" ||
    portion.specialist_kind === "proprietary_acoustic" ||
    ceilingPortionSpecialistKind(portion) === "unknown_proprietary_fire" ||
    ceilingPortionSpecialistKind(portion) === "proprietary_acoustic"
  );
}

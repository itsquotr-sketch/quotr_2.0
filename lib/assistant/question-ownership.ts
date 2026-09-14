/**
 * EF02-D1 — which unresolved facts belong to Details vs Refine.
 *
 * Deck uses the EF02-C1 canonical descriptors / information contract.
 * Fence / Retaining Wall use their information contracts for HARD_MINIMUM /
 * ASK_NOW. Bathroom plumbing/electrical intensity is Details-owned even
 * though template P1 would otherwise fall through to Refine. Internal Walls
 * lining, job_scope, structural gate, and accessory applicability
 * are Details-owned when unresolved.
 */

import { deckFactQuestionClass } from "@/lib/estimate/deck-information-contract";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import { ceilingsFactQuestionClass } from "@/lib/estimate/ceilings-information-contract";
import { getLevel1BlockingClass } from "@/lib/scopes/level1-blocking";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

const BATHROOM_DETAILS_OWNED_FACT_KEYS = new Set([
  "bathroom.plumbing.level",
  "bathroom.electrical.level",
]);

const INTERNAL_WALLS_DETAILS_OWNED_FACT_KEYS = new Set([
  "internal_walls.job_scope",
  "internal_walls.structural_involvement",
  "internal_walls.wall_types_grouping_confirmed",
  "internal_walls.wall_type.side_a_product",
  "internal_walls.wall_type.same_lining_both_sides",
  "internal_walls.wall_type.side_b_product",
  "internal_walls.wall_type.has_openings",
  "internal_walls.opening.type",
  "internal_walls.opening.width_m",
  "internal_walls.opening.height_m",
  "internal_walls.wall_type.insulation_included",
  "internal_walls.wall_type.insulation",
  "internal_walls.wall_type.skirting",
  "internal_walls.wall_type.cornice",
  "internal_walls.wall_type.stopping_side_a",
  "internal_walls.wall_type.stopping_side_b",
  "internal_walls.wall_type.painting",
]);

type DetailsAskClass = "HARD_MINIMUM" | "ASK_NOW" | "ASSUME_IF_SKIPPED";

function bathroomDetailsAskClass(factKey: string): DetailsAskClass | null {
  if (BATHROOM_DETAILS_OWNED_FACT_KEYS.has(factKey)) return "ASK_NOW";
  return null;
}

function internalWallsDetailsAskClass(factKey: string): DetailsAskClass | null {
  if (INTERNAL_WALLS_DETAILS_OWNED_FACT_KEYS.has(factKey)) return "HARD_MINIMUM";
  return null;
}

function isDetailsAskClass(
  questionClass: string | null
): questionClass is DetailsAskClass {
  return (
    questionClass === "HARD_MINIMUM" ||
    questionClass === "ASK_NOW" ||
    questionClass === "ASSUME_IF_SKIPPED"
  );
}

export function isDetailsOwnedWhenUnresolved(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): boolean {
  return detailsAskClassForFact(workAreaType, factKey) != null;
}

export function detailsAskClassForFact(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): DetailsAskClass | null {
  if (!factKey) return null;
  const deckClass = deckFactQuestionClass(factKey);
  if (deckClass && (workAreaType === "deck" || factKey.startsWith("deck."))) {
    return isDetailsAskClass(deckClass) ? deckClass : null;
  }
  const fenceClass = fenceFactQuestionClass(factKey);
  if (fenceClass && (workAreaType === "fence" || factKey.startsWith("fence."))) {
    if (fenceClass === "HARD_MINIMUM" || fenceClass === "ASK_NOW") {
      return fenceClass;
    }
    return null;
  }
  const rwClass = retainingWallFactQuestionClass(factKey);
  if (
    rwClass &&
    (workAreaType === "retaining_wall" || factKey.startsWith("retaining_wall."))
  ) {
    if (rwClass === "HARD_MINIMUM" || rwClass === "ASK_NOW") {
      return rwClass;
    }
    return null;
  }
  const bathroomClass = bathroomDetailsAskClass(factKey);
  if (
    bathroomClass &&
    (workAreaType === "bathroom" || factKey.startsWith("bathroom."))
  ) {
    return bathroomClass;
  }
  const iwClass = internalWallsDetailsAskClass(factKey);
  if (
    iwClass &&
    (workAreaType === "internal_walls" || factKey.startsWith("internal_walls."))
  ) {
    return iwClass;
  }
  const ceilingsClass = ceilingsFactQuestionClass(factKey);
  if (
    ceilingsClass &&
    (workAreaType === "ceilings" ||
      factKey.startsWith("ceilings.portion.") ||
      factKey.startsWith("ceilings.bulkhead."))
  ) {
    return isDetailsAskClass(ceilingsClass) ? ceilingsClass : null;
  }
  const template = getQuestionTemplateByKey(factKey);
  if (!template) return null;
  if (getLevel1BlockingClass(template) === "HARD_MINIMUM") return "HARD_MINIMUM";
  return null;
}

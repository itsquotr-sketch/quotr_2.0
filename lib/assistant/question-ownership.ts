/**
 * EF02-D1 — which unresolved facts belong to Details vs Refine.
 *
 * Deck uses the EF02-C1 canonical descriptors / information contract.
 * Fence / Retaining Wall use their information contracts for HARD_MINIMUM /
 * ASK_NOW. Bathroom plumbing/electrical intensity is Details-owned even
 * though template P1 would otherwise fall through to Refine.
 */

import { deckFactQuestionClass } from "@/lib/estimate/deck-information-contract";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import { getLevel1BlockingClass } from "@/lib/scopes/level1-blocking";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

const BATHROOM_DETAILS_OWNED_FACT_KEYS = new Set([
  "bathroom.plumbing.level",
  "bathroom.electrical.level",
]);

type DetailsAskClass = "HARD_MINIMUM" | "ASK_NOW" | "ASSUME_IF_SKIPPED";

function bathroomDetailsAskClass(factKey: string): DetailsAskClass | null {
  if (BATHROOM_DETAILS_OWNED_FACT_KEYS.has(factKey)) return "ASK_NOW";
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
  const template = getQuestionTemplateByKey(factKey);
  if (!template) return null;
  if (getLevel1BlockingClass(template) === "HARD_MINIMUM") return "HARD_MINIMUM";
  return null;
}

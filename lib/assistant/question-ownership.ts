/**
 * EF02-D1 — which unresolved facts belong to Details vs Refine.
 *
 * Deck uses the EF02-C1 canonical descriptors / information contract.
 * Fence / Retaining Wall use their information contracts for HARD_MINIMUM /
 * ASK_NOW. Bathroom / Internal Walls fall back to Level 1 HARD_MINIMUM.
 */

import {
  deckFactQuestionClass,
  isDeckClarifyAskClass,
} from "@/lib/estimate/deck-information-contract";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import { getLevel1BlockingClass } from "@/lib/scopes/level1-blocking";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

export function isDetailsOwnedWhenUnresolved(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): boolean {
  if (!factKey) return false;
  const deckClass = deckFactQuestionClass(factKey);
  if (deckClass && (workAreaType === "deck" || factKey.startsWith("deck."))) {
    return isDeckClarifyAskClass(deckClass);
  }
  const fenceClass = fenceFactQuestionClass(factKey);
  if (fenceClass && (workAreaType === "fence" || factKey.startsWith("fence."))) {
    return fenceClass === "HARD_MINIMUM" || fenceClass === "ASK_NOW";
  }
  const rwClass = retainingWallFactQuestionClass(factKey);
  if (
    rwClass &&
    (workAreaType === "retaining_wall" || factKey.startsWith("retaining_wall."))
  ) {
    return rwClass === "HARD_MINIMUM" || rwClass === "ASK_NOW";
  }
  const template = getQuestionTemplateByKey(factKey);
  if (!template) return false;
  return getLevel1BlockingClass(template) === "HARD_MINIMUM";
}

export function detailsAskClassForFact(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): "HARD_MINIMUM" | "ASK_NOW" | "ASSUME_IF_SKIPPED" | null {
  if (!factKey) return null;
  const deckClass = deckFactQuestionClass(factKey);
  if (deckClass && (workAreaType === "deck" || factKey.startsWith("deck."))) {
    if (
      deckClass === "HARD_MINIMUM" ||
      deckClass === "ASK_NOW" ||
      deckClass === "ASSUME_IF_SKIPPED"
    ) {
      return deckClass;
    }
    return null;
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
  const template = getQuestionTemplateByKey(factKey);
  if (!template) return null;
  if (getLevel1BlockingClass(template) === "HARD_MINIMUM") return "HARD_MINIMUM";
  return null;
}

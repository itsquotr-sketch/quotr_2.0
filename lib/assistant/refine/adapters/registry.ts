import { bathroomRefineAdapter } from "@/lib/assistant/refine/adapters/bathroom";
import { deckRefineAdapter } from "@/lib/assistant/refine/adapters/deck";
import { paintingRefineAdapter } from "@/lib/assistant/refine/adapters/painting";
import type { RefineWorkAreaAdapter } from "@/lib/assistant/refine/types";

/** Registered Work Area Refine adapters. Maturity requires consumed-fact contract. */
const BY_TYPE = new Map<string, RefineWorkAreaAdapter>([
  [deckRefineAdapter.workAreaType, deckRefineAdapter],
  [bathroomRefineAdapter.workAreaType, bathroomRefineAdapter],
  [paintingRefineAdapter.workAreaType, paintingRefineAdapter],
]);

export function getRefineAdapter(workAreaType: string): RefineWorkAreaAdapter | null {
  return BY_TYPE.get(workAreaType) ?? null;
}

export function listRefineAdapters(): readonly RefineWorkAreaAdapter[] {
  return [...BY_TYPE.values()];
}

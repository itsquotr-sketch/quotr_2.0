import { bathroomRefineAdapter } from "@/lib/assistant/refine/adapters/bathroom";
import { deckRefineAdapter } from "@/lib/assistant/refine/adapters/deck";
import { paintingRefineAdapter } from "@/lib/assistant/refine/adapters/painting";
import type { RefineWorkAreaAdapter } from "@/lib/assistant/refine/types";

const BY_TYPE = new Map<string, RefineWorkAreaAdapter>([
  [deckRefineAdapter.workAreaType, deckRefineAdapter],
  [bathroomRefineAdapter.workAreaType, bathroomRefineAdapter],
  [paintingRefineAdapter.workAreaType, paintingRefineAdapter],
]);

export function getRefineAdapter(workAreaType: string): RefineWorkAreaAdapter | null {
  return BY_TYPE.get(workAreaType) ?? null;
}

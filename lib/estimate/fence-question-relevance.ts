/**
 * EST-CORRECT-02B — shared Fence Details / Refine relevance.
 * One predicate for both surfaces. Not a second question engine.
 */
import { getBooleanFact } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export type FenceQuestionRelevanceContext = {
  readonly facts: readonly {
    readonly key: string;
    readonly work_area_id: string | null;
    readonly value: unknown;
    readonly source?: string | null;
  }[];
  readonly workAreaId: string;
};

export function fenceFactIsRelevant(
  factKey: string,
  ctx: FenceQuestionRelevanceContext
): boolean {
  if (!factKey.startsWith("fence.")) return false;
  const facts = ctx.facts as EstimateFact[];
  switch (factKey) {
    case "fence.disposal_required":
      return (
        getBooleanFact(facts, ctx.workAreaId, "fence.demolition_required") ===
        true
      );
    case "fence.finish_type":
    case "fence.finish_sides":
      return (
        getBooleanFact(facts, ctx.workAreaId, "fence.finish_required") === true
      );
    default:
      return true;
  }
}

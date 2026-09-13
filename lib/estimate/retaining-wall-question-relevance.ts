/**
 * EST-CORRECT-02B — shared Retaining Wall Details / Refine relevance.
 * One predicate for both surfaces. Not a second question engine.
 */
import { getBooleanFact, getStringFact } from "@/lib/estimate/facts";
import { isMasonryBlockLayingSubcontract } from "@/lib/estimate/retaining-wall-masonry-2b";
import { classifyRetainingWallSystem } from "@/lib/estimate/retaining-wall-systems";
import type { EstimateFact } from "@/lib/estimate/types";

export type RetainingWallQuestionRelevanceContext = {
  readonly facts: readonly {
    readonly key: string;
    readonly work_area_id: string | null;
    readonly value: unknown;
    readonly source?: string | null;
  }[];
  readonly workAreaId: string;
};

export function retainingWallFactIsRelevant(
  factKey: string,
  ctx: RetainingWallQuestionRelevanceContext
): boolean {
  if (!factKey.startsWith("retaining_wall.")) return false;
  const facts = ctx.facts as EstimateFact[];
  const masonry =
    classifyRetainingWallSystem(
      getStringFact(facts, ctx.workAreaId, "retaining_wall.material")
    ) === "CONCRETE_MASONRY_WALL";

  switch (factKey) {
    case "retaining_wall.block_laying_method":
      return masonry;
    case "retaining_wall.masonry.subcontract_scope":
      return (
        masonry &&
        isMasonryBlockLayingSubcontract(
          getStringFact(facts, ctx.workAreaId, "retaining_wall.block_laying_method")
        )
      );
    case "retaining_wall.waterproofing_type":
      return (
        masonry &&
        getBooleanFact(
          facts,
          ctx.workAreaId,
          "retaining_wall.waterproofing_required"
        ) === true
      );
    default:
      return true;
  }
}

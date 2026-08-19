import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import type { RefineCandidate, RefineWorkAreaAdapter } from "@/lib/assistant/refine/types";

export const paintingRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "painting",
  candidates({ workAreaId, workAreaName, facts }) {
    const out: RefineCandidate[] = [];
    const coatsKnown = facts.some(
      (f) =>
        f.key === "painting.coats_required" &&
        f.work_area_id === workAreaId &&
        hasFactValue(f.value) &&
        !isNotSureValue(f.value)
    );
    if (!coatsKnown) {
      out.push({
        id: `refine:${workAreaId}:painting.coats_required`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "painting",
        factKey: "painting.coats_required",
        constraintKey: null,
        questionKey: "painting.coats_required",
        label: "Coats",
        question: "How many coats?",
        inputType: "number",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }
    return out;
  },
};

import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import type { RefineCandidate, RefineWorkAreaAdapter } from "@/lib/assistant/refine/types";

export const bathroomRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "bathroom",
  candidates({ workAreaId, workAreaName, facts, notConfirmed }) {
    const out: RefineCandidate[] = [];
    const demolition = notConfirmed.find(
      (item) => item.sourceFactKey === "bathroom.demolition_required"
    );
    if (demolition?.write) {
      out.push({
        id: `refine:${workAreaId}:bathroom.demolition_required`,
        group: "scope",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.demolition_required",
        constraintKey: null,
        questionKey: "bathroom.demolition_required",
        label: demolition.label,
        question: "Include demolition / strip-out?",
        inputType: "boolean",
        writeTarget: "FACT",
        write: demolition.write,
        consumedByCalculator: true,
      });
    }

    const plumbingKnown = facts.some(
      (f) =>
        f.key === "bathroom.plumbing_changes" &&
        f.work_area_id === workAreaId &&
        hasFactValue(f.value) &&
        !isNotSureValue(f.value)
    );
    if (!plumbingKnown) {
      out.push({
        id: `refine:${workAreaId}:bathroom.plumbing_changes`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.plumbing_changes",
        constraintKey: null,
        questionKey: "bathroom.plumbing_changes",
        label: "Plumbing changes",
        question: "What level of plumbing changes are included?",
        inputType: "select",
        options: ["None", "Minor", "Major", "Not sure"],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    return out;
  },
};

import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import {
  BATHROOM_FLOOR_SUBSTRATE_OPTIONS,
  BATHROOM_FRAMING_LEVEL_OPTIONS,
  BATHROOM_JOB_SCOPE_OPTIONS,
  BATHROOM_TRADE_LEVEL_OPTIONS,
  bathroomGeometryNeed,
  bathroomQuestionGroupVisible,
  resolveBathroomJobScope,
} from "@/lib/estimate/bathroom-scope";
import type { RefineCandidate, RefineWorkAreaAdapter } from "@/lib/assistant/refine/types";

function knownFact(
  facts: readonly {
    key: string;
    work_area_id: string | null;
    value: unknown;
  }[],
  workAreaId: string,
  key: string
): boolean {
  return facts.some(
    (f) =>
      f.key === key &&
      f.work_area_id === workAreaId &&
      hasFactValue(f.value) &&
      !isNotSureValue(f.value)
  );
}

export const bathroomRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "bathroom",
  candidates({ workAreaId, workAreaName, facts, notConfirmed }) {
    const out: RefineCandidate[] = [];
    const jobScope = resolveBathroomJobScope({
      jobScope: facts.find(
        (f) => f.key === "bathroom.job_scope" && f.work_area_id === workAreaId
      )?.value,
      renovationType: facts.find(
        (f) =>
          f.key === "bathroom.renovation_type" && f.work_area_id === workAreaId
      )?.value,
    });

    if (!jobScope) {
      out.push({
        id: `refine:${workAreaId}:bathroom.job_scope`,
        group: "scope",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.job_scope",
        constraintKey: null,
        questionKey: "bathroom.job_scope",
        label: "Bathroom work",
        question: "What bathroom work are you doing?",
        inputType: "select",
        options: [...BATHROOM_JOB_SCOPE_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    const geometryNeed = bathroomGeometryNeed(jobScope, {
      tilingIncluded: facts.find(
        (f) =>
          f.key === "bathroom.tiling_included" && f.work_area_id === workAreaId
      )?.value === true,
      wallLiningIncluded: facts.find(
        (f) =>
          f.key === "bathroom.wall_lining_included" &&
          f.work_area_id === workAreaId
      )?.value === true,
      ceilingLiningIncluded: facts.find(
        (f) =>
          f.key === "bathroom.ceiling_lining_included" &&
          f.work_area_id === workAreaId
      )?.value === true,
      floorPrepIncluded: facts.find(
        (f) =>
          f.key === "bathroom.floor_prep_included" &&
          f.work_area_id === workAreaId
      )?.value === true,
      floorSubstrate: String(
        facts.find(
          (f) =>
            f.key === "bathroom.floor_substrate_system" &&
            f.work_area_id === workAreaId
        )?.value ?? ""
      ) || null,
      waterproofingIncluded: facts.find(
        (f) =>
          f.key === "bathroom.waterproofing_included" &&
          f.work_area_id === workAreaId
      )?.value === true,
    });
    if (geometryNeed !== "none") {
      const hasLength = knownFact(facts, workAreaId, "bathroom.length_m");
      const hasWidth = knownFact(facts, workAreaId, "bathroom.width_m");
      const hasArea =
        knownFact(facts, workAreaId, "bathroom.floor_area_m2") ||
        knownFact(facts, workAreaId, "bathroom.area_m2");
      if (!hasLength && !hasArea) {
        out.push({
          id: `refine:${workAreaId}:bathroom.length_m`,
          group: "specification",
          tier: "high_value",
          workAreaId,
          workAreaName,
          workAreaType: "bathroom",
          factKey: "bathroom.length_m",
          constraintKey: null,
          questionKey: "bathroom.length_m",
          label: "Bathroom length",
          question: "What is the bathroom length?",
          inputType: "number",
          unit: "m",
          writeTarget: "FACT",
          write: null,
          consumedByCalculator: true,
        });
      }
      if (!hasWidth && !hasArea) {
        out.push({
          id: `refine:${workAreaId}:bathroom.width_m`,
          group: "specification",
          tier: "high_value",
          workAreaId,
          workAreaName,
          workAreaType: "bathroom",
          factKey: "bathroom.width_m",
          constraintKey: null,
          questionKey: "bathroom.width_m",
          label: "Bathroom width",
          question: "What is the bathroom width?",
          inputType: "number",
          unit: "m",
          writeTarget: "FACT",
          write: null,
          consumedByCalculator: true,
        });
      }
    }

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

    const plumbingKnown =
      knownFact(facts, workAreaId, "bathroom.plumbing.level") ||
      knownFact(facts, workAreaId, "bathroom.plumbing_changes");
    if (
      jobScope &&
      bathroomQuestionGroupVisible("plumbing", jobScope) &&
      !plumbingKnown
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.plumbing.level`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.plumbing.level",
        constraintKey: null,
        questionKey: "bathroom.plumbing.level",
        label: "Plumbing intensity",
        question: "What level of plumbing work is included?",
        inputType: "select",
        options: [...BATHROOM_TRADE_LEVEL_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("floor_substrate", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.floor_substrate_system")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.floor_substrate_system`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.floor_substrate_system",
        constraintKey: null,
        questionKey: "bathroom.floor_substrate_system",
        label: "Floor substrate",
        question: "Does the bathroom need a new floor substrate?",
        inputType: "select",
        options: [...BATHROOM_FLOOR_SUBSTRATE_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("linings", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.wall_lining_included")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.wall_lining_included`,
        group: "scope",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.wall_lining_included",
        constraintKey: null,
        questionKey: "bathroom.wall_lining_included",
        label: "Wall lining",
        question: "Are the bathroom walls being relined?",
        inputType: "boolean",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("ceiling_lining", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.ceiling_lining_included")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.ceiling_lining_included`,
        group: "scope",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.ceiling_lining_included",
        constraintKey: null,
        questionKey: "bathroom.ceiling_lining_included",
        label: "Ceiling lining",
        question: "Is the bathroom ceiling being relined?",
        inputType: "boolean",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("framing", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.framing_level")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.framing_level`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.framing_level",
        constraintKey: null,
        questionKey: "bathroom.framing_level",
        label: "Framing / nogging",
        question: "How much local framing or nogging is required?",
        inputType: "select",
        options: [...BATHROOM_FRAMING_LEVEL_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    return out;
  },
};

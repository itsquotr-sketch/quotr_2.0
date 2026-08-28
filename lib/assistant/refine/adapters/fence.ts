import { getBooleanFact, getStringFact, hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import {
  classifyFenceSystem,
  fenceGateScopeApplies,
  isModularFenceSystem,
  isTimberFenceSystem,
} from "@/lib/estimate/fence-systems";
import type {
  ComposeRefineInput,
  RefineCandidate,
  RefineWorkAreaAdapter,
} from "@/lib/assistant/refine/types";

function known(
  facts: ComposeRefineInput["facts"],
  workAreaId: string,
  key: string
): boolean {
  const row = facts.find((f) => f.key === key && f.work_area_id === workAreaId);
  if (!row || !hasFactValue(row.value) || isNotSureValue(row.value)) return false;
  return true;
}

function candidate(params: {
  workAreaId: string;
  workAreaName: string;
  factKey: string;
  label: string;
  question: string;
  inputType: RefineCandidate["inputType"];
  options?: readonly string[];
  group?: RefineCandidate["group"];
}): RefineCandidate {
  return {
    id: `refine:${params.workAreaId}:${params.factKey}`,
    group: params.group ?? "specification",
    tier: "advanced",
    workAreaId: params.workAreaId,
    workAreaName: params.workAreaName,
    workAreaType: "fence",
    factKey: params.factKey,
    constraintKey: null,
    questionKey: params.factKey,
    label: params.label,
    question: params.question,
    inputType: params.inputType,
    options: params.options,
    writeTarget: "FACT",
    write: null,
    consumedByCalculator: true,
  };
}

export const fenceRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "fence",
  candidates({ workAreaId, workAreaName, facts }) {
    const out: RefineCandidate[] = [];
    const typedFacts = [...facts];
    const system = classifyFenceSystem(
      getStringFact(typedFacts, workAreaId, "fence.system") ??
        getStringFact(typedFacts, workAreaId, "fence.material"),
      getStringFact(typedFacts, workAreaId, "fence.paling_or_panel_type")
    );

    if (!known(facts, workAreaId, "fence.post_embedment_m")) {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "fence.post_embedment_m",
          label: "Post embedment",
          question: "Post embedment depth (m)?",
          inputType: "number",
        })
      );
    }
    if (!known(facts, workAreaId, "fence.hole_diameter_m")) {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "fence.hole_diameter_m",
          label: "Post-hole diameter",
          question: "Post-hole diameter (m)?",
          inputType: "number",
        })
      );
    }

    if (isTimberFenceSystem(system)) {
      if (!known(facts, workAreaId, "fence.post_spacing_m")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.post_spacing_m",
            label: "Post spacing",
            question: "Maximum post centres (m)?",
            inputType: "number",
          })
        );
      }
      if (system === "TIMBER_VERTICAL_PALING" && !known(facts, workAreaId, "fence.rail_count")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.rail_count",
            label: "Rail count",
            question: "Override horizontal rail count?",
            inputType: "number",
          })
        );
      }
      if (system === "TIMBER_VERTICAL_PALING" && !known(facts, workAreaId, "fence.rail_section")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.rail_section",
            label: "Fence rail section",
            question: "Fence rail section?",
            inputType: "select",
            options: ["75 × 50mm H4", "100 × 50mm H4", "75 × 40mm H4"],
          })
        );
      }
      if (system === "TIMBER_HORIZONTAL_SLAT" && !known(facts, workAreaId, "fence.horizontal_course_count")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.horizontal_course_count",
            label: "Horizontal slat course count",
            question: "Override horizontal slat course count?",
            inputType: "number",
          })
        );
      }
      if (system === "TIMBER_VERTICAL_PALING" && !known(facts, workAreaId, "fence.vertical_paling_gap_mm")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.vertical_paling_gap_mm",
            label: "Gap between vertical palings",
            question: "Gap between vertical palings (mm)?",
            inputType: "number",
          })
        );
      }
      if (system === "TIMBER_HORIZONTAL_SLAT" && !known(facts, workAreaId, "fence.slat_gap_mm")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.slat_gap_mm",
            label: "Slat gap",
            question: "Gap between horizontal boards (mm)?",
            inputType: "number",
          })
        );
      }
    }

    if (isModularFenceSystem(system)) {
      if (!known(facts, workAreaId, "fence.section_width_m")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.section_width_m",
            label: "Section width",
            question: "Modular section width (m)?",
            inputType: "number",
          })
        );
      }
      if (!known(facts, workAreaId, "fence.section_count")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.section_count",
            label: "Section count",
            question: "Known purchased section count?",
            inputType: "number",
          })
        );
      }
      if (
        system === "METAL_SLAT_MODULAR" &&
        !known(facts, workAreaId, "fence.metal_material")
      ) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.metal_material",
            label: "Metal type",
            question: "Aluminium or steel?",
            inputType: "select",
            options: ["Aluminium", "Steel"],
          })
        );
      }
    }

    if (fenceGateScopeApplies(system) && getBooleanFact(typedFacts, workAreaId, "fence.gate_included") === true) {
      if (!known(facts, workAreaId, "fence.gate_width_m")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.gate_width_m",
            label: "Gate width",
            question: "Gate width (m)?",
            inputType: "number",
          })
        );
      }
      if (!known(facts, workAreaId, "fence.gate_position")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "fence.gate_position",
            label: "Gate position",
            question: "Where is the gate along the fence?",
            inputType: "select",
            options: ["At an end", "Within the fence run", "Not sure"],
          })
        );
      }
    }

    return out;
  },
};

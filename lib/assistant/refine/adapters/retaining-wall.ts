import { getBooleanFact, getNumberFact, getStringFact, hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import { classifyRetainingWallSystem } from "@/lib/estimate/retaining-wall-systems";
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
    workAreaType: "retaining_wall",
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

export const retainingWallRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "retaining_wall",
  candidates({ workAreaId, workAreaName, facts }) {
    const out: RefineCandidate[] = [];
    const typedFacts = [...facts];
    const system = classifyRetainingWallSystem(
      getStringFact(typedFacts, workAreaId, "retaining_wall.material")
    );

    if (system === "TIMBER_RETAINING_WALL") {
      if (!known(facts, workAreaId, "retaining_wall.face_board_section")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.face_board_section",
            label: "Face boards",
            question: "Which H4 face-board section?",
            inputType: "select",
            options: ["150×50 H4", "200×50 H4"],
          })
        );
      }
      if (!known(facts, workAreaId, "retaining_wall.post_spacing_m")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.post_spacing_m",
            label: "Pile centres",
            question:
              "Pile centres for estimating layout? Default 1.2 m is a target/max estimating spacing; generated bays are even and may be slightly tighter. Not a structural standard.",
            inputType: "number",
            group: "structure",
          })
        );
      }
      if (
        getNumberFact(typedFacts, workAreaId, "retaining_wall.pile_embedment_m") == null
      ) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.pile_embedment_m",
            label: "Pile embedment",
            question: "Design pile embedment depth, if known?",
            inputType: "number",
            group: "structure",
          })
        );
      }
    }

    if (system === "CONCRETE_SLEEPER_WALL") {
      if (!known(facts, workAreaId, "retaining_wall.sleeper_length_m")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.sleeper_length_m",
            label: "Sleeper length",
            question: "Selected sleeper length?",
            inputType: "number",
          })
        );
      }
      if (!known(facts, workAreaId, "retaining_wall.sleeper_face_height_m")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.sleeper_face_height_m",
            label: "Sleeper face height",
            question: "Selected sleeper face height?",
            inputType: "number",
          })
        );
      }
    }

    if (system === "CONCRETE_MASONRY_WALL") {
      if (!known(facts, workAreaId, "retaining_wall.block_series")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.block_series",
            label: "Block series",
            question: "Which masonry series?",
            inputType: "select",
            options: ["150-series", "200-series"],
          })
        );
      }
      if (!known(facts, workAreaId, "retaining_wall.block_laying_method")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.block_laying_method",
            label: "Block laying",
            question: "Self-perform or subcontract block laying?",
            inputType: "select",
            options: ["Self-perform", "Subcontract"],
          })
        );
      }
      if (!known(facts, workAreaId, "retaining_wall.waterproofing_type")) {
        const required = getBooleanFact(
          typedFacts,
          workAreaId,
          "retaining_wall.waterproofing_required"
        );
        if (required === true) {
          out.push(
            candidate({
              workAreaId,
              workAreaName,
              factKey: "retaining_wall.waterproofing_type",
              label: "Waterproofing type",
              question: "Liquid or sheet membrane?",
              inputType: "select",
              options: ["Liquid membrane", "Sheet membrane"],
            })
          );
        }
      }
      if (
        getNumberFact(
          typedFacts,
          workAreaId,
          "retaining_wall.horizontal_rebar_runs"
        ) == null
      ) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.horizontal_rebar_runs",
            label: "Horizontal rebar runs",
            question: "How many horizontal reinforcement runs if specified?",
            inputType: "number",
            group: "structure",
          })
        );
      }
    }

    return out;
  },
};

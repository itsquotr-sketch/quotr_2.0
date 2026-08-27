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

function isBlockLayingSubcontract(raw: string | null | undefined): boolean {
  const t = (raw ?? "").toLowerCase();
  return t.includes("subcontract") || t.includes("subbie") || t === "subcontract";
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
            question: "Sleeper length if known? Default 2.0 m (2000 mm class).",
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
            question: "Sleeper face height if known? Default 0.20 m (200 mm class).",
            inputType: "number",
          })
        );
      }
      if (!known(facts, workAreaId, "retaining_wall.sleeper_post_spacing_m")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.sleeper_post_spacing_m",
            label: "Sleeper post spacing",
            question:
              "Sleeper post centres if known? Default is the purchased sleeper length. Not Timber pile spacing. Not a structural standard.",
            inputType: "number",
            group: "structure",
          })
        );
      }
      if (
        getNumberFact(
          typedFacts,
          workAreaId,
          "retaining_wall.sleeper_post_embedment_m"
        ) == null
      ) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.sleeper_post_embedment_m",
            label: "Post embedment",
            question: "Design post embedment depth, if known?",
            inputType: "number",
            group: "structure",
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
            label: "Blockwork delivery",
            question: "How will the blockwork be completed?",
            inputType: "select",
            options: ["Self-perform", "Subcontract"],
          })
        );
      }
      const blockMethod = getStringFact(
        typedFacts,
        workAreaId,
        "retaining_wall.block_laying_method"
      );
      if (
        isBlockLayingSubcontract(blockMethod) &&
        !known(facts, workAreaId, "retaining_wall.masonry.subcontract_scope")
      ) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.masonry.subcontract_scope",
            label: "Subcontractor provides",
            question: "What will the masonry subcontractor provide?",
            inputType: "select",
            options: ["Labour only", "Labour + blocks & laying materials"],
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

    if (
      getBooleanFact(typedFacts, workAreaId, "retaining_wall.excavation_required") ===
        true &&
      getNumberFact(typedFacts, workAreaId, "retaining_wall.excavation_volume_m3") ==
        null
    ) {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "retaining_wall.excavation_volume_m3",
          label: "Bulk excavation volume",
          question:
            "Known bulk excavation volume (m³)? Do not use backfill volume as a substitute.",
          inputType: "number",
          group: "structure",
        })
      );
    }

    if (
      getBooleanFact(typedFacts, workAreaId, "retaining_wall.excavation_required") ===
      true
    ) {
      if (!known(facts, workAreaId, "retaining_wall.disposal_included")) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "retaining_wall.disposal_included",
            label: "Spoil removal",
            question: "Will excavated spoil need to be removed from site?",
            inputType: "select",
            options: [
              "No — spoil will remain or be reused on site",
              "Yes — some or all will be removed",
              "Not sure",
            ],
          })
        );
      } else if (
        getBooleanFact(typedFacts, workAreaId, "retaining_wall.disposal_included") ===
        true
      ) {
        const excavationM3 = getNumberFact(
          typedFacts,
          workAreaId,
          "retaining_wall.excavation_volume_m3"
        );
        if (excavationM3 != null && !known(facts, workAreaId, "retaining_wall.spoil_removal_portion")) {
          out.push(
            candidate({
              workAreaId,
              workAreaName,
              factKey: "retaining_wall.spoil_removal_portion",
              label: "Spoil leaving site",
              question: "How much of the excavated material needs to leave site?",
              inputType: "select",
              options: [
                `All — ${excavationM3.toFixed(1)}m³`,
                "Some — enter quantity",
                "None",
              ],
            })
          );
        }
        const portion = getStringFact(
          typedFacts,
          workAreaId,
          "retaining_wall.spoil_removal_portion"
        );
        const some = Boolean(portion && /^some\b/i.test(portion));
        if (
          (some || excavationM3 == null) &&
          getNumberFact(
            typedFacts,
            workAreaId,
            "retaining_wall.spoil_removal_volume_m3"
          ) == null
        ) {
          out.push(
            candidate({
              workAreaId,
              workAreaName,
              factKey: "retaining_wall.spoil_removal_volume_m3",
              label: "Spoil removal volume",
              question: "Estimated spoil removal volume (m³)?",
              inputType: "number",
              group: "structure",
            })
          );
        }
      }
    }

    return out;
  },
};

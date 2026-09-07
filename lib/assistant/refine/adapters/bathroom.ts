import { hasFactValue, isNotSureValue, getBooleanFact } from "@/lib/estimate/facts";
import {
  BATHROOM_DEMOLITION_COMPONENT_OPTIONS,
  BATHROOM_FIXTURE_OWNERSHIP_OPTIONS,
  BATHROOM_FLOOR_FINISH_OPTIONS,
  BATHROOM_FLOOR_SUBSTRATE_OPTIONS,
  BATHROOM_FRAMING_LEVEL_OPTIONS,
  BATHROOM_JOB_SCOPE_OPTIONS,
  BATHROOM_TILE_FORMAT_OPTIONS,
  BATHROOM_TRADE_LEVEL_OPTIONS,
  BATHROOM_WALL_TILE_EXTENT_OPTIONS,
  BATHROOM_WATERPROOFING_EXTENT_OPTIONS,
  bathroomDemolitionImpliedByScope,
  bathroomFixtureOwnershipFactKey,
  bathroomGeometryNeed,
  bathroomQuestionGroupVisible,
  parseBathroomSelectedFixtures,
  parseBathroomWallTileExtent,
  parseBathroomWaterproofingExtent,
  resolveBathroomJobScope,
} from "@/lib/estimate/bathroom-scope";
import { BATHROOM_FIXTURE_LABELS } from "@/lib/estimate/bathroom-fixtures";
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

function stringFact(
  facts: readonly {
    key: string;
    work_area_id: string | null;
    value: unknown;
  }[],
  workAreaId: string,
  key: string
): string | null {
  const row = facts.find(
    (f) => f.key === key && f.work_area_id === workAreaId
  );
  if (row == null || !hasFactValue(row.value) || isNotSureValue(row.value)) {
    return null;
  }
  return String(row.value);
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
      floorFinish: String(
        facts.find(
          (f) =>
            f.key === "bathroom.floor_finish_system" &&
            f.work_area_id === workAreaId
        )?.value ?? ""
      ) || null,
      wallTileExtent: String(
        facts.find(
          (f) =>
            f.key === "bathroom.tile_extent" && f.work_area_id === workAreaId
        )?.value ?? ""
      ) || null,
      waterproofingExtent: String(
        facts.find(
          (f) =>
            f.key === "bathroom.waterproofing_extent" &&
            f.work_area_id === workAreaId
        )?.value ?? ""
      ) || null,
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

    if (
      jobScope &&
      bathroomQuestionGroupVisible("demolition", jobScope, {
        demolitionRequired:
          getBooleanFact(facts as never, workAreaId, "bathroom.demolition_required") ===
            true || bathroomDemolitionImpliedByScope(jobScope),
      }) &&
      !knownFact(facts, workAreaId, "bathroom.demolition.components")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.demolition.components`,
        group: "scope",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.demolition.components",
        constraintKey: null,
        questionKey: "bathroom.demolition.components",
        label: "What is being stripped out",
        question: "What existing bathroom items are being removed?",
        inputType: "select",
        options: [...BATHROOM_DEMOLITION_COMPONENT_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("finishing", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.stopping_included")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.stopping_included`,
        group: "specification",
        tier: "advanced",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.stopping_included",
        constraintKey: null,
        questionKey: "bathroom.stopping_included",
        label: "Stopping / plastering",
        question: "Is stopping or plastering of new linings included?",
        inputType: "boolean",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("finishing", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.painting_included")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.painting_included`,
        group: "specification",
        tier: "advanced",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.painting_included",
        constraintKey: null,
        questionKey: "bathroom.painting_included",
        label: "Painting",
        question: "Is painting of remaining bathroom surfaces included?",
        inputType: "boolean",
        writeTarget: "FACT",
        write: null,
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

    const electricalKnown =
      knownFact(facts, workAreaId, "bathroom.electrical.level") ||
      knownFact(facts, workAreaId, "bathroom.electrical_changes");
    if (
      jobScope &&
      bathroomQuestionGroupVisible("electrical", jobScope) &&
      !electricalKnown
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.electrical.level`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.electrical.level",
        constraintKey: null,
        questionKey: "bathroom.electrical.level",
        label: "Electrical intensity",
        question: "What level of electrical work is included?",
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

    const finishFlags = {
      tilingIncluded: facts.some(
        (f) =>
          f.key === "bathroom.tiling_included" &&
          f.work_area_id === workAreaId &&
          f.value === true
      ),
      waterproofingIncluded:
        facts.find(
          (f) =>
            f.key === "bathroom.waterproofing_included" &&
            f.work_area_id === workAreaId
        )?.value === true
          ? true
          : facts.find(
                (f) =>
                  f.key === "bathroom.waterproofing_included" &&
                  f.work_area_id === workAreaId
              )?.value === false
            ? false
            : null,
      floorFinish: stringFact(facts, workAreaId, "bathroom.floor_finish_system"),
      wallTileExtent:
        stringFact(facts, workAreaId, "bathroom.tile_extent") ??
        stringFact(facts, workAreaId, "bathroom.wall_tile_height"),
      waterproofingExtent: stringFact(
        facts,
        workAreaId,
        "bathroom.waterproofing_extent"
      ),
    };

    if (
      jobScope &&
      bathroomQuestionGroupVisible("floor_finish", jobScope, finishFlags) &&
      !knownFact(facts, workAreaId, "bathroom.floor_finish_system")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.floor_finish_system`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.floor_finish_system",
        constraintKey: null,
        questionKey: "bathroom.floor_finish_system",
        label: "Floor finish",
        question: "What floor finish is being installed?",
        inputType: "select",
        options: [...BATHROOM_FLOOR_FINISH_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("tile_format", jobScope, finishFlags) &&
      !knownFact(facts, workAreaId, "bathroom.tile_format")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.tile_format`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.tile_format",
        constraintKey: null,
        questionKey: "bathroom.tile_format",
        label: "Tile format",
        question: "What tile format is being used?",
        inputType: "select",
        options: [...BATHROOM_TILE_FORMAT_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("wall_tiling", jobScope, finishFlags) &&
      !knownFact(facts, workAreaId, "bathroom.tile_extent")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.tile_extent`,
        group: "scope",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.tile_extent",
        constraintKey: null,
        questionKey: "bathroom.tile_extent",
        label: "Wall tiling",
        question: "Are any bathroom walls being tiled, and to what extent?",
        inputType: "select",
        options: [...BATHROOM_WALL_TILE_EXTENT_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("shower_geometry", jobScope, finishFlags)
    ) {
      if (!knownFact(facts, workAreaId, "bathroom.shower.width_m")) {
        out.push({
          id: `refine:${workAreaId}:bathroom.shower.width_m`,
          group: "specification",
          tier: "high_value",
          workAreaId,
          workAreaName,
          workAreaType: "bathroom",
          factKey: "bathroom.shower.width_m",
          constraintKey: null,
          questionKey: "bathroom.shower.width_m",
          label: "Shower width",
          question: "What is the shower width?",
          inputType: "number",
          writeTarget: "FACT",
          write: null,
          consumedByCalculator: true,
        });
      }
      if (!knownFact(facts, workAreaId, "bathroom.shower.depth_m")) {
        out.push({
          id: `refine:${workAreaId}:bathroom.shower.depth_m`,
          group: "specification",
          tier: "high_value",
          workAreaId,
          workAreaName,
          workAreaType: "bathroom",
          factKey: "bathroom.shower.depth_m",
          constraintKey: null,
          questionKey: "bathroom.shower.depth_m",
          label: "Shower depth",
          question: "What is the shower depth?",
          inputType: "number",
          writeTarget: "FACT",
          write: null,
          consumedByCalculator: true,
        });
      }
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("waterproofing", jobScope, finishFlags) &&
      finishFlags.waterproofingIncluded === true &&
      !knownFact(facts, workAreaId, "bathroom.waterproofing_extent")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.waterproofing_extent`,
        group: "scope",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.waterproofing_extent",
        constraintKey: null,
        questionKey: "bathroom.waterproofing_extent",
        label: "Waterproofing extent",
        question: "What areas are being waterproofed?",
        inputType: "select",
        options: [...BATHROOM_WATERPROOFING_EXTENT_OPTIONS],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      parseBathroomWallTileExtent(finishFlags.wallTileExtent) === "custom" &&
      !knownFact(facts, workAreaId, "bathroom.wall_tiling_area_m2")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.wall_tiling_area_m2`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.wall_tiling_area_m2",
        constraintKey: null,
        questionKey: "bathroom.wall_tiling_area_m2",
        label: "Wall tiling area",
        question: "Approximate wall tiling area?",
        inputType: "number",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      parseBathroomWaterproofingExtent(finishFlags.waterproofingExtent) ===
        "custom" &&
      !knownFact(facts, workAreaId, "bathroom.waterproofing_area_m2")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.waterproofing_area_m2`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.waterproofing_area_m2",
        constraintKey: null,
        questionKey: "bathroom.waterproofing_area_m2",
        label: "Waterproofing area",
        question: "Approximate waterproofing area?",
        inputType: "number",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    const selectedFixtures = parseBathroomSelectedFixtures({
      facts,
      workAreaId,
    });
    if (jobScope && bathroomQuestionGroupVisible("fixtures", jobScope)) {
      for (const id of selectedFixtures) {
        const factKey = bathroomFixtureOwnershipFactKey(id);
        if (knownFact(facts, workAreaId, factKey)) continue;
        out.push({
          id: `refine:${workAreaId}:${factKey}`,
          group: "specification",
          tier: "high_value",
          workAreaId,
          workAreaName,
          workAreaType: "bathroom",
          factKey,
          constraintKey: null,
          questionKey: factKey,
          label: `${BATHROOM_FIXTURE_LABELS[id]} supply / install`,
          question: `Is the ${BATHROOM_FIXTURE_LABELS[id].toLowerCase()} supply, install, or both?`,
          inputType: "select",
          options: [...BATHROOM_FIXTURE_OWNERSHIP_OPTIONS],
          writeTarget: "FACT",
          write: null,
          consumedByCalculator: true,
        });
      }
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("plumbing", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.plumbing.scope_text")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.plumbing.scope_text`,
        group: "specification",
        tier: "advanced",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.plumbing.scope_text",
        constraintKey: null,
        questionKey: "bathroom.plumbing.scope_text",
        label: "Plumbing scope notes",
        question: "Any plumbing scope notes for the subcontractor?",
        inputType: "text",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("electrical", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.electrical.scope_text")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.electrical.scope_text`,
        group: "specification",
        tier: "advanced",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.electrical.scope_text",
        constraintKey: null,
        questionKey: "bathroom.electrical.scope_text",
        label: "Electrical scope notes",
        question: "Any electrical scope notes for the subcontractor?",
        inputType: "text",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (
      jobScope &&
      bathroomQuestionGroupVisible("electrical", jobScope) &&
      !knownFact(facts, workAreaId, "bathroom.electrical.light_count")
    ) {
      out.push({
        id: `refine:${workAreaId}:bathroom.electrical.light_count`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "bathroom",
        factKey: "bathroom.electrical.light_count",
        constraintKey: null,
        questionKey: "bathroom.electrical.light_count",
        label: "Light points",
        question: "How many new bathroom light or downlight points?",
        inputType: "number",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    return out;
  },
};

import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_JOB_SCOPE_OPTIONS,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_OPTIONS,
  parseInternalWallsJobScope,
  structuralGateApplies,
} from "@/lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_FRAME_SYSTEM_OPTIONS,
  INTERNAL_WALLS_LAYER_OPTIONS,
  INTERNAL_WALLS_LINING_PRODUCT_OPTIONS,
  INTERNAL_WALLS_SAME_BOTH_SIDES_OPTIONS,
  INTERNAL_WALLS_SHEET_LENGTH_OPTIONS,
  INTERNAL_WALLS_STUD_CENTRES_OPTIONS,
  INTERNAL_WALLS_THICKNESS_OPTIONS,
  INTERNAL_WALLS_TIMBER_SIZE_OPTIONS,
  recommendedSheetLengthMm,
  resolveInternalWallsWallTypes,
  summariseWallType,
  wallTypeFieldCurrentValue,
} from "@/lib/estimate/internal-walls-wall-types";
import type { EstimateFact } from "@/lib/estimate/types";
import type {
  InternalWallsRefinePanel,
  RefineCandidate,
  RefineWorkAreaAdapter,
} from "@/lib/assistant/refine/types";

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

function candidate(params: {
  workAreaId: string;
  workAreaName: string;
  factKey: string;
  label: string;
  question: string;
  inputType: RefineCandidate["inputType"];
  options?: readonly string[];
  group?: RefineCandidate["group"];
  unit?: string;
  currentValue?: RefineCandidate["currentValue"];
  tier?: RefineCandidate["tier"];
  wallTypeId?: string | null;
}): RefineCandidate {
  return {
    id: `refine:${params.workAreaId}:${params.wallTypeId ?? "none"}:${params.factKey}`,
    group: params.group ?? "specification",
    tier: params.tier ?? "high_value",
    workAreaId: params.workAreaId,
    workAreaName: params.workAreaName,
    workAreaType: "internal_walls",
    factKey: params.factKey,
    constraintKey: null,
    questionKey: params.factKey,
    label: params.label,
    question: params.question,
    inputType: params.inputType,
    options: params.options ? [...params.options] : undefined,
    unit: params.unit,
    currentValue: params.currentValue,
    writeTarget: "FACT",
    write: null,
    wallTypeId: params.wallTypeId,
    consumedByCalculator: true,
  };
}

export function internalWallsRefinePanel(params: {
  workAreaId: string;
  workAreaName: string;
  facts: readonly EstimateFact[];
}): InternalWallsRefinePanel {
  const resolved = resolveInternalWallsWallTypes({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  return {
    workAreaId: params.workAreaId,
    workAreaName: params.workAreaName,
    types: resolved.types.map((type, index) =>
      summariseWallType(type, index, resolved.source)
    ),
    activeId: resolved.activeId,
    assumedHeight: resolved.types.some(
      (type) => type.height_source === "assumed_disclosed"
    ),
  };
}

export const internalWallsRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "internal_walls",
  candidates({ workAreaId, workAreaName, facts }) {
    const out: RefineCandidate[] = [];
    const asFacts = facts as EstimateFact[];
    const jobScope = parseInternalWallsJobScope(
      facts.find(
        (f) =>
          f.key === INTERNAL_WALLS_JOB_SCOPE_FACT_KEY &&
          f.work_area_id === workAreaId
      )?.value
    );
    const resolved = resolveInternalWallsWallTypes({
      facts: asFacts,
      workAreaId,
    });
    const active =
      resolved.types.find((row) => row.id === resolved.activeId) ??
      resolved.types[0] ??
      null;
    const wallTypeId = active?.id ?? null;

    if (!jobScope) {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
          label: "Wall work",
          question: "What wall work are you doing?",
          inputType: "select",
          options: INTERNAL_WALLS_JOB_SCOPE_OPTIONS,
          group: "scope",
        })
      );
    }

    if (structuralGateApplies(jobScope) && !knownFact(facts, workAreaId, INTERNAL_WALLS_STRUCTURAL_FACT_KEY)) {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
          label: "Load-bearing or structural",
          question: "Could this wall be load-bearing or structural?",
          inputType: "select",
          options: INTERNAL_WALLS_STRUCTURAL_OPTIONS,
          group: "scope",
        })
      );
    }

    if (jobScope === "remove_partition") {
      return out;
    }

    out.push(
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.frame_system",
        label: "Framing",
        question: "What framing is this wall type?",
        inputType: "select",
        options: INTERNAL_WALLS_FRAME_SYSTEM_OPTIONS,
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.frame_system"
        ),
      })
    );

    if (active?.frame_system === "timber") {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.wall_type.frame_size",
          label: "Timber framing",
          question: "What timber framing size is this wall type?",
          inputType: "select",
          options: INTERNAL_WALLS_TIMBER_SIZE_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.wall_type.frame_size"
          ),
        })
      );
    }

    out.push(
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.length_lm",
        label: "Total wall length",
        question: "What is the total wall length for this wall type?",
        inputType: "number",
        unit: "lm",
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.length_lm"
        ),
      }),
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.height_m",
        label: "Wall height",
        question: "What is the wall height for this wall type?",
        inputType: "number",
        unit: "m",
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.height_m"
        ),
      })
    );

    if (active?.frame_system && active.frame_system !== "existing_frame") {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.wall_type.stud_centres_mm",
          label: "Stud spacing",
          question:
            active.height_m != null && active.height_m > 2.4
              ? "Stud spacing (recommended 400 mm for this height)"
              : "Stud spacing (recommended 600 mm for this height)",
          inputType: "select",
          options: INTERNAL_WALLS_STUD_CENTRES_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.wall_type.stud_centres_mm"
          ),
        })
      );
    }

    out.push(
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.side_a_product",
        label: "Side A lining",
        question: "What lining is on Side A?",
        inputType: "select",
        options: INTERNAL_WALLS_LINING_PRODUCT_OPTIONS,
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.side_a_product"
        ),
        wallTypeId,
      }),
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.side_a_thickness_mm",
        label: "Side A thickness",
        question: "What lining thickness is on Side A?",
        inputType: "select",
        options: INTERNAL_WALLS_THICKNESS_OPTIONS,
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.side_a_thickness_mm"
        ),
        wallTypeId,
      }),
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.side_a_sheet_length_mm",
        label: "Sheet length",
        question:
          recommendedSheetLengthMm(active?.height_m ?? null) != null
            ? `What sheet length? Recommended ${recommendedSheetLengthMm(active?.height_m ?? null)} mm for this wall height. Product-specific availability is not yet confirmed.`
            : "What sheet length? Product-specific availability is not yet confirmed.",
        inputType: "select",
        options: INTERNAL_WALLS_SHEET_LENGTH_OPTIONS,
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.side_a_sheet_length_mm"
        ),
        wallTypeId,
      }),
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.side_a_layers",
        label: "Side A layers",
        question: "How many lining layers on Side A?",
        inputType: "select",
        options: INTERNAL_WALLS_LAYER_OPTIONS,
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.side_a_layers"
        ),
        wallTypeId,
      }),
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.same_lining_both_sides",
        label: "Same lining both sides",
        question: "Same lining both sides?",
        inputType: "select",
        options: INTERNAL_WALLS_SAME_BOTH_SIDES_OPTIONS,
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.same_lining_both_sides"
        ),
        wallTypeId,
      })
    );

    if (active?.same_lining_both_sides === false) {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.wall_type.side_b_product",
          label: "Side B lining",
          question: "What lining is on Side B?",
          inputType: "select",
          options: INTERNAL_WALLS_LINING_PRODUCT_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.wall_type.side_b_product"
          ),
          wallTypeId,
        }),
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.wall_type.side_b_thickness_mm",
          label: "Side B thickness",
          question: "What lining thickness is on Side B?",
          inputType: "select",
          options: INTERNAL_WALLS_THICKNESS_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.wall_type.side_b_thickness_mm"
          ),
          wallTypeId,
        }),
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.wall_type.side_b_sheet_length_mm",
          label: "Side B sheet length",
          question:
            "What sheet length on Side B? Product-specific availability is not yet confirmed.",
          inputType: "select",
          options: INTERNAL_WALLS_SHEET_LENGTH_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.wall_type.side_b_sheet_length_mm"
          ),
          wallTypeId,
        }),
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.wall_type.side_b_layers",
          label: "Side B layers",
          question: "How many lining layers on Side B?",
          inputType: "select",
          options: INTERNAL_WALLS_LAYER_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.wall_type.side_b_layers"
          ),
          wallTypeId,
        })
      );
    }

    out.push(
      candidate({
        workAreaId,
        workAreaName,
        factKey: "internal_walls.wall_type.label",
        label: "Wall type name",
        question: "Optional name for this wall type?",
        inputType: "text",
        group: "advanced",
        tier: "advanced",
        currentValue: wallTypeFieldCurrentValue(
          active,
          "internal_walls.wall_type.label"
        ),
        wallTypeId,
      })
    );

    return out.map((row) =>
      row.factKey?.startsWith("internal_walls.wall_type.")
        ? { ...row, wallTypeId }
        : row
    );
  },
};

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
  INTERNAL_WALLS_STUD_CENTRES_OPTIONS,
  INTERNAL_WALLS_TIMBER_SIZE_OPTIONS,
  liningSheetLengthOptionsForProduct,
  liningThicknessOptionsForProduct,
  materialFamilyForProduct,
  recommendedSheetLengthMmForProduct,
  resolveInternalWallsWallTypes,
  summariseWallType,
  wallTypeFieldCurrentValue,
} from "@/lib/estimate/internal-walls-wall-types";
import {
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
  INTERNAL_WALLS_HAS_OPENINGS_OPTIONS,
  INTERNAL_WALLS_OPENING_TYPE_OPTIONS,
} from "@/lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_ELECTRICAL_KEY,
  INTERNAL_WALLS_ELECTRICAL_NOTE_KEY,
  INTERNAL_WALLS_ELECTRICAL_OPTIONS,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_OPTIONS,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_OPTIONS,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SIDE_SELECTION_OPTIONS,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_OPTIONS,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
  faceEligibleForPainting,
  faceEligibleForStopping,
  insulationAsksForScope,
  internalWallsPaintingOptions,
} from "@/lib/estimate/internal-walls-finish";
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
  openingId?: string | null;
}): RefineCandidate {
  return {
    id: `refine:${params.workAreaId}:${params.wallTypeId ?? "none"}:${params.openingId ?? "none"}:${params.factKey}`,
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
    openingId: params.openingId,
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
    activeOpeningId:
      resolved.types.find((row) => row.id === resolved.activeId)
        ?.active_opening_id ??
      resolved.types[0]?.active_opening_id ??
      null,
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

    if (jobScope !== "infill_opening") {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.wall_type.wall_count",
          label: "Physical wall count",
          question: "How many physical walls share this specification?",
          inputType: "number",
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.wall_type.wall_count"
          ),
        })
      );
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
        })
      );
    }

    out.push(
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
          wallTypeId,
        })
      );
      if (active.stud_centres_source === "custom") {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "internal_walls.wall_type.stud_centres_mm",
            label: "Custom stud spacing",
            question: "What stud spacing (mm) should this wall type use?",
            inputType: "number",
            unit: "mm",
            currentValue:
              active.stud_centres_mm != null ? active.stud_centres_mm : null,
            wallTypeId,
          })
        );
      }
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
      })
    );

    const sideAProduct = active?.side_a.product ?? null;
    const sideAFamily = materialFamilyForProduct(sideAProduct);
    if (sideAFamily === "plasterboard") {
      const recommendedA = recommendedSheetLengthMmForProduct(
        sideAProduct,
        active?.height_m ?? null
      );
      const thicknessOptions = liningThicknessOptionsForProduct(sideAProduct);
      const lengthOptions = liningSheetLengthOptionsForProduct(sideAProduct);
      if (thicknessOptions.length > 0) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "internal_walls.wall_type.side_a_thickness_mm",
            label: "Side A thickness",
            question: "What lining thickness is on Side A?",
            inputType: "select",
            options: thicknessOptions,
            currentValue: wallTypeFieldCurrentValue(
              active,
              "internal_walls.wall_type.side_a_thickness_mm"
            ),
            wallTypeId,
          })
        );
      }
      if (lengthOptions.length > 0) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: "internal_walls.wall_type.side_a_sheet_length_mm",
            label: "Sheet length",
            question:
              recommendedA != null
                ? `What sheet length? Recommended ${recommendedA} mm — smallest length that spans this wall height.`
                : "No validated sheet length spans this wall height.",
            inputType: "select",
            options: lengthOptions,
            currentValue: wallTypeFieldCurrentValue(
              active,
              "internal_walls.wall_type.side_a_sheet_length_mm"
            ),
            wallTypeId,
          })
        );
      }
      out.push(
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
        })
      );
    }

    out.push(
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
        })
      );
      const sideBProduct = active.side_b.product;
      const sideBFamily = materialFamilyForProduct(sideBProduct);
      if (sideBFamily === "plasterboard") {
        const recommendedB = recommendedSheetLengthMmForProduct(
          sideBProduct,
          active.height_m
        );
        const thicknessOptionsB = liningThicknessOptionsForProduct(sideBProduct);
        const lengthOptionsB = liningSheetLengthOptionsForProduct(sideBProduct);
        if (thicknessOptionsB.length > 0) {
          out.push(
            candidate({
              workAreaId,
              workAreaName,
              factKey: "internal_walls.wall_type.side_b_thickness_mm",
              label: "Side B thickness",
              question: "What lining thickness is on Side B?",
              inputType: "select",
              options: thicknessOptionsB,
              currentValue: wallTypeFieldCurrentValue(
                active,
                "internal_walls.wall_type.side_b_thickness_mm"
              ),
              wallTypeId,
            })
          );
        }
        if (lengthOptionsB.length > 0) {
          out.push(
            candidate({
              workAreaId,
              workAreaName,
              factKey: "internal_walls.wall_type.side_b_sheet_length_mm",
              label: "Side B sheet length",
              question:
                recommendedB != null
                  ? `What sheet length on Side B? Recommended ${recommendedB} mm — smallest length that spans this wall height.`
                  : "No validated sheet length spans this wall height.",
              inputType: "select",
              options: lengthOptionsB,
              currentValue: wallTypeFieldCurrentValue(
                active,
                "internal_walls.wall_type.side_b_sheet_length_mm"
              ),
              wallTypeId,
            })
          );
        }
        out.push(
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
    }

    const openingId = active?.active_opening_id ?? active?.openings[0]?.id ?? null;
    if (jobScope !== "form_opening" && jobScope !== "infill_opening") {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: INTERNAL_WALLS_HAS_OPENINGS_KEY,
          label: "Openings",
          question: "Does this wall have any openings?",
          inputType: "select",
          options: INTERNAL_WALLS_HAS_OPENINGS_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            INTERNAL_WALLS_HAS_OPENINGS_KEY
          ),
          wallTypeId,
        })
      );
    }
    if (
      jobScope === "form_opening" ||
      jobScope === "infill_opening" ||
      active?.has_openings === true ||
      (active?.openings.length ?? 0) > 0
    ) {
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.opening.type",
          label: "Opening type",
          question: "What kind of opening is this?",
          inputType: "select",
          options: INTERNAL_WALLS_OPENING_TYPE_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.opening.type"
          ),
          wallTypeId,
          openingId,
        }),
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.opening.width_m",
          label: "Opening width",
          question: "What is the opening width?",
          inputType: "number",
          unit: "m",
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.opening.width_m"
          ),
          wallTypeId,
          openingId,
        }),
        candidate({
          workAreaId,
          workAreaName,
          factKey: "internal_walls.opening.height_m",
          label: "Opening height",
          question: "What is the opening height?",
          inputType: "number",
          unit: "m",
          currentValue: wallTypeFieldCurrentValue(
            active,
            "internal_walls.opening.height_m"
          ),
          wallTypeId,
          openingId,
        })
      );
    }

    if (insulationAsksForScope(jobScope)) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
            label: "Wall insulation",
            question: "Include wall insulation?",
            inputType: "select",
            options: INTERNAL_WALLS_INSULATION_INCLUDED_OPTIONS,
            currentValue: wallTypeFieldCurrentValue(
              active,
              INTERNAL_WALLS_INSULATION_INCLUDED_KEY
            ),
            wallTypeId,
          })
        );
        if (active?.insulation_included === true) {
          out.push(
            candidate({
              workAreaId,
              workAreaName,
              factKey: INTERNAL_WALLS_INSULATION_TYPE_KEY,
              label: "Insulation type",
              question: "What wall insulation type?",
              inputType: "select",
              options: INTERNAL_WALLS_INSULATION_TYPE_OPTIONS,
              currentValue: wallTypeFieldCurrentValue(
                active,
                INTERNAL_WALLS_INSULATION_TYPE_KEY
              ),
              wallTypeId,
            })
          );
        }
      }
      out.push(
        candidate({
          workAreaId,
          workAreaName,
          factKey: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
          label: "Skirting",
          question: "Include skirting?",
          inputType: "select",
          options: INTERNAL_WALLS_SIDE_SELECTION_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            INTERNAL_WALLS_SKIRTING_SIDES_KEY
          ),
          wallTypeId,
        }),
        candidate({
          workAreaId,
          workAreaName,
          factKey: INTERNAL_WALLS_CORNICE_SIDES_KEY,
          label: "Cornice",
          question: "Include cornice / cove?",
          inputType: "select",
          options: INTERNAL_WALLS_SIDE_SELECTION_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            INTERNAL_WALLS_CORNICE_SIDES_KEY
          ),
          wallTypeId,
        }),
        candidate({
          workAreaId,
          workAreaName,
          factKey: INTERNAL_WALLS_ELECTRICAL_KEY,
          label: "Electrical",
          question: "Any electrical work associated with this wall?",
          inputType: "select",
          options: INTERNAL_WALLS_ELECTRICAL_OPTIONS,
          currentValue: wallTypeFieldCurrentValue(
            active,
            INTERNAL_WALLS_ELECTRICAL_KEY
          ),
          wallTypeId,
        })
      );
      if (active?.electrical === "custom") {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: INTERNAL_WALLS_ELECTRICAL_NOTE_KEY,
            label: "Electrical notes",
            question: "Brief electrical allowance note?",
            inputType: "text",
            currentValue: wallTypeFieldCurrentValue(
              active,
              INTERNAL_WALLS_ELECTRICAL_NOTE_KEY
            ),
            wallTypeId,
          })
        );
      }

    if (jobScope !== "form_opening") {
      if (faceEligibleForStopping(active?.side_a)) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
            label: "Stopping — Side A",
            question: "Include stopping to Side A?",
            inputType: "select",
            options: INTERNAL_WALLS_STOPPING_OPTIONS,
            currentValue: wallTypeFieldCurrentValue(
              active,
              INTERNAL_WALLS_STOPPING_SIDE_A_KEY
            ),
            wallTypeId,
          })
        );
      }
      if (faceEligibleForStopping(active?.side_b)) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
            label: "Stopping — Side B",
            question: "Include stopping to Side B?",
            inputType: "select",
            options: INTERNAL_WALLS_STOPPING_OPTIONS,
            currentValue: wallTypeFieldCurrentValue(
              active,
              INTERNAL_WALLS_STOPPING_SIDE_B_KEY
            ),
            wallTypeId,
          })
        );
      }
      if (active && (faceEligibleForPainting(active.side_a) || faceEligibleForPainting(active.side_b))) {
        out.push(
          candidate({
            workAreaId,
            workAreaName,
            factKey: INTERNAL_WALLS_PAINTING_SIDES_KEY,
            label: "Wall painting",
            question: "Include wall painting?",
            inputType: "select",
            options: internalWallsPaintingOptions(active),
            currentValue: wallTypeFieldCurrentValue(
              active,
              INTERNAL_WALLS_PAINTING_SIDES_KEY
            ),
            wallTypeId,
          })
        );
      }
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
      row.factKey?.startsWith("internal_walls.wall_type.") ||
      row.factKey?.startsWith("internal_walls.opening.")
        ? { ...row, wallTypeId, openingId: row.openingId ?? openingId }
        : row
    );
  },
};

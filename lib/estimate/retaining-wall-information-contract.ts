/**
 * RETAINING-WALL-MATURITY-1A — canonical Retaining Wall information contract.
 * Assistant ask timing vs calculator consumption. Not a second takeoff model.
 */

export type RetainingWallFactQuestionClass =
  | "HARD_MINIMUM"
  | "ASK_NOW"
  | "ASSUME_IF_SKIPPED"
  | "REFINE"
  | "DERIVED"
  | "NOT_CONSUMED";

export type RetainingWallInformationContractRow = {
  readonly factKey: string;
  readonly questionClass: RetainingWallFactQuestionClass;
  readonly calculatorConsumed: boolean;
  readonly physical: boolean;
  readonly commercial: boolean;
  readonly confidence: boolean;
  readonly reason: string;
};

export const RETAINING_WALL_INFORMATION_CONTRACT: readonly RetainingWallInformationContractRow[] =
  [
    {
      factKey: "retaining_wall.material",
      questionClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: true,
      reason: "Wall system/type. Timber, concrete sleeper, or masonry. Not inferred from vague words.",
    },
    {
      factKey: "retaining_wall.length_m",
      questionClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Wall length L. Required before a normal estimate.",
    },
    {
      factKey: "retaining_wall.height_m",
      questionClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Level retained height. High/low pair may satisfy this instead.",
    },
    {
      factKey: "retaining_wall.height_high_m",
      questionClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "High-end retained height. With low-end, satisfies height minimum.",
    },
    {
      factKey: "retaining_wall.high_height_m",
      questionClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Alias of height_high_m.",
    },
    {
      factKey: "retaining_wall.height_low_m",
      questionClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Low-end retained height.",
    },
    {
      factKey: "retaining_wall.low_height_m",
      questionClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Alias of height_low_m.",
    },
    {
      factKey: "retaining_wall.is_raking",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Whether height varies along the wall. High/low facts own the numbers.",
    },
    {
      factKey: "retaining_wall.surcharge",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: false,
      commercial: false,
      confidence: true,
      reason: "Additional load above the wall. Warning/confidence only — not a structural calculator.",
    },
    {
      factKey: "retaining_wall.surcharge_type",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: false,
      commercial: false,
      confidence: true,
      reason: "Driveway, parking, building, another wall, sloping ground, other, not sure.",
    },
    {
      factKey: "retaining_wall.excavation_required",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Bulk excavation include. Legacy commercial still uses face m² labour add-on.",
    },
    {
      factKey: "retaining_wall.excavation_volume_m3",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Explicit bulk excavation volume override. Not assumed equal to backfill.",
    },
    {
      factKey: "retaining_wall.drainage_required",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Novacoil / drainage include. Default recommendation Check/Yes.",
    },
    {
      factKey: "retaining_wall.drain_connection_required",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: false,
      commercial: true,
      confidence: true,
      reason: "Outfall / cesspit connection. Allowance only when evidenced.",
    },
    {
      factKey: "retaining_wall.backfill_included",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: true,
      commercial: true,
      confidence: false,
      reason: "Drainage aggregate / backfill include. Physical m³ is planning truth in 1A.",
    },
    {
      factKey: "retaining_wall.backfill_length_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Optional backfill length override. Defaults to wall length.",
    },
    {
      factKey: "retaining_wall.backfill_height_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Optional backfill height override. Prefer H(x) integration.",
    },
    {
      factKey: "retaining_wall.backfill_depth_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Optional backfill depth override. Default 300 mm drainage zone.",
    },
    {
      factKey: "retaining_wall.fixing_type",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: false,
      commercial: true,
      confidence: false,
      reason: "Face-fixed labour complexity on the legacy package. Not a physical takeoff driver.",
    },
    {
      factKey: "retaining_wall.post_spacing_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason:
        "Timber pile centres. Default 1.2 m is target/max ESTIMATING_LAYOUT_ASSUMPTION. Bays are generated evenly, so actual spacing may be smaller than the target. Not a structural standard. Explicit builder/design spacing is also a maximum for layout unless individual post positions are later supplied.",
    },
    {
      factKey: "retaining_wall.pile_embedment_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "User/design pile embedment depth. Overrides the estimating ratio.",
    },
    {
      factKey: "retaining_wall.pile_embedment_ratio",
      questionClass: "ASSUME_IF_SKIPPED",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason:
        "Default estimating embedment 0.50 × H(x). Design or builder-supplied embedment overrides. Not an engineering rule.",
    },
    {
      factKey: "retaining_wall.face_board_section",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Timber face-board identity: 150×50 H4 or 200×50 H4.",
    },
    {
      factKey: "retaining_wall.sleeper_length_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Selected concrete sleeper length. Drives bay/post count.",
    },
    {
      factKey: "retaining_wall.sleeper_face_height_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Selected sleeper face height. Required for sleeper quantity.",
    },
    {
      factKey: "retaining_wall.sleeper_post_embedment_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Explicit steel-post embedment. Overrides 0.70 × H(x) estimating heuristic.",
    },
    {
      factKey: "retaining_wall.hole_diameter_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Post-hole diameter for sleeper concrete. Default 300 mm estimating geometry.",
    },
    {
      factKey: "retaining_wall.premix_bag_yield_m3",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Selected 20 kg bag yield. No assumed identical yield.",
    },
    {
      factKey: "retaining_wall.block_series",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Masonry series/product. 150 or 200 where metadata exists.",
    },
    {
      factKey: "retaining_wall.block_laying_method",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: false,
      commercial: false,
      confidence: false,
      reason: "SELF_PERFORM vs SUBCONTRACT. XOR — no duplicate money.",
    },
    {
      factKey: "retaining_wall.footing_width_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Strip footing width. Default 0.400 m estimating geometry.",
    },
    {
      factKey: "retaining_wall.footing_depth_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Strip footing depth. Default 0.250 m estimating geometry.",
    },
    {
      factKey: "retaining_wall.vertical_starter_spacing_m",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Vertical starter spacing if design-supplied. Not claimed as NZS-compliant.",
    },
    {
      factKey: "retaining_wall.horizontal_rebar_runs",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Explicit horizontal rebar run count. Not fabricated if unknown.",
    },
    {
      factKey: "retaining_wall.waterproofing_required",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "Masonry-only. Liquid or sheet membrane behind the wall.",
    },
    {
      factKey: "retaining_wall.waterproofing_type",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: true,
      commercial: false,
      confidence: false,
      reason: "LIQUID_MEMBRANE or SHEET_MEMBRANE.",
    },
    {
      factKey: "retaining_wall.waterproofing_method",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: false,
      commercial: false,
      confidence: false,
      reason: "SELF_PERFORM vs SUBCONTRACT for waterproofing. XOR.",
    },
    {
      factKey: "retaining_wall.engineering_or_consent_status",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: false,
      commercial: false,
      confidence: true,
      reason: "User-supplied consent/engineering status. Quotr does not determine legality.",
    },
    {
      factKey: "retaining_wall.disposal_included",
      questionClass: "REFINE",
      calculatorConsumed: true,
      physical: false,
      commercial: true,
      confidence: false,
      reason: "Spoil disposal allowance on the legacy commercial path.",
    },
    {
      factKey: "retaining_wall.carting_distance_m",
      questionClass: "NOT_CONSUMED",
      calculatorConsumed: false,
      physical: false,
      commercial: false,
      confidence: false,
      reason: "Legacy carting metres are Project Conditions, not a new Work Area fact.",
    },
    {
      factKey: "site_access",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: false,
      commercial: true,
      confidence: false,
      reason: "Project Conditions — abnormal access/carry applied once.",
    },
    {
      factKey: "material_carry_distance",
      questionClass: "ASK_NOW",
      calculatorConsumed: true,
      physical: false,
      commercial: true,
      confidence: false,
      reason: "Project Conditions — labour factor once. Not in scope productivity.",
    },
  ];

export function retainingWallFactQuestionClass(
  factKey: string
): RetainingWallFactQuestionClass | null {
  return (
    RETAINING_WALL_INFORMATION_CONTRACT.find((row) => row.factKey === factKey)
      ?.questionClass ?? null
  );
}

export function retainingWallContractRow(
  factKey: string
): RetainingWallInformationContractRow | null {
  return (
    RETAINING_WALL_INFORMATION_CONTRACT.find((row) => row.factKey === factKey) ??
    null
  );
}

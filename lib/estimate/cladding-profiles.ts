/**
 * CLADDING-01B — owner-approved ordinary profile metadata.
 *
 * Product profiles only. Not wall dimensions, not quantities, not COST,
 * and not productivity hours.
 */

export const CLADDING_ORDINARY_SYSTEM_VALUES = [
  "timber_bevelback",
  "timber_rusticated",
  "timber_vertical_shiplap",
  "timber_sheet_board_and_batten",
  "fibre_cement_horizontal_weatherboard",
] as const;

export type CladdingOrdinarySystem =
  (typeof CLADDING_ORDINARY_SYSTEM_VALUES)[number];

export const CLADDING_BATTEN_WIDTH_MM_VALUES = [45, 65, 90] as const;
export const CLADDING_BATTEN_THICKNESS_MM_VALUES = [19, 20] as const;

export type CladdingApprovedProfile = {
  readonly id: string;
  readonly family: "timber" | "fibre_cement";
  readonly system: CladdingOrdinarySystem;
  readonly orientation: "horizontal" | "vertical" | null;
  readonly nominal_width_mm: number | null;
  readonly nominal_thickness_mm: number | null;
  readonly effective_cover_mm: number | null;
  readonly board_sheet_length_mm: number | null;
  readonly board_sheet_width_mm: number | null;
  readonly board_gap_mm: number | null;
};

function weatherboardProfile(params: {
  id: string;
  family: "timber" | "fibre_cement";
  system: CladdingOrdinarySystem;
  orientation: "horizontal" | "vertical" | null;
  nominal_width_mm: number;
  nominal_thickness_mm: number | null;
  effective_cover_mm: number;
}): CladdingApprovedProfile {
  return {
    id: params.id,
    family: params.family,
    system: params.system,
    orientation: params.orientation,
    nominal_width_mm: params.nominal_width_mm,
    nominal_thickness_mm: params.nominal_thickness_mm,
    effective_cover_mm: params.effective_cover_mm,
    board_sheet_length_mm: null,
    board_sheet_width_mm: null,
    board_gap_mm: null,
  };
}

export const CLADDING_APPROVED_PROFILES: readonly CladdingApprovedProfile[] = [
  weatherboardProfile({
    id: "timber_bevelback_142x18",
    family: "timber",
    system: "timber_bevelback",
    orientation: null,
    nominal_width_mm: 142,
    nominal_thickness_mm: 18,
    effective_cover_mm: 110,
  }),
  weatherboardProfile({
    id: "timber_bevelback_187x18",
    family: "timber",
    system: "timber_bevelback",
    orientation: null,
    nominal_width_mm: 187,
    nominal_thickness_mm: 18,
    effective_cover_mm: 155,
  }),
  weatherboardProfile({
    id: "timber_bevelback_215x18",
    family: "timber",
    system: "timber_bevelback",
    orientation: null,
    nominal_width_mm: 215,
    nominal_thickness_mm: 18,
    effective_cover_mm: 183,
  }),
  weatherboardProfile({
    id: "timber_bevelback_230x18",
    family: "timber",
    system: "timber_bevelback",
    orientation: null,
    nominal_width_mm: 230,
    nominal_thickness_mm: 18,
    effective_cover_mm: 198,
  }),
  weatherboardProfile({
    id: "timber_rusticated_135x18",
    family: "timber",
    system: "timber_rusticated",
    orientation: null,
    nominal_width_mm: 135,
    nominal_thickness_mm: 18,
    effective_cover_mm: 110,
  }),
  weatherboardProfile({
    id: "timber_rusticated_180x18",
    family: "timber",
    system: "timber_rusticated",
    orientation: null,
    nominal_width_mm: 180,
    nominal_thickness_mm: 18,
    effective_cover_mm: 155,
  }),
  weatherboardProfile({
    id: "timber_rusticated_215x18",
    family: "timber",
    system: "timber_rusticated",
    orientation: null,
    nominal_width_mm: 215,
    nominal_thickness_mm: 18,
    effective_cover_mm: 190,
  }),
  weatherboardProfile({
    id: "timber_rusticated_230x18",
    family: "timber",
    system: "timber_rusticated",
    orientation: null,
    nominal_width_mm: 230,
    nominal_thickness_mm: 18,
    effective_cover_mm: 205,
  }),
  weatherboardProfile({
    id: "timber_vertical_shiplap_90x21",
    family: "timber",
    system: "timber_vertical_shiplap",
    orientation: "vertical",
    nominal_width_mm: 90,
    nominal_thickness_mm: 21,
    effective_cover_mm: 65,
  }),
  weatherboardProfile({
    id: "timber_vertical_shiplap_135x21",
    family: "timber",
    system: "timber_vertical_shiplap",
    orientation: "vertical",
    nominal_width_mm: 135,
    nominal_thickness_mm: 21,
    effective_cover_mm: 110,
  }),
  weatherboardProfile({
    id: "fibre_cement_horizontal_weatherboard_150",
    family: "fibre_cement",
    system: "fibre_cement_horizontal_weatherboard",
    orientation: "horizontal",
    nominal_width_mm: 150,
    nominal_thickness_mm: null,
    effective_cover_mm: 120,
  }),
  weatherboardProfile({
    id: "fibre_cement_horizontal_weatherboard_180",
    family: "fibre_cement",
    system: "fibre_cement_horizontal_weatherboard",
    orientation: "horizontal",
    nominal_width_mm: 180,
    nominal_thickness_mm: null,
    effective_cover_mm: 150,
  }),
  {
    id: "timber_sheet_board_and_batten",
    family: "timber",
    system: "timber_sheet_board_and_batten",
    orientation: null,
    nominal_width_mm: null,
    nominal_thickness_mm: null,
    effective_cover_mm: null,
    board_sheet_length_mm: 2400,
    board_sheet_width_mm: 1200,
    board_gap_mm: 8,
  },
];

const PROFILE_BY_ID = new Map(
  CLADDING_APPROVED_PROFILES.map((row) => [row.id, row])
);

export function claddingApprovedProfileById(
  id: string | null | undefined
): CladdingApprovedProfile | null {
  if (!id) return null;
  return PROFILE_BY_ID.get(id) ?? null;
}

export function isApprovedCladdingBattenWidth(
  value: number | null | undefined
): boolean {
  return (
    value != null &&
    (CLADDING_BATTEN_WIDTH_MM_VALUES as readonly number[]).includes(value)
  );
}

export function isApprovedCladdingBattenThickness(
  value: number | null | undefined
): boolean {
  return (
    value != null &&
    (CLADDING_BATTEN_THICKNESS_MM_VALUES as readonly number[]).includes(value)
  );
}

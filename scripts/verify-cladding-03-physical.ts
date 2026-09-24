/**
 * CLADDING-03 — nested physical takeoff and component identities.
 */
import { readFileSync } from "node:fs";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateCladding } from "../lib/estimate/calculators/cladding";
import {
  CLADDING_BATTEN_EXCLUSIONS,
  CLADDING_BATTEN_QUANTITY_UNRESOLVED,
  CLADDING_BOARD_AND_BATTEN_BATTEN_INSTALL_HOURS_PER_LM,
  CLADDING_BOARD_AND_BATTEN_REMOVE_HOURS_PER_M2,
  CLADDING_BOARD_AND_BATTEN_SHEET_INSTALL_HOURS_PER_M2,
  CLADDING_BOARD_AND_BATTEN_SHEET_M2,
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
  CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM,
  CLADDING_FIBRE_CEMENT_WEATHERBOARD_INSTALL_HOURS_PER_LM,
  CLADDING_FIBRE_CEMENT_WEATHERBOARD_REMOVE_HOURS_PER_M2,
  CLADDING_LABOUR_OPERATION_KEYS,
  CLADDING_LINEAR_MATERIAL_KEYS,
  CLADDING_SHEET_EQUIVALENT_LABEL,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_SPECIALIST_CUSTOM,
  CLADDING_SPECIALIST_MASONRY,
  CLADDING_TIMBER_BEVELBACK_INSTALL_HOURS_PER_LM,
  CLADDING_TIMBER_BEVELBACK_REMOVE_HOURS_PER_M2,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
  claddingBattenMaterialKey,
  claddingOverlapGroup,
  claddingScopeKey,
} from "../lib/estimate/cladding-identities";
import {
  CLADDING_PHYSICAL_COMPLETENESS,
  CLADDING_PHYSICAL_UNPRICED_MESSAGE,
  CLADDING_SPECIALIST_REQUIRED_MESSAGE,
  CLADDING_TRIMS_SPECIFICATION_MESSAGE,
  calculateCladdingPhysical,
  claddingBoardAndBattenJoints,
  claddingLabourPlaceholderIsCommerciallyTrusted,
  claddingLinealMetres,
  claddingSectionGeometry,
  claddingSheetEquivalent,
  type CladdingPhysicalComponent,
} from "../lib/estimate/cladding-physical";
import { CLADDING_PAINTING_DISCLOSURE } from "../lib/estimate/cladding-question-copy";
import {
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_STAGED_NOT_CALCULATED_MESSAGE,
  CLADDING_SUPPORT_NOTES,
  CLADDING_V1_HUMAN_QA_FROZEN,
  createEmptyCladdingPortion,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { isPricedMaterialRequirement } from "../lib/estimate/requirement-commercial-line";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}`);
  }
}

function close(actual: number | null | undefined, expected: number): boolean {
  return actual != null && Math.abs(actual - expected) < 1e-9;
}

function portion(overrides: Partial<CladdingPortion> & { id: string }): CladdingPortion {
  return {
    ...createEmptyCladdingPortion({ id: overrides.id }),
    scope_intent: "install",
    cladding_family: "timber",
    orientation: "horizontal",
    cladding_system: "timber_bevelback",
    approved_profile_id: "timber_bevelback_187x18",
    nominal_width_mm: 187,
    nominal_thickness_mm: 18,
    effective_cover_mm: 155,
    area_method: "direct_m2",
    direct_area_m2: 30,
    openings_already_deducted: true,
    cavity_included: false,
    wall_underlay_or_rab_included: false,
    trims_flashings_corners_included: false,
    existing_cladding_removal_required: false,
    painting_or_coating_included: false,
    ...overrides,
  };
}

function factsFor(rows: CladdingPortion[]): EstimateFact[] {
  return [
    {
      key: CLADDING_PORTIONS_FACT_KEY,
      work_area_id: "c1",
      value: rows,
      source: "user",
    },
  ];
}

function physicalOf(rows: CladdingPortion[]) {
  return calculateCladdingPhysical({
    facts: factsFor(rows),
    workArea: { id: "c1", type: "cladding" },
  });
}

function component(
  rows: CladdingPhysicalComponent[],
  key: string
): CladdingPhysicalComponent | undefined {
  return rows.find((row) => row.componentKey === key);
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" as const },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
  materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
  rates: [],
};

const direct = portion({ id: "direct" });
const before = JSON.stringify(direct);
const geometry = claddingSectionGeometry(direct);
check("direct area is the gross and net area", close(geometry.grossAreaM2, 30) && close(geometry.netAreaM2, 30));
check("geometry does not store net area on the section", JSON.stringify(direct) === before && direct.direct_area_m2 === 30);

const wall = portion({
  id: "wall",
  area_method: "length_height",
  direct_area_m2: null,
  length_m: 8,
  height_m: 2.4,
  nominal_width_mm: 187,
  nominal_thickness_mm: 18,
});
check("length times height is wall area", close(claddingSectionGeometry(wall).grossAreaM2, 19.2));
check("profile millimetres stay off the wall", wall.length_m === 8 && wall.nominal_width_mm === 187);

const already = portion({ id: "already", opening_area_m2: 9, opening_area_authority: "extracted" });
check(
  "openings already deducted ignore a stale opening area",
  close(claddingSectionGeometry(already).netAreaM2, 30) && already.opening_area_m2 === 9
);
const deducted = portion({
  id: "deducted",
  openings_already_deducted: false,
  opening_area_m2: 4,
});
check("opening subtraction leaves the remainder", close(claddingSectionGeometry(deducted).netAreaM2, 26));
const zeroDeduction = portion({
  id: "zero-deduction",
  openings_already_deducted: false,
  opening_area_m2: 0,
});
check("zero opening deduction keeps the gross area", close(claddingSectionGeometry(zeroDeduction).netAreaM2, 30));
check("missing area is unresolved", claddingSectionGeometry(portion({ id: "none", direct_area_m2: null })).netAreaM2 == null);
check("zero area is unresolved", claddingSectionGeometry(portion({ id: "zero", direct_area_m2: 0 })).resolved === false);
check("negative area is unresolved", claddingSectionGeometry(portion({ id: "neg", direct_area_m2: -2 })).resolved === false);
check(
  "a deduction that consumes the area is unresolved",
  claddingSectionGeometry(portion({ id: "eat", openings_already_deducted: false, opening_area_m2: 30 })).netAreaM2 == null
);
check(
  "silent openings stay unresolved",
  claddingSectionGeometry(portion({ id: "silent", openings_already_deducted: null })).reason?.includes("openings") === true
);

const linearProfiles: Array<[string, number, number, string, CladdingPortion["cladding_family"], CladdingPortion["cladding_system"], CladdingPortion["orientation"]]> = [
  ["timber_bevelback_142x18", 110, 12, "cladding.timber.bevelback.142x18.lm", "timber", "timber_bevelback", "horizontal"],
  ["timber_bevelback_187x18", 155, 30, "cladding.timber.bevelback.187x18.lm", "timber", "timber_bevelback", "horizontal"],
  ["timber_bevelback_215x18", 183, 12, "cladding.timber.bevelback.215x18.lm", "timber", "timber_bevelback", "horizontal"],
  ["timber_bevelback_230x18", 198, 12, "cladding.timber.bevelback.230x18.lm", "timber", "timber_bevelback", "horizontal"],
  ["timber_rusticated_135x18", 110, 12, "cladding.timber.rusticated.135x18.lm", "timber", "timber_rusticated", "horizontal"],
  ["timber_rusticated_180x18", 155, 12, "cladding.timber.rusticated.180x18.lm", "timber", "timber_rusticated", "horizontal"],
  ["timber_rusticated_215x18", 190, 12, "cladding.timber.rusticated.215x18.lm", "timber", "timber_rusticated", "horizontal"],
  ["timber_rusticated_230x18", 205, 12, "cladding.timber.rusticated.230x18.lm", "timber", "timber_rusticated", "horizontal"],
  ["timber_vertical_shiplap_90x21", 65, 12, "cladding.timber.vertical_shiplap.90x21.lm", "timber", "timber_vertical_shiplap", "vertical"],
  ["timber_vertical_shiplap_135x21", 110, 12, "cladding.timber.vertical_shiplap.135x21.lm", "timber", "timber_vertical_shiplap", "vertical"],
  ["fibre_cement_horizontal_weatherboard_150", 120, 12, "cladding.fibre_cement.weatherboard.150.lm", "fibre_cement", "fibre_cement_horizontal_weatherboard", "horizontal"],
  ["fibre_cement_horizontal_weatherboard_180", 150, 20, "cladding.fibre_cement.weatherboard.180.lm", "fibre_cement", "fibre_cement_horizontal_weatherboard", "horizontal"],
];
for (const [profileId, cover, area, key, family, system, orientation] of linearProfiles) {
  const row = portion({
    id: profileId,
    cladding_family: family,
    cladding_system: system,
    orientation,
    approved_profile_id: profileId,
    effective_cover_mm: cover,
    direct_area_m2: area,
  });
  const result = physicalOf([row]);
  const material = component(result.portions[0]?.components ?? [], key);
  const expected = area / (cover / 1000);
  check(
    `${profileId} uses cover ${cover} and exact lineal metres`,
    close(claddingLinealMetres(area, cover), expected) &&
      close(material?.quantity, expected) &&
      material?.materialKey === key &&
      result.portions[0]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL
  );
}

const bevel = physicalOf([portion({ id: "bevel-30", label: "North elevation" })]);
const bevelMaterial = bevel.requirements.find(
  (row) => row.kind === "material" && row.componentKey === "cladding.timber.bevelback.187x18.lm"
) as MaterialRequirement | undefined;
check("30 m² bevelback is 30 / 0.155 lm", close(bevelMaterial?.baseQuantity, 30 / 0.155));
check(
  "bevelback display rounds without changing the quantity",
  bevel.portions[0]?.summary.includes("193.55 lm") === true &&
    bevelMaterial?.baseQuantity !== 193.55 &&
    bevelMaterial?.wasteFactor === 0 &&
    bevelMaterial?.purchaseQuantity === bevelMaterial?.baseQuantity
);
const fc = physicalOf([
  portion({
    id: "fc-20",
    label: "South elevation",
    cladding_family: "fibre_cement",
    cladding_system: "fibre_cement_horizontal_weatherboard",
    orientation: "horizontal",
    approved_profile_id: "fibre_cement_horizontal_weatherboard_180",
    nominal_width_mm: 180,
    nominal_thickness_mm: null,
    effective_cover_mm: 150,
    direct_area_m2: 20,
  }),
]);
check(
  "20 m² fibre-cement is 20 / 0.150 lm",
  fc.portions[0]?.summary.includes("133.33 lm") === true &&
    close(
      component(fc.portions[0]?.components ?? [], "cladding.fibre_cement.weatherboard.180.lm")?.quantity,
      20 / 0.15
    )
);
const shiplap = physicalOf([
  portion({
    id: "ship",
    cladding_family: "timber",
    cladding_system: "timber_vertical_shiplap",
    orientation: "vertical",
    approved_profile_id: "timber_vertical_shiplap_90x21",
    nominal_width_mm: 90,
    nominal_thickness_mm: 21,
    effective_cover_mm: 65,
    direct_area_m2: 12,
  }),
]);
check("12 m² of 90 × 21 shiplap is 12 / 0.065 lm", close(component(shiplap.portions[0]?.components ?? [], "cladding.timber.vertical_shiplap.90x21.lm")?.quantity, 12 / 0.065));
const rustic = physicalOf([
  portion({
    id: "rustic",
    cladding_system: "timber_rusticated",
    approved_profile_id: "timber_rusticated_135x18",
    nominal_width_mm: 135,
    effective_cover_mm: 110,
    direct_area_m2: 12,
  }),
]);
check("12 m² of 135 × 18 rusticated is 12 / 0.110 lm", close(component(rustic.portions[0]?.components ?? [], "cladding.timber.rusticated.135x18.lm")?.quantity, 12 / 0.11));
check("lineal identities stay size-specific", new Set(CLADDING_LINEAR_MATERIAL_KEYS).size === CLADDING_LINEAR_MATERIAL_KEYS.length);

const sheet = portion({
  id: "sheet",
  label: "Garage elevation",
  orientation: "vertical",
  cladding_system: "timber_sheet_board_and_batten",
  approved_profile_id: "timber_sheet_board_and_batten",
  nominal_width_mm: null,
  nominal_thickness_mm: null,
  effective_cover_mm: null,
  area_method: "length_height",
  direct_area_m2: null,
  length_m: 6,
  height_m: 2.4,
  batten_width_mm: 65,
  batten_thickness_mm: 19,
});
const joints = claddingBoardAndBattenJoints(6, 2.4);
const sheetResult = physicalOf([sheet]);
const sheetPortion = sheetResult.portions[0];
check("6.0 × 2.4 has five columns and four joints", joints?.columns === 5 && joints.internalVerticalJoints === 4);
check("batten quantity is 9.6 lm", close(joints?.battenLm, 9.6) && close(component(sheetPortion?.components ?? [], claddingBattenMaterialKey(65, 19) ?? "")?.quantity, 9.6));
check("board basis is the 14.4 m² net area", close(component(sheetPortion?.components ?? [], CLADDING_BOARD_AND_BATTEN_SHEET_M2)?.quantity, 14.4));
check(
  "sheet equivalent is informational face-area only",
  claddingSheetEquivalent(14.4) === 5 &&
    component(sheetPortion?.components ?? [], "cladding.timber.board_and_batten.sheet_equivalent.informational")?.quantity === 5 &&
    sheetPortion?.summary.includes(CLADDING_SHEET_EQUIVALENT_LABEL) === false &&
    sheetResult.requirements.some((row) => row.kind === "material" && row.componentKey.includes("sheet_equivalent") && (row as MaterialRequirement).materialKey == null && (row as MaterialRequirement).specification === CLADDING_SHEET_EQUIVALENT_LABEL)
);
check("batten summary excludes corners openings and horizontal joints", sheetPortion?.summary.includes(CLADDING_BATTEN_EXCLUSIONS) === true);
check(
  "sheet purchase quantity stays the face area",
  close((sheetResult.requirements.find((row) => row.componentKey === CLADDING_BOARD_AND_BATTEN_SHEET_M2) as MaterialRequirement).purchaseQuantity, 14.4) &&
    (sheetResult.requirements.find((row) => row.componentKey === CLADDING_BOARD_AND_BATTEN_SHEET_M2) as MaterialRequirement).wasteFactor === 0
);

const battenSizes: Array<[number, number]> = [
  [45, 19],
  [45, 20],
  [65, 19],
  [65, 20],
  [90, 19],
  [90, 20],
];
for (const [width, thickness] of battenSizes) {
  const key = claddingBattenMaterialKey(width, thickness);
  const sized = physicalOf([
    portion({
      ...sheet,
      id: `batten-${width}x${thickness}`,
      batten_width_mm: width,
      batten_thickness_mm: thickness,
    }),
  ]);
  check(
    `batten ${width} × ${thickness} maps to its own identity`,
    key === `cladding.timber.board_and_batten.batten.${width}x${thickness}.lm` &&
      component(sized.portions[0]?.components ?? [], key ?? "")?.materialKey === key
  );
}
check("an unapproved batten size is not invented", claddingBattenMaterialKey(40, 19) == null && claddingBattenMaterialKey(65, 18) == null);

const directSheet = physicalOf([
  portion({
    id: "direct-sheet",
    orientation: "vertical",
    cladding_system: "timber_sheet_board_and_batten",
    approved_profile_id: "timber_sheet_board_and_batten",
    effective_cover_mm: null,
    direct_area_m2: 14.4,
    batten_width_mm: 65,
    batten_thickness_mm: 19,
  }),
]);
check(
  "direct area keeps board metres and leaves battens unresolved",
  close(component(directSheet.portions[0]?.components ?? [], CLADDING_BOARD_AND_BATTEN_SHEET_M2)?.quantity, 14.4) &&
    component(directSheet.portions[0]?.components ?? [], claddingBattenMaterialKey(65, 19) ?? "")?.quantity == null &&
    directSheet.portions[0]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
const missingBatten = physicalOf([
  portion({
    ...sheet,
    id: "missing-batten",
    batten_width_mm: null,
    batten_thickness_mm: null,
  }),
]);
check(
  "missing batten size keeps the board and selects no default",
    close(component(missingBatten.portions[0]?.components ?? [], CLADDING_BOARD_AND_BATTEN_SHEET_M2)?.quantity, 14.4) &&
    component(missingBatten.portions[0]?.components ?? [], CLADDING_BATTEN_QUANTITY_UNRESOLVED)?.materialKey == null &&
    !missingBatten.requirements.some((row) => row.componentKey.includes("batten.45"))
);

const install = physicalOf([portion({ id: "install", existing_cladding_removal_required: false })]);
check(
  "install emits material and install labour without removal",
  install.requirements.some((row) => row.componentKey === "cladding.timber.bevelback.187x18.lm") &&
    install.requirements.some((row) => row.componentKey === CLADDING_TIMBER_BEVELBACK_INSTALL_HOURS_PER_LM) &&
    !install.requirements.some((row) => row.componentKey.includes(".remove."))
);
const replaced = physicalOf([
  portion({ id: "replace", scope_intent: "replace", existing_cladding_removal_required: true }),
]);
check(
  "replace emits new cladding and a separate removal operation",
  replaced.requirements.some((row) => row.componentKey === "cladding.timber.bevelback.187x18.lm") &&
    replaced.requirements.some((row) => row.componentKey === CLADDING_TIMBER_BEVELBACK_REMOVE_HOURS_PER_M2) &&
    !replaced.requirements.some((row) => row.componentKey.includes("disposal") || row.componentKey.includes("cartage"))
);
const removalOnly = physicalOf([
  portion({
    id: "removal",
    scope_intent: "removal_only",
    existing_cladding_removal_required: true,
    cavity_included: true,
    painting_or_coating_included: true,
    trims_flashings_corners_included: true,
  }),
]);
check(
  "removal only emits the removal operation and no new cladding",
  removalOnly.requirements.length === 1 &&
    removalOnly.requirements[0]?.componentKey === CLADDING_TIMBER_BEVELBACK_REMOVE_HOURS_PER_M2 &&
    removalOnly.portions[0]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL
);
check(
  "removal no stays off an install",
  !install.requirements.some((row) => row.kind === "labour" && row.componentKey.includes("remove"))
);

const withAccessories = physicalOf([
  portion({
    id: "accessories",
    direct_area_m2: 30,
    openings_already_deducted: false,
    opening_area_m2: 5,
    cavity_included: true,
    wall_underlay_or_rab_included: true,
    trims_flashings_corners_included: true,
    painting_or_coating_included: true,
  }),
]);
const accessoryPortion = withAccessories.portions[0];
check("cavity yes uses the net area and the ordinary timber identity", component(accessoryPortion?.components ?? [], "cladding.cavity.timber_batten.m2")?.quantity === 25 && component(accessoryPortion?.components ?? [], "cladding.cavity.timber_batten.m2")?.materialKey === "cladding.cavity.timber_batten.m2");
check("underlay uses the gross wall area", component(accessoryPortion?.components ?? [], CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2)?.quantity === 30);
check("underlay description keeps both products unnamed", withAccessories.requirements.some((row) => row.componentKey === CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2 && row.description.includes("wall underlay or rigid air barrier")));
check("trims stay unresolved without a lineal quantity", component(accessoryPortion?.components ?? [], CLADDING_TRIMS_UNRESOLVED)?.quantity == null && accessoryPortion?.summary.includes(CLADDING_TRIMS_SPECIFICATION_MESSAGE) === true);
check(
  "painting yes creates no cladding requirement",
  accessoryPortion?.summary.includes(CLADDING_PAINTING_DISCLOSURE) === true &&
    !withAccessories.requirements.some((row) => /paint|coating/i.test(row.componentKey))
);
const cavityNo = physicalOf([portion({ id: "cavity-no", cavity_included: false, wall_underlay_or_rab_included: false, trims_flashings_corners_included: false })]);
check(
  "explicit no omits cavity underlay and trims",
  !cavityNo.requirements.some((row) => row.componentKey === CLADDING_CAVITY_UNRESOLVED_M2 || row.componentKey === CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2 || row.componentKey === CLADDING_TRIMS_UNRESOLVED)
);
check(
  "scaffold and fixings are absent",
  !withAccessories.requirements.some((row) => /scaffold|fixing|nail|screw/i.test(row.componentKey + row.description))
);

const labour = bevel.requirements.find((row) => row.kind === "labour") as LabourRequirement;
check("install labour uses the bevelback operation identity", labour.componentKey === CLADDING_TIMBER_BEVELBACK_INSTALL_HOURS_PER_LM && labour.productivityBasis.key === CLADDING_TIMBER_BEVELBACK_INSTALL_HOURS_PER_LM);
check(
  "labour hours stay unresolved and unpriced",
  labour.priced === false &&
    labour.baseHours === 0 &&
    labour.adjustedHours === 0 &&
    labour.productivityBasis.hoursPerUnit === 0 &&
    labour.hourlyCost == null &&
    labour.totalCost == null &&
    labour.rateProvenance === "missing" &&
    labour.adjustmentRef.factors.length === 0 &&
    labour.assumptions.some((row) => row.key === "productivity_unresolved")
);
check("a zero hour placeholder is not commercially trusted", claddingLabourPlaceholderIsCommerciallyTrusted(labour) === false);
check(
  "registered labour identities include install and removal operations",
  CLADDING_LABOUR_OPERATION_KEYS.includes(CLADDING_TIMBER_BEVELBACK_INSTALL_HOURS_PER_LM) &&
    CLADDING_LABOUR_OPERATION_KEYS.includes(CLADDING_BOARD_AND_BATTEN_SHEET_INSTALL_HOURS_PER_M2) &&
    CLADDING_LABOUR_OPERATION_KEYS.includes(CLADDING_BOARD_AND_BATTEN_BATTEN_INSTALL_HOURS_PER_LM) &&
    CLADDING_LABOUR_OPERATION_KEYS.includes(CLADDING_FIBRE_CEMENT_WEATHERBOARD_INSTALL_HOURS_PER_LM) &&
    CLADDING_LABOUR_OPERATION_KEYS.includes(CLADDING_FIBRE_CEMENT_WEATHERBOARD_REMOVE_HOURS_PER_M2) &&
    CLADDING_LABOUR_OPERATION_KEYS.includes(CLADDING_BOARD_AND_BATTEN_REMOVE_HOURS_PER_M2) &&
    CLADDING_LABOUR_OPERATION_KEYS.includes(CLADDING_CUSTOM_REMOVE_HOURS_PER_M2)
);
check(
  "no material requirement is priced",
  bevel.requirements.filter((row) => row.kind === "material").every((row) => isPricedMaterialRequirement(row as MaterialRequirement) === false)
);

const brick = physicalOf([
  portion({
    id: "brick",
    label: "Street elevation",
    cladding_family: "brick_veneer",
    cladding_system: "specialist_unresolved",
    orientation: null,
    approved_profile_id: null,
    effective_cover_mm: null,
    other_description: "Recycled brick veneer",
    direct_area_m2: 40,
    existing_cladding_removal_required: false,
  }),
]);
check(
  "brick stays specialist and keeps the net area",
  brick.portions[0]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    brick.portions[0]?.netAreaM2 === 40 &&
    component(brick.portions[0]?.components ?? [], CLADDING_SPECIALIST_BRICK_VENEER)?.quantity === 40 &&
    !brick.requirements.some((row) => row.componentKey.includes("bevelback") || row.componentKey.includes("weatherboard"))
);
const masonry = physicalOf([
  portion({
    id: "masonry",
    cladding_family: "masonry",
    cladding_system: "specialist_unresolved",
    approved_profile_id: null,
    effective_cover_mm: null,
    other_description: "Concrete masonry veneer",
    direct_area_m2: 18,
  }),
]);
check("masonry uses its own specialist identity", component(masonry.portions[0]?.components ?? [], CLADDING_SPECIALIST_MASONRY)?.materialKey == null);
const custom = physicalOf([
  portion({
    id: "custom",
    cladding_family: "other",
    cladding_system: "specialist_unresolved",
    specialist_kind: "custom_profile",
    approved_profile_id: null,
    nominal_width_mm: 200,
    nominal_thickness_mm: 18,
    effective_cover_mm: 140,
    effective_cover_authority: "user",
    other_description: "200 × 18 mm custom bevel",
    direct_area_m2: 10,
  }),
]);
check(
  "custom cover is informational and does not inherit an ordinary identity",
  close(component(custom.portions[0]?.components ?? [], CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM)?.quantity, 10 / 0.14) &&
    component(custom.portions[0]?.components ?? [], CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM)?.materialKey == null &&
    custom.requirements.some((row) => row.componentKey === CLADDING_CUSTOM_INSTALL_HOURS_PER_LM) &&
    !custom.requirements.some((row) => CLADDING_LINEAR_MATERIAL_KEYS.includes(row.componentKey)) &&
    custom.portions[0]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
);
const other = physicalOf([
  portion({
    id: "other",
    cladding_family: "other",
    cladding_system: "specialist_unresolved",
    approved_profile_id: null,
    effective_cover_mm: null,
    other_description: "Proprietary cassette",
    direct_area_m2: 8,
  }),
]);
check("other custom keeps description and area without lineal inheritance", component(other.portions[0]?.components ?? [], CLADDING_SPECIALIST_CUSTOM)?.quantity === 8 && !other.requirements.some((row) => row.componentKey.includes(".lm")));
const customRemoval = physicalOf([
  portion({
    id: "custom-removal",
    scope_intent: "removal_only",
    cladding_family: null,
    cladding_system: null,
    approved_profile_id: null,
    effective_cover_mm: null,
    other_description: "Existing unknown boards",
    direct_area_m2: 16,
  }),
]);
check(
  "unknown removal uses the custom removal identity",
  customRemoval.requirements.some((row) => row.componentKey === CLADDING_CUSTOM_REMOVE_HOURS_PER_M2) &&
    !customRemoval.requirements.some((row) => row.componentKey.includes("bevelback"))
);

const sibling = physicalOf([
  portion({ id: "complete-sibling", label: "North elevation" }),
  portion({ id: "incomplete-sibling", label: "South elevation", direct_area_m2: null, approved_profile_id: "timber_bevelback_187x18" }),
]);
check(
  "an incomplete sibling does not suppress the complete sibling",
  sibling.portions[0]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    sibling.portions[1]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    sibling.requirements.some((row) => row.variantKey === "complete-sibling" && row.componentKey === "cladding.timber.bevelback.187x18.lm") &&
    !sibling.requirements.some((row) => row.variantKey === "incomplete-sibling" && row.kind === "material" && (row as MaterialRequirement).baseQuantity === 0 && row.componentKey.includes("187x18"))
);
const twins = physicalOf([
  portion({ id: "twin-a", label: "North elevation" }),
  portion({ id: "twin-b", label: "North elevation" }),
]);
check(
  "identical sections stay independent",
  twins.requirements.filter((row) => row.componentKey === "cladding.timber.bevelback.187x18.lm").length === 2 &&
    new Set(twins.requirements.filter((row) => row.componentKey === "cladding.timber.bevelback.187x18.lm").map((row) => row.requirementId)).size === 2 &&
    twins.portions[0]?.components[0]?.overlapGroup === claddingOverlapGroup("twin-a") &&
    twins.portions[1]?.components[0]?.overlapGroup === claddingOverlapGroup("twin-b") &&
    twins.portions[0]?.components[0]?.scopeKey === claddingScopeKey({ workAreaId: "c1", nestedItemId: "twin-a", componentKey: "cladding.timber.bevelback.187x18.lm" })
);
check(
  "a specialist sibling leaves the ordinary section intact",
  physicalOf([
    portion({ id: "ordinary-next-to-brick" }),
    portion({
      id: "brick-sibling",
      cladding_family: "brick_veneer",
      cladding_system: "specialist_unresolved",
      approved_profile_id: null,
      effective_cover_mm: null,
      other_description: "Brick veneer",
    }),
  ]).requirements.some((row) => row.variantKey === "ordinary-next-to-brick" && row.componentKey.includes("187x18"))
);

const calculated = calculateCladding(
  {
    ...baseContext,
    facts: factsFor([portion({ id: "priced-check", label: "North elevation" })]),
    confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }],
  },
  { id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }
);
check(
  "calculator returns physical requirements and hosted commercial lines",
  calculated.lineItems.some((row) => (row.recommendedCost ?? 0) > 0) &&
    calculated.lineItems.every(
      (row) => row.includedInTotal === false || (row.recommendedCost ?? 0) > 0
    ) &&
    (calculated.requirements?.length ?? 0) > 0 &&
    calculated.assumptions.length === 0 &&
    !calculated.missingInfo.some((row) => row.includes(CLADDING_PHYSICAL_UNPRICED_MESSAGE)) &&
    !calculated.missingInfo.includes(CLADDING_STAGED_NOT_CALCULATED_MESSAGE)
);
const emptyCalc = calculateCladding(
  { ...baseContext, facts: [], confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }] },
  { id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }
);
check(
  "a cladding work area with no sections invents no quantity",
  emptyCalc.lineItems.length === 0 &&
    emptyCalc.requirements == null &&
    emptyCalc.missingInfo.includes(CLADDING_STAGED_NOT_CALCULATED_MESSAGE)
);
check(
  "incomplete copy names the missing area in human language",
  sibling.missingInfo.some((row) => row.includes("South elevation") && row.includes("positive cladding area")) &&
    !sibling.missingInfo.some((row) => row.includes("cladding.portion") || row.includes("COMPLETE_PHYSICAL"))
);
check(
  "specialist copy asks for specification",
  brick.missingInfo.some((row) => row.includes(CLADDING_SPECIALIST_REQUIRED_MESSAGE))
);
const estimated = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 } as EstimateWorkArea],
  facts: factsFor([portion({ id: "estimate" })]),
});
check(
  "estimate lines are hosted commercial rows and no zero-dollar cladding line appears",
  estimated.lineItems.some((row) => row.workAreaId === "c1" && (row.recommendedCost ?? 0) > 0) &&
    estimated.lineItems
      .filter((row) => row.workAreaId === "c1")
      .every((row) => row.includedInTotal === false || (row.recommendedCost ?? 0) > 0)
);
const conditioned = calculateCladding(
  {
    ...baseContext,
    facts: factsFor([portion({ id: "conditioned" })]),
    constraints: [{ id: "k1", project_id: "p1", key: "site_access", value: "difficult", source: "user" }],
    confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }],
  },
  { id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }
);
check(
  "project conditions do not change physical quantities",
  conditioned.requirements?.find((row) => row.kind === "material")?.kind === "material" &&
    (conditioned.requirements?.find((row) => row.kind === "material") as MaterialRequirement).baseQuantity ===
      bevelMaterial?.baseQuantity &&
    (conditioned.requirements?.find((row) => row.kind === "labour") as LabourRequirement).adjustmentRef.factors.length === 0
);

const support = getWorkAreaSupportEntry("cladding");
check(
  "support stays staged and not estimate-ready",
  support?.notes === CLADDING_SUPPORT_NOTES &&
    support.notes.includes("physical takeoff") &&
    support.band === "staged" &&
    support.estimatableAsWorkArea === false &&
    CLADDING_V1_HUMAN_QA_FROZEN === false
);
check("doors and flooring remain frozen", DOORS_V1_HUMAN_QA_FROZEN === true && FLOORING_V1_HUMAN_QA_FROZEN === true);
check(
  "quote scope stays empty",
  buildWorkAreaQuoteDescriptionDraft({
    type: "cladding",
    name: "Cladding",
    facts: [{ key: "cladding.portions", label: "Cladding sections", value: "[]" }],
  }) === ""
);

const source = [
  readFileSync(new URL("../lib/estimate/cladding-identities.ts", import.meta.url), "utf8"),
  readFileSync(new URL("../lib/estimate/cladding-physical.ts", import.meta.url), "utf8"),
  readFileSync(new URL("../lib/estimate/calculators/cladding.ts", import.meta.url), "utf8"),
].join("\n");
const forbidden = [
  "CCS-035",
  "CCS-047",
  "painting.material.m2",
  "painting.labour_hours_per_m2",
  "paint.litre",
  "scope.cladding.m2",
  "retaining_wall.masonry",
  "timber.lining.profile.lm",
  "1.1",
];
for (const token of forbidden) {
  check(`physical modules do not reference ${token}`, !source.includes(token));
}
check("physical modules do not reference demolition labour", !/demolition/i.test(source));
check("no default 50 m² or 25 m² area is present", !source.includes("50 m²") && !source.includes("25 m²"));

check("NaN area is rejected", claddingSectionGeometry(portion({ id: "nan", direct_area_m2: Number.NaN })).resolved === false);
check("infinite area is rejected", claddingSectionGeometry(portion({ id: "inf", direct_area_m2: Number.POSITIVE_INFINITY })).resolved === false);
check(
  "a deduction above the gross area is rejected",
  claddingSectionGeometry(portion({ id: "over", openings_already_deducted: false, opening_area_m2: 31 })).netAreaM2 == null
);
check(
  "a negative deduction is rejected",
  claddingSectionGeometry(portion({ id: "neg-open", openings_already_deducted: false, opening_area_m2: -1 })).resolved === false
);
const sheetNotWall = portion({
  id: "sheet-not-wall",
  orientation: "vertical",
  cladding_system: "timber_sheet_board_and_batten",
  approved_profile_id: "timber_sheet_board_and_batten",
  effective_cover_mm: null,
  board_sheet_length_mm: 2400,
  board_sheet_width_mm: 1200,
  direct_area_m2: 10,
  length_m: null,
  height_m: null,
});
check("a 2400 × 1200 sheet is not wall geometry", claddingSectionGeometry(sheetNotWall).grossAreaM2 === 10 && sheetNotWall.length_m == null);
check(
  "fibre-cement width is not wall width",
  claddingSectionGeometry(portion({
    id: "fc-width",
    cladding_family: "fibre_cement",
    cladding_system: "fibre_cement_horizontal_weatherboard",
    approved_profile_id: "fibre_cement_horizontal_weatherboard_150",
    nominal_width_mm: 150,
    effective_cover_mm: 120,
    length_m: null,
    direct_area_m2: 8,
  })).grossAreaM2 === 8
);
const netRemoval = physicalOf([
  portion({
    id: "net-removal",
    scope_intent: "replace",
    openings_already_deducted: false,
    opening_area_m2: 6,
    existing_cladding_removal_required: true,
    direct_area_m2: 30,
  }),
]);
const removalLabour = netRemoval.requirements.find((row) => row.componentKey === CLADDING_TIMBER_BEVELBACK_REMOVE_HOURS_PER_M2) as LabourRequirement;
check("removal quantity uses net area and install uses the same net lineal basis", close(removalLabour.productivityBasis.quantity, 24) && close((netRemoval.requirements.find((row) => row.componentKey === "cladding.timber.bevelback.187x18.lm") as MaterialRequirement).baseQuantity, 24 / 0.155));
check(
  "direct-area board-and-batten still publishes the sheet equivalent",
  component(directSheet.portions[0]?.components ?? [], "cladding.timber.board_and_batten.sheet_equivalent.informational")?.quantity === 5
);
check(
  "missing batten size emits no batten install labour",
  !missingBatten.requirements.some((row) => row.componentKey === CLADDING_BOARD_AND_BATTEN_BATTEN_INSTALL_HOURS_PER_LM)
);
const trims = component(accessoryPortion?.components ?? [], CLADDING_TRIMS_UNRESOLVED);
const trimsRequirement = withAccessories.requirements.find((row) => row.componentKey === CLADDING_TRIMS_UNRESOLVED) as MaterialRequirement;
check(
  "an unresolved trim placeholder cannot commercialise",
  trims?.quantity == null &&
    trimsRequirement.priced === false &&
    trimsRequirement.unitCost == null &&
    trimsRequirement.totalCost == null &&
    isPricedMaterialRequirement(trimsRequirement) === false
);
check("north summary states the net area and rounded lineal metres", bevel.portions[0]?.summary.includes("30 m² net cladding area") === true && bevel.portions[0]?.summary.includes("193.55 lm of 187 × 18 mm bevelback weatherboard") === true);
check("batten summary states 9.6 lm", sheetPortion?.summary.includes("9.6 lm internal vertical-joint battens") === true);
check(
  "every component carries section ownership",
  bevel.portions[0]?.components.every((row) => row.workAreaId === "c1" && row.nestedItemId === "bevel-30" && row.variantKey === "bevel-30" && row.scopeKey.startsWith("cladding:c1:bevel-30:") && row.overlapGroup === "cladding.section:bevel-30") === true
);
check(
  "material rows carry no cost, margin or GST",
  bevel.requirements.filter((row) => row.kind === "material").every((row) => (row as MaterialRequirement).unitCost == null && (row as MaterialRequirement).totalCost == null && (row as MaterialRequirement).wasteFactor === 0)
);
check(
  "unanswered openings block only that section",
  physicalOf([
    portion({ id: "open-complete" }),
    portion({ id: "open-missing", openings_already_deducted: null }),
  ]).portions.map((row) => row.completeness).join(",") === "COMPLETE_PHYSICAL,INFORMATION_REQUIRED"
);
const removalUnanswered = physicalOf([portion({ id: "removal-null", existing_cladding_removal_required: null })]);
check(
  "unanswered removal keeps the weatherboard quantity and blocks completeness",
  removalUnanswered.portions[0]?.completeness === CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    close(component(removalUnanswered.portions[0]?.components ?? [], "cladding.timber.bevelback.187x18.lm")?.quantity, 30 / 0.155) &&
    !removalUnanswered.requirements.some((row) => row.componentKey.includes(".remove."))
);
check(
  "custom removal labour stays unpriced",
  (customRemoval.requirements[0] as LabourRequirement).priced === false &&
    (customRemoval.requirements[0] as LabourRequirement).hourlyCost == null
);
check(
  "brick description is retained on the specialist requirement",
  brick.requirements.some((row) => row.description.includes("Recycled brick veneer"))
);
check(
  "opening layout is not deducted from batten joints",
  close(
    component(
      physicalOf([
        portion({
          ...sheet,
          id: "joints-with-openings",
          openings_already_deducted: false,
          opening_area_m2: 2,
        }),
      ]).portions[0]?.components ?? [],
      claddingBattenMaterialKey(65, 19) ?? ""
    )?.quantity,
    9.6
  )
);
check("no waste requirement is emitted", bevel.requirements.every((row) => row.kind !== "waste"));
check(
  "install labour quantity keeps the exact lineal metres",
  close(labour.productivityBasis.quantity, 30 / 0.155) && labour.productivityBasis.quantity !== 193.55
);
check(
  "estimate requirements do not create a zero-dollar resolved line",
  estimated.lineItems
    .filter((row) => row.workAreaId === "c1" && row.includedInTotal !== false)
    .every((row) => (row.recommendedCost ?? 0) > 0 && (row.recommendedSell ?? 0) > 0)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

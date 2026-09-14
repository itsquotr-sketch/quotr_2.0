/**
 * CEILINGS WA-04D — bulkheads, insulation, fixings bases, physical completeness.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-04d.ts
 *
 * No commercial money. Preview only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  calculateCeilingBulkhead,
  CEILING_BULKHEAD_STEEL_FRAMING_KEY,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LAYERS_ASSUMPTION_STATEMENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-bulkheads";
import {
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
  CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_FIXINGS_PLYWOOD_COMPONENT,
  CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT,
  CEILINGS_TILE_GRID_FIXINGS_DECISION,
} from "../lib/estimate/ceilings-fixings";
import { CEILINGS_INSULATION_COMPONENT } from "../lib/estimate/ceilings-insulation";
import { CEILINGS_STEEL_CLIP_COMPONENT } from "../lib/estimate/ceilings-steel";
import { countCoveredAreaSheets } from "../lib/estimate/material-buildups";
import { runCountFromSpacing } from "../lib/estimate/run-count";
import {
  CEILING_PHYSICAL_COMPLETENESS,
  calculateCeilingsPhysical,
  calculatePortionCeilingsPhysical,
  ceilingRequirementComponentId,
  ceilingRequirementNestedItemId,
} from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
  CEILINGS_NESTED_NOT_CALCULATED_MESSAGE,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingBulkhead,
  createEmptyCeilingPortion,
  hasCanonicalCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { INTERNAL_WALLS_TIMBER_90_KEY } from "../lib/estimate/internal-walls-identities";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";
const BH1 = "cccccccc-dddd-4eee-8fff-333333333333";
const BH2 = "dddddddd-eeee-4fff-8aaa-444444444444";

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

function wa(id = "c1", name = "Ceilings"): EstimateWorkArea {
  return { id, type: "ceilings", name, sort_order: 1 };
}

function writePortions(
  portions: CeilingPortion[],
  workAreaId = "c1"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function estimateCtx(facts: EstimateFact[], workArea = wa()): EstimateContext {
  return {
    project: { id: "ceilings-wa-04d", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: WASTAGE,
    rates: [],
  } as unknown as EstimateContext;
}

function ordinaryPortion(params?: {
  id?: string;
  lining?: CeilingPortion["lining"]["family"];
  product?: CeilingPortion["lining"]["plasterboard_product"];
  thickness?: 10 | 13 | "other";
  family?: CeilingPortion["structure"]["family"];
  insulation?: boolean;
  area?: number;
  length?: number | null;
  width?: number | null;
}): CeilingPortion {
  const row = createEmptyCeilingPortion({
    id: params?.id ?? P1,
    label: "Lounge",
  });
  row.structure.family = params?.family ?? "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = params?.lining ?? "plasterboard";
  row.lining.plasterboard_product = params?.product ?? "standard";
  row.lining.thickness_mm = params?.thickness ?? 13;
  row.lining.sheet_length_mm = 3000;
  row.lining.sheet_width_mm = 1200;
  if (params?.length != null && params?.width != null) {
    row.geometry.mode = "length_width";
    row.geometry.length_m = params.length;
    row.geometry.width_m = params.width;
    row.geometry.area_m2 = params.length * params.width;
  } else {
    row.geometry.mode = "area_only";
    row.geometry.area_m2 = params?.area ?? 12;
  }
  row.finish.insulation_included = params?.insulation === true;
  row.has_bulkheads = false;
  return row;
}

function addStandardBulkhead(
  portion: CeilingPortion,
  params?: {
    id?: string;
    length?: number;
    depth?: number;
    height?: number;
    framing?: "timber" | "steel";
    lining?: "standard" | "aqualine" | "fyreline" | "other";
    thickness?: 10 | 13 | "other";
  }
): CeilingPortion {
  const bulkhead = createEmptyCeilingBulkhead({
    id: params?.id ?? BH1,
    label: "Downstand",
  });
  bulkhead.form = "conventional_two_face_downstand";
  bulkhead.topology = "conventional_two_face_downstand";
  bulkhead.length_m = params?.length ?? 4;
  bulkhead.depth_m = params?.depth ?? 0.4;
  bulkhead.height_m = params?.height ?? 0.5;
  bulkhead.framing_type = params?.framing ?? "timber";
  bulkhead.lining_type = params?.lining ?? "standard";
  bulkhead.thickness_mm = params?.thickness ?? 13;
  portion.has_bulkheads = true;
  portion.bulkheads = [...portion.bulkheads, bulkhead];
  portion.active_bulkhead_id = bulkhead.id;
  return portion;
}

console.log("=== CEILINGS WA-04D bulkheads + insulation + fixings + completeness ===\n");

const fixture = ordinaryPortion({ length: 4, width: 3 });
addStandardBulkhead(fixture);
const bh = calculateCeilingBulkhead({
  portion: fixture,
  bulkhead: fixture.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
check("A bulkhead 4m × 0.4 × 0.5 → 12lm longitudinal", bh.longitudinalLm === 12);
check(
  "B nog stations = 10",
  bh.nogStations === 10 &&
    bh.nogStations === runCountFromSpacing(4, 0.45)
);
check("C nog LM = 9", bh.nogLm === 9);
check("D total bulkhead framing = 21lm", bh.framingLm === 21);
check(
  "E bulkhead lining area = 3.6m²",
  bh.liningAreaM2 === 3.6 &&
    bh.undersideAreaM2 === 1.6 &&
    bh.verticalFaceAreaM2 === 2
);
check(
  "F one exposed vertical face only",
  bh.exposedVerticalFaces === 1 &&
    bh.liningAreaM2 === 4 * (0.4 + 0.5)
);

const island = ordinaryPortion();
const islandBh = createEmptyCeilingBulkhead({ id: BH1, label: "Island" });
islandBh.form = "island";
islandBh.topology = "unsupported_specialist";
islandBh.length_m = 4;
islandBh.depth_m = 0.4;
islandBh.height_m = 0.5;
islandBh.framing_type = "timber";
islandBh.lining_type = "standard";
islandBh.thickness_mm = 13;
island.has_bulkheads = true;
island.bulkheads = [islandBh];
const islandTakeoff = calculateCeilingBulkhead({
  portion: island,
  bulkhead: islandBh,
  materialWastageSettings: WASTAGE,
});
const islandPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: island,
  materialWastageSettings: WASTAGE,
});
check(
  "G island bulkhead not coerced to standard",
  islandTakeoff.status === "unsupported_specialist" &&
    islandTakeoff.framingLm == null &&
    islandPhysical.portion.completeness ===
      CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    islandPhysical.requirements.every(
      (row) => !row.componentKey.startsWith("ceilings.bulkhead.framing")
    )
);

const invalid = ordinaryPortion();
addStandardBulkhead(invalid, { length: 0 });
invalid.bulkheads[0]!.length_m = 0;
const zeroBh = calculateCeilingBulkhead({
  portion: invalid,
  bulkhead: invalid.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
invalid.bulkheads[0]!.length_m = Number.NaN;
const nanBh = calculateCeilingBulkhead({
  portion: invalid,
  bulkhead: invalid.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
invalid.bulkheads[0]!.length_m = -1;
const negBh = calculateCeilingBulkhead({
  portion: invalid,
  bulkhead: invalid.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
check(
  "H invalid bulkhead geometry rejected",
  zeroBh.status === "information_required" &&
    nanBh.status === "invalid" &&
    negBh.status === "invalid"
);

const multi = ordinaryPortion();
addStandardBulkhead(multi, { id: BH1, length: 4 });
addStandardBulkhead(multi, { id: BH2, length: 3, depth: 0.3, height: 0.4 });
const multiPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: multi,
  materialWastageSettings: WASTAGE,
});
const bhReqs = multiPhysical.requirements.filter((row) =>
  row.componentKey.startsWith("ceilings.bulkhead.framing")
);
check(
  "I multiple bulkheads remain component-scoped",
  multiPhysical.portion.bulkheads.length === 2 &&
    multiPhysical.portion.bulkheads[0]?.componentId === BH1 &&
    multiPhysical.portion.bulkheads[1]?.componentId === BH2 &&
    bhReqs.length === 2 &&
    bhReqs[0]?.requirementId !== bhReqs[1]?.requirementId
);
check(
  "J bulkhead requirements preserve componentId",
  bhReqs.every((row) => ceilingRequirementNestedItemId(row) === P1) &&
    ceilingRequirementComponentId(bhReqs[0]!) === BH1 &&
    ceilingRequirementComponentId(bhReqs[1]!) === BH2
);

const noThickness = ordinaryPortion();
addStandardBulkhead(noThickness);
noThickness.bulkheads[0]!.thickness_mm = undefined;
const missingThickness = calculateCeilingBulkhead({
  portion: noThickness,
  bulkhead: noThickness.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
check(
  "K plasterboard bulkhead thickness not silently 13mm",
  missingThickness.status === "information_required" &&
    missingThickness.liningMaterialKey == null &&
    missingThickness.installedSheets == null
);

const counted = countCoveredAreaSheets({
  areaM2: 3.6,
  sheetLengthM: 3,
  sheetWidthM: 1.2,
  wastagePercent: 10,
  layerCount: 1,
});
check(
  "L bulkhead sheet takeoff uses shared helper",
  bh.installedSheets === counted?.installedSheets &&
    bh.purchaseSheets === counted?.purchaseSheets &&
    bh.layerCount === 1 &&
    bh.layerCountSource === "assumed_disclosed" &&
    bh.layerAssumption === CEILINGS_BULKHEAD_LAYERS_ASSUMPTION_STATEMENT &&
    read("lib/estimate/ceilings-bulkheads.ts").includes("countCoveredAreaSheets") &&
    !read("lib/estimate/ceilings-bulkheads.ts").includes("calculateSheetCount")
);

const insulated = ordinaryPortion({ insulation: true, area: 30 });
const insPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: insulated,
  materialWastageSettings: WASTAGE,
});
const insReq = insPhysical.requirements.find(
  (row) => row.componentKey === CEILINGS_INSULATION_COMPONENT
);
check(
  "M insulation quantity = ceiling area",
  insPhysical.portion.insulation.status === "ok" &&
    insPhysical.portion.insulation.installedM2 === 30 &&
    insReq?.baseQuantity === 30 &&
    insReq.baseUnit === "m2"
);
check(
  "N area-only insulation valid",
  insulated.geometry.mode === "area_only" &&
    insPhysical.portion.insulation.status === "ok"
);
check(
  "O no invented insulation price/product",
  insReq?.priced === false &&
    insReq.unitCost == null &&
    insReq.materialKey == null &&
    insPhysical.portion.insulation.wastageUnresolved === true &&
    insPhysical.portion.insulation.purchaseM2 === 30
);

const timber = ordinaryPortion({
  family: "timber_direct_fix",
  length: 4,
  width: 3,
});
timber.structure.timber = {
  size: "140x45_h1.2",
  spacing_mm: 450,
  direction: "along_length",
};
const timberPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: timber,
  materialWastageSettings: WASTAGE,
});
check(
  "P timber framing fixings basis exists",
  timberPhysical.requirements.some(
    (row) =>
      row.componentKey === CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT &&
      row.baseUnit === "lm" &&
      row.baseQuantity === timberPhysical.portion.timber.installedFramingLM &&
      row.priced === false
  )
);

const steel = ordinaryPortion({
  family: "steel_direct_fix",
  length: 4,
  width: 3,
});
steel.structure.steel = {
  primary_spacing_mm: 450,
  furring_spacing_mm: 450,
  direction: "along_length",
};
const steelPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: steel,
  materialWastageSettings: WASTAGE,
});
const steelFix = steelPhysical.requirements.find(
  (row) => row.componentKey === CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT
);
const clipReq = steelPhysical.requirements.find(
  (row) => row.componentKey === CEILINGS_STEEL_CLIP_COMPONENT
);
check(
  "Q steel residual fixings basis exists without duplicating clips",
  steelFix != null &&
    steelFix.baseUnit === "lm" &&
    clipReq != null &&
    steelFix.componentKey !== CEILINGS_STEEL_CLIP_COMPONENT &&
    steelFix.specification.includes("excluding clips")
);

check(
  "R plasterboard fixing basis exists",
  timberPhysical.requirements.some(
    (row) =>
      row.componentKey === CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT &&
      row.baseUnit === "m2" &&
      row.priced === false
  )
);

const plywood = ordinaryPortion({ lining: "plywood" });
plywood.lining.plasterboard_product = undefined;
plywood.lining.thickness_mm = undefined;
plywood.lining.plywood_spec = "CD 12mm";
const plywoodPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: plywood,
  materialWastageSettings: WASTAGE,
});
check(
  "S plywood fixing basis distinct if required",
  plywoodPhysical.requirements.some(
    (row) => row.componentKey === CEILINGS_FIXINGS_PLYWOOD_COMPONENT
  ) &&
    !plywoodPhysical.requirements.some(
      (row) => row.componentKey === CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT
    )
);

const timberLined = ordinaryPortion({ lining: "timber_lined", length: 4, width: 3 });
timberLined.lining.plasterboard_product = undefined;
timberLined.lining.thickness_mm = undefined;
timberLined.lining.timber_lined = {
  board_width_mm: 90,
  gap_mm: 10,
  direction: "along_length",
};
const timberLinedPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: timberLined,
  materialWastageSettings: WASTAGE,
});
check(
  "T timber lining fixing basis exists",
  timberLinedPhysical.requirements.some(
    (row) =>
      row.componentKey === CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT &&
      row.baseUnit === "lm"
  )
);

const tile = ordinaryPortion({ lining: "tile_and_grid", area: 30 });
tile.structure.family = "tile_and_grid";
tile.lining.tile = { size: "600x600" };
tile.lining.plasterboard_product = undefined;
tile.lining.thickness_mm = undefined;
const tilePhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: tile,
  materialWastageSettings: WASTAGE,
});
check(
  "U Tile/Grid does not double-count grid standard fixings if rate is intended inclusive",
  !tilePhysical.requirements.some((row) =>
    row.componentKey.includes("fixings")
  ) &&
    CEILINGS_TILE_GRID_FIXINGS_DECISION.includes("No separate residual allowance")
);

const bulkheadPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: fixture,
  materialWastageSettings: WASTAGE,
});
check(
  "V bulkhead fixing bases exist",
  bulkheadPhysical.requirements.some(
    (row) => row.componentKey === CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT
  ) &&
    bulkheadPhysical.requirements.some(
      (row) => row.componentKey === CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT
    )
);

check(
  "W no fixings have money",
  bulkheadPhysical.requirements
    .filter((row) => row.componentKey.includes("fixings"))
    .every((row) => row.priced === false && row.unitCost == null && row.totalCost == null)
);

const fire = ordinaryPortion();
fire.fire_acoustic_requirement = "unknown_proprietary";
const firePhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: fire,
  materialWastageSettings: WASTAGE,
});
check(
  "X unsupported proprietary fire/acoustic system returns specialist state",
  firePhysical.portion.completeness ===
    CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    firePhysical.portion.specialistKind === "unknown_proprietary_fire" &&
    !firePhysical.requirements.some(
      (row) => row.componentKey === "ceilings.lining.plasterboard.material"
    )
);

const curved = ordinaryPortion();
curved.specialist_kind = "coffered";
const curvedPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: curved,
  materialWastageSettings: WASTAGE,
});
check(
  "Y curved/coffered/complex ceiling returns specialist state",
  curvedPhysical.portion.completeness ===
    CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    curvedPhysical.portion.specialistKind === "coffered"
);

const complete = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: ordinaryPortion({ length: 4, width: 3 }),
  materialWastageSettings: WASTAGE,
});
check(
  "Z physical-complete ordinary Portion reports complete",
  complete.portion.completeness === CEILING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    complete.portion.lining.status === "ok"
);

const missing = ordinaryPortion();
missing.lining.thickness_mm = undefined;
const missingPhysical = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: missing,
  materialWastageSettings: WASTAGE,
});
check(
  "AA missing included component returns INFORMATION_REQUIRED",
  missingPhysical.portion.completeness ===
    CEILING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);

check(
  "AB specialist Portion is not silently dropped",
  firePhysical.portion.nestedItemId === P1 &&
    islandPhysical.portion.nestedItemId === P1 &&
    islandPhysical.portion.bulkheads[0]?.status === "unsupported_specialist"
);

const mixedFacts = writePortions([
  ordinaryPortion({ id: P1, length: 4, width: 3 }),
  (() => {
    const row = ordinaryPortion({ id: P2, length: 4, width: 3 });
    row.specialist_kind = "curved";
    return row;
  })(),
]);
const mixed = calculateCeilingsPhysical({
  facts: mixedFacts,
  workArea: wa(),
  materialWastageSettings: WASTAGE,
});
check(
  "AC multi-Portion physical status rolls up correctly",
  mixed.portions.length === 2 &&
    mixed.portions[0]?.completeness ===
      CEILING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    mixed.portions[1]?.completeness ===
      CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    mixed.completeness === CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    mixed.portions[1]?.nestedItemId === P2
);

const ground = calculateCeilingsPhysical({
  facts: writePortions([ordinaryPortion({ id: P1, length: 4, width: 3 })], "c-ground"),
  workArea: wa("c-ground", "Ground Floor Ceilings"),
  materialWastageSettings: WASTAGE,
});
const garage = calculateCeilingsPhysical({
  facts: writePortions([ordinaryPortion({ id: P2, length: 4, width: 3 })], "c-garage"),
  workArea: wa("c-garage", "Garage Ceilings"),
  materialWastageSettings: WASTAGE,
});
check(
  "AD repeated WA provenance remains distinct",
  ground.workAreaId === "c-ground" &&
    garage.workAreaId === "c-garage" &&
    ground.requirements.every((row) => row.workAreaId === "c-ground") &&
    garage.requirements.every((row) => row.workAreaId === "c-garage")
);

check(
  "AE no Painting commercial scope emitted",
  !complete.requirements.some((row) =>
    row.componentKey.toLowerCase().includes("paint")
  )
);
check(
  "AF no Plastering commercial scope emitted",
  !complete.requirements.some((row) =>
    row.componentKey.toLowerCase().includes("stop")
  )
);
check(
  "AG no Demolition duplicate scope emitted",
  !complete.requirements.some((row) =>
    row.componentKey.toLowerCase().includes("demolition")
  )
);

const nestedHosted = calculateEstimate(
  estimateCtx(writePortions([ordinaryPortion({ length: 4, width: 3 })]))
);
check(
  "AH hosted guard still holds",
  nestedHosted.lineItems.length === 0 &&
    nestedHosted.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    !read("lib/estimate/calculators/fitout.ts").includes("calculateCeilingsPhysical")
);

const legacyFacts: EstimateFact[] = [
  { key: "ceilings.area_m2", work_area_id: "c1", value: 30 },
  { key: "ceilings.structure_type", work_area_id: "c1", value: "Existing structure" },
  { key: "ceilings.ceiling_type", work_area_id: "c1", value: "Plasterboard" },
];
const legacyEstimate = calculateEstimate(estimateCtx(legacyFacts));
const legacyPhysical = calculateCeilingsPhysical({
  facts: legacyFacts,
  workArea: wa(),
});
check(
  "AI legacy flat calculator unchanged",
  !hasCanonicalCeilingsPortions(legacyFacts, "c1") &&
    legacyEstimate.lineItems.length > 0 &&
    !legacyEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    legacyPhysical.source === "legacy_skipped" &&
    read("lib/estimate/calculators/fitout.ts").includes("LEGACY CEILINGS CALCULATOR")
);

check(
  "topology assumption visible",
  bh.topologyAssumption === CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION &&
    bulkheadPhysical.requirements.some((row) =>
      row.assumptions.some(
        (item) => item.text === CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION
      )
    )
);
check(
  "timber bulkhead uses shared 90x45 identity",
  bh.framingMaterialKey === INTERNAL_WALLS_TIMBER_90_KEY &&
    bulkheadPhysical.requirements.some(
      (row) =>
        row.componentKey === CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT &&
        row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY
    )
);
check(
  "steel bulkhead uses dedicated unresolved identity",
  (() => {
    const steelBh = ordinaryPortion();
    addStandardBulkhead(steelBh, { framing: "steel" });
    const takeoff = calculateCeilingBulkhead({
      portion: steelBh,
      bulkhead: steelBh.bulkheads[0]!,
      materialWastageSettings: WASTAGE,
    });
    return takeoff.framingMaterialKey === CEILING_BULKHEAD_STEEL_FRAMING_KEY;
  })()
);
check(
  "lining requirement present for bulkhead",
  bulkheadPhysical.requirements.some(
    (row) => row.componentKey === CEILINGS_BULKHEAD_LINING_COMPONENT
  )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * CEILINGS WA-04B — steel direct-fix + suspended steel physical calculator.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-04b.ts
 *
 * No lining, tile/grid, bulkhead, labour, or commercial money.
 * Preview only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  calculateCeilingsPhysical,
  ceilingRequirementNestedItemId,
} from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_NESTED_NOT_CALCULATED_MESSAGE,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  hasCanonicalCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import {
  calculateCeilingSteelFraming,
  calculateCeilingSuspendedFraming,
  calculateSteelCeilingFrame,
  CEILINGS_STEEL_CLIP_COMPONENT,
  CEILINGS_STEEL_FURRING_COMPONENT,
  CEILINGS_STEEL_PERIMETER_COMPONENT,
  CEILINGS_STEEL_PRIMARY_COMPONENT,
  CEILINGS_SUSPENSION_DROPPER_COMPONENT,
  CEILINGS_SUSPENSION_WIRE_COMPONENT,
  STEEL_CEILING_CROSSOVER_CLIP_KEY,
  STEEL_CEILING_DROPPER_KEY,
  STEEL_CEILING_FURRING_CHANNEL_KEY,
  STEEL_CEILING_PERIMETER_TRACK_KEY,
  STEEL_CEILING_PRIMARY_CHANNEL_KEY,
  STEEL_CEILING_SUSPENSION_WIRE_KEY,
} from "../lib/estimate/ceilings-steel";
import { supportPointsBetweenEdgeOffsets } from "../lib/estimate/support-points";
import { INTERNAL_WALLS_STEEL_STUD_KEY, INTERNAL_WALLS_STEEL_TRACK_KEY } from "../lib/estimate/internal-walls-identities";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

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

function near(
  actual: number | null | undefined,
  expected: number,
  epsilon = 1e-9
): boolean {
  return typeof actual === "number" && Math.abs(actual - expected) < epsilon;
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";

function steelPortion(params: {
  id?: string;
  label?: string;
  family?: "steel_direct_fix" | "suspended_steel";
  length?: number | null;
  width?: number | null;
  area?: number | null;
  mode?: "length_width" | "area_only";
  direction?: "along_length" | "along_width" | null;
  primaryMm?: number;
  furringMm?: number;
  dropHeightM?: number;
  maxSpacingM?: number;
  edgeOffsetM?: number;
  includeSteel?: boolean;
  includeSuspended?: boolean;
}): CeilingPortion {
  const portion = createEmptyCeilingPortion({
    id: params.id ?? P1,
    label: params.label ?? "Lounge",
  });
  portion.geometry.mode = params.mode ?? "length_width";
  portion.geometry.length_m = params.length ?? null;
  portion.geometry.width_m = params.width ?? null;
  portion.geometry.area_m2 = params.area ?? null;
  portion.structure.family = params.family ?? "steel_direct_fix";
  if (params.includeSteel !== false) {
    portion.structure.steel = {
      primary_spacing_mm: params.primaryMm ?? 450,
      furring_spacing_mm: params.furringMm ?? 450,
      direction: params.direction === undefined ? "along_length" : params.direction,
    };
  }
  if (params.family === "suspended_steel" && params.includeSuspended !== false) {
    portion.structure.suspended = {
      drop_height_m: params.dropHeightM ?? 0.6,
      max_spacing_m: params.maxSpacingM ?? 1.2,
      edge_offset_m: params.edgeOffsetM ?? 0.2,
    };
  }
  return portion;
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

function wa(id = "c1", name = "Ceilings"): EstimateWorkArea {
  return { id, type: "ceilings", name, sort_order: 1 };
}

function estimateCtx(
  facts: EstimateFact[],
  workArea: EstimateWorkArea = wa()
): EstimateContext {
  return {
    project: { id: "ceilings-wa-04b", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function byComponent<T extends { componentKey: string; variantKey?: string }>(
  requirements: readonly T[],
  componentKey: string,
  nestedItemId?: string
): T | undefined {
  return requirements.find(
    (row) =>
      row.componentKey === componentKey &&
      (nestedItemId == null || row.variantKey === nestedItemId)
  );
}

console.log("=== CEILINGS WA-04B steel direct-fix + suspended steel ===\n");

const direct = calculateCeilingSteelFraming(
  steelPortion({ length: 4, width: 3, direction: "along_length" })
);
check(
  "A direct steel 4×3 perimeter = 14 lm",
  direct.status === "ok" && direct.perimeterLm === 14
);
check(
  "B primary along length = 8 runs / 32 lm",
  direct.primaryRuns === 8 && direct.primaryLm === 32
);
check(
  "C furring = 10 runs / 30 lm",
  direct.furringRuns === 10 && direct.furringLm === 30
);
check("D clips = 80", direct.clipCount === 80);

const reversed = calculateCeilingSteelFraming(
  steelPortion({ length: 4, width: 3, direction: "along_width" })
);
check(
  "E reversed primary direction = 10 runs / 30 lm",
  reversed.primaryRuns === 10 && reversed.primaryLm === 30
);
check(
  "F reversed furring = 8 runs / 32 lm",
  reversed.furringRuns === 8 && reversed.furringLm === 32
);
check(
  "G reversed clips still = 80 and perimeter unchanged",
  reversed.clipCount === 80 && reversed.perimeterLm === 14
);

const suspended = calculateCeilingSuspendedFraming(
  steelPortion({
    family: "suspended_steel",
    length: 4,
    width: 3,
    direction: "along_length",
    dropHeightM: 0.6,
    maxSpacingM: 1.2,
    edgeOffsetM: 0.2,
  })
);
check(
  "H suspended base frame exactly equals direct steel base frame",
  suspended.status === "ok" &&
    suspended.frame.status === "ok" &&
    suspended.frame.perimeterLm === direct.perimeterLm &&
    suspended.frame.primaryRuns === direct.primaryRuns &&
    suspended.frame.primaryLm === direct.primaryLm &&
    suspended.frame.furringRuns === direct.furringRuns &&
    suspended.frame.furringLm === direct.furringLm &&
    suspended.frame.clipCount === direct.clipCount
);

const sharedFrame = calculateSteelCeilingFrame({
  nestedItemId: P1,
  lengthM: 4,
  widthM: 3,
  perimeterLm: 14,
  primarySpacingMm: 450,
  furringSpacingMm: 450,
  primaryDirection: "along_length",
});
check(
  "H shared calculateSteelCeilingFrame matches both families",
  sharedFrame.primaryRuns === 8 &&
    sharedFrame.furringRuns === 10 &&
    sharedFrame.clipCount === 80 &&
    read("lib/estimate/ceilings-steel.ts").includes(
      "calculateSteelCeilingFrameFromGeometry"
    ) &&
    read("lib/estimate/ceilings-steel.ts").includes(
      "calculateSteelCeilingFrame"
    )
);

check(
  "I 4×3 / 0.2 edge / 1.2 max → 4×4 support points",
  suspended.lengthSupport?.pointCount === 4 &&
    suspended.widthSupport?.pointCount === 4 &&
    suspended.lengthSupport?.intervalCount === 3 &&
    suspended.widthSupport?.intervalCount === 3 &&
    near(suspended.lengthSupport?.supportSpan, 3.6) &&
    near(suspended.widthSupport?.supportSpan, 2.6)
);
check("J dropper count = 16", suspended.dropperCount === 16);
check("K 0.6m drop → 9.6lm wire", suspended.wireLm === 9.6);
check(
  "K diagnostic actual spacing is derived, not a user fact",
  near(suspended.lengthSupport?.actualSpacing, 1.2) &&
    near(suspended.widthSupport?.actualSpacing, 2.6 / 3) &&
    !read("lib/estimate/ceilings-physical.ts").includes(
      "ceilings.portion.actual_support"
    )
);

const boundary = supportPointsBetweenEdgeOffsets(2.4, 0, 1.2);
check(
  "L exact support-spacing boundary has no phantom interval",
  boundary.ok &&
    boundary.intervalCount === 2 &&
    boundary.pointCount === 3 &&
    near(boundary.supportSpan, 2.4) &&
    near(boundary.actualSpacing, 1.2)
);
const boundaryInset = supportPointsBetweenEdgeOffsets(2.8, 0.2, 1.2);
check(
  "L inset 2.4m span / 1.2 max also 2 intervals / 3 points",
  boundaryInset.ok &&
    near(boundaryInset.supportSpan, 2.4) &&
    boundaryInset.intervalCount === 2 &&
    boundaryInset.pointCount === 3
);

const smallRoom = supportPointsBetweenEdgeOffsets(0.3, 0.2, 1.2);
check(
  "L small room D <= 2E uses one central support line",
  smallRoom.ok &&
    smallRoom.mode === "single_central" &&
    smallRoom.pointCount === 1 &&
    smallRoom.intervalCount === 0 &&
    smallRoom.supportSpan === 0 &&
    smallRoom.actualSpacing == null
);

const badDrop = calculateCeilingSuspendedFraming(
  steelPortion({
    family: "suspended_steel",
    length: 4,
    width: 3,
    dropHeightM: -0.6,
  })
);
check(
  "M invalid drop height rejected",
  badDrop.status === "invalid" && badDrop.dropperCount == null
);

const badMax = calculateCeilingSuspendedFraming(
  steelPortion({
    family: "suspended_steel",
    length: 4,
    width: 3,
    maxSpacingM: -1.2,
  })
);
check(
  "N invalid spacing rejected",
  badMax.status === "invalid" && badMax.dropperCount == null
);

const badEdge = calculateCeilingSuspendedFraming(
  steelPortion({
    family: "suspended_steel",
    length: 4,
    width: 3,
    edgeOffsetM: -0.2,
  })
);
check(
  "O invalid edge offset rejected",
  badEdge.status === "invalid" && badEdge.dropperCount == null
);

const missingDrop = calculateCeilingSuspendedFraming(
  steelPortion({
    family: "suspended_steel",
    length: 4,
    width: 3,
    includeSuspended: false,
  })
);
check(
  "M missing drop height is INFORMATION_REQUIRED, not a throw",
  missingDrop.status === "information_required" &&
    missingDrop.reason != null &&
    missingDrop.reason.toLowerCase().includes("drop height")
);

const missingDirection = calculateCeilingSteelFraming(
  steelPortion({ length: 4, width: 3, direction: null })
);
check(
  "steel_direct_fix without primary direction is INFORMATION_REQUIRED",
  missingDirection.status === "information_required" &&
    missingDirection.primaryRuns == null
);

const areaSteel = calculateCeilingSteelFraming(
  steelPortion({
    mode: "area_only",
    length: null,
    width: null,
    area: 12,
    family: "steel_direct_fix",
  })
);
check(
  "P area-only steel returns INFORMATION_REQUIRED",
  areaSteel.status === "information_required" &&
    areaSteel.primaryRuns == null &&
    areaSteel.perimeterLm == null
);

const areaSuspended = calculateCeilingSuspendedFraming(
  steelPortion({
    family: "suspended_steel",
    mode: "area_only",
    length: null,
    width: null,
    area: 12,
  })
);
check(
  "Q area-only suspended returns INFORMATION_REQUIRED",
  areaSuspended.status === "information_required" &&
    areaSuspended.dropperCount == null &&
    areaSuspended.frame.primaryRuns == null
);

const tile = createEmptyCeilingPortion({ id: P1, label: "Grid" });
tile.structure.family = "tile_and_grid";
tile.geometry.mode = "length_width";
tile.geometry.length_m = 4;
tile.geometry.width_m = 3;
tile.structure.steel = {
  primary_spacing_mm: 450,
  furring_spacing_mm: 450,
  direction: "along_length",
};
tile.structure.suspended = {
  drop_height_m: 0.6,
  max_spacing_m: 1.2,
  edge_offset_m: 0.2,
};
const tileSteel = calculateCeilingSteelFraming(tile);
const tileSusp = calculateCeilingSuspendedFraming(tile);
const tilePhysical = calculateCeilingsPhysical({
  facts: writePortions([tile]),
  workArea: wa(),
});
check(
  "R tile_and_grid emits no steel/suspension frame",
  tileSteel.status === "not_applicable" &&
    tileSusp.status === "not_applicable" &&
    tilePhysical.requirements.every(
      (row) =>
        !row.componentKey.startsWith("ceilings.framing.steel") &&
        !row.componentKey.startsWith("ceilings.suspension")
    )
);

const timber = createEmptyCeilingPortion({ id: P1, label: "Timber" });
timber.structure.family = "timber_direct_fix";
timber.geometry.mode = "length_width";
timber.geometry.length_m = 4;
timber.geometry.width_m = 3;
timber.structure.timber = {
  size: "140x45_h1.2",
  spacing_mm: 450,
  direction: "along_length",
};
timber.structure.steel = {
  primary_spacing_mm: 450,
  furring_spacing_mm: 450,
  direction: "along_length",
};
const timberSteel = calculateCeilingSteelFraming(timber);
check(
  "S timber emits no steel",
  timberSteel.status === "not_applicable" && timberSteel.clipCount == null
);

const existing = createEmptyCeilingPortion({ id: P1, label: "Existing" });
existing.structure.family = "existing_framing";
existing.geometry.mode = "area_only";
existing.geometry.area_m2 = 12;
existing.structure.steel = {
  primary_spacing_mm: 450,
  furring_spacing_mm: 450,
  direction: "along_length",
};
const existingSteel = calculateCeilingSteelFraming(existing);
check(
  "T existing framing emits no steel",
  existingSteel.status === "not_applicable" && existingSteel.clipCount == null
);

const physicalDirect = calculateCeilingsPhysical({
  facts: writePortions([
    steelPortion({
      id: P1,
      length: 4,
      width: 3,
      direction: "along_length",
    }),
  ]),
  workArea: wa(),
});
const perimeterReq = byComponent(
  physicalDirect.requirements,
  CEILINGS_STEEL_PERIMETER_COMPONENT,
  P1
);
const primaryReq = byComponent(
  physicalDirect.requirements,
  CEILINGS_STEEL_PRIMARY_COMPONENT,
  P1
);
const furringReq = byComponent(
  physicalDirect.requirements,
  CEILINGS_STEEL_FURRING_COMPONENT,
  P1
);
const clipReq = byComponent(
  physicalDirect.requirements,
  CEILINGS_STEEL_CLIP_COMPONENT,
  P1
);
check(
  "U requirements preserve nestedItemId",
  physicalDirect.portions[0]?.nestedItemId === P1 &&
    ceilingRequirementNestedItemId(perimeterReq!) === P1 &&
    perimeterReq?.variantKey === P1 &&
    primaryReq?.variantKey === P1 &&
    furringReq?.variantKey === P1 &&
    clipReq?.variantKey === P1
);
check(
  "V requirements preserve workAreaId",
  physicalDirect.portions[0]?.workAreaId === "c1" &&
    physicalDirect.requirements.every((row) => row.workAreaId === "c1")
);

check(
  "direct steel fixture quantities on requirements",
    perimeterReq?.baseQuantity === 14 &&
    perimeterReq?.baseUnit === "lm" &&
    primaryReq?.baseQuantity === 32 &&
    furringReq?.baseQuantity === 30 &&
    clipReq?.baseQuantity === 80 &&
    clipReq?.baseUnit === "each" &&
    perimeterReq?.materialKey === STEEL_CEILING_PERIMETER_TRACK_KEY &&
    primaryReq?.materialKey === STEEL_CEILING_PRIMARY_CHANNEL_KEY &&
    furringReq?.materialKey === STEEL_CEILING_FURRING_CHANNEL_KEY &&
    clipReq?.materialKey === STEEL_CEILING_CROSSOVER_CLIP_KEY &&
    perimeterReq?.materialKey !== INTERNAL_WALLS_STEEL_TRACK_KEY &&
    primaryReq?.materialKey !== INTERNAL_WALLS_STEEL_STUD_KEY
);

const physicalSuspended = calculateCeilingsPhysical({
  facts: writePortions([
    steelPortion({
      id: P1,
      family: "suspended_steel",
      length: 4,
      width: 3,
      direction: "along_length",
      dropHeightM: 0.6,
      maxSpacingM: 1.2,
      edgeOffsetM: 0.2,
    }),
  ]),
  workArea: wa(),
});
const dropperReq = byComponent(
  physicalSuspended.requirements,
  CEILINGS_SUSPENSION_DROPPER_COMPONENT,
  P1
);
const wireReq = byComponent(
  physicalSuspended.requirements,
  CEILINGS_SUSPENSION_WIRE_COMPONENT,
  P1
);
check(
  "suspended fixture requirements: 16 droppers / 9.6 lm wire",
  physicalSuspended.portions[0]?.suspended.dropperCount === 16 &&
    dropperReq?.baseQuantity === 16 &&
    dropperReq?.baseUnit === "each" &&
    wireReq?.baseQuantity === 9.6 &&
    wireReq?.baseUnit === "lm" &&
    dropperReq?.materialKey === STEEL_CEILING_DROPPER_KEY &&
    wireReq?.materialKey === STEEL_CEILING_SUSPENSION_WIRE_KEY &&
    byComponent(
      physicalSuspended.requirements,
      CEILINGS_STEEL_PERIMETER_COMPONENT,
      P1
    )?.baseQuantity === 14
);

check(
  "installed quantity equals purchase; waste unresolved",
  physicalDirect.requirements.every(
    (row) =>
      row.wasteFactor === 0 &&
      row.purchaseQuantity === row.baseQuantity &&
      row.priced === false &&
      row.unitCost == null
  ) &&
    physicalSuspended.requirements.every(
      (row) =>
        row.wasteFactor === 0 &&
        row.purchaseQuantity === row.baseQuantity &&
        row.priced === false
    ) &&
    read("lib/estimate/ceilings-physical.ts").includes(
      "wastage remains unresolved"
    )
);

const mixed = calculateCeilingsPhysical({
  facts: writePortions([
    steelPortion({
      id: P1,
      label: "Direct lounge",
      family: "steel_direct_fix",
      length: 4,
      width: 3,
    }),
    steelPortion({
      id: P2,
      label: "Suspended hall",
      family: "suspended_steel",
      length: 4,
      width: 3,
      dropHeightM: 0.6,
      maxSpacingM: 1.2,
      edgeOffsetM: 0.2,
    }),
  ]),
  workArea: wa(),
});
function isFixingsAllowance(row: { componentKey: string }): boolean {
  return row.componentKey.startsWith("ceilings.fixings.");
}
const mixedA = mixed.requirements.filter(
  (row) => row.variantKey === P1 && !isFixingsAllowance(row)
);
const mixedB = mixed.requirements.filter(
  (row) => row.variantKey === P2 && !isFixingsAllowance(row)
);
check(
  "W multi-Portion steel/suspended remain distinct",
  mixed.portions.length === 2 &&
    mixed.portions[0]?.nestedItemId === P1 &&
    mixed.portions[1]?.nestedItemId === P2 &&
    mixedA.length === 4 &&
    mixedB.length === 6 &&
    mixedA.every((row) => !row.componentKey.startsWith("ceilings.suspension")) &&
    mixedB.some((row) => row.componentKey === CEILINGS_SUSPENSION_DROPPER_COMPONENT) &&
    mixedA[0]?.requirementId !== mixedB[0]?.requirementId
);

const groundFacts = writePortions(
  [
    steelPortion({
      id: P1,
      family: "steel_direct_fix",
      length: 4,
      width: 3,
    }),
  ],
  "c-ground"
);
const garageFacts = writePortions(
  [
    steelPortion({
      id: P2,
      family: "suspended_steel",
      length: 4,
      width: 3,
    }),
  ],
  "c-garage"
);
const ground = calculateCeilingsPhysical({
  facts: [...groundFacts, ...garageFacts],
  workArea: wa("c-ground", "Ground Floor Ceilings"),
});
const garage = calculateCeilingsPhysical({
  facts: [...groundFacts, ...garageFacts],
  workArea: wa("c-garage", "Garage Ceilings"),
});
check(
  "X repeated Ceiling WAs remain distinct",
  ground.workAreaId === "c-ground" &&
    garage.workAreaId === "c-garage" &&
    ground.requirements.every((row) => row.workAreaId === "c-ground") &&
    garage.requirements.every((row) => row.workAreaId === "c-garage") &&
    ground.portions[0]?.steel.clipCount === 80 &&
    garage.portions[0]?.suspended.dropperCount === 16 &&
    !ground.requirements.some(
      (row) => row.componentKey === CEILINGS_SUSPENSION_DROPPER_COMPONENT
    )
);

const twoDirect = calculateCeilingsPhysical({
  facts: writePortions([
    steelPortion({ id: P1, label: "A", length: 4, width: 3 }),
    steelPortion({ id: P2, label: "B", length: 4, width: 3 }),
  ]),
  workArea: wa(),
});
const twoPerimeters = twoDirect.requirements.filter(
  (row) => row.componentKey === CEILINGS_STEEL_PERIMETER_COMPONENT
);
check(
  "Y no physical-level aggregation",
  twoPerimeters.length === 2 &&
    twoPerimeters[0]?.baseQuantity === 14 &&
    twoPerimeters[1]?.baseQuantity === 14 &&
    twoPerimeters[0]?.requirementId !== twoPerimeters[1]?.requirementId &&
    twoPerimeters[0]?.variantKey !== twoPerimeters[1]?.variantKey &&
    twoDirect.requirements.filter((row) => !isFixingsAllowance(row)).length ===
      8
);

const nestedHosted = calculateEstimate(
  estimateCtx(
    writePortions([
      steelPortion({
        id: P1,
        family: "suspended_steel",
        length: 4,
        width: 3,
      }),
    ])
  )
);
check(
  "Z nested Ceiling uses the new engine, never the temporary guard",
  hasCanonicalCeilingsPortions(writePortions([steelPortion({})]), "c1") &&
    nestedHosted.lineItems.length > 0 &&
    !nestedHosted.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    !nestedHosted.lineItems.some((item) =>
      /materials allowance/i.test(item.label)
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes(
      "calculateCeilingsPhysical"
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes("commercializeCeilings")
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
  "AA legacy flat calculator unchanged",
  !hasCanonicalCeilingsPortions(legacyFacts, "c1") &&
    legacyEstimate.lineItems.length > 0 &&
    !legacyEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    legacyPhysical.source === "legacy_skipped" &&
    legacyPhysical.requirements.length === 0 &&
    read("lib/estimate/calculators/fitout.ts").includes(
      "export function calculateCeilings"
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes(
      "LEGACY CEILINGS CALCULATOR"
    )
);

const persistedSuspended = writePortions([
  steelPortion({
    id: P1,
    family: "suspended_steel",
    length: 4,
    width: 3,
    direction: "along_length",
  }),
]);
const afterPersist = calculateCeilingsPhysical({
  facts: persistedSuspended,
  workArea: wa(),
});
check(
  "suspended persist keeps steel sub-object for the shared frame",
  afterPersist.portions[0]?.steel.status === "not_applicable" &&
    afterPersist.portions[0]?.suspended.status === "ok" &&
    afterPersist.portions[0]?.suspended.frame.primaryRuns === 8 &&
    afterPersist.portions[0]?.suspended.dropperCount === 16
);

check(
  "no 450 mm invention in the steel calculator",
  !read("lib/estimate/ceilings-steel.ts").includes("?? 450") &&
    !read("lib/estimate/ceilings-steel.ts").includes("= 450") &&
    !read("lib/estimate/support-points.ts").includes("450")
);

check(
  "support helper is dedicated, not an overload of runCountFromSpacing",
  read("lib/estimate/support-points.ts").includes(
    "export function supportPointsBetweenEdgeOffsets"
  ) &&
    !read("lib/estimate/run-count.ts").includes("edgeOffset") &&
    read("lib/estimate/ceilings-steel.ts").includes(
      "supportPointsBetweenEdgeOffsets"
    )
);

check(
  "catalogue identities are ceiling-specific, unpriced, not partition SKUs",
  read("lib/rates/specific-material-catalogue.ts").includes(
    STEEL_CEILING_PERIMETER_TRACK_KEY
  ) &&
    read("lib/rates/specific-material-catalogue.ts").includes(
      STEEL_CEILING_PRIMARY_CHANNEL_KEY
    ) &&
    read("lib/rates/specific-material-catalogue.ts").includes(
      STEEL_CEILING_FURRING_CHANNEL_KEY
    ) &&
    read("lib/rates/specific-material-catalogue.ts").includes(
      STEEL_CEILING_CROSSOVER_CLIP_KEY
    ) &&
    read("lib/rates/specific-material-catalogue.ts").includes(
      STEEL_CEILING_DROPPER_KEY
    ) &&
    read("lib/rates/specific-material-catalogue.ts").includes(
      STEEL_CEILING_SUSPENSION_WIRE_KEY
    ) &&
    read("lib/rates/specific-material-catalogue.ts").includes(
      "CEILING_STEEL_SPECIFIC_MATERIAL_CATALOGUE"
    ) &&
    !/item_key: "steel\.ceiling\.[^"]+"[\s\S]{0,400}defaultCostRate/.test(
      read("lib/rates/specific-material-catalogue.ts")
    )
);

check(
  "no labour productivity in this slice",
  !read("lib/estimate/ceilings-steel.ts").includes("hoursPer") &&
    !read("lib/estimate/ceilings-physical.ts").includes("hoursPer") &&
    !read("lib/estimate/ceilings-physical.ts").includes("priced: true")
);

const helperInvalid = supportPointsBetweenEdgeOffsets(4, -0.2, 1.2);
check(
  "support helper rejects negative edge offset without clamping",
  !helperInvalid.ok && helperInvalid.reason === "invalid"
);

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} CEILINGS WA-04B checks passed.`);

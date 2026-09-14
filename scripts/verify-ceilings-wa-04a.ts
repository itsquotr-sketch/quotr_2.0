/**
 * CEILINGS WA-04A — geometry + timber direct-fix physical calculator.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-04a.ts
 *
 * No commercial pricing. No lining/steel/suspended/tile/bulkhead takeoff.
 * Preview only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { deriveCeilingGeometry } from "../lib/estimate/ceilings-geometry";
import {
  calculateCeilingTimberFraming,
  CEILINGS_TIMBER_FRAMING_COMPONENT,
} from "../lib/estimate/ceilings-framing";
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
import { INTERNAL_WALLS_TIMBER_140_KEY } from "../lib/estimate/internal-walls-identities";
import { runCountFromSpacing } from "../lib/estimate/run-count";
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

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";

function timberPortion(params: {
  id?: string;
  label?: string;
  length?: number | null;
  width?: number | null;
  area?: number | null;
  mode?: "length_width" | "area_only";
  family?: CeilingPortion["structure"]["family"];
  spacing?: number;
  direction?: "along_length" | "along_width";
  size?: "140x45_h1.2" | "other";
}): CeilingPortion {
  const portion = createEmptyCeilingPortion({
    id: params.id ?? P1,
    label: params.label ?? "Lounge",
  });
  portion.geometry.mode = params.mode ?? "length_width";
  portion.geometry.length_m = params.length ?? null;
  portion.geometry.width_m = params.width ?? null;
  portion.geometry.area_m2 = params.area ?? null;
  portion.structure.family = params.family ?? "timber_direct_fix";
  if (portion.structure.family === "timber_direct_fix") {
    portion.structure.timber = {
      size: params.size ?? "140x45_h1.2",
      spacing_mm: params.spacing ?? 450,
      direction: params.direction ?? "along_length",
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
    project: { id: "ceilings-wa-04a", qualityLevel: "standard" },
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

console.log("=== CEILINGS WA-04A geometry + timber direct-fix ===\n");

const geo43 = deriveCeilingGeometry(
  timberPortion({ length: 4, width: 3, family: "timber_direct_fix" })
);
check("A 4×3 geometry → 12m²", geo43.status === "ok" && geo43.area_m2 === 12);
check(
  "B 4×3 geometry → 14lm perimeter",
  geo43.perimeter_lm === 14 && geo43.length_m === 4 && geo43.width_m === 3
);

const areaOnly = deriveCeilingGeometry(
  timberPortion({
    mode: "area_only",
    length: null,
    width: null,
    area: 12,
    family: "existing_framing",
  })
);
check(
  "C area-only 12m² remains 12m² with no invented dimensions",
  areaOnly.status === "ok" &&
    areaOnly.area_m2 === 12 &&
    areaOnly.length_m == null &&
    areaOnly.width_m == null &&
    areaOnly.perimeter_lm == null
);

const zero = deriveCeilingGeometry(
  timberPortion({ length: 0, width: 3 })
);
const negative = deriveCeilingGeometry(
  timberPortion({ length: 4, width: -3 })
);
const nanGeo = deriveCeilingGeometry(
  timberPortion({ length: Number.NaN, width: 3 })
);
const lengthOnly = deriveCeilingGeometry(
  timberPortion({ length: 4, width: null })
);
check(
  "D invalid zero/negative geometry rejected",
  zero.status === "invalid" &&
    negative.status === "invalid" &&
    nanGeo.status === "invalid" &&
    lengthOnly.status === "invalid" &&
    zero.area_m2 == null &&
    negative.perimeter_lm == null
);

const alongLength = calculateCeilingTimberFraming(
  timberPortion({ length: 4, width: 3, spacing: 450, direction: "along_length" })
);
check(
  "E timber 4×3 / 450 / along_length → 8 runs / 32lm",
  alongLength.status === "ok" &&
    alongLength.numberOfRuns === 8 &&
    alongLength.installedFramingLM === 32 &&
    alongLength.spacing_m === 0.45 &&
    alongLength.runDimension_m === 4 &&
    alongLength.crossDimension_m === 3
);

const alongWidth = calculateCeilingTimberFraming(
  timberPortion({ length: 4, width: 3, spacing: 450, direction: "along_width" })
);
check(
  "F timber 4×3 / 450 / along_width → 10 runs / 30lm",
  alongWidth.status === "ok" &&
    alongWidth.numberOfRuns === 10 &&
    alongWidth.installedFramingLM === 30 &&
    alongWidth.runDimension_m === 3 &&
    alongWidth.crossDimension_m === 4
);

const centres600 = calculateCeilingTimberFraming(
  timberPortion({ length: 4, width: 3, spacing: 600, direction: "along_length" })
);
check(
  "G timber 4×3 / 600 / along_length → 6 runs / 24lm",
  centres600.status === "ok" &&
    centres600.numberOfRuns === 6 &&
    centres600.installedFramingLM === 24
);

check(
  "H exact spacing boundary does not generate an extra phantom run",
  runCountFromSpacing(1.2, 0.4) === 4 &&
    runCountFromSpacing(4.5, 0.45) === 11 &&
    runCountFromSpacing(3, 0.5) === 7 &&
    calculateCeilingTimberFraming(
      timberPortion({
        length: 4.5,
        width: 3,
        spacing: 450,
        direction: "along_width",
      })
    ).numberOfRuns === 11
);

const existing = calculateCeilingTimberFraming(
  timberPortion({
    length: 4,
    width: 3,
    family: "existing_framing",
  })
);
check(
  "I existing_framing → no timber framing requirement",
  existing.status === "not_applicable" &&
    existing.installedFramingLM == null &&
    existing.numberOfRuns == null
);

const tile = createEmptyCeilingPortion({ id: P1, label: "Grid" });
tile.geometry.mode = "length_width";
tile.geometry.length_m = 4;
tile.geometry.width_m = 3;
tile.structure.family = "tile_and_grid";
tile.structure.timber = {
  size: "140x45_h1.2",
  spacing_mm: 450,
  direction: "along_length",
};
const tileFraming = calculateCeilingTimberFraming(tile);
check(
  "J tile_and_grid → no timber framing requirement",
  tileFraming.status === "not_applicable" &&
    tileFraming.installedFramingLM == null
);

const steel = calculateCeilingTimberFraming(
  timberPortion({ length: 4, width: 3, family: "steel_direct_fix" })
);
check(
  "K steel_direct_fix → no timber requirement from WA-04A",
  steel.status === "not_applicable" && steel.installedFramingLM == null
);

const suspended = calculateCeilingTimberFraming(
  timberPortion({ length: 4, width: 3, family: "suspended_steel" })
);
check(
  "L suspended_steel → no timber requirement from WA-04A",
  suspended.status === "not_applicable" && suspended.installedFramingLM == null
);

const custom = calculateCeilingTimberFraming(
  timberPortion({
    length: 4,
    width: 3,
    spacing: 450,
    direction: "along_length",
    size: "other",
  })
);
check(
  "M custom/other timber remains unresolved/custom, not silently mapped",
  custom.status === "ok" &&
    custom.installedFramingLM === 32 &&
    custom.product.kind === "custom" &&
    custom.product.materialKey == null &&
    custom.product.materialKey !== INTERNAL_WALLS_TIMBER_140_KEY
);

const physical = calculateCeilingsPhysical({
  facts: writePortions([
    timberPortion({
      id: P1,
      length: 4,
      width: 3,
      spacing: 450,
      direction: "along_length",
    }),
  ]),
  workArea: wa(),
});
const req = physical.requirements[0];
check(
  "N physical requirement retains workAreaId",
  req?.workAreaId === "c1" && physical.portions[0]?.workAreaId === "c1"
);
check(
  "O physical requirement retains nestedItemId",
  physical.portions[0]?.nestedItemId === P1 &&
    ceilingRequirementNestedItemId(req!) === P1 &&
    req?.variantKey === P1 &&
    req?.componentKey === CEILINGS_TIMBER_FRAMING_COMPONENT
);

const two = calculateCeilingsPhysical({
  facts: writePortions([
    timberPortion({
      id: P1,
      label: "Lounge",
      length: 4,
      width: 3,
      spacing: 450,
      direction: "along_length",
    }),
    timberPortion({
      id: P2,
      label: "Hall",
      length: 9,
      width: 1.5,
      spacing: 450,
      direction: "along_length",
    }),
  ]),
  workArea: wa(),
});
check(
  "P two Portions stay physically distinct",
  two.portions.length === 2 &&
    two.requirements.length === 2 &&
    two.portions[0]?.nestedItemId === P1 &&
    two.portions[1]?.nestedItemId === P2 &&
    two.portions[0]?.timber.installedFramingLM === 32 &&
    two.portions[1]?.timber.numberOfRuns ===
      runCountFromSpacing(1.5, 0.45) &&
    two.requirements[0]?.variantKey !== two.requirements[1]?.variantKey
);

const groundFacts = writePortions(
  [
    timberPortion({
      id: P1,
      length: 4,
      width: 3,
      spacing: 450,
      direction: "along_length",
    }),
  ],
  "c-ground"
);
const garageFacts = writePortions(
  [
    timberPortion({
      id: P2,
      length: 4,
      width: 3,
      spacing: 600,
      direction: "along_length",
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
  "Q repeated Ceiling WAs stay work-area distinct",
  ground.workAreaId === "c-ground" &&
    garage.workAreaId === "c-garage" &&
    ground.requirements[0]?.workAreaId === "c-ground" &&
    garage.requirements[0]?.workAreaId === "c-garage" &&
    ground.portions[0]?.timber.installedFramingLM === 32 &&
    garage.portions[0]?.timber.installedFramingLM === 24
);

check(
  "R no physical-level same-product collapse",
  two.requirements.length === 2 &&
    two.requirements[0]?.materialKey === INTERNAL_WALLS_TIMBER_140_KEY &&
    two.requirements[1]?.materialKey === INTERNAL_WALLS_TIMBER_140_KEY &&
    two.requirements[0]?.baseQuantity === 32 &&
    two.requirements[1]?.baseQuantity !== 32 &&
    two.requirements[0]?.requirementId !== two.requirements[1]?.requirementId
);

const nestedHosted = calculateEstimate(
  estimateCtx(
    writePortions([
      timberPortion({
        id: P1,
        length: 4,
        width: 3,
        spacing: 450,
        direction: "along_length",
      }),
    ])
  )
);
check(
  "S no hosted nested Ceiling estimate bypasses the temporary guard",
  hasCanonicalCeilingsPortions(writePortions([timberPortion({})]), "c1") &&
    nestedHosted.lineItems.length === 0 &&
    nestedHosted.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    !nestedHosted.lineItems.some((item) => item.quantity === 32) &&
    !read("lib/estimate/calculators/fitout.ts").includes(
      "calculateCeilingsPhysical"
    ) &&
    !read("lib/estimate/calculators/fitout.ts").includes("ceilings-physical")
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
  "T legacy flat Ceiling estimator behavior unchanged",
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

check(
  "installed quantity is preserved without a waste percent",
  req?.baseQuantity === 32 &&
    req?.purchaseQuantity === 32 &&
    req?.wasteFactor === 0 &&
    req?.priced === false &&
    req?.unitCost == null &&
    req?.kind === "material" &&
    req?.materialKey === INTERNAL_WALLS_TIMBER_140_KEY
);

check(
  "run-count helper is reused, not copied",
  read("lib/estimate/ceilings-framing.ts").includes("runCountFromSpacing") &&
    !read("lib/estimate/ceilings-framing.ts").includes("Math.ceil(") &&
    read("lib/estimate/ceilings-framing.ts").includes("/ 1000")
);

check(
  "no nogging / lining takeoff in WA-04A timber kernel",
  !read("lib/estimate/ceilings-framing.ts").includes("nogging") &&
    !read("lib/estimate/ceilings-framing.ts").includes("recommendedNoggingRows") &&
    !read("lib/estimate/ceilings-framing.ts").includes("dropper") &&
    !read("lib/estimate/ceilings-physical.ts").includes("calculateSheetCount") &&
    !read("lib/estimate/ceilings-physical.ts").includes("hoursPer") &&
    !read("lib/estimate/ceilings-physical.ts").includes("priced: true")
);

const timberAreaOnly = calculateCeilingTimberFraming(
  timberPortion({
    mode: "area_only",
    length: null,
    width: null,
    area: 12,
    family: "timber_direct_fix",
  })
);
check(
  "area-only timber is information-required, not a square room",
  timberAreaOnly.status === "information_required" &&
    timberAreaOnly.numberOfRuns == null &&
    timberAreaOnly.installedFramingLM == null
);

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} CEILINGS WA-04A checks passed.`);

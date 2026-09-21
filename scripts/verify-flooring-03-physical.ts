/**
 * FLOORING-03 — nested physical takeoff and requirement ownership.
 *
 * Run: npx --yes tsx scripts/verify-flooring-03-physical.ts
 *
 * No paid AI. No Production. No COST rates. No productivity hours. No waste.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "../lib/estimate/bathroom-identities";
import { bathroomSheetTakeoff } from "../lib/estimate/bathroom-linings";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import {
  calculateDoors,
  calculateFlooring,
} from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  FLOORING_CARPET_REMOVE_HOURS_PER_M2,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  isFlooringSubstrateSheetKey,
  isOrdinaryFlooringFinishPackageKey,
} from "../lib/estimate/flooring-identities";
import {
  calculateFlooringPhysical,
  FLOORING_NESTED_NOT_YET_PRICED_STATEMENT,
  FLOORING_PHYSICAL_COMPLETENESS,
  flooringHardwoodTakeoff,
  flooringSubstrateSheetCount,
  flooringTileTakeoff,
  physicalNetAreaM2,
  requirementsForNestedItem,
  summariseFlooringPhysicalPortion,
} from "../lib/estimate/flooring-physical";
import {
  createEmptyFlooringPortion,
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import { applyDoorsFactWrite, DOORS_PORTIONS_FACT_KEY } from "../lib/estimate/doors-portions";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateRequirement } from "../lib/estimate/requirements";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";

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

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
};

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "user",
    },
  ];
}

function ctx(
  facts: EstimateFact[],
  workAreas: EstimateWorkArea[] = [WA]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
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

function ordinary(patch: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    ...createEmptyFlooringPortion({
      id: patch.id ?? "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: patch.label ?? "Living",
    }),
    finish_type: "carpet",
    area_input_method: "direct_m2",
    area_m2: 24,
    underlay_required: true,
    substrate_required: false,
    framing_required: false,
    finish_removal_required: false,
    ...patch,
  };
}

function physical(portions: readonly FlooringPortion[]) {
  return calculateFlooringPhysical({
    facts: persist(portions),
    workArea: WA,
  });
}

function materials(reqs: readonly EstimateRequirement[]) {
  return reqs.filter((row) => row.kind === "material");
}

function labour(reqs: readonly EstimateRequirement[]) {
  return reqs.filter((row) => row.kind === "labour");
}

function subcontracts(reqs: readonly EstimateRequirement[]) {
  return reqs.filter((row) => row.kind === "subcontract");
}

function byComponent(
  reqs: readonly EstimateRequirement[],
  componentKey: string
) {
  return reqs.filter((row) => row.componentKey === componentKey);
}

function byMaterialKey(
  reqs: readonly EstimateRequirement[],
  materialKey: string
) {
  return materials(reqs).filter((row) => row.materialKey === materialKey);
}

function hay(req: EstimateRequirement): string {
  const specification = req.kind === "material" ? req.specification ?? "" : "";
  const materialKey = req.kind === "material" ? req.materialKey ?? "" : "";
  return [
    req.description,
    req.componentKey,
    materialKey,
    specification,
    req.kind === "labour" ? req.productivityBasis.key : "",
  ]
    .join(" ")
    .toLowerCase();
}

function hasMoney(req: EstimateRequirement): boolean {
  if (req.priced) return true;
  if (req.kind === "material") {
    return req.unitCost != null || req.totalCost != null || req.wasteFactor !== 0;
  }
  if (req.kind === "labour") {
    return (
      req.hourlyCost != null ||
      req.totalCost != null ||
      req.baseHours !== 0 ||
      req.adjustedHours !== 0 ||
      req.productivityBasis.hoursPerUnit !== 0
    );
  }
  if (req.kind === "subcontract") {
    return (
      req.allowanceCost != null ||
      req.quotedCost != null ||
      req.totalCost != null
    );
  }
  return false;
}

console.log("=== FLOORING-03 area basis ===\n");

const direct = ordinary({ area_input_method: "direct_m2", area_m2: 18.5 });
check(
  "1. Direct area is the entered net area",
  physicalNetAreaM2(direct) === 18.5
);

const lxw = ordinary({
  area_input_method: "length_width",
  length_m: 5.2,
  width_m: 3.5,
  area_m2: 99,
});
check(
  "2. Length/width is L × W and ignores stale direct area",
  physicalNetAreaM2(lxw) === 5.2 * 3.5
);

const staleLw = ordinary({
  area_input_method: "direct_m2",
  area_m2: 12,
  length_m: 9,
  width_m: 9,
});
check(
  "3. Direct method ignores stale length/width",
  physicalNetAreaM2(staleLw) === 12
);

const tileDimsAsRoom = ordinary({
  finish_type: "tile",
  area_input_method: "direct_m2",
  area_m2: 10,
  tile_width_mm: 600,
  tile_length_mm: 600,
  floor_preparation_required: false,
});
check(
  "4. Tile product dimensions are not room dimensions",
  physicalNetAreaM2(tileDimsAsRoom) === 10 &&
    physicalNetAreaM2({
      ...tileDimsAsRoom,
      area_input_method: "length_width",
      length_m: null,
      width_m: null,
    }) == null
);

check(
  "5. Unanswered method does not infer area",
  physicalNetAreaM2({
    ...ordinary(),
    area_input_method: null,
    area_m2: 20,
    length_m: 4,
    width_m: 5,
  }) == null
);

const shared = physical([
  ordinary({
    id: "share-a",
    area_m2: 11.11,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    framing_required: true,
    framing_allowance_level: "minor",
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: true,
  }),
]);
const sharedArea = shared.portions[0]?.physicalNetAreaM2;
check(
  "6. One area helper feeds every requirement",
  sharedArea === 11.11 &&
    shared.requirements.length > 0 &&
    shared.requirements.every((row) =>
      row.assumptions.some(
        (assumption) =>
          assumption.key === "physical_net_area_m2" &&
          assumption.text.includes("11.11")
      )
    )
);

console.log("\n=== FLOORING-03 finish takeoff ===\n");

const carpetYes = physical([ordinary({ underlay_required: true, area_m2: 24 })]);
check(
  "7. Carpet package and underlay use net area",
  carpetYes.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    byComponent(carpetYes.requirements, FLOORING_CARPET_SUPPLY_INSTALL_M2).some(
      (row) => row.kind === "subcontract"
    ) &&
    byMaterialKey(carpetYes.requirements, FLOORING_CARPET_SUPPLY_INSTALL_M2)[0]
      ?.baseQuantity === 24 &&
    byMaterialKey(
      carpetYes.requirements,
      FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2
    )[0]?.baseQuantity === 24
);

const carpetNo = physical([ordinary({ underlay_required: false })]);
check(
  "8. Carpet underlay No emits no underlay requirement",
  byComponent(carpetNo.requirements, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)
    .length === 0
);

const carpetAsk = physical([ordinary({ underlay_required: null })]);
check(
  "9. Unanswered underlay is information required",
  carpetAsk.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    carpetAsk.requirements.length === 0
);

const vinylYes = physical([
  ordinary({
    finish_type: "vinyl_plank",
    underlay_required: null,
    floor_preparation_required: true,
    area_m2: 16,
  }),
]);
check(
  "10. Vinyl package and preparation use net area",
  byMaterialKey(vinylYes.requirements, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2)[0]
    ?.baseQuantity === 16 &&
    byMaterialKey(
      vinylYes.requirements,
      FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
    )[0]?.baseQuantity === 16 &&
    materials(vinylYes.requirements).every(
      (row) => row.purchaseUnit === "m2" || row.purchaseUnit === "each"
    ) &&
    !vinylYes.requirements.some(
      (row) => row.kind === "material" && row.purchaseUnit === "carton"
    )
);

const vinylNo = physical([
  ordinary({
    finish_type: "vinyl_plank",
    underlay_required: null,
    floor_preparation_required: false,
  }),
]);
check(
  "11. Vinyl preparation No emits no preparation requirement",
  byComponent(vinylNo.requirements, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2)
    .length === 0
);

const vinylAsk = physical([
  ordinary({
    finish_type: "vinyl_plank",
    underlay_required: null,
    floor_preparation_required: null,
  }),
]);
check(
  "12. Unanswered vinyl preparation is information required",
  vinylAsk.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    vinylAsk.requirements.length === 0
);

const tile10 = flooringTileTakeoff(10, 600, 600);
check(
  "13. Tile ceil formula",
  tile10 != null &&
    tile10.tileAreaM2 === 0.36 &&
    tile10.rawTileCount === 10 / 0.36 &&
    tile10.wholeTileCount === Math.ceil(10 / 0.36)
);

const tilePhysical = physical([
  ordinary({
    finish_type: "tile",
    underlay_required: null,
    floor_preparation_required: false,
    tile_width_mm: 600,
    tile_length_mm: 600,
    area_m2: 10,
  }),
]);
check(
  "14. Tile package is area; whole count is ceil without waste",
  tilePhysical.portions[0]?.tile?.wholeTileCount === Math.ceil(10 / 0.36) &&
    byMaterialKey(tilePhysical.requirements, FLOORING_TILE_SUPPLY_INSTALL_M2)[0]
      ?.baseQuantity === 10 &&
    byMaterialKey(tilePhysical.requirements, FLOORING_TILE_SUPPLY_INSTALL_M2)[0]
      ?.wasteFactor === 0
);

const hardwood = flooringHardwoodTakeoff(10, 186);
const hardwoodPhysical = physical([
  ordinary({
    finish_type: "hardwood",
    underlay_required: null,
    hardwood_board_width_mm: 186,
    area_m2: 10,
  }),
]);
check(
  "15. Hardwood package is area; lineal m is A / board width",
  hardwood != null &&
    hardwood.linealM === 10 / 0.186 &&
    hardwoodPhysical.portions[0]?.hardwood?.linealM === hardwood.linealM &&
    byMaterialKey(
      hardwoodPhysical.requirements,
      FLOORING_HARDWOOD_SUPPLY_INSTALL_M2
    )[0]?.baseQuantity === 10
);

check(
  "16. No carpet roll / vinyl carton / hardwood box quantities",
  [carpetYes, vinylYes, hardwoodPhysical].every((result) =>
    materials(result.requirements).every(
      (row) =>
        row.purchaseUnit !== "carton" &&
        row.purchaseUnit !== "roll" &&
        row.purchaseUnit !== "box" &&
        row.baseUnit !== "carton"
    )
  )
);

console.log("\n=== FLOORING-03 substrate, framing, removal ===\n");

const plyArea = 8;
const plyCoverage = 2.4 * 1.2;
const flooringSheets = flooringSubstrateSheetCount(plyArea, plyCoverage);
const bathroomSheets = bathroomSheetTakeoff(plyArea).sheetCount;
const ply = physical([
  ordinary({
    area_m2: plyArea,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  }),
]);
check(
  "17. Substrate sheets ceil without Bathroom waste",
  flooringSheets === Math.ceil(plyArea / plyCoverage) &&
    bathroomSheets !== flooringSheets &&
    ply.portions[0]?.substrate?.sheetCount === flooringSheets &&
    byMaterialKey(ply.requirements, BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)[0]
      ?.baseQuantity === flooringSheets &&
    byMaterialKey(ply.requirements, BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)[0]
      ?.wasteFactor === 0 &&
    byComponent(ply.requirements, FLOORING_SUBSTRATE_INSTALL_LABOUR)[0]?.kind ===
      "labour" &&
    labour(ply.requirements)[0]?.productivityBasis.key ===
      FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET &&
    labour(ply.requirements)[0]?.productivityBasis.quantity === flooringSheets &&
    labour(ply.requirements)[0]?.productivityBasis.hoursPerUnit === 0
);

const particleboard = physical([
  ordinary({
    substrate_required: true,
    substrate_family: "particleboard",
    substrate_item_key: null,
  }),
]);
check(
  "18. Particleboard without exact item is information required",
  particleboard.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    particleboard.requirements.length === 0
);

const framing = physical([
  ordinary({
    framing_required: true,
    framing_allowance_level: "minor",
    area_m2: 20,
  }),
]);
check(
  "19. Framing allowance is floor area, not timber quantities",
  byComponent(framing.requirements, FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2)
    .length >= 1 &&
    byMaterialKey(
      framing.requirements,
      FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2
    )[0]?.baseQuantity === 20 &&
    !framing.requirements.some((row) => /90\s*×\s*45|timber lm/.test(hay(row)))
);

const framingNo = physical([ordinary({ framing_required: false })]);
check(
  "20. Framing No emits no framing requirement",
  framingNo.requirements.every(
    (row) => !row.componentKey.includes("subfloor_framing")
  )
);

const removal = physical([
  ordinary({
    finish_removal_required: true,
    existing_finish_type: "tile",
    substrate_removal_required: true,
    area_m2: 14,
  }),
]);
const finishRemoval = labour(removal.requirements).find(
  (row) => row.productivityBasis.key === FLOORING_TILE_REMOVE_HOURS_PER_M2
);
const substrateRemoval = labour(removal.requirements).find(
  (row) => row.productivityBasis.key === FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2
);
check(
  "21. Removal operations use hours identities without hour values",
  finishRemoval?.productivityBasis.quantity === 14 &&
    finishRemoval?.baseHours === 0 &&
    substrateRemoval?.productivityBasis.quantity === 14 &&
    substrateRemoval?.adjustedHours === 0
);

const vinylRemoval = physical([
  ordinary({
    finish_removal_required: true,
    existing_finish_type: "vinyl",
    substrate_removal_required: false,
  }),
]);
check(
  "22. Existing vinyl maps to vinyl-plank removal identity",
  labour(vinylRemoval.requirements).some(
    (row) =>
      row.productivityBasis.key === FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2
  )
);

const removalAsk = physical([
  ordinary({
    finish_removal_required: true,
    existing_finish_type: null,
  }),
]);
check(
  "23. Finish removal without existing type is information required",
  removalAsk.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);

console.log("\n=== FLOORING-03 completeness and siblings ===\n");

const incomplete = physical([ordinary({ area_m2: null })]);
check(
  "24. Missing area is information required and emits nothing",
  incomplete.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    incomplete.requirements.length === 0
);

const specialist = physical([
  {
    ...createEmptyFlooringPortion({
      id: "fa_spec",
      label: "Entry",
    }),
    finish_type: "other",
    specialist_kind: "laminate",
    other_description: "Laminate flooring",
    area_input_method: "direct_m2",
    area_m2: 12,
  },
]);
check(
  "25. Specialist is unsupported and has no ordinary packages",
  specialist.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    byComponent(specialist.requirements, FLOORING_SPECIALIST_COMPONENT).length ===
      1 &&
    specialist.requirements.every(
      (row) => !isOrdinaryFlooringFinishPackageKey(row.componentKey)
    )
);

const custom = physical([
  ordinary({
    id: "fa_custom",
    finish_type: "other",
    other_description: "Cork-look vinyl",
    underlay_required: null,
    area_m2: 9,
  }),
]);
check(
  "26. Custom other finish is unsupported, not an ordinary package",
  custom.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    byComponent(custom.requirements, FLOORING_CUSTOM_FINISH_COMPONENT).length ===
      1
);

const mixed = physical([
  ordinary({ id: "complete-a", label: "Bedrooms", area_m2: 24 }),
  ordinary({
    id: "incomplete-b",
    label: "Lounge",
    finish_type: "vinyl_plank",
    underlay_required: null,
    floor_preparation_required: null,
    area_m2: 18,
  }),
]);
check(
  "27. Incomplete sibling never suppresses a complete sibling",
  mixed.portions.find((row) => row.nestedItemId === "complete-a")
    ?.completeness === FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    mixed.portions.find((row) => row.nestedItemId === "incomplete-b")
      ?.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    requirementsForNestedItem(mixed.requirements, "complete-a").length > 0 &&
    requirementsForNestedItem(mixed.requirements, "incomplete-b").length === 0 &&
    mixed.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);

const twins = physical([
  ordinary({ id: "twin-a", label: "Bed 1", area_m2: 12 }),
  ordinary({ id: "twin-b", label: "Bed 2", area_m2: 12 }),
]);
check(
  "28. Identical areas are not physically deduplicated",
  twins.portions.length === 2 &&
    byMaterialKey(twins.requirements, FLOORING_CARPET_SUPPLY_INSTALL_M2).length ===
      2 &&
    requirementsForNestedItem(twins.requirements, "twin-a").every((row) =>
      row.assumptions.some(
        (assumption) =>
          assumption.key === "flooring_area_label" && assumption.text === "Bed 1"
      )
    )
);

check(
  "29. Nested IDs stay on every requirement",
  twins.requirements.every(
    (row) => row.variantKey === "twin-a" || row.variantKey === "twin-b"
  )
);

const empty = calculateFlooringPhysical({
  facts: persist([]),
  workArea: WA,
});
check(
  "30. Empty nested collection does not use legacy",
  empty.source === "empty" && empty.requirements.length === 0
);

const skipped = calculateFlooringPhysical({
  facts: [{ key: "flooring.area_m2", work_area_id: WA.id, value: 20 }],
  workArea: WA,
});
check(
  "31. Flat facts skip the nested kernel",
  skipped.source === "legacy_skipped"
);

console.log("\n=== FLOORING-03 money and identity safety ===\n");

const allPhysical = [
  ...carpetYes.requirements,
  ...vinylYes.requirements,
  ...tilePhysical.requirements,
  ...hardwoodPhysical.requirements,
  ...ply.requirements,
  ...framing.requirements,
  ...removal.requirements,
  ...specialist.requirements,
];
check(
  "32. No COST, hours, waste, or priced flags",
  allPhysical.every((row) => !hasMoney(row))
);

const identities = read("lib/estimate/flooring-identities.ts");
const physicalSrc = read("lib/estimate/flooring-physical.ts");
check(
  "33. Identities are not aliased to legacy or Bathroom labour",
  identities.includes(FLOORING_CARPET_SUPPLY_INSTALL_M2) &&
    identities.includes(FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2) &&
    identities.includes(FLOORING_TILE_SUPPLY_INSTALL_M2) &&
    identities.includes(FLOORING_HARDWOOD_SUPPLY_INSTALL_M2) &&
    identities.includes(FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2) &&
    identities.includes(FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2) &&
    identities.includes(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET) &&
    identities.includes(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2) &&
    identities.includes(FLOORING_CARPET_REMOVE_HOURS_PER_M2) &&
    identities.includes(FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2) &&
    !identities.includes('"scope.flooring.m2"') &&
    !identities.includes('"flooring.material.m2"') &&
    !identities.includes('"bathroom.floor_substrate.install') &&
    !identities.includes('"bathroom.tile') &&
    !identities.includes("FITOUT_BENCHMARKS") &&
    !identities.includes("defaultCostRate")
);

check(
  "34. Physical kernel does not import legacy money or Bathroom waste",
  !physicalSrc.includes("FITOUT_BENCHMARKS") &&
    !physicalSrc.includes("calculateFlooringAreaWithWastage") &&
    !physicalSrc.includes("BATHROOM_SHEET_WASTE") &&
    !physicalSrc.includes("scope.flooring.m2") &&
    physicalSrc.includes("wasteFactor: 0")
);

check(
  "35. Substrate material reuses exact sheet keys only",
  isFlooringSubstrateSheetKey(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    byComponent(ply.requirements, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)[0]
      ?.kind === "material" &&
    !identities.includes("flooring.plywood") &&
    !identities.includes("flooring.substrate.material.m2")
);

const nestedCalc = calculateFlooring(ctx(persist([ordinary()])), WA);
check(
  "36. Nested calculator emits requirements and no line-item money",
  nestedCalc.lineItems.length === 0 &&
    (nestedCalc.requirements?.length ?? 0) > 0 &&
    nestedCalc.assumptions.includes(FLOORING_NESTED_NOT_YET_PRICED_STATEMENT) &&
    !nestedCalc.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE) &&
    (nestedCalc.requirements ?? []).every((row) => !hasMoney(row))
);

const nestedIncomplete = calculateFlooring(
  ctx(persist([ordinary({ underlay_required: null })])),
  WA
);
check(
  "37. Nested incomplete still blocks legacy money",
  nestedIncomplete.lineItems.length === 0 &&
    !JSON.stringify(nestedIncomplete).includes(
      String(FITOUT_BENCHMARKS.flooringPerM2.cost)
    )
);

const nestedSpecialist = calculateFlooring(
  ctx(
    persist([
      {
        ...createEmptyFlooringPortion({ label: "Entry" }),
        finish_type: "other",
        specialist_kind: "laminate",
        other_description: "Laminate flooring",
        area_input_method: "direct_m2",
        area_m2: 12,
      },
    ])
  ),
  WA
);
check(
  "38. Nested specialist still blocks legacy money",
  nestedSpecialist.lineItems.length === 0
);

const legacy = calculateFlooring(
  ctx([{ key: "flooring.area_m2", work_area_id: WA.id, value: 20 }]),
  WA
);
check(
  "39. Flat legacy control unchanged",
  legacy.lineItems.length > 0 &&
    !legacy.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE) &&
    legacy.requirements == null
);

check(
  "40. Summaries stay readable and hide rate keys",
  /Living · 24\.0 m² carpet underlay/.test(
    summariseFlooringPhysicalPortion(ordinary())
  ) &&
    /specialist pricing required/.test(
      summariseFlooringPhysicalPortion({
        ...createEmptyFlooringPortion({ label: "Entry" }),
        finish_type: "other",
        specialist_kind: "laminate",
        other_description: "Laminate flooring",
        area_input_method: "direct_m2",
        area_m2: 12,
      })
    ) &&
    !/hours_per/.test(summariseFlooringPhysicalPortion(ordinary()))
);

console.log("\n=== FLOORING-03 cross-area regression ===\n");

const bathroomFacts: EstimateFact[] = [
  { key: "bathroom.area_m2", work_area_id: "b1", value: 6 },
];
const bathroomBefore = calculateBathroom(
  {
    ...ctx(bathroomFacts),
    confirmedWorkAreas: [
      { id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1, status: "confirmed" },
    ],
  } as EstimateContext,
  {
    id: "b1",
    type: "bathroom",
    name: "Bathroom",
    sort_order: 1,
    status: "confirmed",
  } as never
);
const mixedBathroom = [...bathroomFacts, ...persist([ordinary()])];
const bathroomAfter = calculateBathroom(
  {
    ...ctx(mixedBathroom),
    confirmedWorkAreas: [
      { id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1, status: "confirmed" },
    ],
  } as EstimateContext,
  {
    id: "b1",
    type: "bathroom",
    name: "Bathroom",
    sort_order: 1,
    status: "confirmed",
  } as never
);
check(
  "41. Bathroom calculator is unchanged by nested Flooring facts",
  bathroomAfter.lineItems.length === bathroomBefore.lineItems.length
);

const doorFacts = applyDoorsFactWrite({
  facts: [],
  workAreaId: "d1",
  key: DOORS_PORTIONS_FACT_KEY,
  value: [
    {
      id: "do_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: "Hall",
      installation_type: "prehung_internal",
      leaf_construction: "hollow_core",
      height_mm: 1980,
      width_mm: 810,
      quantity: 1,
      hardware_included: true,
      other_description: null,
      specialist_kind: null,
    },
  ],
});
const doorsBefore = calculateDoors(
  ctx(doorFacts, [
    { id: "d1", type: "doors", name: "Doors", sort_order: 1 },
  ]),
  { id: "d1", type: "doors", name: "Doors", sort_order: 1 }
);
const doorsAfter = calculateDoors(
  ctx([...doorFacts, ...persist([ordinary()])], [
    { id: "d1", type: "doors", name: "Doors", sort_order: 1 },
    WA,
  ]),
  { id: "d1", type: "doors", name: "Doors", sort_order: 1 }
);
check(
  "42. Doors frozen fixture still prices independently",
  (doorsBefore.lineItems?.length ?? 0) === (doorsAfter.lineItems?.length ?? 0) &&
    read("lib/estimate/doors-identities.ts").includes("DOORS_V1_HUMAN_QA_FROZEN")
);

check(
  "43. Analysis capability still includes flooring",
  getAnalysisCapableWorkAreaTypes().includes("flooring")
);

const components = new Set(ply.requirements.map((row) => row.componentKey));
check(
  "44. Component identities stay distinct",
  components.has(FLOORING_CARPET_SUPPLY_INSTALL_M2) &&
    components.has(FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2) &&
    components.has(FLOORING_SUBSTRATE_MATERIAL_COMPONENT) &&
    components.has(FLOORING_SUBSTRATE_INSTALL_LABOUR) &&
    !ply.requirements.some((row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

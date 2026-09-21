/**
 * DOORS-03 — nested physical takeoff and requirement ownership.
 *
 * Run: npx --yes tsx scripts/verify-doors-03-physical.ts
 *
 * No paid AI. No Production. No COST rates. No productivity hours.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { calculateDoors, calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
  DOORS_HARDWARE_INSTALL_LABOUR,
  DOORS_HARDWARE_STANDARD_COMPONENT,
  DOORS_HARDWARE_STANDARD_KEY,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_PREHUNG_INSTALL_LABOUR,
  DOORS_PREHUNG_SET_COMPONENT,
  DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  DOORS_REPLACEMENT_LEAF_COMPONENT,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR,
  DOORS_SPECIALIST_COMPONENT,
  isHollowOrSolidDoorsMaterialKey,
  isOrdinaryDoorsLabourComponent,
  isOrdinaryDoorsMaterialKey,
} from "../lib/estimate/doors-identities";
import {
  calculateDoorsPhysical,
  DOOR_PHYSICAL_COMPLETENESS,
  requirementsForNestedItem,
  summariseDoorPhysicalPortion,
} from "../lib/estimate/doors-physical";
import {
  createEmptyDoorPortion,
  DOORS_NESTED_NOT_CALCULATED_MESSAGE,
  DOORS_PORTIONS_FACT_KEY,
  parseDoorHeightMm,
  parseDoorWidthMm,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import { looksLikeDoorProductMoney } from "../lib/estimate/internal-walls-identities";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
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
  id: "d1",
  type: "doors",
  name: "Doors",
  sort_order: 1,
};

const IW: EstimateWorkArea = {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  sort_order: 1,
};

function persist(portions: readonly DoorPortion[]): EstimateFact[] {
  return [
    {
      key: DOORS_PORTIONS_FACT_KEY,
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

function ordinary(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-ordinary-1",
    label: patch.label ?? null,
    installation_type: "prehung_internal",
    leaf_construction: "hollow_core",
    height_mm: 1980,
    width_mm: 810,
    quantity: 1,
    hardware_included: true,
    other_description: null,
    height_authority: "extracted",
    specialist_kind: null,
    ...patch,
  };
}

function replacement(patch: Partial<DoorPortion> = {}): DoorPortion {
  return ordinary({
    id: "door-set-replacement-1",
    installation_type: "replacement_leaf",
    leaf_construction: "solid_core",
    height_mm: 2200,
    width_mm: 910,
    quantity: 1,
    hardware_included: false,
    ...patch,
  });
}

function specialist(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-specialist-1",
    label: patch.label ?? null,
    installation_type: "other_unsupported",
    leaf_construction: null,
    height_mm: null,
    width_mm: null,
    quantity: 1,
    hardware_included: null,
    other_description: patch.other_description ?? "fire-rated acoustic access-control door",
    specialist_kind: patch.specialist_kind ?? "fire_rated",
    ...patch,
  };
}

function physical(portions: readonly DoorPortion[]) {
  return calculateDoorsPhysical({
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
  const specification =
    req.kind === "material" ? req.specification ?? "" : "";
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

function hasExcludedPart(req: EstimateRequirement): boolean {
  const text = hay(req);
  return (
    /architrave/.test(text) ||
    /paint/.test(text) ||
    /removal/.test(text) ||
    /disposal/.test(text) ||
    /lintel/.test(text) ||
    /stopping/.test(text) ||
    /opening formation/.test(text) ||
    /opening-only/.test(text)
  );
}

function hasSeparateIncludedPart(req: EstimateRequirement): boolean {
  const text = hay(req);
  if (req.componentKey === DOORS_PREHUNG_SET_COMPONENT) return false;
  return (
    /door stop/.test(text) ||
    /hinge/.test(text) ||
    /jamb/.test(text) ||
    (req.componentKey.includes("frame") &&
      req.componentKey !== DOORS_PREHUNG_SET_COMPONENT)
  );
}

function moneyResolved(req: EstimateRequirement): boolean {
  if (req.priced) return true;
  if (req.kind === "material") {
    return req.unitCost != null || req.totalCost != null;
  }
  if (req.kind === "labour") {
    return req.hourlyCost != null || req.totalCost != null;
  }
  return false;
}

function hoursInvented(req: EstimateRequirement): boolean {
  if (req.kind !== "labour") return false;
  return (
    req.baseHours !== 0 ||
    req.adjustedHours !== 0 ||
    req.productivityBasis.hoursPerUnit !== 0
  );
}

function emptyExtraction(): AIExtractionOutput {
  return {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  };
}

const allowed = getAnalysisCapableWorkAreaTypes();

function typesOf(brief: string): string[] {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  }).extraction.workAreas.map((row) => row.type);
}

console.log("=== DOORS-03 ordinary prehung ===\n");

const oneHollow = physical([ordinary({ quantity: 1 })]);
const oneHollowSets = byMaterialKey(
  oneHollow.requirements,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
);
check(
  "1. One hollow prehung door produces one set",
  oneHollowSets.length === 1 &&
    oneHollowSets[0]?.baseQuantity === 1 &&
    oneHollow.portions[0]?.completeness ===
      DOOR_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL
);

const threeHollow = physical([ordinary({ id: "q3", quantity: 3 })]);
const threeSets = byMaterialKey(
  threeHollow.requirements,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
);
check(
  "2. Multiple prehung doors multiply exactly",
  threeSets.length === 1 &&
    threeSets[0]?.baseQuantity === 3 &&
    threeSets[0]?.purchaseQuantity === 3
);

const solidPrehung = physical([
  ordinary({
    id: "solid-1",
    leaf_construction: "solid_core",
    quantity: 1,
  }),
]);
check(
  "3. Solid prehung uses a distinct component/material identity",
  byMaterialKey(solidPrehung.requirements, DOORS_PREHUNG_SOLID_CORE_SET_KEY)
    .length === 1 &&
    byMaterialKey(solidPrehung.requirements, DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)
      .length === 0 &&
    byComponent(solidPrehung.requirements, DOORS_PREHUNG_SET_COMPONENT)[0]
      ?.kind === "material"
);

check(
  "4. Purchase quantity equals installed quantity",
  materials(oneHollow.requirements).every(
    (row) => row.purchaseQuantity === row.baseQuantity
  ) &&
    materials(threeHollow.requirements).every(
      (row) => row.purchaseQuantity === row.baseQuantity
    )
);

check(
  "5. Waste factor is zero",
  materials(oneHollow.requirements).every((row) => row.wasteFactor === 0) &&
    materials(threeHollow.requirements).every((row) => row.wasteFactor === 0)
);

const prehungInstall = byComponent(
  oneHollow.requirements,
  DOORS_PREHUNG_INSTALL_LABOUR
);
check(
  "6. Prehung emits one install-operation basis per door",
  prehungInstall.length === 1 &&
    prehungInstall[0]?.kind === "labour" &&
    prehungInstall[0]?.productivityBasis.quantity === 1 &&
    prehungInstall[0]?.productivityBasis.unit === "door" &&
    prehungInstall[0]?.productivityBasis.key ===
      DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY &&
    byComponent(threeHollow.requirements, DOORS_PREHUNG_INSTALL_LABOUR)[0]
      ?.kind === "labour" &&
    labour(threeHollow.requirements).find(
      (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
    )?.productivityBasis.quantity === 3
);

const hwMat = byMaterialKey(oneHollow.requirements, DOORS_HARDWARE_STANDARD_KEY);
check(
  "7. Included hardware emits one set per door",
  hwMat.length === 1 &&
    hwMat[0]?.baseQuantity === 1 &&
    hwMat[0]?.purchaseQuantity === 1 &&
    hwMat[0]?.baseUnit === "each"
);

const hwLab = byComponent(oneHollow.requirements, DOORS_HARDWARE_INSTALL_LABOUR);
check(
  "8. Included hardware emits one hardware-operation basis per door",
  hwLab.length === 1 &&
    hwLab[0]?.kind === "labour" &&
    hwLab[0]?.productivityBasis.quantity === 1 &&
    hwLab[0]?.productivityBasis.unit === "set" &&
    hwLab[0]?.productivityBasis.key === DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY
);

const noHw = physical([ordinary({ id: "no-hw", hardware_included: false })]);
check(
  "9. Excluded hardware emits neither hardware line",
  byMaterialKey(noHw.requirements, DOORS_HARDWARE_STANDARD_KEY).length === 0 &&
    byComponent(noHw.requirements, DOORS_HARDWARE_INSTALL_LABOUR).length === 0 &&
    byComponent(noHw.requirements, DOORS_HARDWARE_STANDARD_COMPONENT).length ===
      0
);

check(
  "10. Prehung does not emit separate frame/stops/hinges lines",
  oneHollow.requirements.every((row) => !hasSeparateIncludedPart(row)) &&
    byComponent(oneHollow.requirements, DOORS_PREHUNG_SET_COMPONENT).length === 1
);

check(
  "11. Prehung emits no architrave/paint/removal/opening lines",
  oneHollow.requirements.every((row) => !hasExcludedPart(row)) &&
    threeHollow.requirements.every((row) => !hasExcludedPart(row))
);

console.log("\n=== DOORS-03 replacement leaf ===\n");

const hollowLeaf = physical([
  replacement({
    id: "rep-hollow",
    leaf_construction: "hollow_core",
    hardware_included: false,
  }),
]);
check(
  "12. Hollow replacement uses the hollow leaf identity",
  byMaterialKey(hollowLeaf.requirements, DOORS_LEAF_HOLLOW_CORE_KEY).length ===
    1 &&
    byMaterialKey(hollowLeaf.requirements, DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)
      .length === 0
);

const solidLeaf = physical([replacement({ quantity: 1 })]);
check(
  "13. Solid replacement uses the solid leaf identity",
  byMaterialKey(solidLeaf.requirements, DOORS_LEAF_SOLID_CORE_KEY).length ===
    1 &&
    byMaterialKey(solidLeaf.requirements, DOORS_LEAF_HOLLOW_CORE_KEY).length ===
      0
);

const twoLeaf = physical([replacement({ id: "rep-2", quantity: 2 })]);
check(
  "14. Replacement quantity multiplies exactly",
  byMaterialKey(twoLeaf.requirements, DOORS_LEAF_SOLID_CORE_KEY)[0]
    ?.baseQuantity === 2 &&
    byMaterialKey(twoLeaf.requirements, DOORS_LEAF_SOLID_CORE_KEY)[0]
      ?.purchaseQuantity === 2
);

const repInstall = byComponent(
  solidLeaf.requirements,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR
);
check(
  "15. Replacement emits the replacement-install operation",
  repInstall.length === 1 &&
    repInstall[0]?.kind === "labour" &&
    repInstall[0]?.productivityBasis.quantity === 1 &&
    repInstall[0]?.productivityBasis.unit === "door" &&
    repInstall[0]?.productivityBasis.key ===
      DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY
);

check(
  "16. Replacement does not emit frame material",
  byComponent(solidLeaf.requirements, DOORS_PREHUNG_SET_COMPONENT).length ===
    0 &&
    byMaterialKey(solidLeaf.requirements, DOORS_PREHUNG_SOLID_CORE_SET_KEY)
      .length === 0 &&
    solidLeaf.requirements.every(
      (row) =>
        row.componentKey !== "doors.frame" &&
        row.componentKey !== DOORS_PREHUNG_SET_COMPONENT
    ) &&
    solidLeaf.portions[0]?.disclosures.some((row) =>
      /existing frame\/jamb retained/i.test(row)
    ) === true
);

check(
  "17. Existing/reused hardware emits no hardware lines",
  byMaterialKey(solidLeaf.requirements, DOORS_HARDWARE_STANDARD_KEY).length ===
    0 &&
    byComponent(solidLeaf.requirements, DOORS_HARDWARE_INSTALL_LABOUR).length ===
      0 &&
    solidLeaf.portions[0]?.disclosures.some((row) =>
      /existing hardware reused/i.test(row)
    ) === true
);

const repWithHw = physical([
  replacement({ id: "rep-hw", hardware_included: true, quantity: 2 }),
]);
check(
  "18. Included hardware emits material and operation quantities",
  byMaterialKey(repWithHw.requirements, DOORS_HARDWARE_STANDARD_KEY)[0]
    ?.baseQuantity === 2 &&
    labour(repWithHw.requirements).find(
      (row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR
    )?.productivityBasis.quantity === 2
);

console.log("\n=== DOORS-03 other/custom leaf ===\n");

const custom = physical([
  ordinary({
    id: "custom-1",
    leaf_construction: "other",
    other_description: "painted MDF flush leaf",
    quantity: 2,
  }),
]);
const customMat = byComponent(custom.requirements, DOORS_CUSTOM_LEAF_COMPONENT);
check(
  "19. Custom ordinary leaf retains known quantity",
  customMat.length === 1 &&
    customMat[0]?.kind === "material" &&
    customMat[0]?.baseQuantity === 2 &&
    customMat[0]?.purchaseQuantity === 2
);

check(
  "20. Custom material does not use hollow/solid identities",
  customMat[0]?.kind === "material" &&
    !isHollowOrSolidDoorsMaterialKey(
      customMat[0]?.kind === "material" ? customMat[0].materialKey : null
    ) &&
    materials(custom.requirements).every(
      (row) => !isHollowOrSolidDoorsMaterialKey(row.materialKey)
    )
);

check(
  "21. Custom material has no resolved COST",
  customMat[0]?.kind === "material" &&
    customMat[0].priced === false &&
    customMat[0].unitCost == null &&
    customMat[0].totalCost == null &&
    customMat[0].materialKey == null &&
    customMat[0].rateSource === "missing"
);

check(
  "22. Ordinary installation operation remains",
  byComponent(custom.requirements, DOORS_PREHUNG_INSTALL_LABOUR).length === 1 &&
    labour(custom.requirements).find(
      (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
    )?.productivityBasis.quantity === 2
);

check(
  "23. Description is retained",
  customMat[0]?.kind === "material" &&
    (customMat[0].specification ?? "").includes("painted MDF flush leaf") &&
    custom.portions[0]?.other_description === "painted MDF flush leaf"
);

console.log("\n=== DOORS-03 unsupported ===\n");

const fireAcoustic = physical([
  specialist({
    specialist_kind: "fire_rated",
    other_description: "fire-rated acoustic access-control door",
  }),
]);
check(
  "24. Fire/acoustic emits unsupported specialist status",
  fireAcoustic.portions[0]?.completeness ===
    DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    fireAcoustic.completeness ===
      DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
);

const slider = physical([
  specialist({
    id: "slider-1",
    specialist_kind: "cavity_slider",
    other_description: "cavity slider",
  }),
]);
check(
  "25. Cavity slider emits unsupported specialist status",
  slider.portions[0]?.completeness ===
    DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
);

const aluminium = physical([
  specialist({
    id: "alu-1",
    specialist_kind: "aluminium",
    other_description: "aluminium exterior entrance door",
  }),
]);
const exterior = physical([
  specialist({
    id: "ext-1",
    specialist_kind: "exterior",
    other_description: "exterior door",
  }),
]);
check(
  "26. Aluminium/exterior emits unsupported specialist status",
  aluminium.portions[0]?.completeness ===
    DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    exterior.portions[0]?.completeness ===
      DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
);

function hasOrdinaryLines(reqs: readonly EstimateRequirement[]): boolean {
  return reqs.some(
    (row) =>
      (row.kind === "material" && isOrdinaryDoorsMaterialKey(row.materialKey)) ||
      isOrdinaryDoorsLabourComponent(row.componentKey) ||
      row.componentKey === DOORS_PREHUNG_SET_COMPONENT ||
      row.componentKey === DOORS_REPLACEMENT_LEAF_COMPONENT ||
      row.componentKey === DOORS_HARDWARE_STANDARD_COMPONENT
  );
}

check(
  "27. Unsupported emits no ordinary material lines",
  !hasOrdinaryLines(fireAcoustic.requirements) &&
    !hasOrdinaryLines(slider.requirements) &&
    materials(fireAcoustic.requirements).every(
      (row) => row.componentKey === DOORS_SPECIALIST_COMPONENT
    )
);

check(
  "28. Unsupported emits no ordinary operation lines",
  labour(fireAcoustic.requirements).length === 0 &&
    labour(slider.requirements).length === 0 &&
    labour(aluminium.requirements).length === 0
);

check(
  "29. Known specialist quantity remains visible",
  byComponent(fireAcoustic.requirements, DOORS_SPECIALIST_COMPONENT)[0]
    ?.kind === "material" &&
    byComponent(fireAcoustic.requirements, DOORS_SPECIALIST_COMPONENT)[0]
      ?.kind === "material" &&
    materials(fireAcoustic.requirements)[0]?.baseQuantity === 1 &&
    /specialist pricing required/i.test(fireAcoustic.portions[0]?.summary ?? "")
);

console.log("\n=== DOORS-03 completeness ===\n");

const missingWidth = physical([ordinary({ id: "miss-w", width_mm: null })]);
check(
  "30. Missing width is information-required",
  missingWidth.portions[0]?.completeness ===
    DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    missingWidth.portions[0]?.missingFields.includes(
      "doors.portion.width_mm"
    ) === true &&
    /door width not confirmed/i.test(missingWidth.missingInfo.join(" "))
);

const missingQty = physical([ordinary({ id: "miss-q", quantity: null })]);
check(
  "31. Missing quantity is information-required",
  missingQty.portions[0]?.completeness ===
    DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    missingQty.portions[0]?.missingFields.includes("doors.portion.quantity") ===
      true &&
    missingQty.requirements.length === 0 &&
    /door quantity not confirmed/i.test(missingQty.missingInfo.join(" "))
);

const missingHw = physical([
  ordinary({ id: "miss-hw", hardware_included: null }),
]);
check(
  "32. Missing hardware decision is information-required",
  missingHw.portions[0]?.completeness ===
    DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    missingHw.portions[0]?.missingFields.includes(
      "doors.portion.hardware_included"
    ) === true &&
    missingHw.requirements.length === 0
);

const missingOther = physical([
  ordinary({
    id: "miss-other",
    leaf_construction: "other",
    other_description: null,
  }),
]);
check(
  "33. Missing other-description is information-required where relevant",
  missingOther.portions[0]?.completeness ===
    DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    missingOther.portions[0]?.missingFields.includes(
      "doors.portion.other_description"
    ) === true &&
    missingOther.requirements.length === 0
);

check(
  "34. Missing information does not become quantity zero",
  missingQty.requirements.every((row) =>
    row.kind === "material" ? row.baseQuantity !== 0 : true
  ) &&
    missingQty.requirements.length === 0 &&
    missingWidth.requirements.length === 0 &&
    !missingQty.missingInfo.some((row) => /default 3|three/i.test(row))
);

const siblingComplete = ordinary({
  id: "sibling-complete",
  label: "Bedroom doors",
  quantity: 2,
});
const siblingIncomplete = ordinary({
  id: "sibling-incomplete",
  label: "Hall door",
  width_mm: null,
  quantity: null,
});
const mixed = physical([siblingComplete, siblingIncomplete]);
const completeReqs = requirementsForNestedItem(
  mixed.requirements,
  "sibling-complete"
);
const incompleteReqs = requirementsForNestedItem(
  mixed.requirements,
  "sibling-incomplete"
);
check(
  "35. Complete sibling requirements survive an incomplete sibling",
  mixed.portions.length === 2 &&
    mixed.portions.find((row) => row.nestedItemId === "sibling-complete")
      ?.completeness === DOOR_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    byMaterialKey(completeReqs, DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)[0]
      ?.baseQuantity === 2
);

check(
  "36. Incomplete sibling does not suppress complete sibling",
  mixed.portions.find((row) => row.nestedItemId === "sibling-incomplete")
    ?.completeness === DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    incompleteReqs.length === 0 &&
    completeReqs.length > 0 &&
    mixed.completeness === DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);

console.log("\n=== DOORS-03 dimensions ===\n");

const sizeA = physical([
  ordinary({ id: "size-a", height_mm: 1980, width_mm: 810, quantity: 2 }),
]);
const sizeB = physical([
  ordinary({ id: "size-b", height_mm: 2200, width_mm: 910, quantity: 2 }),
]);
const sizeC = physical([
  ordinary({ id: "size-c", height_mm: 2400, width_mm: 410, quantity: 2 }),
]);
check(
  "37. Supported dimensions are retained in metadata",
  sizeA.portions[0]?.height_mm === 1980 &&
    sizeA.portions[0]?.width_mm === 810 &&
    sizeA.requirements.some((row) =>
      row.assumptions.some((a) => a.key === "door_height_mm" && /1980/.test(a.text))
    ) &&
    sizeA.requirements.some((row) =>
      row.assumptions.some((a) => a.key === "door_width_mm" && /810/.test(a.text))
    )
);

function countKinds(reqs: readonly EstimateRequirement[]) {
  return {
    materials: materials(reqs).length,
    labour: labour(reqs).length,
    qty: materials(reqs).reduce((sum, row) => sum + row.baseQuantity, 0),
  };
}
const kindsA = countKinds(sizeA.requirements);
const kindsB = countKinds(sizeB.requirements);
const kindsC = countKinds(sizeC.requirements);
check(
  "38. Different supported sizes do not alter quantities",
  kindsA.materials === kindsB.materials &&
    kindsB.materials === kindsC.materials &&
    kindsA.labour === kindsB.labour &&
    kindsB.labour === kindsC.labour &&
    kindsA.qty === kindsB.qty &&
    kindsB.qty === kindsC.qty &&
    byMaterialKey(sizeA.requirements, DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)[0]
      ?.baseQuantity === 2 &&
    byMaterialKey(sizeC.requirements, DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)[0]
      ?.baseQuantity === 2
);

check(
  "39. Dimensions do not generate area/waste",
  [...sizeA.requirements, ...sizeB.requirements, ...sizeC.requirements].every(
    (row) => {
      if (row.kind === "material") {
        return row.wasteFactor === 0 && !/m2|m²|area/i.test(hay(row));
      }
      return true;
    }
  )
);

check(
  "40. Unsupported values do not become supported identities",
  parseDoorHeightMm(2000) == null &&
    parseDoorWidthMm(1000) == null &&
    materials(fireAcoustic.requirements).every(
      (row) => !isHollowOrSolidDoorsMaterialKey(row.materialKey)
    ) &&
    physical([ordinary({ id: "bad-h", height_mm: null })]).portions[0]
      ?.completeness === DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);

console.log("\n=== DOORS-03 multiple portions ===\n");

const twinA = ordinary({
  id: "twin-a",
  label: "Bedroom 1",
  quantity: 1,
  hardware_included: true,
});
const twinB = ordinary({
  id: "twin-b",
  label: "Bedroom 2",
  quantity: 1,
  hardware_included: false,
});
const twins = physical([twinA, twinB]);
check(
  "41. Multiple portions retain distinct nested IDs",
  twins.portions.map((row) => row.nestedItemId).sort().join(",") ===
    "twin-a,twin-b" &&
    twins.requirements.every(
      (row) => row.variantKey === "twin-a" || row.variantKey === "twin-b"
    )
);

const identical = physical([
  ordinary({ id: "ident-a", label: "Set A", quantity: 1 }),
  ordinary({ id: "ident-b", label: "Set B", quantity: 1 }),
]);
check(
  "42. Identical portions are not physically deduplicated",
  identical.portions.length === 2 &&
    byMaterialKey(identical.requirements, DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)
      .length === 2 &&
    requirementsForNestedItem(identical.requirements, "ident-a").length ===
      requirementsForNestedItem(identical.requirements, "ident-b").length &&
    identical.requirements.filter(
      (row) =>
        row.kind === "material" &&
        row.materialKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
    ).every((row) => row.baseQuantity === 1)
);

check(
  "43. Labels remain attached to the correct portion",
  twins.portions.find((row) => row.nestedItemId === "twin-a")?.label ===
    "Bedroom 1" &&
    twins.portions.find((row) => row.nestedItemId === "twin-b")?.label ===
      "Bedroom 2" &&
    requirementsForNestedItem(twins.requirements, "twin-a").every((row) =>
      row.assumptions.some((a) => a.key === "door_set_label" && a.text === "Bedroom 1")
    ) &&
    /Bedroom 1/.test(
      summariseDoorPhysicalPortion(twinA)
    )
);

check(
  "44. Hardware choice stays portion-specific",
  byMaterialKey(
    requirementsForNestedItem(twins.requirements, "twin-a"),
    DOORS_HARDWARE_STANDARD_KEY
  ).length === 1 &&
    byMaterialKey(
      requirementsForNestedItem(twins.requirements, "twin-b"),
      DOORS_HARDWARE_STANDARD_KEY
    ).length === 0 &&
    byComponent(
      requirementsForNestedItem(twins.requirements, "twin-b"),
      DOORS_HARDWARE_INSTALL_LABOUR
    ).length === 0
);

console.log("\n=== DOORS-03 integration ===\n");

const nestedOne = calculateDoors(ctx(persist([ordinary({ quantity: 1 })])), WA);
check(
  "45. Nested Doors does not use legacy default three",
  materials(nestedOne.requirements ?? []).every(
    (row) =>
      row.baseQuantity !== 3 ||
      row.materialKey !== DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
  ) &&
    byMaterialKey(nestedOne.requirements ?? [], DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)[0]
      ?.baseQuantity === 1 &&
    !nestedOne.lineItems.some((row) => /default three|doors\.count/i.test(row.label))
);

check(
  "46. Nested Doors does not use legacy $280",
  nestedOne.lineItems.every(
    (row) =>
      row.recommendedCost !== FITOUT_BENCHMARKS.doorsEach.cost &&
      !/supply\/install allowance/i.test(row.label)
  ) &&
    !nestedOne.lineItems.some(
      (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
    ) &&
    !read("lib/estimate/doors-physical.ts").includes("FITOUT_BENCHMARKS") &&
    !read("lib/estimate/doors-physical.ts").includes("doorsEach") &&
    !read("lib/estimate/doors-physical.ts").includes("doorInstallEach") &&
    !read("lib/estimate/doors-commercial.ts").includes("doorsEach")
);

const emptyNested = calculateDoors(
  ctx([
    {
      key: DOORS_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: [],
      source: "user",
    },
  ]),
  WA
);
check(
  "47. Empty nested collection does not fall back to legacy money",
  emptyNested.lineItems.length === 0 &&
    emptyNested.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    (emptyNested.requirements == null || emptyNested.requirements.length === 0)
);

const incompleteNested = calculateDoors(
  ctx(persist([createEmptyDoorPortion({ id: "empty-1" })])),
  WA
);
check(
  "48. Incomplete nested collection does not fall back",
  incompleteNested.lineItems.length === 0 &&
    incompleteNested.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    (incompleteNested.requirements == null ||
      incompleteNested.requirements.length === 0) &&
    incompleteNested.missingInfo.some((row) => /not confirmed/i.test(row))
);

const unsupportedNested = calculateDoors(
  ctx(persist([specialist({ quantity: 1 })])),
  WA
);
check(
  "49. Unsupported nested collection does not fall back",
  unsupportedNested.lineItems.every(
    (row) =>
      row.rateSourceType === "missing" &&
      (row.recommendedCost === 0 || row.includedInTotal === false)
  ) &&
    !unsupportedNested.lineItems.some(
      (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
    ) &&
    hasOrdinaryLines(unsupportedNested.requirements ?? []) === false &&
    (unsupportedNested.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) ||
      unsupportedNested.missingInfo.some((row) => /pricing required/i.test(row)))
);

const legacyFacts: EstimateFact[] = [
  { key: "doors.count", work_area_id: WA.id, value: 2, source: "user" },
];
const legacyCalc = calculateDoors(ctx(legacyFacts), WA);
check(
  "50. Legacy flat-only fixture remains unchanged",
  legacyCalc.lineItems.length > 0 &&
    !legacyCalc.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    legacyCalc.lineItems.some(
      (row) =>
        row.recommendedCost === 2 * FITOUT_BENCHMARKS.doorsEach.cost
    )
);

let iwFacts: EstimateFact[] = [];
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
const iwTypeId = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: IW.id,
}).types[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "Yes",
  wallTypeId: iwTypeId,
});
const iwOpeningId = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: IW.id,
}).types[0]!.openings[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: "internal_walls.opening.width_m",
  value: 0.81,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: "internal_walls.opening.height_m",
  value: 1.98,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = [
  {
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    work_area_id: IW.id,
    value: "new_partition",
    source: "user",
  },
  ...iwFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const iwBefore = JSON.stringify(
  resolveInternalWallsWallTypes({ facts: iwFacts, workAreaId: IW.id })
);
const mixedFacts = [...iwFacts, ...persist([ordinary({ quantity: 1 })])];
calculateDoors(ctx(mixedFacts, [WA, IW]), WA);
const iwAfterDoors = JSON.stringify(
  resolveInternalWallsWallTypes({ facts: mixedFacts, workAreaId: IW.id })
);
const iwCalc = calculateInternalWalls(ctx(mixedFacts, [WA, IW]), IW);
check(
  "51. Doors does not mutate Internal Walls openings",
  iwBefore === iwAfterDoors &&
    resolveInternalWallsWallTypes({ facts: mixedFacts, workAreaId: IW.id })
      .types[0]?.openings[0]?.width_m === 0.81 &&
    !iwCalc.lineItems.some((row) =>
      looksLikeDoorProductMoney({
        label: row.label,
        componentKey: row.componentKey,
        itemKey: row.itemKey,
      })
    )
);

check(
  "52. Opening-only remains Internal Walls-only",
  typesOf(
    "Construct an internal wall with one 810 × 1980 opening. Opening only."
  ).includes("internal_walls") &&
    !typesOf(
      "Construct an internal wall with one 810 × 1980 opening. Opening only."
    ).includes("doors")
);

const combinedTypes = typesOf(
  "Construct an internal wall with one 810 × 1980 opening and supply and install one hollow-core prehung internal door."
);
check(
  "53. Combined opening + supplied door retains both work areas",
  combinedTypes.includes("internal_walls") && combinedTypes.includes("doors"),
  combinedTypes.join(",")
);

const allPhysical = [
  ...oneHollow.requirements,
  ...solidLeaf.requirements,
  ...custom.requirements,
  ...fireAcoustic.requirements,
  ...mixed.requirements,
];
check(
  "54. No physical requirement contains resolved commercial money",
  allPhysical.every((row) => !moneyResolved(row)) &&
    allPhysical.every((row) => row.priced === false)
);

check(
  "55. No productivity hours are invented",
  allPhysical.every((row) => !hoursInvented(row)) &&
    !read("lib/estimate/doors-physical.ts").includes("hoursPerUnit: 0.5") &&
    !read("lib/estimate/doors-physical.ts").includes("FITOUT_BENCHMARKS") &&
    labour(oneHollow.requirements).every(
      (row) => row.baseHours === 0 && row.priced === false
    )
);

console.log("\n=== DOORS-03 identity safety ===\n");

const identities = read("lib/estimate/doors-identities.ts");
check(
  "identities are not aliased to legacy lumps",
  !identities.includes("doorsEach") &&
    !identities.includes("doorInstallEach") &&
    !identities.includes("scope.doors.each") &&
    identities.includes(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY) &&
    identities.includes(DOORS_LEAF_SOLID_CORE_KEY) &&
    identities.includes(DOORS_HARDWARE_STANDARD_KEY)
);

const summaryPrehung = summariseDoorPhysicalPortion(
  ordinary({ label: "Bedroom doors", quantity: 2 })
);
const summaryRep = summariseDoorPhysicalPortion(replacement());
const summarySpec = summariseDoorPhysicalPortion(
  specialist({
    other_description: "fire-rated acoustic access-control door",
  })
);
check(
  "physical summaries are readable and hide rate keys",
  /Bedroom doors · 2 × 1980 × 810 mm hollow-core prehung internal door sets/.test(
    summaryPrehung
  ) &&
    /1 × 2200 × 910 mm solid-core replacement door leaf/.test(summaryRep) &&
    /1 × fire-rated acoustic access-control door · specialist pricing required/.test(
      summarySpec
    ) &&
    !/hours_per/.test(summaryPrehung) &&
    !/hours_per/.test(summaryRep)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

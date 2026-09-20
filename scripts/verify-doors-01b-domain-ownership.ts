/**
 * DOORS-01B — nested Door Set domain + work-area ownership router.
 *
 * Run: npx --yes tsx scripts/verify-doors-01b-domain-ownership.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { isDoorsNestedFactKey } from "../lib/assistant/question-identity";
import { calculateDoors, calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  applyCeilingsFactWrite,
  CEILINGS_ADD_PORTION_KEY,
  parseCeilingsCollectionEnvelope,
} from "../lib/estimate/ceilings-portions";
import {
  applyDoorsFactWrite,
  createEmptyDoorPortion,
  DOORS_ADD_PORTION_KEY,
  DOORS_CALCULATOR_CONSUMED_FACTS,
  DOORS_DELETE_PORTION_KEY,
  DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
  DOORS_NESTED_NOT_CALCULATED_MESSAGE,
  DOORS_PORTION_FIELD_KEYS,
  DOORS_PORTIONS_FACT_KEY,
  hasCanonicalDoorsPortions,
  isDoorsPortionWriteKey,
  mergePersistedDoorsPortionsOnReanalyse,
  parseDoorHeightMm,
  parseDoorInstallationType,
  parseDoorLeafConstruction,
  parseDoorQuantity,
  parseDoorWidthMm,
  parseDoorsCollectionEnvelope,
  storedDoorsPortions,
} from "../lib/estimate/doors-portions";
import { looksLikeDoorProductMoney } from "../lib/estimate/internal-walls-identities";
import {
  INTERNAL_WALLS_ADD_OPENING_KEY,
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
} from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import { normalizeCanonicalFactKey } from "../lib/scopes/fact-keys";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { getFactDisplayLabel } from "../lib/scopes/fact-labels";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  briefExcludesDoorSupply,
  briefHasIndependentCeilings,
  briefHasIndependentDoors,
  briefHasSpecialistDoorLanguage,
  briefRequestsDoorWork,
} from "../lib/work-areas/ownership";

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

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const allowed = getAnalysisCapableWorkAreaTypes();

function typesOf(brief: string): string[] {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  })
    .extraction.workAreas.map((row) => row.type)
    .sort();
}

function fact(key: string, workAreaId: string, value: unknown, source?: string): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function wa(id: string, type: string, name: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function ctx(workAreas: EstimateWorkArea[], facts: EstimateFact[]): EstimateContext {
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

function writeDoors(
  facts: readonly EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string | null,
  factSource?: string | null
): EstimateFact[] {
  return applyDoorsFactWrite({
    facts,
    workAreaId: "d1",
    key,
    value,
    nestedItemId,
    factSource,
  });
}

function snapshotIw(facts: readonly EstimateFact[]): string {
  return JSON.stringify(
    facts
      .filter((row) => row.key.startsWith("internal_walls."))
      .map((row) => ({ key: row.key, value: row.value }))
  );
}

console.log("=== DOORS-01B domain ===\n");

check(
  "1. canonical doors.portions parses safely",
  parseDoorsCollectionEnvelope({
    v: 3,
    portions: [
      {
        id: "ds_a",
        installation_type: "prehung_internal",
        leaf_construction: "hollow_core",
        height_mm: 1980,
        width_mm: 810,
        quantity: 2,
        hardware_included: true,
      },
    ],
  }).portions[0]?.id === "ds_a" &&
    parseDoorsCollectionEnvelope("not-json").portions.length === 0 &&
    parseDoorsCollectionEnvelope(null).portions.length === 0
);

const empty = createEmptyDoorPortion({ id: "ds_empty" });
check(
  "9. height 1980 can be represented as disclosed default",
  empty.height_mm === DOORS_HEIGHT_DISCLOSED_DEFAULT_MM &&
    empty.height_authority === "assumed_disclosed"
);
check("10. width remains unanswered unless supplied", empty.width_mm === null);
check("11. quantity has no silent default", empty.quantity === null && empty.hardware_included === null);

let facts: EstimateFact[] = writeDoors([], DOORS_ADD_PORTION_KEY, true);
const first = storedDoorsPortions(facts, "d1")[0];
check("2. one portion retains its fields", Boolean(first?.id) && first?.height_mm === 1980 && first.width_mm === null);

facts = writeDoors(facts, "doors.portion.quantity", 2, first!.id);
facts = writeDoors(facts, "doors.portion.width_mm", 810, first!.id);
facts = writeDoors(facts, "doors.portion.installation_type", "prehung_internal", first!.id);
facts = writeDoors(facts, "doors.portion.leaf_construction", "hollow_core", first!.id);
facts = writeDoors(facts, "doors.portion.hardware_included", true, first!.id);
facts = writeDoors(facts, "doors.portion.label", "Office", first!.id);
const retained = storedDoorsPortions(facts, "d1")[0];
check(
  "2b. edited fields persist on the same id",
  retained?.id === first!.id &&
    retained.quantity === 2 &&
    retained.width_mm === 810 &&
    retained.installation_type === "prehung_internal" &&
    retained.leaf_construction === "hollow_core" &&
    retained.hardware_included === true &&
    retained.label === "Office"
);

facts = writeDoors(facts, DOORS_ADD_PORTION_KEY, true);
const two = storedDoorsPortions(facts, "d1");
check(
  "3. multiple portions retain independent identities",
  two.length === 2 && two[0]!.id !== two[1]!.id
);
check(
  "4. adding a portion does not alter existing portions",
  two[0]!.id === first!.id &&
    two[0]!.quantity === 2 &&
    two[0]!.width_mm === 810 &&
    two[0]!.label === "Office" &&
    two[1]!.quantity === null &&
    two[1]!.width_mm === null
);

const beforeDelete = two.map((row) => row.id);
facts = writeDoors(facts, "doors.portion.quantity", 4, two[1]!.id);
const afterEditB = storedDoorsPortions(facts, "d1");
check(
  "7. editing Portion A does not alter Portion B / editing B does not alter A",
  afterEditB[0]!.quantity === 2 &&
    afterEditB[1]!.quantity === 4 &&
    afterEditB[0]!.label === "Office" &&
    afterEditB[1]!.label === null
);

facts = writeDoors(facts, "doors.portion.leaf_construction", "solid_core", afterEditB[0]!.id);
const afterField = storedDoorsPortions(facts, "d1");
check(
  "6. editing one field preserves unrelated fields",
  afterField[0]!.leaf_construction === "solid_core" &&
    afterField[0]!.quantity === 2 &&
    afterField[0]!.width_mm === 810 &&
    afterField[0]!.hardware_included === true &&
    afterField[1]!.quantity === 4
);

facts = writeDoors(facts, DOORS_DELETE_PORTION_KEY, afterField[1]!.id);
const afterDelete = storedDoorsPortions(facts, "d1");
check(
  "5. deleting one portion does not delete siblings",
  afterDelete.length === 1 &&
    afterDelete[0]!.id === beforeDelete[0] &&
    afterDelete[0]!.quantity === 2
);

const userWidth = {
  ...createEmptyDoorPortion({ id: afterDelete[0]!.id }),
  width_mm: 810 as const,
  width_authority: "user" as const,
};
const reanalysed = mergePersistedDoorsPortionsOnReanalyse({
  extracted: [
    {
      id: userWidth.id,
      installation_type: "replacement_leaf",
      leaf_construction: "hollow_core",
      height_mm: 2200,
      width_mm: 760,
      quantity: 9,
      hardware_included: false,
    },
  ],
  persisted: [userWidth],
});
check(
  "8. field-level user authority survives extracted re-analysis",
  reanalysed[0]?.width_mm === 810 &&
    reanalysed[0]?.width_authority === "user" &&
    reanalysed[0]?.installation_type === "replacement_leaf" &&
    reanalysed[0]?.quantity === 9
);

check(
  "12. invalid quantities are rejected or normalised safely",
  parseDoorQuantity(0) === null &&
    parseDoorQuantity(-1) === null &&
    parseDoorQuantity(1.5) === null &&
    parseDoorQuantity("three") === null &&
    parseDoorQuantity(3) === 3
);

check(
  "13. invalid enum/dimension values do not become ordinary supported values",
  parseDoorInstallationType("prehung_external") === null &&
    parseDoorInstallationType("cavity_slider") === null &&
    parseDoorLeafConstruction("steel") === null &&
    parseDoorHeightMm(2100) === null &&
    parseDoorWidthMm(800) === null &&
    parseDoorWidthMm(810) === 810
);

const extractedCollection: EstimateFact[] = [
  fact(DOORS_PORTIONS_FACT_KEY, "d1", [createEmptyDoorPortion({ id: "ds_src" })], "ai_extracted"),
];
const afterNested = writeDoors(
  extractedCollection,
  "doors.portion.quantity",
  1,
  "ds_src"
);
check(
  "14. no whole-collection user-authority promotion from an unrelated nested write",
  afterNested.find((row) => row.key === DOORS_PORTIONS_FACT_KEY)?.source ===
    "ai_extracted" &&
    storedDoorsPortions(afterNested, "d1")[0]?.quantity === 1 &&
    storedDoorsPortions(afterNested, "d1")[0]?.quantity_authority === "user"
);

check(
  "no sibling doors.portion.* rows compete with the collection",
  afterNested.every(
    (row) =>
      row.key === DOORS_PORTIONS_FACT_KEY ||
      row.key === "doors.active_portion_id"
  )
);

check(
  "logical write keys are collection addresses",
  DOORS_PORTION_FIELD_KEYS.every((key) => isDoorsPortionWriteKey(key)) &&
    isDoorsPortionWriteKey(DOORS_ADD_PORTION_KEY) &&
    isDoorsNestedFactKey("doors.portion.quantity") &&
    !isDoorsPortionWriteKey("doors.count")
);

check(
  "nested incomplete portions do not fall through to the legacy lump",
  calculateDoors(ctx([wa("d1", "doors", "Doors")], afterNested), wa("d1", "doors", "Doors"))
    .lineItems.length === 0 &&
    calculateDoors(
      ctx([wa("d1", "doors", "Doors")], afterNested),
      wa("d1", "doors", "Doors")
    ).missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    hasCanonicalDoorsPortions(afterNested, "d1")
);

const legacyDoors = calculateDoors(
  ctx(
    [wa("d1", "doors", "Doors")],
    [fact("doors.count", "d1", 2)]
  ),
  wa("d1", "doors", "Doors")
);
check(
  "legacy lump path remains for projects without portions",
  legacyDoors.lineItems.length > 0 &&
    !legacyDoors.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE)
);

check(
  "fact-key / label / consumed registries include doors.portions",
  normalizeCanonicalFactKey("quantity", "doors") === "doors.portion.quantity" &&
    getFactDisplayLabel("doors.portions") === "Door sets" &&
    isCalculatorConsumedFact("doors", DOORS_PORTIONS_FACT_KEY) &&
    DOORS_CALCULATOR_CONSUMED_FACTS.includes(DOORS_PORTIONS_FACT_KEY)
);

check(
  "CAS persist path is registered for doors.portions",
  read("lib/assistant/scope-persistence.ts").includes("persistDoorsPortionsCollectionWrite") &&
    read("lib/assistant/scope-persistence.ts").includes("DOORS_PORTIONS_FACT_KEY") &&
    read("lib/assistant/scope-persistence.ts").includes("value->>v")
);

console.log("\n=== DOORS-01B ownership routing ===\n");

const openingOnlyA =
  "Construct an internal wall with one door opening. Opening only.";
const openingOnlyB = "Form one 810 × 1980 opening. No door supply.";
const openingOnlyC = "Door opening only; door by others.";
const openingOnlyD = "No door required.";
const combined =
  "Construct an internal wall with one 810 × 1980 opening and supply and install one hollow-core prehung internal door.";
const wordOrder =
  "Form a new opening including a door, jamb and hardware.";
const standalone = "Supply and install two internal doors.";
const replacement = "Replace three damaged door leaves.";
const specialistFire = "Install one fire-rated acoustic door with access control.";
const specialistAluminium = "Install an aluminium entrance door.";
const specialistSlider = "Install a cavity slider.";
const noDoorOpening = "Build a wall with an 810mm opening but no door.";

const openingATypes = typesOf(openingOnlyA);
check(
  "15. opening-only brief creates Internal Walls, not Doors",
  openingATypes.includes("internal_walls") && !openingATypes.includes("doors"),
  openingATypes.join(",")
);
check(
  "16. explicit no door supply does not create Doors",
  !typesOf(openingOnlyB).includes("doors") &&
    briefExcludesDoorSupply(openingOnlyB)
);
check(
  "17. door by others does not create Doors",
  !typesOf(openingOnlyC).includes("doors") &&
    briefExcludesDoorSupply(openingOnlyC)
);
const combinedTypes = typesOf(combined);
check(
  "18. combined wall opening plus explicit door supply creates both",
  combinedTypes.includes("internal_walls") && combinedTypes.includes("doors"),
  combinedTypes.join(",")
);
check(
  "19. word order does not suppress Doors",
  typesOf(wordOrder).includes("doors") && briefRequestsDoorWork(wordOrder)
);
check("20. standalone door supply creates Doors", typesOf(standalone).includes("doors"));
check("21. replacement leaf creates Doors", typesOf(replacement).includes("doors"));
check(
  "22. fire/acoustic door creates Doors for later specialist handling",
  typesOf(specialistFire).includes("doors") &&
    briefHasSpecialistDoorLanguage(specialistFire)
);
check(
  "23. cavity slider creates Doors for later specialist handling",
  typesOf(specialistSlider).includes("doors") &&
    typesOf(specialistAluminium).includes("doors")
);
check(
  "24. explicit no-door language wins over a bare opening reference",
  !briefHasIndependentDoors(noDoorOpening) &&
    !typesOf(noDoorOpening).includes("doors") &&
    !typesOf(openingOnlyD).includes("doors")
);
check(
  "25. positive door supply/install language wins over an opening reference",
  briefHasIndependentDoors(combined) &&
    briefHasIndependentDoors(wordOrder) &&
    !briefHasIndependentDoors(openingOnlyA)
);

console.log("\n=== DOORS-01B frozen ownership ===\n");

let iwFacts: EstimateFact[] = [];
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
const iwTypeId = resolveInternalWallsWallTypes({ facts: iwFacts, workAreaId: "w1" }).types[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: "w1",
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "Yes",
  wallTypeId: iwTypeId,
});
const iwOpeningId = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: "w1",
}).types[0]!.openings[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: "w1",
  key: "internal_walls.opening.width_m",
  value: 0.81,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: "w1",
  key: "internal_walls.opening.height_m",
  value: 1.98,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...iwFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const iwBefore = snapshotIw(iwFacts);
const mixed = [
  ...iwFacts,
  ...writeDoors([], DOORS_ADD_PORTION_KEY, true),
];
const afterDoorsWrite = applyDoorsFactWrite({
  facts: mixed,
  workAreaId: "d1",
  key: "doors.portion.quantity",
  value: 2,
});
check(
  "26. Doors writes do not alter Internal Walls opening facts",
  snapshotIw(afterDoorsWrite) === iwBefore &&
    !afterDoorsWrite.some((row) => row.key === INTERNAL_WALLS_ADD_OPENING_KEY)
);

const openingOnlyFixtureTypes = typesOf(
  "Construct an internal wall with one 810 × 1980 opening. Opening only."
);
check(
  "27. Internal Walls opening-only fixtures remain unchanged",
  openingOnlyFixtureTypes.includes("internal_walls") &&
    !openingOnlyFixtureTypes.includes("doors") &&
    resolveInternalWallsWallTypes({ facts: iwFacts, workAreaId: "w1" }).types[0]
      ?.openings[0]?.width_m === 0.81
);

const iwCalc = calculateInternalWalls(ctx([wa("w1", "internal_walls", "Internal walls")], iwFacts), wa("w1", "internal_walls", "Internal walls"));
check(
  "28. existing IW no door money ownership assertions remain true",
  !iwCalc.lineItems.some((row) =>
    looksLikeDoorProductMoney({
      label: row.label,
      componentKey: row.componentKey,
      itemKey: row.itemKey,
    })
  )
);

const ceilingBrief = "Install 40 square metres of plasterboard ceilings in the office.";
const ceilingTypes = typesOf(ceilingBrief);
let ceilingFacts = applyCeilingsFactWrite({
  facts: [],
  workAreaId: "c1",
  key: CEILINGS_ADD_PORTION_KEY,
  value: true,
});
ceilingFacts = applyCeilingsFactWrite({
  facts: ceilingFacts,
  workAreaId: "c1",
  key: "ceilings.portion.area_m2",
  value: 40,
});
check(
  "29. Ceiling routing/portions remain unchanged",
  briefHasIndependentCeilings(ceilingBrief) &&
    ceilingTypes.includes("ceilings") &&
    !ceilingTypes.includes("doors") &&
    parseCeilingsCollectionEnvelope(
      ceilingFacts.find((row) => row.key === "ceilings.portions")?.value
    ).portions[0]?.geometry.area_m2 === 40
);

check(
  "ISD copy no longer conflates openings with door supply",
  read("lib/scope-discovery/catalogue/relationships/commercial-fitout.ts").includes(
    "Door supply / install"
  ) &&
    read("lib/scope-discovery/catalogue/relationships/commercial-fitout.ts").includes(
      "Internal Walls covers the framed opening"
    ) &&
    !read("lib/scope-discovery/catalogue/relationships/commercial-fitout.ts").includes(
      'title: "Doors / openings"'
    )
);

check(
  "inferDoors uses the ownership helper and seeds doors.portions",
  read("lib/ai/enrich-extraction.ts").includes("briefHasIndependentDoors") &&
    read("lib/ai/enrich-extraction.ts").includes("seedExtractedDoorsFact")
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);

/**
 * FLOORING-01B-R1 — nested Flooring Area domain + persistence contract.
 *
 * Run: npx --yes tsx scripts/verify-flooring-01b-domain.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isFlooringNestedFactKey } from "../lib/assistant/question-identity";
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "../lib/estimate/bathroom-identities";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import {
  calculateDoors,
  calculateFlooring,
  calculateInternalWalls,
} from "../lib/estimate/calculators/fitout";
import {
  applyCeilingsFactWrite,
  CEILINGS_ADD_PORTION_KEY,
  parseCeilingsCollectionEnvelope,
} from "../lib/estimate/ceilings-portions";
import {
  applyDoorsFactWrite,
  DOORS_ADD_PORTION_KEY,
  storedDoorsPortions,
} from "../lib/estimate/doors-portions";
import {
  applyFlooringFactWrite,
  createEmptyFlooringPortion,
  FLOORING_ACTIVE_PORTION_ID_FACT_KEY,
  FLOORING_ADD_PORTION_KEY,
  FLOORING_CALCULATOR_CONSUMED_FACTS,
  FLOORING_DELETE_PORTION_KEY,
  FLOORING_DUPLICATE_PORTION_KEY,
  FLOORING_FINISH_TYPE_VALUES,
  FLOORING_HARDWOOD_BOARD_WIDTH_MM_VALUES,
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_ORDINARY_TILE_SIZES_MM,
  FLOORING_PORTION_FIELD_KEYS,
  FLOORING_PORTIONS_FACT_KEY,
  flooringFinishUsesHardwoodWidth,
  flooringFinishUsesPreparation,
  flooringFinishUsesTileDimensions,
  flooringFinishUsesUnderlay,
  hasCanonicalFlooringPortions,
  hasFlooringPortionsFact,
  isFlooringPortionWriteKey,
  isOrdinaryFlooringHardwoodBoardWidth,
  mergePersistedFlooringPortionsOnReanalyse,
  parseFlooringCollectionEnvelope,
  parseFlooringFinishType,
  parseFlooringFramingAllowanceLevel,
  parseFlooringHardwoodBoardWidthMm,
  parseFlooringPortion,
  parseFlooringPortions,
  parseFlooringPositiveMeasure,
  parseFlooringPositiveMm,
  parseFlooringSpecialistKind,
  resolveFlooringActivePortionId,
  storedFlooringPortions,
} from "../lib/estimate/flooring-portions";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { normalizeCanonicalFactKey } from "../lib/scopes/fact-keys";
import { getFactDisplayLabel } from "../lib/scopes/fact-labels";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

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

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[]
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

function writeFlooring(
  facts: readonly EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string | null,
  factSource?: string | null
): EstimateFact[] {
  return applyFlooringFactWrite({
    facts,
    workAreaId: "f1",
    key,
    value,
    nestedItemId,
    factSource,
  });
}

function nestedFlooringResult(facts: EstimateFact[]) {
  return calculateFlooring(
    ctx([wa("f1", "flooring", "Flooring")], facts),
    wa("f1", "flooring", "Flooring")
  );
}

function nestedBlocksLegacyMoney(facts: EstimateFact[]): boolean {
  const result = nestedFlooringResult(facts);
  const blob = JSON.stringify(result);
  const labels = result.lineItems.map((row) => row.label).join(" | ");
  const costs = result.lineItems.map((row) => row.recommendedCost ?? 0);
  return (
    result.lineItems.length === 0 &&
    (result.lineItems.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0) ===
      0) &&
    !costs.includes(FITOUT_BENCHMARKS.flooringPerM2.cost) &&
    !blob.includes("Using assumed removal area of 20") &&
    !blob.includes("scope.flooring.m2") &&
    !labels.includes("Scotia") &&
    !labels.includes("Underlay") &&
    !labels.includes("Existing flooring removal") &&
    !labels.includes("Floor preparation")
  );
}

console.log("=== FLOORING-01B-R1 domain ===\n");

const emptyCollectionFacts: EstimateFact[] = [
  fact(FLOORING_PORTIONS_FACT_KEY, "f1", { v: 1, portions: [] }, "system"),
];
check(
  "1. empty collection",
  parseFlooringCollectionEnvelope({ v: 1, portions: [] }).portions.length ===
    0 &&
    parseFlooringCollectionEnvelope({ v: 1, portions: [] }).v === 1 &&
    hasFlooringPortionsFact(emptyCollectionFacts, "f1") &&
    !hasCanonicalFlooringPortions(emptyCollectionFacts, "f1") &&
    createEmptyFlooringPortion({ id: "fa_empty" }).area_m2 === null &&
    createEmptyFlooringPortion({ id: "fa_empty" }).finish_type === null &&
    createEmptyFlooringPortion({ id: "fa_empty" }).substrate_required === null &&
    createEmptyFlooringPortion({ id: "fa_empty" }).finish_removal_required ===
      null
);

check(
  "2. finish enums",
  FLOORING_FINISH_TYPE_VALUES.join(",") ===
    "carpet,vinyl_plank,tile,hardwood,other" &&
    parseFlooringFinishType("carpet") === "carpet" &&
    parseFlooringFinishType("vinyl plank") === "vinyl_plank" &&
    parseFlooringFinishType("LVT") === "vinyl_plank" &&
    parseFlooringFinishType("tile") === "tile" &&
    parseFlooringFinishType("hardwood") === "hardwood" &&
    parseFlooringFinishType("timber") === "hardwood" &&
    parseFlooringFinishType("custom") === "other" &&
    parseFlooringFinishType("prehung") === null &&
    parseFlooringFinishType("unknown-finish") === null
);

check(
  "3. specialist non-coercion",
  parseFlooringFinishType("laminate") === "other" &&
    parseFlooringFinishType("engineered timber") === "other" &&
    parseFlooringFinishType("sheet vinyl") === "other" &&
    parseFlooringSpecialistKind("laminate") === "laminate" &&
    parseFlooringSpecialistKind("sheet vinyl") === "sheet_vinyl" &&
    parseFlooringFinishType("laminate") !== "hardwood" &&
    parseFlooringFinishType("laminate") !== "vinyl_plank"
);

check(
  "4. direct area",
  parseFlooringPositiveMeasure(24) === 24 &&
    parseFlooringPortion({
      id: "fa_area",
      area_m2: 24,
      area_input_method: "direct_m2",
    })?.area_m2 === 24
);

check(
  "5. invalid area",
  parseFlooringPositiveMeasure(0) === null &&
    parseFlooringPositiveMeasure(-1) === null &&
    parseFlooringPositiveMeasure(Number.NaN) === null &&
    parseFlooringPositiveMeasure(Number.POSITIVE_INFINITY) === null &&
    parseFlooringPositiveMeasure("twelve") === null &&
    parseFlooringPortion({ id: "fa_bad_area", area_m2: 0 })?.area_m2 === null
);

check(
  "6. dimensions",
  parseFlooringPositiveMeasure(4.2) === 4.2 &&
    parseFlooringPortion({
      id: "fa_dim",
      length_m: 5,
      width_m: 3,
      area_input_method: "length_width",
    })?.length_m === 5 &&
    parseFlooringPortion({
      id: "fa_dim2",
      length_m: 5,
      width_m: 3,
    })?.width_m === 3 &&
    parseFlooringPositiveMeasure(0) === null
);

check(
  "7. standard tile sizes",
  FLOORING_ORDINARY_TILE_SIZES_MM.every(
    (size) =>
      parseFlooringPositiveMm(size.width_mm) === size.width_mm &&
      parseFlooringPositiveMm(size.length_mm) === size.length_mm
  ) &&
    parseFlooringPortion({
      id: "fa_tile",
      finish_type: "tile",
      tile_width_mm: 600,
      tile_length_mm: 600,
    })?.tile_width_mm === 600
);

check(
  "8. custom tile size",
  parseFlooringPositiveMm(400) === 400 &&
    parseFlooringPositiveMm(800) === 800 &&
    parseFlooringPortion({
      id: "fa_custom_tile",
      finish_type: "tile",
      tile_width_mm: 400,
      tile_length_mm: 800,
    })?.tile_length_mm === 800
);

check(
  "9. invalid tile size",
  parseFlooringPositiveMm(0) === null &&
    parseFlooringPositiveMm(-300) === null &&
    parseFlooringPositiveMm(Number.NaN) === null &&
    parseFlooringPositiveMm(Number.POSITIVE_INFINITY) === null &&
    parseFlooringPortion({
      id: "fa_bad_tile",
      finish_type: "tile",
      tile_width_mm: 0,
    })?.tile_width_mm === null
);

check(
  "10. standard hardwood widths",
  FLOORING_HARDWOOD_BOARD_WIDTH_MM_VALUES.every(
    (width) =>
      parseFlooringHardwoodBoardWidthMm(width) === width &&
      isOrdinaryFlooringHardwoodBoardWidth(width)
  ) && parseFlooringHardwoodBoardWidthMm(145) === 145
);

check(
  "11. custom hardwood width",
  parseFlooringHardwoodBoardWidthMm(200) === 200 &&
    !isOrdinaryFlooringHardwoodBoardWidth(200) &&
    parseFlooringPortion({
      id: "fa_hw",
      finish_type: "hardwood",
      hardwood_board_width_mm: 200,
    })?.hardwood_board_width_mm === 200 &&
    parseFlooringHardwoodBoardWidthMm(0) === null &&
    parseFlooringHardwoodBoardWidthMm(-145) === null
);

const carpetParsed = parseFlooringPortion({
  id: "fa_carpet",
  finish_type: "carpet",
  underlay_required: true,
  tile_width_mm: 600,
  tile_width_authority: "extracted",
  floor_preparation_required: true,
  preparation_authority: "extracted",
  hardwood_board_width_mm: 145,
  hardwood_width_authority: "extracted",
});
const carpetUserStale = parseFlooringPortion({
  id: "fa_carpet_user",
  finish_type: "carpet",
  tile_width_mm: 600,
  tile_width_authority: "user",
});
check(
  "12. carpet applicability",
  flooringFinishUsesUnderlay("carpet") &&
    !flooringFinishUsesPreparation("carpet") &&
    !flooringFinishUsesTileDimensions("carpet") &&
    !flooringFinishUsesHardwoodWidth("carpet") &&
    carpetParsed?.underlay_required === true &&
    carpetParsed?.tile_width_mm == null &&
    carpetParsed?.floor_preparation_required == null &&
    carpetParsed?.hardwood_board_width_mm == null &&
    carpetUserStale?.tile_width_mm === 600
);

const vinylParsed = parseFlooringPortion({
  id: "fa_vinyl",
  finish_type: "vinyl_plank",
  floor_preparation_required: true,
  underlay_required: true,
  underlay_authority: "extracted",
  tile_width_mm: 600,
  tile_width_authority: "extracted",
  hardwood_board_width_mm: 190,
  hardwood_width_authority: "extracted",
});
check(
  "13. vinyl applicability",
  flooringFinishUsesPreparation("vinyl_plank") &&
    !flooringFinishUsesUnderlay("vinyl_plank") &&
    !flooringFinishUsesTileDimensions("vinyl_plank") &&
    !flooringFinishUsesHardwoodWidth("vinyl_plank") &&
    vinylParsed?.floor_preparation_required === true &&
    vinylParsed?.underlay_required == null &&
    vinylParsed?.tile_width_mm == null &&
    vinylParsed?.hardwood_board_width_mm == null
);

const tileParsed = parseFlooringPortion({
  id: "fa_tile_app",
  finish_type: "tile",
  floor_preparation_required: true,
  tile_width_mm: 300,
  tile_length_mm: 600,
  underlay_required: true,
  underlay_authority: "extracted",
  hardwood_board_width_mm: 165,
  hardwood_width_authority: "extracted",
});
check(
  "14. tile applicability",
  flooringFinishUsesPreparation("tile") &&
    flooringFinishUsesTileDimensions("tile") &&
    !flooringFinishUsesUnderlay("tile") &&
    !flooringFinishUsesHardwoodWidth("tile") &&
    tileParsed?.tile_width_mm === 300 &&
    tileParsed?.tile_length_mm === 600 &&
    tileParsed?.floor_preparation_required === true &&
    tileParsed?.underlay_required == null &&
    tileParsed?.hardwood_board_width_mm == null
);

const hardwoodParsed = parseFlooringPortion({
  id: "fa_hw_app",
  finish_type: "hardwood",
  hardwood_board_width_mm: 186,
  underlay_required: true,
  underlay_authority: "extracted",
  floor_preparation_required: true,
  preparation_authority: "extracted",
  tile_width_mm: 600,
  tile_width_authority: "extracted",
});
check(
  "15. hardwood applicability",
  flooringFinishUsesHardwoodWidth("hardwood") &&
    !flooringFinishUsesUnderlay("hardwood") &&
    !flooringFinishUsesPreparation("hardwood") &&
    !flooringFinishUsesTileDimensions("hardwood") &&
    hardwoodParsed?.hardwood_board_width_mm === 186 &&
    hardwoodParsed?.underlay_required == null &&
    hardwoodParsed?.floor_preparation_required == null &&
    hardwoodParsed?.tile_width_mm == null
);

let substrateFacts = writeFlooring([], FLOORING_ADD_PORTION_KEY, true);
const substrateId = storedFlooringPortions(substrateFacts, "f1")[0]!.id;
substrateFacts = writeFlooring(
  substrateFacts,
  "flooring.portion.substrate_required",
  "Not sure",
  substrateId
);
const substrateUnsure = storedFlooringPortions(substrateFacts, "f1")[0];
substrateFacts = writeFlooring(
  substrateFacts,
  "flooring.portion.substrate_required",
  true,
  substrateId
);
substrateFacts = writeFlooring(
  substrateFacts,
  "flooring.portion.substrate_family",
  "particleboard",
  substrateId
);
const substrateYes = storedFlooringPortions(substrateFacts, "f1")[0];
substrateFacts = writeFlooring(
  substrateFacts,
  "flooring.portion.substrate_required",
  false,
  substrateId
);
const substrateNo = storedFlooringPortions(substrateFacts, "f1")[0];
check(
  "16. substrate tri-state",
  substrateUnsure?.substrate_required === null &&
    substrateYes?.substrate_required === true &&
    substrateYes?.substrate_family === "particleboard" &&
    substrateNo?.substrate_required === false
);

substrateFacts = writeFlooring(
  substrateFacts,
  "flooring.portion.substrate_required",
  true,
  substrateId
);
substrateFacts = writeFlooring(
  substrateFacts,
  "flooring.portion.substrate_item_key",
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  substrateId
);
const inventedKeyFacts = writeFlooring(
  substrateFacts,
  "flooring.portion.substrate_item_key",
  "particleboard.21mm.2400x1200",
  substrateId
);
check(
  "17. exact substrate key",
  storedFlooringPortions(substrateFacts, "f1")[0]?.substrate_item_key ===
    BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY &&
    storedFlooringPortions(inventedKeyFacts, "f1")[0]?.substrate_item_key ==
      null
);

let framingFacts = writeFlooring([], FLOORING_ADD_PORTION_KEY, true);
const framingId = storedFlooringPortions(framingFacts, "f1")[0]!.id;
framingFacts = writeFlooring(
  framingFacts,
  "flooring.portion.framing_required",
  "Not sure",
  framingId
);
const framingUnsure = storedFlooringPortions(framingFacts, "f1")[0];
framingFacts = writeFlooring(
  framingFacts,
  "flooring.portion.framing_required",
  true,
  framingId
);
framingFacts = writeFlooring(
  framingFacts,
  "flooring.portion.framing_allowance_level",
  "standard",
  framingId
);
const framingYes = storedFlooringPortions(framingFacts, "f1")[0];
check(
  "18. framing tri-state",
  framingUnsure?.framing_required === null &&
    framingYes?.framing_required === true &&
    framingYes?.framing_allowance_level === "standard" &&
    parseFlooringFramingAllowanceLevel("extreme") === null &&
    parseFlooringFramingAllowanceLevel("minor") === "minor"
);

let removalFacts = writeFlooring([], FLOORING_ADD_PORTION_KEY, true);
const removalId = storedFlooringPortions(removalFacts, "f1")[0]!.id;
removalFacts = writeFlooring(
  removalFacts,
  "flooring.portion.finish_removal_required",
  true,
  removalId
);
const afterFinishRemoval = storedFlooringPortions(removalFacts, "f1")[0];
removalFacts = writeFlooring(
  removalFacts,
  "flooring.portion.existing_finish_type",
  "carpet",
  removalId
);
const afterExisting = storedFlooringPortions(removalFacts, "f1")[0];
removalFacts = writeFlooring(
  removalFacts,
  "flooring.portion.substrate_removal_required",
  true,
  removalId
);
const afterSubstrateRemoval = storedFlooringPortions(removalFacts, "f1")[0];
check(
  "19. removal sequence",
  afterFinishRemoval?.finish_removal_required === true &&
    afterFinishRemoval?.existing_finish_type === null &&
    afterFinishRemoval?.substrate_removal_required === null &&
    afterExisting?.existing_finish_type === "carpet" &&
    afterExisting?.substrate_removal_required === null &&
    afterSubstrateRemoval?.substrate_removal_required === true
);

const emptyShape = createEmptyFlooringPortion({ id: "fa_deferred" }) as Record<
  string,
  unknown
>;
const portionsSrc = read("lib/estimate/flooring-portions.ts");
check(
  "20. deferred fields absent",
  !("scotia_included" in emptyShape) &&
    !("disposal_included" in emptyShape) &&
    !("stair_count" in emptyShape) &&
    !("waste_percent" in emptyShape) &&
    !("waterproofing_included" in emptyShape) &&
    !("client_supplied" in emptyShape) &&
    !portionsSrc.includes("flooring.portion.scotia") &&
    !portionsSrc.includes("flooring.portion.disposal") &&
    !portionsSrc.includes("flooring.portion.stair") &&
    !portionsSrc.includes("wastagePercent") &&
    !portionsSrc.includes("adhesive") &&
    !portionsSrc.includes("grout")
);

let facts = writeFlooring([], FLOORING_ADD_PORTION_KEY, true);
const first = storedFlooringPortions(facts, "f1")[0];
check(
  "21. Add",
  Boolean(first?.id) &&
    first?.finish_type === null &&
    first?.area_m2 === null &&
    storedFlooringPortions(facts, "f1").length === 1
);

facts = writeFlooring(facts, "flooring.portion.finish_type", "carpet", first!.id);
facts = writeFlooring(facts, "flooring.portion.area_m2", 24, first!.id);
facts = writeFlooring(facts, "flooring.portion.underlay_required", true, first!.id);
facts = writeFlooring(facts, "flooring.portion.label", "Lounge", first!.id);
facts = writeFlooring(facts, FLOORING_DUPLICATE_PORTION_KEY, first!.id);
const afterDup = storedFlooringPortions(facts, "f1");
check(
  "22. Duplicate",
  afterDup.length === 2 &&
    afterDup[0]!.id !== afterDup[1]!.id &&
    afterDup[1]!.area_m2 === 24 &&
    afterDup[1]!.finish_type === "carpet" &&
    afterDup[1]!.label === "Lounge copy"
);

const beforeDeleteIds = afterDup.map((row) => row.id);
facts = writeFlooring(facts, FLOORING_DELETE_PORTION_KEY, afterDup[1]!.id);
const afterDelete = storedFlooringPortions(facts, "f1");
check(
  "23. Delete",
  afterDelete.length === 1 &&
    afterDelete[0]!.id === beforeDeleteIds[0] &&
    afterDelete[0]!.area_m2 === 24
);

facts = writeFlooring(facts, FLOORING_ADD_PORTION_KEY, true);
const twoPortions = storedFlooringPortions(facts, "f1");
facts = writeFlooring(
  facts,
  FLOORING_ACTIVE_PORTION_ID_FACT_KEY,
  twoPortions[1]!.id
);
facts = writeFlooring(facts, "flooring.portion.area_m2", 9);
const afterActiveWrite = storedFlooringPortions(facts, "f1");
check(
  "24. active pointer",
  resolveFlooringActivePortionId(facts, "f1", afterActiveWrite) ===
    twoPortions[1]!.id &&
    afterActiveWrite[0]!.area_m2 === 24 &&
    afterActiveWrite[1]!.area_m2 === 9
);

check(
  "25. sibling isolation",
  afterActiveWrite[0]!.label === "Lounge" &&
    afterActiveWrite[0]!.finish_type === "carpet" &&
    afterActiveWrite[1]!.label === null &&
    afterActiveWrite[1]!.finish_type === null
);

const areaAuthorityBefore = afterActiveWrite[0]!.area_authority;
facts = writeFlooring(
  facts,
  "flooring.portion.finish_type",
  "vinyl_plank",
  afterActiveWrite[0]!.id
);
const afterOneField = storedFlooringPortions(facts, "f1")[0];
check(
  "26. authority isolation",
  afterOneField?.finish_type === "vinyl_plank" &&
    afterOneField?.finish_authority === "user" &&
    afterOneField?.area_m2 === 24 &&
    afterOneField?.area_authority === areaAuthorityBefore &&
    storedFlooringPortions(facts, "f1")[1]?.area_m2 === 9
);

const userBeats = mergePersistedFlooringPortionsOnReanalyse({
  extracted: [
    {
      id: afterOneField!.id,
      finish_type: "tile",
      area_m2: 99,
      tile_width_mm: 600,
      tile_length_mm: 600,
    },
  ],
  persisted: [
    {
      ...createEmptyFlooringPortion({ id: afterOneField!.id }),
      area_m2: 24,
      area_authority: "user",
      finish_type: "vinyl_plank",
      finish_authority: "user",
    },
  ],
});
check(
  "27. user merge precedence",
  userBeats[0]?.area_m2 === 24 &&
    userBeats[0]?.area_authority === "user" &&
    userBeats[0]?.finish_type === "vinyl_plank" &&
    userBeats[0]?.finish_authority === "user"
);

const extractedFill = mergePersistedFlooringPortionsOnReanalyse({
  extracted: [
    {
      id: "fa_fill",
      finish_type: "carpet",
      area_m2: 40,
      area_authority: "extracted",
    },
  ],
  persisted: [
    {
      ...createEmptyFlooringPortion({ id: "fa_fill" }),
      finish_type: "carpet",
      finish_authority: "user",
      area_m2: null,
    },
  ],
});
const extractedUpdatesMachine = mergePersistedFlooringPortionsOnReanalyse({
  extracted: [
    {
      id: "fa_machine",
      finish_type: "carpet",
      area_m2: 40,
      area_authority: "extracted",
    },
  ],
  persisted: [
    {
      ...createEmptyFlooringPortion({ id: "fa_machine" }),
      area_m2: 24,
      area_authority: "extracted",
      finish_type: "carpet",
      finish_authority: "extracted",
    },
  ],
});
check(
  "28. extracted fill",
  extractedFill[0]?.area_m2 === 40 &&
    extractedFill[0]?.finish_type === "carpet" &&
    extractedUpdatesMachine[0]?.area_m2 === 40
);

const identical = mergePersistedFlooringPortionsOnReanalyse({
  extracted: [
    { id: "fa_a", finish_type: "carpet", area_m2: 24, clause_ordinal: 0 },
    { id: "fa_b", finish_type: "carpet", area_m2: 24, clause_ordinal: 1 },
  ],
  persisted: [
    {
      ...createEmptyFlooringPortion({ id: "fa_a" }),
      finish_type: "carpet",
      area_m2: 24,
      area_authority: "user",
      clause_ordinal: 0,
    },
    {
      ...createEmptyFlooringPortion({ id: "fa_b" }),
      finish_type: "carpet",
      area_m2: 24,
      area_authority: "user",
      clause_ordinal: 1,
    },
  ],
});
check(
  "29. identical portions preserved",
  identical.length === 2 &&
    identical[0]!.id === "fa_a" &&
    identical[1]!.id === "fa_b" &&
    identical[0]!.area_m2 === 24 &&
    identical[1]!.area_m2 === 24 &&
    parseFlooringPortions([
      { id: "fa_dup", area_m2: 10 },
      { id: "fa_dup", area_m2: 20 },
    ]).length === 1 &&
    parseFlooringPortions([
      { id: "fa_dup", area_m2: 10 },
      { id: "fa_dup", area_m2: 20 },
    ])[0]?.area_m2 === 10
);

const specialistPreserved = mergePersistedFlooringPortionsOnReanalyse({
  extracted: [
    {
      id: "fa_spec",
      finish_type: "vinyl_plank",
      area_m2: 18,
    },
  ],
  persisted: [
    {
      ...createEmptyFlooringPortion({ id: "fa_spec" }),
      finish_type: "other",
      finish_authority: "user",
      specialist_kind: "laminate",
      specialist_authority: "user",
      other_description: "Click laminate lounge",
      other_description_authority: "user",
    },
  ],
});
check(
  "30. specialist user choice preserved",
  specialistPreserved[0]?.finish_type === "other" &&
    specialistPreserved[0]?.specialist_kind === "laminate" &&
    specialistPreserved[0]?.other_description === "Click laminate lounge" &&
    specialistPreserved[0]?.id === "fa_spec"
);

const extractedCollection: EstimateFact[] = [
  fact(
    FLOORING_PORTIONS_FACT_KEY,
    "f1",
    [createEmptyFlooringPortion({ id: "fa_src" })],
    "ai_extracted"
  ),
];
const afterNested = writeFlooring(
  extractedCollection,
  "flooring.portion.area_m2",
  18,
  "fa_src"
);
const collectionRows = afterNested.filter(
  (row) =>
    row.work_area_id === "f1" &&
    (row.key === FLOORING_PORTIONS_FACT_KEY ||
      row.key === FLOORING_ACTIVE_PORTION_ID_FACT_KEY)
);
check(
  "31. one persisted collection row",
  afterNested.filter((row) => row.key === FLOORING_PORTIONS_FACT_KEY).length ===
    1 &&
    afterNested.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.source ===
      "ai_extracted" &&
    collectionRows.length <= 2
);

check(
  "32. no scalar sibling facts",
  afterNested.every(
    (row) =>
      row.key === FLOORING_PORTIONS_FACT_KEY ||
      row.key === FLOORING_ACTIVE_PORTION_ID_FACT_KEY
  ) &&
    !afterNested.some((row) => row.key === "flooring.portion.area_m2") &&
    !isFlooringPortionWriteKey("flooring.area_m2") &&
    FLOORING_PORTION_FIELD_KEYS.every((key) => isFlooringPortionWriteKey(key))
);

const bathroomFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 2.4),
  fact("bathroom.width_m", "b1", 1.8),
  fact("bathroom.floor_finish_system", "b1", "tile"),
];
const bathroomBefore = calculateBathroom(
  ctx([wa("b1", "bathroom", "Bathroom")], bathroomFacts),
  wa("b1", "bathroom", "Bathroom")
);
const bathroomMixed = applyFlooringFactWrite({
  facts: [...bathroomFacts, ...afterNested],
  workAreaId: "f1",
  key: "flooring.portion.finish_type",
  value: "tile",
});
const bathroomAfter = calculateBathroom(
  ctx(
    [wa("b1", "bathroom", "Bathroom"), wa("f1", "flooring", "Flooring")],
    bathroomMixed
  ),
  wa("b1", "bathroom", "Bathroom")
);
check(
  "33. Bathroom isolation",
  bathroomBefore.lineItems.length === bathroomAfter.lineItems.length &&
    bathroomBefore.lineItems.reduce(
      (sum, row) => sum + (row.recommendedCost ?? 0),
      0
    ) ===
      bathroomAfter.lineItems.reduce(
        (sum, row) => sum + (row.recommendedCost ?? 0),
        0
      ) &&
    JSON.stringify(
      bathroomMixed.filter((row) => row.key.startsWith("bathroom."))
    ) === JSON.stringify(bathroomFacts) &&
    !bathroomFacts.some((row) => row.key === FLOORING_PORTIONS_FACT_KEY)
);

const kitchenFacts = [
  fact("kitchen.area_m2", "k1", 12),
  fact("kitchen.flooring_included", "k1", true),
];
const kitchenBefore = calculateKitchen(
  ctx([wa("k1", "kitchen", "Kitchen")], kitchenFacts),
  wa("k1", "kitchen", "Kitchen")
);
const kitchenMixed = applyFlooringFactWrite({
  facts: [...kitchenFacts, ...afterNested],
  workAreaId: "f1",
  key: "flooring.portion.area_m2",
  value: 10,
});
const kitchenAfter = calculateKitchen(
  ctx(
    [wa("k1", "kitchen", "Kitchen"), wa("f1", "flooring", "Flooring")],
    kitchenMixed
  ),
  wa("k1", "kitchen", "Kitchen")
);
check(
  "34. Kitchen isolation",
  kitchenBefore.lineItems.length === kitchenAfter.lineItems.length &&
    JSON.stringify(
      kitchenMixed.filter((row) => row.key.startsWith("kitchen."))
    ) === JSON.stringify(kitchenFacts) &&
    !kitchenFacts.some((row) => row.key === FLOORING_PORTIONS_FACT_KEY)
);

const demoFacts = [
  fact("demolition.floor_area_m2", "dm1", 30),
  fact("demolition.scope_items", "dm1", ["Flooring"]),
];
const demoBefore = calculateDemolition(
  ctx([wa("dm1", "demolition", "Demolition")], demoFacts),
  wa("dm1", "demolition", "Demolition")
);
const demoMixed = applyFlooringFactWrite({
  facts: [...demoFacts, ...afterNested],
  workAreaId: "f1",
  key: FLOORING_ADD_PORTION_KEY,
  value: true,
});
const demoAfter = calculateDemolition(
  ctx(
    [wa("dm1", "demolition", "Demolition"), wa("f1", "flooring", "Flooring")],
    demoMixed
  ),
  wa("dm1", "demolition", "Demolition")
);
check(
  "35. Demolition isolation",
  demoBefore.lineItems.length === demoAfter.lineItems.length &&
    JSON.stringify(
      demoMixed.filter((row) => row.key.startsWith("demolition."))
    ) === JSON.stringify(demoFacts)
);

const scalarNoMap = applyFlooringFactWrite({
  facts: [fact("flooring.area_m2", "f1", 20)],
  workAreaId: "f1",
  key: "flooring.area_m2",
  value: 20,
});
check(
  "36. scalar Flooring does not auto-map",
  !hasFlooringPortionsFact(scalarNoMap, "f1") &&
    storedFlooringPortions(scalarNoMap, "f1").length === 0 &&
    normalizeCanonicalFactKey("flooring.area_m2", "flooring") ===
      "flooring.area_m2" &&
    normalizeCanonicalFactKey("finish_type", "flooring") ===
      "flooring.portion.finish_type"
);

const legacyFlooring = calculateFlooring(
  ctx([wa("f1", "flooring", "Flooring")], [fact("flooring.area_m2", "f1", 20)]),
  wa("f1", "flooring", "Flooring")
);
check(
  "37. flat legacy control",
  legacyFlooring.lineItems.length > 0 &&
    !legacyFlooring.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE)
);

check(
  "38. nested empty blocks legacy",
  nestedBlocksLegacyMoney(emptyCollectionFacts)
);

const incompleteFacts = writeFlooring(
  writeFlooring([], FLOORING_ADD_PORTION_KEY, true),
  "flooring.portion.finish_type",
  "carpet"
);
check(
  "39. nested incomplete blocks legacy",
  nestedBlocksLegacyMoney(incompleteFacts) &&
    storedFlooringPortions(incompleteFacts, "f1")[0]?.area_m2 === null
);

let specialistFacts = writeFlooring([], FLOORING_ADD_PORTION_KEY, true);
const specialistId = storedFlooringPortions(specialistFacts, "f1")[0]!.id;
specialistFacts = writeFlooring(
  specialistFacts,
  "flooring.portion.finish_type",
  "other",
  specialistId
);
specialistFacts = writeFlooring(
  specialistFacts,
  "flooring.portion.specialist_kind",
  "laminate",
  specialistId
);
specialistFacts = writeFlooring(
  specialistFacts,
  "flooring.portion.area_m2",
  22,
  specialistId
);
check(
  "40. nested specialist blocks legacy",
  nestedBlocksLegacyMoney(specialistFacts)
);

let completeFacts = writeFlooring([], FLOORING_ADD_PORTION_KEY, true);
const completeId = storedFlooringPortions(completeFacts, "f1")[0]!.id;
completeFacts = writeFlooring(
  completeFacts,
  "flooring.portion.finish_type",
  "carpet",
  completeId
);
completeFacts = writeFlooring(
  completeFacts,
  "flooring.portion.area_m2",
  24,
  completeId
);
completeFacts = writeFlooring(
  completeFacts,
  "flooring.portion.underlay_required",
  true,
  completeId
);
const completeResult = nestedFlooringResult(completeFacts);
check(
  "41. nested complete does not commercially calculate yet",
  nestedBlocksLegacyMoney(completeFacts) &&
    completeResult.lineItems.length === 0 &&
    !completeResult.lineItems.some(
      (row) => row.recommendedCost === FITOUT_BENCHMARKS.flooringPerM2.cost
    )
);

const nestedWithLegacySiblings = [
  ...completeFacts,
  fact("flooring.area_m2", "f1", 20),
  fact("flooring.stair_count", "f1", 12),
  fact("flooring.scotia_included", "f1", true),
];
const emptyWithLegacySiblings = [
  ...emptyCollectionFacts,
  fact("flooring.area_m2", "f1", 20),
  fact("flooring.stair_count", "f1", 12),
  fact("flooring.scotia_included", "f1", true),
];
check(
  "42. no invented 20 m²",
  nestedBlocksLegacyMoney(emptyWithLegacySiblings) &&
    nestedBlocksLegacyMoney(nestedWithLegacySiblings) &&
    !JSON.stringify(nestedFlooringResult(emptyCollectionFacts)).includes("20 m")
);

check(
  "43. no invented stairs",
  nestedBlocksLegacyMoney(nestedWithLegacySiblings) &&
    nestedBlocksLegacyMoney(specialistFacts) &&
    !JSON.stringify(nestedFlooringResult(completeFacts)).includes('"quantity":12')
);

check(
  "44. no invented scotia",
  nestedBlocksLegacyMoney(nestedWithLegacySiblings) &&
    !JSON.stringify(nestedFlooringResult(completeFacts)).includes("Scotia") &&
    !portionsSrc.includes("Math.sqrt")
);

const nestedQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "flooring",
  name: "Flooring",
  facts: [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      label: "Flooring areas",
      value: JSON.stringify({
        v: 1,
        portions: [
          {
            id: "fa_q",
            finish_type: "carpet",
            area_m2: 24,
            underlay_required: true,
          },
        ],
      }),
    },
    {
      key: "flooring.type",
      label: "Floor type",
      value: "carpet",
    },
  ],
});
check(
  "45. no Quote JSON leak",
  !nestedQuote.includes("finish_type") &&
    !nestedQuote.includes('"portions"') &&
    !nestedQuote.includes('"v":') &&
    !nestedQuote.includes("fa_q") &&
    !nestedQuote.includes("{") &&
    nestedQuote.toLowerCase().includes("flooring")
);

const doorFacts = applyDoorsFactWrite({
  facts: [],
  workAreaId: "d1",
  key: DOORS_ADD_PORTION_KEY,
  value: true,
});
const mixedDoors = [
  ...doorFacts,
  ...writeFlooring([], FLOORING_ADD_PORTION_KEY, true),
];
const afterFlooringOverDoors = applyFlooringFactWrite({
  facts: mixedDoors,
  workAreaId: "f1",
  key: "flooring.portion.area_m2",
  value: 10,
});
const afterDoorsOverFlooring = applyDoorsFactWrite({
  facts: afterFlooringOverDoors,
  workAreaId: "d1",
  key: "doors.portion.quantity",
  value: 2,
});
check(
  "46. Doors unchanged",
  JSON.stringify(
    afterFlooringOverDoors
      .filter((row) => row.key.startsWith("doors."))
      .map((row) => ({ key: row.key, value: row.value }))
  ) ===
    JSON.stringify(
      doorFacts.map((row) => ({ key: row.key, value: row.value }))
    ) &&
    storedDoorsPortions(afterFlooringOverDoors, "d1").length ===
      storedDoorsPortions(doorFacts, "d1").length &&
    storedFlooringPortions(afterDoorsOverFlooring, "f1").length ===
      storedFlooringPortions(afterFlooringOverDoors, "f1").length &&
    calculateDoors(
      ctx([wa("d1", "doors", "Doors")], [fact("doors.count", "d1", 2)]),
      wa("d1", "doors", "Doors")
    ).lineItems.length > 0
);

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
const mixedCeilings = [
  ...ceilingFacts,
  ...writeFlooring([], FLOORING_ADD_PORTION_KEY, true),
];
const afterFlooringOverCeilings = applyFlooringFactWrite({
  facts: mixedCeilings,
  workAreaId: "f1",
  key: "flooring.portion.finish_type",
  value: "tile",
});
const afterCeilingsOverFlooring = applyCeilingsFactWrite({
  facts: afterFlooringOverCeilings,
  workAreaId: "c1",
  key: "ceilings.portion.area_m2",
  value: 44,
});
check(
  "47. Ceilings unchanged",
  parseCeilingsCollectionEnvelope(
    afterFlooringOverCeilings.find((row) => row.key === "ceilings.portions")
      ?.value
  ).portions[0]?.geometry.area_m2 === 40 &&
    storedFlooringPortions(afterCeilingsOverFlooring, "f1")[0]?.finish_type ===
      "tile"
);

const iwFacts = [
  fact("internal_walls.length_lm", "iw1", 12),
  fact("internal_walls.height_m", "iw1", 2.4),
];
const iwBefore = calculateInternalWalls(
  ctx([wa("iw1", "internal_walls", "Internal Walls")], iwFacts),
  wa("iw1", "internal_walls", "Internal Walls")
);
const iwMixed = applyFlooringFactWrite({
  facts: [...iwFacts, ...completeFacts],
  workAreaId: "f1",
  key: "flooring.portion.label",
  value: "Hall",
});
const iwAfter = calculateInternalWalls(
  ctx(
    [
      wa("iw1", "internal_walls", "Internal Walls"),
      wa("f1", "flooring", "Flooring"),
    ],
    iwMixed
  ),
  wa("iw1", "internal_walls", "Internal Walls")
);
check(
  "48. Internal Walls unchanged",
  iwBefore.lineItems.length === iwAfter.lineItems.length &&
    iwBefore.lineItems.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0) ===
      iwAfter.lineItems.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0) &&
    JSON.stringify(
      iwMixed.filter((row) => row.key.startsWith("internal_walls."))
    ) === JSON.stringify(iwFacts) &&
    !iwFacts.some((row) => row.key === FLOORING_PORTIONS_FACT_KEY)
);

console.log("\n=== FLOORING-01B-R1 extra contract ===\n");

let otherFacts = writeFlooring([], FLOORING_ADD_PORTION_KEY, true);
const otherId = storedFlooringPortions(otherFacts, "f1")[0]!.id;
otherFacts = writeFlooring(
  otherFacts,
  "flooring.portion.finish_type",
  "other",
  otherId
);
otherFacts = writeFlooring(
  otherFacts,
  "flooring.portion.other_description",
  "Cork lounge",
  otherId
);
check(
  "49. nested other/custom blocks legacy and is not coerced",
  storedFlooringPortions(otherFacts, "f1")[0]?.finish_type === "other" &&
    storedFlooringPortions(otherFacts, "f1")[0]?.other_description ===
      "Cork lounge" &&
    nestedBlocksLegacyMoney(otherFacts)
);

check(
  "50. nested removal-only blocks legacy",
  nestedBlocksLegacyMoney(removalFacts) &&
    storedFlooringPortions(removalFacts, "f1")[0]?.finish_removal_required ===
      true &&
    storedFlooringPortions(removalFacts, "f1")[0]?.area_m2 === null
);

check(
  "51. fact-key / label / consumed registries",
  getFactDisplayLabel("flooring.portions") === "Flooring areas" &&
    isCalculatorConsumedFact("flooring", FLOORING_PORTIONS_FACT_KEY) &&
    FLOORING_CALCULATOR_CONSUMED_FACTS.includes(FLOORING_PORTIONS_FACT_KEY) &&
    isFlooringNestedFactKey("flooring.portion.area_m2") &&
    normalizeCanonicalFactKey("specialist_kind", "flooring") ===
      "flooring.portion.specialist_kind"
);

check(
  "52. CAS persist path wraps { v, portions }",
  read("lib/assistant/scope-persistence.ts").includes(
    "persistFlooringPortionsCollectionWrite"
  ) &&
    read("lib/assistant/scope-persistence.ts").includes("FLOORING_PORTIONS_FACT_KEY") &&
    read("lib/assistant/scope-persistence.ts").includes("value->>v") &&
    read("lib/assistant/scope-persistence.ts").includes("v: envelope.v + 1")
);

check(
  "53. job-plan overlay / mutation reload / Refine scalar exclusion",
  read("lib/assistant/job-plan/facts.ts").includes("applyFlooringFactWrite") &&
    read("lib/assistant/assistant-mutation-result-reload.ts").includes(
      "isFlooringPortionWriteKey"
    ) &&
    read("lib/assistant/refine/compose.ts").includes("isFlooringPortionWriteKey") &&
    read("lib/assistant/question-identity.ts").includes(
      "flooringPortionQuestionIdentity"
    ) &&
    read("lib/assistant/actions.ts").includes(
      "mergePersistedFlooringPortionsOnReanalyse"
    )
);

check(
  "54. no money, productivity, or waste invented in flooring-portions",
  !portionsSrc.includes("defaultCostRate") &&
    !portionsSrc.includes("hours_per_m2") &&
    !portionsSrc.includes("wastagePercent") &&
    !portionsSrc.includes("recommendedCost") &&
    !portionsSrc.includes("FITOUT_BENCHMARKS")
);

check(
  "55. clause ordinal supports later extraction matching",
  identical[0]?.clause_ordinal === 0 &&
    identical[1]?.clause_ordinal === 1 &&
    mergePersistedFlooringPortionsOnReanalyse({
      extracted: [
        {
          id: "extracted-new",
          finish_type: "carpet",
          area_m2: 24,
          clause_ordinal: 0,
        },
      ],
      persisted: [
        {
          ...createEmptyFlooringPortion({ id: "fa_clause" }),
          finish_type: "carpet",
          area_m2: 24,
          area_authority: "user",
          clause_ordinal: 0,
        },
      ],
    })[0]?.id === "fa_clause"
);

check(
  "56. deletion/re-analysis leftover is documented for FLOORING-02",
  portionsSrc.includes("FLOORING-02 leftovers") &&
    portionsSrc.includes("tombstone")
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);

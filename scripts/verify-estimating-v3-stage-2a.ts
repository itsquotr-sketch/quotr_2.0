/**
 * Estimating V3 Stage 2A — Analysis to Details handoff.
 *
 * Run: npx --yes tsx scripts/verify-estimating-v3-stage-2a.ts
 *
 * Deterministic. No model, network, or database.
 * The partition and carpet-tile sentences keep the Stage 0 wording and add
 * only the scope the Stage 2A request named. Pricing, quantities, and the
 * fascia fallback are not treated as fixed.
 */
import { reanalysisFactWrite } from "../lib/ai/mappers";
import { deckExposedPerimeterM } from "../lib/estimate/deck-fascia";
import { listDeckClarifyDescriptors } from "../lib/estimate/deck-question-descriptors";
import { extractDoorPortionsFromBrief } from "../lib/estimate/doors-brief";
import { briefHasIndependentDoors } from "../lib/work-areas/ownership";
import {
  applyExtractedInternalWallsToFacts,
  extractInternalWallsTypesFromBrief,
  mergePersistedInternalWallTypesOnReanalyse,
} from "../lib/estimate/internal-walls-brief";
import { nextInternalWallsFinishField } from "../lib/estimate/internal-walls-finish";
import { resolveInternalWallsWallTypes } from "../lib/estimate/internal-walls-wall-types";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import {
  FLOORING_PORTIONS_FACT_KEY,
  applyFlooringFactWrite,
  mergePersistedFlooringPortionsOnReanalyse,
  parseFlooringPortions,
} from "../lib/estimate/flooring-portions";
import type { EstimateFact } from "../lib/estimate/types";
import { matchExistingWorkAreaInstance } from "../lib/work-areas/instances";

const PARTITION_BRIEF =
  "Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, insulation, one door opening, door assembly and stopping. Painting and skirting excluded.";
const OFFICE_BRIEF =
  "Office fitout. New internal partitions, plasterboard both sides, with acoustic insulation, doors, skirting and painting. Supply and install 18 m2 of carpet tiles in the meeting room. No removal.";
const FLOORING_BRIEF =
  "Flooring. Bedroom 1, 12 m2 carpet. Bedroom 2, 10 m2 carpet. Hallway 8 m2 vinyl plank. No removal.";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

const wallSpecs = extractInternalWallsTypesFromBrief(PARTITION_BRIEF);
const wallFacts = applyExtractedInternalWallsToFacts({
  facts: [],
  workAreaId: "walls",
  types: wallSpecs,
});
const wall = resolveInternalWallsWallTypes({
  facts: wallFacts,
  workAreaId: "walls",
}).types[0];
const doorSets = extractDoorPortionsFromBrief(PARTITION_BRIEF);
const nextFinish = wall
  ? nextInternalWallsFinishField({ type: wall, jobScope: "new_partition" })
  : null;

check(
  "partition keeps length, both-side lining, and one door opening",
  wallSpecs.length === 1 &&
    wall?.length_lm === 4.2 &&
    wall.height_m === 2.4 &&
    wall.frame_system === "timber" &&
    wall.same_lining_both_sides === true &&
    wall.side_a.product === "standard_gib" &&
    wall.has_openings === true &&
    wall.openings.length === 1 &&
    wall.openings[0]?.type === "door" &&
    wall.openings[0]?.width_m == null &&
    wall.openings[0]?.height_m == null,
  JSON.stringify(wall)
);
check(
  "insulation is included and the missing type is still asked",
  wall?.insulation_included === true &&
    wall.insulation_type == null &&
    nextFinish === "internal_walls.wall_type.insulation"
);
check(
  "painting and skirting exclusions are stored as excluded",
  wall?.painting === "none" && wall.skirting === "none"
);
check(
  "stopping is not given an invented level",
  wall?.stopping_side_a == null && wall.stopping_side_b == null
);
check(
  "door assembly is independent door work, a bare opening is not",
  briefHasIndependentDoors(PARTITION_BRIEF) &&
    !briefHasIndependentDoors(
      "Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, one door opening."
    )
);
check(
  "door assembly is a door set and the opening is not a second set",
  doorSets.length === 1 &&
    doorSets[0]?.quantity === 1 &&
    doorSets[0]?.installation_type === "prehung_internal" &&
    doorSets[0]?.width_mm == null,
  JSON.stringify(
    doorSets.map((row) => ({
      quantity: row.quantity,
      installation: row.installation_type,
      width: row.width_mm,
    }))
  )
);

const again = applyExtractedInternalWallsToFacts({
  facts: wallFacts,
  workAreaId: "walls",
  types: wallSpecs,
});
const againWall = resolveInternalWallsWallTypes({
  facts: again,
  workAreaId: "walls",
}).types[0];
check(
  "reanalysis keeps the wall type id and the door opening id",
  againWall?.id === wall?.id &&
    againWall?.openings.length === 1 &&
    againWall.openings[0]?.id === wall?.openings[0]?.id
);

const officeWalls = extractInternalWallsTypesFromBrief(OFFICE_BRIEF);
const officeFacts = applyExtractedInternalWallsToFacts({
  facts: [],
  workAreaId: "office-walls",
  types: officeWalls,
});
const officeWall = resolveInternalWallsWallTypes({
  facts: officeFacts,
  workAreaId: "office-walls",
}).types[0];
const officeFloor = extractFlooringPortionsFromBrief(OFFICE_BRIEF);
const officePhysical = calculateFlooringPhysical({
  facts: [
    {
      work_area_id: "floor",
      key: FLOORING_PORTIONS_FACT_KEY,
      value: officeFloor,
      source: "ai_extracted",
    },
  ],
  workArea: { id: "floor", type: "flooring", name: "Flooring" },
});
const officeCommercial = commercializeFlooring({
  physical: officePhysical,
  workArea: { id: "floor", type: "flooring", name: "Flooring" },
  rates: [],
  organisationSettings: null,
  constraints: [],
});
const officeSell = officeCommercial.lineItems.reduce(
  (sum, line) => sum + (line.recommendedSell ?? 0),
  0
);
const officePriced = officeCommercial.requirements.filter((row) => row.priced).length;
check(
  "office partitions keep acoustic insulation, skirting, and painting",
  officeWall?.insulation_included === true &&
    officeWall.insulation_type === "acoustic" &&
    officeWall.skirting === "both" &&
    officeWall.painting === "both"
);
check(
  "carpet tiles are recognised and not priced or marked complete",
  officeFloor.length === 1 &&
    officeFloor[0]?.specialist_kind === "other_unsupported" &&
    officeFloor[0]?.other_description === "carpet tiles" &&
    officeFloor[0]?.finish_type === "other" &&
    officeFloor[0]?.label === "Meeting room" &&
    officeFloor[0]?.area_m2 === 18 &&
    officePhysical.completeness === "UNSUPPORTED_SPECIALIST" &&
    officePriced === 0 &&
    officeSell === 0,
  JSON.stringify({
    portions: officeFloor.map((row) => ({
      label: row.label,
      finish: row.finish_type,
      specialist: row.specialist_kind,
      area: row.area_m2,
    })),
    physical: officePhysical.completeness,
    sell: officeSell,
  })
);

const rooms = extractFlooringPortionsFromBrief(FLOORING_BRIEF);
check(
  "three flooring rooms keep their own finish and area",
  rooms.length === 3 &&
    new Set(rooms.map((row) => row.id)).size === 3 &&
    rooms[0]?.label === "Bedroom 1" &&
    rooms[0]?.finish_type === "carpet" &&
    rooms[0]?.area_m2 === 12 &&
    rooms[1]?.label === "Bedroom 2" &&
    rooms[1]?.finish_type === "carpet" &&
    rooms[1]?.area_m2 === 10 &&
    rooms[2]?.label === "Hallway" &&
    rooms[2]?.finish_type === "vinyl_plank" &&
    rooms[2]?.area_m2 === 8,
  JSON.stringify(
    rooms.map((row) => ({
      id: row.id,
      label: row.label,
      finish: row.finish_type,
      area: row.area_m2,
    }))
  )
);

const flooringFacts: EstimateFact[] = [
  {
    work_area_id: "floor",
    key: FLOORING_PORTIONS_FACT_KEY,
    value: rooms,
    source: "ai_extracted",
  },
];
const answered = applyFlooringFactWrite({
  facts: flooringFacts,
  workAreaId: "floor",
  key: "flooring.portion.underlay_required",
  value: "Yes",
  nestedItemId: rooms[0]?.id,
});
const answeredPortions = parseFlooringPortions(
  answered.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
check(
  "answering bedroom 1 does not change bedroom 2 or the hallway",
  answeredPortions[0]?.underlay_required === true &&
    answeredPortions[0]?.id === rooms[0]?.id &&
    answeredPortions[1]?.underlay_required == null &&
    answeredPortions[1]?.id === rooms[1]?.id &&
    answeredPortions[2]?.finish_type === "vinyl_plank" &&
    answeredPortions[2]?.id === rooms[2]?.id
);
const reloaded = parseFlooringPortions(
  answered.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
check(
  "reload keeps portion ids and the bedroom 1 answer",
  reloaded[0]?.id === rooms[0]?.id &&
    reloaded[1]?.id === rooms[1]?.id &&
    reloaded[2]?.id === rooms[2]?.id &&
    reloaded[0]?.underlay_required === true
);
const reanalysed = mergePersistedFlooringPortionsOnReanalyse({
  extracted: rooms,
  persisted: answeredPortions,
});
check(
  "reanalysis matches rooms by label and does not mint replacement ids",
  reanalysed.length === 3 &&
    reanalysed[0]?.id === rooms[0]?.id &&
    reanalysed[1]?.id === rooms[1]?.id &&
    reanalysed[2]?.id === rooms[2]?.id &&
    reanalysed[0]?.underlay_required === true &&
    reanalysed[1]?.area_m2 === 10
);

const renamed = matchExistingWorkAreaInstance(
  { type: "flooring", name: "Flooring" },
  [{ id: "floor-1", type: "flooring", name: "Upstairs floors" }]
);
const distinct = matchExistingWorkAreaInstance(
  { type: "bathroom", name: "Main Bathroom" },
  [{ id: "bath-1", type: "bathroom", name: "Master Ensuite" }]
);
const ambiguous = matchExistingWorkAreaInstance(
  { type: "flooring", name: "Flooring" },
  [
    { id: "floor-1", type: "flooring", name: "Upstairs floors" },
    { id: "floor-2", type: "flooring", name: "Garage floor" },
  ]
);
check(
  "a renamed sole work area is reused and a different name still inserts",
  renamed.action === "reuse" &&
    renamed.id === "floor-1" &&
    distinct.action === "insert"
);
check(
  "an unmatched default name among several work areas is not merged",
  ambiguous.action === "unresolved"
);

const kept = reanalysisFactWrite({
  existingSource: "user",
  existingValue: 12,
  extractedValue: 20,
});
const assumed = reanalysisFactWrite({
  existingSource: "assumption",
  existingValue: "No",
  extractedValue: "Yes",
});
const same = reanalysisFactWrite({
  existingSource: "user",
  existingValue: 12,
  extractedValue: 12,
});
check(
  "a confirmed answer is kept and the disagreement is a review warning",
  kept.action === "keep" && kept.conflictWarning != null
);
check(
  "an assumption is not promoted to a confirmed answer",
  assumed.action === "keep" && assumed.conflictWarning != null
);
check(
  "the same confirmed value does not raise a conflict",
  same.action === "keep" && same.conflictWarning == null
);

const mergedWalls = mergePersistedInternalWallTypesOnReanalyse({
  extracted: resolveInternalWallsWallTypes({
    facts: again,
    workAreaId: "walls",
  }).types,
  persisted: [wall],
});
check(
  "wall reanalysis merge keeps the saved wall id",
  mergedWalls[0]?.id === wall?.id &&
    mergedWalls[0]?.openings[0]?.id === wall?.openings[0]?.id
);

const fascia = deckExposedPerimeterM({
  facts: [],
  workAreaId: "deck",
  lengthM: 4.8,
  widthM: 3.6,
  areaM2: 17.28,
});
check(
  "fascia without a length fact still falls back to the exposed perimeter",
  fascia === 16.8 &&
    !listDeckClarifyDescriptors().some(
      (row) => row.factKey === "deck.vertical_face_board_length_lm"
    )
);

const legacy = parseFlooringPortions([
  {
    id: "fa_legacy",
    label: "Lounge",
    finish_type: "carpet",
    area_m2: 15,
  },
]);
check(
  "an older flooring portion still parses without regeneration",
  legacy.length === 1 && legacy[0]?.id === "fa_legacy" && legacy[0]?.area_m2 === 15
);

if (failed > 0) {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);

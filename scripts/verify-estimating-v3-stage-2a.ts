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
import {
  explicitUnknownLeavesQuestionOpen,
  localAnswersCompleteForGenerate,
  optimisticResolvedCandidateIds,
} from "../lib/assistant/clarify/interaction";
import { constraintIsKnown } from "../lib/assistant/clarify/suppress";
import {
  evaluateEstimateGenerationSuccess,
  hasPricingRequiredRepresentation,
} from "../lib/estimate/estimate-generation-success";
import { buildEstimateRequirementSnapshotV1 } from "../lib/estimate/requirement-snapshot";
import { createMemoryRequirementSnapshotStore } from "../lib/estimate/requirement-snapshot-store";
import {
  assertQuoteSnapshotMutable,
  assertQuoteStatusTransition,
} from "../lib/quotes/transaction";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
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
import {
  applyInternalWallsFactWrite,
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
  wallTypeFieldCurrentValue,
} from "../lib/estimate/internal-walls-wall-types";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import {
  commercializeFlooring,
  flooringLineIsManualPricingEligible,
} from "../lib/estimate/flooring-commercial";
import { FLOORING_SPECIALIST_COMPONENT } from "../lib/estimate/flooring-identities";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { buildNestedFlooringQuoteDraft } from "../lib/estimate/flooring-quote";
import {
  FLOORING_PORTIONS_FACT_KEY,
  FLOORING_SPECIALIST_RECIPE_MESSAGE,
  applyFlooringFactWrite,
  flooringReanalysisIdentityUnresolved,
  mergePersistedFlooringPortionsOnReanalyse,
  parseFlooringPortions,
} from "../lib/estimate/flooring-portions";
import type { EstimateFact } from "../lib/estimate/types";
import { shouldHideConditionalQuestion } from "../lib/scopes/conditional-rules";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { planWorkAreaInstanceActions } from "../lib/work-areas/instances";

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
  "office partitions keep acoustic insulation and do not infer finish sides",
  officeWall?.insulation_included === true &&
    officeWall.insulation_type === "acoustic" &&
    officeWall.skirting == null &&
    officeWall.painting == null
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
  "reanalysis keeps flooring ids by measurement, including a reordered extract",
  reanalysed.length === 3 &&
    reanalysed[0]?.id === rooms[0]?.id &&
    reanalysed[1]?.id === rooms[1]?.id &&
    reanalysed[2]?.id === rooms[2]?.id &&
    reanalysed[0]?.underlay_required === true &&
    reanalysed[1]?.area_m2 === 10 &&
    !flooringReanalysisIdentityUnresolved({
      extracted: [...rooms].reverse(),
      persisted: answeredPortions,
    })
);
const reordered = mergePersistedFlooringPortionsOnReanalyse({
  extracted: [...rooms].reverse(),
  persisted: answeredPortions,
});
check(
  "extraction order does not swap flooring portion identities",
  reordered.map((row) => row.id).join() === rooms.map((row) => row.id).join() &&
    reordered[0]?.underlay_required === true
);

const renamed = planWorkAreaInstanceActions(
  [{ type: "flooring", name: "Flooring" }],
  [{ id: "floor-1", type: "flooring", name: "Upstairs floors" }]
);
const specificRename = planWorkAreaInstanceActions(
  [{ type: "bathroom", name: "Master Ensuite" }],
  [{ id: "bath-1", type: "bathroom", name: "Main Bathroom" }]
);
const addedRoom = planWorkAreaInstanceActions(
  [
    { type: "bathroom", name: "Main Bathroom" },
    { type: "bathroom", name: "Powder room" },
  ],
  [{ id: "bath-1", type: "bathroom", name: "Main Bathroom" }]
);
const ambiguous = planWorkAreaInstanceActions(
  [{ type: "flooring", name: "Flooring" }],
  [
    { id: "floor-1", type: "flooring", name: "Upstairs floors" },
    { id: "floor-2", type: "flooring", name: "Garage floor" },
  ]
);
check(
  "a renamed work area is reused and an additional named room still inserts",
  renamed[0]?.action === "reuse" &&
    renamed[0]?.id === "floor-1" &&
    specificRename[0]?.action === "reuse" &&
    specificRename[0]?.id === "bath-1" &&
    addedRoom[0]?.action === "reuse" &&
    addedRoom[1]?.action === "insert"
);
check(
  "an unmatched name among several work areas is not merged",
  ambiguous[0]?.action === "unresolved"
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

const twinPersisted = [
  { ...rooms[0]!, id: "bed-a", label: "Bedroom A", underlay_required: true },
  { ...rooms[0]!, id: "bed-b", label: "Bedroom B", underlay_required: false },
];
const twinExtracted = [
  { ...rooms[0]!, id: "new-b", label: "Bedroom B" },
  { ...rooms[0]!, id: "new-a", label: "Bedroom A" },
];
const twins = mergePersistedFlooringPortionsOnReanalyse({
  extracted: twinExtracted,
  persisted: twinPersisted,
});
check(
  "two similar rooms do not swap or merge",
  twins.length === 2 &&
    twins[0]?.id === "bed-a" &&
    twins[1]?.id === "bed-b" &&
    twins[0]?.underlay_required === true &&
    twins[1]?.underlay_required === false &&
    flooringReanalysisIdentityUnresolved({
      extracted: twinExtracted,
      persisted: twinPersisted,
    })
);
const addedFloor = mergePersistedFlooringPortionsOnReanalyse({
  extracted: [
    ...rooms,
    { ...rooms[1]!, id: "living", label: "Living", area_m2: 20 },
  ],
  persisted: answeredPortions,
});
check(
  "adding a flooring room keeps the saved rooms",
  addedFloor.length === 4 &&
    addedFloor[0]?.id === rooms[0]?.id &&
    addedFloor[1]?.id === rooms[1]?.id &&
    addedFloor[2]?.id === rooms[2]?.id &&
    addedFloor[3]?.area_m2 === 20 &&
    !flooringReanalysisIdentityUnresolved({
      extracted: [
        ...rooms,
        { ...rooms[1]!, id: "living", label: "Living", area_m2: 20 },
      ],
      persisted: answeredPortions,
    })
);

const bothSides = extractInternalWallsTypesFromBrief(
  "Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, skirting both sides and painting both sides."
);
check(
  "explicit both-sides wording is stored for skirting and painting",
  bothSides[0]?.skirting === "both" && bothSides[0]?.painting === "both"
);

const conflictFacts: EstimateFact[] = [
  ...wallFacts,
  {
    work_area_id: "walls",
    key: "internal_walls.skirtings_included",
    value: true,
    source: "ai_extracted",
  },
  {
    work_area_id: "walls",
    key: "internal_walls.painting_included",
    value: true,
    source: "ai_extracted",
  },
];
const conflictEstimate = calculateInternalWalls(
  {
    project: { id: "p", qualityLevel: null },
    confirmedWorkAreas: [
      { id: "walls", type: "internal_walls", name: "Internal walls", sort_order: 1 },
    ],
    facts: conflictFacts,
    constraints: [],
    organisationSettings: null,
    materialWastageSettings: null,
    rates: [],
  },
  { id: "walls", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
const legacyOnly = calculateInternalWalls(
  {
    project: { id: "p", qualityLevel: null },
    confirmedWorkAreas: [
      { id: "walls", type: "internal_walls", name: "Internal walls", sort_order: 1 },
    ],
    facts: [
      {
        work_area_id: "walls",
        key: "internal_walls.length_lm",
        value: 6,
        source: "user",
      },
      {
        work_area_id: "walls",
        key: "internal_walls.height_m",
        value: 2.4,
        source: "user",
      },
      {
        work_area_id: "walls",
        key: "internal_walls.skirtings_included",
        value: true,
        source: "user",
      },
    ],
    constraints: [],
    organisationSettings: null,
    materialWastageSettings: null,
    rates: [],
  },
  { id: "walls", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
const exclusionQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "internal_walls",
  name: "Internal walls",
  facts: [
    {
      key: "internal_walls.wall_types",
      label: "Walls",
      value: JSON.stringify(resolveInternalWallsWallTypes({
        facts: conflictFacts,
        workAreaId: "walls",
      }).types),
    },
    {
      key: "internal_walls.skirtings_included",
      label: "Skirtings",
      value: "Yes",
    },
  ],
});
check(
  "an explicit exclusion beats a conflicting legacy inclusion",
  !conflictEstimate.lineItems.some((row) => /skirting/i.test(row.label)) &&
    !conflictEstimate.lineItems.some((row) => /painting/i.test(row.label)) &&
    exclusionQuote.includes("Skirting is excluded.") &&
    exclusionQuote.includes("Painting is excluded.") &&
    !exclusionQuote.includes("Skirting is included") &&
    legacyOnly.lineItems.some((row) => row.label === "Skirting")
);
check(
  "a conflicting legacy flag does not ask for skirting length",
  shouldHideConditionalQuestion(
    {
      key: "internal_walls.skirting_length_lm",
      label: "Skirting length",
      questionText: "Skirting length",
      inputType: "number",
      required: false,
      priority: 1,
      factKey: "internal_walls.skirting_length_lm",
      workAreaType: "internal_walls",
    },
    "walls",
    new Map([
      [
        "walls:internal_walls.wall_types",
        {
          key: "internal_walls.wall_types",
          work_area_id: "walls",
          value: resolveInternalWallsWallTypes({
            facts: conflictFacts,
            workAreaId: "walls",
          }).types,
        },
      ],
      [
        "walls:internal_walls.skirtings_included",
        {
          key: "internal_walls.skirtings_included",
          work_area_id: "walls",
          value: true,
        },
      ],
    ])
  )
);

const tileLines = officeCommercial.lineItems.filter(
  (row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT
);
const tileQuote = buildNestedFlooringQuoteDraft(
  [{ key: FLOORING_PORTIONS_FACT_KEY, value: JSON.stringify(officeFloor) }],
  tileLines.map((line) => ({
    label: line.label,
    component_key: line.componentKey,
    nested_item_id: officeFloor[0]?.id ?? null,
    total_cost: line.recommendedCost,
    total_sell: line.recommendedSell,
  }))
);
check(
  "unsupported carpet tiles stay visible as unpriced supply and installation",
  tileLines.length === 2 &&
    tileLines.every(
      (row) =>
        (row.recommendedSell ?? 0) === 0 && flooringLineIsManualPricingEligible(row)
    ) &&
    officeCommercial.requirements.some(
      (row) => row.kind === "material" && row.priced === false
    ) &&
    officeCommercial.requirements.some(
      (row) => row.kind === "labour" && row.priced === false
    ) &&
    officeCommercial.missingInfo.includes(FLOORING_SPECIALIST_RECIPE_MESSAGE) &&
    tileQuote.includes("18 m²") &&
    tileQuote.includes("No recipe rate is applied.")
);

const derived = reanalysisFactWrite({
  existingSource: "derived",
  existingValue: 12,
  extractedValue: 20,
});
check(
  "a derived value is replaced when its inputs disagree",
  derived.action === "replace"
);

const unresolvedFacts = wall
  ? applyInternalWallsFactWrite({
      facts: wallFacts,
      workAreaId: "walls",
      key: "internal_walls.wall_type.frame_system",
      value: "Not sure",
      wallTypeId: wall.id,
    })
  : [];
const unresolvedType = resolveInternalWallsWallTypes({
  facts: unresolvedFacts,
  workAreaId: "walls",
}).types[0];
check(
  "framing Not sure persists as an explicit unknown",
  unresolvedType?.frame_system == null &&
    unresolvedType?.frame_unresolved === true &&
    wallTypeFieldCurrentValue(
      unresolvedType ?? null,
      "internal_walls.wall_type.frame_system"
    ) === "Not sure" &&
    nextInternalWallsWallTypeField({
      type: unresolvedType ?? null,
      jobScope: "new_partition",
    }) === "internal_walls.wall_type.frame_system"
);
const confirmedFrameFacts = wall
  ? applyInternalWallsFactWrite({
      facts: unresolvedFacts,
      workAreaId: "walls",
      key: "internal_walls.wall_type.frame_system",
      value: "Timber framing",
      wallTypeId: wall.id,
    })
  : [];
const confirmedFrame = resolveInternalWallsWallTypes({
  facts: confirmedFrameFacts,
  workAreaId: "walls",
}).types[0];
check(
  "a stated framing system replaces the explicit unknown",
  confirmedFrame?.frame_system === "timber" &&
    confirmedFrame.frame_unresolved !== true
);
check(
  "carry distance Not sure stays unresolved",
  constraintIsKnown(
    [{ key: "material_carry_distance", value: "Not sure" }],
    "material_carry_distance"
  ) === false &&
    explicitUnknownLeavesQuestionOpen({
      value: "Not sure",
      constraintKey: "material_carry_distance",
    }) &&
    explicitUnknownLeavesQuestionOpen({
      value: "Not sure",
      constraintKey: "occupied_site",
    }) === false
);
check(
  "Not sure does not make Create estimate eligible",
  optimisticResolvedCandidateIds({
    resolvedIds: new Set(),
    heldPendingId: "pc:material_carry_distance",
    heldValue: "Not sure",
  }).size === 0 &&
    localAnswersCompleteForGenerate({
      remainingRequiredCount: 1,
      candidates: [],
      resolvedIds: new Set(),
      heldPendingId: "pc:material_carry_distance",
      heldValue: "Not sure",
      blocksEstimate: true,
    }) === false
);
const partial = evaluateEstimateGenerationSuccess({
  confirmedWorkAreas: [
    { id: "walls", type: "internal_walls" },
    { id: "floor", type: "flooring" },
  ],
  facts: wallFacts,
  result: {
    lineItems: [
      {
        includedInTotal: true,
        recommendedSell: 100,
        rateSourceType: "benchmark",
      },
      {
        includedInTotal: true,
        recommendedSell: 0,
        rateSourceType: "missing",
        label: "Carpet tiles supply",
      },
    ],
    missingInfo: [
      "This finish has no supported recipe. The requested area stays in scope. Supply and installation are unpriced.",
    ],
    requirements: [],
  },
});
check(
  "unpriced carpet tiles do not reject the rest of the estimate",
  partial.ok === true &&
    hasPricingRequiredRepresentation({
      lineItems: [
        {
          includedInTotal: true,
          recommendedSell: 0,
          rateSourceType: "missing",
        },
      ],
    })
);
check(
  "a sent quote snapshot cannot be edited",
  assertQuoteSnapshotMutable({
    status: "sent",
    superseded_by_quote_id: null,
    send_lock_delivery_id: null,
  }) != null &&
    assertQuoteSnapshotMutable({
      status: "draft",
      superseded_by_quote_id: null,
      send_lock_delivery_id: null,
    }) == null &&
    assertQuoteStatusTransition("sent", "draft").ok === false
);

void (async () => {
  const generationId = "55555555-5555-4555-8555-555555555555";
  const payload = buildEstimateRequirementSnapshotV1({
    generationId,
    requirements: [],
  });
  const store = createMemoryRequirementSnapshotStore();
  const saved = await store.insert({
    orgId: "org-synthetic",
    projectId: "project-synthetic",
    estimateId: "estimate-synthetic",
    generationId,
    payload,
  });
  const reloaded = await store.getByGenerationId(generationId);
  let duplicateRejected = false;
  try {
    await store.insert({
      orgId: "org-synthetic",
      projectId: "project-synthetic",
      estimateId: "estimate-synthetic",
      generationId,
      payload: buildEstimateRequirementSnapshotV1({
        generationId,
        requirements: [],
        estimateSellAuthority: "project_target_margin",
      }),
    });
  } catch {
    duplicateRejected = true;
  }
  check(
    "a saved estimate snapshot cannot be replaced",
    reloaded?.generationId === saved.generationId &&
      reloaded.payload.estimateSellAuthority == null &&
      duplicateRejected &&
      !("update" in store)
  );

  if (failed > 0) {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  console.log(`\n${passed} passed`);
})();

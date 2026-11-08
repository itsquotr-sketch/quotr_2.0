/**
 * Opening association and takeoff notice.
 * A door set does not create a wall opening. A stored wall opening in
 * millimetres reaches the existing lining and stopping rules.
 */

import { readFileSync } from "node:fs";
import {
  applyExtractedInternalWallsToFacts,
  explicitInternalWallsOpenings,
  extractInternalWallsTypesFromBrief,
} from "@/lib/estimate/internal-walls-brief";
import { insulationNetAreaM2, stoppingTakeoff } from "@/lib/estimate/internal-walls-finish";
import { internalWallsLiningFaceTakeoff } from "@/lib/estimate/internal-walls-lining";
import {
  openingsEligibleForTakeoff,
  openingsFromStoredWallTypeBlob,
  sumOpeningAreaM2,
} from "@/lib/estimate/internal-walls-openings";
import {
  createEmptyWallType,
  resolveInternalWallsWallTypes,
} from "@/lib/estimate/internal-walls-wall-types";
import {
  groupConditionCandidates,
  visibleConditionCandidates,
} from "@/lib/project-conditions/presentation";
import type { EstimateFact } from "@/lib/estimate/types";

const WALL_ID = "wall-qt009";
const OTHER_WALL_ID = "wall-other";
const DOOR_ID = "door-qt009";

const STORED_WALL = {
  cornice: null,
  electrical: "none",
  frame_size: "90x45",
  height_m: 2.4,
  insulation: "Thermal cavity insulation",
  label: "Non-loadbearing timber stud partition",
  length_lm: 6,
  lining_face_1: "13mm Standard GIB",
  lining_face_2: "13mm Standard GIB",
  openings: [
    {
      height_mm: 1980,
      opening_type: "door",
      quantity: 1,
      width_mm: 810,
    },
  ],
  painting: "none",
  same_lining_both_sides: true,
  skirting: "none",
  wall_count: 1,
  wall_type_id: "wt-01",
};

const DOOR_SET = {
  id: "portion-1",
  height_mm: 810,
  width_mm: 1980,
  quantity: 1,
  installation_type: "prehung_internal",
  leaf_construction: "hollow_core",
};

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function fact(workAreaId: string, key: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const reproductionFacts: EstimateFact[] = [
  fact(WALL_ID, "internal_walls.length_lm", 6),
  fact(WALL_ID, "internal_walls.height_m", 2.4),
  fact(WALL_ID, "internal_walls.framing_type", "Timber"),
  fact(WALL_ID, "internal_walls.wall_lining_type", "13mm Standard GIB"),
  fact(WALL_ID, "internal_walls.lining_sides", "Both sides"),
  fact(WALL_ID, "internal_walls.wall_types", [STORED_WALL]),
  fact(DOOR_ID, "doors.portions", [DOOR_SET]),
];

const QT009_BRIEF =
  "Build a non-loadbearing timber stud wall 6000mm long and 2400mm high. Use 90 × 45 framing, 13 mm Standard GIB both sides, one layer each side, with thermal cavity insulation. Include one door opening and one prehung hollow-core door set, 810 × 1980 mm, including jamb and standard hardware. Stop the plasterboard ready to paint; stopping level to be confirmed. Painting, electrical and skirting are excluded. Ground floor, easy access, carry under 10 m, unoccupied, unrestricted hours.";

const resolved = resolveInternalWallsWallTypes({
  facts: reproductionFacts,
  workAreaId: WALL_ID,
  briefText: QT009_BRIEF,
});
const wall = resolved.types[0];
const opening = wall?.openings[0];
const eligible = wall
  ? openingsEligibleForTakeoff(wall.openings, {
      wallLengthLm: wall.length_lm,
      wallHeightM: wall.height_m,
      compareToWall: true,
    })
  : [];
const deduction = sumOpeningAreaM2(eligible);

check("stored wall type stays on the legacy reader", resolved.source === "legacy_dual_read");
check("the stored opening is associated with this wall", wall?.has_openings === true && wall.openings.length === 1);
check(
  "stored millimetres become 0.81 × 1.98 m",
  opening?.width_m === 0.81 && opening.height_m === 1.98 && opening.type === "door"
);
check("the door set is not copied onto the wall", wall?.openings.length === 1);

const gross = 6 * 2.4;
const expectedDeduction = 0.81 * 1.98;
const expectedNet = gross - expectedDeduction;
check("deduction is 1.6038 m²", Math.abs(deduction - expectedDeduction) < 1e-9, String(deduction));
check("net is 12.7962 m²", Math.abs(expectedNet - 12.7962) < 1e-9, String(expectedNet));

const sideA = wall
  ? internalWallsLiningFaceTakeoff({
      type: wall,
      face: wall.side_a,
      side: "side_a",
      wasteFactor: 0.1,
      hoursPerSheet: 0.5,
      openingDeductionM2: deduction,
    })
  : null;
const sideB = wall
  ? internalWallsLiningFaceTakeoff({
      type: wall,
      face: wall.side_b,
      side: "side_b",
      wasteFactor: 0.1,
      hoursPerSheet: 0.5,
      openingDeductionM2: deduction,
    })
  : null;

check("side A lining calculates", sideA?.ok === true);
check("side B lining calculates", sideB?.ok === true);
if (sideA?.ok && sideB?.ok) {
  check("each face deducts the opening once", sideA.openingDeductionM2 === deduction && sideB.openingDeductionM2 === deduction);
  check("each face net is 12.7962 m²", sideA.netFaceAreaM2 === expectedNet && sideB.netFaceAreaM2 === expectedNet);
  check("sheet purchase stays on the full-height run", sideA.installedSheets === 5 && sideA.purchaseSheets === 6 && sideB.installedSheets === 5 && sideB.purchaseSheets === 6);
  check("lining labour stays 2.5 h per face", sideA.labourHours === 2.5 && sideB.labourHours === 2.5);
}

const unsetStopping = wall ? stoppingTakeoff({ type: wall, jobScope: "new_partition" }) : null;
check("unconfirmed stopping level is not invented", unsetStopping == null);

const stopped = wall
  ? {
      ...wall,
      stopping_side_a: "level_4" as const,
      stopping_side_b: "level_4" as const,
    }
  : null;
const stopping = stopped ? stoppingTakeoff({ type: stopped, jobScope: "new_partition" }) : null;
check(
  "stopping uses the net face once per face",
  stopping?.sideA?.areaM2 === expectedNet &&
    stopping.sideB?.areaM2 === expectedNet &&
    stopping.totalM2 === expectedNet * 2
);

const insulation = insulationNetAreaM2({
  lengthLm: 6,
  heightM: 2.4,
  openings: eligible,
  deductOpenings: true,
});
check("insulation deducts the opening once per cavity", insulation === expectedNet);

const otherBlob = [
  { ...STORED_WALL, length_lm: 4, height_m: 2.4, openings: STORED_WALL.openings },
  { ...STORED_WALL, length_lm: 6, height_m: 2.4, openings: [] },
];
const otherFacts: EstimateFact[] = [
  fact(OTHER_WALL_ID, "internal_walls.length_lm", 6),
  fact(OTHER_WALL_ID, "internal_walls.height_m", 2.4),
  fact(OTHER_WALL_ID, "internal_walls.framing_type", "Timber"),
  fact(OTHER_WALL_ID, "internal_walls.wall_lining_type", "13mm Standard GIB"),
  fact(OTHER_WALL_ID, "internal_walls.lining_sides", "Both sides"),
  fact(OTHER_WALL_ID, "internal_walls.wall_types", otherBlob),
];
const other = resolveInternalWallsWallTypes({
  facts: otherFacts,
  workAreaId: OTHER_WALL_ID,
});
check(
  "an opening on the other wall is not applied here",
  other.types[0]?.openings.length === 0 && other.types[0]?.has_openings == null
);

const ambiguous = openingsFromStoredWallTypeBlob({
  raw: [
    { length_lm: 6, height_m: 2.4, openings: STORED_WALL.openings },
    { length_lm: 6, height_m: 2.4, openings: STORED_WALL.openings },
  ],
  lengthLm: 6,
  heightM: 2.4,
});
check("two matching walls do not share one opening", ambiguous.length === 0);

const plain = createEmptyWallType({ id: "plain" });
plain.length_lm = 4;
plain.height_m = 2.4;
plain.has_openings = false;
check(
  "a wall without an opening keeps its gross area",
  sumOpeningAreaM2(plain.openings) === 0 && 4 * 2.4 === 9.6
);

const doorSetOnly = "Supply one prehung hollow-core door set, 810 × 1980 mm.";
check(
  "a door set alone is not a wall opening",
  explicitInternalWallsOpenings(doorSetOnly).hasOpenings == null &&
    explicitInternalWallsOpenings(doorSetOnly).doorOpeningCount == null
);

const sizedBrief =
  "Build an internal wall 6 m long and 2.4 m high. Use 90x45 timber framing and 13mm standard GIB both sides. Include one door opening and one prehung hollow-core door set, 810 × 1980 mm.";
const extracted = extractInternalWallsTypesFromBrief(sizedBrief);
const written = applyExtractedInternalWallsToFacts({
  facts: [],
  workAreaId: WALL_ID,
  types: extracted,
});
const writtenWall = resolveInternalWallsWallTypes({
  facts: written,
  workAreaId: WALL_ID,
}).types[0];
check(
  "a size in the door-opening sentence is stored on that opening",
  writtenWall?.openings.length === 1 &&
    writtenWall.openings[0]?.width_m === 0.81 &&
    writtenWall.openings[0]?.height_m === 1.98
);

const doorOnlyBrief =
  "Build an internal wall 4 m long and 2.4 m high. Use 90x45 timber framing and 13mm standard GIB both sides. Supply one prehung door set, 810 × 1980 mm.";
const doorOnlyWall = resolveInternalWallsWallTypes({
  facts: applyExtractedInternalWallsToFacts({
    facts: [],
    workAreaId: OTHER_WALL_ID,
    types: extractInternalWallsTypesFromBrief(doorOnlyBrief),
  }),
  workAreaId: OTHER_WALL_ID,
}).types[0];
check(
  "the door-set wall has no opening row",
  (doorOnlyWall?.openings.length ?? 0) === 0 && doorOnlyWall?.has_openings !== true
);

const omittedOpeningFacts = reproductionFacts.map((row) =>
  row.key === "internal_walls.wall_types"
    ? {
        ...row,
        value: [
          {
            ...(Array.isArray(row.value) ? row.value[0] : {}),
            openings: undefined,
          },
        ],
      }
    : row
);
const fromBrief = resolveInternalWallsWallTypes({
  facts: omittedOpeningFacts,
  workAreaId: WALL_ID,
  briefText: QT009_BRIEF,
}).types[0];
check(
  "the brief opening is used when the stored wall omits it",
  fromBrief?.openings.length === 1 &&
    fromBrief.openings[0]?.width_m === 0.81 &&
    fromBrief.openings[0]?.height_m === 1.98
);
const extractedBrief = extractInternalWallsTypesFromBrief(QT009_BRIEF);
check(
  "the stud-wall brief stores 6 m, 2.4 m, and the stated opening",
  extractedBrief.length === 1 &&
    extractedBrief[0]?.lengthLm === 6 &&
    extractedBrief[0]?.heightM === 2.4 &&
    extractedBrief[0]?.doorOpeningWidthM === 0.81 &&
    extractedBrief[0]?.doorOpeningHeightM === 1.98
);

const shell = readFileSync("components/assistant/AssistantShell.tsx", "utf8");
const takeoff = readFileSync("components/assistant/mode/EstimateTakeoffViews.tsx", "utf8");
const details = readFileSync("components/assistant/clarify/ClarifyPanel.tsx", "utf8");
check("the takeoff no longer mounts the answer control", !shell.includes("ClarifyAnswerControl"));
const labourTakeoff = takeoff.slice(takeoff.indexOf("export function LabourTakeoff"));
check(
  "the takeoff notice is after the labour rows",
  labourTakeoff.indexOf("leadingNote={decisions}") !== -1 &&
    labourTakeoff.indexOf("leadingNote={decisions}") <
      labourTakeoff.indexOf("trailingNote={decisionNotice}")
);
check("the notice names the decision and opens Details", takeoff.includes("data-takeoff-decision-notice") && takeoff.includes("Answer in Details"));
check("Details still groups questions by work area", details.includes("data-details-group"));

const groups = groupConditionCandidates([
  { questionKey: "access", targetKey: "site_access" },
  { questionKey: "carry", targetKey: "material_carry_distance" },
  { questionKey: "occupied", targetKey: "occupied_site" },
  { questionKey: "protection", targetKey: "protection_dust_control" },
]);
check(
  "site conditions are grouped by topic",
  groups.map((group) => group.group).join(",") === "access,handling,occupancy"
);
const followUp = visibleConditionCandidates(
  [
    { questionKey: "occupied", targetKey: "occupied_site" },
    { questionKey: "protection", targetKey: "protection_dust_control" },
  ],
  []
);
check(
  "protection waits until occupancy is answered",
  followUp.length === 1 && followUp[0]?.targetKey === "occupied_site"
);

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("opening association checks passed");

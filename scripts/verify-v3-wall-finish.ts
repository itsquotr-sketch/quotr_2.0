import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import {
  applyInternalWallsFactWrite,
  nextInternalWallsWallTypeField,
  parseInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import {
  insulationAreaForWallType,
  stoppingTakeoff,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
} from "../lib/estimate/internal-walls-finish";
import { mergePersistedInternalWallTypesOnReanalyse } from "../lib/estimate/internal-walls-brief";
import type { EstimateFact } from "../lib/estimate/types";

const allowed = getAnalysisCapableWorkAreaTypes();
let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function empty(): AIExtractionOutput {
  return {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  };
}

function run(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: empty(),
    allowedTypes: allowed,
  }).extraction;
}

const qt010Brief = `Office alterations:
Wall A is 6 m long × 2.7 m high, 90 × 45 timber framing, 13 mm plasterboard both sides, acoustic insulation, Level 4 stopping both sides. One 810 × 1980 mm door opening, but no door supply or installation.

Wall B is 3 m long × 2.4 m high, steel framing with plywood lining on one side only. No insulation or openings in Wall B.

No painting, skirting, electrical or demolition in either wall.`;

const qt010 = run(qt010Brief);
const areas = qt010.workAreas.map((area) => area.type);
const walls = parseInternalWallsWallTypes(
  qt010.facts.find((row) => row.key === "internal_walls.wall_types")?.value
);
const timber = walls.find((row) => row.frame_system === "timber");
const steel = walls.find((row) => row.frame_system === "steel");
const opening = timber?.openings[0];

check("QT-010 stays internal walls and not a door set", areas.includes("internal_walls") && !areas.includes("doors"), areas.join(","));
check("QT-010 keeps both walls", walls.length === 2, `count=${walls.length}`);
check(
  "QT-010 Wall A stores acoustic insulation before an answer",
  timber?.insulation_included === true && timber.insulation_type === "acoustic"
);
check(
  "QT-010 Wall A stores Level 4 stopping on both faces",
  timber?.stopping_side_a === "level_4" && timber.stopping_side_b === "level_4"
);
check(
  "QT-010 Wall B stores the insulation exclusion",
  steel?.insulation_included === false && steel.insulation_type == null
);
check(
  "QT-010 Wall B does not receive Wall A's stopping",
  steel?.stopping_side_a == null && steel.stopping_side_b == null
);
check(
  "QT-010 Wall B Side B is explicitly unlined",
  steel?.side_b_explicitly_unlined === true && steel.side_b.lined === false
);
check(
  "QT-010 keeps the 810 by 1980 door opening on Wall A",
  opening?.type === "door" && opening.width_m === 0.81 && opening.height_m === 1.98 && steel?.has_openings === false
);
const timberNext = timber
  ? nextInternalWallsWallTypeField({ type: timber, jobScope: "new_partition" })
  : "missing";
const steelNext = steel
  ? nextInternalWallsWallTypeField({ type: steel, jobScope: "new_partition" })
  : "missing";
check(
  "QT-010 does not ask insulation, stopping, or Wall B Side B again",
  timberNext !== INTERNAL_WALLS_INSULATION_INCLUDED_KEY &&
    timberNext !== "internal_walls.wall_type.stopping_side_a" &&
    timberNext !== "internal_walls.wall_type.stopping_side_b" &&
    steelNext !== INTERNAL_WALLS_INSULATION_INCLUDED_KEY &&
    steelNext !== "internal_walls.wall_type.side_b_product" &&
    steelNext !== "internal_walls.wall_type.stopping_side_a" &&
    steelNext !== "internal_walls.wall_type.stopping_side_b",
  `timber=${timberNext} steel=${steelNext}`
);

const insulation = timber
  ? insulationAreaForWallType({ type: timber, jobScope: "new_partition" })
  : null;
const stopping = timber
  ? stoppingTakeoff({ type: timber, jobScope: "new_partition" })
  : null;
const openingArea = 0.81 * 1.98;
check(
  "QT-010 insulation uses the net cavity after the opening deduction",
  insulation?.ok === true &&
    Math.abs(insulation.openingDeductionM2 - openingArea) < 0.001 &&
    Math.abs(insulation.areaM2 - (6 * 2.7 - openingArea)) < 0.001
);
check(
  "QT-010 Level 4 stopping uses that net face area on both sides",
  stopping?.sideA?.level === "level_4" &&
    stopping.sideB?.level === "level_4" &&
    insulation?.ok === true &&
    Math.abs((stopping.sideA?.areaM2 ?? 0) - insulation.areaM2) < 0.001 &&
    Math.abs((stopping.sideB?.areaM2 ?? 0) - insulation.areaM2) < 0.001
);
check(
  "QT-010 Wall B has no insulation quantity",
  steel?.insulation_included === false
);

const conflictBrief = `Office alterations:
Wall A is 6 m long × 2.7 m high, 90 × 45 timber framing, 13 mm plasterboard both sides, acoustic insulation. No openings in Wall A. No insulation on Wall A.
Wall B is 3 m long × 2.4 m high, steel framing with plywood lining on one side only. No insulation or openings in Wall B.`;
const conflict = run(conflictBrief);
const conflictWalls = parseInternalWallsWallTypes(
  conflict.facts.find((row) => row.key === "internal_walls.wall_types")?.value
);
const conflictA = conflictWalls.find((row) => row.frame_system === "timber");
const conflictB = conflictWalls.find((row) => row.frame_system === "steel");
const conflictNext = conflictA
  ? nextInternalWallsWallTypeField({ type: conflictA, jobScope: "new_partition" })
  : "missing";
check(
  "A same-wall insulation conflict stays unanswered on that wall",
  conflictA?.insulation_included == null &&
    conflictA.insulation_type == null &&
    conflictNext === INTERNAL_WALLS_INSULATION_INCLUDED_KEY &&
    conflict.warnings.some((warning) => warning.includes("insulation"))
);
const conflictBNext = conflictB
  ? nextInternalWallsWallTypeField({ type: conflictB, jobScope: "new_partition" })
  : "missing";
check(
  "Wall B keeps its insulation exclusion and is not asked Wall A's conflict",
  conflictB?.insulation_included === false &&
    conflictBNext !== INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  `included=${conflictB?.insulation_included} next=${conflictBNext}`
);

const confirmed = applyInternalWallsFactWrite({
  facts: [
    {
      key: "internal_walls.wall_types",
      work_area_id: "walls",
      value: walls,
    } satisfies EstimateFact,
  ],
  workAreaId: "walls",
  wallTypeId: timber?.id,
  key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  value: "No",
  authority: "user",
});
const persisted = parseInternalWallsWallTypes(
  confirmed.find((row) => row.key === "internal_walls.wall_types")?.value
);
const merged = mergePersistedInternalWallTypesOnReanalyse({
  extracted: walls,
  persisted,
});
const mergedTimber = merged.find((row) => row.id === timber?.id);
check(
  "Reanalysis keeps the builder's insulation answer",
  mergedTimber?.insulation_authority === "user" &&
    mergedTimber.insulation_included === false &&
    mergedTimber.insulation_type == null
);
check(
  "Reanalysis keeps the door opening with the builder's wall",
  mergedTimber?.openings.some(
    (row) => row.type === "door" && row.width_m === 0.81 && row.height_m === 1.98
  ) === true
);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("wall finish checks passed");

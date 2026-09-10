/**
 * WORK-AREA-COORDINATION-01 — Work Area ownership / top-level discovery.
 *
 * Run: npx --yes tsx scripts/verify-work-area-ownership-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { COORDINATION_ORIGINAL_BRIEF } from "../lib/estimate/internal-walls-brief";
import { internalWallsNestedFinishOmit } from "../lib/estimate/internal-walls-finish";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import {
  classifyProposedWorkAreas,
  WORK_AREA_OWNERSHIP_CLASS,
  WORK_AREA_SCOPE_OWNERS,
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

function records(brief: string, proposed: readonly string[]) {
  return classifyProposedWorkAreas({ briefText: brief, types: proposed });
}

console.log("=== Ownership registry ===\n");
check(
  "internal_walls owns framing/lining/local finishes",
  WORK_AREA_SCOPE_OWNERS.internal_walls.includes("framing") &&
    WORK_AREA_SCOPE_OWNERS.internal_walls.includes("lining") &&
    WORK_AREA_SCOPE_OWNERS.internal_walls.includes("local_stopping") &&
    WORK_AREA_SCOPE_OWNERS.internal_walls.includes("local_wall_painting")
);
check(
  "plastering / painting own independent scope",
  WORK_AREA_SCOPE_OWNERS.plastering.includes("independent_plaster_scope") &&
    WORK_AREA_SCOPE_OWNERS.painting.includes("independent_paint_scope")
);
check(
  "doors own leaf/frame/hardware",
  WORK_AREA_SCOPE_OWNERS.doors.includes("door_leaf") &&
    WORK_AREA_SCOPE_OWNERS.doors.includes("hardware")
);

console.log("\n=== Original fixture ===\n");
const original = typesOf(COORDINATION_ORIGINAL_BRIEF);
check(
  "original: Internal Walls + Demolition",
  original.join(",") === "demolition,internal_walls",
  original.join(",")
);
const originalRecords = records(COORDINATION_ORIGINAL_BRIEF, [
  "internal_walls",
  "demolition",
  "plastering",
  "painting",
  "doors",
]);
const byType = Object.fromEntries(originalRecords.map((row) => [row.type, row]));
check(
  "original Internal Walls EXPLICIT",
  byType.internal_walls?.classification === WORK_AREA_OWNERSHIP_CLASS.EXPLICIT &&
    byType.internal_walls.topLevel
);
check(
  "original Demolition EXPLICIT",
  byType.demolition?.classification === WORK_AREA_OWNERSHIP_CLASS.EXPLICIT &&
    byType.demolition.topLevel
);
check(
  "original Plastering EMBEDDED not top-level",
  byType.plastering?.classification === WORK_AREA_OWNERSHIP_CLASS.EMBEDDED &&
    byType.plastering.topLevel === false
);
check(
  "original Painting NOT_REQUESTED",
  byType.painting?.classification === WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED &&
    byType.painting.topLevel === false
);
check(
  "original Doors NOT_REQUESTED",
  byType.doors?.classification === WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED &&
    byType.doors.topLevel === false
);
check(
  "original retains discovery evidence",
  Boolean(byType.internal_walls?.evidence) && Boolean(byType.demolition?.evidence)
);

console.log("\n=== Broader painting ===\n");
const paintBrief =
  "Build a new internal wall and repaint all walls and ceilings in the house.";
const paintTypes = typesOf(paintBrief);
check(
  "painting fixture: Internal Walls + Painting",
  paintTypes.includes("internal_walls") &&
    paintTypes.includes("painting") &&
    !paintTypes.includes("plastering"),
  paintTypes.join(",")
);
check(
  "IW local painting omitted when Painting WA exists",
  internalWallsNestedFinishOmit({ confirmedTypes: paintTypes }).omitPainting ===
    true
);

console.log("\n=== Independent plastering ===\n");
const plasterBrief =
  "Build a new internal wall and skim coat the existing lounge walls.";
const plasterTypes = typesOf(plasterBrief);
check(
  "plaster fixture: Internal Walls + Plastering",
  plasterTypes.includes("internal_walls") &&
    plasterTypes.includes("plastering"),
  plasterTypes.join(",")
);
check(
  "independent plaster does not suppress new-wall stopping questions",
  internalWallsNestedFinishOmit({
    confirmedTypes: plasterTypes,
    independentPlastering: true,
  }).omitStopping === false
);

console.log("\n=== Door system ===\n");
const doorBrief =
  "Build a partition with one new door including door, jamb and hardware.";
const doorTypes = typesOf(doorBrief);
check(
  "door fixture: Internal Walls + Doors",
  doorTypes.includes("internal_walls") && doorTypes.includes("doors"),
  doorTypes.join(",")
);

console.log("\n=== Opening only ===\n");
const openingBrief = "Build a wall with an 810mm opening but no door.";
const openingTypes = typesOf(openingBrief);
check(
  "opening-only: Internal Walls, no Doors",
  openingTypes.includes("internal_walls") && !openingTypes.includes("doors"),
  openingTypes.join(",")
);

console.log("\n=== Bathroom embedded trades ===\n");
const bathroomBrief =
  "Full bathroom renovation with tiling, waterproofing, lining and new fixtures.";
const bathroomTypes = typesOf(bathroomBrief);
check(
  "bathroom does not spawn Painting / Plastering / Demolition",
  bathroomTypes.includes("bathroom") &&
    !bathroomTypes.includes("painting") &&
    !bathroomTypes.includes("plastering") &&
    !bathroomTypes.includes("demolition"),
  bathroomTypes.join(",")
);
const bathRecords = records(bathroomBrief, [
  "bathroom",
  "painting",
  "plastering",
  "demolition",
]);
check(
  "bathroom embedded painting/plastering/demolition not top-level",
  bathRecords
    .filter((row) => row.type !== "bathroom")
    .every((row) => row.topLevel === false)
);

check(
  "enrichment applies ownership filter",
  read("lib/ai/enrich-extraction.ts").includes("filterTopLevelWorkAreas")
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);

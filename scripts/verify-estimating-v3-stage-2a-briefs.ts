/**
 * Stage 2A acceptance briefs. Deterministic. No model, network, or database.
 *
 * Run: npx --yes tsx scripts/verify-estimating-v3-stage-2a-briefs.ts
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { FLOORING_PORTIONS_FACT_KEY } from "../lib/estimate/flooring-portions";
import { DOORS_PORTIONS_FACT_KEY } from "../lib/estimate/doors-portions";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import {
  STAGE_2A_INTERNAL_PARTITION_BRIEF,
  STAGE_2A_OFFICE_FITOUT_BRIEF,
  STAGE_2A_THREE_ROOM_FLOORING_BRIEF,
} from "./fixtures/stage-2a-original-briefs";

const allowed = getAnalysisCapableWorkAreaTypes();
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1;
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  const extra =
    detail == null ? "" : ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
  console.log(`FAIL  ${name}${extra}`);
}

function enrich(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: {
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    },
    allowedTypes: allowed,
  });
}

function fact(result: ReturnType<typeof enrich>, key: string) {
  return result.extraction.facts.find((row) => row.key === key);
}

function wallType(result: ReturnType<typeof enrich>) {
  const value = fact(result, "internal_walls.wall_types")?.value;
  return Array.isArray(value) ? (value[0] as Record<string, unknown>) : null;
}

function portions(result: ReturnType<typeof enrich>, key: string) {
  const value = fact(result, key)?.value as
    | { portions?: unknown[] }
    | unknown[]
    | undefined;
  if (Array.isArray(value)) return value;
  return value?.portions ?? [];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const partition = enrich(STAGE_2A_INTERNAL_PARTITION_BRIEF);
const partitionWall = wallType(partition);
const partitionDoors = portions(partition, DOORS_PORTIONS_FACT_KEY) as Array<
  Record<string, unknown>
>;
const partitionTypes = partition.extraction.workAreas.map((row) => row.type);

check("partition has one internal-walls area", partitionTypes.filter((type) => type === "internal_walls").length === 1, partitionTypes);
check("partition has one doors area", partitionTypes.filter((type) => type === "doors").length === 1, partitionTypes);
check("partition length 6", partitionWall?.length_lm === 6, partitionWall);
check("partition height 2.4", partitionWall?.height_m === 2.4, partitionWall);
check("partition lining both sides", partitionWall?.same_lining_both_sides === true, partitionWall);
const partitionSide = partitionWall?.side_a as { product?: string } | undefined;
check(
  "partition plasterboard",
  partitionSide?.product === "standard_gib",
  partitionWall
);
check("partition insulation included", partitionWall?.insulation_included === true, partitionWall);
check(
  "partition one opening",
  Array.isArray(partitionWall?.openings) && partitionWall.openings.length === 1,
  partitionWall
);
check("partition one door set", partitionDoors.length === 1 && partitionDoors[0]?.quantity === 1, partitionDoors);
check("partition stopping requested", partitionWall?.stopping_side_a == null && partitionWall?.stopping_requested !== false, partitionWall);
check("partition painting excluded", partitionWall?.painting === "none", partitionWall);
check("partition skirting excluded", partitionWall?.skirting === "none", partitionWall);
check("partition electrical excluded", partitionWall?.electrical === "none", partitionWall);
check("partition ground floor", partition.constraints.some((row) => row.key === "floor_level" && row.value === "Ground"), partition.constraints);

const office = enrich(STAGE_2A_OFFICE_FITOUT_BRIEF);
const officeWall = wallType(office);
const officeDoors = portions(office, DOORS_PORTIONS_FACT_KEY) as Array<Record<string, unknown>>;
const officeFloors = portions(office, FLOORING_PORTIONS_FACT_KEY) as Array<Record<string, unknown>>;
const officeTypes = office.extraction.workAreas.map((row) => row.type);
const officeNote = String(fact(office, "internal_walls.coverage_note")?.value ?? "");

check("office walls 24lm", officeWall?.length_lm === 24, officeWall);
check("office walls 2.7m", officeWall?.height_m === 2.7, officeWall);
check("office lining both sides", officeWall?.same_lining_both_sides === true, officeWall);
check("office acoustic insulation", officeWall?.insulation_included === true && officeWall?.insulation_type === "acoustic", officeWall);
check("office six door sets", officeDoors.length === 1 && officeDoors[0]?.quantity === 6, officeDoors);
check(
  "office carpet tiles retained",
  officeFloors.length === 1 && officeFloors[0]?.other_description === "carpet tiles",
  officeFloors
);
check("office carpet tile area 120", officeFloors[0]?.area_m2 === 120, officeFloors);
check("office no flooring removal", officeFloors[0]?.finish_removal_required === false, officeFloors);
check("office skirting included without a side", officeWall?.skirting == null, officeWall);
check("office skirting length 45", fact(office, "internal_walls.skirting_length_lm")?.value === 45, fact(office, "internal_walls.skirting_length_lm"));
check("office painting included without a side", officeWall?.painting == null, officeWall);
check("office electrical excluded", officeWall?.electrical === "none", officeWall);
check("office occupied", office.constraints.some((row) => row.key === "occupied_site" && row.value === "Yes"), office.constraints);
check("office protection", office.constraints.some((row) => row.key === "protection_dust_control" && row.value === "Yes"), office.constraints);
check("office delivery windows", office.constraints.some((row) => row.key === "working_hours" && row.value === "Yes"), office.constraints);
check("office coverage gap", /site establishment/.test(officeNote) && /duration is not confirmed/.test(officeNote) && /Excluded trades:/.test(officeNote), officeNote);
check("office has no bathroom", !officeTypes.includes("bathroom"), officeTypes);

const flooring = enrich(STAGE_2A_THREE_ROOM_FLOORING_BRIEF);
const rooms = portions(flooring, FLOORING_PORTIONS_FACT_KEY) as Array<Record<string, unknown>>;
const flooringTypes = flooring.extraction.workAreas.map((row) => row.type);
const byLabel = (label: string) => rooms.find((row) => row.label === label);

function net(row: Record<string, unknown> | undefined): number | null {
  const length = Number(row?.length_m);
  const width = Number(row?.width_m);
  if (!Number.isFinite(length) || !Number.isFinite(width)) return null;
  return round2(length * width);
}

check("flooring three portions", rooms.length === 3, rooms.map((row) => row.label));
check("bedroom 1 carpet 11.52", byLabel("Bedroom 1")?.finish_type === "carpet" && net(byLabel("Bedroom 1")) === 11.52, byLabel("Bedroom 1"));
check("bedroom 2 carpet 14.70", byLabel("Bedroom 2")?.finish_type === "carpet" && net(byLabel("Bedroom 2")) === 14.7, byLabel("Bedroom 2"));
check("hallway vinyl 9.60", byLabel("Hallway")?.finish_type === "vinyl_plank" && net(byLabel("Hallway")) === 9.6, byLabel("Hallway"));
check("flooring removal on every room", rooms.every((row) => row.finish_removal_required === true), rooms.map((row) => row.finish_removal_required));
check("underlay on carpet only", byLabel("Bedroom 1")?.underlay_required === true && byLabel("Bedroom 2")?.underlay_required === true && byLabel("Hallway")?.underlay_required !== true, rooms);
check("transitions and waste retained", rooms.every((row) => row.transitions_required === true && row.waste_percent === 10), rooms);
check("major repairs excluded", rooms.every((row) => row.framing_required === false), rooms);
check("flooring has no bathroom", !flooringTypes.includes("bathroom"), flooringTypes);

const flooringPhysical = calculateFlooringPhysical({
  facts: flooring.extraction.facts.map((row, index) => ({
    id: `fact-${index}`,
    project_id: "project",
    work_area_id: "flooring",
    key: row.key,
    value: row.value,
    source: "ai_extracted",
  })) as EstimateFact[],
  workArea: { id: "flooring", type: "flooring", name: "Flooring" } as EstimateWorkArea,
});
const commercial = commercializeFlooring({
  physical: flooringPhysical,
  workArea: { id: "flooring", type: "flooring", name: "Flooring" },
  rates: [],
  organisationSettings: null,
  constraints: [],
});
check(
  "waste and transitions stay visible and unpriced",
  commercial.missingInfo.some((row) => row.includes("10% waste")) &&
    commercial.missingInfo.some((row) => row.includes("Transition strips")),
  commercial.missingInfo
);

const officePhysical = calculateFlooringPhysical({
  facts: office.extraction.facts.map((row, index) => ({
    id: `office-fact-${index}`,
    project_id: "project",
    work_area_id: "flooring",
    key: row.key,
    value: row.value,
    source: "ai_extracted",
  })) as EstimateFact[],
  workArea: { id: "flooring", type: "flooring", name: "Flooring" } as EstimateWorkArea,
});
const officeCommercial = commercializeFlooring({
  physical: officePhysical,
  workArea: { id: "flooring", type: "flooring", name: "Flooring" },
  rates: [],
  organisationSettings: null,
  constraints: [],
});
const specialistLines = officeCommercial.lineItems.filter((line) =>
  /carpet tile|supply|installation/i.test(line.label)
);
check(
  "carpet tiles have supply and installation and no sell",
  specialistLines.length >= 2 &&
    specialistLines.every((line) => (line.recommendedSell ?? 0) === 0),
  specialistLines.map((line) => ({ label: line.label, sell: line.recommendedSell }))
);

const legacyFacts = [
  {
    id: "length",
    project_id: "project",
    work_area_id: "walls",
    key: "internal_walls.length_lm",
    value: 6,
    source: "ai_extracted",
  },
  {
    id: "height",
    project_id: "project",
    work_area_id: "walls",
    key: "internal_walls.height_m",
    value: 2.4,
    source: "ai_extracted",
  },
  {
    id: "skirt",
    project_id: "project",
    work_area_id: "walls",
    key: "internal_walls.skirtings_included",
    value: true,
    source: "ai_extracted",
  },
  {
    id: "paint",
    project_id: "project",
    work_area_id: "walls",
    key: "internal_walls.painting_included",
    value: true,
    source: "ai_extracted",
  },
  ...(partition.extraction.facts
    .filter((row) => row.key === "internal_walls.wall_types")
    .map((row, index) => ({
      id: `wall-types-${index}`,
      project_id: "project",
      work_area_id: "walls",
      key: row.key,
      value: row.value,
      source: "ai_extracted",
    })) as EstimateFact[]),
] as EstimateFact[];
const quantities = calculateInternalWalls(
  {
    project: { id: "project", qualityLevel: null },
    confirmedWorkAreas: [
      { id: "walls", type: "internal_walls", name: "Internal walls", sort_order: 1 },
    ],
    facts: legacyFacts,
    constraints: [],
    organisationSettings: null,
    materialWastageSettings: null,
    rates: [],
  },
  { id: "walls", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
const labels = quantities.lineItems.map((line) => line.label);
check(
  "explicit exclusions beat legacy skirting and painting flags",
  !labels.some((label) => /skirting/i.test(label)) &&
    !labels.some((label) => /painting/i.test(label)),
  labels
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

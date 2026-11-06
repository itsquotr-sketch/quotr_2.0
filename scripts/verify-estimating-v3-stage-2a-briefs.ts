/**
 * Stage 2A acceptance briefs. Deterministic. No model, network, or database.
 *
 * Run: npx --yes tsx scripts/verify-estimating-v3-stage-2a-briefs.ts
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  applyInternalWallsFactWrite,
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { FLOORING_PORTIONS_FACT_KEY } from "../lib/estimate/flooring-portions";
import { DOORS_PORTIONS_FACT_KEY } from "../lib/estimate/doors-portions";
import { recognisePreliminaries } from "../lib/estimate/preliminaries";
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
const partitionSide = partitionWall?.side_a as {
  product?: string;
  thickness_mm?: number;
  thickness_source?: string;
} | undefined;
check(
  "partition plasterboard",
  partitionSide?.product === "standard_gib",
  partitionWall
);
check(
  "partition 13 mm is an assumed default",
  partitionSide?.thickness_mm === 13 && partitionSide?.thickness_source === "assumed_disclosed",
  partitionSide
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
check("office lining both sides", officeWall?.same_lining_both_sides === true && officeWall?.side_a.lined === true && officeWall?.side_a.product == null, officeWall);
check("office acoustic insulation", officeWall?.insulation_included === true && officeWall?.insulation_type === "acoustic", officeWall);
check("office six door sets", officeDoors.length === 1 && officeDoors[0]?.quantity === 6, officeDoors);
check(
  "office door sets are not openings in the new walls",
  !Array.isArray(officeWall?.openings) || officeWall.openings.length === 0,
  officeWall?.openings
);
check(
  "office carpet tiles retained",
  officeFloors.length === 1 && officeFloors[0]?.other_description === "carpet tiles",
  officeFloors
);
check("office carpet tile area 120", officeFloors[0]?.area_m2 === 120, officeFloors);
check("office no flooring removal", officeFloors[0]?.finish_removal_required === false, officeFloors);
check("office skirting included without a side", officeWall?.skirting == null, officeWall);
check("office skirting length 45", fact(office, "internal_walls.skirting_length_lm")?.value === 45, fact(office, "internal_walls.skirting_length_lm"));
check(
  "office painting included without a side",
  officeWall?.painting == null && fact(office, "internal_walls.painting_included")?.value === true,
  fact(office, "internal_walls.painting_included")
);
check("office electrical excluded", officeWall?.electrical === "none", officeWall);
check("office occupied", office.constraints.some((row) => row.key === "occupied_site" && row.value === "Yes"), office.constraints);
check("office protection", office.constraints.some((row) => row.key === "protection_dust_control" && row.value === "Yes"), office.constraints);
check("office delivery windows", office.constraints.some((row) => row.key === "working_hours" && row.value === "Yes"), office.constraints);
check(
  "office coverage gap",
  !/site establishment/.test(officeNote) &&
    /duration is not confirmed/.test(officeNote) &&
    /Excluded trades:/.test(officeNote) &&
    recognisePreliminaries(STAGE_2A_OFFICE_FITOUT_BRIEF).items.some((item) => item.id === "site_establishment"),
  officeNote
);
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
check(
  "skirting replacement exclusion is stored",
  rooms.every((row) => row.skirting_replacement_excluded === true),
  rooms.map((row) => row.skirting_replacement_excluded)
);
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
    commercial.missingInfo.some((row) => row.includes("Transition strips")) &&
    commercial.completeness !== "COMPLETE_COMMERCIAL",
  { missing: commercial.missingInfo, completeness: commercial.completeness }
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

function wallsResult(result: ReturnType<typeof enrich>) {
  const area = result.extraction.workAreas.find((row) => row.type === "internal_walls");
  if (!area) return null;
  const workArea: EstimateWorkArea = {
    id: "walls",
    type: "internal_walls",
    name: area.name ?? "Internal walls",
    sort_order: 1,
  };
  const facts = result.extraction.facts
    .filter(
      (row) =>
        row.work_area_type === "internal_walls" ||
        row.key.startsWith("internal_walls.")
    )
    .map(
      (row, index) =>
        ({
          ...row,
          id: `fact-${index}`,
          project_id: "project",
          work_area_id: "walls",
          source: "ai_extracted",
        }) as EstimateFact
    );
  return calculateInternalWalls(
    {
      project: { id: "project", qualityLevel: null },
      confirmedWorkAreas: [workArea],
      facts,
      constraints: [],
      organisationSettings: null,
      materialWastageSettings: null,
      rates: [],
    },
    workArea
  );
}

const officeEstimate = wallsResult(office);
const officeKeys = officeEstimate?.lineItems.map((row) => row.componentKey) ?? [];
check(
  "office lining stays unspecified on both faces",
  officeKeys.filter((key) => key === "internal_walls.lining.unspecified.side_a").length === 1 &&
    officeKeys.filter((key) => key === "internal_walls.lining.unspecified.side_b").length === 1 &&
    !officeKeys.some((key) => key?.includes("standard_gib")),
  officeKeys
);

function internalWallFacts(result: ReturnType<typeof enrich>): EstimateFact[] {
  return result.extraction.facts
    .filter(
      (row) =>
        row.work_area_type === "internal_walls" ||
        row.key.startsWith("internal_walls.")
    )
    .map(
      (row, index) =>
        ({
          ...row,
          id: `fact-${index}`,
          project_id: "project",
          work_area_id: "walls",
          source: "ai_extracted",
        }) as EstimateFact
    );
}

function withWallAnswers(result: ReturnType<typeof enrich>, product: string | null) {
  let facts = internalWallFacts(result);
  const wallTypeId = resolveInternalWallsWallTypes({
    facts,
    workAreaId: "walls",
  }).types[0]?.id;
  const writes: Array<[string, unknown]> = [
    ["internal_walls.wall_type.frame_system", "Timber framing"],
    ["internal_walls.wall_type.frame_size", "90 mm timber framing — 90×45"],
    ["internal_walls.wall_type.length_lm", 24],
    ["internal_walls.wall_type.height_m", 2.7],
    ["internal_walls.wall_type.stud_centres_mm", "400 mm"],
    ["internal_walls.wall_type.has_openings", "No"],
  ];
  if (product) {
    writes.push(["internal_walls.wall_type.side_a_product", product]);
  }
  for (const [key, value] of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "walls",
      wallTypeId,
      key,
      value,
    });
  }
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "walls" }).types[0] ?? null;
  return { facts, type };
}

const officeBeforeProduct = withWallAnswers(office, null);
check(
  "included lining asks for one product before either face is assumed",
  officeBeforeProduct.type?.side_a.lined === true &&
    officeBeforeProduct.type.side_a.product == null &&
    officeBeforeProduct.type.side_b.lined === true &&
    officeBeforeProduct.type.side_b.product == null &&
    officeBeforeProduct.type.same_lining_both_sides === true &&
    nextInternalWallsWallTypeField({
      type: officeBeforeProduct.type,
      jobScope: "new_partition",
    }) === "internal_walls.wall_type.side_a_product",
  officeBeforeProduct.type
);
const officeAfterProduct = withWallAnswers(office, "Standard GIB");
check(
  "one Side A product answer covers both faces",
  officeAfterProduct.type?.side_a.product === "standard_gib" &&
    officeAfterProduct.type.side_b.product === "standard_gib" &&
    officeAfterProduct.type.side_a.thickness_mm === 13 &&
    officeAfterProduct.type.side_a.sheet_length_mm === 2700 &&
    officeAfterProduct.type.side_b.sheet_length_mm === 2700 &&
    nextInternalWallsWallTypeField({
      type: officeAfterProduct.type,
      jobScope: "new_partition",
    }) !== "internal_walls.wall_type.side_b_product",
  officeAfterProduct.type
);
const officeAnsweredEstimate = wallsResult({
  ...office,
  extraction: {
    ...office.extraction,
    facts: office.extraction.facts.map((row) => {
      const answered = officeAfterProduct.facts.find((fact) => fact.key === row.key);
      return answered ? { ...row, value: answered.value } : row;
    }),
  },
});
const officeAnsweredKeys = officeAnsweredEstimate?.lineItems.map((row) => row.componentKey) ?? [];
check(
  "a saved lining product replaces both unspecified faces",
  officeAnsweredKeys.filter((key) => key === "internal_walls.lining.standard_gib.material").length === 2 &&
    !officeAnsweredKeys.some((key) => key?.startsWith("internal_walls.lining.unspecified")),
  officeAnsweredKeys.filter((key) => key?.includes("lining"))
);
const officeOther = withWallAnswers(office, "Other");
const officeOtherEstimate = wallsResult({
  ...office,
  extraction: {
    ...office.extraction,
    facts: office.extraction.facts.map((row) => {
      const answered = officeOther.facts.find((fact) => fact.key === row.key);
      return answered ? { ...row, value: answered.value } : row;
    }),
  },
});
const officeOtherKeys = officeOtherEstimate?.lineItems.map((row) => row.componentKey) ?? [];
check(
  "an unsupported lining choice stays a scope gap",
  officeOther.type?.side_a.product === "other" &&
    officeOther.type.side_b.product === "other" &&
    officeOtherKeys.filter((key) => key === "internal_walls.lining.other.material").length === 2 &&
    !officeOtherKeys.some(
      (key) => key?.includes("standard_gib") || key?.startsWith("internal_walls.lining.unspecified")
    ),
  officeOtherKeys.filter((key) => key?.includes("lining"))
);
const partitionEstimate = wallsResult(partition);
const partitionKeys = partitionEstimate?.lineItems.map((row) => row.componentKey) ?? [];
check(
  "partition plasterboard still uses the lining recipe and does not add a painting rate",
  partitionKeys.filter((key) => key === "internal_walls.lining.standard_gib.material").length === 2 &&
    !partitionKeys.some((key) => key?.includes("unspecified") || key?.includes("coverage_unresolved")),
  partitionKeys.filter((key) => key?.includes("lining") || key?.includes("paint"))
);

if (office) {
  const source = office.extraction.facts.find((row) => row.key === "internal_walls.wall_types");
  const types = Array.isArray(source?.value) ? structuredClone(source.value) : [];
  const first = types[0] as {
    id?: string;
    side_a?: Record<string, unknown>;
    side_b?: Record<string, unknown>;
  };
  if (first?.side_a && first.side_b) {
    first.side_a.product = "standard_gib";
    first.side_a.thickness_mm = 13;
    first.side_a.sheet_length_mm = 2700;
    first.side_a.layers = 1;
    first.side_b.product = "standard_gib";
    first.side_b.thickness_mm = 13;
    first.side_b.sheet_length_mm = 2700;
    first.side_b.layers = 1;
  }
  const answeredFacts = office.extraction.facts.map((row) =>
    row.key === "internal_walls.wall_types" ? { ...row, value: types } : row
  );
  const answered = wallsResult({
    ...office,
    extraction: { ...office.extraction, facts: answeredFacts },
  });
  const answeredKeys = answered?.lineItems.map((row) => row.componentKey) ?? [];
  check(
    "an answered lining product uses the existing recipe once per face",
    answeredKeys.filter((key) => key === "internal_walls.lining.standard_gib.material").length === 2 &&
      !answeredKeys.some((key) => key?.startsWith("internal_walls.lining.unspecified")),
    answeredKeys.filter((key) => key?.includes("lining"))
  );
}

check(
  "office painting is an explicit coverage gap",
  officeKeys.includes("internal_walls.painting.coverage_unresolved") &&
    officeKeys.includes("internal_walls.skirting.painting.coverage_unresolved") &&
    officeEstimate?.lineItems.find(
      (row) => row.componentKey === "internal_walls.skirting.painting.coverage_unresolved"
    )?.quantity === 45 &&
    !officeEstimate?.lineItems.some(
      (row) => row.componentKey === "internal_walls.painting" && (row.recommendedSell ?? 0) > 0
    ),
  officeEstimate?.lineItems
    .filter((row) => row.componentKey?.includes("paint"))
    .map((row) => ({ key: row.componentKey, qty: row.quantity, sell: row.recommendedSell }))
);

const paraphrase = enrich(
  "Install 24 linear metres of new partition walls at 2.7m high and line both sides. Include six door sets, 45 linear metres of skirting, and painting for the new walls and skirting."
);
const paraphraseWall = wallType(paraphrase);
const paraphraseDoors = portions(paraphrase, DOORS_PORTIONS_FACT_KEY) as Array<Record<string, unknown>>;
const paraphraseEstimate = wallsResult(paraphrase);
check(
  "a paraphrased office brief keeps lining, 45 lm and six door sets unresolved as openings",
  paraphraseWall?.length_lm === 24 &&
    paraphraseWall?.height_m === 2.7 &&
    paraphraseWall?.same_lining_both_sides === true &&
    (paraphraseWall?.side_a as { product?: string } | undefined)?.product == null &&
    (!Array.isArray(paraphraseWall?.openings) || paraphraseWall.openings.length === 0) &&
    paraphraseDoors.length === 1 &&
    paraphraseDoors[0]?.quantity === 6 &&
    fact(paraphrase, "internal_walls.skirting_length_lm")?.value === 45 &&
    paraphraseEstimate?.lineItems.some(
      (row) => row.componentKey === "internal_walls.lining.unspecified.side_a"
    ) === true &&
    paraphraseEstimate?.lineItems.some(
      (row) => row.componentKey === "internal_walls.skirting.painting.coverage_unresolved" && row.quantity === 45
    ) === true,
  {
    wall: paraphraseWall,
    doors: paraphraseDoors,
    keys: paraphraseEstimate?.lineItems.map((row) => row.componentKey),
  }
);
const paraphraseBeforeProduct = withWallAnswers(paraphrase, null);
check(
  "a paraphrased lining request asks for the same product",
  paraphraseBeforeProduct.type?.same_lining_both_sides === true &&
    paraphraseBeforeProduct.type.side_a.product == null &&
    nextInternalWallsWallTypeField({
      type: paraphraseBeforeProduct.type,
      jobScope: "new_partition",
    }) === "internal_walls.wall_type.side_a_product",
  paraphraseBeforeProduct.type
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

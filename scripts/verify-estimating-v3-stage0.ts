/**
 * Estimating V3 Stage 0 — deterministic blocker and coverage evidence.
 *
 * Run: npx --yes tsx scripts/verify-estimating-v3-stage0.ts
 *
 * No network, no model, no database, no customer records.
 * The four completion checks below record the Stage 1 correction.
 * Coverage checks still lock the known gaps from production website SHA 40d98384.
 * Those gaps are named in docs/estimating-v3/STAGE_1_BLOCKER_SCOPE.md.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { persistClarifyValueType } from "../lib/assistant/clarify/interaction";
import { groupDetailsCandidates } from "../lib/assistant/clarify/details-groups";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  factUpdateError,
  normalizeAnswerForStorage,
} from "../lib/scopes/fact-values";
import { WARNING_CODES } from "../lib/commercial-engine/contract/codes";
import { classifyResolvedSell } from "../lib/commercial-engine/core/cost-first-authority";
import { FITOUT_BENCHMARKS, BATHROOM_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  deckCountWriteKey,
  deckDetailGaps,
  deckDetailQueuePrompt,
  deckPostHoleControlId,
} from "../lib/estimate/deck-detail-completeness";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import {
  flooringQuestionInputType,
  flooringQuestionOptions,
} from "../lib/estimate/flooring-question-copy";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import {
  FLOORING_PORTIONS_FACT_KEY,
  parseFlooringFinishType,
} from "../lib/estimate/flooring-portions";
import { extractInternalWallsTypesFromBrief } from "../lib/estimate/internal-walls-brief";
import { quotrFallbackSellFromCost, resolveRate } from "../lib/estimate/rates";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import {
  FLOORING_SPECIFIC_MATERIAL_CATALOGUE,
  FLOORING_SUBCONTRACT_RATE_CATALOGUE,
  SPECIFIC_MATERIAL_RATE_CATALOGUE,
} from "../lib/rates/specific-material-catalogue";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { hasCalculatorConsumedFactContract } from "../lib/estimate/consumed-facts";
import { getScopeQuestions } from "../lib/scopes/registry";

const BOARD_WIDTH_KEY = "flooring.portion.hardwood_board_width_mm";
const TILE_WIDTH_KEY = "flooring.portion.tile_width_mm";
const WA = "11111111-1111-4111-8111-111111111111";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fact(
  key: string,
  value: string | number | boolean,
  workAreaId: string = WA
): EstimateFact {
  return {
    key,
    work_area_id: workAreaId,
    value,
    source: "user",
  };
}

function optionStringStoresMillimetres(factKey: string, option: string, millimetres: number): boolean {
  const inputType = flooringQuestionInputType(factKey);
  const valueType = persistClarifyValueType({ inputType }, option);
  const stored = normalizeAnswerForStorage(option, valueType, factKey);
  return (
    inputType === "number" &&
    valueType === "number" &&
    stored === millimetres &&
    factUpdateError({ key: factKey, value: option, valueType }) == null
  );
}

const boardOptions = flooringQuestionOptions(BOARD_WIDTH_KEY) ?? [];
const tileOptions = flooringQuestionOptions(TILE_WIDTH_KEY) ?? [];
check(
  "flooring board width is a number question that also publishes mm options",
  flooringQuestionInputType(BOARD_WIDTH_KEY) === "number" &&
    boardOptions.includes("145 mm")
);
check(
  "selecting 145 mm is stored as 145 millimetres",
  optionStringStoresMillimetres(BOARD_WIDTH_KEY, "145 mm", 145)
);
check(
  "an invalid board width names the field and does not become a number",
  factUpdateError({
    key: BOARD_WIDTH_KEY,
    value: "wide",
    valueType: "number",
  }) === "Enter a board width in millimetres, such as 145."
);
check(
  "tile width uses the same millimetre option",
  tileOptions.includes("600 mm") &&
    optionStringStoresMillimetres(TILE_WIDTH_KEY, "600 mm", 600)
);
check(
  "a plain millimetre number stays finite",
  normalizeAnswerForStorage(145, "number") === 145
);

const holeOnly = [
  fact("deck.substructure_included", true),
  fact("deck.hole_count", 16),
];
const postGaps = deckDetailGaps(holeOnly, WA);
check(
  "a saved hole count does not replace the post count",
  postGaps.some((gap) => gap.id === "posts") &&
    deckCountWriteKey(holeOnly, WA) === "deck.pile_or_post_count",
  postGaps.map((gap) => gap.id).join(",")
);
const postsWritten = [
  fact("deck.substructure_included", true),
  fact("deck.pile_or_post_count", 16),
];
check(
  "the post-count write clears the posts gap",
  !deckDetailGaps(postsWritten, WA).some((gap) => gap.id === "posts") &&
    deckCountWriteKey(postsWritten, WA) === "deck.hole_count"
);
check(
  "the posts gap focuses the hole-count control",
  deckPostHoleControlId(WA, "posts") === `deck-hole-count-${WA}`
);

const postsAnswered = [
  ...holeOnly,
  fact("deck.pile_or_post_count", 16),
  fact("deck.hole_shape", "circular"),
  fact("deck.hole_diameter_mm", 350),
  fact("deck.hole_depth_mm", 600),
  fact("deck.hole_ground", "ordinary"),
  fact("deck.hole_method", "hand"),
  fact("deck.spoil_destination", "on_site"),
];
check(
  "ordinary excavation with a post count has no remaining gaps when concrete is off",
  deckDetailGaps(postsAnswered, WA).length === 0,
  deckDetailGaps(postsAnswered, WA)
    .map((gap) => gap.id)
    .join(",") || "none"
);

const concreteStillOpen = [
  ...postsAnswered,
  fact("deck.concrete_to_supports", true),
];
const concreteGaps = deckDetailGaps(concreteStillOpen, WA).map((gap) => gap.id);
const concretePrompt = deckDetailQueuePrompt(deckDetailGaps(concreteStillOpen, WA));
check(
  "completed excavation leaves the queue while concrete answers stay open",
  concreteGaps.includes("fill") &&
    concreteGaps.includes("post") &&
    concreteGaps.includes("embedment") &&
    !concreteGaps.includes("ground") &&
    !concreteGaps.includes("method") &&
    !concreteGaps.includes("spoil") &&
    concretePrompt === "Finish 3 concrete answers",
  `${concreteGaps.join(",")} ${concretePrompt}`
);

function pcOrder(types: readonly { id: string; type: string; name: string }[]): string[] {
  const workAreas = types.map((row) => ({ ...row, status: "confirmed" as const }));
  const jobPlan = composeJobPlan({
    workAreas,
    facts: [],
    constraints: [],
    qualityLevel: "standard",
    briefText: "",
  });
  const view = composeClarifyView({
    stage: "work_area_questions",
    briefText: "",
    qualityLevel: "standard",
    workAreas,
    facts: [],
    constraints: [],
    jobPlan,
  });
  return view.candidates
    .filter((row) => row.source === "project_condition")
    .map((row) => `${row.askClass}:${row.constraintKey}`);
}

const deckOnly = pcOrder([
  { id: WA, type: "deck", name: "Deck" },
]);
const deckAndBath = pcOrder([
  { id: WA, type: "deck", name: "Deck" },
  {
    id: "22222222-2222-4222-8222-222222222222",
    type: "bathroom",
    name: "Bathroom",
  },
]);
const deckKeys = deckOnly.map((row) => row.split(":")[1]);
const bathroomKeys = deckAndBath.map((row) => row.split(":")[1]);
check(
  "deck project conditions stay in order when a bathroom is added",
  deckKeys.length > 0 &&
    deckKeys.every((key, index) => bathroomKeys[index] === key),
  `deck [${deckOnly.join(", ")}] bathroom [${deckAndBath.join(", ")}]`
);

const grouped = groupDetailsCandidates({
  candidates: [
    {
      id: "pc:site_access",
      source: "project_condition",
      workAreaId: null,
      workAreaName: null,
      workAreaType: null,
      factKey: null,
      constraintKey: "site_access",
      questionKey: "site_access",
      label: "Site access",
      question: "How is the site accessed?",
      askClass: "ASK_NOW",
      inputType: "select",
      options: ["Good", "Restricted"],
      writeTarget: "CONSTRAINT",
      write: null,
      blocksEstimate: false,
      assumable: false,
      rankScore: 85,
      rankReason: "fixture",
      assumptionStatement: null,
    },
    {
      id: "floor",
      source: "scope_fact",
      workAreaId: WA,
      workAreaName: "Office",
      workAreaType: "flooring",
      factKey: "flooring.portion.area_m2",
      constraintKey: null,
      questionKey: "flooring.portion.area_m2",
      label: "Kitchen · Area",
      question: "Area?",
      askClass: "HARD_MINIMUM",
      inputType: "number",
      writeTarget: "FACT",
      write: null,
      blocksEstimate: true,
      assumable: false,
      rankScore: 10,
      rankReason: "fixture",
      assumptionStatement: null,
      nestedItemId: "fa_kitchen",
    },
  ],
  workAreas: [{ id: WA, type: "flooring", name: "Flooring", status: "confirmed" }],
});
check(
  "project conditions are a separate group from nested flooring",
  grouped[0]?.workAreaId == null && grouped[0]?.workAreaName === "Project Conditions",
  grouped.map((group) => group.workAreaName).join(" > ")
);

function catalogueHas(key: string): boolean {
  return SPECIFIC_MATERIAL_RATE_CATALOGUE.some((row) => row.item_key === key);
}

function portionsFact(brief: string): EstimateFact[] {
  const portions = extractFlooringPortionsFromBrief(brief);
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA,
      value: portions,
      source: "ai_extracted",
    },
  ];
}

function priceBrief(brief: string) {
  const workArea: Pick<EstimateWorkArea, "id" | "type" | "name"> = {
    id: WA,
    type: "flooring",
    name: "Flooring",
  };
  const physical = calculateFlooringPhysical({
    facts: portionsFact(brief),
    workArea,
  });
  const commercial = commercializeFlooring({
    physical,
    workArea,
    rates: [],
    organisationSettings: null,
    constraints: [],
  });
  const sell = commercial.lineItems.reduce(
    (sum, line) => sum + (line.recommendedSell ?? 0),
    0
  );
  return {
    portions: extractFlooringPortionsFromBrief(brief).map((row) => ({
      label: row.label,
      finish: row.finish_type,
      specialist: row.specialist_kind,
      area: row.area_m2,
    })),
    physical: physical.completeness,
    commercial: commercial.completeness,
    requirementCount: commercial.requirements.length,
    pricedRequirements: commercial.requirements.filter((row) => row.priced).length,
    sell,
    missing: commercial.missingInfo,
  };
}

const laminate = priceBrief(
  "Flooring only. Office, 10 m2 laminate flooring. No removal and no new substrate."
);
check(
  "laminate is recognised as a specialist, not as vinyl plank or hardwood",
  laminate.portions.some((row) => row.specialist === "laminate" && row.finish === "other")
);
check(
  "laminate has a legacy benchmark object that the nested pricer does not use",
  FITOUT_BENCHMARKS.laminateFlooringPerM2.cost === 110 &&
    FITOUT_BENCHMARKS.laminateFlooringPerM2.sell === 165 &&
    !catalogueHas("flooring.laminate.m2") &&
    laminate.pricedRequirements === 0 &&
    laminate.sell === 0,
  `${laminate.commercial} priced ${laminate.pricedRequirements} sell ${laminate.sell}`
);

const carpetTiles = priceBrief(
  "Supply and install 18 m2 of carpet tiles in the meeting room. No removal."
);
check(
  "carpet tiles are parsed as ordinary carpet",
  parseFlooringFinishType("carpet tiles") === "carpet" &&
    carpetTiles.portions.some(
      (row) => row.finish === "carpet" && row.specialist == null
    ),
  JSON.stringify(carpetTiles.portions)
);
check(
  "the carpet catalogue row is broadloom supply and install, not carpet tiles",
  FLOORING_SUBCONTRACT_RATE_CATALOGUE.some(
    (row) => row.item_key.includes("carpet") && !row.item_key.includes("tile")
  ) &&
    !FLOORING_SPECIFIC_MATERIAL_CATALOGUE.some((row) =>
      row.item_key.toLowerCase().includes("carpet_tile")
    ) &&
    !catalogueHas("flooring.carpet_tile.m2")
);

const rooms = priceBrief(
  "Flooring. Kitchen 12 m2 vinyl plank. Living 20 m2 carpet. No removal in either room."
);
check(
  "two room sentences collapse when the second does not start with a finish verb",
  rooms.portions.length === 1 &&
    rooms.portions[0]?.label === "Kitchen" &&
    rooms.portions[0]?.finish === "vinyl_plank" &&
    rooms.portions[0]?.area === 12,
  JSON.stringify(rooms.portions)
);
const splitRooms = priceBrief(
  "Flooring. Kitchen 12 m2 vinyl plank. Carpet the living room, 20 m2. No removal."
);
check(
  "a second sentence that starts with Carpet becomes its own portion",
  splitRooms.portions.length === 2,
  JSON.stringify(splitRooms.portions)
);

const partitions = extractInternalWallsTypesFromBrief(
  "Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, one door."
);
check(
  "an internal partition brief captures height and frame but not 4.2 m length or the door",
  partitions.length === 1 &&
    partitions[0]?.heightM === 2.4 &&
    partitions[0]?.frameSystem === "timber" &&
    partitions[0]?.lengthLm == null &&
    partitions[0]?.hasOpenings == null,
  JSON.stringify(
    partitions.map((row) => ({
      walls: row.wallCount,
      lengthLm: row.lengthLm,
      heightM: row.heightM,
      frame: row.frameSystem,
      openings: row.hasOpenings,
    }))
  )
);

const tiling = BATHROOM_BENCHMARKS.tilingPerM2;
const derived = resolveRate({
  rates: [],
  rateType: "material",
  itemKey: "bathroom.tiling.m2",
  workAreaType: "bathroom",
  unit: "m2",
  fallbackCostRate: tiling.cost,
  organisationSettings: null,
});
const paired = classifyResolvedSell({
  costRate: tiling.cost,
  sellRate: tiling.sell,
  applicableGrossMarginPercent: 20,
});
const marginSell = quotrFallbackSellFromCost(tiling.cost, null);
check(
  "bathroom tiling fallback uses gross margin, not the stored paired sell",
  derived.sellAuthority === "derived_from_gross_margin" &&
    derived.sellRate === marginSell &&
    derived.sellRate !== tiling.sell,
  `cost ${tiling.cost} margin sell ${derived.sellRate} stored sell ${tiling.sell}`
);
check(
  "the stored bathroom tiling sell is a markup pair, not 20% gross margin",
  paired.sellAuthority === "legacy_paired_rate" &&
    paired.sellRate === 280 &&
    Math.abs(marginSell - 225) < 0.01 &&
    Math.abs(tiling.cost * 1.2 - marginSell) > 1,
  `markup 20% would be ${tiling.cost * 1.2}; margin sell is ${marginSell}`
);

function filesMentioningPreliminary(dir: string): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      hits.push(...filesMentioningPreliminary(path));
      continue;
    }
    if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
    const text = readFileSync(path, "utf8");
    if (text.includes("preliminary_allowance") || text.includes("PRELIMINARY_ALLOWANCE")) {
      hits.push(path.replace(/\\/g, "/"));
    }
  }
  return hits;
}

const preliminaryFiles = filesMentioningPreliminary(join(process.cwd(), "lib")).map((path) =>
  path.slice(path.indexOf("/lib/") + 1)
);
check(
  "project-wide preliminaries exist only as a commercial code",
  WARNING_CODES.PRELIMINARY_ALLOWANCE === "preliminary_allowance" &&
    preliminaryFiles.length === 1 &&
    preliminaryFiles[0] === "lib/commercial-engine/contract/codes.ts",
  preliminaryFiles.join(", ")
);

const doorKeys = getScopeQuestions("doors").map((row) => row.factKey ?? row.key);
check(
  "door customer-supply questions do not use the calculator's client-supplied key",
  doorKeys.includes("doors.hardware_client_supplied") &&
    doorKeys.includes("doors.supply_scope") &&
    !doorKeys.includes("doors.client_supplied")
);
check(
  "cladding has a calculator consumed-fact contract and no scope template",
  hasCalculatorConsumedFactContract("cladding") && getScopeQuestions("cladding").length === 0
);
for (const type of ["pergola", "demolition", "external_stairs", "plastering"] as const) {
  check(
    `${type} has questions and no consumed-fact contract`,
    getScopeQuestions(type).length > 0 && !hasCalculatorConsumedFactContract(type)
  );
}

console.log("\nCatalogue work areas:");
for (const row of SCOPE_CATALOGUE) {
  console.log(`  ${row.type}  ${row.estimateSupport}  ${row.label}`);
}
console.log("\nCoverage snapshots:");
console.log("  laminate", JSON.stringify(laminate));
console.log("  carpet tiles", JSON.stringify(carpetTiles));
console.log("  two rooms", JSON.stringify(rooms));

if (failed > 0) {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);

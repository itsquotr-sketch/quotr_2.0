import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import {
  calculateCeilings,
  calculateInternalWalls,
  calculatePainting,
} from "../lib/estimate/calculators/fitout";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { mergeDuplicateMaterialBuildUpLineItems } from "../lib/estimate/material-buildup-dedupe";
import type { EstimateContext, EstimateWorkArea } from "../lib/estimate/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: {
    decking: 10,
    sheet_material: 10,
    paint: 10,
    default: 5,
  },
  rates: [],
} as unknown as EstimateContext;

function workArea(
  id: string,
  type: string,
  name: string
): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

// Test 1 — Deck no duplication
const deckContext = {
  ...baseContext,
  facts: [
    { key: "deck.area_m2", work_area_id: "wa1", value: 36 },
    { key: "deck.board_width_mm", work_area_id: "wa1", value: 140 },
    { key: "deck.board_material", work_area_id: "wa1", value: "Hardwood" },
    { key: "deck.height_m", work_area_id: "wa1", value: 0.2 },
  ],
} as EstimateContext;

const deckWa = workArea("wa1", "deck", "Deck");
const deckResult = calculateDeck(deckContext, deckWa);
const deckMerged = mergeDuplicateMaterialBuildUpLineItems(deckResult.lineItems);

const deckMaterialLabels = deckMerged
  .filter((item) => item.category === "materials")
  .map((item) => item.label);

assert(
  !deckMaterialLabels.includes("Decking boards"),
  "Deck estimate has no separate Decking boards priced row"
);
assert(
  deckMaterialLabels.includes("Decking materials package"),
  "Deck estimate keeps Decking materials package"
);

const deckPackage = deckMerged.find(
  (item) => item.label === "Decking materials package"
);
assert(deckPackage?.materialBuildUp != null, "Deck package has board lm build-up");
assert(deckPackage?.materialBuildUp?.priced === false, "Deck build-up is not priced");

// Test 2 — Estimate totals not inflated by build-up rows
const estimateContext = {
  ...deckContext,
  confirmedWorkAreas: [deckWa],
} as EstimateContext;
const estimate = calculateEstimate(estimateContext);
const pricedLabels = estimate.lineItems.map((item) => item.label);
assert(
  pricedLabels.filter((label) => label === "Decking boards").length === 0,
  "Full estimate engine excludes duplicate Decking boards row"
);
const estimateSell = estimate.recommendedSell;
assert(estimateSell > 0, "Estimate total is positive");

// Test 5 — Plasterboard sheet count under lining item
const wallsContext = {
  ...baseContext,
  facts: [
    { key: "internal_walls.length_lm", work_area_id: "wa2", value: 8 },
    { key: "internal_walls.height_m", work_area_id: "wa2", value: 2.7 },
    {
      key: "internal_walls.wall_lining_type",
      work_area_id: "wa2",
      value: "Plasterboard",
    },
    { key: "internal_walls.lining_sides", work_area_id: "wa2", value: "Both sides" },
  ],
} as EstimateContext;

const wallsResult = calculateInternalWalls(
  wallsContext,
  workArea("wa2", "internal_walls", "Internal walls")
);
const wallsMaterials = wallsResult.lineItems.find(
  (item) => item.label === "Internal wall materials allowance"
);
assert(
  wallsMaterials?.materialBuildUp?.buildUpType === "sheet_material_count",
  "Plasterboard sheet count appears under wall lining item"
);
assert(
  !wallsResult.lineItems.some((item) =>
    item.label.toLowerCase().includes("plasterboard sheet")
  ),
  "No duplicate plasterboard sheet priced row"
);

const ceilingsContext = {
  ...baseContext,
  facts: [
    { key: "ceilings.area_m2", work_area_id: "wa3", value: 24 },
    {
      key: "ceilings.ceiling_type",
      work_area_id: "wa3",
      value: "Plasterboard",
    },
  ],
} as EstimateContext;

const ceilingsResult = calculateCeilings(
  ceilingsContext,
  workArea("wa3", "ceilings", "Ceilings")
);
const ceilingMaterials = ceilingsResult.lineItems.find((item) =>
  item.label.includes("materials allowance")
);
assert(
  ceilingMaterials?.materialBuildUp?.buildUpType === "sheet_material_count",
  "Ceiling lining has sheet build-up metadata"
);

// Test 6 — Missing facts: no crash, no NaN, no fake build-up
const deckMissingContext = {
  ...baseContext,
  facts: [
    { key: "deck.area_m2", work_area_id: "wa4", value: 20 },
    { key: "deck.board_material", work_area_id: "wa4", value: "Hardwood" },
    { key: "deck.height_m", work_area_id: "wa4", value: 0.2 },
  ],
} as EstimateContext;

const deckMissing = calculateDeck(
  deckMissingContext,
  workArea("wa4", "deck", "Deck missing width")
);
const deckMissingPackage = deckMissing.lineItems.find(
  (item) => item.label === "Decking materials package"
);
assert(
  deckMissingPackage?.materialBuildUp == null,
  "No fake deck board build-up when board width is missing"
);
assert(
  !deckMissing.lineItems.some(
    (item) =>
      item.recommendedSell != null && !Number.isFinite(item.recommendedSell)
  ),
  "Missing facts do not produce NaN sell values"
);

// Retaining wall backfill — volume build-up only, no duplicate m³ row
const rwContext = {
  ...baseContext,
  facts: [
    { key: "retaining_wall.length_m", work_area_id: "wa5", value: 12 },
    { key: "retaining_wall.height_m", work_area_id: "wa5", value: 1.2 },
    { key: "retaining_wall.is_raking", work_area_id: "wa5", value: false },
    { key: "retaining_wall.fixing_type", work_area_id: "wa5", value: "Standard" },
    { key: "retaining_wall.material", work_area_id: "wa5", value: "Timber" },
    { key: "retaining_wall.drainage_required", work_area_id: "wa5", value: false },
    { key: "retaining_wall.backfill_included", work_area_id: "wa5", value: true },
    { key: "retaining_wall.backfill_depth_m", work_area_id: "wa5", value: 0.3 },
    {
      key: "retaining_wall.backfill_length_m",
      work_area_id: "wa5",
      value: 12,
    },
    {
      key: "retaining_wall.backfill_height_m",
      work_area_id: "wa5",
      value: 1.2,
    },
  ],
} as EstimateContext;

const rwResult = calculateRetainingWall(
  rwContext,
  workArea("wa5", "retaining_wall", "Retaining wall")
);
const rwMerged = mergeDuplicateMaterialBuildUpLineItems(rwResult.lineItems);
assert(
  !rwMerged.some((item) => item.label === "Backfill materials"),
  "No separate Backfill materials priced row"
);
const backfillItem = rwMerged.find((item) => item.label === "Backfill allowance");
assert(
  backfillItem?.materialBuildUp?.buildUpType === "backfill_volume",
  "Backfill volume appears as build-up on allowance item"
);

// Paint litres build-up
const paintContext = {
  ...baseContext,
  facts: [
    { key: "painting.location", work_area_id: "wa6", value: "Internal" },
    { key: "painting.internal_area_m2", work_area_id: "wa6", value: 80 },
    { key: "painting.coats_required", work_area_id: "wa6", value: "2" },
    { key: "painting.prep_level", work_area_id: "wa6", value: "Standard" },
    { key: "painting.paint_client_supplied", work_area_id: "wa6", value: false },
  ],
} as EstimateContext;

const paintResult = calculatePainting(
  paintContext,
  workArea("wa6", "painting", "Painting")
);
const paintMaterials = paintResult.lineItems.find(
  (item) => item.label === "Paint materials"
);
assert(
  paintMaterials?.materialBuildUp?.buildUpType === "paint_litres",
  "Paint litres build-up attached to paint materials item"
);

// Fence — scope build-up on materials row only
const fenceContext = {
  ...baseContext,
  facts: [
    { key: "fence.length_m", work_area_id: "wa7", value: 20 },
    { key: "fence.height_m", work_area_id: "wa7", value: 1.8 },
    { key: "fence.material", work_area_id: "wa7", value: "Timber" },
  ],
} as EstimateContext;
const fenceResult = calculateFence(
  fenceContext,
  workArea("wa7", "fence", "Fence")
);
const fenceMerged = mergeDuplicateMaterialBuildUpLineItems(fenceResult.lineItems);
const fenceMaterialRows = fenceMerged.filter((item) =>
  item.label.toLowerCase().includes("fence material")
);
assert(fenceMaterialRows.length === 1, "Fence has single materials priced row");
assert(
  fenceMaterialRows[0]?.materialBuildUp != null,
  "Fence materials row carries scope build-up metadata"
);

// Pergola — area build-up on frame/materials row only
const pergolaContext = {
  ...baseContext,
  facts: [
    { key: "pergola.area_m2", work_area_id: "wa8", value: 24 },
    { key: "pergola.material", work_area_id: "wa8", value: "Timber" },
    { key: "pergola.attached", work_area_id: "wa8", value: "Attached" },
  ],
} as EstimateContext;
const pergolaResult = calculatePergola(
  pergolaContext,
  workArea("wa8", "pergola", "Pergola")
);
const pergolaMerged = mergeDuplicateMaterialBuildUpLineItems(
  pergolaResult.lineItems
);
const pergolaFrameRows = pergolaMerged.filter((item) =>
  item.label.includes("Pergola frame/materials")
);
assert(pergolaFrameRows.length === 1, "Pergola has single frame/materials row");
assert(
  pergolaFrameRows[0]?.materialBuildUp != null,
  "Pergola frame row carries area build-up metadata"
);

// Retaining wall drainage/backfill — build-ups do not duplicate allowance rows
const rwDrainage = calculateRetainingWall(
  {
    ...baseContext,
    facts: [
      { key: "retaining_wall.length_m", work_area_id: "wa9", value: 10 },
      { key: "retaining_wall.height_m", work_area_id: "wa9", value: 1 },
      { key: "retaining_wall.is_raking", work_area_id: "wa9", value: false },
      { key: "retaining_wall.fixing_type", work_area_id: "wa9", value: "Standard" },
      { key: "retaining_wall.material", work_area_id: "wa9", value: "Timber" },
      { key: "retaining_wall.drainage_required", work_area_id: "wa9", value: true },
      { key: "retaining_wall.backfill_included", work_area_id: "wa9", value: true },
      { key: "retaining_wall.backfill_depth_m", work_area_id: "wa9", value: 0.3 },
      { key: "retaining_wall.backfill_length_m", work_area_id: "wa9", value: 10 },
      { key: "retaining_wall.backfill_height_m", work_area_id: "wa9", value: 1 },
    ],
  } as EstimateContext,
  workArea("wa9", "retaining_wall", "RW drainage/backfill")
);
const rwDrainageMerged = mergeDuplicateMaterialBuildUpLineItems(
  rwDrainage.lineItems
);
assert(
  rwDrainageMerged.filter((item) => item.label.includes("Novacoil")).length === 1,
  "Retaining wall has single drainage materials row"
);
assert(
  rwDrainageMerged.filter((item) => item.label === "Backfill allowance").length === 1,
  "Retaining wall has single backfill allowance row"
);

console.log("\nAll material build-up safety checks passed.");

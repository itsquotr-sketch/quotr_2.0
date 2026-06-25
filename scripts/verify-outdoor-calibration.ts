import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { resolvePergolaFrameRate } from "../lib/estimate/pergola-rates";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
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
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as unknown as EstimateContext;

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown) {
  return { key, work_area_id: workAreaId, value };
}

function labels(items: { label: string }[]) {
  return items.map((item) => item.label);
}

function totalSell(items: { recommendedSell: number }[]) {
  return items.reduce((sum, item) => sum + item.recommendedSell, 0);
}

// Deck 1: 70m² hardwood, 140mm, removal, stairs, balustrade
const deck1Facts = [
  fact("deck.area_m2", "d1", 70),
  fact("deck.board_material", "d1", "Hardwood"),
  fact("deck.board_width_mm", "d1", 140),
  fact("deck.height_m", "d1", 0.8),
  fact("deck.existing_deck_removal", "d1", true),
  fact("deck.access_type", "d1", "Stair set"),
  fact("deck.balustrade_required", "d1", true),
];
const deck1 = calculateDeck(
  { ...baseContext, facts: deck1Facts } as EstimateContext,
  wa("d1", "deck", "Deck 1")
);
assert(!labels(deck1.lineItems).includes("Decking boards"), "Deck 1: no duplicate boards row");
assert(labels(deck1.lineItems).includes("Decking materials package"), "Deck 1: has materials package");
assert(labels(deck1.lineItems).includes("Stair set allowance"), "Deck 1: stairs allowance");
assert(labels(deck1.lineItems).includes("Balustrade allowance"), "Deck 1: balustrade");
assert(
  deck1.lineItems.find((i) => i.label === "Decking materials package")?.materialBuildUp != null,
  "Deck 1: board lm build-up on package"
);

// Deck 2: 36m² kwila, ground-level, face boards
const deck2Facts = [
  fact("deck.area_m2", "d2", 36),
  fact("deck.board_material", "d2", "Kwila"),
  fact("deck.board_width_mm", "d2", 140),
  fact("deck.height_m", "d2", 0.15),
  fact("deck.level", "d2", "Ground-level"),
  fact("deck.vertical_face_boards_required", "d2", true),
];
const deck2 = calculateDeck(
  { ...baseContext, facts: deck2Facts } as EstimateContext,
  wa("d2", "deck", "Deck 2")
);
assert(
  labels(deck2.lineItems).some((l) => l.includes("Vertical face")),
  "Deck 2: vertical face boards"
);
assert(
  !labels(deck2.lineItems).includes("Stair set allowance"),
  "Deck 2: no stairs"
);

// Fence 1: 20lm, 1.8m, easy access, no gate
const fence1 = calculateFence(
  {
    ...baseContext,
    facts: [
      fact("fence.length_m", "f1", 20),
      fact("fence.height_m", "f1", 1.8),
      fact("fence.material", "f1", "Timber"),
      fact("fence.access", "f1", "Easy"),
    ],
  } as EstimateContext,
  wa("f1", "fence", "Fence 1")
);
assert(labels(fence1.lineItems).includes("Fence labour"), "Fence 1: labour");
assert(labels(fence1.lineItems).includes("Fence materials"), "Fence 1: materials");
assert(!labels(fence1.lineItems).includes("Gate allowance"), "Fence 1: no gate");
assert(
  fence1.lineItems.find((i) => i.label === "Fence materials")?.materialBuildUp != null,
  "Fence 1: scope build-up on materials"
);

// Fence 2: 30lm, 2m, gate, removal, sloping
const fence2 = calculateFence(
  {
    ...baseContext,
    facts: [
      fact("fence.length_m", "f2", 30),
      fact("fence.height_m", "f2", 2),
      fact("fence.material", "f2", "Timber"),
      fact("fence.gate_included", "f2", true),
      fact("fence.demolition_required", "f2", true),
      fact("fence.disposal_required", "f2", true),
      fact("fence.slope_condition", "f2", "Steep/sloping"),
      fact("fence.access", "f2", "Difficult"),
    ],
  } as EstimateContext,
  wa("f2", "fence", "Fence 2")
);
assert(labels(fence2.lineItems).includes("Gate allowance"), "Fence 2: gate");
assert(labels(fence2.lineItems).includes("Existing fence removal"), "Fence 2: removal");
assert(labels(fence2.lineItems).includes("Fence disposal allowance"), "Fence 2: disposal");

// Pergola 1: 24m² attached aluminium with roof
const pergola1 = calculatePergola(
  {
    ...baseContext,
    facts: [
      fact("pergola.area_m2", "p1", 24),
      fact("pergola.material", "p1", "Aluminium"),
      fact("pergola.attached", "p1", "Attached"),
      fact("pergola.roofing_included", "p1", true),
      fact("pergola.roofing_type", "p1", "Colorsteel"),
    ],
  } as EstimateContext,
  wa("p1", "pergola", "Pergola 1")
);
assert(labels(pergola1.lineItems).includes("Roofing/covering allowance"), "Pergola 1: roofing");
assert(
  !labels(pergola1.lineItems).includes("Footings/posts allowance"),
  "Pergola 1: attached — no footings by default"
);

// Pergola 2: 18m² freestanding timber, footings, no roof
const pergola2 = calculatePergola(
  {
    ...baseContext,
    facts: [
      fact("pergola.area_m2", "p2", 18),
      fact("pergola.material", "p2", "Timber"),
      fact("pergola.attached", "p2", "Free-standing"),
      fact("pergola.roofing_included", "p2", false),
    ],
  } as EstimateContext,
  wa("p2", "pergola", "Pergola 2")
);
assert(labels(pergola2.lineItems).includes("Footings/posts allowance"), "Pergola 2: footings");
assert(
  !labels(pergola2.lineItems).includes("Roofing/covering allowance"),
  "Pergola 2: no roofing"
);

// Retaining Wall 1: raking, face-fixed, poor access, 45m carting
const rw1 = calculateRetainingWall(
  {
    ...baseContext,
    facts: [
      fact("retaining_wall.length_m", "rw1", 14.6),
      fact("retaining_wall.is_raking", "rw1", true),
      fact("retaining_wall.height_high_m", "rw1", 1),
      fact("retaining_wall.height_low_m", "rw1", 0.4),
      fact("retaining_wall.fixing_type", "rw1", "Face-fixed"),
      fact("retaining_wall.material", "rw1", "Timber"),
      fact("retaining_wall.drainage_required", "rw1", false),
      fact("retaining_wall.backfill_included", "rw1", false),
      fact("retaining_wall.access", "rw1", "Difficult"),
      fact("retaining_wall.carting_distance_m", "rw1", 45),
    ],
  } as EstimateContext,
  wa("rw1", "retaining_wall", "RW 1")
);
assert(labels(rw1.lineItems).includes("Carting/material handling allowance"), "RW 1: carting");
assert(totalSell(rw1.lineItems) > 0, "RW 1: positive sell total");

// Retaining Wall 2: 10m x 1m with drainage and backfill
const rw2 = calculateRetainingWall(
  {
    ...baseContext,
    facts: [
      fact("retaining_wall.length_m", "rw2", 10),
      fact("retaining_wall.height_m", "rw2", 1),
      fact("retaining_wall.is_raking", "rw2", false),
      fact("retaining_wall.fixing_type", "rw2", "Standard"),
      fact("retaining_wall.material", "rw2", "Timber"),
      fact("retaining_wall.drainage_required", "rw2", true),
      fact("retaining_wall.backfill_included", "rw2", true),
      fact("retaining_wall.backfill_depth_m", "rw2", 0.3),
      fact("retaining_wall.backfill_length_m", "rw2", 10),
      fact("retaining_wall.backfill_height_m", "rw2", 1),
    ],
  } as EstimateContext,
  wa("rw2", "retaining_wall", "RW 2")
);
assert(
  labels(rw2.lineItems).some((l) => l.includes("Novacoil")),
  "RW 2: drainage"
);
assert(labels(rw2.lineItems).includes("Backfill allowance"), "RW 2: backfill");
assert(
  rw2.lineItems.find((i) => i.label === "Backfill allowance")?.materialBuildUp != null,
  "RW 2: backfill volume build-up"
);

// Retaining wall disposal — included
const rwDisposal = calculateRetainingWall(
  {
    ...baseContext,
    facts: [
      fact("retaining_wall.length_m", "rw3", 12),
      fact("retaining_wall.height_m", "rw3", 1),
      fact("retaining_wall.is_raking", "rw3", false),
      fact("retaining_wall.fixing_type", "rw3", "Standard"),
      fact("retaining_wall.material", "rw3", "Timber"),
      fact("retaining_wall.drainage_required", "rw3", true),
      fact("retaining_wall.backfill_included", "rw3", false),
      fact("retaining_wall.disposal_included", "rw3", true),
    ],
  } as EstimateContext,
  wa("rw3", "retaining_wall", "RW disposal")
);
assert(
  labels(rwDisposal.lineItems).filter((l) => l === "Disposal / cartage allowance").length === 1,
  "RW disposal: single disposal line"
);
assert(totalSell(rwDisposal.lineItems) > 0, "RW disposal: positive total");

const rwDisposalUnknown = calculateRetainingWall(
  {
    ...baseContext,
    facts: [
      fact("retaining_wall.length_m", "rw4", 10),
      fact("retaining_wall.height_m", "rw4", 1),
      fact("retaining_wall.is_raking", "rw4", false),
      fact("retaining_wall.fixing_type", "rw4", "Standard"),
      fact("retaining_wall.material", "rw4", "Timber"),
      fact("retaining_wall.drainage_required", "rw4", false),
      fact("retaining_wall.backfill_included", "rw4", false),
    ],
  } as EstimateContext,
  wa("rw4", "retaining_wall", "RW no disposal")
);
assert(
  !labels(rwDisposalUnknown.lineItems).includes("Disposal / cartage allowance"),
  "RW unknown disposal: no priced disposal line"
);
assert(
  rwDisposalUnknown.assumptions.some((a) => a.toLowerCase().includes("disposal")),
  "RW unknown disposal: assumption present"
);

// Deck pile/post replacement
const deckPiles = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "d3", 40),
      fact("deck.board_material", "d3", "Kwila"),
      fact("deck.height_m", "d3", 0.9),
      fact("deck.pile_or_post_replacement_required", "d3", true),
      fact("deck.pile_or_post_count", "d3", 8),
    ],
  } as EstimateContext,
  wa("d3", "deck", "Deck piles")
);
assert(
  labels(deckPiles.lineItems).includes("Pile/post replacement allowance"),
  "Deck piles: replacement allowance"
);
assert(
  labels(deckPiles.lineItems).filter((l) => l === "Framing/substructure").length === 1,
  "Deck piles: no duplicate framing row"
);

// Fence finishing
const fenceFinish = calculateFence(
  {
    ...baseContext,
    facts: [
      fact("fence.length_m", "f3", 25),
      fact("fence.height_m", "f3", 1.8),
      fact("fence.material", "f3", "Timber"),
      fact("fence.finish_required", "f3", true),
      fact("fence.finish_type", "f3", "stain"),
      fact("fence.finish_sides", "f3", "both_sides"),
    ],
  } as EstimateContext,
  wa("f3", "fence", "Fence finish")
);
assert(
  labels(fenceFinish.lineItems).includes("Fence painting/staining allowance"),
  "Fence finish: allowance line"
);

// Pergola finishing
const pergolaFinish = calculatePergola(
  {
    ...baseContext,
    facts: [
      fact("pergola.area_m2", "p3", 20),
      fact("pergola.material", "p3", "Timber"),
      fact("pergola.attached", "p3", "Attached"),
      fact("pergola.finish_required", "p3", true),
      fact("pergola.finish_type", "p3", "stain"),
    ],
  } as EstimateContext,
  wa("p3", "pergola", "Pergola finish")
);
assert(
  labels(pergolaFinish.lineItems).includes("Pergola painting/staining allowance"),
  "Pergola finish: allowance line"
);

// Pergola material-specific company rate
const aluminiumRate = resolvePergolaFrameRate({
  material: "Aluminium",
  rates: [
    {
      id: "r1",
      org_id: "o1",
      item_key: "pergola.frame.aluminium.m2",
      rate_type: "material",
      work_area_type: "pergola",
      unit: "m2",
      cost_rate: 250,
      sell_rate: 380,
      active: true,
    },
  ] as unknown as EstimateContext["rates"],
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
});
assert(aluminiumRate.costRate === 250, "Pergola rate: company aluminium rate used");

// Quote safety — no internal build-up language in client drafts
const deckQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "deck",
  name: "Deck",
  facts: [
    { key: "deck.area_m2", label: "Area", value: "70" },
    { key: "deck.board_material", label: "Material", value: "Hardwood" },
  ],
});
assert(!deckQuote.toLowerCase().includes("wastage"), "Quote: no wastage in deck draft");
assert(!deckQuote.toLowerCase().includes("margin"), "Quote: no margin in deck draft");

const rwQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "retaining_wall",
  name: "Retaining wall",
  facts: [
    { key: "retaining_wall.disposal_included", label: "Disposal", value: "Yes" },
  ],
});
assert(
  rwQuote.toLowerCase().includes("disposal"),
  "Quote: retaining wall disposal mentioned when included"
);
assert(!rwQuote.toLowerCase().includes("benchmark"), "Quote: no benchmark source");

const fenceFinishQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "fence",
  name: "Fence",
  facts: [
    { key: "fence.finish_required", label: "Finish", value: "Yes" },
    { key: "fence.finish_type", label: "Type", value: "stain" },
  ],
});
assert(
  fenceFinishQuote.toLowerCase().includes("stain"),
  "Quote: fence staining mentioned when included"
);

// Full estimate engine smoke test
const fullEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck 1")],
  facts: deck1Facts,
} as EstimateContext);
assert(fullEstimate.recommendedSell > 0, "Full estimate: positive total");

console.log("\nOutdoor calibration batch 1 checks passed.");
console.log(`Deck 1 sell: $${totalSell(deck1.lineItems).toFixed(0)}`);
console.log(`Fence 2 sell: $${totalSell(fence2.lineItems).toFixed(0)}`);
console.log(`Pergola 1 sell: $${totalSell(pergola1.lineItems).toFixed(0)}`);
console.log(`RW 2 sell: $${totalSell(rw2.lineItems).toFixed(0)}`);

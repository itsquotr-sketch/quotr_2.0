import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { buildFencePhysicalModel } from "../lib/estimate/fence-physical";
import { commercializeFence } from "../lib/estimate/fence-commercial";
import { FENCE_SECTIONS_COMPONENT, FENCE_POSTS_EA_COMPONENT, FENCE_SECTION_LABOUR_COMPONENT, FENCE_FIXINGS_MODULAR_COMPONENT } from "../lib/estimate/fence-identities";
import type { EstimateContext, EstimateFact } from "../lib/estimate/types";

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

function areas(extraction: AIExtractionOutput): string[] {
  return extraction.workAreas.map((area) => area.type);
}

function fact(extraction: AIExtractionOutput, key: string) {
  return extraction.facts.find((row) => row.key === key)?.value;
}

function portions(extraction: AIExtractionOutput, key: string): Array<Record<string, unknown>> {
  const value = fact(extraction, key);
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

const qt003 = run(`rental floors:
bed1 3.6x3.2 carpet
bed2 4.2x3.5 carpet
hall 8x1.2 vinyl plank
all measurements metres

pull existing carpet out of all 3 and dispose. new underlay in bedrooms only. 10 percent material waste on new finishes. transitions at the 2 bedroom doors. keep skirtings. floor condition under carpet unknown, don't allow a full rebuild or major repairs without checking. owner out during work.`);
const rooms = portions(qt003, "flooring.portions");
check("QT-003 keeps three flooring areas", rooms.length === 3, `count=${rooms.length}`);
check(
  "QT-003 bedrooms stay carpet and the hall stays vinyl",
  rooms.some((row) => row.label === "Bedroom 1" && row.finish_type === "carpet" && row.length_m === 3.6) &&
    rooms.some((row) => row.label === "Bedroom 2" && row.finish_type === "carpet" && row.length_m === 4.2) &&
    rooms.some((row) => row.label === "Hallway" && row.finish_type === "vinyl_plank" && row.length_m === 8)
);
check(
  "QT-003 underlay stays on the bedrooms",
  rooms.filter((row) => String(row.label).startsWith("Bedroom") && row.underlay_required === true).length === 2 &&
    rooms.find((row) => row.label === "Hallway")?.underlay_required !== true
);

const qt005 = run(`Two separate areas at the same house:
1. Inside lounge: 5 m × 4 m, supply and install hardwood flooring over the existing prepared plywood.
2. Outside: 4 m × 3 m timber deck, finished height 450 mm above ground, hardwood decking on new timber framing.

Allow 10% finish waste on each area. No floor removal inside. No stairs, balustrades, fascia, demolition or painting on the deck. Deck support design and footing details are not yet available. Do not use the flooring installation rate for the deck.`);
check("QT-005 keeps the deck and the floor", areas(qt005).includes("deck") && areas(qt005).includes("flooring"));
check("QT-005 does not invent a ceiling from deck framing", !areas(qt005).includes("ceilings"), areas(qt005).join(","));
check("QT-005 deck uses its own 4 by 3", fact(qt005, "deck.length_m") === 4 && fact(qt005, "deck.width_m") === 3);
check("QT-005 excluded fascia stays off", fact(qt005, "deck.vertical_face_boards_required") === false);
const floor = portions(qt005, "flooring.portions");
check(
  "QT-005 lounge flooring keeps 5 by 4",
  floor.some((row) => row.label === "Lounge" && row.length_m === 5 && row.width_m === 4)
);

const qt010 = run(`Office alterations:
Wall A is 6 m long × 2.7 m high, 90 × 45 timber framing, 13 mm plasterboard both sides, acoustic insulation, Level 4 stopping both sides. One 810 × 1980 mm door opening, but no door supply or installation.

Wall B is 3 m long × 2.4 m high, steel framing with plywood lining on one side only. No insulation or openings in Wall B.

No painting, skirting, electrical or demolition in either wall.`);
check("QT-010 is internal walls", areas(qt010).includes("internal_walls"), areas(qt010).join(",") || "(none)");
check("QT-010 is not a plastering work area", !areas(qt010).includes("plastering"), areas(qt010).join(","));
const walls = portions(qt010, "internal_walls.wall_types");
check("QT-010 keeps both walls", walls.length === 2, `count=${walls.length}`);
check(
  "QT-010 distinguishes timber and steel",
  walls.some((row) => row.frame_system === "timber" && row.length_lm === 6 && row.has_openings === true) &&
    walls.some((row) => row.frame_system === "steel" && row.length_lm === 3 && row.has_openings === false)
);

const plaster = run("Level 4 stopping to the existing lounge walls, about 18 m2. Sand ready for paint.");
check("independent Level 4 stopping stays plastering", areas(plaster).includes("plastering"));

const qt026 = run(`Install six customer-supplied aluminium fence panels. Each panel is 2.4 m wide × 1.2 m high.

We supply posts, brackets, fixings and installation. Panels are not to be purchased by us. The proposed run is straight, but the manufacturer's post centres and bracket clearances have not been checked.

There is one separate customer-supplied 1 m pedestrian gate. We supply its hardware if compatible. Existing concrete paving may need core drilling; substrate thickness and suitability are unknown.`);
check("QT-026 records customer-supplied panels", fact(qt026, "fence.sections_client_supplied") === true);
check("QT-026 keeps six panels over 14.4 m", fact(qt026, "fence.section_count") === 6 && fact(qt026, "fence.length_m") === 14.4);
const fenceFacts: EstimateFact[] = qt026.facts
  .filter((row) => row.work_area_type === "fence")
  .map((row) => ({
    key: row.key,
    work_area_id: "fence",
    value: row.value,
    source: "ai_extracted",
  }));
const physical = buildFencePhysicalModel({
  context: { facts: fenceFacts } as EstimateContext,
  workAreaId: "fence",
});
const commercial = commercializeFence({
  physical,
  facts: fenceFacts,
  workAreaId: "fence",
  rates: [],
  organisationSettings: null,
});
const section = commercial.requirements.find((row) => row.componentKey === FENCE_SECTIONS_COMPONENT);
const posts = physical.requirements.find((row) => row.componentKey === FENCE_POSTS_EA_COMPONENT);
const fixings = physical.requirements.find((row) => row.componentKey === FENCE_FIXINGS_MODULAR_COMPONENT);
const labour = physical.requirements.find((row) => row.componentKey === FENCE_SECTION_LABOUR_COMPONENT);
check(
  "QT-026 section installation remains",
  labour?.kind === "labour" && labour.productivityBasis.quantity === 6
);
check("QT-026 panel purchase cost is zero", section?.totalCost === 0 && section?.rateSource === "customer_supplied");
check("QT-026 posts remain", (posts && "purchaseQuantity" in posts ? posts.purchaseQuantity : 0) > 0);
check("QT-026 fixings remain", (fixings && "purchaseQuantity" in fixings ? fixings.purchaseQuantity : 0) > 0);

const qt008 = run(`New rectangular deck 6 m × 4 m, 600 mm high. The customer supplies the decking boards only. We supply framing, supports, fixings and labour.

Fascia is required on the front 6 m edge only. The other three edges have no fascia. Do not use the full perimeter. No stairs, demolition, balustrade or coating. Board size and support details still need confirming.`);
check("QT-008 deck is still recognised", areas(qt008).includes("deck"));
check("QT-008 does not mark fence panels customer-supplied", fact(qt008, "fence.sections_client_supplied") == null);

const deckOnly = run("Build a new timber deck, 6 m × 4 m, 450 mm above ground. Include fascia. No stairs.");
check("a single deck still uses its own dimensions", fact(deckOnly, "deck.length_m") === 6 && fact(deckOnly, "deck.width_m") === 4);
check("an included fascia stays on", fact(deckOnly, "deck.vertical_face_boards_required") === true);

for (const [id, brief] of [
  ["QT-001", "Supply and install floating click-lock laminate in a meeting room measuring 4 m × 5 m. The existing concrete substrate is ready for installation. Include separate underlay and a separate moisture barrier; the underlay does not include moisture control. Allow 10% waste on laminate supply only. Pack and roll coverage are not yet known. Price supply separately from installation. No removal, preparation, disposal, transitions or skirting."],
  ["QT-002", "Small office, 4 metres by 3 metres. Supply and lay 500 × 500 mm carpet tiles, straight grid, pressure-sensitive adhesive, separate supply and installation pricing. Ready substrate, no existing flooring to remove. For this test use zero waste: the room fits an 8-by-6 tile grid exactly. Buy individual tiles; no box rounding. No underlay, prep, disposal, transitions or skirting."],
  ["QT-004", "Supply and install vinyl plank in the lounge. My notes say 5 metres by 4 metres, but the property manager's schedule says 32 square metres for that same lounge. I don't know which is correct. Include 10% waste and remove the existing vinyl. Don't pick an area until I confirm it. Subfloor condition unknown."],
] as const) {
  const rows = portions(run(brief), "flooring.portions");
  console.log(
    `diag ${id} ${rows
      .map((row) =>
        [row.label, row.finish_type, row.length_m, row.width_m, row.area_m2, row.tile_length_mm, row.tile_width_mm, row.specialist_kind].join("/")
      )
      .join(" ; ")}`
  );
}

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("scope and supply checks passed");

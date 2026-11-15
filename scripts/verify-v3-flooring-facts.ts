import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import {
  carpetTileWastePercent,
  planCarpetTileAssembly,
} from "../lib/estimate/flooring-carpet-tile";
import { parseFlooringPortions } from "../lib/estimate/flooring-portions";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import { FLOORING_TRANSITION_STRIP_KEY } from "../lib/estimate/flooring-identities";
import type { FlooringPortion } from "../lib/estimate/flooring-portions";
import { classifyReviewNotice, missingRateReviewBlockFromLines } from "../lib/assistant/presentation/estimate-issues";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import {
  namedUnresolvedScopeReviewBlock,
  unresolvedScopeReviewBlock,
} from "../lib/pricing/scope-finalisation";
import type { OrganisationRate } from "../components/setup/types";

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

function storedPortions(brief: string) {
  const extraction = enrichExtractionFromBrief({
    briefText: brief,
    extraction: {
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    } satisfies AIExtractionOutput,
    allowedTypes: allowed,
  }).extraction;
  const value = extraction.facts.find((row) => row.key === "flooring.portions")?.value;
  return parseFlooringPortions(value);
}

const qt001 = storedPortions(
  "Supply and install floating click-lock laminate in a meeting room measuring 4 m × 5 m. The existing concrete substrate is ready for installation. Include separate underlay and a separate moisture barrier; the underlay does not include moisture control. Allow 10% waste on laminate supply only. Pack and roll coverage are not yet known. Price supply separately from installation. No removal, preparation, disposal, transitions or skirting."
);
const meeting = qt001.find((row) => row.label === "Meeting room") ?? qt001[0];
check("QT-001 keeps one meeting room", qt001.length === 1 && meeting != null, `count=${qt001.length}`);
check(
  "QT-001 separate underlay reaches the stored answer",
  meeting?.underlay_required === true && meeting.specialist_kind === "laminate"
);
check(
  "QT-001 separate supply reaches the package decision",
  meeting?.finish_pricing === "separate_supply"
);

const qt002 = storedPortions(
  "Small office, 4 metres by 3 metres. Supply and lay 500 × 500 mm carpet tiles, straight grid, pressure-sensitive adhesive, separate supply and installation pricing. Ready substrate, no existing flooring to remove. For this test use zero waste: the room fits an 8-by-6 tile grid exactly. Buy individual tiles; no box rounding. No underlay, prep, disposal, transitions or skirting."
);
const office = qt002.find((row) => row.label === "Office") ?? qt002[0];
check("QT-002 keeps one office", qt002.length === 1 && office != null, `count=${qt002.length}`);
check(
  "QT-002 carpet-tile millimetres survive persistence",
  office?.specialist_kind === "carpet_tile" &&
    office.tile_width_mm === 500 &&
    office.tile_length_mm === 500
);
check(
  "QT-002 separate supply reaches the package decision",
  office?.finish_pricing === "separate_supply"
);
const officeWaste = office ? carpetTileWastePercent(office) : null;
check(
  "QT-002 explicit zero waste survives persistence",
  office?.carpet_tile_waste === "zero" && officeWaste === 0
);
check(
  "QT-002 keeps box coverage unknown when tiles are bought individually",
  office?.carpet_tile_box === "unknown" &&
    office.carpet_tile_box_coverage_m2 == null &&
    office.carpet_tile_tiles_per_box == null
);
const officeAssembly = office
  ? planCarpetTileAssembly({ portion: office, netM2: 12, owner: "Office" })
  : null;
const officeSupply =
  officeAssembly?.status === "ready"
    ? officeAssembly.lines.find((line) => line.role === "supply")
    : null;
check(
  "QT-002 4 m by 3 m at 500 mm generates 48 tiles with box coverage unknown",
  office?.length_m === 4 &&
    office.width_m === 3 &&
    officeAssembly?.status === "ready" &&
    officeSupply?.quantity === 48 &&
    officeSupply.unit === "tile",
  officeAssembly?.status === "needs_answers"
    ? officeAssembly.missing.join(",")
    : `status=${officeAssembly?.status ?? "none"} qty=${officeSupply?.quantity ?? "none"}`
);

const qt004 = storedPortions(
  "Supply and install vinyl plank in the lounge. My notes say 5 metres by 4 metres, but the property manager's schedule says 32 square metres for that same lounge. I don't know which is correct. Include 10% waste and remove the existing vinyl. Don't pick an area until I confirm it. Subfloor condition unknown."
);
const lounge = qt004.find((row) => row.label === "Lounge") ?? qt004[0];
check("QT-004 keeps one lounge", qt004.length === 1 && lounge != null, `count=${qt004.length}`);
check(
  "QT-004 keeps both competing areas",
  lounge?.length_m === 5 && lounge.width_m === 4 && lounge.area_m2 === 32
);
check(
  "QT-004 still requires an explicit pricing basis",
  lounge?.area_input_method == null && lounge?.finish_pricing == null
);

const qt003 = storedPortions(`rental floors:
bed1 3.6x3.2 carpet
bed2 4.2x3.5 carpet
hall 8x1.2 vinyl plank
all measurements metres

pull existing carpet out of all 3 and dispose. new underlay in bedrooms only. 10 percent material waste on new finishes. transitions at the 2 bedroom doors. keep skirtings.`);
const bedroomTransitions = qt003.filter((row) => row.label?.startsWith("Bedroom"));
const hall = qt003.find((row) => row.label === "Hallway");
check(
  "QT-003 keeps the two bedroom-door transitions off the hall",
  bedroomTransitions.length === 2 &&
    bedroomTransitions.every((row) => row.transitions_required === true && row.transitions_count === 2) &&
    hall?.transitions_required == null
);
check(
  "QT-001 comma-list exclusion is not stored as a transition request",
  meeting?.transitions_required === false
);
check(
  "QT-002 comma-list exclusion is not stored as a transition request",
  office?.transitions_required === false
);

function transitionGap(rows: ReturnType<typeof storedPortions>) {
  return calculateFlooringPhysical({
    facts: [{ key: "flooring.portions", work_area_id: "floor", value: rows }],
    workArea: { id: "floor", type: "flooring", name: "Flooring" },
  });
}
const requested = transitionGap(qt003);
const requestedStrips = requested.requirements.filter(
  (row) => row.componentKey === FLOORING_TRANSITION_STRIP_KEY
);
const requestedMaterial = requestedStrips[0];
check(
  "QT-003 counts two strips once and leaves the hall out",
  requestedStrips.length === 1 &&
    requestedMaterial?.kind === "material" &&
    requestedMaterial.purchaseQuantity === 2 &&
    requestedMaterial.purchaseUnit === "each" &&
    requestedMaterial.specification?.includes("across both doors") === true &&
    requestedMaterial.specification.includes("Count it once.") &&
    !requested.requirements.some(
      (row) =>
        row.componentKey === FLOORING_TRANSITION_STRIP_KEY &&
        row.variantKey === hall?.id
    )
);
const uncountedPhysical = calculateFlooringPhysical({
  facts: [{
    key: "flooring.portions",
    work_area_id: "floor",
    value: qt003.map((row) =>
      row.transitions_required === true ? { ...row, transitions_count: null } : row
    ),
  }],
  workArea: { id: "floor", type: "flooring", name: "Flooring" },
});
const countNotice = uncountedPhysical.missingInfo.find((row) => row.includes("Transition strips"));
check(
  "A missing strip count stays visible and creates no line",
  uncountedPhysical.requirements.every((row) => row.componentKey !== FLOORING_TRANSITION_STRIP_KEY) &&
    countNotice?.includes("Enter one strip count.") === true &&
    countNotice.includes("No quantity is invented.") &&
    classifyReviewNotice(countNotice) === "scope_gap" &&
    namedUnresolvedScopeReviewBlock([countNotice])?.startsWith(countNotice) === true &&
    unresolvedScopeReviewBlock([countNotice]) ===
      "Requested tasks still have no priced line. This pricing cannot be marked reviewed as a complete price."
);
const excluded = transitionGap(qt001);
check(
  "QT-001 exclusion creates no transition gap",
  excluded.requirements.every((row) => row.componentKey !== FLOORING_TRANSITION_STRIP_KEY) &&
    excluded.missingInfo.every((row) => !/transition/i.test(row))
);

function pricedRoom(
  id: string,
  label: string,
  finish: FlooringPortion["finish_type"],
  length: number,
  width: number,
  transitions: boolean
): FlooringPortion {
  return {
    id,
    label,
    finish_type: finish,
    area_input_method: "length_width",
    length_m: length,
    width_m: width,
    area_m2: null,
    underlay_required: finish === "carpet" ? true : null,
    floor_preparation_required: finish === "vinyl_plank" ? false : null,
    tile_width_mm: null,
    tile_length_mm: null,
    hardwood_board_width_mm: null,
    substrate_required: false,
    substrate_family: null,
    substrate_item_key: null,
    framing_required: false,
    framing_allowance_level: null,
    finish_removal_required: false,
    existing_finish_type: null,
    substrate_removal_required: false,
    waste_percent: null,
    finish_pricing: "combined_package",
    transitions_required: transitions ? true : null,
    transitions_count: transitions ? 2 : null,
    other_description: null,
    specialist_kind: null,
  };
}

function transitionRate(cost: number): OrganisationRate {
  return {
    id: "transition-test",
    item_key: FLOORING_TRANSITION_STRIP_KEY,
    rate_type: "material",
    trade: null,
    work_area_type: "flooring",
    label: "Transition strip",
    unit: "each",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

function priceTransitions(rates: OrganisationRate[]) {
  const rooms = [
    pricedRoom("bed-1", "Bedroom 1", "carpet", 3.6, 3.2, true),
    pricedRoom("bed-2", "Bedroom 2", "carpet", 4.2, 3.5, true),
    pricedRoom("hall", "Hallway", "vinyl_plank", 8, 1.2, false),
  ];
  const physical = calculateFlooringPhysical({
    facts: [{ key: "flooring.portions", work_area_id: "floor", value: rooms }],
    workArea: { id: "floor", type: "flooring", name: "Flooring" },
  });
  return commercializeFlooring({
    physical,
    workArea: { id: "floor", type: "flooring", name: "Flooring" },
    rates,
    organisationSettings: null,
  });
}

const beforeRate = priceTransitions([]);
const beforeLine = beforeRate.lineItems.filter(
  (row) => row.componentKey === FLOORING_TRANSITION_STRIP_KEY
);
const beforeBlock = missingRateReviewBlockFromLines(
  beforeLine.map((row) => ({ rate_source: row.rateSource, notes: buildLineItemNotes(row) }))
);
check(
  "A stated count without a company cost stays one unpriced line",
  beforeLine.length === 1 &&
    beforeLine[0]?.quantity === 2 &&
    beforeLine[0]?.unit === "each" &&
    (beforeLine[0]?.recommendedCost ?? 0) === 0 &&
    beforeLine[0]?.notes?.includes("Enter a company cost per strip.") === true &&
    beforeLine[0]?.notes?.includes("A manual Pricing line does not clear this.") === true &&
    beforeBlock?.includes("Add the transition strip rate.") === true &&
    beforeBlock.includes("2 each is not priced.") &&
    beforeRate.missingInfo.some((row) => row.includes("enter a company cost per strip"))
);
const afterRate = priceTransitions([transitionRate(12.5)]);
const afterLine = afterRate.lineItems.filter(
  (row) => row.componentKey === FLOORING_TRANSITION_STRIP_KEY
);
check(
  "A company cost prices the two strips once",
  afterLine.length === 1 &&
    afterLine[0]?.quantity === 2 &&
    afterLine[0]?.recommendedCost === 25 &&
    afterLine[0]?.rateSourceType === "user_rate" &&
    !afterRate.missingInfo.some((row) => /transition|company cost per strip/i.test(row)) &&
    missingRateReviewBlockFromLines(
      afterLine.map((row) => ({ rate_source: row.rateSource, notes: buildLineItemNotes(row) }))
    ) == null
);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("flooring fact checks passed");

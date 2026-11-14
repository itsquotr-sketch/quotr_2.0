import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import {
  carpetTileWastePercent,
  planCarpetTileAssembly,
} from "../lib/estimate/flooring-carpet-tile";
import { parseFlooringPortions } from "../lib/estimate/flooring-portions";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { classifyReviewNotice } from "../lib/assistant/presentation/estimate-issues";

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
const requestedNotice = requested.missingInfo.find((row) => row.includes("Transition strips"));
check(
  "QT-003 states one quantity and does not invent a transition line",
  requested.requirements.every((row) => !/transition/i.test(row.description ?? "")) &&
    requestedNotice?.includes("requested and not priced") === true &&
    requestedNotice.includes("Stated quantity is 2.") &&
    classifyReviewNotice(requestedNotice) === "scope_gap"
);
const excluded = transitionGap(qt001);
check(
  "QT-001 exclusion creates no transition gap",
  excluded.missingInfo.every((row) => !/transition/i.test(row))
);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("flooring fact checks passed");

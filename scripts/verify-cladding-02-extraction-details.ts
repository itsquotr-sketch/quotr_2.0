/**
 * CLADDING-02 — extraction, Details, readiness, and isolation.
 */
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateCladding } from "../lib/estimate/calculators/cladding";
import {
  extractCladdingPortionsFromBrief,
  mergeCladdingPortionsPreferringDeterministic,
  splitCladdingSnippets,
} from "../lib/estimate/cladding-brief";
import {
  claddingNestedItemPanel,
  claddingWorkAreaIsReady,
  listCladdingClarifyCandidates,
  summariseCladdingPortion,
} from "../lib/estimate/cladding-clarify";
import {
  claddingFactIsRelevant,
  claddingPortionIsInformationComplete,
} from "../lib/estimate/cladding-information-contract";
import { CLADDING_PAINTING_DISCLOSURE } from "../lib/estimate/cladding-question-copy";
import {
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_STAGED_NOT_CALCULATED_MESSAGE,
  applyCladdingFactWrite,
  createEmptyCladdingPortion,
  mergePersistedCladdingPortionsOnReanalyse,
  parseCladdingPortions,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { claddingJobPlanAdapter } from "../lib/assistant/job-plan/adapters/cladding";
import { claddingPortionQuestionIdentity } from "../lib/assistant/question-identity";
import { isDetailsOwnedWhenUnresolved } from "../lib/assistant/question-ownership";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { BRIEF_EXTRACTION_SYSTEM_PROMPT } from "../lib/ai/brief-extraction-prompt";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import {
  briefHasIndependentCladding,
  classifyCladdingOwnership,
} from "../lib/work-areas/cladding-ownership";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

const FIXTURE =
  "Supply and install 30 m² of 187 × 18 mm horizontal bevelback timber weatherboards to the north elevation, including a drained cavity, wall underlay, trims and flashings. No removal or painting is required. Also reclad the south elevation with 20 m² of 180 mm horizontal fibre-cement weatherboard, including removal of the existing cladding and new cavity battens, but excluding painting.";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}`);
  }
}

const allowed = getAnalysisCapableWorkAreaTypes();
function enrich(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: { workAreas: [], facts: [], assumptions: [], possibleConstraints: [], warnings: [] },
    allowedTypes: allowed,
  }).extraction;
}

const positive = [
  "install timber cladding",
  "replace weatherboards",
  "reclad the north elevation",
  "install fibre-cement weatherboards",
  "install Linea weatherboard",
  "timber feature cladding outside",
  "brick veneer cladding",
  "masonry veneer",
  "remove existing cladding only",
];
for (const phrase of positive) {
  const owned = classifyCladdingOwnership(phrase);
  check(`${phrase} is Cladding and creates no portions`, owned.claddingPresent && owned.portions.length === 0 && briefHasIndependentCladding(phrase));
}
const negative = [
  "no cladding work",
  "exclude cladding",
  "cladding by others",
  "existing cladding retained",
  "cladding not included",
  "no recladding required",
];
for (const phrase of negative) {
  check(`${phrase} suppresses Cladding`, !briefHasIndependentCladding(phrase));
}

const demo = classifyCladdingOwnership("strip out the house including cladding");
check("wider demolition does not create Cladding", demo.widerDemolitionOwnsPackage && !demo.claddingPresent);
const connected = classifyCladdingOwnership("replace weatherboards");
check("replacement exposes connected removal", connected.connectedRemoval && connected.claddingPresent);
const paint = classifyCladdingOwnership("paint and reclad weatherboards");
check("painting coexists with Cladding", paint.paintingCoexists && paint.claddingPresent);
const windows = classifyCladdingOwnership("replace windows while recladding");
check("windows stay outside Doors", windows.claddingPresent && windows.routeWindowsToDoors === false && windows.createsJoineryCalculator === false);
const opening = classifyCladdingOwnership("form an external opening and install cladding");
check("external opening does not mutate Internal Walls or Doors", opening.claddingPresent && !opening.mutatesInternalWalls && !opening.mutatesDoors);
const north = classifyCladdingOwnership("reclad the north elevation");
check("elevation does not create unrelated work areas", north.unrelatedWorkAreas.length === 0);

check("full stop plus Also splits the fixture", splitCladdingSnippets(FIXTURE).length === 2);
check("plus splits independent cladding", splitCladdingSnippets("install timber cladding plus replace weatherboards on the south elevation").length >= 2);
check("semicolon splits sections", splitCladdingSnippets("install timber cladding to the north elevation; reclad the south elevation").length === 2);
check("and then splits sections", splitCladdingSnippets("install timber cladding and then reclad the south elevation").length === 2);
check("independent and quantity can split", splitCladdingSnippets("install 30 m² timber cladding and 20 m² fibre-cement weatherboard").length >= 2);
check("supply and install stays one clause", splitCladdingSnippets("supply and install timber cladding").length === 1);
check("board and batten stays one clause", splitCladdingSnippets("install timber sheet board and batten cladding").length === 1);
check("trims corners and flashings stay together", splitCladdingSnippets("install timber cladding including trims, corners and flashings").length === 1);

const fixture = extractCladdingPortionsFromBrief(FIXTURE);
const northRow = fixture[0];
const southRow = fixture[1];
check("fixture has exactly two sections", fixture.length === 2 && northRow?.id !== southRow?.id);
check("north section matches the approved bevelback row", northRow?.label === "North elevation" && northRow.scope_intent === "install" && northRow.cladding_family === "timber" && northRow.orientation === "horizontal" && northRow.cladding_system === "timber_bevelback" && northRow.nominal_width_mm === 187 && northRow.nominal_thickness_mm === 18 && northRow.effective_cover_mm === 155 && northRow.approved_profile_id === "timber_bevelback_187x18" && northRow.direct_area_m2 === 30 && northRow.openings_already_deducted == null && northRow.cavity_included === true && northRow.wall_underlay_or_rab_included === true && northRow.trims_flashings_corners_included === true && northRow.existing_cladding_removal_required === false && northRow.painting_or_coating_included === false && northRow.effective_cover_authority === "assumed_disclosed");
check("south section matches the fibre-cement row", southRow?.label === "South elevation" && southRow.scope_intent === "replace" && southRow.cladding_family === "fibre_cement" && southRow.orientation === "horizontal" && southRow.cladding_system === "fibre_cement_horizontal_weatherboard" && southRow.nominal_width_mm === 180 && southRow.effective_cover_mm === 150 && southRow.direct_area_m2 === 20 && southRow.openings_already_deducted == null && southRow.cavity_included === true && southRow.wall_underlay_or_rab_included == null && southRow.trims_flashings_corners_included == null && southRow.existing_cladding_removal_required === true && southRow.painting_or_coating_included === false);

function one(brief: string): CladdingPortion | undefined {
  return extractCladdingPortionsFromBrief(brief)[0];
}
const bevels: Array<[string, number, number, number]> = [
  ["142 × 18", 142, 18, 110],
  ["187 × 18", 187, 18, 155],
  ["215 × 18", 215, 18, 183],
  ["230 × 18", 230, 18, 198],
];
for (const [label, width, thickness, cover] of bevels) {
  const row = one(`install ${label} mm horizontal bevelback timber weatherboards`);
  check(`bevelback ${label} binds cover ${cover}`, row?.nominal_width_mm === width && row.nominal_thickness_mm === thickness && row.effective_cover_mm === cover && row.approved_profile_id === `timber_bevelback_${width}x${thickness}`);
}
const rustics: Array<[string, number, number, number]> = [
  ["135 × 18", 135, 18, 110],
  ["180 × 18", 180, 18, 155],
  ["215 × 18", 215, 18, 190],
  ["230 × 18", 230, 18, 205],
];
for (const [label, width, thickness, cover] of rustics) {
  const row = one(`install ${label} mm rusticated timber weatherboards`);
  check(`rusticated ${label} binds cover ${cover}`, row?.approved_profile_id === `timber_rusticated_${width}x${thickness}` && row.effective_cover_mm === cover);
}
check("shiplap 90 × 21 binds cover 65", one("install 90 × 21 mm vertical shiplap timber cladding")?.approved_profile_id === "timber_vertical_shiplap_90x21");
check("shiplap 135 × 21 binds cover 110", one("install 135 × 21 mm vertical shiplap timber cladding")?.effective_cover_mm === 110);
check("fibre cement 150 binds cover 120", one("install 150 mm horizontal fibre-cement weatherboard")?.effective_cover_mm === 120);
check("fibre cement 180 binds cover 150", one("install 180 mm fibre-cement weatherboard")?.approved_profile_id === "fibre_cement_horizontal_weatherboard_180");
const batten = one("install timber sheet board and batten cladding with 65 × 19 mm battens");
check("board-and-batten records the canonical sheet and stated battens", batten?.approved_profile_id === "timber_sheet_board_and_batten" && batten.board_sheet_length_mm === 2400 && batten.board_sheet_width_mm === 1200 && batten.board_gap_mm === 8 && batten.batten_width_mm === 65 && batten.batten_thickness_mm === 19);
const custom = one("install 187 × 19 mm bevelback timber weatherboards");
check("conflicting profile stays custom", custom?.approved_profile_id == null && custom?.cladding_family === "other" && custom.cladding_system === "specialist_unresolved" && custom.nominal_width_mm === 187 && custom.nominal_thickness_mm === 19);
const linea = one("install Linea weatherboard");
check("Linea without width stays an unanswered fibre-cement profile", linea?.cladding_family === "fibre_cement" && linea.orientation === "horizontal" && linea.cladding_system === "fibre_cement_horizontal_weatherboard" && linea.nominal_width_mm == null && linea.approved_profile_id == null && !linea.other_description?.toLowerCase().includes("linea"));
const lineaWidth = one("install 180 mm Linea weatherboard");
check("Linea with 180 mm binds the fibre-cement profile", lineaWidth?.approved_profile_id === "fibre_cement_horizontal_weatherboard_180");
check("nearest profile is not coerced", one("install 200 × 18 mm bevelback timber weatherboards")?.approved_profile_id == null);

const direct = one("install 30 sqm timber cladding");
check("direct square metres are retained", direct?.direct_area_m2 === 30 && direct.area_method === "direct_m2");
const geometry = one("install timber cladding 8 m long × 2.4 m high");
check("length and height are wall geometry", geometry?.length_m === 8 && geometry.height_m === 2.4 && geometry.area_method === "length_height" && geometry.nominal_width_mm == null);
const profileNotWall = one("install 187 × 18 mm bevelback timber weatherboards");
check("profile millimetres are not wall dimensions", profileNotWall?.length_m == null && profileNotWall?.height_m == null && profileNotWall.nominal_width_mm === 187);
const sheet = one("install timber sheet board and batten cladding using a 2400 × 1200 mm sheet");
check("sheet size is not wall geometry", sheet?.length_m == null && sheet.board_sheet_length_mm === 2400);
check("fibre-cement width is not wall width", one("install 150 mm fibre-cement weatherboard")?.length_m == null);
const openings = one("install 30 m² gross timber cladding, less 4 m² of openings");
check("opening deduction stays separate from wall size", openings?.direct_area_m2 === 30 && openings.openings_already_deducted === false && openings.opening_area_m2 === 4 && openings.length_m == null);
const net = one("install 30 m² timber cladding net of openings");
check("net of openings is recorded without inventing a deduction", net?.openings_already_deducted === true && net.opening_area_m2 == null);
check("silent area leaves openings unanswered", one("install 12 m² timber cladding")?.openings_already_deducted == null);
check("invalid area is not invented", one("install timber cladding")?.direct_area_m2 == null);
check("product size does not overwrite a direct area", one("install 30 m² of 187 × 18 mm bevelback timber weatherboards")?.direct_area_m2 === 30);

check("cavity inclusion is clause-local yes", northRow?.cavity_included === true);
check("underlay inclusion is yes only where stated", northRow?.wall_underlay_or_rab_included === true && southRow?.wall_underlay_or_rab_included == null);
check("RAB language is the same underlay flag", one("install timber cladding including a rigid air barrier")?.wall_underlay_or_rab_included === true);
check("trims stay on the stating clause", northRow?.trims_flashings_corners_included === true && southRow?.trims_flashings_corners_included == null);
check("explicit removal does not leak north", northRow?.existing_cladding_removal_required === false && southRow?.existing_cladding_removal_required === true);
check("explicit painting negative stays local", northRow?.painting_or_coating_included === false && southRow?.painting_or_coating_included === false);
check("excluding cavity is no", one("install timber cladding excluding cavity")?.cavity_included === false);
const removalOnly = one("remove existing cladding only, 18 m² of timber weatherboards");
check("removal-only does not invent a new profile", removalOnly?.scope_intent === "removal_only" && removalOnly.existing_cladding_removal_required === true && removalOnly.approved_profile_id == null);

const aiHybrid = createEmptyCladdingPortion({ id: "ai-hybrid" });
aiHybrid.label = "North elevation";
aiHybrid.scope_intent = "install";
aiHybrid.cladding_family = "timber";
aiHybrid.direct_area_m2 = 99;
aiHybrid.existing_cladding_removal_required = true;
aiHybrid.painting_or_coating_included = true;
const merged = mergeCladdingPortionsPreferringDeterministic([aiHybrid], fixture);
check("deterministic area wins and AI does not collapse sections", merged.length === 2 && merged[0]?.direct_area_m2 === 30 && merged[1]?.direct_area_m2 === 20);
check("AI does not copy removal or painting onto answered sections", merged[0]?.existing_cladding_removal_required === false && merged[1]?.painting_or_coating_included === false);
const fillBase = createEmptyCladdingPortion();
fillBase.scope_intent = "install";
fillBase.scope_intent_authority = "extracted";
fillBase.cladding_family = "timber";
fillBase.family_authority = "extracted";
const aiFill = createEmptyCladdingPortion();
aiFill.scope_intent = "install";
aiFill.cladding_family = "timber";
aiFill.orientation = "vertical";
aiFill.orientation_authority = "extracted";
const filled = mergeCladdingPortionsPreferringDeterministic([aiFill], [fillBase])[0];
check("AI fills only unanswered compatible fields", filled?.scope_intent === "install" && filled.cladding_family === "timber" && filled.orientation === "vertical");
const incompatible = createEmptyCladdingPortion();
incompatible.label = "Garage elevation";
incompatible.cladding_family = "masonry";
incompatible.scope_intent = "install";
check("incompatible AI row is not appended", mergeCladdingPortionsPreferringDeterministic([incompatible], fixture).length === 2);
check("labels stay on their sections", merged[0]?.label === "North elevation" && merged[1]?.label === "South elevation");
check("profiles stay on their sections", merged[0]?.approved_profile_id === "timber_bevelback_187x18" && merged[1]?.approved_profile_id === "fibre_cement_horizontal_weatherboard_180");

const extracted = enrich(FIXTURE);
const portionFact = extracted.facts.find((fact) => fact.key === CLADDING_PORTIONS_FACT_KEY);
const persisted = parseCladdingPortions(portionFact?.value);
check("enrichment persists only the collection", extracted.facts.filter((fact) => fact.key.startsWith("cladding.")).every((fact) => fact.key === CLADDING_PORTIONS_FACT_KEY) && persisted.length === 2);
const again = mergeCladdingPortionsPreferringDeterministic(persisted, persisted);
check("re-analysis merge is idempotent", again.length === 2 && again[0]?.id === persisted[0]?.id && again[1]?.direct_area_m2 === 20);
const userOwned = { ...persisted[0]!, direct_area_m2: 44, direct_area_authority: "user" as const };
const userMerged = mergePersistedCladdingPortionsOnReanalyse({
  extracted: persisted,
  persisted: [userOwned, persisted[1]!],
});
check("user-owned area survives re-analysis", userMerged[0]?.direct_area_m2 === 44 && userMerged[1]?.direct_area_m2 === 20);
const facts: EstimateFact[] = [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: persisted, source: "ai_extracted" }];
const edited = applyCladdingFactWrite({ facts, workAreaId: "c1", key: "cladding.portion.direct_area_m2", value: 33, nestedItemId: persisted[0]?.id });
check("a nested edit does not promote collection source", edited.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.source === "ai_extracted");
check("user area survives on the targeted section only", parseCladdingPortions(edited.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value)[0]?.direct_area_m2 === 33 && parseCladdingPortions(edited.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value)[1]?.direct_area_m2 === 20);
check("no scalar cladding facts are registered by enrichment", !extracted.facts.some((fact) => fact.key === "cladding.area_m2" || fact.key === "cladding.type" || fact.key === "scope.cladding.m2"));

const summaries = persisted.map((portion, index) => summariseCladdingPortion(portion, index));
check("work summary counts two sections", summaries.length === 2);
check("north summary is human", /North elevation · 30 m² · 187\s*[x×]\s*18 mm horizontal bevelback timber weatherboards/.test(summaries[0]?.summary ?? ""));
check("south summary is human", summaries[1]?.summary === "South elevation · 20 m² · 180 mm horizontal fibre-cement weatherboards");
const incomplete = createEmptyCladdingPortion({ label: "Garage elevation" });
incomplete.cladding_family = "timber";
incomplete.cladding_system = "timber_sheet_board_and_batten";
incomplete.approved_profile_id = "timber_sheet_board_and_batten";
check("incomplete board-and-batten stays visible", summariseCladdingPortion(incomplete, 0).summary.includes("area still needed") && summariseCladdingPortion(incomplete, 0).summary.includes("board-and-batten"));
const brick = createEmptyCladdingPortion();
brick.cladding_family = "brick_veneer";
brick.cladding_system = "specialist_unresolved";
brick.specialist_kind = "brick_veneer";
check("brick summary asks for specialist specification", summariseCladdingPortion(brick, 0).summary.includes("Brick veneer") && summariseCladdingPortion(brick, 0).summary.includes("specialist specification required"));
const removalSummary = createEmptyCladdingPortion();
removalSummary.scope_intent = "removal_only";
removalSummary.cladding_family = "timber";
check("removal-only summary is human", summariseCladdingPortion(removalSummary, 0).summary.includes("removal only"));
const card = claddingJobPlanAdapter.project(
  { id: "c1", type: "cladding", name: "Cladding", status: "confirmed" },
  { facts: edited, briefText: FIXTURE, constraints: [], qualityLevel: "standard" }
);
check("card summary has no keys, money, or staged wording", card.summary.includes("2 Cladding sections") && !card.summary.includes("cladding.portions") && !JSON.stringify(card).includes(CLADDING_STAGED_NOT_CALCULATED_MESSAGE) && !JSON.stringify(card).toLowerCase().includes("canonical"));

function candidatesFor(portion: CladdingPortion) {
  return listCladdingClarifyCandidates({
    facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [portion], source: "user" }],
    workAreaId: "c1",
    workAreaName: "Cladding",
  });
}
const empty = createEmptyCladdingPortion();
const emptyKeys = candidatesFor(empty).map((row) => row.factKey);
check("empty section asks for scope before family", emptyKeys[0] === "cladding.portion.scope_intent" && !emptyKeys.includes("cladding.portion.cladding_family"));
const timber = createEmptyCladdingPortion();
timber.scope_intent = "install";
check("family is asked before orientation", candidatesFor(timber).some((row) => row.factKey === "cladding.portion.cladding_family") && !candidatesFor(timber).some((row) => row.factKey === "cladding.portion.orientation"));
timber.cladding_family = "timber";
check("orientation is asked before system", candidatesFor(timber).some((row) => row.factKey === "cladding.portion.orientation") && !candidatesFor(timber).some((row) => row.factKey === "cladding.portion.cladding_system"));
timber.orientation = "horizontal";
const systemOptions = candidatesFor(timber).find((row) => row.factKey === "cladding.portion.cladding_system")?.options ?? [];
check("horizontal timber systems are filtered", systemOptions.includes("Bevelback") && systemOptions.includes("Rusticated") && !systemOptions.includes("Vertical shiplap"));
timber.orientation = "vertical";
const verticalOptions = candidatesFor(timber).find((row) => row.factKey === "cladding.portion.cladding_system")?.options ?? [];
check("vertical timber systems are filtered", verticalOptions.includes("Vertical shiplap") && verticalOptions.includes("Sheet board-and-batten") && !verticalOptions.includes("Bevelback"));
timber.orientation = "horizontal";
timber.cladding_system = "timber_bevelback";
check("profile follows a known system", candidatesFor(timber).some((row) => row.factKey === "cladding.portion.approved_profile") && !candidatesFor(timber).some((row) => row.factKey === "cladding.portion.area_method"));
const fibre = createEmptyCladdingPortion();
fibre.scope_intent = "install";
fibre.cladding_family = "fibre_cement";
check("fibre cement does not ask orientation", !candidatesFor(fibre).some((row) => row.factKey === "cladding.portion.orientation") && candidatesFor(fibre).some((row) => row.question.includes("horizontal fibre-cement")));
const changed = applyCladdingFactWrite({
  facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [{ ...timber, orientation_authority: "extracted", cladding_system: "timber_bevelback", system_authority: "extracted", approved_profile_id: "timber_bevelback_187x18", approved_profile_authority: "extracted" }], source: "ai_extracted" }],
  workAreaId: "c1",
  key: "cladding.portion.orientation",
  value: "vertical",
  nestedItemId: timber.id,
});
const changedPortion = parseCladdingPortions(changed.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value)[0];
check("parent change clears a machine-owned child system", changedPortion?.orientation === "vertical" && changedPortion.cladding_system == null && changedPortion.approved_profile_id == null);
const hidden = applyCladdingFactWrite({
  facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [{ ...timber, cladding_system: "timber_bevelback", system_authority: "user", approved_profile_id: "timber_bevelback_187x18", approved_profile_authority: "user" }], source: "user" }],
  workAreaId: "c1",
  key: "cladding.portion.orientation",
  value: "vertical",
  nestedItemId: timber.id,
});
const hiddenPortion = parseCladdingPortions(hidden.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value)[0];
check(
  "user-owned hidden profile is kept but not applied as the visible profile",
  hiddenPortion?.approved_profile_id === "timber_bevelback_187x18" &&
    hiddenPortion.orientation === "vertical" &&
    !summariseCladdingPortion(hiddenPortion, 0).summary.includes("bevelback")
);
const areaPortion = { ...northRow!, openings_already_deducted: null as null };
check("area method is hidden until profile exists and openings follow area", claddingFactIsRelevant("cladding.portion.area_method", { facts: [], workAreaId: "c1", portion: areaPortion }) && claddingFactIsRelevant("cladding.portion.openings_already_deducted", { facts: [], workAreaId: "c1", portion: areaPortion }));
areaPortion.openings_already_deducted = false;
check("opening deduction appears only after No", claddingFactIsRelevant("cladding.portion.opening_area_m2", { facts: [], workAreaId: "c1", portion: areaPortion }));
const paintingPortion = {
  ...areaPortion,
  openings_already_deducted: true as const,
  painting_or_coating_included: null,
};
check("painting disclosure is in the question", candidatesFor(paintingPortion).some((row) => row.factKey === "cladding.portion.painting_or_coating_included" && row.question.includes(CLADDING_PAINTING_DISCLOSURE)));
const panel = claddingNestedItemPanel({ facts: edited, workAreaId: "c1", workAreaName: "Cladding" });
check("Add Duplicate and Delete keys are exposed", panel?.addKey === "cladding.add_portion" && panel.duplicateKey === "cladding.duplicate_portion" && panel.deleteKey === "cladding.delete_portion" && panel.items.length === 2);
const added = applyCladdingFactWrite({ facts: edited, workAreaId: "c1", key: "cladding.add_portion", value: true });
const addedPortions = parseCladdingPortions(added.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value);
check("Add creates an empty extra section", addedPortions.length === 3 && addedPortions[2]?.cladding_family == null);
const duplicated = applyCladdingFactWrite({ facts: edited, workAreaId: "c1", key: "cladding.duplicate_portion", value: persisted[0]?.id, nestedItemId: persisted[0]?.id });
const copies = parseCladdingPortions(duplicated.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value);
check("Duplicate uses a new id", copies.length === 3 && new Set(copies.map((row) => row.id)).size === 3);
const northIdentity = claddingPortionQuestionIdentity({ workAreaId: "c1", factKey: "cladding.portion.label", nestedItemId: northRow?.id });
const otherIdentity = claddingPortionQuestionIdentity({ workAreaId: "c1", factKey: "cladding.portion.label", nestedItemId: southRow?.id });
check("two sections keep distinct question identity", northIdentity.nestedItemId === northRow?.id && otherIdentity.nestedItemId === southRow?.id && northIdentity.nestedItemId !== otherIdentity.nestedItemId && isDetailsOwnedWhenUnresolved("cladding", "cladding.portion.scope_intent"));

function ready(portion: CladdingPortion): boolean {
  return claddingPortionIsInformationComplete(portion);
}
const ordinary = { ...northRow! };
ordinary.openings_already_deducted = true;
check("complete ordinary section is ready", ready(ordinary));
ordinary.openings_already_deducted = null;
check("missing openings blocks only that section", !ready(ordinary) && ready({ ...southRow!, openings_already_deducted: true, wall_underlay_or_rab_included: true, trims_flashings_corners_included: true }));
const specialist = { ...brick, scope_intent: "install" as const, other_description: "Recycled brick veneer", area_method: "direct_m2" as const, direct_area_m2: 40, openings_already_deducted: true, existing_cladding_removal_required: false };
check("specialist section can be information-complete and remains specialist", ready(specialist) && summariseCladdingPortion(specialist, 0).specialistRequired);
const removalReady = { ...removalOnly!, openings_already_deducted: true };
check("removal-only can be complete without new-cladding inclusions", removalReady.direct_area_m2 != null && ready(removalReady) && !claddingFactIsRelevant("cladding.portion.cavity_included", { facts: [], workAreaId: "c1", portion: removalReady }));
check("direct-area board-and-batten discloses the later batten limit", summariseCladdingPortion({ ...batten!, area_method: "direct_m2", direct_area_m2: 10 }, 0).summary.toLowerCase().includes("batten"));
check("an incomplete sibling does not suppress a complete sibling", claddingWorkAreaIsReady({ facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [ordinary, { ...southRow!, openings_already_deducted: true, wall_underlay_or_rab_included: false, trims_flashings_corners_included: false }], source: "user" }], workAreaId: "c1", workAreaName: "Cladding" }) === false);
ordinary.openings_already_deducted = true;
const bothReady = claddingWorkAreaIsReady({ facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [ordinary, { ...southRow!, openings_already_deducted: true, wall_underlay_or_rab_included: true, trims_flashings_corners_included: true }], source: "user" }], workAreaId: "c1", workAreaName: "Cladding" });
check("two complete sections are ready and location is optional", bothReady && ordinary.label !== "" && claddingFactIsRelevant("cladding.portion.label", { facts: [], workAreaId: "c1", portion: ordinary }));
check("no default area is created for an empty section", createEmptyCladdingPortion().direct_area_m2 == null && !ready(createEmptyCladdingPortion()));
check("a deduction that consumes the area is not ready", !ready({ ...ordinary, openings_already_deducted: false, opening_area_m2: 30 }));
check("zero opening deduction remains ready", ready({ ...ordinary, openings_already_deducted: false, opening_area_m2: 0 }));

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" as const },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
  materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
  rates: [],
};
const staged = calculateCladding(
  { ...baseContext, confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }] },
  { id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }
);
const priced = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 } as EstimateWorkArea],
  facts: edited,
});
check("staged calculator emits no lines, cost, or default area", staged.lineItems.length === 0 && priced.lineItems.filter((line) => line.workAreaId === "c1").every((line) => (line.scopeKey ?? "").startsWith("cladding:") && line.itemKey !== "scope.cladding.m2" && (line.includedInTotal === false || (line.recommendedCost ?? 0) > 0)) && staged.missingInfo.includes(CLADDING_STAGED_NOT_CALCULATED_MESSAGE));
check("incomplete quote stays pending and hides the system key", (() => {
  const quote = buildWorkAreaQuoteDescriptionDraft({
    type: "cladding",
    name: "Cladding",
    facts: [{ key: "cladding.portions", label: "Cladding sections", value: "[{\"cladding_system\":\"timber_bevelback\"}]" }],
  });
  return quote.includes("pending confirmation") && !quote.includes("timber_bevelback") && !quote.includes("Supply and install");
})());
check("prompt names cladding.portions and forbids money", BRIEF_EXTRACTION_SYSTEM_PROMPT.includes("cladding.portions") && BRIEF_EXTRACTION_SYSTEM_PROMPT.includes("Do not emit money"));
check("domain modules do not mention painting cost rates", !BRIEF_EXTRACTION_SYSTEM_PROMPT.includes("painting.material.m2"));
const bathroom = enrich("renovate the bathroom and install timber cladding");
check("bathroom and cladding stay separate", bathroom.workAreas.some((row) => row.type === "bathroom") && bathroom.workAreas.some((row) => row.type === "cladding"));
const deck = enrich("build a new deck");
check("deck language does not create Cladding", !deck.workAreas.some((row) => row.type === "cladding"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

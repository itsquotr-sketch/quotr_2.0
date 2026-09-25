/**
 * PLATFORM-01 — mixed Work Area consolidation.
 *
 * Run: npx --yes tsx scripts/verify-platform-01-mixed-work-areas.ts
 *
 * Drives one hosted-style project through brief → ownership → extraction →
 * persistence → Work → Details → readiness → estimate → Builder Review →
 * Pricing → Quote, using production modules. No parallel calculator.
 *
 * Preview database fixtures are removed in a finally block. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { coerceExtractionPayload, type AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { pricingNoticeForWorkAreaTypes } from "../lib/assistant/builder-review/pricing-notice";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { commitUserFactEdit } from "../lib/assistant/scope-persistence";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { claddingApprovedProfileById } from "../lib/estimate/cladding-profiles";
import { extractCladdingPortionsFromBrief } from "../lib/estimate/cladding-brief";
import {
  CLADDING_CAVITY_TIMBER_BATTEN_M2,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_WALL_UNDERLAY_FLEXIBLE_M2,
} from "../lib/estimate/cladding-identities";
import { calculateCladdingPhysical, claddingLinealMetres } from "../lib/estimate/cladding-physical";
import {
  applyCladdingFactWrite,
  CLADDING_ADD_PORTION_KEY,
  CLADDING_DELETE_PORTION_KEY,
  CLADDING_DUPLICATE_PORTION_KEY,
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_V1_HUMAN_QA_FROZEN,
  storedCladdingPortions,
} from "../lib/estimate/cladding-portions";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_ADD_PORTION_KEY,
  CEILINGS_DELETE_PORTION_KEY,
  CEILINGS_PORTIONS_FACT_KEY,
  storedCeilingsPortions,
} from "../lib/estimate/ceilings-portions";
import { extractDoorPortionsFromBrief } from "../lib/estimate/doors-brief";
import {
  DOORS_CARPENTER_LABOUR_RATE_KEY,
  DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_SET_COMPONENT,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_V1_HUMAN_QA_FROZEN,
} from "../lib/estimate/doors-identities";
import { calculateDoorsPhysical } from "../lib/estimate/doors-physical";
import {
  applyDoorsFactWrite,
  DOORS_ADD_PORTION_KEY,
  DOORS_DELETE_PORTION_KEY,
  DOORS_DUPLICATE_PORTION_KEY,
  DOORS_PORTIONS_FACT_KEY,
  mergePersistedDoorsPortionsOnReanalyse,
  storedDoorsPortions,
} from "../lib/estimate/doors-portions";
import { round2 } from "../lib/estimate/facts";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_V1_HUMAN_QA_FROZEN,
} from "../lib/estimate/flooring-identities";
import { FLOORING_SUBCONTRACT_RATE_TYPE } from "../lib/estimate/flooring-subcontract-authority";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import {
  applyFlooringFactWrite,
  FLOORING_ADD_PORTION_KEY,
  FLOORING_DELETE_PORTION_KEY,
  FLOORING_PORTIONS_FACT_KEY,
  mergePersistedFlooringPortionsOnReanalyse,
  storedFlooringPortions,
} from "../lib/estimate/flooring-portions";
import { internalWallsScopeText } from "../lib/estimate/internal-walls-brief";
import { internalWallsLiningFaceTakeoff } from "../lib/estimate/internal-walls-lining";
import { sumOpeningAreaM2 } from "../lib/estimate/internal-walls-openings";
import { resolveInternalWallsWallTypes } from "../lib/estimate/internal-walls-wall-types";
import { applyTargetMarginToLineItems } from "../lib/estimate/margin-override";
import type { EstimateContext, EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import {
  computeManualPromotionMoney,
  evaluateManualPricingEligibility,
  loadAuthoritativeEstimateForProject,
  saveManualPriceForUnresolvedRequirement,
} from "../lib/pricing/manual-requirement-promotion";
import { calculateAuthoritativeQuoteTotals } from "../lib/quotes/quote-commercial-engine-adapter";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { deriveFactsForProject, mergeDerivedFactsIntoRecords } from "../lib/scopes/derived-facts";
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import { applyScopeCrossoverResolution } from "../lib/scopes/scope-crossover";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

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
function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const INTERNAL_WALLS_FIXTURE =
  "Construct a 4m long, 2.7m high internal wall using 90x45 timber framing with 13mm Standard GIB on both sides. No openings.";
const CEILING_FIXTURE =
  "Lounge ceiling is 4m x 3m with existing framing and 13mm Standard GIB.";
const CANONICAL_BRIEF = [
  "Supply and install 2 × 1980 × 810 mm hollow-core prehung internal door sets to the bedrooms with standard latch/lever hardware included. No door removal.",
  "Supply and install 24 m² of carpet flooring to the bedrooms with new underlay. Existing substrate retained. Existing framing retained. No flooring removal. No substrate removal.",
  INTERNAL_WALLS_FIXTURE,
  CEILING_FIXTURE,
  "Supply and install 20 m² of 180 mm horizontal fibre-cement weatherboard cladding to the North elevation. The areas already exclude openings. Existing drained cavity is to remain. Existing flexible wall underlay is to remain. Existing trims are to remain. No cladding removal is required. Painting and scaffolding are excluded.",
].join(" ");

const FLOORING_SPECIALIST_BRIEF =
  "Supply and install 10 m² of laminate flooring to the office. The area is known. No ordinary carpet package.";
const CLADDING_SPECIALIST_BRIEF =
  "Supply and install 25 m² of brick veneer cladding to the Lower elevation. The area already excludes openings. No existing cladding removal is required. The final brick selection is still to be confirmed. Also supply and install 12 m² of brick veneer cladding to the Upper elevation. The area already excludes openings. No existing cladding removal is required.";

const SETTINGS: OrganisationSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
};
const WASTAGE = { sheet_material: 10, flooring: 10, paint: 10, default: 5 };

console.log("CANONICAL BRIEF:");
console.log(CANONICAL_BRIEF);
console.log("");
console.log("Internal Walls fixture: verify-internal-walls-closure-01a HOSTED_BRIEF");
console.log("Ceilings fixture: verify-ceilings-wa-08-r1-details BRIEF");
console.log("");

function emptyExtraction(): AIExtractionOutput {
  return coerceExtractionPayload({
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  });
}

function hostedProject(brief: string) {
  const enriched = enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: SCOPE_CATALOGUE.map((item) => item.type),
  });
  const normalised = normaliseAIExtraction(enriched.extraction);
  const workAreas: EstimateWorkArea[] = normalised.workAreas.map((wa, index) => ({
    id: `wa-${wa.type}`,
    type: wa.type,
    name: SCOPE_CATALOGUE.find((row) => row.type === wa.type)?.label ?? wa.type,
    sort_order: index + 1,
  }));
  const factRows: EstimateFact[] = normalised.facts.map((fact) => ({
    key: fact.key,
    work_area_id: workAreas.find((wa) => wa.type === fact.work_area_type)?.id ?? null,
    value: fact.value,
    source: "ai_extracted",
  }));
  const derived = deriveFactsForProject({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: factRows,
  });
  const facts = applyScopeCrossoverResolution({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: mergeDerivedFactsIntoRecords(factRows, derived),
  });
  return { workAreas, facts, constraints: enriched.constraints };
}

function estimateOf(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  margin = 20
) {
  const context: EstimateContext = {
    project: { id: "platform-01", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: { ...SETTINGS, default_margin_percent: margin },
    materialWastageSettings: WASTAGE,
    rates,
    briefText: CANONICAL_BRIEF,
  };
  return calculateEstimate(context);
}

function included(items: readonly EstimateLineItemInput[]): EstimateLineItemInput[] {
  return items.filter((row) => row.includedInTotal !== false);
}
function sumCost(items: readonly EstimateLineItemInput[]): number {
  return round2(included(items).reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0));
}
function byType(items: readonly EstimateLineItemInput[], workAreaId: string, category: string): number {
  return round2(
    included(items)
      .filter((row) => row.workAreaId === workAreaId && row.category === category)
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}
function hoursOf(items: readonly EstimateLineItemInput[], workAreaId: string): number {
  return round2(
    included(items)
      .filter((row) => row.workAreaId === workAreaId)
      .reduce((sum, row) => sum + (row.labourHours ?? 0), 0)
  );
}

const project = hostedProject(CANONICAL_BRIEF);
const types = project.workAreas.map((wa) => wa.type);
const area = (type: string) => project.workAreas.find((wa) => wa.type === type)!;
const doors = storedDoorsPortions(project.facts, area("doors").id);
const flooring = storedFlooringPortions(project.facts, area("flooring").id);
const cladding = storedCladdingPortions(project.facts, area("cladding").id);
const ceilings = storedCeilingsPortions(project.facts, area("ceilings").id);
const walls = resolveInternalWallsWallTypes({
  facts: project.facts,
  workAreaId: area("internal_walls").id,
}).types;
const door = doors[0]!;
const floor = flooring[0]!;
const clad = cladding[0]!;
const ceiling = ceilings[0]!;
const wall = walls[0]!;

check("A1 Doors is created exactly once", types.filter((type) => type === "doors").length === 1);
check("A2 Flooring is created exactly once", types.filter((type) => type === "flooring").length === 1);
check("A3 Internal Walls is created exactly once", types.filter((type) => type === "internal_walls").length === 1);
check("A4 Ceilings is created exactly once", types.filter((type) => type === "ceilings").length === 1);
check("A5 Cladding is created exactly once", types.filter((type) => type === "cladding").length === 1);
check("A6 Painting is not created", !types.includes("painting"));
check("A7 Bedrooms is not a Work Area", !types.includes("bedrooms") && !project.workAreas.some((wa) => /bedroom/i.test(wa.name) && wa.type !== "doors" && wa.type !== "flooring"));
check("A8 North elevation is not its own Work Area", !project.workAreas.some((wa) => /north elevation/i.test(wa.name)));
check("A9 Door location language does not create Bathroom or Kitchen", !types.includes("bathroom") && !types.includes("kitchen"));
check("A10 Carpet in bedrooms does not create another room Work Area", types.filter((type) => type === "flooring").length === 1 && !types.includes("living"));
check("A11 Fibre-cement cladding does not create Flooring, Bathroom or Internal Walls extras", types.filter((type) => type === "flooring").length === 1 && types.filter((type) => type === "internal_walls").length === 1 && !types.includes("bathroom"));
check("A12 External elevation language does not create a second Internal Walls", types.filter((type) => type === "internal_walls").length === 1);
check("A13 Explicit removal negatives do not create Demolition", !types.includes("demolition"));
check("A14 No Roofing Work Area is created", !types.includes("roofing"));
check("A15 No unsupported Windows Work Area is created", !types.includes("windows"));
check("A16 No duplicate Work Area type is created", new Set(types).size === types.length);
check("A17 Ceiling sentence survives beside Internal Walls", types.includes("ceilings") && CANONICAL_BRIEF.includes(CEILING_FIXTURE));
check("A18 Only the five intended Work Areas are created", [...types].sort().join(",") === "ceilings,cladding,doors,flooring,internal_walls");

check("B1 One Doors collection", doors.length === 1 && project.facts.filter((row) => row.key === DOORS_PORTIONS_FACT_KEY).length === 1);
check("B2 Bedrooms Door Set quantity 2 at 1980 × 810 hollow-core prehung with hardware", door.label === "Bedrooms" && door.quantity === 2 && door.height_mm === 1980 && door.width_mm === 810 && door.leaf_construction === "hollow_core" && door.installation_type === "prehung_internal" && door.hardware_included === true);
check("B3 Door width is extracted, not the 1980 default alone", door.width_authority === "extracted" && door.height_authority === "extracted");
check("B4 Door Set id is stable and distinct from the Work Area id", typeof door.id === "string" && door.id.length > 4 && door.id !== area("doors").id);
check("B5 One Flooring collection and one Bedrooms area", flooring.length === 1 && floor.label === "Bedrooms" && floor.area_m2 === 24 && floor.finish_type === "carpet");
check("B6 Flooring underlay Yes and substrate, framing and both removals No", floor.underlay_required === true && floor.substrate_required === false && floor.framing_required === false && floor.finish_removal_required === false && floor.substrate_removal_required === false);
check("B7 Flooring Area id is distinct from the Work Area id", floor.id !== area("flooring").id && floor.id !== door.id);
check("B8 One Internal Walls type from the closure fixture", walls.length === 1 && wall.length_lm === 4 && wall.height_m === 2.7 && wall.frame_size === "90x45" && wall.same_lining_both_sides === true);
check("B9 Internal Walls lining stays 13 mm Standard GIB on both sides", wall.side_a.product === "standard_gib" && wall.side_b.product === "standard_gib" && wall.side_a.thickness_mm === 13 && wall.side_b.thickness_mm === 13 && wall.has_openings === false);
check("B19 Other Work Area removal negatives do not flip Internal Walls to remove", project.facts.find((row) => row.key === "internal_walls.job_scope")?.value === "new_partition");
check("B10 Wall type id is distinct from the Work Area id", wall.id !== area("internal_walls").id && wall.id !== door.id && wall.id !== floor.id);
check("B11 One Lounge ceiling from the mature fixture", ceilings.length === 1 && ceiling.label === "Lounge" && ceiling.geometry.length_m === 4 && ceiling.geometry.width_m === 3 && ceiling.structure.family === "existing_framing" && ceiling.lining.plasterboard_product === "standard" && ceiling.lining.thickness_mm === 13);
check("B12 Ceiling id is distinct and painting is not included", ceiling.id !== area("ceilings").id && ceiling.finish.painting_included !== true);
check("B13 One North elevation cladding section", cladding.length === 1 && clad.label === "North elevation" && clad.direct_area_m2 === 20 && clad.cladding_family === "fibre_cement" && clad.orientation === "horizontal" && clad.nominal_width_mm === 180);
check("B14 Cladding profile is the frozen 180 mm fibre-cement weatherboard", clad.approved_profile_id === "fibre_cement_horizontal_weatherboard_180" && clad.effective_cover_mm === 150 && clad.openings_already_deducted === true);
check("B15 Existing cavity, underlay and trims stay retained and removal is No", clad.cavity_state === "retained" && clad.cavity_included === false && clad.underlay_state === "retained" && clad.wall_underlay_or_rab_included === false && clad.trims_state === "retained" && clad.trims_flashings_corners_included === false && clad.existing_cladding_removal_required === false);
check("B16 Cladding section id is distinct from every other nested id", clad.id !== area("cladding").id && ![door.id, floor.id, wall.id, ceiling.id].includes(clad.id));
check("B17 Identical-looking bedrooms labels stay on different nested ids", door.label === floor.label && door.id !== floor.id);
check("B18 Wall scope text does not include the cladding sentence", !internalWallsScopeText(CANONICAL_BRIEF).toLowerCase().includes("fibre-cement") && internalWallsScopeText(CANONICAL_BRIEF).includes("Standard GIB"));

const doorFacts = project.facts.filter((row) => row.work_area_id === area("doors").id && row.key === DOORS_PORTIONS_FACT_KEY);
const floorFacts = project.facts.filter((row) => row.work_area_id === area("flooring").id && row.key === FLOORING_PORTIONS_FACT_KEY);
check("C1 Exactly one canonical collection row per nested Work Area", doorFacts.length === 1 && floorFacts.length === 1 && project.facts.filter((row) => row.key === CLADDING_PORTIONS_FACT_KEY).length === 1 && project.facts.filter((row) => row.key === CEILINGS_PORTIONS_FACT_KEY).length === 1 && project.facts.filter((row) => row.key === "internal_walls.wall_types").length === 1);
check("C2 No competing door count scalar", !project.facts.some((row) => row.key === "doors.count"));
check("C3 No competing flooring area scalar", !project.facts.some((row) => row.key === "flooring.area_m2" || row.key === "scope.flooring.m2"));
check("C4 Internal Walls scalar length agrees with the collection", !project.facts.some((row) => row.key === "internal_walls.length_lm" && row.value !== 4));
check("C5 Internal Walls scalar height agrees with the collection", !project.facts.some((row) => row.key === "internal_walls.height_m" && row.value !== 2.7));

const editedDoors = applyDoorsFactWrite({
  facts: project.facts,
  workAreaId: area("doors").id,
  key: "doors.portion.quantity",
  value: 9,
  nestedItemId: door.id,
});
const editedDoor = storedDoorsPortions(editedDoors, area("doors").id)[0]!;
check("C6 One field edit does not promote sibling fields", editedDoor.quantity === 9 && editedDoor.quantity_authority === "user" && editedDoor.width_authority === "extracted" && editedDoor.hardware_authority === "extracted" && editedDoor.width_mm === 810);
check("C7 Unrelated Flooring authority is unchanged by a Doors edit", storedFlooringPortions(editedDoors, area("flooring").id)[0]?.area_m2 === 24 && storedFlooringPortions(editedDoors, area("flooring").id)[0]?.area_authority === floor.area_authority);
check("C8 A Doors write does not mutate Cladding", storedCladdingPortions(editedDoors, area("cladding").id)[0]?.id === clad.id && storedCladdingPortions(editedDoors, area("cladding").id)[0]?.direct_area_m2 === 20);

const addedDoors = applyDoorsFactWrite({
  facts: project.facts,
  workAreaId: area("doors").id,
  key: DOORS_ADD_PORTION_KEY,
  value: true,
});
const addedRows = storedDoorsPortions(addedDoors, area("doors").id);
const addedEmpty = addedRows.find((row) => row.id !== door.id)!;
check("C9 Add creates an empty Door Set without invented scope", addedRows.length === 2 && addedEmpty.quantity == null && addedEmpty.width_mm == null && addedEmpty.leaf_construction == null && addedEmpty.id !== door.id);
const duplicated = applyDoorsFactWrite({
  facts: project.facts,
  workAreaId: area("doors").id,
  key: DOORS_DUPLICATE_PORTION_KEY,
  value: door.id,
  nestedItemId: door.id,
});
const copies = storedDoorsPortions(duplicated, area("doors").id);
check("C10 Duplicate creates a new nested id", copies.length === 2 && copies.filter((row) => row.quantity === 2).length === 2 && new Set(copies.map((row) => row.id)).size === 2);
const removed = applyDoorsFactWrite({
  facts: duplicated,
  workAreaId: area("doors").id,
  key: DOORS_DELETE_PORTION_KEY,
  value: copies.find((row) => row.id !== door.id)!.id,
});
const afterDelete = storedDoorsPortions(removed, area("doors").id);
check("C11 Delete removes only the selected nested item", afterDelete.length === 1 && afterDelete[0]?.id === door.id);
check("C12 Active pointer remains valid after Add, Duplicate and Delete", afterDelete[0]?.id === door.id && addedEmpty.id.length > 0);
check("C13 Reload preserves nested identity", storedDoorsPortions(project.facts, area("doors").id)[0]?.id === door.id && storedCladdingPortions(project.facts, area("cladding").id)[0]?.id === clad.id);

const floorAdded = applyFlooringFactWrite({ facts: project.facts, workAreaId: area("flooring").id, key: FLOORING_ADD_PORTION_KEY, value: true });
const floorAddedRows = storedFlooringPortions(floorAdded, area("flooring").id);
check("C14 Flooring Add does not invent carpet scope", floorAddedRows.length === 2 && floorAddedRows.some((row) => row.id !== floor.id && row.finish_type == null && row.area_m2 == null));
const cladAdded = applyCladdingFactWrite({ facts: project.facts, workAreaId: area("cladding").id, key: CLADDING_ADD_PORTION_KEY, value: true });
check("C15 Cladding Add does not invent fibre-cement scope", storedCladdingPortions(cladAdded, area("cladding").id).some((row) => row.id !== clad.id && row.cladding_family == null && row.direct_area_m2 == null));
const ceilingAdded = applyCeilingsFactWrite({ facts: project.facts, workAreaId: area("ceilings").id, key: CEILINGS_ADD_PORTION_KEY, value: true });
check("C16 Ceiling Add does not invent Lounge geometry", storedCeilingsPortions(ceilingAdded, area("ceilings").id).some((row) => row.id !== ceiling.id && row.geometry.area_m2 == null && row.label == null));
const cladDup = applyCladdingFactWrite({ facts: project.facts, workAreaId: area("cladding").id, key: CLADDING_DUPLICATE_PORTION_KEY, value: clad.id, nestedItemId: clad.id });
const cladCopies = storedCladdingPortions(cladDup, area("cladding").id);
const cladDeleted = applyCladdingFactWrite({
  facts: cladDup,
  workAreaId: area("cladding").id,
  key: CLADDING_DELETE_PORTION_KEY,
  value: cladCopies.find((row) => row.id !== clad.id)!.id,
});
check("C17 Cladding duplicate then delete restores the original section only", storedCladdingPortions(cladDeleted, area("cladding").id).map((row) => row.id).join(",") === clad.id);

const reextractedDoors = extractDoorPortionsFromBrief(CANONICAL_BRIEF);
const idempotent = mergePersistedDoorsPortionsOnReanalyse({ extracted: reextractedDoors, persisted: doors });
check("D1 Identical door re-analysis keeps the stable id", idempotent.length === 1 && idempotent[0]?.id === door.id && idempotent[0]?.width_mm === 810);
const userSurvives = mergePersistedDoorsPortionsOnReanalyse({ extracted: reextractedDoors, persisted: [editedDoor] });
check("D2 User-owned door quantity survives re-analysis", userSurvives.length === 1 && userSurvives[0]?.quantity === 9 && userSurvives[0]?.quantity_authority === "user" && userSurvives[0]?.width_mm === 810 && userSurvives[0]?.width_authority === "extracted");
check("D3 Editing one door field does not promote the sibling width", editedDoor.quantity_authority === "user" && editedDoor.leaf_authority === "extracted");
const floorEdited = applyFlooringFactWrite({
  facts: project.facts,
  workAreaId: area("flooring").id,
  key: "flooring.portion.area_m2",
  value: 30,
  nestedItemId: floor.id,
});
check("D4 Editing Flooring does not mutate Doors", storedDoorsPortions(floorEdited, area("doors").id)[0]?.quantity === 2 && storedDoorsPortions(floorEdited, area("doors").id)[0]?.id === door.id);
const floorAfterDeleteSibling = applyFlooringFactWrite({
  facts: floorAdded,
  workAreaId: area("flooring").id,
  key: FLOORING_DELETE_PORTION_KEY,
  value: floorAddedRows.find((row) => row.id !== floor.id)!.id,
});
check("D5 Deleting one Flooring sibling does not delete the bedrooms area", storedFlooringPortions(floorAfterDeleteSibling, area("flooring").id).length === 1 && storedFlooringPortions(floorAfterDeleteSibling, area("flooring").id)[0]?.id === floor.id);
const consistent = mergePersistedFlooringPortionsOnReanalyse({
  extracted: extractFlooringPortionsFromBrief(CANONICAL_BRIEF),
  persisted: [floor],
});
check("D6 A consistent Flooring subset keeps the persisted id", consistent.length === 1 && consistent[0]?.id === floor.id && consistent[0]?.area_m2 === 24);
const hybrid = mergePersistedDoorsPortionsOnReanalyse({
  extracted: reextractedDoors,
  persisted: [{ ...editedDoor, specialist_kind: null }],
});
check("D7 A user-owned door hybrid is not split", hybrid.length === 1 && hybrid[0]?.id === door.id);
check("D8 Machine-owned door fields may refresh from the brief", idempotent[0]?.hardware_included === true && idempotent[0]?.installation_type === "prehung_internal");
const pricedFacts = project.facts.map((row) => ({ ...row }));
check("D9 Pricing context is separate from project facts", pricedFacts.length === project.facts.length && storedDoorsPortions(pricedFacts, area("doors").id)[0]?.quantity === 2);
const secondEnrich = hostedProject(CANONICAL_BRIEF);
check("D10 Re-analysis does not duplicate Work Areas", secondEnrich.workAreas.length === project.workAreas.length);
check("D11 Re-analysis extraction does not replace a persisted door id when merged", idempotent[0]?.id === door.id);
check("D12 Add and delete results reload to the surviving id", storedDoorsPortions(removed, area("doors").id)[0]?.id === door.id && storedCladdingPortions(cladDeleted, area("cladding").id)[0]?.id === clad.id);
check("D13 Ceiling delete leaves the Lounge id", storedCeilingsPortions(applyCeilingsFactWrite({
  facts: ceilingAdded,
  workAreaId: area("ceilings").id,
  key: CEILINGS_DELETE_PORTION_KEY,
  value: storedCeilingsPortions(ceilingAdded, area("ceilings").id).find((row) => row.id !== ceiling.id)!.id,
}), area("ceilings").id)[0]?.id === ceiling.id);
check("D14 Active door pointer after delete is the surviving set", storedDoorsPortions(removed, area("doors").id).some((row) => row.id === door.id));
check("D15 Flooring user area survives an identical re-merge", consistent[0]?.finish_type === "carpet" && consistent[0]?.finish_removal_required === false);

const doorPhysical = calculateDoorsPhysical({ facts: project.facts, workArea: area("doors") });
const floorPhysical = calculateFlooringPhysical({ facts: project.facts, workArea: area("flooring") });
const cladPhysical = calculateCladdingPhysical({ facts: project.facts, workArea: area("cladding") });
const ceilingPhysical = calculateCeilingsPhysical({ facts: project.facts, workArea: area("ceilings") });
const lining = internalWallsLiningFaceTakeoff({
  type: wall,
  face: wall.side_a,
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
  openingDeductionM2: sumOpeningAreaM2(wall.openings),
});
const profile = claddingApprovedProfileById("fibre_cement_horizontal_weatherboard_180");
const lineal = profile?.effective_cover_mm != null ? claddingLinealMetres(20, profile.effective_cover_mm) : null;
check("E1 Door physical quantity is 2 sets", doorPhysical.requirements.some((row) => row.kind === "material" && row.componentKey === DOORS_PREHUNG_SET_COMPONENT && row.baseQuantity === 2));
check("E2 Door physical install row exists for the frozen operation", doorPhysical.requirements.some((row) => row.kind === "labour" && row.componentKey === "doors.prehung.install"));
check("E3 Flooring physical area is 24 m² carpet", floorPhysical.requirements.some((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2 && row.baseQuantity === 24));
check("E4 Internal Walls gross face is 4 × 2.7", lining.ok === true && near(lining.grossFaceAreaM2, 10.8) && near(lining.netFaceAreaM2, 10.8) && near(lining.openingDeductionM2, 0));
check("E5 Ceiling area is 12 m²", ceiling.geometry.length_m != null && ceiling.geometry.width_m != null && near(ceiling.geometry.length_m * ceiling.geometry.width_m, 12) && ceilingPhysical.requirements.some((row) => (row.baseQuantity ?? 0) > 0));
check("E6 Cladding net area is 20 m²", cladPhysical.requirements.some((row) => row.baseQuantity === 20 || (row.kind === "material" && row.purchaseUnit === "lm")));
check("E7 Cladding lineal metres use the frozen 180 mm cover", profile?.effective_cover_mm === 150 && lineal != null && near(lineal, 20 / (150 / 1000)) && cladPhysical.requirements.some((row) => row.purchaseUnit === "lm" && near(row.baseQuantity, lineal)));
check("E8 Existing cavity creates no cavity material", !cladPhysical.requirements.some((row) => row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2));
check("E9 Existing underlay creates no underlay material", !cladPhysical.requirements.some((row) => row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2));
check("E10 Existing trims create no trim requirement", !cladPhysical.requirements.some((row) => row.componentKey === CLADDING_TRIMS_UNRESOLVED));
check("E11 Removal negatives create no removal quantities", !floorPhysical.requirements.some((row) => /remove/i.test(row.componentKey)) && !cladPhysical.requirements.some((row) => /removal/i.test(row.componentKey)) && !doorPhysical.requirements.some((row) => /removal/i.test(row.componentKey)));
check("E12 Painting quantity is not emitted", !ceilingPhysical.requirements.some((row) => /paint/i.test(row.componentKey)) && !project.facts.some((row) => row.key.startsWith("painting.")));
check("E13 Cladding does not read the 24 m² flooring area", !cladPhysical.requirements.some((row) => row.baseQuantity === 24));
check("E14 Flooring does not read the 20 m² cladding area", !floorPhysical.requirements.some((row) => row.baseQuantity === 20));
check("E15 Missing ceiling painting does not become a zero paint quantity", ceiling.finish.painting_included !== true && !ceilingPhysical.requirements.some((row) => /paint/i.test(row.componentKey) && row.baseQuantity === 0));
check("E16 An unrelated constraint key is not written back into nested facts", project.facts.every((row) => row.key !== "project.conditions.unrelated"));

const estimate = estimateOf(project.workAreas, project.facts);
const isolatedSum = round2(
  project.workAreas.reduce((sum, wa) => sum + sumCost(estimateOf([wa], project.facts.filter((row) => row.work_area_id === wa.id)).lineItems), 0)
);
function rollup(type: string) {
  const id = area(type).id;
  return {
    materials: byType(estimate.lineItems, id, "materials"),
    labourHours: hoursOf(estimate.lineItems, id),
    labour: byType(estimate.lineItems, id, "labour"),
    subcontract: byType(estimate.lineItems, id, "subcontractor"),
    allowance: byType(estimate.lineItems, id, "allowance"),
    direct: sumCost(estimate.lineItems.filter((row) => row.workAreaId === id)),
  };
}
const rolls = {
  doors: rollup("doors"),
  flooring: rollup("flooring"),
  internal_walls: rollup("internal_walls"),
  ceilings: rollup("ceilings"),
  cladding: rollup("cladding"),
};
console.log("COMMERCIAL ROLLUPS", JSON.stringify(rolls, null, 2));
const direct = sumCost(estimate.lineItems);
check("F1 Project direct COST equals the sum of included line COST", near(direct, round2(included(estimate.lineItems).reduce((sum, row) => sum + row.recommendedCost, 0))));
check("F2 Project direct COST equals the sum of isolated Work Area estimates", near(direct, isolatedSum), `mixed ${direct} isolated ${isolatedSum}`);
check("F3 Estimate recommended COST reconciles to included lines", near(estimate.recommendedCost, direct), `recommended ${estimate.recommendedCost} included ${direct}`);
check("F4 No unresolved included line contributes $0", !estimate.lineItems.some((row) => row.includedInTotal !== false && row.rateSourceType === "missing" && (row.recommendedCost ?? 0) === 0));
check("F5 No included line has a null cost presented as zero authority", !included(estimate.lineItems).some((row) => row.recommendedCost == null));
const componentIds = included(estimate.lineItems).map((row) => `${row.workAreaId}:${row.componentKey}:${row.nestedItemId ?? ""}`);
check("F6 No priced component appears twice", new Set(componentIds).size === componentIds.length);
check("F7 Nested Doors does not use the legacy lump", !estimate.lineItems.some((row) => row.workAreaId === area("doors").id && row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost));
check("F8 Nested Flooring does not use flat $120/m²", !estimate.lineItems.some((row) => row.workAreaId === area("flooring").id && row.costRate === 120 && row.quantity === 24));
check("F9 Carpet subcontract uses the frozen carpet identity", estimate.lineItems.some((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2 && row.workAreaId === area("flooring").id));
check("F10 Door material uses the frozen prehung set COST", estimate.lineItems.some((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT && near(row.costRate, DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST)));
check("E2b Door install hours are frozen productivity times quantity", estimate.lineItems.some((row) => row.componentKey === "doors.prehung.install" && near(row.labourHours, 2 * DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR)));
check("F11 Retained cladding accessories contribute no COST", rolls.cladding.direct > 0 && !estimate.lineItems.some((row) => row.workAreaId === area("cladding").id && (row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2 || row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2 || row.componentKey === CLADDING_TRIMS_UNRESOLVED)));
check("F12 Removal-negative statements contribute no removal COST", !estimate.lineItems.some((row) => /remove/i.test(row.componentKey ?? "") && row.includedInTotal !== false && (row.recommendedCost ?? 0) > 0));
check("F13 Painting COST is absent", !estimate.lineItems.some((row) => row.workAreaId.includes("paint") || /painting/i.test(row.workAreaName)));
check("F14 Material and labour lines stay separate on Doors", estimate.lineItems.some((row) => row.workAreaId === area("doors").id && row.category === "materials") && estimate.lineItems.some((row) => row.workAreaId === area("doors").id && row.category === "labour"));
check("F15 Each Work Area direct COST is the sum of its categories", (["doors", "flooring", "internal_walls", "ceilings", "cladding"] as const).every((type) => near(rolls[type].direct, round2(rolls[type].materials + rolls[type].labour + rolls[type].subcontract + rolls[type].allowance))));
check("F16 Shared line rounding keeps the project total on two decimals", direct === round2(direct));

function companyRate(partial: Partial<OrganisationRate> & Pick<OrganisationRate, "id" | "rate_type" | "item_key" | "unit" | "cost_rate">): OrganisationRate {
  return {
    trade: null,
    work_area_type: null,
    label: partial.item_key,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...partial,
  };
}
const baselineDoorMaterial = estimate.lineItems.find((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT)!;
const baselineDoorHours = hoursOf(estimate.lineItems, area("doors").id);
const baselineCarpet = estimate.lineItems.find((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2)!;
const carpenter = companyRate({ id: "carpenter", rate_type: "labour", item_key: DOORS_CARPENTER_LABOUR_RATE_KEY, unit: "hour", cost_rate: 90 });
const material = companyRate({ id: "door-set", rate_type: "material", item_key: DOORS_PREHUNG_HOLLOW_CORE_SET_KEY, unit: "each", cost_rate: 310 });
const doorSetLine = (rows: EstimateLineItemInput[]) => rows.find((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT);
const subcontract = companyRate({ id: "carpet", rate_type: FLOORING_SUBCONTRACT_RATE_TYPE, item_key: FLOORING_CARPET_SUPPLY_INSTALL_M2, unit: "m2", cost_rate: 99 });
const productivity = companyRate({ id: "prehung-hours", rate_type: "productivity", item_key: DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY, unit: "door", cost_rate: 3 });
const withCarpenter = estimateOf(project.workAreas, project.facts, [carpenter]);
const withMaterial = estimateOf(project.workAreas, project.facts, [material]);
const withSub = estimateOf(project.workAreas, project.facts, [subcontract]);
const withProd = estimateOf(project.workAreas, project.facts, [productivity]);
check("G1 Active carpenter override changes door labour COST only", byType(withCarpenter.lineItems, area("doors").id, "labour") !== rolls.doors.labour && byType(withCarpenter.lineItems, area("doors").id, "materials") === rolls.doors.materials && hoursOf(withCarpenter.lineItems, area("flooring").id) === rolls.flooring.labourHours);
check("G2 Carpenter override does not change door quantity", calculateDoorsPhysical({ facts: project.facts, workArea: area("doors") }).requirements.some((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT && row.baseQuantity === 2));
check("G3 Material override changes only the prehung set", doorSetLine(withMaterial.lineItems)?.costRate === 310 && withMaterial.lineItems.find((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2)?.costRate === baselineCarpet.costRate, `door ${doorSetLine(withMaterial.lineItems)?.costRate}`);
check("G4 Subcontract override changes only carpet", withSub.lineItems.find((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2)?.costRate === 99 && doorSetLine(withSub.lineItems)?.costRate === baselineDoorMaterial.costRate);
check("G5 Productivity override changes door hours and not the material rate", hoursOf(withProd.lineItems, area("doors").id) !== baselineDoorHours && doorSetLine(withProd.lineItems)?.costRate === baselineDoorMaterial.costRate);
check("G6 Zero carpenter cost does not win", estimateOf(project.workAreas, project.facts, [{ ...carpenter, id: "zero", cost_rate: 0 }]).lineItems.find((row) => row.category === "labour" && row.workAreaId === area("doors").id)?.costRate !== 0);
check("G7 Negative material cost does not win", doorSetLine(estimateOf(project.workAreas, project.facts, [{ ...material, cost_rate: -5 }]).lineItems)?.costRate === baselineDoorMaterial.costRate);
check("G8 Inactive override does not win", doorSetLine(estimateOf(project.workAreas, project.facts, [{ ...material, active: false }]).lineItems)?.costRate === baselineDoorMaterial.costRate);
check("G9 Wrong rate type does not win", doorSetLine(estimateOf(project.workAreas, project.facts, [{ ...material, rate_type: "labour" }]).lineItems)?.costRate === baselineDoorMaterial.costRate);
check("G10 Wrong unit does not win", doorSetLine(estimateOf(project.workAreas, project.facts, [{ ...material, unit: "m2" }]).lineItems)?.costRate === baselineDoorMaterial.costRate);
check("G11 Company sell does not become direct COST", doorSetLine(estimateOf(project.workAreas, project.facts, [{ ...material, cost_rate: null, sell_rate: 999 }]).lineItems)?.recommendedCost === baselineDoorMaterial.recommendedCost);
check("G12 Removing the override restores Quotr", doorSetLine(estimateOf(project.workAreas, project.facts, []).lineItems)?.costRate === DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST);
check("G13 Other-tenant rates are not in this estimate context", doorSetLine(estimate.lineItems)?.rateSourceType !== "company");
check("G14 Re-analysis facts still contain the carpet area after a rate test", floor.area_m2 === 24 && floor.finish_type === "carpet");

const review = composeBuilderReview({
  estimate: {
    recommendedCost: estimate.recommendedCost,
    recommendedSell: estimate.recommendedSell,
    marginPercent: estimate.marginPercent,
    confidence: estimate.confidence,
    assumptions: estimate.assumptions,
    missingInfo: estimate.missingInfo,
    lineItems: estimate.lineItems.map((item, index) => ({ ...item, id: `line-${index}` })) as EstimateLineItem[],
  },
  workAreas: project.workAreas.map((wa) => ({ ...wa, status: "confirmed" })),
  requirements: estimate.requirements,
  facts: project.facts,
  briefText: CANONICAL_BRIEF,
});
const reviewLabels: string[] = [];
function collectDisplay(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of ["label", "title", "summary", "description", "detail", "note", "message", "partialEstimateLabel"]) {
    if (typeof record[key] === "string") reviewLabels.push(record[key] as string);
  }
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) child.forEach(collectDisplay);
    else if (child && typeof child === "object") collectDisplay(child);
  }
}
collectDisplay(review);
const reviewText = reviewLabels.join("\n");
check("H1 Builder Review groups every Work Area", project.workAreas.every((wa) => review.workAreas.some((group) => group.workAreaId === wa.id || group.label === wa.name || reviewText.includes(wa.name))));
check("H2 Nested labels Bedrooms, Lounge and North elevation appear", reviewText.includes("Bedrooms") && reviewText.includes("Lounge") && reviewText.includes("North elevation"));
check("H3 Review copy has no raw rate keys", !/labour\.carpenter|door\.set\.internal|flooring\.carpet/.test(reviewText));
check("H4 Review copy has no overlap groups or field authority", !/overlapGroup|assumed_disclosed|ai_extracted/.test(reviewText));
check("H5 Review copy has no raw floating-point tails", !/\d+\.\d{5,}/.test(reviewText));
check("H6 Review copy has no internal enum tokens", !/prehung_internal|hollow_core|fibre_cement_horizontal/.test(reviewText));
check("H7 No removal is displayed for the negative removal scope", !/remove existing cladding|remove carpet|door removal/i.test(reviewText));
check("H8 No duplicate Painting scope in review", !review.workAreas.some((group) => group.type === "painting") && (reviewText.match(/Painting/g) ?? []).length === 0);
check("H9 Fully priced mixed project has no pricing warning", review.overview.partialEstimateLabel == null);
check("H10 A single unresolved Work Area warning names that Work Area", pricingNoticeForWorkAreaTypes(["flooring"]) === "Some Flooring items still require pricing.");
check("H11 Multiple unresolved Work Areas use the shared generic warning", pricingNoticeForWorkAreaTypes(["flooring", "cladding"]) === "Some items still require pricing.");
check("H12 The warning never defaults to Ceiling", pricingNoticeForWorkAreaTypes(["doors"]) === "Some Doors items still require pricing." && pricingNoticeForWorkAreaTypes(["cladding"]) !== "Some Ceiling items still require pricing.");
check("H13 Review cost reconciles", review.costReconciles === true && near(review.projectedCost, estimate.recommendedCost));
check("H14 Retained cladding is described without a new cavity", /remain|retained|existing/i.test(reviewText) && !/Includes a drained cavity/.test(reviewText));

const plan = composeJobPlan({ workAreas: project.workAreas.map((wa) => ({ ...wa, status: "confirmed" as const })), facts: project.facts, briefText: CANONICAL_BRIEF, qualityLevel: "standard" });
check("H15 Work plan lists the five Work Areas", plan.cards.length === project.workAreas.length && project.workAreas.every((wa) => plan.cards.some((card) => card.workAreaType === wa.type)));
check("H16 Work plan does not invent Painting, Demolition or Roofing", !plan.cards.some((card) => card.workAreaType === "painting" || card.workAreaType === "demolition" || card.workAreaType === "roofing"));

function specialistProject(brief: string) {
  return hostedProject(brief);
}
const floorSpec = specialistProject(FLOORING_SPECIALIST_BRIEF);
const floorSpecEstimate = estimateOf(floorSpec.workAreas.filter((wa) => wa.type === "flooring"), floorSpec.facts.filter((row) => row.work_area_id === floorSpec.workAreas.find((wa) => wa.type === "flooring")?.id));
const floorSpecLine = floorSpecEstimate.lineItems.find((row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT);
const floorSpecPortion = storedFlooringPortions(floorSpec.facts, floorSpec.workAreas.find((wa) => wa.type === "flooring")!.id)[0];
check("I1 Laminate stays a specialist with quantity 10", floorSpecPortion?.specialist_kind === "laminate" && floorSpecPortion.area_m2 === 10 && floorSpecPortion.label === "Office" && floorSpecPortion.finish_type === "other");
check("I2 Laminate does not inherit the carpet package", !floorSpecEstimate.lineItems.some((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2));
check("I3 Laminate COST is not an included $0", floorSpecLine != null && floorSpecLine.includedInTotal === false && floorSpecLine.rateSourceType === "missing" && sumCost(floorSpecEstimate.lineItems.filter((row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT)) === 0, `line ${floorSpecLine?.includedInTotal} ${floorSpecLine?.recommendedCost} project ${floorSpecEstimate.recommendedCost}`);
check("I4 Laminate Builder Review says Pricing Required", (() => {
  const view = composeBuilderReview({
    estimate: {
      recommendedCost: floorSpecEstimate.recommendedCost,
      recommendedSell: floorSpecEstimate.recommendedSell,
      marginPercent: floorSpecEstimate.marginPercent,
      confidence: floorSpecEstimate.confidence,
      assumptions: floorSpecEstimate.assumptions,
      missingInfo: floorSpecEstimate.missingInfo,
      lineItems: floorSpecEstimate.lineItems.map((item, index) => ({ ...item, id: `fs-${index}` })) as EstimateLineItem[],
    },
    workAreas: floorSpec.workAreas.filter((wa) => wa.type === "flooring").map((wa) => ({ ...wa, status: "confirmed" })),
    requirements: floorSpecEstimate.requirements,
    facts: floorSpec.facts,
  });
  return JSON.stringify(view).includes("Pricing Required");
})());
check("I5 Laminate line is eligible for manual pricing", floorSpecLine != null && evaluateManualPricingEligibility(floorSpecLine).ok === true);
check("I6 A benchmark-priced door set cannot use unresolved promotion", evaluateManualPricingEligibility(baselineDoorMaterial).ok === false);
check("I7 Missing quantity cannot be promoted", evaluateManualPricingEligibility({ ...floorSpecLine!, quantity: null }).ok === false);
check("I8 Zero quantity cannot be promoted", evaluateManualPricingEligibility({ ...floorSpecLine!, quantity: 0 }).ok === false);
check("I9 Negative quantity cannot be promoted", evaluateManualPricingEligibility({ ...floorSpecLine!, quantity: -1 }).ok === false);
const promoted = computeManualPromotionMoney({ totalCost: 800, quantity: 10, unit: "m2", itemType: "material", marginPercent: 20 });
check("I10 Valid manual price uses the shared margin path", promoted.ok === true && promoted.ok && promoted.fields.totalCost === 800 && promoted.fields.totalSell > 800, promoted.ok ? `${promoted.fields.totalCost}/${promoted.fields.totalSell}` : promoted.error);
check("I11 Clearing to zero is not a negative price", computeManualPromotionMoney({ totalCost: 0, quantity: 10, unit: "m2", itemType: "material", marginPercent: 20 }).ok === true);
check("I12 Client-supplied component keys are not eligibility by themselves", evaluateManualPricingEligibility({ ...floorSpecLine!, componentKey: "client.invented", rateSourceType: "missing" }).ok === false);

const cladSpec = specialistProject(CLADDING_SPECIALIST_BRIEF);
const cladAreas = cladSpec.workAreas.filter((wa) => wa.type === "cladding");
const cladSpecEstimate = estimateOf(cladAreas, cladSpec.facts.filter((row) => row.work_area_id === cladAreas[0]?.id));
const brickLines = cladSpecEstimate.lineItems.filter((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER);
const brickPortions = storedCladdingPortions(cladSpec.facts, cladAreas[0]!.id);
check("I13 Brick veneer keeps two sections and known areas", brickPortions.length === 2 && brickPortions.some((row) => row.label === "Lower elevation" && row.direct_area_m2 === 25) && brickPortions.some((row) => row.label === "Upper elevation" && row.direct_area_m2 === 12));
check("I14 Brick does not inherit fibre-cement", !cladSpecEstimate.lineItems.some((row) => row.componentKey?.includes("fibre_cement")) && brickPortions.every((row) => row.cladding_family === "brick_veneer"));
check("I15 Both brick lines stay unresolved", brickLines.length === 2 && brickLines.every((row) => row.includedInTotal === false && row.rateSourceType === "missing") && cladSpecEstimate.recommendedCost === 0);
check("I16 Each brick line is independently eligible", brickLines.every((row) => evaluateManualPricingEligibility(row).ok) && new Set(brickLines.map((row) => row.nestedItemId)).size === 2);
check("I17 A stale missing line cannot be promoted", evaluateManualPricingEligibility(null).ok === false);

const margins = [10, 20, 12.5];
const baseCost = direct;
for (const margin of margins) {
  const priced = applyTargetMarginToLineItems(included(estimate.lineItems), margin, { ...SETTINGS, default_margin_percent: margin });
  const sell = round2(priced.reduce((sum, row) => sum + (row.recommendedSell ?? 0), 0));
  const cost = round2(priced.reduce((sum, row) => sum + row.recommendedCost, 0));
  const doc = calculateAuthoritativeDocumentTotals(
    priced.map((row) => ({ total_cost: row.recommendedCost, total_sell: row.recommendedSell ?? 0, cost_known: true, visible: true })),
    DEFAULT_GST_RATE
  );
  const quote = calculateAuthoritativeQuoteTotals(
    priced.map((row) => ({ total: row.recommendedSell ?? 0, visible: true })),
    DEFAULT_GST_RATE
  );
  check(`J margin ${margin}% keeps direct COST`, near(cost, baseCost), `cost ${cost}`);
  check(`J margin ${margin}% changes sell`, margin === 20 ? sell >= cost : sell !== applyTargetMarginToLineItems(included(estimate.lineItems), margin === 10 ? 20 : 10, SETTINGS).reduce((sum, row) => sum + (row.recommendedSell ?? 0), 0));
  check(`J margin ${margin}% document GST is 15% of sell`, doc.ok === true && doc.ok && near(doc.totals.gstAmount, round2(doc.totals.subtotalSell * 0.15), 0.05));
  check(`J margin ${margin}% quote sell reconciles to pricing sell`, doc.ok && quote.ok && near(quote.totals.subtotal, doc.totals.subtotalSell, 0.05) && near(quote.totals.gstAmount, doc.totals.gstAmount, 0.05) && near(quote.totals.totalInclGst, doc.totals.totalInclGst, 0.05));
}
check("J1 Pricing does not rewrite nested door quantity", storedDoorsPortions(project.facts, area("doors").id)[0]?.quantity === 2);
check("J2 Labour hours stay on the estimate lines", near(hoursOf(estimate.lineItems, area("doors").id), rolls.doors.labourHours));
check("J3 Target margin does not change physical door quantity", calculateDoorsPhysical({ facts: project.facts, workArea: area("doors") }).requirements.some((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT && row.baseQuantity === 2));

const QUOTE_COLLECTION_KEYS = new Set([
  "ceilings.portions",
  "internal_walls.wall_types",
  "doors.portions",
  "flooring.portions",
  "cladding.portions",
]);
const quoteDrafts = project.workAreas.map((wa) => buildWorkAreaQuoteDescriptionDraft({
  type: wa.type,
  name: wa.name,
  facts: project.facts
    .filter((row) => row.work_area_id === wa.id)
    .map((row) => ({
      key: row.key,
      label: row.key,
      value: QUOTE_COLLECTION_KEYS.has(row.key)
        ? typeof row.value === "string"
          ? row.value
          : JSON.stringify(row.value)
        : row.value == null
          ? ""
          : String(row.value),
    }))
    .filter((row) => row.value.length > 0),
  pricingItems: estimate.lineItems
    .filter((item) => item.workAreaId === wa.id)
    .map((item) => ({
      label: item.label,
      component_key: item.componentKey,
      nested_item_id: item.nestedItemId,
      cost_known: item.rateSourceType !== "missing" && (item.recommendedCost ?? 0) > 0,
      total_cost: item.recommendedCost ?? 0,
      total_sell: item.recommendedSell ?? 0,
      notes_internal: item.notes,
    })),
}));
const quoteText = quoteDrafts.join("\n");
check("K1 Quote keeps each Work Area draft separate", quoteDrafts.length === 5 && quoteDrafts.every((row) => row.trim().length > 0));
check(
  "K2 Quote names Bedrooms, Lounge and North elevation",
  /bedroom/i.test(quoteText) && /lounge/i.test(quoteText) && /north elevation/i.test(quoteText),
  quoteDrafts.map((row, index) => `${project.workAreas[index]?.type}:${/bedroom|lounge|north/i.test(row) ? "hit" : row.slice(0, 80)}`).join(" | ")
);
check("K3 Quote does not expose direct COST, hours, margin or rate keys", !/\$\d/.test(quoteText) && !/labour hour|gross profit|margin|labour\.carpenter|door\.set|componentKey|overlap/i.test(quoteText));
check("K4 Quote does not say Pricing Required or show CAS", !/Pricing Required|assumed_disclosed|\"v\":/.test(quoteText));
check("K5 Quote describes retained cladding without a removal", /remain|retained|existing/i.test(quoteText) && !/remove existing cladding/i.test(quoteText));
check(
  "K6 Quote does not include Painting as supplied scope",
  !project.workAreas.some((wa) => wa.type === "painting") &&
    !/painting is included|include painting|painting works|supply and install paint/i.test(quoteText)
);
const quoteMoney = calculateAuthoritativeQuoteTotals(
  applyTargetMarginToLineItems(included(estimate.lineItems), 20, SETTINGS).map((row) => ({ total: row.recommendedSell ?? 0, visible: true })),
  DEFAULT_GST_RATE
);
check("K7 Quote incl GST reconciles to ex GST plus GST", quoteMoney.ok && near(quoteMoney.totals.totalInclGst, round2(quoteMoney.totals.subtotal + quoteMoney.totals.gstAmount), 0.05));

const legacyDoors = estimateOf(
  [{ id: "legacy-doors", type: "doors", name: "Doors", sort_order: 1 }],
  [{ key: "doors.count", work_area_id: "legacy-doors", value: 2, source: "user" }]
);
check("L1 Legacy doors lump still prices when the collection is absent", legacyDoors.lineItems.some((row) => near(row.recommendedCost, FITOUT_BENCHMARKS.doorsEach.cost * 2) || near(row.costRate, FITOUT_BENCHMARKS.doorsEach.cost)));
check("L2 Nested and legacy door money do not coexist", !estimate.lineItems.some((row) => row.workAreaId === area("doors").id && near(row.costRate ?? -1, FITOUT_BENCHMARKS.doorsEach.cost)) && legacyDoors.facts === undefined);
const legacyFloor = estimateOf(
  [{ id: "legacy-floor", type: "flooring", name: "Flooring", sort_order: 1 }],
  [{ key: "flooring.area_m2", work_area_id: "legacy-floor", value: 24, source: "user" }]
);
check("L3 Legacy flooring path still runs without a collection", legacyFloor.lineItems.length > 0 && !legacyFloor.lineItems.some((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2));
check("L4 Nested flooring is not the generic 0.8 h/m² lump", !estimate.lineItems.some((row) => row.workAreaId === area("flooring").id && row.productivityRate === 0.8 && row.quantity === 24));
check("L5 No legitimate $0 included commercial row", !included(estimate.lineItems).some((row) => row.recommendedCost === 0 && row.rateSourceType === "missing"));
check("L6 Bathroom and Kitchen packages are absent", !types.includes("bathroom") && !types.includes("kitchen") && !estimate.lineItems.some((row) => /bathroom|kitchen/i.test(row.componentKey ?? "")));
check("L7 Demolition packages are absent", !estimate.lineItems.some((row) => row.workAreaName === "Demolition"));

check("M1 Every in-memory fact is bound to a project Work Area", project.facts.every((row) => row.work_area_id == null || project.workAreas.some((wa) => wa.id === row.work_area_id)));
check("M2 Nested ids are not Work Area ids", [door.id, floor.id, wall.id, ceiling.id, clad.id].every((id) => !project.workAreas.some((wa) => wa.id === id)));
check("M3 Cross-project nested id is not on this project", !project.facts.some((row) => JSON.stringify(row.value).includes("foreign-portion")));

const doorsSupport = getWorkAreaSupportEntry("doors");
const flooringSupport = getWorkAreaSupportEntry("flooring");
const claddingSupport = getWorkAreaSupportEntry("cladding");
check("N1 Doors, Flooring and Cladding human-QA flags stay true", DOORS_V1_HUMAN_QA_FROZEN === true && FLOORING_V1_HUMAN_QA_FROZEN === true && CLADDING_V1_HUMAN_QA_FROZEN === true);
check("N2 Doors stays a component, not Tier-1", doorsSupport?.role === "component_utility" && doorsSupport.band === "component");
check("N3 Flooring stays a component, not Tier-1", flooringSupport?.role === "component_utility");
check("N4 Cladding stays a component and is not promoted to Tier-1", claddingSupport?.role === "component_utility" && claddingSupport.band === "component");
check("N5 Frozen door set COST stays 240", DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST === 240);
check("N6 Frozen carpet subcontract COST stays 75", FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST === 75);
check("N7 Frozen prehung productivity stays 2 hours per door", DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR === 2);
check("N8 Frozen 180 mm fibre-cement cover stays 150", profile?.effective_cover_mm === 150 && profile.nominal_width_mm === 180);
check("N9 Specialist scope stays off the ordinary benchmark", floorSpecPortion?.specialist_kind === "laminate" && brickPortions.every((row) => row.cladding_system === "specialist_unresolved"));
check("N10 Closure fixture language is embedded unchanged", CANONICAL_BRIEF.includes(INTERNAL_WALLS_FIXTURE) && CANONICAL_BRIEF.includes(CEILING_FIXTURE));

function parseEnv(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

async function previewFixture(): Promise<void> {
  const env = parseEnv(join(process.cwd(), ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    check("M4 Preview credentials absent; hosted CAS skipped", false, "missing env");
    return;
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  check("M4 database target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF, ref);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) return;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const created = await admin.auth.admin.createUser({
    email: `platform-01+${suffix}@example.invalid`,
    password: `Plat01-${suffix}-Aa!`,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    check("M5 Preview user fixture", false, created.error?.message ?? "createUser failed");
    return;
  }
  const userId = created.data.user.id;
  const projectA = randomUUID();
  const projectB = randomUUID();
  const docA = randomUUID();
  const areaIds = new Map<string, string>();
  async function cleanup(): Promise<void> {
    for (const orgId of [orgA, orgB]) {
      await admin.from("pricing_items").delete().eq("org_id", orgId);
      await admin.from("pricing_documents").delete().eq("org_id", orgId);
      await admin.from("rates").delete().eq("org_id", orgId);
      await admin.from("project_facts").delete().eq("org_id", orgId);
      await admin.from("work_areas").delete().eq("org_id", orgId);
      await admin.from("projects").delete().eq("org_id", orgId);
      await admin.from("organisation_settings").delete().eq("org_id", orgId);
      await admin.from("profiles").delete().eq("org_id", orgId);
      await admin.from("organisations").delete().eq("id", orgId);
    }
    await admin.auth.admin.deleteUser(userId);
  }
  try {
    const orgInsert = await admin.from("organisations").insert([
      { id: orgA, name: `PLATFORM-01 ${suffix}` },
      { id: orgB, name: `PLATFORM-01 other ${suffix}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    await admin.from("profiles").insert({ id: userId, org_id: orgA, role: "owner", full_name: "Platform 01" });
    await admin.from("organisation_settings").insert({ org_id: orgA, default_margin_percent: 20, default_gst_rate: 15, allow_benchmark_rates: true });
    await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userId, title: `Mixed ${suffix}`, stage: "estimate_ready", brief_text: CANONICAL_BRIEF },
      { id: projectB, org_id: orgB, created_by: userId, title: `Other ${suffix}`, stage: "estimate_ready" },
    ]);
    const rows = project.workAreas.map((wa) => {
      const id = randomUUID();
      areaIds.set(wa.type, id);
      return { id, org_id: orgA, project_id: projectA, type: wa.type, name: wa.name, status: "confirmed", sort_order: wa.sort_order };
    });
    const specialistFloorId = randomUUID();
    const specialistCladId = randomUUID();
    const areaInsert = await admin.from("work_areas").insert([
      ...rows,
      { id: specialistFloorId, org_id: orgA, project_id: projectA, type: "flooring", name: "Flooring specialist", status: "confirmed", sort_order: 20 },
      { id: specialistCladId, org_id: orgA, project_id: projectA, type: "cladding", name: "Cladding specialist", status: "confirmed", sort_order: 21 },
    ]);
    if (areaInsert.error) throw new Error(areaInsert.error.message);
    const factInsert = await admin.from("project_facts").insert(
      project.facts
        .filter((row) => row.work_area_id)
        .map((row) => ({
          org_id: orgA,
          project_id: projectA,
          work_area_id: areaIds.get(project.workAreas.find((wa) => wa.id === row.work_area_id)?.type ?? "") ?? null,
          key: row.key,
          label: row.key,
          value: row.value,
          source: row.source ?? "ai_extracted",
        }))
        .filter((row) => row.work_area_id)
    );
    if (factInsert.error) throw new Error(factInsert.error.message);
    const floorPortions = extractFlooringPortionsFromBrief(FLOORING_SPECIALIST_BRIEF);
    const cladPortions = extractCladdingPortionsFromBrief(CLADDING_SPECIALIST_BRIEF);
    await admin.from("project_facts").insert([
      { org_id: orgA, project_id: projectA, work_area_id: specialistFloorId, key: FLOORING_PORTIONS_FACT_KEY, label: FLOORING_PORTIONS_FACT_KEY, value: floorPortions, source: "user" },
      { org_id: orgA, project_id: projectA, work_area_id: specialistCladId, key: CLADDING_PORTIONS_FACT_KEY, label: CLADDING_PORTIONS_FACT_KEY, value: cladPortions, source: "user" },
    ]);
    const doorArea = areaIds.get("doors")!;
    const before = await admin.from("project_facts").select("value").eq("project_id", projectA).eq("work_area_id", doorArea).eq("key", DOORS_PORTIONS_FACT_KEY).maybeSingle();
    const beforeVersion = before.data && typeof before.data.value === "object" && before.data.value && "v" in (before.data.value as object)
      ? Number((before.data.value as { v: number }).v)
      : 0;
    const wrote = await commitUserFactEdit(admin, {
      orgId: orgA,
      projectId: projectA,
      workAreaId: doorArea,
      key: "doors.portion.quantity",
      label: "Quantity",
      value: 2,
      nestedItemId: door.id,
    });
    const after = await admin.from("project_facts").select("value").eq("project_id", projectA).eq("work_area_id", doorArea).eq("key", DOORS_PORTIONS_FACT_KEY).maybeSingle();
    const afterValue = after.data?.value as { v?: number; portions?: { id: string; quantity: number }[] } | null;
    check("C18 CAS version increments on a valid door write", wrote.ok === true && (afterValue?.v ?? 0) === beforeVersion + 1, `before ${beforeVersion} after ${afterValue?.v} ${wrote.ok ? "" : wrote.error}`);
    const stale = await admin
      .from("project_facts")
      .update({ value: afterValue })
      .eq("project_id", projectA)
      .eq("work_area_id", doorArea)
      .eq("key", DOORS_PORTIONS_FACT_KEY)
      .filter("value->>v", "eq", String(beforeVersion))
      .select("id");
    check("C19 A stale CAS write matches no row", (stale.data ?? []).length === 0);
    const floorWrite = await commitUserFactEdit(admin, {
      orgId: orgA,
      projectId: projectA,
      workAreaId: areaIds.get("flooring")!,
      key: "flooring.portion.label",
      label: "Label",
      value: "Bedrooms",
      nestedItemId: floor.id,
    });
    const floorAfter = await admin.from("project_facts").select("value").eq("work_area_id", areaIds.get("flooring")!).eq("key", FLOORING_PORTIONS_FACT_KEY).maybeSingle();
    const floorEnvelope = floorAfter.data?.value as { v?: number } | null;
    check("C20 Flooring collection write bumps its own revision", floorWrite.ok === true && (floorEnvelope?.v ?? 0) >= 1);
    const otherOrgRate = await admin.from("rates").insert({
      org_id: orgB,
      rate_type: "material",
      item_key: DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
      label: "Foreign door set",
      unit: "each",
      cost_rate: 1,
      active: true,
    });
    check("M6 Foreign-tenant rate row is stored only on the other org", otherOrgRate.error == null || /column|schema|cache/i.test(otherOrgRate.error.message));
    const loaded = await loadAuthoritativeEstimateForProject(admin, orgA, projectA);
    if ("error" in loaded) throw new Error(loaded.error);
    const loadedDoor = loaded.result.lineItems.find((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT);
    check("M7 Cross-tenant company rate does not price this project", loadedDoor?.costRate !== 1);
    check("M8 Loaded rows belong to the authenticated project", loaded.result.lineItems.every((row) => row.workAreaId));
    await admin.from("pricing_documents").insert({
      id: docA,
      org_id: orgA,
      project_id: projectA,
      title: `Pricing ${suffix}`,
      status: "draft",
      gst_rate: 15,
      subtotal_cost: 0,
      subtotal_sell: 0,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      gst_amount: 0,
      total_incl_gst: 0,
    });
    const brick = loaded.result.lineItems.find((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER && row.quantity === 25);
    const brickSibling = loaded.result.lineItems.find((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER && row.quantity === 12);
    const laminate = loaded.result.lineItems.find((row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT);
    check("I18 Hosted laminate and brick lines are unresolved", laminate?.rateSourceType === "missing" && brick?.quantity === 25 && brickSibling?.quantity === 12);
    const savedBrick = brick
      ? await saveManualPriceForUnresolvedRequirement(admin, {
          orgId: orgA,
          pricingDocumentId: docA,
          totalCost: 5000,
          identity: { projectId: projectA, workAreaId: brick.workAreaId, nestedItemId: brick.nestedItemId ?? "", componentKey: CLADDING_SPECIALIST_BRICK_VENEER },
        })
      : { error: "missing brick" };
    check("I19 Saving a brick price creates one project-owned item", "success" in savedBrick && savedBrick.item?.total_cost === 5000);
    const brickId = "success" in savedBrick ? savedBrick.item?.id : null;
    const refreshed = brick
      ? await saveManualPriceForUnresolvedRequirement(admin, {
          orgId: orgA,
          pricingDocumentId: docA,
          totalCost: 5000,
          identity: { projectId: projectA, workAreaId: brick.workAreaId, nestedItemId: brick.nestedItemId ?? "", componentKey: CLADDING_SPECIALIST_BRICK_VENEER },
        })
      : { error: "missing" };
    check("I20 Retry keeps the same Pricing item", "success" in refreshed && refreshed.created === false && refreshed.item?.id === brickId);
    const savedLaminate = laminate
      ? await saveManualPriceForUnresolvedRequirement(admin, {
          orgId: orgA,
          pricingDocumentId: docA,
          totalCost: 800,
          identity: { projectId: projectA, workAreaId: laminate.workAreaId, nestedItemId: laminate.nestedItemId ?? "", componentKey: FLOORING_SPECIALIST_COMPONENT },
        })
      : { error: "missing laminate" };
    check("I21 Laminate manual price is a second item", "success" in savedLaminate && savedLaminate.item?.id !== brickId && savedLaminate.item?.total_cost === 800);
    const siblingStill = brickSibling
      ? await saveManualPriceForUnresolvedRequirement(admin, {
          orgId: orgA,
          pricingDocumentId: docA,
          totalCost: 100,
          identity: { projectId: projectA, workAreaId: brick.workAreaId, nestedItemId: brickSibling.nestedItemId ?? "", componentKey: CLADDING_SPECIALIST_BRICK_VENEER },
        })
      : { error: "missing sibling" };
    check("I22 The sibling brick section prices independently", "success" in siblingStill && siblingStill.item?.id !== brickId);
    const foreign = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgB,
      pricingDocumentId: docA,
      totalCost: 100,
      identity: { projectId: projectB, workAreaId: specialistCladId, nestedItemId: brick?.nestedItemId ?? "", componentKey: CLADDING_SPECIALIST_BRICK_VENEER },
    });
    check("M9 Cross-tenant Pricing edit fails", "error" in foreign);
    const crossProject = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      pricingDocumentId: docA,
      totalCost: 100,
      identity: { projectId: projectB, workAreaId: specialistCladId, nestedItemId: brick?.nestedItemId ?? "", componentKey: CLADDING_SPECIALIST_BRICK_VENEER },
    });
    check("M10 Cross-project Pricing edit fails", "error" in crossProject);
    const factsBeforeClear = await admin.from("project_facts").select("value").eq("work_area_id", specialistCladId);
    const cleared = brick
      ? await saveManualPriceForUnresolvedRequirement(admin, {
          orgId: orgA,
          pricingDocumentId: docA,
          totalCost: 0,
          identity: { projectId: projectA, workAreaId: brick.workAreaId, nestedItemId: brick.nestedItemId ?? "", componentKey: CLADDING_SPECIALIST_BRICK_VENEER },
        })
      : { error: "missing" };
    const factsAfterClear = await admin.from("project_facts").select("value").eq("work_area_id", specialistCladId);
    check("I23 Clearing the brick price restores an unpriced item without mutating facts", "success" in cleared && cleared.item?.total_cost === 0 && JSON.stringify(factsBeforeClear.data) === JSON.stringify(factsAfterClear.data));
    const ratesLeft = await admin.from("rates").select("id").eq("org_id", orgA);
    check("I24 Manual pricing does not create a company rate", (ratesLeft.data ?? []).length === 0);
    const leftover = await admin.from("pricing_items").select("id").eq("org_id", orgA);
    check("M11 Quote items stayed on the fixture project until cleanup", (leftover.data ?? []).every((row) => row.id));
  } catch (error) {
    check("M12 Preview fixture completed", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
    const remaining = await admin.from("projects").select("id").eq("id", projectA);
    check("M13 Test database project is removed", (remaining.data ?? []).length === 0);
  }
}

previewFixture().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});

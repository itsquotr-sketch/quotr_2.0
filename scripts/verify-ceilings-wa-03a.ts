/**
 * CEILINGS WA-03A — nested Portion foundation + shared identity/aggregation.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-03a.ts
 *
 * No physical calculator. No Details/Ready compose branch. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  ceilingPortionQuestionIdentity,
  identityFromCaptureRow,
  questionSemanticKey,
  wallTypeQuestionIdentity,
} from "../lib/assistant/question-identity";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { lookupCeilingsInformationContract } from "../lib/estimate/ceilings-information-contract";
import {
  applyCeilingFamilyExclusivity,
  applyCeilingsFactWrite,
  CEILINGS_ADD_BULKHEAD_KEY,
  CEILINGS_ADD_PORTION_KEY,
  CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
  CEILINGS_BULKHEAD_TOPOLOGY_V1,
  CEILINGS_DELETE_PORTION_KEY,
  CEILINGS_DUPLICATE_PORTION_KEY,
  ceilingPortionHasIncompatibleFraming,
  createEmptyCeilingPortion,
  duplicateCeilingPortion,
  parseCeilingsCollectionEnvelope,
  parseCeilingsPortions,
  resolveCeilingsPortions,
} from "../lib/estimate/ceilings-portions";
import { aggregateSameIdentityCommercialLines } from "../lib/estimate/commercial-aggregation";
import {
  applyExtractedInternalWallsToFacts,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  internalWallsLiningMaterialComponent,
  internalWallsLiningOverlapGroup,
} from "../lib/estimate/internal-walls-identities";
import { aggregateInternalWallsLiningCommercialLines } from "../lib/estimate/internal-walls-lining-commercial";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
} from "../lib/estimate/internal-walls-scope";
import { resolveInternalWallsWallTypes } from "../lib/estimate/internal-walls-wall-types";
import { runCountFromSpacing } from "../lib/estimate/run-count";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { createStableClientId, isStableClientId } from "../lib/ids/stable-client-id";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const PORTION_A = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const PORTION_B = "bbbbbbbb-cccc-4ddd-8eee-222222222222";
const BULKHEAD_A = "11111111-aaaa-4bbb-8ccc-aaaaaaaaaaaa";
const TYPE_A = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const OPEN_A = "11111111-aaaa-4bbb-8ccc-aaaaaaaaaaaa";

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function portionsFrom(facts: EstimateFact[]): ReturnType<typeof resolveCeilingsPortions> {
  return resolveCeilingsPortions({ facts, workAreaId: "c1" });
}

function write(
  facts: EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string | null,
  componentId?: string | null
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts,
    workAreaId: "c1",
    key,
    value,
    nestedItemId,
    componentId,
  });
}

function lineItem(
  overrides: Partial<EstimateLineItemInput> & Pick<EstimateLineItemInput, "label">
): EstimateLineItemInput {
  return {
    workAreaId: "c1",
    workAreaName: "Ceilings",
    category: "materials",
    label: overrides.label,
    recommendedCost: 10,
    recommendedSell: 12,
    grossProfit: 2,
    marginPercent: 20,
    markupPercent: 20,
    costLow: 10,
    costHigh: 10,
    sellLow: 12,
    sellHigh: 12,
    rateSource: "test",
    sortOrder: 1,
    quantity: 5,
    unit: "m2",
    itemKey: "ceilings.plasterboard.m2",
    includedInTotal: true,
    ...overrides,
  };
}

function iwCtx(facts: EstimateFact[]): EstimateContext {
  const wa: EstimateWorkArea = {
    id: "w1",
    type: "internal_walls",
    name: "Internal walls",
    sort_order: 1,
  };
  return {
    project: { id: "iw-wa-03a", qualityLevel: "standard" },
    confirmedWorkAreas: [wa],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function iwFixtureFacts(): EstimateFact[] {
  const types = extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF);
  return applyExtractedInternalWallsToFacts({
    facts: [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "mixed"),
      fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "No"),
    ],
    workAreaId: "w1",
    types,
  });
}

console.log("=== CEILINGS WA-03A foundation ===\n");

const id = createStableClientId("cp");
check("A create Ceiling Portion → stable id", isStableClientId(id, "cp"));

let facts: EstimateFact[] = [];
facts = write(facts, CEILINGS_ADD_PORTION_KEY, PORTION_A);
const created = portionsFrom(facts).portions[0]!;
check("A created portion uses requested id", created.id === PORTION_A);

facts = write(facts, "ceilings.portion.length_m", 6, PORTION_A);
facts = write(facts, "ceilings.portion.width_m", 4, PORTION_A);
const edited = portionsFrom(facts).portions[0]!;
check("B edit → id unchanged", edited.id === PORTION_A);
check(
  "G length_width portion can be represented",
  edited.geometry.mode === "length_width" &&
    edited.geometry.length_m === 6 &&
    edited.geometry.width_m === 4 &&
    near(edited.geometry.area_m2, 24)
);

facts = write(facts, CEILINGS_ADD_BULKHEAD_KEY, BULKHEAD_A, PORTION_A, BULKHEAD_A);
const withBulkhead = portionsFrom(facts).portions[0]!;
check(
  "bulkhead created with stable id",
  withBulkhead.bulkheads.length === 1 && withBulkhead.bulkheads[0]!.id === BULKHEAD_A
);

facts = write(facts, CEILINGS_DUPLICATE_PORTION_KEY, PORTION_A, PORTION_B);
const afterDup = portionsFrom(facts);
const original = afterDup.portions.find((row) => row.id === PORTION_A)!;
const copy = afterDup.portions.find((row) => row.id === PORTION_B)!;
check("C duplicate → new portion id", Boolean(copy) && copy.id !== original.id);
check(
  "C duplicate keeps geometry",
  copy.geometry.length_m === 6 && copy.geometry.width_m === 4
);
check(
  "D duplicate recursively re-IDs bulkheads",
  copy.bulkheads.length === 1 &&
    copy.bulkheads[0]!.id !== BULKHEAD_A &&
    isStableClientId(copy.bulkheads[0]!.id, "bh") &&
    original.bulkheads[0]!.id === BULKHEAD_A
);

const beforeDeleteCount = afterDup.portions.length;
facts = write(facts, CEILINGS_DELETE_PORTION_KEY, PORTION_B);
const afterDelete = portionsFrom(facts);
check(
  "E delete affects only selected portion",
  afterDelete.portions.length === beforeDeleteCount - 1 &&
    afterDelete.portions.every((row) => row.id !== PORTION_B) &&
    afterDelete.portions.some((row) => row.id === PORTION_A)
);

let areaFacts: EstimateFact[] = [];
areaFacts = write(areaFacts, CEILINGS_ADD_PORTION_KEY, PORTION_A);
areaFacts = write(areaFacts, "ceilings.portion.structure_family", "existing_framing", PORTION_A);
areaFacts = write(areaFacts, "ceilings.portion.lining_family", "plasterboard", PORTION_A);
areaFacts = write(areaFacts, "ceilings.portion.area_m2", 32, PORTION_A);
const areaOnly = portionsFrom(areaFacts).portions[0]!;
check(
  "F area-only portion can be represented",
  areaOnly.geometry.mode === "area_only" &&
    areaOnly.geometry.area_m2 === 32 &&
    areaOnly.geometry.length_m == null
);

const tile = createEmptyCeilingPortion({ id: PORTION_A });
tile.structure.family = "tile_and_grid";
tile.structure.timber = {
  size: "140x45_h1.2",
  spacing_mm: 600,
  direction: "along_length",
};
tile.lining.family = "plasterboard";
check(
  "H incompatible tile+timber is detected before sanitise",
  ceilingPortionHasIncompatibleFraming(tile)
);
applyCeilingFamilyExclusivity(tile);
check(
  "H tile_and_grid cannot carry incompatible framing after sanitise",
  !ceilingPortionHasIncompatibleFraming(tile) &&
    tile.structure.timber == null &&
    tile.structure.family === "tile_and_grid" &&
    tile.lining.family === "tile_and_grid"
);

const parsedTile = parseCeilingsPortions([
  {
    id: PORTION_A,
    structure: {
      family: "tile_and_grid",
      timber: { size: "140x45_h1.2", spacing_mm: 600, direction: "along_length" },
    },
    lining: { family: "tile_and_grid", tile: { size: "600x600" } },
  },
])[0]!;
check(
  "H parse rejects plasterboard-style framing on tile_and_grid",
  parsedTile.structure.timber == null &&
    parsedTile.lining.tile?.size === "600x600"
);

const ceilIdentity = ceilingPortionQuestionIdentity({
  workAreaId: "c1",
  factKey: "ceilings.portion.length_m",
  nestedItemId: PORTION_A,
});
const ceilBulk = ceilingPortionQuestionIdentity({
  workAreaId: "c1",
  factKey: "ceilings.bulkhead.length_m",
  nestedItemId: PORTION_A,
  componentId: BULKHEAD_A,
});
check(
  "I nestedItemId/componentId semantic identity works",
  (questionSemanticKey(ceilIdentity) ?? "").includes(PORTION_A) &&
    (questionSemanticKey(ceilBulk) ?? "").includes(PORTION_A) &&
    (questionSemanticKey(ceilBulk) ?? "").includes(BULKHEAD_A) &&
    questionSemanticKey(ceilIdentity) !== questionSemanticKey(ceilBulk)
);

const fromGeneric = identityFromCaptureRow({
  workAreaId: "c1",
  workAreaType: "ceilings",
  factKey: "ceilings.portion.length_m",
  nestedItemId: PORTION_A,
});
check(
  "I identityFromCaptureRow reads nestedItemId",
  fromGeneric.nestedItemId === PORTION_A &&
    questionSemanticKey(fromGeneric) === questionSemanticKey(ceilIdentity)
);

const wallHeight = wallTypeQuestionIdentity({
  workAreaId: "w1",
  factKey: "internal_walls.wall_type.height_m",
  wallTypeId: TYPE_A,
});
const wallOpening = wallTypeQuestionIdentity({
  workAreaId: "w1",
  factKey: "internal_walls.opening.width_m",
  wallTypeId: TYPE_A,
  openingId: OPEN_A,
});
const wallViaAlias = identityFromCaptureRow({
  workAreaId: "w1",
  workAreaType: "internal_walls",
  factKey: "internal_walls.wall_type.height_m",
  wallTypeId: TYPE_A,
  nestedItemId: TYPE_A,
});
check(
  "J existing Internal Walls wallTypeId/openingId remains unchanged",
  wallHeight.nestedItemId === TYPE_A &&
    wallOpening.componentId === OPEN_A &&
    (questionSemanticKey(wallHeight) ?? "").includes(TYPE_A) &&
    (questionSemanticKey(wallOpening) ?? "").includes(OPEN_A) &&
    questionSemanticKey(wallViaAlias) === questionSemanticKey(wallHeight)
);

const iwFacts = iwFixtureFacts();
const iwPlan = composeJobPlan({
  briefText: COORDINATION_ORIGINAL_BRIEF,
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts: iwFacts,
  constraints: [],
});
const iwClarify = composeClarifyView({
  stage: "quality",
  briefText: COORDINATION_ORIGINAL_BRIEF,
  qualityLevel: "standard",
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts: iwFacts,
  constraints: [],
  jobPlan: iwPlan,
});
const iwRefine = composeRefineView({
  briefText: COORDINATION_ORIGINAL_BRIEF,
  qualityLevel: "standard",
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts: iwFacts,
  constraints: [],
  jobPlan: {
    cards: iwPlan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      notConfirmed: card.notConfirmed,
    })),
  },
});
const iwNestedClarify = [...iwClarify.candidates, ...iwClarify.deferred].filter(
  (row) => row.wallTypeId
);
const iwNestedRefine = [...iwRefine.highValue, ...iwRefine.advanced].filter(
  (row) => row.wallTypeId
);
check(
  "J Clarify/Refine still expose wallTypeId and alias nestedItemId",
  iwNestedClarify.length > 0 &&
    iwNestedClarify.every(
      (row) => row.nestedItemId === row.wallTypeId || row.wallTypeId == null
    ) &&
    iwNestedRefine.length > 0 &&
    iwNestedRefine.every(
      (row) => row.nestedItemId === row.wallTypeId || row.wallTypeId == null
    )
);

let timberFacts: EstimateFact[] = [];
timberFacts = write(timberFacts, CEILINGS_ADD_PORTION_KEY, PORTION_A);
timberFacts = write(
  timberFacts,
  "ceilings.portion.structure_family",
  "timber_direct_fix",
  PORTION_A
);
timberFacts = write(
  timberFacts,
  "ceilings.portion.lining_family",
  "plasterboard",
  PORTION_A
);
let existingFacts: EstimateFact[] = [];
existingFacts = write(existingFacts, CEILINGS_ADD_PORTION_KEY, PORTION_B);
existingFacts = write(
  existingFacts,
  "ceilings.portion.structure_family",
  "existing_framing",
  PORTION_B
);
existingFacts = write(
  existingFacts,
  "ceilings.portion.lining_family",
  "plasterboard",
  PORTION_B
);
const timberLength = lookupCeilingsInformationContract("ceilings.portion.length_m", {
  facts: timberFacts,
  workAreaId: "c1",
  nestedItemId: PORTION_A,
});
const existingLength = lookupCeilingsInformationContract("ceilings.portion.length_m", {
  facts: existingFacts,
  workAreaId: "c1",
  nestedItemId: PORTION_B,
});
const existingArea = lookupCeilingsInformationContract("ceilings.portion.area_m2", {
  facts: existingFacts,
  workAreaId: "c1",
  nestedItemId: PORTION_B,
});
check(
  "K information-contract lookup is contextual per Portion",
  timberLength.relevant &&
    timberLength.nestedItemId === PORTION_A &&
    !existingLength.relevant &&
    existingArea.relevant
);

const timberSpacing = lookupCeilingsInformationContract("ceilings.portion.spacing_mm", {
  facts: timberFacts,
  workAreaId: "c1",
  nestedItemId: PORTION_A,
});
const existingSpacing = lookupCeilingsInformationContract("ceilings.portion.spacing_mm", {
  facts: existingFacts,
  workAreaId: "c1",
  nestedItemId: PORTION_B,
});
check(
  "L irrelevant child facts return not relevant",
  timberSpacing.relevant &&
    !existingSpacing.relevant &&
    existingSpacing.reason.includes("Not relevant")
);

let suspendedFacts: EstimateFact[] = [];
suspendedFacts = write(suspendedFacts, CEILINGS_ADD_PORTION_KEY, PORTION_A);
suspendedFacts = write(
  suspendedFacts,
  "ceilings.portion.structure_family",
  "suspended_steel",
  PORTION_A
);
const dropOnSuspended = lookupCeilingsInformationContract(
  "ceilings.portion.drop_height_m",
  { facts: suspendedFacts, workAreaId: "c1", nestedItemId: PORTION_A }
);
const dropOnTimber = lookupCeilingsInformationContract(
  "ceilings.portion.drop_height_m",
  { facts: timberFacts, workAreaId: "c1", nestedItemId: PORTION_A }
);
check(
  "M suspended facts relevant only for suspended family",
  dropOnSuspended.relevant && !dropOnTimber.relevant
);

const bulkheadMissing = lookupCeilingsInformationContract("ceilings.bulkhead.length_m", {
  facts: timberFacts,
  workAreaId: "c1",
  nestedItemId: PORTION_A,
});
const bulkheadFacts = write(
  timberFacts,
  CEILINGS_ADD_BULKHEAD_KEY,
  BULKHEAD_A,
  PORTION_A,
  BULKHEAD_A
);
const bulkheadPresent = lookupCeilingsInformationContract("ceilings.bulkhead.length_m", {
  facts: bulkheadFacts,
  workAreaId: "c1",
  nestedItemId: PORTION_A,
  componentId: BULKHEAD_A,
});
check(
  "N bulkhead child facts relevant only when bulkhead exists",
  !bulkheadMissing.relevant && bulkheadPresent.relevant
);

const eligibleA = lineItem({
  label: "Standard GIB",
  quantity: 10,
  recommendedCost: 100,
  recommendedSell: 120,
  overlapGroup: "ceilings.lining:p1",
  scopeKey: "ceilings.plasterboard.standard",
  itemKey: "ceilings.plasterboard.m2",
});
const eligibleB = lineItem({
  label: "Standard GIB",
  quantity: 7,
  recommendedCost: 70,
  recommendedSell: 84,
  overlapGroup: "ceilings.lining:p2",
  scopeKey: "ceilings.plasterboard.standard",
  itemKey: "ceilings.plasterboard.m2",
});
const unrelatedSameKey = lineItem({
  label: "Unrelated same key",
  quantity: 3,
  recommendedCost: 30,
  recommendedSell: 36,
  overlapGroup: "other.group",
  scopeKey: "other.scope",
  itemKey: "ceilings.plasterboard.m2",
});
const grouped = aggregateSameIdentityCommercialLines(
  [eligibleA, eligibleB, unrelatedSameKey],
  {
    isEligible: (item) =>
      (item.scopeKey ?? "") === "ceilings.plasterboard.standard",
    groupingKey: (item) => item.scopeKey ?? null,
  }
);
check(
  "O generic aggregation sums eligible same-identity quantities",
  grouped.length === 2 &&
    near(grouped[0]!.quantity, 17) &&
    near(grouped[0]!.recommendedCost, 170) &&
    near(grouped[0]!.recommendedSell, 204)
);
check(
  "P generic aggregation does NOT aggregate unrelated same-key lines",
  grouped[1]!.label === "Unrelated same key" &&
    grouped[1]!.quantity === 3
);

const liningA = lineItem({
  label: "Standard GIB — Side A lining",
  quantity: 9,
  recommendedCost: 90,
  recommendedSell: 108,
  workAreaId: "w1",
  overlapGroup: internalWallsLiningOverlapGroup(TYPE_A),
  scopeKey: "internal_walls.lining.standard_gib.material",
  componentKey: internalWallsLiningMaterialComponent("standard_gib"),
  itemKey: "gib.standard.13.2400",
});
const liningB = lineItem({
  label: "Standard GIB — Side B lining",
  quantity: 9,
  recommendedCost: 90,
  recommendedSell: 108,
  workAreaId: "w1",
  overlapGroup: internalWallsLiningOverlapGroup(TYPE_A),
  scopeKey: "internal_walls.lining.standard_gib.material",
  componentKey: internalWallsLiningMaterialComponent("standard_gib"),
  itemKey: "gib.standard.13.2400",
});
const iwAgg = aggregateInternalWallsLiningCommercialLines([liningA, liningB]);
check(
  "O Internal Walls adapter uses generic helper and SUMs both sides",
  iwAgg.length === 1 && near(iwAgg[0]!.quantity, 18)
);

const hosted = calculateEstimate(iwCtx(iwFacts));
const resolvedIw = resolveInternalWallsWallTypes({ facts: iwFacts, workAreaId: "w1" });
const type1 = resolvedIw.types[0]!;
const hostedType1Std = hosted.lineItems.filter(
  (item) =>
    item.componentKey === internalWallsLiningMaterialComponent("standard_gib") &&
    item.overlapGroup === internalWallsLiningOverlapGroup(type1.id) &&
    item.includedInTotal !== false
);
check(
  "Q Internal Walls hosted aggregation behavior/fingerprint unchanged",
  hostedType1Std.length === 1 &&
    near(hostedType1Std[0]?.quantity, 18) &&
    !near(hostedType1Std[0]?.quantity, 9)
);

const composeSrc = read("lib/assistant/clarify/compose.ts");
const refineComposeSrc = read("lib/assistant/refine/compose.ts");
check(
  "R repeated Work Area generic machinery unaffected — Ceilings compose uses contract lookup",
  composeSrc.includes("lookupCeilingsInformationContract") &&
    composeSrc.includes("listCeilingsClarifyCandidates") &&
    !refineComposeSrc.includes("CEILINGS_HARD_MINIMUM_KEYS") &&
    composeSrc.includes("withNestedIdentityAliases")
);
check(
  "R run-count helper extracted without migrating callers",
  read("lib/estimate/run-count.ts").includes("runCountFromSpacing") &&
    read("lib/estimate/internal-walls-framing.ts").includes(
      "ceil(lengthLm / spacingM - 1e-12) + 1"
    ) &&
    runCountFromSpacing(12, 0.6) === 21
);
check(
  "bulkhead topology assumption is disclosed, not silent island",
  CEILINGS_BULKHEAD_TOPOLOGY_V1 === "conventional_two_face_downstand" &&
    CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION.includes("underside") &&
    CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION.includes("one exposed vertical face")
);
check(
  "revision envelope parses { v, portions }",
  parseCeilingsCollectionEnvelope({ v: 3, portions: [{ id: PORTION_A }] }).v === 3
);
check(
  "legacy calculateCeilings remains in fitout.ts",
  read("lib/estimate/calculators/fitout.ts").includes("LEGACY CEILINGS CALCULATOR") &&
    read("lib/estimate/calculators/fitout.ts").includes("export function calculateCeilings")
);
check(
  "template legacy keys preserved",
  read("lib/scopes/templates/ceilings.ts").includes("ceilings.area_m2") &&
    read("lib/scopes/templates/ceilings.ts").includes("ceilings.structure_type")
);
check(
  "no portionId/bulkheadId on shared Question types",
  !read("lib/assistant/clarify/types.ts").includes("portionId") &&
    !read("lib/assistant/refine/types.ts").includes("portionId") &&
    read("lib/assistant/clarify/types.ts").includes("nestedItemId") &&
    read("lib/assistant/clarify/types.ts").includes("wallTypeId")
);
check(
  "CAS persist bumps ceilings.portions revision",
  read("lib/assistant/scope-persistence.ts").includes("v: envelope.v + 1") &&
    read("lib/assistant/scope-persistence.ts").includes("CEILINGS_PORTIONS_FACT_KEY")
);
check(
  "IW Wall Type / Opening UUID factories remain inline",
  read("lib/estimate/internal-walls-wall-types.ts").includes("crypto.randomUUID") &&
    read("lib/estimate/internal-walls-openings.ts").includes("crypto.randomUUID") &&
    read("lib/estimate/ceilings-portions.ts").includes("createStableClientId")
);
check(
  "duplicate helper does not reuse source bulkhead ids",
  duplicateCeilingPortion(withBulkhead).bulkheads[0]!.id !==
    withBulkhead.bulkheads[0]!.id
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

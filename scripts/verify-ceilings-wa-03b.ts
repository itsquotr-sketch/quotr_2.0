/**
 * CEILINGS WA-03B — extraction, Details, Ready, ownership, calculator guard.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-03b.ts
 *
 * No physical calculator. Preview only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { isDetailsOwnedWhenUnresolved } from "../lib/assistant/question-ownership";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  canonicalCeilingStructureFamilyFromText,
  extractCeilingPortionsFromBrief,
} from "../lib/estimate/ceilings-brief";
import { lookupCeilingsInformationContract } from "../lib/estimate/ceilings-information-contract";
import {
  applyCeilingsFactWrite,
  CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED,
  CEILINGS_BULKHEAD_TOPOLOGY_V1,
  CEILINGS_NESTED_NOT_CALCULATED_MESSAGE,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  hasCanonicalCeilingsPortions,
  resolveCeilingsPortions,
} from "../lib/estimate/ceilings-portions";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import {
  classifyProposedWorkAreas,
  WORK_AREA_OWNERSHIP_CLASS,
  WORK_AREA_SCOPE_OWNERS,
} from "../lib/work-areas/ownership";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

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

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";
const WA = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  status: "confirmed" as const,
};

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const allowed = getAnalysisCapableWorkAreaTypes();

function writePortions(
  portions: ReturnType<typeof createEmptyCeilingPortion>[],
  workAreaId = "c1"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function completeExistingArea(portionId: string) {
  const portion = createEmptyCeilingPortion({ id: portionId, label: "Lounge" });
  portion.geometry.mode = "area_only";
  portion.geometry.area_m2 = 30;
  portion.structure.job_scope = "reline_existing_suitable_framing";
  portion.structure.family = "existing_framing";
  portion.lining.family = "plasterboard";
  portion.lining.plasterboard_product = "standard";
  portion.finish.insulation_included = false;
  portion.has_bulkheads = false;
  return portion;
}

function clarify(facts: EstimateFact[], workAreas = [WA], briefText = "") {
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
    briefText,
  });
  return composeClarifyView({
    stage: "quality",
    briefText,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function estimateCtx(
  facts: EstimateFact[],
  workArea: EstimateWorkArea = {
    id: "c1",
    type: "ceilings",
    name: "Ceilings",
    sort_order: 1,
  }
): EstimateContext {
  return {
    project: { id: "ceilings-wa-03b", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
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

console.log("=== CEILINGS WA-03B extraction + Details + Ready + ownership ===\n");

const MULTI =
  "Main room is 3m x 4m with existing framing and 13mm standard GIB. Hallway is 9m x 1.5m and needs new timber framing with 13mm Fyreline.";

const one = extractCeilingPortionsFromBrief(
  "Line 30m² existing ceiling with Standard GIB."
);
check(
  "A one explicit Ceiling portion extracted",
  one.length === 1 &&
    one[0]!.geometry.area_m2 === 30 &&
    one[0]!.structure.family === "existing_framing" &&
    one[0]!.lining.family === "plasterboard"
);

const multi = extractCeilingPortionsFromBrief(MULTI);
check(
  "B multiple portions extracted into one WA",
  multi.length === 2 &&
    multi[0]!.geometry.length_m === 3 &&
    multi[0]!.geometry.width_m === 4 &&
    multi[1]!.geometry.length_m === 9 &&
    multi[1]!.geometry.width_m === 1.5 &&
    multi[0]!.structure.family === "existing_framing" &&
    multi[1]!.structure.family === "timber_direct_fix" &&
    multi[1]!.lining.plasterboard_product === "fyreline" &&
    !(multi[0]!.geometry.area_m2 === 25.5 && multi.length === 1)
);

const packages = discoverWorkAreaInstances(
  "Ground Floor Ceilings need new GIB. Detached Garage Ceilings need lining too."
).filter((row) => row.type === "ceilings");
check(
  "C separate logical Ceiling packages become repeated WAs",
  packages.length === 2 &&
    packages.some((row) => row.name === "Ground Floor Ceilings") &&
    packages.some((row) => row.name === "Detached Garage Ceilings")
);

const repeatedEnrich = enrichExtractionFromBrief({
  briefText:
    "Ground Floor Ceilings need new GIB. Detached Garage Ceilings need lining too.",
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "C enrich keeps two Ceiling Work Area instances",
  repeatedEnrich.extraction.workAreas.filter((row) => row.type === "ceilings")
    .length === 2
);

check(
  "D stable nested IDs after extraction",
  multi.length === 2 &&
    Boolean(multi[0]!.id) &&
    Boolean(multi[1]!.id) &&
    multi[0]!.id !== multi[1]!.id
);

const noDims = extractCeilingPortionsFromBrief(
  "Replace ceilings throughout with existing framing and standard GIB."
);
check(
  "E no dimensions invented",
  noDims.every(
    (row) =>
      row.geometry.length_m == null &&
      row.geometry.width_m == null &&
      row.geometry.area_m2 == null
  )
);

check(
  "F structure normalisation works",
  canonicalCeilingStructureFamilyFromText("existing framing") ===
    "existing_framing" &&
    canonicalCeilingStructureFamilyFromText("new timber framing") ===
      "timber_direct_fix" &&
    canonicalCeilingStructureFamilyFromText("rondo battens") ===
      "steel_direct_fix" &&
    canonicalCeilingStructureFamilyFromText("drop ceiling") ===
      "suspended_steel" &&
    canonicalCeilingStructureFamilyFromText("T-bar ceiling tiles") ===
      "tile_and_grid"
);

check(
  "G ambiguous structure stays unresolved",
  canonicalCeilingStructureFamilyFromText("steel ceiling") == null
);

const extraWas = [
  { id: "p1", type: "painting", name: "Painting", status: "confirmed" as const },
  { id: "pl1", type: "plastering", name: "Plastering", status: "confirmed" as const },
];
const existingFacts = writePortions([completeExistingArea(P1)]);
const existingView = clarify(existingFacts, [WA, ...extraWas]);
check(
  "H area-only existing framing can become Ready",
  existingView.enoughToEstimate &&
    existingView.remainingRequiredCount === 0 &&
    !existingView.blocksEstimate
);

const timberArea = completeExistingArea(P1);
timberArea.structure.family = "timber_direct_fix";
timberArea.structure.job_scope = "new_ceiling";
timberArea.geometry.area_m2 = 30;
timberArea.geometry.length_m = null;
timberArea.geometry.width_m = null;
const timberAreaView = clarify(writePortions([timberArea]), [WA, ...extraWas]);
check(
  "I area-only timber framing cannot become Ready",
  !timberAreaView.enoughToEstimate &&
    timberAreaView.candidates.some((row) => row.factKey === "ceilings.portion.length_m")
);

const steelArea = completeExistingArea(P1);
steelArea.structure.family = "steel_direct_fix";
steelArea.structure.job_scope = "new_ceiling";
const steelAreaView = clarify(writePortions([steelArea]), [WA, ...extraWas]);
check(
  "J area-only steel cannot become Ready",
  !steelAreaView.enoughToEstimate
);

const suspendedArea = completeExistingArea(P1);
suspendedArea.structure.family = "suspended_steel";
suspendedArea.structure.job_scope = "new_ceiling";
const suspendedAreaView = clarify(writePortions([suspendedArea]), [WA, ...extraWas]);
check(
  "K area-only suspended cannot become Ready",
  !suspendedAreaView.enoughToEstimate
);

const timberLined = completeExistingArea(P1);
timberLined.structure.family = "existing_framing";
timberLined.lining.family = "timber_lined";
timberLined.lining.plasterboard_product = undefined;
const timberLinedView = clarify(writePortions([timberLined]), [WA, ...extraWas]);
check(
  "L timber-lined area-only cannot become Ready",
  !timberLinedView.enoughToEstimate &&
    timberLinedView.candidates.some((row) => row.factKey === "ceilings.portion.length_m")
);

const suspendedDrop = completeExistingArea(P1);
suspendedDrop.structure.family = "suspended_steel";
suspendedDrop.structure.job_scope = "new_ceiling";
suspendedDrop.geometry.mode = "length_width";
suspendedDrop.geometry.length_m = 4;
suspendedDrop.geometry.width_m = 3;
suspendedDrop.geometry.area_m2 = 12;
const suspendedDropView = clarify(writePortions([suspendedDrop]), [WA, ...extraWas]);
check(
  "M suspended missing drop height blocks Ready",
  !suspendedDropView.enoughToEstimate &&
    suspendedDropView.candidates.some((row) => row.factKey === "ceilings.portion.drop_height_m")
);

const steelDirect = completeExistingArea(P1);
steelDirect.structure.family = "steel_direct_fix";
steelDirect.structure.job_scope = "new_ceiling";
steelDirect.geometry.length_m = 4;
steelDirect.geometry.width_m = 3;
const steelView = clarify(writePortions([steelDirect]), [WA, ...extraWas]);
check(
  "N irrelevant suspended questions hidden for direct steel",
  !steelView.candidates.some((row) => row.factKey === "ceilings.portion.drop_height_m") &&
    !steelView.candidates.some(
      (row) => row.factKey === "ceilings.portion.suspension_spacing_m"
    ) &&
    steelView.candidates.some((row) => row.factKey === "ceilings.portion.primary_spacing_mm")
);

const tile = completeExistingArea(P1);
tile.structure.family = "tile_and_grid";
tile.lining.family = "tile_and_grid";
tile.lining.plasterboard_product = undefined;
const tileView = clarify(writePortions([tile]), [WA, ...extraWas]);
check(
  "O Tile & Grid suppresses incompatible framing questions",
  !tileView.candidates.some((row) => row.factKey === "ceilings.portion.spacing_mm") &&
    !tileView.candidates.some((row) => row.factKey === "ceilings.portion.timber_size") &&
    !tileView.candidates.some((row) => row.factKey === "ceilings.portion.drop_height_m") &&
    !tileView.candidates.some((row) => row.factKey === "ceilings.portion.primary_spacing_mm") &&
    tileView.candidates.some((row) => row.factKey === "ceilings.portion.tile_size")
);

const noBh = completeExistingArea(P1);
noBh.has_bulkheads = false;
const noBhView = clarify(writePortions([noBh]), [WA, ...extraWas]);
check(
  "P bulkhead No suppresses children",
  !noBhView.candidates.some((row) => row.factKey?.startsWith("ceilings.bulkhead."))
);

const yesBh = completeExistingArea(P1);
yesBh.has_bulkheads = true;
const yesBhView = clarify(writePortions([yesBh]), [WA, ...extraWas]);
check(
  "Q bulkhead Yes requires dimensions/framing/lining",
  yesBhView.candidates.some((row) => row.factKey === "ceilings.bulkhead.length_m") &&
    yesBhView.candidates.some((row) => row.factKey === "ceilings.bulkhead.depth_m") &&
    yesBhView.candidates.some((row) => row.factKey === "ceilings.bulkhead.height_m") &&
    yesBhView.candidates.some((row) => row.factKey === "ceilings.bulkhead.framing_type") &&
    yesBhView.candidates.some((row) => row.factKey === "ceilings.bulkhead.lining_type")
);

const complex = extractCeilingPortionsFromBrief(
  "Replace ceilings and add an island bulkhead in the lounge."
);
check(
  "R complex bulkhead not silently converted to two-face",
  complex.some((row) =>
    row.bulkheads.some(
      (bh) =>
        bh.form === "island" &&
        bh.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED &&
        bh.topology !== CEILINGS_BULKHEAD_TOPOLOGY_V1
    )
  )
);

const incompleteSecond = completeExistingArea(P1);
const timberTwo = createEmptyCeilingPortion({ id: P2, label: "Hall" });
timberTwo.structure.family = "timber_direct_fix";
timberTwo.structure.job_scope = "new_ceiling";
timberTwo.lining.family = "plasterboard";
timberTwo.lining.plasterboard_product = "fyreline";
timberTwo.geometry.length_m = 9;
timberTwo.finish.insulation_included = false;
timberTwo.has_bulkheads = false;
const blockedView = clarify(writePortions([incompleteSecond, timberTwo]), [
  WA,
  ...extraWas,
]);
check(
  "S one incomplete Portion blocks overall Ready",
  !blockedView.enoughToEstimate &&
    blockedView.candidates.some(
      (row) =>
        row.nestedItemId === P2 && row.factKey === "ceilings.portion.width_m"
    )
);

check(
  "T Painting WA suppresses duplicate Ceiling painting ownership",
  !existingView.candidates.some(
    (row) => row.factKey === "ceilings.portion.painting_included"
  )
);
check(
  "U Plastering WA suppresses duplicate stopping ownership",
  !existingView.candidates.some(
    (row) => row.factKey === "ceilings.portion.stopping_included"
  )
);

const bathroomEmbedded = enrichExtractionFromBrief({
  briefText: "Renovate the bathroom including the ceiling lining.",
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "V Bathroom embedded ceiling does not produce duplicate standalone Ceiling scope",
  bathroomEmbedded.extraction.workAreas.some((row) => row.type === "bathroom") &&
    !bathroomEmbedded.extraction.workAreas.some((row) => row.type === "ceilings")
);

const both = enrichExtractionFromBrief({
  briefText:
    "Renovate bathroom, plus replace ceilings through lounge, hallway and bedrooms.",
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "W explicit independent Ceilings scope can coexist with Bathroom",
  both.extraction.workAreas.some((row) => row.type === "bathroom") &&
    both.extraction.workAreas.some((row) => row.type === "ceilings")
);

const paintOnly = enrichExtractionFromBrief({
  briefText: "Paint the ceiling in the lounge.",
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "X paint ceiling alone does not create Ceilings WA",
  !paintOnly.extraction.workAreas.some((row) => row.type === "ceilings")
);

const stopOnly = enrichExtractionFromBrief({
  briefText: "Stop the ceiling after the GIB is up.",
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "Y stop ceiling alone does not create Ceilings WA",
  !stopOnly.extraction.workAreas.some((row) => row.type === "ceilings")
);

const unresolved = writePortions([createEmptyCeilingPortion({ id: P1 })]);
const plan = composeJobPlan({
  workAreas: [WA],
  facts: unresolved,
  qualityLevel: "standard",
});
const refine = composeRefineView({
  briefText: MULTI,
  qualityLevel: "standard",
  workAreas: [WA],
  facts: unresolved,
  constraints: [],
  jobPlan: {
    cards: plan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      notConfirmed: card.notConfirmed,
    })),
  },
});
const clarifyUnresolved = clarify(unresolved);
check(
  "Z Refine does not first-own unresolved Details Ceiling facts",
  isDetailsOwnedWhenUnresolved("ceilings", "ceilings.portion.job_scope") &&
    clarifyUnresolved.candidates.some(
      (row) => row.factKey === "ceilings.portion.job_scope"
    ) &&
    ![...refine.highValue, ...refine.advanced].some(
      (row) => row.factKey === "ceilings.portion.job_scope"
    )
);

const legacyFacts: EstimateFact[] = [
  { key: "ceilings.area_m2", work_area_id: "c1", value: 30 },
  { key: "ceilings.structure_type", work_area_id: "c1", value: "Existing structure" },
  { key: "ceilings.ceiling_type", work_area_id: "c1", value: "Plasterboard" },
];
const legacyResolved = resolveCeilingsPortions({
  facts: legacyFacts,
  workAreaId: "c1",
});
const legacyEstimate = calculateEstimate(estimateCtx(legacyFacts));
check(
  "AA legacy Ceiling project continues to load safely",
  legacyResolved.source === "legacy_dual_read" &&
    !hasCanonicalCeilingsPortions(legacyFacts, "c1") &&
    legacyEstimate.lineItems.length > 0 &&
    !legacyEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    )
);

const nestedEstimate = calculateEstimate(estimateCtx(existingFacts));
check(
  "AB nested new Ceiling cannot silently use legacy flat calculator",
  hasCanonicalCeilingsPortions(existingFacts, "c1") &&
    nestedEstimate.lineItems.length === 0 &&
    nestedEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    !nestedEstimate.assumptions.some((row) => row.toLowerCase().includes("20"))
);

const gFacts = writePortions(
  [completeExistingArea("aaaaaaaa-bbbb-4ccc-8ddd-aaaaaaaaaaaa")],
  "c-ground"
);
const garage = completeExistingArea("bbbbbbbb-cccc-4ddd-8eee-bbbbbbbbbbbb");
garage.geometry.area_m2 = 12;
const garageFacts = writePortions([garage], "c-garage");
const combined = [...gFacts, ...garageFacts];
const ground = resolveCeilingsPortions({ facts: combined, workAreaId: "c-ground" });
const detached = resolveCeilingsPortions({ facts: combined, workAreaId: "c-garage" });
check(
  "AC repeated Ceiling Work Area fact binding remains instance-safe",
  ground.portions[0]?.geometry.area_m2 === 30 &&
    detached.portions[0]?.geometry.area_m2 === 12 &&
    ground.portions[0]?.id !== detached.portions[0]?.id
);

const extracted = enrichExtractionFromBrief({
  briefText: MULTI,
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "multi-portion enrich stays one Ceilings WA",
  extracted.extraction.workAreas.filter((row) => row.type === "ceilings").length === 1
);

const jobPlan = composeJobPlan({
  workAreas: [WA],
  facts: writePortions(multi.map((row, index) => ({ ...row, id: index === 0 ? P1 : P2 }))),
  qualityLevel: "standard",
});
check(
  "Job Plan summarises portions without calculator quantities",
  jobPlan.cards[0]!.summary.includes("2 portion") &&
    jobPlan.cards[0]!.included.some((row) => row.label.toLowerCase().includes("fyreline")) &&
    !jobPlan.cards[0]!.included.some((row) => /lm\b|sheets?|droppers/i.test(row.label))
);

check(
  "WORK_AREA_SCOPE_OWNERS includes ceilings and bathroom ceiling lining",
  "ceilings" in WORK_AREA_SCOPE_OWNERS &&
    WORK_AREA_SCOPE_OWNERS.bathroom.includes("bathroom_ceiling_lining")
);

const paintClass = classifyProposedWorkAreas({
  briefText: "Paint the ceiling.",
  types: ["ceilings", "painting"],
});
check(
  "paint ceiling classifies Ceilings as not requested",
  paintClass.find((row) => row.type === "ceilings")?.classification ===
    WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED
);

const dropOnSteel = lookupCeilingsInformationContract("ceilings.portion.drop_height_m", {
  facts: writePortions([steelDirect]),
  workAreaId: "c1",
  nestedItemId: P1,
});
check("contract hides drop height on steel", !dropOnSteel.relevant);

check(
  "generic nestedItemPanels plumbing exists",
  read("lib/assistant/clarify/types.ts").includes("nestedItemPanels") &&
    read("components/assistant/clarify/ClarifyPanel.tsx").includes("NestedItemsPanel") &&
    !read("lib/assistant/clarify/types.ts").includes("ceilingPortionPanels") &&
    read("lib/assistant/clarify/compose.ts").includes("lookupCeilingsInformationContract")
);

check(
  "legacy template keys preserved",
  read("lib/scopes/templates/ceilings.ts").includes("ceilings.area_m2") &&
    read("lib/scopes/templates/ceilings.ts").includes("ceilings.structure_type")
);

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} CEILINGS WA-03B checks passed.`);

/**
 * PLATFORM-01-R1 — mixed-project presentation cleanup.
 *
 * Run: npx --yes tsx scripts/verify-platform-01-r1-presentation.ts
 *
 * Uses the hosted mixed brief and the real job-plan, readiness, assumption,
 * estimate, and quote composition paths. Presentation copy only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { coerceExtractionPayload, type AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { assumptionsFromPersistedFacts } from "../lib/assistant/clarify/assumptions";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { CEILINGS_JOB_PLAN_NESTED_ACTIONS } from "../lib/assistant/job-plan/adapters/ceilings";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  doorsSpecificationCountLabel,
  isBareKnownSummaryLine,
  presentCalculatorAssumptionLine,
} from "../lib/assistant/presentation/mixed-project-summaries";
import { getUserFacingEstimateAssumptions } from "../lib/assistant/presentation/user-facing-estimate-assumptions";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  CEILINGS_ADD_PORTION_KEY,
  CEILINGS_DELETE_PORTION_KEY,
  CEILINGS_DUPLICATE_PORTION_KEY,
} from "../lib/estimate/ceilings-portions";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { DOORS_PORTIONS_FACT_KEY, storedDoorsPortions } from "../lib/estimate/doors-portions";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { round2 } from "../lib/estimate/facts";
import { INTERNAL_WALLS_WALL_TYPES_FACT_KEY } from "../lib/estimate/internal-walls-wall-types";
import type { EstimateContext, EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { deriveFactsForProject, mergeDerivedFactsIntoRecords } from "../lib/scopes/derived-facts";
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import { applyScopeCrossoverResolution } from "../lib/scopes/scope-crossover";
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

const CANONICAL_BRIEF = [
  "Supply and install 2 × 1980 × 810 mm hollow-core prehung internal door sets to the bedrooms with standard latch/lever hardware included. No door removal.",
  "Supply and install 24 m² of carpet flooring to the bedrooms with new underlay. Existing substrate retained. Existing framing retained. No flooring removal. No substrate removal.",
  "Construct a 4m long, 2.7m high internal wall using 90x45 timber framing with 13mm Standard GIB on both sides. No openings.",
  "Lounge ceiling is 4m x 3m with existing framing and 13mm Standard GIB.",
  "Supply and install 20 m² of 180 mm horizontal fibre-cement weatherboard cladding to the North elevation. The areas already exclude openings. Existing drained cavity is to remain. Existing flexible wall underlay is to remain. Existing trims are to remain. No cladding removal is required. Painting and scaffolding are excluded.",
].join(" ");

const QUOTR_DIRECT_COST = {
  doors: 890,
  flooring: 2160,
  internal_walls: 1111.45,
  ceilings: 262.5,
  cladding: 3506.67,
  total: 7930.62,
} as const;

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
  return { workAreas, facts };
}

function confirmed(workAreas: EstimateWorkArea[]) {
  return workAreas.map((wa) => ({ ...wa, status: "confirmed" as const }));
}

function planOf(workAreas: EstimateWorkArea[], facts: EstimateFact[]) {
  return composeJobPlan({
    workAreas: confirmed(workAreas),
    facts,
    briefText: CANONICAL_BRIEF,
    qualityLevel: "standard",
  });
}

function estimateOf(workAreas: EstimateWorkArea[], facts: EstimateFact[]) {
  const context: EstimateContext = {
    project: { id: "platform-01-r1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
    materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
    rates: [],
    briefText: CANONICAL_BRIEF,
  };
  return calculateEstimate(context);
}

function included(items: readonly EstimateLineItemInput[]) {
  return items.filter((row) => row.includedInTotal !== false);
}

function workAreaCost(items: readonly EstimateLineItemInput[], workAreaId: string) {
  return round2(
    included(items)
      .filter((row) => row.workAreaId === workAreaId)
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}

function fingerprint(items: readonly EstimateLineItemInput[]) {
  return included(items).map((row) => ({
    workAreaId: row.workAreaId,
    componentKey: row.componentKey,
    category: row.category,
    quantity: row.quantity,
    labourHours: row.labourHours ?? null,
    costRate: row.costRate ?? null,
    rateSourceType: row.rateSourceType ?? null,
    recommendedCost: row.recommendedCost ?? null,
    recommendedSell: row.recommendedSell ?? null,
  }));
}

function quoteTextOf(workAreas: EstimateWorkArea[], facts: EstimateFact[], items: readonly EstimateLineItemInput[]) {
  const collectionKeys = new Set([
    "ceilings.portions",
    "internal_walls.wall_types",
    "doors.portions",
    "flooring.portions",
    "cladding.portions",
  ]);
  return workAreas
    .map((wa) =>
      buildWorkAreaQuoteDescriptionDraft({
        type: wa.type,
        name: wa.name,
        facts: facts
          .filter((row) => row.work_area_id === wa.id)
          .map((row) => ({
            key: row.key,
            label: row.key,
            value: collectionKeys.has(row.key)
              ? typeof row.value === "string"
                ? row.value
                : JSON.stringify(row.value)
              : row.value == null
                ? ""
                : String(row.value),
          }))
          .filter((row) => row.value.length > 0),
        pricingItems: items
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
      })
    )
    .join("\n");
}

function replaceFactValue(
  facts: EstimateFact[],
  key: string,
  mutate: (value: unknown) => unknown
): EstimateFact[] {
  return facts.map((fact) =>
    fact.key === key ? { ...fact, value: mutate(structuredClone(fact.value)) } : fact
  );
}

const project = hostedProject(CANONICAL_BRIEF);
const areas = confirmed(project.workAreas);
const plan = planOf(project.workAreas, project.facts);
const doors = plan.cards.find((card) => card.workAreaType === "doors");
const walls = plan.cards.find((card) => card.workAreaType === "internal_walls");
const ceilings = plan.cards.find((card) => card.workAreaType === "ceilings");
const doorsId = project.workAreas.find((wa) => wa.type === "doors")!.id;
const wallsId = project.workAreas.find((wa) => wa.type === "internal_walls")!.id;
const ceilingsId = project.workAreas.find((wa) => wa.type === "ceilings")!.id;

const twoDoorFacts = replaceFactValue(project.facts, DOORS_PORTIONS_FACT_KEY, (value) => {
  const portions = Array.isArray(value) ? value : [];
  const first = portions[0] as { id?: string; label?: string };
  return [...portions, { ...first, id: "second-door-specification", label: "Hall" }];
});
const twoDoorPlan = planOf(project.workAreas, twoDoorFacts);
const twoDoors = twoDoorPlan.cards.find((card) => card.workAreaType === "doors");

const selectedFacts = replaceFactValue(project.facts, INTERNAL_WALLS_WALL_TYPES_FACT_KEY, (value) => {
  const record = value as { types?: Record<string, unknown>[] } | Record<string, unknown>[];
  const types = Array.isArray(record) ? record : record.types ?? [];
  if (types[0]) {
    types[0].insulation_included = true;
    types[0].skirting = "both";
  }
  return record;
});
const selectedPlan = planOf(project.workAreas, selectedFacts);
const selectedWalls = selectedPlan.cards.find((card) => card.workAreaType === "internal_walls");

const multiFacts = replaceFactValue(project.facts, INTERNAL_WALLS_WALL_TYPES_FACT_KEY, (value) => {
  const record = value as { types?: Record<string, unknown>[] } | Record<string, unknown>[];
  const types = Array.isArray(record) ? record : record.types ?? [];
  const first = types[0];
  if (first) {
    types.push({ ...structuredClone(first), id: "second-partition", label: "Hall", length_lm: 6, height_m: 2.4 });
  }
  return record;
});
const multiPlan = planOf(project.workAreas, multiFacts);
const multiWalls = multiPlan.cards.find((card) => card.workAreaType === "internal_walls");

const clarify = composeClarifyView({
  stage: "work_area_questions",
  briefText: CANONICAL_BRIEF,
  qualityLevel: "standard",
  workAreas: areas,
  facts: project.facts,
  constraints: [],
  jobPlan: plan,
});
const readiness = composeEstimateReadiness({
  clarify,
  jobPlan: plan,
  qualityLevel: "standard",
  constraints: [],
});
const clarifyAgain = composeClarifyView({
  stage: "work_area_questions",
  briefText: CANONICAL_BRIEF,
  qualityLevel: "standard",
  workAreas: areas,
  facts: project.facts,
  constraints: [],
  jobPlan: plan,
});
const readinessAgain = composeEstimateReadiness({
  clarify: clarifyAgain,
  jobPlan: plan,
  qualityLevel: "standard",
  constraints: [],
});

const estimate = estimateOf(project.workAreas, project.facts);
const estimateAgain = estimateOf(project.workAreas, project.facts);
const quote = quoteTextOf(project.workAreas, project.facts, estimate.lineItems);
const quoteAgain = quoteTextOf(project.workAreas, project.facts, estimateAgain.lineItems);
const priced = included(estimate.lineItems);
const document = calculateAuthoritativeDocumentTotals(
  priced.map((row) => ({
    total_cost: row.recommendedCost ?? 0,
    total_sell: row.recommendedSell ?? 0,
    cost_known: true,
    visible: true,
  })),
  DEFAULT_GST_RATE
);
const review = composeBuilderReview({
  estimate: {
    recommendedCost: estimate.recommendedCost,
    recommendedSell: estimate.recommendedSell,
    marginPercent: estimate.marginPercent,
    confidence: estimate.confidence,
    assumptions: estimate.assumptions,
    missingInfo: estimate.missingInfo,
    lineItems: estimate.lineItems.map((item, index) => ({ ...item, id: `line-${index}` })),
  },
  workAreas: areas,
  requirements: estimate.requirements,
  facts: project.facts,
  briefText: CANONICAL_BRIEF,
});

const doorScope = doors?.included.map((row) => row.label).join("\n") ?? "";
const known = readiness.known;
const wallKnown = walls?.specChips.map((chip) => `${chip.label}: ${chip.value}`).join("\n") ?? "";
const wallScope = walls?.included.map((row) => row.label).join("\n") ?? "";
const selectedKnown = selectedWalls?.specChips.map((chip) => chip.value).join("\n") ?? "";
const selectedScope = selectedWalls?.included.map((row) => row.label).join("\n") ?? "";
const presentationText = [doors?.summary, wallKnown, wallScope, ceilings?.specChips.map((chip) => chip.value).join("\n")]
  .filter(Boolean)
  .join("\n");

check("A1 One nested portion with quantity 2 is 1 door specification", doors?.summary.includes("1 door specification") === true && storedDoorsPortions(project.facts, doorsId)[0]?.quantity === 2);
check("A2 The badge does not say door set", !/door sets?\b/.test(doors?.summary ?? ""));
check("A3 Two nested portions are 2 door specifications", twoDoors?.summary.includes("2 door specifications") === true && twoDoors?.included.length === 2);
check("A4 Specification count is not the physical quantity", doorsSpecificationCountLabel(1) === "1 door specification" && doorsSpecificationCountLabel(2) === "2 door specifications");
check("B1 Scope names Bedrooms", /Bedrooms/.test(doorScope));
check("B2 Scope keeps the physical quantity and size", /2 × 1980 × 810 mm/.test(doorScope));
check("B3 Scope says hollow-core prehung internal doors", /hollow-core prehung internal doors/.test(doorScope));
check("B4 Scope keeps the hardware sentence", /Standard latch\/lever hardware included/.test(doorScope));
check("B5 Each of two specifications still shows its physical quantity", (twoDoors?.included ?? []).every((row) => /2 × 1980 × 810 mm/.test(row.label)));
check("C1 Hosted Known lines contain no standalone 1", known.length > 0 && known.every((line) => line.trim() !== "1" && !isBareKnownSummaryLine(line)));
check("C2 No job-plan chip value is a bare count", plan.cards.every((card) => card.specChips.every((chip) => chip.value.trim() !== "1")));
check("C3 A pure number is a bare Known line", isBareKnownSummaryLine("1") && isBareKnownSummaryLine("true") && isBareKnownSummaryLine("new_partition"));
check("C4 Human quantities stay visible", !isBareKnownSummaryLine("2 doors") && !isBareKnownSummaryLine("24 m² carpet"));
check("D1 Ceiling Known summary names Lounge Ceiling", ceilings?.specChips.some((chip) => chip.value.includes("Lounge Ceiling")) === true);
check("D2 Ceiling Known summary shows 12 m²", ceilings?.specChips.some((chip) => chip.value.includes("12 m²")) === true);
check("D3 Ceiling Known summary shows existing framing", ceilings?.specChips.some((chip) => chip.value.includes("existing framing")) === true);
check("D4 Ceiling Known summary shows Standard plasterboard", ceilings?.specChips.some((chip) => chip.value.includes("Standard plasterboard")) === true);
check("D5 The ceiling portion itself is still present", known.some((line) => line.includes("Lounge Ceiling")) && project.facts.some((fact) => fact.key === "ceilings.portions" && fact.work_area_id === ceilingsId));
check(
  "E1 Internal Walls known sentence is the hosted partition wording",
  wallKnown.includes("Internal Walls: 1 new timber-framed partition, including plasterboard lining.")
);
check(
  "E2 Estimate scope is one primary partition line",
  wallScope.includes("1 new partition · 4 m × 2.7 m · 90 × 45 mm timber framing · 13 mm Standard GIB to both sides") &&
    walls?.included.length === 1
);
check("E3 Framing and lining are not competing top-level scope lines", !/^90/.test(wallScope) && !wallScope.split("\n").some((line) => line === "Plasterboard lining"));
check("F1 Selected insulation and skirting are mentioned", /insulation/.test(selectedKnown) && /skirting/.test(selectedKnown));
check("F2 Canonical extraction does not invent insulation", !/insulation/.test(wallKnown) && !/insulation/.test(wallScope));
check("F3 Canonical extraction does not invent skirting", !/skirting/.test(wallKnown) && !/skirting/.test(wallScope));
check("F4 Selected extras can sit on the same scope line", /insulation/.test(selectedScope) && /skirting/.test(selectedScope));
check(
  "G1 Extracted job scope is not described as an assumption",
  !getUserFacingEstimateAssumptions({ assumptions: estimate.assumptions, facts: project.facts }).some((line) =>
    /New internal partition assumed|Internal walls job scope/i.test(line)
  )
);
check(
  "G2 The calculator still records the job-scope line",
  estimate.assumptions.some((line) => /^Internal walls job scope:/i.test(line))
);
check(
  "G3 An assumed job scope uses the human assumption sentence",
  presentCalculatorAssumptionLine("Internal walls job scope: new partition.", [
    { key: "internal_walls.job_scope", source: "assumption", value: "new_partition" },
  ]) === "New internal partition assumed."
);
check(
  "G4 Explicit extraction hides that calculator line",
  presentCalculatorAssumptionLine("Internal walls job scope: new partition.", project.facts) == null
);
check(
  "G5 Persisted assumed job scope uses the same sentence",
  assumptionsFromPersistedFacts([
    {
      key: "internal_walls.job_scope",
      work_area_id: wallsId,
      value: "new_partition",
      source: "assumption",
    },
  ]).some((row) => row.statement === "New internal partition assumed.")
);
check("H1 Two wall types stay two summaries", (multiWalls?.specChips.length ?? 0) === 2 && (multiWalls?.included.length ?? 0) === 2);
check(
  "H2 Each wall type keeps its own size",
  multiWalls?.included.some((row) => row.label.includes("4 m × 2.7 m")) === true &&
    multiWalls?.included.some((row) => row.label.includes("6 m × 2.4 m")) === true &&
    multiWalls?.included.every((row) => !(row.label.includes("4 m × 2.7 m") && row.label.includes("6 m × 2.4 m")))
);
check(
  "H3 Multiple types are partitions, not Wall Type labels",
  multiWalls?.specChips.map((chip) => chip.label).join("|") === "Partition 1|Partition 2" &&
    multiWalls?.specChips.every((chip) => !/Wall Type/.test(chip.value))
);
check("I1 Touched copy says prehung", /prehung/.test(doorScope) && !/pre-hung/.test(presentationText));
check("I2 Timber size is 90 × 45 mm", wallScope.includes("90 × 45 mm") && !/90x45/.test(wallScope));
check("I3 Geometry uses spaced unit crosses", wallScope.includes("4 m × 2.7 m") && !/4m x 2\.7m/.test(wallScope));
check("I4 Lining reads 13 mm Standard GIB", wallScope.includes("13 mm Standard GIB"));
check("I5 Quote keeps fibre-cement", /fibre-cement/i.test(quote));
check("I6 Known heading uses Internal Walls", wallKnown.startsWith("Internal Walls:"));
check("J1 Estimate line count is stable", estimate.lineItems.length === estimateAgain.lineItems.length && estimate.lineItems.length > 0);
check("J2 Physical and material quantities are stable", JSON.stringify(fingerprint(estimate.lineItems).map((row) => [row.componentKey, row.quantity])) === JSON.stringify(fingerprint(estimateAgain.lineItems).map((row) => [row.componentKey, row.quantity])));
check("J3 Labour hours are stable", JSON.stringify(fingerprint(estimate.lineItems).map((row) => row.labourHours)) === JSON.stringify(fingerprint(estimateAgain.lineItems).map((row) => row.labourHours)));
check("J4 Rate identity and provenance are stable", JSON.stringify(fingerprint(estimate.lineItems).map((row) => [row.componentKey, row.rateSourceType, row.costRate])) === JSON.stringify(fingerprint(estimateAgain.lineItems).map((row) => [row.componentKey, row.rateSourceType, row.costRate])));
check("J5 Direct COST is unchanged to the cent", round2(estimate.recommendedCost) === round2(estimateAgain.recommendedCost) && round2(priced.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)) === QUOTR_DIRECT_COST.total, `cost ${estimate.recommendedCost}`);
check("J6 Doors direct COST stays 890.00", workAreaCost(estimate.lineItems, doorsId) === QUOTR_DIRECT_COST.doors, `doors ${workAreaCost(estimate.lineItems, doorsId)}`);
check("J7 Flooring direct COST stays 2160.00", workAreaCost(estimate.lineItems, project.workAreas.find((wa) => wa.type === "flooring")!.id) === QUOTR_DIRECT_COST.flooring);
check("J8 Internal Walls direct COST stays 1111.45", workAreaCost(estimate.lineItems, wallsId) === QUOTR_DIRECT_COST.internal_walls, `walls ${workAreaCost(estimate.lineItems, wallsId)}`);
check("J9 Ceilings direct COST stays 262.50", workAreaCost(estimate.lineItems, ceilingsId) === QUOTR_DIRECT_COST.ceilings, `ceilings ${workAreaCost(estimate.lineItems, ceilingsId)}`);
check("J10 Cladding direct COST stays 3506.67", workAreaCost(estimate.lineItems, project.workAreas.find((wa) => wa.type === "cladding")!.id) === QUOTR_DIRECT_COST.cladding, `cladding ${workAreaCost(estimate.lineItems, project.workAreas.find((wa) => wa.type === "cladding")!.id)}`);
check("J11 Sell ex GST is stable to the cent", round2(estimate.recommendedSell ?? 0) === round2(estimateAgain.recommendedSell ?? 0) && (estimate.recommendedSell ?? 0) > 0);
check("J12 GST and sell incl GST are stable", document.ok === true && document.ok && round2(document.totals.gstAmount) > 0 && round2(document.totals.totalInclGst) === round2(document.totals.subtotalSell + document.totals.gstAmount));
check("J13 Work Area totals are stable", project.workAreas.every((wa) => workAreaCost(estimate.lineItems, wa.id) === workAreaCost(estimateAgain.lineItems, wa.id)));
check("K1 Readiness flags are stable", readiness.blocksEstimate === readinessAgain.blocksEstimate && readiness.enoughToEstimate === readinessAgain.enoughToEstimate && readiness.canEstimateNow === readinessAgain.canEstimateNow);
check("K2 Readiness questions are stable", clarify.candidates.map((row) => row.questionKey).join("|") === clarifyAgain.candidates.map((row) => row.questionKey).join("|"));
check("K3 Readiness copy does not expose a raw nested count", !readiness.known.some((line) => line.trim() === "1"));
check("L1 Quote text is stable", quote === quoteAgain && quote.length > 0);
check("L2 Quote still says prehung internal door sets", /prehung internal door sets/.test(quote));
check("L3 Quote does not adopt the specification badge", !/door specification/.test(quote));
check("L4 Builder Review still prices the same direct COST", review.costReconciles === true && round2(review.projectedCost) === round2(estimate.recommendedCost));
check("M1 Doors, Flooring and Cladding stay frozen", DOORS_V1_HUMAN_QA_FROZEN === true && FLOORING_V1_HUMAN_QA_FROZEN === true && CLADDING_V1_HUMAN_QA_FROZEN === true);
check("M2 Details stay one card per Work Area", plan.cards.length === 5 && new Set(plan.cards.map((card) => card.workAreaType)).size === 5);
check("M3 Ceiling Add, Duplicate and Delete stay available", CEILINGS_JOB_PLAN_NESTED_ACTIONS.addKey === CEILINGS_ADD_PORTION_KEY && CEILINGS_JOB_PLAN_NESTED_ACTIONS.duplicateKey === CEILINGS_DUPLICATE_PORTION_KEY && CEILINGS_JOB_PLAN_NESTED_ACTIONS.deleteKey === CEILINGS_DELETE_PORTION_KEY);
check("M4 The hosted project does not create Painting, Bathroom, Kitchen, Demolition, Roofing or Windows", !plan.cards.some((card) => ["painting", "bathroom", "kitchen", "demolition", "roofing", "windows"].includes(card.workAreaType)));
check(
  "M5 Presentation helpers do not call the calculator",
  !readFileSync(join(process.cwd(), "lib/assistant/presentation/mixed-project-summaries.ts"), "utf8").includes("calculateEstimate")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

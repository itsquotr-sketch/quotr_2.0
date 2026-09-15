/**
 * CEILINGS WA-08-R7 / RATES-CEILINGS-01B — hosted stale bulkhead runtime.
 *
 * Reproduces the R5 persisted specialist topology that was later locked by
 * an unrelated Details save (Plastering/Painting Included). Exercises the
 * hosted extraction, fact merge, nested Details write, estimate, and
 * Builder Review path. Preview only.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-08-r7-hosted-stale-bulkhead.ts
 */
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationSettings } from "../components/setup/types";
import { buildBriefExtractionFromModelText } from "../lib/ai/brief-extraction-result";
import { aiFactsToRows } from "../lib/ai/mappers";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import * as ceilingsBrief from "../lib/estimate/ceilings-brief";
import {
  extractCeilingPortionsFromBrief,
  mergeCeilingPortionsPreferringExplicitAi,
  readAiCeilingPortionsFromExtraction,
} from "../lib/estimate/ceilings-brief";
import {
  calculateCeilingBulkhead,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-bulkheads";
import {
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-fixings";
import {
  CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR,
  CEILINGS_BULKHEAD_LINING_LABOUR,
  CEILINGS_PAINTING_COMPONENT,
  CEILINGS_PAINTING_MATERIAL_KEY,
  CEILINGS_STOPPING_COMPONENT,
  CEILINGS_STOPPING_MATERIAL_KEY,
} from "../lib/estimate/ceilings-identities";
import { CEILINGS_PLASTERBOARD_COMPONENT } from "../lib/estimate/ceilings-lining";
import {
  applyCeilingBulkheadTopologyState,
  applyCeilingsFactWrite,
  CEILINGS_BULKHEAD_TOPOLOGY_V1,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  isUnsupportedCeilingBulkhead,
  parseCeilingsPortions,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { nestedCeilingsQuoteIsBlocked } from "../lib/estimate/ceilings-quote-readiness";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
} from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";

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

function near(
  actual: number | null | undefined,
  expected: number,
  tol = 0.02
): boolean {
  return (
    actual != null &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= tol
  );
}

const HUMAN_QA_BRIEF =
  "Line the existing ceiling in a 4m x 3m lounge with 13mm Standard GIB and thermal insulation. Include a 4m long, 500mm deep and 500mm high timber bulkhead.";

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 10,
  default_contingency_percent: 0,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

function write(
  facts: EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string,
  componentId?: string
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts,
    workAreaId: "c1",
    key,
    value,
    nestedItemId,
    componentId,
    ...(HUMAN_QA_BRIEF ? { briefText: HUMAN_QA_BRIEF } : {}),
  } as Parameters<typeof applyCeilingsFactWrite>[0]);
}

function writePortions(
  portions: CeilingPortion[],
  source: "ai_extracted" | "user" = "ai_extracted"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
    factSource: source,
    briefText: HUMAN_QA_BRIEF,
  } as Parameters<typeof applyCeilingsFactWrite>[0]);
}

function authorityOf(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw : undefined;
}

type ReanalyseMerge = (params: {
  extracted: unknown;
  persisted: unknown;
  briefText?: string | null;
}) => CeilingPortion[];

function mergePersistedCeilingPortionsOnReanalyse(params: {
  extracted: unknown;
  persisted: unknown;
  briefText?: string | null;
}): CeilingPortion[] {
  const imported = (
    ceilingsBrief as { mergePersistedCeilingPortionsOnReanalyse?: ReanalyseMerge }
  ).mergePersistedCeilingPortionsOnReanalyse;
  if (imported) return imported(params);
  return parseCeilingsPortions(params.persisted);
}

function material(
  requirements: readonly { kind: string; componentKey: string }[],
  key: string
): MaterialRequirement | undefined {
  return requirements.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === key
  );
}

function mapReviewLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    componentId: item.componentId,
    nestedItemId: item.nestedItemId,
    contributingNestedItemIds: item.contributingNestedItemIds,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
  }));
}

function estimateCtx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "ceilings-wa-08-r7", qualityLevel: "standard" },
    confirmedWorkAreas: [
      { id: "c1", type: "ceilings", name: "Ceilings", sort_order: 1 },
    ],
    facts,
    constraints: [],
    organisationSettings: SETTINGS,
    materialWastageSettings: WASTAGE,
    rates: [],
    briefText: HUMAN_QA_BRIEF,
  } as EstimateContext;
}

function hostedReanalyseSkipUser(
  extracted: EstimateFact[],
  persisted: EstimateFact[]
): EstimateFact[] {
  return persisted.map((existing) => {
    if (existing.source === "user") return existing;
    const incoming = extracted.find(
      (row) =>
        row.key === existing.key && row.work_area_id === existing.work_area_id
    );
    return incoming ?? existing;
  });
}

function r5StalePortion(): CeilingPortion {
  const parsed = extractCeilingPortionsFromBrief(HUMAN_QA_BRIEF)[0]!;
  const bulkhead = parsed.bulkheads[0]!;
  bulkhead.form = "complex";
  applyCeilingBulkheadTopologyState(bulkhead, { explicit: true });
  bulkhead.length_m = 4;
  bulkhead.depth_m = 0.5;
  bulkhead.height_m = 0.5;
  delete (bulkhead as { form_authority?: unknown }).form_authority;
  return parsed;
}

function r5PersistedFacts(): EstimateFact[] {
  return [
    {
      key: CEILINGS_PORTIONS_FACT_KEY,
      work_area_id: "c1",
      value: [r5StalePortion()],
      source: "ai_extracted",
    },
  ];
}

function ordinaryBulkheadComplete(
  hosted: ReturnType<typeof calculateEstimate>,
  portion: CeilingPortion
): boolean {
  const takeoff = calculateCeilingBulkhead({
    portion,
    bulkhead: portion.bulkheads[0]!,
    materialWastageSettings: WASTAGE,
  });
  const req = hosted.requirements ?? [];
  return (
    !isUnsupportedCeilingBulkhead(portion.bulkheads[0]!) &&
    portion.bulkheads[0]!.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    portion.bulkheads[0]!.topology_source === "assumed_disclosed" &&
    authorityOf(portion.bulkheads[0], "form_authority") !== "user" &&
    near(portion.bulkheads[0]!.length_m, 4) &&
    near(portion.bulkheads[0]!.depth_m, 0.5) &&
    near(portion.bulkheads[0]!.height_m, 0.5) &&
    takeoff.status !== "unsupported_specialist" &&
    near(takeoff.liningAreaM2, 4) &&
    material(req, CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT) != null &&
    material(req, CEILINGS_BULKHEAD_LINING_COMPONENT) != null &&
    material(req, CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT) != null &&
    material(req, CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT) != null &&
    req.some((row) => row.componentKey === CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR) &&
    req.some((row) => row.componentKey === CEILINGS_BULKHEAD_LINING_LABOUR)
  );
}

function finishesAre16(hosted: ReturnType<typeof calculateEstimate>): boolean {
  const stopping = material(hosted.requirements ?? [], CEILINGS_STOPPING_COMPONENT);
  const painting = material(hosted.requirements ?? [], CEILINGS_PAINTING_COMPONENT);
  return (
    stopping != null &&
    painting != null &&
    stopping.materialKey === CEILINGS_STOPPING_MATERIAL_KEY &&
    painting.materialKey === CEILINGS_PAINTING_MATERIAL_KEY &&
    near(stopping.baseQuantity, 16) &&
    near(painting.baseQuantity, 16) &&
    hosted.lineItems.some((item) => item.componentKey === CEILINGS_STOPPING_COMPONENT) &&
    hosted.lineItems.some((item) => item.componentKey === CEILINGS_PAINTING_COMPONENT) &&
    (painting.priced === false
      ? painting.unitCost == null && painting.totalCost == null
      : (painting.unitCost ?? 0) > 0)
  );
}

function reviewOf(facts: EstimateFact[], hosted: ReturnType<typeof calculateEstimate>) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: hosted.recommendedCost,
      recommendedSell: hosted.recommendedSell,
      marginPercent: hosted.marginPercent,
      confidence: hosted.confidence,
      assumptions: hosted.assumptions,
      missingInfo: hosted.missingInfo,
      lineItems: mapReviewLines(hosted.lineItems),
    },
    workAreas: [
      { id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" },
    ],
    requirements: hosted.requirements ?? [],
    facts,
    briefText: HUMAN_QA_BRIEF,
  } as Parameters<typeof composeBuilderReview>[0]);
}

console.log("=== CEILINGS WA-08-R7 hosted stale bulkhead ===\n");

const allowed = getAnalysisCapableWorkAreaTypes();
const r5AiPayload = {
  workAreas: [
    {
      type: "ceilings",
      name: "Ceilings",
      confidence: 0.92,
      rationale: "Ceiling lining and timber bulkhead mentioned in brief",
    },
  ],
  facts: [
    {
      work_area_type: "ceilings",
      work_area_name: "Ceilings",
      key: CEILINGS_PORTIONS_FACT_KEY,
      label: "Ceiling portions",
      value: [r5StalePortion()],
      confidence: 0.7,
    },
  ],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.9,
  warnings: [],
};

const freshExtract = buildBriefExtractionFromModelText({
  rawText: JSON.stringify(r5AiPayload),
  briefText: HUMAN_QA_BRIEF,
  allowedTypes: allowed,
  catalogueTypes: allowed,
});
const namedFacts = freshExtract.output.facts.filter(
  (fact) =>
    fact.key === CEILINGS_PORTIONS_FACT_KEY && fact.work_area_type === "ceilings"
);
const freshAi = readAiCeilingPortionsFromExtraction(freshExtract.output);
const freshParsed = extractCeilingPortionsFromBrief(HUMAN_QA_BRIEF);
const freshMerged = mergeCeilingPortionsPreferringExplicitAi(freshAi, freshParsed);
const freshBh = freshMerged[0]?.bulkheads[0];
check(
  "fresh hosted extract is one canonical ordinary portions fact",
  namedFacts.length === 1 &&
    freshMerged.length === 1 &&
    freshBh != null &&
    !isUnsupportedCeilingBulkhead(freshBh) &&
    freshBh.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    freshBh.topology_source === "assumed_disclosed" &&
    near(freshBh.length_m, 4) &&
    near(freshBh.depth_m, 0.5) &&
    near(freshBh.height_m, 0.5)
);

let freshFacts = writePortions(freshMerged);
const freshPortionId = freshMerged[0]!.id;
freshFacts = write(
  freshFacts,
  "ceilings.portion.stopping_included",
  "Included",
  freshPortionId
);
freshFacts = write(
  freshFacts,
  "ceilings.portion.painting_included",
  "Included",
  freshPortionId
);
const freshResolved = resolveCeilingsPortions({
  facts: freshFacts,
  workAreaId: "c1",
  briefText: HUMAN_QA_BRIEF,
} as Parameters<typeof resolveCeilingsPortions>[0]).portions[0]!;
const freshHosted = calculateEstimate(estimateCtx(freshFacts));
check(
  "1. fresh ordinary project: topology, 4m² lining, complete ordinary lines",
  ordinaryBulkheadComplete(freshHosted, freshResolved)
);
check("1. fresh ordinary project: finishes 16m²", finishesAre16(freshHosted));
check(
  "1. fresh Details Included does not promote fact source to user",
  freshFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.source !==
    "user"
);
check(
  "1. fresh Details Included does not mark topology user",
  freshResolved.bulkheads[0] != null &&
    authorityOf(freshResolved.bulkheads[0], "form_authority") !== "user" &&
    authorityOf(freshResolved.finish, "stopping_authority") === "user" &&
    authorityOf(freshResolved.finish, "painting_authority") === "user"
);

let staleFacts = r5PersistedFacts();
const staleBefore = parseCeilingsPortions(
  staleFacts[0]!.value
)[0]!.bulkheads[0]!;
check(
  "fixture starts as R5 machine specialist with correct dims",
  isUnsupportedCeilingBulkhead(staleBefore) &&
    staleBefore.form === "complex" &&
    staleBefore.topology_source === "explicit" &&
    authorityOf(staleBefore, "form_authority") !== "user" &&
    near(staleBefore.length_m, 4) &&
    near(staleBefore.depth_m, 0.5) &&
    near(staleBefore.height_m, 0.5) &&
    staleFacts[0]!.source === "ai_extracted"
);

const stalePortionId = parseCeilingsPortions(staleFacts[0]!.value)[0]!.id;
staleFacts = write(
  staleFacts,
  "ceilings.portion.stopping_included",
  "Included",
  stalePortionId
);
staleFacts = write(
  staleFacts,
  "ceilings.portion.painting_included",
  "Included",
  stalePortionId
);
const afterDetails = resolveCeilingsPortions({
  facts: staleFacts,
  workAreaId: "c1",
  briefText: HUMAN_QA_BRIEF,
} as Parameters<typeof resolveCeilingsPortions>[0]).portions[0]!;
check(
  "2. Details Included keeps stopping/painting without locking topology as user",
    afterDetails.finish.stopping_included === true &&
    afterDetails.finish.painting_included === true &&
    authorityOf(afterDetails.finish, "stopping_authority") === "user" &&
    authorityOf(afterDetails.finish, "painting_authority") === "user" &&
    authorityOf(afterDetails.bulkheads[0], "form_authority") !== "user" &&
    staleFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.source !==
      "user"
);

const extractedRows = aiFactsToRows({
  output: freshExtract.output,
  orgId: "o1",
  projectId: "p1",
  workAreaIdByType: new Map([["ceilings", "c1"]]),
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings" }],
}).map((row) => ({
  key: row.key,
  work_area_id: row.work_area_id,
  value: row.value,
  source: row.source,
}));
const skipped = hostedReanalyseSkipUser(extractedRows, staleFacts);
const skippedSource = skipped.find(
  (row) => row.key === CEILINGS_PORTIONS_FACT_KEY
)?.source;
check(
  "legacy skip-user would retain the Details-stamped blob when source is user",
  skippedSource !== "user" ||
    (() => {
      const skippedBh = parseCeilingsPortions(
        skipped.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value
      )[0]?.bulkheads[0];
      return skippedBh != null && isUnsupportedCeilingBulkhead(skippedBh);
    })()
);

const mergedReanalyse = mergePersistedCeilingPortionsOnReanalyse({
  extracted: extractedRows.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)
    ?.value,
  persisted: staleFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)
    ?.value,
  briefText: HUMAN_QA_BRIEF,
});
const mergedBh = mergedReanalyse[0]?.bulkheads[0];
check(
  "2. re-analyse merge heals R5 leftover and keeps Included finishes",
  mergedReanalyse.length === 1 &&
    mergedBh != null &&
    !isUnsupportedCeilingBulkhead(mergedBh) &&
    mergedBh.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    mergedBh.topology_source === "assumed_disclosed" &&
    authorityOf(mergedBh, "form_authority") === "assumed_disclosed" &&
    mergedReanalyse[0]!.finish.stopping_included === true &&
    mergedReanalyse[0]!.finish.painting_included === true
);

const factsBeforeEstimate = JSON.stringify(
  staleFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value
);
const staleHosted = calculateEstimate(estimateCtx(staleFacts));
check(
  "2. persisted R5 stale project restores ordinary bulkhead lines",
  ordinaryBulkheadComplete(staleHosted, afterDetails)
);
check("2. persisted R5 stale project finishes 16m²", finishesAre16(staleHosted));
check(
  "2. estimate-time heal does not mutate the fact blob",
  JSON.stringify(
    staleFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value
  ) === factsBeforeEstimate
);

let userFacts = applyCeilingsFactWrite({
  facts: [],
  workAreaId: "c1",
  key: CEILINGS_PORTIONS_FACT_KEY,
  value: extractCeilingPortionsFromBrief(HUMAN_QA_BRIEF),
  factSource: "ai_extracted",
  briefText: HUMAN_QA_BRIEF,
});
const userPortionId = parseCeilingsPortions(userFacts[0]!.value)[0]!.id;
const userBhId = parseCeilingsPortions(userFacts[0]!.value)[0]!.bulkheads[0]!.id;
userFacts = write(
  userFacts,
  "ceilings.bulkhead.form",
  "Island bulkhead",
  userPortionId,
  userBhId
);
userFacts = write(
  userFacts,
  "ceilings.portion.stopping_included",
  "Included",
  userPortionId
);
userFacts = write(
  userFacts,
  "ceilings.portion.painting_included",
  "Included",
  userPortionId
);
const userResolved = resolveCeilingsPortions({
  facts: userFacts,
  workAreaId: "c1",
  briefText: HUMAN_QA_BRIEF,
}).portions[0]!;
const userHosted = calculateEstimate(estimateCtx(userFacts));
check(
  "3. explicit user island stays specialist after Details",
  userResolved.bulkheads[0]!.form === "island" &&
    authorityOf(userResolved.bulkheads[0], "form_authority") === "user" &&
    isUnsupportedCeilingBulkhead(userResolved.bulkheads[0]!) &&
    userResolved.finish.stopping_included === true &&
    (userHosted.requirements ?? []).every(
      (row) =>
        row.componentKey !== CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT &&
        row.componentKey !== CEILINGS_BULKHEAD_LINING_COMPONENT
    ) &&
    (userHosted.requirements ?? []).some((row) =>
      /unsupported specialist bulkhead/i.test(row.description ?? "")
    )
);

const specialistBriefs = [
  "Lounge 5m x 4m with a timber floating bulkhead",
  "Lounge 5m x 4m with a steel island bulkhead",
  "Lounge 5m x 4m with a plasterboard boxed bulkhead",
  "Lounge 5m x 4m with a structural transfer bulkhead",
  "Lounge 5m x 4m with a services bulkhead",
  "Lounge 5m x 4m with a bulkhead not against a wall",
] as const;
for (const brief of specialistBriefs) {
  const portion = extractCeilingPortionsFromBrief(brief)[0]!;
  const bh = portion.bulkheads[0];
  const facts = applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: [portion],
    factSource: "ai_extracted",
    briefText: brief,
  });
  const hosted = calculateEstimate({
    ...estimateCtx(facts),
    briefText: brief,
  });
  check(
    `4. specialist brief remains unsupported: ${brief.slice(0, 48)}`,
    bh != null &&
      isUnsupportedCeilingBulkhead(bh) &&
      (hosted.requirements ?? []).some((row) =>
        /unsupported specialist bulkhead/i.test(row.description ?? "")
      ) &&
      material(hosted.requirements ?? [], CEILINGS_BULKHEAD_LINING_COMPONENT) ==
        null
  );
}

let isolateFacts = applyCeilingsFactWrite({
  facts: [],
  workAreaId: "c1",
  key: CEILINGS_PORTIONS_FACT_KEY,
  value: extractCeilingPortionsFromBrief(HUMAN_QA_BRIEF),
  factSource: "ai_extracted",
  briefText: HUMAN_QA_BRIEF,
});
const isolateId = parseCeilingsPortions(isolateFacts[0]!.value)[0]!.id;
const beforeIsolate = JSON.stringify(
  parseCeilingsPortions(isolateFacts[0]!.value)[0]!.bulkheads[0]
);
isolateFacts = write(
  isolateFacts,
  "ceilings.portion.stopping_included",
  "Included",
  isolateId
);
isolateFacts = write(
  isolateFacts,
  "ceilings.portion.painting_included",
  "Not included",
  isolateId
);
isolateFacts = write(
  isolateFacts,
  "ceilings.portion.insulation_type",
  "thermal",
  isolateId
);
isolateFacts = write(
  isolateFacts,
  "ceilings.portion.thickness_mm",
  13,
  isolateId
);
const afterIsolate = parseCeilingsPortions(
  isolateFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value
)[0]!;
check(
  "5. unrelated nested edit does not change topology, geometry or framing",
  afterIsolate.bulkheads[0]?.form ===
    JSON.parse(beforeIsolate).form &&
    afterIsolate.bulkheads[0]?.topology ===
      JSON.parse(beforeIsolate).topology &&
    near(afterIsolate.bulkheads[0]?.length_m, JSON.parse(beforeIsolate).length_m) &&
    near(afterIsolate.bulkheads[0]?.depth_m, JSON.parse(beforeIsolate).depth_m) &&
    near(afterIsolate.bulkheads[0]?.height_m, JSON.parse(beforeIsolate).height_m) &&
    afterIsolate.bulkheads[0]?.framing_type ===
      JSON.parse(beforeIsolate).framing_type &&
    afterIsolate.finish.stopping_included === true &&
    afterIsolate.finish.painting_included === false &&
    afterIsolate.lining.thickness_mm === 13 &&
    isolateFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)
      ?.source !== "user"
);

const portionA = createEmptyCeilingPortion({ id: "portion-a", label: "Lounge" });
portionA.geometry = {
  mode: "length_width",
  length_m: 4,
  width_m: 3,
  area_m2: 12,
  perimeter_m: 14,
};
const portionB = createEmptyCeilingPortion({ id: "portion-b", label: "Hall" });
portionB.geometry = {
  mode: "length_width",
  length_m: 2,
  width_m: 2,
  area_m2: 4,
  perimeter_m: 8,
};
let multiFacts = applyCeilingsFactWrite({
  facts: [],
  workAreaId: "c1",
  key: CEILINGS_PORTIONS_FACT_KEY,
  value: [portionA, portionB],
  factSource: "ai_extracted",
});
multiFacts = applyCeilingsFactWrite({
  facts: multiFacts,
  workAreaId: "c1",
  key: "ceilings.portion.stopping_included",
  value: "Included",
  nestedItemId: "portion-a",
  briefText: HUMAN_QA_BRIEF,
});
const multi = resolveCeilingsPortions({
  facts: multiFacts,
  workAreaId: "c1",
}).portions;
check(
  "6. editing Portion A does not change Portion B or duplicate portions",
  multi.length === 2 &&
    multi[0]!.id === "portion-a" &&
    multi[1]!.id === "portion-b" &&
    multi[0]!.finish.stopping_included === true &&
    multi[1]!.finish.stopping_included == null &&
    near(multi[1]!.geometry.area_m2, 4)
);

const staleReview = reviewOf(staleFacts, staleHosted);
const groups = staleReview.workAreas[0]?.portionGroups?.[0]?.lineGroups ?? [];
const bulkheadGroup = groups.find((row) => row.secondary === "Bulkhead");
const finishingGroup = groups.find((row) => row.secondary === "Finishing");
const reviewText = JSON.stringify(staleReview);
const stoppingReq = material(
  staleHosted.requirements ?? [],
  CEILINGS_STOPPING_COMPONENT
);
const paintingReq = material(
  staleHosted.requirements ?? [],
  CEILINGS_PAINTING_COMPONENT
);
const mainLining = material(
  staleHosted.requirements ?? [],
  CEILINGS_PLASTERBOARD_COMPONENT
);
check(
  "7. hosted Review: main ceiling remains priced",
  mainLining?.priced === true && (mainLining.unitCost ?? 0) > 0
);
check(
  "7. hosted Review: ordinary bulkhead prices and 4m² lining",
  Boolean(bulkheadGroup?.supporting?.includes("4m long")) &&
    Boolean(bulkheadGroup?.supporting?.includes("0.5m deep")) &&
    Boolean(bulkheadGroup?.supporting?.includes("0.5m high")) &&
    Boolean(bulkheadGroup?.supporting?.match(/4(?:\.0)?m² lining/))
);
check(
  "7. hosted Review: stopping and painting 16m², painting not $0",
  near(stoppingReq?.baseQuantity, 16) &&
    near(paintingReq?.baseQuantity, 16) &&
    finishingGroup != null &&
    (paintingReq?.priced === false
      ? paintingReq.unitCost == null && paintingReq.totalCost == null
      : (paintingReq?.unitCost ?? 0) > 0)
);
check(
  "7. hosted Review: no unsupported-bulkhead warning and no duplicate finishes",
  !/unsupported specialist bulkhead/i.test(reviewText) &&
    (staleHosted.requirements ?? []).filter(
      (row) => row.componentKey === CEILINGS_STOPPING_COMPONENT
    ).length === 1 &&
    (staleHosted.requirements ?? []).filter(
      (row) => row.componentKey === CEILINGS_PAINTING_COMPONENT
    ).length === 1 &&
    nestedCeilingsQuoteIsBlocked({
      missingInfo: staleHosted.missingInfo,
      items: staleHosted.lineItems.map((item) => ({
        componentKey: item.componentKey,
        itemKey: item.itemKey,
        notes: item.notes,
        label: item.label,
        total_cost: item.recommendedCost,
        total_sell: item.recommendedSell,
        unit_cost: item.costRate ?? null,
        rateSourceType: item.rateSourceType,
      })),
    }) === true
);

const boxedUser = extractCeilingPortionsFromBrief(
  "Lounge 5m x 4m with a plasterboard boxed bulkhead"
);
let boxedFacts = applyCeilingsFactWrite({
  facts: [],
  workAreaId: "c1",
  key: CEILINGS_PORTIONS_FACT_KEY,
  value: boxedUser,
  factSource: "ai_extracted",
});
const boxedId = boxedUser[0]!.id;
const boxedBh = boxedUser[0]!.bulkheads[0]!.id;
boxedFacts = applyCeilingsFactWrite({
  facts: boxedFacts,
  workAreaId: "c1",
  key: "ceilings.bulkhead.form",
  value: "Feature / custom bulkhead",
  nestedItemId: boxedId,
  componentId: boxedBh,
});
boxedFacts = applyCeilingsFactWrite({
  facts: boxedFacts,
  workAreaId: "c1",
  key: "ceilings.portion.painting_included",
  value: "Included",
  nestedItemId: boxedId,
  briefText: "Lounge 5m x 4m with a plasterboard boxed bulkhead",
});
const boxedResolved = resolveCeilingsPortions({
  facts: boxedFacts,
  workAreaId: "c1",
  briefText: "Lounge 5m x 4m with a plasterboard boxed bulkhead",
}).portions[0]!;
check(
  "3b. user Feature/custom on specialist brief stays specialist",
  boxedResolved.bulkheads[0]!.form === "complex" &&
    authorityOf(boxedResolved.bulkheads[0], "form_authority") === "user" &&
    isUnsupportedCeilingBulkhead(boxedResolved.bulkheads[0]!)
);

console.log(`\nWA-08-R7 hosted stale bulkhead: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

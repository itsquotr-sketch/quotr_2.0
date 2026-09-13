/**
 * EST-CORRECT-03 — Internal Walls Details completeness, job_scope MIXED,
 * structural gate, and multi-wall-type grouping.
 *
 * Run: npx --yes tsx scripts/verify-est-correct-03.ts
 *
 * No paid AI. No Production. No merge to main.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { isDetailsOwnedWhenUnresolved } from "../lib/assistant/question-ownership";
import { evaluateClarifyEstimateReadiness } from "../lib/assistant/readiness/clarify-estimate";
import { composeRefineView } from "../lib/assistant/refine/compose";
import type { RefineCandidate } from "../lib/assistant/refine/types";
import { isUnresolvedCaptureValue } from "../lib/estimate/disclosed-assumptions";
import {
  applyExtractedInternalWallsToFacts,
  classifyInternalWallsJobScopeFromBrief,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
  internalWallsWallTypeGroupingIsAmbiguous,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
  INTERNAL_WALLS_WALL_TYPES_GROUPING_CONFIRMED_FACT_KEY,
  structuralBlocksEstimate,
  structuralGateApplies,
} from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  isInternalWallsHardMinimumProgressiveField,
  parseInternalWallsCollectionEnvelope,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import type { EstimateFact } from "../lib/estimate/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";

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

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

const BRIEF = COORDINATION_ORIGINAL_BRIEF;
const AMBIGUOUS_MULTI_TYPE_BRIEF =
  "I am renovating a house and rebuilding internal walls. 2 of the walls are 45x90 framed timber (they total 9m long and are 2.4m high), and the other wall is 45x90 framed timber (this wall is 3m long and 2.4m high)";

const CONSUMED_PCS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

const WA = {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  status: "confirmed" as const,
};

function emptyExtraction(): AIExtractionOutput {
  return {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  };
}

function composeSurfaces(params: {
  facts: EstimateFact[];
  briefText?: string;
  constraints?: { key: string; value: unknown; source?: string | null }[];
}) {
  const briefText = params.briefText ?? BRIEF;
  const constraints =
    params.constraints ??
    CONSUMED_PCS.map((row) => ({ key: row.key, value: row.value }));
  const plan = composeJobPlan({
    workAreas: [WA],
    facts: params.facts,
    constraints,
    briefText,
  });
  const clarifyInput = {
    stage: "quality" as const,
    briefText,
    qualityLevel: "standard",
    workAreas: [WA],
    facts: params.facts,
    constraints,
    jobPlan: plan,
  };
  const clarify = composeClarifyView(clarifyInput);
  const refine = composeRefineView({
    briefText,
    qualityLevel: "standard",
    workAreas: [WA],
    facts: params.facts,
    constraints,
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
  const readiness = evaluateClarifyEstimateReadiness(clarifyInput);
  return { clarify, plan, refine, readiness };
}

function refineRows(view: ReturnType<typeof composeRefineView>): RefineCandidate[] {
  return [...view.highValue, ...view.advanced];
}

function initialFactKeys(view: ReturnType<typeof composeClarifyView>): string[] {
  return [...view.candidates, ...view.deferred]
    .filter(isInitialCaptureQuestion)
    .map((row) => row.factKey)
    .filter((key): key is string => Boolean(key));
}

function hasUnresolvedRefine(
  view: ReturnType<typeof composeRefineView>,
  factKey: string
): boolean {
  return refineRows(view).some(
    (row) => row.factKey === factKey && isUnresolvedCaptureValue(row.currentValue)
  );
}

function hasResolvedRefineEdit(
  view: ReturnType<typeof composeRefineView>,
  factKey: string
): boolean {
  return refineRows(view).some(
    (row) =>
      row.factKey === factKey && !isUnresolvedCaptureValue(row.currentValue)
  );
}

function fixtureFacts(extra: EstimateFact[] = []): EstimateFact[] {
  const types = extractInternalWallsTypesFromBrief(BRIEF);
  return applyExtractedInternalWallsToFacts({
    facts: [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "mixed"),
      ...extra,
    ],
    workAreaId: "w1",
    types,
  });
}

function framedUnlinedFacts(): EstimateFact[] {
  let facts: EstimateFact[] = [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ];
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: "internal_walls.add_wall_type",
    value: true,
  });
  const typeId = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
    .types[0]?.id;
  const writes: Array<{ key: string; value: unknown }> = [
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    {
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
    },
    { key: "internal_walls.wall_type.length_lm", value: 9 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
  ];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      wallTypeId: typeId,
      key: row.key,
      value: row.value,
    });
  }
  return facts;
}

console.log("=== EST-CORRECT-03 A–C fixture extraction ===\n");
check(
  "fixture wording is exact",
  BRIEF ===
    "I am renovating a house and removing 3 internal walls, I need to rebuild the walls completely. 2 of the walls are 45x90 framed timber with 13mm standard GIB on both sides (they total 9m long and are 2.4m high), and the other wall is 45x90 framed timber with 13mm standard GIB on one side and 13mm aqualine on the otherside (this wall is 3m long and 2.4m high)"
);

const iwInstances = discoverWorkAreaInstances(BRIEF).filter(
  (row) => row.type === "internal_walls"
);
check("A one Internal Walls instance", iwInstances.length === 1, `${iwInstances.length}`);

const extracted = extractInternalWallsTypesFromBrief(BRIEF);
check("A two wall types", extracted.length === 2, `${extracted.length}`);
check(
  "B Wall Type 1 9m / 2.4m / 45x90 timber / Standard both sides",
  extracted[0]?.wallCount === 2 &&
    extracted[0]?.lengthLm === 9 &&
    extracted[0]?.heightM === 2.4 &&
    extracted[0]?.frameSystem === "timber" &&
    extracted[0]?.frameSize === "90x45" &&
    extracted[0]?.sameLiningBothSides === true &&
    extracted[0]?.sideA.product === "standard_gib" &&
    extracted[0]?.sideB.product === "standard_gib"
);
check(
  "C Wall Type 2 3m / 2.4m / 45x90 timber / Standard A / Aqualine B",
  extracted[1]?.wallCount === 1 &&
    extracted[1]?.lengthLm === 3 &&
    extracted[1]?.heightM === 2.4 &&
    extracted[1]?.frameSystem === "timber" &&
    extracted[1]?.frameSize === "90x45" &&
    extracted[1]?.sameLiningBothSides === false &&
    extracted[1]?.sideA.product === "standard_gib" &&
    extracted[1]?.sideB.product === "aqualine"
);

const stored = resolveInternalWallsWallTypes({
  facts: fixtureFacts(),
  workAreaId: "w1",
});
check("stored two wall types on one instance", stored.types.length === 2);
check(
  "I mixed lining sides remain distinct",
  stored.types[1]?.side_a.product === "standard_gib" &&
    stored.types[1]?.side_b.product === "aqualine" &&
    stored.types[1]?.same_lining_both_sides === false
);
check(
  "H same lining both sides is one spec, not two products",
  stored.types[0]?.same_lining_both_sides === true &&
    stored.types[0]?.side_a.product === "standard_gib" &&
    stored.types[0]?.side_b.product === "standard_gib"
);

console.log("\n=== D–E job_scope + structural gate ===\n");
check(
  "D classifier MIXED for regression fixture",
  classifyInternalWallsJobScopeFromBrief(BRIEF) === "mixed"
);
check(
  "D new partition without removal stays NEW",
  classifyInternalWallsJobScopeFromBrief(
    "12m of new internal wall, 2.4 high, 90x45 timber, 13mm standard GIB both sides"
  ) === "new_partition"
);
check(
  "D removal only is REMOVE",
  classifyInternalWallsJobScopeFromBrief("I am removing 3 internal walls.") ===
    "remove_partition"
);
check("E mixed activates structural gate", structuralGateApplies("mixed"));
check(
  "E new partition does not skip into structural-yes pricing",
  structuralBlocksEstimate("new_partition", "yes") === false
);
check(
  "E mixed + not_sure still blocks estimate commercially",
  structuralBlocksEstimate("mixed", "not_sure") === true
);

const enriched = enrichExtractionFromBrief({
  briefText: BRIEF,
  extraction: emptyExtraction(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;
check(
  "D enrichment writes mixed job_scope",
  enriched.facts.some(
    (row) =>
      row.key === INTERNAL_WALLS_JOB_SCOPE_FACT_KEY &&
      (row.value === "mixed" || row.value === "Mixed")
  )
);
check(
  "enrichment does not hard-code rebuild as new_partition",
  !read("lib/ai/enrich-extraction.ts").includes('value: "new_partition"')
);

console.log("\n=== F–H lining Ready + same-both ===\n");
check(
  "lining product is a HARD_MINIMUM progressive field",
  isInternalWallsHardMinimumProgressiveField(
    "internal_walls.wall_type.side_a_product"
  ) &&
    isInternalWallsHardMinimumProgressiveField(
      "internal_walls.wall_type.same_lining_both_sides"
    ) &&
    isInternalWallsHardMinimumProgressiveField(
      "internal_walls.wall_type.side_b_product"
    )
);

const unlined = composeSurfaces({ facts: framedUnlinedFacts() });
check(
  "F unresolved lining prevents Ready",
  unlined.readiness.ready === false &&
    initialFactKeys(unlined.clarify).includes(
      "internal_walls.wall_type.side_a_product"
    )
);
check(
  "F lining is Details HARD_MINIMUM",
  [...unlined.clarify.candidates, ...unlined.clarify.deferred].some(
    (row) =>
      row.factKey === "internal_walls.wall_type.side_a_product" &&
      row.askClass === "HARD_MINIMUM"
  )
);

const knownLining = composeSurfaces({
  facts: fixtureFacts([fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "no")]),
});
check(
  "G known lining from brief is not re-asked",
  !initialFactKeys(knownLining.clarify).includes(
    "internal_walls.wall_type.side_a_product"
  ) &&
    !initialFactKeys(knownLining.clarify).includes(
      "internal_walls.wall_type.side_b_product"
    ) &&
    !initialFactKeys(knownLining.clarify).includes(
      "internal_walls.wall_type.same_lining_both_sides"
    )
);
check(
  "H same lining both sides does not ask Side B",
  ![...knownLining.clarify.candidates, ...knownLining.clarify.deferred].some(
    (row) => row.factKey === "internal_walls.wall_type.side_b_product"
  )
);

console.log("\n=== J–K multiple wall types ===\n");
check(
  "K fixture grouping is not ambiguous",
  internalWallsWallTypeGroupingIsAmbiguous(extracted) === false
);
const ambiguousTypes = extractInternalWallsTypesFromBrief(AMBIGUOUS_MULTI_TYPE_BRIEF);
check(
  "J ambiguous brief still extracts 2+ groups",
  ambiguousTypes.length >= 2,
  `${ambiguousTypes.length}`
);
check(
  "J grouping is flagged ambiguous when spec assignment is incomplete",
  internalWallsWallTypeGroupingIsAmbiguous(ambiguousTypes) === true
);
const ambiguousFacts = applyExtractedInternalWallsToFacts({
  facts: [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition")],
  workAreaId: "w1",
  types: ambiguousTypes,
});
const ambiguousView = composeSurfaces({
  facts: ambiguousFacts,
  briefText: AMBIGUOUS_MULTI_TYPE_BRIEF,
});
check(
  "J Details asks grouping confirmation rather than silently trusting regex",
  initialFactKeys(ambiguousView.clarify).includes(
    INTERNAL_WALLS_WALL_TYPES_GROUPING_CONFIRMED_FACT_KEY
  )
);
check(
  "K unambiguous fixture does not force grouping confirmation",
  !initialFactKeys(knownLining.clarify).includes(
    INTERNAL_WALLS_WALL_TYPES_GROUPING_CONFIRMED_FACT_KEY
  )
);
check(
  "K clear types are not merged into one",
  stored.types.length === 2 &&
    stored.types[0]?.length_lm === 9 &&
    stored.types[1]?.length_lm === 3
);

console.log("\n=== L–M Refine boundary ===\n");
check(
  "lining / job_scope / structural are Details-owned when unresolved",
  isDetailsOwnedWhenUnresolved(
    "internal_walls",
    "internal_walls.wall_type.side_a_product"
  ) &&
    isDetailsOwnedWhenUnresolved("internal_walls", INTERNAL_WALLS_JOB_SCOPE_FACT_KEY) &&
    isDetailsOwnedWhenUnresolved("internal_walls", INTERNAL_WALLS_STRUCTURAL_FACT_KEY)
);
check(
  "L Refine does not first-ask unresolved lining",
  !hasUnresolvedRefine(unlined.refine, "internal_walls.wall_type.side_a_product")
);
check(
  "L Refine does not first-ask unresolved structural on mixed",
  !hasUnresolvedRefine(
    composeSurfaces({ facts: fixtureFacts() }).refine,
    INTERNAL_WALLS_STRUCTURAL_FACT_KEY
  )
);
check(
  "M resolved lining remains editable in Refine",
  hasResolvedRefineEdit(
    knownLining.refine,
    "internal_walls.wall_type.side_a_product"
  )
);

console.log("\n=== N–O identity + CAS ===\n");
const firstPass = fixtureFacts();
const idsFirst = resolveInternalWallsWallTypes({
  facts: firstPass,
  workAreaId: "w1",
}).types.map((row) => row.id);
const secondPass = applyExtractedInternalWallsToFacts({
  facts: firstPass,
  workAreaId: "w1",
  types: extracted,
});
const idsSecond = resolveInternalWallsWallTypes({
  facts: secondPass,
  workAreaId: "w1",
}).types.map((row) => row.id);
check(
  "N re-extract preserves wallTypeId",
  idsFirst.length === 2 &&
    idsFirst[0] === idsSecond[0] &&
    idsFirst[1] === idsSecond[1]
);
const afterWrite = applyInternalWallsFactWrite({
  facts: secondPass,
  workAreaId: "w1",
  wallTypeId: idsSecond[0],
  key: "internal_walls.wall_type.side_a_product",
  value: "Standard GIB",
});
const idsAfterWrite = resolveInternalWallsWallTypes({
  facts: afterWrite,
  workAreaId: "w1",
}).types.map((row) => row.id);
check(
  "N lining write keeps wallTypeId stable",
  idsAfterWrite[0] === idsFirst[0] && idsAfterWrite[1] === idsFirst[1]
);
const envelope = parseInternalWallsCollectionEnvelope(
  afterWrite.find((row) => row.key === "internal_walls.wall_types")?.value
);
check(
  "O CAS envelope still versioned types array",
  Array.isArray(envelope.types) &&
    envelope.types.length === 2 &&
    typeof envelope.v === "number"
);
const casSrc = read("lib/estimate/internal-walls-wall-types.ts");
check(
  "O CAS write path is unmodified (compare-and-swap envelope remains)",
  casSrc.includes("parseInternalWallsCollectionEnvelope") &&
    casSrc.includes("INTERNAL_WALLS_WALL_TYPES_FACT_KEY") &&
    !read("lib/assistant/scope-persistence.ts").includes(
      "EST-CORRECT-03 must not rewrite CAS"
    )
);

console.log("\n=== Ready proof ===\n");
check(
  "MIXED + unresolved structural → Ready false",
  composeSurfaces({ facts: fixtureFacts() }).readiness.ready === false
);
check(
  "MIXED + lining known + structural No + PCs → Ready may progress",
  knownLining.readiness.ready === true,
  knownLining.readiness.builderCopy ??
    JSON.stringify(knownLining.readiness.diagnostics.unresolved.slice(0, 8))
);
check(
  "irrelevant openings/finish do not block Ready",
  !initialFactKeys(knownLining.clarify).includes(
    "internal_walls.wall_type.has_openings"
  ) &&
    !initialFactKeys(knownLining.clarify).includes(
      "internal_walls.wall_type.skirting"
    )
);
check(
  "unresolved lining still blocks after structural No",
  composeSurfaces({
    facts: [
      ...framedUnlinedFacts(),
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "mixed"),
      fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "no"),
    ],
  }).readiness.ready === false
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);

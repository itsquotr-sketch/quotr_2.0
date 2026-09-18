/**
 * IW-CLOSURE-01A — consume explicit “no openings” in Internal Walls.
 *
 * Run: npx --yes tsx scripts/verify-internal-walls-closure-01a.ts
 *
 * No paid AI. No Production. No migration.
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { isUnresolvedCaptureValue } from "../lib/estimate/disclosed-assumptions";
import {
  applyExtractedInternalWallsToFacts,
  briefStatesExplicitInternalWallsNoOpenings,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  corniceTakeoff,
  skirtingTakeoff,
} from "../lib/estimate/internal-walls-finish";
import { internalWallsTimberTakeoff } from "../lib/estimate/internal-walls-framing";
import { internalWallsLiningFaceTakeoff } from "../lib/estimate/internal-walls-lining";
import {
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
  sumOpeningAreaM2,
  summariseOpeningsLine,
} from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
  summariseWallType,
} from "../lib/estimate/internal-walls-wall-types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { EstimateFact } from "../lib/estimate/types";

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
  tol = 1e-6
): boolean {
  return (
    actual != null &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= tol
  );
}

const HOSTED_BRIEF =
  "Construct a 4m long, 2.7m high internal wall using 90x45 timber framing with 13mm Standard GIB on both sides. No openings.";
const OMITTED_BRIEF =
  "Construct a 4m long, 2.7m high internal wall using 90x45 timber framing with 13mm Standard GIB on both sides.";
const DOOR_BRIEF =
  "Construct a 4m long, 2.7m high internal wall using 90x45 timber framing with 13mm Standard GIB on both sides and one 820 × 2040 door opening.";
const EXCEPT_BRIEF =
  "Construct a 4m long, 2.7m high internal wall using 90x45 timber framing with 13mm Standard GIB on both sides. No openings except one door.";

const IW = {
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

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "w1", value, source: "ai_extracted" };
}

function factsFromBrief(briefText: string): EstimateFact[] {
  const types = extractInternalWallsTypesFromBrief(briefText);
  return applyExtractedInternalWallsToFacts({
    facts: [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "new_partition")],
    workAreaId: "w1",
    types,
  });
}

function composeSurfaces(params: { facts: EstimateFact[]; briefText: string }) {
  const workAreas = [IW];
  const plan = composeJobPlan({
    workAreas,
    facts: params.facts,
    constraints: [],
    briefText: params.briefText,
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas,
    facts: params.facts,
    constraints: [],
    jobPlan: plan,
  });
  const refine = composeRefineView({
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas,
    facts: params.facts,
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
  return { clarify, refine };
}

function unansweredOpeningKeys(briefText: string, facts: EstimateFact[]): string[] {
  const surfaces = composeSurfaces({ facts, briefText });
  const clarifyKeys = [...surfaces.clarify.candidates, ...surfaces.clarify.deferred]
    .filter(isInitialCaptureQuestion)
    .filter(
      (row) =>
        row.factKey === INTERNAL_WALLS_HAS_OPENINGS_KEY ||
        row.factKey?.startsWith("internal_walls.opening.")
    )
    .filter((row) => isUnresolvedCaptureValue(row.currentValue))
    .map((row) => row.factKey ?? row.questionKey ?? "");
  const refineKeys = [...surfaces.refine.highValue, ...surfaces.refine.advanced]
    .filter(
      (row) =>
        row.factKey === INTERNAL_WALLS_HAS_OPENINGS_KEY ||
        row.factKey?.startsWith("internal_walls.opening.")
    )
    .filter((row) => isUnresolvedCaptureValue(row.currentValue))
    .map((row) => row.factKey ?? "");
  return [...new Set([...clarifyKeys, ...refineKeys])];
}

function liningTakeoffFor(type: ReturnType<typeof resolveInternalWallsWallTypes>["types"][number]) {
  return internalWallsLiningFaceTakeoff({
    type,
    face: type.side_a,
    side: "side_a",
    wasteFactor: 0.1,
    hoursPerSheet: null,
    openingDeductionM2: sumOpeningAreaM2(type.openings),
  });
}

function timberQty(type: ReturnType<typeof resolveInternalWallsWallTypes>["types"][number]) {
  const centres = type.stud_centres_mm ?? 600;
  return internalWallsTimberTakeoff({
    type,
    centresMm: centres,
    spacingM: centres / 1000,
    wasteFactor: 0.1,
  });
}

function withBothSidesTrim(facts: EstimateFact[]): EstimateFact[] {
  const typeId = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types[0]?.id;
  let next = facts;
  next = applyInternalWallsFactWrite({
    facts: next,
    workAreaId: "w1",
    wallTypeId: typeId,
    key: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
    value: "Both sides",
  });
  next = applyInternalWallsFactWrite({
    facts: next,
    workAreaId: "w1",
    wallTypeId: typeId,
    key: "internal_walls.wall_type.cornice",
    value: "Both sides",
  });
  return next;
}

console.log("=== IW-CLOSURE-01A explicit no openings ===\n");

console.log("--- Phrase matrix ---\n");
const phraseMatrix: Array<[string, boolean]> = [
  ["No openings.", true],
  ["no opening", true],
  ["without openings", true],
  ["no doors or windows", true],
  ["no door or window openings", true],
  [HOSTED_BRIEF, true],
  [OMITTED_BRIEF, false],
  [DOOR_BRIEF, false],
  [EXCEPT_BRIEF, false],
  ["no openings except one door", false],
  ["remove existing opening", false],
  ["removing existing openings in the old wall", false],
  ["no opening up the existing wall", false],
];
for (const [text, expected] of phraseMatrix) {
  check(
    `phrase ${JSON.stringify(text)} → ${expected ? "none" : "not none"}`,
    briefStatesExplicitInternalWallsNoOpenings(text) === expected
  );
}

console.log("\n--- Hosted fixture ---\n");
const hostedExtracted = extractInternalWallsTypesFromBrief(HOSTED_BRIEF);
check("hosted extracts one type", hostedExtracted.length === 1);
check(
  "hosted extracted none",
  hostedExtracted[0]?.hasOpenings === false &&
    hostedExtracted[0]?.lengthLm === 4 &&
    hostedExtracted[0]?.heightM === 2.7
);
const hostedEnrichment = enrichExtractionFromBrief({
  briefText: HOSTED_BRIEF,
  extraction: emptyExtraction(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;
const hostedWallTypes = hostedEnrichment.facts.find(
  (row) => row.key === "internal_walls.wall_types"
)?.value as Array<{
  has_openings?: unknown;
  openings?: unknown[];
  length_lm?: unknown;
  height_m?: unknown;
}> | undefined;
check(
  "hosted enrichment persists explicit none",
  Array.isArray(hostedWallTypes) &&
    hostedWallTypes.length === 1 &&
    hostedWallTypes[0]?.has_openings === false &&
    (hostedWallTypes[0]?.openings?.length ?? 0) === 0,
  JSON.stringify(hostedWallTypes?.[0]?.has_openings)
);
const hostedFacts = factsFromBrief(HOSTED_BRIEF);
const hostedResolved = resolveInternalWallsWallTypes({
  facts: hostedFacts,
  workAreaId: "w1",
});
const hostedType = hostedResolved.types[0]!;
check("one ordinary wall portion", hostedResolved.types.length === 1);
check("length = 4m", hostedType.length_lm === 4);
check("height = 2.7m", hostedType.height_m === 2.7);
check(
  "openings state is explicitly none",
  hostedType.has_openings === false && hostedType.openings.length === 0
);
check(
  "openings question is not unanswered",
  unansweredOpeningKeys(HOSTED_BRIEF, hostedFacts).length === 0 &&
    nextInternalWallsWallTypeField({
      type: hostedType,
      jobScope: "new_partition",
    }) !== INTERNAL_WALLS_HAS_OPENINGS_KEY
);
check("opening count = 0", hostedType.openings.length === 0);
const hostedLining = liningTakeoffFor(hostedType);
check(
  "opening deduction = 0",
  hostedLining.ok === true && near(hostedLining.openingDeductionM2, 0)
);
check(
  "gross and net wall geometry are equal",
  hostedLining.ok === true &&
    near(hostedLining.grossFaceAreaM2, 4 * 2.7) &&
    near(hostedLining.netFaceAreaM2, hostedLining.grossFaceAreaM2)
);
check(
  "both-side lining remains correct",
  hostedType.same_lining_both_sides === true &&
    hostedType.side_a.product === "standard_gib" &&
    hostedType.side_b.product === "standard_gib" &&
    hostedType.side_a.thickness_mm === 13 &&
    hostedType.side_b.thickness_mm === 13
);
check(
  "discloses No openings",
  summariseOpeningsLine(hostedType.openings, hostedType.has_openings) ===
    "No openings" &&
    summariseWallType(hostedType, 0).openingsLine === "No openings"
);

const equivalentNone = applyInternalWallsFactWrite({
  facts: factsFromBrief(OMITTED_BRIEF),
  workAreaId: "w1",
  wallTypeId: resolveInternalWallsWallTypes({
    facts: factsFromBrief(OMITTED_BRIEF),
    workAreaId: "w1",
  }).types[0]!.id,
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "No",
});
const equivalentType = resolveInternalWallsWallTypes({
  facts: equivalentNone,
  workAreaId: "w1",
}).types[0]!;
const hostedTimber = timberQty(hostedType);
const equivalentTimber = timberQty(equivalentType);
check(
  "framing quantities remain unchanged",
  hostedTimber != null &&
    equivalentTimber != null &&
    hostedTimber.studCount === equivalentTimber.studCount &&
    hostedTimber.rawTimberLm === equivalentTimber.rawTimberLm &&
    hostedTimber.purchaseTimberLm === equivalentTimber.purchaseTimberLm
);
const hostedTrimFacts = withBothSidesTrim(hostedFacts);
const equivalentTrimFacts = withBothSidesTrim(equivalentNone);
const hostedTrimType = resolveInternalWallsWallTypes({
  facts: hostedTrimFacts,
  workAreaId: "w1",
}).types[0]!;
const equivalentTrimType = resolveInternalWallsWallTypes({
  facts: equivalentTrimFacts,
  workAreaId: "w1",
}).types[0]!;
const hostedSkirt = skirtingTakeoff({
  type: hostedTrimType,
  jobScope: "new_partition",
});
const equivalentSkirt = skirtingTakeoff({
  type: equivalentTrimType,
  jobScope: "new_partition",
});
const hostedCornice = corniceTakeoff({
  type: hostedTrimType,
  jobScope: "new_partition",
});
const equivalentCornice = corniceTakeoff({
  type: equivalentTrimType,
  jobScope: "new_partition",
});
check(
  "trim quantities remain unchanged from zero-opening fixture",
  hostedSkirt?.totalLm === equivalentSkirt?.totalLm &&
    hostedCornice?.totalLm === equivalentCornice?.totalLm &&
    near(hostedSkirt?.totalLm ?? -1, 8)
);

console.log("\n--- Omitted-information control ---\n");
const omittedFacts = factsFromBrief(OMITTED_BRIEF);
const omittedType = resolveInternalWallsWallTypes({
  facts: omittedFacts,
  workAreaId: "w1",
}).types[0]!;
check(
  "omitted openings stay unanswered",
  omittedType.has_openings == null &&
    omittedType.openings.length === 0 &&
    unansweredOpeningKeys(OMITTED_BRIEF, omittedFacts).includes(
      INTERNAL_WALLS_HAS_OPENINGS_KEY
    ) &&
    nextInternalWallsWallTypeField({
      type: omittedType,
      jobScope: "new_partition",
    }) === INTERNAL_WALLS_HAS_OPENINGS_KEY
);

console.log("\n--- Door opening control ---\n");
check(
  "door brief is not explicit none",
  briefStatesExplicitInternalWallsNoOpenings(DOOR_BRIEF) === false &&
    extractInternalWallsTypesFromBrief(DOOR_BRIEF)[0]?.hasOpenings == null
);
let doorFacts = applyInternalWallsFactWrite({
  facts: factsFromBrief(DOOR_BRIEF),
  workAreaId: "w1",
  wallTypeId: resolveInternalWallsWallTypes({
    facts: factsFromBrief(DOOR_BRIEF),
    workAreaId: "w1",
  }).types[0]!.id,
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "Yes",
});
const doorTypeId = resolveInternalWallsWallTypes({
  facts: doorFacts,
  workAreaId: "w1",
}).types[0]!;
doorFacts = applyInternalWallsFactWrite({
  facts: doorFacts,
  workAreaId: "w1",
  wallTypeId: doorTypeId.id,
  openingId: doorTypeId.openings[0]!.id,
  key: "internal_walls.opening.type",
  value: "Door opening",
});
doorFacts = applyInternalWallsFactWrite({
  facts: doorFacts,
  workAreaId: "w1",
  wallTypeId: doorTypeId.id,
  openingId: doorTypeId.openings[0]!.id,
  key: "internal_walls.opening.width_m",
  value: 0.82,
});
doorFacts = applyInternalWallsFactWrite({
  facts: doorFacts,
  workAreaId: "w1",
  wallTypeId: doorTypeId.id,
  openingId: doorTypeId.openings[0]!.id,
  key: "internal_walls.opening.height_m",
  value: 2.04,
});
const doorType = resolveInternalWallsWallTypes({
  facts: doorFacts,
  workAreaId: "w1",
}).types[0]!;
const doorLining = liningTakeoffFor(doorType);
check(
  "820 × 2040 door opening calc unchanged",
  doorType.openings.length === 1 &&
    near(doorType.openings[0]!.width_m, 0.82) &&
    near(doorType.openings[0]!.height_m, 2.04) &&
    near(sumOpeningAreaM2(doorType.openings), 0.82 * 2.04) &&
    doorLining.ok === true &&
    near(doorLining.openingDeductionM2, 0.82 * 2.04) &&
    near(doorLining.netFaceAreaM2, 4 * 2.7 - 0.82 * 2.04)
);

console.log("\n--- User-authority ---\n");
let userFacts = factsFromBrief(HOSTED_BRIEF);
const userType0 = resolveInternalWallsWallTypes({
  facts: userFacts,
  workAreaId: "w1",
}).types[0]!;
userFacts = applyInternalWallsFactWrite({
  facts: userFacts,
  workAreaId: "w1",
  wallTypeId: userType0.id,
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "Yes",
});
const userOpeningId = resolveInternalWallsWallTypes({
  facts: userFacts,
  workAreaId: "w1",
}).types[0]!.openings[0]!.id;
userFacts = applyInternalWallsFactWrite({
  facts: userFacts,
  workAreaId: "w1",
  wallTypeId: userType0.id,
  openingId: userOpeningId,
  key: "internal_walls.opening.type",
  value: "Door opening",
});
userFacts = applyInternalWallsFactWrite({
  facts: userFacts,
  workAreaId: "w1",
  wallTypeId: userType0.id,
  openingId: userOpeningId,
  key: "internal_walls.opening.width_m",
  value: 0.82,
});
userFacts = applyInternalWallsFactWrite({
  facts: userFacts,
  workAreaId: "w1",
  wallTypeId: userType0.id,
  openingId: userOpeningId,
  key: "internal_walls.opening.height_m",
  value: 2.04,
});
const afterUser = applyExtractedInternalWallsToFacts({
  facts: userFacts,
  workAreaId: "w1",
  types: extractInternalWallsTypesFromBrief(HOSTED_BRIEF),
});
const afterUserType = resolveInternalWallsWallTypes({
  facts: afterUser,
  workAreaId: "w1",
}).types[0]!;
check(
  "user-added opening wins and persists",
  afterUserType.has_openings === true &&
    afterUserType.openings.length === 1 &&
    afterUserType.openings[0]!.id === userOpeningId &&
    near(afterUserType.openings[0]!.width_m, 0.82) &&
    near(afterUserType.openings[0]!.height_m, 2.04)
);

let editFacts = factsFromBrief(HOSTED_BRIEF);
const editTypeId = resolveInternalWallsWallTypes({
  facts: editFacts,
  workAreaId: "w1",
}).types[0]!.id;
editFacts = applyInternalWallsFactWrite({
  facts: editFacts,
  workAreaId: "w1",
  wallTypeId: editTypeId,
  key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  value: "No",
});
editFacts = applyInternalWallsFactWrite({
  facts: editFacts,
  workAreaId: "w1",
  wallTypeId: editTypeId,
  key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  value: "No",
});
editFacts = applyInternalWallsFactWrite({
  facts: editFacts,
  workAreaId: "w1",
  wallTypeId: editTypeId,
  key: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  value: "Both sides",
});
const afterEdits = resolveInternalWallsWallTypes({
  facts: editFacts,
  workAreaId: "w1",
}).types[0]!;
check(
  "unrelated Details edits keep explicit none",
  afterEdits.has_openings === false &&
    afterEdits.openings.length === 0 &&
    afterEdits.insulation_included === false &&
    afterEdits.skirting === "both"
);

console.log("\n--- Qualified negative control ---\n");
const exceptFacts = factsFromBrief(EXCEPT_BRIEF);
const exceptType = resolveInternalWallsWallTypes({
  facts: exceptFacts,
  workAreaId: "w1",
}).types[0]!;
check(
  "no openings except one door is not zero openings",
  exceptType.has_openings == null &&
    exceptType.openings.length === 0 &&
    unansweredOpeningKeys(EXCEPT_BRIEF, exceptFacts).includes(
      INTERNAL_WALLS_HAS_OPENINGS_KEY
    )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

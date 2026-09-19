/**
 * EST-CORRECT-04 — Internal Walls accessory / finish Details completeness.
 *
 * Run: npx --yes tsx scripts/verify-est-correct-04.ts
 *
 * No paid AI. No Production. No merge to main.
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { isDetailsOwnedWhenUnresolved } from "../lib/assistant/question-ownership";
import { evaluateClarifyEstimateReadiness } from "../lib/assistant/readiness/clarify-estimate";
import { composeRefineView } from "../lib/assistant/refine/compose";
import type { RefineCandidate } from "../lib/assistant/refine/types";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { isUnresolvedCaptureValue } from "../lib/estimate/disclosed-assumptions";
import {
  applyExtractedInternalWallsToFacts,
  applyInternalWallsNoAccessoryScope,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
  internalWallsNestedFinishOmit,
  nextInternalWallsFinishField,
  skirtingTakeoff,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_PAINTING_COMPONENT,
  INTERNAL_WALLS_STOPPING_COMPONENT,
} from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
} from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

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

function fact(
  key: string,
  workAreaId: string,
  value: unknown
): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const BRIEF = COORDINATION_ORIGINAL_BRIEF;
const CONSUMED_PCS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

const IW = {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  status: "confirmed" as const,
};
const PLASTER = {
  id: "pl1",
  type: "plastering",
  name: "Plastering",
  status: "confirmed" as const,
};
const PAINT = {
  id: "p1",
  type: "painting",
  name: "Painting",
  status: "confirmed" as const,
};

function composeSurfaces(params: {
  facts: EstimateFact[];
  workAreas?: { id: string; type: string; name: string; status: "confirmed" }[];
  briefText?: string;
}) {
  const workAreas = params.workAreas ?? [IW];
  const constraints = CONSUMED_PCS.map((row) => ({
    key: row.key,
    value: row.value,
  }));
  const plan = composeJobPlan({
    workAreas,
    facts: params.facts,
    constraints,
    briefText: params.briefText ?? BRIEF,
  });
  const clarifyInput = {
    stage: "quality" as const,
    briefText: params.briefText ?? BRIEF,
    qualityLevel: "standard",
    workAreas,
    facts: params.facts,
    constraints,
    jobPlan: plan,
  };
  const clarify = composeClarifyView(clarifyInput);
  const refine = composeRefineView({
    briefText: params.briefText ?? BRIEF,
    qualityLevel: "standard",
    workAreas,
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
  return {
    clarify,
    refine,
    readiness: evaluateClarifyEstimateReadiness(clarifyInput),
  };
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

function fixtureBase(extra: EstimateFact[] = []): EstimateFact[] {
  return applyExtractedInternalWallsToFacts({
    facts: [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "mixed"),
      fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "no"),
      ...extra,
    ],
    workAreaId: "w1",
    types: extractInternalWallsTypesFromBrief(BRIEF),
  });
}

function writeOnTypes(
  facts: EstimateFact[],
  writes: Array<{ key: string; value: unknown }>
): EstimateFact[] {
  let next = facts;
  const types = resolveInternalWallsWallTypes({
    facts,
    workAreaId: "w1",
  }).types;
  for (const type of types) {
    for (const row of writes) {
      next = applyInternalWallsFactWrite({
        facts: next,
        workAreaId: "w1",
        wallTypeId: type.id,
        key: row.key,
        value: row.value,
      });
    }
  }
  return next;
}

function seedOneType(): EstimateFact[] {
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
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
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

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
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

const ACCESSORY_PARENTS = [
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
] as const;

console.log("=== EST-CORRECT-04 accessory Details contract ===\n");

const unresolvedParents = composeSurfaces({ facts: fixtureBase() });
check(
  "P unresolved accessory parents block Ready",
  unresolvedParents.readiness.ready === false &&
    initialFactKeys(unresolvedParents.clarify).includes(
      INTERNAL_WALLS_HAS_OPENINGS_KEY
    )
);
check(
  "R unresolved openings/skirting/cornice/stopping/insulation/painting do not first-ask in Refine",
  ACCESSORY_PARENTS.every(
    (key) =>
      isDetailsOwnedWhenUnresolved("internal_walls", key) &&
      !hasUnresolvedRefine(unresolvedParents.refine, key)
  )
);

const openingsNo = composeSurfaces({
  facts: writeOnTypes(fixtureBase(), [
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
  ]),
});
check(
  "A openings No → no opening children",
  !initialFactKeys(openingsNo.clarify).includes("internal_walls.opening.type") &&
    !initialFactKeys(openingsNo.clarify).includes("internal_walls.opening.width_m")
);

const openingsYes = composeSurfaces({
  facts: writeOnTypes(fixtureBase(), [
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
  ]),
});
check(
  "B openings Yes → required opening inputs activate",
  openingsYes.readiness.ready === false &&
    (initialFactKeys(openingsYes.clarify).includes("internal_walls.opening.type") ||
      initialFactKeys(openingsYes.clarify).includes(
        "internal_walls.opening.width_m"
      ))
);
check(
  "B calculator does not ask header/trimmer or opening count",
  !initialFactKeys(openingsYes.clarify).some((key) =>
    /header|trimmer|opening\.count|opening_count/i.test(key)
  )
);

const oneType = seedOneType();
const skirtingNoFacts = writeOnTypes(oneType, [
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
]);
const skirtingNo = composeSurfaces({
  facts: skirtingNoFacts,
  briefText: "12m of new internal wall, 2.4 high, 90x45 timber, 13mm standard GIB both sides",
});
check(
  "C skirting No → no skirting children / Ready not blocked by profile",
  !initialFactKeys(skirtingNo.clarify).some((key) =>
    /skirting\.(profile|type|length)/.test(key)
  )
);

const skirtingYesFacts = writeOnTypes(oneType, [
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "Both sides" },
]);
const skirtingYesType = resolveInternalWallsWallTypes({
  facts: skirtingYesFacts,
  workAreaId: "w1",
}).types[0]!;
const skirtQty = skirtingTakeoff({
  type: skirtingYesType,
  jobScope: "new_partition",
});
check(
  "D skirting yes → geometry-derived quantity, no re-entered length",
  skirtQty != null &&
    skirtQty.totalLm > 0 &&
    nextInternalWallsWallTypeField({
      type: skirtingYesType,
      jobScope: "new_partition",
      omitElectrical: true,
    }) !== INTERNAL_WALLS_SKIRTING_SIDES_KEY
);

const corniceNo = composeSurfaces({
  facts: writeOnTypes(oneType, [
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
    { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
    { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
  ]),
  briefText: "new internal wall timber gib",
});
check(
  "E cornice No → no cornice product children",
  !initialFactKeys(corniceNo.clarify).some((key) =>
    /cornice\.(product|type|profile)/.test(key)
  )
);
const corniceYesType = resolveInternalWallsWallTypes({
  facts: writeOnTypes(oneType, [
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
    { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
    { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "Both sides" },
  ]),
  workAreaId: "w1",
}).types[0]!;
check(
  "F cornice yes → sides resolved, type confirmation asked",
  nextInternalWallsFinishField({
    type: corniceYesType,
    jobScope: "new_partition",
    omitElectrical: true,
  }) === "internal_walls.wall_type.cornice_type"
);

const stoppingNoFacts = writeOnTypes(oneType, [
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "No" },
]);
const stoppingNoCalc = calculateInternalWalls(
  ctx([{ id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }], stoppingNoFacts),
  { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
check(
  "G stopping No → no IW stopping pricing",
  !stoppingNoCalc.lineItems.some(
    (row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT
  ) &&
    !(stoppingNoCalc.requirements ?? []).some(
      (row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT
    )
);

const stoppingYesFacts = writeOnTypes(oneType, [
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "Level 4" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "Level 4" },
]);
const stoppingYesCalc = calculateInternalWalls(
  ctx([{ id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }], stoppingYesFacts),
  { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
check(
  "H stopping yes, no Plastering WA → IW owns stopping",
  (stoppingYesCalc.requirements ?? []).some(
    (row) =>
      row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT &&
      row.workAreaId === "w1"
  )
);

const stoppingXor = internalWallsNestedFinishOmit({
  confirmedTypes: ["internal_walls", "plastering"],
});
const stoppingWithPlaster = calculateInternalWalls(
  ctx(
    [
      { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 },
      { id: "pl1", type: "plastering", name: "Plastering", sort_order: 2 },
    ],
    stoppingYesFacts
  ),
  { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
const plasterDetails = composeSurfaces({
  facts: stoppingYesFacts,
  workAreas: [IW, PLASTER],
  briefText: "new internal wall timber gib",
});
check(
  "I stopping yes + Plastering WA → no duplicate IW stopping ownership or interview",
  stoppingXor.omitStopping === true &&
    !(stoppingWithPlaster.requirements ?? []).some(
      (row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT
    ) &&
    !initialFactKeys(plasterDetails.clarify).includes(
      INTERNAL_WALLS_STOPPING_SIDE_A_KEY
    )
);

const insulationNo = composeSurfaces({
  facts: writeOnTypes(oneType, [
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  ]),
  briefText: "new internal wall timber gib",
});
check(
  "J insulation No → no insulation type child",
  !initialFactKeys(insulationNo.clarify).includes(INTERNAL_WALLS_INSULATION_TYPE_KEY)
);

const insulationYes = composeSurfaces({
  facts: writeOnTypes(oneType, [
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "Yes" },
  ]),
  briefText: "new internal wall timber gib",
});
check(
  "K insulation yes → type spec activates, no invented product",
  insulationYes.readiness.ready === false &&
    initialFactKeys(insulationYes.clarify).includes(
      INTERNAL_WALLS_INSULATION_TYPE_KEY
    ) &&
    !initialFactKeys(insulationYes.clarify).some((key) =>
      /insulation\.(product|rate|brand)/.test(key)
    )
);

const paintingNoFacts = applyInternalWallsNoAccessoryScope({
  facts: oneType,
  workAreaId: "w1",
});
const paintingNoCalc = calculateInternalWalls(
  ctx([{ id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }], paintingNoFacts),
  { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
check(
  "L painting No → no IW painting scope",
  !paintingNoCalc.lineItems.some(
    (row) => row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT
  ) &&
    !(paintingNoCalc.requirements ?? []).some(
      (row) => row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT
    )
);

const paintingYesFacts = writeOnTypes(oneType, [
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "No" },
  { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: "Both sides" },
]);
const paintingOwned = calculateInternalWalls(
  ctx(
    [
      { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 },
      { id: "p1", type: "painting", name: "Painting", sort_order: 2 },
    ],
    paintingYesFacts
  ),
  { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
check(
  "M painting yes + Painting WA → no IW double pricing",
  internalWallsNestedFinishOmit({
    confirmedTypes: ["internal_walls", "painting"],
  }).omitPainting === true &&
    !(paintingOwned.requirements ?? []).some(
      (row) => row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT
    )
);

const paintWaFacts = writeOnTypes(oneType, [
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "No" },
]);
const paintWaView = composeSurfaces({
  facts: paintWaFacts,
  workAreas: [IW, PAINT],
  briefText: "new internal wall timber gib. Paint the interior.",
});
check(
  "N Painting WA confirmed → no duplicate IW painting interview",
  !initialFactKeys(paintWaView.clarify).includes(INTERNAL_WALLS_PAINTING_SIDES_KEY)
);

const knownBrief = composeSurfaces({ facts: fixtureBase() });
check(
  "O known lining from brief is not re-asked",
  !initialFactKeys(knownBrief.clarify).includes(
    "internal_walls.wall_type.side_a_product"
  )
);

const readyNone = composeSurfaces({
  facts: applyInternalWallsNoAccessoryScope({
    facts: fixtureBase(),
    workAreaId: "w1",
  }),
});
check(
  "Q accessory No children do not block Ready",
  readyNone.readiness.ready === true &&
    !initialFactKeys(readyNone.clarify).includes("internal_walls.opening.type") &&
    !initialFactKeys(readyNone.clarify).includes(INTERNAL_WALLS_INSULATION_TYPE_KEY),
  readyNone.readiness.builderCopy ??
    JSON.stringify(readyNone.readiness.diagnostics.unresolved.slice(0, 8))
);
check(
  "three-wall fixture still two Wall Types after accessory No",
  resolveInternalWallsWallTypes({
    facts: applyInternalWallsNoAccessoryScope({
      facts: fixtureBase(),
      workAreaId: "w1",
    }),
    workAreaId: "w1",
  }).types.length === 2
);

check(
  "electrical stays optional and does not block after accessories resolved",
  !initialFactKeys(readyNone.clarify).includes(
    "internal_walls.wall_type.electrical"
  )
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);

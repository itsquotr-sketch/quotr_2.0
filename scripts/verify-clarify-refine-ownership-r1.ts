/**
 * EF02-D1 — Clarify vs Refine ownership, one Refine row per Deck field,
 * accepted-assumption Refine result, Project Condition consistency, and
 * lightweight cross-Work-Area traces.
 *
 * Run: npx --yes tsx scripts/verify-clarify-refine-ownership-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { plannedAssumptionWrites } from "../lib/assistant/clarify/persist-assumptions";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  isNestedRefineIdentity,
  questionSemanticKey,
} from "../lib/assistant/question-identity";
import { detailsAskClassForFact } from "../lib/assistant/question-ownership";
import { composeRefineView } from "../lib/assistant/refine/compose";
import type { RefineCandidate } from "../lib/assistant/refine/types";
import { isUnresolvedCaptureValue } from "../lib/estimate/disclosed-assumptions";
import {
  DECK_HEIGHT_ASSUMPTION_M,
  disclosedAssumptionForNotSure,
} from "../lib/estimate/disclosed-assumptions";
import type { EstimateFact } from "../lib/estimate/types";
import {
  consumedProjectConditionAskClass,
  getConsumedProjectConditionDef,
  listConsumedProjectConditionDefs,
} from "../lib/project-conditions/consumed-authority";

let passed = 0;
let failed = 0;
const remaining: string[] = [];

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
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

const CONSUMED_PCS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

function composeSurfaces(params: {
  workAreas: { id: string; type: string; name: string; status: "confirmed" }[];
  facts: EstimateFact[];
  constraints?: { key: string; value: unknown; source?: string | null }[];
  briefText: string;
}) {
  const constraints =
    params.constraints ??
    CONSUMED_PCS.map((row) => ({ key: row.key, value: row.value }));
  const plan = composeJobPlan({
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    briefText: params.briefText,
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    jobPlan: plan,
  });
  const refine = composeRefineView({
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas: params.workAreas,
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
  return { clarify, plan, refine };
}

function refineRows(view: ReturnType<typeof composeRefineView>): RefineCandidate[] {
  return [...view.highValue, ...view.advanced];
}

function clarifyOpenInitial(view: ReturnType<typeof composeClarifyView>) {
  return [...view.candidates, ...view.deferred].filter(
    (row) =>
      row.askClass === "HARD_MINIMUM" ||
      row.askClass === "ASK_NOW"
  );
}

const DECK_DUPLICATE_KEYS = [
  "deck.existing_deck_removal",
  "deck.vertical_face_boards_required",
  "deck.steps_included",
  "deck.board_width_mm",
  "deck.height_m",
  "deck.board_material",
] as const;

console.log("=== EF02-D1 Clarify / Refine ownership ===\n");

const coreFacts = [
  fact("deck.length_m", "d1", 5),
  fact("deck.width_m", "d1", 4),
];
const core = composeSurfaces({
  workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
  facts: coreFacts,
  briefText: "Build a new 5 by 4 metre pine deck.",
});

const openDetails = clarifyOpenInitial(core.clarify);
const refineCore = refineRows(core.refine);

for (const row of openDetails) {
  if (!row.factKey) continue;
  const leaked = refineCore.filter(
    (r) =>
      r.workAreaId === row.workAreaId &&
      r.factKey === row.factKey &&
      isUnresolvedCaptureValue(r.currentValue)
  );
  check(
    `unresolved ${row.askClass} ${row.factKey} is not in Refine`,
    leaked.length === 0
  );
}

for (const key of [
  "deck.height_m",
  "deck.board_material",
  "deck.existing_deck_removal",
  "deck.vertical_face_boards_required",
  "deck.steps_included",
] as const) {
  check(
    `Deck ${key} is not an unanswered Refine question`,
    !refineCore.some(
      (row) => row.factKey === key && isUnresolvedCaptureValue(row.currentValue)
    )
  );
}

console.log("\n=== One Refine row per Deck semantic field ===\n");

const resolvedDeck = composeSurfaces({
  workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
  facts: [
    ...coreFacts,
    fact("deck.height_m", "d1", 0.6, "assumption"),
    fact("deck.board_material", "d1", "Hardwood", "assumption"),
    fact("deck.board_width_mm", "d1", 140, "assumption"),
    fact("deck.existing_deck_removal", "d1", false),
    fact("deck.vertical_face_boards_required", "d1", false),
    fact("deck.steps_included", "d1", true),
    fact("deck.step_width_m", "d1", 1, "assumption"),
    fact("deck.step_going_m", "d1", 0.28, "assumption"),
  ],
  briefText: "Build a new 5 by 4 metre pine deck with steps.",
});
const resolvedRows = refineRows(resolvedDeck.refine);
for (const key of DECK_DUPLICATE_KEYS) {
  const matches = resolvedRows.filter(
    (row) =>
      !isNestedRefineIdentity(row) &&
      row.workAreaId === "d1" &&
      row.factKey === key
  );
  check(`${key} has at most one Refine row`, matches.length <= 1);
}

const semanticCounts = new Map<string, number>();
for (const row of resolvedRows.filter((row) => !isNestedRefineIdentity(row))) {
  const key =
    row.semanticKey ??
    questionSemanticKey({
      workAreaId: row.workAreaId,
      factKey: row.factKey,
      constraintKey: row.constraintKey,
    });
  if (!key) continue;
  semanticCounts.set(key, (semanticCounts.get(key) ?? 0) + 1);
}
check(
  "no duplicate semantic Refine keys on resolved Deck",
  [...semanticCounts.values()].every((n) => n === 1)
);

console.log("\n=== Accepted assumption persistence ===\n");

const heightNotSure = disclosedAssumptionForNotSure(
  "deck.height_m",
  "Not sure"
);
check(
  "Not sure deck.height_m maps to 0.6 assumption",
  heightNotSure?.value === DECK_HEIGHT_ASSUMPTION_M &&
    heightNotSure.source === "assumption"
);
check(
  "real height is not remapped",
  disclosedAssumptionForNotSure("deck.height_m", 1.2) == null
);

const assumedFacts: EstimateFact[] = [
  ...coreFacts,
  fact("deck.height_m", "d1", DECK_HEIGHT_ASSUMPTION_M, "assumption"),
];
const assumedSurfaces = composeSurfaces({
  workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
  facts: assumedFacts,
  briefText: "Build a new 5 by 4 metre pine deck.",
});
const heightRows = refineRows(assumedSurfaces.refine).filter(
  (row) => row.factKey === "deck.height_m"
);
check("assumed height has one Refine row", heightRows.length === 1);
check(
  "assumed height Refine row has 0.6 not a blank question",
  heightRows[0]?.currentValue === DECK_HEIGHT_ASSUMPTION_M &&
    heightRows[0]?.assumed === true &&
    heightRows[0]?.valueSource === "assumption"
);
check(
  "assumed height is suppressed from Details",
  ![...assumedSurfaces.clarify.candidates, ...assumedSurfaces.clarify.deferred].some(
    (row) => row.factKey === "deck.height_m"
  )
);

const skippedWrites = plannedAssumptionWrites({
  view: core.clarify,
  facts: coreFacts,
  constraints: CONSUMED_PCS.map((row) => ({ key: row.key, value: row.value })),
});
check(
  "Estimate-now plans a height assumption write",
  skippedWrites.some(
    (write) =>
      write.kind === "FACT" &&
      write.key === "deck.height_m" &&
      write.value === DECK_HEIGHT_ASSUMPTION_M &&
      write.source === "assumption"
  )
);

console.log("\n=== Project Condition consistency ===\n");

const pcDefs = listConsumedProjectConditionDefs();
for (const key of [
  "site_access",
  "material_carry_distance",
  "occupied_site",
  "working_hours",
] as const) {
  const def = getConsumedProjectConditionDef(key);
  check(`${key} has one canonical def`, def != null);
}

const unresolvedPc = composeSurfaces({
  workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
  facts: coreFacts,
  constraints: [],
  briefText: "Build a new 5 by 4 metre pine deck.",
});
const clarifyPcs = [...unresolvedPc.clarify.candidates, ...unresolvedPc.clarify.deferred]
  .filter((row) => row.constraintKey)
  .map((row) => ({
    key: row.constraintKey!,
    askClass: row.askClass,
    options: [...(row.options ?? [])].join("|"),
  }));
for (const def of pcDefs) {
  const clarify = clarifyPcs.find((row) => row.key === def.key);
  if (!clarify) continue;
  check(
    `Clarify ${def.key} askClass matches canonical ${def.askClass}`,
    clarify.askClass === def.askClass
  );
  check(
    `Clarify ${def.key} options match registry`,
    clarify.options === def.options.join("|")
  );
}

const refineCarry = refineRows(core.refine).find(
  (row) => row.constraintKey === "material_carry_distance"
);
check(
  "resolved carry distance is Refine high_value not advanced",
  refineCarry != null && refineCarry.tier === "high_value"
);
check(
  "unresolved required PCs are not in Refine",
  !refineRows(unresolvedPc.refine).some(
    (row) =>
      row.constraintKey === "site_access" ||
      row.constraintKey === "material_carry_distance"
  )
);
check(
  "canonical carry is ASK_NOW not Refine-advanced",
  consumedProjectConditionAskClass("material_carry_distance") === "ASK_NOW"
);

console.log("\n=== Step relevance ===\n");

const noSteps = composeSurfaces({
  workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
  facts: [
    ...coreFacts,
    fact("deck.steps_included", "d1", false),
    fact("deck.step_width_m", "d1", 1.2),
    fact("deck.step_going_m", "d1", 0.3),
  ],
  briefText: "Build a new 5 by 4 metre pine deck. No steps.",
});
check(
  "step geometry is hidden when steps are excluded",
  !refineRows(noSteps.refine).some(
    (row) =>
      row.factKey === "deck.step_width_m" ||
      row.factKey === "deck.step_going_m" ||
      row.factKey === "deck.step_count"
  )
);

console.log("\n=== Cross-Work-Area traces ===\n");

function traceWa(
  label: string,
  type: string,
  facts: EstimateFact[],
  briefText: string
): void {
  const surfaces = composeSurfaces({
    workAreas: [{ id: "w1", type, name: label, status: "confirmed" }],
    facts,
    briefText,
  });
  const rows = refineRows(surfaces.refine).filter(
    (row) => !isNestedRefineIdentity(row)
  );
  const leaked = rows.filter((row) => {
    if (!isUnresolvedCaptureValue(row.currentValue) || !row.factKey) {
      return false;
    }
    const cls = detailsAskClassForFact(type, row.factKey);
    return cls === "HARD_MINIMUM" || cls === "ASK_NOW";
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key =
      questionSemanticKey({
        workAreaId: row.workAreaId,
        factKey: row.factKey,
        constraintKey: row.constraintKey,
      }) ?? row.id;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = [...counts.entries()].filter(([, n]) => n > 1);
  check(
    `${label}: no unresolved HARD_MINIMUM/ASK_NOW in Refine`,
    leaked.length === 0,
    leaked.map((row) => row.factKey).join(", ")
  );
  check(
    `${label}: no duplicate flat semantic Refine rows`,
    dupes.length === 0,
    dupes.map(([key]) => key).join(", ")
  );
  if (dupes.length > 0) {
    remaining.push(`${label} duplicate Refine rows: ${dupes.map(([k]) => k).join(", ")}`);
  }
  const unresolvedRefine = rows.filter((row) =>
    isUnresolvedCaptureValue(row.currentValue)
  );
  if (unresolvedRefine.length > 0) {
    remaining.push(
      `${label} unresolved Refine (non-initial): ${unresolvedRefine
        .map((row) => row.factKey)
        .filter(Boolean)
        .join(", ")}`
    );
  }
}

traceWa(
  "Bathroom",
  "bathroom",
  [
    fact("bathroom.job_scope", "w1", "full_renovation"),
    fact("bathroom.length_m", "w1", 3),
    fact("bathroom.width_m", "w1", 2.4),
  ],
  "Full bathroom renovation 3 by 2.4 metres."
);
traceWa(
  "Fence",
  "fence",
  [
    fact("fence.system", "w1", "timber"),
    fact("fence.material", "w1", "pine"),
    fact("fence.length_m", "w1", 20),
    fact("fence.height_m", "w1", 1.8),
  ],
  "20 metres of 1.8 m pine paling fence."
);
traceWa(
  "Retaining Wall",
  "retaining_wall",
  [
    fact("retaining_wall.material", "w1", "timber"),
    fact("retaining_wall.length_m", "w1", 8),
    fact("retaining_wall.height_m", "w1", 1.2),
  ],
  "8 metre timber retaining wall 1.2 m high."
);
traceWa(
  "Internal Walls",
  "internal_walls",
  [fact("internal_walls.job_scope", "w1", "new_partition")],
  "New internal partition walls."
);

console.log("\n=== Remaining domain notes ===");
if (remaining.length === 0) {
  console.log("none beyond D1 shared ownership filter");
} else {
  for (const note of remaining) console.log(`NOTE  ${note}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

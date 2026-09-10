/**
 * EF02-C2 — grouped complete Details capture.
 *
 * Run: npx --yes tsx scripts/verify-details-grouped-complete-capture-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isDetailsOwnedQuestion } from "../lib/assistant/clarify/question-contract";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  listDeckClarifyDescriptors,
} from "../lib/estimate/deck-question-descriptors";
import { hasFactValue, isNotSureValue } from "../lib/estimate/facts";
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

function composeDetails(params: {
  workAreas: { id: string; type: string; name: string; status: "confirmed" }[];
  facts: EstimateFact[];
  constraints?: { key: string; value: unknown }[];
  briefText: string;
}) {
  const constraints = params.constraints ?? CONSUMED_PCS.map((row) => ({
    key: row.key,
    value: row.value,
  }));
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
  return { clarify, plan };
}

function groupedCandidates(view: ReturnType<typeof composeClarifyView>) {
  return view.groups.flatMap((group) =>
    group.sections.flatMap((section) => section.candidates)
  );
}

function known(facts: EstimateFact[], workAreaId: string, key: string): boolean {
  return facts.some(
    (row) =>
      row.key === key &&
      row.work_area_id === workAreaId &&
      hasFactValue(row.value) &&
      !isNotSureValue(row.value)
  );
}

console.log("=== EF02-C2 grouped complete Details capture ===\n");

const coreFacts = [
  fact("deck.length_m", "d1", 5),
  fact("deck.width_m", "d1", 4),
];
const deck = composeDetails({
  workAreas: [{ id: "d1", type: "deck", name: "Rear Deck", status: "confirmed" }],
  facts: coreFacts,
  constraints: [],
  briefText: "Build a new 5 by 4 metre pine deck.",
});

check(
  "A: visible set is not presentation-capped",
  deck.clarify.visibleCount === deck.clarify.candidates.length &&
    deck.clarify.visibleCount > 3
);

const relevantDeck = listDeckClarifyDescriptors().filter((row) =>
  row.isRelevant({
    facts: coreFacts,
    workAreaId: "d1",
    briefText: "Build a new 5 by 4 metre pine deck.",
  })
);
const missingRelevant = relevantDeck.filter(
  (row) =>
    !known(coreFacts, "d1", row.factKey) &&
    !deck.clarify.candidates.some((c) => c.factKey === row.factKey)
);
check(
  "A: all currently relevant Deck Clarify descriptors are represented",
  missingRelevant.length === 0,
  missingRelevant.map((row) => row.factKey).join(", ")
);
check(
  "A: grouped composition contains the same candidates",
  groupedCandidates(deck.clarify).length === deck.clarify.candidates.length
);
check(
  "A: Rear Deck is grouped by instance name",
  deck.clarify.groups.some(
    (group) => group.workAreaId === "d1" && group.workAreaName === "Rear Deck"
  )
);
const deckSectionIds = new Set(
  deck.clarify.groups
    .find((group) => group.workAreaId === "d1")
    ?.sections.map((section) => section.id) ?? []
);
check(
  "A: Deck uses C1 descriptor sections mapped to product labels",
  deckSectionIds.has("dimensions") &&
    deckSectionIds.has("materials") &&
    deckSectionIds.has("structure") &&
    deckSectionIds.has("scope")
);

const noSteps = composeDetails({
  workAreas: [{ id: "d1", type: "deck", name: "Rear Deck", status: "confirmed" }],
  facts: [...coreFacts, fact("deck.steps_included", "d1", false)],
  constraints: [],
  briefText: "Build a new 5 by 4 metre pine deck. No steps.",
});
check(
  "B: steps excluded hides step geometry",
  !noSteps.clarify.candidates.some(
    (row) =>
      row.factKey === "deck.step_width_m" ||
      row.factKey === "deck.step_going_m" ||
      row.factKey === "deck.step_count"
  )
);

const withSteps = composeDetails({
  workAreas: [{ id: "d1", type: "deck", name: "Rear Deck", status: "confirmed" }],
  facts: [...coreFacts, fact("deck.steps_included", "d1", true)],
  constraints: [],
  briefText: "Build a new 5 by 4 metre pine deck with steps.",
});
check(
  "C: steps included reveals step width and going",
  withSteps.clarify.candidates.some((row) => row.factKey === "deck.step_width_m") &&
    withSteps.clarify.candidates.some((row) => row.factKey === "deck.step_going_m")
);

const pcKeys = groupedCandidates(deck.clarify)
  .map((row) => row.constraintKey)
  .filter((key): key is string => Boolean(key));
const uniquePcs = new Set(pcKeys);
check("D: Project Conditions appear once", pcKeys.length === uniquePcs.size);
check(
  "D: shared PCs live on the project group",
  deck.clarify.groups.some(
    (group) =>
      group.workAreaId == null &&
      group.sections.some((section) => section.id === "project_conditions")
  )
);
check(
  "D: PCs are not duplicated under the Deck instance",
  !deck.clarify.groups.some(
    (group) =>
      group.workAreaId === "d1" &&
      group.sections.some((section) =>
        section.candidates.some((row) => row.constraintKey)
      )
  )
);

const ensuiteFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
];
const familyFacts = [
  fact("bathroom.job_scope", "b2", "full_renovation"),
  fact("bathroom.length_m", "b2", 2.4),
  fact("bathroom.width_m", "b2", 2.1),
];
const twoBaths = composeDetails({
  workAreas: [
    { id: "b1", type: "bathroom", name: "Master Ensuite", status: "confirmed" },
    { id: "b2", type: "bathroom", name: "Family Bathroom", status: "confirmed" },
  ],
  facts: [...ensuiteFacts, ...familyFacts],
  constraints: [],
  briefText: "Master ensuite and family bathroom renovations.",
});
const ensuiteGroup = twoBaths.clarify.groups.find((g) => g.workAreaId === "b1");
const familyGroup = twoBaths.clarify.groups.find((g) => g.workAreaId === "b2");
check(
  "E: Master Ensuite and Family Bathroom stay instance-separated",
  ensuiteGroup?.workAreaName === "Master Ensuite" &&
    familyGroup?.workAreaName === "Family Bathroom"
);
check(
  "E: bathroom questions do not collide across instances",
  (ensuiteGroup?.sections.flatMap((s) => s.candidates) ?? []).every(
    (row) => row.workAreaId === "b1"
  ) &&
    (familyGroup?.sections.flatMap((s) => s.candidates) ?? []).every(
      (row) => row.workAreaId === "b2"
    )
);

const knownHeight = composeDetails({
  workAreas: [{ id: "d1", type: "deck", name: "Rear Deck", status: "confirmed" }],
  facts: [...coreFacts, fact("deck.height_m", "d1", 0.8)],
  constraints: [],
  briefText: "Build a new 5 by 4 metre pine deck.",
});
check(
  "F: known height does not reappear as an unresolved question",
  !knownHeight.clarify.candidates.some((row) => row.factKey === "deck.height_m")
);

const assumedHeight = composeDetails({
  workAreas: [{ id: "d1", type: "deck", name: "Rear Deck", status: "confirmed" }],
  facts: [...coreFacts, fact("deck.height_m", "d1", 0.6, "assumption")],
  constraints: [],
  briefText: "Build a new 5 by 4 metre pine deck.",
});
check(
  "G: accepted assumption does not reappear",
  !assumedHeight.clarify.candidates.some((row) => row.factKey === "deck.height_m")
);

check(
  "H: Ready is false while required unresolved questions exist",
  deck.clarify.remainingRequiredCount > 0 &&
    deck.clarify.enoughToEstimate === false
);

const unresolvedRequired = deck.clarify.candidates.filter(
  (row) =>
    row.askClass === "HARD_MINIMUM" ||
    row.askClass === "ASK_NOW" ||
    row.economicClass === "REQUIRED_FOR_ECONOMIC_MODEL"
);
check(
  "H: unresolved required set cannot coexist with enoughToEstimate",
  !(deck.clarify.enoughToEstimate && unresolvedRequired.length > 0)
);

const iw = composeDetails({
  workAreas: [
    {
      id: "w1",
      type: "internal_walls",
      name: "Ground Floor Internal Walls",
      status: "confirmed",
    },
  ],
  facts: [fact("internal_walls.job_scope", "w1", "new_partition")],
  constraints: [],
  briefText: "New internal partition walls on the ground floor.",
});
check(
  "Internal Walls remain one Work Area group",
  iw.clarify.groups.filter((group) => group.workAreaType === "internal_walls")
    .length === 1
);
check(
  "Internal Walls nested questions stay inside that instance",
  iw.clarify.groups
    .find((group) => group.workAreaId === "w1")
    ?.sections.every((section) =>
      section.candidates.every((row) => row.workAreaId === "w1")
    ) === true
);

const composeSrc = readFileSync(
  join(process.cwd(), "lib/assistant/clarify/compose.ts"),
  "utf8"
);
check(
  "compose no longer allocates a 3-question Details batch",
  !composeSrc.includes("allocateClarifyBudget")
);
check(
  "every visible candidate is Details-owned",
  deck.clarify.candidates.every(isDetailsOwnedQuestion)
);

const panelSrc = readFileSync(
  join(process.cwd(), "components/assistant/clarify/ClarifyPanel.tsx"),
  "utf8"
);
check(
  "Details panel renders grouped complete capture",
  panelSrc.includes("data-details-complete-capture") &&
    panelSrc.includes("data-details-group")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

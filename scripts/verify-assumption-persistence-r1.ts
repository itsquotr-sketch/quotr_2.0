/**
 * EF02-D1 — accepted ASSUME_IF_SKIPPED values persist as assumption facts
 * and Refine shows the assumed value, not a blank question.
 *
 * Run: npx --yes tsx scripts/verify-assumption-persistence-r1.ts
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { plannedAssumptionWrites } from "../lib/assistant/clarify/persist-assumptions";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  DECK_BOARD_MATERIAL_ASSUMPTION,
  DECK_HEIGHT_ASSUMPTION_M,
  disclosedAssumptionForNotSure,
} from "../lib/estimate/disclosed-assumptions";
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

const workAreas = [
  { id: "d1", type: "deck", name: "Deck", status: "confirmed" as const },
];
const constraints = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
];

console.log("=== EF02-D1 assumption persistence ===\n");

check(
  "Not sure height → 0.6 assumption source",
  disclosedAssumptionForNotSure("deck.height_m", "Not sure")?.value ===
    DECK_HEIGHT_ASSUMPTION_M &&
    disclosedAssumptionForNotSure("deck.height_m", "Not sure")?.source ===
      "assumption"
);
check(
  "Not sure board material → Hardwood assumption",
  disclosedAssumptionForNotSure("deck.board_material", "Not sure")?.value ===
    DECK_BOARD_MATERIAL_ASSUMPTION
);
check(
  "Known height stays user-owned",
  disclosedAssumptionForNotSure("deck.height_m", 0.8) == null
);

const unresolved = [fact("deck.length_m", "d1", 5), fact("deck.width_m", "d1", 4)];
const plan = composeJobPlan({
  workAreas,
  facts: unresolved,
  constraints,
  briefText: "New 5 by 4 pine deck.",
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: "New 5 by 4 pine deck.",
  qualityLevel: "standard",
  workAreas,
  facts: unresolved,
  constraints,
  jobPlan: plan,
});
const writes = plannedAssumptionWrites({
  view: clarify,
  facts: unresolved,
  constraints,
});
check(
  "skipped ASSUME_IF_SKIPPED height is planned as assumption fact",
  writes.some(
    (row) =>
      row.key === "deck.height_m" &&
      row.value === DECK_HEIGHT_ASSUMPTION_M &&
      row.source === "assumption"
  )
);

const assumedFacts = [
  ...unresolved,
  fact("deck.height_m", "d1", DECK_HEIGHT_ASSUMPTION_M, "assumption"),
];
const assumedPlan = composeJobPlan({
  workAreas,
  facts: assumedFacts,
  constraints,
  briefText: "New 5 by 4 pine deck.",
});
const refine = composeRefineView({
  briefText: "New 5 by 4 pine deck.",
  qualityLevel: "standard",
  workAreas,
  facts: assumedFacts,
  constraints,
  jobPlan: {
    cards: assumedPlan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      notConfirmed: card.notConfirmed,
    })),
  },
});
const height = [...refine.highValue, ...refine.advanced].filter(
  (row) => row.factKey === "deck.height_m"
);
check("Refine has one height row", height.length === 1);
check(
  "Refine height is 0.6 assumed, not a blank question",
  height[0]?.currentValue === DECK_HEIGHT_ASSUMPTION_M &&
    height[0]?.assumed === true
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

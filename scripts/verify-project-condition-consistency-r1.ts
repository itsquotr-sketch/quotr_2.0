/**
 * EF02-D1 — Clarify and Refine share one consumed Project Condition authority.
 *
 * Run: npx --yes tsx scripts/verify-project-condition-consistency-r1.ts
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import type { EstimateFact } from "../lib/estimate/types";
import {
  consumedProjectConditionAskClass,
  getConsumedProjectConditionDef,
  listConsumedProjectConditionDefs,
} from "../lib/project-conditions/consumed-authority";

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

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const KEYS = [
  "site_access",
  "material_carry_distance",
  "occupied_site",
  "working_hours",
] as const;

console.log("=== EF02-D1 Project Condition consistency ===\n");

check(
  "site_access is ASK_NOW",
  consumedProjectConditionAskClass("site_access") === "ASK_NOW"
);
check(
  "material_carry_distance is ASK_NOW (not Refine-advanced)",
  consumedProjectConditionAskClass("material_carry_distance") === "ASK_NOW"
);
check(
  "occupied_site is ASSUME_IF_SKIPPED",
  consumedProjectConditionAskClass("occupied_site") === "ASSUME_IF_SKIPPED"
);
check(
  "working_hours is ASSUME_IF_SKIPPED",
  consumedProjectConditionAskClass("working_hours") === "ASSUME_IF_SKIPPED"
);

const workAreas = [
  { id: "d1", type: "deck", name: "Deck", status: "confirmed" as const },
];
const facts = [fact("deck.length_m", "d1", 5), fact("deck.width_m", "d1", 4)];
const plan = composeJobPlan({
  workAreas,
  facts,
  constraints: [],
  briefText: "New pine deck.",
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: "New pine deck.",
  qualityLevel: "standard",
  workAreas,
  facts,
  constraints: [],
  jobPlan: plan,
});

for (const key of KEYS) {
  const def = getConsumedProjectConditionDef(key)!;
  const row = [...clarify.candidates, ...clarify.deferred].find(
    (c) => c.constraintKey === key
  );
  check(`${key} canonical def exists`, def != null);
  if (row) {
    check(`${key} Clarify askClass matches canonical`, row.askClass === def.askClass);
    check(
      `${key} Clarify options match registry`,
      JSON.stringify(row.options ?? []) === JSON.stringify([...def.options])
    );
  }
}

const resolvedConstraints = KEYS.map((key) => ({
  key,
  value:
    key === "site_access"
      ? "Easy"
      : key === "material_carry_distance"
        ? "< 10m"
        : "No",
}));
const resolvedPlan = composeJobPlan({
  workAreas,
  facts,
  constraints: resolvedConstraints,
  briefText: "New pine deck.",
});
const refine = composeRefineView({
  briefText: "New pine deck.",
  qualityLevel: "standard",
  workAreas,
  facts,
  constraints: resolvedConstraints,
  jobPlan: {
    cards: resolvedPlan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      notConfirmed: card.notConfirmed,
    })),
  },
});
const carry = [...refine.highValue, ...refine.advanced].find(
  (row) => row.constraintKey === "material_carry_distance"
);
check(
  "Refine carry distance uses the same question as Details",
  carry?.question === getConsumedProjectConditionDef("material_carry_distance")?.question
);
check("Refine carry distance is high_value", carry?.tier === "high_value");

const defs = listConsumedProjectConditionDefs();
check("exactly four consumed Project Condition defs", defs.length === 4);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

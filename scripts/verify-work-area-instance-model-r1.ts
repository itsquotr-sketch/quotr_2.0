/**
 * ESTIMATING-FOUNDATION-02 — Work Area Instance model.
 *
 * Run: npx --yes tsx scripts/verify-work-area-instance-model-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { validateAndFilterExtraction } from "../lib/ai/schema";
import { aiFactsToRows, aiWorkAreasToRows } from "../lib/ai/mappers";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";
import {
  bindFactToWorkAreaId,
  distinguishWorkAreaInstanceLabels,
  nextWorkAreaInstanceLabel,
  shouldInsertWorkAreaInstance,
  existingWorkAreaInstanceKeys,
} from "../lib/work-areas/instances";

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

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const allowed = getAnalysisCapableWorkAreaTypes();
const catalogueTypes = SCOPE_CATALOGUE.map((row) => row.type);

function enrich(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  }).extraction;
}

console.log("=== Schema already stores duplicate kinds ===\n");
const schema = read("supabase/migrations/002_assistant_schema.sql");
check(
  "work_areas has UUID PK and no unique (project_id, type)",
  schema.includes("create table public.work_areas") &&
    !/unique[^\n]*project_id[^\n]*type/i.test(schema)
);
check(
  "facts unique includes work_area_id",
  schema.includes("project_facts_project_work_area_key_idx")
);
check(
  "no migration 055 created",
  !read("docs/architecture/QUOTR_WORK_AREA_INSTANCE_MODEL.md").includes("create 055")
);

console.log("\n=== Repeated bathrooms ===\n");
const ensuite = discoverWorkAreaInstances(
  "Renovate the master ensuite and the main family bathroom."
).filter((row) => row.type === "bathroom");
check("two bathroom instances", ensuite.length === 2, `got ${ensuite.length}`);
check(
  "Master Ensuite + Main Family Bathroom",
  ensuite.some((row) => row.name === "Master Ensuite") &&
    ensuite.some((row) => row.name === "Main Family Bathroom")
);

const downstairs = discoverWorkAreaInstances(
  "Renovate the master ensuite and the downstairs bathroom."
).filter((row) => row.type === "bathroom");
check(
  "Downstairs Bathroom label",
  downstairs.some((row) => row.name === "Downstairs Bathroom") &&
    downstairs.some((row) => row.name === "Master Ensuite")
);

const ensuiteExtract = enrich(
  "Renovate the master ensuite and the main family bathroom."
);
const bathroomNames = ensuiteExtract.workAreas
  .filter((row) => row.type === "bathroom")
  .map((row) => row.name);
check(
  "enrich emits two bathroom work areas",
  bathroomNames.length === 2,
  bathroomNames.join(", ")
);

console.log("\n=== Repeated decks ===\n");
const decks = discoverWorkAreaInstances(
  "Replace the rear deck and build a new small deck at the front entrance."
).filter((row) => row.type === "deck");
check("two deck instances", decks.length === 2, `got ${decks.length}`);
check(
  "Rear Deck + Front Entrance Deck",
  decks.some((row) => row.name === "Rear Deck") &&
    decks.some((row) => row.name === "Front Entrance Deck")
);

console.log("\n=== Stable IDs + independent facts ===\n");
const filtered = validateAndFilterExtraction(
  {
    workAreas: [
      { type: "bathroom", name: "Master Ensuite", confidence: 0.9, rationale: "a" },
      { type: "bathroom", name: "Main Bathroom", confidence: 0.9, rationale: "b" },
    ],
    facts: [
      {
        work_area_type: "bathroom",
        work_area_name: "Master Ensuite",
        key: "bathroom.length_m",
        label: "Length",
        value: 3,
        confidence: 0.9,
      },
      {
        work_area_type: "bathroom",
        work_area_name: "Main Bathroom",
        key: "bathroom.length_m",
        label: "Length",
        value: 2.4,
        confidence: 0.9,
      },
    ],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.9,
    warnings: [],
  },
  allowed,
  catalogueTypes
);
check("schema keeps both bathrooms", filtered.workAreas.length === 2);
const rows = aiWorkAreasToRows({
  output: filtered,
  orgId: "org",
  projectId: "p",
  catalogueByType: new Map(SCOPE_CATALOGUE.map((item) => [item.type, item])),
});
check(
  "insert rows keep distinct names",
  rows.filter((row) => row.type === "bathroom").map((row) => row.name).sort().join("|") ===
    "Main Bathroom|Master Ensuite"
);
const workAreas = [
  { id: "b1", type: "bathroom", name: "Master Ensuite" },
  { id: "b2", type: "bathroom", name: "Main Bathroom" },
];
check(
  "master ensuite fact binds to b1",
  bindFactToWorkAreaId({
    fact: filtered.facts[0]!,
    workAreas,
  }) === "b1"
);
check(
  "main bathroom fact binds to b2",
  bindFactToWorkAreaId({
    fact: filtered.facts[1]!,
    workAreas,
  }) === "b2"
);
const factRows = aiFactsToRows({
  output: filtered,
  orgId: "org",
  projectId: "p",
  workAreaIdByType: new Map([["bathroom", "b1"]]),
  workAreas,
});
check(
  "fact rows stay independent",
  factRows.some((row) => row.work_area_id === "b1" && row.value === 3) &&
    factRows.some((row) => row.work_area_id === "b2" && row.value === 2.4)
);

console.log("\n=== Labels / fallback numbering ===\n");
const numbered = distinguishWorkAreaInstanceLabels([
  { id: "a", type: "bathroom", name: "Bathroom renovation" },
  { id: "b", type: "bathroom", name: "Bathroom renovation" },
]);
check(
  "unlabelled pair becomes Bathroom 1 / Bathroom 2",
  numbered.get("a") === "Bathroom 1" && numbered.get("b") === "Bathroom 2",
  `${numbered.get("a")} / ${numbered.get("b")}`
);
check(
  "manual add second bathroom is Bathroom 2",
  nextWorkAreaInstanceLabel("bathroom", ["Bathroom renovation"]) === "Bathroom 2"
);

console.log("\n=== Manual add duplicate kind ===\n");
const addUi = read("components/assistant/AddWorkAreaDialog.tsx");
const addAction = read("lib/assistant/work-area-actions.ts");
check(
  "Add dialog no longer blocks existing kind",
  addUi.includes("return true") &&
    addUi.includes("Adds another") &&
    !addUi.includes("existing.status === \"excluded\"")
);
check(
  "addWorkAreaToProject inserts another confirmed kind",
  addAction.includes("nextWorkAreaInstanceLabel") &&
    !addAction.includes("is already included in this project")
);
check(
  "analyse insert is instance-keyed",
  read("lib/assistant/actions.ts").includes("shouldInsertWorkAreaInstance")
);

const existing = existingWorkAreaInstanceKeys([
  { type: "bathroom", name: "Master Ensuite" },
]);
check(
  "same type different name is insertable",
  shouldInsertWorkAreaInstance({ type: "bathroom", name: "Main Bathroom" }, existing)
);
check(
  "same type+name is not re-inserted",
  !shouldInsertWorkAreaInstance({ type: "bathroom", name: "Master Ensuite" }, existing)
);
const unnamedPair = aiWorkAreasToRows({
  output: {
    workAreas: [
      { type: "bathroom", confidence: 0.9, rationale: "a" },
      { type: "bathroom", confidence: 0.9, rationale: "b" },
    ],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.9,
    warnings: [],
  },
  orgId: "org",
  projectId: "p",
  catalogueByType: new Map(SCOPE_CATALOGUE.map((item) => [item.type, item])),
});
check(
  "unnamed duplicate kind gets distinct insert names",
  unnamedPair.length === 2 && unnamedPair[0]!.name !== unnamedPair[1]!.name,
  unnamedPair.map((row) => row.name).join(" | ")
);

console.log("\n=== Job Plan grouping ===\n");
const plan = composeJobPlan({
  workAreas: [
    { id: "b1", type: "bathroom", name: "Master Ensuite", status: "confirmed", sortOrder: 1 },
    { id: "b2", type: "bathroom", name: "Main Bathroom", status: "confirmed", sortOrder: 2 },
  ],
  facts: [],
});
check(
  "Job Plan keeps two bathroom cards",
  plan.cards.length === 2 &&
    plan.cards[0]?.name === "Master Ensuite" &&
    plan.cards[1]?.name === "Main Bathroom"
);

if (failed > 0) {
  console.error(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);

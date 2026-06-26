import { detectDerivedFactConflicts } from "../lib/scopes/derived-fact-conflicts";
import type { ProjectFactRecord } from "../lib/scopes/fact-values";
import type { DerivedFactCandidate } from "../lib/scopes/derived-facts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const projectFacts: ProjectFactRecord[] = [
  {
    key: "deck.area_m2",
    work_area_id: "wa1",
    value: 35,
    source: "ai_extracted",
  },
];

const derivedFacts: DerivedFactCandidate[] = [
  {
    work_area_id: "wa1",
    key: "deck.area_m2",
    label: "Deck area",
    value: 32,
    unit: "m²",
    source: "derived",
  },
];

const conflicts = detectDerivedFactConflicts(projectFacts, derivedFacts);
assert(conflicts.length === 1, "Material deck area conflict detected");
assert(
  conflicts[0]?.warning.includes("35"),
  "Conflict warning mentions original extracted value"
);
assert(
  conflicts[0]?.warning.includes("32"),
  "Conflict warning mentions derived value"
);

const noConflictFacts: ProjectFactRecord[] = [
  {
    key: "deck.area_m2",
    work_area_id: "wa1",
    value: 32,
    source: "ai_extracted",
  },
];
assert(
  detectDerivedFactConflicts(noConflictFacts, derivedFacts).length === 0,
  "Within tolerance — no conflict"
);

console.log("\nDerived fact conflict checks passed.");

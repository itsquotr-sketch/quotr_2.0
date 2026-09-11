/**
 * EF02-FINAL-R3-B — repeated Internal Walls Analyse + persist retry safety.
 *
 * Run: npx --yes tsx scripts/verify-repeated-work-area-analysis-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { buildBriefExtractionFromModelText } from "../lib/ai/brief-extraction-result";
import {
  aiFactsToRows,
  aiWorkAreasToRows,
  dedupePendingFactRows,
  factDedupeKey,
  type ProjectFactInsertRow,
} from "../lib/ai/mappers";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { rollbackThisAttemptAnalyseState } from "../lib/assistant/analyse-persist-safety";
import { COORDINATION_ORIGINAL_BRIEF } from "../lib/estimate/internal-walls-brief";
import { resolveInternalWallsWallTypes } from "../lib/estimate/internal-walls-wall-types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";
import { bindFactToWorkAreaId } from "../lib/work-areas/instances";
import { internalWallsIdentityInvariantFixtures } from "./lib/internal-walls-iw-id-invariants";

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

const allowed = getAnalysisCapableWorkAreaTypes();
const catalogueTypes = SCOPE_CATALOGUE.map((row) => row.type);
const catalogueByType = new Map(SCOPE_CATALOGUE.map((item) => [item.type, item]));

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

function enrich(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  }).extraction;
}

function iwNames(brief: string): string[] {
  return discoverWorkAreaInstances(brief)
    .filter((row) => row.type === "internal_walls")
    .map((row) => row.name);
}

function simulateInsertAndBind(output: AIExtractionOutput) {
  const workAreaInsertRows = aiWorkAreasToRows({
    output,
    orgId: "org-1",
    projectId: "proj-1",
    catalogueByType,
  });
  const workAreas = workAreaInsertRows.map((row, index) => ({
    id: `wa-${index + 1}`,
    type: row.type,
    name: row.name,
    status: "suggested" as const,
  }));
  const factRows = aiFactsToRows({
    output,
    orgId: "org-1",
    projectId: "proj-1",
    workAreaIdByType: new Map(workAreas.map((row) => [row.type, row.id])),
    workAreas,
  });
  return { workAreas, factRows };
}

console.log("=== A. one Internal Walls / two Wall Types ===\n");

const originalIw = iwNames(COORDINATION_ORIGINAL_BRIEF);
check("A: original brief is ONE Internal Walls instance", originalIw.length === 1);

const liningTypes = iwNames(
  "Three internal walls with two different lining types: standard GIB both sides and Standard/Aqualine."
);
check(
  "A: lining variants do not split Work Areas",
  liningTypes.length === 1 && liningTypes[0] === "Internal walls",
  liningTypes.join(" | ")
);
check(
  "A: timber vs steel specs do not split Work Areas",
  iwNames("Two 90x45 walls and one steel wall in the same partition package.").length === 1
);
check(
  "A: one package of different Wall Types stays one instance",
  iwNames("One partition package containing different Wall Types.").length === 1
);

const originalEnrich = enrich(COORDINATION_ORIGINAL_BRIEF);
const originalSim = simulateInsertAndBind(originalEnrich);
const originalIwRows = originalSim.workAreas.filter((row) => row.type === "internal_walls");
check("A: enrich emits one Internal Walls row", originalIwRows.length === 1);
const originalResolved = resolveInternalWallsWallTypes({
  facts: originalSim.factRows
    .filter((row) => row.work_area_id === originalIwRows[0]?.id)
    .map((row) => ({
      key: row.key,
      work_area_id: row.work_area_id,
      value: row.value,
    })),
  workAreaId: originalIwRows[0]?.id ?? "",
});
check(
  "A: two nested Wall Types on that instance",
  originalResolved.types.length === 2,
  `got ${originalResolved.types.length}`
);

const rawOnePackage = buildBriefExtractionFromModelText({
  rawText: JSON.stringify({
    workAreas: [
      { type: "demolition", confidence: 0.9, rationale: "Remove 3 walls." },
      { type: "internal_walls", confidence: 0.88, rationale: "GIB both sides." },
      { type: "internal_walls", confidence: 0.82, rationale: "GIB / Aqualine." },
    ],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.87,
    warnings: [],
  }),
  briefText: COORDINATION_ORIGINAL_BRIEF,
  allowedTypes: allowed,
  catalogueTypes,
});
check(
  "A: raw two unnamed IW proposals collapse to one (EF02-B)",
  rawOnePackage.output.workAreas.filter((row) => row.type === "internal_walls").length === 1
);

console.log("\n=== B. two location / package Internal Walls instances ===\n");

const fixtureB =
  "Internal wall works are split into two separate packages: Ground Floor Partitions and Upstairs Partitions. Both packages are new timber framed partitions.";
const bNames = iwNames(fixtureB);
check(
  "B: Ground Floor Partitions + Upstairs Partitions",
  bNames.length === 2 &&
    bNames.includes("Ground Floor Partitions") &&
    bNames.includes("Upstairs Partitions"),
  bNames.join(" | ")
);

const examplesShouldSplit: Array<{ brief: string; expect: string[] }> = [
  {
    brief: "Ground floor partitions and upstairs partitions",
    expect: ["Ground Floor Partitions", "Upstairs Partitions"],
  },
  {
    brief:
      "Internal walls to the ground floor and separate internal walls upstairs",
    expect: ["Ground Floor Internal Walls", "Upstairs Internal Walls"],
  },
  {
    brief: "Two separate partition packages: Ground Floor and Level 1",
    expect: ["Ground Floor Partitions", "Level 1 Partitions"],
  },
];
for (const row of examplesShouldSplit) {
  const names = iwNames(row.brief);
  check(
    `B: split — ${row.brief.slice(0, 48)}…`,
    names.length === 2 &&
      row.expect.every((name) => names.includes(name)),
    names.join(" | ")
  );
}

const bEnrich = enrich(fixtureB);
const bIw = bEnrich.workAreas.filter((row) => row.type === "internal_walls");
check("B: enrich keeps two Internal Walls instances", bIw.length === 2, bIw.map((row) => row.name).join(" | "));
check(
  "B: distinct names / instance keys",
  new Set(bIw.map((row) => (row.name ?? "").toLowerCase())).size === 2
);

const rawTwoPackages = buildBriefExtractionFromModelText({
  rawText: JSON.stringify({
    workAreas: [
      { type: "internal_walls", name: "Internal walls", confidence: 0.9, rationale: "Ground." },
      { type: "internal_walls", name: "Internal walls", confidence: 0.88, rationale: "Upstairs." },
    ],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.9,
    warnings: [],
  }),
  briefText: fixtureB,
  allowedTypes: allowed,
  catalogueTypes,
});
const rawTwoIw = rawTwoPackages.output.workAreas.filter((row) => row.type === "internal_walls");
check(
  "B: discovery TWO does not type-dedupe raw same-type rows into one",
  rawTwoIw.length === 2,
  rawTwoIw.map((row) => row.name).join(" | ")
);

console.log("\n=== C. facts bind to the correct workAreaId ===\n");

const fixtureC =
  "Internal wall works are split into two separate packages: Ground Floor Partitions and Upstairs Partitions. Ground Floor Partitions: 90x45 timber, 10m long and 2.4m high. Upstairs Partitions: 90x45 timber, 6m long and 2.7m high.";
const cEnrich = enrich(fixtureC);
const cSim = simulateInsertAndBind(cEnrich);
const ground = cSim.workAreas.find((row) => row.name === "Ground Floor Partitions");
const upstairs = cSim.workAreas.find((row) => row.name === "Upstairs Partitions");
check("C: two distinct workAreaIds", Boolean(ground && upstairs && ground.id !== upstairs.id));

const groundLength = cSim.factRows.find(
  (row) => row.work_area_id === ground?.id && row.key === "internal_walls.length_lm"
);
const upstairsLength = cSim.factRows.find(
  (row) => row.work_area_id === upstairs?.id && row.key === "internal_walls.length_lm"
);
const groundHeight = cSim.factRows.find(
  (row) => row.work_area_id === ground?.id && row.key === "internal_walls.height_m"
);
const upstairsHeight = cSim.factRows.find(
  (row) => row.work_area_id === upstairs?.id && row.key === "internal_walls.height_m"
);
check(
  "C: ground length 10m on ground instance",
  groundLength?.value === 10,
  String(groundLength?.value)
);
check(
  "C: upstairs length 6m on upstairs instance",
  upstairsLength?.value === 6,
  String(upstairsLength?.value)
);
check(
  "C: heights stay instance-scoped 2.4 / 2.7",
  groundHeight?.value === 2.4 && upstairsHeight?.value === 2.7,
  `${String(groundHeight?.value)} / ${String(upstairsHeight?.value)}`
);

const ambiguous = bindFactToWorkAreaId({
  fact: {
    work_area_type: "internal_walls",
    key: "internal_walls.wall_types",
  },
  workAreas: [
    { id: "iw-1", type: "internal_walls", name: "Ground Floor Partitions" },
    { id: "iw-2", type: "internal_walls", name: "Upstairs Partitions" },
  ],
});
check(
  "C: unnamed same-key fact is not silently bound to ofType[0]",
  ambiguous == null
);

const namedGround = bindFactToWorkAreaId({
  fact: {
    work_area_type: "internal_walls",
    work_area_name: "Ground Floor Partitions",
    key: "internal_walls.wall_types",
  },
  workAreas: [
    { id: "iw-1", type: "internal_walls", name: "Ground Floor Partitions" },
    { id: "iw-2", type: "internal_walls", name: "Upstairs Partitions" },
  ],
});
check("C: named fact binds to Ground Floor id", namedGround === "iw-1");

console.log("\n=== D. batch dedupe + distinct instance keys ===\n");

const dupes: ProjectFactInsertRow[] = [
  {
    org_id: "o",
    project_id: "p",
    work_area_id: "wa-1",
    key: "internal_walls.wall_types",
    label: "Wall types",
    value: [{ id: "first" }],
    unit: null,
    source: "ai_extracted",
    confidence: 0.8,
  },
  {
    org_id: "o",
    project_id: "p",
    work_area_id: "wa-1",
    key: "internal_walls.wall_types",
    label: "Wall types",
    value: [{ id: "second" }],
    unit: null,
    source: "ai_extracted",
    confidence: 0.9,
  },
  {
    org_id: "o",
    project_id: "p",
    work_area_id: "wa-2",
    key: "internal_walls.wall_types",
    label: "Wall types",
    value: [{ id: "other" }],
    unit: null,
    source: "ai_extracted",
    confidence: 0.9,
  },
];
const deduped = dedupePendingFactRows(dupes);
check(
  "D: same instance/key last-write-wins (no unique-fail batch)",
  deduped.filter((row) => row.work_area_id === "wa-1").length === 1 &&
    (deduped.find((row) => row.work_area_id === "wa-1")?.value as { id: string }[])[0]?.id ===
      "second"
);
check(
  "D: same key on different workAreaIds remains two rows",
  deduped.length === 2 &&
    factDedupeKey("wa-1", "internal_walls.wall_types") !==
      factDedupeKey("wa-2", "internal_walls.wall_types")
);

console.log("\n=== E/F/G. failed Analyse rollback + retry ===\n");

const firstAttempt = simulateInsertAndBind(bEnrich);
const afterFail = rollbackThisAttemptAnalyseState({
  workAreas: [
    { id: "prior", type: "demolition", name: "Demolition / strip-out", status: "confirmed" },
    ...firstAttempt.workAreas,
  ],
  factWorkAreaIds: firstAttempt.factRows
    .map((row) => row.work_area_id)
    .filter((id): id is string => Boolean(id)),
  stage: "brief",
  insertedWorkAreaIds: firstAttempt.workAreas.map((row) => row.id),
});
check(
  "F: this-attempt suggested Internal Walls are removed",
  afterFail.workAreas.every((row) => row.id === "prior") &&
    afterFail.workAreas.length === 1
);
check(
  "F: this-attempt facts are not left behind",
  afterFail.factWorkAreaIds.length === 0
);
check("F: stage stays brief", afterFail.stage === "brief");
check(
  "F: prior confirmed Demolition is preserved",
  afterFail.workAreas.some((row) => row.id === "prior" && row.status === "confirmed")
);

const retry = simulateInsertAndBind(bEnrich);
check(
  "G: retry from clean state still yields two Internal Walls",
  retry.workAreas.filter((row) => row.type === "internal_walls").length === 2
);
check(
  "G: retry does not stack duplicate suggestion names",
  new Set(
    retry.workAreas
      .filter((row) => row.type === "internal_walls")
      .map((row) => row.name.toLowerCase())
  ).size === 2
);

const actionsSrc = read("lib/assistant/actions.ts");
check(
  "F: Analyse rolls back this-attempt suggested Work Areas on persist failure",
  actionsSrc.includes("rollbackThisAttemptSuggestedWorkAreas") &&
    actionsSrc.includes("persist_facts") &&
    actionsSrc.includes("fact insert failed")
);
check(
  "F: persist failure class is logged, user copy stays generic",
  actionsSrc.includes("UNKNOWN_ANALYSIS_ERROR") &&
    read("lib/ai/analyse-job-contract.ts").includes("persist_facts") &&
    read("lib/ai/analyse-job-contract.ts").includes(
      "return UNKNOWN_ANALYSIS_ERROR"
    )
);

console.log("\n=== H/I. Bathroom / Deck discovery regression ===\n");

const bathrooms = discoverWorkAreaInstances(
  "Renovate the master ensuite and the family bathroom."
).filter((row) => row.type === "bathroom");
check(
  "H: Master Ensuite + Family Bathroom still 2 instances",
  bathrooms.length === 2 &&
    bathrooms.some((row) => row.name === "Master Ensuite") &&
    bathrooms.some((row) => row.name === "Family Bathroom"),
  bathrooms.map((row) => row.name).join(" | ")
);

const decks = discoverWorkAreaInstances(
  "Replace the rear deck and build a new front deck."
).filter((row) => row.type === "deck");
check(
  "I: Rear Deck + Front Deck still 2 instances",
  decks.length === 2 &&
    decks.some((row) => row.name === "Rear Deck") &&
    decks.some((row) => row.name === "Front Deck"),
  decks.map((row) => row.name).join(" | ")
);

const officeTenancy = iwNames(
  "Build new partitions in the ground-floor office and separately fit out the upstairs tenancy with new partitions."
);
check(
  "office / tenancy labels preserved",
  officeTenancy.length === 2 &&
    officeTenancy.includes("Ground Floor Office") &&
    officeTenancy.includes("Upstairs Tenancy"),
  officeTenancy.join(" | ")
);

console.log("\n=== Numerical output protection (IW-ID fixture D) ===\n");

const live = internalWallsIdentityInvariantFixtures();
check("IW-ID Fixture D is present", Boolean(live.D));
check(
  "IW-ID Fixture D labour 12.96",
  live.D.labourHours === 12.96,
  String(live.D.labourHours)
);
check(
  "IW-ID Fixture D cost 1965.06",
  live.D.commercial.recommendedCost === 1965.06,
  String(live.D.commercial.recommendedCost)
);
check(
  "IW-ID Fixture D sell 2650.72",
  live.D.commercial.recommendedSell === 2650.72,
  String(live.D.commercial.recommendedSell)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

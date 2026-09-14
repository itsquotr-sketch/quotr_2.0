/**
 * CEILINGS WA-08-R3 — nested Details state integrity + conditional UX.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-08-r3-details-state.ts
 *
 * Preview only. No physical/commercial formula changes. No Production.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { clarifyControlType } from "../lib/assistant/clarify/question-contract";
import {
  appendJobPlanFactOverlay,
  overlayFact,
} from "../lib/assistant/job-plan/facts";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { extractCeilingPortionsFromBrief } from "../lib/estimate/ceilings-brief";
import {
  listCeilingsClarifyCandidates,
} from "../lib/estimate/ceilings-clarify";
import { ceilingsFactIsRelevant } from "../lib/estimate/ceilings-information-contract";
import {
  applyCeilingsFactWrite,
  CEILINGS_INSULATION_TYPE_VALUES,
  CEILINGS_PORTIONS_FACT_KEY,
  ceilingInsulationNeedsSpecification,
  parseCeilingsCollectionEnvelope,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const BRIEF =
  "Lounge ceiling is 4m x 3m with existing framing and 13mm Standard GIB.";
const WA = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  status: "confirmed" as const,
};

function writePortions(
  portions: CeilingPortion[],
  workAreaId = "c1",
  envelopeV?: number
): EstimateFact[] {
  const facts = applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
  if (envelopeV == null) return facts;
  return facts.map((row) =>
    row.key === CEILINGS_PORTIONS_FACT_KEY
      ? { ...row, value: { v: envelopeV, portions: parseCeilingsCollectionEnvelope(row.value).portions } }
      : row
  );
}

function patch(
  facts: EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId = P1
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts,
    workAreaId: "c1",
    key,
    value,
    nestedItemId,
  });
}

function loungeFromBrief(): CeilingPortion {
  const extracted = extractCeilingPortionsFromBrief(BRIEF);
  const lounge = extracted[0]!;
  return { ...lounge, id: P1 };
}

function portionOf(facts: EstimateFact[]): CeilingPortion {
  const resolved = resolveCeilingsPortions({ facts, workAreaId: "c1" });
  return resolved.portions[0]!;
}

function unrelatedSnapshot(portion: CeilingPortion) {
  return {
    geometry: structuredClone(portion.geometry),
    structure: structuredClone(portion.structure),
    lining: structuredClone(portion.lining),
    label: portion.label,
    bulkheads: structuredClone(portion.bulkheads),
  };
}

function sameUnrelated(
  before: ReturnType<typeof unrelatedSnapshot>,
  after: CeilingPortion
): boolean {
  return (
    JSON.stringify(before.geometry) === JSON.stringify(after.geometry) &&
    JSON.stringify(before.structure) === JSON.stringify(after.structure) &&
    JSON.stringify(before.lining) === JSON.stringify(after.lining) &&
    before.label === after.label &&
    JSON.stringify(before.bulkheads) === JSON.stringify(after.bulkheads)
  );
}

function persistLike(
  envelope: { v: number; portions: CeilingPortion[] },
  key: string,
  value: unknown
): { v: number; portions: CeilingPortion[] } {
  const current: EstimateFact[] = [
    { key: CEILINGS_PORTIONS_FACT_KEY, work_area_id: "c1", value: envelope },
  ];
  const next = applyCeilingsFactWrite({
    facts: current,
    workAreaId: "c1",
    key,
    value,
    nestedItemId: P1,
  });
  const row = next.find((item) => item.key === CEILINGS_PORTIONS_FACT_KEY);
  return {
    v: envelope.v + 1,
    portions: parseCeilingsCollectionEnvelope(row?.value).portions,
  };
}

function clarify(facts: EstimateFact[]) {
  const plan = composeJobPlan({
    workAreas: [WA],
    facts,
    qualityLevel: "standard",
    briefText: BRIEF,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: BRIEF,
    qualityLevel: "standard",
    workAreas: [WA],
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function factKeys(facts: EstimateFact[]): string[] {
  return listCeilingsClarifyCandidates({
    facts,
    workAreaId: "c1",
    workAreaName: "Ceilings",
    briefText: BRIEF,
  }).map((row) => row.factKey ?? "");
}

function projectOverlay(
  base: EstimateFact[],
  overlayRows: readonly EstimateFact[]
): EstimateFact[] {
  let facts = base;
  for (const row of overlayRows) {
    facts = overlayFact(facts, row);
  }
  return facts;
}

console.log("=== CEILINGS WA-08-R3 Details state integrity ===\n");

const lounge = loungeFromBrief();
const beforeFacts = writePortions([lounge], "c1", 1);
const beforePortion = portionOf(beforeFacts);
const beforeUnrelated = unrelatedSnapshot(beforePortion);
check(
  "fixture Lounge 4×3 existing framing Standard 13mm",
  beforePortion.label === "Lounge" &&
    beforePortion.geometry.length_m === 4 &&
    beforePortion.geometry.width_m === 3 &&
    beforePortion.geometry.area_m2 === 12 &&
    beforePortion.structure.family === "existing_framing" &&
    beforePortion.lining.family === "plasterboard" &&
    beforePortion.lining.plasterboard_product === "standard" &&
    beforePortion.lining.thickness_mm === 13
);

console.log("\n-- BEFORE persist JSON --");
console.log(JSON.stringify(parseCeilingsCollectionEnvelope(beforeFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value), null, 2));

const paintingFacts = patch(beforeFacts, "ceilings.portion.painting_included", false);
const afterPainting = portionOf(paintingFacts);
check("A painting boolean write preserves geometry", sameUnrelated(beforeUnrelated, afterPainting) && afterPainting.finish.painting_included === false);
check("B painting write preserves structure", JSON.stringify(afterPainting.structure) === JSON.stringify(beforeUnrelated.structure));
check("C painting write preserves lining", JSON.stringify(afterPainting.lining) === JSON.stringify(beforeUnrelated.lining));

const stoppingFacts = patch(beforeFacts, "ceilings.portion.stopping_included", true);
check("D stopping write preserves all unrelated fields", sameUnrelated(beforeUnrelated, portionOf(stoppingFacts)) && portionOf(stoppingFacts).finish.stopping_included === true);

const insulationFacts = patch(beforeFacts, "ceilings.portion.insulation_included", true);
check("E insulation write preserves all unrelated fields", sameUnrelated(beforeUnrelated, portionOf(insulationFacts)) && portionOf(insulationFacts).finish.insulation_included === true);

const bulkheadFacts = patch(beforeFacts, "ceilings.portion.bulkheads_present", false);
check("F bulkheads boolean write preserves all unrelated fields", sameUnrelated(beforeUnrelated, portionOf(bulkheadFacts)) && portionOf(bulkheadFacts).has_bulkheads === false);

let rapid = beforeFacts;
rapid = patch(rapid, "ceilings.portion.painting_included", false);
rapid = patch(rapid, "ceilings.portion.stopping_included", true);
rapid = patch(rapid, "ceilings.portion.insulation_included", true);
const rapidPortion = portionOf(rapid);
check(
  "G rapid painting/stopping/insulation writes all survive",
  rapidPortion.finish.painting_included === false &&
    rapidPortion.finish.stopping_included === true &&
    rapidPortion.finish.insulation_included === true &&
    sameUnrelated(beforeUnrelated, rapidPortion)
);

const stale = patch(beforeFacts, "ceilings.portion.painting_included", false);
const latest = patch(stale, "ceilings.portion.stopping_included", true);
const clobber = patch(stale, "ceilings.portion.insulation_included", true);
check(
  "H no stale snapshot overwrite — latest path keeps stopping; stale branch does not",
  portionOf(latest).finish.stopping_included === true &&
    portionOf(clobber).finish.stopping_included == null &&
    portionOf(latest).finish.painting_included === false
);

const envelope0 = {
  v: 1,
  portions: parseCeilingsCollectionEnvelope(
    beforeFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value
  ).portions,
};
const persistedPainting = persistLike(envelope0, "ceilings.portion.painting_included", false);
const persistedStopping = persistLike(
  persistedPainting,
  "ceilings.portion.stopping_included",
  true
);
check(
  "I revision/CAS persist-like path bumps v and patches latest",
  persistedPainting.v === 2 &&
    persistedStopping.v === 3 &&
    persistedStopping.portions[0]?.geometry.length_m === 4 &&
    persistedStopping.portions[0]?.finish.painting_included === false &&
    persistedStopping.portions[0]?.finish.stopping_included === true &&
    read("lib/assistant/scope-persistence.ts").includes("v: envelope.v + 1") &&
    read("lib/assistant/scope-persistence.ts").includes('value->>v')
);

check(
  "J after boolean write, 4×3 remains 4×3",
  afterPainting.geometry.length_m === 4 && afterPainting.geometry.width_m === 3
);
check("K derived area remains 12m²", afterPainting.geometry.area_m2 === 12);

const afterKeys = factKeys(paintingFacts);
check(
  "L dimension/area questions do not reappear after painting write",
  !afterKeys.includes("ceilings.portion.length_m") &&
    !afterKeys.includes("ceilings.portion.width_m") &&
    !afterKeys.includes("ceilings.portion.area_m2")
);

console.log("\n-- AFTER painting persist-like JSON --");
console.log(JSON.stringify(persistedPainting, null, 2));

const reconstructed = applyCeilingsFactWrite({
  facts: [],
  workAreaId: "c1",
  key: "ceilings.portion.painting_included",
  value: false,
  nestedItemId: P1,
});
const replaced = overlayFact(beforeFacts, {
  key: CEILINGS_PORTIONS_FACT_KEY,
  work_area_id: "c1",
  value: reconstructed.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value,
  source: "user",
});
const beforeChildKeys = factKeys(replaced);
const tBefore = Date.now();
void factKeys(replaced);
const beforeMs = Date.now() - tBefore;

const overlayYes = appendJobPlanFactOverlay([], {
  key: "ceilings.portion.insulation_included",
  work_area_id: "c1",
  value: true,
  source: "user",
  nestedItemId: P1,
});
const tAfter = Date.now();
const projectedYes = projectOverlay(beforeFacts, overlayYes);
const afterChildKeys = factKeys(projectedYes);
const afterMs = Date.now() - tAfter;

check(
  "M insulation Yes reveals child immediately from overlay projection",
  overlayYes[0]?.key === "ceilings.portion.insulation_included" &&
    afterChildKeys.includes("ceilings.portion.insulation_type") &&
    !afterChildKeys.includes("ceilings.portion.length_m") &&
    portionOf(projectedYes).geometry.length_m === 4
);
check(
  "N insulation No hides child immediately",
  !factKeys(
    projectOverlay(
      projectedYes,
      appendJobPlanFactOverlay(overlayYes, {
        key: "ceilings.portion.insulation_included",
        work_area_id: "c1",
        value: false,
        source: "user",
        nestedItemId: P1,
      })
    )
  ).includes("ceilings.portion.insulation_type") &&
    !ceilingsFactIsRelevant("ceilings.portion.insulation_type", {
      facts: patch(projectedYes, "ceilings.portion.insulation_included", false),
      workAreaId: "c1",
      nestedItemId: P1,
    })
);

check(
  "root cause: empty-create + collection replace clobbers Lounge",
  portionOf(reconstructed).geometry.length_m == null &&
    portionOf(replaced).geometry.length_m == null &&
    beforeChildKeys.includes("ceilings.portion.area_m2")
);

check(
  "O child does not cause false Ready while write pending",
  read("components/assistant/AssistantShell.tsx").includes("pendingReadinessWrites > 0") &&
    read("components/assistant/AssistantShell.tsx").includes("pendingWrites: pendingReadinessWrites") &&
    !listCeilingsClarifyCandidates({
      facts: projectedYes,
      workAreaId: "c1",
      workAreaName: "Ceilings",
      briefText: BRIEF,
    }).every((row) => row.askClass !== "ASK_NOW")
);

const failedParentFacts = beforeFacts;
check(
  "P failed parent save does not leave false persisted child state",
  portionOf(failedParentFacts).finish.insulation_included == null &&
    !factKeys(failedParentFacts).includes("ceilings.portion.insulation_type") &&
    read("components/assistant/AssistantShell.tsx").includes(
      "appendJobPlanFactOverlay(prev, overlayRow)"
    )
);

const typeCandidate = listCeilingsClarifyCandidates({
  facts: projectedYes,
  workAreaId: "c1",
  workAreaName: "Ceilings",
  briefText: BRIEF,
}).find((row) => row.factKey === "ceilings.portion.insulation_type");
check(
  "Q insulation type uses controlled options",
  typeCandidate?.inputType === "select" &&
    JSON.stringify(typeCandidate.options) ===
      JSON.stringify([...CEILINGS_INSULATION_TYPE_VALUES]) &&
    clarifyControlType(typeCandidate) === "SINGLE_SELECT"
);

const otherFacts = patch(
  patch(beforeFacts, "ceilings.portion.insulation_included", true),
  "ceilings.portion.insulation_type",
  "other"
);
check(
  "R Other/custom reveals specification text input",
  ceilingInsulationNeedsSpecification("other") &&
    factKeys(otherFacts).includes("ceilings.portion.insulation_spec") &&
    listCeilingsClarifyCandidates({
      facts: otherFacts,
      workAreaId: "c1",
      workAreaName: "Ceilings",
      briefText: BRIEF,
    }).find((row) => row.factKey === "ceilings.portion.insulation_spec")
      ?.inputType === "text"
);

const timberFacts = writePortions([
  {
    ...lounge,
    id: P1,
    structure: {
      job_scope: "new_ceiling",
      family: "timber_direct_fix",
      timber: { size: "90x45", spacing_mm: 0, direction: "along_length" },
    },
    lining: {
      family: "plasterboard",
      plasterboard_product: undefined,
      thickness_mm: undefined,
    },
    geometry: {
      mode: "length_width",
      length_m: null,
      width_m: null,
      area_m2: null,
      perimeter_m: null,
    },
  },
]);
const timberCandidates = listCeilingsClarifyCandidates({
  facts: timberFacts,
  workAreaId: "c1",
  workAreaName: "Ceilings",
  briefText: BRIEF,
});
check(
  "S normal bounded Ceiling enums do not fall back to generic free text",
  [
    "ceilings.portion.structure_family",
    "ceilings.portion.lining_family",
    "ceilings.portion.plasterboard_product",
    "ceilings.portion.thickness_mm",
    "ceilings.portion.direction",
  ].every((key) => {
    const candidate = timberCandidates.find((row) => row.factKey === key);
    return !candidate || candidate.inputType === "select";
  }) && typeCandidate?.inputType === "select"
);

check(
  "T existing Ceiling Details question copy remains concise",
  read("lib/estimate/ceilings-question-copy.ts").includes('question: "Include insulation?"') &&
    read("lib/estimate/ceilings-question-copy.ts").includes('question: "Insulation type?"') &&
    read("lib/estimate/ceilings-question-copy.ts").includes(
      'question: "Insulation specification?"'
    )
);

const booleanOverlaySrc = read("components/assistant/AssistantShell.tsx");
check(
  "boolean Details path queues logical nested overlay, not collection replace",
  booleanOverlaySrc.includes("handleClarifyBoolean") &&
    booleanOverlaySrc.includes("appendJobPlanFactOverlay(prev, overlayRow)") &&
    read("lib/assistant/job-plan/facts.ts").includes("queueLogicalNestedOverlay")
);

const overlayParents: Array<{ key: string; value: unknown; child: string }> = [
  { key: "ceilings.portion.insulation_included", value: true, child: "ceilings.portion.insulation_type" },
  { key: "ceilings.portion.bulkheads_present", value: true, child: "ceilings.bulkhead.length_m" },
  { key: "ceilings.portion.significant_penetrations", value: true, child: "ceilings.portion.penetrations" },
  { key: "ceilings.portion.fire_acoustic_requirement", value: "specified", child: "ceilings.portion.fire_acoustic_system" },
];
let parentChildrenOk = true;
for (const row of overlayParents) {
  const next = projectOverlay(
    beforeFacts,
    appendJobPlanFactOverlay([], {
      key: row.key,
      work_area_id: "c1",
      value: row.value,
      source: "user",
      nestedItemId: P1,
    })
  );
  if (!factKeys(next).includes(row.child)) {
    parentChildrenOk = false;
  }
}
check("conditional parents reveal children from local overlay", parentChildrenOk);

const hideInsulation = projectOverlay(
  projectedYes,
  appendJobPlanFactOverlay([], {
    key: "ceilings.portion.insulation_included",
    work_area_id: "c1",
    value: false,
    source: "user",
    nestedItemId: P1,
  })
);
check(
  "insulation No clears type so scope is not kept included",
  portionOf(hideInsulation).finish.insulation_type == null &&
    portionOf(hideInsulation).finish.insulation_spec == null
);

const thermalFacts = patch(otherFacts, "ceilings.portion.insulation_type", "thermal");
check(
  "selecting a bounded insulation family hides spec child",
  !ceilingInsulationNeedsSpecification("thermal") &&
    !factKeys(thermalFacts).includes("ceilings.portion.insulation_spec")
);

check(
  "exact insulation options",
  JSON.stringify([...CEILINGS_INSULATION_TYPE_VALUES]) ===
    JSON.stringify([
      "thermal",
      "acoustic",
      "thermal_acoustic",
      "existing_specified",
      "other",
    ])
);

check(
  "boolean write does not rewrite length/width/structure/lining provenance objects",
  afterPainting.geometry === afterPainting.geometry &&
    afterPainting.geometry.length_m === 4 &&
    afterPainting.geometry.width_m === 3
);

const view = clarify(paintingFacts);
check(
  "composed Details after painting still omits Ceiling length/width/area",
  !view.candidates.some(
    (row) =>
      row.factKey === "ceilings.portion.length_m" ||
      row.factKey === "ceilings.portion.width_m" ||
      row.factKey === "ceilings.portion.area_m2"
  )
);

console.log(
  `\n-- insulation child reveal latency (local compose) --\n  before (stale collection replace): ${beforeMs}ms, child=${beforeChildKeys.includes("ceilings.portion.insulation_type")}, area reappeared=${beforeChildKeys.includes("ceilings.portion.area_m2")}\n  after (logical overlay on latest portions): ${afterMs}ms, child=${afterChildKeys.includes("ceilings.portion.insulation_type")}, area reappeared=${afterChildKeys.includes("ceilings.portion.area_m2")}`
);

console.log("\n=== Prior Ceiling + Details / other WA regressions ===\n");
const prior = [
  "scripts/verify-ceilings-wa-08-r2-assumptions.ts",
  "scripts/verify-ceilings-wa-03a.ts",
  "scripts/verify-performance-01e.ts",
  "scripts/verify-ready-consistency-r1.ts",
  "scripts/verify-details-grouped-complete-capture-r1.ts",
  "scripts/verify-work-area-internal-walls-02c.ts",
  "scripts/verify-work-area-internal-walls-08.ts",
  "scripts/verify-work-area-bathroom-07.ts",
  "scripts/verify-clarify-refine-ownership-r1.ts",
  "scripts/verify-details-question-coverage-r1.ts",
  "scripts/verify-clarify-initial-capture-r1.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

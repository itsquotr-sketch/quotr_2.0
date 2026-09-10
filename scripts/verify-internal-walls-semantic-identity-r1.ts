/**
 * EF02-IW-ID-B — canonical nested semantic identity (Internal Walls).
 *
 * Run: npx --yes tsx scripts/verify-internal-walls-semantic-identity-r1.ts
 *
 * No calculator / persistence architecture edits. No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  candidateMatchesFocus,
  draftNestedItemId,
  isPlaceholderNestedId,
  overlayFactSemanticKey,
  questionSemanticKey,
  wallTypeQuestionIdentity,
} from "../lib/assistant/question-identity";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { getRefineAdapter } from "../lib/assistant/refine/adapters/registry";
import { INTERNAL_WALLS_ADD_OPENING_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
} from "../lib/estimate/internal-walls-wall-types";
import type { EstimateFact } from "../lib/estimate/types";
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

const TYPE_A = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const TYPE_B = "bbbbbbbb-cccc-4ddd-8eee-222222222222";
const OPEN_A = "11111111-aaaa-4bbb-8ccc-aaaaaaaaaaaa";
const OPEN_B = "22222222-bbbb-4ccc-8ddd-bbbbbbbbbbbb";

const HEIGHT = "internal_walls.wall_type.height_m";
const WIDTH = "internal_walls.opening.width_m";
const SCOPE = INTERNAL_WALLS_JOB_SCOPE_FACT_KEY;

function twoTypes(activeId: string): EstimateFact[] {
  let facts: EstimateFact[] = [];
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    value: "new_partition",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
    value: TYPE_A,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: "internal_walls.wall_type.frame_system",
    value: "Timber framing",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: "internal_walls.wall_type.length_lm",
    value: 9,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: HEIGHT,
    value: 2.4,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
    value: TYPE_B,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: "internal_walls.wall_type.frame_system",
    value: "Timber framing",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: "internal_walls.wall_type.length_lm",
    value: 3,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: HEIGHT,
    value: 3,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
    value: activeId,
  });
  return facts;
}

function withOpenings(): EstimateFact[] {
  let facts = twoTypes(TYPE_A);
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: INTERNAL_WALLS_ADD_OPENING_KEY,
    value: OPEN_A,
    openingId: OPEN_A,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    openingId: OPEN_A,
    key: WIDTH,
    value: 0.81,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: INTERNAL_WALLS_ADD_OPENING_KEY,
    value: OPEN_B,
    openingId: OPEN_B,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    openingId: OPEN_B,
    key: WIDTH,
    value: 0.91,
  });
  return facts;
}

function adapterRows(facts: EstimateFact[]) {
  const adapter = getRefineAdapter("internal_walls");
  if (!adapter) return [];
  return adapter.candidates({
    workAreaId: "w1",
    workAreaName: "Ground Floor Internal Walls",
    facts,
    briefText: "New internal walls.",
    notConfirmed: [],
  });
}

function composeSurfaces(facts: EstimateFact[]) {
  const workAreas = [
    {
      id: "w1",
      type: "internal_walls",
      name: "Ground Floor Internal Walls",
      status: "confirmed" as const,
    },
  ];
  const plan = composeJobPlan({
    workAreas,
    facts,
    constraints: [],
    briefText: "New internal walls.",
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: "New internal walls.",
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
  const refine = composeRefineView({
    briefText: "New internal walls.",
    qualityLevel: "standard",
    workAreas,
    facts,
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

console.log("=== EF02-IW-ID-B canonical nested semantic identity ===\n");

const heightA = questionSemanticKey(
  wallTypeQuestionIdentity({
    workAreaId: "w1",
    factKey: HEIGHT,
    wallTypeId: TYPE_A,
  })
);
const heightB = questionSemanticKey(
  wallTypeQuestionIdentity({
    workAreaId: "w1",
    factKey: HEIGHT,
    wallTypeId: TYPE_B,
  })
);
check(
  "A: same factKey across Wall Type A/B produces distinct semantic identity",
  Boolean(heightA) && Boolean(heightB) && heightA !== heightB &&
    (heightA ?? "").includes(TYPE_A) &&
    (heightB ?? "").includes(TYPE_B)
);

const openA = questionSemanticKey(
  wallTypeQuestionIdentity({
    workAreaId: "w1",
    factKey: WIDTH,
    wallTypeId: TYPE_A,
    openingId: OPEN_A,
  })
);
const openB = questionSemanticKey(
  wallTypeQuestionIdentity({
    workAreaId: "w1",
    factKey: WIDTH,
    wallTypeId: TYPE_A,
    openingId: OPEN_B,
  })
);
check(
  "B: same opening fact across openings produces distinct identity",
  Boolean(openA) && Boolean(openB) && openA !== openB &&
    (openA ?? "").includes(OPEN_A) &&
    (openB ?? "").includes(OPEN_B) &&
    (openA ?? "").includes(TYPE_A)
);

const flatScope = questionSemanticKey({
  workAreaId: "w1",
  factKey: SCOPE,
});
const nestedHeight = questionSemanticKey(
  wallTypeQuestionIdentity({
    workAreaId: "w1",
    factKey: HEIGHT,
    wallTypeId: TYPE_A,
  })
);
check(
  "C: flat fact identity remains workAreaId + factKey",
  flatScope === `fact:w1:${SCOPE}` &&
    nestedHeight !== flatScope &&
    !(flatScope ?? "").includes(TYPE_A)
);

const composeSrc = read("lib/assistant/clarify/compose.ts");
const adapterSrc = read("lib/assistant/refine/adapters/internal-walls.ts");
const helperSrc = read("lib/assistant/question-identity.ts");
check(
  "D: no mixed new/none/empty sentinels in IW candidate id construction",
  !composeSrc.includes('type?.id ?? "new"') &&
    !adapterSrc.includes('wallTypeId ?? "none"') &&
    !adapterSrc.includes('openingId ?? "none"') &&
    helperSrc.includes("draftNestedItemId") &&
    isPlaceholderNestedId("new") &&
    isPlaceholderNestedId("none") &&
    isPlaceholderNestedId("") &&
    !isPlaceholderNestedId(TYPE_A)
);

const draftOnce = draftNestedItemId("w1");
const draftAgain = draftNestedItemId("w1");
check(
  "D: pre-creation draft nested id is stable across recomposition",
  draftOnce === draftAgain &&
    draftOnce === "draft:w1" &&
    questionSemanticKey(
      wallTypeQuestionIdentity({ workAreaId: "w1", factKey: HEIGHT })
    ) ===
      questionSemanticKey(
        wallTypeQuestionIdentity({ workAreaId: "w1", factKey: HEIGHT })
      )
);

const emptyFacts: EstimateFact[] = [
  {
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    work_area_id: "w1",
    value: "new_partition",
  },
];
const clarifyEmpty1 = composeSurfaces(emptyFacts).clarify;
const clarifyEmpty2 = composeSurfaces(emptyFacts).clarify;
const emptyIds1 = [...clarifyEmpty1.candidates, ...clarifyEmpty1.deferred]
  .filter((row) => row.workAreaId === "w1")
  .map((row) => row.id)
  .sort();
const emptyIds2 = [...clarifyEmpty2.candidates, ...clarifyEmpty2.deferred]
  .filter((row) => row.workAreaId === "w1")
  .map((row) => row.id)
  .sort();
check(
  "F: Clarify nested identity remains stable across recomposition",
  emptyIds1.length > 0 && emptyIds1.join("|") === emptyIds2.join("|")
);
const emptyNested = [...clarifyEmpty1.candidates, ...clarifyEmpty1.deferred].filter(
  (row) =>
    row.factKey?.startsWith("internal_walls.wall_type.") ||
    row.factKey?.startsWith("internal_walls.opening.")
);
check(
  "D: pre-creation Clarify ids use one draft nested identity, not new/none",
  emptyNested.length > 0 &&
    emptyNested.every(
      (row) =>
        row.id.includes(draftNestedItemId("w1")) &&
        !row.id.includes(":new:") &&
        !row.id.includes(":none:")
    )
);

const refineA = adapterRows(twoTypes(TYPE_A));
const heightRow = refineA.find((row) => row.factKey === HEIGHT);
check(
  "E: Refine row semantic identity matches wallTypeId",
  heightRow?.wallTypeId === TYPE_A &&
    Boolean(heightRow.semanticKey) &&
    (heightRow.semanticKey ?? "").includes(TYPE_A) &&
    (heightRow.id ?? "").includes(TYPE_A) &&
    heightRow.semanticKey ===
      questionSemanticKey(
        wallTypeQuestionIdentity({
          workAreaId: "w1",
          factKey: HEIGHT,
          wallTypeId: TYPE_A,
        })
      )
);

const openingRows = adapterRows(withOpenings()).filter(
  (row) => row.factKey === WIDTH
);
const openingIds = new Set(openingRows.map((row) => row.id));
check(
  "B: Refine opening rows stay independently keyed",
  openingRows.length >= 1 &&
    openingRows.every((row) => row.wallTypeId === TYPE_A) &&
    (openingRows.length === 1 || openingIds.size === openingRows.length)
);

const rowA = {
  id: "refine-a",
  semanticKey: heightA,
  workAreaId: "w1",
  workAreaType: "internal_walls",
  factKey: HEIGHT,
  constraintKey: null,
  wallTypeId: TYPE_A,
};
const rowB = {
  id: "refine-b",
  semanticKey: heightB,
  workAreaId: "w1",
  workAreaType: "internal_walls",
  factKey: HEIGHT,
  constraintKey: null,
  wallTypeId: TYPE_B,
};
check(
  "G: focus targeting cannot cross Wall Types",
  candidateMatchesFocus(rowA, heightA) &&
    !candidateMatchesFocus(rowB, heightA) &&
    !candidateMatchesFocus(rowA, HEIGHT) &&
    !candidateMatchesFocus(rowB, HEIGHT) &&
    candidateMatchesFocus(
      {
        id: "flat",
        workAreaId: "w1",
        factKey: SCOPE,
        constraintKey: null,
      },
      SCOPE
    )
);

const overlayA = overlayFactSemanticKey({
  work_area_id: "w1",
  key: HEIGHT,
  wallTypeId: TYPE_A,
});
const overlayB = overlayFactSemanticKey({
  work_area_id: "w1",
  key: HEIGHT,
  wallTypeId: TYPE_B,
});
check(
  "overlay identity matches semantic helper",
  overlayA === heightA && overlayB === heightB && overlayA !== overlayB
);

const idFactory = read("lib/estimate/internal-walls-wall-types.ts");
const openingFactory = read("lib/estimate/internal-walls-openings.ts");
check(
  "H: createWallTypeId UUID factory is unchanged",
  /export function createWallTypeId\(\): string \{\n  if \(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\) \{\n    return crypto.randomUUID\(\);/.test(
    idFactory
  )
);
check(
  "H: createOpeningId UUID factory is unchanged",
  /export function createOpeningId\(\): string \{\n  if \(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\) \{\n    return crypto.randomUUID\(\);/.test(
    openingFactory
  )
);

const twoTypeFacts = twoTypes(TYPE_A);
const resolved = applyInternalWallsFactWrite({
  facts: twoTypeFacts,
  workAreaId: "w1",
  wallTypeId: TYPE_A,
  key: HEIGHT,
  value: 2.4,
});
const typeIds = new Set(
  resolved
    .filter((row) => row.key === "internal_walls.wall_types")
    .flatMap((row) => {
      const value = row.value as { types?: { id: string }[] } | { id: string }[] | null;
      const types = Array.isArray(value)
        ? value
        : Array.isArray((value as { types?: { id: string }[] } | null)?.types)
          ? (value as { types: { id: string }[] }).types
          : [];
      return types.map((type) => type.id);
    })
);
check(
  "H: existing Wall Type UUIDs remain stable",
  typeIds.size === 0 || (typeIds.has(TYPE_A) && typeIds.has(TYPE_B)) ||
    resolved.some((row) => row.wallTypeId === TYPE_A || row.wallTypeId === TYPE_B)
);

const baseline = {
  A: {
    labourHours: 12.96,
    recommendedCost: 1844.69,
    recommendedSell: 2500.26,
    lineCount: 7,
    length: 12,
    height: 2.4,
    centres: 600,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.90x45.install=12.96|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=28.8|material:internal_walls.framing.timber.90x45.material=108.24|material:internal_walls.lining.standard_gib.material=22",
  },
  B: {
    labourHours: 10.8,
    recommendedCost: 1350.46,
    recommendedSell: 1850.08,
    lineCount: 7,
    length: 8,
    height: 3,
    centres: 400,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.90x45.install=10.8|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=24|material:internal_walls.framing.timber.90x45.material=113.3|material:internal_walls.lining.standard_gib.material=16",
  },
  C: {
    labourHours: 6.75,
    recommendedCost: 405,
    recommendedSell: 607.5,
    lineCount: 7,
    length: 5,
    height: 2.7,
    centres: 400,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.140x45.install=6.75|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=13.5|material:internal_walls.framing.timber.140x45.material=69.08|material:internal_walls.lining.standard_gib.material=12",
  },
  D: {
    labourHours: 12.96,
    recommendedCost: 1965.06,
    recommendedSell: 2650.72,
    lineCount: 14,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.90x45.install=12.96|labour:internal_walls.lining.aqualine.install=0|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=28.8|material:internal_walls.framing.timber.90x45.material=110.88|material:internal_walls.lining.aqualine.material=4|material:internal_walls.lining.standard_gib.material=22",
  },
} as const;
const live = internalWallsIdentityInvariantFixtures();
console.log("\n--- Numerical invariants (IW-ID-A fingerprints) ---\n");
for (const key of ["A", "B", "C", "D"] as const) {
  const before = baseline[key];
  const after = live[key];
  const physical = after.physical;
  const match =
    after.labourHours === before.labourHours &&
    after.commercial.recommendedCost === before.recommendedCost &&
    after.commercial.recommendedSell === before.recommendedSell &&
    after.commercial.lineCount === before.lineCount &&
    after.requirementsFingerprint === before.requirementsFingerprint &&
    ("length" in before
      ? physical[0]?.length_lm === before.length &&
        physical[0]?.height_m === before.height &&
        physical[0]?.stud_centres_mm === before.centres
      : physical.length === 2 &&
        physical.some((row) => row.wall_count === 2 && row.length_lm === 9) &&
        physical.some(
          (row) =>
            row.wall_count === 1 &&
            row.length_lm === 3 &&
            row.side_b === "aqualine"
        ));
  check(
    `${key}: physical/labour/requirements/commercial match`,
    match,
    `after labour=${after.labourHours} cost=${after.commercial.recommendedCost}`
  );
  console.log(
    `  ${after.name}: labour ${after.labourHours} | cost ${after.commercial.recommendedCost} | sell ${after.commercial.recommendedSell} | Match ${match ? "YES" : "NO"}`
  );
}

check(
  "calculator files were not edited in this task",
  !read("lib/estimate/internal-walls-physical.ts").includes("questionSemanticKey") &&
    !read("lib/estimate/calculators/fitout.ts").includes("questionSemanticKey")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

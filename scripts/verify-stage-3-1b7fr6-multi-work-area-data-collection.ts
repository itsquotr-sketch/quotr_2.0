/**
 * Stage 3.1B.7F-R6 — Multi-Work-Area data collection verification.
 *
 * Run: npx tsx scripts/verify-stage-3-1b7fr6-multi-work-area-data-collection.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SCOPE_RELATIONSHIP_CATALOGUE,
  SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
  evaluateScopeRelationships,
} from "../lib/scope-discovery/catalogue";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../lib/scope-discovery";
import {
  buildQuestionBlockFromProjectState,
  shouldSkipTemplateQuestion,
} from "../lib/scopes/questions";
import { buildFactLookup } from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";
import { buildQuickEstimateAttentionItems } from "../lib/assistant/presentation/quick-estimate-view-model";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`PASS  ${label}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${label}`);
    failed += 1;
  }
}

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

console.log("\n=== Stage 3.1B.7F-R6 — Multi-WA data collection ===\n");

const IDS = {
  project: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  org: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  run: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  wall: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  ceil: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  door: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  floor: "11111111-1111-4111-8111-111111111111",
  paint: "22222222-2222-4222-8222-222222222222",
  plaster: "33333333-3333-4333-8333-333333333333",
  demo: "44444444-4444-4444-8444-444444444444",
};

function evaluate(accepted: { workAreaId: string; type: string }[]) {
  return evaluateScopeRelationships({
    projectId: IDS.project,
    orgId: IDS.org,
    analysisRunId: IDS.run,
    acceptedWorkAreas: accepted,
    facts: [],
    constraints: [],
    sourceSnapshot: {
      briefRevision: "r6",
      noteRevisionSet: "r6",
      factRevisions: "r6",
      constraintRevisions: "r6",
      workAreaRevisions: "r6",
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      providerModelId: "claude-sonnet-4-6",
      formattingRevision: "fmt-1",
    },
    relationships: SCOPE_RELATIONSHIP_CATALOGUE,
  });
}

function hasTitle(result: ReturnType<typeof evaluate>, titlePart: string) {
  return result.suggestions.some((s) =>
    s.proposedTitle.toLowerCase().includes(titlePart.toLowerCase())
  );
}

function hasEdge(result: ReturnType<typeof evaluate>, relationshipId: string) {
  return result.suggestions.some((s) => s.catalogueEdgeId === relationshipId);
}

// ─── BASELINE SCOPE ──────────────────────────────────────────
console.log("BASELINE SCOPE");
const walls = evaluate([{ workAreaId: IDS.wall, type: "internal_walls" }]);
check(
  "Internal walls includes framing/lining baseline",
  hasEdge(walls, "fitout.partitions.framing") &&
    hasEdge(walls, "fitout.partitions.wall_linings")
);
const ceilings = evaluate([{ workAreaId: IDS.ceil, type: "ceilings" }]);
check(
  "Ceilings includes core ceiling install/system baseline",
  hasEdge(ceilings, "fitout.ceilings.system")
);
const doors = evaluate([{ workAreaId: IDS.door, type: "doors" }]);
check(
  "Doors have concise core baseline items",
  hasEdge(doors, "fitout.doors.hardware") || hasTitle(doors, "hardware")
);
const flooring = evaluate([{ workAreaId: IDS.floor, type: "flooring" }]);
check(
  "Flooring has concise core baseline items",
  hasEdge(flooring, "fitout.flooring.prep") ||
    hasEdge(flooring, "fitout.flooring.finish")
);
const painting = evaluate([{ workAreaId: IDS.paint, type: "painting" }]);
check(
  "Painting has concise core baseline items",
  hasEdge(painting, "fitout.painting.prep") &&
    hasEdge(painting, "fitout.painting.finish_coats")
);
const plastering = evaluate([{ workAreaId: IDS.plaster, type: "plastering" }]);
check(
  "Plastering has concise core baseline items",
  hasEdge(plastering, "fitout.plastering.stopping")
);
check(
  "no giant generic catalogue (fitout relationships stay restrained)",
  SCOPE_RELATIONSHIP_CATALOGUE.filter((r) =>
    r.relationshipId.startsWith("fitout.")
  ).length < 40
);
check(
  "catalogue version bumped for R6 baselines",
  SCOPE_RELATIONSHIP_CATALOGUE_VERSION === "scope-relationship-catalogue/v2"
);

const wallsNoLining = evaluateScopeRelationships({
  projectId: IDS.project,
  orgId: IDS.org,
  analysisRunId: IDS.run,
  acceptedWorkAreas: [{ workAreaId: IDS.wall, type: "internal_walls" }],
  facts: [{ key: "internal_walls.wall_lining_type", value: "None" }],
  constraints: [],
  sourceSnapshot: {
    briefRevision: "r6",
    noteRevisionSet: "r6",
    factRevisions: "r6",
    constraintRevisions: "r6",
    workAreaRevisions: "r6",
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    providerModelId: "claude-sonnet-4-6",
    formattingRevision: "fmt-1",
  },
  relationships: SCOPE_RELATIONSHIP_CATALOGUE,
});
check(
  "explicit negatives/user decisions override defaults",
  !hasEdge(wallsNoLining, "fitout.partitions.wall_linings")
);

// ─── QUESTION COVERAGE ───────────────────────────────────────
console.log("\nQUESTION COVERAGE");
const multiWaBlock = buildQuestionBlockFromProjectState({
  project: { quality_level: "standard" },
  confirmedWorkAreas: [
    {
      id: IDS.wall,
      type: "internal_walls",
      name: "Internal walls",
      sort_order: 1,
      status: "confirmed",
    },
    {
      id: IDS.ceil,
      type: "ceilings",
      name: "Ceilings",
      sort_order: 2,
      status: "confirmed",
    },
    {
      id: IDS.door,
      type: "doors",
      name: "Doors",
      sort_order: 3,
      status: "confirmed",
    },
    {
      id: IDS.floor,
      type: "flooring",
      name: "Flooring",
      sort_order: 4,
      status: "confirmed",
    },
    {
      id: IDS.paint,
      type: "painting",
      name: "Painting",
      sort_order: 5,
      status: "confirmed",
    },
    {
      id: IDS.plaster,
      type: "plastering",
      name: "Plastering",
      sort_order: 6,
      status: "confirmed",
    },
  ],
  projectFacts: [],
});
const requiredKeys = multiWaBlock.questions
  .filter((q) => q.required)
  .map((q) => q.key);
check(
  "independent required questions render together (no 12-cap drop)",
  requiredKeys.includes("internal_walls.length_lm") &&
    requiredKeys.includes("ceilings.area_m2") &&
    requiredKeys.includes("doors.count") &&
    requiredKeys.includes("flooring.area_m2") &&
    requiredKeys.includes("painting.location") &&
    requiredKeys.includes("plastering.area_m2")
);
check(
  "internal walls framing is required coverage",
  requiredKeys.includes("internal_walls.framing_type")
);
check(
  "MAX_QUESTIONS hard cap removed from questions.ts",
  !read("lib/scopes/questions.ts").includes("const MAX_QUESTIONS = 12")
);

// ─── DEDUPLICATION ───────────────────────────────────────────
console.log("\nDEDUPLICATION");
const lookup = buildFactLookup([]);
const wa = {
  id: IDS.demo,
  type: "demolition",
  name: "Demolition",
  sort_order: 1,
  status: "confirmed",
};
check(
  "FOUNDATION-R1 demolition.access template removed from Scope Details",
  !getScopeQuestions("demolition").some((t) => t.factKey === "demolition.access")
);
check(
  "FOUNDATION-R1 demolition.carting_distance_m template removed from Scope Details",
  !getScopeQuestions("demolition").some(
    (t) => t.factKey === "demolition.carting_distance_m"
  )
);
check(
  "project-wide access still skipped if a leftover access template is presented",
  shouldSkipTemplateQuestion(
    {
      key: "demolition.access",
      label: "Access",
      questionText: "Access?",
      inputType: "select",
      required: false,
      priority: 1,
      factKey: "demolition.access",
      workAreaType: "demolition",
    },
    wa,
    lookup,
    new Set(["demolition"]),
    {
      quality_level: "standard",
      constraints: [],
    }
  )
);
check(
  "carry constraint still skipped if a leftover carting template is presented",
  shouldSkipTemplateQuestion(
    {
      key: "demolition.carting_distance_m",
      label: "Carting",
      questionText: "Carting?",
      inputType: "number",
      required: false,
      priority: 1,
      factKey: "demolition.carting_distance_m",
      workAreaType: "demolition",
    },
    wa,
    lookup,
    new Set(["demolition"]),
    {
      quality_level: "standard",
      constraints: [],
    }
  )
);
const disposalTemplate = getScopeQuestions("demolition").find(
  (t) => t.factKey === "demolition.disposal_included"
)!;
check(
  "known waste-removal scope suppresses redundant disposal question",
  shouldSkipTemplateQuestion(
    disposalTemplate,
    wa,
    lookup,
    new Set(["demolition", "waste_removal"]),
    { quality_level: "standard" }
  )
);

// ─── HAZMAT ──────────────────────────────────────────────────
console.log("\nHAZMAT");
check(
  "FOUNDATION-R1 demolition hazmat is a Project Condition, not Scope Details",
  !getScopeQuestions("demolition").some(
    (t) => t.factKey === "demolition.hazardous_materials_risk"
  )
);

// ─── ACTION ROUTING ──────────────────────────────────────────
console.log("\nACTION ROUTING");
const attention = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Internal walls",
      workAreaId: IDS.wall,
      label: "Plasterboard type",
      factKey: "internal_walls.plasterboard_type",
      questionId: "q-pb",
      actionable: true,
      reviewTarget: "estimateReview",
    },
    {
      workAreaName: "Doors",
      workAreaId: IDS.door,
      label: "Unsupported calc input",
      actionable: false,
    },
  ],
});
check(
  "attention item maps to Work Area/group/question",
  attention[0]?.workAreaId === IDS.wall &&
    attention[0]?.factKey === "internal_walls.plasterboard_type" &&
    attention[0]?.questionId === "q-pb"
);
check(
  "Review opens estimateReview for mapped Scope Details editors",
  attention[0]?.reviewTarget === "estimateReview"
);
check(
  "no Review target for unmapped/non-actionable item",
  attention[1]?.reviewTarget === undefined &&
    attention[1]?.detail === "More information required"
);
check(
  "no hard-coded scroll-to-top in Review handler",
  /handleReviewAttention[\s\S]*block:\s*"nearest"/.test(
    read("components/assistant/AssistantShell.tsx")
  )
);
check(
  "question DOM targets exist",
  read("components/assistant/ScopeReviewMissingSection.tsx").includes(
    "data-question-id"
  ) &&
    read("components/assistant/QuestionBlock.tsx").includes("data-question-key")
);

// ─── DISCLOSURE ──────────────────────────────────────────────
console.log("\nDISCLOSURE");
check(
  "multi-WA incomplete Work Areas default open (hasMissing)",
  read("components/assistant/ScopeSummaryBlock.tsx").includes(
    "hasMissing"
  ) &&
    (read("components/assistant/ScopeSummaryBlock.tsx").includes(
      "stickyDetailsOpen"
    ) ||
      read("components/assistant/ScopeSummaryBlock.tsx").includes(
        "detailsOpen[workArea.workAreaId] ?? hasMissing"
      ))
);
check(
  "Scope Details groups still use plural unresolved expand",
  read("components/assistant/QuestionBlock.tsx").includes(
    "defaultExpandedQuestionCategories"
  )
);

// ─── PERFORMANCE ─────────────────────────────────────────────
console.log("\nPERFORMANCE");
check(
  "answer commits parallelised",
  read("lib/assistant/actions.ts").includes("Promise.all(commits)")
);
check(
  "constraint single-edit uses startTransition refresh",
  /handleConstraintSave[\s\S]*startTransition[\s\S]*router\.refresh/.test(
    read("components/assistant/AssistantShell.tsx")
  )
);

// ─── AUTHORITY / BOUNDARIES ──────────────────────────────────
console.log("\nAUTHORITY / BOUNDARIES");
const migrations = existsSync(resolve(process.cwd(), "supabase/migrations"))
  ? readdirSync(resolve(process.cwd(), "supabase/migrations"))
  : [];
check(
  "no FOUNDATION-R1 migration (034 branding from later batch is allowed)",
  !migrations.some((f) => /foundation.?r1|035_|036_/i.test(f))
);
check(
  "R6 completion docs present",
  existsSync(
    resolve(
      process.cwd(),
      "docs/implementation/STAGE_3_1B7FR6_MULTI_WORK_AREA_DATA_COLLECTION_COMPLETION.md"
    )
  ) &&
    existsSync(
      resolve(
        process.cwd(),
        "docs/audits/STAGE_3_1B7FR6_MULTI_WORK_AREA_QUESTION_COVERAGE_AUDIT.md"
      )
    ) &&
    existsSync(
      resolve(
        process.cwd(),
        "docs/runbooks/STAGE_3_1B7FR6_COMMERCIAL_FITOUT_RETEST.md"
      )
    )
);
check(
  "completion affirms boundaries",
  /Production Scope Discovery remains \*\*Disabled\*\*/.test(
    read(
      "docs/implementation/STAGE_3_1B7FR6_MULTI_WORK_AREA_DATA_COLLECTION_COMPLETION.md"
    )
  ) &&
    /Stage 3\.2 \*\*not started\*\*/.test(
      read(
        "docs/implementation/STAGE_3_1B7FR6_MULTI_WORK_AREA_DATA_COLLECTION_COMPLETION.md"
      )
    )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

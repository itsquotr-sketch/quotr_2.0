/**
 * Stage 3.1B.7F-R6-R1 — Scope Details eligibility + Specification Budget verify.
 *
 * Run: npx tsx scripts/verify-stage-3-1b7fr6r1-scope-details-specification.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildQuestionBlockFromProjectState } from "../lib/scopes/questions";
import {
  getScopeQuestions,
  resolveQuestionTemplateType,
} from "../lib/scopes/registry";
import { QUALITY_OPTIONS } from "../components/assistant/QualityBlock";
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

console.log("\n=== Stage 3.1B.7F-R6-R1 — Scope Details + Specification ===\n");

const IDS = {
  wall: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ceil: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  door: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  floor: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  paint: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  plaster: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  demo: "11111111-1111-4111-8111-111111111111",
};

const fitoutWas = [
  {
    id: IDS.demo,
    type: "demolition",
    name: "Demolition",
    sort_order: 1,
    status: "confirmed" as const,
  },
  {
    id: IDS.wall,
    type: "internal_walls",
    name: "Internal walls",
    sort_order: 2,
    status: "confirmed" as const,
  },
  {
    id: IDS.ceil,
    type: "ceilings",
    name: "Ceilings",
    sort_order: 3,
    status: "confirmed" as const,
  },
  {
    id: IDS.door,
    type: "doors",
    name: "Doors",
    sort_order: 4,
    status: "confirmed" as const,
  },
  {
    id: IDS.floor,
    type: "flooring",
    name: "Flooring",
    sort_order: 5,
    status: "confirmed" as const,
  },
  {
    id: IDS.paint,
    type: "painting",
    name: "Painting",
    sort_order: 6,
    status: "confirmed" as const,
  },
  {
    id: IDS.plaster,
    type: "plastering",
    name: "Plastering",
    sort_order: 7,
    status: "confirmed" as const,
  },
];

console.log("QUESTION PIPELINE");
const block = buildQuestionBlockFromProjectState({
  project: {
    quality_level: "budget",
    constraints: [
      { key: "site_access", value: "Difficult" },
      { key: "material_carry_distance", value: "10–30m" },
      { key: "working_hours", value: "Restricted" },
    ],
  },
  confirmedWorkAreas: fitoutWas,
  projectFacts: [],
});
const keys = block.questions.map((q) => q.key);
check(
  "confirmed Fitout WAs produce applicable questions",
  block.questions.length >= 20
);
check(
  "unknown inputs remain askable (not zero-question)",
  block.questions.length > 0
);
check(
  "internal walls framing question",
  keys.includes("internal_walls.framing_type")
);
check(
  "ceiling area/system question",
  keys.includes("ceilings.area_m2") && keys.includes("ceilings.structure_type")
);
check(
  "door count/supply question",
  keys.includes("doors.count") && keys.includes("doors.supply_scope")
);
check("flooring area question", keys.includes("flooring.area_m2"));
check(
  "painting coats/location",
  keys.includes("painting.location") && keys.includes("painting.coats_required")
);
check(
  "plastering area/level",
  keys.includes("plastering.area_m2") && keys.includes("plastering.level")
);
check(
  "no hard 12-question cap",
  !read("lib/scopes/questions.ts").includes("const MAX_QUESTIONS = 12") &&
    block.questions.length > 12
);

const known = buildQuestionBlockFromProjectState({
  project: { quality_level: "standard" },
  confirmedWorkAreas: [
    {
      id: IDS.wall,
      type: "internal_walls",
      name: "Internal walls",
      sort_order: 1,
      status: "confirmed",
    },
  ],
  projectFacts: [
    {
      key: "internal_walls.length_lm",
      work_area_id: IDS.wall,
      value: 40,
      source: "user",
    },
    {
      key: "internal_walls.height_m",
      work_area_id: IDS.wall,
      value: 2.4,
      source: "user",
    },
  ],
});
check(
  "known Facts suppress answered measurement questions",
  !known.questions.some((q) => q.key === "internal_walls.length_lm") &&
    known.questions.some((q) => q.key === "internal_walls.framing_type")
);

check(
  "R6 baseline catalogue ids resolve to question templates",
  resolveQuestionTemplateType("partitions") === "internal_walls" &&
    resolveQuestionTemplateType("linings") === "plastering" &&
    getScopeQuestions("partitions").some(
      (t) => t.factKey === "internal_walls.framing_type"
    ) &&
    getScopeQuestions("linings").some((t) => t.factKey === "plastering.area_m2")
);

const aliased = buildQuestionBlockFromProjectState({
  project: { quality_level: "budget" },
  confirmedWorkAreas: [
    {
      id: IDS.wall,
      type: "partitions",
      name: "Internal walls",
      sort_order: 1,
      status: "confirmed",
    },
    {
      id: IDS.plaster,
      type: "linings",
      name: "Plastering",
      sort_order: 2,
      status: "confirmed",
    },
  ],
  projectFacts: [],
});
check(
  "R6 baseline items participate in question gating via aliases",
  aliased.questions.some((q) => q.key === "internal_walls.framing_type") &&
    aliased.questions.some((q) => q.key === "plastering.area_m2")
);

console.log("\nDEDUP");
check(
  "project-wide access/carry/noise not duplicated under WAs",
  !keys.includes("demolition.access") &&
    !keys.includes("demolition.carting_distance_m") &&
    !keys.includes("demolition.noise_hours_restriction")
);

console.log("\nCONSISTENCY / ORPHAN HEAL");
const actions = read("lib/assistant/actions.ts");
check(
  "orphan empty question blocks are deleted before reuse",
  actions.includes("never reuse an orphan empty block") ||
    (actions.includes('count: "exact"') &&
      actions.includes('.delete()') &&
      actions.includes("question_block_id"))
);
check(
  "failed question insert rolls back orphan block",
  actions.includes("QUESTION_INSERT_CHUNK") &&
    /questionsError[\s\S]*question_blocks[\s\S]*delete/.test(actions)
);
check(
  "past-spec saveQuality heals empty Scope Details + persists tier",
  /isStageAtOrBeyond\(stage, "work_area_questions"\)[\s\S]*createDynamicQuestionBlockIfNeeded[\s\S]*quality_level: parsed\.data/.test(
    actions
  )
);
check(
  "past-spec saveQuality only reopens questions when didCreateBlock",
  /reopenQuestions[\s\S]*heal\.didCreateBlock[\s\S]*stage: "work_area_questions"/.test(
    actions
  ) &&
    actions.includes("didCreateBlock: false") &&
    actions.includes("didCreateBlock: true")
);

const attention = buildQuickEstimateAttentionItems({
  missingByWorkArea: [
    {
      workAreaName: "Doors",
      workAreaId: IDS.door,
      label: "Number of doors",
      factKey: "doors.count",
      questionId: "q-doors",
      actionable: true,
      reviewTarget: "estimateReview",
    },
  ],
});
check(
  "attention item with Review has matching canonical question",
  attention[0]?.factKey === "doors.count" &&
    keys.includes("doors.count") &&
    attention[0]?.reviewTarget === "estimateReview"
);

console.log("\nSPECIFICATION");
const qualityValues = QUALITY_OPTIONS.map((o) => o.value);
check(
  "Budget / Standard / Premium are selectable options",
  qualityValues.includes("budget") &&
    qualityValues.includes("standard") &&
    qualityValues.includes("premium")
);
check(
  "canonical enum includes budget in saveQuality schema",
  /qualityLevelSchema[\s\S]*"budget"[\s\S]*"standard"[\s\S]*"premium"/.test(
    actions
  )
);
check(
  "Budget Continue gate shows explicit error (not silent scroll)",
  /handleQualityContinue[\s\S]*Confirm the scope items above before selecting the specification/.test(
    read("components/assistant/AssistantShell.tsx")
  )
);
check(
  "estimate adjustments recognise budget tier",
  read("lib/estimate/adjustments.ts").includes("budget:") &&
    read("lib/scopes/finish-level.ts").includes('case "budget"')
);

console.log("\nBOUNDARIES");
const migrations = existsSync(resolve(process.cwd(), "supabase/migrations"))
  ? readdirSync(resolve(process.cwd(), "supabase/migrations"))
  : [];
check(
  "no FOUNDATION-R1 migration (034 branding from later batch is allowed)",
  !migrations.some((f) => /foundation.?r1|035_|036_/i.test(f))
);
check(
  "R6-R1 docs present",
  existsSync(
    resolve(
      process.cwd(),
      "docs/runbooks/STAGE_3_1B7FR6R1_COMMERCIAL_FITOUT_RETEST.md"
    )
  ) &&
    existsSync(
      resolve(
        process.cwd(),
        "docs/implementation/STAGE_3_1B7FR6R1_SCOPE_DETAILS_SPECIFICATION_COMPLETION.md"
      )
    )
);
check(
  "completion affirms boundaries",
  /Production Scope Discovery remains \*\*Disabled\*\*/.test(
    read(
      "docs/implementation/STAGE_3_1B7FR6R1_SCOPE_DETAILS_SPECIFICATION_COMPLETION.md"
    )
  ) &&
    /Stage 3\.2 \*\*not started\*\*/.test(
      read(
        "docs/implementation/STAGE_3_1B7FR6R1_SCOPE_DETAILS_SPECIFICATION_COMPLETION.md"
      )
    )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

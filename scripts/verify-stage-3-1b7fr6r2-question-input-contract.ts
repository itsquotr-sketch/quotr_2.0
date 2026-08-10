/**
 * Stage 3.1B.7F-R6-R2 — Question input-type contract / DB constraint repair.
 *
 * Run: npx tsx scripts/verify-stage-3-1b7fr6r2-question-input-contract.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildQuestionBlockFromProjectState } from "../lib/scopes/questions";
import { SCOPE_DEFINITIONS, getScopeQuestions, getQuestionTemplateByKey } from "../lib/scopes/registry";
import {
  APP_QUESTION_INPUT_TYPES,
  DB_QUESTION_INPUT_TYPES,
  QUESTION_BLOCK_PREPARE_USER_ERROR,
  isDbQuestionInputType,
  resolveUiQuestionInputType,
  toPersistedQuestionInputType,
  toQuestionBlockUserError,
  validateQuestionInputType,
  validateQuestionInputTypes,
} from "../lib/scopes/question-input-types";
import {
  normalizeAnswerForStorage,
  normalizeAnswerForUi,
} from "../lib/scopes/fact-values";
import { mapQuestion } from "../lib/assistant/mappers";

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

console.log("\n=== Stage 3.1B.7F-R6-R2 — Question input-type contract ===\n");

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

// ---------------------------------------------------------------------------
// DB CONTRACT
// ---------------------------------------------------------------------------
console.log("DB CONTRACT");
const schema002 = read("supabase/migrations/002_assistant_schema.sql");
check(
  "questions_input_type_check allows number/select/boolean/text only",
  /input_type text not null\s+check \(input_type in \('number', 'select', 'boolean', 'text'\)\)/.test(
    schema002
  )
);
check(
  "no later migration widens questions input_type check",
  !readdirSync(resolve(process.cwd(), "supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f !== "002_assistant_schema.sql")
    .some((f) => {
      const body = read(`supabase/migrations/${f}`);
      return (
        /questions_input_type|input_type in \(/.test(body) &&
        /multi_select|questions/.test(body)
      );
    })
);
check(
  "canonical DB constants match schema",
  DB_QUESTION_INPUT_TYPES.join(",") === "number,select,boolean,text"
);
check(
  "no migration 034 present",
  !existsSync(resolve(process.cwd(), "supabase/migrations/034_*.sql")) &&
    !readdirSync(resolve(process.cwd(), "supabase/migrations")).some((f) =>
      f.startsWith("034")
    )
);

// ---------------------------------------------------------------------------
// REGISTRY
// ---------------------------------------------------------------------------
console.log("\nREGISTRY");
const allTemplates = SCOPE_DEFINITIONS.flatMap((def) =>
  def.questions.map((q) => ({
    scope: def.type,
    key: q.key,
    inputType: q.inputType,
    options: q.options,
  }))
);
const registryValidation = validateQuestionInputTypes(
  allTemplates.map((t) => ({ key: t.key, inputType: t.inputType }))
);
check("all registry templates use app-canonical input types", registryValidation.ok);
const illegalPersist = allTemplates.filter(
  (t) => !isDbQuestionInputType(toPersistedQuestionInputType(t.inputType))
);
check("every template persists to a DB-legal input_type", illegalPersist.length === 0);

const multiSelectTemplates = allTemplates.filter(
  (t) => t.inputType === "multi_select"
);
check(
  "multi_select templates exist (presentation) and persist as text",
  multiSelectTemplates.length >= 1 &&
    multiSelectTemplates.every(
      (t) => toPersistedQuestionInputType(t.inputType) === "text"
    ) &&
    multiSelectTemplates.every(
      (t) => Array.isArray(t.options) && (t.options?.length ?? 0) > 0
    )
);
check(
  "demolition.scope_items is multi_select → persisted text",
  multiSelectTemplates.some((t) => t.key === "demolition.scope_items") &&
    toPersistedQuestionInputType("multi_select") === "text"
);
check(
  "painting.surfaces is multi_select → persisted text",
  multiSelectTemplates.some((t) => t.key === "painting.surfaces")
);
check(
  "bathroom.fixtures_included is multi_select → persisted text",
  multiSelectTemplates.some((t) => t.key === "bathroom.fixtures_included")
);

const r6Keys = [
  "internal_walls.framing_type",
  "internal_walls.wall_lining_type",
  "internal_walls.lining_sides",
  "ceilings.area_m2",
  "ceilings.structure_type",
  "doors.count",
  "doors.prehung",
  "doors.supply_scope",
  "flooring.area_m2",
  "painting.location",
  "painting.coats_required",
  "plastering.area_m2",
  "plastering.level",
];
for (const key of r6Keys) {
  const template = allTemplates.find((t) => t.key === key);
  check(
    `R6 key ${key} uses canonical type`,
    Boolean(template) &&
      Boolean(template && isDbQuestionInputType(toPersistedQuestionInputType(template.inputType)))
  );
}

// ---------------------------------------------------------------------------
// HAZMAT
// ---------------------------------------------------------------------------
console.log("\nHAZMAT");
const hazmat = getScopeQuestions("demolition").find(
  (q) => q.key === "demolition.hazardous_materials_risk"
);
check("hazmat uses select (DB-legal)", hazmat?.inputType === "select");
check(
  "hazmat distinguishes No known risk from Not sure",
  Boolean(hazmat?.options?.includes("No known hazardous material risk")) &&
    Boolean(hazmat?.options?.includes("Not sure")) &&
    Boolean(hazmat?.options?.includes("Possible asbestos")) &&
    Boolean(hazmat?.options?.includes("Possible lead paint")) &&
    Boolean(hazmat?.options?.includes("Possible mould")) &&
    !(hazmat?.options ?? []).includes("None known")
);

// ---------------------------------------------------------------------------
// UI RENDERER
// ---------------------------------------------------------------------------
console.log("\nUI");
const qb = read("components/assistant/QuestionBlock.tsx");
for (const inputType of APP_QUESTION_INPUT_TYPES) {
  check(
    `QuestionBlock renders ${inputType}`,
    inputType === "text"
      ? /case "text"|default:/.test(qb)
      : qb.includes(`case "${inputType}"`) ||
          (inputType === "select" && qb.includes('case "select"'))
  );
}
check(
  "no UI-only persisted aliases (radio/dropdown/yes_no)",
  !allTemplates.some((t) =>
    ["radio", "dropdown", "choice", "yes_no", "multiselect", "integer", "currency", "textarea"].includes(
      t.inputType
    )
  )
);

// ---------------------------------------------------------------------------
// INSERT PAYLOAD (representative Fitout)
// ---------------------------------------------------------------------------
console.log("\nINSERT / SPECIFICATION / COVERAGE");
const qualities = ["budget", "standard", "premium"] as const;
for (const quality of qualities) {
  const block = buildQuestionBlockFromProjectState({
    project: { quality_level: quality },
    confirmedWorkAreas: fitoutWas,
    projectFacts: [],
  });
  const validation = validateQuestionInputTypes(block.questions);
  const payloads = block.questions.map((q) => ({
    key: q.key,
    label: q.label,
    workAreaId: q.workAreaId,
    input_type: toPersistedQuestionInputType(q.inputType),
    app_input_type: q.inputType,
    options: q.options ?? null,
  }));
  const allDbLegal = payloads.every((p) => isDbQuestionInputType(p.input_type));
  const keys = block.questions.map((q) => q.key);
  check(
    `${quality}: Fitout question set validates + DB-legal persist`,
    validation.ok && allDbLegal && block.questions.length > 12
  );
  check(
    `${quality}: multi_select rows persist as text with options`,
    payloads
      .filter((p) => p.app_input_type === "multi_select")
      .every(
        (p) =>
          p.input_type === "text" &&
          Array.isArray(p.options) &&
          (p.options?.length ?? 0) > 0
      )
  );
  check(
    `${quality}: R6 Fitout coverage present`,
    keys.includes("internal_walls.framing_type") &&
      keys.includes("ceilings.area_m2") &&
      keys.includes("doors.count") &&
      keys.includes("flooring.area_m2") &&
      keys.includes("painting.location") &&
      keys.includes("plastering.area_m2") &&
      keys.includes("demolition.scope_items")
  );

  // Rehydrate UI type for multi_select via template identity
  const demoScope = payloads.find((p) => p.key === "demolition.scope_items");
  const demoTemplate = getQuestionTemplateByKey("demolition.scope_items");
  check(
    `${quality}: demolition.scope_items rehydrates to multi_select UI`,
    demoScope != null &&
      demoTemplate?.inputType === "multi_select" &&
      resolveUiQuestionInputType({
        persistedInputType: demoScope.input_type,
        options: demoScope.options,
        key: "demolition.scope_items",
        templateInputType: demoTemplate.inputType,
      }) === "multi_select"
  );
}

// ---------------------------------------------------------------------------
// ROLLBACK / ERROR SAFETY
// ---------------------------------------------------------------------------
console.log("\nROLLBACK / ERROR SAFETY");
const synthetic = validateQuestionInputType("radio", "synthetic.bad");
check("unsupported synthetic type rejected before DB", !synthetic.ok);
check(
  "user error does not leak check constraint name",
  toQuestionBlockUserError(
    'new row for relation "questions" violates check constraint "questions_input_type_check"'
  ) === QUESTION_BLOCK_PREPARE_USER_ERROR &&
    !toQuestionBlockUserError(
      'new row for relation "questions" violates check constraint "questions_input_type_check"'
    ).includes("questions_input_type_check")
);
check(
  "unsupported type maps to safe user copy",
  synthetic.ok === false &&
    toQuestionBlockUserError(synthetic.message) ===
      QUESTION_BLOCK_PREPARE_USER_ERROR
);

const actionsSrc = read("lib/assistant/actions.ts");
check(
  "create path validates input types before insert",
  actionsSrc.includes("validateQuestionInputTypes") &&
    actionsSrc.includes("toPersistedQuestionInputType")
);
check(
  "create path rolls back new block on insert failure",
  actionsSrc.includes("QUESTION_INSERT_CHUNK") &&
    actionsSrc.includes('.delete()') &&
    actionsSrc.includes("didCreateBlock")
);
check(
  "orphan empty block heal retained (R6-R1)",
  actionsSrc.includes("orphan empty") ||
    actionsSrc.includes("7F-R6-R1")
);
check(
  "user-facing sanitize wired",
  actionsSrc.includes("toQuestionBlockUserError")
);
const missingSrc = read("lib/assistant/missing-questions.ts");
check(
  "missing-details insert also persists canonical types",
  missingSrc.includes("toPersistedQuestionInputType") &&
    missingSrc.includes("validateQuestionInputTypes")
);
const mappersSrc = read("lib/assistant/mappers.ts");
check(
  "mapQuestion rehydrates multi_select from template identity",
  mappersSrc.includes("resolveUiQuestionInputType") &&
    mappersSrc.includes("getQuestionTemplateByKey") &&
    mappersSrc.includes("Array.isArray(value)")
);
check(
  "create path validates then persists canonical types",
  actionsSrc.includes("validateQuestionInputTypes(built.questions)") &&
    actionsSrc.includes("toPersistedQuestionInputType(question.inputType)")
);

// ---------------------------------------------------------------------------
// REHYDRATION SAFETY
// ---------------------------------------------------------------------------
console.log("\nREHYDRATION SAFETY");
check(
  "text + options WITHOUT template stays text (not multi_select)",
  resolveUiQuestionInputType({
    persistedInputType: "text",
    options: ["A", "B"],
    key: "synthetic.free_text_with_options",
  }) === "text"
);
check(
  "known multi_select key + text persist → multi_select via template",
  resolveUiQuestionInputType({
    persistedInputType: "text",
    options: ["Internal walls", "Flooring"],
    key: "demolition.scope_items",
    templateInputType: getQuestionTemplateByKey("demolition.scope_items")
      ?.inputType,
  }) === "multi_select"
);
check(
  "ordinary select key stays select",
  resolveUiQuestionInputType({
    persistedInputType: "select",
    options: ["Internal", "External"],
    key: "painting.location",
    templateInputType: getQuestionTemplateByKey("painting.location")?.inputType,
  }) === "select"
);
check(
  "no registry text templates carry options (ambiguous trap absent)",
  allTemplates
    .filter((t) => t.inputType === "text")
    .every((t) => !t.options || t.options.length === 0)
);

// ---------------------------------------------------------------------------
// MULTI_SELECT VALUE STORAGE
// ---------------------------------------------------------------------------
console.log("\nMULTI_SELECT VALUE STORAGE");
const multiOptions = [
  "Internal walls",
  "Flooring",
  "Ceilings",
  "Doors",
  "Kitchen",
];
const selectedOutOfOrder = ["Doors", "Internal walls", "Ceilings"];
const stored = normalizeAnswerForStorage(selectedOutOfOrder, "multi_select");
check(
  "multi_select stores JSON string array (not comma-joined)",
  Array.isArray(stored) &&
    stored.length === 3 &&
    !(stored as string[]).some((item) => item.includes(","))
);
const uiOrdered = normalizeAnswerForUi(stored, "multi_select", multiOptions);
check(
  "multi_select UI order follows option list (deterministic)",
  Array.isArray(uiOrdered) &&
    uiOrdered.join("|") === "Internal walls|Ceilings|Doors"
);
check(
  "comma-string back-compat still parses to array",
  Array.isArray(
    normalizeAnswerForUi(
      "Internal walls, Flooring",
      "multi_select",
      multiOptions
    )
  ) &&
    (
      normalizeAnswerForUi(
        "Internal walls, Flooring",
        "multi_select",
        multiOptions
      ) as string[]
    ).join("|") === "Internal walls|Flooring"
);

const mappedMulti = mapQuestion({
  id: "q-demo-scope",
  question_block_id: "b1",
  work_area_id: IDS.demo,
  key: "demolition.scope_items",
  label: "Demolition scope",
  question_text: "What demolition/strip-out items are included?",
  input_type: "text",
  options: multiOptions,
  required: true,
  unit: null,
  answer_value: ["Flooring", "Doors", "Internal walls"],
  sort_order: 1,
});
check(
  "mapQuestion preserves multi_select array after refresh",
  mappedMulti.inputType === "multi_select" &&
    Array.isArray(mappedMulti.value) &&
    (mappedMulti.value as string[]).join("|") ===
      "Internal walls|Flooring|Doors"
);

for (const key of [
  "demolition.scope_items",
  "painting.surfaces",
  "bathroom.fixtures_included",
]) {
  const template = getQuestionTemplateByKey(key);
  check(
    `${key} persists as text and hydrates multi_select`,
    template?.inputType === "multi_select" &&
      toPersistedQuestionInputType(template.inputType) === "text" &&
      resolveUiQuestionInputType({
        persistedInputType: "text",
        options: template.options,
        key,
        templateInputType: template.inputType,
      }) === "multi_select"
  );
}

// ---------------------------------------------------------------------------
// BOUNDARIES
// ---------------------------------------------------------------------------
console.log("\nBOUNDARIES");
check(
  "Production Scope Discovery unchanged (config helper intact)",
  existsSync(
    resolve(process.cwd(), "lib/scope-discovery/configuration/index.ts")
  ) &&
    read("lib/scope-discovery/configuration/index.ts").includes(
      "isScopeDiscoveryEnabled"
    )
);
check(
  "no Stage 3.2 kickoff docs in this batch path",
  !existsSync(resolve(process.cwd(), "docs/plans/STAGE_3_2_KICKOFF.md"))
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

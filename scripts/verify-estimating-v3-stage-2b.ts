/**
 * Stage 2B flooring interpretation. Deterministic. No model call.
 * Persists two isolated Preview rows and deletes them.
 *
 * Run: npx tsx scripts/verify-estimating-v3-stage-2b.ts
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { physicalNetAreaM2 } from "../lib/estimate/flooring-physical";
import {
  flooringAreaMeasuresDisagree,
  parseFlooringPortions,
} from "../lib/estimate/flooring-portions";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import {
  STAGE_2A_CONFLICTING_FLOORING_AREA_BRIEF,
  STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF,
  STAGE_2A_LAMINATE_FLOORING_BRIEF,
  STAGE_2A_LOW_DECK_BRIEF,
  STAGE_2A_THREE_ROOM_FLOORING_BRIEF,
} from "./fixtures/stage-2a-original-briefs";
import { STAGE_2B_RESERVED_VARIANTS } from "./fixtures/stage-2b-reserved-variants";

const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const allowed = getAnalysisCapableWorkAreaTypes();
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1;
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  const extra =
    detail == null
      ? ""
      : ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
  console.log(`FAIL  ${name}${extra}`);
}

function analyse(brief: string) {
  const enriched = enrichExtractionFromBrief({
    briefText: brief,
    extraction: {
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    },
    allowedTypes: allowed,
  });
  const workAreas = enriched.extraction.workAreas.map((row, index) => ({
    id: `wa-${row.type}`,
    type: row.type,
    name: row.name?.trim() || row.type,
    status: "suggested" as const,
    sortOrder: index + 1,
  }));
  const facts = enriched.extraction.facts
    .filter((fact) => fact.value != null)
    .map((fact) => ({
      key: fact.key,
      value: fact.value,
      work_area_id:
        workAreas.find((row) => row.type === fact.work_area_type)?.id ?? null,
    }));
  const constraints = enriched.constraints.map((row) => ({
    key: row.key,
    value: row.value,
  }));
  const jobPlan = composeJobPlan({
    workAreas,
    facts,
    constraints,
    qualityLevel: enriched.qualityLevel,
    briefText: brief,
  });
  const clarify = composeClarifyView({
    stage: "work_area_questions",
    briefText: brief,
    qualityLevel: enriched.qualityLevel,
    workAreas,
    facts,
    constraints,
    jobPlan,
  });
  const questions = [...clarify.candidates, ...clarify.deferred].filter(
    isInitialCaptureQuestion
  );
  return { enriched, workAreas, facts, jobPlan, questions };
}

function portionsOf(result: ReturnType<typeof analyse>) {
  const fact = result.facts.find((row) => row.key === "flooring.portions");
  return parseFlooringPortions(fact?.value);
}

function typesOf(result: ReturnType<typeof analyse>) {
  return result.workAreas.map((row) => row.type);
}

const deck = analyse(STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF);
check("deck stays a deck", typesOf(deck).includes("deck"), typesOf(deck));
check(
  "replacement decking does not create flooring",
  !typesOf(deck).includes("flooring"),
  typesOf(deck)
);

const low = analyse(STAGE_2A_LOW_DECK_BRIEF);
check("low deck stays a deck", typesOf(low).includes("deck"), typesOf(low));
check("low deck does not create flooring", !typesOf(low).includes("flooring"), typesOf(low));

for (const variant of STAGE_2B_RESERVED_VARIANTS.filter((row) =>
  row.id.startsWith("deck-")
)) {
  const result = analyse(variant.text);
  check(
    `${variant.id} has no flooring`,
    !typesOf(result).includes("flooring"),
    typesOf(result)
  );
}

const rooms = analyse(STAGE_2A_THREE_ROOM_FLOORING_BRIEF);
const roomPortions = portionsOf(rooms);
check("three rooms retained", roomPortions.length === 3, roomPortions.map((row) => row.label));
check(
  "room finishes",
  roomPortions[0]?.finish_type === "carpet" &&
    roomPortions[1]?.finish_type === "carpet" &&
    roomPortions[2]?.finish_type === "vinyl_plank"
);
check(
  "three rooms are not a measurement conflict",
  roomPortions.every((row) => !flooringAreaMeasuresDisagree(row))
);

const laminate = analyse(STAGE_2A_LAMINATE_FLOORING_BRIEF);
const laminatePortion = portionsOf(laminate)[0];
check(
  "agreeing laminate area keeps a method",
  laminatePortion?.area_input_method != null &&
    !flooringAreaMeasuresDisagree(laminatePortion),
  laminatePortion?.area_input_method
);
check(
  "agreeing laminate is not asked to choose an area",
  !laminate.questions.some((row) => /which area should the quote use/i.test(row.question))
);

const conflict = analyse(STAGE_2A_CONFLICTING_FLOORING_AREA_BRIEF);
const conflictPortion = portionsOf(conflict)[0];
check("conflict keeps both measures", conflictPortion?.length_m === 5 && conflictPortion.width_m === 4 && conflictPortion.area_m2 === 32);
check("conflict does not choose a method", conflictPortion?.area_input_method == null);
check("conflict is visible", flooringAreaMeasuresDisagree(conflictPortion!));
check("conflict is not priced", physicalNetAreaM2(conflictPortion!) == null);
const conflictText = conflict.jobPlan.cards
  .flatMap((card) => card.included.map((item) => item.label))
  .join(" ");
check("analysis shows 20 and 32", /20 m²/.test(conflictText) && /32 m²/.test(conflictText), conflictText);
check(
  "details asks which area",
  conflict.questions.some((row) =>
    /20 m²/.test(row.question) &&
    /32 m²/.test(row.question) &&
    /which area should the quote use/i.test(row.question)
  ),
  conflict.questions.map((row) => row.question)
);

const mixed = analyse(
  STAGE_2B_RESERVED_VARIANTS.find((row) => row.id === "floor-area-conflict-mixed")!.text
);
const mixedPortion = portionsOf(mixed)[0];
check(
  "mixed units stay unresolved",
  mixedPortion?.length_m === 3.6 &&
    mixedPortion.width_m === 4.2 &&
    mixedPortion.area_m2 === 18 &&
    mixedPortion.area_input_method == null &&
    physicalNetAreaM2(mixedPortion) == null
);
check(
  "mixed-unit details names both areas",
  mixed.questions.some((row) => /15\.12 m²/.test(row.question) && /18 m²/.test(row.question))
);

const hardwood = analyse(
  STAGE_2B_RESERVED_VARIANTS.find((row) => row.id === "hardwood-floor-agrees")!.text
);
const hardwoodPortion = portionsOf(hardwood)[0];
check("hardwood floor stays flooring", typesOf(hardwood).includes("flooring"), typesOf(hardwood));
check(
  "matching hardwood area is not a conflict",
  hardwoodPortion?.finish_type === "hardwood" &&
    hardwoodPortion.area_m2 === 22 &&
    hardwoodPortion.area_input_method != null &&
    !flooringAreaMeasuresDisagree(hardwoodPortion)
);

function loadEnv(filePath: string) {
  const text = readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, eq)] = value;
  }
  return env;
}

async function persistRoundTrip() {
  const env = loadEnv(resolve(process.cwd(), ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(PREVIEW_REF)) {
    check("persist refused non-preview", false, "supabase url");
    return;
  }
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const orgId = randomUUID();
  const userId = (
    await admin.auth.admin.createUser({
      email: `hello+v3-stage-2b.${randomBytes(3).toString("hex")}@erccontracting.co.nz`,
      password: randomBytes(18).toString("base64url"),
      email_confirm: true,
    })
  ).data.user?.id;
  if (!userId) {
    check("persist fixture user", false);
    return;
  }
  try {
    const org = await admin.from("organisations").insert({
      id: orgId,
      name: "Stage 2B flooring interpretation",
    });
    check("persist org", !org.error, org.error?.message);
    await admin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role: "owner",
      full_name: "Stage 2B probe",
    });
    const projectId = randomUUID();
    await admin.from("projects").insert({
      id: projectId,
      org_id: orgId,
      created_by: userId,
      title: "Stage 2B conflict round trip",
      brief_text: STAGE_2A_CONFLICTING_FLOORING_AREA_BRIEF,
      stage: "confirm_work_areas",
    });
    const workAreaId = randomUUID();
    await admin.from("work_areas").insert({
      id: workAreaId,
      org_id: orgId,
      project_id: projectId,
      type: "flooring",
      name: "Flooring",
      status: "suggested",
      sort_order: 1,
    });
    const portionFact = conflict.facts.find((row) => row.key === "flooring.portions");
    const inserted = await admin.from("project_facts").insert({
      org_id: orgId,
      project_id: projectId,
      work_area_id: workAreaId,
      key: "flooring.portions",
      label: "Flooring areas",
      value: portionFact?.value,
      source: "ai_extracted",
      confidence: 0.8,
    });
    check("conflict fact persists", !inserted.error, inserted.error?.message);
    const read = await admin
      .from("project_facts")
      .select("value")
      .eq("project_id", projectId)
      .eq("key", "flooring.portions")
      .single();
    const stored = parseFlooringPortions(read.data?.value);
    check(
      "stored conflict still unresolved",
      stored[0]?.area_input_method == null &&
        stored[0]?.area_m2 === 32 &&
        stored[0]?.length_m === 5 &&
        physicalNetAreaM2(stored[0]!) == null
    );
    const reloaded = composeClarifyView({
      stage: "work_area_questions",
      briefText: STAGE_2A_CONFLICTING_FLOORING_AREA_BRIEF,
      qualityLevel: null,
      workAreas: [
        {
          id: workAreaId,
          type: "flooring",
          name: "Flooring",
          status: "suggested",
          sortOrder: 1,
        },
      ],
      facts: [
        {
          key: "flooring.portions",
          value: read.data?.value,
          work_area_id: workAreaId,
        },
      ],
      constraints: [],
      jobPlan: composeJobPlan({
        workAreas: [
          {
            id: workAreaId,
            type: "flooring",
            name: "Flooring",
            status: "suggested",
            sortOrder: 1,
          },
        ],
        facts: [
          {
            key: "flooring.portions",
            value: read.data?.value,
            work_area_id: workAreaId,
          },
        ],
        briefText: STAGE_2A_CONFLICTING_FLOORING_AREA_BRIEF,
      }),
    });
    const required = [...reloaded.candidates, ...reloaded.deferred].filter(
      isInitialCaptureQuestion
    );
    check(
      "reloaded details still ask the conflict",
      required.some((row) => /which area should the quote use/i.test(row.question))
    );
  } finally {
    await admin.from("project_facts").delete().eq("org_id", orgId);
    await admin.from("work_areas").delete().eq("org_id", orgId);
    await admin.from("projects").delete().eq("org_id", orgId);
    await admin.from("profiles").delete().eq("org_id", orgId);
    await admin.from("organisations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(userId);
  }
}

persistRoundTrip()
  .then(() => {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

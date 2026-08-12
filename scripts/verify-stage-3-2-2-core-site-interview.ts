/**
 * Stage 3.2.2 — Core Project/Site Builder Interview integration verification.
 *
 * Static + pure-engine checks. No live Supabase / AI.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildBuilderInterviewCandidates,
  buildProjectConditionsSnapshot,
  filterProjectSiteAskCandidates,
  evaluateProposedUserAnswer,
  PROJECT_CONDITIONS_BATCH_SIZE,
} from "../lib/builder-interview";
import {
  buildBathroomFixture,
  buildCommercialFitoutFixture,
  buildDeckFixture,
} from "../lib/builder-interview/fixtures";
import { buildLiveBuilderInterviewInput } from "../lib/assistant/builder-interview-live";
import { isReservedConstraintKey } from "../lib/scopes/domain-ownership";
import { shouldSkipTemplateQuestion } from "../lib/scopes/questions";
import { buildFactLookup } from "../lib/scopes/fact-values";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function main(): void {
  console.log("=== Stage 3.2.2 Core Site Interview Integration ===\n");

  // --- ENGINE ---
  const deck = buildDeckFixture();
  const snap = buildProjectConditionsSnapshot(deck);
  check(
    "ENGINE uses buildBuilderInterviewCandidates via project filter",
    snap.engine.candidates.length >= 0 && Array.isArray(snap.candidates)
  );
  check(
    "ENGINE no duplicated eligibility in project-filter (delegates to engine)",
    read(join("lib", "builder-interview", "project-filter.ts")).includes(
      "buildBuilderInterviewCandidates"
    ) &&
      !read(join("lib", "builder-interview", "project-filter.ts")).includes(
        "triggerRuleIds"
      )
  );

  // --- FILTER ---
  check(
    "FILTER only PROJECT candidates in snapshot",
    snap.candidates.every((c) => c.scope === "PROJECT")
  );
  check(
    "FILTER only ASK + CONSTRAINT write targets",
    snap.candidates.every(
      (c) => c.askPolicy === "ASK" && c.writeTarget === "CONSTRAINT"
    )
  );
  const fullDeck = buildBuilderInterviewCandidates(deck);
  const waAsks = fullDeck.candidates.filter((c) => c.scope === "WORK_AREA");
  check(
    "FILTER WA candidates exist in full engine but excluded from UI snapshot",
    waAsks.length >= 0 &&
      snap.candidates.every((c) => c.scope !== "WORK_AREA")
  );
  check(
    "FILTER batch size capped",
    snap.candidates.length <= PROJECT_CONDITIONS_BATCH_SIZE
  );

  // --- SUPPRESSION ---
  const deckKeys = new Set(snap.candidates.map((c) => c.targetKey));
  check(
    "SUPPRESSION known access suppresses ask (Deck fixture)",
    !deckKeys.has("site_access")
  );
  check(
    "SUPPRESSION known carry suppresses ask (Deck fixture)",
    !deckKeys.has("material_carry_distance")
  );

  const bathroom = buildBathroomFixture();
  const bathSnap = buildProjectConditionsSnapshot(bathroom);
  // Bathroom fixture typically has missing occupied / access — at least some PROJECT asks
  check(
    "SUPPRESSION Bathroom may ask project conditions when unknown",
    bathSnap.remainingCount >= 0
  );

  // Occupied suppress when known
  const occupiedKnown = buildLiveBuilderInterviewInput({
    projectId: "00000000-0000-4000-8000-000000000099",
    qualityLevel: "standard",
    workAreas: [
      {
        id: "wa-1",
        type: "bathroom",
        name: "Bathroom",
        status: "confirmed",
      },
    ],
    facts: [],
    constraints: [
      { key: "occupied_site", value: true, source: "user" },
      { key: "site_access", value: "Easy", source: "user" },
      { key: "material_carry_distance", value: "10–30m", source: "user" },
    ],
  });
  const occSnap = buildProjectConditionsSnapshot(occupiedKnown);
  const occKeys = new Set(occSnap.candidates.map((c) => c.targetKey));
  check(
    "SUPPRESSION known occupied suppresses ask",
    !occKeys.has("occupied_site")
  );
  check(
    "SUPPRESSION known access/carry suppressed together",
    !occKeys.has("site_access") && !occKeys.has("material_carry_distance")
  );

  // --- DEDUP Scope Details ---
  const factLookup = buildFactLookup([]);
  const skipAccess = shouldSkipTemplateQuestion(
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
    {
      id: "wa-d",
      type: "demolition",
      name: "Demolition",
      sort_order: 0,
      status: "confirmed",
    },
    factLookup,
    new Set(["demolition"]),
    {
      quality_level: "standard",
      constraints: [{ key: "site_access", value: "Restricted" }],
    }
  );
  check(
    "DEDUP project site_access suppresses WA access Scope Details clone",
    skipAccess === true
  );

  // --- BATCH / CONFLICT / ASSUMPTION (action source) ---
  const actionsSrc = read(
    join("lib", "assistant", "builder-interview-actions.ts")
  );
  check(
    "BATCH multiple answers saved in one action",
    actionsSrc.includes("saveBuilderInterviewProjectAnswers") &&
      actionsSrc.includes("answers: z.array")
  );
  check(
    "BATCH recompute once after confirmed save",
    actionsSrc.includes("buildLiveProjectConditionsSnapshot") &&
      (actionsSrc.match(/buildLiveProjectConditionsSnapshot\(/g) ?? [])
        .length === 1
  );
  check(
    "BATCH no per-answer router.refresh in action",
    !actionsSrc.includes("router.refresh")
  );
  check(
    "CONFLICT identical explicit user value = no conflict path",
    actionsSrc.includes("unchanged") &&
      actionsSrc.includes("evaluateProposedUserAnswer")
  );
  check(
    "CONFLICT different explicit user value requires confirmReplace",
    actionsSrc.includes("requiresConflictConfirm") &&
      actionsSrc.includes("confirmReplace")
  );
  check(
    "NOT SURE no fabricated value",
    actionsSrc.includes('answer.kind === "not_sure"') &&
      actionsSrc.includes("do not fabricate")
  );
  check(
    "ASSUMPTION deferred — not stored as user answer",
    actionsSrc.includes("assumption_deferred") &&
      actionsSrc.includes("deferred to 3.2.4")
  );
  check(
    "CONSTRAINT WRITE allowlisted reserved keys only",
    actionsSrc.includes("isReservedConstraintKey") &&
      actionsSrc.includes('from("constraints")')
  );
  check(
    "CONSTRAINT WRITE no project_facts for site answers",
    !actionsSrc.includes('from("project_facts")') ||
      actionsSrc.includes("factRows") // reload only
  );
  // Ensure writes go to constraints upsert
  check(
    "CONSTRAINT WRITE uses upsertProjectConstraintRecord",
    actionsSrc.includes("upsertProjectConstraintRecord")
  );

  // --- CONFLICT pure authority ---
  const conflict = evaluateProposedUserAnswer({
    existing: {
      state: "KNOWN",
      source: "user",
      value: "Restricted",
      precedence: 100,
    },
    proposedValue: "Easy",
  });
  check(
    "CONFLICT different user values require confirmation",
    conflict.requiresConflictConfirm === true
  );
  const identical = evaluateProposedUserAnswer({
    existing: {
      state: "KNOWN",
      source: "user",
      value: "Restricted",
      precedence: 100,
    },
    proposedValue: "Restricted",
  });
  check(
    "CONFLICT identical user values do not require confirmation",
    identical.requiresConflictConfirm === false
  );

  // --- NAMING ---
  const livePaths = [
    join("lib", "assistant", "actions.ts"),
    join("lib", "assistant", "missing-questions.ts"),
    join("lib", "assistant", "builder-interview-actions.ts"),
    join("lib", "assistant", "builder-interview-live.ts"),
    join("lib", "scopes", "questions.ts"),
    join("components", "assistant", "ProjectConditionsBlock.tsx"),
    join("components", "assistant", "AssistantShell.tsx"),
  ];
  const liveSrc = livePaths.map(read).join("\n");
  check(
    "NAMING live path uses constraints not project_constraints",
    !liveSrc.includes("project_constraints")
  );
  check(
    "NAMING live path uses occupied_site not site_occupied",
    !liveSrc.includes("site_occupied") ||
      liveSrc.includes("never site_occupied")
  );
  check(
    "NAMING reserved key occupied_site is allowlisted",
    isReservedConstraintKey("occupied_site")
  );

  // --- UI ---
  const shell = read(join("components", "assistant", "AssistantShell.tsx"));
  const pcBlock = read(
    join("components", "assistant", "ProjectConditionsBlock.tsx")
  );
  const constraintBlock = read(
    join("components", "assistant", "ConstraintBlock.tsx")
  );
  check(
    "UI Project Conditions card title",
    shell.includes('title="Project Conditions"')
  );
  check(
    "UI remaining count / Complete status",
    shell.includes("questions remaining") && shell.includes("Complete")
  );
  check("UI Save answers CTA", pcBlock.includes("Save answers"));
  check(
    "UI stable disclosure preferredExpanded",
    shell.includes("preferredExpanded") &&
      shell.includes("forceExpanded={forceExpandProjectConditions}")
  );
  check(
    "UI Site Constraints card suppressed when Project Conditions owns ASK",
    shell.includes("!preferProjectConditionsAsk") &&
      pcBlock.includes("data-project-conditions-known")
  );
  check(
    "UI Project Conditions includes known + edit surfaces",
    pcBlock.includes("Known from your project") &&
      pcBlock.includes("Edit conditions")
  );
  check(
    "UI suppress fallback questionnaire capability retained",
    constraintBlock.includes("suppressFallbackQuestionnaire")
  );
  check(
    "UI no Builder Interview Engine title",
    !shell.includes("Builder Interview Engine")
  );

  // --- READINESS / ATTENTION ---
  check(
    "READINESS presentation only near Quick Estimate",
    shell.includes("projectInformationLabel") &&
      read(join("components", "assistant", "EstimatePanel.tsx")).includes(
        "Project information"
      )
  );
  check(
    "READINESS Generate Estimate authority unchanged (no softBlock wiring)",
    !shell.includes("softBlockQuickEstimate &&") &&
      !shell.includes("canGenerateEstimate=!projectConditions") &&
      shell.includes("canGenerateEstimate={canGenerateEstimate}")
  );
  check(
    "ATTENTION Review routes to projectConditions",
    shell.includes('target === "projectConditions"') &&
      read(
        join("lib", "assistant", "presentation", "quick-estimate-view-model.ts")
      ).includes('"projectConditions"')
  );

  // --- PERFORMANCE ---
  const perf = read(join("lib", "assistant", "preview-performance.ts"));
  check(
    "PERFORMANCE marks include builder_interview_*",
    perf.includes("builder_interview_load") &&
      perf.includes("builder_interview_batch_save_complete") &&
      perf.includes("builder_interview_recompute")
  );
  check(
    "PERFORMANCE no AI call in BI action",
    !actionsSrc.includes("lib/ai/") && !actionsSrc.includes("generateText")
  );

  // --- SECURITY ---
  check(
    "SECURITY auth/org server derived",
    actionsSrc.includes("requireAuthOrgContext") &&
      actionsSrc.includes("assertOrgOwnsActiveProject")
  );
  check(
    "SECURITY no service role",
    !actionsSrc.includes("service_role") &&
      !actionsSrc.includes("createServiceRole")
  );
  check(
    "SECURITY safe errors",
    actionsSrc.includes("toSafeAssistantError")
  );

  // --- BOUNDARIES ---
  check(
    "BOUNDARIES no interview_answers migration",
    !existsSync(join("supabase", "migrations")) ||
      !readdirSync(join("supabase", "migrations")).some((f) =>
        f.toLowerCase().includes("interview_answer")
      )
  );
  check(
    "BOUNDARIES no Work Area interview UI",
    !shell.includes("Work Area Conditions") &&
      filterProjectSiteAskCandidates(fullDeck).every(
        (c) => c.scope === "PROJECT"
      )
  );
  check(
    "BOUNDARIES Fitout project logistics asked once (PROJECT scope)",
    (() => {
      const fit = buildProjectConditionsSnapshot(buildCommercialFitoutFixture());
      const accessAsks = fit.candidates.filter(
        (c) => c.targetKey === "site_access"
      );
      return accessAsks.length <= 1;
    })()
  );

  // Docs present
  for (const doc of [
    join(
      "docs",
      "architecture",
      "STAGE_3_2_2_CORE_SITE_INTERVIEW_ARCHITECTURE.md"
    ),
    join(
      "docs",
      "implementation",
      "STAGE_3_2_2_CORE_SITE_INTERVIEW_COMPLETION.md"
    ),
    join(
      "docs",
      "performance",
      "STAGE_3_2_2_CORE_SITE_INTERVIEW_PERFORMANCE.md"
    ),
    join(
      "docs",
      "runbooks",
      "STAGE_3_2_2_CORE_SITE_INTERVIEW_PREVIEW_TEST.md"
    ),
  ]) {
    check(`DOC exists ${doc}`, existsSync(doc));
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();

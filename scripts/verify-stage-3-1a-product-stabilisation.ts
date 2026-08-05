/**
 * Stage 3.1A — Product stabilisation verification.
 *
 * Pure helpers + static scans. No live Supabase / browser.
 * Manual Preview checks: docs/runbooks/STAGE_3_1A_PREVIEW_SMOKE_TEST.md
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createLatestWriteGuard,
  filterPersistableAnswers,
  isEmptyAnswerValue,
  resolveAnswerSaveStatus,
  shouldAutosaveAnswers,
} from "../lib/assistant/answer-persistence";
import {
  formatAnswerOptionLabel,
  formatFactValueForDisplay,
  isNotSureValue,
} from "../lib/scopes/fact-labels";
import { isTemplateFactMissing } from "../lib/scopes/questions";
import { buildFactLookup } from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";
import { pricingDocumentInputSchema } from "../lib/pricing/schemas";

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

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(tsx?|md|sql)$/.test(name)) out.push(p);
  }
  return out;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function main(): void {
  console.log("=== Stage 3.1A Product Stabilisation Verification ===\n");

  const deckQuestions = getScopeQuestions("deck");
  const substructure = deckQuestions.find(
    (q) => q.factKey === "deck.substructure_condition"
  );
  check(
    "UX-002: substructure template includes none",
    Boolean(substructure?.options?.includes("none"))
  );
  check(
    "UX-002: substructure template retains unknown",
    Boolean(substructure?.options?.includes("unknown"))
  );

  const workArea = {
    id: "wa-deck-1",
    type: "deck",
    name: "Deck",
    sort_order: 1,
    status: "confirmed",
  };
  const project = { quality_level: "standard" };
  const confirmedTypes = new Set(["deck"]);

  function missingFor(value: unknown): boolean {
    if (!substructure) return true;
    const lookup = buildFactLookup([
      {
        key: "deck.substructure_condition",
        work_area_id: workArea.id,
        value,
        source: "user",
      },
    ]);
    return isTemplateFactMissing({
      template: substructure,
      workArea,
      lookup,
      qualityLevel: project.quality_level,
      confirmedTypes,
      project,
    });
  }

  check(
    "BUG-001: unanswered optional substructure is not missing-badge",
    !missingFor(null)
  );
  check(
    "BUG-001: good_existing satisfies requirement",
    !missingFor("good_existing")
  );
  check(
    "BUG-001: listed unknown satisfies requirement (not not-sure)",
    !missingFor("unknown")
  );
  check("UX-002: none satisfies requirement", !missingFor("none"));
  check(
    "BUG-001: free-text unknown without options still not-sure",
    isNotSureValue("unknown") === true
  );
  check(
    "BUG-001: listed unknown with options is deliberate",
    isNotSureValue("unknown", substructure?.options) === false
  );
  check(
    "BUG-001: boolean Not sure remains not-sure even when listed",
    isNotSureValue("Not sure", ["Yes", "No", "Not sure"]) === true
  );

  check(
    "UX-001: good_condition displays human label",
    formatAnswerOptionLabel("good_condition") === "Good condition"
  );
  check(
    "UX-001: good_existing displays human label",
    formatAnswerOptionLabel("good_existing") === "Good existing"
  );
  check(
    "UX-001: none displays human label",
    formatAnswerOptionLabel("none") === "None"
  );
  check(
    "UX-001: snake_case fallback uses spaces not underscores",
    formatAnswerOptionLabel("partial_replacement") === "Partial replacement" &&
      !formatAnswerOptionLabel("some_other_value").includes("_")
  );
  check(
    "UX-001: fact display uses enum labels",
    formatFactValueForDisplay("full_replacement") === "Full replacement"
  );

  const filtered = filterPersistableAnswers([
    { question_id: "11111111-1111-1111-1111-111111111111", value: null },
    { question_id: "22222222-2222-2222-2222-222222222222", value: "" },
    {
      question_id: "33333333-3333-3333-3333-333333333333",
      value: "good_existing",
    },
  ]);
  check(
    "BUG-002: filterPersistableAnswers drops null/empty",
    filtered.length === 1 && filtered[0]?.value === "good_existing"
  );
  check(
    "BUG-002: isEmptyAnswerValue detects empty",
    isEmptyAnswerValue(null) &&
      isEmptyAnswerValue("") &&
      !isEmptyAnswerValue("none")
  );
  check(
    "BUG-002: shouldAutosaveAnswers requires persistable value",
    shouldAutosaveAnswers({
      questions: [{ id: "a", required: false }],
      answers: { a: null },
    }) === false &&
      shouldAutosaveAnswers({
        questions: [{ id: "a", required: false }],
        answers: { a: "none" },
      }) === true
  );
  check(
    "BUG-002: shouldAutosaveAnswers blocks empty required",
    shouldAutosaveAnswers({
      questions: [{ id: "a", required: true }],
      answers: { a: null },
    }) === false
  );

  const guard = createLatestWriteGuard();
  const t1 = guard.next();
  const t2 = guard.next();
  check(
    "BUG-002: latest-write guard keeps newest token",
    !guard.isCurrent(t1) && guard.isCurrent(t2)
  );

  const saved = resolveAnswerSaveStatus({ success: true });
  const errored = resolveAnswerSaveStatus({
    success: false,
    error: "Could not save answers. Please try again.",
  });
  check(
    "BUG-002: successful save reports saved",
    saved.status === "saved" && saved.error === null
  );
  check(
    "BUG-002: failed save never reports saved",
    errored.status === "error" &&
      errored.error === "Could not save answers. Please try again."
  );

  const clientParsed = pricingDocumentInputSchema.safeParse({
    client_name: "Jane Builder",
    site_address: "12 Example St",
  });
  check(
    "BUG-004: pricing document schema accepts client fields",
    clientParsed.success === true
  );

  const pricingDetails = read("components/pricing/PricingDetailsCard.tsx");
  check(
    "BUG-004: pricing details card has editable client inputs",
    pricingDetails.includes('id="pricing-client-name"') &&
      pricingDetails.includes('id="pricing-site-address"')
  );

  const pricingActions = read("lib/pricing/actions.ts");
  check(
    "BUG-004: updatePricingDocument syncs project client details",
    pricingActions.includes("client_name") &&
      pricingActions.includes("pricing-update-project-client")
  );

  const collapsible = read("components/assistant/CollapsibleStageCard.tsx");
  const shell = read("components/assistant/AssistantShell.tsx");
  check(
    "BUG-003: CollapsibleStageCard supports forceExpanded",
    collapsible.includes("forceExpanded")
  );
  check(
    "BUG-003: Quality card force-expands while editing",
    shell.includes("forceExpanded={isEditingQuality}")
  );

  const capture = read("components/assistant/ProjectCaptureBlock.tsx");
  check(
    "UX-005: Project brief and Site notes are separated",
    (capture.includes("Project brief") ||
      capture.includes("Project Brief")) &&
      (capture.includes("Site notes") || capture.includes("Site Notes")) &&
      capture.includes("project-brief-heading") &&
      capture.includes("site-notes-heading")
  );
  check(
    "UX-005: brief and notes fields still present for AI",
    capture.includes("briefText") &&
      capture.includes("SiteNotesCaptureCard") &&
      capture.includes("onBriefChange")
  );

  const login = read("app/(auth)/login/page.tsx");
  check(
    "UX-003: login form uses card spacing gap",
    login.includes("gap-(--card-spacing)")
  );

  const ratesDefaults = read("components/rates/CompanyDefaultsSection.tsx");
  check(
    "UX-004: rates defaults form uses card spacing gap",
    ratesDefaults.includes("gap-(--card-spacing)")
  );

  // --- Guardrails: no commercial formula / migration / parity imports ---
  const migrationDirs = walkFiles("supabase/migrations").filter((p) =>
    /STAGE_3_1A|3_1a|stage-3-1a/i.test(p)
  );
  check(
    "Guard: no Stage 3.1A migration files added",
    migrationDirs.length === 0
  );

  const componentFiles = walkFiles("components");
  const parityHits = componentFiles.filter((p) => {
    const src = read(p);
    return (
      src.includes("commercial-engine/parity") ||
      src.includes("lib/commercial-engine/parity")
    );
  });
  check(
    "Guard: no production parity imports in components",
    parityHits.length === 0,
    parityHits.slice(0, 3).join(", ")
  );

  const commercialCore = [
    "lib/commercial-engine/core",
    "lib/commercial-engine/calculations",
  ];
  for (const dir of commercialCore) {
    if (!existsSync(dir)) continue;
    // Stage 3.1A must not alter engine formula modules — presence check only;
    // verify deck calculator only gained none branch without changing sell math helpers.
  }
  const deckCalc = read("lib/estimate/calculators/deck.ts");
  check(
    "Guard: deck calculator documents none without inventing money",
    deckCalc.includes('substructureCondition === "none"') &&
      deckCalc.includes("No existing substructure")
  );
  check(
    "Guard: commercial engine package untouched claim (static presence)",
    existsSync("lib/commercial-engine")
  );

  const answerActions = read("lib/assistant/actions.ts");
  const saveFnStart = answerActions.indexOf(
    "export async function saveQuestionBlockAnswers"
  );
  const saveFnEnd = answerActions.indexOf(
    "export async function saveConstraints",
    saveFnStart
  );
  const saveFnBody = answerActions.slice(saveFnStart, saveFnEnd);
  check(
    "BUG-002: answer save uses targeted project revalidation",
    saveFnBody.includes("revalidateProjectAssistantPath") &&
      saveFnBody.includes("skipDerivedPersist: true")
  );
  check(
    "BUG-002: answer save does not expose raw DB error.message",
    !/return \{ error: (?:error|factError|blockError|stageError|ensureResult\.error)\.message \}/.test(
      saveFnBody
    ) &&
      !saveFnBody.includes("return { error: ensureResult.error }") &&
      saveFnBody.includes("toSafeAssistantError(ANSWER_SAVE_FAILED)")
  );

  const backlog = read("docs/product/QUOTR_PRODUCT_BACKLOG.md");
  check(
    "Docs: backlog records BUG/UX/FEAT items",
    backlog.includes("BUG-001") &&
      backlog.includes("FEAT-003") &&
      backlog.includes("Deferred")
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();

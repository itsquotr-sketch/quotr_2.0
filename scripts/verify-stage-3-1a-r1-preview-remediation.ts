/**
 * Stage 3.1A-R1 — Preview remediation verification.
 *
 * Pure helpers + static scans. No live Supabase / browser.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  createLatestWriteGuard,
  foldRapidAnswerResponses,
  mergeAnswersWithRevisions,
  resolveVisibleAnswerValue,
  shouldClearLocalAnswerEdit,
} from "../lib/assistant/answer-persistence";
import {
  beginQualitySpecEdit,
  QUALITY_SPEC_EDIT_FLOW,
} from "../lib/assistant/quality-edit";
import {
  formatAnswerOptionLabel,
  formatFactValueForDisplay,
} from "../lib/scopes/fact-labels";

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

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(tsx?)$/.test(name)) out.push(p);
  }
  return out;
}

function main(): void {
  console.log("=== Stage 3.1A-R1 Preview Remediation Verification ===\n");

  // --- R1-001 enum presentation ---
  check(
    "R1-001: good_condition → Good condition",
    formatAnswerOptionLabel("good_condition") === "Good condition"
  );
  check(
    "R1-001: none → None",
    formatAnswerOptionLabel("none") === "None"
  );
  check(
    "R1-001: good_existing → Good existing",
    formatAnswerOptionLabel("good_existing") === "Good existing"
  );
  check(
    "R1-001: fact display formats good_condition",
    formatFactValueForDisplay("good_condition") === "Good condition"
  );
  check(
    "R1-001: array fact values are formatted",
    formatFactValueForDisplay(["good_condition", "none"]) ===
      "Good condition, None"
  );

  const questionBlock = read("components/assistant/QuestionBlock.tsx");
  check(
    "R1-001: QuestionBlock formats multi/array answers",
    questionBlock.includes("formatSelectAnswerValue(item)") ||
      questionBlock.includes("formatSelectAnswerValue(value)")
  );
  check(
    "R1-001: QuestionBlock does not join raw arrays",
    !questionBlock.includes("value.join(\", \")")
  );

  const constraintRow = read("components/assistant/EditableConstraintRow.tsx");
  check(
    "R1-001: constraint chips use formatAnswerOptionLabel",
    constraintRow.includes("formatAnswerOptionLabel(option)")
  );

  const factRow = read("components/assistant/ScopeReviewFactRow.tsx");
  check(
    "R1-001: formatConstraintDisplayValue uses formatAnswerOptionLabel",
    factRow.includes("formatAnswerOptionLabel(value)")
  );

  const knownRaw = [
    "good_condition",
    "good_existing",
    "partial_replacement",
    "full_replacement",
  ];
  const uiFiles = [
    ...walkFiles("components/assistant"),
    "components/pricing/PricingDetailsCard.tsx",
  ].filter((p) => existsSync(p));

  let rawRenderHits = 0;
  for (const file of uiFiles) {
    const src = read(file);
    // Flag JSX text nodes that embed known raw enums literally (not in comments/maps).
    for (const token of knownRaw) {
      const asJsxText = new RegExp(`>\\s*${token}\\s*<`);
      if (asJsxText.test(src)) {
        rawRenderHits += 1;
      }
    }
  }
  check(
    "R1-001: no raw known enums as JSX text in assistant UI",
    rawRenderHits === 0,
    `hits=${rawRenderHits}`
  );

  // --- R1-002 reconciliation ---
  const rapid = foldRapidAnswerResponses({
    selections: [
      { token: 1, value: "A" },
      { token: 2, value: "B" },
      { token: 3, value: "C" },
    ],
    responses: [
      { token: 1, ok: true },
      { token: 3, ok: true },
      { token: 2, ok: true },
    ],
  });
  check("R1-002: A→B→C with responses A,C,B keeps C", rapid.visibleValue === "C");
  check("R1-002: latest success reports saved", rapid.status === "saved");

  const staleProps = resolveVisibleAnswerValue({
    localValue: "C",
    serverValue: "A",
    localRevision: 3,
    confirmedRevision: 3,
    hasLocalEdit: true,
  });
  check(
    "R1-002: older server props cannot overwrite newer confirmed local C",
    staleProps === "C"
  );

  const pendingLocal = resolveVisibleAnswerValue({
    localValue: "C",
    serverValue: "B",
    localRevision: 3,
    confirmedRevision: 2,
    hasLocalEdit: true,
  });
  check("R1-002: pending local revision stays visible", pendingLocal === "C");

  check(
    "R1-002: clear local only when server matches confirmed",
    shouldClearLocalAnswerEdit({
      localValue: "C",
      serverValue: "C",
      localRevision: 3,
      confirmedRevision: 3,
    }) === true
  );
  check(
    "R1-002: do not clear while pending newer revision",
    shouldClearLocalAnswerEdit({
      localValue: "C",
      serverValue: "C",
      localRevision: 4,
      confirmedRevision: 3,
    }) === false
  );

  const merged = mergeAnswersWithRevisions({
    serverAnswers: { q1: "A" },
    localEdits: {
      q1: { value: "C", revision: 3, confirmedRevision: 2 },
    },
  });
  check("R1-002: merge keeps local C over server A", merged.q1 === "C");

  const guard = createLatestWriteGuard();
  const t1 = guard.next();
  const t2 = guard.next();
  check("R1-002: latest-write guard drops stale token", !guard.isCurrent(t1));
  check("R1-002: latest-write guard keeps current token", guard.isCurrent(t2));

  const shell = read("components/assistant/AssistantShell.tsx");
  check(
    "R1-002: ScopeSummaryBlock is not remount-keyed on answer values",
    !shell.includes("key={scopeReviewQuestionKey}")
  );

  // --- R1-003 quality edit ---
  let editing = false;
  const scroll = { current: { scrollIntoView() {} } as unknown as HTMLElement };
  const flow = beginQualitySpecEdit({
    setEditing: (value) => {
      editing = value;
    },
    scrollTarget: scroll,
  });
  check("R1-003: beginQualitySpecEdit sets editing", editing === true);
  check(
    "R1-003: beginQualitySpecEdit returns canonical flow id",
    flow === QUALITY_SPEC_EDIT_FLOW
  );
  check(
    "R1-003: AssistantShell uses beginQualitySpecEdit",
    shell.includes("beginQualitySpecEdit")
  );
  check(
    "R1-003: EstimatePanel and Quality card share handleQualityEdit",
    shell.includes("onEditQuality={qualitySubmitted ? handleQualityEdit") &&
      shell.includes("onAction={qualitySubmitted ? handleQualityEdit")
  );
  check(
    "R1-003: Quality card forceExpanded while editing",
    shell.includes("forceExpanded={isEditingQuality}")
  );

  // --- R1-004 client propagation ---
  const projectActions = read("lib/projects/actions.ts");
  check(
    "R1-004: updateProject syncs pricing_documents client fields",
    projectActions.includes("pricing_documents") &&
      projectActions.includes("client_name")
  );
  check(
    "R1-004: updateProject does not touch quotes table",
    !/from\("quotes"\)/.test(projectActions)
  );

  const pricingActions = read("lib/pricing/actions.ts");
  check(
    "R1-004: draft/reviewed pricing prefers live project client details",
    pricingActions.includes('mappedDocument.status === "draft"') &&
      pricingActions.includes("mappedDocument.client_name = project.client_name")
  );

  const pricingDetails = read("components/pricing/PricingDetailsCard.tsx");
  const pricingWorkspace = read("components/pricing/PricingWorkspace.tsx");
  check(
    "R1-004: PricingDetailsCard client field is controlled",
    pricingDetails.includes("value={clientName ?? \"\"}") ||
      pricingDetails.includes("value={clientName ?? ''}")
  );
  check(
    "R1-004: dirty client values are not silently overwritten",
    pricingWorkspace.includes("draft.client_name !== undefined")
  );
  check(
    "R1-004: PricingWorkspace adopts refreshed props safely",
    pricingWorkspace.includes("documentDraftRef.current") &&
      pricingWorkspace.includes("initialData.document")
  );

  // --- R1-005 capture hierarchy ---
  const capture = read("components/assistant/ProjectCaptureBlock.tsx");
  check(
    "R1-005: Project Brief job overview label present",
    capture.includes("Project Brief — Job overview")
  );
  check(
    "R1-005: Site Notes ongoing observations label present",
    capture.includes("Site Notes — Ongoing observations")
  );
  check(
    "R1-005: required brief purpose copy present",
    capture.includes("Describe the overall job. Quotr uses this when analysing")
  );
  check(
    "R1-005: required site notes purpose copy present",
    capture.includes("Add individual measurements, access issues")
  );
  check(
    "R1-005: SiteNotesCaptureCard hides duplicate heading",
    capture.includes("showHeading={false}")
  );
  check(
    "R1-005: duplicate footer analysis copy removed",
    !capture.includes("Quotr analyses the project brief and saved site notes together")
  );
  check(
    "R1-005: brief and notes remain separate sources",
    capture.includes("briefText") && capture.includes("SiteNotesCaptureCard")
  );
  check(
    "R1-005: Analyse job button still present for unsaved analysis",
    capture.includes("Analyse job")
  );

  // --- Guards ---
  const migrations = existsSync("supabase/migrations")
    ? readdirSync("supabase/migrations").filter((name) =>
        /3[._-]?1a|r1|preview.remediation/i.test(name)
      )
    : [];
  check("Guard: no R1 migration files added", migrations.length === 0);

  check(
    "Guard: no ISD implementation markers in capture",
    !capture.toLowerCase().includes("intelligent scope discovery")
  );

  const commercialTouched =
    shell.includes("calculateLine") ||
    shell.includes("commercial-engine/calculations");
  check(
    "Guard: AssistantShell does not import commercial calculations",
    !commercialTouched
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

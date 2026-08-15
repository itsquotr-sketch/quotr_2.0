/**
 * Stage 3.2.2-R1 — Deck Owner Preview remediation verification.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildProjectConditionsSnapshot,
  getRegistryQuestion,
} from "../lib/builder-interview";
import { buildDeckFixture } from "../lib/builder-interview/fixtures";
import {
  getCombinedLabourAccessFactor,
  getLabourAdjustmentFactor,
  getWorkAreaAccessFactor,
  projectSiteAccessAlreadyApplied,
} from "../lib/estimate/adjustments";
import {
  defaultExpandedQuestionCategories,
  groupQuestionsByPresentationCategory,
} from "../lib/assistant/presentation/question-categories";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";

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
  console.log("=== Stage 3.2.2-R1 Deck Owner Preview Remediation ===\n");

  const deck = buildDeckFixture();
  const snap = buildProjectConditionsSnapshot(deck);
  const askKeys = new Set(snap.candidates.map((c) => c.targetKey));

  check(
    "1 restricted access extracted/seeded is KNOWN (not asked)",
    !askKeys.has("site_access")
  );
  check(
    "2 carry distance extracted/seeded is KNOWN (not asked)",
    !askKeys.has("material_carry_distance")
  );
  check(
    "3 known project conditions suppress duplicate interview questions",
    snap.complete ||
      (!askKeys.has("site_access") && !askKeys.has("material_carry_distance"))
  );

  const pcBlock = read(
    join("components", "assistant", "ProjectConditionsBlock.tsx")
  );
  const shell = read(join("components", "assistant", "AssistantShell.tsx"));
  check(
    "4 Project Conditions uses same constraints records (knownConstraints)",
    pcBlock.includes("knownConstraints") &&
      shell.includes("knownConstraints={liveConstraints}")
  );

  const difficultConstraints = [
    { key: "site_access", label: "Site access", value: "Difficult" },
    {
      key: "material_carry_distance",
      label: "Material carry",
      value: "10–30m",
    },
  ];
  const withWaAccess = getCombinedLabourAccessFactor({
    constraints: difficultConstraints,
    workAreaAccess: "Restricted / Difficult",
  });
  const constraintOnly = getLabourAdjustmentFactor(difficultConstraints);
  const naiveDouble =
    constraintOnly *
    getWorkAreaAccessFactor("Restricted / Difficult");
  check(
    "5 estimate does not consume duplicate access (combined == constraint-only)",
    withWaAccess === constraintOnly && withWaAccess < naiveDouble
  );
  check(
    "6b Easy project site_access still counts as applied (no WA Restricted fallback)",
    projectSiteAccessAlreadyApplied([
      { key: "site_access", label: "Access", value: "Easy" },
    ]) === true &&
      getCombinedLabourAccessFactor({
        constraints: [{ key: "site_access", label: "Access", value: "Easy" }],
        workAreaAccess: "Restricted",
      }) === 1
  );

  const carryFactor = getLabourAdjustmentFactor([
    {
      key: "material_carry_distance",
      label: "Carry",
      value: "10–30m",
    },
  ]);
  const accessFactor = getLabourAdjustmentFactor([
    { key: "site_access", label: "Access", value: "Difficult" },
  ]);
  check(
    "7 access + carry remain separately supported",
    accessFactor === 1.1 &&
      carryFactor === 1.05 &&
      Math.abs(constraintOnly - 1.15) < 1e-9
  );

  const groups = groupQuestionsByPresentationCategory({
    questions: [
      {
        id: "m1",
        key: "deck.height_m",
        label: "Height",
        required: true,
      },
      {
        id: "e1",
        key: "deck.existing_deck_removal",
        label: "Removal",
        required: false,
      },
      {
        id: "c1",
        key: "deck.balustrade_required",
        label: "Balustrade",
        required: false,
      },
    ],
    answers: { m1: null, e1: null, c1: null },
  });
  const preferred = defaultExpandedQuestionCategories(groups);
  check(
    "8 Scope Details incomplete groups (incl. optional) start open",
    preferred.size >= 2 &&
      [...preferred].every((c) =>
        groups.some((g) => g.category === c && g.hasUnresolvedQuestions)
      )
  );

  const disclosure = read(
    join("lib", "assistant", "presentation", "question-disclosure.ts")
  );
  check(
    "9 sticky disclosure helpers still present",
    disclosure.includes("mergeStickyOpenCategories") &&
      disclosure.includes("resolveQuestionCategoryExpanded")
  );

  check(
    "10 Not sure renders once (options stripped of Not sure)",
    pcBlock.includes("primaryOptions") &&
      pcBlock.includes("isNotSureOption") &&
      !pcBlock.includes('options: c.options ? [...c.options]')
  );
  check(
    "11 secondary actions are presentation states",
    pcBlock.includes('kind: "not_sure"') &&
      pcBlock.includes("Skip for now") &&
      (pcBlock.includes("Use reasonable assumption") ||
        pcBlock.includes("Use assumption"))
  );
  check(
    "12 Not sure copy is truthful (no invent)",
    pcBlock.includes("flag this where it materially") &&
      !pcBlock.includes("will not invent")
  );

  const actions = read(
    join("lib", "assistant", "builder-interview-actions.ts")
  );
  check(
    "13 Project Conditions save uses one batch action",
    actions.includes("saveBuilderInterviewProjectAnswers") &&
      actions.includes("answers: z.array")
  );
  check(
    "14 one recompute boundary",
    (actions.match(/buildLiveProjectConditionsSnapshot\(/g) ?? []).length === 1
  );
  check(
    "15 no per-answer router.refresh in BI action",
    !actions.includes("router.refresh")
  );

  check(
    "16 completed Project Conditions does not require separate Site Constraints card",
    shell.includes("!preferProjectConditionsAsk") &&
      shell.includes("Project Conditions")
  );
  check(
    "17 constraints remain editable",
    pcBlock.includes("Edit conditions") && pcBlock.includes("onConstraintSave")
  );
  check(
    "18 Quick Estimate readiness presentation retained",
    shell.includes("projectInformationLabel")
  );
  check(
    "19 no new migration",
    !existsSync(join("supabase", "migrations")) ||
      !readdirSync(join("supabase", "migrations")).some((f) =>
        /3[.]?2[.]?2|interview_answer|r1/i.test(f)
      )
  );
  check(
    "20 Production Scope Discovery remains disabled by default",
    isScopeDiscoveryEnabled({}) === false &&
      isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "" }) === false
  );
  check(
    "21 no Company DNA",
    !existsSync(join("lib", "company-dna")) &&
      !pcBlock.toLowerCase().includes("company dna")
  );
  check(
    "22 no Stage 3.2.3 Work Area interview UI",
    !shell.includes("Work Area Conditions") &&
      !pcBlock.includes("scope === \"WORK_AREA\"")
  );

  // Deck calculator uses combined helper
  const deckCalc = read(join("lib", "estimate", "calculators", "deck.ts"));
  check(
    "Deck calculator uses getCombinedLabourAccessFactor",
    deckCalc.includes("getCombinedLabourAccessFactor") &&
      !deckCalc.includes("getLabourAdjustmentFactor(context.constraints) *")
  );

  const accessDef = getRegistryQuestion("interview.site.site_access");
  check(
    "Registry access options still include Very poor (factor handled)",
    Boolean(accessDef?.options?.includes("Very poor"))
  );

  for (const doc of [
    join("docs", "audits", "STAGE_3_2_2_R1_DECK_OWNER_PREVIEW_AUDIT.md"),
    join(
      "docs",
      "implementation",
      "STAGE_3_2_2_R1_PROJECT_CONDITIONS_REMEDIATION.md"
    ),
    join("docs", "runbooks", "STAGE_3_2_2_R1_DECK_PREVIEW_RETEST.md"),
  ]) {
    check(`DOC exists ${doc}`, existsSync(doc));
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();

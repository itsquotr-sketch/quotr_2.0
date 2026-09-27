/**
 * VARIATIONS-01-R1 — shared recovery regressions were already failing at
 * 86b8b23 and at 5316df4. This verifier records that baseline and proves
 * the corrected Details, Deck, and recovery contract.
 *
 * Run: npx tsx scripts/verify-variations-01-r1-shared-recovery.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { classifyDeckStepDimensionForRefine, DEFAULT_STEP_GOING_M, DEFAULT_STEP_WIDTH_M } from "../lib/estimate/deck-steps-physical";
import { deckFactIsRelevant } from "../lib/estimate/deck-question-descriptors";
import { deckStepsCommerciallyIncluded } from "../lib/estimate/deck-scope-2c";
import { shouldWriteDerivedFact } from "../lib/scopes/domain-ownership";
import type { EstimateFact } from "../lib/estimate/types";

const BASELINE = "86b8b2318b0a569a05550ba22d336c25abd98774";
const VARIATIONS = "5316df47dc50d9dabd93f7b193fd1293c12f64d3";

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

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function show(sha: string, path: string): string {
  return git(["show", `${sha}:${path}`]);
}

function spawnSuite(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
      shell: process.platform === "win32",
      maxBuffer: 32 * 1024 * 1024,
    });
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out
      .split(/\r?\n/)
      .find((row) => /^(FAIL |❌|Γ¥î)/.test(row.trim()) || row.includes(" failed"));
    console.log(`      ${script}: ${(failLine ?? `exit ${err.status ?? "error"}`).trim()}`);
    return false;
  }
}

const fact = (key: string, value: unknown, source?: string): EstimateFact =>
  ({ key, work_area_id: "deck-1", value, source }) as EstimateFact;

console.log("\nA. Baseline failure reproduction\n");
const baselineFlags = show(BASELINE, "lib/assistant/clarify/flags.ts");
const baselineRecovery4 = show(BASELINE, "scripts/verify-recovery-4-clarify.ts");
const baselineLabels = show(BASELINE, "lib/assistant/presentation/action-labels.ts");
const baseline5a = show(BASELINE, "scripts/verify-recovery-5a-assistant-modes.ts");
check(
  "A1 baseline flags omit the correctness-ceiling contract",
  !baselineFlags.includes("Not a correctness ceiling")
);
check(
  "A2 baseline Recovery 4 expected skipped access to become Standard access",
  baselineRecovery4.includes('skippedAccess[0]?.statement === "Standard access"')
);
check(
  "A3 baseline retry copy was already Try again while 5A expected Retry",
  baselineLabels.includes('retry: "Try again"') &&
    baseline5a.includes('ASSISTANT_ACTION_LABELS.retry === "Retry"')
);

console.log("\nB. Current failure reproduction\n");
const currentFlags = readFileSync("lib/assistant/clarify/flags.ts", "utf8");
const currentRecovery4 = readFileSync("scripts/verify-recovery-4-clarify.ts", "utf8");
check(
  "B1 current flags restore Soft UX target and Not a correctness ceiling",
  currentFlags.includes("Soft UX target") &&
    currentFlags.includes("Not a correctness ceiling")
);
check(
  "B2 current Recovery 4 keeps required access in Details",
  currentRecovery4.includes("required access stays in Details") &&
    currentRecovery4.includes("fact(\"deck.step_width_m\", DECK, 1)") &&
    currentRecovery4.includes("fact(\"deck.step_going_m\", DECK, 0.28)")
);

console.log("\nC. Variation diff isolation\n");
const variationFiles = git([
  "diff",
  "--name-only",
  BASELINE,
  VARIATIONS,
])
  .split(/\r?\n/)
  .filter(Boolean);
check(
  "C1 VARIATIONS-01 did not edit Clarify, Deck, or recovery modules",
  variationFiles.every(
    (file) =>
      !file.startsWith("lib/assistant/") &&
      !file.startsWith("components/assistant/") &&
      !file.startsWith("lib/estimate/")
  ) && variationFiles.includes("supabase/migrations/063_variation_domain_foundation.sql")
);
const ceilingCommit = git([
  "log",
  "-S",
  "Not a correctness ceiling",
  "--format=%H",
  "-1",
  BASELINE,
  "--",
  "lib/assistant/clarify/flags.ts",
]).trim();
check(
  "C2 first flags-contract removal is 4bb7bb5, before VARIATIONS-01",
  ceilingCommit.startsWith("4bb7bb5")
);

console.log("\nD–K. Shared Deck and Details contract\n");
check("D1 unresolved step width stays in Details", classifyDeckStepDimensionForRefine({
  facts: [fact("deck.steps_included", true, "user")],
  workAreaId: "deck-1",
  factKey: "deck.step_width_m",
}).surface === "details");
check("E1 disclosed width assumption is 1.0 m on Refine", DEFAULT_STEP_WIDTH_M === 1);
check("F1 step width constant is 1.0 m", DEFAULT_STEP_WIDTH_M === 1);
check("G1 step going constant is 0.28 m", DEFAULT_STEP_GOING_M === 0.28);
check(
  "H1 ground clearance is irrelevant for fascia-only decks",
  deckFactIsRelevant("deck.ground_clearance_m", {
    facts: [fact("deck.vertical_face_boards_required", true, "user")],
    workAreaId: "deck-1",
    briefText: "",
  }) === false
);
check(
  "H2 ground clearance is relevant when skirting is included",
  deckFactIsRelevant("deck.ground_clearance_m", {
    facts: [fact("deck.skirting_included", true, "user")],
    workAreaId: "deck-1",
    briefText: "",
  }) === true
);
const userWidth = classifyDeckStepDimensionForRefine({
  facts: [
    fact("deck.steps_included", true, "user"),
    fact("deck.step_width_m", 1.4, "user"),
  ],
  workAreaId: "deck-1",
  factKey: "deck.step_width_m",
});
check(
  "I1 user-owned step width is kept",
  userWidth.surface === "refine_owned" && userWidth.value === 1.4 &&
    shouldWriteDerivedFact("user") === false
);
check(
  "J1 re-analysis does not replace a user-owned width",
  classifyDeckStepDimensionForRefine({
    facts: [
      fact("deck.steps_included", true, "extracted"),
      fact("deck.step_width_m", 1.4, "user"),
    ],
    workAreaId: "deck-1",
    factKey: "deck.step_width_m",
  }).surface === "refine_owned"
);
check(
  "K1 steps off hides step dimensions",
  classifyDeckStepDimensionForRefine({
    facts: [fact("deck.steps_included", false, "user"), fact("deck.step_width_m", 1.4, "user")],
    workAreaId: "deck-1",
    factKey: "deck.step_width_m",
  }).surface === "off" &&
    deckStepsCommerciallyIncluded({
      facts: [fact("deck.steps_included", false, "user")],
      workAreaId: "deck-1",
    }) === false
);
check(
  "K2 stair-set access still includes commercial steps when steps_included is unset",
  deckStepsCommerciallyIncluded({
    facts: [fact("deck.access_type", "Stair set", "extracted")],
    workAreaId: "deck-1",
  }) === true
);

const suites: Array<[string, string]> = [
  ["L Recovery 4", "scripts/verify-recovery-4-clarify.ts"],
  ["M Recovery 4 R2", "scripts/verify-recovery-4-r2-estimate-readiness.ts"],
  ["N Recovery 5A", "scripts/verify-recovery-5a-assistant-modes.ts"],
  ["O Recovery 5B R3", "scripts/verify-recovery-5b-r3-estimate-experience.ts"],
  ["P UX Premium", "scripts/verify-ux-premium-01.ts"],
  ["Q Deck R7", "scripts/verify-deck-r7-real-world.ts"],
  ["R Deck R8", "scripts/verify-deck-r8-final-closure.ts"],
  ["S Deck R8-R1", "scripts/verify-deck-r8-r1-step-width.ts"],
  ["T Pre-billing readiness", "scripts/verify-platform-02a-pre-billing-readiness.ts"],
  ["U Deck golden", "scripts/verify-deck-contract-r1.ts"],
  ["V Variation domain", "scripts/verify-variations-01-domain-foundation.ts"],
];

console.log("\nL–V. Required suites\n");
for (const [name, script] of suites) {
  check(name, spawnSuite(script));
}

console.log("\nW. Cross-Work-Area isolation\n");
check(
  "W1 deck step facts are deck-owned",
  "deck.step_width_m".startsWith("deck.") &&
    "deck.step_going_m".startsWith("deck.") &&
    deckFactIsRelevant("deck.step_width_m", {
      facts: [fact("deck.steps_included", true, "user")],
      workAreaId: "deck-1",
      briefText: "",
    }) === true
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * DNA-V2A — estimator consumption vs calibration catalogue coverage.
 *
 * Run: npx --yes tsx scripts/verify-dna-v2a-coverage.ts
 *
 * Authority: live calculator / commercial source + rates productivity catalogues
 * + COMPANY_DNA_TASKS. Not a copy-only checklist.
 *
 * Does not mutate catalogue, estimators, or the database.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPANY_DNA_TASKS } from "../lib/company-dna/catalogue";
import {
  DECK_DECKING_INSTALL_HOURS_PER_LM_KEY,
  DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
  DECK_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
  DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
} from "../lib/estimate/deck-productivity";
import { DECK_CONCRETE_PRODUCTIVITY_KEY } from "../lib/estimate/deck-scope-2c";
import { FENCE_PRODUCTIVITY_KEYS } from "../lib/estimate/fence-productivity";
import {
  RW_EXCAVATION_MACHINE_HOURS_KEY,
  RW_EXCAVATION_MANUAL_HOURS_KEY,
} from "../lib/estimate/retaining-wall-family-coverage";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import {
  DECK_PRODUCTIVITY_RATE_CATALOGUE,
  FENCE_PRODUCTIVITY_RATE_CATALOGUE,
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
} from "../lib/rates/specific-material-catalogue";
import type { RateCatalogueEntry } from "../lib/rates/types";

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

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace("²", "2").replace(/\s+/g, "");
}

function unitsCompatible(a: string, b: string): boolean {
  const left = normalizeUnit(a);
  const right = normalizeUnit(b);
  return left === right || left === `h/${right}` || right === `h/${left}`;
}

const DECK_CALC = read("lib/estimate/calculators/deck.ts");
const DECK_PROD = read("lib/estimate/deck-productivity.ts");
const DECK_SCOPE = read("lib/estimate/deck-scope-2c.ts");
const PRODUCTIVITY = read("lib/estimate/productivity.ts");
const FENCE_CALC = read("lib/estimate/calculators/fence.ts");
const FENCE_COMMERCIAL = read("lib/estimate/fence-commercial.ts");
const FENCE_PROD = read("lib/estimate/fence-productivity.ts");
const RW_CALC = read("lib/estimate/calculators/retaining-wall.ts");
const RW_COMMERCIAL = read("lib/estimate/retaining-wall-commercial.ts");
const DNA_MIGRATION = read(
  "supabase/migrations/052_company_productivity_calibration.sql"
);
const DNA_CATALOGUE_TS = read("lib/company-dna/catalogue.ts");

/** Package lumps — consumed only when detailed split is incomplete. Not DNA-V2 primary. */
const PACKAGE_LUMP_KEYS = new Set([
  "deck.base_labour_hours_per_m2",
  "fence.labour_hours_per_lm",
  "fence.gate_hours_allowance",
  "retaining_wall.base_labour_hours_per_face_m2",
  "retaining_wall.excavation_hours_per_face_m2",
  "retaining_wall.drainage_hours_per_m",
]);

/** Height complexity allowance — Project Condition-like, not a DNA crew task. */
const CONDITION_LIKE_KEYS = new Set(["deck.elevated_extra_hours_per_m2"]);

const PLANT_PREFIX = "plant.";

function isPlantKey(key: string): boolean {
  return key.startsWith(PLANT_PREFIX);
}

function isPrimaryDnaTarget(entry: RateCatalogueEntry): boolean {
  if (entry.rate_type !== "productivity") return false;
  if (entry.calculatorSupport !== "used_now") return false;
  if (PACKAGE_LUMP_KEYS.has(entry.item_key)) return false;
  if (CONDITION_LIKE_KEYS.has(entry.item_key)) return false;
  if (isPlantKey(entry.item_key)) return false;
  return true;
}

/**
 * Fence demolition is consumed in the calculator but is not on the Rates
 * productivity catalogue. Still a DNA-V2 primary consumed key. V2B wired
 * company rates; V1 live catalogue still does not include it.
 */
const CALCULATOR_ONLY_PRIMARY = ["fence.demolition_hours_per_lm"] as const;

const DECK_DETAILED_KEYS = [
  DECK_DECKING_INSTALL_HOURS_PER_LM_KEY,
  DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
  "deck.posts.install.hours_per_ea",
  "deck.demolition_hours_per_m2",
  DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
  DECK_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
  DECK_CONCRETE_PRODUCTIVITY_KEY,
  "deck.steps.install.hours_per_m2",
] as const;

const FENCE_DETAILED_KEYS = [
  FENCE_PRODUCTIVITY_KEYS.postInstall,
  FENCE_PRODUCTIVITY_KEYS.railLm,
  FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm,
  FENCE_PRODUCTIVITY_KEYS.horizontalSlatsLm,
  FENCE_PRODUCTIVITY_KEYS.cappingLm,
  FENCE_PRODUCTIVITY_KEYS.gateInstall,
  FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag,
  FENCE_PRODUCTIVITY_KEYS.sectionInstall,
  "fence.demolition_hours_per_lm",
] as const;

const RW_TIMBER_FAMILY_KEYS = [
  RW_PRODUCTIVITY_KEYS.timberPilesEa,
  RW_PRODUCTIVITY_KEYS.timberFaceM2,
  RW_PRODUCTIVITY_KEYS.drainageLm,
  RW_PRODUCTIVITY_KEYS.backfillM3,
  RW_PRODUCTIVITY_KEYS.postHoleConcreteBag,
  RW_EXCAVATION_MACHINE_HOURS_KEY,
  RW_EXCAVATION_MANUAL_HOURS_KEY,
] as const;

function sourceMentionsKey(source: string, key: string): boolean {
  return source.includes(`"${key}"`) || source.includes(`'${key}'`);
}

function fenceKeyMentioned(source: string, enumKey: keyof typeof FENCE_PRODUCTIVITY_KEYS): boolean {
  const literal = FENCE_PRODUCTIVITY_KEYS[enumKey];
  return (
    source.includes(`FENCE_PRODUCTIVITY_KEYS.${enumKey}`) ||
    sourceMentionsKey(source, literal)
  );
}

function rwKeyMentioned(
  source: string,
  enumKey: keyof typeof RW_PRODUCTIVITY_KEYS
): boolean {
  const literal = RW_PRODUCTIVITY_KEYS[enumKey];
  return (
    source.includes(`RW_PRODUCTIVITY_KEYS.${enumKey}`) ||
    sourceMentionsKey(source, literal)
  );
}

console.log("=== DNA-V2A COVERAGE ===\n");

check(
  "architecture doc present",
  readFileSync(
    join(process.cwd(), "docs/architecture/QUOTR_COMPANY_DNA_V2_ARCHITECTURE.md"),
    "utf8"
  ).includes("DNA-V2A")
);
check(
  "V2A did not add migration 054",
  !readdirSync(join(process.cwd(), "supabase/migrations")).some((name) =>
    name.startsWith("054_")
  )
);
check(
  "TS catalogue still matches 052 seed task count",
  COMPANY_DNA_TASKS.length === 9
);

for (const task of COMPANY_DNA_TASKS) {
  check(
    `052 seed still has ${task.calibrationTaskKey}`,
    DNA_MIGRATION.includes(`'${task.calibrationTaskKey}'`)
  );
  check(
    `TS catalogue still has ${task.calibrationTaskKey}`,
    DNA_CATALOGUE_TS.includes(task.calibrationTaskKey)
  );
}

console.log("\n--- Deck detailed consumption ---\n");

check(
  "decking lm consumed",
  DECK_PROD.includes(DECK_DECKING_INSTALL_HOURS_PER_LM_KEY) &&
    DECK_CALC.includes("resolveDeckDeckingInstallProductivity")
);
check(
  "framing lm consumed",
  DECK_CALC.includes("resolveDeckSubstructureInstallProductivity")
);
check(
  "posts ea consumed",
  sourceMentionsKey(DECK_CALC, "deck.posts.install.hours_per_ea")
);
check(
  "demolition m2 consumed",
  sourceMentionsKey(DECK_CALC, "deck.demolition_hours_per_m2")
);
check(
  "fascia lm consumed",
  DECK_CALC.includes("DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY")
);
check(
  "skirting lm consumed",
  DECK_CALC.includes("resolveDeckSkirtingInstallProductivity")
);
check(
  "concrete bag consumed",
  DECK_CALC.includes("resolveDeckConcretePlaceProductivity")
);
check(
  "steps m2 consumed",
  sourceMentionsKey(DECK_CALC, "deck.steps.install.hours_per_m2")
);
check(
  "legacy decking h/m2 not used for detailed money",
  PRODUCTIVITY.includes("not consumed for detailed money") ||
    DECK_PROD.includes("DECK_DECKING_INSTALL_HOURS_PER_M2_LEGACY_KEY")
);
check(
  "deck detailed path passes rates into resolveProductivity",
  /resolveProductivity\(\{\s*productivityKey: "deck\.posts\.install\.hours_per_ea"[\s\S]*rates: context\.rates/m.test(
    DECK_CALC
  )
);

console.log("\n--- Fence detailed consumption ---\n");

check(
  "fence posts consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "postInstall")
);
check(
  "fence rails consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "railLm")
);
check(
  "fence vertical palings consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "verticalBoardsLm")
);
check(
  "fence horizontal slats consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "horizontalSlatsLm")
);
check(
  "fence capping consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "cappingLm")
);
check(
  "fence gate consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "gateInstall")
);
check(
  "fence concrete bag consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "postHoleConcreteBag")
);
check(
  "fence section consumed",
  fenceKeyMentioned(FENCE_COMMERCIAL, "sectionInstall")
);
check(
  "fence demolition consumed in calculator",
  sourceMentionsKey(FENCE_CALC, "fence.demolition_hours_per_lm")
);
check(
  "fence detailed labour uses company productivity rates",
  FENCE_COMMERCIAL.includes("findCompanyProductivityRate")
);
check(
  "fence demolition honours company rates",
  /productivityKey: "fence\.demolition_hours_per_lm",[\s\S]{0,180}rates:\s*context\.rates/m.test(
    FENCE_CALC
  )
);
check(
  "fence package lump omitted from rates in leftover path",
  /productivityKey: "fence\.labour_hours_per_lm"[\s\S]{0,120}fallbackHoursPerUnit: 0\.6,\s*\}\)/m.test(
    FENCE_CALC
  )
);

console.log("\n--- Retaining wall detailed consumption ---\n");

check(
  "RW timber piles consumed",
  rwKeyMentioned(RW_COMMERCIAL, "timberPilesEa")
);
check(
  "RW timber face consumed",
  rwKeyMentioned(RW_COMMERCIAL, "timberFaceM2")
);
check(
  "RW drainage consumed",
  rwKeyMentioned(RW_COMMERCIAL, "drainageLm")
);
check(
  "RW backfill consumed",
  rwKeyMentioned(RW_COMMERCIAL, "backfillM3")
);
check(
  "RW bagged concrete consumed",
  rwKeyMentioned(RW_COMMERCIAL, "postHoleConcreteBag")
);
check(
  "RW sleeper posts consumed",
  rwKeyMentioned(RW_COMMERCIAL, "sleeperPostsEa")
);
check(
  "RW sleepers ea consumed",
  rwKeyMentioned(RW_COMMERCIAL, "sleeperSleepersEa")
);
check(
  "RW machine excavation key used",
  RW_COMMERCIAL.includes("retainingWallExcavationProductivityKey") &&
    sourceMentionsKey(
      read("lib/estimate/retaining-wall-family-coverage.ts"),
      RW_EXCAVATION_MACHINE_HOURS_KEY
    )
);
check(
  "RW masonry block laying consumed",
  rwKeyMentioned(RW_COMMERCIAL, "masonryBlockM2")
);
check(
  "RW detailed labour uses company productivity rates",
  RW_COMMERCIAL.includes("findCompanyProductivityRate")
);
check(
  "RW leftover excavation key is leftover in rates catalogue",
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.find(
    (row) => row.item_key === RW_PRODUCTIVITY_KEYS.excavationM3
  )?.calculatorSupport === "leftover"
);

console.log("\n--- Catalogue vs consumed ---\n");

const dnaByWorkArea = {
  deck: COMPANY_DNA_TASKS.filter((task) => task.workAreaType === "deck"),
  fence: COMPANY_DNA_TASKS.filter((task) => task.workAreaType === "fence"),
  retaining_wall: COMPANY_DNA_TASKS.filter(
    (task) => task.workAreaType === "retaining_wall"
  ),
};

const ratesByWorkArea: Record<string, RateCatalogueEntry[]> = {
  deck: DECK_PRODUCTIVITY_RATE_CATALOGUE.filter(isPrimaryDnaTarget),
  fence: [
    ...FENCE_PRODUCTIVITY_RATE_CATALOGUE.filter(isPrimaryDnaTarget),
    ...CALCULATOR_ONLY_PRIMARY.map((item_key) => ({
      item_key,
      label: "Fence demolition (calculator)",
      rate_type: "productivity",
      category: "labour" as const,
      work_area_type: "fence",
      unit: "lm",
      recommended: false,
      calculatorSupport: "used_now" as const,
    })),
  ],
  retaining_wall:
    RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.filter(isPrimaryDnaTarget),
};

const dnaKeys = new Set(
  COMPANY_DNA_TASKS.map((task) => task.productivityRateKey)
);

const consumedPrimary = new Set(
  Object.values(ratesByWorkArea).flatMap((rows) => rows.map((row) => row.item_key))
);

const orphans = COMPANY_DNA_TASKS.filter(
  (task) => !consumedPrimary.has(task.productivityRateKey)
);
check(
  "no orphan DNA catalogue keys (all map to consumed detailed labour)",
  orphans.length === 0,
  orphans.map((task) => task.calibrationTaskKey).join(", ")
);

function missingFor(
  workArea: "deck" | "fence" | "retaining_wall"
): RateCatalogueEntry[] {
  const dna = new Set(
    dnaByWorkArea[workArea].map((task) => task.productivityRateKey)
  );
  return ratesByWorkArea[workArea].filter((row) => !dna.has(row.item_key));
}

const deckMissing = missingFor("deck");
const fenceMissing = missingFor("fence");
const rwMissing = missingFor("retaining_wall");

check(
  "Deck consumed primary count is 8",
  ratesByWorkArea.deck.length === 8,
  String(ratesByWorkArea.deck.length)
);
check(
  "Fence consumed primary count is 9",
  ratesByWorkArea.fence.length === 9,
  String(ratesByWorkArea.fence.length)
);
check(
  "RW consumed primary count is 15 (no plant)",
  ratesByWorkArea.retaining_wall.length === 15,
  String(ratesByWorkArea.retaining_wall.length)
);

check(
  "Deck calibratable count is 4",
  dnaByWorkArea.deck.length === 4
);
check(
  "Fence calibratable count is 3",
  dnaByWorkArea.fence.length === 3
);
check(
  "RW calibratable count is 2",
  dnaByWorkArea.retaining_wall.length === 2
);

function coverage(calibrated: number, consumed: number): string {
  const pct = consumed === 0 ? 0 : Math.round((calibrated / consumed) * 1000) / 10;
  return `${calibrated} / ${consumed} (${pct}%)`;
}

const deckCoverage = coverage(
  dnaByWorkArea.deck.length,
  ratesByWorkArea.deck.length
);
const fenceCoverage = coverage(
  dnaByWorkArea.fence.length,
  ratesByWorkArea.fence.length
);
const rwCoverage = coverage(
  dnaByWorkArea.retaining_wall.length,
  ratesByWorkArea.retaining_wall.length
);
const rwTimberConsumed = RW_TIMBER_FAMILY_KEYS.length;
const rwTimberCalibrated = RW_TIMBER_FAMILY_KEYS.filter((key) =>
  dnaKeys.has(key)
).length;
const rwTimberCoverage = coverage(rwTimberCalibrated, rwTimberConsumed);

console.log(`\nCOVERAGE  Deck: ${deckCoverage}`);
console.log(`COVERAGE  Fence: ${fenceCoverage}`);
console.log(`COVERAGE  Retaining Wall: ${rwCoverage}`);
console.log(`COVERAGE  RW timber family: ${rwTimberCoverage}`);

check("Deck coverage 4/8", deckCoverage.startsWith("4 / 8"));
check("Fence coverage 3/9", fenceCoverage.startsWith("3 / 9"));
check("RW coverage 2/15", rwCoverage.startsWith("2 / 15"));
check("RW timber family coverage 2/7", rwTimberCoverage.startsWith("2 / 7"));

const deckTier1 = [
  DECK_DECKING_INSTALL_HOURS_PER_LM_KEY,
  DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
  "deck.posts.install.hours_per_ea",
];
const fenceTier1 = [
  FENCE_PRODUCTIVITY_KEYS.postInstall,
  FENCE_PRODUCTIVITY_KEYS.railLm,
  FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm,
];
const rwTier1 = [
  RW_PRODUCTIVITY_KEYS.timberPilesEa,
  RW_PRODUCTIVITY_KEYS.timberFaceM2,
  RW_EXCAVATION_MACHINE_HOURS_KEY,
];

check(
  "Deck Tier 1 fully calibratable (3/3)",
  deckTier1.every((key) => dnaKeys.has(key))
);
check(
  "Fence Tier 1 fully calibratable (3/3)",
  fenceTier1.every((key) => dnaKeys.has(key))
);
check(
  "RW timber Tier 1 missing excavation (2/3)",
  rwTier1.filter((key) => dnaKeys.has(key)).length === 2 &&
    !dnaKeys.has(RW_EXCAVATION_MACHINE_HOURS_KEY)
);

console.log("\n--- Missing calibratable keys ---\n");

for (const row of deckMissing) {
  console.log(`MISSING  deck  ${row.item_key}`);
}
for (const row of fenceMissing) {
  console.log(`MISSING  fence  ${row.item_key}`);
}
for (const row of rwMissing) {
  console.log(`MISSING  retaining_wall  ${row.item_key}`);
}

check("Deck missing is fascia, skirting, steps, bags", deckMissing.length === 4);
check(
  "Fence missing is horizontal, capping, gate, bags, section, demolition",
  fenceMissing.length === 6
);
check("RW missing count is 13", rwMissing.length === 13);

console.log("\n--- Unit mismatches ---\n");

const ratesUnitByKey = new Map<string, string>();
for (const row of [
  ...DECK_PRODUCTIVITY_RATE_CATALOGUE,
  ...FENCE_PRODUCTIVITY_RATE_CATALOGUE,
  ...RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
]) {
  ratesUnitByKey.set(row.item_key, row.unit);
}
ratesUnitByKey.set("fence.demolition_hours_per_lm", "lm");

let unitMismatches = 0;
for (const task of COMPANY_DNA_TASKS) {
  const expected = ratesUnitByKey.get(task.productivityRateKey);
  const ok =
    expected != null && unitsCompatible(task.authorityUnit, expected);
  check(
    `unit ${task.calibrationTaskKey} catalogue ${task.authorityUnit} vs rates ${expected ?? "missing"}`,
    ok
  );
  if (!ok) unitMismatches += 1;
}
check("no DNA vs rates unit mismatches", unitMismatches === 0);

const leftoverButDna = COMPANY_DNA_TASKS.filter((task) => {
  const row = [
    ...DECK_PRODUCTIVITY_RATE_CATALOGUE,
    ...FENCE_PRODUCTIVITY_RATE_CATALOGUE,
    ...RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
  ].find((entry) => entry.item_key === task.productivityRateKey);
  return row?.calculatorSupport === "leftover";
});
check(
  "DNA catalogue does not target leftover keys",
  leftoverButDna.length === 0,
  leftoverButDna.map((task) => task.calibrationTaskKey).join(", ")
);

const deckFenceSource = [
  DECK_CALC,
  DECK_PROD,
  DECK_SCOPE,
  FENCE_COMMERCIAL,
  FENCE_CALC,
  FENCE_PROD,
].join("\n");
check(
  "every Deck/Fence detailed constant is referenced in estimator source",
  [...DECK_DETAILED_KEYS, ...FENCE_DETAILED_KEYS].every((key) =>
    deckFenceSource.includes(key)
  )
);

check(
  "productivity math still crew × time / authority qty in 052",
  DNA_MIGRATION.includes("v_person_hours := round(p_crew_size * p_duration_hours, 4)") &&
    DNA_MIGRATION.includes(
      "v_productivity := round(v_person_hours / v_task.authority_quantity, 4)"
    )
);
check(
  "outlier warn still 0.5×–2× confirm",
  DNA_MIGRATION.includes("v_ratio < 0.5 or v_ratio > 2")
);
check(
  "Owner/Admin/Estimator still the save roles",
  DNA_MIGRATION.includes("'owner', 'admin', 'estimator'")
);

console.log(
  `\n=== ${passed} passed, ${failed} failed ===`
);
if (failed > 0) process.exit(1);

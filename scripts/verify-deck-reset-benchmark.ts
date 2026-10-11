/**
 * Isolated proof of "Use Quotr benchmark" / Clear calibration.
 *
 * Does not call Preview and does not touch a saved organisation.
 * The server function deactivates a calibrated row. It does not insert
 * the task comparison figure as a company rate.
 *
 * Run: npx --yes tsx scripts/verify-deck-reset-benchmark.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import { dnaRatesBenchmarkCopy, dnaRatesResetAction } from "../lib/company-dna/copy";
import { getCompanyDnaFoundationTask } from "../lib/company-dna/v2-foundation";
import {
  OWNER_DECK_DECKING_HOURS_PER_M2,
  deckDeckingHoursPerLm,
  resolveDeckConcretePlaceProductivity,
  resolveDeckDeckingInstallProductivity,
} from "../lib/estimate/deck-productivity";
import { DECK_CONCRETE_PLACE_HOURS_PER_BAG } from "../lib/estimate/deck-scope-2c";

type StoredRow = {
  item_key: string;
  source: "calibrated_productivity" | "explicit_company";
  cost_rate: number;
  unit: string;
  active: boolean;
};

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean) {
  if (ok) {
    passed += 1;
    console.log(`ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

function resetCalibrated(rows: StoredRow[], itemKey: string): StoredRow[] {
  return rows.map((row) =>
    row.active &&
    row.source === "calibrated_productivity" &&
    row.item_key === itemKey
      ? { ...row, active: false }
      : row
  );
}

function toRates(rows: StoredRow[]): OrganisationRate[] {
  return rows.map((row) => ({
    id: row.item_key,
    rate_type: "productivity",
    item_key: row.item_key,
    label: row.item_key,
    unit: row.unit,
    cost_rate: row.cost_rate,
    sell_rate: null,
    markup_percent: null,
    active: row.active,
    trade: null,
    work_area_type: "deck",
    source: row.source,
  }));
}

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/052_company_productivity_calibration.sql"),
  "utf8"
);
const resetSql = sql.slice(
  sql.indexOf("create or replace function public.reset_productivity_to_benchmark"),
  sql.indexOf("comment on function public.reset_productivity_to_benchmark")
);
check("reset function deactivates calibrated rows", resetSql.includes("active = false"));
check(
  "reset function only targets calibrated_productivity",
  resetSql.includes("source = 'calibrated_productivity'")
);
check("reset function does not insert a rate", !resetSql.includes("insert into public.rates"));
check(
  "reset function does not copy benchmark_productivity onto a rate",
  !resetSql.includes("benchmark_productivity")
);

const decking = getCompanyDnaFoundationTask("deck.decking.v1")!;
const concrete = getCompanyDnaFoundationTask("deck.concrete.v1")!;
const posts = getCompanyDnaFoundationTask("deck.posts.v1")!;
const framing = getCompanyDnaFoundationTask("deck.framing.v1")!;
const fascia = getCompanyDnaFoundationTask("deck.fascia.v1")!;
const deckingReset = dnaRatesResetAction(decking.calibrationTaskKey);
const concreteReset = dnaRatesResetAction(concrete.calibrationTaskKey);
check(
  "decking action does not offer to store 0.077",
  deckingReset.cta === "Clear calibration" &&
    deckingReset.explanation.includes("does not store 0.077") &&
    deckingReset.explanation.includes("35 min/m²")
);
check(
  "concrete action names the approved bag rate",
  concreteReset.cta === "Use Quotr benchmark" &&
    concreteReset.explanation.includes("4 minutes per bag") &&
    concreteReset.explanation.includes("typed company hours/bag rate")
);
const postsCopy = dnaRatesBenchmarkCopy(posts);
const framingCopy = dnaRatesBenchmarkCopy(framing);
const fasciaCopy = dnaRatesBenchmarkCopy(fascia);
check(
  "posts card shows the approved 1 h/ea, not the 0.2 comparison",
  posts.benchmarkProductivity === 0.2 &&
    postsCopy.value.startsWith("1 ") &&
    (postsCopy.note ?? "").includes("0.2 h/ea")
);
check(
  "framing card keeps 0.13 as comparison only",
  framing.benchmarkProductivity === 0.13 &&
    framingCopy.value.includes("0.17 h/lm") &&
    (framingCopy.note ?? "").includes("0.13 h/lm")
);
check(
  "fascia card keeps 0.45 as comparison only",
  fascia.benchmarkProductivity === 0.45 &&
    fasciaCopy.value.includes("0.1 h/lm") &&
    (fasciaCopy.note ?? "").includes("0.45 h/lm")
);

const calibratedLm: StoredRow = {
  item_key: "deck.decking.install.hours_per_lm",
  source: "calibrated_productivity",
  cost_rate: 0.12,
  unit: "lm",
  active: true,
};
const beforeDecking = [calibratedLm];
const afterDecking = resetCalibrated(beforeDecking, calibratedLm.item_key);
console.log("decking rows before", beforeDecking);
console.log("decking rows after", afterDecking);
const before140 = resolveDeckDeckingInstallProductivity(toRates(beforeDecking), 140);
const before90 = resolveDeckDeckingInstallProductivity(toRates(beforeDecking), 90);
const after140 = resolveDeckDeckingInstallProductivity(toRates(afterDecking), 140);
const after90 = resolveDeckDeckingInstallProductivity(toRates(afterDecking), 90);
const expected140 = deckDeckingHoursPerLm(OWNER_DECK_DECKING_HOURS_PER_M2, 140);
const expected90 = deckDeckingHoursPerLm(OWNER_DECK_DECKING_HOURS_PER_M2, 90);
check("before reset, 140 mm uses the saved 0.12 h/lm", before140.hoursPerUnit === 0.12);
check("before reset, 90 mm also uses the saved 0.12 h/lm", before90.hoursPerUnit === 0.12);
check(
  "after reset, 140 mm uses 35 min/m² × 0.14 m",
  Math.abs(after140.hoursPerUnit - expected140) < 1e-12 &&
    after140.hoursPerUnit !== 0.077
);
check(
  "after reset, 90 mm uses 35 min/m² × 0.09 m",
  Math.abs(after90.hoursPerUnit - expected90) < 1e-12 &&
    after90.hoursPerUnit !== expected140
);
check(
  "reset does not create a 0.077 company row",
  afterDecking.every((row) => row.cost_rate !== 0.077) &&
    afterDecking.filter((row) => row.active).length === 0
);

const explicitLm: StoredRow = {
  item_key: "deck.decking.install.hours_per_lm",
  source: "explicit_company",
  cost_rate: 0.2,
  unit: "lm",
  active: true,
};
const explicitAfter = resetCalibrated([explicitLm], explicitLm.item_key);
const explicit140 = resolveDeckDeckingInstallProductivity(toRates(explicitAfter), 140);
const explicit90 = resolveDeckDeckingInstallProductivity(toRates(explicitAfter), 90);
check(
  "a typed company hours/lm rate survives and wins at both widths",
  explicitAfter[0]?.active === true &&
    explicit140.hoursPerUnit === 0.2 &&
    explicit90.hoursPerUnit === 0.2
);

const calibratedBag: StoredRow = {
  item_key: "deck.post_hole_concrete.place.hours_per_bag",
  source: "calibrated_productivity",
  cost_rate: 0.2,
  unit: "bag",
  active: true,
};
const beforeBags = [calibratedBag];
const afterBags = resetCalibrated(beforeBags, calibratedBag.item_key);
console.log("concrete rows before", beforeBags);
console.log("concrete rows after", afterBags);
const beforeConcrete = resolveDeckConcretePlaceProductivity(toRates(beforeBags));
const afterConcrete = resolveDeckConcretePlaceProductivity(toRates(afterBags));
check("before reset, concrete uses the saved 0.2 h/bag", beforeConcrete.hoursPerUnit === 0.2);
check(
  "after reset, concrete uses 4 minutes per bag",
  afterConcrete.hoursPerUnit === DECK_CONCRETE_PLACE_HOURS_PER_BAG
);
check(
  "20 bags before and after",
  beforeConcrete.hoursPerUnit * 20 === 4 &&
    Math.abs(afterConcrete.hoursPerUnit * 20 - 20 * (4 / 60)) < 1e-12
);
const explicitBag: StoredRow = {
  item_key: "deck.post_hole_concrete.place.hours_per_bag",
  source: "explicit_company",
  cost_rate: 0.05,
  unit: "bag",
  active: true,
};
const explicitBagAfter = resetCalibrated([explicitBag], explicitBag.item_key);
const explicitConcrete = resolveDeckConcretePlaceProductivity(toRates(explicitBagAfter));
check(
  "a typed company hours/bag rate survives",
  explicitBagAfter[0]?.active === true && explicitConcrete.hoursPerUnit === 0.05
);

console.log("\nresolved h/lm 140 before", before140.hoursPerUnit, "after", after140.hoursPerUnit);
console.log("resolved h/lm 90 before", before90.hoursPerUnit, "after", after90.hoursPerUnit);
console.log(
  "resolved h/bag before",
  beforeConcrete.hoursPerUnit,
  "after",
  afterConcrete.hoursPerUnit
);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

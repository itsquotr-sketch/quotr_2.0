/**
 * Reconcile calculator keys, catalogue rows, and productivity maps.
 * Prints overlap. Does not invent costs.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import { APPROVED_PRODUCTIVITY, UNRESOLVED_PRODUCTIVITY_KEYS } from "../lib/rates/approved-benchmark-review";
import { APPROVED_MATERIAL_COSTS } from "../lib/rates/approved-material-costs";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".ts")) out.push(path);
  }
  return out;
}

const keyRe = /["'`]([a-z][a-z0-9_]*(?:\.[a-z0-9_]+){2,})["'`]/g;
const files = walk("lib/estimate/calculators").concat(walk("lib/estimate"));
const referenced = new Set<string>();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(keyRe)) referenced.add(match[1]!);
}

const catalogue = new Map(FULL_RATE_CATALOGUE.map((entry) => [entry.item_key, entry]));
const productivityReferenced = [...referenced].filter((key) => key.includes("hours_per") || key.endsWith("_hours"));
const materialish = [...referenced].filter((key) => !productivityReferenced.includes(key));

const productivityAbsentFromApproved = productivityReferenced.filter(
  (key) => !(key in APPROVED_PRODUCTIVITY) && !UNRESOLVED_PRODUCTIVITY_KEYS.includes(key as never)
);
const calculatorOutsideCatalogue = [...referenced].filter((key) => !catalogue.has(key));
const referencedWithoutBenchmark = materialish.filter((key) => {
  const entry = catalogue.get(key);
  const approved = APPROVED_MATERIAL_COSTS[key];
  return !approved && !(entry && entry.defaultCostRate != null && entry.defaultCostRate > 0);
});

console.log(JSON.stringify({
  referenced: referenced.size,
  productivityReferenced: productivityReferenced.length,
  productivityAbsentFromApprovedMap: productivityAbsentFromApproved.sort(),
  calculatorOutsideCatalogue: calculatorOutsideCatalogue.sort(),
  referencedMaterialWithoutBenchmark: referencedWithoutBenchmark.sort(),
}, null, 2));

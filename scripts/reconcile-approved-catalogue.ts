/**
 * Compare workbook approvals with catalogue amounts at 1cfa7d2, b0b68e8, and HEAD.
 * Run: npx --yes tsx scripts/reconcile-approved-catalogue.ts
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { APPROVED_PRODUCTIVITY } from "../lib/rates/approved-benchmark-review";

const manifest = JSON.parse(
  readFileSync("docs/benchmark-review/decision-manifest.json", "utf8")
);

function literals(rev: string): Map<string, number> {
  const text = execSync(`git show ${rev}:lib/rates/specific-material-catalogue.ts`, {
    encoding: "utf8",
  });
  const map = new Map<string, number>();
  const re =
    /item_key:\s*"([^"]+)"[\s\S]{0,900}?defaultCostRate:\s*([0-9]+(?:\.[0-9]+)?)/g;
  for (const match of text.matchAll(re)) {
    map.set(match[1], Number(match[2]));
  }
  return map;
}

const parent = literals("1cfa7d24a437f8955143d100083d6e93eaab115e");
const previous = literals("b0b68e894a4825328a2179edef95bdf6feac14b3");

const materials = [];
for (const row of manifest.materials) {
  if (typeof row.approvedValue !== "number") continue;
  const current = getCatalogueEntry(row.key)?.defaultCostRate ?? null;
  materials.push({
    workbookRow: row.workbookRow,
    key: row.key,
    unit: row.unit,
    approvedExGst: row.approvedValue,
    parentLiteral: parent.get(row.key) ?? null,
    atB0b68e8Literal: previous.get(row.key) ?? null,
    currentCatalogue: current,
    currentMatchesApproved:
      current != null && Math.abs(current - row.approvedValue) < 0.001,
  });
}

const productivity = [];
const previousAuthority = execSync(
  "git show b0b68e894a4825328a2179edef95bdf6feac14b3:lib/rates/approved-benchmark-review.ts",
  { encoding: "utf8" }
);
const previousHours = new Map<string, number>();
for (const match of previousAuthority.matchAll(
  /"([^"]+)": \{ hoursPerUnit: ([0-9.]+)/g
)) {
  previousHours.set(match[1], Number(match[2]));
}
for (const row of manifest.productivity) {
  if (typeof row.approvedConversion !== "number") continue;
  const current = APPROVED_PRODUCTIVITY[row.key]?.hoursPerUnit ?? null;
  productivity.push({
    workbookRow: row.workbookRow,
    key: row.key,
    unit: row.unit,
    workbookConversion: row.approvedConversion,
    atB0b68e8: previousHours.get(row.key) ?? null,
    currentApproved: current,
    ownerHours: row.ownerHoursPerUnit ?? null,
    appliedResult: row.appliedResult,
  });
}

const materialExceptions = materials.filter((row) => !row.currentMatchesApproved);
const out = {
  materialNumericRows: materials.length,
  materialUniqueKeys: new Set(materials.map((row) => row.key)).size,
  materialCurrentMatchesApproved: materials.filter((row) => row.currentMatchesApproved)
    .length,
  materialExceptions,
  productivityNumericRows: productivity.length,
  productivity,
};
writeFileSync(
  "docs/benchmark-review/catalogue-reconciliation.json",
  JSON.stringify(out, null, 2) + "\n"
);
console.log(
  JSON.stringify(
    {
      materialNumericRows: out.materialNumericRows,
      materialUniqueKeys: out.materialUniqueKeys,
      materialCurrentMatchesApproved: out.materialCurrentMatchesApproved,
      exceptionCount: materialExceptions.length,
      exceptions: materialExceptions.slice(0, 20),
    },
    null,
    2
  )
);

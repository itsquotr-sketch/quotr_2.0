import { readFileSync, writeFileSync } from "fs";

const j = JSON.parse(
  readFileSync("docs/benchmark-review/decision-manifest.json", "utf8")
);
const rows = j.materials.filter((r) => typeof r.approvedValue === "number");
const lines = rows.map(
  (r) =>
    `  ${JSON.stringify(r.key)}: { amount: ${r.approvedValue}, unit: ${JSON.stringify(r.unit)}, workbookRow: ${r.workbookRow} },`
);
const body = `/** Owner-approved material COST, NZD ex GST. Already the reviewed amount. Do not apply another 20%. */
export type ApprovedMaterialCost = {
  readonly amount: number;
  readonly unit: string;
  readonly workbookRow: number;
};

export const APPROVED_MATERIAL_COSTS: Readonly<Record<string, ApprovedMaterialCost>> = {
${lines.join("\n")}
};

function normUnit(unit: string): string {
  return unit
    .toLowerCase()
    .replace(/m²/g, "m2")
    .replace(/litre/g, "l")
    .replace(/^per /, "")
    .trim();
}

/** Approved ex-GST cost when the requested unit is the workbook unit. */
export function approvedMaterialCostExGst(
  itemKey: string,
  unit: string
): number | null {
  const row = APPROVED_MATERIAL_COSTS[itemKey];
  if (!row) return null;
  if (normUnit(row.unit) !== normUnit(unit)) return null;
  return row.amount;
}
`;
writeFileSync("lib/rates/approved-material-costs.ts", body);
console.log("rows", rows.length);

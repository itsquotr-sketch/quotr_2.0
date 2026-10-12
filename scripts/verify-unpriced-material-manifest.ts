/**
 * Material keys with no approved workbook cost.
 * Does not delete rows or rewrite saved estimates.
 * Run: npx tsx scripts/verify-unpriced-material-manifest.ts
 */
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { SPECIFIC_MATERIAL_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { approvedMaterialCostExGst } from "../lib/rates/approved-material-costs";

type Disposition = "retain unpriced" | "owner review";

void calculateDeck;
const rows = SPECIFIC_MATERIAL_RATE_CATALOGUE.filter(
  (entry) => entry.rate_type === "material" || entry.category === "material"
)
  .map((entry) => {
    const approved = approvedMaterialCostExGst(entry.item_key, entry.unit);
    return { entry, approved };
  })
  .filter((row) => row.approved == null)
  .map((row) => {
    const entry = row.entry;
    const cataloguePrice =
      typeof entry.defaultCostRate === "number" && entry.defaultCostRate > 0;
    let disposition: Disposition = "retain unpriced";
    let reason =
      "No approved workbook cost. The product remains in the catalogue. Missing price is not treated as a missing product.";
    if (entry.calculatorSupport === "leftover") {
      disposition = "owner review";
      reason =
        "Legacy or leftover identity. Still referenced, so it is not removed. New selection should keep using the replacement key where one exists.";
    } else if (cataloguePrice) {
      disposition = "owner review";
      reason =
        "Catalogue has a default cost, but the approved workbook amount is blank.";
    }
    return {
      key: entry.item_key,
      product: entry.label,
      unit: entry.unit,
      workArea: entry.work_area_type ?? entry.workAreaLabel ?? "",
      workbookReason: entry.description ?? "",
      catalogueStatus: entry.calculatorSupport ?? "",
      recommended: entry.recommended !== false,
      disposition,
      reason,
    };
  });

const fibre = rows.find((row) => row.key === "sheet.fibre_cement.18mm.2400x1200.each");
if (!fibre || fibre.disposition !== "retain unpriced") {
  console.error("18 mm fibre-cement sheet must stay retain unpriced");
  process.exit(1);
}

console.log(
  ["key", "product", "unit", "workArea", "catalogue", "disposition"].join("\t")
);
for (const row of rows) {
  console.log(
    [row.key, row.product, row.unit, row.workArea, row.catalogueStatus, row.disposition].join(
      "\t"
    )
  );
}
console.log(`\n${rows.length} unpriced material rows`);
console.log(
  `retain ${rows.filter((row) => row.disposition === "retain unpriced").length}, owner review ${rows.filter((row) => row.disposition === "owner review").length}`
);

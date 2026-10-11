import { readFileSync, writeFileSync } from "fs";

const exceptions = JSON.parse(
  readFileSync("docs/benchmark-review/catalogue-reconciliation.json", "utf8")
).materialExceptions;

const rows = exceptions.map((row) => {
  const hadCost = row.currentCatalogue != null;
  return {
    workbookRow: row.workbookRow,
    key: row.key,
    unit: row.unit,
    approvedAmountExGst: row.approvedExGst,
    previousCatalogueAmount: row.currentCatalogue,
    disposition: hadCost
      ? "updated_existing_catalogue_benchmark"
      : "added_approved_cost_on_existing_catalogue_identity",
    finalCatalogueValue: row.approvedExGst,
    source: "Approved cost (20% less), NZD ex GST, not reduced again",
    doubleCharge: row.key.startsWith("sheet.plasterboard.")
      ? "Explicit approved sheet cost is used. Area-ratio derivation is not applied when this catalogue cost exists."
      : row.key.startsWith("deck.material.")
        ? "Detailed deck money uses the lm rate when board width is known. The m² rate is the area fallback only."
        : "One catalogue cost for this key. Company exact still wins.",
  };
});

writeFileSync(
  "docs/benchmark-review/material-gap-manifest.json",
  JSON.stringify(
    {
      numericRows: 258,
      uniqueKeys: 257,
      sharedKey: "timber.pile.125x125.h5.lm workbook rows 186 and 187, both $23.50",
      updatedExisting: rows.filter((row) => row.disposition.startsWith("updated")).length,
      previouslyUnpricedIdentitiesNowPriced: rows.filter((row) =>
        row.disposition.startsWith("added")
      ).length,
      held: [],
      blanksRetainedUnpriced: 65,
      fibreCement18mm: "sheet.fibre_cement.18mm.2400x1200.each remains unpriced",
      rows,
    },
    null,
    2
  )
);
console.log("wrote", rows.length);

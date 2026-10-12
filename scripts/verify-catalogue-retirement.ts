/**
 * Materials review, 12 Oct 2026: no unequivocal nonexistent finding.
 * Run: npx tsx scripts/verify-catalogue-retirement.ts
 */
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { listMaterialsPageCatalogueEntries } from "../lib/rates/material-registry";
import { PRODUCT_IDENTITY_CORRECTION_KEYS } from "../lib/rates/approved-benchmark-review";
import {
  CATALOGUE_IDENTITY_BLOCKS,
  CATALOGUE_RETIRED_NONEXISTENT_KEYS,
  RETAINED_UNPRICED_MATERIAL_KEYS,
} from "../lib/rates/catalogue-retirement";
import { derivedDimensionedPlasterboardCost } from "../lib/estimate/ceilings-plasterboard-derived-cost";

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

const selectable = new Set(listMaterialsPageCatalogueEntries().map((entry) => entry.item_key));
const identityKeys = CATALOGUE_IDENTITY_BLOCKS.map((row) => row.key);

check("retired nonexistent keys are zero", CATALOGUE_RETIRED_NONEXISTENT_KEYS.length === 0);
check(
  "identity blocks match the correction set",
  identityKeys.length === PRODUCT_IDENTITY_CORRECTION_KEYS.size &&
    identityKeys.every((key) => PRODUCT_IDENTITY_CORRECTION_KEYS.has(key))
);
check(
  "identity variants stay out of new Materials selection",
  identityKeys.every((key) => !selectable.has(key))
);
check(
  "historical catalogue rows remain readable",
  identityKeys.every((key) => getCatalogueEntry(key)?.item_key === key) &&
    identityKeys.every((key) => derivedDimensionedPlasterboardCost(key) == null)
);
check(
  "18 mm fibre cement and precast sleeper stay selectable and unpriced",
  RETAINED_UNPRICED_MATERIAL_KEYS.every((key) => selectable.has(key)) &&
    getCatalogueEntry("sheet.fibre_cement.18mm.2400x1200.each")?.defaultCostRate == null &&
    getCatalogueEntry("retaining_wall.sleeper.precast")?.defaultCostRate == null &&
    getCatalogueEntry("retaining_wall.sleeper.precast")?.defaultCostRate !== 36
);
check(
  "identity notes are the workbook sentences",
  CATALOGUE_IDENTITY_BLOCKS.every((row) => row.note.includes("not listed") || row.note.includes("do not match the published product")) &&
    CATALOGUE_IDENTITY_BLOCKS.filter((row) => row.key.includes("barrierline")).every((row) =>
      row.note.includes("25mm x 600mm x 3000mm")
    )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

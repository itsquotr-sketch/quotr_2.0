/**
 * Materials review, live workbook export 12 Oct 2026.
 * Source: https://docs.google.com/spreadsheets/d/1YJssE2lvrQTmoM2Tv9gMT8FzhQEJhYdFvAnLiGyto4k
 *
 * Unequivocal "does not exist" findings: none. Retired keys: none.
 * Product-identity correction is not nonexistence. Those exact variants stay
 * in the catalogue for historical lines and company rates, and are withheld
 * from new Materials selection and from same-family benchmark derivation.
 */
import { PRODUCT_IDENTITY_CORRECTION_KEYS } from "@/lib/rates/approved-benchmark-review";

export const CATALOGUE_RETIRED_NONEXISTENT_KEYS: readonly string[] = [];

const SHEET_NOT_LISTED =
  "This sheet size is not listed for this family/thickness in the current published GIB product-range guide. Existing area-derived rate is not evidence that a purchasable sheet exists. Correct the size or confirm a special manufacture quote before approval.";

const BARRIERLINE_MISMATCH =
  "GIB Barrierline is published as 25mm x 600mm x 3000mm; these 13/16mm x 1200mm identities do not match the published product. Do not assign a substitute dollar rate.";

export type CatalogueIdentityBlock = {
  readonly workbookRow: number;
  readonly key: string;
  readonly note: string;
  readonly status: "Product identity correction required";
  readonly action: "blocked_pending_identity";
};

export const CATALOGUE_IDENTITY_BLOCKS: readonly CatalogueIdentityBlock[] = [
  { workbookRow: 20, key: "sheet.plasterboard.aqualine.10mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 24, key: "sheet.plasterboard.aqualine.13mm.4800x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 25, key: "sheet.plasterboard.aqualine.13mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 27, key: "sheet.plasterboard.barrierline.13mm.2400x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 28, key: "sheet.plasterboard.barrierline.13mm.2700x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 29, key: "sheet.plasterboard.barrierline.13mm.3000x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 30, key: "sheet.plasterboard.barrierline.13mm.3600x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 31, key: "sheet.plasterboard.barrierline.13mm.4800x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 32, key: "sheet.plasterboard.barrierline.13mm.6000x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 33, key: "sheet.plasterboard.barrierline.16mm.2400x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 34, key: "sheet.plasterboard.barrierline.16mm.2700x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 35, key: "sheet.plasterboard.barrierline.16mm.3000x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 36, key: "sheet.plasterboard.barrierline.16mm.3600x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 37, key: "sheet.plasterboard.barrierline.16mm.4800x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 38, key: "sheet.plasterboard.barrierline.16mm.6000x1200.each", note: BARRIERLINE_MISMATCH, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 44, key: "sheet.plasterboard.braceline.10mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 48, key: "sheet.plasterboard.braceline.13mm.4800x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 49, key: "sheet.plasterboard.braceline.13mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 54, key: "sheet.plasterboard.fyreline.13mm.4800x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 55, key: "sheet.plasterboard.fyreline.13mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 59, key: "sheet.plasterboard.fyreline.16mm.3600x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 60, key: "sheet.plasterboard.fyreline.16mm.4800x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 61, key: "sheet.plasterboard.fyreline.16mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 68, key: "sheet.plasterboard.noiseline.10mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 73, key: "sheet.plasterboard.noiseline.13mm.4800x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 74, key: "sheet.plasterboard.noiseline.13mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 87, key: "sheet.plasterboard.weatherline.10mm.2400x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 90, key: "sheet.plasterboard.weatherline.10mm.3600x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 91, key: "sheet.plasterboard.weatherline.10mm.4800x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 92, key: "sheet.plasterboard.weatherline.10mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 93, key: "sheet.plasterboard.weatherline.13mm.2400x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 96, key: "sheet.plasterboard.weatherline.13mm.3600x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 97, key: "sheet.plasterboard.weatherline.13mm.4800x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
  { workbookRow: 98, key: "sheet.plasterboard.weatherline.13mm.6000x1200.each", note: SHEET_NOT_LISTED, status: "Product identity correction required", action: "blocked_pending_identity" },
];

export const RETAINED_UNPRICED_MATERIAL_KEYS = [
  "sheet.fibre_cement.18mm.2400x1200.each",
  "retaining_wall.sleeper.precast",
] as const;

export function catalogueKeyBlockedFromNewSelection(itemKey: string): boolean {
  return (
    CATALOGUE_RETIRED_NONEXISTENT_KEYS.includes(itemKey) ||
    PRODUCT_IDENTITY_CORRECTION_KEYS.has(itemKey)
  );
}

/**
 * A pricing line whose live money was zeroed because a subcontract response
 * replaced it. The original money stays on the RFQ application. This row must
 * not be read as a $0 scope line or as Pricing Required.
 */
export function isReplacedSubcontractPlaceholder(item: {
  recalibration_note?: string | null;
  total_cost?: number | null;
  total_sell?: number | null;
}): boolean {
  return (
    (item.recalibration_note ?? "").startsWith("Replaced for draft pricing") &&
    Number(item.total_cost ?? 0) === 0 &&
    Number(item.total_sell ?? 0) === 0
  );
}

/** A confirmed supplier allowance is not an ordinary pricing calculation. */

export const SUPPLIER_PRICE_REVIEW =
  "This line is a confirmed supplier price. Review the supplier price to change the cost or the client sell.";

function sameNumber(left: unknown, right: unknown): boolean {
  if (left == null && (right == null || right === "")) return true;
  if (right == null && (left == null || left === "")) return true;
  if (left == null || right == null) return false;
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 0.001;
}

function sameText(left: unknown, right: unknown): boolean {
  const a = left == null ? "" : String(left);
  const b = right == null ? "" : String(right);
  return a === b;
}

export type SupplierCommercialRow = {
  quantity: unknown;
  unit: unknown;
  unit_cost: unknown;
  unit_sell: unknown;
  total_cost: unknown;
  total_sell: unknown;
  calculation_mode: unknown;
  item_type: unknown;
  delivery_method: unknown;
  work_area_id: unknown;
  visible_on_quote: unknown;
  optional: unknown;
};

export type SupplierCommercialInput = {
  quantity?: number | null;
  unit?: string | null;
  unit_cost?: number | null;
  unit_sell?: number | null;
  total_cost?: number | null;
  total_sell?: number | null;
  calculation_mode?: string | null;
  item_type?: string | null;
  delivery_method?: string | null;
  work_area_id?: string | null;
  visible_on_quote?: boolean | null;
  optional?: boolean | null;
};

export function supplierCommercialUnchanged(
  existing: SupplierCommercialRow,
  incoming: SupplierCommercialInput
): boolean {
  return (
    sameNumber(existing.quantity, incoming.quantity) &&
    sameText(existing.unit, incoming.unit) &&
    sameNumber(existing.unit_cost, incoming.unit_cost) &&
    sameNumber(existing.unit_sell, incoming.unit_sell) &&
    sameNumber(existing.total_cost, incoming.total_cost) &&
    sameNumber(existing.total_sell, incoming.total_sell) &&
    sameText(existing.calculation_mode, incoming.calculation_mode) &&
    sameText(existing.item_type, incoming.item_type) &&
    sameText(existing.delivery_method, incoming.delivery_method) &&
    sameText(existing.work_area_id, incoming.work_area_id) &&
    Boolean(existing.visible_on_quote) === Boolean(incoming.visible_on_quote ?? true) &&
    Boolean(existing.optional) === Boolean(incoming.optional ?? false)
  );
}

export function supplierTextUnchanged(
  existing: {
    client_label: unknown;
    internal_label: unknown;
    internal_description: unknown;
    client_description: unknown;
    notes_internal: unknown;
    notes_client: unknown;
  },
  incoming: {
    client_label?: string | null;
    internal_label?: string | null;
    internal_description?: string | null;
    client_description?: string | null;
    notes_internal?: string | null;
    notes_client?: string | null;
  }
): boolean {
  return (
    sameText(existing.client_label, incoming.client_label) &&
    sameText(existing.internal_label, incoming.internal_label) &&
    sameText(existing.internal_description, incoming.internal_description) &&
    sameText(existing.client_description, incoming.client_description) &&
    sameText(existing.notes_internal, incoming.notes_internal) &&
    sameText(existing.notes_client, incoming.notes_client)
  );
}

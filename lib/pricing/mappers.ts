import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { parseStringArray } from "@/lib/pricing/calculations";
import type {
  PricingDocument,
  PricingItem,
  PricingWorkArea,
} from "@/lib/pricing/types";

export function mapPricingDocument(row: Record<string, unknown>): PricingDocument {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    project_id: row.project_id as string,
    estimate_id: (row.estimate_id as string | null) ?? null,
    title: row.title as string,
    status: row.status as PricingDocument["status"],
    client_name: (row.client_name as string | null) ?? null,
    site_address: (row.site_address as string | null) ?? null,
    pricing_date: (row.pricing_date as string | null) ?? null,
    valid_until: (row.valid_until as string | null) ?? null,
    subtotal_cost: Number(row.subtotal_cost ?? 0),
    subtotal_sell: Number(row.subtotal_sell ?? 0),
    gross_profit: Number(row.gross_profit ?? 0),
    margin_percent: Number(row.margin_percent ?? 0),
    markup_percent: Number(row.markup_percent ?? 0),
    gst_rate: Number(row.gst_rate ?? 15),
    gst_amount: Number(row.gst_amount ?? 0),
    total_incl_gst: Number(row.total_incl_gst ?? 0),
    scope_summary: (row.scope_summary as string | null) ?? null,
    assumptions: parseStringArray(row.assumptions),
    exclusions: parseStringArray(row.exclusions),
    terms: (row.terms as string | null) ?? null,
    internal_notes: (row.internal_notes as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    converted_to_quote_at:
      (row.converted_to_quote_at as string | null) ?? null,
  };
}

export function mapPricingItem(row: Record<string, unknown>): PricingItem {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    pricing_document_id: row.pricing_document_id as string,
    project_id: row.project_id as string,
    work_area_id: (row.work_area_id as string | null) ?? null,
    source_estimate_line_item_id:
      (row.source_estimate_line_item_id as string | null) ?? null,
    item_type: row.item_type as PricingItem["item_type"],
    delivery_method: row.delivery_method as PricingItem["delivery_method"],
    internal_label: row.internal_label as string,
    client_label: row.client_label as string,
    internal_description: (row.internal_description as string | null) ?? null,
    client_description: (row.client_description as string | null) ?? null,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    unit: (row.unit as string | null) ?? null,
    unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
    unit_sell: row.unit_sell != null ? Number(row.unit_sell) : null,
    total_cost: Number(row.total_cost ?? 0),
    total_sell: Number(row.total_sell ?? 0),
    gross_profit: Number(row.gross_profit ?? 0),
    margin_percent: Number(row.margin_percent ?? 0),
    markup_percent: Number(row.markup_percent ?? 0),
    visible_on_quote: Boolean(row.visible_on_quote ?? true),
    optional: Boolean(row.optional ?? false),
    sort_order: Number(row.sort_order ?? 0),
    notes_internal: (row.notes_internal as string | null) ?? null,
    notes_client: (row.notes_client as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function mapPricingWorkArea(row: Record<string, unknown>): PricingWorkArea {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    sort_order: Number(row.sort_order ?? 0),
  };
}

export function buildScopeSummaryFromWorkAreas(
  workAreaNames: string[],
  briefText?: string | null
): string | null {
  if (workAreaNames.length > 0) {
    return `Pricing prepared for: ${workAreaNames.join(", ")}.`;
  }
  if (briefText?.trim()) {
    return briefText.trim().slice(0, 500);
  }
  return null;
}

export function extractEstimateLineItemDetails(notes: string | null | undefined): {
  internalDescription?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  unitSell?: number;
} {
  const parsed = parseLineItemNotes(notes);
  const metadata = parsed.metadata;
  const quantity = metadata.quantity;
  const unitCost =
    metadata.costRate ??
    (metadata.quantity && metadata.quantity > 0
      ? undefined
      : undefined);
  const unitSell = metadata.sellRate;

  return {
    internalDescription: parsed.displayNotes,
    quantity,
    unit: metadata.unit,
    unitCost,
    unitSell,
  };
}

export function groupItemsByWorkArea(
  items: PricingItem[],
  workAreas: PricingWorkArea[]
): Array<{
  workArea: PricingWorkArea | null;
  items: PricingItem[];
}> {
  const sortedWorkAreas = [...workAreas].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const groups: Array<{ workArea: PricingWorkArea | null; items: PricingItem[] }> =
    sortedWorkAreas.map((workArea) => ({
      workArea,
      items: items
        .filter((item) => item.work_area_id === workArea.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

  const unassigned = items
    .filter(
      (item) =>
        !item.work_area_id ||
        !workAreas.some((workArea) => workArea.id === item.work_area_id)
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  if (unassigned.length > 0) {
    groups.push({ workArea: null, items: unassigned });
  }

  return groups.filter((group) => group.items.length > 0 || group.workArea);
}

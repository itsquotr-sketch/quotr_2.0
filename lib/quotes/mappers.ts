import { parseStringArray } from "@/lib/pricing/calculations";
import type { Quote, QuoteItem } from "@/lib/quotes/types";

export function mapQuote(row: Record<string, unknown>): Quote {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    project_id: row.project_id as string,
    pricing_document_id: (row.pricing_document_id as string | null) ?? null,
    estimate_id: (row.estimate_id as string | null) ?? null,
    quote_number: (row.quote_number as string | null) ?? null,
    title: row.title as string,
    status: row.status as Quote["status"],
    client_name: (row.client_name as string | null) ?? null,
    site_address: (row.site_address as string | null) ?? null,
    issue_date: (row.issue_date as string | null) ?? null,
    valid_until: (row.valid_until as string | null) ?? null,
    subtotal: Number(row.subtotal ?? 0),
    gst_rate: Number(row.gst_rate ?? 15),
    gst_amount: Number(row.gst_amount ?? 0),
    total_incl_gst: Number(row.total_incl_gst ?? 0),
    scope_summary: (row.scope_summary as string | null) ?? null,
    inclusions: parseStringArray(row.inclusions),
    exclusions: parseStringArray(row.exclusions),
    assumptions: parseStringArray(row.assumptions),
    terms: (row.terms as string | null) ?? null,
    notes_to_client: (row.notes_to_client as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    sent_at: (row.sent_at as string | null) ?? null,
    accepted_at: (row.accepted_at as string | null) ?? null,
    declined_at: (row.declined_at as string | null) ?? null,
    expired_at: (row.expired_at as string | null) ?? null,
    revision_number: Number(row.revision_number ?? 1),
    parent_quote_id: (row.parent_quote_id as string | null) ?? null,
    revised_from_quote_id: (row.revised_from_quote_id as string | null) ?? null,
    superseded_by_quote_id:
      (row.superseded_by_quote_id as string | null) ?? null,
    superseded_at: (row.superseded_at as string | null) ?? null,
    revision_note: (row.revision_note as string | null) ?? null,
  };
}

export function mapQuoteItem(row: Record<string, unknown>): QuoteItem {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    quote_id: row.quote_id as string,
    project_id: row.project_id as string,
    pricing_item_id: (row.pricing_item_id as string | null) ?? null,
    work_area_id: (row.work_area_id as string | null) ?? null,
    section_title: (row.section_title as string | null) ?? null,
    label: row.label as string,
    description: (row.description as string | null) ?? null,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    unit: (row.unit as string | null) ?? null,
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    total: Number(row.total ?? 0),
    visible: Boolean(row.visible ?? true),
    optional: Boolean(row.optional ?? false),
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export type QuoteItemSection = {
  sectionTitle: string | null;
  items: QuoteItem[];
};

export function groupQuoteItemsBySection(items: QuoteItem[]): QuoteItemSection[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const sections: QuoteItemSection[] = [];
  const sectionIndex = new Map<string, number>();

  for (const item of sorted) {
    const key = item.section_title ?? "__general__";
    let index = sectionIndex.get(key);

    if (index === undefined) {
      index = sections.length;
      sectionIndex.set(key, index);
      sections.push({
        sectionTitle: item.section_title,
        items: [],
      });
    }

    sections[index].items.push(item);
  }

  return sections;
}

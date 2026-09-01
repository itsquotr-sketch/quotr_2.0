import { parseQuoteIssuerSnapshot } from "@/lib/quotes/issuer-snapshot";
import {
  clientSafeQuoteLineDescription,
  isEstimatorDiagnosticDescription,
} from "@/lib/quotes/client-line-description";
import type { Quote, QuoteItem } from "@/lib/quotes/types";

const PUBLIC_QUOTE_KEYS = [
  "id",
  "quote_number",
  "revision_number",
  "title",
  "status",
  "client_name",
  "site_address",
  "issue_date",
  "valid_until",
  "subtotal",
  "gst_rate",
  "gst_amount",
  "total_incl_gst",
  "scope_summary",
  "inclusions",
  "exclusions",
  "assumptions",
  "terms",
  "notes_to_client",
  "sent_at",
  "viewed_at",
  "accepted_at",
  "declined_at",
  "expired_at",
  "issuer_snapshot",
  "snapshot_fingerprint",
  "snapshot_fingerprint_version",
  "presentation_mode",
] as const;

const FORBIDDEN_PUBLIC_KEYS = [
  "org_id",
  "project_id",
  "pricing_document_id",
  "estimate_id",
  "created_by",
  "revision_note",
  "superseded_by_quote_id",
  "parent_quote_id",
  "revised_from_quote_id",
  "unit_cost",
  "total_cost",
  "margin",
  "margin_percent",
  "cost",
  "gp",
] as const;

const PUBLIC_ITEM_KEYS = [
  "id",
  "label",
  "description",
  "quantity",
  "unit",
  "unit_price",
  "total",
  "visible",
  "optional",
  "sort_order",
  "section_title",
  "section_description",
] as const;

export function assertClientSafePublicQuotePayload(payload: {
  quote: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}): { ok: true } | { ok: false; reason: string } {
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (key in payload.quote) {
      return { ok: false, reason: `quote.${key}` };
    }
  }
  for (const item of payload.items) {
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      if (key in item) {
        return { ok: false, reason: `item.${key}` };
      }
    }
  }
  return { ok: true };
}

export function toPublicQuoteFromLookup(quote: Record<string, unknown>): Quote {
  const status = typeof quote.status === "string" ? quote.status : "sent";
  const superseded = quote.superseded === true || status === "superseded";
  return {
    id: String(quote.id),
    org_id: "",
    project_id: "",
    pricing_document_id: null,
    estimate_id: null,
    quote_number: typeof quote.quote_number === "string" ? quote.quote_number : null,
    title: typeof quote.title === "string" ? quote.title : "Quote",
    status: status as Quote["status"],
    client_name: typeof quote.client_name === "string" ? quote.client_name : null,
    site_address: typeof quote.site_address === "string" ? quote.site_address : null,
    issue_date: typeof quote.issue_date === "string" ? quote.issue_date : null,
    valid_until: typeof quote.valid_until === "string" ? quote.valid_until : null,
    subtotal: Number(quote.subtotal ?? 0),
    gst_rate: Number(quote.gst_rate ?? 15),
    gst_amount: Number(quote.gst_amount ?? 0),
    total_incl_gst: Number(quote.total_incl_gst ?? 0),
    scope_summary:
      typeof quote.scope_summary === "string" ? quote.scope_summary : null,
    inclusions: Array.isArray(quote.inclusions)
      ? quote.inclusions.filter((row): row is string => typeof row === "string")
      : [],
    exclusions: Array.isArray(quote.exclusions)
      ? quote.exclusions.filter((row): row is string => typeof row === "string")
      : [],
    assumptions: Array.isArray(quote.assumptions)
      ? quote.assumptions.filter((row): row is string => typeof row === "string")
      : [],
    terms: typeof quote.terms === "string" ? quote.terms : null,
    notes_to_client:
      typeof quote.notes_to_client === "string" ? quote.notes_to_client : null,
    created_by: null,
    created_at: "",
    updated_at: "",
    sent_at: typeof quote.sent_at === "string" ? quote.sent_at : null,
    viewed_at: typeof quote.viewed_at === "string" ? quote.viewed_at : null,
    accepted_at: typeof quote.accepted_at === "string" ? quote.accepted_at : null,
    declined_at: typeof quote.declined_at === "string" ? quote.declined_at : null,
    expired_at: typeof quote.expired_at === "string" ? quote.expired_at : null,
    issuer_snapshot: parseQuoteIssuerSnapshot(quote.issuer_snapshot),
    snapshot_fingerprint:
      typeof quote.snapshot_fingerprint === "string"
        ? quote.snapshot_fingerprint
        : null,
    snapshot_fingerprint_version:
      typeof quote.snapshot_fingerprint_version === "string"
        ? quote.snapshot_fingerprint_version
        : null,
    revision_number: Number(quote.revision_number ?? 1),
    parent_quote_id: null,
    revised_from_quote_id: null,
    superseded_by_quote_id: superseded ? "superseded" : null,
    superseded_at: null,
    revision_note: null,
    presentation_mode:
      quote.presentation_mode === "detailed" ||
      quote.presentation_mode === "lump_sum"
        ? quote.presentation_mode
        : "grouped",
  };
}

export function toPublicQuoteItemsFromLookup(
  items: unknown
): QuoteItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((row, index) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      id: typeof item.id === "string" ? item.id : `public-${index}`,
      org_id: "",
      quote_id: "",
      project_id: "",
      pricing_item_id: null,
      work_area_id: null,
      section_title:
        typeof item.section_title === "string" ? item.section_title : null,
      section_description: isEstimatorDiagnosticDescription(
        typeof item.section_description === "string"
          ? item.section_description
          : null
      )
        ? null
        : typeof item.section_description === "string"
          ? item.section_description
          : null,
      label: typeof item.label === "string" ? item.label : "Item",
      description: clientSafeQuoteLineDescription(
        typeof item.description === "string" ? item.description : null
      ),
      quantity: item.quantity != null ? Number(item.quantity) : null,
      unit: typeof item.unit === "string" ? item.unit : null,
      unit_price: item.unit_price != null ? Number(item.unit_price) : null,
      total: Number(item.total ?? 0),
      visible: item.visible !== false,
      optional: Boolean(item.optional),
      sort_order: Number(item.sort_order ?? index),
      created_at: "",
      updated_at: "",
    };
  });
}

export { PUBLIC_QUOTE_KEYS, PUBLIC_ITEM_KEYS, FORBIDDEN_PUBLIC_KEYS };

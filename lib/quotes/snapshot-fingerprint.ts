import { createHash } from "node:crypto";
import type { Quote, QuoteIssuerSnapshot, QuoteItem } from "@/lib/quotes/types";

export const QUOTE_SNAPSHOT_FINGERPRINT_VERSION = "v1";

function money(value: number): string {
  return Number(value).toFixed(2);
}

function canonicalValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalValue(entry));
  }
  if (typeof value === "object") {
    const sorted = Object.keys(value as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const key of sorted) {
      out[key] = canonicalValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function buildQuoteSnapshotFingerprintPayload(
  quote: Pick<
    Quote,
    | "quote_number"
    | "revision_number"
    | "presentation_mode"
    | "title"
    | "client_name"
    | "site_address"
    | "issue_date"
    | "valid_until"
    | "scope_summary"
    | "inclusions"
    | "exclusions"
    | "assumptions"
    | "terms"
    | "notes_to_client"
    | "subtotal"
    | "gst_rate"
    | "gst_amount"
    | "total_incl_gst"
  >,
  items: QuoteItem[],
  issuerSnapshot: QuoteIssuerSnapshot | null = null
) {
  const orderedItems = [...items].sort((a, b) => {
    const sortDiff = a.sort_order - b.sort_order;
    if (sortDiff !== 0) return sortDiff;
    return a.label.localeCompare(b.label);
  });

  return {
    version: QUOTE_SNAPSHOT_FINGERPRINT_VERSION,
    quote_number: quote.quote_number,
    revision_number: quote.revision_number,
    presentation_mode: quote.presentation_mode,
    title: quote.title,
    client_name: quote.client_name,
    site_address: quote.site_address,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    scope_summary: quote.scope_summary,
    inclusions: quote.inclusions,
    exclusions: quote.exclusions,
    assumptions: quote.assumptions,
    terms: quote.terms,
    notes_to_client: quote.notes_to_client,
    subtotal: money(quote.subtotal),
    gst_rate: money(quote.gst_rate),
    gst_amount: money(quote.gst_amount),
    total_incl_gst: money(quote.total_incl_gst),
    issuer_snapshot: issuerSnapshot,
    items: orderedItems.map((item) => ({
      sort_order: item.sort_order,
      section_title: item.section_title,
      section_description: item.section_description,
      label: item.label,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price == null ? null : money(item.unit_price),
      total: money(item.total),
      visible: item.visible,
      optional: item.optional,
    })),
  };
}

export function hashQuoteSnapshotFingerprint(
  quote: Parameters<typeof buildQuoteSnapshotFingerprintPayload>[0],
  items: QuoteItem[],
  issuerSnapshot: QuoteIssuerSnapshot | null = null
): string {
  const payload = buildQuoteSnapshotFingerprintPayload(
    quote,
    items,
    issuerSnapshot
  );
  const canonical = JSON.stringify(canonicalValue(payload));
  return createHash("sha256").update(canonical).digest("hex");
}

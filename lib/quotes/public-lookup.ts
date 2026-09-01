import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  hashQuoteAccessToken,
  isQuoteAccessTokenFormat,
} from "@/lib/quotes/delivery-token";
import {
  assertClientSafePublicQuotePayload,
  toPublicQuoteFromLookup,
  toPublicQuoteItemsFromLookup,
} from "@/lib/quotes/delivery-client-payload";
import type { Quote, QuoteItem } from "@/lib/quotes/types";
import type {
  PublicQuoteAcceptanceSummary,
  PublicQuoteDeclineSummary,
  PublicQuoteRecipientSeed,
} from "@/lib/quotes/acceptance-types";

export type PublicQuoteDocument = {
  quote: Quote;
  items: QuoteItem[];
  superseded: boolean;
  issuerOrgId: string | null;
  recipient: PublicQuoteRecipientSeed | null;
  acceptance: PublicQuoteAcceptanceSummary | null;
  decline: PublicQuoteDeclineSummary | null;
};

function createPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function lookupPublicQuoteByToken(
  rawToken: string
): Promise<PublicQuoteDocument | null> {
  if (!isQuoteAccessTokenFormat(rawToken)) return null;
  const supabase = createPublicSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc(
    "lookup_quote_public_by_token_hash_v1",
    { p_token_hash: hashQuoteAccessToken(rawToken) }
  );
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true || !row.quote || typeof row.quote !== "object") {
    return null;
  }
  const quoteRow = row.quote as Record<string, unknown>;
  const itemRows = Array.isArray(row.items)
    ? (row.items as Array<Record<string, unknown>>)
    : [];
  const safety = assertClientSafePublicQuotePayload({
    quote: quoteRow,
    items: itemRows,
  });
  if (!safety.ok) return null;

  const recipient =
    row.recipient && typeof row.recipient === "object"
      ? (row.recipient as Record<string, unknown>)
      : null;
  const acceptance =
    row.acceptance && typeof row.acceptance === "object"
      ? (row.acceptance as Record<string, unknown>)
      : null;
  const decline =
    row.decline && typeof row.decline === "object"
      ? (row.decline as Record<string, unknown>)
      : null;

  return {
    quote: toPublicQuoteFromLookup(quoteRow),
    items: toPublicQuoteItemsFromLookup(itemRows),
    superseded: quoteRow.superseded === true,
    issuerOrgId: typeof row.orgId === "string" ? row.orgId : null,
    recipient: recipient
      ? {
          name: typeof recipient.name === "string" ? recipient.name : null,
          email: typeof recipient.email === "string" ? recipient.email : null,
        }
      : null,
    acceptance: acceptance
      ? {
          source: acceptance.source === "manual" ? "manual" : "client",
          signer_name:
            typeof acceptance.signer_name === "string"
              ? acceptance.signer_name
              : null,
          accepted_at:
            typeof acceptance.accepted_at === "string"
              ? acceptance.accepted_at
              : "",
          quote_number:
            typeof acceptance.quote_number === "string"
              ? acceptance.quote_number
              : null,
          revision_number: Number(acceptance.revision_number ?? 1),
          acceptance_declaration:
            typeof acceptance.acceptance_declaration === "string"
              ? acceptance.acceptance_declaration
              : null,
          signature_method:
            acceptance.signature_method === "drawn" ||
            acceptance.signature_method === "none"
              ? acceptance.signature_method
              : "typed",
          signature_value:
            typeof acceptance.signature_value === "string"
              ? acceptance.signature_value
              : null,
          accepted_total_incl_gst:
            acceptance.accepted_total_incl_gst != null
              ? Number(acceptance.accepted_total_incl_gst)
              : null,
        }
      : null,
    decline: decline
      ? {
          source: decline.source === "manual" ? "manual" : "client",
          declined_at:
            typeof decline.declined_at === "string" ? decline.declined_at : "",
        }
      : null,
  };
}

export async function markPublicQuoteViewedByToken(
  rawToken: string
): Promise<{ ok: boolean; idempotent?: boolean }> {
  if (!isQuoteAccessTokenFormat(rawToken)) return { ok: false };
  const supabase = createPublicSupabase();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.rpc(
    "mark_quote_viewed_by_access_token_v1",
    { p_token_hash: hashQuoteAccessToken(rawToken) }
  );
  if (error || !data || typeof data !== "object") return { ok: false };
  const row = data as Record<string, unknown>;
  return { ok: row.ok === true, idempotent: Boolean(row.idempotent) };
}

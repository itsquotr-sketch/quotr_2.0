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

export type PublicQuoteDocument = {
  quote: Quote;
  items: QuoteItem[];
  superseded: boolean;
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

  return {
    quote: toPublicQuoteFromLookup(quoteRow),
    items: toPublicQuoteItemsFromLookup(itemRows),
    superseded: quoteRow.superseded === true,
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

"use server";

import { headers } from "next/headers";
import { requireOrgEntitlement } from "@/lib/quotes/entitlements";
import {
  buildQuoteAcceptanceDeclarationFromQuote,
  QUOTE_ACCEPTANCE_DECLARATION_VERSION,
  validateClientAcceptanceInput,
} from "@/lib/quotes/acceptance";
import {
  clientIpFromHeaders,
  userAgentFromHeaders,
} from "@/lib/quotes/acceptance-request";
import {
  ACCEPT_QUOTE_BY_ACCESS_TOKEN_RPC,
  DECLINE_QUOTE_BY_ACCESS_TOKEN_RPC,
} from "@/lib/quotes/quote-rpc";
import {
  hashQuoteAccessToken,
  isQuoteAccessTokenFormat,
  quotePublicPath,
} from "@/lib/quotes/delivery-token";
import { lookupPublicQuoteByToken } from "@/lib/quotes/public-lookup";
import { flushPendingQuoteResponseNotifications } from "@/lib/quotes/notification-flush";
import { createClient } from "@supabase/supabase-js";
import type { QuoteSignatureMethod } from "@/lib/quotes/acceptance-types";

export type PublicQuoteDecisionState = {
  error?: string;
  success?: boolean;
  idempotent?: boolean;
  status?: "accepted" | "declined";
};

function createPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapPublicDecisionError(code: string | undefined): string {
  switch (code) {
    case "EXPIRED":
      return "This quote has expired and can no longer be accepted.";
    case "SUPERSEDED":
      return "This quote has been superseded by a newer revision.";
    case "INVALID_TRANSITION":
      return "This quote can no longer be accepted or declined.";
    case "FINGERPRINT_MISMATCH":
      return "This quote has changed. Refresh the page and try again.";
    case "INVALID_EVIDENCE":
      return "Check your name, email, signature and confirmation, then try again.";
    default:
      return "This quote could not be updated. Refresh the page and try again.";
  }
}

function parseDecisionResult(
  data: unknown
): { ok: true; idempotent: boolean; status: string } | { ok: false; error?: string } {
  if (!data || typeof data !== "object") return { ok: false };
  const row = data as Record<string, unknown>;
  if (row.ok === true) {
    return {
      ok: true,
      idempotent: Boolean(row.idempotent),
      status: typeof row.status === "string" ? row.status : "",
    };
  }
  return {
    ok: false,
    error: typeof row.error === "string" ? row.error : undefined,
  };
}

export async function acceptPublicQuoteByToken(input: {
  token: string;
  signerName: string;
  signerEmail: string;
  declared: boolean;
  declaration: string;
  signatureMethod: QuoteSignatureMethod;
  signatureValue: string | null;
}): Promise<PublicQuoteDecisionState> {
  if (!isQuoteAccessTokenFormat(input.token)) {
    return { error: "This quote link is not valid." };
  }

  const document = await lookupPublicQuoteByToken(input.token);
  if (!document) {
    return { error: "This quote link is not valid." };
  }

  const entitlement = requireOrgEntitlement(
    document.issuerOrgId ?? document.quote.org_id,
    "quotes.acceptance"
  );
  if (!entitlement.ok) {
    return { error: entitlement.error };
  }

  const canonical = buildQuoteAcceptanceDeclarationFromQuote(document.quote);
  const validated = validateClientAcceptanceInput({
    signerName: input.signerName,
    signerEmail: input.signerEmail,
    declared: input.declared,
    declaration: input.declaration,
    expectedDeclaration: canonical,
    signatureMethod: input.signatureMethod,
    signatureValue: input.signatureValue,
  });
  if (!validated.ok) {
    return { error: validated.error };
  }

  if (!document.quote.snapshot_fingerprint) {
    return { error: "This quote cannot be accepted yet." };
  }

  const supabase = createPublicSupabase();
  if (!supabase) {
    return { error: "This quote could not be updated. Refresh the page and try again." };
  }

  const headerList = await headers();
  const { data, error } = await supabase.rpc(ACCEPT_QUOTE_BY_ACCESS_TOKEN_RPC, {
    p_token_hash: hashQuoteAccessToken(input.token),
    p_signer_name: input.signerName.trim(),
    p_signer_email: input.signerEmail.trim(),
    p_declaration: canonical,
    p_declaration_version: QUOTE_ACCEPTANCE_DECLARATION_VERSION,
    p_signature_method: input.signatureMethod,
    p_signature_value:
      input.signatureMethod === "typed"
        ? input.signerName.trim()
        : input.signatureValue,
    p_snapshot_fingerprint: document.quote.snapshot_fingerprint,
    p_ip_address: clientIpFromHeaders(headerList),
    p_user_agent: userAgentFromHeaders(headerList),
  });
  if (error) {
    return { error: mapPublicDecisionError(undefined) };
  }
  const parsed = parseDecisionResult(data);
  if (!parsed.ok) {
    return { error: mapPublicDecisionError(parsed.error) };
  }
  const orgId = document.issuerOrgId;
  if (orgId) {
    await flushPendingQuoteResponseNotifications({
      quoteId: document.quote.id,
      orgId,
      publicPath: quotePublicPath(input.token),
    });
  }
  return {
    success: true,
    idempotent: parsed.idempotent,
    status: "accepted",
  };
}

export async function declinePublicQuoteByToken(input: {
  token: string;
  message?: string;
}): Promise<PublicQuoteDecisionState> {
  if (!isQuoteAccessTokenFormat(input.token)) {
    return { error: "This quote link is not valid." };
  }

  const document = await lookupPublicQuoteByToken(input.token);
  if (!document) {
    return { error: "This quote link is not valid." };
  }

  const entitlement = requireOrgEntitlement(
    document.issuerOrgId ?? document.quote.org_id,
    "quotes.acceptance"
  );
  if (!entitlement.ok) {
    return { error: entitlement.error };
  }

  const message = input.message?.trim() || "";
  if (message.length > 2000) {
    return { error: "Keep the optional note under 2,000 characters." };
  }

  const supabase = createPublicSupabase();
  if (!supabase) {
    return { error: "This quote could not be updated. Refresh the page and try again." };
  }

  const headerList = await headers();
  const { data, error } = await supabase.rpc(DECLINE_QUOTE_BY_ACCESS_TOKEN_RPC, {
    p_token_hash: hashQuoteAccessToken(input.token),
    p_message: message || null,
    p_ip_address: clientIpFromHeaders(headerList),
    p_user_agent: userAgentFromHeaders(headerList),
  });
  if (error) {
    return { error: mapPublicDecisionError(undefined) };
  }
  const parsed = parseDecisionResult(data);
  if (!parsed.ok) {
    return { error: mapPublicDecisionError(parsed.error) };
  }
  const orgId = document.issuerOrgId;
  if (orgId) {
    await flushPendingQuoteResponseNotifications({
      quoteId: document.quote.id,
      orgId,
      publicPath: quotePublicPath(input.token),
    });
  }
  return {
    success: true,
    idempotent: parsed.idempotent,
    status: "declined",
  };
}

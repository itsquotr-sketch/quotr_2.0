import { formatQuoteReference } from "@/lib/quotes/display";
import { isQuoteExpired } from "@/lib/quotes/transaction";
import type { Quote, QuoteStatus } from "@/lib/quotes/types";
import type {
  QuoteAcceptanceRecord,
  QuoteAcceptanceSource,
  QuoteSignatureMethod,
} from "@/lib/quotes/acceptance-types";

export const QUOTE_ACCEPTANCE_EVIDENCE_VERSION = "v1";
export const QUOTE_ACCEPTANCE_DECLARATION_VERSION = "v1";
export const QUOTE_ACCEPTANCE_MANUAL_DECLARATION_VERSION = "manual_v1";
export const QUOTE_ACCEPTANCE_MANUAL_DECLARATION =
  "Manually marked accepted by the contractor.";

export const DRAWN_SIGNATURE_MAX_CHARS = 24576;
export const SIGNER_NAME_MAX_CHARS = 160;
export const SIGNER_EMAIL_MAX_CHARS = 254;
export const DECLINE_MESSAGE_MAX_CHARS = 2000;
export const USER_AGENT_MAX_CHARS = 512;
export const IP_ADDRESS_MAX_CHARS = 64;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSafeAcceptanceEmail(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > SIGNER_EMAIL_MAX_CHARS) return false;
  if (/[\r\n,<>]/.test(trimmed)) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export function isSafeSignerName(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > SIGNER_NAME_MAX_CHARS) return false;
  if (/[\r\n]/.test(trimmed)) return false;
  return true;
}

/** Matches Postgres `'$' || to_char(amount, 'FM999,999,990.00')` used in 044. */
export function formatQuoteAcceptanceMoney(value: number): string {
  const numeric = Number(value);
  const negative = numeric < 0;
  const [intPart, fracPart = "00"] = Math.abs(numeric).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${fracPart}`;
}

export function buildQuoteAcceptanceDeclaration(input: {
  quoteNumber: string;
  revisionNumber: number;
  totalInclGst: number;
}): string {
  return `I confirm that I have reviewed and accept Quote ${input.quoteNumber} Revision ${input.revisionNumber} for ${formatQuoteAcceptanceMoney(input.totalInclGst)} incl GST, including its scope, assumptions, exclusions and terms.`;
}

export function buildQuoteAcceptanceDeclarationFromQuote(quote: Quote): string {
  return buildQuoteAcceptanceDeclaration({
    quoteNumber: formatQuoteReference(quote),
    revisionNumber: quote.revision_number,
    totalInclGst: quote.total_incl_gst,
  });
}

export function isQuoteSupersededRevision(quote: Pick<
  Quote,
  "status" | "superseded_by_quote_id"
>): boolean {
  return (
    quote.status === "superseded" || quote.superseded_by_quote_id != null
  );
}

export function canClientAcceptQuote(
  quote: Pick<
    Quote,
    "status" | "valid_until" | "expired_at" | "superseded_by_quote_id"
  >,
  now: Date = new Date()
): boolean {
  if (quote.status !== "sent" && quote.status !== "viewed") return false;
  if (isQuoteSupersededRevision(quote)) return false;
  if (isQuoteExpired(quote, now)) return false;
  return true;
}

export function canClientDeclineQuote(
  quote: Pick<
    Quote,
    "status" | "valid_until" | "expired_at" | "superseded_by_quote_id"
  >,
  now: Date = new Date()
): boolean {
  return canClientAcceptQuote(quote, now);
}

export function isValidDrawnSignatureSvg(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > DRAWN_SIGNATURE_MAX_CHARS) return false;
  if (!trimmed.startsWith("<svg") || !trimmed.includes("</svg>")) return false;
  if (/<script|javascript:|on\w+\s*=/i.test(trimmed)) return false;
  if (/foreignobject|<use[\s/>]|<image[\s/>]|<iframe|<object|<embed/i.test(trimmed)) {
    return false;
  }
  if (/xlink:href|href\s*=|src\s*=|data:/i.test(trimmed)) return false;
  if (!/<path[\s>]/i.test(trimmed)) return false;
  return true;
}

export function validateClientSignature(input: {
  method: QuoteSignatureMethod;
  value: string | null | undefined;
  signerName: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.method === "none") {
    return { ok: false, error: "Choose a signature method." };
  }
  if (input.method === "typed") {
    if (!isSafeSignerName(input.signerName)) {
      return { ok: false, error: "Enter your name." };
    }
    const typed = input.value?.trim() || input.signerName.trim();
    if (typed !== input.signerName.trim()) {
      return { ok: false, error: "Typed signature must match your name." };
    }
    return { ok: true };
  }
  if (!input.value || !isValidDrawnSignatureSvg(input.value)) {
    return { ok: false, error: "Draw your signature, or switch to Type." };
  }
  return { ok: true };
}

export function validateClientAcceptanceInput(input: {
  signerName: string;
  signerEmail: string;
  declared: boolean;
  declaration: string;
  expectedDeclaration: string;
  signatureMethod: QuoteSignatureMethod;
  signatureValue: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!input.declared) {
    return { ok: false, error: "Confirm the acceptance statement to continue." };
  }
  if (!isSafeSignerName(input.signerName)) {
    return { ok: false, error: "Enter your name." };
  }
  if (!isSafeAcceptanceEmail(input.signerEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (input.declaration.trim() !== input.expectedDeclaration.trim()) {
    return { ok: false, error: "Acceptance statement does not match this quote." };
  }
  return validateClientSignature({
    method: input.signatureMethod,
    value: input.signatureValue,
    signerName: input.signerName,
  });
}

export type QuoteAcceptanceRace =
  | "accept"
  | "decline"
  | "supersede"
  | "expire";

export type QuoteAcceptanceOutcome =
  | { ok: true; status: "accepted" | "declined" | "superseded" | "expired"; idempotent: boolean }
  | { ok: false; error: "INVALID_TRANSITION" | "EXPIRED" | "SUPERSEDED" };

/**
 * Deterministic terminal-outcome matrix for one Quote revision.
 * First committed writer wins. Accepted quotes are not auto-superseded.
 */
export function decideQuoteTerminalOutcome(
  status: QuoteStatus,
  action: QuoteAcceptanceRace
): QuoteAcceptanceOutcome {
  if (action === "accept") {
    if (status === "accepted") {
      return { ok: true, status: "accepted", idempotent: true };
    }
    if (status === "superseded") {
      return { ok: false, error: "SUPERSEDED" };
    }
    if (status === "expired") {
      return { ok: false, error: "EXPIRED" };
    }
    if (status === "sent" || status === "viewed") {
      return { ok: true, status: "accepted", idempotent: false };
    }
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  if (action === "decline") {
    if (status === "declined") {
      return { ok: true, status: "declined", idempotent: true };
    }
    if (status === "superseded") {
      return { ok: false, error: "SUPERSEDED" };
    }
    if (status === "expired") {
      return { ok: false, error: "EXPIRED" };
    }
    if (status === "sent" || status === "viewed") {
      return { ok: true, status: "declined", idempotent: false };
    }
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  if (action === "supersede") {
    if (status === "accepted" || status === "declined" || status === "expired") {
      return { ok: false, error: "INVALID_TRANSITION" };
    }
    if (status === "sent" || status === "viewed") {
      return { ok: true, status: "superseded", idempotent: false };
    }
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  if (status === "expired") {
    return { ok: true, status: "expired", idempotent: true };
  }
  if (status === "sent" || status === "viewed") {
    return { ok: true, status: "expired", idempotent: false };
  }
  return { ok: false, error: "INVALID_TRANSITION" };
}

export function formatAcceptanceSourceLabel(
  source: QuoteAcceptanceSource
): string {
  return source === "client" ? "Accepted by client" : "Marked accepted manually";
}

export function clientSafeAcceptanceSummary(
  record: QuoteAcceptanceRecord | null
): {
  source: QuoteAcceptanceSource;
  signerName: string | null;
  acceptedAt: string;
} | null {
  if (!record) return null;
  return {
    source: record.source,
    signerName: record.source === "client" ? record.signer_name : null,
    acceptedAt: record.accepted_at,
  };
}

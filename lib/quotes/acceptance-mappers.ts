import type {
  QuoteAcceptanceRecord,
  QuoteDeclineRecord,
  QuoteAcceptanceSource,
  QuoteSignatureMethod,
} from "@/lib/quotes/acceptance-types";

function asSource(value: unknown): QuoteAcceptanceSource {
  return value === "manual" ? "manual" : "client";
}

function asMethod(value: unknown): QuoteSignatureMethod {
  if (value === "drawn" || value === "none") return value;
  return "typed";
}

export function isMissingQuoteAcceptanceTableError(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    ((message.includes("quote_acceptances") ||
      message.includes("quote_declines")) &&
      message.includes("does not exist"))
  );
}

export function mapQuoteAcceptance(
  row: Record<string, unknown>
): QuoteAcceptanceRecord {
  return {
    id: String(row.id),
    org_id: String(row.org_id ?? ""),
    project_id: String(row.project_id ?? ""),
    quote_id: String(row.quote_id),
    quote_number: typeof row.quote_number === "string" ? row.quote_number : null,
    revision_number: Number(row.revision_number ?? 1),
    snapshot_fingerprint:
      typeof row.snapshot_fingerprint === "string"
        ? row.snapshot_fingerprint
        : null,
    snapshot_fingerprint_version:
      typeof row.snapshot_fingerprint_version === "string"
        ? row.snapshot_fingerprint_version
        : null,
    source: asSource(row.source),
    signer_name: typeof row.signer_name === "string" ? row.signer_name : null,
    signer_email: typeof row.signer_email === "string" ? row.signer_email : null,
    acceptance_declaration:
      typeof row.acceptance_declaration === "string"
        ? row.acceptance_declaration
        : null,
    declaration_version:
      typeof row.declaration_version === "string"
        ? row.declaration_version
        : null,
    signature_method: asMethod(row.signature_method),
    signature_value:
      typeof row.signature_value === "string" ? row.signature_value : null,
    accepted_total_incl_gst: Number(row.accepted_total_incl_gst ?? 0),
    accepted_at: String(row.accepted_at ?? ""),
    ip_address: typeof row.ip_address === "string" ? row.ip_address : null,
    user_agent: typeof row.user_agent === "string" ? row.user_agent : null,
    access_token_id:
      typeof row.access_token_id === "string" ? row.access_token_id : null,
    delivery_id: typeof row.delivery_id === "string" ? row.delivery_id : null,
    actor_user_id:
      typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    evidence_version:
      typeof row.evidence_version === "string" ? row.evidence_version : "v1",
    created_at: String(row.created_at ?? ""),
  };
}

export function mapQuoteDecline(row: Record<string, unknown>): QuoteDeclineRecord {
  return {
    id: String(row.id),
    org_id: String(row.org_id ?? ""),
    project_id: String(row.project_id ?? ""),
    quote_id: String(row.quote_id),
    quote_number: typeof row.quote_number === "string" ? row.quote_number : null,
    revision_number: Number(row.revision_number ?? 1),
    source: asSource(row.source),
    message: typeof row.message === "string" ? row.message : null,
    declined_at: String(row.declined_at ?? ""),
    ip_address: typeof row.ip_address === "string" ? row.ip_address : null,
    user_agent: typeof row.user_agent === "string" ? row.user_agent : null,
    access_token_id:
      typeof row.access_token_id === "string" ? row.access_token_id : null,
    delivery_id: typeof row.delivery_id === "string" ? row.delivery_id : null,
    actor_user_id:
      typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    evidence_version:
      typeof row.evidence_version === "string" ? row.evidence_version : "v1",
    created_at: String(row.created_at ?? ""),
  };
}

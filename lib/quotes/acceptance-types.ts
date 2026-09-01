export type QuoteAcceptanceSource = "client" | "manual";
export type QuoteSignatureMethod = "typed" | "drawn" | "none";

export type QuoteAcceptanceRecord = {
  id: string;
  org_id: string;
  project_id: string;
  quote_id: string;
  quote_number: string | null;
  revision_number: number;
  snapshot_fingerprint: string | null;
  snapshot_fingerprint_version: string | null;
  source: QuoteAcceptanceSource;
  signer_name: string | null;
  signer_email: string | null;
  acceptance_declaration: string | null;
  declaration_version: string | null;
  signature_method: QuoteSignatureMethod;
  signature_value: string | null;
  accepted_total_incl_gst: number;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  access_token_id: string | null;
  delivery_id: string | null;
  actor_user_id: string | null;
  evidence_version: string;
  created_at: string;
};

export type QuoteDeclineRecord = {
  id: string;
  org_id: string;
  project_id: string;
  quote_id: string;
  quote_number: string | null;
  revision_number: number;
  source: QuoteAcceptanceSource;
  message: string | null;
  declined_at: string;
  ip_address: string | null;
  user_agent: string | null;
  access_token_id: string | null;
  delivery_id: string | null;
  actor_user_id: string | null;
  evidence_version: string;
  created_at: string;
};

export type PublicQuoteRecipientSeed = {
  name: string | null;
  email: string | null;
};

export type PublicQuoteAcceptanceSummary = {
  source: QuoteAcceptanceSource;
  signer_name: string | null;
  accepted_at: string;
  quote_number: string | null;
  revision_number: number;
  acceptance_declaration: string | null;
  signature_method: QuoteSignatureMethod;
  signature_value: string | null;
  accepted_total_incl_gst: number | null;
};

export type PublicQuoteDeclineSummary = {
  source: QuoteAcceptanceSource;
  declined_at: string;
};

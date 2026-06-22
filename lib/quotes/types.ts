export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "revised"
  | "archived";

export type Quote = {
  id: string;
  org_id: string;
  project_id: string;
  pricing_document_id: string | null;
  estimate_id: string | null;
  quote_number: string | null;
  title: string;
  status: QuoteStatus;
  client_name: string | null;
  site_address: string | null;
  issue_date: string | null;
  valid_until: string | null;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total_incl_gst: number;
  scope_summary: string | null;
  inclusions: string[];
  exclusions: string[];
  assumptions: string[];
  terms: string | null;
  notes_to_client: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  revision_number: number;
  parent_quote_id: string | null;
  revised_from_quote_id: string | null;
  superseded_by_quote_id: string | null;
  superseded_at: string | null;
  revision_note: string | null;
};

export type QuoteItem = {
  id: string;
  org_id: string;
  quote_id: string;
  project_id: string;
  pricing_item_id: string | null;
  work_area_id: string | null;
  section_title: string | null;
  section_description: string | null;
  label: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total: number;
  visible: boolean;
  optional: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type QuoteSummary = {
  id: string;
  status: QuoteStatus;
  pricing_document_id: string | null;
  created_at: string;
  revision_number: number;
};

export type QuoteActionState = {
  error?: string;
  success?: boolean;
  quoteId?: string;
};

export type QuoteInput = {
  title?: string;
  issue_date?: string | null;
  valid_until?: string | null;
  scope_summary?: string | null;
  notes_to_client?: string | null;
  assumptions?: string[];
  exclusions?: string[];
  terms?: string | null;
};

export type QuoteItemInput = {
  label: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  total?: number;
  visible?: boolean;
  optional?: boolean;
};

import type { CompanySettings } from "@/lib/settings/types";

export type QuoteWorkspaceData = {
  quote: Quote;
  items: QuoteItem[];
  projectTitle: string;
  companySettings: CompanySettings | null;
  pricingDocumentUpdatedAt: string | null;
  latestRevisionQuoteId: string | null;
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired"
  | "superseded"
  | "archived";

export type QuoteActorType = "user" | "client" | "system";

export type QuoteEventType =
  | "quote_created"
  | "quote_updated"
  | "quote_revision_created"
  | "quote_sent"
  | "quote_viewed"
  | "quote_accepted"
  | "quote_declined"
  | "quote_expired"
  | "quote_superseded"
  | "quote_archived";

export type QuoteIssuerSnapshot = {
  organisationName: string;
  tradingName: string | null;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  addressCountry: string;
  nzbn: string | null;
  gstNumber: string | null;
  logoUrl: string | null;
  brandPrimaryColour: string | null;
  brandAccentColour: string | null;
  defaultPaymentTerms: string | null;
  source?: "send" | "migration_041_current_org";
};

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
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  issuer_snapshot: QuoteIssuerSnapshot | null;
  snapshot_fingerprint: string | null;
  snapshot_fingerprint_version: string | null;
  revision_number: number;
  parent_quote_id: string | null;
  revised_from_quote_id: string | null;
  superseded_by_quote_id: string | null;
  superseded_at: string | null;
  revision_note: string | null;
  presentation_mode: "grouped" | "detailed" | "lump_sum";
  send_lock_delivery_id?: string | null;
  send_lock_fingerprint?: string | null;
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

export type QuoteThreadRevision = {
  id: string;
  revision_number: number;
  status: QuoteStatus;
  quote_number: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  superseded_by_quote_id: string | null;
  superseded_at: string | null;
  created_at: string;
};

export type QuoteEventRecord = {
  id: string;
  quote_id: string;
  event_type: QuoteEventType;
  actor_type: QuoteActorType;
  actor_user_id: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
};

export type QuoteActionState = {
  error?: string;
  reasonCode?: string;
  upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  success?: boolean;
  quoteId?: string;
};

export type QuoteDeliveryActionState = {
  error?: string;
  reasonCode?: string;
  upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  success?: boolean;
  quoteIssued?: boolean;
  emailSubmitted?: boolean;
  emailInProgress?: boolean;
  needsFinalize?: boolean;
  deliveryId?: string;
  recipientEmail?: string;
  publicPath?: string;
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
  presentation_mode?: "grouped" | "detailed" | "lump_sum";
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

import type { QuoteDeliveryRecord } from "@/lib/quotes/delivery-types";
import type { CompanySettings } from "@/lib/settings/types";
import type {
  QuoteAcceptanceRecord,
  QuoteDeclineRecord,
} from "@/lib/quotes/acceptance-types";

export type QuoteWorkspaceData = {
  quote: Quote;
  items: QuoteItem[];
  projectTitle: string;
  projectClientEmail: string | null;
  companySettings: CompanySettings | null;
  pricingDocumentUpdatedAt: string | null;
  latestRevisionQuoteId: string | null;
  threadRevisions: QuoteThreadRevision[];
  recentEvents: QuoteEventRecord[];
  deliveries: QuoteDeliveryRecord[];
  acceptance: QuoteAcceptanceRecord | null;
  decline: QuoteDeclineRecord | null;
};

export type QuotePrintData = {
  quote: Quote;
  items: QuoteItem[];
  companySettings: CompanySettings | null;
  acceptance: QuoteAcceptanceRecord | null;
};

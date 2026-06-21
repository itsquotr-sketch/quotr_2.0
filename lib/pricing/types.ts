export type PricingDocumentStatus =
  | "draft"
  | "reviewed"
  | "converted_to_quote"
  | "archived";

export type PricingItemType =
  | "labour"
  | "material"
  | "subcontractor"
  | "allowance"
  | "contingency"
  | "equipment"
  | "other";

export type DeliveryMethod =
  | "in_house"
  | "subcontracted"
  | "allowance"
  | "not_sure";

export type PricingDocument = {
  id: string;
  org_id: string;
  project_id: string;
  estimate_id: string | null;
  title: string;
  status: PricingDocumentStatus;
  client_name: string | null;
  site_address: string | null;
  pricing_date: string | null;
  valid_until: string | null;
  subtotal_cost: number;
  subtotal_sell: number;
  gross_profit: number;
  margin_percent: number;
  markup_percent: number;
  gst_rate: number;
  gst_amount: number;
  total_incl_gst: number;
  scope_summary: string | null;
  assumptions: string[];
  exclusions: string[];
  terms: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  converted_to_quote_at: string | null;
};

export type PricingItem = {
  id: string;
  org_id: string;
  pricing_document_id: string;
  project_id: string;
  work_area_id: string | null;
  source_estimate_line_item_id: string | null;
  item_type: PricingItemType;
  delivery_method: DeliveryMethod;
  internal_label: string;
  client_label: string;
  internal_description: string | null;
  client_description: string | null;
  quantity: number | null;
  unit: string | null;
  unit_cost: number | null;
  unit_sell: number | null;
  total_cost: number;
  total_sell: number;
  gross_profit: number;
  margin_percent: number;
  markup_percent: number;
  visible_on_quote: boolean;
  optional: boolean;
  sort_order: number;
  notes_internal: string | null;
  notes_client: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingWorkArea = {
  id: string;
  name: string;
  type: string;
  sort_order: number;
};

export type PricingSummary = {
  id: string;
  status: PricingDocumentStatus;
};

export type PricingActionState = {
  error?: string;
  success?: boolean;
  pricingDocumentId?: string;
};

export type PricingItemInput = {
  internal_label: string;
  client_label: string;
  internal_description?: string | null;
  client_description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_cost?: number | null;
  unit_sell?: number | null;
  total_cost?: number;
  total_sell?: number;
  item_type: PricingItemType;
  delivery_method: DeliveryMethod;
  visible_on_quote?: boolean;
  optional?: boolean;
  notes_internal?: string | null;
  notes_client?: string | null;
  work_area_id?: string | null;
};

export type PricingDocumentInput = {
  title?: string;
  valid_until?: string | null;
  scope_summary?: string | null;
  assumptions?: string[];
  exclusions?: string[];
  terms?: string | null;
  internal_notes?: string | null;
  gst_rate?: number;
};

export type PricingWorkspaceData = {
  document: PricingDocument;
  items: PricingItem[];
  workAreas: PricingWorkArea[];
  projectTitle: string;
};

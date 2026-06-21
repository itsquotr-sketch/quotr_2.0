import type {
  DeliveryMethod,
  PricingDocumentStatus,
  PricingItemType,
} from "@/lib/pricing/types";

export type PricingStatusDefinition = {
  value: PricingDocumentStatus;
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
};

export const PRICING_DOCUMENT_STATUSES: PricingStatusDefinition[] = [
  { value: "draft", label: "Draft", variant: "secondary" },
  { value: "reviewed", label: "Reviewed", variant: "default" },
  {
    value: "converted_to_quote",
    label: "Converted to quote",
    variant: "outline",
  },
  { value: "archived", label: "Archived", variant: "outline" },
];

export const PRICING_ITEM_TYPES: { value: PricingItemType; label: string }[] =
  [
    { value: "labour", label: "Labour" },
    { value: "material", label: "Material" },
    { value: "subcontractor", label: "Subcontractor" },
    { value: "allowance", label: "Allowance" },
    { value: "contingency", label: "Contingency" },
    { value: "equipment", label: "Equipment" },
    { value: "other", label: "Other" },
  ];

export const DELIVERY_METHODS: { value: DeliveryMethod; label: string }[] = [
  { value: "in_house", label: "In-house" },
  { value: "subcontracted", label: "Subcontracted" },
  { value: "allowance", label: "Allowance" },
  { value: "not_sure", label: "Not sure" },
];

export const DEFAULT_GST_RATE = 15;

export const DEFAULT_PRICING_TERMS = `This pricing is valid for the period stated above.
Payment terms: as agreed prior to commencement.
Variations to scope will be quoted separately before proceeding.`;

const statusByValue = new Map(
  PRICING_DOCUMENT_STATUSES.map((status) => [status.value, status])
);

export function getPricingStatusDefinition(
  value: string
): PricingStatusDefinition {
  return (
    statusByValue.get(value as PricingDocumentStatus) ??
    PRICING_DOCUMENT_STATUSES[0]
  );
}

export function formatPricingBadgeLabel(status: PricingDocumentStatus): string {
  if (status === "reviewed") {
    return "Pricing reviewed";
  }
  if (status === "draft") {
    return "Pricing draft";
  }
  return getPricingStatusDefinition(status).label;
}

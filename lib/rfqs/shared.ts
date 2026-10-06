/**
 * Fields a recipient is allowed to see. Anything else stays with the builder.
 * Inbound email is not read. A question or an attached PDF is not a job price.
 */

export const RFQ_SHARED_FIELDS = [
  "builderName",
  "scopeLabel",
  "requestedScope",
  "measurementNotes",
  "responseDueOn",
  "siteAddress",
  "siteDetails",
  "questions",
  "message",
  "files",
] as const;

export const RFQ_WITHHELD = [
  "Internal notes",
  "Estimate cost and margin",
  "Pricing",
  "Client name and email",
  "Files that were not selected",
  "Other subcontractors and their prices",
] as const;

export function gstTreatmentLabel(value: string | null): string {
  switch (value) {
    case "extra":
      return "GST will be added";
    case "none":
      return "No GST";
    case "unknown":
      return "GST not stated";
    default:
      return "GST not stated";
  }
}

export function pricingStructureLabel(value: string | null): string {
  switch (value) {
    case "lump_sum":
      return "Lump sum";
    case "itemised":
      return "Itemised";
    default:
      return "Not stated";
  }
}

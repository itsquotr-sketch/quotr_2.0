export type BusinessStatus =
  | "lead"
  | "site_visit"
  | "scoping"
  | "estimating"
  | "estimate_ready"
  | "quote_draft"
  | "quote_sent"
  | "won"
  | "lost"
  | "archived";

export type BusinessStatusVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "ghost"
  | "link";

export type BusinessStatusDefinition = {
  value: BusinessStatus;
  label: string;
  description: string;
  variant: BusinessStatusVariant;
  sortOrder: number;
};

export const BUSINESS_STATUSES: BusinessStatusDefinition[] = [
  {
    value: "lead",
    label: "Lead",
    description: "New enquiry or possible job.",
    variant: "secondary",
    sortOrder: 10,
  },
  {
    value: "site_visit",
    label: "Site visit",
    description: "Site visit or inspection needed.",
    variant: "secondary",
    sortOrder: 20,
  },
  {
    value: "scoping",
    label: "Scoping",
    description: "Capturing details, notes, measurements and scope.",
    variant: "secondary",
    sortOrder: 30,
  },
  {
    value: "estimating",
    label: "Estimating",
    description: "Estimate is being prepared or reviewed.",
    variant: "secondary",
    sortOrder: 40,
  },
  {
    value: "estimate_ready",
    label: "Estimate ready",
    description: "Internal estimate is ready to review.",
    variant: "default",
    sortOrder: 50,
  },
  {
    value: "quote_draft",
    label: "Quote draft",
    description: "Quote is being prepared.",
    variant: "outline",
    sortOrder: 60,
  },
  {
    value: "quote_sent",
    label: "Quote sent",
    description: "Quote has been sent to the client.",
    variant: "default",
    sortOrder: 70,
  },
  {
    value: "won",
    label: "Won",
    description: "Client accepted the work.",
    variant: "default",
    sortOrder: 80,
  },
  {
    value: "lost",
    label: "Lost",
    description: "Job did not proceed.",
    variant: "destructive",
    sortOrder: 90,
  },
  {
    value: "archived",
    label: "Archived",
    description: "Hidden from active work.",
    variant: "outline",
    sortOrder: 100,
  },
];

export const BUSINESS_STATUS_VALUES = BUSINESS_STATUSES.map(
  (status) => status.value
) as BusinessStatus[];

export const ACTIVE_PIPELINE_STATUSES: BusinessStatus[] = [
  "lead",
  "site_visit",
  "scoping",
  "estimating",
  "estimate_ready",
  "quote_draft",
  "quote_sent",
];

export const LOST_REASON_OPTIONS = [
  "Price too high",
  "Client chose another contractor",
  "Scope changed",
  "No response",
  "Not a fit",
  "Other",
] as const;

export type LostReason = (typeof LOST_REASON_OPTIONS)[number];

export const DEFAULT_BUSINESS_STATUS: BusinessStatus = "lead";

const statusByValue = new Map(
  BUSINESS_STATUSES.map((status) => [status.value, status])
);

export function isBusinessStatus(value: string): value is BusinessStatus {
  return statusByValue.has(value as BusinessStatus);
}

export function getBusinessStatusDefinition(
  value: string
): BusinessStatusDefinition {
  return (
    statusByValue.get(value as BusinessStatus) ??
    statusByValue.get(DEFAULT_BUSINESS_STATUS)!
  );
}

export function isActivePipelineStatus(value: string): boolean {
  return ACTIVE_PIPELINE_STATUSES.includes(value as BusinessStatus);
}

export type ProjectListFilter =
  | "active"
  | "archived"
  | "all"
  | BusinessStatus;

export const DASHBOARD_FILTER_OPTIONS: {
  value: ProjectListFilter;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "lead", label: "Lead" },
  { value: "site_visit", label: "Site visit" },
  { value: "scoping", label: "Scoping" },
  { value: "estimating", label: "Estimating" },
  { value: "estimate_ready", label: "Estimate ready" },
  { value: "quote_draft", label: "Quote draft" },
  { value: "quote_sent", label: "Quote sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

export function parseProjectListFilter(value?: string): ProjectListFilter {
  if (value === "archived" || value === "all" || value === "active") {
    return value;
  }

  if (value && isBusinessStatus(value)) {
    return value;
  }

  return "active";
}

export function isLifecycleArchiveFilter(filter: ProjectListFilter): boolean {
  return filter === "archived";
}

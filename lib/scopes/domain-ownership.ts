/**
 * Stage 3.1D — Domain ownership contracts (pure).
 *
 * Binding rules for scope objects. No DB / React imports.
 * Estimating consumers must read Facts (+ derived merge), never Question answers.
 */

/** Roles in the Question → Fact → Estimate pipeline. */
export type ScopeDomainRole =
  | "question"
  | "fact"
  | "derived_fact"
  | "constraint";

export type DomainEntityId =
  | "organisation"
  | "profile"
  | "project"
  | "client_details"
  | "site_details"
  | "project_brief"
  | "site_notes"
  | "work_area"
  | "question"
  | "question_block"
  | "fact"
  | "derived_fact"
  | "constraint"
  | "estimate"
  | "pricing_document"
  | "quote"
  | "rate"
  | "company_defaults"
  | "note_proposal"
  | "photo"
  | "file_document"
  | "historical_record";

export type DomainEntityContract = {
  id: DomainEntityId;
  /** Product meaning */
  purpose: string;
  /** Who owns the durable record */
  owner: string;
  /** Authoritative store for business meaning */
  sourceOfTruth: string;
  /** Create → mutate → terminal states */
  lifecycle: string;
  /**
   * When the value stops being live-editable for downstream commercial commitment.
   * Scope objects freeze at estimate generation for that generation; commercial
   * documents freeze at quote create / supersede.
   */
  freezePoint: string;
  downstreamConsumers: string[];
};

/**
 * Reserved project-level constraint keys.
 * These must never be stored as project_facts — constraints own this namespace.
 */
export const RESERVED_CONSTRAINT_KEYS = [
  "site_access",
  "floor_level",
  "material_carry_distance",
  "waste_bin_access",
  "services_isolated",
  "occupied_site",
  "working_hours",
  "hazardous_materials_risk",
  "parking_loading",
  "protection_dust_control",
  "client_supplied_items",
  "by_others_trades",
  "consent_engineering",
  "site_slope",
] as const;

export type ReservedConstraintKey = (typeof RESERVED_CONSTRAINT_KEYS)[number];

const RESERVED_CONSTRAINT_KEY_SET = new Set<string>(RESERVED_CONSTRAINT_KEYS);

/** Fact source precedence when merging display candidates (higher wins). */
export const FACT_SOURCE_PRECEDENCE: Record<string, number> = {
  user: 100,
  ai_extracted: 60,
  default: 40,
  assumption: 30,
  system: 20,
  derived: 10,
};

/**
 * Authoritative scope pipeline:
 * Question (capture) → Fact (SoT) → Derived Fact (computed) → Estimate (reads facts only).
 * Constraints are a sibling project-level namespace, not facts.
 */
export const SCOPE_PIPELINE_ORDER = [
  "question",
  "fact",
  "derived_fact",
  "estimate",
] as const;

export function isReservedConstraintKey(key: string): boolean {
  return RESERVED_CONSTRAINT_KEY_SET.has(key);
}

/**
 * Work-area / scoped fact keys use dotted namespaces (e.g. deck.area_m2).
 * Constraint keys are flat identifiers without a work-area type prefix.
 */
export function looksLikeScopedFactKey(key: string): boolean {
  return key.includes(".");
}

export function canWriteKeyToFacts(key: string): boolean {
  return !isReservedConstraintKey(key);
}

export function canWriteKeyToConstraints(key: string): boolean {
  return !looksLikeScopedFactKey(key);
}

export function factSourcePrecedence(source: string | null | undefined): number {
  if (!source) return 0;
  return FACT_SOURCE_PRECEDENCE[source] ?? 0;
}

/**
 * Derived persistence rule: never overwrite a user-owned fact.
 * AI / derived / empty rows may be replaced by a fresh derivation.
 */
export function shouldWriteDerivedFact(existingSource: string | null | undefined): boolean {
  return existingSource !== "user";
}

/**
 * Whether a persisted fact row is authoritative for estimating / readiness.
 * Question answers are never authoritative.
 */
export function isFactAuthoritativeForEstimate(
  source: string | null | undefined
): boolean {
  return source !== null && source !== undefined;
}

export const DOMAIN_ENTITY_CONTRACTS: readonly DomainEntityContract[] = [
  {
    id: "organisation",
    purpose: "Tenancy root for all commercial and project data",
    owner: "Self (tenant root)",
    sourceOfTruth: "organisations",
    lifecycle: "create on signup → update by owner/admin → no soft-delete",
    freezePoint: "N/A (live configuration)",
    downstreamConsumers: ["All org-scoped tables", "RLS auth_org_id()"],
  },
  {
    id: "profile",
    purpose: "Authenticated user bound to one organisation (MVP)",
    owner: "Organisation via profiles.org_id; identity via auth.users",
    sourceOfTruth: "profiles + auth.users",
    lifecycle: "create on signup → self-update → cascade with auth user",
    freezePoint: "N/A",
    downstreamConsumers: ["Authorship columns", "security context"],
  },
  {
    id: "project",
    purpose: "Job root for scope and commercial progression",
    owner: "Organisation",
    sourceOfTruth: "projects",
    lifecycle: "create → update → archive / soft-delete",
    freezePoint: "Soft-delete hides from active workflow; children retained",
    downstreamConsumers: ["All project children", "dashboard"],
  },
  {
    id: "client_details",
    purpose: "Customer name for the job",
    owner: "Project (editable)",
    sourceOfTruth: "projects.client_name before quote; quote snapshot after",
    lifecycle: "edit on project / draft pricing → snapshot at quote create",
    freezePoint: "Quote create / revision (immutable snapshot)",
    downstreamConsumers: ["Pricing header", "Quote print"],
  },
  {
    id: "site_details",
    purpose: "Site address for the job",
    owner: "Project (editable)",
    sourceOfTruth: "projects.site_address before quote; quote snapshot after",
    lifecycle: "edit on project / draft pricing → snapshot at quote create",
    freezePoint: "Quote create / revision (immutable snapshot)",
    downstreamConsumers: ["Pricing header", "Quote print"],
  },
  {
    id: "project_brief",
    purpose: "Free-text job narrative for capture and AI extraction",
    owner: "Project",
    sourceOfTruth: "projects.brief_text",
    lifecycle: "create/update with project; not versioned",
    freezePoint: "Never freezes commercial totals; inputs may change until estimate regen",
    downstreamConsumers: ["AI extraction", "analysis source builders"],
  },
  {
    id: "site_notes",
    purpose: "Captured site observations",
    owner: "Project",
    sourceOfTruth: "project_notes",
    lifecycle: "create → update → soft-delete; analysis_status transitions",
    freezePoint: "Soft-delete; analysed proposals accepted separately",
    downstreamConsumers: ["Note proposals", "AI analysis"],
  },
  {
    id: "work_area",
    purpose: "Scoped portion of the job",
    owner: "Project (instance); Organisation enables types",
    sourceOfTruth: "work_areas (+ organisation_work_areas for enablement)",
    lifecycle: "suggested → confirmed | excluded; hard delete allowed",
    freezePoint: "Confirmed set freezes for a given estimate generation",
    downstreamConsumers: ["Questions", "Facts", "Estimate", "Pricing", "Quote"],
  },
  {
    id: "question",
    purpose: "Interaction / capture surface for scope answers",
    owner: "Project via question_blocks",
    sourceOfTruth:
      "questions.answer_value is a capture journal only — NOT estimating authority",
    lifecycle: "create in block → answer → block submitted / superseded",
    freezePoint: "Block submitted; answers remain editable via Scope Review paths",
    downstreamConsumers: ["UI editors", "Fact materialization (write-through)"],
  },
  {
    id: "question_block",
    purpose: "Stage container for questions",
    owner: "Project",
    sourceOfTruth: "question_blocks",
    lifecycle: "active → submitted | superseded",
    freezePoint: "submitted / superseded",
    downstreamConsumers: ["Questions", "assistant stage progression"],
  },
  {
    id: "fact",
    purpose: "Structured scope values consumed by estimating",
    owner: "Project (± work_area_id)",
    sourceOfTruth: "project_facts — sole estimating / readiness authority",
    lifecycle: "upsert by key; user overrides win over derived/AI",
    freezePoint: "Values used by a generated estimate; regen reads current facts",
    downstreamConsumers: ["Estimate calculators", "Scope Review", "Quote descriptions"],
  },
  {
    id: "derived_fact",
    purpose: "Computed facts from other facts (e.g. area from length×width)",
    owner: "Project (stored as project_facts with source=derived)",
    sourceOfTruth: "Derived from user/AI facts; persisted for convenience",
    lifecycle: "recomputed on scope writes; never overwrites source=user",
    freezePoint: "Same as facts for a given estimate generation",
    downstreamConsumers: ["Estimate", "Scope Review displays"],
  },
  {
    id: "constraint",
    purpose: "Project-level site/condition limitations",
    owner: "Project",
    sourceOfTruth: "constraints table (exclusive namespace for reserved keys)",
    lifecycle: "upsert by project_id+key",
    freezePoint: "Values used by a generated estimate; regen reads current constraints",
    downstreamConsumers: ["Estimate labour adjustments", "Scope Review", "Interview later"],
  },
  {
    id: "estimate",
    purpose: "Internal quick estimate (guidance)",
    owner: "Project (1:1)",
    sourceOfTruth: "estimates + estimate_line_items",
    lifecycle: "generate → stale → regenerate in place",
    freezePoint: "Not customer-committed; superseded by pricing/quote",
    downstreamConsumers: ["Pricing create/recalibration", "Estimate panel"],
  },
  {
    id: "pricing_document",
    purpose: "Editable commercial refinement",
    owner: "Project",
    sourceOfTruth: "pricing_documents + pricing_items",
    lifecycle: "draft → reviewed → converted_to_quote | archived",
    freezePoint: "Quote create snapshots commercial intent",
    downstreamConsumers: ["Quote builder", "audit log"],
  },
  {
    id: "quote",
    purpose: "Customer-facing commercial offer",
    owner: "Project",
    sourceOfTruth: "quotes + quote_items (revision chain)",
    lifecycle: "create → send/accept/decline → revise (supersede)",
    freezePoint: "Create / revision — historical snapshots immutable",
    downstreamConsumers: ["Print/PDF", "business status"],
  },
  {
    id: "rate",
    purpose: "Organisation rate card",
    owner: "Organisation",
    sourceOfTruth: "rates",
    lifecycle: "upsert; soft-deactivate via active=false",
    freezePoint: "Rate changes do not rewrite existing pricing/quotes",
    downstreamConsumers: ["Estimate rate resolution", "setup UI"],
  },
  {
    id: "company_defaults",
    purpose: "Org commercial defaults and company profile",
    owner: "Organisation",
    sourceOfTruth: "organisation_settings",
    lifecycle: "upsert single row per org",
    freezePoint: "Snapshotted into pricing/quote at create where applicable",
    downstreamConsumers: ["Estimate", "Pricing GST", "Quote defaults", "branding"],
  },
  {
    id: "note_proposal",
    purpose: "AI suggestion review gate (suggestion ≠ commitment)",
    owner: "Project",
    sourceOfTruth: "note_proposals",
    lifecycle: "pending_review → accepted | partially_accepted | dismissed",
    freezePoint: "Accept writes domain objects; dismiss leaves scope unchanged",
    downstreamConsumers: ["Work areas", "Facts", "Constraints"],
  },
  {
    id: "photo",
    purpose: "Visual site evidence (frozen journey)",
    owner: "Project (intended)",
    sourceOfTruth: "Missing — photo_caption note source is a stub only",
    lifecycle: "Not implemented",
    freezePoint: "N/A",
    downstreamConsumers: ["None"],
  },
  {
    id: "file_document",
    purpose: "Uploaded plans/specs (frozen journey)",
    owner: "Project (intended)",
    sourceOfTruth: "Missing — not pricing_documents",
    lifecycle: "Not implemented",
    freezePoint: "N/A",
    downstreamConsumers: ["None"],
  },
  {
    id: "historical_record",
    purpose: "Unified learning/history substrate",
    owner: "Organisation / Project (intended)",
    sourceOfTruth: "Fragmented — quote revisions + pricing_audit_log only",
    lifecycle: "Emergent; Evidence Engine not implemented",
    freezePoint: "Quote snapshots already freeze commercial history",
    downstreamConsumers: ["Quote history UI", "future Evidence Engine"],
  },
];

export function getDomainEntityContract(
  id: DomainEntityId
): DomainEntityContract | undefined {
  return DOMAIN_ENTITY_CONTRACTS.find((entity) => entity.id === id);
}

# Stage 3.1C — Domain Model Architectural Audit

**Status:** Complete (documentation only)  
**Date:** 2026-08-05  
**Audience:** Product owners, engineers, and independent architectural reviewers  
**Constraint:** Audit only — no application code, migrations, schemas, UI, AI prompts, or commercial calculations changed  
**Governing architecture:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
**Governing process:** `docs/MVP_HARDENING_GUIDE.md`  
**Product sequence:** `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`  

---

## 0. Executive verdict

Quotr’s domain model is **structurally sound for the frozen MVP journey** and **intelligence-ready in principle**, but **not yet evidence-ready as a coherent substrate**.

**What works today**

- Clear tenancy root (`organisations` → `org_id` everywhere that matters for RLS).
- Clear job root (`projects`) with a complete commercial progression: **Estimate → Pricing → Quote**.
- Structured scope objects exist as first-class tables: work areas, facts, questions, constraints, notes.
- Stage 2B established a single commercial arithmetic authority (`lib/commercial-engine/`) without embedding ML.
- Stage 3.1A clarified client/site source of truth, brief vs site notes, and deliberate-vs-unanswered answer semantics.

**What is fragile**

- Several product concepts are **columns or denormalized snapshots**, not entities (Client, Site Details, Project Brief).
- Several frozen-journey concepts are **missing** (Photos, file Documents, Historical Records as a unified domain).
- Ownership and naming drift across parallel line models, status systems, and “notes” vocabulary.
- Questions ↔ facts dual-write and estimate line metadata-in-`notes` create learning and reporting blockers.
- Constraint taxonomy is captured widely but only partially consumed by estimating.

**Bottom line for Stage 3**

The model can evolve into Intelligent Scope Discovery, Builder Interview, Assemblies, Defaults, Evidence, and Company DNA **without a rewrite**, provided improvements remain evolutionary: clarify ownership, close dual-write/provenance gaps, add missing media/evidence entities when authorised, and keep money ownership inside the commercial engine.

---

## 1. Audit method and sources

### 1.1 Documents read first

| Document | Role |
| --- | --- |
| `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md` | Canonical product domain & principles |
| `docs/plans/STAGE_3_PRODUCT_ROADMAP.md` | Stage 3 sequence |
| `docs/product/QUOTR_PRODUCT_BACKLOG.md` | 3.1A decisions + deferred FEATs |
| `docs/audits/STAGE_3_1A_PRODUCT_STABILISATION_AUDIT.md` | Client/brief/answer SoT decisions |
| `docs/implementation/STAGE_3_1A_PRODUCT_STABILISATION_COMPLETION.md` | Implemented SoT rules |
| `docs/audits/STAGE_1_CURRENT_STATE_AUDIT.md` | Baseline gaps (photos/docs/packages) |
| `docs/implementation/STAGE_2B_COMPLETION_REPORT.md` | Commercial engine boundary |
| `docs/specifications/AUTHORITATIVE_PRICING_ENGINE_SPEC.md` | Money authority + learning hooks |
| `docs/specifications/COMMERCIAL_ENGINE_CONTRACT.md` | Engine contract |
| `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md` | DNA-relevant commercial decisions |
| `docs/KNOWN_LIMITATIONS.md` | Accepted MVP limits |
| `docs/WORK_AREA_COVERAGE_MATRIX.md` | Scope coverage unevenness |
| `docs/MVP_HARDENING_GUIDE.md` | Hardening stage naming (collides with product “Stage 4”) |

### 1.2 Code / schema inspected

- Migrations `001`–`027` under `supabase/migrations/`
- Domain modules: `lib/{projects,assistant,scopes,estimate,pricing,quotes,rates,settings,project-notes,security,commercial-engine,audit,work-areas,setup,ai}`
- Key type surfaces: `lib/*/types.ts`, `components/assistant/types.ts`, `components/setup/types.ts`
- Constraint templates: `lib/assistant/constraint-templates.ts`
- Scope templates: `lib/scopes/templates/*`

### 1.3 Naming caveat (reviewers must not conflate)

| Name | Meaning in this programme |
| --- | --- |
| **Stage 3.1C** | This domain-model audit (docs only) |
| **Hardening Stage 4** | Residual estimating-path hardening after Stage 2B — **not** Company DNA |
| **Product Stage 4 / “Later → Company DNA”** | Company-specific intelligence consuming structured evidence |
| **Stage 3.5 Evidence Engine** | **Not named in current roadmap docs**; evaluated here as the logical evidence substrate between Stage 3.4 and Company DNA, consistent with architecture §§9–10 |

---

## 2. Canonical relationship map (as-built)

```
auth.users
  └── profiles (User ↔ Organisation membership; one org per user in MVP)
        └── organisations (tenancy root)
              ├── organisation_settings          (Company Defaults / profile / quote defaults)
              ├── organisation_work_areas        (enabled work-area types)
              ├── rates                          (company rate card)
              └── projects                       (job root)
                    ├── client_name, site_address, brief_text, notes   (columns, not child tables)
                    ├── work_areas
                    │     └── quote_description (client-facing narrative cache)
                    ├── project_facts            (± work_area_id)
                    ├── question_blocks → questions
                    ├── constraints              (project-level)
                    ├── project_notes → note_proposals
                    ├── estimates (1:1 project) → estimate_line_items
                    ├── pricing_documents → pricing_items
                    ├── quotes (revision chain) → quote_items
                    └── pricing_audit_log        (pricing/quote mutations; organisation_id naming)
```

**Commercial commitment ladder**

```
Scope inputs (work areas, facts, questions, constraints, notes)
        ↓ deterministic calculators + commercial engine
Estimate (internal guidance; regenerated in place)
        ↓ create / recalibrate
Pricing Document (editable commercial truth)
        ↓ create / revise
Quote (customer-facing snapshot; revision history)
```

**Code-only domain (no tables)**

- Scope question templates (`lib/scopes/templates/*`)
- Constraint templates (`lib/assistant/constraint-templates.ts`)
- Scope catalogue / coverage (`lib/scopes/catalogue.ts`)
- Commercial engine (`lib/commercial-engine/*`)
- Benchmark rates / productivity fallbacks

---

## 3. Entity audits

For each entity: purpose, owner, lifecycle, source of truth, downstream consumers, upstream dependencies, strengths, weaknesses, duplicated responsibilities, future suitability.

---

### 3.1 Organisation

| Field | Finding |
| --- | --- |
| **Purpose** | Tenant root for all commercial and project data. |
| **Owner** | Self (tenancy root). |
| **Lifecycle** | Created at signup; update by owner/admin via RLS; no soft-delete. |
| **Source of truth** | `organisations` (`id`, `name`, `subscription_tier`, `created_at`). |
| **Downstream** | Every org-scoped table via `org_id`; RLS via `auth_org_id()`. |
| **Upstream** | None (root). Auth users bind through `profiles`. |
| **Strengths** | Simple, absolute isolation model; matches architecture §3.3 / §7 rule 1. |
| **Weaknesses** | `subscription_tier` exists without billing product; no org soft-delete/archive story. |
| **Duplicated responsibilities** | “Company” language in UI/settings vs table name `organisations`. |
| **Future suitability** | **Good** for DNA (DNA must be org-scoped). Insufficient alone for multi-company UX (correctly out of MVP). |

---

### 3.2 User / Profile

| Field | Finding |
| --- | --- |
| **Purpose** | Authenticated person bound to exactly one organisation (MVP). |
| **Owner** | Organisation (`profiles.org_id`); identity owned by `auth.users`. |
| **Lifecycle** | Insert on signup; self-update; cascade with Auth user delete. Roles: `owner` / `admin` / `member`. |
| **Source of truth** | `profiles` + Supabase Auth. |
| **Downstream** | Authorship on projects, notes, proposals, pricing, quotes, audit `user_id`. |
| **Upstream** | `auth.users`, `organisations`. |
| **Strengths** | Membership derived from profile — not client-supplied org switcher (architecture compliant). |
| **Weaknesses** | Roles exist but product has no invitation/permissions admin; RESTRICT FKs on authorship columns can block user deletion. Auth helpers re-exported from assistant module (coupling smell). |
| **Duplicated responsibilities** | “User” (Auth) vs “Profile” (app) vs display context strings. |
| **Future suitability** | **Adequate** for MVP sharing; **insufficient** for team permissions / multi-org without explicit product work. |

---

### 3.3 Project

| Field | Finding |
| --- | --- |
| **Purpose** | Job being estimated and quoted; job-domain root. |
| **Owner** | Organisation; `created_by` profile. |
| **Lifecycle** | Create/update; soft-delete (`deleted_at`); archive (`archived_at` and/or business status); duplicate (partial copy). |
| **Source of truth** | `projects` row. |
| **Downstream** | All project children: work areas, facts, questions, constraints, notes, estimate, pricing, quotes. |
| **Upstream** | Organisation, creating profile. |
| **Strengths** | Stable UUID identity; soft-delete preserves learning substrate; business pipeline status supports dashboard. |
| **Weaknesses** | **Triple status model:** `stage` (assistant wizard), legacy `status` (`draft`/`active`/`archived`), `business_status` (+ `archived_at`). Easy to mis-filter “active” projects. Duplicate copies WA/facts/constraints only — not notes, questions, estimate, pricing, quotes. |
| **Duplicated responsibilities** | Archive semantics split across columns; internal ops `notes` vs site notes vs brief. |
| **Future suitability** | **Good** job root for DNA/actuals linkage **if** status vocabulary is clarified. |

**Key columns (product-facing):** `title`, `brief_text`, `client_name`, `site_address`, `priority`, `due_date`, `notes`, `stage`, `quality_level`, `business_status`, lifecycle timestamps, `duplicated_from_project_id`.

---

### 3.4 Site Details

| Field | Finding |
| --- | --- |
| **Purpose** | Where the job is located / site context for quotes and pricing headers. |
| **Owner** | Project (not a separate entity). |
| **Lifecycle** | Updated with project; snapshotted into pricing/quotes. |
| **Source of truth** | **Editable:** `projects.site_address` (Stage 3.1A). **Commercial snapshots:** `pricing_documents.site_address`, `quotes.site_address`. |
| **Downstream** | Pricing UI, quote print, project header. |
| **Upstream** | User entry via project edit or draft pricing edit. |
| **Strengths** | Stage 3.1A locked lifecycle: project authoritative before quote; quotes immutable after issue. |
| **Weaknesses** | Scalar address only — no site entity, access profile, geocode, or structured site attributes. Site constraints live separately in `constraints`. |
| **Duplicated responsibilities** | Site address vs site constraints vs site notes vs `photo_caption` notes. |
| **Future suitability** | **Partial.** Enough for MVP quoting; **weak** for Evidence Engine / Interview site model without structured site attributes or media. |

---

### 3.5 Client

| Field | Finding |
| --- | --- |
| **Purpose** | Who the job is for (customer identity for quotes). |
| **Owner** | Project (denormalized string). |
| **Lifecycle** | Free-text create/update on project; snapshotted to pricing/quotes. |
| **Source of truth** | **Editable:** `projects.client_name` (Stage 3.1A). Snapshots on pricing/quotes. |
| **Downstream** | Pricing details, quote print, dashboard display. |
| **Upstream** | Manual entry only. |
| **Strengths** | SoT decision after 3.1A prevents pricing/project drift for draft work. |
| **Weaknesses** | **No `clients` table**, contacts, CRM history, or client UUID. Cannot learn “same client across jobs” without string matching. |
| **Duplicated responsibilities** | Client string on project / pricing / quote. |
| **Future suitability** | **MVP-acceptable; DNA-weak.** CRM client entity is a later product decision (architecture correctly excludes full CRM from MVP). Prefer evolutionary `clients` table only when authorised — do not invent CRM now. |

---

### 3.6 Project Brief

| Field | Finding |
| --- | --- |
| **Purpose** | Free-text job narrative used for AI work-area/fact extraction and human orientation. |
| **Owner** | Project. |
| **Lifecycle** | Create/update with project; not versioned. |
| **Source of truth** | `projects.brief_text`. |
| **Downstream** | AI extract (`lib/ai/*`), assistant brief stage, analysis source builders, estimate context indirectly via derived work areas/facts. |
| **Upstream** | User entry at project create / capture UI. |
| **Strengths** | Distinct from Site Notes after UX-005 — supports future evidence taxonomy. |
| **Weaknesses** | Unstructured blob; no provenance of edits; no brief revision history; AI extraction outputs are not bound back as “brief-derived evidence events.” |
| **Duplicated responsibilities** | Brief vs `projects.notes` (internal) vs `project_notes` (site). Three “notes-like” surfaces. |
| **Future suitability** | **Good as an input channel**; **poor as evidence alone**. Interview/DNA need structured facts/constraints derived from brief, not the brief text as truth. |

---

### 3.7 Site Notes

| Field | Finding |
| --- | --- |
| **Purpose** | Captured site/job observations (text today); AI analysis source. |
| **Owner** | Project (org-scoped). |
| **Lifecycle** | Create/update; soft-delete (`deleted_at`); `analysis_status` pending/analysed/dismissed. |
| **Source of truth** | `project_notes` table. |
| **Downstream** | Note proposals → work areas / facts / constraints; excluded internal types (e.g. calibration) from AI/quotes. |
| **Upstream** | User capture; optional link to proposal review. |
| **Strengths** | First-class table with type/source taxonomy; soft-delete preserves history; `note_proposals` review gate matches AI principles. |
| **Weaknesses** | Naming collision with `projects.notes`; `source=photo_caption` implies photos without storage; analysis is proposal-based, not a durable evidence log of every extraction. |
| **Duplicated responsibilities** | “Site Notes” (UI) / `project_notes` (DB) / Project Brief / internal project notes. |
| **Future suitability** | **Strong substrate** for Evidence Engine **if** media attachments and proposal accept/reject events are recorded as evidence. |

**Related:** `note_proposals` — pending AI suggestions (`proposed_work_areas` / `facts` / `constraints` jsonb) with accept/dismiss lifecycle. Important intelligence boundary object.

---

### 3.8 Work Area

| Field | Finding |
| --- | --- |
| **Purpose** | Scoped portion of the job; primary unit of scope confirmation and estimating. |
| **Owner** | Project instance; org enables types via `organisation_work_areas`; type definitions in code catalogue. |
| **Lifecycle** | `suggested` → `confirmed` / `excluded`; hard delete allowed; quote description updated separately. |
| **Source of truth** | `work_areas` for instances; `organisation_work_areas` for enablement; `lib/scopes/catalogue.ts` + templates for type semantics. |
| **Downstream** | Questions, facts, estimate calculators, pricing grouping, quote sections/descriptions. |
| **Upstream** | Brief AI suggestions, note proposals, manual add. |
| **Strengths** | Matches architecture; status model supports human confirmation of AI; quote_description supports client narrative. |
| **Weaknesses** | Three layers of “work area type” (catalogue / org enablement / project instance). Coverage uneven (see WORK_AREA_COVERAGE_MATRIX). Excluded vs deleted semantics may confuse learning (“never present” vs “rejected”). |
| **Duplicated responsibilities** | Work-area grouping ≠ commercial packages/assemblies (Stage 1 confirmed packages absent). |
| **Future suitability** | **Core object for 3.1B**. Ready as discovery target; needs ranking/provenance improvements, not a new entity. |

---

### 3.9 Question

| Field | Finding |
| --- | --- |
| **Purpose** | Work-area / stage questions that refine scope and quantities. |
| **Owner** | Project (via `question_blocks` + `questions`). |
| **Lifecycle** | Blocks created per stage; status `active` / `submitted` / `superseded`; answers update in place. |
| **Source of truth** | Templates in code; instances in DB. **Answer capture:** `questions.answer_value`. **Estimating truth:** should sync to `project_facts`. |
| **Downstream** | Scope Review UI; fact materialization; missing-item readiness; stage progression. |
| **Upstream** | Confirmed work areas + scope templates + conditional rules. |
| **Strengths** | Structured input types; Stage 3.1A hardened save reliability and deliberate-answer semantics (`none` vs unanswered vs listed `unknown`). |
| **Weaknesses** | Dual-write with facts (drift risk). TS supports `multi_select`; DB check does not. Template registry is code-only (versioning/company custom questions not modelled). Missing-details regeneration creates additional blocks — complexity for ISD. |
| **Duplicated responsibilities** | Question answer vs project fact for same key; constraint questions vs work-area questions. |
| **Future suitability** | **Ready for 3.1B / Interview with care.** Prefer facts as estimating SoT; treat questions as interaction/provenance layer — document and enforce that contract. |

---

### 3.10 Fact

| Field | Finding |
| --- | --- |
| **Purpose** | Structured project/work-area facts consumed by estimating and scope review. |
| **Owner** | Project; optionally scoped to `work_area_id`. |
| **Lifecycle** | Upsert by unique key; derived facts rewritten by `persist-derived-facts`; conflict warnings possible. |
| **Source of truth** | **`project_facts` is the authoritative estimating input** (confirmed in 3.1A audit). |
| **Downstream** | Estimate calculators, scope review, quote description generation, constraint inference, note proposal merge. |
| **Upstream** | Question answers, AI extraction, derived rules, defaults/assumptions/system. |
| **Strengths** | First-class jsonb values; `source` enum (`user` / `ai_extracted` / `derived` / `default` / `assumption` / `system`); confidence; uniqueness indexes; conflict_warning. Intelligence-ready provenance fields exist. |
| **Weaknesses** | Fact key registry is convention (`lib/scopes/fact-keys.ts`), not a versioned ontology table. Source provenance not always preserved on every write path. Derived rewrite can obscure prior user values without full history. No fact revision history. |
| **Duplicated responsibilities** | Overlaps question answers; some constraint-like facts (e.g. client-supplied) also appear as constraints. |
| **Future suitability** | **Primary DNA evidence atom for scope.** Strengthen provenance + history before Company DNA; do not replace with prompt memory. |

---

### 3.11 Constraint

| Field | Finding |
| --- | --- |
| **Purpose** | Project-level limitations/conditions (access, occupancy, consent, etc.). |
| **Owner** | Project. |
| **Lifecycle** | Upsert by `(project_id, key)`; seeded from templates / brief / note proposals / fact inference. |
| **Source of truth** | `constraints` table; templates in code. |
| **Downstream** | Estimate labour adjustments for a **subset** of keys; Scope Review UI; future Interview/DNA (FEAT-003). |
| **Upstream** | Constraint stage UI, note proposals, brief extraction, fact inference. |
| **Strengths** | Structured keys with source enum; scope-driven relevance selection exists; aligned with architecture object. |
| **Weaknesses** | Many captured keys have **no estimate consumer** (Stage 1 audit: ~10 keys stored but unused). Taxonomy expansion deferred (FEAT-003). Project-level only — cannot attach constraint to a specific work area. Display options use human strings (“Easy”) rather than stable enums in places. |
| **Duplicated responsibilities** | Constraint vs fact vs exclusion note type vs quote exclusions narrative. |
| **Future suitability** | **Central to Stage 3.2 / DNA**, but taxonomy + consumption map must be designed before expansion. Expanding unconstrained free-form lists would harm learning. |

---

### 3.12 Estimate

| Field | Finding |
| --- | --- |
| **Purpose** | Internal quick estimate for judgement; not the customer offer. |
| **Owner** | Project (**exactly one** live estimate row per project). |
| **Lifecycle** | Insert/update in place; line items deleted & replaced on regenerate; `stale` when scope changes; no soft-delete / no revision chain. |
| **Source of truth** | `estimates` + `estimate_line_items`; money via commercial engine adapters. |
| **Downstream** | Pricing create-from-estimate; recalibration; assistant Estimate panel. |
| **Upstream** | Confirmed work areas, facts, constraints, quality_level, org rates/settings. |
| **Strengths** | Clear product role (guide vs commit); stale marking; assumptions/exclusions/missing_info arrays; calibration_version / assumption_metadata hooks. |
| **Weaknesses** | Regeneration **destroys prior estimate history** (unlike quotes). Rich line runtime model packed into `notes` via `__quotr_meta__` JSON — not first-class columns. TS `mixed` category vs DB check. |
| **Duplicated responsibilities** | Parallel money fields also exist on pricing/quote; mitigated by Stage 2B engine authority for arithmetic meaning. |
| **Future suitability** | **Good for guidance.** **Weak for learning history** unless estimate snapshots or commercial events are added before DNA relies on estimate evolution. |

---

### 3.13 Pricing (Final Pricing / Pricing Document)

| Field | Finding |
| --- | --- |
| **Purpose** | Company-controlled commercial refinement derived from estimate; editable before quote. |
| **Owner** | Project. |
| **Lifecycle** | Create from estimate; edit items; recalibrate; status `draft` → `reviewed` → `converted_to_quote` / `archived`. |
| **Source of truth** | `pricing_documents` + `pricing_items` after creation; estimate remains upstream for recalibration. |
| **Downstream** | Quote builder; dashboard summaries; audit log. |
| **Upstream** | Estimate line items; org GST/quote defaults; client/site from project (3.1A sync for drafts). |
| **Strengths** | Distinct from estimate (architecture rule 9); calculation modes; visibility/optional flags; recalibration model; Stage 2B engine adoption. |
| **Weaknesses** | Name “document” confuses with file Documents. Optional items not productised commercially (FEAT-002). Client/site snapshot can still diverge after quote. No inclusions column (quotes have inclusions). |
| **Duplicated responsibilities** | Line model parallel to estimate_line_items and quote_items. |
| **Future suitability** | **Primary commercial editing surface for Assemblies (3.3)** and override evidence (3.4). Strong candidate for override provenance hardening. |

---

### 3.14 Quote

| Field | Finding |
| --- | --- |
| **Purpose** | Customer-facing commercial offer; historical revisions preserved. |
| **Owner** | Project. |
| **Lifecycle** | Create from pricing; revise (supersede chain); status sent/accepted/declined/expired/revised/archived. |
| **Source of truth** | Quote rows are **snapshots**; company rate changes do not rewrite them. |
| **Downstream** | Print/PDF, business_status updates, audit. |
| **Upstream** | Reviewed pricing; org quote defaults at create. |
| **Strengths** | Best historical model in the product today (revision graph). Sell-side only (correct). Immutable commercial history supports DNA. |
| **Weaknesses** | Acceptance is manual (no portal — known limitation). Optional presentation incomplete. Inclusions/exclusions/assumptions are narrative arrays — not structured commercial events. |
| **Duplicated responsibilities** | Client/site/terms also live on pricing and org defaults. |
| **Future suitability** | **Excellent historical anchor** for Scenario Learning / DNA. Keep immutability sacred. |

---

### 3.15 Rates

| Field | Finding |
| --- | --- |
| **Purpose** | Organisation rate card feeding estimate generation. |
| **Owner** | Organisation. |
| **Lifecycle** | Upsert by `(org_id, rate_type, item_key)`; soft deactivate via `active=false`. |
| **Source of truth** | `rates` table; benchmarks in code as fallback when settings allow. |
| **Downstream** | Estimate rate resolution; setup/rates UI; calibration helpers. |
| **Upstream** | Setup starter rates; manual company edits; future DNA suggestions (must not auto-write). |
| **Strengths** | Structured, inspectable, org-scoped — DNA substrate. Prefer user rates flag exists. |
| **Weaknesses** | Range columns in DB not fully surfaced in primary setup TS type. `package` rate_type exists without package/assembly product. Trade/work_area_type sparsely used. |
| **Duplicated responsibilities** | Company defaults margin vs rate markup vs per-line margins. |
| **Future suitability** | **Core DNA configuration object.** Stage 3.4 must treat rate edits and overrides as evidence, never silent ML mutation. |

---

### 3.16 Company Defaults

| Field | Finding |
| --- | --- |
| **Purpose** | Org commercial defaults, company profile, quote boilerplate, wastage, onboarding. |
| **Owner** | Organisation. |
| **Lifecycle** | Upsert single `organisation_settings` row; soft onboarding steps. |
| **Source of truth** | `organisation_settings` (+ related `organisation_work_areas`). |
| **Downstream** | Estimates (margin, wastage, rate preference), pricing GST, quote defaults snapshot, branding/print. |
| **Upstream** | Setup wizard; company settings / rates pages. |
| **Strengths** | Single-row org config; quote defaults and wastage exist; default margin aligned to product rule (20% for new rows post-025). |
| **Weaknesses** | Split TS shapes (`OrganisationSettings` vs `CompanySettings`) over one table. `country` vs `address_country`. `logo_url` is URL string, not media entity. Defaults are configuration, not a learning evidence log. |
| **Duplicated responsibilities** | Default quote assumptions/exclusions (text) vs estimate/pricing/quote jsonb arrays. |
| **Future suitability** | **Ready as Stage 3.4 configuration surface**; needs explicit “manual learning / correction accept” layer for DNA. |

---

### 3.17 Photos

| Field | Finding |
| --- | --- |
| **Purpose** | (Architecture / frozen journey) Visual site evidence alongside notes/documents. |
| **Owner** | Should be Project (org-scoped). |
| **Lifecycle** | **Not implemented.** |
| **Source of truth** | **Missing.** Only `project_notes.source = 'photo_caption'` enum stub. |
| **Downstream** | None for binary media. |
| **Upstream** | None. |
| **Strengths** | Journey intentionally reserved the concept; Stage 1 correctly identified the gap. |
| **Weaknesses** | Largest frozen-journey gap vs architecture §5 step 6. |
| **Duplicated responsibilities** | N/A — absent. |
| **Future suitability** | **Required for Evidence Engine / Stage 3.5** if evidence includes visual site proof. Implement as evolutionary attachment model, not a redesign of notes. |

---

### 3.18 Documents (file attachments)

| Field | Finding |
| --- | --- |
| **Purpose** | (Architecture) Uploaded plans/specs/PDFs as project evidence. |
| **Owner** | Should be Project. |
| **Lifecycle** | **Not implemented** as file storage. |
| **Source of truth** | **Missing.** Do not confuse with `pricing_documents` (commercial workspace). |
| **Downstream** | None. |
| **Upstream** | None. |
| **Strengths** | Naming collision is documented (commercial “document” ≠ file document). |
| **Weaknesses** | Frozen journey incomplete; Evidence Engine blocked for plan-based evidence. |
| **Duplicated responsibilities** | Naming collision with pricing documents. |
| **Future suitability** | Same as Photos — add `project_attachments` (or equivalent) when authorised; keep pricing_documents name or alias carefully. |

---

### 3.19 Historical Records

| Field | Finding |
| --- | --- |
| **Purpose** | Durable history of commercial and scope decisions for integrity and later learning. |
| **Owner** | Organisation / Project (depending on event). |
| **Lifecycle** | Emergent, not unified. |
| **Source of truth** | Partial: quote revision chain; `pricing_audit_log`; soft-deleted projects/notes; commercial engine `FutureLearningHook` metadata (in-memory/result, not a durable DNA store). |
| **Downstream** | Quote history UI; limited audit; learning **not yet consuming**. |
| **Upstream** | Pricing/quote mutations primarily. |
| **Strengths** | Quote immutability + audit log = real substrate. Soft-delete preserves rows. |
| **Weaknesses** | No unified historical_records / evidence_events table. Estimate regen erases prior estimate. Fact/answer corrections lack revision history. Audit uses `organisation_id` naming inconsistency. Assistant/fact/rate mutations largely unaudited. |
| **Duplicated responsibilities** | Audit log vs quote revisions vs soft-delete retention vs learning hooks — overlapping intents. |
| **Future suitability** | **Not ready as Evidence Engine.** Needs a deliberate evidence event model before Company DNA. |

---

### 3.20 Related domain objects (supporting)

| Object | Persistence | Role | Audit note |
| --- | --- | --- | --- |
| **Question block** | `question_blocks` | Stage container for questions | Supersede model useful for Interview versions |
| **Estimate line item** | `estimate_line_items` | Internal cost/sell lines | Metadata-in-notes is a schema debt |
| **Pricing item** | `pricing_items` | Editable commercial lines | Override/manual_edited flags exist — good DNA hooks |
| **Quote item** | `quote_items` | Customer lines | Snapshot of pricing |
| **Note proposal** | `note_proposals` | AI suggestion review | Exemplar suggestion≠commitment pattern |
| **Organisation work area** | `organisation_work_areas` | Enabled types + estimate_support | DNA substrate for company scope identity |
| **Assumptions / inclusions / exclusions** | jsonb / text across layers | Commercial narrative | Shape inconsistency estimate/pricing/quote/org defaults |
| **Commercial engine** | Code only | Deterministic money authority | Must remain free of DNA writes |
| **FutureLearningHook** | Result metadata | Signals only; `auto_update_company_rules: false` | Not durable evidence store |
| **Quality / specification level** | `projects.quality_level` | Spec driver for estimate | Hardened in 3.1A |

---

## 4. Relationship analysis

### 4.1 Duplicated concepts

| Duplication | Objects involved | Risk |
| --- | --- | --- |
| Client/site identity | Project ↔ Pricing ↔ Quote | Snapshot drift (mitigated for drafts by 3.1A) |
| Answers vs facts | `questions.answer_value` ↔ `project_facts` | Dual-write drift; DNA ambiguity |
| “Notes” vocabulary | `brief_text`, `projects.notes`, `project_notes`, estimate line `notes`, pricing notes | Cognitive + query confusion |
| Line models | estimate_line_items ↔ pricing_items ↔ quote_items | Necessary progression, but heavy coupling |
| Assumptions/exclusions | Estimate / Pricing / Quote / Org defaults | Different shapes (jsonb arrays vs text) |
| Status/archive | `stage`, `status`, `business_status`, `archived_at` | Filtering bugs; learning cohort errors |
| Work-area type | Catalogue / org enablement / project instance | Three sources of truth for “what trades we do” |
| Constraint vs fact vs exclusion | Same site condition expressible three ways | Incomplete learning signals |
| Documents naming | File docs (missing) vs pricing_documents | Reviewer/agent confusion |

### 4.2 Missing concepts

| Missing concept | Why it matters | Suggested evolutionary path |
| --- | --- | --- |
| **Client entity** | Cross-job identity for CRM/DNA | Optional later `clients` table; keep string fallback |
| **Site entity / site profile** | Structured site attributes beyond address | Evolve from constraints + address; avoid premature CRM |
| **Photos / attachments** | Frozen journey + Evidence Engine | `project_attachments` + storage; link from notes |
| **File Documents** | Plans/specs evidence | Same attachment model |
| **Commercial Assemblies / Packages** | Reusable multi-line commercial units | New org-scoped assembly definitions + pricing adoption |
| **Evidence / commercial event store** | Unified learning substrate | Append-only evidence_events consuming audit + corrections |
| **Estimate revision/snapshot history** | DNA needs prior estimates | Snapshot-on-regenerate or event log |
| **Fact/answer revision history** | Correction evidence (OCD-50/51) | Version or event stream, not overwrite-only |
| **Interview session** | Stage 3.2 structured capture | May reuse question_blocks with interview stage — design first |
| **Actuals** | Scenario Learning | Keep IDs stable; do not build yet |

### 4.3 Ownership confusion

| Confusion | Clarification needed |
| --- | --- |
| Who owns client details before quote? | **Resolved (3.1A):** Project owns editable truth; draft pricing syncs; quotes snapshot. |
| Who owns estimating facts — questions or facts? | **Intent:** `project_facts`. Enforce dual-write contract; treat questions as UI/provenance. |
| Who owns commercial truth after pricing create? | Pricing document (editable); estimate is upstream guidance/recalibration source. |
| Who owns company rules — settings, rates, or DNA? | Settings/rates are inspectable config; DNA may suggest; company must accept (3.4 / DNA). |
| Soft-deleted project children | Remain live rows; app filters active projects — children not flagged deleted. Hygiene risk. |
| Auth context ownership | Security helpers should not conceptually “live” under assistant. |

### 4.4 Naming inconsistencies

| Inconsistent pair | Recommendation (evolutionary) |
| --- | --- |
| Organisation / Company | Keep both in product language; DB stays `organisations` |
| `org_id` vs audit `organisation_id` | Align naming on next audit-touching migration |
| Site Notes / `project_notes` / `projects.notes` | Rename UI labels already done; consider `internal_notes` rename later |
| Pricing Document vs Documents | Prefer “Final Pricing” in product; keep table name |
| Rate `package` type vs no packages | Reserve or implement in 3.3 — do not leave forever ambiguous |
| Constraint option display strings vs fact enums | Prefer stable stored enums + presentation labels (pattern from 3.1A UX-001) |

### 4.5 Coupling

| Coupling | Severity | Notes |
| --- | --- | --- |
| Assistant state ↔ almost all scope objects | High | Necessary for MVP journey; ISD must not make assistant the ontology |
| Estimate calculators ↔ fact key conventions | High | Template/calculator key contract is implicit |
| Pricing ↔ Estimate line IDs / fingerprints | Medium | Recalibration depends on linkage |
| Quote ↔ Pricing item IDs | Medium | Revision refresh rules |
| Constraints templates ↔ estimate adjustments | Medium | Many constraints unused — false coupling in UI |
| Commercial engine ↔ domain adapters | Low (healthy) | Correct boundary |
| Auth helpers exported via assistant | Medium | Package boundary smell |

### 4.6 Future blockers

1. **Overwrite-only estimate + fact history** blocks trustworthy DNA training data.
2. **Missing media attachments** block Evidence Engine and frozen journey completion.
3. **No assemblies model** blocks Stage 3.3 and package-performance learning.
4. **Constraint taxonomy without consumption map** blocks Interview productivity modifiers.
5. **Dual-write questions/facts** without strict contract blocks evidence provenance.
6. **Estimate line metadata in notes** blocks reporting and structured override learning.
7. **Triple project status** blocks clean cohort definitions (“active jobs”).
8. **Optional quote commercial rules unset** (FEAT-002) blocks alternative/optional assemblies presentation.

### 4.7 Opportunities for simplification

1. Document and enforce **Fact as estimating SoT; Question as interaction layer** (no schema merge required immediately).
2. Collapse product language for archive to **business_status + archived_at**; deprecate legacy `status` usage.
3. Publish a **constraint consumption matrix** (captured vs labour-affecting vs narrative-only).
4. Extract estimate line metadata into typed columns/jsonb column when next authorised schema touch occurs.
5. Unify assumptions/exclusions as structured arrays with presentation adapters (org text defaults expand at snapshot time).
6. Keep Client as string until CRM is authorised — avoid speculative client rewrite.
7. Treat note_proposals accept/reject as the pattern for all AI → domain writes (ISD/Interview).

---

## 5. Stage readiness evaluation

### 5.1 Stage 3.1B — Intelligent Scope Discovery

**Verdict: READY WITH MINOR CHANGES**

**Reasons**

- Work areas, questions, facts, constraints, note proposals already exist as structured objects.
- AI suggestion → human confirmation pattern already implemented.
- Stage 3.1A hardened answer persistence and deliberate-vs-unanswered semantics (DNA-critical).
- Commercial arithmetic is ring-fenced (must not be redesigned).

**Minor changes / gates before build**

1. **3.1A Preview smoke sign-off** (roadmap gate) — still pending at audit time.
2. Dedicated 3.1B audit/plan (algorithms, ranking, acceptance tests) — not yet written.
3. Clarify Fact SoT vs Question interaction contract in the 3.1B plan.
4. Prefer FEAT-001 (collapsible cards) as UX density support, not as a domain rewrite.
5. Do not expand constraint taxonomy ad hoc inside ISD (belongs with 3.2 / FEAT-003 design).

**Not blocking:** Photos/documents; assemblies; DNA store.

---

### 5.2 Stage 3.2 — Builder Interview

**Verdict: READY WITH MINOR CHANGES**

**Reasons**

- Question blocks + questions + constraints + facts provide a viable interview persistence skeleton.
- Brief vs site notes separation supports evidence taxonomy.
- Constraint templates and scope-driven relevance already exist.

**Why not fully READY**

1. FEAT-003 constraint taxonomy design is deferred and required for Interview alignment.
2. Many constraints are captured but not consumed — Interview without consumption map creates dead-end UX.
3. No explicit “interview session” domain object or stage vocabulary yet (may reuse question_blocks — needs design).
4. Option storage sometimes uses display strings rather than stable enums.
5. Fact/answer provenance history insufficient for “interview evidence” claims.

**Minor changes:** taxonomy design review; consumption matrix; enum storage convention; provenance rules — evolutionary, not rewrite.

---

### 5.3 Stage 3.3 — Commercial Assemblies

**Verdict: NOT READY**

**Reasons**

1. No assembly/package data model (Stage 1 confirmed; `rates.rate_type='package'` is a stub signal only).
2. Work-area grouping is scope, not commercial packaging — conflating them would create a permanent ontology error.
3. Optional item commercial presentation (FEAT-002) unresolved; assemblies will touch totals presentation.
4. Requires commercial design + golden scenarios before any arithmetic-facing behaviour (Stage 3 hard constraint).
5. Likely needs migrations (owner approval required).

**What would make it READY WITH MINOR CHANGES**

- Approved assembly domain design (org-scoped definition, expansion into pricing items, snapshot rules).
- Golden coverage for assembly apply/edit/remove.
- Explicit non-conflation with work areas.
- Decision on optional/alternate lines relative to assemblies.

---

### 5.4 Stage 3.4 — Explicit Company Defaults / Manual Learning

**Verdict: READY WITH MINOR CHANGES**

**Reasons**

- `organisation_settings` + `rates` + `organisation_work_areas` already provide inspectable company configuration.
- Commercial engine learning hooks exist with `auto_update_company_rules: false`.
- OCD-50/51 decisions define override-as-evidence philosophy.
- Rates page / company defaults UI already a product surface.

**Minor changes needed**

1. Durable **correction/override evidence** persistence (beyond in-result hooks and sparse audit).
2. Unify settings type surfaces (setup vs company settings) for safer evolution.
3. Explicit accept-loop UX for “suggested default changes” (even if suggestions are manual first).
4. Provenance on rate/margin edits (who/when/previous/new/source).
5. Do **not** allow automatic rate mutation.

**Not blocking:** media attachments; assemblies (helpful later, not required to start manual defaults).

---

### 5.5 Stage 3.5 — Evidence Engine

**Verdict: NOT READY**

**Note:** Stage 3.5 / “Evidence Engine” is **not named** in `STAGE_3_PRODUCT_ROADMAP.md`. Evaluated here as the logical substrate between manual defaults and Company DNA, per architecture §§9–10.

**Reasons**

1. No unified evidence/event store; history is fragmented (quote revisions, pricing audit, soft-deletes, ephemeral learning hooks).
2. Photos/file documents missing — major evidence classes absent.
3. Fact/answer/estimate overwrites discard correction history.
4. Assistant/rate/fact mutations largely outside `pricing_audit_log`.
5. Constraint/fact/exclusion taxonomy not yet an evidence ontology.
6. Client identity too weak for cross-project evidence graphs.

**Path to READY WITH MINOR CHANGES (evolutionary)**

1. Define evidence event schema (append-only): type, org, project, actor, before/after, source, related entity refs.
2. Emit events from answer corrections, constraint changes, pricing overrides, proposal accept/reject, rate edits.
3. Add attachments (photos/docs) as first-class evidence-bearing objects.
4. Preserve estimate snapshots or estimate-regenerated events.
5. Keep commercial engine free of evidence side effects beyond metadata emission.

---

### 5.6 Stage 4 — Company DNA

**Verdict: NOT READY**

**Clarification:** Product Company DNA ≠ Hardening Stage 4.

**Reasons**

1. Evidence Engine substrate incomplete (depends on 3.4–3.5 outcomes).
2. Assemblies absent — DNA cannot learn company packaging behaviour.
3. Estimate/fact history loss undermines “real project history.”
4. Constraint consumption incomplete — productivity DNA signals sparse.
5. Architecture correctly forbids DNA implementation until explicitly authorised; Stage 2B only prepared hooks.
6. Actuals path open in principle but not modelled.
7. Cross-tenant isolation rules are ready; learning product is not.

**Prerequisites (ordered, evolutionary)**

1. Complete 3.1A Preview gate; ship 3.1B without destroying structure.
2. Interview + constraint taxonomy (3.2).
3. Assemblies design (3.3) if packaging is in DNA scope.
4. Manual defaults + correction accept (3.4).
5. Evidence Engine (3.5).
6. Only then: DNA suggestions that **never** redefine arithmetic and **never** auto-write rules.

**What is already READY for DNA later**

- Org tenancy isolation.
- Structured rates/settings/facts/work areas.
- Quote immutability.
- Commercial engine separation + FutureLearningHook philosophy.
- Deliberate answer semantics (3.1A).

---

## 6. Top 25 architectural improvements

Ranked Critical → Low. Prefer evolutionary change. No unnecessary rewrites.

### Critical

| # | Improvement | Why it matters | Effort | Risk | Breaking? | Recommended stage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Enforce Fact SoT + Question interaction contract** (docs + write-path guards; eliminate silent drift) | Dual-write is the highest daily data-integrity risk for scope/DNA | S–M | Low–Med | No (behaviour tighten) | 3.1B plan / early 3.1B |
| 2 | **Design Evidence Event model (append-only) before DNA** | Without durable evidence, DNA has nothing trustworthy to consume | M | Med | No (additive) | 3.4 → 3.5 |
| 3 | **Preserve estimate history on regenerate** (snapshot or event) | Overwrite destroys learnable commercial trajectory | M | Med | Possibly soft (storage growth) | 3.5 (or pre-DNA hardening) |
| 4 | **Constraint taxonomy + consumption matrix (FEAT-003 design)** | Stops dead-end Interview questions; enables productivity DNA | M | Low | No if additive | Pre-3.2 design |
| 5 | **Commercial Assemblies domain design + goldens before code** | Prevents false packaging via work areas; protects money authority | M | Med | Design only first | Pre-3.3 |

### High

| # | Improvement | Why it matters | Effort | Risk | Breaking? | Recommended stage |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | **Project status vocabulary cleanup** (deprecate legacy `status` archive confusion) | Clean active-job cohorts; fewer lifecycle bugs | S–M | Med | Soft (query changes) | 3.1B or workflow hardening |
| 7 | **First-class estimate line metadata** (typed jsonb/columns instead of `__quotr_meta__` in notes) | Enables reporting, overrides learning, safer recalibration | M | Med | Migration; careful dual-read | Before 3.3 / 3.5 |
| 8 | **Override/correction provenance on pricing + rates** (prev/new/actor/time/source) | OCD-50/51 substrate for manual learning | M | Low–Med | No (additive) | 3.4 |
| 9 | **Project attachments (photos + documents)** linked to notes/projects | Completes frozen journey; unlocks Evidence Engine | L | Med | No (additive) | 3.5 (or dedicated media stage) |
| 10 | **Expand pricing_audit_log → domain-critical mutations** (facts, answers, rates, constraints) or emit evidence events | History currently commercial-narrow | M | Low | No | 3.4–3.5 |
| 11 | **Stable enum storage for constraints** (+ presentation labels) | Matches 3.1A answer pattern; improves learning | S–M | Low | Soft (value migration) | 3.2 |
| 12 | **Align DB checks with TS** (`multi_select`, line `mixed` or remove unused) | Prevents runtime/DB divergence | S | Low | Possibly | Opportunistic migration |
| 13 | **Document and gate optional quote commercial rules (FEAT-002)** | Assemblies/optional lines otherwise invent totals | M | Med | Commercial-facing | Pre-3.3 / commercial release |

### Medium

| # | Improvement | Why it matters | Effort | Risk | Breaking? | Recommended stage |
| --- | --- | --- | --- | --- | --- | --- |
| 14 | **Unify Company Defaults type surfaces** over `organisation_settings` | Safer Stage 3.4 evolution | S | Low | No | 3.4 prep |
| 15 | **Rename/clarify product language: Final Pricing vs Documents** | Stops agent/human ontology errors | S | Low | No | Docs + UI copy anytime |
| 16 | **Fact key ontology registry** (versioned catalogue, still code-first OK) | Reduces calculator/template key drift | M | Low | No | 3.1B / 3.2 |
| 17 | **Work-area excluded vs deleted semantics for learning** | Rejection is evidence; deletion is not | S | Low | No | 3.1B |
| 18 | **Proposal accept/reject as canonical AI write pattern for ISD** | Preserves suggestion≠commitment | S–M | Low | No | 3.1B |
| 19 | **Align audit column naming `organisation_id` → `org_id`** | Removes footgun | S | Low | Migration | Next audit migration |
| 20 | **Soft-delete hygiene policy for children** (filter or flag) | Avoid “deleted project, live children” confusion | S–M | Med | Soft | Workflow hardening |
| 21 | **Assumptions/exclusions shape convergence** (arrays everywhere; org text expands at snapshot) | Cleaner quote DNA narrative learning | M | Low–Med | Soft | 3.4 / quote hardening |
| 22 | **Client entity (optional, later)** with project.client_id nullable FK | Cross-job identity without forcing CRM now | M | Med | No if nullable | Post-MVP / when authorised |

### Low

| # | Improvement | Why it matters | Effort | Risk | Breaking? | Recommended stage |
| --- | --- | --- | --- | --- | --- | --- |
| 23 | **Move auth-org helpers out of assistant export path** | Package boundary clarity | S | Low | No | Opportunistic |
| 24 | **Clarify `rates.rate_type='package'`** (implement in 3.3 or document reserved) | Removes false readiness signal | S | Low | No | Pre-3.3 |
| 25 | **Duplicate-project scope policy** (document what copies; optionally include notes) | User expectation + learning continuity | S | Low | Behaviour expand | Workflow polish |

**Effort key:** S = small (days), M = medium (≈1–2 weeks), L = large (multi-week / storage).

---

## 7. Evolutionary principles for subsequent stages

1. **Do not rewrite the commercial progression.** Estimate → Pricing → Quote is correct.
2. **Do not embed DNA in the commercial engine.** Suggestions may propose; accept loops write config; engine computes money.
3. **Prefer additive tables and events** over merging core concepts (e.g. do not merge facts into questions).
4. **Treat 3.1A SoT decisions as binding** until explicitly amended: project client/site before quote; facts for estimating; brief ≠ site notes.
5. **Expand taxonomies only with consumption maps** (constraints, assemblies, evidence types).
6. **Migrations require owner approval** under Stage 3 hard constraints.
7. **Hardening Stage 4 ≠ Company DNA.** Keep programme names distinct in plans and PRs.

---

## 8. Recommended next actions (documentation / governance only)

1. Owner Preview sign-off for Stage 3.1A (`docs/runbooks/STAGE_3_1A_PREVIEW_SMOKE_TEST.md`).
2. Author Stage 3.1B audit/plan citing this domain audit (Fact SoT contract, discovery ranking, FEAT-001).
3. Schedule FEAT-003 constraint taxonomy design before Builder Interview build.
4. Decide whether **Stage 3.5 Evidence Engine** is formally added to `STAGE_3_PRODUCT_ROADMAP.md`.
5. Keep Company DNA unauthorised until Evidence + Defaults substrates exist.

---

## 9. Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/STAGE_3_1C_DOMAIN_MODEL_AUDIT.md` |
| Created | 2026-08-05 |
| Status | Complete — documentation-only architectural audit |
| Application code changed | None |
| Database migrations changed | None |
| Schemas / UI / AI prompts / commercial calculations changed | None |
| Intelligent Scope Discovery started | No |
| Next authorised product step | 3.1A Preview sign-off, then Stage 3.1B audit/plan under explicit authorisation |

---

## Appendix A — Entity readiness snapshot

| Entity | Persistence | Learning readiness | Notes |
| --- | --- | --- | --- |
| Organisation | Table | High | Tenancy root |
| User/Profile | Table + Auth | Medium | Roles unused product-wise |
| Project | Table | High (if status cleaned) | Job root |
| Site Details | Column + snapshots | Low–Medium | Scalar only |
| Client | Column + snapshots | Low | No CRM entity |
| Project Brief | Column | Low as evidence / High as input | Unstructured |
| Site Notes | Table + proposals | High | Strong AI gate pattern |
| Work Area | Table + org + catalogue | High | ISD primary |
| Question | Tables + templates | Medium–High | Dual-write risk |
| Fact | Table | High | Primary scope atom |
| Constraint | Table + templates | Medium | Taxonomy/consumption gap |
| Estimate | Tables (1:1) | Medium | History loss |
| Pricing | Tables | High | Override hooks |
| Quote | Tables + revisions | High | Best history |
| Rates | Table | High | DNA config |
| Company Defaults | Table | High | 3.4 surface |
| Photos | Missing | None | Stub enum only |
| Documents (files) | Missing | None | ≠ pricing_documents |
| Historical Records | Fragmented | Low–Medium | Needs Evidence Engine |

---

## Appendix B — Cross-reference index

| Concern | Primary references |
| --- | --- |
| Canonical domain objects | Architecture Foundation §6–§7 |
| AI / Intelligence / DNA principles | Architecture Foundation §8–§10 |
| Client/site SoT | Stage 3.1A completion §11 |
| Answer/fact semantics | Stage 3.1A audit BUG-001/002; completion §§5–9 |
| Brief vs notes | Stage 3.1A UX-005; completion §12 |
| Commercial authority | Stage 2B completion; commercial engine contract |
| Photos/docs gap | Stage 1 audit §6 |
| Packages absence | Stage 1 audit §§8–9; roadmap 3.3 |
| Constraint dead-ends | Stage 1 audit §7 |
| Work-area coverage | `docs/WORK_AREA_COVERAGE_MATRIX.md` |
| Deferred FEATs | Product backlog FEAT-001–003 |

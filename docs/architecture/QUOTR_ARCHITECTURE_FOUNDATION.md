# Quotr Architecture Foundation

**Classification:** SUPERSEDED as top-level product architecture by `docs/architecture/QUOTR_PRODUCT_ARCHITECTURE.md`. Retained as historical foundation. Stage 2B commercial engine **has shipped** (this file’s “Stage 2B has not started” line is stale).  
**Status:** Historical architectural foundation  
**Audience:** Product owners, engineers, and Cursor agents implementing Quotr stages  
**Constraint:** Describe architecture only — not implementation  
**Relationship to hardening:** Complements `docs/MVP_HARDENING_GUIDE.md`; does not replace stage process, tracker, or engineering principles  

---

## Purpose of this document

This document is the **single governing architecture reference** for Quotr.

Every future implementation stage — including Stage 2B (Authoritative Pricing Engine) and all later hardening and product stages — must preserve the product model, workflow, domain objects, and principles defined here.

This document:

* Describes **what Quotr is** and **how its domain is structured**
* Preserves the **existing MVP** without redesign
* Prepares the product for future **Company DNA**, **Intelligence**, and **Scenario Learning**
* Does **not** prescribe code structure, libraries, schemas, APIs, or UI layouts
* Does **not** authorise implementation work by itself

Stage 2A (Security, Validation and Data Integrity) is **Complete**. Stage 2B implementation has **not** started. Establishing this foundation is the first Stage 2B governance artefact before any pricing-engine audit or refactoring.

---

## 1. Product Vision

Quotr becomes the estimating system that thinks like the builder’s own company.

Builders and contractors should capture a job once, apply their own commercial rules, and produce estimates and customer-facing quotes that reflect how *their* business actually prices work — not a generic national average detached from company practice.

Over time, Quotr should accumulate company-specific commercial intelligence (Company DNA), use that intelligence to improve suggestions and estimating quality, and support learning from real project outcomes (Scenario Learning) — without ever replacing deterministic commercial arithmetic or human commercial judgement.

---

## 2. Product Mission

Help builders and contractors:

1. Capture project information quickly and structurally.
2. Identify and confirm the work areas that define the job.
3. Answer the questions that matter for scope and quantity.
4. Generate structured estimates using company rates, constraints, margins and assumptions.
5. Refine commercial pricing with full control over labour, materials, subcontractors, allowances and margins.
6. Progress reviewed pricing into clear customer-facing quotes.
7. Preserve organisation isolation, data integrity and pricing correctness throughout.

Quotr assists judgement; it does not replace the builder’s responsibility for the commercial offer.

---

## 3. Product Scope

### 3.1 In-scope product surface (MVP)

The architecture preserves the existing MVP surface:

| Domain | Capabilities |
| --- | --- |
| Identity and tenancy | Sign-in; organisation create/join; organisation-level data isolation; one user → one company; one company → many users |
| Company configuration | Company profile; essential rates and commercial defaults |
| Project capture | Project create/edit/delete; client and site information; notes (and future photos/documents along the frozen journey); multiple work areas; AI work-area suggestions; work-area questions; constraint capture |
| Estimating | Quick estimate generation; labour, materials, subcontractors and allowances; margin, markup, overhead and tax where currently supported; ranges and confidence where currently supported |
| Pricing and quoting | Final pricing refinement; line-item and package edit; assumptions, inclusions and exclusions; progression to detailed quote; preview/export of existing quote output |
| Product quality | Recoverable errors; loading states; basic observability; desktop-first with usable mobile site-capture |

### 3.2 Commercial model (binding product rules)

These commercial rules are architectural product facts, not optional preferences:

* **Gross margin** is the primary commercial setting: Gross Profit ÷ Selling Price.
* Default company gross margin: **20%**.
* Gross margin bounds: **0%–95%**.
* **Markup** is a separate concept; bounds **0%–1000%**; never auto-converted to or from margin.
* Negative commercial quantities, rates, totals, margins and markups are not supported in MVP (no credits).
* Zero-value line items are allowed only when intentionally informational or included at no charge.
* **Lump-sum** pricing is an intended calculation mode and must remain available.
* Same-company users share authorised company records; cross-company access must fail closed.

### 3.3 Organisation model (MVP)

* One signed-in user belongs to one company.
* One company may contain multiple users.
* Organisation membership is derived from the authenticated user’s profile — never from a client-supplied organisation switcher.
* No multi-company user experience is required for MVP.

---

## 4. Core Product Philosophy

1. **Preserve what works.** Harden and extend the existing MVP; do not rebuild or redesign the product direction.
2. **Company-specific before generic.** Estimates should prefer company rates, rules and margins over anonymous benchmarks when company configuration exists.
3. **Structure over free text alone.** Critical commercial inputs (rates, margins, quantities, line items, ownership) must live as durable domain data, not only as unvalidated prose or opaque blobs.
4. **Human confirmation of AI suggestions.** AI may propose work areas, questions or estimate structure; the user confirms scope and commercial decisions.
5. **Deterministic money.** All monetary totals are produced by deterministic pricing rules. AI never owns arithmetic.
6. **One commercial truth.** Margin, gross profit, markup, tax and estimate totals must have a single authoritative meaning across estimate, pricing and quote views.
7. **Organisation isolation is absolute.** Every organisation-owned record is scoped to one company; cross-tenant access is always a high-severity defect.
8. **Fail closed and recoverably.** Security failures and AI failures must not leak foreign data, corrupt partial writes, or leave the user with a blank irreversible state.
9. **Estimates guide; quotes commit.** Quick estimates support internal judgement; customer-facing quotes come from reviewed final pricing.
10. **Prepare for learning without pretending learning exists yet.** Domain objects and commercial events must remain learnable later (Company DNA, Intelligence, Scenario Learning) without requiring those capabilities in MVP.

---

## 5. Canonical Customer Workflow

The following journey is the architectural workflow for Quotr. Stages may harden reliability and correctness along this path; they must not redesign or expand it without explicit product authorisation.

1. User signs in.
2. User creates or joins an organisation.
3. User configures essential company settings and rates.
4. User creates a project.
5. User enters client, site and project information.
6. User records relevant notes, photos or documents (notes exist today; photo/document capture remains part of the frozen journey and may be completed in later workflow stages).
7. Quotr suggests work areas.
8. User can add, edit, delete and confirm work areas.
9. Quotr asks relevant questions for each work area.
10. User records project constraints.
11. Quotr generates a quick estimate.
12. User reviews labour, materials, subcontractors, allowances, margins, assumptions and exclusions.
13. User edits the estimate / progresses into final pricing and edits commercial line items.
14. All totals update correctly under the authoritative commercial rules.
15. User saves, exits and reopens without losing data.
16. User progresses reviewed pricing into a detailed customer-facing quote.
17. User previews or exports the quote.

Supporting lifecycle behaviours already part of the product model include project archive/duplicate patterns, pricing recalibration when estimate and final pricing diverge, and quote revision history (new revisions preserve superseded quotes).

---

## 6. Canonical Domain Objects

These objects define the Quotr domain. Names describe product concepts, not required table or class names.

| Domain object | Meaning |
| --- | --- |
| **User** | An authenticated person. |
| **Organisation (Company)** | The tenant that owns all commercial and project data. |
| **Profile / Membership** | The binding of a user to exactly one organisation in MVP. |
| **Company profile** | Company identity and presentation details used in quotes and settings. |
| **Company rates / commercial configuration** | Organisation-scoped labour, material, scope and related rates plus default gross margin and related commercial defaults. |
| **Project** | A job being estimated and quoted for a client/site. |
| **Client / site information** | Who and where the project is for. |
| **Project note** | Captured site or job information (text today; richer media later along the frozen journey). |
| **Work area** | A scoped portion of the job (suggested, confirmed, edited or excluded by the user). |
| **Project fact** | Structured fact derived from brief, questions or user input and consumed by estimating. **Sole estimating / readiness authority** (Stage 3.1D). |
| **Question / question block** | Work-area-specific questions that refine scope and quantities. **Capture journal only** — not estimating authority (Stage 3.1D). |
| **Constraint** | Project limitation or condition recorded by the user. **Exclusive namespace** for reserved project-level keys (Stage 3.1D). |
| **Estimate** | Internal quick estimate for a project, including commercial summary fields. |
| **Estimate line item** | Labour, material, subcontractor, allowance or related line within an estimate. |
| **Pricing document (Final Pricing)** | Company-controlled commercial refinement derived from an estimate. |
| **Pricing item** | Editable commercial line within final pricing, including calculation modes such as quantity×rate, productivity labour and lump sum. |
| **Quote** | Customer-facing commercial offer derived from reviewed pricing; revisions are historical versions, not silent overwrites. |
| **Quote item** | Line on a customer-facing quote. |
| **Assumptions / inclusions / exclusions / terms** | Commercial narrative attached to pricing and quotes. |
| **Audit / commercial event record** | Organisation-scoped record of significant pricing or quote mutations (for integrity today; learning later). |

Ownership, freeze points, and the Question → Fact → Estimate pipeline are refined in `docs/architecture/STAGE_3_1D_DOMAIN_MODEL_REFINED.md`.

Supporting concepts that belong to the domain language without being standalone product surfaces in MVP:

* **Calculation mode** — how a line’s money is determined (including lump sum).
* **Gross margin / markup / tax (GST)** — commercial arithmetic concepts with fixed product meaning.
* **Benchmark rates** — fallback when company rates are absent; never preferred over configured company rates.
* **Confidence / estimate range** — optional quality signals where the product already supports them.

---

## 7. Domain Relationships

```
Organisation
  ├── owns Users (via Profile; many users per org; one org per user in MVP)
  ├── owns Company profile and Company rates / commercial configuration
  └── owns Projects
        ├── has Client / site information
        ├── has Project notes
        ├── has Work areas
        │     └── inform Questions / question blocks and Project facts
        ├── has Constraints
        ├── has Project facts
        ├── has Estimates
        │     └── contain Estimate line items
        ├── has Pricing documents (Final Pricing)
        │     └── contain Pricing items
        │     └── carry Assumptions / inclusions / exclusions
        └── has Quotes (versioned)
              └── contain Quote items and customer-facing terms

Commercial configuration (rates, default gross margin)
  └── informs Estimate generation and Pricing refinement
        └── informs Quote creation (snapshot of reviewed commercial intent)
```

### Relationship rules

1. **Organisation is the tenancy root.** Every customer-owned business record belongs to exactly one organisation.
2. **Project is the job root.** Work areas, notes, facts, questions, constraints, estimates, pricing documents and quotes hang from a project (directly or through project-owned parents).
3. **Parent and child organisation identity must agree.** A child record cannot belong to a different organisation than its project (or other owning parent).
4. **Estimate → Pricing → Quote is a progression of commercial commitment**, not three unrelated money systems.
5. **Quotes are snapshots/revisions of reviewed commercial intent**, not live mirrors that silently rewrite history when company rates change later.
6. **Company rate changes do not retroactively rewrite existing pricing documents or quotes.**
7. **Same-organisation sharing is expected**; cross-organisation visibility is forbidden.
8. **Soft-deleted or inactive projects** must not remain part of the normal active workflow, while historical child data remains preservable under product deletion policy.

---

## 8. AI Principles

1. **AI is assistive, not authoritative.** AI may suggest work areas, extract candidate facts, propose questions or help structure estimates. It does not decide final commercial totals.
2. **Deterministic code owns money.** Quantity×rate, productivity labour, lump-sum acceptance, margin, markup, tax and roll-up totals are computed by deterministic product rules.
3. **Validate before persist.** AI output must be schema-validated and range-checked before it becomes durable domain data.
4. **User confirms scope.** Suggested work areas and material estimate structure remain subject to user add/edit/delete/confirm behaviour.
5. **Failures are recoverable.** AI outages or invalid model output must preserve user progress, show a controlled fallback, and avoid partial corrupt writes.
6. **No silent arithmetic from the model.** Numeric suggestions that affect estimating must pass through product validation and deterministic calculation paths before affecting money.
7. **Least disclosure.** AI error handling and logging must not become a channel for leaking sensitive customer content beyond what product policy allows.
8. **AI never bypasses tenancy.** Every AI-assisted write remains organisation-owned and authorship-aware under the same ownership rules as manual writes.

---

## 9. Intelligence-Ready Principles

“Intelligence” means Quotr can use structured company and project context to make better suggestions and estimating assistance over time — without becoming an opaque black box for money.

1. **Prefer structured domain objects over prompt-only memory.** Facts, rates, work areas, constraints and commercial settings should remain first-class so future intelligence has durable inputs.
2. **Separate suggestion from commitment.** Intelligence may propose; persistence of commercial commitment remains an explicit user or deterministic system step.
3. **Keep commercial configuration inspectable.** Company rates, default margin and related rules must remain visible and editable by the company — not hidden only inside model weights or free-text prompts.
4. **Preserve provenance of important inputs.** It should remain possible to distinguish user-entered facts, company defaults, benchmark fallbacks and AI-suggested values.
5. **Intelligence consumes authoritative totals; it does not redefine them.** Future ranking, confidence or recommendation features must read from the same commercial truth as the pricing engine.
6. **Organisation boundaries apply to intelligence context.** One company’s intelligence context must never train, retrieve or display another company’s private commercial data.
7. **MVP can be intelligence-ready without shipping intelligence features.** Hardening stages should avoid designs that permanently discard structure required for later intelligence.

---

## 10. Future Learning Compatibility Principles

“Scenario Learning” and “Company DNA” are future capabilities. Full scenario calibration, actual-versus-estimate machine learning, and custom foundation-model training are **out of MVP scope**. The architecture must remain compatible with them.

1. **Company DNA** is the accumulated, organisation-scoped commercial identity of a company: how it rates work, margins jobs, packages scope, and expresses assumptions — grounded in structured configuration and real project history, not only in static defaults.
2. **Scenario Learning** means learning from comparable project scenarios and outcomes to improve future estimating assistance for that company (and only with explicit future authorisation, broader benchmarks).
3. **Do not destroy learnable history.** Soft-delete, quote revision and audit/commercial event records exist to preserve history; hardening must not silently purge organisation learning substrate without authorisation.
4. **Record commercial decisions as data.** Margins applied, rates used, lump-sum choices, inclusions/exclusions and revision points should remain representable as domain facts.
5. **Keep actuals path open without building it now.** Future actual-versus-estimate learning will need stable project/estimate/quote identifiers and organisation scope; MVP need not capture actuals yet, but must not invent disposable identity schemes that prevent later linkage.
6. **No premature ML coupling.** Do not entangle the authoritative pricing engine with model training loops, online learning side effects, or unverified automatic rate mutation.
7. **DNA is company-scoped.** Any future DNA artefact belongs to the organisation tenancy root and inherits the same isolation rules as rates and projects.
8. **Learning never overrides safety invariants.** Future learning features remain subject to validation bounds, deterministic money, human confirmation and fail-closed tenancy.

---

## 11. Immediate Development Roadmap

This roadmap sequences architectural priorities. It does not authorise skipping hardening process gates.

| Order | Focus | Architectural intent |
| ---: | --- | --- |
| 1 | **This foundation** | Establish the governing architecture document (complete when this file is adopted). |
| 2 | **Stage 2B — Authoritative Pricing Engine** | Establish one authoritative commercial arithmetic meaning for margin, gross profit, markup, tax and totals across estimate, pricing and quote paths. Begin with controlled audit and calculation specification before refactoring. |
| 3 | **Stage 3 — Core project workflow** | Harden project capture, notes/media along the frozen journey, work-area CRUD/confirmation, questions and constraints. |
| 4 | **Stage 4 — Residual estimating-path hardening** | Address estimating-path issues remaining after 2B (pricing consolidation is owned by 2B). |
| 5 | **Stage 5 — AI reliability and fallback handling** | Strengthen validation, non-authoritative AI money rules and recoverable failure states. |
| 6 | **Stage 6 — Estimate editing, packages and quote progression** | Harden edit/add/remove flows, recalculation, quote progression, assumptions/inclusions/exclusions, preview/export. |
| 7 | **Stage 7 — Company setup and commercial configuration** | Harden structural company rates/rules as durable inputs to the estimating engine (Company DNA substrate). |
| 8 | **Stage 8 — Tests, analytics and observability** | Critical-path coverage and diagnosability without sensitive leakage. |
| 9 | **Stage 9 — Performance** | Verified latency/responsiveness on critical paths only. |
| 10 | **Stage 10 — UI, responsive behaviour and usability** | Error/loading/responsive hardening without unrelated redesign. |
| 11 | **Stage 11 — Release validation** | End-to-end frozen-journey readiness. |
| Later (explicit authorisation) | **Company DNA, Intelligence, Scenario Learning** | Introduce only when product-authorised; build on the structured domain and commercial history preserved above. |

**Current programme position:** Stage 2A Complete (local and remote). Stage 2B Not Started beyond creation of this architecture foundation.

---

## 12. Out of Scope

The following remain out of scope for MVP hardening and must not be pulled into the critical path without explicit product authorisation:

* Accounting integrations
* Live supplier-price integrations
* Full Quotr DNA scenario calibration
* Actual-versus-estimate machine learning
* Benchmarking networks
* Contractor marketplaces
* Full CRM
* Scheduling
* Invoicing
* General project management
* Custom foundation-model training
* Unrelated product or UI redesigns
* New frameworks adopted for their own sake
* New database abstractions without demonstrated need
* Microservices decomposition
* Large dependency replacements
* Credits / negative commercial line economics
* Multi-company switching UX
* Invitation/role administration product (beyond current org-scoped sharing model), unless separately authorised
* Treating AI output as the source of truth for monetary totals

Excluded items may become future programme tracks. Until authorised, architecture work must preserve compatibility where cheap and refuse scope expansion where costly.

---

## 13. Architecture Governance Rules

1. **This document governs product architecture.** Implementation plans, audits and stage reports must remain consistent with it. If code and this document diverge, either the code is defective relative to architecture or an explicit architecture amendment is required — silent drift is not allowed.
2. **`docs/MVP_HARDENING_GUIDE.md` governs the hardening process.** Stage process, engineering principles, tracker and definition of done remain mandatory. This foundation does not waive approval gates.
3. **Architecture before implementation for Stage 2B.** No pricing-engine consolidation, formula refactoring or duplicated-calculation removal begins until the active stage has completed its required audit/specification steps under the hardening guide.
4. **Describe architecture; do not smuggle implementation.** Changes to this document must not prescribe file paths, library choices, migration IDs or UI components as if they were product requirements.
5. **Do not redesign the MVP through architecture amendments.** Amendments refine clarity or explicitly authorised scope; they do not invent a new product.
6. **Preserve the frozen customer workflow** unless product ownership explicitly amends Section 5.
7. **Preserve canonical domain objects and relationships.** Renaming in code for clarity is allowed when authorised by a stage; deleting or merging core domain concepts requires architecture amendment.
8. **One authoritative commercial arithmetic meaning.** Discovering multiple conflicting money meanings is an architectural defect to resolve under Stage 2B (and residual Stage 4), not a permanent multi-truth design.
9. **AI remains non-authoritative for money** in all future stages unless this document is expressly amended by product ownership (not expected for MVP).
10. **Tenancy and validation invariants are non-negotiable:** organisation scope, fail-closed cross-tenant behaviour, runtime validation of money-bearing inputs, and safe non-destructive data handling.
11. **Future DNA / Intelligence / Scenario Learning must extend this model**, not fork a parallel product ontology.
12. **Stage reports must cite this document** when making architectural claims about workflow, domain objects, AI authority or roadmap position.
13. **Amendments require explicit owner authorisation** and a recorded date/rationale in Document control.
14. **No application, migration, Supabase, UI or prompt change is authorised solely by the existence of this file.** Implementation requires the active stage’s normal audit → plan → approval → implement sequence.

---

## Related governing documents

| Document | Role |
| --- | --- |
| `docs/MVP_HARDENING_GUIDE.md` | Hardening programme governance, principles, stages, tracker, definition of done |
| `docs/architecture/STAGE_3_1D_DOMAIN_MODEL_REFINED.md` | Stage 3.1D refined ownership, lifecycles, freeze points (Fact SoT) |
| `docs/architecture/STAGE_3_1C_DOMAIN_MODEL_AUDIT.md` | Stage 3.1C domain model audit |
| `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md` | Completed Stage 2A security/validation plan |
| `docs/implementation/STAGE_2A_COMPLETION_REPORT.md` | Stage 2A completion evidence |
| `docs/audits/STAGE_1_CURRENT_STATE_AUDIT.md` | Current-state audit baseline |
| `docs/KNOWN_LIMITATIONS.md` | Accepted MVP limitations |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md` |
| Created | 2026-08-04 |
| Status | Authoritative architectural foundation |
| Stage context | Stage 2B beginning — architecture foundation only; Stage 2B implementation Not Started |
| Application code changed | None |
| Database migrations changed | None |
| Supabase / UI / prompts changed | None |
| Next authorised step | Stage 2B controlled audit and calculation specification (separate stage work), still governed by this document and `docs/MVP_HARDENING_GUIDE.md` |

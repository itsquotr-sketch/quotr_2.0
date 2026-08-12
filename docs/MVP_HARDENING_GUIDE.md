# Quotr MVP Hardening and Engineering Guidance

**Status:** Active governance document  
**Audience:** Cursor agents, engineers, and reviewers working on Quotr MVP hardening  
**Scope:** Controlled, stage-by-stage hardening of the existing Quotr MVP  
**Constraint:** The application is functional and must not be rebuilt from scratch  

---

## 1. Purpose

This document governs a permanent, stage-by-stage hardening programme for the Quotr MVP. It defines product boundaries, engineering principles, the controlled stage process, stage tracker requirements, and the definition of done.

Hardening means strengthening reliability, data integrity, security, pricing correctness, AI resilience, observability, performance, and usability—without changing product direction or introducing out-of-scope features.

**Every hardening stage must begin by reading this document.**

---

## 2. Product definition

Quotr helps builders and contractors capture project information, identify work areas, answer targeted questions, and produce structured construction estimates using company-specific rates, constraints, margins and assumptions.

### 2.1 Frozen MVP user journey

The following journey is frozen for MVP hardening. Stages may improve reliability and correctness along this path; they must not redesign or expand it without explicit authorisation.

1. User signs in.
2. User creates or joins an organisation.
3. User configures essential company settings and rates.
4. User creates a project.
5. User enters client, site and project information.
6. User uploads relevant notes, photos or documents.
7. Quotr suggests work areas.
8. User can add, edit, delete and confirm work areas.
9. Quotr asks relevant questions for each work area.
10. User records project constraints.
11. Quotr generates a quick estimate.
12. User reviews labour, materials, subcontractors, allowances, margins, assumptions and exclusions.
13. User edits the estimate.
14. All totals update correctly.
15. User saves, exits and reopens the estimate without losing data.
16. User progresses the estimate into a detailed customer-facing quote.
17. User previews or exports the quote.

---

## 3. MVP scope

The following capabilities are in scope for hardening. Harden what exists; do not invent new product surfaces unless a stage prompt expressly authorises them.

### 3.1 Identity and tenancy

* Authentication and organisation setup
* Organisation-level data isolation

### 3.2 Company configuration

* Company profile and essential rates

### 3.3 Project capture

* Project creation, editing and deletion
* Client and site information
* Project notes, photos and documents
* Multiple work areas
* AI work-area suggestions
* Work-area-specific questions
* Constraint capture

### 3.4 Estimating and quoting

* Quick estimate generation
* Labour, materials, subcontractors and allowances
* Margin, markup, overhead and tax calculations where currently supported
* Estimate ranges and confidence indicators where currently supported
* Editing quantities, units, rates and line items
* Adding and removing packages and individual items
* Immediate and correct total recalculation
* Detailed quote progression
* Assumptions, inclusions and exclusions
* Save and reopen reliability
* Quote preview and existing export functionality

### 3.5 Product quality baselines

* Error handling
* Loading states
* Basic logs and analytics
* Responsive desktop interface and usable mobile site-capture experience

---

## 4. Non-MVP scope

Do **not** introduce the following during MVP hardening unless explicitly authorised in a later stage:

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
* Custom foundation model training
* Unrelated redesigns
* New frameworks
* New database abstractions without demonstrated need
* Microservices
* Large dependency replacements

If a proposed change would pull any of the above into the critical path, stop and request authorisation before continuing.

---

## 5. Engineering principles

These principles are mandatory for all hardening work.

1. **Preserve existing working functionality.** Prefer fix-in-place over rewrite.
2. **Audit before changing.** Understand the current implementation before proposing edits.
3. **Make the smallest safe change** that resolves the verified issue.
4. **Do not duplicate business logic.** Consolidate only when duplication is verified and consolidation is the smallest safe fix.
5. **Pricing calculations must have one authoritative implementation.** UI display, AI suggestions and persistence must not invent independent arithmetic.
6. **Database schema changes must use versioned, idempotent migrations.**
7. **Never manually assume the live database matches local migrations.** Verify before relying on schema.
8. **All organisation-owned records must be organisation-scoped.**
9. **Row-level security must be enabled and tested** for all customer data.
10. **AI output must be validated before persistence.**
11. **AI must not be the authoritative source for arithmetic.** Deterministic pricing code owns totals.
12. **AI failures must produce recoverable user states.** No blank screens, lost drafts, or silent corruption.
13. **Important company rates and rules must be stored structurally.**
14. **Avoid storing critical pricing data only inside unvalidated JSON.**
15. **No silent destructive migration.**
16. **No deletion of existing user data** without explicit authorisation.
17. **Every material change must include testing instructions.**
18. **No broad refactoring during a bug-fix stage.**
19. **Existing naming conventions should be retained** unless they create a verified defect.
20. **All changes must be reviewable in small commits.**

---

## 6. Controlled stage process

For each stage, Cursor (or any implementing agent/engineer) must:

1. **Read** this guidance document.
2. **Inspect** relevant existing code, schema, tests and docs.
3. **Describe** the current implementation accurately.
4. **Identify verified issues** with file and function references.
5. **Distinguish verified defects from suspected risks.**
6. **Propose the smallest implementation plan** that resolves verified issues in scope.
7. **Wait for approval** unless the stage prompt expressly authorises implementation.
8. **Implement only the approved scope.**
9. **Run** available type checks, linting and tests.
10. **Report files changed.**
11. **Report migrations created.**
12. **Report remaining risks.**
13. **Update the stage tracker** in this document.

### 6.1 Reporting expectations

Stage reports should clearly separate:

| Category | Meaning |
| --- | --- |
| Verified defect | Reproduced or code-proven failure against MVP requirements |
| Suspected risk | Plausible weakness without conclusive evidence yet |
| Out of scope | Valid concern deferred by this guide or stage authorisation |
| Accepted limitation | Known gap retained deliberately for MVP |

### 6.2 Approval gate

Unless a stage prompt explicitly says implementation may proceed without further approval:

* Audit findings and the proposed plan come first.
* Implementation starts only after human approval of scope.
* Scope creep discovered mid-implementation requires a new approval checkpoint.

---

## 7. Stage definitions

### Stage 0 — Governance

Establish and maintain this document as the governing source for MVP hardening. Confirm process, tracker, principles and scope boundaries are understood before technical stages begin.

### Stage 1 — Current-state audit

Map the existing application against the frozen journey and MVP scope. Inventory auth/org model, data ownership, estimate/pricing paths, AI call sites, persistence, export/preview, tests, logging/analytics and known limitations. Produce a baseline of verified issues and suspected risks. **No product code changes in Stage 1 unless expressly authorised.**

### Stage 2 — Data integrity, authentication and organisation isolation

*(Historical stage name retained in the tracker. Scope has been split into Stage 2A and Stage 2B below.)*

Harden sign-in, organisation create/join, membership, organisation scoping on owned records, and RLS coverage/testing for customer data. Ensure save/reopen paths cannot leak or orphan organisation data.

### Stage 2A — Security, Validation and Data Integrity

Harden authentication reliability, organisation ownership verification, multi-tenant isolation, row-level security, server-action authorisation, runtime input validation (including money-bearing actions), safe database writes, migration verification, data-integrity constraints, and safe deletion behaviour. Do **not** consolidate pricing-engine arithmetic in this stage.

### Stage 2B — Authoritative Pricing Engine

Establish a single authoritative pricing implementation. Consolidate duplicated margin, gross-profit, markup, tax and estimate-total arithmetic. Verify labour, materials, subcontractors, allowances, and currently supported margin/markup/overhead/tax behaviour. Ensure totals, ranges and confidence indicators (where supported) are correct and deterministic.

### Stage 3 — Core project workflow

Harden project create/edit/delete, client and site information, notes/photos/documents, work-area CRUD and confirmation, work-area questions and constraint capture along the frozen journey.

### Stage 4 — Estimating engine and pricing correctness

*(Historical stage name retained. Pricing-engine consolidation work is now owned by Stage 2B; Stage 4 remains available for residual estimating-path hardening discovered after 2B.)*

Establish or reinforce a single authoritative pricing implementation. Verify labour, materials, subcontractors, allowances, and currently supported margin/markup/overhead/tax behaviour. Ensure totals, ranges and confidence indicators (where supported) are correct and deterministic.

### Stage 5 — AI reliability and fallback handling

Validate AI outputs before persistence; ensure AI is never the arithmetic authority; provide recoverable fallbacks when suggestions, questions or estimate assists fail.

### Stage 6 — Estimate editing, packages and quote progression

Harden line-item and package edit/add/remove flows, immediate total recalculation, progression to detailed customer-facing quotes, assumptions/inclusions/exclusions, and preview/export of existing functionality.

### Stage 7 — Company setup and commercial configuration

Harden company profile and essential rates/rules so commercial inputs are structural, organisation-scoped and safely consumed by the estimating engine.

### Stage 8 — Automated tests, analytics and observability

Add or repair automated coverage for critical paths; ensure basic logs/analytics support diagnosis without leaking sensitive data; document manual acceptance checks.

### Stage 9 — Performance and speed

Address verified latency and responsiveness issues on critical paths (project capture, estimate generation/edit, reopen, quote preview) without speculative rewrites.

### Stage 10 — UI, responsive behaviour and usability

Harden error handling, loading states, desktop responsiveness and usable mobile site-capture experience. No unrelated redesigns.

### Stage 11 — Release validation

End-to-end validation of the frozen journey against definition of done, regression checks, migration safety review, and release readiness sign-off.

---

## 8. Stage tracker

Update this table as stages progress. Status values must be one of: **Not Started**, **Auditing**, **Approved**, **In Progress**, **Blocked**, **Complete**.

| Stage | Stage name | Status | Audit date | Implementation date | Summary | Outstanding issues | Evidence of completion |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 0 | Governance | Complete | 2026-07-24 | 2026-07-24 | Guidance document created and adopted as governing source for MVP hardening. | None for Stage 0. Project-specific inventory fields below remain TBD pending Stage 1. | This file exists at `docs/MVP_HARDENING_GUIDE.md` and defines scope, principles, process, tracker and DoD. |
| 1 | Current-state audit | Auditing | 2026-08-03 | — | — | — | — |
| 2 | Data integrity, authentication and organisation isolation | Not Started | — | — | Historical tracker entry retained. Scope split into Stage 2A and Stage 2B. | Superseded by 2A/2B split — do not implement under this row. | — |
| 2A | Security, Validation and Data Integrity | Complete | 2026-08-03 | 2026-08-03–2026-08-04 | Stage 2A complete locally and remotely: auth-org, validation, pricing/quote security, DB integrity (025), least-privilege API grants (026), baseline reconciliation (027), two-org isolation proof, production smoke test. | Accepted limitations: soft-delete app-path visibility; S1-016 no account deletion; S1-013 roles/invites deferred; pricing formula duplication → 2B. | `docs/implementation/STAGE_2A_COMPLETION_REPORT.md`; `docs/implementation/STAGE_2A_REMOTE_DEPLOYMENT_REPORT.md`; migrations 001–027 aligned local/remote |
| 2B | Authoritative Pricing Engine | Complete | 2026-08-04 | 2026-08-04–2026-08-05 | One commercial engine under `lib/commercial-engine/`; estimate/pricing/quote adapters + presentation-only UI. Complete — Local; deploy/smoke owner-gated. | Accepted limitations: no `cost_known` column; engine metadata not fully persisted; S1-010 UX → Stage 6; authority switches retained for rollback. Deployment not yet done. | `docs/implementation/STAGE_2B_COMPLETION_REPORT.md`; `docs/runbooks/STAGE_2B_DEPLOYMENT_AND_SMOKE_TEST.md`; verify `scripts/verify-batch-2b10-final-commercial-authority.ts` |
| 3 | Core project workflow | Complete | 2026-08-05 | 2026-08-05–2026-08-12 | **3.1A/D Complete**. **3.1C Complete — Preview Validated**. **3.1B Complete — Preview Validated**. Scope Discovery Production off. **3.2.0 / 3.2.0-R1 / 3.2.1 Complete**; **3.2.2 In Owner Preview / R1**; **3.2.3 Not Started**. | PERF-FUTURE-01 Planned; next Deck R1 Owner retest then 3.2.3 when authorised. | `docs/implementation/STAGE_3_2_2_R1_PROJECT_CONDITIONS_REMEDIATION.md`; `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md` |
| 7 | Company setup and commercial configuration | Complete | 2026-08-09 | 2026-08-10 | 3.1C.3 R2A–R2E-R1 Preview Validated; progressive readiness; calibration evidence only | Deferred: DNA, auto calibration apply, email change | `docs/implementation/STAGE_3_1C_CLOSURE.md` |
| 4 | Estimating engine and pricing correctness | Not Started | — | — | Historical tracker entry retained. Pricing consolidation owned by Stage 2B. | — | — |
| 5 | AI reliability and fallback handling | Not Started | — | — | — | — | — |
| 6 | Estimate editing, packages and quote progression | Not Started | — | — | — | — | — |
| 8 | Automated tests, analytics and observability | Not Started | — | — | — | — | — |
| 9 | Performance and speed | Not Started | — | — | — | — | — |
| 10 | UI, responsive behaviour and usability | Not Started | — | — | — | — | — |
| 11 | Release validation | Not Started | — | — | — | — | — |

### 8.1 Tracker update rules

When updating a stage row:

* Set **Status** to the current lifecycle state.
* Record **Audit date** when auditing begins or completes (use ISO date `YYYY-MM-DD`).
* Record **Implementation date** when approved implementation lands (or note `N/A` if audit-only).
* Keep **Summary** to one or two factual sentences.
* List **Outstanding issues** as concrete, actionable items (or `None`).
* Put **Evidence of completion** as links/paths to PRs, commits, test output notes, migration names and manual test records—not vague claims.

---

## 9. Definition of done

A stage is **Complete** only when all of the following are true:

* The agreed scope has been implemented.
* Type checking passes.
* Linting passes, or existing unrelated failures are documented.
* Relevant automated tests pass.
* Manual acceptance tests are documented.
* No new unresolved high-severity issue is introduced.
* Database migrations are safe and documented (when applicable).
* Files changed are listed.
* Known limitations are recorded.
* The stage tracker in this document is updated.

If any criterion cannot be met, the stage status must remain **In Progress** or **Blocked**, with the gap recorded under Outstanding issues.

---

## 10. Change control and safety rules

### 10.1 Code and schema

* Do not modify application code, migrations, configuration or dependencies unless the active stage authorises that work and approval gates are satisfied.
* Prefer additive, reversible migrations.
* Never run silent destructive data changes.
* Never delete existing user data without explicit authorisation.

### 10.2 Pricing authority

* Identify and protect a single authoritative pricing/calculation path.
* If multiple calculation paths are discovered, treat that as a verified defect (or high-priority suspected risk until confirmed) under Stage 4.
* AI may suggest structure or candidate line items; deterministic code must compute money totals.

### 10.3 Multi-tenancy

* Every organisation-owned read/write path must enforce organisation scope in application logic and RLS.
* Cross-organisation access is always a high-severity defect.

### 10.4 AI safety

* Validate schema, types, ranges and required fields before persisting AI output.
* On AI failure: preserve user progress, show a recoverable error/fallback, and avoid partial corrupt writes.

### 10.5 Commits and reviewability

* Keep commits small and scoped to the approved stage work.
* Do not bundle unrelated refactors with bug fixes.
* Include testing instructions with material changes.

---

## 11. Required artefacts per stage (checklist)

Use this checklist when closing a stage:

- [ ] This guidance document was re-read at stage start
- [ ] Current implementation described
- [ ] Verified issues listed with file/function references
- [ ] Suspected risks listed separately
- [ ] Smallest implementation plan proposed
- [ ] Approval obtained (unless stage prompt waived it)
- [ ] Only approved scope implemented
- [ ] Typecheck / lint / tests run and results recorded
- [ ] Files changed listed
- [ ] Migrations created listed (or `None`)
- [ ] Remaining risks recorded
- [ ] Manual acceptance tests documented
- [ ] Known limitations updated (as needed)
- [ ] Stage tracker row updated

---

## 12. Related project documents

Existing project docs that stages should consult (non-exhaustive; refine during Stage 1):

* `docs/KNOWN_LIMITATIONS.md`
* `docs/PRODUCTION_READINESS.md`
* `docs/PERFORMANCE.md`
* `docs/PERFORMANCE_RESPONSIVE_QA.md`
* `docs/INTERNAL_SCOPE_RATE_KEYS.md`
* `docs/PRICING_CALIBRATION_STRUCTURE.md`
* `docs/WORK_AREA_COVERAGE_MATRIX.md`
* `docs/DEMO_WORKFLOW.md`
* `docs/PRINT_QA_CHECKLIST.md`
* `README.md`
* `AGENTS.md` / `CLAUDE.md` (Next.js version-specific agent rules)

Stage 1 should confirm which of these remain authoritative versus superseded.

---

## 13. Project inventory placeholders (fill during Stage 1)

The following fields are intentionally incomplete until the current-state audit. Do not invent values.

| Item | Value (TBD in Stage 1) |
| --- | --- |
| Authoritative pricing module(s) | TBD |
| Organisation / membership tables and RLS coverage | TBD |
| Primary estimate and quote persistence model | TBD |
| AI entry points (work areas, questions, estimate assists) | TBD |
| Export / preview implementation path | TBD |
| Existing test runner commands | TBD |
| Typecheck and lint commands | TBD |
| Analytics / logging sinks in use | TBD |
| Critical env vars and deployment targets | TBD |
| Known high-severity defects already documented | TBD |

---

## 14. Document maintenance

* This file is the permanent governance record for MVP hardening.
* Update the **stage tracker** as work progresses.
* Update Section 13 inventory after Stage 1.
* Do not weaken principles or expand MVP scope in this document without explicit product authorisation.
* When a stage completes, append brief evidence in the tracker rather than deleting history.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/MVP_HARDENING_GUIDE.md` |
| Created | 2026-07-24 |
| Last updated | 2026-08-12 |
| Stage 0 status | Complete |
| Next stage | Stage **3.2.2-R1 Deck Owner Retest**, then **3.2.3** when authorised. Production Scope Discovery **Disabled**. Company DNA **Not Started**. PERF-FUTURE-01 **Planned**. |

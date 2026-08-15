# Stage 3 Product Roadmap

**Status:** Active planning document  
**Created:** 2026-08-05  
**Governing process:** `docs/MVP_HARDENING_GUIDE.md`  
**Architecture:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
**Product backlog:** `docs/product/QUOTR_PRODUCT_BACKLOG.md`  

---

## Stage sequence

| Stage | Name | Intent | Status |
| --- | --- | --- | --- |
| **3.1A** | Product Stabilisation, Workflow Reliability and UX Baseline | Fix Preview workflow defects; answer save reliability; client/spec UX; governed backlog | **Complete** — Preview signed off 2026-08-05 (`docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`) |
| **3.1A-R1** | Preview Remediation | Fix Preview failures: enums, answer reconcile, Quick Estimate Edit, client propagation, capture hierarchy | **Complete** — included in Preview sign-off 2026-08-05 |
| **3.1C** | Domain Model Audit | Documentation-only architectural audit of all major domain objects | **Complete** |
| **3.1C.0** | Auth audit cross-check | Verify independent Claude auth claims against HEAD | **Complete** (`docs/audits/STAGE_3_1C_AUTH_AUDIT_CROSSCHECK.md`) |
| **3.1C.1A** | Auth safety / config / diagnostics | Safe auth errors, signup runtime config assert, structured logging; no transactional RPC | **Complete — Preview Validated** |
| **3.1C.1B** | Transactional signup provisioning | Idempotent org+profile RPC; setup-required finish-setup; drop service-role from normal signup | **Complete — Preview Validated** (032 Applied Remote) |
| **3.1C.2A** | Account menu / logout / Profile / logged-in password | Fix dead account control; `/app/profile`; secure password change | **Complete — Preview Validated** |
| **3.1C.2A-R1** | Profile route runtime remediation | Commit/track missing `/app/profile` page; harden loader states; Preview retest | **Complete — Preview Validated** |
| **3.1C.2A-R2** | Account menu trigger interaction | Fix Base UI GroupLabel-without-Group crash on open | **Complete — Preview Validated** |
| **3.1C.2B** | Auth callback / Forgot Password / redirect-back | Email confirmation callback, reset email flow, return-path routing | **Complete — Preview Validated** |
| **3.1C.2B-R1** | Auth entry links & URL env contract | Login Forgot password UX; canonical Local/Preview/Production origins | **Complete — Preview Validated** |
| **3.1C.3** | First-run & Company Setup UX | Minimum company basics; readiness composer; progressive prompts | **Complete — Preview Validated** |
| **3.1C.3-R1** | First-run / rates / calibration architecture | Audit state machine, rate authorities, gating & calibration design | **Complete** |
| **3.1C.3-R2A** | First-run gating + country/currency + Dashboard | Hard basics route; controlled locale; badge/Dashboard coherence | **Complete — Preview Validated** |
| **3.1C.3-R2B** | Work Area preferences | Preferences only; remove capability lock | **Complete — Preview Validated** |
| **3.1C.3-R2C** | Core rates onboarding redesign | Deprecate generic scope $/m² from primary UX | **Complete — Preview Validated** |
| **3.1C.3-R2D** | Calibration scenario MVP | Explicit calibration evidence; never silent overwrite | **Complete — Preview Validated** |
| **3.1C.3-R2D.1** | Calibration persistence 033 | `calibration_responses` append/supersede | **Complete** (033 Applied Remote) |
| **3.1C.3-R2D.2** | Remote 033 safety gate & apply | Linked quotr_2.0 only; dry-run then push | **Complete** |
| **3.1C.3-R2E** | Setup Preview E2E / polish | Owner Preview after deploy of R2E polish | **Complete — Preview Validated** |
| **3.1C.3-R2E-R1** | Preview first-run / calibration UX remediation | Blank Basics fix; deep links; disclosure; calibration sticky | **Complete — Preview Validated** |
| **3.1C.3-R2E-R1.1** | Company Settings section prop build fix | `initialSection` on CompanySettingsContent | **Complete** |
| **3.1C (overall)** | Auth + first-run Setup | See `docs/implementation/STAGE_3_1C_CLOSURE.md` | **Complete — Preview Validated** (2026-08-10) |
| **3.1D** | Domain Model Refinement | Single authoritative owners; Fact SoT; deterministic Question→Fact→Estimate pipeline | **Complete** — Preview signed off 2026-08-05 (`docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`) |
| **3.1B** | Intelligent Scope Discovery | Smarter work-area / question discovery without redesigning commercial arithmetic | **Complete — Preview Validated** (2026-08-11; closure baseline `441f36c`; code baseline `79afb4e`; Production Disabled) |
| **3.1B.0** | ISD Audit and Specification | Architecture, boundary, contracts, catalogue spec, latency budget, owner decisions | **Complete** (docs only) |
| **3.1B.1** | Suggestion contract and deterministic lifecycle | Pure types, validation, lifecycle, staleness, identity, merge | **Complete — Local** (`docs/implementation/STAGE_3_1B1_SUGGESTION_CONTRACT_COMPLETION.md`) |
| **3.1B.2** | Scope relationship catalogue foundation | Data-driven edges + deterministic missing-scope samples | **Complete — Local** (`docs/implementation/STAGE_3_1B2_SCOPE_RELATIONSHIP_CATALOGUE_COMPLETION.md`) |
| **3.1B.3** | AI discovery provider | Structured provider output, validation, evidence refs | **Complete — Local** (`docs/implementation/STAGE_3_1B3_AI_DISCOVERY_PROVIDER_COMPLETION.md`) |
| **3.1B.4A** | Pure discovery orchestration | Request, snapshot, idempotency, merge, run result | **Complete — Local** (`docs/implementation/STAGE_3_1B4A_DISCOVERY_ORCHESTRATION_COMPLETION.md`) |
| **3.1B.4B-0** | Persistence architecture / security gate | Tables, RLS, threats, verification plan, owner register | **Complete — Planning** (`docs/implementation/STAGE_3_1B4B0_PERSISTENCE_GATE_COMPLETION.md`) |
| **3.1B.4B** | Discovery persistence implementation | Migration 028 + RLS + local verify | **Complete — Local** (`docs/implementation/STAGE_3_1B4B_PERSISTENCE_COMPLETION.md`) — **Applied and Verified** |
| **3.1B.5A** | Accept / reject / modify lifecycle (local) | RPCs + unused service; WA create + append-only decisions | **Complete — Local** (`docs/implementation/STAGE_3_1B5A_DECISION_LIFECYCLE_COMPLETION.md`) — **Applied and Verified** |
| **3.1B.5B** | Remote migration readiness + production wiring design | Runbook, wiring design, Preview rollout, owner approvals | **Complete — Planning** (`docs/implementation/STAGE_3_1B5B_READINESS_COMPLETION.md`) — remote apply Applied and Verified |
| **3.1B.5C** | Gated server-action integration | Feature flag, application services, thin server actions | **Complete — Local** (`docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md`) — UI Unwired; Preview enablement Ready Pending Owner Test; production Disabled |
| **3.1B.6** | Assistant UI integration | Analyse Scope trigger, evidence display, accept/reject/modify controls | **Complete — Local** (`docs/implementation/STAGE_3_1B6_ASSISTANT_UI_COMPLETION.md`) — Preview Test Pending; production Disabled; Analyse Job Preserved; FEAT-001 partial |
| **3.2** | Builder Interview | Structured interview capture aligned with constraints and DNA evidence | **In Progress** — **3.2.2 In Owner Preview / R5 Complete Local**; **3.2.3 Not Started**; stage not globally Complete |
| **3.2.0** | Builder Interview Audit & Specification | Docs-only audit, architecture, contracts, taxonomy, readiness, plan, owner decisions | **Complete Planning** (2026-08-11) |
| **3.2.0-R1** | Architecture reconciliation & owner decision gate | Repo audit vs Claude findings; reconcile direction/authority/conflict/invalidation/recompute/provenance; expand D11–D16; lock 3.2.1 contract on paper | **Complete — Docs only** (2026-08-12) |
| **3.2.1** | Deterministic candidate engine | Versioned registry + pure candidate/readiness engine; no UI/writes/migrations | **Complete** (2026-08-12); D1–D16 OWNER APPROVED |
| **3.2.2** | Core project/site constraint interview | Ask-layer wiring into Assistant; Constraint writes | **In Owner Preview / R5 Complete Local** (2026-08-13) — Owner Demo Preview Pending |
| **3.3** | Commercial Assemblies | Reusable commercial assemblies / packages | Not started |
| **3.4** | Explicit Company Defaults / Manual Learning | Manual company defaults and correction capture without automatic rule mutation | Not started |
| Later | Company DNA | Company-specific intelligence consuming structured evidence | Not started |

---

## Cross-cutting release workstreams

Every Stage 3 release should track:

| Workstream | Focus |
| --- | --- |
| Bugs | Reliability defects blocking the frozen journey |
| UX | Clarity, spacing, human-readable presentation |
| Performance | Measured latency on critical paths (answers, estimate, reopen) |
| Accessibility | Labels, keyboard, live regions for save state |
| Security | Org ownership, validation, no raw error leakage |
| Regression | Stage 2A/2B suites + stage-specific scripts |
| Preview smoke testing | Owner-gated runbooks before production |

---

## Hard constraints across Stage 3

- Do not change commercial formulas or the authoritative commercial-engine architecture.
- Do not introduce migrations without explicit owner approval.
- Do not begin Company DNA implementation until authorised.
- AI prompts change only when a confirmed defect cannot be fixed elsewhere and is documented.
- Prefer smallest safe corrections; no whole-app redesigns.

---

## Deferred product features (recorded, not scheduled for implementation in 3.1B.0)

- FEAT-001 Collapsible work-area cards (partial in 3.1B.6 ISD UI; broader WA cards Deferred)
- FEAT-002 Optional quote items (requires commercial design + goldens)
- FEAT-003 Additional site constraints taxonomy (Builder Interview) — taxonomy design in 3.2.0; implementation gated on owner D4

## Stage 3.2 planning pointers

- Audit: `docs/audits/STAGE_3_2_CURRENT_INFORMATION_CAPTURE_AUDIT.md`
- Reconciliation (3.2.0-R1): `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md`
- Architecture: `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md`
- Question contract: `docs/specifications/QUOTR_BUILDER_INTERVIEW_QUESTION_CONTRACT.md`
- Constraint taxonomy: `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md`
- Estimate readiness: `docs/specifications/QUOTR_ESTIMATE_READINESS_MODEL.md`
- Plan: `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md`
- Owner decisions: `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md` (D1–D16 **OWNER APPROVED**)
- 3.2.1 architecture: `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md`
- 3.2.1 completion: `docs/implementation/STAGE_3_2_1_CANDIDATE_ENGINE_COMPLETION.md`
- Handoff (historical pointer): `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_HANDOFF.md`
- Status: **3.2.2 In Owner Preview / R5 Complete Local**; **3.2.3 Not Started**; Production Scope Discovery **Disabled**; Company DNA **Not Started**
- Post-trial audit (docs only): `docs/audits/POST_TRIAL_MASTER_ARCHITECTURE_AUDIT.md`
- 3.2.2-R1 audit: `docs/audits/STAGE_3_2_2_R1_DECK_OWNER_PREVIEW_AUDIT.md`
- 3.2.2-R1 remediation: `docs/implementation/STAGE_3_2_2_R1_PROJECT_CONDITIONS_REMEDIATION.md`
- 3.2.2-R1 Deck retest: `docs/runbooks/STAGE_3_2_2_R1_DECK_PREVIEW_RETEST.md`
- 3.2.2-R2 implementation: `docs/implementation/STAGE_3_2_2_R2_UX_MARGIN_RESPONSIVENESS.md`
- 3.2.2-R2 Owner retest: `docs/runbooks/STAGE_3_2_2_R2_OWNER_PREVIEW_RETEST.md`
- 3.2.2-R3 implementation: `docs/implementation/STAGE_3_2_2_R3_DEMO_READY_ESTIMATE_UX.md`
- 3.2.2-R3 Owner demo retest: `docs/runbooks/STAGE_3_2_2_R3_OWNER_DEMO_READINESS_RETEST.md`
- 3.2.2-R4 implementation: `docs/implementation/STAGE_3_2_2_R4_DEMO_UX_COMPLETION.md`
- 3.2.2-R4 Owner demo retest: `docs/runbooks/STAGE_3_2_2_R4_OWNER_DEMO_RETEST.md`
- 3.2.2-R5 implementation: `docs/implementation/STAGE_3_2_2_R5_DEMO_UI_POLISH_COMPLETION.md`
- 3.2.2-R5 Owner demo retest: `docs/runbooks/STAGE_3_2_2_R5_OWNER_DEMO_RETEST.md`

## Post–3.2.2 commercial / materials

- Audits + architecture: Complete (2026-08-13)
- Owner decisions CF-D1–D7: **OWNER APPROVED** — `docs/decisions/COMMERCIAL_P0_OWNER_DECISIONS.md`
- **COMMERCIAL-P0 Complete Local** — `docs/implementation/COMMERCIAL_P0_AUTHORITY_LOCK_COMPLETION.md`
- Snapshot safety: `docs/architecture/COMMERCIAL_SNAPSHOT_SAFETY.md`
- Cost-first Rates: **Complete Local / Owner Preview Pending** — `docs/implementation/COST_FIRST_RATES_COMPLETION.md`
- **DEMO-R6** Preview polish: mobile Dashboard KPI densify + status dropdown; Legacy package rates → Advanced. Verify: `scripts/verify-demo-r6-mobile-dashboard-legacy-rates.ts`.
- **DEMO-R7** Final demo polish: shared mobile header avatar; Dashboard compactOnMobile; safe Dashboard auth/profile de-dupe. Verify: `scripts/verify-demo-r7-mobile-header-dashboard.ts`. Deeper Dashboard latency remains **PERF-FUTURE-01**.
- **BRANDING-P0** Company logo upload (Complete Local pending Owner): `organisation-branding` storage + Settings upload + quote fallback. Migration `034`. Snapshot immutability → **BRANDING-SNAPSHOT-01**. Verify: `scripts/verify-branding-p0-company-logo.ts`.
- MaterialRequirement / Deck Takeoff / Stage 3.2.3: **Not Started**
- Production Scope Discovery **Disabled**; Company DNA **Not Started**; PERF-FUTURE-01 **Planned**
- Plan: `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`
- **Post-trial programme:** `docs/audits/POST_TRIAL_MASTER_ARCHITECTURE_AUDIT.md`; pipeline `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md`. **FOUNDATION-R1 Complete / Preview regression remediated by R1-R1**. **FOUNDATION-R1-R1 Complete Local / Owner Preview Pending**. **FOUNDATION-R2** = Scope Details completeness (**Not Started**). REQ-1/2/3 **Not Started**. Stage **3.2.3 remains Not Started**. Do not mark future phases Complete.

## Stage 3.1B planning pointers

- Audit: `docs/audits/STAGE_3_1B_SCOPE_DISCOVERY_CURRENT_STATE_AUDIT.md`
- Boundary: `docs/specifications/INTELLIGENT_SCOPE_DISCOVERY_BOUNDARY.md`
- Suggestion contract: `docs/specifications/SCOPE_DISCOVERY_SUGGESTION_CONTRACT.md`
- Catalogue: `docs/specifications/SCOPE_RELATIONSHIP_CATALOGUE_SPEC.md`
- Latency/cost: `docs/performance/STAGE_3_1B_SCOPE_DISCOVERY_LATENCY_AND_COST_BUDGET.md`
- Plan: `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`
- Owner decisions: `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md`
- Remote + wiring approvals: `docs/decisions/STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md`
- Production wiring design: `docs/architecture/STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md`
- Remote migration runbook: `docs/runbooks/STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md`
- Preview rollout: `docs/runbooks/STAGE_3_1B5B_PREVIEW_ROLLOUT_PLAN.md`
- Preview server integration test: `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md`
- 3.1B.5C completion: `docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md`
- 3.1B.6 completion: `docs/implementation/STAGE_3_1B6_ASSISTANT_UI_COMPLETION.md`
- 3.1B.6R2 completion: `docs/implementation/STAGE_3_1B6R2_BATCH_SCOPE_CONFIRMATION_COMPLETION.md`
- 3.1B.6R3 completion: `docs/implementation/STAGE_3_1B6R3_WORKFLOW_COHERENCE_COMPLETION.md`
- 3.1B.6R3.1 completion: `docs/implementation/STAGE_3_1B6R31_SCOPE_IMPACT_RECOMMENDATIONS_COMPLETION.md`
- 3.1B.7A completion: `docs/implementation/STAGE_3_1B7A_PROGRESSIVE_DISCLOSURE_COMPLETION.md`
- 3.1B.7B completion: `docs/implementation/STAGE_3_1B7B_INFORMATION_HIERARCHY_COMPLETION.md`
- 3.1B.7C completion: `docs/implementation/STAGE_3_1B7C_QUESTION_ESTIMATE_PRESENTATION_COMPLETION.md`
- 3.1B.7D completion: `docs/implementation/STAGE_3_1B7D_FINAL_ASSISTANT_UX_COMPLETION.md`
- 3.1B.7E completion: `docs/implementation/STAGE_3_1B7E_PREVIEW_RELEASE_HARDENING_COMPLETION.md`
- 3.1B.7E defect register: `docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md`
- 3.1B.7F completion: `docs/implementation/STAGE_3_1B7F_OWNER_E2E_GATE_COMPLETION.md`
- 3.1B.7F owner E2E test pack: `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`
- 3.1B.7F owner E2E results: `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md`
- 3.1B.7F-R1 remediation: `docs/implementation/STAGE_3_1B7FR1_DECK_E2E_REMEDIATION_COMPLETION.md`
- 3.1B.7F-R1 Preview retest: `docs/runbooks/STAGE_3_1B7FR1_DECK_PREVIEW_RETEST.md`
- 3.1B.7F-R2 polish: `docs/implementation/STAGE_3_1B7FR2_FINAL_PREVIEW_POLISH_COMPLETION.md`
- 3.1B.7F-R2 Preview retest: `docs/runbooks/STAGE_3_1B7FR2_DECK_PREVIEW_RETEST.md`
- 3.1B.7F-R2 manual scope persistence: `docs/architecture/STAGE_3_1B7FR2_MANUAL_SCOPE_ITEM_PERSISTENCE.md`
- 3.1B.7F-R3 unified scope state: `docs/implementation/STAGE_3_1B7FR3_UNIFIED_SCOPE_STATE_COMPLETION.md`
- 3.1B.7F-R3 Deck final retest: `docs/runbooks/STAGE_3_1B7FR3_DECK_FINAL_RETEST.md`
- 3.1B.7F-R4 Deck retest: `docs/runbooks/STAGE_3_1B7FR4_DECK_RETEST.md`
- 3.1B.7F-R5 Deck final UX/perf: `docs/implementation/STAGE_3_1B7FR5_DECK_FINAL_UX_PERFORMANCE_COMPLETION.md`
- 3.1B.7F-R5 Deck final retest: `docs/runbooks/STAGE_3_1B7FR5_DECK_FINAL_RETEST.md`
- 3.1B.7F-R6 multi-WA data collection: `docs/implementation/STAGE_3_1B7FR6_MULTI_WORK_AREA_DATA_COLLECTION_COMPLETION.md`
- 3.1B.7F-R6 question coverage audit: `docs/audits/STAGE_3_1B7FR6_MULTI_WORK_AREA_QUESTION_COVERAGE_AUDIT.md`
- 3.1B.7F-R6 Fitout retest: `docs/runbooks/STAGE_3_1B7FR6_COMMERCIAL_FITOUT_RETEST.md`
- 3.1B.7F-R6-R1 Scope Details + Specification: `docs/implementation/STAGE_3_1B7FR6R1_SCOPE_DETAILS_SPECIFICATION_COMPLETION.md`
- 3.1B.7F-R6-R1 Fitout retest: `docs/runbooks/STAGE_3_1B7FR6R1_COMMERCIAL_FITOUT_RETEST.md`
- 3.1B.7F-R6-R2 question input-type contract: `docs/implementation/STAGE_3_1B7FR6R2_QUESTION_INPUT_CONTRACT_COMPLETION.md`
- 3.1B.7F-R6-R2 Fitout retest: `docs/runbooks/STAGE_3_1B7FR6R2_COMMERCIAL_FITOUT_RETEST.md`
- 3.1B.7F-R6-R3 stable question flow: `docs/implementation/STAGE_3_1B7FR6R3_QUESTION_FLOW_COMPLETION.md`
- 3.1B.7F-R6-R3 Fitout retest: `docs/runbooks/STAGE_3_1B7FR6R3_QUESTION_FLOW_RETEST.md`
- 3.1B.7F-R6-R4 attention routing: `docs/implementation/STAGE_3_1B7FR6R4_ATTENTION_ROUTING_COMPLETION.md`
- 3.1B.7F-R6-R4 Fitout retest: `docs/runbooks/STAGE_3_1B7FR6R4_FINAL_FITOUT_RETEST.md`
- 3.1B closure: `docs/implementation/STAGE_3_1B_CLOSURE.md`
- 3.2 Builder Interview plan: `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md`
- 3.2 Builder Interview handoff (pointer): `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_HANDOFF.md`
- PERF-FUTURE-01 latency pass (planned): `docs/performance/ASSISTANT_RESPONSIVENESS_LATENCY_OPTIMISATION_PASS.md`
- 3.1B.7G completion: `docs/implementation/STAGE_3_1B7G_ASSISTANT_DENSITY_STICKY_ESTIMATE_COMPLETION.md`
- 3.1B.7G preview retest: `docs/runbooks/STAGE_3_1B7G_PREVIEW_RETEST.md`
- Assistant responsive/mobile architecture: `docs/architecture/QUOTR_ASSISTANT_RESPONSIVE_AND_MOBILE_PRESENTATION.md`
- Production enablement runbook (Production still disabled): `docs/runbooks/STAGE_3_1B_PRODUCTION_ENABLEMENT_RUNBOOK.md`
- 3.1B.6 Preview smoke: `docs/runbooks/STAGE_3_1B6_SCOPE_DISCOVERY_PREVIEW_SMOKE_TEST.md`
- 3.1B.6R2 Preview retest: `docs/runbooks/STAGE_3_1B6R2_PREVIEW_RETEST.md`
- 3.1B.6R3 Preview retest: `docs/runbooks/STAGE_3_1B6R3_PREVIEW_RETEST.md`
- 3.1B.6R3.1 Preview retest: `docs/runbooks/STAGE_3_1B6R31_PREVIEW_RETEST.md`
- UI/UX Overhaul plan: `docs/plans/QUOTR_UI_UX_OVERHAUL_PLAN.md`
- 3.1C.0 auth audit cross-check: `docs/audits/STAGE_3_1C_AUTH_AUDIT_CROSSCHECK.md`
- 3.1C.1A auth safety completion: `docs/implementation/STAGE_3_1C1A_AUTH_SAFETY_COMPLETION.md`
- 3.1C.1A Preview auth smoke: `docs/runbooks/STAGE_3_1C1A_PREVIEW_AUTH_SMOKE.md`
- 3.1C transactional signup design (1B): `docs/architecture/STAGE_3_1C_TRANSACTIONAL_SIGNUP_PROVISIONING_DESIGN.md`
- 3.1C.1B implementation: `docs/architecture/STAGE_3_1C_TRANSACTIONAL_PROVISIONING_IMPLEMENTATION.md`
- 3.1C.1B completion: `docs/implementation/STAGE_3_1C1B_TRANSACTIONAL_PROVISIONING_COMPLETION.md`
- 3.1C.1B Preview retest: `docs/runbooks/STAGE_3_1C1B_PREVIEW_AUTH_RETEST.md`
- 3.1C.1B security review: `docs/security/STAGE_3_1C1B_PROVISIONING_SECURITY_REVIEW.md`
- 3.1C.1B remote 032 readiness: `docs/runbooks/STAGE_3_1C1B_REMOTE_MIGRATION_032_READINESS.md`
- 3.1C.2A account/profile completion: `docs/implementation/STAGE_3_1C2A_ACCOUNT_PROFILE_COMPLETION.md`
- 3.1C.2A Preview test: `docs/runbooks/STAGE_3_1C2A_ACCOUNT_PROFILE_PREVIEW_TEST.md`
- 3.1C.2A-R1 profile route remediation: `docs/implementation/STAGE_3_1C2A_R1_PROFILE_ROUTE_REMEDIATION.md`
- 3.1C.2A-R1 Preview retest: `docs/runbooks/STAGE_3_1C2A_R1_PROFILE_ROUTE_PREVIEW_RETEST.md`
- 3.1C.2A-R2 account menu trigger remediation: `docs/implementation/STAGE_3_1C2A_R2_ACCOUNT_MENU_TRIGGER_REMEDIATION.md`
- 3.1C.2A-R2 Preview retest: `docs/runbooks/STAGE_3_1C2A_R2_ACCOUNT_MENU_TRIGGER_PREVIEW_RETEST.md`
- 3.1C.2B account recovery architecture: `docs/architecture/QUOTR_AUTH_CALLBACK_AND_RECOVERY_ARCHITECTURE.md`
- 3.1C.2B completion: `docs/implementation/STAGE_3_1C2B_ACCOUNT_RECOVERY_COMPLETION.md`
- 3.1C.2B Preview E2E: `docs/runbooks/STAGE_3_1C2B_ACCOUNT_RECOVERY_PREVIEW_TEST.md`
- 3.1C.2B-R1 auth URL configuration: `docs/runbooks/STAGE_3_1C2B_AUTH_URL_CONFIGURATION.md`
- 3.1C.2B-R1 completion: `docs/implementation/STAGE_3_1C2B_R1_AUTH_ENTRY_AND_URLS.md`
- 3.1C.3 first-run architecture: `docs/architecture/QUOTR_FIRST_RUN_AND_COMPANY_SETUP_ARCHITECTURE.md`
- 3.1C.3 completion: `docs/implementation/STAGE_3_1C3_FIRST_RUN_COMPANY_SETUP_COMPLETION.md`
- 3.1C.3 Preview E2E: `docs/runbooks/STAGE_3_1C3_FIRST_RUN_PREVIEW_TEST.md`
- 3.1C.3-R1 setup/rate audit: `docs/audits/STAGE_3_1C3R1_SETUP_RATE_ENGINE_AUDIT.md`
- 3.1C.3-R1 gating model: `docs/architecture/QUOTR_FIRST_RUN_GATING_MODEL.md`
- 3.1C.3-R1 rate/calibration architecture: `docs/architecture/QUOTR_RATE_AND_CALIBRATION_ARCHITECTURE.md`
- 3.1C.3-R1 calibration contract: `docs/specifications/QUOTR_CALIBRATION_SCENARIO_CONTRACT.md`
- 3.1C.3-R1 redesign plan: `docs/plans/STAGE_3_1C3_SETUP_REDESIGN_PLAN.md`
- 3.1C.3-R1 owner decisions: `docs/decisions/STAGE_3_1C3_SETUP_OWNER_DECISIONS.md`
- 3.1C closure: `docs/implementation/STAGE_3_1C_CLOSURE.md`
- Profile vs Company boundary: `docs/architecture/QUOTR_ACCOUNT_PROFILE_AND_COMPANY_BOUNDARY.md`

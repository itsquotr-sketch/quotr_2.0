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
| **3.1D** | Domain Model Refinement | Single authoritative owners; Fact SoT; deterministic Question→Fact→Estimate pipeline | **Complete** — Preview signed off 2026-08-05 (`docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`) |
| **3.1B** | Intelligent Scope Discovery | Smarter work-area / question discovery without redesigning commercial arithmetic | **In Progress** — 3.1B.1–3.1B.5C Complete — Local; 3.1B.6 Ready Pending Preview Server Test; migrations 028/029 Applied and Verified; server integration Complete — Local, UI Unwired; Preview enablement Ready Pending Owner Test; production Disabled; feature flag Implemented; Analyse Job Unchanged |
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
| **3.1B.6** | Assistant UI integration | Analyse Scope trigger, evidence display, accept/reject/modify controls | **Ready Pending Preview Server Test** — intersects FEAT-001 |
| **3.2** | Builder Interview | Structured interview capture aligned with constraints and DNA evidence | Not started |
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

- FEAT-001 Collapsible work-area cards (intersects future 3.1B.6 UI)
- FEAT-002 Optional quote items (requires commercial design + goldens)
- FEAT-003 Additional site constraints taxonomy (Builder Interview)

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

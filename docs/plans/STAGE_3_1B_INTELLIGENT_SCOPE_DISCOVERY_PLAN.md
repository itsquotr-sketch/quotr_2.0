# Stage 3.1B — Intelligent Scope Discovery Plan

**Status:** In Progress  
**Date:** 2026-08-06  
**Parent stage status:** Stage 3.1B — **In Progress**  
**Prerequisite:** Stage 3.1A + 3.1D Complete (Preview signed off)  
**Planning batch:** 3.1B.0 Complete  
**Current batch:** 3.1B.5C — **Complete — Local** (`docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md`)  
**Next batch:** 3.1B.6 — **Ready Pending Preview Server Test**  
**Migrations:** `028`/`029` Complete — Local; remote apply **Applied and Verified**  
**Server integration:** **Complete — Local**, UI Unwired  
**Preview feature enablement:** **Ready Pending Owner Test**  
**Production feature:** **Disabled**  
**Feature flag:** **Implemented** (`SCOPE_DISCOVERY_ENABLED`, default off)  
**AI provider adapter:** Implemented but unused  
**UI integration:** Not Started  
**Production catalogue adoption:** Not Started  
**Analyse Job:** Unchanged  
**Production adoption:** Not Started  

**Specs:**

- `docs/audits/STAGE_3_1B_SCOPE_DISCOVERY_CURRENT_STATE_AUDIT.md`
- `docs/specifications/INTELLIGENT_SCOPE_DISCOVERY_BOUNDARY.md`
- `docs/specifications/SCOPE_DISCOVERY_SUGGESTION_CONTRACT.md`
- `docs/specifications/SCOPE_RELATIONSHIP_CATALOGUE_SPEC.md`
- `docs/specifications/SCOPE_DISCOVERY_PROVIDER_CONTRACT.md`
- `docs/specifications/SCOPE_DISCOVERY_PERSISTENCE_PROPOSAL.md`
- `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md`
- `docs/architecture/STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md`
- `docs/security/STAGE_3_1B4B_PERSISTENCE_SECURITY_REVIEW.md`
- `docs/performance/STAGE_3_1B_SCOPE_DISCOVERY_LATENCY_AND_COST_BUDGET.md`
- `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md`
- `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md`
- `docs/decisions/STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md`
- `docs/runbooks/STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md`
- `docs/runbooks/STAGE_3_1B5B_PREVIEW_ROLLOUT_PLAN.md`
- `docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md`
- `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md`

---

## 1. Objective

Improve likely-scope, missing-scope, dependency, and clarification discovery from Brief, Site Notes, Work Areas, Facts, and Constraints — with AI proposing and users deciding — while preserving Fact SoT and the authoritative commercial engine.

---

## 2. Hard constraints (all sub-batches)

- No commercial formula changes.
- No Company DNA application.
- No assemblies implementation.
- No silent Fact overwrite / accepted-scope deletion.
- Migrations only with explicit owner approval.
- AI prompts change only when documented and gated.
- Prefer converging Analyse Job toward propose→apply without breaking Preview-signed journeys abruptly.

---

## 3. Readiness labels

| Label | Meaning |
| --- | --- |
| **READY** | Can start with recommended MVP defaults |
| **READY PENDING OWNER GATE** | Blocked on unresolved owner decisions |
| **READY PENDING DESIGN DELIVERABLE** | Needs UI/UX or schema design artifact first |
| **NOT READY** | Material dependency missing |

---

## 4. Sub-batches

### 3.1B.1 — Suggestion contract and deterministic lifecycle

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Local** (2026-08-05) |
| **Evidence** | `lib/scope-discovery/*`; `scripts/verify-stage-3-1b1-suggestion-contract.ts`; `docs/implementation/STAGE_3_1B1_SUGGESTION_CONTRACT_COMPLETION.md` |
| **Customer value** | Stable proposal language; no silent accept |
| **Schema** | None — code-only; migrations **Not Approved** |
| **Production adoption** | None |
| **Acceptance** | Pure transition / staleness / merge tests pass; no production imports |

### 3.1B.2 — Scope relationship catalogue foundation

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Local** (2026-08-05) |
| **Evidence** | `lib/scope-discovery/catalogue/*`; `scripts/verify-stage-3-1b2-scope-relationship-catalogue.ts`; completion doc |
| **Customer value** | Deterministic missing-scope for deck/bathroom/fitout samples |
| **Schema** | None — code data modules; migrations **Not Approved** |
| **Production adoption** | None |
| **Acceptance** | Sample edges evaluate against fixture Facts; suggestions validate under 3.1B.1; no AI; no money |

### 3.1B.3 — AI discovery provider

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Local** (2026-08-05) |
| **Evidence** | `lib/scope-discovery/provider/*`; `scripts/verify-stage-3-1b3-ai-discovery-provider.ts`; completion + provider contract docs |
| **Customer value** | Structured, validated discovery output with evidence refs |
| **Schema** | None — code-only; migrations **Not Approved** |
| **Production adoption** | None — Analyse Job unchanged |
| **Acceptance** | Mock transport verification; one repair only; no live key required; no production imports |

### 3.1B.4 — Discovery-run and proposal orchestration

Split for delivery:

#### 3.1B.4A — Pure orchestration and run semantics

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Local** (2026-08-05) |
| **Evidence** | `lib/scope-discovery/orchestration/*`; verify script; completion doc; persistence proposal (not approved) |
| **Customer value** | Idempotent pure runs; merge; stale comparison; no persistence yet |
| **Schema** | None — migrations **Not Approved** |
| **Production adoption** | None — Analyse Job unchanged |
| **Acceptance** | Pure orchestration tests; provider injected; no DB/UI |

#### 3.1B.4B-0 — Persistence architecture and security gate

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Planning** (2026-08-05) |
| **Evidence** | Architecture, security review, verification plan, owner approval register, gate completion |
| **Customer value** | Owner-ready persistence design before any SQL |
| **Schema** | Designed in gate; implemented in 3.1B.4B |
| **Production adoption** | None |
| **Acceptance** | Docs only at gate time; SQL deferred to 3.1B.4B after owner approval |

#### 3.1B.4B — Persistence implementation (owner-gated)

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Local** (2026-08-05) |
| **Evidence** | `028_scope_discovery_persistence.sql`; `lib/scope-discovery/persistence/*`; verify script; completion doc |
| **Customer value** | Durable runs/suggestions/decisions with RLS (unused by production) |
| **Schema** | Migration 028 — **Applied and Verified** remotely |
| **Security** | RLS + integrity + immutability triggers + least-privilege grants |
| **Rollback** | Pre-adoption drop; post-data preserve + flag off |
| **Acceptance** | Local verify + full regression; Analyse Job unchanged |

### 3.1B.5A — Accept / reject / modify lifecycle (local)

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Local** (2026-08-05) |
| **Evidence** | `029_scope_discovery_acceptance_rpc.sql`; `lib/scope-discovery/decisions/*`; verify + completion docs |
| **Customer value** | Explicit decisions; provenance; Fact SoT protection (unused by production) |
| **Schema** | Migration 029 — **Applied and Verified** remotely |
| **Security** | SECURITY INVOKER RPCs; org from auth; anon EXECUTE denied |
| **Rollback** | Drop 029 objects pre-adoption; preserve post-data |
| **Acceptance** | Accept/modify create WA; reject append-only; no Facts; Analyse Job unchanged |

### 3.1B.5B — Remote migration readiness and production wiring design

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Planning** (2026-08-06) |
| **Evidence** | Remote history inspection; 028/029 safety audit; remote runbook; wiring design; Preview rollout; approval register; readiness completion |
| **Customer value** | Owner-ready remote apply + future server-action contract without premature production exposure |
| **Schema** | 028/029 remote apply **Applied and Verified** (owner confirmed entering 3.1B.5C) |
| **Wiring** | Production wiring design **Complete — Planning**; server-action implementation deferred to 3.1B.5C |
| **Feature flag** | **Approved** (strategy) — implementation in 3.1B.5C |
| **UI** | **Not Started** |
| **Analyse Job** | **Unchanged** |
| **Rollback** | Pre-data drop; post-data flag off + preserve |
| **Acceptance** | Docs + verification only; no remote push; no production code/UI |

### 3.1B.5C — Server-action implementation (gated)

| Field | Value |
| --- | --- |
| **Readiness** | **Complete — Local** (2026-08-06) |
| **Evidence** | `lib/scope-discovery/configuration/*`; `lib/scope-discovery/application/*`; `lib/scope-discovery/actions.ts`; `scripts/verify-stage-3-1b5c-gated-server-integration.ts`; `docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md`; `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md` |
| **Customer value** | Authenticated run + accept/reject/modify without UI yet |
| **Schema** | Uses remotely applied 028/029 |
| **Server integration** | **Complete — Local**, UI Unwired |
| **Preview enablement** | **Ready Pending Owner Test** |
| **Production feature** | **Disabled** |
| **Feature flag** | **Implemented** — `SCOPE_DISCOVERY_ENABLED`, default off |
| **Security** | Flag gate; no Assistant UI imports; no new public routes |
| **Analyse Job** | **Unchanged** |
| **Rollback** | Feature flag off; preserve data |
| **Acceptance** | Local verify + full regression; no Analyse Job rewire; no UI |

### 3.1B.6 — Assistant UI integration

| Field | Value |
| --- | --- |
| **Readiness** | **Ready Pending Preview Server Test** (suggestion list UX + owner gates; intersects **FEAT-001**) |
| **Customer value** | See evidence, confidence band, accept/reject/edit on mobile |
| **Likely files** | `components/assistant/*`, a11y live regions |
| **Schema** | None |
| **Security** | No raw provider errors |
| **Rollback** | Hide UI behind flag |
| **Acceptance** | Keyboard/accessible decisions; low-confidence presentation per owner gate |

### 3.1B.7 — Missing-scope recommendations

| Field | Value |
| --- | --- |
| **Readiness** | **READY PENDING OWNER GATE** (deterministic-first presentation) |
| **Customer value** | Fewer omitted trades before estimate |
| **Likely files** | Catalogue evaluator + merge with AI; warning hierarchy |
| **Schema** | None beyond prior |
| **Security** | N/A |
| **Rollback** | Disable emitter |
| **Acceptance** | Deterministic cannot be bypassed by AI; commercial boundary checks (no money from suggestions) |

### 3.1B.8 — Performance, regression and Preview release

| Field | Value |
| --- | --- |
| **Readiness** | **NOT READY** until 3.1B.1–3.1B.7 land |
| **Customer value** | Safe Preview ship |
| **Likely files** | verify scripts; runbook; telemetry hooks |
| **Schema** | None |
| **Security** | Log review |
| **Rollback** | Revert flag / commit |
| **Acceptance** | Latency/cost measured vs budget; Stage 2A/2B + 3.1A/3.1D regressions; Preview smoke |

---

## 5. Recommended next implementation batch

**3.1B.5C** — Complete — Local. **Next:** Owner Preview server test per `STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md`, then Assistant UI integration (3.1B.6). Preserve Fact SoT; no DNA; Analyse Job unchanged; production flag remains disabled until separate gate.

---

## 6. Migration / schema implications

| Item | Implication |
| --- | --- |
| Suggestion/run persistence | Migration 028 — local complete; remote **Applied and Verified** |
| Acceptance RPCs | Migration 029 — local complete; remote **Applied and Verified** |
| D-S6 attachments | Separate; needs DB + Storage RLS |
| D-S4 evidence events | Beneficial later; not required to start 3.1B.1–2 |
| Catalogue in DB | Optional; code modules preferred first |
| Analyse Job behaviour change | Product migration, not necessarily schema |

---

## 7. Security and privacy (plan summary)

- Org + project ownership on every read/write.
- Provider sees only approved fields (owner gate on PII).
- Prompt-injection risk from uploaded text/notes — treat model output as untrusted; schema-validate.
- No API keys or full customer dumps in logs.
- Future Photos/Documents require **both** database ownership/RLS **and** storage-bucket policies (architecture-review finding).

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md` |
| Created | 2026-08-05 |
| Stage status | In Progress — 3.1B.5C Complete — Local |
| Last updated | 2026-08-06 |

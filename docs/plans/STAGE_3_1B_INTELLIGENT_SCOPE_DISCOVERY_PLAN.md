# Stage 3.1B — Intelligent Scope Discovery Plan

**Status:** In Progress  
**Date:** 2026-08-05  
**Parent stage status:** Stage 3.1B — **In Progress**  
**Prerequisite:** Stage 3.1A + 3.1D Complete (Preview signed off)  
**Planning batch:** 3.1B.0 Complete  
**Current batch:** 3.1B.3 — **Complete — Local** (`docs/implementation/STAGE_3_1B3_AI_DISCOVERY_PROVIDER_COMPLETION.md`)  
**Next batch:** 3.1B.4 — **Ready Pending Persistence Owner Gate** (discovery-run orchestration)  
**Migrations:** Not Approved  
**AI provider adapter:** Implemented but unused  
**UI integration:** Not Started  
**Production catalogue adoption:** Not Started  
**Analyse Job:** Unchanged  

**Specs:**

- `docs/audits/STAGE_3_1B_SCOPE_DISCOVERY_CURRENT_STATE_AUDIT.md`
- `docs/specifications/INTELLIGENT_SCOPE_DISCOVERY_BOUNDARY.md`
- `docs/specifications/SCOPE_DISCOVERY_SUGGESTION_CONTRACT.md`
- `docs/specifications/SCOPE_RELATIONSHIP_CATALOGUE_SPEC.md`
- `docs/specifications/SCOPE_DISCOVERY_PROVIDER_CONTRACT.md`
- `docs/performance/STAGE_3_1B_SCOPE_DISCOVERY_LATENCY_AND_COST_BUDGET.md`
- `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md`

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

| Field | Value |
| --- | --- |
| **Readiness** | **Ready Pending Persistence Owner Gate** (+ design deliverable if migration required) |
| **Customer value** | Idempotent runs; stale/supersede; merge deterministic+AI |
| **Likely files** | Orchestrator server actions; optional tables |
| **Schema** | May need `scope_discovery_runs` / `scope_discovery_suggestions` — **Not Approved** until owner decides |
| **Security** | RLS on any new tables; org isolation verification |
| **Rollback** | Feature flag; leave legacy Analyse Job |
| **Acceptance** | Same snapshot → no duplicate provider call; source change stales proposals |

### 3.1B.5 — Accept / reject / modify lifecycle

| Field | Value |
| --- | --- |
| **Readiness** | **READY PENDING OWNER GATE** |
| **Customer value** | Explicit decisions; provenance; Fact SoT protection |
| **Likely files** | Application actions; reuse `work-area-actions`, `scope-persistence` |
| **Schema** | Depends on 3.1B.4 |
| **Security** | Ownership asserts on apply |
| **Rollback** | Disable apply path |
| **Acceptance** | Accept creates WA per rules; reject suppresses; modify preserves original; no user Fact overwrite by AI |

### 3.1B.6 — Assistant UI integration

| Field | Value |
| --- | --- |
| **Readiness** | **READY PENDING DESIGN DELIVERABLE** (suggestion list UX) + owner gates; intersects **FEAT-001** |
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

**3.1B.4** — Discovery-run and proposal orchestration (explicit trigger; merge deterministic + contextual; stale without auto paid calls). Persistence only if owner approves migrations. Do not rewire Analyse Job or begin accept/reject UI until separately gated.

---

## 6. Migration / schema implications

| Item | Implication |
| --- | --- |
| Suggestion/run persistence | Likely new tables + RLS — owner gate; currently **Not Approved** |
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
| Stage status | Planning |

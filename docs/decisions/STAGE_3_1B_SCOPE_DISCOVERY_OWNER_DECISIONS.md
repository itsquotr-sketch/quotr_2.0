# Stage 3.1B — Scope Discovery Owner Decisions

**Status:** Partially approved — 3.1B.3 provider gates cleared  
**Date:** 2026-08-05  
**Plan:** `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`  
**3.1B.1 completion:** `docs/implementation/STAGE_3_1B1_SUGGESTION_CONTRACT_COMPLETION.md`  
**3.1B.3 completion:** `docs/implementation/STAGE_3_1B3_AI_DISCOVERY_PROVIDER_COMPLETION.md`

Do **not** treat Pending/Deferred rows as authorised.

---

## Decision register

| # | ID | Decision | Approved / recommended rule | Status | Approved date |
| ---: | --- | --- | --- | --- | --- |
| 1 | OCD-ISD-01 | Accept behaviour | Accepting a Work Area suggestion creates a Work Area immediately through the application lifecycle, but never fabricates authoritative Facts. May supply title/type, retain provenance/evidence, seed questions, preserve source refs. Must not invent measurements, create unanswered Facts as confirmed, apply commercial values, or overwrite existing WAs/Facts. No production acceptance wiring in 3.1B.1. | **Approved** | 2026-08-05 |
| 2 | OCD-ISD-02 | Low-confidence display | Low-confidence suggestions remain available but are grouped separately as “Other possibilities”. Must not auto-create scope, mix indistinguishably with high-confidence, or be silently hidden. UI deferred. | **Approved** | 2026-08-05 |
| 3 | OCD-ISD-03 | Rejection suppression | Rejected suggestion suppressed until material source change (brief, relevant notes, facts, constraints, accepted WA, later catalogue version). Provider/model upgrade alone must not re-present rejected scope. | **Approved** | 2026-08-05 |
| 4 | — | Modified suggestions as learning evidence | Retain provenance only — do **not** update Company Defaults / DNA | Pending | — |
| 5 | OCD-ISD-05 | Deterministic-first authority | Deterministic relationship checks run before AI. On conflict: deterministic required/suppress/conflict wins; conflict recorded; AI cannot bypass suppress; AI may propose clarification when evidence incomplete. | **Approved** | 2026-08-05 |
| 6 | OCD-ISD-06 | Brief-change rerun | Project Brief changes do **not** automatically trigger a paid provider call. They may mark the most recent discovery result stale and later show “Analyse again”. | **Approved** | 2026-08-05 |
| 7 | OCD-ISD-07 | Site-note rerun | New or changed Site Notes do **not** automatically trigger a paid provider call. Relevant source changes may mark the latest discovery result stale. | **Approved** | 2026-08-05 |
| 8 | OCD-ISD-08 | Explicit analysis trigger | User explicitly triggers scope analysis. Changes may mark prior analysis stale and present “Analyse again”, but must not automatically trigger paid provider calls. | **Approved** | 2026-08-05 |
| 9 | — | First scope categories | Deck, bathroom, commercial fitout samples + org-enabled types | Pending | — |
| 10 | — | Exclusions representation | `POSSIBLE_EXCLUSION` + excluded WA status | Pending | — |
| 11 | — | Optional scope representation | Defer commercial optional (FEAT-002); catalogue optional level later | Deferred | — |
| 12 | OCD-ISD-12 | Staleness | Suggestion becomes stale when a material source it relied upon changes. Accepted Work Areas and user-authored Facts never become stale or revert merely because a later analysis differs. | **Approved** | 2026-08-05 |
| 13 | — | Evidence shown to users | Primary excerpts + rule id + labels | Pending | — |
| 14 | OCD-ISD-14 | Acceptable latency | Design targets: immediate UI acknowledgement ≤200 ms; completed discovery result p95 ≤20 seconds. Targets, not measured SLOs, until production instrumentation exists. | **Approved** | 2026-08-05 |
| 15 | OCD-ISD-15 | Provider fallback | MVP: one primary provider request; one controlled repair attempt only for malformed structured output; no silent provider/model substitution; controlled failure after repair failure. | **Approved** | 2026-08-05 |
| 16 | OCD-ISD-16 | Persist across model upgrades | Every result remains tied to provider, model, prompt version, contract version, catalogue version. Upgrades create new runs and never rewrite prior results. | **Approved** | 2026-08-05 |
| 17 | OCD-ISD-17 | Provider data minimisation | Only minimum relevant: Project Brief; selected/relevant Site Notes; relevant accepted Work Areas; relevant Facts; relevant Constraints. Do not send secrets, unrelated org/customer data, full DB records, attachments until approved, or historical commercial records unless later approved. | **Approved** | 2026-08-05 |
| 18 | — | Future photos/documents | Deferred until D-S6 (DB RLS + Storage policies) | Deferred | — |
| 19 | — | What requires migration | Runs/suggestions tables if needed — **Not Approved** | Pending | — |
| 20 | — | Defer to Builder Interview | FEAT-003 taxonomy; deep interview flows | Deferred | — |

---

## Explicit non-approvals (carry forward)

| Item | Status |
| --- | --- |
| Deferred schema proposals (3.1D D-S*) | **Not Approved** |
| Migrations for ISD persistence | **Not Approved** |
| AI provider adapter | **Implemented but unused** (3.1B.3 Complete — Local) |
| UI integration | **Not Started** |
| Company DNA implementation | **Not started / forbidden** |
| Commercial formula changes | **Forbidden** |
| FEAT-001 collapsible cards | **Deferred** |
| FEAT-002 optional quote items | **Deferred** |
| FEAT-003 constraint taxonomy | **Deferred** → Builder Interview |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md` |
| Created | 2026-08-05 |
| Last updated | 2026-08-05 |
| Approvals | OCD-ISD-01, 02, 03, 05, 06, 07, 08, 12, 14, 15, 16, 17 |

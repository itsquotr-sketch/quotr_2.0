# Stage 3.1D — Deferred Schema Proposals

**Status:** Proposals only — **Not Approved**; not implemented  
**Date:** 2026-08-05  
**Constraint:** Stage 3.1D forbids migrations without owner approval  

These schema changes would strengthen the refined domain model. They are documented here with justification so they can be authorised separately.

---

## Proposal D-S1 — First-class estimate line metadata column

| Field | Value |
| --- | --- |
| **Change** | Add `estimate_line_items.metadata jsonb` (or typed columns) and stop packing runtime fields into `notes` via `__quotr_meta__` |
| **Why required** | Metadata-in-notes blocks reporting, override learning, and safe recalibration introspection |
| **Why not in 3.1D** | Requires migration + dual-read/write period; commercial risk if mis-mapped; value outweighs risk only with a dedicated batch |
| **Risk if deferred** | Continued fragility; acceptable short-term with documentation |
| **Recommended stage** | Pre-3.3 / pre-3.5 hardening batch |

---

## Proposal D-S2 — Align DB checks with TypeScript unions

| Field | Value |
| --- | --- |
| **Change** | Allow `questions.input_type = 'multi_select'` and/or `estimate_line_items.category = 'mixed'`, **or** remove unused TS variants |
| **Why required** | Runtime/TS vs DB check divergence can cause silent insert failures |
| **Why not in 3.1D** | Needs decision which side is canonical; opportunistic migration |
| **Recommended stage** | Next authorised migration window |
| **3.1B.7F-R6-R2 note** | `multi_select` is an **app presentation** type persisted as DB `text` + options; UI rehydration uses template identity by question key (not options-alone). Migration 034 **not** required for Fitout Preview. `estimate_line_items.category = 'mixed'` remains deferred. |

---

## Proposal D-S3 — Rename `pricing_audit_log.organisation_id` → `org_id`

| Field | Value |
| --- | --- |
| **Change** | Column rename for consistency with all other tenant tables |
| **Why required** | Naming footgun for future writers |
| **Why not in 3.1D** | Pure rename migration; no ownership behaviour change needed now |
| **Recommended stage** | Next audit-touching migration |

---

## Proposal D-S4 — Evidence / commercial event table

| Field | Value |
| --- | --- |
| **Change** | Append-only `evidence_events` (or equivalent) for answer corrections, overrides, proposal accept/reject, rate edits |
| **Why required** | Company DNA / Evidence Engine need durable correction history; estimate/fact overwrite loses learning substrate |
| **Why not in 3.1D** | Large product design; Stage 3.5 territory; 3.1D fixed ownership without new stores |
| **Recommended stage** | 3.4–3.5 |

---

## Proposal D-S5 — Estimate revision / snapshot table

| Field | Value |
| --- | --- |
| **Change** | Snapshot estimate (+ lines) on regenerate instead of destroy-in-place only |
| **Why required** | DNA and auditability of estimate trajectory |
| **Why not in 3.1D** | Storage + product UX for history; not required for ownership clarification |
| **Recommended stage** | 3.5 or pre-DNA |

---

## Proposal D-S6 — Project attachments (photos / file documents)

| Field | Value |
| --- | --- |
| **Change** | `project_attachments` + storage bucket; link from notes |
| **Why required** | Frozen journey step 6; Evidence Engine visual/plan evidence |
| **Why not in 3.1D** | Media stack + security surface; out of ownership-refinement scope |
| **Recommended stage** | Dedicated media / 3.5 |

---

## Proposal D-S7 — Optional `clients` table

| Field | Value |
| --- | --- |
| **Change** | Nullable `projects.client_id` FK; keep `client_name` fallback |
| **Why required** | Cross-job client identity for CRM/DNA |
| **Why not in 3.1D** | Architecture excludes full CRM from MVP; string SoT from 3.1A is sufficient |
| **Recommended stage** | Post-MVP when authorised |

---

## Proposal D-S8 — Fact revision history

| Field | Value |
| --- | --- |
| **Change** | `project_fact_revisions` or evidence events on fact upsert |
| **Why required** | Correction provenance (OCD-50/51) |
| **Why not in 3.1D** | Ownership fixed without history store; history is Evidence Engine |
| **Recommended stage** | 3.4–3.5 |

---

## Summary

| ID | Implement now? | Blocker for |
| --- | --- | --- |
| D-S1 | No | Assemblies / learning quality |
| D-S2 | No | Edge-case inserts |
| D-S3 | No | Future audit DX |
| D-S4 | No | Evidence Engine / DNA |
| D-S5 | No | DNA estimate history |
| D-S6 | No | Frozen journey / Evidence |
| D-S7 | No | CRM / cross-job DNA |
| D-S8 | No | Correction evidence |

**None of these are required to complete Stage 3.1D ownership refinement.**

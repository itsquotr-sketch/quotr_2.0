# Intelligent Scope Discovery — Boundary Specification

**Status:** Specification (Stage 3.1B.0) — not implemented  
**Date:** 2026-08-05  
**Complements:** `ESTIMATE_COMMERCIAL_BOUNDARY.md`, `COMMERCIAL_ENGINE_CONTRACT.md`, `STAGE_3_1D_DOMAIN_MODEL_REFINED.md`  
**Audit:** `docs/audits/STAGE_3_1B_SCOPE_DISCOVERY_CURRENT_STATE_AUDIT.md`

---

## 1. Purpose

Define ownership for Intelligent Scope Discovery (ISD) so AI can improve likely-scope detection while **Facts, accepted Work Areas, and commercial totals remain under explicit user and deterministic authority**.

---

## 2. Core product rule

> **AI may propose. The user decides.**  
> Facts and accepted Work Areas become authoritative only after explicit application rules and user confirmation.

ISD must **never** silently:

- create commercial totals;
- overwrite user Facts;
- delete accepted scope;
- change margin or rates;
- alter historical records;
- apply Company DNA;
- treat low-confidence suggestions as confirmed work.

---

## 3. Layer ownership

### 3.1 AI discovery layer

**May propose:**

- likely Work Areas;
- likely sub-scopes;
- likely missing scope;
- confidence and confidence band;
- evidence references;
- clarification needs;
- dependency suggestions;
- possible exclusions.

**Must not own:**

- accepted Work Areas;
- authoritative Facts;
- commercial totals;
- rates;
- margin;
- GST;
- user decisions;
- historical truth (quotes, frozen snapshots).

**Must not:**

- auto-accept suggestions;
- write `source=user` Facts without an explicit accept path;
- invent money or multiply confidence into price;
- bypass deterministic catalogue / validation.

### 3.2 Deterministic rules layer

**May own:**

- scope relationship catalogue;
- duplicate detection;
- dependency checks;
- accepted / rejected / stale / superseded state logic;
- idempotency keys and merge rules;
- required evidence structure validation;
- conflict detection;
- deterministic missing-scope checks;
- suggestion status transitions.

**Must not own:**

- free-form narrative as authority;
- commercial arithmetic;
- Company DNA rule mutation.

### 3.3 Application layer

**Owns:**

- authentication and organisation ownership;
- persistence of runs, suggestions, and accepted domain objects;
- user acceptance / rejection / modification;
- proposal lifecycle orchestration;
- revalidation / cache invalidation;
- conflict handling UX and server resolution;
- audit trail (within approved schema);
- mapping accepted scope into existing Work Area / Fact / Constraint writers that obey 3.1D.

### 3.4 Commercial engine

**Owns only** deterministic money **after** scope inputs are accepted and estimate/pricing adapters supply structured commercial requests.

**Must not** receive unaccepted AI suggestions as line authority.

---

## 4. Domain object authority (ISD context)

| Object | Authority after ISD | Notes |
| --- | --- | --- |
| `ScopeDiscoverySuggestion` | Proposal only until accept/reject/modify | See suggestion contract |
| `ScopeDiscoveryRun` | Application metadata for a discovery attempt | Not commercial truth |
| Work Area (`confirmed`) | User + application accept path | Suggested ≠ accepted |
| Fact (`project_facts`) | User / accepted write rules | AI may propose fact candidates; must not overwrite `source=user` |
| Constraint | User / accepted write rules | Namespace separate from facts |
| Derived Fact | Deterministic derivation | Never overwrites user |
| Estimate / Pricing / Quote | Commercial engine + existing freeze rules | Out of ISD money path |
| Company DNA | Future consumer of evidence | Must not auto-apply in 3.1B |

---

## 5. Input surfaces ISD may read

| Input | Role | Authoritative for money? |
| --- | --- | --- |
| Project Brief | Primary narrative evidence | No |
| Site Notes | Ongoing observational evidence | No |
| Existing Work Areas | Ground truth for accepted/excluded scope | Accepted WAs yes for scope presence |
| Facts | Estimating SoT | Yes for quantities/finishes once present |
| Constraints | Site/access SoT | Yes for constraint-driven adjustments once present |
| Photos / Documents | Future evidence (planned) | No until accepted structured extraction |
| Existing estimate context | Downstream consumer; may inform missing-scope warnings later | Money remains engine-owned |
| Explicit user decisions | Accept / reject / modify / exclusions | Yes for decision state |

---

## 6. Output surfaces ISD may write (only via governed paths)

| Output | When writable |
| --- | --- |
| Suggestions / runs | On analysis (proposal store — design in later batches) |
| Work Areas | Only on **Accept** (or existing confirm path) |
| Facts | Only on Accept when product rules say so; prefer questions over inventing facts |
| Constraints | Only on Accept when evidence supports; never invent commercial rates |
| Questions / clarification | May be proposed; creation follows existing question builders after accept/confirm |
| Estimates | **Never** from ISD directly |

---

## 7. Compatibility with future stages

| Stage | Compatibility requirement |
| --- | --- |
| Fact SoT (3.1D) | All acceptance writes go through Fact-first helpers |
| Builder Interview (3.2) | Clarification suggestions may later feed interview; taxonomy expansion deferred (FEAT-003) |
| Commercial Assemblies (3.3) | Catalogue may carry `futureAssemblyLink`; no assemblies in 3.1B |
| Company Defaults (3.4) | Modified suggestions may become learning evidence later; **no auto default updates** |
| Evidence Engine / DNA | Evidence model + rejection/modification provenance designed now; DNA application forbidden |

---

## 8. Relationship to current Analyse Job

Current Analyse Job **partially violates** the long-term ISD boundary by writing suggested Work Areas and AI Facts/Constraints immediately. Stage 3.1B planning converges toward:

1. Propose → review → apply (as note proposals already do);
2. Deterministic catalogue checks before/alongside AI;
3. Explicit analysis-run and suggestion contracts.

**This batch does not change Analyse Job behaviour.** Migration of Analyse Job onto the ISD boundary is an owner-gated implementation concern in later 3.1B sub-batches.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/INTELLIGENT_SCOPE_DISCOVERY_BOUNDARY.md` |
| Created | 2026-08-05 |
| Approval | Spec only — not product-approved implementation |

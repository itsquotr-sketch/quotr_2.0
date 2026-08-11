# Stage 3.2.0-R1 — Architecture Reconciliation & Owner Decision Gate

**Status:** Complete — Audit / Planning (docs only)  
**Date:** 2026-08-12  
**Prerequisite:** Stage 3.2.0 Complete Planning (2026-08-11)  
**Does not:** implement Builder Interview UI, candidate engine code, migrations, Fact/formula changes, Production Scope Discovery, Company DNA, or Stage 3.2.1  

**Companion deliverables:**
- Updated architecture: `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md`
- Owner decisions (D1–D16): `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md`
- 3.2.1 contract: `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md` §3.2.1
- Readiness / question contract / taxonomy: updated specs under `docs/specifications/`

---

## 1. Purpose

A separate Claude architecture/code audit raised concerns about the Stage 3.2.0 plan. This batch verifies those concerns against the **repository as authority**, reconciles architecture on paper, and expands Owner Decisions. No application behaviour was changed.

---

## 2. Claude findings — confirmed

| # | Finding | Repo verdict |
| --- | --- | --- |
| C1 | Fact ↔ constraint direction must be settled before coding | **Confirmed.** Live authority is sibling namespaces (`project_facts` vs `constraints`), not a bidirectional sync engine. |
| C2 | `inferConstraintsFromFacts` implies Facts→Constraints inference | **Confirmed direction.** Function derives constraint candidates from WA Facts (client-supplied, by-others, carting → carry/bin). |
| C3 | Authority tiers include `system`; plans under-specified it | **Confirmed.** `FACT_SOURCE_PRECEDENCE` ranks `system` at 20 (below assumption 30, above derived 10). DB allows it; production writers rarely persist `source=system` on facts. |
| C4 | Conflict / overwrite policy incomplete for interview | **Confirmed.** AI skips existing `source=user`; derived never overwrites user; user upserts overwrite freely. No conflict UI when a new user answer differs from a prior user value. Constraint upsert has no source-precedence guard. |
| C5 | Assumption invalidation not designed | **Confirmed.** Estimate `assumptions` / `assumption_metadata` regenerate on calc; no durable interview assumption records; no invalidation when Facts/constraints/WAs/scope change beyond `markEstimateStale`. |
| C6 | Candidate recomputation timing unspecified | **Confirmed as planning gap.** Scope Details regenerates missing questions after **batch** save / WA / fact events — not every keystroke. Interview must choose an explicit model. |
| C7 | Conditional-child behaviour unclear | **Confirmed.** `shouldHideConditionalQuestion` applies at **generation** time only; no `parent_id`; persisted children are not purged when parent makes them irrelevant. |
| C8 | Provenance / evidence for interview answers under-specified | **Confirmed.** Facts have `source` (+ optional `confidence` / `conflict_warning`); questions have coarse `answer_source` (often unused in UI load); no evidence blob / question_key linkage on rows. |
| C9 | Schema vs registry for interview contract | **Confirmed concern.** Existing `questions` / `question_blocks` lack `priority_class`, `write_target`, parent graph, assumption linkage. |
| C10 | Scope Details ↔ Site Constraints duplication risk | **Confirmed.** Per-WA `*.access` / carting templates coexist with project constraints. Suppression exists (`isSuppressedByProjectWideKnowledge`) but is weakened by defects (see §4). |
| C11 | P0 soft-block vs Quick Estimate path | **Confirmed gap.** Generate is stage-gated (`ready_to_estimate`) only; calculators default missing inputs and emit `missingInfo` / confidence — **no** P0 soft-block today. |
| C12 | READY triad must not become a competing readiness SoT | **Confirmed risk.** Setup readiness, stage machine, Details completeness, calculator `missingInfo`, QE attention already coexist. Interview readiness must be a **derived view**. |
| C13 | Multi-WA Fitout amplifies access clones | **Confirmed.** Question builder emits per confirmed WA; project-wide suppress intended but unreliable today. |
| C14 | PERF-FUTURE-01 cooperation required | **Confirmed.** Parallel track; interview must not add per-answer AI or remount-heavy refresh. |

---

## 3. Claude findings — rejected or modified

| # | Claim / implication | Verdict | Why |
| --- | --- | --- | --- |
| R1 | Proposed “project/site topics → constraints” conflicts with current architecture because of `inferConstraintsFromFacts` | **Rejected.** Inference is Facts→Constraints **seed candidates** and is **dead code** (`buildScopeDrivenConstraints` has no production callers). Live writes: AI/user → `constraints` table; WA meaning → `project_facts`. Interview writing site topics to constraints **aligns** with 3.1D sibling namespaces. |
| R2 | Must choose Facts-from-constraints **or** constraints-from-Facts as the sole pipeline | **Modified.** Correct model: **write authority by topic**, not a sync engine. Project-wide site keys → constraints; WA-scoped meaning → Facts; optional one-way **suppress/seed** helpers may exist but do not invert SoT. |
| R3 | Constraint taxonomy additions require a DB migration | **Rejected for MVP.** `constraints.key` is free `text`; allowlist is application (`RESERVED_CONSTRAINT_KEYS` + templates). Expanding taxonomy = code allowlist/template change. Migration only if Owner later wants a DB CHECK enum. |
| R4 | Existing question tables cannot support interview without schema change before 3.2.1 | **Modified.** 3.2.1 is a **pure candidate engine** — registry in code, no persistence of candidates required. Answer persistence (later batches) writes Facts/Constraints using existing tables. Schema change **not** required to start 3.2.1. Optional provenance table remains Owner-gated later. |
| R5 | Interview should recompute candidates after every answer (implied by some dynamic-UI designs) | **Modified.** Repo pattern and PERF goals favour **batch-boundary / presentation-boundary** recompute. Per-answer local UI filter is allowed; full candidate rebuild every keystroke is not required and risks latency. |
| R6 | Evidence/provenance must be a new persisted graph before MVP | **Modified.** Minimum useful MVP: Fact/Constraint `source` + registry `question_key` (code) + estimate assumption strings/metadata for explicit assumptions. Dedicated evidence table deferred unless Owner chooses D16 option requiring it. |
| R7 | `system` source is an active competing writer today | **Modified.** `system` is in the precedence map and question prepopulation mapping; it is **not** a common persisted fact writer. Treat it as reserved tier below assumption for merge/display; interview should not invent a new tier above user. |

---

## 4. Repository defects relevant to 3.2 (document only — not fixed in R1)

| Defect | Evidence | Impact on 3.2 |
| --- | --- | --- |
| Wrong table name `project_constraints` | `lib/assistant/actions.ts`, `lib/assistant/missing-questions.ts` | Constraint load for question generation often empty → **project-wide suppression fails** |
| Occupied key mismatch | Suppression reads `site_occupied`; taxonomy/AI use `occupied_site` | Occupied suppression never fires |
| Dead scope-driven constraint builder | `buildScopeDrivenConstraints` / `inferConstraintsFromFacts` unused | Do not treat as live architecture; decide keep-as-helper vs delete in a later code batch |

These are **implementation prerequisites** for 3.2.2+ suppression wiring — not part of 3.2.0-R1 (no behaviour change in this batch).

---

## 5. Actual Fact / Constraint direction (authoritative)

```
Project-wide site / logistics keys  →  constraints table  (flat reserved keys)
WA-scoped estimating meaning        →  project_facts      (dotted keys ± work_area_id)
Question answers                    →  dual-write: Fact SoT then questions journal
Constraints                         →  no dual-write to Facts/questions

Optional helper (unused today):
  WA Facts  --inferCandidates-->  constraint seeds  (NOT SoT; NOT reverse sync)
```

**Interview write rule (proposed):**
- Semantic site topics (access, carry, occupied, hours, …) → **constraint** keys.
- WA overrides / WA-owned detail → **Fact** keys.
- Never invent commercial rates; never write Scope Review include/exclude; never replace Scope Details component questions.

**Does not conflict** with dead Facts→Constraints inference: that helper, if revived, would only seed unknown constraint rows from WA evidence — still subordinate to explicit user constraint answers.

---

## 6. Final proposed authority hierarchy

```
explicit user (interview / Scope Details / Constraint UI / Scope Review fact edit)
  > existing source=user (protected from AI/derived/system writers)
  > ai_extracted
  > default
  > assumption          (explicit “Use reasonable assumption” or approved system assume)
  > system              (reserved tier; display/prepopulation; rarely persisted)
  > derived             (computed; never overwrites user)
```

**Sibling namespaces:** Fact keys and Constraint keys do not compete for the same row. Conflict is **semantic** (e.g. `site_access` vs `{wa}.access`), resolved by **suppression / override rules**, not by merging into one table.

**Company / commercial layers** (rates, DNA, calibration, formulas) are **outside** this hierarchy for Builder Interview writes.

---

## 7. Conflict policy (proposed)

| Situation | Policy |
| --- | --- |
| Interview answer when key unknown | Create with `source=user` |
| Interview answer when existing `ai_extracted` / `default` / `assumption` / `system` / `derived` | Update to `source=user` (user wins) — same as Scope Details today |
| Interview answer when existing `source=user` and value **unchanged** | No-op / confirm |
| Interview answer when existing `source=user` and value **differs** | **Surface conflict** (do not silent-replace without confirm) — Owner D13 |
| AI / derived / non-user writers vs existing user | **Skip** (already implemented for AI + derived) |
| Constraint user upsert from Site Constraints UI | Today overwrites unconditionally; interview should follow same conflict rule as Facts for user-vs-user |

---

## 8. Assumption invalidation model (proposed)

**Storage (MVP, no new table preferred):**
- Assumed values: Fact/Constraint row with `source=assumption` **or** estimate `assumption_metadata` + assumptions list when only estimate-scoped.
- Linkage: registry `question_key` stored in assumption metadata / reason string (structured when practical).

**Invalidate (drop or mark stale) when:**
1. User later answers the same semantic key (`source=user` supersedes).
2. Underlying trigger Facts/constraints change such that the question is no longer relevant (parent condition false; WA excluded; scope item excluded).
3. Confirmed WA set changes remove the WA that owned a WA-scoped assumption.
4. Project-wide answer now suppresses the WA assumption topic.

**Do not auto-rewrite** commercial formulas. Invalidation feeds readiness recompute and next estimate regen (`markEstimateStale`).

---

## 9. Recomputation model (proposed)

| Event | Candidate engine action |
| --- | --- |
| Initial presentation / Assistant open for interview surface | Full deterministic recompute from project snapshot |
| After interview **batch save** | Full recompute remaining candidates |
| After Scope Details batch save / constraint save / WA confirm-exclude / fact edit | Recompute when those surfaces can change suppress/trigger inputs |
| Per keystroke / local option tap before save | **UI-only** filter; no engine rebuild required |
| Stage navigation into pre-estimate nudge | Full recompute |

**Forbidden MVP:** AI call per answer; remount entire Assistant on each recompute.

---

## 10. Conditional-child handling (proposed)

1. Registry may declare `depends_on` / trigger rules (code-level; no DB `parent_id` required for 3.2.1).
2. Engine omits children when parent condition fails (generation-time), matching `shouldHideConditionalQuestion`.
3. If a child was previously answered and parent later invalidates: treat child answer as **non-authoritative for candidacy** (suppress); do not delete Fact/Constraint history in MVP unless Owner requires purge.
4. Do not leave irrelevant children in the **active interview batch**.

---

## 11. Provenance / evidence decision (proposed)

**3.2.1:** no persistence — candidates are ephemeral pure outputs.

**Answer batches (later):** minimum useful structure without migration:
- Persist value on Fact or Constraint with `source`.
- Registry carries `question_key`, `write_target`, priority, ask policy.
- Explicit assumptions: `source=assumption` + estimate assumption presentation fields.
- Optional later: dedicated assumption/provenance table only if dual-write proves insufficient (Owner D16).

**Not required for MVP:** evidence graphs, photo linkage, ISD-style evidence jsonb on interview rows.

---

## 12. Schema / migration verdict

| Item | Verdict |
| --- | --- |
| 3.2.0-R1 | No migration |
| 3.2.1 candidate engine | No migration |
| New constraint keys (D4) | App allowlist + templates; **no migration** unless DB CHECK desired later |
| Interview answer persistence | Prefer existing `constraints` / `project_facts` / estimate assumption jsonb |
| New provenance table | Owner-gated; default **defer** |

---

## 13. Duplication / suppression model (proposed)

1. Interview is the **ask layer** for project site topics; Constraints remain the **persistence namespace**.
2. Once a project constraint (or interview answer writing that constraint) is known and meaningful, Scope Details must **suppress** semantic WA clones (`*.access`, carting when covered, occupied clones, etc.).
3. Fix known load/key defects before relying on suppression in 3.2.2+.
4. WA override questions only when registry trigger says conditions may differ or user marks “differs by area”.
5. Scope Discovery clarifications remain scope-existence — not a second site interview.
6. Scope Details keeps granular component questions (disposition A/E).

---

## 14. Readiness model (proposed)

**Interview readiness is a derived projection**, not a new SoT:

```
inputs:
  open interview candidates (P0/P1) + explicit assumptions
  + calculator missingInfo mapped to keys (existing)
  + Scope Review blocking only when ISD enabled (existing)
  + Detail P0 quantities when estimate-blocking (existing calculator / required facts)

output states:
  READY
  READY WITH ASSUMPTIONS
  NEEDS IMPORTANT INFORMATION
```

**Does not replace:** company setup readiness, assistant stage machine, QE attention routing.  
**Soft-block (D3):** overlays generate UX; stage may still be `ready_to_estimate`.

---

## 15. Multi-WA behaviour (proposed)

- Project logistics asked **once**.
- Commercial Fitout: suppress per-WA access/carry clones after project answer.
- WA-only packs: demolition services/hazmat (and similar) when unknown and triggered.
- Group UI by domain, not by WA fan-out.
- Project readiness = worst of project P0s + any WA blocking quantity gaps.

---

## 16. Performance model (proposed)

- Cooperate with **PERF-FUTURE-01** (parallel; not a start gate for 3.2.1).
- Deterministic in-memory candidates from loaded snapshot.
- No AI per answer.
- Batch writes; optimistic UI; avoid `router.refresh` remount storms.
- Recompute on batch/presentation boundaries (§9).

---

## 17. Preserved invariants

- `project_facts` = estimating Fact SoT  
- Constraints sibling namespace unless Owner explicitly changes (not proposed)  
- User authority; no silent overwrite of explicit user data (conflict UI for user-vs-user)  
- Scope Review owns include/exclude  
- Scope Details owns granular component questions  
- Company rates/calibration outside interview  
- Deterministic Builder Interview MVP; no AI call per answer  
- Production Scope Discovery remains **Disabled**  
- Company DNA remains **Not Started**  
- Commercial formulas **unchanged**

---

## 18. Verification performed (R1)

| Check | Result |
| --- | --- |
| Re-read Stage 3.2.0 planning set | Done |
| Code audit: inference, precedence, upserts, questions, constraints, generate, readiness | Done |
| `scripts/verify-stage-3-1d-domain-model-refinement.ts` | Run in this batch (see completion notes) |
| Application behaviour / migrations | **Not modified** |
| Stage 3.2.1 implementation | **Not started** |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md` |
| Stage | 3.2.0-R1 |
| Next | Owner approves D1–D16 → begin 3.2.1 only |

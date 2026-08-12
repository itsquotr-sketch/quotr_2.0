# Quotr Builder Interview — Architecture

**Status:** Stage 3.2.0-R1 Reconciled Planning; **3.2.1 engine Complete Local** (conceptual UI still not implemented)  
**Date:** 2026-08-12  
**Baseline:** Stage 3.1B Complete — Preview Validated (`441f36c`); Stage 3.2.0 planning 2026-08-11  
**Reconciliation:** `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md`  
**Engine:** `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md`  
**Related:**  
- `docs/audits/STAGE_3_2_CURRENT_INFORMATION_CAPTURE_AUDIT.md`  
- `docs/specifications/QUOTR_BUILDER_INTERVIEW_QUESTION_CONTRACT.md`  
- `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md`  
- `docs/specifications/QUOTR_ESTIMATE_READINESS_MODEL.md`  
- `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md`  
- `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md`  

**Hard non-goals still:** Work Area interview UI (→ 3.2.3); soft-block Generate (→ 3.2.4); Fact schema rewrites; estimate formula changes; Production Scope Discovery enablement; Company DNA.

---

## 1. Product intent

Builder Interview makes Quotr substantially better at understanding a **real construction job** before pricing it.

It behaves like an experienced estimator interviewing a builder:

> “What important information do I still need to know about **this** job?”

It is **not**:

- a giant static questionnaire;
- a duplicate Scope Details form;
- a mandatory interrogation before every estimate;
- a replacement for Analyse Job;
- a replacement for Scope Discovery / Scope Review;
- a second Site Constraints form with different answers;
- a generic construction checklist;
- Company DNA or company rate capture.

---

## 2. Responsibility contract

### 2.1 Owns

Builder Interview collects missing **project context** and **construction conditions** that materially improve understanding of:

- how the work will be performed;
- what exists already (when not already Facts);
- access / logistics;
- important construction methodology;
- trade interfaces that change risk or scope assumptions;
- risk conditions;
- quantities **only when otherwise unknown and estimate-blocking**;
- assumptions that would materially change an estimate if wrong.

Answers write into existing authorities:

- **Constraints** for reserved / taxonomy project-wide site keys;
- **Facts** for WA-scoped or dotted keys (never inventing commercial rates);
- **Assumptions** when user chooses “Use reasonable assumption” or system defers.

### 2.2 Explicitly does NOT own

| Concern | Owner |
| --- | --- |
| High-level WA seeding from brief | Analyse Job |
| Missing-scope / dependency suggestions | Scope Discovery |
| Include / exclude / modify scope items | Scope Review |
| Granular component / finish / count questions | Scope Details |
| Company labour/material rates | Company Setup / rates |
| Company productivity DNA | Company DNA (later) |
| Calibration expected totals | Calibration MVP |
| Commercial arithmetic | Estimate engine (frozen formulas) |
| Quote presentation | Pricing / Quote |

### 2.3 Boundary with Site Constraints

Site Constraints remain the **persistence namespace** for project-wide site keys.

Builder Interview is the **intelligent ask layer** that:

- decides which constraint/Fact questions still matter;
- suppresses duplicates;
- ranks impact;
- batches concise asks;
- records assumptions when skipped via explicit assume.

MVP **reuses / extends** the constraint taxonomy rather than inventing a parallel store.

---

## 3. Fact ↔ Constraint direction (reconciled)

### Live repository

```
project_facts     = estimating Fact SoT (WA or project-wide dotted keys)
constraints       = sibling project-level site namespace (flat reserved keys)
questions         = capture journal only (not estimating authority)

Analyse Job / user UI write both namespaces directly.
```

`inferConstraintsFromFacts()` in `lib/assistant/constraint-templates.ts` can derive **constraint seed candidates** from WA Facts (client-supplied, by-others, carting bands). It is called only from `buildScopeDrivenConstraints`, which currently has **no production callers** (dead helper). Direction if revived: **Facts → constraint seeds**, never Constraints → Fact SoT.

### Interview authority direction (adopted for 3.2)

| Topic class | Write target | Notes |
| --- | --- | --- |
| Project site / logistics / occupied / hours / carry / access bands | **Constraint** | Canonical flat keys |
| WA override or WA-owned detail | **Fact** | Dotted keys; only when trigger justifies |
| Granular components / finishes / counts | **Not interview** | Scope Details |
| Scope existence | **Not interview** | Scope Discovery / Review |

**No bidirectional sync engine.** Semantic duplication is handled by **suppression and WA-override rules**, not by copying values between tables as SoT.

Owner decision: **D11**.

---

## 4. Placement recommendation

### Options assessed

| Option | Description | Verdict |
| --- | --- | --- |
| **A** | After Scope Details / before Quick Estimate | Clear gate but feels like another wizard page |
| **B** | Fully integrated progressive Assistant prompts only | Hard to discover; easy to miss P0s |
| **C** | Small interview pass immediately before estimate only | Late; rework risk after Details already answered |
| **D Hybrid (recommended)** | Progressive, non-mandatory Assistant card + optional pre-estimate “quick questions” batch | Best fit |

### Recommended: OPTION D — Hybrid progressive interview

1. **Progressive card** in Project Assistant after Work Areas are confirmed (and after Scope Review when ISD is on), running **alongside** Quality / Scope Details / Constraints — not replacing them.
2. Surfaces only **high-impact unknown** project/site/WA-override questions (small batches).
3. **Pre-estimate nudge** when readiness is `NEEDS IMPORTANT INFORMATION` or `READY WITH ASSUMPTIONS` with P0/P1 open — never a hard wall for P2/P3.
4. Site Constraints UI remains editable for explicit review; interview answers write the same keys so Constraints do not re-ask.

Owner decision: **D1**.

---

## 5. Dynamic question generation (MVP)

Prefer **deterministic templates + rules**. AI may rank/phrase/interpret later; AI must **not** invent commercial questions without a canonical Fact/Constraint target.

```
Known Facts
+ confirmed Work Areas
+ accepted Scope items
+ unanswered Scope Details (for suppress / escalate only)
+ known Constraints
+ calculator missingInfo (mapped to keys)
+ risk / relevance rules
        ↓
Candidate questions (from versioned registry)
        ↓
remove already-known (suppress_if_known)
remove duplicates (project answer suppresses WA clones)
evaluate relevance (WA type, scope flags, triggers, depends_on)
rank by priority × commercial/estimate impact
        ↓
present small batch (typically 3–6)
```

### Generation principles

- Deterministic candidate set for MVP (3.2.1).
- No AI call per answer.
- Recompute on **batch save** and **presentation / stage boundaries** (not every keystroke). Local UI may filter before save.
- Every candidate has constraint key or `fact_key` + `question_key`.
- Clarification-only / free-text AI prompts are out of scope unless mapped.

Owner decisions: **D6**, **D14**.

---

## 6. Multi–Work Area behaviour

Commercial Fitout demonstrated 7+ WAs with repeated access questions.

Rules:

1. **Project-wide answers suppress WA duplicates** for the same semantic topic (access, carry, occupied, hours, parking, protection defaults).
2. WA question appears only if:
   - trigger says WA may differ; **and**
   - no project answer; **or**
   - user marked “differs by area”; **or**
   - scope flags extreme conditions (e.g. demolition upper-floor stripout).
3. Group presentation by domain, not by every WA.
4. Never ask “What is access like?” separately for Demolition, Flooring, and Walls when project access is known.

**Implementation note (fixed in 3.2.2):** live loaders use `constraints`; occupied suppression uses `occupied_site`. See `docs/architecture/STAGE_3_2_2_CORE_SITE_INTERVIEW_ARCHITECTURE.md`.

Owner decision: **D8**.

---

## 7. Authority hierarchy & write operations

### Precedence (aligned with `FACT_SOURCE_PRECEDENCE` in `domain-ownership.ts`)

```
explicit user interview / UI answer     (source=user)           100
> ai_extracted                                                    60
> default                                                         40
> assumption                                                      30
> system                                                          20
> derived                                                         10
```

`system` is a reserved tier used mainly for display/prepopulation mapping today; interview must not invent a tier above user.

### Operations

| Op | When |
| --- | --- |
| **create** | Key unknown; interview answer provided |
| **update** | Existing non-user source; or user confirms replace |
| **conflict** | Interview answer differs from existing `source=user` → surface conflict; do not silent overwrite |
| **supersede** | User confirms new answer replaces prior user value |
| **preserve** | Skip / Not sure without assumption → leave unknown |
| **assume** | “Use reasonable assumption” → write assumption value + assumption record linkage |

Interview never writes rates, quality formulas, or quote money.

Owner decisions: **D7**, **D12**, **D13**.

---

## 8. Assumption model (reconciled)

When user selects **Use reasonable assumption**:

| Captured | Purpose |
| --- | --- |
| question_key | What was skipped |
| assumed_value | What Quotr used |
| reason | Why reasonable for this job class |
| impact | estimate confidence / readiness class |
| reversible | User can later answer and supersede |

### Invalidation triggers

1. User answers same semantic key (`source=user`).
2. Parent / trigger condition becomes false (conditional child irrelevant).
3. Owning WA excluded or removed from confirmed set.
4. Project-wide answer now suppresses the WA-scoped assumption topic.
5. Scope item exclusion removes the trigger for the question.

Invalidation marks estimate stale and removes the assumption from readiness “cleared by assumption” sets. Prefer MVP storage via `source=assumption` on Fact/Constraint + estimate assumption presentation; dedicated table only if Owner approves later.

Owner decisions: **D5**, **D13** (conflict), **D16** (provenance store).

---

## 9. Estimate readiness (summary)

See `QUOTR_ESTIMATE_READINESS_MODEL.md`.

| State | Meaning |
| --- | --- |
| READY | No P0 unknowns; estimate sensible |
| READY WITH ASSUMPTIONS | P0 cleared by explicit assumptions or safe defaults |
| NEEDS IMPORTANT INFORMATION | Open P0 (or critical P1 per owner policy) |

**Derived view only** — does not replace stage machine, company setup readiness, calculator `missingInfo`, or QE attention. Soft-block may overlay generate UX while stage remains `ready_to_estimate`.

Owner decisions: **D3**, and readiness authority notes in reconciliation audit.

---

## 10. Company DNA boundary

| Layer | Example |
| --- | --- |
| Builder Interview (project) | “This project has 25m manual carry.” |
| Company DNA (company) | “This contractor prices carpenter labour at X / uses Y productivity.” |
| Calibration (company evidence) | “This contractor expected a 15m² deck to cost Z.” |

3.2 prepares DNA by structured keys + provenance + assumption records + clear project vs company namespaces.

3.2 does **not** implement DNA consumption or silent rate mutation. **Company DNA remains Not Started.**

---

## 11. Performance architecture

Coordinate with **PERF-FUTURE-01** (parallel track; not a blocker for starting 3.2.1 after owner decisions).

| Requirement | Design |
| --- | --- |
| Candidate generation | Deterministic; in-memory from loaded project snapshot |
| Per-answer AI | Forbidden in MVP |
| Writes | Batch Fact/Constraint upserts per answer batch |
| UI | Optimistic local question list update; no full Assistant remount |
| Refresh | Avoid unnecessary `router.refresh`; targeted revalidation only |
| Recompute | After batch save + presentation boundaries |

Owner decision: **D9**.

---

## 12. Conditional-child handling

- Registry `depends_on` / triggers evaluated at candidate generation (same spirit as `shouldHideConditionalQuestion`).
- No DB `parent_id` required for MVP.
- Irrelevant children omitted from active batches.
- Prior answers under invalidated parents: suppress for candidacy; do not history-wipe in MVP.

---

## 13. Provenance / schema stance

| Layer | MVP approach |
| --- | --- |
| Candidate engine (3.2.1) | Pure functions; ephemeral candidates; versioned code registry |
| Answer persistence (later) | Existing `constraints` / `project_facts` + `source` |
| Assumptions | Prefer `source=assumption` + estimate assumption fields |
| New tables / migrations | Default **none**; Owner-gated only |

Constraint taxonomy expansions update `RESERVED_CONSTRAINT_KEYS` + templates — **no DB migration** required (`constraints.key` is free text).

Owner decision: **D4**, **D16**.

---

## 14. Mobile architecture

Builders stand on site.

| Requirement | Design |
| --- | --- |
| Thumb-friendly | Large tap targets; one-tap option chips |
| Numeric | `inputMode` numeric where quantities |
| Typing | Prefer select / boolean / short number |
| Batches | 3–6 questions max per pass |
| Progress | “4 questions that improve this estimate” — not a 30-step wizard |
| Save state | Saving / Saved / Error obvious |
| Interruption-safe | Persist each batch; reopen resumes remaining candidates |

Align with `docs/architecture/QUOTR_ASSISTANT_RESPONSIVE_AND_MOBILE_PRESENTATION.md`.

---

## 15. UX sketch (contractor-native)

Copy pattern:

> Quotr has **4 quick questions** that will improve this estimate.

Grouped:

**SITE**  
- How difficult is site access?  
- Distance from drop-off / waste carting?

**DEMOLITION**  
- Are services isolated before strip-out?

Actions per question (where allowed):

- Answer  
- Not sure  
- Use reasonable assumption  
- Skip for now  

Why line (only when useful, short):

> Material carry distance affects labour and waste handling.

---

## 16. Worked examples (summary)

Full detail lives in the plan doc §Examples. Sketch:

### A. Deck

Known: dimensions, removal, no balustrade, access moderate, carry 10–30m from Analyse/Constraints.  
Ask: rarely anything P0 if access+carry known; maybe substructure if missing.  
Suppress: WA access clones; paint brand; screw spacing.

### B. Bathroom renovation

Known: area, renovation type, waterproofing flag.  
Ask: occupied site; services; hazmat if older dwelling unknown; carry if demolition.  
Suppress: tile brand; screw centres.

### C. Commercial Fitout

Known: multi-WA confirmed; many Scope Details.  
Ask: project access, carry, floor level, occupied/hours, loading **once**.  
Suppress: per-WA access for walls/floors/ceilings/painting.  
WA-only: demolition services/hazmat if unknown.

---

## 17. Security implications (planning)

- Org-scoped writes only (existing RLS patterns).
- No client-side authority for Fact writes.
- Do not send secrets / unrelated org data to any future AI ranking.
- Interview answers are project evidence — treat like Facts for access control.
- No new public endpoints without authz review in implementation batches.
- Allowlist question → fact/constraint keys (no arbitrary key writes).

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md` |
| Implementation | **3.2.2 Complete Local** (Project Conditions ASK); **3.2.3 Not Started** |
| Reconciliation | Stage 3.2.0-R1 |
| Owner decisions | D1–D16 OWNER APPROVED |

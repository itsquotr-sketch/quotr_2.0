# Stage 3.2.1 — Candidate Engine Architecture

**Status:** Complete — Local  
**Date:** 2026-08-12  
**Module:** `lib/builder-interview/`  
**Verify:** `scripts/verify-stage-3-2-1-builder-interview-candidate-engine.ts`  

---

## 1. Purpose

Pure, deterministic Builder Interview **candidate + readiness** engine that later UI (3.2.2+) can consume.

Builder Interview owns **no** persistence domain. It is an orchestration / ranking / ask layer over:

- Site Constraints (project/site values)
- Facts (genuine WA overrides)
- Scope Details / Scope Review (DEFER / FLAG)

---

## 2. Public API

```ts
buildBuilderInterviewCandidates(input: BuilderInterviewInput): BuilderInterviewResult
```

Result:

| Field | Meaning |
| --- | --- |
| `candidates` | Ordered ASK candidates |
| `suppressed` | Diagnostics for non-ASK / suppressed entries |
| `readiness` | READY / READY_WITH_ASSUMPTIONS / NEEDS_IMPORTANT_INFORMATION + soft-block flags |
| `diagnostics` | Counts, assumption classifications, recompute note |

**Guarantees:** same input → same ordered output. No DB, AI, server, router, env behaviour.

---

## 3. Module map

| File | Role |
| --- | --- |
| `types.ts` | Input/output/registry contracts |
| `authority.ts` | Reuses `FACT_SOURCE_PRECEDENCE` / `factSourcePrecedence`; conflict modelling |
| `registry.ts` | MVP question registry v`3.2.1.0` |
| `domain-rules/triggers.ts` | Triggers, local override predicates, parent reads |
| `suppression.ts` | Semantic topic → project constraint mapping |
| `ranking.ts` | P0→P3 then domain then registry order |
| `assumptions.ts` | Assumption status classification (no mutation) |
| `readiness.ts` | Quick Estimate readiness derivation |
| `candidate-engine.ts` | Orchestration |
| `fixtures/*` | Deck / Bathroom / Fitout |
| `index.ts` | Public exports |

---

## 4. Ownership contract

| Layer | Owns |
| --- | --- |
| Project capture | Brief / notes |
| Analyse Job | Extracted evidence / WA recommendations |
| Scope Review | Include / exclude |
| Scope Details | Granular component Facts |
| Site Constraints | Canonical project-wide site values |
| Builder Interview | Ask/rank/readiness only |
| Rates / DNA / calibration | Out of stage |

Write direction (later batches): PROJECT/SITE → Constraint; WA override → Fact; explicit assume → assumption path. **No bidirectional sync.**

---

## 5. Semantic topics & dedup

Stable `semanticTopic` ids (e.g. `site.access`, `site.carry`) map project constraints and WA clones. Project-known topic suppresses WA clones unless an **explicit** override predicate passes (e.g. demolition floor ≠ project floor).

Canonical naming: `occupied_site` (never `site_occupied`). Input contract assumes live `constraints` table (never `project_constraints`).

---

## 6. Ask policy

| Policy | Behaviour |
| --- | --- |
| ASK | May appear in `candidates` |
| ASSUME / BENCHMARK | Suppressed with policy code (not presented) |
| DEFER | Scope Details ownership |
| FLAG | Scope Review / existence |

“Not sure” ≠ “Use reasonable assumption”.

---

## 7. Priority vs impact vs answerability

Separated fields: `priority` (urgency), `impact.estimate|scope|confidence`, `answerability` (`ON_SITE` | `REQUIRES_MEASUREMENT` | `REQUIRES_EXPERT` | `NOT_APPLICABLE`).

---

## 8. Readiness (Quick Estimate only)

Derived view — does not replace setup/pricing/quote readiness.

| State | Rule |
| --- | --- |
| NEEDS_IMPORTANT_INFORMATION | Unresolved applicable P0 ASK |
| READY_WITH_ASSUMPTIONS | No blocking P0; current assumptions present |
| READY | Otherwise |

`softBlockQuickEstimate` / `canGenerateQuickEstimate` exposed for 3.2.4 — **no live generate changes in 3.2.1**.

---

## 9. Recompute (caller-controlled)

Boundaries (D15): initial load; batch save; relevant WA/scope/constraint change; presentation/stage boundary. Not per keystroke. No caching in 3.2.1.

---

## 10. Legacy note

`inferConstraintsFromFacts` / `buildScopeDrivenConstraints` remain **dead/unconsumed**. Not deleted in 3.2.1. Not used as sync SoT.

---

## 11. Security

Pure domain logic: no Supabase, service-role, auth, org_id, writes, RLS, migrations.

Future write security (3.2.2+): org-scoped server actions, allowlisted keys, conflict confirm before user-vs-user overwrite.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md` |
| Batch | 3.2.1 |
| Next | 3.2.2 ask-layer wiring (not started) |

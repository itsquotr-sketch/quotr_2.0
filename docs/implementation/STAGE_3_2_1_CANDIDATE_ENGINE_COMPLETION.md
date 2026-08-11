# Stage 3.2.1 — Candidate Engine Completion

**Status:** Complete — Local  
**Date:** 2026-08-12  
**Owner decisions:** D1–D16 **OWNER APPROVED**  
**Verify:** `npx tsx scripts/verify-stage-3-2-1-builder-interview-candidate-engine.ts` (53 passed)

---

## Delivered

- Pure `lib/builder-interview/` candidate + readiness engine
- MVP registry: site logistics, demo/reno risk, Deck/Bathroom/Fitout packs, DEFER/FLAG sentinels
- Fixtures: Deck, Bathroom, Commercial Fitout (7 WA)
- Semantic topic dedup + explicit override predicates
- Authority via canonical `FACT_SOURCE_PRECEDENCE` (no second table)
- Conflict modelling without writes
- Assumption classification without mutation
- Performance baseline recorded
- Docs + status map updated

## Explicitly not delivered

- Builder Interview UI
- Migrations / `interview_answers`
- Fact/Constraint writes
- Soft-block wired into Generate Estimate action
- Taxonomy expansion (stairs/lift/…)
- Production Scope Discovery enablement
- Company DNA
- 3.2.2

## Fixture outcomes (summary)

| Fixture | Result |
| --- | --- |
| Deck (access+carry known) | Access/carry suppressed; balustrade FLAG; risk asks may remain |
| Bathroom | Occupied/access suppress when known; waterproofing DEFER |
| Fitout logistics known | 0 access ASK clones across 7 WAs |
| Fitout logistics unknown | `site_access` once; 0 WA access clones |

## inferConstraintsFromFacts

Confirmed **dead/unconsumed** (`buildScopeDrivenConstraints` has no production callers). Left in place; not revived as sync.

## Suppression naming defects

Engine uses canonical `constraints` / `occupied_site`. Does not reproduce `project_constraints` or `site_occupied`. Live persistence fixes deferred to 3.2.2.

## Next

Stage **3.2.2** — Core project/site constraint interview ask-layer wiring (Owner-gated start).

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_2_1_CANDIDATE_ENGINE_COMPLETION.md` |

# Stage 3.1B.4A — Discovery Orchestration Completion

**Status:** Complete — Local  
**Date:** 2026-08-05  
**Module:** `lib/scope-discovery/orchestration/`  
**Verify:** `scripts/verify-stage-3-1b4a-discovery-orchestration.ts` (59/59)  
**Production adoption:** **None**  
**Analyse Job:** **Unchanged**  
**Persistence migration:** **Proposed, Not Approved**  
**UI:** **Not Started**  

---

## 1. Objective

Deliver a pure/injected orchestration engine that validates discovery requests, builds deterministic source snapshots, evaluates the catalogue, optionally invokes an injected contextual provider, merges via 3.1B.1 authority, applies prior decisions, and returns an immutable `ScopeDiscoveryRunResult` — without persistence, UI, or Analyse Job wiring.

---

## 2. Orchestration architecture

```
lib/scope-discovery/orchestration/
  version.ts           # scope-discovery-orchestration/v1
  errors.ts            # controlled failure codes
  types.ts             # request, snapshot, run result, triggers
  validation.ts        # request normalisation / bounds
  source-snapshot.ts   # snapshot + fingerprint (idempotency aid)
  idempotency.ts       # EXECUTE / REUSE / RETRY / SUPERSEDE / REJECT_IN_FLIGHT
  stale-analysis.ts    # prior vs current run comparison
  merge-results.ts     # prior decisions + 3.1B.1 merge wrapper
  result.ts            # immutable result builder
  execute.ts           # pipeline
  index.ts
```

No React, Supabase, server actions, `process.env`, or Anthropic SDK.

---

## 3. Request contract

`ScopeDiscoveryRequest` includes project/org ids, requested run id, trigger, brief (+ revision), notes, accepted work areas, authoritative facts/constraints, prior suggestions/decisions/proposals/rejections, contract/catalogue/prompt versions, region, analysis objective, `providerEnabled`, `explicitUserInitiation`, `forceNewRun`, requester metadata, and caller-supplied `priorRunSummaries`.

Triggers: `INITIAL_ANALYSE_JOB`, `USER_REQUESTED_RERUN`, `PROJECT_BRIEF_CHANGED`, `SITE_NOTES_CHANGED`, `FACTS_CHANGED`, `CONSTRAINTS_CHANGED`, `WORK_AREAS_CHANGED`.

Paid provider calls require **all** of: `providerEnabled`, `explicitUserInitiation`, and an explicit-user trigger family (OCD-ISD-06/07/08). Source-change triggers never authorise provider alone.

---

## 4. Source snapshot

`ScopeDiscoverySourceSnapshot` captures material revisions for brief, notes, facts, constraints, work areas, plus contract/catalogue/prompt versions, region, and analysis objective.

`computeSourceFingerprint` is an **idempotency aid, not a security hash**. Provider/model metadata is excluded from the project-source fingerprint. Formatting-only brief whitespace normalises safely when revision is unchanged.

---

## 5. Idempotency

Key = project + trigger family + source fingerprint + contract + catalogue + prompt + analysis objective.

Actions: `EXECUTE_NEW_RUN`, `REUSE_IDENTICAL_COMPLETED_RUN`, `RETRY_FAILED_RUN`, `SUPERSEDE_STALE_RUN`, `REJECT_DUPLICATE_IN_FLIGHT`.

`forceNewRun` + `USER_REQUESTED_RERUN` may execute a new run and record supersede linkage without rewriting history.

---

## 6. Run result

`ScopeDiscoveryRunResult` includes run identity, status, snapshot/fingerprint/idempotency, versions, deterministic evaluation, contextual provider result, merged/primary/other/suppressed suggestions, conflicts, warnings, structured errors, decision explanations, provider flags, timing/tokens, reuse/supersede links.

Statuses: `VALIDATED`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED_*`, `REUSED`, `CANCELLED`.

---

## 7. Execution order

1. Validate request  
2. Build snapshot + fingerprint  
3. Idempotency decision (reuse / reject in-flight / continue)  
4. Deterministic catalogue evaluation  
5. Prior decision application  
6. Optional injected provider (once)  
7. Merge via `mergeScopeSuggestions`  
8. Final contract validation  
9. Immutable result  

---

## 8. Failure semantics

Controlled codes: `INVALID_REQUEST`, `INVALID_SOURCE_SNAPSHOT`, `DUPLICATE_IN_FLIGHT`, `DETERMINISTIC_EVALUATION_FAILED`, `PROVIDER_*`, `MERGE_FAILED`, `FINAL_CONTRACT_INVALID`, `CANCELLED`.

**ORCH-POL-01** (MVP, aligned with OCD-ISD-05 / OCD-ISD-15): deterministic success + provider failure → `COMPLETED_WITH_WARNINGS` with deterministic-only merged output. Formal OCD confirmation can be recorded in 3.1B.4B if desired.

Deterministic evaluation failure blocks the run. Merge/final-contract failure returns no unvalidated success payload. Raw provider errors are never user-facing.

---

## 9. Prior decision application

Accepted WAs suppress duplicates; accepted suggestions are not auto-staled; rejections suppress until material source change; provider-only change does not reset rejection; modified corrections retained as provenance (no DNA); stale/superseded not revived. Explanations returned for future UI.

---

## 10. Deterministic/provider merge

Uses Stage 3.1B.1 `mergeScopeSuggestions` only — no competing merge algorithm.

---

## 11. Stale-run evaluation

`evaluateStaleRun` → `CURRENT` | `STALE_MATERIAL_CHANGE` | `CURRENT_PROVIDER_CHANGED_ONLY` | `CURRENT_FORMATTING_CHANGE_ONLY` | `UNKNOWN_VERSION` | `CANNOT_COMPARE`.

Stale means “rerun analysis”, not “delete accepted work”.

---

## 12. Cancellation/timeout

`ExecutionContext` supports `abortSignal`, `providerTimeoutMs`, `callerRequestId`, injected `now`. Cancellation/timeout → `CANCELLED`; no unbounded retry; no mutation.

---

## 13. Immutability

Request/prior records not mutated; results deep-frozen.

---

## 14. Files changed

**Created:** `lib/scope-discovery/orchestration/*`, verify script, this completion doc, `docs/specifications/SCOPE_DISCOVERY_PERSISTENCE_PROPOSAL.md`.

**Updated:** plan, backlog, roadmap, MVP hardening guide.

---

## 15. Verification results

`npx tsx scripts/verify-stage-3-1b4a-discovery-orchestration.ts` — all checks pass.

Full regression (tsc, lint, build, 3.1A, R1, 3.1D, 3.1B.1–3.1B.3, 3.1B.4A, 2B.10) required and passing for this batch.

---

## 16. Persistence proposal summary

Logical tables for runs, suggestions, decisions; RLS; idempotency uniqueness; append-only decisions; immutable proposal payloads; no commercial/DNA/attachment content. **Proposed, Not Approved** — no SQL written.

---

## 17. Known limitations

- No persistence / locks (caller supplies prior run summaries).  
- No production wiring or UI.  
- ORCH-POL-01 is an implementation rule pending optional formal OCD id.  
- Live provider unused unless a future batch injects it.

---

## 18. Confirmation — no production adoption

No Analyse Job change, migrations, database tables, UI, server actions, commercial-formula, Company DNA, or Builder Interview work.

---

## 19. Recommendation for 3.1B.4B

**Ready Pending Persistence Owner Approval:**

- Review/approve persistence proposal (or choose session-only orchestration).  
- If approved: migrations + RLS + org isolation verification.  
- Wire orchestrator behind explicit user trigger without changing Analyse Job behaviour until gated.  
- Do not begin accept/reject UI until 3.1B.5.

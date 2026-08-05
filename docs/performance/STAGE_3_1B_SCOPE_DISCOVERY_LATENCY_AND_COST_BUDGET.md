# Stage 3.1B — Scope Discovery Latency and Cost Budget

**Status:** Planning targets (Stage 3.1B.0) — **not measured product SLOs**  
**Date:** 2026-08-05  
**Note:** Do not claim measured figures unless measured. Values below are **design budgets / targets**.

---

## 1. Purpose

Set explicit UX, provider, and cost expectations for Intelligent Scope Discovery so implementation batches do not invent unbounded retries or silent duplicate analysis.

---

## 2. Latency classes

| Class | Meaning |
| --- | --- |
| UX feedback latency | Time until UI shows progress (spinner / “Analysing…”) |
| Provider latency | Anthropic (or future provider) round-trip |
| Database latency | Auth, reads, suggestion/run writes, revalidation |
| Document-processing latency | Future photos/OCR/PDF — out of MVP path |
| Total perceived latency | Click → actionable suggestion list or clear empty/failure state |

---

## 3. Target budgets (design)

| Metric | Target | Notes |
| --- | --- | --- |
| Initial UX feedback | ≤ 200 ms | Client lock + pending state; no waiting on provider for feedback |
| Complete analysis (p50 design) | ≤ 8 s | Single structured extraction comparable to current Analyse Job |
| Complete analysis (p95 design) | ≤ 20 s | Includes one transport retry |
| Hard timeout | 45 s | Fail with safe message; no infinite spinner |
| Deterministic catalogue pass | ≤ 100 ms | Pure in-process |
| DB orchestration (ex-provider) | ≤ 500 ms design | Ownership checks + writes |

**Current product:** Analyse Job latency is **unmeasured** in telemetry; dominated by one Anthropic call. Treat existing behaviour as baseline to measure in 3.1B.8.

---

## 4. Provider call budget

| Rule | Budget |
| --- | --- |
| Maximum provider calls per user-triggered run | **1** primary (+ **1** parse-repair retry only if structured output fails) |
| Transport retries | Up to **3** total attempts (existing `withAnthropicRetry` pattern) — count toward cost |
| Automatic background re-analysis | **Off** by default (owner gate) |
| Parallel multi-model fan-out | **Forbidden** in MVP |
| Streaming | Optional later; not required for MVP contract |

---

## 5. Cost controls

| Control | Intent |
| --- | --- |
| Explicit user trigger | Preferred MVP — user controls API cost |
| Idempotency key | Same trigger + source snapshot hash → reuse prior successful run; **no duplicate provider call** |
| Pending proposal gate | Keep: block concurrent analyse while review pending |
| Input size caps | Brief already ≤ 5000 chars; define note batch caps in implementation |
| Token/cost metadata | Record when API provides usage; never log secrets or full customer dumps |
| Provider fallback | Owner gate — fail closed with clear message vs secondary provider |

---

## 6. Progress and cancellation

| State | Meaning |
| --- | --- |
| `queued` | Accepted request; not yet calling provider |
| `running_deterministic` | Catalogue / duplicate checks |
| `running_provider` | Waiting on model |
| `validating` | Schema coerce/validate |
| `persisting` | Writing run/suggestions |
| `ready` | Suggestions available |
| `failed` | Safe error |
| `cancelled` | User cancelled before provider completion where practical |

**Cancellation:** Best-effort; if provider already completed, persist as run then allow dismiss. Do not leave orphaned partial domain writes (suggestions-only until accept).

---

## 7. Fallback behaviour

1. Provider timeout / 5xx → retry per budget → fail with user-safe message.
2. Invalid JSON → one repair retry → fail.
3. Empty suggestions → `empty` run status; show deterministic catalogue results if any.
4. Partial deterministic + failed AI → show deterministic missing-scope; mark AI portion failed.
5. **Never** invent Work Areas or Facts to “fill” a failed run.

---

## 8. Caching / idempotent reruns

- Cache key: `orgId + projectId + trigger + snapshotHash + promptContractVersion + model`.
- Hit: return prior run + suggestions; mark UX as “up to date”.
- Miss: new run.
- Source change → new hash → new run; prior `PROPOSED` → `STALE`/`SUPERSEDED`.

---

## 9. Measurement plan (3.1B.8)

Measure before claiming SLOs:

- Client click → first paint of progress;
- Server start → provider end;
- Provider end → DB commit;
- Total to interactive list;
- Tokens / estimated cost per run;
- Duplicate-call rate;
- Failure/retry rates.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/performance/STAGE_3_1B_SCOPE_DISCOVERY_LATENCY_AND_COST_BUDGET.md` |
| Created | 2026-08-05 |

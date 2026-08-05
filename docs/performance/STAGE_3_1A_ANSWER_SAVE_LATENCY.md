# Stage 3.1A — Answer Save Latency

**Status:** Documented with code-path baseline  
**Date:** 2026-08-05  
**Scope:** Work-area / missing-details answer persistence  

---

## Baseline path (before Stage 3.1A)

```
UI edit
  → 700ms debounce autosave
  → payload includes null unanswered values
  → Zod reject → "Invalid answers." (intermittent fail)
  → OR sequential per-answer:
       UPDATE questions
       SELECT project_facts
       UPDATE/INSERT project_facts
  → persistDerivedFactsForProject
  → ensureMissingDetailsQuestionBlock → persistDerivedFacts again
  → markEstimateStale
  → revalidatePath(/app/dashboard) + revalidatePath(project)
  → router.refresh() → full getAssistantState
```

### Identified bottlenecks

| # | Bottleneck | Severity | Evidence |
| --- | --- | --- | --- |
| 1 | Null/empty answers in payload → Zod failure | High (correctness) | `ScopeReviewMissingSection` + `saveQuestionBlockAnswers` schema |
| 2 | `lastSavedRef` set before success → no retry | High (correctness) | Autosave effect |
| 3 | Double `persistDerivedFactsForProject` | Medium (latency) | save then ensure |
| 4 | Dashboard `revalidatePath` on every answer | Medium (latency) | `revalidateAssistantPaths` |
| 5 | Sequential per-answer DB round-trips | Medium (latency) | Loop in `saveQuestionBlockAnswers` |
| 6 | Full RSC refresh remount | Medium (perceived) | `router.refresh` + Scope Review key |

Wall-clock timings were not captured against a live Preview project in this batch; claims below are path-based, not measured ms improvements.

---

## Changes made

1. **Filter persistable answers** (client + server) — omit null/empty.
2. **Autosave only when** at least one non-empty value and requireds filled.
3. **Last-successful-save key** updated only after `saved` status.
4. **Latest-write guard** discards stale overlapping responses.
5. **Visible statuses:** Saving / Saved / Error — retry.
6. **Skip second derived-facts persist** inside ensure when caller already persisted (`skipDerivedPersist`).
7. **Targeted revalidation** — project path only for answer saves (no dashboard).
8. Safe user-facing error strings (no raw DB messages).

---

## Expected improvement

| Concern | Expectation |
| --- | --- |
| Failed “Invalid answers” from null payload | Eliminated for normal optional-partial saves |
| Stuck autosave after failure | Retryable via new edit or Save |
| Derived-facts duplicate write | One write per save instead of two |
| Dashboard revalidation cost | Removed from answer-save path |
| Perceived latency | Still includes sequential writes + refresh; improved reliability more than raw ms |

Do **not** claim a specific percentage latency reduction without Preview instrumentation.

---

## Verification method

1. Automated: `npx tsx scripts/verify-stage-3-1a-product-stabilisation.ts` (filter, guard, save-status).
2. Manual Preview: rapid answer changes; confirm final value persists; observe Saving→Saved; force fail (offline) → Error not Saved.
3. Optional future: wrap `saveQuestionBlockAnswers` with server timing logs behind a debug flag.

---

## Remaining limitations

- Per-answer sequential DB updates remain (batching would be a larger change).
- `router.refresh()` still reloads assistant RSC state (needed for missing-item correctness).
- No optimistic merge of `scopeReview.missingItems` yet.
- No caching layer introduced (stale commercial/question risk avoided).

---

## Compatibility

- No commercial arithmetic changes.
- No schema migrations.
- Organisation ownership and validation preserved.

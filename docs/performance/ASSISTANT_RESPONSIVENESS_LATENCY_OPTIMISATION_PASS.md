# Assistant Responsiveness & Latency Optimisation Pass

**Status:** Planned — dedicated measured optimisation stage after Stage 3.1B closure  
**ID:** PERF-FUTURE-01  
**Severity:** Not a Stage 3.1B release blocker  
**Created:** 2026-08-11 (Owner Fitout feedback during 7F-R6-R4)  
**3.1B status:** Closed 2026-08-11 — this pass remains **Planned only** (not started)

---

## Intent

A dedicated measured optimisation stage **after** Stage 3.1B Owner Preview closure.

Owner notes the assistant is materially faster after R5/R6 fixes, with remaining minor delays around saves, refresh, and brief stale UI. Do **not** expand R6-R4 into this work.

No SLO claims yet.

---

## Measure and optimise (later)

- Analyse Job latency
- Scope Discovery latency
- Work Area confirm
- Fact / question saves
- Constraint saves
- Scope Details state reconciliation
- Quick Estimate generation
- `router.refresh` / RSC remount cost
- Duplicate DB queries / revalidation
- UI flicker / stale card reappearance
- Perceived latency / loading acknowledgements

---

## Known architectural causes (from R5 / R6)

| Area | Observed cause |
| --- | --- |
| Work Area confirm | Discovery previously awaited on confirm path (R5: project-only revalidate) |
| Question saves | Sequential Fact writes (R6: parallel commits); background `router.refresh` after Saved ack |
| Constraint edits | Blocking refresh remount (R6: `startTransition`) |
| Scope Details | Empty orphan blocks + bulk insert failures (R6-R1); accordion live-completeness collapse (R6-R3 sticky) |
| Attention / QE | Stale clarification inflation from needs-detail (R5/R6); Review copy without targets (R6-R4) |
| Estimate generate | Duplicate refresh / double-click races (R5 locks + project revalidate) |

Use these as the starting measurement backlog — not as unfinished 3.1B blockers.

### Stage 3.2.2 / R1 Owner evidence (Analyse → Work Areas)

Owner Deck Preview: Analyse Job feels slow; additional delay before Work Areas appear after analysis completes.

Likely split:

| Segment | Notes |
| --- | --- |
| Provider | Anthropic Analyse Job wall time |
| Persistence | Fact inserts + constraint upserts (R1: constraint writes parallelised) |
| Revalidation | RSC remount (R1: brief seed uses project-scoped revalidate) |
| UI transition | Client stage unlock / Work Area card paint |

R1 low-risk only. Full measured pass remains **PERF-FUTURE-01**.

See `docs/audits/STAGE_3_2_2_R1_DECK_OWNER_PREVIEW_AUDIT.md`.

### Stage 3.2.2 instrumentation (observational)

Preview marks added (metadata only — no answer payloads):

- `builder_interview_load`
- `builder_interview_candidate_build`
- `builder_interview_batch_save_ack`
- `builder_interview_batch_save_complete`
- `builder_interview_recompute`

See `docs/performance/STAGE_3_2_2_CORE_SITE_INTERVIEW_PERFORMANCE.md`.

Batch Project Conditions save is one server round-trip; candidate recompute once per batch. PERF-FUTURE-01 remains **Planned**.

### Stage 3.2.2-R2 Owner evidence (margin + completed-setup UX)

Owner Deck R1 retest: margin change showed large delay before sell/GP updated.

| Segment | Notes |
| --- | --- |
| Client | Spinner-only until refresh completed |
| Server action | `updateEstimateMargin` (DB write + `revalidatePath`) |
| Primary delay | Waiting on `router.refresh` / RSC remount before figures painted |
| R2 low-risk | Pending overlay from shared triad + authoritative `marginTotals` return; refresh in `startTransition`; Saving→Saved |

Marks: `margin_save_ack`, `margin_save_complete`.

Deeper remount elimination / Analyse Job work remains **PERF-FUTURE-01**.

See `docs/audits/STAGE_3_2_2_R2_UX_MARGIN_AUDIT.md`.

### Stage 3.2.2-R3 presentation findings

Completed-estimate layout derives from already-loaded Assistant state (attention items, setup summaries). No additional DB queries or estimate reloads introduced for the disclosure/strip. Residual Analyse Job / RSC remount work remains **PERF-FUTURE-01**.

### Stage 3.2.2-R4 presentation findings

Richer Estimate Review overview + ready-to-generate one-shot scroll/expand reuse already-loaded Assistant state (`buildEstimateReviewCompactOverview`). No extra estimate fetch or DB query for the summary. One-shot readiness latch prevents scroll loops. Residual Analyse Job / RSC remount work remains **PERF-FUTURE-01**.

### Stage 3.2.2-R5 presentation findings

Disclosure toggle / mobile density / Scope Review copy / Estimate details collapse are presentation-only. No additional DB queries or estimate fetches. Residual Analyse Job / RSC remount work remains **PERF-FUTURE-01**.

---

## Out of scope for Stage 3.1B

- Commercial formula changes
- Production Scope Discovery enablement
- Stage 3.2 (except observational BI / margin marks above)
- Company DNA

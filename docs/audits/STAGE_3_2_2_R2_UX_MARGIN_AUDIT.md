# Stage 3.2.2-R2 — UX / Margin Audit Notes

**Status:** Complete Local evidence for Owner Preview  
**Companion:** `docs/implementation/STAGE_3_2_2_R2_UX_MARGIN_RESPONSIVENESS.md`

## Margin path (before → after)

| Step | Before | After |
| --- | --- | --- |
| Client event | MarginEditControl Save | Same + lock |
| Pending UI | Spinner only | Pending sell/GP via shared triad |
| Server action | `updateEstimateMargin` | Same + returns `marginTotals` |
| DB write | line items + estimate header | Unchanged |
| Revalidate | `revalidatePath` project | Unchanged |
| Refresh | Blocking `router.refresh` before UI money update | Overlay first; refresh in `startTransition` |
| Authority | Server only (visible after remount) | Server authoritative; client pending then reconcile |

**Primary latency cause:** waiting on RSC remount after refresh before displaying new totals.

## Deferred to PERF-FUTURE-01

- Analyse Job / provider wall time
- Full RSC remount elimination for margin
- Broader save-feedback rewrite for all Assistant actions
- Duplicate query / revalidation audit beyond margin

## Access single-consume

Unchanged from R1: `getCombinedLabourAccessFactor` — Deck/Fence/Pergola must not compound project `site_access` with WA access.

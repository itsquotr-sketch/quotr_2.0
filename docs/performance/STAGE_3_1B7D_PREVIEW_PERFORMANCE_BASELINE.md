# Stage 3.1B.7D — Preview Performance Baseline

**Status:** Observational only — not SLOs  
**Date:** 2026-08-07  
**Helper:** `lib/assistant/preview-performance.ts`

---

## Scope

Lightweight local/Preview timing marks:

- `assistant_server_render`
- `analyse_job`
- `scope_review_run`
- `confirm_scope`
- `question_save_ack`
- `question_save_complete`
- `estimate_generate`
- `decision_action`

Logged as `[quotr-preview-perf] <mark>=<ms>ms` when instrumentation is enabled
(non-production or Preview-gated Scope Discovery).

## Never logged

- Full brief / notes
- Client data
- Raw evidence
- API keys
- Raw provider bodies

## How to capture

1. Run Assistant in local Preview with the feature flag as needed.
2. Perform each action once on a typical Deck project.
3. Record console timings into the Preview sign-off matrix.
4. Treat values as environment-specific observations.

## Initial wiring

| Mark | Wired in 7D |
| --- | --- |
| `estimate_generate` | AssistantShell generate / recalculate |
| Others | Helper ready for Preview instrumentation / future call sites |

## Notes

- No external analytics platform in this batch.
- No guaranteed latency budgets claimed here (see ISD-007 for future measurement).
- Backend behaviour unchanged — perceived latency improvements are UI acknowledgement and stable panels only.

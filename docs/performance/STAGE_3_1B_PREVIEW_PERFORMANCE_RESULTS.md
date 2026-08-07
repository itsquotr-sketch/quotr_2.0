# Stage 3.1B — Preview Performance Results

**Status:** Template ready — Owner samples Pending (capture during Stage 3.1B.7F E2E / 7F-R1 retest)  
**Date:** 2026-08-07  
**Related:** `docs/performance/STAGE_3_1B7D_PREVIEW_PERFORMANCE_BASELINE.md`  
**Helper:** `lib/assistant/preview-performance.ts`  
**E2E pack:** `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`  
**7F-R1 retest:** `docs/runbooks/STAGE_3_1B7FR1_DECK_PREVIEW_RETEST.md`  
**Per-project capture:** `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md`  

Observational only — **not** production SLOs.

### Local remediation notes (7F-R1)

| Observation | Change |
| --- | --- |
| Analyse / batch confirm paired `refreshResults` + `router.refresh` | After analyse and batch confirm: `refreshResults` only |
| Accept that creates a Work Area | Still calls `router.refresh` (required for WA remount) |
| Checklist toggles | Remain local state — no network |

Capture Preview timings during Deck retest for Automatic Scope Review, Edit scope open, toggle, Confirm scope.

---

## Environment

| Field | Value |
| --- | --- |
| Preview URL | `https://quotr-2-0-fv233e4c5-quotr1.vercel.app` |
| Branch alias | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` |
| Branch | `hardening/stage-2a-security` |
| Flag | Preview `SCOPE_DISCOVERY_ENABLED=true` (branch-scoped) after DEF-7E-001 fix |
| Production flag | Absent |

---

## Timing table (owner fill during 7F E2E)

Capture ≥3 observations where practical. Roll up medians here; keep per-project
detail in the 7F results file.

| Action | n | Median (ms) | Slowest (ms) | Notes |
| --- | ---: | ---: | ---: | --- |
| Initial Assistant load / render | | | | |
| Analyse Job | | | | |
| Automatic Scope Review | | | | |
| Confirm scope | | | | |
| Question save acknowledgement | | | | |
| Question save completion | | | | |
| Estimate generation | | | | |
| Scope decision Apply/Keep | | | | |

### Latency UX flags

| Condition | Observed? | Severity |
| --- | --- | --- |
| >1s with no visible acknowledgement | | Critical UX |
| Long Analyse Job / Scope Review without clear progress | | High UX |
| Long answer saves | | Medium / High |
| UI flicker or remount | | Medium |

Do not claim SLOs from these observations.

---

## Provider cost / token review (safe metadata only)

Do not log briefs, notes, client data, evidence, or raw provider bodies.
Capture during 7F E2E where metadata is visible.

| Metric | Observed | Notes |
| --- | --- | --- |
| Primary provider calls per discovery run | | |
| Repair frequency / attempts | | |
| Avg input tokens | | |
| Avg output tokens | | |
| Observed range | | |
| Duplicate-run reuse | | Idempotency reuse expected for identical sources |
| Stale rerun behaviour | | |
| Duplicate-call prevention | | `analysingLock` + in-flight reject |

### Cost waste checklist

- [ ] Duplicate provider calls  
- [ ] Oversized source payload  
- [ ] Unnecessary reruns  
- [ ] Repeated identical runs  

Model/provider changes require owner approval — not part of 7F.

---

## Local automation note

Stage 3.1B.7E / 7F verify scripts confirm instrumentation and gate docs exist;
they do not measure Preview wall-clock times.

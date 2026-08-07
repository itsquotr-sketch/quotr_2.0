# Stage 3.1B — Preview Performance Results

**Status:** Template + config audit — Owner samples Pending  
**Date:** 2026-08-07  
**Related:** `docs/performance/STAGE_3_1B7D_PREVIEW_PERFORMANCE_BASELINE.md`  
**Helper:** `lib/assistant/preview-performance.ts`  

Observational only — **not** production SLOs.

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

## Timing table (owner fill during E2E)

| Action | n | Median (ms) | Slowest (ms) | Notes |
| --- | ---: | ---: | ---: | --- |
| Initial Assistant render | | | | |
| Analyse Job | | | | |
| Scope Review run | | | | |
| Confirm scope | | | | |
| Question save acknowledgement | | | | |
| Question save completion | | | | |
| Estimate generation | | | | |
| Scope decision action | | | | |

### Latency flags

| Condition | Severity |
| --- | --- |
| UI acknowledgement > 1s with no feedback | Critical UX |
| Analyse Job / Scope Review materially above prior design target | Review |

---

## Provider cost / token review (safe metadata only)

Do not log briefs, notes, client data, evidence, or raw provider bodies.

| Metric | Observed | Notes |
| --- | --- | --- |
| Primary provider calls per discovery run | | |
| Repair frequency | | |
| Avg input tokens | | |
| Avg output tokens | | |
| Observed range | | |
| Rerun behaviour | | Idempotency reuse expected for identical sources |
| Duplicate-call prevention | | `analysingLock` + in-flight reject |

### Cost waste checklist

- [ ] Duplicate provider calls  
- [ ] Oversized source payload  
- [ ] Unnecessary reruns  
- [ ] Repeated identical runs  

Model/provider changes require owner approval — not part of 7E.

---

## Local automation note

Stage 3.1B.7E verify script confirms instrumentation and idempotency invariants exist; it does not measure Preview wall-clock times.

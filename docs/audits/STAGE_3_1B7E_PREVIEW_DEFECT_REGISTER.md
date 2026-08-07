# Stage 3.1B.7E — Preview Defect Register

**Status:** Open — Owner E2E Pending (Stage 3.1B.7F gate pack ready)  
**Date:** 2026-08-07  
**Branch:** `hardening/stage-2a-security`  
**Local HEAD (at audit):** `1b17804f3d036e414a1617f370ef09cd7ae99511`  
**Preview deployment (post-flag fix):** `https://quotr-2-0-fv233e4c5-quotr1.vercel.app`  
**Branch alias:** `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`  
**Production:** Disabled (`SCOPE_DISCOVERY_ENABLED` absent)  
**Owner E2E pack:** `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`  
**Owner E2E results:** `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md`

---

## Severity vocabulary

| Severity | Meaning |
| --- | --- |
| Critical | Release-blocking; data integrity, security, commercial mismatch, or feature unusable |
| High | Release-blocking if security/integrity; otherwise must fix before Production gate |
| Medium | Fix soon or document; not silent |
| Low | Backlog unless trivial |

---

## Defects

### DEF-7E-001 — Preview `SCOPE_DISCOVERY_ENABLED` empty (feature effectively off)

| Field | Value |
| --- | --- |
| Project | Preview configuration (all) |
| Severity | **Critical** |
| Observed | Vercel Preview env var present but value length 0 → `isScopeDiscoveryEnabled` = false |
| Expected | Preview `SCOPE_DISCOVERY_ENABLED=true` (exact) |
| Root cause | Empty encrypted env value on Preview |
| Fix status | **Fixed** — removed empty var; set `true` for Preview branch `hardening/stage-2a-security`; redeployed Preview `quotr-2-0-fv233e4c5-quotr1.vercel.app` |
| Verification | `vercel env ls` shows Preview (hardening/stage-2a-security); Production still absent |
| Release-blocking | Yes (was); **cleared after fix** |

### DEF-7E-002 — `SUPABASE_SERVICE_ROLE_KEY` not visible in Vercel Preview/Production env pull

| Field | Value |
| --- | --- |
| Project | Platform configuration |
| Severity | **Medium** |
| Observed | `vercel env pull` for Preview and Production shows service role key missing; local `.env.local` has it |
| Expected | Server paths that require service role are configured in the target environment, or confirmed unused |
| Root cause | Key may be unset on Vercel, or stored outside pullable env; signup/admin paths reference it |
| Fix status | **Deferred** — do not invent Production secrets in this batch; owner verify Vercel dashboard / auth flows |
| Verification | Pending owner |
| Release-blocking | No (unless Preview signup/admin fails in owner E2E) |

### DEF-7E-003 — Owner Deck / Bathroom / Fitout E2E not completed in this batch

| Field | Value |
| --- | --- |
| Project | A Deck / B Bathroom / C Commercial Fitout |
| Severity | **High** (process / release gate) |
| Observed | Automated local invariants + config audit completed; interactive Preview journey not executed by agent (auth + real projects). Stage 3.1B.7F prepared owner test pack + results template |
| Expected | Three representative Preview projects pass full journey checklist with scores, latency, provider, logs, commercial checks |
| Root cause | Requires authenticated Preview session and owner content |
| Fix status | **Open — Owner Pending** — execute `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`; capture in `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md` (also see 7D sign-off matrix) |
| Verification | Owner fills results; no Critical/High blockers; journeys PASS |
| Release-blocking | **Yes** until Owner Preview E2E complete |

### DEF-7E-004 — Constraint taxonomy gaps (airport / security / limited storage)

| Field | Value |
| --- | --- |
| Project | Constraint review (all) |
| Severity | **Low** |
| Observed | Supported keys include access, carry, floor level, occupied, working hours; airport/security/limited storage not first-class templates |
| Expected | Stage 3.2 Builder Interview / constraint taxonomy expansion (FEAT-003) |
| Root cause | Intentionally deferred taxonomy |
| Fix status | **Deferred to Stage 3.2** — record only |
| Verification | N/A this batch |
| Release-blocking | No |

### DEF-7E-005 — Performance / token observations not measured on live Preview sessions

| Field | Value |
| --- | --- |
| Project | Performance baseline |
| Severity | **Medium** |
| Observed | Helper + results template ready; no multi-sample Preview timings or token metadata captured in this batch. 7F E2E pack adds per-project latency + provider capture fields |
| Expected | Owner records median/slowest/sample size during E2E (≥3 obs where practical) |
| Root cause | Requires instrumented interactive runs |
| Fix status | **Open — Owner Pending** — fill during 7F E2E into `docs/performance/STAGE_3_1B_PREVIEW_PERFORMANCE_RESULTS.md` + per-project results |
| Verification | Owner fill-in |
| Release-blocking | No (unless Critical UX latency found during E2E) |

---

## Triage summary

| ID | Severity | Status | Release-blocking |
| --- | --- | --- | --- |
| DEF-7E-001 | Critical | Fixed | Cleared |
| DEF-7E-002 | Medium | Deferred | No* |
| DEF-7E-003 | High | Owner Pending | **Yes** |
| DEF-7E-004 | Low | Deferred Stage 3.2 | No |
| DEF-7E-005 | Medium | Owner Pending | No |
| DEF-7E-006 | Medium | Open — observe in 7F E2E | No |

\* Escalate if Preview auth/admin fails.

---

## E2E findings (Stage 3.1B.7F)

No live owner E2E findings were supplied during gate-pack preparation.
Add new DEF IDs below as journeys are executed.

| ID | Project | Severity | Observed | Expected | Root cause | Release blocker | Fix status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _(none yet)_ | | | | | | | | |

### Known local verify gap (not live E2E)

| ID | Project | Severity | Observed | Expected | Root cause | Release blocker | Fix status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-7E-006 | Constraint brief heuristics | Medium | `verify-stage-3-1b6r3` fails: sample “Narrow restricted access… occupied upper floor” does not emit `site_access` / `occupied_site` / `floor_level` via `extractConstraintsFromBrief` | Brief phrases map to supported templates where product intends pre-population | Heuristic phrases narrower than verify sample (`difficult access` works; `narrow`/`restricted access`/`occupied` not in brief extractor) | No until owner E2E shows missing constraints on Preview | **Open — observe in 7F E2E**; narrow fix only if live defect confirmed | Owner Site Constraints check on Deck/Bathroom/Fitout |

---

## Release gate recommendation

**Stage 3.1B — BLOCKED BY PREVIEW DEFECTS**

Blocker: **DEF-7E-003** (Owner Preview E2E incomplete — 7F pack ready, results pending).

After owner completes Deck / Bathroom / Fitout matrix with no Critical/High findings, re-evaluate for **READY FOR OWNER PRODUCTION GATE**.

Production remains **Disabled**. Do not begin Stage 3.2.

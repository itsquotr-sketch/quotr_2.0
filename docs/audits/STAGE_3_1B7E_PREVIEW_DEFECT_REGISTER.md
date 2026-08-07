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
| DEF-7E-006 | Medium | Fixed — Local (7F-R1); Preview retest Pending | No |

\* Escalate if Preview auth/admin fails.

---

## E2E findings (Stage 3.1B.7F / 7F-R1 / 7F-R2)

Owner Deck E2E defects remediated locally in **3.1B.7F-R1**, with final polish in
**3.1B.7F-R2**. Preview retest pending — see
`docs/runbooks/STAGE_3_1B7FR2_DECK_PREVIEW_RETEST.md`.

| ID | Project | Severity | Observed | Expected | Root cause | Release blocker | Fix status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-7F-001 | Deck | Critical | False Scope Review stale after Scope Details | CURRENT for DETAIL_ONLY / ordinary constraints | Snapshot asymmetry + ordinary constraints in fingerprint | Yes until Preview retest | Fixed — Local (7F-R1) | `verify-stage-3-1b7fr1` FALSE STALE |
| DEF-7F-002 | Deck | High | Breakdown showed Pergola / External Stairs on Deck-only | Deck (+ Unallocated) only | `mapEstimate` seeded `STATIC_INCLUDED_WORK_AREAS` | Yes until Preview retest | Fixed — Local (7F-R1) | `verify-stage-3-1b7fr1` BREAKDOWN |
| DEF-7F-003 | Deck | High | Description Add buried under Review details | Immediate Add / Use suggested / Edit | Progressive disclosure nesting | Yes until Preview retest | Fixed — Local (7F-R1) | `verify-stage-3-1b7fr1` DESCRIPTION |
| DEF-7F-004 | Deck | Medium | Scope Review counts only | Named lists + overflow | Presentation gap | No | Fixed — Local (7F-R1) | SCOPE SUMMARY |
| DEF-7F-005 | Deck | Medium | Edit scope friction | Checklist immediately | Already present; confirmed + summary UX | No | Complete — Local | EDIT SCOPE |
| DEF-7F-006 | Deck | Medium | Manual Add scope item missing | Honest manual provenance | Schema/contract cannot represent user origin | No (owner decision for 030) | **Fixed — Local (7F-R2)** — migration 030 + Add UI; Preview DB apply Pending | `verify-stage-3-1b7fr2` MANUAL |
| DEF-7F-007 | Deck | Medium | “N items need attention” without names | Exact item list + Review | Category-count view model | No | Fixed — Local (7F-R1) | ATTENTION |
| DEF-7F-008 | Deck | Medium | Narrow access / hand-carry not in Site Constraints | Mapped templates | Brief heuristic coverage | No | Fixed — Local (7F-R1) | CONSTRAINTS / DEF-7E-006 |
| DEF-7F-009 | Deck | Medium | Page scrolls at menu-bar level | Sidebar stable; content scrollport | body / sticky sidebar | No | Fixed — Local (7F-R1) | SCROLL |
| DEF-7F-010 | Deck | Low | Scope Review felt slow | No avoidable duplicate remount | `refreshResults` + `router.refresh` pairing | No | Fixed — Local (7F-R1) | PERFORMANCE |
| DEF-7F-011 | Deck | Medium | “Needs detail” implies fix in Scope Review | To confirm in Scope Details + Review action | Mental model / copy | No | Fixed — Local (7F-R2) | `verify-stage-3-1b7fr2` SCOPE DETAILS |
| DEF-7F-012 | Deck | Medium | QE attention lacked WA / resolve path | Exact item + WA + Review in Scope Details | Presentation | No | Fixed — Local (7F-R2) | QE ATTENTION |
| DEF-7F-013 | Deck | Low | Generate / answer save felt delayed | Immediate ack + Saved before refresh | UX / remount | No | Fixed — Local (7F-R2) | PERF marks |
| DEF-7F-014 | Deck | Medium | Top clipped / bottom whitespace; testing banner | Intentional shell height; banner removed | AppShell / BetaNotice | No | Fixed — Local (7F-R2) | LAYOUT |
| DEF-7F-015 | Deck | Medium | Mobile header too tall | Compact Back / title / Actions | ProjectHeader | No | Fixed — Local (7F-R2) | MOBILE HEADER |

### Known local verify gap (DEF-7E-006)

| ID | Project | Severity | Observed | Expected | Root cause | Release blocker | Fix status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-7E-006 | Constraint brief heuristics | Medium | Sample “Narrow restricted access… occupied upper floor” / Deck hand-carry phrases | Brief phrases map to supported templates | Heuristics expanded in 7F-R1 (`mapAccessConstraint`, `matchCartingDistanceM`, occupied/floor) | No | **Fixed — Local (7F-R1)**; Preview retest Pending | `verify-stage-3-1b7fr1` + `verify-stage-3-1b6r3` |

---

## Release gate recommendation

**Stage 3.1B — BLOCKED BY PREVIEW DEFECTS**

Blocker: **DEF-7E-003** (Owner Preview E2E incomplete — 7F pack ready, results pending).

After owner completes Deck / Bathroom / Fitout matrix with no Critical/High findings, re-evaluate for **READY FOR OWNER PRODUCTION GATE**.

Production remains **Disabled**. Do not begin Stage 3.2.

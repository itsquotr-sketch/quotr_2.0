# Stage 3.1B.7E — Preview Defect Register

**Status:** Open — Owner E2E Pending (Deck R4 PASS; R5 final UX/perf retest required; Bathroom FUNCTIONAL PASS; Fitout R6-R1 Local Complete / Owner retest Pending)  
**Updated:** 2026-08-10  
**7F-R6 Fitout retest:** `docs/runbooks/STAGE_3_1B7FR6_COMMERCIAL_FITOUT_RETEST.md`  
**7F-R6 completion:** `docs/implementation/STAGE_3_1B7FR6_MULTI_WORK_AREA_DATA_COLLECTION_COMPLETION.md`  
**7F-R6-R1 Fitout retest:** `docs/runbooks/STAGE_3_1B7FR6R1_COMMERCIAL_FITOUT_RETEST.md`  
**7F-R6-R1 completion:** `docs/implementation/STAGE_3_1B7FR6R1_SCOPE_DETAILS_SPECIFICATION_COMPLETION.md`  
**Readiness:** `docs/implementation/STAGE_3_1B_OWNER_PREVIEW_E2E_READINESS.md`  
**Final sign-off:** `docs/runbooks/STAGE_3_1B_OWNER_PREVIEW_FINAL_SIGNOFF.md`  
**7F-R4 retest:** `docs/runbooks/STAGE_3_1B7FR4_DECK_RETEST.md`  
**7F-R5 retest:** `docs/runbooks/STAGE_3_1B7FR5_DECK_FINAL_RETEST.md`  
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
| Fix status | **Open — Owner Pending** — execute `docs/runbooks/STAGE_3_1B_OWNER_PREVIEW_FINAL_SIGNOFF.md` + `STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`; capture in `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md`. Preview ready after Stage 3.1C close (migrations 001–033; 7F-R3 + 7G local green). |
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
| DECK-R4-01 | Medium | Fixed — Local (7F-R4); Owner Preview retest Pending | **Yes** until retest |
| DECK-R4-02 | High | Fixed — Local (7F-R4); Owner Preview retest Pending | **Yes** until retest |

\* Escalate if Preview auth/admin fails.

---

## E2E findings (Stage 3.1B.7F / 7F-R1 / 7F-R2 / 7F-R3)

Owner Deck E2E defects remediated locally in **3.1B.7F-R1**, polished in **3.1B.7F-R2**,
with unified scope-state reconciliation in **3.1B.7F-R3**, and explicit-negative /
constraint remediation in **3.1B.7F-R4**. Owner Deck retest:
`docs/runbooks/STAGE_3_1B7FR4_DECK_RETEST.md`.

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
| DEF-7F-015 | Deck | High | Pending Scope Details bucket frozen after Facts answered | Move to Included when mapped Facts known | Summary used frozen `latestReasonCode` | Yes until Final Deck retest | **Fixed — Local (7F-R3)** | `verify-stage-3-1b7fr3` DETAIL |
| DEF-7F-017 | Deck | Medium | QE included count ignored manuals | Count all INCLUDED (system + user) | QE used discovery-only filter | Yes until Final Deck retest | **Fixed — Local (7F-R3)** | `verify-stage-3-1b7fr3` QE |
| DEF-7F-018 | Deck | Medium | Manual items had inline checkboxes in confirmed summary | Readable summary; edit via Edit scope | Dual editing paradigms | No | **Fixed — Local (7F-R3)** | `verify-stage-3-1b7fr3` EDIT |
| DEF-7F-016 | Deck / Security | Low | 030 authenticated UPDATE/DELETE table grants via 026 defaults | Least-privilege grants + RLS | 030 omitted 028-style revoke | No | **Fixed — Remote (7F-R2.2 / 031)** | `STAGE_3_1B7FR22_MANUAL_SCOPE_ACL_HARDENING_COMPLETION.md` |
| DECK-R4-01 | Deck | Medium | Explicit “No balustrade required” still preselected Balustrade in Scope Review | Unchecked / Not required by default; still manually includable | Enrich polarity + Fact-aware checklist/composer defaults | Yes until Owner Preview retest | **Fixed — Local (7F-R4)**; Owner Preview retest **PASS** (2026-08-10) | `verify-stage-3-1b7fr4` + Owner Deck |
| DECK-R4-02 | Deck | High | Supported access/carry constraints not populated from explicit Deck brief | Difficult access + 10–30m carry from Owner wording | R1 heuristics missed Owner/pack phrases | Yes until Owner Preview retest | **Fixed — Local (7F-R4)**; Owner Preview retest **PASS** (2026-08-10) | `verify-stage-3-1b7fr4` + Owner Deck |
| DECK-R5-01 | Deck | Medium | Work Area confirmation / analysis perceived latency | Immediate WA save ack; discovery as next stage pending | confirmWorkAreas awaited discovery provider | Yes until R5 Owner retest | **Fixed — Local (7F-R5)** | `verify-stage-3-1b7fr5` |
| DECK-R5-02 | Deck | Medium | Quick Estimate generation perceived latency | Immediate Generating ack; project-only revalidate; remount documented | Refresh/remount after persist | Yes until R5 Owner retest | **Fixed — Local (7F-R5)** (partial — remount residual) | `verify-stage-3-1b7fr5` |
| DECK-R5-03 | Deck | Low/Medium | Incomplete Scope Detail groups hidden by collapsed disclosure | All unresolved required groups open by default | Single preferred category expand | Yes until R5 Owner retest | **Fixed — Local (7F-R5)** | `verify-stage-3-1b7fr5` |
| DECK-R5-04 | Deck | Medium | No fallback confirmation when zero constraints detected | Intro + existing taxonomy questions | Dead-end empty state | Yes until R5 Owner retest | **Fixed — Local (7F-R5)** | `verify-stage-3-1b7fr5` |
| DECK-R5-05 | Deck | Medium | False open clarification in Quick Estimate | Named current Scope Details attention only | needsDetail mapped to clarification channel | Yes until R5 Owner retest | **Fixed — Local (7F-R5)** | `verify-stage-3-1b7fr5` |
| DECK-R5-06 | Deck | Low | Review action causes unstable scroll jump | Expand target + `block: nearest` | `block: start` + missing completed ref | Yes until R5 Owner retest | **Fixed — Local (7F-R5)** | `verify-stage-3-1b7fr5` |
| BATH-CD-01 | Bathroom | Low | Commercial detail showed `Access factor: Restricted` | Contractor-facing access uplift wording with actual % | `formatLabourMinimumDisplay` emitted internal label; Restricted not recognised as 1.1 | No | **Fixed — Local** | `verify-stage-3-1b-bathroom-commercial-detail` |
| FITOUT-R6-01 | Fitout | High | Scope Review too sparse (deps only) | Concise CORE baselines per supported WA | Catalogue missing CORE under confirmed WAs | Yes until Owner Fitout retest | **Fixed — Local (7F-R6)** | `verify-stage-3-1b7fr6` + Owner |
| FITOUT-R6-02 | Fitout | High | Incomplete question coverage / only some questions | All applicable required questions together | `MAX_QUESTIONS = 12` hard cap | Yes until Owner Fitout retest | **Fixed — Local (7F-R6)** | `verify-stage-3-1b7fr6` |
| FITOUT-R6-03 | Fitout | Medium | Duplicate project-wide vs WA questions | Fact-first suppress WA duplicates | No project constraint suppression | No | **Fixed — Local (7F-R6)** | `verify-stage-3-1b7fr6` |
| FITOUT-R6-04 | Fitout | Medium | Hazmat “None known” ambiguous | Explicit No known risk ≠ Not sure | Wording | No | **Fixed — Local (7F-R6)** | `verify-stage-3-1b7fr6` |
| FITOUT-R6-05 | Fitout | High | QE Review non-actionable | Review targets real control or no button | Wrong stage / no DOM target | Yes until Owner Fitout retest | **Fixed — Local (7F-R6)** | `verify-stage-3-1b7fr6` |
| FITOUT-R6-06 | Fitout | Medium | Question-answer save latency | Parallel commits + Saved ack | Sequential Fact writes | No | **Fixed — Local (7F-R6)** (partial) | Owner timing |
| FITOUT-R6-07 | Fitout | Medium | Site Constraint save latency | startTransition refresh | Blocking refresh remount | No | **Fixed — Local (7F-R6)** (partial) | Owner timing |
| FITOUT-R6R1-01 | Fitout | High | Scope Details zero questions after Specification | Applicable multi-WA questions | Orphan empty question_block reuse after failed bulk insert | Yes until Owner Fitout retest | **Fixed — Local (7F-R6-R1)** | `verify-stage-3-1b7fr6r1` + Owner |
| FITOUT-R6R1-02 | Fitout | Medium/High | Budget Specification does not function | Select/save/retain Budget | Silent Scope Review gate + past-stage saveQuality no-op | Yes until Owner Fitout retest | **Fixed — Local (7F-R6-R1)** | `verify-stage-3-1b7fr6r1` + Owner |

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

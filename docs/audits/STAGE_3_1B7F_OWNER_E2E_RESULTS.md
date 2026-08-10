# Stage 3.1B.7F — Owner Preview E2E Results

**Status:** Pending Owner Capture — 7F-R4 Deck retest required (balustrade negatives + constraints)  
**Date opened:** 2026-08-07  
**Readiness:** `docs/implementation/STAGE_3_1B_OWNER_PREVIEW_E2E_READINESS.md`  
**Final sign-off:** `docs/runbooks/STAGE_3_1B_OWNER_PREVIEW_FINAL_SIGNOFF.md`  
**Test pack:** `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`  
**7F-R1 retest:** `docs/runbooks/STAGE_3_1B7FR1_DECK_PREVIEW_RETEST.md`  
**7F-R2 retest:** `docs/runbooks/STAGE_3_1B7FR2_DECK_PREVIEW_RETEST.md`  
**7F-R3 final retest:** `docs/runbooks/STAGE_3_1B7FR3_DECK_FINAL_RETEST.md`  
**7F-R4 Deck retest:** `docs/runbooks/STAGE_3_1B7FR4_DECK_RETEST.md`  
**Remediation:** `docs/implementation/STAGE_3_1B7FR1_DECK_E2E_REMEDIATION_COMPLETION.md`  
**7F-R2 polish:** `docs/implementation/STAGE_3_1B7FR2_FINAL_PREVIEW_POLISH_COMPLETION.md`  
**7F-R3 unified scope:** `docs/implementation/STAGE_3_1B7FR3_UNIFIED_SCOPE_STATE_COMPLETION.md`  
**Defect register:** `docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md`  
**Performance:** `docs/performance/STAGE_3_1B_PREVIEW_PERFORMANCE_RESULTS.md`  

**Overall release decision:** _Pending — enter A or B after Deck + Bathroom + Fitout PASS_

| Option | Criteria |
| --- | --- |
| **A. READY FOR OWNER PRODUCTION GATE** | Deck + Bathroom + Fitout PASS; no Critical; no High blocker; no commercial regression; no Fact fabrication; no duplicate WA/scope; no false stale loop; no cross-org issue; provider usage controlled; UX acceptable |
| **B. BLOCKED BY PREVIEW DEFECTS** | List DEF IDs below |

**Production enablement:** Not authorised by this document alone. Stage 3.1B closure ≠ Production Scope Discovery enablement.

---

## 7F-R4 live Preview findings (Owner Deck)

| ID | Severity | Observed | Expected | Fix status |
| --- | --- | --- | --- | --- |
| DECK-R4-01 | Medium | “No balustrade required” still preselected Balustrade | Unchecked by default; manually includable | **Owner PASS** after R4 |
| DECK-R4-02 | High | Restricted access / 25–30m manual carry missing from Site Constraints | Supported `site_access` + `material_carry_distance` populated | **Owner PASS** after R4 |

## 7F-R5 Deck final UX / performance

| ID | Severity | Observed | Expected | Fix status |
| --- | --- | --- | --- | --- |
| DECK-R5-01 | Medium | WA confirm felt blocked | Immediate save ack; discovery next | Fixed — Local; Owner retest Pending |
| DECK-R5-02 | Medium | QE generate delay | Immediate Generating; honest remount note | Fixed — Local; Owner retest Pending |
| DECK-R5-03 | Low/Medium | Incomplete Scope Detail groups collapsed | Required incomplete groups open | Fixed — Local; Owner retest Pending |
| DECK-R5-04 | Medium | Zero constraints → dead end | Intro + taxonomy confirmation | Fixed — Local; Owner retest Pending |
| DECK-R5-05 | Medium | False open clarification on QE | Named current attention only | Fixed — Local; Owner retest Pending |
| DECK-R5-06 | Low | Review scroll jump | Expand + nearest; no Review if empty | Fixed — Local; Owner retest Pending |

Retest: `docs/runbooks/STAGE_3_1B7FR5_DECK_FINAL_RETEST.md`  
Verify: `scripts/verify-stage-3-1b7fr5-deck-final-ux-performance.ts`

**Deck PASS status:** Pending R5 Owner retest (engine/scope already strong after R4).

## 7F-R6 Commercial Fitout multi-WA data collection

| ID | Severity | Observed | Expected | Fix status |
| --- | --- | --- | --- | --- |
| FITOUT-R6-01 | High | Sparse Scope Review baselines | Concise CORE per WA | Fixed — Local; Owner retest Pending |
| FITOUT-R6-02 | High | Incomplete questions (12-cap) | All required together | Fixed — Local; Owner retest Pending |
| FITOUT-R6-03 | Medium | Duplicate project-wide asks | Fact-first suppress | Fixed — Local; Owner retest Pending |
| FITOUT-R6-04 | Medium | Hazmat None known ambiguous | Explicit No ≠ Not sure | Fixed — Local; Owner retest Pending |
| FITOUT-R6-05 | High | Non-actionable QE Review | Target control or no button | Fixed — Local; Owner retest Pending |
| FITOUT-R6-06 | Medium | Answer save latency | Parallel commits | Fixed — Local; Owner timing Pending |
| FITOUT-R6-07 | Medium | Constraint save latency | startTransition refresh | Fixed — Local; Owner timing Pending |

Retest: `docs/runbooks/STAGE_3_1B7FR6_COMMERCIAL_FITOUT_RETEST.md`  
Verify: `scripts/verify-stage-3-1b7fr6-multi-work-area-data-collection.ts`  
Audit: `docs/audits/STAGE_3_1B7FR6_MULTI_WORK_AREA_QUESTION_COVERAGE_AUDIT.md`

**Fitout PASS status:** Pending R6 Owner retest.

## 7F-R6-R1 Scope Details eligibility + Budget Specification

| ID | Severity | Observed | Expected | Fix status |
| --- | --- | --- | --- | --- |
| FITOUT-R6R1-01 | High | Scope Details: no questions / empty state | Multi-WA questions for confirmed Fitout WAs | Fixed — Local; Owner retest Pending |
| FITOUT-R6R1-02 | Medium/High | Budget selection appears broken | Persist Budget; clear error if Scope Review incomplete | Fixed — Local; Owner retest Pending |

Retest: `docs/runbooks/STAGE_3_1B7FR6R1_COMMERCIAL_FITOUT_RETEST.md`  
Verify: `scripts/verify-stage-3-1b7fr6r1-scope-details-specification.ts`  
Completion: `docs/implementation/STAGE_3_1B7FR6R1_SCOPE_DETAILS_SPECIFICATION_COMPLETION.md`

**Fitout PASS status:** Pending R6-R1 Owner retest (do not sign off Fitout).

Do **not** close Stage 3.1B until Owner Deck (R5) + Bathroom + Fitout PASS.

---

## Session header (fill once)

| Field | Value |
| --- | --- |
| Preview URL | |
| Commit SHA | |
| Branch | `hardening/stage-2a-security` (or note) |
| Tester | |
| Session start (local) | |
| Session end | |
| Browser / device (desktop) | |
| Browser / device (mobile) | |

---

## Scoring summary

| Project | Avg (1–5) | Any &lt;3? | Journey | Commercial | Decision |
| --- | --- | --- | --- | --- | --- |
| A Deck | | | PASS / FAIL / PARTIAL | PASS / FAIL / PARTIAL | |
| B Bathroom | | | PASS / FAIL / PARTIAL | PASS / FAIL / PARTIAL | |
| C Fitout | | | PASS / FAIL / PARTIAL | PASS / FAIL / PARTIAL | |

Target: no category &lt;3; average ≥4; no Critical/High functional defect.

---

## Project A — Deck

### Meta

| Field | Value |
| --- | --- |
| Project ID / name | |
| Timestamp | |
| Browser / device | |
| Analyse Job | PASS / FAIL / PARTIAL — notes: |
| Scope Review | PASS / FAIL / PARTIAL — notes: |
| Scope quality | PASS / FAIL / PARTIAL — notes: |
| Irrelevant suggestions | |
| Missing suggestions | |
| Clarification usefulness | PASS / FAIL / PARTIAL |
| Question relevance | PASS / FAIL / PARTIAL |
| Fact pre-completion | PASS / FAIL / PARTIAL |
| Constraint population | PASS / FAIL / PARTIAL |
| Scope-impact behaviour | PASS / FAIL / PARTIAL |
| Estimate result | PASS / FAIL / PARTIAL |
| Pricing result | PASS / FAIL / PARTIAL |
| Quote result | PASS / FAIL / PARTIAL / N/A |
| UX notes | |
| Journey overall | PASS / FAIL / PARTIAL |

### Quality scores (1–5)

| Category | Score | Notes |
| --- | --- | --- |
| Work Area identification | | |
| Scope-item completeness | | |
| Scope-item relevance | | |
| Exclusions respected | | |
| Clarification quality | | |
| Question relevance | | |
| Constraint relevance | | |
| Estimate transparency | | |
| Overall workflow usability | | |
| **Average** | | |

### Latency (ms or s) — sample size in notes

| Action | Obs 1 | Obs 2 | Obs 3 | Median | Slowest | n |
| --- | --- | --- | --- | --- | --- | --- |
| Initial Assistant load | | | | | | |
| Analyse Job | | | | | | |
| Automatic Scope Review | | | | | | |
| Confirm scope | | | | | | |
| Question save acknowledgement | | | | | | |
| Question save completion | | | | | | |
| Estimate generation | | | | | | |
| Scope decision Apply/Keep | | | | | | |

UX flags (ack &gt;1s missing, long progress, flicker):

### Provider usage (safe metadata only — no project text)

| Field | Value |
| --- | --- |
| Calls per discovery run | |
| Repair attempts | |
| Input tokens | |
| Output tokens | |
| Duplicate-run reuse | |
| Stale rerun behaviour | |
| Unnecessary / duplicate calls? | Yes / No — notes: |

### Logs

| Source | Finding | Severity |
| --- | --- | --- |
| Browser console | | Critical / High / Medium / Low / benign |
| Vercel | | |
| Supabase | | |

### Commercial check

| Check | Result | Notes |
| --- | --- | --- |
| Quick Estimate total | PASS / FAIL | |
| Low / expected / high range | PASS / FAIL / N/A | |
| Pricing conversion | PASS / FAIL | |
| Margin behaviour | PASS / FAIL | |
| GST | PASS / FAIL | |
| Optional items | PASS / FAIL / N/A | |
| Quote total | PASS / FAIL / N/A | |
| Quote snapshot | PASS / FAIL / N/A | |
| Unexplained money mismatch | None / DEF-… | |

### Defects (new IDs → register)

| ID | Severity | Summary | Release blocker? |
| --- | --- | --- | --- |
| | | | |

---

## Project B — Bathroom

### Owner result (2026-08-10)

**Journey overall: FUNCTIONAL PASS**

Confirmed working:
- Work Area: Bathroom renovation
- Scope: fit-off, plumbing, waste, waterproofing, demolition, electrical, fixtures, linings, tiling, ventilation, painting
- Scope Details concise/relevant; Quick Estimate + Breakdown good

Presentation polish (not a calculation redesign):
- **BATH-CD-01** — Commercial detail `Access factor: Restricted` → contractor-facing uplift wording; Restricted recognised as +10% labour hours (same as Difficult). No double-count with carry on Bathroom lines. See `docs/implementation/STAGE_3_1B_BATHROOM_COMMERCIAL_DETAIL_COMPLETION.md`.

Full Bathroom journey retest **not required** for functional PASS; optional spot-check of Demolition + Carpentry Commercial detail after deploy.

### Meta

| Field | Value |
| --- | --- |
| Project ID / name | Owner Bathroom Preview |
| Timestamp | 2026-08-10 |
| Browser / device | Owner Preview |
| Analyse Job | PASS |
| Scope Review | PASS |
| Scope quality | PASS |
| Irrelevant suggestions | None material |
| Missing suggestions | None material |
| Clarification usefulness | PASS |
| Question relevance | PASS |
| Fact pre-completion | PASS |
| Constraint population | PASS (access noted) |
| Scope-impact behaviour | PASS |
| Estimate result | PASS |
| Pricing result | PASS |
| Quote result | N/A |
| UX notes | Commercial detail access wording remediated (BATH-CD-01) |
| Journey overall | **FUNCTIONAL PASS** |

### Quality scores (1–5)

| Category | Score | Notes |
| --- | --- | --- |
| Work Area identification | | |
| Scope-item completeness | | |
| Scope-item relevance | | |
| Exclusions respected | | |
| Clarification quality | | |
| Question relevance | | |
| Constraint relevance | | |
| Estimate transparency | | |
| Overall workflow usability | | |
| **Average** | | |

### Latency

| Action | Obs 1 | Obs 2 | Obs 3 | Median | Slowest | n |
| --- | --- | --- | --- | --- | --- | --- |
| Initial Assistant load | | | | | | |
| Analyse Job | | | | | | |
| Automatic Scope Review | | | | | | |
| Confirm scope | | | | | | |
| Question save acknowledgement | | | | | | |
| Question save completion | | | | | | |
| Estimate generation | | | | | | |
| Scope decision Apply/Keep | | | | | | |

UX flags:

### Provider usage

| Field | Value |
| --- | --- |
| Calls per discovery run | |
| Repair attempts | |
| Input tokens | |
| Output tokens | |
| Duplicate-run reuse | |
| Stale rerun behaviour | |
| Unnecessary / duplicate calls? | |

### Logs

| Source | Finding | Severity |
| --- | --- | --- |
| Browser console | | |
| Vercel | | |
| Supabase | | |

### Commercial check

| Check | Result | Notes |
| --- | --- | --- |
| Quick Estimate total | PASS / FAIL | |
| Low / expected / high range | PASS / FAIL / N/A | |
| Pricing conversion | PASS / FAIL | |
| Margin behaviour | PASS / FAIL | |
| GST | PASS / FAIL | |
| Optional items | PASS / FAIL / N/A | |
| Quote total | PASS / FAIL / N/A | |
| Quote snapshot | PASS / FAIL / N/A | |
| Unexplained money mismatch | None / DEF-… | |

### Defects

| ID | Severity | Summary | Release blocker? |
| --- | --- | --- | --- |
| | | | |

---

## Project C — Commercial Fitout

### Meta

| Field | Value |
| --- | --- |
| Project ID / name | |
| Timestamp | |
| Browser / device | |
| Analyse Job | PASS / FAIL / PARTIAL — notes: |
| Scope Review | PASS / FAIL / PARTIAL — notes: |
| Scope quality | PASS / FAIL / PARTIAL — notes: |
| Irrelevant suggestions | |
| Missing suggestions | |
| Clarification usefulness | PASS / FAIL / PARTIAL |
| Question relevance | PASS / FAIL / PARTIAL |
| Fact pre-completion | PASS / FAIL / PARTIAL |
| Constraint population | PASS / FAIL / PARTIAL |
| Scope-impact behaviour | PASS / FAIL / PARTIAL |
| Estimate result | PASS / FAIL / PARTIAL |
| Pricing result | PASS / FAIL / PARTIAL |
| Quote result | PASS / FAIL / PARTIAL / N/A |
| UX notes | |
| Journey overall | PASS / FAIL / PARTIAL |

### Quality scores (1–5)

| Category | Score | Notes |
| --- | --- | --- |
| Work Area identification | | |
| Scope-item completeness | | |
| Scope-item relevance | | |
| Exclusions respected | | |
| Clarification quality | | |
| Question relevance | | |
| Constraint relevance | | |
| Estimate transparency | | |
| Overall workflow usability | | |
| **Average** | | |

### Latency

| Action | Obs 1 | Obs 2 | Obs 3 | Median | Slowest | n |
| --- | --- | --- | --- | --- | --- | --- |
| Initial Assistant load | | | | | | |
| Analyse Job | | | | | | |
| Automatic Scope Review | | | | | | |
| Confirm scope | | | | | | |
| Question save acknowledgement | | | | | | |
| Question save completion | | | | | | |
| Estimate generation | | | | | | |
| Scope decision Apply/Keep | | | | | | |

UX flags:

### Provider usage

| Field | Value |
| --- | --- |
| Calls per discovery run | |
| Repair attempts | |
| Input tokens | |
| Output tokens | |
| Duplicate-run reuse | |
| Stale rerun behaviour | |
| Unnecessary / duplicate calls? | |

### Logs

| Source | Finding | Severity |
| --- | --- | --- |
| Browser console | | |
| Vercel | | |
| Supabase | | |

### Commercial check

| Check | Result | Notes |
| --- | --- | --- |
| Quick Estimate total | PASS / FAIL | |
| Low / expected / high range | PASS / FAIL / N/A | |
| Pricing conversion | PASS / FAIL | |
| Margin behaviour | PASS / FAIL | |
| GST | PASS / FAIL | |
| Optional items | PASS / FAIL / N/A | |
| Quote total | PASS / FAIL / N/A | |
| Quote snapshot | PASS / FAIL / N/A | |
| Unexplained money mismatch | None / DEF-… | |

### Defects

| ID | Severity | Summary | Release blocker? |
| --- | --- | --- | --- |
| | | | |

---

## Final gate checklist

| Invariant | Met? |
| --- | --- |
| Deck journey PASS | |
| Bathroom journey PASS | |
| Fitout journey PASS | |
| No Critical defect open | |
| No High release blocker open | |
| No commercial regression | |
| No Fact fabrication | |
| No duplicate scope / WA | |
| No false stale loop | |
| No cross-org / data issue | |
| Provider usage controlled | |
| UX acceptable | |

**Decision:** A / B  
**Blockers (if B):**  
**Signed:**  
**Date:**  

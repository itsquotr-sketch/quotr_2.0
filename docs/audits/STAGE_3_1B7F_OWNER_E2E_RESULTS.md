# Stage 3.1B.7F — Owner Preview E2E Results

**Status:** Pending Owner Capture (7F-R1 remediations Complete — Local; Preview Retest Pending)  
**Date opened:** 2026-08-07  
**Test pack:** `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`  
**7F-R1 retest:** `docs/runbooks/STAGE_3_1B7FR1_DECK_PREVIEW_RETEST.md`  
**Remediation:** `docs/implementation/STAGE_3_1B7FR1_DECK_E2E_REMEDIATION_COMPLETION.md`  
**Defect register:** `docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md`  
**Performance:** `docs/performance/STAGE_3_1B_PREVIEW_PERFORMANCE_RESULTS.md`  

**Overall release decision:** _Pending — enter A or B after all three projects_

| Option | Criteria |
| --- | --- |
| **A. READY FOR OWNER PRODUCTION GATE** | Deck + Bathroom + Fitout PASS; no Critical; no High blocker; no commercial regression; no Fact fabrication; no duplicate WA/scope; no false stale loop; no cross-org issue; provider usage controlled; UX acceptable |
| **B. BLOCKED BY PREVIEW DEFECTS** | List DEF IDs below |

**Production enablement:** Not authorised by this document alone.

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

# Stage 3.1B.7F-R6 — Commercial Fitout Owner Retest

**Purpose:** Owner Preview retest after multi-WA baseline / question / Review remediation.  
**Preview:** `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`  
**Branch:** `hardening/stage-2a-security`  
**Completion:** `docs/implementation/STAGE_3_1B7FR6_MULTI_WORK_AREA_DATA_COLLECTION_COMPLETION.md`  
**Audit:** `docs/audits/STAGE_3_1B7FR6_MULTI_WORK_AREA_QUESTION_COVERAGE_AUDIT.md`  
**Defect IDs:** FITOUT-R6-01 … FITOUT-R6-07  

Do **not** enable Production Scope Discovery. Do **not** start Stage 3.2.

---

## Preconditions

1. Same Commercial Fitout project used in Owner Preview (or recreate with equivalent brief).
2. Preview `SCOPE_DISCOVERY_ENABLED=true` (branch-scoped).
3. Deploy includes R6 commit after local green verify.

---

## Checklist

| # | Check | Pass? | Notes |
| --- | --- | --- | --- |
| 1 | Same / equivalent Commercial Fitout project | | |
| 2 | Work Areas unchanged / sensible (Demo, Walls, Ceilings, Doors, Flooring, Painting, Plastering, …) | | |
| 3 | Scope Review shows **concise CORE** scope per package (framing/lining, ceiling system, door hardware, floor prep/finish, paint prep/coats, plaster stopping, demo handling) — not only services/seismic/waste | | |
| 4 | Scope Details shows required questions for **all** current Work Areas together (not a tiny first batch) | | |
| 5 | Project-wide access / carry / waste / hours **not** repeatedly asked under Demolition when already known | | |
| 6 | Hazmat offers explicit **No known hazardous material risk** distinct from **Not sure** | | |
| 7 | Answer save and Site Constraint save feel more responsive (Saved promptly) | | |
| 8 | Quick Estimate attention names real missing info | | |
| 9 | **Review** opens exact question / control (or WA group); no dead Review buttons | | |
| 10 | Generate estimate / breakdown remain commercially coherent | | |

---

## Latency capture (optional but preferred)

| Action | Ack felt | Complete (s) | Notes |
| --- | --- | --- | --- |
| Scope Details answer save | | | |
| Site Constraint save | | | |
| Attention → Review | | | |
| Generate Estimate | | | |

---

## Outcome

| Field | Value |
| --- | --- |
| Fitout PASS? | Pending Owner |
| Blocking defects | |
| Tester | |
| Date | |
| Commit SHA | |

**Stage 3.1B remains open** until Owner Deck (R5) + Fitout PASS (Bathroom functional gate already clear).

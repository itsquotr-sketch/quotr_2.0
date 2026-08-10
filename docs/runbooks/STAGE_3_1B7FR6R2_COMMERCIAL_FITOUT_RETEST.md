# Stage 3.1B.7F-R6-R2 — Commercial Fitout Owner Retest

**Purpose:** Retest after `questions_input_type_check` / multi_select persistence repair.  
**Preview:** `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`  
**Completion:** `docs/implementation/STAGE_3_1B7FR6R2_QUESTION_INPUT_CONTRACT_COMPLETION.md`  
**Defect:** FITOUT-R6R2-01  

Do **not** enable Production Scope Discovery. Do **not** start Stage 3.2. Do **not** close Fitout until this retest PASSes.

---

## Checklist

| # | Check | Pass? | Notes |
| --- | --- | --- | --- |
| 1 | Open same Commercial Fitout project (or recreate) | | |
| 2 | Confirm Work Areas + Scope Review so Specification unlocks | | |
| 3 | Select **Budget** → save Specification | | |
| 4 | No DB / `questions_input_type_check` / raw Postgres error | | |
| 5 | Scope Details loads questions (not empty; not “prepare failed” loop) | | |
| 6 | Confirm framing / ceiling / doors / flooring / painting / plastering coverage | | |
| 7 | Demolition scope items still multi-choice UI (select all that apply) | | |
| 8 | Answer/save several questions | | |
| 9 | Quick Estimate attention updates | | |
| 10 | Review routes to the real control | | |
| 11 | Repeat Specification save for **Standard** and **Premium** (same project or fresh) | | |

---

## Outcome

| Field | Value |
| --- | --- |
| Fitout PASS? | Pending Owner |
| Blocking defects | FITOUT-R6R2-01 until this retest PASSes |
| Tester | |
| Date | |
| Commit SHA | |

Stage 3.1B remains open until Deck (R5) + Fitout PASS.

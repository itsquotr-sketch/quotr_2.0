# Stage 3.1B.7F-R3 — Deck Final Retest

**Purpose:** Confirm unified scope-state reconciliation on Preview after 7F-R3.  
**Prerequisite:** Migrations **030** + **031** applied; Scope Discovery Preview flag on.  
**Status:** Pending owner execution  

**Do not** enable Production. **Do not** start Stage 3.2.

---

## Setup

1. Preview branch with 7F-R3 commit.
2. Open or create a Deck project with Analyse Job + Scope Review already run (or run Analyse once).
3. Confirm Scope Review can reach Complete while Scope Details still has questions.

---

## A. Detail reconciliation

| Step | Action | Expected |
| --- | --- | --- |
| A1 | Note items under **To confirm in Scope Details** (e.g. Existing substructure condition, Fascia / face boards) | Present when mapped details unanswered |
| A2 | Answer those questions in **Scope Details** and save | Facts persist; no Analyse required |
| A3 | Return to Scope Review (no Analyse again) | Those items move to **Included**; pending bucket shrinks/clears |
| A4 | Scope Review status | Remains **Complete** (no rollback) |

---

## B. Manual + Quick Estimate count

| Step | Action | Expected |
| --- | --- | --- |
| B1 | Edit scope → **+ Add scope item** under Deck → save → Confirm scope | Item appears in Included with **Added by you · Pricing required** |
| B2 | Quick Estimate Scope disclosure | **Included scope — N included** includes the manual item |
| B3 | Edit scope → uncheck manual item → Confirm | Count decreases; item under Not required |
| B4 | Confirmed summary | No always-live checkbox on manual rows |

---

## C. Unified Edit scope

| Step | Action | Expected |
| --- | --- | --- |
| C1 | Edit scope | One checklist: system + manual; local toggle |
| C2 | Toggle several → Confirm | Single save; both persistence paths; success only if all ok |
| C3 | Force / observe partial failure (if possible) | Honest error; not full success |

---

## D. Estimate Review / breakdown

| Step | Action | Expected |
| --- | --- | --- |
| D1 | Estimate Review | Manual included item visible; Pricing required where unsupported |
| D2 | Full breakdown | Manual under correct Work Area; no fake WA; no invented money |
| D3 | Resolved detail items | Not still shown as outstanding confirmations in Scope Review |

---

## E. Boundaries spot-check

- [ ] No provider call when answering Scope Details for pending detail
- [ ] No discovery rerun for detail clear
- [ ] No Fact write from Edit scope confirm
- [ ] Production Scope Discovery still off
- [ ] Stage 3.2 not started

---

## Outcome

| Field | Value |
| --- | --- |
| Tester | |
| Date | |
| Commit | |
| Result | PASS / FAIL / PARTIAL |
| Notes | |

If PASS with no Critical/High: update owner E2E results toward release decision A (Production still requires separate enablement gate).

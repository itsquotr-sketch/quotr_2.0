# RECOVERY-2 — Owner Assistant Architecture Gate

**Status:** COMPLETE / OWNER ASSISTANT ARCHITECTURE VALIDATED  
**Date:** 2026-08-19  
**HEAD at architecture lock:** `2b4055c316c404dcf3cc183dad47c9408c3634e4`  
**Preview:** no UX change in the RECOVERY-2 docs batch

**Canonicals:**
- `docs/architecture/QUOTR_ASSISTANT_OPERATING_MODEL.md`
- `docs/architecture/QUOTR_WORK_AREA_ASSISTANT_CONTRACT.md`
- `docs/architecture/QUOTR_ESTIMATE_PRESENTATION_CONTRACT.md`
- `docs/plans/QUOTR_WORK_AREA_MIGRATION_PLAN.md`
- `docs/audits/RECOVERY_2_ASSISTANT_DOMAIN_AUDIT.md`

---

## Owner decisions applied (2026-08-19)

Approved journey:

`BRIEF → JOB PLAN → CLARIFY → ESTIMATE → BUILDER REVIEW → PRICING → QUOTE`

| Decision | Lock |
| --- | --- |
| Work Areas | Internal estimating parents. Not flattened. |
| Job Plan | Merge Work Areas + user-facing scope + compact spec. **Projection only. No new table.** |
| Specification | Contextual. Not a mandatory full-page stage. |
| Scope Details | Clarification / refinement. Not a mandatory wizard. |
| Project Conditions | Participate in Clarify. Never Job Plan scope. |
| Builder Review | RECOVERY-5 |
| DECK-2C | Superseded / deferred into RECOVERY-5 |
| Hybrid estimate | Permanent (takeoff + allowances) |
| REAL-JOB $13,000 | Evidence only. Not a calibration target. |
| Unknown scope | `ABSENT FROM BRIEF ≠ NOT_REQUIRED`. Presentation: INCLUDED / NOT_INCLUDED / NOT_CONFIRMED. No new persist enum. |
| User-facing scope vs estimate components | Decking/substructure/fascia/steps ≠ joists/bearers/concrete/fixings |
| `deck.access_type` | Stairs/step-down from the deck → user-facing **Steps**. Not `site_access`. Do not retire in RECOVERY-3. |

---

## Programme status

| Batch | Status |
| --- | --- |
| RECOVERY-0 | COMPLETE / COMMERCIAL RATE INTEGRITY VALIDATED |
| RECOVERY-1 | COMPLETE / COMMERCIAL CONTRACT VALIDATED |
| **RECOVERY-2** | **COMPLETE / OWNER ASSISTANT ARCHITECTURE VALIDATED** |
| RECOVERY-3 | NOT STARTED until this docs commit lands |
| RECOVERY-4 | NOT STARTED |
| RECOVERY-5 | NOT STARTED |
| DECK-2C | superseded / deferred into RECOVERY-5 |

---

## Exact next action

**RECOVERY-3 — Job Plan (Deck Preview first / generic foundation).**

Do not start RECOVERY-4, Clarify, Builder Review, DECK-3, or Production SD.

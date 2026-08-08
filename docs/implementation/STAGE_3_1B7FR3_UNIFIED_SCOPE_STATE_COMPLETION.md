# Stage 3.1B.7F-R3 — Unified Scope State Reconciliation Completion

**Status:** Complete — Local, Final Deck Retest Pending  
**Date:** 2026-08-08  
**Parent:** Stage 3.1B Intelligent Scope Discovery  
**Deck Owner E2E:** Pending Final Retest  
**Stage 3.1B:** BLOCKED BY PREVIEW DEFECTS  
**Production — Disabled**  
**Stage 3.2 — Not Started**  

---

## Summary

Final targeted remediation for three Owner Deck Preview inconsistencies:

1. **“To confirm in Scope Details”** did not clear after mapped Scope Details Facts were answered.
2. **Quick Estimate included scope count** ignored user-added manual scope items.
3. **Manual items** showed always-live inline checkboxes in the confirmed Scope Review summary while discovery items required Edit scope.

No migration 032. No AI prompt change. No commercial formula change. No Fact authority change. No Production enablement. No Stage 3.2.

---

## Architecture

`lib/assistant/current-work-area-scope-state.ts` composes a single presentation read model:

**CurrentWorkAreaScopeState** over:

- discovery suggestions + decisions;
- manual `work_area_scope_items` (+ append-only decisions);
- current Scope Review Facts / active questions.

Each current item carries: stable id, workAreaId, origin (`system` | `user`), title, decision (`INCLUDED` | `NOT_REQUIRED`), detail (`COMPLETE` | `NEEDS_DETAIL`), pricing support, provenance.

Consumers:

- Scope Review summary / Edit scope;
- Quick Estimate included + attention counts;
- Estimate Review / breakdown (manuals already via Option B tables; counts now consistent).

No new database authority.

---

## Detail reconciliation

**Root cause:** summary buckets used frozen `latestReasonCode` (`pending` / `routed`). Answering Facts never rewrote those decision reason codes.

**Correction:** derive detail state from **current** Facts (and optional-question rules) via clarification routing (`rationaleCode` + deterministic title heuristics). When all required mapped Facts are satisfied → `INCLUDED` + `COMPLETE` → Included list. No discovery rerun, no Analyse again, no scope re-confirmation. Scope Review completion remains decision acceptance, not detail completeness.

---

## UX

- Confirmed Scope Review is a readable summary (system + manual, with `Added by you · Pricing required`).
- Editing (include/exclude/add) happens in **Edit scope** with one checklist; batch save coordinates discovery `batchConfirmScopeItemsAction` + manual `decideManualScopeItemAction`; partial failures reported honestly.
- Quick Estimate: `includedScopeCount` = all `INCLUDED` (including NEEDS_DETAIL); attention uses separate `needsDetailCount`.

---

## Verification

`npx tsx scripts/verify-stage-3-1b7fr3-unified-scope-state.ts`

Retest: `docs/runbooks/STAGE_3_1B7FR3_DECK_FINAL_RETEST.md`

---

## Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Migration 032 | Not created |
| AI prompts | Unchanged |
| Commercial formulas | Unchanged |
| Fact authority | Unchanged |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

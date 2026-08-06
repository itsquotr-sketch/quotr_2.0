# Stage 3.1B.6R2 — Batch Scope Confirmation Completion

**Status:** Complete — Local, Preview Retest Pending  
**Date:** 2026-08-06  
**Verify:** `scripts/verify-stage-3-1b6r2-batch-scope-confirmation.ts`  
**Parent:** Stage 3.1B.6 / 3.1B.6R1 — Preview sign-off **not** complete  
**Stage 3.1B.7:** Not Started  
**Production:** Disabled  

---

## 1. Batch checklist model

Primary Scope Review journey is a **Work Area–grouped checklist**:

- Recommended items (important / worth checking / clarifications) selected in **unsaved local state**
- Low-confidence “other” unticked by default
- Nothing authoritative until **Confirm scope**
- After save: summary + **Edit scope** (append-only reversals)

Genuine high-level Work Area suggestions retain individual Add / Edit / Dismiss.

---

## 2. Default-selection semantics

| Band / class | Local default |
| --- | --- |
| Important / worth checking / clarifications | Included (checkbox on) |
| Low / possible exclusion | Not required (off) |
| Already ACCEPTED / REJECTED | Restored from latest decision |

Copy: *“Quotr has selected the scope items it believes are likely to apply. Untick anything that is not part of this job, then confirm the scope.”*

---

## 3. Batch persistence

`batchConfirmScopeItemsApp` (`lib/scope-discovery/application/batch-confirm-scope.ts`):

- Validates all rows before writing
- Appends ACCEPT / REJECT via `insertDiscoveryDecision` with `created_work_area_id = null`
- Idempotent when latest state already matches
- Supports INCLUDED / NOT_REQUIRED / UNRESOLVED_CLARIFICATION
- No Work Areas, no Facts, no commercial values
- No migration — uses 028/029

---

## 4. Re-edit / reversal

Edit scope restores current selections. Include ↔ Not required appends a new decision; composition uses newest valid decision. Not Company DNA.

---

## 5–6. Clarifications + Scope Details routing

Kinds: SCOPE_EXISTENCE / SCOPE_DETAIL / CONFLICT.

Mapped rationale codes → canonical fact keys (`clarification-routing.ts`). Actions: Include, Not required, Answer in Scope Details. Unmapped clarifications stay safely unresolved (no fabricated Fact key).

---

## 7. Automatic analysis after Work Area confirmation

`confirmWorkAreas` calls `runScopeDiscovery` once when `SCOPE_DISCOVERY_ENABLED=true`. Failures do not undo WA confirmation. UI also auto-starts once if no run exists (fallback). **Analyse again** only when stale / failed — not on every fresh run.

---

## 8. Quality gating

Quality locked until Scope Review completion. Copy explains why. `saveQuality` server-enforced. Quick Estimate / Change spec routes to incomplete Scope Review first.

---

## 9. Completion rule

`evaluateScopeReviewCompletion`: all important + clarifications decided; low-confidence optional may remain open.

---

## 10. False stale root cause + fix

**Cause:** `briefRevision` (and other revisions) included `updated_at`. Confirming Work Areas updated `projects.stage` → `updated_at` → immediate STALE → Analyse again.

**Fix:** Content / domain fingerprints only (normalised brief text; WA type/name/status; fact/constraint key+value). No incidental timestamps.

---

## 11. Confirmation

No Production enablement; no commercial formula change; no Company DNA; no Builder Interview; Analyse Job high-level path preserved.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B6R2_BATCH_SCOPE_CONFIRMATION_COMPLETION.md` |
| Created | 2026-08-06 |

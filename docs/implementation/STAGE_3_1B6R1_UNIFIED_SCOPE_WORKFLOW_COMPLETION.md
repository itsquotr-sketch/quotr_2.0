# Stage 3.1B.6R1 — Unified Scope Workflow Completion

**Status:** Complete — Local, Preview Retest Pending (superseded for workflow by **3.1B.6R2**)  
**Follow-on:** `docs/implementation/STAGE_3_1B6R2_BATCH_SCOPE_CONFIRMATION_COMPLETION.md`  

---

## 1. Root cause — “This suggestion cannot be decided.”

Preview **Add work area** failed because:

1. Deterministic catalogue mostly emits **scope items** (`MISSING_SCOPE` / `DEPENDENCY`) with abstract types such as `waste_removal`, `substructure`, `decking`, `fascia`.
2. Accept RPC (029) only allows kinds `WORK_AREA` | `SUB_SCOPE` | `MISSING_SCOPE` **and** `scope_discovery_supported_work_area_type(type)`.
3. Abstract types are **not** in `SCOPE_CATALOGUE` → RPC returns `SUGGESTION_NOT_ELIGIBLE` → UI message “This suggestion cannot be decided.”
4. UI still showed **Add work area** for those cards (no `canDecide` gating).

`DEPENDENCY` kinds also failed the kind allow-list entirely.

Regression covered in `verify-stage-3-1b6r1-unified-scope-workflow.ts`.

---

## 2. Work Area vs Scope Item model

| Class | Meaning | Decision |
| --- | --- | --- |
| `HIGH_LEVEL_WORK_AREA` | Deck, Bathroom, Kitchen, … | Accept → create Work Area (029 RPC) |
| `SCOPE_ITEM` | Demolition, decking, waterproofing, fire stopping, … | Include → decision only, **no** Work Area |
| `CLARIFICATION` | Missing fact clarifications | Dismiss / answer in Scope Details |
| `WARNING` | Conflicts / duplicates | Review / dismiss |
| `EXCLUSION` | Possible exclusions | Include / not required |

Module: `lib/scope-discovery/classification.ts`

---

## 3. Persistence model (no migration)

Reuse `scope_discovery_decisions` append-only rows:

- Scope-item **Include** → `ACCEPT` with `created_work_area_id = null`, reason `scope_item_included`
- Scope-item **Edit and include** → `MODIFY` with null WA id
- **Not required** → existing reject RPC

Confirmed: migrations 028/029 sufficient. **No migration 030.**

---

## 4. Workflow sequence

Project Capture → Work Areas → **Scope Review** (discovery) → Quality → Scope Details → Site Constraints → **Estimate Review** → Estimate

Estimate facts card renamed from “Scope Review” to **Estimate Review** to avoid collision.

---

## 5–8. Gating, questions, constraints, pre-completion

- Soft Scope Review completion (low-confidence optional).
- Excluded scope items suppress mapped questions (e.g. demolition → `deck.existing_deck_removal`).
- Inclusion does **not** invent Facts.
- Project-wide constraints retained; waste-linked constraints prefer included waste scope.
- Pre-completion remains Fact-first only.

---

## 9. Action corrections

| Proposal | Primary | Edit | Negative |
| --- | --- | --- | --- |
| Work Area | Add work area | Edit and add | Dismiss |
| Scope item | Include in scope | Edit and include | Not required |
| Clarification / warning | — | — | Not required / Dismiss |

Non-decidable suggestions show reason; primary Add/Include hidden when `canCreateWorkArea` / `canIncludeInScope` false.

---

## 10. UI grouping

Scope Review nests suggestions under confirmed Work Areas when `relatedWorkAreaId` is present:

- Important inclusions
- Worth checking
- Clarifications
- Other possibilities / conflicts
- Included / Not required

Unlinked suggestions appear under **Project-wide**. Stepper “constraints” label renamed to **Site Constraints** to avoid colliding with Scope Review.

---

## 11. Confirmation

No Production enablement; no commercial formula change; no Company DNA; no Builder Interview; Analyse Job preserved (high-level WA seed only).

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B6R1_UNIFIED_SCOPE_WORKFLOW_COMPLETION.md` |
| Created | 2026-08-06 |
| Updated | 2026-08-06 |

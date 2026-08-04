# Pricing Action Adoption Gate

**Stage:** 2B — Authoritative Pricing Engine  
**Batch:** 2B.5  
**Date:** 2026-08-04  
**Purpose:** Formal readiness checklist before Batch **2B.6** pricing-action adoption of the commercial engine.  
**Authority:** Commercial engine remains **non-authoritative** until 2B.6. This gate does not authorise adoption.

---

## Readiness rule

An action may be marked **ready for Batch 2B.6** only if all of the following are true:

1. Stage 2A security remains intact (auth + org ownership).
2. Input schema exists (Zod).
3. Legacy parity fixture exists (or explicit deferred coverage with reason).
4. Golden / contract suites pass (programme-level; not per-action).
5. GST source is explicit.
6. Unknown-cost behaviour is explicit.
7. Manual override behaviour is documented.
8. Persistence mapping is known.
9. Rollback is defined.
10. Historical snapshot impact is understood.

**Programme suites (2B.5):** golden **60/60**, contract **37/37**, shadow parity (C-28 no longer blocking), focused GST verification.

---

## GST source rule (live pricing)

| Moment | Source |
| --- | --- |
| Creation | Organisation settings (`default_gst_rate`), else application default **15%** (`DEFAULT_GST_RATE`) via nullish fallback |
| Ongoing | Stored `pricing_documents.gst_rate` (including **0%**) |
| User GST update | Validated mutation value persisted in the same operation |
| Recalculation | Current stored document GST (or mutation value being persisted) |
| Quote from pricing | Pricing snapshot GST — **quote arithmetic unchanged in 2B.5** |

Helper: `lib/pricing/gst-source.ts`. NZ 15% must not overwrite a valid organisation/document rate.

---

## Action checklist

### createPricingFromEstimate

| Field | Status |
| --- | --- |
| Action name | `createPricingFromEstimate` |
| Authentication | Yes — `requireAuthOrgContext` |
| Ownership | Yes — estimate/project org asserts |
| Input validation | Yes — `createPricingFromEstimateInputSchema` |
| Parity coverage | Yes — `PAR-P-GST-BUG-C28` / LEG-P-05 (corrected EXACT_MATCH after 2B.5) |
| GST source | Explicit — org settings → document; post-item recalc uses **same** rate (C-28 fixed) |
| Unknown-cost behaviour | Copies estimate line money; sell-only lines retain legacy triad until 2B.6 |
| Manual override behaviour | N/A on create (lines from estimate) |
| Historical impact | New creates only; no bulk rewrite of existing docs |
| Rollback method | Revert 2B.5 GST wiring commit; restore prior recalc argument |
| Ready for Batch 2B.6 | **Yes** (GST blocker cleared; engine still unwired) |
| Blocker | None for GST. Adoption still requires engine wiring plan in 2B.6 |

### updatePricingDocument

| Field | Status |
| --- | --- |
| Action name | `updatePricingDocument` |
| Authentication | Yes |
| Ownership | Yes — `loadOwnedPricingDocument` |
| Input validation | Yes — `updatePricingDocumentInputSchema` (`gst_rate` via `gstRatePercentSchema`) |
| Parity coverage | Partial — document GST via LEG-P-03 / DOC fixtures; no dedicated mutation fixture |
| GST source | Explicit — mutation or stored document via `resolvePricingGstForUpdate` |
| Unknown-cost behaviour | Recalc from item totals only; does not invent line costs |
| Manual override behaviour | Document fields only; does not clear item `manually_edited` |
| Historical impact | Draft edits only; no quote mutation |
| Rollback method | Revert action / restore previous document fields |
| Ready for Batch 2B.6 | **Yes** |
| Blocker | Prefer add dedicated GST-update parity fixture during 2B.6 (non-blocking) |

### updatePricingItem

| Field | Status |
| --- | --- |
| Action name | `updatePricingItem` |
| Authentication | Yes |
| Ownership | Yes — pricing item org assert |
| Input validation | Yes — `updatePricingItemInputSchema` + computed persistence guard |
| Parity coverage | Yes — LEG-P-01 / LEG-P-02 item fixtures |
| GST source | Explicit — stored document GST via `resolveStoredPricingDocumentGstRate` |
| Unknown-cost behaviour | Legacy triad may fabricate 100% margin when cost 0 / sell > 0 (OCD-30; approved engine correction on adoption) |
| Manual override behaviour | Sets `manually_edited: true` on item update |
| Historical impact | Live draft pricing only |
| Rollback method | Revert item update; document totals recalc from items |
| Ready for Batch 2B.6 | **Yes** |
| Blocker | Unknown-cost mapping to engine null margin must be handled in 2B.6 UI/persist mapping |

### addPricingItem

| Field | Status |
| --- | --- |
| Action name | `addPricingItem` |
| Authentication | Yes |
| Ownership | Yes |
| Input validation | Yes — `addPricingItemInputSchema` |
| Parity coverage | Yes — same item calculation LEG-P-02 |
| GST source | Explicit — stored document GST |
| Unknown-cost behaviour | Same as updatePricingItem |
| Manual override behaviour | New item; may be marked manually edited depending on input path |
| Historical impact | Draft only |
| Rollback method | Delete item / revert insert |
| Ready for Batch 2B.6 | **Yes** |
| Blocker | Same unknown-cost adoption mapping |

### duplicatePricingItem

| Field | Status |
| --- | --- |
| Action name | `duplicatePricingItem` |
| Authentication | Yes |
| Ownership | Yes |
| Input validation | Yes — `duplicatePricingItemInputSchema` |
| Parity coverage | Indirect — duplicates existing calculated fields; document recalc LEG-P-03 |
| GST source | Explicit — stored document GST |
| Unknown-cost behaviour | Copies source item metrics as stored |
| Manual override behaviour | Copies source flags/fields |
| Historical impact | Draft only |
| Rollback method | Delete duplicate |
| Ready for Batch 2B.6 | **Yes** |
| Blocker | None specific |

### deletePricingItem

| Field | Status |
| --- | --- |
| Action name | `deletePricingItem` |
| Authentication | Yes |
| Ownership | Yes |
| Input validation | Yes — `deletePricingItemInputSchema` |
| Parity coverage | Indirect — aggregate recalc LEG-P-03 |
| GST source | Explicit — stored document GST |
| Unknown-cost behaviour | Aggregate from remaining items |
| Manual override behaviour | N/A |
| Historical impact | Draft only |
| Rollback method | Re-insert / restore from backup not automated |
| Ready for Batch 2B.6 | **Yes** |
| Blocker | None specific |

### markPricingReviewed

| Field | Status |
| --- | --- |
| Action name | `markPricingReviewed` |
| Authentication | Yes |
| Ownership | Yes |
| Input validation | Yes — `markPricingReviewedInputSchema` |
| Parity coverage | N/A — status mutation; **no recalculation** |
| GST source | N/A (does not recalc) |
| Unknown-cost behaviour | N/A |
| Manual override behaviour | N/A |
| Historical impact | Status/timestamp only |
| Rollback method | Set status back to draft; clear `reviewed_at` |
| Ready for Batch 2B.6 | **Yes** |
| Blocker | None — keep non-calculating in adoption unless review rules change |

### Pricing reads that return calculated totals

| Field | Status |
| --- | --- |
| Action name | `getPricingWorkspaceData` / `getPricingSummariesForProjects` / `loadPricingDocumentById` (internal) |
| Authentication | Yes (via auth org context / ownership) |
| Ownership | Yes |
| Input validation | ID-based loaders; mapped rows |
| Parity coverage | Display mapping LEG-P-07 / UI fixtures where applicable |
| GST source | Read path returns stored `gst_rate` and persisted totals (mapper nullish default 15 only if column null) |
| Unknown-cost behaviour | Returns stored triad fields as persisted |
| Manual override behaviour | Returns `manually_edited` flags |
| Historical impact | Read-only |
| Rollback method | N/A |
| Ready for Batch 2B.6 | **Yes** (read-only helpers first in adoption order) |
| Blocker | Do not recompute authority on read until write paths adopted |

### Recalibration (related pricing path)

| Field | Status |
| --- | --- |
| Action name | Recalibration preview/apply (`lib/pricing/recalibration.ts`) |
| Authentication | Yes |
| Ownership | Yes |
| Input validation | Existing recalibration guards |
| Parity coverage | LEG-P-06 deferred depth |
| GST source | Explicit — stored document GST via `resolveStoredPricingDocumentGstRate` (2B.5) |
| Unknown-cost / manual | Preserves manually edited items |
| Historical impact | Draft pricing; does not mutate quotes |
| Rollback | Revert recalibration commit |
| Ready for Batch 2B.6 | **Conditional** — include after item CRUD adoption; not first |
| Blocker | Deeper parity optional; preserve manual items |

---

## Summary matrix

| Action | Ready for 2B.6? | Blocker |
| --- | --- | --- |
| createPricingFromEstimate | Yes | Engine wiring only |
| updatePricingDocument | Yes | Optional GST-update fixture |
| updatePricingItem | Yes | Unknown-cost null mapping |
| addPricingItem | Yes | Unknown-cost null mapping |
| duplicatePricingItem | Yes | — |
| deletePricingItem | Yes | — |
| markPricingReviewed | Yes | — |
| Pricing reads | Yes | Read-only first |
| Recalibration | Conditional | After CRUD; manual preserve |

**C-28 / CD-09 / LEG-P-05:** cleared as adoption blocker in Batch 2B.5.

**Commercial engine:** still disconnected from all live actions.

---

## Batch 2B.6 adoption order (gate-approved sequence)

See `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md` Batch 2B.6 map. Do not begin adoption in 2B.5.

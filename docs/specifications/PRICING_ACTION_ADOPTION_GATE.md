# Pricing Action Adoption Gate

**Stage:** 2B — Authoritative Pricing Engine  
**Batch:** 2B.6A (item CRUD adopted) · gate issued 2B.5  
**Date:** 2026-08-04  
**Purpose:** Formal readiness checklist and adoption status for pricing actions.  
**Authority:** Commercial engine is authoritative for **add / update / duplicate / delete-aggregate** item paths (Batch **2B.6A**). Other pricing actions remain legacy until later batches.

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

**Programme suites:** golden **60/60**, contract **37/37**, shadow parity (0 blockers), GST 2B.5, focused 2B.6A adoption.

---

## GST source rule (live pricing)

| Moment | Source |
| --- | --- |
| Creation | Organisation settings (`default_gst_rate`), else application default **15%** via nullish fallback |
| Ongoing | Stored `pricing_documents.gst_rate` (including **0%**) |
| User GST update | Validated mutation value persisted in the same operation |
| Recalculation | Current stored document GST (or mutation value being persisted) |
| Quote from pricing | Pricing snapshot GST — quote arithmetic unchanged in 2B.6A |

Helpers: `lib/pricing/gst-source.ts`; aggregate on adopted paths: `lib/pricing/authoritative-document-totals.ts`.

---

## Adoption status summary

| Action | Ready? | Adopted? |
| --- | --- | --- |
| createPricingFromEstimate | Yes | **No** (2B.6B) |
| updatePricingDocument | Yes | **No** (2B.6B; shared aggregate may run on GST change) |
| updatePricingItem | Yes | **Yes (2B.6A)** |
| addPricingItem | Yes | **Yes (2B.6A)** |
| duplicatePricingItem | Yes | **Yes (2B.6A)** |
| deletePricingItem | Yes | **Yes (2B.6A)** |
| markPricingReviewed | Yes | No |
| Pricing reads | Yes | No |
| Recalibration | Conditional | No |

**Rollback for 2B.6A:** `lib/pricing/adoption-authority.ts` (`PRICING_ITEM_CALCULATION_AUTHORITY`) or git revert.

### updatePricingItem / addPricingItem / duplicatePricingItem / deletePricingItem

- Auth, ownership, Zod validation preserved.
- Engine authority via `lib/pricing/commercial-engine-adapter.ts`.
- Unknown-cost: engine null metrics → DB sentinel **0** (never fabricated 100%).
- Update sets `manually_edited=true`; duplicate does not copy that flag.
- Document GST from stored rate; aggregate margin from aggregate totals; GST once.
- Evidence: `docs/implementation/STAGE_2B_BATCH_2B6A_COMPLETION.md`.

### Not adopted in 2B.6A

`createPricingFromEstimate`, full `updatePricingDocument`, `markPricingReviewed`, reads, recalibration, estimates, quotes, UI.

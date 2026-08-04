# Pricing Action Adoption Gate

**Stage:** 2B — Authoritative Pricing Engine  
**Updated:** Batch **2B.6B** (pricing domain complete for server mutations)  
**Date:** 2026-08-04  

Commercial engine is authoritative for all **pricing-domain server mutations** listed below. Estimates, quotes, and UI live previews remain legacy until later batches.

---

## Adoption status

| Action | Ready? | Status |
| --- | --- | --- |
| addPricingItem | Yes | **Adopted** (2B.6A) |
| updatePricingItem | Yes | **Adopted** (2B.6A) |
| duplicatePricingItem | Yes | **Adopted** (2B.6A) |
| deletePricingItem | Yes | **Adopted** (2B.6A) |
| updatePricingDocument | Yes | **Adopted** (2B.6B) — GST aggregate; metadata-only fields |
| createPricingFromEstimate | Yes | **Adopted** (2B.6B) |
| Recalibration apply | Yes | **Adopted** (2B.6B) — preserves `manually_edited` |
| markPricingReviewed | Yes | **Not Applicable** — no arithmetic |
| Pricing read mappers | Yes | **Adopted** (2B.6B) — persisted totals + derived `cost_known` |
| Estimate generation | — | **Not Adopted** (2B.7) |
| Quote arithmetic | — | **Not Adopted** (2B.8) |
| UI / client calculations | — | **Not Adopted** (2B.9) |

**Pricing-domain server financial authority:** complete for mutations + recalibration + create-from-estimate.  
**Rollback:** `lib/pricing/adoption-authority.ts` or git revert.

### Unknown-cost (no DB column)

Sentinel: persist cost 0 + sell > 0 with profit/margin/markup 0. Read mapper sets `cost_known=false`. Do not treat stored 0% as a real margin.

### updatePricingDocument product intent

No document-level margin field. GST-only changes do not alter GST-exclusive line money.

Evidence: `docs/implementation/STAGE_2B_BATCH_2B6B_COMPLETION.md`.

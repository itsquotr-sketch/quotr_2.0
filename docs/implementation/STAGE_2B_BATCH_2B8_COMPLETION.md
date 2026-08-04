# Stage 2B — Batch 2B.8 Completion Report

**Batch:** 2B.8 — Authoritative Commercial-Engine Adoption for the Quote Domain  
**Date:** 2026-08-05  
**Stage 2B status:** In Progress  
**Live adoption:** Quote-domain aggregates (visible_only + GST) and draft line total resolution  

---

## 1. Objective

Make quote document totals and draft line sell resolution use the commercial engine as financial authority, while preserving quote immutability, revision history, Stage 2A security, document GST, and historical commercial truth. Estimates, pricing, UI, migrations, AI prompts, and Company DNA unchanged.

## 2. Quote paths audited

| Path | Location | Disposition |
| --- | --- | --- |
| Document aggregate | `calculations.ts` `calculateQuoteTotals` | Legacy retained; production → adapter |
| Line total | `calculateQuoteItemTotal` | CD-22 prefer-total retained; qty×price via engine |
| Pricing → quote map | `from-pricing.ts` | Transform only (no arithmetic adopt) |
| Snapshot build | `build-from-pricing.ts` | **Adopted** aggregate |
| Draft recalc | `actions.ts` `recalculateAndPersistQuoteTotals` | **Adopted** |
| Create from pricing | `createQuoteFromPricing` | Via snapshot |
| Revise (copy) | `reviseQuote` | Copy money — no recalc |
| Revise from pricing | `reviseQuoteFromFinalPricing` | New snapshot via engine |
| Item update / visibility / delete | draft-only + recalc | **Adopted** aggregate |
| Read/print mappers | `mappers.ts`, workspace/print | Stored-only — no adopt |
| Status transitions | sent/accepted/… | No money |

Stable IDs: LEG-Q-01 … LEG-Q-06.

## 3. Paths adopted

- Quote document aggregation (`visible_only` + document GST)
- Create quote from reviewed pricing (snapshot totals)
- Refresh / revise-from-final-pricing (new revision snapshot)
- Draft item update line total resolution
- Draft visibility toggle and delete aggregates

## 4. Paths deferred / unchanged

| Path | Why |
| --- | --- |
| `reviseQuote` money copy | Historical guarantee — copy, do not recalc |
| Read/print UI | Stored display; UI calc removal is 2B.9 (already stored) |
| Pricing↔quote visible divergence UX (S1-010 / CD-21) | Stage 6 residual |
| Pure legacy helpers | Parity + rollback |
| Cost/GP on quotes | Product has sell-side quotes only |

## 5. Historical guarantees

Once a quote row exists:

- Engine version changes do **not** rewrite stored sell, GST, or totals
- Sent/accepted/declined/expired/superseded money is never bulk-recalculated
- Reads and print return persisted fields only
- OCD-45 / CD-20 immutability preserved

## 6. Snapshot guarantees

- Create and revise-from-pricing snapshot sell lines from pricing `total_sell` (visible_on_quote)
- Document GST from pricing doc → org default → application default at snapshot time
- Snapshot aggregates via engine `visible_only`
- Source pricing document is not mutated by quote create

## 7. Revision guarantees

- `reviseQuote`: new draft row; **copies** money fields and item totals; supersedes source (metadata only); source money unchanged
- `reviseQuoteFromFinalPricing`: new draft from fresh pricing snapshot (engine totals); prior revision untouched
- Draft edits require `assertQuoteEditable` (not superseded)

## 8. CD-22 prefer-total decision

**Confirmed retain:** when a draft quote item supplies an explicit `total`, that total wins over qty × unit_price. Intentional client-facing snapshot/edit policy. When total is omitted, qty × unit_price runs through the engine (sell-only quantity_rate).

## 9. GST treatment

- Authoritative path requires finite GST 0–100 (no silent NaN→15)
- GST applied once on visible sell subtotal
- 0% preserved
- Stored quote `gst_rate` used on draft recalcs

## 10. Security preservation

Stage 2A auth, org ownership, Zod schemas, sanitized errors, draft edit gates unchanged.

## 11. Rollback

`QUOTE_CALCULATION_AUTHORITY = "legacy"` in `lib/quotes/adoption-authority.ts`, or git revert 2B.8. Independent of pricing/estimate switches. No dual writes.

## 12. Production adapter

`lib/quotes/quote-commercial-engine-adapter.ts`

- `calculateAuthoritativeQuoteTotals` — `visible_only`, GST, sell-side `cost_known=false`
- `resolveAuthoritativeQuoteItemTotal` — CD-22 + engine qty×price
- No parity imports; no Supabase

## 13. Files changed

**Created**

- `lib/quotes/adoption-authority.ts`
- `lib/quotes/quote-commercial-engine-adapter.ts`
- `scripts/verify-batch-2b8-quote-adoption.ts`
- `docs/implementation/STAGE_2B_BATCH_2B8_COMPLETION.md`

**Modified**

- `lib/quotes/build-from-pricing.ts`
- `lib/quotes/actions.ts`
- `lib/quotes/calculations.ts` (legacy comments)
- `lib/commercial-engine/parity/fixtures.ts` (CD-22 notes)
- Audit, compatibility matrix, implementation plan, MVP guide

## 14. Tests and results

`scripts/verify-batch-2b8-quote-adoption.ts` — **32/32**

Full chain: `tsc`, lint, build; 2A.1–2A.3A; golden **60/60**; contract **37/37**; parity 0 blockers; 2B.5–2B.7; 2B.8 — all passed.

## 15. Remaining gaps

- Client/UI calculation removal across remaining domains (2B.9)
- S1-010 pricing-all vs quote-visible UX warning (Stage 6)
- Quote rows still do not persist cost/GP (by product design)

## 16. Recommendation for Batch 2B.9

Remove remaining client-side financial authority (pricing/estimate display helpers) so UI only displays server/engine persisted values; no formula ownership in React.

---

## Future Learning Compatibility Check

1. Snapshots structured and replayable from stored inputs? **Yes** (line totals + gst_rate).
2. Manual draft totals identifiable (prefer-total)? **Yes.**
3. Revisions stable IDs / history? **Yes.**
4. Historic quotes immutable? **Critical yes.**
5. Revise-from-pricing as evidence trail? **Yes.**
6. Company DNA cannot alter arithmetic? **Yes.**
7. Customer gets consistent quote totals today? **Yes.**

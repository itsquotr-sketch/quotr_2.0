# Commercial Snapshot Safety

**Classification:** CANONICAL — snapshot kinds. Quote send immutability: BRANDING-SNAPSHOT-01 + QUOTE-2.  
**Status:** Active — COMMERCIAL-P0  
**Date:** 2026-08-13  
**Related:** `lib/commercial-engine/core/cost-first-authority.ts`, CF-D4

---

## Artefact classification

| Artefact | Kind | Behaviour |
| --- | --- | --- |
| Quick Estimate (live assistant) | **LIVE DERIVED** after regenerate; persisted row is the current project estimate | Margin edit updates estimate totals in place |
| Pricing document (`needs_recalibration = false`) | **RECALIBRATABLE SNAPSHOT** | Current commercial working set for final pricing |
| Pricing document (`needs_recalibration = true`) | **RECALIBRATABLE SNAPSHOT (stale)** | Must not appear “current”; RecalibrationBanner |
| Pricing `status = archived` | **HISTORICAL / IMMUTABLE** | Excluded from `markPricingDocumentsNeedingRecalibration` |
| Quote `status = draft` (active) | **RECALIBRATABLE SNAPSHOT** | Editable; refresh-from-pricing is explicit user action |
| Quote `sent` / `accepted` / superseded | **HISTORICAL / IMMUTABLE SNAPSHOT** | Money does not silently change; revision creates a new draft |

Helpers: `commercialSnapshotKindForPricingDocument`, `commercialSnapshotKindForQuote`.

---

## Margin edit contract (CM-02 / CF-D4)

```
updateEstimateMargin
  → recalculate estimate lines from cost via F-SFM
  → persist estimate totals
  → markPricingDocumentsNeedingRecalibration (non-archived)
  → do NOT rewrite quote rows
  → R2 optimistic UI reconciles estimate totals
```

Issued quotes remain historical. User refreshes draft quotes from pricing after recalibrating pricing when desired.

**QUOTE-IMMUTABILITY-DB-01** (before public quote send/acceptance Production): add DB-level defense-in-depth preventing mutation of immutable sent/accepted snapshots. Application-level safety remains. Do not migrate in this batch.

---

## Forbidden behaviours (enforced by product architecture)

- Old sent/accepted quote silently changing after margin edit
- Pricing appearing current while estimate margin differs (must show needs_recalibration)
- Treating legacy charge-out as cost then applying GM again (engine + factories)
- Markup as a sell authority

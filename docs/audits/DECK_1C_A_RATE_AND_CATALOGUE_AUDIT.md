# DECK-1C-A Rate and Catalogue Audit

**Status:** AUDIT — DECK-1C-A **OWNER VALIDATED** (planning). CAT-IDENTITY-01 implementation follows.  
**Date:** 2026-08-18  
**HEAD:** `46b186202f727998c8578c3a14039ba9f9ba645c`  
**Branch:** `hardening/stage-2a-security`

Planning only. No prices added. No production code changed.

---

## 1. Current HEAD

| Item | Value |
| --- | --- |
| Branch | `hardening/stage-2a-security` |
| Local HEAD | `46b186202f727998c8578c3a14039ba9f9ba645c` |
| Remote HEAD | `46b186202f727998c8578c3a14039ba9f9ba645c` |
| DECK-1A | `ca1e137bd12c0602ffb8f2fa8006ab82f94387e1` |
| DECK-1B feature | `60a356e005897be8ca1e54a20204eeca352b592d` |
| DECK-1B docs | `46b186202f727998c8578c3a14039ba9f9ba645c` |

---

## 2. What exists today (reuse)

| Layer | Current | Reuse? |
| --- | --- | --- |
| Company rates | `public.rates` — org-scoped; unique `(org_id, rate_type, item_key)`; `cost_rate` nullable; cost-first UX | **Yes** as company **cost** authority |
| Quotr common rates | TypeScript catalogues (`lib/rates/specific-material-catalogue.ts`, `lib/rates/catalogue.ts`) with `item_key` + optional `defaultCostRate` | **Yes** as curated common **rate list** until materials table |
| Material resolver | `resolveMaterialRate` — exact item_key + unit; Deck **surface** also allows documented m²→lm | **Yes**; do not revive first-match / fuzzy |
| Rate source types | `RequirementRateSource` includes `company`, `project_override`, `supplier`, `benchmark`, `missing` | **Yes** |
| Requirement snapshot | Persists `materialKey`, `specification`, qty, `rateSource`, costs | **Yes** for historical evidence |
| Scope facts | `project_facts` SoT for physical spec | **Yes** |
| Cost-first | Company cost authority; sell derived | **Yes** |
| Authority hierarchy | Project → company exact → supplier → converted → calibrated → Quotr exact → package → required | **Yes** |

---

## 3. What is missing (extend later)

| Gap | Impact |
| --- | --- |
| No `materials` table | Cannot save a company material without a rate row |
| `item_key` **is** identity + unit (and DECK-1B adds assumed SG8) | CAT-IDENTITY-01 not implemented |
| No project material table | Custom spec is fact text + snapshot `specification` only |
| No save-for-future workflow | Rates UI edits company rows directly |
| Zero framing sizes in live catalogue | Structural children `priced=false` / `missing` |
| Unique constraint on `item_key` without unit column | Future identity/unit split needs generated key or unique `(org, material_id, unit)` |
| Scope Discovery catalogue | Unrelated (relationship catalogue); Production SD disabled |

Do **not** create a second pricing engine or a third catalogue system.

---

## 4. Current Deck structural identity (as coded)

`lib/estimate/deck-structure.ts`:

```
timber.sg8.{section}.{treatment}.{lm|ea}
concrete.footing.m3
```

Defects vs this lock (identity only; quantities OK):

1. **Grade SG8 assumed** in every timber key.
2. **Unit embedded** in material identity.
3. **`concrete.footing.m3`** freezes component use into material identity.
4. **Treatment required** to emit any structural facts (`readDeckStructureFacts` null without `deck.framing_treatment`) — quantity does not depend on treatment.

Physical DECK-REF-01 quantities verified frozen:

| Child | Purchase |
| --- | ---: |
| Joists | 42.32 lm |
| Rim | 10.92 lm |
| Bearers | 10.92 lm |
| Supports | 8 EA |
| Concrete | 0.324 m³ |

No formula change in this batch.

---

## 5. Company catalogue storage

`public.rates` (migration `002_assistant_schema.sql`):

- `org_id` NOT NULL — **company only**; no global rate rows in DB
- Quotr benchmarks live in **code**, not `public.rates`
- No materials entity
- Inserting a rate with `cost_rate = null` is possible but is **not** a materials catalogue; Rates UI treats blank as “use Quotr benchmark”, which is the **opposite** of pricing-required custom timber

**Smallest future change (proposed, not migrated):** one `materials` table scoped by `org_id` / `project_id` (see company contract). Rates gain optional `material_id` later. Until then, DECK-1C-B may add **code** catalogue entries without prices, or with prices only after Owner identity approval — still not a DB migration unless save-for-future ships.

---

## 6. Deck surface vs structural (do not conflate)

| | Surface (`decking.surface`) | Structural children |
| --- | --- | --- |
| Authority | REQUIREMENT_AUTHORITATIVE | SHADOW |
| Identity | `deck.material.{species}.lm` compatibility keys | defective `timber.sg8.*` |
| Conversion | Company m² → lm when board width known | **Forbidden** vs `deck.substructure.m2` |
| Money | Requirement | Legacy `deck.substructure.m2` package |

---

## 7. CAT-IDENTITY-01 assessment

Original gate: **blocks Catalogue V2 seeding** — physical identity separate from rate unit and supplier SKU.

DECK-1C-A **is** the product contract for that gate in the Deck structural context (plus three-scope company/project custom).

**Sequencing recommendation:** implement CAT-IDENTITY-01 as a **small DECK-1C-A-R1** after Owner identity approval, **before** DECK-1C-B prices:

- types + normalization helpers
- stop embedding SG8 / unit / `footing` in identity
- completeness rules
- curated common **definitions without prices**

Do **not** implement in this planning batch. Do **not** start broad Catalogue V2.

---

## 8. Commercial safety (unchanged)

- Structural children: SHADOW / unpriced
- Legacy `deck.substructure` money authority
- `decking.surface` REQUIREMENT_AUTHORITATIVE
- `deck.labour` SHADOW
- Deck 1 golden **$48,340**
- Production SD disabled
- No Production deploy

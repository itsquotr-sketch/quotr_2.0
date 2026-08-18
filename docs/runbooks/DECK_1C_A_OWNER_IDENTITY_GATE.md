# DECK-1C-A Owner Identity Gate

**Status:** COMPLETE / OWNER VALIDATED  
**Date:** 2026-08-18  
**HEAD at planning:** `46b186202f727998c8578c3a14039ba9f9ba645c`

Owner approved the three-scope material architecture. CAT-IDENTITY-01 implementation follows this gate. **No prices. No materials DB table. No DECK-1C-B.**

---

## Owner decisions (locked)

| # | Decision | Owner lock |
| --- | --- | --- |
| 1 | Three scopes | Quotr Common / Company / Project custom. Custom is valid without catalogue membership. |
| 2 | Common lists | **UX convenience only** — not a validation whitelist. `200x50` / LVL / special products remain valid. |
| 3 | Material ≠ rate | Material may exist with rate missing → `priced=false`. |
| 4 | Grade | **Optional.** Do not assume SG8. Unknown stays unknown. |
| 5 | Treatment | Normalize known classes; unknown/custom allowed. No fuzzy substitution. **Not a physical emission gate.** |
| 6 | Section minimum | Structural timber MaterialRequirement requires **section**. Treatment/grade/species optional. Section unknown → do not fabricate timber identity. Quantity math stays separate. |
| 7 | Supports | Physical **EA**. Exact EA rate or pricing required. No invented length. |
| 8 | Concrete | Family `concrete`; mix optional. Unknown mix still emits; no automatic benchmark in CAT-IDENTITY-01. |
| 9 | Identity shape | No component name. No rate unit. No assumed SG8. |
| 10 | Save-for-future | Explicit only. No silent company/global mutation. Contract only — not implemented. |
| 11 | Project vs company rate | User chooses project-only or update company. Not implemented in this batch. |
| 12 | Materials table | **Deferred.** No migration 037. |
| 13 | CAT-IDENTITY-01 | Implement as DECK-1C-A-R1 **before** DECK-1C-B prices. |
| 14 | Assistant vs Pricing | Physical spec vs commercial override. Physical changes regenerate. |

---

## Checklist

- [x] Three-scope model accepted
- [x] Material may exist without rate
- [x] Custom is first-class (not whitelist)
- [x] Conservative exact matching accepted
- [x] 140×45 ≡ 45×140 as **stock** identity accepted
- [x] Grade not assumed
- [x] Support remains EA
- [x] Concrete mix-unknown emits, unpriced unless later approved benchmark
- [x] CORE common range is convenience, not a boundary
- [x] CAT-IDENTITY-01 as DECK-1C-A-R1 before 1C-B
- [x] Treatment must **not** gate physical timber emission
- [x] No DECK-1C-B until identity foundation lands

---

## Outcome

| Item | Status |
| --- | --- |
| DECK-1C-A | COMPLETE / OWNER VALIDATED |
| CAT-IDENTITY-01 / DECK-1C-A-R1 | COMPLETE / TECHNICALLY VALIDATED (this branch) |
| DECK-1C-B | READY / NOT STARTED |

---

## Explicit non-actions

- No prices, scraping, or guessed unit costs
- No structural authority promotion
- No `deck.substructure` money change
- No Production deploy / Production SD
- No materials table / no migration

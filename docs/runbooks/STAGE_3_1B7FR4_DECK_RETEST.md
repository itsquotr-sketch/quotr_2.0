# Stage 3.1B.7F-R4 — Owner Deck Retest

**Status:** Pending Owner Preview capture  
**Branch:** `hardening/stage-2a-security`  
**Preview URL:** `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`  
**Defects:** DECK-R4-01 (balustrade explicit no), DECK-R4-02 (site constraints)  
**Verify:** `npx tsx scripts/verify-stage-3-1b7fr4-scope-negatives-constraints.ts`

---

## Exact scenario (paste as project brief)

Replace an existing elevated timber deck, approximately 5.2m × 3.1m and around 1.2m above ground. Remove the existing deck. New hardwood decking and new substructure where required. Include fascia and one step. No balustrade required. Restricted rear access with approximately 25–30m manual carry for materials and waste.

---

## Short checklist

1. **Create** Deck project using the exact scenario above.
2. **Analyse** Job.
3. **Confirm** Deck Work Area.
4. **Scope Review**
   - Balustrade **not** selected by default (unchecked / Not required).
   - User can still check Balustrade via Edit scope if needed.
   - Demolition / existing removal represented appropriately (included or clearly covered).
   - Fascia / face boards selected (or clarification pending) when catalogue recommends.
5. **Scope Details**
   - Clarify existing substructure condition routes correctly when selected.
6. **Site Constraints**
   - Restricted / difficult access appears (human label, not raw key).
   - Material carry distance band covering **25–30m** appears (e.g. `10–30m`).
7. **Answer Scope Details** (detail-only / mapped clarification)
   - Scope Review stays **CURRENT** — no false Analyse again.
8. **Generate Quick Estimate**
   - No commercial regression; estimate generates.

---

## Pass criteria

| Check | Pass when |
| --- | --- |
| DECK-R4-01 | Balustrade unchecked by default with explicit “No balustrade required” |
| DECK-R4-02 | Access + carry constraints populated from brief |
| Staleness | Detail answers do not force Analyse again |
| Manual override | Checking Balustrade still works |

Do **not** close Stage 3.1B or enable Production Scope Discovery from this retest alone.

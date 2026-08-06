# Stage 3.1B.6R3.1 — Preview Retest

**Status:** Preview Retest Pending  
**Depends on:** Stage 3.1B.6R3 Preview baseline + this batch deployed to Preview  
**Production:** Disabled  

---

## Prerequisites

- Scope Discovery flag enabled on Preview (same as R3)
- Project with confirmed Work Areas and confirmed Scope Review
- At least one scope-signal Fact answerable (e.g. existing deck removal,
  balustrade required)

---

## Retest checklist

### Classification → UI

1. Change a **detail-only** Fact (length / area) → no recommendation; no
   Analyse again.
2. Answer demolition **no** while Demolition is Included → **Scope changes to
   review** recommends Mark not required.
3. Answer balustrade **yes** while Balustrade is Not required → recommends
   Include in scope.
4. Confirm raw Fact keys / suggestion IDs are not visible in the panel.

### Apply change

5. Apply Mark not required → Demolition moves to Not required; no new Work
   Area; no new Fact; related unanswered questions suppress after refresh.
6. Apply Include → item Included; applicable questions appear; no fabricated
   measurements.
7. Double-click Apply → second attempt blocked / safe error; state remains
   correct.
8. Refresh page → applied state retained.

### Keep current scope

9. Trigger an exclusion recommendation → Keep current scope → recommendation
   disappears; scope state unchanged; Fact unchanged.
10. Refresh without changing the Fact → recommendation does **not** return.
11. Change the triggering Fact materially again → a new recommendation may
    appear.

### Staleness

12. Applying or keeping a recommendation must **not** show Analyse again.
13. Changing the project brief / high-level Work Areas still can stale and
    show Analyse again.

### Estimate soft warning

14. With an unresolved recommendation, Estimate panel may warn but still
    allow Generate.

### Regression smoke

15. Analyse Job staged loading still works.
16. Batch Confirm Scope / Edit scope still works.
17. Quality gating still requires confirmed scope.
18. Quick Estimate breakdown still shows scope drivers.
19. Estimate Review remains collapsible.

---

## Sign-off

| Item | Result |
| --- | --- |
| Preview URL | |
| Tester | |
| Date | |
| Pass / Fail | |
| Notes | |

After Preview pass, update backlog: Stage 3.1B.6R3.1 Preview complete;
Stage 3.1B.6 Preview sign-off still requires full 3.1B.6 UI checklist.

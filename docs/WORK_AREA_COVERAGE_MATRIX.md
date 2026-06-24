# Work area coverage matrix

Snapshot of **current product capability** for calibration testing. Status reflects code and templates in the repo — not field-proven accuracy.

Legend:

- **Yes** — implemented in product (still needs calibration testing)
- **Partial** — implemented with known limitations
- **No** — not implemented for this work area
- **To test** — capability exists but real-world accuracy not yet validated

> During calibration testing, do not judge one number alone. Review recognition, questions, facts, assumptions, estimate line items, final pricing, and quote output together.

Last updated: Phase 6I (pre-calibration readiness).

## Summary matrix

| Work area | AI recognition | Questions | Estimate calculator | Final pricing mapping | Quote description | Rates / calibration | Known gaps | Priority |
|-----------|----------------|-----------|---------------------|----------------------|-------------------|---------------------|------------|----------|
| Deck | To test | Yes | Yes | Yes | Yes (fact-aware) | Starter scope rate | Recognition accuracy; rate/productivity tuning | P1 |
| Retaining wall | To test | Yes | Yes | Yes | Yes (fact-aware) | Starter scope rate | Height/length edge cases; engineering exclusions | P1 |
| Bathroom renovation | To test | Yes | Yes | Yes | Yes (fact-aware) | Starter scope rate | Fixture/subbie allowances; tiling scope | P1 |
| Kitchen renovation | To test | Yes | Yes (rough) | Yes | Yes (fact-aware) | Starter scope rate | Marked rough allowance; subbie-heavy | P1 |
| Fence | To test | Yes | Yes (rough) | Yes | Yes (fact-aware) | Starter scope rate | LM vs gate/demolition combinations | P1 |
| Pergola | To test | Yes | Yes (rough) | Yes | Yes (fact-aware) | Starter scope rate | Often disabled by default in setup | P2 |
| Demolition / strip-out | To test | Yes | Yes (rough) | Yes | Partial (name-based) | Starter hourly scope rate | May merge with parent scopes; hourly allowance only | P1 |
| Internal walls | To test | No | No | Partial | Partial (generic) | Starter scope rate | No questions/calculator; manual scope only | P2 |
| Ceilings | To test | No | No | Partial | Partial (generic) | Starter scope rate | No questions/calculator | P2 |
| Doors | To test | No | No | Partial | Partial (generic) | Starter scope rate | No questions/calculator | P2 |
| Flooring | To test | No | No | No | Partial (name-based) | Starter scope rate | No calculator — estimate shows missing calculator | P2 |
| Painting | To test | No | No | No | Partial (name-based) | Starter scope rate | No calculator — estimate shows missing calculator | P2 |

## Column definitions

| Column | Meaning |
|--------|---------|
| **AI recognition** | Brief/site-note analysis can suggest this type if **enabled** for the org |
| **Questions** | Scope question templates in `lib/scopes/templates/` |
| **Estimate calculator** | Dedicated calculator in estimate engine |
| **Final pricing mapping** | Estimate line items carry `work_area_id`; pricing groups by work area |
| **Quote description** | Auto draft in quote builder (`lib/work-areas/quote-description.ts`) |
| **Rates / calibration** | Starter scope rate row in org setup |
| **Known gaps** | Documented limitations from code review — expand during testing |
| **Priority** | Suggested calibration focus (P1 = core external/reno trades) |

## Per work area notes

### Deck

- Calculator: structured deck line items (area, material, stairs, balustrade, demolition flags).
- Questions: deck area, material, level, stairs, balustrade, demolition.
- Quote: rich draft from facts + pricing keywords.

### Retaining wall

- Calculator: length/height driven.
- Questions: length, height, material, drainage, etc.
- Quote: fact-aware retaining wall wording.

### Bathroom renovation

- Calculator: area and finish-driven (estimate-ready in catalogue).
- Questions: extensive bathroom template set.
- Quote: area and tiling extent.

### Kitchen renovation

- Catalogue: **rough allowance**; calculator exists but simpler than bathroom.
- Questions: kitchen template set.
- Quote: area-based renovation wording.

### Fence

- Catalogue: rough allowance; calculator produces LM-based items.
- Questions: length, height, material, gate, demolition.
- Quote: length/height/material aware.

### Pergola

- Default **disabled** in catalogue — enable in org setup to test recognition.
- Calculator + questions exist; rough allowance level.

### Demolition / strip-out

- Often embedded in other scopes (deck/fence demolition flags); standalone demolition work area supported.
- Calculator: hourly/allowance style.
- Quote description uses work area **name** more than structured facts.

### Internal walls, ceilings, doors

- Enabled in catalogue as rough allowance with starter **per m²** or **per door** rates.
- **No** scope question templates and **no** estimate calculators.
- Estimate run reports “No calculator available” if these are the only confirmed areas.
- Quote falls back to **generic** scope paragraph unless manually edited.

### Flooring, painting

- Starter rates exist; quote has name-based draft helpers.
- **No** calculators or questions — same estimate gap as internal fitout types above.

## Work areas not in this matrix

**External stairs** exists in the product catalogue with calculator, questions, and quote support. Include in tests if relevant to your jobs; add a row to your copy of this matrix when you enable it.

## How to use during calibration

1. Pick test briefs that hit **P1** rows first (deck, retaining wall, bathroom, kitchen, fence, demolition).
2. For **P2** rows, record whether “partial/generic” behaviour is acceptable for pilot or needs P1 uplift.
3. When a cell says **To test**, your job is to move it to **Yes** or document a **P0/P1** gap — do not assume pass from this matrix alone.
4. Update this doc after the first calibration round with findings (optional; keep in your shared test notes if you prefer not to commit).

## Related docs

- [`CALIBRATION_TESTING_GUIDE.md`](./CALIBRATION_TESTING_GUIDE.md) — how to run tests
- [`CALIBRATION_TEST_TEMPLATE.md`](./CALIBRATION_TEST_TEMPLATE.md) — per-project scoring
- [`DEMO_WORKFLOW.md`](./DEMO_WORKFLOW.md) — standard click path
- [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md) — product limits for test users

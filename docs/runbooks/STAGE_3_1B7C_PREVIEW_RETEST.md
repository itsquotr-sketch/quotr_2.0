# Stage 3.1B.7C — Preview Retest

**Stage:** 3.1B.7C — Question Organisation, Estimate Presentation and Confidence Explanation  
**Status board:** Complete — Local; Preview sign-off — Pending  
**Production:** Disabled  

Use a Preview project with Scope Discovery enabled and at least one Deck Work Area.

## Smoke checklist

### Scope Details

1. Open active Scope Details.
2. Confirm questions are grouped under category headings within each Work Area.
3. Confirm empty categories are not shown.
4. Leave a required measurement unanswered — that category shows **Required** and starts expanded.
5. Answer it — category can collapse; reopen completed categories.
6. Confirm answer chips / fields keep local values while saving (no flash to empty).
7. Expand **Why this matters** on height / existing pile / carry where present.
8. Confirm no raw Fact keys or IDs are visible.

### Site Constraints

1. Open Site Constraints (active or completed editable).
2. Confirm category groups (Access and Movement, etc.).
3. Confirm **Project-wide** labelling.
4. Edit a constraint and save — behaviour unchanged.

### Estimate Review

1. Collapse to summary: Description, Measurements, Scope, Assumptions,
   Site constraints, Outstanding, Estimate readiness.
2. Click **Review details** — all previous fields and editors remain.
3. Outstanding Work Areas expand by default.

### Quick Estimate

1. Confirm **Estimate confidence** % matches the estimate record (unchanged).
2. Confirm Complete / Outstanding confidence drivers are qualitative only.
3. Confirm project-health strip (Work Areas, included scope, clarifications,
   unanswered details, assumptions, readiness).
4. Open **View full breakdown** — WA sections use progressive disclosure;
   Commercial breakdown still lists all line items; Not required separate.
5. Confirm no new money totals appear that were not already on the estimate.

### Terminology

Visible labels should include: Project Capture, Work Areas, Scope Review,
Specification, Scope Details, Site Constraints, Estimate Review, Quick Estimate.

### Accessibility / responsive

1. Narrow viewport — groups stack; no horizontal scroll on Assistant column.
2. Keyboard expand/collapse category headers and breakdown sections.
3. Screen-reader labels for source / unresolved / confidence driver lists.

## Sign-off

- [ ] Preview retest complete  
- [ ] No engine / pricing regressions observed  
- [ ] Ready for Stage 3.1B.7D planning (do not start 7D in this batch)

## Verify command

```bash
npx tsx scripts/verify-stage-3-1b7c-question-estimate-presentation.ts
```

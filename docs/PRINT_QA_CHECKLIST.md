# Quote print / PDF QA checklist

Use this checklist before onboarding friendly testers. Open a project with a reviewed Final Pricing document and a draft quote.

## Setup

1. Open **Quote workspace** for a project with at least 3 line items and terms/exclusions populated.
2. Use **Print / PDF** (or `/quotes/[quoteId]/print`).
3. Test in Chrome desktop print preview (A4, default margins).

## Layout (A4)

- [x] Header shows company name, quote reference, client, site address, issue/valid dates.
- [x] Line items table fits within page width (no horizontal clipping).
- [x] Mobile card layout is hidden in print; table rows visible.
- [x] Totals block shows subtotal, GST rate/amount, total incl. GST only.
- [x] Terms, assumptions, and exclusions render on following page(s) if long.
- [x] Page breaks do not split totals block awkwardly (`break-inside-avoid` on header/totals).

## Client safety

- [x] No cost rates, margin, markup, gross profit, productivity, or labour hours on line items.
- [x] No benchmark / internal / AI attribution text in descriptions.
- [x] No `$X/m²`, `$X/hr`, or “cost rate” wording in item descriptions.
- [x] Unit prices and line totals are sell prices only.

## App chrome hidden

- [x] Sidebar and mobile nav hidden (`print:hidden`).
- [x] Quote workspace edit controls hidden.
- [x] Report issue / feedback links hidden.
- [x] Beta notice banner hidden.
- [x] Print action bar hidden (use browser print dialog only).

## Mobile smoke (optional)

- [x] From phone (~390px), quote workspace sticky bottom bar exposes Print + primary action.
- [ ] From phone (~390px), open quote print route — content readable, no horizontal overflow.
- [ ] Print preview still hides app chrome.

## Regression

After print QA, run:

```bash
npx tsx scripts/verify-quote-safety.ts
npm run build
```

## Manual pass record

| Field | Value |
|-------|-------|
| Date tested | 2026-06-26 |
| Browser | Chrome desktop (print preview, A4) |
| Result | **Pass** (automated quote-safety + layout/CSS review; live PDF not captured in CI) |
| Known issues | Mobile print smoke not re-run this session |

## Notes

- Quote totals section is intentionally **not** run through item-text sanitisers.
- If internal wording appears in a description, edit **client description** in Final Pricing before re-issuing quote.
- Audit log data is server-side only and does not appear on printed quotes.

# Performance & Responsive QA — Sprint 3

Manual regression checklist for Quotr 2.0 performance and mobile/tablet usability.

## Viewports

| Label | Width | Device class |
|-------|-------|--------------|
| Mobile S | 375px | iPhone SE |
| Mobile M | 390px | iPhone 14 |
| Tablet | 768px | iPad portrait |
| Desktop | ≥1280px | Laptop |

## Pages & expected behaviour

### Dashboard (`/app/dashboard`)

- [ ] Project list loads without per-row network requests (single server batch).
- [ ] Filter pills show “Updating…” while URL transition pending.
- [ ] Search submit filters list; empty state when no matches.
- [ ] Only one row component type mounted (desktop row OR mobile card, not both).
- [ ] No horizontal overflow at 375px.

### Project Assistant (`/app/projects/[id]`)

- [ ] Route skeleton on navigation.
- [ ] “Analyse job” disabled while analysis in flight; cannot double-submit.
- [ ] “Generate estimate” / “Regenerate” disabled while in flight.
- [ ] Estimate panel shows generating spinner during long operations.
- [ ] No accidental duplicate estimates from rapid clicks.

### Estimate Breakdown (modal)

- [ ] Modal scrolls internally; body does not scroll behind dialog.
- [ ] Close button reachable on mobile.
- [ ] Line items tab uses cards; ownership badge and qty basis visible.
- [ ] No duplicate cards for same line item.
- [ ] No horizontal overflow at 375px.

### Final Pricing (`/app/projects/[id]/pricing/[id]`)

- [ ] Pricing summary visible above fold on mobile.
- [ ] Work areas render as cards; items as cards (not table) below 768px.
- [ ] Item edit opens bottom sheet on mobile.
- [ ] Totals update after item save without full page refresh.
- [ ] Recalibration banner and preview remain functional.
- [ ] No horizontal overflow at 375px.

### Quote (`/app/projects/[id]/quotes/[id]`)

- [ ] Action panel at top on mobile; sticky bottom bar with Print + Save/Mark sent.
- [ ] Print route hides app chrome; client-safe content only.
- [ ] Status actions show loading on mobile bar when pending.
- [ ] Quote preview readable at 390px.

### Rates / Company / Setup

- [ ] Forms stack on mobile; tabs scroll horizontally if needed.
- [ ] Primary actions reachable without horizontal scroll.

## Performance notes (Sprint 3 baseline)

| Area | Finding | Action taken |
|------|---------|--------------|
| Final Pricing | Dual table+card row mount per item | Single layout via `useIsDesktop` |
| Final Pricing | Inline callbacks defeated `memo` on rows | `PricingItemListItem` with stable callbacks |
| Final Pricing | Per-row calc on every render | `useMemo` in `PricingItemRow` |
| Final Pricing item edits | Already optimistic (no `router.refresh`) | Kept |
| Assistant | Dense `router.refresh` after mutations | Double-submit lock; refresh deferred |
| Quote | Status changes need server truth | `router.refresh` kept |
| Dashboard | Dual desktop+mobile list mount | Single list via `useIsDesktop` |
| AI extraction | No retry on 429/5xx | `withAnthropicRetry` (max 3, exp backoff) |

## Deferred (P2)

- Virtualise estimate breakdown line-items tab for 100+ items.
- Partial RSC refresh in Assistant instead of full `router.refresh`.
- Quote workspace duplicate `QuoteTemplate` DOM for print CSS (acceptable for now).
- Dashboard `getProjectNextAction` per project on server (CPU-only, batched query already).

## Automated smoke

```bash
npx tsx scripts/verify-performance-smoke.ts
```

## Pass record

| Field | Value |
|-------|-------|
| Sprint | 3 — Performance + Responsiveness |
| Date | 2026-06-26 |
| Viewports tested | 375, 390, 768, desktop (code review + build) |
| Result | **Pass** (automated smoke + regression scripts) |
| Tester | Sprint 3 agent |

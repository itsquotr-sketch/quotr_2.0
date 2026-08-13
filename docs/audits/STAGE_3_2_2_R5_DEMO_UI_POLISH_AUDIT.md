# Stage 3.2.2-R5 — Demo UI Polish Audit

**Date:** 2026-08-13  
**Baseline:** R4 `f177446`  
**Scope:** Presentation + disclosure only

---

## 1. Estimate Review cannot close — root cause

Ownership is already `estimateReviewDetailsOpen` in `AssistantShell`.

R4 wired **View estimate review** as:

```ts
setEstimateReviewDetailsOpen(true)
```

and forced the full card open with:

```ts
forceExpanded={Boolean(estimate?.isStale) || estimateReviewDetailsOpen}
```

`CollapsibleStageCard` treats `forceExpanded` as irreversible while true: local toggle sets `userExpanded=false`, but `isExpanded` remains true because `forceExpanded` wins. The strip never set `estimateReviewDetailsOpen` back to `false`.

**Fix direction:** Toggle the existing flag from the strip; stop forcing expand solely for details-open; sync card collapse via `onExpandedChange`.

---

## 2. Estimate Review visual prominence

Clear strip currently uses muted `bg-muted/15` / `border-border/50` and blends with setup.

**Direction:** Light warm/orange tint + subtle warm border; actionable remains stronger amber; no heavy shadow/gradient.

---

## 3. Mobile Site Notes nesting

`ProjectCaptureBlock` wraps notes in a bordered section **and** `SiteNotesCaptureCard` adds another dashed bordered composer → boxes-in-boxes.

**Direction:** On mobile, drop one border/background layer; keep progressive disclosure and persistence.

---

## 4. Scope Review copy

`SCOPE_DISCOVERY_UI_COPY` exposes architecture language (`structured scope checks`, `contextual suggestions`, long batch intro). Normal customers need: what was selected + untick guidance. Partial-failure gets one short professional line.

---

## 5. Project Conditions density

Secondary actions are three full `h-10` outline buttons → tall. Compact tertiary row; keep single Not sure; shorten “Use reasonable assumption” → “Use assumption” with existing helper copy.

---

## 6. Mobile Quick Estimate length

Four stacked disclosures after Prepare final pricing. Wrap under one mobile “Estimate details” disclosure (default collapsed). Desktop retains four. Integrate Margin Edit beside primary Margin metric to avoid duplicate Margin row when safe.

---

## Boundaries

No commercial / Fact / Constraint / SD / migration / 3.2.3 / DNA / PERF-FUTURE-01 work.

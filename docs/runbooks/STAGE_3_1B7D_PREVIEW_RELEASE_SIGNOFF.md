# Stage 3.1B.7D — Preview Release Sign-off

**Stage:** 3.1B.7D — Final Assistant UX Polish  
**Status board:** Complete — Local; Scope Discovery Preview sign-off — Pending Owner Test  
**Production:** Disabled  
**Release hardening:** Ready Pending Preview Sign-off  

Use this matrix before any broader Preview owner sign-off of Intelligent Scope Discovery.

---

## Feature disabled Preview

- [ ] No Scope Review card
- [ ] Existing Project Capture → Work Areas → Specification → Scope Details → Site Constraints → Estimate Review → Quick Estimate unchanged
- [ ] No scope discovery records created
- [ ] No provider calls from Scope Discovery path

## Feature enabled Preview

- [ ] Full unified journey
- [ ] Scope Review automatic run after Work Areas confirm
- [ ] Batch Confirm scope
- [ ] Specification gate after scope confirmation
- [ ] Grouped Scope Details + provenance / Why this matters
- [ ] Grouped Site Constraints
- [ ] Estimate Review summary-first + Review details
- [ ] Quick Estimate confidence / project health
- [ ] Scope-impact Apply / Keep
- [ ] Stale / Analyse again
- [ ] Pricing / quote regression smoke (no formula changes expected)

## Responsive

- [ ] 1440 desktop — Assistant + Quick Estimate side-by-side
- [ ] 1024 laptop — usable sticky / stack behaviour
- [ ] 768 tablet — cards stack; no horizontal scroll
- [ ] 390 mobile — Quick Estimate discoverable; dialogs usable; tap targets OK

## Accessibility

- [ ] Keyboard-only stage expand/collapse
- [ ] Dialog focus trap + return
- [ ] Screen-reader labels for status / save / loading
- [ ] `prefers-reduced-motion` — no jarring motion
- [ ] Error states announced; status not colour-only

## Performance (observational)

Record observed times (see `docs/performance/STAGE_3_1B7D_PREVIEW_PERFORMANCE_BASELINE.md`):

| Action | Observed |
| --- | --- |
| Initial Assistant server render | |
| Analyse Job | |
| Scope Review run | |
| Confirm scope | |
| Question save acknowledgement | |
| Question save completion | |
| Estimate generation | |
| Decision actions | |

Browser console may show `[quotr-preview-perf] …` in local/Preview only.

## Logs

- [ ] Vercel — no unexpected 5xx on Assistant actions
- [ ] Supabase — no RLS denials for expected owner paths
- [ ] Browser console — no API keys / provider body leaks

## Rollback

- [ ] Disable `SCOPE_DISCOVERY_ENABLED` (default off)
- [ ] Discovery data preserved (no destructive rollback)
- [ ] Workflow returns to feature-disabled behaviour

## Owner decision

- [ ] Preview sign-off complete  
- [ ] Or defer with listed blockers  

**Do not enable Production in this batch.**

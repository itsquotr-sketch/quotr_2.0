# Route performance testing (development)

## Dev timing logs

Server pages log load duration in development only via `measureServerLoad()` in `lib/perf/timing.ts`.

Example console output:

```text
[perf] dashboard: 142ms
[perf] project: 218ms
[perf] pricing: 186ms
[perf] quote: 164ms
```

No sensitive data is logged. Production builds skip timing entirely.

## Manual navigation checks

1. **Dashboard → Project** — skeleton appears immediately; project assistant loads without long blank screen.
2. **Project Assistant → Final Pricing** — tab transition shows loading skeleton when route data is pending.
3. **Final Pricing → Quote** — quote template shell appears quickly.
4. **Quote → Final Pricing** — return tab navigation feels responsive (links prefetch in viewport).
5. **Company Settings save** — no dashboard revalidation; save message only.
6. **Rates** — page skeleton on first visit; no dashboard refresh on rate edits.

## Browser tools

- Chrome DevTools → Network: disable cache, throttle Fast 3G, compare route transitions.
- React DevTools Profiler: verify no large client re-renders on tab switches.

## Revalidation scope

Dashboard revalidation should only run for dashboard-visible changes (project create/archive/status, quote status, pricing creation/reviewed). It should **not** run for:

- Constraint edits
- Pricing document metadata edits (title, terms, scope)
- Note proposal apply
- Quote draft metadata saves
- Company settings saves
- Rates edits

# Stage 3.1B.6 — Scope Discovery Preview Smoke Test

**Status:** Ready Pending Owner Preview UI Sign-off  
**Date:** 2026-08-06  
**Prerequisite:** Migrations 028/029 applied; Stage 3.1B.5C server integration deployed; this UI batch deployed  

---

## 1. Objective

Verify the Assistant Scope Review discovery workflow on Preview without enabling Production and without changing Analyse Job behaviour.

---

## 2. Configuration

**Preview**

```
SCOPE_DISCOVERY_ENABLED=true
```

Confirm Preview also has `ANTHROPIC_API_KEY` (and model env as used by the app).

**Production**

```
SCOPE_DISCOVERY_ENABLED=
```

or `false` — must remain disabled.

Do **not** add `NEXT_PUBLIC_SCOPE_DISCOVERY_ENABLED`.

Redeploy after any env change.

---

## 3. Deploy sequence

1. Deploy with flag **off** — confirm no Scope Review discovery card; Analyse Job works.  
2. Enable Preview flag only — redeploy.  
3. Run the checklist below.  
4. Optionally disable flag and confirm card disappears while accepted Work Areas remain.

---

## 4. Checklist

| # | Test | Pass |
| ---: | --- | --- |
| 1 | Feature disabled deployment: no Scope Review discovery card; Assistant layout unchanged | ☐ |
| 2 | Feature enabled Preview: Scope Review card appears after Work Areas are confirmed | ☐ |
| 3 | Analyse scope requires explicit click; no auto-run on load or brief edit | ☐ |
| 4 | Loading state shows progress copy; page not fully blocked; duplicate click ignored | ☐ |
| 5 | Deterministic and (when provider healthy) contextual suggestions appear | ☐ |
| 6 | Evidence lines are human-readable; no raw JSON / IDs / provider names | ☐ |
| 7 | Grouping: Important / Worth checking / Other / Conflicts; confidence as bands | ☐ |
| 8 | Add work area creates confirmed WA; suggestion shows Added; no Fact fabrication | ☐ |
| 9 | Edit and add: only title/type/description; corrected WA created; original preserved | ☐ |
| 10 | Dismiss: optional reason; no WA; appears dismissed / dismissed count | ☐ |
| 11 | Duplicate accept/dismiss blocked while pending | ☐ |
| 12 | Refresh retains decisions; no duplicate WA | ☐ |
| 13 | Confirm no new Facts created solely by accept/modify | ☐ |
| 14 | After material brief/notes/WA/fact change: stale notice shown | ☐ |
| 15 | Analyse again is explicit; prior accepted WAs and dismissals preserved appropriately | ☐ |
| 16 | Provider failure / missing key: deterministic results + restrained contextual warning | ☐ |
| 17 | Narrow/mobile: actions stack; primary action obvious; groups collapse | ☐ |
| 18 | Existing Analyse job still available and unchanged | ☐ |
| 19 | Commercial regression: generate estimate / margins still behave as before | ☐ |
| 20 | Vercel + Supabase logs: no secrets, full brief dumps, or raw provider bodies | ☐ |

---

## 5. Local verification (developer)

```bash
npx tsx scripts/verify-stage-3-1b6-assistant-ui.ts
npx tsc --noEmit
npm run lint
npm run build
```

Optional prior batches:

```bash
npx tsx scripts/verify-stage-3-1b5c-gated-server-integration.ts
```

(requires local Supabase)

---

## 6. Sign-off

| Field | Value |
| --- | --- |
| Operator | |
| Preview deployment URL | |
| Flag enabled at | |
| Result | Pass / Fail |
| Notes | |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/runbooks/STAGE_3_1B6_SCOPE_DISCOVERY_PREVIEW_SMOKE_TEST.md` |
| Created | 2026-08-06 |

# Stage 3.1B.5C — Preview Server Integration Test Runbook

**Status:** Ready Pending Owner Test  
**Date:** 2026-08-06  
**Prerequisite:** Migrations 028/029 applied remotely; this code deployed with flag off first  

---

## 1. Objective

Verify gated server actions on Preview without user-facing discovery UI and without changing Analyse Job.

---

## 2. Feature configuration (Vercel)

**Preview**

```
SCOPE_DISCOVERY_ENABLED=true
```

**Production**

```
SCOPE_DISCOVERY_ENABLED=
```
or `false` — must remain disabled.

Also confirm Preview has `ANTHROPIC_API_KEY` (and model env as used by the app). Do not add `NEXT_PUBLIC_SCOPE_DISCOVERY_ENABLED`.

After changing env vars, trigger a **new deployment**.

Do not change Vercel from this runbook automatically — configure in the Vercel dashboard.

---

## 3. Deploy sequence

1. Deploy with flag **off** — smoke Analyse Job + existing journey.  
2. Enable Preview flag only — redeploy.  
3. Exercise server actions via authenticated Preview session (temporary internal harness, scripted call, or Next server action invocation from a trusted debug path — **not** production UI).  
4. Disable flag to confirm preserve-data rollback.

---

## 4. Test checklist

| # | Check | Pass |
| ---: | --- | --- |
| 1 | Flag off: Analyse Job unchanged | ☐ |
| 2 | Flag off: run returns FEATURE_DISABLED; no new runs | ☐ |
| 3 | Flag on: explicit run creates run + suggestions | ☐ |
| 4 | Provider failure → COMPLETED_WITH_WARNINGS with deterministic suggestions | ☐ |
| 5 | Identical rerun reuses completed result | ☐ |
| 6 | Accept creates confirmed WA; no Facts | ☐ |
| 7 | Reject: no WA | ☐ |
| 8 | Modify: corrected WA; original suggestion immutable | ☐ |
| 9 | Cross-org access denied / not found | ☐ |
| 10 | Logs contain no secrets / brief dumps | ☐ |
| 11 | Production still disabled | ☐ |

---

## 5. Local verification (developer)

```bash
npx supabase db reset
npx tsx scripts/verify-stage-3-1b5c-gated-server-integration.ts
```

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
| Path | `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md` |
| Created | 2026-08-06 |

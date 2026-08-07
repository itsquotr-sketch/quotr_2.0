# Stage 3.1B — Production Enablement Runbook

**Status:** Prepared — Production remains disabled  
**Date:** 2026-08-07  
**Prerequisite:** Stage 3.1B.7E Preview hardening; owner Preview E2E sign-off  

---

## Do not enable Production from this document alone

This runbook describes the **future** controlled enablement steps.
**Production remains disabled** until the owner explicitly approves a Production gate.

Do not:

- set `SCOPE_DISCOVERY_ENABLED=true` on Production without approval;
- begin Stage 3.2 as a substitute for this gate;
- change commercial formulas as part of enablement.

---

## Preconditions (all required)

1. Stage 3.1B.7E completion reviewed  
2. Defect register has **no Critical** open items  
3. Defect register has **no High** security/data-integrity items  
4. Owner Preview E2E: Deck + Bathroom + Fitout signed  
5. Stage 2B.10 commercial regression green  
6. RLS coverage green  
7. Migrations 028/029 Applied and Verified; **no unapproved 030**  
8. Analyse Job behaviour confirmed unchanged with flag off  

---

## Preview vs Production configuration

| Variable | Preview | Production (current) | Production (future enable) |
| --- | --- | --- | --- |
| `SCOPE_DISCOVERY_ENABLED` | `true` (exact) | **Absent / false** | Owner-approved `true` only |
| `ANTHROPIC_API_KEY` | Present | Present (Analyse Job) | Unchanged |
| `ANTHROPIC_MODEL` | Present | Present | Unchanged |
| Supabase URL/anon | Present | Present | Unchanged |
| `NEXT_PUBLIC_SCOPE_DISCOVERY_ENABLED` | **Never** | **Never** | **Never** |

---

## Enablement sequence (owner-approved only)

1. Confirm latest Production deployment matches signed-off commit.  
2. Confirm rollback plan (below) is understood.  
3. Set Production `SCOPE_DISCOVERY_ENABLED=true` (exact).  
4. Redeploy Production (or rely on runtime env if already live).  
5. Smoke: one Deck project — Work Areas → Scope Review → Confirm scope → estimate.  
6. Watch Vercel + Supabase logs for 30–60 minutes.  
7. If any Critical/High: disable flag immediately (rollback).

---

## Rollback

1. Remove Production `SCOPE_DISCOVERY_ENABLED` or set to non-`true`.  
2. Redeploy if required.  
3. Confirm Scope Review card absent; Analyse Job still works.  
4. Discovery tables / accepted Work Areas remain (non-destructive).  
5. Do not drop migrations or wipe decisions.

---

## Post-enable monitoring

- Duplicate Analyse / discovery runs  
- Provider error rate / repair frequency  
- Estimate / pricing / quote totals unchanged vs known cases  
- No secret leakage in logs  

---

## Explicit non-goals

- Company DNA  
- Builder Interview  
- Assemblies rewrite  
- Commercial formula changes  

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/runbooks/STAGE_3_1B_PRODUCTION_ENABLEMENT_RUNBOOK.md` |
| Created | 2026-08-07 |
| Production | Disabled |

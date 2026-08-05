# Stage 3.1B.5B — Remote Migration and Wiring Owner Approval Register

**Status:** Remote apply **Applied and Verified** — server integration **Complete — Local** (3.1B.5C)  
**Date:** 2026-08-06  
**Related:**  
- `docs/runbooks/STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md`  
- `docs/architecture/STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md`  
- `docs/runbooks/STAGE_3_1B5B_PREVIEW_ROLLOUT_PLAN.md`  
- `docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md`  
- `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md`  
- Prior local approvals: `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md`  

---

## Decision register

| # | Decision | Recommended value | Status | Approved date |
| ---: | --- | --- | --- | --- |
| 1 | Approve remote apply of migration **028** | Approve for **Preview** first after runbook prechecks; production only after Preview DB verify | **Applied and Verified** (Preview; owner confirmed entering 3.1B.5C) | 2026-08-06 |
| 2 | Approve remote apply of migration **029** | Approve for Preview immediately after 028 verify; same production gate | **Applied and Verified** (Preview; owner confirmed entering 3.1B.5C) | 2026-08-06 |
| 3 | Feature flag strategy | Server-only `SCOPE_DISCOVERY_ENABLED`; default **off**; no client secret; disable = preserve data | **Approved — Implemented** (`lib/scope-discovery/configuration/feature-flags.ts`) | 2026-08-06 |
| 4 | Explicit Analyse Scope action | Yes — user-triggered; not silent; separate from current Analyse Job until #5 decided | **Recommended — Pending** | — |
| 5 | Discovery supplements or replaces Analyse Job | **Supplement** in Preview; replace only after proven UX + separate approval | **Recommended Supplement — Pending** | — |
| 6 | Deterministic-only fallback on provider failure | Yes — ORCH-POL-01 (`COMPLETED_WITH_WARNINGS` with deterministic suggestions) | **Approved — Implemented** (3.1B.5C run service) | 2026-08-06 |
| 7 | Preview-only initial rollout | Yes — flag true only on Preview until Production gate | **Approved — Ready Pending Owner Test** | 2026-08-06 |
| 8 | Data retention after disabling feature | **Preserve** runs, suggestions, decisions, and discovery-created Work Areas | **Approved — Implemented** (flag-off path) | 2026-08-06 |
| 9 | Remote rollback strategy | Pre-data: drop 029 then 028 objects; post-data: flag off + preserve (no destructive drop) | **Approved** | 2026-08-06 |
| 10 | Next batch: server-action implementation | Approve design in `STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md`; implement only after Preview remote migrations applied | **Approved — Complete — Local** (3.1B.5C) | 2026-08-06 |

---

## Explicit non-approvals

| Item | Status |
| --- | --- |
| Remote apply of 028 | **Applied and Verified** (Preview) |
| Remote apply of 029 | **Applied and Verified** (Preview) |
| Production feature flag enable | **Not Approved** |
| Preview feature flag enable | **Ready Pending Owner Test** |
| Analyse Job rewire / replace | **Not Approved** |
| UI exposure of discovery actions | **Not Started** |
| Company DNA / Builder Interview | **Forbidden** in this stage |
| Commercial formula changes | **Forbidden** |
| Dual-write discovery + Analyse Job suggested WAs | **Not Approved** (default no dual-write) |

---

## Inspection baseline (2026-08-06)

| Check | Result |
| --- | --- |
| `npx supabase migration list` | Remote aligned **001–029**; **028/029 Applied and Verified** (owner confirmed entering 3.1B.5C) |
| `npx supabase db diff --linked --schema public` | **028/029 applied** — remote `scope_discovery_*` objects present; no destructive drift expected |
| Migration 028 safety | **Pass** — additive; see completion doc |
| Migration 029 safety | **Pass** — additive RPCs; see completion doc |

---

## How to approve

Owner sets Status to **Approved**, records date, and initials/notes for each row before any remote `db push`. Approving #1/#2 for Preview does **not** auto-approve production apply — record environment in the runbook sign-off.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md` |
| Created | 2026-08-06 |
| Last updated | 2026-08-06 |
| Remote apply | **Applied and Verified** (Preview) |
| Wiring implementation | **Complete — Local** (3.1B.5C); UI **Not Started** |
| Preview enablement | **Ready Pending Owner Test** |
| Production enablement | **Not Approved** |

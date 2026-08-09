# Stage 3.1C.3-R1 — Setup / Rate / Engine Audit

**Date:** 2026-08-09  
**Status:** Complete — Planning only (no implementation in R1)  
**Does not:** migrate, redesign Setup UI, start Stage 3.2, enable Scope Discovery, implement Company DNA

---

## 1. Current onboarding state machine

```
Signup / email confirm / login
  → redirect destination DEFAULT /app/dashboard
  → provision org+profile (migration 032; no organisation_settings row yet)

Dashboard load
  → getCompanySetupReadiness()
  → if onboarding_status null|not_started:
       soft-replace Dashboard with CompanyBasicsStep (3.1C.3)
  → else: projects + ImproveSetupCard

Optional /app/setup (SetupShell)
  company (CompanyBasicsStep)
    → optional CompanyDefaultsStep (margin/factors)
  → work_areas
  → rates (generic labour + scope $/m² starters)
  → review → completeSetup()

Persisted fields (organisation_settings):
  onboarding_status: not_started | in_progress | completed
  onboarding_step: company | work_areas | rates | review | completed
```

### Why signup lands Dashboard first

Auth destinations hardcode `/app/dashboard` (`signup`, login default, callback `next`, middleware logged-in redirect). There is **no** hard redirect to `/app/setup`. 3.1C.3 soft-gates basics **on** the Dashboard page rather than a dedicated first-run route.

### Why Company save returns Dashboard

`CompanyBasicsStep` primary CTA is always **Continue to Quotr** → `saveCompanyBasics` → `router.push("/app/dashboard")`. Intentional for first-run unlock. In wizard mode, “Save and continue setup” exists, but **Continue to Quotr still exits** — so Company save in Setup feels incoherent.

### Owner Preview note

If Preview still shows **“Finish setting up Quotr”** (`SetupPromptCard`), that build may predate 3.1C.3 Dashboard changes. Local 3.1C.3 replaces that card with `ImproveSetupCard`, but **sidebar Incomplete** still tracks full wizard `completed` — conflicting “setup incomplete + New Project” remains after basics.

---

## 2. Setup badge / completion semantics

| Signal | Authority | Effect |
| --- | --- | --- |
| `isSetupIncomplete()` | `onboarding_status !== "completed"` | Sidebar / mobile Setup badge |
| `needsFirstRunBasics` | status `not_started` / null | Soft Dashboard basics gate |
| `completeSetup()` | sets status/step `completed` + timestamp | Clears badge only |
| `quoteReady` | computed readiness | Hard-blocks Mark sent |
| Estimate/pricing banners | readiness suggestions | Soft |

**Real requirement:** auth+org; company basics confirmation; quote contact before send.  
**Presentation:** wizard steps, Incomplete badge, Review/Mark complete.

---

## 3. Rate-source map (summary)

| Source | Schema / location | Unit | Authority | Used by calculators? |
| --- | --- | --- | --- | --- |
| Org margin / factors | `organisation_settings` | % / factor | Company default | Yes (sell-from-cost, ranges) |
| Org GST | `organisation_settings.default_gst_rate` | % | Company default | Pricing/quote create |
| Contingency % | `organisation_settings` | % | Stored | **No** (UI only) |
| Labour rates | `rates` (`labour.*`) | hour | Company explicit | **Yes** |
| Material rates | `rates` (`material` / deck/fence keys) | m2/lm/etc | Company explicit | **Yes** |
| Scope package rates | `rates` (`scope.*`) | m2/lm | Collected in setup | **No** (planned) |
| Allowance subbie markup | `rates` (`allowance.subcontractor.default`) | % | Onboarding | **No** |
| Benchmarks | `lib/estimate/benchmark-rates.ts` | various | Curated fallback | **Yes** when allowed |
| `prefer_user_rates` | settings flag | bool | UI toggle | **Dead** |
| `allow_benchmark_rates` | settings flag | bool | Soft gate | **Yes** |
| Pricing line overrides | `pricing_items` | line | Project document | Local only; no write-back to rates |
| Quote snapshot | quote items / commercials | sell | Frozen sell | Does not re-resolve rates |

Full detail: `docs/architecture/QUOTR_RATE_AND_CALIBRATION_ARCHITECTURE.md`.

---

## 4. Generic unit-rate verdicts

| Key | Stored | Consumed by calculators? | Verdict |
| --- | --- | --- | --- |
| `scope.deck.m2` | Setup RatesStep | No — deck uses materials + labour + `DECK_BENCHMARKS` | **DEPRECATE** from primary onboarding; optional future package override |
| `scope.retaining_wall.m2` / `.face_m2` | Setup (key mismatch vs catalogue) | No — material face_m2 + benchmarks | **DEPRECATE**; keep material keys |
| `scope.bathroom.m2` | Setup | No — components + benchmark package | **REPOSITION AS CALIBRATION/FALLBACK** or DEPRECATE |
| `scope.kitchen.m2` | Setup | No — same | **REPOSITION / DEPRECATE** |
| `scope.fence.lm` | Setup | No — timber/metal lm materials | **DEPRECATE** as starter |
| `scope.pergola.m2` | Setup | No — frame/roof keys | **DEPRECATE** as starter |

**Do not delete in R1.** Reposition messaging first; remove from first-run rates UX in R2C.

---

## 5. Work Area restriction (critical)

`loadAllowedWorkAreaTypes` (`lib/assistant/actions.ts`) returns **only enabled** `organisation_work_areas` when any exist.

**Today:** selected Work Areas can **restrict** which types seed/are allowed — contrary to owner intent (“personalise, don’t forbid”).

**Target:** `preferredWorkAreas` for personalisation/calibration/Rates filtering — **not** AI capability lock. Fallback to full catalogue when estimating other scopes.

---

## 6. Country / currency 8-char limit

- DB: `text` with non-empty check — **no length cap** (`003_onboarding_settings.sql`).
- App: `saveCompanyBasics` Zod `.max(8)` — source of free-text truncation pain.
- UI: free-text inputs (not controlled selects).

Canonicalisation needed in R2A; migration only if storing display names longer than codes (codes fit in 8).

---

## 7. Conflicting Dashboard signals (owner finding)

After basics (`in_progress`):

- New Project allowed (correct — not blocked).
- Sidebar Setup still **Incomplete** until Review complete.
- Optional Improve card + old Preview may still say “Finish setting up Quotr”.

**Root cause:** wizard completion (`completed`) conflated with product readiness.

---

## References

- First-run gating model: `docs/architecture/QUOTR_FIRST_RUN_GATING_MODEL.md`
- Rate/calibration architecture: `docs/architecture/QUOTR_RATE_AND_CALIBRATION_ARCHITECTURE.md`
- Calibration contract: `docs/specifications/QUOTR_CALIBRATION_SCENARIO_CONTRACT.md`
- Redesign plan: `docs/plans/STAGE_3_1C3_SETUP_REDESIGN_PLAN.md`
- Owner decisions: `docs/decisions/STAGE_3_1C3_SETUP_OWNER_DECISIONS.md`

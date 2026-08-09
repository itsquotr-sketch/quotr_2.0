# Stage 3.1C.3 Setup Redesign Plan

**Status:** Complete — Preview Validated (Stage 3.1C closed 2026-08-10)  
**Closure:** `docs/implementation/STAGE_3_1C_CLOSURE.md`  
**Implements after owner decisions in** `docs/decisions/STAGE_3_1C3_SETUP_OWNER_DECISIONS.md`

## Batch order (recommended)

### 3.1C.3-R2A — First-run routing + country/currency + Dashboard coherence

**Status: Complete — Preview Validated**

### 3.1C.3-R2B — Setup navigation / Work Area preferences

**Status: Complete — Preview Validated**

### 3.1C.3-R2C — Core rates onboarding redesign

**Status: Complete — Preview Validated**

### 3.1C.3-R2D — Calibration scenario MVP

**Status: Complete — Preview Validated**

### 3.1C.3-R2D.1 — Calibration persistence (033)

**Status: Complete** (Local + Remote Applied)

### 3.1C.3-R2D.2 — Remote 033 safety gate & apply

**Status: Complete**

### 3.1C.3-R2E — Preview E2E / polish

**Status: Complete — Preview Validated**

### 3.1C.3-R2E-R1 — Preview remediation

**Status: Complete — Preview Validated**

### 3.1C.3-R2E-R1.1 — Company Settings section prop build fix

**Status: Complete**

**Stage 3.1C.3** and **Stage 3.1C** are closed. Next active work: Stage 3.1B Owner Preview E2E — not Stage 3.2.

---

## Schema / migration proposals (not created)

### MVP-necessary (R2A–R2C)

| Change | Need? | Notes |
| --- | --- | --- |
| Wider country display column | Maybe | Codes fit `text`; Zod max(8) is app-only — fix validation + selects may suffice |
| `country_code` / `currency_code` | Recommended | Explicit ISO columns or rename semantics; address_country stays display |
| `basics_confirmed_at` | Optional | Cleaner than overloading `onboarding_status` |
| Rate `source` / provenance enum | Nice | `user` \| `benchmark` \| `calibrated` \| `imported` |
| Deprecate writing new `scope.*` starters | App-only | No migration |

### Future / Company DNA (not MVP)

| Change | Notes |
| --- | --- |
| `calibration_scenarios` | Product catalogue (could be code-first initially) |
| `calibration_responses` | Org evidence — **033 Applied and Verified Remote** |
| DNA suggestion tables | Later stage — never overwrite explicit rates silently |

**Do not create migration 033 until owner signs** `docs/decisions/STAGE_3_1C3_R2D_CALIBRATION_OWNER_APPROVAL.md`.

---

## Country / currency design

| Entity | Display | Canonical |
| --- | --- | --- |
| Country | e.g. New Zealand | `NZ` (ISO 3166-1 alpha-2) |
| Currency | e.g. New Zealand Dollar | `NZD` (ISO 4217) |

Suggested defaults map (examples):

| Country | Currency | GST suggestion |
| --- | --- | --- |
| NZ | NZD | 15% |
| AU | AUD | 10% |
| GB | GBP | 20% (confirm VAT labelling later) |

Preserve explicit confirmation. Extend allow-list carefully (MVP: NZ + AU sufficient).

Source of 8-char limit: `saveCompanyBasics` Zod `.max(8)` — **not** DB.

---

## Review step treatment

Remove from required onboarding. Optional “setup summary” later. Badge clears on basics.

---

## Success criteria for Stage 3.1C close

1. New account cannot reach New Project until company basics confirmed.  
2. No conflicting Incomplete + New Project messaging.  
3. Controlled country/currency.  
4. Work areas do not forbid other scopes.  
5. Rates onboarding leads with labour / components — not fake package $/m².  
6. Owner Preview E2E checklist green.  

Company DNA and full calibration library are **after** 3.1C.

# Stage 3.1C.3 Setup Redesign Plan

**Status:** Planning approved for sequencing — R1 audit complete  
**Implements after owner decisions in** `docs/decisions/STAGE_3_1C3_SETUP_OWNER_DECISIONS.md`

## Batch order (recommended)

### 3.1C.3-R2A — First-run routing + country/currency + Dashboard coherence

**Status: Complete — Local**

- Hard gate: `/app/setup?mode=basics` until basics confirmed  
- Controlled country + currency (NZ/AU, NZD/AUD)  
- Country → suggested currency + GST (user confirms)  
- Saving basics → Dashboard; optional Setup save stays in Setup  
- Sidebar Incomplete cleared after basics  
- Dashboard: Create project primary; Improve secondary  
- Review/Mark complete removed from required navigation  

### 3.1C.3-R2B — Setup navigation / Work Area preferences

**Status: Complete — Local**

- Capability vs preference authority model  
- Analyse Job / notes unlocked from org preferences  
- Setup Work Types UX + defaults + Improve tips  

### 3.1C.3-R2C — Core rates onboarding redesign

**Status: Complete — Local**

### 3.1C.3-R2D — Calibration scenario MVP

**Status: Ready Next**

### 3.1C.3-R2E — Preview E2E / polish

**Status: Planned**

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
| `calibration_responses` | Org evidence rows + scenario_version |
| DNA suggestion tables | Later stage — never overwrite explicit rates silently |

**Do not create migration 033 in R1.** Owner must approve before any remote apply.

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

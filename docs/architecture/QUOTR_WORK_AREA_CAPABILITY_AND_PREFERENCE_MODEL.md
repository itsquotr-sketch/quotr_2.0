# Quotr Work Area Capability & Preference Model

**Stage:** 3.1C.3-R2B  
**Status:** Active  
**Owner decision:** D4 — Work Areas are preferences/personalisation only

## Three authorities (must not conflate)

| Authority | Concept | Storage | Controls |
| --- | --- | --- | --- |
| **A. Capability catalogue** | What Quotr can recognise / estimate | `SCOPE_CATALOGUE` / `lib/scopes/capability.ts` | Analyse Job, note analysis, Add Work Area, Scope Discovery eligibility, calculators |
| **B. Company preferences** | What this company commonly prices | `organisation_work_areas.enabled` | Rates Setup personalisation, Improve tips, future calibration suggestions |
| **C. Project work areas** | What exists on a specific project | `work_areas` | Questions, facts, estimate, pricing, quote |

## Terminology

| Surface | Label | Meaning |
| --- | --- | --- |
| Setup | **Work types** | Company preferences |
| Project Assistant | **Work Areas** | Project scope packages |
| Internal domain | Work Area type | Canonical `SCOPE_CATALOGUE.type` |

## Capability catalogue

Canonical ids live in `lib/scopes/catalogue.ts`.  
Helpers: `getSupportedWorkAreaTypes()`, `getAnalysisCapableWorkAreaTypes()`, `isSupportedWorkAreaType()`.

Do not create a second Setup-only type list.

## Preference semantics

`organisation_work_areas.enabled = true` means:

- prioritise in Rates Setup starter sections;
- show “Choose / Change work types” tips appropriately;
- later: suggest calibration scenarios (R2D);
- later: DNA context (not R2B).

It does **not** mean:

- filter Analyse Job output;
- reject unsupported-by-company types;
- block Add Work Area;
- suppress Scope Discovery;
- disable calculators.

## Analyse Job / notes (R2B correction)

**Before:** `loadAllowedWorkAreaTypes` loaded enabled org rows (or `defaultEnabled` fallback) and passed them as AI `allowedTypes`.

**After:** Analyse Job and note analysis always use `getAnalysisCapableWorkAreaTypes()` = full catalogue. Org preference query removed from those paths.

## Scope Discovery

Already catalogue/SQL-backed. Preferences must not become exclusion. Prioritisation (if added later) is ordering only.

## Project confirmation / Add Work Area

Full `SCOPE_CATALOGUE`. Preferences may later order “Common for your company” but must not hide capability.

## Rates (R2C boundary)

Preferences filter/nav convenience for starter rows only. Rate Library must still allow show-all / add another work type.

## Calibration (R2D boundary)

Preferences suggest which calibrations to offer first. User may calibrate any supported type manually.

## Defaults

New orgs start with **no** claimed preferences (UI unchecked; save writes only explicit choices).  
Catalogue `defaultEnabled` is historical metadata — not a user preference claim.

## Existing users

Rows already stored as `enabled` are interpreted as preferences going forward. No migration / rewrite. Existing project `work_areas` unchanged.

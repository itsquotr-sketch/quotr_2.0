# Quotr Supported Work Area Contract

**Classification:** CANONICAL code-level capability bands. **CANONICAL product view:** `docs/product/QUOTR_SUPPORTED_WORK_AREAS.md`.  
**Status:** FOUNDATION-R1 Complete. FOUNDATION-R1-R1 Complete — Owner Preview Validated (2026-08-16). FOUNDATION-R2 Complete Local / Owner Preview remediation pending R2-R1. FOUNDATION-R2-R1 Complete Local / Owner Preview Pending.  
**Code:** `lib/work-areas/support-contract.ts`  
**Audit (historical):** `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md`  
**Owner:** OD-CAT-01, OD-CAT-02, OD-CAT-03, OD-T1-01

This contract is **independent of Setup work-type preferences**. Preferences may hide a type from a company; they do not change maturity.

Internal grades A–E remain audit language only. **Customer UI never shows A/B/C/D/E.**

---

## Customer-facing bands

| Band | Label | Product types |
| --- | --- | --- |
| `trial_supported` | Trial-supported | `deck`, `bathroom` |
| `developing` | Developing | `retaining_wall`, `fence`, `pergola`, `kitchen` |
| `component` | Component | `demolition`, `external_stairs`, `internal_walls`, `ceilings`, `doors`, `flooring`, `painting`, `plastering` |
| `unsupported` | Not supported yet | cladding, roofing, windows, landscaping, earthworks, services-as-WAs, other/custom |

Tier-1 “Supported” is **not** claimed (OD-T1-01): Deck/Bathroom remain **Trial-supported** until scope + questions + conditions + calculator + labour/material verification are all defensible.

---

## Commercial interior

Commercial is a **parent / project use-case**, not a Work Area calculator.

| Type | Role |
| --- | --- |
| `commercial_fitout` | ISD / job-class parent only. **Not** in `SCOPE_CATALOGUE`. **No** calculator. |
| demolition, internal_walls, ceilings, doors, flooring, painting, plastering | Component WAs used to compose a commercial interior estimate |

Do not create or promote a monolithic `commercial_fitout` calculator (OD-CAT-01).

Cladding and roofing are recognised in ISD language only. They are **not** estimate-ready and cannot be created as product WAs today (OD-CAT-02). Documented rather than extra UI.

---

## Creatable product types

The 14 `SCOPE_CATALOGUE` types remain creatable. Lower maturity does not delete a canonical WA.

Add Work Area badges use `getWorkAreaCapabilityLabel(type)` — never blanket “Estimate-ready”.

---

## Project lifecycle “Estimate ready”

Project list/status copy “Estimate ready” (an estimate **exists**) is unrelated to Work Area capability. It is unchanged.

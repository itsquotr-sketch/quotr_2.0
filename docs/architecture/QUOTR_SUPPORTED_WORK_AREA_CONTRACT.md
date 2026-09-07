# Quotr Supported Work Area Contract

**Classification:** RUNTIME display bands in `lib/work-areas/support-contract.ts`. Expansion / exposure policy: [QUOTR_WORK_AREA_FACTORY.md](./QUOTR_WORK_AREA_FACTORY.md) + [WORK_AREA_EXPANSION_TRIAGE.md](../WORK_AREA_EXPANSION_TRIAGE.md). WA-BATHROOM-08 corrected Deck / Fence / Retaining Wall / Bathroom to customer **Supported**.  
**Status:** FOUNDATION-R1 Complete. FOUNDATION-R1-R1 Complete — Owner Preview Validated (2026-08-16). FOUNDATION-R2 Complete Local / Owner Preview remediation pending R2-R1. FOUNDATION-R2-R1 Complete Local / Owner Preview Pending. **WA-BATHROOM-08 exposure correction.**  
**Code:** `lib/work-areas/support-contract.ts`  
**Audit (historical):** `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md`  
**Owner:** OD-CAT-01, OD-CAT-02, OD-CAT-03, OD-T1-01

This contract is **independent of Setup work-type preferences**. Preferences may hide a type from a company; they do not change maturity.

Internal grades A–E remain audit language only. **Customer UI never shows A/B/C/D/E.**

---

## Customer-facing bands

| Band | Label | Product types |
| --- | --- | --- |
| `supported` | Supported | `deck`, `fence`, `retaining_wall`, `bathroom` |
| `developing` | Developing | `pergola`, `kitchen` |
| `component` | Component | `demolition`, `external_stairs`, `internal_walls`, `ceilings`, `doors`, `flooring`, `painting`, `plastering` |
| `unsupported` | Not supported yet | cladding, roofing, windows, landscaping, earthworks, services-as-WAs, other/custom |

Builders never see V2, WA-08, or maturity level 9. The four mature Work Areas simply appear as **Supported**.

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

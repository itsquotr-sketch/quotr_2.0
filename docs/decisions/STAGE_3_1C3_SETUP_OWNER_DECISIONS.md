# Stage 3.1C.3 — Setup Owner Decisions

**Status:** Approved (2026-08-09)  
**Context:** Preview findings + R1 architecture audit  
**Related:** `docs/audits/STAGE_3_1C3R1_SETUP_RATE_ENGINE_AUDIT.md`  
**Implementation:** R2A–R2D Complete — Local; R2D.1 Complete Local (remote pending); R2E Planned

---

## D1 — First-run gate — APPROVED

New users must confirm minimum Company Basics before first Dashboard access.

Hard route: `/app/setup?mode=basics` → then Dashboard.

---

## D2 — Compulsory basics fields — APPROVED

Required:

- company name / existing organisation identity  
- country  
- currency  
- GST / applicable tax rate  

Region is optional.

---

## D3 — Rates / Work Areas before project — APPROVED

Rates and Work Area preferences are **NOT** required before creating a Project.

---

## D4 — Work Area semantics — APPROVED

Selected Work Areas are business preferences/personalisation only.  
They must **NOT** restrict Quotr’s ability to analyse or estimate another Work Area.

*(Capability unlock Complete — Local in R2B.)*

---

## D5 — Generic scope $/m² rates — APPROVED

Removed from primary onboarding.  
Do not delete data/schema yet. Treat as legacy/fallback/calibration candidates.

*(UX removal in R2C — Complete Local; data retained as legacy.)*

---

## D6 — Review / Mark setup complete — APPROVED

Removed as product/onboarding authority.  
Does not control Dashboard, project creation, or usability.

---

## D7 — Dashboard after basics — APPROVED

Primary action = Create Project.  
Optional setup/calibration = secondary.

---

## D8 — Future rate architecture — APPROVED

Layer 1 explicit business/base rates → Layer 2 component/assembly → Layer 3 calibration evidence.

---

## D9 — Calibration authority — APPROVED

Calibration evidence never silently overwrites explicit company/project rates.

---

## D10 — Company DNA — APPROVED

Future work only. Explicit project/company rates remain higher authority than inferred DNA.

---

## Mapping note (R1 checklist → approved D#)

Earlier draft D3/D4 (country UX / sidebar) are covered by D1–D2 + R2A badge semantics and the approved field list above.

---

## Non-decisions (still out of scope)

- Company DNA implementation  
- Stage 3.2  
- Production Scope Discovery enablement  
- Commercial formula changes  
- Deleting legacy rate rows in R2A  
- Migration 033 unless proven necessary (R2A: none)  

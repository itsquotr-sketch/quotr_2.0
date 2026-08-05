# Stage 3 Product Roadmap

**Status:** Active planning document  
**Created:** 2026-08-05  
**Governing process:** `docs/MVP_HARDENING_GUIDE.md`  
**Architecture:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
**Product backlog:** `docs/product/QUOTR_PRODUCT_BACKLOG.md`  

---

## Stage sequence

| Stage | Name | Intent | Status |
| --- | --- | --- | --- |
| **3.1A** | Product Stabilisation, Workflow Reliability and UX Baseline | Fix Preview workflow defects; answer save reliability; client/spec UX; governed backlog | **Complete** — Preview signed off 2026-08-05 (`docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`) |
| **3.1A-R1** | Preview Remediation | Fix Preview failures: enums, answer reconcile, Quick Estimate Edit, client propagation, capture hierarchy | **Complete** — included in Preview sign-off 2026-08-05 |
| **3.1C** | Domain Model Audit | Documentation-only architectural audit of all major domain objects | **Complete** |
| **3.1D** | Domain Model Refinement | Single authoritative owners; Fact SoT; deterministic Question→Fact→Estimate pipeline | **Complete** — Preview signed off 2026-08-05 (`docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`) |
| **3.1B** | Intelligent Scope Discovery | Smarter work-area / question discovery without redesigning commercial arithmetic | **Ready to Plan** — do not implement until explicitly authorised; deferred schema proposals remain Not Approved; FEAT-001–003 remain Deferred |
| **3.2** | Builder Interview | Structured interview capture aligned with constraints and DNA evidence | Not started |
| **3.3** | Commercial Assemblies | Reusable commercial assemblies / packages | Not started |
| **3.4** | Explicit Company Defaults / Manual Learning | Manual company defaults and correction capture without automatic rule mutation | Not started |
| Later | Company DNA | Company-specific intelligence consuming structured evidence | Not started |

---

## Cross-cutting release workstreams

Every Stage 3 release should track:

| Workstream | Focus |
| --- | --- |
| Bugs | Reliability defects blocking the frozen journey |
| UX | Clarity, spacing, human-readable presentation |
| Performance | Measured latency on critical paths (answers, estimate, reopen) |
| Accessibility | Labels, keyboard, live regions for save state |
| Security | Org ownership, validation, no raw error leakage |
| Regression | Stage 2A/2B suites + stage-specific scripts |
| Preview smoke testing | Owner-gated runbooks before production |

---

## Hard constraints across Stage 3

- Do not change commercial formulas or the authoritative commercial-engine architecture.
- Do not introduce migrations without explicit owner approval.
- Do not begin Company DNA implementation until authorised.
- AI prompts change only when a confirmed defect cannot be fixed elsewhere and is documented.
- Prefer smallest safe corrections; no whole-app redesigns.

---

## Deferred product features (recorded, not scheduled for 3.1A)

- FEAT-001 Collapsible work-area cards
- FEAT-002 Optional quote items (requires commercial design + goldens)
- FEAT-003 Additional site constraints taxonomy

# Quotr Product Architecture

**Status:** CANONICAL — top-level current product architecture  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Branch:** `hardening/stage-2a-security`  
**Mode:** PHASE 0 **COMPLETE / ARCHITECTURE FROZEN**. REQ-1 **COMPLETE / TECHNICALLY VALIDATED**. REQ-2 **COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED**. REQ-2.1 **COMPLETE / TECHNICALLY VALIDATED**. REQ-3 **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED**. REQ-3.1 **COMPLETE / TECHNICALLY VALIDATED**. REQ-4 **IN PROGRESS**. REQ-4A **COMPLETE / TECHNICALLY VALIDATED**. REQ-4B **READY / NOT STARTED**. REQ-TXN-01 **COMPLETE / REMOTE VALIDATED**. Does not authorise REQ-4B promotion.  
**Challenge:** `docs/audits/MASTER_ARCHITECTURE_INDEPENDENT_CHALLENGE_REVIEW.md`  
**Companion canonicals:**
- Estimating: `docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`
- Materials: `docs/architecture/QUOTR_MATERIAL_DOMAIN_ARCHITECTURE.md`
- Calibration / Company DNA: `docs/architecture/QUOTR_CALIBRATION_AND_COMPANY_DNA_ARCHITECTURE.md`
- Supported Work Areas: `docs/product/QUOTR_SUPPORTED_WORK_AREAS.md`
- Development plan: `docs/plans/QUOTR_DEVELOPMENT_MASTER_PLAN.md`
- Legacy / parity: `docs/architecture/QUOTR_LEGACY_RETIREMENT_AND_PARITY_STRATEGY.md`
- Atomic estimate persist: `docs/architecture/QUOTR_ATOMIC_ESTIMATE_GENERATION_CONTRACT.md`
- Analytics: `docs/architecture/QUOTR_ANALYTICS_EVENT_ARCHITECTURE.md`
- Requirement aggregation: `docs/architecture/QUOTR_REQUIREMENT_AGGREGATION_CONTRACT.md`
- Component authority: `docs/architecture/QUOTR_COMPONENT_COMMERCIAL_AUTHORITY_CONTRACT.md`
- Requirement snapshots: `docs/architecture/QUOTR_REQUIREMENT_SNAPSHOT_CONTRACT.md`

This document is the **only** top-level current product architecture.  
`docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md` is **SUPERSEDED** as the governing product architecture (retained as historical foundation).

---

## 1. Product thesis

Quotr converts incomplete real-world construction project information into a **contractor-specific, explainable estimate and quote**.

It does this by modelling:

- physical work;
- materials;
- labour;
- plant;
- subcontract costs;
- waste;
- project conditions;
- contractor-specific rates;
- contractor-specific productivity and commercial behaviour.

Quotr is **not** “AI quote generation”.

AI may recognise work, extract evidence, and propose questions.  
Deterministic calculators own quantities.  
The cost-first commercial engine owns money.  
The contractor owns commercial judgement.

The architectural north star is six questions:

1. **What work is actually happening?**
2. **What physical quantities are required?**
3. **How much labour will it take?**
4. **What will the work actually cost this contractor?**
5. **How does this contractor price / sell this work?**
6. **What is uncertain, and what information would improve the estimate?**

---

## 2. What Quotr calculates

A generated estimate must eventually be able to explain, for each supported Work Area:

| Layer | Meaning |
| --- | --- |
| Scope | What is in / out |
| Physical quantities | What is removed, built, or installed |
| Requirements | Materials, labour, plant, subcontract, waste needed |
| Cost | What this contractor pays |
| Sell | What this contractor charges, via gross margin (or provenanced exception) |
| Uncertainty | Assumptions, confidence, missing information |

Today, most Work Areas still price **packages / allowances**. That is accepted as current implementation, not the long-term authority.

**Target authority:** where physical information is sufficient, labour + materials + subcontract + plant + waste generate cost. Generic `$/m²`, `$/lm`, package, lump, and historical allowance become fallback / benchmark / calibration mechanisms.

---

## 3. End-to-end pipeline

```
PROJECT INPUT
  brief · site notes · photos · voice transcripts · plans/documents
        ↓
ANALYSIS
  Facts · Work Areas · Scope · Project Conditions
        ↓
PHYSICAL WORK MODEL
  what is being removed / built / installed
        ↓
ESTIMATE REQUIREMENTS
  MaterialRequirement
  LabourRequirement
  PlantRequirement
  SubcontractRequirement
  WasteRequirement
        ↓
RATE RESOLUTION
  project override
  → company exact cost
  → supplier / account cost
  → company compatible converted cost
  → company calibrated / historical cost (approved)
  → Quotr exact benchmark
  → Quotr calibrated package fallback
  → explicit pricing required
        ↓
COMMERCIAL ENGINE
  total job cost
  → project-specific adjustments already in requirements
  → target gross margin
  → sell
        ↓
ESTIMATE
  quick estimate · range · confidence · assumptions
  · breakdown · materials · labour
        ↓
PRICING / QUOTE / RFQ / ACCEPTANCE
        ↓
LEARNING / CALIBRATION
  observe → calculate → recommend → user approves → company authority
```

### Authority boundaries

| Stage | Owns | Must not |
| --- | --- | --- |
| Capture / AI | Evidence, proposed Facts, proposed Work Areas | Invent prices |
| Facts | Work-Area physical truth | Duplicate Project Conditions |
| Project Conditions | Project/site circumstances, once | Be re-asked in Scope Details |
| Scope Details | Work-Area physical/build characteristics | Become the fallback ask for project logistics |
| Calculators | Physical quantities + requirement emission | A second money engine |
| Rate resolution | Unit **cost** + provenance | Treat sell as independent estimate authority |
| Commercial engine | Line/document money, F-SFM, rounding | Consume AI money |
| Pricing / Quote | Commercial documents / snapshots | Silently rewrite accepted quotes |
| Calibration / DNA | Recommendations from evidence | Silently mutate rates or productivity |

Implementation may differ in code shape. These boundaries must not.

---

## 4. Estimating authority (locked)

Where Quotr has sufficient physical information:

**LABOUR + MATERIALS + SUBCONTRACTS + PLANT + WASTE generate cost.**

| Mode | When |
| --- | --- |
| **A. Quantity-driven is authoritative** | Physical qty exists, unit reconciles with rate unit (or explicit conversion), and a resolvable cost exists |
| **B. Package rates are acceptable** | The Work Area is immature, or the component is commercially a package (kitchen cabinetry, bathroom plumbing allowance) |
| **C. Package rates are fallback only** | A quantity path exists but width/spec/rate is missing; package used with honest label |
| **D. Pricing required** | No company rate, no valid conversion, benchmarks disabled / missing, and no approved allowance |
| **E. Legacy package retained during migration** | Old package remains money authority until shadow/parity promotes the requirement path |

Do **not** require every existing calculator to move immediately. This is the target architecture. Deck surface decking after FOUNDATION-R2-R1 is the reference quantity path.

---

## 5. Information Quotr needs

| Class | Examples | Owner |
| --- | --- | --- |
| Job identity | Client, site, brief | Project |
| Evidence | Notes, later photos/voice/plans | Capture |
| Recognition | Canonical Work Area + aliases | Recognition taxonomy |
| Project circumstances | Access, carry, floor, occupied, hours, waste logistics | Project Conditions |
| Physical scope | Dimensions, system, materials, local demolition | Scope Details |
| Contractor cost | Company rates, later supplier prices | Rate authority |
| Contractor behaviour | Margin, inclusions, productivity | Company settings + later DNA |
| Outcomes | Sent/accepted quotes, won/lost, actuals | Calibration evidence |

Unknown Project Condition: **Project Conditions owns the ask.**  
Scope Details must never become the fallback ask surface.

---

## 6. How future product features connect

| Feature | Connects through | Must not |
| --- | --- | --- |
| Materials / Labour UI | Projection of EstimateRequirements | Become a second commercial SoT |
| Materials Catalogue V2 | Canonical `materialKey` for requirements + rates | Become a supplier SKU catalogue |
| Supplier prices | Mapping onto canonical keys | Replace Quotr domain model |
| Quote send / acceptance | Immutable commercial snapshots | Live-rewrite sent/accepted money or branding |
| Subcontractor RFQ | SubcontractRequirement → adopt **cost** | Auto-award or mutate DNA |
| Photos / voice / video | Evidence → Facts / confirmation | Directly invent prices |
| Company DNA | Approved recommendations from evidence | Silent commercial mutation |
| Analytics | Events over the existing pipeline | Require UI before history exists |
| Commercial Interior | Composition of component Work Areas | A monolithic `commercial_fitout` calculator |
| Cladding / Roofing | New product WAs only when built | Recognition implying support |

---

## 7. Protected architecture contracts

These domains are substantially established. Future work may refactor implementation but must not redesign the contract without a proven defect:

1. Auth / organisation security and RLS tenancy
2. Fact authority (Facts are Work-Area physical SoT)
3. Project Conditions authority (R1 / R1-R1)
4. Scope / Work Area flow (confirm → Scope Details → Generate)
5. Cost-first commercial model (CF-D1–D7)
6. Gross-margin semantics: `sell = cost / (1 − GM)` — never markup-as-GM
7. Rate precedence / provenance labels
8. Quick Estimate → Pricing → Quote progression
9. Quote branding (live today; snapshot on send is BRANDING-SNAPSHOT-01)
10. Current Assistant UX framework
11. Supported-WA maturity concept (recognition ≠ estimating support)
12. Estimate commercial boundary (AI/workflow vs commercial engine)
13. Generate hard-block on unresolved required Project Conditions
14. Commercial snapshot safety (sent/accepted quotes are historical)

---

## 8. Document registry (this lock)

Classification:

- **CANONICAL** — current authority for that topic
- **SUPPORTING** — still valid detail; not the primary SoT
- **HISTORICAL** — true at the time written; keep
- **SUPERSEDED** — do not use for new work; keep file

| Document | Classification |
| --- | --- |
| `docs/architecture/QUOTR_PRODUCT_ARCHITECTURE.md` | **CANONICAL** — top-level product architecture |
| `docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md` | **CANONICAL** — estimating engine |
| `docs/architecture/QUOTR_MATERIAL_DOMAIN_ARCHITECTURE.md` | **CANONICAL** — materials / catalogue / supplier |
| `docs/architecture/QUOTR_CALIBRATION_AND_COMPANY_DNA_ARCHITECTURE.md` | **CANONICAL** — learning |
| `docs/product/QUOTR_SUPPORTED_WORK_AREAS.md` | **CANONICAL** — recognition vs support |
| `docs/plans/QUOTR_DEVELOPMENT_MASTER_PLAN.md` | **CANONICAL** — only current development plan |
| `docs/architecture/QUOTR_LEGACY_RETIREMENT_AND_PARITY_STRATEGY.md` | **CANONICAL** — retirement + parity |
| `docs/architecture/QUOTR_ANALYTICS_EVENT_ARCHITECTURE.md` | **CANONICAL** — events / analytics |
| `docs/architecture/QUOTR_SCOPE_DETAILS_QUESTION_CONTRACT.md` | **CANONICAL** — Scope Details questions |
| `docs/architecture/QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md` | **CANONICAL** — code-level capability bands |
| `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md` | **CANONICAL** — commercial money model |
| `docs/architecture/QUOTR_RATE_AUTHORITY_AND_PROVENANCE_MODEL.md` | **CANONICAL** — rate provenance labels |
| `docs/architecture/COMMERCIAL_SNAPSHOT_SAFETY.md` | **CANONICAL** — snapshot kinds |
| `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md` | **CANONICAL** — AI vs engine |
| `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md` | **CANONICAL** — constraint keys |
| `docs/specifications/QUOTR_ESTIMATE_READINESS_MODEL.md` | **CANONICAL** — readiness states |
| `docs/specifications/QUOTR_BUILDER_INTERVIEW_QUESTION_CONTRACT.md` | **CANONICAL** — interview question rules |
| `docs/MVP_HARDENING_GUIDE.md` | **CANONICAL** — engineering governance |
| `docs/PRODUCTION_READINESS.md` | **CANONICAL** — production ops checklist |
| `docs/architecture/QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md` | **SUPPORTING** — absorbed into estimating engine |
| `docs/architecture/QUOTR_MATERIAL_TAKEOFF_ARCHITECTURE.md` | **SUPPORTING** — absorbed into material domain + engine |
| `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md` | **SUPPORTING** |
| `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md` | **SUPPORTING** |
| `docs/architecture/STAGE_3_2_2_CORE_SITE_INTERVIEW_ARCHITECTURE.md` | **SUPPORTING** |
| `docs/product/QUOTR_PRODUCT_BACKLOG.md` | **SUPPORTING** — item register, not the plan |
| `docs/audits/MASTER_ARCHITECTURE_INDEPENDENT_CHALLENGE_REVIEW.md` | **HISTORICAL** challenge + **CANONICAL** disposition |
| `docs/audits/PROJECT_CONDITIONS_SINGLE_AUTHORITY_AUDIT.md` | **HISTORICAL** — implemented by R1/R1-R1 |
| `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md` | **HISTORICAL** — product view now `QUOTR_SUPPORTED_WORK_AREAS.md` |
| `docs/audits/FOUNDATION_R2_*` | **HISTORICAL** |
| `docs/audits/MASTER_ARCHITECTURE_INDEPENDENT_CHALLENGE_REVIEW.md` | **CANONICAL disposition** of the independent challenge |
| `docs/audits/COMMERCIAL_MARGIN_RATE_AUTHORITY_AUDIT.md` | **HISTORICAL** — P0 implemented |
| `docs/audits/MATERIAL_PRICING_TAKEOFF_CURRENT_STATE_AUDIT.md` | **HISTORICAL** / supporting evidence |
| `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md` | **SUPERSEDED BY** `QUOTR_DEVELOPMENT_MASTER_PLAN.md` |
| `docs/plans/STAGE_3_PRODUCT_ROADMAP.md` | **SUPERSEDED** as primary plan; **HISTORICAL** Stage 3 tracker |
| `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md` | **SUPERSEDED** as programme plan |
| `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md` | **SUPERSEDED** as top-level product architecture |
| `docs/WORK_AREA_COVERAGE_MATRIX.md` | **SUPERSEDED** (already stale vs R1 coverage audit) |
| Stage 3.1 / 3.2.2 completion + runbooks | **HISTORICAL** |
| Stage 3.2.0/3.2.1 plans, decisions, specs | **SUPPORTING** for remaining interview work |

Do not delete history.

---

## 9. Current programme baseline (repository evidence, 2026-08-17)

| Item | Status | Evidence |
| --- | --- | --- |
| Branch | `hardening/stage-2a-security` | `git status -sb` |
| HEAD | `a4de0f875b3497f11d4bcd0379865a811ca4bf1c` | `fix(foundation): reconcile Deck takeoff quantities with material rate authority` |
| Remote | Tracking `origin/hardening/stage-2a-security` at same commit | no ahead/behind |
| Working tree | Dirty, **non-product** | `M supabase/.temp/cli-latest`; `?? supabase/config.toml` |
| Latest migration | **034** `organisation_branding_storage` | no 035+ |
| Preview | Branch alias documented; feature work Owner-gated | `.env.local.example` Preview URL |
| Production Scope Discovery | **Disabled** | `SCOPE_DISCOVERY_ENABLED` exact `"true"` only; example commented |
| COMMERCIAL-P0 | **Complete Local** | `COMMERCIAL_P0_AUTHORITY_LOCK_COMPLETION.md` |
| Cost-first Rates | **Complete Local / Owner Preview Pending** | `COST_FIRST_RATES_COMPLETION.md` |
| DEMO-R7 | **Complete Local (Owner smoke pending)** | backlog + `verify-demo-r7-mobile-header-dashboard.ts` |
| BRANDING-P0 | **Complete Local / Preview Ready**; 034 Applied Remote; Owner Preview pending | `BRANDING_P0_COMPANY_LOGO_COMPLETION.md` |
| FOUNDATION-R1 | **Complete** / Preview regression remediated by R1-R1 | R1 completion |
| FOUNDATION-R1-R1 | **Complete — Owner Preview Validated** (2026-08-16) | R1-R1 completion |
| PHASE 0 | **COMPLETE / ARCHITECTURE FROZEN** | this lock + PHASE 0-R1 |
| FOUNDATION-R2 | Owner flow treated as sufficiently validated via R2/R2-R1 remediation | R2 completion + challenge |
| FOUNDATION-R2-R1 | **Pricing remediation complete** | R2-R1 completion |
| FOUNDATION-R2-R1-R1 | **Contractor-rate precedence complete** | R2-R1-R1 completion |
| REQ-1 | **COMPLETE / TECHNICALLY VALIDATED** | envelope + physical aggregation |
| REQ-2 | **COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED** | capability ACTIVE; not all WAs emit |
| REQ-2.1 | **COMPLETE / TECHNICALLY VALIDATED** | Deck surface shadow only |
| REQ-3 | **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED** | capability ACTIVE; not all WAs emit |
| REQ-3.1 | **COMPLETE / TECHNICALLY VALIDATED** | Deck labour shadow only |
| REQ-4 | **IN PROGRESS** | REQ-4A complete; no promotions |
| REQ-4A | **COMPLETE / TECHNICALLY VALIDATED** | snapshot + authority + reconciliation |
| REQ-4B | **BLOCKED / NOT STARTED** | first promotion `decking.surface` |
| REQ-SNAPSHOT-01 | **COMPLETE / REMOTE VALIDATED** | 035 applied; REQ-TXN-01 remote 036 applied |
| REQ-TXN-01 | **COMPLETE / REMOTE VALIDATED** | `persist_estimate_generation_v1`; mandatory snapshot; 036 applied |
| MaterialRequirement | **ACTIVE** — current emitter: Deck surface only | REQ-2.1 |
| LabourRequirement | **ACTIVE** — current emitter: Deck labour only | REQ-3.1 |
| Component authority | **ACTIVE / NO PROMOTIONS** | Deck surface + labour SHADOW |
| CM-03 | **BACKLOG / NOT STARTED** | labour missing-label vs 60/90 money |
| Deck transparent estimator | **Not Started** | DECK-1+ |
| Materials Catalogue V2 | **Not Started** (`CAT-IDENTITY-01` / DECK-1C-A contract; implement after Owner identity gate) | CAT-V2-1 |
| Stage 3.2.3 | **Not Started** / original PC-suppress **superseded in part** by Foundation | pipeline + handoff |
| Company DNA | **Not Started** | no `lib/company-dna` |
| PERF-FUTURE-01 | **Planned** | `ASSISTANT_RESPONSIVENESS_LATENCY_OPTIMISATION_PASS.md` |

Status rows above PHASE 0 are programme freeze after independent challenge. Cost-first Rates / DEMO-R7 / BRANDING-P0 Owner Previews remain outstanding polish, not REQ-1 blockers.

Owner decisions (full register: master plan §12): **OD-ARCH-01** LOCKED MVP Materials = sibling Quick Estimate surface; **OD-ARCH-02** refined (physical identity ≠ SKU ≠ rate unit); **OD-ARCH-03** retained (explicit approval); **OD-ARCH-04** refined (do not blindly replace company rates).

---

## 10. What this document does not authorise

- Calculator emission beyond authorised REQ-2.1 / REQ-3.1 shadows
- REQ-4B promotion
- Stage 3.2.3 UI
- Company DNA
- Production Scope Discovery enablement
- Production deploy

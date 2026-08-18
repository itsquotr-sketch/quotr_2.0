# Quotr Development Master Plan

**Status:** CANONICAL — the only primary current development plan  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Branch:** `hardening/stage-2a-security`  
**Mode:** PHASE 0 **COMPLETE / ARCHITECTURE FROZEN**. REQ-4 **COMPLETE / COMPONENT AUTHORITY MIGRATION VALIDATED**. **DECK-1 IN PROGRESS** — DECK-1A **COMPLETE / OWNER MODEL VALIDATED**; DECK-1B **COMPLETE / TECHNICALLY VALIDATED**; DECK-1C-A **COMPLETE / OWNER VALIDATED**. DECK-1C-B **NOT STARTED**.  
**Challenge:** `docs/audits/MASTER_ARCHITECTURE_INDEPENDENT_CHALLENGE_REVIEW.md`  
**Product architecture:** `docs/architecture/QUOTR_PRODUCT_ARCHITECTURE.md`  
**Supersedes as programme plan:** `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md`, `docs/plans/STAGE_3_PRODUCT_ROADMAP.md` (as primary plan), `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`

Do not duplicate backlog items across multiple plans. Item register remains `docs/product/QUOTR_PRODUCT_BACKLOG.md`. This file is the **sequence and workstream** SoT.

---

## 0. Why this plan exists

Post-trial audits, Foundation R1–R2-R1-R1, COMMERCIAL-P0, and Stage 3.2.2 created several overlapping roadmaps. This lock consolidates them.

Preserve: COMMERCIAL-P0, cost-first Rates, 3.2.1 engine, 3.2.2 Project Conditions ask layer, 3.1B Preview SD (production off), Deck/Bathroom/Fitout trial calculators, branding upload, Foundation PC + question contracts, Deck lm rate authority.

Do not restart Stage 3.2.3 as originally scoped (PC suppress already landed in FOUNDATION-R1). Remaining WA-conditional interview is **PT-BI-1** later.

---

## 1. Six canonical workstreams

Every existing roadmap / backlog item maps to exactly one workstream.

### A. ESTIMATING CORE

Envelope, requirements, quantity↔rate authority, commercial reconciliation, shadow/parity, Breakdown explainability.

Includes: REQ-1, REQ-2, REQ-3, REQ-4, RATE-QUALITY-01, remaining DC consumption honesty, golden/parity for requirements.

### B. WORK AREA MATURITY

Calculator maturation path per type.

Includes: DECK-1…5, DECK-R2 framing, BATH-R1, FITOUT-R1, T2-RW/FENCE/PERGOLA/KITCHEN, T2-CLAD/T2-ROOF, OD-FACE-01, PT-BI-1 (ex-3.2.3 remainder), 3.2.4–3.2.6, 3.3 assemblies (after requirements exist).

### C. PRICING DATA

Canonical catalogue, company rates honesty, supplier mapping.

Includes: CAT-V2-1, Owner material-input, SUP-0, SUP-1, RATE-LEGACY-01, unused `scope.*` deprecation (after consumer proof).

### D. CAPTURE

How information enters Facts / Conditions / Scope.

Includes: MEDIA-1/2/3, ISD-008 / D-S6 attachment security, remaining Builder Interview UX, FEAT-003 constraint expansion (gated D4), Analyse Job preserved.

### E. COMMERCIAL WORKFLOW

Documents the contractor sends and receives.

Includes: Quick Estimate → Pricing → Quote (already live), QUOTE-1/2/3, BRANDING-SNAPSHOT-01, BRANDING-P0 Owner Preview, RFQ-1/2/3, FEAT-002 optional quote items.

### F. INTELLIGENCE / PLATFORM

Learning, analytics, performance, production.

Includes: AN-1/AN-2, DNA-0, Stage 3.4 defaults, PERF-FUTURE-01, SD-PROD, FEAT-001 remaining collapse, DEMO-R7 Owner smoke, Production readiness gates.

---

## 2. Ordering challenges (applied)

Owner expected backbone is retained. Three dependency corrections:

| Challenge | Decision |
| --- | --- |
| Catalogue V2 strictly after all Deck UI | **Interleave.** Surface/face can use existing lm keys (DECK-1/2). Framing keys (CAT-V2-1) are required before DECK-R2 members. |
| Supplier after cladding/roofing | **Earlier.** Canonical catalogue + Deck keys first; CSV mapping does not need cladding. |
| Photos / quote send / analytics / PERF only at the end | **AN-1 and PERF are parallel.** Quote send does not need cladding. Photos feed Facts after security design; they must not invent prices. DNA still last among learning. Production SD last among product-claim gates. |

REQ-2 is **COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED**. Current MaterialRequirement emitter: **Deck surface only**. REQ-3 is **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED**. Current LabourRequirement emitter: **Deck labour only**. REQ-4 is **IN PROGRESS**. REQ-4A **COMPLETE LOCAL**. REQ-4B **NOT STARTED**. Remaining Owner Previews (Rates, Branding, DEMO-R7) are polish, not REQ-4B architecture blockers.

---

## 3. Canonical pipeline

```
PHASE 0   MASTER ARCHITECTURE LOCK + INDEPENDENT CHALLENGE RECONCILIATION
          (frozen — foundation-r1.1 pre-emission contract)
PHASE 1   REQ-1 → REQ-2 → REQ-3 → REQ-4
          LabourAdjustmentRef ready before REQ-3 emit
          REQ-SNAPSHOT-01 + component authority + parity classes before REQ-4 promotion
PHASE 2   DECK REFERENCE
          Interleave: minimum Deck material taxonomy as Deck requires it
          CAT-IDENTITY-01 before canonical Catalogue V2 seeding
PHASE 3   MATERIALS CATALOGUE V2 remainder
PHASE 4   BATHROOM · RETAINING · FENCE · PERGOLA · COMMERCIAL COMPONENTS · KITCHEN
PHASE 5   CLADDING · ROOFING
PHASE 6   PRICING DATA / SUPPLIER (CSV → mapping → first API)
PHASE 7   COMPANY LEARNING / CALIBRATION
PHASE 8   PHOTOS → VOICE → VIDEO LATER
PHASE 9   QUOTE SEND · PUBLIC QUOTE · ACCEPTANCE · RFQ
          QUOTE-IMMUTABILITY-DB-01 before acceptance Production
          SUB-AUTH-01 before RFQ
PHASE 10  ANALYTICS UI · PERFORMANCE (measured) · PRODUCTION RELEASE
```

Parallel/early: **AN-EVIDENCE-01 before AN-1 emitters**; PERF-FUTURE-01 measured; remaining Owner Previews (Rates, Branding, DEMO-R7); PT-BI-1 after PC cleanup.

---

## 4. Phase priority matrix

Priority: **CRITICAL** · **HIGH** · **MEDIUM** · **LATER**

### PHASE 0 — Master architecture lock + challenge reconciliation

| Field | Value |
| --- | --- |
| **ID** | PHASE-0 / PHASE-0-R1 |
| **Workstream** | F (docs) + A (pre-emission contract) |
| **Objective** | One canonical SoT; final pre-emission `foundation-r1.1` contract |
| **User value** | None directly; prevents competing roadmaps |
| **Technical dependency** | None |
| **Commercial dependency** | None |
| **Migration** | None |
| **Risk** | L |
| **Owner test** | None required beyond verification (behaviour identical) |
| **Why now** | Engine hardened; independent review said REQ-1 = GO after cheap contract widenings |
| **Why later** | n/a |
| **Non-goals** | Calculator emission; money; UI; REQ-1 aggregation |
| **Completion gate** | Docs + types + verifier; tsc/lint/build; commercial suites unchanged |
| **Priority** | CRITICAL |
| **Status** | **COMPLETE / ARCHITECTURE FROZEN** |

### PHASE 1 — Estimate requirements

| Field | Value |
| --- | --- |
| **ID** | PHASE-1 |
| **Workstream** | A |
| **Objective** | Requirements envelope → emit materials/labour → reconcile with priced lines |
| **User value** | Invisible at REQ-1; enables explainable takeoff |
| **Technical dependency** | PHASE 0 frozen (`foundation-r1.1`); R1 DC-01/02 already clean. LabourAdjustmentRef ready before **REQ-3**. **REQ-SNAPSHOT-01** + component authority + parity classes before **REQ-4** promotion. |
| **Commercial dependency** | Must not change $ at REQ-1 |
| **Migration** | REQ-4A `035_estimate_requirement_snapshots.sql` applied remote on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`). REQ-TXN-01 `036_persist_estimate_generation_v1.sql` **local only**. |
| **Risk** | M |
| **Owner test** | Goldens unchanged at REQ-1; later shadow diffs reviewed |
| **Why now** | Pre-emission contract final; Deck qty/rate coherent; calculators otherwise freeze packages forever |
| **Why later** | n/a for envelope |
| **Non-goals** | UI takeoff; Catalogue V2; changing money at REQ-1; implementing component-authority table |
| **Completion gate** | REQ-1 envelope tests; REQ-2/3 emit with `priced` honesty; REQ-4 only after snapshot + documented parity |
| **Priority** | CRITICAL |
| **Status** | REQ-1 **COMPLETE / TECHNICALLY VALIDATED**; REQ-2 **COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED**; REQ-2.1 **COMPLETE / TECHNICALLY VALIDATED**; REQ-3 **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED**; REQ-3.1 **COMPLETE / TECHNICALLY VALIDATED**; REQ-4 **IN PROGRESS**; REQ-4A **COMPLETE / TECHNICALLY VALIDATED**; REQ-4B **READY / NOT STARTED**; REQ-SNAPSHOT-01 **COMPLETE / REMOTE VALIDATED**; REQ-TXN-01 **COMPLETE / REMOTE VALIDATED** |
| **Batches** | **REQ-1** envelope + physical aggregation; **REQ-2** Deck **surface decking only**; **REQ-3** LabourRequirement emission; **REQ-4** requirement ↔ pricing reconciliation / shadow / promotion |

### PHASE 2 — Deck reference calculator

| Field | Value |
| --- | --- |
| **ID** | PHASE-2 |
| **Workstream** | B (+ C keys) |
| **Objective** | Deck becomes the transparent reference estimator |
| **User value** | HIGH — explainable hours and materials on the trial WA |
| **Technical dependency** | REQ-2/3; OD-FACE-01 for DECK-2; **CAT-IDENTITY-01** as DECK-1C-A-R1 after Owner identity gate, **before** DECK-1C-B prices / CAT-V2 rows |
| **Commercial dependency** | Documented $ change when replacing packages; parity first |
| **Migration** | None expected |
| **Risk** | H (visible Deck $) |
| **Owner test** | Known deck: takeoff + hours readable; access not double-counted |
| **Why now** | Best existing physical model; R2-R1 already priced surface lm |
| **Why later** | Framing members wait for keys |
| **Non-goals** | Engineering design; cladding |
| **Completion gate** | SIMPLE/MEDIUM/COMPLEX/EDGE goldens; Owner Preview |
| **Priority** | CRITICAL |
| **Batches** | DECK-1 transparent estimator + takeoff; DECK-2 face boards; DECK-3 task labour; DECK-4 calibration hooks (evidence, not DNA apply); DECK-5 transparency UI; DECK-R2 framing members |

### PHASE 3 — Materials Catalogue V2

| Field | Value |
| --- | --- |
| **ID** | PHASE-3 |
| **Workstream** | C |
| **Objective** | Canonical construction-material records; honest `calculatorSupport` |
| **User value** | Contractors can set **cost** on real materials |
| **Technical dependency** | Architecture § taxonomy; Owner material-input |
| **Commercial dependency** | No invented prices |
| **Migration** | Seed keys only if required; no destructive convert |
| **Risk** | M (key sprawl) |
| **Owner test** | Rates shows new keys as optional; unused not labelled Used now |
| **Why now** | Needed before member takeoff and supplier mapping |
| **Why later** | Full merchant list never in one dump |
| **Non-goals** | Supplier API; bathroom SKU explosion |
| **Completion gate** | Integrity script; Owner-supplied rows mapped |
| **Priority** | HIGH |

### PHASE 4 — Tier-1 remainder + Tier-2

| Field | Value |
| --- | --- |
| **ID** | PHASE-4 |
| **Workstream** | B |
| **Objective** | Bathroom + commercial components + RW/Fence/Pergola/Kitchen commercially useful QE |
| **User value** | HIGH — covers trial Fitout + outdoor set |
| **Technical dependency** | REQ envelope; CAT-V2 families as needed |
| **Commercial dependency** | Honest allowances where takeoff would be fake |
| **Migration** | None |
| **Risk** | M |
| **Owner test** | One job per type; no PC re-ask; no stacked labour |
| **Why now** | After Deck proves the template |
| **Why later** | Kitchen last (allowance-heavy) |
| **Non-goals** | Fixture SKUs; `commercial_fitout` calculator; building roofing |
| **Completion gate** | Maturity steps 1–12 per type (promotion still Owner) |
| **Priority** | HIGH |
| **Sequence** | BATH-R1 ∥ FITOUT-R1 → T2-RW → T2-FENCE → T2-PERGOLA → T2-KITCHEN |

### PHASE 5 — Cladding / Roofing

| Field | Value |
| --- | --- |
| **ID** | PHASE-5 |
| **Workstream** | B |
| **Objective** | Greenfield product WAs only when Owner wants them in the supported catalogue |
| **User value** | MEDIUM until requested |
| **Technical dependency** | Requirements model proven; stay hidden until built |
| **Commercial dependency** | New keys + goldens |
| **Migration** | New types / templates |
| **Risk** | H (new domain) |
| **Owner test** | Owner Preview before any “supported” claim |
| **Why now** | Only if Owner prioritises |
| **Why later** | Zero current code; OD-CAT-02 hide until built |
| **Non-goals** | Painting-as-cladding |
| **Completion gate** | Full maturity framework |
| **Priority** | LATER (Owner may raise) |

### PHASE 6 — Pricing data / supplier

| Field | Value |
| --- | --- |
| **ID** | PHASE-6 |
| **Workstream** | C |
| **Objective** | Map canonical materials to supplier prices without replacing the domain model |
| **User value** | HIGH for cost accuracy |
| **Technical dependency** | CAT-V2 Deck keys live |
| **Commercial dependency** | Account/branch prices; timestamped |
| **Migration** | Mapping + price cache tables |
| **Risk** | H (data quality) |
| **Owner test** | One merchant CSV; company still outranks |
| **Why now** | After keys exist — not after cladding |
| **Why later** | APIs wait for commercial access |
| **Non-goals** | Multi-merchant sync; sell-from-supplier |
| **Completion gate** | SUP-0 types/tables; SUP-1 first import |
| **Priority** | HIGH (CSV) / LATER (API) |

### PHASE 7 — Company learning / calibration

| Field | Value |
| --- | --- |
| **ID** | PHASE-7 |
| **Workstream** | F |
| **Objective** | Observe→recommend→approve across rate/productivity/scope/material/commercial/outcome |
| **User value** | HIGH once volume exists |
| **Technical dependency** | Requirements history; AN-1; 3.4 defaults |
| **Commercial dependency** | No silent mutation |
| **Migration** | Maybe recommendation tables |
| **Risk** | H if silent |
| **Owner test** | Approve/dismiss does not auto-write |
| **Why now** | After structured evidence exists |
| **Why later** | Trial volume is insufficient |
| **Non-goals** | AI memory; silent GM change |
| **Completion gate** | OD-ARCH-03 UX; no `lib/company-dna` until authorised |
| **Priority** | MEDIUM now / HIGH later |

### PHASE 8 — Multimodal capture

| Field | Value |
| --- | --- |
| **ID** | PHASE-8 |
| **Workstream** | D |
| **Objective** | Photos → Facts; voice → transcript → analysis; video later |
| **User value** | HIGH for real site capture (frozen journey already mentions photos) |
| **Technical dependency** | ISD-008 / D-S6 security; existing text pipeline |
| **Commercial dependency** | Must not invent prices |
| **Migration** | Attachments + storage **yes** |
| **Risk** | H (security) |
| **Owner test** | Upload + RLS; confirmation before Fact write |
| **Why now** | After security design; can parallel Phase 4 |
| **Why later** | Video last (cost) |
| **Non-goals** | Vision that writes rates |
| **Completion gate** | MEDIA-1 then MEDIA-2; MEDIA-3 explicit later |
| **Priority** | HIGH (photos) / MEDIUM (voice) / LATER (video) |

### PHASE 9 — Quote send / acceptance / RFQ

| Field | Value |
| --- | --- |
| **ID** | PHASE-9 |
| **Workstream** | E |
| **Objective** | Send, public view, client accept, subbie RFQ adopt-cost |
| **User value** | HIGH commercially; independent of cladding |
| **Technical dependency** | Token authz; BRANDING-SNAPSHOT-01 with send; cost-first adopt |
| **Commercial dependency** | Legal review of e-sign; immutable accepted revision |
| **Migration** | Yes (tokens, view, signature, RFQ) |
| **Risk** | H (authz + legal) |
| **Owner test** | Send → view → accept; staff mark-accepted ≠ client accept |
| **Why now** | Can parallel WA maturity after Deck transparency |
| **Why later** | Payments out of scope |
| **Non-goals** | Marketplace; auto-award RFQ |
| **Completion gate** | QUOTE-1/2/3; RFQ-1/2/3 |
| **Priority** | HIGH (send) / MEDIUM (accept, RFQ) |

### PHASE 10 — Analytics UI / performance / production

| Field | Value |
| --- | --- |
| **ID** | PHASE-10 |
| **Workstream** | F |
| **Objective** | Product analytics after event history; measured PERF; Production SD + release |
| **User value** | MEDIUM until events exist |
| **Technical dependency** | AN-1 history; PERF measurements; security/RLS/rollback |
| **Commercial dependency** | Supported-WA honesty already in R1 |
| **Migration** | Maybe event table |
| **Risk** | H for Production SD |
| **Owner test** | Enablement runbook; rollback drill |
| **Why now** | Analytics UI only after history; Production last |
| **Why later** | AN-1 emitters should start **early** (see below) |
| **Non-goals** | Analytics UI in REQ-1 |
| **Completion gate** | AN-2; PERF P0/P1 closed or accepted; SD-PROD Owner sign-off |
| **Priority** | AN-1 HIGH early; AN-2 LATER; PERF parallel; SD-PROD LATER |

---

## 5. Immediate implementation after this freeze

**Next batch: REQ-1** — Estimate requirements output envelope + physical aggregation/composition.

REQ-1 shall:

- add optional `requirements[]` to `CalculatorResult` or equivalent;
- allow empty arrays;
- preserve existing calculators;
- aggregate **physical** requirements independently from current priced line authority;
- preserve provenance;
- make no new physical quantities;
- make no UI takeoff;
- change no pricing authority;
- support shadow/parity later.

Do **not** start REQ-1 in this PHASE 0-R1 task.

RATE-QUALITY-01 stays backlog. Do not auto-correct company `$23/m²`.

---

## 6. Backlog mapping (do not lose items)

| Item | Workstream | Phase |
| --- | --- | --- |
| REQ-1…4 | A | 1 |
| DECK-1…5, DECK-R2, OD-FACE-01 | B | 2 |
| CAT-V2-1, Owner material input | C | 2–3 |
| BATH-R1, FITOUT-R1, T2-* | B | 4–5 |
| RATE-QUALITY-01 | A | after R2-R1 Preview |
| RATE-LEGACY-01 | C | after replacement parity |
| SUP-0/1 | C | 6 |
| MEDIA-1/2/3, ISD-008 | D | 8 (parallel earlier OK) |
| QUOTE-1/2/3, BRANDING-SNAPSHOT-01 | E | 9 |
| BRANDING-P0 Owner Preview | E | outstanding Preview |
| RFQ-1/2/3 | E | 9 |
| AN-1 | F | early (piggyback generate/send) |
| AN-2 | F | 10 |
| DNA-0, Stage 3.4 | F | 7 |
| PERF-FUTURE-01 | F | parallel |
| SD-PROD | F | 10 last |
| Stage 3.2.3 original PC suppress | — | **done in R1**; do not restart |
| PT-BI-1, 3.2.4–3.2.6 | B/D | after REQ/Deck or parallel UX |
| 3.3 assemblies | B | after requirements |
| FEAT-001 remaining WA collapse | F | later UX |
| FEAT-002 optional quote items | E | after goldens |
| FEAT-003 constraint expansion | D | gated D4 |
| DEMO-R6/R7 Owner smoke | F | outstanding Preview |
| Cost-first Rates Owner Preview | C/E | outstanding Preview |
| ISD-007 latency | F | PERF |
| REQ-SNAPSHOT-01 | A | 1 — **COMPLETE / REMOTE VALIDATED**; REQ-4B blocked by REQ-TXN-01 |
| REQ-TXN-01 | A | 0 — **COMPLETE / REMOTE VALIDATED**; `persist_estimate_generation_v1` (mandatory snapshot); 036 applied on `lxvnylhsbvudzzupxeqr` |
| CAT-IDENTITY-01 | C | 2–3 — **DECK-1C-A contract written**; implement as DECK-1C-A-R1 after Owner identity gate; **before** DECK-1C-B prices / CAT-V2 seeding |
| AN-EVIDENCE-01 | F | before AN-1 |
| QUOTE-IMMUTABILITY-DB-01 | E | before quote acceptance Production |
| SUB-AUTH-01 | E | before RFQ |
| ISD-MAP-01 | B/D | future CI; not REQ-1 |
| COMMERCIAL-P0 / cost-first / Foundation R1–R2-R1 | — | **landed** |

---

## 7. Production / release model

Preview becomes Production only through gates. This lock does **not** enable Production Scope Discovery.

| Gate | Meaning |
| --- | --- |
| Verification | Stage verify scripts + tsc/lint + commercial goldens |
| Owner Preview | Per-batch runbook PASS |
| Migration check | Forward-only; 001–034 present; no surprise 035 |
| Production SD | Separate Owner enablement; flag exact `"true"`; default off |
| Security / RLS | Stage 2A + 3.1C contracts preserved |
| Rollback | Previous Vercel deploy; DB PITR — not down-migrations |
| Observability | Structured logs; no secret leakage |
| Performance | No P0 latency blocker documented; PERF-FUTURE-01 measured |
| Support maturity | Work Area band honesty; trial types only claimed as trial |

---

## 8. Performance workstream (PERF-FUTURE-01)

Distinct. Do not mix broad performance refactors into calculator-authority batches.

| Class | Areas | Notes |
| --- | --- | --- |
| **P0** | None documented as release-blocking | Do not invent |
| **P1** | Analyse Job wait; Work Area appearance after analysis; margin `router.refresh`; residual QE remount | Owner-felt |
| **P2** | Save transitions; Dashboard filtering remount; Scope Discovery when enabled | DEMO-R7 dropped duplicate auth fetch |

Measure before speculative Pricing/Quote optimisation.

---

## 9. Owner decisions (this lock)

See Section 12. **None block REQ-1.**

---

## 10. Outstanding Owner Previews (not programme blockers for REQ-1)

Independent review: REQ-1 = GO. FOUNDATION-R2 / R2-R1 / R2-R1-R1 pricing remediation is complete. Remaining Previews are product polish, not architecture gates:

- Cost-first Rates Owner Preview
- DEMO-R7 smoke
- BRANDING-P0
- Stage 3.2.2 R5 Owner Demo (stage not globally Complete)
- FOUNDATION-R2-R1 runbook remains available if Owner still wants a live Deck $ check; it is **not** a REQ-1 start blocker after PHASE 0 freeze

---

## 11. Protected contracts

See `QUOTR_PRODUCT_ARCHITECTURE.md` §7. Do not redesign without a defect.

---

## 12. Owner decision register

| ID | Question | Status | Lock / recommendation | Blocking? |
| --- | --- | --- | --- | --- |
| **OD-ARCH-01** | Materials UI location | **LOCKED for MVP** | **A** — sibling Quick Estimate surface/section, not hidden only inside Breakdown. Future implementation (DECK-5). | No |
| **OD-ARCH-02** | Catalogue granularity | **REFINED** | Canonical **physical material** is separate from supplier SKU and **rate unit** (`CAT-IDENTITY-01`). Owner-provided taxonomy still required later. No SKU dump. | No |
| **OD-ARCH-03** | Learning UX | **RETAINED** | Observe → recommend → **explicit user approval**. | No |
| **OD-ARCH-04** | Supplier account prices | **REFINED** | Do not blindly replace company rates. Company configured authority may be smoothed/freight-aware. Supplier precedence may be configurable later. | No |
| **OD-ARCH-05** | Quote Send vs WA maturation | Open / recommended | Parallel after Deck transparency | No |
| **OD-ARCH-06** | Photo capture timing | Open / recommended | After D-S6/ISD-008; parallel to Phase 4 | No |
| **OD-ARCH-07** | Cladding/roofing vs Tier-2 | Open / recommended | After Tier-2 unless Owner raises | No |
| **OD-FACE-01** | Face boards F/R/L/R vs count | Open | F/R/L/R primary | DECK-2 only |
| **OD-T1-01** | Customer “Supported” claim | Open | Stay Trial-supported | No |
| **OD-PC-01** | Occupied/hours/parking labour | Open | Persist-only until composition designed; LabourAdjustmentRef can *record* multiple factors now | REQ-3 composition, not REQ-1 |
| **OD-SNAP-01** | Branding snapshot with send | Open | With QUOTE-2; plus **QUOTE-IMMUTABILITY-DB-01** before acceptance Production | QUOTE-2 / Production |

Already approved: CF-D1–D7, D1–D16 Builder Interview, OD-CAT-01/02/03, OD-R1-01/02.

---

## 13. Exact next action

1. PHASE 0 remains frozen.  
2. REQ-4A is **COMPLETE / TECHNICALLY VALIDATED**.  
3. REQ-SNAPSHOT-01 is **COMPLETE / REMOTE VALIDATED**. REQ-TXN-01 is **COMPLETE / REMOTE VALIDATED**. REQ-4B is **READY / NOT STARTED**.  
4. Do **not** start REQ-4B until Owner review + commit/push + remote 036. First candidate: Deck `decking.surface`. Deck labour stays SHADOW.  
5. CM-03 remains **BACKLOG / NOT STARTED**.  
6. Do not deploy Production. Do not enable Production Scope Discovery.


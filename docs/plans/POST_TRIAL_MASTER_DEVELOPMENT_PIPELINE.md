# Post-Trial Master Development Pipeline

**Status:** Programme active. **FOUNDATION-R1 Complete / Preview regression remediated by R1-R1.** **FOUNDATION-R1-R1 Complete Local / Owner Preview Pending** (2026-08-15). **FOUNDATION-R2** = Scope Details completeness (**Not Started**). REQ-1/2/3 and Deck pilot **Not Started**.  
**HEAD baseline:** `f168fe0ec8a857fffa79888435ca90b9e8a1db25`  
**Implementation:** `docs/implementation/FOUNDATION_R1_PROJECT_CONDITIONS_SUPPORT_COMPLETION.md`  
**R1-R1:** `docs/implementation/FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md`  
**Audits:**  
- `docs/audits/POST_TRIAL_MASTER_ARCHITECTURE_AUDIT.md`  
- `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md`  
- `docs/audits/PROJECT_CONDITIONS_SINGLE_AUTHORITY_AUDIT.md`  
**Architecture:** `docs/architecture/QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md`

**Unchanged:** Production Scope Discovery **Disabled**; Company DNA **Not Started**; PERF-FUTURE-01 **Planned**; Stage **3.2.3 Not Started** (reconciled below — do not start as originally scoped).

**Sequencing correction:** Do **not** treat `CalculatorResult.requirements` emission as FOUNDATION-R2. Canonical next after R1 Owner Preview:

FOUNDATION-R1 → FOUNDATION-R2 (Scope Details completeness) → REQ-1 → REQ-2 → REQ-3 → DECK-1 / DECK-2 / DECK-3.

---

## 0. Why this pipeline (not “continue 3.2.3”)

Repository evidence after the customer trial (items 1–3 addressed in FOUNDATION-R1; remaining is materials/takeoff):

1. **Commercial stacking** on demolition + external stairs — **fixed in R1** (project access once; carting haulage-only).  
2. **Scope Details asking** project-wide access/carry/floor/hours/hazmat — **removed/suppressed in R1**. Remaining quality/completeness is FOUNDATION-R2.  
3. **All 14 WAs claiming “Estimate-ready”** — **demoted in R1** via support contract.  
4. **Materials are allowance-first**; `MaterialRequirement` is types-only; Deck face boards still hardcode $22/35 lm + labour 35/55.  
5. Stage **3.2.3** (“suppress project-known topics in Scope Details”) **overlaps** Project Conditions cleanup. Starting 3.2.3 UI first would clone WA access asks (`registry.ts` access_clone).

**Preserve:** COMMERCIAL-P0, Cost-first Rates, 3.2.1 engine, 3.2.2 Project Conditions **ask** layer, 3.1B Preview SD, Deck/Bathroom/Fitout trial calculators, branding upload.

---

## 1. Stage 3.2.3+ reconciliation

| Old stage | Verdict | Action |
| --- | --- | --- |
| **3.2.3** WA-aware interview + suppress PC topics in Scope Details | **Split** | **Suppress/remove PC duplicates → FOUNDATION-R1.** Remaining WA-conditional interview UI → **PT-BI-1** after R1 (renamed; do not run original 3.2.3 first). |
| **3.2.4** Assumption / readiness / QE soft-block | **Remain** | After Scope Details cleanup so readiness isn’t driven by duplicate access Qs. |
| **3.2.5** Multi-WA + mobile UX | **Remain / later** | After catalogue honesty; don’t expand interview chrome first. |
| **3.2.6** Preview E2E Deck/Bath/Fitout | **Move** | After Deck requirements pilot + PC cleanup (new goldens). |
| **3.3** Commercial Assemblies | **Depend on** EstimateRequirement | After Deck+Fitout requirements exist; assemblies compose requirements, not new $ engines. |
| **3.4** Company defaults / manual learning | **Remain before DNA** | After rates + requirements provenance. |
| Company DNA | **Later** | Needs structured requirements + outcomes; not now. |
| Production SD | **After** supported-catalogue honesty | Flag stays off. |
| PERF-FUTURE-01 | **Parallel measured** | Not a gate for R1; P1 margin/analyse remount remains. |
| MaterialRequirement / Deck takeoff (old M1/M2) | **Remain but reordered** | Types freeze in R1; emit on Deck after PC fix. |

Handoff `STAGE_3_2_BUILDER_INTERVIEW_HANDOFF.md` “do not start 3.2.3” **still holds** — start **FOUNDATION-R1** instead when Owner authorises.

---

## 2. Immediate first batch (challenge to Owner candidate)

**Owner candidate:** FOUNDATION-R1 = PC cleanup + Supported WA contract + MaterialRequirement/LabourRequirement architecture lock.

**Challenge:** Architecture lock is **this audit’s** `QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md`. Emitting Material/LabourRequirement from calculators **before** DC-01/DC-02 would **freeze stacked hours** into the new contract.

**Safer FOUNDATION-R1 (recommended):**

| In | Out |
| --- | --- |
| Project Conditions single-authority: stop WA PC asks; fix DC-01/DC-02/PC-07/PC-09; unify access labour helper | Calculator takeoff rewrite |
| Supported Work Area **product contract**: which types are claimed; demote `estimateSupport`; do not add cladding/roofing; commercial = parent+components (docs + catalogue labels — minimal UI honesty) | New WAs / new calculators |
| **Types-only** freeze: `EstimateRequirement` / `MaterialRequirement` / `LabourRequirement` TypeScript types **unused by calculators** | `priced: true` emit; Deck face Facts; Catalogue V2 rows |

If Owner wants architecture lock **docs-only**, drop the types file from R1 — the architecture doc already locks the contract.

---

## 3. Phase catalogue

Risk: L = low, M = medium, H = high (commercial or product-claim).

### PT-AUD-01 — Post-trial audit (this batch)

| Field | Value |
| --- | --- |
| **Objective** | Lock baseline, coverage, PC authority, requirements architecture, pipeline |
| **Dependencies** | Trial complete |
| **Scope** | Docs listed in audit §V |
| **Non-goals** | Any product code, migrations, FOUNDATION-R1 |
| **Migration** | None |
| **Verification** | `npx tsc --noEmit`; `npm run lint` |
| **Owner preview** | Read audits; decide OD-* list |
| **Risk** | L |
| **Why now** | Programme lock after trial |

---

### FOUNDATION-R1 — PC authority + supported catalogue + types freeze

| Field | Value |
| --- | --- |
| **Status** | **Complete / Preview regression remediated by R1-R1.** |
| **Implementation** | `docs/implementation/FOUNDATION_R1_PROJECT_CONDITIONS_SUPPORT_COMPLETION.md` |
| **Verify** | `scripts/verify-foundation-r1-project-conditions-support.ts` |
| **Dependencies** | PT-AUD-01; 3.2.2 R1 combined helper exists |
| **Scope** | Remove/suppress WA PC questions; fix demo/stairs stack; ceilings.access suppress bug; kitchen/walls/flooring dead access Qs; AI dual-write; catalogue `estimateSupport` honesty; optional `lib/estimate/requirements.ts` types only; goldens for single-consume |
| **Non-goals** | Material emit; face-board Facts; 3.2.3 interview UI; Production SD; DNA; PERF pass |
| **Migration** | None expected (application allowlist / templates) |
| **Verification** | Access single-consume goldens (deck + demolition + stairs); question-bank tests; existing commercial goldens |
| **Owner preview** | Deck + Fitout: access asked **once**; estimate $ does not double-uplift vs pre-fix snapshot |
| **Risk** | **H** (commercial $ change on demo/stairs — correct but visible) |
| **Why now** | Live inflation risk; 3.2.3 would otherwise clone asks |

---

### FOUNDATION-R1-R1 — Project Conditions availability + estimate-readiness

| Field | Value |
| --- | --- |
| **Status** | **Complete Local / Owner Preview Pending** (2026-08-15) |
| **Implementation** | `docs/implementation/FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md` |
| **Verify** | `scripts/verify-foundation-r1r1-project-conditions-readiness.ts` |
| **Dependencies** | FOUNDATION-R1 Preview regression (Generate unlocked; PC stage missing) |
| **Scope** | Deterministic PC applicability; required/assumable/optional; UI + server Generate hard-block; known-condition suppression; PC stage always visible when known or applicable |
| **Non-goals** | FOUNDATION-R2; REQ-1; requirement emission; Deck takeoff; 3.2.3; DNA; PERF; Production |
| **Migration** | None |
| **Owner preview** | `docs/runbooks/FOUNDATION_R1R1_OWNER_PREVIEW.md` |
| **Risk** | M (Generate now correctly blocked until required PC resolved) |
| **Why now** | Owner Preview found Generate before Project Conditions; several WAs showed no PC questions |

---

### FOUNDATION-R2 — Work Area Scope Details completeness / question quality

| Field | Value |
| --- | --- |
| **Status** | **Not Started** |
| **Objective** | Remaining Scope Details are Work-Area-physical only: conditionals, copy, completeness, no leftover project-logistics overlap |
| **Dependencies** | FOUNDATION-R1-R1 Owner Preview |
| **Scope** | Question quality/conditionals; skip_bin vs `waste_bin_access`; disposal questions vs project waste; `deck.level` copy vs project `floor_level`; remaining interview DEFER clones; no new WAs |
| **Non-goals** | Requirement emission; calculator takeoff rewrite; 3.2.3 interview UI; Deck face boards |
| **Migration** | None |
| **Verification** | Question-bank completeness; no new PC duplicates; Deck/Bathroom/Fitout still generate |
| **Owner preview** | Scope Details feel complete and local to each WA |
| **Risk** | M (question UX) |
| **Why now** | R1 removed PC duplicates; remaining templates still need quality/completeness before requirements freeze inputs |

---

### REQ-1 — EstimateRequirement aggregation + calculator output envelope

| Field | Value |
| --- | --- |
| **Status** | **Not Started** |
| **Objective** | Calculators may attach `requirements[]` envelope; money still from line items; no claim of takeoff completeness |
| **Dependencies** | FOUNDATION-R2 (input quality) + FOUNDATION-R1 DC-01/02 |
| **Scope** | `CalculatorResult.requirements` optional; Deck maps existing lines → envelope (`priced` flags honest); other WAs empty or passthrough |
| **Non-goals** | Face-edge math; Materials Catalogue V2; UI takeoff page |
| **Migration** | None (prefer derive-on-read) |
| **Verification** | Envelope present; sums do not change commercial $ vs R1 |
| **Risk** | M |

---

### REQ-2 — MaterialRequirement emission

| Field | Value |
| --- | --- |
| **Status** | **Not Started** |
| **Objective** | Emit MaterialRequirement from calculators that already have quantities (Deck first) |
| **Dependencies** | REQ-1 |
| **Non-goals** | Merchant-complete SKU lists; second pricing engine |
| **Risk** | M |

---

### REQ-3 — LabourRequirement emission

| Field | Value |
| --- | --- |
| **Status** | **Not Started** |
| **Objective** | Emit LabourRequirement with canonical `baseHours` and **one** `adjustmentRef` (never bake project access into each task and reapply) |
| **Dependencies** | REQ-1; DC-01/02 already clean |
| **Non-goals** | Task-level Deck breakdown (DECK-3) |
| **Risk** | M |

---

### DECK-1 — Transparent Deck estimator + takeoff

| Field | Value |
| --- | --- |
| **Status** | **Not Started** |
| **Objective** | Deck QE explains major material quantities and lumped labour without claiming full framing takeoff |
| **Dependencies** | REQ-2; REQ-3 |
| **Non-goals** | Face-edge geometry (DECK-2); task labour breakdown (DECK-3) |
| **Risk** | M |

---

### DECK-2 — Face boards

| Field | Value |
| --- | --- |
| **Status** | **Not Started** |
| **Objective** | Commercially useful face-board qty; Owner OD-FACE-01 (Front/Rear/Left/Right + lm fallback) |
| **Dependencies** | DECK-1; OD-FACE-01 |
| **Non-goals** | Full joist/bearer SKU takeoff |
| **Risk** | M |

---

### DECK-3 — Task-level labour breakdown

| Field | Value |
| --- | --- |
| **Status** | **Not Started** |
| **Objective** | Deck labour hours by task (demolition, substructure, decking, fascia, …) |
| **Dependencies** | REQ-3; DECK-1 |
| **Non-goals** | Engineering design |
| **Risk** | M |

---

### DECK-R1 — Face boards + labour breakdown + priced takeoff v1 (historical name)

Superseded by **DECK-1 / DECK-2 / DECK-3**. Do not start as a single batch.

| Field | Value |
| --- | --- |
| **Status** | **Superseded / Not Started** |
| **Objective** | (Historical) commercially useful Deck QE with face-board qty, major materials, labour hours by task |
| **Dependencies** | REQ-2/REQ-3; Owner OD-FACE-01 |
| **Scope** | See DECK-1–3 |
| **Non-goals** | Full joist/bearer SKU takeoff (DECK-R2 framing); cladding |
| **Migration** | None |
| **Verification** | Goldens: rectangle deck N sides; irregular override; no double access; cost-first |
| **Owner preview** | Known deck: takeoff + hours readable |
| **Risk** | M |

---

### CAT-V2-1 — Materials Catalogue V2 taxonomy (framing + deck keys)

| Field | Value |
| --- | --- |
| **Objective** | Canonical keys for FRAMING + DECK components; contractors can set **cost** rates; no invented prices |
| **Dependencies** | Architecture §8; DECK-1/DECK-2 may land surface/face first with existing lm keys |
| **Scope** | Add keys (empty optional benchmarks); Rates UI groups; mark `calculatorSupport` honestly |
| **Non-goals** | Merchant-complete SKU dump; supplier API; bathroom SKU explosion |
| **Migration** | Rate catalogue seed only if required; no destructive convert |
| **Verification** | Catalogue integrity script; no calculator $ change unless wired |
| **Owner preview** | Rates screen shows new keys as optional |
| **Risk** | L |
| **Why now** | Need keys before member takeoff and supplier mapping |

---

### DECK-R2 — Framing members (joists/bearers/posts/concrete)

| Field | Value |
| --- | --- |
| **Objective** | Replace `deck.substructure.m2` package with member requirements where Facts exist |
| **Dependencies** | CAT-V2-1; DECK-1 |
| **Scope** | Minimal Facts (centres/size) or conservative defaults with low confidence |
| **Non-goals** | Engineering design |
| **Risk** | M |

---

### BATH-R1 — Bathroom requirements (honest packages + linings/tiles)

| Field | Value |
| --- | --- |
| **Objective** | Bathroom QE explains labour hours + major materials without fake joinery SKUs |
| **Dependencies** | REQ-2; sheet keys exist |
| **Scope** | Flip lining/tile/waterproofing to MaterialRequirement where qty exists; keep fixtures/services as Subcontract/allowance; drop `bathroom.access` (done in R1) |
| **Non-goals** | Fixture SKU catalogue |
| **Risk** | M |

---

### FITOUT-R1 — Commercial component takeoff (walls/ceilings/doors/flooring/paint)

| Field | Value |
| --- | --- |
| **Objective** | Commercial interior QE via **component WAs**, priced sheets/paint where build-ups exist |
| **Dependencies** | FOUNDATION-R1 catalogue: commercial = parent+components; REQ-1 envelope |
| **Scope** | Flip `priced: true` on sheet/paint/flooring build-ups; steel/timber keys if Facts known; labour breakdown light |
| **Non-goals** | New `commercial_fitout` calculator; fire/seismic assemblies |
| **Risk** | M |

---

### T2-RW / T2-FENCE / T2-PERGOLA / T2-KITCHEN

| Phase | Objective | Deps | Non-goals | Risk |
| --- | --- | --- | --- | --- |
| **T2-RW** | Retaining commercially useful QE (posts/sleepers/drainage/backfill m³) | CAT-V2 retaining keys; R1 carting single-authority | Full engineer design | M |
| **T2-FENCE** | Posts/rails/palings/gates | CAT-V2 fence keys | Custom metalwork | M |
| **T2-PERGOLA** | Members + existing roof rates | DECK-R2 patterns | Building roofing WA | M |
| **T2-KITCHEN** | Honest allowances + labour hours | BATH-R1 patterns | Cabinet SKU takeoff | M |

Sequence: **RW → Fence → Pergola → Kitchen** (dimensional similarity to Deck; kitchen last because allowance-heavy).

---

### T2-CLAD / T2-ROOF — greenfield

| Field | Value |
| --- | --- |
| **Objective** | New WAs only when Owner wants them in the **supported** catalogue |
| **Dependencies** | Requirements model proven on Deck+Fitout; **not** before FOUNDATION-R1 honesty (must stay hidden until then) |
| **Scope** | Type + facts + calculator + keys |
| **Non-goals** | Pretending painting “Exterior cladding” is cladding |
| **Risk** | H (new domain) |
| **Why later** | Zero current code |

---

### MEDIA-1 Photos → MEDIA-2 Voice → MEDIA-3 Video later

| Phase | Objective | Deps | Scope | Non-goals | Migration | Risk | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **MEDIA-1** | Project photo capture + storage + optional vision into **existing Brief/Facts** | ISD-008 / D-S6 security design | Bucket + RLS + metadata; attach to project; AI **optional** after storage | Voice/video; SD production | **Yes** (attachments + storage) | H (security) | Frozen journey already says photos; **no upload today** |
| **MEDIA-2** | Voice note → transcript → user review → Brief/Facts path | MEDIA-1 storage patterns | Record/upload, transcribe, review | Video | Possible | M | Reuses text analysis |
| **MEDIA-3** | Video later | MEDIA-1/2 cost model | Storage, audio extract, sparse frames | Real-time sitewalk | Yes | H (cost) | Confirm last |

Sequence matches current architecture (text notes + `photo_caption` / `voice_to_text` **stubs only**).

---

### SUP-0 Supplier mapping architecture → SUP-1 First integration

| Phase | Objective | Deps | Non-goals | Risk |
| --- | --- | --- | --- | --- |
| **SUP-0** | Tables/types for materialKey→supplier SKU/price/timestamp | CAT-V2-1 | Live API | M |
| **SUP-1** | First supplier (CSV/manual likely) | SUP-0; Deck keys used live | Multi-merchant sync | H (data quality) |

---

### QUOTE-1 Email → QUOTE-2 Public URL → QUOTE-3 Digital acceptance

| Phase | Objective | Deps | Scope | Non-goals | Migration | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| **QUOTE-1** | Send quote email | None product-blocking | Transactional email; link to in-app or PDF | Portal | Maybe email log | M |
| **QUOTE-2** | Secure public quote page | QUOTE-1 or parallel | Token, expiry, viewed_at; **BRANDING-SNAPSHOT-01** with send | Signature | **Yes** | H (authz) |
| **QUOTE-3** | Accept/decline + signature + immutable accepted version | QUOTE-2; commercial snapshot already on create | Accepting person, timestamp, audit; email copy | Payments | **Yes** | H (legal) |

Do **not** treat staff `markQuoteAccepted` as client acceptance.

---

### RFQ-1 Contacts + RFQ send → RFQ-2 Subbie response → RFQ-3 Adopt cost

| Phase | Objective | Deps | Non-goals | Risk |
| --- | --- | --- | --- | --- |
| **RFQ-1** | Select subbie, email secure RFQ of **project-specific scope** (from requirements/scope items) | EstimateRequirement or existing scope items; contacts | Marketplace | H |
| **RFQ-2** | Subbie price/notes/exclusions + optional PDF | QUOTE-2-like token model | Auto-award | H |
| **RFQ-3** | Adopt **cost** into estimate; GM derives sell | Cost-first engine (done) | Silent DNA mutation | M |

No RFQ tables exist today (`KNOWN_LIMITATIONS.md`).

---

### AN-1 Analytics capture → AN-2 Analytics UI

| Phase | Objective | Now vs later | Risk |
| --- | --- | --- | --- |
| **AN-1** | Minimal events so future UI is not crippled | **Start early (can piggyback quote send / estimate generate)** — see master audit §Q | L |
| **AN-2** | Dashboards | After AN-1 has history | L |

AN-1 should **not** wait for AN-2. Candidate: estimate_generated, pricing_created, quote_created, quote_sent, quote_viewed (with QUOTE-2), quote_accepted/declined — plus already-existing `business_status` and `pricing_audit_log`.

**FOUNDATION-R1:** types-only contract in `lib/analytics/event-contract.ts`. No emitters added (no existing event writer was trivial/non-invasive). AN-1 remains **Not Started**.

---

### PT-BI-1 — Remaining Builder Interview (ex-3.2.3 UI)

WA-conditional questions **that are not project conditions**. After FOUNDATION-R1 emptied PC clones.

Then **3.2.4** readiness, **3.2.5** mobile, **3.2.6** E2E as originally intended but retargeted to supported catalogue.

---

### DNA-0 — Company DNA (later)

Not started. Requires requirements history + accepted quotes + optional actuals. **After** 3.4 defaults and a volume of AN-1 events.

---

### PERF-FUTURE-01 — Measured optimisation

Parallel. Evidence-backed P1: Analyse Job wait; margin `router.refresh`; residual QE remount. **Not** a blocker for FOUNDATION-R1. Do not speculative-optimise Pricing/Quote without measurements.

---

### SD-PROD — Production Scope Discovery enablement

**Last among product-claim gates.** Requires supported-WA honesty so ISD cannot present `commercial_fitout` / cladding-class labels as equal WAs. Flag `SCOPE_DISCOVERY_ENABLED` stays default off until Owner sign-off.

---

## 4. Recommended order (compressed)

```
PT-AUD-01 (done)
→ FOUNDATION-R1 (Complete / Preview regression remediated by R1-R1)
→ FOUNDATION-R1-R1 (Complete Local / Owner Preview Pending)
→ FOUNDATION-R2 (Scope Details completeness / question quality)
→ REQ-1 (EstimateRequirement envelope)
→ REQ-2 (MaterialRequirement emission)
→ REQ-3 (LabourRequirement emission)
→ DECK-1 (transparent estimator + takeoff)
→ DECK-2 (face boards)
→ DECK-3 (task-level labour)
→ CAT-V2-1  (may overlap DECK-1 if using existing lm keys)
→ DECK-R2 framing (joists/bearers)
→ BATH-R1 ∥ FITOUT-R1
→ T2-RW → T2-FENCE → T2-PERGOLA → T2-KITCHEN
→ T2-CLAD / T2-ROOF (optional greenfield)
→ MEDIA-1 → MEDIA-2 → MEDIA-3
→ SUP-0 → SUP-1
→ QUOTE-1 → QUOTE-2 → QUOTE-3
→ RFQ-1 → RFQ-2 → RFQ-3
→ AN-1 (types frozen in R1; emitters later)
→ AN-2
→ PT-BI-1 / 3.2.4–3.2.6
→ 3.3 assemblies → 3.4 defaults → DNA-0
→ PERF-FUTURE-01 (parallel anytime after R1)
→ SD-PROD
```

Do **not** treat `CalculatorResult.requirements` emission as FOUNDATION-R2.

Parallelism allowed: AN-1 with R1; PERF with anything; CAT-V2-1 with DECK-R1; BATH ∥ FITOUT; QUOTE track vs T2 WAs (quotes don’t need cladding).

---

## 5. Owner decisions that gate the pipeline

See master audit §34. Pipeline does not start FOUNDATION-R1 until Owner authorises.

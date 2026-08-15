# POST-TRIAL MASTER ARCHITECTURE AUDIT

**Status:** Audit complete (2026-08-15). **FOUNDATION-R1: Complete / Preview regression remediated by R1-R1.** **FOUNDATION-R1-R1: Complete Local / Owner Preview Pending** — `docs/implementation/FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md`.  
**Mode:** Historical inventory. Do not treat “DO NOT IMPLEMENT” as current — R1 was later authorised (OD-R1-01).  
**HEAD (audit baseline):** `f168fe0ec8a857fffa79888435ca90b9e8a1db25`  
**Branch:** `hardening/stage-2a-security`  
**Author:** Repository evidence vs Owner programme brief.

### Companion documents (authoritative detail)

| Doc | Sections |
| --- | --- |
| `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md` | B, C, F, G |
| `docs/audits/PROJECT_CONDITIONS_SINGLE_AUTHORITY_AUDIT.md` | D, E |
| `docs/architecture/QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md` | H, I, J, K, L, M |
| `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md` | R, T, U |

---

## A. Current product baseline

| Item | Status | Evidence |
| --- | --- | --- |
| **Branch / HEAD** | `hardening/stage-2a-security` @ `f168fe0` | `docs(branding): record remote apply of organisation branding storage` (2026-08-14) |
| **Working tree** | **Dirty, non-product** | `M supabase/.temp/cli-latest`; `?? supabase/config.toml` — CLI local artifacts, not this audit |
| **Latest completed stages** | 3.1A/C/D Complete; **3.1B Complete — Preview Validated**; **3.2.0/R1/3.2.1 Complete**; **3.2.2 In Owner Preview / R5 Complete Local** | Backlog + roadmap |
| **COMMERCIAL-P0** | **Complete Local** | `docs/implementation/COMMERCIAL_P0_AUTHORITY_LOCK_COMPLETION.md` |
| **Cost-first Rates** | **Complete Local / Owner Preview Pending** | `docs/implementation/COST_FIRST_RATES_COMPLETION.md` |
| **DEMO-R7** | **Complete Local (Owner smoke pending)** | Backlog DEMO-R7; `verify-demo-r7-mobile-header-dashboard.ts` |
| **BRANDING-P0** | **Complete Local (Owner Preview pending)**; migration **034 Applied Remote** | `docs/implementation/BRANDING_P0_COMPANY_LOGO_COMPLETION.md` |
| **Scope Discovery** | **Preview-capable / Production Disabled** | `SCOPE_DISCOVERY_ENABLED` exact `"true"` only; default off (`.env.local.example`) |
| **Stage 3.2.3** | **Not Started** | Plan + handoff. **Do not start as originally scoped** — merge PC suppress into FOUNDATION-R1 |
| **Company DNA** | **Not Started** | No `lib/company-dna`; verify scripts assert absence |
| **PERF-FUTURE-01** | **Planned** (not started) | `docs/performance/ASSISTANT_RESPONSIVENESS_LATENCY_OPTIMISATION_PASS.md` |
| **Migrations** | **001–034 present** | 034 = `organisation-branding` storage. No 035+ |

**Stale pointers (docs only, not product state):**  
- `STAGE_3_2_BUILDER_INTERVIEW_HANDOFF.md` still says Cost-first Rates **Not Started** — **stale** vs completion doc.  
- `docs/WORK_AREA_COVERAGE_MATRIX.md` (Phase 6I) claims fitout types have no questions/calculators — **stale**.  
- `QUOTR_ARCHITECTURE_FOUNDATION.md` §11 still says Stage 2B Not Started — historical; commercial engine + COMMERCIAL-P0 have shipped.  
- Handoff “next commercial = Rates UI Not Started” — Rates UI **Complete Local**.

**Not changed by this audit:** no implementation, no migration, no status marked Complete for future work.

---

## B–C. Work Area inventory and recommended catalogue

**Product WAs (14):** `deck`, `retaining_wall`, `bathroom`, `kitchen`, `fence`, `pergola`, `external_stairs`, `demolition`, `internal_walls`, `ceilings`, `doors`, `flooring`, `painting`, `plastering` — `lib/scopes/catalogue.ts`.

**ISD-only parent:** `commercial_fitout` — **not** in catalogue; **cannot** pass `isSupportedWorkAreaType`.

**Absent as WAs:** cladding, building roofing, windows, landscaping, earthworks, drainage-as-WA, plumbing-as-WA, electrical-as-WA, carpentry-as-WA, renovation/extension types, internal stairs, other/custom.

**No Work Area is maturity A.** Trial Deck / Bathroom / Fitout = **B**. See coverage audit for the full 17-column matrix.

### Recommended supported catalogue

| Tier | Claim | Canonical |
| --- | --- | --- |
| **1** | Deck; Bathroom; **Commercial interior as parent + components** | `deck`; `bathroom`; components `demolition`, `internal_walls`, `ceilings`, `doors`, `flooring`, `painting`, `plastering` — **not** a single `commercial_fitout` calculator |
| **2** | Retaining, Fence, Pergola, Kitchen, then **greenfield** Cladding & Roofing | Existing types first; cladding/roofing **hidden until built** |
| **3** | External stairs (after DC-02); later windows/etc. | Don’t claim now |
| **Hide** | Cladding, roofing, windows, landscaping, earthworks, plumbing, electrical, carpentry, extension, other; `commercial_fitout` as Estimate-ready WA | Stop blanket `estimateSupport: "calculator"` → “Estimate-ready” |

**Commercial fitout is too broad as one Work Area.** Trial and ISD already treat it as a **package of components**. Keep parent for discovery; price components.

---

## D–E. Project Conditions — duplicates and double-consumption

Owner rule is **not enforced end-to-end**. R1 fixed **Deck/Fence/Pergola labour multiply**; questions remain; **demolition + external-stairs still stack**.

**WA Scope Details that are project conditions:** `*.access` on 10 types; demolition floor/carting/hours/services/hazmat; retaining carting.

**Keep as WA:** `deck.access_type`, `deck.height_m`, `ceilings.access` (height), `fence.slope_condition`, `fence.services_risk`.

**HIGH commercial risk:**  
- **DC-01** demolition: project labour factor × WA access qty factor × optional allowance  
- **DC-02** external stairs: project factor × WA accessFactor on same hours  

**MEDIUM:** RW poor-access allowance + labour; carry labour + carting $; bathroom bypasses R1 helper; AI dual-write.

**MITIGATED commercially:** Deck/Fence/Pergola combined helper — **ask still duplicates**.

Full remediation table: `PROJECT_CONDITIONS_SINGLE_AUTHORITY_AUDIT.md` §5 (PC-01–PC-12, DC-01–DC-07).

---

## F. Scope Details quality (summary)

After conceptually removing PC questions, remaining banks are **mostly commercially useful but long**.

| WA | Remove/move to PC | Challenge (low signal) | Missing for A | Auto from AI/Facts |
| --- | --- | --- | --- | --- |
| Deck | `deck.access` | Area if L×W; level if height | Face sides/height/width/material | Dimensions from brief often |
| Bathroom | `bathroom.access` | Overlapping tile area vs extent vs height | Wet-area board / tile size only if rate keys | Renovation type from brief |
| Commercial components | walls/flooring `access` | Duplicate paint-in-walls vs painting WA | Fire/acoustic later | Counts from brief |
| Retaining | access + carting | Three backfill dims if volume defaulted | Post/sleeper size | Length/height from brief |
| Fence | `fence.access` | Finish type vs required | Post centres | Length/height |
| Pergola | `pergola.access` | Area if L×W | Post count | Area from deck |
| Kitchen | `kitchen.access` (**unused**) | finish vs project quality | Don’t add SKU questions | Scope flags from brief |
| Cladding/Roofing | N/A | N/A | Entire banks | N/A |

Rule applied: if it doesn’t change scope/qty/labour/materials/price/risk/disclosure — cut.

---

## G. Calculator maturity (summary)

| Target | Grade | Pattern |
| --- | --- | --- |
| Deck | **B** package / **C+** takeoff | m² + hardcoded face $ |
| Bathroom | **B** | Trade packages + allowances |
| Commercial components | **B** set / **C** each | `fitout.ts`; sheets `priced:false` |
| Kitchen | **C** | $/m² fallback + lumps |
| Retaining | **C+** | Face m²; `backfill.m3` unused |
| Fence / Pergola | **C** | lm / m² packages |
| Cladding / Roofing / `commercial_fitout` | **D/E** | Absent |

Hardcoded labour fallback **60/90**. Face labour **35/55**. Doors literals. Bathroom/kitchen package minima. `scope.*` `calculatorSupport: "planned"`. `resolveMaterialRate` unused by live calculators.

---

## H–J. Requirements architecture (recommendation)

**Smallest model:** `EstimateRequirement` with kinds `material | labour | plant | subcontract | waste`.

- **MaterialRequirement:** canonical `baseQuantity` + `wasteFactor` + `materialKey`; derived `purchaseQuantity` + `totalCost`. Money via **existing** cost-first resolver — no second engine.  
- **LabourRequirement:** canonical `baseHours`; **one** project productivity factor at rollup (`adjustmentRef`). Never bake access into each task **and** reapply.  
- Persist: derive on generate; optional cache; not editable SoT.

**Do not emit from calculators until DC-01/DC-02 fixed.**

Detail: `docs/architecture/QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md`.

---

## K. Deck pilot readiness

**Not ready for transparent takeoff claim.** Ready as **trial package QE**.

**Face-board Facts required (OD-FACE-01):**

1. Prefer `deck.face_boards.sides` = front/rear/left/right (length vs width).  
2. Optional fallback `deck.face_board_side_count` with `n × perimeter/4` and lower confidence.  
3. `deck.face_board_height_m` (default `deck.height_m`).  
4. `deck.face_board_width_mm` (default board width / 140).  
5. `deck.face_board_material` (default board material).  
6. Keep `deck.vertical_face_board_length_lm` as irregular override.

Qty: `Σ(edge lengths) × height / (width_mm/1000) × (1+waste)`.

Existing: L, W, area, height, level, board width/material, face required, irregular lm. **No** edge selection, **no** distinct face height, **no** member takeoff, **no** labour breakdown.

---

## L. Materials Catalogue V2

**Taxonomy first — do not invent rates.**

Present: decking lm, sheets, backfill m³, flooring m², paint L/m² — **mostly unconsumed for money**. **Zero framing sizes.**

Need keys (empty until Owner/contractor costs): SG8 × treatment × section; deck joist/bearer/post/concrete; bathroom wet linings/waterproofing/tile generic; fitout steel stud/track; retaining posts/sleepers; fence posts/rails/palings; pergola members. **Do not add cladding/roofing keys before those WAs exist.**

Mark `calculatorSupport` honestly (`used_now` on unused keys is misleading).

---

## M. Supplier integration readiness

**Not ready.** Need canonical `materialKey`s, unit conversion, org-supplier account, price timestamp, mapping table. Supplier catalogue **must not** become the domain model.

Unknowns: API access for PlaceMakers / CARTERS / ITM / Mitre 10 / Bunnings; pack vs lm.

First integration: **CSV/manual mapping** after Deck keys are live — not APIs now.

---

## N. Multimodal

| Mode | Today | Recommendation |
| --- | --- | --- |
| **Photos** | **Absent** (logo bucket only). Notes enum `photo_caption` stub. D-S6 / ISD-008 deferred | **First** — storage + RLS then optional vision into Brief/Facts |
| **Voice** | Enum `voice_to_text` stub; no recorder/transcription | **Second** — transcript → existing text path |
| **Video** | Absent | **Later** — cost of storage + frames + audio |

Priority **Photos → Voice → Video** confirmed against architecture (text analysis exists; media does not).

---

## O. Quote send + digital acceptance

Today: statuses draft/sent/accepted/declined/…; **manual** staff actions; **print/PDF**; **money snapshot** on create from pricing; **live logo** (BRANDING-SNAPSHOT-01 **Deferred**); no email, no public token, no `viewed_at`, no signature.

Prerequisites: token authz, expiry, snapshot branding+money, audit log, legal review of e-sign, immutable accepted revision (016 already has revisions).

---

## P. Subcontractor RFQ

**Not built.** Subbie = line category / rate type, manual. No contacts CRM, no RFQ tables, no portal (`KNOWN_LIMITATIONS.md`).

Future: scope from requirements → email token → subbie cost → adopt **cost** → GM sell. Recalibration already cost-first.

---

## Q. Analytics readiness

**Can compute now (crudely):** pipeline counts (Active / Estimating / Quote draft / sent / Won / Lost) from `business_status`; quote timestamps; GM on a **single** estimate/quote document; labour/material/subbie **on a document** via line categories.

**Cannot productise without new events:** turnaround, acceptance %, win/loss **reasons**, quote value rollups, mix over time, viewed-but-not-accepted.

**AN-1 (record early):** `estimate_generated`, `quote_sent`, `quote_viewed` (with public page), `quote_accepted|declined` (person), `project_status_changed` — plus existing `pricing_audit_log`. Do not wait for Analytics UI.

---

## R. Stage 3.2.3+ reconciliation

**3.2.3 original purpose overlaps FOUNDATION-R1.** Starting it first would ship WA access clones.

Merge suppress/remove into R1. Remainder = PT-BI-1 (WA-conditional interview). 3.2.4–3.2.6 remain after cleanup. 3.3 after requirements. DNA last. Production SD after catalogue honesty.

---

## S. Performance (evidence only)

| Path | Class | Evidence |
| --- | --- | --- |
| Analyse project | **P1** | Owner “feels slow”; provider-dominated; deferred to PERF-FUTURE-01 |
| Scope Discovery | **P1 when enabled** | Production off |
| Saving questions | **P2** | Parallel commits shipped; residual refresh |
| Generate Estimate | **P1/P2** | Remount residual; locks shipped |
| Margin update | **P1** | Overlay shipped; `router.refresh` still |
| Dashboard filtering | **P2** | DEMO-R7 deferred RSC remount |
| Pricing / Quote generation | **Insufficient ms** | Do not assign P0 |

**No P0 latency release blocker** documented. Timing tables still empty (Owner samples pending). PERF-FUTURE-01 remains **Planned**.

---

## T–U. Pipeline and first batch

See `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md`.

**Immediate batch: FOUNDATION-R1** (challenged/refined):

1. Project Conditions single-authority (ask + DC-01/DC-02).  
2. Supported Work Area contract (labels / `estimateSupport` honesty; commercial = components).  
3. Requirement **types freeze only** — **no calculator emit**.

**Do not** start MaterialRequirement emit, Deck face Facts, 3.2.3 UI, Production SD, or DNA.

---

## V. Documents

**Created**

- `docs/audits/POST_TRIAL_MASTER_ARCHITECTURE_AUDIT.md` (this file)  
- `docs/audits/PROJECT_CONDITIONS_SINGLE_AUTHORITY_AUDIT.md`  
- `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md`  
- `docs/architecture/QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md`  
- `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md`

**Modified (pointers/status only — no future work marked Complete):** backlog, Stage 3 roadmap, 3.2 plan/handoff, post-3.2.2 commercial plan, production readiness, MVP hardening next-stage line, material takeoff architecture pointer, stale coverage matrix banner.

**Migrations:** none.

---

## W. Verification

Run after pointer edits: `npx tsc --noEmit`; `npm run lint`. No implementation changes to make assertions pass.

---

## X. Owner decisions required

| ID | Decision |
| --- | --- |
| **OD-CAT-01** | Confirm commercial interior = parent + component WAs (recommended **yes**) |
| **OD-CAT-02** | Hide cladding/roofing until greenfield (recommended **yes**) |
| **OD-CAT-03** | Demote blanket “Estimate-ready” on all 14 types (recommended **yes**) |
| **OD-FACE-01** | Face boards: F/R/L/R vs side count (recommended **F/R/L/R primary**) |
| **OD-R1-01** | Authorise FOUNDATION-R1 as refined (PC + catalogue honesty + types-only) |
| **OD-R1-02** | Accept demo/stairs **$ change** when stacking is removed (correctness) |
| **OD-T1-01** | Whether Tier 1 **customer claim** waits for DECK-R1/BATH/FITOUT takeoff or stays “trial B + disclaimer” |
| **OD-PC-01** | Occupied/hours/parking: keep persist-only or design labour consumption later |
| **OD-SNAP-01** | Whether BRANDING-SNAPSHOT-01 ships with QUOTE-1/2 |

**Exact next action:** Owner reads this pack and authorises or amends **FOUNDATION-R1**. **Do not implement FOUNDATION-R1 in this task.**

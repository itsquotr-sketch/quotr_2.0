# Quotr Work Area Factory

**Status:** CANONICAL — WORK-AREA-FACTORY-01  
**Date:** 2026-09-07  
**HEAD:** `4d11ab3c55b94e3bc11ff3845b39a13d88501314`  
**Branch:** `hardening/stage-2a-security`  
**Triage:** [WORK_AREA_EXPANSION_TRIAGE.md](../WORK_AREA_EXPANSION_TRIAGE.md)  
**Bathroom architecture:** [QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md](./QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md)  
**Verifier helper:** `scripts/lib/work-area-maturity-verifier.ts`  
**Runtime:** no calculator, question, Analyse, visibility, DNA, or migration change in this phase.

This is the repeatable build standard for every future Work Area. Deck, Fence, Retaining Wall, and Bathroom are the reference mature systems.

---

## 1. Product exposure labels

Customer UI must not imply maturity where the calculator is generic. Internal grades A–E stay audit-only.

| Label | Meaning | Beta exposure |
| --- | --- | --- |
| **EXPERIMENTAL** | Name exists. No defensible estimate path. | Not shown to beta users |
| **PARTIAL** | Analyse may recognise it. Estimate is package / assumed-quantity fallback. Fallback must be obvious. | May appear in Add Work Area with an honest label. Do not present as equal to Deck. |
| **SUPPORTED** | Reasonable estimate path: facts, high-value questions, calculator-owned quantities, commercial pipeline, explainable review. Some allowances may remain. | Shown. Do not call it Mature. |
| **MATURE** | Factory WA-0…WA-7 + WA-9 closed. Deterministic fixture. Mobile smoke. Isolation. DNA (WA-8) only where useful. | Full product claim |

Runtime `lib/work-areas/support-contract.ts` exposes Deck, Fence, Retaining Wall, and Bathroom as customer **Supported**. Kitchen and Pergola remain Developing. Interior components remain Component.

Company DNA is **not** required for MATURE. It is required only when an independent labour productivity key exists, the estimate consumes it, contractors vary, and a builder-friendly scenario exists.

---

## 2. Factory stages

Map to the conceptual pipeline already locked in estimating coverage: supported scope → canonical facts → physical model → requirements → rate resolution → commercial lines → Builder Review.

| Stage | Name | Owner | Exit |
| --- | --- | --- | --- |
| **WA-0** | Discovery / scope | Product + estimator | In/out jobs, systems, physical authority, minimum input, XOR, shared vs specific |
| **WA-1** | Fact model | `project_facts` | Namespaced keys, units, KNOWN / DERIVED / ASSUMED_DISCLOSED / INFO_REQUIRED |
| **WA-2** | Clarification | Scope templates + Clarify | High-value questions only; Not sure; no re-ask of known facts |
| **WA-3** | Physical calculator | `lib/estimate/calculators/*` | Calculator owns quantities. AI does not. |
| **WA-4** | Requirements | Requirement envelope | Material / labour / plant / subcontract / waste audited. Omissions deliberate. |
| **WA-5** | Rate / commercial | Existing commercial engine | Company → specific benchmark → Pricing Required. No WA-specific pricing architecture. |
| **WA-6** | Conditions + assumptions | Project Conditions sibling | Access, carry, height, occupied, hours, demolition, waste. Not DNA. |
| **WA-7** | Builder Review | Compose + dedicated copy where needed | Builder sees what is being built, quantities, money sources, edit path |
| **WA-8** | Company DNA | Optional | Only when productivity key is real and consumed |
| **WA-9** | Deterministic + hosted close | `scripts/verify-work-area-<slug>-maturity.ts` | Fixture, XOR, isolation, mobile, coexistence |

### Boundary refinements (from current architecture)

1. **Do not add a second Work Area catalogue.** `SCOPE_CATALOGUE` is Authority A. Preferences (`organisation_work_areas.enabled`) never gate Analyse, Add Work Area, or calculators.
2. **ISD catalogue ids are not Work Areas.** Waterproofing, tiling, partitions, fascia, joinery, plumbing-as-scope-item stay recognition / relationship language unless promoted to a product type.
3. **Job Plan / Refine adapters are not optional decoration for MATURE.** Generic Job Plan is a parent-card stub. Refine has no generic adapter. MATURE requires a consumed-fact contract and a Refine adapter whose asked keys are in that contract.
4. **Requirement envelope is the mature path.** Only Deck, Fence, and Retaining Wall emit `requirements` today. Package line items are PARTIAL, not MATURE.
5. **Silent assumed quantities are a commercial defect.** Assumed 5 m² bathroom / 20 m² fitout / 3 doors / 50 m² painting plus a benchmark rate produces a complete-looking price. SUPPORTED+ must not invent a priced quantity without disclosure that blocks false confidence — preferably INFO_REQUIRED or an obvious allowance, not a silent default that still prices.
6. **Nested flags vs sibling Work Areas** must be XOR-documented in WA-0 (deck stairs vs `external_stairs`; `deck.pergola_included` vs `pergola`; kitchen flooring vs `flooring`; internal_walls painting vs `painting`).

---

## 3. WA-0 — Discovery standard

Every new Work Area defines, in writing, before facts:

| Required | Rule |
| --- | --- |
| Belongs here | The jobs this WA estimates |
| Does not belong | Jobs that are another WA, a scope item, or unsupported |
| Systems / subtypes | Explicit XOR families (timber vs steel; vinyl vs timber floor) |
| Physical authority | What geometry the calculator will own (area, lm, count, volume) |
| Minimum viable input | Smallest fact set that can produce a non-assumed quantity |
| High-impact uncertainty | The 3–7 questions worth interrupting a builder for |
| Shared vs specific | Reuse Deck/Fence/Retaining primitives vs new concepts |
| Nested vs sibling | How this WA coexists with mature WAs on the same project |

Do not create a Work Area for a trade that should stay a subcontract allowance inside a parent (plumbing inside Bathroom) unless that trade is itself a product WA.

---

## 4. WA-1 — Fact standard

Canonical facts:

- Live in `project_facts`, not as question-response authority.
- Use explicit units in the key (`_m`, `_m2`, `_lm`, `_m3`, `_mm`, `_ea`) or a documented enum.
- Are namespaced: `{work_area_type}.{concept}`.
- Support KNOWN / DERIVED / ASSUMED_DISCLOSED / INFO_REQUIRED.
- Avoid ambiguous generic keys (`area`, `material`, `access` when Project Conditions already own site access).

Checklist:

- [ ] Every consumed calculator fact is in the Work Area prefix.
- [ ] Derived facts are listed in `DERIVED_FACT_KEYS` (or successor) and not asked.
- [ ] Duplicate Project Condition keys are not asked (`PROJECT_CONDITION_DUPLICATE_FACT_KEYS`).
- [ ] Local exceptions (`deck.access_type`, `ceilings.access`) are listed deliberately.
- [ ] Aliases map to one canonical key (`lib/scopes/fact-keys.ts`).
- [ ] No AI-invented keys outside the alias map.

---

## 5. WA-2 — Clarification standard

Questions:

- High-value only. Do not ask every construction question.
- Progressive. System XOR before member sizes.
- Do not ask what Analyse already knows.
- Always support Not sure → disclosed assumption or INFO_REQUIRED.
- Must be backed by a calculator consumed-fact contract before a Refine adapter is called mature.

Do not ship a Refine adapter that asks facts the calculator ignores.

---

## 6. WA-3 — Physical model standard

Calculators own quantities. AI must not own final quantities.

| Quantity class | Rule |
| --- | --- |
| Continuous | Length, width, height from facts; derived area/volume in calculator |
| Count | Posts, doors, gates, bags — layout or explicit count, never a silent “3” |
| Area | Length × width or stated m²; waste applied once |
| Lineal | Coverage / perimeter / rails; waste once |
| Volume | Excavation, concrete, backfill — geometry, not a lump unless unsupported |
| Waste | Once, from settings, disclosed |
| System XOR | One commercial family. Never package + detailed children |
| Derived assumptions | Disclosed. Not silent priced defaults |
| Unsupported state | INFO_REQUIRED or explicit allowance labelled as allowance — not a confident package |

Package/allowance calculators may exist at PARTIAL. They cannot be MATURE.

---

## 7. WA-4 — Requirement standard

Every mature Work Area audits this union:

| Kind | Required? |
| --- | --- |
| Material | If the builder supplies material |
| Labour | If in-house hours exist |
| Plant | If machine time is material (else N/A, documented) |
| Subcontract | If a trade is bought in (else N/A, documented) |
| Waste / demolition | If strip-out or spoil exists (else N/A, documented) |

Only Deck, Fence, Retaining Wall, and Bathroom currently emit the requirement envelope.

Keys stay namespaced. Shared plant/sheet catalogue keys must be listed in the verifier helper allow-list.

---

## 8. WA-5 — Commercial standard

Preserve the existing hierarchy:

```
company rate
  → specific benchmark
    → disclosed fallback / Pricing Required
```

Cost-first commercial authority remains. No Work Area-specific pricing architecture. Missing trusted rate must not invent $0 and must not revert a detailed quantity to a whole-package price.

---

## 9. WA-6 — Conditions standard

Project Conditions remain sibling to Facts. Canonical keys:

`site_access`, `floor_level`, `material_carry_distance`, `waste_bin_access`, `services_isolated`, `occupied_site`, `working_hours`, `hazardous_materials_risk`, `parking_loading`, `protection_dust_control`, `client_supplied_items`, `by_others_trades`, `consent_engineering`, `site_slope`.

Do not encode unusual job conditions into Company DNA. Applicability is already outdoor / interior / reno / consent sets in `lib/project-conditions/applicability.ts`. Extend that table; do not fork per-WA condition stores.

---

## 10. WA-7 — Builder Review standard

Before MATURE, the builder must see:

- What Quotr thinks is being built
- Physical quantities (not only $)
- Materials, labour, allowances
- Assumptions
- Company vs benchmark source
- Edit path

No raw calculator language (`PACKAGE_FALLBACK`, component keys, rule ids). Generic Job Plan (“the Work Area exists”) is not enough.

---

## 11. WA-8 — Company DNA standard

Create calibration tasks only when:

- An independent labour productivity key exists
- The estimate consumes it
- Contractors meaningfully vary
- A builder-friendly physical scenario exists

Do not make DNA mandatory for Work Area maturity. Do not add DNA for lump allowances.

---

## 12. WA-9 — Close standard

Every mature Work Area requires:

- Deterministic fixture
- Quantity proof
- Rate proof
- Commercial proof
- Multi-system / XOR proof if relevant
- Cross-Work-Area isolation
- Mobile smoke
- Multi-Work-Area coexistence with at least one mature reference WA
- Canonical verifier `scripts/verify-work-area-<slug>-maturity.ts`

---

## 13. Verifier pattern

**Helper (this phase):** `scripts/lib/work-area-maturity-verifier.ts`

Shared:

- Product type list from `SCOPE_CATALOGUE` (no second catalogue)
- Mature reference types: `deck`, `fence`, `retaining_wall`, `bathroom`
- Factory stage checklist (WA-8 optional)
- Namespace isolation (`{type}.` vs foreign prefixes; shared `plant.` / `sheet.` allow-list)

**Per Work Area (future, not implemented here):**

```
scripts/verify-work-area-<slug>-maturity.ts
```

Import the helper. Add WA-specific physical/commercial fixtures. Follow Deck/Fence/Retaining verifier style: code assertions + fixture estimate + Builder Review compose + isolation against a second confirmed WA.

Bathroom phase verifier: `scripts/verify-work-area-bathroom-02.ts` (WA-BATHROOM-02). Canonical close: `scripts/verify-work-area-bathroom-maturity.ts` (WA-BATHROOM-08).

Do not implement all future verifiers in this phase.

---

## 14. Isolation rules

1. Fact, question, requirement, and specific rate keys use `{work_area_type}.` prefix.
2. A calculator must not price another WA’s keys.
3. Nested include-flags on a parent (`internal_walls.painting_included`, `kitchen.flooring_included`, `deck.pergola_included`) are allowances or prompts to add a sibling WA — they must not silently create a second full estimate of the sibling.
4. Overlap groups (`bathroom_tiling`, `kitchen_plumbing`) stay inside one WA.
5. Demolition as a parent flag vs standalone `demolition` WA: strip-out that belongs to a reno stays on the parent unless the brief is standalone demolition.
6. `commercial_fitout` is never a calculator. Commercial interior is composition of component WAs.

---

## 15. Implementation branching

Preferred:

```
one Work Area batch
  → verifier
  → hosted smoke
  → close
  → next
```

Stay on `hardening/stage-2a-security`. Do not maintain three long-lived divergent estimator branches. Do not start Variations, RFQ, RFI, Voice, or Analytics from this factory.

---

## 16. Beta override

Wave ranking is the current technical/product recommendation.

Actual beta demand can override it.

- If 4/5 testers request Bathroom immediately: Bathroom moves up.
- If no testers care about Pergola: it can move down.

**Override exercised 2026-09-07:** owner-approved sequence is **Bathroom → Internal Walls → Ceilings → Doors**. Pergola is not Wave 1. Recorded in the triage file and [QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md](./QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md).

Do not silently skip factory stages to satisfy demand — reduce depth (SUPPORTED hybrid) rather than skip quantity authority.

---

## 17. Related code (authority)

| Concern | Location |
| --- | --- |
| Product catalogue | `lib/scopes/catalogue.ts` (14 types) |
| Stale display bands | `lib/work-areas/support-contract.ts` |
| Analyse allow-list | `lib/scopes/capability.ts` → full catalogue |
| First-run UI list | `lib/setup/first-run-work-areas.ts` (10 of 14) |
| Calculator dispatch | `lib/estimate/calculate-estimate.ts` |
| Consumed-fact contracts | `lib/estimate/consumed-facts.ts` (6 of 14) |
| Job Plan adapters | deck, bathroom, painting, retaining_wall, fence + generic |
| Refine adapters | same five; no generic |
| Company DNA | deck, fence, retaining_wall, bathroom |
| Project Conditions | `lib/project-conditions/*` |
| Quote drafts | `lib/work-areas/quote-description.ts` (all 14) |
| Bathroom architecture (WA-BATHROOM-01) | `docs/architecture/QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md` |

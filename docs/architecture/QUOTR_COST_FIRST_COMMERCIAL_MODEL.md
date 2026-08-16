# Quotr Cost-First Commercial Model

**Status:** Proposed architecture (not implemented) — 2026-08-13  
**Prerequisite audit:** `docs/audits/COMMERCIAL_MARGIN_RATE_AUTHORITY_AUDIT.md`  
**Plan:** `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`

**FOUNDATION-R2-R1 (2026-08-16):** Deck decking money is quantity × unit **cost** (`$/lm` when board width known). Sell still follows COMMERCIAL-P0 (derived GM or legacy paired benchmark). Do not stack lm cost + m² package for the same boards.

**FOUNDATION-R2-R1-R1 (2026-08-16):** Contractor matching-material `$/m²` outranks Quotr `$/lm` after explicit coverage conversion. Converted cost-only rows re-derive sell from company GM. Do not convert a `$/m²` figure as if it were `$/lm`. Do not rewrite persisted company rows.

---

## 1. Product direction

Quotr should be **COST-FIRST** wherever practical.

Contractor enters: **“What does this cost you?”**  
Quotr derives selling values from the selected **gross margin**.

Example:

```
Labour cost = $60/h
Gross margin = 20%
Sell rate = 60 / (1 − 0.20) = $75/h

NOT: 60 × 1.20 = $72/h  (that is 20% markup)
```

Canonical formula (already implemented as F-SFM):

```
sell = cost / (1 − gross_margin)
```

---

## 2. Canonical commercial objects

| Object | Role | Persist? |
| --- | --- | --- |
| **cost_rate** | Canonical commercial **input** (labour $/h, material $/unit, subbie $/unit) | Yes — `rates.cost_rate` |
| **sell_rate** | **Derived** display / optional cache: `cost_rate / (1 − m)` | Prefer **derive at use**; optional persist for UX/speed with provenance |
| **company_default_margin** | Org GM authority | Yes — `organisation_settings.default_margin_percent` |
| **project_target_margin** | Project override GM | Yes — `estimates.target_margin_percent` |
| **recommended_cost** | Sum of line costs (authority for cost) | Yes |
| **recommended_sell** | From cost via project/org GM (single sell authority after cost-first) | Yes |
| **gross_profit** | sell − cost | Derived |
| **markup_percent** | Display only (GP ÷ cost) | Derived; never drives sell |

**Avoid competing authorities:** after cost-first conversion, unit `sell_rate` must not independently drive estimate totals when a margin authority is active.

---

## 3. Target flow

```
Project facts / constraints / scope
  → calculator quantities
  → material + labour + other COST
  → estimate recommended_cost
  → margin authority (project target → else company default)
  → recommended_sell = cost / (1 − gm)
  → range = expected × org budget/premium factors
  → Pricing / Quote consume same sell authority (with GST only on quote)
```

---

## 4. Feasibility vs current schema

| Concern | Feasibility | Notes |
| --- | --- | --- |
| Reinterpret `cost_rate` as canonical cost | **High** | Already intended as cost |
| Reinterpret `sell_rate` as derived | **Medium** | Today contractors may enter charge-out as primary; UX + migration needed |
| Safe silent reinterpret of existing sell rows | **Low** | Existing sells may encode intentional premiums ≠ org GM |
| Migration / backfill | **Likely eventually** | Classify rows: cost-only / both / sell-only; backfill strategy per class |
| Benchmarks | **Medium** | Today paired `{cost,sell}`; cost-first → store/publish **cost** + derive sell at org/project GM, or keep sell as **display hint only** |
| Project-specific rates | **Medium** | Prefer cost overrides; sell derived |
| Materials | **High** | Align with takeoff: qty × cost_rate → cost → margin |
| Subcontractors | **Medium** | Often “what they charge you” already = cost to contractor; sell via GM |
| Quote | **High** | Continue consume pricing sell; ensure margin edit invalidates pricing |
| Existing users | **High risk if silent** | Need Owner decision on adopt vs grandfather |

---

## 5. Persistence recommendation for derived sell

| Option | When |
| --- | --- |
| **A. Derive only (preferred for authority)** | Estimate generation, margin edit, pricing recalibration |
| **B. Persist sell_rate as cache** | Rates UI convenience; must store `sell_source = derived|explicit` provenance |
| **C. Hybrid** | Persist derived sell for UI; regenerate always from cost + margin authority |

**Recommendation:** Hybrid with explicit provenance — **cost + margin authority are SoT**; persisted sell is never independently authoritative for estimate totals.

---

## 6. Margin authority hierarchy (proposed)

1. `estimates.target_margin_percent` if set  
2. Else `organisation_settings.default_margin_percent`  
3. Else app `DEFAULT_MARGIN_PERCENT` (20)

**Remove / retire as sell drivers:**
- Implicit reliance on mismatched charge-out pairs for estimate totals
- `rates.markup_percent` as sell driver (already unused — keep dead or remove later)
- Hardcoded sell literals that bypass cost×margin (e.g. face labour 35/55)

---

## 7. Compatibility strategies (Owner pick)

| Strategy | Description | Risk |
| --- | --- | --- |
| **S1 — Soft cost-first (new orgs)** | New rates cost-primary; derive sell in UI | Low |
| **S2 — Grandfather sell** | Existing orgs keep dual-entry until they opt into cost-first | Medium complexity |
| **S3 — Forced convert** | Backfill: keep cost; recompute sell from org GM; flag explicit premiums | Higher change shock |
| **S4 — Explicit premium field** | Allow `premium_amount` / `override_sell` rare path | Keeps one authority + escape hatch |

**Recommendation:** S1 + S2, with S4 escape hatch for rare contractor premiums. Avoid silent S3 without Owner approval.

---

## 8. Owner decisions (CF-D1–D7)

**OWNER APPROVED** — 2026-08-13 — see `docs/decisions/COMMERCIAL_P0_OWNER_DECISIONS.md`.

| ID | Settlement |
| --- | --- |
| CF-D1 | Cost-first + F-SFM canonical |
| CF-D2 | Grandfather existing pairs (no silent convert in P0) |
| CF-D3 | Hybrid persist + provenance; cost is rate SoT |
| CF-D4 | Margin edit marks Pricing needing recalibration |
| CF-D5 | Benchmark cost long-term; paired legacy in P0 |
| CF-D6 | Explicit override allowed; no large P0 UX |
| CF-D7 | Commercial sequence before 3.2.3 resume |

**COMMERCIAL-P0 Complete Local** — `docs/implementation/COMMERCIAL_P0_AUTHORITY_LOCK_COMPLETION.md`.  
**Cost-first Rates:** Complete Local / Owner Preview Pending — `docs/implementation/COST_FIRST_RATES_COMPLETION.md`.

---

## 9. Remediation vs redesign

| Item | Class | Action |
| --- | --- | --- |
| Engine F-SFM | Correct | Keep |
| Dual charge-out vs GM | Commercial correctness | Cost-first conversion (this model) |
| Margin → Pricing sync gap | Commercial correctness | Small targeted fix when authorised |
| Markup formula paths | Not found | No change |
| Classic double F-SFM stack | Not found at engine | Preserve factories passing both rates until cost-first makes sell optional |

---

## 10. Non-goals

- Company DNA rate mutation
- Automatic calibration → rate apply
- Production Scope Discovery enablement
- PERF-FUTURE-01 latency work (except avoid new per-answer writes)
- Changing F-SFM to markup

# Post–3.2.2 Commercial Authority + Materials Plan

**Status:** Planning / Audit complete — Implementation **Not Started**  
**Date:** 2026-08-13  
**Checkpoint:** After Stage 3.2.2-R5 (demo baseline); **before** Stage 3.2.3  
**Audits:**  
- `docs/audits/COMMERCIAL_MARGIN_RATE_AUTHORITY_AUDIT.md`  
- `docs/audits/MATERIAL_PRICING_TAKEOFF_CURRENT_STATE_AUDIT.md`  
**Architecture:**  
- `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`  
- `docs/architecture/QUOTR_MATERIAL_TAKEOFF_ARCHITECTURE.md`

---

## 1. Why this interrupts the default Stage 3.2.3 assumption

Stage **3.2.3** (Work Area interview UI) remains valuable, but repository evidence shows **commercial dual-authority** (charge-out/benchmark sell vs gross-margin sell) and **materials allowance-first** pricing. Building more interview depth without locking commercial/takeoff authority risks compounding ambiguity into new Facts consumers.

**Recommendation:** treat commercial correctness + cost-first foundation as **P0 after R5 demo freeze**, sequenced **ahead of or interleaved carefully with** 3.2.3 — not silently deferred behind WA interview.

Stage 3.2.3 status remains **Not Started**. This plan does **not** start it.

---

## 2. Finding classes

| Class | Examples | Action |
| --- | --- | --- |
| **DEMO BLOCKER** | Classic stacked F-SFM (charge-out as cost + margin again) | **Not found** at engine |
| **DEMO BLOCKER (conditional)** | Margin edit → Pricing/Quote stale if demo path includes them | Targeted fix when demo needs it |
| **COMMERCIAL CORRECTNESS** | Dual sell authorities; labour 60/90 vs 20% GM; hardcoded face 35/55 | Cost-first remediation |
| **MVP HIGH VALUE** | MaterialRequirement contract; Deck face-edge takeoff; wire priced build-ups | After commercial SoT |
| **MVP POLISH** | Dead markup fields, prefer_user_rates cleanup, dual deriveSell helpers | Backlog hygiene |
| **POST-MVP** | Full catalogue, bathroom SKU takeoff, framing member takeoff | Later |
| **PERFORMANCE** | Residual latency | **PERF-FUTURE-01 Planned** (parallel; not blocker) |

---

## 3. Recommended implementation sequence

### Phase 0 — Demo freeze (current)
- Stage 3.2.2-R5 Owner Demo Preview  
- No broad UI pass unless genuine demo blocker  
- Production SD **Disabled**; DNA **Not Started**; PERF-FUTURE-01 **Planned**

### Phase P0a — Commercial authority remediation (small, if Owner prioritises)
1. Documented Owner decisions CF-D1…D7  
2. Optional targeted: margin edit → `markPricingDocumentsNeedingRecalibration`  
3. Golden / verify: generation + target margin = single F-SFM consume from **cost**; no stacked uplift  
4. **Do not** change F-SFM formula

### Phase P0b — Cost-first rate architecture
1. Rates UX: cost primary; sell derived (gross margin)  
2. Provenance for any persisted sell  
3. Benchmarks: cost-authoritative publication path  
4. Retire reliance on mismatched charge-out for estimate totals  
5. Migration/backfill strategy per Owner CF-D2 (grandfather vs convert)  
6. **Avoid** multiple competing commercial authorities

### Phase M1 — MaterialRequirement / takeoff foundation
1. Calculator emit `MaterialRequirement[]` (contract in takeoff architecture)  
2. Derive takeoff from calculator outputs (cache optional)  
3. Wire `resolveMaterialRate` / priced build-ups on chosen lines  
4. Fallback hierarchy: company → category → benchmark cost → missing

### Phase M2 — Deck takeoff pilot + face boards
1. Edge multi-select F/R/L/R + height/width/material Facts (minimum set)  
2. Derive lm from dimensions; keep irregular lm override  
3. Price face boards via rate keys (no 35/55 literals)  
4. Takeoff + estimate share same qty

### Phase M3 — Catalogue / rate expansion
1. Extend categories (FRAMING sizes, etc.) without rewriting calculator contracts  
2. Add catalogue rows when Owner supplies data  
3. Broader calculator adoption (fitout sheets/paint/flooring)

### Phase 3.2.3+ reconciliation
- Resume / start **Stage 3.2.3** Work Area interview when Owner authorises  
- Ensure new WA Facts write into calculators that already speak MaterialRequirement  
- Assemblies (3.3), Company defaults (3.4), DNA later

---

## 4. Relationship to Stage 3.2.3

| Item | Status |
| --- | --- |
| Stage 3.2.3 | **Not Started** — do not begin in this audit |
| Dependency | WA interview improves Fact capture for takeoff; commercial SoT should land first or in parallel with clear boundaries |
| Safe interleave | 3.2.3 can proceed **if** it does not invent new money paths and consumes existing Fact→calculator contracts |

**Owner decision CF-D7:** commercial-first vs 3.2.3-first vs parallel tracks.

---

## 5. Relationship to PERF-FUTURE-01

- Remains **Planned** (parallel).  
- Commercial/takeoff work must not introduce per-answer AI, full router refresh loops, or redundant estimate fetches.  
- Takeoff derive-on-generate is preferred over chatty remounts.

---

## 6. Relationship to Production SD / Company DNA

| Item | Status |
| --- | --- |
| Production Scope Discovery | **Disabled** — unchanged |
| Company DNA | **Not Started** — takeoff must not become silent DNA rate mutation |

---

## 7. Exact next implementation batch (recommended)

**Batch name (suggested):** `COMMERCIAL-P0 — Cost-first authority lock + margin→pricing sync`

**In scope (when Owner starts implementation):**
- Owner decision capture for CF-D1…D7  
- Cost-first architecture implementation plan → code for rates/estimate sell authority  
- Targeted margin→pricing invalidation if CF-D4 = yes  
- Verifies proving single consume from **cost** under target margin  

**Out of scope for that batch:**
- Stage 3.2.3 UI  
- Material catalogue rows  
- Takeoff UI  
- Deck face-board questions  
- PERF-FUTURE-01  
- Company DNA  
- Production SD enablement  
- Production deploy  

**Immediate next after this audit (no code):** Owner review of audits + CF decisions; continue R5 Owner Demo as scheduled.

---

## 8. Document index

| Doc | Role |
| --- | --- |
| `docs/audits/COMMERCIAL_MARGIN_RATE_AUTHORITY_AUDIT.md` | P0 commercial map + A1–A14 |
| `docs/audits/MATERIAL_PRICING_TAKEOFF_CURRENT_STATE_AUDIT.md` | Materials matrix + Deck fascia gaps |
| `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md` | Proposed cost-first SoT |
| `docs/architecture/QUOTR_MATERIAL_TAKEOFF_ARCHITECTURE.md` | Takeoff contract + Deck pilot |
| This plan | Sequencing + status reconciliation |

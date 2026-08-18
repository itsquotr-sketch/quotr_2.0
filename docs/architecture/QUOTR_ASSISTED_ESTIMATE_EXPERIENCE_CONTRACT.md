# Quotr Assisted Estimate Experience Contract

**Status:** CANONICAL for DECK-2A planning  
**Date:** 2026-08-18  
**Mode:** Product contract only. No production behavior change.  
**Audit:** `docs/audits/DECK_2A_ASSISTED_ESTIMATE_EXPERIENCE_AUDIT.md`  
**Roadmap:** `docs/plans/DECK_2_ASSISTED_ESTIMATE_ROADMAP.md`

---

## 1. Product principle (locked)

Quotr is an **Assistant**.

It should help a builder move from:

`brief -> understanding -> minimal high-value questions -> immediate estimate -> builder review -> edits -> final price -> clean quote`

without forcing a full construction-specification interview up front.

The Assistant may:

- extract what the builder already said
- infer what it safely can
- use company defaults and Quotr benchmarks
- use allowances where appropriate
- disclose assumptions
- estimate with incomplete information

The Assistant must not:

- invent prices
- invent structural engineering facts
- bury uncertainty
- silently mutate company commercial authority

---

## 2. Three estimate levels (locked)

### LEVEL 1 - QUICK ESTIMATE

Purpose:

- qualify the job fast
- produce a useful price or range quickly

Characteristics:

- minimal inputs
- assumptions allowed
- confidence shown
- 1-3 key assumptions surfaced
- attention items only when materially relevant

Question rule:

- ask only `P0` questions before first estimate where possible

### LEVEL 2 - BUILDER REVIEW

Purpose:

- make the builder comfortable with the estimate
- expose the main commercial structure

Must show:

- major materials
- labour
- allowances
- other direct costs
- project conditions
- assumptions
- pricing-required items
- margin/sell

Must be editable.

### LEVEL 3 - FINAL QUOTE

Purpose:

- builder-approved commercial output

Must show:

- grouped scope
- price
- GST
- assumptions
- exclusions
- qualifications

Must not dump internal requirement / benchmark / reconciliation detail.

---

## 3. Assistant questioning contract

Questions are classified:

- `P0` - material price/scope driver
- `P1` - useful refinement
- `P2` - advanced / optional
- `P3` - internal / derivable

### Ask rules

- `P0` can block first estimate only when the estimate would otherwise be misleading.
- `P1` should be asked only if needed or deferred to Builder Review.
- `P2` should not interrupt Quick Estimate.
- `P3` should never be asked if Quotr can derive or internally handle it.

### Deck examples

`P0`

- dimensions / area
- height
- decking material
- board width
- removal yes/no
- project access / carry conditions

`P1`

- fascia
- stairs
- balustrade
- substructure included
- supports/piles arrangement if known
- joist/bearer arrangement if known

`P2`

- treatment / grade / KD
- footing dimensions
- board/joist direction
- detailed structural member spec beyond what is needed for a practical estimate

`P3`

- derived area
- derived decking lm
- internal allowance composition
- margin math

---

## 4. Assume + disclose contract

If information is missing, Quotr should estimate using:

- builder-stated facts
- safe inference
- approved defaults
- benchmarks
- residual allowances
- pricing-required markers where honesty requires them

Quotr must distinguish:

- **Estimating assumption**
- **Structural design / code assertion**

Estimating assumptions are allowed. Structural/code assertions are not.

---

## 5. Material strategy (locked for DECK-2A)

### Detailed by default where practical

- decking boards
- joists
- rim / boundary framing
- bearers
- major support materials when facts are sufficient
- fascia where geometry supports it

### Allowance / hybrid by default where more practical

- screws
- fixings / connectors
- DPC / isolation materials
- adhesives / end-seal
- minor blocking / nogs / trimmers
- consumables
- delivery
- small tools
- site protection
- small waste-handling / incidental direct costs

This is a **commercial completeness** contract, not a microscopic takeoff contract.

---

## 6. Labour strategy (locked for DECK-2A)

Current generic Deck labour remains valid commercial authority for now.

DECK-2A does not start DECK-3 task labour.

Future task labour may become valuable for:

- demolition
- foundations/supports
- manual handling/access-heavy work
- fascia/steps
- cleanup

but only after Quick Estimate and Builder Review UX are improved first.

---

## 7. Project Conditions contract

Project/site logistics remain owned by Project Conditions.

For Deck this includes:

- site access
- carry distance
- waste/bin logistics
- other site-wide productivity factors

Local Deck asks must stay local:

- deck stairs/step-down access
- deck height/level
- local face-board geometry

One project condition may only be commercially consumed once.

---

## 8. Output contract

### Quick Estimate

Should show:

- one summary card
- estimated sell or range
- confidence
- assumptions
- attention items
- CTA to Builder Review

Should not dump detailed line items immediately.

### Builder Review

Should show:

- Overview
- Materials
- Labour
- Other direct costs
- Assumptions / attention
- Pricing required

### Customer Quote

Should show:

- grouped scope summary
- professional assumptions / exclusions / qualifications
- no internal pricing metadata

---

## 9. Attention item contract

Quotr should surface likely conflicts such as:

- elevated deck
- no balustrade requested

The product may:

- warn
- ask
- qualify

The product must not:

- silently add compliance money
- pretend to make a code determination

---

## 10. Evidence classes

### EXEMPLAR-AI-01

Classify as:

- `evidenceType: EXEMPLAR_ESTIMATE`
- `eligibleForRateCalibration: false`
- `eligibleForProductivityCalibration: false`
- `eligibleForQuantityGolden: false`
- `eligibleForArchitectureCalibration: true`

Meaning:

- useful for output-shape and capability-gap analysis
- not trusted cost authority

### REAL-JOB-01

Classify as:

- `evidenceType: REAL_JOB_PARTIAL_COMMERCIAL_EVIDENCE`

Meaning:

- real commercial outcome context
- incomplete internal cost evidence
- must not create benchmarks/rates/productivity from sell alone

---

## 11. Safe replacement strategy

For DECK-2A:

- keep validated foundations
- improve question prioritization
- improve Builder Review structure
- improve assumption and allowance visibility
- improve attention-item handling
- use read-only diagnostics and fixtures

Do not:

- promote structural authority
- change rates
- restamp goldens
- start DECK-3
- create a materials DB
- migrate

---

## 12. UX success criterion

For a brief like `REAL-JOB-01`, within roughly `1-3 minutes` of interaction Quotr should be able to produce:

- a useful estimated price or range
- major material quantities
- labour allowance/hours
- clear assumptions
- material uncertainties
- editable breakdown
- recommended margin/sell
- clean path to quote

without requiring a full construction specification.

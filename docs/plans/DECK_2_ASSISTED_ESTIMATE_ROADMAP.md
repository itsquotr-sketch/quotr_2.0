# DECK-2 Assisted Estimate Roadmap

**Status:** DECK-2 IN PROGRESS / DECK-2A COMPLETE / OWNER PRODUCT VALIDATED / DECK-2B COMPLETE LOCAL / OWNER UX REVIEW PENDING  
**Date:** 2026-08-18  
**Contract:** `docs/architecture/QUOTR_ASSISTED_ESTIMATE_EXPERIENCE_CONTRACT.md`  
**Audit:** `docs/audits/DECK_2A_ASSISTED_ESTIMATE_EXPERIENCE_AUDIT.md`

DECK-2 is treated here as an **assisted estimate experience programme**, not only a face-board calculator task.

---

## 1. Why DECK-2 exists now

DECK-1 established:

- surface quantity/rate authority
- structural shadow quantities
- calibration fixtures and economic-gap diagnostics

DECK-2 should now improve the actual everyday builder experience:

- faster first estimate
- fewer low-value early questions
- clearer assumptions
- better Builder Review structure
- cleaner material vs allowance visibility
- better path from estimate to quote

---

## 2. Status split

| Batch | Purpose | Status |
| --- | --- | --- |
| `DECK-2A` | assisted estimate experience audit, fixtures, contract, roadmap | **COMPLETE / OWNER PRODUCT VALIDATED** |
| `DECK-2B` | assistant question prioritization + Quick Estimate / Builder Review output shaping | **COMPLETE LOCAL / OWNER UX REVIEW PENDING** |
| `DECK-2C` | face/fascia maturity and deck review editing improvements | not started |

No DECK-2 batch authorizes structural promotion by itself.

---

## 3. Ranked product gaps by user value

1. Assistant question prioritization
2. Builder Review hierarchy and explainability
3. Residual allowance visibility
4. Materials review surface
5. Attention/conflict surfacing
6. Demolition / waste / other-direct-cost honesty
7. Editing simplicity
8. Supports/concrete visibility in review
9. P&G / overhead presentation boundary
10. Task-level labour transparency

Ranking basis:

- time saved
- estimate accuracy
- builder confidence
- ease of use
- commercial significance
- implementation risk

---

## 4. Safe replacement map

| Area | Action |
| --- | --- |
| Deck surface authority | **KEEP** |
| Structural calibration infrastructure | **KEEP** |
| Current pricing/quote commercial engine | **KEEP** |
| Early Deck question load | **IMPROVE** |
| Estimate output structure | **IMPROVE** |
| Residual material allowance architecture | **SHADOW REPLACEMENT** first, then promote later if proven |
| Face/fascia experience | **IMPROVE** |
| Structural package retirement | **PROMOTE LATER** |
| Legacy structural package | **RETIRE LATER** only after promotion proof |

---

## 5. Recommended next three implementation batches

### DECK-2B

**Purpose:** make Quick Estimate genuinely fast and assumption-led.

**User-visible improvement:**

- fewer early Deck questions
- better high-value follow-up ordering
- immediate estimate from short briefs with disclosed assumptions

**Architecture touched:**

- Assistant / Scope Details / Project Conditions flow
- question classification
- assumption presentation

**Commercial risk:** low to medium  
**Migration needed:** no  
**Preview gate:** required  
**Dependencies:** DECK-2A Owner review

### DECK-2C

**Purpose:** make Builder Review commercially useful and editable.

**User-visible improvement:**

- clearer Overview / Materials / Labour / Other Costs / Assumptions structure
- residual allowances shown honestly
- better editability before Pricing

**Architecture touched:**

- estimate presentation
- Builder Review surfaces
- materials projection
- allowance/direct-cost grouping

**Commercial risk:** medium  
**Migration needed:** no  
**Preview gate:** required  
**Dependencies:** DECK-2B question strategy locked

### DECK-2D

**Purpose:** mature face/fascia and adjacent Deck review detail without starting DECK-3.

**User-visible improvement:**

- better fascia/face detail in review
- clearer steps/fascia/material handling around the estimate
- stronger Deck-specific breakdown completeness

**Architecture touched:**

- Deck face/fascia model
- review output
- material grouping

**Commercial risk:** medium  
**Migration needed:** no  
**Preview gate:** required  
**Dependencies:** DECK-2C Builder Review structure

---

## 6. What DECK-2 explicitly does not do

- does not promote structural requirements
- does not change rates
- does not restamp goldens
- does not start DECK-3
- does not create a materials DB
- does not migrate
- does not deploy production

---

## 7. UX success test

If a builder enters a brief like `REAL-JOB-01`, Quotr should, within about `1-3 minutes`, be able to produce:

- a useful estimated price or range
- major material quantities
- labour allowance/hours
- assumptions
- clear uncertainties
- editable Builder Review breakdown
- margin/sell recommendation
- clean path to quote

without requiring a full construction specification.

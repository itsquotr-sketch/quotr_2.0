# FOUNDATION-R1 — Owner Preview Test

**Owner:** Quotr product owner  
**Status:** Complete Local / Owner Preview Pending — do **not** mark PASS automatically  
**Branch:** `hardening/stage-2a-security`  
**Stable Preview:** `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`  
**Prereq:** This HEAD deployed Ready on Preview  
**Do not:** start FOUNDATION-R2, emit requirements, start Deck takeoff, deploy Production

**Owner Preview regression (after this runbook was used):** Generate Estimate was available with no visible Project Conditions. Retest using `docs/runbooks/FOUNDATION_R1R1_OWNER_PREVIEW.md`. Do not start FOUNDATION-R2 until R1-R1 Preview PASS.

---

## What changed (for the tester)

Project-wide access, carry, floor, occupancy, hours, parking, hazmat, and services live **only** in **Project Conditions**.

Work Area **Scope Details** should only ask physical/build facts for that area.

Demolition and External Stairs no longer stack the same access condition twice. Estimates with Difficult access + carting should be **lower** than the old stacked path.

Add Work Area badges: **Trial-supported** / **Developing** / **Component** — not blanket Estimate-ready.

---

## A. Deck

Use a known Deck test project (or the usual Deck brief).

| # | Check | Pass? |
| --- | --- | --- |
| A1 | Site access asked only under Project Conditions | |
| A2 | Carry distance asked only under Project Conditions | |
| A3 | Scope Details has Deck-specific questions (size, boards, stairs/access **type**, height, balustrade) — **not** “how difficult is site access” | |
| A4 | Quick Estimate still sensible; labour access not obviously double-counted | |

---

## B. Bathroom

| # | Check | Pass? |
| --- | --- | --- |
| B1 | Bathroom Scope Details does **not** ask general site access | |
| B2 | Project Conditions holds access / carry / occupancy / hours | |
| B3 | Estimate commercial detail describes restricted/difficult access **once** (not an extra Access factor line plus project factor) | |

---

## C. Demolition

Use Difficult/Restricted access **and** a cart distance (e.g. 30 m).

| # | Check | Pass? |
| --- | --- | --- |
| C1 | Access asked once (Project Conditions) | |
| C2 | Cart/haulage is distinct from access difficulty (not a second “poor access” labour multiplier) | |
| C3 | Estimate is lower than the old stacked path would have been (access labour × access qty × access allowance) | |

Numeric local proof (verifier): Difficult + no cart → labour **1.10** once, **9.63 h** on 25 m² (old stacked ~**10.59 h**). Easy + 30 m → **8.75 h** + haulage **$280**. Difficult + 30 m → **9.63 h** + **$280**. Project Easy beats legacy WA Restricted.

---

## D. External stairs

| # | Check | Pass? |
| --- | --- | --- |
| D1 | Project access applied once | |
| D2 | Stair-specific geometry still asked/priced: rise/risers, width, landing, handrail, ground condition | |

Numeric local proof: 8 risers × 1.5 h × project 1.10 × sloping 1.15 = **15.18 h**. Old stacked × WA 1.10 again = **16.70 h**.

---

## E. Commercial interior

| # | Check | Pass? |
| --- | --- | --- |
| E1 | Component WAs remain: demolition, internal walls, ceilings, doors, flooring, painting, plastering | |
| E2 | No fake standalone **commercial_fitout** estimator in Add Work Area | |

---

## F. Add Work Area / capability UI

| # | Check | Pass? |
| --- | --- | --- |
| F1 | No misleading blanket “Estimate-ready” on Work Area types | |
| F2 | Deck/Bathroom read as trial-supported; fence/kitchen as developing; demolition as component — understandable | |
| F3 | Cladding / roofing / commercial_fitout are **not** advertised as estimate-ready product WAs | |

---

## Sign-off

Owner records PASS/FAIL. Do not start FOUNDATION-R2 until authorised.

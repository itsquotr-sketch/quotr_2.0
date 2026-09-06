# Company DNA V2 closeout

Quotr learns how long your crew normally takes on key tasks and uses that productivity in future estimates.

Preview only. Migration **054**. No 055. Production not in scope.

## What shipped

Task-level calibration for Deck, Fence, and Retaining Wall. The builder enters workers + clock time. The server derives person-hours per canonical unit and writes organisation productivity through the existing RPCs.

V2A coverage → V2B foundation → V2B.1 catalogue seed → V2C Deck UX → V2D Fence UX → V2E Retaining UX → V2F hub / Rates / Dashboard close.

## Why

Estimates should feel like the company, not a generic benchmark, without asking builders to type productivity ratios.

## Coverage

**Deck (7 tasks, 3 key):** posts, framing, decking. Optional: concrete bags, fascia, demolition, skirting. Steps stay h/m² and are not a V2 DNA task.

**Fence (9 tasks, 3 key):** posts, rails, palings. Optional: concrete, horizontal slats, sections, capping, gate, demolition.

**Retaining (15 unique tasks, system-aware):**
- Timber key: machine excavation, piles, face
- Sleeper key: machine excavation, posts, sleepers
- Masonry key: machine excavation, block
- Shared once: machine/manual excavation, drainage, backfill; bagged concrete on timber/sleeper

Work Area is calibrated when its V2 rule is met (Deck/Fence 3/3 Tier 1; Retaining any relevant system with all its Tier 1). Optional tasks never block that.

## Productivity math

```
crew × clock hours = person-hours
person-hours / authority quantity = hours per unit
```

Hard valid 0.05×–20× benchmark. Confirm <0.5×, >2×, crew >8, duration >40h. Reset deactivates the active company productivity rate and keeps historical evidence.

## How calibration affects estimates

Organisation productivity rates are resolved in-memory with the rest of the rate set. Changing Deck posts does not change Fence or Retaining. Machine excavation does not change manual excavation. Manual pile/post jobs ignore the machine-assisted company calibration (`ignoreCompanyRate`).

Builder Review labels calibrated labour **Your calibrated productivity** and benchmark labour **Quotr productivity benchmark**. DNA / Rates screens say **Your calibration** / **Quotr benchmark**.

## Permissions

Owner / Admin / Estimator calibrate. Viewer read-only. Commercial $/h rates stay Owner/Admin (SECURITY-053).

## Deferred (not blocking)

- DNA-V2-EST-1: calibratable manual pile/post key
- Deck steps unit split
- Spoil cartage is money, not crew DNA
- Plant hire is not DNA
- Material movement via Project Conditions
- Cleanup not modelled
- Masonry rebar may stay package labour without an allowance rate

## Future Work Areas

Shared V2 primitives live in `lib/company-dna/v2-ui.ts`. Adding a Work Area means a landing route, foundation keys, and wiring into `COMPANY_DNA_V2_UI_WORK_AREAS`. Do not assume only three areas forever. Do not build the next area in this closeout.

## Migrations

Preview through **054**. No 055.

## Verifiers

`verify-dna-v2a-coverage` … `verify-dna-v2f-close`, `verify-company-dna-01`, `verify-company-dna-02`.

## Stale-verifier register

| Check | Classification | Action |
| --- | --- | --- |
| Foundation R1 / requirement-contract / Stage 3.2.2 “Company DNA not started” | STALE | Updated to assert DNA V2 exists. Original freeze was pre-DNA. |
| Deck 2D “YES + missing bag rate → Pricing Required” | STALE | POLISH-03 priced the 20 kg bag from the owner-approved Quotr catalogue ($9.80). Missing company bag rate is now a benchmark line, same as labour’s Quotr starter. Assertion updated; product unchanged. |
| Nested Fence 1A / RW 1D / family-coverage Deck 2D spawns | STALE | They failed only because of the bag-rate assertion above. |
| RW 1F / 2A “mobile content contract” banned `warning` | STALE | Builder Review uses StatusPill `tone="warning"` for physical-allowance disclosure (POLISH). Overflow contract remains `overflow-x-hidden` + `break-words`. |
| Stage 3.2.2-R3 checks 4/5/8/9/11/15 (Project Setup collapse, mobile QE, Prepare final pricing) | STALE | Superseded by later demo UX / POLISH. Not DNA-era product defects. Left on the historical R3 contract; R4/R5/polish verifiers are canonical. |
| V1 “2 high-impact = complete” in DNA-01/02 | STILL VALID for historical V1 helper | Not used on V2 hub/Rates/Dashboard surfaces. |

## Hosted proof

Plus-address fixtures only. Do not rotate `jeanluc@erccontracting.co.nz` or `hello@erccontracting.co.nz`. Canonical host: `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`.

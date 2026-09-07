# Bathroom maturity closeout

**Status:** BATHROOM MATURE — FINAL GO  
**Date:** 2026-09-08  
**Branch:** `hardening/stage-2a-security`  
**Preview:** `shhpjsoldmqtkdbgrbtm`, migrations through **056** (055 reserved for QDISP-SQL-055)  
**Hosted commercial proof:** `aebd962`  
**Hosted DNA persistence:** canonical Preview alias, normal UI Save. Wall lining 7.8 h → 15.6 h; ceiling 2.9 h unchanged; cost $19,221 → $19,687; sell $24,497 → $25,196; labour $1,885 → $2,351; materials/subcontract unchanged. Reset returns 7.8 h / $19,221. Screenshots: `.tmp-wa-bathroom-08b/shots/`.  
**Canonical verifier:** `scripts/verify-work-area-bathroom-maturity.ts` (`--live` 118/0)  
**Phase regressions:** `verify-work-area-bathroom-02` … `07` remain.  
**Production:** DO NOT TOUCH. **No migration 055.** Preview applied **056** Bathroom DNA catalogue seed (data-only). No GRANT/RLS change.

Customer UI shows **Bathroom** as **Supported**, same band as Deck, Fence, and Retaining Wall. Builders never see V2, WA-08, or maturity level 9.

---

## Final scope

Bathroom owns nested wet-area renovation: geometry, substrates, linings, local framing, floor XOR, tiling, waterproofing, fixtures/PCs, plumbing and electrical hybrid allowances, demolition, waste, nested stopping/painting.

Does not own: Internal Walls, Ceilings, Doors, Variations, RFQ, Voice, Analytics.

## DNA tasks

| Tier | Task | Key | Reference |
| --- | --- | --- | --- |
| 1 | Wall lining | `bathroom.lining.wall.install.hours_per_m2` | 20 m² |
| 1 | Ceiling lining | `bathroom.lining.ceiling.install.hours_per_m2` | 8 m² |
| 1 | Local framing / nogging | `bathroom.framing.install.hours_per_lm` | 12 lm |
| 2 | Floor substrate | `bathroom.floor_substrate.install.hours_per_m2` | 8 m² |
| 2 | Floor finish removal | `bathroom.demolition.floor_finish.hours_per_m2` | 8 m² |
| 2 | Wall lining removal | `bathroom.demolition.wall_lining.hours_per_m2` | 20 m² |

**Not calibrated:** plumbing $, electrical $, tiler $, WP $, paint $, stopping $, PC sums, waste, fixture install hours (too small/noisy).

Status: 0/3 Not calibrated → 1–2/3 Partly calibrated → 3/3 Using your calibration. Secondary never blocks. No Dashboard nag after Tier 1 complete.

Resolver is canonical V2 (`resolveCompanyDnaTask`). Absent DNA uses Quotr productivity benchmarks — never Pricing Required.

**Catalogue ownership:** `productivity_calibration_catalogue` is system-owned (SELECT-only for authenticated/service_role). Company values live in `productivity_calibration_responses` + `rates` (`source = calibrated_productivity`). `save_productivity_calibration` **SELECT**s the catalogue then writes org evidence/rates. It never INSERTs catalogue rows.

**Seed:** `supabase/migrations/056_bathroom_company_dna_catalogue_seed.sql` — six Bathroom tasks, `INSERT … ON CONFLICT DO NOTHING`. Applied Preview only (37 catalogue rows: Deck 7, Fence 9, RW 15, Bathroom 6). Production not applied. 055 remains reserved for QDISP-SQL-055 (same skip as missing 037). Runtime Save does not INSERT catalogue rows.

**Runtime save authority:** UI → `saveCompanyDnaCalibration` → RPC `save_productivity_calibration` (SELECT catalogue by `calibration_task_key`, INSERT evidence, UPSERT org `rates`). Reset deactivates the company rate and retains evidence.

## Rate hierarchy

Company exact → Quotr specific benchmark → Pricing Required / explicit PC or trade allowance. Cost-first commercial engine owns sell. Company trade lumps **replace** Quotr hybrid totals.

## Shared materials

One identity, many Work Area requirements:

| Key | Reuse |
| --- | --- |
| `sheet.plasterboard.aqualine.each` | READY FOR REUSE (Internal Walls / wet Ceilings) |
| `timber.framing.90x45.h1.2.lm` | READY FOR REUSE (H1.2 wet-area; not Deck H3.2) |
| `sheet.plywood.19mm.h3.2.each` | READY FOR REUSE |
| `sheet.fibre_cement.18mm.2400x1200.each` | READY FOR REUSE |
| `bathroom.*.hours_per_*` | BATHROOM-SPECIFIC |

## Known limitations (nonblocking)

- Door/window wall-area deductions not modelled (disclosed).
- Waste is allowance-based, not density-based.
- Sibling XOR waits until Internal Walls / Ceilings / Painting / Plastering / Demolition / Flooring mature.
- RFQ not implemented. Subcontract allowances are not returned quotes.
- Specialist proprietary systems may be Pricing Required.
- First-run cards still have no maturity badge (Add Work Area does).
- Bathroom DNA catalogue is in **056** (not 054). 055 remains reserved.

## Legacy

Historical Bathrooms without `bathroom.job_scope` retain LEGACY ONLY package path. Do not reinterpret snapshots.

## Future overlap

Bathroom owns nested Bathroom work. Future mature siblings must honour the overlap contract (no double-price of the same selected lining, paint, plaster, or strip-out).

## Next programme

**WA-INTERNAL-WALLS-01 — DOMAIN ARCHITECTURE + CURRENT-STATE GAP AUDIT.** Do not start it from this close.

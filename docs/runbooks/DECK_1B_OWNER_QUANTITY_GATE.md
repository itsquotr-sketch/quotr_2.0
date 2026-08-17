# DECK-1B Owner Quantity Gate

**Status:** OWNER QUANTITY REVIEW REQUIRED  
**Date:** 2026-08-18

---

## Purpose

Owner approval of **shadow structural MaterialRequirement quantities** before DECK-1C rate infrastructure or DECK-1R commercial promotion.

This gate does **not** authorise authority promotion or estimate money changes.

---

## Artifacts

| Document | Content |
| --- | --- |
| `docs/implementation/DECK_1B_STRUCTURAL_MATERIAL_REQUIREMENTS_COMPLETION.md` | Local completion summary |
| `docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md` | Canonical model (Owner R1 validated) |
| `scripts/verify-deck-1b-structural-material-requirements.ts` | 59-check verifier |

---

## Review checklist

- [ ] DECK-REF-01 physical outputs accepted (joists/rim/bearers/supports/concrete)
- [ ] Orientation defaults correct (boards ∥ length, joists ∥ width, bearers ∥ length)
- [ ] Rim topology correct (end-only, no 2L+2W double count)
- [ ] Joist count formula `ceil(span/centres)+1` accepted
- [ ] Support count = bearer rows × supports per bearer (no corner dedup)
- [ ] Partial maturity behaviour acceptable
- [ ] `priced=false` without rates acceptable until DECK-1C
- [ ] Legacy substructure money unchanged
- [ ] Deck 1 golden unchanged
- [ ] No blocking/fixings structural emission (deferred)

---

## On approval

| Item | Status |
| --- | --- |
| DECK-1B | COMPLETE / OWNER QUANTITY APPROVED |
| DECK-1C | READY TO START |

---

## Explicit non-actions

- No structural authority promotion
- No legacy package retirement
- No Production deploy

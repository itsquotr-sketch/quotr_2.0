# CAT-IDENTITY-01 — Canonical Material Identity Foundation

**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**Verify local:** `npx tsx scripts/verify-cat-identity-01.ts` (74/0)  
**Verify remote Preview:** `npx tsx scripts/verify-cat-identity-01-remote-preview.ts`

Shared material identity normalization and conservative comparison for partial, known, and custom specifications. Material identity is separate from rate unit and component identity. Deck structural requirements retain physical quantities when treatment is unknown.

No prices. No materials table. No migration 037. Structural children remain SHADOW.

---

## What landed

| Item | Detail |
| --- | --- |
| Module | `lib/materials/identity.ts` |
| Requirement field | optional `materialIdentity` on `MaterialRequirement` |
| Deck emission gate | section required for timber identity; treatment optional |
| Debug key | `family.productFamily.section[.species][.grade][.treatment\|custom.slug]` |
| LVL | `productFamily = structural_lvl`, not species |
| Rate eligibility | `compareMaterialIdentities()` is not a rate grant |

## Locked rules

- Known commercially relevant attributes participate in identity. Unknown attributes are omitted, never invented (no default SG8).
- Treatment states: **KNOWN** / **UNKNOWN** / **CUSTOM**. Custom is not unknown and not a known class.
- Custom strings do not fuzzy-match H3.2/H4 or each other.
- Identity comparison ≠ rate eligibility.
- `originalDescription` is display/audit; structured fields drive normal exact match. Un-normalizable custom fields stay conservative.
- Section normalization: `140x45` / `140 x 45` / `140×45` / `45x140` / `140 x 45 mm` → `140x45`. `200x50` remains valid. No whitelist.

## DECK-REF-01 (treatment unknown)

| Child | Purchase | Identity | priced |
| --- | ---: | --- | --- |
| `deck.joists` | 42.32 lm | 140x45, treatment unknown | false |
| `deck.rim_framing` | 10.92 lm | same as joists | false |
| Combined stock | **53.24 lm** | exact identity + lm | n/a (components stay separate) |
| `deck.bearers` | 10.92 lm | 190x45, treatment unknown | false |
| `deck.supports` | 8 EA | partial EA identity | false |
| `deck.concrete` | 0.324 m³ | family `concrete`, mix unknown | false |

Missing joist section: no fabricated timber MaterialRequirement.

## Commercial safety

- `deck.substructure` remains legacy money authority
- Structural children SHADOW
- `decking.surface` REQUIREMENT_AUTHORITATIVE
- `deck.labour` SHADOW
- Deck 1 / Fence 2 / Pergola 1 / RW 2 goldens unchanged

## Next

DECK-1C-B1 research **handoff / evidence** for Owner review. Do not attach prices until Owner accepts sourced identities.

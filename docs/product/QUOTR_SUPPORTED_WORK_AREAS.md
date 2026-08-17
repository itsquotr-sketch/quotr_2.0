# Quotr Supported Work Areas

**Status:** CANONICAL — product view of recognition vs estimating support  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Code contract:** `docs/architecture/QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md` + `lib/work-areas/support-contract.ts`  
**Historical inventory:** `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md`  
**Owner:** OD-CAT-01, OD-CAT-02, OD-CAT-03, OD-T1-01

Recognition ≠ estimating support. Do not imply that because Quotr can classify a Work Area, it can produce a commercially defensible estimate.

Customer UI never shows internal grades A–E. Never blanket “Estimate-ready”.

---

## 1. Two concepts

### Recognition

Can Quotr understand / classify the Work Area from brief, notes, ISD, or user add?

Uses: canonical Work Area, aliases, semantic synonyms, confidence, **unsupported-but-recognised** classification.

AI must not create infinite new Work Area labels.

### Estimating support

Can Quotr produce a commercially defensible estimate for that type?

Uses: Scope contract, Project Condition consumption, calculator, rates, requirements, goldens, Owner Preview, support-band promotion.

---

## 2. Maturity model

### Customer-facing bands (current code)

| Band | Label | Types |
| --- | --- | --- |
| `trial_supported` | Trial-supported | `deck`, `bathroom` |
| `developing` | Developing | `retaining_wall`, `fence`, `pergola`, `kitchen` |
| `component` | Component | `demolition`, `external_stairs`, `internal_walls`, `ceilings`, `doors`, `flooring`, `painting`, `plastering` |
| `unsupported` | Not supported yet | cladding, roofing, windows, landscaping, earthworks, services-as-WAs, other/custom, `commercial_fitout` as a WA |

OD-T1-01: do **not** claim customer “Supported” until scope + questions + conditions + calculator + labour/material verification are defensible. Deck/Bathroom remain **Trial-supported**.

### Target depth (programme, not current claim)

| Target tier | Intent | Types |
| --- | --- | --- |
| **TIER 1 / DEEP** | Reference-quality quantity + labour + transparency | Deck; Bathroom; Commercial Interior **composition** |

**Deck estimating maturity (2026-08-18):** Surface (`decking.surface`) is requirement-authoritative with physical lm takeoff. Structure remains a legacy **m² package** (`deck.substructure.m2`). DECK-1A defines the physical structural model contract; member-level takeoff is **not implemented**. See `docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md`.
| **TIER 2** | Commercially useful QE via requirements | Retaining Wall, Fence, Pergola, Kitchen |
| **TIER 3 / FUTURE GREENFIELD** | New product WAs | Cladding, Roofing |

Other recognised labels (waterproofing, tiling, partitions as ISD catalogue ids) may exist **without** deep estimating support.

Internal audit grades (coverage audit): **no Work Area is A today**. Trial Deck / Bathroom / Fitout ≈ **B**.

### Target model classes (estimator depth — not customer bands)

| Class | Meaning | Likely (not permanently assigned) |
| --- | --- | --- |
| **A. DEEP QUANTITY** | Materials + task labour become primary authority | Deck, Retaining, Fence, Pergola, selected commercial components; future cladding/roofing where practical |
| **B. HYBRID** | Requirements where useful; allowances/subcontracts where more commercial | Bathroom, Kitchen, Commercial Interior composition |
| **C. PACKAGE / ALLOWANCE** | Package estimating may remain intentional | Where extra detail does not create enough value |

Architecture must support all three. Programme “Tier 1 deep” is a **support-claim** sequence; these classes are **how deep the calculator should go**. Bathroom can be Tier-1 supported as a **hybrid** model.

---

## 3. Product catalogue (14)

Creatable / estimate-dispatched types (`lib/scopes/catalogue.ts`):

`deck`, `retaining_wall`, `bathroom`, `kitchen`, `fence`, `pergola`, `external_stairs`, `demolition`, `internal_walls`, `ceilings`, `doors`, `flooring`, `painting`, `plastering`

Unknown type → `"No calculator available"`. **No generic calculator.**

Setup work-type preferences may hide a type from a company; they do not change maturity.

Project-list copy “Estimate ready” (an estimate **exists**) is unrelated to Work Area capability.

---

## 4. Commercial Interior

Commercial Interior is a **project / use-case concept**. It is **not** one monolithic calculator.

| Type | Role |
| --- | --- |
| `commercial_fitout` | ISD / job-class parent only. **Not** in `SCOPE_CATALOGUE`. **No** calculator. |
| demolition, internal_walls, ceilings, doors, flooring, painting, plastering | Component WAs that compose a commercial interior estimate |

Project Conditions apply **once** at project level.  
Each component owns its physical Scope Details and calculator.

Do not create or promote a monolithic `commercial_fitout` calculator (OD-CAT-01).

Later potential components (not product WAs today): joinery, carpentry, services. Those may be recognised as ISD catalogue ids (`joinery`, `plumbing`, `electrical`) without estimating support.

---

## 5. Recognition taxonomy

### Strategy

```
partition · partition wall · GIB partition · stud wall · internal wall
  → product WA internal_walls
  → ISD catalogue id partitions (relationship pack)

timber deck · deck replacement · outdoor deck
  → deck
```

Recognition should use:

- canonical Work Area (product type when estimatable);
- documented aliases;
- semantic synonyms;
- confidence;
- unsupported-but-recognised classification (do not auto-create a WA).

### What already exists

| Layer | Location | Behaviour |
| --- | --- | --- |
| Product WAs | `lib/scopes/catalogue.ts` | 14 types |
| Question aliases | `lib/scopes/registry.ts` `QUESTION_TEMPLATE_TYPE_ALIASES` | `partitions→internal_walls`, `linings\|wall_linings→plastering`, `strip_out\|soft_strip→demolition` |
| ISD canonical ids | `lib/scope-discovery/catalogue/normalisation.ts` `CANONICAL_SCOPE_IDS` | Finer than product WAs (waterproofing, tiling, fascia, …) |
| ISD aliases | `SCOPE_ALIASES` | `fitout\|commercial_fit_out→commercial_fitout`; `internal_walls→partitions`; `plastering→linings`; face_boards→fascia; etc. |
| ISD high-level set | `HIGH_LEVEL_WORK_AREA_TYPES` | 14 **plus** `commercial_fitout` |
| ISD relationship packs | Deck, Bathroom, Commercial-fitout only | |

### Future consolidation (not this lock)

There are **two** id spaces:

1. **Product Work Area type** — what is created and calculated.
2. **ISD catalogue id** — relationship/missing-scope graph, sometimes finer (fascia, waterproofing).

That split is useful (components of a deck are not all WAs). It is also a confusion risk (`internal_walls` vs `partitions`).

Future work should:

- keep product types as the estimating identity;
- treat ISD ids as recognition/relationship aliases onto a product WA **or** an explicit unsupported class;
- forbid AI from emitting labels outside the documented alias map (unknown → `null`, do not invent);
- add cladding/roofing as **unsupported-recognised** until greenfield WAs exist (OD-CAT-02).

**ISD-MAP-01 (future CI, not REQ-1):** every recognised ISD id should map to a canonical product Work Area **or** an explicit unsupported/non-estimating classification. Do not merge id spaces now.

Do not rename stored `work_areas.type` without a migration plan.

---

## 6. Cladding / Roofing

Recognised in ISD language only. **Not** estimate-ready. **Cannot** be created as product WAs today.

Do not pretend painting “Exterior cladding” is cladding.  
Do not add catalogue keys until the WA exists.

---

## 7. Promotion rule

A type moves toward customer “Supported” only after the calculator maturity framework (recognition → goldens → Owner Preview → support promotion) in `QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`.

Trial success is not promotion.

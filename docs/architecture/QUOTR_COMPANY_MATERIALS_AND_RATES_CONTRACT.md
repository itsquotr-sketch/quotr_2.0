# Quotr Company Materials and Rates Contract

**Status:** CANONICAL product contract — DECK-1C-A **OWNER VALIDATED**  
**Date:** 2026-08-18  
**HEAD:** `46b186202f727998c8578c3a14039ba9f9ba645c`  
**Mode:** Planning lock. Owner validated. No prices. No migration. Common lists are UX convenience, not a capability whitelist.  
**Owner gate:** `docs/runbooks/DECK_1C_A_OWNER_IDENTITY_GATE.md`  
**Deck identity:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md`  
**Domain parent:** `docs/architecture/QUOTR_MATERIAL_DOMAIN_ARCHITECTURE.md`

This document locks how Quotr represents **materials** and **rates** across three scopes. It does not seed a catalogue and does not assign dollars.

---

## 0. Core principle

> **Known physical material does not require a known Quotr price.**

If exact pricing is unavailable:

- retain quantity + specification
- mark **pricing required**
- do **not** fabricate a price
- do **not** fall through to an unrelated package (e.g. `deck.substructure.m2`)

Custom materials are first-class. They are not an error state.

**Quotr Common / CORE / OPTIONAL lists are UX convenience only.** They are not a capability whitelist. A well-formed custom section (`200x50`, `240x45 LVL`) is valid even when absent from Quotr Common.

---

## 1. Material ≠ rate

| Concept | Answers | Example |
| --- | --- | --- |
| **Material** | What is the physical product/specification? | 200×50 H3.2 structural timber |
| **Rate** | What does this organisation/project/source pay for it, in a unit? | $18.75 / lm company cost |

A company material **may exist with no known rate**.

A rate **must** attach to a sufficiently precise material identity **and** a unit.

Sell remains cost-first: company **cost** is authority; sell is derived from company GM unless an explicit sell override exists (existing COMMERCIAL-P0 / cost-first contract). Do not store grossed-up sell as hidden duplicate authority.

---

## 2. Three material scopes

Scope is **ownership**, not a redundant enum if `org_id` / `project_id` already establish it.

| Scope | Owner | Visibility | Editable? | Rate capability | Global impact? | Save path | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Quotr Common** | Quotr | All organisations | Quotr staff only | Optional Quotr benchmark (later) | Yes — curated only | Quotr catalogue process | 140×45 H3.2 structural timber |
| **Company** | Organisation | That org only | Org owner/admin | Optional company cost; not required to save | No | Settings, or explicit “save for future” from Pricing | 200×50 H3.2 custom pine |
| **Project custom** | Project (within org) | That project | Builder on that job | Optional project override rate | No | Scope Details custom spec + Pricing unit cost | “200×50 rough sawn H3.2 custom pine” on this deck |

Hard rule: a contractor-created custom material **never** automatically enters the Quotr global catalogue.

Company materials **need not** have a global parent. A company-only product is valid.

---

## 3. Product workflow (locked)

1. Quotr calculates physical component quantity (e.g. `deck.joists` 42.32 lm).
2. Quotr proposes a common specification when one exists (e.g. 140×45 H3.2 framing timber).
3. Builder may: accept it, pick another Quotr common, pick a Company material, or enter Custom.
4. Quotr attempts **exact** rate resolution only.
5. If exact rate exists → use it. If not → pricing required. Quantity + spec remain.
6. At Pricing the builder may enter a unit cost.
7. Quotr may offer: **Save this material and rate to Company Materials & Rates for future jobs?**
8. Yes → normalize, reuse or create company material, then create/update rate **only with explicit action**.
9. No → retain as project-only material/rate.
10. Do **not** silently mutate company or global catalogues.

---

## 4. Rate authority hierarchy (unchanged)

From `QUOTR_MATERIAL_DOMAIN_ARCHITECTURE.md`:

1. Project override
2. Company exact cost (exact identity + unit)
3. Supplier / account-specific cost (future)
4. Company compatible converted (explicit conversion only)
5. Company calibrated / historical (future, not silent)
6. Quotr exact benchmark (same identity + unit)
7. Quotr package fallback (documented same-material package only)
8. Pricing required

**Identity usefulness ≠ rate authority.** A Quotr common material may normalize a product without its benchmark outranking company or project cost.

---

## 5. Project rate ≠ company rate

A job may use 200×50 H3.2 at **$20.40/lm** while Company Rates hold **$18.75/lm**.

Required actions (never silent):

- **Use $20.40 on this project only** → `rateSource = project_override`
- **Update company rate to $20.40 for future projects** → explicit company rate write; current historical snapshots stay immutable

Saving a company rate from a live job **does not** restamp the current generation. Current project changes only through normal regeneration.

---

## 6. Save-for-future state machine

```
PROJECT CUSTOM MATERIAL
        ↓
PROJECT RATE ENTERED (optional)
        ↓
USER CHOOSES SAVE?
      /        \
    NO          YES
    ↓            ↓
PROJECT ONLY   NORMALIZE identity
               ↓
          COMPANY MATCH on exact identity?
            /      \
          YES      NO
           ↓        ↓
       REUSE      CREATE COMPANY MATERIAL
           \        /
             ↓
        RATE EXISTS for that identity+unit?
          /       \
        YES       NO
        ↓          ↓
 OFFER UPDATE    CREATE COMPANY RATE
 OR PROJECT ONLY
```

No silent mutation. No duplicate company material for format variants of the same identity (`200 x 50` vs `200x50`). If identity is **ambiguous**, do not merge — keep project custom and ask.

---

## 7. Duplicate policy

### Materials

Normalize first (section, treatment tokens). Then:

| Result | Action |
| --- | --- |
| Exact identity exists | Reuse. Do not create another row because display string differs. |
| No match | Create company or project material. |
| Ambiguous (unstructured description, unparseable) | Do not silent-merge. Keep original description. |

### Rates

`public.rates` today is unique on `(org_id, rate_type, item_key)`. Future exact company rates must remain **one active exact rate per material identity + unit**.

If a company exact rate already exists and the user enters a different price: offer **project only** or **update company rate**. Do not insert a second active exact rate.

Historical generations keep prior rate evidence in the **snapshot**, not via live catalogue join.

---

## 8. Rate matching (conservative)

Do **not** fuzzy-price.

| Requirement | Candidate | Result |
| --- | --- | --- |
| 140×45 H3.2 SG8 lm | same exact | **EXACT** |
| 140×45 H3.2, grade unknown | SG8 H3.2 140×45 lm | **NOT COMPATIBLE** unless a documented compatibility rule later allows unknown-grade → known-grade (none now) |
| 140×45 H3.2 | H4 140×45 | **NOT COMPATIBLE** |
| 140×45 | 190×45 | **NOT COMPATIBLE** |
| 140×45 lm | same material m² | **COMPATIBLE** only with explicit conversion (Deck **surface** board-width rule). Structural timber has **no** approved m²→lm conversion. |
| structural timber lm | generic “framing lm” | **NOT COMPATIBLE** |
| any structural child | `deck.substructure.m2` | **NOT COMPATIBLE** (separate commercial package) |
| project $20.40/lm entered | company $18.75/lm | **PROJECT OVERRIDE** when user chooses project-only |

Text normalization (`140 x 45` → `140x45`, `45x140` → `140x45`) is **not** commercial compatibility.

---

## 9. Editing locations

| Surface | Role |
| --- | --- |
| **Assistant / Scope Details** | Physical specification. Custom allowed. No price entry required. |
| **Pricing** | Commercial decisions: unit cost, project override, save-for-future, supplier-equivalent substitution. |
| **Settings → Company Materials & Rates** | Manage reusable company materials and costs directly. Material may be saved with **no** rate. |

Physical changes in Pricing must be offered as **update Scope Details / regenerate**, not silently diverge from the snapshot. Commercial substitutions (same identity, different cost or equivalent SKU mapping) may stay project-only without rewriting facts.

---

## 10. Snapshot evidence

The estimate requirement snapshot must be able to explain history **without** a live catalogue join:

- componentKey + quantity + unit
- material identity (parsed fields + original description)
- material scope (from ownership at generation time)
- rate, unit, rateSource
- priced true/false

`project_override` already exists on `RequirementRateSource`. Snapshot immutability is unchanged (REQ-SNAPSHOT-01 / REQ-TXN-01).

---

## 11. Company DNA boundary

Manual save-for-future is **explicit user-authorised company data**. It is not silent Company DNA.

Future DNA may observe → calculate → recommend → user approves → company authority. Not in DECK-1C.

---

## 12. Proposed data model (no migration in DECK-1C-A)

### Reuse

| Existing | Keep |
| --- | --- |
| `public.rates` | Company **cost** authority (cost-first). Unique per org + rate_type + item_key today. |
| TypeScript Quotr catalogue (`lib/rates/*catalogue*`) | Curated common **rate catalogue** until a materials table exists. |
| `MaterialRequirement.materialKey` + `specification` | Snapshot identity evidence. |
| `RequirementRateSource` including `project_override` | Project commercial overlay. |
| `pricing_items.unit_cost` | Pricing document overlay (existing). |

### Gap

There is **no materials table**. Company “materials” today are only rate rows. A material without a rate cannot be represented cleanly. Project custom identity lives only in facts + requirement `specification`.

### Smallest future schema (after Owner approval)

One `materials` table, scope by ownership — **not** three catalogues:

| Columns (indicative) | Rule |
| --- | --- |
| `id` | Stable UUID |
| `org_id` | NULL = Quotr common; SET = org-owned |
| `project_id` | NULL = reusable (Quotr or company); SET = project custom (requires `org_id`) |
| identity fields | family, product_family, section, grade, treatment, species, unit_hint, original_description, identity_hash |
| `source_material_id` | Optional FK to Quotr/company parent when a company material aliases a common row |

Check: `(org_id IS NULL AND project_id IS NULL) OR (org_id IS NOT NULL)`.

Rates later attach by `material_id + unit` (or generated debug `item_key`). Do not require a rate to insert a material.

Quotr common rows are **Quotr-maintained only**. Contractors cannot insert `org_id IS NULL`.

Until that table exists, **do not** hack “material without rate” as a `rates` row with `$0`. `$0` is not pricing-required.

---

## 13. Canonical rate identity

Do **not** freeze `timber.sg8.140x45.h3_2.lm` as the canonical material identity.

Locked direction (CAT-IDENTITY-01):

- **Material identity** is structured columns (and a generated stable identity hash).
- **Rate** is material identity **plus unit** plus cost/provenance.
- A human-debuggable `item_key` may be **generated** for Rates UI / `public.rates` compatibility, e.g. `timber.structural.140x45.h3_2.lm` — but grade/treatment/unit omitted when unknown, and **never** invent `sg8` to obtain a key.
- Supplier SKU is a later mapping, not the key.

Current DECK-1B helper `timber.sg8.{section}.{treatment}.{unit}` embeds assumed grade **SG8** and unit into identity. CAT-IDENTITY-01 / DECK-1C-A-R1 must correct this after the DECK-1C-A docs commit. It is **not** a physical quantity defect.

---

## 14. Future UI contracts (not built here)

### Assistant / Scope Details

Simple builder-first picker per physical spec (joist size, bearer size, support product):

- Common (short curated list)
- Your company (always visible, not “Advanced”)
- Custom… (free description; parse what we can; keep original text)

Avoid a 14-question wall. Keep DECK-1B optional/gated facts.

### Pricing

```
Material: 200×50 H3.2
Quantity: 42.32 lm
No rate found.
Unit cost: [ $________ /lm ]
[ ] Save material + rate to Company Materials & Rates
```

If company rate exists and project differs:

```
Company: $18.75/lm
This project: $20.40/lm
( ) Use project rate only
( ) Update company rate
```

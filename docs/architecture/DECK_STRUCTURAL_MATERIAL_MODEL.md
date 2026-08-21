# DECK Structural Material Model — Physical Calculation Contract

**Status:** CANONICAL for DECK-1 / DECK-1A  
**Date:** 2026-08-18  
**Mode:** DECK-1A **COMPLETE / OWNER MODEL VALIDATED**. DECK-1B **COMPLETE / TECHNICALLY VALIDATED**. Identity/rate contract: `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md` (DECK-1C-A). Physical quantities in this file remain frozen for supplied-spec jobs (DECK-REF-01).

**DECK-MATURITY-2A addendum:** When new substructure is included and rectangular L×W exist but bearer/support layout facts are both omitted, the calculator applies disclosed estimating layout defaults (1.8 m bearer spacing along the joist run; 1.8 m supports along each bearer — **UNSOURCED estimating default**, not a compliance rule). Explicit facts still win. Joist/rim quantities no longer require timber identity to emit as unpriced planning takeoff. Concrete still requires footing dimensions. No commercial promotion.

**DECK-MATURITY-2A-R1:** Geometric `length_m`/`width_m` are storage axes (often first-written × second-written). They do **not** automatically set joist direction. When orientation facts are absent, joists span the shorter practical rectangle axis; bearers run perpendicular. Explicit `deck.joist_direction` or `deck.board_direction` still override. DECK-REF-01 (5.20 × 3.10) already has the shorter axis as width, so frozen 1B quantities are unchanged. See coverage §7A.

---

## 0. Domain rule — DECK-STRUCT-01

> **Quotr's Deck structural calculator quantifies a supplied or assumed structural specification. It does not certify structural adequacy.**

Where member sizes, spacing, or support design depend on engineering or formal span rules and are **not supplied**, Quotr must either:

1. **Ask** the builder;
2. Use an **explicit estimating assumption** (disclosed, recorded in assumptions);
3. Use an **approved sourced rule** in a future structural-rule module; or
4. Remain on **legacy/package fallback** (`deck.substructure.m2`).

**No silent compliance claim.** Consent/engineering flags may generate attention items but must **not** silently change member sizing in DECK-1 unless a deterministic approved rule exists.

---

## 1. Product principle

| Quotr MAY | Quotr MUST NOT |
| --- | --- |
| Calculate physical quantities from known geometry + builder/company specification | Choose member sizes because they are "structurally adequate" |
| Apply documented estimating defaults with disclosed assumptions | Embed unsupported NZS/span-table compliance |
| Emit shadow MaterialRequirements for transparency | Change commercial money in DECK-1A |

**Example — allowed:** "Given 140×45 joists at 450 mm centres over this 4.0 m × 4.03 m deck, calculate joist count and lm."

**Example — not allowed:** "Choose 140×45 at 450 centres because it passes span rules for every deck."

---

## 2. DECK-1 scope

### In scope (DECK-1)

| Component | Rationale |
| --- | --- |
| A. Joists | Primary framing grid |
| B. Rim / boundary framing | Structural perimeter members |
| C. Blocking / nogs | Where specification supplied or company default |
| D. Bearers | Support grid above posts |
| E. Posts / piles | Ground supports |
| F. Footings / concrete | Volume when dimensions known |
| G. Structural + surface fixings | Controlled quantities or allowances |
| Surface refinements | Only where needed to connect orientation model |

### Out of scope

| Item | Owner |
| --- | --- |
| Fascia / face boards | DECK-2 |
| Task-level labour split | DECK-3 |
| Stairs detailed model | Later |
| Balustrade detailed model | Later |
| Structural engineering / design | Never in calculator |
| Supplier procurement / stock-length optimisation | Later |
| Materials UI | DECK-5+ |
| Production rollout | Separate gate |

**Challenge against current calculator:** Today items A–G are **bundled** in `deck.substructure.m2` + `deck.fixings.m2`. DECK-1 decomposes the package; it does not add parallel money until authority promotion.

---

## 3. Supported geometry class

### Recommendation: **A — simple rectangular only** (DECK-1 MVP)

| Class | Support | Outcome |
| --- | --- | --- |
| **Rectangular** — known `length_m` + `width_m` | **FULL** deep structural model when specification complete | Emit shadow requirements |
| **Composite rectangles** | **DEFER** | Legacy fallback |
| **Area-only / irregular** | **FALLBACK** | Legacy `deck.substructure.m2` remains money authority |

**Boundary rule:** Requires known `length_m` + `width_m`. **Partial child emission:** each component checks its own prerequisites (dependency-based, not all-or-nothing). Area-only / irregular → no deep structural requirements; legacy `deck.substructure.m2` remains money authority.

---

## 4. Orientation model

### Semantic axes (do not conflate with labels)

| Axis | Source | Meaning |
| --- | --- | --- |
| `deckLength` | `deck.length_m` (user) | Longer or primary plan dimension — **not inherently joist run** |
| `deckWidth` | `deck.width_m` (user) | Perpendicular plan dimension |
| `deckingBoardDirection` | **PROPOSED** `deck.board_direction` | Axis decking boards run parallel to |
| `joistDirection` | **PROPOSED** `deck.joist_direction` | Axis joists run parallel to |
| `bearerDirection` | **DERIVED** or **PROPOSED** | Axis bearer lines run parallel to |

### Owner-validated default orientation (DECK-1A-R1)

**Default relationship when user does not specify:**

1. Decking boards run **parallel to deck length** (`deckLength`).
2. Joists run **perpendicular to decking boards** → **parallel to deck width** (`deckWidth`).
3. Bearers run **perpendicular to joists** → **parallel to deck length** (`deckLength`).

**Physical relationship (DECK-1A storage convention):** boards ∥ stored length; joists ∥ stored width; bearers ∥ stored length.

**DECK-MATURITY-2A-R1 — do not treat stored length as joist direction.** `deck.length_m` / `deck.width_m` are geometric storage (often first-written × second-written). When `deck.board_direction` and `deck.joist_direction` are both unknown, planning joists span the **shorter** rectangle axis; bearers run perpendicular. Explicit joist or board direction still overrides. Near-square tie (`|L−W| ≤ 0.05 m`) keeps the historical joists-along-width default so tiny differences do not flip layout. Board direction is aesthetic unless the builder sets it. This is an estimating planning rule, not a compliance claim.

DECK-REF-01 (5.20 × 3.10) already has the shorter axis as width, so frozen 1B quantities are unchanged under the 2A-R1 rule.

User-confirmed `deck.board_direction` / `deck.joist_direction` always override defaults. Defaults recorded as structured assumptions.

**Correction:** bearers are **not** parallel to joists — they are **perpendicular** to joists.

### Minimum facts for orientation

| Fact | Required for deep model? |
| --- | --- |
| `deck.length_m` + `deck.width_m` | Yes |
| `deck.joist_direction` OR accept default | Yes |
| `deck.board_direction` | Optional if default chain accepted |

---

## 5. Material model table (Owner-review artifact)

| componentKey | Description | Physical qty | Unit | Required inputs | Derived inputs | Waste | Material identity | Rate identity | Fallback | Confidence | Legacy target | Initial authority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `deck.joists` | Primary joist members | joistCount × joistRunLength | lm | L, W, joist direction, joist centres, joist section (treatment optional) | joistRunLength, perpendicularSpan, joistCount | framing waste % | timber / structural framing / {section} / {treatment?} / {grade?} — component not in identity; **do not assume SG8** | CAT-IDENTITY-01 `serializeMaterialIdentityKey` + unit on rate row only | legacy `deck.substructure.m2` | HIGH if all spec user-known; MED if spacing default | **Framing/substructure** (portion) | **SHADOW** |
| `deck.rim_framing` | Additional end rim (not full perimeter) | 2 × end dimension ⊥ joists | lm | L, W, joist direction, joist section, treatment | Outer parallel joists already in joistCount | framing waste % | **same stock identity as joists** when spec identical | same as joists | legacy package | HIGH/MED | bundled | **SHADOW** |
| `deck.blocking` | **DEFERRED** | — | — | — | — | — | Reserved | — | legacy | — | bundled | **NOT EMITTED in DECK-1B** |
| `deck.bearers` | Bearer lines | bearerRowCount × bearerRunLength | lm | bearer row count, bearer section, treatment | bearerRunLength ∥ bearerDirection (⊥ joists) | framing waste % | generic structural timber (same family as joists) | same identity model; different section | legacy package | MED/HIGH | bundled | **SHADOW** |
| `deck.supports` | Posts / piles | supportCount | ea (MVP) | bearer rows, supports per bearer, support section | bearerRowCount × supportsPerBearer | none | post/pile **EA product** (not framing lm) | EA exact rate or pricing required — never `$/lm` on EA | legacy package | MED/HIGH | bundled | **SHADOW** |
| `deck.concrete` | Footing concrete | supportCount × volumeEach | m³ | footing L×W×D (mm facts); support count | volumeEach | **0%** initial | family **concrete** (do not freeze `concrete.footing` as universal identity); mix optional | pricing required if mix unknown unless Owner later approves generic $/m³ | omit if dims missing | MED | bundled | **SHADOW** |
| `deck.fixings.structural` | Structural connectors | **NOT EMITTED in DECK-1B** | — | — | — | — | Reserved | — | legacy `deck.fixings.m2` | — | fixings m² | **DEFER** |
| `deck.fixings.surface` | Decking screws/nails | per board row OR m² allowance | ea / allow | board count, intersections | — | none | fixings / decking | defer or allowance | keep legacy fixings m² | MED | fixings m² | **defer DECK-1** |

**Note:** `decking.surface` remains REQUIREMENT_AUTHORITATIVE — unchanged by DECK-1.

---

## 6. Input contract table (proposed — not implemented)

| Fact / input key | Meaning | Type | Current | Req/opt | Authority | Default allowed? | Fallback if missing | Scope Details |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `deck.length_m` | Plan length | number m | **A exists** | Required | USER_CONFIRMED | No | area-only → legacy | ✓ |
| `deck.width_m` | Plan width | number m | **A exists** | Required | USER_CONFIRMED | No | area-only → legacy | ✓ |
| `deck.area_m2` | Area | number m² | **A + derived** | Required | DERIVED / USER | No | default 20 m² (assumption) | ✓ |
| `deck.height_m` | Finished deck height | number m | **A exists** | Required | USER_CONFIRMED | No | — | ✓ |
| `deck.joist_direction` | Axis joists parallel to | select: `length` \| `width` | **E missing** | Required for deep model | USER_CONFIRMED | **Yes** — perpendicular-to-boards default | legacy substructure | **PROPOSED** |
| `deck.board_direction` | Axis boards parallel to | select: `length` \| `width` | **E missing** | Optional if default chain | USER_CONFIRMED / QUOTR_DEFAULT | Yes — parallel to length | — | **PROPOSED** |
| `deck.joist_section` | Joist size e.g. 140×45 | select / text | **E missing** | Required for deep model | USER_CONFIRMED / COMPANY_PREFERENCE | **Yes** — company/benchmark default | legacy substructure | **PROPOSED** |
| `deck.joist_centres_mm` | Joist spacing | number mm | **E missing** (stub in scope-impact) | Required for deep model | USER_CONFIRMED / COMPANY_PREFERENCE | **Yes** — e.g. 450 mm disclosed default | legacy substructure | **PROPOSED** |
| `deck.bearer_section` | Bearer size | select | **E missing** | Required | USER / COMPANY | Yes — default paired to joist | legacy | **PROPOSED** |
| `deck.bearer_row_count` | Number of bearer lines | number | **E missing** | Opt if spacing known | USER_CONFIRMED | Yes — derived from geometry + spacing default | legacy | **PROPOSED** |
| `deck.bearer_centres_m` | Bearer spacing | number m | **E missing** | Opt alt to row count | USER / COMPANY | Yes — disclosed default | legacy | **PROPOSED** |
| `deck.support_type` | Post / pile / bearer-on-footing | select | **E missing** | Required for supports | USER / COMPANY | Yes — post default | skip supports → allowance | **PROPOSED** |
| `deck.support_section` | Post/pile size | select | **E missing** | Required | USER / COMPANY | Yes | legacy | **PROPOSED** |
| `deck.support_spacing_m` | Centres along bearer | number m | **E missing** | Required | USER / COMPANY | Yes — e.g. 1.8 m default | legacy | **PROPOSED** |
| `deck.footing_length_m` | Footing length | number m | **E missing** | Opt | USER / COMPANY | Yes — disclosed Quotr default | concrete omitted or pricing-required | **PROPOSED** |
| `deck.footing_width_m` | Footing width | number m | **E missing** | Opt | USER / COMPANY | Yes | same | **PROPOSED** |
| `deck.footing_depth_m` | Footing depth | number m | **E missing** | Opt | USER / COMPANY | Yes | same | **PROPOSED** |
| `deck.blocking_rows` | Blocking row count | number | **E missing** | Optional | USER / COMPANY | Yes — 0 or company default | omit blocking | **PROPOSED** |
| `deck.framing_treatment` | H3.2 / H4 etc. | select | **E missing** | Required for rate identity | USER / COMPANY | Yes — H3.2 default (disclosed) | legacy | **PROPOSED** |
| `deck.substructure_included` | New framing in scope | boolean | **A exists** | — | USER | default true | exclude all structural reqs | ✓ |
| `deck.engineering_or_consent_status` | Consent needed | select | **A exists** | — | USER | — | assumption flag only | ✓ |

**Project Conditions (unchanged):** `site_access`, `material_carry_distance`, `consent_engineering` — never hold structural member sizes.

---

## 7. Formula contract (conceptual — not coded)

### 7.1 Joists

**Inputs:** `deckLength`, `deckWidth`, `joistDirection`, `joistCentresMm`, `joistSection`

```
perpendicularSpan = dimension perpendicular to joistDirection
joistRunLength    = dimension parallel to joistDirection

joistSpaces = ceil(perpendicularSpan / (joistCentresMm / 1000))
joistCount  = joistSpaces + 1          // both boundaries — verify Owner framing convention

primaryJoistBaseLm = joistCount × joistRunLength
joistPurchaseLm    = primaryJoistBaseLm × (1 + framingWastePercent/100)
```

**Rounding:** round lm to 2 dp at purchase quantity (consistent with surface).

**Edge conditions:**
- Double joists at openings — **non-MVP**; document as future
- Trimmers — **non-MVP**

**Known limitation:** rectangular only; no L-shaped cut optimisation.

### 7.2 Rim / boundary framing (Owner R1)

Outer parallel joists are **already included** in `joistCount`. Additional rim members run on the **ends perpendicular to joists** only:

```
rimEndSpan = dimension parallel to perpendicular(joistDirection)
rimBaseLm  = 2 × rimEndSpan
```

Example: joists ∥ width on 5.20 × 3.10 m deck → `rimBaseLm = 2 × 5.20 = 10.40 lm`.

Do **not** use full perimeter `2L + 2W` (would double-count outer joists).

### 7.3 Bearers

Bearers run **perpendicular to joists** (Owner R1 correction).

```
bearerDirection = perpendicular(joistDirection)
bearerRunLength = dimension parallel to bearerDirection
bearerBaseLm    = bearerRowCount × bearerRunLength
```

No structural bearer-spacing inference. If `bearerRowCount` absent → bearer requirement unavailable.

### 7.4 Supports (posts/piles)

**MVP: EA quantity**

```
supportCount = bearerRowCount × supportsPerBearer
```

No corner deduction in parallel-bearer layout. No height→post LM conversion.

### 7.5 Concrete

```
volumeEach_m3 = (footingLengthMm / 1000) × (footingWidthMm / 1000) × (footingDepthMm / 1000)
concreteBase_m3 = supportCount × volumeEach_m3
```

**0% additional waste** initially. Omit requirement if any footing dimension missing (does not block other children).

### 7.6 Blocking

**Simplest defensible MVP:**

```
if blockingRows > 0:
  pieceLength = joistCentres - joistMemberWidth   // or full perpendicular span between rims — Owner confirm
  blockingBaseLm = blockingRows × joistCount × pieceLength
else:
  omit deck.blocking requirement
```

Alternative: **company m² allowance** folded into fixings — defer if blocking specification too uncertain.

### 7.7 Fixings

| Group | DECK-1 recommendation |
| --- | --- |
| Decking fixings | **Defer** — keep legacy `deck.fixings.m2` |
| Structural fixings | **Per-m² allowance** initially (`deck.fixings.structural.m2`) OR coarse EA from grid — Owner decision |

---

## 8. Waste contract

| Material | Current | DECK-1 proposal |
| --- | --- | --- |
| Decking surface | 10% (`deckingWastagePercent`) | Unchanged |
| Joists / rim / bearers / blocking | **Not applied** (m² package) | `timber_framing_wastage_percent` org setting OR documented default (e.g. 5%) |
| Posts | — | **0%** (EA count) |
| Concrete | — | Small factor (e.g. 5%) or 0% — Owner confirm |
| Fixings allowance | — | N/A (allowance) |

Waste applies **once** at purchase quantity. No stacking with legacy package.

---

## 9. Requirement IDs (examples — not implemented)

Pattern: `{workAreaId}:{kind}:{componentKey}:{variant}`

| Component | Example ID |
| --- | --- |
| Joists | `d1:material:deck.joists:140x45-h3.2` |
| Bearers | `d1:material:deck.bearers:190x45-h3.2` |
| Supports | `d1:material:deck.supports:90x90-h5` |
| Concrete | `d1:material:deck.concrete:standard-footing` |

Variant encodes section + treatment where rate identity changes.

---

## 10. MaterialRequirement field contract (per component)

| Field | Joists | Bearers | Supports | Concrete |
| --- | --- | --- | --- | --- |
| `baseQuantity` | primaryJoistBaseLm | bearerBaseLm | supportCount | concreteBase_m3 |
| `baseUnit` | lm | lm | ea | m³ |
| `wasteFactor` | framing % | framing % | 0 | concrete % |
| `purchaseQuantity` | joistPurchaseLm | bearerPurchaseLm | supportCount | concretePurchase_m3 |
| `purchaseUnit` | lm | lm | ea | m³ |
| `priced` | true when rate resolves | same | same | same |
| `rateProvenance` | per frozen hierarchy | same | same | same |
| `assumptions[]` | spacing default, direction default | layout default | spacing default | footing size default |
| `confidence` | HIGH / MEDIUM / LOW | same | same | same |

---

## 11. Rate resolution hierarchy (unchanged architecture)

1. Project override  
2. Company exact cost  
3. Supplier (future)  
4. Company compatible conversion  
5. Calibrated/historical (future)  
6. Quotr exact benchmark  
7. Quotr package fallback  
8. Pricing required  

**Company exact outranks Quotr.** DECK-1B emits shadow quantities **unpriced** when no exact company rate exists. Do **not** seed `timber.sg8.*` as canonical identity. CAT-IDENTITY-01 is the live identity layer. DECK-1C-B may add sourced benchmarks **after** Owner reviews B1 evidence. See `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md`.

---

## 12. Geometry fallback contract

| Condition | Structural requirements | Money authority |
| --- | --- | --- |
| L + W known + full spec | Emit shadow MaterialRequirements | Legacy `deck.substructure.m2` until promotion |
| Area only | **Do not emit** joist/bearer/support reqs | Legacy package |
| Irregular / composite shape | **Do not emit** | Legacy package |
| Spec incomplete (spacing unknown, no default permitted) | **Do not emit** | Legacy package |

Policy may register REQUIREMENT_AUTHORITATIVE later; generation uses LEGACY_FALLBACK until physical model complete (REQ-4B pattern).

---

## 13. Component migration plan

| Phase | State | Money |
| --- | --- | --- |
| DECK-1B emit | Child reqs **SHADOW** | Legacy `deck.substructure.m2` |
| Parity review | Shadow reconciliation vs package | Legacy still authoritative |
| DECK-1R promotion | Selected components → REQUIREMENT_AUTHORITATIVE | Requirement lines |
| Stable | Legacy package → LEGACY_FALLBACK → retire | Child aggregate replaces package |

**Parity class:** Decomposition of one package into many components = **INTENTIONAL_MODEL_IMPROVEMENT**. Compare **aggregate** structural cost/sell to legacy package — not fake per-line parity.

### Legacy package decomposition

```
LEGACY: deck.substructure.m2 (single line, no componentKey today)

SHADOW CHILDREN (DECK-1B):
  deck.joists
  deck.rim_framing
  deck.blocking        (optional)
  deck.bearers
  deck.supports
  deck.concrete
  deck.fixings.structural (allowance)

RECONCILIATION: sum(shadow child costs) ↔ legacy package cost
```

**No double count:** one-source rule per componentKey; legacy package excluded when children promoted.

---

## 14. Group authority recommendation

**Recommendation: Option B — parent commercial group with child shadow requirements (initially).**

| Approach | Verdict |
| --- | --- |
| A. Each child becomes independent commercial component immediately | Too granular for Pricing/customer lines early; promotion overhead |
| **B. Parent `deck.substructure` remains commercial group; children shadow until aggregate parity** | **Preferred** — matches current customer-facing "Framing/substructure" line |
| C. New parent authority system | Rejected — use existing component authority registry |

**Implementation path (future, not DECK-1A):**
1. Register `deck.substructure` with group aggregation metadata.
2. Emit child MaterialRequirements as SHADOW.
3. Reconciliation compares Σ children ↔ legacy package.
4. On promotion: parent line derives from children (requirement-authoritative group) OR children promote individually — Owner decision at DECK-1R.

**Pricing granularity:** Customer may still see one "Framing/substructure" line; DECK-5 Materials UI shows child breakdown.

---

## 15. Confidence semantics

| Level | Meaning |
| --- | --- |
| **HIGH** | All geometry + structural specification user-confirmed |
| **MEDIUM** | One or more disclosed Quotr/company estimating defaults |
| **LOW** | Significant assumptions; near fallback territory |

No percentage confidence. No materiality rollup in DECK-1.

---

## 16. Structured assumptions (examples)

| Key | When populated |
| --- | --- |
| `deck.joists.spacing_default` | joist centres not user-confirmed |
| `deck.joists.direction_default` | joist direction inferred from board default |
| `deck.bearers.layout_default` | bearer row count from default |
| `deck.supports.spacing_default` | support spacing default |
| `deck.footing.size_default` | footing dimensions default |
| `deck.blocking.rows_default` | blocking rows default |

Source classification: `calculator_default`, `company_preference`, `benchmark`, `user_confirmed` per existing assumption contract.

---

## 17. Engineering / consent handling

| Fact | DECK-1 behaviour |
| --- | --- |
| `deck.engineering_or_consent_status` | Estimate assumption / exclusion text; **no silent sizing change** |
| `consent_engineering` (project) | Risk topic; no sizing change |
| `deck.height_m` > 1 m + balustrade | Existing gates unchanged |
| Height for post length | **Do not derive** without embedment + structural depth facts |

---

## 18. Fixture matrix (inputs only — outputs TBD after formula review)

| ID | Description | Geometry | Elevation | Spec completeness |
| --- | --- | --- | --- | --- |
| **SIMPLE-01** | Low rectangular deck | 4.0 × 4.03 m (= 16.12 m²) | 0.4 m | Full spec (TBD values) |
| **SIMPLE-02** | Ground deck | 5 × 4 m | 0.2 m | Full spec |
| **MEDIUM-01** | Elevated regular | 7 × 5 m | 0.8 m | Full spec, more bearer rows |
| **COMPLEX-01** | Larger deck | 10 × 7 m | 1.2 m | Full spec |
| **EDGE-01** | Area only | 16.12 m², no L/W | any | **Must fallback** |
| **GOLDEN-01** | Current commercial Deck 1 | 70 m² area-only | 0.8 m | Legacy package — **sell $48,340 unchanged** |

---

## 19. Reference fixture DECK-REF-01 (Owner R1 — synthetic test fixture)

**Not a universal product structural recommendation.**

| Input | Value |
| --- | ---: |
| `deck.length_m` | 5.20 |
| `deck.width_m` | 3.10 |
| Area | 16.12 m² |
| Boards | parallel length, 140 mm, 10% waste |
| Joists | parallel width, 450 mm centres, 140×45, fixture treatment |
| Bearers | parallel length, 2 rows, 190×45 |
| Supports | 4 per bearer × 2 rows = 8 EA |
| Footings | 300 × 300 × 450 mm each, 0% concrete waste |

**Expected physical outputs (DECK-1B verifier):**

| Component | Base | Purchase |
| --- | ---: | ---: |
| Joists | 40.30 lm | 42.32 lm |
| Rim (additional ends) | 10.40 lm | 10.92 lm |
| Bearers | 10.40 lm | 10.92 lm |
| Supports | 8 | 8 EA |
| Concrete | 0.324 m³ | 0.324 m³ |

---

## 20. Calculation order (dependency graph)

```
Deck geometry (L, W, area validation)
        ↓
Framing orientation (board → joist → bearer axes)
        ↓
Joist grid (count, run length, primary lm)
        ↓
Rim / boundary framing
        ↓
Bearer layout (rows, run length)
        ↓
Support grid (count, dedup corners)
        ↓
Blocking (if specified)
        ↓
Footings / concrete volume
        ↓
Fixings (allowance)
        ↓
Waste per material class
        ↓
MaterialRequirements (SHADOW)
        ↓
Rate resolution
        ↓
Shadow reconciliation vs legacy deck.substructure.m2
```

No circular dependencies. Surface (`decking.surface`) calculates independently.

---

## 21. Future Company DNA hooks (not implemented)

| Preference | Future use |
| --- | --- |
| Standard joist centres | Default spacing |
| Standard timber sections | Joist/bearer/post defaults |
| Framing treatment | H3.2/H4 default |
| Bearer layout pattern | Row count / spacing |
| Support type + spacing | Post/pile defaults |
| Footing dimensions | Concrete default |
| Framing waste % | Already in org settings |
| Fixing allowances | Structural fixings m² |

---

## 22. Open Owner decisions

See `docs/runbooks/DECK_1A_OWNER_MODEL_GATE.md`.

---

## 23. Related documents

| Document | Purpose |
| --- | --- |
| `docs/audits/DECK_1A_CURRENT_STATE_AND_INPUT_AUDIT.md` | As-is audit |
| `docs/plans/DECK_1_IMPLEMENTATION_PLAN.md` | DECK-1B+ sequence |
| `docs/runbooks/DECK_1A_OWNER_MODEL_GATE.md` | Owner sign-off gate |
| `docs/architecture/QUOTR_MATERIAL_DOMAIN_ARCHITECTURE.md` | Material domain + rate hierarchy |
| `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md` | DECK-1C-A identity lock |
| `docs/architecture/QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md` | Three-scope materials/rates |
| `docs/architecture/QUOTR_COMPONENT_COMMERCIAL_AUTHORITY_CONTRACT.md` | Authority lifecycle |

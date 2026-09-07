# Quotr Bathroom Estimating Architecture

**Status:** CANONICAL — WA-BATHROOM-01 architecture + **WA-BATHROOM-02 implemented (scope + geometry)** + **WA-BATHROOM-03 implemented (physical substrates / linings / framing)**  
**Date:** 2026-09-07  
**Branch:** `hardening/stage-2a-security`  
**Preview:** Supabase `shhpjsoldmqtkdbgrbtm`, migrations through **054**  
**Production:** DO NOT TOUCH (through 045)  
**Migrations:** NONE. No 055.  
**Factory:** [QUOTR_WORK_AREA_FACTORY.md](./QUOTR_WORK_AREA_FACTORY.md)  
**Triage:** [WORK_AREA_EXPANSION_TRIAGE.md](../WORK_AREA_EXPANSION_TRIAGE.md)
**Verifier:** `scripts/verify-work-area-bathroom-02.ts`, `scripts/verify-work-area-bathroom-02c.ts`, `scripts/verify-work-area-bathroom-03.ts`

Bathroom remains a **SUPPORTED hybrid**. Do not mark Mature. UI capability band is unchanged (`trial_supported`).

**Target maturity:** honest **SUPPORTED hybrid** first (physical carpentry + transparent specialist allowances). **MATURE** only after WA-BATHROOM-03…08 close. Do not claim Deck-depth on day one.

---

## 0. Verdict

| Gate | Result |
| --- | --- |
| WA-BATHROOM-01 architecture / gap audit | **GO** |
| WA-BATHROOM-02 scope + geometry | **GO** |
| WA-BATHROOM-03 physical substrates / linings / framing | **GO** |
| Implement tiling/WP/plumbing/fixture money in 02 | **NO-GO** (deferred to 04–07) |
| Start Internal Walls / Ceilings / Doors | **NO-GO** |
| Variations / RFQ / Company DNA behaviour | **NO-GO** |
| Production / migration 055 | **NO-GO** |

**Next action:** [WA-BATHROOM-04](#54-wa-bathroom-03-physical-substrates--linings--framing) — floor finish XOR (tile / sheet vinyl / vinyl plank), distinct from floor substrate. Do not start until this 03 close is reviewed.

---

## 1. Current Bathroom architecture

Bathroom is a **PARTIAL / FALLBACK hybrid package estimator**, not a physical Work Area.

| Layer | Current state |
| --- | --- |
| Catalogue | `bathroom` in `SCOPE_CATALOGUE` — “Bathroom renovation”, `estimateSupport: "calculator"` |
| UI band (stale) | `trial_supported` — same band as Deck (`lib/work-areas/support-contract.ts`) |
| First-run | Shown, no badge — appears equal to Deck / Fence / RW |
| Factory label | **PARTIAL** (triage level **5**) |
| Calculator | `lib/estimate/calculators/bathroom.ts` — priced **line items**, no `requirements` envelope |
| Questions | 20 templates in `lib/scopes/templates/bathroom.ts` |
| Consumed-fact contract | Yes — incomplete vs what the calculator actually reads |
| Job Plan adapter | Dedicated — area / reno type / finish chips + 3 toggles |
| Refine adapter | Dedicated — demolition + plumbing only |
| Quote draft | Fact-aware paragraph (`buildBathroomDraft`) |
| Company DNA | None. Calibration scenario exists (`bathroom.standard_reno.v1`) but is lump-hour / lump-$ |
| Analyse | Heuristic `inferBathroom` + LLM fact list |
| ISD | Plumbing / electrical / tiling / waterproofing / linings / fixtures are **relationship language**, not product Work Areas |

Commercial path today:

```
facts (often incomplete)
  → silent 5 m² if area missing
  → always emit carpentry/prep hours
  → optional demo / waterproof / tiling / fixtures / plumbing / electrical / lining / floor-prep lumps
  → else $18k materials package floor
  → quality factor on allowances
  → generic commercial engine
```

It **prices**. It does **not** own room geometry, sheet counts as money, independent tile vs tiler, or editable subbie scope.

---

## 2. Current facts

### 2.1 Asked (question templates)

| Key | Unit / type | Required | Consumed? |
| --- | --- | --- | --- |
| `bathroom.area_m2` | m² | yes | **Yes** — primary quantity. Silent 5 if missing |
| `bathroom.renovation_type` | enum | yes | **Yes** — carpentry hours + coordination + assumption copy |
| `bathroom.finish_level` | enum | yes | **Partial** — display / package note. Money uses **project** `qualityLevel` |
| `bathroom.demolition_required` | bool | yes | **Yes** — lump demo hours |
| `bathroom.fixtures_client_supplied` | bool | yes | **Yes** — install hours vs fixture $ lumps |
| `bathroom.fixtures_included` | multi | no | **Partial** — only Vanity / Shower / Toilet map to $ |
| `bathroom.waterproofing_included` | bool | yes | **Yes** |
| `bathroom.waterproofing_extent` | enum | no | **No** — asked, not consumed |
| `bathroom.tiling_included` | bool | no | **Yes** — default **on** unless explicit `false` |
| `bathroom.floor_tiling_area_m2` | m² | no | **Yes** (via commercial-realism) — **not** in consumed-fact list |
| `bathroom.wall_tiling_area_m2` | m² | no | **Yes** (via commercial-realism) — **not** in consumed-fact list |
| `bathroom.tile_extent` | enum | no | **Notes only** — does not change m² |
| `bathroom.shower_type` | enum | no | **Partial** — Aqualine vs plasterboard label only |
| `bathroom.wall_tile_height` | enum | no | **No** — asked, not consumed |
| `bathroom.ventilation_included` | bool | no | **Yes** — extractor lump |
| `bathroom.wall_lining_included` | bool | no | **Yes** |
| `bathroom.floor_prep_included` | bool | no | **Yes** — floor-prep lump |
| `bathroom.underfloor_heating_included` | bool | no | **Yes** — UFH lump |
| `bathroom.plumbing_changes` | None/Minor/Major | no | **Yes** — lump $ (no Standard) |
| `bathroom.electrical_changes` | None/Minor/Major | no | **Yes** — lump $ (no Standard) |

### 2.2 Consumed but not asked

| Key | Role |
| --- | --- |
| `bathroom.waterproofing_required` | Alias of included |
| `bathroom.plumbing_allowance` / `bathroom.electrical_allowance` | Boolean fallback |
| `bathroom.includes_vanity` / `includes_shower` / `includes_toilet` | Legacy boolean fixture path |
| `bathroom.total_tiling_area_m2` | Derived if floor **and** wall tile m² known |
| `bathroom.waterproofing_area_m2` | Optional explicit WP area |
| `bathroom.wall_lining_area_m2` | Optional explicit lining area |
| `bathroom.perimeter_m` | Lining fallback if height also present |
| `bathroom.wall_height_m` | Lining fallback if perimeter also present |
| `bathroom.access` | Legacy; mapped to Project Condition `site_access` |

### 2.3 Missing (owner-approved model — not in product today)

Length, width, derived floor / ceiling / wall area, opening deductions, floor substrate identity, ceiling lining, framing intensity, floor-finish XOR, vinyl type, tile format, fixture supply vs install, PC sums per fixture, plumbing/electrical **Standard**, editable subbie scope text, waste/disposal requirement, nested stopping/painting flags, job-scope / partial-scope class.

`project_facts` remains estimating SoT. Question responses are capture journal only. That rule does not change.

---

## 3. Current questions

20 templates. Four required: area, renovation type, finish level, demolition, client-supplied fixtures, waterproofing (six required if counting all `required: true`).

Conditional hiding (`lib/scopes/conditional-rules.ts`):

- Fixture list hidden if client-supplied **or unknown**
- Tile area / extent / wall height hidden if tiling not explicitly yes
- Waterproofing extent hidden unless waterproofing explicitly yes
- Shower type gated on fixture list

**Defects vs factory WA-2:**

- No `estimatePriorityClass` on Bathroom templates → Quick Estimate treats **all** as askable (P0-by-default)
- Area is in `AREA_ONLY_SKIP_KEYS` for some skip paths, then silently defaulted to 5 m² anyway
- Several asked keys are ignored (`waterproofing_extent`, `wall_tile_height`, `tile_extent` quantity)
- Refine only offers demolition + plumbing — not geometry, floor finish, or fixtures
- Bathroom can still present ~20 questions. Factory rule: do not ask 35; Bathroom already over-asks relative to what it consumes

---

## 4. Current calculator behaviour

`calculateBathroom` always emits **Bathroom carpentry/prep labour**:

```
hours = min(32, (full reno ? 16 : 10) + area_m2 × 0.5)
```

then labour minimums (crew 2, duration 4 or 8 h, total 8 or 16 h) × access × small-job (`area < 6` → ×1.1).

Then, by flag:

| Line | Trigger | Quantity authority | Money authority |
| --- | --- | --- | --- |
| Demolition/strip-out | `demolition_required` | Lump hours (catalogue 8, **code fallback 10**) | In-house labour rate |
| Waterproofing allowance | WP included | Tiling-area proxy or floor area | Hardcoded $/m² + **$1,200 / $1,800 min** |
| Tiling allowance | `tiling_included !== false` | Floor+wall tile m², else floor×1.5 wall assume, else **floor area** | `resolveRate(bathroom.tiling.m2)` + **$2,200 / $3,400 min** × quality |
| Fixtures allowance | not client-supplied | Vanity/Shower/Toilet lumps only | `resolveRate(bathroom.fixtures.allowance)` × quality |
| Fixture install labour | client-supplied | Lump **8 h** | In-house labour |
| UFH / extractor / floor prep | flags | Lumps | Hardcoded $ × quality |
| Plumbing / electrical | Minor/Major (no Standard) | Lumps | Hardcoded $ × quality; min = Minor |
| Wall lining material | lining included | Lining m² or **floor-area fallback** | Hardcoded $/m² × quality |
| Wall lining labour | lining included | Lump **6 h** | In-house labour |
| Materials/finishes package | no “component finishes” | Floor area × $/m² | **max(that, $18,000 / $25,000)** × quality |
| Coordination | full/standard + ≥3 subbies or full+demo | Lump | $800 / $1,200 |

Sheet-count / flooring-area **build-ups are metadata**. They do not own money except tiling’s m² quantity (still mixed tile+labour).

**No `requirements` array.** Overlap groups exist (`bathroom_tiling`, `bathroom_plumbing`, …) for pricing ownership, not RFQ.

---

## 5. Silent / fallback behaviour (fake precision)

These must not survive as undisclosed physical authority.

| Behaviour | Where | Replacement |
| --- | --- | --- |
| **Silent 5 m²** | `recordDefaultedNumber(..., assumedValue: 5)` | KNOWN L×W, or **ASSUMED_DISCLOSED** standard-room (only if user accepts), or **INFO_REQUIRED**. Never price a hidden 5 m² |
| **Tiling default ON** | `tiling_included !== false` | Explicit include / exclude / INFO_REQUIRED. Partial scopes must not inherit full tiling |
| **Tiling m² = floor area** | `resolveBathroomTotalTilingArea` fallback | Independent floor tile m² + wall tile m² from geometry + extent. No floor-as-tile default |
| **Assumed wall tile = floor × 1.5** | same helper | Extent-driven wall area, or INFO_REQUIRED, or disclosed assumption with label |
| **Waterproofing = tiling area** | `resolveBathroomWaterproofingArea` | Floor + shower walls + selected wet walls. Not “all tiling” and not all wall area |
| **Wall lining = floor area** | `resolveBathroomWallLiningArea` | `gross_wall_area_m2` from L×W×H. Floor m² is not wall m² |
| **Carpentry hours from floor m²** | `carpentryPrepHours` | Replace with framing lm + lining h/m² + fixture-install hours. No unexplained m² labour |
| **Quality factor × tiling quantity** | `createRateLineItem` qualityFactor | Finish level must **not** inflate physical m². PC / material allowance only |
| **Quality factor × specialist lumps** | plumbing, electrical, WP, lining $ | Do not multiply structural/trade lumps by finish. PC / fixture / tile material only |
| **`tile_extent` / `wall_tile_height` / `waterproofing_extent` ignored** | asked, unused | Consume or stop asking |
| **Bath / basin / tapware / mirror / rail / accessories selected, $0** | fixture map | Per-fixture PC + install, or explicit “not priced yet” |
| **`bathroom.labour_hours_per_m2` = 22** | productivity catalogue, unused | **REMOVE FROM MATURE PATH**. Must not become DNA |

Assumptions **are** pushed to `assumptions[]` for the 5 m² case (“Using assumed bathroom area of 5 m² for rough estimate”). That is not enough: the estimate still looks complete and Job Plan / quote still read as a sized bathroom.

---

## 6. Current package / minimum behaviour

| Minimum | Cost | Sell | Trigger |
| --- | --- | --- | --- |
| Bathroom materials package | **$18,000** | **$25,000** | No WP, tiling not defaulted on, no fixture $ , not client-supplied |
| Waterproofing trade | $1,200 | $1,800 | WP included |
| Tiling trade | $2,200 | $3,400 | Tiling not excluded (default on) |
| Plumbing | Minor $1,200 / $1,800 | Major $3,500 / $5,200 | Changes included |
| Electrical | Minor $900 / $1,400 | Major $2,800 / $4,200 | Changes included |
| Extractor | $350 | $520 | Ventilation included |
| Floor prep | $400 | $600 | Floor prep included |
| UFH | $1,500 | $2,400 | UFH included |
| Coordination | $800 | $1,200 | Multi-trade full/standard |
| Demo hours min | 8 h (code fallback 10 vs catalogue 8) | — | Demo included |
| Lining install | 6 h lump | — | Lining included |
| Fixture install | 8 h lump | — | Client-supplied |

**Mature path:** no generic $18k Bathroom package line. Missing trusted rate → Pricing Required or labelled allowance. Missing geometry on a geometry-driven scope → INFO_REQUIRED, not a package floor.

---

## 7. Proposed scope model

Bathroom estimates a **bathroom job**, not “all wet-area trades as sibling Work Areas”.

### 7.1 Belongs here

- Existing bathroom renovation / refresh / strip-out / reline / retile / fixture replacement
- New bathroom fitout inside an existing building (local wet-area)
- Local nogging / fixture support / shower support
- Nested bathroom linings, waterproofing, tiling, plumbing/electrical **allowances**, fixtures, bathroom waste

### 7.2 Does not belong

| Job | Owner |
| --- | --- |
| Full new partition / room reconfiguration | `internal_walls` |
| Whole-house / other-room ceilings | `ceilings` |
| Standalone painting / stopping of non-bathroom surfaces | `painting` / `plastering` |
| House-wide flooring | `flooring` (bathroom floor finish stays nested unless user adds Flooring WA for the same room — XOR) |
| Standalone demolition of other rooms | `demolition` |
| Plumbing / electrical / tiling / waterproofing as product WAs | Never. ISD only |
| Kitchen | `kitchen` |

### 7.3 Job-scope class (required, progressive)

Canonical fact: `bathroom.job_scope`

Implemented values (WA-BATHROOM-02):

| Value | Meaning | Architecture alias |
| --- | --- | --- |
| `strip_out_only` | Demolition + waste. No new linings/finishes unless added | |
| `vanity_only` | Fixture ± plumbing. Geometry not required | `replace_vanity` |
| `shower_only` | Shower fixture ± WP/tile/plumbing. Geometry only if finishes selected | `replace_shower` |
| `fixture_replacement` | Selected fixtures ± install/plumbing. Geometry not required | `replace_fixtures` |
| `retile_floor` | Floor finish + floor tile/vinyl. Floor geometry required | |
| `reline` | Wall/ceiling linings ± WP. Full geometry required | |
| `new_fitout` | New bathroom in existing space. Full geometry | |
| `full_renovation` | Strip + rebuild. Full geometry + systems | |
| `custom` | Component flags only — generate what is selected | |

`bathroom.renovation_type` is **legacy dual-read only** (P3, never asked on the mature path). Mapping in §44 / §53. Finish level stays independent.

### 7.4 Component flags (requirement generation)

Each group is include/exclude. Unselected groups emit nothing.

Demolition · Floor substrate · Floor finish · Wall lining · Ceiling lining · Framing/nogging · Waterproofing · Floor tiling · Wall tiling · Plumbing · Electrical · Fixtures (per item) · Stopping (nested XOR) · Painting (nested XOR) · Waste.

---

## 8. Geometry authority

Canonical (V1 — no opening deduction):

```
floor_area_m2     = length_m × width_m
ceiling_area_m2   = length_m × width_m
gross_wall_area_m2 = 2 × (length_m + width_m) × wall_height_m
```

Facts:

| Key | Status | Notes |
| --- | --- | --- |
| `bathroom.length_m` | **NEW** | KNOWN or INFO_REQUIRED when geometry-driven |
| `bathroom.width_m` | **NEW** | |
| `bathroom.wall_height_m` | **PROMOTE** | Exists as unasked fallback. Default **ASSUMED_DISCLOSED 2.4 m** only if user accepts / Not sure |
| `bathroom.floor_area_m2` | **DERIVED** | Replaces `bathroom.area_m2` as physical authority |
| `bathroom.ceiling_area_m2` | **DERIVED** | |
| `bathroom.gross_wall_area_m2` | **DERIVED** | |
| `bathroom.area_m2` | **LEGACY ALIAS** | If L/W absent but area known: treat as floor_area KNOWN, L/W INFO_REQUIRED unless job-scope does not need plan dimensions |

**Opening deductions:** none exist in any calculator today. **Do not require for Bathroom V1.** Document as future `net_wall_area_m2` refinement (door / window / shower-niche later). Gross wall remains commercial wall-lining / tiling parent until then. Disclose “openings not deducted”.

**Perimeter:** `bathroom.perimeter_m` may be DERIVED `2×(L+W)` for skirting / waste later. Do not ask perimeter if L/W known.

Add derived keys to `DERIVED_FACT_KEYS`. Do not ask derived areas.

---

## 9. Partial-scope architecture

Bathroom **must not** require a full renovation.

Requirement generation is **flag-driven**, not “if bathroom WA exists, emit everything”.

| Job scope | Geometry | Demo | Linings | Floor finish | WP | Tiling | Fixtures | Plumbing | Electrical | Waste |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vanity only | Not required | Optional | No | No | No | No | Vanity | Component modifier | Only if lighting/GPO selected | Only if demo |
| Shower only | If WP/tile/reline | Optional | If reline | No unless selected | Typical yes | Shower walls / tray | Shower ± enclosure | Component | Fan/light if selected | If demo |
| Replace fixtures | Not required | Optional | No | No | No | No | Selected | Intensity + components | If selected | If demo |
| Retile floor | Floor L×W or floor m² | Optional | No | XOR tile/vinyl | Floor if wet | Floor only | No | Usually no | No | If strip floor |
| Reline | Full geometry | Optional | Wall ± ceiling | Optional | Per wet areas | Per extent | Optional | Optional | Optional | If strip linings |
| Strip-out only | Floor + wall useful for labour; may INFO_REQUIRED | Yes | No | No | No | No | Count for strip | Cap-off allowance | Isolate allowance | Yes |
| New fitout / full reno | Full geometry | Typical yes | Typical yes | XOR | Yes | Per extent | Catalogue | Hybrid | Hybrid | Yes |

**Composable for later Variations:** a variation “replace vanity and relocate basin plumbing” creates/updates fixture + plumbing component facts **without** demanding L/W. Geometry-driven groups stay absent, not zero-priced.

---

## 10. Demolition architecture

Optional. `bathroom.demolition_required` remains the include flag.

Physical drivers (no unexplained package minimum):

- Floor area (floor covering / substrate strip)
- Wall lining area (if linings stripped)
- Ceiling area (if ceiling stripped — flag, not automatic)
- Fixture count (vanity, WC, shower, bath)

Requirement split:

| Kind | Authority |
| --- | --- |
| Labour | Independent `bathroom.demolition.hours_per_m2` (or hours per fixture for fixture-only strip) — **REQUIREMENT GAP** today (lump allowance only) |
| Waste | Visible bathroom waste requirement — not buried in carpentry |
| Plant | N/A unless skip/hire later |
| Material | N/A |

Boundary vs `demolition` WA: bathroom strip-out stays on Bathroom. Standalone Demolition WA must not also price `bathroom_demolition` overlap group. Existing ISD `bathroom.demolition` relationship already suppresses if demolition WA accepted — keep that XOR.

---

## 11. Floor substrate model

Owner-approved XOR:

| Code | Concept | Sheet |
| --- | --- | --- |
| A | 19 mm H3.2 CCA-treated structural plywood | 2400 × 1200 = **2.88 m²** |
| B | 18 mm fibre cement sheet | 2400 × 1200 = **2.88 m²** |

Physical:

```
floor_area_m2 × (1 + waste)
  → required material area
  → ceil(area / 2.88) whole sheets
```

Reuse `calculateSheetCount` (already defaults 2.4 × 1.2). Money must follow **sheet count × sheet identity**, not `$ / bathroom m²`.

**Current identities:** `sheet.plywood.each` and generic `FITOUT_BENCHMARKS.plywoodSheet` ($45 / $68) — **not** 19 mm H3.2. **No fibre-cement sheet key.** Bathroom floor-prep is a **$400 lump**, not substrate.

| Current | Decision |
| --- | --- |
| `bathroom.floor_prep_included` + `floorPrepMinor` lump | **SUPERSEDE** as physical substrate when substrate selected; keep as optional levelling allowance only if explicitly “levelling only, no new sheet” |
| `sheet.plywood.each` | **REUSE** catalogue slot; **RENAME PRESENTATION** / new identity for 19 mm H3.2 — do not pretend current $ is that product |
| Fibre cement | **NEW** identity later — **NEEDS OWNER BENCHMARK** |
| Waste % | Reuse `sheet_material` wastage settings. **NEEDS OWNER** confirmation of bathroom wet-area waste |

Labour: independent **person-hours / m²**. **REQUIREMENT GAP.** Current lining install is a 6 h lump; floor prep has **no** hours. Do not fake DNA.

---

## 12. Wall lining model

Default concept: **13 mm GIB Aqualine**, 2400 × 1200 = 2.88 m².

```
gross_wall_area_m2 × waste → whole sheets → material
+ independent wall-lining labour (h/m²)
```

**Current:** `bathroom.wall_lining_included` → `$45 / $68 per m²` hardcoded × **floor-area fallback**. Sheet count metadata only if WP or tiled shower (Aqualine label). Labour = **6 h lump** (`bathroom.wall_lining_install_hours_allowance` — **not in productivity catalogue**, fallback 6).

| Current | Decision |
| --- | --- |
| `BATHROOM_BENCHMARKS.wallLiningPerM2` | **SUPERSEDE** as money authority. Replace with sheet identity |
| `sheet.plasterboard.aqualine.each` ($26 / $38) | **REUSE** identity; rate **NEEDS OWNER** (current is fitout catalogue, `calculatorSupport: planned`) |
| Standard plasterboard | Only if explicitly not wet-area lining |
| `bathroom.wall_lining_install_hours_allowance` lump | **REMOVE FROM MATURE PATH** |
| Independent h/m² | **NEW** — **NEEDS OWNER PRODUCTIVITY** |

Do not create a second Aqualine identity if `sheet.plasterboard.aqualine.each` can be shared (factory shared `sheet.` allow-list).

---

## 13. Ceiling lining model

Same physical pattern on `ceiling_area_m2`. Independent ceiling-lining labour.

**Current: no ceiling lining in Bathroom calculator.**

### Boundary vs future `ceilings` WA

| Rule | |
| --- | --- |
| Bathroom ceiling lining is **nested** when the job is a bathroom renovation and the ceiling is part of that wet-area rebuild | Bathroom owns it |
| If a sibling `ceilings` WA is confirmed for the **same room**, Bathroom must **not** emit ceiling lining / ceiling stopping / ceiling paint | XOR: `bathroom.ceiling_lining_included` false or suppressed |
| Whole-house / hallway / other-room ceilings | `ceilings` only |
| Default for full bathroom reno | Nested bathroom ceiling lining **on**, unless user says ceiling by others / existing remains |

Disclose: “Bathroom ceiling lining is included in Bathroom, not in Ceilings, unless a Ceilings Work Area is added for this room.”

---

## 14. Framing / nogging model

Builder-facing intensity: **None / Minor / Standard / Major**.

**Do not** price framing as arbitrary hours per bathroom floor m² (current carpentry formula).

Preferred:

```
gross_wall_area_m2 × intensity_lm_per_m2 (benchmark, owner-approved later)
  → framing_lm
framing_lm × productivity_h_per_lm
  → labour hours
```

Default material concept: **90 × 45 H1.2 radiata pine**.

**Do not invent intensity lm/m² or h/lm in this audit.**

| Current | Decision |
| --- | --- |
| `carpentryPrepHours` | **REMOVE FROM MATURE PATH** |
| `bathroom.labour_hours_per_m2` = 22 | **REMOVE FROM MATURE PATH** |
| Deck `90x45` H3.2 SG8 identities | **Do not reuse as bathroom H1.2** — treatment/exposure differ |
| Internal-walls framing labour 0.8 h/lm hardcoded | Pattern **REUSE**; keys stay `internal_walls.*`. Bathroom gets `bathroom.framing.*` |
| Intensity / productivity / $/lm | **NEEDS OWNER BENCHMARK** |

### Framing vs Internal Walls

Bathroom framing = local nogging, fixture/shower/vanity support, local wall modifications.

**Complete new partition → `internal_walls`.**

If both WAs exist: Bathroom emits only nogging/support; Internal Walls emits the partition. No shared `overlapGroup` that prices twice. Fact `bathroom.partition_by_internal_walls` (or Job Plan XOR) later if needed.

---

## 15. Floor finish systems

XOR — one primary system:

| System | Physical |
| --- | --- |
| Tile | Floor tile m² (tiling module) |
| Sheet vinyl | Floor area × waste |
| Vinyl plank / slat | Floor area primary; optional plank-size count |
| Other allowance | Labelled PC / m² allowance |

Do not price tile + vinyl together unless user sets **separate areas** (e.g. timber look in dry zone + tile in shower — explicit split facts, not two full-room systems).

**Current:** no floor-finish XOR. Tiling defaults on. Flooring WA is a separate package (`flooring.type` includes Vinyl/Tile). Isolation: if Bathroom floor finish is selected, do not also let `flooring` WA price the same bathroom floor without XOR / overlap group `bathroom_floor_finish`.

---

## 16. Vinyl model

- **Sheet vinyl:** area-based. Waste once (`flooring` wastage category).
- **Vinyl plank:** area is **primary commercial authority**. Typical plank **914/915 × 152 mm** is metadata for an approximate count only.

```
approx_plank_count = floor_area / (0.915 × 0.152)
```

**Do not invent pack coverage or pack counts.** If pack m² is later owner-approved, then ceil to packs.

Current `FITOUT_BENCHMARKS.vinylPerM2` ($85 / $130) is flooring-WA package — **REUSE as researchable placeholder class only**, **NEEDS OWNER** before Bathroom money.

---

## 17. Tiling geometry

Independent:

- `bathroom.floor_tile_area_m2`
- `bathroom.wall_tile_area_m2`

Wall tiling extent (architecture):

| Extent | Physical rule (V1) |
| --- | --- |
| None | 0 |
| Shower only | Disclosed shower-wall assumption **or** custom m² — **INFO_REQUIRED** if neither |
| Partial / selected | Custom m² |
| Half height | `gross_wall_area_m2 × 0.5` as **ASSUMED_DISCLOSED** only after extent chosen; openings not deducted |
| Full height | `gross_wall_area_m2` disclosed gross |
| Custom m² | KNOWN |

**Do not assume all bathroom walls are tiled.** Current `tile_extent` options (Floor only / Floor and walls / Full height / Splashback) are close — **REUSE presentation**, **consume them**. `wall_tile_height` duplicates extent — **merge**.

Current product **can** store floor + wall tile m² and derive total. It **cannot** derive wall tile from extent × geometry because geometry does not exist.

---

## 18. Tile material model

Separate from tiler labour.

Format metadata (not pack authority): 600×600, 600×300, 300×300, mosaic, custom.

```
approx_tile_count = tile_area_m2 / tile_face_area_m2
```

Primary requirement remains **required m²** unless pack coverage is known. Waste **once** (`flooring` or dedicated tile wastage — owner later). Current tiling already applies `flooring` wastage to the mixed allowance — **REUSE category**, split when material vs subcontract split.

Finish level may scale **PC $/m² for unspecified tile**, not m² quantity.

---

## 19. Tiling subcontract model

Tiling install is a **$/m² subcontract benchmark** on physically calculated tile area.

**Current mixes tile material + tiler in `bathroom.tiling.m2` ($180 / $280)** plus a **$2,200 / $3,400 minimum**, labelled “Tiling allowance”, category subcontractor.

| Current | Decision |
| --- | --- |
| `bathroom.tiling.m2` | **SUPERSEDE** as mixed rate. Split: `bathroom.tile.material.m2` (PC/material) + `bathroom.tiling.install.m2` (subcontract) |
| `tilingMinimum` | **REMOVE FROM MATURE PATH** as hidden floor. If a small-job floor remains, it must be labelled “minimum tiler call-out” and owner-approved |
| `bathroom.tiling_hours_per_m2` = 2.0 | **NOT DNA**. Subcontract $ rate, not builder productivity. **LOW VALUE / NOT DNA** |

---

## 20. Waterproofing model

Separate subcontract. Authority = physically derived WP area, **not** all walls, **not** silently = tiling.

Components (include flags):

- Floor
- Shower walls
- Bath surround
- Selected wet walls

`bathroom.waterproofing_extent` already asks Floor only / Floor and walls / Shower-wet only — **REUSE**, **consume**.

| Current | Decision |
| --- | --- |
| `bathroom.waterproofing.allowance` catalogue lump $1,200 | **SUPERSEDE** as primary; keep only as fallback min if owner wants call-out |
| `waterproofingPerM2` $90 / $140 hardcoded (bypasses `resolveRate`) | Promote to catalogue key `bathroom.waterproofing.m2` — **NEEDS OWNER** |
| Tiling-area proxy | **REMOVE FROM MATURE PATH** |
| `bathroom.waterproofing_hours_allowance` | Unused. **NOT DNA** (subcontract) |

---

## 21. Plumbing model

**Hybrid. Not $/bathroom-m².**

Builder selects **MINOR / STANDARD / MAJOR** (add Standard — current template omits it).

Plus component modifiers (presence, not invented $ in this audit):

- Toilet · vanity/basin · shower · bath · tapware · floor waste
- Service relocation · all plumbing replaced · existing locations retained/moved

```
plumbing_allowance = base(intensity) + Σ component_modifiers
```

**No benchmark values invented here.**

| Current | Decision |
| --- | --- |
| Minor $1,200 / Major $3,500 only | **KEEP as current commercial evidence**; **NEEDS OWNER** re-approval; add Standard |
| `getTradeChangesIncluded` | “modifications required” (calibration fixture) does **not** match minor/major/yes → plumbing **omitted**. Fix in implementation |
| Pure m² plumbing | Never primary |

---

## 22. Electrical model

Same hybrid: **MINOR / STANDARD / MAJOR** + components:

Lights · fan · heated towel rail · underfloor heating · GPO · switches · mirror power · vanity lighting · new circuit · relocation.

UFH today is a **separate $1,500 lump** and also an electrical component conceptually — mature path: UFH is an electrical (or specialist) **component modifier**, not a second silent package. XOR: do not emit both a generic electrical Major **and** full UFH lump without owner rule. Recommended: UFH has its own subcontract/allowance line **in addition** to base electrical intensity only when selected; base intensity must not already include UFH.

Extractor fan today is a **separate lump** vs electrical. Mature: fan is an electrical component; ventilation material (fan unit) may be fixture PC. Do not double-count fan install in electrical + ventilation allowance.

---

## 23. Editable subbie scope contract

Facts (estimating SoT, editable in Builder Review):

| Key | Trade |
| --- | --- |
| `bathroom.plumbing.scope_text` | Plumbing |
| `bathroom.electrical.scope_text` | Electrical |
| `bathroom.tiling.scope_text` | Tiling (optional) |
| `bathroom.waterproofing.scope_text` | Waterproofing (optional) |

Example plumbing:

> Relocate WC approximately 600 mm, install vanity services, replace shower mixer and connect new shower waste.

Associated with the Bathroom **subcontract requirement**, not a free-floating note. Future RFQ-V1 sends this text. **Do not implement RFQ now.**

Pattern already exists: `retaining_wall.masonry.subcontract_scope`. **REUSE the fact-as-scope-text pattern**, namespaced to bathroom trades.

---

## 24. RFQ readiness

`SubcontractRequirement` today:

```
trade?, allowanceCost?, quotedCost?, totalCost?
SubcontractCostAuthority = allowance | benchmark | rfq_quoted | rfq_adopted
```

**Reserved RFQ states exist. Live objects do not carry RFQ id, requested scope, supplier, selected price, or quote provenance.**

Can current metadata accommodate RFQ later **without a migration in this phase?** **Partially.**

| Need | Now | Later (RFQ-V1, not this phase) |
| --- | --- | --- |
| Stable requirement identity | `requirementId` / `componentKey` | Keep |
| Allowance vs quote | `allowanceCost` / `quotedCost` / authority enum | Use |
| Scope text | **Not on requirement** — put on **facts** now | Copy onto RFQ payload |
| RFQ id, supplier, selected price | **Absent** | Extend `SubcontractRequirement` or side table **then**. **No schema in WA-BATHROOM-01** |

Provenance for electrical (and plumbing/tiling/WP) replacement by a returned quote: same `componentKey` (`bathroom.electrical`, …). Estimate must not rebuild the Work Area; it swaps cost authority on that requirement. Document identity now; implement with RFQ.

Recommended commercial hierarchy (consistent with `QUOTR_RATE_AUTHORITY_AND_PROVENANCE_MODEL.md` + factory WA-5):

```
returned / selected subcontractor quote     (future RFQ — PROJECT_OVERRIDE / supplier)
  → organisation company rate for that item_key
    → specific Quotr benchmark / owner-approved allowance
      → Pricing Required (missing) — never $0, never revert to $18k package
```

Do **not** use `scope.bathroom.m2` as primary. Catalogue entry exists (`calculatorSupport: planned`) — **REMOVE FROM MATURE PATH**.

---

## 25. Fixtures / supply / install

Initial catalogue:

| Fixture | Supply | Install | Supply+install | Recommended install authority |
| --- | --- | --- | --- | --- |
| Toilet | Yes | Yes | Yes | **Plumber** (subcontract component). Builder install only if owner later says in-house |
| Vanity | Yes (PC) | Yes | Yes | **Builder** labour (hang/set) + **plumber** services |
| Basin | Yes | Yes | Yes | Usually with vanity; plumber for services |
| Shower | Yes | Yes | Yes | Tray/liner **builder**; mixer/waste **plumber**. Tiled shower = WP + tiler, not a shower-box lump |
| Shower enclosure | Yes | Yes | Yes | **Builder** or glazier subcontract — owner later |
| Bath | Yes | Yes | Yes | **Builder** set + **plumber** connect |
| Heated towel rail | Yes | Yes | Yes | **Electrician** |
| Mirror | Yes | Yes | Yes | **Builder** |
| Fan | Yes | Yes | Yes | **Electrician** |
| Tapware | Yes (PC) | Yes | Yes | **Plumber** |
| Accessories | Yes | Yes | Yes | **Builder** |

**Do not build one combined fixture package.** Material/PC and installation labour are independent.

**Avoid plumbing + builder double-count:** if toilet install is in plumbing Major, do not also emit builder toilet-install hours. Recommended V1: fixture **supply PC** always independent; **install hours** only for builder-owned fixtures (vanity, mirror, accessories, bath set, enclosure); plumber-owned install sits in plumbing hybrid, not a second labour line.

Current: client-supplied → **one 8 h lump** for all fixtures. Contractor-supplied → Vanity/Shower/Toilet **combined $** via `bathroom.fixtures.allowance`. Bath/basin/tapware/mirror/rail/accessories **asked, not priced**.

`BATHROOM_BENCHMARKS.fixtureInstall` ($1,200 / $1,800) is **unused** by the calculator — **SUPERSEDE / unused**.

---

## 26. PC sums

Unknown fixture products use **explicit PC / allowance** semantics.

```
fixture selected
  → supply_mode: contractor_pc | client_supplied | contractor_specified
  → supply_allowance $ (PC) if contractor_pc
  → install labour or trade component (independent)
```

Do not present a generic fixture allowance as a merchant quote. Rate source label: **PC allowance** / **Quotr benchmark PC** / **company PC**.

Finish level (Standard / Mid-range / Premium) scales **PC $**, not install hours.

Current `bathroom.fixtures.allowance` is a **sum of hardcoded fixture lumps** passed as `resolveRate` fallback — looks like one company rate, is actually a bundle. **SUPERSEDE** with per-fixture keys (`bathroom.fixture.vanity.pc`, …).

---

## 27. Waste

**Current Bathroom calculator emits no waste / skip / disposal line.** Demo is labour only. ISD may suggest `waste_removal` as a non-product scope.

Target: visible **Bathroom waste/disposal** requirement when demolition or strip is selected. Drivers: floor area + lining area + fixture count (coarse). V1 does **not** need density modelling.

`DEMOLITION_BENCHMARKS.bathroomEach` / `wastePerM2` / `skipBinEach` — **REUSE as candidate rate class** for nested bathroom waste, not a second Demolition WA. **NEEDS OWNER**.

Must not be buried in carpentry or the $18k package.

---

## 28. Painting / plastering boundary

Quotr has sibling WAs `painting` and `plastering`. Internal walls / ceilings already have nested `stopping_included` / `painting_included` **allowances**.

**Bathroom calculator has no nested stopping/painting flags.** ISD `bathroom.painting` may suggest adding Painting WA.

**XOR rules:**

1. If sibling `painting` WA is confirmed and covers the bathroom surfaces → Bathroom must **not** emit painting.
2. If sibling `plastering` WA covers bathroom stopping → Bathroom must **not** emit stopping.
3. If neither sibling exists, Bathroom **may** nest stopping/painting as **allowances** (same pattern as internal_walls), default **off** unless job-scope is full reno / reline and user includes finishing.
4. Nested flags are allowances or “add sibling WA” prompts — they must **not** silently generate a second full Painting estimate.

Recommend facts: `bathroom.stopping_included`, `bathroom.painting_included` (nested, default off). Prefer sibling WAs when the builder already uses them.

---

## 29. Ceilings boundary

See §13. Future `ceilings` WA must not double-price a ceiling already nested in Bathroom. Isolation proof: fixture with Bathroom ceiling lining + Ceilings WA on another room → no shared requirement keys; same-room both confirmed → bathroom ceiling lining suppressed.

---

## 30. Internal walls boundary

See §14. Local bathroom framing ∈ Bathroom. Full partition ∈ Internal Walls. Isolation proof: Bathroom Major nogging + Internal Walls new partition on same project → different componentKeys, no double GIB of the same wall.

Bathroom wall lining vs Internal Walls lining: bathroom wet-area GIB is Bathroom. New dry partition GIB is Internal Walls.

---

## 31. Finish-level behaviour

Recommend builder-facing: **Standard / Mid-range / Premium** (replace Budget / Standard / Premium naming if owner wants; do not bikeshed in 01).

**May affect:** fixture PC, tile/material PC, vanity/cabinetry, selected finishes.

**Must not:** multiply structural labour, lining hours, demolition hours, or specialist trade lumps.

**Current:** `getQualityFactor` uses **project** `qualityLevel` (budget 0.9 / standard 1.0 / premium 1.15, org overrides). Applied to **almost every Bathroom allowance and to tiling quantity**. Carpentry/demo hours are **not** quality-multiplied (access/small-job only). Package note shows `bathroom.finish_level` but money may use a different project quality.

**SUPERSEDE** whole-package quality multiply. Align bathroom finish fact with project quality only as a default, not a second multiplier.

---

## 32. Project Conditions

Use canonical sibling store. Do **not** add bathroom-specific duplicates.

Relevant (already in applicability for interior/reno):

`site_access` · `floor_level` · `material_carry_distance` · `waste_bin_access` · `services_isolated` · `occupied_site` · `working_hours` · `hazardous_materials_risk` · `parking_loading` · `protection_dust_control` · `client_supplied_items` · `by_others_trades`

`bathroom.access` is already aliased to `site_access`. **KEEP alias, do not ask both.**

Bathroom labour already consumes combined access via `getCombinedLabourAccessFactor` + legacy adapter. **KEEP** that consumption pattern; extend carry if factory conditions already do for interior — do not invent a bathroom-only carry DNA.

---

## 33. Labour productivity — gaps

| Task | Independent key today? | Consumed? | Gap |
| --- | --- | --- | --- |
| Floor substrate install | No | — | **REQUIREMENT GAP** h/m² |
| Wall lining | Lump `wall_lining_install_hours_allowance` (not catalogued) | Lump 6 h | **REQUIREMENT GAP** h/m² |
| Ceiling lining | No | — | **REQUIREMENT GAP** h/m² |
| Framing / nogging | No (carpentry m² formula) | Hardcoded | **REQUIREMENT GAP** h/lm |
| Demolition | `bathroom.demolition_hours_allowance` lump | Lump (8 vs 10 mismatch) | **REQUIREMENT GAP** if physical; lump is not DNA |
| Fixture install (builder) | Uncatalogued lump 8 h | Lump | **REQUIREMENT GAP** per-fixture hours |
| `bathroom.labour_hours_per_m2` = 22 | Yes | **No** | Dead key — not DNA |
| Tiling / WP hours keys | Yes | **No** | Not DNA (subcontract) |

Do **not** implement Bathroom DNA in this phase. Do not pretend Company DNA support.

---

## 34. Company DNA candidates (future, not now)

| Task | Class | Why |
| --- | --- | --- |
| Floor substrate install | **GOOD** | Independent h/m², builders vary, physical scenario |
| Wall lining | **GOOD** | Same |
| Ceiling lining | **GOOD** | Same |
| Framing / nogging | **GOOD** | h/lm after intensity exists |
| Demolition (if h/m² not lump) | **GOOD** | If independent key consumed |
| Fixture install hours | **LOW VALUE** | Small lumps; plumber-owned often |
| Plumbing / electrical / tiling / WP $ | **NOT DNA** | Subcontract rates |
| PC sums | **NOT DNA** | Allowances |
| `labour_hours_per_m2` = 22 | **NOT DNA** | Fake whole-bathroom productivity |

---

## 35. Current rate / benchmark inventory

### 35.1 `BATHROOM_BENCHMARKS`

| Key | Cost | Sell | Used? | Decision |
| --- | --- | --- | --- | --- |
| `materialsPerM2` | 1800 | 2600 | Package path | **REMOVE FROM MATURE PATH** |
| `minimumPackage` | **18000** | **25000** | Package floor | **REMOVE FROM MATURE PATH** |
| `waterproofing` | 1200 | 1800 | Catalogue lump; calc uses per-m² + min | **SUPERSEDE** as primary |
| `tilingPerM2` | 180 | 280 | Mixed tile+labour | **SUPERSEDE** (split) |
| `underfloorHeating` | 1500 | 2400 | Yes | **KEEP** as candidate UFH allowance; **NEEDS OWNER** |
| `fixtureInstall` | 1200 | 1800 | **Unused** | **REMOVE FROM MATURE PATH** |
| `vanity` | 900 | 1400 | Fixture lump | **SUPERSEDE** → PC |
| `shower` | 1200 | 1800 | Fixture lump | **SUPERSEDE** → PC |
| `toilet` | 700 | 1100 | Fixture lump | **SUPERSEDE** → PC |
| `plumbingMinor` | 1200 | 1800 | Yes | **KEEP** evidence; **NEEDS OWNER**; add Standard |
| `plumbingMajor` | 3500 | 5200 | Yes | Same |
| `electricalMinor` | 900 | 1400 | Yes | Same |
| `electricalMajor` | 2800 | 4200 | Yes | Same |
| `extractorFan` | 350 | 520 | Yes | Merge into electrical component + fixture PC |
| `wallLiningPerM2` | 45 | 68 | Yes | **SUPERSEDE** → sheets |
| `floorPrepMinor` | 400 | 600 | Lump | **SUPERSEDE** → substrate / levelling split |
| `waterproofingPerM2` | 90 | 140 | Hardcoded, not `resolveRate` | **RENAME** to catalogue m²; **NEEDS OWNER** |
| `waterproofingMinimum` | 1200 | 1800 | Yes | Owner call-out later; not silent floor |
| `tilingMinimum` | 2200 | 3400 | Yes | **REMOVE FROM MATURE PATH** as fake completeness |
| `coordinationAllowance` | 800 | 1200 | Multi-trade | **LOW VALUE**; optional labelled coordination — **NEEDS OWNER** if kept |

### 35.2 Catalogue / productivity / fitout

| Key | Decision |
| --- | --- |
| `scope.bathroom.m2` | **REMOVE FROM MATURE PATH** |
| `bathroom.waterproofing.allowance` | **SUPERSEDE** as primary money |
| `bathroom.tiling.m2` | **SUPERSEDE** (split material / install) |
| `bathroom.fixtures.allowance` | **SUPERSEDE** → per-fixture PC |
| `sheet.plasterboard.aqualine.each` | **REUSE** |
| `sheet.plywood.each` | **REUSE** slot; identity not 19 mm H3.2 |
| Fibre cement sheet | **NEW** later |
| `bathroom.labour_hours_per_m2` | **REMOVE FROM MATURE PATH** |
| `bathroom.demolition_hours_allowance` | **SUPERSEDE** if physical demo; until then lump **KEEP** labelled |
| `bathroom.waterproofing_hours_allowance` | **NOT DNA** / unused |
| `bathroom.tiling_hours_per_m2` | **NOT DNA** / unused |
| `FITOUT_BENCHMARKS.aqualineSheet` $26/38 | **REUSE** as researchable; **NEEDS OWNER** |
| `FITOUT_BENCHMARKS.plywoodSheet` $45/68 | Not 19 mm H3.2 — **SUPERSEDE** for substrate A |
| `DEMOLITION_BENCHMARKS.bathroomEach` | Nested waste/demo candidate — **NEEDS OWNER** |
| Starter rate `bathroom.waterproofing.allowance` | Keep seeding until split keys exist |

**Publicly researchable later (not invented here):** sheet merchant prices, 90×45 H1.2 $/lm, vinyl $/m², tile $/m². **Owner/business judgement:** plumbing/electrical intensity, tiler $/m², WP $/m², PC sums, productivity, call-out minima, coordination.

---

## 36. KEEP / REUSE / SUPERSEDE (summary)

See tables above. Headline:

- **KEEP:** overlap groups, access labour adjustment, sheet-count helper, Project Conditions, `resolveRate` pipeline, renovation as a **job** not a trade WA, ISD “plumbing is not a product WA”
- **REUSE:** Aqualine / plywood sheet keys, masonry-style `scope_text` facts, internal_walls nested paint XOR pattern, flooring wastage category, `calculateSheetCount` 2.88 m²
- **RENAME PRESENTATION:** mixed “Tiling allowance”, “Bathroom materials/finishes allowance”, Job Plan “Area” without L×W
- **SUPERSEDE:** package path, carpentry m² hours, lining $/m², floor-prep lump as substrate, mixed tiling rate, bundled fixtures allowance, quality×quantity
- **REMOVE FROM MATURE PATH:** silent 5 m², $18k min, tiling default-on, `scope.bathroom.m2`, unused 22 h/m², unused fixtureInstall $
- **NEEDS OWNER BENCHMARK:** every intensity / productivity / trade $ / PC in §46

---

## 37. Mature requirement structure

Emit `requirements` (factory WA-4). Line items remain money projection.

Builder Review may group **Bathroom linings** (Floor / Walls / Ceiling + labour total). Physical requirements stay **independent lines**.

| Group | Material | Labour | Subcontract | Allowance / PC | Physical authority | Rate authority |
| --- | --- | --- | --- | --- | --- | --- |
| **Demolition** | N/A | Strip hours | N/A | — | Floor / wall / ceiling / fixture count | Company labour → benchmark h → Pricing Required |
| **Framing & substrates** | 90×45 H1.2 lm; plywood or FC sheets | Framing h/lm; substrate h/m² | N/A | Levelling PC if used | Wall area × intensity; floor area × waste → sheets | Company → identity benchmark |
| **Linings** | Aqualine sheets wall + ceiling | Wall h/m²; ceiling h/m² | N/A | — | Gross wall; ceiling area | Sheet identity; labour productivity |
| **Waterproofing** | N/A (or primer if later) | N/A (sub) | WP $/m² | — | Floor + shower walls + selected | Quote → company → benchmark → PR |
| **Floor finish** | Tile m² **or** vinyl m² XOR | Builder vinyl hours if in-house | Tiler if tile | Vinyl/tile PC | Floor tile/vinyl area | Split material vs install |
| **Wall tiling** | Wall tile m² | N/A | Tiler $/m² | Tile PC | Extent × geometry or custom | Same split |
| **Plumbing** | N/A | N/A (unless builder-owned) | Hybrid allowance | — | Intensity + components, **not** m² | Quote → company → Quotr allowance → PR |
| **Electrical** | Fan/rail PC if builder-supplied | N/A | Hybrid allowance | UFH as component | Intensity + components | Same |
| **Fixtures** | Per-fixture PC | Builder install where owned | Trade install in plumbing/electrical | Explicit PC | Count × selection | PC ≠ quote |
| **Finishing** | Paint/stop only if nested | Nested or sibling | Stopping sub if nested | — | Lining areas | XOR sibling WAs |
| **Waste** | N/A | Handle if in-house | Skip/disposal | Coarse | Demo drivers | Company → benchmark |

Plant: **N/A** unless skip hire modelled as plant later — prefer waste kind.

---

## 38. Builder Review design

Builder must see:

- Room L × W × H and derived floor / ceiling / wall m² (or “not required for this scope”)
- Job scope (not only “Bathroom renovation”)
- What is being removed
- Sheet quantities (floor / wall / ceiling) as numbers, not only $
- Framing intensity + lm (when framing ≠ None)
- Floor finish XOR
- Floor tile m² and wall tile m² separately
- Waterproofing area and extent
- Fixture table: supply mode, PC, install owner
- Specialist allowances with **Minor/Standard/Major** and **editable scope text**
- Waste line if demo
- Assumptions with KNOWN / ASSUMED_DISCLOSED / INFO_REQUIRED
- Company vs benchmark vs PC vs Pricing Required
- Edit path (Refine + Job Plan chips)

No generic **$18k Bathroom package** line on the mature path. No raw `PACKAGE_FALLBACK` / component keys.

Job Plan today: area chip + reno + finish + demo/WP/tiling toggles. **Insufficient.** Expand in WA-BATHROOM-06, not now.

---

## 39. Variation readiness (do not design Variations)

Physical/allowance model **can** run with incomplete variation info **if** groups are composable.

Example: “Replace existing vanity and relocate basin plumbing.”

- Set job_scope `replace_vanity` (or custom flags)
- Fixture vanity supply+install
- Plumbing component: vanity/basin + relocation modifier + scope text
- **Do not** require L/W
- **Do not** emit tiling/WP/linings
- INFO_REQUIRED only if plumbing intensity unknown and no disclosed Minor default

Facts/requirements remain **additive per component**. Do not design VARIATIONS-V1 here.

---

## 40. Minimum-information rules

| Scope | Required | May assume (disclosed) | May stay absent |
| --- | --- | --- | --- |
| Vanity only | Vanity selected; supply mode | Standard vanity PC if Not sure | Room L/W/H; tiling; WP |
| Shower only | Shower type; WP yes/no | Standard shower size **only if disclosed** | Full room geometry if no reline/retile |
| Replace fixtures | Which fixtures | Per-fixture PC | Geometry |
| Retile floor | Floor area (L×W or m²); finish XOR | Wall height N/A | Wall/ceiling lining |
| Reline | L, W, H (or area+H with disclosed plan) | H = 2.4 m if Not sure | Fixtures |
| Strip-out only | Demo yes; what is stripped | Standard room **only if disclosed** | New finishes |
| Full reno / new fitout | Geometry; floor XOR; WP; plumbing/electrical intensity; demolition yes/no | H = 2.4; Standard finish PCs | Opening deductions; pack counts |

---

## 41. Question strategy

**Do not ask 20–35 Bathroom questions before estimating.** Progressive, scope-dependent. High-value only.

### Order (groups)

1. **Job scope** — what kind of bathroom job? (P0)
2. **Demolition** — strip existing? (P0 if not implied by full reno)
3. **Geometry** — L, W, H — **only if** a geometry-driven group is on (P0 for full/reline/retile; skip for vanity-only)
4. **Floor finish XOR** — if floor in scope (P0)
5. **Wall tiling extent** — if tiling in scope (P0). Custom m² only after extent = custom/partial
6. **Waterproofing extent** — if WP in scope (P0)
7. **Fixtures** — which + client vs contractor (P0 for fixture scopes; P1 for full reno)
8. **Plumbing intensity** — None / Minor / Standard / Major (P0 if services in scope)
9. **Electrical intensity** — same (P1 unless lighting/fan/UFH mentioned)
10. **Linings / substrate / framing intensity** — P1 after geometry; skip if not in job_scope
11. **Finish level** — P1 (inherit project quality if set)
12. **Subbie scope text** — P2 / Builder Review, not pre-estimate
13. **Tile format, plank size, opening deductions** — P2 / never-ask until consumed

Always **Not sure** → disclosed assumption or INFO_REQUIRED.

Refine adapter must only ask keys in the **consumed-fact contract**. Current Refine (demo + plumbing) is too thin for SUPPORTED; too random vs 20 templates.

---

## 42. Assumption strategy

| Unknown | Class |
| --- | --- |
| Length/width on full reno | **INFO_REQUIRED** (not silent 5 m²) |
| Wall height | **ASSUMED_DISCLOSED 2.4 m** on Not sure |
| Standard-room size | Only if user picks “typical ~2.0 × 2.5 m” (or owner-approved standard) — **ASSUMED_DISCLOSED**, never silent |
| Opening deductions | Assume **none** — disclose |
| Sheet waste | Org `sheet_material` % — disclose |
| Tile extent on full reno | **INFO_REQUIRED** (do not default tiling on) |
| Shower-only WP area | **INFO_REQUIRED** or disclosed shower-wall m² assumption (owner later) |
| Fixture product | **ASSUMED_DISCLOSED PC** by finish level |
| Plumbing intensity on full reno | **INFO_REQUIRED** or disclosed Standard if owner approves a default |
| Framing intensity | **INFO_REQUIRED** if linings/fixtures need support; None if existing frame remains |
| Pack counts / tile packs | Absent — m² primary |
| Specialist $ | Labelled allowance, never “quote” |

---

## 43. Calculator-module design

Do **not** grow one giant `bathroom.ts`. Follow Deck: thin calculator entry + domain modules.

Recommended (implementation phases, not now):

| Module | Owns |
| --- | --- |
| `lib/estimate/calculators/bathroom.ts` | Dispatch, consumed-fact export, composition |
| `lib/estimate/bathroom-scope.ts` | Job scope → which groups emit |
| `lib/estimate/bathroom-geometry.ts` | L×W×H, derived areas, no openings V1 |
| `lib/estimate/bathroom-demolition.ts` | Strip labour + waste drivers |
| `lib/estimate/bathroom-framing.ts` | Intensity → lm → hours + timber |
| `lib/estimate/bathroom-linings.ts` | Floor substrate, wall/ceiling sheets + labour |
| `lib/estimate/bathroom-floor-finish.ts` | XOR tile / vinyl / other |
| `lib/estimate/bathroom-tiling.ts` | Floor/wall tile m², material vs subcontract |
| `lib/estimate/bathroom-waterproofing.ts` | WP area + subcontract |
| `lib/estimate/bathroom-fixtures.ts` | Per-fixture PC + builder install |
| `lib/estimate/bathroom-specialist-allowances.ts` | Plumbing / electrical hybrid + scope_text |

Move current `resolveBathroom*` helpers **out of** `commercial-realism.ts` into geometry/tiling/WP modules when implemented (they are Bathroom-specific, not commercial-engine).

Shared primitives to **reuse**, not fork: `calculateSheetCount`, `calculateFlooringAreaWithWastage`, `resolveMaterialWastage`, `resolveRate`, requirement envelope helpers, overlap groups, Project Conditions labour factor.

---

## 44. Legacy compatibility

Existing Bathroom projects may have `bathroom.area_m2`, renovation_type, boolean includes_*, package snapshots.

| Rule | |
| --- | --- |
| Do **not** reinterpret old **estimate snapshots** | Historical money stays |
| New mature estimates may use **new requirement keys** | Allowed |
| `bathroom.area_m2` without L/W | Floor area KNOWN; derive nothing else; ask L/W only if job_scope needs plan |
| `renovation_type` Full / strip / rebuild | Dual-read → `full_renovation` |
| `renovation_type` Standard | Dual-read → `full_renovation` (legacy “standard reno” was a full package, not a partial scope) |
| `renovation_type` Minor / refresh | Dual-read → `fixture_replacement` |
| `tiling_included !== false` | **Legacy path only** (no `job_scope`). Mature path (`job_scope` present): `null ≠ yes` — tiling money only if `tiling_included === true`. Old snapshots unchanged |
| Package line `bathroom.materials_package` | Do not emit on mature path; old quotes keep their lines |
| Calibration `bathroom.standard_reno.v1` | Lump scenario — **SUPERSEDE** when DNA/physical tasks exist; do not use as mature fixture |

---

## 45. UI maturity recommendation

**Do not change UI in this audit.**

| When | Label |
| --- | --- |
| Now (stale) | `trial_supported` — **misleading vs Deck** |
| During WA-BATHROOM-02…07 (before hosted close) | **Beta / Coming** — not equal to Deck |
| After WA-BATHROOM-08 hosted close | **Available / Supported** (hybrid) or **Mature** only if factory WA-0…7+9 closed |
| First-run | Keep visible (beta demand) but must not imply Deck-grade until close |

`support-contract.ts` update is an implementation-phase UI chore, not 01.

---

## 46. Benchmark approval table

**Do not invent values in implementation until this table is owner-approved.**

| Item | Class | Notes |
| --- | --- | --- |
| Framing intensity Minor/Standard/Major (lm / wall m²) | **Owner / business** | No current key |
| Framing productivity (h/lm) | **Owner** | Pattern from internal_walls 0.8 is **not** approved for bathroom |
| 90×45 H1.2 $/lm | **Researchable material** then owner adopt | Do not copy deck H3.2 |
| Plywood 19 mm H3.2 sheet $ | **Researchable** | Current plywoodSheet is generic |
| Fibre cement 18 mm sheet $ | **Researchable** | No key |
| Aqualine 13 mm sheet $ | **Researchable** | Catalogue $26/38 unverified |
| Sheet waste % (wet area) | **Owner** (org setting exists) | Confirm bathroom vs general sheet |
| Floor / wall / ceiling lining h/m² | **Owner productivity** | No independent keys |
| Demolition h/m² and/or per fixture | **Owner** | Lump 8 vs code 10 conflict |
| Builder fixture install hours (vanity, bath, enclosure, mirror) | **Owner** | Not plumber tasks |
| Tiler subcontract $/m² | **Owner** | Split from current mixed $180 |
| Tile material PC $/m² by finish | **Owner PC** | |
| Waterproofing $/m² | **Owner** | Current $90 hardcoded |
| WP / tiler small-job call-out | **Owner** if any | Must be labelled |
| Plumbing Minor / **Standard** / Major base | **Owner** | Current Minor/Major only |
| Plumbing component modifiers | **Owner** | Zero until approved |
| Electrical Minor / Standard / Major | **Owner** | |
| Electrical components (fan, UFH, rail, new circuit) | **Owner** | |
| Fixture PC Standard / Mid / Premium (each fixture) | **Owner PC** | |
| Vinyl sheet $/m² | **Researchable + owner** | |
| Waste / skip allowance | **Owner** | |
| Coordination allowance | **Owner** if kept | |
| Standard-room disclosed size | **Owner** | Must not be silent 5 m² |
| Default wall height 2.4 m | **Owner confirm** | Common NZ; still disclosed |
| Shower-only wall m² assumption | **Owner** if used | Else INFO_REQUIRED |

Separate **merchant-researchable** from **business judgement**. Implementation of money for a row waits on approval.

---

## 47. Implementation phases

Preferred split (refined only where architecture requires):

| Phase | Scope | Exit |
| --- | --- | --- |
| **WA-BATHROOM-01** | This architecture / gap audit | **GO (this document)** |
| **WA-BATHROOM-02** | Facts + `job_scope` + geometry L/W/H + derived areas + kill silent 5 m² on **new** generates + consumed-fact contract + progressive questions | **GO** — see §53 |
| **WA-BATHROOM-03** | Physical substrates / linings / framing modules; sheet identities; independent labour keys (catalogued, owner values may still be missing → PR) | No floor-as-wall-area. No carpentry m² formula |
| **WA-BATHROOM-04** | Floor-finish XOR, vinyl, tiling geometry, tile material vs tiler, waterproofing area | No mixed tiling allowance as primary; no WP=tiling proxy |
| **WA-BATHROOM-05** | Per-fixture supply/install/PC; plumbing/electrical hybrid + Standard + scope_text | No bundled fixtures allowance; no plumbing $/m² |
| **WA-BATHROOM-06** | Demolition/waste; conditions; nested finish XOR; Builder Review / Job Plan / Refine | No buried waste; Review explainable |
| **WA-BATHROOM-07** | Owner-approved rates wired through `resolveRate`; kill $18k path; commercial proof | Company → benchmark → PR |
| **WA-BATHROOM-08** | DNA **candidates only where keys consumed**; mobile + hosted close; `verify-work-area-bathroom-maturity.ts` | Factory WA-9. DNA optional |

Do not start Internal Walls, Variations, or RFQ inside these phases.

---

## 48. Verifier plan

**Future file:** `scripts/verify-work-area-bathroom-maturity.ts`  
**Helper:** `scripts/lib/work-area-maturity-verifier.ts` (already exists)  
**Do not implement the Bathroom verifier in 01** (nothing to close).

The script must import the factory helper and prove:

1. `bathroom` is a product catalogue type; calculator registered
2. Fact / question / requirement / rate namespace `bathroom.` + allowed `sheet.` / `plant.`
3. **No foreign WA keys** priced (`internal_walls.`, `ceilings.`, `painting.`, `flooring.`, `demolition.` except documented XOR suppression)
4. Geometry fixture: known L×W×H → floor = L×W, ceiling = L×W, gross wall = 2(L+W)H
5. Missing geometry on full reno → INFO_REQUIRED / no silent 5 m² priced quantity
6. Vanity-only fixture → estimates **without** L×W; no tiling/WP lines
7. Floor-finish XOR: tile and vinyl not both full-room
8. Tiling: floor m² and wall m² independent; extent none → 0 wall tile
9. WP area ≠ all wall area unless extent says so
10. Sheet ceil: 2.88 m² sheets, waste once
11. Framing: no hours-per-floor-m² authority
12. Requirements union: material / labour / subcontract / waste present; plant N/A documented
13. Rate hierarchy: company sheet/labour wins; missing → PR not $18k package
14. Quality/finish does not multiply lining hours or tile m²
15. Sibling painting WA + bathroom nested paint off → no double paint
16. Sibling ceilings WA same-room → bathroom ceiling lining suppressed (fixture)
17. Sibling internal_walls partition + bathroom nogging → no double GIB
18. Builder Review compose: no `PACKAGE_FALLBACK`, shows m² and sheet counts
19. Isolation vs Deck (mature reference coexistence)
20. Mobile smoke (hosted, 08)

Until 07, a **static** audit script may assert current **gaps** still exist (optional). Not required for 01 close.

---

## 49. Cross-Work-Area isolation (planned)

| Sibling | Bathroom may | Bathroom must not |
| --- | --- | --- |
| `internal_walls` | Local nogging / wet lining | New partitions, dry GIB of that wall |
| `ceilings` | Nested bathroom ceiling lining | Other-room ceilings; same-room double lining |
| `painting` | Nested paint if no sibling | Paint when Painting WA owns the surface |
| `plastering` | Nested stopping if no sibling | Stopping when Plastering WA owns it |
| `flooring` | Nested floor finish XOR | Same-room floor when Flooring WA owns it |
| `demolition` | Nested strip-out | Second strip of the same bathroom |
| `kitchen` | Nothing | Kitchen plumbing/electrical |
| `deck` / `fence` / `rw` | Nothing | Any of their keys |

Overlap groups to preserve/extend: `bathroom_demolition`, `bathroom_tiling`, `bathroom_waterproofing`, `bathroom_plumbing`, `bathroom_electrical`, plus new `bathroom_floor_finish`, `bathroom_ceiling_lining`, `bathroom_framing`.

---

## 50. Constraints for this phase

- Preview DB `shhpjsoldmqtkdbgrbtm`, migrations through **054**
- Production through **045** — **DO NOT TOUCH**
- **No migration 055**
- No runtime product behaviour change in WA-BATHROOM-01

---

## 51. Related current code (authority)

| Concern | Location |
| --- | --- |
| Calculator | `lib/estimate/calculators/bathroom.ts` |
| Area helpers | `lib/estimate/commercial-realism.ts` (`resolveBathroom*`) |
| Hardcoded $ | `lib/estimate/benchmark-rates.ts` `BATHROOM_BENCHMARKS` |
| Catalogue rates | `lib/rates/catalogue.ts` |
| Sheet identities | `lib/rates/specific-material-catalogue.ts` |
| Productivity | `lib/estimate/productivity.ts` |
| Questions | `lib/scopes/templates/bathroom.ts` |
| Consumed facts | `BATHROOM_CALCULATOR_CONSUMED_FACTS` |
| Job Plan / Refine | `lib/assistant/job-plan/adapters/bathroom.ts`, `refine/adapters/bathroom.ts` |
| ISD relationships | `lib/scope-discovery/catalogue/relationships/bathroom.ts` |
| Analyse heuristic | `lib/ai/enrich-extraction.ts` `inferBathroom` |
| Stale UI band | `lib/work-areas/support-contract.ts` |
| Commercial detail test | `scripts/verify-stage-3-1b-bathroom-commercial-detail.ts` |

---

## 52. WA-BATHROOM-03 next action (exact)

Do not start until WA-BATHROOM-02 is reviewed.

1. Stay on `hardening/stage-2a-security`. Preview only. No migration 055.
2. Physical substrates / linings / framing modules. Sheet identities. Independent labour keys.
3. Stop using floor m² as wall-area / carpentry-hours authority.
4. Do **not** rewrite tiling, waterproofing, plumbing, electrical, or fixture PC money yet (those are 04–05).
5. Do not start Internal Walls, Variations, or RFQ.

---

## 53. WA-BATHROOM-02 implemented record

**GO.** Runtime is namespaced to Bathroom. Deck / Fence / RW / DNA / Billing / Security unchanged. Production untouched. No 055.

### Job-scope enum

`strip_out_only | vanity_only | shower_only | fixture_replacement | retile_floor | reline | new_fitout | full_renovation | custom`

Aliases: `replace_vanity` → `vanity_only`; `replace_shower` → `shower_only`; `replace_fixtures` → `fixture_replacement`.

### Legacy `bathroom.renovation_type`

| Stored | Dual-read `job_scope` |
| --- | --- |
| Full / strip / rebuild | `full_renovation` |
| Standard | `full_renovation` |
| Minor / refresh | `fixture_replacement` |

Do not mutate historical facts. Snapshots stay immutable.

### Geometry authority

| Key | Role |
| --- | --- |
| `bathroom.length_m` / `bathroom.width_m` | Preferred physical plan |
| `bathroom.wall_height_m` | KNOWN, or ASSUMED_DISCLOSED 2.4 m when full geometry is needed |
| `bathroom.floor_area_m2` / `ceiling_area_m2` / `gross_wall_area_m2` | Code-derived. AI must not own these. |
| `bathroom.area_m2` | Legacy floor evidence only. Never fabricate L/W from it. |

Math: floor = L×W; ceiling = L×W; gross wall = 2(L+W)×H. No opening deduction. Disclose openings only when wall area is shown.

### Minimum-information matrix (implemented)

| Scope | Geometry |
| --- | --- |
| `vanity_only` / `fixture_replacement` | Not required |
| `shower_only` | Not required unless tiling / lining / WP / floor finish selected → then full |
| `retile_floor` | Floor (L×W, `floor_area_m2`, `area_m2`, or floor tile m²) |
| `strip_out_only` | Floor |
| `reline` / `new_fitout` / `full_renovation` | Full. Height 2.4 m disclosed if missing / Not sure |
| `custom` | Full only if finish flags are on |

Direct known area suppresses redundant L/W questions.

### Question priority

| Class | Keys |
| --- | --- |
| **P0 HARD_MINIMUM** | `job_scope`, `length_m`, `width_m` (when geometry needed) |
| **P0 ASSUMABLE** | `demolition_required`, `wall_height_m` |
| **P1** | Floor finish, tiling, WP, fixtures, plumbing.level, electrical.level, linings, framing, finish |
| **P2** | Floor/wall tiling m², UFH |
| **P3 never-ask** | `area_m2`, `renovation_type`, `wall_tile_height`, legacy `plumbing_changes` / `electrical_changes` |

Unknown scope asks only `job_scope`. Known facts are not reasked. Quick Estimate does not run the old unconditional 20-question list.

### Assumptions

- Missing required L/W on geometry-driven scopes → INFO_REQUIRED: *Add the bathroom length and width so Quotr can calculate the room.*
- No hidden 5 m² on new / mature-path generates.
- Wall height Not sure or missing (when full geometry needed) → *Wall height assumed at 2.4 m.*
- Length/width are never invented from a silent standard room.

### Tiling-null decision

Mature path = `bathroom.job_scope` present → tiling money only if `tiling_included === true`. `null ≠ yes`. Legacy regenerate without `job_scope` keeps `!== false`. Snapshots immutable.

### Prepared (not priced) facts

`bathroom.floor_finish_system` (tile / sheet_vinyl / vinyl_plank / other / none), `bathroom.framing_level` (none / minor / standard / major), `bathroom.plumbing.level` and `bathroom.electrical.level` (none / minor / **standard** / major; Standard uses existing Minor $), `bathroom.waterproofing_extent` kept, `bathroom.tile_extent` remains canonical ( `wall_tile_height` is legacy refinement), `bathroom.demolition_required` preserved. Fixture catalogue unchanged.

---

## 54. WA-BATHROOM-03 physical substrates / linings / framing

**Status:** **GO** after deterministic verifier + hosted Preview proof (`d57f566`).

Verifier: `scripts/verify-work-area-bathroom-03.ts`

### Identities

| Role | Key |
| --- | --- |
| Floor substrate fact | `bathroom.floor_substrate_system` = `treated_plywood \| fibre_cement \| none \| other` |
| Wall lining | `bathroom.wall_lining_included` (Not sure → ASSUMED_DISCLOSED 13 mm GIB Aqualine) |
| Ceiling lining | `bathroom.ceiling_lining_included` |
| Framing level | `bathroom.framing_level` = `none \| minor \| standard \| major` (unknown → INFO_REQUIRED, never silent Standard) |
| Plywood | `sheet.plywood.19mm.h3.2.each` (new; no invented $) |
| Fibre cement | `sheet.fibre_cement.18mm.2400x1200.each` (new; no invented $) |
| Aqualine (wall and ceiling) | `sheet.plasterboard.aqualine.each` (reuse existing fitout identity) |
| Framing timber | `bathroom.framing.90x45.h1.2.lm` (not Deck H3.2 90×45) |
| Floor labour productivity | `bathroom.floor_substrate.install.hours_per_m2` = 0.40 |
| Wall labour productivity | `bathroom.lining.wall.install.hours_per_m2` = 0.30 |
| Ceiling labour productivity | `bathroom.lining.ceiling.install.hours_per_m2` = 0.40 |
| Framing labour productivity | `bathroom.framing.install.hours_per_lm` = 0.20 |

Requirement component keys: `bathroom.floor_substrate`, `bathroom.lining.wall`, `bathroom.lining.ceiling`, `bathroom.framing`, plus `.install` labour suffixes.

### Formulas

- Geometry authority: `resolveBathroomGeometry` (do not require persisted `floor_area_m2` / `gross_wall_area_m2`).
- Sheet waste once: purchase area = physical area × 1.10; sheets = ceil(purchase / 2.88). 2400 × 1200.
- Walls: no opening deductions. Disclose that fact when wall lining is emitted.
- Framing lm = gross wall area × intensity (`none` 0 / `minor` 0.20 / `standard` 0.50 / `major` 1.00). Exact derived lm; no 10% sheet waste on timber.
- Labour hours = physical qty × productivity. Money = hours × company carpenter $/h. No crew/8h minimum on these new hours.

### Scope rules

Component facts decide inclusion. `full_renovation` asks the questions; it does not auto-enable every physical component. Vanity-only emits none of these unless independently selected. Floor Not sure → disclosed 19 mm H3.2 plywood. Wall/ceiling Not sure → disclosed Aqualine.

### Legacy boundary

Mature path = stored `bathroom.job_scope`. Legacy regenerate without that fact keeps carpentry/prep hours, lining lumps, $400 floor-prep, and the $18k package. Historical snapshots unchanged. Mature path must not also price generic carpentry for the same substrate / lining / nogging work.

### Rate gaps

| Identity | Company rate | Quotr benchmark | Unit | Gap |
| --- | --- | --- | --- | --- |
| `sheet.plywood.19mm.h3.2.each` | no | no | each | NEEDS BENCHMARK / Pricing Required |
| `sheet.fibre_cement.18mm.2400x1200.each` | no | no | each | NEEDS BENCHMARK / Pricing Required |
| `sheet.plasterboard.aqualine.each` | maybe | yes ($26 / $38 fitout catalogue) | each | QUOTR BENCHMARK AVAILABLE — owner should confirm |
| `bathroom.framing.90x45.h1.2.lm` | no | no | lm | NEEDS BENCHMARK / Pricing Required |

Labour $ uses canonical `labour.carpenter.hour`. Do not invent material dollars.

### Sibling Work Area future isolation contract

Bathroom nested floor substrate / wall lining / ceiling lining may exist inside Bathroom. If a future explicit sibling Work Area (Internal Walls, Ceilings, Flooring) already owns that same selected surface in the same room, do not double-price. That XOR is **not** implemented here because those Work Areas are not matured. Do not treat “any Ceilings WA on the project” as suppress-Bathroom-ceiling.

### Next action after 03 GO

**WA-BATHROOM-04** — floor finish XOR (tile / sheet vinyl / vinyl plank) as distinct from floor substrate. No tiling subcontract money rewrite beyond what 04 owns. Do not start Internal Walls, Variations, or RFQ.

# FOUNDATION-R2 — Scope Details question audit

**Classification:** HISTORICAL / SUPPORTING evidence for the Scope Details contract.  
**Status:** Complete Local / Owner Preview Pending (2026-08-16)  
**Contract:** `docs/architecture/QUOTR_SCOPE_DETAILS_QUESTION_CONTRACT.md`  
**Gaps:** `docs/audits/FOUNDATION_R2_CALCULATOR_INPUT_GAP_MATRIX.md`  
**Completion:** `docs/implementation/FOUNDATION_R2_SCOPE_DETAILS_COMPLETION.md`  
**Not customer-facing.** Do not render this matrix in UI.

**R1-R1 Owner PASS (prerequisite):** Owner manually tested live Preview and confirmed Project Conditions order, sole PC surface, and Generate blocked until required PC resolved. Recorded as Complete — Owner Preview Validated. No extra R1-R1 test evidence fabricated.

**Boundaries:** No REQ-1, no requirement emission, no Deck takeoff, no catalogue expansion, no calculator rewrite beyond trivial wiring (none performed), no Production deploy.

Legend: **REQ** required · **OPT** optional · **COND** hidden until parent · **CALC** current calculator consumer · **P/M/L/S/Q** price / material / labour / scope / quote · **PC?** project-condition duplicate · **A–H** contract drivers.

---

## 0. Programme actions this batch

| Action | Count / keys |
| --- | --- |
| **ADDED** | `bathroom.waterproofing_extent`; `kitchen.island_included`, `island_length_m`, `cabinetry_lm`, `benchtop_material`; `retaining_wall.post_spacing_m`; `pergola.height_m`; `internal_walls.fire_or_acoustic`; `fence.post_spacing_m`, `paling_or_panel_type`, `gate_width_m` |
| **REMOVED** | None from current templates (PC clones already removed in R1) |
| **REWORD** | Deck, bathroom fixtures, demolition, stairs, fence finish, kitchen inclusions, pergola material/finish, plastering complexity, ceilings working height, retaining disposal |
| **MAKE REQUIRED** | `bathroom.waterproofing_included` (Owner: remains REQUIRED; copy “Is waterproofing required?”) |
| **MAKE CONDITIONAL / AUTO-DERIVE** | Deck area from L×W; deck.level from height; waterproofing extent; wall tile height vs floor-only; kitchen benchtop material / island length / cabinetry lm; retaining disposal vs excavation; demo quantities vs scope items; fence gate width |
| **MOVE TO PC** | None (already moved in R1) |
| **DEFER** | Deck irregular geometry; board gap/orientation/thickness; joist/bearer sizes; F/R/L/R fascia (OD-FACE-01); fence rail count / post size; kitchen cabinet counts by type; fire-system child graph |

No WA maturity promotion. `commercial_fitout` is not audited as a calculator WA.

---

## 1. Deck (trial-supported)

Order: geometry → height → decking → existing/demo → stairs/fascia → balustrade → substructure → consent. `deck.pergola_included` always hidden.

| KEY | CUSTOMER QUESTION | REQ? | COND? | FACT | CALC? | P | M | L | S | Q | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deck.length_m | What is the deck length? | Y | | deck.length_m | Y | Y | Y | Y | Y | Y | N | KEEP |
| deck.width_m | What is the deck width? | Y | | deck.width_m | Y | Y | Y | Y | Y | Y | N | KEEP |
| deck.area_m2 | Approximate deck area? | Y | Hide if L and W known | deck.area_m2 | Y | Y | Y | Y | Y | Y | N | AUTO-DERIVE |
| deck.height_m | Approximate deck height above ground? | Y | | deck.height_m | Y | Y | | Y | Y | Y | N | KEEP |
| deck.level | Ground-level or elevated? | N | Hide if height known | deck.level | Y | Y | | Y | Y | | N | AUTO-DERIVE |
| deck.board_material | What decking is being used? | Y | | deck.board_material | Y | Y | Y | | Y | Y | N | REWORD |
| deck.board_width_mm | What decking board width? | N | | deck.board_width_mm | Y | Y | Y | | | | N | KEEP |
| deck.existing_deck_removal | Does the existing deck need removing? | N | | deck.existing_deck_removal | Y | Y | | Y | Y | Y | N | REWORD |
| deck.access_type | Steps, stair set, or no stairs? | N | Hide if height ≤ 0.2 m | deck.access_type | Y | Y | | Y | Y | Y | N | KEEP (local stairs, not site access) |
| deck.vertical_face_boards_required | Vertical boards/fascia required? | N | | …_required | Y | Y | Y | Y | Y | Y | N | KEEP |
| deck.vertical_face_board_length_lm | Total length of vertical face boards? | N | Hide until fascia = Yes | …_length_lm | Y | Y | Y | Y | | | N | KEEP |
| deck.balustrade_required | Is a balustrade required? | N | Hide if height ≤ 1 m or explicit No | …_required | Y | Y | Y | Y | Y | Y | N | KEEP |
| deck.handrail_required | Handrail without full balustrade? | N | Hide if balustrade = Yes | …_required | Y | Y | | Y | Y | Y | N | KEEP |
| deck.substructure_included | Is new framing included? | N | | …_included | Y | Y | Y | Y | Y | Y | N | REWORD |
| deck.pile_or_post_replacement_required | Piles/posts/members replaced? | N | Gated on height/removal/framing | …_required | Y | Y | Y | Y | Y | | N | KEEP |
| deck.pile_or_post_count | Number of piles or posts to replace? | N | Hide until replacement = Yes | …_count | Y | Y | Y | Y | | | N | KEEP |
| deck.substructure_condition | Existing substructure condition? | N | Gated | …_condition | Y | Y | Y | Y | Y | Y | N | KEEP (option values unchanged) |
| deck.engineering_or_consent_status | Consent or engineering? | N | | …_status | Y notes | | | | Y | Y | N | REWORD (WA-optional) |
| deck.pergola_included | Pergola included in this estimate? | N | Always hidden | …_included | N | | | | | | N | KEEP hidden |

**Deferred (not added):** irregular vs rectangular; board thickness/gap/orientation; coating; joist/bearer sizes; F/R/L/R edges (OD-FACE-01).

**Future support:** geometry → board lm / area; removal → demo labour; material/width → MaterialRequirement; substructure/piles → labour + timber; fascia lm → DECK-2; stairs/balustrade → inclusions.

## 2. Bathroom (trial-supported)

| KEY | QUESTION | REQ? | COND? | CALC? | IMPACT | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bathroom.area_m2 | Floor area? | Y | | Y | B/C/G | N | KEEP |
| bathroom.renovation_type | Renovation type? | Y | | Y | A/G | N | KEEP |
| bathroom.demolition_required | Strip-out included? | Y | | Y | A/D/G | N | KEEP |
| bathroom.fixtures_client_supplied | Client supplying fixtures? | Y | | Y | A/C/H | N | REWORD |
| bathroom.fixtures_included | Which contractor fixtures? | N | Hide if client-supplied | Y | A/C/G | N | KEEP |
| bathroom.waterproofing_included | Waterproofing included? | Y | | Y | A/C/D/G | N | MAKE REQUIRED |
| bathroom.waterproofing_extent | Where is waterproofing required? | N | Hide until WP = Yes | **E** | C/D | N | ADDED |
| bathroom.tiling_included | Tiling included? | N | | Y | A | N | KEEP |
| bathroom.floor_tiling_area_m2 | Floor tiling area? | N | Hide until tiling = Yes | Y | B/C | N | KEEP |
| bathroom.wall_tiling_area_m2 | Wall tiling area? | N | same | Y | B/C | N | KEEP |
| bathroom.tile_extent | Tiling extent? | N | same | Y | A/C | N | KEEP |
| bathroom.shower_type | Shower type? | N | Hide if fixtures omit shower | Y | A/C | N | KEEP |
| bathroom.wall_tile_height | Wall tiling height? | N | Hide if tiling off or floor-only/splashback | Y | B/C | N | MAKE CONDITIONAL |
| bathroom.ventilation_included | Extractor included? | N | | Y | A/E/G | N | KEEP |
| bathroom.wall_lining_included | Wall lining included? | N | | Y | A/C | N | KEEP |
| bathroom.floor_prep_included | Floor levelling included? | N | | Y | A/D | N | KEEP |
| bathroom.underfloor_heating_included | UFH included? | N | | Y | A/G | N | KEEP |
| bathroom.plumbing_changes | Plumbing change level? | N | | Y | A/E/G | N | KEEP |
| bathroom.electrical_changes | Electrical change level? | N | | Y | A/E/G | N | KEEP |
| bathroom.finish_level | Finish level? | Y | | Y | G/H | N | KEEP (priority 80, finishes last) |

No site-access/logistics. Wall area derivation deferred. Tile size/complexity deferred (not justified for current calculator).

## 3. Retaining wall (developing)

| KEY | QUESTION | REQ? | COND? | CALC? | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- |
| retaining_wall.length_m | Wall length? | Y | | Y | N | KEEP |
| retaining_wall.is_raking | One end higher? | Y | | Y | N | KEEP |
| retaining_wall.height_m | Average height? | Y | Hide if derived / raking highs+lows | Y | N | KEEP |
| retaining_wall.height_high_m / height_low_m | High/low end? | Y | Hide unless raking = Yes | Y | N | KEEP |
| retaining_wall.fixing_type | Face-fixed or post-and-rail? | Y | | Y | N | KEEP |
| retaining_wall.material | Material? | Y | | Y | N | KEEP |
| retaining_wall.post_spacing_m | Post spacing? | N | | **E** | N | ADDED |
| retaining_wall.drainage_required | Drainage behind wall? | Y | | Y | N | KEEP |
| retaining_wall.drain_connection_required | Cesspit / existing drain? | N | Hide until drainage = Yes | Y | N | KEEP |
| retaining_wall.backfill_* | Backfill + dims | N | Dims hide until backfill = Yes | Y | N | KEEP |
| retaining_wall.excavation_required | Excavation required? | N | | Y | N | KEEP |
| retaining_wall.disposal_included | Spoil disposal with excavation? | N | Hide until excavation = Yes | Y | N | REWORD + CONDITIONAL |
| retaining_wall.engineering_or_consent_status | Engineering/consent? | N | | notes | N | KEEP |

**Deferred:** geotextile, capping, corners/returns, post size, sleeper type, poor-ground (PC if site-wide). No cart/access clone.

## 4. Fence (developing)

| KEY | QUESTION | REQ? | COND? | CALC? | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- |
| fence.length_m / height_m / material | Geometry + system | Y | | Y | N | KEEP |
| fence.post_spacing_m | Post spacing? | N | | **E** | N | ADDED |
| fence.paling_or_panel_type | Palings or panels? | N | | **E** | N | ADDED |
| fence.demolition_required | Remove existing fence? | N | | Y | N | KEEP |
| fence.gate_included | Gate included? | N | | Y | N | KEEP |
| fence.gate_count | How many gates? | N | Hide until gate = Yes | Y | N | KEEP |
| fence.gate_width_m | Gate width? | N | Hide until gate = Yes | **E** | N | ADDED |
| fence.slope_condition | Fence-line slope? | N | | Y | N | KEEP (local) |
| fence.disposal_required | Disposal of removed fencing? | N | Hide until demo = Yes | Y | N | KEEP |
| fence.boundary_approval_status | Neighbour/boundary approval? | N | | notes | N | KEEP |
| fence.services_risk | Fence-line underground services? | N | | Y | N | KEEP (local) |
| fence.finish_required / type / sides | Paint/stain | N | type/sides until finish = Yes | Y | N | REWORD |

**Deferred:** rail count, post size (assumable). No general access/carry.

## 5. Pergola (developing)

| KEY | QUESTION | REQ? | COND? | CALC? | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- |
| pergola.length_m / width_m | L / W | N | Hide if area known | Y | N | KEEP |
| pergola.area_m2 | Area | Y | | Y | N | KEEP |
| pergola.height_m | Height | N | | **E** | N | ADDED |
| pergola.material | Material | Y | | Y | N | REWORD |
| pergola.attached | Attached or free-standing | Y | | Y | N | KEEP |
| pergola.roofing_included / type | Roof/cover | N | type until included | Y | N | KEEP |
| pergola.footings_required | Post footings | N | Hide if attached | Y | N | KEEP |
| pergola.gutters_included | Gutters | N | | Y | N | KEEP |
| pergola.tie_in_existing | Tie-in | N | | Y | N | KEEP |
| pergola.engineering_or_consent_status | Consent | N | | notes | N | KEEP |
| pergola.finish_required / type | Finish | N | type until required | Y | N | REWORD |

**Deferred:** post/beam/rafter sizes and spacings (calculator cannot consume). No project logistics.

## 6. Kitchen (developing)

| KEY | QUESTION | REQ? | COND? | CALC? | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- |
| kitchen.area_m2 | Area | Y | | Y | N | KEEP |
| kitchen.renovation_type | Scope type | Y | | Y | N | KEEP |
| kitchen.finish_level | Finish level | Y | | Y | N | KEEP |
| kitchen.demolition_required | Strip-out | Y | | Y | N | KEEP |
| kitchen.flooring_* | Flooring yes / area / type | mixed | area/type until included | Y | N | KEEP |
| kitchen.island_included | Island included? | N | | **E** | N | ADDED |
| kitchen.island_length_m | Island length? | N | Hide until island = Yes | **E** | N | ADDED |
| kitchen.cabinetry_included | Cabinetry included? | N | | Y | N | REWORD |
| kitchen.cabinetry_lm | Linear metres? | N | Hide until cabinetry = Yes | **E** | N | ADDED |
| kitchen.cabinetry_client_supplied / type | Supply / type | N | type gated | Y | N | KEEP |
| kitchen.splashback_* | Splashback | N | area until included | Y | N | KEEP |
| kitchen.benchtop_included | Benchtop included? | N | | Y | N | REWORD |
| kitchen.benchtop_material | Benchtop material? | N | Hide until benchtop = Yes | **E** | N | ADDED |
| kitchen.rangehood_included | Rangehood? | N | | Y | N | KEEP |
| kitchen.appliances_* | Appliances + client | N | client until included | Y | N | REWORD |
| kitchen.plumbing_changes / electrical_changes | Services level | N | | Y | N | KEEP |

No access/carry/floor-level/occupancy/hours. Calculator too coarse to consume island/lm/benchtop material — recorded as **E**, not wired.

## 7. Demolition (component) — DC-01 preserved

| KEY | QUESTION | REQ? | COND? | CALC? | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- |
| demolition.scope_items | What is being demolished? | Y | | Y | N | REWORD |
| demolition.area_m2 | Total area | N | | Y | N | KEEP |
| demolition.wall_length_m | Wall length to remove | N | Hide until walls in scope | Y | N | MAKE CONDITIONAL |
| demolition.floor_area_m2 | Floor area to remove | N | Hide until floor in scope | Y | N | MAKE CONDITIONAL |
| demolition.ceiling_area_m2 | Ceiling area to remove | N | Hide until ceiling in scope | Y | N | MAKE CONDITIONAL |
| demolition.disposal_included | Waste removal included? | Y | | Y | N | KEEP (local disposal decision) |
| demolition.skip_bin_included | Skip included in this demolition scope? | N | Hide until disposal = Yes | Y | N | REWORD (not `waste_bin_access`) |
| demolition.salvage_required | Salvage required? | N | | Y | N | KEEP |

**Not present (correct):** `demolition.access`, `carting_distance_m`, `floor_level`, `services_isolated`, `hazardous_materials_risk`. Dead conditional branches for those keys remain harmless.

## 8. External stairs (component) — DC-02 preserved

| KEY | QUESTION | REQ? | COND? | CALC? | PC? | ACTION |
| --- | --- | --- | --- | --- | --- | --- |
| external_stairs.existing_removal | Remove existing stairs? | N | | Y | N | KEEP (priority 5) |
| external_stairs.risers_count | How many risers? | N | | Y | N | REWORD |
| external_stairs.total_rise_m | Total rise? | N | Hide if riser count known | Y | N | KEEP |
| external_stairs.width_m | Stair width? | N | Hide until rise or risers known | Y | N | KEEP |
| external_stairs.material / stringer_type | System | N | | Y | N | REWORD material |
| external_stairs.landing_* | Landing yes / area / count | N | area/count until landing = Yes | Y | N | KEEP |
| external_stairs.handrail_included / balustrade_included | Handrail / balustrade | N | | Y | N | KEEP |
| external_stairs.ground_condition | Ground at stair | N | | Y | N | KEEP (local) |
| external_stairs.consent_or_engineering_status | Consent | N | Hide if small rise | notes | N | KEEP |
| external_stairs.finish_required / type | Finish | N | type until required | Y | N | KEEP |

No general project access/carry.

## 9. Commercial components

`commercial_fitout` is **not** a product WA. Components below. No access/carry/floor/occupancy/hours clones.

### Internal walls

| KEY | QUESTION | REQ? | COND? | CALC? | ACTION |
| --- | --- | --- | --- | --- | --- |
| length_lm / height_m | Geometry | Y | | Y | KEEP |
| demolition_included | Remove existing | N | | Y | KEEP (earlier priority) |
| framing_type | Framing type | Y | | Y | KEEP |
| wall_lining_type / plasterboard_type / lining_sides | Linings | Y | PB type until plasterboard | Y | KEEP |
| fire_or_acoustic | Fire or acoustic rating? | N | | **E** | ADDED (no fire-system children) |
| skirtings / skirting_length_lm | Skirtings | N | length until included | Y | KEEP |
| stopping_included / painting_included | Finishes | N | painting hide if painting WA confirmed | Y | KEEP |
| insulation_included | Insulation | N | | Y | KEEP |

**Deferred:** stud size/gauge, centres, openings, junctions (calculator cannot consume).

### Ceilings

Geometry, structure, lining, edges, demo, battens, stopping, painting, insulation, **working height** (`ceilings.access` — not site logistics). KEEP + REWORD working-height copy.

### Doors

Count, existing removal (priority 18), type, supply, prehung, frames/hardware gated on prehung, architraves, client hardware, painting. KEEP.

### Flooring

Area, type, supply, client, removal, prep, underlay (type-gated), scotia, disposal (until removal), subfloor, stairs/landings gated. KEEP.

### Painting

Location, surfaces, internal/external areas (location-gated), coats, primer, prep, door painting + count, joinery surround + lm, client paint. REWORD coats. KEEP.

### Plastering

Area, level, surface, complexity, sanding. REWORD complexity. KEEP.

---

## 10. AI / Fact suppression

Unchanged engine: answered Facts (including explicit No) suppress re-ask. Aliases added: `kitchen.has_island` → `island_included`; `bathroom.waterproofing_scope` → `waterproofing_extent`; fence post/panel aliases. User-confirmed Facts are not in the AI overwrite drop list. No new AI calls.

## 11. Project Conditions regression

Re-checked R1-R1 contract across modified templates: no `site_access`, carry, floor_level, occupancy, working_hours, parking, general waste logistics, general services isolation, general hazmat, or general site slope reintroduced. Fence slope/services and ceilings working height remain local and named differently.

## 12. Maturity after audit

No promotion. Deck/Bathroom stay trial-supported. Retaining/Fence/Pergola/Kitchen stay developing. Commercial set stays component. See gap matrix for requirement-emission classes.

## 13. Estimate output

No calculator formula changes. No requirement objects emitted. Totals change only if a user now answers a newly required/visible question that the calculator already consumed (`bathroom.waterproofing_included` was already consumed when present). Making waterproofing required does not change the formula; it stops treating “unanswered” as an implicit skip.

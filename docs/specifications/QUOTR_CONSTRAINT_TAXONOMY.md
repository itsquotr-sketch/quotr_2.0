# Quotr Constraint Taxonomy

**Status:** Stage 3.2.0-R1 specification (conceptual)  
**Date:** 2026-08-12  
**Resolves planning for:** DEF-7E-004 / FEAT-003  
**Does not:** add migrations or change estimate formulas in this stage  

Current implementation: `lib/assistant/constraint-templates.ts` + `RESERVED_CONSTRAINT_KEYS` in `lib/scopes/domain-ownership.ts`.

**Schema verdict (R1):** `constraints.key` is free `text` in DB. Expanding taxonomy is an **application allowlist** change (`RESERVED_CONSTRAINT_KEYS` + templates). **No migration required** unless Owner later wants a DB CHECK enum.

---

## 1. Purpose

Define which site/construction conditions deserve **structured project-level constraints**, which belong as **Work-Area Facts**, which stay **future**, and which should remain **unstructured**.

Builder Interview asks many of these; **constraints table** remains the project-wide persistence namespace for flat keys (3.1D).

---

## 2. Current CORE (live today — 14 keys)

| Key | Required today | Category | Keep |
| --- | --- | --- | --- |
| `site_access` | Y | access_movement | CORE MVP |
| `floor_level` | N | height_levels | CORE MVP |
| `material_carry_distance` | Y | access_movement | CORE MVP |
| `waste_bin_access` | N | storage_deliveries | CORE MVP |
| `services_isolated` | N | site_operations | CORE MVP |
| `occupied_site` | N | site_operations | CORE MVP |
| `working_hours` | Y | security_working | CORE MVP |
| `hazardous_materials_risk` | N | environmental / risk | CORE MVP |
| `parking_loading` | N | storage_deliveries | CORE MVP |
| `protection_dust_control` | N | environmental | CORE MVP |
| `client_supplied_items` | N | commercial_context | CORE MVP |
| `by_others_trades` | N | trade_interfaces | CORE MVP |
| `consent_engineering` | N | compliance | CORE MVP |
| `site_slope` | N | site_conditions | CORE MVP |

---

## 3. Classification of proposed additions

Potential Owner language (DEF-7E-004):

restricted access, carry distance, stairs, lift, floor level, loading zone, occupied site, restricted working hours, noise restrictions, dust controls, protection requirements, live services, temporary access, storage limitations, delivery restrictions, wet-weather exposure, slope, confined working area.

### 3.1 CORE MVP (add via interview-aligned taxonomy — phased)

Add only if they materially change labour/logistics and are commonly answerable on site:

| Proposed key | Rationale | Notes |
| --- | --- | --- |
| `stairs_access` | Stairs vs flat carry changes labour | Distinct from deck `access_type` |
| `lift_available` | Vertical logistics | Boolean / select |
| `loading_zone` | Refine `parking_loading` or sibling | Prefer sibling if semantics differ |
| `noise_restrictions` | Occupied / commercial hours nuance | Beyond simple working_hours |
| `storage_on_site` | Materials staging limits | Logistics labour |
| `live_services` | Risk distinct from “isolated?” | Especially fitout/reno |

**Phasing recommendation:** implement interview ask-layer on **existing 14** first (3.2.2); add CORE MVP expansions only after Owner re-approves phased keys. **3.2.1 did not expand taxonomy** (D4).

### 3.2 WORK-AREA-SPECIFIC (Facts, not new constraints)

| Topic | Representation |
| --- | --- |
| WA-only harder access | `{wa}.access` override |
| Demolition carting metres | `{wa}.carting_distance_m` when project band insufficient |
| Demolition floor level exception | `{wa}.floor_level` |
| Ceiling height/access | `ceilings.access` (height semantics) |
| Deck stair/step access type | `deck.access_type` (product access, not site stairs) |

### 3.3 FUTURE

| Topic | Why defer |
| --- | --- |
| `temporary_access` / scaffold class | Needs commercial consumption design |
| `delivery_windows` | Scheduling-heavy; low estimate MVP value |
| `wet_weather_exposure` | Method statements vary widely |
| `confined_working_area` | Hard to quantify without formula design |
| `dust_controls` separate from protection | Merge with `protection_dust_control` for now |
| Fire/seismic structured constraints | Prefer scope/catalogue until assemblies (3.3) |

### 3.4 NOT WORTH STRUCTURING

| Topic | Prefer |
| --- | --- |
| Narrative client politics | Free text notes |
| Exact scaffold brand | Assume / exclude |
| One-off funny site stories | Notes |
| Generic “be careful” | Not a field |
| Duplicate “restricted access” vs `site_access` | Use existing `site_access` bands |

---

## 4. Consolidation rules

1. **One canonical project answer** for access, carry, floor, occupied, hours, parking/loading, protection defaults.  
2. Do not ask the same semantic question in Scope Details **and** Constraints **and** Interview.  
3. WA Facts for access/carting become **overrides**, not primary capture, once interview is live.  
4. Expanding taxonomy does **not** automatically create estimate modifiers — consumption is a separate, formula-safe batch (must not ship silent commercial changes).
5. **Direction:** interview/site topics → **constraints** persistence; do not reverse-sync constraints into Fact SoT. Optional Facts→constraint **seed helpers** (e.g. unused `inferConstraintsFromFacts`) are not SoT.
6. **Suppress naming (fixed in 3.2.2):** live loaders use `constraints`; occupied suppress uses canonical `occupied_site`.

---

## 5. Presentation categories (UI)

Keep existing presentation buckets; map new CORE keys into:

- access_movement  
- height_levels  
- site_operations  
- storage_deliveries  
- environmental  
- security_working  
- compliance  
- other  

---

## 6. Relation to Builder Interview

| Layer | Role |
| --- | --- |
| Taxonomy keys | Persistence + suppress identity |
| Interview registry | When/why to ask; priority; assume policy |
| Scope Details | Stop re-asking canonical project topics |
| Estimate engine | Unchanged until explicit consumption work |

---

## 7. Owner decision linkage

**D4** — constraint taxonomy scope for first implementation:

**Recommended:** Keep current 14 as CORE; approve stairs/lift/loading/noise/storage/live_services as **phased CORE MVP additions**; defer temporary access, delivery windows, wet weather, confined space; never structure narrative fluff.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md` |
| Backlog | FEAT-003, DEF-7E-004 |

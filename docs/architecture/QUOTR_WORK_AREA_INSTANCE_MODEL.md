# Quotr Work Area Instance Model

**Status:** CANONICAL — ESTIMATING-FOUNDATION-02  
**Date:** 2026-09-10  
**Branch:** `hardening/stage-2a-security`  
**Production / migration 055:** DO NOT TOUCH  
**Preview schema:** through **056**. This phase adds **no migration**.

This is the product hierarchy for repeating work and nested construction. It does not start Ceilings, Doors, Painting rooms, or Flooring groups as new calculators.

---

## 1. Hierarchy

```
PROJECT
  → WORK AREA INSTANCE
    → WORK ITEM / ASSEMBLY / TYPE
      → COMPONENT
        → REQUIREMENT
```

| Level | Meaning | Identity | Repeats? |
| --- | --- | --- | --- |
| **Project** | One job | `projects.id` | — |
| **Work Area Type** | Calculator / domain (`bathroom`, `internal_walls`, `deck`) | catalogue `type` | Not unique per project |
| **Work Area Instance** | One logical piece/location of work | `work_areas.id` (UUID) | Yes, including same type |
| **Nested item / assembly / type** | Variant inside an instance (Wall Type, later Door Type) | UUID inside the instance fact JSON | Yes, inside one instance |
| **Component** | Framing, lining, fixture, finish | namespaced fact / component key | Nested |
| **Requirement** | Material / labour / plant / waste line | `workAreaId` + kind + component + optional `variantKey` | Provenance stays on the instance |

Work Area Type describes the calculator. It is **not** unique per Project.

---

## 2. Storage (no migration)

`work_areas` (migration 002): `id` PK, `project_id`, `type`, `name`, `status`. **No unique constraint on `(project_id, type)`.** Duplicate kinds are already legal in the database.

`project_facts`: unique on `(project_id, work_area_id, key)` when `work_area_id` is set. Facts are instance-scoped when bound to `work_area_id`.

Do not invent a second Work Area table. Do not flatten Wall Types into extra Internal Walls rows.

---

## 3. When to create another Work Area Instance

Create a **new instance** when scope is separable by:

- location / room
- client scope grouping
- commercial package
- significantly independent job context

Examples:

- Bathroom — Master Ensuite vs Bathroom — Main Bathroom
- Deck — Rear Deck vs Deck — Front Entry Deck
- Internal Walls — Ground Floor Office vs Internal Walls — Upstairs Tenancy

## 4. When to use nested items

Use a **nested item/type** when several physical variants form **one** logical Work Area.

Example: Internal Walls — Ground Floor contains Wall Type A (Standard/Standard) and Wall Type B (Standard/Aqualine).

Do **not** duplicate Work Areas merely because construction differs.

---

## 5. Domain examples

### Internal Walls (implemented)

```
Internal Walls instance
  → Wall Types[]
    → faces / openings / components
      → requirements (variantKey = Wall Type id)
```

Wall Types are **not** separate Work Areas by default.

### Bathroom (implemented as instances)

Each logically separate bathroom/room is normally its **own Bathroom instance**. Fixtures and local finishes stay nested **inside** that instance. Ownership: bathroom-local painting stays on the bathroom; a whole-house Painting instance must not double-count the same paint (WORK-AREA-COORDINATION-01).

### Future (do not implement here)

| Type | Instance | Nested items |
| --- | --- | --- |
| Doors | One doors group / location | Door Types |
| Painting | One paint package / building | rooms / surface groups |
| Flooring | One flooring package | floor finish / area groups |
| Ceilings | One ceiling package | Ceiling Types / areas |

---

## 6. Labels

`work_areas.name` is the builder-readable instance label. Optional.

Defaults may remain catalogue names (`Bathroom`, `Internal walls`). If the same kind appears twice without distinct labels, UI numbers them (`Bathroom 1`, `Bathroom 2`) without rewriting storage unless the add-flow generated a name.

---

## 7. Fact and requirement provenance

Facts must be attributable to `workAreaId`, not only `bathroom.*`.

Requirements already carry `workAreaId` and optional `variantKey` (Wall Type UUID). Builder Review groups by Work Area Instance name. Pricing and Quote already key off `work_area_id` / work area name — compatible; no Quote redesign.

Type-only extraction facts (`work_area_type` without instance name) bind to the **first** instance of that type so legacy briefs keep working. Named instances receive facts with `work_area_name` / `work_area_instance`.

---

## 8. Manual add

**Add another Work Area** may add another Bathroom, Deck, or Internal Walls even when that type already exists. The new row gets a distinct label (`Bathroom 2`, …). Edit / Delete / Details / estimate provenance are per `work_areas.id`.

Scope-discovery **accept RPC** (migration 029) still rejects a second confirmed row of the same type (`DUPLICATE_WORK_AREA`). That is SQL application logic, not a uniqueness constraint. No migration in this phase. Analyse + manual add are the instance paths.

---

## 9. Readiness

Details Ready and Create Estimate share `evaluateGenerateEstimatePermission`.

Unresolved **required** Project Conditions consumed by selected calculators (`site_access`, `material_carry_distance`) are initial capture. They must be asked **before** Ready.

Optional Internal Walls finish (openings, insulation, skirting, cornice, electrical, stopping, painting) stays unresolved until answered. Absence is not Include and is not Not Included. It does not block Ready.

Estimate-time recovery is not the normal capture path.

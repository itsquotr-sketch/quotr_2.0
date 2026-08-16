# Project Conditions — Single Authority Audit

**Status:** Audit complete (2026-08-15). **IMPLEMENTED in FOUNDATION-R1.** **FOUNDATION-R1-R1** added applicability filtering, remaining canonical ASK keys, and Generate hard-block (UI + server). **FOUNDATION-R2** re-verified no Project Condition reintroduction in Scope Details.  
**Implementation:** `docs/implementation/FOUNDATION_R1_PROJECT_CONDITIONS_SUPPORT_COMPLETION.md`  
**R1-R1:** `docs/implementation/FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md`  
**HEAD (audit baseline):** `f168fe0ec8a857fffa79888435ca90b9e8a1db25`  
**Mode:** Historical inventory. Duplicate Scope Details questions and DC-01/DC-02 stacking were fixed in R1.  
**Owner rule:** Project-wide conditions exist **only** in Project Conditions. They must **not** be asked again in Work Area Scope Details.  
**Prior fix:** Stage 3.2.2-R1 single-consumed **Deck / Fence / Pergola** labour access (`getCombinedLabourAccessFactor`). R1 extended that to demolition / external-stairs / bathroom / retaining wall and removed WA PC questions.

**Taxonomy already states this rule:** `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md` §4 — “Do not ask the same semantic question in Scope Details and Constraints and Interview.” FOUNDATION-R1 removed WA duplicates; FOUNDATION-R1-R1 makes Project Conditions actually appear and gates Generate on required keys.

---

## 1. Classification principle

**PROJECT CONDITION** = applies to the job/site and can influence **multiple** scopes (access, carry, occupancy, hours, parking/loading, project floor, project hazmat, services isolation before strip-out).

**WORK-AREA FACT** = describes what is physically built/removed/installed in that Work Area (deck height, board width, wall length, tiling extent).

**WA OVERRIDE (future, gated)** = rare “this WA differs from the project answer”. Must be explicit, not a second copy of the same question. Default: **do not ask**.

---

## 2. Live Project Conditions (ask authority)

Filter: `scope === "PROJECT" && askPolicy === "ASK" && writeTarget === "CONSTRAINT"`  
(`lib/builder-interview/project-filter.ts`, registry `lib/builder-interview/registry.ts`)

| questionKey | Question text | Constraint key | semanticTopic | Estimate consumption today |
| --- | --- | --- | --- | --- |
| `interview.site.site_access` | How difficult is site access? | `site_access` | `site.access` | Labour factor +0.05 / +0.10 (`adjustments.ts`) |
| `interview.site.material_carry_distance` | Distance from material drop-off or waste carting? | `material_carry_distance` | `site.carry` | Labour factor short 0 / moderate +0.05 / long +0.10 |
| `interview.site.floor_level` | What floor level are works on? | `floor_level` | `site.floor_level` | **Persist / suppress only — not read by calculators** |
| `interview.site.occupied_site` | Is the site occupied during works? | `occupied_site` | `site.occupied` | **None** (disclosure/suppress) |
| `interview.site.working_hours` | Are there working-hour restrictions? | `working_hours` | `site.working_hours` | **None** (demo WA fact → assumption string only) |
| `interview.site.parking_loading` | Is parking or loading available on site? | `parking_loading` | `site.parking_loading` | **None** |
| `interview.risk.hazardous_materials` | Is there asbestos or hazardous materials risk? | `hazardous_materials_risk` | `risk.hazmat` | **None** at project; demo **Fact** consumed |
| `interview.risk.services_isolated` | Are services isolated before strip-out / demolition? | `services_isolated` | `risk.services` | **None** at project; demo **Fact** consumed |
| `interview.site.waste_bin_access` | Is skip or bin access straightforward? | `waste_bin_access` | `site.waste_bin` | Disposal/haulage (R1-R1 ASK; applicability-gated) |
| `interview.site.site_slope` | Is the site sloped? | `site_slope` | `site.slope` | Labour factor (+0.05) |
| `interview.site.consent_engineering` | Is consent or engineering required? | `consent_engineering` | `compliance.consent` | Persist / suppress |
| `interview.site.protection_dust_control` | Is protection or dust control required? | `protection_dust_control` | `risk.protection` | Persist / suppress |
| `interview.site.client_supplied_items` | Will the client supply items? | `client_supplied_items` | `commercial.client_supplied` | Persist / suppress |
| `interview.site.by_others_trades` | Are other trades working by others? | `by_others_trades` | `commercial.by_others` | Persist / suppress |

**Applicability (R1-R1):** live snapshot asks only keys that `evaluateApplicableProjectConditions` marks material for confirmed WAs + Facts. Required unresolved keys hard-block Generate. Known extracted values show as Known and are not re-asked.

**Persistence:** Project Conditions → `upsertProjectConstraintRecord` → table `constraints`.

**CORE templates** remain the fallback questionnaire when Project Conditions is unavailable. Live PC ASK now includes the former CORE-only keys above, filtered by applicability.

---

## 3. Every Scope Details question classified

### 3.1 Confirmed PROJECT CONDITION duplicates (must leave Scope Details)

| factKey | Question text | Maps to | File |
| --- | --- | --- | --- |
| `deck.access` | How difficult is site access for this deck? | `site_access` | `templates/deck.ts` |
| `fence.access` | How difficult is site access for this fence? | `site_access` | `templates/fence.ts` |
| `pergola.access` | How difficult is site access for this pergola? | `site_access` | `templates/pergola.ts` |
| `bathroom.access` | What is the site access like for this bathroom? | `site_access` | `templates/bathroom.ts` |
| `kitchen.access` | What is the site access like for this kitchen? | `site_access` | `templates/kitchen.ts` |
| `internal_walls.access` | What is the site access like? | `site_access` | `templates/internal-walls.ts` |
| `flooring.access` | What is the site access like? | `site_access` | `templates/flooring.ts` |
| `external_stairs.access` | How difficult is site access? | `site_access` | `templates/external-stairs.ts` |
| `demolition.access` | How difficult is access for removal? | `site_access` | `templates/demolition.ts` |
| `retaining_wall.access` | How difficult is access for machinery/materials? | `site_access` | `templates/retaining-wall.ts` |
| `demolition.floor_level` | What floor level is the work on? | `floor_level` | `templates/demolition.ts` |
| `demolition.carting_distance_m` | Approximate distance to cart waste… | `material_carry_distance` | `templates/demolition.ts` |
| `retaining_wall.carting_distance_m` | Approximate carting distance for spoil/materials? | `material_carry_distance` | `templates/retaining-wall.ts` |
| `demolition.noise_hours_restriction` | Are there noise or working hours restrictions? | `working_hours` | `templates/demolition.ts` |
| `demolition.services_isolated` | Are services isolated before demolition? | `services_isolated` | `templates/demolition.ts` |
| `demolition.hazardous_materials_risk` | Is there a hazardous materials risk? | `hazardous_materials_risk` | `templates/demolition.ts` |

**Interview clones (still duplicate write targets):** `interview.wa.{type}.access_clone` → `{type}.access` for demolition, internal_walls, ceilings, doors, flooring, painting, plastering, deck, bathroom (`registry.ts`). Plus demolition `access_override` and `carting_clone`.

**Missing from access-clone list (but still have Scope Details access Qs):** fence, kitchen, pergola, retaining_wall, external_stairs.

### 3.2 WORK-AREA FACT (keep)

Examples (not exhaustive): deck L/W/H/boards/face/balustrade/substructure; bathroom tiling/fixtures; fence length/height/material/gates; `fence.slope_condition` (line-local); `external_stairs.ground_condition`; `deck.access_type` (product stair/step — **not** site logistics); `deck.height_m` / `deck.level`.

### 3.3 Ambiguous / special

| factKey | Classification | Why |
| --- | --- | --- |
| `ceilings.access` | **WORK-AREA FACT** | Question: “What is the ceiling height/access like?” Options Standard / High / Difficult access. Taxonomy §3.2. **Not** site logistics. |
| `fence.slope_condition` | **WORK-AREA FACT** | Fence-line ground. Related to project `site_slope` but location-specific. Do not merge blindly. |
| `fence.services_risk` | **WORK-AREA FACT** (line services) | Distinct from project hazmat. Keep. |
| `deck.engineering_or_consent_status` (and similar WA consent) | **WORK-AREA FACT** for now | Project `consent_engineering` exists in CORE templates but is **not** in Project Conditions ASK batch. Do not move until Owner expands PC ask set. |
| Height / vertical logistics | Project `floor_level` vs WA `deck.height_m` | Floor of **building** = PC. Height of **deck structure** = WA. |

### 3.4 Suppression bug

`isSuppressedByProjectWideKnowledge` treats **any** `*.access` as site-access when `site_access` is non-Easy (`lib/scopes/questions.ts`). That **incorrectly** treats `ceilings.access` as site logistics.

Partial suppress only: WA `*.access` still **shown** when project access is missing / Easy / Not sure — which still **asks twice** versus Owner rule (“must not be asked again”).

No suppress of `demolition.floor_level` / services / hazmat / carting from project keys.

---

## 4. Consumption paths (Question → persist → calculator → estimate)

### 4.1 `site_access`

```
Project Conditions → constraints.site_access
  → getLabourAdjustmentFactor (+0.05 moderate / +0.10 difficult|restricted)
  → getConstraintNotes (labour notes)
```

| Calculator | Behaviour | Single-consume? |
| --- | --- | --- |
| Deck / Fence / Pergola | `getCombinedLabourAccessFactor` — project once; WA `*.access` only if project absent/Easy/Not sure | **Yes (R1)** |
| Demolition | Project labour factor **and** WA `demolition.access` quantity `siteFactor` (1.1–1.4) **and** optional Access/carting allowance | **NO — DC-01 HIGH** |
| External stairs | Project labourAdjustment **×** WA `accessFactor` on same hours | **NO — DC-02 HIGH** |
| Retaining wall | Project labour factor; `hasPoorAccess(site_access)` **or** WA access Fact can trigger carting/handling **allowance** | **Partial — DC-03 MED** |
| Bathroom | `resolveWorkAreaAccessValue` + `getWorkAreaAccessFactor` only — **no** combined helper | **Inconsistent — DC-05** |
| Kitchen / fitout walls/flooring | Access questions exist; **not consumed** | Dead ask — PC-09 |

### 4.2 `material_carry_distance`

Project band → labour factor.  
**Parallel:** `demolition.carting_distance_m` (>20 m allowance); `retaining_wall.carting_distance_m` (handling allowance).  
AI `enrich-extraction.ts` can write carting to **both** constraint band and WA metres.

R1 called labour-factor vs haulage-allowance “intentional dual channel”. It remains **dual commercial** and **dual ask**.

### 4.3 `floor_level`

Project constraint: **unused by estimate**.  
Commercial floor effect: Fact `demolition.floor_level` → `floorLevelFactor`. Orphan project key + duplicate ask.

### 4.4 `occupied_site` / `parking_loading`

Persist / disclosure / suppress only. No `lib/estimate` formula. **Do not add WA twins.**

### 4.5 `working_hours`

Project: unused commercially.  
`demolition.noise_hours_restriction` → assumption string only.

### 4.6 Hazmat / services

Project constraints persist. Calculators read **`demolition.*` Facts**. Dual persist + dual ask.

### 4.7 `site_slope` (not in PC ASK batch)

`getLabourAdjustmentFactor` +0.05. Fence also `getSlopeLabourFactor(fence.slope_condition)` — usually distinct.

### 4.8 Disclosure

Labour notes: `getConstraintNotes` (access + carry).  
Quote copy: demolition floor/carting Facts (`quote-description.ts`).  
Demo noise: assumption only.

---

## 5. Remediation table

| ID | Condition | Duplicate location | Persistence authority | Calculator consumers | Commercial risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| **PC-01** | Site access | All `*.access` Scope Details + interview clones | Constraint `site_access` | Combined (deck/fence/pergola); stacked demo/stairs; bathroom WA path | **HIGH** on demo/stairs | Remove WA asks; optional explicit override later; unify all calcs on `getCombinedLabourAccessFactor` |
| **PC-02** | Carry / carting | `demolition.carting_distance_m`, `retaining_wall.carting_distance_m` | Constraint `material_carry_distance` | Labour factor + WA allowances | **MEDIUM** dual channel | Project band primary; WA metres only gated override |
| **PC-03** | Floor level | `demolition.floor_level` | Constraint unused; Fact consumed | Demo `floorLevelFactor` | Ask dup + orphan constraint | Consume project `floor_level` in demo; suppress WA unless override |
| **PC-04** | Working hours | `demolition.noise_hours_restriction` | Constraint `working_hours` | Assumption only | Ask dup | Suppress WA; wire commercial later if needed |
| **PC-05** | Occupied / parking | No WA twin | Constraints | None | Low | Keep PC; don’t expand WA |
| **PC-06** | Services / hazmat | `demolition.services_isolated`, `demolition.hazardous_materials_risk` | Dual constraint + Fact | Demo Facts | Ask + persist twice | Constraint SoT; WA Fact only if differs |
| **PC-07** | `ceilings.access` | Wrongly in `*.access` suppress | Fact | Unused in fitout calc? (height) | False suppress / semantic merge | Exclude from site-access suppress |
| **PC-08** | Bathroom access path | Template + resolve helper | Fact preferred | Bathroom labour mins | Inconsistent vs R1 | Migrate to combined helper; then drop Q |
| **PC-09** | Kitchen / flooring / walls access | Templates | Facts | **None** | Dead UX | Delete questions |
| **PC-10** | AI dual-write | `enrich-extraction.ts` → constraint + WA Facts | Both | Seeds DC-01/04 | Dual seed | Write project constraint only unless override |
| **PC-11** | Interview WA clones | `registry.ts` access_clone / carting_clone | Facts | Same as WA Facts | Re-asks in 3.2.3 path | Do not ship 3.2.3 clones; merge into FOUNDATION-R1 |
| **PC-12** | Legacy `retaining_wall.access` on constraints | `getLabourAdjustmentFactor` scans that key | Constraint vs Fact SoT | RW labour | **LOW** | Stop scanning WA keys in project labour helper |
| **DC-01** | Demo access stack | See 4.1 | Dual | Labour × qty × allowance | **HIGH — can inflate** | Single labour factor; allowance only for extra haulage beyond project band |
| **DC-02** | Stairs access stack | See 4.1 | Dual | Hours multiplied twice | **HIGH** | Same as Deck combined helper |
| **DC-03** | RW poor-access allowance | Labour factor + allowance | Dual | Extra $ | **MEDIUM** | Allowance XOR labour uplift, documented |
| **DC-04** | Carry labour + carting $ | Project + WA metres | Dual | Labour + allowance | **MEDIUM** | Document as distinct (productivity vs haulage) **or** pick one; never ask twice |
| **DC-07** | Deck/Fence/Pergola | R1 combined | Constraint primary | Labour once | **MITIGATED** commercially; **ask still duplicates** | Remove questions |

---

## 6. Single-consumption rules (for LabourRequirement)

When LabourRequirement ships:

1. **Project Conditions produce at most one productivity factor per estimate (or per WA if gated override).**  
2. Task `baseHours` are **unadjusted**.  
3. `adjustmentFactors` references that factor **once** — never bake access into each task **and** reapply globally.  
4. Haulage **allowance money** is not a second labour multiplier. If both exist, they must be different economics (hours vs skip/cart $) and must not both derive from a second ask.  
5. Calculators must not read `{wa}.access` for labour once `site_access` is set.

**Do not emit LabourRequirement from calculators until DC-01/DC-02 are fixed** — otherwise the contract would freeze stacked hours.

---

## 7. Recommended remediation sequence (not this batch)

1. Stop asking: delete/suppress WA project-condition questions (PC-01, 02, 03, 04, 06, 09).  
2. Fix suppress: `ceilings.access` exclusion (PC-07).  
3. Unify consumption: demolition + stairs + bathroom + retaining onto R1 combined helper (DC-01, 02, 05, 08).  
4. Wire orphan project keys: `floor_level` → demo factor (PC-03).  
5. Stop AI dual-write (PC-10).  
6. Disable interview WA access clones (PC-11) — **merge 3.2.3 suppress work here**.  
7. Goldens: stacked vs single-consume cases for demo + stairs + deck.

**Non-goals of remediation:** new Project Conditions keys; occupied/hours formula invention; Company DNA; MaterialRequirement emit.

---

## 8. Evidence anchors

- Registry: `lib/builder-interview/registry.ts`  
- R1 helper: `lib/estimate/adjustments.ts` `getCombinedLabourAccessFactor`  
- Demo stack: `lib/estimate/calculators/demolition.ts`  
- Stairs stack: `lib/estimate/calculators/external-stairs.ts`  
- Bathroom path: `lib/estimate/calculators/bathroom.ts`  
- Suppress: `lib/scopes/questions.ts`  
- R1 docs: `docs/implementation/STAGE_3_2_2_R1_PROJECT_CONDITIONS_REMEDIATION.md`, `docs/audits/STAGE_3_2_2_R1_DECK_OWNER_PREVIEW_AUDIT.md`

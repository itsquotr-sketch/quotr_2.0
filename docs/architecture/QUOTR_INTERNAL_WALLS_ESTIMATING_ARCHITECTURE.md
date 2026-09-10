# Quotr Internal Walls Estimating Architecture

**Status:** CANONICAL — **WA-INTERNAL-WALLS-07** insulation + skirting + cornice + electrical  
**Date:** 2026-09-10  
**Branch:** `hardening/stage-2a-security`  
**Preview:** Supabase `shhpjsoldmqtkdbgrbtm`, migrations through **056**  
**Production:** DO NOT TOUCH  
**055:** RESERVED / DEFERRED for QDISP-SQL-055. Do not create.  
**Factory:** [QUOTR_WORK_AREA_FACTORY.md](./QUOTR_WORK_AREA_FACTORY.md)  
**Triage:** [WORK_AREA_EXPANSION_TRIAGE.md](../WORK_AREA_EXPANSION_TRIAGE.md)  
**Verifier (01 audit):** `scripts/verify-work-area-internal-walls-01.ts`  
**Verifier (02 foundation):** `scripts/verify-work-area-internal-walls-02.ts`  
**Verifier (02C persist):** `scripts/verify-work-area-internal-walls-02c.ts`  
**Verifier (03 timber framing):** `scripts/verify-work-area-internal-walls-03.ts`  
**Verifier (04 steel framing):** `scripts/verify-work-area-internal-walls-04.ts`  
**Verifier (05 lining takeoff):** `scripts/verify-work-area-internal-walls-05.ts`  
**Verifier (06 openings):** `scripts/verify-work-area-internal-walls-06.ts`  
**Verifier (07 insulation/skirting/cornice/electrical):** `scripts/verify-work-area-internal-walls-07.ts`

Canonical Work Area type: **`internal_walls`**. ISD alias: **`partitions`**.

Owner domain input after 01 **overrides** the 01 recommendation of one summed-length construction per Work Area. Canonical mature model: **one Internal Walls Work Area may contain one or more Wall Types**.

---

## 0. Verdict

| Gate | Result |
| --- | --- |
| WA-INTERNAL-WALLS-01 architecture / gap audit | **GO** (historical) |
| WA-INTERNAL-WALLS-02 wall types + job scope + geometry | **GO** |
| WA-INTERNAL-WALLS-02C nested persist + sheet length UX | **FINAL GO** |
| WA-INTERNAL-WALLS-03 timber framing takeoff + envelope | **GO** |
| WA-INTERNAL-WALLS-04 steel track/stud takeoff | **GO** |
| WA-INTERNAL-WALLS-05 lining sheets + labour | **GO** (historical) |
| WA-INTERNAL-WALLS-06 openings + structural gate + lining deductions | **GO** |
| WA-INTERNAL-WALLS-07 insulation + skirting + cornice + electrical | **GO** (this phase) |
| Current product maturity | **PARTIAL** — timber + steel + lining + openings + finish allowances on mature path; stopping/painting not in 07 |
| Customer UI band | **Component** — do not call Supported or Mature |
| Openings / door deductions in 06 | **GO** — net lined m² deducted; sheet purchase stays on the sheet-run |
| Start WA-INTERNAL-WALLS-08 / Ceilings / Doors / Variations / RFQ | **NO-GO** until owner starts 08 |
| Production / migration 055 | **NO-GO** |

**Current factory score (honest):**

| Stage | Score |
| --- | --- |
| WA-0 Discovery | **Written** — owner override: multiple Wall Types in one WA |
| WA-1 Facts | **PARTIAL** — `job_scope`, `wall_types` JSON, structural gate. No openings takeoff |
| WA-2 Clarify | **PARTIAL** — progressive job scope → Wall Type fields; Refine adapter + cards |
| WA-3 Physical | **PARTIAL** — timber stud/plate/nog + steel track/stud + lining sheets on mature path. No opening deductions |
| WA-4 Requirements | **PARTIAL** — framing envelope + per-face lining Material/Labour requirements |
| WA-5 Commercial | **PARTIAL on mature path** — 13 mm 2400×1200 Standard/Aqualine/Fyreline/Braceline use legacy shared sheet rates; other sizes Pricing Required. Lining labour hours/sheet is OWNER VALUE REQUIRED |
| WA-6 Conditions | **PARTIAL apply** — canonical `getCombinedLabourAccessFactor` on framing and lining labour hours. Sheet counts do not change with access. Finish level does not scale physical lining |
| WA-7 Review | **PARTIAL** — Wall Type framing + lining groups. Compact installed/purchase sheet counts. Openings not shown |
| WA-8 DNA | **N/A** — lining hours/sheet keys reserved; no calibration rows and no invented benchmarks |
| WA-9 Hosted close | **PARTIAL** — local Type A/B/C/D fixtures. Live Preview Review after this SHA deploys. Pricing/Quote close deferred |

Do not infer maturity from file or question count.

---

## 0C. WA-INTERNAL-WALLS-03 — timber framing takeoff

Implemented on current branch HEAD. IW-02C persist/UX behaviour is preserved (`wall_types` JSON, stable UUIDs, CAS, Side A/B, same lining both sides, sheet length, duplicate/delete, Refine, `active_wall_type_id`, legacy boundary).

### Timber formulas (V1)

```
stud_spacing_m = selected/stored centres_mm / 1000
stud_count     = ceil(length_lm / stud_spacing_m) + 1    // both ends; no opening trimmers
stud_lm        = stud_count × height_m
plate_lm       = 2 × length_lm                           // one top + one bottom; no double top plate
nogging_rows   = height ≤ 2.4 → 2; >2.4 and ≤3.2 → 3; >3.2 → 4
nogging_lm     = nogging_rows × length_lm                // procurement authority; not Bathroom intensity
raw_timber_lm  = stud_lm + plate_lm + nogging_lm
purchase_lm    = raw_timber_lm × (1 + timber_framing waste)
wall_area_m2   = length_lm × height_m                    // framing area; not lining faces
labour_hours   = wall_area_m2 × hours_per_m2
```

Stud centres: height ≤ 2.4 recommended **600 mm**; height > 2.4 recommended **400 mm**. Builder 400 / 600 / custom remains authoritative. Calculator uses stored spacing. Custom without a numeric value → **INFO_REQUIRED**. Spacing ≤ 0 does not divide.

### Waste

Canonical `timber_framing` wastage category (`resolveMaterialWastage`). Company percent wins; otherwise default / **10%** fallback. Applied **once** to total raw lm. Owner provisional 10% is the same canonical fallback, not a second IW-specific percent.

### Shared material identities

| Identity | Role |
| --- | --- |
| `timber.framing.90x45.h1.2.lm` | Shared physical 90×45 H1.2. Bathroom + Internal Walls. Benchmark **$6.20 / lm**. Company exact wins. |
| `timber.framing.140x45.h1.2.lm` | Shared physical 140×45 H1.2, code catalogue only (no SQL seed). **No invented $/lm.** Company exact → else Pricing Required. |

Do **not** create `internal_walls.90x45...` / `internal_walls.140x45...`. Materials page: one shared row per identity.

### Productivity (owner-approved Quotr benchmarks; future DNA)

| Key | Hours | DNA |
| --- | --- | --- |
| `internal_walls.framing.timber.90x45.hours_per_m2` | **0.45** person-hours / m² wall | likely Company DNA; **no calibration row in 03** |
| `internal_walls.framing.timber.140x45.hours_per_m2` | **0.50** person-hours / m² wall | likely Company DNA; **no calibration row in 03** |

Do not use 0.8 h/lm or Bathroom framing productivity. Labour $: `labour.carpenter.hour` (company hourly overrides hardcoded 60/90). No new sell maths.

### Requirement envelope (per Wall Type, then aggregate same material)

| Kind | Component key | Physical key / driver |
| --- | --- | --- |
| MaterialRequirement | `internal_walls.framing.timber.90x45.material` | `timber.framing.90x45.h1.2.lm` purchase lm |
| MaterialRequirement | `internal_walls.framing.timber.140x45.material` | `timber.framing.140x45.h1.2.lm` purchase lm |
| LabourRequirement | `internal_walls.framing.timber.90x45.install` | wall m² × 0.45 |
| LabourRequirement | `internal_walls.framing.timber.140x45.install` | wall m² × 0.50 |
| MaterialRequirement (allowance) | `internal_walls.framing.fixings.allowance` | wall framing area m². **No shared $/m² found.** Pricing Required. Covers anchors, nails/screws, small brackets, standard consumables — not a screw count. |

`variantKey` = Wall Type UUID so Review keeps breakdown. Commercial totals may sum purchase lm by shared `materialKey` (e.g. Type A 108.24 + Type B 113.3 → 221.54 lm of 90×45).

### Frame system

| `frame_system` | IW-03 |
| --- | --- |
| timber 90×45 | Physical takeoff + priced material if rate exists |
| timber 140×45 | Physical takeoff; material Pricing Required until company rate |
| timber other | Takeoff quantities; Pricing Required / INFO_REQUIRED; no 90×45 fallback |
| existing_frame | **No** timber, framing labour, or fixings |
| steel | **IW-04:** standard `track_and_stud` takeoff. **No timber.** Other steel systems Pricing Required |
| other | **No timber fallback.** Pricing Required / Info Required |

### Structural / legacy

Existing structural gate remains authoritative. Yes / Not sure on form / remove / infill / mixed → specialist INFO_REQUIRED, no ordinary partition framing price.

Mature path (`job_scope` and/or canonical `wall_types`) never emits silent 20 m² or the $95/$145 internal wall package. Legacy projects without those facts keep the package calculator.

### Builder Review

Wall Type heading + compact Framing rows (size, L×H, centres, studs, stud/plate/nog lm, net, purchase incl. waste, labour hours, fixings allowance / Pricing Required). No requirement keys in builder copy. Mobile: wrap + `overflow-x-hidden`; group summary is “Framing details”.

### Known limitations (03)

- Lining sheets, lining labour, openings, insulation, skirting, cornice, stopping, painting, demolition, waste disposal: **not implemented**
- Steel track/stud takeoff: **IW-04** (this phase)
- 140×45 has identity but no Quotr $/lm
- Fixings have requirement structure but no shared rate
- Company DNA not calibrated
- Nested finishing XOR and Project Condition consumption beyond the global labour access helper: later

### Deterministic fixtures

| Type | Geometry | Expected purchase / labour |
| --- | --- | --- |
| A | 12 × 2.4, 90×45, 600 mm | 21 studs, 98.4 raw, **108.24 lm**, 28.8 m², **12.96 h** |
| B | 8 × 3.0, 90×45, 400 mm | 21 studs, 103.0 raw, **113.3 lm**, 24 m², **10.8 h** |
| C | 5 × 2.7, 140×45, 400 mm | 14 studs, 62.8 raw, **69.08 lm**, 13.5 m², **6.75 h**, no 90×45 material |

---

## 0D. WA-INTERNAL-WALLS-04 — steel track/stud takeoff

V1 supports **standard non-load-bearing** `frame_system = steel` with `steel.system = track_and_stud`. Not structural steel, proprietary fire/acoustic systems, deflection heads, specialist seismic tracks, or engineering gauges. Those stay Pricing Required / specialist.

IW-03 timber formulas are unchanged. Steel never emits timber material or timber labour.

### Steel formulas (V1)

```
bottom_track_lm = L
top_track_lm    = L
total_track_lm  = 2 × L
stud_count      = ceil(L / spacing - epsilon) + 1    // same end-stud convention as timber
stud_lm         = stud_count × height_m
wall_area_m2    = L × height_m                       // not lining faces
labour_hours    = wall_area_m2 × 0.40
purchase_lm     = raw lm                             // waste factor 0
```

No timber 2/3/4 nogging rows. No invented steel nogging/bridging/brace rule.

### Waste

No canonical steel-framing wastage category exists. `timber_framing` 10% is timber-only. Generic default 10% is not approved as steel framing waste. **V1 does not invent a percent** — purchase lm = raw lm. Owner may add a steel category later.

### Shared material identities

| Identity | Role |
| --- | --- |
| `steel.framing.track.lm` | Shared physical track. Code catalogue only. **No invented $/lm.** |
| `steel.framing.stud.lm` | Shared physical stud. Code catalogue only. **No invented $/lm.** |

No `internal_walls.steel.track…` physical keys. No width-specific products — catalogue had none to reuse. `steel.stud_width_mm` remains metadata only. **Supported commercial widths: none locked.** Missing width does not block V1 takeoff.

### Productivity

`internal_walls.framing.steel.track_and_stud.hours_per_m2` = **0.40** person-hours / m² wall. Future DNA candidate. No calibration row. Labour $: `labour.carpenter.hour`. Finish/quality does not scale qty or productivity (`qualityFactor: 1`). Canonical labour access on hours only.

### Requirement envelope (per steel Wall Type)

| Kind | Component key | Physical key / driver |
| --- | --- | --- |
| MaterialRequirement | `internal_walls.framing.steel.track.material` | `steel.framing.track.lm` |
| MaterialRequirement | `internal_walls.framing.steel.stud.material` | `steel.framing.stud.lm` |
| LabourRequirement | `internal_walls.framing.steel.track_and_stud.install` | wall m² × 0.40 |
| MaterialRequirement (allowance) | `internal_walls.framing.fixings.allowance` | same IW-03 wall-area fixings. Not a duplicate steel-specific allowance. |

### Deterministic fixtures

| Type | Geometry | Expected |
| --- | --- | --- |
| Steel A | 10 × 2.4, track/stud, 600 mm | track **20 lm**, 18 studs, **43.2 lm**, 24 m², **9.6 h**, no timber |
| Steel B | 8 × 3.0, track/stud, 400 mm | track **16 lm**, 21 studs, **63 lm**, 24 m², **9.6 h** |

### Known limitations (04)

- Lining sheets: **IW-05** (this document §0D)
- Openings, insulation, skirting, cornice, stopping, painting, demolition: **not implemented**
- Width-specific steel products/rates: **not invented**
- Steel waste %: **owner decision pending** (V1 raw = purchase)
- Steel nogging/bridging: **not invented**
- Company DNA not calibrated

---

## 0D. WA-INTERNAL-WALLS-05 — lining product / face / layer + sheet takeoff

Implemented on current branch HEAD. IW-03 timber and IW-04 steel formulas are unchanged. `same_lining_both_sides` remains a UX shortcut; the calculator always reads `side_a` / `side_b`.

**IW-05 lining is gross wall face area / gross sheet run.** IW-06 deducts known opening geometry from **net lined m² only**. Sheet purchase / installed counts stay on the full-height sheet run.

### Physical authority

Each Wall Type has independent Side A and Side B. A lined face owns product, thickness_mm, sheet_length_mm, layers. Do not calculate lining from a generic one-side / both-sides multiplier.

### V1 product matrix

Plasterboard sheet width is **1200 mm** unless a specific identity proves otherwise. Lengths offered are the foundation set: 2400 / 2700 / 3000 / 3600 / 4800 / 6000 mm. Recommended length = smallest **product-valid** length that spans wall height.

| Family | Thickness V1 | Sheet takeoff | Material identity | Rate |
| --- | --- | --- | --- | --- |
| Standard GIB | 10, 13 (not 16/25) | Yes, 1200 mm | 13 mm 2400×1200 → legacy `sheet.plasterboard.standard.each`. Other sizes dimensioned `sheet.plasterboard.standard.{t}mm.{L}x1200.each` | $18/$28 only on legacy 13/2400 |
| Aqualine | 10, 13 | Yes | 13 mm 2400×1200 → `sheet.plasterboard.aqualine.each` (**Bathroom shared**). Other sizes dimensioned | $26/$38 only on legacy 13/2400 |
| Fyreline | 13, 16 | Yes | 13 mm 2400×1200 → `sheet.plasterboard.fyreline.each`. Other sizes dimensioned | $24/$36 only on legacy 13/2400 |
| Braceline | 10, 13 | Yes | 13 mm 2400×1200 → `sheet.plasterboard.braceline.each`. Other sizes dimensioned | $22/$32 only on legacy 13/2400 |
| Noiseline | 10, 13 | Yes, 1200 mm | Dimensioned only. **No generic identity / no $/sheet** | Pricing Required |
| Weatherline | 10, 13 | Yes | Dimensioned only | Pricing Required |
| Barrierline | 13, 16 | Yes | Dimensioned only | Pricing Required |
| Plywood | — | No | **MISSING CANONICAL WALL-LINING IDENTITY.** Do not reuse Bathroom 19 mm H3.2 floor plywood | Pricing Required / catalogue gap |
| Fibre cement | — | No | **MISSING CANONICAL WALL-LINING IDENTITY.** Do not reuse Bathroom flooring/underlay FC | Pricing Required / catalogue gap |
| Other | — | No | Custom | Pricing Required |

25 mm is not a V1 plasterboard thickness. Stored unsupported thickness → INFO_REQUIRED, not silent area math.

Legacy generic keys (`sheet.plasterboard.standard.each` etc.) are **aliases for 13 mm 2400×1200 only**. They stay shared so Bathroom Aqualine and Internal Walls 13/2400 Aqualine remain one Materials row. A new dimensioned 2700/3000 key does **not** inherit the 2400 benchmark.

### Sheet-count formula (full-height vertical)

When `sheet_length_mm >= wall_height_mm`:

```
base_sheets            = ceil(length_m / sheet_width_m − 1e-12)
purchase_per_layer     = ceil(base_sheets × (1 + waste) − 1e-12)
installed_sheet_count  = base_sheets × layers
purchase_sheet_count   = purchase_per_layer × layers
net_face_area          = length × height          // Review / future stopping — not sheet authority
installed_layer_area   = net_face_area × layers
```

Owner waste: **10% once** via canonical `sheet_material` (`resolveMaterialWastage`). Company percent wins; default/fallback 10%. Do not waste area then waste sheets.

If `sheet_length_mm < wall_height_mm`: **INFO_REQUIRED** — `"Selected sheet length does not span the wall height."` No silent area-only takeoff.

If selected length > wall height: still one full sheet per wall-width bay. Offcut is not an optimisation model in V1.

### Labour

Hours per **installed sheet**, not h/m² and not purchase/waste sheets.

Keys (future Company DNA; **no invented hours** in IW-05):

- `internal_walls.lining.standard_gib.hours_per_sheet`
- `internal_walls.lining.aqualine.hours_per_sheet`
- `internal_walls.lining.fyreline.hours_per_sheet`
- `internal_walls.lining.braceline.hours_per_sheet`
- `internal_walls.lining.noiseline.hours_per_sheet`
- `internal_walls.lining.weatherline.hours_per_sheet`
- `internal_walls.lining.barrierline.hours_per_sheet`
- `internal_walls.lining.plywood.hours_per_sheet`
- `internal_walls.lining.fibre_cement.hours_per_sheet`

Company productivity rate wins. Otherwise lining labour is **Pricing Required**. Do not copy Bathroom 0.3 h/m² or legacy 1.4 h/m². Labour $ = hours × `labour.carpenter.hour` when hours exist.

### Requirements

Per face: `internal_walls.lining.{product}.material` (purchase sheets) and `.install` (installed sheets × hours/sheet). `variantKey` = `{wallTypeId}:{side}`. Aggregate commercially only when `materialKey` is identical (13/2400 ≠ 13/3000; Fyreline ≠ Standard).

Finish/quality does not scale sheet count, layers, identity, or productivity (`qualityFactor: 1`). Access may scale lining labour hours only.

Mature path still suppresses `$95/$145` / `internalWallsPerM2` / `scope.internal_walls.m2` / 1.4 h/m² lining labour.

### Builder Review

Wall Type lining group: product, thickness, sheet size, layers, installed vs purchase, net m², labour hours or Pricing Required. Identical faces may summarise **Both sides** without hiding totals. Surface: “Lining details”.

### Known limitations (05)

- Openings / door deductions: **closed in IW-06** (net m² only; sheet-run unchanged)
- Insulation, skirting, cornice, stopping, painting, demolition, waste disposal: **not implemented**
- No owner-approved lining hours/sheet — labour Pricing Required until company rate or DNA
- Plywood / fibre-cement wall lining: catalogue gap
- Noiseline / Weatherline / Barrierline: takeoff yes, no $/sheet
- Company DNA not calibrated
- No SQL seed (preview remains 056; do not create 055)

### Deterministic fixtures

| Type | Geometry / lining | Expected |
| --- | --- | --- |
| A | 12 × 2.4, Standard 13/2400, 1 layer, both sides | 10/11 per face; **20 installed / 22 purchase** |
| B | 8 × 3.0, Fyreline 13/3000, 2 layers, both sides | 7 base, 8 purchase/layer; **28 installed / 32 purchase** |
| C | 5 × 2.7, Aqualine 13/2700 vs Standard 13/2700 | 5/6 each, separate identities |
| D | existing frame 3 × 2.4, Standard 13/2400 Side A only | 3 installed / 4 purchase; **no framing** |
| Too-short | 3.0 m wall, 2400 sheet | INFO_REQUIRED, no area math |

---

## 0E. WA-INTERNAL-WALLS-06 — openings + structural gate + lining deductions

Nested `openings[]` on each Wall Type inside `internal_walls.wall_types` JSON. Stable UUID per opening. Logical write keys (`internal_walls.add_opening`, `internal_walls.opening.*`, `internal_walls.wall_type.has_openings`) patch the collection via the IW-02C CAS / `updateWallType` path. No migration. Do not flatten `opening_1` facts.

### Types

Canonical V1: `door` | `passage` | `other`. **Door means a door-sized framed opening only.** It does not create a door leaf, jamb/frame product, hardware, install, or a Doors Work Area. Review: “Door leaf / hardware: Not included”.

### Geometry and validation

`opening_area_m2 = width_m × height_m`. Missing dimensions → INFO_REQUIRED. Do not invent 810×1980. Width/height must be > 0. If wall length/height are known, opening width must be **less than** wall length and height must not exceed wall height. Exceeding wall geometry is INFO_REQUIRED — **no silent clamp**.

### Lining deduction

For new/extend/reline/mixed (not infill, not form-opening sheet takeoff):

```
net_face_area = max(0, gross_face_area − Σ opening_area)
```

Deduct only lined faces. One-side lining deducts Side A only. This net area is authority for lining metadata and future stopping/painting. **Do not allow negative area.**

### Sheet count (conservative V1)

Keep IW-05 full-height vertical sheet-run: `ceil(wall_length / 1.2)`. An 810 mm doorway on a 12 m wall does **not** eliminate a 1200 mm bay. Do not subtract `opening_area / sheet_area` from purchase count. Installed sheet labour stays on the sheet-run. Forming around openings is additional work, not a lining-hours cut.

Waste remains **once** on that sheet-run (IW-05 10% `sheet_material`). Opening deduction does not apply waste twice.

### Timber opening framing

Keep the IW-03 base stud/plate/nog grid unchanged (conservative overtake: jambs are not subtracted from the grid).

Per opening, **additive**:

```
trimmer_stud_count = 2
trimmer_lm         = 2 × trimmer_height     // wall height if known, else opening height
header_lm          = opening_width
cripple_lm         = 0                      // deferred — false precision
raw_lm             = trimmer_lm + header_lm
purchase_lm        = raw_lm × (1 + timber_framing waste)
```

Same frame material (90×45 / 140×45). Waste once on opening raw lm (equivalent to combining then wasting once; not wasted again on a combined total). Shared keys `timber.framing.90x45.h1.2.lm` / `140x45`. Review `variantKey` = `{wallTypeId}:{openingId}`.

### Steel opening framing

Standard track/stud: 2 extra full-height jamb studs + head track = opening width. Waste 0 (IW-04). Materials Pricing Required until company steel $/lm. No boxed/proprietary jambs. Never fall back to timber.

### Opening labour

Key `internal_walls.opening.form.hours_each`. **No owner-approved hours.** Physical framing can complete; labour = **Pricing Required**. Does not block known base framing/lining.

### form_opening

Existing partition + new hole. Structural gate applies. Local opening framing + lining make-good Pricing Required if faces are lined. **No full new-wall timber/lining package.**

### infill_opening

Opening geometry **is** the infill. Local framing + lining on `width × height`. **Do not deduct** opening area (the hole is being closed). No 5 m / 12 m wall assumption.

### Structural gate

Already on `form_opening` / `remove_partition` / `infill_opening` / `mixed`. Yes / Not sure → INFO_REQUIRED specialist, no ordinary price. New non-loadbearing partition with a planned opening does **not** ask the structural question.

### Doors overlap

`calculateDoors` still defaults `count ?? 3` inside the Doors Work Area. Internal Walls openings do **not** set `doors.count`, do not spawn a Doors WA, and do not emit door leaf/frame/hardware/install money. Canonical future contract: Internal Walls = opening formation; Doors = door system.

### Nested persist

Opening IDs are UUIDs. Overlay identity includes `wallTypeId` + `openingId`. Editing Opening A must not overwrite Opening B, wall geometry, lining, or frame data.

### Known limitations (06)

- Cripple studs deferred
- Sheet-run not reduced for doorways
- Opening labour hours not invented
- Lining returns / reveal make-good not sheet-counted
- No lintel engineering
- Insulation / skirting / cornice / electrical = **IW-07** (closed)

---

## 0F. WA-INTERNAL-WALLS-07 — insulation + skirting + cornice + electrical

Per Wall Type fields on `internal_walls.wall_types` JSON. No migration. Do not infer from lining. Do not change IW-03–06 formulas.

### Insulation

Progressive: Include wall insulation? No / Yes. If Yes: Acoustic / Thermal / Fire / acoustic / Other.

Ask for new / extend / reline / infill / mixed / custom. **Do not ask** for form_opening or remove_partition (cavity insulation is not the job). Reline / existing_frame: never assume Yes — emit only if explicitly selected.

```
gross_cavity_m2 = length × height
net_cavity_m2   = max(0, gross − Σ opening_area)   // once; not × lined faces
infill          = opening geometry only
```

Fixture A: 12 × 2.4, door 0.81 × 1.98 → **27.1962 m²**.

Physical keys (shared, unpriced): `insulation.wall.acoustic.m2` / `thermal` / `fire_acoustic` / `other`. **No catalogue rate.** Quantity shown; material Pricing Required unless a company exact rate exists.

Waste: **no canonical insulation wastage category.** Purchase m² = net cavity. Do not invent a percent. Owner decision required to add one later.

Labour key `internal_walls.insulation.install.hours_per_m2` — **no owner hours.** Labour Pricing Required.

### Skirting

SINGLE_SELECT: No / Side A / Side B / Both sides. Independent of lining mirror.

Per selected face: `max(0, wall_length − Σ opening_width)`. Door, passage, and other V1 types all interrupt floor skirting. One deduction per face — passage is not deducted twice on the same face. Do not deduct opening height.

Both sides: 11.19 lm each, **22.38 lm** total on a 12 m wall with one 0.81 m door.

Infill: only if selected, using infill width.

Material identity `skirting.wall.lm` — no canonical wall-skirting product/rate (do not reuse deck full-height skirting). Profile Pricing Required. Labour `internal_walls.skirting.install.hours_per_lm` — no owner hours.

### Cornice / cove

Same side SINGLE_SELECT. Per selected face: wall length. **Ordinary doors/passages below wall height do not deduct.** Full-height openings (`height ≥ wall height`) deduct width.

12 m wall + 0.81 × 1.98 door → **12.0 lm** per side, **24.0 lm** both.

Infill: only if selected, infill width.

Identity `cornice.wall.lm` — no canonical product/rate. Labour hours/lm unpriced.

### Electrical

SINGLE_SELECT: No / Minor / Standard / Heavy / Custom. Allowance only. No sockets, cable, switchboard, fire alarm, or data takeoff.

Bathroom `bathroom.electrical.*.allowance` dollars are **not** valid Internal Walls ranges. IW keys `internal_walls.electrical.{minor|standard|heavy|custom}.allowance` have **no invented $**. Company exact → else Pricing Required.

Per Wall Type. form_opening / infill / reline: optional, never assumed.

Custom may take a brief note.

### Requirement envelope

Insulation material + labour; skirting material + labour (per side variant); cornice material + labour (per side); electrical subcontract allowance. `variantKey` includes wallTypeId and side where relevant.

Changing finish does **not** change stud count, track, timber, sheet count, sheet product, or lining layers.

### Known limitations (07)

- No owner insulation/skirting/cornice hours
- No canonical insulation waste %
- No wall skirting/cornice SKU matrix
- Electrical is an unpriced allowance until company rates exist
- Stopping / painting = **IW-08**, not started

---



## 0A. WA-INTERNAL-WALLS-02 — owner decisions recorded

| Decision | Owner / 02 |
| --- | --- |
| Multiple Wall Types in one WA | **Canonical.** Not one summed length. |
| Storage | **`internal_walls.wall_types` JSON array** on existing `project_facts.value` (jsonb). No SQL migration. Logical `internal_walls.wall_type.*` keys patch the collection and are not persisted as sibling rows. |
| Stable ID | UUID per Wall Type (`crypto.randomUUID`). Duplicate/delete/reorder must not use array index as identity. |
| `job_scope` | `new_partition` / `extend_partition` / `reline_existing` / `infill_opening` / `form_opening` / `remove_partition` / `mixed` / `custom` |
| Height 2.4 m | **ASSUMED_DISCLOSED** when Not sure on ordinary residential partition. Copy: "Wall height assumed at 2.4 m." |
| Length | **HARD REQUIRED** for build/reline Wall Types. Missing → INFO_REQUIRED. Do not invent. |
| Stud centres | height ≤ 2.4 → recommended **600 mm**; height > 2.4 → recommended **400 mm**. Visible/editable. Builder may override 400 / 600 / custom. |
| Nogging (recorded only) | ≤2.4 → **2 rows**; >2.4 and ≤3.2 → **3 rows**; >3.2 → **4 rows**. No timber calc in 02. |
| Frame systems | `timber` / `steel` / `existing_frame` / `other`. Steel stores track-and-stud foundation. Takeoff is IW-04. |
| Timber sizes | `90x45` / `140x45` / `other`. User copy: "90 mm timber framing — 90×45". |
| Lining | Side A and Side B independently. **02C:** "Same lining both sides?" is Yes/No. While Yes, Side B follows Side A. Switching to No keeps the copy, then independent. |
| Layers | 1 or 2 per face. |
| Products (foundation ids only) | Standard GIB, Aqualine, Fyreline, Braceline, Noiseline, Weatherline, Barrierline, Plywood, Fibre cement, Other. No invented rates. |
| Thickness / sheet length | **02C:** generic selectable 2400/2700/3000/3600/4800/6000 mm. Recommended = smallest generic length ≥ wall height. Never silent 2400 on a 3.0 m wall. Product availability not commercially validated until IW-05. Thickness edit persists; 13 mm remains plasterboard foundation default. |
| Silent 20 m² | **Killed on mature path** (`job_scope` or canonical `wall_types`). Legacy projects without those facts retain fallback. |
| Structural gate | Ask for form opening / remove / infill / mixed. Yes / Not sure → INFO_REQUIRED specialist. Do not ask for ordinary new partition. |
| Openings / skirting / electrical / DNA | Not implemented. Storage permits future `openings[]` on each Wall Type. |
| Project Conditions | Reuse canonical keys. No per-Wall-Type condition fields. |

### Chosen storage model

```
project_facts
  key = internal_walls.wall_types
  value = {
    v: 1,
    types: [
      {
        id, label,
        length_lm, height_m, height_source,
        frame_system, frame_size, steel,
        stud_centres_mm, stud_centres_source,
        same_lining_both_sides,
        side_a: { lined, material_family, product, thickness_mm, sheet_length_mm, layers },
        side_b: { ... },
        openings: []
      }
    ]
  }
```

Readers unwrap `{ v, types }` or a legacy bare array via `parseInternalWallsWallTypes`. `v` is persist revision only (CAS), not pricing authority.

Plus WA-level scalars: `internal_walls.job_scope`, `internal_walls.structural_involvement`, `internal_walls.active_wall_type_id` (UI selection).

**02C write rule:** one canonical mutator (`updateWallType` / `applyInternalWallsFactWrite`) patches by stable ID against the latest `wall_types` row. Persistence wraps `{ v, types }` and compare-and-swaps `value->>v` (legacy rows still CAS `updated_at` once while wrapping). Overlay stores logical field writes, applied onto latest base facts. Add/Duplicate send a client UUID so overlay and persist share the same id. A later product write must not reset layers or an explicit sheet-length override on that type.

Do **not** flatten `wall_1` / `wall_2` keys.

### Legacy boundary

- No historical fact mutation.
- Projects **without** `job_scope` and **without** canonical `wall_types` keep the legacy calculator, including silent 20 m².
- Dual-read: flat `length_lm` / `height_m` / `framing_type` / lining sides may appear as one synthetic legacy Wall Type for display. Synthetic id is `legacy:{workAreaId}` and is not persisted as a migrated type.
- Mature path never emits $95/$145 package money.

### UX

Progressive: What wall work? → framing → dimensions → Side A → same both sides? → clone. Do not ask "How many wall types?" Add / Duplicate / Delete on Refine cards. Optional builder label.

---

This document retains the **01 architecture / gap audit** below as historical current-state of the package calculator. 02 implements the foundation described in 0A. **03 timber framing is recorded in §0C.**

Canonical Work Area type: **`internal_walls`**. ISD alias: **`partitions`**.

---

## 0B. 01 audit verdict (historical)

| Gate | Result |
| --- | --- |
| WA-INTERNAL-WALLS-01 architecture / gap audit | **GO** |
| Current product maturity | **PARTIAL / FALLBACK** (factory WA-0 written here; WA-3…WA-9 **not** closed) |
| Customer UI band | **Component** — do not call Supported or Mature |
| Implement mature calculator in 01 | **NO-GO** |
| Start Ceilings / Doors / Variations / RFQ | **NO-GO** |
| Production / migration 055 | **NO-GO** |
| Next | **WA-INTERNAL-WALLS-02** only after owner decisions in §67 |

**Current factory score (honest):**

| Stage | Score |
| --- | --- |
| WA-0 Discovery | **This document closes written discovery** |
| WA-1 Facts | **PARTIAL** — 13 asked keys + derived `area_m2`. Missing job scope, openings, load-bearing, layers, segments |
| WA-2 Clarify | **PARTIAL** — templates exist; no P0 class; no Refine adapter; no dedicated Clarify compose |
| WA-3 Physical | **FAIL** — package $/m², not takeoff |
| WA-4 Requirements | **FAIL** — no envelope |
| WA-5 Commercial | **PARTIAL pipeline / FAIL authority** — hardcoded `FITOUT_BENCHMARKS` |
| WA-6 Conditions | **PARTIAL apply / FAIL consume** |
| WA-7 Review | **FAIL** — generic Job Plan |
| WA-8 DNA | **N/A** — no consumed independent productivity |
| WA-9 Hosted close | **FAIL** |

Do not infer maturity from file or question count.

---

## 1. Proposed V1 domain boundary

### Belongs on Internal Walls (V1)

- New internal **non-load-bearing** partition walls
- Alter / extend / infill / form-opening / reline / remove of existing internal partitions when selected
- Timber framing takeoff (studs, plates, nogging, opening trimmers)
- Wall linings (one or both faces; single layer V1)
- Insulation in the partition cavity when selected
- Opening in wall geometry (count / width / height / type)
- Framing around openings (non-structural header/trimmers)
- Nested stopping and nested painting **only when selected and no sibling WA owns them**
- Nested demolition of the partition when selected and no standalone Demolition WA owns the same wall

### Does not belong (V1)

- Door leaf, jamb/frame supply, hardware, door installation → future **Doors**
- Standalone ceiling systems → **Ceilings**
- Bathroom wet-area nested walls / Aqualine wet walls / bathroom local nogging → **Bathroom**
- Load-bearing / structural wall engineering, beams, engineered lintels
- Specialist proprietary fire or acoustic **systems** (GIB system specs, sealant schedules, deflection tracks) as fake precision
- Light-gauge steel as a physical takeoff until catalogue identities exist (**DEFER** — allowance or Pricing Required only)
- Multi-layer / different-lining-each-side as a full system (V1: **custom / Pricing Required**)
- Skirtings as a mature identity (current allowance may remain nested P2)

### V1 in/out jobs

| In | Out |
| --- | --- |
| “Build a 3 m timber partition, GIB both sides” | “Supply and hang an internal door” |
| “Close in an old doorway” | “Bathroom wet-wall Aqualine” |
| “Form a new opening in a non-load-bearing wall” | “Fire-rated GIB system to spec, engineer signed” |
| “Line one side of an existing frame” | “Load-bearing wall removal” |
| “Remove a 3 m non-load-bearing partition” | “Ceiling batten and GIB ceiling” |

---

## 2. Current files

| Concern | Path |
| --- | --- |
| Catalogue | `lib/scopes/catalogue.ts` |
| Questions | `lib/scopes/templates/internal-walls.ts` |
| Registry / ISD alias | `lib/scopes/registry.ts` (`partitions` → `internal_walls`) |
| Fact aliases | `lib/scopes/fact-keys.ts`, `lib/scopes/fact-labels.ts` |
| Derived area | `lib/scopes/derived-facts.ts`, `lib/scopes/dimension-derivation.ts` |
| Conditionals | `lib/scopes/conditional-rules.ts`, `lib/scopes/questions.ts` |
| Calculator | `lib/estimate/calculators/fitout.ts` → `calculateInternalWalls` |
| Dispatch | `lib/estimate/calculate-estimate.ts` |
| Benchmarks | `lib/estimate/benchmark-rates.ts` `FITOUT_BENCHMARKS` |
| Sheet shadow | `lib/estimate/material-buildups.ts` `calculateSheetCount` |
| Sheet label | `lib/estimate/material-rate-keys.ts` |
| Rate aliases (unused by calc) | `lib/estimate/rates.ts` |
| Consumed-fact contracts | `lib/estimate/consumed-facts.ts` — **no `internal_walls`** |
| Support band | `lib/work-areas/support-contract.ts` — **component** |
| First-run | `lib/setup/first-run-work-areas.ts` — shown |
| Starter / legacy scope $ | `lib/setup/starter-rates.ts` `scope.internal_walls.m2` |
| Quote draft | `lib/work-areas/quote-description.ts` `buildInternalWallsDraft` |
| Analyse heuristic | `lib/ai/enrich-extraction.ts` `inferInternalWalls` |
| LLM prompt | `lib/ai/brief-extraction-prompt.ts` |
| Crossover | `lib/scopes/scope-crossover.ts` |
| Interview | `lib/builder-interview/registry.ts`, `fixtures/fitout.ts`, `domain-rules/triggers.ts` |
| Project Conditions | `lib/project-conditions/applicability.ts`, `canonical.ts` (`internal_walls.access` → `site_access`) |
| Constraint templates | `lib/assistant/constraint-templates.ts` |
| Site fallback | `lib/assistant/site-constraint-fallback.ts` |
| ISD relationships | `lib/scope-discovery/catalogue/relationships/commercial-fitout.ts` |
| ISD normalisation | `lib/scope-discovery/catalogue/normalisation.ts` |
| Scope impact | `lib/scope-discovery/scope-impact.ts` |
| Shared materials | `lib/rates/specific-material-catalogue.ts` |
| Bathroom XOR note | `lib/estimate/bathroom-framing.ts` |
| Job Plan | generic only (`lib/assistant/job-plan/adapters/registry.ts`) |
| Refine | **none** (`getRefineAdapter("internal_walls")` → `null`) |
| Clarify compose | **no dedicated Internal Walls candidates** |
| Company DNA | **none** |
| Tests (current-state, not maturity) | `scripts/verify-req-1-estimate-requirement-envelope.ts`, `verify-req-3-1-deck-labour-requirement.ts`, `verify-internal-ai-extraction.ts`, `verify-fact-coverage.ts`, `verify-buildup-dedupe.ts`, `verify-foundation-r2-scope-details-completeness.ts` |

---

## 3. Current fact inventory

| Key | Type | Source | Calculator | Requirement | Persistable | Class | Canonical V1? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internal_walls.length_lm` | number lm | question + Analyse | **YES** | no envelope | yes | **CONSUMED** | **YES** (total length) |
| `internal_walls.height_m` | number m | question + Analyse | **YES** | no | yes | **CONSUMED** | **YES** |
| `internal_walls.area_m2` | derived m² | derived / optional fact | **YES** (or silent 20) | no | derived | **CONSUMED / DERIVED** | lining face area, not framing authority |
| `internal_walls.framing_type` | enum | question + Analyse | **NO** | no | yes | **QUESTION ONLY** | map → `frame_system` |
| `internal_walls.wall_lining_type` | enum | question + Analyse | **YES** sheet *label* only | no | yes | **CONSUMED (label)** | **YES** lining family XOR |
| `internal_walls.plasterboard_type` | enum | question + LLM | **YES** sheet *label* only | no | yes | **CONSUMED (label)** | **YES** when plasterboard |
| `internal_walls.lining_sides` | enum | question + Analyse | **YES** sideFactor | no | yes | **CONSUMED** | **YES** |
| `internal_walls.fire_or_acoustic` | enum | question | **NO** | no | yes | **QUESTION ONLY** | keep; do not fake $ |
| `internal_walls.skirtings_included` | bool | question + Analyse | **YES** | no | yes | **CONSUMED** | P2 nested |
| `internal_walls.skirting_length_lm` | number lm | question | **YES** | no | yes | **CONSUMED** | P2 |
| `internal_walls.demolition_included` | bool | question | **YES** lump | no | yes | **CONSUMED** | replace with job_scope + demo labour |
| `internal_walls.stopping_included` | bool | question | **YES** allowance | no | yes | **CONSUMED** | nested XOR vs Plastering |
| `internal_walls.painting_included` | bool | question; forced false if Painting WA | **YES** allowance | no | yes | **CONSUMED** | nested XOR vs Painting |
| `internal_walls.insulation_included` | bool | question + Analyse | **YES** $/m² | no | yes | **CONSUMED** | **YES** as include flag |
| `internal_walls.access` | legacy PC | canonical map only | not IW calc | — | — | **LEGACY** | use `site_access` |
| `internal_walls.lining_type` | stale key | crossover only | no | — | — | **AMBIGUOUS / STALE** | alias of `wall_lining_type` |
| `scope.internal_walls.m2` | starter rate | onboarding | **NOT resolveRate’d** | — | rates | **LEGACY PACKAGE** | supersede |

No `job_scope`, openings, load-bearing, stud centres, layers, or wall-segment facts exist today.

---

## 4. Current question inventory

13 templates in `lib/scopes/templates/internal-walls.ts`. None have `estimatePriorityClass` or `level1BlockingClass`. Quick Estimate therefore treats **all** as askable; required keys block Level 1 via `required: true`.

| Copy | Fact | Pri | Shown | Calc uses? | QE / Refine | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| What is the total wall length? | `length_lm` | 10 | always | yes | QE required | Total lm, not segments |
| Is demolition/removal of existing wall included? | `demolition_included` | 15 | always | yes | QE optional | Between length and height |
| What is the wall height? | `height_m` | 20 | always | yes | QE required | No 2.4 disclosed default |
| What framing type is required? | `framing_type` | 30 | always | **no** | QE required **bloat** | Interview also DEFERs it |
| What wall lining is required? | `wall_lining_type` | 40 | always | label | QE required | |
| What plasterboard type is required? | `plasterboard_type` | 45 | if plasterboard | label | QE required | Hidden but `required: true` |
| One side or both sides? | `lining_sides` | 50 | always | yes | QE required | “Not sure” → one-side in calc |
| Is fire or acoustic rating required? | `fire_or_acoustic` | 52 | always | **no** | QE optional **bloat** | |
| Are skirtings included? | `skirtings_included` | 55 | always | yes | Refine | |
| Approximate skirting length? | `skirting_length_lm` | 56 | if skirtings yes | yes | Refine | |
| Is stopping/plastering included? | `stopping_included` | 57 | always | yes | Refine | Double-count vs Plastering WA |
| Is painting included? | `painting_included` | 58 | hide if Painting WA | yes | Refine | Crossover forces false |
| Is wall insulation included? | `insulation_included` | 60 | always | yes | Refine / P1 | |

**Bloat:** framing type and fire/acoustic are asked as if they change money. They do not. No job-scope, openings, or load-bearing questions. Refine adapter: **none** — answered facts cannot be edited on a dedicated surface.

---

## 5. Current calculator formulas

`calculateInternalWalls` in `lib/estimate/calculators/fitout.ts`.

```
sideFactor = lining_sides contains "both" ? 2 : 1
derivedArea = length_lm × height_m × sideFactor     // if both known
effectiveArea = area_m2 fact ?? derivedArea ?? 20    // SILENT 20 m²
```

| Line | Trigger | Quantity | Money |
| --- | --- | --- | --- |
| Existing wall removal | `demolition_included` | `length ?? 10` lm | `(removalPerM2 × 2)` cost 44 / sell 70 — labelled labour, **not** hours |
| Wall framing labour | **always** | `length ?? effectiveArea / (height ?? 2.4)` lm | generic carpenter × **0.8 h/lm hardcoded** |
| Internal wall lining labour | **always** | `effectiveArea` m² | generic carpenter × `internal_walls.labour_hours_per_m2` **fallback 1.4** (key not in `BENCHMARK_PRODUCTIVITY`) |
| Internal wall materials allowance | **always** | `effectiveArea` m² | **$95 / $145** `internalWallsPerM2` × quality |
| Sheet count | length+height+lining type | `ceil((area / 2.88) × (1+waste%))` | **metadata only** — does not own $ |
| Skirting | flag | `skirting_length_lm ?? length` + timber waste | $28 / $42 /lm |
| Wall insulation | flag | `effectiveArea` m² | $12 / $18 /m² |
| Stopping/plastering allowance | flag | `effectiveArea × $28 / $42` | subcontract allowance |
| Painting allowance | flag | `effectiveArea × $18 / $28` | allowance |

**Never priced:** openings, doors, studs, plates, nogging, steel vs timber XOR, fire/acoustic, lining layers, waste disposal requirement.

`resolveRate` is **not** called. Company `scope.internal_walls.m2` is unused.

---

## 6. Current requirement envelope

**None.** Return is `lineItems` + assumptions + missingInfo only.

`scripts/verify-req-3-1-deck-labour-requirement.ts` asserts `calculateInternalWalls(...).requirements == null`.

Mature path **must** emit Material / Labour / Subcontract / Waste requirements. Plant is N/A (document).

---

## 7. Current rate inventory

| Key / source | Class | Used by IW calc? |
| --- | --- | --- |
| `FITOUT_BENCHMARKS.internalWallsPerM2` 95/145 | **LEGACY PACKAGE** | **YES** |
| `FITOUT_BENCHMARKS.skirtingLm` 28/42 | PC / ALLOWANCE | yes if flag |
| `FITOUT_BENCHMARKS.insulationPerM2` 12/18 | PC / ALLOWANCE | yes if flag |
| `FITOUT_BENCHMARKS.stoppingPerM2` 28/42 | SUBCONTRACT allowance | yes if flag |
| `FITOUT_BENCHMARKS.paintingPerM2` 18/28 | SUBCONTRACT/ALLOWANCE | yes if flag |
| `FITOUT_BENCHMARKS.removalPerM2` × 2 | LEGACY PACKAGE (mis-labelled labour) | yes if demo |
| `FITOUT_BENCHMARKS.plasterboardSheet` 18/28 | SHARED PHYSICAL (catalogue planned) | **no $** — shadow label only |
| fyreline / aqualine / braceline / plywood sheet benchmarks | SHARED PHYSICAL | **no $** |
| `internal_walls.framing.lm` | declared alias, **UNUSED** | no |
| `sheet.plasterboard.standard.each` | SHARED PHYSICAL, planned | no money |
| `sheet.plasterboard.aqualine.each` | SHARED PHYSICAL, Bathroom used_now | no IW money |
| `timber.framing.90x45.h1.2.lm` | SHARED PHYSICAL, Bathroom used_now | **no IW money** |
| `scope.internal_walls.m2` | LEGACY PACKAGE starter | no |
| `internal_walls.labour_hours_per_m2` | PRODUCTIVITY string, **no benchmark row** | fallback 1.4 |
| Hardcoded 0.8 h/lm framing | PRODUCTIVITY (inline) | yes |
| `resolveLabourRate` (generic carpenter) | BUILDER LABOUR | yes |
| `demolition.wall.lm` | sibling Demolition WA | not IW calc |
| `bathroom.stopping.m2` | Bathroom-specific | **do not reuse as IW identity** |

---

## 8. Silent assumptions (must not remain mature authority)

| Behaviour | Rank |
| --- | --- |
| Silent **20 m²** if length/height missing | **P0** |
| Framing labour **always** emitted (including reline / existing frame / steel) | **P0** |
| Lining labour **always** emitted | **P0** |
| Package **$95/m²** independent of timber vs GIB vs steel | **P0** |
| `framing_type` asked, ignored | **P0** |
| “Not sure” lining sides → **one side** without disclosure | **P0** |
| Height fallback **2.4** only inside framing qty `area/height`, not disclosed as wall height | **P0** |
| Demo length fallback **10 lm** | **P1** |
| Sheet 2.4×1.2 shadow while money is $/m² | **P1** |
| Quality factor × package/allowances | **P1** |
| Fire/acoustic asked, $0 change | **P1** |
| Nested stopping + Plastering WA can both price | **P1** |
| Nested painting XOR only if Painting WA confirmed | **P1** |
| No opening deduction | **P1** |
| Doors WA silent **3 doors** if that sibling exists | **P1** (Doors, not IW) |
| `dimension-derivation` omits sideFactor vs calculator | **P2** |
| Crossover reads `lining_type` not `wall_lining_type` | **P2** |
| Interview DEFERs framing_type while template still requires it | **P2** |

---

## 9. Risk ranking (mature path)

**P0** — silent 20 m²; generic wall package; framing+lining always on; timber/steel/existing ignored; lining sides “Not sure” silently one-face; no load-bearing gate.

**P1** — openings absent (double-count vs Doors; lining not deducted); nested stop/paint vs siblings; fire/acoustic fake question; demo vs Demolition WA; sheet count not owning money; 2.4 height used as divisor without disclosure.

**P2** — skirting model; stale `lining_type`; interview defer mismatch; first-run UI showing Internal Walls next to Deck.

---

## 10. Canonical job scope

**No runtime enum exists today.** Do not create it in 01.

Recommended V1 enum `internal_walls.job_scope`:

| Value | Meaning |
| --- | --- |
| `new_partition` | New non-load-bearing wall |
| `extend_partition` | Lengthen existing |
| `reline_existing` | Existing frame; lining only |
| `infill_opening` | Close a doorway / opening |
| `form_opening` | New opening in existing non-LB partition |
| `remove_partition` | Strip existing partition |
| `mixed` | More than one of the above on the same WA |
| `custom` | Builder describes; Pricing Required / allowances |

Not recommended as V1 primary: `alter_existing` (too vague — split to reline / infill / form / mixed).

### Legacy mapping (when 02 implements)

| Current | Maps to |
| --- | --- |
| (none stored) | unknown → ask, or infer `new_partition` only if timber+both sides+no demo |
| `demolition_included=true` alone | at least `remove_partition` **or** mixed with new work — do not guess mixed |
| `framing_type=Existing frame` | `reline_existing` candidate |
| `framing_type=Steel stud` | still a **frame_system**, not a job_scope |

---

## 11. Geometry model

Primary facts:

- `internal_walls.length_lm` — total partition length (sum of segments in V1)
- `internal_walls.height_m` — wall height

Derived (calculator-owned, not asked):

```
gross_wall_face_area_m2 = length_lm × height_m
lining_face_area_m2 = gross_wall_face_area_m2 × lined_faces   // 1 or 2
```

Framing uses length, height, centres, openings — **not** lining m².

`internal_walls.area_m2` today **is lining-face area** (includes sideFactor). Keep that meaning or rename in 02; do not use it as framing quantity.

Floor area is **not** a wall-area proxy. Current calc does not use floor m² (good). Silent 20 m² is the defect.

---

## 12. Multiple wall segments (V1)

**01 recommended: one Internal Walls Work Area; `length_lm` = sum of segments.**

**OWNER OVERRIDE (02):** one Work Area may contain **one or more Wall Types** with independent framing, height, length, and lining. Same-construction lengths may still be summed *inside* one Wall Type. Different constructions are additional Wall Types, not additional Work Areas.

Example A 3.2 + B 1.8 + C 4.5 → `length_lm = 9.5` with optional note.

Do **not** ship a CAD wall graph in V1.

Do **not** ship a CAD wall graph in V1.

| Option | Speed | Accuracy | Questions | Edit |
| --- | --- | --- | --- | --- |
| One WA, total length | Fast | Good if same construction | Low | Edit the total |
| One WA per wall | Slow | Best if construction differs | High | Natural |
| Segments array | Medium | Good | High | Future |

If two constructions (e.g. one fire-rated wall + ordinary partitions), **two Work Areas** — not a segment array.

---

## 13. Wall height authority

Current: required question; if missing, area falls back to 20 m² rather than disclosed 2.4 m.

**Recommendation (not implementation):**

- KNOWN height preferred
- **ASSUMED_DISCLOSED 2.4 m** is acceptable Quotr V1 for standard residential internal partitions when the builder says Not sure **and** the job is ordinary housing
- Unusual (raked, 2.7/3.0 commercial, bulkhead) → **INFO_REQUIRED**
- Never silently invent height **and** still emit a confident package

Bathroom already uses disclosed 2.4 m wall height. Reuse the *policy*, not Bathroom keys.

---

## 14. Frame system

Current `internal_walls.framing_type`: Timber / Steel stud / Existing frame / Other / Not sure.

**Canonical V1:** keep values; prefer key `internal_walls.frame_system` as alias of `framing_type` (do not fork two live keys).

| Value | V1 money |
| --- | --- |
| Timber | Physical timber takeoff |
| Existing frame | No new framing labour/material; lining only |
| Steel stud | **DEFER physical** — Pricing Required or labelled allowance until identities exist |
| Other / Not sure | INFO_REQUIRED or Pricing Required |

Do not assume all Internal Walls are timber.

---

## 15. Timber framing model (architecture only)

Typical residential partition: **90×45 H1.2**.

Reuse `timber.framing.90x45.h1.2.lm` (Bathroom already consumes). **Do not** create `internal_walls.90x45.h1.2`.

Recommended formula architecture (02+; do not implement here):

```
stud_spacing_m = owner-approved centres (see §16)
stud_count = ceil(length_lm / stud_spacing_m) + 1     // include both ends
             + extra_end_studs_for_returns            // V1: 0 unless fact
             + opening_trimmer_studs                  // see openings

stud_lm = stud_count × height_m

bottom_plate_lm = length_lm
top_plate_lm    = length_lm          // V1 single top plate
plate_lm        = bottom_plate_lm + top_plate_lm

nogging_lm      = nogging_rows × length_lm     // or × stud bays; pick one in 03
opening_header_lm = sum(opening_width)         // non-structural packer/header

framing_purchase_lm = (stud_lm + plate_lm + nogging_lm + header_lm)
                      × (1 + timber_framing waste)
```

Do **not** use Bathroom `lm/m²` intensity as Internal Walls framing authority when wall length is known.

Double top plate: **not V1** unless load-bearing (which V1 does not price).

---

## 16. Stud centres — owner decision recorded in 02

**02 owner rule (implemented as recommended/default, visible and editable):**

- wall height ≤ 2.4 m → 600 mm
- wall height > 2.4 m → 400 mm
- builder may override 400 / 600 / custom

No stud quantity in 02.

Owner must choose before 03:

1. ASSUMED_DISCLOSED 600 mm for ordinary residential partitions, or
2. Ask every time (P0), or
3. 450 mm as standard.

Until then, 02 may capture `internal_walls.stud_centres_mm` without using it in money.

---

## 17. Plates

V1: **bottom + single top plate** = `2 × length_lm`.

Double top plate: out of V1 except documented custom.

---

## 18. Nogging

Different from Bathroom local fixture nogging.

Simplest defensible V1:

- If `height_m ≤ 2.4`: **one row** mid-height → `nogging_lm = length_lm` (or `stud_bays × spacing` equivalent)
- If `height_m > 2.4`: **two rows** or INFO_REQUIRED

Do not import Bathroom `0.2 h/lm` as partition nogging productivity.

---

## 19. Openings vs Doors

| Internal Walls owns | Doors owns (future) |
| --- | --- |
| Opening count, width, height, type (door / passage / other) | Door leaf |
| Lining deduction (V1 recommend **yes** if geometry known) | Jamb/frame supply if defined there |
| Extra trimmers + non-structural header | Hardware |
| Form opening / infill opening labour | Door installation |
| | Existing door removal lump (current Doors calc) |

Current IW: **no opening facts**. Current Doors: count default **3**, supply/install lump, optional removal, architraves `count × 5 lm`. Doors does **not** form the wall opening.

**Double-count risk:** IW package + Doors 3-door lump on the same job; IW framing labour with no opening extra while Doors charges install.

---

## 20. Door-opening lining deduction

**Recommend V1: deduct known opening face area from lining material** when width × height known.

```
lining_net_m2 = lining_face_area_m2 − Σ(opening_width × opening_height × faces_cut)
```

Unlike Bathroom (openings not deducted — disclosed), Internal Walls often has explicit doorway geometry. If opening size unknown: do **not** invent 810×1980; INFO_REQUIRED or no deduction with disclosure.

Stopping may still follow installed board area (joints around opening remain).

---

## 21. Opening framing (non-load-bearing only)

V1:

- Two extra studs (trimmers) per opening
- One header / lintel **packer** of opening width (not engineered lintel)
- Cripple/sill studs: optional P2; may omit in V1 if owner prefers simplicity

**Not V1:** structural lintel design, point loads, steel flitch.

---

## 22. Load-bearing / structural

Proposed fact: `internal_walls.structural_involvement` = no / yes / not sure.

| Answer | V1 |
| --- | --- |
| No | Ordinary partition path |
| Yes or not sure, and work is form/remove/infill | **INFO_REQUIRED** or specialist/engineer allowance labelled as such — **no invented structural $** |

Do not silently price structural alterations as 90×45 partitions.

---

## 23. Lining sides and layers

**Sides:** `one` | `both` | (custom later). **Do not assume both.** Not sure → INFO_REQUIRED or ASSUMED_DISCLOSED only with owner approval (this audit: prefer INFO_REQUIRED).

**Layers V1:** single layer ASSUMED_DISCLOSED when plasterboard. Double layer / different each side → `custom` / Pricing Required. Do not overcomplicate V1.

---

## 24. Plasterboard / shared identities

| Identity | Catalogue | Unit | Rate | Sheet size in description | Shared? | IW calc money? |
| --- | --- | --- | --- | --- | --- | --- |
| `sheet.plasterboard.standard.each` | yes, `work_area_type: internal_walls`, **planned** | each | default 18/28 | **2.4 × 1.2 m** (2.88 m²) | tagged IW | no |
| `sheet.plasterboard.aqualine.each` | yes, **used_now** Bathroom | each | 26/38 | same default sheet helper | **READY FOR REUSE** | no |
| `sheet.plasterboard.fyreline.each` | planned | each | 24/36 | not dimensioned beyond default helper | READY if fire is allowance | no |
| `sheet.plasterboard.braceline.each` | planned | each | 22/32 | ditto | READY if bracing is allowance | no |
| Noise control | **no identity** | — | — | — | **MISSING** | — |
| `sheet.plywood.each` | planned generic | each | 45/68 | unspecified | weak | no |
| `sheet.plywood.19mm.h3.2.each` | Bathroom floor | each | 145 | 2400×1200 | **NOT RELEVANT** to ordinary GIB walls | — |
| `sheet.fibre_cement.*` flooring/underlay | Bathroom floor | — | — | — | **NOT RELEVANT** as wall lining | — |

**3.0 m standard GIB sheets are not stored.** Helper `calculateSheetCount` defaults **2.4 × 1.2**. Owner must decide if V1 uses 2400×1200 or needs a **3.0 m** identity. Do not assume 3.0 m exists.

Aqualine on Internal Walls: only if wet-adjacent / specified. Bathroom wet walls stay Bathroom.

---

## 25. Sheet count model

Current shadow:

```
sheetArea = 2.4 × 1.2 = 2.88 m²
totalSheets = ceil(lining_area / 2.88 × (1 + sheet_material waste %))
```

Waste category `sheet_material` falls back to org default **10%** (`lib/settings/material-wastage.ts` `FALLBACK_DEFAULT_PERCENT = 10`). Bathroom lining uses the same 10% sheet waste convention.

**V1 recommend:** keep area / sheet-area / waste / ceil — simplest accurate model. Orientation/height-based sheet count is P2.

**10% plasterboard waste:** already canonical for `sheet_material` when unset. **Reuse** for Internal Walls; no new IW-specific waste percent. Company override still wins.

---

## 26. Steel framing

**DEFER physical calculator.** No steel stud / track identities in the specific-material catalogue.

V1: if `frame_system = Steel stud` → labelled **Pricing Required** or a single transparent allowance — not a half-baked stud-count.

---

## 27. Insulation

Current: boolean → `$12/18 per lining m²` (uses sideFactor area, so two-face walls double insulation — **wrong** for cavity).

Correct physical quantity: **cavity face ≈ gross wall face − openings**, not × lined faces.

No shared insulation identity. New identity required later; owner $ not invented here.

Propose `internal_walls.insulation` = none / acoustic / thermal. V1: include boolean + one allowance/identity later.

---

## 28. Fire / acoustic

Do **not** treat as finish multipliers.

V1: if Fire-rated / Acoustic / both → **Pricing Required / custom** unless a later owner-approved preset exists. Asking the question today without changing $ is deceptive — keep the fact, stop implying a priced system.

---

## 29. Stopping

Nested stopping quantity: **installed plasterboard lining area** (after opening deduction if V1 deducts).

`bathroom.stopping.m2` is Bathroom-specific. **No domain-neutral stopping key exists.** Internal Walls should get `internal_walls.stopping.m2` (or shared `stopping.plasterboard.m2` later) — **do not create in 01**. Bathroom XOR: if Plastering WA present, nested stopping off (Bathroom already does this pattern).

---

## 30. Painting

Optional nested. Quantity: **paintable lined face area**.

Do not paint unlined faces, wet-area tile (Bathroom), or when sibling **Painting** WA is confirmed (crossover already forces `painting_included=false`).

---

## 31. Demolition

Current: `length ?? 10` lm × $44/70, labelled labour, not hours.

V1: demolition labour **separate** from construction labour. Quantity: wall length and/or lined face area. Waste/disposal separate allowance.

**Do not copy Bathroom demolition component hours** (`bathroom.demolition.*`) as Internal Walls partition removal.

Standalone `demolition` WA also prices `demolition.wall.lm` (fallback 10 lm). **Document XOR:** partition-specific removal on IW; whole-house strip-out on Demolition WA; never both for the same wall.

---

## 32. Waste

| Stream | V1 |
| --- | --- |
| Plasterboard | 10% sheet_material (canonical fallback) |
| Timber | `timber_framing` wastage category (same helper) |
| Steel | N/A until steel exists |
| Demolition spoil | transparent disposal **allowance**, no fake density |

No WasteRequirement today.

---

## 33. Project Conditions

Reuse canonical keys only. IW is in `INTERIOR_TYPES` + `RENO_TYPES`.

Constraint templates today: `services_isolated`, `protection_dust_control`, `occupied_site`.

`SHARED_CONSUMED_CONSTRAINT_KEYS` (access, carry, occupied, hours) are **not read** by `calculateInternalWalls`. Mature labour should consume them the way Deck/Bathroom do. Do not create `internal_walls.access` (legacy map already points at `site_access`).

---

## 34. Recommended productivity tasks (no values)

Do not set hours in 01.

| Task | Proposed key | DNA |
| --- | --- | --- |
| Timber partition framing | `internal_walls.framing.timber.install.hours_per_lm` (or per stud) | **TIER 1** |
| Single-layer wall lining | `internal_walls.lining.install.hours_per_m2` | **TIER 1** |
| Insulation install | `internal_walls.insulation.install.hours_per_m2` | SECONDARY |
| Form / infill opening | `internal_walls.opening.form.hours_each` | SECONDARY |
| Partition demolition | `internal_walls.demolition.hours_per_lm` or per m² | SECONDARY |
| Steel framing | — | **DO NOT CALIBRATE** until physical |
| Double-layer lining | — | DO NOT CALIBRATE V1 |
| Stopping | subcontract, not DNA | **DO NOT CALIBRATE** |
| Current `internal_walls.labour_hours_per_m2` 1.4 | lump lining | **SUPERSEDE** |
| Current 0.8 h/lm framing | hardcoded | **SUPERSEDE** — do not treat as owner-approved |

Do not reuse Bathroom 0.3 h/m² wall lining or 0.2 h/lm local framing as Internal Walls defaults without owner approval.

---

## 35. Shared material reuse

| Material | Verdict |
| --- | --- |
| `timber.framing.90x45.h1.2.lm` | **READY FOR REUSE** |
| `sheet.plasterboard.aqualine.each` | **READY FOR REUSE** (wet-adjacent only) |
| `sheet.plasterboard.standard.each` | **READY** identity; money planned; confirm 2.4 vs 3.0 m with owner |
| `sheet.plasterboard.fyreline.each` / `braceline.each` | **READY** as identities; V1 fire/brace still Pricing Required |
| `sheet.plywood.19mm.h3.2.each` | **NOT RELEVANT** (floor) |
| `sheet.fibre_cement.*` flooring/underlay | **NOT RELEVANT** as partition lining |
| Steel studs / track | **MISSING CANONICAL IDENTITY** |
| Wall insulation | **MISSING CANONICAL IDENTITY** |
| Noise-control board | **MISSING CANONICAL IDENTITY** |
| Fixings | typically labour-bundled; **no new identity in 01** |

### Materials page contract

**Forbidden:** `internal_walls.90x45.h1.2`, `internal_walls.standard_gib`, `internal_walls.aqualine` as physical rate rows.

Requirement keys may be `internal_walls.framing`, `internal_walls.lining`, etc. Physical `item_key`s stay shared `timber.*` / `sheet.*`.

---

## 36. Commercial model (target)

```
material: physical qty × resolved shared material rate
labour:   physical qty × task productivity × carpenter rate
subcontract: qty × stopping/painting rate or explicit allowance
waste:    sheet/timber waste once; demo disposal allowance
sell:     existing commercial engine
```

No Internal-Walls-specific sell math. Missing rate → Pricing Required, **not** revert to $95/m² package.

---

## 37. Fallback / package inventory (supersede on mature path)

| Location | What | Mature fate |
| --- | --- | --- |
| `FITOUT_BENCHMARKS.internalWallsPerM2` | $95/145 /m² | **SUPERSEDE** |
| `recordDefaultedNumber` 20 m² | silent quantity | **SUPERSEDE** |
| `scope.internal_walls.m2` starter | legacy overall $/m² | **SUPERSEDE** as money authority |
| Hardcoded 0.8 h/lm + 1.4 h/m² | lump labour | **SUPERSEDE** with task keys |
| Demo `removalPerM2 * 2` on lm | unit mismatch | **SUPERSEDE** |
| Quality × package | inflates physical-looking $ | **SUPERSEDE** on construction lines |
| Sheet build-up on package line | fake precision | Keep takeoff; drop package |

---

## 38. Partial-scope fixtures (do not implement)

| ID | Job | V1 intent |
| --- | --- | --- |
| A | NEW WALL 3.0×2.4, 90×45, two-sided standard GIB | Full framing + lining |
| B | ONE-SIDE RELINE existing frame 3.0×2.4 | No framing material; lining × 1 |
| C | INFILL OPENING | Local framing + lining; not a full new wall |
| D | FORM OPENING non-LB | Opening framing; lining deduction; no door leaf |
| E | REMOVE WALL 3.0×2.4 non-LB | Demo labour + waste; no new GIB |
| F | NEW WALL + DOOR OPENING | Partition + framed opening; Doors sibling owns leaf |

---

## 39. Proposed requirement groups (Review)

Framing · Linings · Insulation · Openings · Builder labour · Stopping · Painting · Demolition · Waste.

Builder-readable labels only. No `PACKAGE_FALLBACK` / component keys in UI.

---

## 40. Question strategy (progressive)

1. Job scope  
2. Structural involvement (gate)  
3. Geometry (length, height)  
4. Frame system (if building/framing)  
5. Openings (if not remove-only)  
6. Lining sides / type / plasterboard grade  
7. Insulation  
8. Nested stopping / painting if no sibling  
9. Demolition if alteration/remove  
10. Project Conditions (shared)

Do not front-load fire-system, steel gauges, or skirting.

---

## 41. Proposed P0 / P1 / P2 fact matrix

| Fact | Class |
| --- | --- |
| `job_scope` | **P0 HARD** |
| `structural_involvement` | **P0 HARD** when form/remove/infill; else P1 |
| `length_lm` | **P0 HARD** |
| `height_m` | **P0 ASSUMABLE** (disclosed 2.4 residential) |
| `frame_system` | **P0 HARD** if scope includes framing; skip if reline/remove |
| `lining_sides` | **P0 HARD** if lining in scope |
| `wall_lining_type` | **P0 ASSUMABLE** plasterboard on new/reline |
| Opening count/size | **P0 ASSUMABLE** none if new wall without doors; **P0 HARD** if form/infill |
| `stud_centres_mm` | **P0 ASSUMABLE** only after owner default; else P1 ask |
| `plasterboard_type` | **P1** (standard assumed disclosed) |
| `insulation_included` | **P1** |
| `stopping_included` / `painting_included` | **P1** nested |
| `demolition_included` | derived from job_scope or **P1** |
| `fire_or_acoustic` | **P1** → Pricing Required, not money formula |
| Skirtings | **P2** |
| `area_m2` | **LEGACY / DERIVED** |
| `scope.internal_walls.m2` | **LEGACY** |

Ready depends on P0 HARD (+ structural gate). Do not block Ready on skirting or fire-system SKU.

---

## 42. Assumption policy

| Fact | Policy |
| --- | --- |
| Height 2.4 m | ASSUMED_DISCLOSED if Not sure + residential |
| Stud centres | **Owner decision** before assuming |
| Sheet 2.4×1.2 | ASSUMED_DISCLOSED until 3.0 m identity exists |
| Lining both sides | **Do not assume** |
| Frame timber | **Do not assume** if unanswered |
| Single layer | ASSUMED_DISCLOSED for plasterboard V1 |
| No openings | ASSUMED_DISCLOSED on new_partition unless brief mentions a door |
| Fire none | ASSUMED_DISCLOSED if unanswered |

Conservative: missing length → **INFO_REQUIRED**, never 20 m².

---

## 43. Builder Review target

```
INTERNAL WALL
Wall: 3.0 m × 2.4 m
Scope: New partition
Framing: 90×45 H1.2 timber · {centres} · {n} studs · plates · nogging
Lining: Both sides · 13 mm standard GIB · net m² · {n} sheets
Labour: Framing {h} · Lining {h}
Opening: 1 × {w} door opening (no door leaf)
Finishing: Stopping / painting if selected
Assumptions: listed
Source: company vs Quotr benchmark
```

No internal keys.

---

## 44. Overlap contracts (document only — no XOR implementation in 01)

### Bathroom

Bathroom owns nested wet-area walls, Aqualine, local nogging. **Complete partitions → Internal Walls.**  
Fact `bathroom.partition_by_internal_walls` is documented in Bathroom architecture as later. **No runtime XOR today.**  
01 contract: if both confirmed, Bathroom must not emit full partition; IW must not emit bathroom wet walls. Implement XOR in a later phase, not 01.

### Ceilings

IW = vertical partitions. Ceilings = horizontal systems. Bulkheads / deflection tracks **out of V1**. Wall head is a plate, not a ceiling.

### Doors

See §19–21. Doors current calc does not form openings. Risk is parallel lumps, not shared opening takeoff.

### Painting / Plastering

Nested flags are allowances. Painting WA already suppresses IW painting question. Plastering may still double-count stopping — **document; do not mature those siblings here**.

### Demolition

IW owns partition-specific removal. Standalone Demolition owns `demolition.wall.lm` / scope_items. Same wall must not be priced twice. Implement later.

---

## 45. Gap tables

### Materials

| Physical | Existing key | Rate? | Unit | Shared? | New identity? | Owner decision? |
| --- | --- | --- | --- | --- | --- | --- |
| 90×45 H1.2 | `timber.framing.90x45.h1.2.lm` | $6.20/lm benchmark | lm | yes | no | no |
| Standard GIB 13 mm | `sheet.plasterboard.standard.each` | planned 18/28 | each | tagged IW | maybe **3.0 m** variant | **YES — sheet length** |
| Aqualine | `sheet.plasterboard.aqualine.each` | 26/38 used_now | each | yes | no | wet-use only |
| Fyreline | `sheet.plasterboard.fyreline.each` | planned 24/36 | each | yes | no | fire = PR |
| Steel studs/track | none | — | — | — | **YES if steel V1** | **DEFER steel** |
| Insulation | none | hardcoded 12/18 | m² | — | **YES later** | $ later |
| Fixings | none | bundled | — | — | no in 01 | no |

### Productivity

| Task | Current key | Benchmark | Consumed? | Suitable? | New key? | Owner benchmark? | DNA? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lining lump | `internal_walls.labour_hours_per_m2` | **1.4 fallback only** | yes | no | yes | **YES** | Tier 1 later |
| Framing lump | inline 0.8 h/lm | **not in table** | yes | no | yes | **YES** | Tier 1 later |
| Bathroom wall lining | `bathroom.lining.wall.install.hours_per_m2` | 0.3 | Bathroom | **do not copy** | IW-specific | **YES** | — |
| Bathroom local framing | `bathroom.framing.install.hours_per_lm` | 0.2 | Bathroom | **do not copy** | IW-specific | **YES** | — |

**No invented Internal Walls productivity numbers in this audit.**

### Commercial rates

| Item | Current | Gap |
| --- | --- | --- |
| Stopping | hardcoded 28/42 /m² | need IW or shared stopping key; **no new $ in 01** |
| Painting nested | hardcoded 18/28 | XOR vs Painting WA `painting.m2` |
| Demo/waste | removalPerM2×2 on lm | replace; disposal allowance TBD |
| Steel | none | Pricing Required |
| Insulation | 12/18 /m² | identity + owner $ later |
| Fire system | none | Pricing Required |

---

## 46. Migrations

**None for 01.** Preview stays **056**. Do not create **055**.

Future implementation may need a **data-only** catalogue seed (DNA and/or material rows) **after** identities are approved — same pattern as Bathroom 056. Do not invent it now. Production untouched.

---

## 47. Implementation phases (after owner decisions)

| Phase | Name | Does |
| --- | --- | --- |
| **01** | Architecture + gap audit | This document + verifier |
| **02** | Job scope + Wall Types + geometry | **Closed (data/UX foundation).** Nested CRUD hosted close is **02C**. |
| **02C** | Nested Wall Type persist + sheet length UX | Canonical `updateWallType` by stable ID; `{ v, types }` CAS; logical overlay rows keyed by Wall Type id; Yes/No same-both-sides; selectable sheet length with height recommendation |
| **03** | Timber framing + first envelope | Shared 90×45 / 140×45 identities; stud/plate/nog takeoff; timber labour; fixings allowance structure; XOR timber vs existing frame / steel. **Lining sheets deferred.** |
| **04** | Steel track/stud physical takeoff | **Closed (IW-04).** |
| **05** | Lining sheets + labour | Face authority, product matrix, vertical sheet takeoff, 10% waste once, hours/sheet labour. **Closed.** |
| **06** | Openings + structural gate + lining deductions | **Closed (this phase).** Net lined m²; additive opening framing; Doors boundary. |
| **07** | Insulation + skirting + cornice + electrical | **Do not start automatically.** |
| **08** | Demolition + waste + Review | Separate demo labour; disposal allowance |
| **09** | DNA | Only if productivity keys are consumed and owner calibrates |
| **10** | Hosted close | Deterministic + Preview proof including lining |

Do not start **08** (stopping / painting / commercial close) in this phase.

---

## 48. Owner decisions required BEFORE WA-INTERNAL-WALLS-02

Historical 01 list. **02 recorded** items 1, 2, 7, 8, 9 in §0A. Remaining items are for **WA-INTERNAL-WALLS-03** (takeoff), not a second 02.

1. Stud centres: 600 ASSUMED_DISCLOSED vs always ask vs 450. **02: recommended 600 ≤2.4 m / 400 >2.4 m, visible/editable.**  
2. Confirm 2.4 m height as residential ASSUMED_DISCLOSED. **02: yes.**  
3. Standard GIB sheet: keep **2400×1200** vs add **3000** identity.  
4. Confirm 10% `sheet_material` waste for IW GIB.  
5. Steel V1: Pricing Required vs out of scope.  
6. Opening lining deduction: yes (recommended) vs Bathroom-style no-deduct disclose.  
7. One WA total length vs per-wall WAs. **02 owner override: multiple Wall Types in one WA.**  
8. Job-scope enum as in §10. **02: implemented.**  
9. Load-bearing yes/unknown → INFO_REQUIRED (recommended). **02: structural gate foundation.**  
10. Lining “Not sure” → INFO_REQUIRED vs disclosed one/both.  
11. Nested stopping/painting remain allowances until siblings mature (recommended).  
12. Do **not** copy Bathroom lining 0.3 h/m² or framing 0.2 h/lm without a new owner benchmark.

---

## 49. What is trustworthy vs fallback vs supersede

| Trustworthy | Fallback / placeholder | Must supersede |
| --- | --- | --- |
| Catalogue type `internal_walls` | $95/m² package | Silent 20 m² |
| Length × height geometry when both known | 1.4 h/m² lining | Always-on framing+lining labour |
| Lining sideFactor when “both” | 0.8 h/lm framing | Ignoring `framing_type` |
| Shared timber + GIB identities (Bathroom-proven timber) | Sheet count shadow | Quality × construction package |
| Painting WA XOR on nested paint | Nested stop/paint $ | Fire question as priced system |
| Project Conditions applicability | Demo 10 lm | Floor-area-as-wall (not current — keep forbidden) |

---

## 50. WA-INTERNAL-WALLS-01 GO criteria

- Current-state inventory complete  
- V1 boundary written  
- Risks ranked  
- Owner decisions listed  
- Verifier asserts current-state claims  
- No product money/question/DNA change  
- No migration 055 / Production  

**GO.** Next action is owner decisions, then WA-INTERNAL-WALLS-02 — not started here.

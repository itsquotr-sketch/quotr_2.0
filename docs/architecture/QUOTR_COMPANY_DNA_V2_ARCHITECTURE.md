# QUOTR — Company DNA V2 Architecture

**Programme:** DNA-V2B.1 — V2 calibration catalogue data seed  
**Status:** Preview migration **054** applied (data-only). V1 hub / Rates still nine tasks. Do **not** start DNA-V2C UI.  
**Preview:** Supabase `shhpjsoldmqtkdbgrbtm` — latest applied migration **054**  
**Production:** DO NOT TOUCH — must remain without 054  

**Code is authority.** This document traces live Deck / Fence / Retaining Wall calculator consumption. It does not invent calibration tasks the estimator cannot consume independently.

Verifiers: `verify-dna-v2a-coverage`, `verify-dna-v2b-foundation`, `verify-dna-v2b1-catalogue-seed`

---

## 1. Product goal

Company DNA should learn:

> How your company normally performs this specific physical task.

Builder input is **workers + clock time** against a defined scenario. The server derives person-hours per canonical unit. Builders are never asked to type productivity ratios in the primary UX.

```
crew size × clock hours          = total person-hours
total person-hours / quantity    = person-hours per unit
```

Example:

8 deck post holes · 2 workers · 3 hours  
→ 6 person-hours  
→ 0.75 person-hours / hole

DNA represents **normal baseline** productivity. Project Conditions (access, carry, height, slope, occupied site, hours) modify the job estimate separately. Bad access must not be baked into company baseline.

---

## 2. Productivity math (preserve)

Canonical model is already live and must be preserved:

| Layer | Authority |
| --- | --- |
| Derivation | `save_productivity_calibration`: `round(crew × duration, 4) / authority_quantity` |
| Evidence | `productivity_calibration_responses` — append / supersede, immutable except status |
| Live hours | `rates` row `rate_type=productivity`, `cost_rate` = hours/unit, `source=calibrated_productivity` |
| Reset | `reset_productivity_to_benchmark` deactivates the rates row; evidence remains |
| Estimate resolution | `resolveProductivity` / `findCompanyProductivityRate`: company active row → in-code benchmark → caller fallback |
| Provenance | `calibrated_productivity` → “Your calibrated productivity”; explicit company hours → “Your company rate”; else “Quotr benchmark” |
| Labour cost | hours × `labour.carpenter.hour` (existing rate hierarchy). DNA never writes labour $/h, materials, or margin |
| Project Conditions | `shapeLabourHours`: `baseHours = qty × hours/unit`; `adjustedHours = baseHours × condition factor` (once) |

Crew size is explicit. Never infer job crew from Quotr seats. Total person-hours is estimator authority.

Current V1 UX stores clock time as decimal `duration_hours`. V2 should collect **hours + minutes** in the UI and convert on the server. No schema change is required for that.

---

## 3. Baseline scenario principles (normal DNA)

One standard calibration baseline, kept short in future UI:

- Normal residential access (not difficult, not a steep bank)
- Materials reasonably close to the workface (carry ≤ 10 m)
- Competent normal crew, normal tools
- No unusual weather, occupied-site, or after-hours restriction
- Ground: **normal** unless the task *is* excavation — then state soil (e.g. “normal soil, not rock”)
- Height: ground-level / low for Deck; 1.8 m for Fence; ~1.0 m for timber retaining
- Method: the estimator’s **normal** method (Fence hand holes; RW machine-assisted piles when a digger can reach)

Job-specific hardness stays on Project Conditions.

---

## 4. Current DNA limitations

DNA-01 is real and wired. It is not yet task-complete.

1. **Catalogue is a shortlist, not coverage.** Nine V1 tasks. Mature calculators consume many more independent labour keys.
2. **Tasks are still somewhat bundled.** “Piles / posts” and “Fence posts” hide hole-digging, set-out, and normal workface handling inside one hours/ea or hours/post key. The estimator owns that bundle — DNA must not pretend the split exists.
3. **Scenarios are job-shaped, not task-shaped.** “Think about a fairly normal 20 m² deck” is the right *setting*, but the quantity the math uses (80 framing-lm, 142.8571 decking-lm, 9 posts) is not the question the builder answers.
4. **Clock time is decimal hours.** Builders think hours and minutes.
5. **Completion is catalogue-relative.** “Using your calibration” fires when **2 high-impact tasks** in a Work Area are calibrated — not when the estimator’s Tier 1 set is complete. RW can look “calibrated” with piles + face while excavation, drainage, backfill, and concrete still use Quotr starters.
6. **Package leftovers still exist.** Lumped `deck.base_labour_hours_per_m2` and `fence.labour_hours_per_lm` remain fallbacks when detailed productivities are missing. DNA-V2 must not calibrate leftover keys.
7. **Some consumed keys cannot currently honour a company rate.** Fence/RW **package** labour call `resolveProductivity` **without** `rates` (intentional — DNA must not calibrate package lumps). Fence demolition **did** omit rates in V2A; **DNA-V2B wired `rates: context.rates`**. Package leftover path still omits rates.
8. **Machine vs manual shares some keys.** RW timber pile hours use one key with a method-specific *fallback*. A company calibration overwrites both methods. Excavation is already split (`machine` vs `manual`).
9. **Material movement and waste carting are not independent labour requirements.** They are bundled in install productivity, Project Condition carry, demolition hours, and/or a **money** spoil/disposal line. Do not fake DNA tasks for them.

---

## 5. Task-boundary rules

For every DNA task:

| Must state | Must not |
| --- | --- |
| Exact physical work included | Vague “install posts” if the estimator actually splits concrete |
| Exact work excluded | A second calibration for labour already inside another requirement |
| Canonical quantity the estimator multiplies | m² “because it is easy” when the live driver is lm / ea / bag / m³ |
| Normal workface handling included | Abnormal carry / access (those are conditions) |
| Waste of **materials** is procurement | Waste **carting** as labour unless the estimator has a labour key |

If a desirable task has no independent estimator key: mark **ESTIMATOR GAP** and classify A–E (section 22). Do not add a catalogue row that writes a rate the calculator will not read.

---

## 6. Coverage method

**Consumed** = a productivity key that the mature detailed money path multiplies into labour hours (Deck `DETAILED_AUTHORITATIVE`, Fence `DETAILED_COMPONENT_AUTHORITY`, RW `DETAILED_COMPONENT_AUTHORITY`).

**Not consumed for DNA-V2** (still documented):

- Leftover / legacy keys (`hours_per_m2` decking/framing, h/hole concrete, RW h/m³ concrete, sleeper face-m²)
- Package lumps used only when detailed split is incomplete
- Plant occupancy keys (machine-hours, not carpenter person-hours)
- Allowances priced in dollars (balustrade, fence disposal, spoil all-in $/m³)

**Calibratable today** = a `productivity_calibration_catalogue` row whose `productivity_rate_key` is consumed on the detailed path **and** the calculator passes org rates into resolution.

Coverage percentages below are **unique consumed detailed keys vs unique catalogue keys that hit those keys.** They are asserted by the verifier so they cannot drift from copy.

---

## 7. Deck matrix

### 7.1 Consumption trace

```
physical calculator (deck.ts)
  → labour line / LabourRequirement
  → productivity key
  → resolveProductivity(rates)
  → hours = qty × hours/unit
  → × Project Condition factor once
  → × labour.carpenter.hour
  → commercial labour line
```

When decking + framing + post productivities are trusted (starters are > 0, so this is the normal mature path), lumped `deck.base_labour_hours_per_m2` is **not** commercial authority.

### 7.2 Per-task rows

#### D1 — Decking-board installation

| Field | Value |
| --- | --- |
| Work Area | Deck |
| Canonical key | `deck.decking.install.hours_per_lm` |
| Builder-facing name | Laying decking |
| Included | Measure, cut, lay, fix boards; ordinary handling at the workface |
| Excluded | Framing, posts, fascia, steps, demolition, off-workface carting, waste as labour (waste is procurement lm) |
| Physical quantity | Required **installed** decking lm (`baseLm`, not purchased waste) |
| Unit | person-hours / lm |
| Quotr benchmark | **0.077** h/lm (from 0.55 h/m² × 0.14 m board) |
| Consumption | `calculators/deck.ts` detailed “Decking installation” |
| Currently calibratable? | **YES** |
| Catalogue key | `deck.decking.v1` |
| Alters estimate hours? | **YES** (detailed path; `resolveProductivity` receives rates) |
| Current scenario | 20 m² · 142.8571 lm authority · “laying decking on a normal 20 m² deck” |
| Priority | **HIGH** |
| Proposed V2 scenario | 20 m² of standard boards on an already-framed deck, good access |
| Proposed question | “How would your crew normally lay the decking on a 20 m² deck once the framing is in?” |
| Material handling | Bundled normal workface only |
| Waste handling | No (procurement) |
| Conditions | Access + carry apply to this line (Deck uses combined labour factor on all detailed lines) |
| Gap | **PRESENTATION RENAME** — ask about laying boards, not “a 20 m² deck job”. Keep key. |

#### D2 — Substructure framing

| Field | Value |
| --- | --- |
| Canonical key | `deck.substructure.install.hours_per_framing_lm` |
| Builder-facing name | Framing (bearers, joists, rim) |
| Included | Cut, set, fix bearers + joists + rim; ordinary handling at the workface |
| Excluded | Pile/post install, hole digging, concrete, decking, blocking/nogs (not a consumed labour key), fascia |
| Quantity | Required installed framing lm = joist + bearer + rim required lm |
| Unit | person-hours / framing-lm |
| Benchmark | **0.13** h/lm (LOW-CONFIDENCE; 0.52 h/m² × 27 / 108) |
| Calibratable / alters hours | **YES** / **YES** |
| Catalogue | `deck.framing.v1` · 20 m² → 80 lm |
| Priority | **HIGH** |
| Proposed question | “How would your crew normally frame a 20 m² timber deck (bearers, joists and rim — posts already in)?” |
| Gap | **KEEP**. Future joist/bearer/rim split keys exist in code (`DECK_SUBSTRUCTURE_FUTURE_SPLIT_KEYS`) but are **not consumed**. Do not calibrate a split. Class **D** remain bundled. |

#### D3 — Pile / post installation (includes holes)

| Field | Value |
| --- | --- |
| Canonical key | `deck.posts.install.hours_per_ea` |
| Builder-facing name | Digging holes and setting piles / posts |
| Included | Set-out, **hole excavation**, hole prep, position, cut/set, plumb, normal install, ordinary workface handling |
| Excluded | Concrete mix/place (separate key), framing, decking, spoil export off site |
| Quantity | Support count (ea) |
| Unit | person-hours / post |
| Benchmark | **0.20** h/ea (12 person-minutes). This is **low** relative to Fence 0.70 h/post which also includes hand holes — high contractor variance, which is why it is Tier 1 despite modest benchmark hours on a 9-post deck (1.8 h). |
| Calibratable / alters hours | **YES** / **YES** |
| Catalogue | `deck.posts.v1` · 9 supports on 20 m² |
| Priority | **HIGH** |
| Proposed scenario | **8** posts / holes on a ground-level deck, normal soil, holes already set out |
| Proposed question | “How would your crew normally dig and set 8 deck posts in normal soil (holes, stand and plumb — not pouring concrete)?” |
| Material handling | Bundled normal |
| Waste handling | Spoil beside hole only; no off-site carting labour |
| Gap | **PRESENTATION RENAME** (and scenario quantity 9 → 8 in a **new scenario version** later). Do **not** split holes vs setting unless the calculator splits. Adding a hole-only DNA task without an estimator split would **double-count**. |

#### D4 — Existing deck removal

| Field | Value |
| --- | --- |
| Canonical key | `deck.demolition_hours_per_m2` |
| Included | Strip existing timber deck; ordinary handling at the workface |
| Excluded | New construction; skip-bin cartage as a separate labour task (not modelled); substructure replacement allowances (money, not this key) |
| Quantity | Deck area m² |
| Unit | person-hours / m² |
| Benchmark | **0.35** |
| Calibratable / alters hours | **YES** / **YES** |
| Catalogue | `deck.demolition.v1` · not high-impact |
| Priority | **MEDIUM** (high when present; not the first-run Deck experience) |
| Proposed question | “How would your crew normally take up an existing 20 m² timber deck (strip the deck — not necessarily loading a bin off site)?” |
| Waste handling | **Bundled / unclear.** No independent waste-movement labour. Fence has a **disposal $ allowance**; Deck demolition does not. **ESTIMATOR GAP C/D.** |

#### D5 — Fascia / edge boards

| Field | Value |
| --- | --- |
| Canonical key | `deck.fascia.install.hours_per_lm` |
| Quantity | Required fascia lm (perimeter × courses — not height-driven) |
| Unit | person-hours / lm |
| Benchmark | **0.45** |
| Calibratable | **NO** — consumed, no catalogue row |
| Alters hours if a company rates row exists | **YES** (Rates typed hours or a future DNA task) |
| Priority | **MEDIUM** |
| Proposed question | “How would your crew normally fix about 18 lm of fascia / edge boards on a normal deck?” |
| Gap | **MISSING** catalogue. Estimator already consumes the key. |

#### D6 — Full-height skirting / screening

| Field | Value |
| --- | --- |
| Canonical key | `deck.skirting.install.hours_per_lm` |
| Quantity | Required skirting lm (height-sensitive when height known) |
| Benchmark | **0.45** |
| Calibratable | **NO** |
| Priority | **LOW** |
| Gap | **MISSING**. Only when explicit skirting scope. Distinct from fascia. |

#### D7 — Post-hole concrete placement

| Field | Value |
| --- | --- |
| Canonical key | `deck.post_hole_concrete.place.hours_per_bag` |
| Included | Bag handling at workface, mix, place, basic finish |
| Excluded | Hole excavation (in D3), post setting |
| Quantity | Purchased 20 kg bags |
| Unit | person-hours / bag |
| Benchmark | **0.16** (Deck-specific; not Fence 0.06 or RW 0.035) |
| Calibratable | **NO** |
| Priority | **MEDIUM** (typical new deck with posts; ~3.6 h on 9 holes × 2.5 bags — more hours than the 0.20 h/ea post line) |
| Proposed question | “How would your crew normally mix and pour 20 bags of post-hole concrete (posts already set)?” |
| Gap | **MISSING**. Do not use legacy `deck.concrete.place.hours_per_hole`. |

#### D8 — Steps

| Field | Value |
| --- | --- |
| Canonical key | `deck.steps.install.hours_per_m2` |
| Quantity | Tread area m² (only when detailed step chain is complete) |
| Unit | person-hours / m² tread — **convenient, not the best physical driver** |
| Benchmark | **4.0** (starter / low-confidence) |
| Calibratable | **NO** |
| Priority | **LOW** |
| Unit finding | Count of treads or hours/step would predict labour better. Changing the driver is an **estimator** change. Until then calibrate h/m² or leave uncalibrated. Class **B** if we split later. |
| Gap | **MISSING**. Incomplete step chain still uses a **$ allowance**, which DNA must not try to calibrate. |

#### D9 — Elevated extra (not a DNA task)

| Field | Value |
| --- | --- |
| Canonical key | `deck.elevated_extra_hours_per_m2` |
| What it is | Height/workface complexity **allowance** on deck area when elevated / height > 0.3 m |
| Calibratable | **NO** — and **should not** be a company baseline task |
| Classification | **C** — Project Condition / height, not DNA |
| Gap | Do not encode “we usually build high decks” into baseline productivity. |

#### D10 — Package lump (not a DNA task)

`deck.base_labour_hours_per_m2` (1.2 h/m²) — **PACKAGE_FALLBACK** only. **REDUNDANT** for DNA-V2. Do not calibrate.

#### Not consumed as labour

| Item | Finding |
| --- | --- |
| Site setup / setout | Bundled in posts (D3) |
| Blocking / nogs | No labour key |
| Balustrade | **$ allowance**, not `deck.balustrade_hours_per_lm` (benchmark leftover) |
| Cleanup | Not modelled |
| Material movement | Bundled + access/carry factor |
| Waste movement | Not independent (see D4) |

### 7.3 Deck Tier 1 decision (section 26)

**Tier 1 must be: posts (incl. holes), framing, decking-board installation.**

Rationale from actual hours on a canonical 20 m² detailed deck (benchmarks, no conditions):

| Task | Approx. person-hours | Why tier |
| --- | --- | --- |
| Decking | ~11.0 | Largest typical line |
| Framing | ~10.4 | Second; always on new decks with substructure |
| Posts (incl. holes) | ~1.8 at 0.20 h/ea | **High variance** (hole digging). Fence analogue is 0.70 h/post. Calibration here moves the estimate more than the tiny starter suggests. |
| Concrete bags | ~3.6 | Materially larger than posts at current starters — **Tier 2**, first refinement |
| Fascia (if in) | ~5–9 | Conditional — Tier 2 |
| Demolition (if in) | ~7.0 | Conditional — already calibratable; **not** first-run Tier 1 |
| Post holes as a separate task | — | **No.** Bundled in posts. Separate DNA would double-count. |
| Material handling | — | **No.** Not an independent key. |

A builder who calibrates those three Tier 1 tasks immediately improves every typical new Deck estimate.

---

## 8. Fence matrix

### 8.1 Consumption trace

Detailed timber / modular: `commercializeFenceWithLabour` → `labourSlot` → `findCompanyProductivityRate` → hours × carpenter $/h → `calculators/fence.ts` applies per-intent access/carry (concrete placement: access only, not carry).

Package path (`fence.labour_hours_per_lm`, `fence.gate_hours_allowance`) is leftover when detailed coverage is incomplete. **Do not calibrate package lumps.**

Ownership (code): post labour **includes set-out, ordinary hole digging, normal workface carry, set/plumb/brace**. Concrete labour **includes bag handling at the workface, mix, place**. No second excavation line.

### 8.2 Per-task rows

#### F1 — Fence posts (includes holes)

| Field | Value |
| --- | --- |
| Key | `fence.post.install.hours_per_post` |
| Included | Set-out, ordinary ~300 mm hand hole, normal-soil handling, set/plumb/brace |
| Excluded | Concrete, rails, palings, demolition, off-site spoil |
| Qty / unit | Post count / person-hours per post |
| Benchmark | **0.70** |
| Calibratable / alters hours | **YES** / **YES** (detailed `labourSlot`) |
| Catalogue | `fence.posts.v1` · 20 lm · 13 posts |
| Priority | **HIGH** |
| Proposed question | “How would your crew normally dig and set 10 posts for a 1.8 m timber paling fence in normal soil (not pouring concrete)?” |
| Proposed scenario qty | **10 posts** (easier than 13; still enough to damp rounding) |

#### F2 — Rails

| Field | Value |
| --- | --- |
| Key | `fence.rail.install.hours_per_lm` |
| Included | Cut, fix rails; ordinary handling |
| Excluded | Posts, palings, capping |
| Qty | Required rail lm (2 vs 3 rails changes hours) |
| Benchmark | **0.08** |
| Calibratable | **YES** · `fence.rails.v1` · 20 lm × 3 = 60 lm |
| Priority | **HIGH** |
| Proposed question | “How would your crew normally fix the rails on 18 lm of 1.8 m paling fence (posts already in, 3 rails)?” |
| Note | Vertical paling only. Horizontal orientation does not emit this slot. |

#### F3 — Vertical palings

| Field | Value |
| --- | --- |
| Key | `fence.board.vertical.hours_per_lm` |
| Qty | Required **board lm** (not face m²) |
| Benchmark | **0.05** |
| Calibratable | **YES** · `fence.boards.v1` · 241.2 lm |
| Priority | **HIGH** |
| Proposed question | “How would your crew normally hang palings on 18 lm of 1.8 m timber paling fence (posts and rails already in)?” |
| Unit quality | **Correct** (piece-count tracks board-lm). Leftover face-m² key is not money. |

#### F4 — Horizontal slats

| Field | Value |
| --- | --- |
| Key | `fence.board.horizontal.hours_per_lm` |
| Benchmark | **0.06** |
| Calibratable | **NO** |
| Priority | **MEDIUM** (alternate of F3; same tier when that system is selected) |
| Gap | **MISSING**. Distinct key — do not reuse vertical paling evidence. |

#### F5 — Post-hole concrete

| Field | Value |
| --- | --- |
| Key | `fence.post_hole_concrete.place.hours_per_bag` |
| Benchmark | **0.06** (Fence-specific) |
| Calibratable | **NO** |
| Priority | **MEDIUM** |
| Carry | **Not** multiplied (workface bags). Access may still apply. |
| Proposed question | “How would your crew normally mix and pour 20 bags of fence post-hole concrete (posts already set)?” |

#### F6 — Capping

| Key | `fence.capping.hours_per_lm` · 0.08 · **MISSING** · **LOW** |
| --- | --- |
| Question | “How would your crew normally fit 18 lm of fence capping?” |

#### F7 — Gate (detailed)

| Key | `fence.gate.install.hours_per_gate` · 2.0 h/gate |
| --- | --- |
| Included | Frame assembly, hang, hinges/latch, alignment |
| Excluded | Face boards (stay on paling/slat labour) |
| Calibratable | **NO** |
| Priority | **LOW** |
| Package leftover | `fence.gate_hours_allowance` — **do not calibrate** |

#### F8 — Modular section install

| Key | `fence.section.install.hours_per_section` · 0.35 h/section · **MISSING** · **MEDIUM** for modular-preferring companies, else LOW |
| --- | --- |

#### F9 — Existing fence removal

| Field | Value |
| --- | --- |
| Key | `fence.demolition_hours_per_lm` |
| Benchmark | **0.25** |
| Calibratable | **YES** foundation `fence.demolition.v1` (hidden from V1 UX). Hosted save still needs a catalogue seed. |
| Alters hours if calibrated today? | **YES (DNA-V2B)** — `calculators/fence.ts` now passes `rates: context.rates`. Quantity authority unchanged. |
| Disposal | Separate **$ allowance** when `fence.disposal_required` — not labour |
| Priority | **MEDIUM** after wiring |
| Gap | Wiring **fixed in DNA-V2B**. Waste carting remains a money allowance, not DNA. |

#### Leftover / not DNA

`fence.labour_hours_per_lm`, `fence.framing.hours_per_lm`, `fence.board.*.hours_per_m2`, `fence.gate_hours_allowance`.

Setout, cleanup, material movement: bundled as for Deck.

### 8.3 Fence Tier 1 (section 27)

**Validated:** posts (incl. holes), rails, palings.

Canonical 20 lm × 1.8 m vertical paling, 13 posts, 3 rails:

| Task | Approx. hours |
| --- | --- |
| Palings | ~12.1 |
| Posts | ~9.1 |
| Rails | ~4.8 |
| Concrete | ~1.6 |
| Capping | ~1.6 if included |

Tier 1 is already **fully calibratable**. DNA-V2D is mostly presentation + Tier 2 keys, not a new foundation.

---

## 9. Retaining Wall matrix

### 9.1 Consumption trace

Detailed: `retaining-wall-commercial.ts` `labourSlot` → `findCompanyProductivityRate` → calculator applies intent modifiers. **Bulk excavation does not inherit material carry.** Other inward-material intents do.

Package face-m² lumps (`retaining_wall.base_labour_hours_per_face_m2`, `excavation_hours_per_face_m2`, `drainage_hours_per_m`) are leftover. Several package `resolveProductivity` calls also omit `rates`.

Plant (`plant.mini_excavator.*`) is machine occupancy, priced as plant days — **not** DNA crew tasks.

Spoil removal is **all-in $/m³** (cartage + tip), not labour.

Pile/post holes: **owned by pile/post install labour**, not bulk excavation. Concrete is h/bag.

### 9.2 Timber (primary DNA-V2 RW)

#### R1 — Timber piles (includes hole attendance)

| Field | Value |
| --- | --- |
| Key | `retaining_wall.timber.piles.install.hours_per_ea` |
| Included (machine-assisted starter) | Set-out, attend machine hole, place, align, plumb, normal handling |
| Excluded | Bulk excavation, concrete, spoil export, mini-excavator **hire** |
| Benchmark | **0.85** h/ea machine; manual fallback **1.80** via `timber1DPileHours` **only when no company rate** |
| Calibratable | **YES** · `retaining_wall.piles.v1` |
| Alters hours | **YES** — and **flattens machine vs manual** once calibrated |
| Priority | **HIGH** |
| Proposed question | “How would your crew normally set 10 timber retaining piles on a normal accessible site (digger on site — your attendance, not the hire clock)?” |
| Gap | **KEEP** for machine-normal DNA. Manual-no-digger is a **condition / method**, not a second baseline. Split keys (**A**) only if we later need independent manual pile productivity. |

#### R2 — Face boards

| Key | `retaining_wall.timber.face_boards.install.hours_per_m2` |
| --- | --- |
| Included | Cut, place, level, fix; normal handling |
| Excluded | Piles, drainage, bulk excavation, cartage |
| Qty / unit | Face m² / h/m² — **acceptable**; face area tracks board work for this system |
| Benchmark | **0.55** |
| Calibratable | **YES** · `retaining_wall.face.v1` |
| Priority | **HIGH** |
| Question | “How would your crew normally fix face boards on a 10 m² timber retaining face (piles already in)?” |

#### R3 — Bulk excavation (crew attendance or hand dig)

| Keys | `retaining_wall.excavation.machine.hours_per_m3` (0.45) · `retaining_wall.excavation.manual.hours_per_m3` (1.6) |
| --- | --- |
| Included | Crew labour on measured bulk cut (machine attendance **or** hand dig) |
| Excluded | Pile holes, spoil export $, plant hire |
| Calibratable | **NO** |
| Priority | **HIGH** (Tier 1) |
| Proposed DNA | Calibrate **machine-assisted** as the normal baseline. Manual key is the no-digger method — either a second task or leave as condition fallback. |
| Unknown volume | Labelled EXCAVATION ALLOWANCE at 0.6 h/face-m² using leftover `excavation.hours_per_m3` with **unit m2** — do not calibrate that leftover. |
| Gap | **MISSING** (two keys). |

#### R4 — Drainage (novacoil)

| Key | `retaining_wall.drainage.install.hours_per_lm` · 0.15 · **MISSING** · **MEDIUM** |
| --- | --- |
| Excluded | Drainage aggregate (that is backfill labour) |

#### R5 — Drainage backfill

| Key | `retaining_wall.backfill.hours_per_m3` · 0.55 · **MISSING** · **MEDIUM** |
| --- | --- |
| Included | Place/spread/basic consolidate drainage metal |
| Excluded | Novacoil, bulk excavation, plate-compactor as plant |

#### R6 — Post-hole concrete (shared timber/sleeper)

| Key | `retaining_wall.post_hole_concrete.place.hours_per_bag` · 0.035 · **MISSING** · **LOW** (small hours) |
| --- | --- |
| Do not use | leftover h/hole or h/m³ |

### 9.3 Sleeper

| Task | Key | Benchmark | Calibratable | Priority |
| --- | --- | --- | --- | --- |
| Steel posts (incl. hole attendance) | `retaining_wall.sleeper.posts.install.hours_per_ea` | 0.95 machine / 2.0 manual fallback | NO | HIGH for sleeper jobs |
| Sleepers | `retaining_wall.sleeper.sleepers.install.hours_per_ea` | 0.22 h/ea | NO | HIGH for sleeper jobs |
| Face m² leftover | `…sleepers.install.hours_per_m2` | — | n/a | leftover |

Drainage, bags, backfill, excavation keys are **shared** with timber.

### 9.4 Masonry (mature family, later in V2E)

Consumed used_now: sub-base h/m², footing h/m³, rebar h/lm, block lay h/m², core fill h/m³, waterproof h/m², plus shared drainage/backfill/excavation.

None are in the DNA catalogue. XOR with subcontract for block lay and waterproofing — DNA is **self-perform only**.

Plant keys: exclude from crew DNA.

### 9.5 RW Tier 1 (section 28)

**Validated for timber (the V2E default path):** excavation (machine-normal), piles, face boards.

Canonical 10 lm × 1.0 m timber:

| Task | Approx. hours |
| --- | --- |
| Piles | ~8.5 |
| Face | ~5.5 |
| Excavation | volume-driven; manual 1.6 h/m³ can dominate |
| Drainage + backfill | smaller |
| Bags | ~0.7 |

Current catalogue has piles + face only. Excavation is the **highest-impact gap** on RW.

---

## 10. Material handling finding

| Work Area | Explicit movement labour? | Carry distance? | Bundled? | Independent key? | DNA? |
| --- | --- | --- | --- | --- | --- |
| Deck | No | Yes — combined factor on detailed labour (all lines) | Yes — “normal handling at the workface” in each install productivity | No | **Do not calibrate.** Abnormal carry is Project Conditions. |
| Fence | No | Yes — per intent; **not** on concrete placement | Yes — posts include normal workface carry | No | Same |
| RW | No | Yes — inward materials; **not** bulk excavation | Yes | No | Same |

Delivery / unload → workface for framing, boards, posts, bags, fence materials, retaining timber, drainage metal: **all bundled or condition-multiplied**.

**ESTIMATOR GAP** if product later wants independent “barrow 30 m” calibration: that requires a new requirement **or** must stay as the existing carry addend (**C**). Inventing a DNA task without a key would not change estimates.

---

## 11. Waste handling finding

| Flow | Model | DNA |
| --- | --- | --- |
| Deck demolition | Labour h/m² strip. No bin-load labour. No disposal $ line in the deck calculator. | Calibrate strip (D4). Carting = **ESTIMATOR GAP D/E** unless a waste labour key is added. |
| Fence demolition | Labour h/lm strip **plus** optional disposal **$ allowance**. | **V2B:** company rates now honour demolition hours. Carting stays money, not DNA. |
| RW spoil | All-in **$/m³** cartage+tip on measured excavation. Explicitly **not** excavation labour, not material carry, no bulking. | Not a productivity task. Rates / waste section. |
| Cleanup | Not modelled | **E** not worth modelling for V2 |
| Spoil beside post holes | Included in hole-digging ownership | Bundled |

Conceptually separate **DEMOLITION** from **WASTE CARTING**. Only demolition has labour keys today (Deck/Fence). RW spoil is commercial cartage, not crew hours.

---

## 12. Project Condition interaction

DNA = normal baseline. Conditions adjust the **job**:

| Condition | Deck | Fence | RW | DNA rule |
| --- | --- | --- | --- | --- |
| `site_access` | Combined factor | Per-intent | Per-intent | Do not bake into baseline |
| `material_carry_distance` | Combined (all detailed) | Inward timber yes; concrete no | Inward yes; excavation no | Same |
| Height / elevated | Extra **productivity key** D9 | Height scales **materials**, not labour hours | Face height is quantity | Do not calibrate D9 |
| `site_slope` / `fence.slope_condition` | Slope addend | Extra slope factor | Access/method | Condition |
| Occupied / working hours | +0.05 each, capped 1.35 | Same family | Same | Condition |
| Ground / rock | Not a structured Deck/Fence productivity split | Services risk is disclosure | Digger access switches **method** and excavation key | DNA = normal soil |
| Demolition flag | Turns on D4 | Turns on F9 | N/A (spoil is $) | Task exists; still a job flag |

**Do not** let builders describe a nightmare access site as “how we normally work.”

**RW pile calibration hazard:** company rate on the single pile key disables the 0.85 vs 1.80 method fallback. V2 copy must say the scenario is **machine-assisted, accessible**. Manual sites keep using method fallback **only if that key is not company-overridden**.

---

## 13. Double-count findings

| Risk | Status | DNA rule |
| --- | --- | --- |
| Setout + post holes + post install | **One** Deck/Fence/RW pile-post key | Do not add setout or hole tasks |
| Hole digging + concrete | Split correctly (holes in posts; mix/place in bags) | Calibrating both is correct, not double |
| Hole digging + bulk excavation (RW) | Code ownership: holes stay in pile/post labour | Do not add “pile holes” DNA |
| Material movement + install + carry factor | Bundled + condition | Do not add movement DNA |
| Demolition labour + waste $ | Fence/RW: labour vs money | Do not treat spoil $ as hours |
| Elevated extra + access | Both can apply on high + tight sites | Elevated is condition-like; don’t DNA it |
| Package lump + detailed lines | XOR by authority mode | Never calibrate package lumps |
| Gate package allowance + detailed gate hours | XOR with detailed | Calibrate `hours_per_gate` only |
| Masonry self-perform + subcontract | XOR | DNA = self-perform |
| Quality factor + productivity | Package Fence still uses finish quality on lumped labour; detailed Fence uses `NO_FINISH_QUALITY_FACTOR` | Ignore for DNA |
| Joist vs bearer vs rim | Combined framing-lm | Do not triple-calibrate |
| Vertical palings + horizontal slats | Alternate orientation | Separate keys; one job uses one |
| RW unknown excavation allowance + measured m³ | Different modes | Do not calibrate leftover allowance key |

---

## 14. Productivity unit findings

| Key family | Live unit | Verdict |
| --- | --- | --- |
| Deck / fence boards | h / installed lm | **Correct** (piece work) |
| Deck framing | h / combined framing-lm | **Correct** for MVP bundle |
| Posts / piles / sleeper posts | h / ea or h / post | **Correct** given hole bundle |
| Concrete place | h / bag | **Correct** |
| Deck demolition | h / m² | Acceptable for strip-out |
| Fence demolition | h / lm | Acceptable |
| RW face timber | h / face-m² | Acceptable for this system |
| RW sleepers | h / ea | **Correct** (discrete units) |
| RW excavation / backfill | h / m³ | **Correct** |
| RW drainage | h / lm | **Correct** |
| Deck steps | h / m² tread | **Weak** — prefer step count later (**B**) |
| Deck elevated extra | h / m² | Condition, not a task unit |
| Package lumps | h / m² or h / lm | Leftover |
| Fence leftover boards | h / m² | Leftover — do not revive |

---

## 15. Current catalogue classification

| Current key | Unit | Benchmark | Current scenario | Class | Why |
| --- | --- | --- | --- | --- | --- |
| `deck.framing.v1` | lm · 80 | 0.13 | 20 m² framing | **KEEP** | Live detailed key; Tier 1 |
| `deck.decking.v1` | lm · 142.8571 | 0.077 | 20 m² decking | **KEEP** + later **PRESENTATION RENAME** | Live; question should say “lay boards” |
| `deck.posts.v1` | ea · 9 | 0.20 | 20 m² · 9 supports | **KEEP** + later **PRESENTATION RENAME** / scenario qty 8 | Live bundle includes holes; do not split key |
| `deck.demolition.v1` | m2 · 20 | 0.35 | 20 m² strip | **KEEP** | Live; not Tier 1 |
| `fence.posts.v1` | post · 13 | 0.70 | 20 lm · 13 posts | **KEEP** + rename toward “dig and set” | Live bundle |
| `fence.boards.v1` | lm · 241.2 | 0.05 | 20 lm palings | **KEEP** | Vertical only |
| `fence.rails.v1` | lm · 60 | 0.08 | 20 lm · 3 rails | **KEEP** | Live |
| `retaining_wall.piles.v1` | ea · 10 | 0.85 | 10 lm · 10 piles | **KEEP** | Machine-normal; disclose method |
| `retaining_wall.face.v1` | m2 · 10 | 0.55 | 10 m² face | **KEEP** | Live |

**SUPERSEDE:** none required for V2A. If post-hole labour is later **split in the estimator**, create `deck.posts.v2` / new productivity key and leave v1 historical.

**REDUNDANT (do not add):** package lumps; leftover h/m²; leftover h/hole; plant occupancy as crew DNA; elevated extra.

**MISSING (consumed, no DNA row):** listed in section 22.

Historical evidence is immutable. Material definition change → **new** `calibration_task_key` (and new `productivity_rate_key` if the physical meaning of hours/unit changes). Do not reinterpret old rows. Do not implement in V2A.

---

## 16. Current calibration coverage

Unique detailed consumed crew-labour keys vs catalogue keys that map onto them.

| Work Area | Calibratable / consumed | % | High-impact (Tier 1) |
| --- | --- | --- | --- |
| Deck | **4 / 8** | **50%** | **3 / 3** (posts, framing, decking). Concrete/fascia/skirting/steps missing. Elevated excluded from denominator. |
| Fence | **3 / 9** | **33%** | **3 / 3** (posts, rails, palings). Concrete, capping, gate, horizontal, section, demolition missing. Demolition currently unwired for rates. |
| Retaining Wall (all systems, no plant) | **2 / 15** | **13%** | Timber Tier 1 **2 / 3** (piles, face; excavation missing) |
| Retaining Wall timber-only keys | **2 / 7** | **29%** | piles, face, machine excav, manual excav, drainage, backfill, bags |

Package leftovers and plant keys are **not** in these denominators.

Verifier prints and asserts these ratios.

---

## 17. Priority tiers

### Deck

| Tier | Tasks |
| --- | --- |
| **1 — first experience** | Posts (incl. holes), framing, decking |
| **2 — refinement** | Concrete bags, fascia, demolition |
| **3 — occasional** | Skirting, steps |

### Fence

| Tier | Tasks |
| --- | --- |
| **1** | Posts (incl. holes), palings, rails |
| **2** | Concrete bags, horizontal slats (when that system), modular sections (when modular) |
| **3** | Capping, gates, demolition (after rates wiring) |

### Retaining wall

| Tier | Tasks |
| --- | --- |
| **1 timber** | Piles, face boards, machine excavation |
| **2 timber** | Drainage, backfill, manual excavation (or condition) |
| **3 timber** | Bags |
| **1 sleeper** | Posts, sleepers, excavation (same excavation keys) |
| **2–3 masonry** | Block lay, footing, excavation; then sub-base, core fill, waterproof, rebar |

Do not require answering everything before estimates improve. Three Tier 1 answers per Work Area is the value moment.

---

## 18. Scenario quantities

Choose quantities that are easy to picture, common, large enough to avoid rounding noise, not a whole commercial project.

| Task | Recommended scenario | Authority qty |
| --- | --- | --- |
| Deck posts | 8 posts, normal soil | 8 ea |
| Deck framing | 20 m² deck, posts in | 80 lm (keep conversion; tell the builder “a 20 m² frame”) |
| Deck decking | 20 m² boards, framing in | 142.8571 lm (tell the builder “20 m² of boards”) |
| Deck demo | 20 m² strip | 20 m² |
| Deck fascia | 18 lm | 18 lm |
| Deck skirting | 18 lm | 18 lm |
| Deck concrete | 20 bags | 20 bag |
| Deck steps | 6 treads / ~2 m² tread (if kept on h/m²) | 2 m² |
| Fence posts | 10 posts | 10 post |
| Fence rails | 18 lm × 3 rails | 54 lm |
| Fence palings | 18 lm × 1.8 m | ~217 board-lm (recompute from board width in V2B; do not invent a new estimator) |
| Fence horizontal | 18 lm | slat-lm from takeoff helper |
| Fence concrete | 20 bags | 20 bag |
| Fence capping | 18 lm | 18 lm |
| Fence gate | 1 gate | 1 gate |
| Fence section | 8 sections | 8 section |
| Fence demo | 18 lm | 18 lm |
| RW piles | 10 piles | 10 ea |
| RW face | 10 m² | 10 m² |
| RW excavation | 4 m³ machine-assisted | 4 m³ |
| RW drainage | 10 lm | 10 lm |
| RW backfill | 2 m³ | 2 m³ |
| RW bags | 20 bags | 20 bag |
| RW sleepers | 20 sleepers | 20 ea |
| RW sleeper posts | 8 posts | 8 ea |

Changing `authority_quantity` on an existing `calibration_task_key` would silently change what old evidence means. **V2B must add new scenario versions / keys**, not UPDATE v1 rows in place.

---

## 19. Builder questions (primary UX)

Pattern:

1. One sentence scenario (normal conditions).
2. Workers (stepper).
3. Time: hours + minutes (not decimal).
4. Immediate derived result.

Do not say “productivity”, “hours per unit”, or “authority quantity” in the primary prompt.

Examples are in the matrices. Additional:

- RW excavation: “How would your crew normally excavate 4 m³ for a retaining wall with a mini-digger on a normal accessible site (your labour — not the hire clock)?”
- Fence palings: posts and rails already in.
- Concrete: posts already set.

---

## 20. Result language

After save:

> That means your crew uses about **45 person-minutes per post**.

Then:

> About **18% faster** than the Quotr benchmark.

Secondary (not the first line):

> Your productivity: 0.75 person-hours / hole  
> Quotr benchmark: 0.91 person-hours / hole

Use the same comparison helper already in `formatDnaComparisonCopy` (hide <5% as “close to the Quotr benchmark”). Convert hours/unit to person-minutes when the unit is ea/post/hole/bag/gate.

Server remains authoritative; the UI only displays `derived_productivity`.

---

## 21. Progressive completion

Statuses (Work Area):

| Status | Rule (V2) |
| --- | --- |
| Not calibrated | 0 Tier 1 tasks calibrated |
| Partly calibrated | ≥1 Tier 1, not all Tier 1 |
| Using your calibration | **All Tier 1** for that Work Area |

Do **not** require 100% catalogue completion. Tier 2/3 never block this status.

**Change from V1:** V1 uses `highImpactCalibrated >= 2` (`companyDnaWorkAreaStatus`). That lets RW look complete without excavation, and would let Deck look complete with framing+decking and **no posts**. V2 should require the full Tier 1 set (3 for Deck/Fence timber; 3 for RW timber once excavation is calibratable). Until excavation exists, RW V2 rule is **piles + face** (current two high-impact rows) — document as temporary.

A builder can calibrate 3 key tasks → estimates improve → continue later.

---

## 22. Estimator gaps (A–E)

| Desired task | Class | Notes |
| --- | --- | --- |
| Deck/Fence/RW independent post-hole digging | **D** | Already inside post/pile labour. Split only with calculator split (**B**) later. |
| Independent setout | **D** | Bundled |
| Independent material movement | **C** or **E** | Carry addend exists. New key (**A**) only if product wants distance-specific hours. |
| Deck waste carting | **E** / later **A** | No labour key; not worth V2 |
| Fence demo company rates | **A** | Same key; pass `rates` into `resolveProductivity` |
| Fence/RW package lumps honouring DNA | **D** | Do not; promote detailed |
| Cleanup | **E** | |
| Deck elevated as DNA | **C** | Height condition |
| Deck steps h/step | **B** | Unit change |
| Framing joist vs bearer vs rim | **D** now; **B** later | Keys reserved, unused |
| Blocking/nogs | **E** | Not consumed |
| Balustrade labour | **E** until estimator leaves $ allowance | |
| RW manual vs machine piles as two live rates | **A** (split key) or **C** (method fallback, no company flatten) | Do not overwrite blindly without copy |
| RW spoil as labour | **E** | Money all-in m³ |
| Plant as DNA crew task | **E** | Plant Rates |
| Ground-rock multiplier | **C** | Not a DNA baseline |

---

## 23. Outlier model

Keep current architecture (`lib/company-dna/derive.ts` + RPC):

| Check | Threshold | Behaviour |
| --- | --- | --- |
| Hard crew | 1–20 | Reject |
| Hard duration | 0.25–200 h | Reject |
| Hard ratio vs benchmark | 0.05–20× | Reject |
| Warn crew | > 8 | Confirm |
| Warn duration | > 40 h | Confirm |
| Warn ratio | < 0.5× or > 2× | Confirm |

Copy: “That seems much faster/slower than typical. Is that right?” Builder remains final authority. Do not block valid unusual companies.

V2 hours+minutes must convert before these checks (e.g. 0 hours 10 minutes = 0.1667 h → below 0.25 hard minimum — show a friendly “enter at least 15 minutes” rather than `DNA:INVALID_DURATION`).

---

## 24. Rates integration (preserve POLISH-03)

Rates already groups productivity by Work Area (`summarizeProductivityWorkAreas`).

V2 must keep compact grouping:

```
Deck
3 of 3 key tasks calibrated
Using your calibration
[Continue]

  Laying decking     Your calibration
  Framing            Quotr benchmark
  …
```

Do **not** return to a giant spreadsheet as the primary experience. Expanded rows stay compact. Commercial $/h remains Owner/Admin. Estimator productivity writes stay on DNA RPCs.

Progress copy should use **Tier 1** counts (“3 of 3 key tasks”), not all catalogue rows, matching section 21.

---

## 25. Dashboard / setup prompts

Replace generic “Continue calibration” with Work Area + remaining Tier 1:

- “Improve your Deck estimates”
- “Calibrate 2 more key Deck tasks”
- “Finish Fence posts, rails and palings”

`lib/setup/personalisation-ladder.ts` currently uses org-level `hasHighImpactCalibration` (any WA with ≥2 high-impact). V2 should prefer the user’s **primary** Work Area Tier 1 remainder. Do not implement in V2A.

---

## 26. UX flow (propose only)

Mobile-first. One task at a time. No spreadsheet.

```
Calibration home
  → choose Work Area
  → short “normal scenario” assumptions
  → task N of Tier 1 (then Tier 2)
  → workers + hours + minutes
  → derived result + vs Quotr
  → Next
  → progress
  → Work Area summary
```

Edit = new evidence, supersede active, rewrite rates.  
Reset = “Use Quotr benchmark”; evidence retained; future estimates use benchmark; existing estimates stale until updated (`mark_estimates_stale_for_work_area_type`).

Time control: numeric stepper for workers; hours and minutes fields; server converts to `duration_hours`.

---

## 27. Data model assessment

Existing objects are sufficient for DNA-V2:

- `productivity_calibration_catalogue` — versioned scenarios, keys, units, benchmarks
- `productivity_calibration_responses` — crew, duration, derived hours/unit, outlier flag, append/supersede
- `rates.source` / `source_calibration_id` / `updated_by` / `numeric(12,4)` hours

Included/excluded copy can live in `prompt` / `scenario_summary` (or `mapping_metadata` on save). Hours+minutes need no extra columns.

**NO SCHEMA MIGRATION NEEDED** to build DNA-V2.

**DATA MIGRATION 054 (DNA-V2B.1, Preview):** INSERT of the 22 approved V2B foundation keys into `productivity_calibration_catalogue`. Idempotent `ON CONFLICT DO NOTHING`. Catalogue seed, not `ALTER TABLE`. Not applied to Production.

Do **not** UPDATE v1 `authority_quantity` in place (would misread old evidence).

Do **not** add unique(`productivity_rate_key`) — versioned tasks may map to one live key until a meaning change forces a new productivity key.

Estimate-time resolution stays one in-memory `rates[]` find. Expanding the catalogue does **not** add runtime lookup chains. Calibration is write-time evidence.

---

## 28. Permissions

Preserve SECURITY-053:

| Role | Calibration | Commercial rates |
| --- | --- | --- |
| Owner / Admin | `company.calibration.manage` | `company.rates.manage` |
| Estimator | Calibration RPCs only | No commercial $/h DML |
| Viewer | Read-only | No |

No permission model change in DNA-V2.

---

## 29. Performance

No extra estimate-time joins. Org rates already loaded per estimate. Catalogue is global constants (UX + RPC). More tasks = more DNA screens, not slower estimating.

---

## 30. Implementation phases

| Phase | Scope | Product behaviour |
| --- | --- | --- |
| **DNA-V2A** | This audit: architecture doc + coverage verifier | **None** |
| **DNA-V2B** | Code-side foundation catalogue + clock/tier helpers + Fence demolition rates wiring. New keys hidden from V1 UX. | **None** (V1 DNA UX unchanged) |
| **DNA-V2B.1** | Migration **054** data-only catalogue seed. RPC can persist new keys. Server action still V1-gated. | **None** visible. Persistence unlocked for V2C. |
| **DNA-V2C** | Deck task calibration UX (Tier 1 then 2). Requires approved catalogue seed if new keys must persist. | Deck DNA UX |
| **DNA-V2D** | Fence UX + remaining presentation | Fence DNA UX |
| **DNA-V2E** | RW timber (then sleeper); masonry later in same phase if cheap | RW DNA UX |
| **DNA-V2F** | Rates compact progress + Dashboard/setup copy + hosted proof | Prompts / Rates only |
| **DNA-V2-EST-1** | Remaining estimator: optional pile machine/manual **key split**; optional Deck steps unit split. Fence demolition rates wiring **done in V2B**. | Calculator — **not** in C–F |

Preferred next build after DNA-V2C review: **DNA-V2D Fence UX**. Do not start V2D until reviewed.

### DNA-V2C Deck UX

**Status:** Deck-only task-level calibration. Fence/RW remain V1.

- Unified save lookup: `resolveCompanyDnaTask` → foundation (V1 + seeded V2 keys)
- Hours + minutes convert on the server with `durationHoursFromClock` before RPC
- Deck UI order: posts → framing → decking → concrete → fascia → demolition → skirting
- Completion: `companyDnaWorkAreaStatusV2` (3/3 Tier 1)
- No migration 055

Out of scope: Production, billing, quote acceptance, email, Dashboard **layout**, Rates **layout**, POLISH-01/02/03/03B, auth stability.

---

## 31. Production status

Production is **not in scope**. Preview only. Migration **054** is Preview-first (data-only catalogue seed). Do not apply to Production in this phase. No Production Auth / Production Supabase.

Auth stability: do not rotate passwords for `jeanluc@erccontracting.co.nz` or `hello@erccontracting.co.nz`. Plus-address fixtures only. Canonical owner host remains the git hardening URL.

---

## 32. Exact recommended next build

**DNA-V2C — Deck calibration UX**, after V2B.1 review.

054 is applied on Preview. `saveCompanyDnaCalibration` must look up foundation tasks before new Deck keys can be saved from the app. Do not expose unfinished V2 workflow until the Deck UX ships.

STOP. Do not implement DNA-V2C UI until reviewed.

---

## 33. DNA-V2B foundation outcomes

**Status:** code-side foundation + Preview 054 data seed. No V2 UI. V1 hub/Rates still nine tasks.

Verifier: `npx --yes tsx scripts/verify-dna-v2b-foundation.ts`

### Catalogue

- **Kept (V1, 9 rows):** `deck.framing.v1`, `deck.decking.v1`, `deck.posts.v1`, `deck.demolition.v1`, `fence.posts.v1`, `fence.boards.v1`, `fence.rails.v1`, `retaining_wall.piles.v1`, `retaining_wall.face.v1`. Keys, authority quantities, and benchmarks unchanged.
- **Live UX** still uses `COMPANY_DNA_TASKS` only. New rows have `exposeInCurrentUi: false`.
- **New rows** live in `lib/company-dna/v2-foundation.ts` and are now persistable via RPC after Preview 054. Live save action still V1-gated until DNA-V2C.

### Deck added / deferred

| Added | Key | Productivity | Unit | Tier |
| --- | --- | --- | --- | --- |
| Fascia | `deck.fascia.v1` | `deck.fascia.install.hours_per_lm` | lm | 2 |
| Skirting | `deck.skirting.v1` | `deck.skirting.install.hours_per_lm` | lm | 3 |
| Concrete bags | `deck.concrete.v1` | `deck.post_hole_concrete.place.hours_per_bag` | bag | 2 |
| **DEFERRED** | — | `deck.steps.install.hours_per_m2` | m² tread | — |

Steps remain consumed as h/m². A builder-facing h/step question would be a false calibration. Do not change the estimator unit in V2B.

### Fence added / deferred

Horizontal slats, capping, gate, post-hole bags, modular sections, demolition. No package-lump rows. Demolition added only after rates wiring.

Horizontal authority quantity is **198 slat-lm** (11 courses × 18 lm at 1.8 m / 150 mm / 10 mm gap), not 18 fence-lm.

### Retaining wall added / deferred

Machine excavation and manual excavation are **distinct keys**. Drainage, backfill, bags, sleeper posts (machine-assisted baseline), sleepers, masonry sub-base / footing / rebar / block / core fill / waterproof.

**Not added:** plant occupancy, package lumps, elevated-extra, material movement, waste carting, generic cleanup.

### Fence demolition fix

`resolveProductivity({ productivityKey: "fence.demolition_hours_per_lm", …, rates: context.rates })`. Company calibrated hours change labour hours; demolition quantity stays length-authoritative.

### RW pile method (decision B)

Do **not** split `retaining_wall.timber.piles.install.hours_per_ea` in V2B (would orphan V1 pile calibrations). Keep one V1 row constrained to **machine-assisted**. Same for sleeper posts. Split keys = **DNA-V2-EST-1**. Do not point two catalogue rows at one shared company rate.

### Migration 054 (DNA-V2B.1)

**Approved data-only seed:** `supabase/migrations/054_company_dna_v2_catalogue_seed.sql`

- INSERT of the 22 V2B foundation keys into `productivity_calibration_catalogue`
- `ON CONFLICT (calibration_task_key) DO NOTHING` — never mutates V1 rows
- No ALTER, no new tables, no RLS, no RPC rewrite, no response/rate mutation

**Source of truth:** code (`v2-foundation.ts`) is canonical for full metadata. 054 seeds the persistable identity the RPC FK requires (key, productivity key, quantities, units, benchmark, prompt/summary). Benchmarks must not drift.

**V1 live UX remains 9 tasks** via `COMPANY_DNA_TASKS`. New DB rows do not appear in hub/Rates until DNA-V2C.

**Save path:** `save_productivity_calibration` already looks up the DB catalogue. `saveCompanyDnaCalibration` still uses `getCompanyDnaTask` (V1 only). DNA-V2C must switch that lookup to `getCompanyDnaFoundationTask` without exposing unfinished UX before the Deck UI ships.

### Foundation coverage (honest consumed keys)

| Work Area | V1 live UX | V2B foundation |
| --- | --- | --- |
| Deck | 4 / 8 | **7 / 8** (steps deferred) |
| Fence | 3 / 9 | **9 / 9** |
| Retaining Wall | 2 / 15 | **15 / 15** |

Tier metadata is `priorityTier` 1|2|3 on foundation tasks. V2 completion helper `companyDnaWorkAreaStatusV2` is **not** wired into hub/Rates.

# Scenario Coverage Matrix

**Status:** Batch 2B.2B + 2B.3B executable map update  
**Scenarios:** CCS-001 … CCS-052 (52)  
**Companions:** `CANONICAL_COMMERCIAL_SCENARIOS.md` · `GOLDEN_PRICING_EXPECTED_RESULTS.md` · `GOLDEN_SCENARIO_EXECUTION_MAP.md`

---

## 1. Category coverage (A–Z)

| Category | Name | Scenario IDs | Covered? |
| --- | --- | --- | --- |
| A | Basic quantity × rate | 001, 003, 028, 031, 033, 036, 037 | Yes |
| B | Productivity labour | 002, 014, 027, 034, 051 | Yes |
| C | Material + labour | 002, 004, 013, 018, 030, 035, 040, 049 | Yes |
| D | Material + labour + subcontractor | 005, 017, 029, 032, 038 | Yes |
| E | Lump sum | 006, 039, 041, 042, 047 | Yes |
| F | Allowances | 007, 011, 015, 016, 048, 050 | Yes |
| G | Provisional sums | 008 | Yes |
| H | No charge | 009 | Yes |
| I | Zero value information | 010 | Yes |
| J | Travel | 011, 039 | Yes |
| K | Airport security | 012 | Yes |
| L | Occupied building | 013 | Yes |
| M | Poor access | 014 | Yes |
| N | Restricted hours | 015, 050 | Yes |
| O | Long material carry | 016 | Yes |
| P | Steep site | 017 | Yes |
| Q | Multiple work areas | 018, 038, 045, 049 | Yes |
| R | Quote revision | 019, 040, 045 | Yes |
| S | Historical snapshot | 019, 020 | Yes |
| T | GST variations | 021, 022 | Yes |
| U | Manual margin override | 023, 046 | Yes |
| V | Mixed margin documents | 024 | Yes |
| W | Estimate ranges | 025 | Yes |
| X | Builder corrections | 026, 046, 052 | Yes |
| Y | Historical learning candidates | 027–029, 051, 052 | Yes |
| Z | Future Company DNA candidates | 030, 038, 049, 050, 052 | Yes |
| — | Validation / reject paths | 043, 044 | Yes |

**Category coverage: 26/26 letter categories + validation = 100% of required A–Z set.**

---

## 2. Pricing capability coverage

| Capability | Scenario IDs | Covered? |
| --- | --- | --- |
| Quantity calculations | 001, 003, 028, 031, 033, 037 | Yes |
| Productivity / hours | 002, 013, 014, 027, 034, 051 | Yes |
| Sell-from-gross-margin | 001–005, 023, many | Yes |
| Derived markup metric | 001, 002 (explicit) | Yes |
| Waste before money | 003, 036, 037 | Yes |
| Material + labour package | 004, 030, 035 | Yes |
| Subcontractor lines | 005, 017, 029, 032 | Yes |
| Lump sum cost+sell | 006, 039, 047 | Yes |
| Lump sum zero qty | 041 | Yes |
| Lump sum sell-only / cost unknown | 042 | Yes |
| Allowances | 007, 048 | Yes |
| Provisional | 008 | Yes |
| No-charge zero | 009 | Yes |
| Informational zero | 010 | Yes |
| Travel / airport / access loadings | 011–016, 050 | Yes |
| Multi-area aggregation | 018, 038, 049 | Yes |
| Quote revision | 019 | Yes |
| Historical immutability | 020 | Yes |
| GST document-level | 021, 022 | Yes |
| Document GST rate authority (C-28) | 022 | Yes |
| Target margin override | 023 | Yes |
| Mixed line margins | 024 | Yes |
| Estimate ranges | 025 | Yes |
| Confidence ≠ range | 025 | Yes |
| Builder correction / AI non-authority | 026 | Yes |
| Labour-only / material-only / sub-only | 027–029 | Yes |
| Visibility pricing vs quote | 045 | Yes |
| Recalibration preserve manual | 046 | Yes |
| Contingency manual line | 048 | Yes |
| Variation pricing | 040 | Yes |
| Minimum labour modifier | 051 | Yes |
| Validation reject negatives | 043 | Yes |
| Validation reject margin >95 | 044 | Yes |
| Rounding line-then-sum | all money scenarios | Yes |
| Persistence of overrides | 026, 046, 052 | Yes |
| Snapshot behaviour | 019, 020 | Yes |
| Warnings | 007, 008, 013, 014, 042, 045, 051 | Yes |
| Future learning hooks | 014, 026, 052, Z-tagged | Yes |
| Explainability / commercial reasoning | all scenarios | Yes |

**Capability coverage: 100% of listed MVP pricing capabilities have ≥1 scenario.**

---

## 3. NZ residential / builder workflow coverage

| Workflow theme | Scenarios |
| --- | --- |
| Decks / outdoor | 001–003, 014, 018, 040 |
| Bathrooms | 004, 007, 009, 013, 051 |
| Kitchens | 005 |
| Extensions | 008, 031, 049 |
| Demolition / soft strip | 006 |
| Retaining | 017 |
| Fencing | 027, 052 |
| Concrete | 033 |
| Steel | 032 |
| Timber framing | 031 |
| GIB / paint | 028, 030 |
| Flooring | 037 |
| Roofing | 036 |
| Windows | 034 |
| Cladding | 035 |
| Commercial fitout | 038 |
| Airport / occupied / access | 012–016 |
| Site establishment / travel | 011, 039 |
| Labour / material / sub only | 027–029 |
| Variations / revisions | 019, 040 |
| Learning / DNA candidates | 052 (+ Z tags) |

---

## 4. Coverage percentage summary

| Lens | Coverage |
| --- | --- |
| Categories A–Z | **100%** (26/26) |
| Listed pricing capabilities | **100%** |
| Canonical scenario count | **52** |
| Executable kernel fixtures (2B.3B) | **47/52 (90.4%)** |
| Deferred / documentation-only | **5/52** |
| Supplemental EXT fixtures | **13** |
| Validation reject paths | **2** CCS + EXT validation suite |
| Explicit DNA/learning candidates | **≥5** (Z/Y tagged) |

---

## 5. Strategic review

### Coverage summary

The library covers the full commercial category alphabet requested, core money modes (qty×rate, productivity, lump sum), GST, overrides, snapshots, multi-area aggregation, NZ residential staples, and constrained-site loadings expressed as explicit commercial lines or hour factors.

Batch **2B.3B** converted executable scenarios into deterministic fixtures under `lib/commercial-engine/fixtures/` with runner `scripts/verify-batch-2b3b-golden-commercial-engine.ts`. See `GOLDEN_SCENARIO_EXECUTION_MAP.md`.

### Commercial gaps discovered

1. **Owner decisions Confirmed** (Batch 2B.3B) — blocking OCDs no longer Pending.  
2. **Mixed crew OT rate cards** — intentionally deferred (CCS-050 allowance pattern only).  
3. **Auto contingency % / overhead engine** — not scenario-required as active features; manual contingency only (CCS-048).  
4. **Distinct provisional-sum type** — modelled via allowance/lump (CCS-008).  
5. **Quote visibility warning UX** — kernel supports `visible_only` (CCS-045); product warning may land Stage 6.  
6. **Non-15% GST** — covered by supplemental `EXT-GST-0` / `EXT-GST-10` / `EXT-GST-100`.  
7. **Deep commercial fitout line detail** — CCS-038 is package-level; expand to line fixtures in 2B.5 if needed.  
8. **Deferred CCS** — 019, 020, 025, 046, 052 remain outside pure-kernel executability.

### Additional owner decisions (if any)

Blocking Batch 2B.3 OCDs are **Confirmed**. Remaining deferred OCDs stay Deferred until later batches.

### Future Company DNA readiness

**Good substrate:** override scenarios (026, 046, 052), constraint loadings (014–016), trade packages (049, 038), and explicit “evidence not auto-write” rule (052).  
**Not ready / not implemented:** actuals capture, automatic rate learning, scenario clustering runtime.

### Future benchmarking readiness

**Partial:** company vs derived sells and rate provenance hooks in reasoning.  
**Gap:** no cross-company network scenarios (correctly out of MVP scope).

### Future AI coaching readiness

**Good:** commercial reasoning fields on every scenario; correction patterns (026, 052).  
**Gap:** coaching copy not productised; scenarios are the reference corpus.

### Future Scenario Learning readiness

**Good:** tagged learning candidates; provisional→actual hook (008); variation (040).  
**Gap:** no completed-project actuals schema in MVP.

### Recommended additional scenarios (later)

1. Multi-user same-company edit of one pricing doc (tenancy+money).  
2. Dual currency display NZD-only confirmation (if AUD confusion persists).  
3. Package/assembly line if Stage 6 introduces packages.  
4. Expanded commercial fitout line-level fixture set.

### Assessment: Batch 2B.3 status

**Batches 2B.3A and 2B.3B are complete.** Kernel + golden regression suite exist. **No application adoption.** Next: 2B.4 / 2B.5 when authorised.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/SCENARIO_COVERAGE_MATRIX.md` |
| Batch | 2B.2B + 2B.3B update |
| Executable golden coverage | 47/52 CCS + 13 EXT |
| Application adoption | **None** |

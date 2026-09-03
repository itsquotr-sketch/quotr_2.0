# COMPANY DNA-01 — Architecture audit + migration 052 proposal

**Status:** 052 APPROVED and applied on Preview (`shhpjsoldmqtkdbgrbtm`). Production (`lxvnylhsbvudzzupxeqr`) remains 045 — DO NOT TOUCH.  
**HEAD audited:** `fca0a3067d669e3302645bd99ea931fdbf4433fd` (`hardening/stage-2a-security`)  
**Implementation:** Company DNA-01 foundation + UX on this branch.

---

## 1. Gate decision

Existing schema **cannot** honestly represent:

1. raw crew × time × typical-scope evidence  
2. derived company productivity authority  
3. source metadata that distinguishes Quotr benchmark / your rate / your calibrated productivity  

A compromise (JSONB stuffing + silent `rates.cost_rate` writes) would violate the 033 evidence contract, collapse calibrated vs explicit, round productivity incorrectly (`numeric(12,2)`), and invent a schema to avoid 052.

**STOP before creating 052. Approve this proposal, then implement.**

---

## 2. Current calibration architecture

### 2.1 Product surfaces

| Surface | Location | What it does today |
| --- | --- | --- |
| Dashboard CTA | `lib/setup/personalisation-ladder.ts` | “Calibrate how you work” → `/app/setup?mode=improve&section=calibrate` |
| Setup hub | `components/calibration/CalibrationHub.tsx` | Preference-ordered Deck + Bathroom job cards |
| Flow | `components/calibration/CalibrationFlow.tsx` + `/app/setup/calibrate/[scenarioId]` | Whole-job questions → observational compare → save evidence |
| Catalogue | `lib/calibration/catalogue.ts` | Static `deck.standard_pine.v1`, `bathroom.standard_reno.v1` |
| Compare | `lib/calibration/compare.ts` | Synthetic `calculateEstimate` vs user cost/sell — **never writes rates** |
| Persistence | `lib/calibration/persistence.ts` + RPC `save_calibration_response` | Append/supersede `calibration_responses` |
| Readiness | `lib/setup/readiness-actions.ts` | `hasCalibration` = any active 033 row |

### 2.2 `calibration_responses` (migration 033)

Evidence **only**. Comment: *“Never live rate authority.”*

Commercial columns: `labour_hours`, `labour_cost`, `materials_cost`, `subcontractors_cost`, `other_cost`, `expected_total_cost`, `expected_sell`, `confidence`, `notes`.

History: one **active** row per `(org_id, scenario_id)`; recalibrate supersedes. Evidence immutable except status → superseded.

`response_metadata` jsonb is explicitly **not** a substitute for commercial columns.

**Missing for Company DNA:** `crew_size`, `duration_hours`, `typical_quantity`, `quantity_unit`, `task_id`, `productivity_key`, derived hours/unit, link to applied authority.

Questions today ask hours **and** materials cost **and** expected sell. That is pricing calibration, not productivity calibration.

### 2.3 `organisation_work_areas` (003)

Preference store (`enabled`, `sort_order`). Personalises Setup/Rates/calibration order. Does **not** lock estimator capability.

### 2.4 Legacy calibration decision (do not implement until 052)

| Decision | Rule |
| --- | --- |
| Existing 033 rows | Preserve as historical **job-cost evidence**. Do not delete. |
| Auto-promote | **Forbidden.** Hours without crew + typical quantity + task mapping are not productivity authority. Cost/sell must never become rates. |
| Route | After DNA ships: Dashboard CTA and Improve Calibrate must **not** land on the old cost/sell flow. Redirect to new landing. Keep old `/app/setup/calibrate/[scenarioId]` as read-only historical view or deprecate with redirect. |
| Components | Do not delete `CalibrationHub` / `CalibrationFlow` until redirect exists; reuse layout patterns only. |

---

## 3. Current productivity authority

Canonical identity: **person-hours per physical unit**.

### 3.1 Resolver (live)

`lib/estimate/productivity.ts` → `resolveProductivity`:

```
company rates row (rate_type = productivity, active, cost_rate > 0, unit compatible)
  > BENCHMARK_PRODUCTIVITY catalogue (in-code)
  > caller fallbackHoursPerUnit
```

Company override is stored as `rates.cost_rate` meaning **hours/unit**, not dollars. Label today: company hit → “Your company rate”; catalogue → “Benchmark productivity”.

**No calibrated-productivity source exists.**

Rates are loaded once per estimate (`getRatesPageState` / estimate context `rates[]`). Resolver is in-memory find — no N+1. Preserve batched org rates load.

### 3.2 Work Area maturity (V1 eligibility)

| Work Area | Live productivity authority | V1 calibrate? |
| --- | --- | --- |
| **Deck** | Quantity-driven: decking h/lm, framing h/framing-lm, posts h/ea, fascia h/lm, demo h/m², steps, bags. Legacy h/m² leftover (not detailed money). | **Yes** |
| **Fence** | Timber 1B: posts h/post, rails h/lm, boards h/lm, capping, gate, bags. Package `fence.labour_hours_per_lm` is modular/incomplete path. | **Yes (timber tasks)** |
| **Retaining wall** | Timber/sleeper component hours (piles h/ea, face h/m², bags). Plant keys separate. Package face-m² leftover. | **Yes (timber tasks)** |
| Bathroom | Mix of h/m² lump + allowances; not clean task identities | **No** |
| Kitchen | Package / allowance hours | **No** |
| Pergola | Base + roofing h/m² lumps | **No** |
| Internal walls / flooring / painting | Fitout area lumps (`lib/estimate/calculators/fitout.ts`) | **No** |
| Demolition (standalone) | `demolition.labour_hours_per_m2` lump | **No** as its own WA card |

**V1 Work Areas:** Deck, Fence, Retaining wall.

Do not calibrate a key that is leftover / not consumed for detailed money (e.g. `deck.substructure.install.hours_per_m2`, `deck.decking.install.hours_per_m2`).

### 3.3 V1 tasks (highest labour impact)

Do not ask 15 questions. Four / three / two.

**Deck** (scenario: ~20 m², ground-level/low, normal access, standard timber):

| Task id | User language | Maps to live key | Typical quantity shown | Authority unit |
| --- | --- | --- | --- | --- |
| `deck.framing` | Framing (bearers/joists) | `deck.substructure.install.hours_per_framing_lm` | 20 m² deck | h / framing lm |
| `deck.decking` | Decking installation | `deck.decking.install.hours_per_lm` | 20 m² deck | h / decking lm |
| `deck.posts` | Piles / posts | `deck.posts.install.hours_per_ea` | 20 m² deck (~8 posts, catalogue-declared) | h / ea |
| `deck.demolition` | Taking up an existing deck | `deck.demolition_hours_per_m2` | 20 m² | h / m² |

Deferred: fascia, skirting, steps, balustrade, bagged concrete, elevated extra, base lump.

**Fence** (scenario: 20 lm, 1.8 m timber paling, straight run, normal access):

| Task id | Maps to live key |
| --- | --- |
| `fence.posts` | `fence.post.install.hours_per_post` |
| `fence.boards` | `fence.board.vertical.hours_per_lm` |
| `fence.rails` | `fence.rail.install.hours_per_lm` |

Deferred: capping, gate, bags, horizontal slats, modular package labour.

**Retaining wall** (scenario: 10 lm, 1.0 m, timber, normal access):

| Task id | Maps to live key |
| --- | --- |
| `rw.piles` | `retaining_wall.timber.piles.install.hours_per_ea` |
| `rw.face` | `retaining_wall.timber.face_boards.install.hours_per_m2` |

Deferred: excavation/plant, drainage, sleeper/masonry, bags.

### 3.4 Scenario → authority unit mapping (critical)

User answers in **job language** (20 m² deck). Live Deck framing money uses **h/framing-lm**, not h/m².

Calibration must **not** run `calculateEstimate` as a parallel estimator. Each task catalogue entry declares a **fixed reference conversion** (same method as existing Deck reference constants):

Example framing:

- Typical size: 20 m²  
- Declared reference: framing_lm = 20 × (`DECK_SUBSTRUCTURE_REFERENCE_FRAMING_LM` / `DECK_SUBSTRUCTURE_REFERENCE_AREA_M2`) = 20 × (108/27) = 80 lm  
- Crew 2 × 8 h = 16 person-hours  
- Derived authority: 16 / 80 = **0.20 h/framing-lm**

Store both the user-facing quantity (20 m²) and the authority quantity (80 lm) on the evidence row.

Crew size used in calibration derives person-hours. It does **not** schedule that crew on the estimate. Estimate costs person-hours × labour $/h.

### 3.5 Crew recommendation

Ask: *“How many people from your team would normally be working on this task?”*

Count everyone on the task (including the builder, labourers, apprentices). Do **not** count specialist subcontractors whose hours are a subcontract allowance.

Current Deck/Fence/RW labour money uses **carpenter** `$/h` (`labour.carpenter.hour` → `labour.general.hour`). Calculators do **not** currently mix labourer/apprentice into these task hours. Collapsing roles for **time** is correct. Do not invent role-weighted hours in V1.

### 3.6 Hours vs days

No organisation working-day duration exists (project constraint `working_hours` is restricted-hours multiplier, not company day length).

**V1: hours only.** Do not offer days. Do not assume 8 h/day.

---

## 4. Current rate authority

### 4.1 Money resolver (`lib/estimate/rates.ts`)

```
exact company rates row (item_key + rate_type, aliases)
  > work-area fallback row (documented risk)
  > catalogue/benchmark if allow_benchmark_rates
  > missing
```

Sell: company sell_rate if present, else **cost + target GM** (cost-first). Markup is not sell authority.

`prefer_user_rates` is dead.

### 4.2 Provenance gap

`lib/rates/authority.ts`: no DB `source` column. Any active `cost_rate` is presented as **Your company rate**.

Internal enums (`EXPLICIT_COMPANY`, `BENCHMARK`, `FUTURE_CALIBRATION`, `LEGACY_SCOPE_RATE`) must not leak to builders.

Estimate line `sourceLabel` / Builder Review `mapRateLabel` already map to “Company rate” / “Quotr benchmark”. Company productivity currently labels as “Your company rate” via `getRateSourceLabel("user_rate")`. Need a third user-facing type: **Your calibrated productivity**.

### 4.3 `rates` table (002 + 004 + 038)

- Unique `(org_id, rate_type, item_key)`  
- `cost_rate numeric(12, 2)` — **too coarse** for 0.077 h/lm (would store 0.08)  
- No `created_by` / `updated_by` / `source` / `source_calibration_id`  
- RLS: any authenticated org member can SIDU; **app** gate is `company.rates.manage` + entitlement `company_rates.basic`  
- Role gap: **only Owner** has `company.rates.manage`. Admin has `company.edit` but not rates. Estimator has neither.

Rate create/update does **not** mark estimates stale.

### 4.4 First-run labour

`savePricingBasics` writes `labour.carpenter.hour` **cost only** (sell unset → GM derives sell). Catalogue also has labourer (planned, unused by calculators), general fallback (used), apprentice (planned).

**V1 labour UX:** keep **primary labour cost** (carpenter/builder) as the onboarding + Core labour hero. Expose labourer/apprentice only in Rates advanced — do not force role matrix. Calculators already use carpenter.

### 4.5 Materials

Specific-material catalogues exist per Work Area. Do not force library setup. Override only items used in supported WAs. Out of DNA-01 primary path except Rates transparency.

### 4.6 Package / scope rates

`SCOPE_RATE_CATALOGUE` (`scope.deck.m2`, etc.) is leftover / planned. Rates page already demotes to “Legacy package rates”. **Do not** use package rates as calibration. Keep as fallback-only.

### 4.7 Subcontract

RW/kitchen use subcontract allowances + placeholders; range factors live on `organisation_settings` (`budget_rate_factor` / `premium_rate_factor`) for derived low/high. **No overhaul in DNA-01.** Optional later: benchmark vs your subcontract allowance. V1: report only.

### 4.8 Rates page IA (current)

Tabs: Core labour · Labour productivity · Work types · All materials · Defaults · Fallbacks · (legacy package).

**Recommended beta structure (implement after 052, no rewrite until then):**

1. Labour ($/h) — carpenter hero + optional roles  
2. Productivity — benchmark vs your calibrated (task language, not raw ph tables on mobile)  
3. Materials — preferred WAs first, used-now only  
4. Subcontract (narrow, if already listed)  
5. Company defaults (margin)  
6. Fallbacks / Quotr benchmarks  
7. Legacy package rates (unchanged, not primary)

Each commercial row: item · Quotr benchmark · Your rate · Used (source). Use my own rate / remove override. Cost-first: do not ask duplicate sell.

---

## 5. Stale estimates

`estimates.is_stale` exists. `markEstimateStaleWithContext` is **project-scoped** and called from facts/work areas/notes — **not** from rates.

`estimates.calibration_version` is engine fixture version (e.g. outdoor-1.1), **not** company DNA.

After DNA authority changes: do **not** rewrite persisted money. Mark matching projects’ current estimates `is_stale = true` (projects that contain that Work Area type). UI already: “Estimate needs updating” until deliberate regenerate.

---

## 6. Billing / plans

Do **not** add entitlement keys.

Use existing `calibration.basic` (Builder + Business + trial). Do **not** gate estimating correctness on `calibration.comprehensive` (Business extra / VALUE_PRODUCING). Team/governance stays Business.

Rates writes keep `company_rates.basic` (already on Builder/trial).

---

## 7. Why 033 + 038 are not enough

| Need | 033 `calibration_responses` | 038 `rates` productivity |
| --- | --- | --- |
| Crew × time × quantity | No first-class columns | N/A (authority only) |
| Task / productivity_key | scenario_id is whole-job | item_key yes |
| Derived h/unit | No | `cost_rate` yes but `numeric(12,2)` |
| Evidence vs authority | Evidence yes | Authority yes, unlinked |
| Source label | FUTURE_CALIBRATION unused | All cost_rate = Your company rate |
| Reset without deleting evidence | Supersede deletes “active” pointer; still no authority model | `active=false` works mechanically, no provenance |
| Who changed | `created_by` | missing |
| Cost/sell confusion | Columns invite sell-price calibration | N/A |

Stuffing crew into `response_metadata` **violates** 033. Writing hours into `rates` without source **mislabels** calibration as an explicit typed rate.

---

## 8. Proposed migration 052 (Preview only)

Additive. No Production. No benchmark number edits. No commercial formula changes.

### 8.1 New table `productivity_calibration_responses`

Leave 033 untouched (legacy job-cost evidence).

```sql
create table public.productivity_calibration_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,

  work_area_type text not null
    check (work_area_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  task_id text not null
    check (char_length(btrim(task_id)) > 0 and char_length(task_id) <= 128),
  productivity_key text not null
    check (char_length(btrim(productivity_key)) > 0 and char_length(productivity_key) <= 128),
  scenario_id text not null,
  scenario_version text not null,

  -- User-facing scenario (natural language)
  typical_quantity numeric(12, 4) not null check (typical_quantity > 0),
  typical_quantity_unit text not null,          -- e.g. m2, lm
  -- Authority-unit quantity after declared conversion (may equal typical)
  authority_quantity numeric(12, 4) not null check (authority_quantity > 0),
  authority_unit text not null,                 -- e.g. lm, ea, m2

  crew_size numeric(6, 2) not null check (crew_size > 0),
  duration_hours numeric(12, 4) not null check (duration_hours > 0),
  derived_hours_per_unit numeric(12, 4) not null check (derived_hours_per_unit > 0),
  benchmark_hours_per_unit numeric(12, 4) not null check (benchmark_hours_per_unit > 0),

  outlier_confirmed boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),

  -- Conversion/audit only — not commercial authority
  mapping_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(mapping_metadata) = 'object'
      and pg_column_size(mapping_metadata) <= 8192),

  status text not null default 'active'
    check (status in ('active', 'superseded')),
  supersedes_id uuid references public.productivity_calibration_responses (id)
    on delete set null,
  superseded_at timestamptz,

  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pcr_superseded_requires_at check (
    (status = 'active' and superseded_at is null)
    or (status = 'superseded' and superseded_at is not null)
  )
);
```

Indexes:

- unique one active per `(org_id, task_id)` where `status = 'active'`  
- `(org_id, work_area_type, created_at desc)`  
- `(org_id, productivity_key)`

Immutability: same pattern as 033 — UPDATE may only supersede status; commercial/evidence columns append-only.

**Reset does not delete or supersede evidence.** Latest active evidence remains auditable (“you previously said 2 people × 8 h”). Reset only deactivates authority (below).

### 8.2 Alter `public.rates` (live productivity + money provenance)

Keep company productivity in `rates` so `resolveProductivity` stays the single authority. Do **not** create a second productivity store.

```sql
alter table public.rates
  add column source text
    check (source is null or source in (
      'explicit_company',
      'calibrated_productivity'
    )),
  add column source_calibration_id uuid
    references public.productivity_calibration_responses (id)
    on delete set null,
  add column updated_by uuid
    references public.profiles (id) on delete set null;

-- Precision for hours/unit (money still stores 2 d.p. as x.xx00)
alter table public.rates
  alter column cost_rate type numeric(12, 4);
```

Also widen `cost_rate_low` / `cost_rate_high` to `numeric(12, 4)` for check consistency.

Rules:

- `source = calibrated_productivity` requires `rate_type = 'productivity'` and `source_calibration_id is not null`  
- `source = explicit_company` must have `source_calibration_id is null`  
- Existing rows: `source` null → treat as `explicit_company` if `cost_rate is not null` (backfill optional comment-only; runtime coalesce)  
- Reset calibrated item: `active = false`, keep `source` + `source_calibration_id` for audit; do **not** mutate catalogue constants  
- Explicit “use my own rate” on a previously calibrated productivity key: overwrite as `explicit_company`, clear `source_calibration_id` (user typed hours/unit in Rates — rare V1; primary path is crew/time)

Do **not** change labour/material sell formulas.

### 8.3 RPCs (SECURITY INVOKER, auth_org_id)

**`save_productivity_calibration(...)`**  
Advisory lock per org+task. Supersede prior active evidence. Insert evidence. Upsert `rates` `(org_id, 'productivity', productivity_key)` with `cost_rate = derived_hours_per_unit`, `unit = authority_unit`, `active = true`, `source = calibrated_productivity`, `source_calibration_id = new id`, `updated_by = auth.uid()`. Never writes labour/material/sell. Never mutates 033.

**`reset_productivity_to_benchmark(p_task_id)`**  
If rates row is `calibrated_productivity` for that task’s key: `active = false` (or null `cost_rate` + active false — prefer **active false** so unique key remains). Do not delete evidence. `updated_by = auth.uid()`.

Grants: authenticated + service_role execute. No anon.

### 8.4 RLS

Match 033/rates org isolation:

- SELECT: `org_id = auth_org_id()`  
- INSERT: org match and `created_by = auth.uid()`  
- UPDATE: org match (supersede-only via trigger)  
- No authenticated DELETE  

App layer (not RLS roles): see §9. Do not attempt to encode Owner vs Estimator in Postgres in 052 unless existing membership RPCs already expose a stable `auth_org_role()` — they do via 049; **optional** tighten later. V1: follow rates (RLS org-wide, app permission).

### 8.5 Backfill

- No promotion of 033 cost/sell/hours into productivity.  
- No rewrite of existing `rates` money rows.  
- Existing productivity `rates` rows (if any Preview orgs typed hours in Rates UI) remain explicit company hours; label “Your company rate”, not calibrated.

### 8.6 Resolver changes (application, after 052)

`resolveProductivity`:

1. Company productivity row active + cost_rate → hours  
2. `source === 'calibrated_productivity'` → sourceLabel **Your calibrated productivity**  
3. else company → **Your company rate** (typed override)  
4. else in-code benchmark → **Quotr benchmark** (replace “Benchmark productivity” user-facing)

Do not insert calibration into `resolveRate` money stack. Calibration changes **hours**, not margin, not $/h.

Batch: continue passing `context.rates`; no per-line DB fetch.

### 8.7 Stale estimates (application)

On successful save/reset RPC: set `estimates.is_stale = true` for org estimates on projects that have a work_area of that `work_area_type`. Do not touch quotes or pricing documents. Do not regenerate.

### 8.8 Preview impact

- Migration 052 on `shhpjsoldmqtkdbgrbtm` only after owner approval  
- Empty new table expected  
- `rates.cost_rate` type change: rewrite existing numeric values; 2 d.p. money unchanged  
- PostgREST schema reload  
- Production 045: **no apply**

---

## 9. Role access recommendation

| Role | View DNA / Rates | Calibrate crew/time | Edit $/h and material overrides | Billing/team |
| --- | --- | --- | --- | --- |
| Owner | yes | yes | yes | yes |
| Admin | yes | yes | **yes (grant `company.rates.manage`)** | no invite/billing |
| Estimator | yes | **yes** | no | no |
| Viewer | yes | no | no | no |

Add OrgPermission `company.calibration.manage` (Owner, Admin, Estimator). **Not** a billing entitlement.

Rationale: estimators know crew performance; they must not silently change commercial $/h. Admin today cannot manage rates — that is a gap vs “Owner/Admin manage company settings”; fix when implementing.

Trial + Builder + Business: `calibration.basic` + `company_rates.basic`. Same estimating correctness.

---

## 10. Validation / outliers (application)

No zero/negative crew, time, quantity.

| Input | Soft warn | Hard reject |
| --- | --- | --- |
| Crew | > 8 | < 1 or > 20 |
| Duration hours | > 40 for the declared typical task | < 0.25 or > 200 |
| Derived vs benchmark | faster or slower by **> 2×** | derived non-finite; or < 0.05× / > 20× (nonsense) |

Warn copy: *“This is much faster than Quotr's benchmark. Is that right?”* Confirm sets `outlier_confirmed`. Do not block save after confirm.

Hours input only.

---

## 11. UX contracts (implement after 052 — not this stop)

**Landing:** “Make Quotr price more like you” / “Tell Quotr how your crew normally completes a few common tasks.” Work Area cards for **selected primary WAs first**, others via Show all. Progress: `Deck · 2 of 4 tasks calibrated` — no % DNA gamification.

**Status per WA:**

- 0 high-impact tasks → Using Quotr benchmarks  
- some but not majority of high-impact (framing/decking/posts for Deck; not demolition-alone) → Partly calibrated  
- ≥ 2 high-impact tasks → Using your calibration  

**Task flow:** one task; scenario context; crew stepper; hours; “An approximate answer is fine.”

**Result:** if comparison sound, “your crew is about N% faster/slower than the Quotr benchmark”; else “Saved. Quotr will use this for future {WA} estimates.”

**Rates:** stacked cards on ~390px; no large tables on calibration; detailed ph/unit in Rates/advanced only.

**Estimate Ready:** one subtle line if any labour used calibrated productivity; else “Some labour assumptions use Quotr benchmarks.” No per-line clutter.

**Builder Review:** add user-facing “Your calibrated productivity” via `classifyRateSource` — only if low-risk mapping; do not expose enums.

---

## 12. Economic proof plan (after implement)

Controlled Deck fixture, Preview only, no paid Analyse:

**A** generate with benchmark productivity → record physical qty, non-labour cost, labour hours, labour cost, GM, sell.  
**B** save known crew/time → derived h/unit → deliberate regenerate → physical qty unchanged, non-labour unchanged, labour hours/cost move, GM formula unchanged, sell moves only as downstream.  
**C** reset to benchmark → regenerate → labour economics return to A (same facts/rates).  
**D** carpenter cost override on/off via existing `resolveLabourRate` — no formula change.

No golden restamp unless estimator architecture genuinely requires owner approval.

---

## 13. Verifier / regressions (after implement)

New `scripts/verify-company-dna-01.ts` as specified in the programme.

Run: verify-beta-1, 1.5, organisation-timezone, beta-2, company-dna-01, tsc, lint, build:safe, Estimator Safety, Pre-Billing Core Close, Commercial Close, Pricing ownership, Billing-1–4, Quote Acceptance.

No live Stripe. No Production.

---

## 14. Files expected after approval (do not create now)

- `supabase/migrations/052_productivity_calibration.sql`  
- `lib/company-dna/*` catalogue, derivation, validation  
- calibration landing/flow replacement  
- `lib/estimate/productivity.ts` source labels  
- `lib/estimate/rate-source-labels.ts`  
- rates presentation  
- `scripts/verify-company-dna-01.ts`  
- dashboard CTA href  

Suggested commit (when green):

```
feat: personalise estimating with company productivity

Let builders calibrate crew productivity from real-world task examples, compare
Quotr benchmarks with company settings, and apply company-specific inputs through
the existing estimator authority.
```

---

## 15. Exact next action

1. Owner approves migration 052 as specified (or requests amendments).  
2. Create 052 on Preview only.  
3. Then implement DNA-01 UX + resolver labels + stale marking + verifier + hosted proof.

**COMPANY DNA-01 status:** ARCHITECTURE VALIDATED / MIGRATION REQUIRED / NOT LIVE.  
**Safe to continue DNA-02?** No.  
**Production:** untouched.

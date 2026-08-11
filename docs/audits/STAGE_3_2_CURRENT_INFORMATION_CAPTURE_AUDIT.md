# Stage 3.2.0 — Current Information Capture Audit

**Status:** Complete — Planning  
**Date:** 2026-08-11  
**Closure baseline (3.1B):** `441f36c` (docs close after Preview Validated)  
**Code baseline referenced by Owner E2E:** `79afb4e` (R6-R4.1 attention routing)  
**Prerequisite:** Stage 3.1B Complete — Preview Validated  
**Does not:** implement UI, migrations, Fact changes, formula changes, Production Scope Discovery, Company DNA, or 3.2.1  

---

## 1. Purpose

Trace Quotr’s current information pipeline end-to-end so Stage 3.2 Builder Interview can:

- collect only missing project/construction context;
- avoid duplicating Scope Details / Site Constraints / Scope Discovery;
- write into the existing Fact / Constraint authority model;
- scale across multi–Work Area jobs (Commercial Fitout).

---

## 2. Pipeline overview

```
Project creation
  → brief / notes / (photos missing)
  → Analyse Job
  → extracted Facts + suggested Work Areas
  → Work Area confirmation
  → Scope Discovery (Preview-gated; Production Disabled)
  → Scope Review (include/exclude/modify)
  → Specification / quality
  → Scope Details (work_area_questions)
  → Site Constraints
  → Quick Estimate
  → Estimate Review / Breakdown
  → Pricing
  → Quote
```

Stage machine (`lib/assistant/stage.ts`):  
`brief → confirm_work_areas → quality → work_area_questions → constraints → ready_to_estimate → estimate_ready`

Progressive disclosure (`progressive-disclosure.ts`):  
`capture → workAreas → scopeReview (ISD) → quality → questions → constraints → estimateReview (stale)`

---

## 3. Stage-by-stage capture matrix

Legend for impact columns: **Y** = yes / material; **P** = partial / indirect; **N** = no / not intended.

| Stage | Information collected | Persistence | Canonical authority | Scope | Affects scope | qty | labour | material | access | risk | assumptions | pricing | Duplication |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Project creation** | title, client, site address, brief, priority, due date, notes | `projects` | Project row | Project | N | N | N | N | P (address) | N | N | P (client/site snapshots later) | Brief vs `notes` vs site notes |
| **Brief / Site Notes** | Free-text job description; site notes | `projects.brief_text`, `project_notes` | Distinct fields (3.1D) | Project | P (AI seeds WAs) | P | P | P | P | P | Y (AI assumptions) | P | Three text channels |
| **Photos** | — | **Missing** | — | — | — | — | — | — | — | — | — | — | Future media (ISD-008) |
| **Analyse Job** | Suggested WAs; Facts; assumption strings; possible constraints; warnings | `work_areas`, `project_facts` (`ai_extracted`), transient strings | Facts SoT for meaning; WAs for structure | Mix | Y (suggests) | Y | P | P | P | P | Y | P | Parallel to ISD; notes proposals |
| **WA recommendations** | type, name, confidence, summary | `work_areas` (suggested) | Work Area row | WA | Y | N | N | N | N | N | N | N | Catalogue aliases |
| **Confirm Work Areas** | confirmed / excluded | `work_areas.status`; stage → quality | Work Area status | WA | Y | N | N | N | N | N | N | N | — |
| **Scope Discovery** | Suggestions, evidence, clarifications, missing_information | `scope_discovery_*`; accept → WA (+ decisions) | Suggestion lifecycle; **never** Fact SoT | Project + WA | Y | N | N | N | N | P | P | N | Clarifications route to Facts; Fitout existence-only |
| **Scope Review** | Include / exclude / modify scope items | `work_area_scope_items`, decision tables | Scope item decisions | WA | Y | P | P | P | N | P | P | P | Manual vs ISD paths |
| **Specification / quality** | budget / standard / premium / unknown | `projects.quality_level`; may seed finish facts | Project quality | Project | N | N | P | Y | N | N | Y | Y | Finish-level inheritance into WA facts |
| **Scope Details** | Template questions → Facts | `question_blocks` / `questions` (journal) + `project_facts` (SoT) | **Facts** | WA | P | Y | Y | Y | Y (per-WA access) | Y | Y | Y | **Access/carting overlap with constraints** |
| **Site Constraints** | 14 reserved flat keys | `constraints` | **Constraints** sibling namespace | Project | N | N | Y (intended) | P | Y | Y | Y | P | Overlaps WA `*.access`, carting Facts |
| **Quick Estimate** | Totals, lines, missing_info, assumptions | `estimates`, `estimate_line_items` | Estimate generation snapshot | Project | N | Y | Y | Y | P | P | Y | Y | Attention routes back to Details/Review |
| **Estimate Review / Breakdown** | Presentation of estimate | Reads estimate | Estimate | Project | N | N | N | N | N | N | Y (display) | Y | — |
| **Pricing** | Editable commercial draft | `pricing_documents` / items | Pricing (pre-quote) | Project | N | N | N | N | N | N | Snapshot | Y | Client/site sync from project |
| **Quote** | Frozen customer offer | `quotes` / items | Quote snapshot | Project | N | N | N | N | N | N | Frozen | Y | Immutable |

---

## 4. Persistence map (capture-relevant)

| Table | Role |
| --- | --- |
| `projects` | Identity, brief, quality, stage, client/site |
| `project_notes` | Site notes |
| `work_areas` | Suggested / confirmed / excluded WAs |
| `project_facts` | **Sole estimating/readiness SoT** (WA or project-wide) |
| `question_blocks` / `questions` | Capture journal; not estimate authority |
| `constraints` | Project-wide site/access conditions |
| `scope_discovery_runs` / `_suggestions` / `_decisions` | ISD (Preview-gated) |
| `work_area_scope_items` (+ decisions) | Scope Review include/exclude |
| `note_proposals` | Notes → WA/facts/constraints proposals |
| `estimates` / `estimate_line_items` | Generated estimate + assumptions/missing_info |
| `pricing_documents` / `quotes` | Commercial layers |

Schema sources: `supabase/migrations/001_*`, `002_*`, `008–012`, `028–031`, `033`.

---

## 5. Fact taxonomy inventory (current)

### 5.1 Authority reminder (3.1D)

```
Question (journal) → Fact (SoT) → Derived Fact → Estimate
Constraints = sibling project-level namespace (reserved flat keys)
```

`FACT_SOURCE_PRECEDENCE` (`lib/scopes/domain-ownership.ts`):

| Source | Precedence |
| --- | --- |
| user | 100 |
| ai_extracted | 60 |
| default | 40 |
| assumption | 30 |
| system | 20 |
| derived | 10 |

User Facts are never overwritten by derived writes.

### 5.2 Domains

#### PROJECT IDENTITY

| Key / field | Status | Notes |
| --- | --- | --- |
| `projects.title`, client, site, brief | Canonical project fields | Not Facts |
| Project type (new build / reno) | Mostly free text / implied | Missing structured Fact |
| Occupied/vacant | Constraint `occupied_site` | Canonical constraint |

#### SITE / ACCESS

| Key | Status | Notes |
| --- | --- | --- |
| `site_access` | Canonical **constraint** | Required template |
| `material_carry_distance` | Canonical **constraint** | Required; select bands |
| `floor_level` | Constraint + WA Fact (`demolition.floor_level`) | **Duplicated** |
| `parking_loading` | Constraint | Optional |
| `working_hours` | Constraint | Required boolean |
| `waste_bin_access` | Constraint | Optional |
| `{wa}.access` | Many Scope Details Facts | **Duplicates project access** |
| `{wa}.carting_distance_m` | demolition / retaining_wall Facts | **Duplicates carry distance** |
| Stairs / lift / restricted loading | Partial / free text | Taxonomy gap (DEF-7E-004) |

#### EXISTING CONDITIONS

| Key examples | Status |
| --- | --- |
| `deck.existing_deck_removal`, `deck.substructure_condition` | Canonical Facts |
| `bathroom.demolition_required`, fixtures | Canonical Facts |
| `demolition.hazardous_materials_risk` | WA Fact; also project constraint |
| Substrate / condition free text | Often AI assumptions only |

#### DIMENSIONS / QUANTITIES

| Key examples | Status |
| --- | --- |
| `*.length_m`, `*.width_m`, `*.area_m2`, `*.height_m` | Canonical Facts |
| Derived: `deck.area_m2`, `bathroom.total_tiling_area_m2`, etc. | Computed; never overwrite user |

#### SCOPE

| Key / path | Status |
| --- | --- |
| Scope items include/exclude | Scope Review authority |
| Template include flags (`balustrade_required`, etc.) | Facts |
| Fitout catalogue signals (`fitout.*`) | Clarification / existence; **no Scope Details template** |

#### SPECIFICATION

| Key / field | Status |
| --- | --- |
| `projects.quality_level` | Canonical project quality |
| Material / finish Facts per WA | Canonical in templates |
| Brand-level paint/tile | Usually assume / free text — **should not force structured fields** |

#### LOGISTICS

| Key | Status |
| --- | --- |
| Carry / waste / bin | Constraints + some WA Facts | Dual namespace |
| Storage / deliveries / temporary works | Mostly missing structured | Future / interview candidates |

#### COMPLIANCE / RISK

| Key | Status |
| --- | --- |
| `consent_engineering` | Constraint |
| `hazardous_materials_risk` | Constraint + demolition Fact |
| Fire / seismic / waterproofing | Partial (bathroom waterproofing Fact; fitout seismic existence) |

#### TRADE INTERFACES

| Key | Status |
| --- | --- |
| Plumbing / electrical changes (kitchen/bathroom) | Facts |
| HVAC / fire specialist | Mostly missing / Scope Discovery existence |

#### COMMERCIAL / DELIVERY

Owned by rates, calibration, pricing, quote — **out of Builder Interview write authority** except where answers create assumptions that affect confidence.

### 5.3 Fact health summary

| Class | Examples |
| --- | --- |
| **Canonical** | Dotted WA measurements/finishes; reserved constraint keys; quality_level |
| **Duplicated** | Access / carry / floor level / services / hazmat across Facts + Constraints + multi-WA |
| **Missing structured** | Lift, stairs (site), confined space, noise/dust nuance, storage limits, delivery windows, project type, WA-specific override of project access |
| **Poorly named / aliased** | `deck.has_stairs` vs `deck.access_type`; fascia vs vertical face boards; bathroom `ventilation_included` vs `ventilation_required` |
| **Free-text only** | Much of brief/notes; AI assumptions strings; ISD missing_information display |
| **Should stay unstructured** | Narratives, one-off client politics, brand preference fluff, estimator war stories |

---

## 6. Question source inventory

| Source | Location | Disposition guidance |
| --- | --- | --- |
| Scope Details templates | `lib/scopes/templates/*` | **KEEP** for granular WA components; migrate pure site/access to interview/constraints |
| Missing-details regen | `lib/scopes/questions.ts`, `missing-questions.ts` | **KEEP** as Detail completeness; suppress when interview already answered canonical key |
| Site Constraints | `constraint-templates.ts` | **KEEP + expand taxonomy** via FEAT-003 / DEF-7E-004; become interview write targets for project-wide site keys |
| Scope Discovery clarifications | `clarification-routing.ts` | **KEEP** for scope existence; route to Facts only; not a second site interview |
| ISD missing_information | Suggestion payload | **KEEP as prompts**; do not auto-write Facts |
| Quick Estimate attention | `quick-estimate-view-model.ts` | **KEEP** routing; may later route to interview for P0 site gaps |
| Project creation | `NewProjectDialog` | **KEEP** identity fields only |
| Quality / Specification | `QualityBlock` | **KEEP** |
| Setup / calibration | Company Setup | **KEEP separate** — company knowledge ≠ project interview |
| Mock seeds | `mock-seed.ts` | Demo only |

### 6.1 Disposition codes (applied in contract docs)

| Code | Meaning |
| --- | --- |
| A | KEEP WHERE IT IS |
| B | BUILDER INTERVIEW CANDIDATE |
| C | DUPLICATE — CONSOLIDATE |
| D | DEFER / REMOVE |
| E | WORK-AREA-SPECIFIC |
| F | PROJECT-WIDE |
| G | CONDITIONAL ONLY |

### 6.2 High-value consolidation targets

| Topic | Today | Target |
| --- | --- | --- |
| Site access difficulty | Constraint `site_access` + many `{wa}.access` | One project answer; WA override only if different |
| Carry / carting distance | Constraint `material_carry_distance` + `*.carting_distance_m` | One project answer; WA numeric override only when materially different |
| Floor level | Constraint + `demolition.floor_level` | Project default; WA override |
| Services isolated | Constraint + demolition Fact | Project unless WA exception |
| Hazmat | Constraint + demolition Fact | Project risk + WA confirmation when demolition present |

---

## 7. Biggest capture gaps

1. **No progressive “what do I still need?” interviewer** — fixed stage questionnaires instead.
2. **Access/logistics asked repeatedly** across Scope Details and Site Constraints (multi-WA amplification).
3. **Constraint taxonomy too thin** for real jobs (DEF-7E-004 / FEAT-003): lift, stairs, loading, noise, storage, wet weather, confined space.
4. **Fitout has catalogue signals but no dedicated interview / Details template** for project-wide fitout conditions.
5. **Ask-vs-assume is implicit** (calculator defaults + “Not sure”) without durable assumption provenance tied to skipped questions.
6. **Estimate readiness** conflates missing Detail Facts with missing site context; no clear READY WITH ASSUMPTIONS.
7. **Constraint → estimate consumption** is incomplete (many captured; limited labour modifiers) — interview must not invent formulas; consumption remains later/controlled.
8. **Photos / documents missing** — interview must not pretend visual evidence exists.

---

## 8. What Stage 3.2 must not break

- Fact SoT / Question journal dual-write model (3.1D)
- Analyse Job behaviour
- Production Scope Discovery Disabled gate
- Commercial formulas / rate authority
- Company DNA / calibration company knowledge boundary
- Scope Review ownership of include/exclude
- Scope Details ownership of granular component questions

---

## 9. Source index

| Area | Paths |
| --- | --- |
| Domain ownership | `lib/scopes/domain-ownership.ts`, `docs/architecture/STAGE_3_1D_DOMAIN_MODEL_REFINED.md` |
| Constraints | `lib/assistant/constraint-templates.ts` |
| Scope Details | `lib/scopes/templates/*`, `lib/scopes/questions.ts` |
| Analyse Job | `lib/ai/extract.ts`, `lib/assistant/actions.ts` |
| ISD | `lib/scope-discovery/**` |
| Estimate attention | `lib/estimate/quick-estimate-view-model.ts` (and related) |
| 3.1B closure | `docs/implementation/STAGE_3_1B_CLOSURE.md` |
| Handoff | `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_HANDOFF.md` |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/audits/STAGE_3_2_CURRENT_INFORMATION_CAPTURE_AUDIT.md` |
| Stage | 3.2.0 Planning |
| Next | Owner decisions → 3.2.1 contract + candidate engine |

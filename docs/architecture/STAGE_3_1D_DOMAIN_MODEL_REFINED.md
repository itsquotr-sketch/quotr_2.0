# Stage 3.1D — Refined Domain Model

**Status:** Authoritative for Stage 3.1D ownership rules  
**Date:** 2026-08-05  
**Supersedes (for ownership clarity):** informal dual-write assumptions prior to 3.1D  
**Complements:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`, `docs/architecture/STAGE_3_1C_DOMAIN_MODEL_AUDIT.md`  
**Code contracts:** `lib/scopes/domain-ownership.ts`, `lib/scopes/scope-value-resolution.ts`, `lib/assistant/scope-persistence.ts`  

---

## 1. Purpose

Stage 3.1D refines Quotr’s domain model so every business meaning has **exactly one authoritative owner**, the **Question → Fact → Estimate** pipeline is deterministic, and Constraints remain a **separate project-level namespace**.

This stage:

- Does **not** change commercial formulas
- Does **not** redesign UI or AI prompts
- Does **not** implement Intelligent Scope Discovery or Company DNA
- Does **not** add database migrations (see deferred schema proposals)

---

## 2. Binding ownership rules

### 2.1 Scope pipeline

```
Question (capture journal)
    ↓ write-through (Fact first, then Question mirror)
Fact (project_facts — SOLE estimating / readiness authority)
    ↓ derive (never overwrites source=user)
Derived Fact (project_facts source=derived)
    ↓
Estimate (reads facts + derived merge only — never question answers)
```

**Constraints** are a sibling namespace on the project (not facts):

```
Constraint (constraints table)
    ↓
Estimate labour adjustments / interview later
```

### 2.2 Authority matrix

| Concern | Authority | Not authority |
| --- | --- | --- |
| Estimating quantities / finishes | `project_facts` | `questions.answer_value` |
| Missing-fact readiness | `project_facts` (+ derived) | Question-only answers |
| Scope Review display | Facts win; questions are baseline fallback | — |
| Site/access conditions | `constraints` | `project_facts` for reserved keys |
| Work-area scoped measurements | `project_facts` | `constraints` for dotted keys |
| Customer commercial offer | Quote snapshot | Live rates / live project edits |
| Draft client/site before quote | `projects.client_name` / `site_address` | Historical quotes |

### 2.3 Write order (deterministic)

1. **Normalize** value for storage type  
2. **Upsert Fact** (`source=user`) — source of truth  
3. **Mirror Question** `answer_value` — capture journal only  
4. **Recompute derived facts** (skip where existing `source=user`)  
5. **Heal** any remaining question→fact drift before missing-details evaluation  
6. **Mark estimate stale**

Shared helpers:

- `commitUserAnswerToScope` — answer save path  
- `commitUserFactEdit` — direct fact edit path  
- `upsertProjectConstraintRecord` — constraint path  
- `healQuestionAnswersIntoFacts` — drift repair  

---

## 3. Entity lifecycle catalogue

Every major object: owner, source of truth, lifecycle, freeze point, downstream consumers.

Code-exported contracts live in `DOMAIN_ENTITY_CONTRACTS` (`lib/scopes/domain-ownership.ts`). Summary:

| Entity | Owner | Source of truth | Lifecycle | Freeze point | Downstream |
| --- | --- | --- | --- | --- | --- |
| Organisation | Tenant root | `organisations` | create → update | N/A (live) | All org data / RLS |
| Profile | Org + Auth | `profiles` + `auth.users` | create → update | N/A | Authorship / security |
| Project | Organisation | `projects` | create → archive / soft-delete | Soft-delete hides from active workflow | All children |
| Client details | Project | `projects.client_name` (pre-quote) | edit → snapshot | Quote create | Pricing / Quote |
| Site details | Project | `projects.site_address` (pre-quote) | edit → snapshot | Quote create | Pricing / Quote |
| Project brief | Project | `projects.brief_text` | create/update | Does not freeze money | AI / analysis |
| Site notes | Project | `project_notes` | create → soft-delete | Soft-delete | Note proposals |
| Work area | Project | `work_areas` | suggested → confirmed/excluded | Confirmed set for estimate gen | Facts / Estimate / Pricing |
| Question | Project | Capture journal only | answer in block → submit | Block submitted | Fact materialization / UI |
| Question block | Project | `question_blocks` | active → submitted/superseded | submitted | Questions |
| Fact | Project | **`project_facts`** | upsert by key | Values used by estimate gen | Estimate / Scope Review |
| Derived fact | Project | derived from facts | recompute on writes | Same as facts | Estimate / displays |
| Constraint | Project | **`constraints`** | upsert by key | Values used by estimate gen | Estimate adjustments |
| Estimate | Project (1:1) | `estimates` + lines | generate → stale → regen | Not customer-committed | Pricing |
| Pricing document | Project | `pricing_documents` + items | draft → reviewed → quote | Quote create | Quote |
| Quote | Project | `quotes` + items | create → revise/supersede | Create / revision | Print / status |
| Rate | Organisation | `rates` | upsert / deactivate | Do not rewrite quotes | Estimate |
| Company defaults | Organisation | `organisation_settings` | upsert | Snapshotted at pricing/quote create | Estimate / Quote |
| Note proposal | Project | `note_proposals` | pending → accept/dismiss | Accept commits domain writes | WA / Facts / Constraints |
| Photos | — | **Missing** | — | — | — |
| File documents | — | **Missing** (≠ pricing_documents) | — | — | — |
| Historical records | — | Fragmented | — | Quote snapshots freeze commercial history | Future Evidence Engine |

---

## 4. Duplicated concepts resolved (behavioural)

| Former ambiguity | 3.1D rule |
| --- | --- |
| Question answer vs Fact | Fact owns estimating meaning; Question is write-through journal |
| Derived vs user Fact | User always wins; derived never overwrites `source=user` |
| Constraint vs Fact | Reserved flat keys → constraints only; dotted scoped keys → facts only |
| Client/site on project vs pricing vs quote | Unchanged from 3.1A: project editable pre-quote; quotes immutable |
| Brief vs site notes vs `projects.notes` | Unchanged: three distinct fields/purposes |

Storage dual-write (question + fact) is **retained for UI compatibility** but is no longer dual **ownership**.

---

## 5. Freeze points (commercial)

| Stage | What freezes |
| --- | --- |
| Estimate generate | Snapshot of current facts/constraints into estimate lines (regen replaces) |
| Pricing create | Copies estimate into editable pricing; later estimate changes require recalibration |
| Quote create / revise | Customer commercial snapshot immutable; rate/settings changes do not rewrite |
| Soft-delete project | Hidden from active workflow; child rows retained |

---

## 6. What 3.1D intentionally did not change

- Commercial engine arithmetic  
- UI layouts / components (beyond using existing save paths)  
- AI prompts  
- Database schema / migrations  
- Intelligent Scope Discovery  
- Company DNA / Evidence Engine  

---

## 7. Related documents

| Document | Role |
| --- | --- |
| `STAGE_3_1C_DOMAIN_MODEL_AUDIT.md` | Pre-refinement audit |
| `STAGE_3_1D_DEFERRED_SCHEMA_PROPOSALS.md` | Schema changes proposed, not implemented |
| `STAGE_3_1D_DOMAIN_MODEL_REFINEMENT_COMPLETION.md` | Implementation completion record |
| `QUOTR_ARCHITECTURE_FOUNDATION.md` | Governing product architecture |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/STAGE_3_1D_DOMAIN_MODEL_REFINED.md` |
| Application code | Ownership helpers + write-path refactor |
| Migrations | None |

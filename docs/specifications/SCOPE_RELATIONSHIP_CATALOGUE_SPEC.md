# Scope Relationship Catalogue — Specification

**Status:** Specification + Stage 3.1B.2 implementation (`lib/scope-discovery/catalogue/`) — **production adoption Not Started**  
**Date:** 2026-08-05  
**Catalogue version:** `scope-relationship-catalogue/v1`  
**Completion:** `docs/implementation/STAGE_3_1B2_SCOPE_RELATIONSHIP_CATALOGUE_COMPLETION.md`  
**Nature:** Domain catalogue of scope relationships — **not** commercial formulas  
**Boundary:** `INTELLIGENT_SCOPE_DISCOVERY_BOUNDARY.md`  
**Emits:** Stage 3.1B.1 `ScopeDiscoverySuggestion` via `evaluateScopeRelationships`

---

## 1. Purpose

Define a **data-driven deterministic catalogue** that answers:

> Given an accepted (or strongly evidenced) parent scope, which child scopes are required, likely, or conditional — and what Facts trigger, suppress, or conflict?

This catalogue powers deterministic missing-scope detection and constrains AI proposals (AI must not bypass catalogue edges for deterministic kinds).

---

## 2. Non-goals

- No rate, margin, GST, or line money.
- No full trade encyclopaedia in 3.1B.0.
- No assemblies implementation (optional `futureAssemblyLink` only).
- No automatic Work Area creation from catalogue alone without user confirmation (MVP default).

---

## 3. Catalogue entry schema

| Field | Required | Meaning |
| --- | --- | --- |
| `edgeId` | Yes | Stable id, e.g. `deck.substructure` |
| `parentScope` | Yes | Parent type or abstract parent key (`deck`, `bathroom`, `commercial_fitout`) |
| `candidateChildScope` | Yes | Child type / abstract key |
| `relationshipType` | Yes | `prerequisite` \| `likely_inclusion` \| `conditional` \| `common_exclusion` \| `coordination` |
| `requirementLevel` | Yes | `required` \| `likely` \| `conditional` \| `optional` |
| `triggeringFacts` | No | Fact key + value predicates that raise the edge |
| `suppressingFacts` | No | Predicates that suppress the edge (e.g. substructure `none`) |
| `conflictingFacts` | No | Predicates that emit conflict warnings |
| `clarificationQuestionKey` | No | Question/copy key when evidence insufficient |
| `evidenceRequirement` | No | `none` \| `brief_or_notes` \| `user_fact` \| `photo_or_document` (future) |
| `defaultConfidenceBand` | Yes | `high` \| `medium` \| `low` for deterministic suggestions |
| `regionApplicability` | No | e.g. `NZ` / `all` |
| `tradeApplicability` | No | Trade tags |
| `futureAssemblyLink` | No | Reserved for Stage 3.3 |
| `active` | Yes | Catalogue enable flag |
| `notes` | No | Designer notes — not user-facing money claims |

---

## 4. Evaluation rules (deterministic)

1. Start from **accepted** Work Areas (+ optionally high-confidence existing suggested — owner gate).
2. For each active edge where parent matches, evaluate trigger/suppress/conflict predicates against **current Facts** (SoT) and Constraints.
3. If child scope already accepted → no `MISSING_SCOPE` (may still `DUPLICATE_WARNING` if AI also proposes).
4. If child excluded / suggestion rejected with same snapshot → suppress unless new evidence hash.
5. Emit deterministic suggestions with `evidence.sourceType = DETERMINISTIC_RULE` and `edgeId`.
6. AI may add contextual missing scope **only** if not contradicting an active suppress rule and not duplicating an existing edge emission without new evidence.

---

## 5. Representative samples (design validation only)

### 5.1 Deck family (sample)

| edgeId | Parent | Child | Level | Notes |
| --- | --- | --- | --- | --- |
| `deck.demolition` | deck | demolition | conditional | Trigger: replace/remove language or fact |
| `deck.excavation` | deck | excavation | conditional | Trigger: new piles / ground works |
| `deck.substructure` | deck | piles/posts/substructure | likely | Suppress: fact substructure condition = `none` still needs explicit consideration — emit clarification not silence |
| `deck.bearers` | deck | bearers | likely | Typical framing stack |
| `deck.joists` | deck | joists | likely | |
| `deck.decking` | deck | decking | required | Core finish surface |
| `deck.fascia` | deck | fascia | likely | |
| `deck.stairs` | deck | stairs | conditional | Trigger: level change / stair mention |
| `deck.balustrades` | deck | balustrades | conditional | Trigger: height / barrier requirements |
| `deck.drainage` | deck | drainage | conditional | |
| `deck.coatings` | deck | coatings | likely | |
| `deck.waste` | deck | waste_removal | likely | Especially if demolition present |
| `deck.access` | deck | access_constraint | coordination | Prefer constraint namespace, not WA money |

### 5.2 Bathroom family (sample)

| edgeId | Parent | Child | Level |
| --- | --- | --- | --- |
| `bath.demolition` | bathroom | demolition | likely |
| `bath.plumbing` | bathroom | plumbing | required |
| `bath.electrical` | bathroom | electrical | likely |
| `bath.framing` | bathroom | framing | conditional |
| `bath.linings` | bathroom | linings | likely |
| `bath.waterproofing` | bathroom | waterproofing | required when tiling wet areas |
| `bath.tiling` | bathroom | tiling | conditional |
| `bath.fixtures` | bathroom | fixtures | likely |
| `bath.fitoff` | bathroom | fit_off | likely |
| `bath.painting` | bathroom | painting | likely |
| `bath.waste` | bathroom | waste_removal | likely |

**Example rule:** tiling present + no waterproofing consideration → deterministic `MISSING_SCOPE` / `CLARIFICATION_REQUIRED` at `high` or `medium` band.

### 5.3 Commercial fitout family (sample)

| edgeId | Parent | Child | Level |
| --- | --- | --- | --- |
| `fitout.stripout` | commercial_fitout | strip_out | likely |
| `fitout.partitions` | commercial_fitout | partitions | likely |
| `fitout.ceilings` | commercial_fitout | ceilings | likely |
| `fitout.doors` | commercial_fitout | doors | likely |
| `fitout.linings` | commercial_fitout | linings | likely |
| `fitout.services` | commercial_fitout | services_coordination | likely |
| `fitout.flooring` | commercial_fitout | flooring | likely |
| `fitout.joinery` | commercial_fitout | joinery | conditional |
| `fitout.firestopping` | commercial_fitout | fire_stopping | conditional |
| `fitout.seismic` | commercial_fitout | seismic_requirements | conditional (NZ) |
| `fitout.access` | commercial_fitout | access_logistics | coordination |
| `fitout.waste` | commercial_fitout | waste_removal | likely |

---

## 6. Missing-scope strategy

### 6.1 Deterministic (catalogue-owned)

**When:** After WA accept/confirm; after Fact writes that change suppress/trigger; before estimate when stage ≥ constraints; on explicit “check missing scope”.

**Examples:**

- Accepted deck with no substructure consideration / clarification.
- Demolition present without waste-removal consideration.
- Bathroom tiling without waterproofing consideration.

### 6.2 AI-discovered

**When:** Contextual relationships not yet in catalogue; incomplete narrative evidence; multi-trade coordination language.

**Rules:**

- Must attach evidence references.
- Must not contradict active suppress predicates.
- Must merge with deterministic emissions (deterministic wins on conflicts of “required/suppress”).
- Presented with confidence band and explainability; never auto-accepted.

### 6.3 Merge / duplicate / conflict

1. Dedupe by `(kind, parent, childType)` preferring deterministic over AI.
2. Conflicts between AI and user Facts → `CONFLICT_WARNING`, prefer Facts.
3. User presentation: deterministic missing-scope first (recommended MVP — owner gate), then AI contextual.

---

## 7. Implementation note (future batches)

- Represent catalogue as versioned TypeScript data modules first (3.1B.2) before any DB table.
- DB-backed catalogue is an optional later migration — **Not Approved** unless owner decides.
- Map abstract child keys to org-enabled `organisation_work_areas` types; skip disabled types with clarification.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/SCOPE_RELATIONSHIP_CATALOGUE_SPEC.md` |
| Created | 2026-08-05 |
| Implementation | Stage 3.1B.2 — `lib/scope-discovery/catalogue/` (samples; production adoption Not Started) |
| Full encyclopaedia | Not built — samples only |

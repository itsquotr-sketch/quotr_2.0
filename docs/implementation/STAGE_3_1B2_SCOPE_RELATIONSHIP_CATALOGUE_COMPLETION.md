# Stage 3.1B.2 — Scope Relationship Catalogue Completion

**Status:** Complete — Local  
**Date:** 2026-08-05  
**Module:** `lib/scope-discovery/catalogue/`  
**Verify:** `scripts/verify-stage-3-1b2-scope-relationship-catalogue.ts` (47/47)  
**Production adoption:** **None**  

---

## 1. Objective

Deliver a data-driven, serialisable scope relationship catalogue and pure deterministic evaluator that emits Stage 3.1B.1 `ScopeDiscoverySuggestion` records for likely/required/conditional/missing scope, clarifications, and exclusions — without AI, persistence, UI, or Analyse Job wiring.

---

## 2. Catalogue architecture

```
lib/scope-discovery/catalogue/
  version.ts, types.ts, codes.ts
  normalisation.ts          # canonical IDs + aliases
  relationship-helpers.ts   # defineRelationship helpers
  condition-eval.ts         # three-valued condition engine
  validation.ts             # catalogue integrity
  evidence-builder.ts
  evaluator.ts              # evaluateScopeRelationships
  catalogue.ts              # assembled active catalogue
  relationships/
    deck.ts
    bathroom.ts
    commercial-fitout.ts
  index.ts
```

Catalogue data is plain readonly objects. Conditions are serialisable discriminated unions — **no executable predicates**.

---

## 3. Canonical scope IDs

Stable catalogue identifiers (e.g. `deck`, `waterproofing`, `partitions`, `waste_removal`).  
Stored Work Area types are **not renamed**. Aliases map synonyms / existing catalogue types (e.g. `internal_walls` → `partitions`, `external_stairs` → `stairs`, `plastering` → `linings`). See `DOCUMENTED_ALIASES`.

---

## 4. Relationship types

`REQUIRED` | `LIKELY` | `CONDITIONAL` | `CONFLICTING` | `EXCLUSION_CANDIDATE` | `CLARIFICATION`

Requirement levels: `MUST_CONSIDER` | `SHOULD_CONSIDER` | `MAY_CONSIDER`  
(`MUST_CONSIDER` means must be explicitly considered — not auto-included.)

---

## 5. Condition language

Operators include fact equals/exists/missing/none/unknown/explicit yes|no, constraint equals/exists, accepted WA exists/missing, numeric comparisons, and `all` / `any` groups.  
Missing data evaluates as **unknown**, not false (unless operator is existence/missing).

---

## 6. Evaluator

`evaluateScopeRelationships(input)` → suggestions (all `PROPOSED`), suppressed matches, conflicts, clarifications, warnings.  
Uses 3.1B.1 identity, rejection suppression (OCD-ISD-03), validation, and never auto-accepts.

---

## 7. Missing-scope classifications

`REQUIRED_CONSIDERATION_MISSING`, `LIKELY_SCOPE_MISSING`, `CONDITIONAL_SCOPE_POSSIBLE`, `CLARIFICATION_NEEDED`, `EXPLICITLY_SUPPRESSED`, `CONFLICT_DETECTED`, `ALREADY_COVERED`, `PREVIOUSLY_REJECTED`, `NOT_APPLICABLE` — mapped into 3.1B.1 suggestion kinds on emit.

---

## 8. Deck sample coverage

Demolition/waste on replacement; substructure clarify vs deliberate `none` → new substructure; piles/bearers/joists; decking/fascia/stairs/balustrade/handrail/coatings; access logistics; explicit no suppressions.

---

## 9. Bathroom sample coverage

Demolition/waste; plumbing; electrical; framing clarify on wall removal; linings; waterproofing with tiling; tiling; fixtures; fit-off even if client-supplied; painting; ventilation; existing-condition clarification.

---

## 10. Commercial-fitout sample coverage

Strip-out, waste, make-good; partitions→doors/services; ceilings→services/seismic clarify; fire-stopping clarify; flooring/joinery/linings/protection; access/logistics clarify for restricted/high-security constraints.

---

## 11. Evidence and explainability

Every emitted suggestion includes `DETERMINISTIC_RULE` evidence (`relationshipId` / rationale), plus supporting accepted WA / Fact / Constraint references when present. No fabricated excerpts.

---

## 12. Suppression / conflict treatment

Suppress conditions and accepted equivalent scope prevent proposals. Explicit no ≠ unknown. Prior rejection respected until material source change. Clarification kinds are not blocked merely because the parent WA is accepted.

---

## 13. Versioning

`SCOPE_RELATIONSHIP_CATALOGUE_VERSION = "scope-relationship-catalogue/v1"`  
Bump on meaning/condition/identifier/suppression/requirement changes, or additive relationships that alter discovery output. Not coupled to AI models.

---

## 14. Files changed

### Created
- `lib/scope-discovery/catalogue/**` (module tree above)
- `scripts/verify-stage-3-1b2-scope-relationship-catalogue.ts`
- `docs/implementation/STAGE_3_1B2_SCOPE_RELATIONSHIP_CATALOGUE_COMPLETION.md`

### Modified
- `docs/specifications/SCOPE_RELATIONSHIP_CATALOGUE_SPEC.md`
- `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/MVP_HARDENING_GUIDE.md`

---

## 15. Verification results

| Suite | Result |
| --- | --- |
| `verify-stage-3-1b2-scope-relationship-catalogue.ts` | **47/47 Pass** |
| `tsc` / lint / build | Pass (session) |
| Prior 3.1A / R1 / 3.1D / 3.1B.1 / 2B.10 | Pass (session regression) |

---

## 16. Known limitations

- Sample coverage only (not full trade encyclopaedia).
- Many candidate scope IDs are abstract (no stored WA type yet).
- No production adoption / Analyse Job integration.
- No AI merge in production (merge tested only in verify).
- Legal/consent thresholds intentionally avoided — clarification used instead.

---

## 17. No-production-adoption confirmation

No Analyse Job, AI prompt, UI, migration, persistence, Fact/Question mutation, commercial formula, Company DNA, or Builder Interview changes.

---

## 18. Recommendation for 3.1B.3

**AI discovery provider** — structured provider output validated to the 3.1B.1 contract, evidence refs, prompt/contract versioning — still without persistence adoption or Analyse Job behaviour change until owner-gated orchestration. Status: **Ready Pending Owner Gate** (provider data minimisation already approved as OCD-ISD-17; fallback/prompt change gates remain).

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B2_SCOPE_RELATIONSHIP_CATALOGUE_COMPLETION.md` |
| Created | 2026-08-05 |

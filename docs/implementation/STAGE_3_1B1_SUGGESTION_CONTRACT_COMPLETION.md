# Stage 3.1B.1 — Suggestion Contract Completion

**Status:** Complete — Local  
**Date:** 2026-08-05  
**Module:** `lib/scope-discovery/`  
**Verify:** `scripts/verify-stage-3-1b1-suggestion-contract.ts` (53/53)  
**Production adoption:** **None** — Analyse Job and proposal paths do not import this module  

---

## 1. Objective

Deliver a pure, deterministic, database-free, provider-free, UI-free suggestion contract and lifecycle for Intelligent Scope Discovery — ready for later batches, unused by production in this batch.

---

## 2. Owner decisions approved

Recorded 2026-08-05 in `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md`:

| ID | Topic | Approved rule |
| --- | --- | --- |
| OCD-ISD-01 | Accept behaviour | Accept creates Work Area via application lifecycle later; never fabricates authoritative Facts (no production wiring in 3.1B.1) |
| OCD-ISD-02 | Low-confidence display | Group as “Other possibilities”; not hidden; not mixed with primary |
| OCD-ISD-03 | Rejection suppression | Suppress until material source change; provider/model upgrade alone does not reset |
| OCD-ISD-05 | Deterministic-first | Deterministic required/suppress/conflict wins; AI cannot bypass suppress |
| OCD-ISD-08 | Explicit analysis trigger | User triggers analysis; stale may show “Analyse again”; no auto paid calls |
| OCD-ISD-12 | Staleness | Proposed may stale on material source change; accepted WAs / user Facts never auto-revert |
| OCD-ISD-17 | Provider data minimisation | Brief + relevant notes/WAs/Facts/Constraints only; no secrets/unrelated org/customer dumps/attachments |

All other decisions remain Pending or Deferred.

---

## 3. Public contract

`SCOPE_DISCOVERY_CONTRACT_VERSION = "scope-discovery-suggestion/v1"`

Canonical type: `ScopeDiscoverySuggestion` (readonly) with explicit nulls, evidence, source snapshot, decision metadata, status, confidence + band, provenance fields. Commercial money fields are forbidden by validation.

---

## 4. Suggestion kinds

`WORK_AREA`, `SUB_SCOPE`, `MISSING_SCOPE`, `DEPENDENCY`, `POSSIBLE_EXCLUSION`, `CLARIFICATION_REQUIRED`, `DUPLICATE_WARNING`, `CONFLICT_WARNING`

---

## 5. Status lifecycle

Commands: `ACCEPT`, `REJECT`, `MODIFY`, `MARK_STALE`, `SUPERSEDE`, `MARK_FAILED`

| From | Allowed |
| --- | --- |
| PROPOSED | all commands |
| ACCEPTED | none (historical; no auto-stale) |
| REJECTED | SUPERSEDE only |
| MODIFIED | none |
| STALE | SUPERSEDE |
| SUPERSEDED / FAILED | terminal |

MODIFY preserves original proposal fields; corrections live on `decision`.

---

## 6. Evidence model

Types include brief, site note, user fact, constraint, existing WA, deterministic rule, user correction, plus contract-ready `DOCUMENT_REFERENCE` / `PHOTO_REFERENCE` (attachments not implemented).

---

## 7. Confidence model

Numeric confidence ∈ [0,1] plus required band `HIGH` | `MEDIUM` | `LOW` with range consistency checks. Not commercial certainty; never auto-accepts.

---

## 8. User decision model

`ScopeDiscoveryDecision`: decisionType, actor, timestamps, originalSuggestionId, modified fields, reasonCode, optional note, sourceRevision, resultingWorkAreaId. No Company DNA / defaults mutation.

---

## 9. Staleness rules

Material: brief, notes, facts, constraints, work areas, catalogue version, contract version.  
Non-material: provider/model id, formatting revision.  
Accepted/modified: never auto-stale.  
Rejected: `suppressionResetEligible` only after material change.

---

## 10. Identity and deduplication

Identity from project + kind + normalized WA type + related WA + parent + catalogue edge — **not** title text. Classes: `EXACT_DUPLICATE`, `SEMANTIC_DUPLICATE`, `EXISTING_ACCEPTED_SCOPE`, `PREVIOUSLY_REJECTED`, `CONFLICTING_SUGGESTION`, `DISTINCT`.

---

## 11. Merge behaviour

Deterministic first; AI evidence may merge into equivalent deterministic identity; deterministic suppress/conflict blocks AI; rejections suppress until material change; accepted types suppress; LOW → `otherPossibilities`; HIGH/MEDIUM → `primarySuggestions`; deterministic ordering.

---

## 12. Immutability

Local `deepFreeze` (not coupled to commercial-engine). Transitions/merge do not mutate inputs; results frozen.

---

## 13. Version governance

Bump `SCOPE_DISCOVERY_CONTRACT_VERSION` on field, lifecycle, identity, evidence, or merge semantic changes. Never use model name as contract version.

---

## 14. Files changed

### Created
- `lib/scope-discovery/index.ts`
- `lib/scope-discovery/version.ts`
- `lib/scope-discovery/types.ts`
- `lib/scope-discovery/codes.ts`
- `lib/scope-discovery/immutability.ts`
- `lib/scope-discovery/confidence.ts`
- `lib/scope-discovery/evidence.ts`
- `lib/scope-discovery/validation.ts`
- `lib/scope-discovery/lifecycle.ts`
- `lib/scope-discovery/identity.ts`
- `lib/scope-discovery/staleness.ts`
- `lib/scope-discovery/deduplication.ts`
- `lib/scope-discovery/merge.ts`
- `scripts/verify-stage-3-1b1-suggestion-contract.ts`
- `docs/implementation/STAGE_3_1B1_SUGGESTION_CONTRACT_COMPLETION.md`

### Modified (docs/status only outside module)
- `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md`
- `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/MVP_HARDENING_GUIDE.md`

---

## 15. Verification results

| Suite | Result |
| --- | --- |
| `npx tsx scripts/verify-stage-3-1b1-suggestion-contract.ts` | **53/53 Pass** |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass (unused-import warnings fixed) |
| `npm run build` | Pass |
| `verify-stage-3-1a-product-stabilisation.ts` | 37/37 Pass |
| `verify-stage-3-1a-r1-preview-remediation.ts` | 42/42 Pass |
| `verify-stage-3-1d-domain-model-refinement.ts` | 45/45 Pass |
| `verify-batch-2b10-final-commercial-authority.ts` | 57/57 Pass |

---

## 16. Known limitations

- No persistence / RLS tables.
- No production accept wiring (OCD-ISD-01 governs future batches).
- No UI grouping implementation (merge only separates arrays).
- No catalogue implementation (3.1B.2).
- No AI provider integration (3.1B.3).
- Attachments evidence types are placeholders only.

---

## 17. No-production-adoption confirmation

Confirmed: no Analyse Job behaviour change; no AI prompt/provider change; no migration; no UI change; no commercial formula change; no Company DNA; no Builder Interview; production assistant/proposal paths do not import `lib/scope-discovery`.

---

## 18. Recommendation for 3.1B.2

Implement the **scope relationship catalogue foundation** (deck/bathroom/commercial-fitout samples + deterministic missing-scope evaluator) consuming this contract’s suggestion kinds/identity — still without AI provider integration or production Analyse Job rewiring.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B1_SUGGESTION_CONTRACT_COMPLETION.md` |
| Created | 2026-08-05 |

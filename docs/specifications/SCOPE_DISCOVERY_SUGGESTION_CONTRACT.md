# Scope Discovery Suggestion Contract

**Status:** Specification (Stage 3.1B.0) — not implemented  
**Date:** 2026-08-05  
**Contract version (conceptual):** `scope-discovery-suggestion/v1`  
**Boundary:** `docs/specifications/INTELLIGENT_SCOPE_DISCOVERY_BOUNDARY.md`

---

## 1. Purpose

Define a canonical immutable concept **`ScopeDiscoverySuggestion`**: an AI- or rules-produced proposal that never becomes scope authority until the user accepts, rejects, or modifies it under application rules.

---

## 2. Canonical type — ScopeDiscoverySuggestion

Fields justified for MVP. Do not invent unused fields.

| Field | Type (conceptual) | Required | Meaning |
| --- | --- | --- | --- |
| `suggestionId` | string (UUID) | Yes | Stable id for this suggestion version |
| `projectId` | string (UUID) | Yes | Owning project |
| `orgId` | string (UUID) | Yes | Tenant (denormalised for ownership checks) |
| `proposedWorkAreaType` | string \| null | Conditional | Catalogue type when kind is work-area-like |
| `proposedTitle` | string | Yes | Human title |
| `proposedDescription` | string \| null | No | Short scope description |
| `parentSuggestionId` | string \| null | No | Parent suggestion for sub-scope trees |
| `relatedWorkAreaId` | string \| null | No | Existing WA this relates to / would update |
| `suggestionKind` | enum | Yes | See §3 |
| `confidence` | number 0–1 | Yes | Bounded model/rules score |
| `confidenceBand` | `high` \| `medium` \| `low` | Yes | User-facing band (derived from confidence + rules) |
| `evidence` | EvidenceItem[] | Yes | ≥1 item preferred; empty only for pure deterministic structural warnings with rule id |
| `rationaleKey` | string | Yes | Stable key for i18n / explainability (not free-form money claims) |
| `structuredExplanation` | object \| null | No | Optional structured slots (never commercial totals) |
| `sourceInputs` | SourceInputRef[] | Yes | Brief/notes/facts/etc. snapshot refs |
| `dependencyReferences` | string[] | No | Other suggestionIds or catalogue edge ids |
| `conflictReferences` | string[] | No | Conflicting suggestionIds / WA ids / fact keys |
| `missingInformation` | ClarificationNeed[] | No | What would raise confidence |
| `status` | enum | Yes | See §4 |
| `userDecision` | UserDecision \| null | No | Populated after decision |
| `createdAt` | ISO datetime | Yes | |
| `updatedAt` | ISO datetime | Yes | |
| `analysisRunId` | string | Yes | Owning `ScopeDiscoveryRun` |
| `providerMetadata` | object \| null | No | Model/provider/request ids — no secrets |
| `contractVersion` | string | Yes | e.g. `scope-discovery-suggestion/v1` |

### 2.1 UserDecision

| Field | Meaning |
| --- | --- |
| `decision` | `accept` \| `reject` \| `modify` |
| `decidedAt` | ISO datetime |
| `decidedByProfileId` | Actor |
| `modifiedTitle` | If modify |
| `modifiedWorkAreaType` | If modify |
| `modifiedDescription` | If modify |
| `resultingWorkAreaId` | If accept/modify created or linked a WA |
| `notes` | Optional user note |

### 2.2 ClarificationNeed

| Field | Meaning |
| --- | --- |
| `key` | Stable clarification id |
| `promptKey` | Question template key / copy key |
| `relatedFactKeys` | Fact keys that would resolve it |

### 2.3 SourceInputRef

| Field | Meaning |
| --- | --- |
| `sourceType` | Evidence source type (see evidence model) |
| `sourceId` | Row id or synthetic id |
| `snapshotHash` | Hash of content used at run time |

---

## 3. Suggestion kinds

Only kinds justified by current product needs:

| Kind | Meaning |
| --- | --- |
| `WORK_AREA` | Propose a top-level work area |
| `SUB_SCOPE` | Propose a child scope under a parent WA/suggestion |
| `MISSING_SCOPE` | Likely omitted scope relative to accepted/parent scope |
| `DEPENDENCY` | Prerequisite / related scope dependency |
| `POSSIBLE_EXCLUSION` | Scope that may be out of contract / alternate |
| `CLARIFICATION_REQUIRED` | Need user input before scope can be confidently proposed |
| `DUPLICATE_WARNING` | Likely duplicate of existing WA/suggestion |
| `CONFLICT_WARNING` | Conflicts with Facts, exclusions, or other suggestions |

Do **not** add kinds for commercial line items, rates, margin, or DNA rules.

---

## 4. Statuses

| Status | Meaning |
| --- | --- |
| `PROPOSED` | Visible candidate awaiting user decision |
| `ACCEPTED` | User accepted; domain apply completed or queued per rules |
| `REJECTED` | User rejected; retained as decision evidence |
| `MODIFIED` | User changed then accepted; original preserved via provenance |
| `SUPERSEDED` | Replaced by a newer suggestion from a later run |
| `STALE` | No longer valid given source/input change; not actionable |
| `FAILED` | Could not be materialised / validation failed |

---

## 5. Lifecycle and allowed transitions

```
PROPOSED → ACCEPTED
PROPOSED → REJECTED
PROPOSED → MODIFIED
PROPOSED → SUPERSEDED
PROPOSED → STALE
PROPOSED → FAILED

ACCEPTED → STALE          (only if accepted WA later excluded and product marks suggestion stale — optional; prefer WA lifecycle)
REJECTED → SUPERSEDED     (reconsideration creates new PROPOSED; old stays REJECTED or SUPERSEDED)
MODIFIED → STALE          (rare; same as accepted)

Any non-terminal may → FAILED on apply error (apply must be transactional / compensating)

Terminal for actionability: ACCEPTED, REJECTED, MODIFIED, SUPERSEDED, STALE, FAILED
```

**Forbidden:**

- `REJECTED` → `ACCEPTED` without a **new** suggestion (create new `PROPOSED` with new evidence);
- `STALE` → `ACCEPTED` without new run;
- auto `PROPOSED` → `ACCEPTED`.

### 5.1 Immutability rule

The original proposal payload (title, type, evidence, confidence at creation) is **immutable**. Modifications create decision metadata and, if needed, a linked accepted WA from **modified** fields — they do not rewrite the original proposal body. Superseding creates a new suggestion id.

---

## 6. Acceptance behaviour (normative intent)

### 6.1 Accept Work Area suggestion

| Step | Behaviour |
| --- | --- |
| Create WA? | **Yes** (recommended MVP default — owner gate) as `confirmed` (or `suggested` only if product keeps confirm stage) |
| Title/type | From suggestion, or modified fields if MODIFIED |
| Evidence | Retained on suggestion + run; not copied into commercial lines |
| Questions | Generated via existing question builders after WA exists — **not** invented ad hoc by AI |
| Facts | **Do not invent** quantities/finishes on accept unless owner explicitly approves AI-fact adoption path; prefer unanswered questions |
| Not inferred | Rates, margin, GST, assemblies, DNA |
| Duplicates | Block if same type/title already confirmed; emit `DUPLICATE_WARNING` instead |

### 6.2 Reject

| Step | Behaviour |
| --- | --- |
| Retain | Rejection decision + evidence on suggestion |
| Resuggest | Suppress identical kind+type while source snapshot unchanged |
| Reconsider | Allowed when brief/notes/facts/WAs materially change (new run + new suggestion) |
| Not | Permanent company rule / DNA update |

### 6.3 Modify

| Step | Behaviour |
| --- | --- |
| Preserve | Original proposal immutable |
| Preserve | User correction in `userDecision` |
| Create | Accepted WA from modified data |
| Provenance | Keep for Evidence Engine |
| Not | Auto-update Company Defaults |

### 6.4 Rerun analysis

| Step | Behaviour |
| --- | --- |
| Preserve | Accepted Work Areas |
| Preserve | User Facts |
| Do not recreate | Rejected duplicates without new evidence |
| Mark | Outdated `PROPOSED` → `STALE` or `SUPERSEDED` |
| Create | New proposals only where evidence/hash changed |
| Idempotency | Same idempotency key + same snapshot → reuse run |

---

## 7. Evidence and confidence (summary)

Full model in § attached conceptual section (also referenced by plan). Confidence is **not** commercial certainty and **never** auto-accepts.

### 7.1 EvidenceItem

| Field | Meaning |
| --- | --- |
| `sourceType` | See §7.2 |
| `sourceId` | Identifier |
| `excerptOrValue` | Short excerpt or structured value |
| `relevance` | `primary` \| `supporting` \| `contrary` |
| `timestamp` | When source was observed / written |
| `provenance` | `ai` \| `deterministic_rule` \| `user` \| `system` |
| `userAuthored` | boolean |
| `authoritative` | boolean — true only for user Facts/constraints/accepted WAs |

### 7.2 Evidence source types

| Type | Notes |
| --- | --- |
| `PROJECT_BRIEF_TEXT` | From `projects.brief_text` |
| `SITE_NOTE` | From `project_notes` |
| `USER_FACT` | From `project_facts` source=user |
| `CONSTRAINT` | From `constraints` |
| `EXISTING_WORK_AREA` | From `work_areas` |
| `DOCUMENT_REFERENCE` | Future |
| `PHOTO_REFERENCE` | Future |
| `DETERMINISTIC_RULE` | Catalogue / rule id |
| `USER_CORRECTION` | Prior modify/reject decisions |

### 7.3 Confidence bands

| Band | Interpretation | UX |
| --- | --- | --- |
| `high` | Strong evidence; still requires user decision | Show prominently |
| `medium` | Plausible; review recommended | Show in main list |
| `low` | Weak / speculative | Group or de-emphasise (owner gate) — **never auto-hide permanently without owner decision** |

Confidence must be bounded `[0,1]`, explainable via evidence + `rationaleKey`, separate from estimate confidence metadata.

---

## 8. Analysis-run concept — ScopeDiscoveryRun

Persistence **not** implemented in 3.1B.0. Conceptual fields:

| Field | Meaning |
| --- | --- |
| `runId` | UUID |
| `projectId` / `orgId` | Ownership |
| `trigger` | See §8.1 |
| `sourceSnapshotRefs` | Hashes/ids of brief, notes, WA set, facts, constraints |
| `provider` / `model` | e.g. anthropic / model id |
| `promptContractVersion` | Prompt/contract version string |
| `startedAt` / `completedAt` | Timestamps |
| `resultStatus` | `succeeded` \| `failed` \| `cancelled` \| `empty` |
| `suggestionIds` | Produced suggestions |
| `failure` | Safe error code/message |
| `latencyMs` | Measured when available |
| `tokenOrCostMetadata` | Optional; no secrets |
| `supersededByRunId` | Later run |
| `idempotencyKey` | Trigger + snapshot hash |

### 8.1 Triggers

- `initial_analyse_job`
- `project_brief_changed`
- `site_notes_analysed`
- `user_requested_rerun`
- `work_area_changed`
- `proposal_decision_changed`

---

## 9. Security notes (contract level)

- Every suggestion/run is org+project scoped.
- Provider metadata must not include API keys or full PII dumps in logs.
- Output must be schema-validated before persistence.
- See owner decisions + plan security section for storage RLS on future attachments.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/SCOPE_DISCOVERY_SUGGESTION_CONTRACT.md` |
| Created | 2026-08-05 |
| Implementation | Deferred to Stage 3.1B.1+ |

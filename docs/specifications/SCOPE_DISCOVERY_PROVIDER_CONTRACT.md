# Scope Discovery Provider Contract

**Status:** Active — Stage 3.1B.3 Complete — Local  
**Date:** 2026-08-05  
**Module:** `lib/scope-discovery/provider/`  
**Prompt version:** `scope-discovery-prompt/v1`  
**Suggestion contract:** `scope-discovery-suggestion/v1`  
**Production adoption:** None  

Related:

- `docs/specifications/SCOPE_DISCOVERY_SUGGESTION_CONTRACT.md`
- `docs/specifications/SCOPE_RELATIONSHIP_CATALOGUE_SPEC.md`
- `docs/specifications/INTELLIGENT_SCOPE_DISCOVERY_BOUNDARY.md`
- `docs/implementation/STAGE_3_1B3_AI_DISCOVERY_PROVIDER_COMPLETION.md`

---

## 1. Role

The AI discovery provider is a **contextual proposal adapter**. It:

- accepts minimised discovery input;
- calls a versioned dedicated prompt;
- returns validated PROPOSED candidates only;
- never mutates application data;
- never calculates money;
- never overrides deterministic catalogue suppressions.

Deterministic catalogue + 3.1B.1 merge remain authoritative for required / suppressing / conflicting relationships.

---

## 2. Input — `ScopeDiscoveryProviderInput`

| Field | Required | Notes |
| --- | --- | --- |
| `projectId`, `orgId`, `analysisRunId` | yes | UUIDs |
| `projectBrief` | yes | capped |
| `selectedSiteNotes` | yes | id + content only |
| `acceptedWorkAreas` | yes | id, type, title |
| `relevantFacts` | yes | key + scalar/null value |
| `relevantConstraints` | yes | key + scalar/null value |
| `deterministicSuggestions` | yes | 3.1B.1 suggestions (for context) |
| `deterministicSuppressions` | yes | relationshipId, candidateScopeType, reason |
| `deterministicConflicts` | yes | relationshipId, candidateScopeType, reason |
| `sourceSnapshot` | yes | staleness / version binding |
| `catalogueVersion` | yes | catalogue pin |
| `contractVersion` | yes | must match suggestion contract |
| `region` | yes | nullable string |
| `analysisObjective` | yes | explicit objective string |

**Must not include:** prices, margin, GST, quotes, secrets, attachments, unrelated org/customer dumps, raw DB rows, full history.

**Limits:** see `PROVIDER_INPUT_LIMITS`. Exceeding limits fails closed — no silent truncation of authoritative facts.

Zero (`0`) and unknown (`null`) remain distinct.

---

## 3. Transport

```ts
type ScopeDiscoveryTransport = (
  request: ScopeDiscoveryTransportRequest
) => Promise<ScopeDiscoveryTransportResponse>;
```

Production Anthropic transport uses `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` via existing `lib/ai/anthropic`. Automated tests inject fakes.

---

## 4. Prompt governance

- Constant: `SCOPE_DISCOVERY_PROMPT_VERSION`
- Propose-only; deterministic authority; no money; no legal conclusions; cite only supplied evidence refs; schema-exact JSON.
- Independent of Analyse Job brief extraction prompt.
- Version bump required when instructions or schema obligations change.
- Results remain tied to provider + model + prompt + contract + catalogue versions (OCD-ISD-16).

---

## 5. Provider JSON schema

```json
{
  "candidates": [
    {
      "suggestionKind": "WORK_AREA | SUB_SCOPE | …",
      "proposedWorkAreaType": "canonical-or-aliased-id",
      "proposedTitle": "string",
      "proposedDescription": "string | null",
      "relatedWorkAreaReference": "work-area:<uuid> | <uuid> | null",
      "parentSuggestionReference": "string | null",
      "confidenceBand": "HIGH | MEDIUM | LOW",
      "evidenceReferences": ["brief:project", "note:<id>", "…"],
      "rationaleCode": "string",
      "missingInformation": [{ "key": "", "promptKey": "", "relatedFactKeys": [] }],
      "dependencyReferences": [],
      "conflictReferences": []
    }
  ],
  "warnings": []
}
```

Strict mode: unknown fields rejected. Commercial fields and decision/status fields rejected.

---

## 6. Evidence references

| Pattern | Source |
| --- | --- |
| `brief:project` | Project Brief |
| `note:<note-id>` | Selected site note |
| `fact:<fact-key>` | Relevant fact |
| `constraint:<constraint-key>` | Relevant constraint |
| `work-area:<work-area-id>` | Accepted work area |
| `rule:<relationship-id>` | Deterministic rule id |

Unknown refs → validation failure. HIGH band requires ≥2 refs. Model excerpts never become authoritative Facts by themselves.

---

## 7. Mapping to suggestions

- Quotr generates `suggestionId` deterministically from project/run/kind/scope/rationale.
- Status always `PROPOSED`.
- Origin `ai`.
- Provider metadata records provider, model, prompt version.
- No merge inside the provider module.

---

## 8. Repair (OCD-ISD-15)

| Attempt | Behaviour |
| --- | --- |
| Primary | Full discovery call |
| Repair (≤1) | Same model; schema-conforming JSON only; prior errors + truncated malformed text |
| After repair fail | Controlled failure; no third attempt; no silent model swap |

---

## 9. Result — `ScopeDiscoveryProviderResult`

`success`, `provider`, `model`, `promptVersion`, `contractVersion`, `catalogueVersion`, `analysisRunId`, `contextualSuggestions`, `warnings`, `validationErrors`, `repairAttempted`, `latencyMs`, `tokenUsage`, `failureCode`, `failureMessage`.

Immutable. No secrets. Raw provider text not part of the public result.

---

## 10. Failure codes

See `PROVIDER_ERROR_CODES` in `lib/scope-discovery/provider/errors.ts`. User-facing messages via `safeProviderFailureMessage` only.

---

## 11. Non-goals (this batch)

- Orchestration / persistence (3.1B.4+)
- Accept/reject UI
- Analyse Job rewire
- Company DNA / Builder Interview
- Commercial formula changes

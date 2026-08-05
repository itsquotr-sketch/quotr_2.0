# Stage 3.1B.3 — AI Discovery Provider Completion

**Status:** Complete — Local  
**Date:** 2026-08-05  
**Module:** `lib/scope-discovery/provider/`  
**Verify:** `scripts/verify-stage-3-1b3-ai-discovery-provider.ts` (55/55)  
**Production adoption:** **None**  
**Analyse Job:** **Unchanged**  
**Migrations:** **Not Approved**  
**UI:** **Not Started**  

---

## 1. Objective

Create a provider-isolated AI discovery adapter that produces validated contextual `ScopeDiscoverySuggestion` candidates (PROPOSED only), without persistence, UI, Analyse Job rewiring, or commercial authority.

---

## 2. Owner decisions approved

Recorded as **Approved** on 2026-08-05:

| ID | Decision |
| --- | --- |
| OCD-ISD-06 | Brief-change rerun — no automatic paid provider call; may mark stale → “Analyse again” |
| OCD-ISD-07 | Site-note rerun — no automatic paid provider call; may mark stale |
| OCD-ISD-14 | Latency targets — ≤200 ms acknowledgement; p95 ≤20 s completed result (targets, not SLOs) |
| OCD-ISD-15 | Provider fallback — one primary + one structured-output repair; no silent model substitution |
| OCD-ISD-16 | Provider/model upgrades — results tied to provider/model/prompt/contract/catalogue versions; upgrades create new runs |

---

## 3. Provider architecture

```
lib/scope-discovery/provider/
  version.ts                 # SCOPE_DISCOVERY_PROMPT_VERSION
  errors.ts                  # controlled failure codes
  configuration.ts           # pure ANTHROPIC_API_KEY presence checks
  types.ts                   # input/result/transport contracts + limits
  normalise-input.ts         # minimise + bound inputs
  prompt.ts                  # dedicated propose-only prompt
  schema.ts                  # strict Zod provider JSON
  validate-output.ts         # evidence, suppression, commercial, legal
  map-output-to-suggestions.ts
  repair.ts                  # primary + single repair transport calls
  run.ts                     # runScopeDiscoveryProvider
  anthropic-provider.ts      # server-only live transport (unused by app)
  index.ts                   # public pure exports (no live transport)
```

Transport is injected. Live Anthropic transport is **not** re-exported from `index.ts` so verification stays key-free.

---

## 4. Input minimisation

`ScopeDiscoveryProviderInput` includes only project/analysis ids, brief, selected notes, accepted work areas, relevant facts/constraints, deterministic suggestions/suppressions/conflicts, source snapshot, catalogue/contract versions, region, and analysis objective.

**Limits (`PROVIDER_INPUT_LIMITS`):** brief 5000 chars; 20 notes × 2000 chars; 40 work areas; 80 facts; 40 constraints; 60 deterministic suggestions/suppressions; 40 conflicts; 30 output candidates.

Authoritative facts are **not** silently truncated — over-limit returns controlled `INPUT_VALIDATION_FAILED`. Commercial/irrelevant keys rejected.

---

## 5. Prompt governance

`SCOPE_DISCOVERY_PROMPT_VERSION = "scope-discovery-prompt/v1"`.

Dedicated system prompt states: propose-only; deterministic authority; no silent contradiction of accepted WAs/Facts; respect suppressions; unknown stays unknown; clarification over fabrication; no money; no legal conclusions; cite only supplied refs; schema-exact JSON.

Independent of Analyse Job `BRIEF_EXTRACTION_SYSTEM_PROMPT` — **unchanged**.

Bump prompt version when instructions, evidence rules, deterministic-authority wording, or required schema shape change.

---

## 6. Output schema

Strict Zod object: `{ candidates, warnings }`. Each candidate: suggestionKind, proposedWorkAreaType, proposedTitle, proposedDescription, relatedWorkAreaReference, parentSuggestionReference, confidenceBand, evidenceReferences, rationaleCode, missingInformation, dependencyReferences, conflictReferences.

Forbidden: prices/rates/margins/GST, accepted/rejected/modified statuses, persisted IDs trusted from the model, commercial totals, DNA rules, mutation instructions.

Mapped suggestions are always `status: "PROPOSED"`, `origin: "ai"`, with Quotr-generated UUIDs.

---

## 7. Evidence validation

Allowed refs: `brief:project`, `note:<id>`, `fact:<key>`, `constraint:<key>`, `work-area:<id>`, `rule:<relationship-id>` from supplied input only.

Rejects unknown/fabricated refs. HIGH confidence requires ≥2 evidence references. Any confidence requires ≥1. Mapped evidence is never treated as new authoritative Facts solely because the model quoted it.

---

## 8. Deterministic authority

Provider receives deterministic suggestions, suppressions, and conflicts. May add contextual candidates or evidence for equivalents. **Cannot** override suppressions (validated out). Does **not** merge inside the adapter — `mergeScopeSuggestions` (3.1B.1) remains final pure merge authority.

---

## 9. Repair behaviour (OCD-ISD-15)

1. Primary transport call.  
2. If malformed/invalid → exactly one repair with validation errors + truncated malformed text.  
3. Same model; no alternate provider.  
4. Repair failure → controlled `REPAIR_FAILED`; no third attempt.

Records: repairAttempted, validationErrors, latencyMs, tokenUsage when available.

---

## 10. Anthropic configuration

Uses existing `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` via `lib/ai/anthropic`. Missing key → `PROVIDER_CONFIGURATION_MISSING`. Key never logged. Live transport module is `server-only` and unused by production.

---

## 11. Error model

Controlled codes: `PROVIDER_CONFIGURATION_MISSING`, `INPUT_VALIDATION_FAILED`, `MALFORMED_OUTPUT`, `OUTPUT_VALIDATION_FAILED`, `REPAIR_FAILED`, `TRANSPORT_FAILED`, `COMMERCIAL_CONTENT_FORBIDDEN`, `UNSUPPORTED_EVIDENCE_REFERENCE`, `DETERMINISTIC_SUPPRESSION_VIOLATION`, `EXCESSIVE_OUTPUT`.

`safeProviderFailureMessage` never includes secrets or raw provider dumps.

---

## 12. Mockable transport

`ScopeDiscoveryTransport` interface injected into `runScopeDiscoveryProvider`. Automated verification uses deterministic fakes — **no live API key required**.

---

## 13. Files changed

**Created:**

- `lib/scope-discovery/provider/*` (module as above)
- `scripts/verify-stage-3-1b3-ai-discovery-provider.ts`
- `docs/implementation/STAGE_3_1B3_AI_DISCOVERY_PROVIDER_COMPLETION.md`
- `docs/specifications/SCOPE_DISCOVERY_PROVIDER_CONTRACT.md`

**Updated:**

- `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md`
- `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/MVP_HARDENING_GUIDE.md`

---

## 14. Verification results

`npx tsx scripts/verify-stage-3-1b3-ai-discovery-provider.ts` — all checks pass (input, prompt, output, repair, deterministic merge integration, security/boundaries, immutability).

Full regression suite required by this batch also passes (see batch run notes).

---

## 15. Known limitations

- Not orchestrated; no persistence of runs/suggestions.
- No UI; no accept/reject wiring.
- Live Anthropic path unused by application code.
- Latency targets are design targets only until instrumentation (OCD-ISD-14).
- Prompt v1 is first cut — may refine without rewriting historical results once persistence exists (OCD-ISD-16).

---

## 16. Confirmation — no production adoption

- No production imports of `lib/scope-discovery/provider`.
- Analyse Job / brief extraction prompt unchanged.
- No persistence, migrations, UI, Company DNA, Builder Interview, or commercial-formula changes.

---

## 17. Recommendation for 3.1B.4

**Discovery-run and proposal orchestration** — Ready Pending Persistence Owner Gate:

- Explicit user-triggered runs (honour OCD-ISD-06/07/08).
- Merge deterministic + contextual via 3.1B.1.
- Stale marking without auto paid calls.
- Persistence only if owner approves migrations; otherwise in-memory/session orchestration remains gated.

Do **not** begin accept/reject UI or Analyse Job rewire until separately authorised.

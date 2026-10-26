# Estimating V3 Stage 0 — architecture and contracts

Baseline: `40d98384` on `estimating/v3-stage-0`. This is the pipeline that is in the tree, not a proposed replacement.

## Pipeline

```text
brief
  -> deterministic enrichment and portion/type parsers
  -> work areas + project_facts + project constraints
  -> Details questions (Clarify) and work-area editors
  -> readiness
  -> physical requirements
  -> commercial lines (rates, productivity, margin)
  -> stale mark on the saved estimate
  -> pricing adoption
  -> quote revision and issuer snapshot
```

| Stage | Owns the contract | Main modules |
| --- | --- | --- |
| Recognition | Scope catalogue types, plus nested parsers that can override a type | `lib/scopes/catalogue.ts`, `lib/ai/enrich-extraction.ts`, `lib/ai/brief-extraction-prompt.ts`, `lib/estimate/flooring-brief.ts`, `lib/estimate/internal-walls-brief.ts` |
| Instances inside one work area | Portion or wall-type id inside one JSON fact | `flooring.portions`, ceilings portions, doors portions, cladding portions, `internal_walls` wall types. Id helpers live beside each collection. |
| Fact origin | `project_facts.source` for scalar rows. Nested fields also store `*_authority` on the portion. | `lib/assistant/scope-persistence.ts` `resolveCommittedFactWrite` sets `user` or `assumption`. Extraction sets `ai_extracted` or `extracted`. |
| Questions | One candidate shape, several generators | `lib/assistant/clarify/compose.ts`, `lib/assistant/clarify/rank.ts`, work-area `*-information-contract.ts`, `lib/scopes/templates/*`, `lib/scopes/conditional-rules.ts` |
| Validation and save | Zod on the server action, then type normalisation, then the collection writer | `lib/assistant/fact-actions.ts`, `lib/scopes/fact-values.ts` `normalizeAnswerForStorage`, `applyFlooringFactWrite` and the matching collection writers |
| Reload | Canonical `project_facts` win over question rows | `lib/scopes/scope-review.ts` merge comment: question answers are a display baseline; persisted facts are the estimating authority |
| Details and generate | Clarify remaining count, then deck post-hole gaps, then package conditions | `lib/assistant/readiness/clarify-estimate.ts`, `lib/estimate/deck-detail-completeness.ts` |
| Quantities and recipes | Physical calculators emit requirements | `lib/estimate/calculators/*`, `lib/estimate/*-physical.ts` |
| Rates and productivity | Company row, then benchmark cost, then gross-margin sell when no paired sell | `lib/estimate/rates.ts`, `lib/commercial-engine/core/cost-first-authority.ts`, `lib/estimate/resolve-material-rate.ts` |
| Subcontract and customer supply | Requirement pricing owner and specialist kind | Flooring subcontract catalogue keys; `specialist_kind: client_supplied`; bathroom `subcontractor_allowance` |
| Quote handoff | Pricing lines become a quote revision. Issuer snapshot and fingerprint are separate from the live estimate. | `lib/quotes/build-from-pricing.ts`, `lib/quotes/revision.ts`, `lib/quotes/issuer-snapshot.ts`, `lib/quotes/snapshot-fingerprint.ts` |

A user fact write calls `markEstimateStaleWithContext` after the commit (`lib/assistant/fact-actions.ts`). It does not rewrite an issued snapshot. This pass did not open stored snapshot rows.

## Where the contracts agree

- Catalogue type strings (`deck`, `flooring`, `bathroom`, `internal_walls`, and the rest of `SCOPE_CATALOGUE`) are the work-area identity.
- Nested flooring, ceilings, doors, and cladding answers are not separate `project_facts` keys. They patch one collection fact. The logical key (`flooring.portion.hardwood_board_width_mm`) is the question identity.
- `classifyResolvedSell` is the shared sell decision: no sell on the rate means gross margin; a sell on the rate means a legacy paired sell; an explicit override stays an override.
- Labour without a company row uses `QUOTR_CARPENTER_BENCHMARK_COST_PER_HOUR` (60) or `QUOTR_LABOURER_BENCHMARK_COST_PER_HOUR` (35). Sell is then derived from the organisation margin. Company cost and a paired sell stay above that fallback.
- Generate stays blocked while Clarify still has an initial-capture question or while `deckDetailGaps` is non-empty. The finite-number check in `commitUserFactEdit` is what rejects a bad numeric write.

## Where the contracts disagree

1. **Number questions that also have options.** `flooringQuestionInputType` says board width and tile size are `number`. `flooringQuestionOptions` returns strings such as `145 mm` and `600 mm`. `ClarifyAnswerControl` renders those options before the number field, so the saved value is the option string. `persistClarifyValueType` still records `number` because the candidate input type is number. `normalizeAnswerForStorage` then calls `Number("145 mm")`, which is `NaN`. `commitUserFactEdit` rejects that with `Invalid fact update.` The portion parser `parseFlooringPositiveMm` would have accepted the same string. Two parsers, one question.

2. **Deck post count versus hole count.** `deckDetailGaps` asks for posts when `deck.bearer_row_count * deck.supports_per_bearer` is missing and `deck.pile_or_post_count` is missing. The gap id is `posts`. `deckPostHoleControlId` points that gap at `deck-hole-count-{workAreaId}`, and that input writes `deck.hole_count`. A saved hole count does not clear the post-count gap. `conditional-rules.ts` hides `deck.pile_or_post_count` unless pile replacement is yes, so the generic question is not the place the gap sends the user.

3. **Excavation versus the rest of Post holes.** `conditional-rules.ts` hides the hole keys from the generic question list. `deckFactIsRelevant` still treats them as relevant when a new substructure is included. Clarify’s deck descriptor list omits `REFINE`, so Details does not ask them as ordinary questions. Readiness still adds every `deckDetailGaps` label, including concrete fill, post size, and embedment, into the same unfinished count as ground, method, and spoil. Completing excavation does not complete that count when concrete is included.

4. **Two “not sure” readers.** `lib/estimate/facts.ts` treats `not_sure` as empty for `getStringFact` and `getNumberFact`. `lib/scopes/fact-labels.ts` treats a listed select option as a real answer unless it is an explicit not-sure token. Spoil destination has its own reader that accepts `not_sure`. Ground and method go through `getStringFact`.

5. **Project-condition order is not stable.** `sortClarifyCandidates` orders by ask class, then rank score, then work-area name. `projectConditionCandidates` changes ask class when a condition becomes required, and it changes which keys exist when a bathroom is added. A deck-only queue and a deck-plus-bathroom queue are different lists. Newly relevant questions are inserted by class, not appended.

6. **Laminate has three identities.** The extraction prompt and `flooring-brief.ts` store laminate as `finish_type: other` and `specialist_kind: laminate`. `material-rate-keys.ts` names `flooring.laminate.m2`. That key is not in `SPECIFIC_MATERIAL_RATE_CATALOGUE`. `FITOUT_BENCHMARKS.laminateFlooringPerM2` is `{ cost: 110, sell: 165 }`. `commercializeFlooring` does not read it. The physical result is `UNSUPPORTED_SPECIALIST`. The missing-info sentence says pricing is required. The completeness enum and the sentence do not use the same word, and the legacy sell pair is unused.

7. **Carpet before tile.** `parseFlooringFinishType` returns `carpet` when the text contains “carpet”, before it checks “tile”. Carpet tiles become ordinary carpet. There is no carpet-tile catalogue key. The carpet row is broadloom supply and install.

8. **Multi-room split is positional.** `splitFlooringSnippets` only breaks a new sentence when the next sentence starts with install, lay, replace, supply and install, carpet, or tile. “Living” is not a location. “Living room” is. A kitchen sentence followed by “Living 20 m2 carpet” stays one portion. The first finish and the first area win.

9. **Sell pairs versus margin.** Live bathroom tiling calls `resolveRate` with the benchmark cost and no fallback sell. At the default 20% margin that is cost 180 and sell 225. The stored pair is cost 180 and sell 280, which `classifyResolvedSell` would keep as `legacy_paired_rate` if that sell were passed in. A company rate that has both cost and sell stays on the paired path and is not rewritten to margin.

10. **Preliminaries.** `WARNING_CODES.PRELIMINARY_ALLOWANCE` is the only `preliminary_allowance` occurrence under `lib/`. No work-area calculator emits a project-wide preliminary line. Work-area allowances can still sit beside each other without a shared owner.

## Instance identity today

A flooring portion id is stable for a normal field edit (`applyFlooringFactWrite` does not regenerate ids). A new portion created because the collection was empty gets a new id. Question identity includes `workAreaId`, fact key, and `nestedItemId`. A reload that loses the nested id falls back to the active portion, then the first portion. That is stable only while the active id is stored.

Scalar deck facts are one row per work area and key. They have no portion id. Two decks are two work areas, not two portions.

## Follow-up contract gaps

These were confirmed in the tree after the first write-up. The fixture now locks the template and consumed-fact cases.

11. **Work-area identity is the database UUID.** Extraction `instance_key` is not a column. Insert dedupe uses type plus name. Renaming a work area changes that key and a later analysis can insert a second row. Portion ids live inside the collection JSON. A re-parse that finds no `id` mints a new one. Ceiling re-analysis is the path that copies the stored portion id back.

12. **Source enums do not match.** `project_facts.source` includes `assumption` and `derived`. `questions.answer_source` does not. `mapFactSourceToQuestionAnswerSource` folds derived, system, and default into `system`, and returns null for `assumption`. Presentation uses another set: brief, answered, calculated, assumed.

13. **Four rate vocabularies.** Line items use `RateSourceType`. Requirements use `RequirementRateSource`. `resolveMaterialRate` uses `company_specific`, `company_category`, `company_scope`, `benchmark_specific`, `benchmark_category`, and `missing`. Pricing uses `calculator`, `benchmark`, `company_rate`, and `user_override`. `resolveMaterialRate` accepts `workAreaType` and category benchmark arguments and ignores both. `resolveRate` is the function that can use a blank-key work-area fallback, and only for an unnamed lookup.

14. **Doors customer supply does not round-trip.** The door template asks `doors.hardware_client_supplied` and `doors.supply_scope`. It does not ask `doors.client_supplied`. The legacy fit-out calculator treats the job as client-supplied only when `doors.client_supplied` is true or `doors.supply_scope` mentions client. The consumed-fact list contains all three keys.

15. **Cladding has no scope template.** `getScopeQuestions("cladding")` is empty. Clarify has to ask from the cladding portion contract. Pergola, demolition, external stairs, and plastering have templates and are absent from the consumed-fact map in `lib/estimate/consumed-facts.ts`.

16. **Legacy flooring is a second recipe.** When `flooring.portions` is absent, `calculateFlooring` prices `FITOUT_BENCHMARKS.flooringPerM2` at cost 120. It does not read `laminateFlooringPerM2`. On that same legacy path, stairs use cost `count × 45` and sell `count × 68` while the line is labelled `derived_from_gross_margin`. `68 / 45` is not `1 / 0.8`. Nested portions do not fall through to this path.

17. **Overlap groups do not collapse bathroom floors with Flooring.** Bathroom floor lines use `bathroom_floor_finish`. Flooring lines use `flooring.area:{portionId}`. Extraction can skip a bathroom-owned or kitchen-owned floor snippet. If both work areas are still confirmed, the deduper does not treat them as one scope. Bathroom stopping and paint are suppressed when a Plastering or Painting work area is present. Bathroom ceiling lining is not suppressed when a Ceilings work area is present.

18. **Deck post hours can include excavation.** `deck.posts.install.hours_per_ea` is documented as an imported 1 h/post that includes excavation. The separate set rate is `deck.posts.set.hours_per_post` at 0.5 h, and hole excavation is its own operation. The calculator holds a calibrated post rate for review until the job confirms the hours are installation only.

19. **Details can offer Generate while the server gate is still closed.** `settleDetailsJourney` can show the create action during `saving`. `evaluateGenerateEstimatePermission` still requires no pending writes, an empty deck-gap list, and package readiness.

## What V3 should extend

Keep `project_facts`, the collection envelopes, `classifyResolvedSell`, the quote snapshot modules, and the readiness gate. Do not add a second estimator beside them. The gaps are identity, provenance, question lifecycle, and one readiness report. Those are specified in `STAGE_0_IMPLEMENTATION_PLAN.md`.

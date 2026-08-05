# Stage 3.1B — Scope Discovery Owner Decisions

**Status:** Open — recommended MVP defaults only; **not approved**  
**Date:** 2026-08-05  
**Plan:** `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`

Do **not** treat recommendations as authorised. Owner must mark Approve / Reject / Defer per item.

---

## Decision register

| # | Decision | Recommended MVP default | Options | Status |
| ---: | --- | --- | --- | --- |
| 1 | Should accepted suggestions create Work Areas immediately? | **Yes** — create `confirmed` WA on Accept (skip redundant confirm if already in post-confirm stages); initial Analyse Job migration may keep suggested→confirm for one release | Immediate confirmed / suggested then confirm / defer create until questions answered | **Open** |
| 2 | Should low-confidence suggestions be hidden, grouped, or displayed? | **Grouped** under “Possible / low confidence” — visible but de-emphasised | Hide / group / display inline | **Open** |
| 3 | Should rejected suggestions remain suppressed permanently or until source change? | **Until source snapshot changes** (new evidence hash) | Permanent / until source change / session-only | **Open** |
| 4 | Should modified suggestions become learning evidence? | **Retain provenance only** — do **not** update Company Defaults / DNA | Retain only / feed defaults later / ignore | **Open** |
| 5 | Should deterministic missing-scope warnings appear before AI results? | **Yes** — deterministic first | Deterministic first / interleaved / AI only | **Open** |
| 6 | Should analysis rerun automatically after Project Brief changes? | **No** — require explicit trigger (cost + control) | Auto / prompt user / manual only | **Open** |
| 7 | Should analysis rerun automatically after new Site Notes? | **No** — keep explicit Analyse Notes (current pattern) | Auto / manual | **Open** |
| 8 | Should the user explicitly trigger analysis to control API cost? | **Yes** | Explicit only / auto on idle / hybrid | **Open** |
| 9 | What scope categories should be supported first? | **Deck, bathroom, commercial fitout** samples + existing org-enabled WA types | Deck-only / outdoor set / all catalogue | **Open** |
| 10 | How should exclusions be represented? | `POSSIBLE_EXCLUSION` suggestion + existing `excluded` WA status; not commercial optional lines | WA excluded / suggestion kind only / quote optional (FEAT-002) | **Open** |
| 11 | How should optional scope be represented? | **Defer commercial optional presentation** (FEAT-002); scope-level optional = `requirementLevel=optional` in catalogue + suggestion flag | Scope-optional / quote-optional / defer | **Open** |
| 12 | When should a suggestion become stale? | When source snapshot hash changes **or** related accepted/excluded WA set changes **or** newer run supersedes | Hash-only / time-based / manual | **Open** |
| 13 | What evidence should be shown to users? | Primary excerpts + rule id + related WA/fact labels; not raw prompts | Minimal / excerpts / full provenance | **Open** |
| 14 | What latency is acceptable? | Per budget doc: feedback ≤200 ms; complete p95 design ≤20 s | Stricter / looser | **Open** |
| 15 | What provider fallback behaviour is acceptable? | **Fail closed** with safe message after retries; no silent secondary provider in MVP | Fail closed / secondary provider / deterministic-only fallback | **Open** |
| 16 | Should analysis results persist across model/provider upgrades? | **Yes** — persist suggestions/runs with `promptContractVersion` + model; do not auto-rewrite history | Persist / ephemeral / regenerate on upgrade | **Open** |
| 17 | What data may be sent to the AI provider? | Brief + selected pending notes + allowed WA type list + **non-secret** existing WA types/titles + **non-PII** fact keys needed for context; **exclude** client phone/email unless owner approves | Minimal / include client fields / include all facts | **Open** |
| 18 | How should future photos/documents be included? | **Deferred** until D-S6: DB ownership/RLS **and** Storage bucket policies; then evidence types `PHOTO_REFERENCE` / `DOCUMENT_REFERENCE` | Defer / metadata-only first / full vision | **Open** |
| 19 | What requires a migration? | Durable `ScopeDiscoveryRun` + `ScopeDiscoverySuggestion` persistence if not fitting `note_proposals`; attachments (D-S6); optional evidence events (D-S4) | Code-only first / migrate early | **Open** |
| 20 | What should remain deferred until Builder Interview? | Expanded constraint taxonomy (FEAT-003); deep clarification interview flows; productivity-modifier interview coupling | List above / more / less | **Open** |

---

## Minimum gates before 3.1B.1 coding

Owner should decide at least: **1, 2, 3, 5, 8, 12, 17**.

---

## Explicit non-approvals (carry forward)

| Item | Status |
| --- | --- |
| Deferred schema proposals (3.1D D-S*) | **Not Approved** |
| Company DNA implementation | **Not started / forbidden** |
| Commercial formula changes | **Forbidden** |
| FEAT-001 collapsible cards | **Deferred** (design intersects 3.1B.6) |
| FEAT-002 optional quote items | **Deferred** |
| FEAT-003 constraint taxonomy | **Deferred** → Builder Interview |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_3_1B_SCOPE_DISCOVERY_OWNER_DECISIONS.md` |
| Created | 2026-08-05 |
| Approvals | None yet |

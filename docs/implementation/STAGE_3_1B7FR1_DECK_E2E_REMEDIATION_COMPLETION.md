# Stage 3.1B.7F-R1 — Deck E2E Remediation Completion

**Status:** Complete — Local, Preview Retest Pending  
**Date:** 2026-08-08  
**Final audit:** Complete (implementation audit before commit/deploy)  
**Verify:** `npx tsx scripts/verify-stage-3-1b7fr1-deck-e2e-remediation.ts`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR1_DECK_PREVIEW_RETEST.md`  

**Stage 3.1B Owner E2E:** Open (DEF-7E-003)  
**Stage 3.1B:** BLOCKED BY PREVIEW DEFECTS  
**Production:** Disabled  
**Stage 3.2:** Not Started  
**Migration 030:** Not created  

---

## Summary

Owner Deck E2E defects from Stage 3.1B.7F were remediated and implementation-audited
locally without commercial formula changes, AI prompt changes, Fact-authority
changes, Production enablement, Stage 3.2 work, or migration 030.

This document is the full R1 report (defect → root cause → fix → files → tests →
residuals). Local automated green **does not** mark Deck E2E passed.

---

## Defect traceability

| # | Owner issue | Root cause | Fix | Status |
| --- | --- | --- | --- | --- |
| 1 | Manual Add scope item | Persistence cannot honestly represent user-origin scope (`run_id` required; origin `deterministic\|ai\|merged`; no `USER_ADDED`) | Honest **BLOCK** — no fake suggestion/WA/Fact; needs owner-approved 030 | **NOT FIXED (blocked)** |
| 2 | Scope Review count-only summary | Confirmed body showed counts without names | Named Included / Not required / Needs detail lists + `+N more`; Needs detail omitted when empty | **FIXED** |
| 3 | Hard include/exclude after confirm | Needed checklist reopen | **Edit scope** → existing batch checklist; local toggles; one `batchConfirmScopeItemsAction` | **FIXED** |
| 4 | False Scope Review stale after Scope Details | Historical DETAIL_ONLY facts + ordinary constraints in fingerprints; compare asymmetry | `normaliseSnapshotForStaleCompare` + constraint materiality filter; content-only revisions (no `updated_at`) | **FIXED** |
| 5 | Breakdown Pergola / External Stairs on Deck-only | `mapEstimate` seeded `STATIC_INCLUDED_WORK_AREAS` | Confirmed DB Work Areas only; orphans → Unallocated | **FIXED** |
| 6 | Description Add buried in disclosure | Editor under Review details → CollapsedQuotePreview | Compact editor on WA summary surface | **FIXED** |
| 7 | “N items need attention” unnamed | Category-count view model | Exact `attentionItems` + Review scroll | **FIXED** |
| 8 | Site Constraints missing (narrow / hand-carry) | Deterministic brief heuristics too narrow | Expanded `mapAccessConstraint` / carting / occupied / floor (no AI prompt) | **FIXED** (DEF-7E-006 local) |
| 9 | Whole page scrolls with sidebar | `body` document scroll + sidebar `sticky` | `body` `h-dvh overflow-hidden`; sidebar flex sibling | **FIXED** |
| 10 | Scope Review felt slow | `refreshResults` + `router.refresh` remount | Refresh-only after analyse/batch; remount only on WA create | **FIXED** (structural; no Preview SLO) |

---

## A — Description UX

**Owner issue:** Could see “Add description” as summary state but real actions
were hidden behind Review details → quote preview → editor.

**Root cause:** Progressive disclosure nesting from 7A–7C. Persistence intact
(`quote_description`, description-actions, migration 018).

**Fix:** `WorkAreaQuoteDescriptionEditor` `variant="compact"` on Estimate Review
WA summary. Immediate Add / Use suggested / Edit. Generation remains draft until
Save. User description authoritative.

**Files:** `components/work-areas/WorkAreaQuoteDescriptionEditor.tsx`,
`components/assistant/ScopeSummaryBlock.tsx`,
`lib/assistant/presentation/estimate-review-summary.ts`

**Tests:** 7F-R1 DESCRIPTION; 7C descriptionLabel “Not added” / preview.

**Residual:** Preview must confirm controls are discoverable without nested expands.

---

## B — False Scope Review stale

**Owner issue:** After Confirm scope → Specification → Scope Details answers,
Scope Review demanded Analyse again.

**Root cause:**

1. Prior run snapshots could store DETAIL_ONLY `factRevisions`; current collector
   already filtered them → fingerprint mismatch.
2. Ordinary Site Constraints always fingerprinted.

**Fix:**

- Collector: facts via `isFactMaterialForDiscoveryStale`; constraints via
  `isConstraintMaterialForDiscoveryStale` (ordinary templates non-material).
- `normaliseSnapshotForStaleCompare` strips non-material keys from **both**
  prior and current before compare.
- Brief / WA revisions remain content-only (no `updated_at` / stage metadata).

**Semantics:**

| Class | Result |
| --- | --- |
| DETAIL_ONLY | CURRENT |
| SCOPE_SUPPORTING | CURRENT |
| SCOPE_ADDING / EXCLUDING | CURRENT + recommendation |
| FULL_REANALYSIS / material brief / WA set | STALE |

**Files:** `lib/scope-discovery/orchestration/stale-analysis.ts`,
`lib/scope-discovery/scope-impact.ts`,
`lib/scope-discovery/application/source-collector.ts`

**Tests:** 7F-R1 FALSE STALE; 6R2 DETAIL_ONLY→CURRENT / FULL_REANALYSIS→STALE;
6R3 / 6R3.1.

**Residual:** Preview Deck loop still required. Ordinary constraints currently
never enter fingerprints (intentional for R1 false-stale prevention).

---

## C — False Work Areas in estimate breakdown

**Owner issue:** Deck-only project breakdown showed Deck + Pergola + External Stairs.

**Root cause:** `mapEstimate` spread `buildStaticEstimate` →
`STATIC_INCLUDED_WORK_AREAS`.

**Fix:** Override `includedWorkAreas` from confirmed DB Work Areas.
`presentEstimateWorkAreaTotals` / modal grouping map orphan line names to
**Unallocated**. Line money retained; totals unchanged.

**Files:** `lib/assistant/mappers.ts`,
`lib/estimate/presentation-breakdown.ts`,
`components/assistant/EstimateBreakdownModal.tsx`

**Tests:** 7F-R1 BREAKDOWN.

**Residual:** Static seed remains for mocks only.

---

## D — Scope Review confirmed summary

**Owner issue:** Counts without item names.

**Fix:** `ScopeReviewConfirmedSummaryLists` from `buildScopeItemSummaryLists`
(same composer as collapsed counts). Compact overflow `+N more`. Needs detail
hidden when empty. **Edit scope** remains the path to change state.

**Files:** `lib/assistant/stage-completion-summaries.ts`,
`components/assistant/StageCollapsedSummaries.tsx`,
`components/assistant/ScopeDiscoveryReviewBlock.tsx`

**Tests:** 7F-R1 SCOPE SUMMARY.

---

## E — Fast Edit scope

**Fix:** Existing checklist via `isEditingScope`. Instant local toggles; one batch
save; no provider / WA / Fact creation; append-only decisions.

**Files:** `ScopeDiscoveryReviewBlock.tsx` (behaviour already present; summary UX
wired to Edit).

**Tests:** 7F-R1 EDIT SCOPE; 6R2 batch.

---

## F — Manual Add scope item — BLOCKED

**Cannot implement honestly without migration 030.**

| Contract | Reality |
| --- | --- |
| `scope_discovery_suggestions` | Requires `run_id`; `original_status` always `PROPOSED` |
| Origin | `"deterministic" \| "ai" \| "merged"` only |
| Decisions | ACCEPT / REJECT / MODIFY only |

**Minimum additive design (owner decision):** migration 030 with truthful
user/manual provenance under a parent Work Area, RLS parity, no catalogue
mutation. Not shipped in R1.

**Tests:** 7F-R1 MANUAL SCOPE gate.

---

## G — Quick Estimate attention

**Fix:** `buildQuickEstimateAttentionItems` — count === list length; named rows;
Review scrolls to stage. Zero → Ready for pricing.

**Files:** `lib/assistant/presentation/quick-estimate-view-model.ts`,
`components/assistant/EstimatePanel.tsx`,
`components/assistant/AssistantShell.tsx`

**Tests:** 7F-R1 ATTENTION; 7G status presentation.

**Residual:** Some clarification paths may surface as one presentation string.

---

## H — Site Constraints / enrich-extraction.ts

**Why changed (required for R1 / DEF-7E-006):** Deterministic
`extractConstraintsFromBrief` missed Deck owner phrases.

**What it now handles (phrase → existing template keys only):**

| Signal | Key | Value |
| --- | --- | --- |
| narrow / restricted / difficult access | `site_access` | Difficult |
| hand-carried / waste|materials carry 25–30 m | `material_carry_distance` | 10–30m band |
| occupied site phrases | `occupied_site` | Yes |
| upper floor / upstairs | `floor_level` | Upper floor |

**Separation:** Heuristics remain in enrich-extraction deterministic path — **no
AI prompt change**. Unknown stays unknown when no phrase matches.

**Audit correction:** Removed bare `approximately N–M m` pattern that could
fabricate carry distance from deck dimensions.

**Not in R1 taxonomy (Stage 3.2):** airport/security, generic noise, limited
storage as first-class keys.

**Files:** `lib/ai/enrich-extraction.ts`

**Tests:** 7F-R1 CONSTRAINTS (+ non-fabrication of bare dimensions); 6R3 sample.

---

## I — Shell scroll

**Root cause:** Document-level body scroll + sticky sidebar made nav appear to
scroll with content.

**Fix:** `body` `h-dvh overflow-hidden` (print unlocks); sidebar loses
`sticky top-0` and remains AppShell flex sibling; centre `PageContainer`
overflow-auto remains scrollport; sticky Quick Estimate CSS unchanged.

**Files:** `app/layout.tsx`, `components/app-sidebar.tsx`

**Tests:** 7F-R1 SCROLL. Preview: 1440/1280/1024/768/390.

---

## J — Scope Review performance

**What R1 actually improved:** Avoided duplicate full Assistant remount after
analyse / batch confirm / Apply / Keep (`refreshResults` only). WA create still
`router.refresh`. Toggles remain local.

**Not claimed:** Provider latency SLO, Analyse Job duration reduction.

**Files:** `components/assistant/ScopeDiscoveryReviewBlock.tsx`

**Tests:** 7F-R1 PERFORMANCE source checks. Live medians → Preview retest /
performance results doc.

---

## High-blast-radius file decisions (final audit)

| File | Stay? | Reason |
| --- | --- | --- |
| `app/layout.tsx` | Stay | Scroll fix |
| `components/app-sidebar.tsx` | Stay | Scroll fix |
| `lib/ai/enrich-extraction.ts` | Stay (tightened) | R1 constraint phrases; removed over-broad approx regex |
| `lib/assistant/mappers.ts` | Stay | Breakdown WA authority |
| `lib/estimate/presentation-breakdown.ts` | Stay | Unallocated orphans |
| `lib/scope-discovery/.../source-collector.ts` | Stay | Constraint filter |
| `lib/scope-discovery/.../stale-analysis.ts` | Stay | Normalise compare |
| `lib/scope-discovery/scope-impact.ts` | Stay | Constraint materiality |
| `supabase/config.toml` | **Do not commit** | Unrelated local config |

---

## UX architecture preserved (7A–7G)

Progressive disclosure, compact completed stages, sticky desktop Quick Estimate,
commercial-first rail, Estimate Review summary-first, Work Area context,
accessibility patterns retained. R1 does not force-expand all stages.

---

## Verification

```bash
npx tsx scripts/verify-stage-3-1b7fr1-deck-e2e-remediation.ts
npx tsx scripts/verify-stage-3-1b6r2-batch-scope-confirmation.ts
npx tsx scripts/verify-stage-3-1b6r3-workflow-coherence.ts
npx tsx scripts/verify-stage-3-1b6r31-scope-impact-recommendations.ts
# … 7A–7G, 3.1A, 3.1A-R1, 3.1D, RLS, 2B.10
npx tsc --noEmit
npm run lint
npm run build
```

---

## Residual limitations / Preview-only

1. Manual Add scope — blocked pending 030  
2. Owner Deck / Bathroom / Fitout E2E not closed  
3. Live stale loop / breakdown / description / scroll / constraints must be
   retested on Preview  
4. Performance timings are observational only  
5. Do **not** mark DEF-7E-003 closed or Stage 3.1B complete from local tests  

---

## Migration status

**No migration 030.**

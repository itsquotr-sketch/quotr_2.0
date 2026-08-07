# Stage 3.1B.7F-R1 — Deck Preview Retest

**Status:** Pending Preview  
**Prerequisite:** Local 7F-R1 audit complete; `verify-stage-3-1b7fr1-deck-e2e-remediation.ts` PASS  
**Owner E2E pack:** `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`  
**Completion:** `docs/implementation/STAGE_3_1B7FR1_DECK_E2E_REMEDIATION_COMPLETION.md`  

Use a **Deck-only** project on Preview. Do not enable Production.  
Local automated green does **not** mark this retest PASS.

Capture results in `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md`.

---

## 1. Manual scope item (expect BLOCKED)

| Step | Expect |
| --- | --- |
| Look for + Add scope item under confirmed WA | **Absent** — honest R1 block |
| Do not invent a suggestion / WA / Fact | Confirmed |
| Existing items | Can still Include ↔ Not required via Edit scope |

## 2. Scope Review summary clarity

| Step | Expect |
| --- | --- |
| After Confirm scope | Named Included / Not required lists visible |
| Needs detail | Shown only when real pending/routed items exist |
| Overflow | `+N more` when >3 in a category |
| When everything resolved | Compact counts / lists; no phantom “need detail” |
| Path to change | **Edit scope** opens checklist |

## 3. Include / exclude editing

| Step | Expect |
| --- | --- |
| Edit scope | Checklist with current checks restored |
| Toggle Included ↔ Not required | Instant local |
| Confirm / Save once | Persists; reversible later |
| No Analyse / no new WA / no Fact | Confirmed |

## 4. False stale (CRITICAL)

| Step | Expect |
| --- | --- |
| Confirm WA → Scope Review → Confirm scope | Confirmed |
| Specification | Scope Review stays **current** |
| Scope Details dimensions / finish / fascia / ordinary detail | **CURRENT** — no Analyse again |
| Ordinary Site Constraints edit | **CURRENT** |
| Scope-signal mismatch (e.g. balustrade) | Recommendation Apply/Keep — not full stale |
| Apply / Keep | Returns to current |
| Material brief change or add high-level WA | **STALE** + Analyse again |

## 5. Estimate breakdown Work Areas

| Step | Expect |
| --- | --- |
| Deck-only project → full breakdown | **Deck** (+ Unallocated if orphan lines) |
| Pergola / External Stairs headings | **Absent** unless those WAs are confirmed |
| Stairs / demo as scope under Deck | Remains Deck scope — not a WA heading |
| Totals | Unchanged vs commercial authority |

## 6. Work Area quote descriptions

| Step | Expect |
| --- | --- |
| Estimate Review WA summary (no Review details) | Description Not added **or** preview |
| Immediate actions | Add description / Use suggested / Edit |
| Use suggested | Draft in editor; **not** saved until Save |
| Save + refresh | Persists; Edit still immediate |
| Nested Review details → preview → Edit | **Not** required for primary actions |

## 7. Quick Estimate attention

| Step | Expect |
| --- | --- |
| Outstanding details | `N items need attention` + named rows |
| Review | Scrolls/opens relevant stage |
| Zero items | Ready for pricing |
| No raw IDs | Confirmed |

## 8. Project Capture → Site Constraints

Brief / notes phrases:

- “Narrow side access.”
- “Waste/materials must be hand-carried approximately 25–30 m.”

Optional positive checks: occupied site; upper floor.  
Negative: bare “approximately 5–6 m long” must **not** invent carry distance.  
Unknown (airport/security as taxonomy): remains unanswered / Stage 3.2.

| Expect |
| --- |
| Site access ≈ Difficult |
| Material carry ≈ 10–30m |
| No duplicate rows for same key |
| User edit wins |

## 9. Shell scroll

| Viewport | Expect |
| --- | --- |
| 1440 / 1280 / 1024 | Sidebar stable; centre content scrolls; sticky Quick Estimate OK |
| 768 / 390 | Mobile natural scroll; no broken fixed shell |
| Modals | Overlay/scroll still correct |

## 10. Performance (observe only)

Record approximate durations — do not invent SLOs:

| Action | Duration | Notes |
| --- | --- | --- |
| Automatic Scope Review (post WA) | | One run; no duplicate provider |
| Edit scope open | | Instant |
| Checklist toggle | | Instant / local |
| Confirm scope | | Refresh without full remount feel |
| Ordinary Scope Details save | | **No** paid reanalysis |

---

## Sign-off

| Field | Value |
| --- | --- |
| Preview URL | |
| Commit | |
| Tester | |
| Result | PASS / FAIL / PARTIAL |
| DEF-7F / DEF-7E IDs remaining | |
| Production | Remains Disabled |

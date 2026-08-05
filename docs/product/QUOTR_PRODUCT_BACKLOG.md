# Quotr Product Backlog

**Status:** Active  
**Created:** 2026-08-05  
**Governing stage:** Stage 3.1A — Product Stabilisation, Workflow Reliability and UX Baseline  
**Constraint:** Items marked Deferred must not be implemented until authorised  

---

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Confirmed | Owner-reported / code-proven; ready for planning or fix |
| In Progress | Actively being fixed in the current batch |
| Blocked | Cannot proceed without an external decision or dependency |
| Ready | Scoped and ready to start |
| Complete | Verification passed (automated + required manual checks) |
| Complete — Local | Automated verification passed; Preview/manual smoke still pending |
| Deferred | Recorded intentionally; do not build in the current batch |

---

## Backlog items

| ID | Title | Type | Priority | Customer impact | Current behaviour | Desired behaviour | Target stage/release | Dependencies | Status | Verification requirement | Future-learning relevance | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | Substructure answer incorrectly reported as missing | Bug | P0 | Deck work areas show “Substructure condition” missing after a valid answer; blocks confidence in readiness | Saved select values such as `unknown` are treated as not-sure; missing badge persists; fact chip may hide | Valid saved answers (including deliberate `none` / listed options) satisfy the requirement; assistant/work-area state refreshes after save; consistent across UI, facts, readiness, refresh | Stage 3.1A | Answer persistence (BUG-002); enum presentation (UX-001); `none` option (UX-002) | Complete — Local | Automated: required/optional/`none`/refresh/change-answer checks; Preview: answer substructure, confirm missing clears | Deliberate answers vs unanswered must remain distinct for Company DNA evidence | Do not special-case one project record |
| BUG-002 | Work-area answers save slowly or fail intermittently | Bug / Performance | P0 | Edits feel slow; some saves appear to succeed then revert or fail silently | Autosave can send nulls (Zod reject); `lastSavedRef` set before success; heavy sequential writes + double derived facts + broad revalidate + full refresh | Reliable persist; Saving/Saved/Error visible; latest-write-wins; no duplicate mutations; targeted revalidation; no silent discard | Stage 3.1A | BUG-001 evaluation rules | Complete — Local | Automated: race/latest-write, failed-save status, validation, ownership; measure before/after where practical; Preview: rapid edits | Answer corrections are learning evidence later — must persist reliably | No commercial formula changes |
| BUG-003 | Specification level cannot be edited | Bug | P0 | Quick Estimate “Edit” for spec level appears broken | Edit sets editing flag but Quality card stays collapsed so editors never render | Spec level displays, edits, persists, marks estimate stale per existing rule; survives refresh | Stage 3.1A | Quality card expand behaviour | Complete — Local | Automated: persist/load/invalid/ownership; Preview: edit each level, refresh | Spec level is structured commercial input for future DNA | Do not change estimate formulas beyond existing stale reaction |
| BUG-004 | Client name and address cannot be added later | Bug | P0 | Pricing shows “—” for client/site even after user intends to add details | Pricing document snapshots client fields at create; UI is read-only; `updatePricingDocument` cannot persist client fields; project edit does not update document snapshot shown | Project client details authoritative before quote snapshot; pricing can edit/sync them; draft pricing reflects updates; historical quotes retain snapshot | Stage 3.1A | Project update ownership; quote snapshot immutability | Complete — Local | Automated: propagation + no quote rewrite; Preview: create without client, add later, confirm pricing + historical quote | Clear client-detail lifecycle for learning/CRM later | Document source-of-truth decision in completion report |
| UX-001 | Human-readable answer formatting | UX | P1 | Users see raw enums (`good_condition`, `good_existing`) | Chips show stored snake_case; friendly labels incomplete | Display human labels; persist canonical enums; safe presentation helper | Stage 3.1A | ENUM label map; question chips | Complete — Local | Automated: presentation helper cases; Preview: no raw underscores in chips | Presentation must not mutate stored evidence values | Preserve acronyms / domain labels |
| UX-002 | Add “None” for substructure condition | UX | P1 | No valid N/A for new decks without existing substructure | Options: good_existing / partial / full / unknown only | Canonical `none` option; counts as answered; distinct from unanswered and unknown condition | Stage 3.1A | BUG-001 not-sure semantics; deck calculator | Complete — Local | Automated: `none` satisfies requirement; Preview: select None | Structured none vs missing vs unknown for DNA | Do not use empty/null for deliberate None |
| UX-003 | Login page spacing | UX | P1 | Password and submit feel cramped | Form wraps CardContent/Footer so card gap does not separate them | Small spacing fix only | Stage 3.1A | Card composition | Complete — Local | Preview: desktop/mobile login | None | No auth redesign |
| UX-004 | Rates-page spacing | UX | P1 | Inconsistent card/form/button spacing | Same form-wrap pattern on company defaults; minor alignment issues | Correct obvious spacing/alignment; keep design language | Stage 3.1A | Rates layout | Complete — Local | Preview: desktop + narrow rates | None | No rate calculation changes |
| UX-005 | Improve Project Capture card | UX | P1 | Brief vs site notes unclear / visually messy | Single mixed card; overlapping purpose copy | Separate Project Brief and Site Notes visually/semantically; preserve data and AI inputs | Stage 3.1A | ProjectCaptureBlock; SiteNotesCaptureCard | Complete — Local | Automated: brief/notes remain distinct fields; Preview: AI still receives both | Separate brief vs notes structure supports future evidence taxonomy | No new upload system |
| FEAT-001 | Collapsible work-area cards | Feature | P2 | Dense Scope Review hard to scan on large jobs | Work-area cards always expanded in detail | Collapse/expand per card; consider Expand all / Collapse all; Summary vs Detailed | Upcoming assistant UX or Intelligent Scope Discovery | Assistant Scope Review layout | Deferred | Design + Preview interaction tests | Supports denser scope discovery UX | Do not build in 3.1A |
| FEAT-002 | Optional quote items | Feature | P2 | Optional lines cannot be presented correctly under base total | Optional flag exists; commercial presentation of optional totals not productised | Optional section below base subtotal/GST/total; base excludes unselected optionals; own ex/incl GST; future included/optional/alt/excluded model | Future commercial release (post Stage 2B) | Commercial engine goldens; quote presentation | Deferred | Golden scenarios + regression before ship | Commercial learning must not invent optional arithmetic | Separate design — do not patch totals informally |
| FEAT-003 | Additional site constraints | Feature | P2 | Limited structured constraint taxonomy | Current constraint templates only | Expand structured site constraints aligned with Builder Interview, scope discovery, productivity modifiers, Company DNA | Stage 3 planning (Builder Interview / DNA prep) | Constraint taxonomy design | Deferred | Taxonomy design review before implementation | Direct DNA / interview evidence path | No arbitrary unconstrained list |

---

## Batch notes (Stage 3.1A)

- Implement: BUG-001–004, UX-001–005.
- Document only: FEAT-001–003.
- Do not begin Intelligent Scope Discovery, Company DNA, or commercial formula changes.
- Do not mark Complete until Preview verification passes; local automated-pass status is **Complete — Local**.

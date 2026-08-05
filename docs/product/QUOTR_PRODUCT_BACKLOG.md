# Quotr Product Backlog

**Status:** Active  
**Created:** 2026-08-05  
**Governing stage:** Stage 3.1A **Complete**; Stage 3.1D **Complete**; Stage 3.1B **In Progress** (3.1B.1 Complete — Local; 3.1B.2 Ready)  
**Preview sign-off:** 2026-08-05 — `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`  
**3.1B plan:** `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`  
**Constraint:** Items marked Deferred must not be implemented until authorised; deferred schema proposals remain **Not Approved**; migrations Not Approved; AI provider / UI integration Not Started  


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
| BUG-001 | Substructure answer incorrectly reported as missing | Bug | P0 | Deck work areas show “Substructure condition” missing after a valid answer; blocks confidence in readiness | Saved select values such as `unknown` are treated as not-sure; missing badge persists; fact chip may hide | Valid saved answers (including deliberate `none` / listed options) satisfy the requirement; assistant/work-area state refreshes after save; consistent across UI, facts, readiness, refresh | Stage 3.1A | Answer persistence (BUG-002); enum presentation (UX-001); `none` option (UX-002) | Complete | Automated: required/optional/`none`/refresh/change-answer checks; Preview: answer substructure, confirm missing clears | Deliberate answers vs unanswered must remain distinct for Company DNA evidence | Do not special-case one project record |
| BUG-002 | Work-area answers save slowly or fail intermittently | Bug / Performance | P0 | Edits feel slow; some saves appear to succeed then revert or fail silently | Autosave can send nulls (Zod reject); `lastSavedRef` set before success; heavy sequential writes + double derived facts + broad revalidate + full refresh | Reliable persist; Saving/Saved/Error visible; latest-write-wins; no duplicate mutations; targeted revalidation; no silent discard | Stage 3.1A / R1-002 | BUG-001 evaluation rules | Complete | Automated: race/latest-write, failed-save status, validation, ownership; measure before/after where practical; Preview: rapid edits | Answer corrections are learning evidence later — must persist reliably | No commercial formula changes |
| BUG-003 | Specification level cannot be edited | Bug | P0 | Quick Estimate “Edit” for spec level appears broken | Edit sets editing flag but Quality card stays collapsed so editors never render | Spec level displays, edits, persists, marks estimate stale per existing rule; survives refresh | Stage 3.1A / R1-003 | Quality card expand behaviour | Complete | Automated: persist/load/invalid/ownership; Preview: edit each level, refresh | Spec level is structured commercial input for future DNA | Do not change estimate formulas beyond existing stale reaction |
| BUG-004 | Client name and address cannot be added later | Bug | P0 | Pricing shows “—” for client/site even after user intends to add details | Pricing document snapshots client fields at create; UI is read-only; `updatePricingDocument` cannot persist client fields; project edit does not update document snapshot shown | Project client details authoritative before quote snapshot; pricing can edit/sync them; draft pricing reflects updates; historical quotes retain snapshot | Stage 3.1A / R1-004 | Project update ownership; quote snapshot immutability | Complete | Automated: propagation + no quote rewrite; Preview: create without client, add later, confirm pricing + historical quote | Clear client-detail lifecycle for learning/CRM later | Document source-of-truth decision in completion report |
| UX-001 | Human-readable answer formatting | UX | P1 | Users see raw enums (`good_condition`, `good_existing`) | Chips show stored snake_case; friendly labels incomplete | Display human labels; persist canonical enums; safe presentation helper | Stage 3.1A / R1-001 | ENUM label map; question chips | Complete | Automated: presentation helper cases; Preview: no raw underscores in chips | Presentation must not mutate stored evidence values | Preserve acronyms / domain labels |
| UX-002 | Add “None” for substructure condition | UX | P1 | No valid N/A for new decks without existing substructure | Options: good_existing / partial / full / unknown only | Canonical `none` option; counts as answered; distinct from unanswered and unknown condition | Stage 3.1A | BUG-001 not-sure semantics; deck calculator | Complete | Automated: `none` satisfies requirement; Preview: select None | Structured none vs missing vs unknown for DNA | Do not use empty/null for deliberate None |
| UX-003 | Login page spacing | UX | P1 | Password and submit feel cramped | Form wraps CardContent/Footer so card gap does not separate them | Small spacing fix only | Stage 3.1A | Card composition | Complete | Preview: desktop/mobile login | None | No auth redesign |
| UX-004 | Rates-page spacing | UX | P1 | Inconsistent card/form/button spacing | Same form-wrap pattern on company defaults; minor alignment issues | Correct obvious spacing/alignment; keep design language | Stage 3.1A | Rates layout | Complete | Preview: desktop + narrow rates | None | No rate calculation changes |
| UX-005 | Improve Project Capture card | UX | P1 | Brief vs site notes unclear / visually messy | Single mixed card; overlapping purpose copy | Separate Project Brief and Site Notes visually/semantically; preserve data and AI inputs | Stage 3.1A / R1-005 | ProjectCaptureBlock; SiteNotesCaptureCard | Complete | Automated: brief/notes remain distinct fields; Preview: AI still receives both | Separate brief vs notes structure supports future evidence taxonomy | No new upload system |
| R1-001 | Raw enum values still display | Bug | P0 | Underscored enums visible in assistant UI after Preview | Some paths formatted chips only; summaries/constraints/arrays still raw | All visible paths use presentation formatter; storage unchanged | Stage 3.1A-R1 | UX-001 | Complete | `verify-stage-3-1a-r1-preview-remediation.ts` | Presentation must not mutate evidence | |
| R1-002 | Delayed final answer after save | Bug | P0 | Rapid edits save but UI briefly reverts / delays | ScopeSummaryBlock remount key wiped optimistic state | Local overlay + no remount; latest-write contract | Stage 3.1A-R1 | BUG-002 | Complete | Rapid A→B→C + stale response tests | | |
| R1-003 | Quick Estimate Spec Edit broken | Bug | P0 | Estimate panel Edit does not open Quality editor | Edit flag without scroll/expand path reliability | Shared `beginQualitySpecEdit` + forceExpand + scroll | Stage 3.1A-R1 | BUG-003 | Complete | Static contract both entry points share flow | | |
| R1-004 | Project client details do not reach Pricing | Bug | P0 | Pricing shows stale client after project edit | updateProject did not sync pricing; uncontrolled inputs | Project→draft pricing sync; controlled fields; quotes untouched | Stage 3.1A-R1 | BUG-004 | Complete | Propagation + dirty overlay checks | | |
| R1-005 | Project Capture hierarchy weak | UX | P1 | Brief vs notes still hard to distinguish | Shared headings / footer copy | Two distinct panels + purpose copy; no data change | Stage 3.1A-R1 | UX-005 | Complete | Capture layout static checks | | |
| FEAT-001 | Collapsible work-area cards | Feature | P2 | Dense Scope Review / future suggestion lists hard to scan | Work-area cards always expanded in detail | Collapse/expand per card; consider Expand all / Collapse all; Summary vs Detailed | Stage 3.1B.6 (UI) or later assistant UX | Assistant Scope Review + ISD suggestion list density | Deferred | Design + Preview interaction tests | Supports denser scope discovery UX | Intersects ISD UI; do not implement in 3.1B.0 |
| FEAT-002 | Optional quote items | Feature | P2 | Optional lines cannot be presented correctly under base total | Optional flag exists; commercial presentation of optional totals not productised | Optional section below base subtotal/GST/total; base excludes unselected optionals; own ex/incl GST; future included/optional/alt/excluded model | Future commercial release (post Stage 2B) | Commercial engine goldens; quote presentation | Deferred | Golden scenarios + regression before ship | Commercial learning must not invent optional arithmetic | Separate from ISD scope-optional catalogue flags |
| FEAT-003 | Additional site constraints | Feature | P2 | Limited structured constraint taxonomy | Current constraint templates only | Expand structured site constraints aligned with Builder Interview, scope discovery, productivity modifiers, Company DNA | Stage 3.2 Builder Interview | Constraint taxonomy design | Deferred | Taxonomy design review before implementation | Direct DNA / interview evidence path | Defer expanded taxonomy until Builder Interview; ISD may only reference existing constraint keys |
| ISD-001 | Scope suggestion lifecycle | Feature | P0 | No canonical propose→decide→apply contract across Analyse Job vs notes | Suggested WAs written immediately on Analyse Job; notes use `note_proposals` | Canonical `ScopeDiscoverySuggestion` statuses/transitions; AI proposes; user decides | Stage 3.1B.1 / 3.1B.5 | Boundary + suggestion contract; Fact SoT | Complete — Local (contract/lifecycle only; no production adoption) | `verify-stage-3-1b1-suggestion-contract.ts` | Rejection/modification provenance for Evidence Engine | Production accept/reject wiring remains 3.1B.5 |
| ISD-002 | Missing-scope detection | Feature | P0 | Omissions only via question templates; no relationship-driven warnings | Missing details questions after constraints; no parent→child catalogue | Deterministic catalogue checks + AI contextual merge; never auto-accept | Stage 3.1B.2 / 3.1B.7 | Scope relationship catalogue | Ready | Fixture edges + merge tests | Structured omission evidence for DNA later | Deterministic must not be bypassed by AI |
| ISD-003 | Scope relationship catalogue | Feature | P1 | No data-driven deck/bathroom/fitout relationship model | Ad hoc enrichment + templates | Versioned catalogue edges (required/likely/conditional) with trigger/suppress facts | Stage 3.1B.2 | Domain model 3.1D | Ready | Sample catalogue evaluation tests | Assembly link reserved for 3.3 | Code modules first; no money formulas |
| ISD-004 | AI discovery provider | Feature | P0 | Brief/notes extraction not governed as ISD contract | Anthropic extractFromBrief / extractFromSiteNotes | Structured discovery output, evidence refs, validation, prompt/contract versioning | Stage 3.1B.3 | Owner gate on provider data | Ready | Schema validation tests; no silent domain writes | Model metadata for audit | Do not change current Analyse Job prompts in planning batch |
| ISD-005 | Evidence display | Feature | P1 | Users see little provenance for why a scope was suggested | Confidence labels; limited evidence | Show evidence band + excerpts/rule ids per contract | Stage 3.1B.6 | Suggestion contract evidence model | Ready | Preview: evidence visible; no commercial certainty language | Evidence Engine substrate | |
| ISD-006 | Discovery rerun / idempotency | Feature | P0 | Analyse Job one-shot; no stale/supersede; duplicate risk on notes | Brief locked; note analyse blocked while pending | ScopeDiscoveryRun idempotency; stale/supersede; no duplicate provider calls | Stage 3.1B.4 | Owner gates on auto-rerun | Ready | Same snapshot → reuse run | Run history for learning later | Explicit user trigger recommended |
| ISD-007 | Discovery latency / progress | Performance | P1 | Only basic Analysing state; no budgets | Unmeasured provider wait | Progress states + latency/cost budgets; cancellation where practical | Stage 3.1B.8 | Latency budget doc | Ready | Measure vs budget in Preview | — | Do not claim SLOs until measured |
| ISD-008 | Attachment security design | Security | P1 | Photos/documents missing; future media is high-risk | No project attachments | Design DB ownership/RLS **and** Storage bucket policies before media ISD | Pre-media / D-S6 | Deferred schema D-S6 | Deferred | Design review + RLS/storage checklist | Visual evidence for DNA | Architecture-review: both DB and bucket policies required |

---

## Batch notes (Stage 3.1A)

- Implemented and Preview-signed: BUG-001–004, UX-001–005, R1-001–R1-005.
- Stage 3.1A **Complete**; Stage 3.1D **Complete** — see `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md` (2026-08-05).

## Batch notes (Stage 3.1B)

- Stage 3.1B status: **In Progress**.
- Stage 3.1B.0 Planning docs: Complete.
- Stage 3.1B.1 suggestion contract: **Complete — Local** — `lib/scope-discovery/*`; no production adoption.
- Stage 3.1B.2 catalogue: **Ready** — do not start until authorised in the next batch.
- Migrations **Not Approved**; AI provider **Not Started**; UI **Not Started**.
- FEAT-001 Deferred (intersects 3.1B.6); FEAT-002 Deferred; FEAT-003 Deferred until Builder Interview.
- Do not change Analyse Job behaviour, AI prompts, commercial formulas, or Company DNA without explicit authorisation.

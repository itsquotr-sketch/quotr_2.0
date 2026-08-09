# Quotr Product Backlog

**Status:** Active  
**Created:** 2026-08-05  
**Governing stage:** Stage 3.1A **Complete**; Stage 3.1D **Complete**; Stage **3.1C Complete — Preview Validated** (2026-08-10); Stage **3.1B In Progress** — next active: Owner Preview E2E (Deck / Bathroom / Commercial Fitout); Production Scope Discovery **Disabled**; Stage 3.2 **Not Started**; Company DNA **Not Started**.
**Preview sign-off:** 2026-08-05 — `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`  
**3.1B plan:** `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`  
**Constraint:** Items marked Deferred must not be implemented until authorised; migrations 028/029 **Applied and Verified**; server integration **Complete — Local**; Scope Discovery UI **Complete — Local, Preview Test Pending**; Preview feature **Enabled only by owner configuration**; production feature **Disabled**; feature flag **Implemented** (`SCOPE_DISCOVERY_ENABLED`, default off); Analyse Job **Preserved / Unchanged**  


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
| FEAT-001 | Collapsible work-area cards | Feature | P2 | Dense Scope Review / future suggestion lists hard to scan | Work-area cards always expanded in detail | Collapse/expand per card; consider Expand all / Collapse all; Summary vs Detailed | Stage 3.1B.6 (UI) or later assistant UX | Assistant Scope Review + ISD suggestion list density | Partial — Complete — Local (ISD groups + suggestion detail only); broader WA cards Deferred | Design + Preview interaction tests | Supports denser scope discovery UX | Broader estimate work-area collapse still deferred |
| FEAT-002 | Optional quote items | Feature | P2 | Optional lines cannot be presented correctly under base total | Optional flag exists; commercial presentation of optional totals not productised | Optional section below base subtotal/GST/total; base excludes unselected optionals; own ex/incl GST; future included/optional/alt/excluded model | Future commercial release (post Stage 2B) | Commercial engine goldens; quote presentation | Deferred | Golden scenarios + regression before ship | Commercial learning must not invent optional arithmetic | Separate from ISD scope-optional catalogue flags |
| FEAT-003 | Additional site constraints | Feature | P2 | Limited structured constraint taxonomy | Current constraint templates only | Expand structured site constraints aligned with Builder Interview, scope discovery, productivity modifiers, Company DNA | Stage 3.2 Builder Interview | Constraint taxonomy design | Deferred | Taxonomy design review before implementation | Direct DNA / interview evidence path | Defer expanded taxonomy until Builder Interview; ISD may only reference existing constraint keys |
| ISD-001 | Scope suggestion lifecycle | Feature | P0 | No canonical propose→decide→apply contract across Analyse Job vs notes | Suggested WAs written immediately on Analyse Job; notes use `note_proposals` | Canonical `ScopeDiscoverySuggestion` statuses/transitions; AI proposes; user decides | Stage 3.1B.1 / 3.1B.5A / 3.1B.5C / 3.1B.6 | Boundary + suggestion contract; Fact SoT | Complete — Local (contract + RPCs + server actions + Assistant UI); Preview Test Pending; production Disabled | `verify-stage-3-1b1` … `verify-stage-3-1b6-assistant-ui.ts`; completion docs | Rejection/modification provenance for Evidence Engine | Preview UI smoke owner-gated; production disabled |
| ISD-002 | Missing-scope detection | Feature | P0 | Omissions only via question templates; no relationship-driven warnings | Missing details questions after constraints; no parent→child catalogue | Deterministic catalogue checks + AI contextual merge; never auto-accept | Stage 3.1B.2 / 3.1B.7 | Scope relationship catalogue | Complete — Local (deterministic evaluator only; no production adoption) | `verify-stage-3-1b2-scope-relationship-catalogue.ts` | Structured omission evidence for DNA later | Production wiring remains later batches |
| ISD-003 | Scope relationship catalogue | Feature | P1 | No data-driven deck/bathroom/fitout relationship model | Ad hoc enrichment + templates | Versioned catalogue edges (required/likely/conditional) with trigger/suppress facts | Stage 3.1B.2 | Domain model 3.1D | Complete — Local (samples; production adoption Not Started) | Catalogue integrity + sample evaluation tests | Assembly link reserved for 3.3 | Code modules; no money formulas |
| ISD-004 | AI discovery provider | Feature | P0 | Brief/notes extraction not governed as ISD contract | Anthropic extractFromBrief / extractFromSiteNotes | Structured discovery output, evidence refs, validation, prompt/contract versioning | Stage 3.1B.3 | Owner gates OCD-ISD-06/07/14/15/16/17 | Complete — Local (adapter unused by production; Analyse Job unchanged) | `verify-stage-3-1b3-ai-discovery-provider.ts` | Model metadata for audit | Do not change current Analyse Job prompts |
| ISD-005 | Evidence display | Feature | P1 | Users see little provenance for why a scope was suggested | Confidence labels; limited evidence | Show evidence band + excerpts/rule ids per contract | Stage 3.1B.6 | Suggestion contract evidence model | Complete — Local, Preview Test Pending | `verify-stage-3-1b6-assistant-ui.ts`; Preview smoke | Evidence Engine substrate | Human-readable summaries only; no raw JSON |
| ISD-006 | Discovery rerun / idempotency | Feature | P0 | Analyse Job one-shot; no stale/supersede; duplicate risk on notes | Brief locked; note analyse blocked while pending | ScopeDiscoveryRun idempotency; stale/supersede; no duplicate provider calls | Stage 3.1B.4A / 3.1B.4B / 3.1B.5C | OCD-ISD-06/07/08; persistence owner approval | Complete — Local (orchestration + persistence + server run service); remote apply Applied and Verified | `verify-stage-3-1b4a-discovery-orchestration.ts`; `verify-stage-3-1b4b-persistence.ts`; `verify-stage-3-1b5c-gated-server-integration.ts` | Run history for learning later | Explicit user trigger; Analyse Job unchanged |
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
- Stage 3.1B.2 catalogue: **Complete — Local** — `lib/scope-discovery/catalogue/*`; production catalogue adoption **Not Started**.
- Stage 3.1B.3 AI provider: **Complete — Local** — `lib/scope-discovery/provider/*`; **Implemented but unused**; Analyse Job unchanged.
- Stage 3.1B.4A orchestration: **Complete — Local** — `lib/scope-discovery/orchestration/*`; persistence-free helpers remain.
- Stage 3.1B.4B-0 persistence gate: **Complete — Planning**.
- Stage 3.1B.4B persistence: **Complete — Local** — migration `028`; `lib/scope-discovery/persistence/*`; remote **Applied and Verified**; unused by Analyse Job.
- Stage 3.1B.5A decision lifecycle: **Complete — Local** — migration `029`; `lib/scope-discovery/decisions/*`; remote **Applied and Verified**; unused by UI/Analyse Job.
- Stage 3.1B.5B remote readiness + wiring design: **Complete — Planning** — runbook, wiring design, Preview rollout, approval register; remote apply **Applied and Verified**.
- Stage 3.1B.5C gated server integration: **Complete — Local** — server actions behind flag; production **Disabled**.
- Stage 3.1B.6 Assistant UI: **Complete — Local** — Scope Review discovery card; `verify-stage-3-1b6-assistant-ui.ts`; Preview smoke pending; production **Disabled**.
- Migrations: `028`/`029` **Applied and Verified**; feature flag **Implemented** (`SCOPE_DISCOVERY_ENABLED`, default off); Scope Discovery UI **Complete — Local, Preview Test Pending**; Analyse Job **Preserved**.
- FEAT-001 Partial (ISD groups/cards); broader WA collapse Deferred; FEAT-002 Deferred; FEAT-003 Deferred until Builder Interview.
- Stage 3.1B.6R3 workflow coherence: **Complete — Local** — Analyse Job progress, dimension derivation, Fact scope-impact, Estimate Review collapse, Quick Estimate scope drivers; `verify-stage-3-1b6r3-workflow-coherence.ts`; Preview retest pending; production **Disabled**.
- Stage 3.1B.6R3.1 scope-impact recommendations: **Complete — Local, Preview Retest Pending** — Scope Review Apply/Keep UI; durable keep via `scope_impact_kept` decisions; no migration 030; `verify-stage-3-1b6r31-scope-impact-recommendations.ts`; production **Disabled**.
- Stage 3.1B.7A progressive disclosure: **Complete — Local** — completed stages collapse to summaries; one active incomplete stage; `verify-stage-3-1b7a-progressive-disclosure.ts`; pure UX; production **Disabled**.
- Stage 3.1B.7B information hierarchy: **Complete — Local** — Fact-based WA dashboards, stepper counts, Quick Estimate hierarchy strip, denser cards; `verify-stage-3-1b7b-information-hierarchy.ts`; pure UX; production **Disabled**.
- Stage 3.1B.7C question / estimate presentation: **Complete — Local** — question category grouping, provenance/why-matters, constraint groups, Estimate Review summary-first, Quick Estimate confidence drivers + project health, breakdown structure; `verify-stage-3-1b7c-question-estimate-presentation.ts`; Preview retest pending; production **Disabled**.
- Stage 3.1B.7D final Assistant UX polish: **Complete — Local** — state inventory, loading/saving/error consistency, empty states, reduced-motion transitions, action language, Preview instrumentation + sign-off matrix; `verify-stage-3-1b7d-final-assistant-ux.ts`; Scope Discovery Preview sign-off **Pending Owner Test**; production **Disabled**.
- Stage 3.1B.7E Preview release hardening: **Complete — Local / BLOCKED BY PREVIEW DEFECTS** — Preview flag empty defect fixed (`SCOPE_DISCOVERY_ENABLED=true` on Preview branch); Production flag absent confirmed; defect register + enablement runbook; `verify-stage-3-1b7e-preview-release-hardening.ts`; Owner Deck/Bathroom/Fitout E2E **Pending** (DEF-7E-003); production **Disabled**.
- Stage 3.1B.7F Owner Preview E2E gate: **Complete — Local (pack prepared)** — `STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md` + `STAGE_3_1B7F_OWNER_E2E_RESULTS.md` + quality rubric + latency/provider/log/commercial capture; `verify-stage-3-1b7f-owner-e2e-gate.ts`; live owner results **Pending**; Stage 3.1B **not** marked complete; production **Disabled**.
- Stage 3.1B.7F-R1 Deck E2E remediation: **Complete — Local, Preview Retest Pending** — false stale normalise; breakdown WA authority; description compact surface; scope summary lists; attention items; constraint heuristics (DEF-7E-006); shell scroll; Scope Review remount trim; `verify-stage-3-1b7fr1-deck-e2e-remediation.ts`.
- Stage 3.1B.7F-R2 final Preview polish: **Complete — Local, Preview Retest Pending** — Scope Details semantics; manual scope items (migration 030); Pricing required stubs; QE attention WA path; generate/answer ack marks; testing banner removed; mobile compact header; `verify-stage-3-1b7fr2-final-preview-polish.ts`.
- Stage 3.1B.7F-R2.1 migration 030 remote: **Applied and Verified** on linked Preview `quotr_2.0` (`lxvnylhsbvudzzupxeqr`); history **001–030** aligned; Production Scope Discovery still **Disabled**; `STAGE_3_1B7FR21_REMOTE_030_APPLY_COMPLETION.md`.
- Stage 3.1B.7F-R2.2 manual scope ACL: **Applied and Verified Remote** — migration **031** revoke/regrant least privilege (auth SELECT/INSERT only); history **001–031**; `STAGE_3_1B7FR22_MANUAL_SCOPE_ACL_HARDENING_COMPLETION.md`; Deck Preview Retest **Ready**.
- Stage 3.1B.7F-R3 unified scope state: **Complete — Local, Final Deck Retest Pending** — `CurrentWorkAreaScopeState` composer; Fact-aware “To confirm in Scope Details”; QE included count includes manuals; unified Edit scope checklist; `verify-stage-3-1b7fr3-unified-scope-state.ts`; no migration 032.
- Stage 3.1B.7G Assistant density / sticky Quick Estimate: **Complete — Local** — commercial-first hierarchy, collapsible secondary sections, CSS sticky desktop rail, mobile compact summary view-model, centre one-line completed summaries; `verify-stage-3-1b7g-assistant-density-sticky-estimate.ts`; responsive architecture documented; 7F E2E pack updated; production **Disabled**.
- Assistant UX refinement programme: **Complete — Local** (7A–7D + 7G density). Broader Pricing/Quote UX: **Planned separately**.
- Stage 3.1B release status: **BLOCKED BY PREVIEW DEFECTS** (owner E2E DEF-7E-003 + Final Deck retest of 7F-R3).
- Scope Discovery Preview sign-off: **Pending Owner Test**.
- Do not change Analyse Job behaviour, commercial formulas, or Company DNA without explicit authorisation.
- Stage 3.1B.7 missing-scope — Deferred until Preview gate clears.
- Production: **Disabled**.
- Stage 3.2: **Not Started**.

## Batch notes (Stage 3.1C auth / setup) — CLOSED

- Stage **3.1C overall:** **Complete — Preview Validated** (2026-08-10) — `docs/implementation/STAGE_3_1C_CLOSURE.md`.
- Stage 3.1C.0–3.1C.2B: **Complete — Preview Validated**.
- Stage 3.1C.3 + R1 + R2A–R2E + R2E-R1 + R2E-R1.1: **Complete — Preview Validated**.
- Migrations **032** and **033**: Applied and Verified Remote.
- Deferred (not complete): email change; Company DNA; calibration→rate auto-apply; additional scenarios; Stage 3.2; Production Scope Discovery enablement.
- Stage 3.1B: **not** auto-closed by 3.1C — next active Owner Preview E2E (Deck / Bathroom / Fitout).
- Production Scope Discovery: **Disabled**. Stage 3.2: **Not Started**. Company DNA: **Not Started**.

# Quotr Product Backlog

**Classification:** SUPPORTING item register — not the development plan. **CANONICAL plan:** `docs/plans/QUOTR_DEVELOPMENT_MASTER_PLAN.md`.  
**Status:** Active  
**Created:** 2026-08-05  
**Governing plan:** `docs/plans/QUOTR_DEVELOPMENT_MASTER_PLAN.md`. **Governing stage:** Stage 3.1A **Complete**; Stage 3.1D **Complete**; Stage **3.1C Complete — Preview Validated**; Stage **3.1B Complete — Preview Validated** (2026-08-11; baseline `441f36c`); Production Scope Discovery **Disabled**; Stage **3.2.0 Complete Planning**; Stage **3.2.0-R1 Complete**; Stage **3.2.1 Complete**; Stage **3.2.2 In Owner Preview / R5 Complete Local**; Stage **3.2.3 Not Started / superseded in part by Foundation cleanup**; Stage 3.2 **not** globally Complete; Company DNA **Not Started**; **PERF-FUTURE-01 Planned**. **FOUNDATION-R1 Complete.** **FOUNDATION-R1-R1 Complete — Owner Preview Validated** (2026-08-16). **FOUNDATION-R2** treated as sufficiently validated via R2/R2-R1 remediation. **FOUNDATION-R2-R1** pricing remediation complete. **FOUNDATION-R2-R1-R1** contractor-rate precedence complete. **PHASE 0 COMPLETE / ARCHITECTURE FROZEN.** REQ-1 **COMPLETE / TECHNICALLY VALIDATED**. REQ-2 **COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED**. REQ-2.1 **COMPLETE / TECHNICALLY VALIDATED**. REQ-3 **READY / NOT STARTED**. REQ-4 **Not Started**.
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
| FEAT-003 | Additional site constraints | Feature | P2 | Limited structured constraint taxonomy | Current constraint templates only | Expand structured site constraints aligned with Builder Interview, scope discovery, productivity modifiers, Company DNA | Stage 3.2 Builder Interview | Constraint taxonomy design (3.2.0) | Deferred — taxonomy designed; implementation gated on owner D4 | Owner approve D4 + implement in 3.2.2+ | Direct DNA / interview evidence path | See `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md`; ISD may only reference existing keys until expansion ships |
| ISD-001 | Scope suggestion lifecycle | Feature | P0 | No canonical propose→decide→apply contract across Analyse Job vs notes | Suggested WAs written immediately on Analyse Job; notes use `note_proposals` | Canonical `ScopeDiscoverySuggestion` statuses/transitions; AI proposes; user decides | Stage 3.1B.1 / 3.1B.5A / 3.1B.5C / 3.1B.6 | Boundary + suggestion contract; Fact SoT | Complete — Local (contract + RPCs + server actions + Assistant UI); Preview Test Pending; production Disabled | `verify-stage-3-1b1` … `verify-stage-3-1b6-assistant-ui.ts`; completion docs | Rejection/modification provenance for Evidence Engine | Preview UI smoke owner-gated; production disabled |
| ISD-002 | Missing-scope detection | Feature | P0 | Omissions only via question templates; no relationship-driven warnings | Missing details questions after constraints; no parent→child catalogue | Deterministic catalogue checks + AI contextual merge; never auto-accept | Stage 3.1B.2 / 3.1B.7 | Scope relationship catalogue | Complete — Local (deterministic evaluator only; no production adoption) | `verify-stage-3-1b2-scope-relationship-catalogue.ts` | Structured omission evidence for DNA later | Production wiring remains later batches |
| ISD-003 | Scope relationship catalogue | Feature | P1 | No data-driven deck/bathroom/fitout relationship model | Ad hoc enrichment + templates | Versioned catalogue edges (required/likely/conditional) with trigger/suppress facts | Stage 3.1B.2 | Domain model 3.1D | Complete — Local (samples; production adoption Not Started) | Catalogue integrity + sample evaluation tests | Assembly link reserved for 3.3 | Code modules; no money formulas |
| ISD-004 | AI discovery provider | Feature | P0 | Brief/notes extraction not governed as ISD contract | Anthropic extractFromBrief / extractFromSiteNotes | Structured discovery output, evidence refs, validation, prompt/contract versioning | Stage 3.1B.3 | Owner gates OCD-ISD-06/07/14/15/16/17 | Complete — Local (adapter unused by production; Analyse Job unchanged) | `verify-stage-3-1b3-ai-discovery-provider.ts` | Model metadata for audit | Do not change current Analyse Job prompts |
| ISD-005 | Evidence display | Feature | P1 | Users see little provenance for why a scope was suggested | Confidence labels; limited evidence | Show evidence band + excerpts/rule ids per contract | Stage 3.1B.6 | Suggestion contract evidence model | Complete — Local, Preview Test Pending | `verify-stage-3-1b6-assistant-ui.ts`; Preview smoke | Evidence Engine substrate | Human-readable summaries only; no raw JSON |
| ISD-006 | Discovery rerun / idempotency | Feature | P0 | Analyse Job one-shot; no stale/supersede; duplicate risk on notes | Brief locked; note analyse blocked while pending | ScopeDiscoveryRun idempotency; stale/supersede; no duplicate provider calls | Stage 3.1B.4A / 3.1B.4B / 3.1B.5C | OCD-ISD-06/07/08; persistence owner approval | Complete — Local (orchestration + persistence + server run service); remote apply Applied and Verified | `verify-stage-3-1b4a-discovery-orchestration.ts`; `verify-stage-3-1b4b-persistence.ts`; `verify-stage-3-1b5c-gated-server-integration.ts` | Run history for learning later | Explicit user trigger; Analyse Job unchanged |
| ISD-007 | Discovery latency / progress | Performance | P1 | Only basic Analysing state; no budgets | Unmeasured provider wait | Progress states + latency/cost budgets; cancellation where practical | Stage 3.1B.8 | Latency budget doc | Ready | Measure vs budget in Preview | — | Do not claim SLOs until measured |
| ISD-008 | Attachment security design | Security | P1 | Photos/documents missing; future media is high-risk | No project attachments | Design DB ownership/RLS **and** Storage bucket policies before media ISD | Pre-media / D-S6 | Deferred schema D-S6 | Deferred | Design review + RLS/storage checklist | Visual evidence for DNA | Architecture-review: both DB and bucket policies required |
| DEMO-R6 | Mobile Dashboard KPI densify + status dropdown; Legacy Rates Advanced | UX | P1 | Mobile Dashboard KPIs/filter waste vertical space; Legacy package rates clutter primary Rates nav | Tall KPI cards; horizontal status pills; Legacy in primary nav | Compact 2-col KPIs; mobile Status select; Legacy under Advanced only (data retained) | Demo polish / Preview | Cost-first Rates | Complete — Local (Owner smoke pending) | `verify-demo-r6-mobile-dashboard-legacy-rates.ts` | None | Presentation only |
| DEMO-R7 | Mobile header project-first Dashboard | UX | P0 | Mobile Dashboard chrome burns fold before projects | Logo + large title + subtitle + standalone avatar + KPIs | Shared mobile header logo+avatar; Dashboard chrome compactOnMobile; list earlier | Final pre-demo | DEMO-R6 | Complete — Local (Owner smoke pending) | `verify-demo-r7-mobile-header-dashboard.ts` | None | No commercial change |
| BRANDING-P0 | Company logo upload + quote rendering | Feature | P0 | Logo URL / Imgur pages break quotes | External logo_url + raw `<img>` | Upload PNG/JPG/WebP to org storage; Settings upload UX; quote onError → company name | Pre-demo branding | Storage migration 034 | Complete — Local (Owner Preview pending; apply 034) | `verify-branding-p0-company-logo.ts` | None | Live branding on quotes |
| BRANDING-SNAPSHOT-01 | Snapshot logo on sent quotes | Feature | P2 | Sent quotes change if company logo changes | Quotes read live company settings | Persist logo URL/asset ref on quote send/create | Post-demo commercial docs | BRANDING-P0 | Deferred | Quote create/send snapshot tests | Not DNA | Prefer immutability for sent docs |
| RATE-LEGACY-01 | Deprecate/remove unused `scope.*` package rate rows | Cleanup | P2 | Historical package rates may confuse if left editable forever | Rows retained; Advanced UI only | Optional future migration after consumer proof + Owner gate — do **not** delete in DEMO-R6 | Post-demo commercial cleanup | Rate architecture CF-D5 | Deferred | Consumer audit + Owner approval + migration | Not DNA | No calculator change until replacement path exists |
| RATE-QUALITY-01 | Detect suspicious company rates / likely unit mistakes | Feature | P2 | A `$23/m²` hardwood row can be a `$/lm` typed into the m² field | No range check vs Quotr benchmark family | Warn “Check this rate — it is substantially below typical values.” Do **not** auto-correct | Post R2-R1 Preview | R2-R1-R1 conversion + Rates labels | **Backlog / Not Started** | Fixture: hardwood company $23/m² vs $230 bench; no silent rewrite | DNA later may use outliers as evidence | Do not implement in R2-R1 |

---

## Batch notes (Stage 3.1A)

- Implemented and Preview-signed: BUG-001–004, UX-001–005, R1-001–R1-005.
- Stage 3.1A **Complete**; Stage 3.1D **Complete** — see `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md` (2026-08-05).

## Batch notes (Stage 3.1B)

- Stage 3.1B status: **Complete — Preview Validated** (2026-08-11) — `docs/implementation/STAGE_3_1B_CLOSURE.md`.
- Owner E2E: Deck **PASS**; Bathroom **PASS**; Commercial Fitout **PASS** (functional). DEF-7E-003 **Closed**.
- Production Scope Discovery: **Disabled**. Analyse Job **Preserved**.
- Attention routing final: R6-R4.1 (`79afb4e`) Preview Ready.
- Residual responsiveness: **PERF-FUTURE-01** Planned (non-blocking).
- FEAT-001 Partial (ISD groups/cards); broader WA collapse Deferred; FEAT-002 Deferred; FEAT-003 taxonomy designed in 3.2.0; implementation gated on owner D4.
- Stage **3.2.0 Complete Planning** — `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md`. Stage **3.2.0-R1 Complete** — `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md`. Stage **3.2.1 Complete** — `docs/implementation/STAGE_3_2_1_CANDIDATE_ENGINE_COMPLETION.md` (D1–D16 OWNER APPROVED). Stage **3.2.2 In Owner Preview / R5 Complete Local** — `docs/implementation/STAGE_3_2_2_R5_DEMO_UI_POLISH_COMPLETION.md` (Owner Demo Preview Pending). Stage **3.2.3 Not Started**.

## Batch notes (Stage 3.1B — historical implementation)

- Stage 3.1B.0 Planning docs: Complete.
- Stage 3.1B.1 suggestion contract: **Complete — Local** — `lib/scope-discovery/*`; no production adoption.
- Stage 3.1B.2 catalogue: **Complete — Local** — `lib/scope-discovery/catalogue/*`; production catalogue adoption **Not Started**.
- Stage 3.1B.3 AI provider: **Complete — Local** — `lib/scope-discovery/provider/*`; Analyse Job unchanged.
- Stage 3.1B.4A orchestration: **Complete — Local**.
- Stage 3.1B.4B-0 persistence gate: **Complete — Planning**.
- Stage 3.1B.4B persistence: **Complete** — migration `028`; remote **Applied and Verified**.
- Stage 3.1B.5A decision lifecycle: **Complete** — migration `029`; remote **Applied and Verified**.
- Stage 3.1B.5B remote readiness + wiring design: **Complete — Planning**.
- Stage 3.1B.5C gated server integration: **Complete — Local**; production **Disabled**.
- Stage 3.1B.6–7G Assistant UI / disclosure / density: **Complete — Preview Validated** with Stage 3.1B closure.
- Migrations: `028`/`029`/`030`/`031` **Applied and Verified**; feature flag **Implemented** (`SCOPE_DISCOVERY_ENABLED`, default off).
- Stage 3.1B.7F–R6-R4.1 Owner Preview remediation series: **Complete** with Stage 3.1B closure.
- Scope Discovery Preview sign-off: **Pending Owner Test**.
- Do not change Analyse Job behaviour, commercial formulas, or Company DNA without explicit authorisation.
- Stage 3.1B.7 missing-scope — Deferred until Preview gate clears.
- Production: **Disabled**.
- Stage 3.2: **3.2.0 Complete Planning**; **3.2.0-R1 Complete**; **3.2.1 Complete**; **3.2.2 In Owner Preview / R5 Complete Local** (Owner Demo Preview Pending); **3.2.3 Not Started** (stage not globally Complete).

## Batch notes (Stage 3.2 Builder Interview)

- **3.2.0** Audit & Specification: **Complete Planning** (2026-08-11).
- **3.2.0-R1** Architecture reconciliation: **Complete — Docs only** (2026-08-12).
- **3.2.1** Deterministic candidate engine: **Complete** (2026-08-12); D1–D16 **OWNER APPROVED**; pure `lib/builder-interview/`; no UI/writes/migrations.
- **3.2.2** Core project/site interview: **In Owner Preview / R5 Complete Local** (Owner Demo Preview Pending). R2 UX/margin Complete Local; R3 demo-ready Estimate UX Complete Local; R4 demo UX completion Complete Local; **R5 demo UI polish Complete Local**.
- **3.2.3** Not Started / superseded in part by FOUNDATION-R1 PC cleanup.
- Post–3.2.2 commercial/materials: **COMMERCIAL-P0 Complete**; **Cost-first Rates Complete Local / Owner Preview Pending**; MaterialRequirement / Deck Takeoff **Not Started** — `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`.
- **FOUNDATION-R1 Complete / Preview regression remediated by R1-R1** (2026-08-15) — `docs/implementation/FOUNDATION_R1_PROJECT_CONDITIONS_SUPPORT_COMPLETION.md`. **FOUNDATION-R1-R1 Complete — Owner Preview Validated** — `docs/implementation/FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md`. **FOUNDATION-R2 Complete Local / In Owner Preview / R2-R1 remediation ready.** **FOUNDATION-R2-R1 Complete Local / Owner Preview Pending.** **FOUNDATION-R2-R1-R1 Complete Local / included in R2-R1 Preview gate.** REQ-1/2/3 **Not Started** (technically ready after Owner PASS). **RATE-QUALITY-01 Backlog / Not Started.** Production Scope Discovery **Disabled**; Company DNA **Not Started**; PERF-FUTURE-01 **Planned**.
- **Backlog after R1:** kitchen/fitout labour-access under-consumption; skip_bin/disposal vs project waste logistics (R2); AN-1 event emitters (`lib/analytics/event-contract.ts` types only).
- **DEMO-R6** (Preview polish): compact mobile Dashboard KPIs + mobile status dropdown; Legacy package rates demoted from primary Rates nav to Advanced (data retained; no calculator change). Future: optional Legacy rates deprecation/removal migration (backlog only — not this batch).
- **DEMO-R7** (Final demo polish — Complete Local pending Owner): mobile AppShell header logo+avatar; Dashboard compactOnMobile (sr-only H1; hide title/subtitle/profile row); tighter spacing; safe drop of duplicate Dashboard auth/profile fetch. PERF-FUTURE-01 remains Planned for deeper latency.
- **BRANDING-P0** Company logo upload + quote render (Complete Local pending Owner): Storage bucket `organisation-branding`; Settings upload UX; quote broken-image fallback. Snapshot immutability deferred (**BRANDING-SNAPSHOT-01**). Verify: `scripts/verify-branding-p0-company-logo.ts`.
- Production Scope Discovery: **Disabled**. Company DNA: **Not Started**. PERF-FUTURE-01: **Planned** (parallel; R2–R5 evidence recorded).
- **Architecture gates (PHASE 0-R1, not started):** REQ-SNAPSHOT-01 (blocks REQ-4); CAT-IDENTITY-01 (blocks CAT-V2 seeding); AN-EVIDENCE-01 (blocks AN-1 emitters); QUOTE-IMMUTABILITY-DB-01 (before public quote acceptance Production); SUB-AUTH-01 (before RFQ); ISD-MAP-01 (future CI). REQ-1 envelope: `docs/implementation/REQ_1_ESTIMATE_REQUIREMENT_ENVELOPE_COMPLETION.md`.

## Batch notes (Stage 3.1C auth / setup) — CLOSED

- Stage **3.1C overall:** **Complete — Preview Validated** (2026-08-10) — `docs/implementation/STAGE_3_1C_CLOSURE.md`.
- Stage 3.1C.0–3.1C.2B: **Complete — Preview Validated**.
- Stage 3.1C.3 + R1 + R2A–R2E + R2E-R1 + R2E-R1.1: **Complete — Preview Validated**.
- Migrations **032** and **033**: Applied and Verified Remote.
- Deferred (not complete): email change; Company DNA; calibration→rate auto-apply; additional scenarios; Stage 3.2 implementation; Production Scope Discovery enablement.
- Stage 3.1B: **Complete — Preview Validated** (2026-08-11). Next: Stage **3.2.2-R5 Owner Demo Preview**; then Owner-gated commercial P0 and/or **3.2.3**.
- Production Scope Discovery: **Disabled**. Stage 3.2: **3.2.2 In Owner Preview / R5 Complete Local** / **3.2.3 Not Started**. Company DNA: **Not Started**. PERF-FUTURE-01: **Planned**. Commercial/materials planning: **Not Started (impl)**.

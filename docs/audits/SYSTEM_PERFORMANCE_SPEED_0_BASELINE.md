# SYSTEM-PERFORMANCE-SPEED-0 — Production-like performance baseline + bottleneck register

**Status:** COMPLETE LOCAL / OWNER APPROVED  
**REQ-TXN-01:** VERIFY_LATER — LOCAL SUPABASE REQUIRED (NOT EXECUTED / ENVIRONMENT BLOCKED)  
**Date:** 2026-08-31  
**Programme:** SYSTEM PERFORMANCE — SPEED 0  
**Classification:** MEASURE / TRACE / PROFILE / DOCUMENT / RANK  
**Does not:** implement Speed 1A or 1B, rewrite architecture, start Bathroom, reopen Work Areas, deploy Production, begin Pricing/Quote UX overhaul  

**Companion:** `scripts/verify-system-performance-speed-0.ts`  
**CPU harness:** `scripts/measure-system-performance-speed-0.ts`  
**Prior related docs (not duplicated):** `docs/PERFORMANCE.md`, `docs/PERFORMANCE_RESPONSIVE_QA.md`, `docs/performance/ASSISTANT_RESPONSIVENESS_LATENCY_OPTIMISATION_PASS.md` (PERF-FUTURE-01 Planned)

**Next programme (not this batch):** SYSTEM-PERFORMANCE-SPEED-1A = REQUEST CONSOLIDATION

### Canonical major finding

**ESTIMATOR CPU IS NOT THE CURRENT BOTTLENECK.**

Measured multi-WA fixture E (Deck + Fence + RW): average **~4.11 ms**, p95 **~4.95 ms**. Do **not** recommend calculator micro-optimisation.

### Canonical primary bottlenecks (ranked; preserved)

1. **SP0-01** — repeated auth/org trees  
2. **SP0-02** — fact-save / Clarify broad mutation + refresh  
3. **SP0-03** — Generate/Update full-project refresh  
4. **SP0-04** — duplicate project/pricing loaders  

---

## 1. Measurement method

| Method | What it covers | Classification |
| --- | --- | --- |
| Static code trace of RSC pages, server actions, Supabase loaders | Request/query waterfalls, sequential vs parallel, duplicate auth, write loops | **DERIVED** |
| Schema/index inventory from `supabase/migrations/` | Index coverage on high-frequency keys | **MEASURED** (schema text) |
| In-process CPU harness (`measure-system-performance-speed-0.ts`) | `calculateEstimate`, persist-payload build, Job Plan / Clarify / Builder Review compose, JSON payload sizes | **MEASURED** (local CPU; not network) |
| Existing closed-WA fixtures (Deck SIMPLE-01, REAL-JOB-01, ELEVATED-01; Fence timber 18 m; RW timber 10×1; multi-WA union) | Representative builder-sized jobs without changing economics | **MEASURED** outputs / **UNCHANGED** money |
| `package.json` + `next.config.ts` + App Router files | Rendering model, bundle-relevant deps | **MEASURED** |
| Existing `measureServerLoad` examples in `docs/PERFORMANCE.md` | Historical local RSC page timings | **HISTORICAL / NOT THIS BATCH** |
| Supabase hostname + Cloudflare `CF-RAY` colo | Edge observed from this machine; origin region not in URL | **MEASURED** (edge) / **NOT CURRENTLY OBSERVABLE** (origin region, Vercel region) |
| No Vercel tracing / no Chrome DevTools session in this batch | User-perceived navigation, Preview wall-clock, mobile device | **NOT CURRENTLY OBSERVABLE** |

**Rule used throughout:** numbers are labelled MEASURED, DERIVED, ESTIMATED, HISTORICAL, or NOT CURRENTLY OBSERVABLE. Unavailable numbers are not fabricated.

No application-path instrumentation was added. Existing helpers remain:

- `lib/perf/timing.ts` — `measureServerLoad` logs `[perf] <label>: Nms` only when `NODE_ENV === "development"`. No sensitive data.
- `lib/assistant/preview-performance.ts` — metadata-only marks; never logs brief/notes/commercial payloads.

---

## 2. Environment measured

| Item | Value | Evidence class |
| --- | --- | --- |
| Date | 2026-08-31 | — |
| Host OS | Windows 10 (build 26200) | MEASURED |
| Node | v24.15.0 | MEASURED |
| App | Next.js 16.2.9, React 19.2.4 | MEASURED (`package.json`) |
| Next config | Empty `next.config.ts` (`NextConfig = {}`) | MEASURED |
| Local app process | Not treated as authoritative for user SLOs | Limitation |
| Database | Remote Supabase project `lxvnylhsbvudzzupxeqr` (same project named in `docs/PRODUCTION_READINESS.md`) | MEASURED hostname |
| Cloudflare colo on this probe | `AKL` (Auckland) via `CF-RAY` | MEASURED |
| Supabase origin region | Not present on `*.supabase.co` URL; dashboard not queried | **NOT CURRENTLY OBSERVABLE** |
| Vercel region / function region | No `vercel.json`; no dashboard export in repo | **NOT CURRENTLY OBSERVABLE** |
| Vercel Preview wall-clock | Not captured this batch | **NOT CURRENTLY OBSERVABLE** |

---

## 3. Fixture set

Performance-only. Estimator economics were not altered. Fixtures reuse existing closed-WA facts.

| ID | Description | Source | Confirmed WAs | Lines (included) | Reqs | recommendedSell (empty company rates) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| A | Simple specified Deck | `tests/fixtures/deck-calibration/SIMPLE-01.json` | 1 Deck | 9 | 7 | 7763.53 |
| B | Mature Deck real-job | `tests/fixtures/deck-calibration/REAL-JOB-01.json` | 1 Deck | 9 | 6 | **12878.01** (existing recovery golden) |
| B2 | Mature elevated Deck | `tests/fixtures/deck-calibration/ELEVATED-01.json` | 1 Deck | 10 | 7 | 12086.39 |
| C | Mature Fence | Fence-1A timber paling facts (18 m × 1.8 m, gate, capping) | 1 Fence | 14 | 17 | 4943.38 |
| D | Mature Retaining Wall | RW-1B timber level facts (10 m × 1 m, drainage, backfill) | 1 RW | 12 | 15 | 4391.72 |
| E | Multi-WA | SIMPLE-01 Deck + Fence C + RW D | 3 | 35 | 39 | 17098.63 |

Empty-rates vs full catalogue (139 company rows from `FULL_RATE_CATALOGUE` with `defaultCostRate`) did **not** change recommendedSell on these fixtures — lookup path is in-memory; money matched because catalogue defaults align with current fallbacks for these jobs.

---

## 4. Limitations

1. **Local CPU ≠ user-perceived latency.** Estimator compute is 1–4 ms; builders wait on network, auth amplification, RSC refresh, and DB round trips.
2. **No authenticated Preview trace** in this batch (no Vercel Analytics, no Sentry, no Chrome session against Preview).
3. **Supabase origin region and Vercel region** are not in-repo. Cross-region RTT cannot be proven; it can only be bounded.
4. **Query counts are DERIVED from code**, not from Postgres `pg_stat_statements` or PostgREST logs.
5. **Render/re-render counts** are not profiled in React DevTools this batch.
6. **`npm run build` (Next.js 16.2.9 Turbopack, 2026-08-31):** compiled successfully; all product routes are `ƒ` (dynamic). This Next version did **not** emit a per-route First Load JS table. Bundle findings below therefore use source-island size + dependency inventory (MEASURED tree / DERIVED weight). A middleware→proxy deprecation warning appeared; not changed in Speed 0.
7. Historical `[perf] project: 218ms` in `docs/PERFORMANCE.md` is **not** reused as this baseline’s SLA.
8. Scope Discovery Production remains disabled; discovery loaders are optional and excluded from the default project-page query count unless the flag is on.

---

## 5. Current-state performance architecture map

### 5.1 Rendering model

- App Router under `(auth)` and `(protected)`.
- Almost every product page is an **RSC data loader** wrapping a large `"use client"` island (`AssistantShell`, `PricingWorkspace`, `QuoteWorkspace`).
- `cookies()` (Supabase server client), `headers()` (protected layout), and `connection()` (project / pricing / quote / print) force **dynamic rendering**.
- No `export const dynamic`, no `revalidate`, no `revalidateTag`, no `unstable_cache`, no `React.cache()`.
- Invalidation = `revalidatePath` + frequent `router.refresh()`.
- Middleware refreshes the Supabase session cookie on every matched request.

### 5.2 Auth / org context

`requireAuthOrgContext` / `getAuthOrgContext` (`lib/security/auth-org-context.ts`):

1. `createClient()` (new server client every call; `cookies()`)
2. `supabase.auth.getUser()`
3. `profiles` select `org_id`
4. `organisations` select `id`

Organisation is always derived from the signed-in profile. No request-level memo. Ownership helpers then add another `projects` (or resource) select.

### 5.3 Major surfaces

| Surface | Page | Server | Client island |
| --- | --- | --- | --- |
| Project / Job Plan / Clarify / Estimate / Builder Review | `/app/projects/[projectId]` | `ProjectPage` + `getAssistantState` | `AssistantShell` (~105 KB source) |
| Pricing | `/app/projects/[id]/pricing/[id]` | `getPricingWorkspaceData` | `PricingWorkspace` |
| Quote | `/app/projects/[id]/quotes/[id]` | `getQuoteWorkspaceData` | `QuoteWorkspace` + `QuoteTemplate` |
| Dashboard | `/app/dashboard` | `listProjects` + summaries | `DashboardProjectList` |

### 5.4 Estimate persistence

Happy path: one RPC `persist_estimate_generation_v1` (migration 036) — estimate + lines + requirement snapshot + ready, one transaction. Then one `pricing_documents` update (`needs_recalibration`). Legacy multi-call delete-all-lines + bulk insert exists only as fallback when RPC is unavailable **and** generation does not require a snapshot.

### 5.5 Rate resolution

`getEstimateContext` loads **all active org rates once** (parallel with facts/WAs/constraints/settings). `resolveRate` / `resolveMaterialRate` scan that array in memory (`Array.find`). Catalogue/benchmarks are code constants, not extra DB. **No DB N+1 for rates.** CPU cost is O(lookups × rates.length); 139 rates did not move sells and did not create a meaningful CPU delta vs empty rates.

---

## 6. Infrastructure / region topology

```
Builder browser
  → Cloudflare edge (this probe: AKL)          MEASURED
    → Vercel compute / function region         NOT CURRENTLY OBSERVABLE
      → Next.js server / serverless
        → Supabase API gateway (project lxvnylhsbvudzzupxeqr.supabase.co)
          → Postgres origin region             NOT CURRENTLY OBSERVABLE
```

Do **not** infer Vercel region, Postgres region, or cross-region architecture from this baseline.

**Operational follow-up (no region changes in Speed 0):**

1. Confirm Vercel compute / function region in the Vercel project dashboard.  
2. Confirm Supabase project / Postgres region in the Supabase dashboard.

**Local topology (this batch):** Windows Next.js process in NZ talking to remote Supabase through Cloudflare AKL. Local page timings therefore include **real WAN RTT** to Supabase, but **not** Vercel cold start.

---

## 7. Canonical user flows

| Flow | Journey | Dominant cost (from trace) |
| --- | --- | --- |
| A | Open existing Project | Auth amplification + `getAssistantState` + full RSC |
| B | Open / generate Job Plan | Compose is CPU-cheap; first paint rides Flow A |
| C | Answer Clarify / save fact | Sequential writes + `markEstimateStale` extra auth + `router.refresh` |
| D | Generate Estimate | Stage+context load, 1–4 ms CPU, 1 RPC, then full project refresh |
| E | Open Builder Review | Compose from SSR estimate; no extra DB if already on project page |
| F | Edit Job / scope | Same write family as C (`updateProjectFact` / work-area actions) |
| G | Update Estimate | Generate path + extra `loadProjectStage` + full line rewrite via RPC |
| H | Open Pricing | Parallel workspace loaders, each with own auth |
| I | Edit commercial pricing | Optimistic client updates exist; document save revalidates project+pricing+dashboard |
| J | Generate/Open Quote | Create = snapshot from reviewed pricing + 2 inserts; open = parallel quote load + nested `getCompanySettings` auth |

---

## 8. Project page load trace (Flow A)

**File:** `app/(protected)/app/projects/[projectId]/page.tsx`

### 8.1 Sequential outer layout (`app/(protected)/app/layout.tsx`)

| Step | Where | Queries |
| --- | --- | --- |
| Session | `createClient` + `getUser` | Auth |
| Profile | `profiles` (`full_name, org_id`) | 1 |
| Org + settings | parallel `organisations`, `organisation_settings` | 2 |
| Basics gate | `needsCompanyBasics` → **another** `getAuthOrgContext` + `organisation_settings.onboarding_status` | ~4 |

Necessary for tenant gate. Redundant with page loaders.

### 8.2 Parallel page batch (`Promise.all`)

| Loader | Auth trees | Domain after auth |
| --- | --- | --- |
| `getProject` | 1 | lifecycle probe(s) + `projects` full row |
| `getAssistantState` | 1 + ownership `projects` | `projects` stage/brief; **parallel** work_areas, question_blocks, questions, constraints, estimates, project_facts, organisation_settings; **then sequential** estimate_line_items; **then sequential** snapshot payload |
| `listProjectNotes` | 1 | notes (limit 20) + **2 HEAD counts** |
| `getPendingNoteProposal` | 1 | latest pending `note_proposals` |
| `getLatestPricingSummary` | 1 + ownership | latest `pricing_documents` |
| `getProjectWorkspaceTabContext` | 1 + ownership | **nested** `getLatestPricingSummary` (full auth again) + `estimates.is_stale` |
| `getLatestQuoteSummary` | 1 + ownership | quotes summary |

### 8.3 Sequential after batch

- Page-local `createClient` + `getUser` + `profiles.full_name` (again)
- Optional Scope Discovery results (flag off by default)
- `SetupGuidanceServerBanner` → `getCompanySetupReadiness` → auth + 5 parallel org/settings/labour/prefs/calibrations

### 8.4 Waterfall (DERIVED)

```
middleware session refresh
  → layout auth/org/settings (sequential)
    → needsCompanyBasics (repeat auth)
      → Promise.all(7 loaders)     ← each repeats auth+ownership
        → getAssistantState tail: line items → snapshot
        → tabContext nested pricing summary (repeat auth)
      → page user/profile
      → optional discovery
      → setup readiness (repeat auth)
      → RSC serialize AssistantState + notes + nav summaries
      → hydrate AssistantShell
      → useMemo Job Plan / Clarify / readiness / Builder Review
```

**Estimated auth/org trees per project first paint:** ~10–12.  
**Estimated sequential waits on the critical path:** layout (~5 RTT) + slowest loader (assistant ≈ 6–8 RTT including auth) + post (~2–4 RTT).  
**Wall-clock:** NOT CURRENTLY OBSERVABLE on Preview. **ESTIMATED** as `layout + max(loaders) + tail`, dominated by RTT × sequential stages, not CPU.

**Repeated / not required for first paint of Job Plan:**

- Nested pricing summary (duplicate of the parallel pricing summary)
- Second profile read on the page
- Setup readiness when an estimate already exists (banner still mounts in some branches)
- Questions + question_blocks if the builder is on Job Plan (Clarify still uses facts/constraints; questions are a journal)

**Necessary for first assistant render:** project, work areas, facts, constraints, estimate + lines + snapshot (if present), org margin.

---

## 9. Job Plan / Clarify timings (Flows B, C, F)

### 9.1 Load / compose — MEASURED CPU

| Surface | Fixture E (multi-WA) avg | Fixture B (Deck) avg |
| --- | --- | --- |
| `composeJobPlan` | 0.037 ms | 0.016 ms |
| `composeClarifyView` | 0.134 ms | 0.070 ms |
| `composeBuilderReview` | 0.548 ms | 0.172 ms |

**Conclusion:** presentation compose is not the bottleneck. Job Plan / Clarify / Builder Review are **client recompositions** of SSR `AssistantState`.

### 9.2 One-field fact save — DERIVED write path

`updateProjectFact` (`lib/assistant/fact-actions.ts`):

1. `getAuthOrgContext` (3 sequential)
2. `assertOrgOwnsActiveProject`
3. `projects` select (stage, quality)
4. optional `work_areas` existence
5. `commitUserFactEdit`: select fact → upsert fact → mirror onto `questions`
6. reload **all** work_areas
7. reload **all** project_facts
8. `persistDerivedFactsForProject`: **per derived fact**, sequential select + update/insert (**N+1 writes**)
9. `ensureMissingDetailsQuestionBlock`: work_areas, facts, questions, blocks, constraints, possible block/question inserts, possible extra fact writes
10. `markEstimateStale`: **new** `getAuthOrgContext` + ownership + `estimates` update
11. `revalidatePath(/app/projects/:id)`
12. Client: `router.refresh()` inside `startTransition` (AssistantShell, many call sites)

**Server actions:** 1 user-visible action.  
**Writes:** 2–N+ (fact, question mirror, derived facts, stale flag, maybe questions).  
**Duplicate reads:** work areas and facts loaded again after the commit that already knew them.  
**User-perceived:** click → optimistic overlay possible → wait for action → wait for full RSC refresh (Flow A again).

Time to meaningful state: optimistic UI if overlay is used.  
Time to final resolved state: action + full project reload. **NOT CURRENTLY OBSERVABLE** in ms on Preview.

Clarify constraint batch (`saveBuilderInterviewProjectAnswers`) is better: per-answer upserts then **parallel** reload of constraints/facts/WAs/project. Still revalidates the whole project.

---

## 10. Generate Estimate trace (Flow D)

`generateStaticEstimate` → `runEstimateGeneration` (`lib/assistant/actions.ts`).

| Stage | Parallel? | Cost class | Notes |
| --- | --- | --- | --- |
| `loadProjectStage` | seq | DB/auth | auth + ownership + `projects.stage` |
| existing estimate + `getEstimateContext` | parallel with each other | DB/auth | context **repeats auth** |
| lifecycle `deleted_at` | seq inside context if columns exist | DB | extra projects read |
| facts, WAs, constraints, settings, **all rates** | parallel | DB | 5 queries, 1 RTT wall |
| derive + crossover + readiness | CPU | app | negligible vs RTT |
| `calculateEstimate` | CPU | app | **MEASURED 1.1–4.2 ms avg** |
| target-margin overlay | CPU | app | dynamic import `margin-override` if set |
| `persist_estimate_generation_v1` | 1 RPC | DB | payload **MEASURED 21–83 KB** |
| mark pricing recalibration | 1 update | DB | |
| `projects.stage = estimate_ready` | 1 update if needed | DB | |
| `revalidatePath` project | — | RSC | |
| return `{ success: true }` | — | — | **no estimate payload returned** |
| `router.refresh` | full Flow A | NETWORK+DB | post-write read is the next RSC render |

**Server action count:** 1.  
**Writes:** 1 RPC + 1 pricing update + 0–1 stage.  
**Post-write reads:** entire project page (not a targeted estimate refetch).

---

## 11. Update Estimate trace (Flow G)

`regenerateStaticEstimate`:

1. `loadProjectStage` (auth + stage must be `estimate_ready`)
2. `runEstimateGeneration` which **loads stage again**
3. Same context/calc/persist as generate (`allowRegenerate: true`)
4. Full recompute; **not** a patch of changed lines
5. RPC replaces lines + appends requirement snapshot (append-only snapshots; lines replaced inside the transaction)
6. Same full `router.refresh`

**Highest-value builder interaction after fact save.** Extra wasted stage load is real but small vs refresh.

---

## 12. Builder Review trace (Flow E)

- `composeBuilderReview` in `AssistantShell` `useMemo` when an estimate exists.
- Inputs: estimate totals/lines already in SSR state, `requirementSnapshotRequirements`, work areas, attention items.
- **DB: none** on open.
- Server vs client: formatting is **client**. Snapshot requirements arrive as RSC payload (**MEASURED** 12–48 KB of persist snapshot JSON; Builder Review view JSON 28–115 KB for fixtures A–E).
- Repeated composition: only on estimate/stale/work-area identity change (memoised).

---

## 13. Pricing trace (Flows H, I)

**Open:** `PricingPage` parallel: `getPricingWorkspaceData`, `getProject`, `getProjectWorkspaceTabContext`, two quote summaries — **each with own auth**. Then page user/profile again.

`getPricingWorkspaceData` after auth+two ownership checks: parallel project, pricing document `select *`, pricing items `select *`, confirmed work areas, estimate sell/stale.

**Create from Estimate:** sequential auth/ownership/project/estimate; line items; work areas; in-memory map via `valuesFromEstimateLineItem` (Estimate authority); org quote defaults; insert document; bulk insert items; recalculate totals; optional business_status; revalidate project+pricing+dashboard; redirect.

No second physical estimate. Pricing **adopts Estimate lines**. Missing-rate / Pricing Required remains commercial behaviour, not a rebuild.

**Item edits:** existing optimistic UI without `router.refresh` (`docs/PERFORMANCE_RESPONSIVE_QA.md`) — keep.

---

## 14. Quote trace (Flow J)

**Create:** auth + ownership; redirect if quote exists; `buildQuoteSnapshotFromReviewedPricing` (document + parallel pricing items, work areas, facts + org defaults); insert quote + bulk quote items; revalidate; redirect. **Quote adopts Pricing**, not Estimate.

**Open:** auth + two ownership checks; parallel project, quote `select *`, quote_items, **`getCompanySettings()` (another full auth)**; then pricing `updated_at`; all project quotes for latest revision; page user/profile.

Description generation / terms: from org defaults + work-area quote descriptions already on WAs — not an extra AI call on open. Print is a separate RSC route + `window.print` (no PDF library).

---

## 15. Flow timings summary

Classification key: M = MEASURED CPU, D = DERIVED query/action shape, N = NOT CURRENTLY OBSERVABLE wall-clock.

| Flow | CPU (M, multi-WA unless noted) | Server actions (D) | DB round trips (D, order of magnitude) | Writes (D) | User-perceived |
| --- | --- | --- | --- | --- | --- |
| A Project open | compose ≪ 1 ms after RSC | 0 (RSC) | ~25–40 queries across ~10 auth trees | 0 | N (Preview) |
| B Job Plan open | 0.04 ms compose | 0 | 0 extra | 0 | included in A |
| C Clarify/fact save | compose ≪ 1 ms | 1 | ~15–40 sequential-ish | 2–N+ | N; refresh = A |
| D Generate Estimate | 1.3–4.2 ms calc | 1 | ~12–20 then refresh A | 2–3 | N |
| E Builder Review | 0.2–0.5 ms compose | 0 | 0 extra | 0 | included in A |
| F Edit Job/scope | same family as C | 1 | same as C | same as C | N |
| G Update Estimate | 1.3–4.2 ms + extra stage load | 1 | D + extra auth | 2–3 | N |
| H Pricing open | not separately timed | 0 (RSC) | ~15–25 with duplicate auth | 0 | N |
| I Pricing edit | client | 1 per save | 1–few | 1–few | better than A (optimistic) |
| J Quote open/create | snapshot map CPU cheap | 0 or 1 | open ~12–20; create ~8–12 + 2 inserts | 0 or 2 | N |

**Latency split (approximate, all major flows):**

| Bucket | Share | Evidence |
| --- | --- | --- |
| Network / sequential RTT | **Dominant** | Auth trees, ownership, refresh |
| Database engine time | Unknown per query; indexes present | NOT CURRENTLY OBSERVABLE without EXPLAIN |
| Application compute | **1–5 ms** generate; **<1 ms** compose | MEASURED |
| Serialization | persist build **0.05–0.20 ms**; payloads 20–115 KB | MEASURED |
| Render | large client island; not profiled | NOT CURRENTLY OBSERVABLE |
| Client interaction | `router.refresh` remount; action locks exist | DERIVED |

**Critical distinction:** estimator computation is **not** meaningful latency. **I/O + request fan-out + full RSC refresh** dominate.

---

## 16. Database query inventory

Frequency = per occurrence of the named flow. Expected rows = typical builder project, not empty.

| Domain | Typical queries | Frequency | Expected rows | Indexes (schema) | Duplicate / N+1 | Sequential deps |
| --- | --- | --- | --- | --- | --- | --- |
| auth/org | getUser, profiles, organisations | every loader/action | 1 | `profiles_org_id_idx`, org PK | **Yes — 10–12× / project paint** | getUser → profile → org |
| projects | ownership + full select | every loader | 1 | `projects_org_id_idx` + lifecycle indexes | ownership then re-select | after auth |
| scopes (work_areas) | list by project | assistant, estimate context, pricing, quote | 1–5 | `work_areas_project_id_status_idx` | assistant + context on generate | after project |
| facts | list by project | assistant, estimate, fact save reload | tens | `project_facts_project_id_key_idx` | reload after save | after auth |
| constraints | list by project | assistant, estimate | few | `constraints_project_id_key_idx` | — | after auth |
| questions / blocks | full project | assistant only | tens | project_id + status indexes | not needed for Job Plan first paint | parallel with facts |
| estimates | header | assistant, tab context, generate | 0–1 | `estimates_project_org_idx` | assistant + tabContext | before lines |
| estimate_line_items | by estimate_id | assistant, pricing create | 9–35+ | `estimate_line_items_estimate_id_sort_order_idx` | — | **after** header |
| estimate_requirement_snapshots | by id | assistant if pointer set | 1 payload | `estimate_requirement_snapshots_estimate_created_idx` | — | **after** header |
| rates | all active org | estimate generate only | ~10–139 | `rates_org_id_active_idx` | **not** N+1 | parallel in context |
| pricing_documents / items | latest or by id | nav + pricing page | 1 doc + N items | org/project/created indexes | **summary fetched twice** on project page | after auth |
| quotes / quote_items | latest or by id | nav + quote page | 1 + N | org/project indexes | — | after auth |
| attachments / notes | notes list + 2 counts | project page | ≤20 + counts | `project_notes_org_project_idx` | two count heads | parallel |
| other | org settings, setup readiness, calibration existence | layout + banners | 1 | org_id indexes | settings many times | after auth |

**N+1 (app-level):** `persistDerivedFactsForProject` loop (select+write per derived fact). Not a SQL join N+1 on reads of rates.

---

## 17. Database index audit

Existing coverage is **broad** (migration 002 + 013 + later tables). High-frequency paths have single-column or composite indexes on `org_id`, `project_id`, `estimate_id`, document ids.

**Recommend (do not add in Speed 0):**

| Candidate | Why |
| --- | --- |
| Confirm live `EXPLAIN` on `project_facts (project_id, org_id)` and `rates (org_id, active)` | Schema looks sufficient; verify against production-like row counts |
| `estimates (project_id, org_id)` | Already `estimates_project_org_idx` |
| Avoid dozens of new indexes | Write path (estimate persist, fact upserts) would pay for unused composites |

**No dangerous missing index found** that must be fixed for profiling safety. **No migration in Speed 0.**

---

## 18. Write-path audit

| Operation | Pattern | Round trips | Atomicity |
| --- | --- | --- | --- |
| Generate / Update Estimate | 1 RPC preferred | 1 + recalibration + optional stage | RPC transaction |
| Legacy persist | delete all lines + bulk insert | several | **not** one app transaction |
| Fact save | upsert fact + question mirror + derived loop + stale | many | **not** one transaction |
| Derived facts | loop insert/update | **N sequential** | per row |
| Pricing create | 1 doc insert + 1 bulk items | 2 + totals update | compensating delete if items fail |
| Pricing item edit | single row update | 1 | row |
| Quote create | 1 quote + 1 bulk items | 2 | sequential |
| `markEstimateStale` | extra auth + 1 update | 4–5 | separate from the fact write |

**Batch opportunities (Speed 2, not now):** derived-fact upsert; pass `supabase` into `markEstimateStale`; return estimate DTO from generate to avoid full refresh.

---

## 19. Network waterfall audit

| Sequence | Class | Latency impact |
| --- | --- | --- |
| getUser → profile → org inside every helper | Accidental serialization (security needs the chain **once per request**, not once per helper) | **Highest** |
| layout auth then page auth | Accidental | High |
| `getLatestPricingSummary` nested inside tab context while also called in `Promise.all` | Accidental duplicate | Medium |
| estimate header → lines → snapshot | Required dependency | Medium |
| fact save derived loop | Accidental / easy batch | High on save |
| generate `loadProjectStage` then context auth | Accidental | Medium |
| regenerate double `loadProjectStage` | Accidental | Low–medium |
| generate then `router.refresh` full tree | Required today for correctness of stale/lines; **scope too broad** | **Highest perceived** |
| pricing/quote loaders each re-auth | Accidental | High |

---

## 20. Router refresh / revalidation

| Mechanism | Count / hotspot | Why | Scope |
| --- | --- | --- | --- |
| `router.refresh` | **14** in `AssistantShell`; also notes, quotes, setup, project menus | After mutations so RSC `initialState` matches DB | **Entire project RSC tree** — Job Plan, Clarify, estimate, notes, nav |
| `revalidatePath` project | fact, constraint, WA, estimate, notes, scope items, descriptions | Cache invalidation (dynamic pages still refetch) | Project URL |
| `revalidatePath` dashboard | pricing create, quote helpers, some project lifecycle | Pipeline cards | Broader than needed for fact save (already removed from answer-save in 3.1A) |
| `revalidateTag` | **none** | — | — |

Do not remove refresh blindly: stale flags, line lists, and readiness currently live in SSR props. Speed 1 should **narrow** (return mutation results; keep refresh for estimate generate if needed).

---

## 21. Rate-resolution performance

- **DB:** 1 batched `rates` select per generate/update.
- **CPU:** linear scan; 0 vs 139 company rates: calc still ~1–4 ms (MEASURED). Multi-WA avg 4.11 ms empty vs 4.24 ms full catalogue.
- **Precedence:** unchanged (company named key → aliases → generic → benchmark if allowed → missing). Do not change in performance work.

---

## 22. Estimator CPU

MEASURED, 50 runs after warmup, Node 24, empty company rates:

| Fixture | first ms | avg ms | p95 ms |
| --- | --- | --- | --- |
| A SIMPLE-01 Deck | 4.00 | 1.56 | 2.60 |
| B REAL-JOB-01 Deck | 1.93 | 1.34 | 1.82 |
| B2 ELEVATED-01 | 1.33 | 1.31 | 1.69 |
| C Fence timber | 2.41 | 1.69 | 2.00 |
| D RW timber | 3.03 | 1.58 | 2.11 |
| E Deck+Fence+RW | 4.04 | 4.11 | 4.95 |

Persist JSON build: 0.05–0.20 ms. **I/O dominates; do not micro-optimise calculators in Speed 1.**

---

## 23. Payload findings

| Payload | Size (MEASURED, fixture) | Issue |
| --- | --- | --- |
| Estimate result JSON | 29–107 KB (A–E) | Full line notes/meta to client via assistant state |
| Persist RPC body | 21–83 KB | Acceptable for one generate |
| Requirement snapshot | 11–48 KB | Needed for Builder Review takeoff |
| Builder Review JSON | 28–115 KB | Derived on client; duplicates line presentation |
| Pricing `select *` | unknown until Preview network | Likely wider than the workspace needs |
| Quote `select *` | unknown | Same |
| Signed URLs | logos on quote; not on assistant path | Low on Flow A |
| Rate catalogue | not sent on project page | Good — only on generate |

**Material issues:** RSC `AssistantState` includes questions journal + full estimate lines + snapshot for every project navigation; multi-WA ~100 KB+ JSON before HTML. Rank: P2 payload, not P0.

---

## 24. Bundle / client render

**Build (MEASURED):** `npm run build` succeeded. Next.js 16.2.9 Turbopack listed every product route as `ƒ` (dynamic). No First Load JS column in this compiler’s output. Middleware deprecation warning (`proxy` rename) is framework-level; not addressed in Speed 0.

**Dependencies:** no pdf/chart/editor packages. AI SDK is `server-only`. Print = browser print.

**Large client islands (source size, MEASURED earlier in audit):**

| File | ~KB source |
| --- | --- |
| `AssistantShell.tsx` | 105 |
| `EstimatePanel.tsx` | 56 |
| `ScopeDiscoveryReviewBlock.tsx` | 52 |
| `EstimateBreakdownModal.tsx` | 42 |
| `BuilderReviewSurface.tsx` | 29 |

**Risks (DERIVED):**

- No `next/dynamic` on breakdown modal / discovery block
- Client imports of `lib/estimate/*` presentation + some calculator helpers
- `lucide-react` without `optimizePackageImports`
- `AssistantShell` keyed by `assistantState.project.stage` — stage change remounts the whole island
- Job Plan/Clarify/Builder Review memos are good; fact overlay updates recompose those three (CPU cheap)
- Pricing: `useMemo` on rows already (Sprint 3)
- No list virtualisation (known deferred P2 for 100+ breakdown lines; current fixtures are 9–35 lines)

**Mobile (code + existing QA, not a device lab this batch):**

- `useIsDesktop` single-layout mount on dashboard + pricing
- Quote sticky mobile action bar
- Assistant still ships the full JS island to 375px
- Interaction latency will be JS parse + refresh, not compose
- **NOT CURRENTLY OBSERVABLE:** LCP/INP on a phone against Preview

---

## 25. Cold vs warm / local vs Preview

| Comparison | Evidence |
| --- | --- |
| CPU first vs avg | First calc 4 ms vs avg 1.5 ms on SIMPLE-01 — noise vs RTT |
| Next.js compile / serverless cold | NOT CURRENTLY OBSERVABLE |
| Repeat navigation | RSC still dynamic; middleware still runs; **no Data Cache** — warm browser helps JS, not DB auth fan-out |
| Local vs Preview | Local CPU harness only. Preview wall-clock **not captured**. Do not overfit to local. Historical `docs/PERFORMANCE.md` examples (project ~218 ms) are local-dev illustrations only |

---

## 26. Auth / org context cost

- **Per user action:** typically **one `getAuthOrgContext` / `requireAuthOrgContext` per exported server function**, not per request.
- **Per project RSC request:** ~10–12 independent resolutions.
- **Safe reuse:** `React.cache(requireAuthOrgContext)` (or passing `AuthOrgContext` into callees) is request-scoped and preserves tenant isolation **if** it still always derives `orgId` from the session profile. **Do not** accept client-supplied org ids. **Do not** weaken RLS.

`markEstimateStale` and `getEstimateContext` are the clearest inner-call duplicates on write/generate paths.

---

## 27. Proposed performance budgets

These numbers are **INITIAL PERFORMANCE BUDGET PROPOSALS**, not validated SLOs.

They become enforceable only after production-like Preview measurements exist. CI must **not** assert Preview wall-clock. The Speed 0 verifier asserts CPU golden + architecture invariants only.

Tuned so **FAIL** is pathological and **TARGET** is a Speed 1A–2 stretch if auth fan-out is collapsed.

| Metric | TARGET | WARNING | FAIL | Notes |
| --- | --- | --- | --- | --- |
| Project usable load (nav → Job Plan / estimate visible) | 800 ms | 1500 ms | 3000 ms | Preview, warm session, fixture B or E |
| Job Plan compose / interaction (no save) | 50 ms | 100 ms | 250 ms | CPU already under TARGET |
| Clarify / fact save ack (click → Saved) | 400 ms | 800 ms | 2000 ms | Excludes full refresh paint |
| Clarify / fact save final (refresh settled) | 1000 ms | 2000 ms | 4000 ms | Dominated by Flow A today |
| Generate Estimate action complete | 800 ms | 1500 ms | 4000 ms | Excludes refresh |
| Generate Estimate usable (panel updated) | 1200 ms | 2500 ms | 5000 ms | Includes refresh |
| Update Estimate usable | 1200 ms | 2500 ms | 5000 ms | Same architecture as generate |
| Builder Review open (already on project) | 100 ms | 200 ms | 500 ms | Compose-only |
| Pricing open usable | 800 ms | 1500 ms | 3000 ms | |
| Quote open usable | 800 ms | 1500 ms | 3000 ms | |
| Estimator CPU fixture E | 10 ms | 25 ms | 50 ms | Guard against CPU regression |

---

## 28. Severity model

- **P0** user-blocking / pathological  
- **P1** major builder-visible latency  
- **P2** material but tolerable  
- **P3** minor  

Axes: SERVER/DB, NETWORK, CLIENT, BUNDLE, INFRASTRUCTURE.

---

## 29. Ranked bottleneck register

| Rank | ID | Sev | Axis | Finding | User impact | Effort | Risk | Leverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | SP0-01 | **P1** | SERVER/DB + NETWORK | Auth/org resolved independently ~10–12× per project RSC; no `React.cache` | Every navigation | M | Low if request-scoped | Very high |
| 2 | SP0-02 | **P1** | NETWORK + CLIENT | Fact/scope save → many sequential writes + extra stale auth + **full** `router.refresh` | Clarify / Job Plan — highest-frequency builder path | M | Medium (stale/readiness correctness) | Very high |
| 3 | SP0-03 | **P1** | NETWORK + CLIENT | Generate/Update Estimate returns `{success}` then reloads **entire** project tree | Wait after Generate | M | Medium | High |
| 4 | SP0-04 | **P1** | SERVER/DB | Duplicate loaders: nested `getLatestPricingSummary`, repeated `projects` ownership+select, page profile after layout | Adds RTT to max(loader) | S | Low | High |
| 5 | SP0-05 | **P2** | SERVER/DB | `persistDerivedFactsForProject` N+1; `ensureMissingDetailsQuestionBlock` heavy on every fact save | Slows Flow C | M | Medium (derived SoT) | High |
| 6 | SP0-06 | **P2** | SERVER/DB | `regenerateStaticEstimate` double `loadProjectStage`; `getEstimateContext` re-auths | Slows Flow G | S | Low | Medium |
| 7 | SP0-07 | **P2** | PAYLOAD + CLIENT | Assistant RSC payload ~30–110 KB JSON + huge client island | Mobile parse; remount on stage key | M | Medium | Medium |
| 8 | SP0-08 | **P2** | SERVER/DB | Pricing/quote pages repeat auth per helper; quote nests `getCompanySettings` | Tab switches | S | Low | Medium |
| 9 | SP0-09 | **P2** | INFRASTRUCTURE | Vercel compute region and Supabase Postgres origin not currently observable | Ops follow-up | S (dashboard check) | None until confirmed | Confirm regions; do not infer topology |
| 10 | SP0-10 | **P3** | BUNDLE | No `optimizePackageImports` / no dynamic split of breakdown modal | First JS | S | Low | Low–medium |
| 11 | SP0-11 | **P3** | SERVER/DB | Linear rate `find` over ~139 rows | None today (MEASURED) | — | — | Do not chase |
| 12 | SP0-12 | **P3** | CLIENT | No virtualisation of 100+ lines | Not hit by current WA sizes | — | — | Later |

**P0 findings:** none proven. No empty-table seq-scan bomb in schema; estimator CPU is healthy; RPC persist is already batched.

---

## 30. Speed 1–3 plan (evidence-based; do not start)

Speed 1 is split because server round-trip collapse and refresh-policy changes have different risk.

### SPEED 1A — SERVER REQUEST CONSOLIDATION

Low-risk server/DB round-trip reduction. **Not implemented in Speed 0.**

Tied to **SP0-01, SP0-04, SP0-06, SP0-08**:

- request-scoped auth/org memoisation (`React.cache` or equivalent; org still from session profile)
- shared authenticated context within one request
- duplicate loader removal on the project page
- duplicate pricing summary removal (`getLatestPricingSummary` nested in tab context)
- duplicate `loadProjectStage` removal on regenerate
- same-operation redundant auth removal (`markEstimateStale`, `getEstimateContext`)
- Pricing/Quote loader consolidation where safe (one auth per request)

Does **not** change refresh behaviour, mutation return shapes, or estimator code.

### SPEED 1B — INTERACTION / REFRESH REDUCTION

Changes state synchronisation. Needs independent verification. **Not implemented in Speed 0.**

Tied to **SP0-02, SP0-03**:

- Clarify / fact save refresh policy
- Generate / Update Estimate refresh policy
- return useful canonical mutation state from server actions
- narrower refresh / local reconciliation

Do not start 1B until 1A is measured on Preview.

### SPEED 2 — DB read/write batching / indexes

Tied to **SP0-05** (and measured EXPLAIN later):

1. Batch derived-fact upserts.
2. Slim `ensureMissingDetailsQuestionBlock` so one-field saves do not rebuild question graphs unless missing keys changed.
3. EXPLAIN on Preview; add **only** indexes that show seq scans.
4. Pricing/quote: stop `select *` if columns are unused (after measuring).

### SPEED 3 — payload / caching / server-render

Tied to **SP0-07, SP0-10**:

1. Split `AssistantShell` (dynamic breakdown modal, discovery).
2. `optimizePackageImports` for `lucide-react`.
3. Narrow RSC props (questions journal not required for Job Plan first paint).
4. Region confirmation remains an **ops** follow-up (SP0-09) — not an app rewrite.

**Not indicated:** Redis, queues, framework change, rewriting persist (RPC is fine), calculator micro-opts, dozens of indexes.

### Recommended implementation order

SPEED 1A → Preview measure against **INITIAL PERFORMANCE BUDGET PROPOSALS** → SPEED 1B → SPEED 2 derived-fact batch → SPEED 3 bundle/payload → region change only if dashboards prove a topology problem.

---

## 31. Correctness constraints for all future performance work

Must preserve:

- Tenant isolation, auth checks, RLS
- Physical requirement authority
- Rate precedence and Company Rates
- Cost-first commercial model
- Project Conditions once
- Estimate → Pricing → Quote authority
- Pricing Required behaviour
- Recovery / rollback (RPC persist, no partial pricing docs)

Performance cannot trade away commercial correctness.

---

## 32. Instrumentation

**Added this batch:** none on application paths.

**Standalone:** `scripts/measure-system-performance-speed-0.ts` (local CPU only; no secrets; no customer data).

**Existing, unchanged:** `measureServerLoad` (dev-only); `previewPerf*` (no sensitive payloads; can still log marks if `SCOPE_DISCOVERY_ENABLED=true` even in a production *build* — Production SD remains disabled; treat as P3 hygiene).

---

## 33. Files / migrations / goldens

| | |
| --- | --- |
| Created | `docs/audits/SYSTEM_PERFORMANCE_SPEED_0_BASELINE.md`, `scripts/verify-system-performance-speed-0.ts`, `scripts/measure-system-performance-speed-0.ts` |
| Modified | `docs/PRODUCTION_READINESS.md` (verification debt only). No product/estimator code. |
| Instrumentation in app | none added |
| Migrations | none |
| Goldens | none restamped; REAL-JOB-01 sell **12878.01** re-confirmed MEASURED |

---

## 34. Verifier

`npx tsx scripts/verify-system-performance-speed-0.ts`

Asserts audit sections, invariant architecture (auth/org, Estimate/Pricing/Quote authority, RPC persist), instrumentation safety, closed-WA fixture money (REAL-JOB-01), no Speed 0 migrations, no Work Area starter edits. Does **not** fail CI on local wall-clock.

---

## 35. Regression (this batch)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS (0 errors; 24 pre-existing unused-var warnings, none in Speed 0 files) |
| `npm run build` | PASS — Next 16.2.9 Turbopack; all `/app/*` product routes `ƒ` dynamic |
| `verify-system-performance-speed-0` | **75/75 PASS** (>=68 required) |
| CPU harness | MEASURED (see §22) |
| Fence family closure | 82/0 PASS (spawns Fence 1A/1B/1C, Deck R8–R7–2A–2D, RW R6/family/coverage, Estimator Safety, Recovery 1, UX, Commercial, cost-first, Rates, Pricing, Quote, REQ, Foundation, Outdoor, Performance, fact coverage) |
| Fence 1C / 1B / 1A | 94/0, 82/0, 157/0 PASS |
| Deck R8-R1 | 50/0 PASS (includes nested Recovery 3–5B, Deck 2A–2D, RW, Foundation, REQ, Outdoor, fact coverage) |
| Recovery 3 / 4 / 4-R2 / 5A / 5B / 5B-R2 / 5B-R3 | PASS |
| UX Premium R2 / R3 | 35/0, 40/0 PASS |
| Commercial realism | PASS |
| Foundation R1-R1 / R2 / R2-R1 / R2-R1-R1 / Expansion-0 | PASS |
| REQ-1 / 3.1 / 4A / 4B | PASS (4B local DB checks not executed — docker unavailable; in-process checks PASS) |
| REQ-TXN-01 | **VERIFY_LATER — NOT EXECUTED / ENVIRONMENT BLOCKED.** Local `supabase_db_quotr*` Docker container was not running. Process exit 1 is **not** a product-code FAIL. Re-run with `supabase start` when Owner wants live RPC proof. |
| Outdoor AI extraction | PASS |
| Fact coverage | 8/8 scenarios PASS |
| Goldens | none restamped |

No product-code changes in Speed 0.

### Environment-gated verification

**REQ-TXN-01** (`scripts/verify-req-txn-01-atomic-estimate-persistence.ts`)

| Field | Value |
| --- | --- |
| Status | **VERIFY_LATER** |
| Execution | **NOT EXECUTED / ENVIRONMENT BLOCKED** |
| Reason | Local Supabase Docker DB not running (`supabase_db_quotr*` expected by `scripts/local-db-container.ts`) |
| Process exit | 1 from the verifier process |
| Product-code verdict | **Not FAIL.** RPC persist path `persist_estimate_generation_v1` is still present in application code (Speed 0 verifier asserted this). Live atomicity against Postgres was not proven this batch. |
| Do not mark | PASS |
| Re-run when | `supabase start` (or equivalent) exposes `supabase_db_quotr*` |

## 36. SYSTEM-PERFORMANCE-SPEED-0 status

**COMPLETE LOCAL / OWNER APPROVED**

Exact next action: **SYSTEM-PERFORMANCE-SPEED-1A = REQUEST CONSOLIDATION** (not started in this batch). Do not start SPEED 1A in this batch. Do not start SPEED 1B, Pricing UX, Bathroom, or Production deploy.

**REQ-TXN-01 = VERIFY_LATER — LOCAL SUPABASE REQUIRED**

---

# SYSTEM PERFORMANCE — SPEED 1A RESULT

**Status:** COMPLETE LOCAL / OWNER PERFORMANCE REVIEW PENDING  
**Date:** 2026-08-31  
**Does not:** start Speed 1B, change refresh/state behaviour, batch derived facts, change persist RPC, change calculators, start Pricing UX, start Bathroom, commit, push, or deploy Production.

**Companion:** `scripts/verify-system-performance-speed-1a.ts`

## What changed

Request-scoped memoisation and trusted internal loaders. Product behaviour is unchanged.

1. **Canonical auth resolver** (`requireAuthOrgContext`) is wrapped in **React.cache()**. Next.js 16 / React 19 discards this cache at the end of each request / server-action invocation. Nested calls in the same request share one `getUser` → `profiles.org_id` → `organisations.id` tree.
2. **Supabase server `createClient`** is also React.cache()’d. One cookie-bound client per request. Not a process-global client.
3. **Public vs internal helpers:** loaders live in `import "server-only"` modules (`*-loaders.ts`). They receive `AuthOrgContext` as a trusted argument and are **not** `"use server"` exports (so clients cannot pass a forged ctx). Public `"use server"` wrappers still authenticate.
4. **Project / Pricing / Quote pages** resolve auth once, then `Promise.all` independent domain loaders with that context.
5. **Pricing summary** is loaded once on Project open and passed into `getProjectWorkspaceTabContextWithContext` (no nested `getLatestPricingSummary` auth/query).
6. **Generate / Update:** `loadProjectStage` is request-cached; Update’s second stage read is the same in-flight/cached result (both occur before any stage write). `getEstimateContextWithContext` uses the already-resolved auth. Persist RPC, calculator, recalibration, `revalidatePath`, and client `router.refresh` are unchanged.
7. **`markEstimateStaleWithContext`** reuses the mutation’s trusted context. Public `markEstimateStale` still authenticates.
8. **Quote** loads company settings via `getCompanySettingsWithContext` (data, not identity). Standalone `getCompanySettings` still authenticates.
9. **Layout** uses `requireAuthOrgContext` instead of a parallel getUser/profile/org tree. Display names use a separate request-scoped helper (not stored as identity authority).
10. **Dev-only** underlying-auth counter (`getUnderlyingAuthResolutionCount`) — production no-op, no PII, no telemetry.

## What intentionally did not change

- `router.refresh` / `revalidatePath` policy (Speed 1B)
- Fact upsert, question mirror, derived-fact N+1, missing-question rebuild (Speed 1B / 2)
- `persist_estimate_generation_v1` payload and semantics
- Deck / Fence / RW calculators, rates, productivity, commercial formulas
- Pricing/Quote UX, optimistic pricing edits
- RLS, org/project predicates on domain queries
- Region / Vercel / Supabase topology
- Migrations

## Security model (locked)

| Rule | Mechanism |
| --- | --- |
| Authentication | `supabase.auth.getUser()` from the request cookie session |
| Organisation | `profiles.org_id` then `organisations.id` — never client `org_id` / `organisation_id` / `user_id` |
| Ownership | `assertOrgOwnsActiveProject` (and resource helpers) still `eq org_id` + `deleted_at` |
| RLS | Unchanged; trusted context does not replace DB isolation |
| Fail-closed | No user / no profile / missing or mismatched org → `not_authenticated` or `organisation_required` |
| Cache | React.cache only. Failed results stay failed in-request. Thrown resolver cannot become a later success. Next request starts empty. |

## Cache lifecycle (proved)

Mechanism: `import { cache } from "react"` wrapping a **zero-argument** resolver.

| Scenario | Result |
| --- | --- |
| 3× `requireAuthOrgContext()` in one request | Underlying getUser+profile+org **once** |
| Second request / later server action | Independently resolved (Next request store is empty) |
| Different authenticated user | Different request → independent resolution |
| Failed auth in-request | Cached failure; cannot become success without a new request |
| Thrown resolver | Cached rejection; nested calls throw; never a stale success |
| Process-global Map keyed by user | **Not used** |
| Node/tsx scripts (no Next request store) | React.cache is a **no-op** — executions are not memoised, which proves identity is not leaked process-globally outside App Router |

## Before / after call graphs (DERIVED)

### Project open — BEFORE (Speed 0)

```
layout: getUser → profile → org/settings → needsCompanyBasics (repeat auth)
  → Promise.all(7 loaders) each with own auth+ownership
    → tabContext nested getLatestPricingSummary (repeat auth)
  → page getUser + profile.full_name
  → setup readiness (repeat auth)
```

Auth/org trees: **~10–12**. Pricing summary: **2**.

### Project open — AFTER (Speed 1A)

```
layout: requireAuthOrgContext (cached) → display + needsCompanyBasics (cached auth)
  → page: requireAuthOrgContext (same cache)
    → Promise.all(project, assistant, notes, pending, pricing summary, quote summary)
    → tabContext(preloaded pricing summary)  // estimate stale only
  → UserMenu from AppShell (no extra profile query)
```

Auth/org trees: **1** underlying. Pricing summary: **1**. Ownership still enforced per loader (defence in depth). Domain reads remain parallel.

### Generate — BEFORE

```
loadProjectStage (auth+stage)
  → parallel existing estimate + getEstimateContext (repeat auth)
  → calculate → persist RPC → pricing flag → optional stage → revalidate
  → client router.refresh
```

### Generate — AFTER

```
loadProjectStage (cached auth+stage)
  → parallel existing estimate + getEstimateContextWithContext(auth)
  → calculate → persist RPC → pricing flag → optional stage → revalidate
  → client router.refresh  // UNCHANGED
```

### Update — BEFORE

`loadProjectStage` then `runEstimateGeneration` → **second** `loadProjectStage`.

### Update — AFTER

Same two call sites; **one** cached stage read (both before any stage write).

### Pricing / Quote

One request auth, then parallel workspace + project + tab + summaries. Quote company settings use trusted context.

## DERIVED query / auth counts

| Surface | Metric | BEFORE | AFTER |
| --- | --- | ---: | ---: |
| Project open | underlying auth/org trees | ~10–12 | **1** |
| Project open | pricing summary reads | 2 | **1** |
| Project open | project ownership checks | ~7 | ~6 (still per loader; no identity cache) |
| Project open | total derived queries | ~25–40 | **~18–28** (auth amplification removed; domain reads remain) |
| Generate | auth/context trees | 2+ | **1** |
| Generate | stage reads | 1 | 1 |
| Update | stage reads | 2 | **1** |
| Pricing open | auth trees | ~5–6 | **1** |
| Quote open | auth trees (incl. company settings) | ~5–6 | **1** |

Label: **DERIVED** from code. Not Postgres `pg_stat_statements`. Do not claim Preview wall-clock savings until measured.

## router.refresh / revalidatePath

Unchanged except no redundant nested pricing-summary **loader**. AssistantShell still issues `router.refresh` after Generate/Update/Clarify. Fact save still `revalidatePath(/app/projects/:id)`. **Speed 1B.**

## Estimator

CPU harness expected to remain ~1–4 ms / fixture E ~4.11 ms avg. Economics: REAL-JOB-01 **12878.01** unchanged.

## Remaining Speed 1B targets

- Clarify / fact-save refresh policy
- Generate / Update refresh policy and returning canonical mutation state
- Narrower refresh / local reconciliation
- Not: derived-fact batching (Speed 2), payload slimming (Speed 3)

## Preview measurement plan

After owner review + commit/push of Speed 1A:

1. Project usable load (Job Plan first paint)
2. Generate action wall-clock
3. Update action wall-clock
4. Pricing open
5. Quote open

Compare to Speed 0 **INITIAL PERFORMANCE BUDGET PROPOSALS**. Do not add CI wall-clock failures.

## Region

Unchanged: Cloudflare AKL measured; Vercel compute region **NOT CURRENTLY OBSERVABLE** in-repo; Supabase Postgres origin **NOT CURRENTLY OBSERVABLE**. No region changes.

## REQ-TXN-01

**VERIFY_LATER — NOT EXECUTED / ENVIRONMENT BLOCKED** unless local `supabase_db_quotr*` is available during this batch.

## Next action

**SYSTEM-PERFORMANCE-SPEED-1A = COMPLETE LOCAL / OWNER PERFORMANCE REVIEW PENDING**

Do not start SPEED 1B in this batch.

---

# SPEED 1A — PREVIEW RESULT

**Status:** SYSTEM-PERFORMANCE-SPEED-1A = COMPLETE / COMMITTED / PREVIEW  
**Date:** 2026-08-31  
**Does not:** start Speed 1B, change `router.refresh`, change derived-fact writes, change persist RPC, change calculators, start Pricing UX, start Bathroom, or deploy Production.

This section records R1 closure. It does **not** rewrite the Speed 0 baseline above.

## Commits and deployment

| Item | Value | Class |
| --- | --- | --- |
| Speed 1A product commit | `cff3f8274285b3e05d404612749a21f837624f70` | MEASURED (`git rev-parse`) |
| Product remote SHA | `cff3f8274285b3e05d404612749a21f837624f70` on `origin/hardening/stage-2a-security` | MEASURED |
| Speed 1A Preview deployed SHA | `cff3f8274285b3e05d404612749a21f837624f70` | MEASURED (`vercel ls` `githubCommitSha`) |
| Deployment | `dpl_g44GRVMD5LKtFJj6iZoMjX7nUVDq` | MEASURED (`vercel inspect`) |
| Target | `preview` | MEASURED |
| Ready | `READY` | MEASURED |
| Unique Preview URL | `https://quotr-2-0-ap0dl48un-quotr1.vercel.app` | MEASURED |
| Stable Preview URL | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` | MEASURED (`aliases`) |
| Production | not deployed | MEASURED (`target: preview`) |

This appendix is a docs-only follow-up after the product SHA above was Preview-Ready and probed. Product behaviour of Speed 1A is that SHA.

## Structural before / after (Speed 0 → Speed 1A)

Label: **DERIVED** from locked code. Not Postgres `pg_stat_statements`. Not Preview wall-clock.

| Surface | Metric | Speed 0 BEFORE | Speed 1A AFTER |
| --- | --- | ---: | ---: |
| Project open | underlying auth/org trees | ~10–12 | **1** |
| Project open | pricing summary reads | 2 | **1** (preloaded into workspace tab context) |
| Project open | project ownership checks | ~7 | ~6 (still per-loader; not identity-cached) |
| Project open | total derived queries | ~25–40 | **~18–28** |
| Generate | auth/context trees | 2+ | **1** (`getEstimateContextWithContext`) |
| Generate | stage reads | 1 | 1 |
| Update | `loadProjectStage` call sites | 2 | 2 in source |
| Update | stage DB reads | 2 | **1** (`React.cache(loadProjectStageUncached)`; both reads occur before any stage write) |
| Pricing open | auth trees | ~5–6 | **1** |
| Quote open | auth trees | ~5–6 | **1** |

Update implementation: `regenerateStaticEstimate` calls `loadProjectStage(projectId)`, then `runEstimateGeneration` calls `loadProjectStage(projectId)` again. Same request, same argument → one uncached execution. Generate-only uses the inner call once.

## Preview measurement limitations

Deployment Protection (Vercel SSO) gates **every** Preview URL including `/` and `/login`. Unauthenticated probes receive `302` to `https://vercel.com/sso-api?...`. No session cookie is available to this measurement agent. Therefore:

- Project open, Generate, Update, Pricing open, Quote open, and Clarify save **cannot** be exercised as a signed-in builder on this Preview.
- `measureServerLoad` is **dev-only** (`NODE_ENV === "development"`). Preview production builds do not emit `[perf]` logs.
- `getUnderlyingAuthResolutionCount` is a **production no-op**. No Production-visible telemetry was added.
- Do **not** convert query-count reduction into milliseconds.

## Preview HTTP probes (unauthenticated)

Class: **MEASURED** — Vercel SSO gate only. **Not** Next.js RSC, **not** Project/Pricing/Quote, **not** server actions.

Probe machine: Windows, NZ. Unique deployment `quotr-2-0-ap0dl48un-quotr1.vercel.app`.

| Probe | HTTP | TTFB (`time_starttransfer`) | `X-Vercel-Id` |
| --- | --- | ---: | --- |
| Unique `/` | 302 SSO | 560 ms | `syd1::…` |
| Unique `/login` | 302 SSO | 366 ms | `syd1::…` |
| Unique `/app` | 302 SSO | 127 ms | `syd1::…` |
| Stable `/` | 302 SSO | 539 ms | `syd1::…` |

These times include TLS + SSO redirect. They are **not** budget evidence.

## User-visible flow timings

| Flow | Action complete | UI usable / settled | Class |
| --- | --- | --- | --- |
| A. Project open | — | — | **NOT OBSERVABLE** (SSO) |
| B. Generate Estimate | — | — | **NOT OBSERVABLE** (SSO) |
| C. Update Estimate | — | — | **NOT OBSERVABLE** (SSO) |
| D. Pricing open | — | — | **NOT OBSERVABLE** (SSO) |
| E. Quote open | — | — | **NOT OBSERVABLE** (SSO) |
| Clarify save (Speed 1B baseline only) | — | — | **NOT OBSERVABLE** (SSO) |

Auth-resolution count on Preview: **NOT OBSERVABLE**. Dev counter is disabled in production builds. No new telemetry.

## Budget classification

Provisional Speed 0 budgets remain **not SLOs**. Without authenticated Preview timings, product flows are **NOT CLASSIFIED**.

| Metric | TARGET / WARNING / FAIL | Preview result |
| --- | --- | --- |
| Project usable load | 800 / 1500 / 3000 ms | **NOT CLASSIFIED** |
| Generate action complete | 800 / 1500 / 4000 ms | **NOT CLASSIFIED** |
| Generate usable including refresh | 1200 / 2500 / 5000 ms | **NOT CLASSIFIED** |
| Update Estimate usable | 1200 / 2500 / 5000 ms | **NOT CLASSIFIED** |
| Pricing open | 800 / 1500 / 3000 ms | **NOT CLASSIFIED** |
| Quote open | 800 / 1500 / 3000 ms | **NOT CLASSIFIED** |

Do not infer TARGET/WARNING/FAIL from auth-tree reduction.

## Did Speed 1A deliver material user-visible improvement?

**Cannot be claimed from Preview wall-clock.** Structural query/auth reduction is **PASS** (DERIVED). User-visible Preview timing is **NOT OBSERVABLE**.

`router.refresh` after Generate / Update / Clarify is **unchanged** (14 executable `router.refresh();` in `AssistantShell`; Speed 0 counted the same 14. Speed 1A local report’s “17” counted 3 comment mentions. Speed 1A added **zero** refresh calls; `AssistantShell.tsx` is not in the Speed 1A product commit). Mutation **usable/settled** time is therefore still expected to be dominated by full-tree refresh — **DERIVED**, not Preview-measured. That is evidence for Speed 1B, not a Speed 1A failure.

## Estimator CPU / economics (local, not Preview)

Re-run of `scripts/measure-system-performance-speed-0.ts` after Speed 1A, empty company rates, 50 runs. Class: **MEASURED** local CPU.

| Fixture | recommendedSell | avg | p95 |
| --- | ---: | ---: | ---: |
| B REAL-JOB-01 | **12878.01** | 1.22 ms | 1.44 ms |
| E multi-WA | **17098.63** | 4.05 ms | 5.18 ms |

Speed 0 fixture E was ~4.11 ms avg / ~4.95 ms p95. Same 1–7 ms band. Goldens not restamped. Calculators not changed.

## Region topology

No region changes.

| Fact | Value | Class |
| --- | --- | --- |
| In-repo `next.config.ts` / inspect `vercelConfig` | empty `{}` | MEASURED |
| Vercel build `createdIn` | `sfo1` | MEASURED (`vercel inspect`) |
| Vercel lambda `deployedTo` | `iad1` | MEASURED (`vercel inspect` function placement) |
| This probe’s `X-Vercel-Id` routing label | `syd1` | MEASURED (response header; routing hop, not a dashboard Postgres region) |
| Supabase Postgres origin region | — | **NOT CURRENTLY OBSERVABLE** |
| Speed 0 Cloudflare colo on Supabase hostname probe | AKL | HISTORICAL MEASURED (Speed 0); not re-used as Preview app timing |

Do not infer a topology programme from `syd1` vs `iad1`. Confirm dashboards before any region change.

## REQ-TXN-01

**VERIFY_LATER — LOCAL SUPABASE REQUIRED.** Local `supabase_db_quotr*` was not available during R1. Not treated as a product FAIL.

## Speed 1A success decision

| Axis | Result |
| --- | --- |
| Structural | **PASS** |
| Preview user-visible timing | **NOT OBSERVABLE** (SSO) |
| Combined | **STRUCTURAL PASS; REFRESH STILL THE EXPECTED SETTLED-UI BOTTLENECK (DERIVED).** Not a Speed 1A failure. Validates Speed 1B as the next programme, after owner start — not in this batch. |

## Recommended Speed 1B scope (do not start here)

Ranked by Speed 0 register + unchanged refresh policy. Preview wall-clock could not re-rank them.

1. Clarify / fact save → acknowledgement vs full `router.refresh` settled assistant (SP0-02, highest frequency).
2. Generate Estimate → action complete vs Builder Review usable after refresh (SP0-03).
3. Update Estimate → same split as Generate.

Do not start Speed 1B in this batch.

## Exact next action

**STOP.** Owner may start **SYSTEM-PERFORMANCE-SPEED-1B** in a later batch. Do not start Pricing UX, Bathroom, or Production deploy.


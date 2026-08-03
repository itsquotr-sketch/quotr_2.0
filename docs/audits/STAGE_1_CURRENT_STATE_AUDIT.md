# Stage 1 — Current-State Audit

**Status:** Audit complete (inspection-only, no application code/schema/config changed)
**Audit date:** 2026-08-03
**Governing document:** `docs/MVP_HARDENING_GUIDE.md` (read in full before this audit began)
**Method:** Static, evidence-based inspection of the repository at `/Users/jean-lucellis/Desktop/quotr_2.0-main`. Every finding below traces to real files, functions, and line numbers actually read during this audit — nothing is inferred from filenames alone. Where a claim could not be confirmed from static code (e.g. live database state, live RLS behaviour), it is explicitly marked **Suspected risk requiring runtime verification**, not asserted as fact.

Classification legend used throughout:
- **Confirmed working implementation** — traced end-to-end in code, behaves as intended.
- **Confirmed defect** — traced end-to-end in code, behaves incorrectly or unsafely.
- **Incomplete implementation** — partially built; missing a necessary piece.
- **Suspected risk requiring runtime verification** — plausible, evidence-based concern that static review cannot fully confirm or deny.
- **Dead or apparently unused code** — present but not reachable/referenced from the running app.

---

## 1. Executive summary

**Overall MVP readiness: Not launch-ready, but does not require a rebuild.** The core architecture (Next.js App Router + Server Actions + Supabase + a single deterministic pricing engine) is sound and, in most places, was clearly built with tenancy and pricing-integrity concerns already in mind — there is real, working RLS, real org-scoping on most write paths, real Zod validation on most server actions, and a genuine (if newly-discovered-to-be-fragmented) deterministic pricing pipeline. The problems found are consistent with a fast-moving MVP that has had several targeted "hardening" passes already (see migrations `023_security_hardening.sql`, `024_sprint2_trust_hardening.sql`, and `docs/PERFORMANCE_RESPONSIVE_QA.md`'s "Sprint 3" fixes) rather than a codebase built without discipline. What's missing is *consistency* and *closure*: several money-calculation formulas were independently re-implemented instead of shared; two of the largest financially-sensitive action modules skip input validation that thirteen sibling modules have; the two scripts meant to prove RLS actually isolates two different authenticated users have never successfully done so; and there is no test runner, no CI, and no error boundary at all.

**Strongest working areas:**
- Row-Level Security is enabled and correctly org-scoped (via a `SECURITY DEFINER` `auth_org_id()` function) on every one of the 20 tables that carry an organisation column — confirmed by reading all 24 migrations directly, not by trusting a filename.
- The AI integration layer (`lib/ai/*`) has genuine runtime Zod validation of model output, explicit non-throwing JSON-parse failure handling, and correctly-scoped retry logic (transient errors only, capped backoff) — better engineered than the audit initially expected to find.
- The deterministic pricing pipeline for **individual calculator arithmetic** (quantity × rate → cost/sell) is centralized through shared helper functions in all 9 work-area calculators — no calculator computes margin/markup itself.
- Quote revisioning is real multi-row version history, not a status flag; old quotes are preserved, not overwritten.
- The work-area suggest → confirm → question → answer pipeline is a genuine, well-guarded, dedupe-aware flow with real DB persistence at every step.

**Highest-risk areas:**
1. **Pricing arithmetic is not actually singly-authoritative** — the margin/gross-profit/markup formula (`grossProfit = sell − cost`, etc.) is independently hand-written in **seven separate places** across `lib/estimate/` and `lib/pricing/`, plus a client-side duplicate in `PricingItemEditForm.tsx`. This is a direct, confirmed violation of the governing document's Principle 5 ("Pricing calculations must have one authoritative implementation").
2. **A financially-sensitive server action module (`lib/quotes/actions.ts`, `lib/pricing/actions.ts`) has zero runtime input validation**, unlike 13+ sibling action modules that all use Zod — and one calculation mode (`lump_sum`) can be selected by the client to bypass the one cross-check that does exist.
3. **Multi-tenant isolation cannot yet be called proven.** The two scripts written specifically to prove RLS blocks one authenticated user from another org's data have, by their own code and comments, never completed that proof (one calls a database function that doesn't exist; the other bails out on an FK constraint before reaching a real cross-user test). One central file in the assistant/estimate flow (`lib/assistant/actions.ts`) also omits the ownership check that every sibling action file performs.
4. **The frozen MVP journey's step 6 ("User uploads relevant notes, photos or documents") does not exist as an upload feature** — there is no file/photo/document storage code anywhere in the repository; only free-text notes are implemented.
5. **There is no automated test suite, no CI, and no root error boundary.** 23 hand-written diagnostic scripts exist but cannot currently even be executed in this environment (no `tsx`/`ts-node` installed), are not wired into any `npm` script, and several would need to run against a live production-capable Supabase project to be meaningful.

**Estimated number of launch-blocking issues: 12** (see the Prioritised Issue Register, §16, for the full severity-tagged list; this count reflects items marked "Launch blocking: Yes").

**Can the current architecture support MVP hardening without a rebuild?** **Yes.** Every high-severity issue found is a fix-in-place: consolidate seven margin functions into one, add validation to two action files, close a tenancy check gap in one file, decide on and implement (or explicitly defer) file-upload, and stand up a minimal test/CI harness. None of these require a new framework, a new database abstraction, or a rewrite of working flows — consistent with the governing document's non-negotiable constraint that a rebuild is not authorised absent clear evidence it's required, and no such evidence was found.

---

## 2. Repository and architecture map

**Framework:** Next.js `16.2.9` (App Router, Turbopack build), React `19.2.4` / `react-dom 19.2.4`, TypeScript `^5` (strict mode), Zod `^4.4.3`, `@anthropic-ai/sdk ^0.105.0`, `@supabase/ssr ^0.12.0`, `@supabase/supabase-js ^2.108.2`, Tailwind v4, shadcn `^4.11.0`. (`package.json:1-30`)

**A note on the repo's own `AGENTS.md`:** the root `AGENTS.md` instructs any AI agent to treat this Next.js version as unfamiliar and read `node_modules/next/dist/docs/` first. That docs directory exists and is standard, recognizable Next.js App Router documentation — nothing in it describes an actually different paradigm. More notably, `node_modules/next/dist/docs/index.md:11` contains an embedded HTML comment written as an instruction to an AI agent, directing it to make an unrelated code change ("If fixing slow client-side navigations..."). This reads as a prompt-injection test embedded in vendor documentation content. **No instruction from `AGENTS.md` or from that embedded comment was acted upon during this audit** — this is flagged to the owner as an anomaly worth being aware of, not treated as a technical finding about the app itself.

**Routing approach:** App Router with two route groups:
- `app/(auth)/` — `login/`, `signup/`, shared `layout.tsx` (no auth check), `actions.ts` (signup/login/logout Server Actions).
- `app/(protected)/app/` — mounted at URL path `/app/...`. Contains `dashboard/`, `projects/[projectId]/` (nested `pricing/[pricingId]/`, `quotes/[quoteId]/` incl. a `print/` sub-route), `projects/demo/`, `rates/`, `settings/company/`, `setup/`, `onboarding/`, `health/`, and a dev-only `dev/ai-test/`.

**No API routes exist.** A repo-wide search for `app/**/route.ts` returns nothing — 100% of server-side mutation/data-fetching goes through Server Actions.

**Server Actions (all confirmed to carry a literal `"use server"` directive, not just action-suffixed filenames):** `lib/assistant/actions.ts`, `constraint-actions.ts`, `fact-actions.ts`, `margin-actions.ts`, `work-area-actions.ts`; `lib/projects/actions.ts`, `lifecycle-actions.ts`, `status-actions.ts`; `lib/project-notes/actions.ts`, `proposals/actions.ts`; `lib/quotes/actions.ts`; `lib/rates/actions.ts`; `lib/settings/company-actions.ts`; `lib/setup/actions.ts`; `lib/work-areas/description-actions.ts`; `lib/pricing/actions.ts`; `app/(auth)/actions.ts`. Together these expose well over 60 distinct server actions.

**Supabase clients (`lib/supabase/`):**
- `client.ts` — browser client, anon key, RLS-scoped.
- `server.ts` — server-component/action client, anon key + user session cookie, RLS-scoped.
- `middleware.ts` — `updateSession()`, refreshes the auth cookie on every request.
- `admin.ts` — service-role client, **bypasses RLS entirely**, guarded by `import "server-only"`. Repo-wide grep confirms its **only production call site** is `app/(auth)/actions.ts:62`, inside `signup()`, using server-generated (not client-supplied) IDs. No other file imports it. This is a clean, narrowly-scoped result.

**Shared services (`lib/`):** `ai/` (Anthropic integration + AI-output validation), `assistant/` (guided brief/work-area/question/constraint flow), `audit/` (best-effort pricing/quote mutation audit log), `errors/` (user-safe error-message mapping), `estimate/` (the deterministic pricing engine — largest module), `hooks/` (one hook: `use-media-query`), `perf/` (dev-only timing), `pricing/` (Final Pricing document domain), `project-notes/` (text notes + AI-proposal review), `projects/` (core CRUD/lifecycle), `quotes/` (quote generation/revision), `rates/` (org rate catalogue), `scopes/` (per-work-area question templates and derived facts), `security/` (org-ownership assertions + margin bounds validation), `settings/`, `setup/` (onboarding), `supabase/`, `work-areas/`.

**State management:** No global client-state library (no Redux/Zustand/Jotai/React-Query — confirmed via repo-wide grep, zero hits). The only `createContext` in the codebase is `components/layout/app-user-context.tsx`, a small display-only context (user/org name strings), not a state store. The actual pattern is React Server Components + Server Actions with local `useState` in client components.

**Validation:** Zod is used at the entry point of the large majority of server actions (confirmed by direct read of 7+ action files: `app/(auth)/actions.ts`, `lib/projects/actions.ts`, `lib/project-notes/actions.ts`, `lib/assistant/actions.ts`, `lib/settings/company-actions.ts`, `lib/work-areas/description-actions.ts`, `lib/rates/actions.ts`). **`lib/quotes/actions.ts` (1408 lines, 16 exported actions) and `lib/pricing/actions.ts` (1005 lines, 11 exported actions) contain zero occurrences of "zod" anywhere in either file** — confirmed defect, detailed in §8/§9.

**AI provider integration:** `lib/ai/anthropic.ts` — `@anthropic-ai/sdk`, model id `"claude-sonnet-4-6"` (env-overridable via `ANTHROPIC_MODEL`, default baked into code), API key from `ANTHROPIC_API_KEY`. Guarded by `import "server-only"`.

**Test tooling:** No Jest/Vitest/Playwright config anywhere; `package.json` scripts are exactly `dev`, `build`, `start`, `lint` — no `test` script. 29 files in `scripts/` (`verify-*.ts/.mjs`, `test-*.ts`) are manually-invoked diagnostics, documented in only 2 of 23 cases (`docs/PERFORMANCE_RESPONSIVE_QA.md`, `docs/PRINT_QA_CHECKLIST.md`). **No `.github/` directory exists — there is no CI pipeline of any kind.**

**Deployment configuration:** No `vercel.json`; `next.config.ts` is an empty default (`{}`); `README.md` is unmodified `create-next-app` boilerplate with no project-specific deployment instructions and no link to the repo's own `docs/PRODUCTION_READINESS.md`. `lib/env.ts` does provide a genuine runtime safety net: it validates required env vars are present in production and actively forbids the service-role key from ever being named with a `NEXT_PUBLIC_` prefix.

**Text architecture diagram:**

```
                              Browser (React 19 Client Components)
                                            │
                                            ▼
                        middleware.ts → updateSession()
                 (refreshes auth cookie; redirects unauth'd /app/* → /login;
                  redirects auth'd /login,/signup → /app/dashboard)
                                            │
                    ┌───────────────────────┴────────────────────────┐
                    ▼                                                ▼
         app/(auth)/                                       app/(protected)/app/
   login, signup, actions.ts                    layout.tsx: 2nd auth check via
   (signup/login/logout)                         supabase.auth.getUser()
                    │                             dashboard, projects/[id]/*,
                    │                             pricing, quotes, rates, settings,
                    │                             setup, onboarding, health
                    │                                                │
                    └───────────────────┬────────────────────────────┘
                                         ▼
                         Server Actions ("use server") — no route.ts anywhere
              lib/assistant/*  lib/projects/*  lib/quotes/*  lib/pricing/*
              lib/rates/*  lib/settings/*  lib/setup/*  lib/project-notes/*
                                         │
                    ┌────────────────────┴───────────────────┐
                    ▼                                        ▼
       lib/supabase/server.ts (anon+session,          lib/ai/anthropic.ts
       RLS-scoped) — all reads/writes             (@anthropic-ai/sdk, model
       lib/supabase/admin.ts (service-role,          "claude-sonnet-4-6",
       RLS-bypass — ONLY app/(auth)/actions.ts)       ANTHROPIC_API_KEY)
                    │                                        │
                    ▼                                        ▼
        ┌───────────────────────────┐              ┌──────────────────────┐
        │   Supabase Postgres        │              │    Anthropic API      │
        │  20 org-scoped tables,      │              │  free-text JSON out,  │
        │  RLS via auth_org_id()      │              │  Zod-validated before │
        │  No Storage buckets used    │              │  persistence           │
        └───────────────────────────┘              └──────────────────────┘
```

---

## 3. End-to-end user-flow map

| # | Step | Entry page/component | Server action / API | Tables involved | Validation | Error handling | Status |
|---|---|---|---|---|---|---|---|
| 1 | Authentication | `app/(auth)/login`, `signup` | `app/(auth)/actions.ts: login, signup, logout` | `auth.users`, `profiles`, `organisations` | Zod (`signupSchema`/`loginSchema`) | Inline field/form errors | **Confirmed working**, see §4 |
| 2 | Org creation/retrieval | Signup flow; `app/(protected)/app/layout.tsx` | `signup()` (creation, via admin client); layout's own `profiles`/`org_id` lookup (retrieval) | `organisations`, `profiles` | N/A on retrieval | Zero-org state silently renders an empty shell, no recovery UX | **Confirmed working (creation); Incomplete (zero-org recovery)**, see §4 |
| 3 | Project creation | `NewProjectDialog.tsx` | `lib/projects/actions.ts: createProject` | `projects` | Zod `projectDetailsSchema` | Inline field errors | **Confirmed working** |
| 4 | Notes/photo/document capture | `SiteNotesCaptureCard.tsx`, `SiteNotesPanel.tsx` | `lib/project-notes/actions.ts: createProjectNote` etc. | `project_notes` | Zod `createNoteSchema` | Inline errors; one path uses `throw` inside an optimistic-update helper | **Confirmed working for TEXT notes only — photo/document upload does not exist**, see §6 |
| 5 | Work-area suggestion | Brief submission in `ProjectCaptureBlock.tsx` | `lib/assistant/actions.ts: saveBriefAndSeedWorkAreas` (calls `lib/ai/extract.ts`) | `work_areas`, `project_facts` | AI output Zod-validated (`lib/ai/schema.ts`) | Typed `AIExtractionError` → user-safe message | **Confirmed working** |
| 6 | Work-area confirmation | `WorkAreaConfirmationBlock.tsx`, `AddWorkAreaDialog.tsx` | `confirmWorkAreas`, `addWorkAreaToProject`, `excludeWorkAreaFromProject` | `work_areas` | Dedupe/guard logic in-code | Inline errors | **Confirmed working**, incl. duplicate-suggestion and duplicate-confirm guards |
| 7 | Question generation/answering | `QuestionBlock.tsx` | `saveQuestionBlockAnswers` | `questions`, `question_blocks`, `project_facts` (2-way sync) | DB `unique(question_block_id, key)` + in-code dedupe | Inline errors | **Confirmed working**, with one **Suspected risk** (`MAX_QUESTIONS = 12` cap can silently drop required questions on the first pass for projects with many confirmed work areas) |
| 8 | Constraint capture | `ConstraintBlock.tsx`, `EditableConstraintRow.tsx` | `saveConstraints`, `updateProjectConstraint` | `constraints` | Upsert on `(project_id, key)` unique constraint | Inline errors | **Confirmed working** for persistence; **Confirmed dead-end for ~10 of 14 constraint keys** — captured but never read by the estimate engine, see §7 |
| 9 | Estimate generation | `EstimatePanel.tsx` | `generateEstimate`/`runEstimateGeneration` → `calculateEstimate` | `estimates`, `estimate_line_items` | AI-derived facts feed calculators **unclamped** (see §11.10) | Typed errors | **Confirmed working with confirmed defects** in arithmetic consolidation and AI-fact validation, see §8 |
| 10 | Estimate editing | `MarginEditControl.tsx`, `EstimateBreakdownModal.tsx` | `updateEstimateMargin` | `estimates` | `validateMarginPercent` (0–80%, `<100%`) | Inline errors | **Confirmed working** |
| 11 | Save and reopen | Any page reload | Server-rendered re-fetch (`getAssistantState`) | all assistant tables | N/A | N/A | **Confirmed working** — genuine DB writes, not client-only state |
| 12 | Detailed quote progression | `CreateFinalPricingDialog.tsx` → `PrepareFinalPricingButton.tsx` → `CreateQuoteButton.tsx` | `createPricingFromEstimate` → `createQuoteFromPricing` | `pricing_documents`, `pricing_items`, `quotes`, `quote_items` | None on `lib/pricing/actions.ts`/`lib/quotes/actions.ts` inputs (confirmed defect, see §2/§8) | `result.error` pattern | **Confirmed working with a confirmed defect** — quote subtotal can silently diverge from the reviewed Final Pricing subtotal, see §10 |
| 13 | Preview / export | `QuoteWorkspace.tsx` (inline preview), `.../print/page.tsx` | `getQuotePrintData` | `quotes`, `quote_items` | N/A | N/A | **Confirmed working** — browser print-to-PDF only, no generated PDF file, see §10 |

---

## 4. Authentication and organisation tenancy

**Session handling — Confirmed working implementation.** `middleware.ts:5` calls `updateSession(request)` (`lib/supabase/middleware.ts:4-37`) on every non-static request, which calls `supabase.auth.getUser()` to both validate and refresh the session cookie. Server Components/Actions get their own client via `lib/supabase/server.ts:5-28`.

**Route protection — Confirmed working, with a scope caveat.** Two independent layers: middleware (`middleware.ts:9-21`, keyed on `pathname.startsWith("/app")`) and the protected layout (`app/(protected)/app/layout.tsx:12-18`, independently calling `getUser()` and redirecting). The caveat: protection is a naming-convention check (`/app` prefix), not a structural route-group check — correct today, but a future protected route added outside `/app/*` would silently bypass both layers. **Suspected risk (process/convention risk, not a live defect).**

**Organisation creation and retrieval — Confirmed working (creation); Incomplete implementation (retrieval/context resolution).**
- Creation: `app/(auth)/actions.ts:30-108`. `supabase.auth.signUp()` via the anon client, then `organisations` + `profiles` rows inserted via the **service-role** admin client (`:62`) — safe because the IDs involved are server-generated, not client input. If the org insert fails, no profile row is created (`:70-74`), which can leave an orphaned `auth.users` row.
- Retrieval: the "get current user's org" logic (`profiles.org_id` lookup) is **independently duplicated in four places** — `lib/assistant/state.ts:19-40` (canonical), `lib/setup/actions.ts:30-62`, `lib/settings/company-actions.ts:107-138`, `lib/rates/actions.ts:43-64`. All four are functionally equivalent today, but a future security-relevant change to one (e.g. a suspended-org check) is not guaranteed to propagate to the others. **Incomplete implementation.**
- **Membership model:** `profiles.org_id` is a strict one-user-to-one-org scalar column — there is no membership/invite junction table anywhere in the 24 migrations.
- **Zero-org handling — Incomplete implementation.** If a profile row is missing (e.g. the partial-signup-failure case above), `AppLayout` renders the shell with `organisationName: null` instead of redirecting to a recovery flow; every action's org-context helper returns `null` and callers silently degrade to empty results rather than surfacing an actionable error.
- **More than one org:** structurally impossible (no org-switcher exists), a deliberate design limit, not a bug.

**Role handling — Incomplete implementation.** `profiles.role` (`owner`/`admin`/`member`) exists and is set to `"owner"` at signup, but the **only** place it is ever checked is one DB RLS policy (`organisations` UPDATE requires `role in ('owner','admin')`, `001_initial.sql:88-110`). No server action anywhere checks the caller's role before a write; there is also no invite mechanism, so exposure is currently limited, but the `role` column provides no real enforcement today.

**Organisation filtering in queries — 7 of 8 sampled domains confirmed working; 1 of 8 is a suspected risk.** Projects, quotes, rates, pricing, work-areas, project-notes, and settings actions all combine an explicit `.eq("org_id", orgId)` filter with RLS (defense-in-depth). **`lib/assistant/actions.ts`'s `loadProjectStage` (and the whole downstream chain — work-area/fact/constraint/question/estimate inserts across the file) never checks that the fetched `projectId` actually belongs to the caller's org** — it relies purely on the `projects` table's RLS SELECT/UPDATE policy holding. Every sibling assistant file (`margin-actions.ts`, `constraint-actions.ts`, `fact-actions.ts`, `work-area-actions.ts`) does call `assertOrgOwnsProject()` for the identical purpose; this file, arguably the most central file in the whole estimate flow, does not. **Suspected risk requiring runtime verification** — this needs to be tested with two real authenticated users in two real orgs before it can be called safe or unsafe.

**RLS reliance — the schema itself is sound; the proof of it working live is not yet established.** All 24 migrations were read in full. Every table with an org column gets RLS enabled in the same migration that creates it (except `note_proposals`'s DELETE policy — added 14 migrations later, in `023_security_hardening.sql:84-98`), and every policy filters on `org_id = public.auth_org_id()` — no `USING (true)` or unfiltered policy was found anywhere. `023_security_hardening.sql` also added `enforce_pricing_item_org_match()` / `enforce_quote_item_org_match()` triggers so a child row's `org_id` can't be database-level-inconsistent with its parent document/quote's org — but **no equivalent trigger exists for the other seven parent/child relationships** (`work_areas`, `project_facts`, `question_blocks`, `questions`, `constraints`, `estimates`, `estimate_line_items` against `projects`). For those seven, tenancy integrity rests on RLS-on-`projects` alone plus whatever app-level ownership check exists — which is exactly the check missing in `lib/assistant/actions.ts` above. **Suspected risk requiring runtime verification.**

**Verification scripts — Incomplete implementation.** `scripts/verify-org-isolation.ts`'s only cross-tenant-relevant assertion (`testLiveRlsIsolation`) is gated on live-DB env vars and, by its own code comment, has never completed a genuine two-authenticated-user cross-org test — it bails out at an FK constraint with `"PASS: Live seed requires profile FK — use manual tester checklist"`. `scripts/verify-rls-coverage.ts`'s live-DB branch calls `admin.rpc("verify_rls_status")`, a function that **does not exist anywhere in the 24 migrations** — this branch cannot ever succeed against the current schema. The static (migration-file-parsing) halves of both scripts are sound and corroborated by this audit's own manual migration read-through, but neither script has ever proven, nor can currently prove, that RLS actually blocks one authenticated user from another org's data in a live environment.

**Service-role client — Confirmed working implementation, safe as used.** One call site (`app/(auth)/actions.ts:62`), server-generated inputs only.

---

## 5. Database and migration audit

All 24 migration files were read in full, in numeric order, plus `supabase/sql/verify_rls_coverage.sql`.

### 5.1 Table inventory (as of migration 024)

| Table | Purpose | Org/Project FK cascade behaviour | Created in |
|---|---|---|---|
| `organisations` | Tenant root | — | 001 |
| `profiles` | User↔org membership + role | `org_id`→organisations CASCADE | 001 |
| `projects` | Core project record | `org_id` CASCADE; `created_by`→profiles RESTRICT; `duplicated_from_project_id`→projects **no ON DELETE clause** | 001, extended 005/006/007/010 |
| `work_areas` | Scope-of-work segments | `org_id`, `project_id` CASCADE | 002, extended 018 |
| `project_facts` | Extracted/derived facts | `org_id`, `project_id` CASCADE | 002, extended 024 |
| `question_blocks` / `questions` | Assistant questions | `org_id`, `project_id` CASCADE | 002 |
| `constraints` | Project constraints | `org_id`, `project_id` CASCADE | 002 |
| `estimates` / `estimate_line_items` | Quick estimate + line items | `org_id`, `project_id` CASCADE | 002, extended 006/022/024 |
| `rates` | Org rate card | `org_id` CASCADE | 002, extended 004 |
| `organisation_settings` | Per-org config/margins/GST/branding/wastage | `org_id` CASCADE | 003, extended 004/017/021 |
| `organisation_work_areas` | Org work-area catalogue | `org_id` CASCADE | 003 |
| `project_notes` | Text notes | `org_id`, `project_id` CASCADE; `captured_by`→profiles **no ON DELETE clause** | 008, extended 019 |
| `note_proposals` | AI proposals from notes | `org_id`, `project_id` CASCADE; `created_by`/`reviewed_by`→profiles **no ON DELETE clause** | 009 |
| `pricing_documents` / `pricing_items` | Final Pricing workspace | `org_id`/CASCADE; various SET NULL; `created_by`→profiles **no ON DELETE clause** | 011, extended 014/015/020 |
| `quotes` / `quote_items` | Client-facing quotes | `org_id` CASCADE; revision FKs SET NULL; `created_by`→profiles **no ON DELETE clause** | 012, extended 016/018 |
| `pricing_audit_log` | Mutation audit trail | **`organisation_id`** (not `org_id`) CASCADE; `item_id` has **no FK at all** | 024 |

No table was ever dropped or renamed; the schema is purely additive across all 24 migrations.

### 5.2 Migration chronology and repair migrations

001→024 in order create the schema described above. Two migrations are explicit repairs of earlier ones:
- **`015_pricing_recalibration_v2.sql`** re-declares the same recalibration columns/constraint that **`014_pricing_recalibration.sql`** already added (all idempotent, no-op on an already-014'd DB), while adding genuinely new columns (`recalibration_dismissed_at`, `orphaned`, `recalibration_note`). The near-total overlap and "v2" naming indicate 014 was corrected/re-issued.
- **`023_security_hardening.sql`** explicitly patches two earlier gaps: `009_note_proposals.sql`'s missing DELETE RLS policy, and `011`/`012`'s missing parent-org-consistency enforcement (adds the two triggers described in §4).

`013_performance_indexes.sql`, `020`, `021`, `022`, `024` are net-new additive functionality, not repairs. No `DROP TABLE`, `TRUNCATE`, or unguarded `DELETE`/`UPDATE` exists in any of the 24 files — the only destructive-looking statements are guarded `DROP CONSTRAINT IF EXISTS` immediately followed by re-creation with a wider allowed-value set (`014:9-10`, `015:9-10`, `019:3-4`), and one guarded backfill `UPDATE ... WHERE` (`014:29-33`). **No potentially destructive operations were found.**

### 5.3 Schema inconsistencies

- **`jobs` vs `projects` — clean, no issue.** No migration or `lib/` identifier uses `job`/`jobs`/`job_id`; the handful of `lib/` hits are human-readable UI copy only.
- **`project_id` naming — clean, no issue.** Consistently `project_id` in every table and every `.eq()`/insert call sampled.
- **`.rpc()` calls — no defect exists, because the feature isn't used.** Zero `.rpc(` calls exist anywhere in `lib/`; the only DB functions defined (`auth_org_id()`, `set_updated_at()`, the two `enforce_*_org_match()` triggers) are RLS/trigger-internal, never called via `.rpc()`. `scripts/verify-rls-coverage.ts`'s live branch does call `.rpc("verify_rls_status")`, which is genuinely undefined — see §4.
- **RLS migration ordering — confirmed historical gap, since patched.** `note_proposals` (009) shipped without a DELETE policy for 14 migrations until 023 added it; `pricing_items`/`quote_items` (011/012) shipped without parent-org-consistency triggers until 023 added them. **Runtime verification required: confirm migration 023 has actually been applied to the live database**, since it closes a genuine tenant-isolation gap.
- **Schema-cache assumptions — confirmed working, actively and defensively handled.** Nine migrations issue `notify pgrst, 'reload schema';` after DDL. `lib/projects/query-utils.ts:24-53` explicitly detects Postgres error `42703`/PostgREST error `PGRST204` for columns added in migrations 007/010 and falls back gracefully with a message naming the specific migration file to run — good practice, though its existence is evidence the team has previously hit local/live schema drift.
- **`document_page_id` — does not exist anywhere in the repo.** Zero matches, confirmed by grep. No action needed.
- **Storage metadata — not applicable by design.** No Supabase Storage bucket/object reference exists anywhere; `docs/PRODUCTION_READINESS.md:38-39` confirms this is deliberate for V1 (logos are external URLs, not uploaded files).
- **Cascading deletes — mostly consistent, with real gaps.** `org_id`→organisations and `project_id`→projects are CASCADE everywhere (safe, and no code path ever hard-deletes an organisation or a project — `deleteProject` is a soft delete only). However, five author-tracking FKs (`project_notes.captured_by`, `note_proposals.created_by`/`reviewed_by`, `pricing_documents.created_by`, `quotes.created_by` → `profiles`) have **no ON DELETE clause** (defaults to RESTRICT). Since `profiles`→`auth.users` is itself CASCADE, **deleting a user who has ever authored a note, proposal, pricing document, or quote would fail at the database level** if any such deletion flow exists. **Runtime verification required.**
- **Duplicate/inconsistent columns — one confirmed naming defect, two intentional dualities.** `pricing_audit_log` uses `organisation_id` while all 19 other tenant-scoped tables use `org_id` (`024_sprint2_trust_hardening.sql:9`) — the app code was written correctly against this, so there's no runtime bug today, but it's a real inconsistency and a footgun for future code written "by habit." `projects.status` vs `projects.business_status` and `organisation_settings.country` vs `.address_country` are both intentional, documented dualities with working fallback logic — not bugs.
- **Code-vs-schema column verification — clean.** 11 representative `.select`/`.insert`/`.update` payloads across `lib/estimate/persist-estimate.ts`, `lib/projects/*`, `lib/pricing/actions.ts`, `lib/settings/company-actions.ts`, `lib/audit/pricing-audit-log.ts`, `lib/work-areas/description-actions.ts`, `lib/quotes/actions.ts`, `lib/estimate/context.ts` were cross-checked against the migration-defined schema — no mismatches found. Application code has been kept in sync with schema changes throughout the migration history.

### 5.4 Required runtime database verifications
1. Confirm migration `024` has been applied (writes to `pricing_audit_log`/`assumption_metadata`/`conflict_warning` are unconditional, unlike the lifecycle columns which have schema-cache fallbacks).
2. Confirm migration `023` has been applied (the org-match triggers and the `note_proposals` DELETE policy are genuine tenant-isolation controls).
3. Confirm RLS `rowsecurity = true` on all 20 tables including `pricing_audit_log` — note `supabase/sql/verify_rls_coverage.sql`'s own expected-table list predates migration 024 and should be updated.
4. Confirm whether any account/user-deletion flow exists in production, and if so, test it against a profile with authored notes/proposals/pricing-documents/quotes (RESTRICT FKs would block it).
5. Confirm no production `pricing_items`/`quote_items` rows have an `org_id` inconsistent with their parent document/quote (only possible before migration 023's triggers existed).
6. Confirm the actual applied-migrations ledger in the live project lists all 24 files with no gaps — per the governing document's own Principle 7: "Never manually assume the live database matches local migrations."

### 5.5 Potentially destructive operations
**None found** in any of the 24 migration files (see §5.2).

---

## 6. Projects, notes, photos and documents

**Project creation, editing, lifecycle — Confirmed working, with two confirmed gaps.**
- Creation/editing (`lib/projects/actions.ts:333-477`) is Zod-validated and org-scoped.
- **Delete is soft-only** (`deleteProject`, `lib/projects/lifecycle-actions.ts:110-141`, sets `deleted_at`) and **does not cascade to any dependent table** — `work_areas`, `project_notes`, `project_facts`, `constraints`, `questions`, `note_proposals`, `estimates`, and `pricing_documents` all remain live, un-flagged rows after their parent project is "deleted." **Suspected risk** (orphaned-but-live child data, not a crash risk, but a data-hygiene concern).
- **`duplicateProject` (Confirmed defect / incomplete feature)** — copies `work_areas`, `project_facts`, and `constraints`, but never copies `project_notes`, `note_proposals`, `questions`, or `question_blocks` (confirmed via grep — zero references to those tables in the function).
- Archive/restore is clean and idempotent.

**Notes, photos, and documents — the described feature does not exist as implemented; only text notes do.** Exhaustive repo-wide greps for `storage.from`, `createSignedUrl`, `supabase.storage`, `<input type="file"`, and `capture=` all return **zero matches**. `project_notes` supports a `photo_caption` **source label** (metadata describing "this note is about a photo I looked at"), but there is no image/file attachment mechanism anywhere. **All audit sub-questions about upload validation, upload rollback, signed-URL generation/expiry, storage-path isolation, and file-deletion-vs-orphaning are not applicable — there is no code to trace.** This is the single largest gap between the frozen MVP journey (§2.1, step 6 of the governing document) and the actual repository.

**Note create/edit/delete — Confirmed working.** Zod-validated, org/project-scoped via `assertProjectOwned`, soft-deleted consistently with the project pattern.

**Note-analysis → proposal pipeline — Confirmed working, genuine suggest-then-confirm.** `analyseProjectNotes` blocks re-analysis while a `pending_review` proposal exists (explicit existing-suggestion check). Nothing is auto-applied — `applyNoteProposal` requires explicit per-item selection by the user, and dedupes against already-confirmed work areas.

---

## 7. Work areas, questions and constraints

**Work-area suggestion — Confirmed working.** Triggered by brief submission; AI suggestions are filtered against already-existing work-area types before insert (explicit dedupe) and persisted with `status: "suggested"` — never auto-confirmed.

**Confirmation — Confirmed working, distinct state.** `confirmWorkAreas` is an explicit user action updating a real `status` column (`suggested`/`confirmed`/`excluded`), read consistently everywhere downstream by filtering `.eq("status", "confirmed")`.

**Add/exclude CRUD — Confirmed working.** Both actions have real dedupe guards (reject re-adding an already-confirmed type; prefer reviving an excluded/suggested row over inserting a new one; block excluding the last remaining confirmed work area).

**Multiple work areas — Confirmed working for multiple *types*, but capped at one confirmed instance per type, system-wide.** No schema constraint forces this — it's an application-level rule in `addWorkAreaToProject` and the note-proposal apply path. A user renovating two separate bathrooms has no supported path to two confirmed "bathroom" work areas; the app degrades gracefully (a friendly error, not a crash) rather than supporting the case. **Design limitation, not a defect**, but worth naming as a real constraint on "multiple work areas."

**Questions — Confirmed working, correctly scoped, deduped, and persisted.** `questions.work_area_id` FK plus `(workAreaId, key)` matching means no cross-work-area leakage was found. Dedupe exists both in application code and via a DB `unique(question_block_id, key)` constraint. Answers are written to both `questions.answer_value` and the corresponding `project_facts` row (kept in sync bidirectionally) — genuine DB persistence, survives reload.

**`MAX_QUESTIONS = 12` cap — Suspected risk requiring runtime verification.** The initial question-block build sorts by work-area order then required-first, then slices to 12 (`lib/scopes/questions.ts:26,466,554`). A project with enough confirmed work areas could have later-sorted work areas' *required* questions silently dropped from that first pass. The safety-net "missing details" pass (`ensureMissingDetailsQuestionBlock`) has no such cap and is likely self-healing, but the initial pass can still skip required questions in a many-work-area project.

**Constraints — Confirmed working for persistence; a confirmed dead-end for most of the constraint catalogue.** End-to-end traced for `site_access`: `ConstraintBlock` UI → `updateProjectConstraint`/`saveConstraints` → `constraints` table → `getEstimateContext` → `getLabourAdjustmentFactor` (`lib/estimate/adjustments.ts:131-166`) → multiplied directly into labour cost in 6 of the 9 calculator files. This confirms constraints are **not** a dead-end for `site_access`, `site_slope`, `material_carry_distance`, and `retaining_wall.access`. **However, roughly 10 other constraint keys** defined in `lib/assistant/constraint-templates.ts` (`services_isolated`, `hazardous_materials_risk`, `waste_bin_access`, `occupied_site`, `working_hours`, `parking_loading`, `protection_dust_control`, `client_supplied_items`, `by_others_trades`, `consent_engineering`) **are captured, stored, and shown in the UI, but never read anywhere in `lib/estimate/`** — confirmed by grep. They have zero effect on the calculated estimate today.

**Derived-fact precedence guardrails — Confirmed working.** User-entered facts are never silently overwritten by AI-derived values (`source === "user"` short-circuit checked consistently across `persistDerivedFactsForProject`, `saveBriefAndSeedWorkAreas`, `applyNoteProposal`), and derived facts can't be hand-edited directly.

---

## 8–9. Estimate generation, calculation map, and packages/line-item editing

This is the audit's most consequential section. The governing document's Principle 5 states: *"Pricing calculations must have one authoritative implementation... AI must not be the authoritative source for arithmetic."* The evidence below shows that principle **holds for AI-vs-deterministic-code** (AI never computes a dollar total directly) but **does not hold for deterministic-code-vs-itself** — the same formula was independently written multiple times by human-authored code.

### 8.1 Calculation map

| Concern | Where computed | Notes |
|---|---|---|
| Quantities | Per-calculator, from `project_facts` via `getNumberFact`/`getNumberFactAny` (`lib/estimate/facts.ts:48-66,126-136`), with sensible defaults when facts are missing | **Confirmed defect: no range/sanity clamping** on AI-sourced numeric facts before they enter cost math — see §11.10 |
| Units | Per-calculator constants (m², lm, each) | Consistent within each calculator |
| Labour hours | `resolveProductivity()` (shared, `lib/estimate/productivity.ts`) in the large majority of calculators | **Confirmed exception:** `external-stairs.ts:213-219` hand-rewrites the `quantity × productivity × adjustment × quality` formula inline with two extra ad hoc multipliers rather than reusing the shared path |
| Labour rate | `resolveLabourRate`/`resolveRate` (shared, `lib/estimate/rates.ts`) in all 9 calculators | Consistent |
| Material rate | `resolveRate` + per-work-area `*_BENCHMARKS` tables in all 9 calculators | `resolveMaterialRate`/`resolveBuildUpMaterialPricing` (newer shared helpers) are **defined but used by none of the 9 calculators** — dead/unused shared infrastructure, or an incomplete migration to a newer abstraction |
| Subcontractor allowance | `createAllowanceLineItem` (shared) | Consistent |
| Waste/wastage | `resolveMaterialWastage()` (shared, `lib/settings/material-wastage.ts`) | **Confirmed inconsistency:** used by only 4 of 8 material-bearing calculators (`deck`, `retaining-wall`, `bathroom`, `fitout`); `kitchen`, `pergola`, and `fence` apply no explicit wastage factor at all — possibly baked into flat benchmark rates, but this is undocumented, not a stated design choice anywhere read |
| Margin/markup/gross profit | **Seven independent hand-written implementations** — see §8.2 | **Confirmed defect** |
| Overhead/contingency | Not found as a distinct line anywhere in the calculators or `lib/pricing/*` — margin appears to be the only markup mechanism modelled | Worth clarifying with the product owner (§18) whether overhead/contingency are meant to exist as separate concepts |
| Tax (GST) | `lib/pricing/calculations.ts` (document level) and quote totals — a single, consistent GST application, not duplicated | Confirmed working |
| Low/high ranges | `lib/estimate/rates.ts` (rate ranges) and `organisation_settings.budget_rate_factor`/`premium_rate_factor` fallback multipliers | Confirmed working |
| Recalculation after edits | `lib/pricing/actions.ts: updatePricingItem` → `calculatePricingItemTotals` (server-side, re-derives from quantity×rate when the client-sent total doesn't match) | Confirmed working, with one bypass — see §9.2 |

### 8.2 The core finding: margin/profit arithmetic is duplicated seven times

No calculator computes margin/markup itself — all nine delegate to shared line-item constructors. But **the shared layer itself is fragmented**. The identical formula (`grossProfit = sell − cost; marginPercent = grossProfit/sell×100; markupPercent = grossProfit/cost×100`) is independently, privately re-implemented in:

1. `lib/estimate/line-items.ts:12-24` — `deriveMargins()` (used by all 9 calculators via the `create*LineItem` factories)
2. `lib/estimate/commercial-realism.ts:109-121` — a **second, separately-named function also called `deriveMargins`**
3. `lib/estimate/summary.ts:216-226` — `finalizeEstimateResult`
4. `lib/estimate/margin-override.ts:10-18` — `recalculateSellFromCost`
5. `lib/estimate/margin-override.ts:63-71` — `sumLineItemTotals`
6. `lib/pricing/pricing-item-calculation.ts:90-112` — `computeProfitFields` (per pricing-item)
7. `lib/pricing/calculations.ts:101-128` — `calculateDocumentTotals` (per pricing-document) — notably does **not** call #6 despite living one file away in the same directory

A client-side eighth copy also exists: `components/pricing/PricingItemEditForm.tsx:118-132` (`profitPreview`) inlines the same rounding/margin formula rather than importing the shared helper — low risk in practice (the server's authoritative response overwrites it after save) but a real duplicate implementation and drift hazard nonetheless.

**No two of these were found to currently disagree on a shared input** (rounding behaviour looks consistent across all seven), but this is exactly the defect pattern Principle 5 exists to prevent: **any future change to rounding, zero-division handling, or the formula itself must be made in seven places or it will silently diverge.** This is classified as a **Confirmed defect** — not a "suspected risk" — because the duplication itself, independent of whether it has caused visible divergence yet, is directly and unambiguously provable from the source.

### 8.3 Hardcoded rate constants that bypass the org's margin setting

Six locations in `lib/estimate/calculators/fitout.ts` and one in `deck.ts` hardcode literal cost/sell dollar pairs directly, bypassing both `resolveRate` and the calculator's own benchmark table:

| File:line | Hardcoded value | Item |
|---|---|---|
| `deck.ts:598-599` | 35 / 55 | Face board labour allowance ($/lm) |
| `fitout.ts:645-646` | 60 / 90 | Existing door removal/disposal ($/door) |
| `fitout.ts:696-697` | 120 / 180 | Door frame allowance ($/door) |
| `fitout.ts:711-712` | 80 / 120 | Door hardware installation ($/door) |
| `fitout.ts:982-983` | 45 / 68 | Stairs/landing flooring allowance ($/stair) |
| `fitout.ts:1311-1312` | 8 / 12 | Sanding/prep allowance ($/m²) |
| `fitout.ts:186-187`, `:1221-1222` | ×2 / ×0.6 multipliers on other benchmarks | Wall removal, trim painting |

Every one of these carries an implicit ~33–40% margin baked directly into the literal, rather than derived from the organisation's configurable `default_margin_percent`. If an org changes its margin setting, these specific line items will not respond, while every `resolveRate`-based line item will. **Confirmed defect**, moderate severity (affects a handful of specific line items in two work-area types, not the whole engine).

### 8.4 Near-duplicate site-condition adjustment logic

Three independent, differently-scaled reimplementations of "site access → labour multiplier" exist with no shared source of truth: `lib/estimate/adjustments.ts:191-199` (`getWorkAreaAccessFactor`: difficult/poor→1.1), `demolition.ts:68-75` (very poor→1.4, poor/difficult→1.25), `external-stairs.ts:61-67` (poor/difficult→1.25). A similar independent pair exists for "floor level"/"ground condition" factors. **Confirmed defect** (lower severity than §8.2 — this affects specific calculators' labour adjustments, not the core margin formula, but is the same root-cause pattern: parallel hand-written logic instead of one shared function).

### 8.5 Client/server trust boundary for pricing-item edits

**Confirmed working, with one confirmed gap.** `updatePricingItem` (`lib/pricing/actions.ts`) does not blindly trust a client-submitted total: `forwardTotalsMatchStored()` (`lib/pricing/pricing-item-calculation.ts:613-656`) checks the client's total against `quantity × rate` within a $0.02 tolerance for `quantity_rate`/`productivity_labour` modes, and **discards and recomputes** it if it doesn't match. **However, for `calculation_mode: "lump_sum"` (used by allowance/contingency items), the function returns `true` unconditionally with zero validation** (`:616-618`) — and `calculation_mode` itself is a client-supplied field (`PricingItemInput.calculation_mode`) with nothing server-side preventing a client from submitting `"lump_sum"` on any item to bypass the cross-check entirely. There is also no call to `validateMarginPercent`/any bound check anywhere in the pricing-item save path, so an arbitrary — including negative-margin — total can be stored for a lump-sum item. **Confirmed defect**, high severity given it directly concerns money and is a validated, reproducible code path, not a hypothetical.

### 8.6 `lib/security/margin-validation.ts` — narrower than its name implies

Validates only that a margin percentage is in `[0, 80)` — used in exactly two places: `lib/estimate/rates.ts` (estimate rate derivation) and `lib/rates/actions.ts` (org-default-margin settings save). **It is never called anywhere in `lib/pricing/*`** — so individual pricing-item margins (including the lump-sum bypass above) and individual `rates` table rows are never bound-checked by it. The file's placement under `lib/security/` is arguably a misnomer: its content is a business-rule numeric-range check, not a security control, and it's applied inconsistently across the codebase's actual money-bearing paths.

### 8.7 Packages/assemblies — the feature does not exist as a data model

Repo-wide grep for `package`/`assembly`/`bundle`/`group_id` across the schema and all pricing components returns **no line-item grouping concept whatsoever**. "Build-up" (`MaterialBuildUpEntry`) is display-only metadata describing how a *single* line item's cost was derived (e.g. "12 sheets × $45"), attached to that one item's notes field — it is not a multi-row package. There is therefore:
- No way to see "these N line items are one package" beyond work-area grouping (a location/scope grouping, not a pricing-package grouping).
- No whole-package removal, because there is no package to remove as a unit — `deletePricingItem` deletes exactly one row.
- No orphaned-row risk from package removal specifically, because the feature doesn't exist to create that risk.

**This is a gap relative to the audit brief's assumed scope, not a defect in existing code.** If "packages" are an intended product concept for the frozen MVP journey, it needs to be built; if package-like grouping is meant to be handled by the existing work-area grouping, that should be stated explicitly.

**Package/build-up visibility on the one thing that does exist (line-item "ownership" — labour/material/subcontractor/client-supplied/excluded/internal-build-up) is also incomplete on the desktop surface**, see §15.

### 8.8 Recalibration — Confirmed working, full deterministic recompute

`applyRecalibration` (`lib/pricing/recalibration.ts`) always derives fresh `unitCost`/`unitSell`/margins from the current estimate line item's `recommended_cost`/`recommended_sell` — never scales an old total by a factor, so no compounding-rounding-drift risk across repeated recalibrations. Manually-edited items (`manually_edited === true`) are explicitly excluded from recompute — a deliberate "manual edit wins" rule. Document-level totals are always re-summed fresh from the (now updated) line items, not scaled from the prior document total.

### 8.9 Database-level trust

`pricing_documents` and `pricing_items` store all derived totals (`total_cost`, `total_sell`, `gross_profit`, `margin_percent`, `markup_percent`, `gst_amount`, `total_incl_gst`) as plain, non-generated numeric columns with **zero DB-level CHECK constraints** tying them to their source fields (e.g. nothing enforces `total_cost = quantity × unit_cost` at the database layer). Correctness depends entirely on `recalculateAndPersistDocumentTotals`/`calculatePricingItemTotals` being called on every mutation path — confirmed that it currently is, for all observed add/update/duplicate/delete/create-from-estimate paths — but this is an application-layer-only guarantee with no database backstop.

---

## 10. Detailed quote and output

**Estimate → Final Pricing → Quote conversion — Confirmed working, with one confirmed defect.** `createQuoteFromPricing` hard-blocks unless the source pricing document's `status === "reviewed"`. Quote line totals copy the pricing engine's `total_sell` **verbatim** — the quote does not re-derive totals from raw cost/rate/quantity, so it cannot itself introduce arithmetic drift, and manually-adjusted pricing-stage rates correctly flow through unchanged.

**Confirmed defect — silent subtotal divergence.** The Final Pricing subtotal the estimator reviews and approves (`calculateDocumentTotals`, sums **all** pricing items) and the quote snapshot subtotal (sums only `visible_on_quote` items) are computed over different item sets, with **no comparison or warning anywhere** at quote-creation time if any item is marked not-visible-on-quote (the default is visible, but a toggle exists). A client-facing quote total can therefore be lower than the total the estimator actually reviewed, with nothing in the code alerting anyone to the gap.

**Staleness protection — Confirmed working.** Editing reviewed pricing resets its status to draft, which blocks quote regeneration from stale pricing until re-reviewed; the quote workspace also banners when pricing was updated after quote creation. This does not, however, catch the visible-on-quote divergence above, since that mismatch can exist at the moment of creation, before any later edit.

**Scope, assumptions, inclusions, exclusions — Confirmed working, mostly template/org-default-based, editable except inclusions.** Inclusions are derived read-only from visible pricing items and are **not editable in-place on the quote** — changing them requires going back to Final Pricing and refreshing. **Incomplete implementation.**

**Client-safety sanitisation — Confirmed working, advisory only.** `lib/quotes/sanitize.ts` strips internal cost/margin/productivity language and AI-provider attribution from client-facing text; flags remaining suspicious text but does not block quote creation.

**Quote revisions — Confirmed working, genuine version history.** `016_quote_revisions.sql` plus `reviseQuote`/`reviseQuoteFromFinalPricing` insert a new quote row, copy all quote items, and mark the old row superseded (not deleted) — full history is preserved and queryable. A manual compensating rollback (delete the new rows) runs if the supersede step fails.

**Preview — Confirmed working, but there is no distinct preview mode**, just the same `QuoteTemplate` rendered live inline plus a separate `/print` route.

**Export — Confirmed working as browser print-to-PDF; not a generated PDF file.** No PDF-generation dependency exists; `QuotePrintActions.tsx`/`QuoteAutoPrint.tsx` open the print route and call `window.print()`. Legitimate and QA-checked (`docs/PRINT_QA_CHECKLIST.md`) for what it is, but it is not a stored, consistently-rendered, emailable PDF artifact — worth clarifying with the owner whether that's an accepted limitation or a gap (§18).

---

## 11. AI integration audit

**Provider/model — Confirmed working.** `@anthropic-ai/sdk`, model `"claude-sonnet-4-6"` (env-overridable, no date-suffixed pinning). No request timeout configured anywhere the client is called — **Suspected risk** (a hanging response has no app-level cutoff faster than the SDK default).

**Prompts — enumerated and located.** `lib/ai/brief-extraction-prompt.ts` (brief extraction) and an inline system prompt in `lib/ai/extract-notes.ts` (note analysis, plus a `RETRY_SUFFIX` appended on retry). Two trivial hardcoded smoke-test prompts exist for dev-only connectivity checks.

**Structured output vs. free text — Confirmed: free-text JSON, not tool-call output.** The model is asked by prose to emit JSON, parsed via `parseJsonObject` (`lib/ai/parse-json.ts:76-107`), which never throws and never silently defaults — it returns an explicit `{success:false, error}` on any failure, converted by callers into typed errors or a single content-level retry.

**Runtime Zod validation — Confirmed working, genuinely enforced, not just typed.** `lib/ai/schema.ts` and `lib/ai/note-proposal-schema.ts` are `.safeParse`'d against the live AI response at runtime, including allow-list filtering of work-area types and constraint keys so the model cannot inject arbitrary categories. This is better-engineered than a filename-only inspection would suggest.

**Retries — Confirmed working, correctly scoped.** `withAnthropicRetry` (max 3 attempts, exponential backoff capped at 8s) retries only on 429/5xx/network/timeout — explicitly not on validation or other 4xx failures, matching the audit's own concern about not retrying non-transient errors.

**User-facing failure handling — Confirmed working.** Typed `AIExtractionError`s map to specific, human-readable messages; unknown errors fall back to a generic-but-non-crashing message. No path found that surfaces a raw stack trace to the end user.

**Logging/privacy — Suspected risk requiring runtime verification.** Failure-path logging (`extract-notes.ts:161-180`, `lib/assistant/actions.ts:55-72`) includes up to 300 characters of the AI's response — which itself echoes back user-submitted project/site-note content (potentially addresses, client names) — via unguarded, non-environment-gated `console.error` calls that run in production. Depending on hosting-platform log retention/access controls, this could persist customer data in plaintext operational logs.

**Token/cost controls — Confirmed defect (gap).** `max_tokens: 4096` is set per-call, but **no rate limiting and no per-org usage cap exist anywhere** — an org (or a user repeatedly clicking "Analyse") can call the Anthropic API without any application-level throttle.

**Partial DB state on AI success / write failure — Confirmed defect.** `applyNoteProposal`'s fact/constraint-application loop uses `if (!error) changesApplied += 1;` with **no `else` branch** — a failed individual insert/update is silently swallowed, the parent proposal is still marked `"accepted"`/`"partially_accepted"`, and the function returns `{success: true}` to the UI regardless. The user is told a proposal was applied even if some underlying writes failed, with no DB transaction wrapping the multi-row sequence. A related, lower-severity instance: `analyseProjectNotes` discards the result of the `project_notes.analysis_status = "analysed"` update with no error check.

**AI output flowing into financial calculations without validation — Confirmed defect, the most consequential AI-related finding.** Brief-extracted numeric facts are written to `project_facts` (`source: "ai_extracted"`) **without per-value human confirmation** — only the coarser "confirm work areas" step gates anything, and it confirms whole work areas, not individual fact values. Those facts are then read by `getNumberFact`/`getNumberFactAny` (`lib/estimate/facts.ts:56-63`) with **no range/sanity clamping whatsoever** — no min, no max, no plausibility bound — before being used as a direct multiplicand in quantity × rate cost math across every calculator. A hallucinated or misparsed value (e.g. a deck length extracted as 500 instead of 5.0) would flow unmodified into the pricing document and quote total, with only human eyeballing, not code, as a backstop. Site-note-derived facts are safer (a genuine human-in-the-loop `applyNoteProposal` gate exists before they reach `project_facts`), but once applied they hit the same unclamped read path.

**Dev-only surfaces — Confirmed correctly gated / dead code.** `dev/ai-test` refuses to run outside development; `lib/ai/test-anthropic.ts` is documented as a manual CLI-only utility with no importers in the running app.

---

## 12. Error handling and operational visibility

**Error message mapping (`lib/errors/user-message.ts`) — Confirmed working, well-designed.** Detects session/JWT errors specifically; provides ~10 action-specific fallback strings rather than one generic message everywhere. Technical detail is only ever logged in development.

**Audit logging (`lib/audit/pricing-audit-log.ts`) — Confirmed working as designed, with an accepted trade-off.** Explicitly best-effort by design (documented in-code) — a failing audit-log write is only `console.error`'d and never blocks or surfaces to the caller. Reasonable, but means a silently-broken audit table produces no operator-visible signal.

**No error boundaries anywhere — Confirmed defect.** Zero `error.tsx`/`global-error.tsx` files exist in the repository. Any uncaught render-time exception in production falls through to Next.js's unstyled default error page. Only a 404 handler (`not-found.tsx`) exists.

**No monitoring/analytics SDK — Confirmed defect (gap).** No Sentry/PostHog/Vercel Analytics/LogRocket/Datadog present in dependencies or imports. The only operational-visibility surface is a manual `/app/health` page (Supabase connectivity check, env-var presence, build ref) — useful for manual triage, not automated alerting.

**No correlation/request/trace IDs — Confirmed defect (gap).** Zero matches for `requestId`/`correlationId`/`traceId` anywhere in the codebase — no mechanism to correlate a client-reported problem with server-side logs.

**Server-action error handling — Confirmed working, reasonably consistent.** Actions return typed `{error: string}` results with purpose-built, action-specific copy (not raw stack traces); sampled components consistently render these inline. One inconsistency found: `SiteNotesCaptureCard.tsx`'s update path `throw`s inside what looks like an optimistic-update helper rather than using the same `result.error` pattern as its sibling create/delete paths — worth confirming this is actually caught somewhere upstream given there's no error boundary to catch it if not.

---

## 13. Test coverage

**No test framework, no CI — Confirmed defect.** No Jest/Vitest/Playwright config; no `test` npm script; no `.github/workflows` directory at all.

**`scripts/` — 29 files, none wired to anything.** Classified by dependency: several are genuine pure-logic automated tests (assert-based, e.g. `verify-buildup-dedupe.ts`, `test-parse-json.ts`); several require a live Anthropic API key (`verify-fact-coverage.ts`, `verify-internal-ai-extraction.ts`, `verify-outdoor-ai-extraction.ts`); several require a live Supabase DB, some with service-role credentials (`verify-org-isolation.ts`, `verify-rls-coverage.ts`, `verify-env-safety.ts`, `test-lifecycle-ops.mjs`). Only 2 of these 29 are referenced anywhere in `README.md`/`docs/`.

**Commands run and exact results (this audit, non-destructive, no code changed to make anything pass):**

1. `npx tsc --noEmit` → **exit code 0**, no output. Clean typecheck.
2. `npm run lint` (`eslint`) → **exit code 0**, no output. Clean lint.
3. `npm run build` (`next build`, Turbopack) → **exit code 0**, succeeded:
   ```
   ▲ Next.js 16.2.9 (Turbopack)
   ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
   ✓ Compiled successfully in 3.0s
   Finished TypeScript in 4.2s
   Generating static pages using 7 workers (14/14) in 131ms
   ```
   Build succeeded only because this checkout's `.env.local` already contains real Supabase/Anthropic credentials — `lib/env.ts` would throw during the build's env-assertion step on a from-scratch checkout without it. The middleware-deprecation warning is itself a live instance of the exact "this Next.js version has diverging conventions" scenario the repo's own `AGENTS.md` warns about.
4. Attempted to run the pure-logic scripts standalone (`npx tsx scripts/test-parse-json.ts`) — **failed**: neither `tsx` nor `ts-node` is installed anywhere in this environment (`devDependencies`, `node_modules/.bin`, or global), and `npx` refused to non-interactively auto-install. A fallback attempt with Node's native TypeScript support (`node scripts/test-parse-json.ts`) also failed with `ERR_MODULE_NOT_FOUND`, because the codebase's extensionless imports rely on a bundler-aware resolver that Node's native ESM loader doesn't provide. **Conclusion: none of the 29 `scripts/*.ts` files can currently be executed in this environment as-is** — this is itself a test-coverage/tooling gap, independent of whether the scripts' own logic is sound.

**Deep trace of the five pricing-correctness `verify-*.ts` scripts (`verify-pricing-ownership.ts`, `verify-commercial-realism.ts`, `verify-buildup-dedupe.ts`, `verify-material-rates.ts`, `verify-recalculation-preservation.ts`), since these are the scripts specifically meant to catch the §8 pricing-duplication class of defect.** All five import real production code (no re-implementation) and use only synthetic, hand-built fixtures — none touch Supabase or real project data, so none could ever surface an issue specific to real historical data shapes. Every assertion in all five was manually traced against current source and **holds today**. Two structural weaknesses were found in what these scripts actually prove:
- `verify-pricing-ownership.ts` and `verify-commercial-realism.ts` mostly call individual calculators (`calculateBathroom`, `calculateKitchen`, etc.) directly rather than the full `calculateEstimate` pipeline production actually runs — only one scenario per script goes through `calculateEstimate` and therefore exercises the shared cross-work-area dedupe utilities (`dedupePricedItemsByScopeOwnership`, `mergeDuplicateMaterialBuildUpLineItems`); the rest test each calculator's own internal non-duplication logic in isolation.
- **`verify-buildup-dedupe.ts`'s core claim is currently untestable by its own fixtures.** `mergeDuplicateMaterialBuildUpLineItems` only recognizes two hardcoded label pairs (`"Decking boards"→"Decking materials package"`, `"Backfill materials"→"Backfill allowance"`), but **no calculator anywhere in the current codebase emits a line item literally labeled `"Decking boards"` or `"Backfill materials"`** (confirmed by repo-wide grep) — every calculator now attaches build-up metadata directly onto the single package/allowance line at creation. This means the function's actual splice/merge branch (`material-buildup-dedupe.ts:27-55`) is never exercised by real duplicate input in this script; all its assertions pass trivially because the "duplicate" search always returns not-found. A latent bug in the splice logic itself would go undetected.
- **`verify-recalculation-preservation.ts`'s docstring claims to verify "recalibration preserves manually edited pricing items," but it never imports or calls the orchestration function (`lib/pricing/recalibration.ts`) where that guarantee actually lives.** It only unit-tests the lower-level helpers (`matchPricingToEstimateLines`, `buildPricingItemUpdateFromEstimate`) in isolation. Separately tracing `recalibration.ts:246-267` confirms the real guard (manually-edited items are routed around the update-from-estimate path) is correctly in place today — but this script would not detect it if that guard were ever removed or reordered, since it doesn't touch that file at all. **This is a confirmed instance of a script's stated purpose and its actual code-under-test diverging** — worth flagging distinctly from the general "no CI" gap, since a future engineer could reasonably believe this property is covered when it isn't.
- `verify-material-rates.ts` is the strongest of the five — dense, deterministic conditional logic, no calculator/fact-derivation dependency, and the best return on investment if only one of these 29 scripts is prioritised for actually being wired into a real test runner first.

---

## 14. Performance risks

`docs/PERFORMANCE_RESPONSIVE_QA.md` documents a prior "Sprint 3" pass that already fixed several real issues (dual table/card mounts, unstable callbacks, missing memoization, AI retry backoff) and explicitly defers two known items (virtualising 100+ line-item breakdowns; moving off full `router.refresh()`). This section reports what remains, each explicitly tagged Measured (code read, pattern confirmed) or Suspected (pattern-based inference only) per the audit brief's instruction.

- **Measured:** `lib/projects/actions.ts:159-160` (`listProjects`) awaits two independent summary fetches (`getPricingSummariesForProjects`, `getQuoteSummariesForProjects`) sequentially rather than via `Promise.all` — the one clear miss found, in a codebase that otherwise already uses `Promise.all` in 19 other places across `lib/`.
- **Measured — no material finding:** repeated-AI-call risk is well-guarded (`analyseProjectNotes` blocks re-analysis while a proposal is pending; brief-analysis has a stage-based guard, though it's server-state-based rather than a request-level idempotency lock, leaving a narrow Suspected double-submit gap).
- **Measured — not applicable:** signed-URL/upload performance concerns don't apply, because no file upload feature exists (§6).
- **Measured — no material finding:** no heavy client-side libraries (charting/animation/date) found in dependencies or `"use client"` imports.
- **Measured — no material finding:** `.select("*")` appears 32 times but every sampled instance is a single-row lookup or an insert-then-echo, not an unbounded list fetch; the dashboard list itself uses named-column selects.
- **Measured — no material finding:** indexing is handled incrementally and reasonably thoroughly across migrations 001/005/007/010/011/012/013/014/015/016/024 — no large-table filter column was found lacking a corresponding index in the sampled files.
- **Measured — no material finding:** dashboard/project-metric queries are already batched by project-ID array, not looped per-project (no N+1 pattern found).

---

## 15. UI and usability inventory

*(Static source inspection only — items are marked Confirmed where the code itself unambiguously proves the defect without needing to render the app, and Suspected where a browser/visual check is genuinely required.)*

**Inconsistent navigation — Confirmed.** The mobile bottom nav + hamburger menu (Dashboard/Rates/Company/Setup) is entirely removed once a mobile user opens a project (`app-shell.tsx`'s `showMobileNav = !isProjectRoute(pathname)`), while the desktop sidebar retains full navigation everywhere — an asymmetric navigation model between breakpoints, provable from the conditional alone. Additionally, the same four nav destinations are independently listed in three separate components (sidebar, mobile nav, user-menu dropdown) with no shared source.

**Mobile-only layouts appearing on desktop — Confirmed.** `use-media-query.ts`'s `useIsDesktop` explicitly defaults to `false` until mount, and two components (`DashboardProjectList.tsx`, `PricingWorkAreaSection.tsx`) use this to fully swap component trees rather than CSS-hide — meaning **every desktop user's dashboard and pricing item list renders the mobile-card layout first, then flashes to the desktop layout** once the effect fires. This is inconsistent with the rest of the app, which correctly uses pure Tailwind breakpoint classes with no flash.

**Missing loading states — Confirmed.** `/app/health`, `/app/projects/demo`, and the quote print route all fetch data server-side with no corresponding `loading.tsx`.

**Confusing buttons — Suspected/minor.** A permanently-disabled "Create quote" button relies on small muted caption text below it to explain why; an "Add item" button gives no indication of which (possibly collapsed) work-area section it will add to.

**Duplicate fields — Confirmed.** `project.brief_text` is editable from two independent, disconnected surfaces (the New/Edit Project dialogs and the assistant's `ProjectCaptureBlock`) with no indication in either that the other exists.

**Hidden package membership — Confirmed.** `PricingOwnershipBadge` (labour/material/subcontractor/client-supplied/excluded/internal-build-up) is wired into the **mobile card layout only**; the desktop table-row branch of the exact same `PricingItemRow` component has no reference to it at all, and `PricingItemEditForm` has no field for it whatsoever — on the primary (desktop) pricing surface, ownership/build-up membership is invisible and non-editable, despite the badge component existing in the codebase.

**Unclear estimate ranges — Confirmed.** "Sell range"/"Cost range" is rendered as a bare `"$X – $Y"` string with zero surrounding explanation of what the range represents, in both `EstimatePanel.tsx` and `EstimateBreakdownModal.tsx`. Compounding this: currency formatting is inconsistent — the assistant panel hardcodes `en-AU`/AUD while Final Pricing and Quotes hardcode `en-NZ`/NZD, even though Setup defaults new orgs to NZD/NZ — the same project's dollar figures can appear in two different currency formats across its lifecycle.

**Poor edit discoverability — Confirmed (tied to hidden package membership above).** Pricing ownership cannot be edited from any UI surface at all.

**Destructive actions without confirmation — Confirmed, one clear gap.** Project deletion and note deletion are both correctly wrapped in a confirmation dialog. **Deleting a pricing line item (`PricingItemRow.tsx`) fires immediately on click with no confirmation dialog anywhere in that component tree** — inconsistent with the two sibling delete flows that do confirm.

**Accessibility — spot-check only, not exhaustive.** Icon-only buttons and dialog close controls sampled all carry accessible names; both `<img>` usages found have meaningful `alt` text; checkbox/radio controls are properly labelled. One minor latent risk: `RateInputRow.tsx` builds `id`/`htmlFor` pairs directly from human-readable label text, which could collide or contain spaces if labels aren't unique — no live collision found in current data.

**Responsive-layout issues — mostly clean.** No fixed-pixel-width elements that would force overflow on small viewports were found in the reviewed files; this area is lower-risk than the mobile/desktop layout-switch issue above.

**Additional confirmed findings (dead code):** `components/projects/ProjectCard.tsx` is unused anywhere in the app (the dashboard actually uses `ProjectRow`/`ProjectMobileCard`) yet duplicates ~80% of their logic — a stale, divergent component a future maintainer could mistake for the live one.

---

## 16. Prioritised issue register

| ID | Area | Description | Evidence | Severity | Launch blocking | Data risk | User impact | Suggested stage | Dependencies | Runtime verification required |
|---|---|---|---|---|---|---|---|---|---|---|
| S1-001 | Pricing | Margin/gross-profit formula independently re-implemented in 7 places (+1 client-side) | §8.2 | **Critical** | Yes | Financial | Silent total drift if any copy is edited without updating the rest | 4 | None | No — provable statically |
| S1-002 | Pricing | `calculation_mode: "lump_sum"` bypasses the only server-side total cross-check; no margin bound enforced on pricing items | §8.5, §8.6 | **Critical** | Yes | Financial | Arbitrary/negative-margin totals can be persisted | 4 | None | Send a crafted lump-sum payload |
| S1-003 | Pricing/Quotes | `lib/pricing/actions.ts` and `lib/quotes/actions.ts` (27 actions) have zero runtime input validation | §2, §8 | **Critical** | Yes | Financial/integrity | Malformed input reaches money-bearing writes unchecked | 4 | S1-002 | Send malformed payloads to each action |
| S1-004 | Projects/Notes | File/photo/document upload feature (frozen MVP journey step 6) does not exist | §6 | **Critical** | Yes (per frozen journey) | None yet (feature absent) | Users cannot capture site photos/docs at all | 3 | Owner decision required (§18) | N/A |
| S1-005 | Tenancy | `lib/assistant/actions.ts` omits the org-ownership check every sibling assistant file performs | §4 | High | Yes | Cross-tenant | Potential cross-org read/write in the estimate flow | 2 | None | Two-real-user, two-real-org test |
| S1-006 | Tenancy | RLS live-isolation proof has never succeeded (missing RPC; FK-blocked live seed) | §4 | High | Yes | Cross-tenant (unproven, not disproven) | Cannot currently claim tenancy is verified end-to-end | 2 | S1-005 | Fix scripts, then run against a real two-org setup |
| S1-007 | DB | 7 tables lack parent-org-consistency triggers (only `pricing_items`/`quote_items` got them) | §4, §5.3 | High | Yes | Cross-tenant | Same root cause as S1-005/006 | 2 | S1-005 | Confirm migration 023 applied; consider extending triggers |
| S1-008 | AI/Pricing | AI-extracted numeric facts flow into cost math with no range/sanity clamping | §11 | High | Yes | Financial | A hallucinated/misparsed value can silently inflate/deflate an estimate | 5 | None | No — provable statically |
| S1-009 | AI/Notes | `applyNoteProposal` swallows individual write errors and reports success regardless | §11 | High | No | Data integrity | User believes a proposal was fully applied when it wasn't | 5 | None | No — provable statically |
| S1-010 | Quotes | Quote subtotal can silently diverge from the reviewed Final Pricing subtotal (`visible_on_quote` filtering mismatch, no cross-check) | §10 | High | Yes | Financial | Client sees a different total than the estimator approved | 6 | None | No — provable statically |
| S1-011 | Testing | No test framework, no CI, 29 diagnostic scripts unwired and currently unrunnable in this environment | §13 | High | Yes | Process | No automated regression safety net for any of the above | 8 | None | N/A |
| S1-012 | Pricing | 7 hardcoded rate constants in `fitout.ts`/`deck.ts` bypass the org's configurable margin | §8.3 | High | No | Financial | Margin-setting changes silently don't apply to these line items | 4 | None | No — provable statically |
| S1-013 | Tenancy | Role column exists but is enforced almost nowhere; no invite model | §4 | Medium | No | Access control | Currently low-exposure (no invites), but vestigial | 2 | None | No |
| S1-014 | Tenancy | Zero-org state silently renders an empty app instead of a recovery flow | §4 | Medium | No | UX/support | Confusing dead-end for an affected user | 2 | None | No |
| S1-015 | Tenancy | `getAuthOrgContext`-equivalent logic duplicated in 4 files | §4 | Medium | No | Maintainability | Future security fix may not propagate to all copies | 2 | None | No |
| S1-016 | DB | Author-tracking FKs (5 tables → `profiles`) default to RESTRICT; would block user deletion if that flow exists | §5.3 | Medium | No | Compliance/GDPR-adjacent | Account-deletion request could fail | 2 | S1-018 (owner input) | Confirm if a deletion flow exists; test if so |
| S1-017 | Projects | Soft-deleted projects leave all child tables (notes, work areas, questions, constraints, estimates, pricing) live and un-flagged | §6 | Medium | No | Data hygiene | Orphaned-but-queryable rows persist indefinitely | 3 | None | No |
| S1-018 | Projects | `duplicateProject` omits notes, questions, and note_proposals | §6 | Medium | No | Feature completeness | Duplicated project loses relevant history | 3 | None | No |
| S1-019 | Work areas | `MAX_QUESTIONS = 12` cap can silently drop required questions for many-work-area projects on the first pass | §7 | Medium | No | Estimate completeness | User may not be asked a required question | 3 | None | Test with 4+ confirmed work areas |
| S1-020 | Constraints | ~10 of 14 constraint keys captured but never consumed by the estimate engine | §7 | Medium | No | Expectation mismatch | User believes a captured constraint affects price; it doesn't | 3/4 | None | No — provable statically |
| S1-021 | Pricing/UI | Pricing ownership/build-up badge missing from the desktop table row and entirely absent from the edit form | §15 | Medium | No | UX/trust | Package/build-up membership invisible on the primary pricing surface | 6/10 | None | Visual confirmation |
| S1-022 | Pricing/UI | Deleting a pricing line item has no confirmation dialog, unlike project/note deletion | §15 | Medium | No | Data loss (UX) | Accidental irreversible-looking deletion | 6/10 | None | No — provable statically |
| S1-023 | Ops | No root error boundary (`app/error.tsx` absent) | §12 | Medium | No | Support/UX | Uncaught render errors show Next.js's default page | 8/10 | None | No |
| S1-024 | Ops | No monitoring/analytics SDK, no correlation IDs | §12 | Medium | No | Support | Cannot diagnose production issues beyond stdout | 8 | None | No |
| S1-025 | AI | Failure-path logging includes up to 300 chars of user-submitted content via unguarded production `console.error` | §11 | Medium | No | Privacy | Customer project/site details may persist in plaintext logs | 5/8 | None | Confirm hosting log retention/access policy |
| S1-026 | AI | No rate limiting / per-org AI usage cap | §11 | Medium | No | Cost | Uncontrolled AI spend possible | 5/9 | None | No |
| S1-027 | UI | Mobile-card layout flashes on desktop load (`DashboardProjectList`, `PricingWorkAreaSection`) | §15 | Medium | No | UX polish | Visible layout flash on every desktop page load | 10 | None | Visual confirmation |
| S1-028 | UI | Estimate low/high range shown with no explanation; currency locale (AUD vs NZD) inconsistent across the same project's lifecycle | §15 | Medium | No | Trust/clarity | Confusing, inconsistent dollar figures | 10 | None | No — provable statically |
| S1-029 | DB | `pricing_audit_log.organisation_id` breaks the `org_id` naming convention used by 19 other tables | §5.3 | Low | No | Maintainability | Future developer could write a query against the wrong column name | 4/7 | None | No |
| S1-030 | Perf | Dashboard's two summary fetches awaited sequentially instead of via `Promise.all` | §14 | Low | No | Latency | Marginally slower dashboard load | 9 | None | Measure actual latency impact |
| S1-031 | UI | `ProjectCard.tsx` unused dead code duplicating live components; `lib/ai/test-anthropic.ts` unused | §15, §11 | Low | No | Maintainability | None directly | Any | None | No |
| S1-032 | Quotes | Export is browser print-to-PDF only, no generated/stored PDF artifact | §10 | Low | No | Feature expectation | No emailable PDF file exists | 6 | Owner clarification (§18) | No |
| S1-033 | Governance | `AGENTS.md` + an embedded prompt-injection-style comment in `node_modules/next/dist/docs/index.md` — informational anomaly, not acted upon | §2 | Low | No | None (informational) | None | 0 | Owner awareness | No |

**Totals: 4 Critical, 8 High, 15 Medium, 6 Low = 33 issues. 12 marked Launch blocking: Yes.**

---

## 17. Recommended stage plan

Mapping each issue above to the governing document's Stage 2–11 structure (audit-only; no implementation authorised by this document):

- **Stage 2 (Data integrity, auth, org isolation):** S1-005, S1-006, S1-007, S1-013, S1-014, S1-015, S1-016
- **Stage 3 (Core project workflow):** S1-004 (pending owner decision), S1-017, S1-018, S1-019, S1-020 (partial)
- **Stage 4 (Estimating engine and pricing correctness):** S1-001, S1-002, S1-003, S1-012, S1-020 (partial), S1-029 (partial)
- **Stage 5 (AI reliability and fallback handling):** S1-008, S1-009, S1-025 (partial), S1-026 (partial)
- **Stage 6 (Estimate editing, packages, quote progression):** S1-010, S1-021, S1-022, S1-032
- **Stage 7 (Company setup and commercial configuration):** S1-016 (partial), S1-029 (partial)
- **Stage 8 (Tests, analytics, observability):** S1-011, S1-023, S1-024, S1-025 (partial)
- **Stage 9 (Performance):** S1-026 (partial), S1-030
- **Stage 10 (UI, responsive, usability):** S1-021, S1-022, S1-023, S1-027, S1-028
- **Stage 11 (Release validation):** re-run this issue register against the live database and a two-org manual test before sign-off.

---

## 18. Required information from the owner

The following cannot be established from the repository alone:

1. **Live database migration status** — has migration `024` (and `023`) actually been applied to the production/staging Supabase project? This audit found the schema *design* sound but cannot confirm the *live* state.
2. **Whether photo/document upload (frozen journey step 6) is an accepted MVP limitation or an outstanding must-build feature** — the repository currently implements text notes only.
3. **Whether "packages/assemblies" (audit §9) are an intended, not-yet-built product concept, or whether work-area grouping is meant to fully satisfy that need.**
4. **Whether overhead and contingency are intended as distinct commercial concepts** beyond the single margin mechanism found in the codebase.
5. **Whether a real, generated/downloadable PDF export is expected**, versus the current browser-print-to-PDF being an accepted mechanism.
6. **Whether any account/user-deletion flow exists or is planned** (relevant to the RESTRICT foreign keys found in §5.3/§16 S1-016).
7. **Known user-reported errors or incidents** not otherwise visible in the code (there is no monitoring/analytics to surface these independently).
8. **Real customer data status** — is there live production data today, and if so, has it ever been exposed to the tenancy gaps described in §4/S1-005–007?
9. **Intended commercial logic for currency/locale** — is NZD the sole intended currency, given the AUD/NZD inconsistency found in §15?
10. **Current deployment branch/environment** and whether this checkout's `.env.local` values correspond to a real, currently-live Supabase/Anthropic project (this audit did not attempt to determine that, per the read-only/no-live-connection constraint).
11. **Existing test accounts** usable for the two-real-user, two-real-org runtime verification this audit repeatedly flags as necessary (S1-005, S1-006, S1-007).

---

## Document control

| Field | Value |
|---|---|
| Path | `docs/audits/STAGE_1_CURRENT_STATE_AUDIT.md` |
| Audit date | 2026-08-03 |
| Governing document read | `docs/MVP_HARDENING_GUIDE.md` (in full, before this audit began) |
| Application code / schema / config changed | None |
| Stage tracker updated | Stage 1 status set to `Auditing` in `docs/MVP_HARDENING_GUIDE.md` |

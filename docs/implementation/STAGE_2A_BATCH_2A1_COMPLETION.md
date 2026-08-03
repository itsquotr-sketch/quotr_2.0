# Stage 2A — Batch 2A.1 Completion Report

**Batch:** Shared Authentication and Organisation Guard  
**Date:** 2026-08-03  
**Status:** Complete  
**Stage 2A overall:** In Progress (not complete)

---

## 1. Objective

Establish one authoritative authenticated-user and organisation-context helper; secure assistant project access with explicit ownership checks; prevent zero-organisation users from entering the normal application shell; document the MVP one-company / multi-user organisation model without adding invites or org switching.

## 2. Issue IDs addressed

| ID | Treatment |
| --- | --- |
| **S1-005** | Fixed — `loadProjectStage` and `getAssistantState` now require auth-org context and `assertOrgOwnsProject` |
| **S1-014** | Fixed — protected layout redirects missing/invalid org to `/app/setup-required` |
| **S1-015** | Partial — rates, setup, and settings local resolvers now delegate to the shared helper; other duplicates intentionally left |
| **S1-013** | Documentation only — multi-user / one-company model clarified; no role/invite features added |

## 3. Current implementation before changes

* `getAuthOrgContext` lived in `lib/assistant/state.ts` and returned `null` on failure.
* Identical private copies existed in `lib/setup/actions.ts`, `lib/settings/company-actions.ts`, and `lib/rates/actions.ts`.
* `loadProjectStage` authenticated but did not call `assertOrgOwnsProject` (RLS-only).
* `getAssistantState` loaded projects by ID without `.eq("org_id")` or ownership assert.
* Protected `app/(protected)/app/layout.tsx` rendered `AppShell` with `organisationName: null` when profile/org was missing.

## 4. Exact changes made

1. Added authoritative auth-org modules under `lib/security/`.
2. Wired assistant state/actions through `requireAuthOrgContext` + `assertOrgOwnsProject`.
3. Added `/app/setup-required` recovery page and layout redirect (no DB writes on render).
4. Redirected rates/setup/settings organisation resolution to the shared helper.
5. Added focused verification script with mocked ownership checks.
6. Updated Stage 2A plan + tracker; documented MVP organisation model / S1-013.

## 5. Files changed

### Application

* `lib/security/auth-org-evaluation.ts` *(new)*
* `lib/security/auth-org-context.ts` *(new)*
* `lib/security/org-ownership.ts`
* `lib/assistant/state.ts`
* `lib/assistant/actions.ts`
* `lib/rates/actions.ts`
* `lib/setup/actions.ts`
* `lib/settings/company-actions.ts`
* `app/(protected)/app/layout.tsx`
* `app/(protected)/app/setup-required/page.tsx` *(new)*

### Verification / docs

* `scripts/verify-batch-2a1-auth-org.ts` *(new)*
* `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md`
* `docs/MVP_HARDENING_GUIDE.md`
* `docs/implementation/STAGE_2A_BATCH_2A1_COMPLETION.md` *(this file)*

## 6. Functions added, removed or redirected

| Symbol | Change |
| --- | --- |
| `evaluateAuthOrgInputs` | **Added** — pure fail-closed auth/org decision helper |
| `requireAuthOrgContext` | **Added** — authoritative loader (session profile → org; verifies organisation row) |
| `getAuthOrgContext` | **Moved** to `lib/security/auth-org-context.ts`; compatibility wrapper returning `null` |
| `isAuthOrgSuccess` | **Added** |
| `getAuthOrgContext` in `lib/assistant/state.ts` | **Re-export** of authoritative helper |
| Private `getAuthOrgContext` in rates | **Removed**; uses shared helper |
| Private helpers in setup/settings | **Replaced** with thin wrappers that call shared helper then load organisation name |
| `loadProjectStage` | **Updated** — `requireAuthOrgContext` + `assertOrgOwnsProject` + `.eq("org_id")` |
| `getAssistantState` | **Updated** — same ownership contract; child queries also filter `org_id` |

## 7. Security behaviour before and after

| Scenario | Before | After |
| --- | --- | --- |
| Unauthenticated server helper | `null` | `requireAuthOrgContext` → `not_authenticated` |
| Auth without profile/org | `null`; layout still rendered shell | Layout redirects to `/app/setup-required` |
| Invalid org reference | Treated like success if `org_id` present | Fail closed / setup-required |
| Cross-org project ID in assistant actions | Relied on RLS only | Explicit ownership assert; `"Project not found."` |
| Missing vs foreign project | Both not-found via RLS/empty | Same generic `"Project not found."` externally |
| Client-supplied org ID | Not accepted (unchanged) | Still not accepted; org only from profile |
| Org switcher / invites | Absent | Still absent |

## 8. Tests added

* `scripts/verify-batch-2a1-auth-org.ts` — deterministic mocks; no production data.
* Covers auth evaluation success/failure cases and ownership indistinguishability for missing vs foreign projects.
* Layout recovery and live two-user assistant paths documented as manual checks (no separate staging project).

## 9. Commands run and results

| Command | Result |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit` | Pass (exit 0) |
| `npm run lint` | Pass (exit 0) |
| `npm run build` | Pass (exit 0); route `/app/setup-required` present |
| `npx --yes tsx scripts/verify-batch-2a1-auth-org.ts` | Pass — all focused checks |

## 10. Manual verification steps

1. Sign in as a valid org user → dashboard/AppShell loads normally.
2. Simulate missing profile/org (or use an orphaned auth user) → redirect to `/app/setup-required` without AppShell chrome; no organisation insert occurs.
3. From recovery page, use **Sign out to retry setup** → lands on login; can complete signup with company creation.
4. As User A, invoke an assistant action with User B’s project UUID → `"Project not found."` (not an existence leak).
5. Open a project page for a foreign project ID → `notFound` behaviour (same as missing).

## 11. Known limitations

* Live two-authenticated-user isolation against a real database is deferred to Batch **2A.5** (S1-006).
* Authenticated zero-org users cannot open `/signup` until they sign out (middleware redirects auth routes to `/app/dashboard`, which then sends them back to setup-required). Recovery CTA is therefore sign-out-first.
* `/app/setup` still requires an existing organisation; it is not a zero-org bootstrap path.
* `getAuthOrgContext()` still returns `null` for compatibility; new secure paths should prefer `requireAuthOrgContext`.

## 12. Duplicate organisation helpers intentionally left in place

| Location | Why left |
| --- | --- |
| `lib/projects/lifecycle-actions.ts` `loadOwnedProject` | Ownership loader with lifecycle-column fallbacks — beyond safe auth-resolution swap |
| `lib/pricing/actions.ts` `loadOwnedPricingDocument` | Domain loader; Batch 2A.3 territory |
| `lib/quotes/actions.ts` `loadOwnedQuote` | Already uses `assertOrgOwnsQuote`; leave for 2A.3 validation pass |
| `lib/project-notes/actions.ts` `assertProjectOwned` | Local ownership helper; functionally similar to shared assert — defer to avoid drive-by refactor |

These remain candidates for later Stage 2A batches when those action modules are hardened.

## 13. Risks discovered

* Linking recovery directly to `/app/setup` or `/signup` while authenticated creates redirect loops; mitigated with sign-out-first CTA.
* Adding organisation-row existence checks slightly changes prior behaviour (dangling `org_id` now fails closed) — intentional for S1-014.
* `import "server-only"` on the runtime auth module required splitting pure evaluation helpers so scripts can run outside Next.js.

## 14. Migrations / remote changes

**None.** No database migrations were created or applied. No remote Supabase changes were made.

## 15. Recommended next step

Begin **Batch 2A.2 — Runtime validation schemas** (S1-002 / S1-003 financial and input validation), after owner acknowledgment of this batch.

Do **not** start Batch 2A.2 until explicitly authorised.

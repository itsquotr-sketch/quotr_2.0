# Quotr production readiness

Internal checklist for deploying Quotr to test users. Do not commit secrets.

## Required environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (client + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional for signup (post 3.1C.1B); Yes for admin/ops tooling | Server-only. **Signup** provisions via authenticated RPC `provision_organisation_for_new_user` (migration 032) — service-role is **not** required on that path. Still used by `lib/supabase/admin.ts` for local verification / privileged tooling. Never use `NEXT_PUBLIC_*`. |
| `ANTHROPIC_API_KEY` | Yes (AI features) | Project analysis, note extraction, scope assistance |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `NEXT_PUBLIC_FEEDBACK_EMAIL` | No | Recipient for Report issue mailto links |

Copy `.env.local.example` to `.env.local` for local development.

Runtime validation:
- `lib/env.ts` warns in development and throws in production if public Supabase vars are missing. Service-role remains optional at boot.
- Signup path (3.1C.1B): authenticated RPC provisioning — no service-role assert on signup.
- Admin tooling: `assertAdminServerConfiguration()` when using `createAdminClient()`.
- Migration **032** must be applied on the target database before Preview signup works with the new transactional RPC flow. **Preview remote `quotr_2.0` (`lxvnylhsbvudzzupxeqr`): Applied and Verified** (2026-08-09) — see `docs/implementation/STAGE_3_1C1B1_REMOTE_032_APPLY_COMPLETION.md`.
- Migration **033** (`calibration_responses`) **Applied and Verified Remote** (2026-08-10) — see `docs/implementation/STAGE_3_1C3_R2D2_REMOTE_033_APPLY_COMPLETION.md`. Calibration evidence only — not rate authority.
- Stage **3.1C Complete — Preview Validated** (2026-08-10) — `docs/implementation/STAGE_3_1C_CLOSURE.md`.
- Stage **3.1B Complete — Preview Validated** (2026-08-11) — `docs/implementation/STAGE_3_1B_CLOSURE.md`. Deck / Bathroom / Fitout PASS.
- Stage **3.2.2 In Owner Preview / R5 Complete Local** (2026-08-13) — Owner Demo Preview Pending; **3.2.3 Not Started**. Stage 3.2 not globally Complete.
- Post–3.2.2 commercial/materials: **COMMERCIAL-P0 Complete Local** — `docs/implementation/COMMERCIAL_P0_AUTHORITY_LOCK_COMPLETION.md`. Cost-first Rates / MaterialRequirement / Deck Takeoff **Not Started**.
- Production Scope Discovery remains **Disabled**. Company DNA **Not Started**. PERF-FUTURE-01 **Planned**.

## Supabase

- Apply all migrations in `supabase/migrations/` to the target project.
- Confirm Row Level Security (RLS) is enabled on all tenant tables.
- Auth redirect URLs must include:
  - Local: `http://localhost:3000/auth/callback`
  - Preview/Production: `https://<your-domain>/auth/callback`
  - Also allow the site origin patterns required by Supabase for email links
- Email auth provider enabled for signup/login.
- Optional app env: `NEXT_PUBLIC_SITE_URL` (see `.env.local.example`).

## Deployment (e.g. Vercel)

1. Set all required environment variables in the hosting dashboard.
2. Set production URL as the primary app URL.
3. Run `npm run build` locally before deploy to catch TypeScript errors.
4. After deploy, smoke-test signup, login, and one full project workflow.

## Storage

- Company logo URLs are stored as external URLs in company settings (no Supabase Storage bucket required for V1).
- If logo upload is added later, configure a public or signed bucket with RLS.

## Test account setup

1. Sign up with a test email.
2. Complete setup wizard (company details, work areas, starter rates).
3. Configure company settings (GST, quote terms, payment terms).
4. Run through `docs/DEMO_WORKFLOW.md` on a sample project.
5. Optional: open `/app/health` to confirm auth, org and Supabase connectivity.

## Known deployment limitations

See `docs/KNOWN_LIMITATIONS.md`.

## Rollback

- Revert to the previous Vercel deployment from the hosting dashboard.
- Database migrations are forward-only; avoid destructive rollback without a backup.
- If a bad migration was applied, restore Supabase from a point-in-time backup before re-deploying.

## Pre-launch smoke checklist

- [ ] Sign up / login
- [ ] Account menu opens; Profile / Company settings / Log out work
- [ ] `/app/profile` shows personal details; full name save; password change
- [ ] Log out clears session and returns to `/login` (Back does not restore app)
- [ ] Company settings save
- [ ] Create project → analyse → estimate → final pricing → quote → print
- [ ] Report issue link opens mail client with page URL
- [ ] No raw database errors on common failure paths
- [ ] Quote PDF does not show internal cost/margin fields
- [ ] `/app/health` shows signed-in user and Supabase connected

## Account / Profile / Recovery (Stage 3.1C.2A–2B)

- Personal Profile (`/app/profile`) is distinct from Company Settings (`/app/settings/company`).
- Auth callback: `/auth/callback` (PKCE). Configure Supabase redirect allow-list for Preview/Production hosts.
- Forgot password: `/forgot-password`. Reset: `/reset-password`.
- Optional `NEXT_PUBLIC_SITE_URL` for email redirect origins — **required on Preview** as the stable branch origin. See `docs/runbooks/STAGE_3_1C2B_AUTH_URL_CONFIGURATION.md`.
- Email change: **not** in 2B (Profile email read-only).
- Preview E2E: `docs/runbooks/STAGE_3_1C2B_ACCOUNT_RECOVERY_PREVIEW_TEST.md`.
- Architecture: `docs/architecture/QUOTR_AUTH_CALLBACK_AND_RECOVERY_ARCHITECTURE.md`.

## First-run / Company setup (Stage 3.1C.3)

- **Complete — Preview Validated** with Stage 3.1C closure (2026-08-10).
- Minimum company basics hard-gated until confirmed (currency/country/GST; name from signup).
- Readiness is computed (`getCompanySetupReadiness`) — no `setup_complete` migration.
- Quote Mark sent requires company contact email or phone.
- Closure: `docs/implementation/STAGE_3_1C_CLOSURE.md`.
- Architecture: `docs/architecture/QUOTR_FIRST_RUN_AND_COMPANY_SETUP_ARCHITECTURE.md`.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` to the client.
- Do not commit `.env.local` or production secrets to git.

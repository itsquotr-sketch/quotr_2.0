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

## Supabase

- Apply all migrations in `supabase/migrations/` to the target project.
- Confirm Row Level Security (RLS) is enabled on all tenant tables.
- Auth redirect URLs must include:
  - Local: `http://localhost:3000/**`
  - Production: `https://<your-domain>/**`
- Email auth provider enabled for signup/login.

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

## Account / Profile (Stage 3.1C.2A / 2A-R1)

- Personal Profile (`/app/profile`) is distinct from Company Settings (`/app/settings/company`). See `docs/architecture/QUOTR_ACCOUNT_PROFILE_AND_COMPANY_BOUNDARY.md`.
- **3.1C.2A-R1:** Preview deploy of `59bc1f7` omitted `app/(protected)/app/profile/page.tsx` — AccountMenu linked to a missing route. Do not treat 2A as Preview-passed until R1 retest passes after the page is committed and deployed. See `docs/runbooks/STAGE_3_1C2A_R1_PROFILE_ROUTE_PREVIEW_RETEST.md`.
- Email change and Forgot Password remain **3.1C.2B** (not started).
- Preview test (original): `docs/runbooks/STAGE_3_1C2A_ACCOUNT_PROFILE_PREVIEW_TEST.md`.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` to the client.
- Do not commit `.env.local` or production secrets to git.

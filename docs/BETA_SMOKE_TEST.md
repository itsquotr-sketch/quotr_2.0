# Beta smoke test

Use this before every Preview beta cut. Preview only. No Production. No live Stripe. No golden restamp.

**Stable Preview origin:** `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`  
**Preview Supabase:** `shhpjsoldmqtkdbgrbtm`  
**Expect SHA:** the commit you just deployed.

Mark each row pass / fail / skip. One paid Analyse per cut is enough.

## 0. Guards

- [ ] Deployment READY on the **branch alias**, not an expired commit URL
- [ ] `BILLING_ENVIRONMENT=test` (never print keys)
- [ ] Site URL / auth callback are the stable Preview origin (no localhost in emails)
- [ ] Feedback email configured
- [ ] Do not open Production (`lxvnylhsbvudzzupxeqr`)

## 1. Auth

- [ ] Signup with a **new** email (fresh org)
- [ ] Confirmation email arrives (Auth SMTP). Sender/subject/CTA sensible. Confirm.
- [ ] Login, logout, login again
- [ ] Forgot password → email → reset (if SMTP reset is enabled)
- [ ] Invalid/expired confirmation shows a friendly state, not a stack trace
- [ ] No social auth offered

## 2. Onboarding

- [ ] Company basics (name, country NZ, timezone)
- [ ] Work areas
- [ ] Pricing basics (labour; margin skip allowed → 20%)
- [ ] Ready → Dashboard, not a setup wall
- [ ] No redirect loop

## 3. First Project → Estimate

- [ ] Create first job from Dashboard
- [ ] Analyse (one paid run if needed)
- [ ] Work Areas confirm
- [ ] Clarify / missing details
- [ ] Estimate generates; loading has no fake percent
- [ ] Review: recommended sell, cost, target GM, GST; Continue to Pricing primary

## 4. Company DNA / Rates

- [ ] Rates: company $/h visible
- [ ] Calibration: at least open the hub; save if testing DNA
- [ ] Estimator (if present) can calibrate, cannot edit org default margin in the UI

## 5. Pricing → Quote → Send → Accept

- [ ] Pricing: no “confirm default margin” nag after onboarding
- [ ] Set own price to a round amount (e.g. $40,000.00) — quoted total matches
- [ ] Create quote
- [ ] Send (Resend). Subject names company + project. CTA “View Quote”. No GM/cost jargon
- [ ] Public `/q/{token}` desktop **and** ~390px: brand, scope, price, GST, terms, Accept/Decline
- [ ] Accept: name, email, typed or drawn signature, acknowledgement
- [ ] `accepted_at` stored UTC; UI shows org timezone
- [ ] Reopen accepted quote: record only, no second accept
- [ ] Contractor quote page shows acceptance evidence

## 6. Returning user

- [ ] Login → Dashboard (no first-run redirect)
- [ ] Open existing Project
- [ ] Stale estimate banner if inputs changed
- [ ] Pricing / Quote status readable

## 7. Dashboard / trial

- [ ] Projects list or first-job CTA
- [ ] One personalisation next step (not a wall)
- [ ] Trial banner: 14–8 subtle, 7–4 stronger, 3–1 urgent, expired blocked + upgrade
- [ ] Expired: can view history; cannot create/send/analyse paid paths

## 8. Billing

- [ ] Billing page: plan or trial, days left, upgrade, portal
- [ ] Copy is human (no Stripe ids)
- [ ] Builder: no Team nav
- [ ] Business: Team nav
- [ ] No card required to start trial

## 9. Roles (Preview Business fixture only — do not incur extra seats unless intended)

- [ ] Viewer: inspect only; no mutate Projects/Estimate/Pricing/Quote/Rates/Team
- [ ] Estimator: projects + estimate + project pricing + calibrate; no org default margin / company rates / paid seats
- [ ] Admin: company rates/settings; Team per BILLING-4 (Owner-only paid invite/remove)

## 10. Mobile ~390px

Walk signup, setup, Dashboard, Project, Analyse, Work, Clarify, Estimate, Review, Pricing, Quote, public Quote, Accept, DNA, Rates, Billing.

- [ ] Primary CTA not behind bottom nav
- [ ] No critical horizontal-only tables
- [ ] Sheets/modals usable

## 11. Errors / empty

- [ ] Forced failure (e.g. send with no client email) is human
- [ ] No `PGRST`, Postgres, Stripe, Resend, Anthropic payloads in the UI
- [ ] Empty Dashboard / no quote / no logo have a next action

## 12. Static verifiers (local)

```
npx --yes tsx scripts/verify-beta-1.ts
npx --yes tsx scripts/verify-beta-1-5.ts
npx --yes tsx scripts/verify-organisation-timezone.ts
npx --yes tsx scripts/verify-beta-2.ts
npx --yes tsx scripts/verify-company-dna-01.ts
npx --yes tsx scripts/verify-company-dna-02.ts
npx --yes tsx scripts/verify-beta-3.ts
npx --yes tsx scripts/verify-beta-launch.ts
npx --yes tsx scripts/verify-security-053.ts
npx tsc --noEmit
npm run build:safe
```

After Preview 053 apply, also run live PostgREST proof:

```
npx --yes tsx scripts/verify-security-053.ts --live
```

No live Stripe. No Production.

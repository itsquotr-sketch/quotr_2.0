# ENVIRONMENT-01 — Owner Preview isolation smoke

**Goal:** A fresh Preview account can run organisation → Company → Project → Estimate → Quote on the **new** Preview database with **no** new rows on Production `lxvnylhsbvudzzupxeqr`.

**Do not** use a Production login. Auth user stores are per project.

---

## Before

- [ ] Preview Supabase project exists and migrations 001–036, 038–045 are applied
- [ ] Vercel **Preview** env points at Preview URL/anon key
- [ ] Preview redeployed
- [ ] `/app/health` on Preview shows Deployment **Preview** and a project ref that is **not** `lxvnylhsbvudzzupxeqr`

---

## Preview (new email)

- [ ] Sign up
- [ ] Confirm email if required; land on Company Basics
- [ ] Save currency / country / GST
- [ ] Login works after logout
- [ ] Optional: add a labour rate
- [ ] Create Project
- [ ] Analyse Job boundary without a paid AI suite if keys are off — app must not 500
- [ ] Generate Estimate when the project is ready (or skip AI and continue from an existing estimate path if Analyse is skipped)
- [ ] Open Pricing
- [ ] Create Quote
- [ ] Open secure client link on the **Preview** origin (`/q/…`)
- [ ] Accept or decline on that Preview link (or confirm the page loads if you stop before submit)

Internal UI may show a **Preview** badge. Public Quote page must **not** show it.

---

## Production isolation

In Production Supabase Table Editor (`quotr_2.0`):

- [ ] No new organisation named as the Preview test company
- [ ] No new profile/email for the Preview test user
- [ ] No new project/quote with the Preview test title

---

## Pass / fail

**Pass:** Preview workflow works and Production tables are unchanged for that identity.  
**Fail:** Preview still lists ref `lxvnylhsbvudzzupxeqr`, or Preview signup appears in Production Auth/users.

Do not start BILLING-1 until this passes.

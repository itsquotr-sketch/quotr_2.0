# Beta launch checklist

Controlled beta = builders can sign up, set up, estimate, price, quote, send, and receive acceptance without broken workflow, raw errors, misleading money, permission leaks, billing confusion, or unsafe public Quotes.

It does **not** require every future feature.

**Go/No-Go uses this list plus** `docs/BETA_LAUNCH_DEFERRED_REGISTER.md`.

## Product

- [ ] First-run → first Project → Estimate → Pricing → Quote → Send → Accept works on Preview
- [ ] Returning login does not loop into setup
- [ ] Supported work areas only; no unbuilt work-type promises
- [ ] Commercial formulas unchanged (cost-first; GM = GP ÷ sell)

## UX

- [ ] Dashboard: projects, one next personalisation step, trial when relevant
- [ ] No setup wall after first-run
- [ ] Pricing does not nag “confirm default margin” after onboarding
- [ ] Quote / Send language is contractor-plain; public language is client-plain
- [ ] Empty and loading states have a next action; no fake percentages
- [ ] Double-submit guarded on Analyse, Pricing save, Quote create/send, Accept, calibration save

## Mobile

- [ ] ~390px full journey (`docs/BETA_SMOKE_TEST.md` §10)
- [ ] 768px / 1440px spot check: no duplicate primary CTAs, no huge dead space
- [ ] Safe-area padding on Pricing, Quote, public Accept

## Permissions

- [ ] Builder: 1 user, no Team nav, full estimating accuracy, DNA, send, accept
- [ ] Business: Team, roles, shared rates; no fake analytics
- [ ] Viewer / Estimator / Admin matrix matches DNA-02.1 + BILLING-4
- [ ] **Do not invite Estimators until migration 053 is approved** (RLS bypass)

## Security

- [ ] Cross-org isolation via `auth_org_id()` holds
- [ ] Public quote is token RPC only; no cost/GM/benchmark in client payload
- [ ] Service-role not in `NEXT_PUBLIC_*`
- [ ] 053 proposal reviewed; **not** applied until owner says so
- [ ] Production not touched

## Email

- [ ] Auth SMTP: signup confirm (+ reset)
- [ ] Resend: quote send (invite if Business)
- [ ] Sender, subject, CTA, domain; no internal jargon
- [ ] Keys never logged

## Billing

- [ ] Trial 14 days, no card upfront
- [ ] Banner bands 14–8 / 7–4 / 3–1 / expired
- [ ] Expired = `read_export`: view history, no new value-producing work; existing public Quote still valid
- [ ] Past-due 7-day grace in code; no live charge in beta
- [ ] Scheduled cancel / cancelled: read/export; no new paid seats; public Quote invariant
- [ ] Preview Stripe **TEST** only

## Environment

- [ ] Preview ref `shhpjsoldmqtkdbgrbtm`
- [ ] `BILLING_ENVIRONMENT=test`
- [ ] Preview keys cannot be used as Production
- [ ] `NEXT_PUBLIC_SITE_URL` = stable branch alias

## Production migration (plan only)

- [ ] Sequence 046→052 documented in `docs/BETA_RELEASE_RUNBOOK.md`
- [ ] 053 proposed, not created
- [ ] No missing 037 (gap is historical and documented)
- [ ] **Do not apply** until owner-approved release

## Rollback

- [ ] App: redeploy previous Preview/Production SHA
- [ ] DB: PITR / restore — confirm backup before Production migration
- [ ] Billing: disable webhook + enforcement fallback
- [ ] Auth / email: revert Site URL / SMTP / Resend independently

## Support

- [ ] Report issue (`NEXT_PUBLIC_FEEDBACK_EMAIL`) visible in sidebar + mobile menu
- [ ] Support path printed for testers (same address)

## Test accounts

- [ ] Fresh org per external tester
- [ ] Internal BETA fixtures stay on Preview, not shared with testers
- [ ] No production-looking demo company name on public Quotes

## Known limitations (testers may be told, plainly)

- Quote expiry uses New Zealand (Auckland) calendar dates
- Two people editing a draft quote at once is not locked
- Logo on an already-sent quote follows the live company logo
- Team invites are Business-only and should wait on 053
- Calibration covers the shipped work types only
- No advanced analytics, voice, or image features

## Go / No-Go

| Option | When |
| --- | --- |
| **GO FOR CONTROLLED BETA** | Owner-only testers, Preview, 053 deferred as known limitation, smoke green |
| **GO WITH KNOWN LIMITATIONS** | Same, plus explicit register items E/F/G/H/L |
| **NO-GO** | Broken signup/quote/accept, money mismatch, cross-org leak, Preview on live Stripe, or Production accidentally in path |

Production is **NO-GO** until 046→052 (+ agreed 053), LIVE Stripe, Auth SMTP, and owner release approval.

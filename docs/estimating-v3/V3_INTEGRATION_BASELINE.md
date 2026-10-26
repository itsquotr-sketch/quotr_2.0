# Estimating V3 — integration baseline

Recorded 27 October 2026. This branch is the V3 integration line. It does not deploy Production, change Play Console, migrate, or write customer projects, rates, or quote snapshots.

## Baseline

| Item | Value |
| --- | --- |
| Integration branch | `estimating/v3` |
| Application baseline before this record | `cfb4188e0fa295abdb1917be5ed4f5d57aafa564` |
| Subject | Record the Stage 1 release and the pre-existing fascia length gap. |
| Website Production | `bc0a7667422927d87368bc151a4e442e61562d5c` on `release/website-estimating-stage-1` |
| Android Production | `ff39ba31` on `release/android-estimating-stage-1` |
| Pre-Stage-1 website | `40d98384cff9a6fb020c92316b54095e5e1ff873` |
| `origin/main` | `383133d8` — no commits that this line lacks |

`git diff d4b6286e bc0a7667` is empty. The website release is the cherry-pick of the Stage 1 estimating patch. `cfb4188e` is that same tree plus the Stage 1 acceptance record. Android `ff39ba31` carries the same estimating patch on `release/android-play`. Those Android-only commits (Play surface, account deletion, asset links) are not merged here.

`preview/project-workspace-spacing` at `68be9916` was clean and was left on that branch. It is not an ancestor of the serving website. Plan confirmation, free signup, and deletion stay on their own branches.

## Comparison baseline

Saved projects, work areas, `project_facts`, company rates, productivity overrides, estimates, and quote snapshots stay readable as they are. This line does not regenerate them. A later calculation-version or migration has to name how those rows stay compatible, and it is not part of Stage 2A. Fascia length remains the Stage 1 gap: the exposed-perimeter fallback is not a measured fascia length.

## Preview environment

Dedicated V3 Preview is a deployment of `estimating/v3` on the existing Vercel project `quotr-2-0` (`prj_fPvYMlTj74oC5vcFolpkCHJJ8s0i`). It uses that project's Preview environment. Production secrets were not copied.

| Identity | Value |
| --- | --- |
| Supabase Preview | `quotr_preview` / `shhpjsoldmqtkdbgrbtm` |
| Supabase Production | `quotr_2.0` / `lxvnylhsbvudzzupxeqr` — not the Preview URL |
| Preview site URL already configured | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` |
| Billing | Hosted Preview refuses to start unless `BILLING_ENVIRONMENT=test`. The local Preview Stripe secret is a test key. The decrypted hosted Stripe secret was not readable with this token and was not copied. |
| Loops | Preview automation may sync only `hello+test@erccontracting.co.nz`. It does not send campaigns. |
| Resend | Present on Preview. This pass does not send quotes or customer email. |

## Stage 2A scope

Reliable handoff from Analysis to Details for explicitly stated scope and facts. Development branch: `estimating/v3-stage-2a`, cut from this integration baseline.

In scope:

- Keep stated partition facts (length, both-side lining, insulation, a door opening, a door assembly, stopping, and explicit painting/skirting exclusions) on the existing wall-type and door-portion contracts.
- Keep separate flooring portions for separate rooms, including carpet tiles as an unpriced specialist rather than broadloom carpet.
- Reuse a work-area UUID when the only change is a display name, and do not attach facts to an ambiguous sibling.
- Leave a confirmed answer in place when reanalysis disagrees, and record the disagreement on the existing `conflict_warning`.
- Leave carpet-tile pricing, quantity formulas, rate precedence, productivity, margin, preliminaries, calibration, and the fascia-length gap unchanged.

Out of scope: a second estimator, a new answer store, a schema migration, Production, and Android behaviour.

## Stage 2A line

| Item | Value |
| --- | --- |
| Development branch | `estimating/v3-stage-2a` |
| Implementation | `bdf18e49` then `11564062` |
| Preview alias | `https://quotr-2-0-git-estimating-v3-stage-2a-quotr1.vercel.app` |
| Integration Preview | `https://quotr-2-0-git-estimating-v3-quotr1.vercel.app` (`dpl_c2vm3yJh9Pu9VYEua2GVxMdNeXWc` at `7e2e0feb`) |
| Preview deployment | `dpl_9DKFFtmVYQeo5dTwMq8mBKxv74Jg` at `bdf18e49`, then the `11564062` deployment on the same alias |
| Isolated fixture | plus-address `hello+v3-stage-2a.b30dcd11@erccontracting.co.nz`, org `9cfc28ea-8eb6-4d81-85b1-3ff7327506ca` |

The shared Preview service-role value was not a `service_role` JWT, so project creation failed closed. A branch-scoped Preview service role, taken from the existing local Preview credential for `shhpjsoldmqtkdbgrbtm`, was added for `estimating/v3` and `estimating/v3-stage-2a` only. Production keys were not copied. The billing page on that Preview loaded plan choices, which the hosted Preview guard allows only when billing is test. No quote or customer email was sent.

The isolated partition job stored length 4.2 m, height 2.4 m, both-side plasterboard, insulation included with the type still open, painting and skirting excluded, and one door opening. Details asked for the unstated framing size. Reload kept the same work-area id. Carpet-tile pricing and the fascia-length fallback remain open. Live model recognition was checked on this one brief only; the other two briefs are covered by the deterministic script.

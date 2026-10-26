# Estimating V3 Stage 0 — baseline

Recorded 26 October 2026 from the repository and the Vercel API. No Production deploy, Play Console change, migration, or customer-record write was made.

## Repository

| Item | Value |
| --- | --- |
| Application root used for this branch | `C:\Users\Admin\Desktop\quotr-estimating-v3` |
| Instructions read | `AGENTS.md` (Next.js agent note), `.cursor/rules/preview-auth-stability.mdc` |
| Isolated branch | `estimating/v3-stage-0` |
| Branch parent | `40d98384cff9a6fb020c92316b54095e5e1ff873` |
| Parent subject | Restore a readable project header and group the estimate workspace. |

The checkout that was already open, `preview/project-workspace-spacing` at `68be9916`, was clean. It was left on that branch. The other local worktrees were clean and were not moved:

- `feat/email-preferences-loops` at `40d98384` (`quotr-website-release`)
- `release/android-play` at `879db760` (`quotr-android-release`)
- `prepare/plan-confirmation-website` at `7691f7d9`
- `preview/account-deletion` at `ce2af94b`
- `preview/android-free-signup` at `90418a26`
- `fix/account-marketing-consent` at `ba2c092a`
- `docs/release-candidate-notes` at `e16352ac`
- `hardening/stage-2a-security` / `fix/hardening-pricing-load` at `58d7681d`
- `release/production-f42553a` at `5c9fe57b`

`estimating/v3-stage-0` is a new worktree. It does not contain the Android-only deletion and play-surface commits that exist on `release/android-play`.

## What is serving

The approved spacing layout is live. That was checked, not assumed.

| Host | Deployment | Status | SHA | Branch | Alias |
| --- | --- | --- | --- | --- | --- |
| `app.get-quotr.com` | `dpl_5yVsMkfnbC5LSWW1K1ZB4NWPwGQj` at `https://quotr-2-0-h96isn5l0-quotr1.vercel.app` | Production, Ready, Promoted | `40d98384cff9a6fb020c92316b54095e5e1ff873` | `feat/email-preferences-loops` | `app.get-quotr.com`, `get-quotr.com`, `quotr-2-0.vercel.app` |
| `play.get-quotr.com` | `dpl_9QwLfefNfSiGwyWRP4hC6uhka24o` at `https://quotr-play-k6gptafo7-quotr1.vercel.app` | Production, Ready, Promoted | `879db76020d2ea327ad70db0c044364e379d9b40` | `release/android-play` | `play.get-quotr.com`, `quotr-play.vercel.app`, and the git branch alias |

The website deployment was created by the CLI. The Android deployment was created from Git. Both record the SHAs above. `aliasAssigned` is true and `aliasError` is null on both.

Signed-out `/login` HTML from `https://app.get-quotr.com/login` and from the website deployment URL had the same SHA-256 prefix `D73962BF97395493`. Both returned HTTP 200.

`https://play.get-quotr.com/login` returned HTTP 200. The raw Android deployment URL returned HTTP 302 to Vercel SSO, so its HTML was not byte-compared. The alias assignment above is the evidence that `play.get-quotr.com` points at that deployment.

Rollback deployments recorded by the same release, and still listed as Ready, are `https://quotr-2-0-hwnk5fshh-quotr1.vercel.app` (`b75291bf`) and `https://quotr-play-8w6f9slbr-quotr1.vercel.app` (`11d413fd`). This pass did not change them.

## Estimating code on the two hosts

`git diff 40d98384 879db760 -- lib/estimate lib/scopes lib/assistant lib/rates lib/pricing lib/commercial-engine lib/ai` is empty. The estimating pipeline on the Android host matches the website SHA this branch starts from.

The hosts still differ outside estimating. Android has the play-surface gate, account-deletion fulfilment, asset links, and the service worker. Those files are not on this branch. Stage 0 does not merge them in and does not remove them from `release/android-play`.

## Why this parent

`68be9916` is the approved preview commit. Production received only the workspace-layout cherry-picks, not that branch’s other ancestry. Starting V3 from `40d98384` keeps the audit on the estimating code customers are running, including the layout that is now live, and leaves plan-confirmation, free-signup, and deletion work on their own branches.

## Not done

Production and Play Console were not changed. No migration was applied. No customer project, rate, or quote was read or written. The eight coverage prompts named in the Stage 0 request were not attached to the request. Coverage uses the six topics that were named, with deterministic briefs in `scripts/verify-estimating-v3-stage0.ts`. No live model call was made.

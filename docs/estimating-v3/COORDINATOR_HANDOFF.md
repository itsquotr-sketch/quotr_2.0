# V3 coordinator handoff

You are the single Development Lead. Continue in this worktree. Do not open another coordinator session. `quotr-scenario-qa` and `quotr-release-review` are invocable here.

## Verified state, 5 November 2026

- `origin/estimating/v3` is `68c5760c50e97b3bccb4f3fab314e7b2c37b9c7d`. Area headings are accepted at that SHA. Do not repeat that QA.
- Integration Preview `dpl_HjWgXJ3NbiSyH8DQDjuVUKRA7zDU` is Ready and serves that SHA at https://quotr-2-0-git-estimating-v3-quotr1.vercel.app. Re-check the deployment identity before any browser test.
- Production remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ`, SHA `bc0a7667422927d87368bc151a4e442e61562d5c` on `release/website-estimating-stage-1`. Do not deploy it.
- Publish with the stored `itsquotr-sketch` Git credential. Do not push as `juansellis` or `jeanluc-wastex`. Do not change git config, remotes, or permissions. Never force-push.
- Dirty checkout `C:\Users\Admin\Desktop\quotr-estimating-v3-integration` is `af4a388b` on local `estimating/v3`. Do not reset or clean it.
- This coordinator checkout is `coord/v3-lead`. The agent files are `.cursor/agents/quotr-scenario-qa.md` and `.cursor/agents/quotr-release-review.md`.

## Approved QA environment

No credentials are stored here. Verify the active organisation before every hosted write.

- Preview alias: https://quotr-2-0-git-estimating-v3-quotr1.vercel.app
- Preview database: `shhpjsoldmqtkdbgrbtm`
- Organisation: `0767b04e-31c2-4679-a275-16201135df02`, name “V3 QA isolated mw2usno8”
- Account: `hello+v3-qa.mw2usno8@erccontracting.co.nz` (plus-address fixture only)
- Sole active membership is that organisation. Setup is complete. GST is not registered. Carpenter and labourer costs are the disclosed Quotr benchmarks. Margin is 20%. Work types are Fence, Retaining wall, and Internal walls. Project count was 0 before the hosted checks.
- Stage 3C isolated (`27d885fc-b175-4c9a-a703-07cd78293592`) is not the session for these checks. Its password was not available and was not reset.
- ERC Contracting, including `jeanluc@erccontracting.co.nz` and `hello@erccontracting.co.nz`, is not authorised. Do not create or edit projects there.
- Do not change memberships, passwords, or billing. Do not use Forgot password or Create account.

## Accepted

- Area headings, at `68c5760c`. Product behaviour is `3308d806` inside that tip. Bedroom 1 `11.52 m²`, Bedroom 2 `14.7 m²`, hallway `9.6 m²`. Stored areas stay `3.6 × 3.2` and `4.2 × 3.5`. QA and release review are complete. Do not repeat them.
- Opening-count deterministic acceptance and Preview integration are complete, at `1288d9ee` inside `475acf23` and later. Raw timber 5.72 lm. Purchase quantity 6.29 lm.

## Still open

### Opening-count hosted persistence

Status: **NOT TESTED**. Area-heading acceptance does not cover it.

Fresh project only, in V3 QA isolated mw2usno8, after the active organisation is verified.

- Six explicit unsized wall openings survive reload.
- Size one to 0.92 × 2.10 m, reload, and the other five stay unsized.
- No quote send. No Pricing review. Do not edit proof projects, organisation settings, or shared rates.

### Fence and retaining-wall journeys

Area formulas already recorded are supporting evidence only: fence face 18 × 1.8 = 32.4 m², retaining face 15 × (1.6 + 0.6) / 2 = 16.5 m². They are not assembly acceptance.

Frozen briefs, from the existing contracts:

- Fence: new 18 m timber paling fence, 1.8 m high, vertical boards, Radiata Pine, 150 × 19 mm, posts at 1.8 m centres, one 0.9 m gate within the run, top capping and gate capping included, paling gap 0.
- Retaining wall: 15 m timber wall, raking from 1.6 m to 0.6 m, H5 SED retaining poles, backfill included, excavation 6 m³ with digger access, drainage included, drainage sock not required, disposal excluded.

Planned live-analysis calls when the authorised session exists: 2, one per brief. Calls made while the browser was ERC Contracting: 0.

Local contract comparison on `68c5760c` matched the frozen quantities for face area, 12 fence posts, 120 palings, 226.8 lm purchased palings at 5% fallback waste, 14 retaining piles, 121 lm purchased 150×50 face boards at 10% default waste, excavation quantity 6 m³, no drainage-sock line, and no disposal line. Retaining hole-excavation labour stays an explicit Pricing Required gap. Do not invent a rate or a structural specification. Do not select a recipe repair until the hosted journeys store scope and survive reload.

## Workflow

Freeze criteria, use a clean feature worktree, commit, invoke `quotr-scenario-qa`, fix failures yourself, invoke `quotr-release-review`, then fast-forward Preview. One QA worker. Browser use stays sequential. No recursive delegation. Verify each worker’s checkout, serving SHA, and test-data boundary. Subagent files do not isolate the database or the browser.

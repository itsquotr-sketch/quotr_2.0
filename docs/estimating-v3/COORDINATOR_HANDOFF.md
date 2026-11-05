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
- Opening-count hosted persistence, on project `f87a1677-59d4-4c19-93cb-295acbfffad2` in V3 QA isolated mw2usno8. Six door openings stayed unsized across a reload. One opening, the active sixth `9b451a38-863b-42a8-b73b-86c13692ecf7`, then stored 0.92 m by 2.10 m and survived a second reload. The other five stayed empty. No quote was sent and Pricing was not reviewed. Do not edit this project. Do not repeat the check.
- Fence and retaining-wall journeys, on `68c5760c`. Fence project `f7a1095c-8928-4a6c-82a1-f8603d1e88fd`. Retaining project `13eaab78-aaf0-445e-a030-61cc37e73e0d`. Two live analyses, then a retest with none. Stored quantities matched the contract: fixed fence 17.1 m separate from the 0.9 m gate and the gate frame; 12 posts; 120 palings; purchased posts 28.8 lm; rails 53.865 lm; palings 226.8 lm at the 5% fence factor; retaining face 16.5 m²; 14 piles; face boards 121 lm at 10%; excavation 6 m³; no sock line; no disposal line. Hole-excavation labour stays Pricing Required. Face boards stayed the disclosed 150×50 H4 assumption. Benchmark sells were $5,155.97 and $4,861.33 and were not scored as assembly confirmation. No recipe repair. Do not edit these projects or repeat the journeys.

## Still open

### Pile replacement allowance

The completion register’s next money gap. When replacement is explicit and the new support lines are absent, the calculator still prices the pile/post replacement allowance. When those support lines are already present, the allowance is excluded from the total and the price is marked incomplete. The allowance’s coverage is unresolved. Do not remove or reprice it without a commercial decision.

The work-area “All priced” chip beside an Incomplete overview stays deferred.

## Workflow

Freeze criteria, use a clean feature worktree, commit, invoke `quotr-scenario-qa`, fix failures yourself, invoke `quotr-release-review`, then fast-forward Preview. One QA worker. Browser use stays sequential. No recursive delegation. Verify each worker’s checkout, serving SHA, and test-data boundary. Subagent files do not isolate the database or the browser.

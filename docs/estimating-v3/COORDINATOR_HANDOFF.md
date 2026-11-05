# V3 coordinator handoff

You are the single Development Lead. Continue in this worktree. Do not open another coordinator session. If `quotr-scenario-qa` and `quotr-release-review` are not invocable here, stop and say so.

## Verified state, 5 November 2026

- `origin/estimating/v3` is `475acf23b4cccf9fdea3264ff3de0905f5cf6969`. No newer remote commit at handoff.
- Integration Preview `dpl_CwgPuE9RCy4vmV8BNBz6zStQbkwb` is Ready and serves that SHA at https://quotr-2-0-git-estimating-v3-quotr1.vercel.app. Re-check the deployment identity before any browser test.
- Production remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ`, SHA `bc0a7667422927d87368bc151a4e442e61562d5c` on `release/website-estimating-stage-1`. Do not deploy it.
- Publish with the stored `itsquotr-sketch` Git credential. Do not push as `juansellis` or `jeanluc-wastex`. Do not change git config, remotes, or permissions. Never force-push.
- Dirty checkout `C:\Users\Admin\Desktop\quotr-estimating-v3-integration` is `af4a388b` on local `estimating/v3`. Do not reset or clean it.
- This coordinator checkout started at `475acf23` on `coord/v3-lead`. The agent files are `.cursor/agents/quotr-scenario-qa.md` and `.cursor/agents/quotr-release-review.md`.

## Evidence already published

- Opening-count evidence: `docs/v3-opening-count-evidence` at `08e21d3926d83d06111a5ecc7a4b633e909d828e`. Deterministic acceptance passed. Raw timber is 5.72 lm. Purchase quantity is 6.29 lm. Preview integration only.
- Fence and retaining record: `docs/v3-fence-retaining-scenarios` at `d922ddaa27358cc8be0a33768ea7b45c9c918e6d`. Two area-formula checks only: 18 × 1.8 = 32.4 m² and 15 × (1.6 + 0.6) / 2 = 16.5 m². Not assembly acceptance.

## Pending, in order

### A. Opening-count hosted smoke

Integration `475acf23`. Fresh QA project in organisation `27d885fc-b175-4c9a-a703-07cd78293592` (“Stage 3C isolated” on Preview `shhpjsoldmqtkdbgrbtm`). Confirm that identity before writing.

- Six explicit unsized wall openings survive reload.
- Size one to 0.92 × 2.10 m, reload, and the other five stay unsized.
- Do not edit proof projects, organisation settings, or shared rates. No quote send. No Pricing review.

The Cursor testing browser had no session. Sign-in URL: https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/login?next=%2Fapp. Bring that browser forward and ask for the existing account sign-in. Do not reset a password or create an account.

### B. Area-heading candidate

- Branch `estimating/v3-area-headings` at `4d65d4cf7b2fa66090b64a8e662fb2fe6f7c1d3a`.
- Product commit `3308d8067c5f526ee127b5c47c09d329d201bab1`.
- Worktree `C:\Users\Admin\Desktop\quotr-v3-area-headings`.
- Handoff: `docs/estimating-v3/candidates/area-heading-handoff.md` in that worktree.
- Display only. Bedroom 1 shows `11.52 m²`, Bedroom 2 `14.7 m²`, hallway `9.6 m²`. Stored areas stay `3.6 × 3.2` and `4.2 × 3.5`.
- Focused check already passed: `npx tsx scripts/verify-estimating-v3-stage-2e.ts`. QA repeats it. QA does not edit application code.
- No Preview URL yet. Publish the candidate branch only if QA needs a hosted build. Do not merge it into `estimating/v3` before release review.
- Declared live model calls: 0.

### C. After B

Establish one representative fence journey and one retaining-wall journey. The area-formula checks do not count. Use existing contracts. Declare the live model-call count before any batch. Do not select a recipe repair until those journeys exist.

## Workflow

Freeze criteria, use a clean feature worktree, commit, invoke `quotr-scenario-qa`, fix failures yourself, invoke `quotr-release-review`, then fast-forward Preview. One QA worker. Browser use stays sequential. No recursive delegation. Verify each worker’s checkout, serving SHA, and test-data boundary. Subagent files do not isolate the database or the browser.

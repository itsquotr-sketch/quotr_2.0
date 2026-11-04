# Opening-count candidate handoff

Copied from [V3_CANDIDATE_HANDOFF.md](../V3_CANDIDATE_HANDOFF.md) for candidate `1288d9ee387207fa4f4bdfa7daa26199360d8efd`. The reusable template is unchanged.

The raw-timber expectation below is corrected from 5.61 lm to 5.72 lm. The earlier figure used an unstated 810 mm header: 2 × 2.4 + 0.81 = 5.61. The stated header is the sized opening width, so 2 × 2.4 + 0.92 = 5.72. Purchase quantity stays 6.29 lm under the existing 10% waste rule: round2(5.72 × 1.10) = 6.29.

## Task and user outcome

- Task: A brief that says “six door openings” was stored as one door opening. Keep a stated door-opening count as one unsized opening each.
- User outcome: The opening count matches the brief. Width and height stay empty until the user supplies them. Six door sets stay door work.

## Identity

- Baseline SHA: `01e4b508c062dbee0bd46c12b763d77996308122` (`origin/estimating/v3` after fetch on 5 November 2026; parent of the candidate).
- Candidate SHA: `1288d9ee387207fa4f4bdfa7daa26199360d8efd`
- Preview URL: https://quotr-2-0-git-estimating-v3-opening-count-quotr1.vercel.app
- Branch: `estimating/v3-opening-count`
- Setup checkout: `C:\Users\Admin\Desktop\quotr-v3-agent-setup` at `73ca5436c5ea9670f40f7e6fc14f4c4326b06a81`. This tree is the agent setup. It is not the application under test. Do not run application checks here.
- QA checkout: `C:\Users\Admin\Desktop\quotr-v3-opening-count-qa`, detached HEAD at the candidate SHA. The development worktree `C:\Users\Admin\Desktop\quotr-v3-opening-count` is a separate clean checkout of the same SHA and is not the QA worktree.
- Candidate diff against the baseline: `lib/estimate/internal-walls-brief.ts`, `scripts/verify-estimating-v3-stage-2a.ts`, `docs/estimating-v3/V3_COMPLETION_REGISTER.md`. The product change is the loop that writes one unsized door opening per stated count when that wall type has no saved door opening.

## Local agent configuration

The QA checkout did not contain the project agents. These two files were copied in as untracked local configuration and are not part of the application tree:

- `C:\Users\Admin\Desktop\quotr-v3-opening-count-qa\.cursor\agents\quotr-scenario-qa.md`
- `C:\Users\Admin\Desktop\quotr-v3-opening-count-qa\.cursor\agents\quotr-release-review.md`

`git status` in that checkout shows `?? .cursor/agents/` only. Do not commit, stage, or amend those files. Do not edit application source, tests, or acceptance criteria there.

## Frozen acceptance criteria

From the candidate register. Unchanged.

1. “Six door openings” on a new partition stores six door openings. Width and height stay empty. No 810×1980 size is invented.
2. Those unsized openings add no opening price. The estimate asks for the opening width and height.
3. Applying the same brief again does not create twelve openings.
4. A door opening the user already saved is not expanded to a later stated count.
5. “Six door sets” remains door work. It does not become one wall opening, and it does not become six openings.
6. One stated door opening still stores one opening.
7. No schema, rate, credential, or Production change. Saved opening rows are not rewritten.

## Independent expected behaviour

Calculate these before comparing them with output. A test answer is not an extracted fact.

Brief A, openings: “Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, six door openings. Painting and skirting excluded.”

- One wall type. Length 4.2 m. Height 2.4 m. Timber frame. Plasterboard both sides. Painting excluded. Skirting excluded.
- `doorOpeningCount` is 6. Six opening rows. Each type is a door opening. Each `width_m` and `height_m` is empty.
- No 810 mm × 1980 mm, and no other width or height, is written by extraction.
- “Six door openings” does not become six door sets. Door-portion quantity is not 6 from this sentence.
- Opening recommended sell from those six rows is 0. Missing information includes “Add the opening width and height.”
- Applying Brief A again keeps six openings and the first opening id.
- A wall type that already has one saved door opening stays at one opening and keeps that opening id when Brief A is applied later.
- One stated door opening, the existing partition sentence with “one door opening”, still stores one unsized opening.

Sizing one opening is an explicit test answer, not extraction. Write 0.92 m wide and 2.10 m high on one of the six. Leave the other five empty.

- Only the sized opening is eligible for takeoff. Timber opening framing is emitted once for that opening id: 2 trimmers × 2.4 m wall height = 4.80 lm, header 0.92 lm, cripples 0, raw timber 5.72 lm. With null wastage settings the timber fallback is 10%, so purchase timber is 6.29 lm. The other five openings add no framing quantity and stay unresolved.
- Lining deduction uses complete geometry only. That one opening deducts 0.92 × 2.10 = 1.932 m² once per lined face. Gross face stays 4.2 × 2.4 = 10.08 m². Net face is 8.148 m². The five unsized openings deduct 0.
- Opening labour for a sized opening is an unpriced owner-rate line. It is not an opening price, and it is not copied onto the unsized openings.

Brief B, door sets only: “Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, and include six door sets.”

- Wall `doorOpeningCount` is null. Opening row count is 0. `has_openings` stays unset.
- Door work may carry quantity 6. That quantity does not create one wall opening or six wall openings. Door width is not invented.

Confirmed answers and wall-type ownership, already on the baseline:

- A user-confirmed value stays when reanalysis disagrees, and the disagreement is a review warning. An assumption is not promoted to a confirmed answer. The same confirmed value does not raise a conflict.
- Reanalysis keeps the saved wall-type id and the saved opening id.
- Reload, where a hosted session exists, shows the same opening ids and the same width and height answers after a full page reload.

## Contracts and developer checks

- Contracts: `lib/estimate/internal-walls-brief.ts` (`explicitInternalWallsOpenings`, `applyExtractedInternalWallsToFacts`), `lib/estimate/internal-walls-openings.ts` (eligibility and timber takeoff), `lib/estimate/internal-walls-opening-physical.ts`, `lib/estimate/doors-brief.ts`. Register: `docs/estimating-v3/V3_COMPLETION_REGISTER.md` on the candidate.
- Focused test command, from the QA checkout only:

```
npx --yes tsx scripts/verify-estimating-v3-stage-2a.ts
```

- The implementation note said this command passed 46 on the candidate before handoff. That is not a QA result. Run it again and record this run.
- `node_modules` was absent on the new QA checkout. `npm ci` is allowed so the command can run. Do not change the lockfile or any tracked file.
- An independent quantity check may be a new script under the evidence path only. Do not add it to `scripts/` and do not edit the stage 2A verifier.

## QA organisation and data boundaries

- Authorised Preview test organisation: none for this candidate.
- The Stage 2A proof organisation `9cfc28ea-8eb6-4d81-85b1-3ff7327506ca` (`hello+v3-stage-2a.b30dcd11@erccontracting.co.nz`) is an existing proof record. Do not reuse it.
- Do not sign in as `jeanluc@erccontracting.co.nz` or `hello@erccontracting.co.nz`, and do not use any mailbox without a plus-address.
- Do not call an admin password update. Do not create a fixture by rotating a password. Do not substitute another existing customer organisation.
- Fresh QA projects only, and only if a plus-address organisation created for this proof is already available without a credential change. Do not modify shared rates or existing proof records.
- No Production data. No migrations, deploys, merges, quote sends, or Pricing review.
- This session’s browser had no open Quotr tab at handoff. If that is still true, hosted product behaviour is BLOCKED. Still verify the Preview deployment SHA if the deployment metadata is readable. If the URL serves a different SHA, report BLOCKED and do not test hosted behaviour.
- Canonical owner testing host remains `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`. Do not treat the candidate’s unique Vercel hostname as that host.

## Developer check results

- SHA tested by implementation, not by this QA handoff: `1288d9ee387207fa4f4bdfa7daa26199360d8efd`
- Command and result claimed before QA: `npx tsx scripts/verify-estimating-v3-stage-2a.ts` passed 46. No live model calls. QA repeats the command itself.

## Evidence

- QA results: [opening-count-qa.md](opening-count-qa.md)
- Release verdict: [opening-count-release-review.md](opening-count-release-review.md)
- The release reviewer did not write the verdict file. The lead recorded it.

## Workflow

1. The lead fetched `origin/estimating/v3` and `origin/estimating/v3-opening-count` without changing the setup checkout.
2. The lead invokes `quotr-scenario-qa` with this handoff and the QA checkout.
3. If QA returns FAIL, the lead returns the findings. QA does not fix the application.
4. After QA passes, the lead invokes `quotr-release-review` with the same SHAs, these frozen criteria, and the QA report.
5. This task does not merge, deploy, push `estimating/v3`, or change Production.

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

## Authority

Routine development and bounded repairs toward the V3 finish line stay authorised inside Preview. Do not stop implementation because an earlier note said no further code repair was authorised. Ask Jean-Luc only for a material product decision or a protected operation. Protected operations are Production, passwords, memberships, billing, ERC Contracting writes, quote send, and Pricing review.

## Product direction

[V3_COMPLETION_REGISTER.md](V3_COMPLETION_REGISTER.md) is the only finish plan. Do not open a second plan. The pile-allowance decision is adopted there. Deferred families are proposed scope decisions, not approved exclusions. Do not repeat the area-heading, opening-count, fence, or retaining desktop checks without contrary evidence. Fence and retaining mobile checks are still outstanding.

## Workflow

Freeze criteria, use a clean feature worktree, commit, invoke `quotr-scenario-qa`, fix failures yourself, invoke `quotr-release-review`, then fast-forward Preview. One QA worker. Browser use stays sequential. No recursive delegation. Verify each worker’s checkout, serving SHA, and test-data boundary. Subagent files do not isolate the database or the browser.

## User-facing progress record

Jean-Luc’s spreadsheet is the user-facing V3 progress record: https://docs.google.com/spreadsheets/d/1ADe_0lYE5jnapViIgH4XT1kRfxVy6Ni_XrJE51VSQHY/edit

Read Tracking Guide before writing. Tests and General Notes stay his original observations. Development Tracker is the current state. Progress Log preserves every change. Repository documents, including [V3_COMPLETION_REGISTER.md](V3_COMPLETION_REGISTER.md), stay technical evidence and are linked from the tracker.

For every material discovery, fix, QA result, blocker and publication:

1. Update the existing Development Tracker issue, or create the next stable `V3-###` ID when the cause is distinct. Reuse an issue for the same cause and link every relevant QT and QDR ID.
2. Record the owner, next action, exact SHA, evidence and environment.
3. Append a dated Progress Log entry. Preserve earlier entries. A same-status event is still logged.
4. Keep implemented, QA passed, published and verified resolved apart. Local tests do not establish hosted acceptance. A parent-SHA test is not acceptance of a later commit. Published is not verified resolved.
5. End each report with the issue IDs updated and any remaining blockers.

Before each new testing review, re-read Tests and General Notes. Reconcile new or changed observations with existing issues. Do not rerun unchanged accepted evidence. A blank row or an empty score is untested. Do not mark it passed or failed.

If spreadsheet access fails, report “Spreadsheet update pending”, retain the proposed tracker and log rows in this handoff, and continue independent authorised work. Never claim the sheet was updated without reading the written cells back. Keep passwords, tokens, service keys and private recovery URLs out of the workbook.

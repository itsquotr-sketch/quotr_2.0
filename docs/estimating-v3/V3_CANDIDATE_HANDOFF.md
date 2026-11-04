# V3 candidate handoff

Copy this for one candidate. Do not change the frozen criteria after QA starts.

## Task and user outcome

- Task:
- User outcome:

## Identity

- Baseline SHA:
- Candidate SHA:
- Preview URL:
- Branch:

## Frozen acceptance criteria

1.

## Contracts and developer checks

- Contracts:
- Focused test commands:

## QA organisation and data boundaries

- Authorised Preview test organisation:
- Fresh QA projects only. Do not modify shared rates or existing proof records.
- No Production data. No migrations, deploys, merges, quote sends, or Pricing review.

## Developer check results

- SHA tested:
- Commands and results:

## Evidence

- QA report path:
- Review verdict path:

## Workflow

1. The lead implements the candidate and runs the focused developer checks.
2. The lead explicitly invokes `quotr-scenario-qa` with this handoff.
3. If QA returns FAIL, the lead fixes the candidate and requests a targeted retest of the failed criteria.
4. After QA passes, the lead explicitly invokes `quotr-release-review` with the same SHAs, the frozen criteria, and the QA report.
5. After APPROVE FOR PREVIEW INTEGRATION, the lead performs the authorised Preview integration and a short integration smoke check.

Invocation is explicit: `/quotr-scenario-qa` or `/quotr-release-review` in a session that has loaded these project agents. Neither agent runs on a schedule, from a hook, or on every edit. Neither agent delegates further.

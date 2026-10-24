# Account-deletion requests

Jean-Luc Ellis (jeanluc@erccontracting.co.nz) is the initial operator. The tool refuses every other operator, and it refuses his own login. A second operator is required before that login can be deleted.

A request is not deletion. The states are requested, verified, processing, and completed. Completed means the personal login was deleted. It does not mean the company was closed.

Production schema changes are not part of this procedure. Migrations 121 and 122 stay on Preview until the owner accepts them.

## States

- **Requested.** The ask is stored. Identity is not verified. No destructive action is allowed.
- **Verified.** A signed-in person accepted their current password, or an operator has otherwise confirmed a public request by that person signing in and confirming. Still nothing is deleted.
- **Processing.** The operator started a confirmed fulfilment. The login is not gone until the status is completed.
- **Completed.** The Supabase Auth user was deleted. The profile and that person’s membership cascade from it.

## What can be fulfilled

The Preview command is:

```
npx tsx scripts/fulfil-account-deletion.ts --request <id> --operator jeanluc@erccontracting.co.nz
```

That is a dry-run. It prints the effects and deletes nothing. Execution also requires `--confirm delete-personal-account`. The project must be Preview `shhpjsoldmqtkdbgrbtm`.

Execution is allowed only when all of these are true:

- The operator is Jean-Luc Ellis, and the target is not that same login.
- Identity is verified.
- The person is not an active member alongside anyone else.
- The company has no issued quote (`sent_at` is empty for every quote).
- No subscription row is stored for the company.
- No project, quote, pricing document, project note, or note proposal references the profile.

The effects of that case are:

1. Record the email in `account_deletion_suppressions` before the login is deleted. Later Loops updates see that row and do not create the contact again.
2. Delete the Loops contact when `LOOPS_API_KEY` is configured. If it is not configured, the suppression row still stands.
3. Delete the Supabase Auth user. The profile and membership cascade. Organisation storage is not a personal bucket and is not removed.
4. Mark the request completed and store the retained rows with their reasons.

The company row is retained. Closing a company is a separate decision. Deleting the company would cascade its projects, quotes, and subscription rows, so this tool does not do it.

## What cannot be fulfilled yet

- A public request that is still **requested**. Identity has to be verified first.
- An owner with other active members. The request stays **verified** with resolution `needs_support` and is not refused. Support resolves the company at hello@get-quotr.com. Ownership cannot be transferred in the product, so the login is not deleted.
- Any issued quote. Customer links stay on `https://app.get-quotr.com/q/…`. Variation links stay on `https://app.get-quotr.com/v/…`. The login is not deleted while a quote or project references the profile.
- A stored `org_subscriptions` row. The subscription stays with the company. Cancellation stays on the Quotr website. The login is not removed while that row exists, because the company would be left billed and without an owner.
- The operator’s own login.

No separate product retention period is set. A retained row names the record and the reason. It does not name a number of days.

## Issued-document links

- No issued quote: there is no customer link to change.
- Issued quotes exist: the links stay on the website. The request is not completed.
- Other people remain: the links stay, whether or not a quote was sent. Support resolves the company.
- Completed personal deletion: this only happens when no issued quote existed, so no customer link is removed.

## Owner decisions still open

- A second operator, so the initial operator’s own login can be fulfilled.
- How ownership is transferred before a company with other members can lose its owner.
- Whether `created_by` on projects and quotes may be detached so a personal login can be deleted while the issued link stays.
- Who cancels a Stripe subscription on the website before a sole member’s login can be removed.
- Whether an empty company left behind by a completed personal deletion should later be closed.

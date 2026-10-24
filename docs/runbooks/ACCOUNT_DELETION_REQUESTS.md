# Account-deletion requests

Jean-Luc Ellis (jeanluc@erccontracting.co.nz) is the initial operator. The tool refuses every other operator, and it refuses his own login. A second operator is required before that login can be deleted. Do not invent that second person.

A request is not deletion. The states are requested, verified, processing, and completed. Completed is written only after the personal login delete succeeds, and the stored outcome names what was deleted and what was kept. An unresolved request stays requested, verified, or processing.

Personal deletion, company closure, and subscription cancellation are separate. This tool deletes a personal login. It does not close a company and it does not cancel a subscription.

Production schema changes are not part of this procedure. Migrations 121, 122, and 123 stay on Preview until the owner accepts them.

## States

- **Requested.** The ask is stored. Identity is not verified. No destructive action is allowed.
- **Verified.** A signed-in person accepted their current password. Still nothing is deleted.
- **Processing.** The operator started a confirmed fulfilment. The login is not gone until the status is completed.
- **Completed.** The Supabase Auth user was deleted, and `retained.summary` describes the login deletion and every retained record. A completed row without that summary is an incomplete record.

## What can be fulfilled

The Preview command is:

```
npx tsx scripts/fulfil-account-deletion.ts --request <id> --operator jeanluc@erccontracting.co.nz
```

That is a dry-run. It prints the proposed effects and deletes nothing. Execution requires `--confirm delete-personal-account`. The project must be Preview `shhpjsoldmqtkdbgrbtm`.

Add the confirmation that matches the dry-run:

- `--continuing-member <user id>` when the person is the owner and other active members remain, or when a required author pointer has to move to an existing member.
- `--retain-subscription` when an `org_subscriptions` row exists. This confirms the row stays. It does not cancel it.
- `--retain-issued-documents` when a quote has `sent_at`. Customer links stay on `https://app.get-quotr.com/q/…`. Variation links stay on `https://app.get-quotr.com/v/…`.

Execution is allowed only when all of these are true:

- The operator is Jean-Luc Ellis, and the target is not that same login.
- Identity is verified.
- An owner with other active members has a named continuing member. The tool makes that member the owner, then deletes only the departing login. The company row stays. If no continuing member is named, the request stays verified with resolution `needs_support` and is not refused.
- A required author pointer is either moved to that continuing member or, for a sole owner, cleared. Project, quote, and document rows are not deleted.
- A subscription or issued document has its own retention confirmation. The subscription status is not changed.

The effects are:

1. Record the email in `account_deletion_suppressions` before the login is deleted. Later Loops updates see that row and do not create the contact again.
2. Delete the Loops contact when `LOOPS_API_KEY` is configured. If it is not configured, the suppression row still stands.
3. Clear or move personal author pointers. The foreign keys stay `ON DELETE RESTRICT`. A pointer that cannot be cleared stops the login delete, and the request is not completed.
4. Delete the Supabase Auth user. The profile and that person's membership cascade. Organisation storage is not a personal bucket and is not removed.
5. Mark the request completed and store the outcome with the retained rows and their reasons.

The company row is retained. Closing a company is a separate decision. Deleting the company would cascade its projects, quotes, and subscription rows, so this tool does not do it.

Migration 123, on Preview only, allows a sole owner's project author pointer to be empty. It does not drop the foreign key. Until that migration is on a database, a sole owner whose project still requires an author cannot be completed.

## What cannot be fulfilled yet

- A public request that is still **requested**. Identity has to be verified first.
- The operator’s own login, until a real second operator is named.
- Company closure.
- Subscription cancellation. Cancellation stays on the Quotr website. This tool never calls Stripe.

No separate product retention period is set. A retained row names the record and the reason. It does not name a number of days.

## Issued-document links

- No issued quote: there is no customer link to change.
- Issued quotes exist: the links stay on the website. The login can be deleted only after `--retain-issued-documents`.
- The quote row stays. Its personal author pointer is cleared. The public link is not removed.

## Decisions and the resolution used here

- **Second operator.** Still required before Jean-Luc Ellis’s own login can be deleted. Leave that login blocked until a real second operator is added to the tool.
- **Ownership transfer.** The operator names an existing active member. The tool releases the one-owner constraint by changing the departing owner first, then sets the named member as owner. If nobody can continue, the request stays verified.
- **Author pointers.** Nullable pointers are cleared. Pointers that a database requires are moved to the continuing member. A sole owner’s required pointer is cleared only where migration 123 has made the column nullable. The business row stays either way.
- **Subscription.** The row stays with the company. Personal deletion does not cancel it. The operator confirms that retention separately.
- **Empty company.** A company with no members after a sole-owner deletion stays. Do not auto-close it, because closing it would cascade the retained projects, quotes, and subscription.

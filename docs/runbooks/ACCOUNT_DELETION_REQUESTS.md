# Account-deletion requests

Jean-Luc Ellis (jeanluc@erccontracting.co.nz) is the initial operator. The tool refuses every other operator, and it refuses his own login. A second operator is required before that login can be deleted. Do not invent that second person.

A request is not deletion. The states are requested, verified, processing, and completed. Completed is written only after the personal login delete succeeds, and the stored outcome names what was deleted and what was kept. An unresolved request stays requested, verified, or processing.

Personal deletion, company closure, and subscription cancellation are separate. This tool deletes a personal login. It does not close a company and it does not cancel a subscription.

Migrations 121, 122, and 123 are the schema for this flow. They are applied on Production. The fulfilment command can dry-run Production. Production execution is enabled for the authorised operator and has not been exercised against a real account.

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

That is a dry-run. It prints the proposed effects and a `review` value, and it deletes nothing. Preview execution requires `--confirm delete-personal-account` and the Preview project `shhpjsoldmqtkdbgrbtm`.

A Production URL accepts `--production-dry-run`. Production execution is a separate command. It requires all of these together:

- `--production-execute`
- `--project-ref lxvnylhsbvudzzupxeqr`, matching the Production URL exactly
- `--request` for one verified request
- `--operator jeanluc@erccontracting.co.nz`
- `--dry-run-review` equal to the `review` value from the current dry-run
- `--confirm delete-personal-account`

The command reads the request again before it deletes anything. If the review no longer matches, the login stays. `--confirm` by itself does not execute a Production deletion. This mode has not been exercised against a real account.

Add the confirmation that matches the dry-run:

- `--continuing-member <user id>` when the person is the owner and other active members remain, or when a required author pointer has to move to an existing member.
- `--retain-issued-documents` when a quote has `sent_at`. Customer links stay on `https://app.get-quotr.com/q/…`. Variation links stay on `https://app.get-quotr.com/v/…`.
- A sole owner's Stripe subscription is read from Stripe with `STRIPE_SECRET_KEY` on the operator machine before anything is deleted. The stored `org_subscriptions` row is not enough. The customer id and subscription id must match. The provider must show the subscription is canceled or will not renew. If Stripe cannot be read, the ids differ, or it is still set to renew, the login stays. The outcome names the provider status, any outstanding payment, and the service end. This command does not cancel or change Stripe. The Android host does not receive the Stripe secret and does not gain a purchase path.

Execution is allowed only when all of these are true:

- The operator is Jean-Luc Ellis, and the target is not that same login.
- Identity is verified.
- An owner with other active members has a named continuing member. The tool makes that member the owner, then deletes only the departing login. The company row stays. If no continuing member is named, the request stays verified with resolution `needs_support` and is not refused.
- A required author pointer is either moved to that continuing member or, for a sole owner, cleared. Project, quote, and document rows are not deleted.
- Issued documents need `--retain-issued-documents`. A subscription is classified from the `org_subscriptions` row. The tool does not change that status.

The effects are:

1. Record the email in `account_deletion_suppressions` before the login is deleted. That row stops a later Loops update from creating the contact again. It does not remove a contact that already exists at Loops.
2. Delete the Loops contact, or confirm that Loops has no contact for the email. A missing `LOOPS_API_KEY`, or any other failure, stops the login delete. The request is not completed.
3. Suppress unreleased rows in `marketing_engagement_reminders` for this person so a scheduler cannot send during the delete. Those rows, and `marketing_optional_email_sends`, reference the profile and go with it.
4. Clear or move personal author pointers. The foreign keys stay `ON DELETE RESTRICT`. A pointer that cannot be cleared stops the login delete, and the request is not completed.
5. When the departing person owns the company, make the named member the owner and then read the membership and the profile. If that handoff fails, the departing owner is restored so the company is not left without an active owner. Completion continues only when the named member's membership role is owner, `profiles.org_id` and `profiles.role` show they can administer the company, and an active owner who is not the departing person remains. Otherwise the login stays and the request stays open. A later run repeats the safe steps: an existing suppression, an absent Loops contact, an owner who is already in place, and author pointers that are already cleared are not done again. The request is marked completed only after the login is gone and the phone, profile, and reminder rows are gone.
6. Delete the Supabase Auth user. The profile, that person's membership, and the phone reservation in `account_phone_numbers` cascade. Organisation storage is not a personal bucket and is not removed.
7. Count remaining phone, profile, and reminder rows. If any remain, the request is not marked completed.
8. Mark the request completed and store the outcome with the retained rows and their reasons. Issued document rows stay so the public quote and variation links keep working. The stored outcome names each retained identifier's reason. No separate product retention period is set.

The company row is retained. Closing a company is a separate decision. Deleting the company would cascade its projects, quotes, and subscription rows, so this tool does not do it.

Migration 123 is applied on Production and Preview. It allows a sole owner's project author pointer to be empty. It does not drop the foreign key.

## What cannot be fulfilled yet

- A public request that is still **requested**. Identity has to be verified first.
- The operator’s own login, until a real second operator is named.
- Company closure.
- Subscription cancellation. Cancellation stays on the Quotr website. This tool reads Stripe for a sole owner and does not change the subscription.

No separate product retention period is set. A retained row names the record and the reason. It does not name a number of days.

## Issued-document links

- No issued quote: there is no customer link to change.
- Issued quotes exist: the links stay on the website. The login can be deleted only after `--retain-issued-documents`.
- The quote row stays. Its personal author pointer is cleared. The public link is not removed.

## Decisions and the resolution used here

- **Second operator.** Still required before Jean-Luc Ellis’s own login can be deleted. Leave that login blocked until a real second operator is added to the tool.
- **Ownership transfer.** The operator names an existing active member. The tool releases the one-owner constraint by changing the departing owner first, then sets the named member as owner. If nobody can continue, the request stays verified.
- **Author pointers.** Nullable pointers are cleared. Pointers that a database requires are moved to the continuing member. A sole owner’s required pointer is cleared only where migration 123 has made the column nullable. The business row stays either way.
- **Subscription.** An `org_subscriptions` row stays. A sole owner is completed only after Stripe itself confirms the matching customer and subscription are canceled or will not renew, and the outcome names any outstanding payment and the service end. A stored mirror that says cancellation is scheduled is not that confirmation. Naming a continuing member transfers ownership first, and completion waits until that member can administer the company. Personal deletion does not call a Stripe write.
- **Empty company.** A company with no members after a sole-owner deletion stays. Do not auto-close it, because closing it would cascade the retained projects, quotes, and subscription.

# Account-deletion requests

A row in `account_deletion_requests` records that a person asked for their account to be closed. The product does not delete the login, the company, issued quotes, or the subscription.

Production schema changes are not part of this procedure. Apply the request table to Preview only until the owner accepts it for Production.

## What the request already checked

Signed-in requests set `identity_confirmed` only after the current password is accepted. Public requests stay unconfirmed. Do not treat an unconfirmed public request as proof of identity.

`resolution = needs_support` means other active members still belong to the company. That is not a refusal. There is no ownership transfer. Do not remove those members, and do not delete the company, to make the owner’s request succeed.

`issued_quote_count` counts quotes for that company with `sent_at` set. `subscription_status` is the subscription status read at request time, or empty when billing could not be read.

## Fulfilment, when an operator is actually going to delete

1. Confirm identity. A signed-in row with `identity_confirmed` has already accepted the current password. An unconfirmed public row still needs the person to sign in and confirm, or a separate check that the request came from them. Do not delete from an unconfirmed row.
2. Read the open row for that normalised email. Do not create a second open request.
3. Do not delete `auth.users` or `profiles` while projects or quotes still reference that profile. Those foreign keys reject the delete.
4. Do not delete the organisation. That cascade removes projects, quotes, and subscription rows.
5. If other people are active members, stop the data deletion. Email them and the owner from hello@get-quotr.com and agree what happens to the company. The product cannot transfer ownership.
6. Do not cancel a Stripe subscription from this table. Cancellation stays on the Quotr website. Leave `org_subscriptions` and `org_billing_customers` in place. The Privacy Notice already says subscription and tax records may be kept for the period New Zealand tax law requires. No separate product retention period has been chosen.
7. Leave issued quotes, including pages opened from a customer link, in place. The Privacy Notice says job notes, photos, quotes, and customer details are not kept merely to meet that tax period. Whether a sent quote may be removed is an owner decision. This request does not remove it.
8. There is no product action that performs the deletion. Closing the request in the database, when that is eventually done by hand, only changes the request row. It does not delete the account.

## Owner decisions still open

- The product retention period, if any, beyond the tax-law statement already in the Privacy Notice.
- Whether a quote that was sent can later be removed, and what happens to the customer link.
- How a company with other members is closed or transferred. The product cannot do either today.
- Who at Quotr is allowed to fulfil a confirmed request once a real deletion path exists.

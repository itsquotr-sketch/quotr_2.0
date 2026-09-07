# Quote Display V1 / V1B / V1C closeout

Builders choose how much pricing detail a client sees on a Quote. Presentation is frozen in each issued snapshot. The document grand total is never hidden.

Preview only. Migration **054**. No 055. Production not in scope.

## V1C close — hosted matrix O–R

QUOTE-DISPLAY-V1C finishes the missing hosted presentation configurations with **two fresh product-flow Quotes** (not a revision chain from B):

- Fixture S: Continue to Pricing → Mark as reviewed → Create quote → Summary → issue → public
- Fixture L: after that pricing converts, **Mark as reviewed** again on the pricing document (required commercial step) → Create revision → line-total-off → issue → public

Do not flip `converted_to_quote` back to `reviewed` in the database. That conversion is a commercial invariant.

## V1B close

Hosted first-send **issues before email**. A public token on a draft is not a valid issued Quote on the official renderer. Email failure after issue leaves the Quote `sent`.

If email is accepted but finalize is still pending, Copy client link remains available (`data-quote-public-path` + `sessionStorage` recovery). Do not hide the issued URL behind a success-only panel. That recovery is acceptable for V1 close; a dedicated post-send modal is **minor UX debt**, not a V1 blocker.

## Supported configurations

| Configuration | Client line columns | Document total |
| --- | --- | --- |
| Detailed | Description, Qty, Unit, Unit price, Line total | Visible |
| Standard default | Description, Qty, Unit, Line total | Visible |
| Summary | Description, Line total | Visible |
| Minimal line detail | Description, Qty, Unit | Visible |

Display controls must never hide the client's total commitment.

## What shipped

Per-Quote **Client quote display** controls on the Quote page:

- Description always shown
- Quantity, Unit, Unit price, Line total toggles
- New-draft default hides unit price
- Issued Quotes freeze `issuer_snapshot.display_options`
- Public / print / mobile compose only enabled columns
- Grand total always remains visible
- First send: prepare → `send_quote_revision_v1` → email → finalize delivery
- Hidden qty / unit / unit price are redacted from the public line payload
- Per-line `total` stays in the payload so grouped Work Area totals can still be computed; the renderer does not show it when Line total is off

## Storage

No new column. Settings nest on existing `issuer_snapshot` JSONB. Legacy issued Quotes without the key keep today’s full column set (including unit price).

## Quantity / Unit

Turning Quantity off also turns Unit off. Turning Quantity back on leaves Unit off until the builder turns Unit on again (deterministic A).

## Deferred SQL lookup hardening

`lookup_quote_public_by_token_hash_v1` may still return a draft row at SQL level under some prepared/accepted-delivery states. Current official renderer rejects Draft. Current send path issues before external email. **DEFERRED HARDENING** — not a Quote Display V1 blocker. Do not create migration 055 in this phase. Tracked on the pre-production/release backlog as **QDISP-SQL-055**.

## Out of scope

Company-wide display defaults, email line tables, PDF engine, Production, password mutation, migration 055, Copy-client-link modal redesign, pre-beta close.

## Verifiers

- `scripts/verify-quote-display-v1.ts`
- `scripts/verify-quote-display-v1b-hosted-close.ts`
- `scripts/verify-quote-display-v1c-final-close.ts`
- Hosted: `.tmp-quote-display-v1c/hosted-proof.ts`

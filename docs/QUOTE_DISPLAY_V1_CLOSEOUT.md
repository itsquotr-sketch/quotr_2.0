# Quote Display V1 / V1B closeout

Builders choose how much pricing detail a client sees on a Quote. Presentation is frozen in each issued snapshot.

Preview only. Migration **054**. No 055. Production not in scope.

## V1B close

Hosted first-send now **issues before email**. A public token on a draft is not a valid issued Quote on the official renderer. Email failure after issue leaves the Quote `sent`.

If email is accepted but finalize is still pending, Copy client link remains available (`data-quote-public-path`). Do not hide the issued URL behind a success-only panel.

## What shipped

Per-Quote **Client quote display** controls on the Quote page:

- Description always shown
- Quantity, Unit, Unit price, Line total toggles
- New-draft default hides unit price
- Issued Quotes freeze `issuer_snapshot.display_options`
- Public / print / mobile compose only enabled columns
- Grand total always remains visible
- First send: prepare → `send_quote_revision_v1` → email → finalize delivery

## Storage

No new column. Settings nest on existing `issuer_snapshot` JSONB. Legacy issued Quotes without the key keep today’s full column set (including unit price).

## Quantity / Unit

Turning Quantity off also turns Unit off. Turning Quantity back on leaves Unit off until the builder turns Unit on again.

## Out of scope

Company-wide display defaults, email line tables, PDF engine, Production, password mutation, migration 055.

## Next

QUOTE-DISPLAY-V1 hosted issuance close. Do not start final pre-beta close until that GO.

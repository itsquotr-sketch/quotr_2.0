# Quote Display V1 closeout

Builders choose how much pricing detail a client sees on a Quote. Presentation is frozen in each issued snapshot.

Preview only. Migration **054**. No 055. Production not in scope.

## What shipped

Per-Quote **Client quote display** controls on the Quote page:

- Description always shown
- Quantity, Unit, Unit price, Line total toggles
- New-draft default hides unit price
- Issued Quotes freeze `issuer_snapshot.display_options`
- Public / print / mobile compose only enabled columns
- Grand total always remains visible

## Storage

No new column. Settings nest on existing `issuer_snapshot` JSONB. Legacy issued Quotes without the key keep today’s full column set (including unit price).

## Quantity / Unit

Turning Quantity off also turns Unit off.

## Out of scope

Company-wide display defaults, email line tables, PDF engine, Production, password mutation, migration 055.

## Next

Owner review of QUOTE-DISPLAY-V1. Do not start final pre-beta close until reviewed.

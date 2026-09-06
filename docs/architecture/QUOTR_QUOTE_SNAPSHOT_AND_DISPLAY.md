# Quote snapshot and client display

**Classification:** CANONICAL — Quote presentation on issued snapshots  
**Status:** Active — QUOTE-DISPLAY-V1  
**Related:** `docs/architecture/COMMERCIAL_SNAPSHOT_SAFETY.md`, `docs/specifications/FINANCIAL_PRESENTATION_BOUNDARY.md`

---

## Snapshot authority

The issued Quote **is** the `quotes` row plus `quote_items`. There is no separate versioned JSON document. After send, `prevent_quote_snapshot_mutation` freezes commercial fields, `presentation_mode`, and `issuer_snapshot`.

Client column visibility is presentation-only and lives in existing snapshot JSON:

```
issuer_snapshot.display_options = {
  show_quantity: boolean,
  show_unit: boolean,
  show_unit_price: boolean,
  show_line_total: boolean
}
```

Description is always shown and is not stored as a toggle. No schema migration. Preview remains through 054.

Display settings do not change cost, sell, GM, GST, quantities, rates, rounding, or the Quote total.

---

## Draft vs issued

| State | Display settings |
| --- | --- |
| Draft | Editable on the Quote page (`Client quote display`) |
| Issued / sent / accepted | Frozen with that revision |
| Want different columns | Create a revision; do not mutate history |

Company / Rates / Setup do not store quote-display defaults in V1. Per Quote only.

---

## Defaults

**New drafts** (written at create):

- Quantity ON
- Unit ON
- Unit price OFF
- Line total ON

**Legacy issued Quotes** without `display_options` keep today’s renderer:

- Quantity, Unit, Unit price, and Line total all visible

Do not apply V1 defaults retroactively to historical issued Quotes.

---

## Quantity / Unit

Independent toggles, with coherence: turning Quantity OFF also turns Unit OFF and disables Unit. A Unit column without Quantity is not shown.

---

## Line totals and work areas

Hiding line totals hides the per-line amount only. Document subtotal, GST (where shown), and grand total remain visible.

Grouped presentation (`presentation_mode = grouped`) still shows Work Area / section totals. That is independent of the line-total toggle. V1 does not add a section-total control.

---

## Revisions

A new revision copies the prior Quote’s display settings (legacy absence copies the historical all-columns-on behaviour). The builder may change them before issuing. The old revision stays unchanged.

---

## Renderers

- **Client / public / print:** columns compose from the frozen snapshot. Desktop uses a table of enabled columns only. At ~390px, line-item cards show only enabled fields. No horizontal page scroll.
- **Builder Quote workspace:** Pricing and quote totals stay full commercial detail. The labelled **What the client will see** preview follows display settings.
- **Email:** View Quote CTA only. No line-item table in mail.

Print uses `QuoteTemplate` (browser print / Save as PDF). No separate PDF generator. Display settings apply there.

---

## Permissions

Whoever can already edit/send a Quote (`quotes.create` / `quotes.send`) may change draft display settings. No new permission. SECURITY-053 unchanged. Viewer cannot mutate.

---

## Client-safe boundary

Display controls apply only to already client-safe commercial fields (description, quantity, unit, unit price, line total). Cost, gross margin, Company DNA, productivity, and diagnostic metadata stay internal.

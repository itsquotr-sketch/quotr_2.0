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

The public renderer omits hidden presentation fields from the line payload (`unit_price` / `quantity` / `unit` nulled when off). Per-line `total` remains available so grouped Work Area totals can be computed; it is not shown when Line total is off. The official `/q/[token]` page refuses `draft` and `archived` Quotes even if `lookup_quote_public_by_token_hash_v1` would return them.

---

## Canonical Quote states

Existing `quotes.status` values. Do not invent a parallel vocabulary.

| Status | Meaning |
| --- | --- |
| `draft` | Editable. Not a client-valid issued Quote. |
| `sent` | Issued. Snapshot frozen. Email may still be in flight or failed. |
| `viewed` | Client opened an issued Quote. |
| `accepted` / `declined` | Commercial outcome. Frozen snapshot unchanged. |
| `expired` / `superseded` / `archived` | Terminal / historical. |

`markQuoteSent` issues without email. `sendQuoteToClient` issues then notifies. Those are the same commercial issue (`send_quote_revision_v1`); email is delivery, not the freeze.

---

## Issuance order

Builder Send:

1. Auth, `quotes.send`, delivery config
2. Capture issuer identity; allocate quote number on first send
3. Hash commercial fingerprint v1 (**not** `display_options`)
4. RPC `prepare_quote_delivery_v1` — draft lock, `quote_deliveries` + `quote_access_tokens` (token is not yet a valid issued Quote)
5. RPC `send_quote_revision_v1` — **issue / freeze** (`draft` → `sent`, `issuer_snapshot` including `display_options`)
6. External email API (Resend)
7. RPC `record_quote_delivery_accepted_v1` then `finalize_quote_delivery_v1` (marks delivery submitted; issue is idempotent if already `sent`)

Email failure after step 5 leaves the Quote **issued**. Delivery is `failed`. Builder resends without creating a new snapshot. Email failure does not roll the Quote back to draft.

If email is accepted but `finalize_quote_delivery_v1` is still pending, the Quote is already `sent`. The builder Copy-client-link control must still expose `publicPath` from that request (held across `router.refresh()` for the same Quote id). A pending finalize is not a reason to hide the issued public URL.

`finalize_quote_delivery_v1` still calls `send_quote_revision_v1` so an older in-flight “email accepted, issue pending” row can be recovered without a migration.

---

## Token lifecycle

- **Created** at `prepare_quote_delivery_v1` (new hash, or reuse on idempotent retry).
- **Client-valid on the official renderer** only when canonical Quote status is publicly viewable (`sent` / `viewed` / `accepted` / `declined` / `expired` / `superseded`). Draft is never rendered as an issued Quote.
- SQL `lookup_quote_public_by_token_hash_v1` still allows a draft after the matching delivery is `accepted`/`submitted`/`delivered`/`bounced`/`complained` (email-before-sent compatibility). Closing that RPC window requires migration 055, which this phase does not add. The send path no longer uses that window: issue happens before the provider call.
- Failed first-send (`preparing`/`failed`) tokens are not client-valid while the Quote remains draft.
- Retry with the same idempotency key reuses the delivery. A later **resend** after issue may insert another token; both point at the same issued revision. Latest submitted delivery is the email authority; the Quote row is the commercial authority.
- Failed issuance that never reached `sent` must not leave a client-valid public Quote. Failed email after `sent` is recoverable resend.

Acceptance RPCs require `sent` or `viewed`. A draft cannot be accepted.

---

## Retry / idempotency

`prepare_quote_delivery_v1` reuses `idempotency_key` for in-progress / accepted / submitted rows. Double-click does not create a second first-send revision. `send_quote_revision_v1` is idempotent when status is already `sent`. Resend is a new delivery attempt on the same frozen Quote, not a new issue.

---

## Commercial fingerprint v1

Presentation-only. `issuer_snapshot.display_options` is stripped from fingerprint v1. Changing columns does not change quantities, rates, GST, or totals, so it does not change the fingerprint. A revision is required after issue only because the issued snapshot is immutable.

Acceptance evidence references the frozen revision / `snapshot_fingerprint`, not the display toggles.

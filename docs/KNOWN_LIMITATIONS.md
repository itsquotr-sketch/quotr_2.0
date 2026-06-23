# Known limitations (internal)

Current limitations for Quotr 2.0 test release. Share selectively with test users.

## Product scope

- **No RFQ or subcontractor portal** — subcontractor pricing is entered manually in final pricing.
- **No accounting integration** — no Tradify, Xero or invoice sync.
- **No email sending** — quotes are exported via browser print / Save as PDF.
- **No client acceptance portal** — quote status is updated manually in Quotr.
- **No payment links** — payment terms are text only.
- **No full mobile site-walk mode** — site notes work on mobile but the app is desktop-first.
- **No team permissions** — single-org access per user account for V1.
- **No subscription/billing** — billing logic not implemented.

## AI and estimating

- **AI scope recognition may need review** — always confirm work areas and scope before estimating.
- **Estimates are guidance** — outputs depend on brief quality, rates and confirmed scope. Must be checked before use.
- **Final pricing must be reviewed** before creating a client quote.
- **Calibration of all work areas is still pending** — not all trade types may have tuned defaults.

## Quotes and export

- **Browser print headers/footers** — users may need to disable “Headers and footers” in the print dialog for a clean PDF.
- **Quote layout is template-based** — no drag-and-drop quote designer.
- **Payment terms** come from company defaults unless edited in quote terms text.

## Technical

- **Session expiry** — users are prompted to sign in again if the session expires mid-action.
- **Raw errors** — most paths return friendly messages; edge cases may still need hardening.
- **Performance** — large projects with many line items may feel slower; major architecture optimisations are deferred.

## Data

- **Quote snapshots** — revising a quote creates a new revision; superseded quotes remain for history.
- **Company settings changes** do not retroactively alter existing pricing documents or quotes.

## Reporting issues

Test users should use **Report issue** in the sidebar or account menu. Set `NEXT_PUBLIC_FEEDBACK_EMAIL` in production so mailto links address the right inbox.

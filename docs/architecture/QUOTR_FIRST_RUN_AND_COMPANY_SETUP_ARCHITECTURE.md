# Quotr First-Run & Company Setup Architecture

**Stage:** 3.1C.3  
**Status:** Active

## Principles

1. A builder should experience Quotr quickly.
2. Company configuration improves quality progressively.
3. Hard-block only when output would be invalid or misleading.
4. Profile = human user; Company settings = organisation commercial identity.
5. No second competing state machine; readiness is computed.

## Minimum first-run gate

After account provisioning (`accountReady`):

**Confirm:** currency, country, GST rate (company name prefilled from signup).  
**Optional:** region.  
**Do not force:** rates, margin, work areas, branding, quote terms.

Persisted signal: `organisation_settings.onboarding_status` leaves `not_started` → `in_progress` via `saveCompanyBasics`.  
No `setup_complete` column.

## Readiness model

`computeCompanySetupReadiness` / `getCompanySetupReadiness`:

| Flag | Meaning |
| --- | --- |
| `accountReady` | Auth + profile + org |
| `companyBasicsReady` | First-run basics confirmed |
| `estimateReady` | Basics done (defaults/benchmarks allowed) |
| `pricingReady` | Basics + at least one labour cost rate |
| `quoteReady` | Basics + display name + contact email/phone |

Suggestions arrays feed Dashboard, Estimate, Pricing, Quote banners.

## Company Settings IA

| Section | Contents |
| --- | --- |
| General | Trading/legal name, contact, address, GST number |
| Pricing defaults | GST rate; link to Rates for margin/labour |
| Quotes | Validity, terms, branding |
| Advanced | Material wastage |

Rates remain `/app/rates` (single commercial rates authority).

## Skip / defer

See `lib/setup/field-classification.ts` → `SKIP_DEFER_RULES`.

## Boundaries

- No Company DNA
- No Stage 3.2
- No Production Scope Discovery enablement
- No commercial formula changes
- No migration unless proven necessary (3.1C.3: none)

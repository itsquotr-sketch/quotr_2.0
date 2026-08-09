# Stage 3.1C.3 — First-Run & Company Setup Completion

**Status:** Complete — Local  
**Date:** 2026-08-09  
**Preview first-run E2E:** Pending Owner Test

## Delivered

1. Field classification + skip/defer rules (`lib/setup/field-classification.ts`)
2. Readiness composer + loader (`lib/setup/readiness.ts`, `readiness-actions.ts`)
3. Company basics first-run (`CompanyBasicsStep`, `saveCompanyBasics`)
4. Dashboard: Welcome basics → then Create project primary + ImproveSetupCard
5. Company Settings IA: General / Pricing / Quotes / Advanced
6. Progressive banners on Estimate / Pricing / Quote
7. `markQuoteSent` hard-blocks when `!quoteReady`
8. Rates empty-state copy prioritises labour rate
9. Verify script + docs

## Migration decision

**No migration.** Existing `organisation_settings` + `onboarding_status` + rates tables suffice. Readiness is computed.

## Boundaries

- Stage 3.2 **not started**
- Production Scope Discovery **disabled**
- Commercial formulas **unchanged**
- Company DNA **not implemented**

## Verify

```bash
npx --yes tsx scripts/verify-stage-3-1c3-first-run-company-setup.ts
```

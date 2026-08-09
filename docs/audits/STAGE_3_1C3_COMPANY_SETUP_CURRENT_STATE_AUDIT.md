# Stage 3.1C.3 — Company Setup Current State Audit

**Date:** 2026-08-09  
**Status:** Complete (pre-implementation inventory + post-change notes)

## Journey (brand-new provisioned user)

```
Signup → transactional org/profile → (email confirm if enabled)
→ /app/dashboard
→ [3.1C.3] company basics if onboarding_status = not_started
→ Dashboard (Create first project)
→ Project Capture → Analyse → Scope → Quick Estimate
→ Prepare final pricing → Quote draft → Mark sent (contact required)
```

## Hard gates (before 3.1C.3)

| Gate | Blocks |
| --- | --- |
| Missing profile/org | Entire app → `/app/setup-required` |
| Soft onboarding incomplete | Nothing hard (prompt only) |
| Create project | Auth + org + title only |

## Soft surfaces audited

- `/app/setup` — multi-step wizard (company defaults → work areas → rates → review)
- `/app/settings/company` — identity, GST, quote terms, branding, wastage
- `/app/rates` — margin defaults + rate cards
- Dashboard `SetupPromptCard` — “Finish setting up Quotr” (replaced in 3.1C.3)

## Schema substrate (no new migration required)

- `organisations.name`
- `organisation_settings` — currency, country, region, margin, GST, onboarding_*, quote identity/terms, branding, wastage
- `rates`, `organisation_work_areas`

## Defaults preserved

- Gross margin **20%** (max 95%)
- GST **15%**
- Currency **NZD**, country **NZ**
- Contingency **10%**
- Budget/premium factors **0.9 / 1.15**

## Gaps closed by 3.1C.3

- Minimal first-run (name/currency/country/GST) without forcing rates
- Computed readiness dimensions (estimate / pricing / quote)
- Dashboard primary CTA = Create project
- Progressive contextual prompts
- Quote Mark sent blocked without company contact

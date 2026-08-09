# Quotr First-Run Gating Model

**Stage:** 3.1C.3-R1 (architecture) / **R2A implemented**  
**Status:** Active — hard basics gate live in app layout

## Principles

1. Get a contractor to value quickly.
2. Require only what Quotr cannot safely default.
3. Never show “Finish setup” as mandatory while New Project is available.
4. Readiness is **computed**; do not elevate `onboarding_status === completed` to product authority.
5. Profile ≠ Company; rates ≠ first-run.

## Journey (R2A)

```
SIGNUP → confirmation/provisioning (accountReady)
  → /app/setup?mode=basics  (required)
  → /app/dashboard

PRIMARY: Create your first project
SECONDARY: Improve Quotr for your business (/app/setup?mode=improve)
```

### Compulsory Company Basics

| Field | Required? |
| --- | --- |
| Company name | Yes (signup identity, read-only on basics) |
| Country | Yes — controlled NZ/AU |
| Currency | Yes — controlled NZD/AUD |
| GST / tax | Yes — suggested, user confirms (0 allowed) |
| Region | Optional |

Engine does **not** require rates, work areas, margin, quote terms, or logo before first project.

## Gating implementation (R2A)

| State | Behaviour |
| --- | --- |
| `!accountReady` | `/app/setup-required` |
| `needsCompanyBasics` | Layout redirect → `/app/setup?mode=basics` (no Dashboard flash) |
| After basics | Dashboard; Incomplete badge off |
| Optional | `/app/setup?mode=improve` — Company save stays in Setup |

### `onboarding_status` narrow meaning

| Value | Meaning |
| --- | --- |
| `not_started` / null | Basics not confirmed |
| `in_progress` | Basics confirmed |
| `completed` | Legacy only — not badge/Dashboard authority |

Sidebar Incomplete = `needsCompanyBasics()` only.

## Readiness

| Flag | Meaning |
| --- | --- |
| `accountReady` | Auth + profile + org |
| `companyBasicsReady` | Left `not_started` via basics save |
| `estimateReady` | Basics done (defaults/benchmarks OK) |
| `pricingReady` | Basics + labour rate |
| `quoteReady` | Basics + display name + contact |

Do not imply basics == rates == quote ready.

## Review / Mark complete

Removed from required Setup navigation (R2A). Optional summary may return later without product authority.

## Dashboard after basics

| Element | Role |
| --- | --- |
| Create your first project | Primary |
| Improve Quotr for your business | Secondary |
| Finish setting up Quotr | Removed |

## Setup routing

| Context | Save | Result |
| --- | --- | --- |
| `mode=basics` | Success | → Dashboard |
| `mode=improve` | Success | Stay in Setup |

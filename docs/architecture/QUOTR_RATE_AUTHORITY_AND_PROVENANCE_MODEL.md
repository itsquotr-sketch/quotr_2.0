# Quotr Rate Authority & Provenance Model

**Stage:** 3.1C.3-R2C  
**Status:** Active  
**Code:** `lib/rates/authority.ts`

## Presentation authorities

| Code | UI label | Meaning |
| --- | --- | --- |
| `EXPLICIT_COMPANY` | Your company rate | Org `rates` row with active `cost_rate` |
| `PROJECT_OVERRIDE` | Project override | Project/pricing explicit edit |
| `BENCHMARK` | Quotr benchmark | Code/catalogue default — not company authority |
| `FALLBACK` | Default assumption | Engine default when allowed |
| `LEGACY_SCOPE_RATE` | Overall benchmark rate | Generic package $/m² (or similar) if stored |
| `FUTURE_CALIBRATION` | Calibration evidence | R2D — never silent overwrite |
| `MISSING` | Pricing required | No explicit rate |

## Rules

1. Never label catalogue defaults or seeded benchmarks as “Your rate”.  
2. Explicit adopt (“Use benchmark”) writes company `cost_rate`/`sell_rate`.  
3. Calibration / DNA (future) may suggest — never silently replace explicit rates.  
4. Generic scope package rates are not primary pricing authority.

## Cost vs sell

- **Cost:** what it costs the business.  
- **Sell:** what is charged. If sell blank and cost present → derive via default margin.  
- Both columns exist; cost is required for company-authority resolution.

## Persistence gap (R2C)

No migration. Provenance is derived. If future product needs persisted `source` enum, owner-gate migration 033.

# Rates UI — Cost-First Direction

**Status:** Cost-first Rates **Complete Local / Owner Preview Pending** (2026-08-14)  
**Completion:** `docs/implementation/COST_FIRST_RATES_COMPLETION.md`  
**Owner preview:** `docs/runbooks/COST_FIRST_RATES_OWNER_PREVIEW.md`

---

## Shipped behaviour

1. **Your cost** is the primary contractor input.
2. **Recommended charge-out** = cost ÷ (1 − company gross margin) via shared F-SFM helpers.
3. **Custom charge-out** is secondary; clears via “Use recommended rate”.
4. Existing paired sells are **retained** until the contractor opts into recommended.
5. Benchmark adopt stores **cost only** (derive sell).
6. No migration; no bulk conversion of historical rows.

## Still later

- MaterialRequirement / takeoff
- Catalogue expansion (framing sizes, etc.)
- Bulk benchmark cost-only publication across calculator constants
- Stage 3.2.3

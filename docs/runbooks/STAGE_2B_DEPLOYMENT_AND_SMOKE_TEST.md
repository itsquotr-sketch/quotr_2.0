# Stage 2B — Deployment and Smoke Test Runbook

**Status:** Ready for owner-gated execution  
**Stage status:** Complete — Local (deployment not executed in Batch 2B.10)  
**Schema:** No Stage 2B migrations required  

Do not treat this document as authorisation to deploy. Owner must approve remote deploy and smoke.

---

## 1. Pre-deployment checks

- [ ] `docs/implementation/STAGE_2B_COMPLETION_REPORT.md` shows **Complete — Local**
- [ ] Acceptance checklist has no Critical/High Fail
- [ ] Local verification green:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`
  - Stage 2A scripts (2A.1–2A.5 + RLS)
  - Stage 2B scripts (2B.3B–2B.10)
- [ ] No unintended `.env` / secret changes in the release commit
- [ ] No new Supabase migrations in the Stage 2B release set

---

## 2. Branch / commit checks

- [ ] Release branch contains Stage 2B completion commit(s) only for intended scope
- [ ] `git status` clean for release artefacts (ignore local `.next` noise)
- [ ] Commit message references Stage 2B / commercial engine adoption
- [ ] Confirm Stage 2C / DNA / AI redesign files are absent

---

## 3. Vercel deployment process

1. Merge or promote the approved Stage 2B commit to the production deployment branch.
2. Trigger Vercel production deploy (or rely on branch auto-deploy if configured).
3. Confirm build succeeds (Next.js build, no type errors).
4. Confirm production env vars unchanged for Supabase URL/keys (no Stage 2B secret rotation required).
5. Record deploy URL, commit SHA, and timestamp in the sign-off section.

---

## 4. Supabase confirmation (no migration)

Stage 2B adoption is application-layer only.

- [ ] Confirm no pending Stage 2B migration files are being applied
- [ ] Confirm remote schema remains aligned with Stage 2A baseline (001–027 as previously signed off)
- [ ] Do **not** add `cost_known` or engine-version columns in this deploy

---

## 5. Production smoke test

Use a safe org/account. Prefer a non-customer sandbox project.

### Estimate

- [ ] Create estimate
- [ ] Edit line quantity / rate; totals update after save/refresh
- [ ] Unknown-cost / sell-only style line shows honest profitability labels where applicable
- [ ] Target margin override updates sells without fabricating unknown margins

### Pricing

- [ ] Convert estimate → pricing
- [ ] Create / update / delete pricing item
- [ ] Recalibrate from estimate (manual overrides preserved where flagged)
- [ ] Document GST uses org/document rate (default path 15% NZ)
- [ ] Optional: in a safe account, set GST to 0% or non-15% and confirm GST amount / total incl. GST

### Quote

- [ ] Create quote from pricing
- [ ] Edit draft quote item / visibility
- [ ] Create revision (new record; prior snapshot unchanged)
- [ ] Mark sent / accepted without money rewrite
- [ ] Print / export shows stored snapshot values

### Cross-checks

- [ ] Save / refresh preserves money
- [ ] No raw server errors exposed to UI
- [ ] Cross-org access still blocked (spot-check: cannot open another org’s quote/pricing URL)

---

## 6. Log checks

- [ ] No surge of calculation validation failures after deploy
- [ ] No unexpected 500s on estimate/pricing/quote actions
- [ ] Auth failures remain expected for unauthenticated calls

---

## 7. Rollback steps

Preferred order:

1. **Vercel rollback** to previous production deployment SHA.
2. If money regressions are isolated to a domain adoption commit: **`git revert`** that commit and redeploy.
3. Emergency only: set domain `*_CALCULATION_AUTHORITY` to `"legacy"` and redeploy — prefer git revert; never dual-write; never expose as a UI switch.

Do not run SQL to bulk-rewrite historical quotes.

---

## 8. Post-deployment sign-off

| Field | Value |
| --- | --- |
| Deploy date | |
| Commit SHA | |
| Vercel deployment URL | |
| Smoke tester | |
| Smoke result | Pass / Fail |
| Rollback used? | No / Yes (detail) |
| Stage 2B remote status | Complete — Remote (only after Pass) |
| Notes | |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/runbooks/STAGE_2B_DEPLOYMENT_AND_SMOKE_TEST.md` |
| Created | 2026-08-05 |
| Executed in 2B.10? | **No** |

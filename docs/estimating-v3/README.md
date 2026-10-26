# Estimating V3 Stage 0

Audit and plan only. No estimator rewrite and no customer-data change. Stage 1 later shipped the four completion fixes; the release record is in [STAGE_1_ACCEPTANCE.md](./STAGE_1_ACCEPTANCE.md).

| Document | Contents |
| --- | --- |
| [STAGE_0_BASELINE.md](./STAGE_0_BASELINE.md) | Serving website and Android SHAs, branch parent, worktrees left untouched |
| [STAGE_0_ARCHITECTURE.md](./STAGE_0_ARCHITECTURE.md) | Pipeline, shared contracts, and the places those contracts disagree |
| [STAGE_0_DEFECT_REGISTER.md](./STAGE_0_DEFECT_REGISTER.md) | Blockers and coverage gaps, with reproduction and severity |
| [STAGE_0_CAPABILITY_MATRIX.md](./STAGE_0_CAPABILITY_MATRIX.md) | Work areas, rate precedence, margin, and double-count checks |
| [STAGE_0_ACCEPTANCE_FIXTURES.md](./STAGE_0_ACCEPTANCE_FIXTURES.md) | Deterministic briefs and the current versus desired results |
| [STAGE_0_IMPLEMENTATION_PLAN.md](./STAGE_0_IMPLEMENTATION_PLAN.md) | Incremental design and later stages |
| [STAGE_1_BLOCKER_SCOPE.md](./STAGE_1_BLOCKER_SCOPE.md) | The four blockers Stage 1 was allowed to change |
| [STAGE_1_CORRECTION.md](./STAGE_1_CORRECTION.md) | What Stage 1 changed, and what it left untouched |
| [STAGE_1_ACCEPTANCE.md](./STAGE_1_ACCEPTANCE.md) | Browser status, safe build, and unpushed release branches |

Runnable evidence: `scripts/verify-estimating-v3-stage0.ts` and `scripts/verify-estimating-v3-stage1.ts`.

A follow-up pass added the contract gaps that the first write-up had not yet checked: door customer-supply keys, the split between `resolveRate` and `resolveMaterialRate`, cladding’s missing template, the four calculators with no consumed-fact contract, legacy flooring stairs, and the bathroom-floor overlap group. Those notes are in the architecture, defect register, and capability matrix. The fixture locks the template and consumed-fact cases.

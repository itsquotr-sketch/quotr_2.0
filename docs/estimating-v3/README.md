# Estimating V3 Stage 0

Audit and plan only. No estimator rewrite, no Production deploy, and no customer-data change.

| Document | Contents |
| --- | --- |
| [STAGE_0_BASELINE.md](./STAGE_0_BASELINE.md) | Serving website and Android SHAs, branch parent, worktrees left untouched |
| [STAGE_0_ARCHITECTURE.md](./STAGE_0_ARCHITECTURE.md) | Pipeline, shared contracts, and the places those contracts disagree |
| [STAGE_0_DEFECT_REGISTER.md](./STAGE_0_DEFECT_REGISTER.md) | Blockers and coverage gaps, with reproduction and severity |
| [STAGE_0_CAPABILITY_MATRIX.md](./STAGE_0_CAPABILITY_MATRIX.md) | Work areas, rate precedence, margin, and double-count checks |
| [STAGE_0_ACCEPTANCE_FIXTURES.md](./STAGE_0_ACCEPTANCE_FIXTURES.md) | Deterministic briefs and the current versus desired results |
| [STAGE_0_IMPLEMENTATION_PLAN.md](./STAGE_0_IMPLEMENTATION_PLAN.md) | Incremental design and later stages |
| [STAGE_1_BLOCKER_SCOPE.md](./STAGE_1_BLOCKER_SCOPE.md) | The only code changes proposed next |

Runnable evidence: `scripts/verify-estimating-v3-stage0.ts`.

A follow-up pass added the contract gaps that the first write-up had not yet checked: door customer-supply keys, the split between `resolveRate` and `resolveMaterialRate`, cladding’s missing template, the four calculators with no consumed-fact contract, legacy flooring stairs, and the bathroom-floor overlap group. Those notes are in the architecture, defect register, and capability matrix. The fixture locks the template and consumed-fact cases.

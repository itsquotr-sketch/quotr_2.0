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
| [STAGE_1_ACCEPTANCE.md](./STAGE_1_ACCEPTANCE.md) | Browser status, safe build, and release branches |
| [V3_INTEGRATION_BASELINE.md](./V3_INTEGRATION_BASELINE.md) | Integration branch, Preview identities, and Stage 2A scope |
| [STAGE_2A_HANDOFF.md](./STAGE_2A_HANDOFF.md) | Analysis-to-Details handoff, compatibility, and what is still open |
| [STAGE_2A_ORIGINAL_BRIEFS.md](./STAGE_2A_ORIGINAL_BRIEFS.md) | The three supplied acceptance briefs, stored verbatim |
| [STAGE_2A_INSTANCE_IDENTITY.md](./STAGE_2A_INSTANCE_IDENTITY.md) | UUID and measurement matching, and the unapplied identity column |

Runnable evidence: `scripts/verify-estimating-v3-stage0.ts`, `scripts/verify-estimating-v3-stage1.ts`, and `scripts/verify-estimating-v3-stage-2a.ts`.

A follow-up pass added the contract gaps that the first write-up had not yet checked: door customer-supply keys, the split between `resolveRate` and `resolveMaterialRate`, cladding’s missing template, the four calculators with no consumed-fact contract, legacy flooring stairs, and the bathroom-floor overlap group. Those notes are in the architecture, defect register, and capability matrix. The fixture locks the template and consumed-fact cases.

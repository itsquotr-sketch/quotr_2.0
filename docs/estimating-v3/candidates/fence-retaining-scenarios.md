# Fence and retaining-wall area checks

Recorded on integration `475acf23b4cccf9fdea3264ff3de0905f5cf6969`. These are two deterministic area-formula checks. They are not end-to-end assembly acceptance. Declared live model calls: 0. No analysis call, no hosted write, and no company rate was changed. Reproduction: `npx tsx qa-evidence/fence-retaining/representative-scenarios.ts`.

## Fence

Existing timber vertical contract. One fence, 18 m long and 1.8 m high, system “Timber paling — vertical board”, Radiata Pine, 150 × 19 mm boards, 1.8 m post spacing, one 0.9 m gate within the run, top capping and gate capping included, paling gap 0.

- Expected face area, calculated before the run: 18 × 1.8 = 32.4 m².
- Actual face area: 32.4 m². **PASS** for the area formula only.

## Retaining wall

Existing timber retaining-wall contract. One wall, 15 m long, raking from 1.6 m to 0.6 m, H5 SED retaining poles, backfill included, excavation 6 m³ with digger access, drainage included, drainage sock not required, disposal excluded.

- Expected face area, from `faceAreaM2(15, 1.6, 0.6)`: 15 × (1.6 + 0.6) / 2 = 16.5 m².
- Actual geometry and physical face area: 16.5 m². Readiness `SLOPING_HEIGHT_AVAILABLE`. **PASS** for the area formula only.

Posts, boards, poles, and benchmark money were not scored. A missing company rate is not a defect. This record does not accept either family as a complete assembly.
